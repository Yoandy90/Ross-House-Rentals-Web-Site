"""
Ross Lending Solutions — Notification Service
═══════════════════════════════════════════════
Independent notification module with Ross Lending branding.
Handles Email (SMTP SiteGround), SMS (Twilio), and Push (Expo) notifications.

Brand Colors:
  - Primary: #059669 (Emerald)
  - Primary Light: #34D399
  - Accent: #F59E0B (Amber/Gold)
  - Background: #0C1220 (Dark Navy)
  - Surface: #111827
  - Text: #F9FAFB
"""
import os
import ssl
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ═══ ROSS LENDING BRANDING ═══
BRAND = {
    'company_name': 'Ross Lending Solutions LLC',
    'company_short': 'Ross Lending',
    'phone': '(806) 934-2018',
    'phone_e164': '+18069342018',
    'email': 'info@rosslending.com',
    'address': '305 Bruce Ave, Dumas, TX 79029',
    'website': 'https://www.rosslending.com',
    'admin_email': 'yoandyross@gmail.com',
    # SMTP (SiteGround)
    'smtp_host': os.getenv('LENDING_SMTP_HOST', 'gtxm1026.siteground.biz'),
    'smtp_port': int(os.getenv('LENDING_SMTP_PORT', '465')),
    'smtp_user': os.getenv('LENDING_EMAIL', 'info@rosslending.com'),
    'smtp_password': os.getenv('LENDING_EMAIL_PASSWORD', ''),
    'from_email': os.getenv('LENDING_EMAIL', 'info@rosslending.com'),
    'from_name': 'Ross Lending Solutions',
    # Colors
    'color_bg': '#0C1220',
    'color_surface': '#111827',
    'color_primary': '#059669',
    'color_primary_light': '#34D399',
    'color_accent': '#F59E0B',
    'color_accent_light': '#FBBF24',
    'color_text': '#F9FAFB',
    'color_muted': '#9CA3AF',
    'color_border': '#1F2937',
    'color_success': '#10B981',
    'color_danger': '#EF4444',
    'color_warning': '#F59E0B',
    # Legal
    'license': 'OCCC regulated under Chapter 342, TX Finance Code',
}

# ═══ SPANISH MONTHS ═══
MESES = {1:'enero',2:'febrero',3:'marzo',4:'abril',5:'mayo',6:'junio',
          7:'julio',8:'agosto',9:'septiembre',10:'octubre',11:'noviembre',12:'diciembre'}


def _fecha_es(dt: datetime) -> str:
    return f"{dt.day} de {MESES.get(dt.month,'')} del {dt.year}"


