"""
Mi Caso USA - Admin API Routes
Provides admin-only endpoints for the Mi Caso USA administration panel.
All endpoints require admin authentication.

Modules:
- Dashboard Stats (filtered for immigration users only)
- Users Management
- Cases Management
- API Usage
- Push Notifications
- App Stats (downloads, subscriptions, active users)
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from typing import Optional
import logging
import asyncio

# Collection name for Mi Caso USA users (independent from Ross Tax)
IMM_USERS = "immigration_users"

router = APIRouter(prefix="/immigration/admin", tags=["Immigration-Admin"])

_db = None

def set_immigration_admin_db(db):
    global _db
    _db = db


async def require_admin(request: Request) -> str:
    """Verify request comes from an admin user."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    
    token = auth_header.replace("Bearer ", "")
    
    session = await _db["user_sessions"].find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Sesión expirada")
    
    user_id = session["user_id"]
    try:
        user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await _db[IMM_USERS].find_one({"_id": user_id})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado: se requiere rol admin")
    
    return str(user["_id"])


def _immigration_user_filter():
    """Filter to get only Mi Caso USA users (not Ross Tax)."""
    return {
        "$or": [
            {"has_app": True},
            {"source": "micasousa"},
            {"source": "immigration"},
            {"push_tokens": {"$exists": True, "$ne": []}},
        ]
    }


