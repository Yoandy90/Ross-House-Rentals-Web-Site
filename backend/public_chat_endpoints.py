"""
Public Chat AI Endpoints - For Website Visitors
Allows anyone to chat with Ross AI without authentication
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
ai_brain = None


class LeadInfo(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class PublicChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    lead_info: Optional[LeadInfo] = None
    language: str = "es"  # es or en


class ChatResponse(BaseModel):
    response: str
    session_id: str
    escalate_to_human: bool = False


def set_dependencies(database, brain):
    """Set database and AI brain dependencies"""
    global db, ai_brain
    db = database
    ai_brain = brain
    logger.info("✅ Public Chat AI endpoints initialized")


async def get_or_create_session(session_id: Optional[str], lead_info: Optional[LeadInfo]) -> dict:
    """Get existing session or create new one"""
    if session_id:
        session = await db.web_chat_sessions.find_one({"session_id": session_id})
        if session:
            # Update lead info if provided
            if lead_info:
                await db.web_chat_sessions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "lead_name": lead_info.name,
                        "lead_email": lead_info.email,
                        "lead_phone": lead_info.phone,
                        "updated_at": datetime.utcnow().isoformat()
                    }}
                )
            return session
    
    # Create new session
    new_session_id = str(uuid.uuid4())
    session = {
        "session_id": new_session_id,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "messages": [],
        "lead_name": lead_info.name if lead_info else None,
        "lead_email": lead_info.email if lead_info else None,
        "lead_phone": lead_info.phone if lead_info else None,
        "source": "website",
        "status": "active",
        "escalated": False
    }
    
    await db.web_chat_sessions.insert_one(session)
    
    # Also save as lead if info provided
    if lead_info and (lead_info.email or lead_info.phone):
        await save_lead(lead_info, new_session_id)
    
    return session


async def save_lead(lead_info: LeadInfo, session_id: str):
    """Save lead information to database and send notifications"""
    try:
        lead = {
            "name": lead_info.name,
            "email": lead_info.email,
            "phone": lead_info.phone,
            "source": "website_chat",
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "status": "new",
            "notes": "Lead capturado desde chat web"
        }
        
        # Check if lead already exists
        existing = None
        if lead_info.email:
            existing = await db.leads.find_one({"email": lead_info.email})
        elif lead_info.phone:
            existing = await db.leads.find_one({"phone": lead_info.phone})
        
        if existing:
            # Update existing lead
            await db.leads.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "name": lead_info.name,
                    "updated_at": datetime.utcnow().isoformat(),
                    "last_chat_session": session_id
                }}
            )
            logger.info(f"📝 Updated existing lead: {lead_info.email or lead_info.phone}")
        else:
            # Create new lead
            result = await db.leads.insert_one(lead)
            logger.info(f"🆕 New lead captured: {lead_info.name}")
            
            # Send notifications for new leads
            await send_lead_notifications(lead_info, session_id)
            
    except Exception as e:
        logger.error(f"❌ Error saving lead: {e}")


async def send_lead_notifications(lead_info: LeadInfo, session_id: str):
    """Send email and WhatsApp notifications for new leads"""
    try:
        # Get admin notification settings
        admin_email = "ross@rosstaxpreparation.com"
        admin_phone = "18069342018"
        
        # Prepare message
        message = f"""🆕 Nuevo Lead desde el Chat Web

👤 Nombre: {lead_info.name}
📧 Email: {lead_info.email or 'No proporcionado'}
📱 Teléfono: {lead_info.phone or 'No proporcionado'}
🕐 Fecha: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC

💬 Session ID: {session_id}

