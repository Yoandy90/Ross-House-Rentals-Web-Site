"""
Email Sender Helper - Fetches templates from DB and sends emails automatically.
Supports both SMTP and SendGrid API as transport.
Used by lending_routes.py and other modules to trigger emails on events.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional
from unified_config_manager import config_manager

logger = logging.getLogger(__name__)

_db = None


def init_email_sender(db):
    global _db
    _db = db


async def _send_via_sendgrid(to_email: str, subject: str, html: str, plain_text: str, from_name: str, from_addr: str) -> bool:
    """Send email using SendGrid API."""
    import httpx
    api_key = await config_manager.get('sendgrid_api_key')
    if not api_key:
        api_key = await config_manager.get('SENDGRID_API_KEY')
    if not api_key:
        return False

    if not from_addr:
        from_addr = await config_manager.get('sendgrid_from_email') or 'info@rosslending.com'
    if not from_name:
        from_name = await config_manager.get('sendgrid_from_name') or 'Ross Lending Solutions'

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_addr, "name": from_name},
        "subject": subject,
        "content": [],
    }
    if plain_text:
        payload["content"].append({"type": "text/plain", "value": plain_text})
    if html:
        payload["content"].append({"type": "text/html", "value": html})

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code in (200, 201, 202):
                logger.info(f"📧 SendGrid email sent to {to_email}")
                return True
            else:
                logger.error(f"SendGrid error {resp.status_code}: {resp.text[:200]}")
                return False
    except Exception as e:
        logger.error(f"SendGrid send failed: {e}")
        return False


async def send_template_email(template_key: str, to_email: str, variables: Dict[str, str]) -> bool:
    """
    Send an email using a stored template.
    
    Args:
        template_key: The template key (e.g., 'payment_confirmation', 'loan_approved')
        to_email: Recipient email address
        variables: Dictionary of {{variable}} replacements
    
    Returns:
        True if sent successfully, False otherwise
    """
    try:
        if _db is None:
            logger.error("Email sender: DB not initialized")
            return False

        # Get template from DB
        template = await _db.email_templates.find_one({'key': template_key, 'active': True})
        if not template:
            logger.warning(f"Email template '{template_key}' not found or inactive")
            return False

        # Get SMTP config
        host = await config_manager.get('smtp_host')
        port = int(await config_manager.get('smtp_port') or 465)
        username = await config_manager.get('smtp_username')
        password = await config_manager.get('smtp_password')
        encryption = await config_manager.get('smtp_encryption') or 'SSL'
        from_name = await config_manager.get('email_from_name') or 'Ross Lending Solutions'
        from_addr = await config_manager.get('email_from_address') or username

        if not host or not username or not password:
            logger.warning("SMTP not configured, skipping email send")
            return False

        # Replace variables in template
        html = template.get('html', '')
        subject = template.get('subject', '')
        plain_text = template.get('plain_text', '')

        for key, value in variables.items():
            placeholder = '{{' + key + '}}'
            html = html.replace(placeholder, str(value))
            subject = subject.replace(placeholder, str(value))
            plain_text = plain_text.replace(placeholder, str(value))

        # Build email message
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{from_name} <{from_addr}>"
        msg['To'] = to_email
        msg['Subject'] = subject

        if plain_text:
            msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
        if html:
            msg.attach(MIMEText(html, 'html', 'utf-8'))

        # Send via SMTP or SendGrid
        smtp_sent = False
        if host and username and password:
            try:
                if encryption.upper() == 'SSL':
                    server = smtplib.SMTP_SSL(host, port, timeout=15)
                else:
                    server = smtplib.SMTP(host, port, timeout=15)
                    server.starttls()

                server.login(username, password)
                server.send_message(msg)
                server.quit()
                smtp_sent = True
                logger.info(f"📧 SMTP email sent to {to_email}")
            except Exception as smtp_e:
                logger.warning(f"SMTP send failed: {smtp_e}, trying SendGrid...")

        if not smtp_sent:
            # Fallback to SendGrid API
            sg_sent = await _send_via_sendgrid(to_email, subject, html, plain_text, from_name, from_addr)
            if not sg_sent:
                logger.error(f"Both SMTP and SendGrid failed for {to_email}")
                return False

        # Log to email history
        from datetime import datetime, timezone
        await _db.email_history.insert_one({
            'type': 'automated',
            'template_key': template_key,
            'to': to_email,
            'subject': subject,
            'sent_at': datetime.now(timezone.utc),
        })

        logger.info(f"✅ Email sent: [{template_key}] → {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Email send failed [{template_key}] → {to_email}: {e}")
        return False


async def send_payment_confirmation(client_email: str, client_name: str, 
                                     amount: float, payment_number: int,
                                     loan_number: str, payment_method: str,
                                     new_balance: float):
    """Send payment confirmation email."""
    return await send_template_email('payment_confirmation', client_email, {
        'nombre': client_name,
        'monto': f'{amount:,.2f}',
        'numero_pago': str(payment_number),
        'loan_number': loan_number,
        'metodo_pago': payment_method,
        'nuevo_balance': f'{new_balance:,.2f}',
    })


async def send_loan_approved(client_email: str, client_name: str,
                              loan_number: str, amount: float,
                              monthly_payment: float, term_months: int):
    """Send loan approved email."""
    return await send_template_email('loan_approved', client_email, {
        'nombre': client_name,
        'loan_number': loan_number,
        'monto': f'{amount:,.2f}',
        'pago_mensual': f'{monthly_payment:,.2f}',
        'plazo': str(term_months),
        'app_url': 'https://rosslending.com',
    })


async def send_loan_denied(client_email: str, client_name: str):
    """Send loan denied email."""
    return await send_template_email('loan_denied', client_email, {
        'nombre': client_name,
    })


async def send_autopay_enabled(client_email: str, client_name: str,
                                loan_number: str, amount: float,
                                payment_method: str, next_charge: str):
    """Send autopay activated email."""
    return await send_template_email('autopay_enabled', client_email, {
        'nombre': client_name,
        'loan_number': loan_number,
        'monto': f'{amount:,.2f}',
        'metodo_pago': payment_method,
        'proximo_cobro': next_charge,
    })


async def send_loan_paid_off(client_email: str, client_name: str,
                              loan_number: str, total_paid: float):
    """Send loan fully paid off email."""
    return await send_template_email('loan_paid_off', client_email, {
        'nombre': client_name,
        'loan_number': loan_number,
        'total_pagado': f'{total_paid:,.2f}',
        'app_url': 'https://rosslending.com',
    })


async def send_payment_reminder(client_email: str, client_name: str,
                                 amount: float, loan_number: str,
                                 payment_number: int, due_date: str):
    """Send payment reminder email."""
    return await send_template_email('payment_reminder', client_email, {
        'nombre': client_name,
        'monto': f'{amount:,.2f}',
        'loan_number': loan_number,
        'numero_pago': str(payment_number),
        'fecha_vencimiento': due_date,
        'app_url': 'https://rosslending.com',
    })


async def send_payment_late(client_email: str, client_name: str,
                             amount: float, payment_number: int, due_date: str):
    """Send late payment notice."""
    return await send_template_email('payment_late', client_email, {
        'nombre': client_name,
        'monto': f'{amount:,.2f}',
        'numero_pago': str(payment_number),
        'fecha_vencimiento': due_date,
        'app_url': 'https://rosslending.com',
    })


async def send_welcome(client_email: str, client_name: str):
    """Send welcome email to new user."""
    return await send_template_email('welcome', client_email, {
        'nombre': client_name,
        'app_url': 'https://rosslending.com',
    })
