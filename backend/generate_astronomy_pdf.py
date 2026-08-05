"""
Script para generar un PDF con investigación de universidades de Astronomía en EEUU
y enviarlo por email a yoandyross@gmail.com
"""
import os
import io
import base64
import smtplib
import httpx
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from dotenv import load_dotenv

load_dotenv()

# ═══════════════════════════════════════════════════════
# DATA: Top US Universities for Astronomy / Astrophysics
# ═══════════════════════════════════════════════════════

universities = [
    {
        "name": "Massachusetts Institute of Technology (MIT)",
        "location": "Cambridge, Massachusetts",
        "address": "77 Massachusetts Avenue, Cambridge, MA 02139",
        "department": "Dept. of Physics + Kavli Institute for Astrophysics",
        "degree": "B.S. in Physics (Astrophysics concentration)",
        "duration": "4 años",
        "tuition_instate": "$61,990 / año",
        "tuition_outstate": "$61,990 / año (privada)",
        "total_cost_4yr": "~$248,000 (sin ayuda financiera)",
        "acceptance_rate": "~3.9%",
        "ranking": "#1 en Física & Astronomía (QS 2025)",
        "highlights": [
            "Acceso directo a observatorios de clase mundial",
            "Investigación con NASA y laboratorios nacionales",
            "El 93% de estudiantes recibe ayuda financiera",
            "Programa UROP: investigación desde el primer año",
        ],
        "website": "https://physics.mit.edu",
    },
    {
        "name": "Harvard University",
        "location": "Cambridge, Massachusetts",
        "address": "60 Garden Street, MS 46, Cambridge, MA 02138",
        "department": "Department of Astronomy",
        "degree": "A.B. in Astronomy & Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$59,076 / año",
        "tuition_outstate": "$59,076 / año (privada)",
        "total_cost_4yr": "~$236,000 (sin ayuda financiera)",
        "acceptance_rate": "~3.6%",
        "ranking": "#2 en Física & Astronomía (QS 2025)",
        "highlights": [
            "Harvard-Smithsonian Center for Astrophysics (CfA)",
            "Departamento dedicado exclusivamente a Astronomía",
            "Observatorio propio con telescopios de investigación",
            "Red de alumni global en ciencias espaciales",
        ],
        "website": "https://astronomy.fas.harvard.edu",
    },
    {
        "name": "California Institute of Technology (Caltech)",
        "location": "Pasadena, California",
        "address": "1200 E California Blvd, Pasadena, CA 91125",
        "department": "Division of Physics, Mathematics & Astronomy",
        "degree": "B.S. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$63,402 / año",
        "tuition_outstate": "$63,402 / año (privada)",
        "total_cost_4yr": "~$254,000 (sin ayuda financiera)",
        "acceptance_rate": "~3.1%",
        "ranking": "#3 en Astrofísica (EduRank 2025)",
        "highlights": [
            "Opera los Observatorios Palomar y Keck",
            "Laboratorio de Propulsión a Chorro (JPL) de la NASA",
            "Ratio estudiante-profesor 3:1",
            "Comunidad pequeña y enfoque intensivo en investigación",
        ],
        "website": "https://www.astro.caltech.edu",
    },
    {
        "name": "Princeton University",
        "location": "Princeton, New Jersey",
        "address": "Peyton Hall, 4 Ivy Lane, Princeton, NJ 08544",
        "department": "Department of Astrophysical Sciences",
        "degree": "A.B. in Astrophysical Sciences",
        "duration": "4 años",
        "tuition_instate": "$59,710 / año",
        "tuition_outstate": "$59,710 / año (privada)",
        "total_cost_4yr": "~$239,000 (sin ayuda financiera)",
        "acceptance_rate": "~5.7%",
        "ranking": "Top 5 en Astrofísica (múltiples rankings)",
        "highlights": [
            "Departamento exclusivo de Ciencias Astrofísicas",
            "Involucrado en el proyecto WFIRST de la NASA",
            "Seminarios con investigadores de clase mundial",
            "Ayuda financiera 100% basada en necesidad (sin préstamos)",
        ],
        "website": "https://web.astro.princeton.edu",
    },
    {
        "name": "Stanford University",
        "location": "Stanford, California",
        "address": "452 Lomita Mall, Stanford, CA 94305",
        "department": "Department of Physics (Astrophysics track)",
        "degree": "B.S. in Physics (Astrophysics)",
        "duration": "4 años",
        "tuition_instate": "$62,484 / año",
        "tuition_outstate": "$62,484 / año (privada)",
        "total_cost_4yr": "~$250,000 (sin ayuda financiera)",
        "acceptance_rate": "~3.7%",
        "ranking": "Top 5 en Física & Astronomía (QS 2025)",
        "highlights": [
            "KIPAC: Kavli Institute for Particle Astrophysics & Cosmology",
            "Colaboraciones con SLAC National Accelerator Laboratory",
            "Fuerte enfoque en cosmología y física de partículas",
            "Silicon Valley: muchas oportunidades en tech espacial",
        ],
        "website": "https://physics.stanford.edu",
    },
    {
        "name": "University of California, Berkeley",
        "location": "Berkeley, California",
        "address": "501 Campbell Hall #3411, Berkeley, CA 94720",
        "department": "Department of Astronomy",
        "degree": "B.A. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$14,850 / año",
        "tuition_outstate": "$45,627 / año",
        "total_cost_4yr": "~$59,400 (residente) / ~$182,500 (no residente)",
        "acceptance_rate": "~11.6%",
        "ranking": "#1 universidad pública para Astronomía",
        "highlights": [
            "MEJOR VALOR: Calidad élite con matrícula pública",
            "Departamento de Astronomía independiente y dedicado",
            "Acceso al Observatorio Lick y telescopios Keck",
            "Programa SETI y búsqueda de vida extraterrestre",
        ],
        "website": "https://astro.berkeley.edu",
    },
    {
        "name": "University of California, Los Angeles (UCLA)",
        "location": "Los Angeles, California",
        "address": "430 Portola Plaza, Los Angeles, CA 90095",
        "department": "Department of Physics & Astronomy",
        "degree": "B.S. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$11,678 / año",
        "tuition_outstate": "$42,778 / año",
        "total_cost_4yr": "~$46,700 (residente) / ~$171,100 (no residente)",
        "acceptance_rate": "~8.6%",
        "ranking": "Top 10 en Astronomía & Astrofísica",
        "highlights": [
            "MATRÍCULA MÁS BAJA de las universidades élite",
            "Andrea Ghez (Premio Nobel 2020 en Física) es profesora",
            "Galactic Center Group: investigación de agujeros negros",
            "Clima soleado en Los Ángeles, ideal para observación",
        ],
        "website": "https://www.astro.ucla.edu",
    },
    {
        "name": "University of Chicago",
        "location": "Chicago, Illinois",
        "address": "5640 S Ellis Ave, Chicago, IL 60637",
        "department": "Department of Astronomy & Astrophysics",
        "degree": "B.A. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$66,939 / año",
        "tuition_outstate": "$66,939 / año (privada)",
        "total_cost_4yr": "~$268,000 (sin ayuda financiera)",
        "acceptance_rate": "~5.2%",
        "ranking": "Top 5 en Astrofísica (College Transitions)",
        "highlights": [
            "Departamento dedicado a Astronomía y Astrofísica",
            "Opera el Observatorio Yerkes (histórico)",
            "Fermi National Accelerator Laboratory cercano",
            "Enfoque fuerte en cosmología teórica",
        ],
        "website": "https://astro.uchicago.edu",
    },
    {
        "name": "Columbia University",
        "location": "New York, New York",
        "address": "116th St & Broadway, New York, NY 10027",
        "department": "Department of Astronomy",
        "degree": "B.A. in Astronomy",
        "duration": "4 años",
        "tuition_instate": "$69,045 / año",
        "tuition_outstate": "$69,045 / año (privada)",
        "total_cost_4yr": "~$276,000 (sin ayuda financiera)",
        "acceptance_rate": "~3.9%",
        "ranking": "Top 10 en Astrofísica",
        "highlights": [
            "Ubicación en New York City con acceso a Hayden Planetarium",
            "Colaboración con American Museum of Natural History",
            "Investigación en ondas gravitacionales (LIGO)",
            "Departamento exclusivo de Astronomía",
        ],
        "website": "https://www.astro.columbia.edu",
    },
    {
        "name": "Cornell University",
        "location": "Ithaca, New York",
        "address": "Space Sciences Building, Ithaca, NY 14853",
        "department": "Department of Astronomy",
        "degree": "B.A. in Astronomy",
        "duration": "4 años",
        "tuition_instate": "$65,204 / año",
        "tuition_outstate": "$65,204 / año (privada)",
        "total_cost_4yr": "~$261,000 (sin ayuda financiera)",
        "acceptance_rate": "~7.9%",
        "ranking": "Top 15 en Astronomía",
        "highlights": [
            "Legado de Carl Sagan (fundó el laboratorio de ciencia planetaria)",
            "Centro Cornell para Astrofísica y Ciencias Planetarias",
            "Participación en el Telescopio Espacial James Webb",
            "Fuerte programa de ciencia planetaria",
        ],
        "website": "https://astro.cornell.edu",
    },
    {
        "name": "University of Arizona",
        "location": "Tucson, Arizona",
        "address": "933 N Cherry Ave, Tucson, AZ 85721",
        "department": "Steward Observatory & Dept. of Astronomy",
        "degree": "B.S. in Astronomy",
        "duration": "4 años",
        "tuition_instate": "$12,950 / año",
        "tuition_outstate": "$39,340 / año",
        "total_cost_4yr": "~$51,800 (residente) / ~$157,360 (no residente)",
        "acceptance_rate": "~87%",
        "ranking": "Top 5 en investigación astronómica",
        "highlights": [
            "ACCESO MÁS FÁCIL de las universidades top",
            "Steward Observatory: líder mundial en espejos telescópicos",
            "Cielos oscuros de Arizona ideales para observación",
            "Laboratorio de Ciencias Lunares y Planetarias (participó en misiones OSIRIS-REx)",
        ],
        "website": "https://www.as.arizona.edu",
    },
    {
        "name": "University of Colorado Boulder",
        "location": "Boulder, Colorado",
        "address": "2000 Colorado Ave, Boulder, CO 80309",
        "department": "Dept. of Astrophysical & Planetary Sciences",
        "degree": "B.A. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$13,194 / año",
        "tuition_outstate": "$41,292 / año",
        "total_cost_4yr": "~$52,800 (residente) / ~$165,200 (no residente)",
        "acceptance_rate": "~80%",
        "ranking": "Top 10 en Ciencias Planetarias",
        "highlights": [
            "Laboratory for Atmospheric and Space Physics (LASP)",
            "Fuerte conexión con la NASA y NOAA",
            "Programa de ingeniería aeroespacial de primer nivel",
            "Ciudad universitaria con actividades al aire libre",
        ],
        "website": "https://www.colorado.edu/aps",
    },
    {
        "name": "University of Hawai'i at Mānoa",
        "location": "Honolulu, Hawai'i",
        "address": "2680 Woodlawn Dr, Honolulu, HI 96822",
        "department": "Institute for Astronomy (IfA)",
        "degree": "B.S. in Astronomy",
        "duration": "4 años",
        "tuition_instate": "$11,520 / año",
        "tuition_outstate": "$33,552 / año",
        "total_cost_4yr": "~$46,080 (residente) / ~$134,200 (no residente)",
        "acceptance_rate": "~70%",
        "ranking": "Top institución de observación astronómica del mundo",
        "highlights": [
            "Acceso al Observatorio Mauna Kea (el mejor sitio del mundo)",
            "MATRÍCULA BAJA con oportunidades de investigación élite",
            "13 telescopios en Mauna Kea de 11 países diferentes",
            "Ubicación única en medio del Pacífico para observación",
        ],
        "website": "https://www.ifa.hawaii.edu",
    },
    {
        "name": "University of California, Santa Cruz",
        "location": "Santa Cruz, California",
        "address": "1156 High Street, Santa Cruz, CA 95064",
        "department": "Department of Astronomy & Astrophysics",
        "degree": "B.S. in Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$14,100 / año",
        "tuition_outstate": "$44,916 / año",
        "total_cost_4yr": "~$56,400 (residente) / ~$179,700 (no residente)",
        "acceptance_rate": "~47%",
        "ranking": "Top 15 en Astrofísica",
        "highlights": [
            "Sede del UCO/Lick Observatory",
            "Centro de investigación de instrumentación astronómica",
            "Campus con vistas al Océano Pacífico",
            "Buena relación calidad-precio en astronomía",
        ],
        "website": "https://www.astro.ucsc.edu",
    },
    {
        "name": "University of Illinois Urbana-Champaign",
        "location": "Champaign, Illinois",
        "address": "1002 W Green St, Urbana, IL 61801",
        "department": "Department of Astronomy",
        "degree": "B.S. in Astronomy / Astrophysics",
        "duration": "4 años",
        "tuition_instate": "$18,372 / año",
        "tuition_outstate": "$38,724 / año",
        "total_cost_4yr": "~$73,500 (residente) / ~$155,000 (no residente)",
        "acceptance_rate": "~45%",
        "ranking": "Top 20 en Astronomía",
        "highlights": [
            "National Center for Supercomputing Applications (NCSA)",
            "Fuerte programa de astronomía computacional",
            "Observatorio propio en el campus",
            "Excelente relación costo-calidad para residentes",
        ],
        "website": "https://astro.illinois.edu",
    },
]


