"""
Email Templates Module - Professional email templates for Ross Lending Solutions
Templates are stored in MongoDB and editable from the admin panel.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)
templates_router = APIRouter(prefix='/api')

_db = None


def init_templates_router(db):
    global _db
    _db = db


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html: Optional[str] = None
    plain_text: Optional[str] = None
    category: Optional[str] = None
    active: Optional[bool] = None


# ═══════════════════════════════════════
# BASE HTML WRAPPER
# ═══════════════════════════════════════

BRAND_COLORS = {
    'primary': '#059669',
    'primary_light': '#34D399',
    'dark_bg': '#0A0A0F',
    'card_bg': '#141419',
    'text': '#FFFFFF',
    'text_muted': '#9CA3AF',
    'accent': '#F59E0B',
    'border': '#1F2937',
}


def _wrap_html(content: str, preview_text: str = '') -> str:
    """Wrap email content in the branded base template."""
    return f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ross Lending Solutions</title>
<!--[if mso]><style>table,td,div,p{{font-family:Arial,sans-serif;}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#060910;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<span style="display:none;font-size:1px;color:#060910;max-height:0;overflow:hidden;">{preview_text}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#060910;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0F1117;border-radius:16px;border:1px solid #1F2937;overflow:hidden;">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#064E3B,#059669);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Ross Lending Solutions</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">Préstamos Personales · Dumas, TX</p>
</td></tr>
<!-- Content -->
<tr><td style="padding:40px;">
{content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 40px;background-color:#080A0F;border-top:1px solid #1F2937;text-align:center;">
<p style="margin:0 0 8px;color:#6B7280;font-size:11px;">Ross Lending Solutions LLC · 305 Bruce Ave, Dumas, TX 79029</p>
<p style="margin:0 0 8px;color:#6B7280;font-size:11px;">(806) 934-2018 · info@rosslending.com</p>
<p style="margin:0;color:#4B5563;font-size:10px;">OCCC Licensed · Texas Chapter 342 Regulated Lender</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>'''


# ═══════════════════════════════════════
# DEFAULT TEMPLATES
# ═══════════════════════════════════════

DEFAULT_TEMPLATES = [
    {
        'key': 'welcome',
        'name': 'Bienvenida',
        'category': 'cuenta',
        'subject': '¡Bienvenido a Ross Lending Solutions!',
        'plain_text': 'Hola {{nombre}}, bienvenido a Ross Lending Solutions. Tu cuenta ha sido creada exitosamente.',
        'html': _wrap_html('''
<h2 style="margin:0 0 16px;color:#FFFFFF;font-size:24px;font-weight:700;">¡Bienvenido, {{nombre}}!</h2>
<p style="margin:0 0 24px;color:#D1D5DB;font-size:15px;line-height:1.6;">Tu cuenta en <strong style="color:#34D399;">Ross Lending Solutions</strong> ha sido creada exitosamente. Estamos aquí para ayudarte con soluciones financieras personalizadas.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #1F2937;">
<tr><td style="padding:20px;">
<p style="margin:0 0 8px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Lo que puedes hacer:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;color:#D1D5DB;font-size:14px;">✅ Solicitar préstamos personales</td></tr>
<tr><td style="padding:8px 0;color:#D1D5DB;font-size:14px;">✅ Ver tu calendario de pagos</td></tr>
<tr><td style="padding:8px 0;color:#D1D5DB;font-size:14px;">✅ Activar pagos automáticos</td></tr>
<tr><td style="padding:8px 0;color:#D1D5DB;font-size:14px;">✅ Descargar contratos y facturas</td></tr>
</table>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:linear-gradient(135deg,#059669,#34D399);border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Abrir Mi Cuenta →</a>
</td></tr>
</table>
<p style="margin:0;color:#6B7280;font-size:12px;">Si tienes preguntas, responde a este email o llámanos al (806) 934-2018.</p>
''', 'Bienvenido a Ross Lending Solutions'),
        'variables': ['nombre', 'app_url'],
        'active': True,
    },
    {
        'key': 'loan_approved',
        'name': 'Préstamo Aprobado',
        'category': 'prestamos',
        'subject': '✅ Tu préstamo ha sido aprobado - {{loan_number}}',
        'plain_text': 'Felicidades {{nombre}}, tu préstamo {{loan_number}} por ${{monto}} ha sido aprobado.',
        'html': _wrap_html('''
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#059669,#34D399);border-radius:50%;line-height:64px;font-size:28px;">✅</div>
</div>
<h2 style="margin:0 0 8px;color:#FFFFFF;font-size:24px;font-weight:700;text-align:center;">¡Préstamo Aprobado!</h2>
<p style="margin:0 0 24px;color:#9CA3AF;font-size:14px;text-align:center;">Felicidades, {{nombre}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #1F2937;">
<tr><td style="padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Préstamo</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;font-weight:600;">{{loan_number}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Monto Aprobado</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#34D399;font-size:18px;font-weight:800;">${{monto}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Pago Mensual</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;font-weight:600;">${{pago_mensual}}</span></td></tr>
<tr><td style="padding:10px 0;"><span style="color:#9CA3AF;font-size:13px;">Plazo</span></td><td style="padding:10px 0;text-align:right;"><span style="color:#FFFFFF;font-size:14px;font-weight:600;">{{plazo}} meses</span></td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 16px;color:#D1D5DB;font-size:14px;line-height:1.6;">Tu próximo paso es firmar el contrato y elegir tu método de pago. Puedes hacerlo directamente desde la app.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;" align="center">
<tr><td style="background:linear-gradient(135deg,#059669,#34D399);border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Firmar Contrato →</a>
</td></tr>
</table>
''', 'Tu préstamo ha sido aprobado'),
        'variables': ['nombre', 'loan_number', 'monto', 'pago_mensual', 'plazo', 'app_url'],
        'active': True,
    },
    {
        'key': 'loan_denied',
        'name': 'Préstamo Denegado',
        'category': 'prestamos',
        'subject': 'Actualización sobre tu solicitud de préstamo',
        'plain_text': 'Hola {{nombre}}, lamentamos informarte que tu solicitud no fue aprobada en este momento.',
        'html': _wrap_html('''
<h2 style="margin:0 0 16px;color:#FFFFFF;font-size:22px;font-weight:700;">Hola, {{nombre}}</h2>
<p style="margin:0 0 16px;color:#D1D5DB;font-size:15px;line-height:1.6;">Después de revisar tu solicitud, lamentamos informarte que no fue posible aprobar tu préstamo en este momento.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#1C1917;border-radius:12px;border:1px solid #292524;">
<tr><td style="padding:20px;">
<p style="margin:0 0 12px;color:#FBBF24;font-size:13px;font-weight:600;">¿Qué puedes hacer?</p>
<p style="margin:0 0 8px;color:#D1D5DB;font-size:14px;">• Esperar 30 días y volver a solicitar</p>
<p style="margin:0 0 8px;color:#D1D5DB;font-size:14px;">• Contactarnos para explorar alternativas</p>
<p style="margin:0;color:#D1D5DB;font-size:14px;">• Mejorar tu historial crediticio</p>
</td></tr>
</table>
<p style="margin:0;color:#9CA3AF;font-size:13px;">Si tienes preguntas, no dudes en llamarnos al (806) 934-2018. Estamos aquí para ayudarte.</p>
''', 'Actualización sobre tu solicitud'),
        'variables': ['nombre'],
        'active': True,
    },
    {
        'key': 'payment_reminder',
        'name': 'Recordatorio de Pago',
        'category': 'pagos',
        'subject': '⏰ Recordatorio: Tu pago vence el {{fecha_vencimiento}}',
        'plain_text': 'Hola {{nombre}}, te recordamos que tu pago #{{numero_pago}} de ${{monto}} vence el {{fecha_vencimiento}}.',
        'html': _wrap_html('''
<h2 style="margin:0 0 16px;color:#FFFFFF;font-size:22px;font-weight:700;">Recordatorio de Pago</h2>
<p style="margin:0 0 24px;color:#D1D5DB;font-size:15px;">Hola {{nombre}}, tu próximo pago está por vencer.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #374151;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0 0 4px;color:#9CA3AF;font-size:12px;text-transform:uppercase;">Monto a Pagar</p>
<p style="margin:0 0 16px;color:#FFFFFF;font-size:36px;font-weight:800;">${{monto}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Préstamo</span></td><td style="text-align:right;padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#FFFFFF;font-size:13px;">{{loan_number}}</span></td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Pago #</span></td><td style="text-align:right;padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#FFFFFF;font-size:13px;">{{numero_pago}}</span></td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#F59E0B;font-size:13px;font-weight:600;">Fecha Límite</span></td><td style="text-align:right;padding:8px 0;border-top:1px solid #1F2937;"><span style="color:#F59E0B;font-size:13px;font-weight:600;">{{fecha_vencimiento}}</span></td></tr>
</table>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;" align="center">
<tr><td style="background:linear-gradient(135deg,#059669,#34D399);border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Pagar Ahora →</a>
</td></tr>
</table>
<p style="margin:16px 0 0;color:#6B7280;font-size:12px;text-align:center;">💡 Activa AutoPay para nunca preocuparte por fechas de pago.</p>
''', 'Tu pago vence pronto'),
        'variables': ['nombre', 'monto', 'loan_number', 'numero_pago', 'fecha_vencimiento', 'app_url'],
        'active': True,
    },
    {
        'key': 'payment_confirmation',
        'name': 'Confirmación de Pago',
        'category': 'pagos',
        'subject': '✅ Pago recibido - ${{monto}} - {{loan_number}}',
        'plain_text': 'Hola {{nombre}}, confirmamos tu pago #{{numero_pago}} de ${{monto}}. Nuevo balance: ${{nuevo_balance}}.',
        'html': _wrap_html('''
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#059669,#34D399);border-radius:50%;line-height:64px;font-size:28px;">✓</div>
</div>
<h2 style="margin:0 0 8px;color:#FFFFFF;font-size:24px;font-weight:700;text-align:center;">Pago Confirmado</h2>
<p style="margin:0 0 24px;color:#9CA3AF;font-size:14px;text-align:center;">Gracias, {{nombre}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #1F2937;">
<tr><td style="padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Monto Pagado</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#34D399;font-size:18px;font-weight:800;">${{monto}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Pago #</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;">{{numero_pago}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Préstamo</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;">{{loan_number}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Método</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;">{{metodo_pago}}</span></td></tr>
<tr><td style="padding:10px 0;"><span style="color:#9CA3AF;font-size:13px;">Nuevo Balance</span></td><td style="padding:10px 0;text-align:right;"><span style="color:#FFFFFF;font-size:16px;font-weight:700;">${{nuevo_balance}}</span></td></tr>
</table>
</td></tr>
</table>
<p style="margin:0;color:#6B7280;font-size:12px;text-align:center;">Este recibo se generó automáticamente. Guárdalo para tus registros.</p>
''', 'Pago confirmado'),
        'variables': ['nombre', 'monto', 'numero_pago', 'loan_number', 'metodo_pago', 'nuevo_balance'],
        'active': True,
    },
    {
        'key': 'payment_late',
        'name': 'Pago Atrasado',
        'category': 'pagos',
        'subject': '⚠️ Pago atrasado - Acción requerida - {{loan_number}}',
        'plain_text': 'Hola {{nombre}}, tu pago #{{numero_pago}} de ${{monto}} está vencido desde el {{fecha_vencimiento}}. Por favor realiza tu pago lo antes posible.',
        'html': _wrap_html('''
<div style="background-color:#451A03;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #92400E;">
<p style="margin:0;color:#FBBF24;font-size:14px;font-weight:600;">⚠️ Tienes un pago pendiente</p>
</div>
<h2 style="margin:0 0 16px;color:#FFFFFF;font-size:22px;font-weight:700;">Hola, {{nombre}}</h2>
<p style="margin:0 0 24px;color:#D1D5DB;font-size:15px;line-height:1.6;">Tu pago mensual está atrasado. Te pedimos que lo realices lo antes posible para evitar cargos adicionales.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #374151;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0 0 4px;color:#EF4444;font-size:12px;text-transform:uppercase;font-weight:600;">Monto Vencido</p>
<p style="margin:0 0 16px;color:#EF4444;font-size:32px;font-weight:800;">${{monto}}</p>
<p style="margin:0;color:#9CA3AF;font-size:13px;">Venció: {{fecha_vencimiento}} · Pago #{{numero_pago}}</p>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;" align="center">
<tr><td style="background:linear-gradient(135deg,#DC2626,#EF4444);border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Pagar Ahora →</a>
</td></tr>
</table>
<p style="margin:16px 0 0;color:#6B7280;font-size:12px;">Si ya realizaste el pago, por favor ignora este mensaje. Los pagos pueden tardar 1-2 días hábiles en procesarse.</p>
''', 'Pago atrasado - acción requerida'),
        'variables': ['nombre', 'monto', 'numero_pago', 'fecha_vencimiento', 'app_url'],
        'active': True,
    },
    {
        'key': 'autopay_enabled',
        'name': 'AutoPay Activado',
        'category': 'pagos',
        'subject': '🔄 AutoPay activado para {{loan_number}}',
        'plain_text': 'Hola {{nombre}}, AutoPay fue activado. Se cobrará ${{monto}} automáticamente cada mes.',
        'html': _wrap_html('''
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;width:64px;height:64px;background:linear-gradient(135deg,#059669,#34D399);border-radius:50%;line-height:64px;font-size:28px;">🔄</div>
</div>
<h2 style="margin:0 0 8px;color:#FFFFFF;font-size:24px;font-weight:700;text-align:center;">AutoPay Activado</h2>
<p style="margin:0 0 24px;color:#9CA3AF;font-size:14px;text-align:center;">Tu pago se realizará automáticamente cada mes</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #1F2937;">
<tr><td style="padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Préstamo</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;">{{loan_number}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Monto Mensual</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#34D399;font-size:16px;font-weight:700;">${{monto}}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;"><span style="color:#9CA3AF;font-size:13px;">Método</span></td><td style="padding:10px 0;border-bottom:1px solid #1F2937;text-align:right;"><span style="color:#FFFFFF;font-size:14px;">{{metodo_pago}}</span></td></tr>
<tr><td style="padding:10px 0;"><span style="color:#9CA3AF;font-size:13px;">Próximo Cobro</span></td><td style="padding:10px 0;text-align:right;"><span style="color:#F59E0B;font-size:14px;font-weight:600;">{{proximo_cobro}}</span></td></tr>
</table>
</td></tr>
</table>
<p style="margin:0;color:#6B7280;font-size:12px;text-align:center;">Puedes cancelar AutoPay en cualquier momento desde la app.</p>
''', 'AutoPay activado exitosamente'),
        'variables': ['nombre', 'loan_number', 'monto', 'metodo_pago', 'proximo_cobro'],
        'active': True,
    },
    {
        'key': 'loan_paid_off',
        'name': 'Préstamo Liquidado',
        'category': 'prestamos',
        'subject': '🎉 ¡Felicidades! Tu préstamo {{loan_number}} está completamente pagado',
        'plain_text': 'Felicidades {{nombre}}, tu préstamo {{loan_number}} ha sido liquidado en su totalidad.',
        'html': _wrap_html('''
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;width:80px;height:80px;background:linear-gradient(135deg,#059669,#34D399);border-radius:50%;line-height:80px;font-size:36px;">🎉</div>
</div>
<h2 style="margin:0 0 8px;color:#34D399;font-size:28px;font-weight:800;text-align:center;">¡Préstamo Liquidado!</h2>
<p style="margin:0 0 24px;color:#D1D5DB;font-size:16px;text-align:center;">Felicidades, {{nombre}}. Has completado todos los pagos.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:linear-gradient(135deg,#064E3B,#059669);border-radius:12px;">
<tr><td style="padding:24px;text-align:center;">
<p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;">PRÉSTAMO</p>
<p style="margin:0 0 8px;color:#FFFFFF;font-size:18px;font-weight:700;">{{loan_number}}</p>
<p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;">TOTAL PAGADO</p>
<p style="margin:0;color:#FFFFFF;font-size:28px;font-weight:800;">${{total_pagado}}</p>
</td></tr>
</table>
<p style="margin:0 0 16px;color:#D1D5DB;font-size:14px;line-height:1.6;text-align:center;">Gracias por tu confianza. Si necesitas financiamiento en el futuro, estaremos aquí para ayudarte.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;" align="center">
<tr><td style="background-color:#1F2937;border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#34D399;font-size:15px;font-weight:700;text-decoration:none;">Ver Mi Historial →</a>
</td></tr>
</table>
''', 'Felicidades - Préstamo completamente pagado'),
        'variables': ['nombre', 'loan_number', 'total_pagado', 'app_url'],
        'active': True,
    },
    {
        'key': 'monthly_statement',
        'name': 'Estado de Cuenta Mensual',
        'category': 'pagos',
        'subject': '📊 Tu estado de cuenta - {{mes}} {{anio}}',
        'plain_text': 'Hola {{nombre}}, aquí está tu estado de cuenta del mes de {{mes}} {{anio}}. Balance: ${{balance}}.',
        'html': _wrap_html('''
<h2 style="margin:0 0 8px;color:#FFFFFF;font-size:22px;font-weight:700;">Estado de Cuenta</h2>
<p style="margin:0 0 24px;color:#9CA3AF;font-size:14px;">{{mes}} {{anio}} · {{nombre}}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr>
<td style="width:50%;padding:16px;background-color:#141419;border-radius:12px 0 0 12px;border:1px solid #1F2937;text-align:center;">
<p style="margin:0 0 4px;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Balance Actual</p>
<p style="margin:0;color:#FFFFFF;font-size:22px;font-weight:800;">${{balance}}</p>
</td>
<td style="width:50%;padding:16px;background-color:#141419;border-radius:0 12px 12px 0;border:1px solid #1F2937;border-left:0;text-align:center;">
<p style="margin:0 0 4px;color:#9CA3AF;font-size:11px;text-transform:uppercase;">Próximo Pago</p>
<p style="margin:0;color:#F59E0B;font-size:22px;font-weight:800;">${{proximo_pago}}</p>
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background-color:#141419;border-radius:12px;border:1px solid #1F2937;">
<tr><td style="padding:20px;">
<p style="margin:0 0 12px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Resumen del Mes</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;border-bottom:1px solid #1F2937;"><span style="color:#D1D5DB;font-size:14px;">Pagos Realizados</span></td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #1F2937;"><span style="color:#34D399;font-size:14px;font-weight:600;">{{pagos_mes}}</span></td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #1F2937;"><span style="color:#D1D5DB;font-size:14px;">Total Pagado</span></td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #1F2937;"><span style="color:#34D399;font-size:14px;font-weight:600;">${{total_mes}}</span></td></tr>
<tr><td style="padding:8px 0;"><span style="color:#D1D5DB;font-size:14px;">Fecha Próximo Pago</span></td><td style="text-align:right;padding:8px 0;"><span style="color:#F59E0B;font-size:14px;font-weight:600;">{{fecha_proximo}}</span></td></tr>
</table>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;" align="center">
<tr><td style="background:linear-gradient(135deg,#059669,#34D399);border-radius:10px;padding:14px 32px;">
<a href="{{app_url}}" style="color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Ver Detalles Completos →</a>
</td></tr>
</table>
''', 'Tu estado de cuenta mensual'),
        'variables': ['nombre', 'mes', 'anio', 'balance', 'proximo_pago', 'pagos_mes', 'total_mes', 'fecha_proximo', 'app_url'],
        'active': True,
    },
    {
        'key': 'password_reset',
        'name': 'Restablecer Contraseña',
        'category': 'cuenta',
        'subject': 'Restablecer tu contraseña - Ross Lending',
        'plain_text': 'Hola {{nombre}}, usa este código para restablecer tu contraseña: {{codigo}}. Válido por 15 minutos.',
        'html': _wrap_html('''
<h2 style="margin:0 0 16px;color:#FFFFFF;font-size:22px;font-weight:700;">Restablecer Contraseña</h2>
<p style="margin:0 0 24px;color:#D1D5DB;font-size:15px;line-height:1.6;">Hola {{nombre}}, recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:#141419;border-radius:12px;border:2px dashed #374151;padding:24px;text-align:center;">
<p style="margin:0 0 8px;color:#9CA3AF;font-size:12px;">Tu código de verificación:</p>
<p style="margin:0;color:#34D399;font-size:36px;font-weight:800;letter-spacing:8px;">{{codigo}}</p>
<p style="margin:12px 0 0;color:#6B7280;font-size:11px;">Válido por 15 minutos</p>
</td></tr>
</table>
<p style="margin:0;color:#6B7280;font-size:12px;">Si no solicitaste este cambio, puedes ignorar este email. Tu contraseña no será modificada.</p>
''', 'Código para restablecer contraseña'),
        'variables': ['nombre', 'codigo'],
        'active': True,
    },
]


# ═══════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════

@templates_router.get('/admin/email-templates')
async def list_templates():
    """List all email templates."""
    if _db is None:
        return {'success': True, 'templates': DEFAULT_TEMPLATES}

    templates = await _db.email_templates.find().sort('category', 1).to_list(100)
    if not templates:
        # Seed defaults
        seed_templates = []
        for tmpl in DEFAULT_TEMPLATES:
            t = dict(tmpl)
            t['created_at'] = datetime.now(timezone.utc)
            t['updated_at'] = datetime.now(timezone.utc)
            seed_templates.append(t)
        await _db.email_templates.insert_many(seed_templates)
        templates = await _db.email_templates.find().sort('category', 1).to_list(100)

    for t in templates:
        t['_id'] = str(t['_id'])
        if 'created_at' in t and hasattr(t['created_at'], 'isoformat'):
            t['created_at'] = t['created_at'].isoformat()
        if 'updated_at' in t and hasattr(t['updated_at'], 'isoformat'):
            t['updated_at'] = t['updated_at'].isoformat()

    return {'success': True, 'templates': templates}


@templates_router.get('/admin/email-templates/{template_id}')
async def get_template(template_id: str):
    """Get a single template by ID."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    tmpl = await _db.email_templates.find_one({'_id': ObjectId(template_id)})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    tmpl['_id'] = str(tmpl['_id'])
    return {'success': True, 'template': tmpl}


