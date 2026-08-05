"""
WhatsApp Routes Router
Extracted from server.py for modularization.
Handles WhatsApp messaging, automation, bot settings, API configuration, and webhooks.
"""
import logging
import httpx
import os
import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from pydantic import BaseModel
from bson import ObjectId
from typing import Literal
from passlib.context import CryptContext

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class WhatsAppLogRequest(BaseModel):
    message: str
    direction: Literal["outgoing", "incoming"] = "outgoing"

whatsapp_router = APIRouter()
_db = None
_notification_service = None


def init_whatsapp_router(db, notification_service=None):
    global _db, _notification_service
    _db = db
    _notification_service = notification_service


def update_whatsapp_notification_service(service):
    global _notification_service
    _notification_service = service


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

@whatsapp_router.post('/admin/clients/{user_id}/whatsapp-log')
async def log_whatsapp_message(
    user_id: str,
    log_data: WhatsAppLogRequest,
    current_user: dict = Depends(_auth_user)
):
    """Log a WhatsApp interaction with client"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    # Check if user exists - try both ObjectId and string formats
    from bson import ObjectId
    user = None
    
    # Try with ObjectId first
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    
    # Try with string _id
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    
    # Try with 'id' field (UUID format)
    if not user:
        user = await _db.users.find_one({'id': user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')
    
    # Create log entry
    log_entry = {
        'user_id': user_id,
        'admin_id': current_user['id'],
        'admin_name': current_user['name'],
        'message': log_data.message,
        'direction': log_data.direction,
        'channel': 'whatsapp',
        'created_at': datetime.now(timezone.utc)
    }
    
    await _db.communication_logs.insert_one(log_entry)
    
    # Also add to client notes
    note = {
        'user_id': user_id,
        'admin_id': current_user['id'],
        'admin_name': current_user['name'],
        'content': f"WhatsApp ({log_data.direction}): {log_data.message}",
        'category': 'whatsapp',
        'created_at': datetime.now(timezone.utc)
    }
    await _db.client_notes.insert_one(note)
    
    return {'message': 'WhatsApp interaction logged successfully', 'log_id': str(log_entry['_id'])}

# ================== WHATSAPP AUTOMATION ENDPOINTS ==================

@whatsapp_router.post('/admin/whatsapp/send-appointment-reminder/{appointment_id}')
async def send_appointment_reminder_manual(
    appointment_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Enviar recordatorio manual de cita por WhatsApp"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    if not wa_automation:
        raise HTTPException(status_code=503, detail='WhatsApp automation not available')
    
    result = await wa_automation.send_appointment_reminder(appointment_id, hours_before=24)
    
    if result.get('success'):
        return {'message': 'Reminder sent successfully', 'message_id': result.get('message_id')}
    else:
        raise HTTPException(status_code=400, detail=result.get('error', 'Failed to send reminder'))

@whatsapp_router.post('/admin/whatsapp/send-payment-reminder/{invoice_id}')
async def send_payment_reminder_manual(
    invoice_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Enviar recordatorio de pago por WhatsApp"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    if not wa_automation:
        raise HTTPException(status_code=503, detail='WhatsApp automation not available')
    
    # Get invoice and send reminder
    invoice = await _db.invoices.find_one({'_id': ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail='Invoice not found')
    
    if invoice.get('status') == 'paid':
        raise HTTPException(status_code=400, detail='Invoice already paid')
    
    result = await wa_automation.send_invoice_created(invoice_id)
    
    if result.get('success'):
        return {'message': 'Payment reminder sent successfully', 'message_id': result.get('message_id')}
    else:
        raise HTTPException(status_code=400, detail=result.get('error', 'Failed to send reminder'))

@whatsapp_router.post('/admin/whatsapp/send-pending-documents/{user_id}')
async def send_pending_documents_reminder(
    user_id: str,
    documents: List[str],
    current_user: dict = Depends(_auth_user)
):
    """Enviar recordatorio de documentos pendientes por WhatsApp"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    if not wa_automation:
        raise HTTPException(status_code=503, detail='WhatsApp automation not available')
    
    if not documents:
        raise HTTPException(status_code=400, detail='No documents specified')
    
    result = await wa_automation.send_documents_pending(user_id, documents)
    
    if result.get('success'):
        return {'message': 'Documents reminder sent successfully', 'message_id': result.get('message_id')}
    else:
        raise HTTPException(status_code=400, detail=result.get('error', 'Failed to send reminder'))

