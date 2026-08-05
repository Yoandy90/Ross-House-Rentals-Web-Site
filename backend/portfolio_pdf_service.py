"""
Ross Tax — Portfolio PDF Service
Generates professional PDF catalogs for Personal and Business services.
"""
import os
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Image
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
import logging

logger = logging.getLogger(__name__)

# ── Brand Colors ──
BRAND_EMERALD = HexColor("#059669")
BRAND_EMERALD_DARK = HexColor("#047857")
BRAND_EMERALD_LIGHT = HexColor("#D1FAE5")
BRAND_TEAL = HexColor("#0D9488")
BRAND_NAVY = HexColor("#1E3A5F")
BRAND_SLATE = HexColor("#334155")
BRAND_GRAY = HexColor("#6B7280")
BRAND_LIGHT_BG = HexColor("#F8FAFC")
BRAND_WHITE = white
BRAND_BLACK = black
BRAND_GOLD = HexColor("#D4AF37")
BRAND_RED_ACCENT = HexColor("#6C1110")

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 0.6 * inch
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN


class ColoredRect(Flowable):
    """A colored rectangle as a section background."""
    def __init__(self, width, height, color=BRAND_EMERALD, radius=8):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.color = color
        self.radius = radius

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=0)


class LineSeparator(Flowable):
    """A simple horizontal line separator."""
    def __init__(self, width, color=BRAND_EMERALD, thickness=1.5):
        Flowable.__init__(self)
        self.width = width
        self.color = color
        self.thickness = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=30,
        textColor=BRAND_WHITE,
        alignment=TA_CENTER,
        spaceAfter=8,
        leading=36,
    ))
    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        fontName='Helvetica',
        fontSize=14,
        textColor=HexColor("#B0E0D8"),
        alignment=TA_CENTER,
        spaceAfter=6,
        leading=18,
    ))
    styles.add(ParagraphStyle(
        name='CoverDate',
        fontName='Helvetica-Oblique',
        fontSize=11,
        textColor=HexColor("#A7F3D0"),
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=BRAND_EMERALD_DARK,
        spaceBefore=16,
        spaceAfter=8,
        leading=22,
    ))
    styles.add(ParagraphStyle(
        name='ServiceTitle',
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=BRAND_SLATE,
        spaceBefore=6,
        spaceAfter=4,
        leading=18,
    ))
    styles.add(ParagraphStyle(
        name='ServiceTagline',
        fontName='Helvetica-Oblique',
        fontSize=10,
        textColor=BRAND_GRAY,
        spaceAfter=4,
        leading=13,
    ))
    styles.add(ParagraphStyle(
        name='BodyText2',
        fontName='Helvetica',
        fontSize=9.5,
        textColor=BRAND_SLATE,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
        leading=13,
    ))
    styles.add(ParagraphStyle(
        name='BulletItem',
        fontName='Helvetica',
        fontSize=9,
        textColor=BRAND_SLATE,
        leftIndent=16,
        spaceAfter=2,
        leading=12,
        bulletFontName='Helvetica',
        bulletFontSize=9,
    ))
    styles.add(ParagraphStyle(
        name='PriceTag',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=BRAND_EMERALD,
        spaceAfter=2,
        leading=15,
    ))
    styles.add(ParagraphStyle(
        name='PriceDetail',
        fontName='Helvetica',
        fontSize=8.5,
        textColor=BRAND_GRAY,
        spaceAfter=6,
        leading=11,
    ))
    styles.add(ParagraphStyle(
        name='StepTitle',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=BRAND_SLATE,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='StepDesc',
        fontName='Helvetica',
        fontSize=8.5,
        textColor=BRAND_GRAY,
        leading=11,
    ))
    styles.add(ParagraphStyle(
        name='FooterText',
        fontName='Helvetica',
        fontSize=8,
        textColor=BRAND_GRAY,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=BRAND_WHITE,
        alignment=TA_CENTER,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=9,
        textColor=BRAND_SLATE,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=BRAND_EMERALD,
        alignment=TA_RIGHT,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='CTAText',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=BRAND_WHITE,
        alignment=TA_CENTER,
        leading=16,
    ))

    return styles


# ══════════════════════════════════════════════════════════════════
# SERVICE DATA
# ══════════════════════════════════════════════════════════════════

