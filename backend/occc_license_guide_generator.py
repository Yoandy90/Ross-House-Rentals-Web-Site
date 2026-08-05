"""
OCCC Regulated Lender — Guía Completa de Tipos de Préstamos, Requisitos y Cumplimiento
Genera un PDF profesional con toda la información legal para Ross Lending Solutions LLC.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def generate_occc_license_guide() -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch)
    styles = getSampleStyleSheet()

    # Custom styles
    title_s = ParagraphStyle('GT', parent=styles['Title'], fontSize=20,
                             textColor=colors.HexColor('#0f172a'), spaceAfter=4, alignment=TA_CENTER)
    sub_s = ParagraphStyle('GS', parent=styles['Normal'], fontSize=10,
                           textColor=colors.HexColor('#64748b'), spaceAfter=16, alignment=TA_CENTER)
    h1_s = ParagraphStyle('GH1', parent=styles['Heading1'], fontSize=16,
                          textColor=colors.HexColor('#1e40af'), spaceBefore=24, spaceAfter=12)
    h2_s = ParagraphStyle('GH2', parent=styles['Heading2'], fontSize=13,
                          textColor=colors.HexColor('#0f766e'), spaceBefore=16, spaceAfter=8)
    h3_s = ParagraphStyle('GH3', parent=styles['Heading3'], fontSize=11,
                          textColor=colors.HexColor('#334155'), spaceBefore=12, spaceAfter=6)
    body_s = ParagraphStyle('GB', parent=styles['Normal'], fontSize=9.5, leading=14,
                            textColor=colors.HexColor('#374151'))
    note_s = ParagraphStyle('GN', parent=styles['Normal'], fontSize=8.5, leading=12,
                            textColor=colors.HexColor('#b91c1c'), leftIndent=15, spaceBefore=4)
    footer_s = ParagraphStyle('GF', parent=styles['Normal'], fontSize=7.5,
                              textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)
    legal_s = ParagraphStyle('GL', parent=styles['Normal'], fontSize=8,
                             textColor=colors.HexColor('#991b1b'), alignment=TA_CENTER, spaceBefore=16)
    bullet_s = ParagraphStyle('GBul', parent=body_s, leftIndent=20, bulletIndent=10,
                              spaceBefore=2, spaceAfter=2)

    def make_table(data, col_widths, header_color='#1e40af'):
        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        return t

    elements = []

    # ═══════════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(Spacer(1, 60))
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", title_s))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "GUÍA COMPLETA DE LICENCIA OCCC<br/>"
        "Tipos de Préstamos Autorizados, Requisitos Legales y Cumplimiento",
        sub_s
    ))
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="80%", thickness=2, color=colors.HexColor('#1e40af')))
    elements.append(Spacer(1, 20))

    cover_data = [
        ["Documento", "Valor"],
        ["Licencia Solicitada", "Regulated Lender License — OCCC Texas"],
        ["Ley Aplicable", "Texas Finance Code, Chapter 342"],
        ["Subcapítulos Cubiertos", "Subchapter E, F y G"],
        ["Regulador", "Office of Consumer Credit Commissioner (OCCC)"],
        ["Portal de Licencia", "NMLS — nmls.org"],
        ["Empresa", "Ross Lending Solutions LLC"],
        ["Estado", "Texas"],
        ["Fecha de Generación", datetime.now().strftime('%d de %B de %Y')],
        ["Clasificación", "USO INTERNO — CONFIDENCIAL"],
    ]
    elements.append(make_table(cover_data, [2.5 * inch, 4 * inch]))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "Este documento es una guía de referencia interna. No constituye asesoría legal. "
        "Para decisiones legales, consulte con un abogado licenciado en Texas.",
        legal_s
    ))

    # ═══════════════════════════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("ÍNDICE", h1_s))
    toc = [
        "1. Resumen de la Licencia Regulated Lender",
        "2. SUBCHAPTER E — Préstamos al Consumidor (No Bienes Raíces)",
        "3. SUBCHAPTER F — Préstamos Pequeños / Signature Loans",
        "4. SUBCHAPTER G — Hipotecas Secundarias",
        "5. Tabla Comparativa de Todos los Tipos de Préstamo",
        "6. Requisitos de Licencia y Activos Mínimos",
        "7. Prácticas Prohibidas (Subchapter K)",
        "8. Requisitos de Divulgación y Documentación",
        "9. Reportes Anuales y Trimestrales (QAR)",
        "10. Calendario de Cumplimiento Anual",
        "11. Checklist de Cumplimiento OCCC",
        "12. Recursos y Contactos",
    ]
    for item in toc:
        elements.append(Paragraph(f"  {item}", body_s))

    # ═══════════════════════════════════════════════════════════════════════════
    # 1. LICENSE OVERVIEW
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("1. RESUMEN DE LA LICENCIA REGULATED LENDER", h1_s))
    elements.append(Paragraph(
        "La licencia de Regulated Lender emitida por la Office of Consumer Credit Commissioner (OCCC) "
        "del Estado de Texas autoriza a entidades no bancarias a realizar préstamos al consumidor con "
        "tasas de interés superiores al 10% anual. Esta licencia cubre tres subcapítulos del Texas "
        "Finance Code Chapter 342, cada uno con diferentes límites y condiciones.",
        body_s
    ))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("<b>¿Quién necesita esta licencia?</b>", body_s))
    for item in [
        "Cualquier prestamista no bancario que cobre más del 10% de interés anual",
        "Empresas que otorguen préstamos personales, préstamos con título de vehículo, o hipotecas secundarias",
        "Negocios de préstamos tipo 'signature loans' o préstamos pequeños",
    ]:
        elements.append(Paragraph(f"• {item}", bullet_s))

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. SUBCHAPTER E
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("2. SUBCHAPTER E — PRÉSTAMOS AL CONSUMIDOR", h1_s))
    elements.append(Paragraph("(Consumer Installment Loans — Non-Real Property)", sub_s))

    elements.append(Paragraph("2.1 Descripción", h2_s))
    elements.append(Paragraph(
        "Los préstamos bajo Subchapter E son préstamos al consumidor a plazos que NO están asegurados "
        "por bienes raíces. Son los préstamos más comunes para prestamistas regulados e incluyen "
        "préstamos personales, préstamos con título de auto, y préstamos asegurados por propiedad personal.",
        body_s
    ))

    elements.append(Paragraph("2.2 Características Principales", h2_s))
    sub_e_chars = [
        ["Característica", "Detalle"],
        ["Monto Mínimo Típico", "> $1,500 (sin mínimo legal, pero Sub F cubre los pequeños)"],
        ["Monto Máximo", "Sin límite legal (sujeto a capacidad del prestatario)"],
        ["Garantía/Colateral", "Puede ser: Sin garantía (firma), Propiedad personal, Título de vehículo"],
        ["Tipo de Interés", "Interés add-on o true daily earnings"],
        ["Cuota Administrativa Máx.", "$125 (ajustado anualmente por CPI, vigente julio 2024)"],
        ["Seguro de Crédito", "Permitido (vida, discapacidad, propiedad)"],
        ["Cargos por Default", "5% del pago si se atrasa 10+ días"],
    ]
    elements.append(make_table(sub_e_chars, [2.2 * inch, 4.3 * inch], '#1e40af'))

    elements.append(Paragraph("2.3 Tasas de Interés Máximas (Subchapter E)", h2_s))
    elements.append(Paragraph(
        "Las tasas se calculan por tramos del monto del préstamo. A mayor monto, menor tasa permitida:",
        body_s
    ))
    rate_e = [
        ["Porción del Préstamo", "Tasa Máxima Anual", "Ejemplo ($2,000 préstamo)"],
        ["$0 — $500", "30% anual", "30% sobre los primeros $500"],
        ["$500.01 — $1,050", "24% anual", "24% sobre $500.01 a $1,050"],
        ["$1,050.01 — $2,500", "18% anual", "18% sobre $1,050.01 a $2,000"],
        ["Más de $2,500", "18% (Cap. 303 ceiling)", "Techo alternativo Chapter 303"],
    ]
    elements.append(make_table(rate_e, [1.8 * inch, 1.6 * inch, 3.1 * inch], '#b91c1c'))
    elements.append(Paragraph(
        "⚠️ IMPORTANTE: Las tasas se ajustan anualmente por la OCCC. Siempre verificar los brackets "
        "vigentes en occc.texas.gov/publications/interest-rates/",
        note_s
    ))

    elements.append(Paragraph("2.4 Productos que Puedes Ofrecer bajo Sub E", h2_s))
    products_e = [
        "✅ Préstamos personales a plazos (installment loans)",
        "✅ Préstamos con título de auto como garantía (auto title loans)",
        "✅ Préstamos asegurados por propiedad personal (joyas, electrónicos, etc.)",
        "✅ Préstamos de emergencia / préstamos médicos",
        "✅ Consolidación de deuda",
        "✅ Préstamos para mejoras del hogar (si NO tienen garantía de bienes raíces)",
    ]
    for p in products_e:
        elements.append(Paragraph(p, bullet_s))

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. SUBCHAPTER F
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("3. SUBCHAPTER F — PRÉSTAMOS PEQUEÑOS", h1_s))
    elements.append(Paragraph("(Small Installment Loans / Signature Loans)", sub_s))

    elements.append(Paragraph("3.1 Descripción", h2_s))
    elements.append(Paragraph(
        "Los préstamos bajo Subchapter F son préstamos pequeños, típicamente hasta ~$1,500. Estos "
        "son préstamos de 'firma' (signature loans) donde el prestatario solo firma un pagaré sin "
        "necesidad de colateral. Son préstamos pre-computados con cargos de adquisición.",
        body_s
    ))

    elements.append(Paragraph("3.2 Características Principales", h2_s))
    sub_f_chars = [
        ["Característica", "Detalle"],
        ["Monto Máximo", "~$1,500 (referencia bajo Chapter 341 Subchapter C)"],
        ["Garantía/Colateral", "Típicamente sin garantía (solo firma del prestatario)"],
        ["Método de Interés", "Pre-computado (acquisition charge + handling charge)"],
        ["Cargo de Adquisición Máx.", "Menor entre $125 o 12.5% del anticipo en efectivo"],
        ["Seguro de Crédito", "NO permitido bajo Subchapter F"],
        ["Otros Cargos", "NO permitidos (excepto interés por default)"],
        ["Interés por Default", "5% adicional O $10.00 (lo que sea aplicable)"],
    ]
    elements.append(make_table(sub_f_chars, [2.2 * inch, 4.3 * inch], '#7c3aed'))

    elements.append(Paragraph("3.3 Límites de Plazo (Subchapter F)", h2_s))
    term_f = [
        ["Monto del Préstamo", "Plazo Máximo"],
        ["$100 o menos", "Menor entre: 1 mes por cada $10 del préstamo O 6 meses máximo"],
        ["Más de $100", "1 mes por cada $20 del préstamo"],
        ["Ejemplo: $500", "25 meses máximo (500 ÷ 20 = 25)"],
        ["Ejemplo: $1,000", "50 meses máximo (1000 ÷ 20 = 50)"],
        ["Ejemplo: $1,500", "75 meses máximo (1500 ÷ 20 = 75)"],
    ]
    elements.append(make_table(term_f, [2.5 * inch, 4 * inch], '#7c3aed'))

    elements.append(Paragraph("3.4 Tasas de Interés Efectivas (Subchapter F)", h2_s))
    elements.append(Paragraph(
        "Debido a los cargos pre-computados en montos pequeños, las tasas efectivas APR pueden ser muy altas:",
        body_s
    ))
    apr_f = [
        ["Rango Típico de APR", "80% — 240% APR"],
        ["¿Es legal?", "SÍ — OCCC autoriza estas tasas bajo Subchapter F"],
        ["Nota", "El APR alto se debe al monto pequeño y plazo corto, NO a abuso"],
    ]
    elements.append(make_table(apr_f, [2.5 * inch, 4 * inch], '#b91c1c'))

    elements.append(Paragraph("3.5 Productos bajo Sub F", h2_s))
    products_f = [
        "✅ Préstamos pequeños de firma (signature loans hasta ~$1,500)",
        "✅ Préstamos de emergencia pequeños",
        "✅ Adelantos de efectivo a corto plazo",
        "❌ NO se permite seguro de crédito",
        "❌ NO se permiten cargos adicionales",
    ]
    for p in products_f:
        elements.append(Paragraph(p, bullet_s))

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. SUBCHAPTER G
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("4. SUBCHAPTER G — HIPOTECAS SECUNDARIAS", h1_s))
    elements.append(Paragraph("(Secondary Mortgage Loans — Second Lien)", sub_s))

    elements.append(Paragraph("4.1 Descripción", h2_s))
    elements.append(Paragraph(
        "Los préstamos bajo Subchapter G son hipotecas secundarias (second liens) aseguradas por "
        "bienes raíces del prestatario. Estos son más complejos y requieren cumplimiento adicional "
        "incluyendo revisión de abogado en Texas.",
        body_s
    ))

    sub_g_chars = [
        ["Característica", "Detalle"],
        ["Monto Mínimo / Máximo", "Sin límite (determinado por valor de la propiedad)"],
        ["Garantía", "OBLIGATORIA — Second lien sobre bienes raíces"],
        ["Tasa Máxima (True Daily)", "18% anual"],
        ["Tasa Máxima (Pre-computado)", "14.5% anual"],
        ["Seguro", "Permitido (crédito y propiedad)"],
        ["Cargos Adicionales", "Avalúo, título, recording fees — permitidos"],
        ["Revisión de Abogado", "OBLIGATORIA en Texas para docs de bienes raíces (§83.001)"],
    ]
    elements.append(make_table(sub_g_chars, [2.2 * inch, 4.3 * inch], '#0369a1'))
    elements.append(Paragraph(
        "⚠️ NOTA: Si planeas ofrecer hipotecas secundarias, SÍ necesitas un abogado para preparar "
        "o revisar los documentos. Esto es diferente a Sub E y Sub F.",
        note_s
    ))

    # ═══════════════════════════════════════════════════════════════════════════
    # 5. COMPARATIVE TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("5. TABLA COMPARATIVA — TODOS LOS TIPOS DE PRÉSTAMO", h1_s))

    comp = [
        ["", "SUBCHAPTER E", "SUBCHAPTER F", "SUBCHAPTER G"],
        ["Nombre", "Consumer Installment", "Small/Signature Loan", "Secondary Mortgage"],
        ["Monto", "> $1,500 (sin tope)", "Hasta ~$1,500", "Sin límite"],
        ["Garantía", "Opcional", "Solo firma", "Bienes raíces (obligatorio)"],
        ["Tasa Máx.", "18-30% (por tramos)", "80-240% APR", "18% (14.5% pre-comp)"],
        ["Admin Fee", "$125 máx.", "$125 o 12.5%", "Variable"],
        ["Seguro Crédito", "✅ Permitido", "❌ No permitido", "✅ Permitido"],
        ["Plazo", "Flexible", "Fórmula por monto", "Flexible"],
        ["Abogado", "No requerido", "No requerido", "SÍ requerido"],
        ["Complejidad", "Media", "Baja", "Alta"],
        ["Uso Común", "Préstamos personales", "Emergencia / corto plazo", "Home equity 2nd lien"],
    ]
    t = make_table(comp, [1.3 * inch, 1.8 * inch, 1.7 * inch, 1.7 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(t)

    # ═══════════════════════════════════════════════════════════════════════════
    # 6. LICENSE REQUIREMENTS
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(Paragraph("6. REQUISITOS DE LICENCIA Y ACTIVOS MÍNIMOS", h1_s))

    lic_req = [
        ["Requisito", "Detalle", "Estado Ross Lending"],
        ["Activos Netos Mínimos", "$25,000", "✅ $27,000 depositados"],
        ["Surety Bond", "$0 en Texas (exento)", "✅ No aplica"],
        ["Solicitud NMLS", "Formulario MU1 en nmls.org", "🔄 En proceso"],
        ["Fingerprints (FBI/OCCC)", "Todos los oficiales/directores", "📋 Pendiente"],
        ["Estado Financiero ADM17", "Balance sheet auditado", "✅ Generado"],
        ["Background Check", "Historial criminal de officers", "📋 Pendiente"],
        ["Registered Agent en TX", "Agente de servicio en Texas", "✅ Registrado"],
        ["Cuenta Bancaria en TX", "Cuenta comercial en Texas", "✅ Happy State Bank"],
        ["Programa AML/BSA", "Política anti-lavado documentada", "✅ Generado (17 secciones)"],
        ["Fee de Solicitud OCCC", "Variable (verificar en NMLS)", "📋 Pendiente"],
    ]
    elements.append(make_table(lic_req, [2 * inch, 2.3 * inch, 2.2 * inch], '#0f766e'))

    # ═══════════════════════════════════════════════════════════════════════════
    # 7. PROHIBITED PRACTICES
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("7. PRÁCTICAS PROHIBIDAS (SUBCHAPTER K)", h1_s))
    elements.append(Paragraph(
        "La Sección 342.501 a 342.508 del Texas Finance Code establece las prácticas que están "
        "ESTRICTAMENTE PROHIBIDAS para prestamistas regulados:",
        body_s
    ))

    prohibited = [
        ["Sección", "Prohibición", "Consecuencia"],
        ["§342.501", "Dividir una deuda en múltiples contratos para evadir límites", "Nulidad del contrato"],
        ["§342.502", "Prestar más del monto autorizado por subcapítulo", "Multas + devolución"],
        ["§342.503", "Tomar garantía no autorizada para el tipo de préstamo", "Sanción administrativa"],
        ["§342.504", "Incluir confesión de juicio o poder notarial amplio en contratos", "Cláusula NULA de pleno derecho"],
        ["§342.505", "No divulgar monto financiado y calendario de pagos completo", "Violación TILA + multas"],
        ["§342.506", "Hacer firmar documentos en blanco al prestatario", "Documento NULO"],
        ["§342.507", "Incluir cláusula de renuncia de derechos del prestatario", "Cláusula NULA"],
        ["§342.508", "Exceder el plazo máximo autorizado para el tipo de préstamo", "Multas"],
        ["§342.603", "Cobrar cargos excesivos no autorizados", "Devolución + multas"],
        ["§342.604", "Violar protecciones especiales para militares", "Sanciones severas"],
    ]
    elements.append(make_table(prohibited, [1 * inch, 3 * inch, 2.5 * inch], '#b91c1c'))

    elements.append(Paragraph(
        "⚠️ Tu sistema ya está configurado para evitar estas prácticas: no permite documentos en blanco, "
        "calcula automáticamente las tasas dentro de los límites, y genera divulgaciones TILA completas.",
        note_s
    ))

    # ═══════════════════════════════════════════════════════════════════════════
    # 8. DISCLOSURE REQUIREMENTS
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(Paragraph("8. REQUISITOS DE DIVULGACIÓN Y DOCUMENTACIÓN", h1_s))

    disclosure = [
        ["Documento Requerido", "Contenido", "¿Tu Sistema lo Genera?"],
        ["Contrato de Préstamo", "Términos completos, firmas de ambas partes", "✅ Sí (ES + EN)"],
        ["Truth in Lending (TILA)", "APR, monto financiado, cargo financiero total, total de pagos", "✅ Sí"],
        ["Calendario de Pagos", "Fecha, monto, desglose principal/interés por cada pago", "✅ Sí (amortización)"],
        ["Pagaré (Promissory Note)", "Promesa de pago firmada", "✅ Sí"],
        ["Aviso de Derecho a Cancelar", "3 días para hipotecas (Sub G solamente)", "N/A para Sub E/F"],
        ["Recibo de Cada Pago", "Comprobante por cada pago recibido", "✅ Sí (PDF nuevo)"],
        ["Records por 4 Años", "Todos los docs del préstamo, pagos, correspondencia", "✅ Base de datos"],
    ]
    elements.append(make_table(disclosure, [2 * inch, 2.5 * inch, 2 * inch], '#1e40af'))

    # ═══════════════════════════════════════════════════════════════════════════
    # 9. REPORTING
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("9. REPORTES ANUALES Y TRIMESTRALES", h1_s))

    reports = [
        ["Reporte", "Frecuencia", "Fecha Límite", "Dónde se Presenta"],
        ["Reporte Anual OCCC", "Anual", "30 de junio (datos del año anterior)", "Portal OCCC online"],
        ["QAR (Quarterly Activity)", "Trimestral", "Trimestre siguiente", "NMLS (nmls.org)"],
        ["Renovación de Licencia NMLS", "Anual", "~1 de noviembre", "NMLS (nmls.org)"],
        ["Actualización MU1/MU3", "Cuando hay cambios", "30 días después del cambio", "NMLS"],
    ]
    elements.append(make_table(reports, [2 * inch, 1.2 * inch, 2.2 * inch, 1.3 * inch], '#7c3aed'))

    elements.append(Paragraph("9.1 Contenido del Reporte Anual OCCC", h2_s))
    annual_content = [
        ["Schedule", "Contenido"],
        ["Schedule A", "Préstamos originados por tipo, cantidad y monto"],
        ["Schedule B", "Volumen de préstamos y saldos pendientes"],
        ["Datos Financieros", "Cifras GAAP: ingresos, gastos, activos netos"],
        ["Morosidad", "Préstamos vencidos por categoría (30/60/90+ días)"],
        ["Defaults", "Préstamos en default y pérdidas"],
    ]
    elements.append(make_table(annual_content, [1.5 * inch, 5 * inch], '#0f766e'))
    elements.append(Paragraph(
        "✅ Tu sistema ya genera todos estos datos automáticamente desde el módulo de Reportes y Compliance.",
        ParagraphStyle('GGood', parent=body_s, textColor=colors.HexColor('#16a34a'), leftIndent=15)
    ))

    # ═══════════════════════════════════════════════════════════════════════════
    # 10. ANNUAL CALENDAR
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(Paragraph("10. CALENDARIO DE CUMPLIMIENTO ANUAL", h1_s))

    cal = [
        ["Mes", "Actividad", "Detalle"],
        ["Enero", "Preparar datos del año anterior", "Recopilar datos para reporte anual"],
        ["Marzo", "Trimestral Q4 (año anterior)", "Presentar QAR del Q4 previo"],
        ["Mayo", "Reporte Anual OCCC", "Preparar y revisar antes del deadline"],
        ["Junio 30", "⚠️ DEADLINE Reporte Anual", "Fecha límite de presentación"],
        ["Julio", "Nuevas tasas CPI", "OCCC publica brackets actualizados"],
        ["Septiembre", "Revisión interna", "Auditoría interna de cumplimiento"],
        ["Noviembre", "Renovación NMLS", "Renovar licencia en portal NMLS"],
        ["Diciembre", "Cierre fiscal", "Preparar datos para reporte del siguiente año"],
        ["Trimestral", "QAR", "Presentar después de cada trimestre"],
        ["Continuo", "Records", "Mantener todos los registros accesibles para inspección OCCC"],
    ]
    elements.append(make_table(cal, [1.2 * inch, 2.3 * inch, 3 * inch], '#0f172a'))

    # ═══════════════════════════════════════════════════════════════════════════
    # 11. COMPLIANCE CHECKLIST
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())
    elements.append(Paragraph("11. CHECKLIST DE CUMPLIMIENTO OCCC", h1_s))

    checklist = [
        ["#", "Requisito", "Estado"],
        ["1", "Licencia OCCC vigente", "🔄 En proceso"],
        ["2", "Activos netos ≥ $25,000", "✅ Cumple ($27K)"],
        ["3", "Programa AML/BSA documentado", "✅ 17 secciones"],
        ["4", "Contratos con divulgaciones TILA completas", "✅ Auto-generados"],
        ["5", "Tasas dentro de límites legales por subcapítulo", "✅ Calculadora validada"],
        ["6", "Records mantenidos por 4+ años", "✅ Base de datos permanente"],
        ["7", "Recibos emitidos por cada pago", "✅ PDF automático"],
        ["8", "Sin documentos en blanco", "✅ Pre-llenados"],
        ["9", "Sin cláusulas de renuncia de derechos", "✅ Revisado"],
        ["10", "Sin confesiones de juicio en contratos", "✅ No incluidas"],
        ["11", "Reporte Anual listo para presentar", "✅ Generador automático"],
        ["12", "QAR trimestral listo", "✅ Generador automático"],
        ["13", "Estado financiero ADM17", "✅ Generado"],
        ["14", "Cuestionario bancario completado", "✅ Centennial Bank"],
        ["15", "Confirmación bancaria", "✅ Happy State Bank"],
        ["16", "Protecciones para militares (MLA)", "📋 Implementar"],
        ["17", "Fingerprints registrados", "📋 Pendiente"],
        ["18", "Background check completado", "📋 Pendiente"],
    ]
    elements.append(make_table(checklist, [0.5 * inch, 3.5 * inch, 2.5 * inch], '#1e40af'))

    # ═══════════════════════════════════════════════════════════════════════════
    # 12. RESOURCES
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(Paragraph("12. RECURSOS Y CONTACTOS", h1_s))

    resources = [
        ["Recurso", "URL / Contacto"],
        ["OCCC — Regulated Lenders", "occc.texas.gov/industry/regulated-lenders/"],
        ["NMLS Portal", "nmls.org"],
        ["Texas Finance Code Ch. 342", "statutes.capitol.texas.gov (Chapter 342)"],
        ["Tasas de Interés Vigentes", "occc.texas.gov/publications/interest-rates/"],
        ["Guía de Reporte Anual", "occc.texas.gov (ANNUAL_REPORT_FILING_GUIDE.pdf)"],
        ["Proceso de Examinación OCCC", "occc.texas.gov/industry/regulated-lenders/examination-process/"],
        ["OCCC Email (Reportes)", "annualreport@occc.texas.gov"],
        ["OCCC Teléfono", "512-936-7652"],
    ]
    elements.append(make_table(resources, [2.5 * inch, 4 * inch], '#0f172a'))

    # Footer
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
    elements.append(Paragraph(
        "Este documento fue preparado como guía de referencia interna para Ross Lending Solutions LLC. "
        "No constituye asesoría legal. La información está basada en el Texas Finance Code Chapter 342, "
        "7 Texas Administrative Code Chapter 83, y publicaciones oficiales de la OCCC. "
        "Las tasas y montos se ajustan periódicamente — siempre verifique los valores vigentes en occc.texas.gov.",
        legal_s
    ))
    elements.append(Paragraph(
        f"Ross Lending Solutions LLC — Guía de Licencia OCCC — {datetime.now().strftime('%d/%m/%Y')} — CONFIDENCIAL",
        footer_s
    ))

    doc.build(elements)
    buf.seek(0)
    return buf
