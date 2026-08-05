"""
Mi Caso USA - Premium Chat Routes
Real-time in-app chat system for premium subscribers.

Collections:
- immigration_chats: Conversation metadata per user
- immigration_chat_messages: Individual messages

User Endpoints:
- POST /immigration/chat/send - Send a message
- GET  /immigration/chat/messages - Get chat history  
- GET  /immigration/chat/unread - Unread count

Admin Endpoints (in immigration_admin_routes.py):
- GET  /immigration/admin/chats - List all conversations
- GET  /immigration/admin/chats/{id}/messages - Chat messages
- POST /immigration/admin/chats/{id}/reply - Reply
- PUT  /immigration/admin/chats/{id}/resolve - Close chat
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional
import logging

logger = logging.getLogger("immigration_chat")

router = APIRouter(prefix="/immigration/chat", tags=["Immigration-Chat"])

_db = None


def set_chat_db(db):
    global _db
    _db = db


# ═══════════════════════════════════════════════════════════════════
# AUTH HELPER (same pattern as immigration_case_routes)
# ═══════════════════════════════════════════════════════════════════

async def _get_user(request: Request) -> dict:
    """Get authenticated user or raise 401."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")

    token = auth[7:]

    # First try user_sessions collection (session tokens)
    session = await _db["user_sessions"].find_one({"session_token": token})
    if session:
        user_id = session.get("user_id")
        try:
            user = await _db["immigration_users"].find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = await _db["immigration_users"].find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
        if user:
            return user

    # Fallback: try JWT decode
    try:
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        uid = payload.get("sub") or payload.get("user_id")
        if uid:
            try:
                user = await _db["users"].find_one({"_id": ObjectId(uid)})
            except Exception:
                user = await _db["users"].find_one({"$or": [{"_id": uid}, {"id": uid}]})
            if user:
                return user
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Sesión inválida")


def _user_display_name(user: dict) -> str:
    """Get display name from user doc."""
    name = user.get("name") or user.get("full_name") or ""
    if not name:
        first = user.get("first_name", "")
        last = user.get("last_name", "")
        name = f"{first} {last}".strip()
    return name or "Usuario"


# ═══════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post("/send")
async def send_message(request: Request):
    """
    Send a chat message. Creates a new conversation if none exists.
    Body: { "message": "texto del mensaje" }
    Requires active subscription (basico, estandar, or premium).
    """
    user = await _get_user(request)
    user_id = str(user["_id"])
    user_name = _user_display_name(user)

    # Check subscription
    subscription = await _db["immigration_subscriptions"].find_one({"user_id": user_id})
    plan_name = ""
    if subscription:
        plan_name = (subscription.get("plan_name", "") or "").lower()
    # Also check user doc for admin/premium flag
    is_admin = user.get("role") == "admin" or user.get("is_admin") is True
    has_plan = plan_name in ("basico", "basic", "estandar", "standard", "premium")
    if not has_plan and not is_admin:
        raise HTTPException(status_code=403, detail="Se requiere suscripción activa para usar el chat premium")

    body = await request.json()
    message_text = body.get("message", "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")
    if len(message_text) > 2000:
        raise HTTPException(status_code=400, detail="Mensaje demasiado largo (máx 2000 caracteres)")

    now = datetime.now(timezone.utc)

    # Find or create conversation
    chat = await _db["immigration_chats"].find_one({
        "user_id": user_id,
        "status": {"$ne": "resolved"}
    })

    if not chat:
        # Create new conversation
        chat_doc = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user.get("email", ""),
            "user_phone": user.get("phone", ""),
            "status": "open",
            "created_at": now,
            "updated_at": now,
            "last_message": message_text[:100],
            "last_sender": "user",
            "unread_admin": 1,
            "unread_user": 0,
            "message_count": 1,
        }
        result = await _db["immigration_chats"].insert_one(chat_doc)
        chat_id = result.inserted_id
    else:
        chat_id = chat["_id"]
        # Update conversation
        await _db["immigration_chats"].update_one(
            {"_id": chat_id},
            {
                "$set": {
                    "updated_at": now,
                    "last_message": message_text[:100],
                    "last_sender": "user",
                    "status": "open",
                },
                "$inc": {
                    "unread_admin": 1,
                    "message_count": 1,
                }
            }
        )

    # Insert message
    msg_doc = {
        "chat_id": str(chat_id),
        "sender_type": "user",
        "sender_name": user_name,
        "message": message_text,
        "created_at": now,
        "read": False,
    }
    msg_result = await _db["immigration_chat_messages"].insert_one(msg_doc)

    return {
        "success": True,
        "message_id": str(msg_result.inserted_id),
        "chat_id": str(chat_id),
        "created_at": now.isoformat(),
    }


@router.get("/messages")
async def get_messages(request: Request, page: int = 1, limit: int = 50):
    """
    Get the user's chat messages (from their active or most recent conversation).
    Returns messages newest first, paginated.
    """
    user = await _get_user(request)
    user_id = str(user["_id"])

    # Find user's active or most recent conversation
    chat = await _db["immigration_chats"].find_one(
        {"user_id": user_id},
        sort=[("updated_at", -1)]
    )

    if not chat:
        return {
            "success": True,
            "messages": [],
            "chat_id": None,
            "status": None,
            "total": 0,
        }

    chat_id = str(chat["_id"])

    # Mark user's unread as 0
    if chat.get("unread_user", 0) > 0:
        await _db["immigration_chats"].update_one(
            {"_id": chat["_id"]},
            {"$set": {"unread_user": 0}}
        )
        # Mark admin messages as read
        await _db["immigration_chat_messages"].update_many(
            {"chat_id": chat_id, "sender_type": "admin", "read": False},
            {"$set": {"read": True}}
        )

    # Get messages (newest first for pagination, then reverse for display)
    skip = (page - 1) * limit
    total = await _db["immigration_chat_messages"].count_documents({"chat_id": chat_id})

    cursor = _db["immigration_chat_messages"].find(
        {"chat_id": chat_id}
    ).sort("created_at", -1).skip(skip).limit(limit)

    messages = []
    async for msg in cursor:
        messages.append({
            "id": str(msg["_id"]),
            "sender_type": msg["sender_type"],
            "sender_name": msg.get("sender_name", ""),
            "message": msg["message"],
            "created_at": msg["created_at"].isoformat() if isinstance(msg["created_at"], datetime) else msg["created_at"],
            "read": msg.get("read", False),
        })

    # Reverse so they display chronologically
    messages.reverse()

    return {
        "success": True,
        "messages": messages,
        "chat_id": chat_id,
        "status": chat.get("status", "open"),
        "total": total,
        "page": page,
        "has_more": skip + limit < total,
    }


@router.get("/unread")
async def get_unread_count(request: Request):
    """Get the number of unread messages for the user."""
    user = await _get_user(request)
    user_id = str(user["_id"])

    chat = await _db["immigration_chats"].find_one(
        {"user_id": user_id, "status": {"$ne": "resolved"}},
        sort=[("updated_at", -1)]
    )

    count = chat.get("unread_user", 0) if chat else 0

    return {
        "success": True,
        "unread": count,
    }