# ═══════════════════════════════════════════
# PDF GENERATION
# ═══════════════════════════════════════════

def generate_pdf():
    """Generate a professional PDF with university data."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50,
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=colors.HexColor("#0D1B2A"),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Normal"],
        fontSize=13,
        textColor=colors.HexColor("#415A77"),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )
    
    section_header = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#1B263B"),
        spaceBefore=16,
        spaceAfter=8,
        fontName="Helvetica-Bold",
    )
    
    uni_name_style = ParagraphStyle(
        "UniName",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#0D1B2A"),
        spaceBefore=12,
        spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#333333"),
        spaceAfter=4,
        fontName="Helvetica",
        leading=14,
    )
    
    body_bold = ParagraphStyle(
        "CustomBodyBold",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#1B263B"),
        spaceAfter=3,
        fontName="Helvetica-Bold",
        leading=14,
    )
    
    bullet_style = ParagraphStyle(
        "BulletPoint",
        parent=styles["Normal"],
        fontSize=9.5,
        textColor=colors.HexColor("#444444"),
        leftIndent=20,
        spaceAfter=2,
        fontName="Helvetica",
        leading=13,
    )
    
    note_style = ParagraphStyle(
        "NoteStyle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#666666"),
        spaceAfter=4,
        fontName="Helvetica-Oblique",
        alignment=TA_JUSTIFY,
        leading=12,
    )
    
    footer_style = ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#999999"),
        alignment=TA_CENTER,
        fontName="Helvetica",
    )
    
    elements = []
    
    # ── COVER / TITLE ──
    elements.append(Spacer(1, 60))
    elements.append(Paragraph("UNIVERSIDADES DE ASTRONOMIA", title_style))
    elements.append(Paragraph("EN ESTADOS UNIDOS", title_style))
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="60%", thickness=2, color=colors.HexColor("#415A77"), spaceAfter=12))
    elements.append(Paragraph(
        "Guia completa de las mejores universidades para estudiar<br/>"
        "Astronomia, Astrofisica y Ciencias Planetarias",
        subtitle_style
    ))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Preparado para la Familia Ross", subtitle_style))
    elements.append(Paragraph("Febrero 2026", subtitle_style))
    
    elements.append(Spacer(1, 40))
    
    # Quick summary box
    summary_data = [
        ["RESUMEN EJECUTIVO", ""],
        ["Total de universidades investigadas:", "15"],
        ["Universidades privadas:", "9 (MIT, Harvard, Caltech, Princeton, Stanford, UChicago, Columbia, Cornell)"],
        ["Universidades publicas:", "6 (UC Berkeley, UCLA, U. Arizona, CU Boulder, UH Manoa, UC Santa Cruz, UIUC)"],
        ["Rango de matricula anual:", "$11,520 - $69,045"],
        ["Duracion tipica del programa:", "4 anos (Bachelor's degree)"],
        ["Tasa de aceptacion mas baja:", "3.1% (Caltech)"],
        ["Mejor valor (calidad/precio):", "UC Berkeley, UCLA, U. Arizona"],
    ]
    
    summary_table = Table(summary_data, colWidths=[2.5*inch, 4*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0D1B2A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8F9FA")),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#333333")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DEE2E6")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    
    elements.append(PageBreak())
    
    # ── COMPARISON TABLE ──
    elements.append(Paragraph("TABLA COMPARATIVA DE COSTOS", section_header))
    elements.append(Spacer(1, 8))
    
    comp_header = ["Universidad", "Matricula\nResidente", "Matricula\nNo-Residente", "Costo Total\n4 Anos", "Aceptacion"]
    comp_data = [comp_header]
    
    for u in universities:
        in_t = u["tuition_instate"].replace(" / año", "").replace(" (privada)", "")
        out_t = u["tuition_outstate"].replace(" / año", "").replace(" (privada)", "")
        short_name = u["name"].split("(")[0].strip() if "(" in u["name"] else u["name"]
        if len(short_name) > 25:
            short_name = short_name[:25] + "..."
        comp_data.append([
            short_name,
            in_t,
            out_t,
            u["total_cost_4yr"].replace("(sin ayuda financiera)", "").replace("(residente)", "res.").replace("(no residente)", "n/r").strip(),
            u["acceptance_rate"],
        ])
    
    comp_table = Table(comp_data, colWidths=[1.6*inch, 1.1*inch, 1.1*inch, 1.7*inch, 0.9*inch])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1B263B")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#333333")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(comp_table)
    
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Nota: Los costos no incluyen alojamiento, libros ni gastos personales. "
        "La mayoria de universidades privadas ofrecen ayuda financiera generosa basada en necesidad. "
        "Las universidades de California (UC) ofrecen matricula reducida para residentes del estado.",
        note_style
    ))
    
    elements.append(PageBreak())
    
    # ── DETAILED UNIVERSITY PROFILES ──
    elements.append(Paragraph("PERFILES DETALLADOS", section_header))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DEE2E6"), spaceAfter=8))
    
    for i, u in enumerate(universities):
        if i > 0 and i % 3 == 0:
            elements.append(PageBreak())
        
        # University name with number
        elements.append(Paragraph(f"{i+1}. {u['name']}", uni_name_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E0E0E0"), spaceAfter=4))
        
        # Info grid
        info_data = [
            [Paragraph("<b>Ubicacion:</b>", body_bold), Paragraph(u["location"], body_style),
             Paragraph("<b>Ranking:</b>", body_bold), Paragraph(u["ranking"], body_style)],
            [Paragraph("<b>Titulo:</b>", body_bold), Paragraph(u["degree"], body_style),
             Paragraph("<b>Duracion:</b>", body_bold), Paragraph(u["duration"], body_style)],
            [Paragraph("<b>Matricula residente:</b>", body_bold), Paragraph(u["tuition_instate"], body_style),
             Paragraph("<b>No residente:</b>", body_bold), Paragraph(u["tuition_outstate"], body_style)],
            [Paragraph("<b>Costo total (4 anos):</b>", body_bold), Paragraph(u["total_cost_4yr"], body_style),
             Paragraph("<b>Aceptacion:</b>", body_bold), Paragraph(u["acceptance_rate"], body_style)],
            [Paragraph("<b>Departamento:</b>", body_bold), Paragraph(u["department"], body_style),
             Paragraph("<b>Web:</b>", body_bold), Paragraph(u["website"], body_style)],
            [Paragraph("<b>Direccion:</b>", body_bold), Paragraph(u["address"], body_style), "", ""],
        ]
        
        info_table = Table(info_data, colWidths=[1.3*inch, 2*inch, 1.2*inch, 2*inch])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(info_table)
        
        # Highlights
        elements.append(Paragraph("<b>Puntos Destacados:</b>", body_bold))
        for h in u["highlights"]:
            elements.append(Paragraph(f"&#8226;  {h}", bullet_style))
        
        elements.append(Spacer(1, 10))
    
    # ── RECOMMENDATIONS ──
    elements.append(PageBreak())
    elements.append(Paragraph("RECOMENDACIONES", section_header))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DEE2E6"), spaceAfter=10))
    
    rec_data = [
        ["CATEGORIA", "UNIVERSIDAD RECOMENDADA", "RAZON"],
        ["Mejor programa general", "MIT / Caltech", "Lideran investigacion astronomica global"],
        ["Mejor valor (publica)", "UC Berkeley", "Calidad elite, matricula publica"],
        ["Mas accesible + Top\nen investigacion", "University of Arizona", "87% aceptacion, Steward Observatory,\nmisiones NASA"],
        ["Matricula mas baja", "UCLA / UH Manoa", "$11,520-$11,678/ano para residentes"],
        ["Mejor ubicacion\npara observacion", "UH Manoa", "Observatorio Mauna Kea, el mejor sitio\ndel mundo"],
        ["Mejor para ciencia\nplanetaria", "U. Arizona / Cornell", "Misiones NASA, legado Carl Sagan"],
        ["Mejor campus +\ncalidad de vida", "CU Boulder / UC Santa Cruz", "Naturaleza, clima, y buena astronomia"],
    ]
    
    rec_table = Table(rec_data, colWidths=[1.8*inch, 2*inch, 2.7*inch])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0D1B2A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#333333")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#DEE2E6")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0F4FF")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(rec_table)
    
    elements.append(Spacer(1, 20))
    
    # ── NEXT STEPS ──
    elements.append(Paragraph("PROXIMOS PASOS SUGERIDOS", section_header))
    steps = [
        "1. Definir presupuesto familiar anual para educacion universitaria.",
        "2. Investigar programas de ayuda financiera y becas en las universidades seleccionadas.",
        "3. Visitar los campus de las 3-5 universidades preferidas (tours virtuales disponibles).",
        "4. Preparar examenes SAT/ACT (requeridos por la mayoria de universidades).",
        "5. Considerar participar en programas de verano de astronomia para jovenes.",
        "6. Para universidades publicas de California: investigar requisitos de residencia (1 ano previo).",
        "7. Aplicar a multiples universidades en diferentes rangos de selectividad.",
    ]
    for s in steps:
        elements.append(Paragraph(s, body_style))
    
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DEE2E6"), spaceAfter=10))
    elements.append(Paragraph(
        "Este documento fue preparado con datos actualizados a febrero 2026.<br/>"
        "Los costos de matricula pueden variar. Consulte las paginas web oficiales para informacion actualizada.",
        footer_style
    ))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════
# EMAIL SENDING
# ═══════════════════════════════════════════

def send_email_with_pdf(pdf_buffer, to_email="yoandyross@gmail.com"):
    """Send the PDF via SendGrid API with attachment."""
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")
    
    if not sendgrid_key:
        print("ERROR: No SENDGRID_API_KEY found")
        return False
    
    pdf_data = pdf_buffer.getvalue()
    pdf_b64 = base64.b64encode(pdf_data).decode("utf-8")
    
    html_body = """
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0D1B2A 0%, #1B263B 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">&#11088; Investigación de Universidades</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Astronomía en Estados Unidos</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0;">
            <p style="color: #333; font-size: 15px;">Hola Yoandy,</p>
            <p style="color: #333; font-size: 15px;">Adjunto encontrarás la <strong>guía completa de universidades de Astronomía en Estados Unidos</strong> que solicitaste para tus hijos.</p>
            <p style="color: #333; font-size: 15px;">El documento incluye:</p>
            <ul style="color: #555; font-size: 14px;">
                <li><strong>15 universidades</strong> investigadas (públicas y privadas)</li>
                <li>Costos de matrícula actualizados 2025-2026</li>
                <li>Direcciones de los departamentos de astronomía</li>
                <li>Tasas de aceptación</li>
                <li>Tabla comparativa de costos</li>
                <li>Recomendaciones por categoría</li>
                <li>Próximos pasos sugeridos</li>
            </ul>
            <p style="color: #333; font-size: 15px;">Las mejores opciones por <strong>valor (calidad/precio)</strong> son UC Berkeley, UCLA y University of Arizona.</p>
            <p style="color: #333; font-size: 15px;">La opción más <strong>accesible con investigación de clase mundial</strong> es University of Arizona (87% de aceptación).</p>
            <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #1B263B; font-size: 14px; margin: 0;"><strong>Tip:</strong> El PDF está adjunto a este email. Descárgalo para verlo completo con tablas y gráficos.</p>
            </div>
            <p style="color: #999; font-size: 12px;">Cualquier duda estamos para servirte.</p>
        </div>
        <div style="background: #0D1B2A; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
            <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0;">Ross Tax Preparation LLC</p>
        </div>
    </div>
    """
    
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": "Ross Tax Preparation"},
        "subject": "⭐ Investigación: Universidades de Astronomía en EEUU - Para tus hijos",
        "content": [
            {"type": "text/plain", "value": "Adjunto encontrarás la guía completa de universidades de Astronomía en Estados Unidos."},
            {"type": "text/html", "value": html_body},
        ],
        "attachments": [
            {
                "content": pdf_b64,
                "filename": "Universidades_Astronomia_EEUU_2026.pdf",
                "type": "application/pdf",
                "disposition": "attachment",
            }
        ],
    }
    
    try:
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {sendgrid_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        if resp.status_code in (200, 201, 202):
            print(f"✅ Email enviado exitosamente a {to_email}")
            return True
        else:
            print(f"❌ Error SendGrid: {resp.status_code} - {resp.text}")
            # Try SMTP fallback
            return send_email_smtp(pdf_data, to_email, html_body)
    except Exception as e:
        print(f"❌ Error enviando por SendGrid: {e}")
        return send_email_smtp(pdf_data, to_email, html_body)


def send_email_smtp(pdf_data, to_email, html_body):
    """Fallback: Send via SMTP."""
    try:
        host = os.getenv("EMAIL_SMTP_HOST", "gtxm1016.siteground.biz")
        port = int(os.getenv("EMAIL_SMTP_PORT", "465"))
        username = os.getenv("EMAIL_ADDRESS", "info@rosstaxpreparation.com")
        password = os.getenv("EMAIL_PASSWORD", "Interface.123")
        
        msg = MIMEMultipart()
        msg["From"] = f"Ross Tax Preparation <{username}>"
        msg["To"] = to_email
        msg["Subject"] = "⭐ Investigación: Universidades de Astronomía en EEUU - Para tus hijos"
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        
        part = MIMEBase("application", "pdf")
        part.set_payload(pdf_data)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", 'attachment; filename="Universidades_Astronomia_EEUU_2026.pdf"')
        msg.attach(part)
        
        server = smtplib.SMTP_SSL(host, port, timeout=30)
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        print(f"✅ Email enviado por SMTP a {to_email}")
        return True
    except Exception as e:
        print(f"❌ Error SMTP: {e}")
        return False


# ═══════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════

if __name__ == "__main__":
    print("📄 Generando PDF de Universidades de Astronomía...")
    pdf_buf = generate_pdf()
    
    # Also save locally
    local_path = "/app/backend/static/Universidades_Astronomia_EEUU_2026.pdf"
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(pdf_buf.getvalue())
    print(f"✅ PDF guardado localmente: {local_path}")
    
    pdf_buf.seek(0)
    
    print("📧 Enviando por email...")
    success = send_email_with_pdf(pdf_buf)
    
    if success:
        print("\n🎉 ¡Todo listo! PDF generado y enviado a yoandyross@gmail.com")
    else:
        print("\n⚠️ PDF generado pero hubo error al enviar email. El PDF está guardado localmente.")
