"""
WhatsApp Bot with AI using Emergent LLM Key
Handles intelligent responses, lead capture, appointment scheduling
"""
import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import openai
from motor.motor_asyncio import AsyncIOMotorDatabase
import os

logger = logging.getLogger(__name__)

class WhatsAppBotService:
    def __init__(self, db: AsyncIOMotorDatabase, whatsapp_service):
        self.db = db
        self.whatsapp_service = whatsapp_service
        
        # Initialize OpenAI with Emergent LLM Key
        emergent_key = os.getenv('EMERGENT_LLM_KEY')
        if emergent_key:
            openai.api_key = emergent_key
            openai.api_base = "https://api.elevenlabs.io/v1"  # Emergent proxy
            logger.info("✅ WhatsApp Bot initialized with Emergent LLM Key")
        else:
            logger.warning("⚠️ EMERGENT_LLM_KEY not configured")
        
        # Bot configuration
        self.bot_enabled = os.getenv('WHATSAPP_BOT_ENABLED', 'true').lower() == 'true'
        self.bot_name = "Asistente Ross Tax"
    
    async def process_incoming_message(
        self,
        phone_number: str,
        message: str,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process incoming WhatsApp message and generate AI response
        
        Args:
            phone_number: User's phone number
            message: Incoming message text
            user_name: User's name (if available)
        
        Returns:
            Bot response and actions to take
        """
        try:
            # Save incoming message
            await self.whatsapp_service._save_message(
                phone_number=phone_number,
                message=message,
                direction='inbound',
                status='received'
            )
            
            # Get conversation context
            conversation = await self.db.whatsapp_conversations.find_one({
                'phone_number': phone_number
            })
            
            # Check if this is a new lead
            is_new_lead = not conversation or conversation.get('is_lead', True)
            
            # Get conversation history for context
            history = await self.whatsapp_service.get_conversation_history(
                phone_number, limit=10
            )
            
            # Detect intent
            intent = await self._detect_intent(message)
            
            # Generate response based on intent
            if intent == 'appointment':
                response = await self._handle_appointment_request(
                    phone_number, message, user_name
                )
            elif intent == 'pricing':
                response = await self._handle_pricing_query(message)
            elif intent == 'status':
                response = await self._handle_status_query(phone_number)
            elif intent == 'documents':
                response = await self._handle_documents_query(phone_number)
            elif is_new_lead:
                response = await self._handle_new_lead(phone_number, user_name)
            else:
                # General AI response
                response = await self._generate_ai_response(
                    message, history, user_name
                )
            
            # Send response
            if response.get('message'):
                send_result = await self.whatsapp_service.send_message(
                    to=phone_number,
                    message=response['message']
                )
                
                response['sent'] = send_result.get('success', False)
            
            # Send buttons if provided
            if response.get('buttons'):
                await self.whatsapp_service.send_buttons(
                    to=phone_number,
                    body=response.get('buttons_text', '¿Qué te gustaría hacer?'),
                    buttons=response['buttons']
                )
            
            return response
        
        except Exception as e:
            logger.error(f"Error processing WhatsApp message: {str(e)}")
            
            # Send fallback message
            fallback = "Disculpa, tuve un problema procesando tu mensaje. Un asesor te contactará pronto. 📞"
            await self.whatsapp_service.send_message(
                to=phone_number,
                message=fallback
            )
            
            return {
                'success': False,
                'error': str(e),
                'message': fallback
            }
    
    async def _detect_intent(self, message: str) -> str:
        """Detect user intent from message"""
        message_lower = message.lower()
        
        # Keywords for different intents
        if any(word in message_lower for word in ['cita', 'agendar', 'appointment', 'reunión', 'schedule']):
            return 'appointment'
        
        if any(word in message_lower for word in ['precio', 'costo', 'cuánto', 'cost', 'price', 'cuanto']):
            return 'pricing'
        
        if any(word in message_lower for word in ['status', 'estado', 'declaración', 'return', 'tax']):
            return 'status'
        
        if any(word in message_lower for word in ['documento', 'w-2', '1099', 'subir', 'upload', 'documento']):
            return 'documents'
        
        return 'general'
    
    async def _handle_new_lead(
        self,
        phone_number: str,
        user_name: Optional[str]
    ) -> Dict[str, Any]:
        """Handle first-time contact (lead capture)"""
        
        # Update conversation as lead
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone_number},
            {
                '$set': {
                    'is_lead': True,
                    'lead_status': 'new',
                    'lead_captured_at': datetime.utcnow()
                }
            },
            upsert=True
        )
        
        name_part = f"{user_name}" if user_name else ""
        
        welcome_message = f"""¡Hola{' ' + name_part if name_part else ''}! 👋 Bienvenido a Ross Tax Preparation.

Soy tu asistente virtual y puedo ayudarte con:

1️⃣ Agendar una cita
2️⃣ Ver precios de servicios
3️⃣ Información sobre declaraciones
4️⃣ Checar el status de tu caso
5️⃣ Subir documentos

¿En qué puedo ayudarte hoy?"""
        
        return {
            'success': True,
            'message': welcome_message,
            'intent': 'welcome',
            'lead_captured': True
        }
    
    async def _handle_appointment_request(
        self,
        phone_number: str,
        message: str,
        user_name: Optional[str]
    ) -> Dict[str, Any]:
        """Handle appointment scheduling request"""
        
        # Get available slots from Google Calendar (next 7 days)
        # For now, return static slots - later integrate with Google Calendar
        
        slots_message = """📅 *Horarios Disponibles Esta Semana:*

*Lunes:*
• 10:00 AM
• 2:00 PM  
• 4:00 PM

*Martes:*
• 11:00 AM
• 3:00 PM

*Miércoles:*
• 9:00 AM
• 1:00 PM
• 5:00 PM

*Jueves:*
• 10:00 AM
• 2:00 PM

¿Qué día y hora te quedan mejor?"""
        
        return {
            'success': True,
            'message': slots_message,
            'intent': 'appointment',
            'requires_follow_up': True
        }
    
    async def _handle_pricing_query(self, message: str) -> Dict[str, Any]:
        """Handle pricing inquiries"""
        
        # Get service prices from database
        services = await self.db.service_prices.find({
            'is_active': True
        }).limit(5).to_list(5)
        
        if services:
            pricing_message = "💰 *Nuestros Servicios y Precios:*\n\n"
            
            for service in services:
                name = service.get('name_es', service.get('name', ''))
                credits = service.get('price_credits', 0)
                pricing_message += f"• {name}\n  💳 {credits} créditos\n\n"
            
            pricing_message += "\n¿Te gustaría agendar una consulta gratuita? 📞"
        else:
            pricing_message = """💰 *Nuestros Principales Servicios:*

• Declaración Simple: desde $50
• Declaración Estándar: desde $100
• Declaración Compleja: desde $200
• Consulta (30 min): desde $25

*Oferta Especial: 20% OFF en tu primera declaración* 🎁

¿Te gustaría más información sobre algún servicio?"""
        
        return {
            'success': True,
            'message': pricing_message,
            'intent': 'pricing',
            'buttons': [
                {'id': 'schedule', 'title': 'Agendar Cita'},
                {'id': 'services', 'title': 'Más Info'}
            ],
            'buttons_text': '¿Qué te gustaría hacer?'
        }
    
    async def _handle_status_query(self, phone_number: str) -> Dict[str, Any]:
        """Handle status check for existing clients"""
        
        # Find user by phone number
        user = await self.db.users.find_one({
            'phone': {'$regex': phone_number[-10:]}  # Match last 10 digits
        })
        
        if not user:
            message = """No encuentro tu información en el sistema.

¿Ya eres cliente? Si es así, por favor compárteme:
• Tu nombre completo
• Email registrado

O escribe 'nuevo' si eres cliente nuevo."""
            
            return {
                'success': True,
                'message': message,
                'intent': 'status',
                'requires_info': True
            }
        
        # Check for pending declarations or services
        # This would integrate with your existing system
        
        status_message = f"""✅ *Status de tu Caso:*

👤 Cliente: {user.get('full_name', 'N/A')}
📧 Email: {user.get('email', 'N/A')}

Aquí está el status de tus servicios activos...

Para información más detallada, ingresa a la app o contáctanos directamente."""
        
        return {
            'success': True,
            'message': status_message,
            'intent': 'status'
        }
    
    async def _handle_documents_query(self, phone_number: str) -> Dict[str, Any]:
        """Handle document upload queries"""
        
        message = """📄 *Para Subir Tus Documentos:*

Puedes subir tus documentos de 2 formas:

1️⃣ *Desde la App:*
   → Descarga nuestra app
   → Ve a "Documentos"
   → Toca "Subir Documento"

2️⃣ *Por WhatsApp:*
   → Simplemente envíame fotos o PDFs de tus documentos
   → Yo los organizaré por ti

*Documentos necesarios para tu declaración:*
• W-2 (comprobante de ingresos)
• 1099 (si aplica)
• ID oficial
• Recibos de deducciones (opcional)

¿Tienes tus documentos listos?"""
        
        return {
            'success': True,
            'message': message,
            'intent': 'documents',
            'buttons': [
                {'id': 'upload_now', 'title': 'Subir Ahora'},
                {'id': 'later', 'title': 'Más Tarde'}
            ]
        }
    
    async def _generate_ai_response(
        self,
        message: str,
        history: list,
        user_name: Optional[str]
    ) -> Dict[str, Any]:
        """Generate AI response using Emergent LLM Key (GPT-4)"""
        
        try:
            # Build context from conversation history
            context_messages = [
                {
                    "role": "system",
                    "content": f"""Eres {self.bot_name}, un asistente virtual amigable y profesional de Ross Tax Preparation.

Tu objetivo es ayudar a clientes con:
- Información sobre servicios de declaración de impuestos
- Agendar citas
- Responder preguntas frecuentes
- Capturar leads y convertirlos en clientes

Características:
- Responde en español (a menos que el cliente escriba en inglés)
- Sé breve y claro (máximo 3-4 líneas)
- Usa emojis apropiados 
- Si no sabes algo, ofrece conectar con un asesor humano
- Siempre intenta mover la conversación hacia agendar una cita

Información clave:
- Temporada de impuestos: Enero - Abril
- Servicios: Declaraciones, consultas, ITIN, representación IRS
- Precios: desde $50 (declaración simple)
- Oferta: 20% OFF primera declaración"""
                }
            ]
            
            # Add recent history
            for msg in history[-5:]:  # Last 5 messages
                role = "user" if msg['direction'] == 'inbound' else "assistant"
                context_messages.append({
                    "role": role,
                    "content": msg['message']
                })
            
            # Add current message
            context_messages.append({
                "role": "user",
                "content": message
            })
            
            # Call OpenAI (via Emergent)
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=context_messages,
                max_tokens=150,
                temperature=0.7
            )
            
            ai_message = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'message': ai_message,
                'intent': 'general',
                'ai_generated': True
            }
        
        except Exception as e:
            logger.error(f"Error generating AI response: {str(e)}")
            
            # Fallback response
            return {
                'success': True,
                'message': """Gracias por tu mensaje. Un asesor revisará tu consulta y te responderá pronto.

Mientras tanto, puedes:
• Agendar una cita escribiendo "cita"
• Ver precios escribiendo "precios"
• O llamarnos directamente

¿En qué más puedo ayudarte?""",
                'intent': 'general',
                'ai_generated': False
            }
