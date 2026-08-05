"""
Payroll Module Phase 2 - Full B2B Payroll Processing
Supports multiple business clients, generic employees, payroll runs, pay stubs, and IRS reporting.
"""
import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/payroll", tags=["Payroll"])

# ============================================
# MODELS
# ============================================

class PayrollBusinessCreate(BaseModel):
    business_name: str
    owner_name: str = ""
    business_address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    ein: str = ""
    business_type: str = "LLC"
    industry: str = ""
    phone: str = ""
    email: str = ""
    pay_frequency: str = "Bi-Weekly"  # Weekly, Bi-Weekly, Semi-Monthly, Monthly
    state_unemployment_rate: float = 0.027  # SUTA rate
    workers_comp_rate: float = 0.0
    notes: str = ""

class PayrollEmployeeCreate(BaseModel):
    business_id: str
    full_name: str
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: str = ""
    state: str = ""
    zip_code: str = ""
    ssn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: str = ""
    position: str = ""
    employee_type: str = "W-2"  # W-2, 1099, Family
    relationship: str = "None"  # None, Child, Spouse, Parent
    pay_type: str = "Hourly"  # Hourly, Salary
    hourly_rate: float = 0
    annual_salary: float = 0
    hire_date: Optional[str] = None
    termination_date: Optional[str] = None
    status: str = "Active"  # Active, Inactive, Terminated
    # W-4
    filing_status: str = "Single"
    w4_allowances: int = 0
    additional_withholding: float = 0
    is_exempt_fit: bool = False
    # Direct Deposit
    bank_name: str = ""
    routing_number: str = ""
    account_number: str = ""
    account_type: str = "Checking"

class PayrollRunCreate(BaseModel):
    business_id: str
    pay_period_start: str
    pay_period_end: str
    pay_date: str
    notes: str = ""

class PayrollEntryUpdate(BaseModel):
    employee_id: str
    regular_hours: float = 0
    overtime_hours: float = 0
    bonus: float = 0
    commission: float = 0
    reimbursement: float = 0
    deduction_other: float = 0
    deduction_other_label: str = ""
    notes: str = ""

# ============================================
# IRS TAX CALCULATIONS (2025)
# ============================================

FEDERAL_BRACKETS_2025_SINGLE = [
    (11925, 0.10),
    (48475 - 11925, 0.12),
    (103350 - 48475, 0.22),
    (197300 - 103350, 0.24),
    (250525 - 197300, 0.32),
    (626350 - 250525, 0.35),
    (float('inf'), 0.37),
]

FEDERAL_BRACKETS_2025_MARRIED = [
    (23850, 0.10),
    (96950 - 23850, 0.12),
    (206700 - 96950, 0.22),
    (394600 - 206700, 0.24),
    (501050 - 394600, 0.32),
    (751600 - 501050, 0.35),
    (float('inf'), 0.37),
]

SS_RATE = 0.062
SS_WAGE_BASE_2025 = 176100
MEDICARE_RATE = 0.0145
MEDICARE_ADDITIONAL_RATE = 0.009
MEDICARE_ADDITIONAL_THRESHOLD = 200000
FUTA_RATE = 0.006
FUTA_WAGE_BASE = 7000

def calculate_age(dob_str: str, as_of_year: int = None) -> int:
    if not dob_str:
        return 0
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        year = as_of_year or datetime.now().year
        ref_date = date(year, 12, 31)
        return max(0, ref_date.year - dob.year - ((ref_date.month, ref_date.day) < (dob.month, dob.day)))
    except:
        return 0

def get_fica_exemptions(relationship: str, age: int, employee_type: str) -> dict:
    exempt_ss = False
    exempt_medicare = False
    exempt_futa = False
    notes = []

    if employee_type == "1099":
        notes.append("1099 contractor: No employer FICA/FUTA obligations")
        return {"exempt_ss": True, "exempt_medicare": True, "exempt_futa": True, "notes": notes}

    if relationship == "Child":
        if age < 18:
            exempt_ss = True
            exempt_medicare = True
            notes.append("Child under 18: EXEMPT from SS & Medicare (IRC §3121(b)(3)(A))")
        if age < 21:
            exempt_futa = True
            notes.append("Child under 21: EXEMPT from FUTA (IRC §3306(c)(5))")
    elif relationship == "Spouse":
        exempt_futa = True
        notes.append("Spouse: EXEMPT from FUTA (IRC §3306(c)(5))")
    elif relationship == "Parent":
        exempt_futa = True
        notes.append("Parent: EXEMPT from FUTA (IRC §3306(c)(5))")

    return {"exempt_ss": exempt_ss, "exempt_medicare": exempt_medicare, "exempt_futa": exempt_futa, "notes": notes}

def calculate_federal_withholding(annual_gross: float, filing_status: str, allowances: int = 0, additional: float = 0, is_exempt: bool = False) -> float:
    if is_exempt or annual_gross <= 0:
        return 0
    std_deduction = 15000 if filing_status == "Single" else 30000
    allowance_value = 4300 * allowances
    taxable = max(0, annual_gross - std_deduction - allowance_value)
    brackets = FEDERAL_BRACKETS_2025_SINGLE if filing_status == "Single" else FEDERAL_BRACKETS_2025_MARRIED
    tax = 0
    remaining = taxable
    for bracket_size, rate in brackets:
        if remaining <= 0:
            break
        amount = min(remaining, bracket_size)
        tax += amount * rate
        remaining -= amount
    return round(max(0, tax + additional), 2)