PERSONAL_SERVICES = [
    {
        "emoji": "📋",
        "name": "Declaración de Impuestos Personal",
        "tagline": "Preparación profesional — maximizamos tu reembolso en solo 30 minutos",
        "price": "$180",
        "priceDetail": "Pago único · Incluye Federal y Estatal",
        "description": "Preparamos tu declaración de impuestos (Form 1040) de manera profesional en aproximadamente 30 minutos. Nos aseguramos de que aproveches cada deducción y crédito disponible. Incluye declaración estatal.",
        "includes": [
            "Preparación Form 1040 (Federal + Estatal)",
            "Revisión de créditos (EIC, Child Tax Credit, Education)",
            "Análisis de deducciones detalladas vs. estándar",
            "E-File directo con el IRS",
            "Depósito directo de reembolso",
            "Copia digital de tu declaración",
            "Seguimiento del reembolso desde la app",
            "Soporte post-filing por 12 meses",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Agenda tu cita presencial o virtual desde la app, web o WhatsApp", "2 min"),
            ("2. Envía tus Documentos", "Sube tus documentos (W2, 1099, ID) por la app, WhatsApp, o el link que recibes al agendar", "Antes de la cita"),
            ("3. Cita de Preparación", "El día de tu cita, preparamos tu declaración completa", "~30 min"),
            ("4. Revisión y Firma", "Revisas tu declaración, firmas electrónicamente y la enviamos al IRS", "Incluido"),
            ("5. Seguimiento", "Rastreamos tu reembolso y te notificamos cada cambio de estado", "Hasta depósito"),
        ],
    },
    {
        "emoji": "🧙‍♂️",
        "name": "Tax Wizard (Estimado con AI)",
        "tagline": "Responde preguntas simples y recibe un estimado de reembolso en minutos",
        "price": "GRATIS",
        "priceDetail": "Estimado gratuito · Sin compromiso · Disponible 24/7",
        "description": "Nuestro asistente inteligente te guía paso a paso. Responde preguntas sobre tu situación fiscal y recibe un estimado de reembolso en 5 minutos. Si te gusta el resultado, agendas tu cita directamente.",
        "includes": [
            "Estimado de reembolso en 5 minutos",
            "Análisis de situación fiscal personalizado",
            "Detección automática de créditos aplicables",
            "Sin compromiso — solo información",
            "Disponible 24/7 desde la app iOS y Android",
        ],
        "steps": [
            ("1. Descarga la App", "Disponible en iOS App Store y Google Play", "2 min"),
            ("2. Inicia el Wizard", "Toca 'Tax Wizard' en el menú principal", "1 min"),
            ("3. Responde Preguntas", "Estado civil, dependientes, ingresos, deducciones", "5 min"),
            ("4. Recibe tu Estimado", "Ves tu reembolso estimado y si deseas, agendas tu cita", "Inmediato"),
        ],
    },
    {
        "emoji": "🌎",
        "name": "ITIN (Número de Identificación Fiscal)",
        "tagline": "Obtén tu número de identificación fiscal individual del IRS",
        "price": "$200",
        "priceDetail": "Incluye preparación W-7 + certificación de documentos",
        "description": "Te ayudamos a obtener tu ITIN para que puedas declarar impuestos, abrir cuentas bancarias y construir historial crediticio en EE.UU.",
        "includes": [
            "Preparación de Form W-7",
            "Certified Acceptance Agent (CAA) services",
            "No necesitas enviar tu pasaporte original al IRS",
            "Seguimiento del estatus de tu aplicación",
            "Preparación de impuestos incluida con ITIN nuevo",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Agenda presencial o virtual desde la app o WhatsApp", "2 min"),
            ("2. Envía Documentos", "Pasaporte y documentos de identidad por la app o en persona", "Antes de la cita"),
            ("3. Certificación y Envío", "Certificamos tus documentos y enviamos el W-7 al IRS", "~45 min"),
            ("4. Resultado", "Recibes tu ITIN por correo del IRS", "8-12 semanas"),
        ],
    },
    {
        "emoji": "✏️",
        "name": "Enmienda de Impuestos (Amendment)",
        "tagline": "Corrección de declaraciones de años anteriores",
        "price": "$150",
        "priceDetail": "Preparación de Form 1040-X",
        "description": "Si necesitas corregir una declaración de impuestos de años anteriores, preparamos el formulario 1040-X con todos los cambios necesarios.",
        "includes": [
            "Revisión de declaración original",
            "Preparación de Form 1040-X",
            "Documentación de cambios",
            "Presentación al IRS",
            "Seguimiento del proceso",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Presencial o virtual", "2 min"),
            ("2. Envía Documentos", "Declaración original + documentos de corrección", "Antes de la cita"),
            ("3. Preparación", "Preparamos la enmienda en tu cita", "~30 min"),
            ("4. Envío al IRS", "Presentamos el 1040-X", "Inmediato"),
        ],
    },
    {
        "emoji": "📍",
        "name": "Rastreo de Reembolso IRS",
        "tagline": "Seguimiento en tiempo real del estado de tu reembolso",
        "price": "GRATIS",
        "priceDetail": "Incluido con tu preparación de impuestos",
        "description": "Rastreamos el estado de tu reembolso del IRS y te notificamos automáticamente cada vez que hay un cambio de estado.",
        "includes": [
            "Rastreo automático del estado del IRS",
            "Notificaciones por email y push",
            "Estimado de fecha de depósito",
            "Alertas si hay retención o problemas",
            "Acceso 24/7 desde la app",
        ],
        "steps": [],
    },
    {
        "emoji": "📸",
        "name": "Escaneo de Recibos con AI",
        "tagline": "Toma foto de tus recibos y AI los clasifica automáticamente",
        "price": "5 GRATIS/mes",
        "priceDetail": "5/mes gratis · 20/mes con plan Semilla · Ilimitado con Crecimiento+",
        "description": "Usa la cámara de tu celular para escanear recibos. Nuestra AI extrae monto, comercio, categoría IRS y fecha automáticamente.",
        "includes": [
            "5 escaneos gratuitos por mes",
            "Clasificación automática con AI",
            "Categorización según IRS Schedule C",
            "Historial de gastos organizado",
            "Reporte anual de gastos deducibles",
        ],
        "steps": [],
    },
    {
        "emoji": "📝",
        "name": "Traducciones Certificadas",
        "tagline": "Traducción profesional de documentos oficiales",
        "price": "$25",
        "priceDetail": "Por documento · Certificación incluida",
        "description": "Servicio de traducción certificada de documentos oficiales del español al inglés o viceversa.",
        "includes": [
            "Traducción profesional certificada",
            "Sello y firma de traductor",
            "Formato oficial aceptado por instituciones",
            "Entrega rápida",
        ],
        "steps": [],
    },
    {
        "emoji": "📎",
        "name": "Notarizaciones",
        "tagline": "Notarización oficial de documentos legales",
        "price": "$15",
        "priceDetail": "Por documento · Notario público certificado",
        "description": "Servicio de notario público para documentos legales, poderes, certificaciones y más.",
        "includes": [
            "Notario público certificado",
            "Sello oficial",
            "Certificado de notarización",
            "Identificación verificada",
        ],
        "steps": [],
    },
    {
        "emoji": "💳",
        "name": "Construcción de Crédito",
        "tagline": "Guía personalizada para construir o mejorar tu historial crediticio",
        "price": "Incluido",
        "priceDetail": "Guía gratuita con servicios de impuestos",
        "description": "Recursos y guías para entender, construir y mejorar tu crédito en Estados Unidos.",
        "includes": [
            "Guía paso a paso de construcción de crédito",
            "Recursos educativos sobre el sistema crediticio",
            "Recomendaciones de productos financieros",
            "Disponible en la app en español e inglés",
        ],
        "steps": [],
    },
]

