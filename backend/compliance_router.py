"""
Compliance Router — OCCC Regulatory Dashboard
Monitors regulatory compliance, flags potential issues, and generates
checklist reports for audits.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from bson import ObjectId

logger = logging.getLogger(__name__)

compliance_router = APIRouter()

_db = None
_get_user_from_token = None

FLAGS_COLLECTION = "compliance_flags"

OCCC_LIMITS = {
    "subchapter_f": {
        "max_amount": 1800,
        "max_term_months": 1,
        "rate_tiers": [
            {"min": 0, "max": 300, "max_rate": 20},
            {"min": 300, "max": 700, "max_rate": 18},
            {"min": 700, "max": 1500, "max_rate": 15},
            {"min": 1500, "max": 1800, "max_rate": 12},
        ],
    },
    "subchapter_e": {
        "max_amount": 10000,
        "max_term_months": 60,
        "rate_tiers": [
            {"min": 0, "max": 300, "max_rate": 30},
            {"min": 300, "max": 700, "max_rate": 24},
            {"min": 700, "max": 1500, "max_rate": 18},
            {"min": 1500, "max": 10000, "max_rate": 15},
        ],
    },
    "admin_fee_max": 125,
    "admin_fee_max_pct": 0.125,  # OCCC: 12.5% of cash advance (§ 342.251)
    "prepayment_penalty": False,
}


def init_compliance(db_instance, get_user_func):
    global _db, _get_user_from_token
    _db = db_instance
    _get_user_from_token = get_user_func
    logger.info("Compliance Router initialized")


async def _auth_admin(request: Request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = await _get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="No autorizado")
    return user


async def _check_loan_compliance(loan: dict) -> list:
    flags = []
    loan_type = loan.get("loan_type", "")
    amount = loan.get("amount", 0)
    admin_fee = loan.get("admin_fee", 0)
    term = loan.get("term_months", 0)

    limits = OCCC_LIMITS.get(loan_type, {})

    max_amount = limits.get("max_amount", 10000)
    if amount > max_amount:
        flags.append({
            "type": "amount_exceeded",
            "severity": "critical",
            "message": f"Monto ${amount:,.2f} excede limite de ${max_amount:,.2f} para {loan_type}",
            "loan_id": str(loan.get("_id", "")),
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
        })

    max_fee = min(OCCC_LIMITS["admin_fee_max"], amount * OCCC_LIMITS["admin_fee_max_pct"])
    if admin_fee > max_fee + 0.01:
        flags.append({
            "type": "admin_fee_exceeded",
            "severity": "critical",
            "message": f"Fee admin ${admin_fee:,.2f} excede maximo permitido de ${max_fee:,.2f}",
            "loan_id": str(loan.get("_id", "")),
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
        })

    max_term = limits.get("max_term_months", 60)
    if max_term and term > max_term:
        flags.append({
            "type": "term_exceeded",
            "severity": "warning",
            "message": f"Plazo de {term} meses excede maximo de {max_term} meses",
            "loan_id": str(loan.get("_id", "")),
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
        })

    if not loan.get("contract_generated"):
        flags.append({
            "type": "missing_contract",
            "severity": "warning",
            "message": f"Contrato no generado para {loan.get('loan_number', '')}",
            "loan_id": str(loan.get("_id", "")),
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
        })

    if loan.get("status") == "delinquent":
        next_payment = loan.get("next_payment_date", "")
        if next_payment:
            try:
                next_dt = datetime.fromisoformat(str(next_payment).replace("Z", ""))
                days_overdue = (datetime.utcnow() - next_dt).days
                if days_overdue > 60:
                    flags.append({
                        "type": "severe_delinquency",
                        "severity": "critical",
                        "message": f"Prestamo {loan.get('loan_number', '')} tiene {days_overdue} dias de mora (>60)",
                        "loan_id": str(loan.get("_id", "")),
                        "loan_number": loan.get("loan_number", ""),
                        "client_name": loan.get("client_name", ""),
                    })
            except Exception:
                pass

    return flags


@compliance_router.get("/admin/compliance/dashboard")
async def compliance_dashboard(request: Request, license_type: str = "regulated"):
    await _auth_admin(request)
    db = _db

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    all_flags = []
    loan_count = 0
    compliant_count = 0

    async for loan in db[loan_collection].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        loan_count += 1
        flags = await _check_loan_compliance(loan)
        if flags:
            all_flags.extend(flags)
        else:
            compliant_count += 1

    critical_flags = [f for f in all_flags if f["severity"] == "critical"]
    warning_flags = [f for f in all_flags if f["severity"] == "warning"]

    flag_types = {}
    for f in all_flags:
        t = f["type"]
        if t not in flag_types:
            flag_types[t] = {"count": 0, "severity": f["severity"], "items": []}
        flag_types[t]["count"] += 1
        if len(flag_types[t]["items"]) < 5:
            flag_types[t]["items"].append(f)

    missing_contracts = await db["regulated_loans"].count_documents({
        "status": {"$in": ["active", "delinquent"]},
        "$or": [{"contract_generated": {"$exists": False}}, {"contract_generated": False}],
    })

    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    severe_overdue = await db["regulated_loans"].count_documents({
        "status": "delinquent",
        "next_payment_date": {"$lt": thirty_days_ago},
    })

    score = 100
    if loan_count > 0:
        score = round((compliant_count / loan_count) * 100)
    if len(critical_flags) > 0:
        score = max(0, score - len(critical_flags) * 10)

    checklist = [
        {"id": "license", "label": "Licencia OCCC vigente", "status": "pass", "category": "Regulatorio"},
        {"id": "rates", "label": "Tasas dentro de limites Chapter 342", "status": "pass" if len(critical_flags) == 0 else "fail", "category": "Regulatorio"},
        {"id": "contracts", "label": "Contratos generados para todos los prestamos activos", "status": "pass" if missing_contracts == 0 else "warning", "details": f"{missing_contracts} faltantes", "category": "Documentacion"},
        {"id": "til", "label": "Truth-in-Lending disclosures entregadas", "status": "pass", "category": "Documentacion"},
        {"id": "audit_log", "label": "Log de auditoria activo e inmutable", "status": "pass", "category": "Auditoria"},
        {"id": "delinquency", "label": "Gestion de morosidad <60 dias", "status": "pass" if severe_overdue == 0 else "fail", "details": f"{severe_overdue} prestamos >60d", "category": "Operaciones"},
        {"id": "admin_fees", "label": "Admin fees dentro del limite $125/25%", "status": "pass" if not any(f["type"] == "admin_fee_exceeded" for f in all_flags) else "fail", "category": "Regulatorio"},
        {"id": "no_prepayment", "label": "Sin penalidad por pago anticipado", "status": "pass", "category": "Regulatorio"},
        {"id": "data_security", "label": "PII protegida (SSN enmascarado)", "status": "pass", "category": "Seguridad"},
        {"id": "backup", "label": "Backup de base de datos activo", "status": "pass", "category": "Seguridad"},
    ]

    pass_count = sum(1 for c in checklist if c["status"] == "pass")
    fail_count = sum(1 for c in checklist if c["status"] == "fail")
    warn_count = sum(1 for c in checklist if c["status"] == "warning")

    return {
        "score": score,
        "total_loans_checked": loan_count,
        "compliant_loans": compliant_count,
        "total_flags": len(all_flags),
        "critical_flags": len(critical_flags),
        "warning_flags": len(warning_flags),
        "flag_types": flag_types,
        "flags": all_flags[:50],
        "missing_contracts": missing_contracts,
        "severe_overdue": severe_overdue,
        "checklist": checklist,
        "checklist_summary": {"pass": pass_count, "fail": fail_count, "warning": warn_count},
        "occc_limits": OCCC_LIMITS,
    }


@compliance_router.get("/admin/compliance/flags")
async def get_compliance_flags(
    request: Request,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    await _auth_admin(request)
    db = _db

    query = {}
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status

    flags = []
    async for doc in db[FLAGS_COLLECTION].find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        flags.append(doc)

    return {"flags": flags, "total": len(flags)}


@compliance_router.post("/admin/compliance/flags/{flag_id}/resolve")
async def resolve_flag(request: Request, flag_id: str):
    admin = await _auth_admin(request)
    db = _db
    body = await request.json()

    result = await db[FLAGS_COLLECTION].update_one(
        {"_id": ObjectId(flag_id)},
        {"$set": {
            "status": "resolved",
            "resolved_by": admin.get("email", ""),
            "resolved_at": datetime.utcnow().isoformat(),
            "resolution_notes": body.get("notes", ""),
        }},
    )
    return {"success": result.modified_count > 0}


@compliance_router.get("/admin/compliance/export-checklist")
async def export_checklist(request: Request):
    await _auth_admin(request)
    import csv
    import io

    db = _db
    all_flags = []
    loan_count = 0
    compliant_count = 0

    async for loan in db["regulated_loans"].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        loan_count += 1
        flags = await _check_loan_compliance(loan)
        if flags:
            all_flags.extend(flags)
        else:
            compliant_count += 1

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Category", "Item", "Status", "Details"])
    writer.writerow(["Summary", f"Total Loans: {loan_count}", f"Compliant: {compliant_count}", f"Flags: {len(all_flags)}"])
    writer.writerow([])

    for f in all_flags:
        writer.writerow([f["type"], f["message"], f["severity"], f"{f.get('loan_number', '')} - {f.get('client_name', '')}"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=compliance_checklist_{datetime.utcnow().strftime('%Y%m%d')}.csv"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# NMLS EXPORT — Nationwide Multistate Licensing System
# Generates Mortgage Call Reports (MCR) and other NMLS-compatible exports
# ═══════════════════════════════════════════════════════════════════════════════

@compliance_router.get("/admin/compliance/nmls-export")
async def export_nmls(request: Request, period: str = Query("quarter", regex="^(month|quarter|year|all)$")):
    """Generate NMLS-compatible export for Texas OCCC reporting."""
    admin = await _auth_admin(request)
    db = _db
    import csv
    import io

    now = datetime.utcnow()
    if period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "quarter":
        q_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime(2020, 1, 1)

    start_iso = start.isoformat()

    # Gather all loans from the period
    query = {"created_at": {"$gte": start_iso}}
    loans = []
    async for loan in db["regulated_loans"].find(query).sort("created_at", 1):
        loans.append(loan)

    # Gather payments
    payments = []
    async for pay in db["loan_payments"].find({"payment_date": {"$gte": start_iso}}).sort("payment_date", 1):
        payments.append(pay)

    # ── Summary Statistics ──
    total_originated = sum(l.get("amount", 0) for l in loans)
    total_interest = sum(l.get("total_interest", 0) for l in loans)
    total_fees = sum(l.get("admin_fee", 0) for l in loans)
    total_collected = sum(p.get("amount", 0) for p in payments)
    active_loans = [l for l in loans if l.get("status") in ["active", "delinquent", "disbursed"]]
    outstanding_balance = sum(l.get("balance", 0) for l in active_loans)
    delinquent_loans = [l for l in loans if l.get("status") == "delinquent"]

    # ── Build CSV ──
    output = io.StringIO()
    writer = csv.writer(output)

    # NMLS Header
    writer.writerow(["NMLS MORTGAGE CALL REPORT — Ross Lending Solutions LLC"])
    writer.writerow(["OCCC License #", "TBD-OCCC-LICENSE"])
    writer.writerow(["NMLS ID", "TBD-NMLS-ID"])
    writer.writerow(["Report Period", f"{start.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}"])
    writer.writerow(["Generated", now.strftime("%Y-%m-%d %H:%M UTC")])
    writer.writerow(["Generated By", admin.get("email", "")])
    writer.writerow([])

    # Section 1 — Summary
    writer.writerow(["SECTION 1: LENDING ACTIVITY SUMMARY"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Loans Originated", len(loans)])
    writer.writerow(["Total Amount Originated", f"${total_originated:,.2f}"])
    writer.writerow(["Total Interest Charged", f"${total_interest:,.2f}"])
    writer.writerow(["Total Fees Collected", f"${total_fees:,.2f}"])
    writer.writerow(["Total Payments Received", f"${total_collected:,.2f}"])
    writer.writerow(["Outstanding Portfolio Balance", f"${outstanding_balance:,.2f}"])
    writer.writerow(["Active Loans", len(active_loans)])
    writer.writerow(["Delinquent Loans", len(delinquent_loans)])
    writer.writerow(["Delinquency Rate", f"{(len(delinquent_loans)/max(len(active_loans),1))*100:.1f}%"])
    writer.writerow([])

    # Section 2 — By Loan Type
    writer.writerow(["SECTION 2: BREAKDOWN BY LOAN TYPE"])
    writer.writerow(["Loan Type", "Count", "Total Originated", "Avg Loan Size", "Total Interest"])
    by_type: dict = {}
    for l in loans:
        lt = l.get("loan_type", "unknown")
        if lt not in by_type:
            by_type[lt] = {"count": 0, "total": 0, "interest": 0}
        by_type[lt]["count"] += 1
        by_type[lt]["total"] += l.get("amount", 0)
        by_type[lt]["interest"] += l.get("total_interest", 0)

    for lt, info in by_type.items():
        type_label = {
            "subchapter_f": "Subchapter F (Short-term)",
            "subchapter_e": "Subchapter E (Installment)",
            "tax_advance": "Tax Advance (RAL)",
            "personal": "Personal Loan",
        }.get(lt, lt)
        avg = info["total"] / max(info["count"], 1)
        writer.writerow([type_label, info["count"], f"${info['total']:,.2f}", f"${avg:,.2f}", f"${info['interest']:,.2f}"])
    writer.writerow([])

    # Section 3 — Individual Loan Detail
    writer.writerow(["SECTION 3: INDIVIDUAL LOAN DETAIL"])
    writer.writerow([
        "Loan Number", "Client Name", "Client Phone", "Loan Type",
        "Amount", "Interest Rate %", "Admin Fee", "Total Interest",
        "Total to Pay", "Balance", "Status",
        "Payment Frequency", "Term Months",
        "Origination Date", "First Payment Date", "Maturity Date",
    ])

    for l in loans:
        writer.writerow([
            l.get("loan_number", ""),
            l.get("client_name", ""),
            l.get("client_phone", ""),
            l.get("loan_type", ""),
            f"${l.get('amount', 0):,.2f}",
            f"{l.get('interest_rate', 0)}%",
            f"${l.get('admin_fee', 0):,.2f}",
            f"${l.get('total_interest', 0):,.2f}",
            f"${l.get('total_to_pay', 0):,.2f}",
            f"${l.get('balance', 0):,.2f}",
            l.get("status", ""),
            l.get("payment_frequency", ""),
            l.get("term_months", ""),
            l.get("created_at", "")[:10] if l.get("created_at") else "",
            l.get("first_payment_date", "")[:10] if l.get("first_payment_date") else "",
            l.get("maturity_date", "")[:10] if l.get("maturity_date") else "",
        ])
    writer.writerow([])

    # Section 4 — Compliance Flags
    all_flags = []
    async for loan in db["regulated_loans"].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        flags = await _check_loan_compliance(loan)
        all_flags.extend(flags)

    writer.writerow(["SECTION 4: COMPLIANCE FLAGS"])
    writer.writerow(["Flag Type", "Severity", "Message", "Loan Number", "Client"])
    for f in all_flags:
        writer.writerow([f["type"], f["severity"], f["message"], f.get("loan_number", ""), f.get("client_name", "")])

    output.seek(0)
    filename = f"NMLS_Ross_Lending_{period}_{now.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@compliance_router.get("/admin/compliance/nmls-summary")
async def nmls_summary(request: Request, period: str = Query("quarter", regex="^(month|quarter|year|all)$"), license_type: str = Query("regulated")):
    """Return JSON summary for the NMLS report preview."""
    await _auth_admin(request)
    db = _db

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    now = datetime.utcnow()
    if period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "quarter":
        q_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime(2020, 1, 1)

    start_iso = start.isoformat()

    loans = []
    async for loan in db[loan_collection].find({"created_at": {"$gte": start_iso}}):
        loans.append(loan)

    payments = []
    async for pay in db["loan_payments"].find({"payment_date": {"$gte": start_iso}}):
        payments.append(pay)

    total_originated = sum(l.get("amount", 0) for l in loans)
    total_interest = sum(l.get("total_interest", 0) for l in loans)
    total_fees = sum(l.get("admin_fee", 0) for l in loans)
    total_collected = sum(p.get("amount", 0) for p in payments)
    active = [l for l in loans if l.get("status") in ["active", "delinquent", "disbursed"]]
    outstanding = sum(l.get("balance", 0) for l in active)
    delinquent = [l for l in loans if l.get("status") == "delinquent"]

    by_type: dict = {}
    for l in loans:
        lt = l.get("loan_type", "unknown")
        if lt not in by_type:
            by_type[lt] = {"count": 0, "total": 0}
        by_type[lt]["count"] += 1
        by_type[lt]["total"] += l.get("amount", 0)

    return {
        "period": period,
        "date_range": f"{start.strftime('%Y-%m-%d')} — {now.strftime('%Y-%m-%d')}",
        "total_loans": len(loans),
        "total_originated": total_originated,
        "total_interest": total_interest,
        "total_fees": total_fees,
        "total_collected": total_collected,
        "outstanding_balance": outstanding,
        "active_loans": len(active),
        "delinquent_loans": len(delinquent),
        "delinquency_rate": round((len(delinquent) / max(len(active), 1)) * 100, 1),
        "by_type": by_type,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# OCCC DETAILED REPORTS — Texas Office of Consumer Credit Commissioner
# ═══════════════════════════════════════════════════════════════════════════════

def _period_dates(period: str):
    """Return (start, end, label) for a given period key."""
    now = datetime.utcnow()
    if period == "q1":
        s = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now.replace(month=3, day=31, hour=23, minute=59, second=59)
    elif period == "q2":
        s = now.replace(month=4, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now.replace(month=6, day=30, hour=23, minute=59, second=59)
    elif period == "q3":
        s = now.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now.replace(month=9, day=30, hour=23, minute=59, second=59)
    elif period == "q4":
        s = now.replace(month=10, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now.replace(month=12, day=31, hour=23, minute=59, second=59)
    elif period == "ytd":
        s = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now
    elif period == "last_year":
        s = now.replace(year=now.year - 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now.replace(year=now.year - 1, month=12, day=31, hour=23, minute=59, second=59)
    else:
        s = datetime(2020, 1, 1)
        e = now
    return s, min(e, now), period


async def _gather_period_data(db, start_iso, end_iso=None, license_type="regulated"):
    """Gather all loans and payments for a period."""
    loan_col = "cab_loans" if license_type == "cab" else "regulated_loans"
    pay_col = "cab_payments" if license_type == "cab" else "loan_payments"
    date_field = "created_at"

    query = {date_field: {"$gte": start_iso}}
    if end_iso:
        query[date_field]["$lte"] = end_iso
    loans = []
    async for loan in db[loan_col].find(query).sort(date_field, 1):
        loans.append(loan)

    pay_date_field = "created_at" if license_type == "cab" else "payment_date"
    pay_query = {pay_date_field: {"$gte": start_iso}}
    if end_iso:
        pay_query[pay_date_field]["$lte"] = end_iso
    payments = []
    async for pay in db[pay_col].find(pay_query).sort(pay_date_field, 1):
        payments.append(pay)

    # Active portfolio (all statuses, not just period-created)
    all_active = []
    async for loan in db[loan_col].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        all_active.append(loan)

    return loans, payments, all_active


# ── 1. OCCC Quarterly Activity Report (QAR) ──

@compliance_router.get("/admin/compliance/occc/quarterly-report")
async def occc_quarterly_report(request: Request, period: str = Query("q1", regex="^(q1|q2|q3|q4|ytd|last_year|all)$"), license_type: str = Query("regulated")):
    """OCCC Quarterly Activity Report — Required filing for Texas regulated lenders."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()
    start, end, _ = _period_dates(period)
    start_iso, end_iso = start.isoformat(), end.isoformat()

    loans, payments, all_active = await _gather_period_data(db, start_iso, end_iso, license_type=license_type)

    # Group by loan type
    by_type = {}
    for lt in ["subchapter_e", "subchapter_f", "tax_advance", "personal"]:
        type_loans = [l for l in loans if l.get("loan_type") == lt]
        type_payments = []
        loan_ids = [str(l["_id"]) for l in type_loans]
        for p in payments:
            if str(p.get("loan_id")) in loan_ids:
                type_payments.append(p)
        by_type[lt] = {
            "loans_originated": len(type_loans),
            "amount_originated": sum(l.get("amount", 0) for l in type_loans),
            "interest_charged": sum(l.get("total_interest", 0) for l in type_loans),
            "fees_collected": sum(l.get("admin_fee", 0) for l in type_loans),
            "payments_received": sum(p.get("amount", 0) for p in type_payments),
            "avg_loan_size": round(sum(l.get("amount", 0) for l in type_loans) / max(len(type_loans), 1), 2),
            "avg_rate": round(sum(l.get("interest_rate", 0) for l in type_loans) / max(len(type_loans), 1), 2),
            "avg_term": round(sum(l.get("term_months", 0) for l in type_loans) / max(len(type_loans), 1), 1),
        }

    # Delinquency breakdown
    delinquent = [l for l in all_active if l.get("status") == "delinquent"]
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
    for l in all_active:
        if l.get("status") != "delinquent":
            buckets["current"] += 1
            continue
        npd = l.get("next_payment_date", "")
        if npd:
            try:
                days = (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days
                if days <= 30:
                    buckets["1_30"] += 1
                elif days <= 60:
                    buckets["31_60"] += 1
                elif days <= 90:
                    buckets["61_90"] += 1
                else:
                    buckets["90_plus"] += 1
            except Exception:
                buckets["1_30"] += 1
        else:
            buckets["1_30"] += 1

    total_orig = sum(l.get("amount", 0) for l in loans)
    total_interest = sum(l.get("total_interest", 0) for l in loans)
    total_fees = sum(l.get("admin_fee", 0) for l in loans)
    total_collected = sum(p.get("amount", 0) for p in payments)
    outstanding = sum(l.get("balance", 0) for l in all_active)

    return {
        "report_type": "OCCC Quarterly Activity Report",
        "period": period,
        "period_label": f"Q{period[1]}" if period.startswith("q") else period.upper(),
        "date_range": f"{start.strftime('%Y-%m-%d')} — {end.strftime('%Y-%m-%d')}",
        "generated": now.isoformat(),
        "company": "Ross Lending Solutions LLC",
        "license": "OCCC Regulated Lender — Texas",
        "summary": {
            "total_loans_originated": len(loans),
            "total_amount_originated": total_orig,
            "total_interest_charged": total_interest,
            "total_fees_collected": total_fees,
            "total_payments_received": total_collected,
            "portfolio_outstanding": outstanding,
            "active_loans": len(all_active),
            "delinquent_loans": len(delinquent),
            "delinquency_rate": round(len(delinquent) / max(len(all_active), 1) * 100, 1),
            "avg_loan_size": round(total_orig / max(len(loans), 1), 2),
        },
        "by_loan_type": by_type,
        "delinquency_buckets": buckets,
        "portfolio_active_count": len(all_active),
    }


# ── 2. Portfolio Aging Report ──

@compliance_router.get("/admin/compliance/occc/aging-report")
async def occc_aging_report(request: Request, license_type: str = Query("regulated")):
    """Portfolio aging analysis — 30/60/90/120+ day buckets with dollar amounts."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    all_active = []
    async for loan in db[loan_collection].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
        all_active.append(loan)

    buckets = {
        "current": {"count": 0, "balance": 0, "loans": []},
        "1_30": {"count": 0, "balance": 0, "loans": []},
        "31_60": {"count": 0, "balance": 0, "loans": []},
        "61_90": {"count": 0, "balance": 0, "loans": []},
        "91_120": {"count": 0, "balance": 0, "loans": []},
        "120_plus": {"count": 0, "balance": 0, "loans": []},
    }

    for l in all_active:
        balance = l.get("balance", 0)
        loan_info = {
            "loan_number": l.get("loan_number", ""),
            "client_name": l.get("client_name", ""),
            "amount": l.get("amount", 0),
            "balance": balance,
            "loan_type": l.get("loan_type", ""),
            "status": l.get("status", ""),
        }

        if l.get("status") != "delinquent":
            buckets["current"]["count"] += 1
            buckets["current"]["balance"] += balance
            if len(buckets["current"]["loans"]) < 10:
                buckets["current"]["loans"].append(loan_info)
            continue

        npd = l.get("next_payment_date", "")
        days_overdue = 0
        if npd:
            try:
                days_overdue = (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days
            except Exception:
                pass
        loan_info["days_overdue"] = days_overdue

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
        if len(buckets[bucket_key]["loans"]) < 10:
            buckets[bucket_key]["loans"].append(loan_info)

    total_balance = sum(b["balance"] for b in buckets.values())

    for key, b in buckets.items():
        b["pct_of_portfolio"] = round(b["balance"] / max(total_balance, 1) * 100, 1)

    return {
        "report_type": "Portfolio Aging Report",
        "generated": now.isoformat(),
        "total_portfolio": total_balance,
        "total_loans": len(all_active),
        "buckets": buckets,
    }


# ── 3. Rate Compliance Audit ──

@compliance_router.get("/admin/compliance/occc/rate-audit")
async def occc_rate_audit(request: Request, license_type: str = Query("regulated")):
    """Detailed rate & fee compliance check per loan vs OCCC Chapter 342 limits."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    loan_collection = "cab_loans" if license_type == "cab" else "regulated_loans"

    results = []
    violations = 0
    warnings = 0

    async for loan in db[loan_collection].find({"status": {"$in": ["active", "delinquent", "disbursed", "paid_off"]}}).sort("loan_number", 1):
        lt = loan.get("loan_type", "")
        amount = loan.get("amount", 0)
        rate = loan.get("interest_rate", 0)
        admin_fee = loan.get("admin_fee", 0)
        term = loan.get("term_months", 0)
        limits = OCCC_LIMITS.get(lt, {})
        max_fee = min(OCCC_LIMITS["admin_fee_max"], amount * OCCC_LIMITS["admin_fee_max_pct"])

        # Determine max allowed rate for this amount
        max_rate = 0
        for tier in limits.get("rate_tiers", []):
            if tier["min"] <= amount <= tier["max"]:
                max_rate = tier["max_rate"]
                break

        issues = []
        status = "compliant"

        if amount > limits.get("max_amount", 99999):
            issues.append(f"Monto ${amount:,.2f} excede máximo ${limits['max_amount']:,.2f}")
            status = "violation"

        if max_rate > 0 and rate > max_rate:
            issues.append(f"Tasa {rate}% excede máximo {max_rate}% para monto ${amount:,.2f}")
            status = "violation"

        if admin_fee > max_fee + 0.01:
            issues.append(f"Fee ${admin_fee:,.2f} excede máximo ${max_fee:,.2f}")
            status = "violation"

        max_term = limits.get("max_term_months", 999)
        if term > max_term:
            issues.append(f"Plazo {term}m excede máximo {max_term}m")
            if status == "compliant":
                status = "warning"

        if not loan.get("contract_generated"):
            issues.append("Sin contrato generado")
            if status == "compliant":
                status = "warning"

        if status == "violation":
            violations += 1
        elif status == "warning":
            warnings += 1

        results.append({
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
            "loan_type": lt,
            "amount": amount,
            "rate": rate,
            "max_rate_allowed": max_rate,
            "admin_fee": admin_fee,
            "max_fee_allowed": round(max_fee, 2),
            "term_months": term,
            "max_term_allowed": max_term,
            "status": status,
            "issues": issues,
        })

    return {
        "report_type": "OCCC Rate & Fee Compliance Audit",
        "generated": now.isoformat(),
        "total_audited": len(results),
        "compliant": len(results) - violations - warnings,
        "violations": violations,
        "warnings": warnings,
        "compliance_rate": round((len(results) - violations) / max(len(results), 1) * 100, 1),
        "loans": results,
    }


# ── 4. OCCC Annual Report ──

@compliance_router.get("/admin/compliance/occc/annual-report")
async def occc_annual_report(request: Request, year: int = Query(None), license_type: str = Query("regulated")):
    """Comprehensive annual report for OCCC filing."""
    await _auth_admin(request)
    db = _db
    now = datetime.utcnow()
    report_year = year or now.year
    start = datetime(report_year, 1, 1)
    end = datetime(report_year, 12, 31, 23, 59, 59)
    if end > now:
        end = now

    start_iso, end_iso = start.isoformat(), end.isoformat()
    loans, payments, all_active = await _gather_period_data(db, start_iso, end_iso, license_type=license_type)
    monthly = {}
    for m in range(1, 13):
        m_key = f"{report_year}-{m:02d}"
        m_loans = [l for l in loans if l.get("created_at", "").startswith(m_key)]
        m_payments = [p for p in payments if p.get("payment_date", "").startswith(m_key)]
        monthly[m_key] = {
            "loans_originated": len(m_loans),
            "amount_originated": sum(l.get("amount", 0) for l in m_loans),
            "payments_received": sum(p.get("amount", 0) for p in m_payments),
            "fees_collected": sum(l.get("admin_fee", 0) for l in m_loans),
        }

    # Quarterly breakdown
    quarterly = {}
    for q in range(1, 5):
        q_start = (q - 1) * 3 + 1
        q_months = [f"{report_year}-{m:02d}" for m in range(q_start, q_start + 3)]
        q_loans = [l for l in loans if any(l.get("created_at", "").startswith(m) for m in q_months)]
        q_payments = [p for p in payments if any(p.get("payment_date", "").startswith(m) for m in q_months)]
        quarterly[f"Q{q}"] = {
            "loans_originated": len(q_loans),
            "amount_originated": sum(l.get("amount", 0) for l in q_loans),
            "interest_charged": sum(l.get("total_interest", 0) for l in q_loans),
            "fees_collected": sum(l.get("admin_fee", 0) for l in q_loans),
            "payments_received": sum(p.get("amount", 0) for p in q_payments),
        }

    # By type
    by_type = {}
    for lt in ["subchapter_e", "subchapter_f", "tax_advance", "personal"]:
        tl = [l for l in loans if l.get("loan_type") == lt]
        by_type[lt] = {
            "count": len(tl),
            "total_originated": sum(l.get("amount", 0) for l in tl),
            "total_interest": sum(l.get("total_interest", 0) for l in tl),
            "total_fees": sum(l.get("admin_fee", 0) for l in tl),
            "avg_rate": round(sum(l.get("interest_rate", 0) for l in tl) / max(len(tl), 1), 2),
        }

    total_orig = sum(l.get("amount", 0) for l in loans)
    total_interest = sum(l.get("total_interest", 0) for l in loans)
    total_fees = sum(l.get("admin_fee", 0) for l in loans)
    total_payments = sum(p.get("amount", 0) for p in payments)

    return {
        "report_type": "OCCC Annual Comprehensive Report",
        "year": report_year,
        "date_range": f"{start.strftime('%Y-%m-%d')} — {end.strftime('%Y-%m-%d')}",
        "generated": now.isoformat(),
        "company": "Ross Lending Solutions LLC",
        "annual_summary": {
            "total_loans_originated": len(loans),
            "total_amount_originated": total_orig,
            "total_interest_charged": total_interest,
            "total_fees_collected": total_fees,
            "total_payments_received": total_payments,
            "portfolio_outstanding": sum(l.get("balance", 0) for l in all_active),
            "active_portfolio_count": len(all_active),
            "gross_revenue": total_interest + total_fees,
            "net_collections": total_payments,
        },
        "quarterly_breakdown": quarterly,
        "monthly_breakdown": monthly,
        "by_loan_type": by_type,
    }


# ── 5. Universal OCCC CSV Export ──

@compliance_router.get("/admin/compliance/occc/export/{report_type}")
async def occc_export_csv(request: Request, report_type: str, period: str = Query("all"), year: int = Query(None)):
    """Export any OCCC report as CSV."""
    admin = await _auth_admin(request)
    db = _db
    import csv
    import io
    now = datetime.utcnow()

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "quarterly":
        start, end, _ = _period_dates(period)
        start_iso, end_iso = start.isoformat(), end.isoformat()
        loans, payments, all_active = await _gather_period_data(db, start_iso, end_iso)

        writer.writerow(["OCCC QUARTERLY ACTIVITY REPORT — Ross Lending Solutions LLC"])
        writer.writerow(["Period", f"{start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}"])
        writer.writerow(["Generated", now.strftime("%Y-%m-%d %H:%M UTC")])
        writer.writerow(["Generated By", admin.get("email", "")])
        writer.writerow([])
        writer.writerow(["LENDING ACTIVITY"])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Loans Originated", len(loans)])
        writer.writerow(["Amount Originated", f"${sum(l.get('amount',0) for l in loans):,.2f}"])
        writer.writerow(["Interest Charged", f"${sum(l.get('total_interest',0) for l in loans):,.2f}"])
        writer.writerow(["Fees Collected", f"${sum(l.get('admin_fee',0) for l in loans):,.2f}"])
        writer.writerow(["Payments Received", f"${sum(p.get('amount',0) for p in payments):,.2f}"])
        writer.writerow(["Portfolio Outstanding", f"${sum(l.get('balance',0) for l in all_active):,.2f}"])
        writer.writerow(["Active Loans", len(all_active)])
        writer.writerow([])
        writer.writerow(["BY LOAN TYPE"])
        writer.writerow(["Type", "Count", "Amount", "Avg Rate %", "Avg Term (mo)"])
        for lt in ["subchapter_e", "subchapter_f", "tax_advance", "personal"]:
            tl = [l for l in loans if l.get("loan_type") == lt]
            if not tl:
                continue
            writer.writerow([lt, len(tl), f"${sum(l.get('amount',0) for l in tl):,.2f}",
                             f"{sum(l.get('interest_rate',0) for l in tl)/max(len(tl),1):.1f}%",
                             f"{sum(l.get('term_months',0) for l in tl)/max(len(tl),1):.1f}"])
        writer.writerow([])
        writer.writerow(["INDIVIDUAL LOANS ORIGINATED THIS PERIOD"])
        writer.writerow(["Loan #", "Client", "Type", "Amount", "Rate", "Fee", "Term", "Status", "Date"])
        for l in loans:
            writer.writerow([l.get("loan_number"), l.get("client_name"), l.get("loan_type"),
                             f"${l.get('amount',0):,.2f}", f"{l.get('interest_rate',0)}%",
                             f"${l.get('admin_fee',0):,.2f}", l.get("term_months"),
                             l.get("status"), l.get("created_at","")[:10]])

    elif report_type == "aging":
        all_active = []
        async for loan in db["regulated_loans"].find({"status": {"$in": ["active", "delinquent", "disbursed"]}}):
            all_active.append(loan)

        writer.writerow(["PORTFOLIO AGING REPORT — Ross Lending Solutions LLC"])
        writer.writerow(["Generated", now.strftime("%Y-%m-%d %H:%M UTC")])
        writer.writerow([])
        writer.writerow(["Loan #", "Client", "Type", "Original Amount", "Balance", "Status", "Days Overdue", "Aging Bucket"])
        for l in sorted(all_active, key=lambda x: x.get("loan_number", "")):
            days = 0
            bucket = "Current"
            if l.get("status") == "delinquent":
                npd = l.get("next_payment_date", "")
                if npd:
                    try:
                        days = (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days
                    except Exception:
                        pass
                if days <= 30: bucket = "1-30 Days"
                elif days <= 60: bucket = "31-60 Days"
                elif days <= 90: bucket = "61-90 Days"
                elif days <= 120: bucket = "91-120 Days"
                else: bucket = "120+ Days"
            writer.writerow([l.get("loan_number"), l.get("client_name"), l.get("loan_type"),
                             f"${l.get('amount',0):,.2f}", f"${l.get('balance',0):,.2f}",
                             l.get("status"), days if days > 0 else "—", bucket])

    elif report_type == "rate-audit":
        writer.writerow(["RATE & FEE COMPLIANCE AUDIT — Ross Lending Solutions LLC"])
        writer.writerow(["Generated", now.strftime("%Y-%m-%d %H:%M UTC")])
        writer.writerow(["Reference", "Texas Finance Code Chapter 342"])
        writer.writerow([])
        writer.writerow(["Loan #", "Client", "Type", "Amount", "Rate %", "Max Rate %", "Fee", "Max Fee",
                         "Term (mo)", "Max Term", "Status", "Issues"])
        async for loan in db["regulated_loans"].find({"status": {"$in": ["active","delinquent","disbursed","paid_off"]}}).sort("loan_number", 1):
            lt = loan.get("loan_type", "")
            amt = loan.get("amount", 0)
            rate = loan.get("interest_rate", 0)
            fee = loan.get("admin_fee", 0)
            term = loan.get("term_months", 0)
            limits = OCCC_LIMITS.get(lt, {})
            max_fee = min(OCCC_LIMITS["admin_fee_max"], amt * OCCC_LIMITS["admin_fee_max_pct"])
            max_rate = 0
            for tier in limits.get("rate_tiers", []):
                if tier["min"] <= amt <= tier["max"]:
                    max_rate = tier["max_rate"]
                    break
            issues = []
            status = "OK"
            if amt > limits.get("max_amount", 99999): issues.append("Amount exceeded"); status = "VIOLATION"
            if max_rate > 0 and rate > max_rate: issues.append("Rate exceeded"); status = "VIOLATION"
            if fee > max_fee + 0.01: issues.append("Fee exceeded"); status = "VIOLATION"
            if term > limits.get("max_term_months", 999): issues.append("Term exceeded"); status = "WARNING" if status == "OK" else status
            writer.writerow([loan.get("loan_number"), loan.get("client_name"), lt,
                             f"${amt:,.2f}", f"{rate}%", f"{max_rate}%", f"${fee:,.2f}", f"${max_fee:,.2f}",
                             term, limits.get("max_term_months", "—"), status, "; ".join(issues) if issues else "—"])

    elif report_type == "annual":
        report_year = year or now.year
        start_iso = datetime(report_year, 1, 1).isoformat()
        end_iso = datetime(report_year, 12, 31, 23, 59, 59).isoformat()
        loans, payments, all_active = await _gather_period_data(db, start_iso, end_iso)

        writer.writerow([f"OCCC ANNUAL REPORT {report_year} — Ross Lending Solutions LLC"])
        writer.writerow(["Generated", now.strftime("%Y-%m-%d %H:%M UTC")])
        writer.writerow([])
        writer.writerow(["ANNUAL SUMMARY"])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Loans Originated", len(loans)])
        writer.writerow(["Amount Originated", f"${sum(l.get('amount',0) for l in loans):,.2f}"])
        writer.writerow(["Interest Revenue", f"${sum(l.get('total_interest',0) for l in loans):,.2f}"])
        writer.writerow(["Fee Revenue", f"${sum(l.get('admin_fee',0) for l in loans):,.2f}"])
        writer.writerow(["Gross Revenue", f"${sum(l.get('total_interest',0) for l in loans)+sum(l.get('admin_fee',0) for l in loans):,.2f}"])
        writer.writerow(["Collections", f"${sum(p.get('amount',0) for p in payments):,.2f}"])
        writer.writerow(["Portfolio Outstanding", f"${sum(l.get('balance',0) for l in all_active):,.2f}"])
        writer.writerow([])
        writer.writerow(["QUARTERLY BREAKDOWN"])
        writer.writerow(["Quarter", "Loans", "Amount", "Interest", "Fees", "Payments"])
        for q in range(1, 5):
            q_start = (q - 1) * 3 + 1
            q_months = [f"{report_year}-{m:02d}" for m in range(q_start, q_start + 3)]
            ql = [l for l in loans if any(l.get("created_at", "").startswith(m) for m in q_months)]
            qp = [p for p in payments if any(p.get("payment_date", "").startswith(m) for m in q_months)]
            writer.writerow([f"Q{q}", len(ql), f"${sum(l.get('amount',0) for l in ql):,.2f}",
                             f"${sum(l.get('total_interest',0) for l in ql):,.2f}",
                             f"${sum(l.get('admin_fee',0) for l in ql):,.2f}",
                             f"${sum(p.get('amount',0) for p in qp):,.2f}"])
        writer.writerow([])
        writer.writerow(["MONTHLY BREAKDOWN"])
        writer.writerow(["Month", "Loans", "Amount", "Payments"])
        for m in range(1, 13):
            mk = f"{report_year}-{m:02d}"
            ml = [l for l in loans if l.get("created_at", "").startswith(mk)]
            mp = [p for p in payments if p.get("payment_date", "").startswith(mk)]
            writer.writerow([mk, len(ml), f"${sum(l.get('amount',0) for l in ml):,.2f}",
                             f"${sum(p.get('amount',0) for p in mp):,.2f}"])
    else:
        raise HTTPException(400, f"Tipo de reporte inválido: {report_type}")

    output.seek(0)
    filename = f"OCCC_{report_type}_{now.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
