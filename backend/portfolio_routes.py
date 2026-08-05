"""
Ross Tax — Portfolio Routes
Endpoints to generate and email service portfolio PDFs.
"""
import base64
import logging
import os
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail, Email, To, Content, Attachment, FileContent,
    FileName, FileType, Disposition
)
from dotenv import load_dotenv

load_dotenv()

from portfolio_pdf_service import portfolio_pdf_service

logger = logging.getLogger(__name__)

portfolio_router = APIRouter()


# ═══════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════

class EmailPortfolioRequest(BaseModel):
    email: str
    client_name: Optional[str] = None
    portfolio_type: str = "personal"  # "personal", "business", or "combined"


# ═══════════════════════════════════════════════════
# PDF Generation Endpoints
# ═══════════════════════════════════════════════════

@portfolio_router.get("/portfolio/pdf/personal")
async def generate_personal_pdf():
    """Generate personal services portfolio PDF for download."""
    try:
        pdf_buffer = portfolio_pdf_service.generate_portfolio_pdf("personal")
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=Ross_Tax_Servicios_Personales.pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error generating personal PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@portfolio_router.get("/portfolio/pdf/business")
async def generate_business_pdf():
    """Generate business services portfolio PDF for download."""
    try:
        pdf_buffer = portfolio_pdf_service.generate_portfolio_pdf("business")
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=Ross_Tax_Servicios_Empresariales.pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error generating business PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@portfolio_router.get("/portfolio/pdf/combined")
async def generate_combined_pdf():
    """Generate combined (all services) portfolio PDF for download."""
    try:
        pdf_buffer = portfolio_pdf_service.generate_combined_portfolio_pdf()
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=Ross_Tax_Catalogo_Servicios.pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error generating combined PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# Email with PDF Attachment
# ═══════════════════════════════════════════════════

def _get_portfolio_email_html(client_name: str, portfolio_type: str) -> str:
    """Generate the HTML email body for the portfolio."""
    name_display = client_name or "Cliente"

    if portfolio_type == "personal":
        type_label = "Servicios Personales"
        emoji = "👤"
        color = "#1E3A5F"
    elif portfolio_type == "business":
        type_label = "Servicios Empresariales"
        emoji = "🏢"
        color = "#059669"
    else:
        type_label = "Catálogo Completo de Servicios"
        emoji = "📋"
        color = "#059669"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, {color} 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                                <div style="font-size: 50px; margin-bottom: 10px;">{emoji}</div>
                                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Ross Tax Preparation</h1>
                                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">{type_label}</p>
                            </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">
                                    Hola <strong style="color: {color};">{name_display}</strong>,
                                </p>
                                <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                                    Adjunto encontrarás nuestro <strong>{type_label}</strong> con información detallada sobre 
                                    todos los servicios que ofrecemos, incluyendo precios, lo que incluye cada servicio y 
                                    el proceso paso a paso.
                                </p>

                                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid #d1fae5;">
                                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #065f46; font-weight: 600;">
                                        📎 Archivo adjunto:
                                    </p>
                                    <p style="margin: 0; font-size: 13px; color: #047857;">
                                        <strong>Ross_Tax_{type_label.replace(' ', '_')}.pdf</strong> — Portafolio completo con precios y detalles
                                    </p>
                                </div>

                                <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">
                                    Si tienes alguna pregunta o deseas agendar una consulta gratuita, no dudes en contactarnos:
                                </p>

                                <div style="text-align: center; margin-bottom: 25px;">
                                    <a href="tel:+18069342018" 
                                       style="display: inline-block; background: {color}; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 0 8px;">
                                        📞 (806) 934-2018
                                    </a>
                                    <a href="https://wa.me/18069342018" 
                                       style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 0 8px;">
                                        💬 WhatsApp
                                    </a>
                                </div>

                                <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0;">
                                    ¡Gracias por confiar en Ross Tax!<br/>
                                    <strong style="color: {color};">— El equipo de Ross Tax Preparation</strong>
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #1E3A5F; padding: 25px 30px; text-align: center;">
                                <p style="color: rgba(255,255,255,0.9); margin: 0 0 5px 0; font-size: 14px; font-weight: 500;">
                                    Ross Tax Preparation LLC
                                </p>
                                <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px;">
                                    © 2026 Ross Tax Preparation LLC · Todos los derechos reservados
                                </p>
                                <div style="margin-top: 10px;">
                                    <a href="https://rosstaxpreparation.com" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px;">
                                        rosstaxpreparation.com
                                    </a>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


@portfolio_router.post("/portfolio/send-email")
async def send_portfolio_email(request: EmailPortfolioRequest):
    """Generate portfolio PDF and send it via email with attachment."""
    try:
        # Validate portfolio type
        valid_types = ["personal", "business", "combined"]
        if request.portfolio_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Tipo inválido. Usa: {valid_types}")

        # Generate PDF
        if request.portfolio_type == "combined":
            pdf_buffer = portfolio_pdf_service.generate_combined_portfolio_pdf()
            filename = "Ross_Tax_Catalogo_Servicios.pdf"
            subject = "📋 Catálogo Completo de Servicios — Ross Tax Preparation"
        elif request.portfolio_type == "business":
            pdf_buffer = portfolio_pdf_service.generate_portfolio_pdf("business")
            filename = "Ross_Tax_Servicios_Empresariales.pdf"
            subject = "🏢 Portafolio de Servicios Empresariales — Ross Tax Preparation"
        else:
            pdf_buffer = portfolio_pdf_service.generate_portfolio_pdf("personal")
            filename = "Ross_Tax_Servicios_Personales.pdf"
            subject = "👤 Portafolio de Servicios Personales — Ross Tax Preparation"

        # Encode PDF for SendGrid attachment
        pdf_bytes = pdf_buffer.read()
        encoded_pdf = base64.b64encode(pdf_bytes).decode('utf-8')

        # Build email
        sendgrid_key = os.getenv("SENDGRID_API_KEY")
        from_email_addr = os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")

        if not sendgrid_key:
            raise HTTPException(status_code=500, detail="SendGrid API key no configurada")

        html_content = _get_portfolio_email_html(
            request.client_name or "",
            request.portfolio_type
        )

        message = Mail(
            from_email=Email(from_email_addr, "Ross Tax Preparation"),
            to_emails=To(request.email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )

        # Add PDF attachment
        attachment = Attachment()
        attachment.file_content = FileContent(encoded_pdf)
        attachment.file_name = FileName(filename)
        attachment.file_type = FileType("application/pdf")
        attachment.disposition = Disposition("attachment")
        message.attachment = attachment

        # Send
        sg = SendGridAPIClient(sendgrid_key)
        response = sg.send(message)

        logger.info(f"✅ Portfolio email sent to {request.email} (type={request.portfolio_type}), status: {response.status_code}")

        return {
            "success": True,
            "message": f"Portafolio enviado exitosamente a {request.email}",
            "status_code": response.status_code,
            "portfolio_type": request.portfolio_type,
            "filename": filename
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending portfolio email: {e}")
        raise HTTPException(status_code=500, detail=f"Error al enviar email: {str(e)}")
