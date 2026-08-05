#!/usr/bin/env python3
"""
Ross Lending Solutions LLC — Brand Identity Guide v2 (Improved Layout)
More spacious pages, larger visuals, professional design.
"""
import os, base64
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.units import inch

# ═══════════════════════════════════════════════════════════════
# BRAND COLORS
# ═══════════════════════════════════════════════════════════════
P = {
    "green": "#0D4F3C",
    "green_dark": "#083028",
    "green_light": "#16755A",
    "green_soft": "#E8F5EF",
    "gold": "#C8A951",
    "gold_dark": "#A68B38",
    "gold_light": "#E0C76A",
    "gold_soft": "#FBF5E4",
    "navy": "#1B2A4A",
    "charcoal": "#2D2D2D",
    "cream": "#F5F0E1",
    "silver": "#B8BCC4",
    "white": "#FAFAFA",
    "text": "#1A1A2E",
    "text2": "#4A5568",
    "text3": "#9CA3AF",
    "border": "#E2E8F0",
}

W, H = letter  # 612 x 792 pts


def draw_page_bg(canvas, doc):
    """Draw page decorations."""
    # Top accent bar
    canvas.setFillColor(HexColor(P["green"]))
    canvas.rect(0, H - 6, W, 6, fill=1, stroke=0)
    # Gold line
    canvas.setFillColor(HexColor(P["gold"]))
    canvas.rect(0, H - 8, W, 2, fill=1, stroke=0)
    # Bottom bar
    canvas.setFillColor(HexColor(P["green"]))
    canvas.rect(0, 0, W, 3, fill=1, stroke=0)
    # Footer text
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(HexColor(P["text3"]))
    canvas.drawCentredString(W / 2, 12, "Ross Lending Solutions LLC · 305 Bruce Ave, Dumas, TX 79029 · (806) 934-2018")


def draw_cover(canvas, doc, lang="en"):
    """Draw stunning modern cover page."""
    en = lang == "en"
    canvas.saveState()
    
    # Full page dark green background
    canvas.setFillColor(HexColor(P["green"]))
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    
    # Large decorative circle (top-right, subtle)
    canvas.setFillColor(HexColor(P["green_light"]))
    canvas.setFillAlpha(0.08)
    canvas.circle(W + 50, H - 50, 350, fill=1, stroke=0)
    
    # Medium circle (bottom-left)
    canvas.setFillAlpha(0.06)
    canvas.circle(-80, 100, 280, fill=1, stroke=0)
    
    # Small decorative circle
    canvas.setFillAlpha(0.1)
    canvas.circle(W - 150, 250, 100, fill=1, stroke=0)
    
    # Tiny dots pattern
    canvas.setFillAlpha(0.05)
    for i in range(8):
        for j in range(12):
            canvas.circle(80 + i * 60, 150 + j * 55, 3, fill=1, stroke=0)
    
    canvas.setFillAlpha(1.0)
    
    # Gold accent bar — thick diagonal stripe
    canvas.setFillColor(HexColor(P["gold"]))
    canvas.setFillAlpha(0.15)
    canvas.rect(0, H * 0.42, W, 4, fill=1, stroke=0)
    canvas.rect(0, H * 0.40, W, 1, fill=1, stroke=0)
    canvas.setFillAlpha(1.0)
    
    # ─── LOGO AREA ───
    # Large "ROSS" text
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 72)
    canvas.drawCentredString(W / 2, H * 0.62, "ROSS")
    
    # Gold underline for ROSS
    canvas.setStrokeColor(HexColor(P["gold"]))
    canvas.setLineWidth(3)
    rl = canvas.stringWidth("ROSS", 'Helvetica-Bold', 72)
    canvas.line(W/2 - rl/2 - 10, H * 0.615, W/2 + rl/2 + 10, H * 0.615)
    
    # "LENDING SOLUTIONS" in gold
    canvas.setFillColor(HexColor(P["gold"]))
    canvas.setFont('Helvetica-Bold', 20)
    canvas.drawCentredString(W / 2, H * 0.575, "LENDING SOLUTIONS")
    
    # "LLC" smaller
    canvas.setFillColor(HexColor(P["silver"]))
    canvas.setFont('Helvetica', 12)
    canvas.drawCentredString(W / 2, H * 0.55, "LLC")
    
    # ─── TITLE AREA ───
    # Gold diamond separator
    canvas.setFillColor(HexColor(P["gold"]))
    canvas.setFillAlpha(0.6)
    y_sep = H * 0.48
    canvas.line(W/2 - 80, y_sep, W/2 - 10, y_sep)
    canvas.line(W/2 + 10, y_sep, W/2 + 80, y_sep)
    # Diamond
    canvas.setFillAlpha(1.0)
    canvas.saveState()
    canvas.translate(W/2, y_sep)
    canvas.rotate(45)
    canvas.rect(-4, -4, 8, 8, fill=1, stroke=0)
    canvas.restoreState()
    
    # "Brand Identity Guide" title
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 28)
    canvas.drawCentredString(W / 2, H * 0.42, "Brand Identity Guide" if en else "Guía de Identidad de Marca")
    
    # Tagline in italic gold
    canvas.setFillColor(HexColor(P["gold_light"]))
    canvas.setFont('Helvetica-BoldOblique', 14)
    canvas.drawCentredString(W / 2, H * 0.385, '"Your Financial Partner in Every Step"' if en else '"Tu Socio Financiero en Cada Paso"')
    
    # ─── BOTTOM SECTION ───
    # Horizontal gold line
    canvas.setStrokeColor(HexColor(P["gold"]))
    canvas.setLineWidth(2)
    canvas.line(W * 0.2, 130, W * 0.8, 130)
    
    # Contact info
    canvas.setFillColor(HexColor(P["silver"]))
    canvas.setFont('Helvetica', 11)
    canvas.drawCentredString(W / 2, 105, "305 Bruce Ave · Dumas, TX 79029")
    canvas.drawCentredString(W / 2, 88, "(806) 934-2018 · info@rosslending.com")
    
    # Version
    canvas.setFillColor(HexColor(P["text3"]))
    canvas.setFont('Helvetica', 9)
    canvas.drawCentredString(W / 2, 55, f"Version 1.0 — {datetime.now().strftime('%B %Y')}")
    
    # Bottom gold bar
    canvas.setFillColor(HexColor(P["gold"]))
    canvas.rect(0, 0, W, 5, fill=1, stroke=0)
    canvas.setFillColor(HexColor(P["green_dark"]))
    canvas.rect(0, 5, W, 3, fill=1, stroke=0)
    
    canvas.restoreState()


