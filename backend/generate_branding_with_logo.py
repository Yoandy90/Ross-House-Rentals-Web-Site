#!/usr/bin/env python3
"""
Regenerate Ross Tax PDFs with actual logo integrated.
Also regenerate Ross Financial PDF and send all via email.
"""
import os, sys, base64
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image as RLImage
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import inch

LOGO_WHITE_BG = "/app/memory/ross_tax_logo.jpg"
LOGO_DARK_BG = "/app/memory/ross_tax_logo_dark.jpg"
LOGO_SMALL = "/app/memory/ross_tax_logo_small.jpg"

TAX = {
    "primary": "#6C1110", "primary_rgb": "108, 17, 16", "primary_cmyk": "32, 98, 98, 47",
    "secondary": "#ED201D", "secondary_rgb": "237, 32, 29", "secondary_cmyk": "0, 99, 97, 0",
    "accent": "#5DC1D9", "accent_rgb": "93, 193, 217", "accent_cmyk": "58, 4, 12, 0",
    "primary_dark": "#4A0B0A", "secondary_light": "#F25A58",
    "accent_dark": "#3A9BB0", "accent_light": "#A3DDE9",
    "success": "#059669", "warning": "#F59E0B", "error": "#DC2626",
    "bg_light": "#FFF9F9", "bg_dark": "#1A0505",
    "text_primary": "#1A1A2E", "text_secondary": "#4A5568", "text_light": "#9CA3AF", "gold": "#D4AF37",
}

FIN = {
    "primary": "#0A5C36", "primary_light": "#10B981", "primary_dark": "#064E2B",
    "secondary": "#1E3A5F", "secondary_light": "#3B82F6",
    "accent": "#D4AF37", "accent_light": "#F59E0B",
    "success": "#059669", "warning": "#F59E0B", "error": "#DC2626",
    "bg_light": "#F8FAF9", "bg_dark": "#0F172A",
    "text_primary": "#1A1A2E", "text_secondary": "#4A5568", "text_light": "#9CA3AF",
}


def sw(color, w=55, h=35):
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=HexColor(color), strokeColor=HexColor("#E5E7EB"), strokeWidth=0.5, rx=3))
    return d


def mk_styles(pc, sc):
    ss = getSampleStyleSheet()
    return {
        'h1': ParagraphStyle('H1', parent=ss['Heading1'], fontSize=22, textColor=HexColor(pc), spaceBefore=20, spaceAfter=12, fontName='Helvetica-Bold'),
        'h2': ParagraphStyle('H2', parent=ss['Heading2'], fontSize=16, textColor=HexColor(sc), spaceBefore=16, spaceAfter=8, fontName='Helvetica-Bold'),
        'h3': ParagraphStyle('H3', parent=ss['Heading3'], fontSize=13, textColor=HexColor(pc), spaceBefore=10, spaceAfter=6, fontName='Helvetica-Bold'),
        'body': ParagraphStyle('B', parent=ss['Normal'], fontSize=11, textColor=HexColor("#1A1A2E"), spaceAfter=8, fontName='Helvetica', leading=16, alignment=TA_JUSTIFY),
        'bc': ParagraphStyle('BC', parent=ss['Normal'], fontSize=11, textColor=HexColor("#1A1A2E"), spaceAfter=8, fontName='Helvetica', alignment=TA_CENTER),
        'subtitle': ParagraphStyle('Sub', parent=ss['Normal'], fontSize=14, textColor=HexColor(sc), spaceAfter=20, fontName='Helvetica', alignment=TA_CENTER),
        'bullet': ParagraphStyle('BL', parent=ss['Normal'], fontSize=11, textColor=HexColor("#1A1A2E"), leftIndent=20, bulletIndent=8, spaceBefore=2, spaceAfter=4, fontName='Helvetica', leading=16),
        'quote': ParagraphStyle('Q', parent=ss['Normal'], fontSize=12, fontName='Helvetica-Oblique', textColor=HexColor(sc), alignment=TA_CENTER, spaceBefore=12, spaceAfter=12, leftIndent=30, rightIndent=30),
        'caption': ParagraphStyle('C', parent=ss['Normal'], fontSize=9, textColor=HexColor("#4A5568"), fontName='Helvetica-Oblique'),
        'footer': ParagraphStyle('F', parent=ss['Normal'], fontSize=9, textColor=HexColor("#9CA3AF"), alignment=TA_CENTER),
    }


def mk_hr(c): return HRFlowable(width="100%", thickness=1, color=HexColor(c), spaceAfter=15)

def mk_table(rows, pc, widths):
    t = Table(rows, colWidths=widths)
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BACKGROUND', (0,0), (-1,0), HexColor(pc)), ('TEXTCOLOR', (0,0), (-1,0), white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor("#E5E7EB")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, HexColor("#FAFAFA")]),
        ('TOPPADDING', (0,0), (-1,-1), 7), ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    return t


