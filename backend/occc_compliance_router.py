"""
OCCC Compliance Modules — Ross Lending Solutions
Backend endpoints for:
1. Audit Log Viewer
2. Trust Account Reconciliation
3. Consumer Complaint Tracking
4. Right to Cancel Tracking
5. Regulated Lender Annual Report
6. Examination Checklist
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header, Depends, Query
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

router = APIRouter()
_db: Optional[AsyncIOMotorDatabase] = None
_auth_admin = None


def init_occc_compliance(db, admin_auth_func):
    global _db, _auth_admin
    _db = db
    _auth_admin = admin_auth_func


async def _get_admin(request: Request):
    token = request.headers.get('Authorization')
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    user = await _auth_admin(token)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ═══════════════════════════════════════════════════════════════
# 1. AUDIT LOG VIEWER
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/audit-log')
async def get_audit_log(
    request: Request,
    action: str = "",
    entity_type: str = "",
    search: str = "",
    limit: int = 100,
    skip: int = 0,
):
    await _get_admin(request)

    query = {}
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = {"$regex": entity_type, "$options": "i"}
    if search:
        query["$or"] = [
            {"details": {"$regex": search, "$options": "i"}},
            {"admin_name": {"$regex": search, "$options": "i"}},
            {"loan_number": {"$regex": search, "$options": "i"}},
        ]

    entries = []

    cursor = _db.loan_audit_log.find(query).sort("created_at", -1).skip(skip).limit(limit)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["source"] = "loan_engine"
        entries.append(doc)

    cab_query = {}
    if search:
        cab_query["$or"] = [
            {"notes.text": {"$regex": search, "$options": "i"}},
            {"client_name": {"$regex": search, "$options": "i"}},
        ]
    cab_cursor = _db.cab_loans.find(
        cab_query,
        {"notes": 1, "client_name": 1, "loan_amount": 1, "status": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).limit(50)
    async for doc in cab_cursor:
        for note in doc.get("notes", []):
            entries.append({
                "_id": str(doc["_id"]),
                "source": "cab",
                "action": "note_added",
                "entity_type": "cab_loan",
                "details": note.get("text", ""),
                "admin_name": note.get("added_by", ""),
                "created_at": note.get("added_at", doc.get("created_at")),
                "loan_amount": doc.get("loan_amount"),
                "client_name": doc.get("client_name"),
            })

    entries.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    total = await _db.loan_audit_log.count_documents(query if query else {})

    return {
        "entries": entries[:limit],
        "total": total,
        "actions": ["origination", "payment", "status_change", "note_added", "contract_generated", "config_change"],
    }


# ═══════════════════════════════════════════════════════════════
# 2. TRUST ACCOUNT RECONCILIATION
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/trust-account')
async def get_trust_reconciliation(request: Request, month: str = "", year: int = 0):
    await _get_admin(request)

    now = datetime.utcnow()
    if not year:
        year = now.year
    if not month:
        month = str(now.month).zfill(2)

    month_int = int(month)
    start = datetime(year, month_int, 1)
    if month_int == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month_int + 1, 1)

    query = {"created_at": {"$gte": start, "$lt": end}}
    entries = []
    cursor = _db.cab_trust_account.find(query).sort("created_at", 1)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "loan_id" in doc:
            doc["loan_id"] = str(doc["loan_id"])
        entries.append(doc)

    deposits = [e for e in entries if e.get("type") == "deposit"]
    remittances = [e for e in entries if e.get("type") == "remittance"]

    total_deposits = sum(e.get("amount", 0) for e in deposits)
    total_remitted = sum(abs(e.get("amount", 0)) for e in remittances)
    pending = total_deposits - total_remitted

    all_pending_cursor = _db.cab_trust_account.find({"trust_status": "pending_remittance"})
    all_pending_amount = 0
    all_pending_count = 0
    async for doc in all_pending_cursor:
        all_pending_amount += doc.get("amount", 0)
        all_pending_count += 1

    unmatched = [e for e in deposits if e.get("trust_status") == "pending_remittance"]

    return {
        "period": f"{month}/{year}",
        "entries": entries,
        "summary": {
            "total_deposits": round(total_deposits, 2),
            "total_remitted": round(total_remitted, 2),
            "net_pending": round(pending, 2),
            "deposit_count": len(deposits),
            "remittance_count": len(remittances),
            "unmatched_count": len(unmatched),
        },
        "overall_trust_balance": {
            "pending_entries": all_pending_count,
            "pending_amount": round(all_pending_amount, 2),
        },
        "reconciliation_status": "balanced" if abs(pending) < 0.01 and all_pending_count == 0 else ("pending" if all_pending_count > 0 else "needs_review"),
    }


@router.post('/api/admin/compliance/trust-account/reconcile')
async def mark_reconciled(request: Request):
    user = await _get_admin(request)
    body = await request.json()
    entry_ids = body.get("entry_ids", [])
    bank_reference = body.get("bank_reference", "")

    updated = 0
    for eid in entry_ids:
        try:
            result = await _db.cab_trust_account.update_one(
                {"_id": ObjectId(eid)},
                {"$set": {
                    "reconciled": True,
                    "reconciled_at": datetime.utcnow(),
                    "reconciled_by": user.get("email", "admin"),
                    "bank_reference": bank_reference,
                }}
            )
            if result.modified_count:
                updated += 1
        except Exception:
            pass

    return {"success": True, "updated": updated}


# ═══════════════════════════════════════════════════════════════
# 3. CONSUMER COMPLAINT TRACKING
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/complaints')
async def list_complaints(request: Request, status: str = "", severity: str = "", search: str = "", limit: int = 100):
    await _get_admin(request)
    query: dict = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    if search:
        query["$or"] = [
            {"client_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"client_email": {"$regex": search, "$options": "i"}},
            {"loan_number": {"$regex": search, "$options": "i"}},
        ]

    complaints = []
    cursor = _db.consumer_complaints.find(query).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Calculate deadline (30 days from creation)
        if doc.get("created_at"):
            from datetime import timedelta
            deadline = doc["created_at"] + timedelta(days=30)
            doc["deadline"] = deadline.isoformat()
            doc["days_remaining"] = max(0, (deadline - datetime.utcnow()).days)
            doc["overdue"] = datetime.utcnow() > deadline and doc.get("status") not in ("resolved", "closed")
        complaints.append(doc)

    stats = {
        "total": await _db.consumer_complaints.count_documents({}),
        "open": await _db.consumer_complaints.count_documents({"status": "open"}),
        "investigating": await _db.consumer_complaints.count_documents({"status": "investigating"}),
        "resolved": await _db.consumer_complaints.count_documents({"status": "resolved"}),
        "closed": await _db.consumer_complaints.count_documents({"status": "closed"}),
    }
    # Count overdue
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    stats["overdue"] = await _db.consumer_complaints.count_documents({
        "created_at": {"$lt": thirty_days_ago},
        "status": {"$nin": ["resolved", "closed"]}
    })

    return {"complaints": complaints, "stats": stats}


@router.get('/api/admin/compliance/complaints/export/csv')
async def export_complaints_csv(request: Request, status: str = ""):
    """Export all complaints as CSV for OCCC examiner."""
    from fastapi.responses import StreamingResponse
    import io

    await _get_admin(request)
    query: dict = {}
    if status:
        query["status"] = status

    complaints = []
    async for doc in _db.consumer_complaints.find(query).sort("created_at", -1):
        complaints.append(doc)

    output = io.StringIO()
    output.write("ROSS LENDING SOLUTIONS LLC — CONSUMER COMPLAINT LOG\n")
    output.write(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
    output.write(f"Total Complaints: {len(complaints)}\n\n")
    output.write("Date,Client Name,Phone,Email,Loan #,Category,Severity,Source,Status,Resolution,Resolution Date,Days to Resolve,Created By\n")

    for c in complaints:
        created = c.get("created_at")
        res_date = c.get("resolution_date")
        days_to_resolve = ""
        if created and res_date:
            days_to_resolve = str((res_date - created).days)
        output.write(
            f"{created.strftime('%Y-%m-%d') if created else ''},"
            f"\"{c.get('client_name', '')}\","
            f"{c.get('client_phone', '')},"
            f"{c.get('client_email', '')},"
            f"{c.get('loan_number', '')},"
            f"{c.get('category', '')},"
            f"{c.get('severity', '')},"
            f"{c.get('source', '')},"
            f"{c.get('status', '')},"
            f"\"{c.get('resolution', '')}\","
            f"{res_date.strftime('%Y-%m-%d') if res_date else ''},"
            f"{days_to_resolve},"
            f"{c.get('created_by', '')}\n"
        )

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=OCCC_Consumer_Complaints_Ross_Lending.csv"}
    )


@router.get('/api/admin/compliance/complaints/{complaint_id}')
async def get_complaint_detail(complaint_id: str, request: Request):
    """Get full complaint detail with timeline."""
    await _get_admin(request)
    doc = await _db.consumer_complaints.find_one({"_id": ObjectId(complaint_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Queja no encontrada")
    doc["_id"] = str(doc["_id"])

    # Calculate deadline
    if doc.get("created_at"):
        from datetime import timedelta
        deadline = doc["created_at"] + timedelta(days=30)
        doc["deadline"] = deadline.isoformat()
        doc["days_remaining"] = max(0, (deadline - datetime.utcnow()).days)
        doc["overdue"] = datetime.utcnow() > deadline and doc.get("status") not in ("resolved", "closed")

    # Build timeline from notes + status_history
    timeline = []
    # Add creation event
    timeline.append({
        "type": "created",
        "text": f"Queja registrada por {doc.get('created_by', 'admin')}",
        "timestamp": doc.get("created_at"),
        "admin": doc.get("created_by", ""),
    })
    # Add notes
    for note in doc.get("notes", []):
        timeline.append({
            "type": "note",
            "text": note.get("text", ""),
            "timestamp": note.get("added_at"),
            "admin": note.get("added_by", ""),
        })
    # Add status changes
    for sc in doc.get("status_history", []):
        timeline.append({
            "type": "status_change",
            "text": f"Estado cambiado: {sc.get('from', '?')} → {sc.get('to', '?')}",
            "timestamp": sc.get("changed_at"),
            "admin": sc.get("changed_by", ""),
        })
    # Sort by timestamp
    timeline.sort(key=lambda x: x.get("timestamp") or datetime.min)
    doc["timeline"] = timeline

    return doc


@router.post('/api/admin/compliance/complaints')
async def create_complaint(request: Request):
    user = await _get_admin(request)
    body = await request.json()

    complaint = {
        "client_name": body.get("client_name", ""),
        "client_phone": body.get("client_phone", ""),
        "client_email": body.get("client_email", ""),
        "client_address": body.get("client_address", ""),
        "loan_id": body.get("loan_id", ""),
        "loan_number": body.get("loan_number", ""),
        "category": body.get("category", "general"),
        "subcategory": body.get("subcategory", ""),
        "description": body.get("description", ""),
        "severity": body.get("severity", "medium"),
        "source": body.get("source", "internal"),  # internal, occc, phone, email, walk_in
        "status": "open",
        "resolution": "",
        "resolution_date": None,
        "notes": [],
        "status_history": [{"from": None, "to": "open", "changed_by": user.get("email", "admin"), "changed_at": datetime.utcnow()}],
        "assigned_to": body.get("assigned_to", user.get("email", "")),
        "created_by": user.get("email", "admin"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await _db.consumer_complaints.insert_one(complaint)
    complaint["_id"] = str(result.inserted_id)

    # Audit trail
    try:
        from occc_audit_trail import log_audit_event
        await log_audit_event(
            action="complaint_created",
            entity_type="consumer_complaint",
            entity_id=str(result.inserted_id),
            admin_email=user.get("email", "admin"),
            admin_name=user.get("name", user.get("email", "admin")),
            details=f"Queja registrada: {body.get('client_name','')} — {body.get('category','')} ({body.get('severity','')})",
            metadata={"client_name": body.get("client_name"), "category": body.get("category"), "severity": body.get("severity")},
        )
    except Exception:
        pass

    return {"success": True, "complaint": complaint}


@router.put('/api/admin/compliance/complaints/{complaint_id}')
async def update_complaint(complaint_id: str, request: Request):
    user = await _get_admin(request)
    body = await request.json()

    # Get current doc for status tracking
    current = await _db.consumer_complaints.find_one({"_id": ObjectId(complaint_id)})
    if not current:
        raise HTTPException(status_code=404, detail="Queja no encontrada")

    updates: dict = {"updated_at": datetime.utcnow()}
    for field in ["status", "resolution", "severity", "category", "description",
                   "client_name", "client_phone", "client_email", "client_address",
                   "loan_number", "subcategory", "source", "assigned_to"]:
        if field in body:
            updates[field] = body[field]

    # Track status changes
    if "status" in body and body["status"] != current.get("status"):
        status_entry = {
            "from": current.get("status"),
            "to": body["status"],
            "changed_by": user.get("email", "admin"),
            "changed_at": datetime.utcnow(),
        }
        await _db.consumer_complaints.update_one(
            {"_id": ObjectId(complaint_id)},
            {"$push": {"status_history": status_entry}}
        )
        # If resolving, set resolution date
        if body["status"] in ("resolved", "closed"):
            updates["resolution_date"] = datetime.utcnow()

        # Audit trail
        try:
            from occc_audit_trail import log_audit_event
            await log_audit_event(
                action="complaint_status_change",
                entity_type="consumer_complaint",
                entity_id=complaint_id,
                admin_email=user.get("email", "admin"),
                admin_name=user.get("name", user.get("email", "admin")),
                details=f"Queja {current.get('client_name','')}: {current.get('status')} → {body['status']}",
                changes={"status": {"old": current.get("status"), "new": body["status"]}},
            )
        except Exception:
            pass

    # Add note if provided
    if "note" in body and body["note"].strip():
        note_entry = {
            "text": body["note"],
            "added_by": user.get("email", "admin"),
            "added_at": datetime.utcnow(),
        }
        await _db.consumer_complaints.update_one(
            {"_id": ObjectId(complaint_id)},
            {"$push": {"notes": note_entry}}
        )

    await _db.consumer_complaints.update_one({"_id": ObjectId(complaint_id)}, {"$set": updates})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# 4. RIGHT TO CANCEL TRACKING
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/cancellations')
async def list_cancellations(request: Request, limit: int = 50):
    await _get_admin(request)

    cancellations = []
    cursor = _db.loan_cancellations.find().sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        cancellations.append(doc)

    three_days_ago = datetime.utcnow() - timedelta(days=3)
    in_window = []
    window_cursor = _db.cab_loans.find(
        {"created_at": {"$gte": three_days_ago}, "status": "active"},
        {"client_name": 1, "loan_amount": 1, "created_at": 1}
    )
    async for doc in window_cursor:
        created = doc.get("created_at")
        if created:
            expires = created + timedelta(days=3)
            doc["_id"] = str(doc["_id"])
            doc["cancel_window_expires"] = expires.isoformat()
            doc["hours_remaining"] = round(max(0, (expires - datetime.utcnow()).total_seconds() / 3600), 1)
            in_window.append(doc)

    return {
        "cancellations": cancellations,
        "in_cancel_window": in_window,
        "stats": {"total_cancellations": len(cancellations), "in_cancel_window": len(in_window)},
    }


@router.post('/api/admin/compliance/cancellations')
async def record_cancellation(request: Request):
    user = await _get_admin(request)
    body = await request.json()
    loan_id = body.get("loan_id", "")

    loan = None
    loan_type = "regulated"
    try:
        loan = await _db.cab_loans.find_one({"_id": ObjectId(loan_id)})
        if loan:
            loan_type = "cab"
        else:
            loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cancellation = {
        "loan_id": loan_id,
        "loan_type": loan_type,
        "client_name": loan.get("client_name", ""),
        "loan_amount": loan.get("loan_amount", loan.get("amount", 0)),
        "reason": body.get("reason", "Right to Cancel ejercido por el cliente"),
        "cancelled_by": user.get("email", "admin"),
        "created_at": datetime.utcnow(),
    }

    await _db.loan_cancellations.insert_one(cancellation)

    col = _db.cab_loans if loan_type == "cab" else _db.regulated_loans
    await col.update_one({"_id": ObjectId(loan_id)}, {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}})

    cancellation["_id"] = str(cancellation.get("_id", ""))
    return {"success": True, "cancellation": cancellation}


# ═══════════════════════════════════════════════════════════════
# 5. REGULATED LENDER ANNUAL REPORT
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/annual-report')
async def get_annual_report(request: Request, year: int = 0):
    await _get_admin(request)
    if not year:
        year = datetime.utcnow().year

    start = datetime(year, 1, 1)
    end = datetime(year, 12, 31, 23, 59, 59)
    query = {"created_at": {"$gte": start, "$lte": end}}

    reg_loans = await _db.regulated_loans.find(query).to_list(5000)
    total_originated = len(reg_loans)
    total_amount = sum(l.get("amount", l.get("loan_amount", 0)) for l in reg_loans)

    sub_e = [l for l in reg_loans if l.get("loan_type") == "subchapter_e"]
    sub_f = [l for l in reg_loans if l.get("loan_type") == "subchapter_f"]
    tax_adv = [l for l in reg_loans if l.get("loan_type") == "tax_advance"]

    active = len([l for l in reg_loans if l.get("status") == "active"])
    paid_off = len([l for l in reg_loans if l.get("status") == "paid_off"])
    defaulted = len([l for l in reg_loans if l.get("status") in ("defaulted", "default")])
    delinquent = len([l for l in reg_loans if l.get("status") == "delinquent"])

    avg_amount = total_amount / total_originated if total_originated else 0
    avg_rate = sum(l.get("annual_rate", l.get("effective_apr", 0)) for l in reg_loans) / total_originated if total_originated else 0

    return {
        "year": year,
        "license_type": "Regulated Lender (Ch. 342)",
        "due_date": f"May 1, {year + 1}",
        "origination": {"total_loans": total_originated, "total_amount": round(total_amount, 2), "average_amount": round(avg_amount, 2), "average_rate": round(avg_rate, 2)},
        "by_subchapter": {
            "subchapter_e": {"count": len(sub_e), "amount": round(sum(l.get("amount", l.get("loan_amount", 0)) for l in sub_e), 2)},
            "subchapter_f": {"count": len(sub_f), "amount": round(sum(l.get("amount", l.get("loan_amount", 0)) for l in sub_f), 2)},
            "tax_advance": {"count": len(tax_adv), "amount": round(sum(l.get("amount", l.get("loan_amount", 0)) for l in tax_adv), 2)},
        },
        "portfolio": {"active": active, "paid_off": paid_off, "delinquent": delinquent, "defaulted": defaulted,
                      "delinquency_rate": round(delinquent / active * 100, 1) if active else 0},
        "complaints": await _db.consumer_complaints.count_documents({"created_at": {"$gte": start, "$lte": end}}),
        "cancellations": await _db.loan_cancellations.count_documents({"created_at": {"$gte": start, "$lte": end}}),
    }


# ═══════════════════════════════════════════════════════════════
# 6. EXAMINATION CHECKLIST
# ═══════════════════════════════════════════════════════════════

DEFAULT_CHECKLIST = [
    {"id": "lic_1", "category": "Licencias", "item": "Licencia OCCC vigente (Regulated Lender)", "required": True, "status": "pending"},
    {"id": "lic_2", "category": "Licencias", "item": "Certificado CSO registrado (si CAB)", "required": False, "status": "pending"},
    {"id": "lic_3", "category": "Licencias", "item": "Renovación anual al día", "required": True, "status": "pending"},
    {"id": "rec_1", "category": "Registros", "item": "Contratos archivados (todos los préstamos)", "required": True, "status": "pending"},
    {"id": "rec_2", "category": "Registros", "item": "Pagarés firmados por clientes", "required": True, "status": "pending"},
    {"id": "rec_3", "category": "Registros", "item": "Disclosure Statements entregados", "required": True, "status": "pending"},
    {"id": "rec_4", "category": "Registros", "item": "Right to Cancel notices firmados", "required": True, "status": "pending"},
    {"id": "rec_5", "category": "Registros", "item": "Payment Schedules entregados", "required": True, "status": "pending"},
    {"id": "rec_6", "category": "Registros", "item": "Registro de quejas de consumidores", "required": True, "status": "pending"},
    {"id": "fin_1", "category": "Financiero", "item": "Trust Account reconciliado (mensual)", "required": True, "status": "pending"},
    {"id": "fin_2", "category": "Financiero", "item": "Estados bancarios archivados (12 meses)", "required": True, "status": "pending"},
    {"id": "fin_3", "category": "Financiero", "item": "Registro de remesas al lender", "required": False, "status": "pending"},
    {"id": "fin_4", "category": "Financiero", "item": "Comprobantes de desembolso", "required": True, "status": "pending"},
    {"id": "rep_1", "category": "Reportes", "item": "Reporte anual OCCC enviado", "required": True, "status": "pending"},
    {"id": "rep_2", "category": "Reportes", "item": "Reportes trimestrales CAB50", "required": False, "status": "pending"},
    {"id": "rep_3", "category": "Reportes", "item": "Reporte de delincuencia actualizado", "required": True, "status": "pending"},
    {"id": "com_1", "category": "Cumplimiento", "item": "Tasas dentro de límites OCCC", "required": True, "status": "pending"},
    {"id": "com_2", "category": "Cumplimiento", "item": "Fees administrativos conformes", "required": True, "status": "pending"},
    {"id": "com_3", "category": "Cumplimiento", "item": "Late fees conformes (5%, $5-$15)", "required": True, "status": "pending"},
    {"id": "com_4", "category": "Cumplimiento", "item": "Sin penalidad por prepago", "required": True, "status": "pending"},
    {"id": "com_5", "category": "Cumplimiento", "item": "TILA/Reg Z en contratos", "required": True, "status": "pending"},
    {"id": "com_6", "category": "Cumplimiento", "item": "Señalización en oficina", "required": True, "status": "pending"},
    {"id": "seg_1", "category": "Seguridad", "item": "Plan de privacidad de datos", "required": True, "status": "pending"},
]

CHECKLIST_ID = "occc_examination_checklist"


@router.get('/api/admin/compliance/checklist')
async def get_checklist(request: Request):
    await _get_admin(request)

    doc = await _db.compliance_checklists.find_one({"_id": CHECKLIST_ID})
    if not doc:
        doc = {"_id": CHECKLIST_ID, "items": DEFAULT_CHECKLIST, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
        await _db.compliance_checklists.insert_one(doc)

    items = doc.get("items", DEFAULT_CHECKLIST)
    total = len(items)
    completed = len([i for i in items if i.get("status") == "completed"])
    na = len([i for i in items if i.get("status") == "na"])

    return {
        "items": items,
        "stats": {"total": total, "completed": completed, "pending": total - completed - na, "na": na,
                  "progress": round(completed / (total - na) * 100, 1) if (total - na) > 0 else 0},
        "last_updated": doc.get("updated_at"),
    }


@router.put('/api/admin/compliance/checklist')
async def update_checklist(request: Request):
    user = await _get_admin(request)
    body = await request.json()
    item_id = body.get("item_id")
    new_status = body.get("status", "pending")
    note = body.get("note", "")

    doc = await _db.compliance_checklists.find_one({"_id": CHECKLIST_ID})
    if not doc:
        raise HTTPException(status_code=404)

    items = doc.get("items", [])
    for item in items:
        if item["id"] == item_id:
            item["status"] = new_status
            item["updated_by"] = user.get("email", "admin")
            item["updated_at"] = datetime.utcnow().isoformat()
            if note:
                item["note"] = note
            break

    await _db.compliance_checklists.update_one({"_id": CHECKLIST_ID}, {"$set": {"items": items, "updated_at": datetime.utcnow()}})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# 7. ENHANCED AUDIT TRAIL (for OCCC examination)
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/audit-trail')
async def get_enhanced_audit_trail(
    request: Request,
    entity_type: str = "",
    entity_id: str = "",
    action: str = "",
    admin_email: str = "",
    start_date: str = "",
    end_date: str = "",
    limit: int = 200,
    skip: int = 0,
):
    """Enhanced audit trail with granular filtering for OCCC examination."""
    await _get_admin(request)

    try:
        from occc_audit_trail import get_audit_trail as _get_trail
        sd = datetime.fromisoformat(start_date) if start_date else None
        ed = datetime.fromisoformat(end_date) if end_date else None
        result = await _get_trail(
            entity_type=entity_type or None,
            entity_id=entity_id or None,
            admin_email=admin_email or None,
            action=action or None,
            start_date=sd,
            end_date=ed,
            limit=limit,
            skip=skip,
        )
        return result
    except ImportError:
        return {"events": [], "total": 0, "error": "Audit trail module not available"}


@router.get('/api/admin/compliance/audit-trail/summary')
async def get_audit_trail_summary(request: Request, year: int = 0):
    """Get audit trail summary for OCCC annual reporting."""
    await _get_admin(request)
    if not year:
        year = datetime.utcnow().year

    try:
        from occc_audit_trail import get_audit_summary
        return await get_audit_summary(year=year)
    except ImportError:
        return {"error": "Audit trail module not available"}


@router.get('/api/admin/compliance/audit-trail/entity/{entity_type}/{entity_id}')
async def get_entity_audit_history(request: Request, entity_type: str, entity_id: str):
    """Get complete change history for a specific entity (loan, complaint, etc.)."""
    await _get_admin(request)

    try:
        from occc_audit_trail import get_entity_history
        events = await get_entity_history(entity_type, entity_id)
        return {"events": events, "total": len(events)}
    except ImportError:
        return {"events": [], "total": 0}


# ═══════════════════════════════════════════════════════════════
# 8. EXPORT ENDPOINTS (CSV/JSON for OCCC examiner)
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/export/annual-report')
async def export_annual_report(request: Request, year: int = 0, format: str = "csv"):
    """Export annual report as CSV for OCCC submission."""
    from fastapi.responses import StreamingResponse
    import io

    await _get_admin(request)
    if not year:
        year = datetime.utcnow().year

    start = datetime(year, 1, 1)
    end = datetime(year, 12, 31, 23, 59, 59)
    query = {"created_at": {"$gte": start, "$lte": end}}

    reg_loans = await _db.regulated_loans.find(query).to_list(5000)
    cab_loans = await _db.cab_loans.find(query).to_list(5000)
    complaints = await _db.consumer_complaints.find(query).to_list(500)
    cancellations = await _db.loan_cancellations.find(query).to_list(500)

    if format == "csv":
        output = io.StringIO()

        # Header
        output.write(f"ROSS LENDING SOLUTIONS LLC - OCCC ANNUAL REPORT {year}\n")
        output.write(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
        output.write(f"License Type: Regulated Lender (Ch. 342 Texas Finance Code)\n")
        output.write(f"Due Date: May 1, {year + 1}\n\n")

        # Summary
        total = len(reg_loans)
        total_amount = sum(l.get("amount", l.get("loan_amount", 0)) for l in reg_loans)
        active = len([l for l in reg_loans if l.get("status") == "active"])
        paid = len([l for l in reg_loans if l.get("status") == "paid_off"])
        delinquent = len([l for l in reg_loans if l.get("status") == "delinquent"])
        defaulted = len([l for l in reg_loans if l.get("status") in ("defaulted", "default")])

        output.write("=== ORIGINATION SUMMARY ===\n")
        output.write(f"Total Loans Originated,{total}\n")
        output.write(f"Total Amount,${'%.2f' % total_amount}\n")
        output.write(f"Average Amount,${'%.2f' % (total_amount/total if total else 0)}\n\n")

        # By Subchapter
        sub_e = [l for l in reg_loans if l.get("loan_type") == "subchapter_e"]
        sub_f = [l for l in reg_loans if l.get("loan_type") == "subchapter_f"]
        tax_adv = [l for l in reg_loans if l.get("loan_type") == "tax_advance"]

        output.write("=== BY SUBCHAPTER ===\n")
        output.write("Subchapter,Count,Amount\n")
        output.write(f"Subchapter E,{len(sub_e)},${'%.2f' % sum(l.get('amount', l.get('loan_amount', 0)) for l in sub_e)}\n")
        output.write(f"Subchapter F,{len(sub_f)},${'%.2f' % sum(l.get('amount', l.get('loan_amount', 0)) for l in sub_f)}\n")
        output.write(f"Tax Advance,{len(tax_adv)},${'%.2f' % sum(l.get('amount', l.get('loan_amount', 0)) for l in tax_adv)}\n\n")

        # Portfolio Status
        output.write("=== PORTFOLIO STATUS ===\n")
        output.write(f"Active,{active}\n")
        output.write(f"Paid Off,{paid}\n")
        output.write(f"Delinquent,{delinquent}\n")
        output.write(f"Defaulted,{defaulted}\n")
        output.write(f"Delinquency Rate,{'%.1f' % (delinquent/active*100 if active else 0)}%\n\n")

        # CAB Loans
        output.write("=== CAB LOANS ===\n")
        output.write(f"Total CAB Loans,{len(cab_loans)}\n")
        output.write(f"Total CAB Amount,${'%.2f' % sum(l.get('loan_amount', 0) for l in cab_loans)}\n\n")

        # Complaints
        output.write("=== CONSUMER COMPLAINTS ===\n")
        output.write(f"Total Complaints,{len(complaints)}\n")
        if complaints:
            output.write("Date,Client,Category,Severity,Status\n")
            for c in complaints:
                output.write(f"{c.get('created_at','')},{c.get('client_name','')},{c.get('category','')},{c.get('severity','')},{c.get('status','')}\n")
        output.write("\n")

        # Cancellations
        output.write("=== CANCELLATIONS ===\n")
        output.write(f"Total Cancellations,{len(cancellations)}\n\n")

        # Detailed Loan List
        output.write("=== DETAILED LOAN LIST ===\n")
        output.write("Loan ID,Client,Type,Amount,Rate,Status,Created\n")
        for loan in reg_loans:
            output.write(f"{str(loan.get('_id',''))},{loan.get('client_name', loan.get('borrower_name',''))},{loan.get('loan_type','')},{loan.get('amount', loan.get('loan_amount', 0))},{loan.get('annual_rate', loan.get('effective_apr', 0))},{loan.get('status','')},{loan.get('created_at','')}\n")

        content = output.getvalue()
        output.close()

        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=OCCC_Annual_Report_{year}_Ross_Lending.csv"}
        )

    else:
        # JSON export
        return {
            "company": "Ross Lending Solutions LLC",
            "year": year,
            "generated": datetime.utcnow().isoformat(),
            "license_type": "Regulated Lender (Ch. 342)",
            "regulated_loans": len(reg_loans),
            "cab_loans": len(cab_loans),
            "complaints": len(complaints),
            "cancellations": len(cancellations),
            "total_originated": sum(l.get("amount", l.get("loan_amount", 0)) for l in reg_loans),
        }


@router.get('/api/admin/compliance/export/audit-log')
async def export_audit_log(request: Request, start_date: str = "", end_date: str = ""):
    """Export audit log as CSV for OCCC examiner."""
    from fastapi.responses import StreamingResponse
    import io

    await _get_admin(request)

    query = {}
    if start_date:
        query.setdefault("timestamp", {})["$gte"] = datetime.fromisoformat(start_date)
    if end_date:
        query.setdefault("timestamp", {})["$lte"] = datetime.fromisoformat(end_date)

    # Get from both audit collections
    events = []

    async for doc in _db.occc_audit_trail.find(query).sort("timestamp", -1).limit(5000):
        events.append(doc)

    async for doc in _db.loan_audit_log.find({}).sort("created_at", -1).limit(2000):
        events.append({
            "timestamp": doc.get("created_at"),
            "action": doc.get("action", ""),
            "entity_type": doc.get("entity_type", "loan"),
            "entity_id": str(doc.get("_id", "")),
            "admin_email": doc.get("admin_name", ""),
            "details": doc.get("details", ""),
        })

    output = io.StringIO()
    output.write("ROSS LENDING SOLUTIONS LLC - AUDIT LOG EXPORT\n")
    output.write(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n")
    output.write("Timestamp,Action,Entity Type,Entity ID,Admin,Details\n")

    for e in events:
        ts = e.get("timestamp", e.get("created_at", ""))
        output.write(f"{ts},{e.get('action','')},{e.get('entity_type','')},{e.get('entity_id','')},{e.get('admin_email','')},\"{e.get('details','')}\"\n")

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=OCCC_Audit_Log_Ross_Lending.csv"}
    )


# ═══════════════════════════════════════════════════════════════
# 9. OCCC PRINTABLE DOCUMENTS (Privacy Policy + Office Sign)
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/compliance/documents/privacy-policy')
async def get_privacy_policy(request: Request, lang: str = "es"):
    """Generate the Privacy Policy document with dynamic company info."""
    await _get_admin(request)

    # Get company config
    config = await _db.api_config.find_one({"type": "sendgrid_config"}) or {}
    company = config.get("company_name", "Ross Lending Solutions LLC")
    phone = config.get("company_phone", "(806) 934-2018")
    email = config.get("company_email", "info@rosslending.com")
    address = config.get("company_address", "305 Bruce Ave, Dumas, TX 79029")
    website = config.get("company_website", "rosslending.com")
    date = datetime.utcnow().strftime("%B %d, %Y")

    if lang == "es":
        policy = {
            "title": f"POLÍTICA DE PRIVACIDAD — {company}",
            "effective_date": date,
            "sections": [
                {
                    "title": "1. INFORMACIÓN QUE RECOPILAMOS",
                    "content": f"""En {company}, recopilamos información personal necesaria para procesar su solicitud de préstamo y administrar su cuenta. Esta información puede incluir:

