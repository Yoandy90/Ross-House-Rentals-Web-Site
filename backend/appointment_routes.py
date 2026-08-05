"""
Appointment & Scheduling Router
Extracted from server.py for modularization.
Handles appointments CRUD, availability, booking rules, waiting list, recurring appointments,
metrics, schedule blocking, client confirmations, pre-appointment forms, ratings, and reminders.
"""
import logging
import uuid
import json
import httpx
import secrets
import pytz
import re
import os
from datetime import datetime, timezone, timedelta, date, time as dt_time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Literal

logger = logging.getLogger(__name__)


# ================== AVAILABILITY MODELS ==================

class AvailabilitySlot(BaseModel):
    """Individual time slot for availability"""
    start_time: str
    end_time: str

class DayAvailability(BaseModel):
    """Availability for a specific day of the week"""
    day: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    enabled: bool = True
    slots: List[AvailabilitySlot] = []

class AvailabilityConfig(BaseModel):
    """Overall availability configuration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_id: str
    slot_duration_minutes: int = 30
    buffer_time_minutes: int = 0
    max_advance_days: int = 60
    weekly_schedule: List[DayAvailability] = []
    blocked_dates: List[str] = []
    google_calendar_connected: bool = False
    google_calendar_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class AvailabilityConfigRequest(BaseModel):
    """Request to create or update availability config"""
    slot_duration_minutes: int = 30
    buffer_time_minutes: int = 0
    max_advance_days: int = 60
    weekly_schedule: List[DayAvailability] = []
    blocked_dates: List[str] = []

class AvailableSlotResponse(BaseModel):
    """Response for available time slots"""
    date: str
    time: str
    datetime: str
    available: bool

appointment_router = APIRouter()
_db = None
_google_calendar_service = None
_notification_service = None
_sio = None


def init_appointment_router(db, google_calendar_service=None, notification_service=None, sio=None):
    global _db, _google_calendar_service, _notification_service, _sio
    _db = db
    _google_calendar_service = google_calendar_service
    _notification_service = notification_service
    _sio = sio


def update_appointment_services(google_calendar_service=None, notification_service=None, sio=None):
    global _google_calendar_service, _notification_service, _sio
    if google_calendar_service: _google_calendar_service = google_calendar_service
    if notification_service: _notification_service = notification_service
    if sio: _sio = sio


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


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 60
    status: str = 'scheduled'
    appointment_type: str = 'in_person'
    meeting_link: Optional[str] = None
    video_call_room_id: Optional[str] = None
    calendar_event_id: Optional[str] = None
    calendar_event_link: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


async def create_notification(user_id: str, title: str, body: str, data: dict = None, type: str = 'general'):
    """Helper function to create and store notification"""
    try:
        notification = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'title': title,
            'body': body,
            'data': data or {},
            'type': type,
            'read': False,
            'created_at': datetime.now(timezone.utc),
        }
        await _db.notifications.insert_one(notification)
        if _sio:
            try:
                notification_copy = notification.copy()
                notification_copy['created_at'] = notification_copy['created_at'].isoformat()
                await _sio.emit('new_notification', notification_copy, room=f'user_{user_id}')
            except Exception as e:
                logging.error(f'Error emitting Socket.IO notification: {str(e)}')
        return notification
    except Exception as e:
        logging.error(f'Error creating notification: {str(e)}')

# ================== GOOGLE CALENDAR HELPERS ==================

async def sync_appointment_to_calendar(appointment_id: str, action: str = 'create'):
    """
    Helper function to sync appointment to Google Calendar
    Actions: 'create', 'update', 'delete'
    """
    if not _google_calendar_service:
        logging.warning("Google Calendar service not available")
        return
    
    try:
        # Get appointment
        appointment = await _db.appointments.find_one({'id': appointment_id})
        if not appointment:
            return
        
        # Get admin tokens (assuming single admin for now)
        admin = await _db.users.find_one({'role': 'admin'})
        if not admin:
            return
        
        tokens_doc = await _db.calendar_tokens.find_one({'admin_id': admin['_id']})
        if not tokens_doc:
            logging.info("Google Calendar not connected for admin")
            return
        
        # Get credentials
        credentials = _google_calendar_service.get_credentials_from_tokens(
            tokens_doc['access_token'],
            tokens_doc['refresh_token']
        )
        
        # Get user info
        user = await _db.users.find_one({'_id': appointment['user_id']})
        if not user:
            return
        
        calendar_id = tokens_doc.get('calendar_id', 'primary')
        
        if action == 'create':
            # Create calendar event
            event_result = _google_calendar_service.create_calendar_event(
                credentials=credentials,
                summary=f"Cita: {user['name']}",
                description=f"Título: {appointment.get('title', 'N/A')}\nDescripción: {appointment.get('description', 'N/A')}",
                start_datetime=appointment['scheduled_at'],
                end_datetime=appointment['scheduled_at'] + timedelta(minutes=appointment.get('duration_minutes', 60)),
                attendee_email=user['email'],
                location="Ross Tax Preparation",
                calendar_id=calendar_id
            )
            
            # Update appointment with calendar event ID
            await _db.appointments.update_one(
                {'id': appointment_id},
                {
                    '$set': {
                        'calendar_event_id': event_result['event_id'],
                        'calendar_event_link': event_result['event_link']
                    }
                }
            )
            logging.info(f"Created calendar event for appointment {appointment_id}")
            
        elif action == 'delete' and appointment.get('calendar_event_id'):
            # Delete calendar event
            _google_calendar_service.delete_calendar_event(
                credentials=credentials,
                event_id=appointment['calendar_event_id'],
                calendar_id=calendar_id
            )
            logging.info(f"Deleted calendar event for appointment {appointment_id}")
            
    except Exception as e:
        logging.error(f"Error syncing appointment to calendar: {e}")
        # Don't fail the main operation if calendar sync fails

# ================== APPOINTMENT ROUTES ==================

@appointment_router.get('/appointments')
async def get_appointments(
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    current_user: dict = Depends(_auth_user)
):
    """Get appointments - returns all appointments including migrated from Square"""
    query = {'user_id': current_user['id']} if current_user['role'] == 'client' else {}
    
    # Filter by date if provided
    if date:
        try:
            from datetime import datetime, timedelta
            # Parse the date and create range for the entire day
            target_date = datetime.strptime(date, '%Y-%m-%d')
            next_day = target_date + timedelta(days=1)
            
            # Match appointments where scheduled_at is within the target date
            date_query = {
                '$or': [
                    # For datetime objects
                    {'scheduled_at': {'$gte': target_date, '$lt': next_day}},
                    # For string dates (legacy data) - match the date part
                    {'scheduled_at': {'$regex': f'^{date}'}},
                    # For date field (some records use this)
                    {'date': {'$regex': f'^{date}'}}
                ]
            }
            if query:
                query = {'$and': [query, date_query]}
            else:
                query = date_query
        except ValueError:
            pass  # Invalid date format, ignore filter
    
    appts = await _db.appointments.find(query).sort('scheduled_at', -1).to_list(500)
    
    # Convert MongoDB documents to JSON-serializable format
    appointments_list = []
    for apt in appts:
        apt_dict = {
            'id': str(apt.get('_id', apt.get('id', ''))),
            'square_id': apt.get('square_id'),
            'user_id': apt.get('user_id', ''),
            'user_name': apt.get('user_name', 'Cliente'),
            'user_email': apt.get('user_email', ''),
            'user_phone': apt.get('user_phone', ''),
            'title': apt.get('title', apt.get('service_name', 'Cita')),
            'service_name': apt.get('service_name', apt.get('title', 'Cita')),
            'description': apt.get('description', apt.get('notes', '')),
            'date': apt.get('date', ''),
            'time': apt.get('time', ''),
            'scheduled_at': apt.get('scheduled_at'),
            'duration_minutes': apt.get('duration_minutes', 30),
            'status': apt.get('status', 'scheduled'),
            'appointment_type': apt.get('appointment_type', 'in_person'),
            'source': apt.get('source', 'local'),
            'created_at': apt.get('created_at'),
            'notes': apt.get('notes', ''),
        }
        
        # Fill missing date/time from scheduled_at (convert UTC to Texas time)
        if not apt_dict['date'] and apt_dict.get('scheduled_at'):
            import pytz
            texas_tz = pytz.timezone('America/Chicago')
            sched = apt_dict['scheduled_at']
            source = apt_dict.get('source', '')
            if hasattr(sched, 'strftime'):
                if source == 'public_website':
                    # public_website scheduled_at is stored as UTC by MongoDB
                    utc_dt = sched.replace(tzinfo=timezone.utc) if sched.tzinfo is None else sched
                    local_dt = utc_dt.astimezone(texas_tz)
                    apt_dict['date'] = local_dt.strftime('%Y-%m-%d')
                    apt_dict['time'] = local_dt.strftime('%H:%M')
                else:
                    # mobile_app, tax_wizard etc: stored as local time
                    apt_dict['date'] = sched.strftime('%Y-%m-%d')
                    apt_dict['time'] = sched.strftime('%H:%M')
            elif isinstance(sched, str) and len(sched) >= 10:
                import re
                tz_match = re.search(r'[+-]\d{2}:?\d{2}$', sched)
                if tz_match or sched.endswith('Z'):
                    # Has timezone info - parse and convert
                    try:
                        normalized = sched.replace('Z', '+00:00')
                        m = re.search(r'([+-])(\d{2})(\d{2})$', normalized)
                        if m and ':' not in normalized[-6:]:
                            normalized = normalized[:-5] + m.group(1) + m.group(2) + ':' + m.group(3)
                        parsed = datetime.fromisoformat(normalized)
                        apt_dict['date'] = parsed.strftime('%Y-%m-%d')
                        apt_dict['time'] = parsed.strftime('%H:%M')
                    except:
                        apt_dict['date'] = sched[:10]
                        apt_dict['time'] = sched[11:16] if len(sched) > 11 else ''
                else:
                    # No timezone - treat as local
                    apt_dict['date'] = sched[:10]
                    if 'T' in sched or ' ' in sched:
                        time_part = sched.split('T')[-1].split(' ')[-1]
                        apt_dict['time'] = time_part[:5]
        
        # Handle datetime serialization
        if apt_dict.get('scheduled_at'):
            if hasattr(apt_dict['scheduled_at'], 'isoformat'):
                apt_dict['scheduled_at'] = apt_dict['scheduled_at'].isoformat()
        if apt_dict.get('created_at'):
            if hasattr(apt_dict['created_at'], 'isoformat'):
                apt_dict['created_at'] = apt_dict['created_at'].isoformat()
                
        appointments_list.append(apt_dict)
    
    return {"appointments": appointments_list, "count": len(appointments_list)}

class AppointmentAttendee(BaseModel):
    """Individual attendee for a multi-person appointment"""
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    relationship: Optional[str] = None  # spouse, child, parent, other

class AppointmentRequest(BaseModel):
    """Request to create an appointment"""
    title: str
    description: Optional[str] = None
    scheduled_at: str  # ISO datetime string
    duration_minutes: int = 60
    status: str = 'scheduled'
    appointment_type: str = 'in_person'  # in_person, video_call
    referral_code: Optional[str] = None  # Optional referral code
    quantity: int = 1  # Number of people attending
    attendees: Optional[List[AppointmentAttendee]] = None  # Attendee details
    service_id: Optional[str] = None
    payment_method_id: Optional[str] = None  # Optional: card to charge on attendance

@appointment_router.post('/admin/test-email')
async def test_email(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Test email sending with SendGrid"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    to_email = request.get('email')
    if not to_email:
        raise HTTPException(status_code=400, detail='email is required')
    
    # Load config from database
    config_doc = await _db.api_config.find_one({'_id': 'main'})
    if not config_doc:
        raise HTTPException(status_code=500, detail='API configuration not found')
    
    # Check SendGrid config
    if not config_doc.get('sendgrid_api_key'):
        raise HTTPException(status_code=500, detail='SendGrid API Key not configured')
    
    # Initialize notification service
    from notification_service import NotificationService
    notification_service = NotificationService(config_doc)
    
    # Send test email
    from datetime import datetime, timezone, timedelta
    test_date = datetime.now(timezone.utc) + timedelta(days=1)
    
    result = await notification_service.send_appointment_confirmation_email(
        to_email=to_email,
        user_name='Usuario de Prueba',
        appointment_date=test_date,
        appointment_type='Consulta de Prueba'
    )
    
    if result:
        return {
            'success': True,
            'message': f'Email de prueba enviado exitosamente a {to_email}'
        }
    else:
        raise HTTPException(status_code=500, detail='Failed to send email. Check SendGrid configuration.')


@appointment_router.post('/admin/test-sms')
async def test_sms(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Test SMS sending with Twilio"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    phone_number = request.get('phone_number')
    if not phone_number:
        raise HTTPException(status_code=400, detail='phone_number is required')
    
    # Load config from database
    config_doc = await _db.api_config.find_one({'_id': 'main'})
    if not config_doc:
        raise HTTPException(status_code=500, detail='API configuration not found')
    
    # Initialize notification service
    from notification_service import NotificationService
    notification_service = NotificationService(config_doc)
    
    # Send test SMS
    from datetime import datetime, timezone, timedelta
    test_date = datetime.now(timezone.utc) + timedelta(days=1)
    
    result = await notification_service.send_appointment_confirmation_sms(
        to_phone=phone_number,
        user_name='Usuario de Prueba',
        appointment_date=test_date,
        appointment_type='Consulta de Prueba'
    )
    
    if result:
        return {
            'success': True,
            'message': f'SMS de prueba enviado exitosamente a {phone_number}'
        }
    else:
        raise HTTPException(status_code=500, detail='Failed to send SMS. Check Twilio configuration.')


# Helper function to check for appointment time slot conflicts
async def check_appointment_conflict(scheduled_at, exclude_appointment_id: str = None, duration_minutes: int = 60):
    """
    Check if there's any existing appointment that conflicts with the requested time slot.
    Returns the conflicting appointment if found, None otherwise.
    """
    import pytz
    texas_tz = pytz.timezone('America/Chicago')
    
    # Normalize the scheduled_at to a datetime object
    if isinstance(scheduled_at, str):
        # Handle ISO format string like "2026-02-17T13:30:00-06:00"
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
        except:
            scheduled_dt = datetime.now(texas_tz)
    else:
        scheduled_dt = scheduled_at
    
    # Extract date and time for comparison
    if scheduled_dt.tzinfo:
        local_dt = scheduled_dt.astimezone(texas_tz)
    else:
        local_dt = texas_tz.localize(scheduled_dt)
    
    date_str = local_dt.strftime('%Y-%m-%d')
    time_str = local_dt.strftime('%H:%M')
    
    # Build query to find conflicts
    # Check for appointments on the same date and overlapping time
    query = {
        'status': {'$ne': 'cancelled'},
        '$or': [
            # Match by scheduled_at string format (ISO)
            {'scheduled_at': {'$regex': f'^{date_str}T{time_str}'}},
            # Match by date + time fields
            {'date': date_str, 'time': time_str},
            # Match by date string and time
            {'date': {'$regex': f'^{date_str}'}, 'time': time_str},
        ]
    }
    
    # Exclude the current appointment if updating
    if exclude_appointment_id:
        query['_id'] = {'$ne': exclude_appointment_id}
    
    conflict = await _db.appointments.find_one(query)
    return conflict


@appointment_router.post('/appointments', response_model=Appointment)
async def create_appointment(request: AppointmentRequest, current_user: dict = Depends(_auth_user)):
    # Parse the scheduled datetime
    scheduled_dt = datetime.fromisoformat(request.scheduled_at.replace('Z', '+00:00'))
    
    # Enforce minimum advance booking time from booking rules
    booking_rules = await _db.booking_rules.find_one({}) or {}
    min_advance_hours = booking_rules.get('min_advance_hours', 24)
    allow_same_day = booking_rules.get('allow_same_day_booking', False)
    
    now_utc = datetime.now(timezone.utc)
    if scheduled_dt.tzinfo is None:
        scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
    
    hours_until_appointment = (scheduled_dt - now_utc).total_seconds() / 3600
    
    if hours_until_appointment < min_advance_hours:
        raise HTTPException(
            status_code=400,
            detail=f'Las citas deben agendarse con al menos {min_advance_hours} horas de anticipación. '
                   f'Por favor selecciona una fecha/hora posterior.'
        )
    
    if not allow_same_day and scheduled_dt.date() == now_utc.date():
        raise HTTPException(
            status_code=400,
            detail='No se permiten citas para el mismo día. Por favor selecciona una fecha futura.'
        )
    
    # Check for GLOBAL time slot conflict (any appointment at this time)
    conflict = await check_appointment_conflict(scheduled_dt, duration_minutes=request.duration_minutes)
    if conflict:
        conflict_name = conflict.get('user_name') or conflict.get('client_name', 'otro cliente')
        raise HTTPException(
            status_code=409,  # 409 Conflict
            detail=f'Este horario ya está ocupado por una cita con {conflict_name}. Por favor elige otro horario.'
        )
    
    # Check if user already has an appointment at the same date and time
    # Use string comparison for user_id to support both UUID and ObjectId formats
    existing_appointment = await _db.appointments.find_one({
        'user_id': str(current_user['id']),
        'scheduled_at': scheduled_dt,
        'status': {'$ne': 'cancelled'}  # Exclude cancelled appointments
    })
    
    if existing_appointment:
        raise HTTPException(
            status_code=400, 
            detail='Ya tienes una cita programada para este día y hora. Por favor elige otro horario.'
        )
    
    # Generate appointment ID first
    appointment_id_temp = str(uuid.uuid4())
    
    # Generate video call room if needed
    video_call_room_id = None
    meeting_link = None
    
    if request.appointment_type == 'video_call':
        # Generate unique room ID for Jitsi
        video_call_room_id = f"ross-tax-{appointment_id_temp[:8]}"
        # Jitsi Meet URL format
        meeting_link = f"https://meet.jit.si/{video_call_room_id}"
    
    appointment = Appointment(
        id=appointment_id_temp,
        user_id=str(current_user['id']),
        title=request.title,
        description=request.description,
        scheduled_at=scheduled_dt,
        duration_minutes=request.duration_minutes,
        status=request.status,
        appointment_type=request.appointment_type,
        video_call_room_id=video_call_room_id,
        meeting_link=meeting_link
    )
    
    # Add management token for self-service appointment management
    appointment_dict = appointment.dict()
    appointment_dict['management_token'] = secrets.token_urlsafe(32)
    
    # Add fields used by admin calendar view
    appointment_dict['user_name'] = current_user.get('name', 'Usuario')
    appointment_dict['user_email'] = current_user.get('email', '')
    appointment_dict['user_phone'] = current_user.get('phone', '')
    appointment_dict['date'] = scheduled_dt.strftime('%Y-%m-%d')
    appointment_dict['time'] = scheduled_dt.strftime('%H:%M')
    appointment_dict['service_name'] = request.title
    appointment_dict['created_at'] = datetime.now(timezone.utc)
    appointment_dict['source'] = 'mobile_app'
    
    # Multi-person appointment support
    appointment_dict['quantity'] = request.quantity or 1
    appointment_dict['attendees'] = []
    if request.attendees:
        for att in request.attendees:
            appointment_dict['attendees'].append(att.dict())
    elif request.quantity and request.quantity >= 1:
        # Default: add the booking user as first attendee
        appointment_dict['attendees'].append({
            'name': current_user.get('name', 'Usuario'),
            'phone': current_user.get('phone', ''),
            'email': current_user.get('email', ''),
            'relationship': 'self'
        })
    if request.service_id:
        appointment_dict['service_id'] = request.service_id
    
    # Save payment method for charge-on-attendance flow
    if request.payment_method_id:
        appointment_dict['payment_method_id'] = request.payment_method_id
        # Look up card details
        try:
            pm = None
            if ObjectId.is_valid(request.payment_method_id):
                pm = await _db.payment_methods.find_one({'_id': ObjectId(request.payment_method_id), 'active': {'$ne': False}})
            if not pm:
                pm = await _db.payment_methods.find_one({'nmi_vault_id': request.payment_method_id, 'active': {'$ne': False}})
            if pm:
                appointment_dict['payment_method_details'] = {
                    'card_brand': pm.get('card_brand', ''),
                    'last_4': pm.get('last_4', '****'),
                    'type': pm.get('type', 'card'),
                }
        except Exception as pm_err:
            logging.warning(f"Could not fetch payment method details: {pm_err}")
    
    result = await _db.appointments.insert_one(appointment_dict)
    
    # Tag with active tax season
    try:
        from season_context import get_season_year
        tax_year = await get_season_year()
        await _db.appointments.update_one({'_id': result.inserted_id}, {'$set': {'tax_year': tax_year}})
    except Exception:
        pass

    # Sync with Google Calendar if connected
    try:
        google_tokens = await _db.google_calendar_tokens.find_one({})
        if google_tokens and google_tokens.get('access_token'):
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                creds = Credentials(
                    token=google_tokens['access_token'],
                    refresh_token=google_tokens.get('refresh_token'),
                    token_uri='https://oauth2.googleapis.com/token',
                    client_id=config_doc.get('google_client_id'),
                    client_secret=config_doc.get('google_client_secret')
                )
                
                service = build('calendar', 'v3', credentials=creds)
                calendar_id = google_tokens.get('calendar_id', 'primary')
                
                # Create event in Google Calendar
                event = {
                    'summary': f"{current_user.get('name', 'Cliente')} - {request.title}",
                    'description': request.description or '',
                    'start': {
                        'dateTime': scheduled_dt.isoformat(),
                        'timeZone': 'America/Chicago',
                    },
                    'end': {
                        'dateTime': (scheduled_dt + timedelta(minutes=request.duration_minutes)).isoformat(),
                        'timeZone': 'America/Chicago',
                    },
                }
                
                created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
                
                # Save Google Calendar event ID
                await _db.appointments.update_one(
                    {'_id': result.inserted_id},
                    {'$set': {'google_calendar_event_id': created_event.get('id')}}
                )
                logging.info(f"✅ Appointment synced to Google Calendar: {created_event.get('id')}")
    except Exception as e:
        logging.error(f"❌ Error syncing to Google Calendar: {e}")
        # Don't fail appointment creation if Google sync fails
    
    # Handle referral code if present
    referral_code = getattr(request, 'referral_code', None)
    if referral_code and referral_service:
        try:
            logging.info(f"🎁 Processing referral code {referral_code} for appointment {appointment.id}")
            
            # Create referral relationship
            referral = await referral_service.create_referral_from_appointment(
                referral_code=referral_code,
                name=current_user.get('name', 'Usuario'),
                email=current_user.get('email', ''),
                phone=current_user.get('phone', ''),
                appointment_id=appointment.id
            )
            
            if referral:
                logging.info(f"✅ Referral created successfully for appointment {appointment.id}")
                
                # Send notification to referrer
                try:
                    referrer_user = await _db.users.find_one({'_id': referral['referrer_user_id']})
                    if referrer_user:
                        await create_notification(
                            user_id=referral['referrer_user_id'],
                            title='🎉 ¡Nuevo Referido!',
                            body=f'{current_user["name"]} agendó una cita usando tu código de referido',
                            type='referral',
                            data={
                                'referral_id': str(referral['_id']),
                                'referred_name': current_user['name']
                            }
                        )
                except Exception as e:
                    logging.error(f"Error sending referral notification: {e}")
            else:
                logging.warning(f"⚠️ Failed to create referral for code {referral_code}")
        except Exception as e:
            logging.error(f"❌ Error processing referral code: {e}")
            # Don't fail appointment creation if referral fails
    
    # Create in-app notification and send email/SMS
    try:
        formatted_date = scheduled_dt.strftime('%d/%m/%Y %H:%M')
        
        if request.appointment_type == 'video_call':
            notification_body = f'Tu videollamada "{request.title}" ha sido agendada para el {formatted_date}. Abre la app para gestionar tu cita.'
        else:
            notification_body = f'Tu cita "{request.title}" ha sido agendada para el {formatted_date}. Abre la app para gestionar tu cita.'
            
        if referral_code:
            notification_body += '. ¡Recibirás $5 de descuento!'
        
        notification_data = {
            'appointment_id': appointment.id,
            'scheduled_at': request.scheduled_at,
            'title': request.title,
            'appointment_type': request.appointment_type,
            'action': 'view_appointment',
            'screen': 'appointments'
        }
        
        if meeting_link:
            notification_data['meeting_link'] = meeting_link
        
        # Create in-app notification
        await create_notification(
            user_id=current_user['id'],
            title='✅ Cita Agendada' if request.appointment_type == 'in_person' else '📹 Videollamada Agendada',
            body=notification_body,
            type='appointments',
            data=notification_data
        )
        
        # Send Email and SMS confirmations using global instance
        try:
            if _notification_service:
                # Prepare appointment type text
                appointment_type_text = 'Videollamada' if request.appointment_type == 'video_call' else 'Cita Presencial'
                
                # Send Email
                if current_user.get('email') and _notification_service.sendgrid_client:
                    try:
                        email_sent = await _notification_service.send_appointment_confirmation_email(
                            to_email=current_user['email'],
                            user_name=current_user.get('name', 'Usuario'),
                            appointment_date=scheduled_dt,
                            appointment_type=appointment_type_text,
                            description=f"{request.title}. {request.description or ''}",
                            meeting_link=meeting_link
                        )
                        if email_sent:
                            logging.info(f"✅ Email confirmation sent to {current_user['email']}")
                        else:
                            logging.warning(f"⚠️ Failed to send email to {current_user['email']}")
                    except Exception as e:
                        logging.error(f"❌ Error sending email: {e}")
                
                # Send SMS
                if current_user.get('phone') and _notification_service.twilio_client:
                    try:
                        sms_sent = await _notification_service.send_appointment_confirmation_sms(
                            to_phone=current_user['phone'],
                            user_name=current_user.get('name', 'Usuario'),
                            appointment_date=scheduled_dt,
                            appointment_type=appointment_type_text
                        )
                        if sms_sent:
                            logging.info(f"✅ SMS confirmation sent to {current_user['phone']}")
                        else:
                            logging.warning(f"⚠️ Failed to send SMS to {current_user['phone']}")
                    except Exception as e:
                        logging.error(f"❌ Error sending SMS: {e}")
            else:
                logging.warning("⚠️ Notification service not initialized, skipping email/SMS")
        except Exception as e:
            logging.error(f"❌ Error sending email/SMS confirmations: {e}")
            # Don't fail appointment creation if notifications fail
        
        # Send SMS to additional attendees (for multi-person appointments)
        try:
            if _notification_service and _notification_service.twilio_client and request.attendees:
                appointment_type_text = 'Videollamada' if request.appointment_type == 'video_call' else 'Cita Presencial'
                
                for attendee in request.attendees:
                    # Skip the main user (already notified)
                    attendee_phone = attendee.phone if hasattr(attendee, 'phone') else attendee.get('phone')
                    attendee_name = attendee.name if hasattr(attendee, 'name') else attendee.get('name', 'Invitado')
                    attendee_email = attendee.email if hasattr(attendee, 'email') else attendee.get('email')
                    
                    if not attendee_phone or attendee_phone == current_user.get('phone'):
                        continue
                    
                    try:
                        # Send SMS to attendee
                        sms_body = f"Hola {attendee_name}, {current_user.get('name', 'alguien')} te ha agregado a una cita en Ross Tax Preparation para el {formatted_date}. Tipo: {appointment_type_text}. Ubicación: 305 Bruce Ave, Dumas TX. Tel: (806) 934-2018"
                        sms_sent = await _notification_service.send_sms(
                            to_phone=attendee_phone,
                            message=sms_body
                        )
                        if sms_sent:
                            logging.info(f"✅ SMS sent to attendee {attendee_name} at {attendee_phone}")
                        else:
                            logging.warning(f"⚠️ Failed to send SMS to attendee {attendee_phone}")
                    except Exception as att_sms_err:
                        logging.error(f"❌ Error sending SMS to attendee {attendee_phone}: {att_sms_err}")
                    
                    # Send email to attendee if available
                    if attendee_email and _notification_service.sendgrid_client:
                        try:
                            email_sent = await _notification_service.send_appointment_confirmation_email(
                                to_email=attendee_email,
                                user_name=attendee_name,
                                appointment_date=scheduled_dt,
                                appointment_type=appointment_type_text,
                                description=f"{request.title}. Agendado por {current_user.get('name', 'Usuario')}.",
                                meeting_link=meeting_link
                            )
                            if email_sent:
                                logging.info(f"✅ Email sent to attendee {attendee_name} at {attendee_email}")
                        except Exception as att_email_err:
                            logging.error(f"❌ Error sending email to attendee: {att_email_err}")
        except Exception as att_notif_err:
            logging.error(f"❌ Error sending notifications to attendees: {att_notif_err}")
            
    except Exception as e:
        logging.error(f"Error creating appointment notification: {str(e)}")
    
    # Send notifications to all admins
    try:
        admin_users = await _db.users.find({'role': 'admin'}).to_list(None)
        for admin in admin_users:
            admin_notification_body = f'Nuevo cliente: {current_user.get("name", "Usuario")} agendó una cita "{request.title}" para el {formatted_date}'
            
            # 1. Push Notification
            if admin.get('expo_push_token'):
                try:
                    from push_notification_service import send_push_notification
                    await send_push_notification(
                        user_id=str(admin.get('_id')),
                        title='📅 Nueva Cita Agendada',
                        body=admin_notification_body,
                        data={
                            'type': 'new_appointment',
                            'appointment_id': appointment.id,
                            'client_name': current_user.get('name', 'Usuario'),
                            'scheduled_at': request.scheduled_at
                        }
                    )
                    logging.info(f"✅ Push notification sent to admin {admin.get('email')}")
                except Exception as push_error:
                    logging.error(f"❌ Error sending push notification to admin: {str(push_error)}")
            
            # 2. SMS Notification
            if admin.get('phone') and _notification_service and _notification_service.twilio_client:
                try:
                    sms_body = f"Ross Tax: Nueva cita agendada por {current_user.get('name', 'Usuario')} - {request.title} el {formatted_date}"
                    sms_sent = await _notification_service.send_sms(
                        to_phone=admin['phone'],
                        message=sms_body
                    )
                    if sms_sent:
                        logging.info(f"✅ SMS sent to admin {admin.get('email')} at {admin['phone']}")
                    else:
                        logging.warning(f"⚠️ Failed to send SMS to admin {admin.get('email')}")
                except Exception as sms_error:
                    logging.error(f"❌ Error sending SMS to admin: {str(sms_error)}")
            
            # 3. Email Notification
            if admin.get('email') and _notification_service and _notification_service.sendgrid_client:
                try:
                    email_subject = f"Nueva Cita Agendada - {current_user.get('name', 'Usuario')}"
                    email_body = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6C1110;">📅 Nueva Cita Agendada</h2>
                        <p><strong>Cliente:</strong> {current_user.get('name', 'Usuario')}</p>
                        <p><strong>Email:</strong> {current_user.get('email', 'N/A')}</p>
                        <p><strong>Teléfono:</strong> {current_user.get('phone', 'N/A')}</p>
                        <hr>
                        <p><strong>Título:</strong> {request.title}</p>
                        <p><strong>Descripción:</strong> {request.description or 'Sin descripción'}</p>
                        <p><strong>Fecha:</strong> {formatted_date}</p>
                        <p><strong>Duración:</strong> {request.duration_minutes} minutos</p>
                        <p><strong>Tipo:</strong> {'Videollamada' if request.appointment_type == 'video_call' else 'Presencial'}</p>
                        {f'<p><strong>Link de reunión:</strong> <a href="{meeting_link}">{meeting_link}</a></p>' if meeting_link else ''}
                        <hr>
                        <p style="color: #666; font-size: 12px;">Este es un mensaje automático de Ross Tax Preparation.</p>
                    </div>
                    """
                    email_sent = await _notification_service.send_email(
                        to_email=admin['email'],
                        subject=email_subject,
                        html_content=email_body
                    )
                    if email_sent:
                        logging.info(f"✅ Email sent to admin {admin['email']}")
                    else:
                        logging.warning(f"⚠️ Failed to send email to admin {admin['email']}")
                except Exception as email_error:
                    logging.error(f"❌ Error sending email to admin: {str(email_error)}")
        
        logging.info(f"✅ Admin notifications sent for appointment {appointment.id}")
    except Exception as notif_error:
        logging.error(f"❌ Error sending admin notifications: {str(notif_error)}")
    
    # Send WhatsApp confirmation
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        if wa_automation and current_user.get('phone'):
            # Store appointment with user phone for WhatsApp
            await _db.appointments.update_one(
                {'id': appointment.id},
                {'$set': {
                    'date': scheduled_dt,
                    'service_type': request.title,
                    'client_id': current_user['id']
                }}
            )
            # Send WhatsApp confirmation
            wa_result = await wa_automation.send_appointment_confirmation(appointment.id)
            if wa_result.get('success'):
                logging.info(f"✅ WhatsApp confirmation sent for appointment {appointment.id}")
            else:
                logging.warning(f"⚠️ WhatsApp confirmation failed: {wa_result.get('error')}")
    except Exception as wa_error:
        logging.error(f"❌ Error sending WhatsApp confirmation: {str(wa_error)}")
    
    # Sync to Google Calendar
    try:
        await sync_appointment_to_calendar(appointment.id, 'create')
    except Exception as e:
        logging.error(f"Error syncing appointment to calendar: {str(e)}")
    
    # Sync to Rise CRM (via API - may fail due to CAPTCHA)
    try:
        from rise_crm_sync_service import rise_sync_service
        if rise_sync_service and os.getenv('RISE_CRM_SYNC_ENABLED', 'true').lower() == 'true':
            logging.info(f"📅 Auto-syncing appointment {appointment.id} to Rise CRM...")
            sync_result = await rise_sync_service.sync_appointment_to_rise(appointment.id)
            if sync_result.get('success'):
                logging.info(f"✅ Appointment auto-synced to Rise CRM: {sync_result.get('rise_crm_id')}")
            else:
                logging.warning(f"⚠️ Failed to auto-sync appointment to Rise CRM: {sync_result.get('error')}")
    except Exception as e:
        logging.error(f"❌ Error auto-syncing appointment to Rise CRM: {str(e)}")
    
    # Sync to Zapier (recommended method - bypasses CAPTCHA)
    zapier_webhook_url = os.getenv('ZAPIER_WEBHOOK_URL')
    if zapier_webhook_url:
        try:
            import httpx
            
            logging.info(f"📤 Auto-syncing appointment {appointment.id} to Zapier...")
            
            # Get user info
            user = await _db.users.find_one({'_id': appointment.user_id})
            if not user:
                user = await _db.users.find_one({'id': appointment.user_id})
            
            if user:
                # Format data for Zapier
                zapier_data = {
                    'appointment_id': appointment.id,
                    'user_email': user.get('email'),
                    'user_name': user.get('name'),
                    'user_phone': user.get('phone', ''),
                    'appointment_date': appointment.date,
                    'appointment_time': appointment.time,
                    'appointment_type': appointment.type or 'Tax Consultation',
                    'tax_year': appointment.tax_year or 2024,
                    'notes': appointment.notes or '',
                    'status': appointment.status,
                    'created_at': appointment.created_at.isoformat() if appointment.created_at else datetime.utcnow().isoformat(),
                    'project_title': f"Tax Return {appointment.tax_year or 2024} - {user.get('name')}",
                    'project_description': f"Appointment scheduled for {appointment.date} at {appointment.time}"
                }
                
                # Send to Zapier webhook
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        zapier_webhook_url,
                        json=zapier_data,
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if response.status_code in [200, 201, 202]:
                        logging.info(f"✅ Appointment auto-synced to Zapier successfully")
                        
                        # Log the webhook send
                        await _db.zapier_webhook_logs.insert_one({
                            'entity_type': 'appointment',
                            'entity_id': appointment.id,
                            'direction': 'rosstax_to_zapier',
                            'webhook_url': zapier_webhook_url,
                            'payload': zapier_data,
                            'response_status': response.status_code,
                            'response_body': response.text[:500],  # Limit to 500 chars
                            'sent_at': datetime.utcnow()
                        })
                    else:
                        logging.warning(f"⚠️ Zapier webhook returned {response.status_code}: {response.text[:200]}")
            else:
                logging.warning(f"⚠️ User not found for appointment {appointment.id}")
                
        except Exception as e:
            logging.error(f"❌ Error auto-syncing appointment to Zapier: {str(e)}")
    else:
        logging.debug("💡 Zapier webhook not configured. Set ZAPIER_WEBHOOK_URL in .env to enable auto-sync")
    
    return appointment