@whatsapp_router.post('/admin/whatsapp/run-appointment-reminders')
async def run_appointment_reminders(
    current_user: dict = Depends(_auth_user)
):
    """Ejecutar job de recordatorios de citas (24h y 1h antes)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    if not wa_automation:
        raise HTTPException(status_code=503, detail='WhatsApp automation not available')
    
    pending = await wa_automation.get_pending_reminders()
    
    results = {
        '24h_sent': 0,
        '24h_failed': 0,
        '1h_sent': 0,
        '1h_failed': 0,
        'details': []
    }
    
    # Process 24h reminders
    for appt in pending.get('24h', []):
        appt_id = str(appt.get('_id', appt.get('id')))
        result = await wa_automation.send_appointment_reminder(appt_id, hours_before=24)
        
        if result.get('success'):
            results['24h_sent'] += 1
            # Mark as sent
            await _db.appointments.update_one(
                {'_id': appt['_id']},
                {'$set': {'reminder_24h_sent': True}}
            )
        else:
            results['24h_failed'] += 1
            results['details'].append({'appointment_id': appt_id, 'error': result.get('error'), 'type': '24h'})
    
    # Process 1h reminders
    for appt in pending.get('1h', []):
        appt_id = str(appt.get('_id', appt.get('id')))
        result = await wa_automation.send_appointment_reminder(appt_id, hours_before=1)
        
        if result.get('success'):
            results['1h_sent'] += 1
            # Mark as sent
            await _db.appointments.update_one(
                {'_id': appt['_id']},
                {'$set': {'reminder_1h_sent': True}}
            )
        else:
            results['1h_failed'] += 1
            results['details'].append({'appointment_id': appt_id, 'error': result.get('error'), 'type': '1h'})
    
    return {
        'message': 'Appointment reminders job completed',
        'results': results
    }

@whatsapp_router.post('/admin/whatsapp/send-bulk-payment-reminders')
async def send_bulk_payment_reminders(
    current_user: dict = Depends(_auth_user)
):
    """Enviar recordatorios de pago a todas las facturas pendientes"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    if not wa_automation:
        raise HTTPException(status_code=503, detail='WhatsApp automation not available')
    
    # Get all pending invoices past due date
    now = datetime.utcnow()
    pending_invoices = await _db.invoices.find({
        'status': {'$in': ['pending', 'overdue']},
        'due_date': {'$lt': now}
    }).to_list(100)
    
    results = {
        'sent': 0,
        'failed': 0,
        'skipped': 0,
        'details': []
    }
    
    for invoice in pending_invoices:
        invoice_id = str(invoice['_id'])
        
        # Check if reminder was sent recently (within 3 days)
        last_reminder = invoice.get('last_payment_reminder')
        if last_reminder and (now - last_reminder).days < 3:
            results['skipped'] += 1
            continue
        
        result = await wa_automation.send_invoice_created(invoice_id)
        
        if result.get('success'):
            results['sent'] += 1
            # Update last reminder date
            await _db.invoices.update_one(
                {'_id': invoice['_id']},
                {'$set': {'last_payment_reminder': now, 'status': 'overdue'}}
            )
        else:
            results['failed'] += 1
            results['details'].append({'invoice_id': invoice_id, 'error': result.get('error')})
    
    return {
        'message': 'Bulk payment reminders completed',
        'results': results
    }

@whatsapp_router.get('/admin/whatsapp/automation-status')
async def get_automation_status(
    current_user: dict = Depends(_auth_user)
):
    """Obtener estado del servicio de automatización WhatsApp"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from whatsapp_automation_service import get_whatsapp_automation
    wa_automation = get_whatsapp_automation()
    
    # Get pending reminders count
    pending = await wa_automation.get_pending_reminders() if wa_automation else {'24h': [], '1h': []}
    
    # Get pending invoices count
    pending_invoices = await _db.invoices.count_documents({
        'status': {'$in': ['pending', 'overdue']}
    })
    
    # Get recent notifications
    recent_notifications = await _db.whatsapp_notifications_log.find({}).sort('sent_at', -1).limit(10).to_list(10)
    
    for n in recent_notifications:
        n['id'] = str(n.pop('_id'))
        if 'sent_at' in n:
            n['sent_at'] = n['sent_at'].isoformat()
    
    return {
        'service_available': wa_automation is not None,
        'pending_24h_reminders': len(pending.get('24h', [])),
        'pending_1h_reminders': len(pending.get('1h', [])),
        'pending_invoices': pending_invoices,
        'recent_notifications': recent_notifications
    }

@whatsapp_router.get('/whatsapp/automation/document-followups')
async def get_document_followups(current_user: dict = Depends(_auth_user)):
    """Get clients that need document followups"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Find users with pending documents
        users = await _db.users.find({
            'role': 'client'
        }).to_list(100)
        
        clients_needing_docs = []
        
        for user in users:
            user_id = str(user.get('_id'))
            
            # Get uploaded documents count
            uploaded = await _db.documents.count_documents({'user_id': user_id})
            
            # Check for missing required documents
            required_docs = [
                {'id': 'w2', 'name': 'W-2 Form', 'required': True},
                {'id': 'id_front', 'name': 'ID (Front)', 'required': True},
                {'id': 'id_back', 'name': 'ID (Back)', 'required': True},
                {'id': 'ssn', 'name': 'Social Security Card', 'required': True},
                {'id': '1099', 'name': '1099 Forms', 'required': False},
            ]
            
            # Get user's uploaded document types
            user_docs = await _db.documents.find({'user_id': user_id}).to_list(50)
            uploaded_types = [d.get('type', '').lower() for d in user_docs]
            
            missing = []
            for req in required_docs:
                if req['id'] not in uploaded_types and req['required']:
                    missing.append(req)
            
            if missing:
                clients_needing_docs.append({
                    'user_id': user_id,
                    'name': user.get('name', user.get('full_name', 'Cliente')),
                    'phone': user.get('phone', ''),
                    'email': user.get('email', ''),
                    'missing_count': len(missing),
                    'missing_documents': missing,
                    'uploaded_count': uploaded
                })
        
        return {'clients': clients_needing_docs}
    except Exception as e:
        logging.error(f"Error getting document followups: {e}")
        return {'clients': []}


