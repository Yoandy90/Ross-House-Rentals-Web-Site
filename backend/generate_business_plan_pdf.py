#!/usr/bin/env python3
"""
Ross Tax — Generador de PDF: Plan de Negocio y Estudio de Mercado de Bookkeeping
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable


# ── Brand Colors ──
BRAND_PRIMARY = HexColor("#1B3A5C")    # Dark navy
BRAND_ACCENT = HexColor("#2E86AB")     # Blue accent
BRAND_GREEN = HexColor("#28A745")      # Green for positive
BRAND_GOLD = HexColor("#F0AD4E")       # Gold/warning
BRAND_RED = HexColor("#DC3545")        # Red for alerts
BRAND_LIGHT_BG = HexColor("#F4F7FA")   # Light background
BRAND_LIGHT_BLUE = HexColor("#E8F4FD") # Light blue cells
BRAND_WHITE = white
BRAND_BLACK = black
BRAND_GRAY = HexColor("#6C757D")
BRAND_DARK_BG = HexColor("#212529")


class GradientRect(Flowable):
    """A colored rectangle as a section header background."""
    def __init__(self, width, height, color=BRAND_PRIMARY):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.color = color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=0)


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=32,
        textColor=BRAND_WHITE,
        alignment=TA_CENTER,
        spaceAfter=8,
        leading=38,
    ))
    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        fontName='Helvetica',
        fontSize=16,
        textColor=HexColor("#B0C4DE"),
        alignment=TA_CENTER,
        spaceAfter=6,
        leading=20,
    ))
    styles.add(ParagraphStyle(
        name='CoverDate',
        fontName='Helvetica-Oblique',
        fontSize=12,
        textColor=HexColor("#87CEEB"),
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=BRAND_PRIMARY,
        spaceBefore=20,
        spaceAfter=10,
        leading=22,
        borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        name='SubSectionTitle',
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=BRAND_ACCENT,
        spaceBefore=14,
        spaceAfter=6,
        leading=18,
    ))
    styles.add(ParagraphStyle(
        name='BodyText2',
        fontName='Helvetica',
        fontSize=10,
        textColor=BRAND_BLACK,
        alignment=TA_JUSTIFY,
        spaceBefore=2,
        spaceAfter=6,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name='BulletItem',
        fontName='Helvetica',
        fontSize=10,
        textColor=BRAND_BLACK,
        leftIndent=20,
        spaceBefore=2,
        spaceAfter=3,
        leading=13,
        bulletIndent=8,
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
        textColor=BRAND_BLACK,
        alignment=TA_CENTER,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='TableCellLeft',
        fontName='Helvetica',
        fontSize=9,
        textColor=BRAND_BLACK,
        alignment=TA_LEFT,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name='Highlight',
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=BRAND_PRIMARY,
        spaceBefore=6,
        spaceAfter=6,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name='SmallNote',
        fontName='Helvetica-Oblique',
        fontSize=8,
        textColor=BRAND_GRAY,
        alignment=TA_LEFT,
        spaceBefore=2,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name='FooterStyle',
        fontName='Helvetica',
        fontSize=8,
        textColor=BRAND_GRAY,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='KPIValue',
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=BRAND_ACCENT,
        alignment=TA_CENTER,
        leading=26,
    ))
    styles.add(ParagraphStyle(
        name='KPILabel',
        fontName='Helvetica',
        fontSize=9,
        textColor=BRAND_GRAY,
        alignment=TA_CENTER,
        leading=12,
    ))
    return styles


def make_table(data, col_widths=None, header_color=BRAND_PRIMARY):
    """Create a styled table."""
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle(style_cmds))
    return t


def add_section_header(elements, title, styles):
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=2, color=BRAND_ACCENT, spaceAfter=4))
    elements.append(Paragraph(title, styles['SectionTitle']))


def add_subsection(elements, title, styles):
    elements.append(Paragraph(title, styles['SubSectionTitle']))


def add_body(elements, text, styles):
    elements.append(Paragraph(text, styles['BodyText2']))


def add_bullet(elements, text, styles):
    elements.append(Paragraph(f"&bull;  {text}", styles['BulletItem']))


def add_spacer(elements, height=8):
    elements.append(Spacer(1, height))


def build_cover_page(elements, styles):
    """Build the cover page."""
    elements.append(Spacer(1, 1.5*inch))

    # Cover background block
    cover_data = [['']]
    cover_table = Table(cover_data, colWidths=[7*inch], rowHeights=[3.5*inch])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [12, 12, 12, 12]),
    ]))

    # We'll use a nested approach
    elements.append(Spacer(1, 0.5*inch))

    # Title block as colored table
    title_content = [
        [Paragraph("ROSS TAX", styles['CoverTitle'])],
        [Paragraph("Plan de Negocio &amp; Estudio de Mercado", styles['CoverSubtitle'])],
        [Spacer(1, 8)],
        [Paragraph("Servicios de Bookkeeping", styles['CoverSubtitle'])],
        [Paragraph('"Mi Negocio" — Contabilidad para Peque\u00f1os Negocios', styles['CoverDate'])],
        [Spacer(1, 20)],
        [Paragraph("Febrero 2026", styles['CoverDate'])],
        [Paragraph("Preparado para: Yoandy Ross", styles['CoverDate'])],
    ]
    title_table = Table(title_content, colWidths=[6.5*inch])
    title_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('ROUNDEDCORNERS', [12, 12, 12, 12]),
    ]))
    elements.append(title_table)
    elements.append(Spacer(1, 1*inch))

    # Confidential note
    elements.append(Paragraph(
        "CONFIDENCIAL — Solo para uso interno de Ross Tax",
        styles['SmallNote']
    ))
    elements.append(PageBreak())


def build_executive_summary(elements, styles):
    add_section_header(elements, "1. RESUMEN EJECUTIVO", styles)

    add_body(elements,
        "Ross Tax ya cuenta con una plataforma tecnol\u00f3gica completa (app m\u00f3vil iOS/Android + portal web + "
        "backend con inteligencia artificial) que incluye la funcionalidad <b>\"Mi Negocio\"</b> con integraci\u00f3n "
        "Plaid para sincronizaci\u00f3n bancaria autom\u00e1tica, escaneo de recibos con AI (OpenAI/Gemini), y "
        "generaci\u00f3n de reportes financieros.", styles)

    add_spacer(elements, 6)
    add_body(elements,
        "<b>La oportunidad:</b> Expandir los servicios actuales de preparaci\u00f3n de impuestos hacia un modelo de "
        "<b>ingresos recurrentes mensuales</b> a trav\u00e9s de servicios de bookkeeping, aprovechando la ventaja "
        "competitiva de ser una plataforma <b>100% biling\u00fce (espa\u00f1ol/ingl\u00e9s)</b> que sirve a la "
        "comunidad hispana empresarial en EE.UU.", styles)

    # KPI boxes
    add_spacer(elements, 12)
    kpi_data = [
        [Paragraph("$51K - $117K", styles['KPIValue']),
         Paragraph("$360K - $540K", styles['KPIValue']),
         Paragraph("70 - 75%", styles['KPIValue'])],
        [Paragraph("Proyecci\u00f3n A\u00f1o 1", styles['KPILabel']),
         Paragraph("Proyecci\u00f3n A\u00f1o 3", styles['KPILabel']),
         Paragraph("Margen de Ganancia", styles['KPILabel'])],
    ]
    kpi_table = Table(kpi_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_LIGHT_BLUE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1, BRAND_ACCENT),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    elements.append(kpi_table)
    add_spacer(elements)


def build_market_study(elements, styles):
    add_section_header(elements, "2. ESTUDIO DE MERCADO", styles)

    # 2.1 Market Size
    add_subsection(elements, "2.1 Tama\u00f1o del Mercado", styles)

    market_data = [
        ["Indicador", "Valor", "Fuente"],
        ["Mercado global bookkeeping (2026)", "$12.68 mil millones", "Business Research Insights"],
        ["Proyecci\u00f3n 2035", "$28.39 mil millones", "CAGR 9.37%"],
        ["Mercado US payroll/bookkeeping (2025)", "$76.5 mil millones", "IBISWorld"],
        ["Crecimiento anual US", "3.1% CAGR", "2020-2025"],
        ["Adopci\u00f3n online (2020-2024)", "+57%", "Market Reports World"],
        ["Mercado US startups contables (2026)", "$16.12 mil millones", "Grand View Research"],
    ]
    elements.append(make_table(market_data, col_widths=[2.5*inch, 2*inch, 2*inch]))

    # 2.2 Trends
    add_spacer(elements, 10)
    add_subsection(elements, "2.2 Tendencias Clave 2025-2026", styles)
    trends = [
        "<b>AI y Automatizaci\u00f3n:</b> Los sistemas categorizan transacciones, detectan duplicados y reconcilian bancos autom\u00e1ticamente. <i>Ross Tax YA tiene esto con Gemini/OpenAI.</i>",
        "<b>Reportes en Tiempo Real:</b> Los clientes esperan reportes instant\u00e1neos, no ciclos de 30 d\u00edas. <i>Ross Tax YA tiene dashboard en tiempo real con Plaid.</i>",
        "<b>Precios Basados en Valor:</b> El mercado se mueve de cobro por hora a paquetes mensuales fijos.",
        "<b>Servicios Virtuales:</b> Eliminan limitaciones geogr\u00e1ficas. <i>Ross Tax puede servir a nivel nacional.</i>",
        "<b>Especializaci\u00f3n por Nicho:</b> Las firmas especializadas (hispanos, construcci\u00f3n, ecommerce) cobran m\u00e1s y retienen mejor.",
    ]
    for t in trends:
        add_bullet(elements, t, styles)

    # 2.3 Hispanic market
    add_spacer(elements, 10)
    add_subsection(elements, "2.3 Oportunidad en el Mercado Hispano", styles)

    hisp_data = [
        ["Factor", "Dato"],
        ["Negocios hispanos en EE.UU.", "4.7+ millones (crecimiento m\u00e1s r\u00e1pido)"],
        ["Competidores biling\u00fces dedicados", "Menos de 20 firmas a nivel nacional"],
        ["Precio competidores hispanos", "$350-$500/mes (Ra\u00edces Bookkeeping)"],
        ["Brecha de mercado", "Mayor\u00eda limitados a regiones (FL, TX, MI)"],
        ["Factor de confianza", "Cultura y coraz\u00f3n \u2014 relaci\u00f3n personal e idioma"],
    ]
    elements.append(make_table(hisp_data, col_widths=[2.8*inch, 3.7*inch], header_color=BRAND_ACCENT))

    add_spacer(elements, 10)
    add_body(elements, "<b>Ventaja competitiva de Ross Tax:</b>", styles)
    advantages = [
        "Plataforma 100% biling\u00fce (app + web)",
        "AI integrada para escaneo de recibos (OpenAI + Gemini)",
        "Sincronizaci\u00f3n bancaria autom\u00e1tica (Plaid)",
        "Base de clientes de impuestos existente para upselling",
        "Infraestructura tecnol\u00f3gica lista \u2014 la mayor\u00eda de competidores hispanos NO tienen app propia",
    ]
    for a in advantages:
        add_bullet(elements, f"<font color='#28A745'>\u2713</font>  {a}", styles)


def build_competitor_analysis(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "3. AN\u00c1LISIS DE COMPETENCIA", styles)

    # Direct bilingual competitors
    add_subsection(elements, "3.1 Competidores Directos (Bookkeeping Biling\u00fce)", styles)

    comp_data = [
        ["Competidor", "Ubicaci\u00f3n", "Precio/Mes", "Tiene App?"],
        ["Ra\u00edces Bookkeeping", "Nacional (Virtual)", "$350-$500", "No"],
        ["Hispano Tax Service", "Tamarac/Doral, FL", "No publicado", "No"],
        ["RC Tax Service", "Orlando/Kissimmee, FL", "\"Asequible\"", "No"],
        ["Bilingual Bookkeeping", "DFW, TX", "No publicado", "No"],
        ["Hispanic Bookkeeping Svc", "Nacional", "No publicado", "No"],
    ]
    elements.append(make_table(comp_data, col_widths=[1.7*inch, 1.6*inch, 1.3*inch, 1*inch]))

    # Software competitors
    add_spacer(elements, 12)
    add_subsection(elements, "3.2 Competidores de Software/Plataforma", styles)

    soft_data = [
        ["Plataforma", "Precio/Mes", "Tipo", "Biling\u00fce?"],
        ["QuickBooks Online", "$25-$115", "DIY Software", "No"],
        ["FreshBooks", "$21-$33", "DIY Facturaci\u00f3n", "No"],
        ["Bench", "Basado en necesidad", "Servicio completo", "No"],
        ["Wave", "Gratis", "DIY B\u00e1sico", "No"],
        ["ROSS TAX", "$199-$699", "App + AI + Servicio", "S\u00cd"],
    ]
    soft_table = make_table(soft_data, col_widths=[1.5*inch, 1.3*inch, 1.5*inch, 1*inch])
    # Highlight last row
    soft_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#D4EDDA")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), BRAND_GREEN),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(soft_table)

    # Full service comparison
    add_spacer(elements, 12)
    add_subsection(elements, "3.3 Precios del Mercado General (No biling\u00fce)", styles)

    gen_data = [
        ["Servicio", "Precio/Mes", "Transacciones", "Incluye"],
        ["B\u00e1sico", "$200-$500", "<50/mes", "Datos, reconciliaciones, reportes"],
        ["Completo", "$500-$1,500", "50-200/mes", "+ AR/AP, cierre mensual"],
        ["Con Payroll", "$800-$2,000", "100-300/mes", "+ Payroll, HR"],
        ["Premium", "$1,000-$5,000+", "Ilimitadas", "+ Inventario, planificaci\u00f3n fiscal"],
    ]
    elements.append(make_table(gen_data, col_widths=[1.2*inch, 1.3*inch, 1.2*inch, 2.8*inch]))


def build_pricing_plan(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "4. PLAN DE PRECIOS RECOMENDADO", styles)

    add_body(elements, "Estructura de <b>3 Niveles + Add-ons</b>, dise\u00f1ada para ser competitiva en el mercado "
        "hispano mientras maximiza el valor de la tecnolog\u00eda AI integrada.", styles)

    # Plan Semilla
    add_spacer(elements, 10)
    seed_header = [["PLAN SEMILLA \u2014 $199/mes", ""]]
    seed_data = [
        ["Para:", "Freelancers, aut\u00f3nomos, negocios nuevos (<$100K ingresos)"],
        ["Transacciones", "Hasta 50 por mes"],
        ["Categorizaci\u00f3n AI", "Autom\u00e1tica con revisi\u00f3n mensual"],
        ["Reconciliaci\u00f3n bancaria", "1 cuenta bancaria"],
        ["Reporte P&L", "Mensual"],
        ["Escaneo de recibos", "Hasta 20/mes"],
        ["Soporte", "Chat en app + email (48h respuesta)"],
        ["Revisi\u00f3n", "Mensual"],
    ]
    seed_table = Table(seed_header + seed_data, colWidths=[2.2*inch, 4.3*inch])
    seed_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(seed_table)

    # Plan Crecimiento
    add_spacer(elements, 12)
    grow_header = [["PLAN CRECIMIENTO \u2014 $399/mes", ""]]
    grow_data = [
        ["Para:", "Negocios en crecimiento ($100K-$500K ingresos)"],
        ["Transacciones", "Hasta 200 por mes"],
        ["Categorizaci\u00f3n AI", "Autom\u00e1tica con revisi\u00f3n semanal"],
        ["Reconciliaci\u00f3n bancaria", "Hasta 3 cuentas bancarias"],
        ["Reportes", "P&L + Balance General + Flujo de Caja"],
        ["Escaneo de recibos", "Ilimitado"],
        ["Cuentas por cobrar/pagar", "Seguimiento b\u00e1sico"],
        ["Sales Tax Florida", "Preparaci\u00f3n mensual"],
        ["Soporte", "Chat + email (24h) + 1 llamada/mes"],
        ["Revisi\u00f3n", "Quincenal"],
    ]
    grow_table = Table(grow_header + grow_data, colWidths=[2.2*inch, 4.3*inch])
    grow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(grow_table)

    # Plan Empresarial
    add_spacer(elements, 12)
    ent_header = [["PLAN EMPRESARIAL \u2014 $699/mes", ""]]
    ent_data = [
        ["Para:", "Negocios establecidos ($500K+ ingresos, empleados)"],
        ["Transacciones", "Ilimitadas"],
        ["Categorizaci\u00f3n AI", "Autom\u00e1tica con revisi\u00f3n semanal"],
        ["Reconciliaci\u00f3n bancaria", "Cuentas ilimitadas"],
        ["Reportes", "Completos + KPIs + Dashboard tiempo real"],
        ["Escaneo de recibos", "Ilimitado"],
        ["Cuentas por cobrar/pagar", "Gesti\u00f3n completa"],
        ["Sales Tax", "Preparaci\u00f3n y presentaci\u00f3n"],
        ["Payroll", "Procesamiento mensual"],
        ["Consultor\u00eda financiera", "1 sesi\u00f3n 30min/mes"],
        ["Soporte", "Prioritario (mismo d\u00eda) + 2 llamadas/mes"],
        ["Revisi\u00f3n", "Semanal"],
    ]
    ent_table = Table(ent_header + ent_data, colWidths=[2.2*inch, 4.3*inch])
    ent_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(ent_table)

    # Add-ons
    elements.append(PageBreak())
    add_subsection(elements, "4.1 Add-ons (Servicios Adicionales)", styles)
    addon_data = [
        ["Servicio", "Precio"],
        ["Preparaci\u00f3n Impuestos Personal (1040)", "$200-$400 (descuento clientes bookkeeping)"],
        ["Preparaci\u00f3n Impuestos Negocio (1120/1065)", "$500-$1,000"],
        ["Payroll (si no est\u00e1 en plan)", "$75-$150/mes"],
        ["1099s (preparaci\u00f3n anual)", "$10/formulario"],
        ["Consultor\u00eda financiera adicional", "$125/hora"],
        ["Setup inicial / Cleanup", "$500-$2,500 (\u00fanico)"],
        ["Cuenta bancaria adicional", "$50/mes por cuenta"],
        ["Representaci\u00f3n ante IRS", "$250-$500"],
    ]
    elements.append(make_table(addon_data, col_widths=[2.8*inch, 3.7*inch], header_color=BRAND_GOLD))

    # Bundles
    add_spacer(elements, 12)
    add_subsection(elements, "4.2 Bundles Especiales: Bookkeeping + Impuestos", styles)
    bundle_data = [
        ["Bundle", "Precio/Mes", "Ahorro Anual"],
        ["Semilla + Impuestos Personal", "$249/mes (12 meses)", "~$150"],
        ["Crecimiento + Impuestos Negocio", "$479/mes (12 meses)", "~$300"],
        ["Empresarial + Impuestos Completo", "$799/mes (12 meses)", "~$500+"],
    ]
    elements.append(make_table(bundle_data, col_widths=[2.5*inch, 2*inch, 1.5*inch], header_color=BRAND_GREEN))
    add_spacer(elements, 6)
    add_body(elements, "<b>Estrategia:</b> Compromiso anual con descuento. Los clientes de impuestos existentes "
        "obtienen un <b>mes gratis</b> al suscribirse a cualquier plan de bookkeeping.", styles)


def build_frequency(elements, styles):
    add_spacer(elements, 12)
    add_section_header(elements, "5. FRECUENCIA DE SERVICIOS", styles)

    freq_data = [
        ["Actividad", "Semilla", "Crecimiento", "Empresarial"],
        ["Categorizaci\u00f3n transacciones", "Mensual", "Semanal", "Diario (AI)"],
        ["Reconciliaci\u00f3n bancaria", "Mensual", "Quincenal", "Semanal"],
        ["Reporte P&L", "Mensual", "Mensual", "Semanal"],
        ["Balance General", "Trimestral", "Mensual", "Mensual"],
        ["Flujo de Caja", "\u2014", "Mensual", "Semanal"],
        ["Sales Tax", "\u2014", "Mensual", "Mensual"],
        ["Payroll", "\u2014", "\u2014", "Quincenal/Mensual"],
        ["Revisi\u00f3n con contador", "Mensual", "Quincenal", "Semanal"],
        ["Cierre de libros", "Mensual", "Mensual", "Mensual"],
    ]
    elements.append(make_table(freq_data, col_widths=[2.2*inch, 1.4*inch, 1.5*inch, 1.5*inch]))


def build_financial_projections(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "6. PROYECCI\u00d3N FINANCIERA \u2014 A\u00d1O 1", styles)

    # Conservative
    add_subsection(elements, "6.1 Escenario Conservador", styles)
    cons_data = [
        ["Mes", "Semilla\n($199)", "Crecimiento\n($399)", "Empresarial\n($699)", "Ingreso/Mes", "Acumulado"],
        ["1-2", "3", "1", "0", "$996", "$1,992"],
        ["3-4", "5", "2", "1", "$2,492", "$6,976"],
        ["5-6", "8", "3", "1", "$3,488", "$13,952"],
        ["7-9", "10", "5", "2", "$5,383", "$30,101"],
        ["10-12", "12", "7", "3", "$7,178", "$51,635"],
    ]
    elements.append(make_table(cons_data, col_widths=[0.7*inch, 1*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch]))

    add_spacer(elements, 4)
    total_box = Table(
        [["Total A\u00f1o 1 (Conservador): $51,635"]],
        colWidths=[6.5*inch]
    )
    total_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_LIGHT_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('TEXTCOLOR', (0, 0), (-1, -1), BRAND_PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    elements.append(total_box)

    # Optimistic
    add_spacer(elements, 12)
    add_subsection(elements, "6.2 Escenario Optimista (con bundle de impuestos)", styles)
    opt_data = [
        ["Mes", "Semilla", "Crecimiento", "Empresarial", "Ingreso/Mes", "Acumulado"],
        ["1-2", "5", "3", "1", "$2,891", "$5,782"],
        ["3-4", "10", "5", "2", "$5,383", "$16,548"],
        ["5-6", "15", "8", "3", "$8,174", "$32,896"],
        ["7-9", "20", "12", "5", "$12,263", "$69,685"],
        ["10-12", "25", "15", "7", "$15,758", "$117,059"],
    ]
    elements.append(make_table(opt_data, col_widths=[0.7*inch, 1*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch]))

    add_spacer(elements, 4)
    total_box2 = Table(
        [["Total A\u00f1o 1 (Optimista): $117,059"]],
        colWidths=[6.5*inch]
    )
    total_box2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#D4EDDA")),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('TEXTCOLOR', (0, 0), (-1, -1), BRAND_GREEN),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    elements.append(total_box2)

    # Costs
    add_spacer(elements, 12)
    add_subsection(elements, "6.3 Costos Operativos Estimados A\u00f1o 1", styles)
    cost_data = [
        ["Concepto", "Costo/Mes", "Anual"],
        ["Plaid API (transacciones)", "$50-$200", "$600-$2,400"],
        ["OpenAI/Gemini (AI)", "$50-$150", "$600-$1,800"],
        ["Infraestructura (Railway)", "$50-$100", "$600-$1,200"],
        ["Software contable (QuickBooks)", "$50-$115", "$600-$1,380"],
        ["Bookkeeper asistente (part-time)", "$0-$2,000", "$0-$24,000"],
        ["Marketing/Publicidad", "$200-$500", "$2,400-$6,000"],
        ["TOTAL", "$400-$3,065", "$4,800-$36,780"],
    ]
    cost_table = make_table(cost_data, col_widths=[2.5*inch, 1.5*inch, 1.5*inch])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [BRAND_WHITE, BRAND_LIGHT_BG]),
        ('BACKGROUND', (0, -1), (-1, -1), BRAND_PRIMARY),
        ('TEXTCOLOR', (0, -1), (-1, -1), BRAND_WHITE),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(cost_table)

    # Margin
    add_spacer(elements, 12)
    add_subsection(elements, "6.4 Margen de Ganancia Estimado", styles)
    margin_data = [
        ["Escenario", "Ingresos", "Costos", "Ganancia", "Margen"],
        ["Conservador", "$51,635", "$15,000", "$36,635", "71%"],
        ["Optimista", "$117,059", "$30,000", "$87,059", "74%"],
    ]
    margin_table = make_table(margin_data, col_widths=[1.3*inch, 1.2*inch, 1.1*inch, 1.2*inch, 0.9*inch], header_color=BRAND_GREEN)
    elements.append(margin_table)
    add_spacer(elements, 4)
    add_body(elements, "<i>Los m\u00e1rgenes son altos porque la AI automatiza la mayor parte del trabajo que "
        "tradicionalmente requiere mano de obra.</i>", styles)


def build_acquisition_strategy(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "7. ESTRATEGIA DE ADQUISICI\u00d3N DE CLIENTES", styles)

    channels = [
        {
            "title": "Canal 1: Upselling a Clientes de Impuestos Existentes (M\u00e1s Efectivo)",
            "items": [
                "Contactar a TODOS los clientes de tax prep actuales por email/SMS",
                "Oferta: \"Primer mes GRATIS de bookkeeping para clientes de impuestos\"",
                "Conversi\u00f3n esperada: 15-25% de clientes de impuestos \u2192 bookkeeping",
                "Costo de adquisici\u00f3n: $0 (ya tienes la base de datos)",
            ]
        },
        {
            "title": "Canal 2: Redes Sociales y Comunidad Hispana",
            "items": [
                "Plataformas: Facebook Groups hispanos de negocios, Instagram, TikTok",
                "Contenido: Tips de contabilidad en espa\u00f1ol, \"\u00bfSab\u00edas que...?\" sobre deducciones",
                "Budget: $200-$500/mes en ads segmentados a empresarios hispanos",
            ]
        },
        {
            "title": "Canal 3: Programa de Referidos",
            "items": [
                "Programa: $50 descuento para quien refiere + $50 para el nuevo cliente",
                "Meta: 2-3 referidos por cliente activo por a\u00f1o",
            ]
        },
        {
            "title": "Canal 4: Alianzas con C\u00e1maras de Comercio Hispanas",
            "items": [
                "Asociarse con c\u00e1maras locales para ofrecer descuento a miembros",
                "Descuento: 10% en primer a\u00f1o para miembros de la c\u00e1mara",
            ]
        },
    ]

    for ch in channels:
        add_subsection(elements, ch["title"], styles)
        for item in ch["items"]:
            add_bullet(elements, item, styles)


def build_retention_strategy(elements, styles):
    add_spacer(elements, 12)
    add_section_header(elements, "8. ESTRATEGIA DE RETENCI\u00d3N \u2014 Meta: 90%+ anual", styles)

    ret_data = [
        ["Estrategia", "Implementaci\u00f3n"],
        ["Comunicaci\u00f3n constante", "Check-ins mensuales por app/email, reportes autom\u00e1ticos"],
        ["Onboarding excepcional", "Primer mes guiado, setup Plaid, demo de app"],
        ["Mostrar valor", "Dashboard en tiempo real con dinero ahorrado en deducciones"],
        ["Feedback activo", "Encuestas trimestrales de satisfacci\u00f3n en la app"],
        ["Programa de lealtad", "Descuento 5% despu\u00e9s de 12 meses continuos"],
        ["Relaci\u00f3n personal", "Llamadas en espa\u00f1ol, celebrar aniversarios de negocio"],
        ["Proactividad", "Alertas de gastos inusuales, recordatorios de deadlines"],
        ["F\u00e1cil de usar", "Todo desde la app, sin papeles ni desplazamientos"],
    ]
    elements.append(make_table(ret_data, col_widths=[2*inch, 4.5*inch], header_color=BRAND_ACCENT))


def build_competitive_advantage(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "9. VENTAJA COMPETITIVA", styles)

    adv_data = [
        ["Factor", "Ross Tax", "Ra\u00edces", "QuickBooks", "Bench", "Firmas Locales"],
        ["App m\u00f3vil propia", "\u2713 iOS+Android", "\u2717", "\u2713 (gen\u00e9rica)", "\u2717", "\u2717"],
        ["Biling\u00fce nativo", "\u2713 ES/EN", "\u2713 ES/EN", "\u2717", "\u2717", "Algunos"],
        ["AI integrada", "\u2713 OpenAI+Gemini", "\u2717", "\u2717", "\u2717", "\u2717"],
        ["Sinc. bancaria", "\u2713 Plaid", "\u2717", "\u2713", "\u2713", "\u2717"],
        ["Escaneo recibos AI", "\u2713", "\u2717", "\u2713 (limitado)", "\u2717", "\u2717"],
        ["Impuestos incluidos", "\u2713 Bundle", "\u2717", "\u2717", "\u2717", "Algunos"],
        ["Precio entrada", "$199/mes", "$350/mes", "$25/mes (DIY)", "N/A", "$300+/mes"],
        ["Dashboard real-time", "\u2713", "\u2717", "\u2713", "\u2717", "\u2717"],
    ]
    adv_table = Table(adv_data, colWidths=[1.3*inch, 1.1*inch, 0.9*inch, 1*inch, 0.8*inch, 1*inch])
    adv_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [BRAND_WHITE, BRAND_LIGHT_BG]),
        # Highlight Ross Tax column
        ('BACKGROUND', (1, 1), (1, -1), HexColor("#D4EDDA")),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, 1), (1, -1), BRAND_GREEN),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(adv_table)


def build_risks(elements, styles):
    add_spacer(elements, 16)
    add_section_header(elements, "10. RIESGOS Y MITIGACI\u00d3N", styles)

    risk_data = [
        ["Riesgo", "Prob.", "Impacto", "Mitigaci\u00f3n"],
        ["Pocos clientes iniciales", "Media", "Alto", "Primer mes gratis a clientes de impuestos"],
        ["Libros muy desordenados", "Alta", "Medio", "Fee de cleanup ($500-$2,500)"],
        ["Competencia baja precios", "Baja", "Medio", "Diferenciarse por tecnolog\u00eda (app + AI)"],
        ["Escalabilidad", "Media", "Alto", "AI maneja 80%+; contratar a 30 clientes"],
        ["Errores categorizaci\u00f3n AI", "Media", "Alto", "Revisi\u00f3n humana obligatoria"],
    ]
    elements.append(make_table(risk_data, col_widths=[1.8*inch, 0.7*inch, 0.8*inch, 3.2*inch]))


def build_roadmap(elements, styles):
    add_spacer(elements, 16)
    add_section_header(elements, "11. ROADMAP DE IMPLEMENTACI\u00d3N", styles)

    phases = [
        {
            "title": "Fase 1: Preparaci\u00f3n (Mes 1-2)",
            "color": BRAND_ACCENT,
            "items": [
                "Definir planes y precios finales",
                "Crear p\u00e1gina de bookkeeping en la app y webapp",
                "Implementar sistema de suscripci\u00f3n/cobro recurrente",
                "Crear flujo de onboarding de bookkeeping en la app",
                "Preparar materiales de marketing biling\u00fces",
            ]
        },
        {
            "title": "Fase 2: Lanzamiento Soft (Mes 3-4)",
            "color": BRAND_GREEN,
            "items": [
                "Contactar 20-30 clientes de impuestos como beta",
                "Ofrecer primer mes gratis",
                "Recopilar feedback y ajustar",
                "Refinar flujos de la app basado en uso real",
            ]
        },
        {
            "title": "Fase 3: Lanzamiento Completo (Mes 5-6)",
            "color": BRAND_GOLD,
            "items": [
                "Campa\u00f1a de email/SMS a toda la base de clientes",
                "Lanzar ads en redes sociales",
                "Activar programa de referidos",
                "Publicar versi\u00f3n con bookkeeping prominente en App Store/Play Store",
            ]
        },
        {
            "title": "Fase 4: Escalamiento (Mes 7-12)",
            "color": BRAND_PRIMARY,
            "items": [
                "Contratar bookkeeper adicional si >30 clientes",
                "Expandir a nuevos mercados geogr\u00e1ficos (virtual)",
                "Desarrollar funciones avanzadas (forecasting, advisory)",
                "Evaluar plan CFO Fraccional ($1,500-$3,000/mes)",
            ]
        },
    ]

    for phase in phases:
        add_subsection(elements, phase["title"], styles)
        for item in phase["items"]:
            add_bullet(elements, item, styles)
        add_spacer(elements, 4)


def build_conclusions(elements, styles):
    elements.append(PageBreak())
    add_section_header(elements, "12. CONCLUSIONES Y RECOMENDACIONES", styles)

    conclusions = [
        "<b>Precio recomendado de entrada: $199/mes</b> \u2014 Por debajo de la competencia biling\u00fce ($350+) para capturar mercado r\u00e1pidamente con la ventaja tecnol\u00f3gica.",
        "<b>Estrategia de bundle: Bookkeeping + Impuestos</b> \u2014 Ofrece el mayor valor y compromiso anual (lock-in).",
        "<b>Canal #1 de ventas: Clientes existentes de impuestos</b> \u2014 Costo $0 de adquisici\u00f3n, alta confianza ya establecida.",
        "<b>Diferenciador clave: App con AI</b> \u2014 Ning\u00fan competidor biling\u00fce tiene app propia con inteligencia artificial integrada.",
        "<b>Frecuencia de servicio:</b> Mensual para plan b\u00e1sico, semanal para premium.",
        "<b>Meta A\u00f1o 1:</b> 25-50 clientes de bookkeeping = $50K-$117K en ingresos recurrentes.",
        "<b>Margen esperado: 70-75%</b> \u2014 Gracias a la automatizaci\u00f3n con AI que reduce costos operativos significativamente.",
    ]

    for i, c in enumerate(conclusions, 1):
        add_body(elements, f"<b>{i}.</b> {c}", styles)
        add_spacer(elements, 4)

    # Final box
    add_spacer(elements, 20)
    final_data = [
        [Paragraph("<b>Ross Tax tiene una ventaja \u00fanica en el mercado:</b><br/>"
            "La combinaci\u00f3n de tecnolog\u00eda AI, plataforma biling\u00fce, y base de clientes "
            "existente posiciona a Ross Tax como el l\u00edder potencial en servicios de bookkeeping "
            "para la comunidad hispana empresarial en Estados Unidos.",
            ParagraphStyle(
                'FinalBox',
                fontName='Helvetica',
                fontSize=11,
                textColor=BRAND_PRIMARY,
                alignment=TA_CENTER,
                leading=16,
            )
        )]
    ]
    final_table = Table(final_data, colWidths=[6*inch])
    final_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BRAND_LIGHT_BLUE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ('BOX', (0, 0), (-1, -1), 2, BRAND_ACCENT),
    ]))
    elements.append(final_table)

    # Sources
    add_spacer(elements, 20)
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_GRAY))
    add_spacer(elements, 6)
    add_body(elements, "<i>Fuentes: IBISWorld, Grand View Research, Business Research Insights, NerdWallet, "
        "Clutch.co, Relay Financial, Orbit Accountants, Ra\u00edces Bookkeeping, Fractional CFO School, "
        "an\u00e1lisis de competidores directos en el mercado hispano de EE.UU.</i>", styles)
    add_spacer(elements, 4)
    add_body(elements, "<i>Documento confidencial \u2014 Ross Tax \u2014 Febrero 2026</i>", styles)


def add_page_number(canvas, doc):
    """Add page number and footer to each page."""
    page_num = canvas.getPageNumber()
    if page_num > 1:  # Skip cover page
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(BRAND_GRAY)
        canvas.drawCentredString(
            letter[0] / 2, 0.4*inch,
            f"Ross Tax \u2014 Plan de Negocio Bookkeeping \u2014 P\u00e1gina {page_num}"
        )
        # Top line
        canvas.setStrokeColor(BRAND_ACCENT)
        canvas.setLineWidth(1.5)
        canvas.line(0.75*inch, letter[1] - 0.5*inch, letter[0] - 0.75*inch, letter[1] - 0.5*inch)


def generate_pdf():
    output_path = "/app/backend/static/ross_tax_bookkeeping_plan.pdf"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title="Ross Tax - Plan de Negocio Bookkeeping",
        author="Ross Tax",
    )

    styles = build_styles()
    elements = []

    # Build all sections
    build_cover_page(elements, styles)
    build_executive_summary(elements, styles)
    build_market_study(elements, styles)
    build_competitor_analysis(elements, styles)
    build_pricing_plan(elements, styles)
    build_frequency(elements, styles)
    build_financial_projections(elements, styles)
    build_acquisition_strategy(elements, styles)
    build_retention_strategy(elements, styles)
    build_competitive_advantage(elements, styles)
    build_risks(elements, styles)
    build_roadmap(elements, styles)
    build_conclusions(elements, styles)

    doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generated: {output_path}")
    return output_path


if __name__ == "__main__":
    generate_pdf()
