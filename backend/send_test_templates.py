"""
Populate email templates in MongoDB and send test emails for all 10 templates
"""
import asyncio
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
SMTP_HOST = 'gtxm1026.siteground.biz'
SMTP_PORT = 465
SMTP_USER = 'info@rosslending.com'
SMTP_PASS = 'Interface.123'
TO_EMAIL = 'yoandyross@gmail.com'

# ═══ Base HTML Template Structure ═══
BASE_STYLE = """<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f7fa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
"""

FOOTER = """
<tr><td style="padding:24px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
<p style="color:#64748b;font-size:12px;margin:0;">Ross Lending Solutions LLC</p>
<p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">305 Bruce Ave, Dumas TX 79029 · (806) 934-2018</p>
<p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">info@rosslending.com · rosslending.com</p>
</td></tr>
</table>
</td></tr></table>
</body></html>
"""

def make_header(title, subtitle):
    return f"""<tr><td style="background:linear-gradient(135deg,#065F46 0%,#10B981 100%);padding:30px;text-align:center;">
<div style="background:rgba(255,255,255,0.2);width:56px;height:56px;border-radius:12px;display:inline-block;line-height:56px;margin-bottom:12px;">
<span style="color:#ffffff;font-size:22px;font-weight:bold;">RLS</span>
</div>
<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">{title}</h1>
<p style="color:#d1fae5;margin:4px 0 0;font-size:14px;">{subtitle}</p>
</td></tr>"""

def make_template(title, subtitle, body_html):
    return BASE_STYLE + make_header(title, subtitle) + f'<tr><td style="padding:30px;">{body_html}</td></tr>' + FOOTER


