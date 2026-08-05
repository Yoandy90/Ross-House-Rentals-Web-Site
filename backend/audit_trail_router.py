"""
Audit Trail Router — Immutable Activity Log
Records every administrative action for OCCC compliance and internal governance.
All entries are append-only (no updates or deletes).
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

audit_trail_router = APIRouter()

_db = None
_get_user_from_token = None

COLLECTION = "audit_trail"


def init_audit_trail(db_instance, get_user_func):
    global _db, _get_user_from_token
    _db = db_instance
    _get_user_from_token = get_user_func
    logger.info("Audit Trail Router initialized")


async def _auth_admin(request: Request):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = await _get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="No autorizado")
    return user


async def log_audit_event(
    action: str,
    module: str,
    user_email: str = "system",
    user_name: str = "Sistema",
    details: dict = None,
    entity_type: str = "",
    entity_id: str = "",
    severity: str = "info",
    ip_address: str = "",
):
    """Append an immutable audit entry. Called from any module."""
    if _db is None:
        return
    entry = {
        "action": action,
        "module": module,
        "user_email": user_email,
        "user_name": user_name,
        "details": details or {},
        "entity_type": entity_type,
        "entity_id": entity_id,
        "severity": severity,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow().isoformat(),
        "immutable": True,
    }
    try:
        await _db[COLLECTION].insert_one(entry)
    except Exception as e:
        logger.error(f"Audit log error: {e}")


@audit_trail_router.get("/admin/audit-trail")
async def get_audit_trail(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    module: Optional[str] = None,
    action: Optional[str] = None,
    severity: Optional[str] = None,
    user_email: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    await _auth_admin(request)
    db = _db

    query = {}
    if module:
        query["module"] = module
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if severity:
        query["severity"] = severity
    if user_email:
        query["user_email"] = user_email
    if search:
        query["$or"] = [
            {"action": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
            {"details.description": {"$regex": search, "$options": "i"}},
            {"entity_id": {"$regex": search, "$options": "i"}},
        ]
    if date_from:
        query.setdefault("timestamp", {})["$gte"] = date_from
    if date_to:
        query.setdefault("timestamp", {})["$lte"] = date_to

    total = await db[COLLECTION].count_documents(query)
    skip = (page - 1) * limit

    entries = []
    async for doc in db[COLLECTION].find(query).sort("timestamp", -1).skip(skip).limit(limit):
        doc["_id"] = str(doc["_id"])
        entries.append(doc)

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@audit_trail_router.get("/admin/audit-trail/stats")
async def get_audit_stats(request: Request):
    await _auth_admin(request)
    db = _db

    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    total = await db[COLLECTION].count_documents({})
    today_count = await db[COLLECTION].count_documents({"timestamp": {"$gte": today}})
    week_count = await db[COLLECTION].count_documents({"timestamp": {"$gte": week_ago}})
    critical_count = await db[COLLECTION].count_documents({"severity": "critical", "timestamp": {"$gte": month_ago}})

    pipeline = [
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$module", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_module = {}
    async for doc in db[COLLECTION].aggregate(pipeline):
        by_module[doc["_id"]] = doc["count"]

    pipeline2 = [
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
    ]
    by_severity = {}
    async for doc in db[COLLECTION].aggregate(pipeline2):
        by_severity[doc["_id"]] = doc["count"]

    pipeline3 = [
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": {"email": "$user_email", "name": "$user_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_users = []
    async for doc in db[COLLECTION].aggregate(pipeline3):
        top_users.append({"email": doc["_id"]["email"], "name": doc["_id"]["name"], "actions": doc["count"]})

    critical_events = []
    async for doc in db[COLLECTION].find({"severity": "critical"}).sort("timestamp", -1).limit(5):
        doc["_id"] = str(doc["_id"])
        critical_events.append(doc)

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "critical_this_month": critical_count,
        "by_module": by_module,
        "by_severity": by_severity,
        "top_users": top_users,
        "recent_critical": critical_events,
    }


@audit_trail_router.post("/admin/audit-trail")
async def create_audit_entry(request: Request):
    admin = await _auth_admin(request)
    body = await request.json()

    await log_audit_event(
        action=body.get("action", "manual_entry"),
        module=body.get("module", "admin"),
        user_email=admin.get("email", ""),
        user_name=f"{admin.get('first_name', '')} {admin.get('last_name', '')}".strip(),
        details=body.get("details", {}),
        entity_type=body.get("entity_type", ""),
        entity_id=body.get("entity_id", ""),
        severity=body.get("severity", "info"),
        ip_address=request.client.host if request.client else "",
    )
    return {"success": True}


@audit_trail_router.get("/admin/audit-trail/export")
async def export_audit_trail(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    module: Optional[str] = None,
):
    await _auth_admin(request)
    db = _db
    import csv
    import io

    query = {}
    if module:
        query["module"] = module
    if date_from:
        query.setdefault("timestamp", {})["$gte"] = date_from
    if date_to:
        query.setdefault("timestamp", {})["$lte"] = date_to

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Action", "Module", "User", "Email", "Severity", "Entity Type", "Entity ID", "Details", "IP"])

    async for doc in db[COLLECTION].find(query).sort("timestamp", -1).limit(10000):
        writer.writerow([
            doc.get("timestamp", ""),
            doc.get("action", ""),
            doc.get("module", ""),
            doc.get("user_name", ""),
            doc.get("user_email", ""),
            doc.get("severity", ""),
            doc.get("entity_type", ""),
            doc.get("entity_id", ""),
            str(doc.get("details", {})),
            doc.get("ip_address", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_trail_{datetime.utcnow().strftime('%Y%m%d')}.csv"},
    )
