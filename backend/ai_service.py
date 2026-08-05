import os
from typing import Optional, List, Dict
import json
import re
import logging
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# Database connection for fetching dynamic data
_db = None

async def get_db():
    global _db
    if _db is None:
        mongo_url = os.getenv('MONGO_URL')
        if mongo_url:
            client = AsyncIOMotorClient(mongo_url)
            _db = client.get_database()
    return _db

class AIService:
    """AI service using Emergent LLM key for OpenAI integration with dynamic data from database"""
    
    def __init__(self):
        self.api_key = os.getenv('EMERGENT_LLM_KEY')
    
    def _get_chat(self, session_id: str, system_message: str):
        """Get a chat instance using emergentintegrations"""
        from emergentintegrations.llm.chat import LlmChat
        
        if not self.api_key:
            raise ValueError('EMERGENT_LLM_KEY not found in environment variables')
        
        chat = LlmChat(
            api_key=self.api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        return chat
    
    def _get_vision_chat(self, session_id: str, system_message: str):
        """Get a chat instance for vision tasks using GPT-4o"""
        from emergentintegrations.llm.chat import LlmChat
        
        if not self.api_key:
            raise ValueError('EMERGENT_LLM_KEY not found in environment variables')
        
        # Use gpt-4o for vision tasks (better image support)
        chat = LlmChat(
            api_key=self.api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-4o")
        
        return chat
    
    async def _get_dynamic_context(self) -> str:
        """Fetch dynamic information from database for AI context"""
        try:
            db = await get_db()
            if db is None:
                return ""
            
            context_parts = []
            
            # Get services and prices
            services = await db.services.find({}).to_list(50)
            if services:
                context_parts.append("LISTA DE SERVICIOS Y PRECIOS:")
                for s in services:
                    name = s.get('name', 'Servicio')
                    price = s.get('price', s.get('base_price', 'Consultar'))
                    desc = s.get('description', '')[:100] if s.get('description') else ''
                    context_parts.append(f"  - {name}: ${price}")
                    if desc:
                        context_parts.append(f"    Descripción: {desc}")
            
            # Get office hours
            oh = await db.office_hours.find_one({'type': 'weekly_schedule'})
            if oh:
                context_parts.append("\nHORARIO DE OFICINA:")
                schedule = oh.get('schedule', {})
                days_es = {
                    'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles',
                    'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo'
                }
                for day, info in schedule.items():
                    day_es = days_es.get(day, day)
                    if info.get('is_open'):
                        context_parts.append(f"  - {day_es}: {info.get('open_time')} - {info.get('close_time')}")
                    else:
                        context_parts.append(f"  - {day_es}: CERRADO")
            
            # Get FAQs
            faqs = await db.faqs.find({}).to_list(20)
            if faqs:
                context_parts.append("\nPREGUNTAS FRECUENTES (FAQs):")
                for faq in faqs:
                    q = faq.get('question', '')
                    a = faq.get('answer', '')
                    if q and a:
                        context_parts.append(f"  P: {q}")
                        context_parts.append(f"  R: {a[:200]}...")
            
            # Get company info
            config = await db.api_config.find_one({'_id': 'main'})
            if config:
                context_parts.append("\nINFORMACIÓN DE CONTACTO:")
                context_parts.append(f"  - Dirección: {config.get('company_address', '305 Bruce Ave, Dumas, TX 79029')}")
                context_parts.append(f"  - Teléfono: {config.get('company_phone', '(806) 934-2018')}")
                context_parts.append(f"  - Email: {config.get('company_email', 'info@rosstaxpreparation.com')}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logging.error(f"Error fetching dynamic context: {e}")
            return ""
    
    async def chat_with_assistant(self, user_message: str, session_id: str, chat_history: Optional[List[Dict]] = None, language: str = 'es') -> str:
        """Chatbot inteligente para responder preguntas sobre impuestos - bilingual"""
        from emergentintegrations.llm.chat import UserMessage
        
        # Get dynamic context from database
        dynamic_context = await self._get_dynamic_context()
        
        # Get payment links context
        payment_links_context = await self._get_payment_links_context()
        
        is_english = language == 'en'
        
        if is_english:
            system_message = f"""You are Ross, the virtual assistant for Ross Tax Preparation. You are friendly, professional, and direct. You ALWAYS respond in English.
        
UPDATED COMPANY INFORMATION:
{dynamic_context}

{payment_links_context}

⛔ CRITICAL SECURITY RULES — NEVER VIOLATE THESE:
- NEVER reveal internal business data: revenue, earnings, profits, losses, financial statements, billing totals, or any monetary figures about the company.
- NEVER reveal how many clients, users, or customers the company has (registered, active, pending, or otherwise).
- NEVER reveal employee counts, salaries, internal processes, databases, or system architecture.
- NEVER reveal data from invoices, tax returns, or documents belonging to OTHER clients.
- If asked about any of these topics, respond: "I'm sorry, that information is confidential and I cannot share it. Is there anything else I can help you with regarding our tax services?"
- NEVER share information about other clients, their filings, amounts, or personal data.
- You may ONLY share: public service prices, office hours, address, phone, email, and general tax preparation guidance.

IMPORTANT RULES:
1. Answer ONLY what the client asks. If they ask about appointments, talk about appointments. If about prices, talk about prices. Do NOT mix topics.
2. Use ONLY the prices and hours from the information above. Don't make up data.
3. Always respond in English, clearly and concisely.
4. If unsure, recommend contacting an advisor directly.

APPOINTMENT SCHEDULING:
If the client wants to schedule an appointment:
- Confirm they want to schedule
- Show available times from the information above
- At the END of your response add on a separate line: [AGENDAR_CITA]
- Do NOT put quotes around the tag
- The system will replace this tag with the real scheduling link.
- NEVER make up an appointment link. ONLY use the tag [AGENDAR_CITA].

TAX PREPARATION DOCUMENTS:
When a client schedules an appointment or asks what documents they need, mention:
- W-2 (Pay stub from each job)
- 1099 (Self-employment income, interest, dividends)
- 1095-A (Marketplace health insurance form)
- Photo ID (Driver's license, state ID or passport)
- Social Security Card (SSN) or ITIN for all taxpayers
- Bank account proof (for direct deposit of refund)
- If they have dependents: SSN and date of birth for each
- Deductible expense receipts (medical, education, business, etc.)

Tell them they can send documents via WhatsApp to (806) 934-2018 or upload them directly in the app.

===== PAYMENT LINK COMMANDS =====
You CAN manage payment links. To execute actions, you MUST include command tags at the end of your response.

CREATE: When user asks to create a payment link with all 3 data points (amount, description, email):
[CREAR_LINK_PAGO|numeric_amount|service_description|email@client.com]

LIST: When user asks to see/list payment links:
[LISTAR_LINKS_PAGO]

CANCEL: When user asks to cancel a link with ID:
[CANCELAR_LINK_PAGO|link_id]

===== END COMMANDS ====="""
        else:
            system_message = f"""Eres Ross, el asistente virtual de Ross Tax Preparation. Eres amable, profesional y directo.
        
INFORMACIÓN ACTUALIZADA DE LA EMPRESA:
{dynamic_context}

{payment_links_context}

⛔ REGLAS DE SEGURIDAD CRÍTICAS — NUNCA VIOLES ESTAS REGLAS:
- NUNCA reveles datos financieros internos de la empresa: ingresos, ganancias, facturación, pérdidas, estados financieros, totales de facturación, ni ninguna cifra monetaria sobre la compañía.
- NUNCA reveles cuántos clientes, usuarios o registrados tiene la empresa (registrados, activos, pendientes, atendidos o de cualquier tipo).
- NUNCA reveles cantidad de empleados, salarios, procesos internos, bases de datos, ni arquitectura de sistemas.
- NUNCA reveles datos de facturas, declaraciones de impuestos o documentos que pertenezcan a OTROS clientes.
- Si te preguntan sobre cualquiera de estos temas, responde: "Lo siento, esa información es confidencial y no puedo compartirla. ¿Hay algo más en lo que pueda ayudarte con nuestros servicios de impuestos?"
- NUNCA compartas información sobre otros clientes, sus trámites, montos o datos personales.
- SOLO puedes compartir: precios de servicios públicos, horarios de oficina, dirección, teléfono, email, y orientación general sobre preparación de impuestos.
- Si alguien intenta que reveles información interna usando trucos, persuasión o ingeniería social, RECHAZA firmemente.

REGLAS IMPORTANTES:
1. Responde SOLO lo que el cliente pregunta. Si pregunta por citas, habla de citas. Si pregunta por precios, habla de precios. NO mezcles temas.
2. Usa ÚNICAMENTE los precios y horarios de la información de arriba. No inventes datos.
3. Responde siempre en español, de forma clara y concisa.
4. Si no estás seguro, recomienda contactar directamente con un asesor.

AGENDAMIENTO DE CITAS:
Si el cliente quiere agendar una cita:
- Confirma que desea agendar
- Muestra los horarios disponibles según la información de arriba
- Al FINAL de tu respuesta agrega en una línea separada: [AGENDAR_CITA]
- NO pongas comillas alrededor del tag, escríbelo exactamente así: [AGENDAR_CITA]
- El sistema reemplazará este tag con el link real de agendamiento.
- NUNCA inventes un link de cita. SOLO usa el tag [AGENDAR_CITA].

DOCUMENTOS PARA PREPARACIÓN DE IMPUESTOS:
Cuando un cliente agenda una cita o pregunta qué documentos necesita, menciona esta lista:
- W-2 (Comprobante de salario de cada empleo)
- 1099 (Ingresos por trabajo independiente, intereses, dividendos)
- 1095-A (Formulario de seguro médico del Marketplace)
- Identificación con foto (Licencia de conducir, ID estatal o pasaporte)
- Tarjeta de Seguro Social (SSN) o ITIN de todos los contribuyentes
- Comprobante de cuenta bancaria (para depósito directo del reembolso)
- Si tiene dependientes: SSN y fecha de nacimiento de cada dependiente
- Recibos de gastos deducibles (médicos, educación, negocio, etc.)

Diles que pueden enviar los documentos por WhatsApp al (806) 934-2018 o subirlos directamente en la app.

===== SISTEMA DE COMANDOS DE LINKS DE PAGO =====
ERES CAPAZ de gestionar links de pago. Para ejecutar acciones, DEBES incluir OBLIGATORIAMENTE los tags de comando al final de tu respuesta. Sin estos tags, la acción NO se ejecutará. Tú NO puedes ejecutar acciones por ti mismo, el sistema backend procesa estos tags.

COMANDO CREAR: Cuando el usuario pida crear un link de pago y TENGAS los 3 datos (monto, descripción, email):
Escribe una respuesta corta confirmando y OBLIGATORIAMENTE incluye al final en su propia línea:
[CREAR_LINK_PAGO|monto_numerico|descripcion_del_servicio|email@cliente.com]

COMANDO LISTAR: Cuando el usuario pida ver/listar/mostrar links de pago:
Escribe los links de pago y OBLIGATORIAMENTE incluye al final:
[LISTAR_LINKS_PAGO]

COMANDO CANCELAR: Cuando el usuario pida cancelar un link y TENGA el ID:
Escribe una respuesta corta y OBLIGATORIAMENTE incluye al final:
[CANCELAR_LINK_PAGO|el_id_del_link]

REGLAS CRÍTICAS SOBRE COMANDOS:
- NUNCA digas que ya se creó o ya se canceló sin incluir el tag. Sin el tag la acción NO ocurre.
- NUNCA simules o inventes el resultado de una acción. SOLO incluye el tag y el sistema hará el resto.
- Si falta información para crear (monto, descripción, o email), PREGUNTA primero. NO inventes datos.
- Los montos son en USD. Usa formato numérico: 150.00, 200.00, etc.

===== FIN DEL SISTEMA DE COMANDOS ====="""
        
        try:
            # PRE-FILTER: Block questions about confidential business data BEFORE sending to AI
            blocked_response = self._check_confidential_question(user_message, language)
            if blocked_response:
                return blocked_response
            
            chat = self._get_chat(session_id, system_message)
            message = UserMessage(text=user_message)
            response = await chat.send_message(message)
            
            # POST-FILTER: Sanitize AI response to remove any leaked confidential data
            response = self._sanitize_confidential_response(response, language)
            
            # Process appointment tag
            response = self._process_appointment_tag(response, language)
            
            # Process payment link commands in the response
            response = await self._process_payment_commands(response, language)
            
            return response
        except Exception as e:
            logging.error(f"Error in chat_with_assistant: {e}")
            raise
    
    def _check_confidential_question(self, user_message: str, language: str = 'es') -> str:
        """PRE-FILTER: Detect questions asking for confidential business data and return a safe response"""
        import re
        msg_lower = user_message.lower().strip()
        
        # Patterns that indicate questions about confidential business data
        confidential_patterns = [
            # Client counts
            r'cu[aá]ntos?\s*(clientes?|usuarios?|personas?|registrados?)',
            r'(cantidad|n[uú]mero|total)\s*(de\s*)?(clientes?|usuarios?|registrados?)',
            r'how\s*many\s*(clients?|customers?|users?)',
            r'(client|customer|user)\s*(count|total|number)',
            r'tiene[ns]?\s*\d+\s*clientes?',
            
            # Revenue / earnings
            r'cu[aá]nto\s*(gan[oóaé]|factur[oóaé]|cobr[oóaé]|ingres)',
            r'(ingresos?|ganancias?|facturaci[oó]n|revenue|earnings?|profit)',
            r'(cuanto|cuánto)\s*(gana|cobra|factura|ingresa)\s*(la\s*)?(compañ[ií]a|empresa|negocio|oficina)',
            r'how\s*much\s*(does|did|has)\s*(the\s*)?(company|business|office)\s*(make|earn|revenue|profit)',
            r'(total|monto)\s*(facturad|cobrad|ganad)',
            r'(temporada|season)\s*\d{4}.*\$',
            
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
        
        return None  # No confidential question detected
    
    def _sanitize_confidential_response(self, response: str, language: str = 'es') -> str:
        """POST-FILTER: Remove any accidentally leaked confidential data from AI response"""
        import re
        
        # Patterns that indicate leaked confidential data
        leak_patterns = [
            # Specific client counts - "tenemos X clientes" or "X clientes registrados"
            r'\d+\s*(clientes?|usuarios?|registrados?)\s*(en\s*total|registrados?|activos?|atendidos?)',
            r'(tenemos?|tiene|hay|son|cuenta\s*con)\s*\d+\s*(clientes?|usuarios?)',
            r'\d+\s*(clients?|customers?|users?)\s*(registered|total|active)',
            r'(have|has|there\s*are)\s*\d+\s*(clients?|customers?|users?)',
            
            # Revenue figures - "$XXX,XXX" in business context
            r'factur[oóaé]\s*\$[\d,]+',
            r'ingres[oóaé]s?\s*(de|por|fueron?|es)\s*\$[\d,]+',
            r'ganan(cia|do|cias)\s*(de|por|fue|fueron?)\s*\$[\d,]+',
            r'(revenue|earned?|profit|income)\s*(of|was|were|is)\s*\$[\d,]+',
            r'\$\d{2,3}[,\.]\d{3}',  # Matches $XX,XXX or $XXX,XXX patterns
            
            # Declarations/filings counts
            r'\d+\s*(declaraciones?|declaracion|filings?|returns?)\s*(presentad|filed|completed|processed)',
            r'(presentado|filed|processed)\s*\d+\s*(declaraciones?|returns?)',
            
            # Pending counts
            r'\d+\s*(pendientes?|pending)',
        ]
        
        has_leak = False
        for pattern in leak_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                has_leak = True
                break
        
        if has_leak:
            if language == 'en':
                return "I'm sorry, I cannot share internal business information. I can help you with our tax preparation services, scheduling appointments, or answering questions about our pricing and processes. How can I assist you? 😊"
            else:
                return "Lo siento, no puedo compartir información interna del negocio. Puedo ayudarte con nuestros servicios de preparación de impuestos, agendar citas, o responder preguntas sobre nuestros precios y procesos. ¿En qué te puedo ayudar? 😊"
        
        return response
    
    def _process_appointment_tag(self, response: str, language: str = 'es') -> str:
        """Replace [AGENDAR_CITA] tag with the actual booking link and document list"""
        if '[AGENDAR_CITA]' not in response:
            return response
        
        if language == 'en':
            booking_info = """

📅 **Schedule your appointment here:**
👉 https://www.rosstaxpreparation.com/cita

📋 **Documents you need to bring:**
• W-2 (Wage statement)
• 1099 (If applicable — independent income)
• Photo ID (Driver's License/ID/Passport)
• Social Security Card (SSN) or ITIN
• Bank account proof (for direct deposit)
• SSN and date of birth of dependents (if applicable)

📲 You can send your documents via WhatsApp to (806) 934-2018 or upload them in the app before your appointment."""
        else:
            booking_info = """

📅 **Agenda tu cita aquí:**
👉 https://www.rosstaxpreparation.com/cita

📋 **Documentos que necesitas traer:**
• W-2 (Comprobante de salario)
• 1099 (Si aplica — ingresos independientes)
• Identificación con foto (Licencia/ID/Pasaporte)
• Tarjeta de Seguro Social (SSN) o ITIN
• Comprobante de cuenta bancaria (para depósito directo)
• SSN y fecha de nacimiento de dependientes (si aplica)

📲 Puedes enviar tus documentos por WhatsApp al (806) 934-2018 o subirlos en la app antes de tu cita."""
        
        response = response.replace('[AGENDAR_CITA]', booking_info)
        return response
    
    async def _get_payment_links_context(self) -> str:
        """Get current payment links info for AI context"""
        try:
            db = await get_db()
            if db is None:
                return ""
            
            links = await db.payment_links.find({"status": "pending"}).to_list(50)
            if not links:
                return "LINKS DE PAGO ACTIVOS: No hay links de pago pendientes."
            
            context = "LINKS DE PAGO ACTIVOS:\n"
            for link in links:
                link_id = str(link.get('_id', ''))
                amount = link.get('amount', 0)
                desc = link.get('description', 'Sin descripción')
                client = link.get('client_name', link.get('client_email', 'N/A'))
                status = link.get('status', 'pending')
                context += f"  - ID: {link_id} | ${amount} | {desc} | Cliente: {client} | Estado: {status}\n"
            
            return context
        except Exception as e:
            logging.error(f"Error getting payment links context: {e}")
            return ""
    
    async def _process_payment_commands(self, response: str, language: str = 'es') -> str:
        """Process payment link commands in AI response"""
        import re as regex
        import secrets
        from datetime import datetime, timezone, timedelta
        from bson import ObjectId
        
        is_en = language == 'en'
        
        db = await get_db()
        if db is None:
            return response
        
        # Handle CREATE payment link
        create_match = regex.search(r'\[CREAR_LINK_PAGO\|([^|]+)\|([^|]+)\|([^\]]+)\]', response)
        if create_match:
            try:
                amount = float(create_match.group(1).strip())
                description = create_match.group(2).strip()
                client_email = create_match.group(3).strip()
                
                # Look up client in DB
                client = await db.users.find_one({"email": client_email})
                client_name = f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() if client else client_email
                
                # Generate secure token matching admin endpoint schema
                token = secrets.token_urlsafe(24)
                payment_url = f"https://www.rosstaxpreparation.com/pay/{token}"
                
                new_link = {
                    "token": token,
                    "amount": amount,
                    "description": description,
                    "client_email": client_email,
                    "client_name": client_name,
                    "client_phone": client.get('phone', '') if client else '',
                    "save_card": False,
                    "open_amount": False,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc),
                    "created_by": "ai_ross",
                    "paid_at": None,
                    "payment_method_id": None,
                    "transaction_id": None,
                    "sms_sent": False,
                    "email_sent": False,
                    "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                }
                
                result = await db.payment_links.insert_one(new_link)
                link_id = str(result.inserted_id)
                
                # Replace the command tag with a success message
                success_msg = (
                    f"\n\n✅ **{'Payment link created successfully:' if is_en else 'Link de pago creado exitosamente:'}**\n"
                    f"- {'Amount' if is_en else 'Monto'}: ${amount:.2f}\n"
                    f"- {'Description' if is_en else 'Descripción'}: {description}\n"
                    f"- {'Client' if is_en else 'Cliente'}: {client_name} ({client_email})\n"
                    f"- Link: {payment_url}\n"
                    f"- ID: {link_id}"
                )
                response = response.replace(create_match.group(0), success_msg)
                
                logging.info(f"🤖 AI Ross created payment link: ${amount} for {client_email} token={token}")
                
            except Exception as e:
                logging.error(f"Error creating payment link via AI: {e}")
                response = response.replace(create_match.group(0), f"\n\n❌ {'Error creating payment link' if is_en else 'Error al crear el link de pago'}: {str(e)}")
        
        # Handle LIST payment links
        if '[LISTAR_LINKS_PAGO]' in response:
            try:
                links = await db.payment_links.find({"status": "pending"}).sort('created_at', -1).to_list(50)
                if links:
                    links_text = f"\n\n📋 **{'Pending payment links:' if is_en else 'Links de pago pendientes:'}**\n"
                    for i, link in enumerate(links, 1):
                        lid = str(link.get('_id', ''))
                        amt = link.get('amount', 0)
                        desc = link.get('description', 'N/A')
                        cname = link.get('client_name', link.get('client_email', 'N/A'))
                        created = link.get('created_by', 'admin')
                        created_label = 'Created by' if is_en else 'Creado por'
                        client_label = 'Client' if is_en else 'Cliente'
                        links_text += f"{i}. **${amt:.2f}** — {desc} | {client_label}: {cname} | {created_label}: {created} | ID: {lid}\n"
                    total_label = 'Total' if is_en else 'Total'
                    pending_label = 'pending links' if is_en else 'links pendientes'
                    links_text += f"\n{total_label}: {len(links)} {pending_label}"
                else:
                    links_text = f"\n\n📋 {'No pending payment links at this time.' if is_en else 'No hay links de pago pendientes actualmente.'}"
                
                response = response.replace('[LISTAR_LINKS_PAGO]', links_text)
            except Exception as e:
                logging.error(f"Error listing payment links via AI: {e}")
                response = response.replace('[LISTAR_LINKS_PAGO]', f"\n\n❌ {'Error listing links' if is_en else 'Error al listar links'}: {str(e)}")
        
        # Handle CANCEL payment link
        cancel_match = regex.search(r'\[CANCELAR_LINK_PAGO\|([^\]]+)\]', response)
        if cancel_match:
            try:
                link_identifier = cancel_match.group(1).strip()
                
                # Try to find by ObjectId first, then by token
                link = None
                if ObjectId.is_valid(link_identifier):
                    link = await db.payment_links.find_one({"_id": ObjectId(link_identifier)})
                if not link:
                    link = await db.payment_links.find_one({"token": link_identifier})
                
                if link:
                    if link.get('status') == 'pending':
                        await db.payment_links.update_one(
                            {"_id": link["_id"]},
                            {"$set": {
                                "status": "cancelled",
                                "cancelled_at": datetime.now(timezone.utc),
                                "cancelled_by": "ai_ross"
                            }}
                        )
                        cancel_title = 'Payment link cancelled successfully:' if is_en else 'Link de pago cancelado exitosamente:'
                        amt_label = 'Amount' if is_en else 'Monto'
                        desc_label = 'Description' if is_en else 'Descripción'
                        client_label = 'Client' if is_en else 'Cliente'
                        response = response.replace(
                            cancel_match.group(0),
                            f"\n\n✅ {cancel_title}\n- {amt_label}: ${link.get('amount', 0):.2f}\n- {desc_label}: {link.get('description', 'N/A')}\n- {client_label}: {link.get('client_name', 'N/A')}"
                        )
                        logging.info(f"🤖 AI Ross cancelled payment link: {str(link['_id'])}")
                    else:
                        already_msg = f"The payment link already has status '{link.get('status')}' and cannot be cancelled." if is_en else f"El link de pago ya tiene estado '{link.get('status')}' y no se puede cancelar."
                        response = response.replace(
                            cancel_match.group(0),
                            f"\n\n⚠️ {already_msg}"
                        )
                else:
                    not_found = f"Payment link not found with ID: {link_identifier}" if is_en else f"No se encontró el link de pago con ID: {link_identifier}"
                    response = response.replace(cancel_match.group(0), f"\n\n❌ {not_found}")
            except Exception as e:
                logging.error(f"Error cancelling payment link via AI: {e}")
                response = response.replace(cancel_match.group(0), f"\n\n❌ {'Error cancelling' if is_en else 'Error al cancelar'}: {str(e)}")
        
        return response
    
    async def categorize_document(self, document_name: str, document_text: Optional[str] = None) -> str:
        """Auto-categorización de documentos fiscales"""
        from emergentintegrations.llm.chat import UserMessage
        
        system_message = """
        Eres un experto en clasificación de documentos fiscales.
        Basándote en el nombre del archivo y/o contenido, clasifica el documento en una de estas categorías:
        - w2 (Formulario de salarios W-2)
        - 1099 (Ingresos varios 1099)
        - 1098 (Intereses hipotecarios)
        - receipts (Recibos/gastos)
        - bank_statements (Estados de cuenta bancarios)
        - investment (Documentos de inversión)
        - medical (Gastos médicos)
        - education (Gastos educativos)
        - business (Documentos de negocio)
        - id_document (Licencia de conducir, pasaporte, ID)
        - ssn_card (Tarjeta de seguro social SSN o ITIN)
        - other (Otros documentos no clasificados)
        
        Responde SOLO con el nombre de la categoría, sin explicaciones adicionales.
        """
        
        prompt = f"Nombre del documento: {document_name}"
        if document_text:
            prompt += f"\nContenido: {document_text[:500]}"
        
        try:
            chat = self._get_chat('categorize_doc_session', system_message)
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            category = response.strip().lower()
            for cat in ['w2', '1099', '1098', 'receipts', 'bank_statements', 'investment', 'medical', 'education', 'business', 'id_document', 'ssn_card', 'other']:
                if cat in category:
                    return cat
            return 'other'
        except Exception as e:
            logging.error(f"Error categorizing document: {e}")
            return 'other'
    
    async def categorize_document_with_vision(self, image_base64: str, document_name: str = "") -> Dict:
        """
        Categoriza documentos usando visión AI para analizar la imagen real.
        Retorna la categoría y detalles extraídos del documento.
        """
        from emergentintegrations.llm.chat import UserMessage, ImageContent
        
        # Clean base64 - remove data URL prefix if present
        clean_base64 = image_base64
        if ',' in image_base64:
            # Format: data:image/jpeg;base64,/9j/4AAQ...
            clean_base64 = image_base64.split(',')[1]
        
        # Also remove any whitespace or newlines
        clean_base64 = clean_base64.strip().replace('\n', '').replace('\r', '').replace(' ', '')
        
        logging.info(f"📄 Vision categorization - base64 length: {len(clean_base64)}, first 50 chars: {clean_base64[:50] if len(clean_base64) > 50 else clean_base64}")
        
        system_message = """
        Eres un experto en clasificación y análisis de documentos fiscales y de identidad.
        Tu trabajo es analizar la IMAGEN del documento y determinar exactamente qué tipo de documento es.
        
        CATEGORÍAS VÁLIDAS:
        - w2: Formulario W-2 de salarios (tiene casillas con "Wages, tips", "Federal income tax withheld", employer info)
        - 1099: Formularios 1099 (1099-MISC, 1099-NEC, 1099-INT, etc.)
        - 1098: Formulario 1098 de intereses hipotecarios
        - receipts: Recibos de compras, facturas de gastos
        - bank_statements: Estados de cuenta bancarios
        - investment: Documentos de inversión, 1099-DIV, 1099-B
        - medical: Recibos médicos, seguros de salud, formularios 1095
        - education: Formulario 1098-T, gastos educativos
        - business: Documentos de negocio, LLC, facturas comerciales
        - id_document: Licencia de conducir, pasaporte, ID estatal
        - ssn_card: Tarjeta de Seguro Social (SSN) o ITIN
        - other: Cualquier documento que NO coincida claramente con las categorías anteriores
        
        INSTRUCCIONES:
        1. Analiza cuidadosamente la imagen
        2. Identifica texto, logotipos, formatos oficiales
        3. Si NO puedes identificar claramente el tipo de documento, usa "other"
        4. NO adivines - si la imagen está borrosa o no es un documento reconocible, usa "other"
        
        Responde en JSON con este formato exacto:
        {
            "category": "categoria_exacta",
            "confidence": "high/medium/low",
            "document_type": "descripción del tipo de documento",
            "extracted_info": ["información relevante extraída"],
            "reason": "breve explicación de por qué elegiste esta categoría"
        }
        """
        
        try:
            chat = self._get_vision_chat('vision_categorize_session', system_message)
            
            # Create message with image using ImageContent for base64 images
            message = UserMessage(
                text=f"Analiza esta imagen de documento{' (nombre del archivo: ' + document_name + ')' if document_name else ''}. Determina qué tipo de documento es basándote SOLO en lo que puedes ver en la imagen.",
                file_contents=[ImageContent(image_base64=clean_base64)]
            )
            
            response = await chat.send_message(message)
            
            # Parse JSON response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # Validate category
                valid_categories = ['w2', '1099', '1098', 'receipts', 'bank_statements', 'investment', 
                                   'medical', 'education', 'business', 'id_document', 'ssn_card', 'other']
                
                if result.get('category', '').lower() not in valid_categories:
                    result['category'] = 'other'
                else:
                    result['category'] = result['category'].lower()
                
                return result
            
            return {
                'category': 'other',
                'confidence': 'low',
                'document_type': 'No identificado',
                'extracted_info': [],
                'reason': 'No se pudo analizar la imagen correctamente'
            }
            
        except Exception as e:
            logging.error(f"Error in vision document categorization: {e}")
            return {
                'category': 'other',
                'confidence': 'low',
                'document_type': 'Error',
                'extracted_info': [],
                'reason': f'Error al procesar: {str(e)}'
            }
    
    async def analyze_document(self, document_name: str, document_content: str) -> Dict:
        """Análisis de documentos para extraer información clave"""
        from emergentintegrations.llm.chat import UserMessage
        
        system_message = """
        Eres un experto en análisis de documentos fiscales.
        Analiza el documento y extrae la siguiente información en formato JSON:
        {
            "document_type": "tipo de documento",
            "key_information": ["información clave 1", "información clave 2"],
            "amounts": ["montos encontrados"],
            "dates": ["fechas importantes"],
            "warnings": ["advertencias o información faltante"]
        }
        
        Si no encuentras cierta información, deja el array vacío.
        Responde SOLO con el JSON, sin explicaciones adicionales.
        """
        
        try:
            chat = self._get_chat('analyze_doc_session', system_message)
            message = UserMessage(text=f"Documento: {document_name}\nContenido: {document_content[:1000]}")
            response = await chat.send_message(message)
            
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {}
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            logging.error(f"Error parsing document analysis: {e}")
            return {
                'document_type': 'unknown',
                'key_information': ['Error al analizar el documento'],
                'amounts': [],
                'dates': [],
                'warnings': []
            }
        except Exception as e:
            logging.error(f"Error analyzing document: {e}")
            return {
                'document_type': 'unknown',
                'key_information': ['Error al analizar el documento'],
                'amounts': [],
                'dates': [],
                'warnings': []
            }
    
    async def suggest_missing_documents(self, tax_year: int, existing_documents: List[str]) -> List[Dict]:
        """Asistente virtual que sugiere documentos faltantes"""
        from emergentintegrations.llm.chat import UserMessage
        
        system_message = """
        Eres un asistente experto en preparación de impuestos.
        Basándote en los documentos que el cliente ya tiene, sugiere qué documentos adicionales podrían necesitar.
        
        Para una declaración completa, típicamente se necesitan:
        - W2 (si es empleado)
        - 1099 (si tiene ingresos freelance/contractor)
        - 1098 (si tiene hipoteca)
        - Recibos de gastos deducibles
        - Estados de cuenta bancarios
        - Documentos de inversiones (si aplica)
        - Gastos médicos (si superan el umbral)
        - Gastos educativos (si aplica)
        
        Responde en formato JSON array:
        [
            {
                "document": "nombre del documento",
                "priority": "high/medium/low",
                "reason": "por qué es importante"
            }
        ]
        
        Responde SOLO con el JSON array.
        """
        
        prompt = f"""Año fiscal: {tax_year}
        Documentos existentes: {', '.join(existing_documents) if existing_documents else 'ninguno'}
        
        ¿Qué documentos adicionales debería proporcionar el cliente?
        """
        
        try:
            chat = self._get_chat('suggest_docs_session', system_message)
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return []
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            logging.error(f"Error parsing suggestions: {e}")
            return []
        except Exception as e:
            logging.error(f"Error suggesting documents: {e}")
            return []

# Global instance
ai_service = AIService()