# ═══ 10 Professional Email Templates ═══
templates = [
    {
        "template_id": "welcome",
        "subject": "¡Bienvenido a Ross Lending Solutions!",
        "html_body": make_template(
            "¡Bienvenido!", "Gracias por unirte a Ross Lending Solutions",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">¡Bienvenido a Ross Lending Solutions! Tu cuenta ha sido creada exitosamente.</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;">
                <p style="color:#166534;margin:0 0 8px;font-weight:600;">✅ Lo que puedes hacer ahora:</p>
                <ul style="color:#15803d;margin:0;padding-left:20px;line-height:2;">
                    <li>Solicitar un préstamo personal ($200 - $1,000)</li>
                    <li>Ver el estado de tus préstamos</li>
                    <li>Hacer pagos desde tu celular o la web</li>
                    <li>Configurar AutoPay para pagos automáticos</li>
                </ul>
            </div>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://rosslending.com" style="background:#10B981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Acceder a Mi Cuenta</a>
            </div>
            <p style="color:#64748b;font-size:13px;">Si tienes preguntas, no dudes en contactarnos al (806) 934-2018.</p>"""
        ),
    },
    {
        "template_id": "loan_approved",
        "subject": "✅ Tu préstamo ha sido aprobado - PREST-2026-001",
        "html_body": make_template(
            "¡Préstamo Aprobado!", "Buenas noticias sobre tu solicitud",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">¡Felicidades! Tu solicitud de préstamo ha sido <span style="color:#059669;font-weight:700;">APROBADA</span>.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
                <table width="100%" cellspacing="0" cellpadding="8">
                    <tr><td style="color:#64748b;font-size:13px;">No. Préstamo</td><td style="color:#1e293b;font-weight:700;text-align:right;">PREST-2026-001</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;border-top:1px solid #f1f5f9;">Monto Aprobado</td><td style="color:#059669;font-weight:700;font-size:18px;text-align:right;border-top:1px solid #f1f5f9;">$750.00</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;border-top:1px solid #f1f5f9;">Cuota Mensual</td><td style="color:#1e293b;font-weight:700;text-align:right;border-top:1px solid #f1f5f9;">$900.00</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;border-top:1px solid #f1f5f9;">Plazo</td><td style="color:#1e293b;font-weight:600;text-align:right;border-top:1px solid #f1f5f9;">1 mes</td></tr>
                </table>
            </div>
            <p style="color:#475569;font-size:14px;line-height:1.6;"><b>Próximos pasos:</b> Pasa por nuestra oficina para firmar el contrato y recibir tu dinero.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://rosslending.com" style="background:#10B981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Ver Mi Préstamo</a>
            </div>"""
        ),
    },
    {
        "template_id": "loan_denied",
        "subject": "Actualización sobre tu solicitud de préstamo",
        "html_body": make_template(
            "Actualización de Solicitud", "Información sobre tu solicitud de préstamo",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Lamentamos informarte que tu solicitud de préstamo no ha sido aprobada en esta ocasión.</p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
                <p style="color:#991b1b;margin:0;font-weight:600;">Esto puede deberse a:</p>
                <ul style="color:#7f1d1d;margin:8px 0 0;padding-left:20px;line-height:2;font-size:14px;">
                    <li>Historial crediticio insuficiente</li>
                    <li>Capacidad de pago no verificable</li>
                    <li>Documentación incompleta</li>
                </ul>
            </div>
            <p style="color:#475569;font-size:14px;line-height:1.6;">Puedes volver a aplicar en 30 días. Si crees que hay un error, llámanos al (806) 934-2018.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="tel:8069342018" style="background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Llamar a la Oficina</a>
            </div>"""
        ),
    },
    {
        "template_id": "payment_reminder",
        "subject": "⏰ Recordatorio: Tu pago vence el 15 de Febrero",
        "html_body": make_template(
            "Recordatorio de Pago", "Tu próximo pago se acerca",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Te recordamos que tu próximo pago está por vencer:</p>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
                <p style="color:#92400e;font-size:13px;margin:0;">FECHA DE VENCIMIENTO</p>
                <p style="color:#78350f;font-size:24px;font-weight:700;margin:8px 0;">15 de Febrero, 2026</p>
                <p style="color:#92400e;font-size:13px;margin:0;">MONTO A PAGAR</p>
                <p style="color:#78350f;font-size:28px;font-weight:700;margin:8px 0;">$600.00</p>
                <p style="color:#a16207;font-size:12px;margin:0;">Préstamo: PREST-2026-001</p>
            </div>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://rosslending.com/mis-prestamos" style="background:#f59e0b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Pagar Ahora</a>
            </div>
            <p style="color:#64748b;font-size:13px;">💡 Tip: Activa AutoPay para que tus pagos se hagan automáticamente.</p>"""
        ),
    },
    {
        "template_id": "payment_confirmation",
        "subject": "✅ Pago recibido - $600.00 - PREST-2026-001",
        "html_body": make_template(
            "¡Pago Recibido!", "Tu pago ha sido procesado exitosamente",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Hemos recibido tu pago correctamente. ¡Gracias!</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
                <p style="color:#166534;font-size:13px;margin:0;font-weight:600;">PAGO CONFIRMADO ✅</p>
                <p style="color:#14532d;font-size:32px;font-weight:700;margin:8px 0;">$600.00</p>
                <table width="100%" cellspacing="0" cellpadding="6" style="margin-top:16px;">
                    <tr><td style="color:#166534;font-size:13px;text-align:left;">Préstamo:</td><td style="color:#14532d;font-weight:600;text-align:right;">PREST-2026-001</td></tr>
                    <tr><td style="color:#166534;font-size:13px;text-align:left;">Pago #:</td><td style="color:#14532d;font-weight:600;text-align:right;">3 de 4</td></tr>
                    <tr><td style="color:#166534;font-size:13px;text-align:left;">Método:</td><td style="color:#14532d;font-weight:600;text-align:right;">Portal Web</td></tr>
                    <tr><td style="color:#166534;font-size:13px;text-align:left;border-top:1px solid #86efac;padding-top:10px;">Nuevo Saldo:</td><td style="color:#14532d;font-weight:700;font-size:16px;text-align:right;border-top:1px solid #86efac;padding-top:10px;">$200.00</td></tr>
                </table>
            </div>
            <p style="color:#64748b;font-size:13px;text-align:center;">Guarda este email como comprobante de pago.</p>"""
        ),
    },
    {
        "template_id": "payment_overdue",
        "subject": "⚠️ Pago atrasado - Acción requerida - PREST-2026-001",
        "html_body": make_template(
            "Pago Atrasado", "Requiere tu atención inmediata",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Te notificamos que tu pago del préstamo <b>PREST-2026-001</b> está atrasado.</p>
            <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
                <p style="color:#991b1b;font-size:14px;margin:0;font-weight:600;">⚠️ PAGO VENCIDO</p>
                <p style="color:#7f1d1d;font-size:28px;font-weight:700;margin:8px 0;">$600.00</p>
                <p style="color:#991b1b;font-size:13px;margin:0;">Días de atraso: 7 días</p>
            </div>
            <p style="color:#dc2626;font-size:14px;font-weight:600;">⚡ Evita cargos adicionales realizando tu pago hoy.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://rosslending.com/mis-prestamos" style="background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Pagar Ahora</a>
            </div>
            <p style="color:#64748b;font-size:13px;">Si ya realizaste el pago, ignora este mensaje. Para arreglos de pago, llámanos al (806) 934-2018.</p>"""
        ),
    },
    {
        "template_id": "autopay_enabled",
        "subject": "🔄 AutoPay activado para PREST-2026-001",
        "html_body": make_template(
            "AutoPay Activado", "Tus pagos ahora son automáticos",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Has activado exitosamente el pago automático (AutoPay) para tu préstamo.</p>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin:20px 0;">
                <p style="color:#1e40af;margin:0 0 12px;font-weight:600;">🔄 Configuración de AutoPay:</p>
                <table width="100%" cellspacing="0" cellpadding="8">
                    <tr><td style="color:#3b82f6;font-size:13px;">Préstamo:</td><td style="color:#1e3a5f;font-weight:600;text-align:right;">PREST-2026-001</td></tr>
                    <tr><td style="color:#3b82f6;font-size:13px;border-top:1px solid #dbeafe;">Monto:</td><td style="color:#1e3a5f;font-weight:700;text-align:right;border-top:1px solid #dbeafe;">$600.00</td></tr>
                    <tr><td style="color:#3b82f6;font-size:13px;border-top:1px solid #dbeafe;">Método:</td><td style="color:#1e3a5f;font-weight:600;text-align:right;border-top:1px solid #dbeafe;">Chase ****4521</td></tr>
                    <tr><td style="color:#3b82f6;font-size:13px;border-top:1px solid #dbeafe;">Próximo cargo:</td><td style="color:#1e3a5f;font-weight:600;text-align:right;border-top:1px solid #dbeafe;">15 Feb 2026</td></tr>
                </table>
            </div>
            <p style="color:#059669;font-size:14px;font-weight:500;">✅ No te preocupes por recordar las fechas. Nosotros nos encargamos.</p>
            <p style="color:#64748b;font-size:13px;">Puedes desactivar AutoPay en cualquier momento desde tu cuenta.</p>"""
        ),
    },
    {
        "template_id": "loan_paid_off",
        "subject": "🎉 ¡Felicidades! Tu préstamo PREST-2026-001 está completamente pagado",
        "html_body": make_template(
            "🎉 ¡Préstamo Pagado!", "Felicidades por completar tu préstamo",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:16px;line-height:1.6;"><b>¡FELICIDADES!</b> Has pagado completamente tu préstamo. 🎊</p>
            <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:16px;padding:30px;margin:20px 0;text-align:center;">
                <p style="font-size:48px;margin:0;">🏆</p>
                <p style="color:#166534;font-size:20px;font-weight:700;margin:12px 0;">PRÉSTAMO LIQUIDADO</p>
                <p style="color:#15803d;font-size:14px;margin:0;">PREST-2026-001</p>
                <p style="color:#166534;font-size:13px;margin:12px 0 0;">Total pagado: <b>$2,400.00</b></p>
            </div>
            <p style="color:#475569;font-size:14px;line-height:1.6;">Gracias por tu compromiso y puntualidad. Si necesitas otro préstamo en el futuro, estamos aquí para ayudarte.</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://rosslending.com/mis-prestamos" style="background:#10B981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">Solicitar Nuevo Préstamo</a>
            </div>"""
        ),
    },
    {
        "template_id": "monthly_statement",
        "subject": "📊 Tu estado de cuenta - Febrero 2026",
        "html_body": make_template(
            "Estado de Cuenta", "Resumen mensual de tu préstamo",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Aquí está tu estado de cuenta del mes de <b>Febrero 2026</b>:</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
                <table width="100%" cellspacing="0" cellpadding="10">
                    <tr style="background:#f1f5f9;"><td style="color:#475569;font-size:13px;font-weight:600;" colspan="2">PRÉSTAMO PREST-2026-001</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;">Saldo anterior:</td><td style="color:#1e293b;font-weight:600;text-align:right;">$800.00</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;border-top:1px solid #f1f5f9;">Pagos realizados:</td><td style="color:#059669;font-weight:600;text-align:right;border-top:1px solid #f1f5f9;">- $600.00</td></tr>
                    <tr><td style="color:#64748b;font-size:13px;border-top:1px solid #f1f5f9;">Intereses:</td><td style="color:#dc2626;font-weight:600;text-align:right;border-top:1px solid #f1f5f9;">+ $0.00</td></tr>
                    <tr style="background:#f0fdf4;"><td style="color:#166534;font-size:14px;font-weight:700;border-top:2px solid #86efac;">SALDO ACTUAL:</td><td style="color:#166534;font-weight:700;font-size:18px;text-align:right;border-top:2px solid #86efac;">$200.00</td></tr>
                </table>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;">
                <p style="color:#92400e;font-size:13px;margin:0;">📅 Próximo pago: <b>$600.00</b> el <b>15 de Marzo, 2026</b></p>
            </div>"""
        ),
    },
    {
        "template_id": "password_reset",
        "subject": "Restablecer tu contraseña - Ross Lending",
        "html_body": make_template(
            "Restablecer Contraseña", "Solicitud de cambio de contraseña",
            """<p style="color:#334155;font-size:16px;line-height:1.6;">Hola <b>Yoandy Ross</b>,</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            <div style="text-align:center;margin:30px 0;">
                <a href="https://rosslending.com/reset-password?token=abc123" style="background:#6366f1;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Restablecer Contraseña</a>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="color:#64748b;font-size:13px;margin:0;">⏰ Este enlace expira en 1 hora.</p>
                <p style="color:#64748b;font-size:13px;margin:8px 0 0;">🔒 Si no solicitaste este cambio, ignora este email. Tu contraseña actual seguirá siendo la misma.</p>
            </div>"""
        ),
    },
]


async def populate_templates():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.taxportal
    await db.email_templates.delete_many({})
    for t in templates:
        await db.email_templates.insert_one(t)
    print(f"✅ {len(templates)} plantillas guardadas en MongoDB")
    client.close()


def send_all_templates():
    """Send all 10 templates as test emails"""
    print(f"\n📧 Enviando {len(templates)} emails a {TO_EMAIL}...")
    
    server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
    server.login(SMTP_USER, SMTP_PASS)
    print("✅ Conectado a SMTP\n")
    
    for i, t in enumerate(templates, 1):
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"[{i}/10] {t['subject']}"
        msg['From'] = f'Ross Lending Solutions <{SMTP_USER}>'
        msg['To'] = TO_EMAIL
        msg.attach(MIMEText(t['html_body'], 'html'))
        
        server.sendmail(SMTP_USER, TO_EMAIL, msg.as_string())
        print(f"  ✅ [{i}/10] Enviado: {t['subject'][:50]}...")
    
    server.quit()
    print(f"\n🎉 ¡Los 10 emails fueron enviados exitosamente!")


if __name__ == '__main__':
    asyncio.run(populate_templates())
    send_all_templates()
