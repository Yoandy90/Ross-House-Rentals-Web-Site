"""
CAB Legal Contracts PDF Generator
Generates all required legal documents for Texas CAB operations:
1. Credit Services Agreement (CSO/CAB Agreement)
2. Promissory Note (Lender Agreement)
3. Disclosure Statement (Texas Finance Code Ch. 393)
4. Right to Cancel Notice
5. Payment Schedule with CAB/Lender Split
6. OCCC Annual Report (Form CAB50)
"""

import os
import logging
from datetime import datetime
from typing import Dict
from zoneinfo import ZoneInfo
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT

logger = logging.getLogger(__name__)
MIAMI_TZ = ZoneInfo("America/New_York")


def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='DocTitle', fontSize=16, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), alignment=TA_CENTER,
                             spaceAfter=6, leading=20))
    styles.add(ParagraphStyle(name='DocSubtitle', fontSize=11, fontName='Helvetica',
                             textColor=HexColor('#4a5568'), alignment=TA_CENTER,
                             spaceAfter=12, leading=14))
    styles.add(ParagraphStyle(name='SectionHead', fontSize=12, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), spaceBefore=14, spaceAfter=6,
                             leading=16))
    styles.add(ParagraphStyle(name='Body', fontSize=10, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=6, leading=14,
                             alignment=TA_JUSTIFY))
    styles.add(ParagraphStyle(name='BodyBold', fontSize=10, fontName='Helvetica-Bold',
                             textColor=HexColor('#333333'), spaceAfter=6, leading=14))
    styles.add(ParagraphStyle(name='SmallText', fontSize=8, fontName='Helvetica',
                             textColor=HexColor('#666666'), spaceAfter=4, leading=10))
    styles.add(ParagraphStyle(name='SignLine', fontSize=10, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=2, leading=14))
    styles.add(ParagraphStyle(name='LegalNotice', fontSize=9, fontName='Helvetica-Bold',
                             textColor=HexColor('#991B1B'), spaceAfter=6, leading=12,
                             alignment=TA_CENTER))
    return styles


