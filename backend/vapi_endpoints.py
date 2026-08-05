"""Vapi.ai webhook and API endpoints"""
from fastapi import APIRouter, Request, HTTPException, Depends, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import logging
import json
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vapi", tags=["Vapi Voice AI"])

# Will be initialized with db
vapi_service = None
ai_brain = None  # Connected AI Brain for advanced queries
_db = None  # Database reference for business info queries


async def _get_business_info() -> Dict[str, Any]:
    """
    Get business info from the database (business_info collection).
    Falls back to hardcoded defaults if DB is unavailable.
    """
    defaults = {
        'company_name': 'Ross Tax Preparation',
        'phone': '(806) 934-2018',
        'phone_raw': '+18069342018',
        'email': 'info@rosstaxpreparation.com',
        'website': 'rosstaxpreparation.com',
        'address': {'full': '305 Bruce Ave, Dumas, TX 79029'},
        'hours_summary': 'Lunes a Viernes 10:00 AM - 2:00 PM, Horario Central (CST/CDT)',
        'business_hours': {},
        'services': [],
        'timezone': 'America/Chicago',
    }
    
    if _db is None:
        return defaults
    
    try:
        info = await _db.business_info.find_one({}, {'_id': 0})
        if info:
            return info
    except Exception as e:
        logger.warning(f"Could not fetch business_info from DB: {e}")
    
    return defaults

def init_vapi_endpoints(db):
    """Initialize Vapi endpoints with database"""
    global vapi_service, _db
    from vapi_service import VapiService
    vapi_service = VapiService(db)
    _db = db
    return router

def connect_ai_brain(brain_instance):
    """Connect the AI Brain to Rosa for advanced intelligence"""
    global ai_brain
    ai_brain = brain_instance
    logger.info("🧠 AI Brain connected to Rosa (VAPI)")

# ============== Configuration Endpoints ==============

@router.get("/config")
async def get_vapi_config():
    """Get current Vapi configuration"""
    config = await vapi_service.get_config()
    if "_id" in config:
        config["_id"] = str(config["_id"])
    return config

@router.post("/config")
async def save_vapi_config(config: Dict[str, Any] = Body(...)):
    """Save Vapi configuration"""
    result = await vapi_service.save_config(config)
    return {"success": True, "config": result}

@router.post("/assistant/create")
async def create_or_update_assistant():
    """Create or update the Vapi assistant"""
    config = await vapi_service.get_config()
    
    if not os.getenv("VAPI_API_KEY"):
        raise HTTPException(status_code=400, detail="VAPI_API_KEY not configured")
    
    result = await vapi_service.create_assistant(config)
    
    # Save assistant ID to config
    config["assistant_id"] = result.get("id")
    await vapi_service.save_config(config)
    
    return {"success": True, "assistant": result}

@router.get("/phone-numbers")
async def list_phone_numbers():
    """List available phone numbers"""
    numbers = await vapi_service.list_phone_numbers()
    return {"phone_numbers": numbers}

