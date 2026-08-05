"""
Bookkeeping Payroll Module — Workers, Payment Tracking, and 1099/W-2 Generation
Manages contractors and employees under businesses, tracks payments,
and bridges to IRS IRIS for 1099-NEC/MISC filing.
"""
import os
import logging
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

payroll_router = APIRouter(tags=["Bookkeeping Payroll"])

_db: AsyncIOMotorDatabase = None
_iris_service = None


def set_payroll_db(db: AsyncIOMotorDatabase, iris_service=None):
    global _db, _iris_service
    _db = db
    _iris_service = iris_service
    logger.info("✅ Payroll module initialized")


async def _auth_admin(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="No token")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await _db.users.find_one({"id": session["user_id"]})
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


WORKER_TYPES = [
    {"key": "contractor", "label_en": "Independent Contractor", "label_es": "Contratista Independiente"},
    {"key": "employee", "label_en": "Employee (W-2)", "label_es": "Empleado (W-2)"},
]

PAYMENT_METHODS = [
    {"key": "check", "label": "Cheque"},
    {"key": "direct_deposit", "label": "Depósito Directo"},
    {"key": "cash", "label": "Efectivo"},
    {"key": "zelle", "label": "Zelle"},
    {"key": "venmo", "label": "Venmo"},
    {"key": "paypal", "label": "PayPal"},
    {"key": "wire", "label": "Transferencia"},
    {"key": "other", "label": "Otro"},
]


# ═══════════════════════════════════════════════════════════════════════
# WORKERS CRUD
# ═══════════════════════════════════════════════════════════════════════

@payroll_router.get("/admin/bookkeeping/workers")
async def list_workers(
    request: Request,
    business_id: str = "",
    worker_type: str = "",
    search: str = "",
    page: int = 1,
    limit: int = 50,
):
    """List all workers (contractors/employees) with filters"""
    await _auth_admin(request)

    query = {}
    if business_id:
        query["business_id"] = business_id
    if worker_type:
        query["worker_type"] = worker_type
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"tin_last4": search[-4:]},
        ]

    total = await _db.bk_workers.count_documents(query)
    skip = (page - 1) * limit
    workers = await _db.bk_workers.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for w in workers:
        # Get total payments for this worker in current year
        year = datetime.utcnow().year
        year_start = datetime(year, 1, 1)
        year_end = datetime(year, 12, 31, 23, 59, 59)

        payment_agg = await _db.bk_worker_payments.aggregate([
            {"$match": {
                "worker_id": str(w["_id"]),
                "payment_date": {"$gte": year_start, "$lte": year_end}
            }},
            {"$group": {
                "_id": None,
                "total_paid": {"$sum": "$amount"},
                "payment_count": {"$sum": 1}
            }}
        ]).to_list(1)

        ytd_total = payment_agg[0]["total_paid"] if payment_agg else 0
        ytd_count = payment_agg[0]["payment_count"] if payment_agg else 0

        # Get business name
        biz_name = ""
        if w.get("business_id"):
            biz = await _db.bk_businesses.find_one({"id": w["business_id"]})
            if biz:
                biz_name = biz.get("business_name", "")

        result.append({
            "id": str(w["_id"]),
            "first_name": w.get("first_name", ""),
            "last_name": w.get("last_name", ""),
            "business_name": w.get("business_name", ""),
            "worker_type": w.get("worker_type", "contractor"),
            "tin_type": w.get("tin_type", "SSN"),
            "tin_last4": w.get("tin_last4", "****"),
            "email": w.get("email", ""),
            "phone": w.get("phone", ""),
            "address": w.get("address", ""),
            "city": w.get("city", ""),
            "state": w.get("state", ""),
            "zip_code": w.get("zip_code", ""),
            "business_id": w.get("business_id", ""),
            "parent_business_name": biz_name,
            "iris_recipient_id": w.get("iris_recipient_id", ""),
            "status": w.get("status", "active"),
            "ytd_total": round(ytd_total, 2),
            "ytd_payments": ytd_count,
            "needs_1099": w.get("worker_type") == "contractor" and ytd_total >= 600,
            "created_at": w.get("created_at", "").isoformat() if isinstance(w.get("created_at"), datetime) else "",
        })

    return {
        "workers": result,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
        "worker_types": WORKER_TYPES,
        "payment_methods": PAYMENT_METHODS,
    }


