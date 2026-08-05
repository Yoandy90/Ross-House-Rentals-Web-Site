#!/usr/bin/env python3
"""
Ross Financial Services LLC — Complete Brand Identity Guide
Generates a professional PDF branding guide and emails it.
"""

import os
import sys
import base64
from datetime import datetime

# Install reportlab if needed
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.units import inch, mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.graphics.shapes import Drawing, Rect, Circle, String
    from reportlab.graphics import renderPDF
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
except ImportError:
    os.system("pip install reportlab")
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.units import inch, mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.graphics.shapes import Drawing, Rect, Circle, String
    from reportlab.graphics import renderPDF
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


# ═══════════════════════════════════════════
# Brand Colors
# ═══════════════════════════════════════════
BRAND = {
    "primary": "#0A5C36",        # Forest Green - Confianza, dinero, estabilidad
    "primary_light": "#10B981",  # Emerald - Fresco, moderno
    "primary_dark": "#064E2B",   # Dark Forest - Elegancia
    "secondary": "#1E3A5F",      # Navy Blue - Profesionalismo, autoridad
    "secondary_light": "#3B82F6",# Bright Blue - Tecnología, innovación
    "accent": "#D4AF37",         # Gold - Premium, prosperidad
    "accent_light": "#F59E0B",   # Amber - Energía, optimismo
    "success": "#059669",        # Green - Éxito, aprobación
    "warning": "#F59E0B",        # Amber - Atención
    "error": "#DC2626",          # Red - Alerta
    "bg_light": "#F8FAF9",       # Light mint bg
    "bg_dark": "#0F172A",        # Dark navy bg
    "text_primary": "#1A1A2E",   # Almost black
    "text_secondary": "#4A5568", # Gray
    "text_light": "#9CA3AF",     # Light gray
    "white": "#FFFFFF",
}

def create_color_swatch(color_hex, width=60, height=40):
    """Create a color swatch drawing"""
    d = Drawing(width, height)
    d.add(Rect(0, 0, width, height, fillColor=HexColor(color_hex), strokeColor=HexColor("#E5E7EB"), strokeWidth=0.5))
    return d


