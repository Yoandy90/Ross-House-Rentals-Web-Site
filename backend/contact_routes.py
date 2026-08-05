"""
Contact Form Routes
- Public: Submit contact messages
- Admin: View, respond (with AI suggestions), manage messages
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

load_dotenv()

contact_router = APIRouter(prefix="/api", tags=["Contact"])

_db = None

def init_contact_routes(database):
    global _db
    _db = database

# ──────── Models ────────

class ContactFormInput(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    subject: Optional[str] = ""
    message: str
    language: Optional[str] = "es"

class AdminResponseInput(BaseModel):
    response_text: str

# ──────── Public Endpoint ────────

@contact_router.post('/public/contact')
async def submit_contact_form(data: ContactFormInput):
    """Public endpoint - receives contact form submissions"""
    try:
        now = datetime.utcnow()
        
        contact_doc = {
            'name': data.name.strip(),
            'email': data.email.strip().lower(),
            'phone': data.phone.strip() if data.phone else '',
            'subject': data.subject.strip() if data.subject else 'Consulta General',
            'message': data.message.strip(),
            'language': data.language or 'es',
            'status': 'new',  # new, read, responded, archived
            'ai_suggestion': '',
            'admin_response': '',
            'responded_at': None,
            'created_at': now,
            'updated_at': now,
        }
        
        result = await _db.contact_messages.insert_one(contact_doc)
        contact_doc['_id'] = result.inserted_id
        
        # Send emails in background (don't block response)
        import asyncio
        asyncio.create_task(_send_notification_emails(contact_doc, data.language or 'es'))
        
        # Generate AI suggestion in background
        asyncio.create_task(_generate_ai_suggestion(str(result.inserted_id), data))
        
        return {
            'success': True,
            'message': 'Mensaje recibido exitosamente' if data.language == 'es' else 'Message received successfully'
        }
    except Exception as e:
        logging.error(f"Error submitting contact form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────── Admin Endpoints ────────

@contact_router.get('/admin/contact-messages')
async def list_contact_messages(status: Optional[str] = None, limit: int = 50, skip: int = 0):
    """List all contact messages for admin"""
    try:
        query = {}
        if status:
            query['status'] = status
        
        messages = await _db.contact_messages.find(query)\
            .sort('created_at', -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(limit)
        
        total = await _db.contact_messages.count_documents(query)
        new_count = await _db.contact_messages.count_documents({'status': 'new'})
        
        for m in messages:
            m['_id'] = str(m['_id'])
            if m.get('created_at'):
                m['created_at'] = m['created_at'].isoformat()
            if m.get('updated_at'):
                m['updated_at'] = m['updated_at'].isoformat()
            if m.get('responded_at'):
                m['responded_at'] = m['responded_at'].isoformat()
        
        return {'messages': messages, 'total': total, 'new_count': new_count}
    except Exception as e:
        logging.error(f"Error listing contact messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@contact_router.put('/admin/contact-messages/{message_id}/read')
async def mark_message_read(message_id: str):
    """Mark a message as read"""
    try:
        result = await _db.contact_messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'status': 'read', 'updated_at': datetime.utcnow()}}
        )
        return {'success': result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@contact_router.put('/admin/contact-messages/{message_id}/respond')
async def respond_to_message(message_id: str, data: AdminResponseInput):
    """Admin responds to a contact message — sends email to client"""
    try:
        msg = await _db.contact_messages.find_one({'_id': ObjectId(message_id)})
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")
        
        now = datetime.utcnow()
        await _db.contact_messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {
                'admin_response': data.response_text,
                'status': 'responded',
                'responded_at': now,
                'updated_at': now
            }}
        )
        
        # Send response email to client
        import asyncio
        asyncio.create_task(_send_response_email(msg, data.response_text))
        
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@contact_router.put('/admin/contact-messages/{message_id}/archive')
async def archive_message(message_id: str):
    """Archive a message"""
    try:
        result = await _db.contact_messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'status': 'archived', 'updated_at': datetime.utcnow()}}
        )
        return {'success': result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@contact_router.delete('/admin/contact-messages/{message_id}')
async def delete_message(message_id: str):
    """Delete a contact message"""
    try:
        result = await _db.contact_messages.delete_one({'_id': ObjectId(message_id)})
        return {'success': result.deleted_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@contact_router.get('/admin/contact-messages/{message_id}/ai-suggest')
async def get_ai_suggestion(message_id: str):
    """Get/regenerate AI suggestion for a message"""
    try:
        msg = await _db.contact_messages.find_one({'_id': ObjectId(message_id)})
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")
        
        suggestion = await _generate_ai_response(msg)
        
        await _db.contact_messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'ai_suggestion': suggestion, 'updated_at': datetime.utcnow()}}
        )
        
        return {'suggestion': suggestion}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────── AI Response Generation ────────

async def _generate_ai_response(msg: dict) -> str:
    """Use AI to suggest a response to a contact message"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
        if not EMERGENT_KEY:
            return _default_suggestion(msg)
        
        system_prompt = """Eres el asistente virtual de Ross Tax Preparation, una empresa de preparación de impuestos en Dumas, TX.
        
Genera una respuesta profesional, amigable y útil al mensaje del cliente. La respuesta debe:
- Ser en el mismo idioma que escribió el cliente (español o inglés)
- Ser cálida y profesional
- Responder específicamente a su consulta
- Incluir información relevante de la empresa si aplica:
  * Preparación de impuestos personales: $180
  * Horario: Lunes a Viernes, 10 AM - 2:30 PM
  * Dirección: 305 Bruce Ave, Dumas, TX 79029
  * Teléfono: (806) 934-2018
  * WhatsApp: (806) 934-2018
- Invitar al cliente a agendar una cita si es apropiado
- Máximo 3-4 párrafos cortos
- Firmar como "Equipo de Ross Tax Preparation"
"""
        
        user_content = f"""Cliente: {msg.get('name', '')}
Email: {msg.get('email', '')}
Teléfono: {msg.get('phone', 'No proporcionado')}
Asunto: {msg.get('subject', '')}
Mensaje: {msg.get('message', '')}

Genera una respuesta profesional y personalizada."""
        
        session_id = str(uuid.uuid4())
        llm = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=session_id,
            system_message=system_prompt
        )
        llm = llm.with_model("openai", "gpt-4o")
        
        response = await llm.send_message(UserMessage(text=user_content))
        
        return response if response else _default_suggestion(msg)
    except Exception as e:
        logging.error(f"AI suggestion error: {e}")
        return _default_suggestion(msg)


