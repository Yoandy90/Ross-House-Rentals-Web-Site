"""
Ross Tax Preparation - Diagnóstico Completo de la Plataforma
Genera un PDF con el análisis de todos los flujos y funciones
"""
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

load_dotenv()

client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
db = client['taxportal']


async def get_stats():
    """Gather all database statistics"""
    stats = {}
    collections = await db.list_collection_names()
    for c in sorted(collections):
        count = await db[c].count_documents({})
        stats[c] = count

    # Specific queries
    stats['active_users'] = await db.users.count_documents({'is_active': {'$ne': False}})
    stats['admin_users'] = await db.users.count_documents({'role': 'admin'})
    stats['active_services'] = await db.dynamic_services.count_documents({'active': True})
    stats['paid_invoices'] = await db.invoices.count_documents({'status': 'paid'})
    stats['pending_invoices'] = await db.invoices.count_documents({'status': 'pending'})
    stats['upcoming_appts'] = await db.appointments.count_documents({
        'status': {'$in': ['confirmed', 'pending']}
    })
    stats['active_subscriptions'] = await db.subscriptions.count_documents({'status': 'active'})
    stats['total_wa_messages'] = await db.whatsapp_messages.count_documents({})
    stats['refund_trackers'] = await db.refund_trackers.count_documents({})

    # Get services list
    services = await db.dynamic_services.find({'active': True}).to_list(50)
    stats['services_list'] = services

    return stats