@appointment_router.get('/appointments/my', response_model=List[Appointment])
async def get_my_appointments(current_user: dict = Depends(_auth_user)):
    """Get all appointments for the current user"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id', ''))
        
        # Try multiple ID formats
        appointments = await _db.appointments.find({
            '$or': [
                {'user_id': user_id},
                {'user_id': str(user_id)},
                {'client_id': user_id},
                {'client_id': str(user_id)}
            ]
        }).sort('created_at', -1).to_list(100)
        
        # Format appointments for response
        result = []
        for a in appointments:
            try:
                # Ensure the 'id' field maps to the MongoDB _id if not set
                if 'id' not in a or not a.get('id'):
                    a['id'] = str(a['_id'])
                result.append(Appointment(**a))
            except Exception as e:
                # Handle missing fields
                logging.warning(f"Error parsing appointment: {e}")
                continue
        
        return result
    except Exception as e:
        logging.error(f"Error fetching user appointments: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching appointments")


# Alias endpoints for client dashboard
@appointment_router.get('/documents/my')
async def get_my_documents_alias(current_user: dict = Depends(_auth_user)):
    """Alias for /document-capture/my-documents"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id', ''))
        
        documents = await _db.documents.find({
            '$or': [
                {'user_id': user_id},
                {'user_id': str(user_id)},
                {'uploaded_by': user_id}
            ]
        }).sort('created_at', -1).to_list(100)
        
        result = []
        for doc in documents:
            result.append({
                'id': str(doc.get('_id', '')),
                'name': doc.get('name', doc.get('filename', 'Documento')),
                'filename': doc.get('filename', ''),
                'category': doc.get('category', 'other'),
                'status': doc.get('status', 'uploaded'),
                'created_at': doc.get('created_at'),
                'file_type': doc.get('file_type', doc.get('mime_type', '')),
                'size': doc.get('size', 0)
            })
        
        return result
    except Exception as e:
        logging.error(f"Error fetching user documents: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching documents")