Este lead fue capturado desde el chat de la página web."""

        # Try to send WhatsApp notification
        try:
            import httpx
            import os
            
            whatsapp_token = os.getenv('WHATSAPP_TOKEN')
            whatsapp_phone_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
            
            if whatsapp_token and whatsapp_phone_id:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://graph.facebook.com/v18.0/{whatsapp_phone_id}/messages",
                        headers={
                            "Authorization": f"Bearer {whatsapp_token}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "messaging_product": "whatsapp",
                            "to": admin_phone,
                            "type": "text",
                            "text": {"body": message}
                        },
                        timeout=10.0
                    )
                logger.info(f"📱 WhatsApp notification sent for new lead: {lead_info.name}")
        except Exception as e:
            logger.error(f"❌ Error sending WhatsApp notification: {e}")
        
        # Try to send email notification
        try:
            import os
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            
            sendgrid_key = os.getenv('SENDGRID_API_KEY')
            
            if sendgrid_key:
                sg = SendGridAPIClient(sendgrid_key)
                email = Mail(
                    from_email='noreply@rosstaxpreparation.com',
                    to_emails=admin_email,
                    subject=f'🆕 Nuevo Lead: {lead_info.name}',
                    plain_text_content=message
                )
                sg.send(email)
                logger.info(f"📧 Email notification sent for new lead: {lead_info.name}")
        except Exception as e:
            logger.error(f"❌ Error sending email notification: {e}")
            
    except Exception as e:
        logger.error(f"❌ Error in send_lead_notifications: {e}")


async def get_session_context(session_id: str, limit: int = 10) -> List[Dict]:
    """Get recent messages from session for context"""
    session = await db.web_chat_sessions.find_one({"session_id": session_id})
    if not session:
        return []
    
    messages = session.get("messages", [])[-limit:]
    return messages


async def save_message(session_id: str, role: str, content: str):
    """Save message to session"""
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await db.web_chat_sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )


def get_system_prompt(language: str, lead_name: Optional[str]) -> str:
    """Get system prompt based on language"""
    
    name_greeting = f" {lead_name}" if lead_name else ""
    
    if language == "en":
        return f"""You are Ross, the friendly AI assistant for Ross Tax Preparation LLC.

ABOUT THE BUSINESS:
- Professional tax preparation services
- Business formation (LLC, S-Corp, C-Corp)
- IRS representation
- ITIN applications
- Bookkeeping services
- Phone: (806) 934-2018
- Address: 305 Bruce Ave, Dumas, TX 79029
- Hours: Monday-Friday 9:00 AM - 6:00 PM
- Document Email: docu@rosstaxpreparation.com

HOW TO SEND DOCUMENTS:
1. Email: Send to docu@rosstaxpreparation.com
2. Mobile App: Upload directly through our Ross Tax app
3. WhatsApp: Send photos/PDFs to this chat
4. In Person: Bring to our office at 305 Bruce Ave, Dumas, TX

YOUR ROLE:
1. Answer questions about tax services, prices, and processes
2. Help visitors understand our service packages
3. Assist with scheduling appointments (pending confirmation)
4. Capture lead information politely
5. Offer to connect with a human via WhatsApp for complex inquiries

COMMUNICATION STYLE:
- Friendly, professional, and helpful
- Keep responses concise (2-4 sentences)
- If asked about specific prices, mention they vary by situation and offer a free consultation
- Always offer to help schedule an appointment or connect via WhatsApp

IMPORTANT:
- If you don't know something specific, offer to connect them with our team
- For urgent matters, suggest calling directly or WhatsApp
- Never make up information about prices or timelines
- We do NOT have fax service
- Greet the user as{name_greeting} if their name is known"""
    else:
        return f"""Eres Ross, el asistente virtual amigable de Ross Tax Preparation LLC.

SOBRE EL NEGOCIO:
- Servicios profesionales de preparación de impuestos
- Formación de empresas (LLC, S-Corp, C-Corp)
- Representación ante el IRS
- Aplicaciones de ITIN
- Servicios de contabilidad
- Teléfono: (806) 934-2018
- Dirección: 305 Bruce Ave, Dumas, TX 79029
- Horario: Lunes-Viernes 9:00 AM - 6:00 PM
- Email para documentos: docu@rosstaxpreparation.com

