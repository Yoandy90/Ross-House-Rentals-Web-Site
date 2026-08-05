"""
Tax Season Tracking Routes Router
Extracted from server.py for modularization.
Handles tax season client tracking, holiday greetings, and bulk reminders.
"""
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Request
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

tax_season_router = APIRouter()
_db = None
_notification_service = None
_notification_service_instance = None


def init_tax_season_router(db):
    global _db
    _db = db


def update_tax_season_notification_service(notif_svc):
    global _notification_service_instance
    _notification_service_instance = notif_svc


# ================== Auth helpers ==================

async def _auth_admin(request):
    """Authenticate admin from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        'id': user.get('id', str(user.get('_id'))),
        'email': user.get('email'),
        'role': user.get('role'),
        'name': user.get('name', user.get('full_name', ''))
    }


async def _auth_user(request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {
        'id': user.get('id', str(user.get('_id'))),
        'email': user.get('email'),
        'role': user.get('role'),
        'name': user.get('name', user.get('full_name', ''))
    }


# ================== Pydantic Models ==================

class HolidayGreetingRequest(BaseModel):
    holiday_id: str
    holiday_name: str
    message: str


# ================== TAX SEASON TRACKING ENDPOINTS ==================

@tax_season_router.get('/admin/tax-season/clients')
async def get_tax_season_clients(
    request: Request,
    year: Optional[int] = Query(None),
):
    current_user = await _auth_admin(request)
    """Get all clients with their tax season status - OPTIMIZED VERSION"""
    try:
        # Use provided year or find active season
        if year:
            season_year = year
        else:
            active_season = await _db.tax_seasons.find_one({'is_active': True})
            if active_season:
                season_year = active_season.get('year', datetime.now().year)
            else:
                season_year = datetime.now().year
        
        tax_year_processed = season_year - 1
        
        year_start = datetime(season_year, 1, 1, tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        
        all_users = await _db.users.find({'role': {'$ne': 'admin'}}).to_list(1000)
        
        all_user_ids = []
        user_map = {}
        for user in all_users:
            user_id = str(user.get('_id', ''))
            user_uuid = user.get('id', '')
            all_user_ids.extend([user_id, user_uuid])
            user_map[user_id] = user
            if user_uuid:
                user_map[user_uuid] = user
        
        tax_returns = await _db.tax_returns.find({
            '$or': [
                {'tax_year': season_year},
                {'tax_year': tax_year_processed},
                {'tax_year': str(season_year)},
                {'tax_year': str(tax_year_processed)}
            ]
        }).to_list(1000)
        tax_return_map = {}
        for tr in tax_returns:
            uid = str(tr.get('user_id', tr.get('client_id', '')))
            if uid:
                tax_return_map[uid] = tr
        
        completed_apts = await _db.appointments.find({
            'status': {'$in': ['completed', 'attended', 'confirmed_attendance', 'done']},
            '$or': [
                {'scheduled_at': {'$gte': year_start}},
                {'date': {'$gte': year_start}}
            ]
        }).to_list(1000)
        completed_apt_map = {}
        for apt in completed_apts:
            uid = str(apt.get('user_id', apt.get('client_id', '')))
            if uid:
                completed_apt_map[uid] = apt
        
        scheduled_apts = await _db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed', 'pending']},
            '$or': [
                {'scheduled_at': {'$gte': now}},
                {'date': {'$gte': now}}
            ]
        }).to_list(1000)
        scheduled_apt_map = {}
        for apt in scheduled_apts:
            uid = str(apt.get('user_id', apt.get('client_id', '')))
            if uid:
                scheduled_apt_map[uid] = apt
        
        manual_statuses = await _db.tax_season_status.find({
            'year': season_year
        }).to_list(1000)
        manual_status_map = {}
        for ms in manual_statuses:
            uid = str(ms.get('user_id', ms.get('client_id', '')))
            if uid:
                manual_status_map[uid] = ms
        
        clients = []
        stats = {
            'total': 0,
            'pending': 0,
            'scheduled': 0,
            'inProgress': 0,
            'completed': 0
        }
        
        for user in all_users:
            user_id = str(user.get('_id', ''))
            user_uuid = user.get('id', '')
            
            tax_return = tax_return_map.get(user_id) or tax_return_map.get(user_uuid)
            completed_appointment = completed_apt_map.get(user_id) or completed_apt_map.get(user_uuid)
            scheduled_appointment = scheduled_apt_map.get(user_id) or scheduled_apt_map.get(user_uuid)
            manual_status = manual_status_map.get(user_id) or manual_status_map.get(user_uuid)
            
            user_tax_status = user.get('tax_status')
            user_declaration_year = user.get('last_declaration_year')
            user_status_field = user.get('status')
            
            if user_tax_status == 'completed' or user_declaration_year == season_year or user_status_field == 'completed':
                status = 'completed'
                stats['completed'] += 1
            elif manual_status and manual_status.get('status') == 'completed':
                status = 'completed'
                stats['completed'] += 1
            elif tax_return and tax_return.get('status') == 'completed':
                status = 'completed'
                stats['completed'] += 1
            elif completed_appointment:
                status = 'in_progress'
                stats['inProgress'] += 1
            elif manual_status and manual_status.get('status') == 'in_progress':
                status = 'in_progress'
                stats['inProgress'] += 1
            elif scheduled_appointment:
                status = 'scheduled'
                stats['scheduled'] += 1
            else:
                status = 'pending'
                stats['pending'] += 1
            
            stats['total'] += 1
            
            next_apt = scheduled_appointment or completed_appointment
            apt_date = None
            if next_apt:
                apt_date = next_apt.get('scheduled_at') or next_apt.get('date')
                if apt_date and hasattr(apt_date, 'isoformat'):
                    apt_date = apt_date.isoformat()
            
            clients.append({
                'id': user_id,
                'name': user.get('name') or user.get('full_name', 'Cliente'),
                'email': user.get('email', ''),
                'phone': user.get('phone', ''),
                'status': status,
                'last_declaration_year': user.get('last_declaration_year'),
                'has_appointment': scheduled_appointment is not None,
                'came_to_appointment': completed_appointment is not None,
                'next_appointment': apt_date,
                'documents_submitted': 0,
                'documents_required': 4,
                'last_contact': '',
                'notes': manual_status.get('notes', '') if manual_status else ''
            })
        
        status_order = {'pending': 0, 'scheduled': 1, 'in_progress': 2, 'completed': 3}
        clients.sort(key=lambda x: status_order.get(x['status'], 5))
        
        return {'clients': clients, 'stats': stats, 'season_year': season_year, 'tax_year_processed': tax_year_processed}
        
    except Exception as e:
        logging.error(f"Error getting tax season clients: {e}")
        import traceback
        traceback.print_exc()
        return {'clients': [], 'stats': {'total': 0, 'pending': 0, 'scheduled': 0, 'inProgress': 0, 'completed': 0}}


@tax_season_router.post('/admin/tax-season/schedule-appointment')
async def schedule_tax_appointment(
    request_data: dict,
    request: Request,
):
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user or user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        client_id = request_data.get('client_id')
        date_str = request_data.get('date')
        time_str = request_data.get('time')
        message = request_data.get('message', '')
        
        target_user = None
        if ObjectId.is_valid(client_id):
            target_user = await _db.users.find_one({'_id': ObjectId(client_id)})
        if not target_user:
            target_user = await _db.users.find_one({'_id': client_id})
        if not target_user:
            target_user = await _db.users.find_one({'id': client_id})
        
        if not target_user:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        apt_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        apt_datetime = apt_datetime.replace(tzinfo=timezone.utc)
        
        appointment = {
            '_id': str(uuid.uuid4()),
            'user_id': client_id,
            'client_name': target_user.get('name', target_user.get('full_name', '')),
            'client_email': target_user.get('email', ''),
            'client_phone': target_user.get('phone', ''),
            'service_name': 'Declaración de Impuestos',
            'type': 'tax_return',
            'date': apt_datetime,
            'time': time_str,
            'scheduled_at': apt_datetime,
            'status': 'scheduled',
            'notes': f'Agendado desde seguimiento de temporada. {message}',
            'source': 'tax_season_tracking',
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'management_token': secrets.token_urlsafe(32)
        }
        
        await _db.appointments.insert_one(appointment)
        
        try:
            if _notification_service_instance:
                await _notification_service_instance.send_notification(
                    user_id=client_id,
                    title='📅 Cita Agendada',
                    message=f'Su cita para declaración de impuestos ha sido agendada para el {date_str} a las {time_str}. {message}',
                    notification_type='appointment',
                    channels=['email', 'sms', 'push']
                )
        except Exception as notif_error:
            logging.error(f"Error sending notification: {notif_error}")
        
        return {'success': True, 'appointment_id': appointment['_id']}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error scheduling tax appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/tax-season/send-reminder')
async def send_tax_reminder(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        client_id = request_data.get('client_id')
        message = request_data.get('message', '')
        
        target_user = None
        if ObjectId.is_valid(client_id):
            target_user = await _db.users.find_one({'_id': ObjectId(client_id)})
        if not target_user:
            target_user = await _db.users.find_one({'_id': client_id})
        if not target_user:
            target_user = await _db.users.find_one({'id': client_id})
        
        if not target_user:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        sent = False
        try:
            if _notification_service_instance:
                await _notification_service_instance.send_notification(
                    user_id=client_id,
                    title='📢 Recordatorio - Temporada de Impuestos',
                    message=message,
                    notification_type='reminder',
                    channels=['email', 'sms', 'whatsapp']
                )
                sent = True
        except Exception as notif_error:
            logging.error(f"Error sending notification: {notif_error}")
        
        await _db.client_reminders.insert_one({
            'client_id': client_id,
            'admin_id': current_user['id'],
            'message': message,
            'type': 'tax_season',
            'sent': sent,
            'created_at': datetime.now(timezone.utc)
        })
        
        return {'success': True, 'sent': sent}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending tax reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/tax-season/request-documents')
async def request_tax_documents(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        client_id = request_data.get('client_id')
        message = request_data.get('message', '')
        
        target_user = None
        if ObjectId.is_valid(client_id):
            target_user = await _db.users.find_one({'_id': ObjectId(client_id)})
        if not target_user:
            target_user = await _db.users.find_one({'_id': client_id})
        if not target_user:
            target_user = await _db.users.find_one({'id': client_id})
        
        if not target_user:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        doc_request = {
            'client_id': client_id,
            'admin_id': current_user['id'],
            'document_types': ['W-2', '1099', 'ID', 'Proof of Address'],
            'message': message,
            'status': 'pending',
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(days=14)
        }
        
        await _db.document_requests.insert_one(doc_request)
        
        sent = False
        try:
            if _notification_service_instance:
                await _notification_service_instance.send_notification(
                    user_id=client_id,
                    title='📄 Solicitud de Documentos',
                    message=message,
                    notification_type='document_request',
                    channels=['email', 'sms', 'whatsapp']
                )
                sent = True
        except Exception as notif_error:
            logging.error(f"Error sending notification: {notif_error}")
        
        return {'success': True, 'sent': sent}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error requesting tax documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/tax-season/mark-completed')
async def mark_tax_completed(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        client_id = request_data.get('client_id')
        current_year = datetime.now().year
        
        existing = await _db.tax_returns.find_one({
            '$or': [
                {'user_id': client_id},
                {'client_id': client_id}
            ],
            'tax_year': current_year
        })
        
        if existing:
            await _db.tax_returns.update_one(
                {'_id': existing['_id']},
                {'$set': {
                    'status': 'completed',
                    'completed_at': datetime.now(timezone.utc),
                    'completed_by': current_user['id']
                }}
            )
        else:
            await _db.tax_returns.insert_one({
                'user_id': client_id,
                'client_id': client_id,
                'tax_year': current_year,
                'status': 'completed',
                'completed_at': datetime.now(timezone.utc),
                'completed_by': current_user['id'],
                'created_at': datetime.now(timezone.utc)
            })
        
        await _db.tax_season_status.update_one(
            {'client_id': client_id, 'year': current_year},
            {'$set': {
                'client_id': client_id,
                'user_id': client_id,
                'year': current_year,
                'status': 'completed',
                'updated_at': datetime.now(timezone.utc),
                'updated_by': current_user['id']
            }},
            upsert=True
        )
        
        return {'success': True}
        
    except Exception as e:
        logging.error(f"Error marking tax completed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/tax-season/mark-visited')
async def mark_client_visited(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        client_id = request_data.get('client_id')
        notes = request_data.get('notes', '')
        status = request_data.get('status', 'in_progress')
        current_year = datetime.now().year
        
        await _db.tax_season_status.update_one(
            {'client_id': client_id, 'year': current_year},
            {'$set': {
                'client_id': client_id,
                'user_id': client_id,
                'year': current_year,
                'status': status,
                'visited': True,
                'visited_at': datetime.now(timezone.utc),
                'notes': notes,
                'updated_at': datetime.now(timezone.utc),
                'updated_by': current_user['id']
            }},
            upsert=True
        )
        
        existing_apt = await _db.appointments.find_one({
            '$or': [
                {'user_id': client_id},
                {'client_id': client_id}
            ],
            'status': {'$in': ['completed', 'attended']},
            '$or': [
                {'scheduled_at': {'$gte': datetime(current_year, 1, 1, tzinfo=timezone.utc)}},
                {'date': {'$gte': datetime(current_year, 1, 1, tzinfo=timezone.utc)}}
            ]
        })
        
        if not existing_apt:
            await _db.appointments.insert_one({
                '_id': str(uuid.uuid4()),
                'user_id': client_id,
                'client_id': client_id,
                'type': 'tax_return',
                'service_name': 'Declaración de Impuestos (Walk-in)',
                'date': datetime.now(timezone.utc),
                'scheduled_at': datetime.now(timezone.utc),
                'status': 'completed',
                'notes': f'Entrada manual: {notes}',
                'source': 'manual_entry',
                'created_at': datetime.now(timezone.utc),
                'created_by': current_user['id']
            })
        
        return {'success': True, 'message': 'Cliente marcado como visitado'}
        
    except Exception as e:
        logging.error(f"Error marking client visited: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/tax-season/update-status')
async def update_client_tax_status(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        client_id = request_data.get('client_id')
        new_status = request_data.get('status')
        notes = request_data.get('notes', '')
        current_year = datetime.now().year
        
        if new_status not in ['pending', 'scheduled', 'in_progress', 'completed']:
            raise HTTPException(status_code=400, detail='Invalid status')
        
        await _db.tax_season_status.update_one(
            {'client_id': client_id, 'year': current_year},
            {'$set': {
                'client_id': client_id,
                'user_id': client_id,
                'year': current_year,
                'status': new_status,
                'notes': notes,
                'updated_at': datetime.now(timezone.utc),
                'updated_by': current_user['id']
            }},
            upsert=True
        )
        
        if new_status == 'completed':
            existing = await _db.tax_returns.find_one({
                '$or': [{'user_id': client_id}, {'client_id': client_id}],
                'tax_year': current_year
            })
            
            if existing:
                await _db.tax_returns.update_one(
                    {'_id': existing['_id']},
                    {'$set': {'status': 'completed', 'completed_at': datetime.now(timezone.utc)}}
                )
            else:
                await _db.tax_returns.insert_one({
                    'user_id': client_id,
                    'client_id': client_id,
                    'tax_year': current_year,
                    'status': 'completed',
                    'completed_at': datetime.now(timezone.utc),
                    'created_at': datetime.now(timezone.utc)
                })
        
        return {'success': True, 'message': f'Estado actualizado a {new_status}'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating tax status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_season_router.post('/admin/valentines-greetings')
async def send_valentines_greetings(
    background_tasks: BackgroundTasks,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        background_tasks.add_task(_send_valentines_to_all_clients)
        
        return {
            'success': True,
            'message': '¡Saludos de San Valentín enviándose a todos los clientes! 💕'
        }
        
    except Exception as e:
        logging.error(f"Error initiating Valentine's greetings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _send_valentines_to_all_clients():
    """Background task to send Valentine's greetings to all clients"""
    global _notification_service_instance
    
    try:
        logging.info("💕 Starting Valentine's Day greetings campaign...")
        
        all_users = await _db.users.find({'role': {'$ne': 'admin'}}).to_list(1000)
        
        sent_count = 0
        error_count = 0
        sms_sent_count = 0
        email_sent_count = 0
        push_sent_count = 0
        
        valentines_title = "💝 ¡Feliz Día de San Valentín!"
        
        if not _notification_service_instance:
            logging.error("❌ Notification service not initialized!")
            return
        
        for user in all_users:
            user_id = str(user.get('_id', user.get('id', '')))
            user_name = user.get('name', 'Cliente')
            user_email = user.get('email', '')
            user_phone = user.get('phone', '')
            
            try:
                try:
                    from push_notification_service import send_push_notification
                    await send_push_notification(
                        db=_db,
                        user_id=user_id,
                        title=valentines_title,
                        body=f"¡Hola {user_name}! 💕 Te deseamos un feliz Día de San Valentín lleno de amor. Con cariño, Ross Tax ❤️",
                        data={'type': 'valentines_greeting'}
                    )
                    push_sent_count += 1
                    logging.info(f"💕 Push sent to {user_name}")
                except Exception as push_error:
                    logging.warning(f"Push notification failed for {user_name}: {push_error}")
                
                if user_email and '@temp.rosstax.com' not in user_email:
                    try:
                        email_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h1 style="color: #e91e63;">💝 ¡Feliz Día de San Valentín!</h1>
                            </div>
                            <div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); padding: 30px; border-radius: 15px;">
                                <p style="font-size: 18px; color: #333;">¡Hola <strong>{user_name}</strong>! 💕</p>
                                <p style="font-size: 16px; color: #555; line-height: 1.6;">
                                    En este Día de San Valentín, queremos agradecerte por ser parte de nuestra familia en Ross Tax.
                                </p>
                                <p style="font-size: 16px; color: #555; line-height: 1.6;">
                                    Tu confianza es muy importante para nosotros y nos llena de alegría poder ayudarte con tus impuestos.
                                </p>
                                <p style="font-size: 16px; color: #555; line-height: 1.6;">
                                    ¡Te deseamos un día lleno de amor y felicidad! 🌹
                                </p>
                                <p style="font-size: 16px; color: #e91e63; margin-top: 20px;">
                                    Con cariño,<br>
                                    <strong>El equipo de Ross Tax</strong> ❤️
                                </p>
                            </div>
                            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                                <p>Ross Tax Services © 2025</p>
                            </div>
                        </div>
                        """
                        if _notification_service_instance.sendgrid_client:
                            await _notification_service_instance.send_email(user_email, valentines_title, email_html)
                            email_sent_count += 1
                            logging.info(f"💕 Email sent to {user_name}")
                    except Exception as email_error:
                        logging.warning(f"Email failed for {user_name}: {email_error}")
                
                if user_phone and _notification_service_instance.twilio_client:
                    try:
                        sms_text = f"💝 ¡Feliz San Valentín, {user_name}! Te deseamos un día lleno de amor. Con cariño, Ross Tax ❤️"
                        result = await _notification_service_instance.send_sms(user_phone, sms_text)
                        if result:
                            sms_sent_count += 1
                            logging.info(f"💕 SMS sent to {user_name} ({user_phone})")
                        else:
                            logging.warning(f"SMS failed for {user_name} - send_sms returned False")
                    except Exception as sms_error:
                        logging.warning(f"SMS failed for {user_name}: {sms_error}")
                
                sent_count += 1
                
            except Exception as user_error:
                logging.error(f"Error sending to {user_name}: {user_error}")
                error_count += 1
        
        logging.info(f"💕 Valentine's campaign completed!")
        logging.info(f"   📊 Total clients: {sent_count}")
        logging.info(f"   📧 Emails sent: {email_sent_count}")
        logging.info(f"   📱 SMS sent: {sms_sent_count}")
        logging.info(f"   🔔 Push sent: {push_sent_count}")
        logging.info(f"   ❌ Errors: {error_count}")
        
    except Exception as e:
        logging.error(f"Valentine's campaign failed: {e}")


@tax_season_router.post('/admin/send-holiday-greeting')
async def send_holiday_greeting(
    request_body: HolidayGreetingRequest,
    background_tasks: BackgroundTasks,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        background_tasks.add_task(
            _send_holiday_to_all_clients,
            request_body.holiday_id,
            request_body.holiday_name,
            request_body.message
        )
        
        return {
            'success': True,
            'message': f'¡Felicitación de {request_body.holiday_name} enviándose a todos los clientes! 🎉'
        }
        
    except Exception as e:
        logging.error(f"Error initiating holiday greeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _send_holiday_to_all_clients(holiday_id: str, holiday_name: str, message: str):
    """Background task to send holiday greetings to all clients"""
    global _notification_service_instance
    
    try:
        logging.info(f"🎉 Starting {holiday_name} greeting campaign...")
        
        users = await _db.users.find({
            'role': {'$ne': 'admin'},
            '$or': [{'is_active': True}, {'is_active': {'$exists': False}}]
        }).to_list(1000)
        
        sent_count = 0
        email_sent_count = 0
        sms_sent_count = 0
        push_sent_count = 0
        error_count = 0
        
        for user in users:
            try:
                user_name = user.get('name') or user.get('full_name') or 'Estimado Cliente'
                user_email = user.get('email', '')
                user_phone = user.get('phone', '')
                user_id = str(user.get('_id', user.get('id', '')))
                
                personalized_message = message.replace('{nombre}', user_name).replace('{name}', user_name)
                
                if user_id and _notification_service_instance:
                    try:
                        await _notification_service_instance.send_push_notification(
                            user_id=user_id,
                            title=holiday_name,
                            body=personalized_message[:150] + '...' if len(personalized_message) > 150 else personalized_message,
                            data={'type': 'holiday_greeting', 'holiday_id': holiday_id}
                        )
                        push_sent_count += 1
                    except Exception as push_error:
                        logging.warning(f"Push failed for {user_name}: {push_error}")
                
                if user_email and '@' in user_email and _notification_service_instance and _notification_service_instance.sendgrid_client:
                    try:
                        email_html = f'''
                        <html>
                        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                                <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A18 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                    <h1 style="color: white; margin: 0; font-size: 28px;">{holiday_name}</h1>
                                </div>
                                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                                    <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                        Hola <strong>{user_name}</strong>,
                                    </p>
                                    <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                        {personalized_message}
                                    </p>
                                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                                        <p style="color: #666; font-size: 14px; text-align: center;">
                                            Con cariño,<br>
                                            <strong>Ross Tax Preparation</strong><br>
                                            305 Bruce Ave, Dumas, TX 79029<br>
                                            📞 (806) 934-2018
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                        '''
                        await _notification_service_instance.send_email(user_email, holiday_name, email_html)
                        email_sent_count += 1
                        logging.info(f"🎉 Email sent to {user_name}")
                    except Exception as email_error:
                        logging.warning(f"Email failed for {user_name}: {email_error}")
                
                if user_phone and _notification_service_instance and _notification_service_instance.twilio_client:
                    try:
                        sms_text = f"{holiday_name}\n\n{personalized_message[:140]}... - Ross Tax 🎉"
                        if len(personalized_message) <= 140:
                            sms_text = f"{holiday_name}\n\n{personalized_message} - Ross Tax 🎉"
                        
                        result = await _notification_service_instance.send_sms(user_phone, sms_text)
                        if result:
                            sms_sent_count += 1
                            logging.info(f"🎉 SMS sent to {user_name} ({user_phone})")
                    except Exception as sms_error:
                        logging.warning(f"SMS failed for {user_name}: {sms_error}")
                
                sent_count += 1
                
            except Exception as user_error:
                logging.error(f"Error sending to {user_name}: {user_error}")
                error_count += 1
        
        logging.info(f"🎉 {holiday_name} campaign completed!")
        logging.info(f"   📊 Total clients: {sent_count}")
        logging.info(f"   📧 Emails sent: {email_sent_count}")
        logging.info(f"   📱 SMS sent: {sms_sent_count}")
        logging.info(f"   🔔 Push sent: {push_sent_count}")
        logging.info(f"   ❌ Errors: {error_count}")
        
    except Exception as e:
        logging.error(f"{holiday_name} campaign failed: {e}")


@tax_season_router.post('/admin/tax-season/bulk-reminder')
async def send_bulk_tax_reminder(
    request_data: dict,
    request: Request,
):
    current_user = await _auth_admin(request)
    try:
        filter_type = request_data.get('filter', 'pending')
        message = request_data.get('message', '')
        
        current_year = datetime.now().year
        sent_count = 0
        total_count = 0
        
        all_users = await _db.users.find({'role': {'$ne': 'admin'}}).to_list(500)
        
        for user in all_users:
            user_id = str(user.get('_id', user.get('id', '')))
            
            tax_return = await _db.tax_returns.find_one({
                '$or': [{'user_id': user_id}, {'client_id': user_id}],
                'tax_year': current_year,
                'status': 'completed'
            })
            
            if tax_return:
                continue
            
            if filter_type == 'pending':
                appointment = await _db.appointments.find_one({
                    '$or': [{'user_id': user_id}, {'client_id': user_id}],
                    'status': {'$in': ['scheduled', 'confirmed']},
                    'scheduled_at': {'$gte': datetime.now(timezone.utc)}
                })
                if appointment:
                    continue
            
            total_count += 1
            
            try:
                if _notification_service_instance:
                    personalized_message = message.replace('{name}', user.get('name', 'Cliente'))
                    await _notification_service_instance.send_notification(
                        user_id=user_id,
                        title='📢 Temporada de Impuestos 2025',
                        message=personalized_message,
                        notification_type='bulk_reminder',
                        channels=['email', 'sms']
                    )
                    sent_count += 1
            except Exception as notif_error:
                logging.error(f"Error sending to {user_id}: {notif_error}")
        
        return {'success': True, 'sent': sent_count, 'total': total_count}
        
    except Exception as e:
        logging.error(f"Error sending bulk reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))
