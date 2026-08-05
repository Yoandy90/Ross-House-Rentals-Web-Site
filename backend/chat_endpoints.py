"""
Chat Endpoints - B2B Communication API
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Header
from typing import List, Optional
from datetime import datetime
from jose import JWTError, jwt
from chat_service import ChatService
from chat_models import (
    CreateConversationRequest,
    SendMessageRequest,
    MarkAsReadRequest,
    ConversationListResponse,
    MessagesResponse,
    Conversation,
    ChatMessage,
    MessageType
)
from database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

# Global chat service instance
_chat_service_instance: Optional[ChatService] = None

def set_chat_service(service: ChatService):
    """Set the global chat service instance"""
    global _chat_service_instance
    _chat_service_instance = service
    logger.info("✅ Chat service instance set")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current authenticated user from session token"""
    from database import get_database
    from bson import ObjectId
    
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='No autorizado')
    
    token = authorization.replace('Bearer ', '')
    db = get_database()
    
    session = await db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    
    user = await db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    return {
        'user_id': str(user['_id']),
        'email': user.get('email'),
        'full_name': user.get('full_name', user.get('name', 'User')),
        'role': user.get('role', 'client')
    }


def get_chat_service(db=Depends(get_database)):
    """Get chat service instance - returns singleton if set, otherwise creates new"""
    if _chat_service_instance:
        return _chat_service_instance
    return ChatService(db)


@router.post("/conversations", response_model=Conversation)
async def create_conversation(
    request: CreateConversationRequest,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Create or get existing conversation"""
    try:
        conversation = await chat_service.create_conversation(
            client_id=request.client_id if current_user["role"] == "admin" else current_user["user_id"],
            client_name=current_user.get("full_name", "Client"),
            client_email=current_user.get("email", ""),
            initial_message=request.initial_message
        )
        return conversation
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get all conversations for current user"""
    try:
        return await chat_service.get_conversations(
            user_id=current_user["user_id"],
            user_role=current_user["role"],
            status=status
        )
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/messages", response_model=MessagesResponse)
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before_message_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get messages for a conversation"""
    try:
        return await chat_service.get_messages(
            conversation_id=conversation_id,
            limit=limit,
            before_message_id=before_message_id
        )
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages", response_model=ChatMessage)
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Send a new message"""
    try:
        # If the frontend is trying to save an AI response, skip it.
        # The chat_service already auto-generates AI responses with correct roles.
        # Saving again would create duplicates with wrong sender attribution.
        if request.sender_id and request.sender_id in ('ai_assistant', 'ai-assistant'):
            logger.info(f"⏭️ Skipping duplicate AI message save for conversation {request.conversation_id}")
            # Return a dummy response so the frontend doesn't error
            from datetime import datetime
            from uuid import uuid4
            dummy = ChatMessage(
                message_id=str(uuid4()),
                conversation_id=request.conversation_id,
                sender_id="ai-assistant",
                sender_name="Asistente IA",
                sender_role="admin",
                content=request.content,
                message_type=request.message_type or "text",
                status="sent",
                is_read=False,
                created_at=datetime.utcnow(),
                metadata={}
            )
            return dummy

        message = await chat_service.send_message(
            conversation_id=request.conversation_id,
            sender_id=current_user["user_id"],
            sender_name=current_user.get("full_name", "User"),
            sender_role=current_user["role"],
            content=request.content,
            message_type=request.message_type,
            file_url=request.file_url,
            file_name=request.file_name,
            file_size=request.file_size
        )
        return message
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages/read")
async def mark_messages_as_read(
    request: MarkAsReadRequest,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Mark messages as read"""
    try:
        count = await chat_service.mark_as_read(
            conversation_id=request.conversation_id,
            message_ids=request.message_ids,
            reader_role=current_user["role"]
        )
        return {"marked_count": count}
    except Exception as e:
        logger.error(f"Error marking messages as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get total unread messages count"""
    try:
        count = await chat_service.get_unread_count(
            user_id=current_user["user_id"],
            user_role=current_user["role"]
        )
        return {"unread_count": count}
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push-token")
async def register_push_token(
    token: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Register or update user's push notification token"""
    try:
        from bson import ObjectId
        user_id = ObjectId(current_user["user_id"])
        
        # Update user's push token
        await db.users.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "push_token": token,
                    "push_token_updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"✅ Push token registered for user {current_user['user_id']}")
        return {"success": True, "message": "Token registrado correctamente"}
    except Exception as e:
        logger.error(f"Error registering push token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


logger.info("✅ Chat endpoints initialized")