CÓMO ENVIAR DOCUMENTOS:
1. Email: Enviar a docu@rosstaxpreparation.com
2. App Móvil: Subir directamente desde nuestra app Ross Tax
3. WhatsApp: Enviar fotos/PDFs a este chat
4. En Persona: Traer a nuestra oficina en 305 Bruce Ave, Dumas, TX

TU ROL:
1. Responder preguntas sobre servicios de impuestos, precios y procesos
2. Ayudar a los visitantes a entender nuestros paquetes de servicios
3. Asistir con la programación de citas (pendiente de confirmación)
4. Capturar información de contacto de manera amable
5. Ofrecer conectar con un humano vía WhatsApp para consultas complejas

ESTILO DE COMUNICACIÓN:
- Amigable, profesional y servicial
- Mantén respuestas concisas (2-4 oraciones)
- Si preguntan por precios específicos, menciona que varían según la situación y ofrece una consulta gratuita
- Siempre ofrece ayudar a agendar una cita o conectar vía WhatsApp

IMPORTANTE:
- Si no sabes algo específico, ofrece conectarlos con nuestro equipo
- Para asuntos urgentes, sugiere llamar directamente o WhatsApp
- Nunca inventes información sobre precios o tiempos
- NO tenemos servicio de fax
- Saluda al usuario como{name_greeting} si conoces su nombre"""


@router.post('/public/chat', response_model=ChatResponse)
async def public_chat(data: PublicChatMessage):
    """Public chat endpoint for website visitors"""
    
    if not ai_brain:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    
    try:
        # Get or create session
        session = await get_or_create_session(data.session_id, data.lead_info)
        session_id = session["session_id"]
        
        # Save user message
        await save_message(session_id, "user", data.message)
        
        # Get conversation context
        context = await get_session_context(session_id)
        
        # Build conversation history
        conversation_history = ""
        for msg in context[:-1]:  # Exclude current message
            role = "Usuario" if msg["role"] == "user" else "Ross"
            conversation_history += f"{role}: {msg['content']}\n"
        
        # Get system prompt
        lead_name = session.get("lead_name") or (data.lead_info.name if data.lead_info else None)
        system_prompt = get_system_prompt(data.language, lead_name)
        
        # Build full prompt
        full_prompt = f"""{system_prompt}

HISTORIAL DE CONVERSACIÓN:
{conversation_history if conversation_history else "Nueva conversación"}

MENSAJE DEL USUARIO:
{data.message}

