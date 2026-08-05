"""
Family Employee Documentation Module - Backend Router
IRS-Compliant: W-4, FICA, withholding calculations, SSN/ITIN, EIN tracking.
"""
import logging
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/family-employees", tags=["Family Employees"])

# ============================================
# MODELS
# ============================================

class BusinessSetup(BaseModel):
    business_name: str = ""
    tax_year: int = 2025
    owner_name: str = ""
    business_address: str = ""
    ein: str = ""
    owner_ssn: str = ""
    business_type: str = "Sole Proprietorship"

class EmployeeCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    ssn_itin: Optional[str] = None
    relationship: str = "Child"
    position: str = "Office Assistant"
    annual_compensation: float = 0
    hourly_rate: float = 0
    pay_frequency: str = "Weekly"
    hire_date: Optional[str] = None
    duties: str = ""
    evidence_notes: str = ""
    # W-4 fields
    filing_status: str = "Single"
    w4_allowances: int = 0
    additional_withholding: float = 0
    is_exempt_fit: bool = False

class WorkLogEntry(BaseModel):
    date: str
    hours: float
    task_description: str
    initials: str = ""

class PaymentLogEntry(BaseModel):
    date: str
    amount: float
    payment_method: str = "Cash"
    purpose: str = ""
    acknowledgment: str = ""
    check_number: str = ""
    # Withholding breakdown (auto-calculated or manual)
    federal_withholding: float = 0
    social_security: float = 0
    medicare: float = 0
    state_withholding: float = 0
    net_pay: float = 0

# ============================================
# IRS TAX CALCULATIONS
# ============================================

def calculate_age(dob_str: str, as_of_year: int = None) -> int:
    """Calculate age as of Dec 31 of the tax year"""
    if not dob_str:
        return 0
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        year = as_of_year or datetime.now().year
        ref_date = date(year, 12, 31)
        age = ref_date.year - dob.year - ((ref_date.month, ref_date.day) < (dob.month, dob.day))
        return max(0, age)
    except:
        return 0

def get_fica_exemptions(relationship: str, age: int) -> dict:
    """Determine FICA exemptions based on IRS rules for family employees"""
    exempt_ss_medicare = False
    exempt_futa = False
    notes = []

    if relationship == "Child":
        if age < 18:
            exempt_ss_medicare = True
            notes.append("Child under 18: EXEMPT from Social Security & Medicare (IRC §3121(b)(3)(A))")
        if age < 21:
            exempt_futa = True
            notes.append("Child under 21: EXEMPT from FUTA (IRC §3306(c)(5))")
    elif relationship == "Spouse":
        exempt_futa = True
        notes.append("Spouse employee: EXEMPT from FUTA (IRC §3306(c)(5))")
    elif relationship == "Parent":
        exempt_futa = True
        notes.append("Parent employee: EXEMPT from FUTA (IRC §3306(c)(5))")
        # Parent employed by child: exempt from FICA if certain conditions
        notes.append("Parent employed by child: May be exempt from FICA under certain conditions")

    return {
        "exempt_social_security": exempt_ss_medicare,
        "exempt_medicare": exempt_ss_medicare,
        "exempt_futa": exempt_futa,
        "notes": notes,
    }

def calculate_federal_withholding(annual_gross: float, filing_status: str, allowances: int = 0, additional: float = 0, is_exempt: bool = False) -> float:
    """Calculate federal income tax withholding (2025 brackets)"""
    if is_exempt or annual_gross <= 0:
        return 0

    # 2025 Standard Deduction
    std_deduction = 15000 if filing_status == "Single" else 30000
    # W-4 allowance value (approx $4,300 per allowance in 2025)
    allowance_value = 4300 * allowances

    taxable = max(0, annual_gross - std_deduction - allowance_value)

    # 2025 Federal Tax Brackets (Single)
    if filing_status == "Single":
        brackets = [
            (11925, 0.10),
            (48475 - 11925, 0.12),
            (103350 - 48475, 0.22),
            (197300 - 103350, 0.24),
            (250525 - 197300, 0.32),
            (626350 - 250525, 0.35),
            (float('inf'), 0.37),
        ]
    else:  # Married
        brackets = [
            (23850, 0.10),
            (96950 - 23850, 0.12),
            (206700 - 96950, 0.22),
            (394600 - 206700, 0.24),
            (501050 - 394600, 0.32),
            (751600 - 501050, 0.35),
            (float('inf'), 0.37),
        ]

    tax = 0
    remaining = taxable
    for bracket_size, rate in brackets:
        if remaining <= 0:
            break
        amount = min(remaining, bracket_size)
        tax += amount * rate
        remaining -= amount

    tax += additional
    return round(max(0, tax), 2)