# ═══════════════════════════════════════════════════════════════
# DASHBOARD STATS
# ═══════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_dashboard_stats(request: Request):
    """Get overview statistics for the admin dashboard."""
    await require_admin(request)
    
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)
    
    # immigration_users collection = only Mi Caso USA clients
    total_users = await _db[IMM_USERS].count_documents({})
    
    users_last_7d = await _db[IMM_USERS].count_documents({"created_at": {"$gte": last_7d}})
    users_last_30d = await _db[IMM_USERS].count_documents({"created_at": {"$gte": last_30d}})
    
    # Immigration cases
    total_cases = await _db["immigration_cases"].count_documents({"status": {"$ne": "archived"}})
    cases_uscis = await _db["immigration_cases"].count_documents({"case_type": "uscis", "status": {"$ne": "archived"}})
    cases_eoir = await _db["immigration_cases"].count_documents({"case_type": "eoir", "status": {"$ne": "archived"}})
    cases_last_7d = await _db["immigration_cases"].count_documents({"created_at": {"$gte": last_7d}})
    
    # Case statuses breakdown
    status_pipeline = [
        {"$match": {"status": {"$ne": "archived"}}},
        {"$group": {"_id": "$current_status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    status_breakdown = []
    async for doc in _db["immigration_cases"].aggregate(status_pipeline):
        status_breakdown.append({"status": doc["_id"] or "Unknown", "count": doc["count"]})
    
    # API usage (check logs)
    api_checks_24h = await _db["immigration_cases"].count_documents({"last_checked": {"$gte": last_24h}})
    
    # Subscriptions
    active_subs = 0
    collections = await _db.list_collection_names()
    if "user_subscriptions" in collections:
        active_subs = await _db["user_subscriptions"].count_documents({
            "status": "active",
            "expires_at": {"$gte": now}
        })
    
    return {
        "success": True,
        "stats": {
            "users": {
                "total": total_users,
                "new_last_7d": users_last_7d,
                "new_last_30d": users_last_30d,
            },
            "cases": {
                "total": total_cases,
                "uscis": cases_uscis,
                "eoir": cases_eoir,
                "new_last_7d": cases_last_7d,
                "status_breakdown": status_breakdown,
            },
            "api": {
                "checks_last_24h": api_checks_24h,
            },
            "subscriptions": {
                "active": active_subs,
            },
        }
    }


# ═══════════════════════════════════════════════════════════════
# APP STATS - Downloads, Active Users, Subscriptions
# ═══════════════════════════════════════════════════════════════

@router.get("/app-stats")
async def get_app_stats(request: Request):
    """Get detailed app usage statistics."""
    await require_admin(request)
    
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)
    
    # Users who have the app installed (has push token or has_app flag)
    downloads = await _db[IMM_USERS].count_documents({
        "$or": [
            {"has_app": True},
            {"push_token": {"$exists": True, "$ne": None, "$ne": ""}},
            {"expo_push_token": {"$exists": True, "$ne": None, "$ne": ""}},
            {"push_tokens": {"$exists": True, "$ne": []}},
        ]
    })
    
    # Active users (accessed in last 7 days)
    active_7d = await _db[IMM_USERS].count_documents({
        "$and": [
            {"$or": [
                {"has_app": True},
                {"push_token": {"$exists": True, "$ne": None, "$ne": ""}},
                {"push_tokens": {"$exists": True, "$ne": []}},
            ]},
            {"$or": [
                {"last_app_access": {"$gte": last_7d.isoformat()}},
                {"last_login": {"$gte": last_7d}},
            ]}
        ]
    })
    
    # Active in last 30 days
    active_30d = await _db[IMM_USERS].count_documents({
        "$and": [
            {"$or": [
                {"has_app": True},
                {"push_token": {"$exists": True, "$ne": None, "$ne": ""}},
                {"push_tokens": {"$exists": True, "$ne": []}},
            ]},
            {"$or": [
                {"last_app_access": {"$gte": last_30d.isoformat()}},
                {"last_login": {"$gte": last_30d}},
            ]}
        ]
    })
    
    # Subscription breakdown
    collections = await _db.list_collection_names()
    free_users = downloads
    premium_users = 0
    subscription_breakdown = []
    
    if "user_subscriptions" in collections:
        premium_users = await _db["user_subscriptions"].count_documents({
            "status": "active",
            "expires_at": {"$gte": now}
        })
        free_users = max(0, downloads - premium_users)
        
        # Breakdown by plan
        plan_pipeline = [
            {"$match": {"status": "active", "expires_at": {"$gte": now}}},
            {"$group": {"_id": "$plan_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        async for doc in _db["user_subscriptions"].aggregate(plan_pipeline):
            subscription_breakdown.append({
                "plan": doc["_id"] or "Unknown",
                "count": doc["count"]
            })
    
    # Users with push notifications enabled
    push_enabled = await _db[IMM_USERS].count_documents({
        "$or": [
            {"push_token": {"$exists": True, "$ne": None, "$ne": ""}},
            {"expo_push_token": {"$exists": True, "$ne": None, "$ne": ""}},
            {"push_tokens": {"$exists": True, "$ne": []}},
        ]
    })
    
    # Registration trend (last 30 days)
    reg_pipeline = [
        {"$match": {
            "created_at": {"$gte": last_30d},
            "$or": [{"has_app": True}, {"source": "micasousa"}]
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    registration_trend = []
    try:
        async for doc in _db[IMM_USERS].aggregate(reg_pipeline):
            registration_trend.append({"date": doc["_id"], "registrations": doc["count"]})
    except Exception:
        pass
    
    return {
        "success": True,
        "app_stats": {
            "downloads": downloads,
            "active_7d": active_7d,
            "active_30d": active_30d,
            "free_users": free_users,
            "premium_users": premium_users,
            "push_enabled": push_enabled,
            "subscription_breakdown": subscription_breakdown,
            "registration_trend": registration_trend,
        }
    }



@router.get("/app-users")
async def get_app_users(request: Request):
    """Get list of users who have the app installed."""
    await require_admin(request)
    
    now = datetime.utcnow()
    
    # Get all users (they all downloaded the app to register)
    users_cursor = _db[IMM_USERS].find({}).sort("created_at", -1)
    users = await users_cursor.to_list(1000)
    
    # Get active subscriptions for quick lookup
    collections = await _db.list_collection_names()
    subscribed_user_ids = set()
    if "user_subscriptions" in collections:
        subs = await _db["user_subscriptions"].find({
            "status": "active",
            "$or": [
                {"expires_at": None},
                {"expires_at": {"$exists": False}},
                {"expires_at": {"$gte": now}}
            ]
        }).to_list(10000)
        subscribed_user_ids = {s.get("user_id") for s in subs}
    
    result = []
    for u in users:
        uid = str(u.get("_id", ""))
        has_push = bool(u.get("expo_push_token") and u.get("push_token_source") == "mi-caso-usa")
        
        last_login = u.get("last_login")
        if isinstance(last_login, datetime):
            last_login = last_login.isoformat()
        elif last_login is None:
            last_login = ""
        
        created_at = u.get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        elif created_at is None:
            created_at = ""
        
        result.append({
            "id": uid,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "phone": u.get("phone", ""),
            "platform": u.get("push_platform", ""),
            "has_push_token": has_push,
            "is_subscribed": uid in subscribed_user_ids,
            "last_login": str(last_login),
            "created_at": str(created_at),
            "push_token_source": u.get("push_token_source", ""),
        })
    
    return {"success": True, "users": result, "total": len(result)}



# ═══════════════════════════════════════════════════════════════
# PUSH NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════

@router.post("/push/send")
async def send_push_notification(request: Request):
    """Send push notification to users."""
    await require_admin(request)
    
    body = await request.json()
    title = body.get("title", "").strip()
    message = body.get("message", "").strip()
    target = body.get("target", "all")  # "all", "subscribers", "free", "specific"
    user_ids = body.get("user_ids", [])  # For "specific" target
    
    if not title or not message:
        raise HTTPException(status_code=400, detail="Título y mensaje son requeridos")
    
    # Build query - ONLY use expo_push_token from Mi Caso USA app
    token_filter = {
        "expo_push_token": {"$exists": True, "$nin": [None, ""]},
        "push_token_source": "mi-caso-usa",
    }
    
    if target == "specific" and user_ids:
        query = {
            "_id": {"$in": [ObjectId(uid) for uid in user_ids]},
            **token_filter
        }
    elif target == "subscribers":
        # Get active subscriber user_ids
        collections = await _db.list_collection_names()
        sub_user_ids = []
        if "user_subscriptions" in collections:
            subs = await _db["user_subscriptions"].find({
                "status": "active",
                "expires_at": {"$gte": datetime.utcnow()}
            }).to_list(10000)
            sub_user_ids = [s.get("user_id") for s in subs if s.get("user_id")]
        
        query = {
            "$and": [
                token_filter,
                {"_id": {"$in": [ObjectId(uid) for uid in sub_user_ids]}}
            ]
        }
    elif target == "free":
        # Users without active subscription
        collections = await _db.list_collection_names()
        sub_user_ids = []
        if "user_subscriptions" in collections:
            subs = await _db["user_subscriptions"].find({
                "status": "active",
                "expires_at": {"$gte": datetime.utcnow()}
            }).to_list(10000)
            sub_user_ids = [s.get("user_id") for s in subs if s.get("user_id")]
        
        query = {
            "$and": [
                token_filter,
                {"_id": {"$nin": [ObjectId(uid) for uid in sub_user_ids]}}
            ]
        }
    else:  # "all"
        query = token_filter
    
    # Get all matching users and their tokens
    users = await _db[IMM_USERS].find(query).to_list(10000)
    
    # ONLY use expo_push_token (Mi Caso USA specific token)
    push_tokens = []
    for user in users:
        token = user.get("expo_push_token")
        if token and isinstance(token, str) and len(token) > 10:
            push_tokens.append(token)
    
    # Deduplicate
    push_tokens = list(set(push_tokens))
    
    if not push_tokens:
        return {
            "success": False,
            "message": "No se encontraron usuarios con notificaciones habilitadas",
            "sent_count": 0,
            "target_count": len(users),
        }
    
    # Send via push service
    try:
        from push_notification_service import get_push_service
        push_service = get_push_service()
        result = await push_service.send_push_notification(
            push_tokens=push_tokens,
            title=title,
            body=message,
            data={"type": "admin_broadcast", "title": title}
        )
        
        # Log the notification
        await _db["push_notifications_log"].insert_one({
            "title": title,
            "message": message,
            "target": target,
            "tokens_sent": len(push_tokens),
            "sent_count": result.get("sent_count", 0),
            "failed_count": result.get("failed_count", 0),
            "sent_at": datetime.utcnow(),
            "sent_by": "admin",
        })
        
        return {
            "success": result.get("success", False),
            "sent_count": result.get("sent_count", 0),
            "failed_count": result.get("failed_count", 0),
            "target_count": len(push_tokens),
            "message": f"Notificación enviada a {result.get('sent_count', 0)} dispositivos",
        }
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return {
            "success": False,
            "error": str(e),
            "sent_count": 0,
            "target_count": len(push_tokens),
        }


@router.get("/push/history")
async def get_push_history(request: Request):
    """Get push notification history."""
    await require_admin(request)
    
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 20))
    skip = (page - 1) * limit
    
    collections = await _db.list_collection_names()
    if "push_notifications_log" not in collections:
        return {"success": True, "notifications": [], "total": 0, "page": 1, "pages": 1}
    
    total = await _db["push_notifications_log"].count_documents({})
    
    notifications = []
    cursor = _db["push_notifications_log"].find({}).sort("sent_at", -1).skip(skip).limit(limit)
    async for doc in cursor:
        notifications.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "message": doc.get("message", ""),
            "target": doc.get("target", "all"),
            "sent_count": doc.get("sent_count", 0),
            "failed_count": doc.get("failed_count", 0),
            "tokens_sent": doc.get("tokens_sent", 0),
            "sent_at": doc.get("sent_at", "").isoformat() if isinstance(doc.get("sent_at"), datetime) else str(doc.get("sent_at", "")),
        })
    
    return {
        "success": True,
        "notifications": notifications,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


# ═══════════════════════════════════════════════════════════════
# SMS MESSAGING
# ═══════════════════════════════════════════════════════════════

@router.post("/sms/send")
async def send_sms_message(request: Request):
    """Send SMS to users via Twilio."""
    await require_admin(request)
    
    body = await request.json()
    message = body.get("message", "").strip()
    target = body.get("target", "all")  # "all", "subscribers", "free", "specific"
    user_ids = body.get("user_ids", [])
    
    if not message:
        raise HTTPException(status_code=400, detail="Mensaje es requerido")
    
    if len(message) > 160:
        raise HTTPException(status_code=400, detail="SMS no puede exceder 160 caracteres")
    
    # Get Twilio credentials
    import os
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_PHONE_NUMBER", "")
    
    if not account_sid or not auth_token or not from_number:
        raise HTTPException(status_code=500, detail="Credenciales de Twilio no configuradas")
    
    # Build query based on target
    phone_filter = {"phone": {"$exists": True, "$ne": None, "$ne": ""}}
    
    if target == "specific" and user_ids:
        query = {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}, **phone_filter}
    elif target == "subscribers":
        sub_user_ids = []
        collections = await _db.list_collection_names()
        if "user_subscriptions" in collections:
            subs = await _db["user_subscriptions"].find({
                "status": "active",
                "expires_at": {"$gte": datetime.utcnow()}
            }).to_list(10000)
            sub_user_ids = [s.get("user_id") for s in subs if s.get("user_id")]
        query = {"$and": [phone_filter, {"_id": {"$in": [ObjectId(uid) for uid in sub_user_ids]}}]}
    elif target == "free":
        sub_user_ids = []
        collections = await _db.list_collection_names()
        if "user_subscriptions" in collections:
            subs = await _db["user_subscriptions"].find({
                "status": "active",
                "expires_at": {"$gte": datetime.utcnow()}
            }).to_list(10000)
            sub_user_ids = [s.get("user_id") for s in subs if s.get("user_id")]
        query = {"$and": [phone_filter, {"_id": {"$nin": [ObjectId(uid) for uid in sub_user_ids]}}]}
    else:  # "all"
        query = phone_filter
    
    users = await _db[IMM_USERS].find(query).to_list(10000)
    phone_numbers = [u.get("phone") for u in users if u.get("phone")]
    
    if not phone_numbers:
        return {
            "success": False,
            "message": "No se encontraron usuarios con número de teléfono",
            "sent_count": 0,
            "target_count": 0,
        }
    
    # Send SMS via Twilio
    try:
        from sms_service import get_sms_service
        sms_service = get_sms_service(account_sid, auth_token, from_number)
        result = await sms_service.send_bulk_sms(phone_numbers, message)
        
        # Log the SMS campaign
        await _db["sms_log"].insert_one({
            "message": message,
            "target": target,
            "phones_sent": len(phone_numbers),
            "sent_count": result.get("success_count", 0),
            "failed_count": result.get("failed_count", 0),
            "sent_at": datetime.utcnow(),
            "sent_by": "admin",
        })
        
        return {
            "success": result.get("success_count", 0) > 0,
            "sent_count": result.get("success_count", 0),
            "failed_count": result.get("failed_count", 0),
            "target_count": len(phone_numbers),
            "message": f"SMS enviado a {result.get('success_count', 0)} destinatarios",
        }
    except Exception as e:
        logger.error(f"Error sending SMS: {e}")
        return {"success": False, "error": str(e), "sent_count": 0}


@router.get("/sms/history")
async def get_sms_history(request: Request):
    """Get SMS campaign history."""
    await require_admin(request)
    
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 20))
    skip = (page - 1) * limit
    
    collections = await _db.list_collection_names()
    if "sms_log" not in collections:
        return {"success": True, "messages": [], "total": 0}
    
    total = await _db["sms_log"].count_documents({})
    messages = []
    cursor = _db["sms_log"].find({}).sort("sent_at", -1).skip(skip).limit(limit)
    async for doc in cursor:
        messages.append({
            "id": str(doc["_id"]),
            "message": doc.get("message", ""),
            "target": doc.get("target", "all"),
            "sent_count": doc.get("sent_count", 0),
            "failed_count": doc.get("failed_count", 0),
            "phones_sent": doc.get("phones_sent", 0),
            "sent_at": doc.get("sent_at", "").isoformat() if isinstance(doc.get("sent_at"), datetime) else str(doc.get("sent_at", "")),
        })
    
    return {"success": True, "messages": messages, "total": total}


@router.get("/sms/stats")
async def get_sms_stats(request: Request):
    """Get SMS stats - users with phone numbers."""
    await require_admin(request)
    
    total_with_phone = await _db[IMM_USERS].count_documents({
        "phone": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    total_users = await _db[IMM_USERS].count_documents({})
    
    # Count SMS sent this month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    collections = await _db.list_collection_names()
    sms_this_month = 0
    if "sms_log" in collections:
        pipeline = [
            {"$match": {"sent_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$sent_count"}}}
        ]
        async for doc in _db["sms_log"].aggregate(pipeline):
            sms_this_month = doc.get("total", 0)
    
    return {
        "success": True,
        "total_with_phone": total_with_phone,
        "total_users": total_users,
        "sms_this_month": sms_this_month,
    }


# ═══════════════════════════════════════════════════════════════
# USCIS SANDBOX TRAFFIC MONITORING
# ═══════════════════════════════════════════════════════════════

@router.get("/uscis-traffic/logs")
async def get_uscis_traffic_logs(request: Request):
    """Get USCIS sandbox traffic generation logs."""
    await require_admin(request)
    
    collections = await _db.list_collection_names()
    if "uscis_sandbox_traffic_log" not in collections:
        return {"success": True, "logs": [], "total": 0, "days_completed": 0, "requirement_met": False}
    
    # Get all logs sorted by timestamp
    logs = []
    cursor = _db["uscis_sandbox_traffic_log"].find({}).sort("timestamp", -1).limit(100)
    async for doc in cursor:
        logs.append({
            "id": str(doc["_id"]),
            "timestamp": doc.get("timestamp", ""),
            "oauth_success": doc.get("oauth_success", False),
            "total_requests": doc.get("total_requests", 0),
            "success_200": doc.get("success_200", 0),
            "errors_4xx": doc.get("errors_4xx", 0),
            "errors_503": doc.get("errors_503", 0),
            "rate_limited": doc.get("rate_limited", 0),
            "other_errors": doc.get("other_errors", 0),
        })
    
    # Calculate how many unique calendar days have traffic
    all_logs = await _db["uscis_sandbox_traffic_log"].find({}).to_list(10000)
    unique_days = set()
    successful_days = set()
    for log in all_logs:
        ts = log.get("timestamp", "")
        if ts:
            try:
                day = ts[:10]  # YYYY-MM-DD
                unique_days.add(day)
                # A day counts as "successful" if we got at least 1 OAuth success
                if log.get("oauth_success"):
                    successful_days.add(day)
            except:
                pass
    
    # Check if we have successful traffic on 5+ consecutive days
    days_with_traffic = len(successful_days)
    consecutive_days = _count_consecutive_days(sorted(successful_days))
    requirement_met = consecutive_days >= 5
    
    return {
        "success": True,
        "logs": logs,
        "total": len(all_logs),
        "days_with_traffic": days_with_traffic,
        "consecutive_days": consecutive_days,
        "requirement_met": requirement_met,
        "unique_days": sorted(list(successful_days), reverse=True),
    }


def _count_consecutive_days(sorted_days):
    """Count the maximum number of consecutive days."""
    if not sorted_days:
        return 0
    
    from datetime import timedelta
    max_streak = 1
    current_streak = 1
    
    for i in range(1, len(sorted_days)):
        try:
            prev = datetime.strptime(sorted_days[i-1], "%Y-%m-%d")
            curr = datetime.strptime(sorted_days[i], "%Y-%m-%d")
            if (curr - prev).days == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1
        except:
            current_streak = 1
    
    return max_streak


@router.post("/uscis-traffic/run-now")
async def trigger_uscis_traffic(request: Request):
    """Manually trigger a USCIS sandbox traffic generation run."""
    await require_admin(request)
    
    try:
        from uscis_sandbox_traffic import generate_uscis_sandbox_traffic
        # Run in background to avoid timeout
        asyncio.create_task(generate_uscis_sandbox_traffic())
        return {
            "success": True,
            "message": "Ejecución iniciada en segundo plano. Actualiza en 30 segundos para ver el resultado."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


# ═══════════════════════════════════════════════════════════════
# USERS MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.get("/users")
async def list_admin_users(request: Request):
    """List only Mi Caso USA users (immigration) with pagination and search."""
    await require_admin(request)
    
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 25))
    search = request.query_params.get("search", "").strip()
    sort_by = request.query_params.get("sort", "created_at")
    sort_dir = int(request.query_params.get("dir", -1))
    
    # immigration_users collection already contains only Mi Caso USA clients
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]}
    else:
        query = {}
    
    total = await _db[IMM_USERS].count_documents(query)
    skip = (page - 1) * limit
    
    users = []
    cursor = _db[IMM_USERS].find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
    async for u in cursor:
        case_count = await _db["immigration_cases"].count_documents({
            "user_id": str(u["_id"]),
            "status": {"$ne": "archived"}
        })
        
        has_push = bool(u.get("push_token") or u.get("expo_push_token") or u.get("push_tokens"))
        
        users.append({
            "id": str(u["_id"]),
            "name": u.get("name") or u.get("first_name", ""),
            "email": u.get("email", ""),
            "phone": u.get("phone", ""),
            "role": u.get("role", "client"),
            "created_at": u.get("created_at", "").isoformat() if isinstance(u.get("created_at"), datetime) else str(u.get("created_at", "")),
            "last_login": u.get("last_login", "").isoformat() if isinstance(u.get("last_login"), datetime) else "",
            "case_count": case_count,
            "has_push": has_push,
            "has_subscription": u.get("subscription_status") == "active",
        })
    
    return {
        "success": True,
        "users": users,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, request: Request):
    """Get detailed user information including their cases."""
    await require_admin(request)
    
    user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    cases = []
    cursor = _db["immigration_cases"].find({
        "user_id": user_id,
        "status": {"$ne": "archived"}
    }).sort("created_at", -1)
    async for c in cursor:
        cases.append({
            "id": str(c["_id"]),
            "case_type": c.get("case_type", "uscis"),
            "case_number": c.get("case_number", ""),
            "display_number": c.get("display_number", c.get("case_number", "")),
            "current_status": c.get("current_status", ""),
            "nickname": c.get("nickname", ""),
            "form_type": c.get("form_type", ""),
            "created_at": c.get("created_at", "").isoformat() if isinstance(c.get("created_at"), datetime) else "",
            "last_checked": c.get("last_checked", "").isoformat() if isinstance(c.get("last_checked"), datetime) else "",
            "history_count": len(c.get("history", [])),
        })
    
    return {
        "success": True,
        "user": {
            "id": str(user["_id"]),
            "name": user.get("name") or user.get("first_name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "role": user.get("role", "client"),
            "created_at": user.get("created_at", "").isoformat() if isinstance(user.get("created_at"), datetime) else "",
        },
        "cases": cases,
    }


# ═══════════════════════════════════════════════════════════════
# USER CRUD (Create, Update, Delete)
# ═══════════════════════════════════════════════════════════════

@router.post("/users")
async def create_user(request: Request):
    """Create a new user from admin panel."""
    await require_admin(request)
    
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    phone = body.get("phone", "").strip()
    role = body.get("role", "client")
    
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es requerido")
    if not phone and not email:
        raise HTTPException(status_code=400, detail="Se requiere al menos email o teléfono")
    
    # Check duplicate
    dup_filter = []
    if email:
        dup_filter.append({"email": email})
    if phone:
        dup_filter.append({"phone": phone})
    
    if dup_filter:
        existing = await _db[IMM_USERS].find_one({"$or": dup_filter})
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email o teléfono")
    
    now = datetime.now(timezone.utc)
    user_doc = {
        "name": name,
        "email": email,
        "phone": phone,
        "role": role,
        "source": "micasousa",
        "has_app": False,
        "created_at": now,
        "updated_at": now,
    }
    
    result = await _db[IMM_USERS].insert_one(user_doc)
    
    return {
        "success": True,
        "message": "Usuario creado exitosamente",
        "user_id": str(result.inserted_id),
    }


@router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request):
    """Update an existing user."""
    await require_admin(request)
    
    try:
        user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await _db[IMM_USERS].find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    uid = user["_id"]
    body = await request.json()
    update_fields = {}
    
    if "name" in body:
        update_fields["name"] = body["name"].strip()
    if "email" in body:
        new_email = body["email"].strip()
        if new_email and new_email != user.get("email"):
            existing = await _db[IMM_USERS].find_one({"email": new_email, "_id": {"$ne": uid}})
            if existing:
                raise HTTPException(status_code=409, detail="Ese email ya está en uso por otro usuario")
        update_fields["email"] = new_email
    if "phone" in body:
        new_phone = body["phone"].strip()
        if new_phone and new_phone != user.get("phone"):
            existing = await _db[IMM_USERS].find_one({"phone": new_phone, "_id": {"$ne": uid}})
            if existing:
                raise HTTPException(status_code=409, detail="Ese teléfono ya está en uso por otro usuario")
        update_fields["phone"] = new_phone
    if "role" in body:
        update_fields["role"] = body["role"]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")
    
    update_fields["updated_at"] = datetime.now(timezone.utc)
    
    await _db[IMM_USERS].update_one(
        {"_id": uid},
        {"$set": update_fields}
    )
    
    return {"success": True, "message": "Usuario actualizado exitosamente"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (soft: archives their cases, removes from DB)."""
    await require_admin(request)
    
    try:
        user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await _db[IMM_USERS].find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="No se puede eliminar un administrador")
    
    uid = user["_id"]
    
    # Archive user's cases
    await _db["immigration_cases"].update_many(
        {"user_id": str(uid)},
        {"$set": {"status": "archived", "archived_at": datetime.now(timezone.utc)}}
    )
    
    # Delete user
    await _db[IMM_USERS].delete_one({"_id": uid})
    
    # Clean sessions
    await _db["user_sessions"].delete_many({"user_id": str(uid)})
    
    return {"success": True, "message": "Usuario eliminado exitosamente"}


# ═══════════════════════════════════════════════════════════════
# CASES MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.get("/cases")
async def list_admin_cases(request: Request):
    """List all immigration cases with filters."""
    await require_admin(request)
    
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 25))
    search = request.query_params.get("search", "").strip()
    case_type = request.query_params.get("type", "")
    status_filter = request.query_params.get("status", "")
    
    query = {"status": {"$ne": "archived"}}
    
    if search:
        query["$or"] = [
            {"case_number": {"$regex": search, "$options": "i"}},
            {"display_number": {"$regex": search, "$options": "i"}},
            {"nickname": {"$regex": search, "$options": "i"}},
        ]
    
    if case_type:
        query["case_type"] = case_type
    
    if status_filter:
        query["current_status"] = {"$regex": status_filter, "$options": "i"}
    
    total = await _db["immigration_cases"].count_documents(query)
    skip = (page - 1) * limit
    
    cases = []
    cursor = _db["immigration_cases"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    async for c in cursor:
        user_name = ""
        if c.get("user_id"):
            try:
                user = await _db[IMM_USERS].find_one({"_id": ObjectId(c["user_id"])})
                if user:
                    user_name = user.get("name") or user.get("first_name") or user.get("email") or user.get("phone", "")
            except Exception:
                pass
        
        cases.append({
            "id": str(c["_id"]),
            "case_type": c.get("case_type", "uscis"),
            "case_number": c.get("case_number", ""),
            "display_number": c.get("display_number", c.get("case_number", "")),
            "current_status": c.get("current_status", ""),
            "nickname": c.get("nickname", ""),
            "form_type": c.get("form_type", ""),
            "user_id": c.get("user_id", ""),
            "user_name": user_name,
            "created_at": c.get("created_at", "").isoformat() if isinstance(c.get("created_at"), datetime) else "",
            "last_checked": c.get("last_checked", "").isoformat() if isinstance(c.get("last_checked"), datetime) else "",
            "last_status_change": c.get("last_status_change", "").isoformat() if isinstance(c.get("last_status_change"), datetime) else "",
            "history_count": len(c.get("history", [])),
            "check_success": c.get("check_success", False),
        })
    
    return {
        "success": True,
        "cases": cases,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/cases/{case_id}")
async def get_admin_case_detail(case_id: str, request: Request):
    """Get full case details with history for admin."""
    await require_admin(request)
    
    case = await _db["immigration_cases"].find_one({"_id": ObjectId(case_id)})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    user_info = None
    if case.get("user_id"):
        try:
            user = await _db[IMM_USERS].find_one({"_id": ObjectId(case["user_id"])})
            if user:
                user_info = {
                    "id": str(user["_id"]),
                    "name": user.get("name") or user.get("first_name", ""),
                    "email": user.get("email", ""),
                    "phone": user.get("phone", ""),
                }
        except Exception:
            pass
    
    return {
        "success": True,
        "case": {
            "id": str(case["_id"]),
            "case_type": case.get("case_type", "uscis"),
            "case_number": case.get("case_number", ""),
            "display_number": case.get("display_number", ""),
            "current_status": case.get("current_status", ""),
            "last_description": case.get("last_description", ""),
            "nickname": case.get("nickname", ""),
            "form_type": case.get("form_type", ""),
            "family_group": case.get("family_group", ""),
            "created_at": case.get("created_at", "").isoformat() if isinstance(case.get("created_at"), datetime) else "",
            "last_checked": case.get("last_checked", "").isoformat() if isinstance(case.get("last_checked"), datetime) else "",
            "history": [
                {
                    "status": h.get("status", ""),
                    "description": h.get("description", ""),
                    "checked_at": h.get("checked_at", "").isoformat() if isinstance(h.get("checked_at"), datetime) else str(h.get("checked_at", "")),
                }
                for h in case.get("history", [])
            ],
        },
        "user": user_info,
    }


# ═══════════════════════════════════════════════════════════════
# CASES CRUD (Create, Update, Delete)
# ═══════════════════════════════════════════════════════════════

@router.post("/cases")
async def admin_create_case(request: Request):
    """Admin: Create a case for any user (bypasses subscription limits)."""
    await require_admin(request)
    
    body = await request.json()
    user_id = body.get("user_id", "").strip()
    case_type = body.get("case_type", "").strip()
    case_number = body.get("case_number", "").strip()
    nickname = body.get("nickname", "").strip()
    current_status = body.get("current_status", "").strip()
    form_type = body.get("form_type", "").strip()
    
    if not user_id:
        raise HTTPException(status_code=400, detail="Se requiere user_id")
    if case_type not in ["uscis", "eoir", "foia"]:
        raise HTTPException(status_code=400, detail="case_type debe ser 'uscis', 'eoir' o 'foia'")
    if not case_number:
        raise HTTPException(status_code=400, detail="case_number es requerido")
    
    # Verify user exists
    try:
        user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await _db[IMM_USERS].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    clean_number = case_number.upper().replace("-", "").replace(" ", "")
    if case_type == "eoir":
        clean_number = clean_number.replace("A", "").zfill(9)
    if case_type == "foia":
        clean_number = case_number.strip().upper()
    
    # Check duplicate
    existing = await _db["immigration_cases"].find_one({
        "user_id": str(user["_id"]),
        "case_number": clean_number,
        "case_type": case_type,
        "status": "active",
    })
    if existing:
        raise HTTPException(status_code=409, detail="Este usuario ya tiene este caso registrado")
    
    now = datetime.now(timezone.utc)
    
    if case_type == "foia":
        display_num = f"FOIA-{clean_number}"
    elif case_type == "eoir":
        display_num = f"A{clean_number}"
    else:
        display_num = clean_number
    
    case_record = {
        "user_id": str(user["_id"]),
        "case_type": case_type,
        "case_number": clean_number,
        "display_number": display_num,
        "nickname": nickname,
        "current_status": current_status or "Pendiente",
        "last_description": "",
        "form_type": form_type,
        "history": [{
            "status": current_status or "Pendiente",
            "description": "Caso creado por administrador",
            "checked_at": now.isoformat(),
        }],
        "status": "active",
        "notifications_enabled": True,
        "created_at": now,
        "last_checked": now,
        "check_success": True,
    }
    
    result = await _db["immigration_cases"].insert_one(case_record)
    
    return {
        "success": True,
        "message": "Caso creado exitosamente",
        "case_id": str(result.inserted_id),
    }


@router.put("/cases/{case_id}")
async def admin_update_case(case_id: str, request: Request):
    """Admin: Update any field on a case."""
    await require_admin(request)
    
    try:
        case = await _db["immigration_cases"].find_one({"_id": ObjectId(case_id)})
    except Exception:
        case = await _db["immigration_cases"].find_one({"_id": case_id})
    
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    body = await request.json()
    update_fields = {}
    
    if "nickname" in body:
        update_fields["nickname"] = body["nickname"].strip()
    if "current_status" in body:
        new_status = body["current_status"].strip()
        old_status = case.get("current_status", "")
        update_fields["current_status"] = new_status
        if new_status != old_status:
            update_fields["last_status_change"] = datetime.now(timezone.utc)
            history_entry = {
                "status": new_status,
                "description": body.get("status_description", "Actualizado por administrador"),
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "previous_status": old_status,
            }
            await _db["immigration_cases"].update_one(
                {"_id": case["_id"]},
                {"$push": {"history": history_entry}}
            )
    if "form_type" in body:
        update_fields["form_type"] = body["form_type"].strip()
    if "case_number" in body:
        update_fields["case_number"] = body["case_number"].strip()
        ct = case.get("case_type", "uscis")
        cn = body["case_number"].strip().upper()
        if ct == "foia":
            update_fields["display_number"] = f"FOIA-{cn}"
        elif ct == "eoir":
            update_fields["display_number"] = f"A{cn}"
        else:
            update_fields["display_number"] = cn
    if "case_type" in body:
        update_fields["case_type"] = body["case_type"]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")
    
    update_fields["updated_at"] = datetime.now(timezone.utc)
    
    await _db["immigration_cases"].update_one(
        {"_id": case["_id"]},
        {"$set": update_fields}
    )
    
    return {"success": True, "message": "Caso actualizado exitosamente"}


@router.delete("/cases/{case_id}")
async def admin_delete_case(case_id: str, request: Request):
    """Admin: Archive (soft-delete) a case."""
    await require_admin(request)
    
    try:
        case = await _db["immigration_cases"].find_one({"_id": ObjectId(case_id), "status": {"$ne": "archived"}})
    except Exception:
        case = await _db["immigration_cases"].find_one({"_id": case_id, "status": {"$ne": "archived"}})
    
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    await _db["immigration_cases"].update_one(
        {"_id": case["_id"]},
        {"$set": {"status": "archived", "archived_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Caso archivado exitosamente"}


# ═══════════════════════════════════════════════════════════════
# API USAGE / AUDIT
# ═══════════════════════════════════════════════════════════════

@router.get("/api-usage")
async def get_api_usage(request: Request):
    """Get API usage statistics."""
    await require_admin(request)
    
    now = datetime.utcnow()
    
    daily_pipeline = [
        {"$match": {"last_checked": {"$gte": now - timedelta(days=30)}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_checked"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_usage = []
    async for doc in _db["immigration_cases"].aggregate(daily_pipeline):
        daily_usage.append({"date": doc["_id"], "checks": doc["count"]})
    
    top_cases_pipeline = [
        {"$match": {"status": {"$ne": "archived"}}},
        {"$project": {
            "case_number": 1, "case_type": 1, "current_status": 1,
            "check_count": {"$size": {"$ifNull": ["$history", []]}}
        }},
        {"$sort": {"check_count": -1}},
        {"$limit": 10}
    ]
    top_cases = []
    async for doc in _db["immigration_cases"].aggregate(top_cases_pipeline):
        top_cases.append({
            "case_number": doc.get("case_number", ""),
            "case_type": doc.get("case_type", ""),
            "current_status": doc.get("current_status", ""),
            "check_count": doc.get("check_count", 0),
        })
    
    return {
        "success": True,
        "daily_usage": daily_usage,
        "top_cases": top_cases,
    }



# ═══════════════════════════════════════════════════════════════
# APP CONFIGURATION (WhatsApp, Links, Resources, etc.)
# ═══════════════════════════════════════════════════════════════

CONFIG_COLLECTION = "app_config"
CONFIG_KEY = "micasousa_settings"

DEFAULT_CONFIG = {
    "key": CONFIG_KEY,
    # WhatsApp
    "whatsapp_number": "18069307456",
    "whatsapp_message": "Hola, necesito ayuda con mi caso de inmigración",
    "whatsapp_enabled": True,
    # Support
    "support_email": "soporte@micasousa.com",
    # Resource Links
    "link_processing_times": "https://egov.uscis.gov/processing-times/es",
    "link_fee_calculator": "https://www.uscis.gov/es/feecalculator",
    "link_i94_travel": "https://i94.cbp.dhs.gov/home",
    "link_eoir_payments": "https://epay.eoir.justice.gov/index",
    # Change Address Links
    "link_address_uscis": "https://www.uscis.gov/es/cambiodedireccion",
    "link_address_eoir": "https://respondentaccess.eoir.justice.gov/es/forms/",
    "link_address_ice": "https://portal.ice.gov/ocoa/",
    # Legal Links
    "link_terms": "https://rosstaxpreparation.com/terms",
    "link_privacy": "https://rosstaxpreparation.com/privacy",
    # External Services
    "link_ross_tax": "https://rosstaxpreparation.com",
    "link_report_problem": "mailto:soporte@micasousa.com?subject=Reporte%20de%20Problema",
    "link_app_store": "https://apps.apple.com/app/mi-caso-usa/id6764769696",
    "link_play_store": "https://play.google.com/store/apps/details?id=com.micasousa.app",
    # Twilio
    "twilio_sid": "",
    "twilio_token": "",
    "twilio_phone": "",
    # USCIS API
    "uscis_api_mode": "sandbox",
    "uscis_api_key": "",
    "uscis_api_secret": "",
    "uscis_api_endpoint": "",
    # Stripe
    "stripe_publishable_key": "",
    "stripe_secret_key": "",
    "stripe_webhook_secret": "",
}

ALL_CONFIG_FIELDS = list(DEFAULT_CONFIG.keys())
ALL_CONFIG_FIELDS.remove("key")  # key is not editable


async def _get_app_config():
    """Get the app configuration document, creating defaults if needed."""
    config = await _db[CONFIG_COLLECTION].find_one({"key": CONFIG_KEY})
    if not config:
        config = {**DEFAULT_CONFIG, "updated_at": datetime.utcnow()}
        await _db[CONFIG_COLLECTION].insert_one(config)
    else:
        # Ensure all default fields exist (migration for new fields)
        missing = {}
        for k, v in DEFAULT_CONFIG.items():
            if k not in config:
                missing[k] = v
        if missing:
            await _db[CONFIG_COLLECTION].update_one(
                {"key": CONFIG_KEY}, {"$set": missing}
            )
            config.update(missing)
    return config


@router.get("/config")
async def get_app_config(request: Request):
    """Get full app configuration (admin only)."""
    await require_admin(request)
    config = await _get_app_config()
    result = {}
    for field in ALL_CONFIG_FIELDS:
        val = config.get(field, DEFAULT_CONFIG.get(field, ""))
        if isinstance(val, datetime):
            val = val.isoformat()
        result[field] = val
    updated = config.get("updated_at")
    result["updated_at"] = updated.isoformat() if isinstance(updated, datetime) else str(updated or "")
    return {"success": True, "config": result}


@router.put("/config")
async def update_app_config(request: Request):
    """Update app configuration (admin only)."""
    await require_admin(request)
    body = await request.json()

    update_fields = {}
    for field in ALL_CONFIG_FIELDS:
        if field in body:
            update_fields[field] = body[field]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    update_fields["updated_at"] = datetime.utcnow()

    await _db[CONFIG_COLLECTION].update_one(
        {"key": CONFIG_KEY},
        {"$set": update_fields},
        upsert=True,
    )

    return {"success": True, "message": "Configuración actualizada"}


# Public endpoint (no auth) - for the Expo app to fetch config
@router.get("/public-config")
async def get_public_config():
    """Get public app configuration (for the mobile app, no auth required)."""
    config = await _get_app_config()
    result = {}
    # WhatsApp
    if config.get("whatsapp_enabled"):
        number = config.get("whatsapp_number", "")
        msg = config.get("whatsapp_message", "")
        result["whatsapp_url"] = f"https://wa.me/{number}?text={msg.replace(' ', '%20')}"
        result["whatsapp_number"] = number
    # Support
    result["support_email"] = config.get("support_email", "soporte@micasousa.com")
    # All links
    link_fields = [k for k in DEFAULT_CONFIG.keys() if k.startswith("link_")]
    for f in link_fields:
        result[f] = config.get(f, DEFAULT_CONFIG.get(f, ""))
    return {"success": True, "config": result}



# ═══════════════════════════════════════════════════════════════════
# ADMIN CHAT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/chats")
async def list_chats(request: Request, status: Optional[str] = None, page: int = 1, limit: int = 20):
    """List all chat conversations for admin. Filterable by status (open/resolved)."""
    await require_admin(request)

    query = {}
    if status and status in ("open", "resolved"):
        query["status"] = status

    total = await _db["immigration_chats"].count_documents(query)
    skip = (page - 1) * limit

    cursor = _db["immigration_chats"].find(query).sort("updated_at", -1).skip(skip).limit(limit)

    chats = []
    async for chat in cursor:
        chats.append({
            "id": str(chat["_id"]),
            "user_id": chat.get("user_id", ""),
            "user_name": chat.get("user_name", "Usuario"),
            "user_email": chat.get("user_email", ""),
            "user_phone": chat.get("user_phone", ""),
            "status": chat.get("status", "open"),
            "last_message": chat.get("last_message", ""),
            "last_sender": chat.get("last_sender", ""),
            "unread_admin": chat.get("unread_admin", 0),
            "message_count": chat.get("message_count", 0),
            "created_at": chat["created_at"].isoformat() if isinstance(chat.get("created_at"), datetime) else str(chat.get("created_at", "")),
            "updated_at": chat["updated_at"].isoformat() if isinstance(chat.get("updated_at"), datetime) else str(chat.get("updated_at", "")),
        })

    open_count = await _db["immigration_chats"].count_documents({"status": "open"})
    resolved_count = await _db["immigration_chats"].count_documents({"status": "resolved"})

    return {
        "success": True,
        "chats": chats,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "stats": {
            "open": open_count,
            "resolved": resolved_count,
        }
    }


@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(request: Request, chat_id: str, page: int = 1, limit: int = 50):
    """Get messages for a specific chat conversation."""
    await require_admin(request)

    try:
        chat = await _db["immigration_chats"].find_one({"_id": ObjectId(chat_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID de chat inválido")

    if not chat:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    # Reset admin unread count
    if chat.get("unread_admin", 0) > 0:
        await _db["immigration_chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"unread_admin": 0}}
        )
        await _db["immigration_chat_messages"].update_many(
            {"chat_id": chat_id, "sender_type": "user", "read": False},
            {"$set": {"read": True}}
        )

    skip = (page - 1) * limit
    total = await _db["immigration_chat_messages"].count_documents({"chat_id": chat_id})

    cursor = _db["immigration_chat_messages"].find(
        {"chat_id": chat_id}
    ).sort("created_at", 1).skip(skip).limit(limit)

    messages = []
    async for msg in cursor:
        messages.append({
            "id": str(msg["_id"]),
            "sender_type": msg["sender_type"],
            "sender_name": msg.get("sender_name", ""),
            "message": msg["message"],
            "created_at": msg["created_at"].isoformat() if isinstance(msg.get("created_at"), datetime) else str(msg.get("created_at", "")),
            "read": msg.get("read", False),
        })

    return {
        "success": True,
        "chat": {
            "id": str(chat["_id"]),
            "user_name": chat.get("user_name", ""),
            "user_email": chat.get("user_email", ""),
            "status": chat.get("status", "open"),
        },
        "messages": messages,
        "total": total,
        "page": page,
        "has_more": skip + limit < total,
    }


@router.post("/chats/{chat_id}/reply")
async def admin_reply(request: Request, chat_id: str):
    """Admin replies to a chat conversation. Body: { "message": "..." }"""
    admin_id = await require_admin(request)

    body = await request.json()
    message_text = body.get("message", "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    try:
        chat = await _db["immigration_chats"].find_one({"_id": ObjectId(chat_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID de chat inválido")

    if not chat:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    now = datetime.now(timezone.utc)

    # Get admin name
    try:
        admin_user = await _db[IMM_USERS].find_one({"_id": ObjectId(admin_id)})
    except Exception:
        admin_user = None
    admin_name = "Soporte Mi Caso USA"
    if admin_user:
        admin_name = admin_user.get("name") or admin_user.get("full_name") or "Soporte Mi Caso USA"

    # Insert message
    msg_doc = {
        "chat_id": chat_id,
        "sender_type": "admin",
        "sender_name": admin_name,
        "message": message_text,
        "created_at": now,
        "read": False,
    }
    msg_result = await _db["immigration_chat_messages"].insert_one(msg_doc)

    # Update conversation
    await _db["immigration_chats"].update_one(
        {"_id": ObjectId(chat_id)},
        {
            "$set": {
                "updated_at": now,
                "last_message": message_text[:100],
                "last_sender": "admin",
            },
            "$inc": {
                "unread_user": 1,
                "message_count": 1,
            }
        }
    )

    # Send push notification to user
    try:
        user_id = chat.get("user_id")
        if user_id:
            user = None
            try:
                user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = await _db[IMM_USERS].find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
            
            if user and user.get("expo_push_token"):
                push_token = user["expo_push_token"]
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": push_token,
                            "title": "💬 Soporte Mi Caso USA",
                            "body": message_text[:100],
                            "data": {"type": "chat_reply", "chat_id": chat_id},
                            "sound": "default",
                            "badge": 1,
                        },
                        timeout=10
                    )
                    logger.info(f"Push notification sent to user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to send push notification: {e}")

    return {
        "success": True,
        "message_id": str(msg_result.inserted_id),
        "created_at": now.isoformat(),
    }


@router.put("/chats/{chat_id}/resolve")
async def resolve_chat(request: Request, chat_id: str):
    """Mark a chat conversation as resolved."""
    await require_admin(request)

    try:
        result = await _db["immigration_chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc),
            }}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="ID de chat inválido")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    return {"success": True, "message": "Conversación marcada como resuelta"}


@router.put("/chats/{chat_id}/reopen")
async def reopen_chat(request: Request, chat_id: str):
    """Reopen a resolved conversation."""
    await require_admin(request)

    try:
        result = await _db["immigration_chats"].update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {"status": "open"},
                "$unset": {"resolved_at": ""}
            }
        )
    except Exception:
        raise HTTPException(status_code=400, detail="ID de chat inválido")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    return {"success": True, "message": "Conversación reabierta"}


# ═══════════════════════════════════════════════════════════════════
# LEGAL CONTENT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/legal")
async def get_legal_docs(request: Request):
    """Get all legal documents."""
    await require_admin(request)
    docs = await _db["immigration_legal"].find({}).to_list(10)
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "type": d.get("type"),
            "lang": d.get("lang"),
            "content": d.get("content", ""),
            "updated_at": d.get("updated_at", "").isoformat() if hasattr(d.get("updated_at", ""), "isoformat") else str(d.get("updated_at", ""))
        })
    return {"success": True, "documents": result}


@router.put("/legal/{doc_type}")
async def update_legal_doc(request: Request, doc_type: str):
    """
    Update a legal document.
    Body: { "lang": "es"|"en", "content": "..." }
    """
    await require_admin(request)
    
    if doc_type not in ("terms", "privacy"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    
    body = await request.json()
    lang = body.get("lang", "es")
    content = body.get("content", "")
    
    if lang not in ("es", "en"):
        raise HTTPException(status_code=400, detail="Idioma inválido")
    
    await _db["immigration_legal"].update_one(
        {"type": doc_type, "lang": lang},
        {"$set": {
            "type": doc_type,
            "lang": lang,
            "content": content,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    label = "Términos y Condiciones" if doc_type == "terms" else "Política de Privacidad"
    lang_label = "Español" if lang == "es" else "English"
    return {"success": True, "message": f"{label} ({lang_label}) actualizado"}


# ═══════════════════════════════════════════════════════════════════
# SUBSCRIPTION MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/subscriptions")
async def list_subscriptions(request: Request, status: str = "", page: int = 1, limit: int = 50):
    """List all subscriptions with optional status filter."""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    total = await _db["immigration_subscriptions"].count_documents(query)
    
    subs = await _db["immigration_subscriptions"].find(query).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    enriched = []
    for sub in subs:
        user = None
        try:
            user = await _db[IMM_USERS].find_one({"_id": ObjectId(sub["user_id"])})
        except Exception:
            pass
        
        enriched.append({
            "id": str(sub["_id"]),
            "user_id": sub.get("user_id"),
            "user_name": (user.get("name") or user.get("full_name") or f'{user.get("first_name","")} {user.get("last_name","")}').strip() if user else "Desconocido",
            "user_email": user.get("email", "") if user else "",
            "plan_name": sub.get("plan_name", "free"),
            "status": sub.get("status", "active"),
            "billing_period": sub.get("billing_period", "monthly"),
            "price": sub.get("price", 0),
            "created_at": sub.get("created_at", "").isoformat() if hasattr(sub.get("created_at", ""), "isoformat") else str(sub.get("created_at", "")),
            "expires_at": sub.get("expires_at", "").isoformat() if hasattr(sub.get("expires_at", ""), "isoformat") else str(sub.get("expires_at", "")),
        })
    
    return {
        "success": True,
        "subscriptions": enriched,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/subscriptions/grant")
async def grant_subscription(request: Request):
    """
    Manually grant a subscription to a user.
    Body: { "user_id": "...", "plan_name": "basico|estandar|premium", "months": 1 }
    """
    await require_admin(request)
    body = await request.json()
    
    user_id = body.get("user_id", "").strip()
    plan_name = body.get("plan_name", "").strip().lower()
    months = int(body.get("months", 1))
    
    if not user_id or plan_name not in ("basico", "estandar", "premium"):
        raise HTTPException(status_code=400, detail="user_id y plan_name (basico/estandar/premium) requeridos")
    
    # Verify user exists
    try:
        user = await _db[IMM_USERS].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30 * months)
    
    prices = {"basico": 0.99, "estandar": 1.99, "premium": 3.99}
    
    # Upsert subscription
    await _db["immigration_subscriptions"].update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "plan_name": plan_name,
            "status": "active",
            "billing_period": "manual",
            "price": prices.get(plan_name, 0),
            "granted_by": "admin",
            "created_at": now,
            "expires_at": expires,
            "updated_at": now,
        }},
        upsert=True
    )
    
    user_name = (user.get("name") or user.get("full_name") or "").strip()
    return {
        "success": True,
        "message": f"Suscripción '{plan_name}' otorgada a {user_name} por {months} mes(es)"
    }


@router.post("/subscriptions/{sub_id}/revoke")
async def revoke_subscription(request: Request, sub_id: str):
    """Revoke/cancel a subscription."""
    await require_admin(request)
    
    try:
        result = await _db["immigration_subscriptions"].update_one(
            {"_id": ObjectId(sub_id)},
            {"$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc),
                "cancelled_by": "admin"
            }}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada")
    
    return {"success": True, "message": "Suscripción revocada"}


@router.get("/revenue")
async def get_revenue_stats(request: Request):
    """Get revenue statistics for subscriptions."""
    await require_admin(request)
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    # Total active subscriptions
    total_active = await _db["immigration_subscriptions"].count_documents({"status": "active"})
    
    # Count by plan
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$plan_name", "count": {"$sum": 1}, "revenue": {"$sum": "$price"}}}
    ]
    plan_stats = {}
    async for doc in _db["immigration_subscriptions"].aggregate(pipeline):
        plan_stats[doc["_id"] or "free"] = {"count": doc["count"], "revenue": round(doc["revenue"], 2)}
    
    # New subscriptions in last 30 days
    new_30d = await _db["immigration_subscriptions"].count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # New subscriptions in last 7 days
    new_7d = await _db["immigration_subscriptions"].count_documents({
        "created_at": {"$gte": seven_days_ago}
    })
    
    # Cancelled in last 30 days
    cancelled_30d = await _db["immigration_subscriptions"].count_documents({
        "status": "cancelled",
        "cancelled_at": {"$gte": thirty_days_ago}
    })
    
    # Total monthly estimated revenue (active subs)
    mrr_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]
    mrr = 0
    async for doc in _db["immigration_subscriptions"].aggregate(mrr_pipeline):
        mrr = round(doc["total"], 2)
    
    # Total registered users
    total_users = await _db[IMM_USERS].count_documents({"source": "immigration_app"})
    
    return {
        "success": True,
        "stats": {
            "total_active_subscriptions": total_active,
            "mrr": mrr,
            "new_subscriptions_30d": new_30d,
            "new_subscriptions_7d": new_7d,
            "cancelled_30d": cancelled_30d,
            "total_users": total_users,
            "plan_breakdown": plan_stats,
            "conversion_rate": round((total_active / max(total_users, 1)) * 100, 1)
        }
    }