RESPONDE DE MANERA NATURAL Y CONCISA:"""

        # Generate response using AI brain
        response = await ai_brain.chat(full_prompt)
        
        if not response:
            response = "Lo siento, no pude procesar tu mensaje. ¿Te gustaría contactarnos por WhatsApp?" if data.language == "es" else "Sorry, I couldn't process your message. Would you like to contact us via WhatsApp?"
        
        # Save AI response
        await save_message(session_id, "assistant", response)
        
        # Check if should escalate
        escalate_keywords = ["hablar con", "talk to", "humano", "human", "persona", "person", "agente", "agent", "ayuda urgente", "urgent help"]
        escalate = any(kw in data.message.lower() for kw in escalate_keywords)
        
        if escalate:
            await db.web_chat_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"escalated": True, "escalated_at": datetime.utcnow().isoformat()}}
            )
        
        return ChatResponse(
            response=response,
            session_id=session_id,
            escalate_to_human=escalate
        )
        
    except Exception as e:
        logger.error(f"❌ Error in public chat: {e}")
        raise HTTPException(status_code=500, detail="Error processing chat message")


@router.get('/public/chat/history/{session_id}')
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    session = await db.web_chat_sessions.find_one({"session_id": session_id})
    
    if not session:
        return {"messages": []}
    
    return {
        "session_id": session_id,
        "messages": session.get("messages", []),
        "lead_name": session.get("lead_name"),
        "created_at": session.get("created_at")
    }


@router.post('/public/chat/lead')
async def capture_lead(lead_info: LeadInfo, session_id: Optional[str] = None):
    """Capture lead information"""
    try:
        if session_id:
            await db.web_chat_sessions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "lead_name": lead_info.name,
                    "lead_email": lead_info.email,
                    "lead_phone": lead_info.phone,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
        
        await save_lead(lead_info, session_id or "direct")
        
        return {"success": True, "message": "Lead captured successfully"}
    except Exception as e:
        logger.error(f"❌ Error capturing lead: {e}")
        raise HTTPException(status_code=500, detail="Error capturing lead information")



# ============== ADMIN ENDPOINTS FOR LEADS ==============

@router.get('/admin/leads')
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all leads (admin only) - requires auth in production"""
    try:
        query = {}
        if status:
            query["status"] = status
        if source:
            query["source"] = source
        
        leads_cursor = db.leads.find(query).sort("created_at", -1).skip(skip).limit(limit)
        leads = await leads_cursor.to_list(length=limit)
        
        # Get total count
        total = await db.leads.count_documents(query)
        
        # Convert ObjectId to string
        for lead in leads:
            lead["_id"] = str(lead["_id"])
        
        return {
            "leads": leads,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        logger.error(f"❌ Error getting leads: {e}")
        raise HTTPException(status_code=500, detail="Error getting leads")


@router.get('/admin/leads/{lead_id}')
async def get_lead_detail(lead_id: str):
    """Get lead details with chat history"""
    try:
        from bson import ObjectId
        
        lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        lead["_id"] = str(lead["_id"])
        
        # Get chat session if exists
        chat_session = None
        if lead.get("session_id"):
            chat_session = await db.web_chat_sessions.find_one({"session_id": lead["session_id"]})
            if chat_session:
                chat_session["_id"] = str(chat_session["_id"])
        
        return {
            "lead": lead,
            "chat_session": chat_session
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting lead detail: {e}")
        raise HTTPException(status_code=500, detail="Error getting lead detail")


@router.put('/admin/leads/{lead_id}')
async def update_lead(lead_id: str, data: Dict[str, Any]):
    """Update lead status or notes"""
    try:
        from bson import ObjectId
        
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if "status" in data:
            update_data["status"] = data["status"]
        if "notes" in data:
            update_data["notes"] = data["notes"]
        if "assigned_to" in data:
            update_data["assigned_to"] = data["assigned_to"]
        
        result = await db.leads.update_one(
            {"_id": ObjectId(lead_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        return {"success": True, "message": "Lead updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating lead: {e}")
        raise HTTPException(status_code=500, detail="Error updating lead")


@router.get('/admin/leads/stats/summary')
async def get_leads_stats():
    """Get leads statistics summary"""
    try:
        # Total leads
        total = await db.leads.count_documents({})
        
        # By status
        new_count = await db.leads.count_documents({"status": "new"})
        contacted_count = await db.leads.count_documents({"status": "contacted"})
        converted_count = await db.leads.count_documents({"status": "converted"})
        
        # Today's leads
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = await db.leads.count_documents({
            "created_at": {"$gte": today_start.isoformat()}
        })
        
        # This week's leads
        week_start = today_start - timedelta(days=today_start.weekday())
        week_count = await db.leads.count_documents({
            "created_at": {"$gte": week_start.isoformat()}
        })
        
        return {
            "total": total,
            "new": new_count,
            "contacted": contacted_count,
            "converted": converted_count,
            "today": today_count,
            "this_week": week_count
        }
    except Exception as e:
        logger.error(f"❌ Error getting leads stats: {e}")
        raise HTTPException(status_code=500, detail="Error getting leads stats")


@router.get('/admin/chat-sessions')
async def get_chat_sessions(limit: int = 50, skip: int = 0):
    """Get all chat sessions"""
    try:
        sessions_cursor = db.web_chat_sessions.find({}).sort("created_at", -1).skip(skip).limit(limit)
        sessions = await sessions_cursor.to_list(length=limit)
        
        total = await db.web_chat_sessions.count_documents({})
        
        for session in sessions:
            session["_id"] = str(session["_id"])
            session["message_count"] = len(session.get("messages", []))
        
        return {
            "sessions": sessions,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        logger.error(f"❌ Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail="Error getting chat sessions")