BUSINESS_SERVICES = [
    {
        "emoji": "📊",
        "name": "Bookkeeping (Contabilidad de Negocio)",
        "tagline": "Contabilidad profesional con AI + revisión humana + dashboard en tiempo real",
        "price": "Desde $199/mes",
        "priceDetail": "Semilla $199 · Crecimiento $399 · Empresarial $699",
        "description": "Servicio completo de contabilidad para tu negocio. Sincronización bancaria con Plaid, clasificación con AI, revisión por contador, reportes fiscales y acceso 24/7.",
        "includes": [
            "Sincronización bancaria automática (Plaid)",
            "Clasificación de transacciones con AI",
            "Revisión por contador profesional",
            "Reportes P&L, Balance General, Flujo de Caja",
            "Dashboard en tiempo real",
            "Escaneo de recibos (20-ilimitado/mes)",
            "Alertas de gastos inusuales",
            "Pronóstico de flujo de caja",
            "Soporte bilingüe dedicado",
        ],
        "plans": [
            {"name": "🌱 Semilla", "price": "$199/mes", "target": "Freelancers y autónomos", "features": "50 txns · 1 cuenta · Revisión mensual"},
            {"name": "🚀 Crecimiento", "price": "$399/mes", "target": "Negocios en crecimiento", "features": "200 txns · 3 cuentas · Sales Tax · Semanal"},
            {"name": "🏢 Empresarial", "price": "$699/mes", "target": "Empresas establecidas", "features": "Ilimitado · Payroll · Consultoría · Dedicado"},
        ],
        "steps": [
            ("1. Consulta Gratuita", "Analizamos tu negocio y recomendamos el plan ideal", "30 min"),
            ("2. Conexión Bancaria", "Conectamos tus cuentas bancarias con Plaid", "5 min"),
            ("3. Primer Reporte", "Recibes tu primer reporte mensual con categorización IRS", "Mes 1"),
            ("4. Revisión Continua", "Tu contador revisa y ajusta la clasificación", "Mensual/Semanal"),
        ],
    },
    {
        "emoji": "🏗️",
        "name": "Formación de LLC",
        "tagline": "Crea tu LLC de manera profesional y rápida",
        "price": "$350",
        "priceDetail": "Incluye artículos de organización + EIN + Operating Agreement",
        "description": "Te ayudamos a formar tu LLC legalmente en cualquier estado. Incluye artículos de organización, EIN del IRS, operating agreement y registraciones necesarias.",
        "includes": [
            "Artículos de Organización",
            "Obtención de EIN (Employer ID Number)",
            "Operating Agreement",
            "Registered Agent (primer año)",
            "Guía de cumplimiento estatal",
            "Consulta sobre estructura óptima",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Presencial o virtual", "2 min"),
            ("2. Consulta", "Determinamos la mejor estructura para tu negocio", "~30 min"),
            ("3. Documentación y Filing", "Preparamos y presentamos ante el estado", "1-2 semanas"),
            ("4. Entrega", "Recibes tu paquete completo con EIN", "Post-aprobación"),
        ],
    },
    {
        "emoji": "🏛️",
        "name": "Declaración de Impuestos de Negocio",
        "tagline": "Impuestos para LLC, Corp, Partnership",
        "price": "$350",
        "priceDetail": "Incluye Schedule C, estados financieros y planificación fiscal",
        "description": "Preparamos la declaración de impuestos de tu negocio maximizando deducciones y cumpliendo con todas las obligaciones fiscales federales y estatales.",
        "includes": [
            "Preparación de declaración empresarial",
            "Schedule C / K-1 según aplique",
            "Análisis de deducciones empresariales",
            "Estimados trimestrales",
            "Declaración estatal del negocio",
            "Consultoría fiscal básica incluida",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Presencial o virtual", "2 min"),
            ("2. Envía Documentos", "Registros financieros del negocio por la app o WhatsApp", "Antes de la cita"),
            ("3. Preparación", "Preparamos la declaración en tu cita", "~60 min"),
            ("4. Envío", "E-File al IRS y al estado", "Inmediato"),
        ],
    },
    {
        "emoji": "📄",
        "name": "1099 Filing (Formularios de Contratistas)",
        "tagline": "Preparación y envío de formularios 1099-NEC al IRS",
        "price": "$10/formulario",
        "priceDetail": "Descuento por volumen: 50+ formularios $8/cada uno",
        "description": "Si pagas a contratistas independientes más de $600/año, estás obligado a enviar 1099-NEC. Nosotros lo preparamos y enviamos al IRS y al contratista.",
        "includes": [
            "Preparación de Form 1099-NEC",
            "E-File con el IRS",
            "Envío de copia al contratista",
            "Cumplimiento con fechas límite del IRS",
            "Correcciones incluidas si es necesario",
        ],
        "steps": [
            ("1. Recopilación", "Nos envías info de cada contratista", "1 día"),
            ("2. Preparación", "Preparamos cada formulario 1099-NEC", "2-3 días"),
            ("3. Envío", "E-File al IRS + copias a contratistas", "Inmediato"),
        ],
    },
    {
        "emoji": "🧾",
        "name": "Sales Tax (Impuesto de Ventas)",
        "tagline": "Preparación y presentación de Sales Tax",
        "price": "Incluido en Crecimiento+",
        "priceDetail": "Individual $75-$150/mes · Incluido en plan Crecimiento ($399) y Empresarial ($699)",
        "description": "Preparamos y presentamos tu declaración de Sales Tax mensual o trimestral ante el Florida Department of Revenue.",
        "includes": [
            "Cálculo mensual/trimestral de Sales Tax",
            "Preparación del DR-15 (Florida)",
            "Filing electrónico con el estado",
            "Recordatorios de fechas límite",
        ],
        "steps": [],
    },
    {
        "emoji": "💼",
        "name": "Payroll (Nómina)",
        "tagline": "Procesamiento de nómina para tus empleados",
        "price": "$75 - $150/mes",
        "priceDetail": "Incluido en Plan Empresarial ($699) · Add-on para otros planes",
        "description": "Procesamos la nómina: cálculo de salarios, retenciones, depósitos directos y formularios W-2 al final del año.",
        "includes": [
            "Cálculo de salarios y retenciones",
            "Depósitos directos a empleados",
            "Reporting al IRS (941, 940)",
            "W-2 para cada empleado al final del año",
        ],
        "steps": [],
    },
    {
        "emoji": "🌎",
        "name": "Consulta de Inmigración",
        "tagline": "Orientación sobre trámites migratorios",
        "price": "$100",
        "priceDetail": "Consulta de orientación migratoria",
        "description": "Orientación general sobre trámites migratorios. Ayudamos con información sobre procesos, documentos necesarios y opciones disponibles.",
        "includes": [
            "Consulta personalizada",
            "Revisión de situación migratoria",
            "Orientación sobre opciones y procesos",
            "Lista de documentos necesarios",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Presencial o virtual", "2 min"),
            ("2. Consulta", "Revisamos tu situación y opciones", "~30 min"),
        ],
    },
    {
        "emoji": "✈️",
        "name": "Trámite de Pasaporte",
        "tagline": "Renovación y trámites de pasaporte",
        "price": "$100",
        "priceDetail": "No incluye fee gubernamental",
        "description": "Te ayudamos con el trámite de renovación o solicitud de pasaporte, asegurándonos de que toda la documentación esté correcta.",
        "includes": [
            "Asistencia con formularios",
            "Revisión de documentos",
            "Fotos de pasaporte",
            "Orientación sobre el proceso",
        ],
        "steps": [
            ("1. Agenda tu Cita", "Presencial", "2 min"),
            ("2. Cita", "Traes tus documentos y te asistimos con el trámite", "~30 min"),
        ],
    },
]