def _default_suggestion(msg: dict) -> str:
    """Fallback suggestion if AI is unavailable"""
    lang = msg.get('language', 'es')
    name = msg.get('name', 'Cliente')
    if lang == 'en':
        return f"Dear {name},\n\nThank you for reaching out to Ross Tax Preparation. We have reviewed your message and would be happy to assist you.\n\nPlease feel free to call us at (806) 934-2018 or schedule an appointment at your convenience.\n\nBest regards,\nRoss Tax Preparation Team"
    return f"Estimado/a {name},\n\nGracias por contactar a Ross Tax Preparation. Hemos revisado su mensaje y con gusto le asistiremos.\n\nPuede llamarnos al (806) 934-2018 o agendar una cita a su conveniencia.\n\nSaludos cordiales,\nEquipo de Ross Tax Preparation"


async def _generate_ai_suggestion(message_id: str, data: ContactFormInput):
    """Background task to generate AI suggestion"""
    try:
        msg = {
            'name': data.name,
            'email': data.email,
            'phone': data.phone,
            'subject': data.subject,
            'message': data.message,
            'language': data.language,
        }
        suggestion = await _generate_ai_response(msg)
        await _db.contact_messages.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'ai_suggestion': suggestion}}
        )
    except Exception as e:
        logging.error(f"Error generating AI suggestion: {e}")


# ──────── Email Functions ────────