def calculate_period_withholdings(gross_pay: float, ytd_gross: float, annual_estimated: float,
                                   filing_status: str, allowances: int, additional_withholding: float,
                                   is_exempt_fit: bool, exempt_ss: bool, exempt_medicare: bool,
                                   ytd_ss_wages: float = 0) -> dict:
    # Federal Income Tax (proportional)
    annual_fit = calculate_federal_withholding(annual_estimated, filing_status, allowances, additional_withholding * 26, is_exempt_fit)
    ratio = gross_pay / annual_estimated if annual_estimated > 0 else 0
    fit = round(annual_fit * ratio + additional_withholding, 2)

    # Social Security (check wage base)
    ss = 0
    if not exempt_ss:
        ss_taxable = min(gross_pay, max(0, SS_WAGE_BASE_2025 - ytd_ss_wages))
        ss = round(ss_taxable * SS_RATE, 2)

    # Medicare
    medicare = 0
    if not exempt_medicare:
        medicare = round(gross_pay * MEDICARE_RATE, 2)
        # Additional Medicare tax
        if (ytd_gross + gross_pay) > MEDICARE_ADDITIONAL_THRESHOLD:
            additional_wages = max(0, (ytd_gross + gross_pay) - MEDICARE_ADDITIONAL_THRESHOLD)
            prior_additional = max(0, ytd_gross - MEDICARE_ADDITIONAL_THRESHOLD)
            medicare += round((additional_wages - max(0, prior_additional)) * MEDICARE_ADDITIONAL_RATE, 2)

    total_withholding = round(fit + ss + medicare, 2)
    net_pay = round(gross_pay - total_withholding, 2)

    # Employer taxes
    employer_ss = ss  # employer matches
    employer_medicare = round(gross_pay * MEDICARE_RATE, 2) if not exempt_medicare else 0

    return {
        "federal_withholding": fit,
        "social_security_employee": ss,
        "social_security_employer": employer_ss,
        "medicare_employee": medicare,
        "medicare_employer": employer_medicare,
        "total_employee_tax": total_withholding,
        "total_employer_tax": round(employer_ss + employer_medicare, 2),
        "net_pay": net_pay,
    }

# ============================================
# DEPENDENCY
# ============================================

async def get_db_and_admin(request: Request):
    from server import db, require_admin
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        auth_header = auth_header[7:]
    user = await require_admin(authorization=auth_header)
    return db, user

# ============================================
# DASHBOARD
# ============================================

