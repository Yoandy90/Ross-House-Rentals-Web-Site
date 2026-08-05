"""
═══════════════════════════════════════════════════════════════════════════════
 Approval Rules Engine — Ross Lending Solutions LLC
 Configurable scoring & auto-decision rules for loan underwriting.
 Admin defines rules → system auto-evaluates applications.
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId

logger = logging.getLogger(__name__)

approval_engine_router = APIRouter()
_db = None
_get_current_user = None

RULES_COLLECTION = "approval_rules"
EVAL_HISTORY_COLLECTION = "approval_evaluations"

# Default rules that ship with the system
DEFAULT_RULES = [
    {
        "name": "Auto-Aprobar Score Alto",
        "description": "Score FICO ≥ 680, DTI ≤ 40%, sin bancarrota, sin colecciones",
        "priority": 1,
        "active": True,
        "conditions": [
            {"field": "credit_score", "operator": ">=", "value": 680},
            {"field": "dti", "operator": "<=", "value": 40},
            {"field": "has_bankruptcy", "operator": "==", "value": False},
            {"field": "collections_count", "operator": "==", "value": 0},
        ],
        "action": "auto_approve",
        "max_amount": 10000,
        "suggested_rate_min": 10.0,
        "suggested_rate_max": 18.0,
    },
    {
        "name": "Revisión Manual - Score Medio",
        "description": "Score 580-679 O DTI 40-50%",
        "priority": 2,
        "active": True,
        "conditions": [
            {"field": "credit_score", "operator": ">=", "value": 580},
            {"field": "credit_score", "operator": "<", "value": 680},
        ],
        "action": "manual_review",
        "max_amount": 5000,
        "suggested_rate_min": 18.0,
        "suggested_rate_max": 28.0,
    },
    {
        "name": "Auto-Rechazar Score Bajo",
        "description": "Score < 520 O bancarrota activa",
        "priority": 3,
        "active": True,
        "conditions": [
            {"field": "credit_score", "operator": "<", "value": 520},
        ],
        "action": "auto_decline",
        "decline_reason": "Score crediticio por debajo del mínimo requerido",
    },
    {
        "name": "Auto-Rechazar DTI Alto",
        "description": "DTI > 55% - capacidad de pago insuficiente",
        "priority": 4,
        "active": True,
        "conditions": [
            {"field": "dti", "operator": ">", "value": 55},
        ],
        "action": "auto_decline",
        "decline_reason": "Relación deuda-ingreso excede el máximo permitido",
    },
    {
        "name": "Bancarrota Reciente",
        "description": "Bancarrota en los últimos 2 años",
        "priority": 5,
        "active": True,
        "conditions": [
            {"field": "has_bankruptcy", "operator": "==", "value": True},
        ],
        "action": "manual_review",
        "max_amount": 2000,
        "suggested_rate_min": 25.0,
        "suggested_rate_max": 30.0,
        "notes": "Requiere revisión de fecha de bancarrota y tipo",
    },
]


def init_approval_engine(db_instance, get_user_func):
    global _db, _get_current_user
    _db = db_instance
    _get_current_user = get_user_func
    logger.info("Approval Rules Engine initialized")


async def _auth_admin(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(403, "Acceso denegado")
    return user


def _evaluate_condition(condition: dict, applicant_data: dict) -> bool:
    """Evaluate a single condition against applicant data."""
    field = condition.get("field", "")
    operator = condition.get("operator", "==")
    value = condition.get("value")

    actual = applicant_data.get(field)
    if actual is None:
        return False

    try:
        if operator == "==":
            return actual == value
        elif operator == "!=":
            return actual != value
        elif operator == ">":
            return float(actual) > float(value)
        elif operator == ">=":
            return float(actual) >= float(value)
        elif operator == "<":
            return float(actual) < float(value)
        elif operator == "<=":
            return float(actual) <= float(value)
        elif operator == "in":
            return actual in value
        elif operator == "not_in":
            return actual not in value
    except (ValueError, TypeError):
        return False

    return False


def evaluate_application(rules: list, applicant_data: dict) -> dict:
    """Evaluate an application against all active rules. Returns decision."""
    matched_rules = []

    for rule in sorted(rules, key=lambda r: r.get("priority", 99)):
        if not rule.get("active", True):
            continue

        conditions = rule.get("conditions", [])
        all_match = all(_evaluate_condition(c, applicant_data) for c in conditions)

        if all_match:
            matched_rules.append({
                "rule_name": rule.get("name"),
                "action": rule.get("action"),
                "max_amount": rule.get("max_amount"),
                "rate_range": f"{rule.get('suggested_rate_min', 0)}-{rule.get('suggested_rate_max', 0)}%",
                "notes": rule.get("notes", ""),
                "decline_reason": rule.get("decline_reason", ""),
            })

            # First matching rule wins (by priority)
            return {
                "decision": rule.get("action"),
                "decision_label": {
                    "auto_approve": "✅ Auto-Aprobado",
                    "manual_review": "⚠️ Revisión Manual",
                    "auto_decline": "❌ Auto-Rechazado",
                }.get(rule.get("action"), "Desconocido"),
                "matched_rule": rule.get("name"),
                "max_amount": rule.get("max_amount", 0),
                "suggested_rate_min": rule.get("suggested_rate_min", 0),
                "suggested_rate_max": rule.get("suggested_rate_max", 0),
                "decline_reason": rule.get("decline_reason", ""),
                "notes": rule.get("notes", ""),
                "all_matched_rules": matched_rules,
                "applicant_data": applicant_data,
            }

    # No rules matched → default to manual review
    return {
        "decision": "manual_review",
        "decision_label": "⚠️ Revisión Manual (sin regla aplicable)",
        "matched_rule": None,
        "max_amount": 0,
        "all_matched_rules": [],
        "applicant_data": applicant_data,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@approval_engine_router.get("/admin/approval-rules")
async def list_rules(request: Request):
    """List all approval rules."""
    await _auth_admin(request)
    db = _db

    rules = []
    async for r in db[RULES_COLLECTION].find().sort("priority", 1):
        r["_id"] = str(r["_id"])
        rules.append(r)

    # If no rules, seed defaults
    if not rules:
        for rule in DEFAULT_RULES:
            rule["created_at"] = datetime.utcnow().isoformat()
            rule["created_by"] = "system"
            await db[RULES_COLLECTION].insert_one(rule)
        # Re-fetch
        rules = []
        async for r in db[RULES_COLLECTION].find().sort("priority", 1):
            r["_id"] = str(r["_id"])
            rules.append(r)

    return {"rules": rules, "total": len(rules)}


@approval_engine_router.post("/admin/approval-rules")
async def create_rule(request: Request, body: dict = Body(...)):
    """Create a new approval rule."""
    admin = await _auth_admin(request)
    db = _db

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name es requerido")

    rule = {
        "name": name,
        "description": body.get("description", ""),
        "priority": body.get("priority", 10),
        "active": body.get("active", True),
        "conditions": body.get("conditions", []),
        "action": body.get("action", "manual_review"),
        "max_amount": body.get("max_amount", 0),
        "suggested_rate_min": body.get("suggested_rate_min", 0),
        "suggested_rate_max": body.get("suggested_rate_max", 0),
        "decline_reason": body.get("decline_reason", ""),
        "notes": body.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": admin.get("email", ""),
    }

    result = await db[RULES_COLLECTION].insert_one(rule)
    rule["_id"] = str(result.inserted_id)
    return {"success": True, "rule": rule}


@approval_engine_router.put("/admin/approval-rules/{rule_id}")
async def update_rule(request: Request, rule_id: str, body: dict = Body(...)):
    """Update an existing rule."""
    admin = await _auth_admin(request)
    db = _db

    update = {}
    for field in ["name", "description", "priority", "active", "conditions", "action",
                   "max_amount", "suggested_rate_min", "suggested_rate_max",
                   "decline_reason", "notes"]:
        if field in body:
            update[field] = body[field]

    update["updated_at"] = datetime.utcnow().isoformat()
    update["updated_by"] = admin.get("email", "")

    try:
        result = await db[RULES_COLLECTION].update_one(
            {"_id": ObjectId(rule_id)}, {"$set": update}
        )
    except Exception:
        raise HTTPException(400, "ID inválido")

    if result.modified_count == 0:
        raise HTTPException(404, "Regla no encontrada")

    return {"success": True, "message": "Regla actualizada"}


@approval_engine_router.delete("/admin/approval-rules/{rule_id}")
async def delete_rule(request: Request, rule_id: str):
    """Delete a rule."""
    await _auth_admin(request)
    db = _db

    try:
        result = await db[RULES_COLLECTION].delete_one({"_id": ObjectId(rule_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if result.deleted_count == 0:
        raise HTTPException(404, "Regla no encontrada")

    return {"success": True, "message": "Regla eliminada"}


@approval_engine_router.post("/admin/approval-rules/evaluate")
async def evaluate_applicant(request: Request, body: dict = Body(...)):
    """Evaluate an applicant against all active rules."""
    admin = await _auth_admin(request)
    db = _db

    applicant_data = {
        "credit_score": body.get("credit_score", 0),
        "dti": body.get("dti", 0),
        "has_bankruptcy": body.get("has_bankruptcy", False),
        "collections_count": body.get("collections_count", 0),
        "monthly_income": body.get("monthly_income", 0),
        "requested_amount": body.get("requested_amount", 0),
        "employment_months": body.get("employment_months", 0),
        "open_accounts": body.get("open_accounts", 0),
        "utilization": body.get("utilization", 0),
    }

    # Fetch rules
    rules = []
    async for r in db[RULES_COLLECTION].find({"active": True}).sort("priority", 1):
        r["_id"] = str(r["_id"])
        rules.append(r)

    if not rules:
        # Seed defaults if empty
        for rule in DEFAULT_RULES:
            rule["created_at"] = datetime.utcnow().isoformat()
            rule["created_by"] = "system"
            await db[RULES_COLLECTION].insert_one(rule)
        rules = DEFAULT_RULES

    result = evaluate_application(rules, applicant_data)

    # Save evaluation
    eval_record = {
        **result,
        "evaluated_by": admin.get("email", ""),
        "evaluated_at": datetime.utcnow().isoformat(),
        "applicant_name": body.get("applicant_name", ""),
    }
    await db[EVAL_HISTORY_COLLECTION].insert_one(eval_record)

    return result


@approval_engine_router.get("/admin/approval-rules/history")
async def evaluation_history(request: Request, limit: int = Query(30)):
    """Get recent evaluation history."""
    await _auth_admin(request)
    db = _db

    evals = []
    async for e in db[EVAL_HISTORY_COLLECTION].find().sort("evaluated_at", -1).limit(limit):
        e["_id"] = str(e["_id"])
        e.pop("applicant_data", None)
        evals.append(e)

    return {"evaluations": evals, "total": len(evals)}
