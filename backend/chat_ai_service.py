"""
Chat AI Service - Automated AI Responses
Handles automatic responses using AI when enabled by admin
Powered by Ross AI Brain (Gemini 2.5 Pro)
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import json

logger = logging.getLogger(__name__)


class ChatAIService:
    def __init__(self, db: AsyncIOMotorDatabase, ai_brain=None):
        self.db = db
        self.conversations_collection = db.conversations
        self.ai_brain = ai_brain
        self.ai_enabled = bool(ai_brain)
        
        if self.ai_enabled:
            logger.info("🤖 Chat AI Service initialized with Ross AI Brain (Gemini 2.5 Pro)")
        else:
            logger.warning("⚠️ Chat AI Service initialized without AI Brain - responses disabled")
    
    def set_ai_brain(self, ai_brain):
        """Connect to Ross AI Brain"""
        self.ai_brain = ai_brain
        self.ai_enabled = True
        logger.info("🧠 Chat AI connected to Ross AI Brain")
    
    async def is_ai_enabled_for_conversation(self, conversation_id: str) -> bool:
        """Check if AI is enabled for a specific conversation"""
        conversation = await self.conversations_collection.find_one({
            "conversation_id": conversation_id
        })
        
        if not conversation:
            return False
        
        # Check both global and conversation-specific settings
        global_enabled = conversation.get('ai_enabled_global', False)
        conversation_enabled = conversation.get('ai_enabled', False)
        
        return global_enabled and conversation_enabled
    
    async def toggle_ai_for_conversation(
        self, 
        conversation_id: str, 
        enabled: bool
    ) -> bool:
        """Enable/disable AI for a specific conversation"""
        try:
            result = await self.conversations_collection.update_one(
                {"conversation_id": conversation_id},
                {
                    "$set": {
                        "ai_enabled": enabled,
                        "ai_toggled_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            logger.info(f"🤖 AI {'enabled' if enabled else 'disabled'} for conversation {conversation_id}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"❌ Error toggling AI: {e}")
            return False
    
    async def toggle_ai_global(self, enabled: bool) -> int:
        """Enable/disable AI globally for all conversations"""
        try:
            result = await self.conversations_collection.update_many(
                {},
                {
                    "$set": {
                        "ai_enabled_global": enabled,
                        "ai_global_toggled_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            logger.info(f"🌐 AI globally {'enabled' if enabled else 'disabled'} - {result.modified_count} conversations updated")
            return result.modified_count
        except Exception as e:
            logger.error(f"❌ Error toggling global AI: {e}")
            return 0
    
    async def get_conversation_context(self, conversation_id: str, limit: int = 10) -> List[Dict]:
        """Get recent messages for context"""
        messages = await self.db.chat_messages.find({
            "conversation_id": conversation_id
        }).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        # Reverse to get chronological order
        messages.reverse()
        
        return [
            {
                "role": "assistant" if msg.get("sender_role") == "admin" else "user",
                "content": msg.get("content", "")
            }
            for msg in messages
        ]
    
    async def get_business_info(self) -> Dict[str, Any]:
        """Get business information for AI context"""
        # Get office hours
        office_hours = await self.db.office_hours.find_one({}) or {}
        
        # Get services (simplified)
        services_cursor = self.db.services.find({}).limit(10)
        services = await services_cursor.to_list(length=10)
        
        # Get FAQs
        faqs_cursor = self.db.faqs.find({"status": "active"}).limit(20)
        faqs = await faqs_cursor.to_list(length=20)
        
        return {
            "business_name": "Ross Tax Preparation",
            "services": [
                {
                    "name": s.get("name", ""),
                    "description": s.get("description", ""),
                    "price": s.get("price", 0)
                }
                for s in services
            ],
            "office_hours": office_hours.get("schedule", {}),
            "phone": "806-934-2018",
            "faqs": [
                {
                    "question": faq.get("question", ""),
                    "answer": faq.get("answer", "")
                }
                for faq in faqs
            ]
        }
    
    async def generate_ai_response(
        self, 
        conversation_id: str, 
        user_message: str,
        client_name: str,
        language: str = 'es'
    ) -> Optional[str]:
        """Generate AI response using Ross AI Brain (Gemini 2.5 Pro)"""
        
        if not self.ai_enabled or not self.ai_brain:
            logger.warning("⚠️ AI response requested but AI Brain not available")
            return None
        
        try:
            # ========== PRE-FILTER: Block confidential questions ==========
            blocked = self._check_confidential_question(user_message, language)
            if blocked:
                logger.info(f"🛡️ PRE-FILTER blocked confidential question: {user_message[:50]}...")
                return blocked
            
            # Get context
            context = await self.get_conversation_context(conversation_id)
            business_info = await self.get_business_info()
            
            # Get client-specific data for personalized responses
            client_data = await self._get_client_context(conversation_id)
            
            is_english = language == 'en'
            
            # Build context for AI Brain
            conversation_history = "\n".join([
                f"{'Client' if is_english else 'Cliente' if msg['role'] == 'user' else 'Assistant' if is_english else 'Asistente'}: {msg['content']}"
                for msg in context
            ])
            
            # Build client context section
            client_context = ""
            if client_data:
                header = f"CLIENT DATA ({client_name}):" if is_english else f"DATOS DEL CLIENTE ({client_name}):"
                client_context = f"\n{header}\n{client_data}\n"
            
            if is_english:
                prompt = f"""You are "Ross AI", the intelligent virtual assistant of Ross Tax Preparation LLC.