• **Información de identificación:** Nombre completo, fecha de nacimiento, número de Seguro Social (SSN) o ITIN, número de licencia de conducir o identificación estatal.
• **Información de contacto:** Dirección postal, número de teléfono, dirección de correo electrónico.
• **Información financiera:** Ingresos, historial de empleo, información bancaria (número de cuenta y routing), historial crediticio.
• **Información del préstamo:** Monto solicitado, propósito del préstamo, historial de pagos.
• **Información del dispositivo:** Dirección IP, tipo de navegador (cuando usa nuestra aplicación móvil o sitio web)."""
                },
                {
                    "title": "2. CÓMO USAMOS SU INFORMACIÓN",
                    "content": """Utilizamos su información personal para los siguientes propósitos:

• Evaluar y procesar su solicitud de préstamo.
• Verificar su identidad y prevenir fraude.
• Administrar su cuenta y procesar pagos.
• Comunicarnos con usted sobre su préstamo, pagos y servicios.
• Cumplir con requisitos legales y regulatorios, incluyendo reportes al OCCC (Office of Consumer Credit Commissioner) de Texas.
• Reportar a las agencias de crédito según lo permitido por la ley.
• Mejorar nuestros servicios y experiencia del cliente."""
                },
                {
                    "title": "3. COMPARTIR INFORMACIÓN CON TERCEROS",
                    "content": f"""Podemos compartir su información personal con:

