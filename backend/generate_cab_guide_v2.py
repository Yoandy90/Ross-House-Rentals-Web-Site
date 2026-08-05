"""
Generate comprehensive CAB Texas Lending Guide v2
With payment flow details, partner lenders, and exact costs
"""

import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY


def generate_cab_guide_v2():
    pdf_path = '/app/memory/Guia_CAB_Flujo_Pagos_Bancos_Texas.pdf'
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        topMargin=0.6*inch,
        bottomMargin=0.6*inch,
        leftMargin=0.7*inch,
        rightMargin=0.7*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(name='CoverTitle', fontSize=28, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), alignment=TA_CENTER,
                             spaceAfter=10, leading=34))
    styles.add(ParagraphStyle(name='CoverSubtitle', fontSize=14, fontName='Helvetica',
                             textColor=HexColor('#4a5568'), alignment=TA_CENTER,
                             spaceAfter=6, leading=18))
    styles.add(ParagraphStyle(name='SectionTitle', fontSize=18, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), spaceBefore=20, spaceAfter=10,
                             leading=22))
    styles.add(ParagraphStyle(name='SubSection', fontSize=14, fontName='Helvetica-Bold',
                             textColor=HexColor('#2d3748'), spaceBefore=14, spaceAfter=8,
                             leading=18))
    styles.add(ParagraphStyle(name='BodyText2', fontSize=11, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=6, leading=16,
                             alignment=TA_JUSTIFY))
    styles.add(ParagraphStyle(name='BulletItem', fontSize=10.5, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=4, leading=15,
                             leftIndent=20, bulletIndent=10))
    styles.add(ParagraphStyle(name='ImportantBox', fontSize=11, fontName='Helvetica-Bold',
                             textColor=HexColor('#065F46'), spaceAfter=6, leading=16,
                             leftIndent=10))
    styles.add(ParagraphStyle(name='WarningBox', fontSize=11, fontName='Helvetica-Bold',
                             textColor=HexColor('#92400E'), spaceAfter=6, leading=16,
                             leftIndent=10))
    
    elements = []
    
    # ═══════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════
    elements.append(Spacer(1, 1.5*inch))
    elements.append(Paragraph("GUÍA COMPLETA CAB", styles['CoverTitle']))
    elements.append(Paragraph("Credit Access Business en Texas", styles['CoverSubtitle']))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(HRFlowable(width="60%", thickness=3, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph("Flujo de Pagos • Bancos Afiliados • Costos de Licencia", styles['CoverSubtitle']))
    elements.append(Paragraph("Guía Paso a Paso para Ross Tax Preparation", styles['CoverSubtitle']))
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(f"Preparado: {datetime.now().strftime('%d de %B de %Y')}", styles['CoverSubtitle']))
    elements.append(Paragraph("DOCUMENTO CONFIDENCIAL", styles['CoverSubtitle']))
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 1: FLUJO DE PAGOS DETALLADO
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("1. FLUJO DE PAGOS: ¿QUIÉN COBRA QUÉ?", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph("1.1 Respuesta Directa", styles['SubSection']))
    elements.append(Paragraph(
        "<b>TÚ (Ross Tax como CAB) COBRAS TODO AL CLIENTE.</b> El cliente hace UN SOLO pago mensual "
        "directamente a ti. Tú separas internamente: te quedas con tu CAB fee y envías la porción "
        "del banco/prestamista (principal + interés) al banco afiliado.",
        styles['BodyText2']
    ))
    
    elements.append(Paragraph("1.2 Los 2 Contratos que Firma el Cliente", styles['SubSection']))
    elements.append(Paragraph(
        "• <b>Contrato 1 — Pagaré (Promissory Note):</b> El cliente firma con el banco/prestamista afiliado. "
        "Este documento establece el préstamo, el monto, el interés (máx 10% anual), y los términos de pago.",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• <b>Contrato 2 — Acuerdo CAB (Credit Services Agreement):</b> El cliente firma CONTIGO (Ross Tax). "
        "Este establece tu tarifa de intermediación (CAB fee) del 10-20% mensual. Aquí es donde está tu ganancia.",
        styles['BulletItem']
    ))
    
    elements.append(Paragraph("1.3 El Flujo Paso a Paso", styles['SubSection']))
    
    flow_data = [
        ['Paso', 'Acción', 'Quién'],
        ['1', 'Cliente solicita préstamo de $500', 'Cliente → Ross Tax'],
        ['2', 'Ross Tax evalúa al cliente y aprueba', 'Ross Tax (CAB)'],
        ['3', 'Ross Tax conecta al cliente con el banco afiliado', 'Ross Tax → Banco'],
        ['4', 'El banco transfiere $500 al cliente', 'Banco → Cliente'],
        ['5', 'Cliente firma pagaré (banco) + acuerdo CAB (Ross Tax)', 'Cliente firma ambos'],
        ['6', 'Cada mes: Cliente paga $270 a Ross Tax', 'Cliente → Ross Tax'],
        ['7', 'Ross Tax retiene $100 (CAB fee)', 'Ross Tax se queda'],
        ['8', 'Ross Tax envía $170 al banco', 'Ross Tax → Banco'],
    ]
    
    flow_table = Table(flow_data, colWidths=[0.5*inch, 3.5*inch, 2*inch])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#f7fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f0fdf4')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(flow_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Payment examples
    elements.append(Paragraph("1.4 Ejemplo Detallado de Pagos", styles['SubSection']))
    elements.append(Paragraph(
        "Préstamo de $500, CAB fee 20% mensual, 3 meses, interés del banco 10% anual:",
        styles['BodyText2']
    ))
    
    payment_data = [
        ['', 'Cliente Paga\na Ross Tax', 'Tu CAB Fee\n(te quedas)', 'Envías al\nBanco', 'Tu Ganancia\nAcumulada'],
        ['Mes 1', '$270.00', '$100.00', '$170.00', '$100.00'],
        ['Mes 2', '$270.00', '$100.00', '$170.00', '$200.00'],
        ['Mes 3', '$270.00', '$100.00', '$170.00', '$300.00'],
        ['TOTAL', '$810.00', '$300.00', '$510.00', '$300.00'],
    ]
    
    payment_table = Table(payment_data, colWidths=[0.8*inch, 1.3*inch, 1.3*inch, 1.2*inch, 1.3*inch])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#065F46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#ecfdf5')),
        ('BACKGROUND', (3, 1), (3, -2), HexColor('#fef3c7')),
        ('BACKGROUND', (4, 1), (4, -1), HexColor('#d1fae5')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#a7f3d0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(payment_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "<b>IMPORTANTE:</b> El cliente NO hace pagos separados al banco. Todo va a través de ti. "
        "Tú programas los cobros recurrentes desde tu sistema (NMI/Clover que ya tienes integrado) "
        "y luego envías la porción del banco semanalmente o mensualmente según el acuerdo.",
        styles['ImportantBox']
    ))
    
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 2: CÓMO PROGRAMAR LOS COBROS
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("2. CÓMO PROGRAMAR LOS COBROS EN TU SISTEMA", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "Ya que tienes NMI Customer Vault y Clover integrados en tu plataforma, puedes usar AMBOS "
        "para programar los cobros recurrentes de los préstamos CAB:",
        styles['BodyText2']
    ))
    
    elements.append(Paragraph("2.1 Opción A — Pago Recurrente Automático (Recomendado)", styles['SubSection']))
    elements.append(Paragraph(
        "• Cuando el cliente firma el acuerdo CAB, guardas su tarjeta/cuenta bancaria en el Customer Vault de NMI",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Programas un cargo recurrente mensual/quincenal por el monto TOTAL (CAB fee + porción banco)",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Tu sistema automáticamente separa: tu CAB fee vs porción del banco",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Tú envías la porción del banco via transferencia ACH al banco afiliado (semanal o mensual)",
        styles['BulletItem']
    ))
    
    elements.append(Paragraph("2.2 Opción B — Cobro Manual via Clover", styles['SubSection']))
    elements.append(Paragraph(
        "• El cliente viene a tu oficina y paga en persona con tarjeta/efectivo",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Registras el pago en el sistema de préstamos",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Al final de la semana/mes, haces la transferencia al banco afiliado",
        styles['BulletItem']
    ))
    
    elements.append(Paragraph("2.3 Manejo de la Porción del Banco", styles['SubSection']))
    elements.append(Paragraph(
        "<b>Cuenta Fiduciaria (Trust Account):</b> Por ley de Texas (OCCC), debes mantener una cuenta "
        "bancaria separada (trust account) donde depositas la porción del banco hasta que la transfieras. "
        "Esto protege al consumidor y es un requisito de tu licencia CAB.",
        styles['WarningBox']
    ))
    elements.append(Paragraph(
        "• Los fondos del banco NO se mezclan con tus fondos operativos",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Típicamente envías al banco semanalmente o quincenalmente",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• Llevas registro detallado de cada transacción para el reporte anual del OCCC",
        styles['BulletItem']
    ))
    
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 3: BANCOS/PRESTAMISTAS AFILIADOS
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("3. BANCOS Y PRESTAMISTAS AFILIADOS PARA CAB", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "Los prestamistas terceros (third-party lenders) NO necesitan licencia en Texas. "
        "Son bancos o entidades que ponen el capital del préstamo. Aquí están las opciones identificadas:",
        styles['BodyText2']
    ))
    
    elements.append(Paragraph("3.1 Prestamistas Conocidos que Trabajan con CABs", styles['SubSection']))
    
    lender_data = [
        ['Prestamista', 'Ubicación', 'Especialidad', 'Contacto'],
        ['NCP Finance\nLimited Partnership', 'Dayton, OH', 'Pionero del modelo\nCSO/CAB en Texas.\nPréstamos cortos.', 'ncpfinance.com'],
        ['Capital Community\nBank', 'Provo, UT', 'Banco asociado con\nNCP Finance.\nInstalaciones hasta $3,000.', 'Vía NCP Finance'],
        ['C.A.B. Consulting\n& Brokerage', 'Texas', 'Conecta CABs con\nprestamistas. Ofrece\nplantillas y acuerdos.', 'creditaccessbusiness.com'],
        ['The Business\nof Lending', 'Nacional', 'Consultoría CAB.\nAyuda a encontrar\nprestamistas.', 'thebusinessoflending.com'],
    ]
    
    lender_table = Table(lender_data, colWidths=[1.4*inch, 1*inch, 2*inch, 1.8*inch])
    lender_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f0fdf4')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(lender_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph("3.2 Cómo Encontrar un Prestamista Afiliado", styles['SubSection']))
    elements.append(Paragraph(
        "• <b>Paso 1:</b> Contacta a C.A.B. Consulting & Brokerage (creditaccessbusiness.com) — "
        "ellos conectan CABs con prestamistas y te ayudan con los contratos",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• <b>Paso 2:</b> Contacta a thebusinessoflending.com — ofrecen kits completos para CABs "
        "incluyendo acuerdos tipo con prestamistas, plantillas de contratos, y guías operativas",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• <b>Paso 3:</b> Contacta directamente a NCP Finance (ncpfinance.com) — son el prestamista "
        "más grande que trabaja con CABs en Texas",
        styles['BulletItem']
    ))
    elements.append(Paragraph(
        "• <b>Paso 4:</b> Llama al OCCC (512-936-7605) — pueden orientarte sobre prestamistas activos",
        styles['BulletItem']
    ))
    
    elements.append(Paragraph(
        "<b>REQUISITO LEGAL:</b> El prestamista debe ser INDEPENDIENTE de ti. No pueden compartir "
        "oficiales, empleados ni fondos. Debe ser una relación 'arm's-length' (independiente). "
        "Esto está en 7 Tex. Admin. Code § 83.5005.",
        styles['WarningBox']
    ))
    
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 4: COSTOS DE LICENCIA CAB
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("4. COSTOS DE LICENCIA CAB — DESGLOSE COMPLETO", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    cost_data = [
        ['Concepto', 'Costo', 'Frecuencia'],
        ['Registro CSO — Secretary of State', '$100.00', 'Una vez'],
        ['Solicitud OCCC (Application Fee)', '$200.00', 'Una vez'],
        ['Fee de Investigación (Background)', 'Variable (~$50)', 'Una vez'],
        ['Licencia de Registro (License Fee)', '$600.00', 'Una vez'],
        ['NMLS Processing Fee', '$120.00', 'Una vez'],
        ['TOTAL INICIAL (1ra Ubicación)', '$1,070.00+', 'Una vez'],
        ['', '', ''],
        ['Renovación Anual por Ubicación', '$800.00', 'Anual (Diciembre)'],
        ['Registro Municipal (si aplica)', '$50-100', 'Anual'],
        ['Software CAB (Infinity/EPIC)', '$200-500/mes', 'Mensual'],
        ['Seguro de Fianza (Surety Bond)', '$500-2,000', 'Anual'],
    ]
    
    cost_table = Table(cost_data, colWidths=[2.8*inch, 1.5*inch, 1.5*inch])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#065F46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 6), (-1, 6), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 6), (-1, 6), HexColor('#d1fae5')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#a7f3d0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, 5), [HexColor('#ffffff'), HexColor('#f0fdf4')]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(cost_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "<b>Requisito de Capital:</b> Debes demostrar un patrimonio neto (net assets) de al menos "
        "$25,000 por ubicación. No es un depósito — es lo que vale tu negocio (activos - pasivos).",
        styles['ImportantBox']
    ))
    
    # ═══════════════════════════════════════════════
    # SECTION 5: PASO A PASO PARA OBTENER LICENCIA
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("5. PASO A PASO PARA OBTENER LA LICENCIA CAB", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    steps = [
        ("Paso 1: Registrarte como CSO", 
         "Ve a sos.state.tx.us y registra tu empresa como Credit Services Organization (CSO). "
         "Costo: $100. Necesitas el certificado para la solicitud OCCC."),
        ("Paso 2: Crear cuenta en NMLS",
         "Ve a mortgage.nationwidelicensingsystem.org y crea una cuenta para tu empresa. "
         "A partir de marzo 2026, TODAS las solicitudes CAB se hacen por NMLS."),
        ("Paso 3: Preparar documentos",
         "• Statement of Experience Form (tu experiencia en finanzas/negocios)\n"
         "• Business Operating Plan (cómo operarás: fuente de clientes, tamaños de préstamos, etc.)\n"
         "• Financial Statements (estados financieros GAAP, no más de 90 días de antigüedad)\n"
         "• Bank Confirmation Form\n"
         "• Certificado CSO del Secretary of State\n"
         "• Organigrama (si tienes empresa matriz)"),
        ("Paso 4: Background Check",
         "Completar verificación de antecedentes penales y huellas digitales "
         "para todos los principales del negocio."),
        ("Paso 5: Enviar solicitud por NMLS",
         "Completa el Company Form (MU1) y el Individual Form (MU2) para cada persona de control. "
         "Paga los fees: $200 (aplicación) + $600 (licencia) + $120 (NMLS)."),
        ("Paso 6: Encontrar prestamista afiliado",
         "Mientras esperas la aprobación, contacta a NCP Finance, C.A.B. Consulting, "
         "o thebusinessoflending.com para establecer tu relación con un prestamista tercero."),
        ("Paso 7: Configurar operaciones",
         "• Abrir cuenta trust/fiduciaria separada para fondos del prestamista\n"
         "• Instalar software CAB (Infinity o EPIC) o usar tu plataforma existente\n"
         "• Preparar contratos (pagaré + acuerdo CAB)\n"
         "• Configurar cobros recurrentes en NMI/Clover"),
        ("Paso 8: Comenzar operaciones",
         "Una vez aprobada la licencia, registrarte con tu municipalidad si es requerido "
         "(Houston, Dallas, etc.) y comenzar a ofrecer préstamos."),
    ]
    
    for title, desc in steps:
        elements.append(Paragraph(title, styles['SubSection']))
        elements.append(Paragraph(desc, styles['BodyText2']))
    
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 6: TABLA DE GANANCIAS
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("6. TABLA DE GANANCIAS — PROYECCIÓN MENSUAL", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph("Con 20 clientes activos, préstamos de $200-$1,000, CAB fee 15% mensual:", styles['BodyText2']))
    
    profit_data = [
        ['Préstamo', 'CAB Fee\n15%/mes', 'Ganancia\n3 meses', 'x5 Clientes\n3 meses', 'x20 Clientes\n3 meses'],
        ['$200', '$30/mes', '$90', '$450', '$1,800'],
        ['$300', '$45/mes', '$135', '$675', '$2,700'],
        ['$500', '$75/mes', '$225', '$1,125', '$4,500'],
        ['$750', '$112.50/mes', '$337.50', '$1,687', '$6,750'],
        ['$1,000', '$150/mes', '$450', '$2,250', '$9,000'],
    ]
    
    profit_table = Table(profit_data, colWidths=[1*inch, 1.1*inch, 1.1*inch, 1.3*inch, 1.3*inch])
    profit_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (4, 1), (4, -1), HexColor('#d1fae5')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f7fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(profit_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "<b>Escenario conservador:</b> 20 clientes con préstamos promedio de $500 al 15% mensual "
        "= $4,500/mes de ganancia neta solo en CAB fees. "
        "Esto es ADICIONAL a tus ingresos por preparación de impuestos.",
        styles['ImportantBox']
    ))
    
    # ═══════════════════════════════════════════════
    # SECTION 7: SOFTWARE Y SISTEMA
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("7. SOFTWARE CAB vs TU SISTEMA ACTUAL", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "Tu plataforma Ross Tax YA TIENE el 80% de lo necesario para operar como CAB:",
        styles['BodyText2']
    ))
    
    system_data = [
        ['Funcionalidad CAB', 'Software Externo\n(Infinity/EPIC)', 'Ross Tax\nPlataforma Actual'],
        ['Gestión de préstamos', '✅', '✅ Ya tienes módulo de préstamos'],
        ['Calendario de pagos', '✅', '✅ Ya genera PDF con calendario'],
        ['Cobros recurrentes', '✅', '✅ NMI Customer Vault + Auto-pay'],
        ['Registro de pagos', '✅', '✅ Historial completo'],
        ['Portal del cliente', '✅', '✅ App móvil con vista de préstamo'],
        ['Reportes OCCC', '✅', '⚠️ Necesita desarrollo'],
        ['Contratos CAB', '✅ Plantillas', '⚠️ Necesita plantillas legales'],
        ['Trust Account mgmt', '✅', '⚠️ Necesita separación de cuentas'],
    ]
    
    system_table = Table(system_data, colWidths=[1.8*inch, 1.8*inch, 2.4*inch])
    system_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#065F46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#ffffff')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#a7f3d0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#ffffff'), HexColor('#f0fdf4')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(system_table)
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(Paragraph(
        "<b>Recomendación:</b> No necesitas comprar Infinity o EPIC ($200-500/mes). Tu plataforma "
        "puede manejar el 80%. Solo necesitas: 1) Plantillas de contratos legales (un abogado las prepara ~$500-1,000), "
        "2) Configurar reportes OCCC, y 3) Abrir la cuenta trust separada.",
        styles['ImportantBox']
    ))
    
    elements.append(PageBreak())
    
    # ═══════════════════════════════════════════════
    # SECTION 8: RECURSOS Y CONTACTOS
    # ═══════════════════════════════════════════════
    elements.append(Paragraph("8. RECURSOS Y CONTACTOS CLAVE", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    
    resources = [
        ("OCCC — Office of Consumer Credit Commissioner",
         "occc.texas.gov/industry/cab/\nTeléfono: (512) 936-7605\nLicencias, renovaciones, reportes anuales"),
        ("NMLS — Nationwide Multistate Licensing System",
         "mortgage.nationwidelicensingsystem.org\nCall Center: 1-855-665-7123\nSolicitud de licencia CAB (obligatorio desde marzo 2026)"),
        ("Texas Secretary of State — CSO Registration",
         "sos.state.tx.us/statdoc/cso.shtml\nRegistro como Credit Services Organization"),
        ("NCP Finance — Prestamista Afiliado",
         "ncpfinance.com\nPrestamista líder para CABs en Texas"),
        ("C.A.B. Consulting & Brokerage",
         "creditaccessbusiness.com/3rd-party-lender/\nConecta CABs con prestamistas, ofrece plantillas"),
        ("The Business of Lending",
         "thebusinessoflending.com/texas-cab-cso/\nKit completo para iniciar un CAB"),
        ("OCCC Formulario CAB12 — Lista de Prestamistas",
         "occc.texas.gov/wp-content/uploads/2025/11/cab12-third-party-lenders.pdf\nFormulario para declarar tus prestamistas afiliados"),
    ]
    
    for title, desc in resources:
        elements.append(Paragraph(f"<b>{title}</b>", styles['SubSection']))
        elements.append(Paragraph(desc, styles['BodyText2']))
    
    elements.append(Spacer(1, 0.3*inch))
    elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#10B981')))
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(
        "Este documento fue preparado por Ross Tax Preparation como guía de referencia. "
        "Se recomienda consultar con un abogado especializado en regulación financiera "
        "antes de iniciar operaciones como CAB.",
        styles['BodyText2']
    ))
    elements.append(Paragraph(
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} — Confidencial",
        styles['CoverSubtitle']
    ))
    
    doc.build(elements)
    print(f"✅ PDF generated: {pdf_path}")
    return pdf_path


