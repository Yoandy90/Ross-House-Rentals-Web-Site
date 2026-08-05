"""
WhatsApp Bot Service V2 - Enhanced with Lead Capture, FAQ, Appointments & Services
Handles intelligent conversations, client recognition, and automated flows
"""
import logging
import json
import re
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import os
import secrets
import string

logger = logging.getLogger(__name__)

# App Links
IOS_APP_LINK = "https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX"
ANDROID_APP_LINK = "https://play.google.com/store/apps/details?id=com.rosstax.app"  # Update when available

# FAQ Database
FAQ_DATABASE = {
    'horario': {
        'keywords': ['horario', 'hora', 'abierto', 'abren', 'cierran', 'atienden', 'hours', 'open'],
        'answer': '''🕐 *Nuestro Horario:*

Lunes a Viernes: 9:00 AM - 6:00 PM
Sábados: 10:00 AM - 2:00 PM
Domingos: Cerrado

📍 Dirección: Lubbock, TX
📞 Teléfono: (806) 922-2318'''
    },
    'documentos': {
        'keywords': ['documento', 'documentos', 'necesito', 'traer', 'w2', 'w-2', '1099', 'papeles'],
        'answer': '''📄 *Documentos Necesarios:*

✅ Obligatorios:
• W-2 de todos tus empleos
• Identificación oficial con foto
• Tarjeta de Seguro Social
• Números de SS de dependientes

📋 Si aplica:
• Formularios 1099
• Gastos de negocio
• Recibos de deducciones
• Formulario 1095-A (Seguro de salud)

¿Tienes tus documentos listos? Puedes enviarlos por aquí o subirlos en la app.'''
    },
    'precios': {
        'keywords': ['precio', 'precios', 'costo', 'cuanto', 'cuánto', 'cobran', 'tarifa', 'cost', 'price'],
        'answer': 'DYNAMIC_PRICES'  # Prices are fetched dynamically from database
    },
    'reembolso': {
        'keywords': ['reembolso', 'refund', 'dinero', 'devuelven', 'cuanto me dan', 'cuánto me dan'],
        'answer': '''💵 *Sobre tu Reembolso:*

El monto de tu reembolso depende de:
• Tus ingresos totales del año
• Estado civil (soltero, casado, etc.)
• Número de dependientes
• Créditos que califiques

⏱️ *Tiempos de recepción:*
• Depósito directo: 10-21 días
• Cheque por correo: 4-6 semanas

📊 ¿Quieres una estimación? Agenda una consulta gratuita.'''
    },
    'itin': {
        'keywords': ['itin', 'numero', 'número', 'sin social', 'no tengo social'],
        'answer': '''🔢 *Servicio de ITIN:*

Sí, podemos ayudarte a obtener tu ITIN.

✅ Requisitos:
• Pasaporte vigente (original)
• Comprobante de domicilio
• Declaración de impuestos

💰 Costo del servicio: Consultar
⏱️ Tiempo: 8-12 semanas

¿Te gustaría más información? Agenda una cita con nosotros.'''
    },
    'direccion': {
        'keywords': ['direccion', 'dirección', 'donde', 'dónde', 'ubicacion', 'ubicación', 'address', 'location'],
        'answer': '''📍 *Nuestra Ubicación:*

Ross Tax Preparation
Lubbock, TX

📞 Teléfono: (806) 922-2318
📧 Email: info@rosstaxpreparation.com

¿Necesitas indicaciones? Envíame tu ubicación y te ayudo.'''
    },
    'cita': {
        'keywords': ['cita', 'agendar', 'appointment', 'reservar', 'hacer cita', 'disponibilidad'],
        'answer': 'TRIGGER_APPOINTMENT_FLOW'
    },
    'status': {
        'keywords': ['status', 'estado', 'mi declaracion', 'mi declaración', 'como va', 'cómo va', 'ya esta', 'ya está'],
        'answer': 'TRIGGER_STATUS_FLOW'
    }
}

# Services available for contracting
SERVICES_CATALOG = [
    {'id': 'tax_individual', 'name': 'Declaración Individual', 'price': 180, 'description': 'Declaración de impuestos personal'},
    {'id': 'tax_business', 'name': 'Declaración con Negocio', 'price': 200, 'description': 'Incluye Schedule C para negocios'},
    {'id': 'itin', 'name': 'Tramite ITIN', 'price': 75, 'description': 'Obtención de número ITIN'},
    {'id': 'consultation', 'name': 'Consulta Gratuita', 'price': 0, 'description': 'Consulta inicial sin costo'},
]