# IMPORTANT: Specific routes MUST be defined before the parameterized /invoices/{invoice_id}
# Otherwise FastAPI treats "my-invoices", "my" as invoice_id values
@appointment_router.get('/invoices/my-invoices')
async def get_my_invoices_v2_priority(current_user: dict = Depends(_auth_user)):
    """Get user invoices - priority route before parameterized route"""
    return await get_my_invoices_alias(current_user)

@appointment_router.get('/invoices/my')
async def get_my_invoices_alias_priority(current_user: dict = Depends(_auth_user)):
    """Get user invoices (short alias) - priority route before parameterized route"""
    return await get_my_invoices_alias(current_user)


@appointment_router.get('/invoices/{invoice_id}')
async def get_invoice_detail(invoice_id: str, current_user: dict = Depends(_auth_user)):
    """Get a single invoice detail - accessible by the invoice owner or admin"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id', ''))
        is_admin = current_user.get('role') == 'admin'
        
        # Find the invoice
        invoice = None
        if ObjectId.is_valid(invoice_id):
            invoice = await _db.invoices.find_one({'_id': ObjectId(invoice_id)})
        if not invoice:
            invoice = await _db.invoices.find_one({'id': invoice_id})
        if not invoice:
            invoice = await _db.invoices.find_one({'invoice_number': invoice_id})
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
        
        # Check ownership (unless admin)
        if not is_admin:
            inv_user = invoice.get('user_id', invoice.get('client_id', ''))
            if str(inv_user) != str(user_id):
                raise HTTPException(status_code=403, detail="No autorizado para ver esta factura")
        
        # Serialize
        result = {
            'id': str(invoice.get('_id', invoice.get('id', ''))),
            'invoice_number': invoice.get('invoice_number', ''),
            'client_name': invoice.get('client_name', ''),
            'client_email': invoice.get('client_email', ''),
            'service_type': invoice.get('service_type', ''),
            'description': invoice.get('description', ''),
            'items': invoice.get('items', []),
            'subtotal': invoice.get('subtotal', 0),
            'tax': invoice.get('tax', 0),
            'total': invoice.get('total', invoice.get('amount', 0)),
            'amount': invoice.get('amount', invoice.get('total', 0)),
            'status': invoice.get('status', ''),
            'payment_method': invoice.get('payment_method', ''),
            'payment_id': invoice.get('payment_id', ''),
            'payment_processor': invoice.get('payment_processor', ''),
            'card_last4': invoice.get('card_last4', ''),
            'card_brand': invoice.get('card_brand', ''),
            'paid_at': invoice.get('paid_at').isoformat() if invoice.get('paid_at') else None,
            'created_at': invoice.get('created_at').isoformat() if invoice.get('created_at') else None,
            'due_date': invoice.get('due_date').isoformat() if invoice.get('due_date') else None,
            'order_number': invoice.get('order_number', ''),
            'service_order_id': invoice.get('service_order_id', ''),
        }
        
        return {'invoice': result}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching invoice detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@appointment_router.get('/invoices/my')
async def get_my_invoices_alias(current_user: dict = Depends(_auth_user)):
    """Alias for /invoices/my-invoices - includes both invoices and pending service orders"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id', ''))
        
        # Get traditional invoices (only visible to client)
        invoices = await _db.invoices.find({
            '$and': [
                {'$or': [
                    {'user_id': user_id},
                    {'user_id': str(user_id)},
                    {'client_id': user_id},
                    {'client_id': str(user_id)}
                ]},
                {'visible_to_client': {'$ne': False}}
            ]
        }).sort('created_at', -1).to_list(100)
        
        result = []
        for inv in invoices:
            result.append({
                'id': str(inv.get('_id', '')),
                'invoice_number': inv.get('invoice_number', ''),
                'status': inv.get('status', 'pending'),
                'total': inv.get('total', 0),
                'subtotal': inv.get('subtotal', 0),
                'tax': inv.get('tax', 0),
                'created_at': inv.get('created_at'),
                'due_date': inv.get('due_date'),
                'paid_at': inv.get('paid_at'),
                'items': inv.get('items', []),
                'notes': inv.get('notes', ''),
                'source': 'invoice'
            })
        
        # Also get service orders (both pending AND paid that don't have an invoice)
        service_orders = await _db.service_orders.find({
            '$and': [
                {'$or': [
                    {'client_id': user_id},
                    {'client_id': str(user_id)},
                    {'user_id': user_id},
                    {'user_id': str(user_id)}
                ]},
                {'$or': [
                    {'payment_status': {'$in': ['pending', 'pending_payment', 'paid']}},
                    {'status': 'pending_payment'},
                    {'status': 'pending'}
                ]},
                # Exclude orders that already have an invoice created
                {'invoice_id': {'$exists': False}}
            ]
        }).sort('created_at', -1).to_list(50)
        
        for order in service_orders:
            # Convert service order to invoice-like format
            result.append({
                'id': order.get('id') or str(order.get('_id', '')),
                'invoice_number': order.get('order_number', ''),
                'status': 'pending',  # Pending payment
                'total': order.get('price', 0) or order.get('total', 0),
                'subtotal': order.get('price', 0) or order.get('total', 0),
                'tax': 0,
                'created_at': order.get('created_at'),
                'due_date': order.get('created_at'),  # No specific due date
                'paid_at': None,
                'items': [{
                    'description': order.get('service_type', 'Servicio'),
                    'quantity': 1,
                    'unit_price': order.get('price', 0) or order.get('total', 0),
                    'total': order.get('price', 0) or order.get('total', 0)
                }],
                'notes': order.get('notes', ''),
                'source': 'service_order',
                'order_id': order.get('id') or str(order.get('_id', ''))
            })
        
        # Sort all by created_at
        result.sort(key=lambda x: x.get('created_at') or datetime.min, reverse=True)
        
        return result
    except Exception as e:
        logging.error(f"Error fetching user invoices: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching invoices")


@appointment_router.get('/invoices/my-invoices')
async def get_my_invoices_v2(current_user: dict = Depends(_auth_user)):
    """Get user invoices including pending service orders - v2 endpoint"""
    return await get_my_invoices_alias(current_user)


