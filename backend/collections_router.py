"""
═══════════════════════════════════════════════════════════════════════════════
 Collections & Data Furnishing Router — Ross Lending Solutions LLC
 Manages delinquent loan workflows, collection actions, payment plans,
 and Metro 2 format export for credit bureau reporting.
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
import csv
import io
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Body
from fastapi.responses import StreamingResponse, Response
from bson import ObjectId
from metro2_generator import (
    generate_metro2_file, get_metro2_status,
    ACCOUNT_TYPE as METRO2_ACCOUNT_TYPE,
)

logger = logging.getLogger(__name__)

collections_router = APIRouter()

_db = None
_get_current_user = None

COLLECTION_ACTIONS_COL = "collection_actions"
PAYMENT_PLANS_COL = "payment_plans"
METRO2_EXPORTS_COL = "metro2_exports"


def init_collections(db_instance, get_user_func):
    global _db, _get_current_user
    _db = db_instance
    _get_current_user = get_user_func
    logger.info("Collections & Data Furnishing Router initialized")


async def _auth_admin(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(403, "Acceso denegado")
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECTIONS DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@collections_router.get("/admin/collections/dashboard")
async def collections_dashboard(request: Request, license_type: str = "regulated"):
    """Get comprehensive collections dashboard with aging analysis."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    # Select collection based on license type
    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    # Get all delinquent + active loans
    all_loans = []
    async for loan in db[loan_collection].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        loan["_id"] = str(loan["_id"])
        all_loans.append(loan)

    # Aging buckets
    buckets = {
        "current": {"count": 0, "balance": 0},
        "1_30": {"count": 0, "balance": 0},
        "31_60": {"count": 0, "balance": 0},
        "61_90": {"count": 0, "balance": 0},
        "91_120": {"count": 0, "balance": 0},
        "120_plus": {"count": 0, "balance": 0},
    }

    delinquent_loans = []
    total_portfolio = 0

    for loan in all_loans:
        balance = loan.get("balance", 0)
        total_portfolio += balance

        if loan.get("status") != "delinquent":
            buckets["current"]["count"] += 1
            buckets["current"]["balance"] += balance
            continue

        # Calculate days overdue
        npd = loan.get("next_payment_date", "")
        days_overdue = 0
        if npd:
            try:
                npd_dt = datetime.fromisoformat(str(npd).replace("Z", ""))
                days_overdue = max(0, (now - npd_dt).days)
            except Exception:
                pass

        loan["days_overdue"] = days_overdue

        if days_overdue <= 30:
            bucket_key = "1_30"
        elif days_overdue <= 60:
            bucket_key = "31_60"
        elif days_overdue <= 90:
            bucket_key = "61_90"
        elif days_overdue <= 120:
            bucket_key = "91_120"
        else:
            bucket_key = "120_plus"

        buckets[bucket_key]["count"] += 1
        buckets[bucket_key]["balance"] += balance
        delinquent_loans.append(loan)

    # Calculate percentages
    for key, b in buckets.items():
        b["pct"] = round(b["balance"] / max(total_portfolio, 1) * 100, 1)

    total_delinquent = sum(b["balance"] for k, b in buckets.items() if k != "current")
    total_delinquent_count = sum(b["count"] for k, b in buckets.items() if k != "current")

    # Recent collection actions
    recent_actions_count = await db[COLLECTION_ACTIONS_COL].count_documents({
        "created_at": {"$gte": (now - timedelta(days=30)).isoformat()}
    })

    # Active payment plans
    active_plans = await db[PAYMENT_PLANS_COL].count_documents({"status": "active"})

    # Metro 2 exports
    last_export = await db[METRO2_EXPORTS_COL].find_one({}, sort=[("created_at", -1)])

    return {
        "total_portfolio_balance": total_portfolio,
        "total_active_loans": len(all_loans),
        "total_delinquent_balance": total_delinquent,
        "total_delinquent_count": total_delinquent_count,
        "delinquency_rate": round(total_delinquent_count / max(len(all_loans), 1) * 100, 1),
        "aging_buckets": buckets,
        "collection_actions_30d": recent_actions_count,
        "active_payment_plans": active_plans,
        "last_metro2_export": last_export.get("created_at") if last_export else None,
        "delinquent_loans": sorted(delinquent_loans, key=lambda x: x.get("days_overdue", 0), reverse=True)[:50],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DELINQUENT LOANS LIST
# ═══════════════════════════════════════════════════════════════════════════════

@collections_router.get("/admin/collections/delinquent")
async def list_delinquent_loans(
    request: Request,
    search: str = Query(""),
    bucket: str = Query(""),
    sort_by: str = Query("days_overdue"),
    limit: int = Query(50, ge=1, le=200),
    license_type: str = Query("regulated"),
):
    """List delinquent loans with aging info and action counts. Optimized with batch queries."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    query = {"status": "delinquent"}
    if search:
        query["$or"] = [
            {"client_name": {"$regex": search, "$options": "i"}},
            {"loan_number": {"$regex": search, "$options": "i"}},
            {"client_phone": {"$regex": search, "$options": "i"}},
        ]

    raw_loans = []
    async for loan in db[loan_collection].find(query).sort("next_payment_date", 1).limit(limit):
        loan["_id"] = str(loan["_id"])
        npd = loan.get("next_payment_date", "")
        days_overdue = 0
        if npd:
            try:
                days_overdue = max(0, (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days)
            except Exception:
                pass
        loan["days_overdue"] = days_overdue
        if days_overdue <= 30:
            loan["aging_bucket"] = "1_30"
        elif days_overdue <= 60:
            loan["aging_bucket"] = "31_60"
        elif days_overdue <= 90:
            loan["aging_bucket"] = "61_90"
        elif days_overdue <= 120:
            loan["aging_bucket"] = "91_120"
        else:
            loan["aging_bucket"] = "120_plus"
        if bucket and loan["aging_bucket"] != bucket:
            continue
        raw_loans.append(loan)

    # BATCH: Get action counts + last actions for all loans in 2 aggregate queries
    loan_ids = [l["_id"] for l in raw_loans]

    # Batch action counts
    action_counts = {}
    if loan_ids:
        pipeline = [
            {"$match": {"loan_id": {"$in": loan_ids}}},
            {"$group": {"_id": "$loan_id", "count": {"$sum": 1}}},
        ]
        async for doc in db[COLLECTION_ACTIONS_COL].aggregate(pipeline):
            action_counts[doc["_id"]] = doc["count"]

    # Batch last actions
    last_actions = {}
    if loan_ids:
        pipeline = [
            {"$match": {"loan_id": {"$in": loan_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$loan_id", "action_type": {"$first": "$action_type"}, "created_at": {"$first": "$created_at"}, "result": {"$first": "$result"}}},
        ]
        async for doc in db[COLLECTION_ACTIONS_COL].aggregate(pipeline):
            last_actions[doc["_id"]] = {"type": doc.get("action_type", ""), "date": doc.get("created_at", ""), "result": doc.get("result", "")}

    # Batch payment plan checks
    active_plans = set()
    if loan_ids:
        async for doc in db[PAYMENT_PLANS_COL].find({"loan_id": {"$in": loan_ids}, "status": "active"}, {"loan_id": 1}):
            active_plans.add(doc.get("loan_id"))

    # Assemble results
    for loan in raw_loans:
        lid = loan["_id"]
        loan["action_count"] = action_counts.get(lid, 0)
        loan["has_payment_plan"] = lid in active_plans
        loan["last_action"] = last_actions.get(lid)

    # Sort
    if sort_by == "days_overdue":
        raw_loans.sort(key=lambda x: x.get("days_overdue", 0), reverse=True)
    elif sort_by == "balance":
        raw_loans.sort(key=lambda x: x.get("balance", 0), reverse=True)

    return {"loans": raw_loans, "total": len(raw_loans)}


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECTION ACTIONS (calls, letters, visits, etc.)
# ═══════════════════════════════════════════════════════════════════════════════

@collections_router.post("/admin/collections/action")
async def record_collection_action(request: Request, body: dict = Body(...)):
    """Record a collection action (call, letter, email, visit, etc.)."""
    admin = await _auth_admin(request)
    db = _db

    loan_id = body.get("loan_id")
    action_type = body.get("action_type")  # call, letter, email, visit, legal_notice, skip_trace
    result = body.get("result", "")  # contacted, no_answer, voicemail, promise_to_pay, refused, wrong_number
    notes = body.get("notes", "")
    promise_date = body.get("promise_date")
    promise_amount = body.get("promise_amount")
    next_follow_up = body.get("next_follow_up")

    if not loan_id or not action_type:
        raise HTTPException(400, "loan_id y action_type son requeridos")

    valid_types = ["call", "sms", "email", "letter", "visit", "legal_notice", "skip_trace", "payment_plan", "escalation", "other"]
    if action_type not in valid_types:
        raise HTTPException(400, f"action_type inválido. Opciones: {', '.join(valid_types)}")

    # Get loan info
    try:
        loan = await db["regulated_loans"].find_one({"_id": ObjectId(loan_id)})
    except Exception:
        loan = await db["regulated_loans"].find_one({"_id": loan_id})

    record = {
        "loan_id": loan_id,
        "loan_number": loan.get("loan_number", "") if loan else "",
        "client_name": loan.get("client_name", "") if loan else "",
        "client_phone": loan.get("client_phone", "") if loan else "",
        "action_type": action_type,
        "result": result,
        "notes": notes,
        "promise_date": promise_date,
        "promise_amount": promise_amount,
        "next_follow_up": next_follow_up,
        "performed_by": admin.get("email", ""),
        "created_at": datetime.utcnow().isoformat(),
    }

    await db[COLLECTION_ACTIONS_COL].insert_one(record)

    # Audit trail
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(
            user_id=str(admin.get("id")),
            user_name=admin.get("email", ""),
            action=f"collection_{action_type}",
            module="cobros",
            severity="info",
            details={"loan_id": loan_id, "result": result},
        )
    except Exception:
        pass

    return {"success": True, "message": "Acción registrada exitosamente"}


@collections_router.get("/admin/collections/actions/{loan_id}")
async def get_collection_actions(request: Request, loan_id: str, limit: int = Query(50)):
    """Get collection action history for a specific loan."""
    await _auth_admin(request)
    db = _db

    actions = []
    async for doc in db[COLLECTION_ACTIONS_COL].find({"loan_id": loan_id}).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        actions.append(doc)

    return {"actions": actions, "total": len(actions)}


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT PLANS
# ═══════════════════════════════════════════════════════════════════════════════

@collections_router.post("/admin/collections/payment-plan")
async def create_payment_plan(request: Request, body: dict = Body(...)):
    """Create a payment plan for a delinquent loan."""
    admin = await _auth_admin(request)
    db = _db

    loan_id = body.get("loan_id")
    plan_amount = body.get("plan_amount", 0)
    frequency = body.get("frequency", "monthly")  # weekly, biweekly, monthly
    num_payments = body.get("num_payments", 0)
    start_date = body.get("start_date")
    notes = body.get("notes", "")

    if not loan_id or plan_amount <= 0 or num_payments <= 0:
        raise HTTPException(400, "loan_id, plan_amount y num_payments son requeridos")

    # Get loan
    try:
        loan = await db["regulated_loans"].find_one({"_id": ObjectId(loan_id)})
    except Exception:
        loan = await db["regulated_loans"].find_one({"_id": loan_id})

    if not loan:
        raise HTTPException(404, "Préstamo no encontrado")

    # Generate payment schedule
    schedule = []
    freq_days = {"weekly": 7, "biweekly": 14, "monthly": 30}
    interval = freq_days.get(frequency, 30)
    current_date = datetime.fromisoformat(start_date) if start_date else datetime.utcnow()

    for i in range(num_payments):
        pay_date = current_date + timedelta(days=interval * i)
        schedule.append({
            "payment_number": i + 1,
            "due_date": pay_date.strftime("%Y-%m-%d"),
            "amount": round(plan_amount, 2),
            "status": "pending",
        })

    plan = {
        "loan_id": loan_id,
        "loan_number": loan.get("loan_number", ""),
        "client_name": loan.get("client_name", ""),
        "original_balance": loan.get("balance", 0),
        "plan_amount_per_payment": round(plan_amount, 2),
        "total_plan_amount": round(plan_amount * num_payments, 2),
        "frequency": frequency,
        "num_payments": num_payments,
        "start_date": start_date or datetime.utcnow().strftime("%Y-%m-%d"),
        "schedule": schedule,
        "status": "active",
        "payments_made": 0,
        "total_paid": 0,
        "notes": notes,
        "created_by": admin.get("email", ""),
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await db[PAYMENT_PLANS_COL].insert_one(plan)
    plan["_id"] = str(result.inserted_id)

    # Record as collection action
    await db[COLLECTION_ACTIONS_COL].insert_one({
        "loan_id": loan_id,
        "loan_number": loan.get("loan_number", ""),
        "client_name": loan.get("client_name", ""),
        "action_type": "payment_plan",
        "result": "plan_created",
        "notes": f"Plan de pago creado: {num_payments}x {plan_amount:.2f} ({frequency})",
        "performed_by": admin.get("email", ""),
        "created_at": datetime.utcnow().isoformat(),
    })

    return {"success": True, "plan": plan}


@collections_router.get("/admin/collections/payment-plans")
async def list_payment_plans(
    request: Request,
    status: str = Query(""),
    limit: int = Query(50),
):
    """List all payment plans."""
    await _auth_admin(request)
    db = _db

    query = {}
    if status:
        query["status"] = status

    plans = []
    async for doc in db[PAYMENT_PLANS_COL].find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        plans.append(doc)

    return {"plans": plans, "total": len(plans)}


@collections_router.put("/admin/collections/payment-plan/{plan_id}/payment")
async def record_plan_payment(request: Request, plan_id: str, body: dict = Body(...)):
    """Record a payment made on a payment plan."""
    admin = await _auth_admin(request)
    db = _db

    payment_number = body.get("payment_number")
    amount = body.get("amount", 0)

    try:
        plan = await db[PAYMENT_PLANS_COL].find_one({"_id": ObjectId(plan_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if not plan:
        raise HTTPException(404, "Plan de pago no encontrado")

    # Update schedule
    schedule = plan.get("schedule", [])
    for s in schedule:
        if s["payment_number"] == payment_number:
            s["status"] = "paid"
            s["paid_date"] = datetime.utcnow().strftime("%Y-%m-%d")
            s["paid_amount"] = amount
            break

    payments_made = sum(1 for s in schedule if s["status"] == "paid")
    total_paid = sum(s.get("paid_amount", 0) for s in schedule if s["status"] == "paid")

    update = {
        "schedule": schedule,
        "payments_made": payments_made,
        "total_paid": total_paid,
    }
    if payments_made >= len(schedule):
        update["status"] = "completed"

    await db[PAYMENT_PLANS_COL].update_one({"_id": ObjectId(plan_id)}, {"$set": update})

    return {"success": True, "payments_made": payments_made, "total_paid": total_paid}


# ═══════════════════════════════════════════════════════════════════════════════
# METRO 2 DATA FURNISHING (CDIA-Compliant)
# ═══════════════════════════════════════════════════════════════════════════════


async def _enrich_client_data(db, loans: list) -> dict:
    """
    Build a client_data_map by looking up SSN, address, DOB from
    client_banking and season_clients collections. Keyed by loan['_id'].
    """
    client_map = {}
    for loan in loans:
        lid = str(loan.get("_id", ""))
        data = {
            "ssn": loan.get("client_ssn", ""),
            "dob": loan.get("client_dob", ""),
            "address": loan.get("client_address", ""),
            "city": loan.get("client_city", ""),
            "state": loan.get("client_state", "TX"),
            "zip": loan.get("client_zip", ""),
            "phone": loan.get("client_phone", ""),
        }

        # Try to enrich from client_banking
        name = loan.get("client_name", "")
        email = loan.get("client_email", "")
        phone = loan.get("client_phone", "")

        lookup_or = []
        if email:
            lookup_or.append({"email": {"$regex": f"^{email}$", "$options": "i"}})
        if name:
            parts = name.strip().split()
            if len(parts) >= 2:
                lookup_or.append({
                    "first_name": {"$regex": f"^{parts[0]}$", "$options": "i"},
                    "last_name": {"$regex": f"^{parts[-1]}$", "$options": "i"},
                })

        if lookup_or:
            banking = await db["client_banking"].find_one({"$or": lookup_or})
            if banking:
                if not data["ssn"] and banking.get("ssn"):
                    data["ssn"] = banking["ssn"]
                if not data["address"] and banking.get("address"):
                    data["address"] = banking["address"]
                if not data["city"] and banking.get("city"):
                    data["city"] = banking["city"]
                if not data["state"] and banking.get("state"):
                    data["state"] = banking["state"]
                if not data["zip"] and banking.get("zip_code"):
                    data["zip"] = banking["zip_code"]
                if not data["dob"] and banking.get("dob"):
                    data["dob"] = banking["dob"]
                if not data["phone"] and banking.get("phone"):
                    data["phone"] = banking["phone"]

        client_map[lid] = data
    return client_map


@collections_router.get("/admin/collections/metro2/readiness")
async def metro2_readiness_check(request: Request, include_current: bool = Query(False), license_type: str = Query("regulated")):
    """Check data completeness for Metro 2 reporting. Shows which loans are ready and which need data."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    query = {"status": {"$in": ["active", "delinquent", "disbursed", "paid_off"]}}
    if not include_current:
        query["status"] = {"$in": ["delinquent", "paid_off"]}

    loans = []
    async for loan in db[loan_collection].find(query).sort("loan_number", 1):
        loan["_id"] = str(loan["_id"])
        loans.append(loan)

    client_map = await _enrich_client_data(db, loans)

    ready = []
    not_ready = []
    for loan in loans:
        lid = str(loan["_id"])
        client = client_map.get(lid, {})
        ssn_digits = "".join(c for c in str(client.get("ssn", "")) if c.isdigit())
        issues = []

        if len(ssn_digits) != 9:
            issues.append("SSN faltante")
        if not client.get("address"):
            issues.append("Dirección faltante")
        if not client.get("dob"):
            issues.append("Fecha de nacimiento faltante")
        if not loan.get("client_name"):
            issues.append("Nombre faltante")

        record = {
            "loan_id": lid,
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
            "status": loan.get("status", ""),
            "balance": loan.get("balance", 0),
            "has_ssn": len(ssn_digits) == 9,
            "has_address": bool(client.get("address")),
            "has_dob": bool(client.get("dob")),
            "issues": issues,
        }

        if len(issues) == 0:
            ready.append(record)
        else:
            not_ready.append(record)

    return {
        "total_loans": len(loans),
        "ready_count": len(ready),
        "not_ready_count": len(not_ready),
        "readiness_pct": round(len(ready) / max(len(loans), 1) * 100, 1),
        "ready": ready,
        "not_ready": not_ready,
    }


@collections_router.put("/admin/collections/metro2/update-client/{loan_id}")
async def metro2_update_client_data(request: Request, loan_id: str, body: dict = Body(...)):
    """Update client data (SSN, DOB, address) on a loan for Metro 2 compliance."""
    await _auth_admin(request)
    db = _db

    update = {}
    if "ssn" in body:
        ssn = "".join(c for c in str(body["ssn"]) if c.isdigit())
        if len(ssn) != 9:
            raise HTTPException(400, "SSN debe tener exactamente 9 dígitos")
        update["client_ssn"] = ssn
        update["client_ssn_last4"] = ssn[-4:]
    if "dob" in body:
        update["client_dob"] = body["dob"]
    if "address" in body:
        update["client_address"] = body["address"]
    if "city" in body:
        update["client_city"] = body["city"]
    if "state" in body:
        update["client_state"] = body["state"]
    if "zip" in body:
        update["client_zip"] = body["zip"]

    if not update:
        raise HTTPException(400, "No hay datos para actualizar")

    try:
        result = await db["regulated_loans"].update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": update}
        )
        if result.modified_count == 0:
            raise HTTPException(404, "Préstamo no encontrado")
    except Exception as e:
        raise HTTPException(400, str(e))

    return {"success": True, "updated_fields": list(update.keys())}