def calculate_pay_withholdings(gross_pay: float, annual_gross: float, filing_status: str, allowances: int, additional_withholding: float, is_exempt_fit: bool, exempt_ss: bool, exempt_medicare: bool) -> dict:
    """Calculate all withholdings for a single pay period"""
    # Federal withholding (proportional to this payment)
    annual_fit = calculate_federal_withholding(annual_gross, filing_status, allowances, additional_withholding, is_exempt_fit)
    ratio = gross_pay / annual_gross if annual_gross > 0 else 0
    fit = round(annual_fit * ratio, 2)

    # FICA
    ss = 0 if exempt_ss else round(gross_pay * 0.062, 2)
    medicare = 0 if exempt_medicare else round(gross_pay * 0.0145, 2)

    total_withholding = fit + ss + medicare
    net_pay = round(gross_pay - total_withholding, 2)

    return {
        "federal_withholding": fit,
        "social_security": ss,
        "medicare": medicare,
        "total_withholding": round(total_withholding, 2),
        "net_pay": net_pay,
    }

# ============================================
# DEPENDENCY: Get DB and verify admin
# ============================================

async def get_db_and_admin(request: Request):
    from server import db, require_admin
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        auth_header = auth_header[7:]
    user = await require_admin(authorization=auth_header)
    return db, user

# ============================================
# BUSINESS SETUP
# ============================================

@router.get("/business")
async def get_business_setup(request: Request):
    db, user = await get_db_and_admin(request)
    business = await db.family_businesses.find_one({"admin_id": str(user.get('_id', user.get('id')))})
    if not business:
        return {
            "business_name": "", "tax_year": 2025, "owner_name": "",
            "business_address": "", "ein": "", "owner_ssn": "",
            "business_type": "Sole Proprietorship",
        }
    business['_id'] = str(business['_id'])
    return business

