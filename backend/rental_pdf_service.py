"""
Rental Contract PDF Service — Ross House Rentals LLC
=====================================================
Texas Property Code Chapter 92 & 24 Compliant
Bilingual (EN/ES) Professional Lease Agreement Generator
61 Sections + 13 Addenda (A-M) - Maximum Legal Protection
Property Management Grade - Commercial Ready

CORRECTED VERSION:
- All example data removed (fillable fields only)
- Joint and Several Liability clause added
- Pet Fee (not deposit) language
- Jury trial waiver removed
- Abandonment clause compliant with TX law
- Lead-Based Paint full disclosure (pre-1978)
- Flood Disclosure Addendum added
- Surrender of Possession clause added
- Late fee cap at $100
- Inspection photos clause added
- Keys/remotes/access devices clause added
- Full compliance: TX Prop Code 92 & 24, SCRA, FHA, ADA
"""
import io
import os
import base64
import logging
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, ListFlowable, ListItem,
    Image as RLImage
)

logger = logging.getLogger(__name__)

# ─── Default Company Configuration ───────────────────────────────
DEFAULT_COMPANY = {
    "name": "Ross House Rentals LLC",
    "address": "305 Bruce Ave, Dumas, TX 79029",
    "phone": "(806) 934-2018",
    "email": "info@rosshouserentals.com",
    "website": "www.rosshouserentals.com",
    "state": "Texas",
    "county": "Moore",
}

# ─── Color Palette ────────────────────────────────────────────────
BRAND_RED = colors.HexColor('#ED1B33')
BRAND_CHARCOAL = colors.HexColor('#231F20')
NAVY = colors.HexColor('#1E3A5F')
BLUE = colors.HexColor('#2b6cb0')
LIGHT_BLUE = colors.HexColor('#ebf4ff')
DARK_GRAY = colors.HexColor('#231F20')
GRAY = colors.HexColor('#4a5568')
LIGHT_GRAY = colors.HexColor('#f7fafc')
BORDER_GRAY = colors.HexColor('#cbd5e0')
MUTED_GRAY = colors.HexColor('#718096')
AMBER = colors.HexColor('#92400e')
RED = colors.HexColor('#ED1B33')
GREEN = colors.HexColor('#276749')

# Fillable field placeholder
BLANK = '_' * 25
BLANK_SHORT = '_' * 15
BLANK_LONG = '_' * 40


def _get_logo_path():
    """Find Ross House Rentals logo in assets folder"""
    base = os.path.dirname(os.path.abspath(__file__))
    for name in ['ross_house_logo.png', 'company_logo.png', 'ross_logo.png']:
        path = os.path.join(base, 'assets', name)
        if os.path.exists(path):
            return path
    memory_path = '/app/memory/ross_house_logo.png'
    if os.path.exists(memory_path):
        return memory_path
    return None


def _build_styles():
    """Build all PDF styles"""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='DocTitle', fontName='Helvetica-Bold', fontSize=13,
        textColor=BRAND_CHARCOAL, spaceAfter=2, alignment=TA_CENTER, leading=16
    ))
    styles.add(ParagraphStyle(
        name='DocSubtitle', fontName='Helvetica', fontSize=9,
        textColor=GRAY, spaceAfter=2, alignment=TA_CENTER, leading=12
    ))
    styles.add(ParagraphStyle(
        name='CompanyInfo', fontName='Helvetica', fontSize=7.5,
        textColor=GRAY, spaceAfter=1, alignment=TA_CENTER, leading=10
    ))
    styles.add(ParagraphStyle(
        name='SectionNum', fontName='Helvetica-Bold', fontSize=9,
        textColor=NAVY, spaceBefore=8, spaceAfter=3, leading=12
    ))
    styles.add(ParagraphStyle(
        name='SubSection', fontName='Helvetica-Bold', fontSize=8,
        textColor=DARK_GRAY, spaceBefore=5, spaceAfter=2, leading=10
    ))
    styles.add(ParagraphStyle(
        name='Body', fontName='Helvetica', fontSize=7.5,
        textColor=DARK_GRAY, leading=10, alignment=TA_JUSTIFY, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name='BodyBold', fontName='Helvetica-Bold', fontSize=7.5,
        textColor=DARK_GRAY, leading=10, alignment=TA_JUSTIFY, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name='BodySmall', fontName='Helvetica', fontSize=6.5,
        textColor=GRAY, leading=8.5, alignment=TA_JUSTIFY, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name='LegalRef', fontName='Helvetica-Oblique', fontSize=6,
        textColor=MUTED_GRAY, leading=8, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name='Footer', fontName='Helvetica', fontSize=6,
        textColor=MUTED_GRAY, leading=8
    ))
    styles.add(ParagraphStyle(
        name='Warning', fontName='Helvetica-Bold', fontSize=7.5,
        textColor=RED, leading=10, spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name='AddendumTitle', fontName='Helvetica-Bold', fontSize=10,
        textColor=NAVY, spaceBefore=6, spaceAfter=4, alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='InitialLine', fontName='Helvetica', fontSize=7,
        textColor=DARK_GRAY, leading=9, spaceBefore=3, spaceAfter=2
    ))
    return styles


def format_currency(amount):
    try:
        return f"${float(amount):,.2f}"
    except Exception:
        return "$0.00"


