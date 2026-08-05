"""
Appointment Types Routes Router
Extracted from server.py for modularization.
Handles appointment type configuration, admin scheduling, and scratch cards.
"""
import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from pydantic import BaseModel, Field
from bson import ObjectId

logger = logging.getLogger(__name__)

appointment_types_router = APIRouter()
_db = None

def init_appointment_types_router(db):
    global _db
    _db = db

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user

# ================== APPOINTMENT TYPES ENDPOINTS ==================

class AppointmentTypeCreate(BaseModel):
    title: str
    duration_minutes: int
    icon: str = "calendar"
    is_active: bool = True
    order: int = 0

class AppointmentTypeUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class AppointmentTypeResponse(BaseModel):
    id: str
    title: str
    duration_minutes: int
    icon: str
    is_active: bool
    order: int
    created_at: datetime
    updated_at: datetime

@appointment_types_router.get('/admin/appointment-types', response_model=List[AppointmentTypeResponse])
async def get_appointment_types(
    include_inactive: bool = False,
    current_user: dict = Depends(_require_admin)
):
    """Get all appointment types"""
    try:
        query = {} if include_inactive else {"is_active": True}
        
        types = await _db.appointment_types.find(query).sort("order", 1).to_list(length=100)
        
        return [
            AppointmentTypeResponse(
                id=str(t["_id"]),
                title=t["title"],
                duration_minutes=t["duration_minutes"],
                icon=t.get("icon", "calendar"),
                is_active=t.get("is_active", True),
                order=t.get("order", 0),
                created_at=t.get("created_at", datetime.utcnow()),
                updated_at=t.get("updated_at", datetime.utcnow())
            )
            for t in types
        ]
    except Exception as e:
        logging.error(f"Error getting appointment types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@appointment_types_router.post('/admin/appointment-types', response_model=AppointmentTypeResponse)
async def create_appointment_type(
    appointment_type: AppointmentTypeCreate,
    current_user: dict = Depends(_require_admin)
):
    """Create a new appointment type"""
    try:
        # Check if title already exists
        existing = await _db.appointment_types.find_one({"title": appointment_type.title})
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un tipo de cita con ese título")
        
        # Create document
        doc = {
            "title": appointment_type.title,
            "duration_minutes": appointment_type.duration_minutes,
            "icon": appointment_type.icon,
            "is_active": appointment_type.is_active,
            "order": appointment_type.order,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.appointment_types.insert_one(doc)
        doc["_id"] = result.inserted_id
        
        logging.info(f"✅ Appointment type created: {appointment_type.title}")
        
        return AppointmentTypeResponse(
            id=str(doc["_id"]),
            title=doc["title"],
            duration_minutes=doc["duration_minutes"],
            icon=doc["icon"],
            is_active=doc["is_active"],
            order=doc["order"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@appointment_types_router.put('/admin/appointment-types/{type_id}', response_model=AppointmentTypeResponse)
async def update_appointment_type(
    type_id: str,
    update_data: AppointmentTypeUpdate,
    current_user: dict = Depends(_require_admin)
):
    """Update an appointment type"""
    try:
        # Build update dict
        update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No hay datos para actualizar")
        
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update
        result = await _db.appointment_types.update_one(
            {"_id": ObjectId(type_id)},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tipo de cita no encontrado")
        
        # Get updated document
        updated = await _db.appointment_types.find_one({"_id": ObjectId(type_id)})
        
        logging.info(f"✅ Appointment type updated: {type_id}")
        
        return AppointmentTypeResponse(
            id=str(updated["_id"]),
            title=updated["title"],
            duration_minutes=updated["duration_minutes"],
            icon=updated["icon"],
            is_active=updated["is_active"],
            order=updated["order"],
            created_at=updated.get("created_at", datetime.utcnow()),
            updated_at=updated["updated_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@appointment_types_router.delete('/admin/appointment-types/{type_id}')
async def delete_appointment_type(
    type_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Delete an appointment type (soft delete - set is_active to False)"""
    try:
        result = await _db.appointment_types.update_one(
            {"_id": ObjectId(type_id)},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tipo de cita no encontrado")
        
        logging.info(f"✅ Appointment type deleted (soft): {type_id}")
        
        return {"success": True, "message": "Tipo de cita desactivado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("📅 Appointment Types endpoints registered")