@appointment_router.delete('/appointments/{appointment_id}')
async def delete_appointment(appointment_id: str, current_user: dict = Depends(_auth_user)):
    """Cancel/delete an appointment (user can only cancel their own)"""
    try:
        # Find appointment - try both 'id' field and '_id' (ObjectId)
        appointment = await _db.appointments.find_one({'id': appointment_id})
        
        if not appointment:
            # Try with _id (ObjectId) - for appointments created by Tax Wizard
            try:
                from bson import ObjectId
                appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
            except Exception:
                pass
        
        if not appointment:
            # Also try _id as string
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        # Check authorization (user can only cancel their own, admin can cancel any)
        if appointment['user_id'] != current_user['id'] and current_user.get('role') not in ['admin', 'office_assistant']:
            raise HTTPException(status_code=403, detail='Not authorized to cancel this appointment')
        
        # Update status to cancelled - use the correct query key
        query_key = {'_id': appointment['_id']}
        result = await _db.appointments.update_one(
            query_key,
            {'$set': {'status': 'cancelled'}}
        )
        
        if result.modified_count > 0:
            # Send notification
            try:
                # Handle both datetime object and string
                scheduled_at = appointment['scheduled_at']
                if isinstance(scheduled_at, str):
                    date_obj = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                else:
                    date_obj = scheduled_at
                formatted_date = date_obj.strftime('%d/%m/%Y %H:%M')
                
                await create_notification(
                    user_id=appointment['user_id'],
                    title='❌ Cita Cancelada',
                    body=f'Tu cita "{appointment["title"]}" del {formatted_date} ha sido cancelada',
                    type='appointments',
                    data={
                        'appointment_id': appointment_id,
                        'action': 'cancelled'
                    }
                )
                
                # Send SMS cancellation notification
                try:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        # Get user info
                        user = await _db.users.find_one({'id': appointment['user_id']})
                        if not user:
                            user = await _db.users.find_one({'_id': appointment['user_id']})
                        
                        if user and user.get('phone') and notif_service.twilio_client:
                            sms_sent = await notif_service.send_appointment_cancellation_sms(
                                to_phone=user['phone'],
                                user_name=user.get('name', 'Usuario'),
                                appointment_title=appointment['title'],
                                appointment_date=date_obj
                            )
                            if sms_sent:
                                logging.info(f"✅ SMS cancellation sent to {user['phone']}")
                            else:
                                logging.warning(f"⚠️ Failed to send SMS to {user['phone']}")
                except Exception as e:
                    logging.error(f"❌ Error sending cancellation SMS: {e}")
                    
            except Exception as e:
                logging.error(f"Error creating cancellation notification: {str(e)}")
            
            return {'success': True, 'message': 'Appointment cancelled successfully'}
        else:
            raise HTTPException(status_code=500, detail='Failed to cancel appointment')
        
        # Offer the freed slot to other clients via WhatsApp
        try:
            await offer_freed_slot_to_clients(appointment)
        except Exception as offer_error:
            logging.error(f"Error offering freed slot: {offer_error}")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling appointment: {str(e)}")
        raise HTTPException(status_code=500, detail="Error cancelling appointment")


async def offer_freed_slot_to_clients(cancelled_appointment: dict):
    """
    When an appointment is cancelled, offer the freed slot to other clients
    who have appointments scheduled for later dates.
    """
    try:
        from whatsapp_service import WhatsAppService
        
        cancelled_time = cancelled_appointment.get('scheduled_at')
        if not cancelled_time:
            return
        
        # Get config for WhatsApp
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            config_doc = {
                'whatsapp_phone_number_id': os.getenv('WHATSAPP_PHONE_NUMBER_ID'),
                'whatsapp_access_token': os.getenv('WHATSAPP_ACCESS_TOKEN'),
            }
        
        wa_service = WhatsAppService(_db)
        if not wa_service.phone_number_id:
            logging.warning("WhatsApp not configured, skipping slot offer")
            return
        
        # Find clients with appointments AFTER this freed slot
        later_appointments = await _db.appointments.find({
            'scheduled_at': {'$gt': cancelled_time},
            'status': {'$in': ['scheduled', 'confirmed']},
            'client_phone': {'$exists': True, '$ne': None}
        }).sort('scheduled_at', 1).limit(5).to_list(5)
        
        if not later_appointments:
            logging.info("No later appointments found to offer freed slot")
            return
        
        # Format the freed slot
        if isinstance(cancelled_time, datetime):
            date_str = cancelled_time.strftime('%A %d de %B')
            time_str = cancelled_time.strftime('%I:%M %p')
        else:
            date_str = str(cancelled_time)
            time_str = ""
        
        # Send offer message to each client
        for apt in later_appointments:
            client_phone = apt.get('client_phone') or apt.get('phone_number')
            if not client_phone:
                continue
            
            client_name = apt.get('client_name', 'Cliente')
            
            offer_message = f"""🎉 *¡Oportunidad Disponible!*

Hola {client_name},

Se ha liberado un espacio más temprano para tu cita:

📅 *Nueva fecha disponible:* {date_str}
⏰ *Hora:* {time_str}
📍 305 Bruce Ave, Dumas, TX

¿Te gustaría adelantar tu cita a este horario?

Responde *SÍ ADELANTAR* para confirmar o ignora este mensaje para mantener tu cita actual.

_Ross Tax Preparation_"""
            
            try:
                await wa_service.send_message(client_phone, offer_message)
                logging.info(f"✅ Slot offer sent to {client_phone}")
                
                # Log the offer
                await _db.slot_offers.insert_one({
                    'original_appointment_id': str(cancelled_appointment.get('_id')),
                    'freed_slot': cancelled_time,
                    'offered_to_phone': client_phone,
                    'offered_to_name': client_name,
                    'current_appointment_id': str(apt.get('_id')),
                    'status': 'pending',
                    'created_at': datetime.now(timezone.utc)
                })
            except Exception as msg_error:
                logging.error(f"Error sending slot offer to {client_phone}: {msg_error}")
                
    except Exception as e:
        logging.error(f"Error in offer_freed_slot_to_clients: {e}")


@appointment_router.patch('/appointments/{appointment_id}/cancel')
async def cancel_appointment(appointment_id: str, current_user: dict = Depends(_auth_user)):
    """Cancel an appointment"""
    # Find appointment
    appointment = await _db.appointments.find_one({'id': appointment_id, 'user_id': current_user['id']})
    if not appointment:
        raise HTTPException(status_code=404, detail='Appointment not found')
    
    # Update status to cancelled
    await _db.appointments.update_one(
        {'id': appointment_id},
        {'$set': {'status': 'cancelled'}}
    )
    
    # Create notification for cancelled appointment
    try:
        scheduled_dt = appointment['scheduled_at']
        if isinstance(scheduled_dt, str):
            scheduled_dt = datetime.fromisoformat(scheduled_dt.replace('Z', '+00:00'))
        formatted_date = scheduled_dt.strftime('%d/%m/%Y %H:%M')
        
        await create_notification(
            user_id=current_user['id'],
            title='❌ Cita Cancelada',
            body=f'Tu cita "{appointment["title"]}" programada para el {formatted_date} ha sido cancelada',
            type='appointments',
            data={
                'appointment_id': appointment_id,
                'title': appointment["title"],
                'action': 'cancelled'
            }
        )
        
        # Send SMS cancellation notification
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                from notification_service import NotificationService
                notif_service = NotificationService(config_doc)
                
                if current_user.get('phone') and notif_service.twilio_client:
                    sms_sent = await notif_service.send_appointment_cancellation_sms(
                        to_phone=current_user['phone'],
                        user_name=current_user.get('name', 'Usuario'),
                        appointment_title=appointment['title'],
                        appointment_date=scheduled_dt
                    )
                    if sms_sent:
                        logging.info(f"✅ SMS cancellation sent to {current_user['phone']}")
                    else:
                        logging.warning(f"⚠️ Failed to send SMS to {current_user['phone']}")
        except Exception as e:
            logging.error(f"❌ Error sending cancellation SMS: {e}")
            
    except Exception as e:
        logging.error(f"Error creating cancellation notification: {str(e)}")
    
    # Sync cancellation to Google Calendar
    try:
        await sync_appointment_to_calendar(appointment_id, 'delete')
    except Exception as e:
        logging.error(f"Error syncing appointment cancellation to calendar: {str(e)}")
    
    # Sync cancellation to Rise CRM
    try:
        from rise_crm_sync_service import rise_sync_service
        if rise_sync_service and os.getenv('RISE_CRM_SYNC_ENABLED', 'true').lower() == 'true':
            # Check if appointment has rise_crm_project_id
            rise_project_id = appointment.get('rise_crm_project_id')
            if rise_project_id:
                logging.info(f"📅 Syncing appointment cancellation to Rise CRM project {rise_project_id}...")
                # Update project status to 'cancelled' in Rise CRM
                from rise_crm_service import rise_crm_service
                if rise_crm_service:
                    result = await rise_crm_service.update_project(rise_project_id, {'status': 'cancelled'})
                    if result.get('success'):
                        logging.info(f"✅ Appointment cancellation synced to Rise CRM")
                    else:
                        logging.warning(f"⚠️ Failed to sync cancellation to Rise CRM: {result.get('error')}")
            else:
                logging.info(f"ℹ️ Appointment has no Rise CRM project ID, skipping sync")
    except Exception as e:
        logging.error(f"❌ Error syncing appointment cancellation to Rise CRM: {str(e)}")
    
    return {'status': 'success', 'message': 'Appointment cancelled successfully'}

@appointment_router.patch('/appointments/{appointment_id}/reschedule')
async def reschedule_appointment(
    appointment_id: str,
    request: AppointmentRequest,
    current_user: dict = Depends(_auth_user)
):
    """Reschedule an appointment"""
    # Find appointment
    appointment = await _db.appointments.find_one({'id': appointment_id, 'user_id': current_user['id']})
    if not appointment:
        raise HTTPException(status_code=404, detail='Appointment not found')
    
    # Parse the new scheduled datetime
    new_scheduled_dt = datetime.fromisoformat(request.scheduled_at.replace('Z', '+00:00'))
    
    # Check if user already has another appointment at the new date and time
    existing_appointment = await _db.appointments.find_one({
        'user_id': current_user['id'],
        'scheduled_at': new_scheduled_dt,
        'status': {'$ne': 'cancelled'},
        'id': {'$ne': appointment_id}  # Exclude current appointment
    })
    
    if existing_appointment:
        raise HTTPException(
            status_code=400, 
            detail='Ya tienes una cita programada para este día y hora. Por favor elige otro horario.'
        )
    
    # Update appointment details
    await _db.appointments.update_one(
        {'id': appointment_id},
        {'$set': {
            'title': request.title,
            'description': request.description,
            'scheduled_at': new_scheduled_dt,
            'duration_minutes': request.duration_minutes,
            'status': request.status
        }}
    )
    
    # Create notification for rescheduled appointment
    try:
        formatted_date = new_scheduled_dt.strftime('%d/%m/%Y %H:%M')
        await create_notification(
            user_id=current_user['id'],
            title='🔄 Cita Reprogramada',
            body=f'Tu cita "{request.title}" ha sido reprogramada para el {formatted_date}',
            type='appointments',
            data={
                'appointment_id': appointment_id,
                'scheduled_at': request.scheduled_at,
                'title': request.title,
                'action': 'rescheduled'
            }
        )
    except Exception as e:
        logging.error(f"Error creating reschedule notification: {str(e)}")
    
    # Sync reschedule to Google Calendar (delete old, create new)
    try:
        # First delete the old event
        await sync_appointment_to_calendar(appointment_id, 'delete')
        # Then create the new event with updated details
        await sync_appointment_to_calendar(appointment_id, 'create')
    except Exception as e:
        logging.error(f"Error syncing appointment reschedule to calendar: {str(e)}")
    
    # Get updated appointment
    updated_appointment = await _db.appointments.find_one({'id': appointment_id})
    return Appointment(**updated_appointment)



# ================== AVAILABILITY ROUTES ==================

@appointment_router.get('/admin/availability/config', response_model=AvailabilityConfig)
async def get_availability_config(current_user: dict = Depends(_require_admin)):
    """Get availability configuration for admin"""
    config = await _db.availability_configs.find_one({'admin_id': current_user['id']})
    if not config:
        # Return default configuration
        default_config = AvailabilityConfig(
            admin_id=current_user['id'],
            slot_duration_minutes=30,
            buffer_time_minutes=0,
            max_advance_days=60,
            weekly_schedule=[
                DayAvailability(
                    day="monday",
                    enabled=True,
                    slots=[AvailabilitySlot(start_time="09:00", end_time="17:00")]
                ),
                DayAvailability(
                    day="tuesday",
                    enabled=True,
                    slots=[AvailabilitySlot(start_time="09:00", end_time="17:00")]
                ),
                DayAvailability(
                    day="wednesday",
                    enabled=True,
                    slots=[AvailabilitySlot(start_time="09:00", end_time="17:00")]
                ),
                DayAvailability(
                    day="thursday",
                    enabled=True,
                    slots=[AvailabilitySlot(start_time="09:00", end_time="17:00")]
                ),
                DayAvailability(
                    day="friday",
                    enabled=True,
                    slots=[AvailabilitySlot(start_time="09:00", end_time="17:00")]
                ),
                DayAvailability(day="saturday", enabled=False, slots=[]),
                DayAvailability(day="sunday", enabled=False, slots=[]),
            ],
            blocked_dates=[],
            google_calendar_connected=False
        )
        await _db.availability_configs.insert_one(default_config.dict())
        return default_config
    return AvailabilityConfig(**config)

@appointment_router.post('/admin/availability/config', response_model=AvailabilityConfig)
async def update_availability_config(
    config_request: AvailabilityConfigRequest,
    current_user: dict = Depends(_require_admin)
):
    """Update availability configuration"""
    existing_config = await _db.availability_configs.find_one({'admin_id': current_user['id']})
    
    if existing_config:
        # Update existing
        update_data = config_request.dict()
        update_data['updated_at'] = datetime.now(timezone.utc)
        await _db.availability_configs.update_one(
            {'admin_id': current_user['id']},
            {'$set': update_data}
        )
        updated_config = await _db.availability_configs.find_one({'admin_id': current_user['id']})
        return AvailabilityConfig(**updated_config)
    else:
        # Create new
        new_config = AvailabilityConfig(
            admin_id=current_user['id'],
            **config_request.dict()
        )
        await _db.availability_configs.insert_one(new_config.dict())
        return new_config