@router.post("/phone-numbers/import")
async def import_phone_number(
    provider: str = Body(...),
    phone_number: str = Body(...),
    account_sid: Optional[str] = Body(None),
    auth_token: Optional[str] = Body(None),
    api_key: Optional[str] = Body(None),
    api_secret: Optional[str] = Body(None)
):
    """Import a phone number from Twilio or Vonage"""
    credentials = {}
    
    if provider == "twilio":
        if not account_sid or not auth_token:
            raise HTTPException(status_code=400, detail="Twilio credentials required")
        credentials = {
            "twilioAccountSid": account_sid,
            "twilioAuthToken": auth_token
        }
    elif provider == "vonage":
        if not api_key or not api_secret:
            raise HTTPException(status_code=400, detail="Vonage credentials required")
        credentials = {
            "vonageApiKey": api_key,
            "vonageApiSecret": api_secret
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'twilio' or 'vonage'")
    
    result = await vapi_service.import_phone_number(provider, phone_number, credentials)
    return {"success": True, "phone_number": result}

@router.post("/phone-numbers/{phone_number_id}/attach")
async def attach_assistant(phone_number_id: str):
    """Attach assistant to phone number"""
    config = await vapi_service.get_config()
    
    if not config.get("assistant_id"):
        raise HTTPException(status_code=400, detail="No assistant configured. Create one first.")
    
    result = await vapi_service.attach_assistant_to_number(
        phone_number_id, config["assistant_id"]
    )
    return {"success": True, "result": result}

@router.get("/agents")
async def list_agents():
    """List all configured agents"""
    agents = await vapi_service.list_agents()
    return {"agents": agents}

@router.post("/agents")
async def create_agent(agent_data: Dict[str, Any] = Body(...)):
    """Create a new agent"""
    result = await vapi_service.create_agent(agent_data)
    return {"success": True, "agent": result}

@router.put("/agents/{agent_id}")
async def update_agent(agent_id: str, agent_data: Dict[str, Any] = Body(...)):
    """Update an agent"""
    result = await vapi_service.update_agent(agent_id, agent_data)
    return {"success": True, "agent": result}

@router.get("/call-stats")
async def get_call_stats(days: int = 30):
    """Get call statistics"""
    stats = await vapi_service.get_call_stats(days)
    return stats

@router.get("/call-logs")
async def get_call_logs(limit: int = 20, skip: int = 0):
    """Get call history"""
    logs = await vapi_service.get_call_logs(limit, skip)
    return {"logs": logs}

# ============== WEBHOOK (Main Entry Point) ==============

@router.post("/webhook")
async def handle_vapi_webhook(request: Request):
    """Handle Vapi webhook events"""
    try:
        payload = await request.json()
        message = payload.get("message", {})
        message_type = message.get("type")
        
        # VAPI puts ALL data inside "message": call, customer, phoneNumber, assistant
        # Extract call data from the correct location
        call_data = message.get("call", payload.get("call", {}))
        customer_data = message.get("customer", call_data.get("customer", {}))
        caller_phone = customer_data.get("number", "")
        call_id = call_data.get("id", "unknown")
        
        logger.info(f"🔔 Vapi webhook: {message_type} | call: {call_id[:15]} | phone: {caller_phone}")
        
        # DEBUG: Log webhook to MongoDB
        try:
            await _db.vapi_webhook_debug.insert_one({
                "call_id": call_id,
                "message_type": message_type,
                "caller_phone": caller_phone,
                "timestamp": datetime.now(timezone.utc),
                "has_tool_calls": "toolWithToolCallList" in message,
            })
        except Exception:
            pass
        
        # Handle assistant-request: VAPI asks which assistant to use for this call
        if message_type == "assistant-request":
            logger.info("🤖 Assistant request - returning full Rosa config")
            try:
                import httpx
                vapi_key = os.getenv("VAPI_API_KEY", "")
                assistant_id = "620a95b4-12a4-472c-9c94-14ab611f52a8"
                async with httpx.AsyncClient(timeout=10) as http_client:
                    resp = await http_client.get(
                        f"https://api.vapi.ai/assistant/{assistant_id}",
                        headers={"Authorization": f"Bearer {vapi_key}"}
                    )
                    if resp.status_code == 200:
                        assistant_config = resp.json()
                        for key in ["id", "orgId", "createdAt", "updatedAt", "isServerUrlSecretSet"]:
                            assistant_config.pop(key, None)
                        logger.info(f"✅ Returning assistant with {len(assistant_config.get('model',{}).get('tools',[]))} tools")
                        return {"assistant": assistant_config}
            except Exception as e:
                logger.error(f"❌ Error in assistant-request: {e}")
            return {"assistantId": "620a95b4-12a4-472c-9c94-14ab611f52a8"}
        
        if message_type in ("call-started", "assistant.started", "status-update"):
            if message_type == "status-update" and message.get("status") != "in-progress":
                return {"received": True}
            
            logger.info(f"📞 Call started from: {caller_phone}")
            caller_info = await vapi_service.identify_caller(caller_phone) if caller_phone else {}
            caller_name = caller_info.get("name", "")
            
            await vapi_service.save_call_record({
                "id": call_id,
                "customer": customer_data,
                "status": "started",
                "caller_identified": caller_info.get("identified", False),
                "caller_name": caller_name,
                "caller_email": caller_info.get("email", "")
            })
            
            if caller_info.get("identified"):
                logger.info(f"✅ Pre-identified caller: {caller_name}")
            
            # Do NOT return messageResponse - it overrides assistant config
            # Let the assistant use identify_caller tool naturally during the conversation.
            
        elif message_type == "tool-calls":
            logger.info("🔧 Processing tool calls...")
            # Log the incoming tool payload for debugging
            try:
                tool_list = message.get("toolWithToolCallList", [])
                tool_summary = [
                    {
                        "name": t.get("name"),
                        "fn_name": t.get("function", {}).get("name"),
                        "id": t.get("toolCall", {}).get("id"),
                        "params": t.get("toolCall", {}).get("parameters", {})
                    }
                    for t in tool_list
                ]
                await _db.vapi_webhook_debug.insert_one({
                    "call_id": call_id,
                    "message_type": "TOOL_CALL_INCOMING",
                    "tool_summary": tool_summary,
                    "caller_phone": caller_phone,
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass
            
            response = await handle_tool_calls(payload)
            
            # Log the response for debugging
            try:
                await _db.vapi_webhook_debug.insert_one({
                    "call_id": call_id,
                    "message_type": "TOOL_RESPONSE",
                    "response": json.dumps(response, default=str)[:3000],
                    "timestamp": datetime.now(timezone.utc),
                })
            except Exception:
                pass
            return response
            
        elif message_type == "end-of-call-report":
            # VAPI puts data inside "message"
            eoc_call = message.get("call", {})
            eoc_artifact = message.get("artifact", payload.get("artifact", {}))
            
            logger.info(f"📞 Call ended: {eoc_call.get('id')} | Duration: {eoc_call.get('duration')}s")
            
            await vapi_service.save_call_record({
                "id": eoc_call.get("id", call_id),
                "customer": message.get("customer", eoc_call.get("customer", customer_data)),
                "status": "ended",
                "duration": eoc_call.get("duration"),
                "transcript": eoc_artifact.get("transcript"),
                "recordingUrl": eoc_artifact.get("recordingUrl"),
                "startedAt": eoc_call.get("startedAt"),
                "endedAt": eoc_call.get("endedAt")
            })
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"❌ Webhook error: {e}", exc_info=True)
        return {"received": True, "error": str(e)}


async def handle_tool_calls(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handle tool function calls from VAPI assistant"""
    import re
    
    message = payload.get("message", {})
    tools = message.get("toolWithToolCallList", [])
    
    # VAPI puts call/customer data INSIDE "message", not at top level
    call_data = message.get("call", payload.get("call", {}))
    customer_data = message.get("customer", call_data.get("customer", {}))
    caller_phone = customer_data.get("number", "")
    # Normalize caller phone: strip +1 prefix, keep last 10 digits
    caller_clean = re.sub(r'[^\d]', '', caller_phone)[-10:] if caller_phone else ""
    
    logger.info(f"🔧 Processing {len(tools)} tool calls | Phone: {caller_phone} | Clean: {caller_clean}")
    
    # Debug: log full tool structure with parameters
    try:
        tool_debug = []
        for t in tools:
            tc = t.get("toolCall", {})
            tool_debug.append({
                "name": t.get("name") or t.get("function", {}).get("name"),
                "params": tc.get("parameters", {}),
            })
        logger.info(f"🔍 Tool calls with params: {json.dumps(tool_debug, default=str)}")
    except Exception:
        pass
    
    results = []
    
    for tool in tools:
        # VAPI format: tool name is at root level as "name", NOT inside "function"
        # Support both formats for backward compatibility
        tool_name = tool.get("name") or tool.get("function", {}).get("name")
        tool_call = tool.get("toolCall", {})
        tool_call_id = tool_call.get("id")
        parameters = tool_call.get("parameters", {})
        
        logger.info(f"🔧 Tool call: {tool_name} | Params: {json.dumps(parameters, default=str)} | Caller: {caller_clean}")
        
        result = ""
        
        try:
            # ========= SCHEDULE APPOINTMENT (Safe - no confidential data) =========
            if tool_name == "schedule_appointment":
                # Inject caller's actual phone number (GPT often uses office phone by mistake)
                if caller_phone:
                    parameters["client_phone"] = caller_phone
                
                # Auto-fill client_name from DB if not provided by GPT
                if not parameters.get("client_name") and not parameters.get("customer_name"):
                    if caller_phone and _db is not None:
                        try:
                            caller_info = await vapi_service.identify_caller(caller_phone)
                            if caller_info.get("identified"):
                                parameters["client_name"] = caller_info.get("name", "")
                                parameters["client_email"] = caller_info.get("email", "")
                                logger.info(f"📋 Auto-filled client_name from DB: {parameters['client_name']}")
                        except Exception as e:
                            logger.warning(f"Could not auto-fill client name: {e}")
                
                # Auto-fill date if missing: tell Rosa to ask instead of defaulting
                if not parameters.get("date"):
                    result = json.dumps({
                        "success": False, 
                        "message": "No tengo la fecha. Pregúntale al cliente qué día le queda bien para su cita."
                    }, ensure_ascii=False)
                    logger.warning("📅 schedule_appointment called WITHOUT date - asking Rosa to ask client")
                else:
                    # Fix wrong year: if date year is not current, replace with current year
                    if parameters.get("date"):
                        from datetime import date as date_cls
                        today = date_cls.today()
                        try:
                            d = parameters["date"][:10]
                            parts = d.split("-")
                            if len(parts) == 3 and int(parts[0]) < today.year:
                                parameters["date"] = f"{today.year}-{parts[1]}-{parts[2]}"
                        except Exception:
                            pass
                    
                    # If time is missing, tell Rosa to ask instead of defaulting
                    if not parameters.get("time"):
                        result = json.dumps({
                            "success": False,
                            "message": "No tengo la hora. Pregúntale al cliente a qué hora le gustaría su cita. Nuestro horario es de 10 AM a 2 PM."
                        }, ensure_ascii=False)
                        logger.warning("⏰ schedule_appointment called WITHOUT time - asking Rosa to ask client")
                    else:
                        logger.info(f"📅 Final schedule params: date={parameters.get('date')} time={parameters.get('time')} name={parameters.get('client_name')} phone={parameters.get('client_phone')}")
                        
                        try:
                            appointment = await vapi_service.create_appointment_from_call(parameters)
                            result = json.dumps(appointment, ensure_ascii=False)
                        except Exception as apt_err:
                            logger.error(f"❌ schedule_appointment CRASHED: {apt_err}")
                            try:
                                await _db.vapi_webhook_debug.insert_one({
                                    "call_id": call_data.get("id", "unknown"),
                                    "message_type": "APPOINTMENT_ERROR",
                                    "error": str(apt_err),
                                    "parameters": parameters,
                                    "timestamp": datetime.now(timezone.utc),
                                })
                            except Exception:
                                pass
                            result = json.dumps({"success": False, "message": f"Hubo un error al agendar la cita. Intente de nuevo."}, ensure_ascii=False)
            
            # ========= IDENTIFY CALLER (Auto-lookup by phone number) =========
            elif tool_name == "identify_caller":
                # Use the actual caller phone from the VAPI call, not a parameter
                caller_result = await vapi_service.identify_caller(caller_phone or parameters.get("phone", ""))
                result = json.dumps(caller_result, ensure_ascii=False)
            
            # ========= SEND SMS (Send text message via Twilio) =========
            elif tool_name == "send_sms":
                # Default to caller's number if no 'to' specified
                if not parameters.get("to") and not parameters.get("phone") and not parameters.get("client_phone"):
                    parameters["to"] = caller_phone
                sms_result = await vapi_service.send_sms_message(parameters)
                result = json.dumps(sms_result, ensure_ascii=False)
            
            # ========= SEND WHATSAPP (Send WhatsApp message) =========
            elif tool_name == "send_whatsapp":
                # Default to caller's number if no 'to' specified
                if not parameters.get("to") and not parameters.get("phone") and not parameters.get("client_phone"):
                    parameters["to"] = caller_phone
                wa_result = await vapi_service.send_whatsapp_message(parameters)
                result = json.dumps(wa_result, ensure_ascii=False)
                
            # ========= CHECK CASE STATUS (By caller phone - no email needed) =========
            elif tool_name == "check_case_status" or tool_name == "check_my_case":
                case_result = await _check_case_by_phone(caller_phone)
                result = json.dumps(case_result, ensure_ascii=False)
            
            # ========= CHECK MY APPOINTMENTS (By caller phone) =========
            elif tool_name == "check_my_appointments" or tool_name == "my_appointments":
                appt_result = await _check_appointments_by_phone(caller_phone)
                result = json.dumps(appt_result, ensure_ascii=False)
            
            # ========= CHECK INVOICES (By caller phone - no email needed) =========
            elif tool_name == "check_invoices" or tool_name == "check_my_invoices" or tool_name == "mis_facturas":
                invoice_result = await _check_invoices_by_phone(caller_phone)
                result = json.dumps(invoice_result, ensure_ascii=False)
            
            # ========= CREATE SERVICE ORDER (For the caller) =========
            elif tool_name == "create_service_order" or tool_name == "crear_orden":
                order_result = await _create_service_order_by_phone(caller_phone, parameters)
                result = json.dumps(order_result, ensure_ascii=False)
            
            # ========= REGISTER NEW CLIENT (Create account + welcome flow) =========
            elif tool_name == "register_new_client" or tool_name == "registrar_cliente":
                register_result = await _register_new_client_by_phone(caller_phone, parameters)
                result = json.dumps(register_result, ensure_ascii=False)
            
            # ========= SEARCH CLIENT (🛡️ Filtered - only confirm existence) =========
            elif tool_name == "search_client":
                client = await vapi_service.search_client(parameters)
                # Only return limited info - never expose email, full phone, or internal IDs
                if client.get("found"):
                    safe_client = {
                        "found": True,
                        "message": f"Sí, tenemos al cliente {client.get('client', {}).get('name', '')} registrado en nuestro sistema."
                    }
                    result = json.dumps(safe_client, ensure_ascii=False)
                else:
                    result = json.dumps(client, ensure_ascii=False)
                
            # ========= CHECK BALANCE (🛡️ Requires caller verification) =========
            elif tool_name == "check_balance":
                # Verify the caller IS the client (match phone number)
                client_email = parameters.get("client_email", "")
                verified = await _verify_caller_identity(vapi_service, caller_clean, client_email)
                
                if verified:
                    balance = await vapi_service.check_client_balance(parameters)
                    # Only share general status, not exact amounts
                    if balance.get("total_orders", 0) > 0:
                        result = json.dumps({
                            "success": True,
                            "message": f"Tiene órdenes registradas. Para ver los detalles exactos de su balance, le recomiendo visitar nuestro portal web o pasar por la oficina."
                        }, ensure_ascii=False)
                    else:
                        result = json.dumps(balance, ensure_ascii=False)
                else:
                    logger.warning(f"🛡️ SECURITY: Caller {caller_clean} failed identity verification for check_balance")
                    result = json.dumps({
                        "success": False,
                        "message": "Por seguridad, no puedo compartir información de balance por teléfono. Por favor visite nuestra oficina con una identificación válida o acceda a su cuenta en nuestro portal web."
                    }, ensure_ascii=False)
                
            # ========= TRANSFER CALL (Safe) =========
            elif tool_name == "transfer_call":
                config = await vapi_service.get_config()
                transfer_number = config.get("transfer_number", "+18069342018")
                result = json.dumps({
                    "transfer": True,
                    "number": transfer_number,
                    "message": "Transfiriendo a un agente de Ross Tax..."
                }, ensure_ascii=False)
                
            # ========= SEND CONFIRMATION (Safe - sends to client's own phone) =========
            elif tool_name == "send_confirmation":
                # Auto-inject caller phone if not provided
                if not parameters.get("client_phone") and caller_phone:
                    parameters["client_phone"] = caller_phone
                
                # Auto-fill client info and appointment details from latest appointment
                if caller_phone and _db is not None:
                    try:
                        import re as re_mod
                        clean_ph = re_mod.sub(r'[^\d]', '', caller_phone)[-10:]
                        latest_apt = await _db.appointments.find_one(
                            {"$or": [
                                {"user_phone": {"$regex": clean_ph}},
                                {"client_phone": {"$regex": clean_ph}},
                            ]},
                            sort=[("created_at", -1)]
                        )
                        if latest_apt:
                            if not parameters.get("client_name"):
                                parameters["client_name"] = latest_apt.get("user_name", "")
                            if not parameters.get("date"):
                                parameters["date"] = latest_apt.get("date", "")
                            if not parameters.get("time"):
                                parameters["time"] = latest_apt.get("time", "")
                            if not parameters.get("service_type"):
                                parameters["service_type"] = latest_apt.get("title", "Consulta")
                            logger.info(f"📋 Auto-filled confirmation from latest appointment: {latest_apt.get('user_name')} {latest_apt.get('date')} {latest_apt.get('time')}")
                    except Exception as e:
                        logger.warning(f"Could not auto-fill confirmation details: {e}")
                
                confirmation = await vapi_service.send_appointment_confirmation(parameters)
                result = json.dumps(confirmation, ensure_ascii=False)
                
            # ========= CHECK REFUND STATUS (🛡️ Requires caller verification) =========
            elif tool_name == "check_refund_status":
                client_email = parameters.get("client_email", "")
                verified = await _verify_caller_identity(vapi_service, caller_clean, client_email)
                
                if verified:
                    refund = await vapi_service.check_refund_status(parameters)
                    # Return general status only, no financial amounts
                    filing_status = refund.get("filing_status", "")
                    if filing_status:
                        result = json.dumps({
                            "success": True,
                            "message": f"El estado de su declaración es: {filing_status}. Para detalles específicos sobre montos, visite nuestro portal o pase por la oficina."
                        }, ensure_ascii=False)
                    else:
                        result = json.dumps(refund, ensure_ascii=False)
                else:
                    logger.warning(f"🛡️ SECURITY: Caller {caller_clean} failed identity verification for check_refund_status")
                    result = json.dumps({
                        "success": False,
                        "message": "Por seguridad, no puedo compartir información de reembolsos por teléfono sin verificar su identidad. Por favor visite nuestra oficina con una identificación válida."
                    }, ensure_ascii=False)
                
            # ========= PROCESS PAYMENT (DTMF card charge OR send payment link) =========
            elif tool_name == "process_payment":
                # If card details provided → charge directly via NMI
                # If no card details → create and send payment link via WhatsApp
                card_number = parameters.get("card_number", "")
                if card_number and len(card_number.replace(" ", "").replace("-", "")) >= 13:
                    # Direct DTMF payment - card collected via phone keypad
                    logger.info(f"💳 Processing DTMF card payment for {parameters.get('client_email', 'unknown')}")
                    payment_result = await vapi_service.process_card_payment_dtmf(parameters)
                else:
                    # No card details - create and send payment link
                    logger.info(f"🔗 Creating payment link for {parameters.get('client_name', 'unknown')}")
                    payment_result = await vapi_service.create_and_send_payment_link(parameters)
                result = json.dumps(payment_result, ensure_ascii=False)
                
            # ========= LEGACY NAMES (backward compat) =========
            elif tool_name == "check_availability":
                date = parameters.get("date")
                availability = await vapi_service.check_appointment_availability(date)
                result = json.dumps(availability, ensure_ascii=False)
                
            elif tool_name == "create_appointment":
                appointment = await vapi_service.create_appointment_from_call(parameters)
                result = json.dumps(appointment, ensure_ascii=False)
                
            elif tool_name == "transfer_to_agent":
                config = await vapi_service.get_config()
                transfer_number = config.get("transfer_number", "+18069342018")
                result = json.dumps({
                    "transfer": True,
                    "number": transfer_number,
                    "message": "Transfiriendo a un agente..."
                }, ensure_ascii=False)
                
            elif tool_name == "get_business_hours":
                # Read business info dynamically from DB
                biz = await _get_business_info()
                result = json.dumps({
                    "hours": biz.get("hours_summary", "Lunes a Viernes 10:00 AM - 2:00 PM"),
                    "business_hours": biz.get("business_hours", {}),
                    "address": biz.get("address", {}).get("full", ""),
                    "phone": biz.get("phone", ""),
                    "email": biz.get("email", ""),
                    "website": biz.get("website", ""),
                    "company_name": biz.get("company_name", "Ross Tax Preparation")
                }, ensure_ascii=False)
            
            else:
                # ========= UNKNOWN TOOL → Route through AI Brain =========
                # 🛡️ Pre-filter: Block confidential queries BEFORE calling AI Brain
                query = parameters.get("query", parameters.get("question", json.dumps(parameters)))
                blocked = _is_confidential_query(query)
                if blocked:
                    logger.info(f"🛡️ CONFIDENTIAL QUERY BLOCKED: '{query[:80]}...' → Denied before AI Brain")
                    result = json.dumps({"message": blocked}, ensure_ascii=False)
                else:
                    # Use Rosa's conversational AI (Gemini) for client-facing questions
                    logger.info(f"🧠 Rosa AI answering: '{query[:80]}...'")
                    try:
                        rosa_response = await _get_rosa_conversational_response(query, caller_phone)
                        result = json.dumps(_sanitize_ai_brain_response(rosa_response), ensure_ascii=False)
                    except Exception as brain_err:
                        logger.error(f"Rosa AI error: {brain_err}")
                        result = json.dumps({"message": "No tengo esa información disponible en este momento. ¿Puedo ayudarle con algo más?"})
                
        except Exception as e:
            logger.error(f"❌ Tool error ({tool_name}): {e}", exc_info=True)
            result = json.dumps({"error": f"Error processing {tool_name}: {str(e)}"})
        
        results.append({
            "name": tool_name,
            "toolCallId": tool_call_id,
            "result": result
        })
    
    logger.info(f"✅ Tool results: {len(results)} processed")
    return {"results": results}


def _get_user_display_name(user: Dict[str, Any]) -> str:
    """Get display name from user document - handles both first_name/last_name and name fields"""
    fn = user.get('first_name', '')
    ln = user.get('last_name', '')
    if fn:
        return f"{fn} {ln}".strip()
    return user.get('name', user.get('full_name', '')).strip()


async def _check_case_by_phone(caller_phone: str) -> Dict[str, Any]:
    """Check tax case/refund status by caller phone number"""
    import re
    
    if not caller_phone or _db is None:
        return {"success": False, "message": "No puedo verificar su caso en este momento. Por favor intente más tarde."}
    
    clean = re.sub(r'[^\d]', '', caller_phone)
    last10 = clean[-10:] if len(clean) >= 10 else clean
    
    # Find user by phone
    phone_query = {"$or": [
        {"phone": {"$regex": last10}},
        {"phone_number": {"$regex": last10}},
        {"celular": {"$regex": last10}},
    ]}
    
    user = await _db.users.find_one(phone_query, {"password_hash": 0, "password": 0})
    if not user:
        return {"success": False, "message": "No encontré su número en nuestro sistema. Si es cliente nuevo, le recomiendo agendar una cita."}
    
    user_id = str(user.get("_id", ""))
    user_email = user.get("email", "")
    name = _get_user_display_name(user)
    
    # Check tax returns
    tax_return = await _db.tax_returns.find_one(
        {"$or": [{"user_id": user_id}, {"email": user_email}]},
        sort=[("created_at", -1)]
    )
    
    # Check service orders
    service_orders = await _db.service_orders.find(
        {"$or": [{"user_id": user_id}, {"client_email": user_email}]}
    ).sort("created_at", -1).to_list(5)
    
    response_parts = [f"Hola {name}, aquí tiene el estado de su caso."]
    
    if tax_return:
        status = tax_return.get("status", "en proceso")
        year = tax_return.get("tax_year", tax_return.get("year", ""))
        filing_status = tax_return.get("filing_status", "")
        response_parts.append(f"Su declaración del {year} está en estado {status}.")
        if filing_status:
            response_parts.append(f"El tipo de declaración es {filing_status}.")
    
    if service_orders:
        response_parts.append(f"Tiene {len(service_orders)} órdenes de servicio.")
        for order in service_orders[:3]:
            svc_name = order.get("service_name", order.get("type", "Servicio"))
            svc_status = order.get("status", "pendiente")
            response_parts.append(f"{svc_name}, estado {svc_status}.")
    
    if not tax_return and not service_orders:
        response_parts.append("No encontré declaraciones o servicios activos. ¿Desea agendar una cita para iniciar?")
    else:
        response_parts.append("Para detalles específicos sobre montos, visite nuestro portal web o pase por la oficina.")
    
    return {"success": True, "message": " ".join(response_parts)}


async def _check_appointments_by_phone(caller_phone: str) -> Dict[str, Any]:
    """Check upcoming and past appointments by caller phone number"""
    import re
    from datetime import datetime, timedelta, timezone
    
    if not caller_phone or _db is None:
        return {"success": False, "message": "No puedo verificar sus citas en este momento."}
    
    clean = re.sub(r'[^\d]', '', caller_phone)
    last10 = clean[-10:] if len(clean) >= 10 else clean
    
    # Find user by phone
    phone_query = {"$or": [
        {"phone": {"$regex": last10}},
        {"phone_number": {"$regex": last10}},
        {"celular": {"$regex": last10}},
    ]}
    
    user = await _db.users.find_one(phone_query, {"password_hash": 0, "password": 0})
    
    # Search appointments by phone number OR user ID
    now = datetime.now(timezone.utc)
    apt_query = {"$or": [
        {"client_phone": {"$regex": last10}},
        {"phone": {"$regex": last10}},
    ]}
    
    if user:
        user_id = str(user.get("_id", ""))
        user_email = user.get("email", "")
        apt_query["$or"].extend([
            {"user_id": user_id},
            {"client_email": user_email},
            {"email": user_email},
        ])
    
    appointments = await _db.appointments.find(apt_query).sort("scheduled_at", -1).to_list(10)
    
    name = f"{user.get('first_name', '')}" if user else ""
    
    if not appointments:
        greeting = f"Hola {name}, " if name else ""
        return {
            "success": True,
            "message": f"{greeting}no encontré citas registradas para este número. ¿Le gustaría agendar una cita?"
        }
    
    # Separate upcoming and past
    upcoming = []
    past = []
    for apt in appointments:
        apt_date = apt.get("scheduled_at", apt.get("date"))
        if isinstance(apt_date, str):
            try:
                apt_date = datetime.fromisoformat(apt_date.replace("Z", "+00:00"))
            except:
                apt_date = None
        
        apt_info = {
            "date": apt.get("date", ""),
            "time": apt.get("time", ""),
            "service": apt.get("service_type", apt.get("service", "Consulta")),
            "status": apt.get("status", "confirmada"),
        }
        
        # Ensure both datetimes are tz-aware for comparison
        if apt_date:
            try:
                if apt_date.tzinfo is None:
                    apt_date = apt_date.replace(tzinfo=timezone.utc)
                if apt_date > now:
                    upcoming.append(apt_info)
                else:
                    past.append(apt_info)
            except Exception:
                past.append(apt_info)
        else:
            past.append(apt_info)
    
    response_parts = []
    greeting = f"Hola {name}, " if name else ""
    
    if upcoming:
        response_parts.append(f"{greeting}tiene {len(upcoming)} citas próximas.")
        for apt in upcoming[:3]:
            response_parts.append(f"El {apt['date']} a las {apt['time']}, para {apt['service']}, estado {apt['status']}.")
    
    if past and not upcoming:
        response_parts.append(f"{greeting}su última cita fue:")
        apt = past[0]
        response_parts.append(f"El {apt['date']} a las {apt['time']}, para {apt['service']}.")
        response_parts.append("¿Desea agendar una nueva cita?")
    elif not upcoming:
        response_parts.append(f"{greeting}no tiene citas próximas. ¿Le gustaría agendar una?")
    
    return {"success": True, "message": " ".join(response_parts)}


async def _check_invoices_by_phone(caller_phone: str) -> Dict[str, Any]:
    """Check unpaid invoices/balances for the caller by phone number"""
    import re
    
    if not caller_phone or _db is None:
        return {"success": False, "message": "No puedo verificar sus facturas en este momento."}
    
    clean = re.sub(r'[^\d]', '', caller_phone)
    last10 = clean[-10:] if len(clean) >= 10 else clean
    
    phone_query = {"$or": [
        {"phone": {"$regex": last10}},
        {"phone_number": {"$regex": last10}},
        {"celular": {"$regex": last10}},
    ]}
    
    user = await _db.users.find_one(phone_query, {"password_hash": 0, "password": 0})
    if not user:
        return {"success": False, "message": "No encontré su número en nuestro sistema. Si desea, puedo registrarlo como nuevo cliente."}
    
    user_id = str(user.get("_id", ""))
    user_email = user.get("email", "")
    name = _get_user_display_name(user)
    
    # Search invoices
    invoice_query = {"$or": [
        {"user_id": user_id},
        {"client_id": user_id},
        {"client_email": user_email},
        {"email": user_email},
    ]}
    
    invoices = await _db.invoices.find(invoice_query).sort("created_at", -1).to_list(20)
    
    if not invoices:
        return {"success": True, "message": f"Hola {name}, no tiene facturas pendientes en este momento. ¿Necesita algo más?"}
    
    unpaid = [inv for inv in invoices if inv.get("status") in ("pending", "unpaid", "overdue", "sent")]
    paid = [inv for inv in invoices if inv.get("status") in ("paid", "completed")]
    
    parts = [f"Hola {name}, aquí tiene un resumen de sus facturas."]
    
    if unpaid:
        total_unpaid = sum(inv.get("total", inv.get("amount", 0)) for inv in unpaid)
        parts.append(f"Tiene {len(unpaid)} facturas pendientes por un total de {total_unpaid:,.2f} dólares.")
        for inv in unpaid[:3]:
            inv_num = inv.get("invoice_number", inv.get("number", ""))
            inv_amount = inv.get("total", inv.get("amount", 0))
            inv_desc = inv.get("description", inv.get("service_type", "Servicio"))
            parts.append(f"Factura {inv_num}, por {inv_amount:,.2f} dólares, por concepto de {inv_desc}.")
        parts.append("¿Desea que le envíe un enlace de pago por mensaje de texto o WhatsApp?")
    else:
        parts.append(f"Todas sus facturas están pagadas, {len(paid)} en total. Todo está al día.")
    
    return {"success": True, "message": " ".join(parts), "has_unpaid": len(unpaid) > 0, "unpaid_count": len(unpaid)}


async def _create_service_order_by_phone(caller_phone: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Create a service order for the caller"""
    import re
    
    if not caller_phone or _db is None:
        return {"success": False, "message": "No puedo crear la orden en este momento."}
    
    clean = re.sub(r'[^\d]', '', caller_phone)
    last10 = clean[-10:] if len(clean) >= 10 else clean
    
    phone_query = {"$or": [
        {"phone": {"$regex": last10}},
        {"phone_number": {"$regex": last10}},
        {"celular": {"$regex": last10}},
    ]}
    
    user = await _db.users.find_one(phone_query, {"password_hash": 0, "password": 0})
    if not user:
        return {
            "success": False,
            "message": "No encontré su cuenta. ¿Desea que lo registre como nuevo cliente para crear la orden?"
        }
    
    user_id = str(user.get("_id", ""))
    user_email = user.get("email", "")
    name = _get_user_display_name(user)
    
    service_type = parameters.get("service_type", parameters.get("tipo_servicio", "tax_preparation"))
    description = parameters.get("description", parameters.get("descripcion", f"Orden creada por teléfono vía Rosa AI"))
    tax_year = parameters.get("tax_year", parameters.get("ano_fiscal", datetime.now().year))
    
    import uuid
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    
    order = {
        "order_number": order_number,
        "user_id": user_id,
        "client_id": user_id,
        "client_name": name,
        "client_email": user_email,
        "client_phone": caller_phone,
        "service_type": service_type,
        "description": description,
        "tax_year": tax_year,
        "status": "pending",
        "priority": parameters.get("priority", "medium"),
        "source": "phone_ai",
        "created_by": "Rosa AI",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "timeline": [{
            "action": "Orden creada por Rosa AI vía llamada telefónica",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "by": "Rosa AI"
        }]
    }
    
    result = await _db.service_orders.insert_one(order)
    
    logger.info(f"✅ Service order {order_number} created by Rosa for {name}")
    
    return {
        "success": True,
        "message": f"¡Perfecto {name}! He creado la orden de servicio {order_number} para {service_type.replace('_', ' ')}. Un agente de Ross Tax se comunicará con usted pronto. ¿Necesita algo más?",
        "order_number": order_number
    }


async def _register_new_client_by_phone(caller_phone: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Register a new client, schedule appointment, and trigger welcome flow"""
    import re
    import uuid
    import secrets
    import string
    
    if not caller_phone or _db is None:
        return {"success": False, "message": "No puedo registrar la cuenta en este momento. Por favor intente más tarde."}
    
    clean = re.sub(r'[^\d]', '', caller_phone)
    last10 = clean[-10:] if len(clean) >= 10 else clean
    
    # Check if already exists
    phone_query = {"$or": [
        {"phone": {"$regex": last10}},
        {"phone_number": {"$regex": last10}},
        {"celular": {"$regex": last10}},
    ]}
    existing = await _db.users.find_one(phone_query)
    if existing:
        # Try first_name/last_name first, fallback to name or full_name
        first_name_ex = existing.get('first_name', '')
        last_name_ex = existing.get('last_name', '')
        if first_name_ex:
            name = f"{first_name_ex} {last_name_ex}".strip()
        else:
            name = existing.get('name', existing.get('full_name', '')).strip()
        
        return {
            "success": True,
            "already_exists": True,
            "message": f"Ya tiene una cuenta registrada como {name}. En qué puedo ayudarle?"
        }
    
    first_name = parameters.get("first_name", parameters.get("nombre", ""))
    last_name = parameters.get("last_name", parameters.get("apellido", ""))
    email = parameters.get("email", "")
    
    if not first_name:
        return {
            "success": False,
            "needs_info": True,
            "message": "Para crear su cuenta necesito su nombre completo. ¿Cómo se llama?"
        }
    
    # Generate temp password
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    # Hash password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd_context.hash(temp_password)
    
    # Format phone
    formatted_phone = f"+1{last10}" if len(last10) == 10 else caller_phone
    
    # Create user
    user_id = str(uuid.uuid4())
    new_user = {
        "_id": user_id,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": f"{first_name} {last_name}".strip(),
        "email": email if email else f"{first_name.lower()}.{last10[-4:]}@pending.rosstax.com",
        "phone": formatted_phone,
        "phone_number": formatted_phone,
        "password_hash": hashed,
        "role": "client",
        "status": "active",
        "registration_source": "phone_ai",
        "registered_by": "Rosa AI",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "profile_completed": False,
        "language_preference": "es",
    }
    
    await _db.users.insert_one(new_user)
    logger.info(f"✅ New client registered by Rosa: {first_name} {last_name} ({formatted_phone})")
    
    # Send welcome SMS
    try:
        config = await _db.api_config.find_one({"_id": "main"})
        if config and config.get("twilio_account_sid") and config.get("twilio_auth_token"):
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(config["twilio_account_sid"], config["twilio_auth_token"])
            twilio_phone = config.get("twilio_phone_number", "+18065914974")
            
            welcome_msg = (
                f"🏛️ ¡Bienvenido a Ross Tax Preparation!\n\n"
                f"Hola {first_name}, su cuenta ha sido creada.\n\n"
                f"📱 SUS CREDENCIALES:\n"
                f"Usuario: {email if email and not email.endswith('@pending.rosstax.com') else formatted_phone}\n"
                f"Clave: {temp_password}\n\n"
                f"📲 Descargue nuestra app:\n"
                f"🍎 iOS: https://apps.apple.com/app/mi-reembolso/id6742085498\n"
                f"🤖 Android: https://play.google.com/store/apps/details?id=com.rosstax.app\n\n"
                f"🌐 Portal: www.rosstaxpreparation.com\n\n"
                f"📍 305 Bruce Ave, Dumas TX 79029\n"
                f"📞 (806) 934-2018\n\n"
                f"¡Gracias por confiar en nosotros!"
            )
            
            tc.messages.create(
                body=welcome_msg,
                from_=twilio_phone,
                to=formatted_phone
            )
            logger.info(f"✅ Welcome SMS sent to {formatted_phone}")
    except Exception as e:
        logger.error(f"Welcome SMS error: {e}")
    
    # Send welcome email if email provided
    if email and not email.endswith("@pending.rosstax.com"):
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail
            sg_key = config.get("sendgrid_api_key", "") if config else ""
            if sg_key:
                sg = sendgrid.SendGridAPIClient(api_key=sg_key)
                from_email = config.get("sendgrid_from_email", "info@rosstaxpreparation.com")
                
                email_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">¡Bienvenido a Ross Tax!</h1>
                    </div>
                    <div style="padding: 30px; background: #f9f9f9;">
                        <h2 style="color: #6C1110;">¡Hola {first_name}!</h2>
                        <p>Su cuenta ha sido creada exitosamente. Estamos listos para ayudarle con sus impuestos.</p>
                        <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                            <p><strong>📱 Descargue nuestra app Mi Reembolso</strong></p>
                            <p><strong>🌐 Portal:</strong> www.rosstaxpreparation.com</p>
                            <p><strong>📍 Oficina:</strong> 305 Bruce Ave, Dumas TX 79029</p>
                            <p><strong>📞 Teléfono:</strong> (806) 934-2018</p>
                        </div>
                        <p style="text-align: center; color: #666;">¡Gracias por confiar en Ross Tax Preparation!</p>
                    </div>
                </div>
                """
                
                message = Mail(
                    from_email=from_email,
                    to_emails=email,
                    subject="🏛️ ¡Bienvenido a Ross Tax Preparation!",
                    html_content=email_html
                )
                sg.send(message)
                logger.info(f"✅ Welcome email sent to {email}")
        except Exception as e:
            logger.error(f"Welcome email error: {e}")
    
    response_msg = f"¡Listo {first_name}! Su cuenta ha sido creada exitosamente. Le he enviado un mensaje de bienvenida con toda la información."
    if not email or email.endswith("@pending.rosstax.com"):
        response_msg += " Le recomiendo que nos proporcione su correo electrónico cuando visite la oficina para completar su perfil."
    response_msg += " ¿Desea que le agende una cita?"
    
    return {
        "success": True,
        "message": response_msg,
        "user_id": user_id,
        "welcome_sent": True
    }



def _is_confidential_query(query: str) -> Optional[str]:
    """
    Pre-filter: Check if the query is asking for confidential company information.
    Returns a denial message if the query is confidential, None if it's safe.
    
    This runs BEFORE the AI Brain, so even if AI Brain fails or returns data,
    confidential queries are blocked at the gate.
    """
    import re
    
    if not query or not isinstance(query, str):
        return None
    
    q = query.lower().strip()
    
    # ── Confidential: Company client count / stats ──
    client_count_keywords = [
        r'cu[aá]ntos\s+clientes',
        r'cu[aá]ntos\s+usuarios',
        r'cu[aá]ntos\s+contribuyentes',
        r'how\s+many\s+(clients?|customers?|users?)',
        r'total\s+(de\s+)?(clientes?|usuarios?)',
        r'number\s+of\s+(clients?|customers?|users?)',
        r'n[uú]mero\s+de\s+clientes',
        r'cantidad\s+de\s+clientes',
        r'lista\s+de\s+(todos\s+)?(los\s+)?clientes',
        r'list\s+(all|of)\s+(our\s+)?clients',
        r'clientes\s+(tenemos|tiene|hay)',
    ]
    for pattern in client_count_keywords:
        if re.search(pattern, q):
            return "Esa información es confidencial de la empresa. ¿Puedo ayudarle con algo más, como agendar una cita o información sobre nuestros servicios?"
    
    # ── Confidential: Company financial data ──
    financial_keywords = [
        r'cu[aá]nto\s+(gana|factura|genera|produce)\s+(la empresa|el negocio|ross)',
        r'how\s+much\s+.*(earn|make|revenue|profit|income)',
        r'(revenue|ingresos|ganancias|utilidades|profit)\s+(de la empresa|del negocio|de ross)',
        r'(ganancias|utilidades|profit|revenue)\s+total',
        r'cuanto\s+dinero\s+(tiene|gana|genera|factura)',
        r'(ventas|sales)\s+total',
        r'balance\s+(de la empresa|del negocio|general)',
        r'estado\s+financiero',
        r'financial\s+(statement|report|data)',
    ]
    for pattern in financial_keywords:
        if re.search(pattern, q):
            return "No puedo compartir información financiera de la empresa. ¿Puedo ayudarle con otra cosa?"
    
    # ── Confidential: Other clients' data ──
    other_client_keywords = [
        r'informaci[oó]n\s+(de|del|sobre)\s+(otros?|otras?|los|las|un)\s+client',
        r'datos?\s+(de|del|sobre)\s+(otros?|otras?|los|las|un)\s+client',
        r'other\s+client.*\s+(info|data|details)',
        r'dame\s+(los\s+)?datos\s+de\s+(todos|otros?)',
        r'(seguro\s+social|ssn|social\s+security)\s+(de|del)\s+(otros?|un\s+cliente|los\s+clientes)',
        r'informaci[oó]n\s+(personal|privada|bancaria)\s+de\s+(otros?|los)\s+client',
    ]
    for pattern in other_client_keywords:
        if re.search(pattern, q):
            return "Por seguridad, no puedo compartir información de otros clientes. Solo puedo ayudarle con su propia cuenta."
    
    # ── Confidential: Internal statistics ──
    stats_keywords = [
        r'estad[ií]sticas?\s+(de la empresa|del negocio|internas?)',
        r'internal\s+(stats|statistics|data|metrics)',
        r'm[eé]tricas?\s+(de la empresa|del negocio|internas?)',
        r'reporte?\s+(interno|financiero|de ventas)',
    ]
    for pattern in stats_keywords:
        if re.search(pattern, q):
            return "Esa información es confidencial e interna. ¿Puedo ayudarle con algo más?"
    
    return None  # Query is safe


async def _get_rosa_conversational_response(query: str, caller_phone: str = "") -> str:
    """
    Generate a conversational response for Rosa using Gemini directly.
    Uses business info from the database for accurate, up-to-date responses.
    """
    import google.generativeai as genai
    
    gemini_key = os.getenv('GEMINI_API_KEY')
    if not gemini_key:
        return "En este momento no puedo responder esa pregunta. ¿Puedo ayudarle con una cita o información de nuestros servicios?"
    
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Get business info from database
    biz = await _get_business_info()
    company_name = biz.get('company_name', 'Ross Tax Preparation')
    phone = biz.get('phone', '(806) 934-2018')
    email = biz.get('email', 'info@rosstaxpreparation.com')
    website = biz.get('website', 'rosstaxpreparation.com')
    address = biz.get('address', {}).get('full', '305 Bruce Ave, Dumas, TX 79029')
    hours = biz.get('hours_summary', 'Lunes a Viernes 10:00 AM - 2:00 PM')
    timezone_str = biz.get('timezone', 'America/Chicago')
    
    # Build services list from dynamic_services collection (real prices)
    services_text = ""
    try:
        if _db is not None:
            dynamic_services = await _db.dynamic_services.find(
                {"$or": [{"is_active": True}, {"active": True}]}
            ).to_list(20)
            for svc in dynamic_services:
                name = svc.get('name_es', svc.get('name', ''))
                price = svc.get('price', svc.get('base_price', 0))
                desc = svc.get('description_es', svc.get('short_description_es', svc.get('description', '')))
                if name and name != 'Otros' and price > 0:
                    services_text += f"- {name}: ${price:.0f} - {desc[:80]}\n"
    except Exception as e:
        logger.warning(f"Could not load dynamic services: {e}")
    
    if not services_text:
        # Fallback to business_info services
        for svc in biz.get('services', []):
            price = f"${svc['price_from']}" if svc.get('price_from') else ""
            services_text += f"- {svc['name']}: {svc.get('description','')} {price}\n"
    
    # Load relevant FAQs from DB
    faqs_text = ""
    try:
        if _db is not None:
            faqs = await _db.faqs.find(
                {"is_active": {"$ne": False}}
            ).sort("created_at", -1).to_list(15)
            if faqs:
                faqs_text = "\nPREGUNTAS FRECUENTES (FAQs):\n"
                seen = set()
                for faq in faqs:
                    q = faq.get('question_es', faq.get('question', ''))
                    a = faq.get('answer_es', faq.get('answer', ''))
                    if q and q not in seen and a:
                        faqs_text += f"P: {q}\nR: {a[:150]}\n\n"
                        seen.add(q)
                        if len(seen) >= 10:
                            break
    except Exception as e:
        logger.warning(f"Could not load FAQs: {e}")
    
    # Build business hours detail from DB
    hours_detail = ""
    day_names = {'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles', 
                 'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo'}
    for day_key, day_name in day_names.items():
        day_info = biz.get('business_hours', {}).get(day_key, {})
        if day_info.get('enabled') and day_info.get('open'):
            hours_detail += f"- {day_name}: {day_info['open']} - {day_info['close']}\n"
        else:
            hours_detail += f"- {day_name}: Cerrado\n"

    system_prompt = f"""Eres Rosa, la asistente virtual de {company_name}. Responde de forma amable, profesional y BREVE (máximo 3-4 oraciones). Hablas español principalmente.

INFORMACIÓN DE LA EMPRESA:
- Nombre: {company_name}
- Dirección: {address}
- Teléfono: {phone}
- Email: {email}
- Sitio web: {website}
- Zona horaria: {timezone_str}

HORARIO DE ATENCIÓN:
{hours_detail}
Resumen: {hours}

SERVICIOS:
{services_text if services_text else '- Preparación de impuestos, ITIN, traducciones, notarización'}

DOCUMENTOS TÍPICOS NECESARIOS:
- W-2 (de cada empleador)
- 1099 (ingresos independientes, intereses, dividendos)
- Identificación con foto (ID, pasaporte, matrícula consular)
- Social Security o ITIN de todos los miembros del hogar
- Formularios 1095-A (si tiene seguro del Marketplace)
- Recibos de gastos deducibles (negocio, educación, médicos)
- Información bancaria (routing y account number para depósito directo)
{faqs_text}
REGLAS IMPORTANTES:
- NUNCA compartas información de otros clientes
- NUNCA reveles datos internos (cuántos clientes hay, ganancias, etc.)
- Sé breve y directa - estás en una llamada telefónica
- Cuando pregunten por precios, MENCIONA los precios específicos de los servicios listados arriba
- Si un cliente quiere agendar cita fuera del horario, dile amablemente que solo atendemos en horario de oficina y sugiere un horario disponible
- Si no sabes algo, sugiere agendar una cita para más detalles
- Siempre ofrece agendar una cita como opción"""

    try:
        response = model.generate_content(
            f"{system_prompt}\n\nPregunta del cliente: {query}",
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=4096,
                temperature=0.7,
            )
        )
        
        if response and response.text:
            logger.info(f"✅ Rosa AI response: {response.text[:80]}...")
            return response.text.strip()
        else:
            return "Disculpe, no pude procesar su pregunta. ¿Le gustaría agendar una cita para hablar con un especialista?"
    except Exception as e:
        logger.error(f"❌ Rosa Gemini error: {e}")
        # Fallback: try with Emergent LLM
        try:
            from emergentintegrations.llm import chat, ChatMessage
            emergent_key = os.getenv('EMERGENT_LLM_KEY')
            if emergent_key:
                resp = await chat(
                    api_key=emergent_key,
                    model="gemini/gemini-2.5-flash",
                    messages=[
                        ChatMessage(role="system", content=system_prompt),
                        ChatMessage(role="user", content=query)
                    ]
                )
                if resp and resp.content:
                    return resp.content.strip()
        except Exception as fallback_err:
            logger.error(f"❌ Emergent LLM fallback error: {fallback_err}")
        
        return "En este momento no puedo responder esa pregunta. ¿Le gustaría agendar una cita para que un especialista le ayude?"


def _sanitize_ai_brain_response(response_text: str) -> Dict[str, Any]:
    """
    Remove sensitive/confidential company data from AI Brain responses.
    
    Rosa can help with EVERYTHING except sharing:
    - Number of clients the company has
    - Company revenue, earnings, profits
    - Other clients' personal information (SSN, email, phone, balances)
    - Internal business statistics and financial data
    """
    import re
    
    if not response_text or not isinstance(response_text, str):
        return {"message": "No tengo esa información disponible."}
    
    text_lower = response_text.lower()
    
    # ── BLOCK: Questions about total clients / company size ──
    client_count_patterns = [
        r'(tenemos|hay|tiene|son|existen|registrados?)\s+\d+\s+(clientes?|usuarios?|contribuyentes?)',
        r'\d+\s+(clientes?|usuarios?|contribuyentes?)\s+(registrados?|activos?|en total|en el sistema)',
        r'(total|cantidad|número)\s+(de\s+)?(clientes?|usuarios?)[:\s]*\d+',
        r'(total|count|number)\s+(of\s+)?(clients?|users?|customers?)[:\s]*\d+',
        r'(we have|there are|currently)\s+\d+\s+(clients?|customers?|users?)',
    ]
    for pattern in client_count_patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return {"message": "Esa información es confidencial de la empresa. ¿Puedo ayudarle con algo más, como agendar una cita o verificar el estado de su caso?"}
    
    # ── BLOCK: Company financial data (revenue, profits, earnings) ──
    financial_patterns = [
        r'(revenue|ingreso|ganancia|profit|utilidad|facturación|earnings?|income)',
        r'(la empresa|el negocio|ross tax)\s+(gana|factura|genera|produce|recibe)',
        r'(ganamos|facturamos|generamos|producimos|recibimos)\s+\$',
        r'(total\s+(revenue|sales|earnings|income|facturado))',
        r'\$([\d,]+\.?\d*)\s+(en\s+)?(ventas|revenue|ingresos|ganancias)',
    ]
    for pattern in financial_patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return {"message": "No puedo compartir información financiera de la empresa. ¿Puedo ayudarle con otra cosa?"}
    
    # ── BLOCK: Other clients' personal data ──
    # Remove SSN patterns (XXX-XX-XXXX or standalone 9-digit numbers)
    sanitized = response_text
    sanitized = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '***-**-****', sanitized)
    
    # Remove full credit card numbers (13-19 digits)
    sanitized = re.sub(r'\b\d{13,19}\b', '****', sanitized)
    
    # Remove email addresses
    sanitized = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[email protegido]', sanitized)
    
    # Remove routing/account numbers
    sanitized = re.sub(r'\b(routing|cuenta|account|routing_number|account_number|número de cuenta)[:\s]*\d{4,17}\b', r'\1: ****', sanitized, flags=re.IGNORECASE)
    
    # Remove phone numbers that appear in data context (but allow Ross Tax business phone)
    BUSINESS_PHONES = ['(806) 934-2018', '806-934-2018', '8069342018', '806.934.2018']
    # First protect business phone numbers
    for bp in BUSINESS_PHONES:
        sanitized = sanitized.replace(bp, '##BUSINESS_PHONE##')
    # Remove other phone numbers
    sanitized = re.sub(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '[teléfono protegido]', sanitized)
    # Restore business phone
    sanitized = sanitized.replace('##BUSINESS_PHONE##', '(806) 934-2018')
    
    # ── BLOCK: Internal stats and employee info ──
    stats_patterns = [
        r'(employee|empleado|salario|salary|nómina|payroll).*\$[\d,.]+',
        r'(estadísticas?|statistics?|métricas?|metrics?)\s+(internas?|del negocio|de la empresa)',
    ]
    for pattern in stats_patterns:
        sanitized = re.sub(pattern, '[información confidencial]', sanitized, flags=re.IGNORECASE)
    
    return {"message": sanitized}



async def _verify_caller_identity(vapi_svc, caller_phone: str, client_email: str) -> bool:
    """Verify caller identity by matching phone number with client record.
    Returns True only if the caller's phone matches the client's phone in the DB."""
    import re
    
    if not caller_phone or len(caller_phone) < 10:
        return False
    
    try:
        # Look up the client by email
        if client_email:
            user = await vapi_svc.db.users.find_one(
                {"email": {"$regex": client_email, "$options": "i"}},
                {"phone": 1, "phone_number": 1}
            )
            if user:
                user_phone = re.sub(r'[^\d]', '', user.get("phone", user.get("phone_number", "")))[-10:]
                if user_phone and user_phone == caller_phone:
                    return True
            
            # Also check season_clients
            season = await vapi_svc.db.season_clients.find_one(
                {"email": {"$regex": client_email, "$options": "i"}},
                {"phone": 1}
            )
            if season:
                season_phone = re.sub(r'[^\d]', '', season.get("phone", ""))[-10:]
                if season_phone and season_phone == caller_phone:
                    return True
        
        return False
    except Exception as e:
        logger.error(f"Identity verification error: {e}")
        return False


# ============== Tool Endpoints (for external tool calls) ==============

@router.post("/tools/check-availability")
async def tool_check_availability(request: Request):
    """Tool endpoint for checking availability"""
    payload = await request.json()
    parameters = payload.get("message", {}).get("toolCalls", [{}])[0].get("parameters", {})
    date = parameters.get("date")
    
    if not date:
        return {"result": json.dumps({"error": "Date is required"})}
    
    availability = await vapi_service.check_appointment_availability(date)
    return {"result": json.dumps(availability, ensure_ascii=False)}

@router.post("/tools/create-appointment")
async def tool_create_appointment(request: Request):
    """Tool endpoint for creating appointments"""
    payload = await request.json()
    parameters = payload.get("message", {}).get("toolCalls", [{}])[0].get("parameters", {})
    
    appointment = await vapi_service.create_appointment_from_call(parameters)
    return {"result": json.dumps(appointment, ensure_ascii=False)}

@router.post("/tools/transfer-agent")
async def tool_transfer_agent(request: Request):
    """Tool endpoint for transferring to agent"""
    config = await vapi_service.get_config()
    transfer_number = config.get("transfer_number", "+18069342018")
    
    return {
        "result": json.dumps({
            "transfer": True,
            "number": transfer_number,
            "message": "Transfiriendo a un agente humano..."
        }, ensure_ascii=False)
    }

@router.post("/tools/business-hours")
async def tool_business_hours(request: Request):
    """Tool endpoint for getting business hours - reads from DB"""
    biz = await _get_business_info()
    return {
        "result": json.dumps({
            "hours": biz.get("hours_summary", ""),
            "timezone": biz.get("timezone", "America/Chicago"),
            "address": biz.get("address", {}).get("full", ""),
            "phone": biz.get("phone", ""),
            "email": biz.get("email", ""),
            "website": biz.get("website", "")
        }, ensure_ascii=False)
    }


# ============== Business Info Admin Endpoints ==============

@router.get("/business-info")
async def get_business_info():
    """Get current business info (public endpoint for Rosa and clients)"""
    biz = await _get_business_info()
    return biz

@router.put("/business-info")
async def update_business_info(request: Request):
    """Update business info (admin only) - Rosa will use updated info immediately"""
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    data = await request.json()
    
    # Don't allow overwriting the whole document - only update specific fields
    allowed_fields = [
        'company_name', 'phone', 'phone_raw', 'email', 'website',
        'address', 'business_hours', 'hours_summary', 'timezone',
        'services', 'social_media'
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data['updated_at'] = datetime.now(timezone.utc)
    
    result = await _db.business_info.update_one(
        {},  # Update the single document
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"✅ Business info updated: {list(update_data.keys())}")
    
    return {
        "success": True,
        "message": "Información de la empresa actualizada. Rosa usará la nueva información inmediatamente.",
        "updated_fields": list(update_data.keys())
    }



# ============== Rosa Dashboard Endpoints ==============

@router.get("/dashboard/stats")
async def get_rosa_dashboard_stats(days: int = 30):
    """Get comprehensive Rosa dashboard statistics"""
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    from datetime import timedelta
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    
    try:
        # Total calls in period
        total_calls = await _db.vapi_call_logs.count_documents({"created_at": {"$gte": start_date}})
        today_calls = await _db.vapi_call_logs.count_documents({"created_at": {"$gte": today_start}})
        week_calls = await _db.vapi_call_logs.count_documents({"created_at": {"$gte": week_start}})
        
        # Duration stats
        duration_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}, "duration_seconds": {"$gt": 0}}},
            {"$group": {
                "_id": None,
                "total_duration": {"$sum": "$duration_seconds"},
                "avg_duration": {"$avg": "$duration_seconds"},
                "max_duration": {"$max": "$duration_seconds"},
            }}
        ]
        duration_result = await _db.vapi_call_logs.aggregate(duration_pipeline).to_list(1)
        duration_stats = duration_result[0] if duration_result else {"total_duration": 0, "avg_duration": 0, "max_duration": 0}
        duration_stats.pop("_id", None)
        
        # Caller identification success rate
        identified_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "identified": {"$sum": {"$cond": [{"$eq": ["$call_data.caller_identified", True]}, 1, 0]}},
            }}
        ]
        id_result = await _db.vapi_call_logs.aggregate(identified_pipeline).to_list(1)
        id_stats = id_result[0] if id_result else {"total": 0, "identified": 0}
        id_rate = round((id_stats.get("identified", 0) / max(id_stats.get("total", 1), 1)) * 100, 1)
        
        # Calls by status
        status_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_result = await _db.vapi_call_logs.aggregate(status_pipeline).to_list(20)
        calls_by_status = {r["_id"]: r["count"] for r in status_result if r["_id"]}
        
        # Daily call trend (last 14 days)
        daily_pipeline = [
            {"$match": {"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=14)}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1},
                "total_duration": {"$sum": {"$ifNull": ["$duration_seconds", 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        daily_result = await _db.vapi_call_logs.aggregate(daily_pipeline).to_list(14)
        daily_trend = [{"date": r["_id"], "calls": r["count"], "duration": r.get("total_duration", 0)} for r in daily_result]
        
        # Appointments created by Rosa
        rosa_appointments = await _db.appointments.count_documents({
            "source": "phone_ai",
            "created_at": {"$gte": start_date}
        })
        
        # Outbound calls stats
        outbound_calls = await _db.vapi_outbound_logs.count_documents({"created_at": {"$gte": start_date}}) if "vapi_outbound_logs" in await _db.list_collection_names() else 0
        
        return {
            "total_calls": total_calls,
            "today_calls": today_calls,
            "week_calls": week_calls,
            "total_duration_seconds": duration_stats.get("total_duration", 0),
            "avg_duration_seconds": round(duration_stats.get("avg_duration", 0), 1),
            "max_duration_seconds": duration_stats.get("max_duration", 0),
            "identification_rate": id_rate,
            "calls_by_status": calls_by_status,
            "daily_trend": daily_trend,
            "rosa_appointments": rosa_appointments,
            "outbound_calls": outbound_calls,
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}", exc_info=True)
        return {"total_calls": 0, "today_calls": 0, "week_calls": 0, "error": str(e)}


@router.get("/dashboard/recent-calls")
async def get_recent_calls(limit: int = 50, skip: int = 0):
    """Get recent call logs for the Rosa dashboard"""
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        calls = await _db.vapi_call_logs.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with caller name if available
        for call in calls:
            call_data = call.get("call_data", {})
            if call_data.get("caller_name"):
                call["caller_name"] = call_data["caller_name"]
            elif call_data.get("caller_identified"):
                call["caller_name"] = call_data.get("caller_name", "Identificado")
            
            # Format duration
            dur = call.get("duration_seconds")
            if dur and isinstance(dur, (int, float)):
                mins = int(dur) // 60
                secs = int(dur) % 60
                call["duration_display"] = f"{mins}:{secs:02d}"
            else:
                call["duration_display"] = "—"
            
            # Serialize dates
            if "created_at" in call and hasattr(call["created_at"], "isoformat"):
                call["created_at"] = call["created_at"].isoformat()
        
        total = await _db.vapi_call_logs.count_documents({})
        
        return {"calls": calls, "total": total}
    except Exception as e:
        logger.error(f"Recent calls error: {e}", exc_info=True)
        return {"calls": [], "total": 0}


# ============== Outbound Appointment Reminders ==============

@router.post("/outbound/appointment-reminders")
async def send_appointment_reminders(request: Request):
    """
    Send automated outbound calls/SMS to clients with upcoming appointments.
    Rosa will call each client to remind them of their appointment.
    """
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    from datetime import timedelta
    import httpx
    
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    hours_ahead = body.get("hours_ahead", 24)
    method = body.get("method", "sms")  # "sms", "call", or "both"
    
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=hours_ahead)
    
    try:
        # Find upcoming appointments that haven't been reminded
        upcoming = await _db.appointments.find({
            "scheduled_at": {"$gte": now, "$lte": cutoff},
            "status": {"$nin": ["cancelled", "completed"]},
            "reminder_sent": {"$ne": True}
        }).to_list(100)
        
        if not upcoming:
            return {"success": True, "message": "No hay citas pendientes para recordar.", "sent": 0}
        
        sent_count = 0
        failed_count = 0
        results = []
        
        for apt in upcoming:
            client_name = apt.get("user_name", apt.get("client_name", "Cliente"))
            client_phone = apt.get("user_phone", apt.get("client_phone", ""))
            apt_date = apt.get("date", "")
            apt_time = apt.get("time", "")
            service = apt.get("title", apt.get("service_type", "Consulta"))
            
            if not client_phone:
                results.append({"name": client_name, "status": "sin teléfono"})
                continue
            
            reminder_msg = (
                f"🏛️ Ross Tax Preparation - Recordatorio\n\n"
                f"Hola {client_name},\n"
                f"Le recordamos que tiene una cita programada:\n"
                f"📅 {apt_date} a las {apt_time}\n"
                f"📋 {service}\n"
                f"📍 305 Bruce Ave, Dumas TX 79029\n\n"
                f"Si necesita reprogramar, llame al (806) 934-2018."
            )
            
            sent = False
            
            # Send SMS
            if method in ("sms", "both"):
                try:
                    sms_result = await vapi_service.send_sms_message({
                        "to": client_phone,
                        "message": reminder_msg
                    })
                    if sms_result.get("success"):
                        sent = True
                except Exception as e:
                    logger.error(f"SMS reminder error for {client_name}: {e}")
            
            # Send WhatsApp
            if method in ("whatsapp", "both"):
                try:
                    wa_result = await vapi_service.send_whatsapp_message({
                        "to": client_phone,
                        "message": reminder_msg
                    })
                    if wa_result.get("success"):
                        sent = True
                except Exception as e:
                    logger.error(f"WhatsApp reminder error for {client_name}: {e}")
            
            if sent:
                sent_count += 1
                # Mark appointment as reminded
                await _db.appointments.update_one(
                    {"_id": apt["_id"]},
                    {"$set": {"reminder_sent": True, "reminder_sent_at": now}}
                )
                results.append({"name": client_name, "phone": client_phone, "status": "enviado"})
            else:
                failed_count += 1
                results.append({"name": client_name, "phone": client_phone, "status": "fallido"})
        
        # Log outbound action
        await _db.vapi_outbound_logs.insert_one({
            "action": "appointment_reminders",
            "method": method,
            "hours_ahead": hours_ahead,
            "total_appointments": len(upcoming),
            "sent": sent_count,
            "failed": failed_count,
            "results": results,
            "created_at": now,
        })
        
        return {
            "success": True,
            "message": f"Se enviaron {sent_count} recordatorios de {len(upcoming)} citas pendientes.",
            "sent": sent_count,
            "failed": failed_count,
            "details": results,
        }
    
    except Exception as e:
        logger.error(f"Appointment reminders error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outbound/history")
async def get_outbound_history(limit: int = 20):
    """Get history of outbound notification campaigns"""
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        logs = await _db.vapi_outbound_logs.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        for log in logs:
            if "created_at" in log and hasattr(log["created_at"], "isoformat"):
                log["created_at"] = log["created_at"].isoformat()
        
        return {"history": logs}
    except Exception as e:
        logger.error(f"Outbound history error: {e}")
        return {"history": []}


# ============== VAPI Balance / Usage ==============

@router.get("/dashboard/balance")
async def get_vapi_balance():
    """Get VAPI account usage, cost breakdown, and estimated balance"""
    import httpx
    
    vapi_key = os.getenv("VAPI_API_KEY", "")
    if not vapi_key:
        raise HTTPException(status_code=503, detail="VAPI API Key not configured")
    
    try:
        headers = {"Authorization": f"Bearer {vapi_key}"}
        
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get("https://api.vapi.ai/call?limit=1000", headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Error fetching VAPI calls")
            
            calls = resp.json()
        
        total_cost = 0
        cost_breakdown = {"transport": 0, "stt": 0, "llm": 0, "tts": 0, "vapi": 0}
        total_minutes = 0
        monthly_spend = {}
        
        for call in calls:
            cost = call.get("cost", 0) or 0
            total_cost += cost
            
            # Breakdown
            bd = call.get("costBreakdown", {})
            for key in cost_breakdown:
                cost_breakdown[key] += bd.get(key, 0) or 0
            
            # Duration
            started = call.get("startedAt", "")
            ended = call.get("endedAt", "")
            if started and ended:
                try:
                    from dateutil import parser as dtparser
                    s = dtparser.isoparse(started)
                    e = dtparser.isoparse(ended)
                    total_minutes += (e - s).total_seconds() / 60
                except Exception:
                    pass
            
            # Monthly grouping
            if started:
                month_key = started[:7]  # "2026-04"
                if month_key not in monthly_spend:
                    monthly_spend[month_key] = {"cost": 0, "calls": 0}
                monthly_spend[month_key]["cost"] += cost
                monthly_spend[month_key]["calls"] += 1
        
        # Round all values
        for key in cost_breakdown:
            cost_breakdown[key] = round(cost_breakdown[key], 4)
        
        # Estimated balance (trial starts at $10)
        initial_credits = 10.00
        estimated_balance = max(initial_credits - total_cost, 0)
        
        return {
            "total_calls": len(calls),
            "total_cost": round(total_cost, 4),
            "estimated_balance": round(estimated_balance, 2),
            "initial_credits": initial_credits,
            "total_minutes": round(total_minutes, 1),
            "avg_cost_per_call": round(total_cost / max(len(calls), 1), 4),
            "avg_cost_per_minute": round(total_cost / max(total_minutes, 0.1), 4),
            "cost_breakdown": cost_breakdown,
            "monthly_spend": dict(sorted(monthly_spend.items(), reverse=True)),
            "recharge_url": "https://dashboard.vapi.ai/org/billing/credits",
            "dashboard_url": "https://dashboard.vapi.ai",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VAPI balance error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