• **Agencias de crédito:** Para verificar su historial crediticio y reportar su actividad de préstamo.
• **Reguladores:** OCCC de Texas, según requerido por el Capítulo 342 del Texas Finance Code.
• **Proveedores de servicios:** Procesadores de pagos, servicios de verificación de identidad, y otros proveedores que nos ayudan a operar nuestro negocio (bajo acuerdos de confidencialidad).
• **Prestamistas terceros:** En el caso de préstamos CAB (Credit Access Business), compartimos información necesaria con el prestamista que otorga el crédito.
• **Autoridades legales:** Cuando lo requiera la ley, orden judicial, o proceso legal.

**NO vendemos, alquilamos, ni compartimos su información personal con fines de marketing de terceros.**"""
                },
                {
                    "title": "4. PROTECCIÓN DE SU INFORMACIÓN",
                    "content": """Implementamos medidas de seguridad razonables para proteger su información personal, incluyendo:

• Encriptación de datos en tránsito y en reposo.
• Acceso restringido solo a personal autorizado.
• Almacenamiento seguro de documentos físicos bajo llave.
• Monitoreo regular de nuestros sistemas de seguridad.
• Eliminación segura de información cuando ya no es necesaria (conforme a los períodos de retención requeridos por ley).

Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico es 100% seguro."""
                },
                {
                    "title": "5. SUS DERECHOS",
                    "content": f"""Usted tiene los siguientes derechos respecto a su información personal:

