"""
OCCC Compliance Report PDF Generator
Generates professional QAR (Quarterly Activity Report) and Annual Report PDFs
for OCCC filing and examiner review.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def _styles():
    s = getSampleStyleSheet()
    custom = {
        'Title': ParagraphStyle('OCCCTitle', parent=s['Title'], fontSize=20,
                                textColor=colors.HexColor('#0f172a'), spaceAfter=4),
        'Sub': ParagraphStyle('OCCCSub', parent=s['Normal'], fontSize=10,
                              textColor=colors.HexColor('#64748b'), spaceAfter=16, alignment=TA_CENTER),
        'H2': ParagraphStyle('OCCCH2', parent=s['Heading2'], fontSize=13,
                             textColor=colors.HexColor('#1e40af'), spaceBefore=18, spaceAfter=8),
        'H3': ParagraphStyle('OCCCH3', parent=s['Heading3'], fontSize=11,
                             textColor=colors.HexColor('#334155'), spaceBefore=12, spaceAfter=6),
        'Body': ParagraphStyle('OCCCBody', parent=s['Normal'], fontSize=9.5, leading=13,
                               textColor=colors.HexColor('#374151')),
        'Small': ParagraphStyle('OCCCSmall', parent=s['Normal'], fontSize=7.5,
                                textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER),
        'Legal': ParagraphStyle('OCCCLegal', parent=s['Normal'], fontSize=8,
                                textColor=colors.HexColor('#991b1b'), alignment=TA_CENTER, spaceBefore=20),
    }
    return custom


def _fmt(n):
    return f"${n:,.2f}" if n else "$0.00"


def _pct(n):
    return f"{n:.1f}%" if n else "0.0%"


def _make_table(data, col_widths, header_color='#1e40af'):
    t = Table(data, colWidths=col_widths)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    t.setStyle(TableStyle(style))
    return t


def _header(elements, sty, title, period_label):
    elements.append(Paragraph("ROSS LENDING SOLUTIONS LLC", sty['Title']))
    elements.append(Paragraph(
        f"OCCC Regulated Lender — Texas Finance Code Chapter 342-E/F<br/>"
        f"{title}<br/>"
        f"Período: {period_label}",
        sty['Sub']
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1')))
    elements.append(Spacer(1, 12))


def _footer(elements, sty):
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0')))
    elements.append(Paragraph(
        "Este documento fue preparado para cumplimiento regulatorio ante la Office of Consumer Credit Commissioner (OCCC) "
        "del Estado de Texas. Los datos provienen del sistema de gestión de préstamos de Ross Lending Solutions LLC. "
        "Para presentación oficial, transfiera estos datos al portal NMLS (nmls.org).",
        sty['Legal']
    ))
    elements.append(Paragraph(
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} — Ross Lending Solutions LLC — Confidencial",
        sty['Small']
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# QAR — QUARTERLY ACTIVITY REPORT PDF
# ═══════════════════════════════════════════════════════════════════════════════
def generate_qar_pdf(report_data: dict) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    sty = _styles()
    elements = []

    period = report_data.get('period_label', 'Q1')
    _header(elements, sty, f"REPORTE TRIMESTRAL DE ACTIVIDAD (QAR) — {period}", report_data.get('date_range', ''))

    # Company Info
    elements.append(Paragraph("INFORMACIÓN DE LA EMPRESA", sty['H2']))
    company_data = [
        ["Campo", "Valor"],
        ["Razón Social", "Ross Lending Solutions LLC"],
        ["Licencia OCCC", "Regulated Lender — Chapter 342-E/F"],
        ["NMLS ID", "Pendiente de asignación"],
        ["Dirección", "Texas, United States"],
        ["Período del Reporte", report_data.get('date_range', '')],
        ["Fecha de Generación", datetime.now().strftime('%d/%m/%Y %H:%M')],
    ]
    elements.append(_make_table(company_data, [2.5*inch, 4*inch]))

    # Summary
    s = report_data.get('summary', {})
    elements.append(Paragraph("RESUMEN DE ACTIVIDAD DEL PERÍODO", sty['H2']))
    summary_rows = [
        ["Concepto", "Valor"],
        ["Préstamos Originados", str(s.get('total_loans_originated', 0))],
        ["Monto Total Originado", _fmt(s.get('total_amount_originated', 0))],
        ["Intereses Cobrados", _fmt(s.get('total_interest_charged', 0))],
        ["Cuotas/Fees Cobrados", _fmt(s.get('total_fees_collected', 0))],
        ["Pagos Recibidos (Total)", _fmt(s.get('total_payments_received', 0))],
        ["Portafolio Pendiente", _fmt(s.get('portfolio_outstanding', 0))],
        ["Préstamos Activos", str(s.get('active_loans', 0))],
        ["Préstamos en Mora", str(s.get('delinquent_loans', 0))],
        ["Tasa de Morosidad", _pct(s.get('delinquency_rate', 0))],
        ["Préstamo Promedio", _fmt(s.get('avg_loan_size', 0))],
    ]
    elements.append(_make_table(summary_rows, [3*inch, 3.5*inch], '#0f766e'))

    # By Loan Type
    by_type = report_data.get('by_loan_type', {})
    if by_type:
        elements.append(Paragraph("DESGLOSE POR TIPO DE PRÉSTAMO", sty['H2']))
        type_labels = {
            'subchapter_e': 'Subchapter E (Personal)',
            'subchapter_f': 'Subchapter F (Small Loan)',
            'tax_advance': 'Tax Advance (Anticipos)',
            'personal': 'Préstamo Personal',
        }
        type_rows = [["Tipo", "Cantidad", "Originado", "Interés", "Fees", "Tasa Prom.", "Plazo Prom."]]
        for lt, data in by_type.items():
            type_rows.append([
                type_labels.get(lt, lt),
                str(data.get('loans_originated', 0)),
                _fmt(data.get('amount_originated', 0)),
                _fmt(data.get('interest_charged', 0)),
                _fmt(data.get('fees_collected', 0)),
                _pct(data.get('avg_rate', 0)),
                f"{data.get('avg_term', 0):.0f} meses",
            ])
        elements.append(_make_table(type_rows, [1.4*inch, 0.7*inch, 1*inch, 0.9*inch, 0.9*inch, 0.8*inch, 0.8*inch]))

    # Delinquency Buckets
    buckets = report_data.get('delinquency_buckets', {})
    if buckets:
        elements.append(Paragraph("ANÁLISIS DE MOROSIDAD (AGING BUCKETS)", sty['H2']))
        bucket_rows = [
            ["Categoría", "Cantidad de Préstamos"],
            ["Al Corriente (Current)", str(buckets.get('current', 0))],
            ["1-30 Días Vencido", str(buckets.get('1_30', 0))],
            ["31-60 Días Vencido", str(buckets.get('31_60', 0))],
            ["61-90 Días Vencido", str(buckets.get('61_90', 0))],
            ["90+ Días Vencido", str(buckets.get('90_plus', 0))],
        ]
        elements.append(_make_table(bucket_rows, [3.5*inch, 3*inch], '#b91c1c'))

    # NMLS Copy Section
    elements.append(PageBreak())
    elements.append(Paragraph("DATOS PARA PRESENTACIÓN NMLS", sty['H2']))
    elements.append(Paragraph(
        "Los siguientes datos deben ingresarse en el portal NMLS (nmls.org) para la presentación "
        "oficial del Reporte Trimestral de Actividad ante la OCCC:",
        sty['Body']
    ))
    nmls_data = [
        ["Campo NMLS", "Valor a Ingresar"],
        ["Total Loans Made", str(s.get('total_loans_originated', 0))],
        ["Total Dollar Amount of Loans Made", _fmt(s.get('total_amount_originated', 0))],
        ["Total Finance Charges", _fmt(s.get('total_interest_charged', 0))],
        ["Total Fees Charged", _fmt(s.get('total_fees_collected', 0))],
        ["Number of Active Loans at End of Period", str(s.get('active_loans', 0))],
        ["Outstanding Balance at End of Period", _fmt(s.get('portfolio_outstanding', 0))],
        ["Number of Delinquent Loans (30+ days)", str(s.get('delinquent_loans', 0))],
        ["Delinquency Rate", _pct(s.get('delinquency_rate', 0))],
    ]
    elements.append(_make_table(nmls_data, [3.5*inch, 3*inch], '#7c3aed'))

    _footer(elements, sty)
    doc.build(elements)
    buf.seek(0)
    return buf


# ═══════════════════════════════════════════════════════════════════════════════
# ANNUAL REPORT PDF
# ═══════════════════════════════════════════════════════════════════════════════
def generate_annual_report_pdf(report_data: dict) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    sty = _styles()
    elements = []

    year = report_data.get('year', datetime.now().year)
    _header(elements, sty, f"REPORTE ANUAL COMPRENSIVO — {year}", report_data.get('date_range', ''))

    # Company Info
    elements.append(Paragraph("INFORMACIÓN DE LA EMPRESA", sty['H2']))
    co_data = [
        ["Campo", "Valor"],
        ["Razón Social", "Ross Lending Solutions LLC"],
        ["Licencia", "OCCC Regulated Lender — Chapter 342-E/F"],
        ["Año Fiscal", str(year)],
        ["Período", report_data.get('date_range', '')],
    ]
    elements.append(_make_table(co_data, [2.5*inch, 4*inch]))

    # Annual Summary
    s = report_data.get('annual_summary', {})
    elements.append(Paragraph("RESUMEN ANUAL", sty['H2']))
    annual_rows = [
        ["Concepto", "Valor"],
        ["Total Préstamos Originados", str(s.get('total_loans_originated', 0))],
        ["Capital Total Originado", _fmt(s.get('total_amount_originated', 0))],
        ["Intereses Totales Cobrados", _fmt(s.get('total_interest_charged', 0))],
        ["Cuotas/Fees Totales", _fmt(s.get('total_fees_collected', 0))],
        ["Ingresos Brutos (Interest + Fees)", _fmt(s.get('gross_revenue', 0))],
        ["Total Pagos Recibidos", _fmt(s.get('total_payments_received', 0))],
        ["Portafolio Pendiente al Cierre", _fmt(s.get('portfolio_outstanding', 0))],
        ["Préstamos Activos al Cierre", str(s.get('active_portfolio_count', 0))],
    ]
    elements.append(_make_table(annual_rows, [3*inch, 3.5*inch], '#0f766e'))

    # Quarterly Breakdown
    qb = report_data.get('quarterly_breakdown', {})
    if qb:
        elements.append(Paragraph("DESGLOSE TRIMESTRAL", sty['H2']))
        q_rows = [["Trimestre", "Préstamos", "Originado", "Interés", "Fees", "Pagos Recibidos"]]
        for q_name, q_data in sorted(qb.items()):
            q_rows.append([
                q_name,
                str(q_data.get('loans_originated', 0)),
                _fmt(q_data.get('amount_originated', 0)),
                _fmt(q_data.get('interest_charged', 0)),
                _fmt(q_data.get('fees_collected', 0)),
                _fmt(q_data.get('payments_received', 0)),
            ])
        # Totals row
        q_rows.append([
            "TOTAL ANUAL",
            str(s.get('total_loans_originated', 0)),
            _fmt(s.get('total_amount_originated', 0)),
            _fmt(s.get('total_interest_charged', 0)),
            _fmt(s.get('total_fees_collected', 0)),
            _fmt(s.get('total_payments_received', 0)),
        ])
        t = _make_table(q_rows, [1.1*inch, 0.9*inch, 1.1*inch, 1*inch, 1*inch, 1.2*inch])
        # Bold total row
        t.setStyle(TableStyle([('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                               ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e0f2fe'))]))
        elements.append(t)

    # Monthly Breakdown
    mb = report_data.get('monthly_breakdown', {})
    if mb:
        elements.append(PageBreak())
        elements.append(Paragraph("DESGLOSE MENSUAL", sty['H2']))
        m_rows = [["Mes", "Préstamos", "Originado", "Pagos Recibidos", "Fees"]]
        for m_key in sorted(mb.keys()):
            m_data = mb[m_key]
            m_rows.append([
                m_key,
                str(m_data.get('loans_originated', 0)),
                _fmt(m_data.get('amount_originated', 0)),
                _fmt(m_data.get('payments_received', 0)),
                _fmt(m_data.get('fees_collected', 0)),
            ])
        elements.append(_make_table(m_rows, [1.3*inch, 1*inch, 1.5*inch, 1.5*inch, 1.2*inch]))

    # By Type
    bt = report_data.get('by_loan_type', {})
    if bt:
        elements.append(Paragraph("POR TIPO DE PRODUCTO", sty['H2']))
        type_labels = {
            'subchapter_e': 'Subchapter E',
            'subchapter_f': 'Subchapter F',
            'tax_advance': 'Tax Advance',
            'personal': 'Personal',
        }
        bt_rows = [["Tipo", "Cantidad", "Originado", "Interés", "Fees", "Tasa Prom."]]
        for lt, data in bt.items():
            bt_rows.append([
                type_labels.get(lt, lt),
                str(data.get('count', 0)),
                _fmt(data.get('total_originated', 0)),
                _fmt(data.get('total_interest', 0)),
                _fmt(data.get('total_fees', 0)),
                _pct(data.get('avg_rate', 0)),
            ])
        elements.append(_make_table(bt_rows, [1.3*inch, 0.8*inch, 1.2*inch, 1.1*inch, 1*inch, 1.1*inch]))

    # NMLS Section
    elements.append(Paragraph("DATOS PARA PRESENTACIÓN NMLS — REPORTE ANUAL", sty['H2']))
    nmls_rows = [
        ["Campo NMLS", "Valor"],
        ["Total Loans Made (Year)", str(s.get('total_loans_originated', 0))],
        ["Total Dollar Volume", _fmt(s.get('total_amount_originated', 0))],
        ["Gross Revenue (Interest + Fees)", _fmt(s.get('gross_revenue', 0))],
        ["Outstanding Portfolio at Year End", _fmt(s.get('portfolio_outstanding', 0))],
        ["Active Loans at Year End", str(s.get('active_portfolio_count', 0))],
        ["Net Collections", _fmt(s.get('total_payments_received', 0))],
    ]
    elements.append(_make_table(nmls_rows, [3.5*inch, 3*inch], '#7c3aed'))

    _footer(elements, sty)
    doc.build(elements)
    buf.seek(0)
    return buf
