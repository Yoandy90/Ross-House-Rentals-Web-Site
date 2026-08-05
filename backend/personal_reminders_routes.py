"""
Personal Reminders Module
Admin creates personal reminders with SMS + Email + Push notifications.
Background checker sends alerts when reminders are due.
All times are in America/Chicago (Dumas, Texas) timezone.
"""

import logging
import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Depends, Query, Header, BackgroundTasks
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/personal-reminders", tags=["Personal Reminders"])

# Dumas, Texas timezone (Central Time)
TEXAS_TZ = ZoneInfo("America/Chicago")

db = None

def set_db(database):
    global db
    db = database


def now_texas():
    """Get current time in Texas (Central Time)"""
    return datetime.now(TEXAS_TZ)


def to_texas(dt):
    """Convert a datetime to Texas timezone"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume naive datetimes from DB are in Texas time
        return dt.replace(tzinfo=TEXAS_TZ)
    return dt.astimezone(TEXAS_TZ)


def parse_texas_time(iso_str: str) -> datetime:
    """Parse an ISO string as Texas Central Time"""
    try:
        # If it has timezone info (Z or +offset), parse and convert to Texas
        if 'Z' in iso_str or '+' in iso_str or iso_str.count('-') > 2:
            dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
            return dt.astimezone(TEXAS_TZ)
        # Otherwise treat as naive Texas time
        dt = datetime.fromisoformat(iso_str)
        return dt.replace(tzinfo=TEXAS_TZ)
    except Exception:
        dt = datetime.fromisoformat(iso_str)
        return dt.replace(tzinfo=TEXAS_TZ)


# ==================== MODELS ====================

class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    remind_at: str  # ISO datetime string e.g. "2026-07-19T14:00:00"
    notify_sms: bool = True
    notify_email: bool = True
    notify_push: bool = True
    phone: Optional[str] = None  # Override phone for SMS
    email: Optional[str] = None  # Override email for notification
    repeat: Optional[str] = None  # none, daily, weekly, monthly
    priority: Optional[str] = "medium"  # low, medium, high
    category: Optional[str] = ""  # e.g., "llamada", "paquete", "reunión"


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    remind_at: Optional[str] = None
    notify_sms: Optional[bool] = None
    notify_email: Optional[bool] = None
    notify_push: Optional[bool] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    repeat: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None


# ==================== AUTH ====================

async def verify_admin(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization provided")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== NOTIFICATION HELPERS ====================

async def send_reminder_sms(phone: str, title: str, description: str):
    """Send SMS notification for a reminder via Twilio"""
    try:
        from twilio.rest import Client
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if not all([account_sid, auth_token, from_number]):
            logger.warning("Twilio credentials not configured, skipping SMS")
            return False
        
        client = Client(account_sid, auth_token)
        body = f"🔔 RECORDATORIO: {title}"
        if description:
            body += f"\n📝 {description}"
        
        message = client.messages.create(
            body=body,
            from_=from_number,
            to=phone
        )
        logger.info(f"SMS sent for reminder: {title} -> {phone} (SID: {message.sid})")
        return True
    except Exception as e:
        logger.error(f"Error sending SMS reminder: {e}")
        return False


async def send_reminder_email(to_email: str, title: str, description: str, remind_at: str):
    """Send email notification for a reminder via SendGrid"""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        
        api_key = os.getenv("SENDGRID_API_KEY")
        from_email = os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")
        
        if not api_key:
            logger.warning("SendGrid not configured, skipping email")
            return False
        
        # Format the date in Texas Central Time
        try:
            dt = datetime.fromisoformat(remind_at) if isinstance(remind_at, str) else remind_at
            # Convert to Texas time for display
            dt_texas = to_texas(dt)
            formatted_date = dt_texas.strftime("%A, %B %d, %Y at %I:%M %p") + " (Central Time)"
        except:
            formatted_date = str(remind_at)
        
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6C1110, #991b1b); color: white; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 8px;">🔔</div>
                <h1 style="margin: 0; font-size: 22px;">Recordatorio</h1>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
                <h2 style="color: #1f2937; margin-top: 0; font-size: 20px;">{title}</h2>
                {"<p style='color: #6b7280; font-size: 15px; line-height: 1.6;'>" + description + "</p>" if description else ""}
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin-top: 16px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        📅 <strong>Fecha programada:</strong> {formatted_date}
                    </p>
                </div>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
                    Ross Tax Preparation LLC • (806) 934-2018
                </p>
            </div>
        </div>
        """
        
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=f"🔔 Recordatorio: {title}",
            html_content=html
        )
        
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        logger.info(f"Email sent for reminder: {title} -> {to_email} (Status: {response.status_code})")
        return True
    except Exception as e:
        logger.error(f"Error sending email reminder: {e}")
        return False


