"""
Loan PDF Service — Contract & Payment Receipt Generation
Uses reportlab to generate professional loan contract PDFs and payment receipts.
Supports bilingual output: English (default for bank compliance) and Spanish.
"""
import io
import base64
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.graphics.shapes import Drawing, Line


# ═══════════════════════════════════════════════════════════════════════
# TRANSLATIONS DICTIONARY
# ═══════════════════════════════════════════════════════════════════════

TRANSLATIONS = {
    'en': {
        # Amortization methods
        'amort_flat': 'Flat Interest (Fixed Monthly %)',
        'amort_french': 'French (Fixed Payment)',
        'amort_german': 'German (Fixed Principal)',
        'amort_american': 'American (Interest Only)',
        # Payment frequency
        'freq_weekly': 'Weekly (4 payments)',
        'freq_biweekly': 'Biweekly (2 payments)',
        'freq_monthly': 'Monthly (1 payment)',
        # Date months
        'months': ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'],
        'date_format': '{month} {day}, {year}',
        # Contract header
        'doc_title': 'PERSONAL LOAN AGREEMENT',
        'number': 'Number',
        'date': 'Date',
        # Section 1: Parties
        'section_parties': '1. CONTRACT PARTIES',
        'lender': 'LENDER:',
        'address': 'Address:',
        'phone': 'Phone:',
        'borrower': 'BORROWER:',
        'email': 'Email:',
        'ssn': 'SSN:',
        # Section 2: Loan Terms
        'section_terms': '2. LOAN TERMS',
        'item': 'Item',
        'detail': 'Detail',
        'loan_amount': 'Loan Amount (Principal)',
        'interest_rate': 'Interest Rate',
        'monthly_suffix': ' Monthly',
        'annual_suffix': ' Annual (APR)',
        'term': 'Term',
        'months_unit': 'months',
        'loan_type': 'Loan Type',
        'payment_frequency': 'Payment Frequency',
        'payment': 'Payment',
        'weekly_suffix': ' Weekly',
        'biweekly_suffix': ' Biweekly',
        'monthly_payment_suffix': ' Monthly',
        'total_interest': 'Total Interest',
        'total_to_pay': 'Total to Pay',
        'purpose': 'Purpose',
        'not_specified': 'Not specified',
        'start_date': 'Start Date',
        'first_payment_date': 'First Payment Date',
        'last_payment_date': 'Last Payment Date',
        'due_date': 'Due Date',
        # Section 3: TILA
        'section_tila': '3. FEDERAL DISCLOSURE (TRUTH IN LENDING — TILA)',
        'tila_apr': 'ANNUAL\nPERCENTAGE RATE (APR)',
        'tila_finance_charge': 'FINANCE\nCHARGE',
        'tila_amount_financed': 'AMOUNT\nFINANCED',
        'tila_total_payments': 'TOTAL OF\nPAYMENTS',
        # Section 4: Amortization
        'section_amortization': '4. AMORTIZATION SCHEDULE',
        'amort_number': '#',
        'amort_date': 'Date',
        'amort_payment': 'Payment',
        'amort_principal': 'Principal',
        'amort_interest': 'Interest',
        'amort_balance': 'Balance',
        # Section 5: Payment Calendar
        'section_calendar': 'PAYMENT SCHEDULE',
        'freq_text_weekly': 'weekly',
        'freq_text_biweekly': 'biweekly',
        'freq_text_monthly': 'monthly',
        'calendar_intro': 'The loan is divided into <b>{num_payments} payments</b> with <b>{frequency}</b> frequency. Below are the exact dates for each payment:',
        'cal_payment_num': 'Payment #',
        'cal_payment_date': 'Payment Date',
        'cal_amount_due': 'Amount Due',
        'cal_status': 'Status',
        'cal_pending': 'Pending',
        'cal_payment_label': 'Payment {num}',
        'loan_period': 'Loan Period:',
        'total_pay_label': 'Total to pay:',
        # Section: Guarantor
        'section_guarantor': 'GUARANTOR',
        'guarantor_name': 'Name:',
        'guarantor_phone': 'Phone:',
        'guarantor_relationship': 'Relationship:',
        # Section: Terms & Conditions
        'section_terms_conditions': 'TERMS AND CONDITIONS',
        'terms': [
            'The borrower agrees to make {frequency} payments according to the amortization schedule established in this agreement.',
            'The borrower has the right to make partial or full early payments without penalty.',
            'This agreement is governed by the laws of the State of Texas, United States, and the regulations of the Texas Office of Consumer Credit Commissioner (OCCC).',
            'Any dispute not subject to arbitration shall be resolved before the competent courts of Moore County, Texas.',
            'The borrower acknowledges having received full disclosure of the financial terms in accordance with the Truth in Lending Act (TILA) and the Texas Finance Code, Chapter 342 regulations.',
            'The lender will report the loan status to credit bureaus. Timely payments may improve your credit history; late payments or defaults may negatively affect it.',
            'This loan is for short-term cash flow needs and is not intended to be a long-term financial solution.',
        ],
        'freq_terms_weekly': 'weekly',
        'freq_terms_biweekly': 'biweekly',
        'freq_terms_monthly': 'monthly',

        # Section: Legal Warning
        'legal_warning_title': 'IMPORTANT NOTICE',
        'legal_warning_text': '<b>DO NOT SIGN THIS AGREEMENT BEFORE YOU READ IT COMPLETELY.</b> You are entitled to a copy of this agreement. Keep this copy for your records.',

        # Section: E-SIGN Consent
        'esign_title': 'CONSENT FOR ELECTRONIC RECORDS AND SIGNATURES',
        'esign_text_1': 'By signing this agreement electronically, you consent to receive and sign documents by electronic means pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001 et seq.).',
        'esign_text_2': 'Your electronic signature shall have the same legal force and effect as a handwritten signature. You have the right to receive paper copies of any electronic document by contacting us.',
        'esign_text_3': 'You may withdraw your consent for electronic delivery at any time by contacting Ross Lending Solutions LLC at (806) 934-2018.',

        # Section: Fees & Penalties
        'fees_title': 'FEES, PENALTIES, AND EVENTS OF DEFAULT',
        'fee_late': '<b>Late Payment Fee:</b> If a payment is received 10 calendar days or more after the due date, a fee of $10.00 USD or 5% of the scheduled payment amount, whichever is less, will be charged.',
        'fee_nsf': '<b>Returned Payment Fee (NSF):</b> If a payment is returned due to insufficient funds or any other reason, a fee of $15.00 USD will be charged as permitted by law.',
        'fee_prepay': '<b>Prepayment:</b> The borrower has the right to pay the loan in full or in part at any time without prepayment penalty.',
        'default_title': '<b>Events of Default:</b>',
        'default_1': 'Failure to make a scheduled payment on the due date.',
        'default_2': 'Providing false or misleading information in the loan application.',
        'default_3': 'Breaching any promise or condition of this agreement.',
        'default_remedy': '<b>Remedies:</b> Upon default, the lender has the right to declare the entire outstanding balance immediately due and payable after notice and a 15 calendar day grace period. The borrower shall be responsible for reasonable attorney fees and collection costs as permitted by Texas law.',

        # Section: Arbitration
        'arbitration_title': 'ARBITRATION AND JURY TRIAL WAIVER PROVISION',
        'arbitration_text_1': '<b>READ THIS CAREFULLY.</b> This provision substantially affects your legal rights.',
        'arbitration_text_2': 'Any dispute, claim, or controversy arising out of or relating to this agreement shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) or JAMS under their consumer arbitration rules.',
        'arbitration_text_3': '<b>Waivers:</b> By agreeing to arbitration, both parties waive their right to a jury trial, to participate in class actions, and to punitive damages.',
        'arbitration_text_4': '<b>Exception:</b> Claims of $10,000.00 or less may be filed in Small Claims Court in Moore County, Texas.',
        'arbitration_text_5': '<b>Opt-Out Right:</b> You may opt out of this arbitration provision by sending written notice to Ross Lending Solutions LLC within 10 calendar days of signing this agreement.',

        # Section: MLA
        'mla_title': 'MILITARY LENDING ACT (MLA) DISCLOSURE',
        'mla_text': 'If you are an active duty service member or a covered dependent under the Military Lending Act (10 U.S.C. § 987), you are entitled to special protections including a Military Annual Percentage Rate (MAPR) cap of 36%. The arbitration provision does not apply to MLA-covered borrowers. To verify your eligibility, contact the Department of Defense at 1-800-342-9647.',

        # Section: Right to Cancel (§342.405 / Reg Z §1026.23)
        'right_to_cancel_title': 'YOUR RIGHT TO CANCEL (RESCISSION NOTICE)',
        'right_to_cancel_text_1': '<b>You have the right to cancel this loan agreement without penalty within 3 business days</b> from the date you signed this agreement or the date you received the Truth in Lending disclosures required by federal law, whichever is later.',
        'right_to_cancel_text_2': 'To cancel, you must notify Ross Lending Solutions LLC <b>in writing</b> at: 305 Bruce Ave, Dumas TX 79029, or by calling (806) 934-2018, before midnight of the third business day following the later of the above events.',
        'right_to_cancel_text_3': 'If you cancel, any money or property given to us or on our behalf must be returned to you within 20 calendar days after we receive your cancellation notice. Any security interest or lien arising from this transaction is automatically void upon cancellation.',
        'right_to_cancel_text_4': 'To exercise this right, you may use the following statement: <b>"I hereby cancel this transaction."</b>',
        'right_to_cancel_deadline': 'CANCELLATION DEADLINE: {deadline_date}',
        'right_to_cancel_ack': 'I acknowledge that I have received two copies of this Right to Cancel notice and one copy of the Federal Truth in Lending disclosure.',
        'right_to_cancel_ref': 'This right is provided under the Truth in Lending Act (15 U.S.C. §1635), Regulation Z (12 CFR §1026.23), and the Texas Finance Code §342.405.',

        # Signatures
        'section_signatures': 'VERIFIED DIGITAL SIGNATURES',
        'borrower_signature': "Borrower's Signature",
        'lender_signature': "Lender's Signature",
        # Footer
        'footer_generated': 'This document was electronically generated on {date}.',
        'footer_company': 'Ross Lending Solutions LLC · 305 Bruce Ave, Dumas TX 79029 · (806) 934-2018 · info@rosslending.com',
        # Payment Receipt
        'receipt_title': 'PAYMENT RECEIPT — LOAN',
        'pay_methods': {
            'cash': 'Cash', 'transfer': 'Transfer', 'ach': 'ACH',
            'card': 'Card', 'check': 'Check',
        },
        'receipt_loan': 'Loan:',
        'receipt_client': 'Client:',
        'receipt_payment_num': 'Payment #:',
        'receipt_payment_date': 'Payment Date:',
        'receipt_method': 'Method:',
        'receipt_item': 'Item',
        'receipt_amount': 'Amount',
        'receipt_principal_payment': 'Principal Payment',
        'receipt_interest': 'Interest',
        'receipt_late_fee': 'Late Fee',
        'receipt_total_paid': 'TOTAL PAID',
        'receipt_loan_status': 'Loan Status',
        'receipt_original_amount': 'Original Amount:',
        'receipt_accumulated_principal': 'Accumulated Principal Paid:',
        'receipt_accumulated_interest': 'Accumulated Interest Paid:',
        'receipt_outstanding_balance': 'Outstanding Balance:',
        'receipt_fully_paid': '✅ LOAN FULLY PAID OFF',
        'receipt_notes': 'Notes:',
        'receipt_footer': 'Receipt generated on {date}. This receipt is proof of payment. Keep for your records.',
    },
    'es': {
        # Amortization methods
        'amort_flat': 'Interés Flat (% Mensual Fijo)',
        'amort_french': 'Francés (Cuota Fija)',
        'amort_german': 'Alemán (Capital Fijo)',
        'amort_american': 'Americano (Interés)',
        # Payment frequency
        'freq_weekly': 'Semanal (4 pagos)',
        'freq_biweekly': 'Quincenal (2 pagos)',
        'freq_monthly': 'Mensual (1 pago)',
        # Date months
        'months': ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
        'date_format': '{day} de {month} de {year}',
        # Contract header
        'doc_title': 'CONTRATO DE PRÉSTAMO PERSONAL',
        'number': 'Número',
        'date': 'Fecha',
        # Section 1: Parties
        'section_parties': '1. PARTES DEL CONTRATO',
        'lender': 'PRESTAMISTA:',
        'address': 'Dirección:',
        'phone': 'Teléfono:',
        'borrower': 'PRESTATARIO:',
        'email': 'Email:',
        'ssn': 'SSN:',
        # Section 2: Loan Terms
        'section_terms': '2. CONDICIONES DEL PRÉSTAMO',
        'item': 'Concepto',
        'detail': 'Detalle',
        'loan_amount': 'Monto del Préstamo (Principal)',
        'interest_rate': 'Tasa de Interés',
        'monthly_suffix': ' Mensual',
        'annual_suffix': ' Anual (APR)',
        'term': 'Plazo',
        'months_unit': 'meses',
        'loan_type': 'Tipo de Préstamo',
        'payment_frequency': 'Frecuencia de Pago',
        'payment': 'Cuota',
        'weekly_suffix': ' Semanal',
        'biweekly_suffix': ' Quincenal',
        'monthly_payment_suffix': ' Mensual',
        'total_interest': 'Total de Intereses',
        'total_to_pay': 'Total a Pagar',
        'purpose': 'Propósito',
        'not_specified': 'No especificado',
        'start_date': 'Fecha de Inicio',
        'first_payment_date': 'Fecha Primer Pago',
        'last_payment_date': 'Fecha Último Pago',
        'due_date': 'Fecha de Vencimiento',
        # Section 3: TILA
        'section_tila': '3. DIVULGACIÓN FEDERAL (TRUTH IN LENDING — TILA)',
        'tila_apr': 'TASA DE PORCENTAJE\nANUAL (APR)',
        'tila_finance_charge': 'CARGO\nFINANCIERO',
        'tila_amount_financed': 'MONTO\nFINANCIADO',
        'tila_total_payments': 'TOTAL DE\nPAGOS',
        # Section 4: Amortization
        'section_amortization': '4. TABLA DE AMORTIZACIÓN',
        'amort_number': '#',
        'amort_date': 'Fecha',
        'amort_payment': 'Cuota',
        'amort_principal': 'Capital',
        'amort_interest': 'Interés',
        'amort_balance': 'Saldo',
        # Section 5: Payment Calendar
        'section_calendar': 'CALENDARIO DE PAGOS',
        'freq_text_weekly': 'semanal',
        'freq_text_biweekly': 'quincenal',
        'freq_text_monthly': 'mensual',
        'calendar_intro': 'El préstamo se divide en <b>{num_payments} pagos</b> con frecuencia <b>{frequency}</b>. A continuación se detallan las fechas exactas de cada pago:',
        'cal_payment_num': 'Pago #',
        'cal_payment_date': 'Fecha de Pago',
        'cal_amount_due': 'Monto a Pagar',
        'cal_status': 'Estado',
        'cal_pending': 'Pendiente',
        'cal_payment_label': 'Pago {num}',
        'loan_period': 'Período del préstamo:',
        'total_pay_label': 'Total a pagar:',
        # Section: Guarantor
        'section_guarantor': 'GARANTE',
        'guarantor_name': 'Nombre:',
        'guarantor_phone': 'Teléfono:',
        'guarantor_relationship': 'Relación:',
        # Section: Terms & Conditions
        'section_terms_conditions': 'TÉRMINOS Y CONDICIONES',
        'terms': [
            'El prestatario se compromete a realizar los pagos {frequency} según el calendario de amortización establecido en este contrato.',
            'El prestatario tiene derecho a realizar pagos anticipados parciales o totales sin penalización.',
            'Este contrato se rige por las leyes del Estado de Texas, Estados Unidos, y las regulaciones de la Oficina del Comisionado de Crédito al Consumidor (OCCC) de Texas.',
            'Cualquier controversia no sujeta a arbitraje será resuelta ante los tribunales competentes del condado de Moore, Texas.',
            'El prestatario reconoce haber recibido la divulgación completa de los términos financieros conforme a la Truth in Lending Act (TILA) y las regulaciones del Texas Finance Code, Capítulo 342.',
            'El prestamista reportará el estado del préstamo a las agencias de crédito. Los pagos puntuales pueden mejorar su historial crediticio; los pagos tardíos o incumplimientos pueden afectarlo negativamente.',
            'Este préstamo es para necesidades de efectivo a corto plazo y no pretende ser una solución financiera a largo plazo.',
        ],
        'freq_terms_weekly': 'semanales',
        'freq_terms_biweekly': 'quincenales',
        'freq_terms_monthly': 'mensuales',

        # Section: Legal Warning
        'legal_warning_title': 'AVISO IMPORTANTE',
        'legal_warning_text': '<b>NO FIRME ESTE CONTRATO ANTES DE LEERLO COMPLETAMENTE.</b> Usted tiene derecho a recibir una copia de este contrato. Conserve esta copia para sus registros.',

        # Section: E-SIGN Consent
        'esign_title': 'CONSENTIMIENTO PARA REGISTROS Y FIRMAS ELECTRÓNICAS',
        'esign_text_1': 'Al firmar este contrato electrónicamente, usted consiente en recibir y firmar documentos por medios electrónicos conforme a la Ley de Firmas Electrónicas en el Comercio Global y Nacional (E-SIGN Act, 15 U.S.C. § 7001 et seq.).',
        'esign_text_2': 'Su firma electrónica tendrá la misma fuerza y efecto legal que una firma manuscrita. Usted tiene derecho a recibir copias en papel de cualquier documento electrónico comunicándose con nosotros.',
        'esign_text_3': 'Puede retirar su consentimiento para la entrega electrónica en cualquier momento contactando a Ross Lending Solutions LLC al (806) 934-2018.',

        # Section: Fees & Penalties
        'fees_title': 'CARGOS, PENALIDADES Y EVENTOS DE INCUMPLIMIENTO',
        'fee_late': '<b>Cargo por Pago Tardío:</b> Si un pago se recibe 10 días calendario o más después de la fecha de vencimiento, se cobrará un cargo de $10.00 USD o el 5% del monto del pago programado, lo que sea menor.',
        'fee_nsf': '<b>Cargo por Pago Devuelto (NSF):</b> Si un pago es devuelto por fondos insuficientes o cualquier otra razón, se cobrará un cargo de $15.00 USD según lo permitido por ley.',
        'fee_prepay': '<b>Pago Anticipado:</b> El prestatario tiene derecho a pagar total o parcialmente el préstamo en cualquier momento sin penalización por pago anticipado.',
        'default_title': '<b>Eventos de Incumplimiento (Default):</b>',
        'default_1': 'No realizar un pago programado en la fecha de vencimiento.',
        'default_2': 'Proporcionar información falsa o engañosa en la solicitud de préstamo.',
        'default_3': 'Incumplir cualquier promesa o condición de este contrato.',
        'default_remedy': '<b>Remedios:</b> En caso de incumplimiento, el prestamista tiene derecho a declarar vencido el saldo total inmediatamente después de notificación y período de gracia de 15 días calendario. El prestatario será responsable de honorarios razonables de abogados y costos de cobranza según lo permitido por la ley de Texas.',

        # Section: Arbitration
        'arbitration_title': 'DISPOSICIÓN DE ARBITRAJE Y RENUNCIA A JUICIO POR JURADO',
        'arbitration_text_1': '<b>LÉASE CUIDADOSAMENTE.</b> Esta disposición afecta sustancialmente sus derechos legales.',
        'arbitration_text_2': 'Cualquier disputa, reclamación o controversia que surja de o se relacione con este contrato será resuelta mediante arbitraje vinculante administrado por la Asociación Americana de Arbitraje (AAA) o JAMS conforme a sus reglas de arbitraje del consumidor.',
        'arbitration_text_3': '<b>Renuncias:</b> Al aceptar el arbitraje, ambas partes renuncian al derecho a juicio por jurado, a participar en acciones colectivas (class action), y a daños punitivos.',
        'arbitration_text_4': '<b>Excepción:</b> Reclamaciones de $10,000.00 o menos pueden presentarse ante un tribunal de reclamaciones menores (Small Claims Court) del condado de Moore, Texas.',
        'arbitration_text_5': '<b>Derecho a No Participar (Opt-Out):</b> Usted puede optar por no participar en esta disposición de arbitraje enviando una notificación por escrito a Ross Lending Solutions LLC dentro de los 10 días calendario posteriores a la firma de este contrato.',

        # Section: MLA
        'mla_title': 'DIVULGACIÓN DE LA LEY DE PRÉSTAMOS MILITARES (MLA)',
        'mla_text': 'Si usted es un miembro del servicio militar en servicio activo o un dependiente cubierto según la Ley de Préstamos Militares (Military Lending Act, 10 U.S.C. § 987), tiene derecho a protecciones especiales incluyendo un límite de tasa de costo militar anual (MAPR) del 36%. La disposición de arbitraje no se aplica a prestatarios cubiertos por la MLA. Para verificar su elegibilidad, contacte al Departamento de Defensa al 1-800-342-9647.',

        # Section: Right to Cancel (§342.405 / Reg Z §1026.23)
        'right_to_cancel_title': 'SU DERECHO DE CANCELACIÓN (AVISO DE RESCISIÓN)',
        'right_to_cancel_text_1': '<b>Usted tiene derecho a cancelar este contrato de préstamo sin penalización dentro de los 3 días hábiles</b> siguientes a la fecha en que firmó este contrato o la fecha en que recibió las divulgaciones de Truth in Lending requeridas por ley federal, lo que ocurra después.',
        'right_to_cancel_text_2': 'Para cancelar, debe notificar a Ross Lending Solutions LLC <b>por escrito</b> a: 305 Bruce Ave, Dumas TX 79029, o llamando al (806) 934-2018, antes de la medianoche del tercer día hábil siguiente al último de los eventos mencionados.',
        'right_to_cancel_text_3': 'Si cancela, cualquier dinero o propiedad que nos haya entregado o que haya sido entregado en nuestro nombre le será devuelto dentro de los 20 días calendario siguientes a la recepción de su aviso de cancelación. Cualquier gravamen o interés de seguridad que surja de esta transacción queda automáticamente anulado al cancelar.',
        'right_to_cancel_text_4': 'Para ejercer este derecho, puede utilizar la siguiente declaración: <b>"Por la presente cancelo esta transacción."</b>',
        'right_to_cancel_deadline': 'FECHA LÍMITE DE CANCELACIÓN: {deadline_date}',
        'right_to_cancel_ack': 'Reconozco que he recibido dos copias de este aviso de Derecho de Cancelación y una copia de la divulgación federal Truth in Lending.',
        'right_to_cancel_ref': 'Este derecho se otorga conforme a la Truth in Lending Act (15 U.S.C. §1635), Regulación Z (12 CFR §1026.23), y el Texas Finance Code §342.405.',

        # Signatures
        'section_signatures': 'FIRMAS DIGITALES VERIFICADAS',
        'borrower_signature': 'Firma del Prestatario',
        'lender_signature': 'Firma del Prestamista',
        # Footer
        'footer_generated': 'Este documento fue generado electrónicamente el {date}.',
        'footer_company': 'Ross Lending Solutions LLC · 305 Bruce Ave, Dumas TX 79029 · (806) 934-2018 · info@rosslending.com',
        # Payment Receipt
        'receipt_title': 'RECIBO DE PAGO — PRÉSTAMO',
        'pay_methods': {
            'cash': 'Efectivo', 'transfer': 'Transferencia', 'ach': 'ACH',
            'card': 'Tarjeta', 'check': 'Cheque',
        },
        'receipt_loan': 'Préstamo:',
        'receipt_client': 'Cliente:',
        'receipt_payment_num': 'Pago #:',
        'receipt_payment_date': 'Fecha de Pago:',
        'receipt_method': 'Método:',
        'receipt_item': 'Concepto',
        'receipt_amount': 'Monto',
        'receipt_principal_payment': 'Abono a Capital',
        'receipt_interest': 'Intereses',
        'receipt_late_fee': 'Cargo por Mora',
        'receipt_total_paid': 'TOTAL PAGADO',
        'receipt_loan_status': 'Estado del Préstamo',
        'receipt_original_amount': 'Monto Original:',
        'receipt_accumulated_principal': 'Capital Pagado Acumulado:',
        'receipt_accumulated_interest': 'Intereses Pagados Acumulado:',
        'receipt_outstanding_balance': 'Saldo Pendiente:',
        'receipt_fully_paid': '✅ PRÉSTAMO LIQUIDADO COMPLETAMENTE',
        'receipt_notes': 'Notas:',
        'receipt_footer': 'Recibo generado el {date}. Este recibo es comprobante de pago. Conserve para sus registros.',
    },
}