@router.post("/business")
async def save_business_setup(data: BusinessSetup, request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    existing = await db.family_businesses.find_one({"admin_id": admin_id})
    doc = {
        "admin_id": admin_id,
        "business_name": data.business_name,
        "tax_year": data.tax_year,
        "owner_name": data.owner_name,
        "business_address": data.business_address,
        "ein": data.ein,
        "owner_ssn": data.owner_ssn,
        "business_type": data.business_type,
        "updated_at": datetime.now(timezone.utc),
    }

    if existing:
        await db.family_businesses.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        doc["created_at"] = datetime.now(timezone.utc)
        await db.family_businesses.insert_one(doc)

    return {"success": True, "message": "Datos del negocio guardados"}

# ============================================
# EMPLOYEES CRUD
# ============================================

@router.get("/employees")
async def list_employees(request: Request, tax_year: Optional[int] = None, search: Optional[str] = None):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    query: dict = {"admin_id": admin_id, "deleted": {"$ne": True}}
    if tax_year:
        query["tax_year"] = tax_year

    employees = await db.family_employees.find(query).sort("full_name", 1).to_list(100)

    result = []
    for emp in employees:
        emp_id = str(emp["_id"])

        total_payments = 0
        payment_logs = await db.family_payment_logs.find({"employee_id": emp_id, "deleted": {"$ne": True}}).to_list(500)
        for p in payment_logs:
            total_payments += p.get("amount", 0)

        work_count = await db.family_work_logs.count_documents({"employee_id": emp_id, "deleted": {"$ne": True}})

        if search and search.lower() not in emp.get("full_name", "").lower():
            continue

        # Calculate age and FICA exemptions
        dob = emp.get("date_of_birth", "")
        tax_yr = emp.get("tax_year", 2025)
        age = calculate_age(dob, tax_yr)
        fica = get_fica_exemptions(emp.get("relationship", ""), age)

        # Calculate YTD withholdings
        ytd_fit = sum(p.get("federal_withholding", 0) for p in payment_logs)
        ytd_ss = sum(p.get("social_security", 0) for p in payment_logs)
        ytd_medicare = sum(p.get("medicare", 0) for p in payment_logs)

        result.append({
            "id": emp_id, "_id": emp_id,
            "full_name": emp.get("full_name", ""),
            "date_of_birth": dob,
            "address": emp.get("address", ""),
            "ssn_itin": emp.get("ssn_itin", ""),
            "relationship": emp.get("relationship", ""),
            "position": emp.get("position", ""),
            "annual_compensation": emp.get("annual_compensation", 0),
            "hourly_rate": emp.get("hourly_rate", 0),
            "pay_frequency": emp.get("pay_frequency", "Weekly"),
            "hire_date": emp.get("hire_date", ""),
            "duties": emp.get("duties", ""),
            "evidence_notes": emp.get("evidence_notes", ""),
            "filing_status": emp.get("filing_status", "Single"),
            "w4_allowances": emp.get("w4_allowances", 0),
            "additional_withholding": emp.get("additional_withholding", 0),
            "is_exempt_fit": emp.get("is_exempt_fit", False),
            "tax_year": tax_yr,
            "age": age,
            "fica_exemptions": fica,
            "total_payments": total_payments,
            "work_log_count": work_count,
            "ytd_federal_withholding": round(ytd_fit, 2),
            "ytd_social_security": round(ytd_ss, 2),
            "ytd_medicare": round(ytd_medicare, 2),
            "ytd_total_withholding": round(ytd_fit + ytd_ss + ytd_medicare, 2),
            "created_at": str(emp.get("created_at", "")),
            "updated_at": str(emp.get("updated_at", "")),
        })

    return {"employees": result, "count": len(result)}

@router.post("/employees")
async def create_employee(data: EmployeeCreate, request: Request, tax_year: int = 2025):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    now = datetime.now(timezone.utc)
    doc = {
        "admin_id": admin_id,
        "full_name": data.full_name.upper(),
        "date_of_birth": data.date_of_birth,
        "address": data.address,
        "ssn_itin": data.ssn_itin or "",
        "relationship": data.relationship,
        "position": data.position,
        "annual_compensation": data.annual_compensation,
        "hourly_rate": data.hourly_rate,
        "pay_frequency": data.pay_frequency,
        "hire_date": data.hire_date or "",
        "duties": data.duties,
        "evidence_notes": data.evidence_notes or "",
        "filing_status": data.filing_status,
        "w4_allowances": data.w4_allowances,
        "additional_withholding": data.additional_withholding,
        "is_exempt_fit": data.is_exempt_fit,
        "tax_year": tax_year,
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.family_employees.insert_one(doc)
    logger.info(f"Created family employee: {data.full_name} (tax year {tax_year})")
    return {"success": True, "id": str(result.inserted_id), "message": f"Empleado {data.full_name} creado"}

@router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    body = await request.json()

    update = {
        "full_name": body.get("full_name", "").upper(),
        "date_of_birth": body.get("date_of_birth"),
        "address": body.get("address"),
        "ssn_itin": body.get("ssn_itin", ""),
        "relationship": body.get("relationship"),
        "position": body.get("position"),
        "annual_compensation": body.get("annual_compensation", 0),
        "hourly_rate": body.get("hourly_rate", 0),
        "pay_frequency": body.get("pay_frequency", "Weekly"),
        "hire_date": body.get("hire_date", ""),
        "duties": body.get("duties", ""),
        "evidence_notes": body.get("evidence_notes", ""),
        "filing_status": body.get("filing_status", "Single"),
        "w4_allowances": body.get("w4_allowances", 0),
        "additional_withholding": body.get("additional_withholding", 0),
        "is_exempt_fit": body.get("is_exempt_fit", False),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.family_employees.update_one({"_id": ObjectId(employee_id)}, {"$set": update})
    return {"success": True, "message": "Empleado actualizado"}

@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    await db.family_employees.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    await db.family_work_logs.update_many(
        {"employee_id": employee_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    await db.family_payment_logs.update_many(
        {"employee_id": employee_id},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "message": "Empleado eliminado"}

# ============================================
# WITHHOLDING CALCULATOR
# ============================================

@router.post("/calculate-withholding")
async def calc_withholding(request: Request):
    """Calculate withholdings for a given gross pay amount"""
    db, user = await get_db_and_admin(request)
    body = await request.json()

    gross_pay = body.get("gross_pay", 0)
    employee_id = body.get("employee_id")

    if not employee_id:
        raise HTTPException(400, "employee_id required")

    emp = await db.family_employees.find_one({"_id": ObjectId(employee_id)})
    if not emp:
        raise HTTPException(404, "Employee not found")

    age = calculate_age(emp.get("date_of_birth", ""), emp.get("tax_year", 2025))
    fica = get_fica_exemptions(emp.get("relationship", ""), age)

    result = calculate_pay_withholdings(
        gross_pay=gross_pay,
        annual_gross=emp.get("annual_compensation", 0),
        filing_status=emp.get("filing_status", "Single"),
        allowances=emp.get("w4_allowances", 0),
        additional_withholding=emp.get("additional_withholding", 0),
        is_exempt_fit=emp.get("is_exempt_fit", False),
        exempt_ss=fica["exempt_social_security"],
        exempt_medicare=fica["exempt_medicare"],
    )
    result["fica_exemptions"] = fica
    return result

# ============================================
# WORK LOGS
# ============================================

@router.get("/work-logs/{employee_id}")
async def get_work_logs(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    logs = await db.family_work_logs.find(
        {"employee_id": employee_id, "deleted": {"$ne": True}}
    ).sort("date", -1).to_list(500)

    result = []
    total_hours = 0
    for log in logs:
        hours = log.get("hours", 0)
        total_hours += hours
        result.append({
            "id": str(log["_id"]),
            "date": log.get("date", ""),
            "hours": hours,
            "task_description": log.get("task_description", ""),
            "initials": log.get("initials", ""),
        })

    return {"work_logs": result, "count": len(result), "total_hours": total_hours}

@router.post("/work-logs/{employee_id}")
async def add_work_log(employee_id: str, data: WorkLogEntry, request: Request):
    db, user = await get_db_and_admin(request)
    doc = {
        "employee_id": employee_id,
        "date": data.date,
        "hours": data.hours,
        "task_description": data.task_description,
        "initials": data.initials,
        "deleted": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.family_work_logs.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}

@router.delete("/work-logs/{log_id}")
async def delete_work_log(log_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    await db.family_work_logs.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    return {"success": True}

# ============================================
# PAYMENT LOGS
# ============================================

@router.get("/payment-logs/{employee_id}")
async def get_payment_logs(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    logs = await db.family_payment_logs.find(
        {"employee_id": employee_id, "deleted": {"$ne": True}}
    ).sort("date", -1).to_list(500)

    result = []
    total_paid = 0
    for log in logs:
        amount = log.get("amount", 0)
        total_paid += amount
        result.append({
            "id": str(log["_id"]),
            "date": log.get("date", ""),
            "amount": amount,
            "payment_method": log.get("payment_method", "Cash"),
            "purpose": log.get("purpose", ""),
            "acknowledgment": log.get("acknowledgment", ""),
            "check_number": log.get("check_number", ""),
            "federal_withholding": log.get("federal_withholding", 0),
            "social_security": log.get("social_security", 0),
            "medicare": log.get("medicare", 0),
            "state_withholding": log.get("state_withholding", 0),
            "net_pay": log.get("net_pay", 0),
        })

    return {"payment_logs": result, "count": len(result), "total_paid": total_paid}

@router.post("/payment-logs/{employee_id}")
async def add_payment_log(employee_id: str, data: PaymentLogEntry, request: Request):
    db, user = await get_db_and_admin(request)
    doc = {
        "employee_id": employee_id,
        "date": data.date,
        "amount": data.amount,
        "payment_method": data.payment_method,
        "purpose": data.purpose,
        "acknowledgment": data.acknowledgment,
        "check_number": data.check_number,
        "federal_withholding": data.federal_withholding,
        "social_security": data.social_security,
        "medicare": data.medicare,
        "state_withholding": data.state_withholding,
        "net_pay": data.net_pay,
        "deleted": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.family_payment_logs.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}

@router.delete("/payment-logs/{log_id}")
async def delete_payment_log(log_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    await db.family_payment_logs.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    return {"success": True}

# ============================================
# SEED DATA
# ============================================

@router.post("/seed")
async def seed_family_data(request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    now = datetime.now(timezone.utc)

    existing = await db.family_employees.count_documents({"admin_id": admin_id, "deleted": {"$ne": True}})
    if existing > 0:
        return {"success": False, "message": f"Ya existen {existing} empleados. No se necesita seed."}

    await db.family_businesses.update_one(
        {"admin_id": admin_id},
        {"$set": {
            "admin_id": admin_id,
            "business_name": "Ross Tax Preparation",
            "tax_year": 2025,
            "owner_name": "Yoandy Ross",
            "business_address": "305 Bruce Ave, Dumas, TX 79029",
            "ein": "",
            "owner_ssn": "",
            "business_type": "Sole Proprietorship",
            "updated_at": now, "created_at": now,
        }},
        upsert=True
    )

    emp1 = await db.family_employees.insert_one({
        "admin_id": admin_id,
        "full_name": "YANDRY MIGUEL ROSS BALLESTERO",
        "date_of_birth": "2011-06-20",
        "address": "305 Bruce Ave, Dumas, TX 79029",
        "ssn_itin": "", "relationship": "Child", "position": "Office Assistant",
        "annual_compensation": 8000, "hourly_rate": 10,
        "pay_frequency": "Weekly", "hire_date": "2025-01-15",
        "duties": "Office cleaning, document organization, client file management, and assistance with WhatsApp/social media communication",
        "evidence_notes": "",
        "filing_status": "Single", "w4_allowances": 1,
        "additional_withholding": 0, "is_exempt_fit": True,
        "tax_year": 2025, "deleted": False, "created_at": now, "updated_at": now,
    })

    emp2 = await db.family_employees.insert_one({
        "admin_id": admin_id,
        "full_name": "YENDRI ROSS BALLESTERO",
        "date_of_birth": "2013-03-25",
        "address": "305 Bruce Ave, Dumas, TX 79029",
        "ssn_itin": "", "relationship": "Child", "position": "Office Assistant",
        "annual_compensation": 8000, "hourly_rate": 10,
        "pay_frequency": "Weekly", "hire_date": "2025-01-15",
        "duties": "Office cleaning, file organization, customer support via social media, and basic WhatsApp responses",
        "evidence_notes": "",
        "filing_status": "Single", "w4_allowances": 1,
        "additional_withholding": 0, "is_exempt_fit": True,
        "tax_year": 2025, "deleted": False, "created_at": now, "updated_at": now,
    })

    return {"success": True, "message": "Datos iniciales cargados: 2 empleados + negocio", "employee_ids": [str(emp1.inserted_id), str(emp2.inserted_id)]}

# ============================================
# DUPLICATE YEAR
# ============================================

@router.post("/duplicate-year")
async def duplicate_year(request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    body = await request.json()
    from_year = body.get("from_year", 2025)
    to_year = body.get("to_year", 2026)

    employees = await db.family_employees.find({
        "admin_id": admin_id, "tax_year": from_year, "deleted": {"$ne": True}
    }).to_list(100)

    if not employees:
        return {"success": False, "message": f"No hay empleados en el año {from_year}"}

    now = datetime.now(timezone.utc)
    count = 0
    for emp in employees:
        new_emp = {
            "admin_id": admin_id,
            "full_name": emp["full_name"],
            "date_of_birth": emp.get("date_of_birth"),
            "address": emp.get("address"),
            "ssn_itin": emp.get("ssn_itin", ""),
            "relationship": emp.get("relationship"),
            "position": emp.get("position"),
            "annual_compensation": emp.get("annual_compensation", 0),
            "hourly_rate": emp.get("hourly_rate", 0),
            "pay_frequency": emp.get("pay_frequency", "Weekly"),
            "hire_date": emp.get("hire_date", ""),
            "duties": emp.get("duties", ""),
            "evidence_notes": "",
            "filing_status": emp.get("filing_status", "Single"),
            "w4_allowances": emp.get("w4_allowances", 0),
            "additional_withholding": emp.get("additional_withholding", 0),
            "is_exempt_fit": emp.get("is_exempt_fit", False),
            "tax_year": to_year,
            "deleted": False, "created_at": now, "updated_at": now,
        }
        await db.family_employees.insert_one(new_emp)
        count += 1

    await db.family_businesses.update_one(
        {"admin_id": admin_id},
        {"$set": {"tax_year": to_year, "updated_at": now}}
    )

    return {"success": True, "message": f"Se duplicaron {count} empleados del año {from_year} al {to_year}"}


# ============================================
# IRS FORMS: W-2, 941, 940 DATA
# ============================================

@router.post("/irs-forms/w2-data")
async def get_w2_data(request: Request):
    """Generate W-2 data for all employees for a given tax year"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    body = await request.json()
    tax_year = body.get("tax_year", 2025)

    # Get business info
    business = await db.family_businesses.find_one({"admin_id": admin_id})
    if not business:
        raise HTTPException(400, "Business setup required before generating W-2")

    # Get employees for this tax year
    employees = await db.family_employees.find({
        "admin_id": admin_id, "tax_year": tax_year, "deleted": {"$ne": True}
    }).to_list(100)

    w2_forms = []
    for emp in employees:
        emp_id = str(emp["_id"])
        # Get all payment logs for this employee
        payment_logs = await db.family_payment_logs.find({
            "employee_id": emp_id, "deleted": {"$ne": True}
        }).to_list(500)

        total_wages = sum(p.get("amount", 0) for p in payment_logs)
        total_fit = sum(p.get("federal_withholding", 0) for p in payment_logs)
        total_ss_wages = 0
        total_ss_tax = sum(p.get("social_security", 0) for p in payment_logs)
        total_med_wages = 0
        total_med_tax = sum(p.get("medicare", 0) for p in payment_logs)

        # Determine FICA exemption
        age = calculate_age(emp.get("date_of_birth", ""), tax_year)
        fica = get_fica_exemptions(emp.get("relationship", ""), age)

        # If not exempt, SS/Medicare wages = total wages
        if not fica["exempt_social_security"]:
            total_ss_wages = total_wages
        if not fica["exempt_medicare"]:
            total_med_wages = total_wages

        w2_forms.append({
            "employee_id": emp_id,
            "tax_year": tax_year,
            # Employer (boxes a-f)
            "employer_ein": business.get("ein", ""),
            "employer_name": business.get("business_name", ""),
            "employer_address": business.get("business_address", ""),
            # Employee info
            "employee_ssn": emp.get("ssn_itin", ""),
            "employee_name": emp.get("full_name", ""),
            "employee_address": emp.get("address", ""),
            # W-2 Boxes
            "box1_wages": round(total_wages, 2),
            "box2_fit_withheld": round(total_fit, 2),
            "box3_ss_wages": round(total_ss_wages, 2),
            "box4_ss_withheld": round(total_ss_tax, 2),
            "box5_medicare_wages": round(total_med_wages, 2),
            "box6_medicare_withheld": round(total_med_tax, 2),
            "box7_ss_tips": 0,
            "box8_allocated_tips": 0,
            # FICA info
            "fica_exempt_ss": fica["exempt_social_security"],
            "fica_exempt_medicare": fica["exempt_medicare"],
            "fica_notes": fica["notes"],
            "age": age,
            "relationship": emp.get("relationship", ""),
        })

    return {
        "tax_year": tax_year,
        "employer": {
            "ein": business.get("ein", ""),
            "name": business.get("business_name", ""),
            "address": business.get("business_address", ""),
            "owner_name": business.get("owner_name", ""),
        },
        "w2_forms": w2_forms,
        "total_w2s": len(w2_forms),
    }


@router.post("/irs-forms/form941-data")
async def get_form941_data(request: Request):
    """Generate Form 941 quarterly data"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    body = await request.json()
    tax_year = body.get("tax_year", 2025)
    quarter = body.get("quarter", 1)  # 1-4

    # Quarter date ranges
    quarter_ranges = {
        1: (f"{tax_year}-01-01", f"{tax_year}-03-31"),
        2: (f"{tax_year}-04-01", f"{tax_year}-06-30"),
        3: (f"{tax_year}-07-01", f"{tax_year}-09-30"),
        4: (f"{tax_year}-10-01", f"{tax_year}-12-31"),
    }
    start_date, end_date = quarter_ranges.get(quarter, quarter_ranges[1])

    # Get business
    business = await db.family_businesses.find_one({"admin_id": admin_id})

    # Get employees
    employees = await db.family_employees.find({
        "admin_id": admin_id, "tax_year": tax_year, "deleted": {"$ne": True}
    }).to_list(100)

    total_wages = 0
    total_fit = 0
    total_ss_wages = 0
    total_ss_tax = 0
    total_med_wages = 0
    total_med_tax = 0
    employee_count = 0
    employee_details = []

    for emp in employees:
        emp_id = str(emp["_id"])
        age = calculate_age(emp.get("date_of_birth", ""), tax_year)
        fica = get_fica_exemptions(emp.get("relationship", ""), age)

        # Get payments in this quarter
        payments = await db.family_payment_logs.find({
            "employee_id": emp_id,
            "deleted": {"$ne": True},
            "date": {"$gte": start_date, "$lte": end_date}
        }).to_list(500)

        if not payments:
            continue

        emp_wages = sum(p.get("amount", 0) for p in payments)
        emp_fit = sum(p.get("federal_withholding", 0) for p in payments)
        emp_ss_tax = sum(p.get("social_security", 0) for p in payments)
        emp_med_tax = sum(p.get("medicare", 0) for p in payments)

        total_wages += emp_wages
        total_fit += emp_fit
        total_ss_tax += emp_ss_tax
        total_med_tax += emp_med_tax

        if not fica["exempt_social_security"]:
            total_ss_wages += emp_wages
        if not fica["exempt_medicare"]:
            total_med_wages += emp_wages

        employee_count += 1
        employee_details.append({
            "name": emp.get("full_name", ""),
            "wages": round(emp_wages, 2),
            "fit": round(emp_fit, 2),
            "ss_exempt": fica["exempt_social_security"],
            "medicare_exempt": fica["exempt_medicare"],
        })

    # Employer share of FICA
    employer_ss = total_ss_tax  # employer matches employee SS
    employer_med = total_med_tax  # employer matches employee Medicare
    total_tax = total_fit + total_ss_tax + employer_ss + total_med_tax + employer_med

    quarter_names = {1: "January-March", 2: "April-June", 3: "July-September", 4: "October-December"}
    due_dates = {1: f"April 30, {tax_year}", 2: f"July 31, {tax_year}", 3: f"October 31, {tax_year}", 4: f"January 31, {tax_year + 1}"}

    return {
        "form": "941",
        "tax_year": tax_year,
        "quarter": quarter,
        "quarter_name": quarter_names[quarter],
        "due_date": due_dates[quarter],
        "date_range": f"{start_date} to {end_date}",
        "employer": {
            "ein": business.get("ein", "") if business else "",
            "name": business.get("business_name", "") if business else "",
            "address": business.get("business_address", "") if business else "",
        },
        "line1_employee_count": employee_count,
        "line2_total_wages": round(total_wages, 2),
        "line3_fit_withheld": round(total_fit, 2),
        "line5a_ss_wages": round(total_ss_wages, 2),
        "line5a_ss_tax": round(total_ss_tax * 2, 2),  # employee + employer
        "line5c_med_wages": round(total_med_wages, 2),
        "line5c_med_tax": round(total_med_tax * 2, 2),  # employee + employer
        "line6_total_ss_med": round((total_ss_tax + total_med_tax) * 2, 2),
        "line10_total_taxes": round(total_tax, 2),
        "employee_details": employee_details,
    }


@router.post("/irs-forms/form940-data")
async def get_form940_data(request: Request):
    """Generate Form 940 annual FUTA data"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    body = await request.json()
    tax_year = body.get("tax_year", 2025)

    business = await db.family_businesses.find_one({"admin_id": admin_id})

    employees = await db.family_employees.find({
        "admin_id": admin_id, "tax_year": tax_year, "deleted": {"$ne": True}
    }).to_list(100)

    total_payments = 0
    exempt_payments = 0
    futa_taxable_wages = 0
    employee_details = []

    for emp in employees:
        emp_id = str(emp["_id"])
        age = calculate_age(emp.get("date_of_birth", ""), tax_year)
        fica = get_fica_exemptions(emp.get("relationship", ""), age)

        payments = await db.family_payment_logs.find({
            "employee_id": emp_id, "deleted": {"$ne": True}
        }).to_list(500)

        emp_total = sum(p.get("amount", 0) for p in payments)
        total_payments += emp_total

        is_futa_exempt = fica["exempt_futa"]
        if is_futa_exempt:
            exempt_payments += emp_total
        else:
            # FUTA applies to first $7,000 per employee
            futa_taxable_wages += min(emp_total, 7000)

        employee_details.append({
            "name": emp.get("full_name", ""),
            "total_paid": round(emp_total, 2),
            "futa_exempt": is_futa_exempt,
            "exempt_reason": "Child under 21" if emp.get("relationship") == "Child" and age < 21 else
                           "Spouse" if emp.get("relationship") == "Spouse" else
                           "Parent" if emp.get("relationship") == "Parent" else "N/A",
            "relationship": emp.get("relationship", ""),
            "age": age,
        })

    # FUTA rate: 6.0% - 5.4% state credit = 0.6% effective
    futa_tax_gross = round(futa_taxable_wages * 0.06, 2)
    state_credit = round(futa_taxable_wages * 0.054, 2)
    futa_tax_net = round(futa_taxable_wages * 0.006, 2)

    all_exempt = all(d["futa_exempt"] for d in employee_details) if employee_details else True

    return {
        "form": "940",
        "tax_year": tax_year,
        "employer": {
            "ein": business.get("ein", "") if business else "",
            "name": business.get("business_name", "") if business else "",
            "address": business.get("business_address", "") if business else "",
        },
        "line3_total_payments": round(total_payments, 2),
        "line4_exempt_payments": round(exempt_payments, 2),
        "line5_total_taxable": round(total_payments - exempt_payments, 2),
        "line7_futa_taxable_wages": round(futa_taxable_wages, 2),
        "futa_tax_gross": futa_tax_gross,
        "state_credit": state_credit,
        "futa_tax_net": futa_tax_net,
        "all_employees_exempt": all_exempt,
        "filing_required": not all_exempt,
        "employee_details": employee_details,
        "note": "All family employees are exempt from FUTA. Form 940 filing is NOT required." if all_exempt else "Form 940 must be filed by January 31.",
    }
