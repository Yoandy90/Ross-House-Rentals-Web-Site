#!/usr/bin/env python3
"""
Ross Lending Solutions LLC — Complete Brand Identity Guide (EN & ES)
Generates professional branding PDFs and sends via email.
"""
import os, base64
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String, Circle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import inch

# ═══════════════════════════════════════════════════════════════
# BRAND COLORS — Ross Lending Solutions LLC
# ═══════════════════════════════════════════════════════════════
C = {
    "primary": "#0D4F3C",            # Deep Forest Green — trust, stability, money
    "primary_rgb": "13, 79, 60",
    "primary_cmyk": "84, 0, 24, 69",
    "primary_dark": "#083028",       # Darker green
    "primary_light": "#16755A",      # Lighter green
    "secondary": "#C8A951",          # Rich Gold — premium, prosperity
    "secondary_rgb": "200, 169, 81",
    "secondary_cmyk": "0, 16, 60, 22",
    "secondary_dark": "#A68B38",     # Darker gold
    "secondary_light": "#E0C76A",    # Lighter gold
    "accent_navy": "#1B2A4A",        # Deep Navy — authority, professionalism
    "accent_charcoal": "#2D2D2D",    # Charcoal — sophistication
    "accent_cream": "#F5F0E1",       # Warm Cream — inviting
    "accent_silver": "#B8BCC4",      # Silver — modern
    "accent_white": "#FAFAFA",       # Off-white
    "success": "#059669",
    "warning": "#F59E0B",
    "error": "#DC2626",
    "info": "#3B82F6",
    "bg_light": "#F8FAF9",
    "text_primary": "#1A1A2E",
    "text_secondary": "#4A5568",
    "text_light": "#9CA3AF",
}


def sw(color, w=55, h=35):
    """Create a color swatch."""
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=HexColor(color), strokeColor=HexColor("#E5E7EB"), strokeWidth=0.5, rx=3))
    return d