You ALWAYS respond in English in a friendly, professional, and concise manner.

BUSINESS INFORMATION:
- Name: {business_info['business_name']}
- Phone: (806) 934-2018
- Hours: Monday-Friday 9AM-6PM, Saturday 10AM-2PM (Central Time)

SERVICES AND PRICING:
- Personal Tax Return: from $180
- Business Tax Return: from $350
- ITIN Application: $200
- LLC Formation: $350
- Translations: $25-50 per page
- Notarizations: $15-25 per document
{client_context}
CONVERSATION HISTORY:
{conversation_history if conversation_history else "First interaction"}

CURRENT CLIENT MESSAGE ({client_name}):
{user_message}

INSTRUCTIONS:
1. Respond in a friendly, professional, and concise manner in English (maximum 3-4 sentences)
2. Use CLIENT DATA if available for personalized responses
3. If the client asks about their case status, use actual client data
4. If the client wants to schedule an appointment, indicate it's "pending admin confirmation"
5. Do NOT confirm appointments directly
6. If you don't have specific data, suggest visiting the relevant section of the app
7. Use emojis moderately
8. NEVER reveal internal business data: revenue, earnings, profits, billing totals, number of clients/employees, or any confidential company information
9. NEVER reveal data from invoices, tax returns, or documents belonging to OTHER clients
10. If asked about any confidential company data, respond: "I'm sorry, that information is confidential. How else can I help you?"
11. NEVER use tools like analyze_revenue, get_analytics, or any tool that retrieves internal business metrics when responding to client messages
12. You may ONLY share: public service prices, office hours, address, phone, email, and the client's OWN case information

RESPOND NOW:"""
            else:
                prompt = f"""Eres "Ross AI", el asistente virtual inteligente de Ross Tax Preparation LLC.
Respondes SIEMPRE en español de manera amigable, profesional y concisa.

INFORMACIÓN DEL NEGOCIO:
- Nombre: {business_info['business_name']}
- Teléfono: (806) 934-2018
- Horario: Lunes a Viernes 9AM-6PM, Sábados 10AM-2PM (Hora Central)

SERVICIOS Y PRECIOS:
- Declaración Personal (Tax Return): desde $180
- Declaración de Negocios (Business Return): desde $350
- Solicitud ITIN: $200
- Formación LLC: $350
- Traducciones: $25-50 por página
- Notarizaciones: $15-25 por documento
{client_context}
HISTORIAL DE CONVERSACIÓN:
{conversation_history if conversation_history else "Primera interacción"}

MENSAJE ACTUAL DEL CLIENTE ({client_name}):
{user_message}