async def send_reminder_push(admin_email: str, title: str, description: str):
    """Send push notification for a reminder to admin's mobile devices"""
    try:
        if db is None:
            logger.warning("DB not available for push notification")
            return False
        
        # Find admin user by email and get their push token
        admin_user = await db.users.find_one({"email": admin_email})
        if not admin_user:
            logger.warning(f"Admin user {admin_email} not found for push notification")
            return False
        
        push_token = admin_user.get('push_token') or admin_user.get('expo_push_token')
        if not push_token:
            logger.warning(f"Admin {admin_email} has no push token registered")
            return False
        
        # Use the push notification service
        from push_notification_service import PushNotificationService
        push_service = PushNotificationService()
        
        body = f"📝 {description}" if description else "Tienes un recordatorio pendiente"
        
        result = await push_service.send_push_notification(
            push_tokens=[push_token],
            title=f"🔔 {title}",
            body=body,
            data={
                "type": "personal_reminder",
                "title": title,
                "screen": "reminders",
            },
            sound="default",
            priority="high"
        )
        
        success = result.get("success", False)
        logger.info(f"Push notification for reminder '{title}' -> {admin_email}: {'✅' if success else '❌'} (sent: {result.get('sent_count', 0)})")
        return success
    except Exception as e:
        logger.error(f"Error sending push notification for reminder: {e}")
        return False


async def store_web_notification(admin_email: str, title: str, description: str, reminder_id: str):
    """Store a web notification in the admin_notifications collection for the bell icon"""
    try:
        if db is None:
            return False
        
        await db.admin_notifications.insert_one({
            "type": "reminder",
            "title": f"🔔 Recordatorio: {title}",
            "message": description or "Tienes un recordatorio pendiente",
            "icon": "🔔",
            "link": "/admin/recordatorios",
            "reminder_id": reminder_id,
            "read": False,
            "created_at": now_texas(),
            "target_email": admin_email,
        })
        logger.info(f"Web notification stored for reminder: {title}")
        return True
    except Exception as e:
        logger.error(f"Error storing web notification: {e}")
        return False


# ==================== ENDPOINTS ====================

@router.get("")
async def list_reminders(
    status: str = Query("all", description="all, pending, completed, overdue"),
    priority: str = Query("", description="low, medium, high"),
    search: str = Query("", description="Search in title/description"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin_user=Depends(verify_admin)
):
    """List personal reminders with filters"""
    query = {"deleted": {"$ne": True}}
    
    now = now_texas()
    
    if status == "pending":
        query["completed"] = {"$ne": True}
        query["remind_at"] = {"$gte": now}
    elif status == "completed":
        query["completed"] = True
    elif status == "overdue":
        query["completed"] = {"$ne": True}
        query["remind_at"] = {"$lt": now}
    
    if priority:
        query["priority"] = priority
    
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"title": search_regex},
            {"description": search_regex},
            {"category": search_regex},
        ]
    
    total = await db.personal_reminders.count_documents(query)
    skip = (page - 1) * limit
    
    records = await db.personal_reminders.find(query).sort("remind_at", 1).skip(skip).limit(limit).to_list(limit)
    
    # Count stats
    total_all = await db.personal_reminders.count_documents({"deleted": {"$ne": True}})
    total_pending = await db.personal_reminders.count_documents({"deleted": {"$ne": True}, "completed": {"$ne": True}, "remind_at": {"$gte": now}})
    total_overdue = await db.personal_reminders.count_documents({"deleted": {"$ne": True}, "completed": {"$ne": True}, "remind_at": {"$lt": now}})
    total_completed = await db.personal_reminders.count_documents({"deleted": {"$ne": True}, "completed": True})
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    total_today = await db.personal_reminders.count_documents({
        "deleted": {"$ne": True}, "completed": {"$ne": True},
        "remind_at": {"$gte": today_start, "$lt": today_end}
    })
    
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]
        if r.get("remind_at"):
            r["remind_at"] = r["remind_at"].isoformat()
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"):
            r["updated_at"] = r["updated_at"].isoformat()
        if r.get("notified_at"):
            r["notified_at"] = r["notified_at"].isoformat()
        if r.get("completed_at"):
            r["completed_at"] = r["completed_at"].isoformat()
        # Check if overdue - compare in Texas timezone
        remind_at_raw = r.get("remind_at")
        if isinstance(remind_at_raw, str):
            remind_at_cmp = parse_texas_time(remind_at_raw)
        elif remind_at_raw:
            remind_at_cmp = to_texas(remind_at_raw)
        else:
            remind_at_cmp = None
        r["is_overdue"] = remind_at_cmp < now if remind_at_cmp and not r.get("completed") else False
    
    return {
        "success": True,
        "reminders": records,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "stats": {
            "total": total_all,
            "pending": total_pending,
            "overdue": total_overdue,
            "completed": total_completed,
            "today": total_today,
        }
    }