class WhatsAppBotServiceV2:
    """Enhanced WhatsApp Bot with lead capture, FAQ, appointments and services"""
    
    def __init__(self, db: AsyncIOMotorDatabase, whatsapp_service, ai_brain=None):
        self.db = db
        self.whatsapp_service = whatsapp_service
        self.ai_brain = ai_brain
        self.bot_enabled = os.getenv('WHATSAPP_BOT_ENABLED', 'true').lower() == 'true'
        self.bot_name = "Ross Tax Bot"
        logger.info(f"✅ WhatsApp Bot V2 initialized (AI Brain: {'enabled' if ai_brain else 'disabled'})")
    
    async def _get_dynamic_prices_message(self) -> str:
        """
        Fetch services and prices dynamically from the database
        Returns a formatted message with current prices
        """
        try:
            # Get active services that are visible in app
            services = await self.db.dynamic_services.find({
                'active': True,
                'visible_in_app': True
            }).sort('order_index', 1).to_list(100)
            
            if not services:
                # Fallback if no services found
                return """💰 *Nuestros Precios:*

Para conocer nuestros precios actualizados, por favor contacta a un asesor o visita nuestra oficina.

📞 Teléfono: (806) 934-2018
📍 305 Bruce Ave, Dumas, TX

¿Te gustaría agendar una cita?"""
            
            # Build the message dynamically
            message_parts = ["💰 *Nuestros Precios (2025):*\n"]
            
            for service in services:
                name = service.get('name', 'Servicio')
                price = service.get('price', 0)
                
                # Format price
                if price == 0:
                    price_str = "GRATIS"
                else:
                    price_str = f"${price:,.0f}"
                
                message_parts.append(f"• {name}: {price_str}")
            
            message_parts.append("\n💳 Aceptamos: Efectivo, Tarjeta, Zelle, Pago del Reembolso")
            message_parts.append("\n¿Te gustaría agendar una cita?")
            
            return "\n".join(message_parts)
            
        except Exception as e:
            logger.error(f"Error fetching dynamic prices: {e}")
            # Fallback message if DB query fails
            return """💰 *Nuestros Precios:*

Para conocer nuestros precios actualizados, llámanos o visita nuestra oficina.

📞 Teléfono: (806) 934-2018
📍 305 Bruce Ave, Dumas, TX

¿Te gustaría agendar una cita?"""
    
    async def _should_bot_respond(self, phone_number: str) -> Dict[str, Any]:
        """
        Check if bot should respond automatically or manual mode is active
        Returns: {'auto_respond': bool, 'reason': str, 'mode': str}
        """
        try:
            # Get bot settings
            settings = await self.db.whatsapp_settings.find_one({'type': 'bot_config'})
            if not settings:
                # Default settings
                settings = {
                    'global_auto_mode': True,
                    'schedule_enabled': True,
                    'schedule': {
                        'monday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                        'tuesday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                        'wednesday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                        'thursday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                        'friday': {'enabled': True, 'start': '09:00', 'end': '18:00'},
                        'saturday': {'enabled': True, 'start': '10:00', 'end': '14:00'},
                        'sunday': {'enabled': False}
                    },
                    'auto_outside_hours': True,
                    'after_hours_message': None,
                    'closed_day_message': None
                }
            
            # Check conversation-specific override
            conversation = await self.db.whatsapp_conversations.find_one({'phone_number': phone_number})
            if conversation and conversation.get('manual_mode'):
                return {
                    'auto_respond': False,
                    'reason': 'Manual mode active for this conversation',
                    'mode': 'manual'
                }
            
            # Check global setting
            if not settings.get('global_auto_mode', True):
                return {
                    'auto_respond': False,
                    'reason': 'Bot disabled globally',
                    'mode': 'manual_global'
                }
            
            # Check schedule
            if settings.get('schedule_enabled', False):
                now = datetime.now()
                day_name = now.strftime('%A').lower()
                day_schedule = settings.get('schedule', {}).get(day_name)
                
                if day_schedule and day_schedule.get('enabled', False):
                    start_time = datetime.strptime(day_schedule['start'], '%H:%M').time()
                    end_time = datetime.strptime(day_schedule['end'], '%H:%M').time()
                    current_time = now.time()
                    
                    is_within_hours = start_time <= current_time <= end_time
                    
                    if is_within_hours:
                        # During business hours - check if manual mode preferred
                        if settings.get('manual_during_hours', False):
                            return {
                                'auto_respond': False,
                                'reason': 'Within business hours - manual mode',
                                'mode': 'manual_hours'
                            }
                    else:
                        # Outside business hours
                        if settings.get('auto_outside_hours', True):
                            # Check for custom after hours message
                            after_hours_msg = settings.get('after_hours_message')
                            return {
                                'auto_respond': True,
                                'reason': 'Outside business hours - auto mode',
                                'mode': 'auto_outside',
                                'custom_message': after_hours_msg
                            }
                        else:
                            return {
                                'auto_respond': False,
                                'reason': 'Outside business hours - responses disabled',
                                'mode': 'disabled_outside'
                            }
                else:
                    # Day is closed (e.g., Sunday) or disabled
                    if settings.get('auto_outside_hours', True):
                        # Check for custom closed day message
                        closed_day_msg = settings.get('closed_day_message')
                        return {
                            'auto_respond': True,
                            'reason': 'Office closed today - auto mode',
                            'mode': 'auto_closed',
                            'custom_message': closed_day_msg
                        }
            
            return {
                'auto_respond': True,
                'reason': 'Default auto mode',
                'mode': 'auto'
            }
            
        except Exception as e:
            logger.error(f"Error checking bot mode: {e}")
            return {'auto_respond': True, 'reason': 'Default (error)', 'mode': 'auto'}
    
    async def process_incoming_message(
        self,
        phone_number: str,
        message: str,
        user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for processing incoming WhatsApp messages
        """
        try:
            # Clean phone number
            phone_clean = self._clean_phone(phone_number)
            
            # Save incoming message
            await self.whatsapp_service._save_message(
                phone_number=phone_clean,
                message=message,
                direction='inbound',
                status='received'
            )
            
            # CHECK: Should bot respond automatically?
            bot_check = await self._should_bot_respond(phone_clean)
            
            if not bot_check['auto_respond']:
                # Manual mode - just save message and notify admin
                logger.info(f"Manual mode for {phone_clean}: {bot_check['reason']}")
                
                # Create notification for admin
                await self.db.admin_notifications.insert_one({
                    'type': 'whatsapp_message',
                    'title': 'Nuevo mensaje WhatsApp',
                    'message': f'{user_name or phone_clean}: {message[:50]}...',
                    'phone_number': phone_clean,
                    'mode': bot_check['mode'],
                    'read': False,
                    'created_at': datetime.utcnow()
                })
                
                # Update conversation unread count
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone_clean},
                    {
                        '$inc': {'unread_count': 1},
                        '$set': {
                            'last_message': message,
                            'last_message_at': datetime.utcnow(),
                            'needs_response': True
                        }
                    },
                    upsert=True
                )
                
                return {
                    'success': True,
                    'auto_responded': False,
                    'mode': bot_check['mode'],
                    'reason': bot_check['reason']
                }
            
            # STEP 1: Check if this is an existing client
            client_info = await self._find_client_by_phone(phone_clean)
            
            # STEP 2: Get or create conversation state
            conversation = await self._get_or_create_conversation(phone_clean, user_name, client_info)
            
            # STEP 2.3: Detect language preference
            lang = self._detect_language(message)
            if lang != conversation.get('language', 'es'):
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone_clean},
                    {'$set': {'language': lang}}
                )
                conversation['language'] = lang
            
            # STEP 2.5: Handle custom messages for outside hours or closed days
            if bot_check.get('custom_message') and bot_check['mode'] in ['auto_outside', 'auto_closed']:
                custom_msg = bot_check['custom_message']
                
                # Send custom message and continue with normal flow
                await self.whatsapp_service.send_message(
                    to=phone_clean,
                    message=custom_msg
                )
                
                # Log the custom message
                await self.whatsapp_service._save_message(
                    phone_number=phone_clean,
                    message=custom_msg,
                    direction='outbound',
                    status='sent'
                )
            
            # STEP 3: Check if user wants to exit current flow or ask something else
            current_flow = conversation.get('current_flow')
            message_lower = message.lower().strip()
            
            # Keywords that indicate user wants to do something else (exit flow)
            exit_keywords = ['cancelar', 'salir', 'menu', 'menú', 'inicio', 'ayuda', 'help', 'otro', 'otra cosa']
            wants_exit = any(kw in message_lower for kw in exit_keywords)
            
            # Check if user is asking a question (not continuing flow)
            is_question = any(q in message_lower for q in ['?', 'cuanto', 'cuánto', 'donde', 'dónde', 'como', 'cómo', 'que', 'qué', 'cuando', 'cuándo', 'por que', 'por qué', 'cual', 'cuál'])
            
            # If in a flow but user asks a question or wants to exit
            if current_flow and (wants_exit or is_question):
                if wants_exit:
                    # Clear the flow and show menu
                    await self._clear_flow(phone_clean)
                    response = await self._send_welcome(phone_clean, user_name, client_info)
                    return response
                elif is_question and self.ai_brain:
                    # Use AI Brain to answer naturally, then remind about the flow
                    ai_response = await self._get_ai_response(phone_clean, message, client_info, user_name or '')
                    flow_reminder = self._get_flow_reminder(current_flow)
                    if ai_response.get('message'):
                        ai_response['message'] = ai_response['message'] + f"\n\n---\n{flow_reminder}"
                    return ai_response
                elif is_question:
                    # Fallback to FAQ if AI not available
                    faq_response = self._check_quick_faq(message_lower)
                    if faq_response and faq_response.get('message') and faq_response['message'] != 'DYNAMIC_PRICES':
                        flow_reminder = self._get_flow_reminder(current_flow)
                        faq_response['message'] = faq_response['message'] + f"\n\n---\n{flow_reminder}"
                        return faq_response
            
            # Continue flow if active and user is responding to it
            if current_flow == 'appointment':
                response = await self._continue_appointment_flow(phone_clean, message, conversation, client_info)
            elif current_flow == 'services':
                response = await self._continue_services_flow(phone_clean, message, conversation, client_info)
            elif current_flow == 'lead_capture':
                response = await self._continue_lead_capture(phone_clean, message, conversation)
            elif current_flow == 'account_creation':
                response = await self._continue_account_creation(phone_clean, message, conversation)
            elif current_flow == 'document_upload':
                response = await self._continue_document_upload_flow(phone_clean, message, conversation, client_info)
            elif current_flow == 'expense_receipt':
                response = await self._continue_expense_receipt_flow(phone_clean, message, conversation, client_info)
            else:
                # STEP 4: Use AI-first approach for routing
                response = await self._smart_route_message(phone_clean, message, conversation, client_info, user_name)
            
            # Send response
            if response.get('message'):
                send_result = await self.whatsapp_service.send_message(
                    to=phone_clean,
                    message=response['message']
                )
                response['sent'] = send_result.get('success', False)
            
            # Send buttons if provided
            if response.get('buttons'):
                await self.whatsapp_service.send_buttons(
                    to=phone_clean,
                    body=response.get('buttons_text', '¿Qué te gustaría hacer?'),
                    buttons=response['buttons']
                )
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            fallback = "Disculpa, tuve un problema. Un asesor te contactará pronto. 📞"
            await self.whatsapp_service.send_message(to=phone_number, message=fallback)
            return {'success': False, 'error': str(e)}
    
    def _clean_phone(self, phone: str) -> str:
        """Clean phone number to just digits"""
        return re.sub(r'\D', '', phone)[-10:]
    
    def _detect_language(self, message: str) -> str:
        """Detect if message is in English or Spanish"""
        eng_words = ['hello', 'hi', 'hey', 'how', 'what', 'when', 'where', 'why', 'who',
                     'price', 'appointment', 'help', 'need', 'want', 'can', 'please',
                     'thank', 'taxes', 'refund', 'schedule', 'book', 'document',
                     'much', 'cost', 'office', 'hours', 'good morning', 'good afternoon']
        msg_lower = message.lower()
        eng_count = sum(1 for w in eng_words if w in msg_lower)
        return 'en' if eng_count >= 2 else 'es'
    
    def _t(self, key: str, lang: str = 'es') -> str:
        """Simple translation helper for flow messages"""
        translations = {
            'welcome_new': {
                'es': '👋 ¡Hola {name}! Bienvenido a Ross Tax Preparation.\n\n¿En qué te podemos ayudar?',
                'en': '👋 Hello {name}! Welcome to Ross Tax Preparation.\n\nHow can we help you?'
            },
            'appointment_prompt': {
                'es': '📅 *Horarios Disponibles*\n\nEscoge un día y hora:\n',
                'en': '📅 *Available Slots*\n\nChoose a day and time:\n'
            },
            'appointment_confirm': {
                'es': '¿Confirmas esta cita?\n\n📅 {date}\n⏰ {time}\n\nResponde *sí* para confirmar o *no* para cambiar.',
                'en': 'Confirm this appointment?\n\n📅 {date}\n⏰ {time}\n\nReply *yes* to confirm or *no* to change.'
            },
            'appointment_success': {
                'es': '🎉 *¡Cita Confirmada!*\n\n📅 Fecha: {date}\n⏰ Hora: {time}\n📍 Lugar: 305 Bruce Ave, Dumas, TX 79029\n\n*Documentos a traer:*\n• Identificación oficial\n• W-2 de todos los empleos\n• Seguro Social',
                'en': '🎉 *Appointment Confirmed!*\n\n📅 Date: {date}\n⏰ Time: {time}\n📍 Location: 305 Bruce Ave, Dumas, TX 79029\n\n*Bring with you:*\n• Photo ID\n• W-2 from all jobs\n• Social Security cards'
            },
            'menu': {
                'es': '¿En qué te puedo ayudar?\n\n1️⃣ Agendar cita\n2️⃣ Ver precios\n3️⃣ Enviar documentos\n4️⃣ Estado de mi declaración\n5️⃣ Hablar con un asesor',
                'en': 'How can I help you?\n\n1️⃣ Schedule appointment\n2️⃣ View prices\n3️⃣ Send documents\n4️⃣ Tax return status\n5️⃣ Talk to an advisor'
            },
            'ask_email': {
                'es': '📧 ¿Cuál es tu correo electrónico?',
                'en': '📧 What is your email address?'
            },
            'ask_name': {
                'es': '¿Cuál es tu nombre completo?',
                'en': 'What is your full name?'
            }
        }
        entry = translations.get(key, {})
        return entry.get(lang, entry.get('es', key))
    
    def _check_quick_faq(self, message_lower: str) -> Optional[Dict]:
        """Check if message matches a quick FAQ without needing to exit flow"""
        for faq_key, faq_data in FAQ_DATABASE.items():
            if any(kw in message_lower for kw in faq_data['keywords']):
                if faq_data['answer'] not in ['TRIGGER_APPOINTMENT_FLOW', 'TRIGGER_STATUS_FLOW']:
                    return {'success': True, 'message': faq_data['answer'], 'intent': faq_key}
        return None
    
    def _get_flow_reminder(self, flow: str) -> str:
        """Get a reminder message for the current flow"""
        reminders = {
            'appointment': "📅 Por cierto, estábamos agendando tu cita. ¿Continuamos? Escribe el día que prefieres o 'cancelar' para ver el menú.",
            'services': "💼 Estábamos viendo los servicios. ¿Te interesa alguno? Escribe el número o 'cancelar' para el menú.",
            'account_creation': "📱 Estábamos creando tu cuenta. ¿Continuamos? Escribe tu respuesta o 'cancelar' para el menú.",
            'lead_capture': "📋 Estábamos registrando tus datos. ¿Continuamos?",
            'document_upload': "📄 Estoy recibiendo tus documentos. Envía más o escribe 'listo' cuando termines.",
            'expense_receipt': "🧾 Estoy recibiendo tus recibos de gastos. Envía más o escribe 'listo' cuando termines."
        }
        return reminders.get(flow, "¿En qué más puedo ayudarte?")
    
    async def _clear_flow(self, phone: str):
        """Clear current flow and return to main menu"""
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {'current_flow': None, 'flow_data': {}}}
        )
    
    async def _smart_route_message(self, phone: str, message: str, conversation: Dict, client_info: Dict, user_name: str) -> Dict:
        """
        AI-first intelligent message routing - ENHANCED VERSION
        - Responds to questions EVEN during appointment flow
        - More human-like and dynamic
        - Handles documents, payments, invoices
        """
        message_lower = message.lower().strip()
        current_flow = conversation.get('current_flow')
        
        # ALWAYS respond to these, even during a flow
        urgent_keywords = ['precio', 'precios', 'cuanto', 'cuánto', 'costo', 'ayuda', 'help', 
                          'asesor', 'humano', 'persona', 'hablar', 'emergencia', 'urgente']
        
        # Check if user is asking a question during a flow (don't ignore them!)
        is_question = '?' in message or any(q in message_lower for q in ['qué', 'que', 'cómo', 'como', 'cuándo', 'cuando', 'dónde', 'donde', 'por qué', 'porque'])
        is_urgent = any(kw in message_lower for kw in urgent_keywords)
        
        # If user asks a question during flow, answer it AND remind about the flow
        if current_flow and (is_question or is_urgent):
            # Get AI response for the question
            ai_response = await self._get_ai_response(phone, message, client_info, user_name)
            
            # Add a gentle reminder about the ongoing flow
            flow_reminder = self._get_flow_reminder(current_flow)
            ai_response['message'] = ai_response['message'] + f"\n\n{flow_reminder}"
            
            return ai_response
        
        # Check for document/image received
        if message_lower in ['documento', 'doc', 'imagen', 'foto', 'archivo'] or 'document_received' in message_lower:
            return await self._handle_document_received(phone, message, client_info)
        
        # Check for payment mentions
        if any(kw in message_lower for kw in ['pagué', 'pague', 'pago', 'transferí', 'envié', 'zelle', 'payment']):
            return await self._handle_payment_mention(phone, message, client_info)
        
        # Check for explicit menu selections first (only exact matches)
        if message_lower in ['1', 'uno']:
            return await self._start_appointment_flow(phone, conversation, client_info)
        
        if message_lower in ['2', 'dos']:
            return await self._start_services_flow(phone, conversation)
        
        if message_lower in ['3', 'tres']:
            return self._get_faq_response('documentos')
        
        if message_lower in ['4', 'cuatro']:
            if client_info:
                return await self._handle_status_check(phone, client_info)
            else:
                return await self._start_account_creation_flow(phone, conversation)
        
        if message_lower in ['5', 'cinco']:
            return await self._request_human_agent(phone)
        
        # Check for simple keywords (single word requests)
        if message_lower in ['agendar', 'cita', 'appointment']:
            return await self._start_appointment_flow(phone, conversation, client_info)
        if message_lower in ['precios', 'precio', 'prices', 'cuanto', 'cuánto']:
            return await self._get_faq_response_async('precios')
        if message_lower in ['documentos', 'documento', 'documents']:
            return self._get_faq_response('documentos')
        if message_lower in ['horario', 'horarios', 'hours']:
            return self._get_faq_response('horario')
        if message_lower in ['menu', 'menú', 'inicio', 'opciones']:
            return await self._send_welcome(phone, user_name, client_info)
        
        # Check for greetings (first contact)
        greetings = ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'que tal', 'qué tal']
        if message_lower in greetings or (any(g == message_lower for g in greetings) and conversation.get('message_count', 0) <= 2):
            return await self._send_welcome(phone, user_name, client_info)
        
        # For any conversational message or question, USE AI FIRST
        # This makes the bot much more natural
        if self.ai_brain:
            return await self._get_ai_response(phone, message, client_info, user_name)
        
        # Only use FAQ as fallback if AI is not available
        for faq_key, faq_data in FAQ_DATABASE.items():
            if any(kw in message_lower for kw in faq_data['keywords']):
                if faq_data['answer'] == 'TRIGGER_APPOINTMENT_FLOW':
                    return await self._start_appointment_flow(phone, conversation, client_info)
                elif faq_data['answer'] == 'TRIGGER_STATUS_FLOW':
                    return await self._handle_status_check(phone, client_info)
                else:
                    return {'success': True, 'message': faq_data['answer'], 'intent': faq_key}
        
        # Fallback to helpful response
        client_name = client_info.get('first_name', '') if client_info else (user_name.split()[0] if user_name else '')
        greeting = f"Hola {client_name}, " if client_name else ""
        
        return {
            'success': True,
            'message': f"""{greeting}entiendo que tienes una pregunta. 🤔

Te puedo ayudar con:
• 📅 *Citas* - Escribe "agendar"
• 💰 *Precios* - Escribe "precios"  
• 📄 *Documentos* - Escribe "documentos"
• 🕐 *Horarios* - Escribe "horario"

O si prefieres, un asesor puede atenderte directamente. Escribe "asesor" y te contactamos.

¿Qué necesitas?""",
            'intent': 'fallback_helpful'
        }
    
    async def _find_client_by_phone(self, phone: str) -> Optional[Dict]:
        """Find existing client by phone number"""
        try:
            # Clean phone to just digits
            phone_digits = re.sub(r'\D', '', phone)[-10:]
            
            if not phone_digits or len(phone_digits) < 10:
                return None
            
            # Search by exact match or containing the phone number
            user = await self.db.users.find_one({
                '$or': [
                    {'phone': phone_digits},
                    {'phone': f"+1{phone_digits}"},
                    {'phone': f"1{phone_digits}"},
                    {'phone': {'$regex': f".*{phone_digits}$"}}
                ]
            })
            
            if user:
                # Get additional client info for personalization
                tax_returns = await self.db.tax_returns.count_documents({'user_id': str(user.get('_id'))})
                appointments = await self.db.appointments.find_one({
                    'user_id': str(user.get('_id')),
                    'status': {'$in': ['pending', 'confirmed']},
                    'date': {'$gte': datetime.utcnow()}
                }, sort=[('date', 1)])
                
                return {
                    'id': str(user.get('_id', user.get('id'))),
                    'name': user.get('name', user.get('full_name', '')),
                    'first_name': user.get('name', '').split()[0] if user.get('name') else '',
                    'email': user.get('email', ''),
                    'is_registered': True,
                    'tax_returns_count': tax_returns,
                    'has_pending_appointment': appointments is not None,
                    'next_appointment': appointments,
                    'created_at': user.get('created_at'),
                    'last_login': user.get('last_login')
                }
            
            return None
        except Exception as e:
            logger.error(f"Error finding client: {e}")
            return None
    
    async def _create_client_account(self, phone: str, name: str, email: str = None) -> Dict:
        """Create a new client account from WhatsApp conversation"""
        try:
            # Generate temporary password
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            
            # Hash password (simple hash for now, should use bcrypt in production)
            import hashlib
            password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
            
            new_user = {
                'name': name,
                'phone': phone,
                'email': email,
                'password': password_hash,
                'temp_password': temp_password,  # Will be sent to user
                'role': 'client',
                'is_active': True,
                'source': 'whatsapp',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'profile_complete': False,
                'onboarding_complete': False
            }
            
            result = await self.db.users.insert_one(new_user)
            new_user['_id'] = result.inserted_id
            new_user['id'] = str(result.inserted_id)
            
            logger.info(f"✅ Created new client account from WhatsApp: {name} ({phone})")
            
            return {
                'id': str(result.inserted_id),
                'name': name,
                'first_name': name.split()[0] if name else '',
                'phone': phone,
                'email': email,
                'temp_password': temp_password,
                'is_registered': True,
                'is_new_account': True
            }
            
        except Exception as e:
            logger.error(f"Error creating client account: {e}")
            return None
    
    async def _get_or_create_conversation(self, phone: str, user_name: str, client_info: Dict) -> Dict:
        """Get or create conversation state"""
        conversation = await self.db.whatsapp_conversations.find_one({'phone_number': phone})
        
        if not conversation:
            conversation = {
                'phone_number': phone,
                'user_name': user_name or (client_info.get('name') if client_info else None),
                'is_registered_client': client_info is not None,
                'client_id': client_info.get('id') if client_info else None,
                'is_lead': client_info is None,
                'lead_status': 'new' if not client_info else 'client',
                'current_flow': None,
                'flow_data': {},
                'message_count': 0,
                'first_contact_at': datetime.utcnow(),
                'last_message_at': datetime.utcnow()
            }
            await self.db.whatsapp_conversations.insert_one(conversation)
        else:
            # Update last message time
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {
                    '$set': {'last_message_at': datetime.utcnow()},
                    '$inc': {'message_count': 1}
                }
            )
        
        return conversation
    
    async def _route_message(self, phone: str, message: str, conversation: Dict, client_info: Dict, user_name: str) -> Dict:
        """Route message based on intent detection"""
        message_lower = message.lower().strip()
        
        # Check for slot offer acceptance (when client wants to advance their appointment)
        if message_lower in ['si adelantar', 'sí adelantar', 'adelantar', 'adelantar cita']:
            return await self._handle_slot_offer_acceptance(phone, client_info)
        
        # Check for menu/number selection
        if message_lower in ['1', 'uno', 'agendar', 'cita']:
            return await self._start_appointment_flow(phone, conversation, client_info)
        
        if message_lower in ['2', 'dos', 'precios', 'servicios']:
            return await self._start_services_flow(phone, conversation)
        
        if message_lower in ['3', 'tres', 'documentos', 'documento']:
            return await self._start_document_upload_flow(phone, conversation, client_info)
        
        if message_lower in ['4', 'cuatro', 'recibo', 'recibos', 'gasto', 'gastos']:
            return await self._start_expense_receipt_flow(phone, conversation, client_info)
        
        if message_lower in ['5', 'cinco', 'status', 'estado', 'caso']:
            if client_info:
                return await self._handle_status_check(phone, client_info)
            else:
                # New user - start account creation flow
                return await self._start_account_creation_flow(phone, conversation)
        
        if message_lower in ['6', 'seis', 'hablar', 'asesor', 'humano']:
            return await self._request_human_agent(phone)
        
        # Handle account creation flow
        if conversation.get('current_flow') == 'account_creation':
            return await self._continue_account_creation(phone, message, conversation)
        
        # Check FAQ keywords
        for faq_key, faq_data in FAQ_DATABASE.items():
            if any(kw in message_lower for kw in faq_data['keywords']):
                if faq_data['answer'] == 'TRIGGER_APPOINTMENT_FLOW':
                    return await self._start_appointment_flow(phone, conversation, client_info)
                elif faq_data['answer'] == 'TRIGGER_STATUS_FLOW':
                    return await self._handle_status_check(phone, client_info)
                else:
                    return {'success': True, 'message': faq_data['answer'], 'intent': faq_key}
        
        # First message? Send personalized welcome
        if conversation.get('message_count', 0) <= 1:
            return await self._send_welcome(phone, user_name, client_info)
        
        # Use AI Brain for intelligent response if available
        if self.ai_brain:
            return await self._get_ai_response(phone, message, client_info, user_name)
        
        # Default: Send menu again
        return self._get_main_menu(client_info)
    
    async def _get_ai_response(self, phone: str, message: str, client_info: Dict, user_name: str) -> Dict:
        """Get intelligent, natural response from Ross AI Brain - ENHANCED VERSION"""
        try:
            # Get conversation history for context
            recent_messages = []
            try:
                cursor = self.db.whatsapp_messages.find(
                    {'phone_number': phone}
                ).sort('created_at', -1).limit(8)
                async for msg in cursor:
                    recent_messages.append({
                        'role': 'client' if msg.get('direction') == 'inbound' else 'assistant',
                        'content': msg.get('message', '')
                    })
                recent_messages.reverse()
            except:
                pass
            
            # Get real-time available appointments
            available_slots_text = ""
            try:
                slots = await self._get_available_slots()
                if slots:
                    available_slots_text = f"\n\nHORARIOS DISPONIBLES ESTA SEMANA:\n"
                    for slot in slots[:3]:
                        available_slots_text += f"- {slot['day_name']} {slot['date']}: {', '.join(slot['slots'][:4])}\n"
            except:
                pass
            
            # Build rich context for AI
            client_name = user_name or (client_info.get('first_name', '') if client_info else '') or 'Cliente'
            
            # Detect language preference
            is_english = any(word in message.lower() for word in ['hello', 'hi', 'how', 'what', 'when', 'where', 'price', 'appointment', 'help'])
            language_instruction = "Responde en inglés si el cliente escribe en inglés, de lo contrario usa español." if is_english else "Responde en español de forma natural y conversacional."
            
            # Get time of day for greeting variation
            hour = datetime.now().hour
            time_greeting = "Buenos días" if hour < 12 else "Buenas tardes" if hour < 19 else "Buenas noches"
            
            # Random personality variations to feel more human
            import random
            personality_traits = [
                "Eres súper amigable y te encanta ayudar a la gente con sus impuestos",
                "Te apasiona explicar las cosas de forma sencilla para que todos entiendan",
                "Tienes un toque de humor ligero cuando es apropiado",
                "Celebras genuinamente cuando puedes ayudar a alguien",
            ]
            selected_trait = random.choice(personality_traits)
            
            casual_phrases = [
                "¡Claro que sí!", "¡Con mucho gusto!", "¡Órale, te ayudo!", 
                "¡Por supuesto!", "¡Va que va!", "¡Perfecto!", "¡Excelente pregunta!"
            ]
            
            context = f"""Eres Ross, el asistente virtual de Ross Tax Preparation en WhatsApp.
Actúas como un humano real, NO como un robot.

TU PERSONALIDAD (MUY IMPORTANTE - SÉ NATURAL):
- {selected_trait}
- {language_instruction}
- VARÍA tus respuestas, no uses siempre las mismas frases
- Usa expresiones casuales como: {', '.join(random.sample(casual_phrases, 3))}
- Emojis con moderación pero con personalidad (2-4 por mensaje)
- NUNCA digas "como asistente virtual" o "como IA" - eres Ross, punto
- Puedes usar expresiones como "oye", "mira", "fíjate que", "te cuento que"
- Si el cliente hace una pregunta simple, responde de forma breve y natural
- Si es algo más complejo, explica paso a paso pero sin aburrir
- Cuando no sabes algo, di algo como "Hmm, para eso mejor te conecto con uno de mis compañeros humanos, ¿va?"
- NUNCA inventes información, especialmente sobre precios o tiempos
- Es {time_greeting}, ajusta tu tono al momento del día

INFORMACIÓN DE LA EMPRESA:
- Ross Tax Preparation LLC
- Dirección: 305 Bruce Ave, Dumas, TX 79029
- Teléfono: (806) 934-2018
- Horario: Lunes a Viernes 9:00 AM - 6:00 PM
- Email para documentos: docu@rosstaxpreparation.com
- NO tenemos servicio de FAX

FORMAS DE ENVIAR DOCUMENTOS:
1. Email: docu@rosstaxpreparation.com
2. App móvil Ross Tax: Subir desde la app
3. WhatsApp: Enviar fotos/PDFs aquí
4. En persona: 305 Bruce Ave, Dumas, TX

PRECIOS EXACTOS (MUY IMPORTANTE - NO CAMBIES ESTOS):
- Declaración Individual: $180
- Declaración con Negocio (Schedule C): $200
- Trámite ITIN: $75
- Consulta inicial: GRATIS
- Aceptamos: Efectivo, Tarjeta, Zelle, Pago del Reembolso

SERVICIOS QUE OFRECEMOS:
- Declaraciones de impuestos individuales
- Declaraciones de negocios (LLC, Schedule C)
- Trámite de ITIN para personas sin SSN
- Representación ante el IRS
- Enmiendas de declaraciones
- Consultoría fiscal

INFORMACIÓN DEL CLIENTE QUE TE ESCRIBE:
- Nombre: {client_name}
- Es cliente registrado: {'SÍ ✓ (ya nos conoce)' if client_info else 'NO - Es potencial cliente nuevo'}
{f"- Declaraciones previas con nosotros: {client_info.get('tax_returns_count', 0)}" if client_info else ""}
{f"- Tiene cita pendiente: {'SÍ - preguntale si necesita cambiarla' if client_info and client_info.get('has_pending_appointment') else 'No tiene cita'}" if client_info else ""}
{available_slots_text}

HISTORIAL DE ESTA CONVERSACIÓN:
{chr(10).join([f"{'👤 Cliente' if m['role'] == 'client' else '🤖 Ross'}: {m['content'][:150]}" for m in recent_messages[-5:]]) if recent_messages else "Esta es la primera interacción"}

INSTRUCCIONES IMPORTANTES:
1. Responde DIRECTAMENTE a lo que pregunta el cliente
2. Si preguntan precios, da los EXACTOS de arriba ($180, $200, etc.)
3. Si quieren agendar, diles que escriban "agendar" o sugiere un horario específico
4. Si es nuevo y muestra interés, invítalo a crear cuenta: "crear cuenta"
5. NO repitas el menú en cada mensaje, solo cuando pidan "menú"
6. Si preguntan algo que no sabes, di: "Para eso te puede ayudar mejor uno de nuestros asesores. ¿Te conecto con uno?"
7. Si el cliente parece frustrado o confundido, ofrece ayuda humana
8. Siempre termina con una pregunta o llamado a acción claro"""

            # Call AI Brain
            prompt = f"""{context}

MENSAJE ACTUAL DEL CLIENTE: {message}

Responde de forma natural y útil:"""
            
            if hasattr(self.ai_brain, 'model'):
                response = self.ai_brain.model.generate_content(prompt)
                ai_text = response.text.strip()
                
                # Only add quick tips if the response is short or general
                if len(ai_text) < 200 and 'menú' not in ai_text.lower():
                    ai_text += "\n\n💡 _Escribe 'menú' para ver todas las opciones_"
                
                return {
                    'success': True,
                    'message': ai_text,
                    'intent': 'ai_response',
                    'ai_powered': True
                }
            else:
                logger.warning("AI Brain model not available")
                return self._get_main_menu(client_info)
                
        except Exception as e:
            logger.error(f"Error getting AI response: {e}")
            return self._get_main_menu(client_info)
    
    async def _send_welcome(self, phone: str, user_name: str, client_info: Dict) -> Dict:
        """Send personalized welcome message based on client status"""
        if client_info:
            # Existing client - highly personalized greeting
            first_name = client_info.get('first_name') or client_info.get('name', '').split()[0] if client_info.get('name') else 'Cliente'
            
            # Check for pending appointments
            appt_text = ""
            if client_info.get('has_pending_appointment') and client_info.get('next_appointment'):
                appt = client_info['next_appointment']
                appt_date = appt.get('date')
                if appt_date:
                    if isinstance(appt_date, datetime):
                        date_str = appt_date.strftime('%d/%m a las %H:%M')
                    else:
                        date_str = str(appt_date)
                    appt_text = f"\n\n📅 *Tu próxima cita:* {date_str}"
            
            # Check tax return count
            returns_text = ""
            if client_info.get('tax_returns_count', 0) > 0:
                returns_text = f"\n🎉 Ya tienes {client_info['tax_returns_count']} declaración(es) con nosotros."
            
            message = f"""¡Hola {first_name}! 👋 ¡Qué gusto saludarte de nuevo!

Soy el asistente virtual de Ross Tax. Te reconocí por tu número. 📱{returns_text}{appt_text}

¿En qué puedo ayudarte hoy?

1️⃣ 📅 Agendar una cita
2️⃣ 💰 Ver precios
3️⃣ 📄 Enviar documentos fiscales
4️⃣ 🧾 Enviar recibo de gasto
5️⃣ 📊 Ver status de mi caso
6️⃣ 👤 Hablar con un asesor

Responde con el número o escribe tu pregunta.

📲 *Tip:* Descarga nuestra app para ver tu historial completo:
{IOS_APP_LINK}"""
        else:
            # New lead - Start automatic lead capture
            name_part = f"{user_name}" if user_name else ""
            
            if not name_part:
                # Don't have a name - ask for it to create account
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {
                        'current_flow': 'lead_capture',
                        'flow_data': {'step': 'ask_name'},
                        'is_lead': True,
                        'lead_captured_at': datetime.utcnow()
                    }}
                )
                
                message = f"""¡Hola! 👋 Bienvenido a *Ross Tax Preparation*.

Soy tu asistente virtual Ross. 🤖✨

Para darte un mejor servicio, ¿me dices tu nombre? 

_(Solo escribe tu nombre y apellido)_"""
                
                return {'success': True, 'message': message, 'intent': 'lead_ask_name'}
            else:
                # We have a name from WhatsApp - ask for email
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {
                        'current_flow': 'lead_capture',
                        'flow_data': {'step': 'ask_email', 'name': user_name},
                        'user_name': user_name,
                        'is_lead': True,
                        'lead_captured_at': datetime.utcnow()
                    }}
                )
                
                first_name = user_name.split()[0] if user_name else 'amigo'
                
                message = f"""¡Hola {first_name}! 👋 Bienvenido a *Ross Tax Preparation*.

Soy tu asistente virtual Ross. 🤖✨

Te voy a crear una cuenta rápida para darte mejor servicio.

📧 ¿Cuál es tu correo electrónico?

_(Lo usaremos para enviarte información de tu caso)_"""
                
                return {'success': True, 'message': message, 'intent': 'lead_ask_email'}
        
        return {'success': True, 'message': message, 'intent': 'welcome'}
    
    def _get_main_menu(self, client_info: Dict) -> Dict:
        """Return main menu"""
        message = """¿En qué más puedo ayudarte? 🤔

1️⃣ 📅 Agendar una cita
2️⃣ 💰 Ver precios
3️⃣ 📄 Enviar documentos fiscales
4️⃣ 🧾 Enviar recibo de gasto
5️⃣ 📊 Ver status de mi caso
6️⃣ 👤 Hablar con un asesor

Responde con el número o tu pregunta."""
        return {'success': True, 'message': message, 'intent': 'menu'}
    
    def _get_faq_response(self, key: str) -> Dict:
        """Get FAQ response (for non-dynamic FAQs)"""
        faq = FAQ_DATABASE.get(key, {})
        answer = faq.get('answer', 'No tengo esa información.')
        # Handle dynamic pricing trigger - this should be called via async method
        if answer == 'DYNAMIC_PRICES':
            # Return a flag indicating async handling is needed
            return {'success': True, 'message': None, 'intent': f'faq_{key}', 'needs_async': True, 'async_type': 'prices'}
        return {'success': True, 'message': answer, 'intent': f'faq_{key}'}
    
    async def _get_faq_response_async(self, key: str) -> Dict:
        """Get FAQ response with async support for dynamic content like prices"""
        faq = FAQ_DATABASE.get(key, {})
        answer = faq.get('answer', 'No tengo esa información.')
        
        # Handle dynamic pricing
        if answer == 'DYNAMIC_PRICES':
            prices_message = await self._get_dynamic_prices_message()
            return {'success': True, 'message': prices_message, 'intent': f'faq_{key}'}
        
        return {'success': True, 'message': answer, 'intent': f'faq_{key}'}
    
    # ==================== APPOINTMENT FLOW ====================
    
    async def _start_appointment_flow(self, phone: str, conversation: Dict, client_info: Dict) -> Dict:
        """Start the appointment booking flow"""
        # Get available slots
        slots = await self._get_available_slots()
        
        # Update conversation state
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {
                'current_flow': 'appointment',
                'flow_data': {'step': 'select_day', 'slots': slots},
                'flow_started_at': datetime.utcnow()
            }}
        )
        
        # Format slots message
        days_msg = "📅 *Horarios Disponibles:*\n\n"
        for i, day in enumerate(slots[:5], 1):
            days_msg += f"{i}️⃣ {day['day_name']} {day['date']}\n"
            for slot in day['slots'][:3]:
                days_msg += f"   • {slot}\n"
            days_msg += "\n"
        
        days_msg += "\nResponde con el día y hora que prefieras.\nEjemplo: *Lunes 10:00 AM*"
        
        return {'success': True, 'message': days_msg, 'intent': 'appointment_start'}
    
    async def _continue_appointment_flow(self, phone: str, message: str, conversation: Dict, client_info: Dict) -> Dict:
        """Continue appointment booking flow"""
        flow_data = conversation.get('flow_data', {})
        step = flow_data.get('step', 'select_day')
        
        if step == 'select_day':
            # Try to parse day/time from message
            parsed = self._parse_appointment_time(message)
            
            if parsed:
                # Save selected time
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {
                        'flow_data.selected_datetime': parsed,
                        'flow_data.step': 'confirm'
                    }}
                )
                
                # Ask for confirmation
                confirm_msg = f"""✅ Perfecto! Confirma tu cita:

📅 *Fecha:* {parsed['date_str']}
⏰ *Hora:* {parsed['time_str']}
📍 *Lugar:* Ross Tax Preparation
📋 *Tipo:* Consulta de Impuestos

¿Confirmas esta cita?
Responde *SÍ* para confirmar o *NO* para cambiar."""
                
                return {'success': True, 'message': confirm_msg, 'intent': 'appointment_confirm'}
            else:
                return {
                    'success': True,
                    'message': "No entendí la fecha/hora. Por favor responde con algo como:\n*Lunes 10:00 AM* o *Martes 2:00 PM*",
                    'intent': 'appointment_retry'
                }
        
        elif step == 'confirm':
            if message.lower() in ['si', 'sí', 'yes', 'confirmar', 'confirmo']:
                # Need client info
                if client_info:
                    return await self._create_appointment_from_whatsapp(phone, conversation, client_info)
                else:
                    # Need to collect info first
                    await self.db.whatsapp_conversations.update_one(
                        {'phone_number': phone},
                        {'$set': {'flow_data.step': 'collect_name'}}
                    )
                    return {
                        'success': True,
                        'message': "Para completar tu cita necesito algunos datos.\n\n¿Cuál es tu nombre completo?",
                        'intent': 'appointment_collect_name'
                    }
            else:
                # Cancel and restart
                return await self._start_appointment_flow(phone, conversation, client_info)
        
        elif step == 'collect_name':
            # Save name and ask for email
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'flow_data.client_name': message,
                    'flow_data.step': 'collect_email'
                }}
            )
            return {
                'success': True,
                'message': f"Gracias {message.split()[0]}! 📧 ¿Cuál es tu correo electrónico?",
                'intent': 'appointment_collect_email'
            }
        
        elif step == 'collect_email':
            # Validate email
            if '@' in message and '.' in message:
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {
                        'flow_data.client_email': message,
                        'flow_data.step': 'final_confirm'
                    }}
                )
                
                # Get saved data
                conv = await self.db.whatsapp_conversations.find_one({'phone_number': phone})
                fd = conv.get('flow_data', {})
                
                return {
                    'success': True,
                    'message': f"""📋 *Resumen de tu cita:*

👤 Nombre: {fd.get('client_name')}
📧 Email: {message}
📱 Teléfono: {phone}
📅 Fecha: {fd.get('selected_datetime', {}).get('date_str')}
⏰ Hora: {fd.get('selected_datetime', {}).get('time_str')}

¿Todo correcto? Responde *SÍ* para confirmar.""",
                    'intent': 'appointment_final_confirm'
                }
            else:
                return {
                    'success': True,
                    'message': "Por favor ingresa un correo válido (ejemplo: tu@email.com)",
                    'intent': 'appointment_retry_email'
                }
        
        elif step == 'final_confirm':
            if message.lower() in ['si', 'sí', 'yes', 'confirmar']:
                # Create the appointment
                conv = await self.db.whatsapp_conversations.find_one({'phone_number': phone})
                fd = conv.get('flow_data', {})
                
                # Create a basic client record if not exists
                new_client = {
                    'id': str(fd.get('client_name', '').replace(' ', '_').lower()) + '_' + phone[-4:],
                    'name': fd.get('client_name'),
                    'email': fd.get('client_email'),
                    'phone': phone
                }
                
                return await self._create_appointment_from_whatsapp(phone, conv, new_client)
            else:
                # Restart flow
                return await self._start_appointment_flow(phone, conversation, client_info)
        
        return self._get_main_menu(client_info)
    
    async def _create_appointment_from_whatsapp(self, phone: str, conversation: Dict, client_info: Dict) -> Dict:
        """Create appointment using the LOCAL circuito cerrado system (NO SQUARE).
        
        Uses the same appointment creation logic as /api/public/book-appointment:
        - Checks for time slot conflicts
        - Creates/finds client record
        - Stores in MongoDB appointments collection
        - Sends SMS notification
        """
        try:
            fd = conversation.get('flow_data', {})
            selected = fd.get('selected_datetime', {})
            
            # Create management token for self-service
            import secrets
            management_token = secrets.token_urlsafe(32)
            
            # Get scheduled datetime
            scheduled_dt = selected.get('datetime')
            if isinstance(scheduled_dt, str):
                try:
                    scheduled_dt = datetime.fromisoformat(scheduled_dt)
                except:
                    scheduled_dt = datetime.utcnow() + timedelta(days=1)
            elif not isinstance(scheduled_dt, datetime):
                scheduled_dt = datetime.utcnow() + timedelta(days=1)
            
            # Check for time slot conflicts (same as public booking)
            date_str = scheduled_dt.strftime('%Y-%m-%d')
            time_str = scheduled_dt.strftime('%H:%M')
            
            existing = await self.db.appointments.find_one({
                '$or': [
                    {'date': date_str, 'time': {'$regex': f'^{time_str}'}},
                    {'scheduled_at': {'$regex': f'^{date_str}T{time_str}'}}
                ],
                'status': {'$nin': ['cancelled', 'rejected', 'no_show']}
            })
            
            if existing:
                return {
                    'success': False,
                    'message': f"⚠️ Lo siento, ese horario ya está ocupado. Por favor elige otro horario.\n\nEscribe *agendar* para ver los horarios disponibles.",
                    'intent': 'appointment_conflict'
                }
            
            # Find or create user record
            user_id = client_info.get('id')
            if not user_id:
                # Check by phone or email
                existing_user = await self.db.users.find_one({
                    '$or': [
                        {'phone': phone},
                        {'email': client_info.get('email', '').lower()}
                    ]
                })
                if existing_user:
                    user_id = str(existing_user.get('_id'))
                else:
                    user_id = None
            
            # Create appointment in local MongoDB (circuito cerrado)
            import uuid
            appointment = {
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'client_name': client_info.get('name', ''),
                'client_email': client_info.get('email', ''),
                'client_phone': phone,
                'title': 'Consulta de Impuestos (WhatsApp)',
                'description': f"Cita agendada por WhatsApp - {client_info.get('name', phone)}",
                'date': date_str,
                'time': time_str,
                'scheduled_at': scheduled_dt.strftime('%Y-%m-%dT%H:%M:%S-06:00'),
                'duration_minutes': 30,
                'status': 'scheduled',
                'appointment_type': 'in_person',
                'booked_via': 'whatsapp',
                'phone_number': phone,
                'management_token': management_token,
                'created_at': datetime.utcnow(),
                'source': 'whatsapp'
            }
            
            await self.db.appointments.insert_one(appointment)
            logger.info(f"✅ Appointment created locally (circuito cerrado) for {phone}: {date_str} {time_str}")
            
            # Clear flow
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {'current_flow': None, 'flow_data': {}}}
            )
            
            # Update lead status
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {'lead_status': 'appointment_booked'}}
            )
            
            # Send SMS notification
            try:
                if self.notification_service and hasattr(self.notification_service, 'twilio_client'):
                    manage_url = f"https://www.rosstaxpreparation.com/mi-cita/{management_token}"
                    sms_msg = f"Ross Tax: ¡Cita confirmada! {selected.get('date_str', '')} a las {selected.get('time_str', '')}.\n\n📋 Gestiona tu cita: {manage_url}\n\n📞 (806) 934-2018"
                    
                    self.notification_service.twilio_client.messages.create(
                        body=sms_msg,
                        from_=self.notification_service.twilio_phone_number,
                        to=phone
                    )
                    logger.info(f"✅ SMS notification sent for WhatsApp appointment to {phone}")
            except Exception as sms_error:
                logger.error(f"❌ Error sending SMS notification: {sms_error}")
            
            # Create service order for this appointment
            try:
                import uuid as uuid_mod
                so_id = str(uuid_mod.uuid4())
                service_order = {
                    '_id': so_id,
                    'order_number': f"ORD-{datetime.now().strftime('%Y%m')}-{str(uuid_mod.uuid4())[:8].upper()}",
                    'client_id': client_info.get('id') if client_info else None,
                    'client_name': client_info.get('name', contact_name) if client_info else contact_name,
                    'client_email': client_info.get('email', '') if client_info else '',
                    'client_phone': phone,
                    'service_type': 'tax_preparation',
                    'description': 'Declaración de Impuestos',
                    'tax_year': datetime.now().year,
                    'status': 'pending',
                    'priority': 'medium',
                    'estimated_amount': 0,
                    'notes': '',
                    'appointment_id': appointment['id'],
                    'appointment_date': appointment.get('scheduled_at'),
                    'source': 'whatsapp_appointment',
                    'created_by': 'whatsapp_bot',
                    'created_by_name': 'WhatsApp Bot',
                    'documents': [],
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc),
                }
                await self.db.service_orders.insert_one(service_order)
                logger.info(f"✅ Service order {so_id} created from WhatsApp appointment for {phone}")
            except Exception as so_err:
                logger.warning(f"Could not create service order from WhatsApp appointment: {so_err}")
            
            success_msg = f"""🎉 *¡Cita Confirmada!*

📅 Fecha: {selected.get('date_str', 'Por confirmar')}
⏰ Hora: {selected.get('time_str', 'Por confirmar')}
📍 Lugar: 305 Bruce Ave, Dumas, TX 79029

📋 *Documentos que necesitas traer:*
• 📄 W-2 (Comprobante de salario de cada empleo)
• 📄 1099 (Si tienes ingresos independientes)
• 🪪 Identificación con foto (Licencia/ID/Pasaporte)
• 🔢 Tarjeta de Seguro Social (SSN) o ITIN
• 🏦 Comprobante de cuenta bancaria (para depósito directo)
• 👶 SSN y fecha de nacimiento de dependientes (si aplica)
• 🧾 Recibos de gastos deducibles (médicos, educación, etc.)

📲 *Puedes enviar tus documentos aquí por WhatsApp* para que los tengamos listos antes de tu cita.

📱 Te enviamos un SMS con el link para gestionar tu cita.
Te enviaremos un recordatorio 24 horas antes.

¿Necesitas algo más?"""
            
            return {'success': True, 'message': success_msg, 'intent': 'appointment_created', 'appointment_id': appointment['id']}
            
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            return {
                'success': False,
                'message': "Hubo un problema al agendar. Por favor intenta de nuevo o llámanos al (806) 934-2018",
                'intent': 'appointment_error'
            }
    
    async def _handle_slot_offer_acceptance(self, phone: str, client_info: Dict) -> Dict:
        """Handle when client accepts a freed slot offer - with cascade effect"""
        try:
            # Find the pending slot offer for this phone
            offer = await self.db.slot_offers.find_one({
                'offered_to_phone': phone,
                'status': 'pending'
            }, sort=[('created_at', -1)])
            
            if not offer:
                return {
                    'success': True,
                    'message': "No encontré una oferta de adelanto de cita pendiente para ti. ¿Te gustaría agendar una nueva cita? Escribe *agendar*.",
                    'intent': 'no_offer_found'
                }
            
            # Get client's current appointment
            current_apt = await self.db.appointments.find_one({
                '_id': ObjectId(offer['current_appointment_id']) if ObjectId.is_valid(offer['current_appointment_id']) else offer['current_appointment_id']
            })
            
            if not current_apt:
                # Try by string id
                current_apt = await self.db.appointments.find_one({'id': offer['current_appointment_id']})
            
            if not current_apt:
                return {
                    'success': True,
                    'message': "No pude encontrar tu cita actual. Por favor contacta a nuestro equipo al (806) 934-2018.",
                    'intent': 'appointment_not_found'
                }
            
            # Save the client's ORIGINAL slot before moving (this will be offered to others)
            original_slot = current_apt.get('scheduled_at')
            original_client_name = current_apt.get('client_name', 'Cliente')
            
            # Update the appointment to the freed slot
            freed_slot = offer['freed_slot']
            
            await self.db.appointments.update_one(
                {'_id': current_apt['_id']},
                {'$set': {
                    'scheduled_at': freed_slot,
                    'rescheduled_from_offer': True,
                    'rescheduled_at': datetime.utcnow(),
                    'previous_scheduled_at': original_slot
                }}
            )
            
            # Update offer status
            await self.db.slot_offers.update_one(
                {'_id': offer['_id']},
                {'$set': {'status': 'accepted', 'accepted_at': datetime.utcnow()}}
            )
            
            # Format the new date
            if isinstance(freed_slot, datetime):
                date_str = freed_slot.strftime('%A %d de %B')
                time_str = freed_slot.strftime('%I:%M %p')
            else:
                date_str = str(freed_slot)
                time_str = ""
            
            # Send SMS confirmation
            try:
                if self.notification_service and hasattr(self.notification_service, 'twilio_client'):
                    sms_msg = f"Ross Tax: ¡Tu cita ha sido adelantada! Nueva fecha: {date_str} a las {time_str}. 📍 305 Bruce Ave, Dumas, TX. 📞 (806) 934-2018"
                    self.notification_service.twilio_client.messages.create(
                        body=sms_msg,
                        from_=self.notification_service.twilio_phone_number,
                        to=phone
                    )
            except Exception as sms_err:
                logger.error(f"Error sending slot acceptance SMS: {sms_err}")
            
            # 🔄 CASCADE EFFECT: Offer the client's ORIGINAL slot to other clients
            if original_slot:
                logger.info(f"🔄 Cascade: Offering freed slot from {original_client_name} to other clients")
                await self._offer_freed_slot_cascade(original_slot, str(current_apt['_id']), phone)
            
            return {
                'success': True,
                'message': f"""🎉 *¡Cita Adelantada con Éxito!*

Tu cita ha sido movida a:
📅 *Fecha:* {date_str}
⏰ *Hora:* {time_str}
📍 *Lugar:* 305 Bruce Ave, Dumas, TX 79029

Te enviamos un SMS de confirmación.

¿Necesitas algo más?""",
                'intent': 'slot_offer_accepted'
            }
            
        except Exception as e:
            logger.error(f"Error handling slot offer acceptance: {e}")
            return {
                'success': False,
                'message': "Hubo un problema al adelantar tu cita. Por favor llámanos al (806) 934-2018.",
                'intent': 'slot_offer_error'
            }
    
    async def _offer_freed_slot_cascade(self, freed_slot: datetime, excluded_apt_id: str, excluded_phone: str):
        """
        Cascade effect: When a client moves their appointment, offer their original slot to others.
        This creates a chain reaction where slots keep getting offered as they free up.
        """
        try:
            from whatsapp_service import WhatsAppService
            
            wa_service = WhatsAppService(self.db)
            if not wa_service.phone_number_id:
                logger.warning("WhatsApp not configured for cascade slot offer")
                return
            
            # Find clients with appointments AFTER this freed slot (excluding the one who just moved)
            later_appointments = await self.db.appointments.find({
                'scheduled_at': {'$gt': freed_slot},
                'status': {'$in': ['scheduled', 'confirmed']},
                'client_phone': {'$exists': True, '$ne': None},
                '_id': {'$ne': ObjectId(excluded_apt_id) if ObjectId.is_valid(excluded_apt_id) else excluded_apt_id}
            }).sort('scheduled_at', 1).limit(5).to_list(5)
            
            # Filter out the phone that just accepted
            later_appointments = [apt for apt in later_appointments if apt.get('client_phone') != excluded_phone]
            
            if not later_appointments:
                logger.info("No more clients to offer the cascade slot")
                return
            
            # Format the freed slot
            if isinstance(freed_slot, datetime):
                date_str = freed_slot.strftime('%A %d de %B')
                time_str = freed_slot.strftime('%I:%M %p')
            else:
                date_str = str(freed_slot)
                time_str = ""
            
            # Offer to each client
            for apt in later_appointments:
                client_phone = apt.get('client_phone') or apt.get('phone_number')
                if not client_phone:
                    continue
                
                client_name = apt.get('client_name', 'Cliente')
                
                offer_message = f"""🎉 *¡Nueva Oportunidad!*

Hola {client_name},

Acaba de liberarse otro espacio más temprano:

📅 *Fecha disponible:* {date_str}
⏰ *Hora:* {time_str}
📍 305 Bruce Ave, Dumas, TX

¿Te gustaría adelantar tu cita a este horario?

Responde *SÍ ADELANTAR* para confirmar.

_Ross Tax Preparation_"""
                
                try:
                    await wa_service.send_message(client_phone, offer_message)
                    logger.info(f"✅ Cascade slot offer sent to {client_phone}")
                    
                    # Log the offer
                    await self.db.slot_offers.insert_one({
                        'original_appointment_id': excluded_apt_id,
                        'freed_slot': freed_slot,
                        'offered_to_phone': client_phone,
                        'offered_to_name': client_name,
                        'current_appointment_id': str(apt.get('_id')),
                        'status': 'pending',
                        'is_cascade': True,
                        'created_at': datetime.utcnow()
                    })
                except Exception as msg_error:
                    logger.error(f"Error sending cascade slot offer to {client_phone}: {msg_error}")
                    
        except Exception as e:
            logger.error(f"Error in cascade slot offer: {e}")
    
    async def _get_available_slots(self) -> List[Dict]:
        """Get available appointment slots from the REAL local system (circuito cerrado).
        
        Uses the same availability logic as /api/public/available-slots:
        - Office hours configuration
        - Blocked days/slots
        - Existing appointments in MongoDB
        - Calendar pause status
        """
        import aiohttp
        
        today = datetime.now()
        slots = []
        day_names_map = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        
        for i in range(1, 8):  # Next 7 days
            day = today + timedelta(days=i)
            date_str = day.strftime('%Y-%m-%d')
            
            try:
                # Call the local availability API (same as web uses)
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"http://localhost:8001/api/public/available-slots?date={date_str}",
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status == 200:
                            day_slots_raw = await resp.json()
                            # Filter only available slots
                            available_times = [
                                s.get('time', '') for s in day_slots_raw 
                                if s.get('available', False)
                            ]
                            
                            if available_times:
                                # Format times for display (HH:MM → H:MM AM/PM)
                                formatted_times = []
                                for t in available_times:
                                    try:
                                        h, m = map(int, t.split(':'))
                                        period = 'AM' if h < 12 else 'PM'
                                        display_h = h if h <= 12 else h - 12
                                        if display_h == 0:
                                            display_h = 12
                                        formatted_times.append(f"{display_h}:{m:02d} {period}")
                                    except:
                                        formatted_times.append(t)
                                
                                slots.append({
                                    'date': day.strftime('%d/%m'),
                                    'date_iso': date_str,
                                    'day_name': day_names_map[day.weekday()],
                                    'datetime': day,
                                    'slots': formatted_times
                                })
            except Exception as e:
                logger.warning(f"⚠️ Error fetching slots for {date_str}: {e}")
                continue
        
        return slots
    
    def _parse_appointment_time(self, message: str) -> Optional[Dict]:
        """Parse appointment time from user message"""
        message_lower = message.lower()
        
        # Simple parsing - in production use NLP
        days_map = {
            'lunes': 0, 'martes': 1, 'miercoles': 2, 'miércoles': 2,
            'jueves': 3, 'viernes': 4, 'sabado': 5, 'sábado': 5
        }
        
        found_day = None
        for day_name, day_num in days_map.items():
            if day_name in message_lower:
                found_day = day_num
                break
        
        # Extract time
        time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', message_lower)
        if time_match and found_day is not None:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or 0)
            period = time_match.group(3) or 'am'
            
            if period == 'pm' and hour < 12:
                hour += 12
            
            # Calculate the date
            today = datetime.now()
            days_ahead = found_day - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            
            target_date = today + timedelta(days=days_ahead)
            target_datetime = target_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
            
            return {
                'datetime': target_datetime,
                'date_str': f"{day_names[found_day]} {target_date.strftime('%d de %B')}",
                'time_str': f"{time_match.group(1)}:{minute:02d} {period.upper()}"
            }
        
        return None
    
    # ==================== SERVICES FLOW ====================
    
    async def _start_services_flow(self, phone: str, conversation: Dict) -> Dict:
        """Start services/pricing flow - Now fetches from database"""
        try:
            # Fetch services from database
            services = await self.db.dynamic_services.find({
                'active': True,
                'visible_in_app': True
            }).sort('order_index', 1).to_list(100)
            
            if not services:
                # Fallback if no services found
                return {
                    'success': True,
                    'message': "No hay servicios disponibles en este momento. Por favor llámanos al (806) 934-2018.",
                    'intent': 'services_empty'
                }
            
            services_msg = """💼 *Nuestros Servicios:*\n\n"""
            
            for i, service in enumerate(services, 1):
                price = service.get('price', 0)
                price_str = f"${price:,.0f}" if price > 0 else "GRATIS"
                name = service.get('name', 'Servicio')
                description = service.get('short_description') or service.get('description', '')[:50] + '...'
                services_msg += f"{i}️⃣ *{name}*\n   {description}\n   💰 {price_str}\n\n"
            
            services_msg += "\n¿Te interesa algún servicio? Responde con el número."
            
            # Store services list for selection
            services_data = [{'id': str(s.get('_id', '')), 'name': s.get('name'), 'price': s.get('price', 0)} for s in services]
            
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'current_flow': 'services', 
                    'flow_data': {'step': 'select_service', 'services_list': services_data}
                }}
            )
            
            return {'success': True, 'message': services_msg, 'intent': 'services_list'}
            
        except Exception as e:
            logger.error(f"Error starting services flow: {e}")
            return {
                'success': True,
                'message': "Hubo un problema al cargar los servicios. Por favor llámanos al (806) 934-2018.",
                'intent': 'services_error'
            }
    
    async def _continue_services_flow(self, phone: str, message: str, conversation: Dict, client_info: Dict) -> Dict:
        """Continue services selection flow - Now uses dynamic services from database"""
        flow_data = conversation.get('flow_data', {})
        services_list = flow_data.get('services_list', [])
        
        try:
            selection = int(message.strip()) - 1
            
            if services_list and 0 <= selection < len(services_list):
                # Get service data from flow_data (stored during start)
                selected_service_ref = services_list[selection]
                
                # Fetch full service details from database
                from bson import ObjectId
                service_id = selected_service_ref.get('id', '')
                service = await self.db.dynamic_services.find_one({
                    '_id': ObjectId(service_id) if ObjectId.is_valid(service_id) else None
                })
                
                if not service:
                    service = await self.db.dynamic_services.find_one({'name': selected_service_ref.get('name')})
                
                if not service:
                    return {
                        'success': True,
                        'message': "No pude encontrar ese servicio. Por favor intenta de nuevo.",
                        'intent': 'service_not_found'
                    }
                
                # If it's a free consultation, redirect to appointment
                if service.get('price', 0) == 0:
                    await self.db.whatsapp_conversations.update_one(
                        {'phone_number': phone},
                        {'$set': {'current_flow': None, 'flow_data': {}}}
                    )
                    return await self._start_appointment_flow(phone, conversation, client_info)
                
                # Show service details and offer to book
                price = service.get('price', 0)
                price_str = f"${price:,.0f}" if price > 0 else "GRATIS"
                description = service.get('description', 'Sin descripción')
                
                detail_msg = f"""📋 *{service.get('name', 'Servicio')}*

{description}

💰 Precio: {price_str}

¿Te gustaría contratar este servicio?
Responde *SÍ* para agendar una cita y comenzar."""
                
                # Store selected service for confirmation step
                service_data = {
                    'id': str(service.get('_id', '')),
                    'name': service.get('name'),
                    'price': price,
                    'description': description
                }
                
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {
                        'flow_data.selected_service': service_data,
                        'flow_data.step': 'confirm_service'
                    }}
                )
                
                return {'success': True, 'message': detail_msg, 'intent': 'service_detail'}
        except ValueError:
            pass
        except Exception as e:
            logger.error(f"Error in services flow: {e}")
        
        # Check for confirmation
        if message.lower() in ['si', 'sí', 'yes']:
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {'current_flow': None}}
            )
            return await self._start_appointment_flow(phone, conversation, client_info)
        
        # Invalid selection
        num_services = len(services_list) if services_list else 4
        return {
            'success': True,
            'message': f"Por favor responde con un número del 1 al {num_services} para seleccionar un servicio.",
            'intent': 'services_retry'
        }
    
    # ==================== STATUS CHECK ====================
    
    async def _handle_status_check(self, phone: str, client_info: Dict) -> Dict:
        """Handle status check for clients"""
        if not client_info:
            return {
                'success': True,
                'message': """No encontré tu información en el sistema. 🔍

Si ya eres cliente, por favor:
1. Verifica que el número de teléfono sea el mismo que registraste
2. O ingresa a la app con tu cuenta

Si eres nuevo, responde *CITA* para agendar una consulta gratuita.""",
                'intent': 'status_not_found'
            }
        
        # Get client's recent activity
        user_id = client_info.get('id')
        
        # Check appointments
        appointments = await self.db.appointments.find({
            'user_id': user_id,
            'status': {'$ne': 'cancelled'}
        }).sort('scheduled_at', -1).limit(1).to_list(1)
        
        # Check tax returns
        tax_returns = await self.db.completed_tax_returns.find({
            'user_id': user_id
        }).sort('created_at', -1).limit(1).to_list(1)
        
        # Check invoices
        invoices = await self.db.invoices.find({
            'user_id': user_id,
            'status': {'$ne': 'paid'}
        }).to_list(5)
        
        status_msg = f"""📊 *Status de {client_info.get('name', 'tu cuenta')}:*\n\n"""
        
        if appointments:
            appt = appointments[0]
            appt_date = appt.get('scheduled_at', datetime.utcnow())
            status_msg += f"📅 *Próxima Cita:*\n   {appt_date.strftime('%d/%m/%Y %I:%M %p')}\n   Status: {appt.get('status', 'pendiente')}\n\n"
        
        if tax_returns:
            tr = tax_returns[0]
            status_msg += f"📝 *Última Declaración ({tr.get('tax_year', 'N/A')}):*\n   Status: Completada ✅\n"
            if tr.get('refund_amount'):
                status_msg += f"   Reembolso: ${tr.get('refund_amount'):,.2f}\n\n"
        
        if invoices:
            pending_total = sum(inv.get('total', 0) for inv in invoices)
            status_msg += f"💳 *Facturas Pendientes:* {len(invoices)}\n   Total: ${pending_total:,.2f}\n\n"
        
        status_msg += "\n¿Necesitas más información? Responde con tu pregunta."
        
        return {'success': True, 'message': status_msg, 'intent': 'status_found'}
    
    # ==================== HUMAN AGENT ====================
    
    async def _request_human_agent(self, phone: str) -> Dict:
        """Request human agent"""
        # Mark conversation for human follow-up
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {
                'needs_human': True,
                'human_requested_at': datetime.utcnow(),
                'current_flow': None
            }}
        )
        
        # Notify admin (in production, send push/SMS to admin)
        try:
            admin = await self.db.users.find_one({'role': 'admin'})
            if admin and admin.get('expo_push_token'):
                # Would send push notification here
                pass
        except:
            pass
        
        return {
            'success': True,
            'message': """👤 Entendido, un asesor te contactará pronto.

Mientras tanto, puedes:
📞 Llamarnos: (806) 922-2318
📧 Email: info@rosstaxpreparation.com

Nuestro horario: Lun-Vie 9AM-6PM

¡Gracias por tu paciencia!""",
            'intent': 'human_requested'
        }
    
    # ==================== ACCOUNT CREATION FLOW ====================
    
    async def _start_account_creation_flow(self, phone: str, conversation: Dict) -> Dict:
        """Start the account creation flow for new users"""
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {
                'current_flow': 'account_creation',
                'flow_data': {'step': 'ask_name'}
            }}
        )
        
        return {
            'success': True,
            'message': """📱 *Crear Cuenta en Ross Tax*

¡Excelente! Vamos a crear tu cuenta para que puedas:
✅ Ver el estado de tus impuestos
✅ Subir documentos fácilmente
✅ Agendar citas
✅ Recibir notificaciones

Para comenzar, *¿cuál es tu nombre completo?*""",
            'intent': 'account_creation_start'
        }
    
    async def _continue_account_creation(self, phone: str, message: str, conversation: Dict) -> Dict:
        """Continue the account creation flow"""
        flow_data = conversation.get('flow_data', {})
        step = flow_data.get('step', 'ask_name')
        
        if step == 'ask_name':
            # Save name and ask for email
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'user_name': message,
                    'flow_data.name': message,
                    'flow_data.step': 'ask_email'
                }}
            )
            
            first_name = message.split()[0]
            return {
                'success': True,
                'message': f"""¡Mucho gusto {first_name}! 👋

Ahora, *¿cuál es tu correo electrónico?*

📧 Lo usaremos para:
• Enviarte confirmaciones
• Recuperar tu cuenta
• Notificaciones importantes

(Escribe tu email o "saltar" si prefieres agregarlo después)""",
                'intent': 'account_ask_email'
            }
        
        elif step == 'ask_email':
            email = None
            if message.lower() not in ['saltar', 'skip', 'no', 'despues', 'después']:
                # Validate email format
                if '@' in message and '.' in message:
                    email = message.strip().lower()
                else:
                    return {
                        'success': True,
                        'message': """❌ Ese email no parece válido.

Por favor, escribe un email válido (ejemplo: tucorreo@gmail.com)

O escribe "saltar" para continuar sin email.""",
                        'intent': 'account_invalid_email'
                    }
            
            # Create the account
            name = flow_data.get('name', 'Cliente')
            new_account = await self._create_client_account(phone, name, email)
            
            if new_account:
                # Clear flow
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {
                        '$set': {
                            'current_flow': None,
                            'flow_data': {},
                            'is_registered_client': True,
                            'client_id': new_account['id'],
                            'is_lead': False
                        }
                    }
                )
                
                temp_password = new_account.get('temp_password', '')
                first_name = name.split()[0]
                
                return {
                    'success': True,
                    'message': f"""🎉 *¡Cuenta Creada Exitosamente!*

¡Bienvenido a Ross Tax, {first_name}!

📱 *Descarga nuestra app:*
{IOS_APP_LINK}

🔐 *Tus credenciales:*
• Teléfono: {phone}
• Contraseña temporal: {temp_password}

⚠️ *Importante:* Cambia tu contraseña después de iniciar sesión.

¿Qué te gustaría hacer ahora?

1️⃣ Agendar una cita
2️⃣ Ver precios
3️⃣ Subir documentos
5️⃣ Hablar con asesor""",
                    'intent': 'account_created'
                }
            else:
                return {
                    'success': True,
                    'message': """❌ Hubo un problema creando tu cuenta.

Por favor, intenta de nuevo más tarde o contacta a un asesor.

📞 (806) 922-2318""",
                    'intent': 'account_creation_error'
                }
        
        return self._get_main_menu(None)
    
    # ==================== LEAD CAPTURE ====================
    
    async def _continue_lead_capture(self, phone: str, message: str, conversation: Dict) -> Dict:
        """Continue lead capture flow - Enhanced with automatic account creation"""
        flow_data = conversation.get('flow_data', {})
        step = flow_data.get('step')
        
        if step == 'ask_name':
            # Save name and ask for email
            name = message.strip()
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'user_name': name,
                    'flow_data.name': name,
                    'flow_data.step': 'ask_email'
                }}
            )
            first_name = name.split()[0] if name else 'amigo'
            return {
                'success': True,
                'message': f"¡Mucho gusto {first_name}! 😊\n\n📧 ¿Cuál es tu correo electrónico?\n\n_(Lo usaremos para enviarte información importante sobre tu caso)_",
                'intent': 'lead_ask_email'
            }
        
        elif step == 'ask_email':
            # Validate email
            import re
            email = message.strip().lower()
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            
            if not re.match(email_pattern, email):
                return {
                    'success': True,
                    'message': "🤔 Hmm, ese correo no parece válido.\n\nPor favor, escríbelo de nuevo.\n\n_Ejemplo: tunombre@gmail.com_",
                    'intent': 'lead_invalid_email'
                }
            
            # Check if email already exists
            existing_user = await self.db.users.find_one({'email': email})
            if existing_user:
                # Link phone to existing account
                await self.db.users.update_one(
                    {'email': email},
                    {'$set': {'phone': phone, 'phone_verified': True}}
                )
                await self.db.whatsapp_conversations.update_one(
                    {'phone_number': phone},
                    {'$set': {'current_flow': None, 'flow_data': {}}}
                )
                return {
                    'success': True,
                    'message': f"✅ ¡Encontré tu cuenta existente!\n\nYa vinculé tu WhatsApp a tu cuenta de {existing_user.get('full_name', 'cliente')}.\n\nAhora podrás recibir notificaciones y actualizaciones aquí. 📱\n\n¿En qué te puedo ayudar hoy?",
                    'intent': 'lead_existing_account'
                }
            
            # Save email and ask for service interest
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'flow_data.email': email,
                    'flow_data.step': 'ask_service'
                }}
            )
            
            name = flow_data.get('name', 'Cliente')
            first_name = name.split()[0] if name else 'amigo'
            
            return {
                'success': True,
                'message': f"¡Perfecto {first_name}! 📧✅\n\n¿Qué servicio te interesa?\n\n1️⃣ Declaración de impuestos 📋\n2️⃣ Trámite de ITIN 🆔\n3️⃣ Impuestos de negocio 💼\n4️⃣ Consulta general 💬\n5️⃣ Solo ver precios 💰\n\n_Responde con el número_",
                'intent': 'lead_ask_service'
            }
        
        elif step == 'ask_service':
            # Map response to service
            service_map = {
                '1': 'tax_individual',
                '2': 'itin',
                '3': 'tax_business',
                '4': 'consultation',
                '5': 'pricing_info',
                'impuestos': 'tax_individual',
                'taxes': 'tax_individual',
                'itin': 'itin',
                'negocio': 'tax_business',
                'business': 'tax_business',
                'consulta': 'consultation',
                'precios': 'pricing_info'
            }
            
            message_lower = message.lower().strip()
            service = service_map.get(message_lower) or service_map.get(message_lower[0] if message_lower else '4')
            
            if not service:
                service = 'consultation'
            
            # Now CREATE the account automatically
            name = flow_data.get('name', 'Cliente WhatsApp')
            email = flow_data.get('email', f'{phone}@whatsapp.temp')
            
            # Generate a temporary password
            import secrets
            import string
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            
            # Hash the password
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_password = pwd_context.hash(temp_password)
            
            # Create user account
            new_user = {
                'email': email,
                'password': hashed_password,
                'full_name': name,
                'phone': phone,
                'phone_verified': True,
                'role': 'client',
                'status': 'active',
                'source': 'whatsapp_lead',
                'interested_service': service,
                'created_at': datetime.utcnow(),
                'created_via': 'whatsapp_bot'
            }
            
            result = await self.db.users.insert_one(new_user)
            user_id = str(result.inserted_id)
            
            # Create lead record
            await self.db.leads.insert_one({
                'user_id': user_id,
                'name': name,
                'email': email,
                'phone': phone,
                'service_interest': service,
                'source': 'whatsapp',
                'status': 'new',
                'created_at': datetime.utcnow()
            })
            
            # Clear flow
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone},
                {'$set': {
                    'current_flow': None,
                    'flow_data': {},
                    'user_id': user_id,
                    'is_registered_client': True
                }}
            )
            
            first_name = name.split()[0] if name else 'amigo'
            
            # Service-specific response
            service_responses = {
                'tax_individual': f"""🎉 *¡Listo {first_name}, ya tienes cuenta!*

Tu cuenta ha sido creada automáticamente. ✅

📋 *Interés:* Declaración de impuestos
💰 *Precio:* $180

*¿Quieres agendar tu cita?*
Escribe *"agendar"* y te ayudo.

También puedes acceder a tu cuenta en nuestra app:
📱 rosstaxpreparation.com/login
📧 Usuario: {email}
🔑 Contraseña: {temp_password}

_(Guarda tu contraseña o cámbiala después)_""",

                'itin': f"""🎉 *¡Listo {first_name}, ya tienes cuenta!*

Tu cuenta ha sido creada. ✅

🆔 *Interés:* Trámite de ITIN
💰 *Precio:* $75

*Documentos que necesitas:*
• Pasaporte vigente
• Declaración de impuestos

Escribe *"agendar"* para tu cita.

📱 Tu acceso: {email} / {temp_password}""",

                'tax_business': f"""🎉 *¡Listo {first_name}, ya tienes cuenta!*

Tu cuenta ha sido creada. ✅

💼 *Interés:* Impuestos de negocio
💰 *Precio desde:* $200

Te ayudamos con Schedule C, LLC, y más.

Escribe *"agendar"* para tu consulta.

📱 Tu acceso: {email} / {temp_password}""",

                'pricing_info': f"""🎉 *¡Listo {first_name}, ya tienes cuenta!*

Aquí tienes nuestros precios:

💰 *PRECIOS:*
• Individual: $180
• Con negocio: $200
• ITIN: $75
• Consulta: GRATIS

Escribe *"agendar"* cuando estés listo.

📱 Tu acceso: {email} / {temp_password}"""
            }
            
            response_msg = service_responses.get(service, service_responses['tax_individual'])
            
            # Notify admin about new lead
            await self.db.admin_notifications.insert_one({
                'type': 'new_lead',
                'title': '🆕 Nuevo Lead desde WhatsApp',
                'message': f"Nombre: {name}\nEmail: {email}\nTel: {phone}\nServicio: {service}",
                'user_id': user_id,
                'read': False,
                'created_at': datetime.utcnow()
            })
            
            return {
                'success': True,
                'message': response_msg,
                'intent': 'lead_converted',
                'user_id': user_id,
                'account_created': True
            }
        
        return self._get_main_menu(None)
    
    # ==================== DOCUMENT UPLOAD FLOW ====================
    
    async def _start_document_upload_flow(self, phone: str, conversation: Dict, client_info: Dict) -> Dict:
        """Start the document upload flow"""
        client_name = client_info.get('first_name', '') if client_info else ''
        greeting = f"¡Hola {client_name}! " if client_name else ""
        
        # Set conversation state
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {
                'current_flow': 'document_upload',
                'flow_data': {'step': 'waiting_document', 'type': 'fiscal'},
                'flow_started_at': datetime.utcnow()
            }}
        )
        
        return {
            'success': True,
            'message': f"""{greeting}📄 *Envío de Documentos Fiscales*

Puedes enviarme fotos o archivos de tus documentos. Acepto:

📋 *Documentos que puedes enviar:*
• W-2 (Comprobante de salario)
• 1099 (Ingresos varios)
• 1095-A (Seguro médico)
• Identificación (ID/Licencia)
• SSN/ITIN
• Otros documentos fiscales

📸 *Envía tu documento ahora* - puedes enviar varios a la vez.

💡 _Escribe "listo" cuando termines o "cancelar" para volver al menú._""",
            'intent': 'document_upload_started'
        }
    
    # ==================== EXPENSE RECEIPT FLOW ====================
    
    async def _start_expense_receipt_flow(self, phone: str, conversation: Dict, client_info: Dict) -> Dict:
        """Start the expense receipt upload flow"""
        client_name = client_info.get('first_name', '') if client_info else ''
        greeting = f"¡Hola {client_name}! " if client_name else ""
        
        # Set conversation state for expense receipts
        await self.db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$set': {
                'current_flow': 'expense_receipt',
                'flow_data': {'step': 'waiting_receipt', 'receipts_received': 0},
                'flow_started_at': datetime.utcnow()
            }}
        )
        
        return {
            'success': True,
            'message': f"""{greeting}🧾 *Envío de Recibos de Gastos*

Puedes enviarme fotos de tus recibos de gastos deducibles. Nuestra IA los clasificará automáticamente.

📋 *Tipos de gastos aceptados:*
• 🏥 Gastos médicos
• 📚 Educación
• 🏠 Oficina en casa
• 🚗 Transporte/Gasolina
• 💼 Gastos de negocio
• 🛒 Suministros
• Y más...

📸 *Envía tus recibos ahora* - puedes enviar varios.

💡 _Escribe "listo" cuando termines o "cancelar" para volver al menú._""",
            'intent': 'expense_receipt_started'
        }
    
    async def _process_expense_receipt(self, phone: str, media_url: str, caption: str, client_info: Dict) -> Dict:
        """Process an expense receipt sent via WhatsApp - saves to expense_receipts with AI classification"""
        import base64
        import httpx
        import uuid
        
        client_name = client_info.get('first_name', 'Cliente') if client_info else 'Cliente'
        user_id = client_info.get('id') if client_info else None
        
        try:
            # Download the image
            async with httpx.AsyncClient() as client:
                response = await client.get(media_url)
                if response.status_code == 200:
                    image_data = base64.b64encode(response.content).decode('utf-8')
                else:
                    raise Exception(f"Failed to download image: {response.status_code}")
            
            # Create receipt record
            receipt_id = str(uuid.uuid4())
            receipt = {
                '_id': receipt_id,
                'user_id': user_id,
                'phone_number': phone,
                'source': 'whatsapp',
                'image': f"data:image/jpeg;base64,{image_data}",
                'original_filename': caption or 'whatsapp_receipt.jpg',
                'status': 'processing',
                'category': None,
                'merchant': None,
                'amount': None,
                'receipt_date': None,
                'ai_confidence': None,
                'ai_raw_response': None,
                'admin_notes': None,
                'reviewed_by': None,
                'reviewed_at': None,
                'created_at': datetime.utcnow(),
                'year': datetime.utcnow().year,
                'month': datetime.utcnow().month,
            }
            
            await self.db.expense_receipts.insert_one(receipt)
            logger.info(f"🧾 WhatsApp Receipt {receipt_id} created from {phone}")
            
            # Run AI classification
            ai_result = None
            ai_info = ""
            try:
                from receipt_ai_service import classify_receipt
                ai_result = await classify_receipt(f"data:image/jpeg;base64,{image_data}")
                
                if ai_result and ai_result.get('success'):
                    update_data = {
                        'status': 'classified',
                        'category': ai_result.get('category'),
                        'merchant': ai_result.get('merchant'),
                        'amount': ai_result.get('amount'),
                        'receipt_date': ai_result.get('receipt_date'),
                        'ai_confidence': ai_result.get('confidence'),
                        'ai_raw_response': ai_result.get('raw_response'),
                        'ai_classified_at': datetime.utcnow()
                    }
                    await self.db.expense_receipts.update_one(
                        {'_id': receipt_id},
                        {'$set': update_data}
                    )
                    
                    # Build AI info for response
                    cat = ai_result.get('category', 'General')
                    merchant = ai_result.get('merchant', '')
                    amt = ai_result.get('amount')
                    ai_info = f"\n\n🤖 *Clasificación AI:*\n"
                    ai_info += f"📁 Categoría: {cat}\n"
                    if merchant:
                        ai_info += f"🏪 Comercio: {merchant}\n"
                    if amt:
                        ai_info += f"💵 Monto: ${amt:.2f}"
                    
                    logger.info(f"✅ Receipt {receipt_id} classified: {cat} - ${amt}")
                else:
                    await self.db.expense_receipts.update_one(
                        {'_id': receipt_id},
                        {'$set': {'status': 'pending'}}
                    )
            except Exception as ai_error:
                logger.error(f"❌ AI classification error: {ai_error}")
                await self.db.expense_receipts.update_one(
                    {'_id': receipt_id},
                    {'$set': {'status': 'pending', 'ai_error': str(ai_error)}}
                )
            
            return {
                'success': True,
                'message': f"""🧾 *¡Recibo Recibido!*

¡Gracias {client_name}! Tu recibo ha sido guardado correctamente. ✅{ai_info}

📤 Puedes seguir enviando más recibos o escribe *"listo"* cuando termines.

💡 _Los recibos serán revisados por nuestro equipo._""",
                'intent': 'expense_receipt_received',
                'receipt_id': receipt_id
            }
            
        except Exception as e:
            logger.error(f"Error processing expense receipt: {e}")
            return {
                'success': True,
                'message': f"""⚠️ Hubo un problema al procesar el recibo.

Por favor, intenta enviarlo de nuevo o escribe *"asesor"* para hablar con alguien.

💡 _Asegúrate de que la imagen sea clara y legible._""",
                'intent': 'expense_receipt_error'
            }
    
    async def _continue_document_upload_flow(self, phone: str, message: str, conversation: Dict, client_info: Dict) -> Dict:
        """Continue the document upload flow"""
        message_lower = message.lower().strip()
        
        # Check if user wants to finish
        if message_lower in ['listo', 'termine', 'terminé', 'ya', 'ya termine', 'ya terminé', 'eso es todo']:
            await self._clear_flow(phone)
            return {
                'success': True,
                'message': """✅ *¡Listo!* Hemos recibido tus documentos.

Nuestro equipo los revisará pronto. Te notificaremos si necesitamos algo más.

¿En qué más puedo ayudarte?

1️⃣ 📅 Agendar cita
2️⃣ 💰 Ver precios
3️⃣ 🧾 Enviar recibo de gasto
4️⃣ ❓ Tengo una pregunta""",
                'intent': 'document_flow_completed'
            }
        
        # User is probably sending more documents, just confirm
        return {
            'success': True,
            'message': """📄 Recibido! Puedes seguir enviando más documentos.

💡 Escribe *"listo"* cuando termines de enviar todos tus documentos.""",
            'intent': 'document_flow_continue'
        }
    
    async def _continue_expense_receipt_flow(self, phone: str, message: str, conversation: Dict, client_info: Dict) -> Dict:
        """Continue the expense receipt flow"""
        message_lower = message.lower().strip()
        
        # Get receipts count
        flow_data = conversation.get('flow_data', {})
        receipts_count = flow_data.get('receipts_received', 0)
        
        # Check if user wants to finish
        if message_lower in ['listo', 'termine', 'terminé', 'ya', 'ya termine', 'ya terminé', 'eso es todo']:
            await self._clear_flow(phone)
            
            if receipts_count > 0:
                return {
                    'success': True,
                    'message': f"""✅ *¡Perfecto!* Hemos recibido {receipts_count} recibo{"s" if receipts_count > 1 else ""} de gasto.

📊 Los recibos fueron clasificados automáticamente y serán incluidos en tu declaración.

¿En qué más puedo ayudarte?

1️⃣ 📅 Agendar cita
2️⃣ 📄 Enviar documentos fiscales
3️⃣ 💰 Ver precios
4️⃣ ❓ Tengo una pregunta""",
                    'intent': 'expense_flow_completed'
                }
            else:
                return {
                    'success': True,
                    'message': """👍 ¡Entendido! Si necesitas enviar recibos más tarde, solo escribe "recibo".

¿En qué más puedo ayudarte?""",
                    'intent': 'expense_flow_cancelled'
                }
        
        # User is probably sending more receipts
        return {
            'success': True,
            'message': f"""🧾 ¡Entendido! {"Ya tenemos " + str(receipts_count) + " recibo" + ("s" if receipts_count > 1 else "") + ". " if receipts_count > 0 else ""}Puedes seguir enviando más fotos de recibos.

💡 Escribe *"listo"* cuando termines.""",
            'intent': 'expense_flow_continue'
        }
    
    # ==================== DOCUMENT HANDLING ====================
    
    async def _handle_document_received(self, phone: str, message: str, client_info: Dict) -> Dict:
        """Handle when a client sends a document/image via WhatsApp"""
        client_name = client_info.get('first_name', 'Cliente') if client_info else 'Cliente'
        
        # Log the document receipt
        await self.db.whatsapp_documents.insert_one({
            'phone_number': phone,
            'client_id': client_info.get('id') if client_info else None,
            'received_at': datetime.utcnow(),
            'status': 'pending_review',
            'type': 'unknown',
            'notes': message
        })
        
        response_msg = f"""📄 *¡Documento Recibido!*

¡Gracias {client_name}! He recibido tu documento. 👍

📋 *Estado:* En revisión
⏱️ Lo revisaremos pronto.

*¿Qué tipo de documento es?*
1️⃣ W-2
2️⃣ 1099
3️⃣ Identificación
4️⃣ SSN/ITIN
5️⃣ Otro

¡Envíame más si tienes! 📎"""
        
        return {'success': True, 'message': response_msg, 'intent': 'document_received'}
    
    async def _handle_payment_mention(self, phone: str, message: str, client_info: Dict) -> Dict:
        """Handle when client mentions they made a payment"""
        client_name = client_info.get('first_name', 'Cliente') if client_info else 'Cliente'
        
        import re
        amount_match = re.search(r'\$?(\d+(?:\.\d{2})?)', message)
        amount = float(amount_match.group(1)) if amount_match else None
        
        method = 'desconocido'
        if 'zelle' in message.lower():
            method = 'Zelle'
        elif 'tarjeta' in message.lower():
            method = 'Tarjeta'
        elif 'efectivo' in message.lower():
            method = 'Efectivo'
        
        payment_record = {
            'phone_number': phone,
            'client_id': client_info.get('id') if client_info else None,
            'amount': amount,
            'method': method,
            'status': 'pending_verification',
            'reported_at': datetime.utcnow()
        }
        result = await self.db.pending_payments.insert_one(payment_record)
        
        amount_text = f" de *${amount:.2f}*" if amount else ""
        
        response_msg = f"""💰 *¡Pago Registrado!*

Gracias {client_name}, tu pago{amount_text} por {method} está en verificación. ✅

🔍 Te confirmaremos pronto.

¿Tienes comprobante? Envíalo aquí 📸"""
        
        return {'success': True, 'message': response_msg, 'intent': 'payment_reported'}
    
    async def send_invoice_via_whatsapp(self, phone: str, invoice_data: Dict) -> Dict:
        """Send a formatted invoice via WhatsApp"""
        try:
            invoice_msg = f"""📄 *FACTURA #{invoice_data.get('invoice_number', 'N/A')}*
━━━━━━━━━━━━━━━━━━━━

👤 *Cliente:* {invoice_data.get('client_name', 'Cliente')}
📅 *Fecha:* {invoice_data.get('date', datetime.now().strftime('%d/%m/%Y'))}
📋 *Servicio:* {invoice_data.get('service', 'Servicio de impuestos')}

💰 *Total:* ${invoice_data.get('amount', 0):.2f}

━━━━━━━━━━━━━━━━━━━━
*Formas de Pago:*

💳 *Tarjeta:* {invoice_data.get('payment_link', 'Solicitar enlace')}
💵 *Zelle:* ross@rosstaxpreparation.com
💸 *Efectivo:* En oficina

━━━━━━━━━━━━━━━━━━━━
Ross Tax Preparation LLC
📞 (806) 934-2018"""

            result = await self.whatsapp_service.send_message(phone, invoice_msg)
            
            await self.db.whatsapp_invoices_sent.insert_one({
                'phone_number': phone,
                'invoice_number': invoice_data.get('invoice_number'),
                'amount': invoice_data.get('amount'),
                'sent_at': datetime.utcnow()
            })
            
            return {'success': True, 'message': 'Factura enviada', 'message_id': result.get('message_id')}
        except Exception as e:
            logger.error(f"Error sending invoice: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_birthday_greeting(self, phone: str, client_name: str, discount_code: str = None) -> Dict:
        """Send personalized birthday greeting"""
        try:
            current_year = datetime.now().year
            discount_code = discount_code or f"CUMPLE{current_year}"
            
            birthday_msg = f"""🎂🎉 *¡FELIZ CUMPLEAÑOS {client_name.upper()}!* 🎉🎂

¡Hoy es tu día especial! 🥳

🎁 *REGALO PARA TI:*
Código *{discount_code}* = *15% DESCUENTO*
en tu próximo servicio (30 días)

¡Gracias por ser parte de nuestra familia! 💙

- El equipo de Ross Tax 🌟"""

            result = await self.whatsapp_service.send_message(phone, birthday_msg)
            
            await self.db.birthday_greetings_sent.insert_one({
                'phone_number': phone,
                'client_name': client_name,
                'discount_code': discount_code,
                'sent_at': datetime.utcnow(),
                'year': current_year
            })
            
            return {'success': True, 'message': 'Felicitación enviada', 'discount_code': discount_code}
        except Exception as e:
            logger.error(f"Error sending birthday greeting: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_flow_reminder(self, current_flow: str) -> str:
        """Get a gentle reminder about the current flow"""
        reminders = {
            'appointment': "📅 Por cierto, ¿seguimos con tu cita? Escribe 'sí' para continuar o 'cancelar' si ya no la necesitas.",
            'account_creation': "👤 ¿Continuamos creando tu cuenta? Escribe 'sí' o 'cancelar'.",
            'services': "📋 ¿Te interesa algún servicio? Escribe el número o 'menú' para ver opciones."
        }
        return reminders.get(current_flow, "")


# Singleton instance
whatsapp_bot_v2 = None

def get_whatsapp_bot_v2():
    return whatsapp_bot_v2

def init_whatsapp_bot_v2(db, whatsapp_service, ai_brain=None):
    global whatsapp_bot_v2
    whatsapp_bot_v2 = WhatsAppBotServiceV2(db, whatsapp_service, ai_brain)
    return whatsapp_bot_v2

# ==================== ENHANCED FEATURES ====================

class WhatsAppEnhancedFeatures:
    """Enhanced features for WhatsApp bot - Real calendar, better AI, more automations"""
    
    @staticmethod
    async def get_real_calendar_slots(db, days_ahead: int = 7) -> list:
        """Get REAL available slots from Google Calendar integration"""
        try:
            from google_calendar_service import get_google_calendar
            
            calendar_service = get_google_calendar()
            if calendar_service and calendar_service.credentials_valid:
                # Get busy times from Google Calendar
                from datetime import datetime, timedelta
                
                start_date = datetime.now()
                end_date = start_date + timedelta(days=days_ahead)
                
                busy_slots = await calendar_service.get_busy_times(
                    start_date.isoformat(),
                    end_date.isoformat()
                )
                
                # Generate available slots excluding busy times
                available_slots = []
                business_hours = {
                    0: {'start': 9, 'end': 18},   # Monday
                    1: {'start': 9, 'end': 18},   # Tuesday
                    2: {'start': 9, 'end': 18},   # Wednesday
                    3: {'start': 9, 'end': 18},   # Thursday
                    4: {'start': 9, 'end': 18},   # Friday
                    5: {'start': 10, 'end': 14},  # Saturday
                    6: None  # Sunday - closed
                }
                
                current_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                for day_offset in range(days_ahead):
                    check_date = current_date + timedelta(days=day_offset)
                    day_of_week = check_date.weekday()
                    hours = business_hours.get(day_of_week)
                    
                    if hours:
                        day_slots = []
                        for hour in range(hours['start'], hours['end']):
                            slot_time = check_date.replace(hour=hour, minute=0)
                            
                            # Check if slot is busy
                            is_busy = False
                            for busy in busy_slots:
                                busy_start = datetime.fromisoformat(busy['start'].replace('Z', '+00:00'))
                                busy_end = datetime.fromisoformat(busy['end'].replace('Z', '+00:00'))
                                if busy_start <= slot_time < busy_end:
                                    is_busy = True
                                    break
                            
                            if not is_busy and slot_time > datetime.now():
                                day_slots.append(slot_time.strftime('%I:%M %p'))
                        
                        if day_slots:
                            available_slots.append({
                                'date': check_date.strftime('%Y-%m-%d'),
                                'date_str': check_date.strftime('%d/%m/%Y'),
                                'day_name': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][day_of_week],
                                'slots': day_slots
                            })
                
                return available_slots
            
        except Exception as e:
            logger.warning(f"Could not get real calendar slots: {e}")
        
        # Fallback to static slots if calendar not available
        return None
    
    @staticmethod
    async def create_real_appointment(db, phone: str, date_str: str, time_str: str, client_info: dict) -> dict:
        """Create appointment in database AND Google Calendar"""
        try:
            from datetime import datetime
            from google_calendar_service import get_google_calendar
            
            # Parse date and time
            appointment_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
            
            # Create in database
            appointment_data = {
                'user_id': client_info.get('id') if client_info else None,
                'phone_number': phone,
                'client_name': client_info.get('name', 'Cliente WhatsApp') if client_info else 'Cliente WhatsApp',
                'date': appointment_datetime,
                'time': time_str,
                'type': 'tax_consultation',
                'status': 'confirmed',
                'source': 'whatsapp_bot',
                'created_at': datetime.utcnow(),
                'notes': 'Cita agendada via WhatsApp'
            }
            
            result = await db.appointments.insert_one(appointment_data)
            appointment_id = str(result.inserted_id)
            
            # Also create in Google Calendar if available
            calendar_service = get_google_calendar()
            if calendar_service and calendar_service.credentials_valid:
                calendar_event = await calendar_service.create_event(
                    summary=f"Cita: {appointment_data['client_name']}",
                    description=f"Cliente: {appointment_data['client_name']}\nTeléfono: {phone}\nTipo: Consulta de Impuestos\nReservado via WhatsApp",
                    start_time=appointment_datetime.isoformat(),
                    end_time=(appointment_datetime + timedelta(hours=1)).isoformat(),
                    location="Ross Tax Preparation, Lubbock, TX"
                )
                
                # Update appointment with calendar event ID
                if calendar_event:
                    await db.appointments.update_one(
                        {'_id': result.inserted_id},
                        {'$set': {'google_calendar_event_id': calendar_event.get('id')}}
                    )
            
            return {
                'success': True,
                'appointment_id': appointment_id,
                'datetime': appointment_datetime,
                'in_google_calendar': calendar_service is not None
            }
            
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            return {'success': False, 'error': str(e)}


    # ==================== DOCUMENT HANDLING ====================
    
    async def _handle_document_received(self, phone: str, message: str, client_info: Dict) -> Dict:
        """Handle when a client sends a document/image via WhatsApp"""
        client_name = client_info.get('first_name', 'Cliente') if client_info else 'Cliente'
        
        # Log the document receipt
        await self.db.whatsapp_documents.insert_one({
            'phone_number': phone,
            'client_id': client_info.get('id') if client_info else None,
            'received_at': datetime.utcnow(),
            'status': 'pending_review',
            'type': 'unknown',
            'notes': message
        })
        
        response_msg = f"""📄 *¡Documento Recibido!*

¡Gracias {client_name}! He recibido tu documento. 👍

📋 *Estado:* En revisión
⏱️ Lo revisaremos pronto y te confirmaremos.

*¿Qué tipo de documento es?*
1️⃣ W-2 (Comprobante de ingresos)
2️⃣ 1099 (Otros ingresos)
3️⃣ Identificación (ID/Licencia)
4️⃣ Tarjeta de Seguro Social
5️⃣ Recibo o Factura
6️⃣ Otro documento

Responde con el número para clasificarlo, o si tienes más documentos, ¡envíalos! 📎"""
        
        return {
            'success': True,
            'message': response_msg,
            'intent': 'document_received',
            'requires_classification': True
        }
    
    async def _handle_payment_mention(self, phone: str, message: str, client_info: Dict) -> Dict:
        """Handle when client mentions they made a payment"""
        client_name = client_info.get('first_name', 'Cliente') if client_info else 'Cliente'
        
        # Check for amount in message
        import re
        amount_match = re.search(r'\$?(\d+(?:\.\d{2})?)', message)
        amount = float(amount_match.group(1)) if amount_match else None
        
        # Detect payment method
        method = 'desconocido'
        if 'zelle' in message.lower():
            method = 'Zelle'
        elif 'tarjeta' in message.lower() or 'card' in message.lower():
            method = 'Tarjeta'
        elif 'efectivo' in message.lower() or 'cash' in message.lower():
            method = 'Efectivo'
        elif 'transferencia' in message.lower():
            method = 'Transferencia'
        
        # Log pending payment
        payment_record = {
            'phone_number': phone,
            'client_id': client_info.get('id') if client_info else None,
            'client_name': client_info.get('name') if client_info else 'Cliente WhatsApp',
            'amount': amount,
            'method': method,
            'status': 'pending_verification',
            'reported_at': datetime.utcnow(),
            'source': 'whatsapp'
        }
        result = await self.db.pending_payments.insert_one(payment_record)
        
        amount_text = f" de *${amount:.2f}*" if amount else ""
        
        response_msg = f"""💰 *¡Pago Reportado!*

Gracias {client_name}, hemos registrado tu pago{amount_text} por {method}. ✅

📋 *Estado:* Pendiente de verificación
🔍 Nuestro equipo lo confirmará pronto.

Una vez verificado, recibirás tu confirmación oficial. 🎉

*¿Enviaste comprobante de pago?*
Si tienes una captura o recibo, envíalo aquí para agilizar la verificación. 📸"""

        # Notify admin about pending payment
        try:
            admin_msg = f"""🔔 *NUEVO PAGO REPORTADO*

👤 Cliente: {client_name}
📱 Tel: {phone}
💰 Monto: ${amount if amount else 'No especificado'}
💳 Método: {method}
📅 Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}

