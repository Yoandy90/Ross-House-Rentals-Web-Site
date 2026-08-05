"""
Generate a professional PDF guide for opening a business bank account
at Happy State Bank for Ross Lending Solutions LLC.
"""
import io
import base64
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, ListFlowable, ListItem
)


def generate_bank_guide_pdf():
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=55, leftMargin=55,
        topMargin=45, bottomMargin=45,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        'CompanyHeader', parent=styles['Normal'],
        fontSize=20, fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0D4F3C'),
        alignment=TA_CENTER, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'SubHeader', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER, spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontSize=16, fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1a1a1a'),
        alignment=TA_CENTER, spaceAfter=6, spaceBefore=12,
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Normal'],
        fontSize=13, fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0D4F3C'),
        spaceBefore=18, spaceAfter=8,
        borderWidth=0, borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        'BodyText2', parent=styles['Normal'],
        fontSize=10, leading=15,
        textColor=colors.HexColor('#333333'),
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'Quote', parent=styles['Normal'],
        fontSize=10.5, leading=15,
        fontName='Helvetica-Oblique',
        textColor=colors.HexColor('#0D4F3C'),
        leftIndent=20, rightIndent=20,
        spaceBefore=6, spaceAfter=6,
        borderWidth=1, borderColor=colors.HexColor('#0D4F3C'),
        borderPadding=10, borderRadius=4,
        backColor=colors.HexColor('#f0f7f4'),
    ))
    styles.add(ParagraphStyle(
        'Warning', parent=styles['Normal'],
        fontSize=10, leading=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#cc0000'),
        leftIndent=20, rightIndent=20,
        spaceBefore=6, spaceAfter=6,
        borderWidth=1, borderColor=colors.HexColor('#cc0000'),
        borderPadding=10,
        backColor=colors.HexColor('#fff5f5'),
    ))
    styles.add(ParagraphStyle(
        'BulletText', parent=styles['Normal'],
        fontSize=10, leading=14,
        textColor=colors.HexColor('#333333'),
        leftIndent=15,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        'Footer', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#999999'),
        alignment=TA_CENTER,
    ))

    elements = []

    # ─── HEADER ───
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", styles['CompanyHeader']))
    elements.append(Paragraph("305 Bruce Ave, Dumas TX 79029 · (806) 930-7456", styles['SubHeader']))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0D4F3C')))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("GUÍA CONFIDENCIAL", styles['DocTitle']))
    elements.append(Paragraph("Apertura de Cuenta Comercial — Happy State Bank, Dumas TX", styles['SubHeader']))
    elements.append(Spacer(1, 8))

    # ─── SECTION 1: Documents ───
    elements.append(Paragraph("1. DOCUMENTOS QUE DEBES LLEVAR", styles['SectionTitle']))
    docs_data = [
        ["✅", "Carta CP575G del IRS", "Confirmación del EIN 42-2405079"],
        ["✅", "Articles of Organization", "Registro de la LLC en Texas"],
        ["✅", "Identificación con foto", "Licencia de conducir de Texas"],
        ["✅", "Cheque o transferencia", "Depósito inicial de $25,000+"],
        ["✅", "Comprobante de domicilio", "Factura de utility a tu nombre"],
    ]
    t = Table(docs_data, colWidths=[25, 170, 270])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#666666')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
    ]))
    elements.append(t)

    # ─── SECTION 2: What to say ───
    elements.append(Paragraph("2. QUÉ DECIR AL LLEGAR", styles['SectionTitle']))
    elements.append(Paragraph(
        "Cuando entres al banco, pide hablar con un <b>Business Banker</b> o el gerente. "
        "Saluda con confianza y di:",
        styles['BodyText2']
    ))
    elements.append(Paragraph(
        '"Hola, buenas tardes. Mi nombre es Yoandy Ross. Acabo de registrar mi compañía, '
        'Ross Lending Solutions LLC, aquí en Dumas. Necesito abrir una cuenta de negocios '
        '(business checking account). Ya tengo mi EIN del IRS y todos los documentos."',
        styles['Quote']
    ))

    # ─── SECTION 3: Common questions ───
    elements.append(Paragraph("3. SI TE PREGUNTAN: ¿A QUÉ SE DEDICA LA EMPRESA?", styles['SectionTitle']))
    elements.append(Paragraph(
        "Esta es la pregunta más importante. Responde con naturalidad:",
        styles['BodyText2']
    ))
    elements.append(Paragraph(
        '"Ofrecemos servicios financieros para la comunidad — financiamiento personal y '
        'adelantos de taxes. Estamos en proceso de obtener la licencia de Regulated Lender '
        'con la OCCC de Texas, que es la agencia estatal que supervisa este tipo de negocio. '
        'Todo completamente regulado y legal."',
        styles['Quote']
    ))

    elements.append(Paragraph("4. SI PREGUNTAN: ¿QUÉ TIPO DE TRANSACCIONES VA A TENER LA CUENTA?", styles['SectionTitle']))
    elements.append(Paragraph(
        '"Principalmente depósitos de pagos de clientes — la mayoría serán pagos mensuales '
        'pequeños, entre $50 y $500. También haré desembolsos cuando se apruebe un préstamo. '
        'El volumen será bajo al principio, estoy empezando."',
        styles['Quote']
    ))

    elements.append(Paragraph("5. SI PREGUNTAN: ¿CUÁNTO PIENSA DEPOSITAR?", styles['SectionTitle']))
    elements.append(Paragraph(
        '"Voy a hacer un depósito inicial de $25,000. La OCCC de Texas requiere mantener un '
        'mínimo de $25,000 en activos netos para la licencia de prestamista regulado, así que '
        'ese capital siempre va a estar respaldando la cuenta."',
        styles['Quote']
    ))

    elements.append(Paragraph("6. SI PREGUNTAN: ¿TIENE LICENCIA PARA PRESTAR?", styles['SectionTitle']))
    elements.append(Paragraph(
        '"Estoy en proceso de solicitar la licencia de Regulated Lender con la OCCC '
        '(Office of Consumer Credit Commissioner) de Texas bajo el Capítulo 342 del '
        'Finance Code. La cuenta bancaria comercial es uno de los requisitos para completar '
        'la aplicación. Es como cuando abres un restaurante — primero necesitas el local '
        'antes de pedir el permiso de salud."',
        styles['Quote']
    ))

    elements.append(Paragraph("7. SI PREGUNTAN: ¿TAMBIÉN TIENE OTRO NEGOCIO?", styles['SectionTitle']))
    elements.append(Paragraph(
        '"Sí, también tengo Ross Tax Preparation aquí en Dumas. Llevo varios años '
        'sirviendo a la comunidad con preparación de impuestos. Los servicios de lending '
        'son una extensión natural del negocio — muchos de mis clientes de taxes necesitan '
        'financiamiento y prefiero ofrecerles una opción regulada y transparente."',
        styles['Quote']
    ))

    # ─── SECTION: Key phrases ───
    elements.append(Paragraph("8. FRASES CLAVE QUE GENERAN CONFIANZA", styles['SectionTitle']))
    phrases = [
        '<b>"Regulado por la OCCC de Texas"</b> — Muestra que hay supervisión gubernamental',
        '<b>"Capítulo 342 del Texas Finance Code"</b> — Demuestra que conoces la ley',
        '<b>"Llevo años sirviendo a la comunidad de Dumas"</b> — Genera confianza local',
        '<b>"Todo transparente y dentro de la ley"</b> — Elimina sospechas',
        '<b>"Empezando poco a poco"</b> — No asusta al banco con volúmenes grandes',
    ]
    for p in phrases:
        elements.append(Paragraph(f"● {p}", styles['BulletText']))

    # ─── SECTION: What NOT to say ───
    elements.append(Paragraph("9. LO QUE NO DEBES DECIR", styles['SectionTitle']))
    elements.append(Paragraph(
        '❌ NO digas "presto dinero en efectivo" — Suena informal\n'
        '❌ NO menciones tasas de interés específicas — No es relevante para el banco\n'
        '❌ NO digas "mis clientes no tienen crédito" — Suena riesgoso\n'
        '❌ NO hables de cobros o morosidad — Genera preocupación\n'
        '❌ NO menciones "payday loans" — Tiene estigma negativo',
        styles['Warning']
    ))

    # ─── SECTION: Account type ───
    elements.append(Paragraph("10. TIPO DE CUENTA A PEDIR", styles['SectionTitle']))
    account_data = [
        ["Tipo de cuenta:", "Business Checking Account"],
        ["Nombre en la cuenta:", "ROSS LENDING SOLUTIONS LLC"],
        ["EIN:", "42-2405079"],
        ["Depósito inicial:", "$25,000"],
        ["Servicios adicionales:", "Online Banking, Bill Pay, Zelle Business"],
        ["Tarjeta de débito:", "Sí, a nombre de la LLC"],
    ]
    t = Table(account_data, colWidths=[150, 320])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#0D4F3C')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(t)

    # ─── FOOTER ───
    elements.append(Spacer(1, 25))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cccccc')))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        f"Documento confidencial generado el {datetime.now().strftime('%d de mayo de %Y')}. "
        "Solo para uso interno de Yoandy Ross / Ross Lending Solutions LLC.",
        styles['Footer']
    ))

    doc.build(elements)
    return buffer.getvalue()


if __name__ == "__main__":
    pdf_bytes = generate_bank_guide_pdf()
    with open("/tmp/Guia_Apertura_Cuenta_Bancaria_RLS.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"✅ PDF generado: {len(pdf_bytes)} bytes")
