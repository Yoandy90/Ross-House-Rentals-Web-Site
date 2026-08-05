"""
Inspection PDF Generator — Ross House Rentals LLC
==================================================
Generates professional Move-In/Move-Out inspection reports
with photos, condition ratings, and digital signatures.
"""
import io
import os
import base64
import logging
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Image as RLImage
)

logger = logging.getLogger(__name__)

# ─── Color Palette ────────────────────────────────────────────────
BRAND_RED = colors.HexColor('#C8102E')
BRAND_CHARCOAL = colors.HexColor('#231F20')
GRAY = colors.HexColor('#4a5568')
LIGHT_GRAY = colors.HexColor('#f7fafc')
GREEN = colors.HexColor('#10b981')
YELLOW = colors.HexColor('#f59e0b')
BLUE = colors.HexColor('#3b82f6')
RED = colors.HexColor('#ef4444')

# Condition colors
CONDITION_COLORS = {
    'excellent': GREEN,
    'good': BLUE,
    'fair': YELLOW,
    'poor': RED,
    'na': GRAY,
}

CONDITION_LABELS = {
    'excellent': 'Excelente',
    'good': 'Bueno',
    'fair': 'Regular',
    'poor': 'Malo',
    'na': 'N/A',
}

TYPE_LABELS = {
    'move_in': 'INSPECCIÓN MOVE-IN',
    'move_out': 'INSPECCIÓN MOVE-OUT',
    'routine': 'INSPECCIÓN RUTINARIA',
}


def _get_logo_path():
    """Find Ross House Rentals logo"""
    base = os.path.dirname(os.path.abspath(__file__))
    for name in ['ross_house_logo.png', 'company_logo.png', 'ross_logo.png']:
        path = os.path.join(base, 'assets', name)
        if os.path.exists(path):
            return path
    return None


def _build_styles():
    """Build PDF styles"""
    styles = getSampleStyleSheet()
    
    # Use unique names to avoid conflicts with default styles
    styles.add(ParagraphStyle(
        name='InspDocTitle', fontName='Helvetica-Bold', fontSize=16,
        textColor=BRAND_CHARCOAL, spaceAfter=4, alignment=TA_CENTER, leading=20
    ))
    styles.add(ParagraphStyle(
        name='InspDocSubtitle', fontName='Helvetica', fontSize=10,
        textColor=GRAY, spaceAfter=4, alignment=TA_CENTER, leading=14
    ))
    styles.add(ParagraphStyle(
        name='InspSectionTitle', fontName='Helvetica-Bold', fontSize=12,
        textColor=BRAND_RED, spaceBefore=12, spaceAfter=6, leading=16
    ))
    styles.add(ParagraphStyle(
        name='InspRoomTitle', fontName='Helvetica-Bold', fontSize=11,
        textColor=BRAND_CHARCOAL, spaceBefore=8, spaceAfter=4, leading=14
    ))
    styles.add(ParagraphStyle(
        name='InspBodyText', fontName='Helvetica', fontSize=9,
        textColor=BRAND_CHARCOAL, spaceAfter=4, leading=12
    ))
    styles.add(ParagraphStyle(
        name='InspSmallText', fontName='Helvetica', fontSize=8,
        textColor=GRAY, spaceAfter=2, leading=10
    ))
    styles.add(ParagraphStyle(
        name='InspLegalText', fontName='Helvetica', fontSize=7,
        textColor=GRAY, spaceBefore=8, spaceAfter=4, leading=10, alignment=TA_JUSTIFY
    ))
    
    return styles


def _header_footer(canvas, doc, inspection_data):
    """Add header and footer to each page"""
    canvas.saveState()
    width, height = letter
    
    # Header line
    canvas.setStrokeColor(BRAND_RED)
    canvas.setLineWidth(2)
    canvas.line(0.5*inch, height - 0.5*inch, width - 0.5*inch, height - 0.5*inch)
    
    # Footer
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GRAY)
    footer_text = "Ross House Rentals LLC | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018"
    canvas.drawCentredString(width/2, 0.4*inch, footer_text)
    
    page_num = f"Página {doc.page}"
    canvas.drawRightString(width - 0.5*inch, 0.4*inch, page_num)
    
    canvas.restoreState()