def send_pdf_email(pdf_path):
    """Send the PDF via SendGrid"""
    import base64
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
    FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
    TO_EMAIL = 'yoandyross@gmail.com'
    
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    encoded_pdf = base64.b64encode(pdf_data).decode('utf-8')
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=TO_EMAIL,
        subject='📋 Guía CAB Actualizada: Flujo de Pagos + Bancos Afiliados + Costos — Ross Tax',
        html_content="""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #065F46 0%, #10B981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Ross Tax Preparation</h1>
                <p style="color: #d1fae5; margin: 5px 0 0;">Guía CAB Actualizada v2</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Hola Yoandy,</h2>
                <p style="color: #4a5568; line-height: 1.6;">
                    Adjunto la guía actualizada con toda la información que pediste:
                </p>
                <ul style="color: #4a5568; line-height: 1.8;">
                    <li>✅ <b>Flujo de pagos detallado</b> — Quién cobra qué y cómo</li>
                    <li>✅ <b>TÚ cobras TODO</b> al cliente y envías la porción del banco</li>
                    <li>✅ <b>Bancos afiliados</b> — NCP Finance, Capital Community Bank, consultoras</li>
                    <li>✅ <b>Costos exactos</b> — ~$1,070 inicial + $800/año renovación</li>
                    <li>✅ <b>Paso a paso</b> para obtener la licencia CAB via NMLS</li>
                    <li>✅ <b>Tabla de ganancias</b> — Proyección con 20 clientes</li>
                    <li>✅ <b>Tu sistema ya tiene el 80%</b> de lo necesario</li>
                </ul>
                <div style="background: #ecfdf5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="color: #065f46; margin: 0;">
                        <b>Resumen:</b> El cliente te paga TODO a ti. Tú te quedas con el CAB fee (10-20%) 
                        y envías la parte del banco. Necesitas ~$1,070 para la licencia + un prestamista afiliado.
                    </p>
                </div>
            </div>
            <div style="background: #f7fafc; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
                <p style="color: #a0aec0; font-size: 12px; margin: 0;">Ross Tax — Abril 2026 — Confidencial</p>
            </div>
        </div>
        """
    )
    
    attachment = Attachment()
    attachment.file_content = FileContent(encoded_pdf)
    attachment.file_name = FileName('Guia_CAB_Flujo_Pagos_Bancos_Texas_RossTax.pdf')
    attachment.file_type = FileType('application/pdf')
    attachment.disposition = Disposition('attachment')
    message.attachment = attachment
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"✅ Email enviado a {TO_EMAIL} — Status: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == '__main__':
    pdf_path = generate_cab_guide_v2()
    send_pdf_email(pdf_path)
