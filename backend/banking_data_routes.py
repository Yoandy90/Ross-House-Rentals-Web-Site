"""
Banking Data Management Routes
CRUD for client banking data (routing + account numbers)
with import/export capabilities compatible with Merchant One batch format.
"""

import csv
import io
import json
import logging
import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/banking-data", tags=["Banking Data"])

# Database reference - set during startup
db = None

def set_db(database):
    global db
    db = database


# ==================== MODELS ====================

class BankingDataCreate(BaseModel):
    client_id: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip_code: Optional[str] = ""
    routing_number: Optional[str] = ""
    account_number: Optional[str] = ""
    account_type: Optional[str] = "checking"  # checking or savings
    account_holder_type: Optional[str] = "personal"  # personal or business
    check_name: Optional[str] = ""
    notes: Optional[str] = ""
    ssn: Optional[str] = None


class BankingDataUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    routing_number: Optional[str] = None
    account_number: Optional[str] = None
    account_type: Optional[str] = None
    account_holder_type: Optional[str] = None
    check_name: Optional[str] = None
    notes: Optional[str] = None
    ssn: Optional[str] = None


class BankingDataImport(BaseModel):
    csv_data: str
    has_header: bool = True


# ==================== AUTH HELPER ====================

async def verify_admin(authorization: str = Header(None)):
    """Verify admin or office assistant authentication"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization provided")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="Admin or assistant access required")
    
    return user


# ==================== ENDPOINTS ====================

@router.get("")
async def list_banking_data(
    search: str = Query("", description="Search by name, email, or account"),
    status: str = Query("", description="Filter: pending, complete, or all"),
    has_ssn: str = Query("", description="Filter: 'yes' for only with SSN, 'no' for without SSN"),
    show_full_ssn: bool = Query(False, description="Show full SSN numbers"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin_user = Depends(verify_admin)
):
    """List all banking data records with search, filter, and pagination"""
    
    query = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        # Check if searching by SSN (last 4 digits)
        clean_search = search.replace("-", "").replace(" ", "")
        if clean_search.isdigit() and len(clean_search) <= 4:
            # Search by last 4 of SSN
            query["$or"] = [
                {"ssn_last4": clean_search},
                {"first_name": search_regex},
                {"last_name": search_regex},
                {"phone": search_regex},
            ]
        elif clean_search.isdigit() and len(clean_search) == 9:
            # Search by full SSN
            query["$or"] = [
                {"ssn": clean_search},
                {"ssn_last4": clean_search[-4:]},
            ]
        else:
            query["$or"] = [
                {"first_name": search_regex},
                {"last_name": search_regex},
                {"email": search_regex},
                {"routing_number": search_regex},
                {"account_number": search_regex},
                {"phone": search_regex},
                {"city": search_regex},
                {"ssn_last4": search_regex},
                {"bank_name": search_regex},
            ]
    
    # SSN filter
    if has_ssn == "yes":
        if "$and" not in query:
            query["$and"] = []
        query["$and"].append({"ssn": {"$exists": True, "$nin": ["", None]}})
    elif has_ssn == "no":
        if "$and" not in query:
            query["$and"] = []
        query["$and"].append({"$or": [{"ssn": {"$exists": False}}, {"ssn": ""}, {"ssn": None}]})
    
    # Status filter
    if status == "pending":
        if "$and" not in query:
            query["$and"] = []
        query["$and"].append({
            "$or": [
                {"routing_number": ""},
                {"routing_number": {"$exists": False}},
                {"account_number": ""},
                {"account_number": {"$exists": False}},
            ]
        })
    elif status == "complete":
        query["routing_number"] = {"$ne": "", "$exists": True}
        query["account_number"] = {"$ne": "", "$exists": True}
    
    total = await db.client_banking.count_documents(query)
    skip = (page - 1) * limit
    
    records = await db.client_banking.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Serialize
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
        # Mask account number for display
        acct = r.get("account_number", "")
        r["masked_account"] = f"****{acct[-4:]}" if len(acct) >= 4 else "****"
        # Mask SSN for display - only show last 4
        ssn_val = r.get("ssn", "")
        r["ssn_last4"] = r.get("ssn_last4", ssn_val[-4:] if len(ssn_val) >= 4 else "")
        r["has_ssn"] = bool(ssn_val)
        # Show full SSN only when explicitly requested
        if show_full_ssn and ssn_val:
            r["ssn_full"] = f"{ssn_val[:3]}-{ssn_val[3:5]}-{ssn_val[5:]}" if len(ssn_val) == 9 else ssn_val
        # Remove raw SSN from response
        if "ssn" in r:
            del r["ssn"]
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"):
            r["updated_at"] = r["updated_at"].isoformat()
    
    return {
        "success": True,
        "records": records,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("")
async def create_banking_data(data: BankingDataCreate, admin_user = Depends(verify_admin)):
    """Create a new banking data record"""
    
    # Validate routing number (9 digits) - allow empty for pending records
    clean_routing = (data.routing_number or "").replace(" ", "").replace("-", "")
    if clean_routing and (not clean_routing.isdigit() or len(clean_routing) != 9):
        raise HTTPException(status_code=400, detail="El número de ruta debe tener exactamente 9 dígitos")
    
    # Validate account number (4-17 digits) - allow empty for pending records
    clean_account = (data.account_number or "").replace(" ", "").replace("-", "")
    if clean_account and (not clean_account.isdigit() or len(clean_account) < 4 or len(clean_account) > 17):
        raise HTTPException(status_code=400, detail="El número de cuenta debe tener entre 4 y 17 dígitos")
    
    # Validate SSN if provided (9 digits)
    clean_ssn = ""
    ssn_last4 = ""
    if data.ssn:
        clean_ssn = data.ssn.replace(" ", "").replace("-", "")
        if clean_ssn and (not clean_ssn.isdigit() or len(clean_ssn) != 9):
            raise HTTPException(status_code=400, detail="SSN debe tener exactamente 9 dígitos")
        ssn_last4 = clean_ssn[-4:] if clean_ssn else ""
    
    check_name = data.check_name or f"{data.first_name} {data.last_name}"
    
    record = {
        "client_id": data.client_id,
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "email": (data.email or "").strip(),
        "phone": (data.phone or "").strip(),
        "address": (data.address or "").strip(),
        "city": (data.city or "").strip(),
        "state": (data.state or "").strip(),
        "zip_code": (data.zip_code or "").strip(),
        "routing_number": clean_routing,
        "account_number": clean_account,
        "account_type": data.account_type or "checking",
        "account_holder_type": data.account_holder_type or "personal",
        "check_name": check_name.strip(),
        "notes": (data.notes or "").strip(),
        "ssn": clean_ssn,
        "ssn_last4": ssn_last4,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db.client_banking.insert_one(record)
    record["id"] = str(result.inserted_id)
    
    logger.info(f"Banking data created for {data.first_name} {data.last_name}")
    
    return {"success": True, "id": record["id"], "message": "Datos bancarios guardados exitosamente"}


@router.put("/{record_id}")
async def update_banking_data(record_id: str, data: BankingDataUpdate, admin_user = Depends(verify_admin)):
    """Update an existing banking data record"""
    
    update_fields = {}
    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            if field == "routing_number":
                clean = value.replace(" ", "").replace("-", "")
                if clean == "":
                    update_fields[field] = ""
                elif not clean.isdigit() or len(clean) != 9:
                    raise HTTPException(status_code=400, detail="Routing debe tener 9 dígitos")
                else:
                    update_fields[field] = clean
            elif field == "account_number":
                clean = value.replace(" ", "").replace("-", "")
                if clean == "":
                    update_fields[field] = ""
                elif not clean.isdigit() or len(clean) < 4:
                    raise HTTPException(status_code=400, detail="Account debe tener mínimo 4 dígitos")
                else:
                    update_fields[field] = clean
            elif field == "ssn":
                clean_ssn = value.replace(" ", "").replace("-", "")
                if clean_ssn and (not clean_ssn.isdigit() or len(clean_ssn) != 9):
                    raise HTTPException(status_code=400, detail="SSN debe tener 9 dígitos")
                update_fields["ssn"] = clean_ssn
                update_fields["ssn_last4"] = clean_ssn[-4:] if clean_ssn else ""
            else:
                update_fields[field] = value.strip() if isinstance(value, str) else value
    
    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        # Auto-update check_name if name fields changed
        if "first_name" in update_fields or "last_name" in update_fields:
            existing = await db.client_banking.find_one({"_id": ObjectId(record_id)})
            if existing:
                fn = update_fields.get("first_name", existing.get("first_name", ""))
                ln = update_fields.get("last_name", existing.get("last_name", ""))
                update_fields["check_name"] = f"{fn} {ln}"
        
        result = await db.client_banking.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    return {"success": True, "message": "Datos actualizados"}


@router.delete("/{record_id}")
async def delete_banking_data(record_id: str, admin_user = Depends(verify_admin)):
    """Delete a banking data record"""
    
    result = await db.client_banking.delete_one({"_id": ObjectId(record_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    
    return {"success": True, "message": "Registro eliminado"}


@router.get("/clients-search")
async def search_clients_for_banking(
    q: str = Query("", description="Search query"),
    admin_user = Depends(verify_admin)
):
    """Search existing Ross Tax clients to link banking data"""
    
    if not q or len(q) < 2:
        return {"clients": []}
    
    search_regex = {"$regex": q, "$options": "i"}
    query = {
        "$or": [
            {"name": search_regex},
            {"email": search_regex},
            {"phone": search_regex},
        ]
    }
    
    clients = await db.users.find(query, {
        "name": 1, "email": 1, "phone": 1,
        "address": 1, "role": 1
    }).limit(15).to_list(15)
    
    result = []
    for c in clients:
        name = c.get("name", "")
        parts = name.strip().split()
        result.append({
            "id": str(c["_id"]),
            "name": name,
            "first_name": parts[0] if parts else "",
            "last_name": " ".join(parts[1:]) if len(parts) > 1 else "",
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "address": c.get("address", {}).get("address_line1", "") if isinstance(c.get("address"), dict) else "",
            "city": c.get("address", {}).get("city", "") if isinstance(c.get("address"), dict) else "",
            "state": c.get("address", {}).get("state", "") if isinstance(c.get("address"), dict) else "",
            "zip_code": c.get("address", {}).get("zip_code", "") if isinstance(c.get("address"), dict) else "",
            "role": c.get("role", "client"),
        })
    
    return {"clients": result}


@router.get("/export/csv")
async def export_banking_csv(token: str = Query(None), authorization: str = Header(None)):
    """Export banking data as CSV compatible with Merchant One batch format"""
    
    # Auth: accept token from query param (for window.open) or header
    auth_token = authorization or token
    if not auth_token:
        raise HTTPException(status_code=401, detail="No authorization provided")
    auth_token = auth_token.replace("Bearer ", "") if auth_token.startswith("Bearer ") else auth_token
    session = await db.user_sessions.find_one({"session_token": auth_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    records = await db.client_banking.find().sort("last_name", 1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Merchant One compatible header
    writer.writerow([
        "firstName", "lastName", "email", "phone",
        "address1", "city", "state", "postalCode",
        "checkName", "routing", "accountNumber",
        "accountType", "accountHolderType",
        "secCode", "planName", "amount", "dayFrequency", "startDate"
    ])
    
    for r in records:
        # Use ="value" format to prevent Excel from converting numbers to scientific notation
        routing = r.get("routing_number", "")
        account = r.get("account_number", "")
        writer.writerow([
            r.get("first_name", ""),
            r.get("last_name", ""),
            r.get("email", ""),
            r.get("phone", ""),
            r.get("address", ""),
            r.get("city", ""),
            r.get("state", ""),
            r.get("zip_code", ""),
            r.get("check_name", f"{r.get('first_name', '')} {r.get('last_name', '')}"),
            f'="{routing}"' if routing else "",
            f'="{account}"' if account else "",
            r.get("account_type", "checking"),
            r.get("account_holder_type", "personal"),
            "WEB",  # SEC code for web-initiated ACH
            "",     # planName (to be filled when creating subscription)
            "",     # amount
            "",     # dayFrequency
            "",     # startDate
        ])
    
    output.seek(0)
    
    filename = f"banking_data_merchant_one_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/simple-csv")
async def export_banking_simple_csv(token: str = Query(None), authorization: str = Header(None)):
    """Export banking data as simple CSV (name, routing, account only)"""
    
    # Auth: accept token from query param (for window.open) or header
    auth_token = authorization or token
    if not auth_token:
        raise HTTPException(status_code=401, detail="No authorization provided")
    auth_token = auth_token.replace("Bearer ", "") if auth_token.startswith("Bearer ") else auth_token
    session = await db.user_sessions.find_one({"session_token": auth_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    records = await db.client_banking.find().sort("last_name", 1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Nombre", "Apellido", "Email", "Teléfono",
        "Número de Ruta", "Número de Cuenta",
        "Tipo de Cuenta", "Notas"
    ])
    
    for r in records:
        routing = r.get("routing_number", "")
        account = r.get("account_number", "")
        writer.writerow([
            r.get("first_name", ""),
            r.get("last_name", ""),
            r.get("email", ""),
            r.get("phone", ""),
            f'="{routing}"' if routing else "",
            f'="{account}"' if account else "",
            r.get("account_type", "checking"),
            r.get("notes", ""),
        ])
    
    output.seek(0)
    filename = f"datos_bancarios_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/clean-csv")
async def export_banking_clean_csv(token: str = Query(None), authorization: str = Header(None), state_filter: str = Query(None)):
    """Export CLEAN banking data: Nombre, Apellidos, Dirección, Ruta, Cuenta"""
    
    auth_token = authorization or token
    if not auth_token:
        raise HTTPException(status_code=401, detail="No authorization provided")
    auth_token = auth_token.replace("Bearer ", "") if auth_token.startswith("Bearer ") else auth_token
    session = await db.user_sessions.find_one({"session_token": auth_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if state_filter:
        query["state"] = {"$regex": state_filter, "$options": "i"}
    # Only export records with banking data
    query["routing_number"] = {"$ne": ""}
    query["account_number"] = {"$ne": ""}
    
    records = await db.client_banking.find(query).sort("last_name", 1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Nombre", "Apellidos", "Dirección Completa", "Número de Ruta", "Número de Cuenta"
    ])
    
    for r in records:
        # Build full address
        addr_parts = []
        if r.get("address"):
            addr_parts.append(r["address"])
        if r.get("city"):
            addr_parts.append(r["city"])
        if r.get("state"):
            addr_parts.append(r["state"])
        if r.get("zip_code"):
            addr_parts.append(r["zip_code"])
        full_address = ", ".join(addr_parts)
        
        routing = r.get("routing_number", "")
        account = r.get("account_number", "")
        writer.writerow([
            r.get("first_name", ""),
            r.get("last_name", ""),
            full_address,
            f'="{routing}"' if routing else "",
            f'="{account}"' if account else "",
        ])
    
    output.seek(0)
    filename = f"datos_bancarios_limpio_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/import")
async def import_banking_data(data: BankingDataImport, admin_user = Depends(verify_admin)):
    """Import banking data from CSV"""
    
    reader = csv.reader(io.StringIO(data.csv_data))
    rows = list(reader)
    
    if not rows:
        raise HTTPException(status_code=400, detail="CSV vacío")
    
    start_idx = 1 if data.has_header else 0
    imported = 0
    errors = []
    
    for i, row in enumerate(rows[start_idx:], start=start_idx + 1):
        try:
            if len(row) < 6:
                errors.append(f"Fila {i}: Faltan columnas (mínimo 6: nombre, apellido, email, teléfono, routing, cuenta)")
                continue
            
            first_name = row[0].strip()
            last_name = row[1].strip()
            email = row[2].strip() if len(row) > 2 else ""
            phone = row[3].strip() if len(row) > 3 else ""
            routing = row[4].strip().replace(" ", "").replace("-", "")
            account = row[5].strip().replace(" ", "").replace("-", "")
            account_type = row[6].strip().lower() if len(row) > 6 else "checking"
            notes = row[7].strip() if len(row) > 7 else ""
            
            if not first_name or not last_name:
                errors.append(f"Fila {i}: Nombre y apellido requeridos")
                continue
            
            if not routing.isdigit() or len(routing) != 9:
                errors.append(f"Fila {i}: Routing inválido '{routing}' (debe ser 9 dígitos)")
                continue
            
            if not account.isdigit() or len(account) < 4:
                errors.append(f"Fila {i}: Cuenta inválida '{account}' (mínimo 4 dígitos)")
                continue
            
            if account_type not in ("checking", "savings"):
                account_type = "checking"
            
            record = {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
                "routing_number": routing,
                "account_number": account,
                "account_type": account_type,
                "account_holder_type": "personal",
                "check_name": f"{first_name} {last_name}",
                "notes": notes,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "imported": True,
            }
            
            await db.client_banking.insert_one(record)
            imported += 1
            
        except Exception as e:
            errors.append(f"Fila {i}: Error - {str(e)}")
    
    return {
        "success": True,
        "imported": imported,
        "errors": errors,
        "total_rows": len(rows) - (1 if data.has_header else 0),
        "message": f"Se importaron {imported} registros exitosamente" + (f" ({len(errors)} errores)" if errors else "")
    }


@router.get("/stats")
async def get_banking_stats(admin_user = Depends(verify_admin)):
    """Get statistics for banking data"""
    
    total = await db.client_banking.count_documents({})
    with_routing = await db.client_banking.count_documents({"routing_number": {"$ne": "", "$exists": True}})
    with_account = await db.client_banking.count_documents({"account_number": {"$ne": "", "$exists": True}})
    complete = await db.client_banking.count_documents({
        "routing_number": {"$ne": "", "$exists": True},
        "account_number": {"$ne": "", "$exists": True}
    })
    pending = total - complete
    checking = await db.client_banking.count_documents({"account_type": "checking", "routing_number": {"$ne": ""}})
    savings = await db.client_banking.count_documents({"account_type": "savings", "routing_number": {"$ne": ""}})
    efiled = await db.client_banking.count_documents({"efiled": "YES"})
    not_efiled = await db.client_banking.count_documents({"efiled": "NO"})
    with_ssn = await db.client_banking.count_documents({"ssn": {"$ne": "", "$exists": True}})
    with_bank_name = await db.client_banking.count_documents({"bank_name": {"$exists": True, "$nin": ["", None]}})
    
    return {
        "total": total,
        "with_routing": with_routing,
        "with_account": with_account,
        "complete": complete,
        "pending": pending,
        "checking_accounts": checking,
        "savings_accounts": savings,
        "efiled": efiled,
        "not_efiled": not_efiled,
        "with_ssn": with_ssn,
        "with_bank_name": with_bank_name,
    }
# Railway rebuild trigger: Wed Apr  1 19:13:20 UTC 2026


# ===== SCRAPER CONTROL ENDPOINTS =====

@router.post("/scraper/start")
async def start_scraper(admin_user = Depends(verify_admin)):
    """Start or resume the bank data scraper in background"""
    import subprocess
    import os
    
    # Check if scraper is already running
    pid_file = "/tmp/bank_scraper.pid"
    if os.path.exists(pid_file):
        try:
            with open(pid_file) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)  # Check if process is alive
            return {"status": "already_running", "pid": pid, "message": "Scraper ya está corriendo"}
        except (ProcessLookupError, ValueError):
            os.remove(pid_file)
    
    # Start scraper in background
    proc = subprocess.Popen(
        ["python3", "/app/backend/tax_portal_bank_full.py"],
        stdout=open("/tmp/bank_scraper_stdout.log", "w"),
        stderr=open("/tmp/bank_scraper_stderr.log", "w"),
        cwd="/app/backend",
        start_new_session=True
    )
    
    with open(pid_file, "w") as f:
        f.write(str(proc.pid))
    
    return {"status": "started", "pid": proc.pid, "message": "Scraper iniciado. Espera el SMS con el código 2FA."}


@router.post("/scraper/2fa")
async def submit_2fa_code(code: str = Query(...), admin_user = Depends(verify_admin)):
    """Submit 2FA code for the scraper login"""
    code_file = "/tmp/2fa_code.txt"
    with open(code_file, "w") as f:
        f.write(code.strip())
    return {"status": "ok", "message": f"Código 2FA '{code.strip()}' guardado. El scraper lo leerá automáticamente."}


@router.get("/scraper/status")
async def get_scraper_status(admin_user = Depends(verify_admin)):
    """Get current scraper status"""
    import os
    
    status = {
        "running": False,
        "pid": None,
        "progress": None,
        "log_tail": "",
        "waiting_2fa": False,
    }
    
    # Check if running
    pid_file = "/tmp/bank_scraper.pid"
    if os.path.exists(pid_file):
        try:
            with open(pid_file) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)
            status["running"] = True
            status["pid"] = pid
        except (ProcessLookupError, ValueError):
            pass
    
    # Check progress
    progress_file = "/app/backend/scraped_data/bank_progress.json"
    if os.path.exists(progress_file):
        try:
            with open(progress_file) as f:
                prog = json.load(f)
            total_results = len(prog.get("results", []))
            with_bank = len([r for r in prog.get("results", []) if r.get("has_bank_data")])
            status["progress"] = {
                "last_page": prog.get("last_page", 0),
                "total_processed": total_results,
                "with_bank_data": with_bank,
                "without_bank_data": total_results - with_bank,
                "processed_ssns": len(prog.get("processed_ssns", [])),
                "timestamp": prog.get("timestamp", ""),
            }
        except:
            pass
    
    # Check log
    log_file = "/tmp/bank_full_status.txt"
    if os.path.exists(log_file):
        try:
            with open(log_file) as f:
                lines = f.readlines()
            status["log_tail"] = "".join(lines[-20:])
            # Check if waiting for 2FA
            for line in lines[-10:]:
                if "2fa" in line.lower() or "waiting" in line.lower() or "code" in line.lower():
                    status["waiting_2fa"] = True
                    break
        except:
            pass
    
    return status


@router.post("/scraper/stop")
async def stop_scraper(admin_user = Depends(verify_admin)):
    """Stop the running scraper"""
    import os, signal
    
    pid_file = "/tmp/bank_scraper.pid"
    if not os.path.exists(pid_file):
        return {"status": "not_running", "message": "Scraper no está corriendo"}
    
    try:
        with open(pid_file) as f:
            pid = int(f.read().strip())
        os.kill(pid, signal.SIGTERM)
        os.remove(pid_file)
        return {"status": "stopped", "message": f"Scraper (PID {pid}) detenido"}
    except ProcessLookupError:
        os.remove(pid_file)
        return {"status": "not_running", "message": "Scraper ya no estaba corriendo"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/scraper/import")
async def import_scraped_data(admin_user = Depends(verify_admin)):
    """Import scraped bank data from JSON files into MongoDB"""
    from datetime import datetime
    
    bank_data_file = "/app/backend/scraped_data/bank_data_clean.json"
    if not os.path.exists(bank_data_file):
        # Try to clean raw data first
        raw_file = "/app/backend/scraped_data/bank_data.json"
        if not os.path.exists(raw_file):
            raise HTTPException(status_code=404, detail="No scraped data found")
        
        # Clean raw data
        with open(raw_file) as f:
            raw = json.load(f)
        
        records = raw.get("records", [])
        clean_records = []
        for rec in records:
            bank_fields = rec.get("bank_fields", {})
            routing = ""
            account = ""
            bank_name = ""
            account_type = "Checking"
            
            for k, v in bank_fields.items():
                kl = k.lower()
                if "routing" in kl and v and not routing:
                    routing = str(v).strip()
                if "account" in kl and "type" not in kl and "re-type" not in kl and "retype" not in kl and v and not account:
                    account = str(v).strip()
                if "bankname" in kl.replace("_", "").replace(" ", "") and v:
                    bank_name = str(v).strip()
                if "type" in kl and "account" in kl and v:
                    account_type = str(v).strip()
            
            if routing or account:
                clean_records.append({
                    "ssn": rec.get("ssn", ""),
                    "name": rec.get("name", ""),
                    "routing_number": routing,
                    "account_number": account,
                    "bank_name": bank_name,
                    "account_type": account_type,
                    "routing_valid": len(routing) >= 8,
                })
        
        with open(bank_data_file, "w") as f:
            json.dump({
                "count": len(clean_records),
                "records": clean_records,
                "cleaned_at": datetime.utcnow().isoformat(),
            }, f, indent=2)
    
    # Load clean data
    with open(bank_data_file) as f:
        data = json.load(f)
    
    records = data.get("records", [])
    matched = 0
    updated = 0
    not_found = 0
    
    for rec in records:
        ssn = rec.get("ssn", "").replace("-", "")
        if not ssn or len(ssn) < 4:
            continue
        
        ssn_dashes = f"{ssn[:3]}-{ssn[3:5]}-{ssn[5:]}" if len(ssn) == 9 else ssn
        
        existing = await db.client_banking.find_one({
            "$or": [{"ssn": ssn}, {"ssn": ssn_dashes}]
        })
        
        if existing:
            matched += 1
            if not existing.get("routing_number") or existing["routing_number"] == "":
                update = {"updated_at": datetime.utcnow(), "status": "complete", "data_source": "scraper"}
                if rec.get("routing_number"):
                    update["routing_number"] = rec["routing_number"]
                if rec.get("account_number"):
                    update["account_number"] = rec["account_number"]
                    acct = rec["account_number"]
                    update["masked_account"] = "x" * (len(acct) - 4) + acct[-4:] if len(acct) >= 4 else acct
                if rec.get("bank_name"):
                    update["bank_name"] = rec["bank_name"]
                if rec.get("account_type"):
                    update["account_type"] = rec["account_type"].lower()
                
                await db.client_banking.update_one({"_id": existing["_id"]}, {"$set": update})
                updated += 1
            elif not existing.get("bank_name") and rec.get("bank_name"):
                await db.client_banking.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"bank_name": rec["bank_name"], "updated_at": datetime.utcnow()}}
                )
                updated += 1
        else:
            not_found += 1
    
    return {
        "status": "ok",
        "total_records": len(records),
        "matched": matched,
        "updated": updated,
        "not_found": not_found,
    }

