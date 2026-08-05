"""
Appointment Types Management Endpoints
Admin endpoints to manage appointment types (motivos de cita)
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

# Create router without prefix since it will be added when including
router = APIRouter(tags=["Admin - Appointment Types"])

# These will be injected when the router is imported
require_admin = None
get_database = None

def set_dependencies(admin_func, db_func):
    """Set the dependency functions from server.py"""
    global require_admin, get_database
    require_admin = admin_func
    get_database = db_func


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


def create_endpoints():
    """Create endpoints after dependencies are set"""
    
    @router.get("", response_model=List[AppointmentTypeResponse])
    async def get_appointment_types(
        include_inactive: bool = False,
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
):
    """Get all appointment types"""
    try:
        query = {} if include_inactive else {"is_active": True}
        
        types = await db.appointment_types.find(query).sort("order", 1).to_list(length=100)
        
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
        logger.error(f"Error getting appointment types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=AppointmentTypeResponse)
async def create_appointment_type(
    appointment_type: AppointmentTypeCreate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Create a new appointment type"""
    try:
        # Check if title already exists
        existing = await db.appointment_types.find_one({"title": appointment_type.title})
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
        
        result = await db.appointment_types.insert_one(doc)
        doc["_id"] = result.inserted_id
        
        logger.info(f"✅ Appointment type created: {appointment_type.title}")
        
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
        logger.error(f"Error creating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{type_id}", response_model=AppointmentTypeResponse)
async def update_appointment_type(
    type_id: str,
    update_data: AppointmentTypeUpdate,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Update an appointment type"""
    try:
        # Build update dict
        update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No hay datos para actualizar")
        
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update
        result = await db.appointment_types.update_one(
            {"_id": ObjectId(type_id)},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tipo de cita no encontrado")
        
        # Get updated document
        updated = await db.appointment_types.find_one({"_id": ObjectId(type_id)})
        
        logger.info(f"✅ Appointment type updated: {type_id}")
        
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
        logger.error(f"Error updating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{type_id}")
async def delete_appointment_type(
    type_id: str,
    current_user: dict = Depends(require_admin),
    db = Depends(get_database)
):
    """Delete an appointment type (soft delete - set is_active to False)"""
    try:
        result = await db.appointment_types.update_one(
            {"_id": ObjectId(type_id)},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tipo de cita no encontrado")
        
        logger.info(f"✅ Appointment type deleted (soft): {type_id}")
        
        return {"success": True, "message": "Tipo de cita desactivado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


logger.info("✅ Appointment Types endpoints initialized")