@appointment_router.get('/availability/slots', response_model=List[AvailableSlotResponse])
async def get_available_slots(
    date: str,  # ISO date string (YYYY-MM-DD)
    current_user: dict = Depends(_auth_user)
):
    """Get available time slots for a specific date based on office hours"""
    try:
        target_date = datetime.fromisoformat(date).date()
        
        # Check if date is in the past
        today = datetime.now(timezone.utc).date()
        if target_date < today:
            return []
        
        # Check max advance days (default 60 days)
        max_advance_days = 60
        days_diff = (target_date - today).days
        if days_diff > max_advance_days:
            return []
        
        # Get day of week
        day_name = target_date.strftime('%A').lower()
        
        # 1. First check manual override (only if active)
        manual_override = await _db.office_hours.find_one({"type": "manual_override"})
        if manual_override and manual_override.get("active", False) and not manual_override.get("is_open", True):
            return []  # Office is manually closed
        
        # 2. Check special hours for this date
        special_hours = await _db.office_hours.find_one({
            "type": "special_hours",
            "date": date
        })
        
        if special_hours:
            if not special_hours.get("is_open", False):
                return []  # Closed for this special day
            # Use special hours if available
            open_time = special_hours.get("open_time")
            close_time = special_hours.get("close_time")
        else:
            # 3. Get regular office schedule
            schedule = await _db.office_hours.find_one({"type": "weekly_schedule"})
            
            if not schedule:
                # Fallback to availability_configs if no office hours set
                config = await _db.availability_configs.find_one()
                if not config:
                    return []
                
                config_obj = AvailabilityConfig(**config)
                
                day_availability = next(
                    (d for d in config_obj.weekly_schedule if d.day == day_name),
                    None
                )
                
                if not day_availability or not day_availability.enabled:
                    return []
                
                # Use first slot's hours
                if day_availability.slots:
                    open_time = day_availability.slots[0].start_time
                    close_time = day_availability.slots[0].end_time
                else:
                    return []
            else:
                day_schedule = schedule.get("schedule", {}).get(day_name, {})
                
                if not day_schedule.get("is_open", False):
                    return []  # Office closed this day
                
                open_time = day_schedule.get("open_time")
                close_time = day_schedule.get("close_time")
        
        if not open_time or not close_time:
            return []
        
        # Generate time slots (30-minute intervals)
        slot_duration = 30  # minutes
        buffer_time = 0  # minutes between slots
        
        start_hour, start_min = map(int, open_time.split(':'))
        end_hour, end_min = map(int, close_time.split(':'))
        
        current_time = datetime.combine(target_date, datetime.min.time()).replace(
            hour=start_hour, minute=start_min
        )
        end_time = datetime.combine(target_date, datetime.min.time()).replace(
            hour=end_hour, minute=end_min
        )
        
        available_slots = []
        
        # Get booking rules for min_advance_hours filtering
        booking_rules = await _db.booking_rules.find_one({}) or {}
        min_advance_hours = booking_rules.get('min_advance_hours', 24)
        now_utc = datetime.now(timezone.utc)
        min_booking_time = now_utc + timedelta(hours=min_advance_hours)
        
        while current_time < end_time:
            slot_end = current_time + timedelta(minutes=slot_duration)
            
            # Skip if slot extends past closing time
            if slot_end > end_time:
                break
            
            # Make slot timezone-aware for comparison
            slot_dt_aware = current_time.replace(tzinfo=timezone.utc) if current_time.tzinfo is None else current_time
            
            # Skip slots that don't meet minimum advance booking time
            if slot_dt_aware < min_booking_time:
                current_time = slot_end + timedelta(minutes=buffer_time)
                continue
            
            # Check if slot is already booked
            # Search by date AND time fields since appointments store them separately
            slot_time_str = current_time.strftime('%H:%M')
            
            existing_appointment = await _db.appointments.find_one({
                '$or': [
                    # Match by date string and time string (most common format)
                    {
                        'date': date,
                        'time': slot_time_str,
                        'status': {'$nin': ['cancelled', 'rejected', 'no_show']}
                    },
                    # Also check scheduled_at for datetime format
                    {
                        'scheduled_at': {
                            '$gte': current_time,
                            '$lt': slot_end
                        },
                        'status': {'$nin': ['cancelled', 'rejected', 'no_show']}
                    }
                ]
            })
            
            available_slots.append(AvailableSlotResponse(
                date=date,
                time=slot_time_str,
                datetime=current_time.isoformat(),
                available=existing_appointment is None
            ))
            
            current_time = slot_end + timedelta(minutes=buffer_time)
        
        return available_slots
        
    except Exception as e:
        logging.error(f'Error getting available slots: {str(e)}')
        raise HTTPException(status_code=400, detail=str(e))


# ================== LOCAL AVAILABILITY SYSTEM (NO SQUARE) ==================
# Sistema cerrado que usa SOLO horarios configurados localmente

async def get_local_office_hours(date_str: str) -> dict:
    """
    Get office hours for a specific date - checks tax season mode
    Returns: {"is_open": bool, "open_time": str, "close_time": str}
    """
    from datetime import datetime
    
    target_date = datetime.fromisoformat(date_str).date()
    day_name = target_date.strftime('%A').lower()
    month_day = target_date.strftime('%m-%d')
    
    # Check for tax season config
    tax_config = await _db.office_hours.find_one({"type": "tax_season_config"})
    
    is_tax_season = False
    if tax_config:
        # Only use tax season if manually enabled - NO auto-detect
        is_tax_season = tax_config.get("is_tax_season", False)
    
    # 1. Check manual override first
    manual_override = await _db.office_hours.find_one({"type": "manual_override"})
    if manual_override and manual_override.get("active", False):
        if not manual_override.get("is_open", True):
            return {"is_open": False, "open_time": None, "close_time": None, "reason": manual_override.get("reason", "Cerrado manualmente")}
    
    # 2. Check special days (holidays, closures)
    special_day = await _db.office_hours.find_one({
        "type": "special_day",
        "date": date_str
    })
    
    if special_day:
        return {
            "is_open": special_day.get("is_open", False),
            "open_time": special_day.get("open_time"),
            "close_time": special_day.get("close_time"),
            "reason": special_day.get("reason", "Día especial")
        }
    
    # 3. Use tax season schedule or regular schedule
    if is_tax_season and tax_config and tax_config.get("tax_season_schedule"):
        schedule = tax_config.get("tax_season_schedule", {})
        day_hours = schedule.get(day_name, {})
        logging.info(f"📅 Using TAX SEASON schedule for {day_name}: {day_hours}")
    else:
        regular_schedule = await _db.office_hours.find_one({"type": "weekly_schedule"})
        if not regular_schedule:
            logging.warning(f"📅 No weekly_schedule found!")
            return {"is_open": False, "open_time": None, "close_time": None, "reason": "Horarios no configurados"}
        day_hours = regular_schedule.get("schedule", {}).get(day_name, {})
        logging.info(f"📅 Using REGULAR schedule for {day_name}: {day_hours}")
    
    result = {
        "is_open": day_hours.get("is_open", False),
        "open_time": day_hours.get("open_time"),
        "close_time": day_hours.get("close_time"),
        "is_tax_season": is_tax_season
    }
    logging.info(f"📅 get_local_office_hours returning: {result}")
    return result


