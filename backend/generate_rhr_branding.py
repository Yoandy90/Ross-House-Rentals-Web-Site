#!/usr/bin/env python3
"""
Ross House Rentals LLC — Complete Brand Identity Guide (EN & ES)
With official logo integrated throughout.
"""
import os, base64
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image as RLImage
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

LOGO_ORIG = "/app/memory/ross_house_logo.png"
LOGO_WHITE = "/app/memory/ross_house_logo_white.jpg"
LOGO_SMALL = "/app/memory/ross_house_logo_small.jpg"

# Brand Colors
C = {
    "primary": "#ED1B33",         # Brand Red - energy, passion, home warmth
    "primary_rgb": "237, 27, 51",
    "primary_cmyk": "0, 93, 77, 2",
    "primary_dark": "#C41428",    # Darker red
    "primary_light": "#F25A6A",   # Lighter red
    "secondary": "#231F20",       # Near Black/Charcoal
    "secondary_rgb": "35, 31, 32",
    "secondary_cmyk": "63, 62, 59, 80",
    "secondary_light": "#4A4446", # Lighter charcoal
    # Complementary palette
    "accent_warm": "#F5A623",     # Warm Gold - premium, trust
    "accent_neutral": "#8C8C8C",  # Warm Gray - sophistication
    "accent_cream": "#FAF3E8",    # Cream - warmth, invitation
    "accent_sage": "#7A9E7E",     # Sage Green - home, nature, growth
    "accent_navy": "#1E3A5F",     # Navy Blue - trust, professionalism
    # Functional
    "success": "#059669",
    "warning": "#F59E0B",
    "error": "#DC2626",
    "info": "#3B82F6",
    "bg_light": "#FAFAFA",
    "bg_warm": "#FFF8F0",
    "text_primary": "#1A1A2E",
    "text_secondary": "#4A5568",
    "text_light": "#9CA3AF",
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
        'quote': ParagraphStyle('Q', parent=ss['Normal'], fontSize=12, fontName='Helvetica-Oblique', textColor=HexColor(pc), alignment=TA_CENTER, spaceBefore=12, spaceAfter=12, leftIndent=30, rightIndent=30),
        'caption': ParagraphStyle('C', parent=ss['Normal'], fontSize=9, textColor=HexColor("#4A5568"), fontName='Helvetica-Oblique'),
        'footer': ParagraphStyle('F', parent=ss['Normal'], fontSize=9, textColor=HexColor("#9CA3AF"), alignment=TA_CENTER),
    }


def mk_hr(c="#ED1B33"): return HRFlowable(width="100%", thickness=1, color=HexColor(c), spaceAfter=15)

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