def create_logo_drawing(w=200, h=80):
    """Create a text-based logo since we don't have a logo file yet."""
    d = Drawing(w, h)
    # Background
    d.add(Rect(0, 0, w, h, fillColor=HexColor(C["primary"]), strokeColor=None, rx=8))
    # Company name
    d.add(String(w/2, 48, "ROSS", textAnchor='middle', fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    d.add(String(w/2, 28, "LENDING SOLUTIONS", textAnchor='middle', fontSize=12, fontName='Helvetica-Bold', fillColor=HexColor(C["secondary"])))
    d.add(String(w/2, 14, "LLC", textAnchor='middle', fontSize=9, fontName='Helvetica', fillColor=HexColor(C["accent_silver"])))
    return d


def create_logo_inverse(w=200, h=80):
    """Create inverse logo."""
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=HexColor(C["accent_cream"]), strokeColor=HexColor(C["primary"]), strokeWidth=1, rx=8))
    d.add(String(w/2, 48, "ROSS", textAnchor='middle', fontSize=28, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    d.add(String(w/2, 28, "LENDING SOLUTIONS", textAnchor='middle', fontSize=12, fontName='Helvetica-Bold', fillColor=HexColor(C["secondary_dark"])))
    d.add(String(w/2, 14, "LLC", textAnchor='middle', fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    return d


def mk_styles():
    ss = getSampleStyleSheet()
    return {
        'h1': ParagraphStyle('H1', parent=ss['Heading1'], fontSize=22, textColor=HexColor(C["primary"]), spaceBefore=20, spaceAfter=12, fontName='Helvetica-Bold'),
        'h2': ParagraphStyle('H2', parent=ss['Heading2'], fontSize=16, textColor=HexColor(C["primary_dark"]), spaceBefore=16, spaceAfter=8, fontName='Helvetica-Bold'),
        'h3': ParagraphStyle('H3', parent=ss['Heading3'], fontSize=13, textColor=HexColor(C["secondary_dark"]), spaceBefore=12, spaceAfter=6, fontName='Helvetica-Bold'),
        'body': ParagraphStyle('Body', parent=ss['Normal'], fontSize=10, leading=14, textColor=HexColor(C["text_primary"]), alignment=TA_JUSTIFY),
        'center': ParagraphStyle('Center', parent=ss['Normal'], fontSize=10, alignment=TA_CENTER, textColor=HexColor(C["text_secondary"])),
        'small': ParagraphStyle('Small', parent=ss['Normal'], fontSize=8, textColor=HexColor(C["text_light"]), leading=10),
        'tagline': ParagraphStyle('Tag', parent=ss['Normal'], fontSize=14, textColor=HexColor(C["secondary"]), alignment=TA_CENTER, fontName='Helvetica-BoldOblique', spaceBefore=8, spaceAfter=16),
        'bullet': ParagraphStyle('Bullet', parent=ss['Normal'], fontSize=10, leading=14, leftIndent=20, bulletIndent=8, textColor=HexColor(C["text_primary"])),
    }


def generate_rls_pdf(path, lang="en"):
    """Generate Ross Lending Solutions branding PDF."""
    en = lang == "en"
    s = mk_styles()
    doc = SimpleDocTemplate(path, pagesize=letter, topMargin=50, bottomMargin=50, leftMargin=55, rightMargin=55)
    story = []

    # ═══════════════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 100))
    story.append(create_logo_drawing(300, 120))
    story.append(Spacer(1, 30))

    story.append(Paragraph(
        "Brand Identity Guide" if en else "Guía de Identidad de Marca",
        ParagraphStyle('CoverTitle', fontSize=32, textColor=HexColor(C["primary"]), alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=12)
    ))
    story.append(Paragraph(
        '"Your Financial Partner in Every Step"' if en else '"Tu Socio Financiero en Cada Paso"',
        s['tagline']
    ))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="60%", thickness=2, color=HexColor(C["secondary"]), spaceAfter=20))
    story.append(Paragraph(
        "305 Bruce Ave, Dumas, TX 79029<br/>(806) 934-2018 · info@rosslending.com" if en else
        "305 Bruce Ave, Dumas, TX 79029<br/>(806) 934-2018 · info@rosslending.com",
        s['center']
    ))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"Version 1.0 — {datetime.now().strftime('%B %Y')}", s['small']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 1. BRAND OVERVIEW
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("1. " + ("Brand Overview" if en else "Visión de la Marca"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph("Mission" if en else "Misión", s['h2']))
    story.append(Paragraph(
        "Ross Lending Solutions LLC exists to empower individuals and families in our community with accessible, transparent, and fair lending services. We provide personal loans, tax refund advances, and financial guidance that helps our clients achieve their goals with confidence." if en else
        "Ross Lending Solutions LLC existe para empoderar a individuos y familias en nuestra comunidad con servicios de préstamos accesibles, transparentes y justos. Proporcionamos préstamos personales, adelantos de reembolso de impuestos y orientación financiera que ayuda a nuestros clientes a alcanzar sus metas con confianza.",
        s['body']
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Vision" if en else "Visión", s['h2']))
    story.append(Paragraph(
        "To be the most trusted lending partner in the Texas Panhandle, known for integrity, personalized service, and community commitment." if en else
        "Ser el socio de préstamos más confiable en el Texas Panhandle, conocido por su integridad, servicio personalizado y compromiso con la comunidad.",
        s['body']
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Values" if en else "Valores", s['h2']))
    values = [
        ("🤝 Integrity" if en else "🤝 Integridad", "Transparent terms, no hidden fees, honest communication." if en else "Términos transparentes, sin cargos ocultos, comunicación honesta."),
        ("💰 Accessibility" if en else "💰 Accesibilidad", "Financial solutions for everyone, regardless of credit history." if en else "Soluciones financieras para todos, sin importar el historial crediticio."),
        ("🏠 Community" if en else "🏠 Comunidad", "Investing in the growth and well-being of Dumas and the Texas Panhandle." if en else "Invirtiendo en el crecimiento y bienestar de Dumas y el Texas Panhandle."),
        ("⭐ Excellence" if en else "⭐ Excelencia", "Professional service that exceeds expectations." if en else "Servicio profesional que supera las expectativas."),
    ]
    for title, desc in values:
        story.append(Paragraph(f"<b>{title}</b> — {desc}", s['bullet']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Taglines" if en else "Eslóganes", s['h2']))
    taglines = [
        '"Your Financial Partner in Every Step"' if en else '"Tu Socio Financiero en Cada Paso"',
        '"Building Trust, One Loan at a Time"' if en else '"Construyendo Confianza, Un Préstamo a la Vez"',
        '"Smart Lending. Real Results."' if en else '"Préstamos Inteligentes. Resultados Reales."',
    ]
    for tag in taglines:
        story.append(Paragraph(f"<i>{tag}</i>", s['center']))
        story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 2. LOGO
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("2. " + ("Logo & Wordmark" if en else "Logo y Marca"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph("Primary Logo" if en else "Logo Principal", s['h2']))
    story.append(create_logo_drawing(300, 100))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Inverse Logo" if en else "Logo Invertido", s['h2']))
    story.append(create_logo_inverse(300, 100))
    story.append(Spacer(1, 16))

    story.append(Paragraph(
        "The primary logo uses forest green (#0D4F3C) with gold accents (#C8A951) to convey trust, stability, and prosperity. The inverse version is for use on dark backgrounds." if en else
        "El logo principal usa verde bosque (#0D4F3C) con acentos dorados (#C8A951) para transmitir confianza, estabilidad y prosperidad. La versión invertida es para uso en fondos oscuros.",
        s['body']
    ))

    story.append(Paragraph("Clear Space & Minimum Size" if en else "Espacio y Tamaño Mínimo", s['h3']))
    story.append(Paragraph(
        "• Minimum clear space: Height of the 'R' in ROSS on all sides<br/>• Minimum width: 120px digital, 1.5 inches print<br/>• Never stretch, rotate, or alter the logo proportions" if en else
        "• Espacio mínimo: Altura de la 'R' en ROSS en todos los lados<br/>• Ancho mínimo: 120px digital, 1.5 pulgadas impreso<br/>• Nunca estirar, rotar o alterar las proporciones del logo",
        s['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 3. COLOR PALETTE
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("3. " + ("Color Palette" if en else "Paleta de Colores"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph("Primary Colors" if en else "Colores Primarios", s['h2']))
    color_data = [
        [sw(C["primary"]), "Forest Green\n#0D4F3C\nRGB: 13, 79, 60", sw(C["secondary"]), "Rich Gold\n#C8A951\nRGB: 200, 169, 81"],
        [sw(C["primary_dark"]), "Dark Green\n#083028", sw(C["secondary_dark"]), "Dark Gold\n#A68B38"],
        [sw(C["primary_light"]), "Light Green\n#16755A", sw(C["secondary_light"]), "Light Gold\n#E0C76A"],
    ]
    ct = Table(color_data, colWidths=[60, 170, 60, 170])
    ct.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), HexColor(C["text_primary"])),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(ct)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Secondary & Accent Colors" if en else "Colores Secundarios y Acentos", s['h2']))
    accent_data = [
        [sw(C["accent_navy"]), "Navy\n#1B2A4A", sw(C["accent_charcoal"]), "Charcoal\n#2D2D2D", sw(C["accent_cream"]), "Cream\n#F5F0E1"],
    ]
    at = Table(accent_data, colWidths=[60, 100, 60, 100, 60, 100])
    at.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(at)

    story.append(Paragraph(
        "<b>Usage:</b> Forest Green is the dominant brand color (headers, buttons, primary UI). Gold is used for accents, highlights, and premium elements. Navy for text and professional contexts." if en else
        "<b>Uso:</b> Verde Bosque es el color dominante (encabezados, botones, UI principal). Dorado para acentos y elementos premium. Azul marino para texto y contextos profesionales.",
        s['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 4. TYPOGRAPHY
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("4. " + ("Typography" if en else "Tipografía"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    typo_data = [
        [("Role" if en else "Rol"), ("Font" if en else "Fuente"), ("Use" if en else "Uso")],
        [("Headlines" if en else "Títulos"), "Helvetica Bold / Montserrat Bold", ("Contracts, headers, marketing" if en else "Contratos, encabezados, marketing")],
        [("Body" if en else "Cuerpo"), "Helvetica / Open Sans", ("Contracts, documents, web" if en else "Contratos, documentos, web")],
        [("Digital" if en else "Digital"), "Inter / SF Pro", ("App, dashboard, UI" if en else "App, dashboard, UI")],
        [("Monospace" if en else "Monoespaciado"), "SF Mono / Fira Code", ("Tracking numbers, IDs" if en else "Números de rastreo, IDs")],
    ]
    tt = Table(typo_data, colWidths=[80, 180, 200])
    tt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(C["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor(C["bg_light"])]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(tt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 5. SERVICES
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("5. " + ("Services Portfolio" if en else "Portafolio de Servicios"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    services = [
        ("💰 " + ("Personal Loans" if en else "Préstamos Personales"), 
         ("Short and medium-term loans from $500 to $10,000 with flexible payment plans. Weekly or monthly payments. Competitive interest rates." if en else 
          "Préstamos a corto y mediano plazo desde $500 hasta $10,000 con planes de pago flexibles. Pagos semanales o mensuales. Tasas de interés competitivas.")),
        ("🏦 " + ("Tax Refund Advances" if en else "Adelantos de Reembolso"),
         ("Get your tax refund advance while waiting for the IRS. Quick approval, same-day funding available." if en else
          "Obtén tu adelanto de reembolso de impuestos mientras esperas al IRS. Aprobación rápida, fondos disponibles el mismo día.")),
        ("📋 " + ("Payment Plans" if en else "Planes de Pago"),
         ("Flexible payment plans for tax preparation services, immigration services, and more. Split your costs into manageable installments." if en else
          "Planes de pago flexibles para servicios de preparación de impuestos, servicios de inmigración y más. Divide tus costos en cuotas manejables.")),
        ("🤝 " + ("Financial Guidance" if en else "Orientación Financiera"),
         ("Free financial consultation to help you make the best borrowing decisions for your situation." if en else
          "Consulta financiera gratuita para ayudarte a tomar las mejores decisiones de préstamo para tu situación.")),
    ]
    for title, desc in services:
        story.append(Paragraph(title, s['h3']))
        story.append(Paragraph(desc, s['body']))
        story.append(Spacer(1, 8))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 6. STATIONERY & TEMPLATES
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("6. " + ("Stationery & Templates" if en else "Papelería y Plantillas"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph("Business Card" if en else "Tarjeta de Presentación", s['h2']))
    bc = Drawing(350, 200)
    bc.add(Rect(0, 0, 350, 200, fillColor=HexColor(C["primary"]), strokeColor=None, rx=10))
    bc.add(Rect(0, 0, 8, 200, fillColor=HexColor(C["secondary"]), strokeColor=None))
    bc.add(String(30, 160, "ROSS", fontSize=24, fontName='Helvetica-Bold', fillColor=white))
    bc.add(String(30, 140, "LENDING SOLUTIONS LLC", fontSize=10, fontName='Helvetica-Bold', fillColor=HexColor(C["secondary"])))
    bc.add(String(30, 110, "Yoandy Ross", fontSize=14, fontName='Helvetica-Bold', fillColor=white))
    bc.add(String(30, 94, "Owner / Sole Member", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["accent_silver"])))
    bc.add(String(30, 60, "📞 (806) 934-2018", fontSize=9, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    bc.add(String(30, 45, "📧 info@rosslending.com", fontSize=9, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    bc.add(String(30, 30, "📍 305 Bruce Ave, Dumas, TX 79029", fontSize=9, fontName='Helvetica', fillColor=HexColor("#CCCCCC")))
    story.append(bc)
    story.append(Spacer(1, 20))

    story.append(Paragraph("Letterhead" if en else "Membrete", s['h2']))
    story.append(Paragraph(
        "• Top: Logo (left) + company info (right)<br/>• Bottom: Green bar with gold accent line<br/>• Footer: Address, phone, email, NMLS if applicable" if en else
        "• Arriba: Logo (izquierda) + info de empresa (derecha)<br/>• Abajo: Barra verde con línea dorada<br/>• Pie: Dirección, teléfono, email, NMLS si aplica",
        s['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 7. DIGITAL PRESENCE
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("7. " + ("Digital & Social Media" if en else "Digital y Redes Sociales"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph("Social Media Guidelines" if en else "Guía de Redes Sociales", s['h2']))
    social_data = [
        [("Platform" if en else "Plataforma"), ("Profile Photo" if en else "Foto de Perfil"), ("Cover/Banner" if en else "Portada/Banner")],
        ["Facebook", ("Logo on green bg" if en else "Logo en fondo verde"), ("Green gradient + gold tagline" if en else "Degradado verde + eslogan dorado")],
        ["Instagram", ("Logo icon on green" if en else "Ícono logo en verde"), ("Carousel: services, testimonials" if en else "Carrusel: servicios, testimonios")],
        ["TikTok", ("Logo on green" if en else "Logo en verde"), ("Financial tips, behind-the-scenes" if en else "Tips financieros, detrás de escenas")],
        ["Google Business", ("Logo" if en else "Logo"), ("Office photo + branding" if en else "Foto oficina + marca")],
    ]
    st = Table(social_data, colWidths=[80, 170, 210])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(C["primary"])),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor(C["bg_light"])]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(st)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Tone of Voice" if en else "Tono de Voz", s['h2']))
    tones = [
        ("Professional yet approachable" if en else "Profesional pero accesible"),
        ("Empathetic — we understand financial challenges" if en else "Empático — entendemos los desafíos financieros"),
        ("Clear and transparent — no jargon" if en else "Claro y transparente — sin jerga"),
        ("Bilingual (English/Spanish) in all communications" if en else "Bilingüe (Inglés/Español) en todas las comunicaciones"),
        ("Empowering — helping clients take control" if en else "Empoderante — ayudando a los clientes a tomar control"),
    ]
    for t in tones:
        story.append(Paragraph(f"• {t}", s['bullet']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════
    # 8. LEGAL & COMPLIANCE
    # ═══════════════════════════════════════════════════════════════
    story.append(Paragraph("8. " + ("Legal & Compliance" if en else "Legal y Cumplimiento"), s['h1']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor(C["secondary"]), spaceAfter=12))

    story.append(Paragraph(
        "<b>Legal Name:</b> Ross Lending Solutions LLC<br/>"
        "<b>Jurisdiction:</b> State of Texas, United States<br/>"
        "<b>Type:</b> Domestic Limited Liability Company (LLC)<br/>"
        "<b>Address:</b> 305 Bruce Ave, Dumas, TX 79029<br/>"
        "<b>Owner:</b> Yoandy Ross, Sole Member<br/>"
        if en else
        "<b>Nombre Legal:</b> Ross Lending Solutions LLC<br/>"
        "<b>Jurisdicción:</b> Estado de Texas, Estados Unidos<br/>"
        "<b>Tipo:</b> Compañía de Responsabilidad Limitada (LLC)<br/>"
        "<b>Dirección:</b> 305 Bruce Ave, Dumas, TX 79029<br/>"
        "<b>Propietario:</b> Yoandy Ross, Miembro Único<br/>",
        s['body']
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Required Disclosures" if en else "Divulgaciones Requeridas", s['h2']))
    story.append(Paragraph(
        "All loan documents, marketing materials, and digital presence must include:<br/>"
        "• Full legal company name<br/>"
        "• NMLS number (when obtained)<br/>"
        "• Texas OCCC license number (when obtained)<br/>"
        "• Equal opportunity lending disclaimer<br/>"
        "• APR and terms disclosure on all advertising<br/>"
        "• Privacy policy link on digital platforms"
        if en else
        "Todos los documentos de préstamos, materiales de marketing y presencia digital deben incluir:<br/>"
        "• Nombre legal completo de la empresa<br/>"
        "• Número NMLS (cuando se obtenga)<br/>"
        "• Número de licencia Texas OCCC (cuando se obtenga)<br/>"
        "• Descargo de responsabilidad de igualdad de oportunidades<br/>"
        "• Divulgación de APR y términos en toda publicidad<br/>"
        "• Enlace a política de privacidad en plataformas digitales",
        s['body']
    ))
    story.append(Spacer(1, 30))

    # Footer
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(C["primary"]), spaceAfter=10))
    story.append(Paragraph(
        f"Ross Lending Solutions LLC — Brand Identity Guide v1.0 — {datetime.now().strftime('%B %Y')}",
        s['center']
    ))
    story.append(Paragraph(
        "305 Bruce Ave, Dumas, TX 79029 · (806) 934-2018",
        s['small']
    ))

    doc.build(story)
    print(f"✅ PDF generated: {path}")


def send_pdfs(paths, to):
    """Send branding PDFs via email."""
    from dotenv import load_dotenv
    load_dotenv()
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

    msg = Mail(
        from_email='info@rosstaxpreparation.com',
        to_emails=to,
        subject='🏦 Ross Lending Solutions LLC — Brand Identity Guide / Guía de Marca',
        html_content=f"""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
            <div style="background:linear-gradient(135deg, #0D4F3C, #16755A);padding:30px;text-align:center;border-radius:10px 10px 0 0">
                <h1 style="color:white;margin:0;font-size:28px">ROSS</h1>
                <h2 style="color:#C8A951;margin:4px 0 0 0;font-size:14px;letter-spacing:3px">LENDING SOLUTIONS LLC</h2>
            </div>
            <div style="padding:25px;background:#f8faf9;border:1px solid #e2e8f0">
                <h3 style="color:#0D4F3C;margin-top:0">Brand Identity Guide / Guía de Identidad de Marca</h3>
                <p style="color:#4a5568;font-size:14px">
                    Hi Yoandy,<br/><br/>
                    Attached you'll find the complete brand identity guide for <strong>Ross Lending Solutions LLC</strong> in both English and Spanish.
                </p>
                <p style="color:#4a5568;font-size:14px">
                    Hola Yoandy,<br/><br/>
                    Adjunto encontrarás la guía completa de identidad de marca de <strong>Ross Lending Solutions LLC</strong> en inglés y español.
                </p>
                <div style="background:white;padding:15px;border-radius:8px;margin:16px 0;border-left:4px solid #C8A951">
                    <p style="margin:0;font-size:13px;color:#2d3748"><strong>📎 Attachments / Adjuntos:</strong></p>
                    <ul style="margin:8px 0 0 0;padding-left:20px;font-size:13px;color:#4a5568">
                        <li>Ross_Lending_Solutions_Brand_Guide_EN.pdf (English)</li>
                        <li>Ross_Lending_Solutions_Guia_Marca_ES.pdf (Español)</li>
                    </ul>
                </div>
                <p style="color:#4a5568;font-size:13px">
                    <strong>Brand Colors:</strong> Forest Green (#0D4F3C) + Rich Gold (#C8A951)<br/>
                    <strong>Tagline:</strong> "Your Financial Partner in Every Step"
                </p>
            </div>
            <div style="background:#0D4F3C;padding:15px;text-align:center;border-radius:0 0 10px 10px">
                <p style="color:#9CA3AF;font-size:11px;margin:0">Ross Lending Solutions LLC — Brand Guide v1.0 — {datetime.now().strftime('%B %Y')}</p>
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
    p1 = "/app/memory/Ross_Lending_Solutions_Brand_Guide_EN.pdf"
    p2 = "/app/memory/Ross_Lending_Solutions_Guia_Marca_ES.pdf"

    print("=" * 60)
    print("🏦 Ross Lending Solutions — English")
    generate_rls_pdf(p1, "en")

    print("=" * 60)
    print("🏦 Ross Lending Solutions — Español")
    generate_rls_pdf(p2, "es")

    print("=" * 60)
    print("📧 Sending PDFs...")
    send_pdfs([p1, p2], "yoandyross@gmail.com")
    print("✅ Done!")