@router.get("/dashboard")
async def payroll_dashboard(request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    businesses = await db.payroll_businesses.count_documents({"admin_id": admin_id, "deleted": {"$ne": True}})
    employees = await db.payroll_employees.count_documents({"admin_id": admin_id, "status": "Active", "deleted": {"$ne": True}})
    
    # Recent payroll runs
    recent_runs = await db.payroll_runs.find(
        {"admin_id": admin_id, "deleted": {"$ne": True}}
    ).sort("created_at", -1).to_list(5)

    runs_list = []
    for run in recent_runs:
        biz = await db.payroll_businesses.find_one({"_id": ObjectId(run["business_id"])})
        runs_list.append({
            "id": str(run["_id"]),
            "business_name": biz.get("business_name", "Unknown") if biz else "Unknown",
            "pay_period": f"{run.get('pay_period_start', '')} - {run.get('pay_period_end', '')}",
            "pay_date": run.get("pay_date", ""),
            "status": run.get("status", "draft"),
            "total_gross": run.get("total_gross", 0),
            "total_net": run.get("total_net", 0),
            "employee_count": run.get("employee_count", 0),
            "created_at": str(run.get("created_at", "")),
        })

    # YTD totals across all businesses
    pipeline = [
        {"$match": {"admin_id": admin_id, "status": "processed", "deleted": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "total_gross": {"$sum": "$total_gross"},
            "total_net": {"$sum": "$total_net"},
            "total_taxes": {"$sum": "$total_taxes"},
            "total_employer_taxes": {"$sum": "$total_employer_taxes"},
            "run_count": {"$sum": 1},
        }}
    ]
    ytd_agg = await db.payroll_runs.aggregate(pipeline).to_list(1)
    ytd = ytd_agg[0] if ytd_agg else {"total_gross": 0, "total_net": 0, "total_taxes": 0, "total_employer_taxes": 0, "run_count": 0}

    return {
        "businesses_count": businesses,
        "active_employees": employees,
        "recent_runs": runs_list,
        "ytd_summary": {
            "total_gross": round(ytd.get("total_gross", 0), 2),
            "total_net": round(ytd.get("total_net", 0), 2),
            "total_employee_taxes": round(ytd.get("total_taxes", 0), 2),
            "total_employer_taxes": round(ytd.get("total_employer_taxes", 0), 2),
            "payroll_runs": ytd.get("run_count", 0),
        }
    }

# ============================================
# BUSINESSES CRUD
# ============================================

@router.get("/businesses")
async def list_businesses(request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    businesses = await db.payroll_businesses.find({"admin_id": admin_id, "deleted": {"$ne": True}}).sort("business_name", 1).to_list(100)

    result = []
    for biz in businesses:
        emp_count = await db.payroll_employees.count_documents({
            "business_id": str(biz["_id"]), "status": "Active", "deleted": {"$ne": True}
        })
        result.append({
            "id": str(biz["_id"]),
            "business_name": biz.get("business_name", ""),
            "owner_name": biz.get("owner_name", ""),
            "ein": biz.get("ein", ""),
            "business_type": biz.get("business_type", ""),
            "industry": biz.get("industry", ""),
            "phone": biz.get("phone", ""),
            "email": biz.get("email", ""),
            "business_address": biz.get("business_address", ""),
            "city": biz.get("city", ""),
            "state": biz.get("state", ""),
            "zip_code": biz.get("zip_code", ""),
            "pay_frequency": biz.get("pay_frequency", "Bi-Weekly"),
            "state_unemployment_rate": biz.get("state_unemployment_rate", 0.027),
            "workers_comp_rate": biz.get("workers_comp_rate", 0),
            "notes": biz.get("notes", ""),
            "employee_count": emp_count,
            "created_at": str(biz.get("created_at", "")),
        })
    return {"businesses": result, "count": len(result)}

@router.post("/businesses")
async def create_business(data: PayrollBusinessCreate, request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    now = datetime.now(timezone.utc)
    doc = {
        "admin_id": admin_id,
        "business_name": data.business_name,
        "owner_name": data.owner_name,
        "business_address": data.business_address,
        "city": data.city,
        "state": data.state,
        "zip_code": data.zip_code,
        "ein": data.ein,
        "business_type": data.business_type,
        "industry": data.industry,
        "phone": data.phone,
        "email": data.email,
        "pay_frequency": data.pay_frequency,
        "state_unemployment_rate": data.state_unemployment_rate,
        "workers_comp_rate": data.workers_comp_rate,
        "notes": data.notes,
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.payroll_businesses.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id), "message": f"Negocio '{data.business_name}' creado"}

@router.put("/businesses/{business_id}")
async def update_business(business_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    body = await request.json()
    update = {k: body[k] for k in body if k not in ('id', '_id', 'admin_id', 'created_at')}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.payroll_businesses.update_one({"_id": ObjectId(business_id)}, {"$set": update})
    return {"success": True, "message": "Negocio actualizado"}

@router.delete("/businesses/{business_id}")
async def delete_business(business_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    now = datetime.now(timezone.utc)
    await db.payroll_businesses.update_one({"_id": ObjectId(business_id)}, {"$set": {"deleted": True, "deleted_at": now}})
    await db.payroll_employees.update_many({"business_id": business_id}, {"$set": {"deleted": True, "deleted_at": now}})
    return {"success": True, "message": "Negocio eliminado"}

# ============================================
# EMPLOYEES CRUD
# ============================================

@router.get("/employees")
async def list_employees(request: Request, business_id: Optional[str] = None, status: Optional[str] = "Active"):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    query = {"admin_id": admin_id, "deleted": {"$ne": True}}
    if business_id:
        query["business_id"] = business_id
    if status:
        query["status"] = status

    employees = await db.payroll_employees.find(query).sort("full_name", 1).to_list(500)
    result = []
    for emp in employees:
        emp_id = str(emp["_id"])
        # Get YTD data from stubs
        ytd_pipeline = [
            {"$match": {"employee_id": emp_id, "deleted": {"$ne": True}}},
            {"$group": {
                "_id": None,
                "ytd_gross": {"$sum": "$gross_pay"},
                "ytd_net": {"$sum": "$net_pay"},
                "ytd_fit": {"$sum": "$federal_withholding"},
                "ytd_ss": {"$sum": "$social_security_employee"},
                "ytd_medicare": {"$sum": "$medicare_employee"},
                "pay_count": {"$sum": 1}
            }}
        ]
        ytd_agg = await db.payroll_stubs.aggregate(ytd_pipeline).to_list(1)
        ytd = ytd_agg[0] if ytd_agg else {}

        biz = await db.payroll_businesses.find_one({"_id": ObjectId(emp["business_id"])}) if emp.get("business_id") else None

        age = calculate_age(emp.get("date_of_birth", ""))
        fica = get_fica_exemptions(emp.get("relationship", "None"), age, emp.get("employee_type", "W-2"))

        result.append({
            "id": emp_id,
            "business_id": emp.get("business_id", ""),
            "business_name": biz.get("business_name", "") if biz else "",
            "full_name": emp.get("full_name", ""),
            "date_of_birth": emp.get("date_of_birth", ""),
            "ssn": emp.get("ssn", ""),
            "email": emp.get("email", ""),
            "phone": emp.get("phone", ""),
            "address": emp.get("address", ""),
            "city": emp.get("city", ""),
            "state": emp.get("state", ""),
            "zip_code": emp.get("zip_code", ""),
            "department": emp.get("department", ""),
            "position": emp.get("position", ""),
            "employee_type": emp.get("employee_type", "W-2"),
            "relationship": emp.get("relationship", "None"),
            "pay_type": emp.get("pay_type", "Hourly"),
            "hourly_rate": emp.get("hourly_rate", 0),
            "annual_salary": emp.get("annual_salary", 0),
            "hire_date": emp.get("hire_date", ""),
            "termination_date": emp.get("termination_date", ""),
            "status": emp.get("status", "Active"),
            "filing_status": emp.get("filing_status", "Single"),
            "w4_allowances": emp.get("w4_allowances", 0),
            "additional_withholding": emp.get("additional_withholding", 0),
            "is_exempt_fit": emp.get("is_exempt_fit", False),
            "bank_name": emp.get("bank_name", ""),
            "routing_number": emp.get("routing_number", ""),
            "account_number": emp.get("account_number", ""),
            "account_type": emp.get("account_type", "Checking"),
            "age": age,
            "fica_exemptions": fica,
            "ytd_gross": round(ytd.get("ytd_gross", 0), 2),
            "ytd_net": round(ytd.get("ytd_net", 0), 2),
            "ytd_fit": round(ytd.get("ytd_fit", 0), 2),
            "ytd_ss": round(ytd.get("ytd_ss", 0), 2),
            "ytd_medicare": round(ytd.get("ytd_medicare", 0), 2),
            "pay_count": ytd.get("pay_count", 0),
            "created_at": str(emp.get("created_at", "")),
        })
    return {"employees": result, "count": len(result)}

@router.post("/employees")
async def create_employee(data: PayrollEmployeeCreate, request: Request):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    now = datetime.now(timezone.utc)
    doc = {
        "admin_id": admin_id,
        "business_id": data.business_id,
        "full_name": data.full_name.upper(),
        "date_of_birth": data.date_of_birth,
        "address": data.address,
        "city": data.city,
        "state": data.state,
        "zip_code": data.zip_code,
        "ssn": data.ssn or "",
        "email": data.email or "",
        "phone": data.phone or "",
        "department": data.department,
        "position": data.position,
        "employee_type": data.employee_type,
        "relationship": data.relationship,
        "pay_type": data.pay_type,
        "hourly_rate": data.hourly_rate,
        "annual_salary": data.annual_salary,
        "hire_date": data.hire_date or "",
        "termination_date": data.termination_date,
        "status": data.status,
        "filing_status": data.filing_status,
        "w4_allowances": data.w4_allowances,
        "additional_withholding": data.additional_withholding,
        "is_exempt_fit": data.is_exempt_fit,
        "bank_name": data.bank_name,
        "routing_number": data.routing_number,
        "account_number": data.account_number,
        "account_type": data.account_type,
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.payroll_employees.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id), "message": f"Empleado '{data.full_name}' creado"}

@router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    body = await request.json()
    update = {k: body[k] for k in body if k not in ('id', '_id', 'admin_id', 'created_at')}
    update["updated_at"] = datetime.now(timezone.utc)
    if "full_name" in update and isinstance(update["full_name"], str):
        update["full_name"] = update["full_name"].upper()
    await db.payroll_employees.update_one({"_id": ObjectId(employee_id)}, {"$set": update})
    return {"success": True, "message": "Empleado actualizado"}

@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    await db.payroll_employees.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": {"deleted": True, "status": "Terminated", "deleted_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "message": "Empleado eliminado"}

# ============================================
# PAYROLL RUNS
# ============================================

@router.get("/runs")
async def list_runs(request: Request, business_id: Optional[str] = None, limit: int = 20):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    query = {"admin_id": admin_id, "deleted": {"$ne": True}}
    if business_id:
        query["business_id"] = business_id

    runs = await db.payroll_runs.find(query).sort("created_at", -1).to_list(limit)
    result = []
    for run in runs:
        biz = await db.payroll_businesses.find_one({"_id": ObjectId(run["business_id"])})
        result.append({
            "id": str(run["_id"]),
            "business_id": run.get("business_id", ""),
            "business_name": biz.get("business_name", "") if biz else "",
            "pay_period_start": run.get("pay_period_start", ""),
            "pay_period_end": run.get("pay_period_end", ""),
            "pay_date": run.get("pay_date", ""),
            "status": run.get("status", "draft"),
            "employee_count": run.get("employee_count", 0),
            "total_gross": round(run.get("total_gross", 0), 2),
            "total_net": round(run.get("total_net", 0), 2),
            "total_taxes": round(run.get("total_taxes", 0), 2),
            "total_employer_taxes": round(run.get("total_employer_taxes", 0), 2),
            "notes": run.get("notes", ""),
            "created_at": str(run.get("created_at", "")),
        })
    return {"runs": result, "count": len(result)}

@router.post("/runs")
async def create_run(data: PayrollRunCreate, request: Request):
    """Create a new payroll run (draft) and auto-populate entries for all active employees"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    now = datetime.now(timezone.utc)

    # Verify business exists
    biz = await db.payroll_businesses.find_one({"_id": ObjectId(data.business_id), "admin_id": admin_id})
    if not biz:
        raise HTTPException(404, "Negocio no encontrado")

    # Get active employees
    employees = await db.payroll_employees.find({
        "business_id": data.business_id, "status": "Active", "deleted": {"$ne": True}
    }).to_list(500)

    if not employees:
        raise HTTPException(400, "No hay empleados activos en este negocio")

    # Create run
    run_doc = {
        "admin_id": admin_id,
        "business_id": data.business_id,
        "pay_period_start": data.pay_period_start,
        "pay_period_end": data.pay_period_end,
        "pay_date": data.pay_date,
        "status": "draft",
        "employee_count": len(employees),
        "total_gross": 0,
        "total_net": 0,
        "total_taxes": 0,
        "total_employer_taxes": 0,
        "notes": data.notes,
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    run_result = await db.payroll_runs.insert_one(run_doc)
    run_id = str(run_result.inserted_id)

    # Create draft entries for each employee
    entries = []
    for emp in employees:
        emp_id = str(emp["_id"])
        # Calculate default hours/amounts based on pay type and frequency
        default_hours = 80 if biz.get("pay_frequency") == "Bi-Weekly" else 40 if biz.get("pay_frequency") == "Weekly" else 86.67

        entry = {
            "run_id": run_id,
            "employee_id": emp_id,
            "employee_name": emp.get("full_name", ""),
            "pay_type": emp.get("pay_type", "Hourly"),
            "hourly_rate": emp.get("hourly_rate", 0),
            "annual_salary": emp.get("annual_salary", 0),
            "regular_hours": default_hours if emp.get("pay_type") == "Hourly" else 0,
            "overtime_hours": 0,
            "regular_pay": 0,
            "overtime_pay": 0,
            "bonus": 0,
            "commission": 0,
            "reimbursement": 0,
            "gross_pay": 0,
            "federal_withholding": 0,
            "social_security_employee": 0,
            "social_security_employer": 0,
            "medicare_employee": 0,
            "medicare_employer": 0,
            "state_withholding": 0,
            "total_deductions": 0,
            "deduction_other": 0,
            "deduction_other_label": "",
            "net_pay": 0,
            "notes": "",
            "deleted": False,
            "created_at": now,
        }
        entries.append(entry)

    if entries:
        await db.payroll_entries.insert_many(entries)

    return {"success": True, "id": run_id, "employee_count": len(entries), "message": f"Nómina creada con {len(entries)} empleados"}

@router.get("/runs/{run_id}")
async def get_run_detail(run_id: str, request: Request):
    """Get full details of a payroll run including all entries"""
    db, user = await get_db_and_admin(request)
    
    run = await db.payroll_runs.find_one({"_id": ObjectId(run_id)})
    if not run:
        raise HTTPException(404, "Nómina no encontrada")

    biz = await db.payroll_businesses.find_one({"_id": ObjectId(run["business_id"])})

    entries = await db.payroll_entries.find({"run_id": run_id, "deleted": {"$ne": True}}).to_list(500)
    
    entries_list = []
    for entry in entries:
        emp = await db.payroll_employees.find_one({"_id": ObjectId(entry["employee_id"])})
        entries_list.append({
            "id": str(entry["_id"]),
            "employee_id": entry.get("employee_id", ""),
            "employee_name": entry.get("employee_name", ""),
            "pay_type": entry.get("pay_type", ""),
            "hourly_rate": entry.get("hourly_rate", 0),
            "annual_salary": entry.get("annual_salary", 0),
            "regular_hours": entry.get("regular_hours", 0),
            "overtime_hours": entry.get("overtime_hours", 0),
            "regular_pay": entry.get("regular_pay", 0),
            "overtime_pay": entry.get("overtime_pay", 0),
            "bonus": entry.get("bonus", 0),
            "commission": entry.get("commission", 0),
            "reimbursement": entry.get("reimbursement", 0),
            "gross_pay": entry.get("gross_pay", 0),
            "federal_withholding": entry.get("federal_withholding", 0),
            "social_security_employee": entry.get("social_security_employee", 0),
            "social_security_employer": entry.get("social_security_employer", 0),
            "medicare_employee": entry.get("medicare_employee", 0),
            "medicare_employer": entry.get("medicare_employer", 0),
            "state_withholding": entry.get("state_withholding", 0),
            "total_deductions": entry.get("total_deductions", 0),
            "deduction_other": entry.get("deduction_other", 0),
            "deduction_other_label": entry.get("deduction_other_label", ""),
            "net_pay": entry.get("net_pay", 0),
            "notes": entry.get("notes", ""),
            "department": emp.get("department", "") if emp else "",
            "position": emp.get("position", "") if emp else "",
            "employee_type": emp.get("employee_type", "W-2") if emp else "W-2",
        })

    return {
        "id": str(run["_id"]),
        "business_id": run.get("business_id", ""),
        "business_name": biz.get("business_name", "") if biz else "",
        "business_ein": biz.get("ein", "") if biz else "",
        "pay_period_start": run.get("pay_period_start", ""),
        "pay_period_end": run.get("pay_period_end", ""),
        "pay_date": run.get("pay_date", ""),
        "status": run.get("status", "draft"),
        "employee_count": run.get("employee_count", 0),
        "total_gross": round(run.get("total_gross", 0), 2),
        "total_net": round(run.get("total_net", 0), 2),
        "total_taxes": round(run.get("total_taxes", 0), 2),
        "total_employer_taxes": round(run.get("total_employer_taxes", 0), 2),
        "notes": run.get("notes", ""),
        "entries": entries_list,
        "created_at": str(run.get("created_at", "")),
    }

@router.put("/runs/{run_id}/entries")
async def update_run_entries(run_id: str, request: Request):
    """Update individual employee entries in a draft payroll run"""
    db, user = await get_db_and_admin(request)
    body = await request.json()
    entries_updates = body.get("entries", [])

    run = await db.payroll_runs.find_one({"_id": ObjectId(run_id)})
    if not run:
        raise HTTPException(404, "Nómina no encontrada")
    if run.get("status") != "draft":
        raise HTTPException(400, "Solo se pueden editar nóminas en borrador")

    for entry_data in entries_updates:
        entry_id = entry_data.get("id")
        if not entry_id:
            continue
        update = {k: entry_data[k] for k in entry_data if k not in ('id', '_id')}
        await db.payroll_entries.update_one({"_id": ObjectId(entry_id)}, {"$set": update})

    return {"success": True, "message": f"Actualizado {len(entries_updates)} entradas"}

@router.post("/runs/{run_id}/process")
async def process_payroll_run(run_id: str, request: Request):
    """Process/finalize a payroll run - calculate all withholdings and generate pay stubs"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    now = datetime.now(timezone.utc)

    run = await db.payroll_runs.find_one({"_id": ObjectId(run_id)})
    if not run:
        raise HTTPException(404, "Nómina no encontrada")
    if run.get("status") == "processed":
        raise HTTPException(400, "Esta nómina ya fue procesada")

    biz = await db.payroll_businesses.find_one({"_id": ObjectId(run["business_id"])})
    entries = await db.payroll_entries.find({"run_id": run_id, "deleted": {"$ne": True}}).to_list(500)

    total_gross = 0
    total_net = 0
    total_taxes = 0
    total_employer_taxes = 0
    stubs_to_insert = []

    for entry in entries:
        emp_id = entry["employee_id"]
        emp = await db.payroll_employees.find_one({"_id": ObjectId(emp_id)})
        if not emp:
            continue

        # Calculate gross pay
        regular_hours = entry.get("regular_hours", 0)
        overtime_hours = entry.get("overtime_hours", 0)
        hourly_rate = entry.get("hourly_rate", 0) or emp.get("hourly_rate", 0)
        annual_salary = entry.get("annual_salary", 0) or emp.get("annual_salary", 0)

        if emp.get("pay_type") == "Hourly":
            regular_pay = round(regular_hours * hourly_rate, 2)
            overtime_pay = round(overtime_hours * hourly_rate * 1.5, 2)
        else:
            # Salary: calculate period amount
            freq = biz.get("pay_frequency", "Bi-Weekly") if biz else "Bi-Weekly"
            periods_per_year = {"Weekly": 52, "Bi-Weekly": 26, "Semi-Monthly": 24, "Monthly": 12}.get(freq, 26)
            regular_pay = round(annual_salary / periods_per_year, 2)
            overtime_pay = 0

        bonus = entry.get("bonus", 0)
        commission = entry.get("commission", 0)
        reimbursement = entry.get("reimbursement", 0)
        gross_pay = round(regular_pay + overtime_pay + bonus + commission, 2)

        # Get YTD data for this employee
        ytd_pipeline = [
            {"$match": {"employee_id": emp_id, "deleted": {"$ne": True}}},
            {"$group": {
                "_id": None,
                "ytd_gross": {"$sum": "$gross_pay"},
                "ytd_ss_wages": {"$sum": "$ss_wages"},
            }}
        ]
        ytd_agg = await db.payroll_stubs.aggregate(ytd_pipeline).to_list(1)
        ytd_data = ytd_agg[0] if ytd_agg else {"ytd_gross": 0, "ytd_ss_wages": 0}

        # FICA exemptions
        age = calculate_age(emp.get("date_of_birth", ""))
        fica = get_fica_exemptions(emp.get("relationship", "None"), age, emp.get("employee_type", "W-2"))

        # Estimate annual gross for FIT calculation
        freq = biz.get("pay_frequency", "Bi-Weekly") if biz else "Bi-Weekly"
        periods = {"Weekly": 52, "Bi-Weekly": 26, "Semi-Monthly": 24, "Monthly": 12}.get(freq, 26)
        annual_estimated = gross_pay * periods if emp.get("pay_type") == "Hourly" else annual_salary

        # Calculate withholdings
        if emp.get("employee_type") == "1099":
            withholdings = {
                "federal_withholding": 0, "social_security_employee": 0,
                "social_security_employer": 0, "medicare_employee": 0,
                "medicare_employer": 0, "total_employee_tax": 0,
                "total_employer_tax": 0, "net_pay": gross_pay,
            }
        else:
            withholdings = calculate_period_withholdings(
                gross_pay=gross_pay,
                ytd_gross=ytd_data.get("ytd_gross", 0),
                annual_estimated=annual_estimated,
                filing_status=emp.get("filing_status", "Single"),
                allowances=emp.get("w4_allowances", 0),
                additional_withholding=emp.get("additional_withholding", 0),
                is_exempt_fit=emp.get("is_exempt_fit", False),
                exempt_ss=fica["exempt_ss"],
                exempt_medicare=fica["exempt_medicare"],
                ytd_ss_wages=ytd_data.get("ytd_ss_wages", 0),
            )

        deduction_other = entry.get("deduction_other", 0)
        total_deductions = round(withholdings["total_employee_tax"] + deduction_other, 2)
        net_pay = round(gross_pay - total_deductions + reimbursement, 2)

        # Update entry with calculated values
        entry_update = {
            "regular_pay": regular_pay,
            "overtime_pay": overtime_pay,
            "gross_pay": gross_pay,
            "federal_withholding": withholdings["federal_withholding"],
            "social_security_employee": withholdings["social_security_employee"],
            "social_security_employer": withholdings["social_security_employer"],
            "medicare_employee": withholdings["medicare_employee"],
            "medicare_employer": withholdings["medicare_employer"],
            "total_deductions": total_deductions,
            "net_pay": net_pay,
        }
        await db.payroll_entries.update_one({"_id": entry["_id"]}, {"$set": entry_update})

        # Create pay stub
        ss_wages = 0 if fica["exempt_ss"] else gross_pay
        stub = {
            "admin_id": admin_id,
            "run_id": run_id,
            "business_id": run["business_id"],
            "employee_id": emp_id,
            "employee_name": emp.get("full_name", ""),
            "employee_ssn": emp.get("ssn", ""),
            "employee_address": f"{emp.get('address', '')} {emp.get('city', '')} {emp.get('state', '')} {emp.get('zip_code', '')}".strip(),
            "department": emp.get("department", ""),
            "position": emp.get("position", ""),
            "pay_period_start": run.get("pay_period_start", ""),
            "pay_period_end": run.get("pay_period_end", ""),
            "pay_date": run.get("pay_date", ""),
            "pay_type": emp.get("pay_type", "Hourly"),
            "hourly_rate": hourly_rate,
            "regular_hours": regular_hours,
            "overtime_hours": overtime_hours,
            "regular_pay": regular_pay,
            "overtime_pay": overtime_pay,
            "bonus": bonus,
            "commission": commission,
            "reimbursement": reimbursement,
            "gross_pay": gross_pay,
            "federal_withholding": withholdings["federal_withholding"],
            "social_security_employee": withholdings["social_security_employee"],
            "social_security_employer": withholdings["social_security_employer"],
            "medicare_employee": withholdings["medicare_employee"],
            "medicare_employer": withholdings["medicare_employer"],
            "state_withholding": 0,
            "deduction_other": deduction_other,
            "deduction_other_label": entry.get("deduction_other_label", ""),
            "total_deductions": total_deductions,
            "net_pay": net_pay,
            "ss_wages": ss_wages,
            "ytd_gross": round(ytd_data.get("ytd_gross", 0) + gross_pay, 2),
            "ytd_fit": 0,  # Will be calculated separately if needed
            "ytd_ss": 0,
            "ytd_medicare": 0,
            "deleted": False,
            "created_at": now,
        }
        stubs_to_insert.append(stub)

        total_gross += gross_pay
        total_net += net_pay
        total_taxes += withholdings["total_employee_tax"]
        total_employer_taxes += withholdings["total_employer_tax"]

    # Insert all pay stubs
    if stubs_to_insert:
        await db.payroll_stubs.insert_many(stubs_to_insert)

    # Update run totals and status
    await db.payroll_runs.update_one({"_id": ObjectId(run_id)}, {"$set": {
        "status": "processed",
        "total_gross": round(total_gross, 2),
        "total_net": round(total_net, 2),
        "total_taxes": round(total_taxes, 2),
        "total_employer_taxes": round(total_employer_taxes, 2),
        "employee_count": len(stubs_to_insert),
        "processed_at": now,
        "updated_at": now,
    }})

    logger.info(f"Payroll run {run_id} processed: {len(stubs_to_insert)} employees, ${total_gross:.2f} gross")

    return {
        "success": True,
        "message": f"Nómina procesada: {len(stubs_to_insert)} empleados",
        "summary": {
            "employees": len(stubs_to_insert),
            "total_gross": round(total_gross, 2),
            "total_net": round(total_net, 2),
            "total_employee_taxes": round(total_taxes, 2),
            "total_employer_taxes": round(total_employer_taxes, 2),
        }
    }

@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    now = datetime.now(timezone.utc)
    await db.payroll_runs.update_one({"_id": ObjectId(run_id)}, {"$set": {"deleted": True, "deleted_at": now}})
    await db.payroll_entries.update_many({"run_id": run_id}, {"$set": {"deleted": True, "deleted_at": now}})
    await db.payroll_stubs.update_many({"run_id": run_id}, {"$set": {"deleted": True, "deleted_at": now}})
    return {"success": True, "message": "Nómina eliminada"}

# ============================================
# PAY STUBS
# ============================================

@router.get("/stubs")
async def list_stubs(request: Request, business_id: Optional[str] = None, employee_id: Optional[str] = None, run_id: Optional[str] = None, limit: int = 50):
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))
    query = {"admin_id": admin_id, "deleted": {"$ne": True}}
    if business_id:
        query["business_id"] = business_id
    if employee_id:
        query["employee_id"] = employee_id
    if run_id:
        query["run_id"] = run_id

    stubs = await db.payroll_stubs.find(query).sort("pay_date", -1).to_list(limit)
    result = []
    for stub in stubs:
        result.append({
            "id": str(stub["_id"]),
            "run_id": stub.get("run_id", ""),
            "business_id": stub.get("business_id", ""),
            "employee_id": stub.get("employee_id", ""),
            "employee_name": stub.get("employee_name", ""),
            "pay_period_start": stub.get("pay_period_start", ""),
            "pay_period_end": stub.get("pay_period_end", ""),
            "pay_date": stub.get("pay_date", ""),
            "pay_type": stub.get("pay_type", ""),
            "hourly_rate": stub.get("hourly_rate", 0),
            "regular_hours": stub.get("regular_hours", 0),
            "overtime_hours": stub.get("overtime_hours", 0),
            "regular_pay": stub.get("regular_pay", 0),
            "overtime_pay": stub.get("overtime_pay", 0),
            "bonus": stub.get("bonus", 0),
            "commission": stub.get("commission", 0),
            "reimbursement": stub.get("reimbursement", 0),
            "gross_pay": stub.get("gross_pay", 0),
            "federal_withholding": stub.get("federal_withholding", 0),
            "social_security_employee": stub.get("social_security_employee", 0),
            "medicare_employee": stub.get("medicare_employee", 0),
            "state_withholding": stub.get("state_withholding", 0),
            "deduction_other": stub.get("deduction_other", 0),
            "total_deductions": stub.get("total_deductions", 0),
            "net_pay": stub.get("net_pay", 0),
            "ytd_gross": stub.get("ytd_gross", 0),
            "created_at": str(stub.get("created_at", "")),
        })
    return {"stubs": result, "count": len(result)}