def make_logo(w=280, h=100, inverse=False):
    """Create a logo drawing."""
    d = Drawing(w, h)
    bg = HexColor(P["cream"]) if inverse else HexColor(P["green"])
    txt1 = HexColor(P["green"]) if inverse else white
    txt2 = HexColor(P["gold_dark"]) if inverse else HexColor(P["gold"])
    txt3 = HexColor(P["text2"]) if inverse else HexColor(P["silver"])
    
    d.add(Rect(0, 0, w, h, fillColor=bg, strokeColor=HexColor(P["border"]) if inverse else None, strokeWidth=1 if inverse else 0, rx=10))
    # Gold accent line left
    d.add(Rect(0, 0, 6, h, fillColor=txt2, strokeColor=None, rx=0))
    d.add(String(w/2, h*0.58, "ROSS", textAnchor='middle', fontSize=36, fontName='Helvetica-Bold', fillColor=txt1))
    d.add(String(w/2, h*0.30, "LENDING SOLUTIONS", textAnchor='middle', fontSize=14, fontName='Helvetica-Bold', fillColor=txt2))
    d.add(String(w/2, h*0.12, "LLC", textAnchor='middle', fontSize=10, fontName='Helvetica', fillColor=txt3))
    return d


def make_swatch(color, label, w=120, h=75):
    """Create a large color swatch."""
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=HexColor(color), strokeColor=HexColor(P["border"]), strokeWidth=0.5, rx=8))
    # Hex code
    lum = sum(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)) / 3
    tc = white if lum < 128 else HexColor(P["text"])
    d.add(String(w/2, 20, label, textAnchor='middle', fontSize=8, fontName='Helvetica-Bold', fillColor=tc))
    d.add(String(w/2, 8, color.upper(), textAnchor='middle', fontSize=7, fontName='Helvetica', fillColor=tc))
    return d