@templates_router.put('/admin/email-templates/{template_id}')
async def update_template(template_id: str, data: TemplateUpdate):
    """Update a template."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    update = {k: v for k, v in data.dict(exclude_none=True).items()}
    update['updated_at'] = datetime.now(timezone.utc)

    result = await _db.email_templates.update_one(
        {'_id': ObjectId(template_id)},
        {'$set': update}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    return {'success': True, 'message': 'Plantilla actualizada'}


@templates_router.post('/admin/email-templates/{template_id}/preview')
async def preview_template(template_id: str):
    """Generate a preview of the template with sample data."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    tmpl = await _db.email_templates.find_one({'_id': ObjectId(template_id)})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    # Sample data for preview
    sample_data = {
        'nombre': 'Juan Pérez',
        'loan_number': 'RL-2025-001',
        'monto': '1,500.00',
        'pago_mensual': '262.50',
        'plazo': '6',
        'fecha_vencimiento': '15 de Marzo, 2025',
        'numero_pago': '3',
        'metodo_pago': 'Chase Bank ••••4567',
        'nuevo_balance': '787.50',
        'total_pagado': '3,960.00',
        'mes': 'Febrero',
        'anio': '2025',
        'balance': '1,575.00',
        'proximo_pago': '262.50',
        'pagos_mes': '1',
        'total_mes': '262.50',
        'fecha_proximo': '15 Mar 2025',
        'proximo_cobro': '15 Mar 2025',
        'codigo': '847291',
        'app_url': 'https://rosslending.com',
    }

    html = tmpl.get('html', '')
    subject = tmpl.get('subject', '')
    for key, value in sample_data.items():
        html = html.replace('{{' + key + '}}', value)
        subject = subject.replace('{{' + key + '}}', value)

    return {'success': True, 'html': html, 'subject': subject}


