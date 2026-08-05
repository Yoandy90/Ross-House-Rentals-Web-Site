"""
Chat Routes Router (Admin + Client)
Extracted from server.py for modularization.
Handles admin chat conversations, client chat, AI auto-responses, and surveys.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

logger = logging.getLogger(__name__)

chat_router = APIRouter()
_db = None
_ai_service = None


def init_chat_router(db, ai_service=None):
    global _db, _ai_service
    _db = db
    _ai_service = ai_service


def update_chat_ai_service(ai_svc):
    global _ai_service
    _ai_service = ai_svc


# ================== Auth helpers ==================

async def _auth_user(request: Request):
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        try:
            user = await _db.users.find_one({'_id': ObjectId(session['user_id'])})
        except:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ================== ADMIN - CHAT ==================

@chat_router.get('/admin/chat/conversations')
async def get_admin_conversations(request: Request):
    current_user = await _require_admin(request)
    try:
        result = []
        conversations_col = await _db.conversations.find().sort('updated_at', -1).limit(50).to_list(50)
        
        if conversations_col:
            for conv in conversations_col:
                user_id = conv.get('user_id') or conv.get('client_id')
                if not user_id:
                    continue
                
                user_name = conv.get('client_name') or conv.get('user_name')
                user_email = conv.get('client_email') or conv.get('user_email', '')
                
                if not user_name:
                    try:
                        user = None
                        if ObjectId.is_valid(str(user_id)):
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        if not user:
                            user = await _db.users.find_one({'_id': user_id})
                        if not user:
                            user = await _db.users.find_one({'id': user_id})
                        if user:
                            user_name = user.get('name', user.get('full_name', 'Usuario'))
                            user_email = user.get('email', '')
                    except:
                        pass
                
                if not user_name:
                    user_name = 'Usuario'
                
                unread_count = conv.get('unread_count_admin', 0)
                if unread_count == 0:
                    unread_count = await _db.chat_messages.count_documents({
                        'conversation_id': str(conv.get('_id', conv.get('conversation_id'))),
                        '$or': [{'read': False}, {'is_read': False}],
                        'sender_role': {'$ne': 'admin'}
                    })
                
                result.append({
                    'conversation_id': str(conv.get('_id', conv.get('conversation_id'))),
                    'user_id': str(user_id),
                    'user_name': user_name,
                    'user_email': user_email,
                    'last_message': conv.get('last_message', ''),
                    'last_time': conv.get('updated_at') or conv.get('last_message_at') or conv.get('created_at'),
                    'unread_count': unread_count,
                    'status': conv.get('status', 'active')
                })
        else:
            pipeline = [
                {'$match': {'user_id': {'$ne': None, '$exists': True}}},
                {'$group': {
                    '_id': '$user_id',
                    'last_message': {'$last': '$message'},
                    'last_time': {'$max': '$created_at'},
                    'unread_count': {'$sum': {'$cond': [
                        {'$and': [
                            {'$eq': ['$read', False]},
                            {'$ne': ['$sender_type', 'admin']}
                        ]}, 1, 0
                    ]}}
                }},
                {'$sort': {'last_time': -1}},
                {'$limit': 50}
            ]
            
            conversations = await _db.chat_messages.aggregate(pipeline).to_list(50)
            
            for conv in conversations:
                user_id = conv.get('_id')
                if not user_id or str(user_id) == 'None':
                    continue
                
                user = None
                try:
                    if ObjectId.is_valid(str(user_id)):
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    if not user:
                        user = await _db.users.find_one({'_id': user_id})
                    if not user:
                        user = await _db.users.find_one({'id': user_id})
                except:
                    pass
                
                result.append({
                    'conversation_id': str(user_id),
                    'user_id': str(user_id),
                    'user_name': user.get('name', user.get('full_name', 'Usuario')) if user else 'Usuario',
                    'user_email': user.get('email', '') if user else '',
                    'last_message': conv.get('last_message', ''),
                    'last_time': conv.get('last_time'),
                    'unread_count': conv.get('unread_count', 0)
                })
        
        return {'conversations': result}
    except Exception as e:
        logging.error(f'Error getting conversations: {e}')
        return {'conversations': []}


@chat_router.get('/admin/chat/conversations/{conversation_id}/messages')
async def get_conversation_messages(conversation_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        real_conversation_id = conversation_id
        
        try:
            if ObjectId.is_valid(conversation_id):
                conv = await _db.conversations.find_one({'_id': ObjectId(conversation_id)})
                if conv and conv.get('conversation_id'):
                    real_conversation_id = conv.get('conversation_id')
        except Exception as e:
            logging.debug(f"Could not find conversation by ObjectId: {e}")
        
        messages = await _db.chat_messages.find(
            {'conversation_id': real_conversation_id}
        ).sort('created_at', 1).to_list(100)
        
        if not messages:
            messages = await _db.chat_messages.find(
                {'$or': [
                    {'user_id': conversation_id},
                    {'client_id': conversation_id}
                ]}
            ).sort('created_at', 1).to_list(100)
        
        return {
            'messages': [{
                'id': str(msg.get('_id', msg.get('message_id', ''))),
                'content': msg.get('content') or msg.get('message', ''),
                'sender': msg.get('sender_name', msg.get('sender', 'user')),
                'sender_type': msg.get('sender_role', msg.get('sender_type', 'user')),
                'sender_role': msg.get('sender_role', msg.get('sender_type', 'user')),
                'created_at': msg.get('created_at'),
                'read': msg.get('is_read', msg.get('read', True))
            } for msg in messages]
        }
    except Exception as e:
        logging.error(f'Error getting messages: {e}')
        import traceback
        traceback.print_exc()
        return {'messages': []}


@chat_router.post('/admin/chat/conversations/{conversation_id}/messages')
async def send_admin_message(conversation_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        message_data = await request.json()
        message_doc = {
            'user_id': conversation_id,
            'message': message_data.get('message', ''),
            'sender': 'admin',
            'admin_id': current_user['id'],
            'created_at': datetime.now(timezone.utc),
            'read': False
        }
        
        result = await _db.chat_messages.insert_one(message_doc)
        
        return {
            'success': True,
            'message_id': str(result.inserted_id)
        }
    except Exception as e:
        logging.error(f'Error sending message: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@chat_router.post('/admin/chat/conversations/{conversation_id}/read')
async def mark_conversation_read(conversation_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        await _db.chat_messages.update_many(
            {'user_id': conversation_id, 'sender': 'user'},
            {'$set': {'read': True}}
        )
        return {'success': True}
    except Exception as e:
        logging.error(f'Error marking as read: {e}')
        return {'success': False}


# ================== CLIENT CHAT ENDPOINTS ==================

@chat_router.get('/chat/conversations')
async def get_chat_conversations(request: Request):
    current_user = await _auth_user(request)
    try:
        is_admin = current_user.get('role') in ['admin', 'office_assistant']
        
        if is_admin:
            conversations = await _db.conversations.find().sort('updated_at', -1).limit(50).to_list(50)
            
            result = []
            for conv in conversations:
                user_id = conv.get('user_id') or conv.get('client_id')
                if not user_id:
                    continue
                
                user_name = conv.get('client_name') or conv.get('user_name')
                user_email = conv.get('client_email') or conv.get('user_email', '')
                
                if not user_name:
                    try:
                        user = None
                        if ObjectId.is_valid(str(user_id)):
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        if not user:
                            user = await _db.users.find_one({'_id': user_id})
                        if not user:
                            user = await _db.users.find_one({'id': user_id})
                        if user:
                            user_name = user.get('name', user.get('full_name', 'Cliente'))
                            user_email = user.get('email', '')
                    except:
                        pass
                
                if not user_name:
                    user_name = 'Cliente'
                
                unread_count = conv.get('unread_count_admin', 0)
                if unread_count == 0:
                    unread_count = await _db.chat_messages.count_documents({
                        'conversation_id': str(conv.get('_id')),
                        '$or': [{'read': False}, {'is_read': False}],
                        'sender_role': {'$ne': 'admin'}
                    })
                
                result.append({
                    'conversation_id': str(conv.get('_id')),
                    'user_id': str(user_id),
                    'client_id': str(user_id),
                    'client_name': user_name,
                    'user_name': user_name,
                    'client_email': user_email,
                    'user_email': user_email,
                    'last_message': conv.get('last_message', ''),
                    'last_message_at': conv.get('updated_at') or conv.get('last_message_at'),
                    'last_time': conv.get('updated_at') or conv.get('last_message_at'),
                    'unread_count_admin': unread_count,
                    'unread_count': unread_count,
                    'status': conv.get('status', 'active')
                })
            
            return {'conversations': result, 'total_unread': sum(c['unread_count'] for c in result)}
        else:
            client_id = str(current_user.get('id') or current_user.get('_id'))
            conv = await _db.conversations.find_one({'$or': [
                {'user_id': client_id},
                {'client_id': client_id}
            ]})
            
            if conv:
                return {'conversations': [{
                    'conversation_id': str(conv['_id']),
                    'client_id': client_id,
                    'status': conv.get('status', 'active')
                }]}
            return {'conversations': []}
            
    except Exception as e:
        logging.error(f'Error getting chat conversations: {e}')
        return {'conversations': [], 'total_unread': 0}


@chat_router.post('/chat/conversations')
async def create_or_get_conversation(request: Request):
    current_user = await _auth_user(request)
    try:
        data = await request.json()
        client_id = data.get('client_id') or current_user.get('id') or current_user.get('_id')
        
        if not client_id:
            raise HTTPException(status_code=400, detail='Client ID required')
        
        client_id_str = str(client_id)
        
        existing = await _db.chat_conversations.find_one({'client_id': client_id_str})
        
        if existing:
            return {
                'conversation_id': str(existing['_id']),
                'client_id': client_id_str,
                'created_at': existing.get('created_at')
            }
        
        conversation_doc = {
            'client_id': client_id_str,
            'client_name': current_user.get('name') or current_user.get('full_name', 'Cliente'),
            'client_email': current_user.get('email', ''),
            'status': 'active',
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        
        result = await _db.chat_conversations.insert_one(conversation_doc)
        
        initial_message = data.get('initial_message')
        if initial_message:
            message_doc = {
                'conversation_id': str(result.inserted_id),
                'sender_id': client_id_str,
                'sender_name': current_user.get('name') or current_user.get('full_name', 'Cliente'),
                'sender_role': 'client',
                'content': initial_message,
                'message_type': 'text',
                'is_read': False,
                'created_at': datetime.now(timezone.utc),
            }
            await _db.chat_messages_v2.insert_one(message_doc)
        
        return {
            'conversation_id': str(result.inserted_id),
            'client_id': client_id_str,
            'created_at': conversation_doc['created_at']
        }
    except Exception as e:
        logging.error(f'Error creating conversation: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@chat_router.get('/chat/conversations/{conversation_id}/messages')
async def get_client_messages(conversation_id: str, request: Request):
    current_user = await _auth_user(request)
    try:
        messages = await _db.chat_messages_v2.find(
            {'conversation_id': conversation_id}
        ).sort('created_at', 1).to_list(100)
        
        return {
            'messages': [{
                'message_id': str(msg['_id']),
                'sender_id': msg.get('sender_id', ''),
                'sender_name': msg.get('sender_name', ''),
                'sender_role': msg.get('sender_role', 'client'),
                'content': msg.get('content', ''),
                'message_type': msg.get('message_type', 'text'),
                'file_url': msg.get('file_url'),
                'file_name': msg.get('file_name'),
                'is_read': msg.get('is_read', False),
                'created_at': msg.get('created_at').isoformat() if msg.get('created_at') else None,
            } for msg in messages]
        }
    except Exception as e:
        logging.error(f'Error getting messages: {e}')
        return {'messages': []}


@chat_router.post('/chat/messages')
async def send_client_message(request: Request):
    current_user = await _auth_user(request)
    try:
        data = await request.json()
        conversation_id = data.get('conversation_id')
        if not conversation_id:
            raise HTTPException(status_code=400, detail='Conversation ID required')
        
        client_id = current_user.get('id') or current_user.get('_id')
        language = data.get('language', 'es')
        
        request_sender_id = data.get('sender_id', '')
        is_ai_message = request_sender_id == 'ai_assistant'
        
        message_doc = {
            'conversation_id': conversation_id,
            'sender_id': 'ai_assistant' if is_ai_message else str(client_id),
            'sender_name': 'Ross AI' if is_ai_message else (current_user.get('name') or current_user.get('full_name', 'Cliente')),
            'sender_role': 'support' if is_ai_message else 'client',
            'content': data.get('content', ''),
            'message_type': data.get('message_type', 'text'),
            'file_url': data.get('file_url'),
            'file_name': data.get('file_name'),
            'file_size': data.get('file_size'),
            'is_read': False,
            'is_ai': is_ai_message,
            'created_at': datetime.now(timezone.utc),
        }
        
        result = await _db.chat_messages_v2.insert_one(message_doc)
        
        await _db.chat_conversations.update_one(
            {'_id': ObjectId(conversation_id)},
            {'$set': {'updated_at': datetime.now(timezone.utc)}}
        )
        
        if not is_ai_message and data.get('message_type', 'text') == 'text':
            try:
                user_content = data.get('content', '')
                
                recent_msgs = await _db.chat_messages_v2.find(
                    {'conversation_id': conversation_id}
                ).sort('created_at', -1).limit(10).to_list(10)
                
                chat_history = []
                for msg in reversed(recent_msgs):
                    chat_history.append({
                        'role': 'user' if msg.get('sender_role') == 'client' else 'assistant',
                        'content': msg.get('content', '')
                    })
                
                if _ai_service and hasattr(_ai_service, 'chat_with_assistant'):
                    ai_response = await _ai_service.chat_with_assistant(
                        user_content,
                        f"support_chat_{client_id}",
                        chat_history,
                        language=language
                    )
                    
                    if ai_response:
                        ai_msg_doc = {
                            'conversation_id': conversation_id,
                            'sender_id': 'ai_assistant',
                            'sender_name': 'Ross AI',
                            'sender_role': 'support',
                            'content': ai_response,
                            'message_type': 'text',
                            'is_read': False,
                            'is_ai': True,
                            'created_at': datetime.now(timezone.utc),
                        }
                        await _db.chat_messages_v2.insert_one(ai_msg_doc)
            except Exception as ai_err:
                logging.error(f'AI auto-response error: {ai_err}')
        
        return {
            'success': True,
            'message_id': str(result.inserted_id),
            'created_at': message_doc['created_at'].isoformat()
        }
    except Exception as e:
        logging.error(f'Error sending message: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@chat_router.post('/chat/messages/read')
async def mark_messages_read(request: Request):
    current_user = await _auth_user(request)
    try:
        data = await request.json()
        conversation_id = data.get('conversation_id')
        message_ids = data.get('message_ids', [])
        
        if not conversation_id or not message_ids:
            return {'success': True}
        
        object_ids = []
        for mid in message_ids:
            try:
                object_ids.append(ObjectId(mid))
            except:
                pass
        
        if object_ids:
            await _db.chat_messages_v2.update_many(
                {'_id': {'$in': object_ids}},
                {'$set': {'is_read': True}}
            )
        
        return {'success': True}
    except Exception as e:
        logging.error(f'Error marking messages as read: {e}')
        return {'success': False}


@chat_router.post('/chat/survey')
async def submit_chat_survey(request: Request):
    current_user = await _auth_user(request)
    try:
        data = await request.json()
        conversation_id = data.get('conversation_id')
        rating = data.get('rating', 0)
        comment = data.get('comment', '')
        
        if not conversation_id or rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail='Invalid survey data')
        
        survey = {
            'conversation_id': conversation_id,
            'user_id': current_user.get('id'),
            'rating': rating,
            'comment': comment,
            'created_at': datetime.now(timezone.utc)
        }
        
        await _db.chat_surveys.insert_one(survey)
        
        if ObjectId.is_valid(conversation_id):
            await _db.chat_conversations.update_one(
                {'_id': ObjectId(conversation_id)},
                {'$set': {'survey_rating': rating, 'survey_submitted_at': datetime.now(timezone.utc)}}
            )
        
        logging.info(f"⭐ Chat survey submitted: {rating} stars for conversation {conversation_id}")
        
        return {'success': True, 'message': 'Survey submitted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error submitting chat survey: {e}')
        raise HTTPException(status_code=500, detail=str(e))