@whatsapp_router.get('/whatsapp/automation/pending-reminders')
async def get_whatsapp_pending_reminders(current_user: dict = Depends(_auth_user)):
    """Get pending appointment reminders"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        next_24h = now + timedelta(hours=24)
        next_1h = now + timedelta(hours=1)
        
        # Get appointments in next 24 hours
        appointments_24h = await _db.appointments.find({
            'scheduled_at': {'$gte': now, '$lte': next_24h},
            'status': {'$in': ['scheduled', 'confirmed']}
        }).to_list(50)
        
        # Get appointments in next hour
        appointments_1h = await _db.appointments.find({
            'scheduled_at': {'$gte': now, '$lte': next_1h},
            'status': {'$in': ['scheduled', 'confirmed']}
        }).to_list(20)
        
        def format_apt(apt):
            return {
                'id': str(apt.get('_id')),
                'date': apt.get('scheduled_at').isoformat() if apt.get('scheduled_at') else None,
                'user_id': apt.get('user_id', ''),
                'client_name': apt.get('client_name', apt.get('user_name', 'Cliente')),
                'service': apt.get('service_type', apt.get('service_name', 'Cita'))
            }
        
        return {
            'pending_24h': len(appointments_24h),
            'pending_1h': len(appointments_1h),
            'appointments_24h': [format_apt(a) for a in appointments_24h],
            'appointments_1h': [format_apt(a) for a in appointments_1h]
        }
    except Exception as e:
        logging.error(f"Error getting pending reminders: {e}")
        return {'pending_24h': 0, 'pending_1h': 0, 'appointments_24h': [], 'appointments_1h': []}


@whatsapp_router.get('/whatsapp/stats')
async def get_whatsapp_stats(current_user: dict = Depends(_auth_user)):
    """Get WhatsApp messaging statistics"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        
        # Count messages sent today
        messages_today = await _db.whatsapp_notifications_log.count_documents({
            'sent_at': {'$gte': today_start}
        })
        
        # Count messages this week
        messages_week = await _db.whatsapp_notifications_log.count_documents({
            'sent_at': {'$gte': week_start}
        })
        
        # Count by type
        document_followups = await _db.whatsapp_notifications_log.count_documents({
            'type': 'document_followup',
            'sent_at': {'$gte': week_start}
        })
        
        status_notifications = await _db.whatsapp_notifications_log.count_documents({
            'type': {'$in': ['status_update', 'appointment_reminder']},
            'sent_at': {'$gte': week_start}
        })
        
        return {
            'messages_today': messages_today,
            'messages_this_week': messages_week,
            'document_followups': document_followups,
            'status_notifications': status_notifications,
            'conversion_rate': 85  # Default rate
        }
    except Exception as e:
        logging.error(f"Error getting WhatsApp stats: {e}")
        return {
            'messages_today': 0,
            'messages_this_week': 0,
            'document_followups': 0,
            'status_notifications': 0,
            'conversion_rate': 85
        }