• **Acceso:** Solicitar una copia de la información que tenemos sobre usted.
• **Corrección:** Solicitar la corrección de información inexacta.
• **Opt-Out:** Optar por no recibir comunicaciones de marketing.
• **Queja:** Presentar una queja ante el OCCC si cree que sus derechos han sido violados.

Para ejercer cualquiera de estos derechos, contáctenos:
📞 {phone}
✉️ {email}
📍 {address}"""
                },
                {
                    "title": "6. RETENCIÓN DE DATOS",
                    "content": """Retenemos su información personal conforme a los siguientes períodos:

• **Documentos de préstamo:** Mínimo 4 años después del cierre del préstamo (conforme a 7 TAC §83.602).
• **Registros de transacciones:** Mínimo 5 años.
• **Comunicaciones:** Mínimo 3 años.
• **Registros de quejas:** Mínimo 3 años después de la resolución.

Después de estos períodos, la información se destruye de forma segura."""
                },
                {
                    "title": "7. LEY GRAMM-LEACH-BLILEY (GLBA)",
                    "content": f"""{company} cumple con la Ley Gramm-Leach-Bliley (GLBA), que requiere que las instituciones financieras expliquen sus prácticas de información y protejan los datos sensibles de los consumidores.

Conforme a la GLBA:
• Le proporcionamos este aviso de privacidad al inicio de su relación con nosotros y anualmente después.
• Limitamos la recopilación y uso de su información a lo necesario para nuestros servicios.
• Mantenemos un programa de seguridad de la información adecuado."""
                },
                {
                    "title": "8. CAMBIOS A ESTA POLÍTICA",
                    "content": f"""Podemos actualizar esta política de privacidad periódicamente. Le notificaremos de cambios significativos por correo, email, o aviso en nuestra oficina. La versión más reciente siempre estará disponible en nuestra oficina y en nuestra aplicación.

