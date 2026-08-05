"""
Lending Chat Routes — Real-time messaging between clients and advisors
MongoDB collections: lending_chat_conversations, lending_chat_messages
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

router = APIRouter(prefix="/api/lending-chat", tags=["Lending Chat"])

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")

_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]
conversations_col = _db["lending_chat_conversations"]
messages_col = _db["lending_chat_messages"]


# ─── Auth Helper ────────────────────────────────────────────────────────────────

async def get_chat_user(authorization: str = Header(None)):
    """Get current user from Bearer token."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = authorization.replace('Bearer ', '')
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user['id'] = str(user.pop('_id'))
    return user


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    for key, val in list(doc.items()):
        if isinstance(val, ObjectId):
            doc[key] = str(val)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


# ─── Models ────────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    text: str
    conversation_id: Optional[str] = None


class AdminSendMessageRequest(BaseModel):
    text: str
    conversation_id: str


class TypingRequest(BaseModel):
    conversation_id: str
    is_typing: bool


# ─── CLIENT ENDPOINTS ─────────────────────────────────────────────────────────

@router.get("/my-conversation")
async def get_my_conversation(user=Depends(get_chat_user)):
    """Get or create the client's conversation."""
    user_id = str(user.get("id", ""))

    conv = await conversations_col.find_one({"user_id": user_id})
    if not conv:
        now = datetime.now(timezone.utc)
        user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("name", "Cliente")
        conv_doc = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user.get("email", ""),
            "user_phone": user.get("phone", ""),
            "last_message": "",
            "last_message_at": now,
            "last_sender": "system",
            "unread_admin": 0,
            "unread_user": 0,
            "admin_typing": False,
            "user_typing": False,
            "status": "active",
            "created_at": now,
        }
        result = await conversations_col.insert_one(conv_doc)
        conv_doc["_id"] = result.inserted_id
        conv = conv_doc

    return serialize_doc(conv)


@router.get("/my-messages")
async def get_my_messages(user=Depends(get_chat_user), after: Optional[str] = None):
    """Get messages for the client's conversation."""
    user_id = str(user.get("id", ""))

    conv = await conversations_col.find_one({"user_id": user_id})
    if not conv:
        return {"messages": [], "conversation_id": None}

    conv_id = str(conv["_id"])
    query = {"conversation_id": conv_id}

    if after:
        try:
            after_dt = datetime.fromisoformat(after.replace("Z", "+00:00"))
            query["created_at"] = {"$gt": after_dt}
        except Exception:
            pass

    cursor = messages_col.find(query).sort("created_at", 1).limit(200)
    messages = []
    async for msg in cursor:
        messages.append(serialize_doc(msg))

    # Mark admin messages as read
    await messages_col.update_many(
        {"conversation_id": conv_id, "sender_type": "admin", "read": False},
        {"$set": {"read": True}}
    )
    await conversations_col.update_one(
        {"_id": conv["_id"]},
        {"$set": {"unread_user": 0}}
    )

    return {"messages": messages, "conversation_id": conv_id}


@router.post("/send")
async def client_send_message(body: SendMessageRequest, user=Depends(get_chat_user)):
    """Client sends a message."""
    user_id = str(user.get("id", ""))
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("name", "Cliente")

    # Get or create conversation
    conv = await conversations_col.find_one({"user_id": user_id})
    if not conv:
        now = datetime.now(timezone.utc)
        conv_doc = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user.get("email", ""),
            "user_phone": user.get("phone", ""),
            "last_message": body.text[:100],
            "last_message_at": now,
            "last_sender": "user",
            "unread_admin": 1,
            "unread_user": 0,
            "admin_typing": False,
            "user_typing": False,
            "status": "active",
            "created_at": now,
        }
        result = await conversations_col.insert_one(conv_doc)
        conv_id = str(result.inserted_id)
    else:
        conv_id = str(conv["_id"])

    now = datetime.now(timezone.utc)
    msg_doc = {
        "conversation_id": conv_id,
        "sender_type": "user",
        "sender_id": user_id,
        "sender_name": user_name,
        "text": body.text,
        "read": False,
        "created_at": now,
    }
    result = await messages_col.insert_one(msg_doc)

    # Update conversation
    await conversations_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "last_message": body.text[:100],
                "last_message_at": now,
                "last_sender": "user",
                "user_typing": False,
            },
            "$inc": {"unread_admin": 1}
        }
    )

    msg_doc["_id"] = result.inserted_id
    return serialize_doc(msg_doc)


