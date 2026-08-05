#!/usr/bin/env python3
"""
Ross Tax Preparation & Ross Financial Services — Complete Brand Identity Guides
Generates 3 PDFs: Ross Tax EN, Ross Tax ES, Ross Financial EN
"""

import os
import sys
import base64
from datetime import datetime

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.graphics.shapes import Drawing, Rect, Circle, String
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
except ImportError:
    os.system("pip install reportlab")
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.colors import HexColor, white, black
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.platypus.flowables import HRFlowable
    from reportlab.graphics.shapes import Drawing, Rect, Circle, String
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY


# ═══════════════════════════════════════════
# ROSS TAX Colors
# ═══════════════════════════════════════════
TAX = {
    "primary": "#6C1110",
    "primary_rgb": "108, 17, 16",
    "primary_cmyk": "32, 98, 98, 47",
    "secondary": "#ED201D",
    "secondary_rgb": "237, 32, 29",
    "secondary_cmyk": "0, 99, 97, 0",
    "accent": "#5DC1D9",
    "accent_rgb": "93, 193, 217",
    "accent_cmyk": "58, 4, 12, 0",
    "primary_dark": "#4A0B0A",
    "secondary_light": "#F25A58",
    "accent_dark": "#3A9BB0",
    "accent_light": "#A3DDE9",
    "success": "#059669",
    "warning": "#F59E0B",
    "error": "#DC2626",
    "bg_light": "#FFF9F9",
    "bg_dark": "#1A0505",
    "text_primary": "#1A1A2E",
    "text_secondary": "#4A5568",
    "text_light": "#9CA3AF",
    "gold": "#D4AF37",
}

# ═══════════════════════════════════════════
# ROSS FINANCIAL Colors
# ═══════════════════════════════════════════
FIN = {
    "primary": "#0A5C36",
    "primary_light": "#10B981",
    "primary_dark": "#064E2B",
    "secondary": "#1E3A5F",
    "secondary_light": "#3B82F6",
    "accent": "#D4AF37",
    "accent_light": "#F59E0B",
    "success": "#059669",
    "warning": "#F59E0B",
    "error": "#DC2626",
    "bg_light": "#F8FAF9",
    "bg_dark": "#0F172A",
    "text_primary": "#1A1A2E",
    "text_secondary": "#4A5568",
    "text_light": "#9CA3AF",
}


def sw(color_hex, w=55, h=35):
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=HexColor(color_hex), strokeColor=HexColor("#E5E7EB"), strokeWidth=0.5, rx=3))
    return d


def mk_styles(p_color, s_color):
    ss = getSampleStyleSheet()
    r = {}
    r['title'] = ParagraphStyle('T', parent=ss['Title'], fontSize=32, textColor=HexColor(p_color), fontName='Helvetica-Bold', alignment=TA_CENTER)
    r['subtitle'] = ParagraphStyle('S', parent=ss['Normal'], fontSize=14, textColor=HexColor(s_color), spaceAfter=20, fontName='Helvetica', alignment=TA_CENTER)
    r['h1'] = ParagraphStyle('H1', parent=ss['Heading1'], fontSize=22, textColor=HexColor(p_color), spaceBefore=20, spaceAfter=12, fontName='Helvetica-Bold')
    r['h2'] = ParagraphStyle('H2', parent=ss['Heading2'], fontSize=16, textColor=HexColor(s_color), spaceBefore=16, spaceAfter=8, fontName='Helvetica-Bold')
    r['h3'] = ParagraphStyle('H3', parent=ss['Heading3'], fontSize=13, textColor=HexColor(p_color), spaceBefore=10, spaceAfter=6, fontName='Helvetica-Bold')
    r['body'] = ParagraphStyle('B', parent=ss['Normal'], fontSize=11, textColor=HexColor("#1A1A2E"), spaceAfter=8, fontName='Helvetica', leading=16, alignment=TA_JUSTIFY)
    r['bc'] = ParagraphStyle('BC', parent=r['body'], alignment=TA_CENTER)
    r['bullet'] = ParagraphStyle('BL', parent=r['body'], leftIndent=20, bulletIndent=8, spaceBefore=2, spaceAfter=4)
    r['quote'] = ParagraphStyle('Q', parent=r['body'], leftIndent=30, rightIndent=30, fontSize=12, fontName='Helvetica-Oblique', textColor=HexColor(s_color), alignment=TA_CENTER, spaceBefore=12, spaceAfter=12)
    r['caption'] = ParagraphStyle('C', parent=ss['Normal'], fontSize=9, textColor=HexColor("#4A5568"), fontName='Helvetica-Oblique')
    r['footer'] = ParagraphStyle('F', parent=r['bc'], fontSize=9, textColor=HexColor("#9CA3AF"))
    return r


def mk_hr(c): return HRFlowable(width="100%", thickness=1, color=HexColor(c), spaceAfter=15)

def mk_table(rows, pc, widths=None):
    w = widths or [220, 220]
    t = Table(rows, colWidths=w)
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(pc)), ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#FAFAFA")]),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