@router.post("")
async def create_reminder(data: ReminderCreate, admin_user=Depends(verify_admin)):
    """Create a personal reminder"""
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="El título es requerido")
    
    try:
        remind_at = parse_texas_time(data.remind_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use ISO format: YYYY-MM-DDTHH:MM:SS")
    
    # Default phone/email to admin's info
    admin_phone = data.phone or admin_user.get("phone", "")
    admin_email = data.email or admin_user.get("email", "yoandyross@gmail.com")
    
    record = {
        "title": data.title.strip(),
        "description": (data.description or "").strip(),
        "remind_at": remind_at,
        "notify_sms": data.notify_sms,
        "notify_email": data.notify_email,
        "notify_push": data.notify_push,
        "phone": admin_phone,
        "email": admin_email,
        "repeat": data.repeat or "none",
        "priority": data.priority or "medium",
        "category": (data.category or "").strip(),
        "completed": False,
        "completed_at": None,
        "notified": False,
        "notified_at": None,
        "notification_results": {},
        "created_by": admin_user.get("email", "admin"),
        "created_at": now_texas(),
        "updated_at": now_texas(),
        "deleted": False,
    }
    
    result = await db.personal_reminders.insert_one(record)
    
    logger.info(f"Personal reminder created: '{data.title}' for {remind_at}")
    
    return {
        "success": True,
        "id": str(result.inserted_id),
        "message": f"Recordatorio creado para {remind_at.strftime('%d/%m/%Y %I:%M %p')}"
    }


@router.put("/{reminder_id}")
async def update_reminder(reminder_id: str, data: ReminderUpdate, admin_user=Depends(verify_admin)):
    """Update a personal reminder"""
    update_fields = {}
    
    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            if field == "remind_at":
                try:
                    update_fields["remind_at"] = parse_texas_time(value)
                    # Reset notification status if date changed
                    update_fields["notified"] = False
                    update_fields["notified_at"] = None
                except ValueError:
                    raise HTTPException(status_code=400, detail="Formato de fecha inválido")
            else:
                update_fields[field] = value.strip() if isinstance(value, str) else value
    
    if update_fields:
        update_fields["updated_at"] = now_texas()
        result = await db.personal_reminders.update_one(
            {"_id": ObjectId(reminder_id), "deleted": {"$ne": True}},
            {"$set": update_fields}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    return {"success": True, "message": "Recordatorio actualizado"}


@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, admin_user=Depends(verify_admin)):
    """Soft delete a reminder"""
    result = await db.personal_reminders.update_one(
        {"_id": ObjectId(reminder_id)},
        {"$set": {"deleted": True, "updated_at": now_texas()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    return {"success": True, "message": "Recordatorio eliminado"}


@router.post("/{reminder_id}/complete")
async def complete_reminder(reminder_id: str, admin_user=Depends(verify_admin)):
    """Mark a reminder as completed"""
    result = await db.personal_reminders.update_one(
        {"_id": ObjectId(reminder_id), "deleted": {"$ne": True}},
        {"$set": {
            "completed": True,
            "completed_at": now_texas(),
            "updated_at": now_texas(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    return {"success": True, "message": "Recordatorio completado ✅"}


@router.post("/{reminder_id}/uncomplete")
async def uncomplete_reminder(reminder_id: str, admin_user=Depends(verify_admin)):
    """Mark a completed reminder back to pending"""
    result = await db.personal_reminders.update_one(
        {"_id": ObjectId(reminder_id), "deleted": {"$ne": True}},
        {"$set": {
            "completed": False,
            "completed_at": None,
            "updated_at": now_texas(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    return {"success": True, "message": "Recordatorio reactivado"}


@router.post("/{reminder_id}/snooze")
async def snooze_reminder(
    reminder_id: str,
    minutes: int = Query(15, description="Minutes to snooze"),
    admin_user=Depends(verify_admin)
):
    """Snooze a reminder by X minutes"""
    reminder = await db.personal_reminders.find_one({"_id": ObjectId(reminder_id), "deleted": {"$ne": True}})
    if not reminder:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    
    new_time = now_texas() + timedelta(minutes=minutes)
    
    await db.personal_reminders.update_one(
        {"_id": ObjectId(reminder_id)},
        {"$set": {
            "remind_at": new_time,
            "notified": False,
            "notified_at": None,
            "updated_at": now_texas(),
        }}
    )
    
    return {
        "success": True,
        "message": f"Recordatorio pospuesto {minutes} minutos",
        "new_time": new_time.isoformat()
    }


@router.post("/check-due")
async def check_due_reminders(admin_user=Depends(verify_admin)):
    """Manually trigger checking and sending due reminders"""
    results = await _process_due_reminders()
    return results


@router.get("/due-count")
async def get_due_count(admin_user=Depends(verify_admin)):
    """Get count of overdue + today's reminders for header badge"""
    now = now_texas()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    overdue = await db.personal_reminders.count_documents({
        "deleted": {"$ne": True}, "completed": {"$ne": True},
        "remind_at": {"$lt": now}
    })
    today = await db.personal_reminders.count_documents({
        "deleted": {"$ne": True}, "completed": {"$ne": True},
        "remind_at": {"$gte": today_start, "$lt": today_end}
    })
    
    # Get next upcoming reminder
    next_reminder = await db.personal_reminders.find_one(
        {"deleted": {"$ne": True}, "completed": {"$ne": True}, "remind_at": {"$gte": now}},
        sort=[("remind_at", 1)]
    )
    next_title = next_reminder.get("title", "") if next_reminder else ""
    next_at = next_reminder.get("remind_at", "").isoformat() if next_reminder and next_reminder.get("remind_at") else ""
    
    return {
        "overdue": overdue,
        "today": today,
        "badge": overdue + today,
        "next_title": next_title,
        "next_at": next_at,
    }


# ==================== BACKGROUND PROCESSOR ====================

async def _process_due_reminders():
    """Check for due reminders and send notifications"""
    if db is None:
        return {"checked": 0, "sent": 0}
    
    now = now_texas()
    # Look for reminders due in the last 5 minutes up to now
    window_start = now - timedelta(minutes=5)
    
    query = {
        "deleted": {"$ne": True},
        "completed": {"$ne": True},
        "notified": {"$ne": True},
        "remind_at": {"$lte": now, "$gte": window_start},
    }
    
    due_reminders = await db.personal_reminders.find(query).to_list(100)
    
    sent_count = 0
    for reminder in due_reminders:
        sms_ok = False
        email_ok = False
        push_ok = False
        web_ok = False
        
        title = reminder.get("title", "Recordatorio")
        description = reminder.get("description", "")
        remind_at = reminder.get("remind_at", "")
        admin_email = reminder.get("email", "yoandyross@gmail.com")
        
        if reminder.get("notify_sms") and reminder.get("phone"):
            sms_ok = await send_reminder_sms(reminder["phone"], title, description)
        
        if reminder.get("notify_email") and reminder.get("email"):
            email_ok = await send_reminder_email(reminder["email"], title, description, str(remind_at))
        
        if reminder.get("notify_push", True):
            push_ok = await send_reminder_push(admin_email, title, description)
        
        # Always store web notification for the bell icon
        web_ok = await store_web_notification(admin_email, title, description, str(reminder["_id"]))
        
        # Mark as notified
        await db.personal_reminders.update_one(
            {"_id": reminder["_id"]},
            {"$set": {
                "notified": True,
                "notified_at": now,
                "notification_results": {
                    "sms_sent": sms_ok,
                    "email_sent": email_ok,
                    "push_sent": push_ok,
                    "web_stored": web_ok,
                    "processed_at": now.isoformat(),
                }
            }}
        )
        
        # Handle repeating reminders
        repeat = reminder.get("repeat", "none")
        if repeat and repeat != "none":
            next_time = None
            if repeat == "daily":
                next_time = reminder["remind_at"] + timedelta(days=1)
            elif repeat == "weekly":
                next_time = reminder["remind_at"] + timedelta(weeks=1)
            elif repeat == "monthly":
                next_time = reminder["remind_at"] + timedelta(days=30)
            
            if next_time:
                new_reminder = {k: v for k, v in reminder.items() if k != "_id"}
                new_reminder["remind_at"] = next_time
                new_reminder["notified"] = False
                new_reminder["notified_at"] = None
                new_reminder["completed"] = False
                new_reminder["completed_at"] = None
                new_reminder["created_at"] = now
                new_reminder["updated_at"] = now
                await db.personal_reminders.insert_one(new_reminder)
                logger.info(f"Created next occurrence for repeating reminder: {title} at {next_time}")
        
        sent_count += 1
        logger.info(f"Processed reminder: {title} (SMS: {sms_ok}, Email: {email_ok}, Push: {push_ok}, Web: {web_ok})")
    
    return {
        "success": True,
        "checked": len(due_reminders),
        "sent": sent_count,
        "timestamp": now.isoformat()
    }


async def reminder_background_loop():
    """Background loop that checks for due reminders every 60 seconds"""
    while True:
        try:
            if db is not None:
                results = await _process_due_reminders()
                if results.get("sent", 0) > 0:
                    logger.info(f"Reminder check: {results['sent']} notifications sent")
        except Exception as e:
            logger.error(f"Error in reminder background loop: {e}")
        await asyncio.sleep(60)  # Check every minute