@templates_router.post('/admin/email-templates/{template_id}/send-test')
async def send_test_template(template_id: str):
    """Send a test email using this template to the admin."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    from unified_config_manager import config_manager
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    tmpl = await _db.email_templates.find_one({'_id': ObjectId(template_id)})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    # Get SMTP config
    host = await config_manager.get('smtp_host')
    port = int(await config_manager.get('smtp_port') or 465)
    username = await config_manager.get('smtp_username')
    password = await config_manager.get('smtp_password')
    from_name = await config_manager.get('email_from_name') or 'Ross Lending'

    if not host or not password:
        raise HTTPException(status_code=400, detail="SMTP no configurado")

    # Fill with sample data
    sample_data = {
        'nombre': 'Admin (Test)', 'loan_number': 'RL-TEST-001',
        'monto': '500.00', 'pago_mensual': '125.00', 'plazo': '4',
        'fecha_vencimiento': '20 Feb 2025', 'numero_pago': '2',
        'metodo_pago': 'Chase ••••4567', 'nuevo_balance': '250.00',
        'total_pagado': '2,000.00', 'mes': 'Febrero', 'anio': '2025',
        'balance': '750.00', 'proximo_pago': '125.00', 'pagos_mes': '1',
        'total_mes': '125.00', 'fecha_proximo': '20 Mar 2025',
        'proximo_cobro': '20 Mar 2025', 'codigo': '123456',
        'app_url': 'https://rosslending.com',
    }

    html = tmpl.get('html', '')
    subject = f"[TEST] {tmpl.get('subject', 'Test')}"
    for key, value in sample_data.items():
        html = html.replace('{{' + key + '}}', value)
        subject = subject.replace('{{' + key + '}}', value)

    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{from_name} <{username}>"
        msg['To'] = username
        msg['Subject'] = subject
        msg.attach(MIMEText(html, 'html', 'utf-8'))

        server = smtplib.SMTP_SSL(host, port, timeout=15)
        server.login(username, password)
        server.send_message(msg)
        server.quit()

        return {'success': True, 'message': f'Email de prueba enviado a {username}'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error: {str(e)}')


@templates_router.post('/admin/email-templates/reset-defaults')
async def reset_to_defaults():
    """Reset all templates to their default values."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB not available")

    await _db.email_templates.delete_many({})
    for tmpl in DEFAULT_TEMPLATES:
        tmpl['created_at'] = datetime.now(timezone.utc)
        tmpl['updated_at'] = datetime.now(timezone.utc)
    await _db.email_templates.insert_many(DEFAULT_TEMPLATES)

    return {'success': True, 'message': f'{len(DEFAULT_TEMPLATES)} plantillas restauradas'}