def generate_ross_tax_pdf(output_path, lang="en"):
    C = TAX
    en = lang == "en"
    doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    st = mk_styles(C["primary"], C["secondary"])
    story = []

    # COVER
    story.append(Spacer(1, 80))
    logo = Drawing(420, 90)
    logo.add(Rect(0, 0, 420, 90, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=10))
    logo.add(String(25, 55, "ROSS TAX", fontSize=34, fontName='Helvetica-Bold', fillColor=white))
    logo.add(String(25, 28, "PREPARATION", fontSize=20, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    logo.add(Rect(380, 20, 3, 48, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    story.append(logo)
    story.append(Spacer(1, 25))
    story.append(Paragraph("Complete Brand Identity Guide" if en else "Guía Completa de Identidad de Marca", st['subtitle']))
    story.append(HRFlowable(width="60%", thickness=2, color=HexColor(C["secondary"]), spaceBefore=10, spaceAfter=10))
    story.append(Paragraph("Brand Identity Guide 2025", st['footer']))
    story.append(Spacer(1, 50))
    ci = [["Company:" if en else "Empresa:", "Ross Tax Preparation LLC"],
          ["Industry:" if en else "Industria:", "Tax Preparation & Financial Services"],
          ["Founder:" if en else "Fundador:", "Yoandy Ross"],
          ["Date:" if en else "Fecha:", datetime.now().strftime("%B %Y")],
          ["Version:" if en else "Versión:", "1.0"]]
    ct = Table(ci, colWidths=[120, 300])
    ct.setStyle(TableStyle([('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 11), ('TEXTCOLOR', (0,0), (0,-1), HexColor(C["primary"])),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8), ('ALIGN', (0,0), (0,-1), 'RIGHT')]))
    story.append(ct)
    story.append(Spacer(1, 40))
    story.append(Paragraph("CONFIDENTIAL" if en else "CONFIDENCIAL",
        ParagraphStyle('X', parent=st['bc'], fontSize=9, textColor=HexColor(C["error"]), fontName='Helvetica-Bold')))
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("Table of Contents" if en else "Contenido", st['h1']))
    story.append(mk_hr(C["primary"]))
    toc_en = ["1. Brand Vision & Mission","2. Primary Color Palette","3. Secondary & Functional Colors","4. Typography",
              "5. Logo & Variations","6. Iconography & Visual Elements","7. Tone of Voice & Messaging",
              "8. Business Cards","9. Stationery & Official Documents","10. Digital Applications & Social Media",
              "11. Signage & Office","12. Prohibited Combinations","13. Brand Photography","14. Launch Checklist"]
    toc_es = ["1. Visión y Misión","2. Paleta de Colores Principal","3. Colores Secundarios y Funcionales","4. Tipografía",
              "5. Logotipo y Variaciones","6. Iconografía y Elementos Gráficos","7. Tono de Voz y Mensajería",
              "8. Tarjetas de Presentación","9. Papelería y Documentos","10. Aplicaciones Digitales y Redes Sociales",
              "11. Señalización y Oficina","12. Combinaciones Prohibidas","13. Fotografía de Marca","14. Checklist de Lanzamiento"]
    for item in (toc_en if en else toc_es):
        story.append(Paragraph(item, ParagraphStyle('TOC', parent=st['body'], fontSize=13, spaceBefore=5, spaceAfter=5, leftIndent=20)))
    story.append(PageBreak())

    # 1. VISION & MISSION
    story.append(Paragraph("1. Brand Vision & Mission" if en else "1. Visión y Misión de la Marca", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Mission" if en else "Misión", st['h2']))
    story.append(Paragraph("To provide accurate, affordable, and personalized tax preparation services to the Hispanic community and beyond, leveraging cutting-edge technology to maximize refunds and simplify the tax filing experience." if en else
        "Proveer servicios de preparación de impuestos precisos, accesibles y personalizados para la comunidad hispana y más allá, utilizando tecnología de punta para maximizar reembolsos y simplificar la experiencia de declaración.", st['body']))
    story.append(Paragraph("Vision" if en else "Visión", st['h2']))
    story.append(Paragraph("To become the most trusted tax preparation and financial services brand in the Hispanic community, recognized for our innovation, integrity, and commitment to our clients' financial success." if en else
        "Ser la marca de preparación de impuestos y servicios financieros más confiable de la comunidad hispana, reconocida por nuestra innovación, integridad y compromiso con el éxito financiero de nuestros clientes.", st['body']))
    story.append(Paragraph("Brand Values" if en else "Valores de Marca", st['h2']))
    vals = [("Accuracy" if en else "Precisión", "Every tax return is prepared with meticulous attention to detail, ensuring maximum legal refunds." if en else "Cada declaración se prepara con atención meticulosa al detalle, asegurando máximos reembolsos legales."),
            ("Trust" if en else "Confianza", "We build lasting relationships through transparency, honesty, and consistent service quality." if en else "Construimos relaciones duraderas a través de transparencia y calidad de servicio."),
            ("Innovation" if en else "Innovación", "Our mobile app and digital tools set us apart — clients can file from anywhere, anytime." if en else "Nuestra app móvil y herramientas digitales nos distinguen — los clientes pueden declarar desde cualquier lugar."),
            ("Community" if en else "Comunidad", "We serve the Hispanic community with bilingual support and cultural understanding." if en else "Servimos a la comunidad hispana con soporte bilingüe y comprensión cultural."),
            ("Empowerment" if en else "Empoderamiento", "We educate our clients about tax benefits and financial opportunities they didn't know existed." if en else "Educamos a nuestros clientes sobre beneficios fiscales y oportunidades que desconocían.")]
    for n, d in vals:
        story.append(Paragraph(f"<b>• {n}:</b> {d}", st['bullet']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('"Your Refund, Our Priority"' if en else '"Tu Reembolso, Nuestra Prioridad"', st['quote']))
    story.append(Paragraph("Unique Value Proposition" if en else "Propuesta de Valor Única", st['h2']))
    story.append(Paragraph("Ross Tax Preparation combines the warmth of a local family business with enterprise-level technology. Our mobile app — Mi Reembolso — lets clients complete their entire tax filing from their phone, with real-time tracking, secure uploads, and bilingual support built into everything we do." if en else
        "Ross Tax Preparation combina la calidez de un negocio familiar con tecnología empresarial. Nuestra app — Mi Reembolso — permite a los clientes completar su declaración desde el teléfono, con seguimiento en tiempo real, subidas seguras y soporte bilingüe integrado.", st['body']))
    story.append(PageBreak())

    # 2. PRIMARY COLORS
    story.append(Paragraph("2. Primary Color Palette" if en else "2. Paleta de Colores Principal", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("The brand colors convey trust, energy, and professionalism. Deep maroon = tradition & reliability; bright red = energy & urgency; sky blue = balance, trust & technology." if en else
        "Los colores de marca transmiten confianza, energía y profesionalismo. Marrón profundo = tradición y confiabilidad; rojo brillante = energía y urgencia; azul cielo = balance, confianza y tecnología.", st['body']))
    story.append(Spacer(1, 8))
    pc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB / CMYK", "Use" if en else "Uso"],
        [sw(C["primary"]), "Dark Maroon\n(Primary)" if en else "Marrón Oscuro\n(Primario)", C["primary"], f"RGB: {C['primary_rgb']}\nCMYK: {C['primary_cmyk']}", "Logo, headers,\nmain buttons" if en else "Logo, encabezados,\nbotones principales"],
        [sw(C["secondary"]), "Bright Red\n(Secondary)" if en else "Rojo Brillante\n(Secundario)", C["secondary"], f"RGB: {C['secondary_rgb']}\nCMYK: {C['secondary_cmyk']}", "Accents, urgency,\nrefund amounts" if en else "Acentos, urgencia,\nmontos de reembolso"],
        [sw(C["accent"]), "Sky Blue\n(Accent)" if en else "Azul Cielo\n(Acento)", C["accent"], f"RGB: {C['accent_rgb']}\nCMYK: {C['accent_cmyk']}", "Trust, links,\ninfo sections" if en else "Confianza, links,\nsecciones info"]]
    story.append(mk_table(pc_rows, C["primary"], [60, 90, 60, 115, 115]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Usage Proportions" if en else "Proporciones de Uso", st['h3']))
    prop = Drawing(450, 50)
    prop.add(Rect(0, 10, 200, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    prop.add(Rect(200, 10, 135, 30, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    prop.add(Rect(335, 10, 115, 30, fillColor=HexColor(C["accent"]), strokeWidth=0))
    prop.add(String(78, 20, "45%", fontSize=13, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(253, 20, "30%", fontSize=12, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(378, 20, "25%", fontSize=12, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    story.append(prop)
    story.append(PageBreak())

    # 3. SECONDARY COLORS
    story.append(Paragraph("3. Secondary & Functional Colors" if en else "3. Colores Secundarios y Funcionales", st['h1']))
    story.append(mk_hr(C["primary"]))
    sc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB", "Use" if en else "Uso"],
        [sw(C["primary_dark"]), "Deep Maroon", "#4A0B0A", "74, 11, 10", "Dark backgrounds" if en else "Fondos oscuros"],
        [sw(C["secondary_light"]), "Salmon Red", "#F25A58", "242, 90, 88", "Hover states" if en else "Estados hover"],
        [sw(C["accent_dark"]), "Deep Blue", "#3A9BB0", "58, 155, 176", "Active elements" if en else "Elementos activos"],
        [sw(C["accent_light"]), "Light Blue", "#A3DDE9", "163, 221, 233", "Info boxes" if en else "Cajas informativas"],
        [sw(C["success"]), "Success", "#059669", "5, 150, 105", "Approved, success" if en else "Aprobado, éxito"],
        [sw(C["warning"]), "Warning", "#F59E0B", "245, 158, 11", "Pending, alerts" if en else "Pendiente, alertas"],
        [sw(C["error"]), "Error", "#DC2626", "220, 38, 38", "Errors, rejected" if en else "Errores, rechazado"],
        [sw("#F7F7F8"), "Background", "#F7F7F8", "247, 247, 248", "Page backgrounds" if en else "Fondos de página"],
        [sw(C["text_primary"]), "Text Primary", "#1A1A2E", "26, 26, 46", "Main text" if en else "Texto principal"]]
    story.append(mk_table(sc_rows, C["primary"], [60, 80, 60, 100, 140]))
    story.append(PageBreak())

    # 4. TYPOGRAPHY
    story.append(Paragraph("4. Typography" if en else "4. Tipografía", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Primary Font Family" if en else "Familia Tipográfica Principal", st['h2']))
    story.append(Paragraph("<b>Inter</b> — Primary digital font for app, web, and emails. Modern, highly readable, excellent Spanish character support (accents, ñ). Free via Google Fonts." if en else
        "<b>Inter</b> — Fuente digital principal para app, web y emails. Moderna, legible, excelente soporte de caracteres en español. Gratuita vía Google Fonts.", st['body']))
    ty_rows = [["Element" if en else "Elemento", "Font" if en else "Fuente", "Weight" if en else "Peso", "Size" if en else "Tamaño", "Example" if en else "Ejemplo"],
        ["H1", "Inter", "Bold (700)", "28-32px", "Your Refund" if en else "Tu Reembolso"],
        ["H2", "Inter", "SemiBold (600)", "20-24px", "Tax Summary" if en else "Resumen Fiscal"],
        ["H3", "Inter", "SemiBold (600)", "16-18px", "W-2 Income" if en else "Ingresos W-2"],
        ["Body", "Inter", "Regular (400)", "14-16px", "Your filing..." if en else "Tu estado..."],
        ["Caption", "Inter", "Regular (400)", "11-12px", "Updated" if en else "Actualizado"],
        ["CTA", "Inter", "SemiBold (600)", "14-16px", "FILE NOW" if en else "DECLARAR"],
        ["Amounts" if en else "Montos", "Inter", "Bold (700)", "24-36px", "$3,847.00"]]
    story.append(mk_table(ty_rows, C["primary"], [70, 50, 85, 65, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Secondary (Print): <b>Montserrat</b> — Elegant, professional. Bold for headlines, Regular for body." if en else
        "Secundaria (Impreso): <b>Montserrat</b> — Elegante, profesional. Bold para titulares, Regular para cuerpo.", st['body']))
    story.append(Paragraph("Numbers: Always tabular, comma for thousands, period for decimals: <b>$12,345.67</b>. Refunds in <b>Bright Red (#ED201D), Bold, 24-36px</b>." if en else
        "Números: Siempre tabulares, coma para miles, punto para decimales: <b>$12,345.67</b>. Reembolsos en <b>Rojo Brillante (#ED201D), Bold, 24-36px</b>.", st['body']))
    story.append(PageBreak())

    # 5. LOGO
    story.append(Paragraph("5. Logo & Variations" if en else "5. Logotipo y Variaciones", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("The logo combines bold typography with our distinctive tri-color palette. Maroon = authority; red accent = energy; blue = trust & technology." if en else
        "El logo combina tipografía bold con nuestra paleta tricolor distintiva. Marrón = autoridad; acento rojo = energía; azul = confianza y tecnología.", st['body']))
    story.append(Paragraph("Primary (Light BG)" if en else "Principal (Fondo Claro)", st['h3']))
    l1 = Drawing(420, 65)
    l1.add(Rect(0, 0, 420, 65, fillColor=white, strokeColor=HexColor(C["primary"]), strokeWidth=2, rx=6))
    l1.add(String(20, 35, "ROSS TAX", fontSize=26, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    l1.add(String(20, 14, "PREPARATION", fontSize=14, fontName='Helvetica', fillColor=HexColor(C["accent_dark"])))
    l1.add(Rect(350, 12, 3, 42, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    l1.add(Rect(358, 16, 50, 34, fillColor=HexColor(C["accent"]), strokeWidth=0, rx=4))
    l1.add(String(364, 27, "TAX", fontSize=16, fontName='Helvetica-Bold', fillColor=white))
    story.append(l1)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Inverse (Dark BG)" if en else "Inversa (Fondo Oscuro)", st['h3']))
    l2 = Drawing(420, 65)
    l2.add(Rect(0, 0, 420, 65, fillColor=HexColor(C["primary_dark"]), strokeWidth=0, rx=6))
    l2.add(String(20, 35, "ROSS TAX", fontSize=26, fontName='Helvetica-Bold', fillColor=white))
    l2.add(String(20, 14, "PREPARATION", fontSize=14, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    l2.add(Rect(350, 12, 3, 42, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    story.append(l2)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Compact Icon" if en else "Ícono Compacto", st['h3']))
    l3 = Drawing(280, 65)
    l3.add(Rect(0, 0, 65, 65, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=14))
    l3.add(String(10, 38, "RT", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    l3.add(String(10, 16, "P", fontSize=16, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    l3.add(Rect(52, 14, 2, 36, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    l3.add(String(80, 38, "App icon, favicon, social" if en else "App icon, favicon, redes", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    story.append(l3)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Clear space = height of 'R' on all sides. Min digital: 120px. Min print: 1.5\". Never stretch, rotate, or recolor." if en else
        "Zona de protección = altura de 'R' en todos los lados. Mín. digital: 120px. Mín. impreso: 1.5\". Nunca estirar, rotar ni recolorear.", st['body']))
    story.append(PageBreak())

    # 6. ICONOGRAPHY
    story.append(Paragraph("6. Iconography" if en else "6. Iconografía", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Icon library: <b>Ionicons</b>. Outline for normal states, filled for active. Brand colors only." if en else
        "Biblioteca: <b>Ionicons</b>. Outline para estados normales, filled para activos. Solo colores de marca.", st['body']))
    ic_rows = [["Concept" if en else "Concepto", "Icon" if en else "Ícono", "Color", "Use" if en else "Uso"],
        ["Tax Filing" if en else "Declaración", "document-text", C["primary"], "Returns, forms" if en else "Declaraciones"],
        ["Refund" if en else "Reembolso", "cash-outline", C["secondary"], "Amounts, tracking" if en else "Montos, tracking"],
        ["Appointments" if en else "Citas", "calendar", C["accent_dark"], "Schedule" if en else "Agenda"],
        ["Documents" if en else "Documentos", "folder-open", C["primary"], "W-2s, 1099s"],
        ["Payments" if en else "Pagos", "card-outline", C["accent_dark"], "Methods" if en else "Métodos"],
        ["Approved" if en else "Aprobado", "checkmark-circle", C["success"], "IRS accepted" if en else "IRS aceptado"],
        ["Pending" if en else "Pendiente", "time-outline", C["warning"], "Processing" if en else "Procesando"],
        ["Rejected" if en else "Rechazado", "close-circle", C["error"], "IRS rejected" if en else "IRS rechazado"]]
    story.append(mk_table(ic_rows, C["primary"], [80, 120, 70, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Visual rules: border-radius 12-16px cards, 8px buttons • shadows subtle (0.05 opacity) • progress bars Sky Blue on gray • dividers 1px #F3F4F6 • refund amounts always Bright Red, large, bold" if en else
        "Reglas visuales: border-radius 12-16px cards, 8px botones • sombras sutiles (0.05 opacidad) • barras de progreso Azul Cielo sobre gris • separadores 1px #F3F4F6 • reembolsos siempre Rojo Brillante, grande, bold", st['body']))
    story.append(PageBreak())

    # 7. TONE OF VOICE
    story.append(Paragraph("7. Tone of Voice" if en else "7. Tono de Voz", st['h1']))
    story.append(mk_hr(C["primary"]))
    pers_rows = [["Attribute" if en else "Atributo", "We Are" if en else "Somos", "We Are Not" if en else "No Somos"],
        ["Tone" if en else "Tono", "Warm, professional" if en else "Cálido, profesional", "Cold, intimidating" if en else "Frío, intimidante"],
        ["Language" if en else "Lenguaje", "Clear, bilingual" if en else "Claro, bilingüe", "IRS jargon" if en else "Jerga del IRS"],
        ["Attitude" if en else "Actitud", "Helpful guide" if en else "Guía servicial", "Condescending" if en else "Condescendiente"],
        ["Communication" if en else "Comunicación", "Transparent, proactive" if en else "Transparente, proactiva", "Confusing" if en else "Confusa"]]
    story.append(mk_table(pers_rows, C["primary"], [100, 170, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Taglines", st['h2']))
    tags = [('"Your Refund, Our Priority"', '"Tu Reembolso, Nuestra Prioridad"'),
            ('"Maximum Refund, Guaranteed"', '"Máximo Reembolso, Garantizado"'),
            ('"File Smart. File Fast. File Ross."', '"Declara Inteligente. Declara Rápido. Declara con Ross."'),
            ('"From the community, for the community"', '"De la comunidad, para la comunidad"')]
    for e, s2 in tags:
        story.append(Paragraph(f"• {e if en else s2}", st['bullet']))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Messaging Examples" if en else "Ejemplos de Mensajería", st['h2']))
    mg_rows = [["Situation" if en else "Situación", "Correct ✅" if en else "Correcto ✅", "Incorrect ❌" if en else "Incorrecto ❌"],
        ["Refund" if en else "Reembolso", '"Great news! Your refund\nof $3,847 is approved!"' if en else '"¡Tu reembolso de\n$3,847 fue aprobado!"', '"Refund approved.\nRef: TX-4921."' if en else '"Reembolso aprobado.\nRef: TX-4921."'],
        ["Document" if en else "Documento", '"We just need your W-2\nto finish — tap to upload!"' if en else '"Solo necesitamos tu W-2\n¡toca para subir!"', '"Missing W-2.\nSubmit immediately."' if en else '"Documento W-2 faltante."'],
        ["Welcome" if en else "Bienvenida", '"Welcome to Ross Tax!\nLet\'s get your max refund."' if en else '"¡Bienvenido a Ross Tax!\nVamos por tu máximo reembolso."', '"Account created.\nSubmit documents."' if en else '"Cuenta creada."']]
    story.append(mk_table(mg_rows, C["primary"], [70, 185, 185]))
    story.append(PageBreak())

    # 8. BUSINESS CARDS
    story.append(Paragraph("8. Business Cards" if en else "8. Tarjetas de Presentación", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Front" if en else "Frontal", st['h2']))
    cf = Drawing(360, 200)
    cf.add(Rect(0, 0, 360, 200, fillColor=white, strokeColor=HexColor(C["primary"]), strokeWidth=2, rx=8))
    cf.add(Rect(0, 140, 360, 60, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=8))
    cf.add(Rect(0, 140, 360, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    cf.add(String(18, 162, "ROSS TAX", fontSize=20, fontName='Helvetica-Bold', fillColor=white))
    cf.add(String(18, 146, "PREPARATION", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cf.add(Rect(310, 145, 35, 15, fillColor=HexColor(C["secondary"]), strokeWidth=0, rx=3))
    cf.add(String(315, 148, "TAX", fontSize=9, fontName='Helvetica-Bold', fillColor=white))
    cf.add(String(18, 108, "YOANDY ROSS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 92, "CEO & Founder | Tax Preparer", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    cf.add(String(18, 65, "(555) 123-4567", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 50, "yoandy@rosstaxpreparation.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 35, "www.rosstaxpreparation.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["accent_dark"])))
    cf.add(String(18, 14, "PTIN: P0XXXXXXX | EFIN: XXXXXX", fontSize=7, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    story.append(cf)
    story.append(Spacer(1, 12))
    story.append(Paragraph("Back" if en else "Trasera", st['h2']))
    cb = Drawing(360, 200)
    cb.add(Rect(0, 0, 360, 200, fillColor=HexColor(C["primary_dark"]), strokeWidth=0, rx=8))
    cb.add(String(95, 130, "ROSS TAX", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    cb.add(String(80, 108, "PREPARATION", fontSize=18, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cb.add(Rect(110, 92, 140, 2, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    tag = "Your Refund, Our Priority" if en else "Tu Reembolso, Nuestra Prioridad"
    cb.add(String(82 if en else 62, 72, tag, fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor(C["accent_light"])))
    cb.add(String(100, 28, "Tax | Bookkeeping | Payroll", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    cb.add(String(115, 12, "Bilingual: English & Spanish" if en else "Bilingüe: English & Español", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    story.append(cb)
    story.append(Spacer(1, 8))
    story.append(Paragraph("3.5\" x 2\" • 16pt matte/silk • Optional: soft touch + spot UV on logo" if en else
        "3.5\" x 2\" • 16pt matte/silk • Opcional: soft touch + spot UV en el logo", st['caption']))
    story.append(PageBreak())

    # 9. STATIONERY
    story.append(Paragraph("9. Stationery & Documents" if en else "9. Papelería y Documentos", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Letterhead" if en else "Membrete", st['h2']))
    story.append(Paragraph("Header: Maroon stripe + white logo + blue accent line. Footer: red line + address + PTIN/EFIN. Body: Inter 11pt. Paper: 24lb bond white, Letter size." if en else
        "Header: Franja marrón + logo blanco + línea azul. Footer: línea roja + dirección + PTIN/EFIN. Cuerpo: Inter 11pt. Papel: Bond 24lb blanco, tamaño Letter.", st['body']))
    story.append(Paragraph("Tax Documents" if en else "Documentos Fiscales", st['h2']))
    story.append(Paragraph("Client cover: Maroon header + client name in white. Invoice: Blue header, refund in red bold. Tax summary: alternating rows. Privacy notice: maroon left border." if en else
        "Portada: Header marrón + nombre en blanco. Factura: Header azul, reembolso en rojo bold. Resumen: filas alternadas. Privacidad: borde izquierdo marrón.", st['body']))
    story.append(Paragraph("Envelopes: #10, logo top-left. Folders: two-pocket, maroon, white logo + red stripe." if en else
        "Sobres: #10, logo arriba-izquierda. Carpetas: dos bolsillos, marrón, logo blanco + franja roja.", st['body']))
    story.append(PageBreak())

    # 10. DIGITAL
    story.append(Paragraph("10. Digital & Social Media" if en else "10. Digital y Redes Sociales", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Mobile App — Mi Reembolso", st['h2']))
    story.append(Paragraph("App Icon: Maroon bg, white 'RT' + red bar. Navigation: bottom tabs, maroon active. Refunds: large Bright Red number. Cards: white, 16px radius. CTAs: red buttons, white text." if en else
        "App Icon: Fondo marrón, 'RT' blanco + barra roja. Navegación: tabs inferiores, marrón activo. Reembolsos: número grande Rojo Brillante. Cards: blancas, radio 16px. CTAs: botones rojos, texto blanco.", st['body']))
    story.append(Paragraph("Website", st['h2']))
    story.append(Paragraph("Navbar: white bg, maroon logo, red CTA. Hero: Maroon→Red gradient. Footer: Deep Maroon. Alternate white/#FFF9F9 sections." if en else
        "Navbar: fondo blanco, logo marrón, CTA rojo. Hero: Gradiente Marrón→Rojo. Footer: Marrón Profundo. Secciones alternadas blanco/#FFF9F9.", st['body']))
    story.append(Paragraph("Social Media", st['h2']))
    sm_rows = [["Platform" if en else "Plataforma", "Profile" if en else "Perfil", "Content" if en else "Contenido"],
        ["Facebook", "RT icon / maroon bg", "Tax tips, deadlines, community" if en else "Tips, fechas, comunidad"],
        ["Instagram", "RT icon / maroon bg", "Testimonials, infographics" if en else "Testimonios, infografías"],
        ["TikTok", "RT icon / maroon bg", "Quick tax tips, myths" if en else "Tips rápidos, mitos"],
        ["LinkedIn", "Full logo / white bg", "Professional, achievements" if en else "Profesional, logros"]]
    story.append(mk_table(sm_rows, C["primary"], [80, 140, 220]))
    story.append(Paragraph("Email: Maroon→Red header, white logo. CTA: red button. Footer: gray + PTIN. Max 600px, responsive." if en else
        "Email: Header Marrón→Rojo, logo blanco. CTA: botón rojo. Footer: gris + PTIN. Máx 600px, responsive.", st['body']))
    story.append(PageBreak())

    # 11. SIGNAGE
    story.append(Paragraph("11. Signage & Office" if en else "11. Señalización y Oficina", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Exterior: ACM or illuminated acrylic. Maroon bg, 'ROSS TAX' raised, red LED accent. 5'x2.5'." if en else
        "Exterior: ACM o acrílico iluminado. Fondo marrón, 'ROSS TAX' en relieve, acento LED rojo. 5'x2.5'.", st['body']))
    story.append(Paragraph("Office: 3D logo on reception wall. White walls, one maroon accent wall. TV with app demo + QR." if en else
        "Oficina: Logo 3D en recepción. Paredes blancas, una pared acento marrón. TV con demo de app + QR.", st['body']))
    story.append(Paragraph("Promo: Flyers (letter, maroon header). Roll-up 33\"x80\". T-shirts (maroon, white logo). Caps (maroon, white embroidery). Pens, tote bags, window clings ('Se Habla Español')." if en else
        "Promo: Flyers (carta, header marrón). Roll-up 33\"x80\". Camisetas (marrón, logo blanco). Gorras (marrón, bordado blanco). Bolígrafos, bolsas, calcomanías ('Se Habla Español').", st['body']))
    story.append(PageBreak())

    # 12. PROHIBITED
    story.append(Paragraph("12. Prohibited Combinations" if en else "12. Combinaciones Prohibidas", st['h1']))
    story.append(mk_hr(C["primary"]))
    pr_rows = [["❌ " + ("Prohibited" if en else "Prohibido"), "✅ " + ("Correct" if en else "Correcto")],
        ["Red text on maroon bg" if en else "Texto rojo sobre marrón", "White text on maroon" if en else "Texto blanco sobre marrón"],
        ["Logo in non-approved colors" if en else "Logo en colores no aprobados", "Official versions only" if en else "Solo versiones oficiales"],
        ["3+ color gradients" if en else "Gradientes 3+ colores", "Approved 2-color only" if en else "Solo 2 colores aprobados"],
        ["Non Inter/Montserrat fonts" if en else "Fuentes no Inter/Montserrat", "Official fonts always" if en else "Siempre fuentes oficiales"],
        ["Pure black (#000000)" if en else "Negro puro (#000000)", "Text Primary (#1A1A2E)"],
        ["Blue for error states" if en else "Azul para errores", "Red only for errors" if en else "Rojo solo para errores"],
        ["Stretch/rotate logo" if en else "Estirar/rotar logo", "Horizontal, undistorted" if en else "Horizontal, sin distorsión"],
        ["Clip art / stock style" if en else "Clip art / estilo stock", "Professional photos" if en else "Fotos profesionales"]]
    pt = Table(pr_rows, colWidths=[225, 225])
    pt.setStyle(TableStyle([('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 10),
        ('BACKGROUND', (0,0), (-1,0), HexColor(C["error"])), ('TEXTCOLOR', (0,0), (-1,0), white),
        ('BACKGROUND', (0,1), (0,-1), HexColor("#FEF2F2")), ('BACKGROUND', (1,1), (1,-1), HexColor("#ECFDF5")),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#E5E7EB")), ('TOPPADDING', (0,0), (-1,-1), 7), ('BOTTOMPADDING', (0,0), (-1,-1), 7)]))
    story.append(pt)
    story.append(PageBreak())

    # 13. PHOTOGRAPHY
    story.append(Paragraph("13. Brand Photography" if en else "13. Fotografía de Marca", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("People: Diverse, Hispanic-inclusive. Settings: Modern offices. Lighting: Warm, natural. Show app on real phones. Clean documents. Avoid generic stock." if en else
        "Personas: Diversas, hispanas. Escenarios: Oficinas modernas. Iluminación: Cálida, natural. Mostrar app en teléfonos reales. Documentos limpios. Evitar stock genérico.", st['body']))
    story.append(Paragraph("Image overlays: Maroon semi-transparent (rgba(108,17,16,0.75)). Text always white or blue on dark overlays. Min contrast 4.5:1 (WCAG AA)." if en else
        "Overlays: Marrón semi-transparente (rgba(108,17,16,0.75)). Texto siempre blanco o azul sobre overlays. Contraste mín 4.5:1 (WCAG AA).", st['body']))
    story.append(PageBreak())

    # 14. CHECKLIST
    story.append(Paragraph("14. Launch Checklist" if en else "14. Checklist de Lanzamiento", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Digital Assets" if en else "Activos Digitales", st['h2']))
    for i in (["☐ Logo: SVG, PNG (transparent), PDF", "☐ App icon 1024x1024", "☐ Favicons (16, 32, 180px)",
               "☐ Social profiles 800x800", "☐ Social covers (per platform)", "☐ Email signature HTML", "☐ Email marketing template",
               "☐ PowerPoint/Slides template"] if en else
              ["☐ Logo: SVG, PNG (transparente), PDF", "☐ App icon 1024x1024", "☐ Favicons (16, 32, 180px)",
               "☐ Perfiles sociales 800x800", "☐ Portadas sociales (por plataforma)", "☐ Firma de email HTML",
               "☐ Plantilla de email marketing", "☐ Plantilla PowerPoint/Slides"]):
        story.append(Paragraph(i, st['bullet']))
    story.append(Paragraph("Print Materials" if en else "Materiales Impresos", st['h2']))
    for i in (["☐ Business cards (500)", "☐ Letterhead template", "☐ #10 Envelopes", "☐ Client folders",
               "☐ Tax season flyers (EN & ES)", "☐ Roll-up banner", "☐ Window signage", "☐ Branded pens & notepads"] if en else
              ["☐ Tarjetas (500)", "☐ Membrete", "☐ Sobres #10", "☐ Carpetas de cliente",
               "☐ Flyers de temporada (EN & ES)", "☐ Banner roll-up", "☐ Señalización", "☐ Bolígrafos y libretas"]):
        story.append(Paragraph(i, st['bullet']))
    story.append(Paragraph("Technology (Built ✅)" if en else "Tecnología (Construido ✅)", st['h2']))
    for i in ["✅ Mi Reembolso — iOS/Android app", "✅ Admin Dashboard (Next.js)", "✅ Tax Wizard + IRS TIN Matching",
              "✅ IRS Refund Tracker", "✅ NMI Payments (Cards & ACH)", "✅ SendGrid Emails + Push Notifications",
              "✅ Bilingual (EN/ES) i18n", "✅ EAS Builds → TestFlight"]:
        story.append(Paragraph(i, st['bullet']))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(C["secondary"]), spaceAfter=10))
    story.append(Paragraph(f"Ross Tax Preparation LLC — Brand Identity Guide v1.0<br/>{datetime.now().strftime('%B %Y')} — {'Confidential' if en else 'Confidencial'}", st['footer']))

    doc.build(story)
    print(f"✅ PDF: {output_path}")


# ═══════════════════════════════════════════
# ROSS FINANCIAL EN
# ═══════════════════════════════════════════
def generate_financial_en(output_path):
    C = FIN
    doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    st = mk_styles(C["primary"], C["secondary"])
    story = []

    # COVER
    story.append(Spacer(1, 80))
    logo = Drawing(420, 90)
    logo.add(Rect(0, 0, 420, 90, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=10))
    logo.add(String(25, 55, "ROSS", fontSize=36, fontName='Helvetica-Bold', fillColor=white))
    logo.add(String(25, 25, "FINANCIAL SERVICES", fontSize=18, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    logo.add(Rect(385, 18, 3, 48, fillColor=HexColor(C["accent"]), strokeWidth=0))
    story.append(logo)
    story.append(Spacer(1, 25))
    story.append(Paragraph("Complete Brand Identity Guide", st['subtitle']))
    story.append(HRFlowable(width="60%", thickness=2, color=HexColor(C["accent"]), spaceBefore=10, spaceAfter=10))
    story.append(Paragraph("Brand Identity Guide 2025", st['footer']))
    story.append(Spacer(1, 50))
    ci = [["Company:", "Ross Financial Services LLC"], ["Industry:", "Credit Access Business (CAB) — Texas"],
          ["Founder:", "Yoandy Ross"], ["Date:", datetime.now().strftime("%B %Y")], ["Version:", "1.0"]]
    ct = Table(ci, colWidths=[120, 300])
    ct.setStyle(TableStyle([('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 11), ('TEXTCOLOR', (0,0), (0,-1), HexColor(C["primary"])),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8), ('ALIGN', (0,0), (0,-1), 'RIGHT')]))
    story.append(ct)
    story.append(Spacer(1, 40))
    story.append(Paragraph("CONFIDENTIAL — Internal use only",
        ParagraphStyle('X', parent=st['bc'], fontSize=9, textColor=HexColor("#DC2626"), fontName='Helvetica-Bold')))
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("Table of Contents", st['h1']))
    story.append(mk_hr(C["primary"]))
    for i in ["1. Brand Vision & Mission", "2. Primary Color Palette", "3. Secondary & Functional Colors",
              "4. Typography", "5. Logo & Variations", "6. Iconography", "7. Tone of Voice & Messaging",
              "8. Business Cards", "9. Stationery & Documents", "10. Digital & Social Media",
              "11. Signage & Office", "12. Prohibited Combinations", "13. Launch Checklist"]:
        story.append(Paragraph(i, ParagraphStyle('TOC', parent=st['body'], fontSize=13, spaceBefore=5, spaceAfter=5, leftIndent=20)))
    story.append(PageBreak())

    # 1. VISION
    story.append(Paragraph("1. Brand Vision & Mission", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Mission", st['h2']))
    story.append(Paragraph("To provide fair and transparent access to financial services for the Hispanic community in Texas, combining innovative technology with personalized, trustworthy service.", st['body']))
    story.append(Paragraph("Vision", st['h2']))
    story.append(Paragraph("To become the most trusted financial services brand for the Latino community in Texas, recognized for our integrity, cutting-edge technology, and commitment to our clients' financial success.", st['body']))
    story.append(Paragraph("Brand Values", st['h2']))
    for n, d in [("Trust", "Every transaction reflects total honesty and transparency."),
                 ("Accessibility", "Financial services easy to understand and accessible to everyone."),
                 ("Innovation", "Mobile app, auto-pay, and digital tools at the service of the client."),
                 ("Community", "Committed to the economic growth of the Hispanic community."),
                 ("Professionalism", "Full compliance with OCCC regulations and banking standards.")]:
        story.append(Paragraph(f"<b>• {n}:</b> {d}", st['bullet']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('"Your Financial Success, Our Commitment"', st['quote']))
    story.append(Paragraph("USP", st['h2']))
    story.append(Paragraph("Ross Financial Services combines local trust with bank-level technology. Clients access CAB loans directly from their phone, with transparent contracts, automatic payments, and bilingual 24/7 support — all backed by the Ross family reputation.", st['body']))
    story.append(PageBreak())

    # 2. COLORS
    story.append(Paragraph("2. Primary Color Palette", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Forest Green = financial stability & trust. Navy Blue = authority & professionalism. Gold = premium & prosperity.", st['body']))
    pc_rows = [["", "Name", "HEX", "RGB", "Primary Use"],
        [sw(C["primary"]), "Forest Green\n(Primary)", "#0A5C36", "10, 92, 54", "Logo, headers,\nmain CTAs"],
        [sw(C["primary_light"]), "Emerald\n(Primary Light)", "#10B981", "16, 185, 129", "Accents, icons,\nactive states"],
        [sw(C["primary_dark"]), "Dark Forest\n(Primary Dark)", "#064E2B", "6, 78, 43", "Dark bgs,\ntext on light"],
        [sw(C["secondary"]), "Navy Blue\n(Secondary)", "#1E3A5F", "30, 58, 95", "Formal text,\nalternate sections"],
        [sw(C["accent"]), "Gold\n(Accent)", "#D4AF37", "212, 175, 55", "Premium details,\nbadges"]]
    story.append(mk_table(pc_rows, C["primary"], [60, 90, 60, 100, 130]))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Proportions: Forest Green 50% • Navy 25% • Emerald 15% • Gold 10%", st['body']))
    story.append(PageBreak())

    # 3. SECONDARY
    story.append(Paragraph("3. Secondary & Functional Colors", st['h1']))
    story.append(mk_hr(C["primary"]))
    sc_rows = [["", "Name", "HEX", "RGB", "Use"],
        [sw("#059669"), "Success", "#059669", "5, 150, 105", "Payments, approvals"],
        [sw("#F59E0B"), "Warning", "#F59E0B", "245, 158, 11", "Pending, alerts"],
        [sw("#DC2626"), "Error", "#DC2626", "220, 38, 38", "Errors, defaults"],
        [sw("#3B82F6"), "Info Blue", "#3B82F6", "59, 130, 246", "Links, info"],
        [sw("#F8FAF9"), "Background", "#F8FAF9", "248, 250, 249", "Page backgrounds"],
        [sw("#0F172A"), "Dark Mode", "#0F172A", "15, 23, 42", "Dark headers"],
        [sw("#1A1A2E"), "Text Primary", "#1A1A2E", "26, 26, 46", "Main text"]]
    story.append(mk_table(sc_rows, C["primary"], [60, 80, 60, 100, 140]))
    story.append(PageBreak())

    # 4. TYPOGRAPHY
    story.append(Paragraph("4. Typography", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("<b>Inter</b> — Primary digital font. <b>Montserrat</b> — Print secondary. Always tabular numbers for money: <b>$1,500.00</b>", st['body']))
    ty_rows = [["Element", "Font", "Weight", "Size", "Example"],
        ["H1", "Inter", "Bold (700)", "28-32px", "Your Loans"],
        ["H2", "Inter", "SemiBold (600)", "20-24px", "Payment Schedule"],
        ["Body", "Inter", "Regular (400)", "14-16px", "Your monthly..."],
        ["CTA", "Inter", "SemiBold (600)", "14-16px", "PAY NOW"],
        ["Amounts", "Inter", "Bold (700)", "24-36px", "$1,500.00"]]
    story.append(mk_table(ty_rows, C["primary"], [70, 50, 85, 65, 170]))
    story.append(PageBreak())

    # 5. LOGO
    story.append(Paragraph("5. Logo & Variations", st['h1']))
    story.append(mk_hr(C["primary"]))
    l1 = Drawing(420, 65)
    l1.add(Rect(0, 0, 420, 65, fillColor=white, strokeColor=HexColor(C["primary"]), strokeWidth=2, rx=6))
    l1.add(String(25, 35, "ROSS", fontSize=30, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    l1.add(String(25, 14, "FINANCIAL SERVICES", fontSize=14, fontName='Helvetica', fillColor=HexColor(C["secondary"])))
    l1.add(Rect(370, 12, 3, 42, fillColor=HexColor(C["accent"]), strokeWidth=0))
    story.append(l1)
    story.append(Spacer(1, 10))
    l2 = Drawing(420, 65)
    l2.add(Rect(0, 0, 420, 65, fillColor=HexColor(C["primary_dark"]), strokeWidth=0, rx=6))
    l2.add(String(25, 35, "ROSS", fontSize=30, fontName='Helvetica-Bold', fillColor=white))
    l2.add(String(25, 14, "FINANCIAL SERVICES", fontSize=14, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    l2.add(Rect(370, 12, 3, 42, fillColor=HexColor(C["accent"]), strokeWidth=0))
    story.append(l2)
    story.append(Spacer(1, 10))
    l3 = Drawing(280, 65)
    l3.add(Rect(0, 0, 65, 65, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=14))
    l3.add(String(12, 38, "RF", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    l3.add(String(12, 16, "S", fontSize=16, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    l3.add(String(80, 38, "App icon, favicon, social", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    story.append(l3)
    story.append(Paragraph("Clear space = height of 'R'. Min digital: 120px. Min print: 1.5\". Never modify.", st['body']))
    story.append(PageBreak())

    # 6-7. MESSAGING
    story.append(Paragraph("6-7. Messaging & Taglines", st['h1']))
    story.append(mk_hr(C["primary"]))
    for t in ['"Your Financial Success, Our Commitment" — Primary', '"Financial Access for Everyone" — Short',
              '"Fair Loans, Smart Technology" — Digital', '"From the Community, For the Community" — Community']:
        story.append(Paragraph(f"• {t}", st['bullet']))
    story.append(Spacer(1, 8))
    mg_rows = [["Situation", "Correct ✅", "Incorrect ❌"],
        ["Payment OK", '"Payment processed!\nYour balance is updated."', '"Transaction complete.\nRef: TXN-28394."'],
        ["Due soon", '"Your $269.45 payment is\ndue Friday. Need help?"', '"NOTICE: Payment pending.\nAvoid surcharges."'],
        ["Approved", '"Congratulations! Your\nloan has been approved!"', '"Request #4582 approved.\nReview terms."']]
    story.append(mk_table(mg_rows, C["primary"], [80, 185, 175]))
    story.append(PageBreak())

    # 8. BUSINESS CARD
    story.append(Paragraph("8. Business Cards", st['h1']))
    story.append(mk_hr(C["primary"]))
    cf = Drawing(360, 200)
    cf.add(Rect(0, 0, 360, 200, fillColor=white, strokeColor=HexColor(C["primary"]), strokeWidth=2, rx=8))
    cf.add(Rect(0, 140, 360, 60, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=8))
    cf.add(Rect(0, 140, 360, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    cf.add(String(18, 162, "ROSS", fontSize=22, fontName='Helvetica-Bold', fillColor=white))
    cf.add(String(18, 146, "FINANCIAL SERVICES", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cf.add(String(18, 108, "YOANDY ROSS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor("#1A1A2E")))
    cf.add(String(18, 92, "CEO & Founder", fontSize=9, fontName='Helvetica', fillColor=HexColor("#4A5568")))
    cf.add(String(18, 65, "(555) 123-4567", fontSize=9, fontName='Helvetica', fillColor=HexColor("#1A1A2E")))
    cf.add(String(18, 50, "yoandy@rossfinancial.com", fontSize=9, fontName='Helvetica', fillColor=HexColor("#1A1A2E")))
    cf.add(String(18, 35, "www.rossfinancialservices.com", fontSize=9, fontName='Helvetica', fillColor=HexColor("#3B82F6")))
    cf.add(String(18, 14, "CAB License #XXXXXX — OCCC Regulated", fontSize=7, fontName='Helvetica', fillColor=HexColor("#9CA3AF")))
    story.append(cf)
    story.append(Spacer(1, 12))
    cb = Drawing(360, 200)
    cb.add(Rect(0, 0, 360, 200, fillColor=HexColor(C["primary_dark"]), strokeWidth=0, rx=8))
    cb.add(String(115, 130, "ROSS", fontSize=32, fontName='Helvetica-Bold', fillColor=white))
    cb.add(String(65, 105, "FINANCIAL SERVICES", fontSize=16, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cb.add(Rect(120, 90, 120, 2, fillColor=HexColor(C["accent"]), strokeWidth=0))
    cb.add(String(70, 65, "Your Financial Success,", fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor("#A7F3D0")))
    cb.add(String(100, 48, "Our Commitment", fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor("#A7F3D0")))
    cb.add(String(90, 15, "CAB Loans | Financial Services", fontSize=8, fontName='Helvetica', fillColor=HexColor("#9CA3AF")))
    story.append(cb)
    story.append(PageBreak())

    # 12-13. CHECKLIST
    story.append(Paragraph("12. Prohibited: No green-on-green text, no non-approved logo colors, no 3+ gradients, no stretching logo, no Comic Sans.", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(PageBreak())
    story.append(Paragraph("13. Launch Checklist", st['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Legal & Regulatory", st['h2']))
    for i in ["☐ Register LLC — $300", "☐ EIN from IRS (free)", "☐ CAB license OCCC — ~$1,000", "☐ Surety Bond — ~$2,000/yr",
              "☐ Registered Agent — ~$100/yr", "☐ Business bank account", "☐ Trust Account (REQUIRED)", "☐ Liability insurance"]:
        story.append(Paragraph(i, st['bullet']))
    story.append(Paragraph("Technology (Built ✅)", st['h2']))
    for i in ["✅ CAB Backend (loans, payments, trust)", "✅ Admin Dashboard", "✅ Mobile App (cab-loans.tsx)",
              "✅ Auto-Pay NMI Vault", "✅ Contract PDFs", "✅ Email + Push Notifications", "✅ Feature Flag", "✅ OCCC Reports"]:
        story.append(Paragraph(i, st['bullet']))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(C["accent"]), spaceAfter=10))
    story.append(Paragraph(f"Ross Financial Services LLC — Brand Guide v1.0<br/>{datetime.now().strftime('%B %Y')} — Confidential", st['footer']))

    doc.build(story)
    print(f"✅ PDF: {output_path}")


# ═══════════════════════════════════════════
# EMAIL
# ═══════════════════════════════════════════
def send_pdfs(paths, to):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')

    msg = Mail(from_email=os.environ.get('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'), to_emails=to,
        subject='🎨 Complete Brand Identity Guides — Ross Tax + Ross Financial Services',
        html_content="""
        <div style="font-family:Arial;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#6C1110,#ED201D);padding:30px;text-align:center;border-radius:10px 10px 0 0">
                <h1 style="color:#fff;margin:0;font-size:20px">ROSS TAX PREPARATION</h1>
                <p style="color:#5DC1D9;margin:5px 0">&amp; ROSS FINANCIAL SERVICES</p>
            </div>
            <div style="background:#fff;padding:30px;border:1px solid #e2e8f0">
                <h2 style="color:#1a1a2e;margin-top:0">Complete Brand Guides — 3 PDFs</h2>
                <div style="background:#FFF9F9;border-left:4px solid #6C1110;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#6C1110;margin:0;font-weight:bold">📄 Ross Tax Preparation — Brand Guide (English)</p>
                </div>
                <div style="background:#FFF9F9;border-left:4px solid #ED201D;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#ED201D;margin:0;font-weight:bold">📄 Ross Tax Preparation — Guía de Marca (Español)</p>
                </div>
                <div style="background:#F0FDF4;border-left:4px solid #0A5C36;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#0A5C36;margin:0;font-weight:bold">📄 Ross Financial Services — Brand Guide (English)</p>
                </div>
                <ul style="color:#4a5568;line-height:1.8">
                    <li>Color palettes (HEX, RGB, CMYK)</li>
                    <li>Typography specifications</li>
                    <li>Logo variations & guidelines</li>
                    <li>Business card designs</li>
                    <li>Messaging & tone of voice</li>
                    <li>Digital & social media guidelines</li>
                    <li>Signage & promotional materials</li>
                    <li>Launch checklists</li>
                </ul>
                <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:15px;margin:20px 0;border-radius:4px">
                    <p style="color:#92400E;margin:0">💡 <b>Next:</b> Share with a graphic designer for final logos.</p>
                </div>
            </div>
            <div style="background:#1A0505;padding:15px;text-align:center;border-radius:0 0 10px 10px">
                <p style="color:#9CA3AF;font-size:11px;margin:0">Ross Tax Preparation LLC &amp; Ross Financial Services LLC<br/>Brand Identity Guides v1.0</p>
            </div>
        </div>""")

    for p in paths:
        with open(p, 'rb') as f:
            data = f.read()
        a = Attachment()
        a.file_content = FileContent(base64.b64encode(data).decode('utf-8'))
        a.file_name = FileName(os.path.basename(p))
        a.file_type = FileType('application/pdf')
        a.disposition = Disposition('attachment')
        msg.add_attachment(a)

    sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
    r = sg.send(msg)
    print(f"📧 Email → {to} — Status: {r.status_code}")


if __name__ == "__main__":
    p1 = "/app/memory/Ross_Tax_Brand_Guide_EN.pdf"
    p2 = "/app/memory/Ross_Tax_Guia_Marca_ES.pdf"
    p3 = "/app/memory/Ross_Financial_Brand_Guide_EN.pdf"

    print("=" * 60)
    print("🎨 Ross Tax Preparation — English")
    generate_ross_tax_pdf(p1, "en")

    print("=" * 60)
    print("🎨 Ross Tax Preparation — Español")
    generate_ross_tax_pdf(p2, "es")

    print("=" * 60)
    print("🎨 Ross Financial Services — English")
    generate_financial_en(p3)

    print("=" * 60)
    print("📧 Sending all 3 PDFs...")
    send_pdfs([p1, p2, p3], "yoandyross@gmail.com")
    print("✅ Done!")