PRICE_TABLE_PERSONAL = [
    ["Declaración Personal", "$180"],
    ["Tax Wizard (Estimado AI)", "GRATIS"],
    ["ITIN (W-7)", "$200"],
    ["Enmienda (1040-X)", "$150"],
    ["Rastreo de Reembolso", "GRATIS"],
    ["Escaneo de Recibos AI", "5/mes GRATIS"],
    ["Traducciones Certificadas", "$25"],
    ["Notarizaciones", "$15"],
    ["Guía de Crédito", "Incluido"],
]

PRICE_TABLE_BUSINESS = [
    ["Declaración de Negocio", "$350"],
    ["Formación de LLC", "$350"],
    ["Bookkeeping Semilla", "$199/mes"],
    ["Bookkeeping Crecimiento", "$399/mes"],
    ["Bookkeeping Empresarial", "$699/mes"],
    ["1099 Filing", "$10/formulario"],
    ["Sales Tax (mensual)", "$75 - $150"],
    ["Payroll (mensual)", "$75 - $150"],
    ["Consulta de Inmigración", "$100"],
    ["Trámite de Pasaporte", "$100"],
    ["Cleanup Inicial", "$500 - $2,500"],
]


# ══════════════════════════════════════════════════════════════════
# PDF GENERATOR
# ══════════════════════════════════════════════════════════════════

