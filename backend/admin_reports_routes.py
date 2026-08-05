"""
Admin Reports & Document Routes
Extracted from server.py — Handles PDF generation, legal documents listing,
and email delivery for audit reports, rate cards, strategy guides, OCCC guides,
and compliance reports.
"""
import logging
import os
import smtplib
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter()
_db = None


def init_admin_reports(db):
    global _db
    _db = db


# ═══ Helper: Send email with PDF attachment(s) ═══
async def _send_email_with_attachments(to_email: str, subject: str, html_body: str, attachments: list) -> bool:
    """Send email with PDF attachments via SMTP. Returns True if sent."""
    try:
        from unified_config_manager import config_manager
        host = await config_manager.get('smtp_host')
        port = int(await config_manager.get('smtp_port') or 465)
        username = await config_manager.get('smtp_username')
        password = await config_manager.get('smtp_password')
        encryption = await config_manager.get('smtp_encryption') or 'SSL'
        from_name = await config_manager.get('email_from_name') or 'Ross Lending Solutions'
        from_addr = await config_manager.get('email_from_address') or username

        if not (host and username and password):
            return False

        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_addr}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        for att in attachments:
            part = MIMEBase('application', 'pdf')
            if isinstance(att['data'], bytes):
                part.set_payload(att['data'])
            else:
                part.set_payload(att['data'].getvalue())
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{att["filename"]}"')
            msg.attach(part)

        if encryption.upper() == 'SSL':
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls()
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        logging.error(f"Email send error: {e}")
        return False


def _static_dir():
    return os.path.join(os.path.dirname(__file__), "static")


def _save_pdf(buf, filename):
    fpath = os.path.join(_static_dir(), filename)
    with open(fpath, "wb") as f:
        f.write(buf.getvalue() if hasattr(buf, 'getvalue') else buf)
    return fpath


# ═══ Static File Downloads ═══
@router.get("/downloads/{filename}")
async def download_file(filename: str):
    filepath = os.path.join(_static_dir(), filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, filename=filename, media_type="application/pdf")


# ═══ Legal Documents Listing ═══
@router.get("/admin/legal-documents")
async def list_legal_documents():
    """List all legal/compliance PDF documents from the static folder."""
    static_dir = _static_dir()
    documents = []
    DOC_META = {
        "RossLending_AML_BSA_Compliance_Program.pdf": {
            "title": "Programa de Cumplimiento AML/BSA",
            "description": "Política anti-lavado de dinero y Bank Secrecy Act — 17 secciones completas.",
            "category": "OCCC / Regulatorio",
            "icon": "🛡️",
            "date_label": "Mayo 2025",
        },
        "RossLending_OCCC_Financial_Statement_ADM17.pdf": {
            "title": "Estado Financiero ADM17 — OCCC",
            "description": "Formulario financiero requerido para la solicitud de licencia OCCC Cap. 342-E.",
            "category": "OCCC / Regulatorio",
            "icon": "📊",
            "date_label": "Mayo 2025",
        },
        "Bank_Confirmation_RossLending_Filled.pdf": {
            "title": "Confirmación Bancaria — Happy State Bank",
            "description": "Carta de confirmación de cuenta bancaria para la solicitud OCCC.",
            "category": "OCCC / Regulatorio",
            "icon": "🏦",
            "date_label": "Mayo 2025",
        },
        "Centennial_Bank_RossLending_Answers.pdf": {
            "title": "Cuestionario Due Diligence — Centennial Bank",
            "description": "Respuestas al cuestionario de due diligence bancario para apertura de cuenta de fideicomiso.",
            "category": "Due Diligence Bancario",
            "icon": "📋",
            "date_label": "Mayo 2025",
        },
        "Ross_Tax_Data_Retention_Disposal_Policy.pdf": {
            "title": "Política de Retención y Destrucción de Datos",
            "description": "Política interna para retención, almacenamiento y destrucción de documentos de clientes.",
            "category": "Políticas Internas",
            "icon": "🗂️",
            "date_label": "Abril 2025",
        },
        "Ross_Tax_Information_Security_Policy.pdf": {
            "title": "Política de Seguridad de la Información",
            "description": "Programa de seguridad de datos, encriptación y controles de acceso.",
            "category": "Políticas Internas",
            "icon": "🔒",
            "date_label": "Abril 2025",
        },
        "ross_tax_bookkeeping_plan.pdf": {
            "title": "Plan de Contabilidad — Ross Tax",
            "description": "Plan detallado de estructura contable y procedimientos financieros.",
            "category": "Reportes y Planes",
            "icon": "📒",
            "date_label": "Abril 2025",
        },
        "ross_tax_diagnostic_report.pdf": {
            "title": "Reporte Diagnóstico Empresarial",
            "description": "Análisis integral del estado del negocio con recomendaciones estratégicas.",
            "category": "Reportes y Planes",
            "icon": "📈",
            "date_label": "Abril 2025",
        },
    }
    if os.path.isdir(static_dir):
        for fname in sorted(os.listdir(static_dir)):
            if fname.lower().endswith(".pdf"):
                fpath = os.path.join(static_dir, fname)
                meta = DOC_META.get(fname, {})
                size_bytes = os.path.getsize(fpath)
                documents.append({
                    "filename": fname,
                    "title": meta.get("title", fname.replace("_", " ").replace(".pdf", "")),
                    "description": meta.get("description", ""),
                    "category": meta.get("category", "Otros"),
                    "icon": meta.get("icon", "📄"),
                    "date_label": meta.get("date_label", ""),
                    "size_kb": round(size_bytes / 1024, 1),
                    "download_url": f"/api/downloads/{fname}",
                })
    return {"documents": documents, "total": len(documents)}