Última actualización: {date}"""
                },
                {
                    "title": "9. CONTACTO",
                    "content": f"""Si tiene preguntas sobre esta política de privacidad o nuestras prácticas de información, contáctenos:

**{company}**
📍 {address}
📞 {phone}
✉️ {email}
🌐 {website}

**OCCC (Regulador):**
📞 1-800-538-1579
🌐 www.occc.texas.gov"""
                },
            ],
        }
    else:
        policy = {
            "title": f"PRIVACY POLICY — {company}",
            "effective_date": date,
            "sections": [
                {"title": "1. INFORMATION WE COLLECT", "content": f"{company} collects personal information necessary to process your loan application and manage your account, including: identification information, contact information, financial information, loan information, and device information."},
                {"title": "2. HOW WE USE YOUR INFORMATION", "content": "We use your information to evaluate and process loan applications, verify identity, manage accounts, process payments, communicate with you, comply with legal and regulatory requirements (including OCCC reporting), report to credit bureaus, and improve our services."},
                {"title": "3. SHARING WITH THIRD PARTIES", "content": "We may share your information with credit bureaus, regulators (OCCC Texas), service providers, third-party lenders (for CAB loans), and legal authorities as required by law. We DO NOT sell your personal information."},
                {"title": "4. INFORMATION PROTECTION", "content": "We implement reasonable security measures including encryption, restricted access, secure document storage, and regular security monitoring."},
                {"title": "5. YOUR RIGHTS", "content": f"You have the right to access, correct, and opt-out of marketing communications. Contact us at {phone} or {email}."},
                {"title": "6. DATA RETENTION", "content": "Loan documents: 4 years minimum. Transaction records: 5 years. Communications: 3 years. Complaint records: 3 years after resolution."},
                {"title": "7. GLBA COMPLIANCE", "content": f"{company} complies with the Gramm-Leach-Bliley Act (GLBA)."},
                {"title": "8. CHANGES TO THIS POLICY", "content": f"We may update this policy periodically. Last updated: {date}"},
                {"title": "9. CONTACT", "content": f"{company}\n{address}\n{phone}\n{email}\n{website}\n\nOCCC: 1-800-538-1579 / www.occc.texas.gov"},
            ],
        }

    return policy


@router.get('/api/admin/compliance/documents/office-sign')
async def get_office_sign(request: Request, lang: str = "es"):
    """Generate the OCCC-required office signage content."""
    await _get_admin(request)

    config = await _db.api_config.find_one({"type": "sendgrid_config"}) or {}
    company = config.get("company_name", "Ross Lending Solutions LLC")
    phone = config.get("company_phone", "(806) 934-2018")
    email = config.get("company_email", "info@rosslending.com")
    address = config.get("company_address", "305 Bruce Ave, Dumas, TX 79029")
    license_number = config.get("occc_license", "Pending")

    if lang == "es":
        sign = {
            "title": "AVISO AL CONSUMIDOR",
            "subtitle": f"{company}",
            "license_section": {
                "title": "LICENCIA REGULATORIA",
                "text": f"Esta oficina opera bajo licencia del Office of Consumer Credit Commissioner (OCCC) del Estado de Texas conforme al Capítulo 342 del Texas Finance Code.",
                "license_number": license_number,
            },
            "rights_section": {
                "title": "SUS DERECHOS COMO CONSUMIDOR",
                "items": [
                    "Recibir una copia completa de su contrato de préstamo con todas las divulgaciones requeridas por ley (APR, cargos financieros, monto total a pagar).",
                    "Cancelar su préstamo dentro de los 3 días siguientes a la firma sin penalidad.",
                    "Pagar su préstamo anticipadamente sin cargos adicionales por prepago.",
                    "Recibir un recibo por cada pago realizado.",
                    "No ser sujeto a tasas de interés que excedan los techos establecidos por el OCCC.",
                    "Presentar una queja si considera que sus derechos han sido violados.",
                    "Recibir servicio en español o inglés.",
                ],
            },
            "complaint_section": {
                "title": "¿TIENE UNA QUEJA?",
                "text": "Si tiene una queja sobre nuestros servicios, puede:",
                "options": [
                    f"Contactarnos directamente: {phone} / {email}",
                    f"Visitarnos: {address}",
                    "Presentar queja ante el OCCC:",
                ],
                "occc_info": {
                    "phone": "1-800-538-1579",
                    "website": "www.occc.texas.gov/consumers/complaint",
                    "address": "2601 N. Lamar Blvd, Austin, TX 78705",
                    "email": "consumer.complaints@occc.texas.gov",
                },
            },
            "hours_section": {
                "title": "HORARIO DE ATENCIÓN",
                "hours": "Lunes a Viernes: 9:00 AM - 6:00 PM\nSábados: Con cita previa\nDomingos: Cerrado",
            },
            "footer": f"© {datetime.utcnow().year} {company} | {address} | {phone}",
        }
    else:
        sign = {
            "title": "CONSUMER NOTICE",
            "subtitle": f"{company}",
            "license_section": {
                "title": "REGULATORY LICENSE",
                "text": "This office operates under a license from the Office of Consumer Credit Commissioner (OCCC) of the State of Texas under Chapter 342 of the Texas Finance Code.",
                "license_number": license_number,
            },
            "rights_section": {
                "title": "YOUR CONSUMER RIGHTS",
                "items": [
                    "Receive a complete copy of your loan agreement with all required disclosures (APR, finance charges, total amount payable).",
                    "Cancel your loan within 3 days of signing without penalty.",
                    "Prepay your loan without additional prepayment charges.",
                    "Receive a receipt for every payment made.",
                    "Not be subject to interest rates exceeding OCCC rate ceilings.",
                    "File a complaint if you believe your rights have been violated.",
                    "Receive service in Spanish or English.",
                ],
            },
            "complaint_section": {
                "title": "HAVE A COMPLAINT?",
                "text": "If you have a complaint about our services, you may:",
                "options": [
                    f"Contact us directly: {phone} / {email}",
                    f"Visit us: {address}",
                    "File a complaint with the OCCC:",
                ],
                "occc_info": {
                    "phone": "1-800-538-1579",
                    "website": "www.occc.texas.gov/consumers/complaint",
                    "address": "2601 N. Lamar Blvd, Austin, TX 78705",
                    "email": "consumer.complaints@occc.texas.gov",
                },
            },
            "hours_section": {
                "title": "OFFICE HOURS",
                "hours": "Monday - Friday: 9:00 AM - 6:00 PM\nSaturday: By appointment\nSunday: Closed",
            },
            "footer": f"© {datetime.utcnow().year} {company} | {address} | {phone}",
        }

    return sign
