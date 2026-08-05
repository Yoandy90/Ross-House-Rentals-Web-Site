"""
Notification Templates Router
Extracted from server.py for modularization.
"""
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

logger = logging.getLogger(__name__)

notif_templates_router = APIRouter()
_db = None

def init_notif_templates_router(db, get_current_user_func):
    global _db
    _db = db

async def _auth_user(request: Request):
    """Authenticate user from Bearer token — mirrors server.py get_current_user"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    # Handle both "Bearer <token>" and raw "<token>" formats
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Sesión expirada')
    # Get user — handle both ObjectId and UUID string IDs (matches server.py)
    user_id = session['user_id']
    user = None
    try:
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        pass
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=401, detail='Usuario no encontrado')
    user['id'] = str(user['_id'])
    return user


# ==================== NOTIFICATION TEMPLATES ====================

from notification_template_models import (
    NotificationTemplate,
    UpdateTemplateRequest,
    TestNotificationRequest
)

@notif_templates_router.get('/admin/notification-templates', response_model=List[NotificationTemplate])
async def get_notification_templates(
    request: Request,
    category: Optional[str] = None,
    type: Optional[str] = None,
):
    """Get all notification templates (admin only)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if category:
            query['category'] = category
        if type:
            query['type'] = type
        
        templates_cursor = _db.notification_templates.find(query)
        templates = await templates_cursor.to_list(length=100)
        
        # Remove MongoDB _id
        for template in templates:
            if '_id' in template:
                del template['_id']
        
        return [NotificationTemplate(**t) for t in templates]
    except Exception as e:
        logger.error(f"Error getting notification templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notif_templates_router.get('/admin/notification-templates/{template_id}', response_model=NotificationTemplate)
async def get_notification_template(
    template_id: str,
    request: Request,
):
    """Get single notification template (admin only)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        template = await _db.notification_templates.find_one({'id': template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        if '_id' in template:
            del template['_id']
        
        return NotificationTemplate(**template)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting notification template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notif_templates_router.put('/admin/notification-templates/{template_id}', response_model=NotificationTemplate)
async def update_notification_template(
    template_id: str,
    update_request: UpdateTemplateRequest,
    request: Request,
):
    """Update notification template (admin only)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if template exists
        existing = await _db.notification_templates.find_one({'id': template_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Prepare update data
        update_data = {
            'template_content': update_request.template_content,
            'updated_at': datetime.utcnow()
        }
        
        if update_request.subject is not None:
            update_data['subject'] = update_request.subject
        if update_request.is_active is not None:
            update_data['is_active'] = update_request.is_active
        
        # Update template
        await _db.notification_templates.update_one(
            {'id': template_id},
            {'$set': update_data}
        )
        
        # Get updated template
        updated_template = await _db.notification_templates.find_one({'id': template_id})
        if '_id' in updated_template:
            del updated_template['_id']
        
        logger.info(f"Notification template updated: {template_id}")
        return NotificationTemplate(**updated_template)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notif_templates_router.post('/admin/notification-templates/{template_id}/test')
async def test_notification_template(
    template_id: str,
    test_request: TestNotificationRequest,
    request: Request,
):
    """Send test notification with template (admin only)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get template
        template = await _db.notification_templates.find_one({'id': template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Get config for notification service
        config_doc = await _db.config.find_one({})
        if not config_doc:
            raise HTTPException(status_code=500, detail="Configuration not found")
        
        from notification_service import NotificationService
        notification_service = NotificationService(config_doc)
        
        # Replace variables in template
        content = template['template_content']
        subject = template.get('subject', '')
        
        for var_name, var_value in test_request.test_variables.items():
            content = content.replace(f'{{{var_name}}}', str(var_value))
            subject = subject.replace(f'{{{var_name}}}', str(var_value))
        
        result = {'email_sent': False, 'sms_sent': False}
        
        # Send test email
        if template['type'] == 'email' and test_request.test_email:
            try:
                from sendgrid import SendGridAPIClient, Mail, Email, To, Content
                
                message = Mail(
                    from_email=Email(notification_service.sendgrid_from_email, notification_service.sendgrid_from_name),
                    to_emails=To(test_request.test_email),
                    subject=f"[TEST] {subject}",
                    html_content=Content("text/html", content)
                )
                
                response = notification_service.sendgrid_client.send(message)
                result['email_sent'] = response.status_code == 202
                logger.info(f"Test email sent to {test_request.test_email}")
            except Exception as e:
                logger.error(f"Failed to send test email: {e}")
                result['email_error'] = str(e)
        
        # Send test SMS
        if template['type'] == 'sms' and test_request.test_phone:
            try:
                message = notification_service.twilio_client.messages.create(
                    body=f"[TEST] {content}",
                    from_=notification_service.twilio_phone_number,
                    to=test_request.test_phone
                )
                result['sms_sent'] = True
                logger.info(f"Test SMS sent to {test_request.test_phone}")
            except Exception as e:
                logger.error(f"Failed to send test SMS: {e}")
                result['sms_error'] = str(e)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing notification template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@notif_templates_router.post('/admin/notification-templates/initialize')
async def initialize_default_templates(
    request: Request,
):
    """Initialize default notification templates (admin only)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if templates already exist
        existing_count = await _db.notification_templates.count_documents({})
        if existing_count > 0:
            return {"message": f"Templates already initialized ({existing_count} templates exist)"}
        
        # Get default templates from notification_service
        default_templates = []
        
        # ============ LOAN TEMPLATES ============
        
        # Loan application submitted email
        default_templates.append({
            "id": "loan_application_submitted_email",
            "type": "email",
            "category": "loan",
            "name": "Solicitud de Préstamo Recibida - Email",
            "description": "Email enviado cuando un cliente envía una solicitud de préstamo",
            "subject": "Solicitud de Préstamo Recibida - {company_name}",
            "template_content": """
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">{company_name}</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
            <h2 style="color: #6C1110;">¡Solicitud Recibida!</h2>
            
            <p>Hola {user_name},</p>
            
            <p>Hemos recibido tu solicitud de préstamo. Nuestro equipo la está revisando y te contactaremos pronto.</p>
            
            <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #5DC1D9;">
                <h3 style="color: #5DC1D9; margin-top: 0;">Detalles de tu Solicitud</h3>
                <p style="margin: 5px 0;"><strong>ID de Solicitud:</strong> {application_id}</p>
                <p style="margin: 5px 0;"><strong>Monto Solicitado:</strong> ${loan_amount}</p>
                <p style="margin: 5px 0;"><strong>Plazo:</strong> {loan_term} meses</p>
            </div>
            
            <p>Si tienes preguntas, contáctanos al {company_phone} o {company_email}</p>
        </div>
    </div>
</body>
</html>
            """,
            "variables": ["user_name", "company_name", "application_id", "loan_amount", "loan_term", "company_phone", "company_email"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Loan approved email
        default_templates.append({
            "id": "loan_approved_email",
            "type": "email",
            "category": "loan",
            "name": "Préstamo Aprobado - Email",
            "description": "Email enviado cuando un préstamo es aprobado",
            "subject": "¡Préstamo Aprobado! - {company_name}",
            "template_content": """
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">¡Felicidades!</h1>
            <h2 style="margin: 10px 0 0 0;">Tu Préstamo Ha Sido Aprobado</h2>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
            <p>Hola {user_name},</p>
            
            <p style="font-size: 18px; color: #10B981; font-weight: bold;">¡Excelentes noticias! Tu solicitud de préstamo ha sido aprobada.</p>
            
            <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
                <h3 style="color: #10B981; margin-top: 0;">Detalles de tu Préstamo</h3>
                <p style="margin: 5px 0;"><strong>Monto Aprobado:</strong> <span style="font-size: 24px; color: #10B981;">${loan_amount}</span></p>
                <p style="margin: 5px 0;"><strong>Plazo:</strong> {loan_term} meses</p>
                <p style="margin: 5px 0;"><strong>Pago Mensual:</strong> ${monthly_payment}</p>
            </div>
            
            <p>¡Gracias por confiar en nosotros!</p>
        </div>
    </div>
</body>
</html>
            """,
            "variables": ["user_name", "company_name", "loan_amount", "loan_term", "monthly_payment"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Loan rejected email
        default_templates.append({
            "id": "loan_rejected_email",
            "type": "email",
            "category": "loan",
            "name": "Préstamo Rechazado - Email",
            "description": "Email enviado cuando un préstamo es rechazado",
            "subject": "Actualización de Solicitud de Préstamo - {company_name}",
            "template_content": """
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">{company_name}</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
            <h2 style="color: #6C1110;">Actualización de tu Solicitud</h2>
            
            <p>Hola {user_name},</p>
            
            <p>Lamentablemente, después de revisar cuidadosamente tu solicitud de préstamo, no podemos aprobarla en este momento.</p>
            
            <p><strong>Razón:</strong> {rejection_reason}</p>
            
            <p>Apreciamos tu interés y esperamos poder ayudarte en el futuro.</p>
        </div>
    </div>
</body>
</html>
            """,
            "variables": ["user_name", "company_name", "rejection_reason"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # ============ CREDIT/WALLET TEMPLATES ============
        
        default_templates.append({
            "id": "credit_purchase_email",
            "type": "email",
            "category": "credit",
            "name": "Compra de Créditos Confirmada - Email",
            "description": "Email enviado cuando un usuario compra créditos",
            "subject": "Recibo de Compra - {company_name}",
            "template_content": "<html><body><p>Hola {user_name}, tu compra de {credits_amount} créditos por ${transaction_amount} fue exitosa. Nuevo balance: {new_balance} créditos.</p></body></html>",
            "variables": ["user_name", "company_name", "credits_amount", "transaction_amount", "new_balance", "transaction_date"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "credit_transfer_received_email",
            "type": "email",
            "category": "credit",
            "name": "Créditos Recibidos - Email",
            "description": "Email enviado cuando un usuario recibe créditos de otro usuario",
            "subject": "¡Has Recibido Créditos! - {company_name}",
            "template_content": "<html><body><p>Hola {user_name}, {sender_name} te ha enviado {credits_amount} créditos. Nota: {transfer_note}. Nuevo balance: {new_balance}.</p></body></html>",
            "variables": ["user_name", "company_name", "sender_name", "credits_amount", "transfer_note", "new_balance"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "withdrawal_request_email",
            "type": "email",
            "category": "credit",
            "name": "Solicitud de Retiro Recibida - Email",
            "description": "Email enviado cuando un usuario solicita un retiro",
            "subject": "Solicitud de Retiro Recibida - {company_name}",
            "template_content": "<html><body><p>Hola {user_name}, tu solicitud de retiro por ${withdrawal_amount} a cuenta ****{account_last4} fue recibida el {request_date}.</p></body></html>",
            "variables": ["user_name", "company_name", "withdrawal_amount", "account_last4", "request_date"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # ============ APPOINTMENT TEMPLATES ============
        
        default_templates.append({
            "id": "appointment_confirmation_email",
            "type": "email",
            "category": "appointment",
            "name": "Cita Confirmada - Email",
            "description": "Email enviado cuando se confirma una cita",
            "subject": "Cita Confirmada - {company_name}",
            "template_content": "<html><body><p>Hola {user_name}, tu cita para {appointment_date} a las {appointment_time} en {location} ha sido confirmada. Servicio: {service_type}. Contacto: {company_phone}.</p></body></html>",
            "variables": ["user_name", "company_name", "appointment_date", "appointment_time", "service_type", "location", "company_phone"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "appointment_reminder_email",
            "type": "email",
            "category": "appointment",
            "name": "Recordatorio de Cita - Email",
            "description": "Email de recordatorio enviado 24h antes de la cita",
            "subject": "Recordatorio: Cita Mañana - {company_name}",
            "template_content": "<html><body><p>Hola {user_name}, recordatorio de tu cita mañana {appointment_date} a las {appointment_time}. Servicio: {service_type}. ¡Te esperamos!</p></body></html>",
            "variables": ["user_name", "company_name", "appointment_date", "appointment_time", "service_type"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # ============ REFERRAL TEMPLATES ============
        
        default_templates.append({
            "id": "referral_bonus_email",
            "type": "email",
            "category": "general",
            "name": "Bono de Referido Ganado - Email",
            "description": "Email enviado cuando un usuario gana un bono por referir a alguien",
            "subject": "¡Has Ganado un Bono de Referido! - {company_name}",
            "template_content": "<html><body><p>¡Felicidades {user_name}! Ganaste ${bonus_amount} por referir a {referred_name}. Nuevo balance: {new_balance} créditos.</p></body></html>",
            "variables": ["user_name", "company_name", "referred_name", "bonus_amount", "new_balance"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "welcome_email",
            "type": "email",
            "category": "general",
            "name": "Bienvenida - Email",
            "description": "Email de bienvenida para nuevos usuarios",
            "subject": "¡Bienvenido a {company_name}!",
            "template_content": "<html><body><p>Hola {user_name}, ¡bienvenido a {company_name}! Completa tu perfil y explora nuestros servicios. Contacto: {company_email}.</p></body></html>",
            "variables": ["user_name", "company_name", "company_email"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # ============ TAX PREPARATION TEMPLATES ============
        
        default_templates.append({
            "id": "tax_appointment_reminder_email",
            "type": "email",
            "category": "tax",
            "name": "Recordatorio de Cita - Email",
            "description": "Recordatorio de cita de preparación de impuestos",
            "subject": "Recordatorio: Cita de Impuestos - {appointment_date}",
            "template_content": "<html><body><p>Hola {user_name}, tienes cita de impuestos el {appointment_date} a las {appointment_time} en {office_address} con {tax_preparer}. Trae: ID, SSN/ITIN, W-2, recibos. Contacto: {company_phone}.</p></body></html>",
            "variables": ["user_name", "appointment_date", "appointment_time", "office_address", "tax_preparer", "appointment_link", "company_phone"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "tax_appointment_reminder_sms",
            "type": "sms",
            "category": "tax",
            "name": "Recordatorio de Cita - SMS",
            "description": "SMS recordatorio de cita de impuestos",
            "template_content": "Hola {user_name}! Recordatorio: tienes cita para preparar tus impuestos el {appointment_date} a las {appointment_time}. Trae tu ID, SSN/ITIN, W-2 y recibos. Ubicación: {office_address}. ¿Dudas? {company_phone}",
            "variables": ["user_name", "appointment_date", "appointment_time", "office_address", "company_phone"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "tax_return_completed_email",
            "type": "email",
            "category": "tax",
            "name": "Declaración Completada - Email",
            "description": "Notificación cuando la declaración está lista",
            "subject": "Tu Declaración de Impuestos Está Lista!",
            "template_content": "<html><body><p>Hola {user_name}, tu declaración {tax_year} está lista. Reembolso estimado: ${refund_amount}. Revísala y fírmala electrónicamente. Contacto: {company_phone} | {company_email}.</p></body></html>",
            "variables": ["user_name", "tax_year", "refund_amount", "view_return_link", "company_phone", "company_email"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "documents_required_email",
            "type": "email",
            "category": "tax",
            "name": "Documentos Faltantes - Email",
            "description": "Solicitud de documentos faltantes",
            "subject": "Documentos Adicionales Necesarios",
            "template_content": "<html><body><p>Hola {user_name}, necesitamos documentos adicionales: {documents_list}. Puedes subirlos en la app o enviarlos a {company_email}. Contacto: {company_phone}.</p></body></html>",
            "variables": ["user_name", "documents_list", "upload_link", "company_email", "company_phone"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "tax_season_reminder_email",
            "type": "email",
            "category": "tax",
            "name": "Temporada de Impuestos - Email",
            "description": "Recordatorio de inicio de temporada fiscal",
            "subject": "¡Es Temporada de Impuestos! Agenda Tu Cita",
            "template_content": "<html><body><p>Hola {user_name}, la temporada de impuestos ya comenzó. Quedan {days_remaining} días hasta {tax_deadline}. Agenda tu cita ahora. Contacto: {company_phone} | {company_email}.</p></body></html>",
            "variables": ["user_name", "tax_deadline", "days_remaining", "schedule_link", "company_phone", "company_email"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "payment_reminder_email",
            "type": "email",
            "category": "tax",
            "name": "Recordatorio de Pago - Email",
            "description": "Recordatorio de pago pendiente",
            "subject": "Recordatorio: Pago Pendiente",
            "template_content": "<html><body><p>Hola {user_name}, tienes un pago pendiente de ${amount_due}. Factura #{invoice_number}. Fecha límite: {due_date}. Contacto: {company_phone} | {company_email}.</p></body></html>",
            "variables": ["user_name", "amount_due", "invoice_number", "due_date", "payment_link", "company_phone", "company_email"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # ============ GAMES & LOTTERY TEMPLATES ============
        
        default_templates.append({
            "id": "bolita_number_drawn_push",
            "type": "push",
            "category": "bolita",
            "name": "Número Sorteado - Push Notification",
            "description": "Notificación cuando sale un número de La Bolita",
            "template_content": "¡Número Sorteado! El número ganador de {lottery_name} es: {winning_number}",
            "variables": ["lottery_name", "winning_number"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "bolita_winner_email",
            "type": "email",
            "category": "bolita",
            "name": "¡Ganaste en La Bolita! - Email",
            "description": "Email cuando el usuario gana en La Bolita Cubana",
            "subject": "¡FELICIDADES! Ganaste en La Bolita Cubana",
            "template_content": "<html><body><p>¡Felicidades {user_name}! Tu número {your_number} ganó en {lottery_name} (número ganador: {winning_number}). Premio: ${prize_amount}. Nuevo balance: ${new_balance}.</p></body></html>",
            "variables": ["user_name", "lottery_name", "winning_number", "your_number", "prize_amount", "new_balance", "app_link"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "bolita_results_sms",
            "type": "sms",
            "category": "bolita",
            "name": "Resultados de La Bolita - SMS",
            "description": "SMS con resultados del sorteo",
            "template_content": "La Bolita Cubana - {lottery_name}: Número ganador {winning_number}. {result_message}. ¡Revisa la app para más detalles!",
            "variables": ["lottery_name", "winning_number", "result_message"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "scratch_card_winner_push",
            "type": "push",
            "category": "scratch_card",
            "name": "Raspadito Ganador - Push",
            "description": "Notificación cuando ganas en un raspadito",
            "template_content": "¡Ganaste {prize} en tu raspadito {card_name}! El premio ha sido acreditado a tu billetera",
            "variables": ["prize", "card_name"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "scratch_card_winner_email",
            "type": "email",
            "category": "scratch_card",
            "name": "Raspadito Ganador - Email",
            "description": "Email cuando ganas en un raspadito",
            "subject": "¡Ganaste ${prize} en tu Raspadito!",
            "template_content": "<html><body><p>¡Felicidades {user_name}! Ganaste ${prize} en el raspadito {card_name}. Nuevo balance: ${new_balance}.</p></body></html>",
            "variables": ["user_name", "card_name", "prize", "new_balance", "app_link"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "scratch_card_new_card_push",
            "type": "push",
            "category": "scratch_card",
            "name": "Nuevo Raspadito Disponible - Push",
            "description": "Notificación de nuevo raspadito disponible",
            "template_content": "¡Nuevo raspadito disponible! {card_name} - Solo ${price}. ¡Prueba tu suerte ahora!",
            "variables": ["card_name", "price"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        default_templates.append({
            "id": "games_promotion_email",
            "type": "email",
            "category": "games",
            "name": "Promoción de Juegos - Email",
            "description": "Email promocional para juegos y sorteos",
            "subject": "¡Nuevas Oportunidades de Ganar! {promo_title}",
            "template_content": "<html><body><p>Hola {user_name}, {promo_description}. La Bolita Cubana, Raspaditos, Sorteos Especiales. ¡Juega ahora!</p></body></html>",
            "variables": ["user_name", "promo_title", "promo_description", "games_link"],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Insert default templates
        if default_templates:
            await _db.notification_templates.insert_many(default_templates)
            logger.info(f"Initialized {len(default_templates)} default notification templates")
        
        return {
            "message": f"Successfully initialized {len(default_templates)} default templates",
            "templates_count": len(default_templates)
        }
    except Exception as e:
        logger.error(f"Error initializing default templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))
