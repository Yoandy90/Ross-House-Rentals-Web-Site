"""
Calendar Management Router
Extracted from server.py for modularization.
Handles calendar settings, blocked days/slots, office hours, schedule blocks, and Google Calendar integration.
"""
import logging
import uuid
import secrets
import string
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from pydantic import BaseModel
from bson import ObjectId
from passlib.context import CryptContext
from notification_service import format_date_spanish

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

calendar_router = APIRouter()
_db = None
_google_calendar_service = None
_notification_service = None


def init_calendar_router(db, google_calendar_service=None, notification_service=None):
    global _db, _google_calendar_service, _notification_service
    _db = db
    _google_calendar_service = google_calendar_service
    _notification_service = notification_service


def update_google_calendar_service(service):
    global _google_calendar_service
    _google_calendar_service = service


def update_calendar_notification_service(service):
    global _notification_service
    _notification_service = service


async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(tz=expires_at.tzinfo if expires_at.tzinfo else timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def _require_admin(request: Request):
    """Require admin role"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class AvailableSlotResponse(BaseModel):
    """Response for available time slots"""
    date: str
    time: str
    datetime: str
    available: bool

# ================== CALENDAR MANAGEMENT SYSTEM ==================
# Sistema completo para gestionar el calendario de citas

@calendar_router.get('/admin/calendar/settings')
async def get_calendar_settings(current_user: dict = Depends(_require_admin)):
    """Get all calendar settings including global toggle, blocked days, and blocked slots"""
    settings = await _db.office_hours.find_one({"type": "calendar_settings"})
    blocked_days = await _db.office_hours.find({"type": "blocked_day"}).to_list(100)
    blocked_slots = await _db.office_hours.find({"type": "blocked_slot"}).to_list(500)
    
    return {
        "accepting_appointments": settings.get("accepting_appointments", True) if settings else True,
        "pause_reason": settings.get("pause_reason", "") if settings else "",
        "paused_at": settings.get("paused_at") if settings else None,
        "blocked_days": [{
            "id": str(d.get("_id")),
            "date": d.get("date"),
            "reason": d.get("reason", ""),
            "created_at": d.get("created_at")
        } for d in blocked_days],
        "blocked_slots": [{
            "id": str(s.get("_id")),
            "date": s.get("date"),
            "time": s.get("time"),
            "reason": s.get("reason", ""),
            "created_at": s.get("created_at")
        } for s in blocked_slots]
    }


@calendar_router.post('/admin/calendar/toggle')
async def toggle_calendar_availability(
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Toggle calendar ON/OFF globally
    When OFF: clients cannot book new appointments
    """
    accepting = data.get("accepting_appointments", True)
    reason = data.get("reason", "")
    
    update_data = {
        "type": "calendar_settings",
        "accepting_appointments": accepting,
        "pause_reason": reason if not accepting else "",
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.get("id")
    }
    
    if not accepting:
        update_data["paused_at"] = datetime.now(timezone.utc)
    else:
        update_data["paused_at"] = None
    
    await _db.office_hours.update_one(
        {"type": "calendar_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    status_msg = "ACTIVADO - Aceptando citas" if accepting else f"PAUSADO - {reason or 'Sin razón especificada'}"
    logging.info(f"📅 Calendar toggled by {current_user.get('email')}: {status_msg}")
    
    return {
        "success": True,
        "accepting_appointments": accepting,
        "message": f"Calendario {status_msg}"
    }


@calendar_router.post('/admin/calendar/block-day')
async def block_specific_day(
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Block a specific day (holiday, vacation, etc.)
    Prevents any appointments on that day
    """
    date_str = data.get("date")  # Format: YYYY-MM-DD
    reason = data.get("reason", "Día cerrado")
    
    if not date_str:
        raise HTTPException(status_code=400, detail="Date is required")
    
    # Check if already blocked
    existing = await _db.office_hours.find_one({
        "type": "blocked_day",
        "date": date_str
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Este día ya está bloqueado")
    
    blocked_day = {
        "type": "blocked_day",
        "date": date_str,
        "reason": reason,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user.get("id")
    }
    
    result = await _db.office_hours.insert_one(blocked_day)
    logging.info(f"📅 Day blocked: {date_str} - {reason} by {current_user.get('email')}")
    
    return {
        "success": True,
        "id": str(result.inserted_id),
        "date": date_str,
        "reason": reason,
        "message": f"Día {date_str} bloqueado: {reason}"
    }


@calendar_router.delete('/admin/calendar/block-day/{date}')
async def unblock_specific_day(
    date: str,
    current_user: dict = Depends(_require_admin)
):
    """Unblock a previously blocked day"""
    result = await _db.office_hours.delete_one({
        "type": "blocked_day",
        "date": date
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Día bloqueado no encontrado")
    
    logging.info(f"📅 Day unblocked: {date} by {current_user.get('email')}")
    
    return {
        "success": True,
        "message": f"Día {date} desbloqueado"
    }


@calendar_router.post('/admin/calendar/block-slot')
async def block_specific_slot(
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Block a specific time slot
    Example: Block Monday 10:30 for internal meeting
    """
    date_str = data.get("date")  # Format: YYYY-MM-DD
    time_str = data.get("time")  # Format: HH:MM
    reason = data.get("reason", "Horario bloqueado")
    
    if not date_str or not time_str:
        raise HTTPException(status_code=400, detail="Date and time are required")
    
    # Check if already blocked
    existing = await _db.office_hours.find_one({
        "type": "blocked_slot",
        "date": date_str,
        "time": time_str
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Este horario ya está bloqueado")
    
    blocked_slot = {
        "type": "blocked_slot",
        "date": date_str,
        "time": time_str,
        "reason": reason,
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user.get("id")
    }
    
    result = await _db.office_hours.insert_one(blocked_slot)
    logging.info(f"📅 Slot blocked: {date_str} {time_str} - {reason} by {current_user.get('email')}")
    
    return {
        "success": True,
        "id": str(result.inserted_id),
        "date": date_str,
        "time": time_str,
        "reason": reason,
        "message": f"Horario {time_str} del {date_str} bloqueado"
    }


@calendar_router.delete('/admin/calendar/block-slot')
async def unblock_specific_slot(
    date: str,
    time: str,
    current_user: dict = Depends(_require_admin)
):
    """Unblock a previously blocked time slot"""
    result = await _db.office_hours.delete_one({
        "type": "blocked_slot",
        "date": date,
        "time": time
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Horario bloqueado no encontrado")
    
    logging.info(f"📅 Slot unblocked: {date} {time} by {current_user.get('email')}")
    
    return {
        "success": True,
        "message": f"Horario {time} del {date} desbloqueado"
    }


@calendar_router.get('/admin/calendar/statistics')
async def get_calendar_statistics(current_user: dict = Depends(_require_admin)):
    """
    Get calendar statistics:
    - Today's appointments
    - This week's appointments
    - This month's appointments
    - Attendance rate
    - Next available slot
    """
    import pytz
    texas_tz = pytz.timezone('America/Chicago')
    now = datetime.now(texas_tz)
    today_str = now.strftime('%Y-%m-%d')
    
    # Calculate week bounds (Monday to Sunday)
    week_start = now - timedelta(days=now.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.strftime('%Y-%m-%d')
    week_end_str = week_end.strftime('%Y-%m-%d')
    
    # Calculate month bounds
    month_start = now.replace(day=1)
    next_month = month_start.replace(month=month_start.month % 12 + 1) if month_start.month < 12 else month_start.replace(year=month_start.year + 1, month=1)
    month_end = next_month - timedelta(days=1)
    month_start_str = month_start.strftime('%Y-%m-%d')
    month_end_str = month_end.strftime('%Y-%m-%d')
    
    # Query appointments
    all_appointments = await _db.appointments.find({
        'status': {'$nin': ['cancelled']}
    }).to_list(1000)
    
    # Filter by date ranges
    today_appts = []
    week_appts = []
    month_appts = []
    completed_appts = []
    no_show_appts = []
    
    for apt in all_appointments:
        apt_date = apt.get('date', '')
        if isinstance(apt_date, datetime):
            apt_date = apt_date.strftime('%Y-%m-%d')
        elif apt_date and 'T' in str(apt_date):
            apt_date = str(apt_date).split('T')[0]
        
        if apt_date == today_str:
            today_appts.append(apt)
        
        if week_start_str <= apt_date <= week_end_str:
            week_appts.append(apt)
        
        if month_start_str <= apt_date <= month_end_str:
            month_appts.append(apt)
        
        # Count for attendance rate
        if apt.get('status') == 'completed':
            completed_appts.append(apt)
        elif apt.get('status') == 'no_show':
            no_show_appts.append(apt)
    
    # Calculate attendance rate
    total_finished = len(completed_appts) + len(no_show_appts)
    attendance_rate = round((len(completed_appts) / total_finished * 100), 1) if total_finished > 0 else 100.0
    
    # Find next available slot
    next_available = None
    for days_ahead in range(1, 30):  # Check next 30 days
        check_date = now + timedelta(days=days_ahead)
        check_date_str = check_date.strftime('%Y-%m-%d')
        
        # Skip blocked days
        blocked_day = await _db.office_hours.find_one({
            "type": "blocked_day",
            "date": check_date_str
        })
        if blocked_day:
            continue
        
        # Get availability for this date
        # (Simplified check - just look for first open day)
        day_name = check_date.strftime('%A').lower()
        schedule = await _db.office_hours.find_one({"type": "weekly_schedule"})
        if schedule:
            day_hours = schedule.get("schedule", {}).get(day_name, {})
            if day_hours.get("is_open"):
                next_available = {
                    "date": check_date_str,
                    "day_name": day_name.capitalize(),
                    "open_time": day_hours.get("open_time", "10:00")
                }
                break
    
    # Get pending appointments (scheduled but not yet completed)
    pending_today = len([a for a in today_appts if a.get('status') in ['scheduled', 'confirmed']])
    
    return {
        "today": {
            "total": len(today_appts),
            "pending": pending_today,
            "completed": len([a for a in today_appts if a.get('status') == 'completed'])
        },
        "week": {
            "total": len(week_appts),
            "dates": f"{week_start_str} - {week_end_str}"
        },
        "month": {
            "total": len(month_appts),
            "month_name": now.strftime('%B %Y')
        },
        "attendance_rate": attendance_rate,
        "total_completed": len(completed_appts),
        "total_no_show": len(no_show_appts),
        "next_available": next_available
    }


@calendar_router.post('/admin/tax-season/toggle')
async def toggle_tax_season(
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """Toggle tax season mode on/off"""
    is_tax_season = data.get("is_tax_season", False)
    
    await _db.office_hours.update_one(
        {"type": "tax_season_config"},
        {"$set": {"is_tax_season": is_tax_season, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {
        "success": True,
        "is_tax_season": is_tax_season,
        "message": "Temporada de impuestos " + ("ACTIVADA - Domingos 10:00-21:00" if is_tax_season else "DESACTIVADA - Domingos cerrado")
    }


# ================== SQUARE TO LOCAL MIGRATION ==================

@calendar_router.get('/admin/calendar/square-bookings')
async def get_square_bookings_for_migration(current_user: dict = Depends(_require_admin)):
    """
    Get all upcoming bookings from Square to preview before migration
    """
    try:
        # Get bookings from Square (already formatted by square_service)
        square_bookings = square_service.list_bookings(limit=200, force_refresh=True)
        
        if not square_bookings:
            return {
                "success": True,
                "bookings": [],
                "message": "No se encontraron citas en Square"
            }
        
        # Check which ones are already in local DB
        existing_square_ids = set()
        local_appointments = await _db.appointments.find({"square_id": {"$exists": True, "$ne": None}}).to_list(1000)
        for apt in local_appointments:
            if apt.get("square_id"):
                existing_square_ids.add(apt["square_id"])
        
        bookings_data = []
        for booking in square_bookings:
            booking_id = booking.get('id') or booking.get('square_id')
            
            bookings_data.append({
                "square_id": booking_id,
                "date": booking.get('date', ''),
                "time": booking.get('time', ''),
                "start_at": booking.get('scheduled_at', ''),
                "customer_name": booking.get('user_name', 'Cliente'),
                "customer_email": booking.get('user_email', ''),
                "customer_phone": booking.get('user_phone', ''),
                "customer_id": booking.get('customer_id'),
                "status": booking.get('status', 'scheduled'),
                "service_name": booking.get('service_name', 'Cita'),
                "already_migrated": booking_id in existing_square_ids
            })
        
        # Sort by date
        bookings_data.sort(key=lambda x: (x.get('date', '') or '', x.get('time', '') or ''))
        
        # Count stats
        total = len(bookings_data)
        already_migrated = len([b for b in bookings_data if b.get('already_migrated')])
        pending_migration = total - already_migrated
        
        return {
            "success": True,
            "bookings": bookings_data,
            "total": total,
            "already_migrated": already_migrated,
            "pending_migration": pending_migration,
            "message": f"Encontradas {total} citas en Square ({already_migrated} ya migradas, {pending_migration} pendientes)"
        }
        
    except Exception as e:
        logging.error(f"Error getting Square bookings: {str(e)}")
        return {
            "success": False,
            "bookings": [],
            "error": str(e)
        }


@calendar_router.post('/admin/calendar/migrate-from-square')
async def migrate_square_bookings_to_local(
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Migrate all Square bookings to local appointments collection.
    This ensures the local availability system correctly shows booked slots.
    
    Options:
    - migrate_all: True = migrate all, False = only selected IDs
    - booking_ids: List of specific Square booking IDs to migrate (if migrate_all is False)
    """
    try:
        migrate_all = data.get('migrate_all', True)
        selected_ids = data.get('booking_ids', [])
        
        # Get all Square bookings (already formatted)
        square_bookings = square_service.list_bookings(limit=200, force_refresh=True)
        
        if not square_bookings:
            return {
                "success": True,
                "migrated": 0,
                "skipped": 0,
                "message": "No hay citas en Square para migrar"
            }
        
        # Get existing local appointments with Square IDs
        existing_square_ids = set()
        local_appointments = await _db.appointments.find({"square_id": {"$exists": True, "$ne": None}}).to_list(1000)
        for apt in local_appointments:
            if apt.get("square_id"):
                existing_square_ids.add(apt["square_id"])
        
        migrated = 0
        skipped = 0
        errors = []
        
        for booking in square_bookings:
            booking_id = booking.get('id') or booking.get('square_id')
            
            # Skip if not selected (when migrate_all is False)
            if not migrate_all and booking_id not in selected_ids:
                continue
            
            # Skip if already migrated
            if booking_id in existing_square_ids:
                skipped += 1
                continue
            
            try:
                # Get data from formatted booking
                date_str = booking.get('date', '')
                time_str = booking.get('time', '')
                
                if not date_str or not time_str:
                    errors.append(f"Booking {booking_id}: No tiene fecha/hora válida")
                    continue
                
                # Try to find matching user in our DB
                user_id = None
                customer_email = booking.get('user_email', '')
                if customer_email:
                    local_user = await _db.users.find_one({"email": customer_email.lower()})
                    if local_user:
                        user_id = str(local_user.get('_id'))
                
                # Create local appointment
                appointment_data = {
                    "square_id": booking_id,
                    "user_id": user_id,
                    "user_name": booking.get('user_name', 'Cliente'),
                    "user_email": customer_email,
                    "user_phone": booking.get('user_phone', ''),
                    "customer_id": booking.get('customer_id'),
                    "date": date_str,
                    "time": time_str,
                    "scheduled_at": booking.get('scheduled_at'),
                    "service_name": booking.get('service_name', 'Cita migrada de Square'),
                    "service_id": None,
                    "status": booking.get('status', 'scheduled'),
                    "source": "square_migration",
                    "notes": f"Importado automáticamente de Square el {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "migrated_by": current_user.get("email")
                }
                
                await _db.appointments.insert_one(appointment_data)
                migrated += 1
                
            except Exception as e:
                errors.append(f"Booking {booking_id}: {str(e)}")
        
        logging.info(f"📅 Square migration by {current_user.get('email')}: {migrated} migrated, {skipped} skipped")
        
        return {
            "success": True,
            "migrated": migrated,
            "skipped": skipped,
            "errors": errors[:10] if errors else [],  # Only return first 10 errors
            "message": f"Migración completada: {migrated} citas importadas, {skipped} ya existían"
        }
        
    except Exception as e:
        logging.error(f"Error migrating Square bookings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@calendar_router.get('/public/available-slots', response_model=List[AvailableSlotResponse])
async def get_public_available_slots(
    date: str,  # ISO date string (YYYY-MM-DD)
):
    """Get available time slots for a specific date - PUBLIC endpoint for website
    
    Uses LOCAL system as the source of truth for availability (NO SQUARE dependency).
    This connects to our internal office hours and appointments database.
    """
    try:
        # Import from appointment_routes to avoid circular imports
        from appointment_routes import get_local_availability
        
        # Use the local availability endpoint
        local_availability = await get_local_availability(date)
        
        # Check if calendar is paused
        if local_availability.get('calendar_paused'):
            logging.info(f"📅 Calendar paused - returning empty slots for {date}")
            return []
        
        # Check if day is blocked
        if local_availability.get('day_blocked'):
            logging.info(f"📅 Day blocked for {date}: {local_availability.get('reason')}")
            return []
        
        # Check if office is open
        if not local_availability.get('is_open', False):
            logging.info(f"📅 Office closed for {date}: {local_availability.get('reason', 'No reason')}")
            return []
        
        # Convert local slots to response format
        slots = local_availability.get('slots', [])
        available_slots = []
        
        # Calculate correct timezone offset for the requested date (CST=-06:00, CDT=-05:00)
        import pytz
        texas_tz = pytz.timezone('America/Chicago')
        try:
            target_dt = texas_tz.localize(datetime.strptime(date, '%Y-%m-%d'))
            tz_offset = target_dt.strftime('%z')  # e.g., '-0600' or '-0500'
            tz_offset_formatted = tz_offset[:3] + ':' + tz_offset[3:]  # e.g., '-06:00' or '-05:00'
        except:
            tz_offset_formatted = '-06:00'  # fallback to CST
        
        for slot in slots:
            slot_time = slot.get('time', '')
            is_available = slot.get('available', False)
            
            available_slots.append(AvailableSlotResponse(
                date=date,
                time=slot_time,
                datetime=slot.get('start_at', f"{date}T{slot_time}:00{tz_offset_formatted}"),
                available=is_available
            ))
        
        logging.info(f"📅 Public availability for {date}: {len([s for s in slots if s.get('available')])} available / {len(slots)} total")
        return available_slots
        
    except Exception as e:
        logging.error(f'Error getting public available slots: {str(e)}')
        raise HTTPException(status_code=400, detail=str(e))


# Public endpoint for appointment types (no auth required)
@calendar_router.get('/public/appointment-types')
async def get_public_appointment_types():
    """Get all active appointment types - PUBLIC endpoint for website booking page"""
    try:
        # Only return active types
        types = await _db.appointment_types.find({"is_active": True}).sort("order", 1).to_list(length=100)
        
        result = []
        for t in types:
            result.append({
                "id": str(t.get("_id", t.get("id", ""))),
                "title": t.get("title", ""),
                "titleEn": t.get("title_en", t.get("titleEn", t.get("title", ""))),
                "duration_minutes": t.get("duration_minutes", t.get("duration", 30)),
                "description": t.get("description", ""),
                "descriptionEn": t.get("description_en", t.get("descriptionEn", t.get("description", ""))),
                "icon": t.get("icon", "calendar")
            })
        
        # If no types configured, return defaults matching frontend
        if not result:
            result = [
                {"id": "consulta", "title": "Consulta Inicial", "titleEn": "Initial Consultation", "duration_minutes": 60, "description": "Primera cita para conocer tu situación fiscal", "descriptionEn": "First appointment to understand your tax situation", "icon": "user"},
                {"id": "preparacion", "title": "Preparación de Impuestos", "titleEn": "Tax Preparation", "duration_minutes": 90, "description": "Preparación y presentación de tu declaración", "descriptionEn": "Preparation and filing of your tax return", "icon": "file-text"},
                {"id": "revision", "title": "Revisión de Documentos", "titleEn": "Document Review", "duration_minutes": 45, "description": "Revisión de documentos fiscales", "descriptionEn": "Review of tax documents", "icon": "calendar"},
                {"id": "seguimiento", "title": "Seguimiento", "titleEn": "Follow-up", "duration_minutes": 30, "description": "Cita de seguimiento o actualización", "descriptionEn": "Follow-up or update appointment", "icon": "refresh-cw"},
                {"id": "otro", "title": "Otro", "titleEn": "Other", "duration_minutes": 60, "description": "Otro tipo de consulta", "descriptionEn": "Other type of consultation", "icon": "help-circle"},
            ]
        
        return {"success": True, "types": result}
        
    except Exception as e:
        logging.error(f'Error getting public appointment types: {str(e)}')
        # Return defaults on error
        return {
            "success": True, 
            "types": [
                {"id": "consulta", "title": "Consulta Inicial", "titleEn": "Initial Consultation", "duration_minutes": 60, "description": "Primera cita para conocer tu situación fiscal", "descriptionEn": "First appointment to understand your tax situation", "icon": "user"}
            ]
        }


@calendar_router.post('/admin/appointment-types/seed')
async def seed_appointment_types(current_user: dict = Depends(_require_admin)):
    """Seed default appointment types to database"""
    try:
        # Check if already seeded
        existing = await _db.appointment_types.count_documents({})
        if existing > 0:
            return {"success": True, "message": f"Ya existen {existing} tipos de cita", "seeded": 0}
        
        # Default types matching frontend
        default_types = [
            {
                "id": "consulta",
                "title": "Consulta Inicial",
                "title_en": "Initial Consultation",
                "duration_minutes": 60,
                "description": "Primera cita para conocer tu situación fiscal",
                "description_en": "First appointment to understand your tax situation",
                "icon": "user",
                "is_active": True,
                "order": 1,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": "preparacion",
                "title": "Preparación de Impuestos",
                "title_en": "Tax Preparation",
                "duration_minutes": 90,
                "description": "Preparación y presentación de tu declaración",
                "description_en": "Preparation and filing of your tax return",
                "icon": "file-text",
                "is_active": True,
                "order": 2,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": "revision",
                "title": "Revisión de Documentos",
                "title_en": "Document Review",
                "duration_minutes": 45,
                "description": "Revisión de documentos fiscales",
                "description_en": "Review of tax documents",
                "icon": "calendar",
                "is_active": True,
                "order": 3,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": "seguimiento",
                "title": "Seguimiento",
                "title_en": "Follow-up",
                "duration_minutes": 30,
                "description": "Cita de seguimiento o actualización",
                "description_en": "Follow-up or update appointment",
                "icon": "refresh-cw",
                "is_active": True,
                "order": 4,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": "otro",
                "title": "Otro",
                "title_en": "Other",
                "duration_minutes": 60,
                "description": "Otro tipo de consulta",
                "description_en": "Other type of consultation",
                "icon": "help-circle",
                "is_active": True,
                "order": 5,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        result = await _db.appointment_types.insert_many(default_types)
        
        return {
            "success": True, 
            "message": f"Se crearon {len(result.inserted_ids)} tipos de cita",
            "seeded": len(result.inserted_ids)
        }
        
    except Exception as e:
        logging.error(f'Error seeding appointment types: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


class PublicAppointmentRequest(BaseModel):
    """Request model for public appointment booking (no auth required)"""
    client_name: str
    client_email: str
    client_phone: str
    scheduled_at: str  # ISO datetime string
    service_type: str = "Consulta General"
    appointment_mode: str = "in_person"  # in_person or video_call
    notes: Optional[str] = None
    referral_code: Optional[str] = None


@calendar_router.post('/public/book-appointment')
async def create_public_appointment(data: PublicAppointmentRequest):
    """
    PUBLIC endpoint - Book an appointment without requiring an account.
    Creates or finds a client record and books the appointment.
    """
    import secrets
    try:
        # Validate required fields
        if not data.client_name or len(data.client_name) < 2:
            raise HTTPException(status_code=400, detail='Nombre inválido')
        
        if not data.client_email or '@' not in data.client_email:
            raise HTTPException(status_code=400, detail='Email inválido')
        
        if not data.client_phone or len(data.client_phone) < 7:
            raise HTTPException(status_code=400, detail='Teléfono inválido')
        
        # Parse scheduled time
        try:
            scheduled_at = datetime.fromisoformat(data.scheduled_at.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail='Fecha/hora inválida')
        
        # Check min_advance_hours booking rule
        booking_rules = await _db.booking_rules.find_one({}) or {}
        min_advance_hours = booking_rules.get('min_advance_hours', 24)
        now_utc = datetime.now(timezone.utc)
        hours_until = (scheduled_at - now_utc).total_seconds() / 3600
        if hours_until < min_advance_hours:
            raise HTTPException(
                status_code=400,
                detail=f'Las citas deben agendarse con al menos {int(min_advance_hours)} horas de anticipación.'
            )
        
        # Check for GLOBAL time slot conflict using the helper function
        from appointment_routes import check_appointment_conflict
        conflict = await check_appointment_conflict(scheduled_at)
        if conflict:
            conflict_name = conflict.get('user_name') or conflict.get('client_name', 'otro cliente')
            raise HTTPException(
                status_code=409,
                detail=f'Este horario ya está ocupado por una cita con {conflict_name}. Por favor elige otro horario.'
            )
        
        # Find or create client
        existing_user = await _db.users.find_one({'email': data.client_email.lower()})
        
        if existing_user:
            user_id = str(existing_user.get('_id'))
            # Update phone if not set
            if not existing_user.get('phone'):
                await _db.users.update_one(
                    {'_id': existing_user['_id']},
                    {'$set': {'phone': data.client_phone}}
                )
        else:
            # Create new client (inactive until they create account) with temp password
            user_id = str(uuid.uuid4())
            temp_password = secrets.token_urlsafe(8)  # 8 characters random password
            hashed_password = pwd_context.hash(temp_password)
            
            new_user = {
                '_id': user_id,
                'email': data.client_email.lower(),
                'name': data.client_name,
                'full_name': data.client_name,
                'phone': data.client_phone,
                'role': 'client',  # Changed from inactive_client to client
                'hashed_password': hashed_password,
                'temp_password': True,  # Flag to require password change
                'created_at': datetime.now(timezone.utc),
                'source': 'public_booking'
            }
            await _db.users.insert_one(new_user)
            logging.info(f"✅ New client created from public booking: {data.client_email}")
            
            # Send welcome notification with credentials
            try:
                config_doc = await _db.api_config.find_one({'_id': 'main'})
                if config_doc:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    
                    # Send SMS with credentials
                    if data.client_phone and notif_service.twilio_client:
                        sms_message = f"🎉 ¡Bienvenido a Ross Tax! Tu cuenta ha sido creada.\n\n📧 Usuario: {data.client_email}\n🔐 Clave temporal: {temp_password}\n\n📱 Descarga la app: rosstaxpreparation.com/app\n\nRoss Tax (806) 244-0443"
                        try:
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=config_doc.get('twilio_phone_number'),
                                to=data.client_phone
                            )
                            logging.info(f"✅ Welcome SMS sent to {data.client_phone}")
                        except Exception as sms_err:
                            logging.warning(f"⚠️ Could not send welcome SMS: {sms_err}")
                    
                    # Send Email with credentials
                    if notif_service.sendgrid_client:
                        from sendgrid.helpers.mail import Mail
                        email_body = f'''
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">¡Bienvenido a Ross Tax!</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <h2 style="color: #6C1110;">Hola {data.client_name},</h2>
                                <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
                                
                                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                    <p><strong>📧 Email:</strong> {data.client_email}</p>
                                    <p><strong>🔐 Contraseña temporal:</strong> {temp_password}</p>
                                </div>
                                
                                <p style="color: #666;">Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="https://www.rosstaxpreparation.com/login" style="background: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Iniciar Sesión</a>
                                </div>
                                
                                <p style="color: #666; font-size: 14px;">
                                    📱 También puedes descargar nuestra app móvil:<br>
                                    <a href="https://www.rosstaxpreparation.com/app">rosstaxpreparation.com/app</a>
                                </p>
                            </div>
                            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                                <p>Ross Tax Preparation<br>301 Denrock Ave, Dalhart, TX 79022<br>(806) 244-0443</p>
                            </div>
                        </div>
                        '''
                        message = Mail(
                            from_email=config_doc.get('sendgrid_from_email', 'noreply@rosstaxpreparation.com'),
                            to_emails=data.client_email,
                            subject='🎉 ¡Bienvenido a Ross Tax! - Tus credenciales de acceso',
                            html_content=email_body
                        )
                        try:
                            notif_service.sendgrid_client.send(message)
                            logging.info(f"✅ Welcome email sent to {data.client_email}")
                        except Exception as email_err:
                            logging.warning(f"⚠️ Could not send welcome email: {email_err}")
            except Exception as notif_err:
                logging.warning(f"⚠️ Could not send welcome notifications: {notif_err}")
        
        # Create management token for the appointment
        management_token = secrets.token_urlsafe(32)
        
        # Create local appointment record (Square dependency removed)
        appointment_id = str(uuid.uuid4())
        appointment = {
            '_id': appointment_id,
            'user_id': user_id,
            'user_name': data.client_name,
            'user_email': data.client_email.lower(),
            'user_phone': data.client_phone,
            'title': data.service_type,
            'description': data.notes or '',
            'scheduled_at': scheduled_at,
            'date': scheduled_at.strftime('%Y-%m-%d'),
            'time': scheduled_at.strftime('%H:%M'),
            'duration_minutes': 30,
            'appointment_type': data.appointment_mode,
            'status': 'pending',
            'referral_code': data.referral_code,
            'source': 'public_website',
            'management_token': management_token,
            'created_at': datetime.now(timezone.utc)
        }
        
        # Tag with active tax season
        try:
            from season_context import get_season_year
            appointment['tax_year'] = await get_season_year()
        except Exception:
            pass

        await _db.appointments.insert_one(appointment)
        logging.info(f"✅ Public appointment created: {appointment_id} for {data.client_email}")
        
        # Build management URL
        manage_url = f"https://www.rosstaxpreparation.com/mi-cita/{management_token}"
        
        # Send confirmation notifications
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                
                # Format date for message
                formatted_date = scheduled_at.strftime('%d/%m/%Y')
                formatted_time = scheduled_at.strftime('%H:%M')
                mode_text = 'Presencial' if data.appointment_mode == 'in_person' else 'Video llamada'
                
                # Build documents upload URL
                docs_url = f"https://www.rosstaxpreparation.com/documentos/{management_token}"
                
                # Send SMS
                if notif_svc.twilio_client:
                    try:
                        phone = data.client_phone.replace(' ', '').replace('-', '')
                        if not phone.startswith('+'):
                            phone = '+1' + phone
                        
                        sms_msg = f"✅ ¡Cita confirmada en Ross Tax!\n📅 {formatted_date} a las {formatted_time}\n📍 {mode_text}\n\n📎 SIGUIENTE PASO: Sube tus documentos:\n{docs_url}\n\n📋 Gestiona tu cita: {manage_url}\n\n📞 (806) 934-2018"
                        
                        notif_svc.twilio_client.messages.create(
                            body=sms_msg,
                            from_=notif_svc.twilio_phone_number,
                            to=phone
                        )
                        logging.info(f"✅ Confirmation SMS sent to {phone}")
                    except Exception as sms_err:
                        logging.warning(f"SMS error: {sms_err}")
                
                # Send Email
                if notif_svc.sendgrid_client:
                    try:
                        email_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="color: white; margin: 0;">✅ ¡Cita Confirmada!</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p style="font-size: 18px;">Hola <strong>{data.client_name}</strong>,</p>
                                <p>Tu cita ha sido agendada exitosamente.</p>
                                
                                <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                    <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> {formatted_date}</p>
                                    <p style="margin: 5px 0;"><strong>🕐 Hora:</strong> {formatted_time}</p>
                                    <p style="margin: 5px 0;"><strong>📍 Tipo:</strong> {mode_text}</p>
                                    <p style="margin: 5px 0;"><strong>📋 Servicio:</strong> {data.service_type}</p>
                                </div>
                                
                                <div style="background: #d4edda; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745;">
                                    <h3 style="color: #155724; margin: 0 0 10px 0;">📎 Tu Siguiente Paso</h3>
                                    <p style="color: #155724; margin: 0 0 15px 0;">Para agilizar tu cita, sube tus documentos antes de llegar:</p>
                                    <p style="text-align: center; margin: 0;">
                                        <a href="{docs_url}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                            📤 Subir Documentos
                                        </a>
                                    </p>
                                </div>
                                
                                <p style="text-align: center; margin: 25px 0;">
                                    <a href="{manage_url}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                        📋 Gestionar mi Cita
                                    </a>
                                </p>
                                <p style="text-align: center; color: #888; font-size: 13px;">Reagendar • Cancelar • Ver detalles</p>
                                
                                <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                                    <p style="margin: 0; color: #856404;"><strong>📍 Dirección:</strong><br>
                                    305 Bruce Ave, Dumas, TX 79029</p>
                                </div>
                                
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                <p style="text-align: center; color: #666;">
                                    <strong>Ross Tax Preparation</strong><br>
                                    📞 (806) 934-2018<br>
                                    ¡Gracias por confiar en nosotros!
                                </p>
                            </div>
                        </div>
                        """
                        
                        await notif_svc.send_email(
                            data.client_email,
                            '✅ Cita Confirmada - Ross Tax Preparation',
                            email_html
                        )
                        logging.info(f"✅ Confirmation email sent to {data.client_email}")
                    except Exception as email_err:
                        logging.warning(f"Email error: {email_err}")
                        
        except Exception as notif_err:
            logging.warning(f"Notification error (appointment still created): {notif_err}")
        
        # Create automatic service order for this appointment
        try:
            service_order_id = str(uuid.uuid4())
            service_order = {
                '_id': service_order_id,
                'order_number': f"ORD-{datetime.now().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}",
                'client_id': user_id,
                'client_name': data.client_name,
                'client_email': data.client_email.lower(),
                'client_phone': data.client_phone if hasattr(data, 'client_phone') else '',
                'service_type': 'tax_preparation',
                'description': f"Declaración de Impuestos - {data.service_type}",
                'tax_year': datetime.now().year,
                'status': 'pending',
                'priority': 'medium',
                'estimated_amount': 0,
                'notes': data.notes or '',
                'appointment_id': appointment_id,
                'appointment_date': scheduled_at,
                'source': 'auto_from_appointment',
                'created_by': 'system',
                'created_by_name': 'Sistema Automático',
                'documents': [],
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            await _db.service_orders.insert_one(service_order)
            logging.info(f"✅ Service order created automatically: {service_order_id}")
        except Exception as so_err:
            logging.warning(f"Could not create service order: {so_err}")
        
        return {
            'success': True,
            'message': '¡Cita agendada exitosamente!',
            'appointment_id': appointment_id,
            'management_url': manage_url,
            'scheduled_at': scheduled_at.isoformat(),
            'confirmation': {
                'date': scheduled_at.strftime('%d/%m/%Y'),
                'time': scheduled_at.strftime('%H:%M'),
                'service': data.service_type,
                'mode': data.appointment_mode
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating public appointment: {e}")
        raise HTTPException(status_code=500, detail='Error al agendar la cita')


# ================== PUBLIC APPOINTMENT MANAGEMENT ==================

@calendar_router.get('/public/appointment/{token}')
async def get_appointment_by_token(token: str):
    """Get appointment details by management token - PUBLIC endpoint"""
    try:
        appointment = await _db.appointments.find_one({'management_token': token})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Parse scheduled_at - handle both string and datetime
        scheduled_at = appointment.get('scheduled_at')
        if isinstance(scheduled_at, str):
            try:
                scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
            except:
                scheduled_at = None
        
        # Check if appointment is in the past
        is_past = False
        if scheduled_at:
            now = datetime.now(timezone.utc)
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            is_past = scheduled_at < now
        
        return {
            'success': True,
            'appointment': {
                'id': str(appointment.get('_id')),
                'client_name': appointment.get('user_name'),
                'client_email': appointment.get('user_email'),
                'client_phone': appointment.get('user_phone'),
                'service': appointment.get('title'),
                'scheduled_at': scheduled_at.isoformat() if scheduled_at else None,
                'date': format_date_spanish(scheduled_at) if scheduled_at else '',
                'time': scheduled_at.strftime('%H:%M') if scheduled_at else '',
                'mode': appointment.get('appointment_type', 'in_person'),
                'status': appointment.get('status', 'pending'),
                'notes': appointment.get('description', ''),
                'is_past': is_past,
                'can_modify': not is_past and appointment.get('status') not in ['cancelled', 'completed']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting appointment by token: {e}")
        raise HTTPException(status_code=500, detail='Error al obtener la cita')


@calendar_router.post('/public/appointment/{token}/cancel')
async def cancel_appointment_by_token(token: str, data: dict = None):
    """Cancel an appointment by management token - PUBLIC endpoint"""
    try:
        appointment = await _db.appointments.find_one({'management_token': token})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Check if already cancelled
        if appointment.get('status') == 'cancelled':
            raise HTTPException(status_code=400, detail='Esta cita ya fue cancelada')
        
        # Check if in the past
        scheduled_at = appointment.get('scheduled_at')
        if scheduled_at and scheduled_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail='No se puede cancelar una cita pasada')
        
        # Cancel the appointment
        cancellation_reason = data.get('reason', 'Cancelada por el cliente') if data else 'Cancelada por el cliente'
        
        await _db.appointments.update_one(
            {'_id': appointment['_id']},
            {
                '$set': {
                    'status': 'cancelled',
                    'cancelled_at': datetime.now(timezone.utc),
                    'cancellation_reason': cancellation_reason,
                    'cancelled_by': 'client'
                }
            }
        )
        
        logging.info(f"✅ Appointment {appointment['_id']} cancelled by client via token")
        
        # Notify admin (optional)
        try:
            # Could send notification to admin here
            pass
        except:
            pass
        
        return {
            'success': True,
            'message': 'Cita cancelada exitosamente'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling appointment: {e}")
        raise HTTPException(status_code=500, detail='Error al cancelar la cita')


class RescheduleRequest(BaseModel):
    new_datetime: str  # ISO datetime string


@calendar_router.post('/public/appointment/{token}/reschedule')
async def reschedule_appointment_by_token(token: str, data: RescheduleRequest):
    """Reschedule an appointment by management token - PUBLIC endpoint"""
    try:
        appointment = await _db.appointments.find_one({'management_token': token})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Check if can be rescheduled
        if appointment.get('status') in ['cancelled', 'completed']:
            raise HTTPException(status_code=400, detail='Esta cita no puede ser reagendada')
        
        # Parse new datetime
        try:
            new_scheduled_at = datetime.fromisoformat(data.new_datetime.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail='Fecha/hora inválida')
        
        # Check if new time is in the future
        if new_scheduled_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail='La nueva fecha debe ser en el futuro')
        
        # Check if new slot is available
        slot_end = new_scheduled_at + timedelta(minutes=30)
        existing = await _db.appointments.find_one({
            '_id': {'$ne': appointment['_id']},
            'scheduled_at': {'$gte': new_scheduled_at, '$lt': slot_end},
            'status': {'$nin': ['cancelled', 'rejected']}
        })
        
        if existing:
            raise HTTPException(status_code=400, detail='Este horario ya no está disponible')
        
        old_scheduled = appointment.get('scheduled_at')
        
        # Update appointment
        await _db.appointments.update_one(
            {'_id': appointment['_id']},
            {
                '$set': {
                    'scheduled_at': new_scheduled_at,
                    'rescheduled_at': datetime.now(timezone.utc),
                    'rescheduled_from': old_scheduled,
                    'rescheduled_by': 'client'
                }
            }
        )
        
        logging.info(f"✅ Appointment {appointment['_id']} rescheduled by client via token")
        
        # Send confirmation notification
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                
                formatted_date = new_scheduled_at.strftime('%d/%m/%Y')
                formatted_time = new_scheduled_at.strftime('%H:%M')
                client_phone = appointment.get('user_phone', '')
                client_email = appointment.get('user_email', '')
                client_name = appointment.get('user_name', 'Cliente')
                
                # Send SMS
                if client_phone and notif_svc.twilio_client:
                    try:
                        phone = client_phone.replace(' ', '').replace('-', '')
                        if not phone.startswith('+'):
                            phone = '+1' + phone
                        
                        sms_msg = f"📅 ¡Cita reagendada en Ross Tax!\nNueva fecha: {formatted_date} a las {formatted_time}\n📞 (806) 934-2018"
                        
                        notif_svc.twilio_client.messages.create(
                            body=sms_msg,
                            from_=notif_svc.twilio_phone_number,
                            to=phone
                        )
                    except Exception as e:
                        logging.warning(f"SMS error: {e}")
                
                # Send Email
                if client_email and notif_svc.sendgrid_client:
                    try:
                        email_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="color: white; margin: 0;">📅 Cita Reagendada</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p>Hola <strong>{client_name}</strong>,</p>
                                <p>Tu cita ha sido reagendada exitosamente.</p>
                                <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                    <p style="margin: 5px 0;"><strong>📅 Nueva fecha:</strong> {formatted_date}</p>
                                    <p style="margin: 5px 0;"><strong>🕐 Nueva hora:</strong> {formatted_time}</p>
                                </div>
                                <p style="text-align: center; color: #666;">
                                    <strong>Ross Tax Preparation</strong><br>
                                    📍 305 Bruce Ave, Dumas, TX 79029<br>
                                    📞 (806) 934-2018
                                </p>
                            </div>
                        </div>
                        """
                        await notif_svc.send_email(client_email, '📅 Cita Reagendada - Ross Tax', email_html)
                    except Exception as e:
                        logging.warning(f"Email error: {e}")
                        
        except Exception as notif_err:
            logging.warning(f"Notification error: {notif_err}")
        
        return {
            'success': True,
            'message': 'Cita reagendada exitosamente',
            'new_date': formatted_date,
            'new_time': formatted_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error rescheduling appointment: {e}")
        raise HTTPException(status_code=500, detail='Error al reagendar la cita')


@calendar_router.get('/admin/calendar/connect')
async def start_google_calendar_connect(current_user: dict = Depends(_require_admin)):
    """Start Google Calendar OAuth flow - returns authorization URL"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Generate state token for security
        state = str(uuid.uuid4())
        
        # Store state in session for verification
        await _db.oauth_states.insert_one({
            'state': state,
            'admin_id': current_user['id'],
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)
        })
        
        # Get authorization URL
        auth_url = _google_calendar_service.get_authorization_url(state=state)
        
        return {
            'authorization_url': auth_url,
            'state': state
        }
    except Exception as e:
        logging.error(f"Error starting Google Calendar OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@calendar_router.get('/admin/calendar/callback')
async def google_calendar_callback(code: str, state: str):
    """OAuth callback endpoint - receives authorization code from Google"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Verify state token
        state_doc = await _db.oauth_states.find_one({'state': state})
        if not state_doc:
            raise HTTPException(status_code=400, detail="Invalid state token")
        
        # Make sure expires_at has timezone info
        expires_at = state_doc['expires_at']
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=400, detail="State token expired")
        
        admin_id = state_doc['admin_id']
        
        # Exchange code for tokens
        tokens = _google_calendar_service.exchange_code_for_tokens(code)
        
        # Store tokens in database (encrypted in production)
        await _db.calendar_tokens.update_one(
            {'admin_id': admin_id},
            {
                '$set': {
                    'access_token': tokens['access_token'],
                    'refresh_token': tokens['refresh_token'],
                    'token_expiry': tokens['token_expiry'],
                    'calendar_id': tokens['calendar_id'],
                    'connected_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        # Update availability config
        await _db.availability_configs.update_one(
            {'admin_id': admin_id},
            {
                '$set': {
                    'google_calendar_connected': True,
                    'google_calendar_id': tokens['calendar_id'],
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        # Clean up state token
        await _db.oauth_states.delete_one({'state': state})
        
        # Return success page or redirect
        return Response(
            content="""
            <html>
                <head>
                    <title>Google Calendar Connected</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                        .message { color: #666; margin-bottom: 30px; }
                        .button { 
                            background: #6C1110; 
                            color: white; 
                            padding: 12px 24px; 
                            text-decoration: none; 
                            border-radius: 6px;
                            display: inline-block;
                        }
                    </style>
                </head>
                <body>
                    <div class="success">✅ Google Calendar Connected!</div>
                    <div class="message">
                        Your Google Calendar has been successfully connected to Ross Tax Preparation.<br>
                        You can now close this window and return to the admin panel.
                    </div>
                    <a href="https://rosstaxpreparation.com/admin/horarios" class="button">
                        Return to Settings
                    </a>
                    <script>
                        setTimeout(() => window.close(), 3000);
                    </script>
                </body>
            </html>
            """,
            media_type="text/html"
        )
        
    except Exception as e:
        logging.error(f"Error in Google Calendar callback: {e}")
        return Response(
            content=f"""
            <html>
                <head><title>Connection Failed</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2 style="color: #dc3545;">❌ Connection Failed</h2>
                    <p>{str(e)}</p>
                    <a href="javascript:window.close()">Close Window</a>
                </body>
            </html>
            """,
            media_type="text/html"
        )

@calendar_router.delete('/admin/calendar/disconnect')
async def disconnect_google_calendar(current_user: dict = Depends(_require_admin)):
    """Disconnect Google Calendar and revoke access"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Get tokens to revoke
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': current_user['id']})
        
        if tokens_doc:
            # Revoke access token with Google
            access_token = tokens_doc.get('access_token')
            refresh_token = tokens_doc.get('refresh_token')
            
            # Try to revoke both tokens
            revoked = False
            if access_token:
                revoked = _google_calendar_service.revoke_token(access_token)
                logging.info(f"Access token revocation: {'success' if revoked else 'failed'}")
            
            if refresh_token:
                revoked = _google_calendar_service.revoke_token(refresh_token) or revoked
                logging.info(f"Refresh token revocation: {'success' if revoked else 'failed'}")
            
            # Delete local tokens regardless of revocation result
            await _db.calendar_tokens.delete_one({'admin_id': current_user['id']})
        
        # Update availability config
        await _db.availability_configs.update_one(
            {'admin_id': current_user['id']},
            {
                '$set': {
                    'google_calendar_connected': False,
                    'google_calendar_id': None,
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        return {'status': 'disconnected', 'message': 'Google Calendar disconnected successfully'}
        
    except Exception as e:
        logging.error(f"Error disconnecting Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@calendar_router.get('/admin/calendar/status')
async def get_calendar_connection_status(current_user: dict = Depends(_require_admin)):
    """Get Google Calendar connection status"""
    try:
        admin_id = current_user['id']
        
        # Check tokens first (most reliable indicator)
        tokens = await _db.calendar_tokens.find_one({'admin_id': admin_id})
        
        # If no tokens, not connected
        if not tokens:
            return {
                'connected': False,
                'calendar_id': None,
                'connected_at': None
            }
        
        # We have tokens, so we're connected
        return {
            'connected': True,
            'calendar_id': tokens.get('calendar_id', 'primary'),
            'connected_at': tokens.get('connected_at').isoformat() if tokens.get('connected_at') else None
        }
        
    except Exception as e:
        logging.error(f"Error getting calendar status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@calendar_router.get('/admin/calendar/debug')
async def debug_calendar_connection(current_user: dict = Depends(_require_admin)):
    """Debug endpoint to check calendar connection data"""
    try:
        admin_id = current_user['id']
        
        # Get all tokens in the collection
        all_tokens = await _db.calendar_tokens.find({}).to_list(100)
        
        # Get tokens for this admin
        tokens = await _db.calendar_tokens.find_one({'admin_id': admin_id})
        
        # Get availability config
        config = await _db.availability_configs.find_one({'admin_id': admin_id})
        
        return {
            'current_user_id': admin_id,
            'current_user_id_type': str(type(admin_id)),
            'tokens_found': tokens is not None,
            'tokens_admin_id': tokens.get('admin_id') if tokens else None,
            'all_tokens_count': len(all_tokens),
            'all_tokens_admin_ids': [t.get('admin_id') for t in all_tokens],
            'config_found': config is not None
        }
    except Exception as e:
        return {'error': str(e)}

@calendar_router.get('/admin/calendar/list')
async def list_user_calendars(current_user: dict = Depends(_require_admin)):
    """List all calendars available to the user"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Get tokens
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': current_user['id']})
        if not tokens_doc:
            raise HTTPException(status_code=400, detail="Google Calendar not connected")
        
        # Get credentials
        credentials = _google_calendar_service.get_credentials_from_tokens(
            tokens_doc['access_token'],
            tokens_doc['refresh_token']
        )
        
        # Get list of calendars
        calendars = _google_calendar_service.list_calendars(credentials)
        
        return {
            'calendars': calendars,
            'current_calendar_id': tokens_doc.get('calendar_id', 'primary')
        }
        
    except Exception as e:
        logging.error(f"Error listing calendars: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@calendar_router.post('/admin/calendar/select')
async def select_calendar(
    calendar_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Select which calendar to use for appointments"""
    try:
        # Update calendar_id in tokens
        await _db.calendar_tokens.update_one(
            {'admin_id': current_user['id']},
            {
                '$set': {
                    'calendar_id': calendar_id,
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        # Update availability config
        await _db.availability_configs.update_one(
            {'admin_id': current_user['id']},
            {
                '$set': {
                    'google_calendar_id': calendar_id,
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            'status': 'success',
            'calendar_id': calendar_id,
            'message': 'Calendar seleccionado exitosamente'
        }
        
    except Exception as e:
        logging.error(f"Error selecting calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@calendar_router.post('/admin/calendar/sync')
async def sync_appointments_to_calendar(current_user: dict = Depends(_require_admin)):
    """Manually sync all future appointments to Google Calendar"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Get tokens
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': current_user['id']})
        if not tokens_doc:
            raise HTTPException(status_code=400, detail="Google Calendar not connected")
        
        # Get credentials
        credentials = _google_calendar_service.get_credentials_from_tokens(
            tokens_doc['access_token'],
            tokens_doc['refresh_token']
        )
        
        # Get all future appointments without calendar_event_id
        now = datetime.now(timezone.utc)
        future_appointments = await _db.appointments.find({
            '$or': [
                {'scheduled_at': {'$gte': now}},
                {'date': {'$gte': now}},
                {'date': {'$gte': now.isoformat()}}
            ],
            'status': {'$nin': ['cancelled', 'completed']},
            '$or': [
                {'calendar_event_id': {'$exists': False}},
                {'calendar_event_id': None},
                {'calendar_event_id': ''}
            ]
        }).to_list(100)
        
        # If no results, try a simpler query
        if not future_appointments:
            future_appointments = await _db.appointments.find({
                'status': {'$nin': ['cancelled', 'completed']},
                '$or': [
                    {'calendar_event_id': {'$exists': False}},
                    {'calendar_event_id': None},
                    {'calendar_event_id': ''}
                ]
            }).to_list(100)
        
        logging.info(f"Found {len(future_appointments)} appointments to sync")
        
        synced_count = 0
        failed_count = 0
        
        for appointment in future_appointments:
            try:
                # Get user info - handle different ID formats
                user_id = appointment.get('user_id')
                user = None
                
                if user_id:
                    # Try different ID formats
                    try:
                        if ObjectId.is_valid(str(user_id)):
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    except:
                        pass
                    
                    if not user:
                        user = await _db.users.find_one({'_id': user_id})
                    if not user:
                        user = await _db.users.find_one({'id': str(user_id)})
                
                # Get user name from appointment or user record
                user_name = appointment.get('user_name') or appointment.get('client_name')
                if not user_name and user:
                    user_name = user.get('name') or user.get('full_name', 'Cliente')
                if not user_name:
                    user_name = 'Cliente'
                
                user_email = appointment.get('user_email') or appointment.get('client_email')
                if not user_email and user:
                    user_email = user.get('email', '')
                
                # Get appointment datetime
                apt_datetime = appointment.get('scheduled_at') or appointment.get('date')
                if isinstance(apt_datetime, str):
                    apt_datetime = datetime.fromisoformat(apt_datetime.replace('Z', '+00:00'))
                
                if not apt_datetime:
                    logging.warning(f"Appointment {appointment['_id']} has no date, skipping")
                    continue
                
                # Create calendar event
                event_result = _google_calendar_service.create_calendar_event(
                    credentials=credentials,
                    summary=f"Cita: {user_name}",
                    description=f"Tipo: {appointment.get('type', appointment.get('service_name', 'general'))}\nNotas: {appointment.get('notes', 'N/A')}",
                    start_datetime=apt_datetime,
                    end_datetime=apt_datetime + timedelta(minutes=60),
                    attendee_email=user_email or '',
                    calendar_id=tokens_doc.get('calendar_id', 'primary')
                )
                
                # Update appointment with event ID
                await _db.appointments.update_one(
                    {'_id': appointment['_id']},
                    {
                        '$set': {
                            'calendar_event_id': event_result['event_id'],
                            'calendar_event_link': event_result['event_link']
                        }
                    }
                )
                
                synced_count += 1
                
            except Exception as e:
                logging.error(f"Error syncing appointment {appointment['_id']}: {e}")
                failed_count += 1
        
        return {
            'status': 'completed',
            'synced': synced_count,
            'failed': failed_count,
            'total': len(future_appointments)
        }
        
    except Exception as e:
        logging.error(f"Error syncing appointments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@calendar_router.post('/admin/calendar/import')
async def import_google_calendar_events(current_user: dict = Depends(_require_admin)):
    """Import events FROM Google Calendar INTO the webapp"""
    if not _google_calendar_service:
        raise HTTPException(status_code=503, detail="Google Calendar service not configured")
    
    try:
        # Get tokens
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': current_user['id']})
        if not tokens_doc:
            raise HTTPException(status_code=400, detail="Google Calendar not connected")
        
        # Get credentials
        credentials = _google_calendar_service.get_credentials_from_tokens(
            tokens_doc['access_token'],
            tokens_doc['refresh_token']
        )
        
        calendar_id = tokens_doc.get('calendar_id', 'primary')
        
        # Get events from Google Calendar (next 90 days)
        now = datetime.now(timezone.utc)
        time_max = now + timedelta(days=90)
        
        google_events = _google_calendar_service.list_events(
            credentials=credentials,
            time_min=now,
            time_max=time_max,
            max_results=200,
            calendar_id=calendar_id
        )
        
        logging.info(f"Found {len(google_events)} events in Google Calendar")
        
        imported_count = 0
        skipped_count = 0
        failed_count = 0
        
        for event in google_events:
            try:
                event_id = event.get('event_id')
                summary = event.get('summary', 'Sin título')
                start_str = event.get('start')
                is_all_day = event.get('is_all_day', False)
                
                if not start_str or not event_id:
                    logging.warning(f"Skipping event without start or id: {summary}")
                    skipped_count += 1
                    continue
                
                # Check if this event is already imported
                existing = await _db.appointments.find_one({
                    'calendar_event_id': event_id
                })
                
                if existing:
                    skipped_count += 1
                    continue
                
                # Parse the start datetime
                try:
                    import pytz
                    texas_tz = pytz.timezone('America/Chicago')
                    
                    if is_all_day:
                        # All-day events have format YYYY-MM-DD
                        start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=9, minute=0, tzinfo=texas_tz)
                    elif 'T' in start_str:
                        # Regular datetime format - Google returns with timezone offset
                        # Parse the ISO format which includes timezone
                        start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                        # Convert to Texas time for display
                        if start_dt.tzinfo:
                            start_dt = start_dt.astimezone(texas_tz)
                        else:
                            start_dt = texas_tz.localize(start_dt)
                    else:
                        # Just date without time
                        start_dt = datetime.strptime(start_str[:10], '%Y-%m-%d').replace(hour=9, minute=0, tzinfo=texas_tz)
                except Exception as parse_error:
                    logging.warning(f"Could not parse date '{start_str}': {parse_error}")
                    import pytz
                    texas_tz = pytz.timezone('America/Chicago')
                    start_dt = datetime.now(texas_tz)
                
                # Extract client name from summary
                client_name = summary.split(' - ')[0] if ' - ' in summary else summary
                
                # Create appointment from Google Calendar event
                new_appointment = {
                    '_id': str(uuid.uuid4()),
                    'user_id': None,  # No user associated yet
                    'client_name': client_name,
                    'client_email': '',
                    'client_phone': '',
                    'service_name': 'Importado de Google Calendar',
                    'appointment_type': 'Consulta General',
                    'type': 'general',
                    'date': start_dt.strftime('%Y-%m-%d'),
                    'time_slot': start_dt.strftime('%H:%M'),
                    'time': start_dt.strftime('%H:%M'),
                    'scheduled_at': start_dt,
                    'status': 'scheduled',
                    'notes': f'Importado desde Google Calendar: {summary}' + (f'\nDescripción: {event.get("description", "")}' if event.get("description") else ''),
                    'location': event.get('location', ''),
                    'calendar_event_id': event_id,
                    'source': 'google_calendar_import',
                    'is_all_day': is_all_day,
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }
                
                # Try to extract client info from description and link/create user
                description = event.get('description', '')
                if description:
                    client_info = parse_square_description(description, summary)
                    
                    if client_info.get('name') and client_info['name'] != 'Cliente':
                        new_appointment['client_name'] = client_info['name']
                    if client_info.get('email'):
                        new_appointment['client_email'] = client_info['email']
                    if client_info.get('phone'):
                        new_appointment['client_phone'] = client_info['phone']
                    if client_info.get('service'):
                        new_appointment['service_name'] = client_info['service']
                    
                    # Try to find or create user
                    if client_info.get('phone') or client_info.get('email'):
                        user = None
                        
                        # Search by phone
                        if client_info.get('phone'):
                            phone_clean = re.sub(r'\D', '', client_info['phone'])[-10:]
                            if phone_clean:
                                user = await _db.users.find_one({
                                    'phone': {'$regex': phone_clean}
                                })
                        
                        # Search by email
                        if not user and client_info.get('email'):
                            user = await _db.users.find_one({
                                'email': client_info['email'].lower()
                            })
                        
                        if user:
                            # Link to existing user
                            new_appointment['user_id'] = str(user['_id'])
                            new_appointment['user_name'] = user.get('full_name') or user.get('name')
                            new_appointment['user_email'] = user.get('email')
                        elif client_info.get('phone'):
                            # Create new user with notifications
                            appointment_info = {
                                'date': start_dt.strftime('%d/%m/%Y'),
                                'time': start_dt.strftime('%I:%M %p'),
                                'service': client_info.get('service') or 'Consulta'
                            }
                            
                            try:
                                new_user = await create_user_from_import(
                                    name=client_info['name'],
                                    phone=client_info['phone'],
                                    email=client_info.get('email'),
                                    source='google_calendar_import',
                                    appointment_info=appointment_info
                                )
                                new_appointment['user_id'] = new_user['_id']
                                new_appointment['user_name'] = new_user['name']
                                logging.info(f"✅ Created user for imported event: {client_info['name']}")
                            except Exception as user_create_error:
                                logging.error(f"Error creating user for imported event: {user_create_error}")
                
                await _db.appointments.insert_one(new_appointment)
                imported_count += 1
                logging.info(f"Imported event: {summary} at {start_dt}")
                
            except Exception as e:
                logging.error(f"Error importing event {event.get('event_id')}: {e}")
                failed_count += 1
        
        return {
            'status': 'completed',
            'imported': imported_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'total_in_google': len(google_events),
            'message': f'Se importaron {imported_count} citas de Google Calendar. {skipped_count} ya existían.'
        }
        
    except Exception as e:
        logging.error(f"Error importing from Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def parse_square_description(description: str, summary: str) -> dict:
    """Parse Square Appointments description to extract client info"""
    import re
    
    result = {
        'name': summary.split(' - ')[0] if ' - ' in summary else summary,
        'phone': '',
        'email': '',
        'service': 'Declaracion de Impuestos/Tax return',
    }
    
    if not description:
        return result
    
    lines = description.split('\n')
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Phone patterns: +17377032358, (806) 934-2018, +1 806 934 2018
        phone_match = re.search(r'(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})', line)
        if phone_match and not result['phone']:
            phone = phone_match.group(1)
            # Skip if it's the office number
            if '9342018' not in phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', ''):
                result['phone'] = phone
        
        # Email pattern
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', line)
        if email_match:
            result['email'] = email_match.group(0).lower()
        
        # Name - usually the line right after the URL or starts the description after blank line
        if line and not line.startswith('*') and not line.startswith('http') and not '@' in line:
            # Check if this looks like a name (2-4 words, no special chars except space)
            if re.match(r'^[A-Za-záéíóúñÁÉÍÓÚÑ\s]+$', line) and len(line.split()) <= 5:
                if len(line) > 3 and line != 'Cerrado O':  # Skip "Cerrado O" placeholder
                    result['name'] = line
        
        # Service type
        if 'Declaracion de Impuestos' in line or 'Tax return' in line:
            result['service'] = 'Declaracion de Impuestos/Tax return'
    
    return result


# ================== HELPER: CREATE USER FROM IMPORT ==================
import secrets
import string

async def create_user_from_import(
    name: str,
    phone: str,
    email: str = None,
    source: str = 'calendar_import',
    appointment_info: dict = None
) -> dict:
    """
    Create a new user from calendar/external import with temporary password.
    Sends welcome notification with:
    - Temporary password
    - Appointment details (if provided)
    - iOS app download link
    
    Returns the created user dict with 'temp_password' field
    """
    from notification_service import notification_service
    
    # Generate temporary password (8 chars, easy to type)
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    
    # Format phone
    phone_formatted = phone
    if phone_formatted and not phone_formatted.startswith('+'):
        phone_clean = re.sub(r'\D', '', phone_formatted)
        if len(phone_clean) == 10:
            phone_formatted = f"+1{phone_clean}"
        elif len(phone_clean) == 11 and phone_clean.startswith('1'):
            phone_formatted = f"+{phone_clean}"
    
    # Create user ID
    new_user_id = str(uuid.uuid4())
    
    # Use real email or generate temp one
    user_email = email if email and '@' in email else f"cliente_{new_user_id[:8]}@temp.rosstax.com"
    
    new_user = {
        '_id': new_user_id,
        'id': new_user_id,
        'full_name': name,
        'name': name,
        'email': user_email,
        'phone': phone_formatted,
        'password_hash': hash_password(temp_password),
        'role': 'client',
        'status': 'active',
        'source': source,
        'needs_password_change': True,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    await _db.users.insert_one(new_user)
    logging.info(f"✅ Created user from import: {name} - {phone_formatted} - {user_email}")
    
    # iOS App link
    ios_link = "https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX"
    
    # Send SMS notification
    try:
        if phone_formatted and notification_service:
            # Build appointment info text
            apt_text = ""
            if appointment_info:
                apt_date = appointment_info.get('date', '')
                apt_time = appointment_info.get('time', '')
                apt_service = appointment_info.get('service', 'Cita')
                if apt_date:
                    apt_text = f"\n\n📅 Tu cita: {apt_service}\n🗓️ {apt_date}"
                    if apt_time:
                        apt_text += f" a las {apt_time}"
                    apt_text += "\n📍 305 Bruce Ave, Dumas, TX 79029"
            
            sms_message = f"""¡Hola {name}! 👋

Te damos la bienvenida a Ross Tax Preparation.

🔐 Tu cuenta ha sido creada:
📧 Usuario: {user_email}
🔑 Contraseña temporal: {temp_password}
{apt_text}

📱 Descarga nuestra app para gestionar tus impuestos:
{ios_link}

¿Preguntas? Llámanos: (806) 934-2018

Ross Tax Preparation"""

            await notification_service.send_sms(phone_formatted, sms_message)
            logging.info(f"✅ Welcome SMS sent to {phone_formatted}")
    except Exception as sms_error:
        logging.error(f"❌ Error sending welcome SMS: {sms_error}")
    
    # Send Email notification
    try:
        if user_email and '@temp.rosstax.com' not in user_email and notification_service:
            # Build appointment HTML
            apt_html = ""
            if appointment_info:
                apt_date = appointment_info.get('date', '')
                apt_time = appointment_info.get('time', '')
                apt_service = appointment_info.get('service', 'Cita')
                if apt_date:
                    apt_html = f"""
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                        <h3 style="margin: 0 0 10px 0; color: #166534;">📅 Tu Cita Programada</h3>
                        <p style="margin: 5px 0;"><strong>Servicio:</strong> {apt_service}</p>
                        <p style="margin: 5px 0;"><strong>Fecha:</strong> {apt_date}</p>
                        {'<p style="margin: 5px 0;"><strong>Hora:</strong> ' + apt_time + '</p>' if apt_time else ''}
                        <p style="margin: 5px 0;"><strong>Lugar:</strong> 305 Bruce Ave, Dumas, TX 79029</p>
                    </div>
                    """
            
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">¡Bienvenido a Ross Tax! 🎉</h1>
                </div>
                
                <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px;">Hola <strong>{name}</strong>,</p>
                    <p>Nos alegra tenerte como parte de Ross Tax Preparation. Hemos creado tu cuenta para que puedas gestionar tus servicios de impuestos fácilmente.</p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                        <h3 style="margin: 0 0 15px 0; color: #6C1110;">🔐 Tus Credenciales de Acceso</h3>
                        <p style="margin: 5px 0;"><strong>Email:</strong> {user_email}</p>
                        <p style="margin: 5px 0;"><strong>Contraseña temporal:</strong> <code style="background: #fee2e2; padding: 2px 8px; border-radius: 4px; font-size: 16px;">{temp_password}</code></p>
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">⚠️ Te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
                    </div>
                    
                    {apt_html}
                    
                    <div style="background: #1f2937; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                        <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">📱 Descarga nuestra App</p>
                        <a href="{ios_link}" style="display: inline-block; background: white; color: #1f2937; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                            🍎 Descargar en App Store
                        </a>
                        <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">App para Android próximamente disponible</p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">¿Tienes preguntas? Contáctanos:</p>
                    <p style="margin: 5px 0;">📞 (806) 934-2018</p>
                    <p style="margin: 5px 0;">📧 info@rosstaxpreparation.com</p>
                    <p style="margin: 5px 0;">📍 305 Bruce Ave, Dumas, TX 79029</p>
                </div>
            </div>
            """
            
            await notification_service.send_email(
                to_email=user_email,
                subject="¡Bienvenido a Ross Tax! 🎉 Tu cuenta está lista",
                html_content=email_html
            )
            logging.info(f"✅ Welcome email sent to {user_email}")
    except Exception as email_error:
        logging.error(f"❌ Error sending welcome email: {email_error}")
    
    # Send WhatsApp notification
    try:
        if phone_formatted:
            from whatsapp_service import whatsapp_service
            
            apt_text = ""
            if appointment_info:
                apt_date = appointment_info.get('date', '')
                apt_service = appointment_info.get('service', 'Cita')
                if apt_date:
                    apt_text = f"\n\n📅 *Tu cita:* {apt_service}\n🗓️ {apt_date}\n📍 305 Bruce Ave, Dumas, TX"
            
            wa_message = f"""¡Hola *{name}*! 👋

🎉 *Bienvenido a Ross Tax Preparation*

Tu cuenta ha sido creada:
📧 *Usuario:* {user_email}
🔑 *Contraseña:* {temp_password}
{apt_text}

📱 *Descarga nuestra app:*
{ios_link}

_Ross Tax Preparation_
(806) 934-2018"""
            
            await whatsapp_service.send_message(phone_formatted, wa_message)
            logging.info(f"✅ Welcome WhatsApp sent to {phone_formatted}")
    except Exception as wa_error:
        logging.error(f"❌ Error sending welcome WhatsApp: {wa_error}")
    
    # Return user with temp password (for logging purposes)
    new_user['temp_password'] = temp_password
    return new_user


@calendar_router.post('/admin/calendar/reprocess')
async def reprocess_imported_appointments(current_user: dict = Depends(_require_admin)):
    """
    Reprocess all imported appointments to extract client info from notes
    and create/link user accounts
    """
    from bson import ObjectId
    import re
    
    try:
        # Find all appointments with notes containing "Importado desde Google Calendar"
        appointments = await _db.appointments.find({
            'notes': {'$regex': 'Importado desde Google Calendar'}
        }).to_list(1000)
        
        processed_count = 0
        created_users = 0
        linked_users = 0
        errors = []
        
        for apt in appointments:
            try:
                notes = apt.get('notes', '')
                summary = apt.get('client_name', '') or 'Cliente'
                
                # Parse the description to extract client info
                client_info = parse_square_description(notes, summary)
                
                if client_info['name'] == 'Cliente' or client_info['name'] == 'Cerrado O':
                    continue  # Skip placeholder names
                
                # Check if user already exists by phone or email
                user = None
                if client_info['phone']:
                    phone_clean = re.sub(r'\D', '', client_info['phone'])[-10:]
                    user = await _db.users.find_one({
                        '$or': [
                            {'phone': {'$regex': phone_clean}},
                            {'phone': {'$regex': client_info['phone'].replace('+', '\\+')}}
                        ]
                    })
                
                if not user and client_info['email']:
                    user = await _db.users.find_one({'email': client_info['email'].lower()})
                
                if not user and client_info['name'] and client_info['name'] != 'Cliente':
                    # Try to find by name (exact match)
                    user = await _db.users.find_one({
                        '$or': [
                            {'full_name': {'$regex': f'^{re.escape(client_info["name"])}$', '$options': 'i'}},
                            {'name': {'$regex': f'^{re.escape(client_info["name"])}$', '$options': 'i'}}
                        ]
                    })
                
                user_id = None
                
                if user:
                    user_id = str(user['_id'])
                    linked_users += 1
                else:
                    # Create new user using helper function (sends notifications)
                    # Only create if we have a phone number
                    if client_info['phone']:
                        # Get appointment info for the notification
                        apt_scheduled = apt.get('scheduled_at') or apt.get('start_time')
                        apt_date_str = ""
                        apt_time_str = ""
                        if apt_scheduled:
                            if isinstance(apt_scheduled, str):
                                try:
                                    apt_scheduled = datetime.fromisoformat(apt_scheduled.replace('Z', '+00:00'))
                                except:
                                    pass
                            if isinstance(apt_scheduled, datetime):
                                apt_date_str = apt_scheduled.strftime('%d/%m/%Y')
                                apt_time_str = apt_scheduled.strftime('%I:%M %p')
                        
                        appointment_info = {
                            'date': apt_date_str,
                            'time': apt_time_str,
                            'service': client_info.get('service') or apt.get('service_name') or apt.get('title') or 'Consulta'
                        }
                        
                        new_user = await create_user_from_import(
                            name=client_info['name'],
                            phone=client_info['phone'],
                            email=client_info.get('email'),
                            source='google_calendar_import',
                            appointment_info=appointment_info
                        )
                        user_id = new_user['_id']
                        created_users += 1
                    else:
                        # No phone, skip user creation
                        logging.warning(f"Skipping user creation for {client_info['name']} - no phone number")
                    created_users += 1
                    logging.info(f"Created user: {client_info['name']} - {client_info['phone']} - {client_info['email']}")
                
                # Update appointment with extracted info and user_id
                update_data = {
                    'client_name': client_info['name'],
                    'user_name': client_info['name'],
                    'client_phone': client_info['phone'],
                    'client_email': client_info['email'],
                    'user_email': client_info['email'],
                    'service_name': client_info['service'],
                    'updated_at': datetime.now(timezone.utc)
                }
                
                if user_id:
                    update_data['user_id'] = user_id
                    update_data['client_id'] = user_id
                
                await _db.appointments.update_one(
                    {'_id': apt['_id']},
                    {'$set': update_data}
                )
                processed_count += 1
                
            except Exception as e:
                errors.append(f"Error processing appointment {apt.get('_id')}: {str(e)}")
                logging.error(f"Error processing appointment: {e}")
        
        return {
            'status': 'completed',
            'processed': processed_count,
            'created_users': created_users,
            'linked_users': linked_users,
            'errors': errors[:10],  # Return first 10 errors
            'message': f'Procesadas {processed_count} citas. {created_users} usuarios creados, {linked_users} usuarios vinculados.'
        }
        
    except Exception as e:
        logging.error(f"Error reprocessing appointments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@calendar_router.post('/admin/calendar/fix-timezone')
async def fix_appointment_timezones(current_user: dict = Depends(_require_admin)):
    """
    Fix timezone issues for imported appointments.
    Converts UTC times to America/Chicago (Texas CST/CDT).
    """
    import pytz
    
    try:
        texas_tz = pytz.timezone('America/Chicago')
        utc_tz = pytz.UTC
        
        # Find all appointments that might have timezone issues
        appointments = await _db.appointments.find({
            'source': {'$regex': 'google_calendar', '$options': 'i'}
        }).to_list(5000)
        
        fixed_count = 0
        errors = []
        
        for apt in appointments:
            try:
                scheduled_at = apt.get('scheduled_at')
                current_time = apt.get('time') or apt.get('time_slot')
                
                if scheduled_at:
                    # If scheduled_at is a datetime object
                    if isinstance(scheduled_at, datetime):
                        # Check if it's in UTC (no timezone or UTC)
                        if scheduled_at.tzinfo is None or scheduled_at.tzinfo == utc_tz:
                            # Assume the time was meant to be in Texas time
                            # but was stored as UTC incorrectly
                            # Actually, Google Calendar sends times with timezone
                            # The issue is the time was stored correctly but displayed as UTC
                            
                            # Re-calculate the time in Texas
                            if scheduled_at.tzinfo is None:
                                scheduled_at = utc_tz.localize(scheduled_at)
                            
                            texas_time = scheduled_at.astimezone(texas_tz)
                            
                            # Update the appointment
                            await _db.appointments.update_one(
                                {'_id': apt['_id']},
                                {'$set': {
                                    'time': texas_time.strftime('%H:%M'),
                                    'time_slot': texas_time.strftime('%H:%M'),
                                    'date': texas_time.strftime('%Y-%m-%d'),
                                    'timezone_fixed': True,
                                    'updated_at': datetime.now(timezone.utc)
                                }}
                            )
                            fixed_count += 1
                    elif isinstance(scheduled_at, str):
                        # Parse string datetime
                        try:
                            dt = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                            texas_time = dt.astimezone(texas_tz)
                            
                            await _db.appointments.update_one(
                                {'_id': apt['_id']},
                                {'$set': {
                                    'time': texas_time.strftime('%H:%M'),
                                    'time_slot': texas_time.strftime('%H:%M'),
                                    'date': texas_time.strftime('%Y-%m-%d'),
                                    'timezone_fixed': True,
                                    'updated_at': datetime.now(timezone.utc)
                                }}
                            )
                            fixed_count += 1
                        except Exception as parse_error:
                            logging.warning(f"Could not parse scheduled_at: {parse_error}")
                            
            except Exception as e:
                errors.append(f"Error fixing appointment {apt.get('_id')}: {str(e)}")
        
        return {
            'success': True,
            'fixed_count': fixed_count,
            'total_processed': len(appointments),
            'errors': errors[:10],
            'message': f'Corregidas {fixed_count} citas de {len(appointments)} procesadas.'
        }
        
    except Exception as e:
        logging.error(f"Error fixing timezones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@calendar_router.get('/admin/calendar/events')
async def get_admin_calendar_events(
    start_date: str = Query(None, description="Start date in ISO format"),
    end_date: str = Query(None, description="End date in ISO format"),
    current_user: dict = Depends(_require_admin)
):
    """
    Get calendar events for admin dashboard.
    Returns appointments within the specified date range.
    """
    try:
        # Parse dates
        if start_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        else:
            start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)
        
        if end_date:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            # Default to 3 months ahead
            end = start + timedelta(days=90)
        
        # Get appointments in range - search by multiple date formats
        appointments = await _db.appointments.find({
            '$or': [
                {'scheduled_at': {'$gte': start, '$lte': end}},
                {'date': {'$gte': start.strftime('%Y-%m-%d'), '$lte': end.strftime('%Y-%m-%d')}}
            ]
        }).sort('created_at', -1).to_list(500)
        
        events = []
        for apt in appointments:
            try:
                # Get user info
                user = None
                user_id = apt.get('user_id')
                if user_id:
                    try:
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        if not user:
                            user = await _db.users.find_one({'_id': user_id})
                    except:
                        user = await _db.users.find_one({'_id': user_id})
                
                # Build event object
                scheduled_at = apt.get('scheduled_at')
                duration = apt.get('duration_minutes', apt.get('duration', 60))
                
                # Handle different date formats
                if scheduled_at:
                    if isinstance(scheduled_at, str):
                        try:
                            scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                        except:
                            # Try parsing date and time separately
                            date_str = apt.get('date', '')
                            time_str = apt.get('time', '10:00')
                            if date_str:
                                try:
                                    scheduled_at = datetime.fromisoformat(f"{date_str[:10]}T{time_str}:00")
                                except:
                                    continue
                            else:
                                continue
                elif apt.get('date'):
                    # Build from date and time fields
                    date_str = apt.get('date', '')[:10] if apt.get('date') else ''
                    time_str = apt.get('time', '10:00')
                    if date_str:
                        try:
                            scheduled_at = datetime.fromisoformat(f"{date_str}T{time_str}:00")
                        except:
                            continue
                    else:
                        continue
                else:
                    continue
                
                client_name = apt.get('user_name') or apt.get('client_name') or (user.get('name') if user else 'Cliente')
                service_name = apt.get('service_name') or apt.get('service_type') or apt.get('type', 'Cita')
                
                event = {
                    'id': str(apt.get('_id') or apt.get('id')),
                    'title': f"{client_name} - {service_name}",
                    'start': scheduled_at.isoformat() if scheduled_at else None,
                    'end': (scheduled_at + timedelta(minutes=int(duration))).isoformat() if scheduled_at else None,
                    'status': apt.get('status', 'pending'),
                    'type': apt.get('type') or apt.get('service_type', 'general'),
                    'client_name': client_name,
                    'client_email': apt.get('user_email') or (user.get('email') if user else apt.get('client_email', '')),
                    'client_phone': apt.get('user_phone') or (user.get('phone') if user else apt.get('client_phone', '')),
                    'notes': apt.get('notes', ''),
                    'appointment_mode': apt.get('appointment_mode', 'in_person'),
                    'calendar_event_id': apt.get('calendar_event_id'),
                    'calendar_event_link': apt.get('calendar_event_link'),
                    'color': _get_status_color(apt.get('status', 'pending'))
                }
                events.append(event)
            except Exception as event_error:
                logging.warning(f"Error building event: {event_error}")
                continue
        
        # Check if Google Calendar is connected
        google_connected = False
        blocked_slots = []
        try:
            # Check availability_configs for Google connection status
            admin_id = current_user.get('id') or str(current_user.get('_id'))
            config = await _db.availability_configs.find_one({'admin_id': admin_id})
            if config and config.get('google_calendar_connected'):
                google_connected = True
                
                # If connected, get Google Calendar events as blocked slots
                google_tokens = await _db.google_calendar_tokens.find_one({'admin_id': admin_id})
                if google_tokens and google_calendar_service:
                    try:
                        credentials = _google_calendar_service.get_credentials_from_tokens(
                            google_tokens.get('access_token'),
                            google_tokens.get('refresh_token')
                        )
                        if credentials:
                            calendar_id = google_tokens.get('calendar_id', 'primary')
                            google_events = _google_calendar_service.get_events(
                                credentials=credentials,
                                start_date=start,
                                end_date=end,
                                calendar_id=calendar_id
                            )
                            for event in google_events:
                                event_start = event.get('start', {})
                                start_time = event_start.get('dateTime', event_start.get('date', ''))
                                if start_time:
                                    try:
                                        dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                                        blocked_slots.append({
                                            'date': dt.strftime('%Y-%m-%d'),
                                            'time': dt.strftime('%H:%M'),
                                            'summary': event.get('summary', 'Ocupado'),
                                            'source': 'google_calendar'
                                        })
                                    except:
                                        pass
                    except Exception as gcal_error:
                        logging.warning(f"Error fetching Google Calendar events: {gcal_error}")
        except Exception as config_error:
            logging.warning(f"Error checking Google Calendar config: {config_error}")
        
        return {
            'success': True,
            'events': events,
            'total': len(events),
            'connected': google_connected,
            'blocked_slots': blocked_slots
        }
        
    except Exception as e:
        logging.error(f"Error getting calendar events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_status_color(status: str) -> str:
    """Get color for appointment status"""
    colors = {
        'pending': '#FFA500',      # Orange
        'confirmed': '#4CAF50',    # Green
        'completed': '#2196F3',    # Blue
        'cancelled': '#F44336',    # Red
        'no_show': '#9E9E9E'       # Gray
    }
    return colors.get(status, '#FFA500')


@calendar_router.get('/calendar/events')
async def get_calendar_events_public(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """
    Get busy times from Google Calendar for a specific date.
    This is used by the public appointment booking page to check availability.
    """
    if not _google_calendar_service:
        return {'events': [], 'connected': False}
    
    try:
        # Find admin with calendar connected
        admin = await _db.users.find_one({'role': 'admin'})
        if not admin:
            return {'events': [], 'connected': False}
        
        # Get tokens
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': str(admin['_id'])})
        if not tokens_doc:
            return {'events': [], 'connected': False}
        
        # Get credentials
        credentials = _google_calendar_service.get_credentials_from_tokens(
            tokens_doc['access_token'],
            tokens_doc['refresh_token']
        )
        
        # Parse date and get events for that day
        target_date = datetime.strptime(date, '%Y-%m-%d')
        time_min = target_date.replace(hour=0, minute=0, second=0)
        time_max = target_date.replace(hour=23, minute=59, second=59)
        
        events = _google_calendar_service.list_events(
            credentials=credentials,
            time_min=time_min,
            time_max=time_max,
            calendar_id=tokens_doc.get('calendar_id', 'primary')
        )
        
        # Return simplified event data (just start/end times)
        return {
            'events': [
                {
                    'start': event['start'],
                    'end': event['end'],
                    'summary': event.get('summary', 'Ocupado')
                }
                for event in events
                if event['start'] and event['end']
            ],
            'connected': True
        }
        
    except Exception as e:
        logging.error(f"Error fetching calendar events: {e}")
        return {'events': [], 'connected': False, 'error': str(e)}