def _number_to_words(n):
    """Simple number to English words for amounts"""
    ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
            'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
            'seventeen', 'eighteen', 'nineteen']
    tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    try:
        n = int(float(n))
        if n < 20:
            return ones[n]
        if n < 100:
            return tens[n // 10] + ('' if n % 10 == 0 else '-' + ones[n % 10])
        if n < 1000:
            return ones[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + _number_to_words(n % 100))
        if n < 10000:
            return _number_to_words(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + _number_to_words(n % 1000))
        return str(n)
    except Exception:
        return str(n)


def _get_value_or_blank(contract, key, blank=BLANK):
    """Get value from contract or return blank field"""
    val = contract.get(key)
    if val and str(val).strip() and str(val).strip() != 'N/A':
        return str(val)
    return blank


# ═══════════════════════════════════════════════════════════════════════════
# MAIN CONTRACT GENERATOR - 56 SECTIONS + 9 ADDENDA
# PROPERTY MANAGEMENT GRADE - COMMERCIAL READY
# ═══════════════════════════════════════════════════════════════════════════

def generate_rental_contract_pdf(contract: dict, config: dict = None, tenant: dict = None) -> str:
    """
    Generate a comprehensive Texas-compliant bilingual lease agreement PDF.
    Property Management Grade with maximum legal protection.
    Returns base64-encoded PDF string.
    
    Args:
        contract: Contract data dict
        config: Company configuration dict
        tenant: Tenant data dict with occupants, vehicles, emergency_contacts, etc.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.35 * inch, bottomMargin=0.4 * inch,
        leftMargin=0.55 * inch, rightMargin=0.55 * inch
    )
    
    styles = _build_styles()
    elements = []
    
    # Merge config with defaults
    co = {**DEFAULT_COMPANY}
    if config:
        for k in ['name', 'address', 'phone', 'email', 'website', 'state', 'county']:
            if config.get(k):
                co[k] = config[k]
    
    # Tenant data with defaults
    tenant = tenant or {}
    
    # Contract data with defaults - USE BLANKS for fillable fields
    rent = float(contract.get('rent_amount', 0)) if contract.get('rent_amount') else 0
    deposit = float(contract.get('deposit_amount', rent)) if contract.get('deposit_amount') else rent
    due_day = int(contract.get('payment_due_day', 1))
    late_fee = float(contract.get('late_fee_amount', 50))
    grace_days = int(contract.get('late_fee_grace_days', 5))
    nsf_fee = float(contract.get('nsf_fee', 35))
    late_fee_cap = float(contract.get('late_fee_cap', 100))  # Maximum late fees per month
    
    # Dates - use blanks if not provided
    start_date = _get_value_or_blank(contract, 'start_date', BLANK_SHORT)
    end_date = _get_value_or_blank(contract, 'end_date', BLANK_SHORT)
    execution_date = _get_value_or_blank(contract, 'execution_date', BLANK_SHORT)
    
    # Tenant info - from tenant dict or contract fallback
    tenant_name = tenant.get('name') or tenant.get('first_name', '') + ' ' + tenant.get('last_name', '') or _get_value_or_blank(contract, 'tenant_name', BLANK_LONG)
    tenant_name = tenant_name.strip() if tenant_name.strip() else BLANK_LONG
    tenant_address = tenant.get('current_address') or _get_value_or_blank(contract, 'tenant_address', BLANK_LONG)
    tenant_phone = tenant.get('phone') or _get_value_or_blank(contract, 'tenant_phone', BLANK_SHORT)
    tenant_email = tenant.get('email') or _get_value_or_blank(contract, 'tenant_email', BLANK)
    
    # Additional tenant data
    tenant_ssn_last4 = tenant.get('ssn_last4', '____')
    tenant_dob = tenant.get('date_of_birth', BLANK_SHORT)
    tenant_employer = tenant.get('employer', BLANK)
    tenant_employer_phone = tenant.get('employer_phone', BLANK_SHORT)
    tenant_monthly_income = tenant.get('monthly_income', 0)
    
    # Arrays from tenant
    tenant_occupants = tenant.get('occupants', [])
    tenant_vehicles = tenant.get('vehicles', [])
    tenant_emergency_contacts = tenant.get('emergency_contacts', [])
    tenant_pets = tenant.get('pets', [])
    
    # Insurance info
    tenant_insurance_company = tenant.get('insurance_company', BLANK)
    tenant_insurance_policy = tenant.get('insurance_policy_number', BLANK_SHORT)
    tenant_insurance_coverage = tenant.get('insurance_coverage', 0)
    
    # Property info
    property_address = _get_value_or_blank(contract, 'property_address', BLANK_LONG)
    
    # Addendum flags
    addendums = contract.get('addendums', {})
    pets_allowed = addendums.get('pets', False)
    pet_details = addendums.get('pet_details', {})
    lead_paint = addendums.get('lead_paint', False)  # Pre-1978 property
    flood_zone = addendums.get('flood_zone', False)  # FEMA flood zone
    
    # ═══════════════════════════════════════════════════════════════════
    # HEADER WITH LOGO
    # ═══════════════════════════════════════════════════════════════════
    logo_path = _get_logo_path()
    if logo_path:
        try:
            logo = RLImage(logo_path, width=2 * inch, height=0.87 * inch)
            logo.hAlign = 'CENTER'
            header_data = [
                [logo],
                [Paragraph(f"{co['address']}  •  {co['phone']}  •  {co['email']}", styles['CompanyInfo'])],
            ]
            ht = Table(header_data, colWidths=[480])
            ht.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
            elements.append(ht)
        except Exception as e:
            logger.warning(f"Could not load logo: {e}")
            elements.append(Paragraph(co['name'].upper(), styles['DocTitle']))
    else:
        elements.append(Paragraph(co['name'].upper(), styles['DocTitle']))
        elements.append(Paragraph(f"{co['address']}  •  {co['phone']}  •  {co['email']}", styles['CompanyInfo']))
    
    elements.append(Spacer(1, 3))
    elements.append(HRFlowable(width="100%", thickness=2, color=BRAND_RED))
    elements.append(Spacer(1, 2))
    
    # ═══════════════════════════════════════════════════════════════════
    # TITLE
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Paragraph(
        "RESIDENTIAL LEASE AGREEMENT / CONTRATO DE ARRENDAMIENTO RESIDENCIAL",
        styles['DocTitle']
    ))
    contract_num = _get_value_or_blank(contract, 'contract_number', 'RHR-YYYY-####')
    elements.append(Paragraph(
        f"Contract Number / Número de Contrato: <b>{contract_num}</b>",
        styles['DocSubtitle']
    ))
    elements.append(Paragraph(
        f"Execution Date / Fecha de Ejecución: <b>{execution_date}</b>",
        styles['DocSubtitle']
    ))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 3))
    
    # Legal Notice
    elements.append(Paragraph(
        "<i>This lease is governed by Texas Property Code Chapters 92 and 24, Fair Housing Act, and ADA. "
        "Both English and Spanish versions provided; English prevails in conflicts. / Este contrato se rige por "
        "el Código de Propiedad de Texas Capítulos 92 y 24, Ley de Vivienda Justa, y ADA. En caso de conflicto, "
        "prevalece la versión en inglés.</i>",
        styles['BodySmall']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 1: PARTIES / PARTES
    # ═══════════════════════════════════════════════════════════════════
    section = 1
    elements.append(Paragraph(f"<b>{section}. PARTIES / PARTES DEL CONTRATO</b>", styles['SectionNum']))
    
    parties_data = [
        ['LANDLORD / ARRENDADOR', 'TENANT / ARRENDATARIO'],
        [co['name'], tenant_name],
        [co['address'], tenant_address],
        [f"Phone: {co['phone']}", f"Phone: {tenant_phone}"],
        [f"Email: {co['email']}", f"Email: {tenant_email}"],
    ]
    t = Table(parties_data, colWidths=[235, 235])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 2: JOINT AND SEVERAL LIABILITY (NEW)
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. JOINT AND SEVERAL LIABILITY / RESPONSABILIDAD SOLIDARIA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>All tenants and occupants signing this lease shall be jointly and severally liable for all obligations "
        "under this lease, including rent, damages, fees, utilities, attorney fees, and any other amounts due.</b> "
        "Each tenant is individually responsible for the full amount owed, regardless of any agreements between co-tenants.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>Todos los inquilinos y ocupantes que firmen este contrato serán responsables solidariamente de todas las "
        "obligaciones bajo este contrato, incluyendo renta, daños, cargos, servicios públicos, honorarios de abogado "
        "y cualquier otra cantidad adeudada.</b> Cada inquilino es individualmente responsable del monto total adeudado.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 3: PROPERTY DESCRIPTION
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. PROPERTY DESCRIPTION / DESCRIPCIÓN DE LA PROPIEDAD</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord leases to Tenant the residential property described below:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "El Arrendador arrienda al Arrendatario la propiedad residencial descrita a continuación:",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # Property Address fields - fully fillable
    prop_address_data = [
        ['Property Address / Dirección:', BLANK_LONG],
        ['City / Ciudad:', BLANK],
        ['County / Condado:', BLANK],
        ['State / Estado:', 'Texas'],
        ['Zip Code / Código Postal:', BLANK_SHORT],
    ]
    pa_table = Table(prop_address_data, colWidths=[150, 280])
    pa_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(pa_table)
    elements.append(Spacer(1, 4))
    
    # Property details table - fillable
    bedrooms = _get_value_or_blank(contract, 'bedrooms', BLANK_SHORT)
    bathrooms = _get_value_or_blank(contract, 'bathrooms', BLANK_SHORT)
    garage = _get_value_or_blank(contract, 'garage', BLANK_SHORT)
    sq_ft = _get_value_or_blank(contract, 'sq_ft', BLANK_SHORT)
    year_built = _get_value_or_blank(contract, 'year_built', BLANK_SHORT)
    
    prop_details_data = [
        ['Property Details / Detalles de la Propiedad', ''],
        ['Bedrooms / Recámaras:', bedrooms],
        ['Bathrooms / Baños:', bathrooms],
        ['Garage / Garaje:', garage],
        ['Square Feet / Pies Cuadrados:', sq_ft],
        ['Year Built / Año de Construcción:', year_built],
    ]
    pd_table = Table(prop_details_data, colWidths=[180, 250])
    pd_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, 1), (0, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('SPAN', (0, 0), (1, 0)),
    ]))
    elements.append(pd_table)
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 4: LEASE TERM
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. LEASE TERM / PLAZO DEL ARRENDAMIENTO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"<b>Lease Start Date / Fecha de Inicio:</b> {start_date}  |  <b>Lease End Date / Fecha de Término:</b> {end_date}",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Upon expiration, this lease shall automatically convert to a month-to-month tenancy at the same rental rate "
        "unless either party provides <b>30 days written notice</b> of intent to terminate or modify terms.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 5: RENT AND PAYMENT
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. RENT AND PAYMENT PROVISIONS / RENTA Y PAGOS</b>", styles['SectionNum']))
    
    rent_display = format_currency(rent) if rent > 0 else BLANK_SHORT
    deposit_display = format_currency(deposit) if deposit > 0 else BLANK_SHORT
    
    terms_data = [
        ['Concept / Concepto', 'Amount / Monto'],
        ['Monthly Rent / Renta Mensual', rent_display],
        ['Security Deposit / Depósito de Seguridad', deposit_display],
        ['Due Date / Fecha de Vencimiento', f"Day {due_day} of each month / Día {due_day} de cada mes"],
        ['Grace Period / Período de Gracia', f"{grace_days} calendar days / días calendario"],
        ['Late Fee / Cargo por Mora', f"{format_currency(late_fee)} (after grace period)"],
        ['Maximum Late Fees / Máximo Cargos por Mora', f"{format_currency(late_fee_cap)} per month / por mes"],
        ['NSF/Returned Check Fee / Cheque Rechazado', format_currency(nsf_fee)],
        ['Accepted Payment Methods', 'ACH Debit, Online Portal, Certified Funds'],
    ]
    t = Table(terms_data, colWidths=[200, 270])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, 1), (0, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 6: LATE FEES (TX Prop Code §92.019 Compliant)
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. LATE FEES / CARGOS POR MORA (TX Prop. Code §92.019)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"If rent is not received by the <b>{due_day + grace_days}th day</b> of the month, a late fee of "
        f"<b>{format_currency(late_fee)}</b> will be assessed. Additional daily late fees of <b>$5.00</b> per day "
        f"may be charged. <b>Total late fees shall not exceed {format_currency(late_fee_cap)} per month</b> in "
        f"compliance with Texas Property Code §92.019.",
        styles['Body']
    ))
    elements.append(Paragraph(
        f"Si la renta no se recibe antes del <b>día {due_day + grace_days}</b>, se cobrará un cargo por mora de "
        f"<b>{format_currency(late_fee)}</b>. Cargos adicionales de <b>$5.00/día</b> pueden aplicar. "
        f"<b>El total de cargos por mora no excederá {format_currency(late_fee_cap)} por mes</b>.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 7: NSF FEES
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. RETURNED PAYMENT FEES (NSF) / CARGOS POR CHEQUES RECHAZADOS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"If any payment is returned for insufficient funds, Tenant shall pay <b>{format_currency(nsf_fee)}</b> "
        f"plus any bank charges. After one returned payment, Landlord may require certified funds only.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 8: SECURITY DEPOSIT
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. SECURITY DEPOSIT / DEPÓSITO DE SEGURIDAD (TX Prop. Code §92.101-§92.109)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"Tenant shall pay a security deposit of <b>{deposit_display}</b>. Per Texas Property Code §92.103, "
        f"the deposit shall be refunded within <b>30 days</b> after Tenant surrenders the premises, less lawful "
        f"deductions. Tenant must provide a forwarding address in writing. Landlord's obligation to refund does "
        f"not begin until Tenant provides the forwarding address. (§92.107)",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 9: AUTHORIZED OCCUPANTS (Fillable)
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. AUTHORIZED OCCUPANTS / OCUPANTES AUTORIZADOS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Only the following persons are authorized to reside in the premises. Unauthorized occupants are grounds "
        "for lease termination. / Solo las siguientes personas están autorizadas. Ocupantes no autorizados son "
        "causa de terminación del contrato.",
        styles['Body']
    ))
    
    occ_header = ['Full Name / Nombre', 'Relationship', 'Date of Birth', 'DL/ID Number']
    occ_rows = [occ_header]
    
    # Fill with tenant occupants data if available
    if tenant_occupants:
        for occ in tenant_occupants[:4]:  # Max 4 occupants
            occ_rows.append([
                occ.get('name', BLANK),
                occ.get('relationship', BLANK_SHORT),
                occ.get('date_of_birth', BLANK_SHORT) or occ.get('age', BLANK_SHORT),
                occ.get('id_number', BLANK_SHORT)
            ])
        # Fill remaining rows with blanks
        for _ in range(4 - len(tenant_occupants)):
            occ_rows.append([BLANK, BLANK_SHORT, BLANK_SHORT, BLANK_SHORT])
    else:
        for i in range(4):
            occ_rows.append([BLANK, BLANK_SHORT, BLANK_SHORT, BLANK_SHORT])
    
    ot = Table(occ_rows, colWidths=[140, 100, 80, 100])
    ot.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(ot)
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 10: GUESTS AND OCCUPANCY
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. GUESTS AND OCCUPANCY LIMITS / HUÉSPEDES Y LÍMITES</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Guests may stay for a maximum of <b>7 consecutive days</b> or <b>14 days total</b> in any 30-day period. "
        "Maximum occupancy: <b>2 persons per bedroom plus 1</b>.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTIONS 11-20 (Utilities, Entry, Repairs, Responsibilities, etc.)
    # ═══════════════════════════════════════════════════════════════════
    
    # SECTION 11: UTILITIES
    section += 1
    elements.append(Paragraph(f"<b>{section}. UTILITIES / SERVICIOS PÚBLICOS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Check (☑) the responsible party for each utility:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Marque (☑) la parte responsable de cada servicio:",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    util_data = [
        ['Utility / Servicio', 'Landlord / Arrendador', 'Tenant / Arrendatario'],
        ['Electricity / Electricidad', '☐', '☐'],
        ['Gas / Gas', '☐', '☐'],
        ['Water / Agua', '☐', '☐'],
        ['Sewer / Alcantarillado', '☐', '☐'],
        ['Trash / Basura', '☐', '☐'],
        ['Internet / Internet', '☐', '☐'],
        ['Lawn Care / Jardinería', '☐', '☐'],
    ]
    ut = Table(util_data, colWidths=[160, 120, 120])
    ut.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, 1), (0, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(ut)
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "<b>Tenant shall transfer utilities within 3 days of move-in.</b> / El Inquilino transferirá servicios dentro de 3 días.",
        styles['BodySmall']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 12: RIGHT OF ENTRY
    section += 1
    elements.append(Paragraph(f"<b>{section}. LANDLORD'S RIGHT OF ENTRY / DERECHO DE ENTRADA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord may enter with <b>24 hours' notice</b> for inspections, repairs, or showing to prospective tenants. "
        "No notice required for emergencies.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 13: REPAIRS
    section += 1
    elements.append(Paragraph(f"<b>{section}. REPAIRS AND MAINTENANCE / REPARACIONES (TX Prop. Code §92.056)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant shall promptly notify Landlord in writing of needed repairs. Landlord shall make repairs within "
        "a reasonable time. Tenant is responsible for repairs caused by Tenant's negligence.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 14: TENANT RESPONSIBILITIES
    section += 1
    elements.append(Paragraph(f"<b>{section}. TENANT RESPONSIBILITIES / RESPONSABILIDADES DEL ARRENDATARIO</b>", styles['SectionNum']))
    tenant_resp = [
        "Pay rent on time / Pagar renta a tiempo",
        "Keep premises clean / Mantener limpio",
        "Report maintenance issues promptly / Reportar problemas de mantenimiento",
        "Not damage property / No dañar la propiedad",
        "Comply with all laws / Cumplir con todas las leyes",
        "Allow Landlord access with notice / Permitir acceso con aviso",
    ]
    for resp in tenant_resp:
        elements.append(Paragraph(f"  • {resp}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # SECTION 15: LANDLORD RESPONSIBILITIES
    section += 1
    elements.append(Paragraph(f"<b>{section}. LANDLORD RESPONSIBILITIES / RESPONSABILIDADES DEL ARRENDADOR (TX §92.051-§92.061)</b>", styles['SectionNum']))
    landlord_resp = [
        "Maintain premises in habitable condition",
        "Make diligent repairs affecting health/safety",
        "Provide and maintain smoke detectors (§92.251)",
        "Provide security devices (§92.151-§92.170)",
        "Not retaliate against Tenant for lawful complaints",
    ]
    for resp in landlord_resp:
        elements.append(Paragraph(f"  • {resp}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # SECTION 16: SMOKE DETECTORS
    section += 1
    elements.append(Paragraph(f"<b>{section}. SMOKE DETECTORS / DETECTORES DE HUMO (TX §92.251-§92.261)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord shall provide working smoke detectors. Tenant shall test monthly, replace batteries, and not disable detectors.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 17: SECURITY DEVICES
    section += 1
    elements.append(Paragraph(f"<b>{section}. SECURITY DEVICES / DISPOSITIVOS DE SEGURIDAD (TX §92.151-§92.170)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord shall provide: window latches, doorknob locks, keyed deadbolts, sliding door pins, and peepholes on exterior doors.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 18: MOLD
    section += 1
    elements.append(Paragraph(f"<b>{section}. MOLD PREVENTION / PREVENCIÓN DE MOHO (TX §92.151-§92.157)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant shall maintain ventilation, use exhaust fans, report leaks immediately, and notify Landlord of any visible mold. See Addendum C.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 19: BED BUGS
    section += 1
    elements.append(Paragraph(f"<b>{section}. BED BUG DISCLOSURE / DIVULGACIÓN DE CHINCHES (TX §92.131-§92.135)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord has no knowledge of bed bug infestation. Tenant shall report suspected activity immediately. See Addendum D.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 20: PET POLICY
    section += 1
    elements.append(Paragraph(f"<b>{section}. PET POLICY / POLÍTICA DE MASCOTAS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "☐ NO PETS ALLOWED without written consent. / NO SE PERMITEN MASCOTAS sin consentimiento escrito.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "☐ PETS ALLOWED subject to Addendum E. <b>Non-Refundable Pet Fee:</b> $_______ per pet. "
        "<b>Monthly Pet Rent:</b> $_______ per pet.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 21: SECURITY CAMERAS
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. SECURITY CAMERAS / CÁMARAS DE SEGURIDAD</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>Tenant acknowledges that exterior security cameras may be installed on the property for security, crime "
        "prevention, maintenance verification, package delivery monitoring, and protection of residents and property.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario reconoce que pueden existir cámaras de seguridad exteriores instaladas en la propiedad para "
        "fines de seguridad, prevención de delitos, verificación de mantenimiento, monitoreo de entregas y protección "
        "de residentes y bienes.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "No cameras shall be installed inside the leased premises or in any area where a person has a reasonable "
        "expectation of privacy.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "No se instalarán cámaras dentro de la vivienda arrendada ni en áreas donde exista una expectativa razonable "
        "de privacidad.",
        styles['Body']
    ))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "<b>Tenant shall not tamper with, disconnect, block, damage, relocate, alter, or interfere with any authorized "
        "security camera system installed by Landlord.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario no podrá manipular, desconectar, bloquear, dañar, mover, alterar o interferir con ningún "
        "sistema de cámaras autorizado por el Arrendador.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "Any damage to security equipment shall be the responsibility of Tenant and may result in repair or replacement charges.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Cualquier daño al equipo de seguridad será responsabilidad del Arrendatario y podrá generar cargos de "
        "reparación o reemplazo.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTION 22: SMART HOME DEVICES
    # ═══════════════════════════════════════════════════════════════════
    section += 1
    elements.append(Paragraph(f"<b>{section}. SMART HOME DEVICES / DISPOSITIVOS INTELIGENTES</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "The following smart home devices, if installed, are the property of Landlord:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Los siguientes dispositivos inteligentes, si están instalados, son propiedad del Arrendador:",
        styles['Body']
    ))
    
    smart_devices = [
        "Smart locks / Cerraduras inteligentes",
        "Smart thermostats / Termostatos inteligentes",
        "Smart garage door openers / Abridores de garaje inteligentes",
        "Smart leak detectors / Detectores de fugas inteligentes",
        "Smart security devices / Dispositivos de seguridad inteligentes",
        "Smart doorbells / Timbres inteligentes",
        "Smart smoke/CO detectors / Detectores de humo/CO inteligentes",
    ]
    for device in smart_devices:
        elements.append(Paragraph(f"  • {device}", styles['BodySmall']))
    
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "<b>Tenant shall not modify, remove, disable, or alter any smart home device without written authorization "
        "from Landlord.</b> Tenant shall notify Landlord immediately of any malfunction.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario no podrá modificar, remover, desactivar o alterar ningún dispositivo inteligente sin "
        "autorización escrita del Arrendador.</b> El Arrendatario notificará inmediatamente al Arrendador de cualquier mal funcionamiento.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # PAGE BREAK
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTIONS 23-37 (Renumbered from 21-35)
    # ═══════════════════════════════════════════════════════════════════
    
    # SECTION 23: SERVICE ANIMALS (was 21)
    section += 1
    elements.append(Paragraph(f"<b>{section}. SERVICE ANIMALS AND ASSISTANCE ANIMALS (Fair Housing Act / ADA)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord will make reasonable accommodations for verified service animals and assistance animals as required "
        "by the Fair Housing Act and ADA. Pet fees do not apply to verified service/assistance animals. Documentation "
        "from a licensed healthcare provider may be required.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 22: PROHIBITED ACTIVITIES
    section += 1
    elements.append(Paragraph(f"<b>{section}. PROHIBITED ACTIVITIES / ACTIVIDADES PROHIBIDAS</b>", styles['SectionNum']))
    prohibited = [
        "Illegal activities / Actividades ilegales",
        "Subletting without consent / Subarrendar sin consentimiento",
        "Operating business without approval / Operar negocio sin aprobación",
        "Excessive noise / Ruido excesivo",
        "Storing hazardous materials / Almacenar materiales peligrosos",
        "Smoking inside premises / Fumar dentro de la propiedad",
    ]
    for item in prohibited:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # SECTION 23: CRIMINAL ACTIVITY
    section += 1
    elements.append(Paragraph(f"<b>{section}. CRIMINAL ACTIVITY CLAUSE / CLÁUSULA DE ACTIVIDAD CRIMINAL</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Any criminal activity by Tenant, household members, or guests on or near the premises is grounds for "
        "<b>immediate lease termination</b> under Texas Property Code §24.005.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 24: ILLEGAL DRUG ACTIVITY
    section += 1
    elements.append(Paragraph(f"<b>{section}. ILLEGAL DRUG ACTIVITY / ACTIVIDAD DE DROGAS ILEGALES</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Manufacture, sale, distribution, possession, or use of controlled substances on the premises is prohibited "
        "and grounds for immediate termination. Tenant is liable for remediation costs.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 25: PROPERTY CONDITION
    section += 1
    elements.append(Paragraph(f"<b>{section}. PROPERTY CONDITION / CONDICIÓN DE LA PROPIEDAD</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant acknowledges receiving the premises in good condition except as noted in Move-In Inspection (Addendum A). "
        "Tenant shall maintain premises in same condition, reasonable wear and tear excepted.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 26: MOVE-IN INSPECTION
    section += 1
    elements.append(Paragraph(f"<b>{section}. MOVE-IN INSPECTION / INSPECCIÓN DE ENTRADA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord and Tenant shall conduct joint inspection and complete Addendum A (Move-In/Move-Out Checklist). "
        "If Tenant fails to participate, Landlord's inspection is conclusive.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 27: MOVE-OUT INSPECTION
    section += 1
    elements.append(Paragraph(f"<b>{section}. MOVE-OUT INSPECTION / INSPECCIÓN DE SALIDA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Upon termination, Landlord and Tenant shall conduct final inspection. Damages beyond normal wear will be "
        "deducted from security deposit. Landlord shall provide itemized statement within 30 days.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 28: INSPECTION PHOTOS (NEW)
    section += 1
    elements.append(Paragraph(f"<b>{section}. INSPECTION PHOTOS AND DOCUMENTATION / FOTOS DE INSPECCIÓN</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>Photos and videos taken during move-in and move-out inspections may be used as evidence regarding the "
        "condition of the premises.</b> Both parties acknowledge and consent to such documentation.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>Las fotos y videos tomados durante las inspecciones de entrada y salida pueden usarse como evidencia "
        "respecto a la condición de la propiedad.</b> Ambas partes reconocen y consienten dicha documentación.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 29: CLEANING REQUIREMENTS
    section += 1
    elements.append(Paragraph(f"<b>{section}. CLEANING REQUIREMENTS / REQUISITOS DE LIMPIEZA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Upon move-out, Tenant shall: remove all belongings and trash; clean all rooms, appliances, and fixtures; "
        "ensure premises are free of odors. Professional carpet cleaning may be required if carpets are soiled.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 30: LAWN AND LANDSCAPING
    section += 1
    elements.append(Paragraph(f"<b>{section}. LAWN AND LANDSCAPING / MANTENIMIENTO DE JARDÍN</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If Tenant is responsible for lawn care: mow weekly during growing season, water adequately, trim shrubs, "
        "remove weeds, keep walkways clear.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 31: PARKING
    section += 1
    elements.append(Paragraph(f"<b>{section}. PARKING RULES / REGLAS DE ESTACIONAMIENTO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Park only in designated areas. No vehicle repairs or oil changes on premises. Vehicles must be operational, "
        "registered, and insured. Unauthorized vehicles may be towed.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 32: VEHICLES (Fillable table)
    section += 1
    elements.append(Paragraph(f"<b>{section}. AUTHORIZED VEHICLES / VEHÍCULOS AUTORIZADOS</b>", styles['SectionNum']))
    veh_header = ['Make/Model', 'Year', 'Color', 'License Plate', 'State']
    veh_rows = [veh_header]
    
    # Fill with tenant vehicles data if available
    if tenant_vehicles:
        for veh in tenant_vehicles[:3]:  # Max 3 vehicles
            make_model = f"{veh.get('make', '')} {veh.get('model', '')}".strip() or BLANK_SHORT
            veh_rows.append([
                make_model,
                veh.get('year', '____'),
                veh.get('color', '______'),
                veh.get('license_plate', BLANK_SHORT),
                veh.get('state', 'TX')
            ])
        # Fill remaining rows with blanks
        for _ in range(3 - len(tenant_vehicles)):
            veh_rows.append([BLANK_SHORT, '____', '______', BLANK_SHORT, '____'])
    else:
        for _ in range(3):
            veh_rows.append([BLANK_SHORT, '____', '______', BLANK_SHORT, '____'])
    
    vt = Table(veh_rows, colWidths=[100, 40, 50, 90, 40])
    vt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(vt)
    elements.append(Spacer(1, 4))
    
    # SECTION 33: TRASH
    section += 1
    elements.append(Paragraph(f"<b>{section}. TRASH DISPOSAL / DISPOSICIÓN DE BASURA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Use designated containers only. Place at curb only on pickup days and remove within 24 hours.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 34: NOISE
    section += 1
    elements.append(Paragraph(f"<b>{section}. NOISE AND NUISANCE / REGLAS DE RUIDO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Quiet hours: 10:00 PM to 8:00 AM. No excessive noise at any time. Violations may result in termination.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 35: HOA
    section += 1
    elements.append(Paragraph(f"<b>{section}. HOA COMPLIANCE / CUMPLIMIENTO CON HOA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If property is subject to HOA, Tenant shall comply with all HOA rules. Tenant is responsible for fines "
        "resulting from Tenant's violations.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTIONS 36-50 (Insurance, Liability, Water, Freeze, etc.)
    # ═══════════════════════════════════════════════════════════════════
    
    # SECTION 36: RENTERS INSURANCE
    section += 1
    elements.append(Paragraph(f"<b>{section}. RENTERS INSURANCE REQUIREMENT / REQUISITO DE SEGURO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>Tenant is required to maintain renters insurance</b> with minimum $100,000 liability and $10,000 personal "
        "property coverage. Tenant shall name Landlord as interested party and provide proof within 7 days of move-in. "
        "See Addendum G.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 37: LIMITATION OF LIABILITY
    section += 1
    elements.append(Paragraph(f"<b>{section}. LIMITATION OF LANDLORD LIABILITY / LIMITACIÓN DE RESPONSABILIDAD</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord shall not be liable for damage, loss, or injury to Tenant or Tenant's property unless caused by "
        "Landlord's gross negligence or willful misconduct.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 38: PERSONAL PROPERTY
    section += 1
    elements.append(Paragraph(f"<b>{section}. TENANT PERSONAL PROPERTY DISCLAIMER / DESCARGO DE PROPIEDAD PERSONAL</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord is not responsible for security or safekeeping of Tenant's personal property. Tenant is strongly "
        "encouraged to obtain renters insurance.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 39: WATER LEAK REPORTING
    section += 1
    elements.append(Paragraph(f"<b>{section}. WATER LEAK REPORTING / REPORTAR FUGAS DE AGUA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant shall <b>immediately report</b> any water leaks, drips, moisture, or standing water. Failure to report "
        "may result in Tenant liability for resulting damage, including mold remediation.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 40: FREEZE PROTECTION (Critical for Texas)
    section += 1
    elements.append(Paragraph(f"<b>{section}. FREEZE PROTECTION REQUIREMENT / PROTECCIÓN CONTRA HELADAS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "During cold weather (below 35°F), Tenant shall: (a) keep thermostat at minimum 55°F; (b) open cabinet doors "
        "under sinks; (c) drip faucets during extreme cold; (d) disconnect garden hoses; (e) protect exterior pipes. "
        "<b>Tenant is liable for freeze damage caused by failure to take these precautions.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 41: PEST CONTROL
    section += 1
    elements.append(Paragraph(f"<b>{section}. PEST CONTROL / CONTROL DE PLAGAS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord shall provide initial pest treatment. Thereafter, Tenant is responsible for routine pest control "
        "unless infestation is beyond Tenant's control.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 42: ABANDONMENT (Corrected per Texas law)
    section += 1
    elements.append(Paragraph(f"<b>{section}. ABANDONMENT OF PROPERTY / ABANDONO DE LA PROPIEDAD</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>Landlord may determine abandonment only as permitted under applicable Texas law and after reasonable "
        "investigation of the circumstances.</b> If Tenant is absent for more than 7 consecutive days without notice "
        "and rent is unpaid, Landlord may consider premises abandoned and may re-let after following all procedures "
        "required by Texas Property Code. Tenant remains liable for rent due through the end of the lease term.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 43: EARLY TERMINATION
    section += 1
    elements.append(Paragraph(f"<b>{section}. EARLY TERMINATION BY TENANT / TERMINACIÓN ANTICIPADA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant may terminate early by: (a) providing 60 days written notice; (b) paying early termination fee equal "
        "to 2 months' rent; (c) remaining responsible for rent until unit is re-rented or 60-day notice period expires.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 44: MILITARY CLAUSE (SCRA)
    section += 1
    elements.append(Paragraph(f"<b>{section}. MILITARY CLAUSE (SCRA) / CLÁUSULA MILITAR (50 U.S.C. §§3911-4043)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Per the Servicemembers Civil Relief Act, if Tenant is or becomes a member of the U.S. Armed Forces and "
        "receives PCS orders, deployment orders of 90+ days, or TDY orders of 90+ days, Tenant may terminate by "
        "delivering written notice with copy of orders. Lease terminates 30 days after next rent due date.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 45: HOLDOVER
    section += 1
    elements.append(Paragraph(f"<b>{section}. HOLDOVER TENANT / ARRENDATARIO QUE SE QUEDA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If Tenant remains after lease expires without Landlord's consent, Tenant shall pay <b>double the monthly rent</b> "
        "for each month of holdover, plus any damages.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 46: DEFAULT
    section += 1
    elements.append(Paragraph(f"<b>{section}. DEFAULT BY TENANT / INCUMPLIMIENTO DEL ARRENDATARIO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Tenant is in default if: rent is not paid when due; Tenant violates any lease term; Tenant abandons premises; "
        "Tenant provided false application information; Tenant or guests engage in criminal activity.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 47: NOTICE TO VACATE
    section += 1
    elements.append(Paragraph(f"<b>{section}. NOTICE TO VACATE / AVISO PARA DESALOJAR (TX Prop. Code §24.005)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Upon default, Landlord may issue 3-day notice for nonpayment or criminal activity, or 30-day notice for "
        "other violations. Notice may be delivered in person, by mail, or posted on inside of main entry door.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 48: EVICTION (Jury waiver removed)
    section += 1
    elements.append(Paragraph(f"<b>{section}. EVICTION RIGHTS / DERECHOS DE DESALOJO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If Tenant fails to vacate after proper notice, Landlord may file forcible detainer action in Justice of "
        "the Peace Court. Tenant shall be liable for all costs of eviction, including reasonable attorney's fees.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 49: ACCELERATION (Corrected with mitigation reference)
    section += 1
    elements.append(Paragraph(f"<b>{section}. ACCELERATION CLAUSE / CLÁUSULA DE ACELERACIÓN</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If Tenant fails to pay rent within 10 days after the due date, Landlord may accelerate the remaining rent "
        "due under this lease, <b>subject to Landlord's duty to mitigate damages as required by Texas Property Code "
        "§91.006</b>. Tenant shall remain liable for any unpaid rent, re-letting costs, damages, and deficiencies "
        "remaining after reasonable mitigation efforts.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Si el Arrendatario no paga la renta dentro de los 10 días posteriores a la fecha de vencimiento, el Arrendador "
        "podrá acelerar las rentas pendientes, <b>sujeto al deber del Arrendador de mitigar daños según el Código de "
        "Propiedad de Texas §91.006</b>. El Arrendatario seguirá siendo responsable por cualquier renta impaga, costos "
        "de re-arrendamiento, daños y diferencias que permanezcan después de los esfuerzos razonables de mitigación.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 50: DUTY TO MITIGATE
    section += 1
    elements.append(Paragraph(f"<b>{section}. DUTY TO MITIGATE DAMAGES / DEBER DE MITIGAR (TX Prop. Code §91.006)</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "If Tenant abandons or is evicted, Landlord has duty to make reasonable efforts to re-let. Tenant remains "
        "liable for: unpaid rent until re-let; reasonable re-letting costs; any rent deficiency.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # PAGE BREAK
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════════════════════════
    # SECTIONS 51-57 (Final sections)
    # ═══════════════════════════════════════════════════════════════════
    
    # SECTION 51: COLLECTIONS
    section += 1
    elements.append(Paragraph(f"<b>{section}. COLLECTIONS AND CREDIT REPORTING / COBRANZAS Y REPORTE DE CRÉDITO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord may report unpaid amounts to credit bureaus and use collection agencies. Tenant authorizes Landlord "
        "to obtain credit reports and share rental history with future landlords or credit agencies.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 52: ATTORNEY FEES (Bilateral - Prevailing Party)
    section += 1
    elements.append(Paragraph(f"<b>{section}. ATTORNEY FEES AND COURT COSTS / HONORARIOS DE ABOGADO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>The prevailing party</b> in any legal action arising out of this lease shall be entitled to recover "
        "reasonable attorney fees, court costs, collection costs, and other litigation expenses allowed by law.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>La parte que prevalezca</b> en cualquier acción legal derivada de este contrato tendrá derecho a recuperar "
        "honorarios razonables de abogado, costos judiciales, costos de cobranza y demás gastos de litigio permitidos por la ley.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 53: MEDIATION
    section += 1
    elements.append(Paragraph(f"<b>{section}. MEDIATION AND DISPUTE RESOLUTION / MEDIACIÓN</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Parties agree to attempt mediation before filing legal action (except eviction for nonpayment). "
        "Each party bears own mediation costs.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 54: WAIVER
    section += 1
    elements.append(Paragraph(f"<b>{section}. WAIVER PROVISIONS / DISPOSICIONES DE RENUNCIA</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Landlord's failure to enforce any provision is not a waiver of right to enforce later. No waiver is valid "
        "unless in writing and signed by Landlord.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 55: ENTIRE AGREEMENT
    section += 1
    elements.append(Paragraph(f"<b>{section}. ENTIRE AGREEMENT / ACUERDO COMPLETO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "This Lease including all addenda constitutes the entire agreement. No oral modifications are binding unless "
        "in writing and signed by both parties.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 56: KEYS AND ACCESS DEVICES (NEW)
    section += 1
    elements.append(Paragraph(f"<b>{section}. KEYS AND ACCESS DEVICES / LLAVES Y DISPOSITIVOS DE ACCESO</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "<b>The lease shall not be considered terminated until Tenant has fully vacated the premises and returned all "
        "keys, garage remotes, access cards, and other access devices.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El contrato no se considerará terminado hasta que el Arrendatario haya desalojado completamente y devuelto "
        "todas las llaves, controles de garaje, tarjetas de acceso y otros dispositivos.</b>",
        styles['Body']
    ))
    
    keys_data = [
        ['Item / Artículo', 'Replacement Fee / Cargo por Reemplazo'],
        ['Lost Key / Llave Perdida', '$25.00 per key'],
        ['Garage Remote / Control de Garaje', '$75.00 per remote'],
        ['Access Card / Tarjeta de Acceso', '$50.00 per card'],
        ['Lock Change (requested by Tenant)', '$75.00 + cost of locks'],
        ['Lock-Out Service / Servicio de Cierre', '$50.00'],
    ]
    kt = Table(keys_data, colWidths=[200, 200])
    kt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(kt)
    elements.append(Spacer(1, 4))
    
    # SECTION 57: ELECTRONIC SIGNATURES
    section += 1
    elements.append(Paragraph(f"<b>{section}. ELECTRONIC SIGNATURES / FIRMAS ELECTRÓNICAS</b>", styles['SectionNum']))
    elements.append(Paragraph(
        "Electronic signatures are valid and binding with same legal effect as handwritten signatures.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 58: GOVERNING LAW
    section += 1
    elements.append(Paragraph(f"<b>{section}. GOVERNING LAW / LEY APLICABLE</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"This Lease is governed by laws of the State of {co.get('state', 'Texas')}, including Texas Property Code "
        f"Chapters 92 and 24, Fair Housing Act, and ADA.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # SECTION 59: VENUE
    section += 1
    elements.append(Paragraph(f"<b>{section}. VENUE / JURISDICCIÓN</b>", styles['SectionNum']))
    elements.append(Paragraph(
        f"Any legal action shall be brought exclusively in the courts of <b>{co.get('county', 'Moore')} County, "
        f"{co.get('state', 'Texas')}</b>.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # ═══════════════════════════════════════════════════════════════════
    # EMERGENCY CONTACTS (Fillable)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Paragraph("<b>EMERGENCY CONTACTS / CONTACTOS DE EMERGENCIA</b>", styles['SectionNum']))
    ec_header = ['Contact Type', 'Name / Nombre', 'Phone / Teléfono', 'Relationship']
    ec_rows = [ec_header]
    
    # Fill with tenant emergency contacts if available
    if tenant_emergency_contacts:
        for i, ec in enumerate(tenant_emergency_contacts[:2]):  # Max 2 contacts
            contact_type = 'Primary Emergency' if i == 0 else 'Alternate Contact'
            ec_rows.append([
                contact_type,
                ec.get('name', BLANK),
                ec.get('phone', BLANK_SHORT),
                ec.get('relationship', BLANK_SHORT)
            ])
        # Fill remaining rows with blanks
        if len(tenant_emergency_contacts) < 2:
            ec_rows.append(['Alternate Contact', BLANK, BLANK_SHORT, BLANK_SHORT])
    else:
        ec_rows.append(['Primary Emergency', BLANK, BLANK_SHORT, BLANK_SHORT])
        ec_rows.append(['Alternate Contact', BLANK, BLANK_SHORT, BLANK_SHORT])
    
    ect = Table(ec_rows, colWidths=[90, 150, 100, 100])
    ect.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(ect)
    elements.append(Spacer(1, 6))
    
    # ═══════════════════════════════════════════════════════════════════
    # EMPLOYER INFORMATION (Fillable - NEW)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Paragraph("<b>TENANT EMPLOYMENT INFORMATION / INFORMACIÓN DE EMPLEO</b>", styles['SectionNum']))
    emp_data = [
        ['Employer Name / Empleador:', tenant_employer if tenant_employer else BLANK_LONG],
        ['Employer Address / Dirección:', tenant.get('employer_address', BLANK_LONG)],
        ['Employer Phone / Teléfono:', tenant_employer_phone if tenant_employer_phone else BLANK_SHORT],
        ['Position / Cargo:', tenant.get('job_title', BLANK)],
        ['Monthly Income / Ingreso Mensual:', f"${tenant_monthly_income:,.0f}" if tenant_monthly_income else BLANK_SHORT],
    ]
    et = Table(emp_data, colWidths=[150, 300])
    et.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
    ]))
    elements.append(et)
    elements.append(Spacer(1, 8))
    
    # ═══════════════════════════════════════════════════════════════════
    # SCHEDULE OF FEES
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Paragraph("<b>SCHEDULE OF FEES / TABLA DE CARGOS</b>", styles['SectionNum']))
    fees_data = [
        ['Fee Type / Tipo de Cargo', 'Amount / Monto'],
        ['Application Fee', '$50.00'],
        ['Late Fee (initial)', format_currency(late_fee)],
        ['Daily Late Fee (additional)', '$5.00/day'],
        ['Maximum Late Fees (per month)', format_currency(late_fee_cap)],
        ['NSF/Returned Check', format_currency(nsf_fee)],
        ['Lost Key Replacement', '$25.00/key'],
        ['Garage Remote Replacement', '$75.00'],
        ['Lock-Out Service', '$50.00'],
        ['Unauthorized Pet Fee', '$250.00 + removal'],
        ['Lease Violation Fee', '$100.00'],
        ['Early Termination Fee', '2 months rent'],
        ['Re-Inspection Fee', '$75.00'],
        ['Cleaning Fee (if required)', 'Actual cost'],
    ]
    ft = Table(fees_data, colWidths=[280, 150])
    ft.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_RED),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GRAY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(ft)
    
    # ═══════════════════════════════════════════════════════════════════
    # SIGNATURES PAGE
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("<b>SIGNATURES / FIRMAS</b>", styles['DocTitle']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "By signing below, the parties acknowledge reading, understanding, and agreeing to all terms, conditions, "
        "and addenda. All signers are jointly and severally liable. / Al firmar, las partes reconocen haber leído, "
        "entendido y aceptado todos los términos. Todos los firmantes son responsables solidariamente.",
        styles['Body']
    ))
    elements.append(Spacer(1, 15))
    
    # Tenant signatures - multiple lines for joint liability
    elements.append(Paragraph("<b>TENANT(S) / ARRENDATARIO(S):</b>", styles['SubSection']))
    for i in range(1, 4):
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            f"Tenant {i} Signature: _________________________________ Date: ____________",
            styles['Body']
        ))
        elements.append(Paragraph(
            f"Printed Name: _________________________________ Phone: ____________",
            styles['Body']
        ))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("<b>LANDLORD / ARRENDADOR:</b>", styles['SubSection']))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        f"Authorized Signature: _________________________________ Date: ____________",
        styles['Body']
    ))
    elements.append(Paragraph(
        f"Printed Name: _________________________________ Title: ____________",
        styles['Body']
    ))
    elements.append(Paragraph(f"For: {co['name']}", styles['Body']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM A: MOVE-IN/MOVE-OUT CHECKLIST
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM A: MOVE-IN / MOVE-OUT CONDITION CHECKLIST", styles['AddendumTitle']))
    elements.append(Paragraph("LISTA DE CONDICIÓN DE ENTRADA / SALIDA", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(f"Property Address / Dirección: {BLANK_LONG}", styles['Body']))
    elements.append(Paragraph(f"Tenant Name(s) / Nombre(s): {BLANK_LONG}", styles['Body']))
    elements.append(Spacer(1, 4))
    
    checklist_items = [
        'Living Room / Sala', 'Kitchen / Cocina', 'Dining Room / Comedor',
        'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
        'Bathroom 1', 'Bathroom 2', 'Hallway / Pasillo',
        'Garage / Garaje', 'Front Yard', 'Back Yard',
        'HVAC System', 'Water Heater', 'Smoke Detectors',
        'Doors (all)', 'Windows (all)', 'Locks/Deadbolts',
        'Floors/Carpet', 'Walls/Paint', 'Ceiling',
        'Light Fixtures', 'Electrical Outlets', 'Plumbing',
    ]
    
    check_header = ['Area / Área', 'Move-In', 'Move-Out', 'Notes']
    check_rows = [check_header]
    for item in checklist_items:
        check_rows.append([item, '☐G ☐F ☐P', '☐G ☐F ☐P', ''])
    
    ct = Table(check_rows, colWidths=[120, 70, 70, 140])
    ct.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(ct)
    elements.append(Paragraph("G=Good, F=Fair, P=Poor", styles['BodySmall']))
    
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("<b>MOVE-IN SIGNATURES:</b>", styles['SubSection']))
    elements.append(Paragraph("Tenant: _________________________ Date: ________ Landlord: _________________________ Date: ________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>MOVE-OUT SIGNATURES:</b>", styles['SubSection']))
    elements.append(Paragraph("Tenant: _________________________ Date: ________ Landlord: _________________________ Date: ________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM B: ACH AUTHORIZATION (NACHA Compliant)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM B: ACH DEBIT AUTHORIZATION AGREEMENT", styles['AddendumTitle']))
    elements.append(Paragraph("ACUERDO DE AUTORIZACIÓN DE DÉBITO ACH (NACHA Compliant)", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        f"I, {BLANK_LONG}, hereby authorize <b>{co['name']}</b> to initiate recurring ACH debit entries from "
        f"my bank account for the following:",
        styles['Body']
    ))
    
    ach_items = [
        "☐ Monthly Rent (as specified in lease)",
        "☐ Late Fees (if applicable, per lease terms)",
        "☐ NSF/Returned Check Fees (if applicable)",
        "☐ Other authorized charges under the lease",
    ]
    for item in ach_items:
        elements.append(Paragraph(f"  {item}", styles['BodySmall']))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>BANK ACCOUNT INFORMATION:</b>", styles['SubSection']))
    bank_data = [
        ['Bank Name:', BLANK_LONG],
        ['Routing Number:', BLANK],
        ['Account Number:', BLANK],
        ['Account Type:', '☐ Checking  ☐ Savings'],
        ['Name on Account:', BLANK_LONG],
    ]
    bt = Table(bank_data, colWidths=[120, 300])
    bt.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
    ]))
    elements.append(bt)
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "This authorization remains in effect until I revoke it in writing with <b>30 days' notice</b>. I may request "
        "reversal of erroneous debits within <b>60 days</b> per NACHA regulations.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM C: MOLD DISCLOSURE
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM C: MOLD INFORMATION AND PREVENTION ADDENDUM", styles['AddendumTitle']))
    elements.append(Paragraph("(Texas Property Code §92.151-§92.157)", styles['LegalRef']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "<b>DISCLOSURE:</b> Landlord has no knowledge of mold or mold-producing conditions on the premises as of "
        "the date of this lease.",
        styles['Body']
    ))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("<b>TENANT RESPONSIBILITIES:</b>", styles['SubSection']))
    mold_resp = [
        "Maintain adequate ventilation, especially in bathrooms and kitchens",
        "Use exhaust fans during and after bathing and cooking",
        "Immediately report any water leaks, drips, or moisture in writing",
        "Do not block air vents or HVAC returns",
        "Keep premises reasonably clean and dry",
        "Promptly notify Landlord of any visible mold, mildew, or musty odors",
        "Remove visible moisture from surfaces as soon as possible",
    ]
    for item in mold_resp:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "<b>WARNING:</b> Failure to follow these guidelines may result in Tenant being held responsible for mold "
        "remediation costs.",
        styles['Warning']
    ))
    elements.append(Paragraph("Tenant Initials: ______  Date: ____________", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM D: BED BUG DISCLOSURE
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER_GRAY))
    elements.append(Paragraph("ADDENDUM D: BED BUG ADDENDUM", styles['AddendumTitle']))
    elements.append(Paragraph("(Texas Property Code §92.131-§92.135)", styles['LegalRef']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "Landlord has no knowledge of bed bug infestation on the premises. Tenant acknowledges that bed bugs may "
        "be introduced through luggage, furniture, clothing, or other personal items.",
        styles['Body']
    ))
    elements.append(Paragraph("<b>TENANT AGREES TO:</b>", styles['SubSection']))
    bedbug_items = [
        "Inspect personal belongings, especially used furniture, before bringing them into premises",
        "Report any suspected bed bug activity to Landlord immediately in writing",
        "Cooperate fully with any pest treatment program",
        "Not introduce known infested items into premises",
    ]
    for item in bedbug_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Paragraph("Tenant Initials: ______  Date: ____________", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM E: PET ADDENDUM
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM E: PET ADDENDUM / MASCOTAS", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "☐ NO PETS AUTHORIZED  |  ☐ PETS AUTHORIZED subject to the following terms:",
        styles['Body']
    ))
    elements.append(Spacer(1, 2))
    
    pet_terms = [
        "<b>Non-Refundable Pet Fee:</b> $_______ per pet (NOT a deposit)",
        "<b>Monthly Pet Rent:</b> $_______ per pet",
        "Maximum number of pets: _______",
        "Maximum weight per pet: _______ lbs",
        "Prohibited breeds: Pit Bulls, Rottweilers, Dobermans, Wolf Hybrids, breeds restricted by insurance",
        "Pets must be vaccinated and licensed per local requirements",
        "Tenant shall immediately clean up after pets inside and outside premises",
        "Tenant is liable for all damages caused by pets",
        "Landlord may revoke pet permission with 30 days' notice for violations",
    ]
    for item in pet_terms:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>AUTHORIZED PETS:</b>", styles['SubSection']))
    pet_table = [
        ['Type', 'Breed', 'Name', 'Weight', 'Color', 'License #'],
        ['____', '________', '______', '____', '____', '______'],
        ['____', '________', '______', '____', '____', '______'],
    ]
    pt = Table(pet_table, colWidths=[50, 80, 60, 40, 40, 70])
    pt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(pt)
    elements.append(Paragraph("Tenant Initials: ______  Date: ____________", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM F: RULES AND REGULATIONS
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM F: RULES AND REGULATIONS / REGLAS Y REGLAMENTOS", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    rules = {
        "GENERAL CONDUCT": ["Quiet hours: 10:00 PM - 8:00 AM", "No excessive noise", "No illegal activities", "Be respectful to neighbors"],
        "PARKING": ["Park in designated spaces only", "No vehicle repairs on premises", "Vehicles must be operational, registered, insured"],
        "TRASH": ["Use designated containers", "Place at curb only on collection days", "Remove containers within 24 hours"],
        "EXTERIOR": ["Maintain lawn if responsible", "No storage on porch/patio", "Keep exterior presentable"],
        "INTERIOR": ["No alterations without consent", "Change HVAC filters monthly", "Report issues promptly"],
    }
    
    for section_name, items in rules.items():
        elements.append(Paragraph(f"<b>{section_name}:</b>", styles['SubSection']))
        for item in items:
            elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Violation may result in lease termination.", styles['Warning']))
    elements.append(Paragraph("Tenant Initials: ______  Date: ____________", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM G: RENTERS INSURANCE
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER_GRAY))
    elements.append(Paragraph("ADDENDUM G: RENTERS INSURANCE REQUIREMENT", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "<b>TENANT IS REQUIRED</b> to maintain renters insurance with the following minimum coverage:",
        styles['Body']
    ))
    
    ins_data = [
        ['Coverage Type', 'Minimum Amount'],
        ['Personal Liability', '$100,000'],
        ['Personal Property', '$10,000'],
        ['Medical Payments', '$1,000'],
    ]
    it = Table(ins_data, colWidths=[180, 120])
    it.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(it)
    
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("<b>REQUIREMENTS:</b>", styles['SubSection']))
    ins_req = [
        f"Name {co['name']} as 'Interested Party'",
        "Provide proof of insurance within 7 days of move-in",
        "Provide updated proof upon policy renewal",
        "Notify Landlord immediately if coverage lapses",
    ]
    for item in ins_req:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>INSURANCE INFORMATION:</b>", styles['SubSection']))
    ins_info = [
        ['Insurance Company:', BLANK_LONG],
        ['Policy Number:', BLANK],
        ['Agent Name:', BLANK],
        ['Agent Phone:', BLANK_SHORT],
    ]
    iit = Table(ins_info, colWidths=[120, 280])
    iit.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    elements.append(iit)
    elements.append(Paragraph("Tenant Initials: ______  Date: ____________", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM H: LEAD-BASED PAINT (if pre-1978)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM H: LEAD-BASED PAINT DISCLOSURE", styles['AddendumTitle']))
    elements.append(Paragraph("DIVULGACIÓN DE PINTURA A BASE DE PLOMO", styles['AddendumTitle']))
    elements.append(Paragraph("(Required by Federal Law 42 U.S.C. §4852d)", styles['LegalRef']))
    elements.append(Spacer(1, 4))
    
    # APPLICABILITY NOTICE (NEW)
    elements.append(Paragraph(
        "<b>APPLICABILITY / APLICABILIDAD:</b> This Addendum applies only to residential properties constructed "
        "prior to January 1, 1978, as required by Federal Law 42 U.S.C. §4852d.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Este Addendum aplica únicamente a propiedades residenciales construidas antes del 1 de enero de 1978, "
        "según lo requerido por la Ley Federal 42 U.S.C. §4852d.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "<b>WARNING / ADVERTENCIA:</b> Housing built before 1978 may contain lead-based paint. Lead from paint, "
        "chips, and dust can pose health hazards, especially to young children and pregnant women.",
        styles['Warning']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>PROPERTY INFORMATION:</b>", styles['SubSection']))
    elements.append(Paragraph(f"Year Built / Año de Construcción: {BLANK_SHORT}", styles['Body']))
    elements.append(Paragraph("☐ Property was built BEFORE 1978 (disclosure required)", styles['Body']))
    elements.append(Paragraph("☐ Property was built AFTER 1978 (this addendum may be waived)", styles['Body']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>LANDLORD'S DISCLOSURE (check all that apply):</b>", styles['SubSection']))
    elements.append(Paragraph("☐ Known lead-based paint and/or hazards ARE present (explain below)", styles['Body']))
    elements.append(Paragraph("☐ Landlord has NO KNOWLEDGE of lead-based paint and/or hazards", styles['Body']))
    elements.append(Paragraph("☐ Landlord has provided all available records and reports pertaining to lead-based paint", styles['Body']))
    elements.append(Paragraph("☐ Landlord has NO records or reports pertaining to lead-based paint", styles['Body']))
    elements.append(Paragraph(f"Explanation: {BLANK_LONG}", styles['Body']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>TENANT'S ACKNOWLEDGMENT:</b>", styles['SubSection']))
    elements.append(Paragraph("☐ Tenant has received the EPA pamphlet 'Protect Your Family From Lead in Your Home'", styles['Body']))
    elements.append(Paragraph("☐ Tenant has received all available records and reports", styles['Body']))
    elements.append(Paragraph("☐ Tenant has had opportunity to conduct risk assessment or inspection (10 days)", styles['Body']))
    elements.append(Paragraph("☐ Tenant has waived opportunity to conduct risk assessment", styles['Body']))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Landlord Signature: _________________________________ Date: ____________", styles['Body']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM I: FLOOD DISCLOSURE (NEW)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM I: FLOOD DISCLOSURE ADDENDUM", styles['AddendumTitle']))
    elements.append(Paragraph("DIVULGACIÓN DE INUNDACIONES", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>PROPERTY FLOOD HISTORY AND STATUS:</b>", styles['SubSection']))
    elements.append(Paragraph("☐ Landlord has NO KNOWLEDGE of prior flooding at the property", styles['Body']))
    elements.append(Paragraph("☐ Landlord HAS KNOWLEDGE of prior flooding at the property (explain below)", styles['Body']))
    elements.append(Paragraph(f"Flood history explanation: {BLANK_LONG}", styles['Body']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>FEMA FLOOD ZONE STATUS:</b>", styles['SubSection']))
    elements.append(Paragraph("☐ Property IS located in a FEMA-designated Special Flood Hazard Area (SFHA)", styles['Body']))
    elements.append(Paragraph("☐ Property IS NOT located in a FEMA-designated Special Flood Hazard Area", styles['Body']))
    elements.append(Paragraph("☐ Landlord is UNCERTAIN of the property's flood zone status", styles['Body']))
    elements.append(Paragraph(f"FEMA Flood Zone (if known): {BLANK_SHORT}", styles['Body']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>FLOOD INSURANCE:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "☐ Landlord DOES maintain flood insurance on the property (this does NOT cover Tenant's personal property)",
        styles['Body']
    ))
    elements.append(Paragraph("☐ Landlord DOES NOT maintain flood insurance on the property", styles['Body']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>TENANT ACKNOWLEDGMENT:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant acknowledges that: (1) Landlord's flood insurance, if any, does NOT cover Tenant's personal property; "
        "(2) Tenant is responsible for obtaining separate flood insurance if desired; (3) Standard renters insurance "
        "policies typically do NOT cover flood damage; (4) Tenant should contact FEMA or an insurance agent for "
        "information about flood insurance options.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Landlord Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM J: CRIME FREE HOUSING ADDENDUM (NEW)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM J: CRIME FREE HOUSING ADDENDUM", styles['AddendumTitle']))
    elements.append(Paragraph("VIVIENDA LIBRE DE CRIMEN", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "In consideration for the execution or renewal of this Lease, Tenant, all household members, and all guests "
        "agree to the following Crime Free Housing provisions:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "En consideración por la ejecución o renovación de este Contrato, el Arrendatario, todos los miembros del "
        "hogar y todos los invitados aceptan las siguientes disposiciones de Vivienda Libre de Crimen:",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>1. PROHIBITED CRIMINAL ACTIVITIES / ACTIVIDADES CRIMINALES PROHIBIDAS:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant, any member of Tenant's household, and any guest or other person under Tenant's control shall not "
        "engage in any of the following activities on or near the premises:",
        styles['Body']
    ))
    
    crime_items = [
        "<b>Drug-Related Activity:</b> Manufacture, sale, distribution, use, or possession of any illegal controlled substance.",
        "<b>Gang Activity:</b> Any activity related to criminal street gangs, including recruitment, meetings, or gang-related violence.",
        "<b>Illegal Weapons:</b> Illegal manufacture, sale, or possession of firearms or other weapons prohibited by law.",
        "<b>Prostitution:</b> Engaging in, promoting, or facilitating prostitution or solicitation.",
        "<b>Human Trafficking:</b> Any activity related to trafficking of persons for labor or sexual exploitation.",
        "<b>Violent Crimes:</b> Acts of violence, threats of violence, assault, battery, or any crime against persons.",
        "<b>Property Crimes:</b> Theft, burglary, vandalism, or destruction of property.",
        "<b>Threats to Safety:</b> Any activity that threatens the health, safety, or peaceful enjoyment of other residents, neighbors, or Landlord's employees.",
    ]
    for item in crime_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>2. RESPONSIBILITY FOR HOUSEHOLD MEMBERS AND GUESTS / RESPONSABILIDAD:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Tenant is responsible for the conduct of all household members, family members, guests, invitees, and any "
        "other person on the premises with Tenant's permission or under Tenant's control.</b> Any violation of this "
        "Addendum by such persons shall be deemed a violation by Tenant.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario es responsable de la conducta de todos los miembros del hogar, familiares, invitados y "
        "cualquier otra persona en la propiedad con permiso del Arrendatario.</b> Cualquier violación de este Addendum "
        "por tales personas se considerará una violación por parte del Arrendatario.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>3. IMMEDIATE LEASE TERMINATION / TERMINACIÓN INMEDIATA:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "A single violation of any provision of this Addendum shall be grounds for <b>immediate termination of the "
        "lease</b> and eviction proceedings under Texas Property Code Chapter 24. Landlord may terminate with a "
        "<b>3-day notice to vacate</b> for criminal activity.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Una sola violación de cualquier disposición de este Addendum será causa de <b>terminación inmediata del "
        "contrato</b> y procedimientos de desalojo bajo el Código de Propiedad de Texas Capítulo 24. El Arrendador "
        "puede terminar con un <b>aviso de 3 días para desalojar</b> por actividad criminal.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>4. COOPERATION WITH LAW ENFORCEMENT / COOPERACIÓN CON AUTORIDADES:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant agrees to cooperate with law enforcement agencies investigating criminal activity on or near the premises. "
        "Landlord may share information with law enforcement as permitted by law.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("<b>5. NO WAIVER / SIN RENUNCIA:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Landlord's failure to enforce this Addendum in any instance shall not constitute a waiver of Landlord's right "
        "to enforce it in any other instance. Proof of conviction is NOT required for lease termination; Landlord may "
        "rely on credible evidence of criminal activity.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph(
        "<b>BY SIGNING BELOW, TENANT ACKNOWLEDGES READING, UNDERSTANDING, AND AGREEING TO COMPLY WITH ALL PROVISIONS "
        "OF THIS CRIME FREE HOUSING ADDENDUM.</b>",
        styles['Warning']
    ))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Printed Name: _________________________________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Co-Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Printed Name: _________________________________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Landlord Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM K: TENANT PHOTO AND IDENTITY VERIFICATION (NEW)
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM K: TENANT PHOTO AND IDENTITY VERIFICATION AUTHORIZATION", styles['AddendumTitle']))
    elements.append(Paragraph("AUTORIZACIÓN DE FOTOGRAFÍA Y VERIFICACIÓN DE IDENTIDAD DEL ARRENDATARIO", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "This Addendum authorizes Ross House Rentals LLC to collect, store, and use photographs and identification "
        "documents of Tenant for legitimate property management purposes.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Este Addendum autoriza a Ross House Rentals LLC a recopilar, almacenar y utilizar fotografías y documentos "
        "de identificación del Arrendatario para fines legítimos de administración de propiedades.",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # Section 1: Authorization to Collect
    elements.append(Paragraph("<b>1. AUTHORIZATION TO COLLECT / AUTORIZACIÓN PARA RECOPILAR:</b>", styles['SubSection']))
    elements.append(Paragraph("Tenant authorizes Landlord to: / El Arrendatario autoriza al Arrendador a:", styles['Body']))
    collect_items = [
        "Take photographs of Tenant / Tomar fotografías del Arrendatario",
        "Scan or photograph driver's licenses / Escanear o fotografiar licencias de conducir",
        "Scan or photograph government-issued identification cards / Escanear o fotografiar identificaciones gubernamentales",
        "Scan or photograph passports / Escanear o fotografiar pasaportes",
        "Scan or photograph resident alien cards / Escanear o fotografiar tarjetas de residencia",
        "Retain digital and physical copies of such documents / Conservar copias digitales y físicas de dichos documentos",
    ]
    for item in collect_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # Section 2: Authorized Uses
    elements.append(Paragraph("<b>2. AUTHORIZED USES / USOS AUTORIZADOS:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant authorizes photographs and identification documents to be used for: / El Arrendatario autoriza que "
        "las fotografías e identificaciones sean utilizadas para:",
        styles['Body']
    ))
    use_items = [
        "Identity verification / Verificación de identidad",
        "Fraud prevention / Prevención de fraude",
        "Lease administration / Administración del arrendamiento",
        "Verification of authorized occupants / Verificación de ocupantes autorizados",
        "Property security / Seguridad de la propiedad",
        "Collection of past-due rent and damages / Cobranza de rentas y daños adeudados",
        "Legal compliance and obligations / Cumplimiento de obligaciones legales",
        "Emergency response and contact / Atención de emergencias",
        "Protection of Landlord's legitimate business interests / Protección de los intereses legítimos del Arrendador",
    ]
    for item in use_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # Section 3: Storage Authorization
    elements.append(Paragraph("<b>3. STORAGE AUTHORIZATION / AUTORIZACIÓN DE ALMACENAMIENTO:</b>", styles['SubSection']))
    elements.append(Paragraph("Tenant authorizes storage of information in: / El Arrendatario autoriza el almacenamiento en:", styles['Body']))
    storage_items = [
        "Physical format (paper files) / Formato físico (archivos en papel)",
        "Digital format (electronic files) / Formato digital (archivos electrónicos)",
        "Ross House Rentals LLC internal systems / Sistemas internos de Ross House Rentals LLC",
        "Property management software / Software de administración de propiedades",
        "Cloud storage services used by Landlord / Servicios de almacenamiento en la nube utilizados por el Arrendador",
    ]
    for item in storage_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # Section 4: Limitations on Use
    elements.append(Paragraph("<b>4. LIMITATIONS ON USE AND DISCLOSURE / LIMITACIONES DE USO Y DIVULGACIÓN:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Landlord agrees to the following limitations: / El Arrendador acepta las siguientes limitaciones:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "  • <b>Landlord will NOT sell Tenant's personal information.</b> / El Arrendador NO venderá la información personal.",
        styles['BodySmall']
    ))
    elements.append(Paragraph(
        "  • Landlord will NOT share information except: / El Arrendador NO compartirá información excepto:",
        styles['BodySmall']
    ))
    share_items = [
        "When required by law / Cuando sea requerido por ley",
        "By court order or subpoena / Por orden judicial o citación",
        "With collection agencies for debt recovery / Con agencias de cobranza para recuperación de deudas",
        "With attorneys representing Landlord / Con abogados que representen al Arrendador",
        "With authorized government agencies / Con agencias gubernamentales autorizadas",
        "With software or storage providers used to manage the lease / Con proveedores de software o almacenamiento",
    ]
    for item in share_items:
        elements.append(Paragraph(f"      - {item}", styles['BodySmall']))
    elements.append(Spacer(1, 4))
    
    # Section 5: Express Consent
    elements.append(Paragraph("<b>5. EXPRESS CONSENT / CONSENTIMIENTO EXPRESO:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Tenant voluntarily consents to the collection, storage, and use of photographs and identification documents "
        "for the purposes described in this Addendum.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario autoriza voluntariamente la recopilación, almacenamiento y uso de fotografías y documentos "
        "de identificación para los fines descritos en este Addendum.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    
    # Section 6: Survival Clause
    elements.append(Paragraph("<b>6. SURVIVAL / SUPERVIVENCIA:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>This authorization shall survive the termination of the lease</b> to the extent necessary for record retention, "
        "collections, legal compliance, and dispute resolution.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>Esta autorización sobrevivirá a la terminación del contrato</b> en la medida necesaria para retención de registros, "
        "cobranzas, cumplimiento legal y resolución de disputas.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # Tenant Information Fields
    elements.append(Paragraph("<b>TENANT INFORMATION / INFORMACIÓN DEL ARRENDATARIO:</b>", styles['SubSection']))
    tenant_info_data = [
        ['Tenant Name / Nombre:', BLANK_LONG],
        ['Property Address / Dirección:', BLANK_LONG],
        ['Driver License Number / No. de Licencia:', BLANK],
        ['State Issued / Estado:', BLANK_SHORT],
        ['Date / Fecha:', BLANK_SHORT],
    ]
    tit = Table(tenant_info_data, colWidths=[150, 280])
    tit.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(tit)
    elements.append(Spacer(1, 8))
    
    # Signatures
    elements.append(Paragraph(
        "<b>BY SIGNING BELOW, TENANT ACKNOWLEDGES READING, UNDERSTANDING, AND VOLUNTARILY AGREEING TO THIS "
        "PHOTO AND IDENTITY VERIFICATION AUTHORIZATION.</b>",
        styles['Warning']
    ))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Printed Name: _________________________________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Co-Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Printed Name: _________________________________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Landlord/Agent Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM K - PAGE 2: IDENTITY VERIFICATION RECORD
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM K - PAGE 2", styles['AddendumTitle']))
    elements.append(Paragraph("TENANT IDENTITY VERIFICATION RECORD", styles['AddendumTitle']))
    elements.append(Paragraph("REGISTRO DE VERIFICACIÓN DE IDENTIDAD DEL ARRENDATARIO", styles['AddendumTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    elements.append(Spacer(1, 6))
    
    # Identity Verification Clause
    elements.append(Paragraph("<b>7. IDENTITY VERIFICATION CLAUSE / CLÁUSULA DE VERIFICACIÓN DE IDENTIDAD:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant acknowledges that photographs obtained for identity verification purposes may be compared against "
        "government-issued identification documents and may be used to verify the identity of any person requesting "
        "access to the property, requesting maintenance services, submitting lease-related requests, making payment "
        "arrangements, or participating in legal proceedings related to the tenancy.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "El Arrendatario reconoce que las fotografías obtenidas para fines de verificación de identidad podrán "
        "compararse con documentos oficiales de identificación y podrán utilizarse para verificar la identidad de "
        "cualquier persona que solicite acceso a la propiedad, solicite servicios de mantenimiento, presente "
        "solicitudes relacionadas con el arrendamiento, realice acuerdos de pago o participe en procedimientos "
        "legales relacionados con la ocupación.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # Detailed Tenant Verification Fields
    elements.append(Paragraph("<b>TENANT VERIFICATION DETAILS / DETALLES DE VERIFICACIÓN:</b>", styles['SubSection']))
    verification_data = [
        ['Tenant Full Legal Name / Nombre Legal Completo:', BLANK_LONG],
        ['Date of Birth / Fecha de Nacimiento:', BLANK_SHORT],
        ['Driver License Number / Número de Licencia:', BLANK],
        ['State Issued / Estado que Emitió:', BLANK_SHORT],
        ['DL Expiration Date / Fecha de Expiración:', BLANK_SHORT],
        ['Secondary ID Type / Tipo de ID Secundaria:', BLANK],
        ['Secondary ID Number / Número de ID Secundaria:', BLANK],
        ['Phone Number / Teléfono:', BLANK_SHORT],
        ['Email Address / Correo Electrónico:', BLANK],
    ]
    vdt = Table(verification_data, colWidths=[180, 250])
    vdt.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(vdt)
    elements.append(Spacer(1, 8))
    
    # Photo and ID Document Boxes
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 6))
    
    # Create three boxes side by side for photo and IDs
    # Row 1: Tenant Photo and Driver License
    photo_box_content = [
        [Paragraph("<b>TENANT PHOTOGRAPH</b><br/>FOTOGRAFÍA DEL ARRENDATARIO", 
                   ParagraphStyle('BoxTitle', fontSize=7, alignment=TA_CENTER, textColor=NAVY, leading=10))],
        [Spacer(1, 60)],  # Space for photo
        [Paragraph("<i>PLACE TENANT PHOTO HERE<br/>2\" x 2.5\"</i>", 
                   ParagraphStyle('BoxText', fontSize=6, alignment=TA_CENTER, textColor=GRAY, leading=8))],
    ]
    
    dl_box_content = [
        [Paragraph("<b>DRIVER LICENSE COPY</b><br/>COPIA DE LICENCIA DE CONDUCIR", 
                   ParagraphStyle('BoxTitle', fontSize=7, alignment=TA_CENTER, textColor=NAVY, leading=10))],
        [Spacer(1, 60)],  # Space for DL
        [Paragraph("<i>PLACE DRIVER LICENSE COPY HERE<br/>(FRONT)</i>", 
                   ParagraphStyle('BoxText', fontSize=6, alignment=TA_CENTER, textColor=GRAY, leading=8))],
    ]
    
    photo_table = Table(photo_box_content, colWidths=[140])
    photo_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, NAVY),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    dl_table = Table(dl_box_content, colWidths=[200])
    dl_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, NAVY),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    row1 = Table([[photo_table, Spacer(1, 10), dl_table]], colWidths=[145, 20, 205])
    row1.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(row1)
    elements.append(Spacer(1, 8))
    
    # Row 2: Secondary ID and DL Back
    secondary_box_content = [
        [Paragraph("<b>SECONDARY IDENTIFICATION</b><br/>IDENTIFICACIÓN SECUNDARIA", 
                   ParagraphStyle('BoxTitle', fontSize=7, alignment=TA_CENTER, textColor=NAVY, leading=10))],
        [Spacer(1, 50)],
        [Paragraph("<i>PASSPORT / GREEN CARD / STATE ID<br/>PLACE COPY HERE</i>", 
                   ParagraphStyle('BoxText', fontSize=6, alignment=TA_CENTER, textColor=GRAY, leading=8))],
    ]
    
    dl_back_content = [
        [Paragraph("<b>DRIVER LICENSE (BACK)</b><br/>LICENCIA (REVERSO)", 
                   ParagraphStyle('BoxTitle', fontSize=7, alignment=TA_CENTER, textColor=NAVY, leading=10))],
        [Spacer(1, 50)],
        [Paragraph("<i>PLACE BACK OF LICENSE HERE<br/>(IF APPLICABLE)</i>", 
                   ParagraphStyle('BoxText', fontSize=6, alignment=TA_CENTER, textColor=GRAY, leading=8))],
    ]
    
    secondary_table = Table(secondary_box_content, colWidths=[170])
    secondary_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, NAVY),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    dl_back_table = Table(dl_back_content, colWidths=[170])
    dl_back_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, NAVY),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    row2 = Table([[secondary_table, Spacer(1, 10), dl_back_table]], colWidths=[175, 20, 175])
    row2.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(row2)
    elements.append(Spacer(1, 10))
    
    # Identity Verification Certification by Representative
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>IDENTITY VERIFICATION CERTIFICATION</b>", styles['AddendumTitle']))
    elements.append(Paragraph("<b>CERTIFICACIÓN DE VERIFICACIÓN DE IDENTIDAD</b>", styles['AddendumTitle']))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph(
        "I certify that I personally reviewed the identification documents presented by the Tenant and that the "
        "photograph attached to this Addendum reasonably matches the individual signing the lease.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Certifico que revisé personalmente los documentos de identificación presentados por el Arrendatario y que "
        "la fotografía adjunta a este Addendum corresponde razonablemente con la persona que firma el contrato.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # Representative Certification Fields
    rep_data = [
        ['Representative Name / Nombre del Representante:', BLANK_LONG],
        ['Position / Cargo:', BLANK],
        ['Signature / Firma:', BLANK_LONG],
        ['Date / Fecha:', BLANK_SHORT],
    ]
    rept = Table(rep_data, colWidths=[180, 250])
    rept.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(rept)
    elements.append(Spacer(1, 8))
    
    # Final Signatures for Addendum K
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>FINAL ACKNOWLEDGMENT / RECONOCIMIENTO FINAL:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "By signing below, Tenant confirms that all information provided is accurate and authorizes the use of "
        "photographs and identification documents as described in this Addendum.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Tenant Signature: _________________________________ Date: ____________", styles['Body']))
    elements.append(Paragraph("Tenant Initials: ______", styles['InitialLine']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Landlord Representative: _________________________________ Date: ____________", styles['Body']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM L: CONSENT TO COMMUNICATIONS AND COLLECTIONS
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM L: CONSENT TO COMMUNICATIONS AND COLLECTIONS", styles['AddendumTitle']))
    elements.append(Paragraph("ADDENDUM L: CONSENTIMIENTO PARA COMUNICACIONES Y COBRANZAS", styles['AddendumTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph(
        "This Addendum is attached to and forms part of the Residential Lease Agreement between Ross House Rentals LLC "
        "(\"Landlord\") and Tenant for the property described in the Lease.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Este Addendum está adjunto y forma parte del Contrato de Arrendamiento Residencial entre Ross House Rentals LLC "
        "(\"Arrendador\") y el Arrendatario para la propiedad descrita en el Contrato.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # Section 1: Authorized Communications Methods
    elements.append(Paragraph("<b>1. AUTHORIZED COMMUNICATION METHODS / MÉTODOS DE COMUNICACIÓN AUTORIZADOS</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant authorizes Ross House Rentals LLC to communicate through the following methods:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "El Arrendatario autoriza a Ross House Rentals LLC a comunicarse mediante los siguientes métodos:",
        styles['Body']
    ))
    
    comm_methods = [
        ("Phone calls / Llamadas telefónicas", "☐"),
        ("SMS text messages / Mensajes de texto SMS", "☐"),
        ("MMS multimedia messages / Mensajes multimedia MMS", "☐"),
        ("WhatsApp messages / Mensajes de WhatsApp", "☐"),
        ("Email / Correo electrónico", "☐"),
        ("Postal mail / Correo postal", "☐"),
        ("Automated messages / Mensajes automáticos", "☐"),
        ("Tenant portal notifications / Notificaciones del portal del inquilino", "☐"),
        ("Messaging applications / Aplicaciones de mensajería", "☐"),
        ("Other contact methods provided by Tenant / Otros medios de contacto proporcionados por el Arrendatario", "☐"),
    ]
    
    comm_data = [['Communication Method / Método de Comunicación', 'Authorized']]
    for method, check in comm_methods:
        comm_data.append([method, check])
    
    comm_table = Table(comm_data, colWidths=[350, 60])
    comm_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(comm_table)
    elements.append(Spacer(1, 6))
    
    # Section 2: Authorized Purposes
    elements.append(Paragraph("<b>2. AUTHORIZED PURPOSES / PROPÓSITOS AUTORIZADOS</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Communications may be made for any of the following purposes:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Las comunicaciones podrán realizarse para cualquiera de los siguientes propósitos:",
        styles['Body']
    ))
    
    purposes = [
        "Rent collection / Cobro de renta",
        "Late payment notices / Avisos de mora",
        "Payment confirmations / Confirmación de pagos",
        "Maintenance requests and updates / Solicitudes y actualizaciones de mantenimiento",
        "Property inspections / Inspecciones de la propiedad",
        "Lease renewals / Renovaciones del contrato",
        "Emergency notifications / Notificaciones de emergencia",
        "Legal notices / Avisos legales",
        "Balance collections / Cobranza de saldos",
        "Court proceedings / Procedimientos judiciales",
        "General lease administration / Administración general del arrendamiento",
    ]
    for purpose in purposes:
        elements.append(Paragraph(f"  • {purpose}", styles['BodySmall']))
    elements.append(Spacer(1, 6))
    
    # Section 3: Consent to Automated Messages
    elements.append(Paragraph("<b>3. CONSENT TO AUTOMATED MESSAGES / CONSENTIMIENTO PARA MENSAJES AUTOMÁTICOS</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Tenant expressly consents to receive communications from Ross House Rentals LLC through automated dialing "
        "systems, prerecorded messages, SMS messages, email notifications, and other electronic communications as "
        "permitted by law.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario autoriza expresamente recibir comunicaciones de Ross House Rentals LLC mediante sistemas "
        "automatizados de llamadas, mensajes pregrabados, mensajes SMS, correos electrónicos y otras comunicaciones "
        "electrónicas permitidas por la ley.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Tenant understands that message and data rates may apply. Tenant may opt out of automated messages at any "
        "time by contacting Landlord in writing, except for legally required notices.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "El Arrendatario entiende que pueden aplicar cargos por mensajes y datos. El Arrendatario puede cancelar "
        "los mensajes automáticos en cualquier momento contactando al Arrendador por escrito, excepto para avisos "
        "legalmente requeridos.",
        styles['Body']
    ))
    elements.append(Spacer(1, 6))
    
    # Section 4: Information Update Requirement
    elements.append(Paragraph("<b>4. INFORMATION UPDATE REQUIREMENT / REQUISITO DE ACTUALIZACIÓN DE INFORMACIÓN</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Tenant shall notify Landlord of any changes to the following within 5 business days:</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario deberá notificar al Arrendador cualquier cambio en lo siguiente dentro de 5 días hábiles:</b>",
        styles['Body']
    ))
    
    update_items = [
        "Phone number(s) / Número(s) de teléfono",
        "Email address / Correo electrónico",
        "Mailing address / Dirección postal",
        "Employment information / Información de empleo",
        "Emergency contacts / Contactos de emergencia",
    ]
    for item in update_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 6))
    
    # Section 5: Post-Tenancy Communications
    elements.append(Paragraph("<b>5. POST-TENANCY COMMUNICATIONS / COMUNICACIONES POSTERIORES AL ARRENDAMIENTO</b>", styles['SubSection']))
    elements.append(Paragraph(
        "Tenant authorizes Ross House Rentals LLC to continue using contact information after the lease terminates for:",
        styles['Body']
    ))
    elements.append(Paragraph(
        "El Arrendatario autoriza a Ross House Rentals LLC a continuar utilizando la información de contacto después "
        "de que termine el contrato para:",
        styles['Body']
    ))
    
    post_items = [
        "Debt collection / Cobranza de deudas",
        "Security deposit settlement / Liquidación del depósito de seguridad",
        "Legal notices / Avisos legales",
        "Court proceedings / Procedimientos judiciales",
        "Dispute resolution / Resolución de disputas",
        "Record retention / Conservación de registros",
        "Collection agencies and credit reporting / Agencias de cobranza y reporte crediticio",
    ]
    for item in post_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    elements.append(Spacer(1, 6))
    
    # Section 6: Authorization to Share Information
    elements.append(Paragraph("<b>6. AUTHORIZATION TO SHARE INFORMATION / AUTORIZACIÓN PARA COMPARTIR INFORMACIÓN</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Tenant expressly authorizes Ross House Rentals LLC to share contact and tenancy information with:</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>El Arrendatario autoriza expresamente a Ross House Rentals LLC a compartir información de contacto y "
        "arrendamiento con:</b>",
        styles['Body']
    ))
    
    share_items = [
        "Collection agencies / Agencias de cobranza",
        "Attorneys / Abogados",
        "Courts / Tribunales",
        "Credit bureaus (Experian, Equifax, TransUnion) / Burós de crédito",
        "Authorized service providers / Proveedores de servicios autorizados",
    ]
    for item in share_items:
        elements.append(Paragraph(f"  • {item}", styles['BodySmall']))
    
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        "as permitted by the Fair Debt Collection Practices Act (FDCPA), Fair Credit Reporting Act (FCRA), "
        "Telephone Consumer Protection Act (TCPA), and applicable state and federal laws.",
        styles['BodySmall']
    ))
    elements.append(Paragraph(
        "según lo permita la Ley de Prácticas Justas de Cobro de Deudas (FDCPA), la Ley de Informe Justo de Crédito "
        "(FCRA), la Ley de Protección al Consumidor Telefónico (TCPA) y las leyes estatales y federales aplicables.",
        styles['BodySmall']
    ))
    elements.append(Spacer(1, 8))
    
    # Section 7: Contact Information Fields
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>7. TENANT CONTACT INFORMATION / INFORMACIÓN DE CONTACTO DEL ARRENDATARIO</b>", styles['SubSection']))
    
    contact_fields = [
        ['Primary Phone / Teléfono Principal:', BLANK],
        ['Secondary Phone / Teléfono Secundario:', BLANK],
        ['Email Address / Correo Electrónico:', BLANK],
        ['Employer / Empleador:', BLANK],
        ['Work Phone / Teléfono del Trabajo:', BLANK],
        ['Emergency Contact Name / Nombre Contacto de Emergencia:', BLANK],
        ['Emergency Contact Phone / Teléfono Contacto de Emergencia:', BLANK],
    ]
    
    contact_table = Table(contact_fields, colWidths=[200, 230])
    contact_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(contact_table)
    elements.append(Spacer(1, 10))
    
    # Acknowledgment and Signatures
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>ACKNOWLEDGMENT AND SIGNATURES / RECONOCIMIENTO Y FIRMAS</b>", styles['SubSection']))
    elements.append(Paragraph(
        "By signing below, Tenant acknowledges reading, understanding, and agreeing to all terms of this "
        "Communications and Collections Consent Addendum.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "Al firmar a continuación, el Arrendatario reconoce haber leído, entendido y aceptado todos los términos "
        "de este Addendum de Consentimiento para Comunicaciones y Cobranzas.",
        styles['Body']
    ))
    elements.append(Spacer(1, 10))
    
    # Signature lines
    elements.append(Paragraph("Tenant Signature / Firma del Arrendatario: _________________________________ Date / Fecha: ____________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Printed Name / Nombre en Letra de Molde: _________________________________", styles['Body']))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Co-Tenant Signature / Firma del Co-Arrendatario: _________________________________ Date / Fecha: ____________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Printed Name / Nombre en Letra de Molde: _________________________________", styles['Body']))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Tenant Initials / Iniciales del Arrendatario: ______", styles['InitialLine']))
    elements.append(Spacer(1, 10))
    
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Landlord Representative / Representante del Arrendador: _________________________________ Date / Fecha: ____________", styles['Body']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Printed Name and Title / Nombre y Cargo: _________________________________", styles['Body']))
    
    # ═══════════════════════════════════════════════════════════════════
    # ADDENDUM M: PHOTO INVENTORY RECORD
    # ═══════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM M: PHOTO INVENTORY RECORD", styles['AddendumTitle']))
    elements.append(Paragraph("ADDENDUM M: REGISTRO FOTOGRÁFICO DE LA PROPIEDAD", styles['AddendumTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    elements.append(Spacer(1, 6))
    
    # Property Information Header
    photo_header_data = [
        ['Property Address / Dirección de la Propiedad:', BLANK_LONG],
        ['Tenant Name / Nombre del Arrendatario:', BLANK_LONG],
        ['Move-In Date / Fecha de Entrada:', BLANK_SHORT],
        ['Move-Out Date / Fecha de Salida:', BLANK_SHORT],
    ]
    photo_header_table = Table(photo_header_data, colWidths=[180, 250])
    photo_header_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(photo_header_table)
    elements.append(Spacer(1, 8))
    
    # Purpose Statement
    elements.append(Paragraph(
        "<b>PURPOSE:</b> This Photo Inventory Record serves as visual evidence of the property condition for: "
        "damages, security deposit deductions, collections, lawsuits, evictions, and dispute resolution.",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>PROPÓSITO:</b> Este Registro Fotográfico sirve como evidencia visual de la condición de la propiedad para: "
        "daños, deducciones del depósito de seguridad, cobranzas, demandas, desalojos y resolución de disputas.",
        styles['Body']
    ))
    elements.append(Spacer(1, 8))
    
    # Helper function to create photo section
    def create_photo_section(title_en, title_es, num_photos):
        section_elements = []
        section_elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
        section_elements.append(Spacer(1, 4))
        section_elements.append(Paragraph(f"<b>{title_en}</b>", styles['SubSection']))
        section_elements.append(Paragraph(f"<b>{title_es}</b>", styles['BodySmall']))
        section_elements.append(Spacer(1, 4))
        
        # Create photo boxes in rows of 2
        photo_rows = []
        for i in range(0, num_photos, 2):
            row = []
            for j in range(2):
                if i + j < num_photos:
                    photo_num = i + j + 1
                    box_content = [
                        [Paragraph(f"<b>PHOTO {photo_num}</b>", 
                                   ParagraphStyle('PhotoTitle', fontSize=7, alignment=TA_CENTER, textColor=NAVY))],
                        [Spacer(1, 50)],  # Space for photo
                        [Paragraph(f"<i>Attach photo here</i>", 
                                   ParagraphStyle('PhotoText', fontSize=6, alignment=TA_CENTER, textColor=GRAY))],
                        [Paragraph(f"Date: ________ Notes: _______________", 
                                   ParagraphStyle('PhotoNotes', fontSize=6, alignment=TA_LEFT, textColor=DARK_GRAY))],
                    ]
                    photo_box = Table(box_content, colWidths=[200])
                    photo_box.setStyle(TableStyle([
                        ('BOX', (0, 0), (-1, -1), 1, NAVY),
                        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ]))
                    row.append(photo_box)
                else:
                    row.append('')
            if len(row) == 1:
                row.append('')
            photo_rows.append(row)
        
        if photo_rows:
            photos_table = Table(photo_rows, colWidths=[210, 210])
            photos_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            section_elements.append(photos_table)
        
        section_elements.append(Spacer(1, 6))
        return section_elements
    
    # Section 1: Living Room
    for el in create_photo_section("SECTION 1: LIVING ROOM PHOTOS", "FOTOGRAFÍAS DE LA SALA", 2):
        elements.append(el)
    
    # Section 2: Kitchen
    for el in create_photo_section("SECTION 2: KITCHEN PHOTOS", "FOTOGRAFÍAS DE LA COCINA", 2):
        elements.append(el)
    
    # Section 3: Bedrooms
    for el in create_photo_section("SECTION 3: BEDROOM PHOTOS", "FOTOGRAFÍAS DE RECÁMARAS", 3):
        elements.append(el)
    
    # Page break for more sections
    elements.append(PageBreak())
    elements.append(Paragraph("ADDENDUM M: PHOTO INVENTORY RECORD (CONTINUED)", styles['AddendumTitle']))
    elements.append(Paragraph("REGISTRO FOTOGRÁFICO DE LA PROPIEDAD (CONTINUACIÓN)", styles['AddendumTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    elements.append(Spacer(1, 6))
    
    # Section 4: Bathrooms
    for el in create_photo_section("SECTION 4: BATHROOM PHOTOS", "FOTOGRAFÍAS DE BAÑOS", 2):
        elements.append(el)
    
    # Section 5: Garage
    for el in create_photo_section("SECTION 5: GARAGE PHOTOS", "FOTOGRAFÍAS DEL GARAJE", 2):
        elements.append(el)
    
    # Section 6: Exterior
    for el in create_photo_section("SECTION 6: EXTERIOR PHOTOS", "FOTOGRAFÍAS DEL EXTERIOR", 2):
        elements.append(el)
    
    # Section 7: Additional Damage Photos
    for el in create_photo_section("SECTION 7: ADDITIONAL DAMAGE PHOTOS", "FOTOGRAFÍAS ADICIONALES DE DAÑOS", 4):
        elements.append(el)
    
    # Legal Clause
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>LEGAL CLAUSE / CLÁUSULA LEGAL:</b>", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Photographs attached to this Addendum shall be considered part of the Lease Agreement and may be used "
        "as evidence regarding the condition of the premises, damages, repairs, security deposit deductions, "
        "legal proceedings, collections, and dispute resolution.</b>",
        styles['Body']
    ))
    elements.append(Paragraph(
        "<b>Las fotografías adjuntas a este Addendum se considerarán parte del Contrato de Arrendamiento y podrán "
        "utilizarse como evidencia respecto a la condición de la propiedad, daños, reparaciones, deducciones del "
        "depósito de seguridad, procedimientos legales, cobranzas y resolución de disputas.</b>",
        styles['Body']
    ))
    elements.append(Spacer(1, 10))
    
    # Signatures for Addendum M
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("<b>SIGNATURES / FIRMAS:</b>", styles['SubSection']))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Tenant Signature / Firma del Arrendatario: _________________________________ Date / Fecha: ____________", styles['Body']))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Landlord Representative / Representante del Arrendador: _________________________________ Date / Fecha: ____________", styles['Body']))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Tenant Initials / Iniciales del Arrendatario: ______", styles['InitialLine']))
    
    # ═══════════════════════════════════════════════════════════════════
    # FINAL FOOTER
    # ═══════════════════════════════════════════════════════════════════
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_RED))
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(
        f"<b>Ross House Rentals LLC</b>",
        styles['Footer']
    ))
    elements.append(Paragraph(
        f"<b>Texas Residential Lease Agreement</b>",
        styles['Footer']
    ))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph(
        f"{co['address']} | {co['phone']} | {co['email']}",
        styles['Footer']
    ))
    elements.append(Paragraph(
        "Governed by Texas Property Code Chapters 92 and 24, Fair Housing Act, ADA, and SCRA.",
        styles['Footer']
    ))
    
    # Build PDF
    try:
        doc.build(elements)
    except Exception as e:
        logger.error(f"PDF build error: {e}")
        raise
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return base64.b64encode(pdf_bytes).decode('utf-8')


# ═══════════════════════════════════════════════════════════════════════════
# 3-DAY NOTICE TO VACATE GENERATOR
# ═══════════════════════════════════════════════════════════════════════════

def generate_3day_notice_pdf(contract: dict, config: dict = None, reason: str = 'nonpayment', amount_owed: float = 0) -> str:
    """Generate a Texas 3-Day Notice to Vacate (TX Property Code §24.005)"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch
    )
    styles = _build_styles()
    elements = []
    
    co = {**DEFAULT_COMPANY}
    if config:
        for k in ['name', 'address', 'phone', 'email']:
            if config.get(k):
                co[k] = config[k]
    
    logo_path = _get_logo_path()
    if logo_path:
        try:
            logo = RLImage(logo_path, width=2 * inch, height=0.87 * inch)
            logo.hAlign = 'CENTER'
            elements.append(logo)
        except Exception:
            pass
    
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=2, color=RED))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph(
        "THREE-DAY NOTICE TO VACATE / AVISO DE TRES DÍAS PARA DESALOJAR",
        ParagraphStyle('NoticeTitle', fontName='Helvetica-Bold', fontSize=14,
                      textColor=RED, alignment=TA_CENTER, spaceAfter=8)
    ))
    elements.append(Paragraph("(Texas Property Code §24.005)", styles['LegalRef']))
    elements.append(Spacer(1, 12))
    
    tenant_name = _get_value_or_blank(contract, 'tenant_name', BLANK_LONG)
    property_address = _get_value_or_blank(contract, 'property_address', BLANK_LONG)
    
    elements.append(Paragraph(f"<b>Date / Fecha:</b> {BLANK_SHORT}", styles['Body']))
    elements.append(Paragraph(f"<b>To / Para:</b> {tenant_name}", styles['Body']))
    elements.append(Paragraph(f"<b>Property / Propiedad:</b> {property_address}", styles['Body']))
    elements.append(Spacer(1, 8))
    
    if reason == 'nonpayment':
        amt = format_currency(amount_owed) if amount_owed > 0 else BLANK_SHORT
        elements.append(Paragraph(
            f"You are hereby notified that you are in default of your lease for nonpayment of rent. "
            f"The total amount owed is <b>{amt}</b>.",
            styles['Body']
        ))
    
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("<b>1.</b> Pay the full amount owed within THREE (3) DAYS; OR", styles['Body']))
    elements.append(Paragraph("<b>2.</b> Vacate the premises within THREE (3) DAYS.", styles['Body']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "If you fail to comply, legal proceedings may be initiated for eviction and recovery of all amounts owed.",
        styles['Warning']
    ))
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"Landlord Signature: _________________________ Date: _____________", styles['Body']))
    elements.append(Paragraph(co['name'], styles['Body']))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return base64.b64encode(pdf_bytes).decode('utf-8')


