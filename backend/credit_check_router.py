"""
═══════════════════════════════════════════════════════════════════════════════
 Credit Check Router — Ross Lending Solutions LLC
 Soft/Hard Credit Pull interface for Underwriting decisions.
 Currently uses MOCK data — will integrate CRS Credit API / Equifax when
 the user provides production credentials.
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
import random
import string
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId

logger = logging.getLogger(__name__)

credit_check_router = APIRouter()

_db = None
_get_current_user = None

CREDIT_CHECKS_COLLECTION = "credit_checks"


def init_credit_check(db_instance, get_user_func):
    global _db, _get_current_user
    _db = db_instance
    _get_current_user = get_user_func
    logger.info("Credit Check Router initialized (MOCK MODE)")


async def _auth_admin(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(403, "Acceso denegado")
    return user


def _generate_reference():
    return "CR-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _generate_mock_credit_report(applicant_name: str, ssn_last4: str, pull_type: str):
    """Generate a realistic mock credit report for demo/training purposes."""
    score = random.randint(520, 820)

    # Determine credit grade based on score
    if score >= 750:
        grade = "Excelente"
        grade_color = "emerald"
    elif score >= 700:
        grade = "Bueno"
        grade_color = "blue"
    elif score >= 650:
        grade = "Regular"
        grade_color = "amber"
    elif score >= 580:
        grade = "Pobre"
        grade_color = "orange"
    else:
        grade = "Muy Pobre"
        grade_color = "red"

    # Generate tradelines
    num_tradelines = random.randint(3, 15)
    tradelines = []
    account_types = [
        "Tarjeta de Crédito", "Préstamo Auto", "Hipoteca",
        "Préstamo Personal", "Línea de Crédito", "Préstamo Estudiantil",
        "Tarjeta Tienda", "Financiamiento Muebles"
    ]
    creditors = [
        "Chase", "Bank of America", "Capital One", "Discover",
        "Wells Fargo", "Citi", "USAA", "American Express",
        "Toyota Financial", "Ford Motor Credit", "Synchrony"
    ]
    for i in range(num_tradelines):
        balance = random.randint(0, 25000)
        limit_or_orig = random.randint(balance, max(balance + 5000, 30000))
        opened = datetime.utcnow() - timedelta(days=random.randint(180, 3650))
        status_options = ["current", "current", "current", "current", "late_30", "late_60", "closed", "paid_off"]
        status = random.choice(status_options)
        tradelines.append({
            "creditor": random.choice(creditors),
            "account_type": random.choice(account_types),
            "account_number": f"****{random.randint(1000,9999)}",
            "opened_date": opened.strftime("%Y-%m-%d"),
            "balance": balance,
            "credit_limit": limit_or_orig,
            "monthly_payment": random.randint(25, 800),
            "status": status,
            "status_label": {
                "current": "Al Corriente",
                "late_30": "30 Días Mora",
                "late_60": "60 Días Mora",
                "closed": "Cerrada",
                "paid_off": "Pagada",
            }.get(status, status),
            "last_reported": (datetime.utcnow() - timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d"),
        })

    # Summary calculations
    total_balance = sum(t["balance"] for t in tradelines)
    total_limits = sum(t["credit_limit"] for t in tradelines if t["status"] not in ["closed", "paid_off"])
    utilization = round((total_balance / max(total_limits, 1)) * 100, 1)

    # Payment history
    on_time = random.randint(85, 100)
    late_30 = random.randint(0, min(10, 100 - on_time))
    late_60 = random.randint(0, min(5, 100 - on_time - late_30))
    late_90_plus = 100 - on_time - late_30 - late_60

    # Public records
    has_bankruptcy = random.random() < 0.05
    has_collections_accounts = random.random() < 0.15
    collections_accounts = []
    if has_collections_accounts:
        num_colls = random.randint(1, 3)
        for _ in range(num_colls):
            collections_accounts.append({
                "agency": random.choice(["Midland Credit", "Portfolio Recovery", "Encore Capital", "LVNV Funding"]),
                "original_creditor": random.choice(creditors),
                "balance": random.randint(200, 5000),
                "date_reported": (datetime.utcnow() - timedelta(days=random.randint(30, 730))).strftime("%Y-%m-%d"),
            })

    # Inquiries
    num_inquiries = random.randint(0, 8)
    inquiries = []
    for _ in range(num_inquiries):
        inquiries.append({
            "creditor": random.choice(creditors + ["Ross Lending Solutions"]),
            "date": (datetime.utcnow() - timedelta(days=random.randint(1, 730))).strftime("%Y-%m-%d"),
            "type": random.choice(["hard", "soft"]),
        })

    # Monthly income estimation (for DTI)
    estimated_monthly_income = random.randint(2500, 12000)
    total_monthly_payments = sum(t["monthly_payment"] for t in tradelines if t["status"] in ["current", "late_30", "late_60"])
    dti = round((total_monthly_payments / max(estimated_monthly_income, 1)) * 100, 1)

    return {
        "reference_number": _generate_reference(),
        "report_date": datetime.utcnow().isoformat(),
        "applicant_name": applicant_name,
        "ssn_masked": f"***-**-{ssn_last4}",
        "pull_type": pull_type,
        "bureau": random.choice(["Equifax", "TransUnion", "Experian"]),

        "score": {
            "value": score,
            "grade": grade,
            "grade_color": grade_color,
            "model": "FICO Score 8",
            "range": "300-850",
        },

        "summary": {
            "total_accounts": num_tradelines,
            "open_accounts": sum(1 for t in tradelines if t["status"] not in ["closed", "paid_off"]),
            "closed_accounts": sum(1 for t in tradelines if t["status"] in ["closed", "paid_off"]),
            "total_balance": total_balance,
            "total_credit_limit": total_limits,
            "utilization_pct": utilization,
            "oldest_account_years": round((datetime.utcnow() - min(datetime.strptime(t["opened_date"], "%Y-%m-%d") for t in tradelines)).days / 365, 1) if tradelines else 0,
            "recent_inquiries_6mo": sum(1 for i in inquiries if (datetime.utcnow() - datetime.strptime(i["date"], "%Y-%m-%d")).days <= 180 and i["type"] == "hard"),
            "total_monthly_payments": total_monthly_payments,
            "estimated_dti": dti,
        },

        "payment_history": {
            "on_time_pct": on_time,
            "late_30_pct": late_30,
            "late_60_pct": late_60,
            "late_90_plus_pct": late_90_plus,
        },

        "tradelines": sorted(tradelines, key=lambda x: x["balance"], reverse=True),

        "derogatory": {
            "bankruptcy": has_bankruptcy,
            "bankruptcy_type": "Chapter 7" if has_bankruptcy else None,
            "bankruptcy_date": (datetime.utcnow() - timedelta(days=random.randint(365, 3650))).strftime("%Y-%m-%d") if has_bankruptcy else None,
            "collections_count": len(collections_accounts),
            "collections_accounts": collections_accounts,
            "judgments": 0,
            "tax_liens": 0,
        },

        "inquiries": sorted(inquiries, key=lambda x: x["date"], reverse=True),

        "recommendation": {
            "risk_level": "low" if score >= 700 else "medium" if score >= 620 else "high",
            "max_recommended_amount": min(10000, max(500, (score - 500) * 30)) if score >= 520 else 0,
            "suggested_rate_range": f"{max(10, 35 - (score - 500) * 0.08):.1f}% - {max(12, 38 - (score - 500) * 0.08):.1f}%",
            "auto_decision": "approve" if score >= 680 else "review" if score >= 580 else "decline",
            "notes": _get_recommendation_notes(score, dti, utilization, has_bankruptcy, len(collections_accounts)),
        },

        "_mock_data": True,
    }


def _get_recommendation_notes(score, dti, utilization, bankruptcy, collections):
    notes = []
    if score >= 700:
        notes.append("Excelente historial crediticio. Bajo riesgo.")
    elif score >= 650:
        notes.append("Historial crediticio aceptable. Riesgo moderado.")
    elif score >= 580:
        notes.append("Historial crediticio limitado. Considere garantías adicionales.")
    else:
        notes.append("Alto riesgo. Requiere revisión manual detallada.")

    if dti > 45:
        notes.append(f"DTI elevado ({dti}%). Capacidad de pago limitada.")
    elif dti > 35:
        notes.append(f"DTI moderado ({dti}%). Monitorear capacidad de pago.")

    if utilization > 75:
        notes.append(f"Utilización de crédito alta ({utilization}%).")

    if bankruptcy:
        notes.append("⚠️ BANCARROTA en récord. Verificar fecha y tipo.")

    if collections > 0:
        notes.append(f"⚠️ {collections} cuenta(s) en colecciones.")

    return notes


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@credit_check_router.post("/admin/credit-check/pull")
async def pull_credit_report(request: Request, body: dict = Body(...)):
    """Initiate a credit pull for an applicant. Returns mock data."""
    admin = await _auth_admin(request)
    db = _db

    applicant_name = body.get("applicant_name", "").strip()
    ssn = body.get("ssn", "").strip().replace("-", "")
    pull_type = body.get("pull_type", "soft")  # soft or hard
    applicant_id = body.get("applicant_id")  # Optional link to loan application

    if not applicant_name:
        raise HTTPException(400, "Nombre del aplicante es requerido")
    if len(ssn) < 4:
        raise HTTPException(400, "SSN requerido (mínimo últimos 4 dígitos)")

    ssn_last4 = ssn[-4:]

    # Generate mock report
    report = _generate_mock_credit_report(applicant_name, ssn_last4, pull_type)

    # Save to database
    record = {
        "applicant_name": applicant_name,
        "ssn_last4": ssn_last4,
        "ssn_hash": None,  # In production: hash the full SSN
        "pull_type": pull_type,
        "bureau": report["bureau"],
        "score": report["score"]["value"],
        "grade": report["score"]["grade"],
        "risk_level": report["recommendation"]["risk_level"],
        "auto_decision": report["recommendation"]["auto_decision"],
        "dti": report["summary"]["estimated_dti"],
        "report_data": report,
        "applicant_id": applicant_id,
        "pulled_by": admin.get("email", ""),
        "pulled_at": datetime.utcnow().isoformat(),
        "status": "completed",
        "_mock_data": True,
    }

    result = await db[CREDIT_CHECKS_COLLECTION].insert_one(record)

    # Log audit
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(
            user_id=str(admin.get("id")),
            user_name=admin.get("email", ""),
            action=f"credit_pull_{pull_type}",
            module="underwriting",
            severity="warning" if pull_type == "hard" else "info",
            details={
                "applicant": applicant_name,
                "ssn_last4": ssn_last4,
                "score": report["score"]["value"],
                "bureau": report["bureau"],
            },
        )
    except Exception:
        pass

    report["_id"] = str(result.inserted_id)
    return report


@credit_check_router.get("/admin/credit-check/history")
async def credit_check_history(
    request: Request,
    search: str = Query(""),
    pull_type: str = Query(""),
    risk: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """Get credit check history with filters."""
    await _auth_admin(request)
    db = _db

    query = {}
    if search:
        query["$or"] = [
            {"applicant_name": {"$regex": search, "$options": "i"}},
            {"ssn_last4": {"$regex": search}},
        ]
    if pull_type:
        query["pull_type"] = pull_type
    if risk:
        query["risk_level"] = risk

    total = await db[CREDIT_CHECKS_COLLECTION].count_documents(query)
    checks = []
    async for doc in db[CREDIT_CHECKS_COLLECTION].find(query).sort("pulled_at", -1).skip(skip).limit(limit):
        doc["_id"] = str(doc["_id"])
        # Don't return full report data in list view
        doc.pop("report_data", None)
        checks.append(doc)

    # Stats
    total_checks = await db[CREDIT_CHECKS_COLLECTION].count_documents({})
    hard_pulls = await db[CREDIT_CHECKS_COLLECTION].count_documents({"pull_type": "hard"})
    soft_pulls = await db[CREDIT_CHECKS_COLLECTION].count_documents({"pull_type": "soft"})

    pipeline = [
        {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}}
    ]
    avg_result = await db[CREDIT_CHECKS_COLLECTION].aggregate(pipeline).to_list(1)
    avg_score = round(avg_result[0]["avg_score"]) if avg_result and avg_result[0].get("avg_score") else 0

    return {
        "checks": checks,
        "total": total,
        "stats": {
            "total_checks": total_checks,
            "hard_pulls": hard_pulls,
            "soft_pulls": soft_pulls,
            "avg_score": avg_score,
        },
    }


@credit_check_router.get("/admin/credit-check/{check_id}")
async def get_credit_check(request: Request, check_id: str):
    """Get a specific credit check with full report."""
    await _auth_admin(request)
    db = _db

    try:
        doc = await db[CREDIT_CHECKS_COLLECTION].find_one({"_id": ObjectId(check_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if not doc:
        raise HTTPException(404, "Reporte no encontrado")

    doc["_id"] = str(doc["_id"])
    return doc


@credit_check_router.delete("/admin/credit-check/{check_id}")
async def delete_credit_check(request: Request, check_id: str):
    """Delete a credit check record."""
    await _auth_admin(request)
    db = _db

    try:
        result = await db[CREDIT_CHECKS_COLLECTION].delete_one({"_id": ObjectId(check_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if result.deleted_count == 0:
        raise HTTPException(404, "Reporte no encontrado")

    return {"success": True, "message": "Reporte eliminado"}
