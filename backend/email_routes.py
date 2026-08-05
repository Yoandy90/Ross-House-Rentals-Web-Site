"""
Email Inbox & Analytics Router
Extracted from server.py for modularization.
Handles email inbox, compose, reply, folders, analytics, and email tracking.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

email_router = APIRouter()
_db = None
_email_inbox_service = None


def init_email_router(db, email_inbox_service=None):
    global _db, _email_inbox_service
    _db = db
    _email_inbox_service = email_inbox_service


def update_email_inbox_service(service):
    global _email_inbox_service
    _email_inbox_service = service


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

# Note: email_inbox_service dependencies are set by init_email_router() or update_email_inbox_service()

@email_router.get('/admin/email/inbox')
async def get_email_inbox(
    current_user: dict = Depends(_auth_user),
    folder: str = "INBOX",
    limit: int = 50,
    unread_only: bool = False
):
    """Get emails from inbox"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        emails = await _email_inbox_service.fetch_emails(folder=folder, limit=limit, unread_only=unread_only)
        unread_count = await _email_inbox_service.get_unread_count(folder)
        
        return {
            'emails': emails,
            'total': len(emails),
            'unread_count': unread_count,
            'folder': folder
        }
    except Exception as e:
        logging.error(f"Error fetching inbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@email_router.get('/admin/email/folders')
async def get_email_folders(current_user: dict = Depends(_auth_user)):
    """Get list of email folders"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        folders = await _email_inbox_service.get_folders()
        return {'folders': folders}
    except Exception as e:
        logging.error(f"Error fetching folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@email_router.get('/admin/email/unread-count')
async def get_unread_email_count(current_user: dict = Depends(_auth_user)):
    """Get count of unread emails"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        count = await _email_inbox_service.get_unread_count()
        return {'unread_count': count}
    except Exception:
        return {'unread_count': 0}


# ============== SENT EMAILS ENDPOINTS (must be before {uid} routes) ==============

@email_router.get('/admin/email/sent')
async def list_sent_emails(
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0),
    category: str = Query(None),
    search: str = Query(None),
    current_user: dict = Depends(_auth_user)
):
    """List all sent/outgoing emails from the system."""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

    try:
        from email_engine import get_sent_emails
        result = await get_sent_emails(limit=limit, skip=skip, category=category, search=search)
        return result
    except Exception as e:
        logger.error(f"Error fetching sent emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.get('/admin/email/sent/{email_id}')
async def get_sent_email_detail_endpoint(
    email_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get full detail of a sent email including HTML body."""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

    try:
        from email_engine import get_sent_email_detail
        email = await get_sent_email_detail(email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email enviado no encontrado")
        return email
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sent email detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.get('/admin/email/ai/processing-log')
async def get_ai_processing_log(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(_auth_user)
):
    """Get history of AI email processing actions."""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

    try:
        logs = await _db.email_processing_log.find(
            {}, {"_id": 0}
        ).sort("processed_at", -1).limit(limit).to_list(limit)
        return {"logs": logs, "total": len(logs)}
    except Exception as e:
        logger.error(f"Error fetching processing log: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== EMAIL DETAIL (parameterized routes AFTER static routes) ==============

@email_router.get('/admin/email/{uid}')
async def get_email_detail(
    uid: str,
    current_user: dict = Depends(_auth_user),
    folder: str = "INBOX"
):
    """Get single email details with AI categorization"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        email_data = await _email_inbox_service.get_email_by_uid(uid, folder)
        if not email_data:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Mark as read
        await _email_inbox_service.mark_as_read(uid, folder)
        
        # Get AI categorization
        ai_analysis = await _email_inbox_service.categorize_email(email_data)
        email_data['ai_analysis'] = ai_analysis
        
        return email_data
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post('/admin/email/{uid}/process-attachments')
async def process_email_attachments(
    uid: str,
    current_user: dict = Depends(_auth_user),
    folder: str = "INBOX"
):
    """Process attachments from an email and save to client's documents collection."""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Ensure email inbox service has DB
        if _email_inbox_service and _db is not None:
            _email_inbox_service.set_dependencies(_db, None)
        
        result = await _email_inbox_service.process_email_attachments_for_client(uid, folder)
        
        if result.get('errors') and result['processed'] == 0:
            raise HTTPException(status_code=400, detail=result['errors'][0])
        
        return {
            'success': True,
            'processed': result['processed'],
            'skipped': result['skipped'],
            'documents': result['documents'],
            'client': result['client'],
            'errors': result['errors'],
            'message': f"{result['processed']} documento(s) guardado(s) al perfil del cliente"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing attachments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post('/admin/email/{uid}/reply')
async def send_email_reply(
    uid: str,
    current_user: dict = Depends(_auth_user),
    body: dict = None
):
    """Send reply to an email"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        to = body.get('to')
        subject = body.get('subject', '')
        message = body.get('message', '')
        in_reply_to = body.get('in_reply_to')
        
        if not to or not message:
            raise HTTPException(status_code=400, detail="Missing 'to' or 'message'")
        
        success = await _email_inbox_service.send_reply(to, subject, message, in_reply_to)
        
        if success:
            # Log the reply
            await _db.email_replies.insert_one({
                'original_uid': uid,
                'to': to,
                'subject': subject,
                'message': message,
                'sent_by': current_user.get('email'),
                'sent_at': datetime.now(timezone.utc)
            })
            # Also log to sent_emails for the "Enviados" tab
            try:
                from email_engine import log_sent_email
                await log_sent_email(
                    to_email=to,
                    subject=f"Re: {subject}" if not subject.startswith("Re:") else subject,
                    html_body=message,
                    category="admin_reply",
                    related_to=uid,
                )
            except Exception:
                pass
            return {'success': True, 'message': 'Respuesta enviada'}
        else:
            raise HTTPException(status_code=500, detail="Error sending reply")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending reply: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post('/admin/email/compose')
async def compose_email(
    current_user: dict = Depends(_auth_user),
    body: dict = None
):
    """Compose and send a new email"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        to = body.get('to')
        subject = body.get('subject', '')
        message = body.get('message', '')
        cc = body.get('cc')
        
        if not to or not message:
            raise HTTPException(status_code=400, detail="Missing 'to' or 'message'")
        
        success = await _email_inbox_service.send_email(to, subject, message, cc)
        
        if success:
            # Log the sent email
            await _db.email_sent.insert_one({
                'to': to,
                'cc': cc,
                'subject': subject,
                'message': message,
                'sent_by': current_user.get('email'),
                'sent_at': datetime.now(timezone.utc)
            })
            # Also log to sent_emails for the "Enviados" tab
            try:
                from email_engine import log_sent_email
                await log_sent_email(
                    to_email=to,
                    subject=subject,
                    html_body=message,
                    category="manual",
                )
            except Exception:
                pass
            return {'success': True, 'message': 'Email enviado exitosamente'}
        else:
            raise HTTPException(status_code=500, detail="Error sending email")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error composing email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post('/admin/email/{uid}/mark-read')
async def mark_email_read(
    uid: str,
    current_user: dict = Depends(_auth_user),
    folder: str = "INBOX"
):
    """Mark email as read"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        success = await _email_inbox_service.mark_as_read(uid, folder)
        return {'success': success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== AI EMAIL PROCESSING ==============

@email_router.post('/admin/email/{uid}/process-ai')
async def process_email_with_ai(
    uid: str,
    current_user: dict = Depends(_auth_user),
    folder: str = "INBOX"
):
    """Process an incoming email through the AI engine for automatic actions."""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

    try:
        email_data = await _email_inbox_service.get_email_by_uid(uid, folder)
        if not email_data:
            raise HTTPException(status_code=404, detail="Email no encontrado")

        from email_engine import process_incoming_email_ai
        result = await process_incoming_email_ai(email_data)

        return {
            'success': True,
            'intent': result.get('action', 'unknown'),
            'details': result,
            'message': _get_ai_result_message(result)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing email with AI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_ai_result_message(result: dict) -> str:
    """Generate human-readable message from AI processing result."""
    action = result.get("action", "none")
    if action == "appointment":
        if result.get("slots_sent"):
            return f"📅 Se detectó solicitud de cita. Se enviaron {result.get('slots_count', 0)} horarios disponibles al cliente."
        return "📅 Se detectó solicitud de cita pero no se pudieron enviar horarios."
    elif action == "appointment_reply":
        if result.get("appointment_booked"):
            return f"✅ Cita agendada: {result.get('appointment_date', '')} a las {result.get('appointment_time', '')}. Confirmación enviada por email y SMS."
        elif result.get("needs_manual_scheduling"):
            return "⚠️ El cliente respondió pero no se pudo determinar el horario elegido. Se requiere agendar manualmente."
        else:
            return "⚠️ El horario elegido no está disponible. Se enviaron nuevos horarios."
    elif action == "documents":
        if result.get("client_created"):
            return "📄 Documentos detectados. Se creó perfil de cliente nuevo. Use 'Procesar Adjuntos' para guardar los archivos."
        return "📄 Documentos detectados. Use 'Procesar Adjuntos' para guardar los archivos al perfil del cliente."
    elif action == "spam":
        return "🚫 Email clasificado como spam. Sin acción tomada."
    elif action == "general":
        return "📧 Consulta general detectada. Revise y responda manualmente."
    return "❓ Acción no determinada."


print("📧 Email Inbox + Sent + AI endpoints registered")

# ============== EMAIL ANALYTICS ENDPOINTS ==============

@email_router.get('/admin/email-stats')
async def get_admin_email_stats(
    period: str = Query('30d', description="Period: 7d, 30d, 90d"),
    current_user: dict = Depends(_auth_user)
):
    """Get email statistics from SendGrid webhooks"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Convert period to days
        days = {'7d': 7, '30d': 30, '90d': 90}.get(period, 30)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get stats from email_events collection (SendGrid webhooks)
        pipeline = [
            {'$match': {'timestamp': {'$gte': cutoff_date}}},
            {'$group': {'_id': '$event_type', 'count': {'$sum': 1}}}
        ]
        results = await _db.email_events.aggregate(pipeline).to_list(None)
        
        stats = {
            'total_sent': 0,
            'delivered': 0,
            'opened': 0,
            'clicked': 0,
            'bounced': 0,
            'spam_reports': 0,
            'dropped': 0,
            'open_rate': 0,
            'click_rate': 0,
            'bounce_rate': 0
        }
        
        for r in results:
            event_type = r['_id']
            count = r['count']
            if event_type == 'delivered':
                stats['delivered'] = count
                stats['total_sent'] = count
            elif event_type == 'open':
                stats['opened'] = count
            elif event_type == 'click':
                stats['clicked'] = count
            elif event_type == 'bounce':
                stats['bounced'] = count
            elif event_type == 'spamreport':
                stats['spam_reports'] = count
            elif event_type == 'dropped':
                stats['dropped'] = count
        
        # Calculate rates
        if stats['delivered'] > 0:
            stats['open_rate'] = round((stats['opened'] / stats['delivered']) * 100, 1)
            stats['click_rate'] = round((stats['clicked'] / stats['delivered']) * 100, 1)
            stats['bounce_rate'] = round((stats['bounced'] / stats['delivered']) * 100, 1)
        
        return stats
    except Exception as e:
        logger.error(f"Error getting email stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@email_router.get('/admin/email-history')
async def get_admin_email_history(
    limit: int = Query(20, description="Number of emails to return"),
    current_user: dict = Depends(_auth_user)
):
    """Get recent email history with open/click status"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Get recent email events grouped by message
        pipeline = [
            {'$sort': {'timestamp': -1}},
            {'$group': {
                '_id': '$sg_message_id',
                'email': {'$first': '$email'},
                'events': {'$push': '$event_type'},
                'last_event': {'$first': '$event_type'},
                'timestamp': {'$first': '$timestamp'}
            }},
            {'$sort': {'timestamp': -1}},
            {'$limit': limit}
        ]
        
        results = await _db.email_events.aggregate(pipeline).to_list(None)
        
        emails = []
        for r in results:
            events = r.get('events', [])
            emails.append({
                'id': r['_id'] or str(uuid.uuid4()),
                'to': r.get('email', 'N/A'),
                'subject': 'Email enviado',  # SendGrid no incluye subject en webhooks
                'status': 'opened' if 'open' in events else ('delivered' if 'delivered' in events else 'sent'),
                'sent_at': r.get('timestamp').isoformat() if r.get('timestamp') else None,
                'opened_at': r.get('timestamp').isoformat() if 'open' in events else None,
                'clicked_at': r.get('timestamp').isoformat() if 'click' in events else None,
                'events': events
            })
        
        return {'emails': emails, 'total': len(emails)}
    except Exception as e:
        logger.error(f"Error getting email history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("📊 Email Analytics endpoints registered")