# ═══ Audit Report Generation & Email ═══
@router.post("/admin/audit-report")
async def generate_and_send_audit(request: Request):
    """Generate an admin panel audit PDF and optionally email it."""
    from audit_report_generator import generate_audit_report

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    to_email = body.get("email", "yoandyross@gmail.com")

    stats = {}
    try:
        stats_col = _db["regulated_loans"]
        total_loans = await stats_col.count_documents({})
        active_loans = await stats_col.count_documents({"status": "active"})
        pipeline = [{"$group": {"_id": None, "total_portfolio": {"$sum": "$amount"}, "total_balance": {"$sum": "$balance"}, "total_interest": {"$sum": "$interest_paid"}}}]
        agg = await stats_col.aggregate(pipeline).to_list(1)
        if agg:
            stats = {
                "total_loans": total_loans,
                "active_loans": active_loans,
                "total_portfolio": agg[0].get("total_portfolio", 0),
                "total_balance": agg[0].get("total_balance", 0),
                "total_interest_earned": agg[0].get("total_interest", 0),
                "delinquency_rate": 0,
            }
    except Exception as e:
        logging.error(f"Stats error: {e}")

    pdf_buf = generate_audit_report(stats)
    filename = f"Auditoria_AdminPanel_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    _save_pdf(pdf_buf, filename)
    pdf_buf.seek(0)

    now = datetime.now()
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #1a5632; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Ross Lending Solutions</h1>
            <p style="color: #bbf7d0; margin: 5px 0 0; font-size: 12px;">Auditoría del Panel Administrativo</p>
        </div>
        <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
            <p style="color: #334155;">Se ha generado una auditoría integral del panel administrativo de Ross Lending Solutions.</p>
            <p style="color: #334155;">El informe incluye:</p>
            <ul style="color: #475569; font-size: 14px;">
                <li>Evaluación de los 19 módulos administrativos</li>
                <li>Mejoras implementadas (Dashboard, Reportes, Pagos, Clientes)</li>
                <li>Nuevas funcionalidades (P&L, Cash Flow, Recibos PDF, Legales)</li>
                <li>Estado de seguridad y cumplimiento</li>
                <li>Recomendaciones futuras</li>
            </ul>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Fecha: {now.strftime('%d de %B de %Y — %H:%M')}</p>
            <p style="color: #94a3b8; font-size: 10px;">Documento adjunto en formato PDF — Uso Interno Confidencial</p>
        </div>
    </div>
    """
    email_sent = await _send_email_with_attachments(
        to_email,
        f"Auditoría Admin Panel — Ross Lending Solutions — {now.strftime('%d/%m/%Y')}",
        html_body,
        [{"filename": filename, "data": pdf_buf}]
    )

    return {
        "success": True,
        "filename": filename,
        "download_url": f"/api/downloads/{filename}",
        "email_sent": email_sent,
        "email_to": to_email if email_sent else None,
        "message": f"Auditoría generada. {'Email enviado a ' + to_email if email_sent else 'PDF guardado (email no configurado)'}"
    }


# ═══ Client Rate Card PDF ═══
@router.post("/admin/client-rate-card")
async def generate_client_rate_card(request: Request):
    """Generate a printable client-facing rate card PDF."""
    import io
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors as rc
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.enums import TA_CENTER

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    term = body.get("term_months", 1)
    to_email = body.get("email", "")

    AMOUNTS = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500]

    def calc(amt, t):
        acq = min(amt * 0.125, 125)
        handling = (amt / 100) * (8 if amt <= 270 else 4) * t
        total_int = acq + handling
        total = amt + total_int
        monthly = total / t
        weekly = monthly / 4.33
        return {"amount": amt, "total": total, "interest": total_int, "monthly": monthly, "weekly": weekly}

    rows = [calc(a, term) for a in AMOUNTS]

    buf = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.4*inch, leftMargin=0.6*inch, rightMargin=0.6*inch)
    ss = getSampleStyleSheet()
    ttl = ParagraphStyle('T', parent=ss['Title'], fontSize=22, textColor=rc.HexColor('#0f766e'), spaceAfter=2, alignment=TA_CENTER)
    sbt = ParagraphStyle('S', parent=ss['Normal'], fontSize=11, textColor=rc.HexColor('#64748b'), spaceAfter=8, alignment=TA_CENTER)
    ft = ParagraphStyle('F', parent=ss['Normal'], fontSize=7.5, textColor=rc.HexColor('#94a3b8'), alignment=TA_CENTER)
    nt = ParagraphStyle('N', parent=ss['Normal'], fontSize=8, textColor=rc.HexColor('#92400e'), alignment=TA_CENTER)

    el = []
    el.append(Paragraph("ROSS LENDING SOLUTIONS", ttl))
    el.append(Paragraph("Préstamos Personales — Rápidos y Confiables", sbt))
    el.append(Spacer(1, 4))

    badge_data = [[f"Plazo: {term} mes{'es' if term > 1 else ''} — Pagos Semanales y Mensuales"]]
    bt = Table(badge_data, colWidths=[4*inch])
    bt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), rc.HexColor('#0f766e')),
        ('TEXTCOLOR', (0,0), (-1,-1), rc.white),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    el.append(bt)
    el.append(Spacer(1, 12))

    header = ["Préstamo", "Total a Pagar", "Pago Semanal", "# Semanas", "Pago Mensual", f"# Mes{'es' if term > 1 else ''}", "Costo Servicio"]
    data = [header]
    for r in rows:
        data.append([
            f"${r['amount']:,.0f}",
            f"${r['total']:,.2f}",
            f"${r['weekly']:,.2f}",
            str(term * 4),
            f"${r['monthly']:,.2f}",
            str(term),
            f"${r['interest']:,.2f}",
        ])

    t = Table(data, colWidths=[0.85*inch, 0.95*inch, 0.95*inch, 0.7*inch, 0.95*inch, 0.6*inch, 0.95*inch])
    style_list = [
        ('BACKGROUND', (0,0), (-1,0), rc.HexColor('#0f766e')),
        ('TEXTCOLOR', (0,0), (-1,0), rc.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('FONTSIZE', (0,1), (-1,-1), 9.5),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,1), (0,-1), rc.HexColor('#0f766e')),
        ('FONTSIZE', (0,1), (0,-1), 11),
        ('FONTNAME', (2,1), (2,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2,1), (2,-1), rc.HexColor('#0f766e')),
        ('FONTSIZE', (2,1), (2,-1), 11),
        ('GRID', (0,0), (-1,-1), 0.5, rc.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_list.append(('BACKGROUND', (0,i), (-1,i), rc.HexColor('#f0fdfa')))
    for i in range(1, len(data)):
        style_list.append(('BACKGROUND', (2,i), (2,i), rc.HexColor('#ecfdf5') if i % 2 != 0 else rc.HexColor('#d1fae5')))
    t.setStyle(TableStyle(style_list))
    el.append(t)
    el.append(Spacer(1, 10))

    el.append(Paragraph(
        "⚠️ Préstamo de firma — No requiere garantía · Solo necesita identificación válida · "
        "Aprobación el mismo día · Pago anticipado sin penalidad",
        nt
    ))
    el.append(Spacer(1, 8))

    el.append(HRFlowable(width="100%", thickness=1, color=rc.HexColor('#0f766e')))
    el.append(Spacer(1, 8))
    el.append(Paragraph("⭐ LOS MÁS POPULARES", ParagraphStyle('Pop', parent=ss['Heading3'], fontSize=13, textColor=rc.HexColor('#0f766e'), alignment=TA_CENTER)))
    pop = [calc(a, term) for a in [200, 300, 500, 1000]]
    pop_data = [["$200", "$300", "$500", "$1,000"]]
    pop_data.append([f"Semanal: ${p['weekly']:,.2f}" for p in pop])
    pop_data.append([f"Total: ${p['total']:,.2f}" for p in pop])
    pt = Table(pop_data, colWidths=[1.6*inch]*4)
    pt.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 16),
        ('TEXTCOLOR', (0,0), (-1,0), rc.HexColor('#0f766e')),
        ('FONTSIZE', (0,1), (-1,1), 11),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,2), (-1,2), 9),
        ('TEXTCOLOR', (0,2), (-1,2), rc.HexColor('#6b7280')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BACKGROUND', (0,0), (-1,-1), rc.HexColor('#f0fdfa')),
        ('BOX', (0,0), (-1,-1), 1, rc.HexColor('#0f766e')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, rc.HexColor('#d1fae5')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    el.append(pt)
    el.append(Spacer(1, 12))

    el.append(Paragraph(
        "Ross Lending Solutions LLC — Texas OCCC Regulated Lender — Chapter 342<br/>"
        "Las tasas están sujetas a cambios según regulación OCCC. Sujeto a aprobación.",
        ft
    ))

    doc_pdf.build(el)
    buf.seek(0)
    fname = f"RossLending_Tabla_Pagos_{term}mes{'es' if term > 1 else ''}.pdf"
    _save_pdf(buf, fname)
    buf.seek(0)

    email_sent = False
    if to_email:
        email_sent = await _send_email_with_attachments(
            to_email,
            f"Tabla de Pagos — Ross Lending ({term} mes{'es' if term > 1 else ''})",
            f"<p>Adjunto tabla de pagos para clientes — plazo {term} mes{'es' if term > 1 else ''}.</p>",
            [{"filename": fname, "data": buf}]
        )

    return {"success": True, "filename": fname, "download_url": f"/api/downloads/{fname}", "email_sent": email_sent}


# ═══ Lending Strategy Guide — PDF + Email ═══
@router.post("/admin/strategy-guide")
async def send_strategy_guide(request: Request):
    """Generate lending strategy + investor model PDF and send via email."""
    from lending_strategy_generator import generate_strategy_guide

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    to_email = body.get("email", "yoandyross@gmail.com")

    pdf_buf = generate_strategy_guide()
    fname = f"RossLending_Estrategia_Capital_{datetime.now().strftime('%Y%m%d')}.pdf"
    _save_pdf(pdf_buf, fname)
    pdf_buf.seek(0)

    now = datetime.now()
    html = f"""
    <div style="font-family:Arial;max-width:600px;">
        <div style="background:linear-gradient(135deg,#1e40af,#b45309);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:20px;">Ross Lending Solutions</h1>
            <p style="color:#fef3c7;margin:5px 0 0;font-size:12px;">Estrategia de Máxima Ganancia + Inversionistas</p>
        </div>
        <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
            <p style="color:#334155;">Se adjunta tu guía estratégica completa (11 secciones):</p>
            <ul style="font-size:13px;color:#475569;">
                <li>Productos Sub E/F con tasas legales y ejemplos</li>
                <li>Estrategia $27K — máxima ganancia corto plazo</li>
                <li>Estrategia $80K — diversificación</li>
                <li>Proyección financiera a 12 meses</li>
                <li>Rotación de capital (cómo reciclar dinero)</li>
                <li>Modelo de inversionistas privados</li>
                <li>Estructura legal en Texas (exenciones SEC)</li>
                <li>Tabla de rendimientos para inversionistas</li>
                <li>Pitch de ejemplo para inversionistas</li>
                <li>Riesgos y mitigación</li>
                <li>Plan de acción — primeros 90 días</li>
            </ul>
            <p style="color:#94a3b8;font-size:10px;margin-top:16px;">{now.strftime('%d/%m/%Y %H:%M')} — Confidencial</p>
        </div>
    </div>"""

    email_sent = await _send_email_with_attachments(
        to_email,
        "Estrategia de Capital + Modelo de Inversionistas — Ross Lending",
        html,
        [{"filename": fname, "data": pdf_buf}]
    )

    return {"success": True, "filename": fname, "download_url": f"/api/downloads/{fname}", "email_sent": email_sent, "email_to": to_email if email_sent else None}


# ═══ OCCC License Guide — Full Reference PDF + Email ═══
@router.post("/admin/occc-license-guide")
async def send_occc_license_guide(request: Request):
    """Generate the complete OCCC license guide PDF and send via email."""
    from occc_license_guide_generator import generate_occc_license_guide

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    to_email = body.get("email", "yoandyross@gmail.com")

    pdf_buf = generate_occc_license_guide()
    fname = f"OCCC_Guia_Completa_Ross_Lending_{datetime.now().strftime('%Y%m%d')}.pdf"
    _save_pdf(pdf_buf, fname)
    pdf_buf.seek(0)

    now = datetime.now()
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: linear-gradient(135deg, #1e40af, #0f766e); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Ross Lending Solutions LLC</h1>
            <p style="color: #bfdbfe; margin: 5px 0 0; font-size: 12px;">Guía Completa de Licencia OCCC — Chapter 342</p>
        </div>
        <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 14px;">Se adjunta la guía completa de tu licencia de Regulated Lender. El documento incluye:</p>
            <ul style="font-size: 13px; color: #475569;">
                <li><strong>Subchapter E</strong> — Préstamos al consumidor (tasas, montos, productos)</li>
                <li><strong>Subchapter F</strong> — Préstamos pequeños / signature loans</li>
                <li><strong>Subchapter G</strong> — Hipotecas secundarias</li>
                <li><strong>Tabla comparativa</strong> de todos los tipos</li>
                <li><strong>Prácticas prohibidas</strong> (Subchapter K)</li>
                <li><strong>Requisitos de divulgación</strong> y documentación</li>
                <li><strong>Calendario de cumplimiento</strong> anual</li>
                <li><strong>Checklist completo</strong> de cumplimiento OCCC</li>
            </ul>
            <div style="margin-top: 16px; padding: 12px; background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px;">
                <p style="color: #065f46; font-size: 12px; margin: 0;">
                    ✅ 12 secciones · Tabla comparativa de 3 subcapítulos · Checklist de 18 puntos · Calendario anual
                </p>
            </div>
            <p style="color: #94a3b8; font-size: 10px; margin-top: 16px;">
                {now.strftime('%d/%m/%Y %H:%M')} — Uso Interno Confidencial
            </p>
        </div>
    </div>
    """

    email_sent = await _send_email_with_attachments(
        to_email,
        "Guía Completa OCCC — Tipos de Préstamos y Cumplimiento — Ross Lending",
        html_body,
        [{"filename": fname, "data": pdf_buf}]
    )

    return {
        "success": True,
        "filename": fname,
        "download_url": f"/api/downloads/{fname}",
        "email_sent": email_sent,
        "email_to": to_email if email_sent else None,
    }