⚠️ Verificar y confirmar en el sistema."""

            # Log for admin review
            await self.db.admin_notifications.insert_one({
                'type': 'payment_pending',
                'payment_id': str(result.inserted_id),
                'message': admin_msg,
                'created_at': datetime.utcnow(),
                'read': False
            })
        except:
            pass
        
        return {
            'success': True,
            'message': response_msg,
            'intent': 'payment_reported',
            'payment_id': str(result.inserted_id)
        }
    
    # ==================== INVOICE SENDING ====================
    
    async def send_invoice_via_whatsapp(self, phone: str, invoice_data: Dict) -> Dict:
        """Send a formatted invoice via WhatsApp"""
        try:
            # Generate payment link if Stripe is configured
            payment_link = invoice_data.get('payment_link', 'Solicitar a un asesor')
            
            invoice_msg = f"""📄 *FACTURA #{invoice_data.get('invoice_number', 'N/A')}*
━━━━━━━━━━━━━━━━━━━━

👤 *Cliente:* {invoice_data.get('client_name', 'Cliente')}
📅 *Fecha:* {invoice_data.get('date', datetime.now().strftime('%d/%m/%Y'))}
📋 *Servicio:* {invoice_data.get('service', 'Servicio de impuestos')}

💰 *Total:* ${invoice_data.get('amount', 0):.2f}