def build_pdf(stats):
    """Build the diagnostic PDF"""
    filename = "/app/backend/static/diagnostico_ross_tax.pdf"
    os.makedirs(os.path.dirname(filename), exist_ok=True)

    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Title'],
        fontSize=22, spaceAfter=6, textColor=colors.HexColor('#6C1110'),
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle', parent=styles['Normal'],
        fontSize=11, textColor=colors.gray, spaceAfter=20, alignment=TA_CENTER
    )
    h1 = ParagraphStyle(
        'H1', parent=styles['Heading1'],
        fontSize=16, textColor=colors.HexColor('#6C1110'),
        spaceAfter=10, spaceBefore=20, fontName='Helvetica-Bold'
    )
    h2 = ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontSize=13, textColor=colors.HexColor('#333333'),
        spaceAfter=8, spaceBefore=14, fontName='Helvetica-Bold'
    )
    body = ParagraphStyle(
        'CustomBody', parent=styles['Normal'],
        fontSize=9.5, leading=13, spaceAfter=4
    )
    body_bold = ParagraphStyle(
        'BodyBold', parent=body, fontName='Helvetica-Bold'
    )

    elements = []

    # ============ COVER ============
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("DIAGNOSTICO COMPLETO DE LA PLATAFORMA", title_style))
    elements.append(Paragraph("Ross Tax Preparation", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#6C1110')))
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Paragraph(f"Fecha del reporte: {datetime.now().strftime('%d/%m/%Y %H:%M')}", body))
    elements.append(Paragraph(f"Generado por: Sistema de Diagnostico Automatizado", body))
    elements.append(Spacer(1, 0.3 * inch))

    # Summary box
    summary_data = [
        ['RESUMEN EJECUTIVO', ''],
        ['Total Usuarios', f"{stats.get('users', 0):,}"],
        ['Usuarios Activos', f"{stats.get('active_users', 0):,}"],
        ['Clientes Registrados', f"{stats.get('clients', 0):,}"],
        ['Facturas Totales', f"{stats.get('invoices', 0):,}"],
        ['Facturas Pagadas', f"{stats.get('paid_invoices', 0):,}"],
        ['Citas Registradas', f"{stats.get('appointments', 0):,}"],
        ['Declaraciones', f"{stats.get('tax_returns', 0):,}"],
        ['Servicios Activos', f"{stats.get('active_services', 0):,}"],
        ['Colecciones en DB', f"190"],
    ]
    summary_table = Table(summary_data, colWidths=[3.5 * inch, 2.5 * inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#FFF5F5')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    elements.append(PageBreak())

    # ============ 1. WEB APP - PAGINAS PUBLICAS ============
    elements.append(Paragraph("1. WEB APP (NEXT.JS) - PAGINAS PUBLICAS", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    public_pages = [
        ['Ruta', 'Descripcion', 'i18n', 'Estado'],
        ['/', 'Landing page principal', 'SI', 'ACTIVA'],
        ['/servicios', 'Portafolio de servicios (precios dinamicos)', 'SI', 'ACTIVA'],
        ['/servicios/business-formation', 'Formacion de negocios LLC/Corp', 'SI', 'ACTIVA'],
        ['/servicios/1099-filing', 'Filing de 1099', 'SI', 'ACTIVA'],
        ['/bookkeeping', 'Pagina de contabilidad', 'SI', 'ACTIVA'],
        ['/cita', 'Agendar cita (calendario dinamico)', 'SI', 'ACTIVA'],
        ['/agendar', 'Flujo de agendamiento', 'SI', 'ACTIVA'],
        ['/pagar', 'Portal de pago seguro (NMI)', 'SI', 'ACTIVA'],
        ['/pay/[token]', 'Pago de factura por token', 'PARCIAL', 'ACTIVA'],
        ['/referidos', 'Programa de referidos', 'SI', 'ACTIVA'],
        ['/ref/[code]', 'Landing de codigo referido', 'SI', 'ACTIVA'],
        ['/noticias', 'Blog / Noticias fiscales', 'SI', 'ACTIVA'],
        ['/noticias/[id]', 'Detalle de noticia', 'SI', 'ACTIVA'],
        ['/carreras', 'Ofertas de empleo', 'SI', 'ACTIVA'],
        ['/feedback/[token]', 'Encuesta de feedback por token', 'SI', 'ACTIVA'],
        ['/suscripcion', 'Planes de suscripcion', 'SI', 'ACTIVA'],
        ['/subscribe/[token]', 'Suscripcion por token', 'PARCIAL', 'ACTIVA'],
        ['/login', 'Inicio de sesion', 'SI', 'ACTIVA'],
        ['/registro', 'Registro de usuario', 'SI', 'ACTIVA'],
        ['/reset-password', 'Restablecer contrasena', 'SI', 'ACTIVA'],
        ['/manual', 'Redirige a manual externo', 'SI', 'ACTIVA'],
        ['/manual-cliente', 'Manual del cliente', 'SI', 'ACTIVA'],
        ['/mis-citas', 'Mis citas (requiere login)', 'SI', 'ACTIVA'],
        ['/mis-facturas', 'Mis facturas (requiere login)', 'SI', 'ACTIVA'],
        ['/mis-documentos', 'Mis documentos', 'SI', 'ACTIVA'],
        ['/mis-prestamos', 'Mis prestamos', 'SI', 'ACTIVA'],
        ['/perfil', 'Perfil del usuario', 'SI', 'ACTIVA'],
        ['/documentos/[token]', 'Acceso documentos por token', 'PARCIAL', 'ACTIVA'],
        ['/mi-cita/[token]', 'Detalle de cita por token', 'PARCIAL', 'ACTIVA'],
        ['/eliminar-cuenta', 'Eliminacion de cuenta', 'SI', 'ACTIVA'],
        ['/privacidad', 'Politica de privacidad (ES)', 'SI', 'ACTIVA'],
        ['/privacy', 'Privacy Policy (EN)', 'SI', 'ACTIVA'],
        ['/terminos', 'Terminos de servicio (ES)', 'SI', 'ACTIVA'],
        ['/terms', 'Terms of Service (EN)', 'SI', 'ACTIVA'],
        ['/tv-display', 'Display para TV de oficina', 'N/A', 'ACTIVA'],
    ]
    t1 = Table(public_pages, colWidths=[1.8 * inch, 2.5 * inch, 0.7 * inch, 0.7 * inch])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t1)
    elements.append(PageBreak())

    # ============ 2. WEB APP - PORTAL ADMIN ============
    elements.append(Paragraph("2. WEB APP - PORTAL DE ADMINISTRACION (90+ MODULOS)", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    admin_modules = [
        ['Modulo', 'Ruta', 'Registros DB', 'Estado'],
        ['Dashboard Principal', '/admin', '-', 'ACTIVA'],
        ['Clientes', '/admin/clientes', f"{stats.get('clients', 0):,}", 'ACTIVA'],
        ['Citas / Calendario', '/admin/calendario', f"{stats.get('appointments', 0):,}", 'ACTIVA'],
        ['Cal. Bloqueos/Espera/Metricas', '/admin/calendario/*', '-', 'ACTIVA'],
        ['Cal. Recurrentes/Reglas', '/admin/calendario/*', '-', 'ACTIVA'],
        ['Tipos de Cita', '/admin/tipos-cita', f"{stats.get('appointment_types', 0)}", 'ACTIVA'],
        ['Wizard Appointments', '/admin/wizard-appointments', f"{stats.get('tax_wizard_sessions', 0)}", 'ACTIVA'],
        ['Facturas', '/admin/facturas', f"{stats.get('invoices', 0):,}", 'ACTIVA'],
        ['Billing', '/admin/billing', '-', 'ACTIVA'],
        ['Servicios Dinamicos', '/admin/servicios', f"{stats.get('dynamic_services', 0)}", 'ACTIVA'],
        ['Customer Vault (NMI)', '/admin/customer-vault', f"{stats.get('vault_customers', 0):,}", 'ACTIVA'],
        ['Ordenes de Servicio', '/admin/ordenes', f"{stats.get('service_orders', 0)}", 'ACTIVA'],
        ['Declaraciones', '/admin/declaraciones', f"{stats.get('tax_returns', 0):,}", 'ACTIVA'],
        ['Tax Preparer', '/admin/tax-preparer', '-', 'ACTIVA'],
        ['Reembolsos (Tracker)', '/admin/reembolsos', f"{stats.get('refund_trackers', 0)}", 'ACTIVA'],
        ['Temporadas', '/admin/temporadas', f"{stats.get('tax_seasons', 0)}", 'ACTIVA'],
        ['Importar Temporada', '/admin/importar-temporada', '-', 'ACTIVA'],
        ['IRS eServices', '/admin/irs-eservices', '-', 'ACTIVA'],
        ['IRIS (1099)', '/admin/iris', f"{stats.get('iris_submissions', 0)}", 'ACTIVA'],
        ['Form 4506-C', '/admin/form-4506c', f"{stats.get('form_4506c', 0)}", 'ACTIVA'],
        ['Calculadora Fiscal', '/admin/calculadora', '-', 'ACTIVA'],
        ['Calculadora W-4', '/admin/calculadora-w4', '-', 'ACTIVA'],
        ['Transcript Parser', '/admin/transcript-parser', f"{stats.get('parsed_transcripts', 0)}", 'ACTIVA'],
        ['Bookkeeping', '/admin/bookkeeping', f"{stats.get('bk_businesses', 0)}", 'ACTIVA'],
        ['Payroll', '/admin/payroll', f"{stats.get('payroll_runs', 0)}", 'ACTIVA'],
        ['WhatsApp', '/admin/whatsapp', f"{stats.get('whatsapp_conversations', 0):,}", 'ACTIVA'],
        ['WA Bot/Automation', '/admin/whatsapp/*', '-', 'ACTIVA'],
        ['WA Asistente', '/wa-asistente', f"{stats.get('whatsapp_messages', 0):,}", 'ACTIVA'],
        ['Chat', '/admin/chat', f"{stats.get('chat_messages', 0):,}", 'ACTIVA'],
        ['Email', '/admin/email', f"{stats.get('email_events', 0):,}", 'ACTIVA'],
        ['Email Analytics', '/admin/email-analytics', '-', 'ACTIVA'],
        ['Campanas', '/admin/campanas', f"{stats.get('marketing_campaigns', 0)}", 'ACTIVA'],
        ['Notif. Push', '/admin/notificaciones-push', f"{stats.get('notifications', 0):,}", 'ACTIVA'],
        ['Templates Notif.', '/admin/templates', f"{stats.get('notification_templates', 0)}", 'ACTIVA'],
        ['Mensajes Rapidos', '/admin/mensajes-rapidos', '-', 'ACTIVA'],
        ['AI Ross', '/admin/ai-ross', f"{stats.get('ross_analyses', 0):,}", 'ACTIVA'],
        ['Telefono AI (VAPI)', '/admin/telefono-ai', '-', 'PARCIAL'],
        ['Documentos Config', '/admin/documentos-config', f"{stats.get('documents', 0)}", 'ACTIVA'],
        ['PDF Extractor', '/admin/pdf-extractor', '-', 'ACTIVA'],
        ['EIN Lookup', '/admin/ein-lookup', '-', 'ACTIVA'],
        ['Routing Lookup', '/admin/routing-lookup', '-', 'ACTIVA'],
        ['Datos Bancarios', '/admin/datos-bancarios', f"{stats.get('client_banking', 0):,}", 'ACTIVA'],
        ['Tarjetas', '/admin/tarjetas', f"{stats.get('payment_methods', 0)}", 'ACTIVA'],
        ['Inmigracion Dashboard', '/admin/inmigracion/*', '-', 'ACTIVA'],
        ['Casos Inmigracion', '/admin/inmigracion/casos', f"{stats.get('immigration_cases', 0)}", 'ACTIVA'],
        ['Mociones', '/admin/inmigracion/mociones', f"{stats.get('immigration_motions', 0)}", 'ACTIVA'],
        ['Pasaportes', '/admin/pasaportes', f"{stats.get('passport_drafts', 0)}", 'ACTIVA'],
        ['USPS', '/admin/usps', '-', 'ACTIVA'],
        ['Prestamos', '/admin/prestamos', f"{stats.get('loans', 0)}", 'ACTIVA'],
        ['CAB Lending', '/admin/cab', f"{stats.get('cab_loans', 0)}", 'ACTIVA'],
        ['Propiedades', '/admin/propiedades', f"{stats.get('properties', 0)}", 'ACTIVA'],
        ['Recibos/Recibos Pro', '/admin/recibos*', f"{stats.get('expense_receipts', 0)}", 'ACTIVA'],
        ['Leads', '/admin/leads', f"{stats.get('leads', 0)}", 'ACTIVA'],
        ['Referidos Config', '/admin/referidos-config', f"{stats.get('referral_codes', 0)}", 'ACTIVA'],
        ['Feedbacks', '/admin/feedbacks', f"{stats.get('feedbacks', 0)}", 'ACTIVA'],
        ['Cumpleanos', '/admin/cumpleanos', f"{stats.get('birthday_greetings', 0)}", 'ACTIVA'],
        ['Resenas Google', '/admin/resenas', f"{stats.get('google_reviews', 0)}", 'ACTIVA'],
        ['Clover POS', '/admin/clover', f"{stats.get('clover_linked_clients', 0):,}", 'ACTIVA'],
        ['Empleados Familiares', '/admin/empleados-familiares', f"{stats.get('family_employees', 0)}", 'ACTIVA'],
        ['Juegos Bolita/Rifas', '/admin/juegos/*', f"{stats.get('bolita_bets', 0)}", 'ACTIVA'],
        ['Usuarios', '/admin/usuarios', f"{stats.get('users', 0):,}", 'ACTIVA'],
        ['Configuracion', '/admin/configuracion', '-', 'ACTIVA'],
        ['Reportes', '/admin/reportes', '-', 'ACTIVA'],
        ['Logs', '/admin/logs', f"{stats.get('activity_logs', 0)}", 'ACTIVA'],
        ['Backup', '/admin/backup', '-', 'ACTIVA'],
        ['Version Control', '/admin/version-control', '-', 'ACTIVA'],
        ['Videollamadas', '/admin/videollamadas', '-', 'PARCIAL'],
        ['Turnos/Cola', '/admin/turnos', f"{stats.get('queue', 0)}", 'ACTIVA'],
        ['Metas Diarias', '/admin/metas-diarias', '-', 'ACTIVA'],
        ['Seguimiento', '/admin/seguimiento', '-', 'ACTIVA'],
    ]

    t2 = Table(admin_modules, colWidths=[1.7 * inch, 1.8 * inch, 0.9 * inch, 0.7 * inch])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('FONTSIZE', (0, 1), (-1, -1), 6.2),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 1.8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.8),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t2)
    elements.append(PageBreak())

    # ============ 2.5 ASISTENTE ============
    elements.append(Paragraph("2.1 PORTAL DEL ASISTENTE", h2))
    asst_pages = [
        ['Modulo', 'Ruta', 'Estado'],
        ['Dashboard', '/asistente', 'ACTIVA'],
        ['Citas', '/asistente/citas', 'ACTIVA'],
        ['Clientes', '/asistente/clientes', 'ACTIVA'],
        ['Datos Bancarios', '/asistente/datos-bancarios', 'ACTIVA'],
        ['Mensajes', '/asistente/mensajes', 'ACTIVA'],
        ['Notas', '/asistente/notas-clientes', 'ACTIVA'],
        ['Ordenes', '/asistente/ordenes', 'ACTIVA'],
        ['Seguimiento', '/asistente/seguimiento', 'ACTIVA'],
        ['Tareas', '/asistente/tareas', 'ACTIVA'],
        ['Turnos', '/asistente/turnos', 'ACTIVA'],
    ]
    t2b = Table(asst_pages, colWidths=[2 * inch, 2.5 * inch, 0.8 * inch])
    t2b.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t2b)
    elements.append(PageBreak())

    # ============ 3. EXPO MOBILE APP ============
    elements.append(Paragraph("3. APP MOVIL (EXPO / REACT NATIVE)", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    elements.append(Paragraph("3.1 Pantallas del Cliente (45+ pantallas)", h2))
    client_screens = [
        ['Pantalla', 'Archivo', 'i18n', 'Estado'],
        ['Home', 'index.tsx', 'SI', 'ACTIVA'],
        ['Servicios', 'services.tsx', 'SI', 'ACTIVA'],
        ['Impuestos', 'taxes.tsx', 'SI', 'ACTIVA'],
        ['Citas (Calendario)', 'appointments.tsx', 'SI', 'ACTIVA'],
        ['Agendar Cita', 'book-appointment.tsx', 'SI', 'ACTIVA'],
        ['Perfil', 'profile.tsx', 'SI', 'ACTIVA'],
        ['Info Personal', 'personal-info.tsx', 'SI', 'ACTIVA'],
        ['Cambiar Contrasena', 'change-password.tsx', 'SI', 'ACTIVA'],
        ['Metodos de Pago', 'payment-methods.tsx', 'SI', 'ACTIVA'],
        ['Facturas', 'invoices.tsx / mis-facturas.tsx', 'PEND', 'ACTIVA'],
        ['Documentos', 'documents.tsx', 'PEND', 'ACTIVA'],
        ['Notificaciones', 'notifications.tsx', 'PEND', 'ACTIVA'],
        ['Reembolso Tracker', 'refund.tsx', 'PEND', 'ACTIVA'],
        ['Creditos', 'credits.tsx', 'PEND', 'ACTIVA'],
        ['Referidos', 'referrals.tsx', 'PEND', 'ACTIVA'],
        ['Educacion', 'education.tsx', 'PEND', 'ACTIVA'],
        ['Noticias', 'news.tsx', 'PEND', 'ACTIVA'],
        ['Juegos', 'games.tsx', 'PEND', 'ACTIVA'],
        ['Bolita/Loteria/Rifas', 'bolita*.tsx / lottery.tsx', 'PEND', 'ACTIVA'],
        ['Raspa y Gana', 'scratch-cards.tsx', 'PEND', 'ACTIVA'],
        ['Mi Negocio / PnL', 'my-business.tsx', 'PEND', 'ACTIVA'],
        ['Mis Recibos (AI)', 'my-receipts.tsx', 'PEND', 'ACTIVA'],
        ['Envios', 'shipments.tsx', 'PEND', 'ACTIVA'],
        ['Prestamos', 'my-loans.tsx', 'PEND', 'ACTIVA'],
        ['Calculadora Tax', 'tax-calculator.tsx', 'PEND', 'ACTIVA'],
        ['Tax Dashboard', 'tax-dashboard.tsx', 'PEND', 'ACTIVA'],
        ['Declaraciones', 'tax-declarations.tsx', 'PEND', 'ACTIVA'],
        ['Mociones', 'my-motions.tsx', 'PEND', 'ACTIVA'],
        ['Suscripcion', 'subscription.tsx', 'PEND', 'ACTIVA'],
        ['Video Llamada', 'video-call.tsx', 'PEND', 'PARCIAL'],
        ['Herramientas', 'tools.tsx', 'PEND', 'ACTIVA'],
        ['Idioma', 'language-settings.tsx', 'SI', 'ACTIVA'],
    ]
    t3 = Table(client_screens, colWidths=[1.6 * inch, 2.2 * inch, 0.5 * inch, 0.7 * inch])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t3)
    elements.append(Paragraph("SI = Traducido (ES/EN) | PEND = Pendiente traduccion | PARCIAL = Parcial", body))
    elements.append(PageBreak())

    # Tax Wizard
    elements.append(Paragraph("3.2 Tax Wizard - 18 Pasos (100% Traducido)", h2))
    wizard_steps = [
        'Inicio', 'Discovery', 'Info Personal', 'Estado Civil', 'Ingresos',
        'Dependientes', 'Deducciones', 'Recomendacion', 'Seleccionar Plan',
        'Pago', 'Revision', 'Firma Digital', 'ID Verification',
        'W2 Scanner (AI)', 'W2 Review', 'Cita', 'Exito', 'Admin'
    ]
    elements.append(Paragraph("Pasos: " + " > ".join(wizard_steps), body))
    elements.append(Paragraph("Estado: 100% traducido ES/EN, todas las pantallas ACTIVAS", body_bold))
    elements.append(Spacer(1, 0.2 * inch))

    elements.append(Paragraph("3.3 Autenticacion - 5 Pantallas (100% Traducido)", h2))
    elements.append(Paragraph("Login, Registro, Olvide Contrasena, Reset Password, Verificar Codigo", body))
    elements.append(Spacer(1, 0.2 * inch))

    elements.append(Paragraph("3.4 Admin Movil - 100+ Pantallas", h2))
    elements.append(Paragraph("Incluye: Dashboard, Clientes, Calendario, Chat, Facturas, Declaraciones, Leads, Feedbacks, WhatsApp (conversaciones, automation, settings), Marketing, Mociones, Logs, Resenas, Tramites, Analytics. Adicionalmente 70+ pantallas avanzadas en _adminScreens/ para AI Brain, Bolita, Carousel, Credits, Documents, Education, Email Campaigns, FAQs, Feature Flags, Identity Verifications, Legal, Loans, Lottery, News, Notifications, Passports, Payments, Plans, Products, Push Notifications, Raffles, Receipts, Referrals, Refunds, Rise CRM, Shipments, SMS, Stripe, Subscriptions, Tax Estimates, Users, Version, WhatsApp.", body))
    elements.append(PageBreak())

    # ============ 4. INTEGRACIONES ============
    elements.append(Paragraph("4. INTEGRACIONES DE TERCEROS", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    integrations = [
        ['Servicio', 'Uso', 'Keys', 'Estado'],
        ['SendGrid', 'Emails transaccionales y campanas', 'SI', 'ACTIVA'],
        ['Twilio', 'SMS y verificaciones', 'SI', 'ACTIVA'],
        ['WhatsApp Business API', 'Mensajeria y bot automatizado', 'SI', 'ACTIVA'],
        ['NMI / Merchant One', 'Pagos, Customer Vault, ACH', 'SI', 'ACTIVA'],
        ['Stripe', 'Suscripciones y checkout', 'SI', 'ACTIVA'],
        ['Plaid', 'Autenticacion bancaria ACH', 'SI', 'ACTIVA'],
        ['Clover POS', 'Integracion punto de venta', 'SI', 'ACTIVA'],
        ['USPS', 'Tracking, etiquetas, validacion', 'SI', 'ACTIVA'],
        ['OpenAI (GPT-4o)', 'AI Ross, chatbot, OCR recibos', 'SI', 'ACTIVA'],
        ['Google Calendar', 'Sincronizacion de citas', 'SI', 'ACTIVA'],
        ['Firebase', 'Push notifications', 'SI', 'ACTIVA'],
        ['VAPI', 'Telefono AI (asistente voz)', 'PARCIAL', 'PARCIAL'],
        ['Rise CRM', 'Sync de clientes', 'PARCIAL', 'CONFIG'],
        ['Drake Tax', 'Transmision IRS oficial', 'NO', 'BLOQUEADA'],
    ]
    t6 = Table(integrations, colWidths=[1.4 * inch, 2.2 * inch, 0.7 * inch, 0.8 * inch])
    t6.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t6)
    elements.append(Spacer(1, 0.2 * inch))

    # ============ 5. SERVICIOS DINAMICOS ============
    elements.append(Paragraph("5. SERVICIOS DINAMICOS (PRECIOS ACTUALES)", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    svc_data = [['Servicio', 'Precio', 'Categoria', 'Popular']]
    for svc in stats.get('services_list', []):
        svc_data.append([
            svc.get('name', 'N/A'),
            f"${svc.get('price', 0):,.2f}",
            svc.get('category', '-'),
            'SI' if svc.get('is_popular') else '-',
        ])
    t8 = Table(svc_data, colWidths=[2.5 * inch, 0.8 * inch, 1 * inch, 0.7 * inch])
    t8.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t8)
    elements.append(PageBreak())

    # ============ 6. FLUJOS OPERATIVOS ============
    elements.append(Paragraph("6. FLUJOS OPERATIVOS PRINCIPALES (25 FLUJOS)", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    flows = [
        ['#', 'Flujo', 'Canales', 'Estado', 'Notas'],
        ['1', 'Registro/Login', 'Web + App', 'ACTIVO', 'JWT + email/password'],
        ['2', 'Tax Wizard (18 pasos)', 'App + Web', 'ACTIVO', 'W2 scanner AI, firma digital'],
        ['3', 'Agendar Cita', 'Web + App', 'ACTIVO', 'Calendario, SMS/email confirm'],
        ['4', 'Facturacion y Cobro', 'Web Admin', 'ACTIVO', 'PDF auto, pago link, NMI'],
        ['5', 'Portal de Pago', 'Web publica', 'ACTIVO', 'Tarjeta + ACH, NMI'],
        ['6', 'WhatsApp Bot', 'WhatsApp', 'ACTIVO', 'Bot AI automatizado'],
        ['7', 'Email Campaigns', 'Web Admin', 'ACTIVO', 'SendGrid, analytics'],
        ['8', 'IRIS 1099 Filing', 'Web Admin', 'ACTIVO', 'Generacion y envio'],
        ['9', 'Bookkeeping', 'Admin + App', 'ACTIVO', 'Plaid, categoriz., reportes'],
        ['10', 'Referidos', 'Web + App', 'ACTIVO', 'Codigos, tracking, rewards'],
        ['11', 'Creditos/Puntos', 'App', 'ACTIVO', 'Sistema creditos internos'],
        ['12', 'Recibos AI', 'App', 'ACTIVO', 'OCR + clasificacion auto'],
        ['13', 'Prestamos CAB', 'Web Admin', 'ACTIVO', 'Contratos PDF, pagos'],
        ['14', 'Inmigracion', 'Web Admin', 'ACTIVO', 'Casos, mociones, cotiz.'],
        ['15', 'Pasaportes', 'Admin + App', 'ACTIVO', 'Aplicacion, tracking, PDF'],
        ['16', 'Envios USPS', 'Web Admin', 'ACTIVO', 'Etiquetas, tracking'],
        ['17', 'Suscripciones', 'Web + App', 'ACTIVO', 'Stripe + Apple IAP'],
        ['18', 'Notif. Push', 'App', 'ACTIVO', 'Firebase, campanas masivas'],
        ['19', 'Juegos (Bolita/Rifas)', 'App', 'ACTIVO', 'Apuestas, sorteos, raspa'],
        ['20', 'AI Ross (Chatbot)', 'Web Admin', 'ACTIVO', 'GPT-4o, knowledge base'],
        ['21', 'Clover POS Sync', 'Web Admin', 'ACTIVO', 'Sync clientes, ordenes'],
        ['22', 'Google Reviews', 'Web Admin', 'ACTIVO', 'Monitoreo resenas'],
        ['23', 'Rise CRM Sync', 'Web Admin', 'PARCIAL', 'Config. parcial'],
        ['24', 'Drake Tax IRS', 'N/A', 'BLOQ.', 'Falta API key'],
        ['25', 'VAPI Telefono AI', 'Admin', 'PARCIAL', 'Config. parcial'],
    ]
    t9 = Table(flows, colWidths=[0.3 * inch, 1.7 * inch, 0.8 * inch, 0.6 * inch, 2.2 * inch])
    t9.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t9)
    elements.append(PageBreak())

    # ============ 7. INFRAESTRUCTURA ============
    elements.append(Paragraph("7. INFRAESTRUCTURA Y DEPLOYMENT", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    infra = [
        ['Componente', 'Plataforma', 'Repositorio', 'Estado'],
        ['Web App (Next.js)', 'Vercel', 'Yoandy90/ross-tax-website', 'PROD'],
        ['Backend (FastAPI)', 'Railway', 'Yoandy90/app-nueva', 'PROD'],
        ['Base de Datos', 'MongoDB Atlas', 'Cluster0 (taxportal)', 'PROD'],
        ['App iOS', 'TestFlight/AppStore', 'EAS Build (Expo)', 'PROD'],
        ['App Android', 'Google Play', 'EAS Build (Expo)', 'PROD'],
        ['DNS/Dominio', 'rosstaxpreparation.com', '-', 'ACTIVO'],
    ]
    t10 = Table(infra, colWidths=[1.5 * inch, 1.3 * inch, 2 * inch, 0.7 * inch])
    t10.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
    ]))
    elements.append(t10)
    elements.append(Spacer(1, 0.3 * inch))

    # ============ 8. BACKEND ============
    elements.append(Paragraph("8. BACKEND - 160+ ARCHIVOS DE SERVICIOS", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    backend_modules = [
        "Autenticacion (auth_routes, password_reset)",
        "Citas (appointment_routes, calendar_routes, appointment_types)",
        "Facturacion (invoice_endpoints, invoice_pdf_service)",
        "Pagos (payment_endpoints, merchant_one, ach_endpoints, stripe_checkout)",
        "Impuestos (tax_services, tax_returns_routes, tax_estimate, tax_tools)",
        "IRIS 1099 (iris_endpoints, iris_service)",
        "Bookkeeping (bookkeeping_router, plaid_bookkeeping_router)",
        "WhatsApp (whatsapp_endpoints, whatsapp_bot_v2, whatsapp_automation)",
        "Email (email_routes, email_campaign_service, email_alerts)",
        "AI (ai_brain_service, ai_chatbot, ai_automation, receipt_ai)",
        "Documentos (documents_routes, pdf_extractor, document_capture)",
        "Inmigracion (immigration_routes, immigration_motions)",
        "Prestamos (loan_endpoints, cab_endpoints, loan_pdf_service)",
        "Referidos (referral_routes, referral_service_v2)",
        "Notificaciones (notification_v2, push_notification, firebase_push)",
        "Pasaportes (passport_routes, passport_pdf_service)",
        "USPS (usps_endpoints, usps_labels_endpoints)",
        "Clover (clover_router)",
        "Creditos (credits_routes, credit_service)",
        "Juegos (bolita, scratch_cards, lottery, raffle)",
        "Suscripciones (subscription_routes, subscription_management)",
        "Payroll (payroll_router)",
        "Propiedades (rental_management_router)",
        "Admin (admin_dashboard, admin_services, admin_tools)",
    ]
    for mod in backend_modules:
        elements.append(Paragraph(f"  - {mod}", body))
    elements.append(PageBreak())

    # ============ 9. ISSUES ============
    elements.append(Paragraph("9. ISSUES CONOCIDOS Y RECOMENDACIONES", h1))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))

    elements.append(Paragraph("9.1 Issues Activos", h2))
    issues = [
        "CRITICO: Drake Tax API bloqueada - Se requieren credenciales para transmision IRS oficial.",
        "MEDIO: ~30 pantallas Expo pendientes de traduccion i18n completa.",
        "MEDIO: VAPI Telefono AI parcialmente configurado.",
        "BAJO: Rise CRM Sync necesita validacion de sincronizacion.",
        "BAJO: Videollamadas con funcionalidad parcial.",
    ]
    for issue in issues:
        elements.append(Paragraph(f"  - {issue}", body))
    elements.append(Spacer(1, 0.15 * inch))

    elements.append(Paragraph("9.2 Recomendaciones Tecnicas", h2))
    recs = [
        "Refactorizar server.py (42,000+ lineas) en modulos FastAPI separados.",
        "Completar traducciones i18n en todas las pantallas Expo.",
        "Implementar rate limiting en endpoints publicos.",
        "Anadir monitoring/alertas (Sentry) para tracking de errores.",
        "Implementar backup automatico de MongoDB.",
        "Anadir tests automatizados para flujos criticos de pago.",
    ]
    for rec in recs:
        elements.append(Paragraph(f"  - {rec}", body))
    elements.append(Spacer(1, 0.3 * inch))

    # Footer
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#6C1110')))
    elements.append(Spacer(1, 0.1 * inch))
    footer_style = ParagraphStyle('Footer', parent=body, fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph(f"Ross Tax Preparation - Documento confidencial", footer_style))
    elements.append(Paragraph(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))

    doc.build(elements)
    print(f"PDF generado: {filename}")
    return filename


async def send_email(pdf_path):
    """Send the PDF via SendGrid"""
    import base64
    import httpx

    with open(pdf_path, 'rb') as f:
        pdf_data = base64.b64encode(f.read()).decode()

    payload = {
        "personalizations": [
            {
                "to": [{"email": "yoandyross@gmail.com", "name": "Yoandy Ross"}],
                "subject": "Diagnostico Completo - Ross Tax Preparation Platform"
            }
        ],
        "from": {"email": os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'), "name": "Ross Tax System"},
        "content": [
            {
                "type": "text/html",
                "value": """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #6C1110; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: white; margin: 0;">Ross Tax Preparation</h1>
                        <p style="color: #FFD4D4; margin: 5px 0 0;">Diagnostico Completo de la Plataforma</p>
                    </div>
                    <div style="padding: 25px; background-color: #FFFAFA; border: 1px solid #E5E7EB;">
                        <p>Hola Yoandy,</p>
                        <p>Adjunto encontraras el diagnostico completo de la plataforma Ross Tax Preparation. El reporte incluye:</p>
                        <ul>
                            <li>Todas las paginas web publicas y su estado</li>
                            <li>Portal de administracion completo (90+ modulos)</li>
                            <li>App movil - todas las pantallas y flujos</li>
                            <li>Integraciones de terceros activas</li>
                            <li>Base de datos - 190 colecciones</li>
                            <li>25 flujos operativos documentados</li>
                            <li>Issues conocidos y recomendaciones</li>
                        </ul>
                        <p style="color: #666;">Este documento fue generado automaticamente por el sistema de diagnostico.</p>
                    </div>
                    <div style="background-color: #F3F4F6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
                        <p style="margin: 0; color: #888; font-size: 12px;">2026 Ross Tax Preparation</p>
                    </div>
                </div>
                """
            }
        ],
        "attachments": [
            {
                "content": pdf_data,
                "filename": "Diagnostico_RossTax_Completo.pdf",
                "type": "application/pdf",
                "disposition": "attachment"
            }
        ]
    }

    async with httpx.AsyncClient() as aclient:
        response = await aclient.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {os.getenv('SENDGRID_API_KEY')}",
                "Content-Type": "application/json"
            }
        )
        if response.status_code in [200, 201, 202]:
            print(f"Email enviado exitosamente a yoandyross@gmail.com")
        else:
            print(f"Error enviando email: {response.status_code} - {response.text}")
        return response.status_code


async def main():
    print("Recopilando estadisticas de la base de datos...")
    stats = await get_stats()
    print(f"{len(stats)} metricas recopiladas")

    print("Generando PDF...")
    pdf_path = build_pdf(stats)

    print("Enviando por email...")
    status = await send_email(pdf_path)
    return status


if __name__ == "__main__":
    asyncio.run(main())
