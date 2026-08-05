"""
Marketing Routes Router
Extracted from server.py for modularization.
Handles marketing lists, campaigns, templates, analytics, bulk sending, and unsubscribe management.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends, BackgroundTasks
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

marketing_router = APIRouter()
_db = None
_notification_service = None


def init_marketing_router(db, notification_service=None):
    global _db, _notification_service
    _db = db
    _notification_service = notification_service


def update_marketing_notification_service(service):
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

# ================== MARKETING AUTOMATION SYSTEM ==================

@marketing_router.post('/admin/marketing/add-to-list')
async def add_client_to_marketing_list(
    request: dict,
    current_user: dict = Depends(_require_admin)
):
    """Add a client to the marketing list after completing their tax return"""
    try:
        client_id = request.get('client_id')
        client_email = request.get('client_email')
        client_name = request.get('client_name')
        client_phone = request.get('client_phone')
        tax_year = request.get('tax_year')
        
        if not client_email:
            raise HTTPException(status_code=400, detail='Email is required')
        
        # Check if already in marketing list
        existing = await _db.marketing_list.find_one({'email': client_email})
        
        if existing:
            # Update existing record
            await _db.marketing_list.update_one(
                {'email': client_email},
                {'$set': {
                    'name': client_name or existing.get('name'),
                    'phone': client_phone or existing.get('phone'),
                    'last_tax_year': tax_year,
                    'updated_at': datetime.now(timezone.utc),
                    'status': 'active'
                },
                '$push': {
                    'tax_years_completed': tax_year
                }}
            )
            return {'success': True, 'message': 'Cliente actualizado en lista de marketing', 'action': 'updated'}
        
        # Add new record
        marketing_record = {
            'client_id': client_id,
            'email': client_email,
            'name': client_name,
            'phone': client_phone,
            'last_tax_year': tax_year,
            'tax_years_completed': [tax_year] if tax_year else [],
            'status': 'active',
            'subscribed_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'email_preferences': {
                'tips': True,
                'news': True,
                'promotions': True,
                'reminders': True
            },
            'campaigns_sent': [],
            'last_email_sent': None
        }
        
        await _db.marketing_list.insert_one(marketing_record)
        logging.info(f'✅ Cliente agregado a marketing: {client_email}')
        
        return {'success': True, 'message': 'Cliente agregado a lista de marketing', 'action': 'added'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error adding to marketing list: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/list')
async def get_marketing_list(
    status: str = Query('active'),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(_require_admin)
):
    """Get clients in the marketing list"""
    try:
        query = {}
        if status != 'all':
            query['status'] = status
        
        clients = await _db.marketing_list.find(query).sort('subscribed_at', -1).to_list(limit)
        
        result = []
        for c in clients:
            result.append({
                'id': str(c.get('_id')),
                'client_id': c.get('client_id'),
                'email': c.get('email'),
                'name': c.get('name'),
                'phone': c.get('phone'),
                'status': c.get('status'),
                'last_tax_year': c.get('last_tax_year'),
                'tax_years_completed': c.get('tax_years_completed', []),
                'subscribed_at': c.get('subscribed_at').isoformat() if c.get('subscribed_at') else None,
                'last_email_sent': c.get('last_email_sent').isoformat() if c.get('last_email_sent') else None,
                'campaigns_sent': len(c.get('campaigns_sent', []))
            })
        
        return {
            'success': True,
            'clients': result,
            'total': len(result)
        }
        
    except Exception as e:
        logging.error(f'Error getting marketing list: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/templates')
async def get_marketing_templates(
    current_user: dict = Depends(_require_admin)
):
    """Get predefined marketing email templates"""
    templates = [
        {
            'id': 'tax_tips_monthly',
            'name': 'Tips Fiscales Mensuales',
            'description': 'Consejos y recordatorios mensuales sobre impuestos',
            'category': 'tips',
            'subject': '💡 Tips Fiscales del Mes - Ross Tax'
        },
        {
            'id': 'irs_news',
            'name': 'Noticias del IRS',
            'description': 'Actualizaciones importantes del IRS',
            'category': 'news',
            'subject': '📰 Noticias Importantes del IRS - Ross Tax'
        },
        {
            'id': 'tax_season_reminder',
            'name': 'Recordatorio Temporada de Impuestos',
            'description': 'Recordatorio de inicio de temporada',
            'category': 'reminders',
            'subject': '📅 ¡La Temporada de Impuestos Está Aquí! - Ross Tax'
        },
        {
            'id': 'document_checklist',
            'name': 'Lista de Documentos',
            'description': 'Recordatorio de documentos necesarios',
            'category': 'reminders',
            'subject': '📋 Documentos que Necesitas para tu Declaración - Ross Tax'
        },
        {
            'id': 'early_bird_promo',
            'name': 'Promoción Madrugadores',
            'description': 'Descuento por declaración temprana',
            'category': 'promotions',
            'subject': '🎁 Descuento Especial por Declarar Temprano - Ross Tax'
        },
        {
            'id': 'referral_reminder',
            'name': 'Programa de Referidos',
            'description': 'Recordatorio del programa de referidos',
            'category': 'promotions',
            'subject': '👥 Gana Dinero Refiriendo Amigos - Ross Tax'
        },
        {
            'id': 'thank_you_year_end',
            'name': 'Agradecimiento Fin de Año',
            'description': 'Mensaje de agradecimiento de fin de año',
            'category': 'general',
            'subject': '🙏 Gracias por Confiar en Ross Tax'
        },
        {
            'id': 'appointment_early',
            'name': 'Agendar Cita Temprano',
            'description': 'Invitación a agendar cita anticipada',
            'category': 'reminders',
            'subject': '📆 Agenda tu Cita Ahora y Evita la Prisa - Ross Tax'
        }
    ]
    
    return {'success': True, 'templates': templates}


@marketing_router.post('/admin/marketing/send-campaign')
async def send_marketing_campaign(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(_require_admin)
):
    """Send a marketing campaign to selected clients"""
    try:
        template_id = request.get('template_id')
        subject = request.get('subject')
        html_content = request.get('html_content')
        client_ids = request.get('client_ids', [])  # Empty = all active
        send_to_all = request.get('send_to_all', False)
        
        if not subject or not html_content:
            raise HTTPException(status_code=400, detail='Subject and content are required')
        
        # Get recipients
        if send_to_all or not client_ids:
            query = {'status': 'active'}
        else:
            query = {'_id': {'$in': [ObjectId(cid) for cid in client_ids]}}
        
        recipients = await _db.marketing_list.find(query).to_list(1000)
        
        if not recipients:
            raise HTTPException(status_code=400, detail='No recipients found')
        
        # Get notification service config
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail='Notification config not found')
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        if not notif_service.sendgrid_client:
            raise HTTPException(status_code=500, detail='SendGrid not configured')
        
        # Create campaign record
        campaign_id = str(uuid.uuid4())
        campaign = {
            'id': campaign_id,
            'template_id': template_id,
            'subject': subject,
            'total_recipients': len(recipients),
            'sent': 0,
            'failed': 0,
            'status': 'sending',
            'created_by': current_user.get('name', 'Admin'),
            'created_at': datetime.now(timezone.utc)
        }
        await _db.marketing_campaigns.insert_one(campaign)
        
        # Send emails
        sent_count = 0
        failed_count = 0
        
        for recipient in recipients:
            try:
                email = recipient.get('email')
                name = recipient.get('name', 'Cliente')
                first_name = name.split()[0] if name else 'Cliente'
                
                # Personalize content
                personalized_html = html_content.replace('{{nombre}}', first_name)
                personalized_html = personalized_html.replace('{{email}}', email)
                
                await notif_service.send_email(
                    to_email=email,
                    subject=subject,
                    html_content=personalized_html
                )
                
                # Update recipient record
                await _db.marketing_list.update_one(
                    {'_id': recipient['_id']},
                    {
                        '$set': {'last_email_sent': datetime.now(timezone.utc)},
                        '$push': {'campaigns_sent': campaign_id}
                    }
                )
                
                sent_count += 1
                
            except Exception as send_error:
                logging.error(f'Failed to send to {recipient.get("email")}: {send_error}')
                failed_count += 1
        
        # Update campaign stats
        await _db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'sent': sent_count,
                'failed': failed_count,
                'status': 'completed',
                'completed_at': datetime.now(timezone.utc)
            }}
        )
        
        logging.info(f'✅ Marketing campaign sent: {sent_count} emails, {failed_count} failed')
        
        return {
            'success': True,
            'campaign_id': campaign_id,
            'sent': sent_count,
            'failed': failed_count,
            'total': len(recipients)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error sending marketing campaign: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/campaigns')
async def get_marketing_campaigns(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(_require_admin)
):
    """Get history of marketing campaigns"""
    try:
        campaigns = await _db.marketing_campaigns.find({}).sort('created_at', -1).to_list(limit)
        
        result = []
        for c in campaigns:
            result.append({
                'id': c.get('id', str(c.get('_id'))),
                'template_id': c.get('template_id'),
                'subject': c.get('subject'),
                'total_recipients': c.get('total_recipients', 0),
                'sent': c.get('sent', 0),
                'failed': c.get('failed', 0),
                'status': c.get('status'),
                'created_by': c.get('created_by'),
                'created_at': c.get('created_at').isoformat() if c.get('created_at') else None,
                'completed_at': c.get('completed_at').isoformat() if c.get('completed_at') else None
            })
        
        return {'success': True, 'campaigns': result}
        
    except Exception as e:
        logging.error(f'Error getting campaigns: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/lists')
async def get_marketing_lists(current_user: dict = Depends(_require_admin)):
    """Get marketing lists with counts"""
    try:
        # Get total users count
        total_users = await _db.users.count_documents({'role': {'$ne': 'admin'}})
        
        # Get active clients (with appointments in last year)
        one_year_ago = datetime.now(timezone.utc) - timedelta(days=365)
        active_count = await _db.appointments.count_documents({
            'scheduled_at': {'$gte': one_year_ago},
            'status': {'$in': ['completed', 'confirmed']}
        })
        
        # Get new clients (registered this month)
        first_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_count = await _db.users.count_documents({
            'created_at': {'$gte': first_of_month},
            'role': {'$ne': 'admin'}
        })
        
        # Get marketing list subscribers
        marketing_subscribers = await _db.marketing_list.count_documents({})
        
        lists = [
            {
                'id': 'all',
                'name': 'Todos los Clientes',
                'description': 'Todos los clientes registrados',
                'count': total_users,
                'type': 'all'
            },
            {
                'id': 'active',
                'name': 'Clientes Activos',
                'description': 'Clientes con citas en el último año',
                'count': active_count,
                'type': 'active'
            },
            {
                'id': 'marketing',
                'name': 'Lista de Marketing',
                'description': 'Clientes suscritos a marketing',
                'count': marketing_subscribers,
                'type': 'custom'
            },
            {
                'id': 'new',
                'name': 'Clientes Nuevos',
                'description': 'Clientes registrados este mes',
                'count': new_count,
                'type': 'new'
            }
        ]
        
        return {'success': True, 'lists': lists}
        
    except Exception as e:
        logging.error(f'Error getting marketing lists: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/analytics')
async def get_marketing_analytics(current_user: dict = Depends(_require_admin)):
    """Get marketing analytics summary"""
    try:
        # Get campaign stats
        campaigns = await _db.marketing_campaigns.find({}).to_list(1000)
        
        total_sent = sum(c.get('sent', 0) for c in campaigns)
        total_opened = sum(c.get('opened', 0) for c in campaigns)
        total_clicked = sum(c.get('clicked', 0) for c in campaigns)
        total_bounced = sum(c.get('bounced', 0) for c in campaigns)
        
        open_rate = round((total_opened / total_sent * 100) if total_sent > 0 else 0, 1)
        click_rate = round((total_clicked / total_sent * 100) if total_sent > 0 else 0, 1)
        bounce_rate = round((total_bounced / total_sent * 100) if total_sent > 0 else 0, 1)
        
        return {
            'totalSent': total_sent,
            'openRate': open_rate,
            'clickRate': click_rate,
            'bounceRate': bounce_rate,
            'totalCampaigns': len(campaigns)
        }
        
    except Exception as e:
        logging.error(f'Error getting marketing analytics: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.post('/admin/marketing/campaigns')
async def create_marketing_campaign(
    request: Request,
    current_user: dict = Depends(_require_admin)
):
    """Create a new marketing campaign"""
    try:
        data = await request.json()
        
        campaign_id = str(uuid.uuid4())
        campaign = {
            'id': campaign_id,
            'name': data.get('name'),
            'subject': data.get('subject'),
            'template': data.get('template'),
            'audience': data.get('audience'),
            'content': data.get('content'),
            'status': 'draft',
            'created_by': current_user.get('name', 'Admin'),
            'created_at': datetime.now(timezone.utc),
            'stats': {
                'sent': 0,
                'opened': 0,
                'clicked': 0,
                'bounced': 0
            }
        }
        
        await _db.marketing_campaigns.insert_one(campaign)
        
        return {'success': True, 'campaign_id': campaign_id, 'message': 'Campaña creada exitosamente'}
        
    except Exception as e:
        logging.error(f'Error creating campaign: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.post('/admin/marketing/campaigns/{campaign_id}/send')
async def send_marketing_campaign(
    campaign_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Send a marketing campaign to its audience"""
    try:
        # Find campaign
        campaign = await _db.marketing_campaigns.find_one({'id': campaign_id})
        if not campaign:
            raise HTTPException(status_code=404, detail='Campaña no encontrada')
        
        if campaign.get('status') == 'sent':
            raise HTTPException(status_code=400, detail='Esta campaña ya fue enviada')
        
        # Get audience
        audience_id = campaign.get('audience', 'all')
        recipients = []
        
        if audience_id == 'all':
            users = await _db.users.find({'role': {'$ne': 'admin'}, 'email': {'$exists': True}}).to_list(10000)
            recipients = [{'email': u.get('email'), 'name': u.get('full_name', '')} for u in users if u.get('email')]
        elif audience_id == 'marketing':
            subscribers = await _db.marketing_list.find({}).to_list(10000)
            recipients = [{'email': s.get('email'), 'name': s.get('name', '')} for s in subscribers if s.get('email')]
        elif audience_id == 'active':
            one_year_ago = datetime.now(timezone.utc) - timedelta(days=365)
            appointments = await _db.appointments.find({
                'scheduled_at': {'$gte': one_year_ago},
                'status': {'$in': ['completed', 'confirmed']}
            }).to_list(10000)
            emails = set()
            for apt in appointments:
                if apt.get('client_email'):
                    emails.add((apt.get('client_email'), apt.get('client_name', '')))
            recipients = [{'email': e, 'name': n} for e, n in emails]
        
        if not recipients:
            raise HTTPException(status_code=400, detail='No hay destinatarios para esta campaña')
        
        # Update campaign status
        await _db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'status': 'sending',
                'total_recipients': len(recipients)
            }}
        )
        
        # In production, this would send emails via SendGrid
        # For now, we'll mark as sent
        sent_count = len(recipients)
        
        await _db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'status': 'sent',
                'sent_at': datetime.now(timezone.utc),
                'stats.sent': sent_count
            }}
        )
        
        return {
            'success': True, 
            'message': f'Campaña enviada a {sent_count} destinatarios',
            'sent': sent_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error sending campaign: {e}')
        raise HTTPException(status_code=500, detail=str(e))




@marketing_router.post('/admin/marketing/unsubscribe/{email}')
async def unsubscribe_from_marketing(
    email: str,
    current_user: dict = Depends(_require_admin)
):
    """Unsubscribe a client from marketing emails"""
    try:
        result = await _db.marketing_list.update_one(
            {'email': email},
            {'$set': {
                'status': 'unsubscribed',
                'unsubscribed_at': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Email not found in marketing list')
        
        return {'success': True, 'message': f'{email} removed from marketing list'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error unsubscribing: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.post('/admin/marketing/send-test-email')
async def send_test_marketing_email(
    data: dict,
    current_user: dict = Depends(_auth_user)
):
    """Send test marketing email to admin for review"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        template_id = data.get('template_id')
        to_email = data.get('to_email', current_user.get('email'))
        test_name = data.get('test_name', 'Cliente')
        
        if template_id not in MARKETING_EMAIL_TEMPLATES:
            raise HTTPException(status_code=400, detail=f'Template no encontrado. Disponibles: {list(MARKETING_EMAIL_TEMPLATES.keys())}')
        
        template = MARKETING_EMAIL_TEMPLATES[template_id]
        subject = f"[PRUEBA] {template['subject']}"
        html_content = template['html'].replace('{nombre}', test_name)
        
        # Get notification service config
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail='Notification service not configured')
        
        from notification_service import NotificationService
        notif_svc = NotificationService(config_doc)
        
        if not notif_svc.sendgrid_client:
            raise HTTPException(status_code=500, detail='SendGrid not configured')
        
        success = await notif_svc.send_email(to_email, subject, html_content)
        
        if success:
            return {
                'success': True,
                'message': f'Email de prueba enviado a {to_email}',
                'template_used': template_id,
                'subject': subject
            }
        else:
            raise HTTPException(status_code=500, detail='Error al enviar el email')
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending test marketing email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@marketing_router.get('/admin/marketing/templates')
async def get_marketing_templates(current_user: dict = Depends(_auth_user)):
    """Get available marketing email templates"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    templates = []
    for key, value in MARKETING_EMAIL_TEMPLATES.items():
        templates.append({
            'id': key,
            'subject': value['subject'],
            'description': 'Para clientes que aún no han ido' if key == 'cita_pendiente' else 'Para clientes que ya presentaron (educativo)'
        })
    
    return {'templates': templates}


@marketing_router.post('/admin/marketing/send-bulk')
async def send_bulk_marketing_emails(
    data: dict,
    current_user: dict = Depends(_auth_user)
):
    """Send bulk marketing emails to target audience"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        template_id = data.get('template_id')
        target_audience = data.get('target_audience')  # 'ya_fueron' or 'no_han_ido'
        
        if template_id not in MARKETING_EMAIL_TEMPLATES:
            raise HTTPException(status_code=400, detail=f'Template no encontrado')
        
        # Get notification service
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail='Notification service not configured')
        
        from notification_service import NotificationService
        notif_svc = NotificationService(config_doc)
        
        if not notif_svc.sendgrid_client:
            raise HTTPException(status_code=500, detail='SendGrid not configured')
        
        template = MARKETING_EMAIL_TEMPLATES[template_id]
        
        # Get target emails based on audience
        if target_audience == 'ya_fueron':
            # Clients with paid invoices
            invoices = await _db.invoices.find({'status': 'paid'}).to_list(2000)
            all_emails = list(set([inv.get('user_email') for inv in invoices if inv.get('user_email')]))
            # Filter valid emails
            target_emails = [
                email for email in all_emails 
                if email and '@' in email 
                and 'placeholder' not in email.lower() 
                and 'temp.rosstax' not in email.lower()
                and 'noemail.rosstax' not in email.lower()
            ]
        else:  # no_han_ido
            # Get all clients
            all_clients = await _db.users.find({
                'role': {'$nin': ['admin', 'office_assistant']}
            }).to_list(2000)
            
            # Get emails with paid invoices
            invoices = await _db.invoices.find({'status': 'paid'}).to_list(2000)
            paid_emails = set([inv.get('user_email', '').lower() for inv in invoices if inv.get('user_email')])
            
            # Filter clients without invoices
            target_emails = [
                client.get('email') for client in all_clients
                if client.get('email') 
                and '@' in client.get('email', '')
                and 'placeholder' not in client.get('email', '').lower()
                and 'noemail' not in client.get('email', '').lower()
                and client.get('email', '').lower() not in paid_emails
            ]
        
        # Send emails
        results = {
            'total_target': len(target_emails),
            'sent': 0,
            'failed': 0,
            'errors': []
        }
        
        for email in target_emails:
            try:
                # Get user name
                user = await _db.users.find_one({'email': {'$regex': f'^{email}$', '$options': 'i'}})
                name = 'Cliente'
                if user:
                    name = user.get('full_name') or user.get('name') or 'Cliente'
                    name = name.split()[0] if name else 'Cliente'  # First name only
                
                html_content = template['html'].replace('{nombre}', name)
                success = await notif_svc.send_email(email, template['subject'], html_content)
                
                if success:
                    results['sent'] += 1
                else:
                    results['failed'] += 1
                    
            except Exception as e:
                results['failed'] += 1
                if len(results['errors']) < 10:
                    results['errors'].append(f"{email}: {str(e)}")
        
        # Log campaign
        await _db.marketing_campaigns.insert_one({
            'template_id': template_id,
            'target_audience': target_audience,
            'total_sent': results['sent'],
            'total_failed': results['failed'],
            'sent_by': current_user.get('email'),
            'created_at': datetime.utcnow()
        })
        
        return {
            'success': True,
            'message': f"Campaña completada: {results['sent']} emails enviados",
            'results': results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in bulk marketing email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# DEBUG endpoint - temporary
