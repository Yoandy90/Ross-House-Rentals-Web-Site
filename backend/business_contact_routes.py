"""
Business Contact & Email Config Routes
- Public endpoint for app/web to fetch dynamic contact info
- Admin endpoints to update business info and email SMTP/IMAP settings
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from unified_config_manager import config_manager

logger = logging.getLogger(__name__)
business_router = APIRouter()


class BusinessContactUpdate(BaseModel):
    business_name: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_address: Optional[str] = None
    business_city: Optional[str] = None
    business_state: Optional[str] = None
    business_zip: Optional[str] = None
    business_hours: Optional[str] = None
    business_website: Optional[str] = None
    business_license: Optional[str] = None


class EmailConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_encryption: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[str] = None
    imap_username: Optional[str] = None
    imap_password: Optional[str] = None
    email_from_address: Optional[str] = None
    email_from_name: Optional[str] = None


# ═══════════════════════════════════════
# PUBLIC (No auth — used by app & website)
# ═══════════════════════════════════════

@business_router.get('/public/contact-info')
async def get_public_contact_info():
    """Returns business contact info dynamically from admin config."""
    info = {
        'business_name': await config_manager.get('business_name') or 'Ross Lending Solutions LLC',
        'phone': await config_manager.get('business_phone') or '(806) 934-2018',
        'email': await config_manager.get('business_email') or 'info@rosslending.com',
        'address': await config_manager.get('business_address') or '',
        'city': await config_manager.get('business_city') or 'Dumas',
        'state': await config_manager.get('business_state') or 'TX',
        'zip': await config_manager.get('business_zip') or '79029',
        'hours': await config_manager.get('business_hours') or 'Lun-Vie 9AM-6PM',
        'website': await config_manager.get('business_website') or 'https://rosslending.com',
        'license': await config_manager.get('business_license') or '',
    }
    return {'success': True, 'contact': info}


# ═══════════════════════════════════════
# ADMIN — Business Contact Info
# ═══════════════════════════════════════

@business_router.get('/admin/business-contact')
async def get_business_contact():
    """Get all business contact fields for the admin panel."""
    fields = [
        'business_name', 'business_phone', 'business_email',
        'business_address', 'business_city', 'business_state',
        'business_zip', 'business_hours', 'business_website', 'business_license',
    ]
    contact = {}
    for f in fields:
        contact[f] = await config_manager.get(f) or ''
    return {'success': True, 'contact': contact}


@business_router.put('/admin/business-contact')
async def update_business_contact(data: BusinessContactUpdate):
    """Update business contact info from admin panel."""
    updated = []
    for field, value in data.dict(exclude_none=True).items():
        await config_manager.set(field, value)
        updated.append(field)

    config_manager.invalidate_cache()
    return {'success': True, 'updated': updated, 'message': f'{len(updated)} campos actualizados'}


# ═══════════════════════════════════════
# ADMIN — Email SMTP/IMAP Config
# ═══════════════════════════════════════

@business_router.get('/admin/email-config')
async def get_email_config():
    """Get email SMTP/IMAP configuration (passwords masked)."""
    fields = [
        'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_encryption',
        'imap_host', 'imap_port', 'imap_username', 'imap_password',
        'email_from_address', 'email_from_name',
    ]
    config = {}
    for f in fields:
        val = await config_manager.get(f) or ''
        # Mask passwords
        if 'password' in f and val and len(val) > 4:
            config[f] = '****' + val[-4:]
        else:
            config[f] = val

    # Status check
    smtp_ready = bool(config.get('smtp_host') and config.get('smtp_username') and config.get('smtp_password'))
    imap_ready = bool(config.get('imap_host') and config.get('imap_username') and config.get('imap_password'))

    return {
        'success': True,
        'config': config,
        'smtp_configured': smtp_ready,
        'imap_configured': imap_ready,
    }


@business_router.put('/admin/email-config')
async def update_email_config(data: EmailConfigUpdate):
    """Update SMTP/IMAP credentials from admin panel."""
    updated = []
    for field, value in data.dict(exclude_none=True).items():
        # Skip masked values
        if value and value.startswith('****'):
            continue
        await config_manager.set(field, value)
        updated.append(field)

    config_manager.invalidate_cache()
    return {'success': True, 'updated': updated, 'message': f'{len(updated)} configuraciones de email actualizadas'}


@business_router.post('/admin/email-config/test-smtp')
async def test_smtp_connection():
    """Test SMTP connection by sending a test email."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    host = await config_manager.get('smtp_host')
    port = int(await config_manager.get('smtp_port') or 465)
    username = await config_manager.get('smtp_username')
    password = await config_manager.get('smtp_password')
    encryption = await config_manager.get('smtp_encryption') or 'SSL'
    from_addr = await config_manager.get('email_from_address') or username
    from_name = await config_manager.get('email_from_name') or 'Ross Lending'

    if not host or not username or not password:
        return {'success': False, 'message': '❌ SMTP no configurado. Completa host, usuario y contraseña.'}

    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{from_name} <{from_addr}>"
        msg['To'] = from_addr
        msg['Subject'] = '✅ Test SMTP - Ross Lending Solutions'
        msg.attach(MIMEText(
            '<h2 style="color:#34D399;">✅ SMTP Configurado Correctamente</h2>'
            '<p>Si recibes este email, tu configuración SMTP funciona bien.</p>'
            '<p><strong>Ross Lending Solutions</strong></p>',
            'html', 'utf-8'
        ))

        if encryption.upper() == 'SSL':
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()

        server.login(username, password)
        server.send_message(msg)
        server.quit()

        return {'success': True, 'message': f'✅ Email de prueba enviado a {from_addr}'}
    except Exception as e:
        return {'success': False, 'message': f'❌ Error SMTP: {str(e)}'}


@business_router.post('/admin/email-config/test-imap')
async def test_imap_connection():
    """Test IMAP connection."""
    import imaplib

    host = await config_manager.get('imap_host')
    port = int(await config_manager.get('imap_port') or 993)
    username = await config_manager.get('imap_username')
    password = await config_manager.get('imap_password')

    if not host or not username or not password:
        return {'success': False, 'message': '❌ IMAP no configurado. Completa host, usuario y contraseña.'}

    try:
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(username, password)
        status, data = mail.select('INBOX', readonly=True)
        msg_count = int(data[0]) if status == 'OK' else 0
        mail.logout()
        return {'success': True, 'message': f'✅ IMAP conectado. {msg_count} emails en bandeja de entrada.'}
    except Exception as e:
        return {'success': False, 'message': f'❌ Error IMAP: {str(e)}'}