def _decode_base64_image(base64_str: str) -> io.BytesIO | None:
    """Decode base64 image string to BytesIO"""
    try:
        if not base64_str:
            return None
        # Remove data URL prefix if present
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        image_data = base64.b64decode(base64_str)
        return io.BytesIO(image_data)
    except Exception as e:
        logger.warning(f"Failed to decode base64 image: {e}")
        return None


def generate_inspection_pdf(inspection: dict) -> bytes:
    """
    Generate a professional PDF report for a property inspection.
    
    Args:
        inspection: Dictionary containing inspection data with:
            - property_name, property_address
            - tenant_name, tenant_email
            - inspection_type: move_in | move_out | routine
            - scheduled_date
            - inspector_name
            - rooms: list of {room_name, items: [{name, condition, notes, photos}]}
            - admin_signature, admin_signature_date
            - tenant_signature, tenant_signature_date
            - notes
    
    Returns:
        PDF bytes
    """
    buffer = io.BytesIO()
    styles = _build_styles()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
    )
    
    story = []
    
    # ─── Header Section ─────────────────────────────────────────────
    # Logo
    logo_path = _get_logo_path()
    if logo_path and os.path.exists(logo_path):
        try:
            logo = RLImage(logo_path, width=1.5*inch, height=0.6*inch)
            logo.hAlign = 'CENTER'
            story.append(logo)
            story.append(Spacer(1, 8))
        except Exception:
            pass
    
    # Title
    inspection_type = inspection.get('inspection_type', 'move_in')
    title = TYPE_LABELS.get(inspection_type, 'INSPECCIÓN DE PROPIEDAD')
    story.append(Paragraph(title, styles['InspDocTitle']))
    story.append(Paragraph("Property Condition Report / Reporte de Condición de Propiedad", styles['InspDocSubtitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED, spaceBefore=4, spaceAfter=12))
    
    # ─── Property & Tenant Info ─────────────────────────────────────
    property_name = inspection.get('property_name', 'N/A')
    property_address = inspection.get('property_address', 'N/A')
    tenant_name = inspection.get('tenant_name', 'N/A')
    inspector_name = inspection.get('inspector_name', 'Admin')
    scheduled_date = inspection.get('scheduled_date', '')
    
    if scheduled_date:
        try:
            dt = datetime.fromisoformat(scheduled_date.replace('Z', '+00:00'))
            formatted_date = dt.strftime('%d/%m/%Y %H:%M')
        except Exception:
            formatted_date = scheduled_date
    else:
        formatted_date = datetime.now().strftime('%d/%m/%Y')
    
    info_data = [
        ['Propiedad / Property:', property_name],
        ['Dirección / Address:', property_address],
        ['Inquilino / Tenant:', tenant_name],
        ['Inspector:', inspector_name],
        ['Fecha / Date:', formatted_date],
    ]
    
    info_table = Table(info_data, colWidths=[1.8*inch, 5.2*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY),
        ('TEXTCOLOR', (1, 0), (1, -1), BRAND_CHARCOAL),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))
    
    # ─── Condition Legend ───────────────────────────────────────────
    story.append(Paragraph("Leyenda de Condiciones / Condition Legend:", styles['InspSectionTitle']))
    
    legend_data = [
        ['Excelente/Excellent', 'Bueno/Good', 'Regular/Fair', 'Malo/Poor', 'N/A'],
    ]
    legend_table = Table(legend_data, colWidths=[1.4*inch]*5)
    legend_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#d1fae5')),  # Green light
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#dbeafe')),  # Blue light
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#fef3c7')),  # Yellow light
        ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#fee2e2')),  # Red light
        ('BACKGROUND', (4, 0), (4, 0), colors.HexColor('#f3f4f6')),  # Gray light
        ('BOX', (0, 0), (-1, -1), 0.5, GRAY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(legend_table)
    story.append(Spacer(1, 16))
    
    # ─── Room Checklists ────────────────────────────────────────────
    rooms = inspection.get('rooms', [])
    
    for room in rooms:
        room_name = room.get('room_name', 'Habitación')
        items = room.get('items', [])
        
        # Room title
        story.append(Paragraph(f"🏠 {room_name}", styles['InspRoomTitle']))
        
        # Build items table
        table_data = [['Elemento / Item', 'Condición', 'Notas / Notes']]
        
        for item in items:
            item_name = item.get('name', '')
            condition = item.get('condition', 'na')
            notes = item.get('notes', '')
            
            condition_label = CONDITION_LABELS.get(condition, 'N/A')
            
            table_data.append([item_name, condition_label, notes or '-'])
        
        if len(table_data) > 1:
            item_table = Table(table_data, colWidths=[2*inch, 1.2*inch, 3.8*inch])
            item_table.setStyle(TableStyle([
                # Header row
                ('BACKGROUND', (0, 0), (-1, 0), BRAND_RED),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                # Data rows
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ALIGN', (1, 1), (1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
                # Borders
                ('BOX', (0, 0), (-1, -1), 0.5, GRAY),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(item_table)
        
        # Photos for this room (if any)
        all_photos = []
        for item in items:
            photos = item.get('photos', [])
            for photo in photos:
                all_photos.append((item.get('name', ''), photo))
        
        if all_photos:
            story.append(Spacer(1, 8))
            story.append(Paragraph(f"Fotos - {room_name}:", styles['InspSmallText']))
            
            # Create photo grid (2 per row)
            photo_rows = []
            for i in range(0, len(all_photos), 2):
                row = []
                for j in range(2):
                    if i + j < len(all_photos):
                        item_name, photo_data = all_photos[i + j]
                        img_buffer = _decode_base64_image(photo_data)
                        if img_buffer:
                            try:
                                img = RLImage(img_buffer, width=2.5*inch, height=2*inch)
                                row.append([img, Paragraph(f"<font size='7'>{item_name}</font>", styles['InspSmallText'])])
                            except Exception:
                                row.append(['[Foto no disponible]', item_name])
                        else:
                            row.append(['', ''])
                    else:
                        row.append(['', ''])
                photo_rows.append([row[0], row[1]])
            
            if photo_rows:
                # Flatten for table
                flat_rows = []
                for row in photo_rows:
                    flat_rows.append([row[0][0] if row[0] else '', row[1][0] if row[1] else ''])
                    flat_rows.append([row[0][1] if row[0] and len(row[0]) > 1 else '', row[1][1] if row[1] and len(row[1]) > 1 else ''])
                
                photo_table = Table(flat_rows, colWidths=[3.5*inch, 3.5*inch])
                photo_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(photo_table)
        
        story.append(Spacer(1, 12))
    
    # ─── General Notes ──────────────────────────────────────────────
    notes = inspection.get('notes', '') or inspection.get('general_notes', '')
    if notes:
        story.append(Paragraph("Notas Generales / General Notes:", styles['InspSectionTitle']))
        story.append(Paragraph(notes, styles['InspBodyText']))
        story.append(Spacer(1, 12))
    
    # ─── Digital Signatures ─────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Firmas Digitales / Digital Signatures", styles['InspSectionTitle']))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED, spaceBefore=4, spaceAfter=12))
    
    # Legal text
    legal_text = """
    Al firmar este documento, las partes confirman que han revisado juntas la propiedad 
    y están de acuerdo con las condiciones documentadas en este reporte de inspección.
    <br/><br/>
    By signing this document, the parties confirm that they have reviewed the property together 
    and agree with the conditions documented in this inspection report.
    """
    story.append(Paragraph(legal_text, styles['InspLegalText']))
    story.append(Spacer(1, 16))
    
    # Signature boxes
    admin_sig = inspection.get('admin_signature', '')
    admin_date = inspection.get('admin_signature_date', '')
    tenant_sig = inspection.get('tenant_signature', '')
    tenant_date = inspection.get('tenant_signature_date', '')
    
    # Inspector signature
    story.append(Paragraph("<b>Inspector / Landlord Representative:</b>", styles['InspBodyText']))
    if admin_sig:
        img_buffer = _decode_base64_image(admin_sig)
        if img_buffer:
            try:
                sig_img = RLImage(img_buffer, width=3*inch, height=1*inch)
                sig_img.hAlign = 'LEFT'
                story.append(sig_img)
            except Exception:
                story.append(Paragraph("[Firma digital adjunta]", styles['InspSmallText']))
        
        if admin_date:
            try:
                dt = datetime.fromisoformat(admin_date.replace('Z', '+00:00'))
                formatted_admin_date = dt.strftime('%d/%m/%Y %H:%M')
            except Exception:
                formatted_admin_date = admin_date
            story.append(Paragraph(f"Fecha: {formatted_admin_date}", styles['InspSmallText']))
    else:
        story.append(Paragraph("_" * 50, styles['InspBodyText']))
        story.append(Paragraph("Firma / Signature", styles['InspSmallText']))
    
    story.append(Paragraph(f"Nombre / Name: {inspector_name}", styles['InspSmallText']))
    story.append(Spacer(1, 20))
    
    # Tenant signature
    story.append(Paragraph("<b>Inquilino / Tenant:</b>", styles['InspBodyText']))
    if tenant_sig:
        img_buffer = _decode_base64_image(tenant_sig)
        if img_buffer:
            try:
                sig_img = RLImage(img_buffer, width=3*inch, height=1*inch)
                sig_img.hAlign = 'LEFT'
                story.append(sig_img)
            except Exception:
                story.append(Paragraph("[Firma digital adjunta]", styles['InspSmallText']))
        
        if tenant_date:
            try:
                dt = datetime.fromisoformat(tenant_date.replace('Z', '+00:00'))
                formatted_tenant_date = dt.strftime('%d/%m/%Y %H:%M')
            except Exception:
                formatted_tenant_date = tenant_date
            story.append(Paragraph(f"Fecha: {formatted_tenant_date}", styles['InspSmallText']))
    else:
        story.append(Paragraph("_" * 50, styles['InspBodyText']))
        story.append(Paragraph("Firma / Signature", styles['InspSmallText']))
    
    story.append(Paragraph(f"Nombre / Name: {tenant_name}", styles['InspSmallText']))
    story.append(Spacer(1, 24))
    
    # ─── Footer Disclaimer ──────────────────────────────────────────
    disclaimer = """
    <b>AVISO IMPORTANTE / IMPORTANT NOTICE:</b><br/>
    Este documento es un registro oficial de las condiciones de la propiedad en la fecha indicada. 
    Ambas partes deben conservar una copia para sus registros. Cualquier discrepancia debe ser 
    reportada dentro de 48 horas de la inspección.<br/><br/>
    This document is an official record of the property conditions on the date indicated. 
    Both parties should keep a copy for their records. Any discrepancies must be reported 
    within 48 hours of the inspection.
    """
    story.append(Paragraph(disclaimer, styles['InspLegalText']))
    
    # Build PDF
    def make_header_footer(canvas, doc):
        _header_footer(canvas, doc, inspection)
    
    doc.build(story, onFirstPage=make_header_footer, onLaterPages=make_header_footer)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


def generate_inspection_pdf_base64(inspection: dict) -> str:
    """Generate inspection PDF and return as base64 string"""
    pdf_bytes = generate_inspection_pdf(inspection)
    return base64.b64encode(pdf_bytes).decode('utf-8')