def _add_header(elements, styles, title, loan_data):
    """Add standard document header"""
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", styles['DocTitle']))
    elements.append(Paragraph("Credit Access Business — OCCC Licensed", styles['DocSubtitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph(title, styles['DocTitle']))
    elements.append(Spacer(1, 0.1*inch))

    info_data = [
        ['Date:', datetime.now(MIAMI_TZ).strftime('%m/%d/%Y'), 'Loan No.:', loan_data.get('loan_number', '')],
        ['Client:', loan_data.get('client_name', ''), 'Amount:', f"${loan_data.get('loan_amount', 0):,.2f}"],
        ['Email:', loan_data.get('client_email', ''), 'Term:', f"{loan_data.get('term_months', 0)} months"],
    ]
    info_table = Table(info_data, colWidths=[0.8*inch, 2.2*inch, 1*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#333333')),
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f7fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.2*inch))


def _add_signatures(elements, styles, loan_data):
    """Add signature blocks"""
    elements.append(Spacer(1, 0.4*inch))
    sig_data = [
        ['_' * 40, '', '_' * 40],
        [f"Client Signature: {loan_data.get('client_name', '')}", '', 'CAB Representative Signature'],
        ['', '', 'Ross Lending Solutions LLC'],
        ['Date: ________________', '', 'Date: ________________'],
    ]
    sig_table = Table(sig_data, colWidths=[2.5*inch, 1*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(sig_table)


# ═══════════════════════════════════════════════
# 1. CREDIT SERVICES AGREEMENT
# ═══════════════════════════════════════════════

def generate_cab_agreement(loan_data: Dict, output_path: str = "") -> str:
    """Generate the Credit Services Agreement (CSO/CAB contract)"""
    if not output_path:
        output_path = f"/tmp/cab_agreement_{loan_data.get('loan_number', 'draft')}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.6*inch, rightMargin=0.6*inch)
    styles = _get_styles()
    elements = []

    _add_header(elements, styles, "CREDIT ACCESS SERVICES AGREEMENT", loan_data)

    cab_fee = loan_data.get('cab_fee_percent', 0)
    loan_amt = loan_data.get('loan_amount', 0)
    term = loan_data.get('term_months', 0)
    monthly_fee = loan_amt * (cab_fee / 100)
    total_fees = monthly_fee * term

    sections = [
        ("1. PARTIES TO THE AGREEMENT",
         f"This Credit Access Services Agreement ('Agreement') is entered into between:\n\n"
         f"<b>PROVEEDOR DE SERVICIOS (CAB):</b> Ross Lending Solutions LLC, con licencia del Office of Consumer "
         f"Credit Commissioner (OCCC) of the State of Texas under the Texas Finance Code, Chapter 393, Subchapter G.\n\n"
         f"<b>CLIENT:</b> {loan_data.get('client_name', '_______________')}, with address at "
         f"{loan_data.get('client_address', '_______________')}."),

        ("2. DESCRIPTION OF SERVICES",
         "Ross Lending Solutions LLC, como Credit Access Business (CAB) registrado, actuará como intermediario "
         "to obtain a loan from an affiliated third-party lender on behalf of the Client. Services include:\n\n"
         "a) Evaluation of the Client's credit application\n"
         "b) Management and submission of the application to the third-party lender\n"
         "c) Coordination of loan approval and disbursement\n"
         "d) Administration of payments during the term of the loan\n"
         "e) Customer service and inquiry resolution"),

        ("3. MANAGED LOAN TERMS",
         f"<b>Loan Amount:</b> ${loan_amt:,.2f}\n"
         f"<b>Third-Party Lender:</b> {loan_data.get('lender_name', 'To be designated')}\n"
         f"<b>Lender Interest Rate:</b> {loan_data.get('lender_interest_annual', 10)}% annual\n"
         f"<b>Term:</b> {term} months\n"
         f"<b>Payment Frequency:</b> {loan_data.get('payment_frequency', 'Monthly').capitalize()}"),

        ("4. CAB SERVICE FEE",
         f"<b>Brokerage Fee:</b> {cab_fee}% monthly on the original loan amount\n"
         f"<b>Monthly fee amount:</b> ${monthly_fee:,.2f}\n"
         f"<b>Total fees over the term:</b> ${total_fees:,.2f}\n\n"
         "This fee is compensation for the brokerage services provided by the CAB. "
         "This fee is SEPARATE and INDEPENDENT from the interest charged by the third-party lender on the loan."),

        ("5. PAYMENT STRUCTURE",
         f"The Client shall make monthly payments of <b>${loan_data.get('monthly_payment', 0):,.2f}</b> "
         f"directamente a Ross Lending Solutions LLC (CAB), los cuales se distribuirán de la siguiente manera:\n\n"
         f"• <b>CAB Fee:</b> ${monthly_fee:,.2f} — retenida por Ross Lending Solutions LLC\n"
         f"• <b>Lender Portion:</b> ${loan_data.get('lender_per_payment', 0):,.2f} — "
         f"transferred to the third-party lender\n\n"
         f"<b>Total payable over the term:</b> ${loan_data.get('total_payable', 0):,.2f}"),

        ("6. TOTAL COST DISCLOSURE",
         f"The Client acknowledges and accepts that the total cost of the loan is:\n\n"
         f"• Loan principal: ${loan_amt:,.2f}\n"
         f"• Lender interest ({loan_data.get('lender_interest_annual', 10)}% annual): "
         f"${loan_data.get('total_lender_portion', 0) - loan_amt:,.2f}\n"
         f"• CAB fees ({cab_fee}% monthly x {term} months): ${total_fees:,.2f}\n"
         f"• <b>TOTAL TO PAY: ${loan_data.get('total_payable', 0):,.2f}</b>"),

        ("7. RIGHT TO CANCEL",
         "The Client has the right to cancel this agreement within <b>three (3) business days</b> "
         "following the date of signature, without any penalty. To cancel, the Client must notify "
         "por escrito a Ross Lending Solutions LLC. Si el préstamo ya fue desembolsado, el Cliente deberá "
         "return the full amount of the loan to the third-party lender."),

        ("8. DEFAULT AND CONSEQUENCES",
         "In case of payment default:\n\n"
         "a) A late payment charge of 5% of the payment amount or $7.50, whichever is greater, will be applied\n"
         "b) A $30 charge for returned checks or rejected payments (NSF)\n"
         "c) The CAB may initiate collection proceedings in accordance with applicable law\n"
         "d) Default will be reported per OCCC regulations"),

        ("9. GOVERNING LAW",
         "This agreement is governed by the laws of the State of Texas, specifically the Texas Finance Code, "
         "Chapter 393, Subchapter G, and the regulations of the Office of Consumer Credit Commissioner (OCCC). "
         "Any dispute shall be resolved in the courts of the county where the loan originated."),

        ("10. CLIENT ACKNOWLEDGMENT",
         "By signing this agreement, the Client acknowledges that:\n\n"
         "a) They have read and understand all terms of this agreement\n"
         "b) They have received a copy of the Disclosure Statement\n"
         "c) They have received the Right to Cancel Notice\n"
         "d) They have received the detailed Payment Schedule\n"
         "e) They understand that the CAB is an intermediary and NOT the direct lender\n"
         "f) The CAB fee is separate from the interest charged by the lender"),
    ]

    for title, content in sections:
        elements.append(Paragraph(title, styles['SectionHead']))
        elements.append(Paragraph(content, styles['Body']))

    _add_signatures(elements, styles, loan_data)

    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(
        "This document complies with the requirements of Texas Finance Code §393.201-393.223 "
        "and OCCC regulations (7 Tex. Admin. Code §83).",
        styles['SmallText']
    ))

    doc.build(elements)
    logger.info(f"📄 CAB Agreement generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# 2. PROMISSORY NOTE
# ═══════════════════════════════════════════════

def generate_promissory_note(loan_data: Dict, output_path: str = "") -> str:
    """Generate the Promissory Note (Lender agreement)"""
    if not output_path:
        output_path = f"/tmp/promissory_note_{loan_data.get('loan_number', 'draft')}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.6*inch, rightMargin=0.6*inch)
    styles = _get_styles()
    elements = []

    _add_header(elements, styles, "PROMISSORY NOTE", loan_data)

    loan_amt = loan_data.get('loan_amount', 0)
    lender_rate = loan_data.get('lender_interest_annual', 10)
    term = loan_data.get('term_months', 0)
    lender_per_payment = loan_data.get('lender_per_payment', 0)
    total_lender = loan_data.get('total_lender_portion', 0)

    elements.append(Paragraph(
        f"FOR VALUE RECEIVED, the undersigned (the 'Borrower'), "
        f"<b>{loan_data.get('client_name', '_______________')}</b>, "
        f"promises to pay to the order of <b>{loan_data.get('lender_name', 'Third-Party Lender')}</b> "
        f"(the 'Lender'), the principal sum of <b>${loan_amt:,.2f}</b> "
        f"(United States Dollars), with interest at an annual rate of "
        f"<b>{lender_rate}%</b>, under the following terms:",
        styles['Body']
    ))

    sections = [
        ("1. MONTO PRINCIPAL", f"${loan_amt:,.2f} (Dólares de EE.UU.)"),
        ("2. TASA DE INTERÉS", f"{lender_rate}% annual, calculado sobre el saldo pendiente"),
        ("3. PLAZO", f"{term} meses a partir de la fecha de desembolso"),
        ("4. PAGOS",
         f"El Prestatario realizará pagos mensuales de ${lender_per_payment:,.2f} "
         f"(porción del prestamista solamente) a través del Credit Access Business (Ross Lending Solutions LLC), "
         f"quien actuará como agente de cobro.\n\n"
         f"Total a pagar al prestamista: ${total_lender:,.2f}"),
        ("5. MÉTODO DE PAGO",
         "Los pagos se realizarán a través del CAB (Ross Lending Solutions LLC), "
         "quien transferirá la porción correspondiente al Prestamista. "
         "El Prestatario NO necesita realizar pagos separados al Prestamista."),
        ("6. INCUMPLIMIENTO",
         "En caso de que cualquier pago no sea recibido dentro de los 10 días "
         "posteriores a la fecha de vencimiento, el Prestatario estará en incumplimiento. "
         "El Prestamista podrá, a su discreción, declarar el saldo total inmediatamente pagadero."),
        ("7. PAGOS ANTICIPADOS",
         "El Prestatario podrá realizar pagos anticipados del principal "
         "en cualquier momento sin penalidad."),
        ("8. LEY APLICABLE",
         "Este pagaré se rige por las leyes del Estado de Texas. "
         "La tasa de interés cumple con el límite constitucional de usura de Texas."),
    ]

    for title, content in sections:
        elements.append(Paragraph(title, styles['SectionHead']))
        elements.append(Paragraph(content, styles['Body']))

    _add_signatures(elements, styles, loan_data)

    doc.build(elements)
    logger.info(f"📄 Promissory Note generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# 3. DISCLOSURE STATEMENT
# ═══════════════════════════════════════════════

def generate_disclosure(loan_data: Dict, output_path: str = "") -> str:
    """Generate Texas Finance Code Disclosure Statement"""
    if not output_path:
        output_path = f"/tmp/disclosure_{loan_data.get('loan_number', 'draft')}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.6*inch, rightMargin=0.6*inch)
    styles = _get_styles()
    elements = []

    _add_header(elements, styles, "DECLARACIÓN DE DIVULGACIÓN\n(Disclosure Statement)", loan_data)

    elements.append(Paragraph(
        "AVISO IMPORTANTE: LÉASE ANTES DE FIRMAR",
        styles['LegalNotice']
    ))

    loan_amt = loan_data.get('loan_amount', 0)
    cab_fee = loan_data.get('cab_fee_percent', 0)
    monthly_fee = loan_amt * (cab_fee / 100)
    total_fees = loan_data.get('total_cab_fees', 0)
    lender_rate = loan_data.get('lender_interest_annual', 10)

    # Cost breakdown table
    cost_data = [
        ['CONCEPTO', 'DETALLE', 'MONTO'],
        ['Monto del Préstamo', 'Principal otorgado por el prestamista', f'${loan_amt:,.2f}'],
        ['Interés del Prestamista', f'{lender_rate}% annual sobre saldo', f'${loan_data.get("total_lender_portion", 0) - loan_amt:,.2f}'],
        ['Tarifa CAB (intermediación)', f'{cab_fee}% monthly x {loan_data.get("term_months", 0)} meses', f'${total_fees:,.2f}'],
        ['CARGO TOTAL DE FINANCIAMIENTO', 'Interés + Tarifas CAB', f'${total_fees + loan_data.get("total_lender_portion", 0) - loan_amt:,.2f}'],
        ['MONTO TOTAL A PAGAR', 'Principal + Interés + Tarifas', f'${loan_data.get("total_payable", 0):,.2f}'],
    ]

    cost_table = Table(cost_data, colWidths=[2.2*inch, 2.3*inch, 1.5*inch])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 4), (-1, 5), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 4), (-1, 4), HexColor('#fef3c7')),
        ('BACKGROUND', (0, 5), (-1, 5), HexColor('#d1fae5')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
    ]))
    elements.append(cost_table)
    elements.append(Spacer(1, 0.2*inch))

    elements.append(Paragraph("DERECHOS DEL CONSUMIDOR", styles['SectionHead']))
    elements.append(Paragraph(
        "Conforme al Texas Finance Code, Capítulo 393, usted tiene los siguientes derechos:\n\n"
        "1. Derecho a cancelar este acuerdo dentro de 3 días hábiles sin penalidad\n"
        "2. Derecho a recibir una copia completa de todos los documentos firmados\n"
        "3. Derecho a consultar su expediente de crédito\n"
        "4. Derecho a disputar información incorrecta en su reporte de crédito\n"
        "5. Derecho a presentar una queja ante el OCCC (512-936-7600)",
        styles['Body']
    ))

    elements.append(Paragraph("CONTACTO DEL REGULADOR", styles['SectionHead']))
    elements.append(Paragraph(
        "<b>Office of Consumer Credit Commissioner (OCCC)</b>\n"
        "2601 N. Lamar Blvd., Austin, TX 78705\n"
        "Teléfono: (512) 936-7600 | Fax: (512) 936-7610\n"
        "Web: occc.texas.gov\n"
        "Para quejas: occc.texas.gov/consumers/complaints",
        styles['Body']
    ))

    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(
        "RECONOZCO haber recibido y leído esta Declaración de Divulgación "
        "antes de firmar el Acuerdo de Servicios de Acceso al Crédito.",
        styles['BodyBold']
    ))

    _add_signatures(elements, styles, loan_data)

    doc.build(elements)
    logger.info(f"📄 Disclosure Statement generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# 4. RIGHT TO CANCEL NOTICE
# ═══════════════════════════════════════════════

def generate_cancel_notice(loan_data: Dict, output_path: str = "") -> str:
    """Generate Right to Cancel Notice"""
    if not output_path:
        output_path = f"/tmp/cancel_notice_{loan_data.get('loan_number', 'draft')}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.6*inch, rightMargin=0.6*inch)
    styles = _get_styles()
    elements = []

    _add_header(elements, styles, "AVISO DE DERECHO A CANCELAR\n(Right to Cancel Notice)", loan_data)

    elements.append(Paragraph(
        "IMPORTANTE: USTED TIENE EL DERECHO DE CANCELAR ESTE ACUERDO",
        styles['LegalNotice']
    ))

    now = datetime.now(MIAMI_TZ)
    from datetime import timedelta
    cancel_deadline = now + timedelta(days=3)

    elements.append(Paragraph(
        f"Conforme al Texas Finance Code §393.205, usted tiene el derecho de cancelar el "
        f"Acuerdo de Servicios de Acceso al Crédito dentro de los <b>TRES (3) DÍAS HÁBILES</b> "
        f"siguientes a la fecha de firma.\n\n"
        f"<b>Fecha límite para cancelar: {cancel_deadline.strftime('%m/%d/%Y')}</b>",
        styles['Body']
    ))

    elements.append(Paragraph("CÓMO CANCELAR", styles['SectionHead']))
    elements.append(Paragraph(
        "Para ejercer su derecho a cancelar:\n\n"
        "1. Notifique por escrito a Ross Lending Solutions LLC en la dirección indicada abajo\n"
        "2. Puede enviar la notificación por correo, email, o entregarla en persona\n"
        "3. La notificación debe indicar su nombre, número de préstamo, y su intención de cancelar\n\n"
        "<b>Dirección:</b> Ross Lending Solutions LLC [DIRECCIÓN DE LA OFICINA]\n"
        f"<b>Email:</b> info@rosstaxpreparation.com\n"
        f"<b>Teléfono:</b> [NÚMERO DE TELÉFONO]",
        styles['Body']
    ))

    elements.append(Paragraph("EFECTOS DE LA CANCELACIÓN", styles['SectionHead']))
    elements.append(Paragraph(
        "Si usted cancela dentro del plazo establecido:\n\n"
        "• No se le cobrará ninguna tarifa por los servicios CAB\n"
        "• Si el préstamo ya fue desembolsado, deberá devolver el monto completo del préstamo al prestamista\n"
        "• Se le devolverá cualquier pago realizado al CAB\n"
        "• La cancelación no afectará su historial crediticio",
        styles['Body']
    ))

    elements.append(Spacer(1, 0.3*inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor('#e2e8f0')))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(
        "FORMULARIO DE CANCELACIÓN (Cortar y enviar si desea cancelar)",
        styles['SectionHead']
    ))
    elements.append(Paragraph(
        f"Yo, {loan_data.get('client_name', '_______________')}, "
        f"deseo cancelar el Acuerdo de Servicios de Acceso al Crédito "
        f"No. {loan_data.get('loan_number', '_______________')} "
        f"fechado {now.strftime('%m/%d/%Y')}.\n\n"
        f"Firma: ________________________________  Date: ________________",
        styles['Body']
    ))

    doc.build(elements)
    logger.info(f"📄 Cancel Notice generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# 5. PAYMENT SCHEDULE
# ═══════════════════════════════════════════════

def generate_payment_schedule(loan_data: Dict, output_path: str = "") -> str:
    """Generate detailed payment schedule with CAB/Lender split"""
    if not output_path:
        output_path = f"/tmp/payment_schedule_{loan_data.get('loan_number', 'draft')}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.5*inch, rightMargin=0.5*inch)
    styles = _get_styles()
    elements = []

    _add_header(elements, styles, "CALENDARIO DE PAGOS DETALLADO\n(Payment Schedule)", loan_data)

    schedule = loan_data.get('payment_schedule', [])

    # Build payment table
    table_data = [
        ['#', 'Fecha\nVencimiento', 'Pago\nTotal', 'Tarifa\nCAB', 'Principal\nPrestamista', 'Interés\nPrestamista', 'Total\nPrestamista', 'Saldo\nPendiente']
    ]

    for p in schedule:
        table_data.append([
            str(p.get('payment_number', '')),
            p.get('due_date', ''),
            f"${p.get('total_amount', 0):,.2f}",
            f"${p.get('cab_fee', 0):,.2f}",
            f"${p.get('lender_principal', 0):,.2f}",
            f"${p.get('lender_interest', 0):,.2f}",
            f"${p.get('lender_total', 0):,.2f}",
            f"${p.get('remaining_principal', 0):,.2f}",
        ])

    # Totals row
    total_amount = sum(p.get('total_amount', 0) for p in schedule)
    total_cab = sum(p.get('cab_fee', 0) for p in schedule)
    total_principal = sum(p.get('lender_principal', 0) for p in schedule)
    total_interest = sum(p.get('lender_interest', 0) for p in schedule)
    total_lender = sum(p.get('lender_total', 0) for p in schedule)

    table_data.append([
        'TOTAL', '', f'${total_amount:,.2f}', f'${total_cab:,.2f}',
        f'${total_principal:,.2f}', f'${total_interest:,.2f}', f'${total_lender:,.2f}', ''
    ])

    col_widths = [0.35*inch, 0.85*inch, 0.85*inch, 0.8*inch, 0.85*inch, 0.8*inch, 0.8*inch, 0.85*inch]
    table = Table(table_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#065F46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#d1fae5')),
        ('BACKGROUND', (3, 1), (3, -2), HexColor('#fef3c7')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#a7f3d0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [HexColor('#ffffff'), HexColor('#f0fdf4')]),
    ]))
    elements.append(table)

    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(
        f"La columna 'Tarifa CAB' es retenida por Ross Lending Solutions LLC como compensación por servicios. "
        f"Las columnas 'Principal/Interés Prestamista' son transferidas al prestamista tercero.",
        styles['SmallText']
    ))

    _add_signatures(elements, styles, loan_data)

    doc.build(elements)
    logger.info(f"📄 Payment Schedule generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# 6. OCCC ANNUAL REPORT
# ═══════════════════════════════════════════════

def generate_occc_report_pdf(report_data: Dict, output_path: str = "") -> str:
    """Generate OCCC Annual Report (CAB50 format)"""
    if not output_path:
        year = report_data.get('report_year', datetime.now().year)
        output_path = f"/tmp/occc_report_CAB50_{year}.pdf"

    doc = SimpleDocTemplate(output_path, pagesize=letter,
                           topMargin=0.5*inch, bottomMargin=0.5*inch,
                           leftMargin=0.6*inch, rightMargin=0.6*inch)
    styles = _get_styles()
    elements = []

    year = report_data.get('report_year', '')
    elements.append(Paragraph("ROSS TAX PREPARATION", styles['DocTitle']))
    elements.append(Paragraph(f"REPORTE ANUAL OCCC — AÑO FISCAL {year}", styles['DocTitle']))
    elements.append(Paragraph("(Basado en Form CAB50 del OCCC)", styles['DocSubtitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))

    # Summary table
    summary_data = [
        ['MÉTRICA', 'VALOR'],
        ['Préstamos Originados', str(report_data.get('loans_originated', 0))],
        ['Monto Total Originado', f"${report_data.get('total_amount_originated', 0):,.2f}"],
        ['Tarifas CAB Cobradas', f"${report_data.get('total_cab_fees_charged', 0):,.2f}"],
        ['Monto Promedio de Préstamo', f"${report_data.get('average_loan_amount', 0):,.2f}"],
        ['Tarifa CAB Promedio', f"{report_data.get('average_cab_fee_percent', 0)}%"],
        ['Plazo Promedio', f"{report_data.get('average_term_months', 0)} meses"],
        ['Total Pagos Recibidos', str(report_data.get('total_payments_collected', 0))],
        ['Monto Total Cobrado', f"${report_data.get('total_amount_collected', 0):,.2f}"],
        ['Tarifas CAB Cobradas', f"${report_data.get('total_cab_fees_collected', 0):,.2f}"],
        ['Remitido a Prestamistas', f"${report_data.get('total_lender_remitted', 0):,.2f}"],
        ['Préstamos Activos', str(report_data.get('active_loans', 0))],
        ['Préstamos Morosos', str(report_data.get('delinquent_loans', 0))],
        ['Tasa de Morosidad', f"{report_data.get('delinquency_rate', 0)}%"],
        ['Préstamos en Incumplimiento', str(report_data.get('defaulted_loans', 0))],
        ['Tasa de Incumplimiento', f"{report_data.get('default_rate', 0)}%"],
    ]

    summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)

    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        f"Reporte generado: {report_data.get('generated_at', '')} | "
        f"Este reporte es para uso interno y referencia para la preparación del Form CAB50 del OCCC.",
        styles['SmallText']
    ))

    doc.build(elements)
    logger.info(f"📄 OCCC Report generated: {output_path}")
    return output_path


# ═══════════════════════════════════════════════
# GENERATE ALL CONTRACTS FOR A LOAN
# ═══════════════════════════════════════════════

def generate_all_contracts(loan_data: Dict, base_dir: str = "/tmp") -> Dict[str, str]:
    """Generate all 5 legal documents for a CAB loan"""
    loan_num = loan_data.get('loan_number', 'draft').replace('/', '-')

    paths = {
        "cab_agreement": generate_cab_agreement(
            loan_data, f"{base_dir}/CAB_Agreement_{loan_num}.pdf"
        ),
        "promissory_note": generate_promissory_note(
            loan_data, f"{base_dir}/Promissory_Note_{loan_num}.pdf"
        ),
        "disclosure": generate_disclosure(
            loan_data, f"{base_dir}/Disclosure_{loan_num}.pdf"
        ),
        "cancel_notice": generate_cancel_notice(
            loan_data, f"{base_dir}/Cancel_Notice_{loan_num}.pdf"
        ),
        "payment_schedule": generate_payment_schedule(
            loan_data, f"{base_dir}/Payment_Schedule_{loan_num}.pdf"
        ),
    }

    logger.info(f"📋 All 5 contracts generated for {loan_num}")
    return paths