async def _send_notification_emails(contact_doc: dict, language: str = 'es'):
    """Send notification to admin + auto-reply to client"""
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content
        
        SG_KEY = os.getenv("SENDGRID_API_KEY", "")
        if not SG_KEY:
            logging.warning("No SendGrid API key, skipping emails")
            return
        
        sg = sendgrid.SendGridAPIClient(api_key=SG_KEY)
        
        name = contact_doc.get('name', '')
        email = contact_doc.get('email', '')
        phone = contact_doc.get('phone', 'No proporcionado')
        subject = contact_doc.get('subject', '')
        message = contact_doc.get('message', '')
        year = datetime.now().year
        
        # 1. ADMIN NOTIFICATION — Professional dark design
        admin_html = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
            <!-- Header -->
            <div style="background:#1a1a2e;padding:32px 30px 28px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">ROSS TAX PREPARATION</h1>
                <div style="width:50px;height:3px;background:#dc2626;margin:12px auto 0;border-radius:2px;"></div>
            </div>
            <!-- Red accent bar -->
            <div style="background:#dc2626;padding:14px 30px;text-align:center;">
                <p style="color:#ffffff;margin:0;font-size:14px;font-weight:600;letter-spacing:1px;">NUEVO MENSAJE DE CONTACTO</p>
            </div>
            <!-- Body -->
            <div style="padding:30px;background:#ffffff;">
                <!-- Client info cards -->
                <div style="background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
                    <table style="width:100%;border-collapse:collapse;">
                        <tr>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;width:110px;">
                                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Nombre</span>
                            </td>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                <span style="color:#1e293b;font-size:15px;font-weight:700;">{name}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Email</span>
                            </td>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                <a href="mailto:{email}" style="color:#dc2626;font-size:15px;text-decoration:none;font-weight:500;">{email}</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Teléfono</span>
                            </td>
                            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                <a href="tel:{phone}" style="color:#1e293b;font-size:15px;text-decoration:none;">{phone}</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px 0;">
                                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Asunto</span>
                            </td>
                            <td style="padding:10px 0;">
                                <span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">{subject}</span>
                            </td>
                        </tr>
                    </table>
                </div>
                <!-- Message -->
                <div style="margin-top:20px;background:#fffbeb;border-radius:12px;padding:20px;border-left:4px solid #f59e0b;">
                    <p style="color:#92400e;margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Mensaje del Cliente</p>
                    <p style="color:#1e293b;margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap;">{message}</p>
                </div>
                <!-- CTA Button -->
                <div style="margin-top:24px;text-align:center;">
                    <a href="https://www.rosstaxpreparation.com/admin/mensajes-contacto" style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;">Ver en Admin Panel</a>
                </div>
            </div>
            <!-- Footer -->
            <div style="background:#f1f5f9;padding:20px 30px;text-align:center;border-top:1px solid #e2e8f0;">
                <p style="color:#94a3b8;margin:0;font-size:12px;">Este mensaje fue enviado desde el formulario de contacto de rosstaxpreparation.com</p>
            </div>
        </div>"""
        
        admin_msg = Mail(
            from_email=Email("info@rosstaxpreparation.com", "Ross Tax Preparation"),
            to_emails=To("yoandyross@gmail.com"),
            subject=f"Nuevo mensaje: {subject or 'Consulta'} — {name}",
            html_content=Content("text/html", admin_html)
        )
        sg.client.mail.send.post(request_body=admin_msg.get())
        logging.info(f"Admin notification sent for contact from {name}")
        
        # 2. AUTO-REPLY TO CLIENT — Warm professional design
        if language == 'en':
            client_subject = "We received your message — Ross Tax Preparation"
            greeting = f"Hello {name},"
            thanks = "Thank you for reaching out to Ross Tax Preparation! We've received your message and our team will get back to you shortly."
            msg_label = "YOUR MESSAGE"
            meanwhile = "While you wait, feel free to reach us directly:"
            call_label = "Call us"
            whatsapp_label = "WhatsApp"
            visit_label = "Visit us"
            schedule_text = "Schedule a Free Appointment"
            footer_text = f"&copy; {year} Ross Tax Preparation LLC — Dumas, TX<br>Professional Tax Services"
        else:
            client_subject = "Recibimos tu mensaje — Ross Tax Preparation"
            greeting = f"Hola {name},"
            thanks = "¡Gracias por contactar a Ross Tax Preparation! Hemos recibido tu mensaje y nuestro equipo te responderá a la brevedad."
            msg_label = "TU MENSAJE"
            meanwhile = "Mientras tanto, puedes contactarnos directamente:"
            call_label = "Llámanos"
            whatsapp_label = "WhatsApp"
            visit_label = "Visítanos"
            schedule_text = "Agendar Cita Gratis"
            footer_text = f"&copy; {year} Ross Tax Preparation LLC — Dumas, TX<br>Servicios Profesionales de Impuestos"

        client_html = f"""
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
            <!-- Header -->
            <div style="background:#1a1a2e;padding:36px 30px 32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:0.5px;">ROSS TAX PREPARATION</h1>
                <div style="width:50px;height:3px;background:#dc2626;margin:14px auto 0;border-radius:2px;"></div>
                <p style="color:#94a3b8;margin:10px 0 0;font-size:13px;letter-spacing:0.5px;">305 Bruce Ave, Dumas, TX 79029</p>
            </div>
            <!-- Green confirmation bar -->
            <div style="background:#059669;padding:12px 30px;text-align:center;">
                <p style="color:#ffffff;margin:0;font-size:13px;font-weight:600;">✓ {'Message received successfully' if language == 'en' else 'Mensaje recibido exitosamente'}</p>
            </div>
            <!-- Body -->
            <div style="padding:32px 30px;">
                <p style="font-size:18px;color:#1e293b;margin:0 0 6px;font-weight:700;">{greeting}</p>
                <p style="font-size:15px;color:#475569;line-height:1.7;margin:12px 0 0;">{thanks}</p>
                
                <!-- Message quote -->
                <div style="margin:24px 0;background:#f8fafc;border-radius:12px;padding:20px;border-left:4px solid #dc2626;">
                    <p style="color:#dc2626;margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">{msg_label}</p>
                    <p style="color:#334155;margin:0;font-size:14px;line-height:1.6;font-style:italic;">"{message[:300]}{'...' if len(message) > 300 else ''}"</p>
                </div>
                
                <!-- Contact info -->
                <p style="font-size:15px;color:#475569;margin:24px 0 16px;">{meanwhile}</p>
                
                <div style="background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
                    <table style="width:100%;border-collapse:collapse;">
                        <tr>
                            <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                                <span style="color:#64748b;font-size:12px;font-weight:600;">{call_label}</span><br>
                                <a href="tel:+18069342018" style="color:#1e293b;font-size:16px;text-decoration:none;font-weight:700;">(806) 934-2018</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                                <span style="color:#64748b;font-size:12px;font-weight:600;">{whatsapp_label}</span><br>
                                <a href="https://wa.me/18069342018" style="color:#059669;font-size:16px;text-decoration:none;font-weight:700;">(806) 934-2018</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:14px 20px;">
                                <span style="color:#64748b;font-size:12px;font-weight:600;">{visit_label}</span><br>
                                <a href="https://maps.google.com/?q=305+Bruce+Ave+Dumas+TX+79029" style="color:#1e293b;font-size:15px;text-decoration:none;">305 Bruce Ave, Dumas, TX 79029</a>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- CTA -->
                <div style="margin-top:28px;text-align:center;">
                    <a href="https://www.rosstaxpreparation.com/#appointments" style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.3px;">{schedule_text}</a>
                </div>
            </div>
            <!-- Footer -->
            <div style="background:#1a1a2e;padding:24px 30px;text-align:center;">
                <p style="color:#ffffff;margin:0 0 4px;font-size:14px;font-weight:700;">ROSS TAX PREPARATION</p>
                <div style="width:30px;height:2px;background:#dc2626;margin:8px auto;border-radius:2px;"></div>
                <p style="color:#64748b;margin:8px 0 0;font-size:11px;line-height:1.5;">{footer_text}</p>
            </div>
        </div>"""
        
        client_msg = Mail(
            from_email=Email("info@rosstaxpreparation.com", "Ross Tax Preparation"),
            to_emails=To(email),
            subject=client_subject,
            html_content=Content("text/html", client_html)
        )
        sg.client.mail.send.post(request_body=client_msg.get())
        logging.info(f"Auto-reply sent to {email}")
        
    except Exception as e:
        logging.error(f"Error sending contact emails: {e}")


async def _send_response_email(msg: dict, response_text: str):
    """Send admin's response to the client via email"""
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content
        
        SG_KEY = os.getenv("SENDGRID_API_KEY", "")
        if not SG_KEY:
            return
        
        sg = sendgrid.SendGridAPIClient(api_key=SG_KEY)
        
        name = msg.get('name', '')
        email = msg.get('email', '')
        lang = msg.get('language', 'es')
        
        subject_line = f"Respuesta a tu consulta — Ross Tax Preparation" if lang == 'es' else f"Response to your inquiry — Ross Tax Preparation"
        
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:24px;text-align:center;border-radius:12px 12px 0 0;">
                <h1 style="color:white;margin:0;font-size:24px;">Ross Tax Preparation</h1>
            </div>
            <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:0;">
                <p style="font-size:16px;">{'Hola' if lang == 'es' else 'Hello'} <strong>{name}</strong>,</p>
                <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;white-space:pre-wrap;">
                    {response_text}
                </div>
                <p style="color:#6b7280;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
                    Ross Tax Preparation — (806) 934-2018 — 305 Bruce Ave, Dumas, TX 79029
                </p>
            </div>
        </div>"""
        
        message = Mail(
            from_email=Email("info@rosstaxpreparation.com", "Ross Tax Preparation"),
            to_emails=To(email),
            subject=subject_line,
            html_content=Content("text/html", html)
        )
        sg.client.mail.send.post(request_body=message.get())
        logging.info(f"Response email sent to {email}")
    except Exception as e:
        logging.error(f"Error sending response email: {e}")