@router.get("/stubs/{stub_id}")
async def get_stub_detail(stub_id: str, request: Request):
    db, user = await get_db_and_admin(request)
    stub = await db.payroll_stubs.find_one({"_id": ObjectId(stub_id)})
    if not stub:
        raise HTTPException(404, "Talón de pago no encontrado")

    biz = await db.payroll_businesses.find_one({"_id": ObjectId(stub["business_id"])})

    return {
        "id": str(stub["_id"]),
        "business": {
            "name": biz.get("business_name", "") if biz else "",
            "address": f"{biz.get('business_address', '')} {biz.get('city', '')} {biz.get('state', '')} {biz.get('zip_code', '')}".strip() if biz else "",
            "ein": biz.get("ein", "") if biz else "",
            "phone": biz.get("phone", "") if biz else "",
        },
        "employee": {
            "name": stub.get("employee_name", ""),
            "ssn": stub.get("employee_ssn", ""),
            "address": stub.get("employee_address", ""),
            "department": stub.get("department", ""),
            "position": stub.get("position", ""),
        },
        "pay_period_start": stub.get("pay_period_start", ""),
        "pay_period_end": stub.get("pay_period_end", ""),
        "pay_date": stub.get("pay_date", ""),
        "earnings": {
            "regular_hours": stub.get("regular_hours", 0),
            "overtime_hours": stub.get("overtime_hours", 0),
            "hourly_rate": stub.get("hourly_rate", 0),
            "regular_pay": stub.get("regular_pay", 0),
            "overtime_pay": stub.get("overtime_pay", 0),
            "bonus": stub.get("bonus", 0),
            "commission": stub.get("commission", 0),
            "reimbursement": stub.get("reimbursement", 0),
            "gross_pay": stub.get("gross_pay", 0),
        },
        "deductions": {
            "federal_withholding": stub.get("federal_withholding", 0),
            "social_security": stub.get("social_security_employee", 0),
            "medicare": stub.get("medicare_employee", 0),
            "state_withholding": stub.get("state_withholding", 0),
            "other": stub.get("deduction_other", 0),
            "other_label": stub.get("deduction_other_label", ""),
            "total_deductions": stub.get("total_deductions", 0),
        },
        "net_pay": stub.get("net_pay", 0),
        "ytd": {
            "gross": stub.get("ytd_gross", 0),
        },
        "employer_taxes": {
            "social_security": stub.get("social_security_employer", 0),
            "medicare": stub.get("medicare_employer", 0),
        },
    }