def make_biz_card(w=400, h=230):
    """Create business card mockup."""
    d = Drawing(w, h)
    # Card body
    d.add(Rect(0, 0, w, h, fillColor=HexColor(P["green"]), strokeColor=None, rx=12))
    # Gold side stripe
    d.add(Rect(0, 0, 8, h, fillColor=HexColor(P["gold"]), strokeColor=None))
    # Right decorative
    d.add(Rect(w - 100, 0, 100, h, fillColor=HexColor(P["green_dark"]), strokeColor=None, rx=0))
    # Logo text
    d.add(String(35, h - 45, "ROSS", fontSize=32, fontName='Helvetica-Bold', fillColor=white))
    d.add(String(35, h - 68, "LENDING SOLUTIONS LLC", fontSize=11, fontName='Helvetica-Bold', fillColor=HexColor(P["gold"])))
    # Separator line
    d.add(Line(35, h - 82, 200, h - 82, strokeColor=HexColor(P["gold"]), strokeWidth=1))
    # Name & title
    d.add(String(35, h - 108, "Yoandy Ross", fontSize=18, fontName='Helvetica-Bold', fillColor=white))
    d.add(String(35, h - 126, "Owner / Sole Member", fontSize=10, fontName='Helvetica', fillColor=HexColor(P["silver"])))
    # Contact info
    d.add(String(35, 62, "(806) 934-2018", fontSize=10, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    d.add(String(35, 46, "info@rosslending.com", fontSize=10, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    d.add(String(35, 30, "305 Bruce Ave, Dumas, TX 79029", fontSize=10, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    # Gold corner
    d.add(String(w - 55, h - 45, "RLS", fontSize=28, fontName='Helvetica-Bold', fillColor=HexColor(P["gold"]), textAnchor='middle'))
    return d


def section_header(text, number, styles):
    """Create a section header with number."""
    return [
        Spacer(1, 10),
        Paragraph(f'<font color="{P["gold"]}" size="32">{number}</font>', styles['center']),
        Spacer(1, 8),
        Paragraph(text, styles['h1']),
        HRFlowable(width="40%", thickness=3, color=HexColor(P["gold"]), spaceAfter=20, hAlign='CENTER'),
    ]


def generate_pdf(path, lang="en"):
    en = lang == "en"
    
    doc = SimpleDocTemplate(
        path, pagesize=letter,
        topMargin=45, bottomMargin=45,
        leftMargin=60, rightMargin=60,
    )

    ss = getSampleStyleSheet()
    s = {
        'h1': ParagraphStyle('H1', parent=ss['Heading1'], fontSize=24, textColor=HexColor(P["green"]), spaceBefore=10, spaceAfter=10, fontName='Helvetica-Bold', alignment=TA_CENTER),
        'h2': ParagraphStyle('H2', parent=ss['Heading2'], fontSize=17, textColor=HexColor(P["green"]), spaceBefore=24, spaceAfter=10, fontName='Helvetica-Bold', alignment=TA_LEFT),
        'h3': ParagraphStyle('H3', parent=ss['Heading3'], fontSize=14, textColor=HexColor(P["gold_dark"]), spaceBefore=18, spaceAfter=8, fontName='Helvetica-Bold'),
        'body': ParagraphStyle('Body', parent=ss['Normal'], fontSize=11, leading=17, textColor=HexColor(P["text"]), alignment=TA_JUSTIFY, spaceAfter=8),
        'body_lg': ParagraphStyle('BodyLg', parent=ss['Normal'], fontSize=12, leading=19, textColor=HexColor(P["text"]), alignment=TA_JUSTIFY, spaceAfter=10),
        'center': ParagraphStyle('Center', parent=ss['Normal'], fontSize=11, alignment=TA_CENTER, textColor=HexColor(P["text2"]), spaceAfter=6),
        'center_lg': ParagraphStyle('CenterLg', parent=ss['Normal'], fontSize=13, alignment=TA_CENTER, textColor=HexColor(P["text2"]), spaceAfter=8, leading=18),
        'small': ParagraphStyle('Small', parent=ss['Normal'], fontSize=9, textColor=HexColor(P["text3"]), leading=12, spaceAfter=4),
        'tagline': ParagraphStyle('Tag', parent=ss['Normal'], fontSize=16, textColor=HexColor(P["gold_dark"]), alignment=TA_CENTER, fontName='Helvetica-BoldOblique', spaceBefore=8, spaceAfter=20, leading=22),
        'bullet': ParagraphStyle('Bullet', parent=ss['Normal'], fontSize=11, leading=17, leftIndent=24, bulletIndent=10, textColor=HexColor(P["text"]), spaceAfter=6),
        'quote': ParagraphStyle('Quote', parent=ss['Normal'], fontSize=13, leading=20, textColor=HexColor(P["green"]), alignment=TA_CENTER, fontName='Helvetica-BoldOblique', spaceBefore=12, spaceAfter=12),
    }

    story = []

    # ═══════════════════════════════════════════════════════════════
    # PAGE 1: COVER (drawn by canvas — just add a page break)
    # ═══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 680))  # Fill the cover page
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 2: BRAND OVERVIEW - MISSION
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Brand Overview" if en else "Visión de la Marca", "01", s))

    story.append(Paragraph("Mission" if en else "Misión", s['h2']))
    story.append(Paragraph(
        "Ross Lending Solutions LLC exists to empower individuals and families in our community with accessible, transparent, and fair lending services. We provide personal loans, tax refund advances, and financial guidance that helps our clients achieve their goals with confidence." if en else
        "Ross Lending Solutions LLC existe para empoderar a individuos y familias en nuestra comunidad con servicios de préstamos accesibles, transparentes y justos. Proporcionamos préstamos personales, adelantos de reembolso de impuestos y orientación financiera que ayuda a nuestros clientes a alcanzar sus metas con confianza.",
        s['body_lg']
    ))
    story.append(Spacer(1, 20))

    story.append(Paragraph("Vision" if en else "Visión", s['h2']))
    story.append(Paragraph(
        "To be the most trusted lending partner in the Texas Panhandle, known for integrity, personalized service, and community commitment." if en else
        "Ser el socio de préstamos más confiable en el Texas Panhandle, conocido por su integridad, servicio personalizado y compromiso con la comunidad.",
        s['body_lg']
    ))
    story.append(Spacer(1, 30))

    story.append(Paragraph(
        '"Building Trust, One Loan at a Time"' if en else '"Construyendo Confianza, Un Préstamo a la Vez"',
        s['quote']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 3: VALUES
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Core Values" if en else "Valores Fundamentales", "02", s))
    story.append(Spacer(1, 10))

    values = [
        ("🤝", "Integrity" if en else "Integridad",
         "Transparent terms, no hidden fees, honest communication with every client." if en else
         "Términos transparentes, sin cargos ocultos, comunicación honesta con cada cliente."),
        ("💰", "Accessibility" if en else "Accesibilidad",
         "Financial solutions for everyone, regardless of credit history. We believe everyone deserves a chance." if en else
         "Soluciones financieras para todos, sin importar el historial crediticio. Creemos que todos merecen una oportunidad."),
        ("🏠", "Community" if en else "Comunidad",
         "Investing in the growth and well-being of Dumas and the Texas Panhandle region." if en else
         "Invirtiendo en el crecimiento y bienestar de Dumas y la región del Texas Panhandle."),
        ("⭐", "Excellence" if en else "Excelencia",
         "Professional service that exceeds expectations every single time." if en else
         "Servicio profesional que supera las expectativas en cada ocasión."),
    ]

    for emoji, title, desc in values:
        vt = Table(
            [[emoji, Paragraph(f'<font size="14"><b>{title}</b></font><br/><font size="11" color="{P["text2"]}">{desc}</font>', s['body'])]],
            colWidths=[50, 420],
        )
        vt.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 0), (0, 0), 24),
            ('BACKGROUND', (0, 0), (-1, -1), HexColor(P["green_soft"])),
            ('ROUNDEDCORNERS', [10, 10, 10, 10]),
            ('TOPPADDING', (0, 0), (-1, -1), 14),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ]))
        story.append(vt)
        story.append(Spacer(1, 12))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 4: TAGLINES
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Taglines" if en else "Eslóganes", "03", s))
    story.append(Spacer(1, 30))

    taglines = [
        ('"Your Financial Partner in Every Step"' if en else '"Tu Socio Financiero en Cada Paso"', "Primary" if en else "Principal"),
        ('"Building Trust, One Loan at a Time"' if en else '"Construyendo Confianza, Un Préstamo a la Vez"', "Secondary" if en else "Secundario"),
        ('"Smart Lending. Real Results."' if en else '"Préstamos Inteligentes. Resultados Reales."', "Short" if en else "Corto"),
        ('"Because Your Dreams Can\'t Wait"' if en else '"Porque Tus Sueños No Pueden Esperar"', "Emotional" if en else "Emocional"),
    ]

    for tag, type_label in taglines:
        story.append(Paragraph(f'<font color="{P["text3"]}" size="10">{type_label.upper()}</font>', s['center']))
        story.append(Paragraph(tag, ParagraphStyle('TagL', fontSize=18, textColor=HexColor(P["green"]), alignment=TA_CENTER, fontName='Helvetica-BoldOblique', spaceAfter=6, leading=24)))
        story.append(HRFlowable(width="20%", thickness=1, color=HexColor(P["gold"]), spaceAfter=24, hAlign='CENTER'))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 5: LOGO
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Logo & Wordmark" if en else "Logo y Marca", "04", s))

    story.append(Paragraph("Primary Logo" if en else "Logo Principal", s['h2']))
    story.append(Spacer(1, 10))
    story.append(make_logo(380, 130))
    story.append(Spacer(1, 30))

    story.append(Paragraph("Inverse Logo" if en else "Logo Invertido", s['h2']))
    story.append(Spacer(1, 10))
    story.append(make_logo(380, 130, inverse=True))
    story.append(Spacer(1, 30))

    story.append(Paragraph(
        "The primary logo features ROSS in bold white on forest green, with LENDING SOLUTIONS in gold. The inverse version is for light backgrounds." if en else
        "El logo principal presenta ROSS en blanco sobre verde bosque, con LENDING SOLUTIONS en dorado. La versión invertida es para fondos claros.",
        s['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 6: LOGO GUIDELINES
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Logo Guidelines" if en else "Uso del Logo", "04b", s))

    guidelines = [
        ("✅ " + ("DO" if en else "HACER"), [
            ("Maintain proportions at all times" if en else "Mantener proporciones en todo momento"),
            ("Use on solid backgrounds" if en else "Usar sobre fondos sólidos"),
            ("Minimum width: 120px digital, 1.5\" print" if en else "Ancho mínimo: 120px digital, 1.5\" impreso"),
            ("Clear space: Height of 'R' on all sides" if en else "Espacio libre: Altura de la 'R' en todos los lados"),
        ]),
        ("❌ " + ("DON'T" if en else "NO HACER"), [
            ("Stretch, rotate, or skew the logo" if en else "Estirar, rotar o deformar el logo"),
            ("Change the brand colors" if en else "Cambiar los colores de la marca"),
            ("Place on busy or low-contrast backgrounds" if en else "Colocar sobre fondos ocupados o de bajo contraste"),
            ("Add effects (shadows, gradients, etc.)" if en else "Agregar efectos (sombras, degradados, etc.)"),
        ]),
    ]

    for title, items in guidelines:
        story.append(Paragraph(title, s['h3']))
        for item in items:
            story.append(Paragraph(f"• {item}", s['bullet']))
        story.append(Spacer(1, 16))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 7: COLOR PALETTE - PRIMARY
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Color Palette" if en else "Paleta de Colores", "05", s))

    story.append(Paragraph("Primary Colors" if en else "Colores Primarios", s['h2']))
    story.append(Spacer(1, 10))

    row1 = Table(
        [[make_swatch(P["green"], "Forest Green", 140, 90), Spacer(20, 1), make_swatch(P["gold"], "Rich Gold", 140, 90), Spacer(20, 1), make_swatch(P["navy"], "Navy Blue", 140, 90)]],
        colWidths=[140, 20, 140, 20, 140],
    )
    row1.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    story.append(row1)
    story.append(Spacer(1, 12))

    # Details
    color_details = [
        ["", "Forest Green", "Rich Gold", "Navy Blue"],
        ["HEX", "#0D4F3C", "#C8A951", "#1B2A4A"],
        ["RGB", "13, 79, 60", "200, 169, 81", "27, 42, 74"],
        [("Use" if en else "Uso"), ("Headers, buttons, primary" if en else "Encabezados, botones"), ("Accents, premium" if en else "Acentos, premium"), ("Text, professional" if en else "Texto, profesional")],
    ]
    ct = Table(color_details, colWidths=[70, 130, 130, 130])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(P["green"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor(P["border"])),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#F7FAFC")]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(ct)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 8: SECONDARY COLORS
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("Secondary & Accent Colors" if en else "Colores Secundarios y Acentos", s['h2']))
    story.append(Spacer(1, 16))

    row2 = Table(
        [[make_swatch(P["green_dark"], "Dark Green", 110, 80), make_swatch(P["green_light"], "Light Green", 110, 80), make_swatch(P["gold_dark"], "Dark Gold", 110, 80), make_swatch(P["gold_light"], "Light Gold", 110, 80)]],
        colWidths=[120, 120, 120, 120],
    )
    row2.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    story.append(row2)
    story.append(Spacer(1, 20))

    row3 = Table(
        [[make_swatch(P["charcoal"], "Charcoal", 110, 80), make_swatch(P["cream"], "Cream", 110, 80), make_swatch(P["silver"], "Silver", 110, 80), make_swatch(P["green_soft"], "Soft Green", 110, 80)]],
        colWidths=[120, 120, 120, 120],
    )
    row3.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    story.append(row3)
    story.append(Spacer(1, 30))

    story.append(Paragraph(
        "<b>" + ("Usage Guide:" if en else "Guía de Uso:") + "</b>", s['body']
    ))
    usage = [
        ("Forest Green" if en else "Verde Bosque", "Headers, buttons, primary backgrounds, contracts" if en else "Encabezados, botones, fondos principales, contratos"),
        ("Rich Gold" if en else "Dorado Rico", "Accents, highlights, premium elements, borders" if en else "Acentos, resaltados, elementos premium, bordes"),
        ("Navy Blue" if en else "Azul Marino", "Body text on light backgrounds, professional docs" if en else "Texto en fondos claros, documentos profesionales"),
        ("Cream" if en else "Crema", "Light backgrounds, cards, inviting sections" if en else "Fondos claros, tarjetas, secciones acogedoras"),
    ]
    for name, desc in usage:
        story.append(Paragraph(f"• <b>{name}</b> — {desc}", s['bullet']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 9: TYPOGRAPHY
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Typography" if en else "Tipografía", "06", s))
    story.append(Spacer(1, 10))

    typo_data = [
        [("Role" if en else "Rol"), ("Font" if en else "Fuente"), ("Size" if en else "Tamaño"), ("Use" if en else "Uso")],
        [("Headlines" if en else "Títulos"), "Montserrat Bold\nHelvetica Bold", "24-36pt", ("Contracts, marketing\nheaders, signage" if en else "Contratos, marketing\nencabezados, señalización")],
        [("Subheadings" if en else "Subtítulos"), "Montserrat SemiBold\nHelvetica Bold", "16-20pt", ("Section titles,\ncategory headers" if en else "Títulos de sección,\nencabezados de categoría")],
        [("Body Text" if en else "Texto"), "Open Sans Regular\nHelvetica", "10-12pt", ("Contracts, documents,\nweb content" if en else "Contratos, documentos,\ncontenido web")],
        [("Digital UI" if en else "UI Digital"), "Inter\nSF Pro", "14-16pt", ("App, dashboard,\ndigital forms" if en else "App, dashboard,\nformularios digitales")],
        [("Data/Code" if en else "Datos"), "SF Mono\nFira Code", "10-12pt", ("Tracking numbers,\nloan IDs, tables" if en else "Números de rastreo,\nIDs, tablas")],
    ]
    tt = Table(typo_data, colWidths=[90, 140, 70, 170])
    tt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(P["green"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor(P["border"])),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor(P["green_soft"])]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(tt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 10: SERVICES PORTFOLIO
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Services Portfolio" if en else "Portafolio de Servicios", "07", s))
    story.append(Spacer(1, 10))

    services = [
        ("💰", "Personal Loans" if en else "Préstamos Personales",
         "Short and medium-term loans from $500 to $10,000 with flexible payment plans. Weekly or monthly payments with competitive interest rates." if en else
         "Préstamos a corto y mediano plazo desde $500 hasta $10,000 con planes de pago flexibles. Pagos semanales o mensuales con tasas de interés competitivas."),
        ("🏦", "Tax Refund Advances" if en else "Adelantos de Reembolso",
         "Get your tax refund advance while waiting for the IRS. Quick approval process with same-day funding available." if en else
         "Obtén tu adelanto de reembolso de impuestos mientras esperas al IRS. Proceso de aprobación rápido con fondos disponibles el mismo día."),
        ("📋", "Payment Plans" if en else "Planes de Pago",
         "Flexible payment plans for tax preparation services, immigration services, and more. Split costs into manageable installments." if en else
         "Planes de pago flexibles para servicios de impuestos, inmigración y más. Divide tus costos en cuotas manejables."),
        ("🤝", "Financial Guidance" if en else "Orientación Financiera",
         "Free financial consultation to help you make the best borrowing decisions for your unique situation." if en else
         "Consulta financiera gratuita para ayudarte a tomar las mejores decisiones de préstamo para tu situación."),
    ]

    for emoji, title, desc in services:
        st = Table(
            [[emoji, Paragraph(f'<font size="15"><b>{title}</b></font><br/><br/><font size="11" color="{P["text2"]}">{desc}</font>', s['body'])]],
            colWidths=[50, 420],
        )
        st.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 0), (0, 0), 28),
            ('BACKGROUND', (0, 0), (-1, -1), HexColor(P["gold_soft"])),
            ('ROUNDEDCORNERS', [10, 10, 10, 10]),
            ('TOPPADDING', (0, 0), (-1, -1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ]))
        story.append(st)
        story.append(Spacer(1, 14))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 11: BUSINESS CARD
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Stationery" if en else "Papelería", "08", s))

    story.append(Paragraph("Business Card" if en else "Tarjeta de Presentación", s['h2']))
    story.append(Spacer(1, 16))
    story.append(make_biz_card(440, 250))
    story.append(Spacer(1, 30))

    story.append(Paragraph("Letterhead" if en else "Membrete", s['h2']))
    story.append(Spacer(1, 8))
    specs = [
        ("Top" if en else "Arriba", "Logo (left) + company info (right)" if en else "Logo (izquierda) + info empresa (derecha)"),
        ("Colors" if en else "Colores", "Forest green header bar with gold accent line" if en else "Barra verde con línea dorada de acento"),
        ("Footer" if en else "Pie", "Address, phone, email, NMLS# (when obtained)" if en else "Dirección, teléfono, email, NMLS# (cuando se obtenga)"),
        ("Paper" if en else "Papel", "Premium white, 24lb bond or 80lb cover" if en else "Blanco premium, 24lb bond o 80lb cover"),
    ]
    for label, desc in specs:
        story.append(Paragraph(f"• <b>{label}:</b> {desc}", s['bullet']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 12: DIGITAL & SOCIAL
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Digital & Social Media" if en else "Digital y Redes Sociales", "09", s))

    social_data = [
        [("Platform" if en else "Plataforma"), ("Profile" if en else "Perfil"), ("Content Strategy" if en else "Estrategia de Contenido")],
        ["Facebook", ("Logo on green" if en else "Logo en verde"), ("Loan promotions, community events, testimonials" if en else "Promociones de préstamos, eventos, testimonios")],
        ["Instagram", ("Logo icon" if en else "Ícono logo"), ("Financial tips, behind-the-scenes, success stories" if en else "Tips financieros, detrás de escenas, historias de éxito")],
        ["TikTok", ("Logo" if en else "Logo"), ("Financial literacy, Q&A, trending formats" if en else "Educación financiera, Q&A, formatos trending")],
        ["Google Business", ("Logo" if en else "Logo"), ("Reviews, hours, photos of office" if en else "Reseñas, horarios, fotos de oficina")],
        ["Website", "rosslending.com", ("Services, apply online, contact" if en else "Servicios, solicitar en línea, contacto")],
    ]
    sot = Table(social_data, colWidths=[90, 120, 260])
    sot.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(P["green"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor(P["border"])),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor(P["green_soft"])]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sot)
    story.append(Spacer(1, 24))

    story.append(Paragraph("Tone of Voice" if en else "Tono de Voz", s['h2']))
    tones = [
        ("Professional yet approachable" if en else "Profesional pero accesible"),
        ("Empathetic — we understand financial challenges" if en else "Empático — entendemos los desafíos financieros"),
        ("Clear and transparent — no jargon or hidden terms" if en else "Claro y transparente — sin jerga ni términos ocultos"),
        ("Bilingual (English/Spanish) — all communications" if en else "Bilingüe (Inglés/Español) — todas las comunicaciones"),
        ("Empowering — helping clients take control of their finances" if en else "Empoderante — ayudando a los clientes a tomar control de sus finanzas"),
    ]
    for t in tones:
        story.append(Paragraph(f"• {t}", s['bullet']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # PAGE 13: LEGAL & COMPLIANCE
    # ═══════════════════════════════════════════════════════════════
    story.extend(section_header("Legal & Compliance" if en else "Legal y Cumplimiento", "10", s))

    legal_data = [
        [("Item" if en else "Dato"), ("Detail" if en else "Detalle")],
        [("Legal Name" if en else "Nombre Legal"), "Ross Lending Solutions LLC"],
        [("Type" if en else "Tipo"), ("Domestic LLC" if en else "LLC Doméstica")],
        [("Jurisdiction" if en else "Jurisdicción"), "State of Texas, USA"],
        [("Address" if en else "Dirección"), "305 Bruce Ave, Dumas, TX 79029"],
        [("Owner" if en else "Propietario"), "Yoandy Ross — Sole Member / Owner"],
        ["NMLS #", ("Pending Registration" if en else "Pendiente de Registro")],
        ["Texas OCCC", ("Pending License" if en else "Pendiente de Licencia")],
    ]
    lt = Table(legal_data, colWidths=[140, 330])
    lt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(P["green"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor(P["border"])),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor(P["green_soft"])]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(lt)
    story.append(Spacer(1, 24))

    story.append(Paragraph("Required Disclosures" if en else "Divulgaciones Requeridas", s['h2']))
    disclosures = [
        ("Full legal company name on all documents" if en else "Nombre legal completo en todos los documentos"),
        ("NMLS number once obtained" if en else "Número NMLS una vez obtenido"),
        ("Texas OCCC license number once obtained" if en else "Número de licencia Texas OCCC una vez obtenido"),
        ("Equal opportunity lending disclaimer" if en else "Descargo de igualdad de oportunidades"),
        ("APR and terms disclosure on all advertising" if en else "Divulgación de APR y términos en toda publicidad"),
        ("Privacy policy link on digital platforms" if en else "Enlace a política de privacidad en plataformas digitales"),
    ]
    for d in disclosures:
        story.append(Paragraph(f"• {d}", s['bullet']))

    story.append(Spacer(1, 40))
    story.append(HRFlowable(width="50%", thickness=3, color=HexColor(P["gold"]), spaceAfter=16, hAlign='CENTER'))
    story.append(Paragraph(
        f"Ross Lending Solutions LLC — Brand Identity Guide v1.0 — {datetime.now().strftime('%B %Y')}",
        s['center']
    ))

    doc.build(story, onFirstPage=lambda c, d: draw_cover(c, d, lang=lang), onLaterPages=draw_page_bg)
    print(f"✅ PDF: {path} ({len(story)} elements)")


def send_pdfs(paths, to):
    """Send branding PDFs via email."""
    from dotenv import load_dotenv
    load_dotenv()
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

    msg = Mail(
        from_email='info@rosstaxpreparation.com',
        to_emails=to,
        subject='🏦 Ross Lending Solutions LLC — Brand Identity Guide v2 / Guía de Marca v2',
        html_content=f"""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
            <div style="background:linear-gradient(135deg, #0D4F3C, #16755A);padding:35px;text-align:center;border-radius:12px 12px 0 0;border-bottom:4px solid #C8A951">
                <h1 style="color:white;margin:0;font-size:32px;letter-spacing:2px">ROSS</h1>
                <h2 style="color:#C8A951;margin:4px 0 0 0;font-size:14px;letter-spacing:4px">LENDING SOLUTIONS LLC</h2>
            </div>
            <div style="padding:30px;background:#F8FAF9;border:1px solid #E2E8F0">
                <h3 style="color:#0D4F3C;margin-top:0;font-size:18px">Brand Identity Guide v2.0 / Guía de Marca v2.0</h3>
                <p style="color:#4a5568;font-size:14px;line-height:1.6">
                    Attached: Complete brand identity guide for <b>Ross Lending Solutions LLC</b> in English and Spanish. 
                    Improved layout with spacious pages and professional design.
                </p>
                <p style="color:#4a5568;font-size:14px;line-height:1.6">
                    Adjunto: Guía completa de identidad de marca de <b>Ross Lending Solutions LLC</b> en inglés y español. 
                    Diseño mejorado con páginas espaciosas y diseño profesional.
                </p>
                <div style="background:white;padding:16px;border-radius:10px;margin:20px 0;border-left:5px solid #C8A951;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
                    <p style="margin:0 0 8px 0;font-size:13px;color:#0D4F3C;font-weight:bold">📎 Attachments / Adjuntos:</p>
                    <p style="margin:0;font-size:13px;color:#4a5568">
                        📄 Ross_Lending_Solutions_Brand_Guide_EN_v2.pdf<br/>
                        📄 Ross_Lending_Solutions_Guia_Marca_ES_v2.pdf
                    </p>
                </div>
                <table style="width:100%;border-collapse:collapse;margin-top:16px">
                    <tr>
                        <td style="padding:8px;background:#0D4F3C;color:white;border-radius:6px 0 0 6px;text-align:center;width:33%">🎨 #0D4F3C</td>
                        <td style="padding:8px;background:#C8A951;color:white;text-align:center;width:34%">🏆 #C8A951</td>
                        <td style="padding:8px;background:#1B2A4A;color:white;border-radius:0 6px 6px 0;text-align:center;width:33%">📘 #1B2A4A</td>
                    </tr>
                </table>
            </div>
            <div style="background:#0D4F3C;padding:16px;text-align:center;border-radius:0 0 12px 12px">
                <p style="color:#C8A951;font-size:12px;margin:0;font-style:italic">"Your Financial Partner in Every Step"</p>
                <p style="color:#9CA3AF;font-size:10px;margin:4px 0 0 0">Ross Lending Solutions LLC · 305 Bruce Ave, Dumas TX 79029</p>
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
    p1 = "/app/memory/Ross_Lending_Solutions_Brand_Guide_EN_v2.pdf"
    p2 = "/app/memory/Ross_Lending_Solutions_Guia_Marca_ES_v2.pdf"

    print("🏦 Generating English...")
    generate_pdf(p1, "en")
    print("🏦 Generating Spanish...")
    generate_pdf(p2, "es")
    print("📧 Sending...")
    send_pdfs([p1, p2], "yoandyross@gmail.com")
    print("✅ Done!")
