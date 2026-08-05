"""
Legal Documents Management API
Stores and retrieves legal documents, contracts, and business plans.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
import os

router = APIRouter(prefix="/api/admin/legales", tags=["legal"])

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "taxportal")]


class DocumentCreate(BaseModel):
    title: str
    title_en: Optional[str] = ""
    category: str  # business_plan, contract, disclosure, authorization
    content_es: str
    content_en: str
    version: Optional[str] = "1.0"
    status: Optional[str] = "active"


@router.get("/documents")
async def list_documents(category: Optional[str] = None):
    """List all legal documents, optionally filtered by category."""
    query = {}
    if category:
        query["category"] = category
    docs = await db.legal_documents.find(query).sort("created_at", -1).to_list(100)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single legal document by ID."""
    doc = await db.legal_documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/documents")
async def create_document(doc: DocumentCreate):
    """Create or update a legal document."""
    existing = await db.legal_documents.find_one({"title": doc.title})
    data = {
        "title": doc.title,
        "title_en": doc.title_en,
        "category": doc.category,
        "content_es": doc.content_es,
        "content_en": doc.content_en,
        "version": doc.version,
        "status": doc.status,
        "updated_at": datetime.now(timezone.utc),
    }
    if existing:
        await db.legal_documents.update_one({"_id": existing["_id"]}, {"$set": data})
        return {"success": True, "id": str(existing["_id"]), "action": "updated"}
    else:
        data["created_at"] = datetime.now(timezone.utc)
        result = await db.legal_documents.insert_one(data)
        return {"success": True, "id": str(result.inserted_id), "action": "created"}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a legal document."""
    result = await db.legal_documents.delete_one({"_id": ObjectId(doc_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}


def _build_pdf_html(documents: list, lang: str = "es") -> str:
    """Build a full HTML page for PDF generation."""
    date_str = datetime.now().strftime('%d/%m/%Y')
    is_es = lang == "es"
    title = "Documentos Legales y Plan de Negocio" if is_es else "Legal Documents & Business Plan"

    sections = []
    for i, doc in enumerate(documents):
        doc_title = doc.get('title', '') if is_es else doc.get('title_en', doc.get('title', ''))
        content = doc.get('content_es', '') if is_es else doc.get('content_en', '')
        page_break = 'page-break-before: always;' if i > 0 else ''
        sections.append(f"""
        <div style="{page_break} margin-bottom: 30px;">
            <h2 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 8px; font-size: 18px;">{doc_title}</h2>
            <div style="font-size: 11px; line-height: 1.7; color: #1e293b;">
                {content}
            </div>
        </div>
        """)

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {{
            size: letter;
            margin: 1in 0.75in;
            @top-center {{
                content: "Ross Lending Solutions LLC — CONFIDENCIAL";
                font-size: 8px;
                color: #94a3b8;
            }}
            @bottom-center {{
                content: "Página " counter(page) " de " counter(pages);
                font-size: 8px;
                color: #94a3b8;
            }}
        }}
        body {{
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #1e293b;
            font-size: 11px;
            line-height: 1.6;
        }}
        h1 {{ font-size: 22px; color: #059669; text-align: center; margin-bottom: 5px; }}
        h2 {{ font-size: 16px; color: #059669; }}
        h3 {{ font-size: 13px; color: #334155; }}
        table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 10px; text-align: left; }}
        th {{ background: #f1f5f9; font-weight: 600; color: #334155; }}
        ul, ol {{ margin: 8px 0; padding-left: 20px; }}
        li {{ margin-bottom: 4px; }}
        .cover-header {{
            background: #059669;
            color: white;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        .cover-header h1 {{ color: white; font-size: 26px; margin: 0; letter-spacing: 1px; }}
        .cover-header p {{ color: #a7f3d0; margin: 6px 0 0; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="cover-header">
        <h1>ROSS LENDING SOLUTIONS LLC</h1>
        <p>{title}</p>
        <p style="font-size: 11px; color: #6ee7b7;">{date_str}</p>
        <p style="font-size: 10px; color: #bbf7d0; margin-top: 10px;">
            305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018<br>
            Texas OCCC Regulated Lender License | Chapter 342 Texas Finance Code
        </p>
    </div>

    {''.join(sections)}

    <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 9px; color: #94a3b8;">
            Ross Lending Solutions LLC — {'CONFIDENCIAL: Solo para uso interno' if is_es else 'CONFIDENTIAL: For internal use only'}<br>
            305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018
        </p>
    </div>
</body>
</html>"""


