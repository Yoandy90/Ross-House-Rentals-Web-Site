"""
Ross Lending — Estrategia de Capital y Máxima Ganancia
Guía completa de cómo invertir $27K-$80K+, productos de corto plazo, y modelo de inversionistas.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER


def generate_strategy_guide() -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    s = getSampleStyleSheet()

    title = ParagraphStyle('T', parent=s['Title'], fontSize=20, textColor=colors.HexColor('#0f172a'), spaceAfter=4, alignment=TA_CENTER)
    sub = ParagraphStyle('S', parent=s['Normal'], fontSize=10, textColor=colors.HexColor('#64748b'), spaceAfter=16, alignment=TA_CENTER)
    h1 = ParagraphStyle('H1', parent=s['Heading1'], fontSize=16, textColor=colors.HexColor('#1e40af'), spaceBefore=24, spaceAfter=10)
    h2 = ParagraphStyle('H2', parent=s['Heading2'], fontSize=13, textColor=colors.HexColor('#0f766e'), spaceBefore=16, spaceAfter=8)
    h3 = ParagraphStyle('H3', parent=s['Heading3'], fontSize=11, textColor=colors.HexColor('#334155'), spaceBefore=10, spaceAfter=6)
    body = ParagraphStyle('B', parent=s['Normal'], fontSize=9.5, leading=14, textColor=colors.HexColor('#374151'))
    note = ParagraphStyle('N', parent=s['Normal'], fontSize=8.5, leading=12, textColor=colors.HexColor('#b91c1c'), leftIndent=15, spaceBefore=4)
    bullet = ParagraphStyle('BU', parent=body, leftIndent=20, bulletIndent=10, spaceBefore=2, spaceAfter=2)
    footer = ParagraphStyle('F', parent=s['Normal'], fontSize=7.5, textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)
    green = ParagraphStyle('G', parent=body, textColor=colors.HexColor('#16a34a'))

    def tbl(data, widths, hc='#1e40af'):
        t = Table(data, colWidths=widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor(hc)),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8.5),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        return t

    el = []

    # ═══ COVER ═══
    el.append(Spacer(1, 40))
    el.append(Paragraph("ROSS LENDING SOLUTIONS LLC", title))
    el.append(Paragraph(
        "ESTRATEGIA DE MÁXIMA GANANCIA<br/>"
        "Guía de Capital, Productos Corto Plazo y Modelo de Inversionistas",
        sub
    ))
    el.append(HRFlowable(width="80%", thickness=2, color=colors.HexColor('#1e40af')))
    el.append(Spacer(1, 16))
    el.append(tbl([
        ["Documento", "Valor"],
        ["Capital Disponible", "$27,000 — $80,000+"],
        ["Productos", "Subchapter E (Plazos) + Subchapter F (Corto Plazo)"],
        ["Mercado Objetivo", "Comunidad hispana en Texas"],
        ["Modelo de Crecimiento", "Capital propio + Inversionistas privados"],
        ["Fecha", datetime.now().strftime('%d de %B de %Y')],
        ["Clasificación", "CONFIDENCIAL — Uso Interno"],
    ], [2.5*inch, 4*inch]))

    # ═══ TOC ═══
    el.append(PageBreak())
    el.append(Paragraph("ÍNDICE", h1))
    for item in [
        "1. Productos de Préstamo y Tasas Legales",
        "2. Estrategia con $27,000 — Máxima Ganancia Corto Plazo",
        "3. Estrategia con $80,000 — Diversificación",
        "4. Proyección Financiera a 12 Meses",
        "5. Rotación de Capital — Cómo Reciclar tu Dinero",
        "6. Modelo de Inversionistas — Cómo Traer Capital Externo",
        "7. Estructura Legal para Inversionistas en Texas",
        "8. Tabla de Rendimientos para Inversionistas",
        "9. Ejemplo de Pitch para Inversionista",
        "10. Riesgos y Mitigación",
        "11. Plan de Acción — Primeros 90 Días",
    ]:
        el.append(Paragraph(f"  {item}", body))

    # ═══ 1. PRODUCTOS ═══
    el.append(PageBreak())
    el.append(Paragraph("1. PRODUCTOS DE PRÉSTAMO Y TASAS LEGALES", h1))

    el.append(Paragraph("1.1 Subchapter F — Corto Plazo / MÁXIMA GANANCIA", h2))
    el.append(tbl([
        ["Monto", "APR Legal Máx", "Plazo Típico", "Ganancia x préstamo", "Ganancia/Mes si haces 30"],
        ["$200", "240%", "1 mes", "$40", "$1,200"],
        ["$300", "240%", "1 mes", "$48", "$1,440"],
        ["$500", "180%", "1 mes", "$75", "$2,250"],
        ["$500", "180%", "2 meses", "$110", "$1,650 (c/2 meses)"],
        ["$1,000", "180%", "2 meses", "$173", "$2,595 (c/2 meses)"],
        ["$1,500", "180%", "3 meses", "$240", "$2,400 (c/3 meses)"],
    ], [0.7*inch, 0.9*inch, 0.9*inch, 1.4*inch, 2.6*inch], '#b45309'))

    el.append(Paragraph("1.2 Subchapter E — Mediano/Largo Plazo", h2))
    el.append(tbl([
        ["Monto", "Tasa Blended", "Plazo", "Pago/Mes", "Ganancia Total", "Garantía"],
        ["$3,000", "~23%", "12 meses", "$195", "$635", "Firma"],
        ["$5,000", "~21%", "24 meses", "$255", "$1,245", "Título auto"],
        ["$8,000", "~20%", "36 meses", "$297", "$2,825", "Título auto"],
        ["$12,000", "18%", "48 meses", "$353", "$4,940", "Opcional"],
    ], [0.7*inch, 0.9*inch, 0.8*inch, 0.8*inch, 1.1*inch, 1*inch], '#1e40af'))

    # ═══ 2. ESTRATEGIA $27K ═══
    el.append(PageBreak())
    el.append(Paragraph("2. ESTRATEGIA CON $27,000 — MÁXIMA GANANCIA", h1))

    el.append(Paragraph("2.1 Opción A: 100% Corto Plazo (Máxima Rotación)", h2))
    el.append(Paragraph(
        "Inviertes todo en préstamos Sub F de $500 a 1 mes. Cada mes recuperas el capital + ganancia y vuelves a prestar.",
        body
    ))
    el.append(tbl([
        ["Mes", "Capital Invertido", "Préstamos", "Ganancia", "Capital + Ganancia", "Acumulado"],
        ["Mes 1", "$27,000", "54 × $500", "$4,050", "$31,050", "$4,050"],
        ["Mes 2", "$31,050", "62 × $500", "$4,650", "$35,700", "$8,700"],
        ["Mes 3", "$35,700", "71 × $500", "$5,325", "$41,025", "$14,025"],
        ["Mes 6", "$54,000*", "108 × $500", "$8,100", "$62,100", "$35,100"],
        ["Mes 12", "$100,000*", "200 × $500", "$15,000", "$115,000", "$88,000+"],
    ], [0.7*inch, 1.1*inch, 1*inch, 0.9*inch, 1.1*inch, 1*inch], '#0f766e'))
    el.append(Paragraph("* Con reinversión compuesta del 100% de ganancias. Realista: 70% reinversión + 30% gastos operativos.", note))
    el.append(Paragraph("⚠️ Riesgo: Si muchos clientes no pagan a tiempo, la rotación se frena. Tasa de default esperada: 5-10%.", note))

    el.append(Paragraph("2.2 Opción B: Híbrido (70% Corto + 30% Largo)", h2))
    el.append(tbl([
        ["Producto", "Capital", "Préstamos/Mes", "Ganancia/Mes", "Tipo"],
        ["Sub F $500 × 1 mes", "$18,900 (70%)", "~38", "$2,850", "Corto plazo — cash flow"],
        ["Sub E $3,000 × 12 meses", "$8,100 (30%)", "~3", "$160/mes (recurrente)", "Largo plazo — estabilidad"],
        ["TOTAL", "$27,000", "~41", "$3,010+", "Mixto"],
    ], [1.6*inch, 1.2*inch, 1*inch, 1.2*inch, 1.5*inch], '#334155'))
    el.append(Paragraph("✅ RECOMENDADO: El modelo híbrido genera cash flow rápido (Sub F) + ingresos recurrentes estables (Sub E).", green))

    # ═══ 3. ESTRATEGIA $80K ═══
    el.append(PageBreak())
    el.append(Paragraph("3. ESTRATEGIA CON $80,000 — DIVERSIFICACIÓN", h1))
    el.append(tbl([
        ["Producto", "Asignación", "Capital", "Préstamos/Mes", "Ganancia/Mes"],
        ["Sub F $300 × 1 mes", "15%", "$12,000", "40", "$1,920"],
        ["Sub F $500 × 1 mes", "25%", "$20,000", "40", "$3,000"],
        ["Sub F $1,000 × 2 meses", "20%", "$16,000", "16 (c/2m)", "$2,768*"],
        ["Sub E $3,000 × 12m (firma)", "15%", "$12,000", "4", "$212/mes recurrente"],
        ["Sub E $5,000 × 24m (título)", "15%", "$12,000", "2-3", "$150/mes recurrente"],
        ["Reserva de emergencia", "10%", "$8,000", "—", "Buffer de liquidez"],
        ["TOTAL", "100%", "$80,000", "100+", "$8,000+/mes"],
    ], [1.5*inch, 0.7*inch, 0.8*inch, 1*inch, 1.2*inch], '#1e40af'))
    el.append(Paragraph("* Los préstamos de 2 meses generan cada 2 meses; promedio mensual = mitad.", note))
    el.append(Paragraph("🎯 Proyección anual con $80K: $96,000+ en ganancias = 120%+ ROI", green))

    # ═══ 4. PROYECCIÓN 12 MESES ═══
    el.append(PageBreak())
    el.append(Paragraph("4. PROYECCIÓN FINANCIERA A 12 MESES", h1))
    el.append(Paragraph("Escenario conservador (70% reinversión, 8% default, gastos operativos):", body))
    el.append(tbl([
        ["Mes", "Capital $27K", "Ganancia Acum.", "Capital $80K", "Ganancia Acum."],
        ["Mes 1", "$27,000", "$2,500", "$80,000", "$7,000"],
        ["Mes 3", "$33,000", "$8,500", "$100,000", "$25,000"],
        ["Mes 6", "$45,000", "$22,000", "$140,000", "$65,000"],
        ["Mes 9", "$60,000", "$40,000", "$190,000", "$120,000"],
        ["Mes 12", "$80,000", "$65,000", "$250,000+", "$190,000+"],
    ], [0.7*inch, 1.1*inch, 1.2*inch, 1.1*inch, 1.2*inch], '#0f766e'))
    el.append(Paragraph("Nota: Estos números asumen reinversión activa y un equipo operativo que pueda manejar el volumen.", note))

    # ═══ 5. ROTACIÓN ═══
    el.append(Paragraph("5. ROTACIÓN DE CAPITAL — EL SECRETO DE LA GANANCIA", h1))
    el.append(Paragraph(
        "La clave del negocio de préstamos a corto plazo es la ROTACIÓN. Cada vez que prestas $500 y te pagan "
        "en 1 mes, puedes volver a prestar esos $500 inmediatamente. En 12 meses, los mismos $500 generan $900+ en ganancias.",
        body
    ))
    el.append(tbl([
        ["", "1 Rotación (1 mes)", "6 Rotaciones (6 meses)", "12 Rotaciones (12 meses)"],
        ["$500 invertidos", "$75 ganancia", "$450 ganancia", "$900 ganancia"],
        ["$1,000 invertidos", "$173 ganancia", "$1,038 ganancia", "$2,076 ganancia"],
        ["$5,000 invertidos", "$750 ganancia", "$4,500 ganancia", "$9,000 ganancia"],
        ["$27,000 invertidos", "$4,050 ganancia", "$24,300 ganancia", "$48,600 ganancia"],
    ], [1.3*inch, 1.3*inch, 1.5*inch, 1.5*inch], '#b45309'))
    el.append(Paragraph("⚡ Más rápido cobras, más rápido vuelves a prestar, más dinero ganas.", green))

    # ═══ 6. MODELO DE INVERSIONISTAS ═══
    el.append(PageBreak())
    el.append(Paragraph("6. MODELO DE INVERSIONISTAS — CÓMO TRAER CAPITAL EXTERNO", h1))
    el.append(Paragraph(
        "Para crecer más rápido sin arriesgar solo tu dinero, puedes traer inversionistas privados. "
        "En Texas existen formas legales de hacerlo sin registrarte ante la SEC:",
        body
    ))

    el.append(Paragraph("6.1 Estructura Recomendada: Note Agreement (Pagaré Privado)", h2))
    el.append(Paragraph(
        "El inversionista te presta dinero a una tasa fija. Tú usas ese dinero para prestar a clientes "
        "a tasas más altas. La diferencia es tu ganancia (spread).",
        body
    ))
    el.append(tbl([
        ["Ejemplo", "Detalle"],
        ["Inversionista te da", "$50,000 al 10% anual (fijo)"],
        ["Tú prestas a clientes", "$50,000 al 180% APR (Sub F)"],
        ["Tu costo al inversionista", "$5,000/año ($416/mes)"],
        ["Tus ingresos de clientes", "~$45,000+/año (conservador)"],
        ["TU GANANCIA NETA", "$40,000+/año — sin invertir tu propio dinero"],
    ], [2*inch, 4.5*inch], '#7c3aed'))

    el.append(Paragraph("6.2 ¿Por qué un inversionista pondría su dinero?", h2))
    el.append(tbl([
        ["Inversión Tradicional", "Retorno Anual", "Tu Oferta al Inversionista", "Retorno"],
        ["Cuenta de ahorro", "4-5%", "Pagaré privado (bajo riesgo)", "8-10%"],
        ["CDs bancarios", "4-5%", "Nota participativa", "10-12%"],
        ["S&P 500 promedio", "10%", "Participación en ganancias", "12-15%"],
        ["Real estate REIT", "7-8%", "Partnership", "15-20%"],
    ], [1.5*inch, 1*inch, 2*inch, 1*inch], '#334155'))
    el.append(Paragraph("Les ofreces MEJOR retorno que el banco o el mercado, con respaldo de préstamos reales.", green))

    # ═══ 7. ESTRUCTURA LEGAL ═══
    el.append(PageBreak())
    el.append(Paragraph("7. ESTRUCTURA LEGAL PARA INVERSIONISTAS EN TEXAS", h1))

    el.append(Paragraph("7.1 Exenciones Disponibles (Sin registrarte ante SEC)", h2))
    el.append(tbl([
        ["Exención", "Límite de Inversionistas", "Requisitos", "Costo"],
        ["Texas §4005.012(a)(1)", "Máximo 35", "Sin publicidad, solo Texas", "$0 (auto-ejecutable)"],
        ["Texas §4005.012(a)(2)", "Máximo 15 en 12 meses", "Inversionistas sofisticados", "$0 (auto-ejecutable)"],
        ["Federal Rule 506(b)", "Hasta 35 no-acreditados", "PPM requerido, sin publicidad", "$2,000-$5,000 (abogado)"],
        ["Federal Rule 506(c)", "Ilimitados acreditados", "Verificación de ingresos", "$3,000-$8,000 (abogado)"],
    ], [1.5*inch, 1.3*inch, 2*inch, 1.7*inch], '#7c3aed'))

    el.append(Paragraph("7.2 Recomendación para Ross Lending", h2))
    el.append(Paragraph("<b>Fase 1 (1-5 inversionistas):</b> Usa Texas §4005.012(a)(2). No necesitas abogado ni SEC. Solo pagarés privados entre tú y el inversionista.", body))
    el.append(Paragraph("<b>Fase 2 (6-15 inversionistas):</b> Formaliza con un abogado. Private Placement Memorandum (PPM) simple.", body))
    el.append(Paragraph("<b>Fase 3 (16+ inversionistas):</b> Usa Rule 506(b) federal. Necesitas abogado de securities ($3K-$5K).", body))

    el.append(Paragraph("7.3 Documentos Necesarios", h2))
    for item_doc in [
        "Promissory Note (Pagaré) — Monto, tasa, plazo, condiciones de pago",
        "Loan Agreement — Términos detallados entre Ross Lending y el inversionista",
        "Personal Guarantee (opcional) — Tu garantía personal al inversionista",
        "Operating Agreement (LLC) — Si creas una entidad separada para el fondo",
        "Investor Disclosure — Riesgos del préstamo, historial de performance",
    ]:
        el.append(Paragraph(f"• {item_doc}", bullet))

    # ═══ 8. TABLA DE RENDIMIENTOS ═══
    el.append(PageBreak())
    el.append(Paragraph("8. TABLA DE RENDIMIENTOS PARA INVERSIONISTAS", h1))
    el.append(tbl([
        ["Capital del Inversionista", "Tasa Ofrecida", "Pago Mensual al Inv.", "Pago Anual", "Tus Ingresos (con ese capital)", "Tu Ganancia Neta"],
        ["$10,000", "10%", "$83", "$1,000", "$9,000+", "$8,000+"],
        ["$25,000", "10%", "$208", "$2,500", "$22,000+", "$19,500+"],
        ["$50,000", "12%", "$500", "$6,000", "$45,000+", "$39,000+"],
        ["$100,000", "12%", "$1,000", "$12,000", "$90,000+", "$78,000+"],
        ["$250,000", "15%", "$3,125", "$37,500", "$225,000+", "$187,500+"],
    ], [1.2*inch, 0.7*inch, 1*inch, 0.8*inch, 1.3*inch, 1.1*inch], '#0f766e'))
    el.append(Paragraph("Nota: 'Tus ingresos' asume rotación mensual Sub F al 15% de retorno promedio después de defaults.", note))

    # ═══ 9. PITCH ═══
    el.append(Paragraph("9. EJEMPLO DE PITCH PARA INVERSIONISTA", h1))
    el.append(Paragraph(
        '"Tengo una empresa de préstamos regulada por el estado de Texas (licencia OCCC). '
        'Otorgamos préstamos personales a la comunidad hispana que no califica en bancos tradicionales. '
        'Las tasas de interés autorizadas por ley van del 18% al 240% APR. '
        'Te ofrezco un retorno fijo del 10-12% anual sobre tu inversión, pagado mensualmente. '
        'Tu dinero está respaldado por préstamos reales con clientes verificados. '
        'Tenemos un sistema tecnológico completo que maneja contratos, cobros automáticos, y reportes. '
        'El mínimo de inversión es $10,000 y puedes retirar tu capital con 90 días de aviso."',
        ParagraphStyle('Pitch', parent=body, leftIndent=20, rightIndent=20, textColor=colors.HexColor('#1e40af'),
                       backColor=colors.HexColor('#eff6ff'), borderPadding=10)
    ))

    # ═══ 10. RIESGOS ═══
    el.append(PageBreak())
    el.append(Paragraph("10. RIESGOS Y MITIGACIÓN", h1))
    el.append(tbl([
        ["Riesgo", "Probabilidad", "Impacto", "Mitigación"],
        ["Clientes no pagan (default)", "5-15%", "Medio", "Diversificar en 50+ préstamos pequeños. Cobros agresivos."],
        ["Capital atrapado (baja rotación)", "Medio", "Alto", "Mantener 80%+ en préstamos cortos (1-2 meses)"],
        ["Cambio regulatorio OCCC", "Bajo", "Alto", "Monitorear occc.texas.gov. Tasas se ajustan 1 vez al año"],
        ["Inversionista quiere salir", "Medio", "Medio", "Cláusula de 90 días de aviso. Reserva de liquidez 10%"],
        ["Recesión económica", "Medio", "Alto", "Préstamos pequeños son anti-cíclicos (más demanda en crisis)"],
        ["Competencia", "Alto", "Bajo", "Tu ventaja: relación con clientes de Ross Tax + tecnología"],
    ], [1.3*inch, 0.8*inch, 0.7*inch, 3.7*inch], '#b91c1c'))

    # ═══ 11. PLAN DE ACCIÓN ═══
    el.append(Paragraph("11. PLAN DE ACCIÓN — PRIMEROS 90 DÍAS", h1))
    el.append(tbl([
        ["Semana", "Acción", "Resultado"],
        ["1-2", "Obtener licencia OCCC + abrir cuenta bancaria dedicada", "Base legal lista"],
        ["2-3", "Configurar productos Sub F ($200-$1,500) en sistema", "Productos listos para vender"],
        ["3-4", "Primeros 10-15 préstamos (clientes de Ross Tax)", "Validar proceso y flujo"],
        ["4-6", "Escalar a 30-40 préstamos/mes", "Cash flow: $2,000-$3,000/mes"],
        ["6-8", "Agregar productos Sub E ($3,000-$10,000) con título de auto", "Diversificar ingresos"],
        ["8-10", "Contactar primer inversionista ($25K-$50K)", "Duplicar capital disponible"],
        ["10-12", "Escalar a 80-100 préstamos/mes", "Cash flow: $6,000-$10,000/mes"],
    ], [0.7*inch, 3.5*inch, 2.3*inch], '#0f172a'))

    el.append(Spacer(1, 20))
    el.append(Paragraph(
        "🎯 META AÑO 1: $27K → $80K+ en capital propio + $50K-$100K de inversionistas = $65,000+ en ganancias netas",
        green
    ))

    # Footer
    el.append(Spacer(1, 30))
    el.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
    el.append(Paragraph(
        "Este documento es una guía estratégica interna para Ross Lending Solutions LLC. "
        "Las proyecciones son estimaciones basadas en tasas OCCC vigentes y asumen condiciones de mercado normales. "
        "Resultados reales pueden variar. Consulte con un asesor financiero y legal antes de tomar decisiones de inversión.",
        ParagraphStyle('Legal', parent=body, fontSize=7.5, textColor=colors.HexColor('#991b1b'), alignment=TA_CENTER, spaceBefore=12)
    ))
    el.append(Paragraph(
        f"Ross Lending Solutions LLC — Estrategia de Capital — {datetime.now().strftime('%d/%m/%Y')} — CONFIDENCIAL",
        footer
    ))

    doc.build(el)
    buf.seek(0)
    return buf