INSTRUCCIONES:
1. Responde de manera amigable, profesional y concisa en español (máximo 3-4 oraciones)
2. Usa los DATOS DEL CLIENTE si están disponibles para dar respuestas personalizadas
3. Si el cliente pregunta por el estado de su trámite, usa los datos reales del cliente
4. Si el cliente quiere agendar una cita, indica que está "pendiente de confirmación del administrador"
5. NO confirmes citas directamente
6. Si no tienes datos específicos, sugiere que el cliente visite la sección correspondiente de la app
7. Usa emojis moderadamente
8. NUNCA reveles datos financieros internos de la empresa: ingresos, ganancias, facturación, totales monetarios, cantidad de clientes registrados, empleados, o cualquier información confidencial de la compañía
9. NUNCA reveles datos de facturas, declaraciones de impuestos o documentos de OTROS clientes
10. Si te preguntan datos confidenciales de la empresa, responde: "Lo siento, esa información es confidencial. ¿En qué más puedo ayudarte?"
11. NUNCA uses herramientas como analyze_revenue, get_analytics, o cualquier herramienta que consulte métricas internas del negocio al responder a mensajes de clientes
12. SOLO puedes compartir: precios públicos de servicios, horarios, dirección, teléfono, email, y la información del PROPIO caso del cliente