def _email_wrapper(title_html: str, body_html: str, footer_extra: str = '') -> str:
    """Premium fintech-style email template with Ross Lending dark branding"""
    b = BRAND
    year = datetime.now().year
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #050810; color: #E5E7EB; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #050810; padding: 32px 16px;">
    <div style="max-width: 560px; margin: 0 auto;">

      <!-- LOGO -->
      <div style="text-align: center; padding: 28px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr><td style="background: linear-gradient(135deg, #059669, #34D399); padding: 14px 20px; border-radius: 14px;">
            <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 3px;">RLS</span>
          </td></tr>
        </table>
        <p style="margin: 12px 0 0; color: #F9FAFB; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">Ross Lending</p>
        <p style="margin: 2px 0 0; color: #059669; font-size: 10px; font-weight: 600; letter-spacing: 4px; text-transform: uppercase;">LENDING SOLUTIONS</p>
      </div>

      <!-- MAIN CARD -->
      <div style="background: linear-gradient(180deg, #0F1724 0%, #111827 100%); border: 1px solid #1F2937; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.4);">
        {title_html}
        <div style="padding: 32px 28px; color: #D1D5DB; line-height: 1.75; font-size: 15px;">
          {body_html}
        </div>
      </div>

      {footer_extra}

      <!-- DIVIDER -->
      <div style="border-top: 1px solid #1F2937; margin: 32px 0 24px;"></div>

      <!-- FOOTER -->
      <div style="text-align: center; padding: 0 16px;">
        <p style="margin: 0; color: #6B7280; font-size: 13px; font-weight: 500;">{b['company_name']}</p>
        <p style="margin: 6px 0 0; color: #4B5563; font-size: 12px;">{b['address']}</p>
        <p style="margin: 4px 0 0; color: #4B5563; font-size: 12px;">
          <a href="tel:{b['phone_e164']}" style="color: #059669; text-decoration: none;">{b['phone']}</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:{b['email']}" style="color: #059669; text-decoration: none;">{b['email']}</a>
        </p>
        <p style="margin: 4px 0 0;"><a href="{b['website']}" style="color: #34D399; text-decoration: none; font-size: 12px; font-weight: 500;">{b['website']}</a></p>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #111827;">
          <p style="margin: 0; color: #374151; font-size: 10px; line-height: 1.5;">{b['license']}<br>&copy; {year} {b['company_name']}. Todos los derechos reservados.</p>
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""


class LendingNotificationService:
    """Notification service with Ross Lending branding"""

    def __init__(self):
        # SMTP (SiteGround - Ross Lending's own email)
        self.smtp_host = BRAND['smtp_host']
        self.smtp_port = BRAND['smtp_port']
        self.smtp_user = BRAND['smtp_user']
        self.smtp_password = BRAND['smtp_password']
        self.from_email = BRAND['from_email']
        self.from_name = BRAND['from_name']

        # Twilio SMS
        self.twilio_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.twilio_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.twilio_phone = os.getenv('TWILIO_PHONE_NUMBER', '')
        self.twilio_client = None

        if self.twilio_sid and self.twilio_token:
            try:
                from twilio.rest import Client
                self.twilio_client = Client(self.twilio_sid, self.twilio_token)
                logger.info("✅ Lending Twilio client ready")
            except Exception as e:
                logger.error(f"Twilio init error: {e}")

        if self.smtp_user and self.smtp_password:
            logger.info(f"✅ Lending SMTP ready ({self.smtp_user} via {self.smtp_host}:{self.smtp_port})")
        else:
            logger.warning("⚠️ Lending SMTP not configured (missing LENDING_EMAIL or LENDING_EMAIL_PASSWORD)")

    # ─────────────────────────────────────────────────────────────
    # LOW-LEVEL SENDERS
    # ─────────────────────────────────────────────────────────────

    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email via SMTP (SiteGround - info@rosslending.com)"""
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP not configured (missing credentials)")
            return False
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Reply-To'] = self.from_email
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))

            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=15) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            logger.info(f"📧 Email sent → {to_email} (from {self.from_email})")
            return True
        except Exception as e:
            logger.error(f"SMTP email error: {e}")
            return False

    def _fmt_phone(self, phone: str) -> str:
        if not phone:
            return phone
        digits = ''.join(c for c in phone if c.isdigit())
        if len(digits) == 10:
            return f"+1{digits}"
        if len(digits) == 11 and digits.startswith('1'):
            return f"+{digits}"
        return f"+{digits}" if not phone.startswith('+') else phone

    async def send_sms(self, to_phone: str, message: str) -> bool:
        if not self.twilio_client:
            logger.warning("Twilio not configured")
            return False
        try:
            msg = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_phone,
                to=self._fmt_phone(to_phone),
            )
            logger.info(f"📱 SMS sent → {to_phone} (SID: {msg.sid})")
            return True
        except Exception as e:
            logger.error(f"SMS error: {e}")
            return False

    async def send_push(self, push_token: str, title: str, body: str, data: dict = None) -> bool:
        try:
            from push_notification_service import send_push_notification
            await send_push_notification(expo_push_token=push_token, title=title, body=body, data=data or {})
            return True
        except Exception as e:
            logger.error(f"Push error: {e}")
            return False

    # ─────────────────────────────────────────────────────────────
    # LOAN APPLICATION TEMPLATES
    # ─────────────────────────────────────────────────────────────

    async def notify_application_received_client(self, to_email: str, name: str, amount: str, loan_type: str, app_id: str) -> bool:
        title_html = """
        <div style="padding:28px 28px 0;">
          <div style="background: linear-gradient(135deg, rgba(5,150,105,0.15), rgba(52,211,153,0.08)); border: 1px solid #059669; border-radius: 12px; padding: 20px; text-align: center;">
            <p style="margin:0; font-size: 32px;">&#9989;</p>
            <h2 style="margin:10px 0 0; color: #34D399; font-size: 22px; font-weight: 700;">Solicitud Recibida</h2>
            <p style="margin:6px 0 0; color: #6B7280; font-size: 13px;">Tu solicitud ha sido enviada exitosamente</p>
          </div>
        </div>"""

        body_html = f"""
        <p style="color: #F9FAFB;">Hola <strong style="color: #34D399;">{name}</strong>,</p>
        <p>Hemos recibido tu solicitud de prestamo. Nuestro equipo la esta revisando y te contactaremos pronto.</p>

        <!-- Loan Details Card -->
        <div style="background: #0B1120; border: 1px solid #1F2937; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:6px 0; color:#6B7280; font-size:13px;">Referencia</td>
              <td style="padding:6px 0; text-align:right; color:#FBBF24; font-weight:700; font-family:monospace; font-size:15px;">{app_id}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:4px 0;"></td></tr>
            <tr>
              <td style="padding:10px 0 4px; color:#6B7280; font-size:13px;">Monto Solicitado</td>
              <td style="padding:10px 0 4px; text-align:right; color:#34D399; font-weight:800; font-size:28px;">${amount}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:4px 0;"></td></tr>
            <tr>
              <td style="padding:8px 0; color:#6B7280; font-size:13px;">Tipo de Prestamo</td>
              <td style="padding:8px 0; text-align:right; color:#E5E7EB; font-size:14px;">{loan_type}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #1F2937; padding:4px 0;"></td></tr>
            <tr>
              <td style="padding:8px 0; color:#6B7280; font-size:13px;">Fecha</td>
              <td style="padding:8px 0; text-align:right; color:#E5E7EB; font-size:14px;">{_fecha_es(datetime.utcnow())}</td>
            </tr>
          </table>
        </div>

        <!-- Steps -->
        <div style="background: #0B1120; border: 1px solid #1F2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin:0 0 14px; color:#F9FAFB; font-size:14px; font-weight:700;">Proximos Pasos</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">1</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Revisaremos tu informacion financiera</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">2</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Evaluaremos tu capacidad de pago</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">3</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Te contactaremos dentro de 24-48 horas</td>
              </tr></table>
            </td></tr>
          </table>
        </div>

        <!-- Warning -->
        <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 16px; margin: 16px 0;">
          <p style="margin:0; color:#FBBF24; font-size:13px; font-weight:600;">&#9888;&#65039; Importante</p>
          <p style="margin:6px 0 0; color:#D1D5DB; font-size:13px;">Ten a la mano documentos de identificacion y comprobantes de ingresos por si los necesitamos.</p>
        </div>

        <p style="color: #9CA3AF;">Gracias por confiar en nosotros.</p>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(to_email, f"Solicitud Recibida — {BRAND['company_short']} (Ref: {app_id})", html)

    async def notify_application_received_admin(self, name: str, amount: str, loan_type: str, phone: str, email: str, app_id: str) -> bool:
        b = BRAND
        title_html = f"""
        <div style="background-color:{b['color_accent']}; padding:16px 24px; text-align:center;">
          <h2 style="margin:0; color:{b['color_bg']}; font-size:18px;">📋 Nueva Solicitud de Préstamo</h2>
        </div>"""

        body_html = f"""
        <div style="background:{b['color_bg']}; border:1px solid {b['color_border']}; border-radius:8px; padding:20px; margin-bottom:16px;">
          <table style="width:100%; color:{b['color_text']}; font-size:14px;">
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Nombre</td><td style="font-weight:bold;">{name}</td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Monto</td><td style="font-weight:bold; color:{b['color_primary_light']}; font-size:20px;">${amount}</td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Tipo</td><td>{loan_type}</td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Teléfono</td><td><a href="tel:{phone}" style="color:{b['color_primary_light']};">{phone}</a></td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Email</td><td><a href="mailto:{email}" style="color:{b['color_primary_light']};">{email}</a></td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">ID</td><td style="color:{b['color_accent_light']};">{app_id}</td></tr>
            <tr><td style="padding:6px 0; color:{b['color_muted']};">Fecha</td><td>{datetime.utcnow().strftime('%d/%m/%Y %H:%M UTC')}</td></tr>
          </table>
        </div>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(BRAND['admin_email'], f"📋 Nueva Solicitud: {name} — ${amount} ({loan_type})", html)

    async def notify_loan_approved(self, to_email: str, name: str, amount: float, term: int, monthly: float, app_id: str) -> bool:
        title_html = """
        <div style="padding:28px 28px 0;">
          <div style="background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.08)); border: 1px solid #10B981; border-radius: 12px; padding: 24px; text-align: center;">
            <p style="margin:0; font-size: 36px;">&#127881;</p>
            <h2 style="margin:10px 0 0; color: #34D399; font-size: 24px; font-weight: 800;">Felicidades!</h2>
            <p style="margin:6px 0 0; color: #9CA3AF; font-size: 14px;">Tu prestamo ha sido aprobado</p>
          </div>
        </div>"""

        body_html = f"""
        <p style="color: #F9FAFB;">Hola <strong style="color: #34D399;">{name}</strong>,</p>
        <p style="font-size:16px;">Excelentes noticias! Tu solicitud de prestamo ha sido <strong style="color:#34D399;">APROBADA</strong>.</p>

        <!-- Amount Hero -->
        <div style="background: linear-gradient(135deg, #0B2818, #0F1724); border: 1px solid #059669; border-radius: 16px; padding: 32px 24px; margin: 24px 0; text-align: center;">
          <p style="margin:0; color:#6B7280; font-size:12px; text-transform:uppercase; letter-spacing:2px;">Monto Aprobado</p>
          <p style="margin:8px 0; color:#34D399; font-size:42px; font-weight:800; letter-spacing:-1px;">${amount:,.2f}</p>
          <div style="border-top:1px solid #1F2937; margin:20px 0; padding-top:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="text-align:center; width:50%;">
                  <p style="margin:0; color:#6B7280; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Plazo</p>
                  <p style="margin:6px 0 0; color:#F9FAFB; font-size:22px; font-weight:700;">{term} <span style="font-size:14px; color:#6B7280;">meses</span></p>
                </td>
                <td style="border-left:1px solid #1F2937; text-align:center; width:50%;">
                  <p style="margin:0; color:#6B7280; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Pago Mensual</p>
                  <p style="margin:6px 0 0; color:#FBBF24; font-size:22px; font-weight:700;">${monthly:,.2f}</p>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Steps -->
        <div style="background: #0B1120; border: 1px solid #1F2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin:0 0 14px; color:#F9FAFB; font-size:14px; font-weight:700;">Proximos Pasos</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">1</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Revisa los terminos y condiciones</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">2</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Firma los documentos del prestamo</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:8px 0; vertical-align:top;">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#059669; color:white; width:24px; height:24px; border-radius:50%; text-align:center; font-size:12px; font-weight:700; line-height:24px;">3</td>
                <td style="padding-left:12px; color:#9CA3AF; font-size:14px;">Recibiras los fondos en tu cuenta</td>
              </tr></table>
            </td></tr>
          </table>
        </div>

        <p style="color: #9CA3AF;">Nos contactaremos contigo pronto para completar el proceso. Gracias por confiar en <strong style="color:#F9FAFB;">Ross Lending</strong>!</p>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(to_email, f"Prestamo Aprobado! — {BRAND['company_short']}", html)

    async def notify_loan_rejected(self, to_email: str, name: str, app_id: str, reason: str = '') -> bool:
        b = BRAND
        title_html = f"""
        <div style="background-color:{b['color_bg']}; padding:20px 24px; text-align:center; border-bottom:1px solid {b['color_border']};">
          <h2 style="margin:0; color:{b['color_muted']}; font-size:18px;">Actualización de tu Solicitud</h2>
        </div>"""

        reason_block = ''
        if reason:
            reason_block = f"""
            <div style="background:rgba(239,68,68,0.1); border:1px solid {b['color_danger']}; border-radius:8px; padding:14px; margin:16px 0;">
              <p style="margin:0; color:{b['color_text']}; font-size:14px;"><strong>Razón:</strong> {reason}</p>
            </div>"""

        body_html = f"""
        <p>Hola <strong>{name}</strong>,</p>
        <p>Después de revisar cuidadosamente tu solicitud (ID: <strong style="color:{b['color_accent_light']};">{app_id}</strong>), lamentablemente no podemos aprobarla en este momento.</p>
        {reason_block}

        <div style="background:{b['color_bg']}; border:1px solid {b['color_border']}; border-radius:8px; padding:16px; margin:20px 0;">
          <h3 style="margin:0 0 10px; color:{b['color_primary_light']}; font-size:15px;">¿Qué puedes hacer?</h3>
          <ul style="margin:0; padding-left:20px; color:{b['color_muted']}; font-size:14px;">
            <li style="margin-bottom:6px;">Puedes volver a aplicar cuando tu situación financiera mejore</li>
            <li style="margin-bottom:6px;">Contáctanos para más información sobre los requisitos</li>
            <li>Considera mejorar tu historial crediticio antes de volver a solicitar</li>
          </ul>
        </div>

        <p>Apreciamos tu interés en nuestros servicios y esperamos poder ayudarte en el futuro.</p>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(to_email, f"Actualización de Solicitud — {BRAND['company_short']}", html)

    async def notify_payment_reminder(self, to_email: str, name: str, amount: float, due_date: datetime, loan_id: str) -> bool:
        b = BRAND
        title_html = f"""
        <div style="background-color:{b['color_accent']}; padding:16px 24px; text-align:center;">
          <h2 style="margin:0; color:{b['color_bg']}; font-size:18px;">⏰ Recordatorio de Pago</h2>
        </div>"""

        body_html = f"""
        <p>Hola <strong>{name}</strong>,</p>
        <p>Te recordamos que tu próximo pago se acerca:</p>

        <div style="background:{b['color_bg']}; border:1px solid {b['color_accent']}; border-radius:12px; padding:24px; margin:20px 0; text-align:center;">
          <p style="margin:0; color:{b['color_muted']}; font-size:13px;">Monto del Pago</p>
          <p style="margin:8px 0; color:{b['color_accent_light']}; font-size:32px; font-weight:bold;">${amount:,.2f}</p>
          <p style="margin:0; color:{b['color_muted']}; font-size:14px;">Fecha límite: <strong style="color:{b['color_text']};">{_fecha_es(due_date)}</strong></p>
        </div>

        <p>Si ya realizaste el pago, ignora este mensaje. Si tienes preguntas, contáctanos.</p>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(to_email, f"⏰ Recordatorio de Pago — {BRAND['company_short']}", html)

    async def notify_document_request(self, to_email: str, name: str, doc_name: str, due_date: Optional[datetime] = None) -> bool:
        b = BRAND
        title_html = f"""
        <div style="background-color:{b['color_bg']}; padding:20px 24px; text-align:center; border-bottom:1px solid {b['color_border']};">
          <h2 style="margin:0; color:{b['color_primary_light']}; font-size:18px;">📄 Documento Solicitado</h2>
        </div>"""

        due_block = ''
        if due_date:
            due_block = f"""
            <div style="background:rgba(245,158,11,0.1); border:1px solid {b['color_accent']}; border-radius:8px; padding:12px; margin:12px 0;">
              <p style="margin:0; color:{b['color_accent_light']}; font-size:13px;">⏰ Fecha límite: <strong>{_fecha_es(due_date)}</strong></p>
            </div>"""

        body_html = f"""
        <p>Hola <strong>{name}</strong>,</p>
        <p>Necesitamos que nos envíes el siguiente documento para continuar con tu trámite:</p>

        <div style="background:{b['color_bg']}; border:1px solid {b['color_primary']}; border-left:4px solid {b['color_primary']}; border-radius:8px; padding:18px; margin:16px 0;">
          <p style="margin:0; color:{b['color_primary_light']}; font-size:17px; font-weight:bold;">📋 {doc_name}</p>
        </div>
        {due_block}

        <div style="background:{b['color_bg']}; border:1px solid {b['color_border']}; border-radius:8px; padding:16px; margin:20px 0;">
          <h3 style="margin:0 0 10px; color:{b['color_primary_light']}; font-size:14px;">Cómo enviar</h3>
          <ol style="margin:0; padding-left:20px; color:{b['color_muted']}; font-size:14px;">
            <li>Abre la app de Ross Lending</li>
            <li>Ve a tu solicitud activa</li>
            <li>Sube una foto clara del documento</li>
          </ol>
        </div>

        <p>💡 <em style="color:{b['color_muted']};">Asegúrate de que el documento esté completo y legible.</em></p>
        """

        html = _email_wrapper(title_html, body_html)
        return await self.send_email(to_email, f"📄 Documento Solicitado — {BRAND['company_short']}", html)

    # ─────────────────────────────────────────────────────────────
    # SMS TEMPLATES
    # ─────────────────────────────────────────────────────────────

    async def sms_application_received_client(self, phone: str, name: str, amount: str, app_id: str) -> bool:
        return await self.send_sms(phone,
            f"✅ Hola {name}, tu solicitud de préstamo por ${amount} ha sido recibida (ID: {app_id}). "
            f"Te contactaremos pronto. — {BRAND['company_short']}")

    async def sms_application_received_admin(self, name: str, amount: str, loan_type: str, phone: str, app_id: str) -> bool:
        return await self.send_sms(BRAND['phone_e164'],
            f"📋 Nueva solicitud:\n{name}\n${amount} - {loan_type}\nTel: {phone}\nID: {app_id}")

    async def sms_loan_approved(self, phone: str, name: str, amount: float, monthly: float) -> bool:
        return await self.send_sms(phone,
            f"🎉 ¡Felicidades {name}! Tu préstamo por ${amount:,.0f} ha sido APROBADO. "
            f"Pago mensual: ${monthly:,.0f}. Te contactaremos para completar el proceso. — {BRAND['company_short']}")

    async def sms_loan_rejected(self, phone: str, name: str) -> bool:
        return await self.send_sms(phone,
            f"Ross Lending: Hola {name}, lamentablemente no pudimos aprobar tu solicitud en este momento. "
            f"Contáctanos para más info: {BRAND['phone']}")

    async def sms_payment_reminder(self, phone: str, name: str, amount: float, due_date: datetime) -> bool:
        return await self.send_sms(phone,
            f"⏰ {BRAND['company_short']}: Hola {name}, tu pago de ${amount:,.2f} "
            f"vence el {_fecha_es(due_date)}. ¿Preguntas? {BRAND['phone']}")

    async def sms_document_request(self, phone: str, name: str, doc_name: str) -> bool:
        return await self.send_sms(phone,
            f"📄 {BRAND['company_short']}: Hola {name}, necesitamos que subas: {doc_name}. "
            f"Entra a la app > Tu solicitud > Subir documento. ¡Gracias!")


# ═══ Singleton ═══
_instance: Optional[LendingNotificationService] = None

def get_lending_notifications() -> LendingNotificationService:
    global _instance
    if _instance is None:
        _instance = LendingNotificationService()
    return _instance


logger.info("✅ Ross Lending Notification Service loaded")