# ═══ OCCC Compliance Reports as PDF + Email ═══
@router.post("/admin/compliance/generate-reports")
async def generate_compliance_reports_pdf(request: Request):
    """Generate QAR + Annual Report PDFs and optionally send via email with sample contracts."""
    from occc_report_pdf_generator import generate_qar_pdf, generate_annual_report_pdf

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    to_email = body.get("email", "yoandyross@gmail.com")
    include_contracts = body.get("include_contracts", True)

    generated_files = []
    now = datetime.now()

    # 1. Generate QAR for each quarter of the current year
    for q in ['q1', 'q2', 'q3', 'q4']:
        try:
            from compliance_router import _period_dates, _gather_period_data
            start, end, _ = _period_dates(q)
            if end > now:
                continue
            start_iso, end_iso = start.isoformat(), end.isoformat()
            loans, payments, all_active = await _gather_period_data(_db, start_iso, end_iso)
            if not loans and not all_active:
                continue

            by_type = {}
            for lt in ["subchapter_e", "subchapter_f", "tax_advance", "personal"]:
                type_loans = [l for l in loans if l.get("loan_type") == lt]
                loan_ids = [str(l["_id"]) for l in type_loans]
                type_payments = [p for p in payments if str(p.get("loan_id")) in loan_ids]
                by_type[lt] = {
                    "loans_originated": len(type_loans),
                    "amount_originated": sum(l.get("amount", 0) for l in type_loans),
                    "interest_charged": sum(l.get("total_interest", 0) for l in type_loans),
                    "fees_collected": sum(l.get("admin_fee", 0) for l in type_loans),
                    "avg_rate": round(sum(l.get("interest_rate", 0) for l in type_loans) / max(len(type_loans), 1), 2),
                    "avg_term": round(sum(l.get("term_months", 0) for l in type_loans) / max(len(type_loans), 1), 1),
                }

            delinquent = [l for l in all_active if l.get("status") == "delinquent"]
            total_orig = sum(l.get("amount", 0) for l in loans)

            qar_data = {
                "period_label": f"Q{q[1]} {now.year}",
                "date_range": f"{start.strftime('%Y-%m-%d')} — {end.strftime('%Y-%m-%d')}",
                "summary": {
                    "total_loans_originated": len(loans),
                    "total_amount_originated": total_orig,
                    "total_interest_charged": sum(l.get("total_interest", 0) for l in loans),
                    "total_fees_collected": sum(l.get("admin_fee", 0) for l in loans),
                    "total_payments_received": sum(p.get("amount", 0) for p in payments),
                    "portfolio_outstanding": sum(l.get("balance", 0) for l in all_active),
                    "active_loans": len(all_active),
                    "delinquent_loans": len(delinquent),
                    "delinquency_rate": round(len(delinquent) / max(len(all_active), 1) * 100, 1),
                    "avg_loan_size": round(total_orig / max(len(loans), 1), 2),
                },
                "by_loan_type": by_type,
                "delinquency_buckets": {"current": len(all_active) - len(delinquent), "1_30": len(delinquent)},
            }

            pdf_buf = generate_qar_pdf(qar_data)
            fname = f"OCCC_QAR_{q.upper()}_{now.year}.pdf"
            _save_pdf(pdf_buf, fname)
            generated_files.append({"filename": fname, "path": os.path.join(_static_dir(), fname), "type": "QAR", "label": f"QAR {q.upper()} {now.year}"})
        except Exception as e:
            logging.error(f"QAR {q} error: {e}")

    # 2. Generate Annual Report
    try:
        from compliance_router import _period_dates, _gather_period_data
        year_start = datetime(now.year, 1, 1)
        year_end = now
        start_iso, end_iso = year_start.isoformat(), year_end.isoformat()
        loans, payments, all_active = await _gather_period_data(_db, start_iso, end_iso)

        monthly = {}
        for m in range(1, 13):
            m_key = f"{now.year}-{m:02d}"
            m_loans = [l for l in loans if str(l.get("created_at", "")).startswith(m_key)]
            m_payments = [p for p in payments if str(p.get("payment_date", "")).startswith(m_key)]
            monthly[m_key] = {
                "loans_originated": len(m_loans),
                "amount_originated": sum(l.get("amount", 0) for l in m_loans),
                "payments_received": sum(p.get("amount", 0) for p in m_payments),
                "fees_collected": sum(l.get("admin_fee", 0) for l in m_loans),
            }

        quarterly = {}
        for qi in range(1, 5):
            q_start = (qi - 1) * 3 + 1
            q_months = [f"{now.year}-{m:02d}" for m in range(q_start, q_start + 3)]
            q_loans = [l for l in loans if any(str(l.get("created_at", "")).startswith(m) for m in q_months)]
            q_payments = [p for p in payments if any(str(p.get("payment_date", "")).startswith(m) for m in q_months)]
            quarterly[f"Q{qi}"] = {
                "loans_originated": len(q_loans),
                "amount_originated": sum(l.get("amount", 0) for l in q_loans),
                "interest_charged": sum(l.get("total_interest", 0) for l in q_loans),
                "fees_collected": sum(l.get("admin_fee", 0) for l in q_loans),
                "payments_received": sum(p.get("amount", 0) for p in q_payments),
            }

        by_type = {}
        for lt in ["subchapter_e", "subchapter_f", "tax_advance", "personal"]:
            tl = [l for l in loans if l.get("loan_type") == lt]
            by_type[lt] = {
                "count": len(tl),
                "total_originated": sum(l.get("amount", 0) for l in tl),
                "total_interest": sum(l.get("total_interest", 0) for l in tl),
                "total_fees": sum(l.get("admin_fee", 0) for l in tl),
                "avg_rate": round(sum(l.get("interest_rate", 0) for l in tl) / max(len(tl), 1), 2),
            }

        total_orig = sum(l.get("amount", 0) for l in loans)
        total_interest = sum(l.get("total_interest", 0) for l in loans)
        total_fees = sum(l.get("admin_fee", 0) for l in loans)
        total_payments = sum(p.get("amount", 0) for p in payments)

        annual_data = {
            "year": now.year,
            "date_range": f"{year_start.strftime('%Y-%m-%d')} — {year_end.strftime('%Y-%m-%d')}",
            "annual_summary": {
                "total_loans_originated": len(loans),
                "total_amount_originated": total_orig,
                "total_interest_charged": total_interest,
                "total_fees_collected": total_fees,
                "total_payments_received": total_payments,
                "portfolio_outstanding": sum(l.get("balance", 0) for l in all_active),
                "active_portfolio_count": len(all_active),
                "gross_revenue": total_interest + total_fees,
                "net_collections": total_payments,
            },
            "quarterly_breakdown": quarterly,
            "monthly_breakdown": monthly,
            "by_loan_type": by_type,
        }

        pdf_buf = generate_annual_report_pdf(annual_data)
        fname = f"OCCC_Reporte_Anual_{now.year}.pdf"
        _save_pdf(pdf_buf, fname)
        generated_files.append({"filename": fname, "path": os.path.join(_static_dir(), fname), "type": "Annual", "label": f"Reporte Anual {now.year}"})
    except Exception as e:
        logging.error(f"Annual report error: {e}")
        import traceback
        traceback.print_exc()

    # 3. Generate sample contract (using first active loan)
    contract_files = []
    if include_contracts:
        try:
            sample_loan = await _db["regulated_loans"].find_one({"status": "active"})
            if sample_loan:
                from loan_pdf_service import generate_loan_contract_pdf
                from regulated_lender_router import generate_schedule_for_loan, build_pdf_loan_data
                import base64 as b64

                sample_loan["_id"] = str(sample_loan["_id"])
                schedule = generate_schedule_for_loan(sample_loan)
                pdf_loan = build_pdf_loan_data(sample_loan)

                for lang in ['es', 'en']:
                    pdf_base64 = generate_loan_contract_pdf(pdf_loan, schedule, lang=lang)
                    pdf_bytes = b64.b64decode(pdf_base64)
                    lang_label = "Español" if lang == 'es' else "English"
                    fname = f"Contrato_Modelo_{lang_label}_{sample_loan.get('loan_number', 'RLS')}.pdf"
                    _save_pdf_bytes(pdf_bytes, fname)
                    contract_files.append({"filename": fname, "path": os.path.join(_static_dir(), fname), "type": "Contract", "label": f"Contrato Modelo ({lang_label})"})
        except Exception as e:
            logging.error(f"Contract generation error: {e}")

    all_files = generated_files + contract_files

    # 4. Send all via email
    email_sent = False
    if all_files:
        file_list_html = "".join(
            f'<li style="padding: 4px 0; color: #334155;">{f["label"]} — <code>{f["filename"]}</code></li>'
            for f in all_files
        )
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: linear-gradient(135deg, #1e40af, #0f766e); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Ross Lending Solutions LLC</h1>
                <p style="color: #bfdbfe; margin: 5px 0 0; font-size: 12px;">Reportes de Cumplimiento OCCC + Contratos</p>
            </div>
            <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
                <p style="color: #334155; font-size: 14px;">Se han generado los siguientes documentos de cumplimiento regulatorio:</p>
                <ul style="font-size: 13px;">{file_list_html}</ul>
                <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;">
                    <p style="color: #92400e; font-size: 12px; margin: 0;">
                        <strong>⚠️ Para el abogado:</strong> Los contratos modelo adjuntos incluyen divulgaciones
                        Truth in Lending (TILA), tabla de amortización, y términos bajo Texas Finance Code Chapter 342-E/F.
                        Favor revisar para confirmación de cumplimiento legal.
                    </p>
                </div>
                <p style="color: #94a3b8; font-size: 10px; margin-top: 20px;">
                    Generado: {now.strftime('%d/%m/%Y %H:%M')} — Uso Interno Confidencial
                </p>
            </div>
        </div>
        """
        attachments = []
        for f in all_files:
            with open(f["path"], "rb") as fp:
                attachments.append({"filename": f["filename"], "data": fp.read()})

        email_sent = await _send_email_with_attachments(
            to_email,
            f"Reportes OCCC + Contratos — Ross Lending Solutions — {now.strftime('%d/%m/%Y')}",
            html_body,
            attachments
        )

    return {
        "success": True,
        "files_generated": len(all_files),
        "reports": [{"filename": f["filename"], "label": f["label"], "download_url": f"/api/downloads/{f['filename']}"} for f in all_files],
        "email_sent": email_sent,
        "email_to": to_email if email_sent else None,
        "message": f"{len(all_files)} documentos generados. {'Email enviado a ' + to_email if email_sent else 'Guardados en /static (email no configurado)'}"
    }


def _save_pdf_bytes(data: bytes, filename: str):
    fpath = os.path.join(_static_dir(), filename)
    with open(fpath, "wb") as f:
        f.write(data)
    return fpath
