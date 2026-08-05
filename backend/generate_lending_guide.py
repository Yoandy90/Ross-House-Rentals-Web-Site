"""
Generate comprehensive PDF guide for Texas lending licenses
"""
import os
import sys
sys.path.insert(0, '/app/backend')

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT

def generate_lending_guide_pdf():
    output_path = '/app/memory/Guia_Completa_Licencias_Prestamos_Texas.pdf'
    doc = SimpleDocTemplate(output_path, pagesize=letter, 
                           leftMargin=0.75*inch, rightMargin=0.75*inch,
                           topMargin=0.6*inch, bottomMargin=0.6*inch)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(name='CoverTitle', fontSize=28, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), alignment=TA_CENTER, spaceAfter=10, leading=34))
    styles.add(ParagraphStyle(name='CoverSub', fontSize=14, fontName='Helvetica',
                             textColor=HexColor('#4a4a6a'), alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle(name='SectionTitle', fontSize=18, fontName='Helvetica-Bold',
                             textColor=HexColor('#0d6efd'), spaceBefore=20, spaceAfter=10, leading=22))
    styles.add(ParagraphStyle(name='SubTitle', fontSize=14, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), spaceBefore=14, spaceAfter=6, leading=18))
    styles.add(ParagraphStyle(name='Body', fontSize=10.5, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=6, leading=15, alignment=TA_JUSTIFY))
    styles.add(ParagraphStyle(name='BodyBold', fontSize=10.5, fontName='Helvetica-Bold',
                             textColor=HexColor('#1a1a2e'), spaceAfter=4, leading=15))
    styles.add(ParagraphStyle(name='BulletCustom', fontSize=10.5, fontName='Helvetica',
                             textColor=HexColor('#333333'), spaceAfter=3, leading=15,
                             leftIndent=20, bulletIndent=10))
    styles.add(ParagraphStyle(name='StepTitle', fontSize=12, fontName='Helvetica-Bold',
                             textColor=HexColor('#059669'), spaceBefore=10, spaceAfter=4, leading=16))
    styles.add(ParagraphStyle(name='Warning', fontSize=10.5, fontName='Helvetica-Bold',
                             textColor=HexColor('#dc2626'), spaceBefore=8, spaceAfter=6, leading=15,
                             leftIndent=10, borderColor=HexColor('#dc2626'), borderWidth=1, borderPadding=6))
    styles.add(ParagraphStyle(name='Success', fontSize=10.5, fontName='Helvetica-Bold',
                             textColor=HexColor('#059669'), spaceBefore=8, spaceAfter=6, leading=15,
                             leftIndent=10))
    styles.add(ParagraphStyle(name='TableHeader', fontSize=9, fontName='Helvetica-Bold',
                             textColor=white, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='TableCell', fontSize=9, fontName='Helvetica',
                             textColor=HexColor('#333'), alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='TableCellLeft', fontSize=9, fontName='Helvetica',
                             textColor=HexColor('#333'), alignment=TA_LEFT))
    styles.add(ParagraphStyle(name='Footer', fontSize=8, fontName='Helvetica-Oblique',
                             textColor=HexColor('#999'), alignment=TA_CENTER, spaceBefore=20))

    elements = []
    
    GREEN = HexColor('#059669')
    DARK = HexColor('#1a1a2e')
    BLUE = HexColor('#0d6efd')
    RED = HexColor('#dc2626')
    ORANGE = HexColor('#f59e0b')
    LIGHT_BG = HexColor('#f8f9fa')
    LIGHT_GREEN = HexColor('#ecfdf5')
    LIGHT_BLUE = HexColor('#eff6ff')
    LIGHT_RED = HexColor('#fef2f2')
    LIGHT_ORANGE = HexColor('#fffbeb')

    # ═══════════════════ COVER ═══════════════════
    elements.append(Spacer(1, 80))
    elements.append(Paragraph("GUÍA COMPLETA", styles['CoverTitle']))
    elements.append(Paragraph("Licencias para Ofrecer Préstamos en Texas", styles['CoverSub']))
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="60%", thickness=3, color=GREEN))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Ross Tax Preparation", ParagraphStyle('x', fontSize=16, fontName='Helvetica-Bold', textColor=GREEN, alignment=TA_CENTER)))
    elements.append(Paragraph("Préstamos de $200 a $1,000", ParagraphStyle('x2', fontSize=13, fontName='Helvetica', textColor=HexColor('#666'), alignment=TA_CENTER, spaceAfter=30)))
    
    # Summary box
    summary_data = [
        [Paragraph('<b>3 OPCIONES DE LICENCIA ANALIZADAS</b>', ParagraphStyle('x3', fontSize=12, fontName='Helvetica-Bold', textColor=DARK, alignment=TA_CENTER))],
        [Paragraph('Opción 1: Regulated Lender License (Tasas Bajas - Max 30% APR)', ParagraphStyle('x4', fontSize=10, textColor=HexColor('#333'), alignment=TA_CENTER))],
        [Paragraph('Opción 2: Credit Access Business CAB (Sin Límite de Tarifas - 10-20%/mes)', ParagraphStyle('x5', fontSize=10, textColor=HexColor('#333'), alignment=TA_CENTER))],
        [Paragraph('Opción 3: Licencia Dual (Ambas Licencias)', ParagraphStyle('x6', fontSize=10, textColor=HexColor('#333'), alignment=TA_CENTER))],
    ]
    st = Table(summary_data, colWidths=[430])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_GREEN),
        ('BACKGROUND', (0,1), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, GREEN),
        ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(st)
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("Preparado: Abril 2026", ParagraphStyle('x7', fontSize=10, textColor=HexColor('#999'), alignment=TA_CENTER)))
    elements.append(Paragraph("Confidencial — Solo para uso interno", ParagraphStyle('x8', fontSize=9, textColor=RED, alignment=TA_CENTER)))
    
    elements.append(PageBreak())
    
    # ═══════════════════ TABLE OF CONTENTS ═══════════════════
    elements.append(Paragraph("CONTENIDO", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    toc_items = [
        "1. Resumen Comparativo de las 3 Opciones",
        "2. OPCIÓN 1: Regulated Lender License (Tasas Bajas)",
        "3. OPCIÓN 2: Credit Access Business — CAB (Tasas Altas)",
        "4. OPCIÓN 3: Licencia Dual",
        "5. Ejemplos Detallados de Préstamos por Opción",
        "6. ¿Se Puede Cobrar 10-20% Mensual Legalmente?",
        "7. Comparación de Ganancias por Opción",
        "8. Paso a Paso para Cada Licencia",
        "9. Ajustes Necesarios en el Sistema",
        "10. Recursos y Contactos",
    ]
    for item in toc_items:
        elements.append(Paragraph(item, styles['Body']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 1: COMPARISON ═══════════════════
    elements.append(Paragraph("1. RESUMEN COMPARATIVO DE LAS 3 OPCIONES", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    comp_header = [
        Paragraph('<b>Aspecto</b>', styles['TableHeader']),
        Paragraph('<b>Opción 1: Regulated Lender</b>', styles['TableHeader']),
        Paragraph('<b>Opción 2: CAB</b>', styles['TableHeader']),
    ]
    comp_data = [comp_header]
    
    rows = [
        ['Capítulo Legal', 'Cap. 342, Subcap. E', 'Cap. 393 (CSO)'],
        ['Rol', 'Prestamista directo', 'Intermediario/Broker'],
        ['Tasa Máxima', '30% APR (anual)', 'SIN LÍMITE en tarifas'],
        ['% Mensual Equivalente', '~2.5% mensual máx.', '10-20%+ mensual (legal)'],
        ['Costo de Licencia', '~$920', '~$920 + CSO $100'],
        ['Capital Mínimo', '$25,000', '$25,000 por local'],
        ['Fianza (Bond)', 'No requerida', 'No requerida'],
        ['Requiere 3er Prestamista', 'No', 'SÍ (obligatorio)'],
        ['Ganancia en $800 (1 mes)', '~$18.50', '~$160 (al 20%)'],
        ['Complejidad', 'Baja', 'Media-Alta'],
        ['Riesgo Regulatorio', 'Bajo', 'Medio (más escrutinio)'],
    ]
    for r in rows:
        comp_data.append([
            Paragraph(r[0], styles['TableCellLeft']),
            Paragraph(r[1], styles['TableCell']),
            Paragraph(r[2], styles['TableCell']),
        ])
    
    ct = Table(comp_data, colWidths=[150, 155, 155])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(ct)
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 2: OPTION 1 ═══════════════════
    elements.append(Paragraph("2. OPCIÓN 1: REGULATED LENDER LICENSE", styles['SectionTitle']))
    elements.append(Paragraph("Capítulo 342, Subcapítulo E — Préstamos de Consumo Directos", styles['SubTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Con esta licencia eres el prestamista directo. Tú pones el dinero y cobras intereses dentro de los límites establecidos por ley.", styles['Body']))
    
    elements.append(Paragraph("Tasas de Interés Máximas Permitidas:", styles['SubTitle']))
    rate_data = [
        [Paragraph('<b>Rango del Préstamo</b>', styles['TableHeader']),
         Paragraph('<b>Tasa Máxima Anual (APR)</b>', styles['TableHeader']),
         Paragraph('<b>Equivalente Mensual</b>', styles['TableHeader'])],
        ['Primeros $500', '30% APR', '2.5% mensual'],
        ['$500 - $1,050', '24% APR', '2.0% mensual'],
        ['$1,050 - $2,500', '18% APR', '1.5% mensual'],
    ]
    for i in range(1, len(rate_data)):
        rate_data[i] = [Paragraph(rate_data[i][j], styles['TableCell']) for j in range(3)]
    rt = Table(rate_data, colWidths=[153, 153, 153])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GREEN]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(rt)
    
    elements.append(Paragraph("Ventajas:", styles['SubTitle']))
    for v in ["No necesitas un tercero — tú eres el prestamista directo",
              "Proceso de licencia más simple",
              "No requiere fianza ni estados financieros auditados",
              "Menos escrutinio regulatorio",
              "Buena reputación con los clientes (tasas razonables)"]:
        elements.append(Paragraph(f"✅ {v}", styles['BulletCustom']))
    
    elements.append(Paragraph("Desventajas:", styles['SubTitle']))
    for d in ["Ganancias por intereses mucho más bajas",
              "En un préstamo de $800 a 1 mes solo ganas ~$18.50",
              "Necesitas volumen alto de préstamos para ser rentable"]:
        elements.append(Paragraph(f"❌ {d}", styles['BulletCustom']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 3: OPTION 2 — CAB ═══════════════════
    elements.append(Paragraph("3. OPCIÓN 2: CREDIT ACCESS BUSINESS (CAB)", styles['SectionTitle']))
    elements.append(Paragraph("Capítulo 393 — Intermediario de Crédito (Payday/Title Loans)", styles['SubTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph('<b>ESTA ES LA LICENCIA QUE PERMITE COBRAR 10-20% MENSUAL LEGALMENTE.</b>', styles['Success']))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Con la licencia CAB, NO eres el prestamista directo. Actúas como intermediario (broker) que conecta al cliente con un prestamista tercero. La clave es que tus tarifas de servicio de crédito (CAB fees) NO tienen límite en Texas.", styles['Body']))
    
    elements.append(Paragraph("¿Cómo funciona el modelo CAB?", styles['SubTitle']))
    steps_cab = [
        "1. El cliente viene a Ross Tax y pide un préstamo de $800",
        "2. Ross Tax (como CAB) evalúa al cliente y lo conecta con un prestamista tercero",
        "3. El prestamista tercero aprueba y desembolsa los $800 al cliente",
        "4. El prestamista cobra ~10% APR de interés (≈ $6.67 en 1 mes)",
        "5. Ross Tax cobra una TARIFA DE SERVICIO separada: 20% = $160",
        "6. El cliente paga: $800 + $6.67 (interés) + $160 (tarifa CAB) = $966.67",
        "7. Ross Tax se queda con los $160 de tarifa",
    ]
    for s in steps_cab:
        elements.append(Paragraph(s, styles['BulletCustom']))
    
    elements.append(Paragraph("Tarifas CAB Típicas en Texas (SIN LÍMITE LEGAL):", styles['SubTitle']))
    cab_data = [
        [Paragraph('<b>Préstamo</b>', styles['TableHeader']),
         Paragraph('<b>Tarifa 10%</b>', styles['TableHeader']),
         Paragraph('<b>Tarifa 15%</b>', styles['TableHeader']),
         Paragraph('<b>Tarifa 20%</b>', styles['TableHeader']),
         Paragraph('<b>APR Efectivo</b>', styles['TableHeader'])],
    ]
    cab_rows = [
        ['$200', '$20', '$30', '$40', '~521%'],
        ['$300', '$30', '$45', '$60', '~521%'],
        ['$500', '$50', '$75', '$100', '~521%'],
        ['$800', '$80', '$120', '$160', '~521%'],
        ['$1,000', '$100', '$150', '$200', '~521%'],
    ]
    for r in cab_rows:
        cab_data.append([Paragraph(r[j], styles['TableCell']) for j in range(5)])
    
    cabt = Table(cab_data, colWidths=[80, 80, 80, 80, 90])
    cabt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#dc2626')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_RED]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(cabt)
    
    elements.append(Paragraph("Requisito CLAVE del modelo CAB:", styles['SubTitle']))
    elements.append(Paragraph("<b>NECESITAS UN PRESTAMISTA TERCERO.</b> Tú NO puedes ser el prestamista y el CAB al mismo tiempo. Opciones:", styles['Body']))
    for o in [
        "Asociarte con un banco o prestamista fuera de Texas",
        "Usar una empresa de lending-as-a-service (ej: LoanPro, QC Holdings)",
        "Crear una segunda entidad legal separada que actúe como prestamista",
    ]:
        elements.append(Paragraph(f"• {o}", styles['BulletCustom']))
    
    elements.append(Paragraph("Ventajas:", styles['SubTitle']))
    for v in ["SIN LÍMITE en tarifas de servicio — puedes cobrar 10%, 15%, 20% o más",
              "Es el modelo que usan Ace Cash Express, CheckCity, etc.",
              "Ganancia alta por préstamo ($160 en un préstamo de $800 al 20%)",
              "Legal y regulado por OCCC"]:
        elements.append(Paragraph(f"✅ {v}", styles['BulletCustom']))
    
    elements.append(Paragraph("Desventajas:", styles['SubTitle']))
    for d in ["Necesitas un prestamista tercero (no puedes prestar tú directamente)",
              "Más documentación y divulgaciones requeridas",
              "45+ ciudades en Texas tienen restricciones adicionales (Dallas, Austin, etc.)",
              "Mayor escrutinio de OCCC y consumidores",
              "Registro adicional como CSO (Credit Services Organization): $100"]:
        elements.append(Paragraph(f"❌ {d}", styles['BulletCustom']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 4: DUAL ═══════════════════
    elements.append(Paragraph("4. OPCIÓN 3: LICENCIA DUAL", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 8))
    
    elements.append(Paragraph("Puedes obtener AMBAS licencias. Esto te da flexibilidad máxima:", styles['Body']))
    for d in [
        "Usa Regulated Lender para clientes que prefieren tasas bajas y plazos largos",
        "Usa CAB para préstamos de emergencia a corto plazo con tarifas más altas",
        "Ofrece ambas opciones al cliente y deja que elija",
    ]:
        elements.append(Paragraph(f"• {d}", styles['BulletCustom']))
    
    elements.append(Paragraph("Costo total: ~$1,840 + $25,000 capital + prestamista tercero para CAB", styles['BodyBold']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 5: EXAMPLES ═══════════════════
    elements.append(Paragraph("5. EJEMPLOS DETALLADOS DE PRÉSTAMOS", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    # Example 1: $500 loan
    elements.append(Paragraph("EJEMPLO 1: Préstamo de $500 — Pago Semanal (4 semanas)", styles['SubTitle']))
    
    ex1_data = [
        [Paragraph('<b>Concepto</b>', styles['TableHeader']),
         Paragraph('<b>Regulated Lender</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 15%</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 20%</b>', styles['TableHeader'])],
        ['Principal', '$500.00', '$500.00', '$500.00'],
        ['Interés/Tarifa', '$12.50 (30% APR)', '$75.00 (15% fee)', '$100.00 (20% fee)'],
        ['Total a Pagar', '$512.50', '$575.00', '$600.00'],
        ['Pago Semanal (x4)', '$128.13', '$143.75', '$150.00'],
        ['Ganancia para Ross Tax', '$12.50', '$75.00', '$100.00'],
    ]
    for i in range(1, len(ex1_data)):
        ex1_data[i] = [Paragraph(ex1_data[i][j], styles['TableCell']) for j in range(4)]
    e1t = Table(ex1_data, colWidths=[120, 120, 110, 110])
    e1t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(e1t)
    elements.append(Spacer(1, 10))
    
    # Example 2: $800 loan
    elements.append(Paragraph("EJEMPLO 2: Préstamo de $800 — Pago Semanal (4 semanas)", styles['SubTitle']))
    
    ex2_data = [
        [Paragraph('<b>Concepto</b>', styles['TableHeader']),
         Paragraph('<b>Regulated Lender</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 15%</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 20%</b>', styles['TableHeader'])],
        ['Principal', '$800.00', '$800.00', '$800.00'],
        ['Interés/Tarifa', '$18.50 (blended)', '$120.00 (15% fee)', '$160.00 (20% fee)'],
        ['Total a Pagar', '$818.50', '$920.00', '$960.00'],
        ['Pago Semanal (x4)', '$204.63', '$230.00', '$240.00'],
        ['Ganancia para Ross Tax', '$18.50', '$120.00', '$160.00'],
    ]
    for i in range(1, len(ex2_data)):
        ex2_data[i] = [Paragraph(ex2_data[i][j], styles['TableCell']) for j in range(4)]
    e2t = Table(ex2_data, colWidths=[120, 120, 110, 110])
    e2t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(e2t)
    elements.append(Spacer(1, 10))
    
    # Example 3: $1000 loan
    elements.append(Paragraph("EJEMPLO 3: Préstamo de $1,000 — Pago Quincenal (2 pagos)", styles['SubTitle']))
    
    ex3_data = [
        [Paragraph('<b>Concepto</b>', styles['TableHeader']),
         Paragraph('<b>Regulated Lender</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 10%</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 20%</b>', styles['TableHeader'])],
        ['Principal', '$1,000.00', '$1,000.00', '$1,000.00'],
        ['Interés/Tarifa', '$22.50 (blended)', '$100.00 (10% fee)', '$200.00 (20% fee)'],
        ['Total a Pagar', '$1,022.50', '$1,100.00', '$1,200.00'],
        ['Pago Quincenal (x2)', '$511.25', '$550.00', '$600.00'],
        ['Ganancia para Ross Tax', '$22.50', '$100.00', '$200.00'],
    ]
    for i in range(1, len(ex3_data)):
        ex3_data[i] = [Paragraph(ex3_data[i][j], styles['TableCell']) for j in range(4)]
    e3t = Table(ex3_data, colWidths=[120, 120, 110, 110])
    e3t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(e3t)
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 6: CAN YOU CHARGE 10-20%? ═══════════════════
    elements.append(Paragraph("6. ¿SE PUEDE COBRAR 10-20% MENSUAL LEGALMENTE?", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("<b>RESPUESTA: SÍ, pero SOLO con la licencia CAB (Credit Access Business).</b>", styles['Success']))
    elements.append(Spacer(1, 6))
    
    elements.append(Paragraph("Texas es uno de los pocos estados que permite tarifas altas sin límite bajo el modelo CAB. Así funciona legalmente:", styles['Body']))
    
    legal_data = [
        [Paragraph('<b>¿Qué cobras?</b>', styles['TableHeader']),
         Paragraph('<b>¿Es legal?</b>', styles['TableHeader']),
         Paragraph('<b>¿Con qué licencia?</b>', styles['TableHeader'])],
        ['10% mensual como INTERÉS directo', '❌ NO — excede 30% APR', 'No hay licencia que lo permita como interés'],
        ['10% mensual como TARIFA CAB', '✅ SÍ — sin límite', 'CAB License (Cap. 393)'],
        ['15% mensual como TARIFA CAB', '✅ SÍ — sin límite', 'CAB License (Cap. 393)'],
        ['20% mensual como TARIFA CAB', '✅ SÍ — sin límite', 'CAB License (Cap. 393)'],
        ['20% mensual como INTERÉS', '❌ NO — usura', 'NINGUNA licencia lo permite como interés'],
    ]
    for i in range(1, len(legal_data)):
        legal_data[i] = [Paragraph(legal_data[i][j], styles['TableCellLeft']) for j in range(3)]
    lt = Table(legal_data, colWidths=[160, 130, 170])
    lt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#7c3aed')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, HexColor('#f5f3ff')]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(lt)
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("<b>LA DIFERENCIA CLAVE:</b> Bajo el modelo CAB, lo que cobras NO es 'interés'. Es una 'tarifa de servicio de acceso al crédito'. El interés lo cobra el prestamista tercero (usualmente ~10% APR). Tu tarifa es SEPARADA y no tiene límite legal en Texas.", styles['Body']))
    
    elements.append(Paragraph("Empresas que operan así en Texas:", styles['SubTitle']))
    for co in ["Ace Cash Express — APR efectivo 661%",
               "CheckCity — APR efectivo 579-610%",
               "LendNation — APR efectivo 310-660%",
               "Advance America — operan en todo Texas con modelo CAB"]:
        elements.append(Paragraph(f"• {co}", styles['BulletCustom']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 7: PROFIT COMPARISON ═══════════════════
    elements.append(Paragraph("7. COMPARACIÓN DE GANANCIAS POR OPCIÓN", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("Escenario: 20 préstamos de $500 al mes", styles['SubTitle']))
    
    profit_data = [
        [Paragraph('<b>Métrica</b>', styles['TableHeader']),
         Paragraph('<b>Regulated Lender</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 15%</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 20%</b>', styles['TableHeader'])],
        ['Ganancia por préstamo', '$12.50', '$75.00', '$100.00'],
        ['20 préstamos/mes', '$250.00', '$1,500.00', '$2,000.00'],
        ['Ganancia anual', '$3,000.00', '$18,000.00', '$24,000.00'],
    ]
    for i in range(1, len(profit_data)):
        profit_data[i] = [Paragraph(profit_data[i][j], styles['TableCell']) for j in range(4)]
    pt = Table(profit_data, colWidths=[120, 120, 110, 110])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GREEN]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(pt)
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("Escenario: 20 préstamos de $800 al mes", styles['SubTitle']))
    profit_data2 = [
        [Paragraph('<b>Métrica</b>', styles['TableHeader']),
         Paragraph('<b>Regulated Lender</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 15%</b>', styles['TableHeader']),
         Paragraph('<b>CAB al 20%</b>', styles['TableHeader'])],
        ['Ganancia por préstamo', '$18.50', '$120.00', '$160.00'],
        ['20 préstamos/mes', '$370.00', '$2,400.00', '$3,200.00'],
        ['Ganancia anual', '$4,440.00', '$28,800.00', '$38,400.00'],
    ]
    for i in range(1, len(profit_data2)):
        profit_data2[i] = [Paragraph(profit_data2[i][j], styles['TableCell']) for j in range(4)]
    pt2 = Table(profit_data2, colWidths=[120, 120, 110, 110])
    pt2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), GREEN),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GREEN]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(pt2)
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 8: STEP BY STEP ═══════════════════
    elements.append(Paragraph("8. PASO A PASO PARA CADA LICENCIA", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    
    # OPTION 1 STEPS
    elements.append(Paragraph("REGULATED LENDER LICENSE — Paso a Paso", styles['SubTitle']))
    
    reg_steps = [
        ("PASO 1: Verificar Patrimonio Neto (1 semana)", [
            "Confirma que la empresa tiene $25,000+ en activos netos",
            "Prepara estados financieros (no necesitan ser auditados)",
            "Si no son auditados: deben tener menos de 60 días y confirmación bancaria",
        ]),
        ("PASO 2: Crear Cuenta NMLS (1 día)", [
            "Ve a https://mortgage.nationwidelicensingsystem.org",
            "Crea cuenta como 'Company'",
            "Recibes un NMLS ID único",
        ]),
        ("PASO 3: Completar Solicitud MU1 (3-5 días)", [
            "Información de la empresa (nombre, EIN, dirección)",
            "Selecciona 'Regulated Lender License — Texas'",
            "Información de principal parties (dueños con 10%+)",
            "Sube estados financieros y plan de negocio",
        ]),
        ("PASO 4: Pagar Tarifas (mismo día)", [
            "Application Fee: $200",
            "License Fee: $600",
            "NMLS Processing: $120",
            "Total: ~$920",
        ]),
        ("PASO 5: Fingerprints (1-2 semanas)", [
            "Programa cita en IdentoGO (https://www.identogo.com)",
            "Huellas digitales se envían al FBI electrónicamente",
            "Resultados llegan a NMLS en 7-14 días",
        ]),
        ("PASO 6: Esperar Aprobación OCCC (4-8 semanas)", [
            "OCCC revisa tu solicitud completa",
            "Pueden pedir documentos adicionales",
            "Contacto: (512) 936-7600",
        ]),
        ("PASO 7: Recibir Licencia", [
            "Exhibir licencia en tu local",
            "Comenzar a hacer préstamos inmediatamente",
            "Renovar cada año (Nov 1 - Dic 31)",
        ]),
    ]
    
    for title, items in reg_steps:
        elements.append(Paragraph(title, styles['StepTitle']))
        for item in items:
            elements.append(Paragraph(f"   • {item}", styles['BulletCustom']))
    
    elements.append(Spacer(1, 15))
    
    # OPTION 2 STEPS
    elements.append(Paragraph("CREDIT ACCESS BUSINESS (CAB) — Paso a Paso", styles['SubTitle']))
    
    cab_steps = [
        ("PASO 1: Registrarte como CSO (1 semana)", [
            "Registra la empresa como Credit Services Organization (CSO)",
            "Presenta formulario con Texas Secretary of State",
            "Costo: $100",
            "Obtén certificado CSO con dirección exacta del local",
        ]),
        ("PASO 2: Encontrar Prestamista Tercero (2-4 semanas)", [
            "OBLIGATORIO — No puedes ser CAB y prestamista a la vez",
            "Opciones: banco fuera de Texas, fintech de lending-as-a-service",
            "El prestamista provee los fondos del préstamo",
            "Tú cobras la tarifa de servicio separadamente",
        ]),
        ("PASO 3: Crear Cuenta NMLS (1 día)", [
            "Igual que Regulated Lender — ve a NMLS portal",
            "Primero cuenta de Company, luego Branch por cada local",
        ]),
        ("PASO 4: Completar Solicitud CAB en NMLS (3-5 días)", [
            "Solicitud MU1 — selecciona 'Credit Access Business — Texas'",
            "Sube certificado CSO",
            "Estados financieros mostrando $25,000+ net assets",
            "Background check para principal parties",
            "Plan de negocio describiendo operación CAB",
        ]),
        ("PASO 5: Pagar Tarifas", [
            "Application Fee: $200",
            "Investigation Fee: $600",
            "NMLS Processing: $120",
            "CSO Registration: $100",
            "Total: ~$1,020",
        ]),
        ("PASO 6: Fingerprints + Background Check (1-2 semanas)", [
            "Igual que Regulated Lender — IdentoGO",
        ]),
        ("PASO 7: Aprobación OCCC (4-8 semanas)", [
            "Revisión de solicitud completa",
            "Verificación del prestamista tercero",
        ]),
        ("PASO 8: Configurar Operación", [
            "Establecer contrato con prestamista tercero",
            "Crear formularios de divulgación CAB (separados del contrato de préstamo)",
            "Publicar schedule de tarifas en el local",
            "Los contratos deben mostrar: tarifa CAB en dólares + APR total",
        ]),
    ]
    
    for title, items in cab_steps:
        elements.append(Paragraph(title, styles['StepTitle']))
        for item in items:
            elements.append(Paragraph(f"   • {item}", styles['BulletCustom']))
    
    elements.append(PageBreak())
    
    # ═══════════════════ SECTION 9: SYSTEM ADJUSTMENTS ═══════════════════
    elements.append(Paragraph("9. AJUSTES NECESARIOS EN EL SISTEMA", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    elements.append(Paragraph("Si eliges CAB (Opción 2), tu sistema actual de préstamos necesita estos cambios:", styles['Body']))
    
    adj_items = [
        ("Separar Interés de Tarifa CAB", "El contrato debe mostrar dos cargos: el interés del prestamista tercero (~10% APR) y la tarifa CAB (tu 10-20%). Son conceptos legalmente distintos."),
        ("Agregar Divulgaciones Obligatorias", "Cada contrato necesita: APR total en %, cargo financiero total en $, derecho a plan de pago de 60 días, y schedule de tarifas publicado."),
        ("Actualizar PDF del Contrato", "El PDF debe incluir sección clara de 'Credit Access Business Fee' separada del interés. Incluir aviso: 'Ross Tax Preparation actúa como Credit Access Business, no como prestamista directo.'"),
        ("Registrar Prestamista Tercero", "El sistema debe registrar el nombre del prestamista tercero en cada préstamo para cumplimiento."),
        ("Cargos por Mora", "Máximo 5% del pago vencido, solo después de 10 días de atraso (para préstamos ≥$100)."),
    ]
    
    for title, desc in adj_items:
        elements.append(Paragraph(f"▸ {title}", styles['BodyBold']))
        elements.append(Paragraph(desc, styles['Body']))
    
    # ═══════════════════ SECTION 10: RESOURCES ═══════════════════
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("10. RECURSOS Y CONTACTOS", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 10))
    
    res_data = [
        [Paragraph('<b>Recurso</b>', styles['TableHeader']),
         Paragraph('<b>Detalle</b>', styles['TableHeader'])],
        ['OCCC Texas', 'https://occc.texas.gov — (512) 936-7600'],
        ['Portal NMLS', 'https://mortgage.nationwidelicensingsystem.org'],
        ['Checklist Regulated Lender', 'https://occc.texas.gov/industry/regulated-lenders/licensing-forms/'],
        ['Checklist CAB', 'https://occc.texas.gov/industry/cab/licensing-forms/'],
        ['IdentoGO (Fingerprints)', 'https://www.identogo.com'],
        ['Código Financiero Cap. 342', 'https://statutes.capitol.texas.gov/GetStatute.aspx?Code=FI&Value=342'],
        ['Código Financiero Cap. 393', 'https://statutes.capitol.texas.gov/GetStatute.aspx?Code=FI&Value=393'],
        ['NMLS Help Center', '(855) 665-7123 — Lun-Vie 9am-9pm ET'],
        ['Email OCCC', 'consumer.credit@occc.texas.gov'],
    ]
    for i in range(1, len(res_data)):
        res_data[i] = [Paragraph(res_data[i][0], styles['TableCellLeft']),
                       Paragraph(res_data[i][1], styles['TableCellLeft'])]
    
    rest = Table(res_data, colWidths=[160, 300])
    rest.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dee2e6')),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(rest)
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("MI RECOMENDACIÓN:", styles['SubTitle']))
    elements.append(Paragraph("<b>Empieza con la licencia CAB (Opción 2)</b> ya que te permite mantener las tarifas del 10-20% mensual que ya manejas. Es la única opción que legalmente permite esos porcentajes. La Regulated Lender License limita demasiado las ganancias ($18.50 máximo en un préstamo de $800). Eventualmente puedes agregar la Regulated Lender para ofrecer productos con tasas bajas a clientes que lo prefieran.", styles['Body']))
    
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor('#ddd')))
    elements.append(Paragraph("Este documento es informativo. Se recomienda consultar con un abogado especializado en regulación financiera de Texas para asegurar cumplimiento total con las leyes estatales y locales.", styles['Footer']))
    elements.append(Paragraph("Ross Tax Preparation — Abril 2026 — Confidencial", styles['Footer']))
    
    doc.build(elements)
    print(f"✅ PDF generated: {output_path}")
    return output_path

def send_pdf_via_email(pdf_path):
    """Send the generated PDF via SendGrid email"""
    import base64
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import (
        Mail, Attachment, FileContent, FileName, FileType, Disposition
    )
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
    FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
    TO_EMAIL = 'yoandyross@gmail.com'
    
    if not SENDGRID_API_KEY:
        print("❌ SENDGRID_API_KEY not found in environment")
        return False
    
    # Read PDF and encode to base64
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    encoded_pdf = base64.b64encode(pdf_data).decode('utf-8')
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=TO_EMAIL,
        subject='📋 Guía Completa: Licencias para Préstamos en Texas — Ross Tax',
        html_content="""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Ross Tax Preparation</h1>
                <p style="color: #a0aec0; margin: 5px 0 0;">Guía de Licencias de Préstamos</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Hola Yoandy,</h2>
                <p style="color: #4a5568; line-height: 1.6;">
                    Adjunto encontrarás la <b>Guía Completa de Licencias para Ofrecer Préstamos en Texas</b>. 
                    Este documento incluye:
                </p>
                <ul style="color: #4a5568; line-height: 1.8;">
                    <li>✅ <b>3 opciones de licencia</b> analizadas (Regulated Lender, CAB, Dual)</li>
                    <li>✅ <b>Comparación de ganancias</b> por cada opción</li>
                    <li>✅ <b>Ejemplos detallados</b> de préstamos de $200 a $1,000</li>
                    <li>✅ <b>Explicación legal</b> de cómo cobrar 10-20% mensual</li>
                    <li>✅ <b>Paso a paso</b> para obtener cada licencia</li>
                    <li>✅ <b>Ajustes necesarios</b> en el sistema actual</li>
                    <li>✅ <b>Recursos y contactos</b> oficiales</li>
                </ul>
                <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="color: #065f46; margin: 0;">
                        <b>Recomendación:</b> La licencia CAB (Credit Access Business) es la que permite 
                        cobrar 10-20% mensual legalmente en Texas. Es la opción más rentable para 
                        préstamos de $200-$1,000.
                    </p>
                </div>
                <p style="color: #4a5568;">
                    Si tienes preguntas sobre el contenido, no dudes en consultarme.
                </p>
            </div>
            <div style="background: #f7fafc; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: 0;">
                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                    Ross Tax Preparation — Documento Confidencial — Febrero 2026
                </p>
            </div>
        </div>
        """
    )
    
    # Attach the PDF
    attachment = Attachment()
    attachment.file_content = FileContent(encoded_pdf)
    attachment.file_name = FileName('Guia_Licencias_Prestamos_Texas_RossTax.pdf')
    attachment.file_type = FileType('application/pdf')
    attachment.disposition = Disposition('attachment')
    message.attachment = attachment
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"✅ Email enviado exitosamente a {TO_EMAIL}")
        print(f"   Status Code: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Error enviando email: {str(e)}")
        return False


if __name__ == '__main__':
    pdf_path = generate_lending_guide_pdf()
    print("Enviando PDF por email...")
    send_pdf_via_email(pdf_path)
