"""
Admin Notifications Routes Router (Push + SMS)
Extracted from server.py for modularization.
Handles admin push notifications sending, SMS campaigns, and notification preferences.
"""
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Query, Body
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

admin_notifications_router = APIRouter()
_db = None


def init_admin_notifications_router(db):
    global _db
    _db = db


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


# ================== Pydantic Models ==================

class PushNotificationRequest(BaseModel):
    title: str
    body: str
    target: str = 'all'
    user_ids: Optional[List[str]] = None
    data: Optional[dict] = None


class SMSRequest(BaseModel):
    message: str
    phone_numbers: Optional[List[str]] = None
    target: str = 'all'
    user_ids: Optional[List[str]] = None


# ================== PUSH NOTIFICATION ENDPOINTS ==================

@admin_notifications_router.post('/admin/push-notifications/send')
async def send_admin_push_notification(request: Request):
    current_user = await _require_admin(request)
    try:
        body = await request.json()
        title = body.get('title', '')
        message_body = body.get('body', '')
        target = body.get('target', 'all')
        user_ids = body.get('user_ids', [])
        data = body.get('data', {})
        
        if not title or not message_body:
            raise HTTPException(status_code=400, detail="Title and body required")
        
        import requests as http_requests
        
        query = {}
        if target == 'specific' and user_ids:
            object_ids = []
            for uid in user_ids:
                try:
                    object_ids.append(ObjectId(uid))
                except:
                    pass
            query = {
                '$or': [
                    {'_id': {'$in': object_ids + user_ids}},
                    {'id': {'$in': user_ids}}
                ]
            }
        else:
            query = {'push_token': {'$exists': True, '$ne': None}}
        
        users = await _db.users.find(query).to_list(None)
        
        sent_count = 0
        failed_count = 0
        tokens_tried = 0
        
        for user in users:
            push_token = user.get('push_token') or user.get('fcm_token') or user.get('expoPushToken')
            
            if not push_token:
                continue
            
            tokens_tried += 1
            
            if push_token.startswith('ExponentPushToken'):
                try:
                    response = http_requests.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": push_token,
                            "title": title,
                            "body": message_body,
                            "data": data or {},
                            "sound": "default",
                            "priority": "high"
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result.get('data', {}).get('status') == 'ok':
                            sent_count += 1
                        else:
                            failed_count += 1
                            logging.warning(f"Push failed for {user.get('name')}: {result}")
                    else:
                        failed_count += 1
                except Exception as e:
                    failed_count += 1
                    logging.error(f"Push error for {user.get('name')}: {e}")
        
        await _db.push_notification_history.insert_one({
            'title': title,
            'body': message_body,
            'target': target,
            'user_ids': user_ids,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'tokens_tried': tokens_tried,
            'sent_by': current_user.get('email'),
            'created_at': datetime.now(timezone.utc)
        })
        
        return {
            'success': True,
            'message': f'Notificaciones enviadas',
            'sent': sent_count,
            'failed': failed_count,
            'total_tokens': tokens_tried
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending push notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_notifications_router.get('/admin/push-notifications/stats')
async def get_push_notification_stats(request: Request):
    current_user = await _require_admin(request)
    try:
        total_with_token = await _db.users.count_documents({
            'push_token': {'$exists': True, '$ne': None}
        })
        
        total_users = await _db.users.count_documents({'role': {'$nin': ['admin', 'office_assistant']}})
        
        history = await _db.push_notification_history.find().sort('created_at', -1).limit(20).to_list(20)
        
        for h in history:
            h['_id'] = str(h['_id'])
            if h.get('created_at'):
                h['created_at'] = h['created_at'].isoformat()
        
        return {
            'stats': {
                'total_users': total_users,
                'users_with_token': total_with_token,
                'adoption_rate': round((total_with_token / total_users * 100) if total_users > 0 else 0, 1)
            },
            'history': history
        }
    except Exception as e:
        logging.error(f"Error getting push stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_notifications_router.get('/admin/push-notifications/users')
async def get_push_notification_users(request: Request):
    current_user = await _require_admin(request)
    try:
        users = await _db.users.find({
            'push_token': {'$exists': True, '$ne': None},
            'role': {'$nin': ['admin', 'office_assistant']}
        }).to_list(500)
        
        return {
            'users': [{
                'id': str(u['_id']),
                'name': u.get('name', u.get('full_name', 'Sin nombre')),
                'email': u.get('email', ''),
                'push_token': u.get('push_token', '')[:30] + '...' if u.get('push_token') else None,
                'last_login': u.get('last_login').isoformat() if u.get('last_login') else None
            } for u in users]
        }
    except Exception as e:
        logging.error(f"Error getting push users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_notifications_router.post('/admin/push-notifications/test')
async def send_test_push(request: Request):
    current_user = await _require_admin(request)
    try:
        admin_token = current_user.get('push_token') or current_user.get('fcm_token')
        
        if not admin_token:
            return {'success': False, 'message': 'No tienes token de push registrado'}
        
        import requests as http_requests
        response = http_requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={
                "to": admin_token,
                "title": "🔔 Test Notification",
                "body": "¡Las notificaciones push están funcionando correctamente!",
                "sound": "default",
                "data": {"type": "test"}
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        return {
            'success': response.status_code == 200,
            'message': 'Notificación de prueba enviada' if response.status_code == 200 else 'Error enviando'
        }
    except Exception as e:
        logging.error(f"Error sending test push: {e}")
        return {'success': False, 'message': str(e)}


# ================== ADMIN EMAIL ANALYTICS ==================

@admin_notifications_router.get('/admin/email-analytics')
async def get_email_analytics(request: Request):
    current_user = await _require_admin(request)
    try:
        history = await _db.email_history.find().sort('sent_at', -1).limit(100).to_list(100)
        
        total_sent = await _db.email_history.count_documents({})
        total_opened = await _db.email_history.count_documents({'opened': True})
        total_clicked = await _db.email_history.count_documents({'clicked': True})
        
        return {
            'stats': {
                'total_sent': total_sent,
                'total_opened': total_opened,
                'total_clicked': total_clicked,
                'open_rate': round((total_opened / total_sent * 100) if total_sent > 0 else 0, 1),
                'click_rate': round((total_clicked / total_sent * 100) if total_sent > 0 else 0, 1)
            },
            'history': [{
                'id': str(h['_id']),
                'to': h.get('to', ''),
                'subject': h.get('subject', ''),
                'type': h.get('type', 'general'),
                'opened': h.get('opened', False),
                'clicked': h.get('clicked', False),
                'sent_at': h.get('sent_at').isoformat() if h.get('sent_at') else None
            } for h in history]
        }
    except Exception as e:
        logging.error(f"Error getting email analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== SMS NOTIFICATIONS ==================

@admin_notifications_router.post('/admin/sms/send')
async def send_admin_sms(request: Request):
    current_user = await _require_admin(request)
    try:
        body = await request.json()
        message = body.get('message', '')
        target = body.get('target', 'all')
        user_ids = body.get('user_ids', [])
        phone_numbers = body.get('phone_numbers', [])
        
        if not message:
            raise HTTPException(status_code=400, detail="Message required")
        
        from twilio.rest import Client as TwilioClient
        
        twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if not all([twilio_sid, twilio_token, twilio_phone]):
            raise HTTPException(status_code=400, detail="Twilio not configured")
        
        twilio_client = TwilioClient(twilio_sid, twilio_token)
        
        numbers_to_send = []
        
        if phone_numbers:
            numbers_to_send = phone_numbers
        elif target == 'specific' and user_ids:
            object_ids = []
            for uid in user_ids:
                try:
                    object_ids.append(ObjectId(uid))
                except:
                    pass
            users = await _db.users.find({
                '$or': [
                    {'_id': {'$in': object_ids + user_ids}},
                    {'id': {'$in': user_ids}}
                ]
            }).to_list(None)
            numbers_to_send = [u.get('phone') for u in users if u.get('phone')]
        else:
            users = await _db.users.find({
                'phone': {'$exists': True, '$ne': None, '$ne': ''},
                'role': {'$nin': ['admin', 'office_assistant']}
            }).to_list(None)
            numbers_to_send = [u.get('phone') for u in users if u.get('phone')]
        
        sent_count = 0
        failed_count = 0
        
        for phone in numbers_to_send:
            try:
                clean_phone = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                if not clean_phone.startswith('+'):
                    clean_phone = '+1' + clean_phone
                
                twilio_client.messages.create(
                    body=message,
                    from_=twilio_phone,
                    to=clean_phone
                )
                sent_count += 1
            except Exception as e:
                failed_count += 1
                logging.warning(f"SMS failed to {phone}: {e}")
        
        await _db.sms_history.insert_one({
            'message': message,
            'target': target,
            'sent_count': sent_count,
            'failed_count': failed_count,
            'total_numbers': len(numbers_to_send),
            'sent_by': current_user.get('email'),
            'created_at': datetime.now(timezone.utc)
        })
        
        return {
            'success': True,
            'message': f'SMS enviados',
            'sent': sent_count,
            'failed': failed_count,
            'total': len(numbers_to_send)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending SMS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_notifications_router.get('/admin/sms/stats')
async def get_sms_stats(request: Request):
    current_user = await _require_admin(request)
    try:
        total_with_phone = await _db.users.count_documents({
            'phone': {'$exists': True, '$ne': None, '$ne': ''},
            'role': {'$nin': ['admin', 'office_assistant']}
        })
        
        total_users = await _db.users.count_documents({'role': {'$nin': ['admin', 'office_assistant']}})
        
        history = await _db.sms_history.find().sort('created_at', -1).limit(20).to_list(20)
        for h in history:
            h['_id'] = str(h['_id'])
            if h.get('created_at'):
                h['created_at'] = h['created_at'].isoformat()
        
        return {
            'stats': {
                'total_users': total_users,
                'users_with_phone': total_with_phone,
                'phone_rate': round((total_with_phone / total_users * 100) if total_users > 0 else 0, 1)
            },
            'history': history
        }
    except Exception as e:
        logging.error(f"Error getting SMS stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_notifications_router.post('/admin/sms/test')
async def send_test_sms(request: Request):
    current_user = await _require_admin(request)
    try:
        body = await request.json()
        test_phone = body.get('phone', '')
        
        if not test_phone:
            raise HTTPException(status_code=400, detail="Phone number required")
        
        from twilio.rest import Client as TwilioClient
        
        twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if not all([twilio_sid, twilio_token, twilio_phone]):
            raise HTTPException(status_code=400, detail="Twilio not configured")
        
        twilio_client = TwilioClient(twilio_sid, twilio_token)
        
        clean_phone = test_phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not clean_phone.startswith('+'):
            clean_phone = '+1' + clean_phone
        
        twilio_client.messages.create(
            body="🔔 Test SMS - Ross Tax Preparation. ¡Los SMS están funcionando correctamente!",
            from_=twilio_phone,
            to=clean_phone
        )
        
        return {'success': True, 'message': 'SMS de prueba enviado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending test SMS: {e}")
        return {'success': False, 'message': str(e)}


# ================== NOTIFICATION PREFERENCES ==================

@admin_notifications_router.get('/notifications/preferences')
async def get_notification_preferences(request: Request):
    current_user = await _auth_user(request)
    try:
        prefs = await _db.notification_preferences.find_one({'user_id': current_user['id']})
        
        if not prefs:
            default_prefs = {
                'push_enabled': True,
                'email_enabled': True,
                'sms_enabled': True,
                'marketing_emails': True,
                'appointment_reminders': True,
                'document_updates': True,
                'tax_status_updates': True,
                'chat_notifications': True,
                'promotions': False
            }
            return default_prefs
        
        prefs.pop('_id', None)
        prefs.pop('user_id', None)
        return prefs
    except Exception as e:
        logging.error(f"Error getting notification preferences: {e}")
        return {}


@admin_notifications_router.put('/notifications/preferences')
async def update_notification_preferences(request: Request):
    current_user = await _auth_user(request)
    try:
        body = await request.json()
        
        await _db.notification_preferences.update_one(
            {'user_id': current_user['id']},
            {'$set': {
                **body,
                'user_id': current_user['id'],
                'updated_at': datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        return {'success': True, 'message': 'Preferencias actualizadas'}
    except Exception as e:
        logging.error(f"Error updating notification preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))