@whatsapp_router.post('/whatsapp/automation/send-document-followup/{user_id}')
async def send_document_followup(
    user_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Send document followup WhatsApp message to a specific user"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        
        if not wa_automation:
            return {'success': False, 'error': 'WhatsApp automation not available'}
        
        # Get user
        user = await _db.users.find_one({'_id': user_id})
        if not user:
            try:
                from bson import ObjectId
                user = await _db.users.find_one({'_id': ObjectId(user_id)})
            except:
                pass
        
        if not user:
            return {'success': False, 'error': 'User not found'}
        
        phone = user.get('phone')
        if not phone:
            return {'success': False, 'error': 'User has no phone number'}
        
        name = user.get('name', user.get('full_name', 'Cliente'))
        
        # Send followup message
        message = f"""📋 *Recordatorio de Documentos - Ross Tax*

Hola {name},

Le recordamos que aún tenemos documentos pendientes por recibir para completar su declaración de impuestos.

📎 Por favor, suba sus documentos desde nuestra app o envíelos por este medio.

¿Tiene preguntas? Estamos aquí para ayudarle.

_Ross Tax Preparation_
📞 (806) 934-2018"""
        
        result = await wa_automation.send_message(phone, message)
        
        # Log the notification
        await _db.whatsapp_notifications_log.insert_one({
            'user_id': user_id,
            'phone': phone,
            'type': 'document_followup',
            'message': message,
            'sent_at': datetime.now(timezone.utc),
            'success': result.get('success', False)
        })
        
        return {'success': True, 'message': 'Document followup sent'}
    except Exception as e:
        logging.error(f"Error sending document followup: {e}")
        return {'success': False, 'error': str(e)}


@whatsapp_router.post('/whatsapp/automation/send-document-followup-batch')
async def send_document_followup_batch(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Send document followup to multiple users"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        user_ids = request.get('user_ids', [])
        if not user_ids:
            return {'success': False, 'sent': 0, 'failed': 0, 'error': 'No users specified'}
        
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        
        sent = 0
        failed = 0
        
        for user_id in user_ids:
            try:
                # Get user
                user = None
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    user = await _db.users.find_one({'_id': user_id})
                
                if not user or not user.get('phone'):
                    failed += 1
                    continue
                
                phone = user.get('phone')
                name = user.get('name', user.get('full_name', 'Cliente'))
                
                message = f"""📋 *Recordatorio de Documentos - Ross Tax*

Hola {name},

Le recordamos que aún tenemos documentos pendientes por recibir para completar su declaración de impuestos.

📎 Por favor, suba sus documentos desde nuestra app o envíelos por este medio.

¿Tiene preguntas? Estamos aquí para ayudarle.

_Ross Tax Preparation_
📞 (806) 934-2018"""
                
                if wa_automation:
                    result = await wa_automation.send_message(phone, message)
                    if result.get('success'):
                        sent += 1
                    else:
                        failed += 1
                else:
                    failed += 1
                    
            except Exception as e:
                logging.error(f"Error sending to {user_id}: {e}")
                failed += 1
        
        return {'success': True, 'sent': sent, 'failed': failed}
        
    except Exception as e:
        logging.error(f"Error in batch document followup: {e}")
        return {'success': False, 'sent': 0, 'failed': len(request.get('user_ids', [])), 'error': str(e)}


@whatsapp_router.post('/whatsapp/automation/notify-status')
async def notify_tax_status(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Send tax return status notification to a user"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        user_id = request.get('user_id')
        status = request.get('status', 'processing')  # processing, completed, refund_pending, refund_approved
        extra_data = request.get('extra_data', {})
        
        if not user_id:
            return {'success': False, 'error': 'User ID required'}
        
        # Get user
        user = None
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
        
        if not user:
            return {'success': False, 'error': 'User not found'}
        
        phone = user.get('phone')
        if not phone:
            return {'success': False, 'error': 'User has no phone number'}
        
        name = user.get('name', user.get('full_name', 'Cliente'))
        
        # Build status message
        status_messages = {
            'processing': f"""📊 *Actualización de Estado - Ross Tax*

Hola {name},

Su declaración de impuestos está siendo procesada. Le notificaremos cuando haya novedades.

_Ross Tax Preparation_""",
            'completed': f"""✅ *Declaración Completada - Ross Tax*

Hola {name},

¡Excelentes noticias! Su declaración de impuestos ha sido completada y presentada exitosamente.

_Ross Tax Preparation_""",
            'refund_pending': f"""⏳ *Reembolso en Proceso - Ross Tax*

Hola {name},

Su reembolso está siendo procesado por el IRS. Puede tomar de 2-3 semanas.

_Ross Tax Preparation_""",
            'refund_approved': f"""💰 *Reembolso Aprobado - Ross Tax*

Hola {name},

¡Su reembolso de ${extra_data.get('refund_amount', '0')} ha sido aprobado! Debería recibirlo pronto.

_Ross Tax Preparation_"""
        }
        
        message = status_messages.get(status, status_messages['processing'])
        
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        
        if wa_automation:
            result = await wa_automation.send_message(phone, message)
            
            # Log the notification
            await _db.whatsapp_notifications_log.insert_one({
                'user_id': user_id,
                'phone': phone,
                'type': 'tax_status',
                'status': status,
                'message': message,
                'sent_at': datetime.now(timezone.utc),
                'success': result.get('success', False)
            })
            
            return {'success': result.get('success', False)}
        else:
            return {'success': False, 'error': 'WhatsApp automation not available'}
        
    except Exception as e:
        logging.error(f"Error sending status notification: {e}")
        return {'success': False, 'error': str(e)}


@whatsapp_router.post('/whatsapp/automation/process-reminders')
async def process_appointment_reminders(
    current_user: dict = Depends(_auth_user)
):
    """Manually trigger appointment reminder processing"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        
        if not wa_automation:
            return {'success': False, 'error': 'WhatsApp automation not available', 'sent_24h': 0, 'sent_1h': 0}
        
        now = datetime.now(timezone.utc)
        sent_24h = 0
        sent_1h = 0
        
        # Get appointments in next 24-25 hours (for 24h reminder)
        time_24h_start = now + timedelta(hours=23)
        time_24h_end = now + timedelta(hours=25)
        
        appointments_24h = await _db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            '$or': [
                {'scheduled_at': {'$gte': time_24h_start, '$lte': time_24h_end}},
                {'date': {'$gte': time_24h_start, '$lte': time_24h_end}}
            ],
            'reminder_24h_sent': {'$ne': True}
        }).to_list(50)
        
        for apt in appointments_24h:
            try:
                user_id = apt.get('user_id') or apt.get('client_id')
                phone = apt.get('client_phone')
                name = apt.get('client_name', 'Cliente')
                apt_date = apt.get('scheduled_at') or apt.get('date')
                
                if not phone and user_id:
                    user = await _db.users.find_one({'_id': user_id})
                    if user:
                        phone = user.get('phone')
                        name = user.get('name', name)
                
                if phone:
                    message = f"""⏰ *Recordatorio de Cita - Ross Tax*

Hola {name},

Le recordamos que tiene una cita programada para mañana.

📅 Fecha: {apt_date.strftime('%d/%m/%Y') if apt_date else 'Próximamente'}
🕐 Hora: {apt_date.strftime('%H:%M') if apt_date else 'Por confirmar'}
📍 Lugar: 305 Bruce Ave, Dumas, TX

¿Necesita reprogramar? Responda a este mensaje.

_Ross Tax Preparation_"""
                    
                    result = await wa_automation.send_message(phone, message)
                    if result.get('success'):
                        sent_24h += 1
                        await _db.appointments.update_one(
                            {'_id': apt['_id']},
                            {'$set': {'reminder_24h_sent': True, 'reminder_24h_at': now}}
                        )
            except Exception as e:
                logging.error(f"Error sending 24h reminder: {e}")
        
        # Get appointments in next 1-2 hours (for 1h reminder)
        time_1h_start = now + timedelta(minutes=50)
        time_1h_end = now + timedelta(hours=2)
        
        appointments_1h = await _db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            '$or': [
                {'scheduled_at': {'$gte': time_1h_start, '$lte': time_1h_end}},
                {'date': {'$gte': time_1h_start, '$lte': time_1h_end}}
            ],
            'reminder_1h_sent': {'$ne': True}
        }).to_list(50)
        
        for apt in appointments_1h:
            try:
                user_id = apt.get('user_id') or apt.get('client_id')
                phone = apt.get('client_phone')
                name = apt.get('client_name', 'Cliente')
                
                if not phone and user_id:
                    user = await _db.users.find_one({'_id': user_id})
                    if user:
                        phone = user.get('phone')
                        name = user.get('name', name)
                
                if phone:
                    message = f"""🔔 *Recordatorio - Su cita es en 1 hora*

Hola {name},

Su cita en Ross Tax Preparation es en aproximadamente 1 hora.

📍 305 Bruce Ave, Dumas, TX

¡Lo esperamos!

_Ross Tax Preparation_"""
                    
                    result = await wa_automation.send_message(phone, message)
                    if result.get('success'):
                        sent_1h += 1
                        await _db.appointments.update_one(
                            {'_id': apt['_id']},
                            {'$set': {'reminder_1h_sent': True, 'reminder_1h_at': now}}
                        )
            except Exception as e:
                logging.error(f"Error sending 1h reminder: {e}")
        
        return {
            'success': True,
            'sent_24h': sent_24h,
            'sent_1h': sent_1h,
            'total_processed': sent_24h + sent_1h
        }
        
    except Exception as e:
        logging.error(f"Error processing reminders: {e}")
        return {'success': False, 'error': str(e), 'sent_24h': 0, 'sent_1h': 0}


# ================== WHATSAPP BOT SETTINGS ==================

@whatsapp_router.get('/admin/whatsapp/bot-settings')
async def get_whatsapp_bot_settings(current_user: dict = Depends(_require_admin)):
    """Get WhatsApp bot settings including after-hours configuration"""
    try:
        settings = await _db.whatsapp_bot_settings.find_one({'_id': 'config'})
        
        if not settings:
            # Default settings
            settings = {
                '_id': 'config',
                'global_auto_mode': True,
                'schedule_enabled': True,
                'auto_outside_hours': True,
                'manual_during_hours': False,
                'schedule': {
                    'monday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                    'tuesday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                    'wednesday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                    'thursday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                    'friday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                    'saturday': {'enabled': True, 'start': '10:00', 'end': '14:00'},
                    'sunday': {'enabled': False, 'start': '00:00', 'end': '00:00'},
                },
                'after_hours_message': '''🌙 *Gracias por contactarnos!*

Actualmente estamos fuera de nuestro horario de atención.

🕐 *Horario:*
Lunes a Viernes: 9:00 AM - 6:00 PM
Sábados: 10:00 AM - 2:00 PM

Te responderemos lo antes posible cuando regresemos.

Mientras tanto, puedes:
• 📅 Agendar una cita en nuestra app
• 📄 Enviar tus documentos
• 💰 Consultar nuestros precios

📱 Descarga la app: https://apps.apple.com/us/app/ross-tax/id6755496120

_Ross Tax Preparation_''',
                'closed_day_message': '''🌙 *Hoy estamos cerrados*

Gracias por contactar a Ross Tax Preparation.

🕐 Atendemos de Lunes a Sábado.

Te responderemos el próximo día hábil.

📱 Mientras tanto, descarga nuestra app para gestionar tus impuestos:
https://apps.apple.com/us/app/ross-tax/id6755496120

_Ross Tax Preparation_''',
                'updated_at': datetime.now(timezone.utc)
            }
            await _db.whatsapp_bot_settings.insert_one(settings)
        
        return {
            'success': True,
            'settings': {
                'global_auto_mode': settings.get('global_auto_mode', True),
                'schedule_enabled': settings.get('schedule_enabled', True),
                'auto_outside_hours': settings.get('auto_outside_hours', True),
                'manual_during_hours': settings.get('manual_during_hours', False),
                'schedule': settings.get('schedule', {}),
                'after_hours_message': settings.get('after_hours_message', ''),
                'closed_day_message': settings.get('closed_day_message', ''),
            }
        }
    except Exception as e:
        logging.error(f"Error getting bot settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.put('/admin/whatsapp/bot-settings')
async def update_whatsapp_bot_settings(
    request: Request,
    current_user: dict = Depends(_require_admin)
):
    """Update WhatsApp bot settings"""
    try:
        data = await request.json()
        
        update_data = {
            'global_auto_mode': data.get('global_auto_mode', True),
            'schedule_enabled': data.get('schedule_enabled', True),
            'auto_outside_hours': data.get('auto_outside_hours', True),
            'manual_during_hours': data.get('manual_during_hours', False),
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('email')
        }
        
        if 'schedule' in data:
            update_data['schedule'] = data['schedule']
        if 'after_hours_message' in data:
            update_data['after_hours_message'] = data['after_hours_message']
        if 'closed_day_message' in data:
            update_data['closed_day_message'] = data['closed_day_message']
        
        await _db.whatsapp_bot_settings.update_one(
            {'_id': 'config'},
            {'$set': update_data},
            upsert=True
        )
        
        # Log the activity
        await log_activity(
            action='bot_settings_updated',
            actor_id=str(current_user.get('_id', current_user.get('id'))),
            actor_name=current_user.get('full_name') or current_user.get('name'),
            actor_email=current_user.get('email'),
            target_type='settings',
            target_name='WhatsApp Bot Settings',
            details={'updated_fields': list(data.keys())}
        )
        
        return {'success': True, 'message': 'Configuración actualizada'}
    except Exception as e:
        logging.error(f"Error updating bot settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== WHATSAPP API CONFIGURATION ==================

@whatsapp_router.get('/admin/whatsapp/api-config')
async def get_whatsapp_api_config(current_user: dict = Depends(_require_admin)):
    """Get WhatsApp Business API configuration"""
    try:
        config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        
        if not config:
            config = {
                '_id': 'main',
                'phone_number_id': '',
                'business_account_id': '',
                'access_token': '',
                'webhook_verify_token': secrets.token_urlsafe(16),
                'webhook_url': 'https://app-nueva-production.up.railway.app/api/webhooks/whatsapp',
                'display_phone_number': '',
                'is_configured': False,
                'created_at': datetime.now(timezone.utc)
            }
            await _db.whatsapp_api_config.insert_one(config)
        
        # Mask the access token for security
        masked_token = ''
        if config.get('access_token'):
            token = config['access_token']
            if len(token) > 10:
                masked_token = token[:5] + '*' * (len(token) - 10) + token[-5:]
            else:
                masked_token = '*' * len(token)
        
        return {
            'success': True,
            'config': {
                'phone_number_id': config.get('phone_number_id', ''),
                'business_account_id': config.get('business_account_id', ''),
                'access_token_masked': masked_token,
                'has_access_token': bool(config.get('access_token')),
                'webhook_verify_token': config.get('webhook_verify_token', ''),
                'webhook_url': config.get('webhook_url', ''),
                'display_phone_number': config.get('display_phone_number', ''),
                'is_configured': config.get('is_configured', False),
                'updated_at': config.get('updated_at')
            }
        }
    except Exception as e:
        logging.error(f"Error getting WhatsApp API config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.put('/admin/whatsapp/api-config')
async def update_whatsapp_api_config(
    request: Request,
    current_user: dict = Depends(_require_admin)
):
    """Update WhatsApp Business API configuration"""
    try:
        data = await request.json()
        
        update_data = {
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('email')
        }
        
        # Update fields if provided
        if 'phone_number_id' in data:
            update_data['phone_number_id'] = data['phone_number_id']
        if 'business_account_id' in data:
            update_data['business_account_id'] = data['business_account_id']
        if 'access_token' in data and data['access_token']:
            update_data['access_token'] = data['access_token']
        if 'webhook_verify_token' in data:
            update_data['webhook_verify_token'] = data['webhook_verify_token']
        if 'display_phone_number' in data:
            update_data['display_phone_number'] = data['display_phone_number']
        
        # Check if configured
        existing = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        phone_id = data.get('phone_number_id') or (existing.get('phone_number_id') if existing else '')
        token = data.get('access_token') or (existing.get('access_token') if existing else '')
        update_data['is_configured'] = bool(phone_id and token)
        
        await _db.whatsapp_api_config.update_one(
            {'_id': 'main'},
            {'$set': update_data},
            upsert=True
        )
        
        # Log the activity
        await log_activity(
            action='whatsapp_api_config_updated',
            actor_id=str(current_user.get('_id', current_user.get('id'))),
            actor_name=current_user.get('full_name') or current_user.get('name'),
            actor_email=current_user.get('email'),
            target_type='settings',
            target_name='WhatsApp API Config',
            details={'updated_fields': list(data.keys())}
        )
        
        return {'success': True, 'message': 'Configuración de WhatsApp API actualizada'}
    except Exception as e:
        logging.error(f"Error updating WhatsApp API config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/admin/whatsapp/test-connection')
async def test_whatsapp_connection(current_user: dict = Depends(_require_admin)):
    """Test WhatsApp Business API connection"""
    try:
        config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        
        if not config or not config.get('access_token') or not config.get('phone_number_id'):
            return {'success': False, 'message': 'WhatsApp API no está configurado'}
        
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{config['phone_number_id']}",
                headers={'Authorization': f"Bearer {config['access_token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'message': 'Conexión exitosa',
                    'phone_number': data.get('display_phone_number', 'N/A'),
                    'quality_rating': data.get('quality_rating', 'N/A'),
                    'verified_name': data.get('verified_name', 'N/A')
                }
            else:
                return {
                    'success': False,
                    'message': f'Error de conexión: {response.status_code}',
                    'error': response.text
                }
    except Exception as e:
        logging.error(f"Error testing WhatsApp connection: {e}")
        return {'success': False, 'message': str(e)}


# ================== WHATSAPP WEBHOOK ==================

@whatsapp_router.get('/webhooks/whatsapp')
async def whatsapp_webhook_verify(request: Request):
    """Verify WhatsApp webhook (Meta verification)"""
    try:
        params = dict(request.query_params)
        mode = params.get('hub.mode')
        token = params.get('hub.verify_token')
        challenge = params.get('hub.challenge')
        
        config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        verify_token = config.get('webhook_verify_token', '') if config else ''
        
        if mode == 'subscribe' and token == verify_token:
            logging.info("✅ WhatsApp webhook verified successfully")
            return Response(content=challenge, media_type="text/plain")
        else:
            logging.warning(f"⚠️ WhatsApp webhook verification failed: mode={mode}, token_match={token == verify_token}")
            raise HTTPException(status_code=403, detail="Verification failed")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error verifying WhatsApp webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/webhooks/whatsapp')
async def whatsapp_webhook_receive(request: Request):
    """Receive incoming WhatsApp messages"""
    try:
        data = await request.json()
        logging.info(f"📨 WhatsApp webhook received: {json.dumps(data)[:500]}")
        
        # Log webhook to database
        await _db.whatsapp_webhooks.insert_one({
            'data': data,
            'received_at': datetime.now(timezone.utc)
        })
        
        # Process the webhook
        if 'entry' in data:
            for entry in data['entry']:
                changes = entry.get('changes', [])
                for change in changes:
                    value = change.get('value', {})
                    messages = value.get('messages', [])
                    
                    for message in messages:
                        await process_whatsapp_message(message, value)
        
        return {'status': 'ok'}
    except Exception as e:
        logging.error(f"Error processing WhatsApp webhook: {e}")
        # Always return 200 to avoid Meta retrying
        return {'status': 'error', 'message': str(e)}


async def process_whatsapp_message(message: dict, value: dict):
    """Process an incoming WhatsApp message"""
    try:
        from_number = message.get('from', '')
        message_id = message.get('id', '')
        message_type = message.get('type', '')
        timestamp = message.get('timestamp', '')
        
        # Get contact info
        contacts = value.get('contacts', [])
        contact_name = contacts[0].get('profile', {}).get('name', '') if contacts else ''
        
        # Get message content
        text_content = ''
        if message_type == 'text':
            text_content = message.get('text', {}).get('body', '')
        elif message_type == 'interactive':
            interactive = message.get('interactive', {})
            if interactive.get('type') == 'button_reply':
                text_content = interactive.get('button_reply', {}).get('title', '')
            elif interactive.get('type') == 'list_reply':
                text_content = interactive.get('list_reply', {}).get('title', '')
        
        logging.info(f"📱 WhatsApp message from {from_number} ({contact_name}): {text_content[:100]}")
        
        # Find or create user
        user = await _db.users.find_one({'phone': from_number})
        if not user:
            user = await _db.users.find_one({'phone': f"+{from_number}"})
        
        user_id = None
        is_new_user = False
        
        if not user:
            # Create new user from WhatsApp
            user_id = str(uuid.uuid4())
            temp_password = secrets.token_urlsafe(8)
            hashed_password = pwd_context.hash(temp_password)
            
            new_user = {
                '_id': user_id,
                'id': user_id,
                'phone': f"+{from_number}" if not from_number.startswith('+') else from_number,
                'name': contact_name,
                'full_name': contact_name,
                'role': 'client',
                'hashed_password': hashed_password,
                'temp_password': True,
                'created_at': datetime.now(timezone.utc),
                'source': 'whatsapp'
            }
            await _db.users.insert_one(new_user)
            is_new_user = True
            logging.info(f"✅ New client created from WhatsApp: {from_number} - {contact_name}")
            
            # Send welcome message
            await send_whatsapp_welcome_message(from_number, contact_name, temp_password)
        else:
            user_id = str(user.get('_id') or user.get('id'))
        
        # Save message to chat history
        await _db.whatsapp_messages.insert_one({
            'message_id': message_id,
            'user_id': user_id,
            'from_number': from_number,
            'contact_name': contact_name,
            'message_type': message_type,
            'content': text_content,
            'direction': 'incoming',
            'timestamp': datetime.fromtimestamp(int(timestamp)) if timestamp else datetime.now(timezone.utc),
            'raw_data': message,
            'created_at': datetime.now(timezone.utc)
        })
        
        # Use AI Brain for intelligent response
        try:
            if ai_brain_instance and text_content:
                # Get AI response
                ai_response = await ai_brain_instance.process_whatsapp_message(
                    message=text_content,
                    phone_number=from_number,
                    contact_name=contact_name,
                    user_id=user_id
                )
                
                if ai_response and ai_response.get('response'):
                    response_text = ai_response['response']
                    
                    # Check if AI suggests booking
                    if '[AGENDAR_CITA]' in response_text:
                        response_text = response_text.replace('[AGENDAR_CITA]', '')
                        response_text += "\n\n📅 *Para agendar tu cita:*\nhttps://www.rosstaxpreparation.com/cita\n\nO llámanos: (806) 934-2018\n\n📋 *Documentos que necesitas:*\n• W-2 (Comprobante de salario)\n• 1099 (Si aplica)\n• Identificación con foto\n• Tarjeta SSN o ITIN\n• Comprobante de cuenta bancaria\n\n📲 Puedes enviar tus documentos aquí por WhatsApp."
                    
                    # Send AI response via WhatsApp
                    config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
                    if config and config.get('access_token'):
                        await send_whatsapp_text_message(from_number, response_text, config)
                        
                        # Save outgoing message
                        await _db.whatsapp_messages.insert_one({
                            'user_id': user_id,
                            'from_number': from_number,
                            'contact_name': contact_name,
                            'message_type': 'text',
                            'content': response_text,
                            'direction': 'outgoing',
                            'ai_generated': True,
                            'created_at': datetime.now(timezone.utc)
                        })
                        logging.info(f"✅ AI response sent to {from_number}")
                else:
                    # Fallback: Check for appointment booking intent
                    text_lower = text_content.lower()
                    booking_keywords = ['cita', 'agendar', 'reservar', 'appointment', 'book', 'horario', 'disponible']
                    
                    if any(keyword in text_lower for keyword in booking_keywords):
                        await send_whatsapp_booking_options(from_number, contact_name)
            else:
                # Fallback without AI Brain
                text_lower = text_content.lower()
                booking_keywords = ['cita', 'agendar', 'reservar', 'appointment', 'book', 'horario', 'disponible']
                
                if any(keyword in text_lower for keyword in booking_keywords):
                    await send_whatsapp_booking_options(from_number, contact_name)
        except Exception as ai_err:
            logging.error(f"Error getting AI response: {ai_err}")
            # Fallback to basic response
            text_lower = text_content.lower()
            booking_keywords = ['cita', 'agendar', 'reservar', 'appointment', 'book', 'horario', 'disponible']
            
            if any(keyword in text_lower for keyword in booking_keywords):
                await send_whatsapp_booking_options(from_number, contact_name)
        
    except Exception as e:
        logging.error(f"Error processing WhatsApp message: {e}")


async def send_whatsapp_welcome_message(phone: str, name: str, temp_password: str):
    """Send welcome message to new WhatsApp user"""
    try:
        config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        if not config or not config.get('access_token'):
            return
        
        message = f"""🎉 *¡Bienvenido a Ross Tax, {name}!*

Tu cuenta ha sido creada automáticamente.

📱 *Descarga nuestra app:*
https://www.rosstaxpreparation.com/app

🔐 *Tu contraseña temporal:* {temp_password}

Puedes usar tu número de teléfono para iniciar sesión.

¿En qué podemos ayudarte hoy?
• 📅 Agendar una cita
• 💰 Consultar precios
• 📄 Enviar documentos

_Ross Tax Preparation_
📞 (806) 244-0443"""

        await send_whatsapp_text_message(phone, message, config)
    except Exception as e:
        logging.error(f"Error sending WhatsApp welcome: {e}")


async def send_whatsapp_booking_options(phone: str, name: str):
    """Send booking options via WhatsApp"""
    try:
        config = await _db.whatsapp_api_config.find_one({'_id': 'main'})
        if not config or not config.get('access_token'):
            return
        
        message = f"""📅 *¡Hola {name}! Vamos a agendar tu cita.*

🏢 *Nuestra dirección:*
301 Denrock Ave, Dalhart, TX 79022

🕐 *Horario de atención:*
Lunes a Viernes: 9:00 AM - 6:00 PM
Sábados: 10:00 AM - 2:00 PM

Para agendar tu cita, puedes:

1️⃣ *En línea (recomendado):*
https://www.rosstaxpreparation.com/book

2️⃣ *Llamar directamente:*
📞 (806) 244-0443

3️⃣ *Responde con tu preferencia:*
Escribe el día y hora que prefieres y te confirmaremos disponibilidad.

_Ross Tax Preparation_"""

        await send_whatsapp_text_message(phone, message, config)
    except Exception as e:
        logging.error(f"Error sending WhatsApp booking options: {e}")


async def send_whatsapp_text_message(phone: str, message: str, config: dict):
    """Send a text message via WhatsApp Business API"""
    try:
        import httpx
        
        # Ensure phone format
        phone_clean = phone.replace('+', '').replace(' ', '').replace('-', '')
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://graph.facebook.com/v18.0/{config['phone_number_id']}/messages",
                headers={
                    'Authorization': f"Bearer {config['access_token']}",
                    'Content-Type': 'application/json'
                },
                json={
                    'messaging_product': 'whatsapp',
                    'to': phone_clean,
                    'type': 'text',
                    'text': {'body': message}
                }
            )
            
            if response.status_code == 200:
                logging.info(f"✅ WhatsApp message sent to {phone}")
            else:
                logging.error(f"❌ WhatsApp send failed: {response.status_code} - {response.text}")
    except Exception as e:
        logging.error(f"Error sending WhatsApp message: {e}")


