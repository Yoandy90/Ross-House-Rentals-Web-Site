"""
OCCC Audit Trail Middleware
Automatically logs every change to loans, payments, and compliance records.
Creates an immutable audit trail for OCCC examination compliance.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_db = None


def init_audit_trail(database):
    """Initialize the audit trail with database reference."""
    global _db
    _db = database
    logger.info("✅ OCCC Audit Trail initialized")


async def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str,
    admin_email: str = "system",
    admin_name: str = "System",
    details: str = "",
    changes: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Log an audit event to the immutable audit trail.

    Args:
        action: Type of action (created, updated, deleted, status_change, payment, etc.)
        entity_type: Type of entity (loan, cab_loan, regulated_loan, payment, complaint, etc.)
        entity_id: ID of the entity being changed
        admin_email: Email of the admin performing the action
        admin_name: Name of the admin
        details: Human-readable description of the change
        changes: Dict of field changes {field: {old: value, new: value}}
        metadata: Additional metadata (loan amount, client name, etc.)
    """
    if _db is None:
        logger.warning("Audit trail not initialized — skipping log")
        return

    try:
        event = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "admin_email": admin_email,
            "admin_name": admin_name,
            "details": details,
            "changes": changes or {},
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc),
            "source": "admin_panel",
            "immutable": True,  # Flag: this record should never be modified
        }

        await _db.occc_audit_trail.insert_one(event)
        logger.info(f"📋 Audit: {action} on {entity_type}/{entity_id} by {admin_email}")

    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")


async def get_audit_trail(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    admin_email: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 200,
    skip: int = 0,
) -> Dict[str, Any]:
    """
    Query the audit trail with flexible filters.
    Returns events and total count for pagination.
    """
    if _db is None:
        return {"events": [], "total": 0}

    try:
        query: Dict[str, Any] = {}
        if entity_type:
            query["entity_type"] = entity_type
        if entity_id:
            query["entity_id"] = str(entity_id)
        if admin_email:
            query["admin_email"] = admin_email
        if action:
            query["action"] = action
        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date

        total = await _db.occc_audit_trail.count_documents(query)
        events = await _db.occc_audit_trail.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)

        for e in events:
            e["_id"] = str(e["_id"])

        return {"events": events, "total": total}

    except Exception as e:
        logger.error(f"Error querying audit trail: {e}")
        return {"events": [], "total": 0}


async def get_entity_history(entity_type: str, entity_id: str) -> list:
    """Get the complete change history for a specific entity."""
    if _db is None:
        return []

    try:
        events = await _db.occc_audit_trail.find({
            "entity_type": entity_type,
            "entity_id": str(entity_id),
        }).sort("timestamp", -1).to_list(500)

        for e in events:
            e["_id"] = str(e["_id"])

        return events

    except Exception as e:
        logger.error(f"Error getting entity history: {e}")
        return []


async def get_audit_summary(year: Optional[int] = None) -> Dict[str, Any]:
    """
    Get a summary of audit events for OCCC reporting.
    Groups by action type and entity type.
    """
    if _db is None:
        return {}

    try:
        match_query: Dict[str, Any] = {}
        if year:
            match_query["timestamp"] = {
                "$gte": datetime(year, 1, 1, tzinfo=timezone.utc),
                "$lt": datetime(year + 1, 1, 1, tzinfo=timezone.utc),
            }

        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": {"action": "$action", "entity_type": "$entity_type"},
                "count": {"$sum": 1},
                "last_event": {"$max": "$timestamp"},
            }},
            {"$sort": {"count": -1}},
        ]

        results = await _db.occc_audit_trail.aggregate(pipeline).to_list(100)

        by_action = {}
        by_entity = {}
        total = 0

        for r in results:
            action_key = r["_id"]["action"]
            entity_key = r["_id"]["entity_type"]
            count = r["count"]
            total += count

            by_action[action_key] = by_action.get(action_key, 0) + count
            by_entity[entity_key] = by_entity.get(entity_key, 0) + count

        # Get unique admins
        admins = await _db.occc_audit_trail.distinct("admin_email", match_query)

        return {
            "total_events": total,
            "by_action": by_action,
            "by_entity": by_entity,
            "unique_admins": len(admins),
            "admins": admins,
            "year": year or "all",
        }

    except Exception as e:
        logger.error(f"Error getting audit summary: {e}")
        return {}


logger.info("✅ OCCC Audit Trail module loaded")
