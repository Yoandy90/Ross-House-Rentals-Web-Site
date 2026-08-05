"""
Misc Extracted Routes Router
Extracted from server.py for modularization.
Handles analytics, notifications, campaigns, tax declarations,
Square appointments integration, and queue/turnos system.
"""
import os
import logging
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Literal
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId

logger = logging.getLogger(__name__)

misc_extracted_router = APIRouter()
_db = None

def init_misc_extracted_router(db):
    global _db
    _db = db

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user


# ================== ANALYTICS ROUTES ==================
# ================== ANALYTICS ROUTES ==================
# NOTE: Removed duplicate /admin/appointments endpoint here - use the one at line ~6055 which returns { appointments: [...] }

@misc_extracted_router.get('/admin/analytics/overview')
async def get_analytics_overview(current_user: dict = Depends(_get_current_user)):
    """Get comprehensive analytics overview"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Get date ranges
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        
        # Total counts
        total_clients = await _db.users.count_documents({'role': 'client'})
        total_documents = await _db.documents.count_documents({})
        total_appointments = await _db.appointments.count_documents({})
        total_tax_returns = await _db.completed_tax_returns.count_documents({})
        
        # New clients (last 30 days)
        new_clients = await _db.users.count_documents({
            'role': 'client',
            'created_at': {'$gte': thirty_days_ago}
        })
        
        # Documents uploaded (last 30 days)
        recent_documents = await _db.documents.count_documents({
            'uploaded_at': {'$gte': thirty_days_ago}
        })
        
        # Completed appointments (last 30 days)
        completed_appointments = await _db.appointments.count_documents({
            'status': 'completed',
            'scheduled_at': {'$gte': thirty_days_ago}
        })
        
        # KYC completion rate
        total_kyc = await _db.kyc_data.count_documents({})
        completed_kyc = await _db.kyc_data.count_documents({'completed': True})
        kyc_completion_rate = (completed_kyc / total_kyc * 100) if total_kyc > 0 else 0
        
        # Average documents per client
        avg_docs_per_client = total_documents / total_clients if total_clients > 0 else 0
        
        return {
            'total_clients': total_clients,
            'total_documents': total_documents,
            'total_appointments': total_appointments,
            'total_tax_returns': total_tax_returns,
            'new_clients_30d': new_clients,
            'recent_documents_30d': recent_documents,
            'completed_appointments_30d': completed_appointments,
            'kyc_completion_rate': round(kyc_completion_rate, 2),
            'avg_docs_per_client': round(avg_docs_per_client, 2),
        }
    except Exception as e:
        logging.error(f'Error getting analytics overview: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/admin/analytics/dashboard-charts')
async def get_dashboard_charts(current_user: dict = Depends(_get_current_user)):
    """Get data for dashboard charts - revenue, clients, projects"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        now = datetime.now(timezone.utc)
        
        # === 1. INGRESOS MENSUALES (últimos 6 meses) ===
        monthly_revenue = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0)
            if i > 0:
                month_end = (month_start + timedelta(days=32)).replace(day=1)
            else:
                month_end = now
            
            # Sumar facturas pagadas del mes
            pipeline = [
                {'$match': {
                    'status': 'paid',
                    'paid_at': {'$gte': month_start, '$lt': month_end}
                }},
                {'$group': {'_id': None, 'total': {'$sum': '$total'}}}
            ]
            result = await _db.invoices.aggregate(pipeline).to_list(1)
            revenue = result[0]['total'] if result else 0
            
            monthly_revenue.append({
                'month': month_start.strftime('%b'),
                'year': month_start.year,
                'revenue': round(revenue, 2)
            })
        
        # === 2. CLIENTES NUEVOS POR SEMANA (últimas 8 semanas) ===
        weekly_clients = []
        for i in range(7, -1, -1):
            week_start = now - timedelta(weeks=i, days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            week_end = week_start + timedelta(days=7)
            
            count = await _db.users.count_documents({
                'role': 'client',
                'created_at': {'$gte': week_start, '$lt': week_end}
            })
            
            weekly_clients.append({
                'week': f'Sem {8-i}',
                'start_date': week_start.strftime('%d/%m'),
                'count': count
            })
        
        # === 3. PROYECTOS POR ESTADO ===
        project_status = {}
        for status in ['pending', 'in_progress', 'completed', 'cancelled']:
            count = await _db.service_orders.count_documents({'status': status})
            project_status[status] = count
        
        # === 4. TOP 5 SERVICIOS MÁS SOLICITADOS ===
        service_pipeline = [
            {'$group': {'_id': '$service_type', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        top_services = await _db.service_orders.aggregate(service_pipeline).to_list(5)
        
        service_labels = {
            'tax_preparation': 'Prep. Impuestos',
            'tax_consultation': 'Consultoría',
            'tax_planning': 'Planificación',
            'tax_amendment': 'Enmiendas',
            'itin_application': 'ITIN',
            'bookkeeping': 'Contabilidad',
            'irs_audit': 'Auditoría IRS',
            'other': 'Otros'
        }
        
        top_services_formatted = [
            {
                'service': service_labels.get(s['_id'], s['_id']),
                'count': s['count']
            }
            for s in top_services if s['_id']
        ]
        
        # === 5. FACTURAS PENDIENTES ===
        pending_invoices = await _db.invoices.count_documents({'status': 'pending'})
        overdue_invoices = await _db.invoices.count_documents({
            'status': 'pending',
            'due_date': {'$lt': now}
        })
        
        pending_amount_pipeline = [
            {'$match': {'status': 'pending'}},
            {'$group': {'_id': None, 'total': {'$sum': '$total'}}}
        ]
        pending_result = await _db.invoices.aggregate(pending_amount_pipeline).to_list(1)
        pending_amount = pending_result[0]['total'] if pending_result else 0
        
        # === 6. CITAS DE HOY ===
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        today_appointments = await _db.appointments.count_documents({
            'scheduled_at': {'$gte': today_start, '$lt': today_end}
        })
        
        return {
            'monthly_revenue': monthly_revenue,
            'weekly_clients': weekly_clients,
            'project_status': project_status,
            'top_services': top_services_formatted,
            'invoices': {
                'pending_count': pending_invoices,
                'overdue_count': overdue_invoices,
                'pending_amount': round(pending_amount, 2)
            },
            'today_appointments': today_appointments,
            'generated_at': now.isoformat()
        }
        
    except Exception as e:
        logging.error(f'Error getting dashboard charts: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.get('/admin/analytics/trends')
async def get_analytics_trends(
    days: int = 30,
    current_user: dict = Depends(_get_current_user)
):
    """Get trends data for charts"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)
        
        # Get daily client registrations
        clients_pipeline = [
            {
                '$match': {
                    'role': 'client',
                    'created_at': {'$gte': start_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        '$dateToString': {
                            'format': '%Y-%m-%d',
                            'date': '$created_at'
                        }
                    },
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'_id': 1}}
        ]
        clients_trend = await _db.users.aggregate(clients_pipeline).to_list(None)
        
        # Get daily documents uploaded
        docs_pipeline = [
            {
                '$match': {
                    'uploaded_at': {'$gte': start_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        '$dateToString': {
                            'format': '%Y-%m-%d',
                            'date': '$uploaded_at'
                        }
                    },
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'_id': 1}}
        ]
        docs_trend = await _db.documents.aggregate(docs_pipeline).to_list(None)
        
        # Get daily appointments
        appts_pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': start_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        '$dateToString': {
                            'format': '%Y-%m-%d',
                            'date': '$created_at'
                        }
                    },
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'_id': 1}}
        ]
        appts_trend = await _db.appointments.aggregate(appts_pipeline).to_list(None)
        
        return {
            'clients': [{'date': item['_id'], 'count': item['count']} for item in clients_trend],
            'documents': [{'date': item['_id'], 'count': item['count']} for item in docs_trend],
            'appointments': [{'date': item['_id'], 'count': item['count']} for item in appts_trend],
        }
    except Exception as e:
        logging.error(f'Error getting analytics trends: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.get('/admin/analytics/document-categories')
async def get_document_categories_stats(current_user: dict = Depends(_get_current_user)):
    """Get document distribution by category"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        pipeline = [
            {
                '$group': {
                    '_id': '$category',
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'count': -1}}
        ]
        
        categories = await _db.documents.aggregate(pipeline).to_list(None)
        
        return [
            {'category': item['_id'], 'count': item['count']}
            for item in categories
        ]
    except Exception as e:
        logging.error(f'Error getting document categories: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.get('/admin/analytics/appointment-status')
async def get_appointment_status_stats(current_user: dict = Depends(_get_current_user)):
    """Get appointment distribution by status"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        pipeline = [
            {
                '$group': {
                    '_id': '$status',
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'count': -1}}
        ]
        
        statuses = await _db.appointments.aggregate(pipeline).to_list(None)
        
        return [
            {'status': item['_id'], 'count': item['count']}
            for item in statuses
        ]
    except Exception as e:
        logging.error(f'Error getting appointment statuses: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== NOTIFICATIONS ROUTES ==================
# ================== NOTIFICATIONS ROUTES ==================

@misc_extracted_router.post('/notifications/register-token')
async def register_push_token(
    request: Request,
    current_user: dict = Depends(_get_current_user)
):
    """Register push notification token for user (Expo or FCM)"""
    try:
        body = await request.json()
        token = body.get('push_token') or body.get('token')
        token_type = body.get('token_type', 'expo')
        push_enabled = body.get('push_enabled', True)
        
        update_data = {
            'push_enabled': push_enabled,
            'push_token_type': token_type,
            'device_type': body.get('device_type', 'unknown'),
        }
        
        if not push_enabled or not token:
            # User is disabling push
            update_data['push_enabled'] = False
            update_data['push_token'] = None
            update_data['expo_push_token'] = None
        elif token_type == "fcm":
            update_data['fcm_token'] = token
            update_data['push_token'] = token
        else:
            update_data['push_token'] = token
            update_data['expo_push_token'] = token
        
        # Remove this push token from ALL other users to prevent
        # duplicate notifications when switching accounts on the same device
        if token and push_enabled:
            await _db.users.update_many(
                {
                    '_id': {'$ne': current_user['id']},
                    '$or': [
                        {'push_token': token},
                        {'expo_push_token': token},
                        {'fcm_token': token}
                    ]
                },
                {'$set': {'push_token': None, 'expo_push_token': None, 'fcm_token': None}}
            )
            logging.info(f"🔄 Cleared push token from other users for device handoff to user {current_user['id']}")
        
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': update_data}
        )
        
        logging.info(f"✅ Push token registered for user {current_user['id']} (type: {token_type}, enabled: {push_enabled})")
        return {'success': True, 'message': 'Token registered successfully', 'token_type': token_type, 'push_token': token}
    except Exception as e:
        logging.error(f'Error registering token: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.post('/notifications/send-test')
async def send_test_push_notification(
    current_user: dict = Depends(_require_admin)
):
    """Send a test push notification to the admin (Expo or Firebase)"""
    try:
        import requests
        
        # Get the admin's token
        admin = await _db.users.find_one({'_id': current_user['id']})
        
        if not admin:
            raise HTTPException(status_code=404, detail="User not found")
        
        push_token = admin.get('push_token') or admin.get('fcm_token')
        token_type = admin.get('push_token_type', 'expo')
        
        if not push_token:
            raise HTTPException(status_code=400, detail="No push token registered. Please allow notifications in the app first.")
        
        logging.info(f"📱 Sending test notification - Token type: {token_type}, Token: {push_token[:30]}...")
        
        # Use Expo Push API for Expo tokens
        if push_token.startswith('ExponentPushToken[') or token_type == 'expo':
            EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
            
            message = {
                "to": push_token,
                "title": "🔔 Prueba de Notificación",
                "body": "¡Las notificaciones push están funcionando correctamente!",
                "sound": "default",
                "priority": "high",
                "data": {"type": "test", "timestamp": datetime.utcnow().isoformat()}
            }
            
            response = requests.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            result = response.json()
            logging.info(f"📤 Expo Push response: {result}")
            
            if response.status_code == 200 and result.get('data', {}).get('status') == 'ok':
                return {'success': True, 'message': 'Test notification sent via Expo'}
            else:
                error_msg = result.get('data', {}).get('message') or result.get('errors', [{}])[0].get('message', 'Unknown error')
                return {'success': False, 'error': f'Expo Push error: {error_msg}'}
        
        else:
            # Use Firebase for FCM/APNs tokens
            from firebase_push_service import firebase_push_service
            
            result = await firebase_push_service.send_to_device(
                token=push_token,
                title="🔔 Prueba de Notificación",
                body="¡Las notificaciones push están funcionando correctamente!",
                data={"type": "test", "timestamp": datetime.utcnow().isoformat()}
            )
            
            if result and result.get('success'):
                return {
                    'success': True,
                    'message': 'Test notification sent via Firebase',
                    'message_id': result.get('message_id')
                }
            else:
                return {
                    'success': False,
                    'error': result.get('error', 'Unknown error')
                }
            
    except ImportError:
        return {'success': False, 'error': 'Push service not available'}
    except Exception as e:
        logging.error(f'Error sending test push: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.post('/notifications/send-to-user/{user_id}')
async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: dict = None,
    current_user: dict = Depends(_require_admin)
):
    """Send push notification to a specific user (Admin only)"""
    try:
        from firebase_push_service import firebase_push_service
        
        # Get user's token
        user = await _db.users.find_one({'_id': user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        fcm_token = user.get('fcm_token') or user.get('push_token')
        if not fcm_token:
            raise HTTPException(status_code=400, detail="User has no push token")
        
        # Send notification
        result = await firebase_push_service.send_to_device(
            token=fcm_token,
            title=title,
            body=body,
            data=data or {}
        )
        
        # Log the notification
        await _db.notifications.insert_one({
            'user_id': user_id,
            'title': title,
            'body': body,
            'type': 'push',
            'sent_by': current_user['id'],
            'created_at': datetime.utcnow(),
            'read': False,
            'fcm_result': result
        })
        
        return result
        
    except ImportError:
        return {'success': False, 'error': 'Firebase service not available'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error sending push to user: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.post('/notifications/send-to-all')
async def send_push_to_all_users(
    title: str,
    body: str,
    data: dict = None,
    current_user: dict = Depends(_require_admin)
):
    """Send push notification to all users with tokens (Admin only)"""
    try:
        from firebase_push_service import firebase_push_service
        
        # Get all users with push tokens
        users = await _db.users.find({
            '$or': [
                {'fcm_token': {'$exists': True, '$ne': None}},
                {'push_token': {'$exists': True, '$ne': None}}
            ],
            'push_enabled': True
        }).to_list(None)
        
        tokens = []
        for user in users:
            token = user.get('fcm_token') or user.get('push_token')
            if token:
                tokens.append(token)
        
        if not tokens:
            return {'success': False, 'error': 'No users with push tokens'}
        
        # Send to all devices
        result = await firebase_push_service.send_to_multiple_devices(
            tokens=tokens,
            title=title,
            body=body,
            data=data or {}
        )
        
        # Log the broadcast notification
        await _db.notifications.insert_one({
            'type': 'broadcast',
            'title': title,
            'body': body,
            'sent_by': current_user['id'],
            'created_at': datetime.utcnow(),
            'recipients_count': len(tokens),
            'fcm_result': result
        })
        
        return result
        
    except ImportError:
        return {'success': False, 'error': 'Firebase service not available'}
    except Exception as e:
        logging.error(f'Error sending broadcast push: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.get('/notifications')
async def get_notifications(
    limit: int = 50,
    app: str = None,
    current_user: dict = Depends(_get_current_user)
):
    """Get user notifications, optionally filtered by app source"""
    try:
        query = {'user_id': current_user['id']}
        
        # Filter notifications by app context
        if app == 'ross_lending':
            # Only show lending-related notification types
            lending_types = [
                'loan_approved', 'loan_rejected', 'loan_application',
                'payment_reminder', 'payment_received', 'payment_overdue',
                'document_request', 'document_approved', 'document_reminder',
                'admin_message', 'chat_message', 'system', 'welcome',
                'lending_general'
            ]
            query['type'] = {'$in': lending_types}
        elif app == 'ross_tax':
            # Exclude lending-specific types for the tax app
            lending_only_types = ['loan_approved', 'loan_rejected', 'loan_application', 'payment_overdue']
            query['type'] = {'$nin': lending_only_types}
        
        notifications = await _db.notifications.find(query).sort('created_at', -1).limit(limit).to_list(None)
        
        # Serialize and normalize field names
        for notif in notifications:
            notif.pop('_id', None)
            # Normalize body/message field - ensure BOTH fields exist
            if 'body' in notif and 'message' not in notif:
                notif['message'] = notif['body']  # Keep body, add message
            elif 'message' in notif and 'body' not in notif:
                notif['body'] = notif['message']  # Keep message, add body
            # Ensure both body and message exist
            if 'body' not in notif and 'message' in notif:
                notif['body'] = notif['message']
            if 'message' not in notif and 'body' in notif:
                notif['message'] = notif['body']
            # Normalize read/is_read field - ensure BOTH fields exist
            if 'read' in notif and 'is_read' not in notif:
                notif['is_read'] = notif['read']
            elif 'is_read' in notif and 'read' not in notif:
                notif['read'] = notif['is_read']
            # Ensure both read and is_read exist
            if 'is_read' not in notif:
                notif['is_read'] = notif.get('read', False)
            if 'read' not in notif:
                notif['read'] = notif.get('is_read', False)
            if notif.get('created_at'):
                if hasattr(notif['created_at'], 'isoformat'):
                    notif['created_at'] = notif['created_at'].isoformat()
            if notif.get('read_at'):
                if hasattr(notif['read_at'], 'isoformat'):
                    notif['read_at'] = notif['read_at'].isoformat()
        
        return notifications
    except Exception as e:
        logging.error(f'Error getting notifications: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.post('/notifications/{notification_id}/read')
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Mark notification as read"""
    try:
        result = await _db.notifications.update_one(
            {'id': notification_id, 'user_id': current_user['id']},
            {'$set': {'read': True, 'read_at': datetime.now(timezone.utc)}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Notification not found')
        
        return {'message': 'Notification marked as read'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error marking notification as read: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== CAMPAIGN ENDPOINTS ==================
# ================== CAMPAIGN ENDPOINTS ==================

@misc_extracted_router.post('/admin/campaigns/app-announcement')
async def send_app_announcement_campaign(
    data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Send app announcement campaign to clients without the app"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        send_email = data.get('send_email', True)
        send_sms = data.get('send_sms', True)
        test_mode = data.get('test_mode', False)  # Solo enviar a 1 para prueba
        
        # Get app store links from settings or use defaults
        settings_doc = await _db.system_settings.find_one({'_id': 'main'})
        settings = settings_doc.get('settings', {}) if settings_doc else {}
        
        ios_link = settings.get('app_store_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120')
        android_link = settings.get('play_store_url', 'https://play.google.com/store/apps/details?id=com.rosstax.app')
        
        # Get clients without app
        clients = await _db.users.find({
            'role': {'$nin': ['admin', 'office_assistant']},
            '$and': [
                {'$or': [
                    {'push_token': {'$exists': False}},
                    {'push_token': None},
                    {'push_token': ''}
                ]},
                {'$or': [
                    {'expo_push_token': {'$exists': False}},
                    {'expo_push_token': None},
                    {'expo_push_token': ''}
                ]},
                {'$or': [
                    {'has_app': {'$exists': False}},
                    {'has_app': False},
                    {'has_app': None}
                ]}
            ]
        }).to_list(1000)
        
        if test_mode:
            clients = clients[:1]  # Solo el primero para prueba
        
        results = {
            'total_clients': len(clients),
            'emails_sent': 0,
            'emails_failed': 0,
            'sms_sent': 0,
            'sms_failed': 0,
            'details': []
        }
        
        # Get notification service config
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail='Notification service not configured')
        
        from notification_service import NotificationService
        notif_svc = NotificationService(config_doc)
        
        for client in clients:
            name = client.get('full_name') or client.get('name') or 'Cliente'
            email = client.get('email', '')
            phone = str(client.get('phone') or '')
            
            client_result = {'name': name, 'email': email, 'phone': phone, 'email_sent': False, 'sms_sent': False}
            
            # Send Email
            if send_email and email and '@' in email and 'placeholder' not in email.lower():
                try:
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">📱 ¡Nuestra App ya está disponible!</h1>
                        </div>
                        <div style="padding: 30px; background: white;">
                            <p style="font-size: 18px;">Hola <strong>{name}</strong>,</p>
                            
                            <p style="font-size: 16px; line-height: 1.6;">
                                ¡Tenemos excelentes noticias! La aplicación móvil de <strong>Ross Tax Preparation</strong> 
                                ya está disponible para descargar.
                            </p>
                            
                            <div style="background: #f0f7ff; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                <h3 style="color: #6C1110; margin-top: 0;">✨ Con nuestra app puedes:</h3>
                                <ul style="line-height: 1.8;">
                                    <li>📅 Agendar citas fácilmente</li>
                                    <li>📄 Subir tus documentos de forma segura</li>
                                    <li>💬 Chatear directamente con nosotros</li>
                                    <li>🔔 Recibir notificaciones importantes</li>
                                    <li>📊 Ver el estado de tus trámites</li>
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <p style="font-weight: bold; margin-bottom: 15px;">Descarga la app ahora:</p>
                                <a href="{ios_link}" style="display: inline-block; background: #000; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; margin: 5px;">
                                    🍎 App Store (iPhone)
                                </a>
                                <br><br>
                                <a href="{android_link}" style="display: inline-block; background: #3DDC84; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; margin: 5px;">
                                    🤖 Google Play (Android)
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                Si tienes alguna pregunta, no dudes en contactarnos.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            
                            <p style="color: #888; font-size: 12px; text-align: center;">
                                📍 305 Bruce Ave, Dumas, TX 79029 | 📞 (806) 934-2018<br>
                                <strong>Ross Tax Preparation</strong>
                            </p>
                        </div>
                    </div>
                    """
                    
                    await notif_svc.send_email(
                        email,
                        '📱 ¡La App de Ross Tax ya está disponible! Descárgala ahora',
                        email_html
                    )
                    client_result['email_sent'] = True
                    results['emails_sent'] += 1
                except Exception as e:
                    logging.error(f"Error sending email to {email}: {e}")
                    results['emails_failed'] += 1
            
            # Send SMS
            if send_sms and phone and len(phone.replace('+', '').replace('-', '').replace(' ', '')) >= 10:
                try:
                    if notif_svc.twilio_client:
                        sms_message = f"""🎉 ¡Hola {name}!

La app de Ross Tax ya está disponible. 

📱 Descárgala GRATIS:
iPhone: {ios_link}

Con la app puedes agendar citas, subir documentos y más.

- Ross Tax Preparation
📞 (806) 934-2018"""
                        
                        clean_phone = phone.replace(' ', '').replace('-', '')
                        if not clean_phone.startswith('+'):
                            clean_phone = '+1' + clean_phone
                        
                        notif_svc.twilio_client.messages.create(
                            body=sms_message,
                            from_=notif_svc.twilio_phone_number,
                            to=clean_phone
                        )
                        client_result['sms_sent'] = True
                        results['sms_sent'] += 1
                except Exception as e:
                    logging.error(f"Error sending SMS to {phone}: {e}")
                    results['sms_failed'] += 1
            
            results['details'].append(client_result)
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.1)
        
        # Log campaign
        await _db.marketing_campaigns.insert_one({
            'type': 'app_announcement',
            'sent_by': str(current_user.get('_id', '')),
            'sent_at': datetime.now(timezone.utc),
            'results': results,
            'test_mode': test_mode
        })
        
        return {
            'success': True,
            'message': f"Campaña {'de prueba ' if test_mode else ''}completada",
            'results': results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in app announcement campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/admin/campaigns/app-announcement/preview')
async def preview_app_campaign(current_user: dict = Depends(_get_current_user)):
    """Preview app announcement campaign stats"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Count clients without app
        total_without_app = await _db.users.count_documents({
            'role': {'$nin': ['admin', 'office_assistant']},
            '$and': [
                {'$or': [
                    {'push_token': {'$exists': False}},
                    {'push_token': None},
                    {'push_token': ''}
                ]},
                {'$or': [
                    {'has_app': {'$exists': False}},
                    {'has_app': False},
                    {'has_app': None}
                ]}
            ]
        })
        
        # Count with valid email
        clients = await _db.users.find({
            'role': {'$nin': ['admin', 'office_assistant']}
        }).to_list(1000)
        
        without_app = [c for c in clients if not c.get('push_token') and not c.get('expo_push_token') and not c.get('has_app')]
        
        with_email = len([c for c in without_app if c.get('email') and '@' in c.get('email', '') and 'placeholder' not in c.get('email', '').lower()])
        with_phone = len([c for c in without_app if c.get('phone') and len(str(c.get('phone', '')).replace('+', '').replace('-', '').replace(' ', '')) >= 10])
        
        return {
            'success': True,
            'stats': {
                'total_without_app': len(without_app),
                'with_valid_email': with_email,
                'with_valid_phone': with_phone
            }
        }
        
    except Exception as e:
        logging.error(f"Error in campaign preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/admin/campaigns/app-announcement/clients')
async def get_clients_without_app(current_user: dict = Depends(_get_current_user)):
    """Get list of clients for campaign targeting"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        logging.info("🔍 Fetching clients for campaigns...")
        
        # Get ALL clients (no limit) - not just those without the app
        # This makes the campaign tool more useful
        clients = await _db.users.find({
            'role': {'$nin': ['admin', 'office_assistant']}
        }).to_list(None)  # None = no limit
        
        logging.info(f"📊 Found {len(clients)} clients in database")
        
        result = []
        clients_with_app = 0
        clients_without_app = 0
        
        for c in clients:
            has_app = bool(c.get('has_app') or c.get('push_token') or c.get('expo_push_token'))
            if has_app:
                clients_with_app += 1
            else:
                clients_without_app += 1
                
            result.append({
                'id': str(c['_id']),
                'name': c.get('full_name') or c.get('name') or 'Sin nombre',
                'email': c.get('email') or '',
                'phone': str(c.get('phone') or ''),
                'has_app': has_app
            })
        
        logging.info(f"✅ Returning {len(result)} clients: {clients_with_app} with app, {clients_without_app} without")
        
        return {
            'success': True, 
            'clients': result,
            'stats': {
                'total': len(result),
                'with_app': clients_with_app,
                'without_app': clients_without_app
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting clients for campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== TAX DECLARATIONS ENDPOINTS ==================
# ================== TAX DECLARATIONS ENDPOINTS ==================

class TaxDeclarationUpload(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    tax_year: int
    pdf_data: str  # Base64 encoded PDF
    appointment_id: Optional[str] = None
    user_email: Optional[str] = None  # For finding client when user_id not in system
    user_phone: Optional[str] = None  # Alternative lookup
    user_name: Optional[str] = None  # Client name for reference

@misc_extracted_router.post('/admin/tax-declarations')
async def upload_tax_declaration(
    data: TaxDeclarationUpload,
    current_user: dict = Depends(_get_current_user)
):
    """Admin uploads a tax declaration PDF for a client"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Verify client exists - try multiple methods
        from bson import ObjectId
        client = None
        
        # Try by string _id
        if data.user_id:
            client = await _db.users.find_one({'_id': data.user_id})
        
        # Try by ObjectId
        if not client and data.user_id and ObjectId.is_valid(data.user_id):
            client = await _db.users.find_one({'_id': ObjectId(data.user_id)})
        
        # Try by id field
        if not client and data.user_id:
            client = await _db.users.find_one({'id': data.user_id})
        
        # Try by email if user_id lookup failed
        if not client and data.user_email:
            client = await _db.users.find_one({'email': data.user_email.lower()})
            logging.info(f"📧 Looking up client by email: {data.user_email}")
        
        # Try by phone if still not found
        if not client and data.user_phone:
            clean_phone = data.user_phone.replace(' ', '').replace('-', '').replace('+1', '').replace('+', '')
            client = await _db.users.find_one({
                '$or': [
                    {'phone': data.user_phone},
                    {'phone': clean_phone},
                    {'phone': '+1' + clean_phone},
                    {'phone': {'$regex': clean_phone, '$options': 'i'}}
                ]
            })
            logging.info(f"📞 Looking up client by phone: {data.user_phone}")
        
        if not client:
            error_msg = f'Cliente no encontrado. Buscado por: user_id={data.user_id}'
            if data.user_email:
                error_msg += f', email={data.user_email}'
            if data.user_phone:
                error_msg += f', phone={data.user_phone}'
            logging.warning(f"⚠️ {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)
        
        # Get the correct user_id from the found client
        actual_user_id = str(client.get('_id'))
        
        # Log for debugging
        logging.info(f"📄 Uploading tax declaration for client: {client.get('full_name') or client.get('name')} (user_id: {actual_user_id})")
        
        declaration_id = str(uuid.uuid4())
        
        declaration = {
            'id': declaration_id,
            'user_id': actual_user_id,  # Use the found client's ID
            'title': data.title,
            'description': data.description,
            'tax_year': data.tax_year,
            'pdf_data': data.pdf_data,
            'appointment_id': data.appointment_id,
            'uploaded_by': current_user.get('id') or str(current_user.get('_id')),
            'uploaded_by_name': current_user.get('name') or current_user.get('full_name'),
            'created_at': datetime.now(timezone.utc),
            'status': 'active'
        }
        
        await _db.tax_declarations.insert_one(declaration)
        
        # Send notification to client
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                
                client_name = client.get('full_name') or client.get('name') or 'Cliente'
                client_email = client.get('email')
                client_phone = str(client.get('phone') or '')
                
                # Links for easy access
                ios_app_link = "https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX"
                web_app_link = "https://www.rosstaxpreparation.com/login"
                
                # Send Email
                if client_email and notif_svc.sendgrid_client:
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">📄 Declaración de Impuestos Lista</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <p style="font-size: 18px;">Hola <strong>{client_name}</strong>,</p>
                            <p>Tu declaración de impuestos <strong>{data.title}</strong> (Año fiscal: {data.tax_year}) ya está disponible.</p>
                            <div style="background: #fff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>📁 Documento:</strong> {data.title}</p>
                                <p style="margin: 5px 0 0;"><strong>📅 Año fiscal:</strong> {data.tax_year}</p>
                            </div>
                            <p style="font-size: 16px; margin-top: 20px;"><strong>Accede a tu declaración:</strong></p>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="{web_app_link}" style="display: inline-block; background: #6C1110; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 5px;">🌐 Abrir en Web</a>
                            </div>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="{ios_app_link}" style="display: inline-block; background: #000; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 5px;">📱 Descargar App iOS</a>
                            </div>
                            <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
                                📍 305 Bruce Ave, Dumas, TX 79029 | 📞 (806) 934-2018<br>
                                <strong>Ross Tax Preparation</strong>
                            </p>
                        </div>
                    </div>
                    """
                    await notif_svc.send_email(
                        client_email,
                        f'📄 Tu declaración de impuestos {data.tax_year} está lista',
                        email_html
                    )
                    logging.info(f"✅ Tax declaration email sent to {client_email}")
                
                # Send SMS with links
                if client_phone and notif_svc.twilio_client:
                    try:
                        sms_msg = f"📄 ¡Hola {client_name}! Tu declaración de impuestos {data.tax_year} ya está disponible.\n\n🌐 Web: {web_app_link}\n📱 App iOS: {ios_app_link}\n\n- Ross Tax (806) 934-2018"
                        
                        clean_phone = client_phone.replace(' ', '').replace('-', '')
                        if not clean_phone.startswith('+'):
                            clean_phone = '+1' + clean_phone
                        
                        notif_svc.twilio_client.messages.create(
                            body=sms_msg,
                            from_=notif_svc.twilio_phone_number,
                            to=clean_phone
                        )
                        logging.info(f"✅ Tax declaration SMS sent to {clean_phone}")
                    except Exception as sms_err:
                        logging.error(f"SMS error: {sms_err}")
                
        except Exception as notif_err:
            logging.error(f"Error sending notification: {notif_err}")
        
        return {
            'success': True,
            'message': 'Declaración de impuestos subida exitosamente',
            'declaration_id': declaration_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading tax declaration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/admin/tax-declarations')
async def get_all_tax_declarations(
    user_id: Optional[str] = None,
    tax_year: Optional[int] = None,
    limit: int = 100,
    current_user: dict = Depends(_get_current_user)
):
    """Admin gets all tax declarations, optionally filtered"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = {'status': 'active'}
        if user_id:
            query['user_id'] = user_id
        if tax_year:
            query['tax_year'] = tax_year
        
        declarations = await _db.tax_declarations.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        # Enrich with client info
        result = []
        for decl in declarations:
            client = await _db.users.find_one({'_id': decl['user_id']})
            if not client:
                try:
                    from bson import ObjectId
                    client = await _db.users.find_one({'_id': ObjectId(decl['user_id'])})
                except:
                    pass
            
            result.append({
                'id': decl['id'],
                'user_id': decl['user_id'],
                'client_name': client.get('full_name') or client.get('name') if client else 'Desconocido',
                'client_email': client.get('email') if client else '',
                'title': decl['title'],
                'description': decl.get('description'),
                'tax_year': decl['tax_year'],
                'created_at': decl['created_at'].isoformat() if decl.get('created_at') else None,
                'uploaded_by_name': decl.get('uploaded_by_name')
            })
        
        return {'success': True, 'declarations': result}
        
    except Exception as e:
        logging.error(f"Error getting tax declarations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/admin/tax-declarations/{declaration_id}')
async def get_tax_declaration_admin(
    declaration_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Admin gets a specific tax declaration with PDF data"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        decl = await _db.tax_declarations.find_one({'id': declaration_id, 'status': 'active'})
        if not decl:
            raise HTTPException(status_code=404, detail='Declaración no encontrada')
        
        return {
            'success': True,
            'declaration': {
                'id': decl['id'],
                'user_id': decl['user_id'],
                'title': decl['title'],
                'description': decl.get('description'),
                'tax_year': decl['tax_year'],
                'pdf_data': decl['pdf_data'],
                'created_at': decl['created_at'].isoformat() if decl.get('created_at') else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting tax declaration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.delete('/admin/tax-declarations/{declaration_id}')
async def delete_tax_declaration(
    declaration_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Admin deletes (soft delete) a tax declaration"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        result = await _db.tax_declarations.update_one(
            {'id': declaration_id},
            {'$set': {'status': 'deleted', 'deleted_at': datetime.now(timezone.utc)}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Declaración no encontrada')
        
        return {'success': True, 'message': 'Declaración eliminada'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting tax declaration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Client endpoints for tax declarations
@misc_extracted_router.get('/tax-declarations/my')
async def get_my_tax_declarations(
    current_user: dict = Depends(_get_current_user)
):
    """Client gets their own tax declarations"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id'))
        
        declarations = await _db.tax_declarations.find({
            'user_id': user_id,
            'status': 'active'
        }).sort('created_at', -1).to_list(100)
        
        result = []
        for decl in declarations:
            result.append({
                'id': decl['id'],
                'title': decl['title'],
                'description': decl.get('description'),
                'tax_year': decl['tax_year'],
                'created_at': decl['created_at'].isoformat() if decl.get('created_at') else None
            })
        
        return {'success': True, 'declarations': result}
        
    except Exception as e:
        logging.error(f"Error getting user tax declarations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@misc_extracted_router.get('/tax-declarations/{declaration_id}/download')
async def download_tax_declaration(
    declaration_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Client downloads their tax declaration PDF"""
    try:
        user_id = current_user.get('id') or str(current_user.get('_id'))
        
        decl = await _db.tax_declarations.find_one({
            'id': declaration_id,
            'user_id': user_id,
            'status': 'active'
        })
        
        if not decl:
            raise HTTPException(status_code=404, detail='Declaración no encontrada')
        
        return {
            'success': True,
            'pdf_data': decl['pdf_data'],
            'filename': f"{decl['title']}_{decl['tax_year']}.pdf",
            'title': decl['title'],
            'tax_year': decl['tax_year']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error downloading tax declaration: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== SQUARE APPOINTMENTS (REMOVED - No longer used) ==================

# ================== QUEUE/TURNOS SYSTEM ==================
# ============== QUEUE/TURNOS SYSTEM ==============

class QueueItemCreate(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    service_type: str = "Declaración de Impuestos"
    notes: Optional[str] = None

class QueueItemUpdate(BaseModel):
    status: Literal['waiting', 'serving', 'completed', 'no_show']

@misc_extracted_router.get('/admin/queue')
async def get_queue(
    date: Optional[str] = None,
    current_user: dict = Depends(_require_admin)
):
    """Get today's queue or queue for a specific date"""
    try:
        # Default to today
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        
        # Get queue items for the date
        queue_items = await _db.queue.find({
            'date': date
        }).sort('ticket_number', 1).to_list(500)
        
        # Get today's ticket counter
        counter = await _db.queue_counters.find_one({'date': date})
        current_ticket = counter.get('current_ticket', 0) if counter else 0
        
        # Calculate stats
        waiting = [q for q in queue_items if q.get('status') == 'waiting']
        serving = [q for q in queue_items if q.get('status') == 'serving']
        completed = [q for q in queue_items if q.get('status') == 'completed']
        no_show = [q for q in queue_items if q.get('status') == 'no_show']
        
        # Format response
        formatted_items = []
        for item in queue_items:
            formatted_items.append({
                'id': str(item.get('_id')),
                'ticket_number': item.get('ticket_number'),
                'client_name': item.get('client_name'),
                'client_phone': item.get('client_phone'),
                'service_type': item.get('service_type'),
                'status': item.get('status'),
                'notes': item.get('notes'),
                'created_at': item.get('created_at').isoformat() if item.get('created_at') else None,
                'called_at': item.get('called_at').isoformat() if item.get('called_at') else None,
                'completed_at': item.get('completed_at').isoformat() if item.get('completed_at') else None,
                'estimated_wait': item.get('estimated_wait', 0)
            })
        
        return {
            'queue': formatted_items,
            'current_ticket': current_ticket,
            'stats': {
                'waiting': len(waiting),
                'serving': len(serving),
                'completed': len(completed),
                'no_show': len(no_show),
                'total': len(queue_items)
            },
            'date': date
        }
    except Exception as e:
        logging.error(f"Error getting queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.post('/admin/queue')
async def add_to_queue(
    data: QueueItemCreate,
    current_user: dict = Depends(_require_admin)
):
    """Add a client to today's queue"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get or create ticket counter for today
        counter = await _db.queue_counters.find_one({'date': today})
        if counter:
            new_ticket = counter.get('current_ticket', 0) + 1
            await _db.queue_counters.update_one(
                {'date': today},
                {'$set': {'current_ticket': new_ticket}}
            )
        else:
            new_ticket = 1
            await _db.queue_counters.insert_one({
                'date': today,
                'current_ticket': new_ticket
            })
        
        # Calculate estimated wait (15 min per person waiting)
        waiting_count = await _db.queue.count_documents({
            'date': today,
            'status': 'waiting'
        })
        estimated_wait = waiting_count * 15
        
        # Create queue item
        queue_item = {
            'date': today,
            'ticket_number': new_ticket,
            'client_name': data.client_name,
            'client_phone': data.client_phone,
            'service_type': data.service_type,
            'notes': data.notes,
            'status': 'waiting',
            'estimated_wait': estimated_wait,
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.get('email')
        }
        
        result = await _db.queue.insert_one(queue_item)
        queue_item['_id'] = result.inserted_id
        
        logging.info(f"🎫 New queue ticket #{new_ticket}: {data.client_name}")
        
        # Emit socket event for real-time updates (TV mode)
        try:
            await sio.emit('queue_updated', {
                'action': 'added',
                'ticket_number': new_ticket,
                'client_name': data.client_name
            })
        except:
            pass
        
        return {
            'success': True,
            'ticket_number': new_ticket,
            'id': str(queue_item['_id']),
            'estimated_wait': estimated_wait,
            'message': f'Turno #{new_ticket} creado para {data.client_name}'
        }
    except Exception as e:
        logging.error(f"Error adding to queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.post('/admin/queue/call-next')
async def call_next_in_queue(
    current_user: dict = Depends(_require_admin)
):
    """Call the next person in queue"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Mark any currently serving as completed
        await _db.queue.update_many(
            {'date': today, 'status': 'serving'},
            {'$set': {
                'status': 'completed',
                'completed_at': datetime.now(timezone.utc)
            }}
        )
        
        # Get next waiting
        next_in_queue = await _db.queue.find_one(
            {'date': today, 'status': 'waiting'},
            sort=[('ticket_number', 1)]
        )
        
        if not next_in_queue:
            return {
                'success': False,
                'message': 'No hay clientes en espera'
            }
        
        # Update to serving
        await _db.queue.update_one(
            {'_id': next_in_queue['_id']},
            {'$set': {
                'status': 'serving',
                'called_at': datetime.now(timezone.utc),
                'called_by': current_user.get('email')
            }}
        )
        
        ticket_number = next_in_queue.get('ticket_number')
        client_name = next_in_queue.get('client_name')
        
        logging.info(f"📢 Calling ticket #{ticket_number}: {client_name}")
        
        # Emit socket event for TV display
        try:
            await sio.emit('queue_call', {
                'ticket_number': ticket_number,
                'client_name': client_name,
                'message': f'Turno #{ticket_number} - {client_name}'
            })
        except:
            pass
        
        return {
            'success': True,
            'ticket_number': ticket_number,
            'client_name': client_name,
            'message': f'Llamando turno #{ticket_number}: {client_name}'
        }
    except Exception as e:
        logging.error(f"Error calling next: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.put('/admin/queue/{item_id}')
async def update_queue_item(
    item_id: str,
    data: QueueItemUpdate,
    current_user: dict = Depends(_require_admin)
):
    """Update a queue item status"""
    try:
        update_data = {
            'status': data.status,
            'updated_by': current_user.get('email')
        }
        
        if data.status in ['completed', 'no_show']:
            update_data['completed_at'] = datetime.now(timezone.utc)
        elif data.status == 'serving':
            update_data['called_at'] = datetime.now(timezone.utc)
        
        result = await _db.queue.update_one(
            {'_id': ObjectId(item_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Get updated item for socket emit
        item = await _db.queue.find_one({'_id': ObjectId(item_id)})
        
        # Emit socket event
        try:
            await sio.emit('queue_updated', {
                'action': 'status_changed',
                'ticket_number': item.get('ticket_number'),
                'status': data.status
            })
        except:
            pass
        
        return {'success': True, 'message': f'Estado actualizado a {data.status}'}
    except Exception as e:
        logging.error(f"Error updating queue item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.delete('/admin/queue/{item_id}')
async def delete_queue_item(
    item_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Remove an item from the queue"""
    try:
        result = await _db.queue.delete_one({'_id': ObjectId(item_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return {'success': True, 'message': 'Turno eliminado'}
    except Exception as e:
        logging.error(f"Error deleting queue item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@misc_extracted_router.post('/admin/queue/reset')
async def reset_queue(
    current_user: dict = Depends(_require_admin)
):
    """Reset today's queue (clear all and reset counter)"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Archive old queue items
        await _db.queue.update_many(
            {'date': today},
            {'$set': {'archived': True, 'archived_at': datetime.now(timezone.utc)}}
        )
        
        # Reset counter
        await _db.queue_counters.update_one(
            {'date': today},
            {'$set': {'current_ticket': 0}},
            upsert=True
        )
        
        logging.info(f"🔄 Queue reset by {current_user.get('email')}")
        
        return {'success': True, 'message': 'Cola reiniciada'}
    except Exception as e:
        logging.error(f"Error resetting queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Public endpoint for TV display (no auth required)
@misc_extracted_router.get('/public/queue-display')
async def get_queue_display():
    """Public endpoint for TV display - shows current queue status"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get waiting and serving
        queue_items = await _db.queue.find({
            'date': today,
            'status': {'$in': ['waiting', 'serving']}
        }).sort('ticket_number', 1).to_list(50)
        
        waiting = []
        now_serving = None
        
        for item in queue_items:
            formatted = {
                'ticket_number': item.get('ticket_number'),
                'client_name': item.get('client_name'),
                'service_type': item.get('service_type'),
                'estimated_wait': item.get('estimated_wait', 0)
            }
            if item.get('status') == 'serving':
                now_serving = formatted
            else:
                waiting.append(formatted)
        
        return {
            'now_serving': now_serving,
            'waiting': waiting,
            'waiting_count': len(waiting),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logging.error(f"Error getting queue display: {e}")
        return {
            'now_serving': None,
            'waiting': [],
            'waiting_count': 0,
            'error': str(e)
        }


