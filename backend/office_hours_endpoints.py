"""
Office Hours Management Endpoints
Gestión de horarios de oficina
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, time, timezone
from bson import ObjectId
import os
from jose import JWTError, jwt
import pytz

# Dumas, TX timezone (Central Time)
OFFICE_TIMEZONE = pytz.timezone('America/Chicago')

router = APIRouter(prefix="/office-hours", tags=["Office Hours"])

def get_office_time():
    """Get current time in office timezone (Central Time)"""
    return datetime.now(OFFICE_TIMEZONE)

# Auth
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ross-tax-secret-key-2025-change-in-production")
ALGORITHM = "HS256"

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from session token"""
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    # Convert to string if it's a Header object
    auth_str = str(authorization) if authorization else None
    if not auth_str:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    # Handle Bearer token
    token = auth_str.replace('Bearer ', '') if auth_str.startswith('Bearer ') else auth_str
    
    # Find session in database
    session = await db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    
    # Check expiry
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    
    # Get user
    user_id = session['user_id']
    # Try both ObjectId and string since MongoDB stores _id inconsistently
    user = await db.users.find_one({'_id': user_id})
    if not user:
        # Try with ObjectId
        try:
            user = await db.users.find_one({'_id': ObjectId(user_id)})
        except:
            pass
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

# Models
class OfficeHoursUpdate(BaseModel):
    day: str  # monday, tuesday, etc.
    is_open: bool
    open_time: Optional[str] = None  # HH:MM formato 24h
    close_time: Optional[str] = None  # HH:MM formato 24h

class SpecialHoursUpdate(BaseModel):
    date: str  # YYYY-MM-DD
    is_open: bool
    reason: str
    open_time: Optional[str] = None
    close_time: Optional[str] = None

class OfficeStatusUpdate(BaseModel):
    is_open: bool
    reason: Optional[str] = None

# Global variable para DB (será inyectada desde server.py)
db = None

def init_office_hours_endpoints(database):
    global db
    db = database

@router.get("/schedule")
async def get_office_schedule():
    """
    Obtiene el horario semanal de la oficina (público)
    """
    schedule = await db.office_hours.find_one({"type": "weekly_schedule"})
    
    if not schedule:
        # Crear horario por defecto
        default_schedule = {
            "type": "weekly_schedule",
            "schedule": {
                "monday": {"is_open": True, "open_time": "09:00", "close_time": "18:00"},
                "tuesday": {"is_open": True, "open_time": "09:00", "close_time": "18:00"},
                "wednesday": {"is_open": True, "open_time": "09:00", "close_time": "18:00"},
                "thursday": {"is_open": True, "open_time": "09:00", "close_time": "18:00"},
                "friday": {"is_open": True, "open_time": "09:00", "close_time": "18:00"},
                "saturday": {"is_open": False, "open_time": None, "close_time": None},
                "sunday": {"is_open": False, "open_time": None, "close_time": None}
            },
            "created_at": get_office_time(),
            "updated_at": get_office_time()
        }
        await db.office_hours.insert_one(default_schedule)
        schedule = default_schedule
    
    return {
        "schedule": schedule.get("schedule", {}),
        "updated_at": schedule.get("updated_at", get_office_time()).isoformat()
    }