def generate_ross_tax(path, lang="en"):
    C = TAX
    en = lang == "en"
    doc = SimpleDocTemplate(path, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    s = mk_styles(C["primary"], C["secondary"])
    story = []

    # ═══ COVER ═══
    story.append(Spacer(1, 40))
    # Real logo - white background version
    story.append(RLImage(LOGO_WHITE_BG, width=320, height=160))
    story.append(Spacer(1, 20))
    story.append(Paragraph("Complete Brand Identity Guide" if en else "Guía Completa de Identidad de Marca", s['subtitle']))
    story.append(HRFlowable(width="60%", thickness=2, color=HexColor(C["secondary"]), spaceBefore=8, spaceAfter=8))
    story.append(Paragraph("Brand Identity Guide 2025", s['footer']))
    story.append(Spacer(1, 40))
    ci = [["Company:" if en else "Empresa:", "Ross Tax Preparation LLC"],
          ["Industry:" if en else "Industria:", "Tax Preparation & Financial Services"],
          ["Founder:" if en else "Fundador:", "Yoandy Ross"],
          ["Date:" if en else "Fecha:", datetime.now().strftime("%B %Y")], ["Version:" if en else "Versión:", "1.0"]]
    ct = Table(ci, colWidths=[120, 300])
    ct.setStyle(TableStyle([('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTNAME',(1,0),(1,-1),'Helvetica'),
        ('FONTSIZE',(0,0),(-1,-1),11),('TEXTCOLOR',(0,0),(0,-1),HexColor(C["primary"])),('BOTTOMPADDING',(0,0),(-1,-1),8),('ALIGN',(0,0),(0,-1),'RIGHT')]))
    story.append(ct)
    story.append(Spacer(1, 30))
    story.append(Paragraph("CONFIDENTIAL" if en else "CONFIDENCIAL",
        ParagraphStyle('X', parent=s['bc'], fontSize=9, textColor=HexColor(C["error"]), fontName='Helvetica-Bold')))
    story.append(PageBreak())

    # ═══ TOC ═══
    story.append(Paragraph("Table of Contents" if en else "Contenido", s['h1']))
    story.append(mk_hr(C["primary"]))
    toc_en = ["1. Brand Vision & Mission","2. Primary Color Palette","3. Secondary & Functional Colors","4. Typography",
              "5. Logo & Variations","6. Iconography","7. Tone of Voice & Messaging","8. Business Cards",
              "9. Stationery & Documents","10. Digital & Social Media","11. Signage & Office",
              "12. Prohibited Combinations","13. Photography","14. Launch Checklist"]
    toc_es = ["1. Visión y Misión","2. Paleta de Colores Principal","3. Colores Secundarios","4. Tipografía",
              "5. Logotipo y Variaciones","6. Iconografía","7. Tono de Voz","8. Tarjetas de Presentación",
              "9. Papelería","10. Digital y Redes Sociales","11. Señalización","12. Combinaciones Prohibidas",
              "13. Fotografía","14. Checklist"]
    for item in (toc_en if en else toc_es):
        story.append(Paragraph(item, ParagraphStyle('TOC', parent=s['body'], fontSize=13, spaceBefore=5, spaceAfter=5, leftIndent=20)))
    story.append(PageBreak())

    # ═══ 1. VISION ═══
    story.append(Paragraph("1. Brand Vision & Mission" if en else "1. Visión y Misión de la Marca", s['h1']))
    story.append(mk_hr(C["primary"]))
    # Mini logo in section header
    story.append(RLImage(LOGO_SMALL, width=120, height=60))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Mission" if en else "Misión", s['h2']))
    story.append(Paragraph("To provide accurate, affordable, and personalized tax preparation services to the Hispanic community and beyond, leveraging cutting-edge technology to maximize refunds and simplify the tax filing experience." if en else
        "Proveer servicios de preparación de impuestos precisos, accesibles y personalizados para la comunidad hispana y más allá, utilizando tecnología de punta para maximizar reembolsos y simplificar la experiencia de declaración.", s['body']))
    story.append(Paragraph("Vision" if en else "Visión", s['h2']))
    story.append(Paragraph("To become the most trusted tax preparation and financial services brand in the Hispanic community, recognized for our innovation, integrity, and commitment to our clients' financial success." if en else
        "Ser la marca más confiable de preparación de impuestos y servicios financieros de la comunidad hispana, reconocida por nuestra innovación, integridad y compromiso con el éxito financiero de nuestros clientes.", s['body']))
    story.append(Paragraph("Brand Values" if en else "Valores de Marca", s['h2']))
    vals = [("Accuracy" if en else "Precisión", "Every tax return prepared with meticulous detail, ensuring maximum legal refunds." if en else "Cada declaración preparada con detalle meticuloso, asegurando máximos reembolsos legales."),
            ("Trust" if en else "Confianza", "Lasting relationships through transparency, honesty, and consistent quality." if en else "Relaciones duraderas a través de transparencia, honestidad y calidad consistente."),
            ("Innovation" if en else "Innovación", "Mobile app and digital tools set us apart — file from anywhere, anytime." if en else "App móvil y herramientas digitales nos distinguen — declara desde cualquier lugar."),
            ("Community" if en else "Comunidad", "Bilingual support, cultural understanding, and respect for our community." if en else "Soporte bilingüe, comprensión cultural y respeto por nuestra comunidad."),
            ("Empowerment" if en else "Empoderamiento", "We educate clients about tax benefits they didn't know existed." if en else "Educamos a clientes sobre beneficios fiscales que desconocían.")]
    for n, d in vals:
        story.append(Paragraph(f"<b>• {n}:</b> {d}", s['bullet']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('"Your Refund, Our Priority"' if en else '"Tu Reembolso, Nuestra Prioridad"', s['quote']))
    story.append(PageBreak())

    # ═══ 2. PRIMARY COLORS ═══
    story.append(Paragraph("2. Primary Color Palette" if en else "2. Paleta de Colores Principal", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("The three brand colors are directly derived from the official Ross Tax logo:" if en else
        "Los tres colores de marca se derivan directamente del logo oficial de Ross Tax:", s['body']))

    # Show logo with color annotations
    story.append(RLImage(LOGO_WHITE_BG, width=250, height=125))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Logo Color Breakdown:" if en else "Desglose de Colores del Logo:", s['h3']))
    story.append(Paragraph(
        '• <b>"R" and "SS" letters:</b> Dark Maroon (#6C1110) — The dominant brand color<br/>'
        '• <b>"O" circle ring:</b> Bright Red (#ED201D) — Energy and urgency accent<br/>'
        '• <b>Document/paper icon inside "O":</b> Sky Blue (#5DC1D9) — Trust and technology' if en else
        '• <b>Letras "R" y "SS":</b> Marrón Oscuro (#6C1110) — El color dominante de la marca<br/>'
        '• <b>Anillo circular de la "O":</b> Rojo Brillante (#ED201D) — Acento de energía y urgencia<br/>'
        '• <b>Ícono de documento dentro de la "O":</b> Azul Cielo (#5DC1D9) — Confianza y tecnología', s['body']))

    story.append(Spacer(1, 10))
    pc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB / CMYK", "Use" if en else "Uso"],
        [sw(C["primary"]), "Dark Maroon\n(Primary)" if en else "Marrón Oscuro\n(Primario)", C["primary"],
         f"RGB: {C['primary_rgb']}\nCMYK: {C['primary_cmyk']}", "Logo letters R, SS\nHeaders, main CTAs" if en else "Letras R, SS del logo\nEncabezados, CTAs"],
        [sw(C["secondary"]), "Bright Red\n(Secondary)" if en else "Rojo Brillante\n(Secundario)", C["secondary"],
         f"RGB: {C['secondary_rgb']}\nCMYK: {C['secondary_cmyk']}", 'Logo "O" ring\nAccents, refund amounts' if en else 'Anillo "O" del logo\nAcentos, reembolsos'],
        [sw(C["accent"]), "Sky Blue\n(Accent)" if en else "Azul Cielo\n(Acento)", C["accent"],
         f"RGB: {C['accent_rgb']}\nCMYK: {C['accent_cmyk']}", "Logo document icon\nLinks, trust elements" if en else "Ícono documento del logo\nLinks, confianza"]]
    story.append(mk_table(pc_rows, C["primary"], [60, 90, 60, 115, 115]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Usage Proportions" if en else "Proporciones de Uso", s['h3']))
    prop = Drawing(450, 50)
    prop.add(Rect(0, 10, 200, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    prop.add(Rect(200, 10, 135, 30, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    prop.add(Rect(335, 10, 115, 30, fillColor=HexColor(C["accent"]), strokeWidth=0))
    prop.add(String(78, 20, "45%", fontSize=13, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(253, 20, "30%", fontSize=12, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(378, 20, "25%", fontSize=12, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    story.append(prop)
    story.append(PageBreak())

    # ═══ 3. SECONDARY COLORS ═══
    story.append(Paragraph("3. Secondary & Functional Colors" if en else "3. Colores Secundarios y Funcionales", s['h1']))
    story.append(mk_hr(C["primary"]))
    sc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB", "Use" if en else "Uso"],
        [sw(C["primary_dark"]), "Deep Maroon", "#4A0B0A", "74, 11, 10", "Dark backgrounds" if en else "Fondos oscuros"],
        [sw(C["secondary_light"]), "Salmon Red", "#F25A58", "242, 90, 88", "Hover states" if en else "Estados hover"],
        [sw(C["accent_dark"]), "Deep Blue", "#3A9BB0", "58, 155, 176", "Active elements" if en else "Elementos activos"],
        [sw(C["accent_light"]), "Light Blue", "#A3DDE9", "163, 221, 233", "Info boxes" if en else "Cajas info"],
        [sw(C["success"]), "Success", "#059669", "5, 150, 105", "Approved" if en else "Aprobado"],
        [sw(C["warning"]), "Warning", "#F59E0B", "245, 158, 11", "Pending" if en else "Pendiente"],
        [sw(C["error"]), "Error", "#DC2626", "220, 38, 38", "Errors" if en else "Errores"],
        [sw("#F7F7F8"), "Background", "#F7F7F8", "247, 247, 248", "Page bg" if en else "Fondos"],
        [sw(C["text_primary"]), "Text Primary", "#1A1A2E", "26, 26, 46", "Main text" if en else "Texto principal"]]
    story.append(mk_table(sc_rows, C["primary"], [60, 80, 60, 100, 140]))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Approved Gradients" if en else "Gradientes Aprobados", s['h3']))
    gr = [["Gradient" if en else "Gradiente", "From" if en else "De", "To" if en else "A", "Use" if en else "Uso"],
          ["Primary" if en else "Principal", C["primary"], C["secondary"], "Heroes, banners, CTAs"],
          ["Premium", C["primary_dark"], C["gold"], "VIP, certificates" if en else "VIP, certificados"],
          ["Trust" if en else "Confianza", C["accent_dark"], C["accent"], "Info sections"],
          ["Energy" if en else "Energía", C["secondary"], C["secondary_light"], "Promotions" if en else "Promociones"]]
    story.append(mk_table(gr, C["primary"], [90, 90, 90, 170]))
    story.append(PageBreak())

    # ═══ 4. TYPOGRAPHY ═══
    story.append(Paragraph("4. Typography" if en else "4. Tipografía", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("<b>Inter</b> — Primary digital font. Modern, readable, excellent Spanish character support. Free via Google Fonts." if en else
        "<b>Inter</b> — Fuente digital principal. Moderna, legible, excelente soporte español. Gratuita vía Google Fonts.", s['body']))
    ty = [["Element" if en else "Elemento", "Font" if en else "Fuente", "Weight" if en else "Peso", "Size" if en else "Tamaño", "Example" if en else "Ejemplo"],
        ["H1", "Inter", "Bold (700)", "28-32px", "Your Refund" if en else "Tu Reembolso"],
        ["H2", "Inter", "SemiBold (600)", "20-24px", "Tax Summary" if en else "Resumen Fiscal"],
        ["H3", "Inter", "SemiBold (600)", "16-18px", "W-2 Income" if en else "Ingresos W-2"],
        ["Body", "Inter", "Regular (400)", "14-16px", "Your filing..." if en else "Tu estado..."],
        ["Caption", "Inter", "Regular (400)", "11-12px", "Updated" if en else "Actualizado"],
        ["CTA", "Inter", "SemiBold (600)", "14-16px", "FILE NOW" if en else "DECLARAR"],
        ["Amounts" if en else "Montos", "Inter", "Bold (700)", "24-36px", "$3,847.00"]]
    story.append(mk_table(ty, C["primary"], [70, 50, 85, 65, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Print: <b>Montserrat</b>. Numbers: tabular, <b>$12,345.67</b>. Refunds: <b>Bright Red, Bold, 24-36px</b>.", s['body']))
    story.append(PageBreak())

    # ═══ 5. LOGO ═══
    story.append(Paragraph("5. Logo & Variations" if en else "5. Logotipo y Variaciones", s['h1']))
    story.append(mk_hr(C["primary"]))

    story.append(Paragraph("Official Logo" if en else "Logo Oficial", s['h2']))
    story.append(Paragraph("The Ross Tax logo features 'ROSS' in bold maroon letters with the 'O' replaced by a bright red circle containing a sky blue document icon — representing tax documents and financial services." if en else
        "El logo de Ross Tax presenta 'ROSS' en letras marrón bold con la 'O' reemplazada por un círculo rojo brillante que contiene un ícono de documento azul cielo — representando documentos fiscales y servicios financieros.", s['body']))

    # Primary logo - white background
    story.append(Paragraph("Primary Version (Light Background)" if en else "Versión Principal (Fondo Claro)", s['h3']))
    story.append(RLImage(LOGO_WHITE_BG, width=300, height=150))
    story.append(Spacer(1, 12))

    # Inverse logo - dark background
    story.append(Paragraph("Inverse Version (Dark Background)" if en else "Versión Inversa (Fondo Oscuro)", s['h3']))
    story.append(RLImage(LOGO_DARK_BG, width=300, height=150))
    story.append(Spacer(1, 12))

    # Logo anatomy
    story.append(Paragraph("Logo Anatomy" if en else "Anatomía del Logo", s['h3']))
    story.append(Paragraph(
        '• <b>"R":</b> Dark Maroon (#6C1110) — Bold, serif-style character<br/>'
        '• <b>"O" outer ring:</b> Bright Red (#ED201D) — Perfect circle, 360° border<br/>'
        '• <b>"O" inner icon:</b> Sky Blue (#5DC1D9) — Stylized document with lines representing text<br/>'
        '• <b>"SS":</b> Dark Maroon (#6C1110) — Matching the "R" weight and style<br/>'
        '• <b>"Tax Preparation LLC":</b> Black text, clean sans-serif below the main wordmark' if en else
        '• <b>"R":</b> Marrón Oscuro (#6C1110) — Carácter bold, estilo serif<br/>'
        '• <b>Anillo exterior "O":</b> Rojo Brillante (#ED201D) — Círculo perfecto, borde 360°<br/>'
        '• <b>Ícono interior "O":</b> Azul Cielo (#5DC1D9) — Documento estilizado con líneas de texto<br/>'
        '• <b>"SS":</b> Marrón Oscuro (#6C1110) — Mismo peso y estilo que la "R"<br/>'
        '• <b>"Tax Preparation LLC":</b> Texto negro, sans-serif limpio debajo del wordmark', s['body']))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Rules" if en else "Reglas", s['h3']))
    story.append(Paragraph(
        "• Clear space: Height of 'R' on all sides • Min digital: 120px • Min print: 1.5\" • Never stretch, rotate, or recolor • "
        "Never separate the icon from the wordmark • The document icon inside the 'O' must always be Sky Blue" if en else
        "• Zona clara: Altura de 'R' en todos los lados • Mín. digital: 120px • Mín. impreso: 1.5\" • Nunca estirar, rotar o recolorear • "
        "Nunca separar el ícono del wordmark • El ícono de documento dentro de la 'O' siempre debe ser Azul Cielo", s['body']))
    story.append(PageBreak())

    # ═══ 6. ICONOGRAPHY ═══
    story.append(Paragraph("6. Iconography" if en else "6. Iconografía", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Library: <b>Ionicons</b>. Outline = normal, filled = active. Brand colors only." if en else
        "Biblioteca: <b>Ionicons</b>. Outline = normal, filled = activo. Solo colores de marca.", s['body']))
    ic = [["Concept" if en else "Concepto", "Icon" if en else "Ícono", "Color", "Use" if en else "Uso"],
        ["Tax Filing" if en else "Declaración", "document-text", C["primary"], "Returns" if en else "Declaraciones"],
        ["Refund" if en else "Reembolso", "cash-outline", C["secondary"], "Amounts" if en else "Montos"],
        ["Appointments" if en else "Citas", "calendar", C["accent_dark"], "Schedule" if en else "Agenda"],
        ["Documents" if en else "Documentos", "folder-open", C["primary"], "W-2s, 1099s"],
        ["Payments" if en else "Pagos", "card-outline", C["accent_dark"], "Methods" if en else "Métodos"],
        ["Approved" if en else "Aprobado", "checkmark-circle", C["success"], "Success" if en else "Éxito"],
        ["Pending" if en else "Pendiente", "time-outline", C["warning"], "Processing" if en else "Procesando"],
        ["Rejected" if en else "Rechazado", "close-circle", C["error"], "Errors" if en else "Errores"]]
    story.append(mk_table(ic, C["primary"], [80, 120, 70, 170]))
    story.append(PageBreak())

    # ═══ 7. TONE OF VOICE ═══
    story.append(Paragraph("7. Tone of Voice" if en else "7. Tono de Voz", s['h1']))
    story.append(mk_hr(C["primary"]))
    pe = [["Attribute" if en else "Atributo", "We Are" if en else "Somos", "We Are Not" if en else "No Somos"],
        ["Tone" if en else "Tono", "Warm, professional" if en else "Cálido, profesional", "Cold, intimidating" if en else "Frío, intimidante"],
        ["Language" if en else "Lenguaje", "Clear, bilingual" if en else "Claro, bilingüe", "IRS jargon" if en else "Jerga del IRS"],
        ["Attitude" if en else "Actitud", "Helpful guide" if en else "Guía servicial", "Condescending" if en else "Condescendiente"]]
    story.append(mk_table(pe, C["primary"], [100, 170, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Taglines", s['h2']))
    for t in (['"Your Refund, Our Priority"', '"Maximum Refund, Guaranteed"',
               '"File Smart. File Fast. File Ross."', '"From the community, for the community"'] if en else
              ['"Tu Reembolso, Nuestra Prioridad"', '"Máximo Reembolso, Garantizado"',
               '"Declara Inteligente. Declara Rápido. Declara con Ross."', '"De la comunidad, para la comunidad"']):
        story.append(Paragraph(f"• {t}", s['bullet']))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Messaging Examples" if en else "Ejemplos de Mensajería", s['h2']))
    mg = [["Situation" if en else "Situación", "Correct ✅" if en else "Correcto ✅", "Incorrect ❌" if en else "Incorrecto ❌"],
        ["Refund" if en else "Reembolso", '"Great news! Your $3,847\nrefund is approved!"' if en else '"¡Tu reembolso de $3,847\nfue aprobado!"',
         '"Refund approved.\nRef: TX-4921."' if en else '"Reembolso aprobado.\nRef: TX-4921."'],
        ["Document" if en else "Documento", '"We just need your W-2\n— tap to upload!"' if en else '"Solo necesitamos tu W-2\n¡toca para subir!"',
         '"Missing W-2.\nSubmit now."' if en else '"W-2 faltante."'],
        ["Welcome" if en else "Bienvenida", '"Welcome to Ross Tax!\nMax refund guaranteed."' if en else '"¡Bienvenido a Ross Tax!\nMáximo reembolso garantizado."',
         '"Account created."' if en else '"Cuenta creada."']]
    story.append(mk_table(mg, C["primary"], [70, 185, 185]))
    story.append(PageBreak())

    # ═══ 8. BUSINESS CARDS ═══
    story.append(Paragraph("8. Business Cards" if en else "8. Tarjetas de Presentación", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Front Design" if en else "Diseño Frontal", s['h2']))
    # Card front with real logo
    cf = Drawing(360, 200)
    cf.add(Rect(0, 0, 360, 200, fillColor=white, strokeColor=HexColor(C["primary"]), strokeWidth=2, rx=8))
    cf.add(Rect(0, 140, 360, 60, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=8))
    cf.add(Rect(0, 140, 360, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    cf.add(String(18, 160, "ROSS TAX PREPARATION", fontSize=14, fontName='Helvetica-Bold', fillColor=white))
    cf.add(String(18, 146, "LLC", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cf.add(String(18, 108, "YOANDY ROSS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 92, "CEO & Founder | Tax Preparer", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    cf.add(String(18, 65, "(555) 123-4567", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 50, "yoandy@rosstaxpreparation.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 35, "www.rosstaxpreparation.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["accent_dark"])))
    cf.add(String(18, 14, "PTIN: P0XXXXXXX | EFIN: XXXXXX", fontSize=7, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    story.append(cf)
    story.append(Spacer(1, 12))
    story.append(Paragraph("Back Design" if en else "Diseño Trasero", s['h2']))
    cb = Drawing(360, 200)
    cb.add(Rect(0, 0, 360, 200, fillColor=HexColor(C["primary_dark"]), strokeWidth=0, rx=8))
    cb.add(String(85, 130, "ROSS TAX", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    cb.add(String(75, 108, "PREPARATION", fontSize=18, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    cb.add(Rect(105, 92, 150, 2, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    tag = "Your Refund, Our Priority" if en else "Tu Reembolso, Nuestra Prioridad"
    cb.add(String(78 if en else 58, 72, tag, fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor(C["accent_light"])))
    cb.add(String(95, 28, "Tax | Bookkeeping | Payroll", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    cb.add(String(105, 12, "Bilingual: English & Spanish" if en else "Bilingüe: English & Español", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["accent"])))
    story.append(cb)
    story.append(Spacer(1, 8))
    story.append(Paragraph("3.5\" x 2\" • 16pt matte/silk • Soft touch + spot UV optional" if en else
        "3.5\" x 2\" • 16pt matte/silk • Soft touch + spot UV opcional", s['caption']))
    story.append(PageBreak())

    # ═══ 9. STATIONERY ═══
    story.append(Paragraph("9. Stationery" if en else "9. Papelería", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Letterhead" if en else "Membrete", s['h2']))
    # Show how logo appears on letterhead
    story.append(RLImage(LOGO_SMALL, width=100, height=50))
    story.append(Spacer(1, 6))
    story.append(Paragraph("The official logo should appear in the top-left corner of all letterhead and official documents. Size: 1.5\" wide minimum." if en else
        "El logo oficial debe aparecer en la esquina superior izquierda de todo membrete y documentos oficiales. Tamaño: 1.5\" de ancho mínimo.", s['body']))
    story.append(Paragraph("Header: Maroon stripe + logo. Footer: red line + address + PTIN/EFIN. Body: Inter 11pt." if en else
        "Header: Franja marrón + logo. Footer: línea roja + dirección + PTIN/EFIN. Cuerpo: Inter 11pt.", s['body']))
    story.append(Paragraph("Tax Documents" if en else "Documentos Fiscales", s['h2']))
    story.append(Paragraph("Client cover: Logo + maroon header. Invoice: Blue header, refund in red bold. Privacy notice: maroon left border." if en else
        "Portada: Logo + header marrón. Factura: Header azul, reembolso en rojo bold. Privacidad: borde izquierdo marrón.", s['body']))
    story.append(PageBreak())

    # ═══ 10. DIGITAL ═══
    story.append(Paragraph("10. Digital & Social Media" if en else "10. Digital y Redes Sociales", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Mobile App — Mi Reembolso", s['h2']))
    story.append(Paragraph("App Icon: Use the 'O' from the logo (red circle with blue document icon) as the app icon — instantly recognizable. Splash screen: full logo centered on maroon background." if en else
        "App Icon: Usar la 'O' del logo (círculo rojo con ícono de documento azul) como ícono de la app — instantáneamente reconocible. Splash screen: logo completo centrado en fondo marrón.", s['body']))
    story.append(Paragraph("Social Media", s['h2']))
    sm = [["Platform" if en else "Plataforma", "Profile Photo" if en else "Foto de Perfil", "Content" if en else "Contenido"],
        ["Facebook", 'Full logo on white bg\nor "O" icon on maroon' if en else 'Logo completo en blanco\no ícono "O" en marrón',
         "Tax tips, deadlines" if en else "Tips, fechas límite"],
        ["Instagram", '"O" icon on maroon bg' if en else 'Ícono "O" en fondo marrón',
         "Testimonials, infographics" if en else "Testimonios, infografías"],
        ["TikTok", '"O" icon on maroon bg' if en else 'Ícono "O" en fondo marrón',
         "Quick tips, myth busting" if en else "Tips rápidos, rompiendo mitos"],
        ["LinkedIn", "Full logo on white bg" if en else "Logo completo en blanco",
         "Professional, achievements" if en else "Profesional, logros"]]
    story.append(mk_table(sm, C["primary"], [80, 145, 215]))
    story.append(PageBreak())

    # ═══ 11. SIGNAGE ═══
    story.append(Paragraph("11. Signage & Office" if en else "11. Señalización y Oficina", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Exterior: Illuminated sign with logo. The 'O' circle can be backlit in red for nighttime visibility. 5'x2.5'." if en else
        "Exterior: Letrero iluminado con logo. El círculo 'O' puede estar retroiluminado en rojo para visibilidad nocturna. 5'x2.5'.", s['body']))
    story.append(Paragraph("Reception: 3D logo on wall. White walls, one maroon accent wall. TV with app demo." if en else
        "Recepción: Logo 3D en pared. Paredes blancas, una pared acento marrón. TV con demo de app.", s['body']))
    story.append(Paragraph("Promo: Flyers, roll-ups, t-shirts (maroon, white logo), caps, pens, tote bags, 'Se Habla Español' window clings." if en else
        "Promo: Flyers, roll-ups, camisetas (marrón, logo blanco), gorras, bolígrafos, bolsas, calcomanías 'Se Habla Español'.", s['body']))
    story.append(PageBreak())

    # ═══ 12. PROHIBITED ═══
    story.append(Paragraph("12. Prohibited" if en else "12. Prohibiciones", s['h1']))
    story.append(mk_hr(C["primary"]))
    pr = [["❌ " + ("Prohibited" if en else "Prohibido"), "✅ " + ("Correct" if en else "Correcto")],
        ["Red text on maroon bg" if en else "Texto rojo sobre marrón", "White text on maroon" if en else "Blanco sobre marrón"],
        ["Changing logo colors" if en else "Cambiar colores del logo", "Official colors only" if en else "Solo colores oficiales"],
        ["Separating O icon from ROSS" if en else "Separar ícono O de ROSS", "Logo always complete" if en else "Logo siempre completo"],
        ["3+ color gradients" if en else "Gradientes 3+ colores", "Only 2-color approved" if en else "Solo 2 colores aprobados"],
        ["Non Inter/Montserrat" if en else "Fuentes no oficiales", "Official fonts" if en else "Fuentes oficiales"],
        ["Pure black (#000000)" if en else "Negro puro (#000000)", "Text Primary (#1A1A2E)"],
        ["Stretch/rotate logo" if en else "Estirar/rotar logo", "Horizontal only" if en else "Solo horizontal"],
        ["Blue for errors" if en else "Azul para errores", "Red only for errors" if en else "Rojo para errores"]]
    pt = Table(pr, colWidths=[225, 225])
    pt.setStyle(TableStyle([('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),10),
        ('BACKGROUND',(0,0),(-1,0),HexColor(C["error"])),('TEXTCOLOR',(0,0),(-1,0),white),
        ('BACKGROUND',(0,1),(0,-1),HexColor("#FEF2F2")),('BACKGROUND',(1,1),(1,-1),HexColor("#ECFDF5")),
        ('GRID',(0,0),(-1,-1),0.5,HexColor("#E5E7EB")),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    story.append(pt)
    story.append(PageBreak())

    # ═══ 13. PHOTOGRAPHY ═══
    story.append(Paragraph("13. Photography" if en else "13. Fotografía", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("People: Diverse, Hispanic-inclusive. Settings: Modern offices. Lighting: Warm, natural. Show app on real phones. Clean documents. Avoid generic stock. Image overlays: Maroon 75% opacity. Min contrast 4.5:1." if en else
        "Personas: Diversas, hispanas. Escenarios: Oficinas modernas. Iluminación: Cálida, natural. App en teléfonos reales. Documentos limpios. Evitar stock genérico. Overlays: Marrón 75%. Contraste mín 4.5:1.", s['body']))
    story.append(PageBreak())

    # ═══ 14. CHECKLIST ═══
    story.append(Paragraph("14. Launch Checklist" if en else "14. Checklist", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Digital" if en else "Digital", s['h2']))
    for i in (["☐ Logo: SVG, PNG, PDF formats", "☐ App icon 1024x1024 (use 'O' element)", "☐ Favicons",
               "☐ Social profiles 800x800", "☐ Email signature HTML", "☐ Email template"] if en else
              ["☐ Logo: SVG, PNG, PDF", "☐ App icon 1024x1024 (usar 'O')", "☐ Favicons",
               "☐ Perfiles sociales 800x800", "☐ Firma email HTML", "☐ Plantilla email"]):
        story.append(Paragraph(i, s['bullet']))
    story.append(Paragraph("Print" if en else "Impreso", s['h2']))
    for i in (["☐ Business cards (500)", "☐ Letterhead", "☐ Envelopes", "☐ Client folders",
               "☐ Flyers (EN & ES)", "☐ Roll-up banner", "☐ Window signage"] if en else
              ["☐ Tarjetas (500)", "☐ Membrete", "☐ Sobres", "☐ Carpetas",
               "☐ Flyers (EN & ES)", "☐ Banner roll-up", "☐ Señalización"]):
        story.append(Paragraph(i, s['bullet']))
    story.append(Paragraph("Technology (Built ✅)" if en else "Tecnología (Construido ✅)", s['h2']))
    for i in ["✅ Mi Reembolso iOS/Android", "✅ Admin Dashboard", "✅ Tax Wizard + TIN Matching",
              "✅ IRS Refund Tracker", "✅ NMI Payments", "✅ SendGrid + Push", "✅ Bilingual i18n", "✅ TestFlight pipeline"]:
        story.append(Paragraph(i, s['bullet']))

    # Footer with logo
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(C["secondary"]), spaceAfter=10))
    story.append(RLImage(LOGO_SMALL, width=80, height=40))
    story.append(Paragraph(f"Ross Tax Preparation LLC — Brand Identity Guide v1.0<br/>{datetime.now().strftime('%B %Y')} — {'Confidential' if en else 'Confidencial'}", s['footer']))

    doc.build(story)
    print(f"✅ PDF: {path}")


# ═══ EMAIL ═══
def send_pdfs(paths, to):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    msg = Mail(from_email=os.environ.get('SENDGRID_FROM_EMAIL'), to_emails=to,
        subject='🎨 Ross Tax Brand Guides — Updated with Official Logo',
        html_content="""
        <div style="font-family:Arial;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#6C1110,#ED201D);padding:30px;text-align:center;border-radius:10px 10px 0 0">
                <h1 style="color:#fff;margin:0">ROSS TAX PREPARATION</h1>
                <p style="color:#5DC1D9;margin:5px 0">Brand Identity Guides — Updated</p>
            </div>
            <div style="background:#fff;padding:30px;border:1px solid #e2e8f0">
                <h2 style="color:#1a1a2e;margin-top:0">Updated with Official Logo</h2>
                <p style="color:#4a5568">Your brand guides have been regenerated with the official Ross Tax logo integrated throughout:</p>
                <div style="background:#FFF9F9;border-left:4px solid #6C1110;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#6C1110;margin:0;font-weight:bold">📄 Ross Tax — Brand Guide (English) — WITH LOGO</p>
                </div>
                <div style="background:#FFF9F9;border-left:4px solid #ED201D;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#ED201D;margin:0;font-weight:bold">📄 Ross Tax — Guía de Marca (Español) — CON LOGO</p>
                </div>
                <p style="color:#4a5568">The logo now appears on the cover, color palette section (with anatomy breakdown), logo variations page, stationery examples, and document footer.</p>
            </div>
            <div style="background:#1A0505;padding:15px;text-align:center;border-radius:0 0 10px 10px">
                <p style="color:#9CA3AF;font-size:11px;margin:0">Ross Tax Preparation LLC — v1.1 with Official Logo</p>
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
    p1 = "/app/memory/Ross_Tax_Brand_Guide_EN_v2.pdf"
    p2 = "/app/memory/Ross_Tax_Guia_Marca_ES_v2.pdf"

    print("=" * 60)
    print("🎨 Ross Tax — English (with logo)")
    generate_ross_tax(p1, "en")

    print("=" * 60)
    print("🎨 Ross Tax — Español (con logo)")
    generate_ross_tax(p2, "es")

    print("=" * 60)
    print("📧 Sending updated PDFs...")
    send_pdfs([p1, p2], "yoandyross@gmail.com")
    print("✅ Done!")