# ═══════════════════════════════════════════════════════════════════════════
# RENT PAYMENT RECEIPT PDF
# ═══════════════════════════════════════════════════════════════════════════

def generate_rental_receipt_pdf(payment: dict, contract: dict = None, tenant: dict = None, config: dict = None):
    """Generate a professional PDF receipt for a rental payment."""
    co = {**DEFAULT_COMPANY, **(config or {})}
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    )
    
    styles = _build_styles()
    elements = []
    
    logo_path = _get_logo_path()
    if logo_path:
        try:
            logo = RLImage(logo_path, width=1.8 * inch, height=0.78 * inch)
            logo.hAlign = 'CENTER'
            elements.append(logo)
        except Exception:
            elements.append(Paragraph(co['name'], styles['DocTitle']))
    
    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=2, color=BRAND_RED))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("PAYMENT RECEIPT / RECIBO DE PAGO", styles['DocTitle']))
    elements.append(Spacer(1, 10))
    
    receipt_number = payment.get('receipt_number', 'N/A')
    payment_date = payment.get('payment_date', BLANK_SHORT)
    total_paid = payment.get('total_paid', payment.get('amount', 0))
    tenant_name = tenant.get('name', BLANK) if tenant else payment.get('tenant_name', BLANK)
    property_address = contract.get('property_address', BLANK_LONG) if contract else payment.get('property_address', BLANK_LONG)
    
    elements.append(Paragraph(f"<b>Receipt #:</b> {receipt_number}  |  <b>Date:</b> {payment_date}", styles['Body']))
    elements.append(Paragraph(f"<b>Tenant:</b> {tenant_name}", styles['Body']))
    elements.append(Paragraph(f"<b>Property:</b> {property_address}", styles['Body']))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph(f"<b>Amount Paid / Monto Pagado: {format_currency(total_paid)}</b>", styles['DocTitle']))
    elements.append(Paragraph("✓ PAID / PAGADO", ParagraphStyle('Paid', fontSize=14, textColor=GREEN, alignment=TA_CENTER)))
    
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Paragraph(f"{co['name']} — {co['address']} | {co['phone']}", styles['Footer']))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return base64.b64encode(pdf_bytes).decode('utf-8')