@collections_router.get("/admin/collections/metro2/preview")
async def metro2_preview(request: Request, include_current: bool = Query(False), license_type: str = Query("regulated")):
    """Preview Metro 2 data before generating the export file."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    query = {"status": {"$in": ["active", "delinquent", "disbursed", "paid_off"]}}
    if not include_current:
        query["status"] = {"$in": ["delinquent", "paid_off"]}

    loans = []
    async for loan in db[loan_collection].find(query).sort("loan_number", 1):
        loan["_id"] = str(loan["_id"])
        loans.append(loan)

    client_map = await _enrich_client_data(db, loans)

    records = []
    for loan in loans:
        lid = str(loan["_id"])
        days_overdue = 0
        if loan.get("status") == "delinquent":
            npd = loan.get("next_payment_date", "")
            if npd:
                try:
                    days_overdue = max(0, (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days)
                except Exception:
                    pass

        metro2_status = get_metro2_status(loan, days_overdue)
        account_type = METRO2_ACCOUNT_TYPE.get(loan.get("loan_type", ""), "48")
        client = client_map.get(lid, {})
        ssn_digits = "".join(c for c in str(client.get("ssn", "")) if c.isdigit())

        records.append({
            "loan_id": lid,
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
            "loan_type": loan.get("loan_type", ""),
            "original_amount": loan.get("amount", 0),
            "current_balance": loan.get("balance", 0),
            "monthly_payment": loan.get("monthly_payment", 0),
            "days_overdue": days_overdue,
            "status": loan.get("status", ""),
            "metro2_account_status": metro2_status["account_status"],
            "metro2_payment_rating": metro2_status["payment_rating"],
            "metro2_status_label": metro2_status["label"],
            "metro2_account_type": account_type,
            "opened_date": loan.get("created_at", "")[:10] if loan.get("created_at") else "",
            "reported_date": now.strftime("%Y-%m-%d"),
            "has_ssn": len(ssn_digits) == 9,
            "has_address": bool(client.get("address")),
            "has_dob": bool(client.get("dob")),
            "is_ready": len(ssn_digits) == 9 and bool(client.get("address")),
        })

    # Stats
    status_breakdown = {}
    for r in records:
        label = r["metro2_status_label"]
        if label not in status_breakdown:
            status_breakdown[label] = {"count": 0, "balance": 0}
        status_breakdown[label]["count"] += 1
        status_breakdown[label]["balance"] += r["current_balance"]

    ready_count = sum(1 for r in records if r["is_ready"])

    return {
        "records": records,
        "total_records": len(records),
        "ready_count": ready_count,
        "not_ready_count": len(records) - ready_count,
        "status_breakdown": status_breakdown,
        "report_date": now.strftime("%Y-%m-%d"),
        "furnisher_name": "Ross Lending Solutions LLC",
        "format": "Metro 2 Fixed-Width (CDIA 426 chars/record)",
    }


@collections_router.post("/admin/collections/metro2/generate")
async def metro2_generate(request: Request, body: dict = Body({})):
    """Generate CDIA-compliant Metro 2 fixed-width format file for credit bureau submission."""
    admin = await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    include_current = body.get("include_current", False)
    output_format = body.get("format", "metro2")  # "metro2" or "csv"
    license_type = body.get("license_type", "regulated")
    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    query = {"status": {"$in": ["active", "delinquent", "disbursed", "paid_off"]}}
    if not include_current:
        query["status"] = {"$in": ["delinquent", "paid_off"]}

    loans = []
    async for loan in db[loan_collection].find(query).sort("loan_number", 1):
        loan["_id"] = str(loan["_id"])
        loans.append(loan)

    client_map = await _enrich_client_data(db, loans)

    if output_format == "metro2":
        # Generate CDIA-compliant Metro 2 fixed-width file
        result = generate_metro2_file(
            loans=loans,
            client_data_map=client_map,
            report_date=now,
        )

        # Save export record
        export_record = {
            "records_count": result["records_count"],
            "ready_count": result["ready_count"],
            "include_current": include_current,
            "generated_by": admin.get("email", ""),
            "created_at": now.isoformat(),
            "format": "metro2_fixed_width",
            "warnings_count": len(result["warnings"]),
            "status_summary": result["status_counts"],
        }
        await db[METRO2_EXPORTS_COL].insert_one(export_record)

        # Audit
        try:
            from audit_trail_router import log_audit_event
            await log_audit_event(
                user_id=str(admin.get("id")),
                user_name=admin.get("email", ""),
                action="metro2_export_generated",
                module="cobros",
                severity="warning",
                details={"records": result["records_count"], "format": "metro2_fixed_width"},
            )
        except Exception:
            pass

        filename = f"Metro2_RLS_{now.strftime('%Y%m%d_%H%M')}.dat"
        return Response(
            content=result["content"],
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    else:
        # CSV fallback format
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["METRO 2 DATA FURNISHING REPORT"])
        writer.writerow(["Furnisher", "Ross Lending Solutions LLC"])
        writer.writerow(["Report Date", now.strftime("%Y-%m-%d")])
        writer.writerow(["Total Accounts", len(loans)])
        writer.writerow(["Generated By", admin.get("email", "")])
        writer.writerow([])

        writer.writerow([
            "Account Number", "Consumer Name", "SSN (Last 4)",
            "Account Type", "Account Status Code", "Payment Rating",
            "Date Opened", "Current Balance", "Original Amount",
            "Monthly Payment", "Days Past Due", "Status Description",
            "Address", "City", "State", "ZIP",
        ])

        for loan in loans:
            lid = str(loan["_id"])
            days_overdue = 0
            if loan.get("status") == "delinquent":
                npd = loan.get("next_payment_date", "")
                if npd:
                    try:
                        days_overdue = max(0, (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days)
                    except Exception:
                        pass

            metro2_status = get_metro2_status(loan, days_overdue)
            account_type = METRO2_ACCOUNT_TYPE.get(loan.get("loan_type", ""), "48")
            client = client_map.get(lid, {})
            ssn = client.get("ssn", "")
            ssn_digits = "".join(c for c in str(ssn) if c.isdigit())
            last4 = ssn_digits[-4:] if len(ssn_digits) >= 4 else "****"

            writer.writerow([
                loan.get("loan_number", ""),
                loan.get("client_name", ""),
                f"***-**-{last4}",
                account_type,
                metro2_status["account_status"],
                metro2_status["payment_rating"],
                loan.get("created_at", "")[:10] if loan.get("created_at") else "",
                f"{loan.get('balance', 0):.2f}",
                f"{loan.get('amount', 0):.2f}",
                f"{loan.get('monthly_payment', 0):.2f}",
                days_overdue if days_overdue > 0 else "",
                metro2_status["label"],
                client.get("address", ""),
                client.get("city", ""),
                client.get("state", ""),
                client.get("zip", ""),
            ])

        # Save export record
        export_record = {
            "records_count": len(loans),
            "include_current": include_current,
            "generated_by": admin.get("email", ""),
            "created_at": now.isoformat(),
            "format": "csv",
            "status_summary": {
                "current": sum(1 for l in loans if l.get("status") in ("active", "disbursed")),
                "delinquent": sum(1 for l in loans if l.get("status") == "delinquent"),
                "paid_off": sum(1 for l in loans if l.get("status") == "paid_off"),
            },
        }
        await db[METRO2_EXPORTS_COL].insert_one(export_record)

        output.seek(0)
        filename = f"Metro2_RLS_{now.strftime('%Y%m%d_%H%M')}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )


@collections_router.get("/admin/collections/metro2/history")
async def metro2_export_history(request: Request, limit: int = Query(20)):
    """Get history of Metro 2 exports."""
    await _auth_admin(request)
    db = _db

    exports = []
    async for doc in db[METRO2_EXPORTS_COL].find().sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        exports.append(doc)

    return {"exports": exports, "total": len(exports)}