class PortfolioPDFService:
    """Service to generate professional PDF service portfolio."""

    def __init__(self):
        self.company_name = "Ross Tax Preparation LLC"
        self.company_phone = "(806) 934-2018"
        self.company_email = "info@rosstaxpreparation.com"
        self.company_website = "rosstaxpreparation.com"
        self.logo_path = os.path.join(os.path.dirname(__file__), "assets", "company_logo.png")

    def _add_page_background(self, canvas, doc):
        """Draw page background and footer on every page."""
        canvas.saveState()
        # Subtle top accent line
        canvas.setStrokeColor(BRAND_EMERALD)
        canvas.setLineWidth(3)
        canvas.line(0, PAGE_HEIGHT - 2, PAGE_WIDTH, PAGE_HEIGHT - 2)
        # Footer
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(BRAND_GRAY)
        footer_y = 25
        canvas.drawCentredString(PAGE_WIDTH / 2, footer_y + 10,
                                 f"{self.company_name} · {self.company_phone} · {self.company_email}")
        canvas.drawCentredString(PAGE_WIDTH / 2, footer_y,
                                 f"{self.company_website} · © {datetime.now().year}")
        canvas.restoreState()

    def _build_cover_page(self, styles, portfolio_type: str) -> list:
        """Build the cover page elements."""
        elements = []

        # Green cover background
        elements.append(Spacer(1, 0.3 * inch))
        cover_bg = ColoredRect(CONTENT_WIDTH, 3.8 * inch, BRAND_EMERALD_DARK, radius=16)
        elements.append(cover_bg)

        # Overlay text (we use negative spacer trick to place text over background)
        elements.append(Spacer(1, -3.5 * inch))

        elements.append(Spacer(1, 0.3 * inch))

        if portfolio_type == "personal":
            title = "Portafolio de Servicios<br/>Personales"
            subtitle = "Impuestos · ITIN · Reembolsos · Crédito"
        else:
            title = "Portafolio de Servicios<br/>Empresariales"
            subtitle = "Bookkeeping · Formación · 1099 · Nómina"

        elements.append(Paragraph(title, styles['CoverTitle']))
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph(subtitle, styles['CoverSubtitle']))
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph(
            f"Preparado: {datetime.now().strftime('%B %Y')}",
            styles['CoverDate']
        ))

        elements.append(Spacer(1, 0.8 * inch))

        # Welcome text
        elements.append(Paragraph(
            "Tu Socio Financiero Completo",
            ParagraphStyle('WelcomeH', parent=styles['SectionTitle'], alignment=TA_CENTER, fontSize=20, textColor=BRAND_EMERALD_DARK)
        ))
        elements.append(Spacer(1, 0.1 * inch))

        if portfolio_type == "personal":
            welcome_text = (
                "En Ross Tax Preparation te ayudamos a maximizar tu reembolso de impuestos, "
                "obtener tu ITIN, y construir tu futuro financiero en Estados Unidos. "
                "Somos 100% bilingües, con tecnología de punta y atención humana personalizada. "
                "Descubre todos nuestros servicios a continuación."
            )
        else:
            welcome_text = (
                "En Ross Tax Preparation ofrecemos soluciones financieras integrales para tu negocio. "
                "Desde la contabilidad diaria con AI hasta la formación legal de tu empresa, "
                "declaraciones fiscales y nómina — todo en un solo lugar, 100% bilingüe, "
                "con tecnología avanzada y el respaldo de contadores profesionales."
            )

        elements.append(Paragraph(welcome_text, ParagraphStyle(
            'WelcomeBody', parent=styles['BodyText2'], alignment=TA_CENTER,
            fontSize=10, leading=14, textColor=BRAND_SLATE
        )))

        elements.append(Spacer(1, 0.15 * inch))

        # Features strip
        features_data = [
            ["🌐 100% Bilingüe", "📱 App iOS & Android", "🤖 AI + Humano", "🔒 Datos Seguros"]
        ]
        features_table = Table(features_data, colWidths=[CONTENT_WIDTH / 4] * 4)
        features_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, -1), BRAND_EMERALD_DARK),
            ('BACKGROUND', (0, 0), (-1, -1), BRAND_EMERALD_LIGHT),
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(features_table)

        elements.append(PageBreak())
        return elements

    def _build_service_block(self, service: dict, styles, index: int) -> list:
        """Build a service detail block."""
        elements = []

        # Service header with colored accent
        header_bg = ColoredRect(CONTENT_WIDTH, 0.45 * inch, BRAND_EMERALD, radius=6)
        elements.append(header_bg)
        elements.append(Spacer(1, -0.38 * inch))
        elements.append(Paragraph(
            f"&nbsp;&nbsp;{service['emoji']} {service['name']}",
            ParagraphStyle('SvcHeader', parent=styles['ServiceTitle'],
                           textColor=BRAND_WHITE, fontSize=12, leading=15)
        ))
        elements.append(Spacer(1, 0.08 * inch))

        # Tagline
        elements.append(Paragraph(service['tagline'], styles['ServiceTagline']))

        # Price
        elements.append(Paragraph(service['price'], styles['PriceTag']))
        elements.append(Paragraph(service['priceDetail'], styles['PriceDetail']))

        # Description
        elements.append(Paragraph(service['description'], styles['BodyText2']))

        # Includes
        elements.append(Spacer(1, 0.05 * inch))
        elements.append(Paragraph(
            "<b>✓ ¿Qué incluye?</b>",
            ParagraphStyle('IncludesH', parent=styles['BodyText2'],
                           fontSize=10, textColor=BRAND_EMERALD_DARK)
        ))

        # Build includes as a 2-column table for compactness
        includes = service.get('includes', [])
        inc_rows = []
        for i in range(0, len(includes), 2):
            left = f"✓ {includes[i]}" if i < len(includes) else ""
            right = f"✓ {includes[i + 1]}" if i + 1 < len(includes) else ""
            inc_rows.append([
                Paragraph(left, ParagraphStyle('IncItem', parent=styles['BulletItem'],
                                               leftIndent=0, fontSize=8.5, textColor=BRAND_SLATE)),
                Paragraph(right, ParagraphStyle('IncItem2', parent=styles['BulletItem'],
                                                leftIndent=0, fontSize=8.5, textColor=BRAND_SLATE)),
            ])

        if inc_rows:
            inc_table = Table(inc_rows, colWidths=[CONTENT_WIDTH * 0.5, CONTENT_WIDTH * 0.5])
            inc_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(inc_table)

        # Plans (if any — bookkeeping)
        plans = service.get('plans', [])
        if plans:
            elements.append(Spacer(1, 0.1 * inch))
            elements.append(Paragraph(
                "<b>📦 Planes Disponibles</b>",
                ParagraphStyle('PlansH', parent=styles['BodyText2'],
                               fontSize=10, textColor=BRAND_EMERALD_DARK)
            ))
            plan_header = [
                Paragraph("<b>Plan</b>", styles['TableHeader']),
                Paragraph("<b>Precio</b>", styles['TableHeader']),
                Paragraph("<b>Para</b>", styles['TableHeader']),
                Paragraph("<b>Incluye</b>", styles['TableHeader']),
            ]
            plan_rows = [plan_header]
            for p in plans:
                plan_rows.append([
                    Paragraph(p['name'], styles['TableCell']),
                    Paragraph(f"<b>{p['price']}</b>", ParagraphStyle('pp', parent=styles['TableCell'], textColor=BRAND_EMERALD)),
                    Paragraph(p['target'], styles['TableCell']),
                    Paragraph(p['features'], ParagraphStyle('pf', parent=styles['TableCell'], fontSize=8)),
                ])

            plan_table = Table(plan_rows, colWidths=[
                CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.18,
                CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.34
            ])
            plan_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), BRAND_EMERALD),
                ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), BRAND_LIGHT_BG),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('ROUNDEDCORNERS', [6, 6, 6, 6]),
            ]))
            elements.append(plan_table)

        # Steps
        steps = service.get('steps', [])
        if steps:
            elements.append(Spacer(1, 0.1 * inch))
            elements.append(Paragraph(
                "<b>📋 Paso a Paso</b>",
                ParagraphStyle('StepsH', parent=styles['BodyText2'],
                               fontSize=10, textColor=BRAND_EMERALD_DARK)
            ))
            for step_title, step_desc, step_time in steps:
                elements.append(Paragraph(
                    f"<b>{step_title}</b> <font color='#6B7280'>({step_time})</font> — {step_desc}",
                    ParagraphStyle('StepLine', parent=styles['BodyText2'], fontSize=8.5, leftIndent=8, leading=12)
                ))

        elements.append(Spacer(1, 0.15 * inch))
        elements.append(LineSeparator(CONTENT_WIDTH, color=HexColor("#E5E7EB"), thickness=0.8))
        elements.append(Spacer(1, 0.12 * inch))

        return elements

    def _build_price_table(self, styles, portfolio_type: str) -> list:
        """Build a summary price reference table."""
        elements = []

        elements.append(Paragraph("Referencia Rápida de Precios", styles['SectionTitle']))
        elements.append(Spacer(1, 0.05 * inch))

        if portfolio_type == "personal":
            data = PRICE_TABLE_PERSONAL
            header_color = BRAND_NAVY
            title = "👤 Servicios Personales"
        else:
            data = PRICE_TABLE_BUSINESS
            header_color = BRAND_EMERALD_DARK
            title = "🏢 Servicios Empresariales"

        header_row = [
            Paragraph(f"<b>{title}</b>", ParagraphStyle('th1', parent=styles['TableHeader'], alignment=TA_LEFT)),
            Paragraph("<b>Precio</b>", ParagraphStyle('th2', parent=styles['TableHeader'], alignment=TA_RIGHT)),
        ]

        table_data = [header_row]
        for svc_name, svc_price in data:
            table_data.append([
                Paragraph(svc_name, styles['TableCell']),
                Paragraph(f"<b>{svc_price}</b>", styles['TableCellBold']),
            ])

        price_table = Table(table_data, colWidths=[CONTENT_WIDTH * 0.65, CONTENT_WIDTH * 0.35])
        price_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ]))
        elements.append(price_table)

        return elements

    def _build_cta_section(self, styles) -> list:
        """Build the final Call-To-Action section."""
        elements = []
        elements.append(Spacer(1, 0.3 * inch))

        cta_bg = ColoredRect(CONTENT_WIDTH, 1.6 * inch, BRAND_EMERALD, radius=12)
        elements.append(cta_bg)
        elements.append(Spacer(1, -1.4 * inch))

        elements.append(Paragraph(
            "¿Listo para comenzar?",
            ParagraphStyle('CTATitle', parent=styles['CoverTitle'], fontSize=22, leading=26)
        ))
        elements.append(Spacer(1, 0.05 * inch))
        elements.append(Paragraph(
            "Agenda una consulta gratuita hoy.<br/>Sin compromiso, sin presión.",
            ParagraphStyle('CTASub', parent=styles['CoverSubtitle'], fontSize=11, leading=14)
        ))
        elements.append(Spacer(1, 0.1 * inch))

        contact_data = [[
            Paragraph(f"📞 {self.company_phone}", ParagraphStyle('cc1', parent=styles['CTAText'], fontSize=11)),
            Paragraph(f"✉️ {self.company_email}", ParagraphStyle('cc2', parent=styles['CTAText'], fontSize=11)),
        ]]
        contact_table = Table(contact_data, colWidths=[CONTENT_WIDTH * 0.5, CONTENT_WIDTH * 0.5])
        contact_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(contact_table)

        elements.append(Spacer(1, 0.3 * inch))

        # Why choose us
        elements.append(Paragraph("¿Por qué Ross Tax?", styles['SectionTitle']))
        elements.append(Spacer(1, 0.05 * inch))

        why_items = [
            ["🌐 100% Bilingüe", "Atención completa en español e inglés. Tu idioma, tu comodidad."],
            ["🤖 Tecnología + Humano", "AI clasifica, un contador verifica. Lo mejor de ambos mundos."],
            ["📱 App Propia", "Accede a todos tus servicios desde tu celular, 24/7."],
            ["🔒 Datos Seguros", "Encriptación de grado bancario. Tu información está protegida."],
        ]

        why_rows = []
        for emoji_title, desc in why_items:
            why_rows.append([
                Paragraph(f"<b>{emoji_title}</b>", ParagraphStyle('wt', parent=styles['BodyText2'], fontSize=10, textColor=BRAND_EMERALD_DARK)),
                Paragraph(desc, ParagraphStyle('wd', parent=styles['BodyText2'], fontSize=9, textColor=BRAND_GRAY)),
            ])

        why_table = Table(why_rows, colWidths=[CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.65])
        why_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor("#E5E7EB")),
        ]))
        elements.append(why_table)

        return elements

    def generate_portfolio_pdf(self, portfolio_type: str = "personal") -> BytesIO:
        """
        Generate a professional portfolio PDF.

        Args:
            portfolio_type: "personal" or "business"

        Returns:
            BytesIO buffer with the PDF content.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=0.8 * inch,
        )

        styles = build_styles()
        elements = []

        # Cover Page
        elements.extend(self._build_cover_page(styles, portfolio_type))

        # Services
        services = PERSONAL_SERVICES if portfolio_type == "personal" else BUSINESS_SERVICES

        elements.append(Paragraph(
            f"{'👤 Servicios Personales' if portfolio_type == 'personal' else '🏢 Servicios Empresariales'} — Detalle",
            styles['SectionTitle']
        ))
        elements.append(Spacer(1, 0.1 * inch))

        for i, service in enumerate(services):
            block = self._build_service_block(service, styles, i)
            elements.extend(block)

        # Price Reference Table
        elements.append(PageBreak())
        elements.extend(self._build_price_table(styles, portfolio_type))

        # CTA Section
        elements.extend(self._build_cta_section(styles))

        # Build PDF
        doc.build(elements, onFirstPage=self._add_page_background,
                  onLaterPages=self._add_page_background)

        buffer.seek(0)
        return buffer

    def generate_combined_portfolio_pdf(self) -> BytesIO:
        """
        Generate a combined portfolio PDF with both personal and business services.

        Returns:
            BytesIO buffer with the combined PDF content.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=0.8 * inch,
        )

        styles = build_styles()
        elements = []

        # Cover page (combined)
        elements.append(Spacer(1, 0.3 * inch))
        cover_bg = ColoredRect(CONTENT_WIDTH, 3.8 * inch, BRAND_EMERALD_DARK, radius=16)
        elements.append(cover_bg)
        elements.append(Spacer(1, -3.5 * inch))

        if os.path.exists(self.logo_path):
            pass  # Logo removed per user request

        elements.append(Paragraph("Catálogo Completo<br/>de Servicios", styles['CoverTitle']))
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph("Personales · Empresariales · Todo en Un Solo Lugar", styles['CoverSubtitle']))
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(Paragraph(
            f"Preparado: {datetime.now().strftime('%B %Y')}",
            styles['CoverDate']
        ))

        elements.append(Spacer(1, 0.8 * inch))
        elements.append(Paragraph(
            "En Ross Tax Preparation ofrecemos servicios financieros integrales — "
            "desde tus impuestos personales hasta la contabilidad completa de tu negocio. "
            "Todo 100% bilingüe, con tecnología de punta y atención humana.",
            ParagraphStyle('CombWelcome', parent=styles['BodyText2'], alignment=TA_CENTER, fontSize=10, leading=14)
        ))

        elements.append(PageBreak())

        # ── Personal Services ──
        elements.append(Paragraph("👤 Servicios Personales — Detalle", styles['SectionTitle']))
        elements.append(Spacer(1, 0.1 * inch))
        for i, svc in enumerate(PERSONAL_SERVICES):
            elements.extend(self._build_service_block(svc, styles, i))

        elements.append(PageBreak())

        # ── Business Services ──
        elements.append(Paragraph("🏢 Servicios Empresariales — Detalle", styles['SectionTitle']))
        elements.append(Spacer(1, 0.1 * inch))
        for i, svc in enumerate(BUSINESS_SERVICES):
            elements.extend(self._build_service_block(svc, styles, i))

        # ── Price Tables ──
        elements.append(PageBreak())
        elements.extend(self._build_price_table(styles, "personal"))
        elements.append(Spacer(1, 0.3 * inch))
        elements.extend(self._build_price_table(styles, "business"))

        # CTA
        elements.extend(self._build_cta_section(styles))

        doc.build(elements, onFirstPage=self._add_page_background,
                  onLaterPages=self._add_page_background)

        buffer.seek(0)
        return buffer


# Singleton
portfolio_pdf_service = PortfolioPDFService()