@appointment_router.get('/local/availability/{date}')
async def get_local_availability(date: str):
    """
    Get available time slots using LOCAL system only (NO SQUARE)
    This is the primary availability endpoint for the closed system.
    
    Returns slots based on:
    1. Calendar global toggle (accepting_appointments)
    2. Blocked days
    3. Office hours configuration
    4. Tax season mode (extended Sunday hours)
    5. Blocked specific slots
    6. Existing appointments in MongoDB
    """
    try:
        target_date = datetime.fromisoformat(date).date()
        
        # Check if date is in the past
        today = datetime.now(timezone.utc).date()
        if target_date < today:
            return {"date": date, "slots": [], "message": "Fecha pasada"}
        
        # Check max advance days (60 days)
        if (target_date - today).days > 60:
            return {"date": date, "slots": [], "message": "Muy lejano"}
        
        # Check if calendar is accepting appointments
        calendar_settings = await _db.office_hours.find_one({"type": "calendar_settings"})
        if calendar_settings and not calendar_settings.get("accepting_appointments", True):
            return {
                "date": date,
                "slots": [],
                "is_open": False,
                "calendar_paused": True,
                "reason": calendar_settings.get("pause_reason", "Calendario pausado temporalmente")
            }
        
        # Check if this specific day is blocked
        blocked_day = await _db.office_hours.find_one({
            "type": "blocked_day",
            "date": date
        })
        if blocked_day:
            return {
                "date": date,
                "slots": [],
                "is_open": False,
                "day_blocked": True,
                "reason": blocked_day.get("reason", "Día cerrado")
            }
        
        # Get office hours for this date
        hours = await get_local_office_hours(date)
        
        if not hours.get("is_open"):
            return {
                "date": date,
                "slots": [],
                "is_open": False,
                "reason": hours.get("reason", "Cerrado"),
                "is_tax_season": hours.get("is_tax_season", False)
            }
        
        open_time = hours.get("open_time")
        close_time = hours.get("close_time")
        
        if not open_time or not close_time:
            return {"date": date, "slots": [], "message": "Horarios no configurados"}
        
        # Generate time slots (30-minute intervals)
        slot_duration = 30  # minutes
        
        start_hour, start_min = map(int, open_time.split(':'))
        end_hour, end_min = map(int, close_time.split(':'))
        
        current_time = datetime.combine(target_date, datetime.min.time()).replace(
            hour=start_hour, minute=start_min
        )
        end_time_dt = datetime.combine(target_date, datetime.min.time()).replace(
            hour=end_hour, minute=end_min
        )
        
        # Get all existing appointments for this date
        existing_appointments = await _db.appointments.find({
            '$or': [
                {'date': date, 'status': {'$nin': ['cancelled', 'rejected', 'no_show']}},
                {'date': {'$regex': f'^{date}'}, 'status': {'$nin': ['cancelled', 'rejected', 'no_show']}},
                {'scheduled_at': {'$regex': f'^{date}'}, 'status': {'$nin': ['cancelled', 'rejected', 'no_show']}}
            ]
        }).to_list(100)
        
        # Get blocked slots for this date
        blocked_slots = await _db.office_hours.find({
            "type": "blocked_slot",
            "date": date
        }).to_list(50)
        blocked_slot_times = {s.get("time") for s in blocked_slots}
        
        # Extract booked times - considering duration_minutes and quantity
        booked_times = set()
        slot_duration = 30  # Standard slot duration in minutes
        
        for apt in existing_appointments:
            apt_time = apt.get('time', '')
            
            # Get the appointment start time
            start_time_str = None
            if apt_time:
                start_time_str = apt_time[:5]  # HH:MM
            
            # Also check scheduled_at
            scheduled_at = apt.get('scheduled_at', '')
            if scheduled_at and 'T' in str(scheduled_at):
                try:
                    time_part = str(scheduled_at).split('T')[1][:5]
                    if not start_time_str:
                        start_time_str = time_part
                except:
                    pass
            
            if not start_time_str:
                continue
            
            # Calculate how many slots this appointment occupies
            # Based on duration_minutes (default 30) or quantity (default 1)
            duration_mins = apt.get('duration_minutes', 30)
            quantity = apt.get('quantity', 1)
            
            # If quantity > 1, each person takes 30 minutes (one slot)
            # If duration > 30, calculate slots based on duration
            slots_to_block = max(quantity, duration_mins // slot_duration)
            
            # Parse start time
            try:
                start_hour, start_min = map(int, start_time_str.split(':'))
                start_dt = datetime.combine(target_date, datetime.min.time()).replace(
                    hour=start_hour, minute=start_min
                )
                
                # Block all consecutive slots
                for i in range(slots_to_block):
                    slot_dt = start_dt + timedelta(minutes=i * slot_duration)
                    booked_times.add(slot_dt.strftime('%H:%M'))
            except Exception as e:
                # Fallback: just block the start time
                booked_times.add(start_time_str)
                logging.warning(f"Error calculating slots for appointment: {e}")
        
        # If today, skip past times
        now = datetime.now(timezone.utc)
        
        # Get booking rules for min_advance_hours filtering
        booking_rules = await _db.booking_rules.find_one({}) or {}
        min_advance_hours = booking_rules.get('min_advance_hours', 24)
        
        if target_date == today:
            # Use Texas timezone
            import pytz
            texas_tz = pytz.timezone('America/Chicago')
            now_texas = now.astimezone(texas_tz)
            current_hour = now_texas.hour
            current_minute = now_texas.minute
            
            # Start from next available slot
            if current_hour > start_hour or (current_hour == start_hour and current_minute > start_min):
                # Round up to next 30-minute slot
                if current_minute < 30:
                    current_time = current_time.replace(hour=current_hour, minute=30)
                else:
                    current_time = current_time.replace(hour=current_hour + 1, minute=0)
        
        # Determine correct CT timezone offset (CDT: -05:00, CST: -06:00)
        import pytz
        texas_tz = pytz.timezone('America/Chicago')
        target_dt_aware = texas_tz.localize(datetime.combine(target_date, datetime.min.time()))
        ct_offset = target_dt_aware.strftime('%z')  # e.g., '-0500' or '-0600'
        ct_offset_formatted = f"{ct_offset[:3]}:{ct_offset[3:]}"  # e.g., '-05:00'
        
        slots = []
        while current_time < end_time_dt:
            slot_time_str = current_time.strftime('%H:%M')
            
            # Check if slot is available (not booked and not blocked)
            is_booked = slot_time_str in booked_times
            is_blocked = slot_time_str in blocked_slot_times
            
            # Check min_advance_hours rule
            import pytz
            texas_tz = pytz.timezone('America/Chicago')
            slot_dt_texas = texas_tz.localize(current_time)
            now_texas = now.astimezone(texas_tz)
            hours_until_slot = (slot_dt_texas - now_texas).total_seconds() / 3600
            too_soon = hours_until_slot < min_advance_hours
            
            is_available = not is_booked and not is_blocked and not too_soon
            
            # Get block reason if blocked
            block_reason = None
            if is_blocked:
                for bs in blocked_slots:
                    if bs.get("time") == slot_time_str:
                        block_reason = bs.get("reason", "Bloqueado")
                        break
            
            slots.append({
                "time": slot_time_str,
                "start_at": f"{date}T{slot_time_str}:00{ct_offset_formatted}",
                "available": is_available,
                "booked": is_booked,
                "blocked": is_blocked,
                "block_reason": block_reason
            })
            
            current_time = current_time + timedelta(minutes=slot_duration)
        
        return {
            "date": date,
            "slots": slots,
            "is_open": True,
            "open_time": open_time,
            "close_time": close_time,
            "is_tax_season": hours.get("is_tax_season", False),
            "booked_count": len(booked_times),
            "blocked_count": len(blocked_slot_times),
            "available_count": len([s for s in slots if s["available"]])
        }
        
    except Exception as e:
        logging.error(f'Error getting local availability: {str(e)}')
        return {"date": date, "slots": [], "error": str(e)}


@appointment_router.get('/local/office-hours')
async def get_office_hours_config():
    """Get current office hours configuration"""
    schedule = await _db.office_hours.find_one({"type": "weekly_schedule"})
    tax_config = await _db.office_hours.find_one({"type": "tax_season_config"})
    calendar_settings = await _db.office_hours.find_one({"type": "calendar_settings"})
    
    return {
        "regular_schedule": schedule.get("schedule", {}) if schedule else {},
        "tax_season_config": {
            "is_tax_season": tax_config.get("is_tax_season", False) if tax_config else False,
            "tax_season_schedule": tax_config.get("tax_season_schedule", {}) if tax_config else {},
            "tax_season_start": tax_config.get("tax_season_start", "01-01") if tax_config else "01-01",
            "tax_season_end": tax_config.get("tax_season_end", "04-15") if tax_config else "04-15"
        },
        "calendar_settings": {
            "accepting_appointments": calendar_settings.get("accepting_appointments", True) if calendar_settings else True,
            "pause_reason": calendar_settings.get("pause_reason", "") if calendar_settings else "",
            "paused_at": calendar_settings.get("paused_at") if calendar_settings else None
        }
    }


@appointment_router.get('/admin/office-hours')
async def get_admin_office_hours(current_user: dict = Depends(_require_admin)):
    """Get office hours configuration for admin panel"""
    try:
        schedule = await _db.office_hours.find_one({"type": "weekly_schedule"})
        tax_config = await _db.office_hours.find_one({"type": "tax_season_config"})
        calendar_settings = await _db.office_hours.find_one({"type": "calendar_settings"})
        manual_override = await _db.office_hours.find_one({"type": "manual_override"})
        
        # Default weekly schedule
        default_schedule = {
            "monday": {"open": "09:00", "close": "18:00", "enabled": True},
            "tuesday": {"open": "09:00", "close": "18:00", "enabled": True},
            "wednesday": {"open": "09:00", "close": "18:00", "enabled": True},
            "thursday": {"open": "09:00", "close": "18:00", "enabled": True},
            "friday": {"open": "09:00", "close": "18:00", "enabled": True},
            "saturday": {"open": "09:00", "close": "14:00", "enabled": True},
            "sunday": {"open": "09:00", "close": "14:00", "enabled": False}
        }
        
        return {
            "success": True,
            "weekly_schedule": schedule.get("schedule", default_schedule) if schedule else default_schedule,
            "tax_season": {
                "enabled": tax_config.get("is_tax_season", False) if tax_config else False,
                "schedule": tax_config.get("tax_season_schedule", {}) if tax_config else {},
                "start_date": tax_config.get("tax_season_start", "01-01") if tax_config else "01-01",
                "end_date": tax_config.get("tax_season_end", "04-15") if tax_config else "04-15"
            },
            "manual_override": {
                "active": manual_override.get("active", False) if manual_override else False,
                "status": manual_override.get("status", "closed") if manual_override else "closed",
                "reason": manual_override.get("reason", "") if manual_override else ""
            },
            "accepting_appointments": calendar_settings.get("accepting_appointments", True) if calendar_settings else True
        }
    except Exception as e:
        logging.error(f"Error getting office hours: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/office-hours')
async def update_admin_office_hours(
    request: Request,
    current_user: dict = Depends(_require_admin)
):
    """Update office hours configuration"""
    try:
        data = await request.json()
        
        # Update weekly schedule if provided
        if "weekly_schedule" in data:
            await _db.office_hours.update_one(
                {"type": "weekly_schedule"},
                {"$set": {"schedule": data["weekly_schedule"], "updated_at": datetime.now(timezone.utc)}},
                upsert=True
            )
        
        # Update tax season config if provided
        if "tax_season" in data:
            await _db.office_hours.update_one(
                {"type": "tax_season_config"},
                {"$set": {
                    "is_tax_season": data["tax_season"].get("enabled", False),
                    "tax_season_schedule": data["tax_season"].get("schedule", {}),
                    "tax_season_start": data["tax_season"].get("start_date", "01-01"),
                    "tax_season_end": data["tax_season"].get("end_date", "04-15"),
                    "updated_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        
        # Update manual override if provided
        if "manual_override" in data:
            await _db.office_hours.update_one(
                {"type": "manual_override"},
                {"$set": {
                    "active": data["manual_override"].get("active", False),
                    "status": data["manual_override"].get("status", "closed"),
                    "reason": data["manual_override"].get("reason", ""),
                    "updated_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        
        return {"success": True, "message": "Office hours updated successfully"}
    except Exception as e:
        logging.error(f"Error updating office hours: {e}")
        raise HTTPException(status_code=500, detail=str(e))




# ================== BOOKING RULES ENDPOINTS ==================

@appointment_router.get('/admin/booking-rules')
async def get_booking_rules(current_user: dict = Depends(_require_admin)):
    """Get booking rules configuration for appointments"""
    try:
        rules = await _db.office_hours.find_one({"type": "booking_rules"})
        
        # Default booking rules
        default_rules = {
            "min_advance_hours": 24,           # Minimum hours before appointment
            "max_advance_days": 30,           # Maximum days in advance
            "slot_duration_minutes": 30,      # Duration of each slot
            "buffer_between_slots": 0,        # Buffer time between appointments
            "max_appointments_per_day": 20,   # Max appointments per day
            "max_appointments_per_slot": 1,   # Max clients per time slot
            "require_phone": True,            # Require phone to book
            "require_email": True,            # Require email to book
            "allow_same_day_booking": False,   # Allow booking same day
            "cancellation_notice_hours": 24,  # Hours notice for cancellation
            "allow_online_booking": True,     # Allow clients to book online
            "auto_confirm": False,            # Auto-confirm or require manual approval
            "send_confirmation_email": True,  # Send email on booking
            "send_confirmation_sms": True,    # Send SMS on booking
            "send_reminder_hours": [24, 2],   # Hours before to send reminders
            "blocked_services": [],           # Services not available for online booking
            "notes": ""                       # Admin notes
        }
        
        if rules:
            # Merge with defaults to ensure all fields exist
            for key, value in default_rules.items():
                if key not in rules:
                    rules[key] = value
            rules.pop('_id', None)
            rules.pop('type', None)
            return {"success": True, "rules": rules}
        
        return {"success": True, "rules": default_rules}
    except Exception as e:
        logging.error(f"Error getting booking rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/booking-rules')
async def update_booking_rules(
    request: Request,
    current_user: dict = Depends(_require_admin)
):
    """Update booking rules configuration"""
    try:
        data = await request.json()
        
        # Validate numeric fields
        numeric_fields = [
            'min_advance_hours', 'max_advance_days', 'slot_duration_minutes',
            'buffer_between_slots', 'max_appointments_per_day', 'max_appointments_per_slot',
            'cancellation_notice_hours'
        ]
        
        for field in numeric_fields:
            if field in data:
                data[field] = int(data[field])
        
        # Validate boolean fields
        boolean_fields = [
            'require_phone', 'require_email', 'allow_same_day_booking',
            'allow_online_booking', 'auto_confirm', 'send_confirmation_email',
            'send_confirmation_sms'
        ]
        
        for field in boolean_fields:
            if field in data:
                data[field] = bool(data[field])
        
        # Ensure send_reminder_hours is a list
        if 'send_reminder_hours' in data:
            if isinstance(data['send_reminder_hours'], str):
                data['send_reminder_hours'] = [int(x.strip()) for x in data['send_reminder_hours'].split(',') if x.strip()]
            elif isinstance(data['send_reminder_hours'], list):
                data['send_reminder_hours'] = [int(x) for x in data['send_reminder_hours']]
        
        # Update in database
        await _db.office_hours.update_one(
            {"type": "booking_rules"},
            {"$set": {
                **data,
                "type": "booking_rules",
                "updated_at": datetime.now(timezone.utc),
                "updated_by": str(current_user.get("_id", ""))
            }},
            upsert=True
        )
        
        logging.info(f"📅 Booking rules updated by {current_user.get('email')}")
        return {"success": True, "message": "Reglas de reserva actualizadas correctamente"}
    except Exception as e:
        logging.error(f"Error updating booking rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.get('/public/booking-rules')
async def get_public_booking_rules():
    """Get booking rules for public appointment booking (limited fields)"""
    try:
        rules = await _db.office_hours.find_one({"type": "booking_rules"})
        
        if not rules:
            rules = {
                "min_advance_hours": 24,
                "max_advance_days": 30,
                "slot_duration_minutes": 30,
                "allow_same_day_booking": False,
                "allow_online_booking": True,
                "require_phone": True,
                "require_email": True
            }
        
        # Only return fields relevant for public booking
        public_rules = {
            "min_advance_hours": rules.get("min_advance_hours", 2),
            "max_advance_days": rules.get("max_advance_days", 30),
            "slot_duration_minutes": rules.get("slot_duration_minutes", 30),
            "allow_same_day_booking": rules.get("allow_same_day_booking", True),
            "allow_online_booking": rules.get("allow_online_booking", True),
            "require_phone": rules.get("require_phone", True),
            "require_email": rules.get("require_email", True),
            "cancellation_notice_hours": rules.get("cancellation_notice_hours", 24)
        }
        
        return {"success": True, "rules": public_rules}
    except Exception as e:
        logging.error(f"Error getting public booking rules: {e}")
        return {"success": True, "rules": {
            "min_advance_hours": 24,
            "max_advance_days": 30,
            "slot_duration_minutes": 30,
            "allow_same_day_booking": False,
            "allow_online_booking": True
        }}


# ================== WAITING LIST ENDPOINTS ==================

@appointment_router.get('/admin/waiting-list')
async def get_waiting_list(
    date: Optional[str] = None,
    current_user: dict = Depends(_require_admin)
):
    """Get waiting list entries"""
    try:
        query = {}
        if date:
            query["preferred_date"] = date
        
        entries = await _db.waiting_list.find(query).sort("created_at", -1).to_list(100)
        
        for entry in entries:
            entry['_id'] = str(entry['_id'])
            # Get client info
            if entry.get('client_id'):
                try:
                    client = await _db.users.find_one({"_id": ObjectId(entry['client_id'])})
                    if client:
                        entry['client_name'] = client.get('name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
                        entry['client_email'] = client.get('email')
                        entry['client_phone'] = client.get('phone')
                except:
                    pass
        
        return {"success": True, "entries": entries}
    except Exception as e:
        logging.error(f"Error getting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/waiting-list')
async def add_to_waiting_list(request: Request, current_user: dict = Depends(_require_admin)):
    """Add client to waiting list"""
    try:
        data = await request.json()
        
        entry = {
            "client_id": data.get("client_id"),
            "client_name": data.get("client_name"),
            "client_email": data.get("client_email"),
            "client_phone": data.get("client_phone"),
            "preferred_date": data.get("preferred_date"),
            "preferred_time": data.get("preferred_time"),
            "service_type": data.get("service_type", "general"),
            "notes": data.get("notes", ""),
            "status": "waiting",  # waiting, notified, booked, expired
            "created_at": datetime.now(timezone.utc),
            "created_by": str(current_user.get("_id", ""))
        }
        
        result = await _db.waiting_list.insert_one(entry)
        entry['_id'] = str(result.inserted_id)
        
        logging.info(f"📋 Added to waiting list: {data.get('client_name')}")
        return {"success": True, "entry": entry}
    except Exception as e:
        logging.error(f"Error adding to waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/waiting-list/{entry_id}/notify')
async def notify_waiting_list_client(entry_id: str, current_user: dict = Depends(_require_admin)):
    """Notify client that a slot is available"""
    try:
        entry = await _db.waiting_list.find_one({"_id": ObjectId(entry_id)})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Send notification
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if config_doc:
            from notification_service import NotificationService
            notif_service = NotificationService(config_doc)
            
            message = f"¡Buenas noticias! Se ha liberado un espacio para el {entry.get('preferred_date')}. Responda a este mensaje o llame para confirmar su cita."
            
            if entry.get('client_phone'):
                await notif_service.send_sms(entry['client_phone'], message)
            if entry.get('client_email'):
                await notif_service.send_email(
                    entry['client_email'],
                    "Espacio disponible - Ross Tax",
                    message
                )
        
        # Update status
        await _db.waiting_list.update_one(
            {"_id": ObjectId(entry_id)},
            {"$set": {"status": "notified", "notified_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "message": "Cliente notificado"}
    except Exception as e:
        logging.error(f"Error notifying waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.delete('/admin/waiting-list/{entry_id}')
async def remove_from_waiting_list(entry_id: str, current_user: dict = Depends(_require_admin)):
    """Remove entry from waiting list"""
    try:
        result = await _db.waiting_list.delete_one({"_id": ObjectId(entry_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"success": True, "message": "Entrada eliminada"}
    except Exception as e:
        logging.error(f"Error removing from waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== RECURRING APPOINTMENTS ENDPOINTS ==================

@appointment_router.post('/admin/appointments/recurring')
async def create_recurring_appointment(request: Request, current_user: dict = Depends(_require_admin)):
    """Create recurring appointments"""
    try:
        data = await request.json()
        
        # Required fields
        client_id = data.get("client_id")
        start_date = data.get("start_date")  # YYYY-MM-DD
        time = data.get("time")  # HH:MM
        recurrence_type = data.get("recurrence_type", "weekly")  # weekly, biweekly, monthly
        occurrences = int(data.get("occurrences", 4))
        service_name = data.get("service_name", "Cita Recurrente")
        
        if not all([client_id, start_date, time]):
            raise HTTPException(status_code=400, detail="Faltan campos requeridos")
        
        # Get client info
        client = None
        try:
            client = await _db.users.find_one({"_id": ObjectId(client_id)})
        except:
            client = await _db.users.find_one({"id": client_id})
        
        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
        client_name = client.get('name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
        
        # Calculate dates based on recurrence type
        from dateutil.relativedelta import relativedelta
        
        base_date = datetime.strptime(start_date, "%Y-%m-%d")
        created_appointments = []
        
        # Create recurring series ID
        series_id = str(ObjectId())
        
        for i in range(occurrences):
            if recurrence_type == "weekly":
                apt_date = base_date + timedelta(weeks=i)
            elif recurrence_type == "biweekly":
                apt_date = base_date + timedelta(weeks=i*2)
            elif recurrence_type == "monthly":
                apt_date = base_date + relativedelta(months=i)
            else:
                apt_date = base_date + timedelta(weeks=i)
            
            # Build scheduled_at from date + time
            hour, minute = map(int, time.split(':'))
            scheduled_dt = apt_date.replace(hour=hour, minute=minute)
            
            appointment = {
                "user_id": client_id,
                "user_name": client_name,
                "user_email": client.get('email'),
                "user_phone": client.get('phone'),
                "service_name": service_name,
                "date": apt_date.strftime("%Y-%m-%d"),
                "time": time,
                "scheduled_at": scheduled_dt,
                "duration": data.get("duration", 60),
                "status": "scheduled",
                "notes": data.get("notes", ""),
                "source": "recurring",
                "series_id": series_id,
                "occurrence_number": i + 1,
                "total_occurrences": occurrences,
                "recurrence_type": recurrence_type,
                "created_at": datetime.now(timezone.utc),
                "created_by": str(current_user.get("_id", ""))
            }
            
            result = await _db.appointments.insert_one(appointment)
            appointment['_id'] = str(result.inserted_id)
            created_appointments.append(appointment)
        
        logging.info(f"📅 Created {len(created_appointments)} recurring appointments for {client_name}")
        return {
            "success": True,
            "message": f"Se crearon {len(created_appointments)} citas recurrentes",
            "series_id": series_id,
            "appointments": created_appointments
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating recurring appointments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.delete('/admin/appointments/series/{series_id}')
async def cancel_recurring_series(series_id: str, current_user: dict = Depends(_require_admin)):
    """Cancel all future appointments in a recurring series"""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        result = await _db.appointments.update_many(
            {
                "series_id": series_id,
                "date": {"$gte": today},
                "status": {"$in": ["scheduled", "confirmed"]}
            },
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
        )
        
        return {
            "success": True,
            "message": f"Se cancelaron {result.modified_count} citas de la serie"
        }
    except Exception as e:
        logging.error(f"Error cancelling series: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== APPOINTMENT METRICS/ANALYTICS ENDPOINTS ==================

@appointment_router.get('/admin/appointments/metrics')
async def get_appointment_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(_require_admin)
):
    """Get appointment analytics and metrics"""
    try:
        # Default to last 30 days
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Build query
        query = {
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        appointments = await _db.appointments.find(query).to_list(10000)
        
        total = len(appointments)
        if total == 0:
            return {
                "success": True,
                "metrics": {
                    "total_appointments": 0,
                    "completion_rate": 0,
                    "cancellation_rate": 0,
                    "no_show_rate": 0,
                    "by_status": {},
                    "by_day_of_week": {},
                    "by_hour": {},
                    "by_service": {},
                    "busiest_days": [],
                    "busiest_hours": []
                }
            }
        
        # Count by status
        by_status = {}
        for apt in appointments:
            status = apt.get('status', 'unknown')
            by_status[status] = by_status.get(status, 0) + 1
        
        # Count by day of week
        day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        by_day = {day: 0 for day in day_names}
        for apt in appointments:
            try:
                apt_date = datetime.strptime(apt.get('date', ''), "%Y-%m-%d")
                day_name = day_names[apt_date.weekday()]
                by_day[day_name] = by_day.get(day_name, 0) + 1
            except:
                pass
        
        # Count by hour
        by_hour = {}
        for apt in appointments:
            time_str = apt.get('time', '')
            if time_str:
                hour = time_str.split(':')[0] if ':' in time_str else time_str[:2]
                by_hour[hour] = by_hour.get(hour, 0) + 1
        
        # Count by service
        by_service = {}
        for apt in appointments:
            service = apt.get('service_name', 'Sin especificar')
            by_service[service] = by_service.get(service, 0) + 1
        
        # Calculate rates
        completed = by_status.get('completed', 0)
        cancelled = by_status.get('cancelled', 0)
        no_show = by_status.get('no_show', 0)
        
        completion_rate = round((completed / total) * 100, 1) if total > 0 else 0
        cancellation_rate = round((cancelled / total) * 100, 1) if total > 0 else 0
        no_show_rate = round((no_show / total) * 100, 1) if total > 0 else 0
        
        # Find busiest days and hours
        busiest_days = sorted(by_day.items(), key=lambda x: x[1], reverse=True)[:3]
        busiest_hours = sorted(by_hour.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Daily breakdown for chart
        daily_counts = {}
        for apt in appointments:
            date = apt.get('date', '')
            if date:
                daily_counts[date] = daily_counts.get(date, 0) + 1
        
        return {
            "success": True,
            "metrics": {
                "total_appointments": total,
                "completion_rate": completion_rate,
                "cancellation_rate": cancellation_rate,
                "no_show_rate": no_show_rate,
                "by_status": by_status,
                "by_day_of_week": by_day,
                "by_hour": by_hour,
                "by_service": by_service,
                "busiest_days": [{"day": d[0], "count": d[1]} for d in busiest_days],
                "busiest_hours": [{"hour": h[0], "count": h[1]} for h in busiest_hours],
                "daily_breakdown": daily_counts,
                "period": {"start": start_date, "end": end_date}
            }
        }
    except Exception as e:
        logging.error(f"Error getting appointment metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== SCHEDULE BLOCKING ENDPOINTS ==================

@appointment_router.get('/admin/schedule-blocks')
async def get_schedule_blocks(current_user: dict = Depends(_require_admin)):
    """Get all schedule blocks (holidays, vacations, etc.)"""
    try:
        blocks = await _db.schedule_blocks.find().sort("start_date", 1).to_list(500)
        for block in blocks:
            block['_id'] = str(block['_id'])
        return {"success": True, "blocks": blocks}
    except Exception as e:
        logging.error(f"Error getting schedule blocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/schedule-blocks')
async def create_schedule_block(request: Request, current_user: dict = Depends(_require_admin)):
    """Create a schedule block (holiday, vacation, special hours)"""
    try:
        data = await request.json()
        
        block = {
            "title": data.get("title", "Bloqueo"),
            "block_type": data.get("block_type", "custom"),  # holiday, vacation, lunch, meeting, custom
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date", data.get("start_date")),
            "start_time": data.get("start_time"),  # Optional, for partial day blocks
            "end_time": data.get("end_time"),
            "all_day": data.get("all_day", True),
            "recurring": data.get("recurring", False),
            "recurrence_rule": data.get("recurrence_rule"),  # yearly for holidays
            "notes": data.get("notes", ""),
            "created_at": datetime.now(timezone.utc),
            "created_by": str(current_user.get("_id", ""))
        }
        
        result = await _db.schedule_blocks.insert_one(block)
        block['_id'] = str(result.inserted_id)
        
        logging.info(f"📅 Created schedule block: {block['title']}")
        return {"success": True, "block": block}
    except Exception as e:
        logging.error(f"Error creating schedule block: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.delete('/admin/schedule-blocks/{block_id}')
async def delete_schedule_block(block_id: str, current_user: dict = Depends(_require_admin)):
    """Delete a schedule block"""
    try:
        result = await _db.schedule_blocks.delete_one({"_id": ObjectId(block_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Block not found")
        return {"success": True, "message": "Bloqueo eliminado"}
    except Exception as e:
        logging.error(f"Error deleting schedule block: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/schedule-blocks/init-holidays')
async def init_us_holidays(
    year: int = None,
    current_user: dict = Depends(_require_admin)
):
    """Initialize US holidays for a given year"""
    try:
        if not year:
            year = datetime.now().year
        
        # US Federal Holidays
        holidays = [
            {"title": "Año Nuevo", "date": f"{year}-01-01"},
            {"title": "Día de Martin Luther King Jr.", "date": f"{year}-01-15"},  # 3rd Monday
            {"title": "Día de los Presidentes", "date": f"{year}-02-19"},  # 3rd Monday
            {"title": "Memorial Day", "date": f"{year}-05-27"},  # Last Monday May
            {"title": "Día de la Independencia", "date": f"{year}-07-04"},
            {"title": "Día del Trabajo", "date": f"{year}-09-02"},  # 1st Monday Sept
            {"title": "Día de Colón", "date": f"{year}-10-14"},  # 2nd Monday Oct
            {"title": "Día de los Veteranos", "date": f"{year}-11-11"},
            {"title": "Día de Acción de Gracias", "date": f"{year}-11-28"},  # 4th Thursday
            {"title": "Navidad", "date": f"{year}-12-25"},
        ]
        
        created = 0
        for holiday in holidays:
            # Check if already exists
            existing = await _db.schedule_blocks.find_one({
                "title": holiday["title"],
                "start_date": holiday["date"]
            })
            
            if not existing:
                await _db.schedule_blocks.insert_one({
                    "title": holiday["title"],
                    "block_type": "holiday",
                    "start_date": holiday["date"],
                    "end_date": holiday["date"],
                    "all_day": True,
                    "recurring": True,
                    "recurrence_rule": "yearly",
                    "created_at": datetime.now(timezone.utc)
                })
                created += 1
        
        return {"success": True, "message": f"Se agregaron {created} feriados para {year}"}
    except Exception as e:
        logging.error(f"Error initializing holidays: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== CLIENT CONFIRMATION LINK ENDPOINTS ==================

@appointment_router.get('/public/appointment/confirm/{token}')
async def get_appointment_for_confirmation(token: str):
    """Get appointment details for client confirmation page"""
    try:
        # Find appointment by confirmation token
        appointment = await _db.appointments.find_one({"confirmation_token": token})
        
        if not appointment:
            return {"success": False, "error": "Cita no encontrada o token inválido"}
        
        return {
            "success": True,
            "appointment": {
                "date": appointment.get("date"),
                "time": appointment.get("time"),
                "service_name": appointment.get("service_name"),
                "status": appointment.get("status"),
                "user_name": appointment.get("user_name")
            }
        }
    except Exception as e:
        logging.error(f"Error getting appointment for confirmation: {e}")
        return {"success": False, "error": str(e)}


@appointment_router.post('/public/appointment/confirm/{token}')
async def confirm_appointment_by_client(token: str, request: Request):
    """Client confirms their appointment via link"""
    try:
        data = await request.json()
        action = data.get("action", "confirm")  # confirm, cancel, reschedule
        
        appointment = await _db.appointments.find_one({"confirmation_token": token})
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        if action == "confirm":
            await _db.appointments.update_one(
                {"confirmation_token": token},
                {"$set": {
                    "status": "confirmed",
                    "confirmed_at": datetime.now(timezone.utc),
                    "confirmed_by": "client"
                }}
            )
            return {"success": True, "message": "Cita confirmada exitosamente"}
        
        elif action == "cancel":
            await _db.appointments.update_one(
                {"confirmation_token": token},
                {"$set": {
                    "status": "cancelled",
                    "cancelled_at": datetime.now(timezone.utc),
                    "cancelled_by": "client",
                    "cancellation_reason": data.get("reason", "")
                }}
            )
            return {"success": True, "message": "Cita cancelada"}
        
        return {"success": False, "error": "Acción no válida"}
    except Exception as e:
        logging.error(f"Error in client confirmation: {e}")
        return {"success": False, "error": str(e)}


@appointment_router.post('/admin/appointments/{appointment_id}/send-confirmation-link')
async def send_confirmation_link(appointment_id: str, current_user: dict = Depends(_require_admin)):
    """Generate and send confirmation link to client"""
    try:
        import secrets
        
        # Find appointment
        appointment = None
        try:
            appointment = await _db.appointments.find_one({"_id": ObjectId(appointment_id)})
        except:
            appointment = await _db.appointments.find_one({"id": appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        
        # Generate token
        token = secrets.token_urlsafe(32)
        
        # Update appointment with token
        await _db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"confirmation_token": token}}
        )
        
        # Generate confirmation URL
        base_url = "https://www.rosstaxpreparation.com"
        confirm_url = f"{base_url}/confirmar-cita?token={token}"
        
        # Send notification
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if config_doc:
            from notification_service import NotificationService
            notif_service = NotificationService(config_doc)
            
            message = f"Confirme su cita del {appointment.get('date')} a las {appointment.get('time')}. Haga clic aquí: {confirm_url}"
            
            if appointment.get('user_phone'):
                await notif_service.send_sms(appointment['user_phone'], message)
            if appointment.get('user_email'):
                await notif_service.send_email(
                    appointment['user_email'],
                    "Confirme su cita - Ross Tax",
                    f"""
                    <h2>Confirme su cita</h2>
                    <p>Fecha: {appointment.get('date')}</p>
                    <p>Hora: {appointment.get('time')}</p>
                    <p>Servicio: {appointment.get('service_name', 'Cita General')}</p>
                    <p><a href="{confirm_url}" style="background-color: #6C1110; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirmar Cita</a></p>
                    <p><a href="{confirm_url}&action=cancel">No puedo asistir</a></p>
                    """
                )
        
        return {"success": True, "message": "Link de confirmación enviado", "url": confirm_url}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending confirmation link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== PRE-APPOINTMENT FORMS ENDPOINTS ==================

@appointment_router.get('/admin/intake-forms')
async def get_intake_forms(current_user: dict = Depends(_require_admin)):
    """Get all intake form templates"""
    try:
        forms = await _db.intake_forms.find().to_list(100)
        for form in forms:
            form['_id'] = str(form['_id'])
        return {"success": True, "forms": forms}
    except Exception as e:
        logging.error(f"Error getting intake forms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/intake-forms')
async def create_intake_form(request: Request, current_user: dict = Depends(_require_admin)):
    """Create an intake form template"""
    try:
        data = await request.json()
        
        form = {
            "name": data.get("name"),
            "description": data.get("description", ""),
            "service_types": data.get("service_types", []),  # Which services need this form
            "fields": data.get("fields", []),  # Array of field definitions
            "is_active": data.get("is_active", True),
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await _db.intake_forms.insert_one(form)
        form['_id'] = str(result.inserted_id)
        
        return {"success": True, "form": form}
    except Exception as e:
        logging.error(f"Error creating intake form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.get('/public/intake-form/{appointment_token}')
async def get_intake_form_for_appointment(appointment_token: str):
    """Get the intake form for a specific appointment"""
    try:
        appointment = await _db.appointments.find_one({"confirmation_token": appointment_token})
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        service_type = appointment.get("service_name", "general")
        
        # Find applicable form
        form = await _db.intake_forms.find_one({
            "is_active": True,
            "$or": [
                {"service_types": service_type},
                {"service_types": "all"}
            ]
        })
        
        if not form:
            return {"success": True, "form": None}
        
        form['_id'] = str(form['_id'])
        return {"success": True, "form": form}
    except Exception as e:
        logging.error(f"Error getting intake form: {e}")
        return {"success": False, "error": str(e)}


@appointment_router.post('/public/intake-form/{appointment_token}/submit')
async def submit_intake_form(appointment_token: str, request: Request):
    """Submit intake form responses"""
    try:
        data = await request.json()
        
        appointment = await _db.appointments.find_one({"confirmation_token": appointment_token})
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        # Save form responses
        response = {
            "appointment_id": str(appointment["_id"]),
            "form_id": data.get("form_id"),
            "responses": data.get("responses", {}),
            "submitted_at": datetime.now(timezone.utc)
        }
        
        await _db.intake_responses.insert_one(response)
        
        # Update appointment
        await _db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"intake_form_completed": True, "intake_completed_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "message": "Formulario enviado correctamente"}
    except Exception as e:
        logging.error(f"Error submitting intake form: {e}")
        return {"success": False, "error": str(e)}


# ================== SERVICE-BASED APPOINTMENT TYPES ==================

@appointment_router.get('/admin/appointment-types')
async def get_appointment_types(current_user: dict = Depends(_require_admin)):
    """Get all appointment types with their configurations"""
    try:
        types = await _db.appointment_types.find().to_list(100)
        for t in types:
            t['_id'] = str(t['_id'])
        return {"success": True, "types": types}
    except Exception as e:
        logging.error(f"Error getting appointment types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/appointment-types')
async def create_appointment_type(request: Request, current_user: dict = Depends(_require_admin)):
    """Create an appointment type"""
    try:
        data = await request.json()
        
        apt_type = {
            "name": data.get("name"),
            "description": data.get("description", ""),
            "duration_minutes": int(data.get("duration_minutes", 60)),
            "color": data.get("color", "#6C1110"),
            "price": float(data.get("price", 0)),
            "requires_deposit": data.get("requires_deposit", False),
            "deposit_amount": float(data.get("deposit_amount", 0)),
            "buffer_before": int(data.get("buffer_before", 0)),
            "buffer_after": int(data.get("buffer_after", 0)),
            "max_per_day": int(data.get("max_per_day", 0)),  # 0 = unlimited
            "available_online": data.get("available_online", True),
            "intake_form_id": data.get("intake_form_id"),
            "assigned_staff": data.get("assigned_staff", []),  # Staff who can do this type
            "is_active": data.get("is_active", True),
            "created_at": datetime.now(timezone.utc)
        }
        
        result = await _db.appointment_types.insert_one(apt_type)
        apt_type['_id'] = str(result.inserted_id)
        
        return {"success": True, "type": apt_type}
    except Exception as e:
        logging.error(f"Error creating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.put('/admin/appointment-types/{type_id}')
async def update_appointment_type(type_id: str, request: Request, current_user: dict = Depends(_require_admin)):
    """Update an appointment type"""
    try:
        data = await request.json()
        data['updated_at'] = datetime.now(timezone.utc)
        
        result = await _db.appointment_types.update_one(
            {"_id": ObjectId(type_id)},
            {"$set": data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tipo no encontrado")
        
        return {"success": True, "message": "Tipo actualizado"}
    except Exception as e:
        logging.error(f"Error updating appointment type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== POST-APPOINTMENT RATING ENDPOINTS ==================

@appointment_router.get('/public/rate/{appointment_token}')
async def get_appointment_for_rating(appointment_token: str):
    """Get appointment info for rating page"""
    try:
        appointment = await _db.appointments.find_one({"rating_token": appointment_token})
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        if appointment.get("rating_submitted"):
            return {"success": False, "error": "Ya ha calificado esta cita"}
        
        return {
            "success": True,
            "appointment": {
                "date": appointment.get("date"),
                "service_name": appointment.get("service_name"),
                "staff_name": appointment.get("staff_name")
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@appointment_router.post('/public/rate/{appointment_token}')
async def submit_appointment_rating(appointment_token: str, request: Request):
    """Submit rating for an appointment"""
    try:
        data = await request.json()
        
        appointment = await _db.appointments.find_one({"rating_token": appointment_token})
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        rating = {
            "appointment_id": str(appointment["_id"]),
            "client_id": appointment.get("user_id"),
            "rating": int(data.get("rating", 5)),  # 1-5 stars
            "feedback": data.get("feedback", ""),
            "would_recommend": data.get("would_recommend", True),
            "service_quality": int(data.get("service_quality", 5)),
            "wait_time_rating": int(data.get("wait_time_rating", 5)),
            "staff_friendliness": int(data.get("staff_friendliness", 5)),
            "submitted_at": datetime.now(timezone.utc)
        }
        
        await _db.appointment_ratings.insert_one(rating)
        
        # Update appointment
        await _db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"rating_submitted": True, "rating": rating["rating"]}}
        )
        
        # If high rating, prompt for Google review
        prompt_google_review = rating["rating"] >= 4
        
        return {
            "success": True,
            "message": "¡Gracias por su calificación!",
            "prompt_google_review": prompt_google_review
        }
    except Exception as e:
        logging.error(f"Error submitting rating: {e}")
        return {"success": False, "error": str(e)}


@appointment_router.post('/admin/appointments/{appointment_id}/send-rating-request')
async def send_rating_request(appointment_id: str, current_user: dict = Depends(_require_admin)):
    """Send rating request to client after appointment"""
    try:
        import secrets
        
        appointment = None
        try:
            appointment = await _db.appointments.find_one({"_id": ObjectId(appointment_id)})
        except:
            appointment = await _db.appointments.find_one({"id": appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        
        # Generate rating token
        token = secrets.token_urlsafe(32)
        
        await _db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"rating_token": token}}
        )
        
        # Send notification
        rate_url = f"https://www.rosstaxpreparation.com/calificar?token={token}"
        
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if config_doc:
            from notification_service import NotificationService
            notif_service = NotificationService(config_doc)
            
            message = f"¡Gracias por visitarnos! Califique su experiencia: {rate_url}"
            
            if appointment.get('user_phone'):
                await notif_service.send_sms(appointment['user_phone'], message)
        
        return {"success": True, "message": "Solicitud de calificación enviada"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending rating request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== AUTOMATED REMINDERS CRON JOB ==================

async def send_automated_reminders():
    """Cron job to send automated appointment reminders"""
    try:
        # Get booking rules
        rules = await _db.office_hours.find_one({"type": "booking_rules"})
        reminder_hours = rules.get("send_reminder_hours", [24, 2]) if rules else [24, 2]
        
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            logging.warning("No config found for reminders")
            return
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        now = datetime.now(timezone.utc)
        
        for hours_before in reminder_hours:
            target_time = now + timedelta(hours=hours_before)
            target_date = target_time.strftime("%Y-%m-%d")
            target_hour = target_time.strftime("%H")
            
            # Find appointments that need reminders
            appointments = await _db.appointments.find({
                "date": target_date,
                "time": {"$regex": f"^{target_hour}"},
                "status": {"$in": ["scheduled", "confirmed"]},
                f"reminder_{hours_before}h_sent": {"$ne": True}
            }).to_list(100)
            
            for apt in appointments:
                try:
                    message = f"Recordatorio: Tiene una cita mañana {apt.get('date')} a las {apt.get('time')}. Si no puede asistir, por favor avísenos con anticipación."
                    
                    if hours_before <= 2:
                        message = f"Recordatorio: Su cita es HOY a las {apt.get('time')}. ¡Lo esperamos!"
                    
                    if apt.get('user_phone') and rules.get('send_confirmation_sms', True):
                        await notif_service.send_sms(apt['user_phone'], message)
                    
                    if apt.get('user_email') and rules.get('send_confirmation_email', True):
                        await notif_service.send_email(apt['user_email'], "Recordatorio de cita - Ross Tax", message)
                    
                    # Mark as sent
                    await _db.appointments.update_one(
                        {"_id": apt["_id"]},
                        {"$set": {f"reminder_{hours_before}h_sent": True}}
                    )
                    
                    logging.info(f"📧 Sent {hours_before}h reminder for appointment {apt.get('_id')}")
                except Exception as e:
                    logging.error(f"Error sending reminder: {e}")
        
        logging.info("✅ Automated reminders check completed")
    except Exception as e:
        logging.error(f"Error in automated reminders: {e}")


# Register reminder cron job
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    if 'scheduler' in dir():
        scheduler.add_job(send_automated_reminders, 'interval', minutes=30, id='appointment_reminders', replace_existing=True)
        logging.info("📅 Appointment reminders cron job registered")
except Exception as e:
    logging.warning(f"Could not register reminder cron job: {e}")


# ================== ADMIN SEND SMS/EMAIL ENDPOINTS ==================

class SendSMSRequest(BaseModel):
    phone: str
    message: str

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    message: Optional[str] = None
    html_content: Optional[str] = None
    body: Optional[str] = None  # Alias for html_content

@appointment_router.post('/admin/send-sms')
async def admin_send_sms(request: SendSMSRequest, current_user: dict = Depends(_require_admin)):
    """Send SMS message to a phone number (admin only)"""
    try:
        # Get config from database
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=503, detail="Notification config not found")
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        if not notif_service.twilio_client:
            raise HTTPException(status_code=503, detail="SMS service not configured")
        
        # Clean phone number
        phone = request.phone.strip()
        if not phone.startswith('+'):
            phone = '+1' + phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
        
        # Send SMS
        message = notif_service.twilio_client.messages.create(
            body=request.message,
            from_=notif_service.twilio_phone_number,
            to=phone
        )
        
        logging.info(f"📱 SMS sent to {phone} by admin {current_user.get('email')}")
        
        return {
            "success": True,
            "message_sid": message.sid,
            "to": phone
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending SMS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/send-email')
async def admin_send_email(request: SendEmailRequest, current_user: dict = Depends(_require_admin)):
    """Send email to an address with tracking (admin only)"""
    try:
        import uuid
        
        # Get config from database
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=503, detail="Notification config not found")
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        if not notif_service.sendgrid_client:
            raise HTTPException(status_code=503, detail="Email service not configured")
        
        from sendgrid.helpers.mail import Mail, Email, To, TrackingSettings, OpenTracking, ClickTracking
        
        # Generate unique email ID for tracking
        email_id = str(uuid.uuid4())
        
        # Build email
        from_email = Email(config_doc.get('sendgrid_from_email', 'noreply@rosstaxpreparation.com'), "Ross Tax Preparation")
        to_email = To(request.to_email)
        
        # Use HTML content if provided, otherwise plain text
        html = request.html_content or request.body
        if html:
            mail = Mail(from_email, to_email, request.subject, html_content=html)
        elif request.message:
            mail = Mail(from_email, to_email, request.subject, plain_text_content=request.message)
        else:
            # Fallback: empty body not allowed, use subject as content
            mail = Mail(from_email, to_email, request.subject, plain_text_content=request.subject)
        
        # Enable tracking
        tracking_settings = TrackingSettings()
        tracking_settings.open_tracking = OpenTracking(enable=True)
        tracking_settings.click_tracking = ClickTracking(enable=True, enable_text=False)
        mail.tracking_settings = tracking_settings
        
        # Store email record for tracking
        email_record = {
            '_id': email_id,
            'to_email': request.to_email,
            'subject': request.subject,
            'category': 'general',
            'sent_by': current_user.get('email'),
            'sent_at': datetime.now(timezone.utc),
            'status': 'sent',
            'events': [],
            'opened': False,
            'opened_at': None,
            'open_count': 0,
            'clicked': False,
            'clicked_at': None,
            'click_count': 0,
            'links_clicked': [],
            'delivered': False,
            'delivered_at': None,
            'bounced': False,
            'bounce_reason': None,
            'spam_reported': False
        }
        await _db.email_tracking.insert_one(email_record)
        
        # Send email
        response = notif_service.sendgrid_client.send(mail)
        
        logging.info(f"📧 Email sent to {request.to_email} [ID: {email_id}] by {current_user.get('email')}")
        
        return {
            "success": True,
            "email_id": email_id,
            "status_code": response.status_code,
            "to": request.to_email
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== BIRTHDAY GREETINGS TRACKING ==================


# ================== APPOINTMENT PAYMENT / CHARGE ==================

class AppointmentChargeRequest(BaseModel):
    amount: float
    payment_type: str  # 'saved_card' | 'cash' | 'clover_pos'
    payment_method_id: Optional[str] = None  # for saved_card
    description: Optional[str] = None
    create_invoice: bool = True


@appointment_router.get('/admin/appointments/{appointment_id}/payment-info')
async def get_appointment_payment_info(
    appointment_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Get payment methods for the client associated with an appointment"""
    try:
        # Find the appointment
        appointment = None
        if len(appointment_id) == 24:
            try:
                appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
            except:
                pass
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        user_id = appointment.get('user_id', '')
        user_name = appointment.get('user_name', 'Cliente')
        service_name = appointment.get('service_name', 'Servicio')
        
        # Get saved payment methods for this user
        from dynamic_services import get_user_payment_methods
        payment_methods = await get_user_payment_methods(_db, user_id)
        
        # Check if there's an existing invoice for this appointment
        existing_invoice = await _db.invoices.find_one({
            'appointment_id': {'$in': [appointment_id, str(appointment.get('_id', ''))]}
        })
        
        return {
            'success': True,
            'appointment_id': appointment_id,
            'user_id': user_id,
            'user_name': user_name,
            'service_name': service_name,
            'payment_methods': payment_methods,
            'has_saved_cards': len([m for m in payment_methods if m.get('type') == 'card']) > 0,
            'has_invoice': existing_invoice is not None,
            'invoice_status': existing_invoice.get('status') if existing_invoice else None,
            'appointment_payment_method_id': appointment.get('payment_method_id'),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting payment info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@appointment_router.post('/admin/appointments/{appointment_id}/charge')
async def charge_appointment(
    appointment_id: str,
    charge: AppointmentChargeRequest,
    current_user: dict = Depends(_require_admin)
):
    """Charge a client for an appointment using saved card, cash, or Clover POS"""
    try:
        # Find the appointment
        appointment = None
        query_id = None
        if len(appointment_id) == 24:
            try:
                query_id = ObjectId(appointment_id)
                appointment = await _db.appointments.find_one({'_id': query_id})
            except:
                pass
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
            if appointment:
                query_id = appointment_id
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        user_id = appointment.get('user_id', '')
        user_name = appointment.get('user_name', 'Cliente')
        service_name = charge.description or appointment.get('service_name', 'Servicio')
        amount = charge.amount
        
        payment_result = {
            'success': True,
            'payment_type': charge.payment_type,
            'amount': amount,
            'transaction_id': None,
            'processor': charge.payment_type,
        }
        
        # ─── PROCESS PAYMENT BY TYPE ─────────────────────────────────
        if charge.payment_type == 'saved_card':
            if not charge.payment_method_id:
                raise HTTPException(status_code=400, detail='Se requiere payment_method_id para cobro con tarjeta')
            
            from dynamic_services import charge_saved_card
            order_id = f"APT-{appointment_id[:8]}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            result = await charge_saved_card(
                _db, 
                card_id=charge.payment_method_id, 
                amount=amount, 
                order_id=order_id, 
                description=f"{service_name} - {user_name}"
            )
            
            if not result.get('success'):
                raise HTTPException(status_code=400, detail=result.get('error', 'Error al procesar el cobro'))
            
            payment_result['transaction_id'] = result.get('payment_id')
            payment_result['card_last_4'] = result.get('card_last_4')
            payment_result['processor'] = 'nmi'
            
            logging.info(f"💳 Card charged ${amount:.2f} for appointment {appointment_id} - Card ****{result.get('card_last_4')}")
        
        elif charge.payment_type == 'clover_pos':
            # Register as Clover POS payment (processed externally on the Clover terminal)
            payment_result['processor'] = 'clover_pos'
            payment_result['transaction_id'] = f"CLOVER-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            logging.info(f"📱 Clover POS payment registered ${amount:.2f} for appointment {appointment_id}")
        
        elif charge.payment_type == 'cash':
            payment_result['processor'] = 'cash'
            payment_result['transaction_id'] = f"CASH-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            logging.info(f"💵 Cash payment registered ${amount:.2f} for appointment {appointment_id}")
        
        else:
            raise HTTPException(status_code=400, detail=f'Tipo de pago no válido: {charge.payment_type}')
        
        # ─── UPDATE APPOINTMENT WITH PAYMENT INFO ─────────────────────
        if query_id:
            await _db.appointments.update_one(
                {'_id': query_id},
                {'$set': {
                    'payment_status': 'paid',
                    'payment_type': charge.payment_type,
                    'payment_amount': amount,
                    'payment_transaction_id': payment_result.get('transaction_id'),
                    'payment_processor': payment_result.get('processor'),
                    'paid_at': datetime.now(timezone.utc),
                }}
            )
        
        # ─── CREATE INVOICE AUTOMATICALLY ─────────────────────────────
        invoice = None
        if charge.create_invoice:
            invoice_data = {
                'invoice_number': f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                'user_id': user_id,
                'user_name': user_name,
                'appointment_id': appointment_id,
                'service_name': service_name,
                'amount': amount,
                'status': 'paid',
                'payment_method': charge.payment_type,
                'payment_transaction_id': payment_result.get('transaction_id'),
                'payment_processor': payment_result.get('processor'),
                'created_by': current_user.get('email'),
                'created_at': datetime.now(timezone.utc),
                'paid_at': datetime.now(timezone.utc),
            }
            
            if charge.payment_type == 'saved_card':
                invoice_data['card_last_4'] = payment_result.get('card_last_4')
            
            result_insert = await _db.invoices.insert_one(invoice_data)
            invoice = {
                'id': str(result_insert.inserted_id),
                'invoice_number': invoice_data['invoice_number'],
            }
            
            logging.info(f"🧾 Invoice created: {invoice_data['invoice_number']} for ${amount:.2f}")
        
        return {
            'success': True,
            'message': f'Pago de ${amount:.2f} procesado exitosamente',
            'payment': payment_result,
            'invoice': invoice,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error charging appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