# ============================================
# REPORTS
# ============================================

@router.get("/reports/quarterly")
async def quarterly_report(request: Request, business_id: str = "", year: int = 2025, quarter: int = 1):
    """Generate Form 941 quarterly data for a specific business"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    quarter_ranges = {
        1: (f"{year}-01-01", f"{year}-03-31"),
        2: (f"{year}-04-01", f"{year}-06-30"),
        3: (f"{year}-07-01", f"{year}-09-30"),
        4: (f"{year}-10-01", f"{year}-12-31"),
    }
    start_date, end_date = quarter_ranges.get(quarter, quarter_ranges[1])

    query = {"admin_id": admin_id, "deleted": {"$ne": True},
             "pay_date": {"$gte": start_date, "$lte": end_date}}
    if business_id:
        query["business_id"] = business_id

    stubs = await db.payroll_stubs.find(query).to_list(5000)

    biz = None
    if business_id:
        biz = await db.payroll_businesses.find_one({"_id": ObjectId(business_id)})

    # Aggregate by employee
    employee_data = {}
    for stub in stubs:
        emp_id = stub.get("employee_id", "")
        if emp_id not in employee_data:
            employee_data[emp_id] = {
                "name": stub.get("employee_name", ""),
                "total_wages": 0, "fit": 0, "ss_employee": 0, "ss_employer": 0,
                "medicare_employee": 0, "medicare_employer": 0, "ss_wages": 0,
            }
        d = employee_data[emp_id]
        d["total_wages"] += stub.get("gross_pay", 0)
        d["fit"] += stub.get("federal_withholding", 0)
        d["ss_employee"] += stub.get("social_security_employee", 0)
        d["ss_employer"] += stub.get("social_security_employer", 0)
        d["medicare_employee"] += stub.get("medicare_employee", 0)
        d["medicare_employer"] += stub.get("medicare_employer", 0)
        d["ss_wages"] += stub.get("ss_wages", 0)

    total_wages = sum(d["total_wages"] for d in employee_data.values())
    total_fit = sum(d["fit"] for d in employee_data.values())
    total_ss_employee = sum(d["ss_employee"] for d in employee_data.values())
    total_ss_employer = sum(d["ss_employer"] for d in employee_data.values())
    total_medicare_employee = sum(d["medicare_employee"] for d in employee_data.values())
    total_medicare_employer = sum(d["medicare_employer"] for d in employee_data.values())
    total_ss_wages = sum(d["ss_wages"] for d in employee_data.values())

    quarter_names = {1: "Jan-Mar", 2: "Apr-Jun", 3: "Jul-Sep", 4: "Oct-Dec"}
    due_dates = {1: f"Apr 30, {year}", 2: f"Jul 31, {year}", 3: f"Oct 31, {year}", 4: f"Jan 31, {year + 1}"}

    return {
        "form": "941",
        "year": year,
        "quarter": quarter,
        "quarter_name": quarter_names[quarter],
        "due_date": due_dates[quarter],
        "business": {
            "name": biz.get("business_name", "") if biz else "All Businesses",
            "ein": biz.get("ein", "") if biz else "",
            "address": biz.get("business_address", "") if biz else "",
        },
        "employee_count": len(employee_data),
        "total_wages": round(total_wages, 2),
        "total_fit": round(total_fit, 2),
        "ss_wages": round(total_ss_wages, 2),
        "ss_tax_total": round(total_ss_employee + total_ss_employer, 2),
        "medicare_wages": round(total_wages, 2),
        "medicare_tax_total": round(total_medicare_employee + total_medicare_employer, 2),
        "total_tax_liability": round(total_fit + total_ss_employee + total_ss_employer + total_medicare_employee + total_medicare_employer, 2),
        "employees": [
            {"name": d["name"], "wages": round(d["total_wages"], 2), "fit": round(d["fit"], 2),
             "ss": round(d["ss_employee"], 2), "medicare": round(d["medicare_employee"], 2)}
            for d in employee_data.values()
        ],
    }

@router.get("/reports/annual")
async def annual_report(request: Request, business_id: str = "", year: int = 2025):
    """Generate annual W-2 summary and Form 940 FUTA data"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    query = {"admin_id": admin_id, "deleted": {"$ne": True},
             "pay_date": {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}}
    if business_id:
        query["business_id"] = business_id

    stubs = await db.payroll_stubs.find(query).to_list(10000)

    biz = None
    if business_id:
        biz = await db.payroll_businesses.find_one({"_id": ObjectId(business_id)})

    # Aggregate by employee
    employee_data = {}
    for stub in stubs:
        emp_id = stub.get("employee_id", "")
        if emp_id not in employee_data:
            employee_data[emp_id] = {
                "name": stub.get("employee_name", ""),
                "ssn": stub.get("employee_ssn", ""),
                "address": stub.get("employee_address", ""),
                "total_wages": 0, "fit": 0,
                "ss_wages": 0, "ss_tax": 0,
                "medicare_wages": 0, "medicare_tax": 0,
            }
        d = employee_data[emp_id]
        d["total_wages"] += stub.get("gross_pay", 0)
        d["fit"] += stub.get("federal_withholding", 0)
        d["ss_wages"] += stub.get("ss_wages", 0)
        d["ss_tax"] += stub.get("social_security_employee", 0)
        d["medicare_wages"] += stub.get("gross_pay", 0)
        d["medicare_tax"] += stub.get("medicare_employee", 0)

    # FUTA calculation
    total_futa_taxable = 0
    for emp_id, d in employee_data.items():
        emp = await db.payroll_employees.find_one({"_id": ObjectId(emp_id)})
        if emp:
            age = calculate_age(emp.get("date_of_birth", ""))
            fica = get_fica_exemptions(emp.get("relationship", "None"), age, emp.get("employee_type", "W-2"))
            if not fica["exempt_futa"]:
                total_futa_taxable += min(d["total_wages"], FUTA_WAGE_BASE)

    total_wages = sum(d["total_wages"] for d in employee_data.values())
    futa_tax = round(total_futa_taxable * FUTA_RATE, 2)

    w2_forms = []
    for emp_id, d in employee_data.items():
        w2_forms.append({
            "employee_id": emp_id,
            "employee_name": d["name"],
            "ssn": d["ssn"],
            "address": d["address"],
            "box1_wages": round(d["total_wages"], 2),
            "box2_fit": round(d["fit"], 2),
            "box3_ss_wages": round(d["ss_wages"], 2),
            "box4_ss_tax": round(d["ss_tax"], 2),
            "box5_medicare_wages": round(d["medicare_wages"], 2),
            "box6_medicare_tax": round(d["medicare_tax"], 2),
        })

    return {
        "year": year,
        "business": {
            "name": biz.get("business_name", "") if biz else "All Businesses",
            "ein": biz.get("ein", "") if biz else "",
        },
        "total_wages": round(total_wages, 2),
        "employee_count": len(employee_data),
        "futa": {
            "taxable_wages": round(total_futa_taxable, 2),
            "futa_tax": futa_tax,
            "futa_rate": "0.6%",
        },
        "w2_forms": w2_forms,
    }