def _t(key: str, lang: str = 'en') -> str:
    """Get translated string. Falls back to English."""
    return TRANSLATIONS.get(lang, TRANSLATIONS['en']).get(key, TRANSLATIONS['en'].get(key, key))


def _get_amort_label(method: str, lang: str = 'en') -> str:
    """Get amortization method label by language."""
    mapping = {
        'flat': 'amort_flat',
        'french': 'amort_french',
        'german': 'amort_german',
        'american': 'amort_american',
    }
    key = mapping.get(method, None)
    if key:
        return _t(key, lang)
    return method


def _get_freq_label(freq: str, lang: str = 'en') -> str:
    """Get payment frequency label by language."""
    mapping = {
        'weekly': 'freq_weekly',
        'biweekly': 'freq_biweekly',
        'monthly': 'freq_monthly',
    }
    key = mapping.get(freq, None)
    if key:
        return _t(key, lang)
    return freq


def _get_styles():
    """Create custom styles for the PDF"""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CompanyName',
        parent=styles['Title'],
        fontSize=22,
        textColor=colors.HexColor('#0D4F3C'),
        spaceAfter=6,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='DocTitle',
        parent=styles['Title'],
        fontSize=16,
        textColor=colors.HexColor('#1B2A4A'),
        spaceAfter=12,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=colors.HexColor('#0D4F3C'),
        spaceBefore=16,
        spaceAfter=8,
        borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        name='BodyJustify',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        name='SmallText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#666666'),
        leading=10,
    ))
    styles.add(ParagraphStyle(
        name='SignatureLine',
        parent=styles['Normal'],
        fontSize=10,
        spaceBefore=40,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name='FooterText',
        parent=styles['Normal'],
        fontSize=7,
        textColor=colors.HexColor('#999999'),
        alignment=TA_CENTER,
    ))
    return styles