@router.put("/schedule")
async def update_office_schedule(
    updates: List[OfficeHoursUpdate],
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza el horario semanal (solo admin)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update office hours")
    
    schedule = await db.office_hours.find_one({"type": "weekly_schedule"})
    
    if not schedule:
        schedule = {
            "type": "weekly_schedule",
            "schedule": {},
            "created_at": get_office_time()
        }
    
    # Actualizar días
    for update in updates:
        schedule["schedule"][update.day] = {
            "is_open": update.is_open,
            "open_time": update.open_time,
            "close_time": update.close_time
        }
    
    schedule["updated_at"] = get_office_time()
    
    await db.office_hours.update_one(
        {"type": "weekly_schedule"},
        {"$set": schedule},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Office hours updated successfully",
        "schedule": schedule["schedule"]
    }

@router.get("/status")
async def get_current_status():
    """
    Obtiene el estado actual de la oficina (abierto/cerrado)
    Considera: horario semanal, días especiales, y overrides manuales
    """
    now = get_office_time()
    today = now.strftime("%A").lower()  # monday, tuesday, etc.
    current_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # 1. Verificar si hay override manual
    manual_override = await db.office_hours.find_one({"type": "manual_override"})
    if manual_override and manual_override.get("active"):
        return {
            "is_open": manual_override.get("is_open", False),
            "reason": manual_override.get("reason", "Manual override"),
            "type": "manual",
            "current_time": current_time,
            "message": manual_override.get("reason", "")
        }
    
    # 2. Verificar días especiales (feriados, cierres especiales)
    special_day = await db.office_hours.find_one({
        "type": "special_day",
        "date": current_date
    })
    
    if special_day:
        is_open = special_day.get("is_open", False)
        if is_open and special_day.get("open_time") and special_day.get("close_time"):
            # Verificar si está dentro del horario especial
            is_within_hours = special_day["open_time"] <= current_time <= special_day["close_time"]
            return {
                "is_open": is_within_hours,
                "reason": special_day.get("reason", "Special hours"),
                "type": "special",
                "hours": {
                    "open": special_day["open_time"],
                    "close": special_day["close_time"]
                },
                "current_time": current_time
            }
        else:
            return {
                "is_open": False,
                "reason": special_day.get("reason", "Closed for special day"),
                "type": "special",
                "current_time": current_time
            }
    
    # 3. Verificar horario semanal regular
    schedule = await db.office_hours.find_one({"type": "weekly_schedule"})
    
    if not schedule:
        return {
            "is_open": False,
            "reason": "Schedule not configured",
            "type": "default",
            "current_time": current_time
        }
    
    day_schedule = schedule.get("schedule", {}).get(today, {})
    
    if not day_schedule.get("is_open", False):
        return {
            "is_open": False,
            "reason": f"Closed on {today.capitalize()}s",
            "type": "weekly",
            "current_time": current_time
        }
    
    # Verificar si está dentro del horario
    open_time = day_schedule.get("open_time")
    close_time = day_schedule.get("close_time")
    
    if open_time and close_time:
        is_within_hours = open_time <= current_time <= close_time
        return {
            "is_open": is_within_hours,
            "reason": "Within business hours" if is_within_hours else "Outside business hours",
            "type": "weekly",
            "hours": {
                "open": open_time,
                "close": close_time
            },
            "current_time": current_time
        }
    
    return {
        "is_open": False,
        "reason": "Hours not configured",
        "type": "default",
        "current_time": current_time
    }

@router.post("/manual-override")
async def set_manual_override(
    update: OfficeStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Control manual inmediato: abrir/cerrar oficina (solo admin)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can override office status")
    
    override = {
        "type": "manual_override",
        "is_open": update.is_open,
        "reason": update.reason or ("Opened manually" if update.is_open else "Closed manually"),
        "active": True,
        "set_by": current_user.get("id"),
        "set_at": get_office_time()
    }
    
    await db.office_hours.update_one(
        {"type": "manual_override"},
        {"$set": override},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Office {'opened' if update.is_open else 'closed'} manually",
        "is_open": update.is_open,
        "reason": override["reason"]
    }

@router.delete("/manual-override")
async def clear_manual_override(
    current_user: dict = Depends(get_current_user)
):
    """
    Quita el override manual y vuelve al horario normal (solo admin)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can clear override")
    
    await db.office_hours.update_one(
        {"type": "manual_override"},
        {"$set": {"active": False, "cleared_at": get_office_time()}}
    )
    
    return {
        "success": True,
        "message": "Manual override cleared, back to regular schedule"
    }

@router.post("/special-days")
async def add_special_day(
    special_day: SpecialHoursUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Agregar día especial (feriado, cierre especial, horario especial)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add special days")
    
    special = {
        "type": "special_day",
        "date": special_day.date,
        "is_open": special_day.is_open,
        "reason": special_day.reason,
        "open_time": special_day.open_time,
        "close_time": special_day.close_time,
        "created_by": current_user.get("id"),
        "created_at": get_office_time()
    }
    
    await db.office_hours.update_one(
        {"type": "special_day", "date": special_day.date},
        {"$set": special},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Special day added successfully",
        "special_day": special
    }

@router.get("/special-days")
async def get_special_days(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Obtiene lista de días especiales (público)
    """
    query = {"type": "special_day"}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    special_days = await db.office_hours.find(query).to_list(100)
    
    return {
        "special_days": [
            {
                "date": day["date"],
                "is_open": day.get("is_open", False),
                "reason": day.get("reason", ""),
                "open_time": day.get("open_time"),
                "close_time": day.get("close_time")
            }
            for day in special_days
        ]
    }

@router.delete("/special-days/{date}")
async def delete_special_day(
    date: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina un día especial
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete special days")
    
    result = await db.office_hours.delete_one({
        "type": "special_day",
        "date": date
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special day not found")
    
    return {
        "success": True,
        "message": f"Special day {date} deleted"
    }

@router.get("/next-opening")
async def get_next_opening():
    """
    Calcula cuándo abrirá la oficina la próxima vez
    """
    now = get_office_time()
    
    # Obtener horario
    schedule = await db.office_hours.find_one({"type": "weekly_schedule"})
    
    if not schedule:
        return {"message": "Schedule not available"}
    
    # Buscar próximo día abierto
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    current_day_index = now.weekday()
    
    for i in range(7):
        check_day_index = (current_day_index + i) % 7
        day_name = days[check_day_index]
        day_schedule = schedule["schedule"].get(day_name, {})
        
        if day_schedule.get("is_open"):
            return {
                "next_opening_day": day_name.capitalize(),
                "opens_at": day_schedule.get("open_time"),
                "closes_at": day_schedule.get("close_time"),
                "days_until": i
            }
    
    return {"message": "No opening days found in schedule"}
