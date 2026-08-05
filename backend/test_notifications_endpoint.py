"""
Test Notification Channels — Admin endpoint to verify Email, SMS, and Push
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter()

_db = None
_notification_service = None


def init_test_notifications(db, notification_service=None):
    global _db, _notification_service
    _db = db
    _notification_service = notification_service


@router.post('/admin/test-notifications')
async def test_all_notification_channels(request: Request):
    """
    Admin: Test Email, SMS, and Push notification channels.
    Body: { "email": "test@email.com", "phone": "+18061234567", "push_token": "ExponentPushToken[...]", "channels": ["email", "sms", "push"] }
    If channels not specified, tests all provided contact methods.
    """
    try:
        data = await request.json()
        email = data.get('email', '')
        phone = data.get('phone', '')
        push_token = data.get('push_token', '')
        channels = data.get('channels', ['email', 'sms', 'push'])

        results = {
            'email': {'tested': False, 'success': False, 'error': None},
            'sms': {'tested': False, 'success': False, 'error': None},
            'push': {'tested': False, 'success': False, 'error': None},
            'service_status': {
                'sendgrid_configured': False,
                'twilio_configured': False,
                'expo_push_configured': False,
            }
        }

        # Check service configuration
        if _notification_service:
            results['service_status']['sendgrid_configured'] = bool(_notification_service.sendgrid_client or _notification_service.sendgrid_api_key)
            results['service_status']['twilio_configured'] = bool(_notification_service.twilio_client)
        
        expo_token_env = os.getenv('EXPO_ACCESS_TOKEN', '')
        results['service_status']['expo_push_configured'] = bool(expo_token_env)

        # Test Email
        if 'email' in channels and email:
            results['email']['tested'] = True
            try:
                from lending_notification_service import get_lending_notifications, BRAND, _email_wrapper
                b = BRAND
                ns = get_lending_notifications()

                # Check SMTP config
                if not ns.smtp_user or not ns.smtp_password:
                    results['email']['error'] = 'SMTP no configurado (faltan LENDING_EMAIL o LENDING_EMAIL_PASSWORD)'
                else:
                    title_html = """
                    <div style="padding:28px 28px 0;">
                      <div style="background: linear-gradient(135deg, rgba(5,150,105,0.15), rgba(52,211,153,0.08)); border: 1px solid #059669; border-radius: 12px; padding: 20px; text-align: center;">
                        <p style="margin:0; font-size: 32px;">&#9989;</p>
                        <h2 style="margin:10px 0 0; color: #34D399; font-size: 20px; font-weight: 700;">Prueba de Notificacion</h2>
                      </div>
                    </div>"""
                    body_html = f"""
                    <p style="color: #F9FAFB;">Esta es una notificacion de prueba de <strong style="color:#34D399;">{b['company_name']}</strong>.</p>

                    <div style="background: #0B1120; border: 1px solid #1F2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:8px 0; color:#6B7280; font-size:13px;">Canal de Email</td>
                          <td style="padding:8px 0; text-align:right; color:#34D399; font-weight:700; font-size:14px;">FUNCIONANDO</td>
                        </tr>
                        <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:2px 0;"></td></tr>
                        <tr>
                          <td style="padding:8px 0; color:#6B7280; font-size:13px;">Servidor SMTP</td>
                          <td style="padding:8px 0; text-align:right; color:#E5E7EB; font-size:13px;">{b['smtp_host']}</td>
                        </tr>
                        <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:2px 0;"></td></tr>
                        <tr>
                          <td style="padding:8px 0; color:#6B7280; font-size:13px;">Enviado desde</td>
                          <td style="padding:8px 0; text-align:right; color:#FBBF24; font-size:13px;">{b['from_email']}</td>
                        </tr>
                        <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:2px 0;"></td></tr>
                        <tr>
                          <td style="padding:8px 0; color:#6B7280; font-size:13px;">Fecha</td>
                          <td style="padding:8px 0; text-align:right; color:#E5E7EB; font-size:13px;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #6B7280; font-size: 13px;">Si recibes este correo, las notificaciones de Ross Lending estan funcionando correctamente.</p>
                    """
                    html = _email_wrapper(title_html, body_html)
                    success = await ns.send_email(email, f'🔔 {b["company_short"]} — Prueba de Notificación', html)
                    results['email']['success'] = success
                    if not success:
                        results['email']['error'] = 'SMTP devolvió error (revisa logs del servidor)'
            except Exception as e:
                results['email']['error'] = str(e)

        # Test SMS
        if 'sms' in channels and phone:
            results['sms']['tested'] = True
            try:
                if not _notification_service:
                    results['sms']['error'] = 'NotificationService no inicializado'
                elif not _notification_service.twilio_client:
                    results['sms']['error'] = 'Twilio no configurado (faltan credenciales)'
                else:
                    success = await _notification_service.send_sms(
                        to_phone=phone,
                        message=f"✅ Ross Lending: Prueba de SMS exitosa. Si recibes esto, el canal SMS funciona correctamente. ({datetime.utcnow().strftime('%H:%M UTC')})"
                    )
                    results['sms']['success'] = success
                    if not success:
                        results['sms']['error'] = 'Twilio devolvió error (revisa logs del servidor)'
            except Exception as e:
                results['sms']['error'] = str(e)

        # Test Push
        if 'push' in channels and push_token:
            results['push']['tested'] = True
            try:
                from push_notification_service import PushNotificationService
                push_service = PushNotificationService()
                result = await push_service.send_push_notification(
                    push_tokens=[push_token],
                    title='🔔 Ross Lending — Prueba',
                    body='¡Las notificaciones push están funcionando correctamente!',
                    data={'type': 'test', 'timestamp': datetime.utcnow().isoformat()}
                )
                results['push']['success'] = result.get('success', False) or result.get('sent_count', 0) > 0
                if not results['push']['success']:
                    results['push']['error'] = result.get('message', 'Error desconocido')
            except Exception as e:
                results['push']['error'] = str(e)

        # If no push_token provided but push requested, try to find one from the admin user
        if 'push' in channels and not push_token and _db is not None:
            results['push']['tested'] = True
            try:
                admin_user = await _db.users.find_one({'email': email, 'push_token': {'$exists': True, '$ne': None}})
                if admin_user and admin_user.get('push_token'):
                    from push_notification_service import PushNotificationService
                    push_service = PushNotificationService()
                    result = await push_service.send_push_notification(
                        push_tokens=[admin_user['push_token']],
                        title='🔔 Ross Lending — Prueba',
                        body='¡Las notificaciones push están funcionando correctamente!',
                        data={'type': 'test'}
                    )
                    results['push']['success'] = result.get('success', False) or result.get('sent_count', 0) > 0
                    if not results['push']['success']:
                        results['push']['error'] = result.get('message', 'Error desconocido')
                else:
                    results['push']['error'] = 'No se encontró push_token para este usuario. Abre la app móvil primero.'
            except Exception as e:
                results['push']['error'] = str(e)

        # Summary
        tested_count = sum(1 for v in results.values() if isinstance(v, dict) and v.get('tested'))
        success_count = sum(1 for v in results.values() if isinstance(v, dict) and v.get('success'))
        
        results['summary'] = {
            'total_tested': tested_count,
            'total_success': success_count,
            'all_working': tested_count > 0 and tested_count == success_count,
        }

        return results

    except Exception as e:
        logger.error(f"Error in test notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/notification-status')
async def get_notification_status(request: Request):
    """Admin: Check current notification service configuration status"""
    status = {
        'email': {
            'provider': 'SMTP (SiteGround)',
            'configured': False,
            'from_email': None,
            'smtp_host': None,
        },
        'sms': {
            'provider': 'Twilio',
            'configured': False,
            'from_number': None,
        },
        'push': {
            'provider': 'Expo Push API',
            'configured': False,
        },
    }

    # Check Ross Lending SMTP config
    try:
        from lending_notification_service import get_lending_notifications, BRAND
        ns = get_lending_notifications()
        status['email']['configured'] = bool(ns.smtp_user and ns.smtp_password)
        status['email']['from_email'] = ns.from_email
        status['email']['smtp_host'] = ns.smtp_host
        status['sms']['configured'] = bool(ns.twilio_client)
        status['sms']['from_number'] = ns.twilio_phone
    except Exception:
        if _notification_service:
            status['email']['configured'] = bool(_notification_service.sendgrid_client or _notification_service.sendgrid_api_key)
            status['email']['from_email'] = _notification_service.sendgrid_from_email
            status['sms']['configured'] = bool(_notification_service.twilio_client)
            status['sms']['from_number'] = _notification_service.twilio_phone_number
    
    expo_token = os.getenv('EXPO_ACCESS_TOKEN', '')
    status['push']['configured'] = bool(expo_token)

    return status


logger.info("✅ Test Notification endpoints initialized")