@router.get("/reports/payroll-summary")
async def payroll_summary_report(request: Request, business_id: str = "", year: int = 2025):
    """Get month-by-month payroll summary"""
    db, user = await get_db_and_admin(request)
    admin_id = str(user.get('_id', user.get('id')))

    query = {"admin_id": admin_id, "deleted": {"$ne": True},
             "pay_date": {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}}
    if business_id:
        query["business_id"] = business_id

    stubs = await db.payroll_stubs.find(query).to_list(10000)

    monthly = {}
    for i in range(1, 13):
        monthly[i] = {"gross": 0, "net": 0, "taxes": 0, "employer_taxes": 0, "count": 0}

    for stub in stubs:
        pay_date = stub.get("pay_date", "")
        if pay_date:
            try:
                month = int(pay_date.split("-")[1])
                monthly[month]["gross"] += stub.get("gross_pay", 0)
                monthly[month]["net"] += stub.get("net_pay", 0)
                monthly[month]["taxes"] += stub.get("total_deductions", 0)
                monthly[month]["employer_taxes"] += stub.get("social_security_employer", 0) + stub.get("medicare_employer", 0)
                monthly[month]["count"] += 1
            except:
                pass

    month_names = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    summary = []
    for i in range(1, 13):
        summary.append({
            "month": i,
            "month_name": month_names[i],
            "gross": round(monthly[i]["gross"], 2),
            "net": round(monthly[i]["net"], 2),
            "employee_taxes": round(monthly[i]["taxes"], 2),
            "employer_taxes": round(monthly[i]["employer_taxes"], 2),
            "paycheck_count": monthly[i]["count"],
        })

    return {"year": year, "monthly_summary": summary}
