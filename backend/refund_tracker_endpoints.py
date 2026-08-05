"""
Refund Tracker API Endpoints
Handles both admin and client views for IRS refund status tracking.
"""

import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from zoneinfo import ZoneInfo

from tax_services import RefundTracker, REFUND_STAGES

logger = logging.getLogger(__name__)
MIAMI_TZ = ZoneInfo("America/New_York")

router = APIRouter(prefix="/refund-trackers", tags=["Refund Tracking"])

# These will be set during initialization
db = None
get_current_user = None
require_admin = None
notification_service = None


def init_refund_tracker(database, auth_func, admin_func, notif_service=None):
    """Initialize with database and auth dependencies"""
    global db, get_current_user, require_admin, notification_service
    db = database
    get_current_user = auth_func
    require_admin = admin_func
    notification_service = notif_service
    logger.info("✅ Refund Tracker endpoints initialized")


# ═══════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════

class CreateTrackerRequest(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    tax_year: str
    filing_type: str = "e-file"
    filing_status: str = "single"
    refund_amount: float
    filed_date: str = ""
    refund_method: str = "direct_deposit"


class UpdateStageRequest(BaseModel):
    stage: str
    note: str = ""
    notify_client: bool = True


class AddNoteRequest(BaseModel):
    note: str


# ═══════════════════════════════════════════════════════════════
# Admin Endpoints
# ═══════════════════════════════════════════════════════════════

@router.post("/admin/create")
async def admin_create_tracker(data: CreateTrackerRequest, user=Depends(lambda: require_admin)):
    """Create a new refund tracker for a client"""
    try:
        tracker = RefundTracker(db)
        result = await tracker.create_refund_tracker(
            client_id=data.client_id,
            client_name=data.client_name,
            client_email=data.client_email,
            tax_year=data.tax_year,
            filing_type=data.filing_type,
            filing_status=data.filing_status,
            refund_amount=data.refund_amount,
            filed_date=data.filed_date,
            refund_method=data.refund_method
        )
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Error creating tracker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/list")
async def admin_list_trackers(
    page: int = 1,
    limit: int = 20,
    status: str = "",
    search: str = "",
    user=Depends(lambda: require_admin)
):
    """List all refund trackers with pagination"""
    try:
        tracker = RefundTracker(db)
        result = await tracker.list_all_trackers(page=page, limit=limit, status=status)
        
        # If search query, filter by name/email
        if search:
            search_lower = search.lower()
            result["trackers"] = [
                t for t in result["trackers"]
                if search_lower in t.get("client_name", "").lower()
                or search_lower in t.get("client_email", "").lower()
            ]
            result["total"] = len(result["trackers"])
        
        return result
    except Exception as e:
        logger.error(f"Error listing trackers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/dashboard")
async def admin_dashboard(user=Depends(lambda: require_admin)):
    """Get refund tracking dashboard statistics"""
    try:
        tracker = RefundTracker(db)
        return await tracker.get_dashboard()
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/{tracker_id}/stage")
async def admin_update_stage(
    tracker_id: str,
    data: UpdateStageRequest,
    user=Depends(lambda: require_admin)
):
    """Update the refund stage and optionally notify the client"""
    try:
        tracker_service = RefundTracker(db)
        result = await tracker_service.update_stage(
            tracker_id=tracker_id,
            new_stage=data.stage,
            note=data.note
        )
        
        # Send push notification to client if requested
        if data.notify_client and notification_service:
            try:
                # Get tracker details for notification
                tracker_doc = await db.refund_trackers.find_one({"_id": ObjectId(tracker_id)})
                if tracker_doc:
                    client_email = tracker_doc.get("client_email", "")
                    stage_info = next((s for s in REFUND_STAGES if s["stage"] == data.stage), None)
                    
                    if client_email and stage_info:
                        # Find user by email for push token
                        client_user = await db.users.find_one({"email": client_email})
                        if client_user and client_user.get("push_token"):
                            await notification_service.send_push_notification(
                                push_token=client_user["push_token"],
                                title=f"📋 Actualización de Reembolso",
                                body=f"{stage_info['icon']} {stage_info['label']} — ${tracker_doc.get('refund_amount', 0):,.2f}",
                                data={"type": "refund_update", "tracker_id": tracker_id}
                            )
                            logger.info(f"📱 Push notification sent to {client_email} for stage: {data.stage}")
            except Exception as notif_err:
                logger.warning(f"Push notification failed (non-blocking): {notif_err}")
        
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating stage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/{tracker_id}/note")
async def admin_add_note(tracker_id: str, data: AddNoteRequest, user=Depends(lambda: require_admin)):
    """Add a note to a refund tracker"""
    try:
        now = datetime.now(MIAMI_TZ)
        await db.refund_trackers.update_one(
            {"_id": ObjectId(tracker_id)},
            {
                "$push": {"notes": {"text": data.note, "date": now, "by": "admin"}},
                "$set": {"updated_at": now}
            }
        )
        return {"success": True, "message": "Note added"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/{tracker_id}")
async def admin_delete_tracker(tracker_id: str, user=Depends(lambda: require_admin)):
    """Delete a refund tracker"""
    try:
        result = await db.refund_trackers.delete_one({"_id": ObjectId(tracker_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Tracker not found")
        return {"success": True, "message": "Tracker deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/clients-for-tracker")
async def admin_get_clients(search: str = "", user=Depends(lambda: require_admin)):
    """Get list of clients for creating new trackers"""
    try:
        query = {"role": {"$in": ["client", "user"]}}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        
        clients = await db.users.find(query, {
            "_id": 1, "name": 1, "email": 1, "phone": 1
        }).limit(20).to_list(20)
        
        return [{
            "id": str(c["_id"]),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", "")
        } for c in clients]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stages")
async def get_refund_stages():
    """Get all possible refund stages"""
    return {"stages": REFUND_STAGES}


# ═══════════════════════════════════════════════════════════════
# Client Endpoints
# ═══════════════════════════════════════════════════════════════

@router.get("/my")
async def client_get_my_trackers(user=Depends(lambda: get_current_user)):
    """Get refund trackers for the currently logged-in client"""
    try:
        current_user = await get_current_user()
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        email = current_user.get("email", "")
        user_id = str(current_user.get("_id", ""))
        
        tracker = RefundTracker(db)
        results = await tracker.get_client_trackers(client_id=user_id, client_email=email)
        
        return {"trackers": results, "count": len(results)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client trackers: {e}")
        raise HTTPException(status_code=500, detail=str(e))