━━━━━━━━━━━━━━━━━━━━
*Formas de Pago:*

💳 *Tarjeta:* {payment_link}

💵 *Zelle:* ross@rosstaxpreparation.com
    (Incluir #{invoice_data.get('invoice_number', '')} en memo)

💸 *Efectivo:* En nuestra oficina
    305 Bruce Ave, Dumas, TX

━━━━━━━━━━━━━━━━━━━━
Ross Tax Preparation LLC
📞 (806) 934-2018

¿Tienes preguntas sobre esta factura? ¡Escríbeme! 😊"""

            # Send via WhatsApp
            result = await self.whatsapp_service.send_message(phone, invoice_msg)
            
            # Log invoice sent
            await self.db.whatsapp_invoices_sent.insert_one({
                'phone_number': phone,
                'invoice_number': invoice_data.get('invoice_number'),
                'amount': invoice_data.get('amount'),
                'sent_at': datetime.utcnow(),
                'status': 'sent'
            })
            
            return {
                'success': True,
                'message': 'Factura enviada exitosamente',
                'message_id': result.get('message_id')
            }
            
        except Exception as e:
            logger.error(f"Error sending invoice via WhatsApp: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== BIRTHDAY GREETING ====================
    
    async def send_birthday_greeting(self, phone: str, client_name: str, discount_code: str = None) -> Dict:
        """Send personalized birthday greeting with optional discount"""
        try:
            current_year = datetime.now().year
            discount_code = discount_code or f"CUMPLE{current_year}"
            
            birthday_msg = f"""🎂🎉 *¡FELIZ CUMPLEAÑOS {client_name.upper()}!* 🎉🎂

¡Hoy es tu día especial y queremos celebrarlo contigo! 🥳

De parte de todo el equipo de Ross Tax Preparation, te deseamos un día increíble lleno de alegría, amor y muchas bendiciones. 💝

🎁 *REGALO ESPECIAL PARA TI:*
Usa el código *{discount_code}* y obtén
✨ *15% DE DESCUENTO* ✨
en tu próximo servicio con nosotros.

Válido por los próximos 30 días. 🗓️

¡Gracias por ser parte de nuestra familia de clientes! Te apreciamos mucho. 🙏💙

Con cariño,
*El equipo de Ross Tax* 🌟

P.D. ¿Ya tienes planes para tu declaración de este año? ¡Te ayudamos! Escribe "agendar" 📅"""

            result = await self.whatsapp_service.send_message(phone, birthday_msg)
            
            # Log birthday greeting
            await self.db.birthday_greetings_sent.insert_one({
                'phone_number': phone,
                'client_name': client_name,
                'discount_code': discount_code,
                'sent_at': datetime.utcnow(),
                'year': current_year
            })
            
            return {
                'success': True,
                'message': 'Felicitación de cumpleaños enviada',
                'message_id': result.get('message_id'),
                'discount_code': discount_code
            }
            
        except Exception as e:
            logger.error(f"Error sending birthday greeting: {e}")
            return {'success': False, 'error': str(e)}