@payroll_router.post("/admin/bookkeeping/workers")
async def create_worker(request: Request):
    """Create a new worker (contractor or employee) under a business"""
    await _auth_admin(request)
    data = await request.json()

    required = ["first_name", "last_name", "worker_type", "business_id"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")

    tin = data.get("tin", "").replace("-", "").replace(" ", "")
    tin_last4 = tin[-4:] if len(tin) >= 4 else ""

    worker = {
        "first_name": data["first_name"].strip(),
        "last_name": data["last_name"].strip(),
        "business_name": data.get("business_name", "").strip(),
        "worker_type": data["worker_type"],  # contractor or employee
        "tin_type": data.get("tin_type", "SSN"),  # SSN or EIN
        "tin_encrypted": tin,
        "tin_last4": tin_last4,
        "email": data.get("email", "").strip().lower(),
        "phone": data.get("phone", "").strip(),
        "address": data.get("address", "").strip(),
        "city": data.get("city", "").strip(),
        "state": data.get("state", "").strip().upper(),
        "zip_code": data.get("zip_code", "").strip(),
        "business_id": data["business_id"],
        "iris_recipient_id": "",
        "status": "active",
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await _db.bk_workers.insert_one(worker)
    worker_id = str(result.inserted_id)

    logger.info(f"👷 Created worker: {worker['first_name']} {worker['last_name']} ({worker['worker_type']})")

    return {
        "success": True,
        "id": worker_id,
        "message": f"Trabajador {worker['first_name']} {worker['last_name']} creado exitosamente"
    }


@payroll_router.put("/admin/bookkeeping/workers/{worker_id}")
async def update_worker(worker_id: str, request: Request):
    """Update a worker's information"""
    await _auth_admin(request)
    data = await request.json()

    worker = await _db.bk_workers.find_one({"_id": ObjectId(worker_id)})
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    update_fields = {}
    allowed = ["first_name", "last_name", "business_name", "worker_type", "tin_type",
               "email", "phone", "address", "city", "state", "zip_code", "business_id",
               "status", "notes"]

    for field in allowed:
        if field in data:
            val = data[field]
            update_fields[field] = val.strip() if isinstance(val, str) else val

    if "tin" in data and data["tin"]:
        tin = data["tin"].replace("-", "").replace(" ", "")
        update_fields["tin_encrypted"] = tin
        update_fields["tin_last4"] = tin[-4:] if len(tin) >= 4 else ""

    update_fields["updated_at"] = datetime.utcnow()

    await _db.bk_workers.update_one(
        {"_id": ObjectId(worker_id)},
        {"$set": update_fields}
    )

    logger.info(f"👷 Updated worker: {worker_id}")
    return {"success": True, "message": "Trabajador actualizado"}


@payroll_router.delete("/admin/bookkeeping/workers/{worker_id}")
async def delete_worker(worker_id: str, request: Request):
    """Delete a worker and their payment records"""
    await _auth_admin(request)

    worker = await _db.bk_workers.find_one({"_id": ObjectId(worker_id)})
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    # Delete associated payments
    await _db.bk_worker_payments.delete_many({"worker_id": worker_id})
    await _db.bk_workers.delete_one({"_id": ObjectId(worker_id)})

    logger.info(f"🗑️ Deleted worker: {worker_id}")
    return {"success": True, "message": "Trabajador eliminado"}


# ═══════════════════════════════════════════════════════════════════════
# MANUAL PAYMENT REGISTRATION
# ═══════════════════════════════════════════════════════════════════════

@payroll_router.get("/admin/bookkeeping/worker-payments")
async def list_worker_payments(
    request: Request,
    worker_id: str = "",
    business_id: str = "",
    year: int = 0,
    page: int = 1,
    limit: int = 50,
):
    """List payments for a worker or business"""
    await _auth_admin(request)

    if year == 0:
        year = datetime.utcnow().year

    query = {
        "payment_date": {
            "$gte": datetime(year, 1, 1),
            "$lte": datetime(year, 12, 31, 23, 59, 59)
        }
    }
    if worker_id:
        query["worker_id"] = worker_id
    if business_id:
        query["business_id"] = business_id

    total = await _db.bk_worker_payments.count_documents(query)
    skip = (page - 1) * limit
    payments = await _db.bk_worker_payments.find(query).sort("payment_date", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for p in payments:
        result.append({
            "id": str(p["_id"]),
            "worker_id": p.get("worker_id", ""),
            "worker_name": p.get("worker_name", ""),
            "business_id": p.get("business_id", ""),
            "business_name": p.get("business_name", ""),
            "amount": p.get("amount", 0),
            "payment_date": p.get("payment_date").strftime("%Y-%m-%d") if isinstance(p.get("payment_date"), datetime) else "",
            "payment_method": p.get("payment_method", ""),
            "description": p.get("description", ""),
            "check_number": p.get("check_number", ""),
            "source": p.get("source", "manual"),
            "txn_id": p.get("txn_id", ""),
            "created_at": p.get("created_at", "").isoformat() if isinstance(p.get("created_at"), datetime) else "",
        })

    # Totals
    total_amount = sum(p["amount"] for p in result)

    return {
        "payments": result,
        "total": total,
        "total_amount": round(total_amount, 2),
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
        "year": year,
    }


@payroll_router.post("/admin/bookkeeping/worker-payments")
async def create_worker_payment(request: Request):
    """Register a manual payment to a worker"""
    await _auth_admin(request)
    data = await request.json()

    worker_id = data.get("worker_id", "")
    if not worker_id:
        raise HTTPException(status_code=400, detail="worker_id requerido")

    worker = await _db.bk_workers.find_one({"_id": ObjectId(worker_id)})
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")

    # Get business name
    biz_name = ""
    biz_id = worker.get("business_id", "")
    if biz_id:
        biz = await _db.bk_businesses.find_one({"id": biz_id})
        if biz:
            biz_name = biz.get("business_name", "")

    payment_date_str = data.get("payment_date", datetime.utcnow().strftime("%Y-%m-%d"))
    try:
        payment_date = datetime.strptime(payment_date_str, "%Y-%m-%d")
    except ValueError:
        payment_date = datetime.utcnow()

    payment = {
        "worker_id": worker_id,
        "worker_name": f"{worker.get('first_name', '')} {worker.get('last_name', '')}".strip(),
        "business_id": biz_id,
        "business_name": biz_name,
        "amount": amount,
        "payment_date": payment_date,
        "payment_method": data.get("payment_method", "check"),
        "description": data.get("description", "").strip(),
        "check_number": data.get("check_number", "").strip(),
        "source": "manual",
        "txn_id": "",
        "created_at": datetime.utcnow(),
    }

    result = await _db.bk_worker_payments.insert_one(payment)

    logger.info(f"💰 Payment registered: ${amount:.2f} to {payment['worker_name']}")

    return {
        "success": True,
        "id": str(result.inserted_id),
        "message": f"Pago de ${amount:,.2f} registrado para {payment['worker_name']}"
    }


@payroll_router.delete("/admin/bookkeeping/worker-payments/{payment_id}")
async def delete_worker_payment(payment_id: str, request: Request):
    """Delete a manual payment"""
    await _auth_admin(request)
    result = await _db.bk_worker_payments.delete_one({"_id": ObjectId(payment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"success": True, "message": "Pago eliminado"}


# ═══════════════════════════════════════════════════════════════════════
# LINK BANK TRANSACTION TO WORKER
# ═══════════════════════════════════════════════════════════════════════

@payroll_router.post("/admin/bookkeeping/worker-payments/link-txn")
async def link_transaction_to_worker(request: Request):
    """Link an existing bank transaction to a worker as a payment record"""
    await _auth_admin(request)
    data = await request.json()

    worker_id = data.get("worker_id", "")
    txn_id = data.get("txn_id", "")

    if not worker_id or not txn_id:
        raise HTTPException(status_code=400, detail="worker_id y txn_id requeridos")

    worker = await _db.bk_workers.find_one({"_id": ObjectId(worker_id)})
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    txn = await _db.bk_transactions.find_one({"id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    # Check if already linked
    existing = await _db.bk_worker_payments.find_one({"txn_id": txn_id})
    if existing:
        raise HTTPException(status_code=400, detail="Esta transacción ya está vinculada a un trabajador")

    biz_name = ""
    if worker.get("business_id"):
        biz = await _db.bk_businesses.find_one({"id": worker["business_id"]})
        if biz:
            biz_name = biz.get("business_name", "")

    payment = {
        "worker_id": worker_id,
        "worker_name": f"{worker.get('first_name', '')} {worker.get('last_name', '')}".strip(),
        "business_id": worker.get("business_id", ""),
        "business_name": biz_name,
        "amount": abs(txn.get("amount", 0)),
        "payment_date": txn.get("date", datetime.utcnow()),
        "payment_method": "bank_transfer",
        "description": txn.get("description", txn.get("name", "")),
        "check_number": "",
        "source": "plaid",
        "txn_id": txn_id,
        "created_at": datetime.utcnow(),
    }

    result = await _db.bk_worker_payments.insert_one(payment)

    # Also update the transaction to mark it as linked
    await _db.bk_transactions.update_one(
        {"id": txn_id},
        {"$set": {"linked_worker_id": worker_id, "linked_worker_name": payment["worker_name"]}}
    )

    logger.info(f"🔗 Linked txn {txn_id} to worker {worker_id}")

    return {
        "success": True,
        "id": str(result.inserted_id),
        "message": f"Transacción vinculada a {payment['worker_name']}"
    }



@payroll_router.get("/admin/bookkeeping/payroll/unlinked-transactions")
async def get_unlinked_transactions(
    request: Request,
    business_id: str = "",
    search: str = "",
    year: int = 0,
    limit: int = 50,
):
    """Get expense transactions that haven't been linked to a worker"""
    await _auth_admin(request)

    if year == 0:
        year = datetime.utcnow().year

    query = {
        "type": "expense",
        "date": {
            "$gte": datetime(year, 1, 1),
            "$lte": datetime(year, 12, 31, 23, 59, 59)
        },
        "$or": [
            {"linked_worker_id": {"$exists": False}},
            {"linked_worker_id": ""},
            {"linked_worker_id": None},
        ]
    }
    if business_id:
        query["business_id"] = business_id
    if search:
        query["$and"] = [
            {"$or": query.pop("$or")},
            {"$or": [
                {"description": {"$regex": search, "$options": "i"}},
                {"vendor": {"$regex": search, "$options": "i"}},
            ]}
        ]

    total = await _db.bk_transactions.count_documents(query)
    txns = await _db.bk_transactions.find(query).sort("date", -1).limit(limit).to_list(limit)

    result = []
    for t in txns:
        result.append({
            "id": t.get("id", str(t["_id"])),
            "description": t.get("description", t.get("name", "")),
            "vendor": t.get("vendor", ""),
            "amount": abs(t.get("amount", 0)),
            "date": t.get("date").strftime("%Y-%m-%d") if isinstance(t.get("date"), datetime) else "",
            "category": t.get("category", ""),
            "business_id": t.get("business_id", ""),
            "source": t.get("source", "manual"),
        })

    return {"transactions": result, "total": total}


# ═══════════════════════════════════════════════════════════════════════
# 1099 SUGGESTIONS & GENERATION
# ═══════════════════════════════════════════════════════════════════════

@payroll_router.get("/admin/bookkeeping/payroll/1099-suggestions")
async def get_1099_suggestions(
    request: Request,
    business_id: str = "",
    year: int = 0,
):
    """Get 1099 filing suggestions based on worker payments"""
    await _auth_admin(request)

    if year == 0:
        year = datetime.utcnow().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    # Get all contractors
    worker_query = {"worker_type": "contractor", "status": "active"}
    if business_id:
        worker_query["business_id"] = business_id

    contractors = await _db.bk_workers.find(worker_query).to_list(500)

    suggestions = []
    total_1099_amount = 0
    needs_filing = 0
    near_threshold = 0

    for c in contractors:
        wid = str(c["_id"])

        # Aggregate payments for this year
        payment_agg = await _db.bk_worker_payments.aggregate([
            {"$match": {
                "worker_id": wid,
                "payment_date": {"$gte": year_start, "$lte": year_end}
            }},
            {"$group": {
                "_id": None,
                "total_paid": {"$sum": "$amount"},
                "payment_count": {"$sum": 1},
                "first_payment": {"$min": "$payment_date"},
                "last_payment": {"$max": "$payment_date"},
            }}
        ]).to_list(1)

        total_paid = payment_agg[0]["total_paid"] if payment_agg else 0
        payment_count = payment_agg[0]["payment_count"] if payment_agg else 0
        first_payment = payment_agg[0]["first_payment"] if payment_agg else None
        last_payment = payment_agg[0]["last_payment"] if payment_agg else None

        # Determine status
        if total_paid >= 600:
            status = "requires_1099"
            needs_filing += 1
            total_1099_amount += total_paid
        elif total_paid >= 400:
            status = "near_threshold"
            near_threshold += 1
        elif total_paid > 0:
            status = "below_threshold"
        else:
            status = "no_payments"

        # Check if already has IRIS form
        iris_form = None
        if c.get("iris_recipient_id"):
            iris_form = await _db.iris_1099_forms.find_one({
                "recipient_id": c["iris_recipient_id"],
                "tax_year": str(year),
                "form_type": "1099-NEC"
            })

        # Get business name
        biz_name = ""
        if c.get("business_id"):
            biz = await _db.bk_businesses.find_one({"id": c["business_id"]})
            if biz:
                biz_name = biz.get("business_name", "")

        suggestions.append({
            "worker_id": wid,
            "first_name": c.get("first_name", ""),
            "last_name": c.get("last_name", ""),
            "business_name": c.get("business_name", ""),
            "parent_business_name": biz_name,
            "tin_last4": c.get("tin_last4", "****"),
            "tin_type": c.get("tin_type", "SSN"),
            "has_tin": bool(c.get("tin_encrypted")),
            "total_paid": round(total_paid, 2),
            "payment_count": payment_count,
            "first_payment": first_payment.strftime("%Y-%m-%d") if first_payment else "",
            "last_payment": last_payment.strftime("%Y-%m-%d") if last_payment else "",
            "status": status,
            "iris_recipient_id": c.get("iris_recipient_id", ""),
            "iris_form_id": str(iris_form["_id"]) if iris_form else "",
            "iris_form_status": iris_form.get("status", "") if iris_form else "",
            "business_id": c.get("business_id", ""),
        })

    # Sort: requires_1099 first, then near_threshold, then rest
    priority = {"requires_1099": 0, "near_threshold": 1, "below_threshold": 2, "no_payments": 3}
    suggestions.sort(key=lambda x: (priority.get(x["status"], 9), -x["total_paid"]))

    return {
        "year": year,
        "suggestions": suggestions,
        "summary": {
            "total_contractors": len(contractors),
            "needs_filing": needs_filing,
            "near_threshold": near_threshold,
            "total_1099_amount": round(total_1099_amount, 2),
            "filing_deadline": f"{year + 1}-01-31",
        }
    }


@payroll_router.post("/admin/bookkeeping/payroll/generate-1099")
async def generate_1099_for_worker(request: Request):
    """
    Generate a 1099-NEC for a worker by creating/updating an IRIS recipient
    and creating the 1099 form. Bridges bookkeeping → IRIS.
    """
    await _auth_admin(request)
    data = await request.json()

    worker_id = data.get("worker_id", "")
    tax_year = data.get("tax_year", str(datetime.utcnow().year))

    worker = await _db.bk_workers.find_one({"_id": ObjectId(worker_id)})
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    if worker.get("worker_type") != "contractor":
        raise HTTPException(status_code=400, detail="Solo contratistas pueden recibir 1099-NEC")

    if not worker.get("tin_encrypted"):
        raise HTTPException(status_code=400, detail="El trabajador necesita un SSN/EIN para generar 1099")

    # Calculate total paid in the tax year
    year_start = datetime(int(tax_year), 1, 1)
    year_end = datetime(int(tax_year), 12, 31, 23, 59, 59)

    payment_agg = await _db.bk_worker_payments.aggregate([
        {"$match": {
            "worker_id": worker_id,
            "payment_date": {"$gte": year_start, "$lte": year_end}
        }},
        {"$group": {"_id": None, "total_paid": {"$sum": "$amount"}}}
    ]).to_list(1)

    total_paid = payment_agg[0]["total_paid"] if payment_agg else 0

    if total_paid < 600:
        raise HTTPException(status_code=400, detail=f"Total pagado (${total_paid:,.2f}) es menor a $600. No se requiere 1099-NEC.")

    # Get business info for payer
    payer_info = {}
    if worker.get("business_id"):
        biz = await _db.bk_businesses.find_one({"id": worker["business_id"]})
        if biz:
            payer_info = {
                "name": biz.get("business_name", ""),
                "ein": biz.get("ein", ""),
                "address": biz.get("address", ""),
                "city": biz.get("city", ""),
                "state": biz.get("state", ""),
                "zip": biz.get("zip_code", ""),
                "phone": biz.get("phone", ""),
            }

    # Step 1: Create or update IRIS recipient
    full_name = f"{worker.get('first_name', '')} {worker.get('last_name', '')}".strip()

    if worker.get("iris_recipient_id"):
        # Update existing recipient
        try:
            await _db.iris_recipients.update_one(
                {"_id": ObjectId(worker["iris_recipient_id"])},
                {"$set": {
                    "name": full_name,
                    "business_name": worker.get("business_name", ""),
                    "tin_type": worker.get("tin_type", "SSN"),
                    "tin_encrypted": worker.get("tin_encrypted", ""),
                    "tin_last4": worker.get("tin_last4", ""),
                    "address": worker.get("address", ""),
                    "city": worker.get("city", ""),
                    "state": worker.get("state", ""),
                    "zip": worker.get("zip_code", ""),
                    "email": worker.get("email", ""),
                    "phone": worker.get("phone", ""),
                    "updated_at": datetime.utcnow(),
                }}
            )
            iris_recipient_id = worker["iris_recipient_id"]
            logger.info(f"📋 Updated IRIS recipient {iris_recipient_id}")
        except Exception as e:
            logger.error(f"Error updating IRIS recipient: {e}")
            raise HTTPException(status_code=500, detail=f"Error actualizando recipiente IRIS: {e}")
    else:
        # Create new IRIS recipient
        recipient_doc = {
            "name": full_name,
            "business_name": worker.get("business_name", ""),
            "tin_type": worker.get("tin_type", "SSN"),
            "tin_encrypted": worker.get("tin_encrypted", ""),
            "tin_last4": worker.get("tin_last4", ""),
            "address": worker.get("address", ""),
            "city": worker.get("city", ""),
            "state": worker.get("state", ""),
            "zip": worker.get("zip_code", ""),
            "email": worker.get("email", ""),
            "phone": worker.get("phone", ""),
            "forms_count": 0,
            "source": "bookkeeping_payroll",
            "worker_id": worker_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        r = await _db.iris_recipients.insert_one(recipient_doc)
        iris_recipient_id = str(r.inserted_id)

        # Link back to worker
        await _db.bk_workers.update_one(
            {"_id": ObjectId(worker_id)},
            {"$set": {"iris_recipient_id": iris_recipient_id}}
        )
        logger.info(f"📋 Created IRIS recipient {iris_recipient_id} for worker {worker_id}")

    # Step 2: Check if a 1099-NEC already exists for this recipient + year
    existing_form = await _db.iris_1099_forms.find_one({
        "recipient_id": iris_recipient_id,
        "tax_year": tax_year,
        "form_type": "1099-NEC",
    })

    if existing_form:
        # Update existing form amount
        await _db.iris_1099_forms.update_one(
            {"_id": existing_form["_id"]},
            {"$set": {
                "amounts.box1_nonemployee_compensation": round(total_paid, 2),
                "total_amount": round(total_paid, 2),
                "payer_info": payer_info if payer_info else existing_form.get("payer_info", {}),
                "status": "draft" if existing_form["status"] in ["draft", "rejected"] else existing_form["status"],
                "updated_at": datetime.utcnow(),
            }}
        )
        form_id = str(existing_form["_id"])
        logger.info(f"📋 Updated existing 1099-NEC form {form_id} to ${total_paid:,.2f}")
        action = "updated"
    else:
        # Create new 1099-NEC form
        from iris_service import TRANSMITTER_INFO
        form_doc = {
            "recipient_id": iris_recipient_id,
            "recipient_name": full_name,
            "recipient_tin_last4": worker.get("tin_last4", ""),
            "form_type": "1099-NEC",
            "tax_year": tax_year,
            "status": "draft",
            "amounts": {
                "box1_nonemployee_compensation": round(total_paid, 2),
                "box4_federal_tax_withheld": 0.0,
            },
            "total_amount": round(total_paid, 2),
            "direct_sales_indicator": False,
            "payer_info": payer_info if payer_info else {
                "name": TRANSMITTER_INFO["legal_name"],
                "ein": TRANSMITTER_INFO["ein_display"],
                "address": TRANSMITTER_INFO["address"],
                "city": TRANSMITTER_INFO["city"],
                "state": TRANSMITTER_INFO["state"],
                "zip": TRANSMITTER_INFO["zip"],
                "phone": TRANSMITTER_INFO["phone"],
            },
            "source": "bookkeeping_payroll",
            "worker_id": worker_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        r = await _db.iris_1099_forms.insert_one(form_doc)
        form_id = str(r.inserted_id)

        # Update recipient forms count
        await _db.iris_recipients.update_one(
            {"_id": ObjectId(iris_recipient_id)},
            {"$inc": {"forms_count": 1}}
        )
        logger.info(f"📋 Created 1099-NEC form {form_id} for ${total_paid:,.2f}")
        action = "created"

    return {
        "success": True,
        "action": action,
        "form_id": form_id,
        "iris_recipient_id": iris_recipient_id,
        "total_amount": round(total_paid, 2),
        "tax_year": tax_year,
        "worker_name": full_name,
        "message": f"1099-NEC {'actualizado' if action == 'updated' else 'generado'} para {full_name} — ${total_paid:,.2f}"
    }


# ═══════════════════════════════════════════════════════════════════════
# PAYROLL DASHBOARD / SUMMARY
# ═══════════════════════════════════════════════════════════════════════

@payroll_router.get("/admin/bookkeeping/payroll/summary")
async def get_payroll_summary(
    request: Request,
    business_id: str = "",
    year: int = 0,
):
    """Get payroll summary statistics"""
    await _auth_admin(request)

    if year == 0:
        year = datetime.utcnow().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    worker_query = {}
    if business_id:
        worker_query["business_id"] = business_id

    total_workers = await _db.bk_workers.count_documents(worker_query)
    total_contractors = await _db.bk_workers.count_documents({**worker_query, "worker_type": "contractor"})
    total_employees = await _db.bk_workers.count_documents({**worker_query, "worker_type": "employee"})
    active_workers = await _db.bk_workers.count_documents({**worker_query, "status": "active"})

    # Total payments this year
    payment_query = {"payment_date": {"$gte": year_start, "$lte": year_end}}
    if business_id:
        payment_query["business_id"] = business_id

    payment_agg = await _db.bk_worker_payments.aggregate([
        {"$match": payment_query},
        {"$group": {
            "_id": None,
            "total_paid": {"$sum": "$amount"},
            "total_payments": {"$sum": 1}
        }}
    ]).to_list(1)

    total_paid = payment_agg[0]["total_paid"] if payment_agg else 0
    total_payments = payment_agg[0]["total_payments"] if payment_agg else 0

    # Payment by method
    method_agg = await _db.bk_worker_payments.aggregate([
        {"$match": payment_query},
        {"$group": {
            "_id": "$payment_method",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(20)

    by_method = {m["_id"]: {"total": round(m["total"], 2), "count": m["count"]} for m in method_agg}

    # Count needing 1099
    contractors = await _db.bk_workers.find({**worker_query, "worker_type": "contractor"}).to_list(500)
    needs_1099 = 0
    for c in contractors:
        wid = str(c["_id"])
        p = await _db.bk_worker_payments.aggregate([
            {"$match": {"worker_id": wid, "payment_date": {"$gte": year_start, "$lte": year_end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        if p and p[0]["total"] >= 600:
            needs_1099 += 1

    return {
        "year": year,
        "total_workers": total_workers,
        "total_contractors": total_contractors,
        "total_employees": total_employees,
        "active_workers": active_workers,
        "total_paid": round(total_paid, 2),
        "total_payments": total_payments,
        "by_payment_method": by_method,
        "needs_1099": needs_1099,
        "filing_deadline": f"{year + 1}-01-31",
    }
