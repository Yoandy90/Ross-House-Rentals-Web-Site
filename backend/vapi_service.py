"""Vapi.ai Voice AI Service for automated phone calls"""
import os
import httpx
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import json
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class VapiService:
    """Service for managing Vapi.ai voice AI phone system"""
    
    def __init__(self, db):
        self.db = db
        self.api_key = os.getenv("VAPI_API_KEY", "")
        self.base_url = "https://api.vapi.ai"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
    async def get_config(self) -> Dict[str, Any]:
        """Get Vapi configuration from database"""
        config = await self.db.vapi_config.find_one({"active": True})
        if not config:
            # Return default config
            return {
                "assistant_id": "",
                "phone_number_id": "",
                "webhook_url": "",
                "greeting_message": "Gracias por llamar a Ross Tax Preparation. ¿En qué puedo ayudarte hoy?",
                "business_hours": {
                    "monday": {"start": "09:00", "end": "18:00", "enabled": True},
                    "tuesday": {"start": "09:00", "end": "18:00", "enabled": True},
                    "wednesday": {"start": "09:00", "end": "18:00", "enabled": True},
                    "thursday": {"start": "09:00", "end": "18:00", "enabled": True},
                    "friday": {"start": "09:00", "end": "18:00", "enabled": True},
                    "saturday": {"start": "10:00", "end": "14:00", "enabled": True},
                    "sunday": {"start": "00:00", "end": "00:00", "enabled": False}
                },
                "services": [
                    {"name": "Declaración de Impuestos", "description": "Preparación de taxes personales y de negocios"},
                    {"name": "ITIN", "description": "Obtención de número de identificación fiscal"},
                    {"name": "Traducciones", "description": "Traducciones certificadas de documentos"},
                    {"name": "Inmigración", "description": "Servicios de inmigración y visas"}
                ],
                "faqs": [
                    {"question": "¿Cuánto cuesta preparar mis taxes?", "answer": "El costo depende de tu situación. Ofrecemos consultas gratuitas para darte un estimado."},
                    {"question": "¿Qué documentos necesito?", "answer": "Necesitas tu W-2, 1099 si aplica, identificación y seguro social."},
                    {"question": "¿Cuánto tarda el reembolso?", "answer": "El IRS típicamente procesa reembolsos en 21 días si se presenta electrónicamente."}
                ],
                "transfer_number": "",
                "voicemail_enabled": True,
                "language": "es",
                "voice_id": "alloy",
                "active": False
            }
        return config
    
    async def save_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Save Vapi configuration"""
        config["updated_at"] = datetime.utcnow()
        
        existing = await self.db.vapi_config.find_one({"active": True})
        if existing:
            await self.db.vapi_config.update_one(
                {"_id": existing["_id"]},
                {"$set": config}
            )
            config["_id"] = str(existing["_id"])
        else:
            config["created_at"] = datetime.utcnow()
            result = await self.db.vapi_config.insert_one(config)
            config["_id"] = str(result.inserted_id)
        
        return config
    
    async def create_assistant(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update Vapi assistant"""
        if not self.api_key:
            raise ValueError("VAPI_API_KEY not configured")
        
        # Build system prompt based on config
        system_prompt = self._build_system_prompt(config)
        
        assistant_config = {
            "name": "Ross Tax Assistant",
            "firstMessage": config.get("greeting_message", "Gracias por llamar a Ross Tax. ¿En qué puedo ayudarte?"),
            "firstMessageMode": "assistant-speaks-first",
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    }
                ],
                "temperature": 0.7,
                "maxTokens": 500,
                "tools": self._get_tools_config(config)
            },
            "voice": {
                "provider": "openai",
                "voiceId": config.get("voice_id", "alloy")
            },
            "transcriber": {
                "provider": "deepgram",
                "model": "nova-2",
                "language": config.get("language", "es")
            },
            "recordingEnabled": True,
            "interruptionsEnabled": True,
            "endCallFunctionEnabled": True,
            "serverUrl": config.get("webhook_url", "")
        }
        
        async with httpx.AsyncClient() as client:
            if config.get("assistant_id"):
                # Update existing assistant
                response = await client.patch(
                    f"{self.base_url}/assistant/{config['assistant_id']}",
                    headers=self.headers,
                    json=assistant_config,
                    timeout=30.0
                )
            else:
                # Create new assistant
                response = await client.post(
                    f"{self.base_url}/assistant",
                    headers=self.headers,
                    json=assistant_config,
                    timeout=30.0
                )
            
            if response.status_code not in [200, 201]:
                logger.error(f"Vapi API error: {response.text}")
                raise Exception(f"Vapi API error: {response.text}")
            
            return response.json()
    
    def _build_system_prompt(self, config: Dict[str, Any]) -> str:
        """Build the system prompt for the assistant"""
        services = config.get("services", [])
        faqs = config.get("faqs", [])
        
        services_text = "\n".join([f"- {s['name']}: {s['description']}" for s in services])
        faqs_text = "\n".join([f"P: {f['question']}\nR: {f['answer']}" for f in faqs])
        
        return f"""Eres un asistente virtual amigable y profesional de Ross Tax Preparation, una oficina de preparación de impuestos.

Tu objetivo es:
1. Saludar amablemente al cliente
2. Entender qué necesita (agendar cita, información, etc.)
3. Responder preguntas frecuentes
4. Agendar citas cuando sea necesario
5. Transferir a un agente humano si es necesario

SERVICIOS QUE OFRECEMOS:
{services_text}

PREGUNTAS FRECUENTES:
{faqs_text}

REGLAS IMPORTANTES:
- Mantén las respuestas breves (máximo 2-3 oraciones)
- Sé amable y profesional
- Si no sabes algo, ofrece transferir a un agente
- Habla en español a menos que el cliente prefiera inglés
- Para agendar citas, usa la función check_availability
- Para crear citas, usa la función create_appointment
- Si el cliente quiere hablar con una persona, usa transfer_to_agent

HORARIO DE ATENCIÓN:
Lunes a Viernes: 9AM - 6PM
Sábado: 10AM - 2PM
Domingo: Cerrado"""
    
    def _get_tools_config(self, config: Dict[str, Any]) -> List[Dict]:
        """Get the tools configuration for the assistant"""
        webhook_url = config.get("webhook_url", "")
        
        return [
            {
                "type": "function",
                "function": {
                    "name": "check_availability",
                    "description": "Verificar disponibilidad de citas para una fecha específica",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date": {
                                "type": "string",
                                "description": "Fecha solicitada en formato YYYY-MM-DD"
                            }
                        },
                        "required": ["date"]
                    }
                },
                "server": {
                    "url": f"{webhook_url}/tools/check-availability"
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_appointment",
                    "description": "Crear una cita para el cliente",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "customer_name": {
                                "type": "string",
                                "description": "Nombre completo del cliente"
                            },
                            "customer_phone": {
                                "type": "string",
                                "description": "Número de teléfono del cliente"
                            },
                            "appointment_date": {
                                "type": "string",
                                "description": "Fecha y hora de la cita en formato ISO"
                            },
                            "service_type": {
                                "type": "string",
                                "description": "Tipo de servicio solicitado"
                            }
                        },
                        "required": ["customer_name", "appointment_date", "service_type"]
                    }
                },
                "server": {
                    "url": f"{webhook_url}/tools/create-appointment"
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "transfer_to_agent",
                    "description": "Transferir la llamada a un agente humano",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reason": {
                                "type": "string",
                                "description": "Razón de la transferencia"
                            }
                        },
                        "required": ["reason"]
                    }
                },
                "server": {
                    "url": f"{webhook_url}/tools/transfer-agent"
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_business_hours",
                    "description": "Obtener el horario de atención",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                },
                "server": {
                    "url": f"{webhook_url}/tools/business-hours"
                }
            }
        ]
    
    async def list_phone_numbers(self) -> List[Dict[str, Any]]:
        """List available phone numbers from Vapi"""
        if not self.api_key:
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/phone-number",
                    headers=self.headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            logger.error(f"Error listing phone numbers: {e}")
            return []
    
    async def import_phone_number(self, provider: str, phone_number: str, credentials: Dict[str, str]) -> Dict[str, Any]:
        """Import a phone number from Twilio or Vonage"""
        if not self.api_key:
            raise ValueError("VAPI_API_KEY not configured")
        
        payload = {
            "provider": provider,
            "number": phone_number,
            **credentials
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/phone-number",
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Error importing phone number: {response.text}")
            
            return response.json()
    
    async def attach_assistant_to_phone(self, phone_number_id: str, assistant_id: str) -> Dict[str, Any]:
        """Attach an assistant to a phone number for inbound calls"""
        if not self.api_key:
            raise ValueError("VAPI_API_KEY not configured")
        
        payload = {
            "assistantId": assistant_id
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/phone-number/{phone_number_id}",
                headers=self.headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Error attaching assistant: {response.text}")
            
            return response.json()
    
    async def get_call_logs(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get call logs from Vapi"""
        if not self.api_key:
            return []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/call",
                    headers=self.headers,
                    params={"limit": limit, "offset": offset},
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception as e:
            logger.error(f"Error getting call logs: {e}")
            return []
    
    async def get_call_details(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get details of a specific call"""
        if not self.api_key:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/call/{call_id}",
                    headers=self.headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            logger.error(f"Error getting call details: {e}")
            return None
    
    async def save_call_record(self, call_data: Dict[str, Any]) -> str:
        """Save or update call record in database (upsert by call_id)"""
        call_id = call_data.get("id", "")
        
        call_record = {
            "call_id": call_id,
            "customer_number": call_data.get("customer", {}).get("number"),
            "status": call_data.get("status"),
            "call_data": call_data,
            "updated_at": datetime.utcnow()
        }
        
        # Only set duration, transcript, recording if they exist (end-of-call-report)
        if call_data.get("duration") is not None:
            call_record["duration_seconds"] = call_data["duration"]
        if call_data.get("transcript"):
            call_record["transcript"] = call_data["transcript"]
        if call_data.get("recordingUrl"):
            call_record["recording_url"] = call_data["recordingUrl"]
        if call_data.get("startedAt"):
            call_record["started_at"] = call_data["startedAt"]
        if call_data.get("endedAt"):
            call_record["ended_at"] = call_data["endedAt"]
        
        if call_id:
            # Upsert: update existing record for same call, or create new
            result = await self.db.vapi_call_logs.update_one(
                {"call_id": call_id},
                {
                    "$set": call_record,
                    "$setOnInsert": {"created_at": datetime.utcnow()}
                },
                upsert=True
            )
            return str(result.upserted_id or call_id)
        else:
            # No call_id — fallback to insert
            call_record["created_at"] = datetime.utcnow()
            result = await self.db.vapi_call_logs.insert_one(call_record)
            return str(result.inserted_id)
    
    async def get_call_stats(self, days: int = 30) -> Dict[str, Any]:
        """Get call statistics"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {
                "_id": None,
                "total_calls": {"$sum": 1},
                "total_duration": {"$sum": "$duration_seconds"},
                "avg_duration": {"$avg": "$duration_seconds"}
            }}
        ]
        
        result = await self.db.vapi_call_logs.aggregate(pipeline).to_list(1)
        
        if result:
            stats = result[0]
            stats.pop("_id", None)
            return stats
        
        return {
            "total_calls": 0,
            "total_duration": 0,
            "avg_duration": 0
        }
    
    async def check_appointment_availability(self, date_str: str) -> Dict[str, Any]:
        """Check appointment availability for a date"""
        import pytz
        texas_tz = pytz.timezone('America/Chicago')
        
        # Normalize date string to YYYY-MM-DD
        if not date_str:
            return {"available": False, "message": "Fecha no proporcionada"}
        
        # Extract just the date portion
        clean_date = date_str[:10] if len(date_str) >= 10 else date_str
        
        # Get existing appointments for that day (date is stored as string YYYY-MM-DD)
        existing = await self.db.appointments.find({
            "date": clean_date,
            "status": {"$ne": "cancelled"}
        }).to_list(100)
        
        booked_times = [apt.get("time", "") for apt in existing if apt.get("time")]
        
        # Generate available slots (10:00 AM to 2:30 PM, 30 min intervals - office hours)
        available_slots = []
        for hour in range(10, 15):
            for minute in [0, 30]:
                if hour == 14 and minute == 30:
                    continue  # 2:30 PM is closing time
                time_str = f"{hour:02d}:{minute:02d}"
                if time_str not in booked_times:
                    # Format for human reading
                    h = hour if hour <= 12 else hour - 12
                    ampm = "AM" if hour < 12 else "PM"
                    available_slots.append(f"{h}:{minute:02d} {ampm}")
        
        return {
            "date": clean_date,
            "available": len(available_slots) > 0,
            "available_slots": available_slots[:5],
            "total_available": len(available_slots),
            "message": f"Tenemos {len(available_slots)} horarios disponibles para el {clean_date}" if available_slots else f"Lo siento, no hay disponibilidad para el {clean_date}. ¿Desea probar otra fecha?"
        }
    
    async def create_appointment_from_call(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an appointment from a phone call - COMPATIBLE WITH CALENDAR"""
        import pytz
        import uuid
        texas_tz = pytz.timezone('America/Chicago')
        
        # Extract parameters matching VAPI tool: date, time, client_name, client_email, client_phone, service_type, notes
        date_str = data.get("date", "")
        time_str = data.get("time", "")
        client_name = data.get("client_name", data.get("customer_name", ""))
        client_phone = data.get("client_phone", data.get("customer_phone", ""))
        client_email = data.get("client_email", "")
        service_type = data.get("service_type", data.get("service", "Preparacion de Impuestos"))
        # Map VAPI enum values to readable Spanish names
        service_type_map = {
            "tax_preparation": "Preparacion de Impuestos",
            "bookkeeping": "Contabilidad",
            "itin": "Tramite de ITIN",
            "amendment": "Enmienda de Impuestos",
            "consultation": "Consulta General",
            "business_formation": "Formacion de Negocio",
        }
        service_type = service_type_map.get(service_type, service_type)
        notes = data.get("notes", "")
        
        if not client_name:
            return {"success": False, "message": "Se necesita el nombre del cliente para agendar la cita."}
        
        if not date_str:
            return {"success": False, "message": "Se necesita la fecha para la cita. ¿Para qué día desea la cita?"}
        
        # Normalize date
        clean_date = date_str[:10] if len(date_str) >= 10 else date_str
        
        if not time_str:
            return {"success": False, "message": "Se necesita la hora para la cita. ¿A qué hora le gustaría? Nuestro horario es de 10 AM a 2 PM."}
        
        # Normalize time - parse various formats (10 AM, 10:00 AM, 10:00, etc.)
        time_str = time_str.strip().upper()
        # Parse "10 AM", "10:00 AM", "2 PM", "2:30 PM" etc.
        import re
        match = re.match(r'(\d{1,2}):?(\d{2})?\s*(AM|PM)?', time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2) or 0)
            ampm = match.group(3)
            if ampm == 'PM' and hour < 12:
                hour += 12
            elif ampm == 'AM' and hour == 12:
                hour = 0
            time_str = f"{hour:02d}:{minute:02d}"
        else:
            return {"success": False, "message": f"No pude entender la hora '{time_str}'. ¿Puede repetir a qué hora quiere la cita?"}
        
        # Build scheduled_at as timezone-aware datetime
        try:
            naive_dt = datetime.strptime(f"{clean_date} {time_str}", "%Y-%m-%d %H:%M")
            local_dt = texas_tz.localize(naive_dt)
        except Exception as e:
            logger.error(f"Date parse error: {e}")
            return {"success": False, "message": f"No pude entender la fecha '{date_str}' o la hora '{time_str}'. ¿Puede repetir?"}
        
        appointment_id = str(uuid.uuid4())
        import secrets
        management_token = secrets.token_urlsafe(32)
        
        appointment = {
            "_id": appointment_id,
            "user_name": client_name,
            "user_email": client_email,
            "user_phone": client_phone,
            "title": service_type,
            "description": notes or "Cita agendada por asistente de voz AI (Rosa)",
            "date": clean_date,
            "time": time_str,
            "scheduled_at": local_dt,
            "duration_minutes": 30,
            "appointment_type": "in-person",
            "status": "pending",
            "source": "phone_ai",
            "management_token": management_token,
            "notes": notes or "Cita agendada por asistente de voz AI (Rosa)",
            "created_at": datetime.utcnow()
        }
        
        # Build document upload and appointment management URLs
        docs_url = f"https://www.rosstaxpreparation.com/documentos/{management_token}"
        manage_url = f"https://www.rosstaxpreparation.com/mi-cita/{management_token}"
        
        await self.db.appointments.insert_one(appointment)
        
        # Also create a service order automatically
        is_new_client = False
        try:
            import uuid as uuid_mod
            # Find client_id from DB
            client_id = None
            if client_phone:
                import re as re_mod
                clean_digits = re_mod.sub(r'[^\d]', '', client_phone)[-10:]
                user = await self.db.users.find_one(
                    {"$or": [
                        {"phone": {"$regex": clean_digits}},
                        {"phone_number": {"$regex": clean_digits}},
                    ]},
                    {"_id": 1, "email": 1}
                )
                if user:
                    client_id = str(user["_id"])
                    if not client_email:
                        client_email = user.get("email", "")
                else:
                    is_new_client = True
            
            order_id = str(uuid_mod.uuid4())
            order_number = f"ORD-{datetime.now().strftime('%Y%m')}-{str(uuid_mod.uuid4())[:8].upper()}"
            
            # Map service type to order service type
            svc_type_map = {
                "Preparacion de Impuestos": "tax_preparation",
                "Tramite de ITIN": "itin",
                "Enmienda de Impuestos": "amendment",
                "Contabilidad": "bookkeeping",
                "Consulta General": "consultation",
                "Formacion de Negocio": "business_formation",
            }
            order_service_type = svc_type_map.get(service_type, "tax_preparation")
            
            service_order = {
                "_id": order_id,
                "order_number": order_number,
                "client_id": client_id,
                "client_name": client_name,
                "client_email": client_email,
                "client_phone": client_phone,
                "service_type": order_service_type,
                "description": f"{service_type} - Cita {clean_date} a las {time_str}",
                "tax_year": datetime.now().year,
                "status": "pending",
                "priority": "medium",
                "estimated_amount": 0,
                "notes": f"Orden creada automaticamente por Rosa (asistente de voz AI). Cita programada para {clean_date}.",
                "created_by": "rosa_ai",
                "created_by_name": "Rosa (AI)",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "appointment_id": appointment_id,
                "source": "phone_ai",
            }
            
            await self.db.service_orders.insert_one(service_order)
            logger.info(f"📋 Service order {order_number} created for appointment {appointment_id}")
        except Exception as so_err:
            logger.warning(f"Could not create service order for appointment: {so_err}")
        
        # Send document upload request with personalized link via Email + SMS
        try:
            config = await self.db.api_config.find_one({"_id": "main"})
            if config:
                from notification_service import NotificationService
                notif_svc = NotificationService(config)
                
                # Determine required documents based on service type
                doc_map = {
                    "Preparacion de Impuestos": "W-2, 1099, Identificacion con foto, Social Security o ITIN, Informacion bancaria (routing y account number)",
                    "Tramite de ITIN": "Pasaporte vigente, Declaracion de impuestos, Carta de necesidad del ITIN",
                    "Enmienda de Impuestos": "Declaracion original, Documentos corregidos, Identificacion",
                    "Contabilidad": "Estados de cuenta bancarios, Recibos de gastos, Facturas",
                    "Formacion de Negocio": "Identificacion, Informacion del negocio, EIN si ya tiene",
                }
                documents_needed = doc_map.get(service_type, "Identificacion con foto, Social Security o ITIN, Documentos fiscales relevantes")
                
                # Send SMS with appointment confirmation + document link (matching existing format)
                if client_phone and notif_svc.twilio_client:
                    try:
                        formatted_date_sms = local_dt.strftime('%d/%m/%Y')
                        h_sms = local_dt.hour if local_dt.hour <= 12 else local_dt.hour - 12
                        if h_sms == 0:
                            h_sms = 12
                        formatted_time_sms = f"{h_sms}:{local_dt.minute:02d}"
                        
                        sms_body = (
                            f"✅ ¡Cita confirmada en Ross Tax!\n"
                            f"📅 {formatted_date_sms} a las {formatted_time_sms}\n"
                            f"📍 Presencial\n\n"
                            f"📎 SIGUIENTE PASO: Sube tus documentos:\n"
                            f"{docs_url}\n\n"
                            f"📁 Gestiona tu cita:\n"
                            f"{manage_url}\n\n"
                            f"📞 (806) 934-2018"
                        )
                        notif_svc.twilio_client.messages.create(
                            body=sms_body,
                            from_=notif_svc.twilio_phone_number,
                            to=client_phone
                        )
                        logger.info(f"📱 Appointment confirmation SMS sent to {client_phone}")
                    except Exception as sms_err:
                        logger.warning(f"SMS appointment confirmation error: {sms_err}")
                    except Exception as sms_err:
                        logger.warning(f"SMS document link error: {sms_err}")
                
                # Send Email with document upload link (professional template)
                if client_email and not client_email.endswith("@pending.rosstax.com") and notif_svc.sendgrid_client:
                    try:
                        from sendgrid.helpers.mail import Mail
                        
                        h_display = local_dt.hour if local_dt.hour <= 12 else local_dt.hour - 12
                        if h_display == 0:
                            h_display = 12
                        ampm_display = "AM" if local_dt.hour < 12 else "PM"
                        time_display_email = f"{h_display}:{local_dt.minute:02d} {ampm_display}"
                        
                        email_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="color: white; margin: 0;">Cita Confirmada</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p style="font-size: 18px;">Hola <strong>{client_name}</strong>,</p>
                                <p>Tu cita ha sido agendada exitosamente.</p>
                                
                                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                    <p><strong>Fecha:</strong> {clean_date}</p>
                                    <p><strong>Hora:</strong> {time_display_email}</p>
                                    <p><strong>Servicio:</strong> {service_type}</p>
                                    <p><strong>Modalidad:</strong> Presencial</p>
                                    <p><strong>Direccion:</strong> 305 Bruce Ave, Dumas TX 79029</p>
                                </div>

                                <div style="background: #FEF3C7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #F59E0B;">
                                    <h3 style="color: #92400E; margin-top: 0;">Siguiente Paso Importante</h3>
                                    <p>Para agilizar su cita, suba los siguientes documentos <strong>antes</strong> de su visita:</p>
                                    <ul style="margin: 10px 0; padding-left: 20px;">
                                        {"".join(f"<li>{doc.strip()}</li>" for doc in documents_needed.split(","))}
                                    </ul>
                                    <div style="text-align: center; margin: 20px 0;">
                                        <a href="{docs_url}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                            Subir Documentos Ahora
                                        </a>
                                    </div>
                                </div>

                                <div style="background: #E8F4F8; padding: 15px; border-radius: 10px; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>Gestionar mi cita:</strong></p>
                                    <a href="{manage_url}" style="color: #6C1110;">{manage_url}</a>
                                </div>

                                <div style="background: #E8F4F8; padding: 15px; border-radius: 10px; margin: 20px 0;">
                                    <h3 style="color: #5DC1D9; margin-top: 0;">Necesitas Ayuda?</h3>
                                    <p style="margin: 5px 0;"><strong>Telefono:</strong> (806) 934-2018</p>
                                    <p style="margin: 5px 0;"><strong>Email:</strong> info@rosstaxpreparation.com</p>
                                </div>
                                
                                <p style="text-align: center; color: #666; margin-top: 30px;">Gracias por confiar en Ross Tax Preparation!</p>
                            </div>
                        </div>
                        """
                        
                        mail = Mail(
                            from_email=notif_svc.sendgrid_from_email,
                            to_emails=client_email,
                            subject="Cita Confirmada + Suba sus Documentos - Ross Tax Preparation",
                            html_content=email_html
                        )
                        notif_svc.sendgrid_client.send(mail)
                        logger.info(f"📧 Document link email sent to {client_email}")
                    except Exception as email_err:
                        logger.warning(f"Email document link error: {email_err}")
        except Exception as doc_err:
            logger.warning(f"Could not send document request notifications: {doc_err}")
        
        # If new client, send welcome SMS with credentials + app download link
        if is_new_client and client_phone:
            try:
                import secrets as sec_mod
                import string
                from passlib.context import CryptContext
                
                config_wl = await self.db.api_config.find_one({"_id": "main"})
                if config_wl and config_wl.get("twilio_account_sid"):
                    from twilio.rest import Client as TwilioClient
                    from notification_service import NotificationService
                    notif_wl = NotificationService(config_wl)
                    
                    # Generate temp password
                    temp_password = ''.join(sec_mod.choice(string.ascii_letters + string.digits) for _ in range(10))
                    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                    hashed = pwd_context.hash(temp_password)
                    
                    import re as re_mod2
                    clean_d = re_mod2.sub(r'[^\d]', '', client_phone)[-10:]
                    formatted_ph = f"+1{clean_d}" if len(clean_d) == 10 else client_phone
                    
                    # Create new user account
                    name_parts = client_name.split(" ", 1)
                    first_n = name_parts[0] if name_parts else client_name
                    last_n = name_parts[1] if len(name_parts) > 1 else ""
                    user_email_new = client_email if client_email and not client_email.endswith("@pending.rosstax.com") else f"{first_n.lower()}.{clean_d[-4:]}@pending.rosstax.com"
                    
                    new_user = {
                        "_id": str(uuid.uuid4()),
                        "first_name": first_n,
                        "last_name": last_n,
                        "full_name": client_name,
                        "email": user_email_new,
                        "phone": formatted_ph,
                        "phone_number": formatted_ph,
                        "password_hash": hashed,
                        "role": "client",
                        "status": "active",
                        "registration_source": "phone_ai",
                        "registered_by": "Rosa AI",
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "profile_completed": False,
                        "language_preference": "es",
                    }
                    await self.db.users.insert_one(new_user)
                    logger.info(f"🆕 New client created by Rosa: {client_name} ({formatted_ph})")
                    
                    # Update service order with client_id
                    try:
                        await self.db.service_orders.update_one(
                            {"appointment_id": appointment_id},
                            {"$set": {"client_id": new_user["_id"]}}
                        )
                    except Exception:
                        pass
                    
                    # Send welcome SMS with credentials
                    login_id = user_email_new if not user_email_new.endswith("@pending.rosstax.com") else formatted_ph
                    welcome_msg = (
                        f"🏛️ ¡Bienvenido a Ross Tax Preparation!\n\n"
                        f"Hola {first_n}, su cuenta ha sido creada.\n\n"
                        f"📱 SUS CREDENCIALES:\n"
                        f"Usuario: {login_id}\n"
                        f"Clave: {temp_password}\n\n"
                        f"📲 Descargue nuestra app:\n"
                        f"🍎 iOS: https://apps.apple.com/app/mi-reembolso/id6742085498\n"
                        f"🤖 Android: https://play.google.com/store/apps/details?id=com.rosstax.app\n\n"
                        f"🌐 Portal: www.rosstaxpreparation.com\n\n"
                        f"📍 305 Bruce Ave, Dumas TX 79029\n"
                        f"📞 (806) 934-2018\n\n"
                        f"¡Gracias por confiar en nosotros!"
                    )
                    
                    if notif_wl.twilio_client:
                        notif_wl.twilio_client.messages.create(
                            body=welcome_msg,
                            from_=notif_wl.twilio_phone_number,
                            to=formatted_ph
                        )
                        logger.info(f"📱 Welcome SMS with credentials sent to {formatted_ph}")
            except Exception as wl_err:
                logger.warning(f"New client welcome flow error: {wl_err}")
        
        # Format confirmation message
        h = local_dt.hour if local_dt.hour <= 12 else local_dt.hour - 12
        if h == 0:
            h = 12
        ampm = "AM" if local_dt.hour < 12 else "PM"
        time_display = f"{h}:{local_dt.minute:02d} {ampm}"
        
        logger.info(f"✅ Appointment created from call: {client_name} on {clean_date} at {time_str}")
        
        return {
            "success": True,
            "appointment_id": appointment_id,
            "message": f"Perfecto. Su cita ha sido confirmada. {client_name}, lo esperamos el {clean_date} a las {time_display} en nuestra oficina en trescientos cinco Bruce Avenue, Dumas Texas.",
            "confirmation_number": f"APT-{appointment_id[-6:].upper()}",
            "date": clean_date,
            "time": time_display
        }
    
    async def identify_caller(self, caller_phone: str) -> Dict[str, Any]:
        """Identify a caller by their phone number - lookup in users and season_clients"""
        if not caller_phone or len(caller_phone) < 7:
            return {"identified": False, "message": "No tengo un número de teléfono para identificar al cliente."}
        
        # Clean the phone number - keep last 10 digits
        import re
        clean = re.sub(r'[^\d]', '', caller_phone)
        last10 = clean[-10:] if len(clean) >= 10 else clean
        
        # Search in users collection
        phone_query = {"$or": [
            {"phone": {"$regex": last10}},
            {"phone_number": {"$regex": last10}},
            {"celular": {"$regex": last10}},
        ]}
        
        user = await self.db.users.find_one(phone_query, {"password_hash": 0, "password": 0})
        if user:
            # Try first_name/last_name first, fallback to name or full_name
            first_name = user.get('first_name', '')
            last_name = user.get('last_name', '')
            if first_name:
                name = f"{first_name} {last_name}".strip()
            else:
                name = user.get('name', user.get('full_name', '')).strip()
                # Extract first_name from full name for greeting
                if name:
                    parts = name.split()
                    first_name = parts[0] if parts else ''
            
            email = user.get("email", "")
            logger.info(f"✅ Caller identified from users: {name} ({email})")
            return {
                "identified": True,
                "name": name,
                "first_name": first_name,
                "email": email,
                "is_app_user": True,
                "message": f"El cliente que llama es {name}."
            }
        
        # Search in season_clients
        season = await self.db.season_clients.find_one(phone_query)
        if season:
            name = f"{season.get('first_name', '')} {season.get('last_name', '')}".strip()
            email = season.get("email", "")
            logger.info(f"✅ Caller identified from season_clients: {name}")
            return {
                "identified": True,
                "name": name,
                "first_name": season.get("first_name", ""),
                "email": email,
                "is_app_user": False,
                "message": f"El cliente que llama es {name}. Es cliente de temporada."
            }
        
        logger.info(f"ℹ️ Caller {last10} not found in database")
        return {
            "identified": False,
            "message": "No encontré este número en nuestro sistema. Es posible que sea un cliente nuevo."
        }
    
    async def send_sms_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Send an SMS message to a phone number via Twilio"""
        to_phone = data.get("to", data.get("phone", data.get("client_phone", "")))
        message_text = data.get("message", "")
        
        if not to_phone:
            return {"success": False, "message": "Necesito un número de teléfono para enviar el SMS."}
        if not message_text:
            return {"success": False, "message": "Necesito el mensaje a enviar."}
        
        # Clean phone
        import re
        clean = re.sub(r'[^\d]', '', to_phone)
        if len(clean) == 10:
            clean = "1" + clean
        if not clean.startswith("1"):
            clean = "1" + clean
        formatted = f"+{clean}"
        
        try:
            twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
            twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "")
            twilio_phone = os.getenv("TWILIO_PHONE_NUMBER", "")
            
            if not all([twilio_sid, twilio_token, twilio_phone]):
                return {"success": False, "message": "El servicio de SMS no está configurado."}
            
            from twilio.rest import Client as TwilioClient
            client = TwilioClient(twilio_sid, twilio_token)
            
            sms = client.messages.create(
                body=message_text,
                from_=twilio_phone,
                to=formatted
            )
            
            logger.info(f"✅ SMS sent to {formatted}: SID={sms.sid}")
            return {
                "success": True,
                "message": f"SMS enviado exitosamente a {to_phone}.",
                "sid": sms.sid
            }
        except Exception as e:
            logger.error(f"❌ SMS send error: {e}")
            return {"success": False, "message": f"No se pudo enviar el SMS: {str(e)}"}
    
    async def send_whatsapp_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Send a WhatsApp message to a phone number"""
        to_phone = data.get("to", data.get("phone", data.get("client_phone", "")))
        message_text = data.get("message", "")
        
        if not to_phone:
            return {"success": False, "message": "Necesito un número de teléfono para enviar el WhatsApp."}
        if not message_text:
            return {"success": False, "message": "Necesito el mensaje a enviar."}
        
        # Clean phone
        import re
        clean = re.sub(r'[^\d]', '', to_phone)
        if len(clean) == 10:
            clean = "1" + clean
        
        try:
            whatsapp_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
            phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
            
            if not whatsapp_token or not phone_id:
                return {"success": False, "message": "El servicio de WhatsApp no está configurado."}
            
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.post(
                    f"https://graph.facebook.com/v18.0/{phone_id}/messages",
                    headers={
                        "Authorization": f"Bearer {whatsapp_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": clean,
                        "type": "text",
                        "text": {"body": message_text}
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    logger.info(f"✅ WhatsApp sent to {clean}")
                    return {
                        "success": True,
                        "message": f"Mensaje de WhatsApp enviado exitosamente a {to_phone}."
                    }
                else:
                    logger.warning(f"WhatsApp send failed: {resp.status_code} - {resp.text}")
                    return {"success": False, "message": "No se pudo enviar el mensaje de WhatsApp."}
        except Exception as e:
            logger.error(f"❌ WhatsApp send error: {e}")
            return {"success": False, "message": f"Error al enviar WhatsApp: {str(e)}"}
    
    async def search_client(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Search for a client by email or phone"""
        email = data.get("email", "")
        phone = data.get("phone", "")
        
        query = {}
        if email:
            query["email"] = {"$regex": email, "$options": "i"}
        elif phone:
            # Normalize phone number
            clean_phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace("+1", "")
            if len(clean_phone) == 10:
                query["$or"] = [
                    {"phone": {"$regex": clean_phone[-10:]}},
                    {"phone_number": {"$regex": clean_phone[-10:]}}
                ]
            else:
                query["$or"] = [
                    {"phone": {"$regex": phone}},
                    {"phone_number": {"$regex": phone}}
                ]
        else:
            return {"found": False, "message": "Necesito el correo electrónico o número de teléfono del cliente para buscarlo."}
        
        # Search in users collection
        client = await self.db.users.find_one(query, {"password_hash": 0, "password": 0})
        
        if client:
            client["_id"] = str(client["_id"])
            return {
                "found": True,
                "client": {
                    "name": f"{client.get('first_name', '')} {client.get('last_name', '')}".strip(),
                    "email": client.get("email", ""),
                    "phone": client.get("phone", client.get("phone_number", "")),
                    "status": client.get("status", "active")
                },
                "message": f"Encontré al cliente: {client.get('first_name', '')} {client.get('last_name', '')}"
            }
        
        # Also search in season_clients
        season_client = await self.db.season_clients.find_one(query)
        if season_client:
            season_client["_id"] = str(season_client["_id"])
            return {
                "found": True,
                "client": {
                    "name": f"{season_client.get('first_name', '')} {season_client.get('last_name', '')}".strip(),
                    "email": season_client.get("email", ""),
                    "phone": season_client.get("phone", ""),
                },
                "message": f"Encontré al cliente: {season_client.get('first_name', '')} {season_client.get('last_name', '')}"
            }
        
        return {"found": False, "message": "No encontré ningún cliente con esa información. ¿Desea agendar como cliente nuevo?"}
    
    async def check_client_balance(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Check client balance/payment status"""
        client_email = data.get("client_email", "")
        
        if not client_email:
            return {"success": False, "message": "Necesito el correo electrónico del cliente para verificar su balance."}
        
        # Search for service orders
        orders = await self.db.service_orders.find({
            "client_email": {"$regex": client_email, "$options": "i"}
        }).sort("created_at", -1).to_list(5)
        
        if orders:
            total_due = sum(o.get("total_amount", 0) for o in orders if o.get("status") in ["pending", "in_progress"])
            total_paid = sum(o.get("amount_paid", 0) for o in orders)
            
            return {
                "success": True,
                "total_orders": len(orders),
                "total_due": total_due,
                "total_paid": total_paid,
                "message": f"El cliente tiene {len(orders)} órdenes. Balance pendiente: ${total_due:.2f}. Total pagado: ${total_paid:.2f}."
            }
        
        return {"success": True, "total_orders": 0, "total_due": 0, "message": "No se encontraron órdenes para este cliente."}
    
    async def send_appointment_confirmation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Send appointment confirmation via SMS (Twilio), WhatsApp, and Email (using NotificationService template)"""
        client_name = data.get("client_name", "")
        client_phone = data.get("client_phone", "")
        client_email = data.get("client_email", "")
        date = data.get("date", "")
        time_str = data.get("time", "")
        service_type = data.get("service_type", "Preparacion de Impuestos")
        
        if not client_phone:
            return {"success": False, "message": "No tengo el numero de telefono para enviar la confirmacion."}
        
        # Normalize phone
        clean_phone = client_phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not clean_phone.startswith("+"):
            digits_only = ''.join(c for c in clean_phone if c.isdigit())
            clean_phone = f"+1{digits_only[-10:]}" if len(digits_only) >= 10 else f"+{digits_only}"
        
        # SMS/WhatsApp text (plain text, no emojis for TTS compat)
        message_text = (
            f"Ross Tax Preparation - Confirmacion de Cita\n\n"
            f"Hola {client_name}!\n\n"
            f"Su cita ha sido confirmada:\n"
            f"Fecha: {date}\n"
            f"Hora: {time_str}\n"
            f"Servicio: {service_type}\n"
            f"Direccion: 305 Bruce Ave, Dumas TX 79029\n\n"
            f"Si necesita cambiar su cita, llame al (806) 934-2018.\n"
            f"Gracias por confiar en Ross Tax!"
        )
        
        sent_via = []
        send_errors = []
        config = None
        try:
            config = await self.db.api_config.find_one({"_id": "main"})
        except Exception:
            pass
        
        # 1. Try SMS via Twilio (primary - most reliable)
        try:
            if config and config.get("twilio_account_sid") and config.get("twilio_auth_token"):
                from twilio.rest import Client as TwilioClient
                tc = TwilioClient(config["twilio_account_sid"], config["twilio_auth_token"])
                twilio_phone = config.get("twilio_phone_number", "+18065914974")
                
                sms_result = tc.messages.create(
                    body=message_text,
                    from_=twilio_phone,
                    to=clean_phone
                )
                sent_via.append("SMS")
                logger.info(f"SMS confirmacion enviado a {clean_phone} sid={sms_result.sid}")
            else:
                send_errors.append("SMS: Twilio no configurado")
        except Exception as e:
            send_errors.append(f"SMS: {str(e)[:100]}")
            logger.warning(f"Error enviando SMS de confirmacion: {e}")
        
        # 2. Try WhatsApp (secondary)
        try:
            whatsapp_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
            phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
            
            if whatsapp_token and phone_id:
                async with httpx.AsyncClient() as client_http:
                    resp = await client_http.post(
                        f"https://graph.facebook.com/v18.0/{phone_id}/messages",
                        headers={"Authorization": f"Bearer {whatsapp_token}", "Content-Type": "application/json"},
                        json={
                            "messaging_product": "whatsapp",
                            "to": clean_phone.replace("+", ""),
                            "type": "text",
                            "text": {"body": message_text}
                        },
                        timeout=10
                    )
                    if resp.status_code == 200:
                        sent_via.append("WhatsApp")
                        logger.info(f"WhatsApp confirmacion enviado a {clean_phone}")
                    else:
                        wa_error = resp.text[:300]
                        send_errors.append(f"WhatsApp: HTTP {resp.status_code} - {wa_error}")
                        logger.warning(f"WhatsApp send failed: {resp.status_code} - {wa_error}")
            else:
                send_errors.append(f"WhatsApp: tokens no configurados (token={'SET' if whatsapp_token else 'EMPTY'}, phone_id={'SET' if phone_id else 'EMPTY'})")
        except Exception as e:
            send_errors.append(f"WhatsApp: {str(e)[:100]}")
            logger.warning(f"Error enviando WhatsApp de confirmacion: {e}")
        
        # 3. Email via NotificationService (professional template)
        try:
            # Find client email from DB if not provided
            if not client_email and self.db is not None:
                import re
                clean_digits = re.sub(r'[^\d]', '', client_phone)[-10:]
                user = await self.db.users.find_one(
                    {"$or": [
                        {"phone": {"$regex": clean_digits}},
                        {"phone_number": {"$regex": clean_digits}},
                    ]},
                    {"email": 1}
                )
                if user:
                    client_email = user.get("email", "")
                    logger.info(f"Email encontrado en DB: {client_email}")
            
            if config and client_email and not client_email.endswith("@pending.rosstax.com"):
                from notification_service import NotificationService
                notif_svc = NotificationService(config)
                
                # Build datetime object for the professional template
                apt_datetime = datetime.now()
                try:
                    date_part = date if date else datetime.now().strftime("%Y-%m-%d")
                    time_part = time_str if time_str else "10:00 AM"
                    # Parse common time formats
                    for fmt in ["%Y-%m-%d %I:%M %p", "%Y-%m-%d %H:%M"]:
                        try:
                            apt_datetime = datetime.strptime(f"{date_part} {time_part}", fmt)
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass
                
                email_sent = await notif_svc.send_appointment_confirmation_email(
                    to_email=client_email,
                    user_name=client_name,
                    appointment_date=apt_datetime,
                    appointment_type=service_type,
                    description=f"Cita agendada por telefono con Rosa"
                )
                if email_sent:
                    sent_via.append("Email")
                    logger.info(f"Email confirmacion enviado a {client_email}")
                else:
                    send_errors.append("Email: NotificationService retorno False")
            elif not client_email:
                send_errors.append("Email: no se encontro email del cliente")
            else:
                send_errors.append(f"Email: config no disponible o email invalido ({client_email})")
        except Exception as e:
            send_errors.append(f"Email: {str(e)[:150]}")
            logger.warning(f"Error enviando email de confirmacion: {e}")
        
        # Log all send results to DB for debugging
        try:
            await self.db.vapi_webhook_debug.insert_one({
                "call_id": "confirmation_send",
                "message_type": "CONFIRMATION_SEND_RESULT",
                "client_phone": client_phone,
                "client_email": client_email,
                "sent_via": sent_via,
                "errors": send_errors,
                "timestamp": datetime.now(timezone.utc),
            })
        except Exception:
            pass
        
        if sent_via:
            channels = ", ".join(sent_via)
            return {"success": True, "message": f"Confirmacion enviada por {channels} a {client_phone}."}
        else:
            return {"success": False, "message": "No se pudo enviar la confirmacion, pero la cita queda registrada en el sistema. El cliente puede verificar en la app o llamando a la oficina."}
    
    async def check_refund_status(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Check IRS refund status for a client"""
        client_email = data.get("client_email", "")
        filing_year = data.get("filing_year", "2025")
        
        if not client_email:
            return {"success": False, "message": "Necesito el correo electrónico del cliente para verificar el estado de su reembolso."}
        
        # Search for tax returns
        tax_return = await self.db.tax_returns.find_one({
            "email": {"$regex": client_email, "$options": "i"},
            "tax_year": str(filing_year)
        })
        
        if tax_return:
            status = tax_return.get("filing_status", "unknown")
            refund_amount = tax_return.get("refund_amount", 0)
            
            return {
                "success": True,
                "filing_status": status,
                "refund_amount": refund_amount,
                "message": f"El estado de la declaración del {filing_year} es: {status}. Reembolso estimado: ${refund_amount:.2f}."
            }
        
        return {"success": True, "message": f"No encontré una declaración del {filing_year} para este correo. Le recomiendo verificar con su preparador de impuestos."}

    async def create_and_send_payment_link(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a payment link and send it to the client via SMS/WhatsApp"""
        import secrets
        
        client_name = data.get("client_name", "")
        client_phone = data.get("client_phone", "")
        client_email = data.get("client_email", "")
        amount = data.get("amount", 0)
        description = data.get("description", data.get("service_type", "Servicios de impuestos"))
        
        if not client_name:
            return {"success": False, "message": "Necesito el nombre del cliente para crear el link de pago."}
        
        if not client_phone and not client_email:
            return {"success": False, "message": "Necesito el teléfono o correo del cliente para enviar el link de pago."}
        
        try:
            if isinstance(amount, str):
                amount = float(amount.replace("$", "").replace(",", "").strip())
            amount = float(amount)
        except (ValueError, TypeError):
            amount = 0
        
        open_amount = amount <= 0
        
        try:
            token = secrets.token_urlsafe(24)
            
            link_doc = {
                'token': token,
                'amount': amount if not open_amount else 0,
                'description': description,
                'client_name': client_name,
                'client_email': client_email,
                'client_phone': client_phone,
                'save_card': False,
                'open_amount': open_amount,
                'status': 'pending',
                'created_by': 'rosa_ai_assistant',
                'created_at': datetime.utcnow(),
                'paid_at': None,
                'payment_method_id': None,
                'transaction_id': None,
                'sms_sent': False,
                'email_sent': False,
                'expires_at': datetime.utcnow() + timedelta(days=7),
            }
            
            result = await self.db.payment_links.insert_one(link_doc)
            payment_url = f"https://www.rosstaxpreparation.com/pay/{token}"
            
            logger.info(f"🔗 Payment link created by Rosa AI: ${amount} for {client_name} -> {payment_url}")
            
            # Send via WhatsApp if phone available
            whatsapp_sent = False
            
            if client_phone:
                clean_phone = client_phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                if not clean_phone.startswith("+"):
                    if not clean_phone.startswith("1"):
                        clean_phone = "1" + clean_phone
                    clean_phone = "+" + clean_phone
                
                amount_text = f"${amount:.2f}" if not open_amount else "monto pendiente"
                
                whatsapp_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
                phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
                
                if whatsapp_token and phone_id:
                    wa_message = (
                        f"🏛️ *Ross Tax Preparation*\n\n"
                        f"Hola {client_name},\n\n"
                        f"Le enviamos este link de pago seguro"
                    )
                    if not open_amount:
                        wa_message += f" por *{amount_text}*"
                    if description:
                        wa_message += f" por concepto de: _{description}_"
                    wa_message += f"\n\n💳 Pague aquí: {payment_url}\n\n"
                    wa_message += "🔒 Pago 100% seguro • SSL Encriptado\n"
                    wa_message += "📍 Ross Tax Preparation • (806) 934-2018"
                    
                    try:
                        async with httpx.AsyncClient() as client_http:
                            resp = await client_http.post(
                                f"https://graph.facebook.com/v18.0/{phone_id}/messages",
                                headers={"Authorization": f"Bearer {whatsapp_token}", "Content-Type": "application/json"},
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": clean_phone.replace("+", ""),
                                    "type": "text",
                                    "text": {"body": wa_message}
                                },
                                timeout=10
                            )
                            if resp.status_code == 200:
                                whatsapp_sent = True
                                logger.info(f"📱 WhatsApp payment link sent to {clean_phone}")
                    except Exception as e:
                        logger.error(f"WhatsApp send error: {e}")
            
            await self.db.payment_links.update_one(
                {'_id': result.inserted_id},
                {'$set': {'whatsapp_sent': whatsapp_sent}}
            )
            
            amount_display = f"${amount:.2f}" if not open_amount else "monto abierto"
            send_msg = f" y se lo hemos enviado por WhatsApp" if whatsapp_sent else ". Le puede compartir el siguiente link"
            
            return {
                "success": True,
                "payment_url": payment_url,
                "amount": amount_display,
                "message": f"¡Listo! Hemos creado un link de pago de {amount_display} para {client_name}{send_msg}: {payment_url}",
                "whatsapp_sent": whatsapp_sent
            }
            
        except Exception as e:
            logger.error(f"Error creating payment link: {e}", exc_info=True)
            return {"success": False, "message": "Hubo un error al crear el link de pago. Por favor intente de nuevo o visite nuestra oficina."}
    
    async def process_card_payment_dtmf(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a direct card payment collected via DTMF (phone keypad)"""
        import uuid
        
        card_number = data.get("card_number", "").replace(" ", "").replace("-", "")
        expiry = data.get("expiry", "")  # MMYY or MM/YY
        cvv = data.get("cvv", "")
        amount = data.get("amount", 0)
        client_email = data.get("client_email", "")
        client_name = data.get("client_name", "")
        description = data.get("description", "Pago por teléfono - Ross Tax")
        
        # Validate inputs
        if not card_number or len(card_number) < 13:
            return {"success": False, "message": "El número de tarjeta no es válido. Por favor intente de nuevo."}
        if not expiry:
            return {"success": False, "message": "Necesito la fecha de vencimiento de la tarjeta."}
        if not cvv or len(cvv) < 3:
            return {"success": False, "message": "El código de seguridad (CVV) no es válido."}
        
        try:
            if isinstance(amount, str):
                amount = float(amount.replace("$", "").replace(",", "").strip())
            amount = float(amount)
            if amount <= 0:
                return {"success": False, "message": "El monto debe ser mayor a cero."}
        except (ValueError, TypeError):
            return {"success": False, "message": "El monto no es válido."}
        
        try:
            from merchant_one_service import MerchantOneService, build_card_vault_payload, build_card_sale_payload, is_merchant_success, extract_merchant_error, detect_card_brand
            
            # Parse expiry: MM/YY or MMYY
            exp_clean = expiry.replace("/", "").replace(" ", "")
            if len(exp_clean) == 4:
                exp_month = int(exp_clean[:2])
                exp_year = int("20" + exp_clean[2:4])
            elif len(exp_clean) == 6:
                exp_month = int(exp_clean[:2])
                exp_year = int(exp_clean[2:6])
            else:
                return {"success": False, "message": "Formato de fecha de vencimiento inválido. Use MMYY."}
            
            card_brand = detect_card_brand(card_number)
            last_4 = card_number[-4:]
            
            # Step 1: Add card to NMI vault
            vault_payload, vault_id = build_card_vault_payload(
                card_number=card_number,
                exp_month=exp_month,
                exp_year=exp_year,
                cvv=cvv,
                first_name=client_name.split()[0] if client_name else "Phone",
                last_name=" ".join(client_name.split()[1:]) if client_name and len(client_name.split()) > 1 else "Customer",
                email=client_email
            )
            
            merchant_service = MerchantOneService(self.db)
            vault_response = await merchant_service._make_request(vault_payload)
            
            if not is_merchant_success(vault_response):
                error_msg = extract_merchant_error(vault_response)
                logger.error(f"NMI vault add failed for phone payment: {error_msg}")
                return {"success": False, "message": f"La tarjeta fue rechazada: {error_msg}. Por favor intente con otra tarjeta."}
            
            # Use our pre-generated vault_id directly.
            # NMI accepts the customer_vault_id we send but does NOT echo it back 
            # in the response body. Since we sent it and NMI confirmed success,
            # our generated ID is the correct one to use for the subsequent sale.
            actual_vault_id = vault_id
            logger.info(f"✅ Card vaulted successfully with pre-generated ID: {actual_vault_id}")
            
            # Step 2: Charge the card from vault
            order_id = f"PHONE-{uuid.uuid4().hex[:8].upper()}"
            sale_payload = build_card_sale_payload(
                customer_vault_id=actual_vault_id,
                amount=amount,
                order_id=order_id,
                order_description=description
            )
            
            sale_response = await merchant_service._make_request(sale_payload)
            
            if not is_merchant_success(sale_response):
                error_msg = extract_merchant_error(sale_response)
                logger.error(f"NMI charge failed for phone payment: {error_msg}")
                return {"success": False, "message": f"No se pudo procesar el cobro: {error_msg}. Por favor intente de nuevo."}
            
            transaction_id = sale_response.transactionId or order_id
            
            # Save transaction record
            payment_record = {
                'transaction_id': transaction_id,
                'auth_code': sale_response.authCode,
                'amount': amount,
                'order_id': order_id,
                'card_last_4': last_4,
                'card_brand': card_brand,
                'nmi_vault_id': vault_id,
                'processor': 'merchant_one_nmi',
                'source': 'phone_ai_dtmf',
                'client_name': client_name,
                'client_email': client_email,
                'status': 'approved',
                'created_at': datetime.utcnow(),
            }
            await self.db.payment_transactions.insert_one(payment_record)
            
            logger.info(f"✅ Phone DTMF payment: ${amount:.2f} charged to {card_brand} ****{last_4} (txn: {transaction_id})")
            
            return {
                "success": True,
                "message": f"¡Pago procesado exitosamente! Se han cobrado ${amount:.2f} a su tarjeta {card_brand} terminación {last_4}. Su número de confirmación es {order_id}. Recibirá un recibo por correo electrónico.",
                "transaction_id": transaction_id,
                "confirmation_number": order_id,
                "amount": f"${amount:.2f}",
                "card_last_4": last_4,
                "card_brand": card_brand
            }
            
        except ImportError:
            logger.error("MerchantOneService not available for DTMF payment")
            return {"success": False, "message": "El servicio de pagos no está disponible en este momento. Le enviaré un link de pago por WhatsApp."}
        except Exception as e:
            logger.error(f"Error processing DTMF payment: {e}", exc_info=True)
            return {"success": False, "message": "Hubo un error al procesar el pago. Por favor intente de nuevo o visite nuestra oficina."}