@router.post("/send-email")
async def send_documents_email(request: Request):
    """Send legal documents as PDF attachments via email."""
    import smtplib
    import io
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    body = await request.json()
    to_email = body.get("email", "yoandyross@gmail.com")
    doc_ids = body.get("document_ids", [])
    category = body.get("category", None)  # Filter by category: business_plan, contract, disclosure, authorization

    # Get documents
    documents = []
    if doc_ids:
        for did in doc_ids:
            doc = await db.legal_documents.find_one({"_id": ObjectId(did)})
            if doc:
                documents.append(doc)
    else:
        query = {"status": "active"}
        if category:
            query["category"] = category
        documents = await db.legal_documents.find(query).to_list(50)

    if not documents:
        raise HTTPException(status_code=404, detail="No documents found")

    # Generate PDFs using WeasyPrint
    try:
        from weasyprint import HTML as WeasyHTML
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint not installed - cannot generate PDFs")

    date_tag = datetime.now().strftime('%Y%m%d')

    # Dynamic file naming based on category
    category_names = {
        'business_plan': {'es': 'Plan_de_Negocio', 'en': 'Business_Plan', 'subject_es': 'Plan de Negocio'},
        'contract': {'es': 'Contratos', 'en': 'Contracts', 'subject_es': 'Contratos Legales'},
        'disclosure': {'es': 'Divulgaciones', 'en': 'Disclosures', 'subject_es': 'Divulgaciones TILA'},
        'authorization': {'es': 'Autorizaciones', 'en': 'Authorizations', 'subject_es': 'Autorizaciones'},
    }
    if category and category in category_names:
        name_es = category_names[category]['es']
        name_en = category_names[category]['en']
        subject_label = category_names[category]['subject_es']
    else:
        name_es = 'Documentos_Legales'
        name_en = 'Legal_Documents'
        subject_label = 'Documentos Legales'

    filename_es = f'RLS_{name_es}_ES_{date_tag}.pdf'
    filename_en = f'RLS_{name_en}_EN_{date_tag}.pdf'

    # Generate Spanish PDF
    html_es = _build_pdf_html(documents, lang="es")
    pdf_es = WeasyHTML(string=html_es).write_pdf()

    # Generate English PDF
    html_en = _build_pdf_html(documents, lang="en")
    pdf_en = WeasyHTML(string=html_en).write_pdf()

    # Build list of document titles for email
    doc_titles = [d.get('title', '') for d in documents]
    doc_list_html = ''.join([f'<li>{t}</li>' for t in doc_titles])

    # Build email with PDF attachments
    html_email_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">ROSS LENDING SOLUTIONS LLC</h1>
            <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 12px;">{subject_label}</p>
        </div>
        <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 14px;">Hola,</p>
            <p style="color: #475569; font-size: 13px; line-height: 1.6;">
                Adjunto encontrarás <strong>{len(documents)} documento(s)</strong> de Ross Lending Solutions LLC en formato PDF:
            </p>
            <ul style="color: #475569; font-size: 13px; line-height: 1.8;">
                <li>📄 <strong>{filename_es}</strong> — Versión en Español</li>
                <li>📄 <strong>{filename_en}</strong> — English Version</li>
            </ul>
            <p style="color: #64748b; font-size: 12px; margin-top: 10px;"><strong>Contenido:</strong></p>
            <ul style="color: #64748b; font-size: 12px; line-height: 1.6;">{doc_list_html}</ul>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-top: 15px;">
                <p style="margin: 0; color: #059669; font-size: 12px; font-weight: 600;">
                    ✅ Documentos conformes a Texas Finance Code Cap. 342 y regulaciones OCCC.
                </p>
            </div>
        </div>
        <div style="background: #1e293b; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 10px; margin: 0;">
                Ross Lending Solutions LLC | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018<br>
                CONFIDENCIAL — Solo para uso interno
            </p>
        </div>
    </div>
    """

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
            raise Exception("SMTP not configured")

        msg = MIMEMultipart('mixed')
        msg['From'] = f"{from_name} <{from_addr}>"
        msg['To'] = to_email
        msg['Subject'] = f"Ross Lending Solutions — {subject_label} (PDF) — {datetime.now().strftime('%d/%m/%Y')}"

        # Email body (HTML)
        msg.attach(MIMEText(html_email_body, 'html', 'utf-8'))

        # Attach Spanish PDF
        pdf_es_part = MIMEBase('application', 'pdf')
        pdf_es_part.set_payload(pdf_es)
        encoders.encode_base64(pdf_es_part)
        pdf_es_part.add_header('Content-Disposition', 'attachment', filename=filename_es)
        msg.attach(pdf_es_part)

        # Attach English PDF
        pdf_en_part = MIMEBase('application', 'pdf')
        pdf_en_part.set_payload(pdf_en)
        encoders.encode_base64(pdf_en_part)
        pdf_en_part.add_header('Content-Disposition', 'attachment', filename=filename_en)
        msg.attach(pdf_en_part)

        if encryption == 'SSL':
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls()

        server.login(username, password)
        server.sendmail(from_addr, to_email, msg.as_string())
        server.quit()

        return {
            "success": True,
            "message": f"Email con PDFs enviado a {to_email}",
            "documents_count": len(documents),
            "attachments": [filename_es, filename_en]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e), "documents_count": len(documents)}


@router.post("/send-pitch-deck")
async def send_pitch_deck_email(request: Request):
    """Generate and email professional pitch deck presentations (ES + EN)."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    body = await request.json()
    to_email = body.get("email", "yoandyross@gmail.com")

    # Generate presentations
    try:
        from generate_pitch_deck import build_presentation
        import io

        date_tag = datetime.now().strftime('%Y%m%d')
        filename_es = f'RLS_Pitch_Deck_ES_{date_tag}.pptx'
        filename_en = f'RLS_Pitch_Deck_EN_{date_tag}.pptx'

        prs_es = build_presentation('es')
        buf_es = io.BytesIO()
        prs_es.save(buf_es)
        buf_es.seek(0)

        prs_en = build_presentation('en')
        buf_en = io.BytesIO()
        prs_en.save(buf_en)
        buf_en.seek(0)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating presentations: {str(e)}")

    # Build email
    html_email_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">ROSS LENDING SOLUTIONS LLC</h1>
            <p style="color: #a7f3d0; margin: 8px 0 0; font-size: 14px;">📊 Pitch Deck — Presentación para Inversionistas</p>
        </div>
        <div style="background: #f8fafc; padding: 25px; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 14px;">Hola,</p>
            <p style="color: #475569; font-size: 13px; line-height: 1.7;">
                Adjunto encontrarás la <strong>presentación profesional de Ross Lending Solutions LLC</strong> 
                en formato PowerPoint (.pptx), lista para presentar al banco y a inversionistas:
            </p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 15px 0;">
                <p style="color: #059669; font-size: 14px; font-weight: 700; margin: 0 0 10px;">📎 Archivos adjuntos:</p>
                <p style="color: #475569; font-size: 13px; margin: 4px 0;">📊 <strong>{filename_es}</strong> — Versión en Español</p>
                <p style="color: #475569; font-size: 13px; margin: 4px 0;">📊 <strong>{filename_en}</strong> — English Version</p>
            </div>
            <p style="color: #64748b; font-size: 12px;"><strong>Contenido de la presentación (9 diapositivas):</strong></p>
            <ol style="color: #64748b; font-size: 12px; line-height: 1.8; padding-left: 20px;">
                <li>Portada corporativa</li>
                <li>Resumen ejecutivo (empresa, mercado, inversión)</li>
                <li>Marco regulatorio OCCC</li>
                <li>Productos de préstamo (Sub F y Sub E)</li>
                <li>Estrategia de capital ($27K y $80K)</li>
                <li>Modelo de inversionistas y exenciones SEC</li>
                <li>Proyección financiera 12 meses</li>
                <li>Plan de acción 90 días</li>
                <li>Cierre y contacto</li>
            </ol>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-top: 10px;">
                <p style="margin: 0; color: #059669; font-size: 12px; font-weight: 600;">
                    💡 Tip: Puedes editar la presentación en PowerPoint, Google Slides o Keynote antes de presentarla.
                </p>
            </div>
        </div>
        <div style="background: #1e293b; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 10px; margin: 0;">
                Ross Lending Solutions LLC | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018<br>
                CONFIDENCIAL — Solo para uso interno
            </p>
        </div>
    </div>
    """

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
            raise Exception("SMTP not configured")

        msg = MIMEMultipart('mixed')
        msg['From'] = f"{from_name} <{from_addr}>"
        msg['To'] = to_email
        msg['Subject'] = f"Ross Lending Solutions — Pitch Deck Presentación — {datetime.now().strftime('%d/%m/%Y')}"

        msg.attach(MIMEText(html_email_body, 'html', 'utf-8'))

        # Attach Spanish PPTX
        pptx_es_part = MIMEBase('application', 'vnd.openxmlformats-officedocument.presentationml.presentation')
        pptx_es_part.set_payload(buf_es.read())
        encoders.encode_base64(pptx_es_part)
        pptx_es_part.add_header('Content-Disposition', 'attachment', filename=filename_es)
        msg.attach(pptx_es_part)

        # Attach English PPTX
        pptx_en_part = MIMEBase('application', 'vnd.openxmlformats-officedocument.presentationml.presentation')
        pptx_en_part.set_payload(buf_en.read())
        encoders.encode_base64(pptx_en_part)
        pptx_en_part.add_header('Content-Disposition', 'attachment', filename=filename_en)
        msg.attach(pptx_en_part)

        if encryption == 'SSL':
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.starttls()

        server.login(username, password)
        server.sendmail(from_addr, to_email, msg.as_string())
        server.quit()

        return {
            "success": True,
            "message": f"Pitch deck enviado a {to_email}",
            "slides": 9,
            "attachments": [filename_es, filename_en]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