def format_currency(amount):
    """Format number as USD currency"""
    return f"${amount:,.2f}"


def format_date(date_str, lang='en'):
    """Format date according to language"""
    if not date_str:
        return '—'
    try:
        if isinstance(date_str, datetime):
            d = date_str
        else:
            d = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))
        month_names = _t('months', lang)
        date_fmt = _t('date_format', lang)
        return date_fmt.format(month=month_names[d.month - 1], day=d.day, year=d.year)
    except Exception:
        return str(date_str)[:10]


# ═══════════════════════════════════════════════════════════════════════
# TILA REG Z ACTUARIAL APR CALCULATION (Appendix J)
# ═══════════════════════════════════════════════════════════════════════

def compute_tila_apr(amount_financed: float, schedule: list, payment_frequency: str = "monthly") -> float:
    """
    Compute the TILA Regulation Z APR using the actuarial method (Appendix J).
    
    Uses Newton-Raphson to find the periodic rate 'i' such that:
        Amount Financed = Σ( Payment_j / (1 + i)^j )  for j = 1..n
    
    Then: APR = i × periods_per_year × 100
    
    This is the legally required method for consumer credit disclosures
    under 12 CFR 1026.22 (Regulation Z).
    
    Supports weekly (52/yr), biweekly (26/yr), and monthly (12/yr) frequencies.
    """
    if not schedule or amount_financed <= 0:
        return 0.0

    # Determine periods per year based on payment frequency
    if payment_frequency == "weekly":
        periods_per_year = 52
    elif payment_frequency == "biweekly":
        periods_per_year = 26
    else:  # monthly
        periods_per_year = 12

    n = len(schedule)
    payments = [p.get('payment_amount', 0) for p in schedule]
    total_paid = sum(payments)

    if total_paid <= amount_financed:
        return 0.0

    # Initial guess for the periodic rate
    finance_charge = total_paid - amount_financed
    i = (finance_charge / amount_financed) / n * 2  # rough starting point
    if i <= 0:
        i = 0.01
    if i > 5:
        i = 0.5  # cap initial guess for high-rate loans

    # Newton-Raphson iteration (max 300 iterations for convergence)
    for _ in range(300):
        f = -amount_financed     # f(i) = -A + Σ(Pj / (1+i)^j)
        f_prime = 0.0            # f'(i) = derivative

        for j in range(n):
            period = j + 1
            discount = (1 + i) ** period
            f += payments[j] / discount
            f_prime -= period * payments[j] / (discount * (1 + i))

        # Check convergence (within $0.01)
        if abs(f) < 0.01:
            break

        if abs(f_prime) < 1e-15:
            break

        i_new = i - f / f_prime

        # Bounds: keep rate positive and below 1000% periodic
        if i_new <= 0:
            i = i / 2
        elif i_new > 10:
            i = min(i * 1.5, 10)
        else:
            i = i_new

    # Convert periodic rate to annual percentage
    apr = i * periods_per_year * 100
    return round(apr, 4)