def generate_rhr_pdf(path, lang="en"):
    en = lang == "en"
    doc = SimpleDocTemplate(path, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    s = mk_styles(C["primary"], C["secondary"])
    story = []

    # ═══════════════════════════════════════════
    # COVER
    # ═══════════════════════════════════════════
    story.append(Spacer(1, 40))
    # Logo on clean white background — properly sized with correct aspect ratio (2.29:1)
    story.append(RLImage(LOGO_ORIG, width=320, height=140))
    story.append(Spacer(1, 15))

    story.append(Paragraph("Complete Brand Identity Guide" if en else "Guía Completa de Identidad de Marca", s['subtitle']))
    story.append(HRFlowable(width="60%", thickness=2, color=HexColor(C["primary"]), spaceBefore=8, spaceAfter=8))
    story.append(Paragraph("Brand Identity Guide 2025", s['footer']))
    story.append(Spacer(1, 40))

    ci = [["Company:" if en else "Empresa:", "Ross House Rentals LLC"],
          ["Industry:" if en else "Industria:", "Property Rental & Real Estate" if en else "Renta de Propiedades e Inmobiliaria"],
          ["Founder:" if en else "Fundador:", "Yoandy Ross"],
          ["Location:" if en else "Ubicación:", "Texas, USA"],
          ["Date:" if en else "Fecha:", datetime.now().strftime("%B %Y")],
          ["Version:" if en else "Versión:", "1.0"]]
    ct = Table(ci, colWidths=[120, 300])
    ct.setStyle(TableStyle([('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTNAME',(1,0),(1,-1),'Helvetica'),
        ('FONTSIZE',(0,0),(-1,-1),11),('TEXTCOLOR',(0,0),(0,-1),HexColor(C["primary"])),
        ('BOTTOMPADDING',(0,0),(-1,-1),8),('ALIGN',(0,0),(0,-1),'RIGHT')]))
    story.append(ct)
    story.append(Spacer(1, 30))
    story.append(Paragraph("CONFIDENTIAL" if en else "CONFIDENCIAL",
        ParagraphStyle('X', parent=s['bc'], fontSize=9, textColor=HexColor(C["error"]), fontName='Helvetica-Bold')))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # TOC
    # ═══════════════════════════════════════════
    story.append(Paragraph("Table of Contents" if en else "Contenido", s['h1']))
    story.append(mk_hr(C["primary"]))
    toc_en = ["1. Brand Vision & Mission","2. Primary Color Palette","3. Extended & Functional Colors",
              "4. Typography","5. Logo & Variations","6. Iconography & Visual Elements",
              "7. Tone of Voice & Messaging","8. Business Cards","9. Stationery & Lease Documents",
              "10. Digital & Social Media","11. Signage, Property & Vehicle Branding",
              "12. Prohibited Combinations","13. Photography & Property Imagery","14. Launch Checklist"]
    toc_es = ["1. Visión y Misión","2. Paleta de Colores Principal","3. Colores Extendidos y Funcionales",
              "4. Tipografía","5. Logotipo y Variaciones","6. Iconografía y Elementos Visuales",
              "7. Tono de Voz y Mensajería","8. Tarjetas de Presentación","9. Papelería y Documentos de Arrendamiento",
              "10. Digital y Redes Sociales","11. Señalización, Propiedades y Vehículos",
              "12. Combinaciones Prohibidas","13. Fotografía de Propiedades","14. Checklist de Lanzamiento"]
    for item in (toc_en if en else toc_es):
        story.append(Paragraph(item, ParagraphStyle('TOC', parent=s['body'], fontSize=13, spaceBefore=5, spaceAfter=5, leftIndent=20)))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 1. VISION & MISSION
    # ═══════════════════════════════════════════
    story.append(Paragraph("1. Brand Vision & Mission" if en else "1. Visión y Misión de la Marca", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(RLImage(LOGO_SMALL, width=80, height=80))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Mission" if en else "Misión", s['h2']))
    story.append(Paragraph("To provide quality, well-maintained rental properties that families and individuals can proudly call home, with transparent pricing, responsive maintenance, and a personal touch that large property management companies can't match." if en else
        "Proveer propiedades de renta de calidad y bien mantenidas que familias e individuos puedan llamar hogar con orgullo, con precios transparentes, mantenimiento rápido y un toque personal que las grandes empresas de gestión no pueden igualar.", s['body']))

    story.append(Paragraph("Vision" if en else "Visión", s['h2']))
    story.append(Paragraph("To become the most trusted and recognized residential rental brand in Texas, known for treating every tenant like family and every property like our own home." if en else
        "Ser la marca de renta residencial más confiable y reconocida en Texas, conocida por tratar a cada inquilino como familia y cada propiedad como nuestro propio hogar.", s['body']))

    story.append(Paragraph("Brand Values" if en else "Valores de Marca", s['h2']))
    vals_en = [("Home", "Every property we manage is someone's sanctuary. We treat it with the care it deserves."),
               ("Trust", "Transparent lease terms, honest pricing, and reliable communication — always."),
               ("Quality", "Well-maintained properties, prompt repairs, and modern amenities standard."),
               ("Community", "We invest in our neighborhoods and build lasting relationships with tenants."),
               ("Responsiveness", "24/7 maintenance support. Your emergency is our emergency.")]
    vals_es = [("Hogar", "Cada propiedad que gestionamos es el santuario de alguien. La tratamos con el cuidado que merece."),
               ("Confianza", "Términos de arrendamiento transparentes, precios honestos y comunicación confiable — siempre."),
               ("Calidad", "Propiedades bien mantenidas, reparaciones rápidas y amenidades modernas de serie."),
               ("Comunidad", "Invertimos en nuestros vecindarios y construimos relaciones duraderas con inquilinos."),
               ("Respuesta Rápida", "Soporte de mantenimiento 24/7. Tu emergencia es nuestra emergencia.")]
    for n, d in (vals_en if en else vals_es):
        story.append(Paragraph(f"<b>• {n}:</b> {d}", s['bullet']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('"Your Home, Our Commitment"' if en else '"Tu Hogar, Nuestro Compromiso"', s['quote']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 2. PRIMARY COLORS
    # ═══════════════════════════════════════════
    story.append(Paragraph("2. Primary Color Palette" if en else "2. Paleta de Colores Principal", s['h1']))
    story.append(mk_hr(C["primary"]))

    story.append(Paragraph("The Ross House Rentals brand is built on two powerful colors directly from the logo:" if en else
        "La marca Ross House Rentals se construye sobre dos colores poderosos directamente del logo:", s['body']))

    story.append(RLImage(LOGO_WHITE, width=200, height=87))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Logo Color Breakdown:" if en else "Desglose de Colores del Logo:", s['h3']))
    story.append(Paragraph(
        '• <b>House rooflines, windows, horizon line, and "RENTALS LLC" text:</b> Brand Red (#ED1B33) — Energy, warmth, and passion for real estate<br/>'
        '• <b>Background and "ROSS HOUSE" text:</b> Charcoal Black (#231F20) — Sophistication, strength, and premium positioning' if en else
        '• <b>Líneas de techo, ventanas, línea horizonte y texto "RENTALS LLC":</b> Rojo de Marca (#ED1B33) — Energía, calidez y pasión por bienes raíces<br/>'
        '• <b>Fondo y texto "ROSS HOUSE":</b> Negro Carbón (#231F20) — Sofisticación, fortaleza y posicionamiento premium', s['body']))

    story.append(Spacer(1, 10))
    pc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB / CMYK", "Use" if en else "Uso"],
        [sw(C["primary"]), "Brand Red\n(Primary)" if en else "Rojo de Marca\n(Primario)", C["primary"],
         f"RGB: {C['primary_rgb']}\nCMYK: {C['primary_cmyk']}", "Logo elements,\nCTAs, highlights" if en else "Elementos del logo,\nCTAs, resaltados"],
        [sw(C["secondary"]), "Charcoal Black\n(Secondary)" if en else "Negro Carbón\n(Secundario)", C["secondary"],
         f"RGB: {C['secondary_rgb']}\nCMYK: {C['secondary_cmyk']}", "Logo background,\nheaders, text" if en else "Fondo del logo,\nencabezados, texto"],
        [sw(C["primary_dark"]), "Deep Red\n(Primary Dark)", "#C41428", "196, 20, 40",
         "Hover states,\ndark accents" if en else "Estados hover,\nacentos oscuros"],
        [sw(C["secondary_light"]), "Warm Charcoal\n(Secondary Light)", "#4A4446", "74, 68, 70",
         "Subheadings,\nsecondary text" if en else "Subtítulos,\ntexto secundario"]]
    story.append(mk_table(pc_rows, C["secondary"], [60, 90, 60, 115, 115]))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Usage Proportions" if en else "Proporciones de Uso", s['h3']))
    prop = Drawing(450, 50)
    prop.add(Rect(0, 10, 180, 30, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    prop.add(Rect(180, 10, 160, 30, fillColor=HexColor(C["primary"]), strokeWidth=0))
    prop.add(Rect(340, 10, 110, 30, fillColor=HexColor("#FAF3E8"), strokeColor=HexColor("#E5E7EB"), strokeWidth=0.5))
    prop.add(String(65, 20, "40%", fontSize=13, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(245, 20, "35%", fontSize=12, fontName='Helvetica-Bold', fillColor=white))
    prop.add(String(380, 20, "25%", fontSize=12, fontName='Helvetica-Bold', fillColor=HexColor(C["secondary"])))
    story.append(prop)
    labels = [["Charcoal: 40%", "Brand Red: 35%", "White/Cream: 25%"] if en else ["Negro Carbón: 40%", "Rojo Marca: 35%", "Blanco/Crema: 25%"]]
    lt = Table(labels, colWidths=[150, 150, 150])
    lt.setStyle(TableStyle([('FONTSIZE',(0,0),(-1,-1),9),('ALIGN',(0,0),(-1,-1),'CENTER'),('TEXTCOLOR',(0,0),(-1,-1),HexColor(C["text_secondary"]))]))
    story.append(lt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 3. EXTENDED & FUNCTIONAL COLORS
    # ═══════════════════════════════════════════
    story.append(Paragraph("3. Extended & Functional Colors" if en else "3. Colores Extendidos y Funcionales", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Beyond the two logo colors, these complementary and functional colors complete the brand system:" if en else
        "Más allá de los dos colores del logo, estos colores complementarios y funcionales completan el sistema de marca:", s['body']))

    sc_rows = [["", "Name" if en else "Nombre", "HEX", "RGB", "Use" if en else "Uso"],
        [sw(C["accent_warm"]), "Warm Gold", "#F5A623", "245, 166, 35", "Premium listings,\nfeatured properties" if en else "Listados premium,\npropiedades destacadas"],
        [sw(C["accent_cream"]), "Warm Cream", "#FAF3E8", "250, 243, 232", "Backgrounds,\nwarm sections" if en else "Fondos,\nsecciones cálidas"],
        [sw(C["accent_sage"]), "Sage Green", "#7A9E7E", "122, 158, 126", "Nature, gardens,\neco-friendly" if en else "Naturaleza, jardines,\neco-friendly"],
        [sw(C["accent_navy"]), "Navy Blue", "#1E3A5F", "30, 58, 95", "Trust, legal,\ncontracts" if en else "Confianza, legal,\ncontratos"],
        [sw(C["accent_neutral"]), "Warm Gray", "#8C8C8C", "140, 140, 140", "Secondary text,\nborders" if en else "Texto secundario,\nbordos"],
        [sw(C["success"]), "Success Green", "#059669", "5, 150, 105", "Available, approved" if en else "Disponible, aprobado"],
        [sw(C["warning"]), "Warning Amber", "#F59E0B", "245, 158, 11", "Pending, maintenance" if en else "Pendiente, mantenimiento"],
        [sw(C["error"]), "Error Red", "#DC2626", "220, 38, 38", "Overdue, urgent" if en else "Vencido, urgente"],
        [sw(C["info"]), "Info Blue", "#3B82F6", "59, 130, 246", "Links, info" if en else "Links, información"],
        [sw("#FAFAFA"), "Background", "#FAFAFA", "250, 250, 250", "Page backgrounds" if en else "Fondos de página"]]
    story.append(mk_table(sc_rows, C["secondary"], [60, 80, 60, 100, 140]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Approved Gradients" if en else "Gradientes Aprobados", s['h3']))
    gr = [["Gradient" if en else "Gradiente", "From" if en else "De", "To" if en else "A", "Use" if en else "Uso"],
          ["Bold" if en else "Audaz", C["secondary"], C["primary"], "Heroes, cover photos" if en else "Heroes, portadas"],
          ["Premium", C["secondary"], C["accent_warm"], "VIP listings, luxury" if en else "Listados VIP, lujo"],
          ["Trust" if en else "Confianza", C["accent_navy"], C["secondary"], "Legal, lease docs" if en else "Legal, contratos"],
          ["Warm" if en else "Cálido", C["accent_cream"], "#FFFFFF", "Content backgrounds" if en else "Fondos de contenido"]]
    story.append(mk_table(gr, C["primary"], [90, 90, 90, 170]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 4. TYPOGRAPHY
    # ═══════════════════════════════════════════
    story.append(Paragraph("4. Typography" if en else "4. Tipografía", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("<b>Inter</b> — Primary digital font for website, app, and emails. Clean, modern, and highly readable across all screen sizes." if en else
        "<b>Inter</b> — Fuente digital principal para web, app y emails. Limpia, moderna y altamente legible en todos los tamaños de pantalla.", s['body']))
    story.append(Paragraph("<b>Playfair Display</b> — Secondary display font for luxury/premium property listings and marketing headlines. Serif elegance that conveys quality real estate." if en else
        "<b>Playfair Display</b> — Fuente de display secundaria para listados premium y titulares de marketing. Elegancia serif que transmite bienes raíces de calidad.", s['body']))

    ty = [["Element" if en else "Elemento", "Font" if en else "Fuente", "Weight" if en else "Peso", "Size" if en else "Tamaño", "Example" if en else "Ejemplo"],
        ["H1 - Headlines" if en else "H1 - Titulares", "Playfair Display", "Bold (700)", "28-36px", "Find Your Home" if en else "Encuentra Tu Hogar"],
        ["H2 - Sections" if en else "H2 - Secciones", "Inter", "SemiBold (600)", "20-24px", "Available Properties" if en else "Propiedades Disponibles"],
        ["H3 - Cards" if en else "H3 - Tarjetas", "Inter", "SemiBold (600)", "16-18px", "3 Bed / 2 Bath"],
        ["Body", "Inter", "Regular (400)", "14-16px", "This spacious..." if en else "Este amplio..."],
        ["Price" if en else "Precio", "Inter", "Bold (700)", "24-32px", "$1,850/mo"],
        ["CTA", "Inter", "SemiBold (600)", "14-16px", "SCHEDULE TOUR" if en else "AGENDAR TOUR"],
        ["Address" if en else "Dirección", "Inter", "Regular (400)", "13-14px", "123 Oak Lane, Houston TX"],
        ["Legal", "Inter", "Regular (400)", "10-11px", "Terms & Conditions" if en else "Términos"]]
    story.append(mk_table(ty, C["secondary"], [75, 85, 75, 60, 145]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Rent amounts always in <b>Brand Red (#ED1B33), Bold, 24-32px</b>. Addresses in regular weight. Property names can use Playfair Display for an upscale feel." if en else
        "Montos de renta siempre en <b>Rojo de Marca (#ED1B33), Bold, 24-32px</b>. Direcciones en peso regular. Nombres de propiedades pueden usar Playfair Display para un toque premium.", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 5. LOGO & VARIATIONS
    # ═══════════════════════════════════════════
    story.append(Paragraph("5. Logo & Variations" if en else "5. Logotipo y Variaciones", s['h1']))
    story.append(mk_hr(C["primary"]))

    story.append(Paragraph("Official Logo" if en else "Logo Oficial", s['h2']))
    story.append(Paragraph("The Ross House Rentals logo features two stylized rooflines with windows, creating a distinctive double-house silhouette. A horizontal line grounds the design, and 'RENTALS LLC' appears below in bold serif typography." if en else
        "El logo de Ross House Rentals presenta dos líneas de techo estilizadas con ventanas, creando una silueta distintiva de doble casa. Una línea horizontal ancla el diseño, y 'RENTALS LLC' aparece debajo en tipografía serif bold.", s['body']))

    story.append(Paragraph("Primary Version (Dark Background)" if en else "Versión Principal (Fondo Oscuro)", s['h3']))
    story.append(RLImage(LOGO_ORIG, width=300, height=131))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Light Background Version" if en else "Versión en Fondo Claro", s['h3']))
    story.append(RLImage(LOGO_WHITE, width=300, height=131))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Logo Anatomy" if en else "Anatomía del Logo", s['h3']))
    story.append(Paragraph(
        '• <b>Double roofline:</b> Brand Red (#ED1B33) — Flowing curves representing two connected homes, symbolizing community<br/>'
        '• <b>Windows (4 panes each):</b> Brand Red (#ED1B33) — Classic 4-pane window design adds residential character<br/>'
        '• <b>Horizontal ground line:</b> Brand Red (#ED1B33) — Anchors the house, represents stability and foundation<br/>'
        '• <b>"ROSS HOUSE" text:</b> Part of the full company name, appears in marketing materials<br/>'
        '• <b>"RENTALS LLC" text:</b> Brand Red (#ED1B33) — Bold serif font, legal entity identifier' if en else
        '• <b>Doble línea de techo:</b> Rojo de Marca (#ED1B33) — Curvas fluidas representando dos casas conectadas, simbolizando comunidad<br/>'
        '• <b>Ventanas (4 paneles c/u):</b> Rojo de Marca (#ED1B33) — Diseño clásico de 4 paneles agrega carácter residencial<br/>'
        '• <b>Línea horizontal base:</b> Rojo de Marca (#ED1B33) — Ancla la casa, representa estabilidad y fundamento<br/>'
        '• <b>Texto "ROSS HOUSE":</b> Parte del nombre completo, aparece en materiales de marketing<br/>'
        '• <b>Texto "RENTALS LLC":</b> Rojo de Marca (#ED1B33) — Fuente serif bold, identificador de entidad legal', s['body']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Rules" if en else "Reglas", s['h3']))
    story.append(Paragraph(
        "• Clear space: Width of one window pane on all sides • Min digital: 150px wide • Min print: 2\" wide • "
        "Never modify the roofline shape • Never separate the house icon from the text • "
        "The double-roof design must always appear as a connected unit" if en else
        "• Zona clara: Ancho de un panel de ventana en todos los lados • Mín. digital: 150px ancho • Mín. impreso: 2\" ancho • "
        "Nunca modificar la forma del techo • Nunca separar el ícono de la casa del texto • "
        "El diseño de doble techo siempre debe aparecer como unidad conectada", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 6. ICONOGRAPHY
    # ═══════════════════════════════════════════
    story.append(Paragraph("6. Iconography" if en else "6. Iconografía", s['h1']))
    story.append(mk_hr(C["primary"]))
    ic = [["Concept" if en else "Concepto", "Icon" if en else "Ícono", "Color", "Use" if en else "Uso"],
        ["Property" if en else "Propiedad", "home / home-outline", C["primary"], "Listings" if en else "Listados"],
        ["For Rent" if en else "En Renta", "pricetag-outline", C["primary"], "Available" if en else "Disponible"],
        ["Location" if en else "Ubicación", "location-outline", C["primary"], "Maps, addresses" if en else "Mapas, direcciones"],
        ["Keys" if en else "Llaves", "key-outline", C["accent_warm"], "Move-in, access" if en else "Mudanza, acceso"],
        ["Maintenance", "construct-outline", C["warning"], "Repairs, requests" if en else "Reparaciones"],
        ["Lease" if en else "Contrato", "document-text", C["accent_navy"], "Contracts" if en else "Contratos"],
        ["Payment" if en else "Pago", "card-outline", C["secondary"], "Rent payments" if en else "Pagos de renta"],
        ["Calendar" if en else "Calendario", "calendar-outline", C["info"], "Tours, move-in" if en else "Tours, mudanza"],
        ["Available" if en else "Disponible", "checkmark-circle", C["success"], "Vacancy" if en else "Vacante"],
        ["Occupied" if en else "Ocupado", "close-circle", C["error"], "No vacancy" if en else "Sin vacante"],
        ["Photos" if en else "Fotos", "images-outline", C["accent_warm"], "Gallery" if en else "Galería"],
        ["Contact" if en else "Contacto", "call-outline", C["primary"], "Phone, inquiry" if en else "Teléfono"]]
    story.append(mk_table(ic, C["secondary"], [80, 120, 70, 170]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Visual rules: border-radius 12px cards, 8px buttons • property cards with subtle shadow • rent prices always Brand Red, large, bold • status badges with soft background" if en else
        "Reglas visuales: border-radius 12px cards, 8px botones • cards de propiedades con sombra sutil • precios de renta siempre Rojo de Marca, grande, bold • badges de estado con fondo suave", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 7. TONE OF VOICE
    # ═══════════════════════════════════════════
    story.append(Paragraph("7. Tone of Voice" if en else "7. Tono de Voz", s['h1']))
    story.append(mk_hr(C["primary"]))
    pe = [["Attribute" if en else "Atributo", "We Are" if en else "Somos", "We Are Not" if en else "No Somos"],
        ["Tone" if en else "Tono", "Warm, welcoming, professional" if en else "Cálido, acogedor, profesional", "Cold, corporate, pushy" if en else "Frío, corporativo, insistente"],
        ["Language" if en else "Lenguaje", "Clear, bilingual, inviting" if en else "Claro, bilingüe, invitador", "Legal jargon, complex" if en else "Jerga legal, complejo"],
        ["Attitude" if en else "Actitud", "Helpful neighbor, trusted guide" if en else "Vecino servicial, guía confiable", "Impersonal landlord" if en else "Arrendador impersonal"],
        ["Communication" if en else "Comunicación", "Responsive, proactive, caring" if en else "Responsiva, proactiva, cercana", "Slow, reactive, distant" if en else "Lenta, reactiva, distante"]]
    story.append(mk_table(pe, C["secondary"], [100, 170, 170]))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Taglines & Slogans", s['h2']))
    tags = [('"Your Home, Our Commitment"', '"Tu Hogar, Nuestro Compromiso"'),
            ('"Quality Homes. Happy Tenants."', '"Hogares de Calidad. Inquilinos Felices."'),
            ('"Where Every Tenant Feels Like Family"', '"Donde Cada Inquilino Se Siente Como Familia"'),
            ('"Find Your Perfect Rental"', '"Encuentra Tu Renta Perfecta"'),
            ('"Home Sweet Rental"', '"Hogar Dulce Renta"')]
    for e, es in tags:
        story.append(Paragraph(f"• {e if en else es}", s['bullet']))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Messaging Examples" if en else "Ejemplos de Mensajería", s['h2']))
    mg = [["Situation" if en else "Situación", "Correct ✅" if en else "Correcto ✅", "Incorrect ❌" if en else "Incorrecto ❌"],
        ["New listing" if en else "Nuevo listado",
         '"Beautiful 3-bed home now\navailable on Oak Lane!"' if en else '"¡Hermosa casa de 3 recámaras\ndisponible en Oak Lane!"',
         '"Unit 4B available.\nContact management."' if en else '"Unidad 4B disponible.\nContactar administración."'],
        ["Maintenance" if en else "Mantenimiento",
         '"We got your request!\nOur team will be there\nby tomorrow morning."' if en else '"¡Recibimos tu solicitud!\nNuestro equipo estará ahí\nmañana temprano."',
         '"Work order #4521 received.\nExpect 3-5 business days."' if en else '"Orden #4521 recibida.\nEspere 3-5 días hábiles."'],
        ["Welcome" if en else "Bienvenida",
         '"Welcome home! We\'re so\nexcited you chose Ross\nHouse Rentals."' if en else '"¡Bienvenido a tu nuevo hogar!\nEstamos emocionados de que\neligieras Ross House Rentals."',
         '"Lease signed.\nMove-in date confirmed."' if en else '"Contrato firmado.\nFecha de mudanza confirmada."']]
    story.append(mk_table(mg, C["secondary"], [75, 175, 185]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 8. BUSINESS CARDS
    # ═══════════════════════════════════════════
    story.append(Paragraph("8. Business Cards" if en else "8. Tarjetas de Presentación", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Front" if en else "Frontal", s['h2']))
    cf = Drawing(360, 200)
    cf.add(Rect(0, 0, 360, 200, fillColor=white, strokeColor=HexColor(C["secondary"]), strokeWidth=2, rx=8))
    cf.add(Rect(0, 145, 360, 55, fillColor=HexColor(C["secondary"]), strokeWidth=0, rx=8))
    cf.add(Rect(0, 145, 360, 25, fillColor=HexColor(C["secondary"]), strokeWidth=0))
    cf.add(String(18, 164, "ROSS HOUSE RENTALS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    cf.add(String(18, 150, "LLC", fontSize=10, fontName='Helvetica', fillColor=HexColor(C["accent_warm"])))
    cf.add(Rect(310, 150, 35, 15, fillColor=HexColor(C["primary"]), strokeWidth=0, rx=3))
    cf.add(String(313, 153, "HOME", fontSize=8, fontName='Helvetica-Bold', fillColor=white))
    cf.add(String(18, 110, "YOANDY ROSS", fontSize=14, fontName='Helvetica-Bold', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 94, "Owner & Property Manager", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_secondary"])))
    cf.add(String(18, 68, "(555) 123-4567", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 53, "yoandy@rosshouserentals.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["text_primary"])))
    cf.add(String(18, 38, "www.rosshouserentals.com", fontSize=9, fontName='Helvetica', fillColor=HexColor(C["primary"])))
    cf.add(String(18, 14, "Licensed Property Manager — Texas", fontSize=7, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    story.append(cf)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Back" if en else "Trasera", s['h2']))
    cb = Drawing(360, 200)
    cb.add(Rect(0, 0, 360, 200, fillColor=HexColor(C["secondary"]), strokeWidth=0, rx=8))
    # Roofline graphic simplified
    cb.add(String(55, 130, "ROSS HOUSE", fontSize=28, fontName='Helvetica-Bold', fillColor=white))
    cb.add(String(73, 105, "RENTALS LLC", fontSize=20, fontName='Helvetica-Bold', fillColor=HexColor(C["primary"])))
    cb.add(Rect(100, 90, 160, 2, fillColor=HexColor(C["primary"]), strokeWidth=0))
    tag = "Your Home, Our Commitment" if en else "Tu Hogar, Nuestro Compromiso"
    cb.add(String(83 if en else 63, 68, tag, fontSize=11, fontName='Helvetica-Oblique', fillColor=HexColor(C["accent_warm"])))
    cb.add(String(55, 28, "Residential Rentals | Property Management" if en else "Renta Residencial | Gestión de Propiedades", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["text_light"])))
    cb.add(String(95, 12, "Houston, TX | Bilingual Service" if en else "Houston, TX | Servicio Bilingüe", fontSize=8, fontName='Helvetica', fillColor=HexColor(C["accent_neutral"])))
    story.append(cb)
    story.append(Spacer(1, 8))
    story.append(Paragraph("3.5\" x 2\" • 16pt matte/silk • Optional: soft touch + red foil on roofline" if en else
        "3.5\" x 2\" • 16pt matte/silk • Opcional: soft touch + foil rojo en línea de techo", s['caption']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 9. STATIONERY & LEASE DOCS
    # ═══════════════════════════════════════════
    story.append(Paragraph("9. Stationery & Lease Documents" if en else "9. Papelería y Documentos de Arrendamiento", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(RLImage(LOGO_SMALL, width=80, height=80))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Letterhead" if en else "Membrete", s['h2']))
    story.append(Paragraph("Header: Charcoal stripe with logo in red + white. Footer: red line + company address + license info. Body: Inter 11pt." if en else
        "Header: Franja carbón con logo rojo + blanco. Footer: línea roja + dirección + licencia. Cuerpo: Inter 11pt.", s['body']))
    story.append(Paragraph("Lease Agreement" if en else "Contrato de Arrendamiento", s['h2']))
    story.append(Paragraph(
        "• <b>Cover page:</b> Logo centered, property photo below, charcoal header with address in white<br/>"
        "• <b>Headers:</b> Charcoal bars with section names in white<br/>"
        "• <b>Rent amount:</b> Brand Red, Bold, prominently displayed<br/>"
        "• <b>Signature lines:</b> Red accent line above, charcoal text below<br/>"
        "• <b>Footer:</b> 'Ross House Rentals LLC' + page numbers" if en else
        "• <b>Portada:</b> Logo centrado, foto de propiedad debajo, header carbón con dirección en blanco<br/>"
        "• <b>Headers:</b> Barras carbón con nombres de sección en blanco<br/>"
        "• <b>Monto de renta:</b> Rojo de Marca, Bold, prominentemente mostrado<br/>"
        "• <b>Líneas de firma:</b> Línea roja arriba, texto carbón debajo<br/>"
        "• <b>Footer:</b> 'Ross House Rentals LLC' + números de página", s['body']))
    story.append(Paragraph("Other Documents" if en else "Otros Documentos", s['h2']))
    story.append(Paragraph("Move-in/Move-out checklists, maintenance request forms, rent receipts, and property condition reports all follow the same brand guidelines with logo in the header and red/charcoal accents." if en else
        "Checklists de mudanza, formularios de mantenimiento, recibos de renta e informes de condición de propiedad siguen las mismas guías con logo en el header y acentos rojo/carbón.", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 10. DIGITAL & SOCIAL
    # ═══════════════════════════════════════════
    story.append(Paragraph("10. Digital & Social Media" if en else "10. Digital y Redes Sociales", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Website" if en else "Sitio Web", s['h2']))
    story.append(Paragraph(
        "• <b>Domain:</b> rosshouserentals.com<br/>"
        "• <b>Navbar:</b> White bg, logo left, red CTA 'Available Properties' right<br/>"
        "• <b>Hero:</b> Full-width property photo with charcoal overlay + white text + red CTA<br/>"
        "• <b>Property cards:</b> White, 12px radius, photo top, price in Brand Red, address below<br/>"
        "• <b>Footer:</b> Charcoal Black with white text + red accent links" if en else
        "• <b>Dominio:</b> rosshouserentals.com<br/>"
        "• <b>Navbar:</b> Fondo blanco, logo izquierda, CTA rojo 'Propiedades Disponibles' derecha<br/>"
        "• <b>Hero:</b> Foto de propiedad a ancho completo + overlay carbón + texto blanco + CTA rojo<br/>"
        "• <b>Property cards:</b> Blancas, radio 12px, foto arriba, precio en Rojo de Marca<br/>"
        "• <b>Footer:</b> Negro Carbón con texto blanco + links rojos", s['body']))

    story.append(Paragraph("Social Media", s['h2']))
    sm = [["Platform" if en else "Plataforma", "Profile" if en else "Perfil", "Content Strategy" if en else "Estrategia de Contenido"],
        ["Facebook", "Logo on charcoal bg" if en else "Logo en fondo carbón", "Property tours, tenant\ntestimonials, community events" if en else "Tours, testimonios,\neventos comunitarios"],
        ["Instagram", "Roofline icon on\ncharcoal bg" if en else "Ícono techo en\nfondo carbón", "Property photos, before/\nafter renovations, reels" if en else "Fotos, renovaciones\nbefore/after, reels"],
        ["TikTok", "Roofline icon on\ncharcoal bg" if en else "Ícono techo en\nfondo carbón", "Property tours, rental\ntips, move-in reveals" if en else "Tours, tips de renta,\nreveals de mudanza"],
        ["Zillow/Realtor", "Full logo on white" if en else "Logo completo en blanco", "Professional listings\nwith brand consistency" if en else "Listados profesionales\ncon consistencia de marca"]]
    story.append(mk_table(sm, C["secondary"], [80, 100, 260]))

    story.append(Paragraph("Email Templates" if en else "Plantillas de Email", s['h2']))
    story.append(Paragraph("Header: Charcoal with centered red logo. CTA: Brand Red button. Footer: warm cream bg with contact info. Signature: logo + name + phone + license." if en else
        "Header: Carbón con logo rojo centrado. CTA: Botón Rojo de Marca. Footer: fondo crema con contacto. Firma: logo + nombre + teléfono + licencia.", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 11. SIGNAGE & PROPERTY BRANDING
    # ═══════════════════════════════════════════
    story.append(Paragraph("11. Signage, Property & Vehicle Branding" if en else "11. Señalización, Propiedades y Vehículos", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Yard Signs (For Rent)" if en else "Letreros de Patio (En Renta)", s['h2']))
    story.append(Paragraph(
        "• <b>Size:</b> 18\" x 24\" corrugated plastic (coroplast)<br/>"
        "• <b>Design:</b> Charcoal background, red roofline logo top, 'FOR RENT' in large white text, phone number in red<br/>"
        "• <b>Rider sign:</b> Red background, white text — 'Se Habla Español' or '3 BED / 2 BATH'<br/>"
        "• <b>Metal H-stake:</b> Black powder-coated" if en else
        "• <b>Tamaño:</b> 18\" x 24\" plástico corrugado (coroplast)<br/>"
        "• <b>Diseño:</b> Fondo carbón, logo de techo rojo arriba, 'EN RENTA' en texto blanco grande, teléfono en rojo<br/>"
        "• <b>Letrero adicional:</b> Fondo rojo, texto blanco — 'Se Habla Español' o '3 REC / 2 BAÑOS'<br/>"
        "• <b>Estaca de metal:</b> Recubrimiento negro mate", s['body']))

    story.append(Paragraph("Vehicle Wraps" if en else "Rotulación de Vehículos", s['h2']))
    story.append(Paragraph(
        "• <b>Truck/SUV doors:</b> Logo large on charcoal magnetic panels or vinyl<br/>"
        "• <b>Rear window:</b> Perforated vinyl with logo + phone number + 'rosshouserentals.com'<br/>"
        "• <b>Color scheme:</b> Charcoal base, red accents, white text for phone/web<br/>"
        "• <b>Tagline:</b> 'Your Home, Our Commitment' on rear or sides" if en else
        "• <b>Puertas de camioneta:</b> Logo grande en paneles magnéticos o vinilo carbón<br/>"
        "• <b>Ventana trasera:</b> Vinilo perforado con logo + teléfono + 'rosshouserentals.com'<br/>"
        "• <b>Esquema de color:</b> Base carbón, acentos rojos, texto blanco para teléfono/web<br/>"
        "• <b>Tagline:</b> 'Tu Hogar, Nuestro Compromiso' en trasera o laterales", s['body']))

    story.append(Paragraph("Property Branding" if en else "Branding de Propiedades", s['h2']))
    story.append(Paragraph(
        "• <b>Lockbox:</b> Branded red sticker with logo on all property lockboxes<br/>"
        "• <b>Welcome packet:</b> Branded folder with lease, welcome letter, local info, and fridge magnet<br/>"
        "• <b>Maintenance stickers:</b> Near water heater/HVAC — red sticker with maintenance phone number<br/>"
        "• <b>Key tags:</b> Charcoal with red logo stamp + property address" if en else
        "• <b>Lockbox:</b> Sticker rojo con logo en todos los lockboxes<br/>"
        "• <b>Paquete de bienvenida:</b> Carpeta con contrato, carta, info local e imán de refrigerador<br/>"
        "• <b>Stickers de mantenimiento:</b> Cerca del calentador/HVAC — sticker rojo con teléfono<br/>"
        "• <b>Llaveros:</b> Carbón con logo rojo + dirección de propiedad", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 12. PROHIBITED
    # ═══════════════════════════════════════════
    story.append(Paragraph("12. Prohibited Combinations" if en else "12. Combinaciones Prohibidas", s['h1']))
    story.append(mk_hr(C["primary"]))
    pr = [["❌ " + ("Prohibited" if en else "Prohibido"), "✅ " + ("Correct" if en else "Correcto")],
        ["Red text on red bg" if en else "Texto rojo sobre fondo rojo", "White on red, or red on charcoal" if en else "Blanco sobre rojo, o rojo sobre carbón"],
        ["Modifying roofline shape" if en else "Modificar forma del techo", "Always use original logo file" if en else "Siempre usar archivo original"],
        ["Logo in non-brand colors" if en else "Logo en colores no oficiales", "Only Brand Red and Charcoal" if en else "Solo Rojo de Marca y Carbón"],
        ["3+ color gradients" if en else "Gradientes 3+ colores", "2-color approved gradients only" if en else "Solo gradientes aprobados"],
        ["Comic Sans or script fonts" if en else "Comic Sans o fuentes script", "Inter (digital) / Playfair (display)" if en else "Inter / Playfair"],
        ["Pure black (#000000)" if en else "Negro puro (#000000)", "Charcoal (#231F20) always" if en else "Carbón (#231F20) siempre"],
        ["Generic stock house photos" if en else "Fotos genéricas de stock", "Actual property photos only" if en else "Solo fotos reales de propiedades"],
        ["Distorting or tilting logo" if en else "Distorsionar o inclinar logo", "Horizontal, undistorted always" if en else "Horizontal, sin distorsión"],
        ["Using house icon alone" if en else "Usar ícono de casa solo", "Icon + text together always" if en else "Ícono + texto siempre juntos"]]
    pt = Table(pr, colWidths=[225, 225])
    pt.setStyle(TableStyle([('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),10),
        ('BACKGROUND',(0,0),(-1,0),HexColor(C["error"])),('TEXTCOLOR',(0,0),(-1,0),white),
        ('BACKGROUND',(0,1),(0,-1),HexColor("#FEF2F2")),('BACKGROUND',(1,1),(1,-1),HexColor("#ECFDF5")),
        ('GRID',(0,0),(-1,-1),0.5,HexColor("#E5E7EB")),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    story.append(pt)
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 13. PHOTOGRAPHY
    # ═══════════════════════════════════════════
    story.append(Paragraph("13. Property Photography" if en else "13. Fotografía de Propiedades", s['h1']))
    story.append(mk_hr(C["primary"]))
    story.append(Paragraph("Photography Guidelines" if en else "Directrices de Fotografía", s['h2']))
    story.append(Paragraph(
        "• <b>Exterior shots:</b> Golden hour lighting (sunrise/sunset), clean landscaping, shot from slight angle<br/>"
        "• <b>Interior shots:</b> Wide-angle, well-lit, staged or clean/minimal, all lights on<br/>"
        "• <b>Key rooms:</b> Always photograph kitchen, living room, master bedroom, and bathrooms<br/>"
        "• <b>Details:</b> Capture updated fixtures, hardwood floors, modern appliances<br/>"
        "• <b>Lifestyle:</b> Occasional shots showing families, pets welcome, community<br/>"
        "• <b>Consistency:</b> Same editing style across all properties — warm, bright, inviting<br/>"
        "• <b>Avoid:</b> Dark photos, personal items visible, cluttered rooms, distorted fish-eye<br/>"
        "• <b>Image overlays:</b> Charcoal semi-transparent (rgba(35,31,32,0.70)). Text always white or red." if en else
        "• <b>Exteriores:</b> Luz dorada (amanecer/atardecer), paisajismo limpio, ángulo ligero<br/>"
        "• <b>Interiores:</b> Gran angular, bien iluminado, staged o limpio/minimalista, todas las luces encendidas<br/>"
        "• <b>Habitaciones clave:</b> Siempre fotografiar cocina, sala, recámara principal y baños<br/>"
        "• <b>Detalles:</b> Capturar fixtures actualizados, pisos de madera, electrodomésticos modernos<br/>"
        "• <b>Lifestyle:</b> Fotos ocasionales mostrando familias, mascotas bienvenidas, comunidad<br/>"
        "• <b>Consistencia:</b> Mismo estilo de edición en todas las propiedades — cálido, brillante, acogedor<br/>"
        "• <b>Evitar:</b> Fotos oscuras, artículos personales visibles, cuartos desordenados, fish-eye distorsionado<br/>"
        "• <b>Overlays:</b> Carbón semi-transparente (rgba(35,31,32,0.70)). Texto siempre blanco o rojo.", s['body']))
    story.append(PageBreak())

    # ═══════════════════════════════════════════
    # 14. LAUNCH CHECKLIST
    # ═══════════════════════════════════════════
    story.append(Paragraph("14. Launch Checklist" if en else "14. Checklist de Lanzamiento", s['h1']))
    story.append(mk_hr(C["primary"]))

    story.append(Paragraph("Legal & Business" if en else "Legal y Negocio", s['h2']))
    for i in (["☐ LLC registered in Texas — ~$300", "☐ EIN from IRS (free)", "☐ Business bank account",
               "☐ Property management license (if required)", "☐ Landlord insurance / liability coverage",
               "☐ Lease agreement templates (lawyer-reviewed)", "☐ Security deposit escrow account",
               "☐ Lead-based paint disclosure forms (pre-1978 properties)"] if en else
              ["☐ LLC registrada en Texas — ~$300", "☐ EIN del IRS (gratis)", "☐ Cuenta bancaria comercial",
               "☐ Licencia de gestión de propiedades (si aplica)", "☐ Seguro de arrendador / cobertura de responsabilidad",
               "☐ Plantillas de contrato de arrendamiento (revisadas por abogado)", "☐ Cuenta escrow para depósitos de seguridad",
               "☐ Formularios de divulgación de pintura con plomo (propiedades pre-1978)"]):
        story.append(Paragraph(i, s['bullet']))

    story.append(Paragraph("Branding & Marketing" if en else "Branding y Marketing", s['h2']))
    for i in (["☐ Logo files: SVG, PNG (transparent), JPG, PDF", "☐ Domain: rosshouserentals.com",
               "☐ Social media accounts (@RossHouseRentals)", "☐ Business cards (500)",
               "☐ Yard signs: 'FOR RENT' (20 units)", "☐ Vehicle magnets or wraps",
               "☐ Welcome packets for new tenants", "☐ Property lockbox stickers",
               "☐ Fridge magnets with maintenance number", "☐ Email signature + template",
               "☐ Zillow/Apartments.com listing profiles"] if en else
              ["☐ Logo: SVG, PNG (transparente), JPG, PDF", "☐ Dominio: rosshouserentals.com",
               "☐ Cuentas sociales (@RossHouseRentals)", "☐ Tarjetas de presentación (500)",
               "☐ Letreros de patio: 'EN RENTA' (20 unidades)", "☐ Magnéticos o rotulación de vehículo",
               "☐ Paquetes de bienvenida para inquilinos", "☐ Stickers de lockbox",
               "☐ Imanes de refrigerador con teléfono de mantenimiento", "☐ Firma de email + plantilla",
               "☐ Perfiles en Zillow/Apartments.com"]):
        story.append(Paragraph(i, s['bullet']))

    story.append(Paragraph("Technology" if en else "Tecnología", s['h2']))
    for i in (["☐ Property management software (Buildium, Appfolio, or custom)",
               "☐ Online rent payment portal", "☐ Maintenance request system (online/app)",
               "☐ Tenant screening service (background + credit checks)",
               "☐ Professional property photography for each listing",
               "☐ Virtual tour capability (Matterport or video)"] if en else
              ["☐ Software de gestión de propiedades (Buildium, Appfolio o custom)",
               "☐ Portal de pago de renta en línea", "☐ Sistema de solicitudes de mantenimiento",
               "☐ Servicio de verificación de inquilinos (antecedentes + crédito)",
               "☐ Fotografía profesional para cada propiedad",
               "☐ Capacidad de tour virtual (Matterport o video)"]):
        story.append(Paragraph(i, s['bullet']))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2, color=HexColor(C["primary"]), spaceAfter=10))
    story.append(RLImage(LOGO_SMALL, width=60, height=60))
    story.append(Paragraph(f"Ross House Rentals LLC — Brand Identity Guide v1.0<br/>{datetime.now().strftime('%B %Y')} — {'Confidential' if en else 'Confidencial'}", s['footer']))

    doc.build(story)
    print(f"✅ PDF: {path}")


# ═══ EMAIL ═══
def send_pdfs(paths, to):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    msg = Mail(from_email=os.environ.get('SENDGRID_FROM_EMAIL'), to_emails=to,
        subject='🏠 Ross House Rentals LLC — Complete Brand Identity Guide (EN & ES)',
        html_content="""
        <div style="font-family:Arial;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#231F20,#4A4446);padding:30px;text-align:center;border-radius:10px 10px 0 0">
                <h1 style="color:#ED1B33;margin:0;font-size:22px">ROSS HOUSE RENTALS</h1>
                <p style="color:#F5A623;margin:5px 0;font-size:13px">LLC — Brand Identity Guide</p>
            </div>
            <div style="background:#fff;padding:30px;border:1px solid #e2e8f0">
                <h2 style="color:#231F20;margin-top:0">Complete Brand Guide with Logo</h2>
                <p style="color:#4a5568">Your brand guides for Ross House Rentals LLC have been created:</p>
                <div style="background:#FFF8F0;border-left:4px solid #ED1B33;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#ED1B33;margin:0;font-weight:bold">📄 Ross House Rentals — Brand Guide (English)</p>
                </div>
                <div style="background:#FFF8F0;border-left:4px solid #231F20;padding:15px;margin:10px 0;border-radius:4px">
                    <p style="color:#231F20;margin:0;font-weight:bold">📄 Ross House Rentals — Guía de Marca (Español)</p>
                </div>
                <ul style="color:#4a5568;line-height:1.8">
                    <li>Color palette with HEX, RGB, CMYK codes</li>
                    <li>Logo anatomy and usage rules</li>
                    <li>Typography (Inter + Playfair Display)</li>
                    <li>Business card designs (front & back)</li>
                    <li>Property signage & vehicle branding</li>
                    <li>Lease document styling</li>
                    <li>Social media guidelines</li>
                    <li>Photography standards</li>
                    <li>Complete launch checklist</li>
                </ul>
            </div>
            <div style="background:#231F20;padding:15px;text-align:center;border-radius:0 0 10px 10px">
                <p style="color:#9CA3AF;font-size:11px;margin:0">Ross House Rentals LLC — Brand Guide v1.0</p>
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
    p1 = "/app/memory/Ross_House_Rentals_Brand_Guide_EN.pdf"
    p2 = "/app/memory/Ross_House_Rentals_Guia_Marca_ES.pdf"

    print("=" * 60)
    print("🏠 Ross House Rentals — English")
    generate_rhr_pdf(p1, "en")

    print("=" * 60)
    print("🏠 Ross House Rentals — Español")
    generate_rhr_pdf(p2, "es")

    print("=" * 60)
    print("📧 Sending PDFs...")
    send_pdfs([p1, p2], "yoandyross@gmail.com")
    print("✅ Done!")