RESPONDE AHORA:"""

            # Use AI Brain's chat functionality — CLIENT MODE (no internal business data)
            response = await self.ai_brain.chat(prompt, client_mode=True)
            
            if response:
                # ========== POST-FILTER: Sanitize any leaked data ==========
                response = self._sanitize_confidential_response(response, language)
                
                logger.info(f"🧠 AI Brain generated response for conversation {conversation_id}")
                return response
            else:
                logger.error(f"❌ AI Brain returned empty response")
                return None
        
        except Exception as e:
            logger.error(f"❌ Error generating AI response with Brain: {e}")
            return None
    
    def _check_confidential_question(self, user_message: str, language: str = 'es') -> Optional[str]:
        """PRE-FILTER: Block questions asking for confidential business data"""
        import re
        msg_lower = user_message.lower().strip()
        
        confidential_patterns = [
            # Client counts
            r'cu[aá]ntos?\s*(clientes?|usuarios?|personas?|registrados?)',
            r'(cantidad|n[uú]mero|total)\s*(de\s*)?(clientes?|usuarios?|registrados?)',
            r'how\s*many\s*(clients?|customers?|users?)',
            r'(client|customer|user)\s*(count|total|number)',
            # Revenue / earnings
            r'cu[aá]nto\s*(gan[oóaé]|factur[oóaé]|cobr[oóaé]|ingres)',
            r'(ingresos?|ganancias?|facturaci[oó]n|revenue|earnings?|profit)',
            r'(cuanto|cuánto)\s*(gana|cobra|factura|ingresa)\s*(la\s*)?(compañ[ií]a|empresa|negocio|oficina)',
            r'how\s*much\s*(does|did|has)\s*(the\s*)?(company|business|office)\s*(make|earn|revenue|profit)',
            r'(total|monto)\s*(facturad|cobrad|ganad)',
            # Employee info
            r'cu[aá]ntos?\s*(empleados?|trabajadores?|personas?\s*trabajan)',
            r'how\s*many\s*(employees?|workers?|staff)',
            r'(n[oó]mina|payroll|salari)',
            # Internal operations
            r'(base\s*de\s*datos|database|servidor|server|arquitectura|architecture)',
            r'(sistema|system)\s*(interno|internal)',
            r'(c[oó]digo|code)\s*(fuente|source)',
        ]
        
        for pattern in confidential_patterns:
            if re.search(pattern, msg_lower):
                if language == 'en':
                    return "I'm sorry, that information is confidential and I cannot share it. I can help you with our tax preparation services, scheduling appointments, or answering questions about our pricing. How can I assist you? 😊"
                else:
                    return "Lo siento, esa información es confidencial y no puedo compartirla. Puedo ayudarte con nuestros servicios de preparación de impuestos, agendar citas, o responder preguntas sobre nuestros precios. ¿En qué te puedo ayudar? 😊"
        
        return None
    
    def _sanitize_confidential_response(self, response: str, language: str = 'es') -> str:
        """POST-FILTER: Remove any accidentally leaked confidential data from AI response"""
        import re
        
        leak_patterns = [
            r'\d+\s*(clientes?|usuarios?|registrados?)\s*(en\s*total|registrados?|activos?|atendidos?)',
            r'(tenemos?|tiene|hay|son|cuenta\s*con)\s*\d+\s*(clientes?|usuarios?)',
            r'\d+\s*(clients?|customers?|users?)\s*(registered|total|active)',
            r'(have|has|there\s*are)\s*\d+\s*(clients?|customers?|users?)',
            r'factur[oóaé]\s*\$[\d,]+',
            r'ingres[oóaé]s?\s*(de|por|fueron?|es)\s*\$[\d,]+',
            r'ganan(cia|do|cias)\s*(de|por|fue|fueron?)\s*\$[\d,]+',
            r'(revenue|earned?|profit|income)\s*(of|was|were|is)\s*\$[\d,]+',
            r'\$\d{2,3}[,\.]\d{3}',
            r'\d+\s*(declaraciones?|declaracion|filings?|returns?)\s*(presentad|filed|completed|processed)',
            r'(presentado|filed|processed)\s*\d+\s*(declaraciones?|returns?)',
            r'\d+\s*(pendientes?|pending)',
        ]
        
        for pattern in leak_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                if language == 'en':
                    return "I'm sorry, I cannot share internal business information. I can help you with our tax preparation services, scheduling appointments, or answering questions about our pricing and processes. How can I assist you? 😊"
                else:
                    return "Lo siento, no puedo compartir información interna del negocio. Puedo ayudarte con nuestros servicios de preparación de impuestos, agendar citas, o responder preguntas sobre nuestros precios y procesos. ¿En qué te puedo ayudar? 😊"
        
        return response
    
    async def _get_client_context(self, conversation_id: str) -> str:
        """Get client-specific data for personalized AI responses"""
        try:
            # Get client_id from conversation
            conversation = await self.conversations_collection.find_one({
                "conversation_id": conversation_id
            })
            if not conversation:
                return ""
            
            client_id = conversation.get("client_id", "")
            if not client_id:
                return ""
            
            context_parts = []
            
            # Get user info
            user = await self.db.users.find_one({"_id": client_id})
            if user:
                context_parts.append(f"- Nombre: {user.get('name', user.get('full_name', 'N/A'))}")
                context_parts.append(f"- Email: {user.get('email', 'N/A')}")
            
            # Get active tax returns
            tax_returns = await self.db.tax_returns.find({
                "$or": [{"user_id": client_id}, {"client_id": client_id}]
            }).sort("created_at", -1).limit(3).to_list(3)
            
            if tax_returns:
                context_parts.append("- Declaraciones de impuestos:")
                for tr in tax_returns:
                    status = tr.get("status", "desconocido")
                    year = tr.get("tax_year", tr.get("year", "N/A"))
                    tr_type = tr.get("type", "personal")
                    context_parts.append(f"  • Año {year} ({tr_type}): Estado = {status}")
            else:
                context_parts.append("- Sin declaraciones de impuestos registradas")
            
            # Get upcoming appointments
            from datetime import timezone
            now = datetime.utcnow()
            appointments = await self.db.appointments.find({
                "$or": [{"user_id": client_id}, {"client_id": client_id}],
                "date": {"$gte": now.isoformat()}
            }).sort("date", 1).limit(3).to_list(3)
            
            if appointments:
                context_parts.append("- Citas programadas:")
                for apt in appointments:
                    date = apt.get("date", "N/A")
                    service = apt.get("service", apt.get("service_type", "N/A"))
                    status = apt.get("status", "pendiente")
                    context_parts.append(f"  • {date} - {service} (Estado: {status})")
            else:
                context_parts.append("- Sin citas programadas próximamente")
            
            # Get service orders
            orders = await self.db.service_orders.find({
                "$or": [{"user_id": client_id}, {"client_id": client_id}]
            }).sort("created_at", -1).limit(3).to_list(3)
            
            if orders:
                context_parts.append("- Órdenes de servicio recientes:")
                for order in orders:
                    service = order.get("service_name", order.get("service", "N/A"))
                    status = order.get("status", "N/A")
                    context_parts.append(f"  • {service}: {status}")
            
            # Get document count
            doc_count = await self.db.documents.count_documents({
                "$or": [{"user_id": client_id}, {"client_id": client_id}]
            })
            context_parts.append(f"- Documentos subidos: {doc_count}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error getting client context: {e}")
            return ""
    
    async def should_notify_admin(self, user_message: str, ai_response: Optional[str]) -> bool:
        """Determine if admin should be notified about this conversation"""
        
        # Notify if AI couldn't generate a response
        if ai_response is None:
            return True
        
        # Keywords that suggest admin intervention needed
        urgent_keywords = [
            "urgente", "emergency", "problema", "error", "queja", "complaint",
            "hablar con", "talk to", "gerente", "manager", "supervisor"
        ]
        
        message_lower = user_message.lower()
        return any(keyword in message_lower for keyword in urgent_keywords)