def _compute_cancellation_deadline(loan_date=None):
    """
    Compute the 3-business-day cancellation deadline per §342.405 / Reg Z §1026.23.
    Skips weekends (Saturday/Sunday). Federal holidays are not accounted for here
    but the borrower always gets the benefit of the doubt.
    """
    if loan_date is None:
        start = datetime.now()
    elif isinstance(loan_date, str):
        try:
            start = datetime.fromisoformat(loan_date.replace('Z', '+00:00'))
        except Exception:
            start = datetime.now()
    else:
        start = loan_date

    business_days = 0
    current = start
    while business_days < 3:
        current += timedelta(days=1)
        # 0=Monday ... 4=Friday, 5=Saturday, 6=Sunday
        if current.weekday() < 5:
            business_days += 1

    return current


def generate_loan_contract_pdf(loan: dict, amortization: list, lang: str = 'en') -> str:
    """
    Generate a professional loan contract PDF.
    Args:
        loan: Loan data dictionary
        amortization: Amortization schedule list
        lang: Language code ('en' for English, 'es' for Spanish). Default: 'en'
    Returns:
        base64-encoded PDF string.
    """
    if lang not in ('en', 'es'):
        lang = 'en'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=60, leftMargin=60,
        topMargin=50, bottomMargin=50,
    )
    styles = _get_styles()
    elements = []

    # ─── Header ─────────────────────────────────────────
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", styles['CompanyName']))
    elements.append(Paragraph("305 Bruce Ave, Dumas TX 79029 · (806) 934-2018 · info@rosslending.com", styles['SmallText']))
    elements.append(Paragraph("www.rosslending.com · OCCC Regulated Lender — Texas Finance Code, Cap. 342", styles['SmallText']))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0D4F3C')))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(_t('doc_title', lang), styles['DocTitle']))

    # Loan info row: Number + Date + Maturity in a prominent box
    loan_date = format_date(loan.get('application_date') or loan.get('created_at') or datetime.now(), lang)
    end_date_str_header = None
    if amortization and len(amortization) > 0:
        end_date_str_header = amortization[-1].get('due_date', '')
    maturity_date = format_date(end_date_str_header, lang) if end_date_str_header else 'N/A'

    loan_no_label = "No. de préstamo" if lang == 'es' else "Loan No."
    loan_date_label = "Fecha del préstamo" if lang == 'es' else "Loan Date"
    maturity_label = "Fecha de vencimiento" if lang == 'es' else "Maturity Date"

    loan_info_data = [
        [loan_no_label, loan_date_label, maturity_label],
        [loan.get('loan_number', 'N/A'), loan_date, maturity_date],
    ]
    t_info = Table(loan_info_data, colWidths=[160, 160, 160])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, 1), 11),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#0D4F3C')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0fdf4')),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 16))

    # ─── Parties ────────────────────────────────────────
    elements.append(Paragraph(_t('section_parties', lang), styles['SectionTitle']))

    parties_data = [
        [_t('lender', lang), 'Ross Lending Solutions LLC'],
        [_t('address', lang), '305 Bruce Ave, Dumas TX 79029'],
        [_t('phone', lang), '(806) 934-2018'],
        [_t('email', lang), 'info@rosslending.com'],
        ['Web', 'www.rosslending.com'],
        ['', ''],
        [_t('borrower', lang), loan.get('client_name', 'N/A')],
        [_t('email', lang), loan.get('client_email', 'N/A')],
        [_t('phone', lang), loan.get('client_phone', 'N/A')],
    ]
    if loan.get('client_ssn_last4'):
        parties_data.append([_t('ssn', lang), f'***-**-{loan["client_ssn_last4"]}'])

    t = Table(parties_data, colWidths=[120, 360])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)

    # ─── Loan Terms ─────────────────────────────────────
    elements.append(Paragraph(_t('section_terms', lang), styles['SectionTitle']))

    method_label = _get_amort_label(loan.get('amortization_method', 'simple'), lang)
    freq_label = _get_freq_label(loan.get('payment_frequency', 'monthly'), lang)

    # Dynamic rate display based on Subchapter
    subchapter = loan.get('subchapter', 'E')
    is_sub_f = subchapter == 'F'

    if is_sub_f:
        # Sub F: Show monthly rate
        rate_suffix = _t('monthly_suffix', lang)
        # For Sub F, interest_rate stores the monthly percentage
        display_rate = loan.get('interest_rate', 0)
        if display_rate > 100:
            # If it's stored as APR effective (e.g. 180%), show monthly
            display_rate = display_rate / 12
        elif display_rate < 1:
            # If stored as decimal
            display_rate = display_rate * 100
        rate_display = f"{display_rate:.0f}%"
    else:
        # Sub E: Show Annual APR
        rate_suffix = _t('annual_suffix', lang)
        display_rate = loan.get('annual_apr', loan.get('interest_rate', 0))
        rate_display = f"{display_rate}%"

    terms_data = [
        [_t('item', lang), _t('detail', lang)],
        [_t('loan_amount', lang), format_currency(loan.get('amount', 0))],
        [_t('interest_rate', lang) + rate_suffix, rate_display],
    ]
    # Add Subchapter indicator row
    sub_label = f"Subcapítulo {subchapter}" if lang == 'es' else f"Subchapter {subchapter}"
    sub_desc = ("Préstamo Pequeño — Interés Mensual" if lang == 'es' else "Small Loan — Monthly Interest") if is_sub_f else ("Préstamo a Plazos — Interés Anual" if lang == 'es' else "Installment Loan — Annual Interest")
    terms_data.append(["OCCC", f"{sub_label} — {sub_desc}"])
    terms_data.append([_t('term', lang), f"{loan.get('term_months', 0)} {_t('months_unit', lang)}"])

    # Calculate start and end dates from amortization schedule
    loan_start_display = format_date(
        loan.get('application_date') or loan.get('disbursement_date') or loan.get('created_at') or datetime.now(),
        lang
    )

    # End date = last payment due date
    end_date_str = None
    if amortization and len(amortization) > 0:
        end_date_str = amortization[-1].get('due_date', '')

    payment_freq = loan.get('payment_frequency', 'monthly')
    if payment_freq == 'weekly':
        payment_suffix = _t('weekly_suffix', lang)
        payment_amount = loan.get('weekly_payment', 0)
    elif payment_freq == 'biweekly':
        payment_suffix = _t('biweekly_suffix', lang)
        payment_amount = loan.get('biweekly_payment', loan.get('monthly_payment', 0) / 2)
    else:
        payment_suffix = _t('monthly_payment_suffix', lang)
        payment_amount = loan.get('monthly_payment', 0)

    terms_data.extend([
        [_t('loan_type', lang), method_label],
        [_t('payment_frequency', lang), freq_label],
        [_t('payment', lang) + payment_suffix, format_currency(payment_amount)],
        [_t('total_interest', lang), format_currency(loan.get('total_interest', 0))],
        [_t('total_to_pay', lang), format_currency(loan.get('total_to_pay', 0))],
        [_t('purpose', lang), loan.get('purpose', _t('not_specified', lang))],
    ])

    # Add dates
    terms_data.append([_t('start_date', lang), loan_start_display])
    if loan.get('first_payment_date'):
        terms_data.append([_t('first_payment_date', lang), format_date(loan['first_payment_date'], lang)])
    if end_date_str:
        terms_data.append([_t('last_payment_date', lang), format_date(end_date_str, lang)])
    if end_date_str:
        terms_data.append([_t('due_date', lang), format_date(end_date_str, lang)])

    t = Table(terms_data, colWidths=[220, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8f9fa')]),
    ]))
    elements.append(t)

    # ─── TILA Federal Disclosure (Celtic Bank style) ───────
    elements.append(Paragraph(_t('section_tila', lang), styles['SectionTitle']))

    # ═══ TILA APR — Actuarial Method (Reg Z Appendix J, 12 CFR §1026.22) ═══
    # The APR MUST be computed using the actuarial method: the annualized rate
    # that discounts all scheduled payments back to the Amount Financed.
    # Simple "monthly_rate × 12" is NOT compliant with Regulation Z.
    effective_apr = 0.0
    if amortization and len(amortization) > 0:
        effective_apr = compute_tila_apr(
            loan.get('amount', 0),
            amortization,
            loan.get('payment_frequency', 'monthly')
        )
    # Fallback: use calculator-provided APR if actuarial computation fails
    if effective_apr <= 0:
        effective_apr = loan.get('annual_apr', 0)
    # Last resort fallback (should never happen with valid data)
    if effective_apr <= 0:
        calc_apr = loan.get('interest_rate', 0)
        if calc_apr < 1:
            calc_apr = calc_apr * 100
        effective_apr = calc_apr
    apr_label = f"{effective_apr:.2f}%"

    finance_charge = loan.get('total_interest', 0) + loan.get('admin_fee', 0)

    # TILA description labels
    if lang == 'es':
        apr_desc = "El costo de su crédito\ncomo tasa anual."
        fc_desc = "La cantidad en dólares\nque le costará el crédito."
        af_desc = "La cantidad de crédito\notorgada a usted."
        tp_desc = "La cantidad que habrá pagado\nal completar todos los pagos."
    else:
        apr_desc = "The cost of your credit\nas an annual rate."
        fc_desc = "The dollar amount the\ncredit will cost you."
        af_desc = "The amount of credit\nprovided to you."
        tp_desc = "The amount you will have paid\nwhen you make all payments."

    tila_data = [
        [_t('tila_apr', lang), _t('tila_finance_charge', lang),
         _t('tila_amount_financed', lang), _t('tila_total_payments', lang)],
        [apr_label,
         format_currency(finance_charge),
         format_currency(loan.get('amount', 0)),
         format_currency(loan.get('total_to_pay', 0))],
        [apr_desc, fc_desc, af_desc, tp_desc],
    ]

    t = Table(tila_data, colWidths=[120, 120, 120, 120])
    t.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        # Values row
        ('FONTSIZE', (0, 1), (-1, 1), 14),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0fdf4')),
        # Description row
        ('FONTSIZE', (0, 2), (-1, 2), 7),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica'),
        ('TEXTCOLOR', (0, 2), (-1, 2), colors.HexColor('#666666')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#f8f9fa')),
        # General
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 1.5, colors.HexColor('#0D4F3C')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8))

    # ─── Fee Breakdown (Celtic Bank style) ───────────────
    fee_title = "DESGLOSE DE CARGOS" if lang == 'es' else "FEE BREAKDOWN"
    elements.append(Paragraph(fee_title, styles['SectionTitle']))

    admin_fee_val = loan.get('admin_fee', 0)
    total_interest_val = loan.get('total_interest', 0)
    principal_val = loan.get('amount', 0)
    total_pay_val = loan.get('total_to_pay', 0)

    fee_desc_1 = "Cantidad provista a usted" if lang == 'es' else "Amount provided to you"
    fee_desc_2 = "Cargo de adquisición (12.5% OCCC)" if lang == 'es' else "Acquisition Charge (12.5% OCCC)"
    fee_desc_3 = "Interés total" if lang == 'es' else "Total Interest"
    fee_desc_4 = "Saldo de Capital" if lang == 'es' else "Principal Balance"
    fee_desc_5 = "Total a Pagar" if lang == 'es' else "Total of Payments"

    fee_data = [
        ["#", "Concepto" if lang == 'es' else "Item", "Cantidad" if lang == 'es' else "Amount"],
        ["(1)", fee_desc_1, format_currency(principal_val)],
        ["(2)", fee_desc_2, f"(+) {format_currency(admin_fee_val)}"],
        ["(3)", fee_desc_3, f"(+) {format_currency(total_interest_val)}"],
        ["", "", ""],
        ["(4)", fee_desc_4, f"(=) {format_currency(principal_val)}"],
        ["(5)", fee_desc_5, f"(=) {format_currency(total_pay_val)}"],
    ]
    t_fee = Table(fee_data, colWidths=[35, 325, 120])
    t_fee.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        # Total row highlight
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0fdf4')),
        ('LINEABOVE', (0, -2), (-1, -2), 1, colors.HexColor('#0D4F3C')),
    ]))
    elements.append(t_fee)

    # ─── Amortization Schedule ──────────────────────────
    if amortization and len(amortization) > 0:
        elements.append(Paragraph(_t('section_amortization', lang), styles['SectionTitle']))

        has_fee = any(row.get('admin_fee', 0) > 0 for row in amortization)

        if has_fee:
            fee_label = "Cargo" if lang == 'es' else "Fee"
            amort_header = [[
                _t('amort_number', lang), _t('amort_date', lang), _t('amort_payment', lang),
                _t('amort_principal', lang), _t('amort_interest', lang), fee_label, _t('amort_balance', lang)
            ]]
        else:
            amort_header = [[
                _t('amort_number', lang), _t('amort_date', lang), _t('amort_payment', lang),
                _t('amort_principal', lang), _t('amort_interest', lang), _t('amort_balance', lang)
            ]]

        amort_rows = []
        for row in amortization:
            base_row = [
                str(row['payment_number']),
                row.get('due_date', ''),
                format_currency(row['payment_amount']),
                format_currency(row['principal']),
                format_currency(row['interest']),
            ]
            if has_fee:
                base_row.append(format_currency(row.get('admin_fee', 0)))
            base_row.append(format_currency(row['balance']))
            amort_rows.append(base_row)

        all_rows = amort_header + amort_rows
        num_cols = len(amort_header[0])
        if has_fee:
            col_widths = [28, 68, 68, 68, 60, 55, 68]
        else:
            col_widths = [30, 80, 80, 80, 80, 80]
        t = Table(all_rows, colWidths=col_widths)
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#343a40')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]
        t.setStyle(TableStyle(style_cmds))
        elements.append(t)

    # ─── Payment Calendar (clear date listing) ───────────
    if amortization and len(amortization) > 0:
        next_section_cal = 5 if amortization else 4
        elements.append(Paragraph(f"{next_section_cal}. {_t('section_calendar', lang)}", styles['SectionTitle']))

        freq_text = _t(f'freq_text_{loan.get("payment_frequency", "monthly")}', lang) or _t('freq_text_monthly', lang)
        num_pagos = len(amortization)
        elements.append(Paragraph(
            _t('calendar_intro', lang).format(num_payments=num_pagos, frequency=freq_text),
            styles['BodyJustify']
        ))
        elements.append(Spacer(1, 8))

        # Build payment calendar table
        cal_header = [[
            _t('cal_payment_num', lang), _t('cal_payment_date', lang),
            _t('cal_amount_due', lang), _t('cal_status', lang)
        ]]
        cal_rows = []
        for row in amortization:
            payment_num = row['payment_number']
            due_date_raw = row.get('due_date', '')
            due_date_formatted = format_date(due_date_raw, lang)
            amount = format_currency(row['payment_amount'])
            cal_rows.append([
                _t('cal_payment_label', lang).format(num=payment_num),
                due_date_formatted,
                amount,
                _t('cal_pending', lang)
            ])

        all_cal = cal_header + cal_rows
        t = Table(all_cal, colWidths=[80, 170, 120, 110])
        cal_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#e8f5e9')]),
        ]
        t.setStyle(TableStyle(cal_style))
        elements.append(t)

        # Summary line under calendar
        elements.append(Spacer(1, 8))
        first_date = format_date(amortization[0].get('due_date', ''), lang)
        last_date = format_date(amortization[-1].get('due_date', ''), lang)
        total_pay = format_currency(loan.get('total_to_pay', sum(r['payment_amount'] for r in amortization)))
        elements.append(Paragraph(
            f"<b>{_t('loan_period', lang)}</b> {first_date} — {last_date} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{_t('total_pay_label', lang)}</b> {total_pay}",
            styles['BodyJustify']
        ))

    # ─── Guarantor ──────────────────────────────────────
    if loan.get('guarantor_name'):
        next_section = 6 if amortization else 4
        elements.append(Paragraph(f"{next_section}. {_t('section_guarantor', lang)}", styles['SectionTitle']))
        guarantor_data = [
            [_t('guarantor_name', lang), loan.get('guarantor_name', '')],
            [_t('guarantor_phone', lang), loan.get('guarantor_phone', '')],
            [_t('guarantor_relationship', lang), loan.get('guarantor_relationship', '')],
        ]
        t = Table(guarantor_data, colWidths=[120, 360])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)

    # ─── Terms & Conditions ─────────────────────────────
    sec = (7 if loan.get('guarantor_name') else 6) if amortization else (5 if loan.get('guarantor_name') else 4)

    # --- Legal Warning (NO FIRME SIN LEER) ---
    warning_box = [
        [Paragraph(_t('legal_warning_text', lang), ParagraphStyle(
            'WarningText', parent=styles['BodyJustify'], fontSize=10,
            textColor=colors.HexColor('#721c24'), leading=14,
        ))],
    ]
    wt = Table(warning_box, colWidths=[480])
    wt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8d7da')),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#f5c6cb')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(Spacer(1, 12))
    elements.append(wt)
    elements.append(Spacer(1, 12))

    # --- E-SIGN Consent ---
    elements.append(Paragraph(f"{sec}. {_t('esign_title', lang)}", styles['SectionTitle']))
    elements.append(Paragraph(_t('esign_text_1', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('esign_text_2', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('esign_text_3', lang), styles['BodyJustify']))
    sec += 1

    # --- Fees, Penalties & Default ---
    elements.append(Paragraph(f"{sec}. {_t('fees_title', lang)}", styles['SectionTitle']))
    elements.append(Paragraph(_t('fee_late', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('fee_nsf', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('fee_prepay', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(_t('default_title', lang), styles['BodyJustify']))
    for dk in ['default_1', 'default_2', 'default_3']:
        elements.append(Paragraph(f"&nbsp;&nbsp;&nbsp;• {_t(dk, lang)}", styles['BodyJustify']))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(_t('default_remedy', lang), styles['BodyJustify']))
    sec += 1

    # --- General Terms & Conditions (existing, renumbered) ---
    elements.append(Paragraph(f"{sec}. {_t('section_terms_conditions', lang)}", styles['SectionTitle']))

    freq_terms = _t(f'freq_terms_{loan.get("payment_frequency", "monthly")}', lang) or _t('freq_terms_monthly', lang)
    terms_list = _t('terms', lang)

    for i, term_template in enumerate(terms_list, 1):
        term_text = term_template.format(frequency=freq_terms) if '{frequency}' in term_template else term_template
        elements.append(Paragraph(f"<b>{i}.</b> {term_text}", styles['BodyJustify']))
        elements.append(Spacer(1, 4))
    sec += 1

    # --- Arbitration Clause ---
    elements.append(Paragraph(f"{sec}. {_t('arbitration_title', lang)}", styles['SectionTitle']))
    elements.append(Paragraph(_t('arbitration_text_1', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('arbitration_text_2', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('arbitration_text_3', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('arbitration_text_4', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_t('arbitration_text_5', lang), styles['BodyJustify']))
    sec += 1

    # --- MLA Disclosure ---
    elements.append(Paragraph(f"{sec}. {_t('mla_title', lang)}", styles['SectionTitle']))
    elements.append(Paragraph(_t('mla_text', lang), styles['BodyJustify']))
    sec += 1

    # ─── RIGHT TO CANCEL — §342.405 / Reg Z §1026.23 ───────
    elements.append(Paragraph(f"{sec}. {_t('right_to_cancel_title', lang)}", styles['SectionTitle']))

    # Prominent cancellation notice box
    cancel_content = []
    cancel_content.append(Paragraph(_t('right_to_cancel_text_1', lang), ParagraphStyle(
        'CancelText', parent=styles['BodyJustify'], fontSize=10, leading=14,
    )))
    cancel_content.append(Spacer(1, 6))
    cancel_content.append(Paragraph(_t('right_to_cancel_text_2', lang), ParagraphStyle(
        'CancelText2', parent=styles['BodyJustify'], fontSize=10, leading=14,
    )))
    cancel_content.append(Spacer(1, 6))
    cancel_content.append(Paragraph(_t('right_to_cancel_text_3', lang), ParagraphStyle(
        'CancelText3', parent=styles['BodyJustify'], fontSize=10, leading=14,
    )))
    cancel_content.append(Spacer(1, 6))
    cancel_content.append(Paragraph(_t('right_to_cancel_text_4', lang), ParagraphStyle(
        'CancelText4', parent=styles['BodyJustify'], fontSize=10, leading=14,
    )))

    # Compute the 3-business-day cancellation deadline
    loan_sign_date = loan.get('application_date') or loan.get('created_at') or datetime.now()
    cancel_deadline = _compute_cancellation_deadline(loan_sign_date)
    cancel_deadline_str = format_date(cancel_deadline, lang)

    cancel_content.append(Spacer(1, 10))
    deadline_text = _t('right_to_cancel_deadline', lang).format(deadline_date=cancel_deadline_str)
    cancel_content.append(Paragraph(
        f"<b>{deadline_text}</b>",
        ParagraphStyle('CancelDeadline', parent=styles['BodyJustify'], fontSize=12,
                       textColor=colors.HexColor('#b91c1c'), alignment=TA_CENTER, leading=16)
    ))

    # Wrap in a prominent bordered box
    cancel_box = [[cancel_content]]
    cancel_table = Table(cancel_box, colWidths=[480])
    cancel_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffbeb')),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#f59e0b')),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    elements.append(cancel_table)
    elements.append(Spacer(1, 8))

    # Acknowledgment line and legal reference
    elements.append(Paragraph(_t('right_to_cancel_ack', lang), styles['BodyJustify']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"<i>{_t('right_to_cancel_ref', lang)}</i>",
        ParagraphStyle('CancelRef', parent=styles['SmallText'], fontSize=8,
                       textColor=colors.HexColor('#666666'), leading=10)
    ))

    # Borrower acknowledgment signature line for Right to Cancel
    elements.append(Spacer(1, 16))
    cancel_sig_data = [
        ['_' * 40, '', f'{_t("date", lang)}: _______________'],
        [_t('borrower_signature', lang), '', ''],
    ]
    cancel_sig_table = Table(cancel_sig_data, colWidths=[220, 60, 200])
    cancel_sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(cancel_sig_table)

    # ─── Signatures ─────────────────────────────────────
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc')))
    elements.append(Spacer(1, 20))

    # Check if loan has a digital signature
    sig = loan.get('signature')
    has_signature_image = False
    if sig and sig.get('image_data'):
        # Render embedded signature image
        try:
            from reportlab.platypus import Image as RLImage
            sig_img_data = sig['image_data']
            if sig_img_data.startswith('data:'):
                sig_img_data = sig_img_data.split(',', 1)[1]
            sig_bytes = base64.b64decode(sig_img_data)
            sig_buffer = io.BytesIO(sig_bytes)
            sig_image = RLImage(sig_buffer, width=200, height=70)

            signed_at = sig.get('signed_at', '')
            if isinstance(signed_at, str) and signed_at:
                try:
                    signed_dt = datetime.fromisoformat(signed_at.replace('Z', '+00:00'))
                    signed_date_str = format_date(signed_dt, lang)
                except Exception:
                    signed_date_str = signed_at
            elif hasattr(signed_at, 'strftime'):
                signed_date_str = format_date(signed_at, lang)
            else:
                signed_date_str = format_date(datetime.now(), lang)

            sig_type_label = 'Topaz Pad' if sig.get('type') == 'topaz' else 'Digital'
            sig_hash = sig.get('hash', '')[:12]
            has_signature_image = True
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error rendering signature image: {e}")
            has_signature_image = False

    # Build signature section
    elements.append(Paragraph(_t('section_signatures', lang), styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    if has_signature_image:
        # Signature image on borrower side, blank line on lender side
        sig_data = [
            [sig_image, '', '_' * 40],
            [f'{_t("borrower_signature", lang)} ({sig_type_label})', '', _t('lender_signature', lang)],
            [loan.get('client_name', ''), '', 'Ross Lending Solutions LLC'],
            [f'{_t("date", lang)}: {signed_date_str}', '', f'{_t("date", lang)}: {signed_date_str}'],
            [f'Hash: {sig_hash}...', '', ''],
        ]
    else:
        sig_data = [
            ['_' * 40, '', '_' * 40],
            [_t('borrower_signature', lang), '', _t('lender_signature', lang)],
            [loan.get('client_name', ''), '', 'Ross Lending Solutions LLC'],
            ['', '', ''],
            [f'{_t("date", lang)}: _______________', '', f'{_t("date", lang)}: _______________'],
        ]

    t = Table(sig_data, colWidths=[200, 80, 200])
    sig_table_style = [
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 2), (-1, 2), 9),
        ('TEXTCOLOR', (0, 2), (-1, 2), colors.HexColor('#666666')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    if has_signature_image:
        # Add a border around the signature image cell for clarity
        sig_table_style.append(('BOX', (0, 0), (0, 0), 0.5, colors.HexColor('#cccccc')))
        sig_table_style.append(('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#fafafa')))
    t.setStyle(TableStyle(sig_table_style))
    elements.append(t)

    # ─── Footer ─────────────────────────────────────────
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#dddddd')))
    elements.append(Paragraph(
        _t('footer_generated', lang).format(date=format_date(datetime.now(), lang)) + ' ' +
        _t('footer_company', lang),
        styles['FooterText']
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return base64.b64encode(pdf_bytes).decode('utf-8')


def generate_payment_receipt_pdf(loan: dict, payment: dict, lang: str = 'en') -> str:
    """
    Generate a payment receipt PDF.
    Args:
        loan: Loan data dictionary
        payment: Payment data dictionary
        lang: Language code ('en' for English, 'es' for Spanish). Default: 'en'
    Returns:
        base64-encoded PDF string.
    """
    if lang not in ('en', 'es'):
        lang = 'en'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=60, leftMargin=60,
        topMargin=50, bottomMargin=50,
    )
    styles = _get_styles()
    elements = []

    # ─── Header ─────────────────────────────────────────
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", styles['CompanyName']))
    elements.append(Paragraph("305 Bruce Ave, Dumas TX 79029 · (806) 934-2018 · info@rosslending.com", styles['SmallText']))
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0D4F3C')))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(_t('receipt_title', lang), styles['DocTitle']))
    elements.append(Spacer(1, 8))

    # ─── Payment Info ───────────────────────────────────
    pay_methods = _t('pay_methods', lang)

    info_data = [
        [_t('receipt_loan', lang), loan.get('loan_number', 'N/A')],
        [_t('receipt_client', lang), loan.get('client_name', 'N/A')],
        [_t('receipt_payment_num', lang), str(payment.get('payment_number', ''))],
        [_t('receipt_payment_date', lang), format_date(payment.get('payment_date', datetime.now()), lang)],
        [_t('receipt_method', lang), pay_methods.get(payment.get('payment_method', ''), payment.get('payment_method', ''))],
    ]

    t = Table(info_data, colWidths=[130, 350])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 16))

    # ─── Payment Breakdown ──────────────────────────────
    breakdown_data = [
        [_t('receipt_item', lang), _t('receipt_amount', lang)],
        [_t('receipt_principal_payment', lang), format_currency(payment.get('principal_portion', 0))],
        [_t('receipt_interest', lang), format_currency(payment.get('interest_portion', 0))],
    ]
    if payment.get('fee_portion', 0) > 0 or payment.get('late_fee', 0) > 0:
        breakdown_data.append([_t('receipt_late_fee', lang), format_currency(payment.get('late_fee', payment.get('fee_portion', 0)))])
    breakdown_data.append([_t('receipt_total_paid', lang), format_currency(payment.get('amount', 0))])

    t = Table(breakdown_data, colWidths=[300, 180])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0D4F3C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('FONTSIZE', (0, -1), (-1, -1), 13),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 16))

    # ─── Loan Summary After Payment ─────────────────────
    elements.append(Paragraph(_t('receipt_loan_status', lang), styles['SectionTitle']))

    balance = loan.get('balance', 0)
    summary_data = [
        [_t('receipt_original_amount', lang), format_currency(loan.get('amount', 0))],
        [_t('receipt_accumulated_principal', lang), format_currency(loan.get('principal_paid', 0))],
        [_t('receipt_accumulated_interest', lang), format_currency(loan.get('interest_paid', 0))],
        [_t('receipt_outstanding_balance', lang), format_currency(balance)],
    ]

    t = Table(summary_data, colWidths=[250, 230])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 13),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#0D4F3C')),
    ]))
    elements.append(t)

    if balance <= 0:
        elements.append(Spacer(1, 16))
        elements.append(Paragraph(
            _t('receipt_fully_paid', lang),
            ParagraphStyle('PaidOff', parent=styles['Title'], fontSize=16, textColor=colors.HexColor('#0D4F3C'), alignment=TA_CENTER)
        ))

    # ─── Notes ──────────────────────────────────────────
    if payment.get('notes'):
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"<b>{_t('receipt_notes', lang)}</b> {payment['notes']}", styles['BodyJustify']))

    # ─── Footer ─────────────────────────────────────────
    elements.append(Spacer(1, 40))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#dddddd')))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        _t('receipt_footer', lang).format(date=format_date(datetime.now(), lang)),
        styles['FooterText']
    ))
    elements.append(Paragraph(
        _t('footer_company', lang),
        styles['FooterText']
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return base64.b64encode(pdf_bytes).decode('utf-8')