def generate_branding_pdf(output_path):
    """Generate the complete branding guide PDF"""
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50,
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'BrandTitle', parent=styles['Title'],
        fontSize=32, textColor=HexColor(BRAND["primary"]),
        spaceAfter=8, fontName='Helvetica-Bold',
        alignment=TA_CENTER,
    )
    
    subtitle_style = ParagraphStyle(
        'BrandSubtitle', parent=styles['Normal'],
        fontSize=14, textColor=HexColor(BRAND["secondary"]),
        spaceAfter=20, fontName='Helvetica',
        alignment=TA_CENTER,
    )
    
    h1_style = ParagraphStyle(
        'H1', parent=styles['Heading1'],
        fontSize=22, textColor=HexColor(BRAND["primary"]),
        spaceBefore=20, spaceAfter=12, fontName='Helvetica-Bold',
        borderPadding=(0, 0, 8, 0),
    )
    
    h2_style = ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontSize=16, textColor=HexColor(BRAND["secondary"]),
        spaceBefore=16, spaceAfter=8, fontName='Helvetica-Bold',
    )
    
    h3_style = ParagraphStyle(
        'H3', parent=styles['Heading3'],
        fontSize=13, textColor=HexColor(BRAND["primary_dark"]),
        spaceBefore=10, spaceAfter=6, fontName='Helvetica-Bold',
    )
    
    body_style = ParagraphStyle(
        'BrandBody', parent=styles['Normal'],
        fontSize=11, textColor=HexColor(BRAND["text_primary"]),
        spaceAfter=8, fontName='Helvetica', leading=16,
        alignment=TA_JUSTIFY,
    )
    
    body_center = ParagraphStyle(
        'BrandBodyCenter', parent=body_style,
        alignment=TA_CENTER,
    )
    
    caption_style = ParagraphStyle(
        'Caption', parent=styles['Normal'],
        fontSize=9, textColor=HexColor(BRAND["text_secondary"]),
        spaceAfter=4, fontName='Helvetica-Oblique',
    )
    
    bullet_style = ParagraphStyle(
        'BrandBullet', parent=body_style,
        leftIndent=20, bulletIndent=8,
        spaceBefore=2, spaceAfter=4,
    )
    
    quote_style = ParagraphStyle(
        'Quote', parent=body_style,
        leftIndent=30, rightIndent=30,
        fontSize=12, fontName='Helvetica-Oblique',
        textColor=HexColor(BRAND["secondary"]),
        alignment=TA_CENTER,
        spaceBefore=12, spaceAfter=12,
    )
    
    story = []
    
    # ═══════════════════════════════════════════
    # PAGE 1: COVER
    # ═══════════════════════════════════════════
    story.append(Spacer(1, 100))
    
    # Logo representation
    logo_drawing = Drawing(400, 80)
    logo_drawing.add(Rect(0, 0, 400, 80, fillColor=HexColor(BRAND["primary"]), strokeWidth=0, rx=10, ry=10))
    logo_drawing.add(String(30, 45, "ROSS", fontSize=36, fontName='Helvetica-Bold', fillColor=white))
    logo_drawing.add(String(30, 18, "FINANCIAL SERVICES", fontSize=18, fontName='Helvetica', fillColor=HexColor(BRAND["accent"])))
    logo_drawing.add(Rect(370, 20, 3, 40, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))
    story.append(logo_drawing)
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("Guía Completa de Identidad de Marca", subtitle_style))
    story.append(Spacer(1, 8))
    
    divider = HRFlowable(width="60%", thickness=2, color=HexColor(BRAND["accent"]), spaceBefore=10, spaceAfter=10)
    story.append(divider)
    
    story.append(Paragraph("Brand Identity Guide 2025", ParagraphStyle(
        'CoverYear', parent=body_center,
        fontSize=12, textColor=HexColor(BRAND["text_light"]),
    )))
    
    story.append(Spacer(1, 60))
    
    cover_info = [
        ["Empresa:", "Ross Financial Services LLC"],
        ["Industria:", "Credit Access Business (CAB) — Texas"],
        ["Fundador:", "Yoandy Ross"],
        ["Fecha:", datetime.now().strftime("%B %Y")],
        ["Versión:", "1.0"],
    ]
    
    cover_table = Table(cover_info, colWidths=[120, 300])
    cover_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (1, 0), (1, -1), HexColor(BRAND["text_primary"])),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
    ]))
    story.append(cover_table)
    
    story.append(Spacer(1, 40))
    story.append(Paragraph("CONFIDENCIAL — Solo para uso interno", ParagraphStyle(
        'Confidential', parent=body_center,
        fontSize=9, textColor=HexColor(BRAND["error"]),
        fontName='Helvetica-Bold',
    )))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # PAGE 2: TABLE OF CONTENTS
    # ═══════════════════════════════════════════
    story.append(Paragraph("Contenido", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    toc_items = [
        "1. Visión y Misión de la Marca",
        "2. Paleta de Colores Principal",
        "3. Paleta de Colores Secundaria y Funcional",
        "4. Tipografía",
        "5. Logotipo y Variaciones",
        "6. Iconografía y Elementos Gráficos",
        "7. Tono de Voz y Mensajería",
        "8. Aplicaciones: Tarjetas de Presentación",
        "9. Aplicaciones: Papelería y Documentos",
        "10. Aplicaciones: Digital y Redes Sociales",
        "11. Aplicaciones: Señalización y Oficina",
        "12. Combinaciones de Color Prohibidas",
        "13. Checklist de Lanzamiento",
    ]
    
    for item in toc_items:
        story.append(Paragraph(item, ParagraphStyle(
            'TOC', parent=body_style,
            fontSize=13, spaceBefore=6, spaceAfter=6,
            leftIndent=20,
        )))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 1: VISION & MISSION
    # ═══════════════════════════════════════════
    story.append(Paragraph("1. Visión y Misión", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Misión", h2_style))
    story.append(Paragraph(
        "Facilitar el acceso a servicios financieros justos y transparentes para la comunidad hispana "
        "en Texas, combinando tecnología innovadora con un servicio personalizado y de confianza.",
        body_style
    ))
    
    story.append(Paragraph("Visión", h2_style))
    story.append(Paragraph(
        "Ser la empresa de servicios financieros de referencia para la comunidad latina en Texas, "
        "reconocida por nuestra integridad, tecnología de punta y compromiso con el éxito financiero "
        "de nuestros clientes.",
        body_style
    ))
    
    story.append(Paragraph("Valores de Marca", h2_style))
    
    values = [
        ["Confianza", "Cada transacción, cada contrato, cada interacción refleja honestidad y transparencia total."],
        ["Accesibilidad", "Servicios financieros que son fáciles de entender y accesibles para todos."],
        ["Innovación", "Tecnología de punta (app móvil, pagos automáticos) al servicio del cliente."],
        ["Comunidad", "Comprometidos con el crecimiento económico de la comunidad hispana."],
        ["Profesionalismo", "Cumplimiento total con regulaciones OCCC y estándares bancarios."],
    ]
    
    for val_name, val_desc in values:
        story.append(Paragraph(f"<b>• {val_name}:</b> {val_desc}", bullet_style))
    
    story.append(Spacer(1, 15))
    story.append(Paragraph(
        '"Tu éxito financiero es nuestro compromiso"',
        quote_style
    ))
    
    story.append(Paragraph("Propuesta de Valor Única (USP)", h2_style))
    story.append(Paragraph(
        "Ross Financial Services combina la confianza de un negocio local con tecnología de nivel bancario. "
        "Nuestros clientes acceden a préstamos CAB directamente desde su teléfono, con contratos transparentes, "
        "pagos automáticos, y soporte bilingüe 24/7 — todo respaldado por la reputación de la familia Ross.",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 2: PRIMARY COLOR PALETTE
    # ═══════════════════════════════════════════
    story.append(Paragraph("2. Paleta de Colores Principal", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph(
        "Los colores principales representan los pilares de la marca: verde para confianza y prosperidad financiera, "
        "azul navy para profesionalismo y autoridad, y dorado para excelencia premium.",
        body_style
    ))
    
    story.append(Spacer(1, 10))
    
    # Primary colors table
    primary_colors = [
        ["", "Nombre", "HEX", "RGB", "Uso Principal"],
        [create_color_swatch(BRAND["primary"]), "Forest Green\n(Primario)", BRAND["primary"], "10, 92, 54", "Logo, encabezados,\nbotones principales"],
        [create_color_swatch(BRAND["primary_light"]), "Emerald\n(Primario Claro)", BRAND["primary_light"], "16, 185, 129", "Acentos, íconos,\nestados activos"],
        [create_color_swatch(BRAND["primary_dark"]), "Dark Forest\n(Primario Oscuro)", BRAND["primary_dark"], "6, 78, 43", "Fondos oscuros,\ntexto sobre claro"],
        [create_color_swatch(BRAND["secondary"]), "Navy Blue\n(Secundario)", BRAND["secondary"], "30, 58, 95", "Texto formal,\nsecciones alternas"],
        [create_color_swatch(BRAND["accent"]), "Gold\n(Acento)", BRAND["accent"], "212, 175, 55", "Detalles premium,\nbordos, badges"],
    ]
    
    color_table = Table(primary_colors, colWidths=[70, 100, 70, 90, 120])
    color_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(color_table)
    
    story.append(Spacer(1, 15))
    story.append(Paragraph("Proporciones de Uso", h3_style))
    
    # Usage proportion bar
    prop_drawing = Drawing(450, 50)
    prop_drawing.add(Rect(0, 10, 225, 30, fillColor=HexColor(BRAND["primary"]), strokeWidth=0))  # 50%
    prop_drawing.add(Rect(225, 10, 112, 30, fillColor=HexColor(BRAND["secondary"]), strokeWidth=0))  # 25%
    prop_drawing.add(Rect(337, 10, 68, 30, fillColor=HexColor(BRAND["primary_light"]), strokeWidth=0))  # 15%
    prop_drawing.add(Rect(405, 10, 45, 30, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))  # 10%
    prop_drawing.add(String(90, 20, "50%", fontSize=12, fontName='Helvetica-Bold', fillColor=white))
    prop_drawing.add(String(268, 20, "25%", fontSize=11, fontName='Helvetica-Bold', fillColor=white))
    prop_drawing.add(String(358, 20, "15%", fontSize=10, fontName='Helvetica-Bold', fillColor=white))
    prop_drawing.add(String(418, 20, "10%", fontSize=9, fontName='Helvetica-Bold', fillColor=white))
    story.append(prop_drawing)
    
    prop_legend = [
        ["Forest Green: 50%", "Navy Blue: 25%", "Emerald: 15%", "Gold: 10%"],
    ]
    prop_table = Table(prop_legend, colWidths=[112, 112, 112, 112])
    prop_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TEXTCOLOR', (0, 0), (-1, -1), HexColor(BRAND["text_secondary"])),
    ]))
    story.append(prop_table)
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 3: SECONDARY & FUNCTIONAL COLORS
    # ═══════════════════════════════════════════
    story.append(Paragraph("3. Colores Secundarios y Funcionales", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    func_colors = [
        ["", "Nombre", "HEX", "RGB", "Uso"],
        [create_color_swatch(BRAND["success"]), "Success Green", BRAND["success"], "5, 150, 105", "Pagos exitosos, aprobaciones"],
        [create_color_swatch(BRAND["warning"]), "Warning Amber", BRAND["warning"], "245, 158, 11", "Pagos pendientes, alertas"],
        [create_color_swatch(BRAND["error"]), "Error Red", BRAND["error"], "220, 38, 38", "Errores, pagos vencidos"],
        [create_color_swatch(BRAND["secondary_light"]), "Info Blue", BRAND["secondary_light"], "59, 130, 246", "Información, links, CTAs"],
        [create_color_swatch(BRAND["bg_light"]), "Background Light", BRAND["bg_light"], "248, 250, 249", "Fondo principal claro"],
        [create_color_swatch(BRAND["bg_dark"]), "Background Dark", BRAND["bg_dark"], "15, 23, 42", "Modo oscuro, headers"],
        [create_color_swatch(BRAND["text_primary"]), "Text Primary", BRAND["text_primary"], "26, 26, 46", "Texto principal"],
        [create_color_swatch(BRAND["text_secondary"]), "Text Secondary", BRAND["text_secondary"], "74, 85, 104", "Texto secundario, labels"],
        [create_color_swatch(BRAND["text_light"]), "Text Light", BRAND["text_light"], "156, 163, 175", "Placeholders, captions"],
    ]
    
    func_table = Table(func_colors, colWidths=[70, 100, 70, 100, 120])
    func_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["secondary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(func_table)
    
    story.append(Spacer(1, 15))
    story.append(Paragraph("Gradientes Aprobados", h3_style))
    
    gradients = [
        ["Gradiente", "De", "A", "Uso"],
        ["Principal", BRAND["primary"], BRAND["primary_light"], "Headers, banners, CTAs"],
        ["Premium", BRAND["primary_dark"], BRAND["accent"], "Secciones VIP, contratos"],
        ["Profesional", BRAND["secondary"], BRAND["secondary_light"], "Fondos corporativos"],
        ["Energético", BRAND["primary_light"], BRAND["accent_light"], "Promociones, campañas"],
    ]
    
    grad_table = Table(gradients, colWidths=[90, 100, 100, 160])
    grad_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary_dark"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(grad_table)
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 4: TYPOGRAPHY
    # ═══════════════════════════════════════════
    story.append(Paragraph("4. Tipografía", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Familia Tipográfica Principal", h2_style))
    story.append(Paragraph(
        "<b>Inter</b> — Nuestra fuente principal para todo el ecosistema digital (app, web, emails). "
        "Es moderna, altamente legible y tiene excelente soporte para caracteres en español (acentos, ñ).",
        body_style
    ))
    
    typo_data = [
        ["Elemento", "Fuente", "Peso", "Tamaño", "Ejemplo"],
        ["H1 - Títulos", "Inter", "Bold (700)", "28-32px", "Tus Préstamos"],
        ["H2 - Subtítulos", "Inter", "SemiBold (600)", "20-24px", "Detalles del Préstamo"],
        ["H3 - Secciones", "Inter", "SemiBold (600)", "16-18px", "Calendario de Pagos"],
        ["Body - Texto", "Inter", "Regular (400)", "14-16px", "Tu pago mensual es de..."],
        ["Caption - Notas", "Inter", "Regular (400)", "11-12px", "Última actualización"],
        ["Button - CTAs", "Inter", "SemiBold (600)", "14-16px", "PAGAR AHORA"],
        ["Numbers - Montos", "Inter", "Bold (700)", "24-32px", "$1,500.00"],
    ]
    
    typo_table = Table(typo_data, colWidths=[90, 60, 90, 70, 140])
    typo_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(typo_table)
    
    story.append(Spacer(1, 12))
    story.append(Paragraph("Tipografía Secundaria (Impresos)", h2_style))
    story.append(Paragraph(
        "<b>Montserrat</b> — Para materiales impresos (tarjetas de presentación, contratos, flyers). "
        "Es elegante y profesional con excelente legibilidad en papel.",
        body_style
    ))
    
    story.append(Paragraph("Tipografía para Montos y Números", h2_style))
    story.append(Paragraph(
        "<b>Inter (Tabular Numbers)</b> — Siempre usar números tabulares para montos de dinero. "
        "Esto asegura que los dígitos se alineen perfectamente en tablas y calendarios de pago. "
        "Formato: siempre usar comas para miles y punto para decimales ($1,500.00).",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 5: LOGO
    # ═══════════════════════════════════════════
    story.append(Paragraph("5. Logotipo y Variaciones", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Concepto del Logo", h2_style))
    story.append(Paragraph(
        "El logotipo de Ross Financial Services combina la solidez de la tipografía serif/sans-serif con "
        "un ícono que representa crecimiento financiero y protección. La barra dorada vertical simboliza "
        "la conexión entre el nombre Ross (tradición) y Financial Services (innovación).",
        body_style
    ))
    
    # Logo variations
    story.append(Paragraph("Variación Principal (Fondo Claro)", h3_style))
    logo1 = Drawing(400, 60)
    logo1.add(Rect(0, 0, 400, 60, fillColor=white, strokeColor=HexColor("#E5E7EB"), strokeWidth=1))
    logo1.add(String(20, 30, "ROSS", fontSize=28, fontName='Helvetica-Bold', fillColor=HexColor(BRAND["primary"])))
    logo1.add(String(20, 10, "FINANCIAL SERVICES", fontSize=14, fontName='Helvetica', fillColor=HexColor(BRAND["secondary"])))
    logo1.add(Rect(350, 10, 3, 40, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))
    story.append(logo1)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Variación Inversa (Fondo Oscuro)", h3_style))
    logo2 = Drawing(400, 60)
    logo2.add(Rect(0, 0, 400, 60, fillColor=HexColor(BRAND["primary_dark"]), strokeWidth=0, rx=4))
    logo2.add(String(20, 30, "ROSS", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    logo2.add(String(20, 10, "FINANCIAL SERVICES", fontSize=14, fontName='Helvetica', fillColor=HexColor(BRAND["accent"])))
    logo2.add(Rect(350, 10, 3, 40, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))
    story.append(logo2)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Variación Compacta (Icono)", h3_style))
    logo3 = Drawing(200, 60)
    logo3.add(Rect(0, 0, 60, 60, fillColor=HexColor(BRAND["primary"]), strokeWidth=0, rx=12))
    logo3.add(String(12, 32, "RF", fontSize=24, fontName='Helvetica-Bold', fillColor=white))
    logo3.add(String(12, 14, "S", fontSize=14, fontName='Helvetica', fillColor=HexColor(BRAND["accent"])))
    logo3.add(String(75, 35, "Uso: App icon, favicon,", fontSize=10, fontName='Helvetica', fillColor=HexColor(BRAND["text_secondary"])))
    logo3.add(String(75, 20, "perfiles de redes sociales", fontSize=10, fontName='Helvetica', fillColor=HexColor(BRAND["text_secondary"])))
    story.append(logo3)
    
    story.append(Spacer(1, 12))
    story.append(Paragraph("Zona de Protección", h3_style))
    story.append(Paragraph(
        "El logo siempre debe tener un espacio mínimo de protección equivalente a la altura de la letra 'R' "
        "en todas las direcciones. Ningún otro elemento gráfico o texto debe invadir esta zona.",
        body_style
    ))
    
    story.append(Paragraph("Tamaño Mínimo", h3_style))
    story.append(Paragraph(
        "• Digital: Ancho mínimo de 120px<br/>"
        "• Impreso: Ancho mínimo de 1.5 pulgadas (38mm)<br/>"
        "• Icono compacto: Mínimo 32x32px",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 6: ICONOGRAPHY
    # ═══════════════════════════════════════════
    story.append(Paragraph("6. Iconografía y Elementos Gráficos", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Biblioteca de Íconos: Ionicons", h2_style))
    story.append(Paragraph(
        "Usamos Ionicons como nuestra biblioteca principal de íconos, consistente con la app móvil. "
        "Los íconos deben usar los colores de marca y mantener un estilo 'outline' para estados normales "
        "y 'filled' para estados activos.",
        body_style
    ))
    
    icons_data = [
        ["Concepto", "Ícono", "Color", "Uso"],
        ["Préstamos", "wallet / wallet-outline", BRAND["primary"], "Sección de préstamos CAB"],
        ["Pagos", "card / card-outline", BRAND["secondary_light"], "Métodos de pago, auto-pay"],
        ["Contratos", "document-text / document-text-outline", BRAND["secondary"], "Contratos legales"],
        ["Aprobado", "checkmark-circle", BRAND["success"], "Pagos exitosos, aprobaciones"],
        ["Pendiente", "time-outline", BRAND["warning"], "Pagos pendientes"],
        ["Alertas", "alert-circle", BRAND["error"], "Pagos vencidos, errores"],
        ["Dinero", "cash-outline", BRAND["primary_light"], "Montos, balances"],
        ["Calendario", "calendar-outline", BRAND["secondary_light"], "Fechas de pago"],
        ["Seguridad", "shield-checkmark", BRAND["primary"], "Seguridad, encriptación"],
        ["Soporte", "chatbubbles", BRAND["secondary_light"], "Chat, ayuda"],
    ]
    
    icons_table = Table(icons_data, colWidths=[80, 160, 70, 140])
    icons_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(icons_table)
    
    story.append(Spacer(1, 12))
    story.append(Paragraph("Elementos Gráficos", h2_style))
    story.append(Paragraph(
        "• <b>Bordes redondeados:</b> Radio de 12-16px en tarjetas, 8px en botones<br/>"
        "• <b>Sombras:</b> Sutiles (0, 2, 8, rgba(0,0,0,0.05)) — nunca agresivas<br/>"
        "• <b>Barras de progreso:</b> Siempre en Emerald (#10B981) sobre gris (#E5E7EB)<br/>"
        "• <b>Badges de estado:</b> Fondo suave del color + texto en el color sólido<br/>"
        "• <b>Separadores:</b> 1px en #F3F4F6, nunca en negro puro",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 7: TONE OF VOICE
    # ═══════════════════════════════════════════
    story.append(Paragraph("7. Tono de Voz y Mensajería", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Personalidad de Marca", h2_style))
    
    personality = [
        ["Atributo", "Somos", "No Somos"],
        ["Tono", "Cálido y profesional", "Frío o demasiado casual"],
        ["Lenguaje", "Claro, bilingüe (ES/EN)", "Técnico o jerga financiera"],
        ["Actitud", "Empoderador, guía", "Condescendiente"],
        ["Comunicación", "Transparente, directa", "Ambigua o con letra pequeña"],
        ["Humor", "Sutil, positivo", "Sarcástico o forzado"],
    ]
    
    pers_table = Table(personality, colWidths=[100, 180, 180])
    pers_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(pers_table)
    
    story.append(Paragraph("Taglines y Slogans", h2_style))
    
    taglines = [
        '"Tu éxito financiero es nuestro compromiso"  — Tagline principal',
        '"Acceso financiero para todos"  — Versión corta',
        '"Your Financial Success, Our Commitment"  — English version',
        '"Préstamos justos, tecnología inteligente"  — Campaña digital',
        '"De la comunidad, para la comunidad"  — Mensaje comunitario',
    ]
    for t in taglines:
        story.append(Paragraph(f"• {t}", bullet_style))
    
    story.append(Paragraph("Ejemplos de Mensajería", h2_style))
    
    msg_examples = [
        ["Situación", "Mensaje Correcto ✅", "Mensaje Incorrecto ❌"],
        ["Pago exitoso", '"¡Pago procesado! Tu balance\nse ha actualizado."', '"Transacción completada.\nRef: TXN-28394."'],
        ["Pago pendiente", '"Tu pago de $269.45 vence\nel viernes. ¿Necesitas ayuda?"', '"AVISO: Pago pendiente.\nEvite recargos."'],
        ["Bienvenida", '"¡Bienvenido a Ross Financial!\nEstamos aquí para ayudarte."', '"Su cuenta ha sido creada\nen el sistema."'],
        ["Aprobación", '"¡Felicidades! Tu préstamo\nha sido aprobado."', '"Solicitud #4582 aprobada.\nRevise términos."'],
    ]
    
    msg_table = Table(msg_examples, colWidths=[90, 180, 180])
    msg_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(msg_table)
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 8: BUSINESS CARDS
    # ═══════════════════════════════════════════
    story.append(Paragraph("8. Tarjetas de Presentación", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Diseño Frontal", h2_style))
    
    # Business card front
    card_front = Drawing(350, 200)
    card_front.add(Rect(0, 0, 350, 200, fillColor=white, strokeColor=HexColor(BRAND["primary"]), strokeWidth=2, rx=8))
    card_front.add(Rect(0, 140, 350, 60, fillColor=HexColor(BRAND["primary"]), strokeWidth=0, rx=8))
    card_front.add(Rect(0, 140, 350, 30, fillColor=HexColor(BRAND["primary"]), strokeWidth=0))
    card_front.add(String(20, 160, "ROSS", fontSize=22, fontName='Helvetica-Bold', fillColor=white))
    card_front.add(String(20, 145, "FINANCIAL SERVICES", fontSize=10, fontName='Helvetica', fillColor=HexColor(BRAND["accent"])))
    card_front.add(Rect(310, 145, 2, 30, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))
    card_front.add(String(20, 105, "YOANDY ROSS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor(BRAND["text_primary"])))
    card_front.add(String(20, 88, "CEO & Founder", fontSize=10, fontName='Helvetica', fillColor=HexColor(BRAND["text_secondary"])))
    card_front.add(String(20, 60, "(555) 123-4567", fontSize=9, fontName='Helvetica', fillColor=HexColor(BRAND["text_primary"])))
    card_front.add(String(20, 45, "yoandy@rossfinancial.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(BRAND["text_primary"])))
    card_front.add(String(20, 30, "www.rossfinancialservices.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(BRAND["secondary_light"])))
    card_front.add(String(20, 12, "CAB License #XXXXXX — OCCC Regulated", fontSize=7, fontName='Helvetica', fillColor=HexColor(BRAND["text_light"])))
    story.append(card_front)
    
    story.append(Spacer(1, 15))
    story.append(Paragraph("Diseño Trasero", h2_style))
    
    card_back = Drawing(350, 200)
    card_back.add(Rect(0, 0, 350, 200, fillColor=HexColor(BRAND["primary_dark"]), strokeWidth=0, rx=8))
    card_back.add(String(100, 130, "ROSS", fontSize=32, fontName='Helvetica-Bold', fillColor=white))
    card_back.add(String(65, 105, "FINANCIAL SERVICES", fontSize=16, fontName='Helvetica', fillColor=HexColor(BRAND["accent"])))
    card_back.add(Rect(120, 85, 110, 2, fillColor=HexColor(BRAND["accent"]), strokeWidth=0))
    card_back.add(String(75, 60, "Tu éxito financiero es", fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor("#A7F3D0")))
    card_back.add(String(95, 44, "nuestro compromiso", fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor("#A7F3D0")))
    card_back.add(String(80, 15, "Préstamos CAB | Tax Services", fontSize=9, fontName='Helvetica', fillColor=HexColor(BRAND["text_light"])))
    story.append(card_back)
    
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<b>Especificaciones:</b> Tamaño estándar 3.5\" x 2\" • Papel: 16pt matte o silk • "
        "Acabado: Soft touch con foil dorado en el logo trasero (opcional premium)",
        caption_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 9: STATIONERY
    # ═══════════════════════════════════════════
    story.append(Paragraph("9. Papelería y Documentos Oficiales", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Membrete (Letterhead)", h2_style))
    story.append(Paragraph(
        "• Header: Franja verde Forest Green (#0A5C36) con logo en blanco<br/>"
        "• Footer: Línea dorada fina + dirección + número de licencia OCCC<br/>"
        "• Cuerpo: Fuente Inter Regular 11pt, color Text Primary (#1A1A2E)<br/>"
        "• Papel: Bond 24lb blanco, tamaño Letter (8.5 x 11\")",
        body_style
    ))
    
    story.append(Paragraph("Contratos y Documentos Legales", h2_style))
    story.append(Paragraph(
        "Los contratos CAB ya generados por la plataforma siguen esta guía:<br/><br/>"
        "• <b>Acuerdo de Servicios CAB:</b> Header verde con logo + datos del préstamo<br/>"
        "• <b>Pagaré (Promissory Note):</b> Formato formal, montos en negrita<br/>"
        "• <b>Declaración de Divulgación:</b> Tabla clara de costos y APR<br/>"
        "• <b>Calendario de Pagos:</b> Tabla con barras de progreso visuales<br/>"
        "• <b>Aviso de Cancelación:</b> Box amarillo de advertencia (#FEF3C7)",
        body_style
    ))
    
    story.append(Paragraph("Sobres", h2_style))
    story.append(Paragraph(
        "• Sobre #10 estándar (4.125 x 9.5\")<br/>"
        "• Logo en esquina superior izquierda (tamaño reducido)<br/>"
        "• Dirección de retorno en Inter Regular 9pt<br/>"
        "• Opcional: Interior forrado en patrón verde sutil",
        body_style
    ))
    
    story.append(Paragraph("Facturas y Recibos", h2_style))
    story.append(Paragraph(
        "• Header: Gradiente verde principal → emerald<br/>"
        "• Montos: Inter Bold, tamaño grande, color primary<br/>"
        "• Estado de pago: Badge de color (verde=pagado, amber=pendiente)<br/>"
        "• Footer: 'Gracias por tu confianza — Ross Financial Services LLC'",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 10: DIGITAL APPLICATIONS
    # ═══════════════════════════════════════════
    story.append(Paragraph("10. Aplicaciones Digitales", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("App Móvil (Módulo CAB)", h2_style))
    story.append(Paragraph(
        "El módulo de préstamos CAB en la app sigue exactamente esta guía de marca:<br/><br/>"
        "• <b>Header:</b> Forest Green (#065F46) con texto blanco<br/>"
        "• <b>Cards:</b> Fondo blanco, bordes redondeados 16px, sombra sutil<br/>"
        "• <b>Progreso:</b> Barra Emerald (#10B981) sobre gris (#E5E7EB)<br/>"
        "• <b>Montos:</b> Font size 28px, Bold, color Emerald<br/>"
        "• <b>Auto-Pay toggle:</b> Switch nativo con track verde<br/>"
        "• <b>Badges:</b> Colores funcionales según estado",
        body_style
    ))
    
    story.append(Paragraph("Sitio Web", h2_style))
    story.append(Paragraph(
        "• <b>Domain sugerido:</b> rossfinancialservices.com (o rossfinancial.com)<br/>"
        "• <b>Navbar:</b> Fondo blanco, logo izquierda, CTA verde derecha<br/>"
        "• <b>Hero:</b> Gradiente Forest→Emerald con texto blanco + CTA dorado<br/>"
        "• <b>Secciones:</b> Alternar fondo blanco / light mint (#F8FAF9)<br/>"
        "• <b>Footer:</b> Navy (#1E3A5F) con links en blanco y acento dorado<br/>"
        "• <b>CTA Buttons:</b> Forest Green con hover a Emerald, texto blanco",
        body_style
    ))
    
    story.append(Paragraph("Redes Sociales", h2_style))
    
    social_data = [
        ["Plataforma", "Foto de Perfil", "Cover/Banner", "Tono de Posts"],
        ["Facebook", "Logo compacto RF\nfondo verde", "Gradiente verde→emerald\n+ tagline en dorado", "Educativo, tips\nfinancieros"],
        ["Instagram", "Logo compacto RF\nfondo verde", "Carrusel con colores\nde marca", "Visual, testimonios,\ninfografías"],
        ["LinkedIn", "Logo completo\nfondo blanco", "Profesional, navy\n+ credenciales", "Corporativo, logros,\nregulatorio"],
        ["TikTok", "Logo compacto RF\nfondo verde", "N/A", "Educativo rápido,\ntips en español"],
    ]
    
    social_table = Table(social_data, colWidths=[80, 100, 110, 110])
    social_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F8FAF9")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(social_table)
    
    story.append(Paragraph("Email Marketing", h2_style))
    story.append(Paragraph(
        "• <b>Header:</b> Gradiente Forest→Emerald con logo blanco centrado<br/>"
        "• <b>Botón CTA:</b> Forest Green (#0A5C36), texto blanco, bordes 8px<br/>"
        "• <b>Footer:</b> Gris claro (#F7FAFC) con info de contacto<br/>"
        "• <b>Ancho máximo:</b> 600px, responsive para móvil<br/>"
        "• <b>Firma:</b> Logo + nombre + título + número de licencia OCCC",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 11: SIGNAGE
    # ═══════════════════════════════════════════
    story.append(Paragraph("11. Señalización y Oficina", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Letrero Exterior", h2_style))
    story.append(Paragraph(
        "• <b>Material:</b> Aluminio compuesto (ACM) o acrílico iluminado<br/>"
        "• <b>Fondo:</b> Forest Green (#0A5C36) o blanco<br/>"
        "• <b>Letras:</b> 'ROSS' en relieve, 'FINANCIAL SERVICES' plano<br/>"
        "• <b>Acento:</b> Barra dorada vertical LED o vinilo reflectante<br/>"
        "• <b>Tamaño sugerido:</b> 4' x 2' (exterior) o 3' x 1.5' (interior)",
        body_style
    ))
    
    story.append(Paragraph("Interior de Oficina", h2_style))
    story.append(Paragraph(
        "• <b>Pared de recepción:</b> Logo 3D en relieve sobre pared blanca o madera<br/>"
        "• <b>Colores de pintura:</b> Paredes blancas con acento en una pared Forest Green<br/>"
        "• <b>Muebles:</b> Tones de madera natural + acentos en navy o verde<br/>"
        "• <b>Plantas:</b> Incluir plantas naturales (refuerza el verde de la marca)<br/>"
        "• <b>Pantalla:</b> TV o monitor mostrando la app en demo mode",
        body_style
    ))
    
    story.append(Paragraph("Material Promocional", h2_style))
    story.append(Paragraph(
        "• <b>Flyers:</b> Formato carta, gradiente verde, montos grandes en dorado<br/>"
        "• <b>Banners roll-up:</b> 33\" x 80\", fondo gradiente, QR code para la app<br/>"
        "• <b>Camisetas:</b> Verde Forest con logo blanco (frente), tagline (espalda)<br/>"
        "• <b>Gorras:</b> Navy con logo bordado en dorado<br/>"
        "• <b>Bolígrafos:</b> Verde metálico con logo y URL en dorado<br/>"
        "• <b>Carpetas:</b> Doble bolsillo, Forest Green, logo en foil dorado",
        body_style
    ))
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 12: PROHIBITED COMBINATIONS
    # ═══════════════════════════════════════════
    story.append(Paragraph("12. Combinaciones Prohibidas", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph(
        "Las siguientes prácticas están PROHIBIDAS para mantener la integridad de la marca:",
        body_style
    ))
    
    prohib_data = [
        ["❌ Prohibido", "✅ Correcto"],
        ["Texto verde sobre fondo verde", "Texto blanco sobre fondo verde"],
        ["Logo en colores no aprobados", "Logo solo en versiones oficiales"],
        ["Gradientes en más de 2 colores", "Gradientes de 2 colores aprobados"],
        ["Fuentes que no sean Inter/Montserrat", "Siempre usar fuentes oficiales"],
        ["Sombras agresivas o drop shadows", "Sombras sutiles (opacity 0.05)"],
        ["Bordes cuadrados (radius: 0)", "Siempre bordes redondeados (8-16px)"],
        ["Negro puro (#000000) para texto", "Usar Text Primary (#1A1A2E)"],
        ["Emojis en documentos legales", "Emojis solo en push notifications"],
        ["Rojo para CTAs o botones", "Rojo SOLO para errores y alertas"],
        ["Distorsionar o rotar el logo", "Logo siempre horizontal, sin distorsión"],
    ]
    
    prohib_table = Table(prohib_data, colWidths=[225, 225])
    prohib_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(BRAND["error"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('BACKGROUND', (0, 1), (0, -1), HexColor("#FEF2F2")),
        ('BACKGROUND', (1, 1), (1, -1), HexColor("#ECFDF5")),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(prohib_table)
    
    story.append(PageBreak())
    
    # ═══════════════════════════════════════════
    # SECTION 13: LAUNCH CHECKLIST
    # ═══════════════════════════════════════════
    story.append(Paragraph("13. Checklist de Lanzamiento", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor(BRAND["primary"]), spaceAfter=15))
    
    story.append(Paragraph("Legal y Regulatorio", h2_style))
    checklist_legal = [
        "☐ Registrar LLC en Texas (Secretary of State) — $300",
        "☐ Obtener EIN del IRS (gratuito, online)",
        "☐ Solicitar licencia CAB con OCCC — ~$500-1,000",
        "☐ Obtener Surety Bond — ~$500-2,000/año",
        "☐ Contratar Registered Agent — ~$100/año",
        "☐ Abrir cuenta bancaria comercial",
        "☐ Abrir cuenta Trust Account separada (OBLIGATORIO)",
        "☐ Obtener seguro de responsabilidad comercial",
        "☐ Registrar nombre comercial (DBA si es necesario)",
    ]
    for item in checklist_legal:
        story.append(Paragraph(item, bullet_style))
    
    story.append(Paragraph("Branding y Marketing", h2_style))
    checklist_brand = [
        "☐ Diseñar logo profesional con diseñador gráfico (basado en esta guía)",
        "☐ Registrar dominio rossfinancialservices.com",
        "☐ Crear cuentas de redes sociales (@RossFinancialTX)",
        "☐ Imprimir tarjetas de presentación (500 unidades iniciales)",
        "☐ Diseñar membrete y plantillas de documentos",
        "☐ Crear firma de email corporativa",
        "☐ Preparar material promocional (flyers, banners)",
        "☐ Configurar email corporativo (info@rossfinancialservices.com)",
    ]
    for item in checklist_brand:
        story.append(Paragraph(item, bullet_style))
    
    story.append(Paragraph("Tecnología (Ya Completado ✅)", h2_style))
    checklist_tech = [
        "✅ Sistema CAB Backend completo (préstamos, pagos, trust account)",
        "✅ Panel Admin Web (dashboard, gestión, reportes OCCC)",
        "✅ Vista móvil para clientes (préstamos, auto-pay, contratos)",
        "✅ Auto-pay con NMI Customer Vault",
        "✅ Email automático de contratos (SendGrid)",
        "✅ Push notifications para recordatorios de pago",
        "✅ Generación de 5 contratos legales en PDF",
        "✅ Feature flag para activar/desactivar módulo CAB",
        "✅ Reportes OCCC automatizados",
    ]
    for item in checklist_tech:
        story.append(Paragraph(item, bullet_style))
    
    story.append(Paragraph("Banco / Lender Afiliado", h2_style))
    checklist_lender = [
        "☐ Investigar lenders afiliados en Texas",
        "☐ Negociar términos y acuerdos de lender",
        "☐ Configurar cuenta del lender en el sistema",
        "☐ Definir tasas de interés y estructura de fees",
        "☐ Realizar préstamo de prueba interno",
    ]
    for item in checklist_lender:
        story.append(Paragraph(item, bullet_style))
    
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(BRAND["accent"]), spaceAfter=10))
    story.append(Paragraph(
        "Documento generado por Ross Tax Preparation Platform<br/>"
        f"Fecha: {datetime.now().strftime('%d de %B, %Y')}<br/>"
        "Versión 1.0 — Confidencial",
        ParagraphStyle('Footer', parent=body_center, fontSize=9, textColor=HexColor(BRAND["text_light"]))
    ))
    
    # Build PDF
    doc.build(story)
    print(f"✅ PDF generado: {output_path}")
    return output_path


def send_email(pdf_path, to_email):
    """Send the branding PDF via SendGrid"""
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
    FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
    
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=to_email,
        subject='🎨 Ross Financial Services — Guía Completa de Identidad de Marca',
        html_content=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0A5C36, #10B981); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">ROSS</h1>
                <p style="color: #D4AF37; margin: 5px 0 0; font-size: 14px; letter-spacing: 2px;">FINANCIAL SERVICES</p>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Guía de Identidad de Marca</h2>
                <p style="color: #4a5568; line-height: 1.6;">
                    Adjunto encontrarás la guía completa de branding para <b>Ross Financial Services LLC</b>, 
                    incluyendo:
                </p>
                <ul style="color: #4a5568; line-height: 1.8;">
                    <li>Paleta de colores completa (códigos HEX, RGB)</li>
                    <li>Tipografía y estilos de texto</li>
                    <li>Logo y variaciones aprobadas</li>
                    <li>Tarjetas de presentación</li>
                    <li>Guía de tono de voz y mensajería</li>
                    <li>Aplicaciones digitales y redes sociales</li>
                    <li>Señalización y material promocional</li>
                    <li>Checklist completo de lanzamiento</li>
                </ul>
                <div style="background: #F8FAF9; border-left: 4px solid #0A5C36; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="color: #0A5C36; margin: 0; font-weight: bold;">
                        💡 Siguiente paso: Comparte esta guía con un diseñador gráfico 
                        para crear el logo profesional final.
                    </p>
                </div>
            </div>
            <div style="background: #0F172A; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
                <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
                    Ross Financial Services LLC — Brand Identity Guide v1.0<br/>
                    {datetime.now().strftime('%B %Y')} — Confidencial
                </p>
            </div>
        </div>
        """
    )
    
    attachment = Attachment()
    attachment.file_content = FileContent(base64.b64encode(pdf_data).decode('utf-8'))
    attachment.file_name = FileName('Ross_Financial_Services_Brand_Guide.pdf')
    attachment.file_type = FileType('application/pdf')
    attachment.disposition = Disposition('attachment')
    message.add_attachment(attachment)
    
    sg = SendGridAPIClient(SENDGRID_API_KEY)
    response = sg.send(message)
    print(f"📧 Email enviado a {to_email} — Status: {response.status_code}")
    return response.status_code


if __name__ == "__main__":
    output = "/app/memory/Ross_Financial_Services_Brand_Guide.pdf"
    generate_branding_pdf(output)
    send_email(output, "yoandyross@gmail.com")
