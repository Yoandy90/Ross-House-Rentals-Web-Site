"""
Chat AI Endpoints - AI Control for Chat
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Dict, Any, Optional
from chat_ai_service import ChatAIService

logger = logging.getLogger(__name__)

router = APIRouter()


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
    
    user_id = session['user_id']
    user = None
    
    # Robust user lookup - try multiple methods
    # Method 1: If user_id is already an ObjectId
    if not isinstance(user_id, str):
        user = await db.users.find_one({'_id': user_id})
    
    # Method 2: Try to convert string to ObjectId
    if not user and isinstance(user_id, str):
        try:
            user = await db.users.find_one({'_id': ObjectId(user_id)})
        except Exception:
            pass
    
    # Method 3: Search by string _id (for UUID-style IDs)
    if not user:
        user = await db.users.find_one({'_id': user_id})
    
    # Method 4: Search by uuid field (if exists)
    if not user:
        user = await db.users.find_one({'uuid': user_id})
    
    # Method 5: Search by email if user_id looks like an email
    if not user and isinstance(user_id, str) and '@' in user_id:
        user = await db.users.find_one({'email': user_id})
    
    if not user:
        logger.error(f"❌ User not found for user_id: {user_id} (type: {type(user_id)})")
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    return {
        'user_id': str(user['_id']),
        'email': user.get('email'),
        'full_name': user.get('full_name', user.get('name', 'User')),
        'role': user.get('role', 'client')
    }

# Will be set by server.py
chat_ai_service: ChatAIService = None


def set_chat_ai_service(service: ChatAIService):
    """Set the chat AI service instance"""
    global chat_ai_service
    chat_ai_service = service
    logger.info("✅ Chat AI endpoints initialized")


@router.post('/chat/ai/toggle-global')
async def toggle_ai_global(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Toggle AI globally for all conversations (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        enabled = data.get('enabled', False)
        count = await chat_ai_service.toggle_ai_global(enabled)
        
        return {
            'success': True,
            'enabled': enabled,
            'conversations_updated': count,
            'message': f'AI globally {"enabled" if enabled else "disabled"} for {count} conversations'
        }
    except Exception as e:
        logger.error(f"❌ Error toggling global AI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/chat/ai/toggle/{conversation_id}')
async def toggle_ai_for_conversation(
    conversation_id: str,
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Toggle AI for a specific conversation (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        enabled = data.get('enabled', False)
        success = await chat_ai_service.toggle_ai_for_conversation(conversation_id, enabled)
        
        if success:
            return {
                'success': True,
                'enabled': enabled,
                'conversation_id': conversation_id,
                'message': f'AI {"enabled" if enabled else "disabled"} for this conversation'
            }
        else:
            raise HTTPException(status_code=404, detail='Conversation not found')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling AI for conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/chat/ai/status/{conversation_id}')
async def get_ai_status(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get AI status for a specific conversation"""
    try:
        enabled = await chat_ai_service.is_ai_enabled_for_conversation(conversation_id)
        
        return {
            'conversation_id': conversation_id,
            'ai_enabled': enabled
        }
    except Exception as e:
        logger.error(f"❌ Error getting AI status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/chat/ai/global-status')
async def get_global_ai_status():
    """Get global AI status - public endpoint"""
    try:
        # Check if any conversation has global AI enabled
        conversation = await chat_ai_service.conversations_collection.find_one(
            {"ai_enabled_global": True}
        )
        
        return {
            'ai_enabled_global': bool(conversation),
            'ai_available': chat_ai_service.ai_enabled
        }
    except Exception as e:
        logger.error(f"❌ Error getting global AI status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