@router.post("/typing")
async def client_typing(body: TypingRequest, user=Depends(get_chat_user)):
    """Client typing indicator."""
    user_id = str(user.get("id", ""))
    await conversations_col.update_one(
        {"user_id": user_id},
        {"$set": {"user_typing": body.is_typing}}
    )
    return {"ok": True}


@router.get("/unread-count")
async def client_unread_count(user=Depends(get_chat_user)):
    """Get unread count for client."""
    user_id = str(user.get("id", ""))
    conv = await conversations_col.find_one({"user_id": user_id})
    if not conv:
        return {"unread": 0}
    return {"unread": conv.get("unread_user", 0)}


# ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

@router.get("/admin/conversations")
async def admin_list_conversations(user=Depends(get_chat_user), status: Optional[str] = None):
    """Admin: list all conversations."""
    if user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="No autorizado")

    query = {}
    if status:
        query["status"] = status

    cursor = conversations_col.find(query).sort("last_message_at", -1).limit(100)
    convs = []
    async for conv in cursor:
        convs.append(serialize_doc(conv))

    # Total unread across all conversations
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$unread_admin"}}}
    ]
    total_unread = 0
    async for doc in conversations_col.aggregate(pipeline):
        total_unread = doc.get("total", 0)

    return {"conversations": convs, "total_unread": total_unread}


@router.get("/admin/messages/{conversation_id}")
async def admin_get_messages(conversation_id: str, user=Depends(get_chat_user), after: Optional[str] = None):
    """Admin: get messages for a conversation."""
    if user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="No autorizado")

    query = {"conversation_id": conversation_id}
    if after:
        try:
            after_dt = datetime.fromisoformat(after.replace("Z", "+00:00"))
            query["created_at"] = {"$gt": after_dt}
        except Exception:
            pass

    cursor = messages_col.find(query).sort("created_at", 1).limit(500)
    messages = []
    async for msg in cursor:
        messages.append(serialize_doc(msg))

    # Mark user messages as read by admin
    await messages_col.update_many(
        {"conversation_id": conversation_id, "sender_type": "user", "read": False},
        {"$set": {"read": True}}
    )
    await conversations_col.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"unread_admin": 0}}
    )

    # Get conversation info
    conv = await conversations_col.find_one({"_id": ObjectId(conversation_id)})

    return {
        "messages": messages,
        "conversation": serialize_doc(conv) if conv else None,
    }


@router.post("/admin/send")
async def admin_send_message(body: AdminSendMessageRequest, user=Depends(get_chat_user)):
    """Admin sends a message to a client."""
    if user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="No autorizado")

    admin_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "Asesor"
    admin_id = str(user.get("id", ""))

    now = datetime.now(timezone.utc)
    msg_doc = {
        "conversation_id": body.conversation_id,
        "sender_type": "admin",
        "sender_id": admin_id,
        "sender_name": admin_name,
        "text": body.text,
        "read": False,
        "created_at": now,
    }
    result = await messages_col.insert_one(msg_doc)

    # Update conversation
    await conversations_col.update_one(
        {"_id": ObjectId(body.conversation_id)},
        {
            "$set": {
                "last_message": body.text[:100],
                "last_message_at": now,
                "last_sender": "admin",
                "admin_typing": False,
            },
            "$inc": {"unread_user": 1}
        }
    )

    msg_doc["_id"] = result.inserted_id
    return serialize_doc(msg_doc)


@router.post("/admin/typing")
async def admin_typing(body: TypingRequest, user=Depends(get_chat_user)):
    """Admin typing indicator."""
    if user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="No autorizado")
    await conversations_col.update_one(
        {"_id": ObjectId(body.conversation_id)},
        {"$set": {"admin_typing": body.is_typing}}
    )
    return {"ok": True}


@router.get("/admin/unread-total")
async def admin_unread_total(user=Depends(get_chat_user)):
    """Admin: total unread messages across all conversations."""
    if user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="No autorizado")

    pipeline = [
        {"$match": {"unread_admin": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$unread_admin"}, "count": {"$sum": 1}}}
    ]
    total = 0
    conv_count = 0
    async for doc in conversations_col.aggregate(pipeline):
        total = doc.get("total", 0)
        conv_count = doc.get("count", 0)

    return {"total_unread": total, "conversations_with_unread": conv_count}
