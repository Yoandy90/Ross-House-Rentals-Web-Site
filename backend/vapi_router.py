"""
VAPI AI Phone Assistant Router
================================
Handles:
1. Multi-agent creation and management
2. Webhook endpoint for function calls (search client, check balance, schedule appointment, process payment)
3. Phone number provisioning
4. Call logs and analytics
5. AI Brain integration (client insights + learning from transcripts)
6. Outbound call scheduling
7. Payment link generation & delivery (SMS/Email/WhatsApp)
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timedelta
from bson import ObjectId
import httpx
import os
import logging
import json
import uuid
import hashlib

logger = logging.getLogger("vapi_assistant")

vapi_router = APIRouter()

# ── Module-level state ──
_db = None
_get_user_from_token = None

VAPI_BASE_URL = "https://api.vapi.ai"

AVAILABLE_VOICES = {
    "female": [
        {"id": "Emma", "label": "Emma", "accent": "American", "age": "20s"},
        {"id": "Savannah", "label": "Savannah", "accent": "Southern", "age": "20s"},
        {"id": "Clara", "label": "Clara", "accent": "American", "age": "30s"},
        {"id": "Lily", "label": "Lily", "accent": "British", "age": "20s"},
        {"id": "Hana", "label": "Hana", "accent": "Asian", "age": "20s"},
        {"id": "Kylie", "label": "Kylie", "accent": "Australian", "age": "20s"},
        {"id": "Mia", "label": "Mia", "accent": "American", "age": "20s"},
        {"id": "Zoe", "label": "Zoe", "accent": "American", "age": "20s"},
        {"id": "Leah", "label": "Leah", "accent": "American", "age": "20s"},
        {"id": "Tara", "label": "Tara", "accent": "Indian", "age": "20s"},
        {"id": "Jess", "label": "Jess", "accent": "American", "age": "20s"},
        {"id": "Neha", "label": "Neha", "accent": "Indian", "age": "20s"},
        {"id": "Naina", "label": "Naina", "accent": "Indian", "age": "20s"},
    ],
    "male": [
        {"id": "Gustavo", "label": "Gustavo", "accent": "Latin", "age": "30s"},
        {"id": "Elliot", "label": "Elliot", "accent": "American", "age": "30s"},
        {"id": "Rohan", "label": "Rohan", "accent": "Indian", "age": "20s"},
        {"id": "Cole", "label": "Cole", "accent": "American", "age": "20s"},
        {"id": "Harry", "label": "Harry", "accent": "British", "age": "30s"},
        {"id": "Spencer", "label": "Spencer", "accent": "American", "age": "30s"},
        {"id": "Nico", "label": "Nico", "accent": "American", "age": "20s"},
        {"id": "Kai", "label": "Kai", "accent": "American", "age": "20s"},
        {"id": "Sagar", "label": "Sagar", "accent": "Indian", "age": "20s"},
        {"id": "Leo", "label": "Leo", "accent": "American", "age": "20s"},
        {"id": "Dan", "label": "Dan", "accent": "American", "age": "30s"},
        {"id": "Zac", "label": "Zac", "accent": "American", "age": "20s"},
        {"id": "Sid", "label": "Sid", "accent": "American", "age": "20s"},
        {"id": "Godfrey", "label": "Godfrey", "accent": "British", "age": "40s"},
        {"id": "Neil", "label": "Neil", "accent": "American", "age": "30s"},
    ],
}

SPECIALTIES = {
    "receptionist": {"label": "Recepcionista", "description": "Citas, info general, recepción de llamadas"},
    "collections": {"label": "Cobros", "description": "Pagos, balances, facturación"},
    "tax_support": {"label": "Soporte Fiscal", "description": "Consultas de impuestos, reembolsos, enmiendas"},
    "itin_docs": {"label": "ITIN & Documentos", "description": "Aplicaciones ITIN, documentación"},
    "bookkeeping": {"label": "Contabilidad", "description": "Consultas de contabilidad y nóminas"},
    "general": {"label": "General", "description": "Asistente de propósito general"},
}


def set_vapi_database(db, get_user_func=None):
    global _db, _get_user_from_token
    _db = db
    _get_user_from_token = get_user_func


def _vapi_headers():
    return {
        "Authorization": f"Bearer {os.environ.get('VAPI_PRIVATE_KEY', '')}",
        "Content-Type": "application/json"
    }


def _serialize(doc):
    if not doc:
        return doc
    doc = dict(doc)
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ═══════════════════════════════════════════════════════════════
# ASSISTANT CONFIGURATION
# ═══════════════════════════════════════════════════════════════

ROSS_TAX_SYSTEM_PROMPT = """You are Rosa, the virtual assistant for Ross Tax Preparation LLC, a professional tax preparation and financial services company in Houston, Texas.

## YOUR PERSONALITY
- Warm, professional, and helpful
- You speak fluent Spanish and English
- If the caller speaks Spanish, respond in Spanish. If English, respond in English.
- Keep responses concise (under 40 words when possible)
- Always be empathetic and patient

## SERVICES WE OFFER
- Tax Preparation (Individual & Business): Starting at $150
- Bookkeeping: Starting at $200/month
- ITIN Applications: $75
- Tax Amendments: $100
- Business Formation (LLC/Corp): Starting at $350
- Payroll Services: Starting at $150/month
- Notary Services: $25 per document

## OFFICE INFORMATION
- Business: Ross Tax Preparation LLC
- Address: Houston, Texas
- Hours: Monday-Friday 9AM-6PM, Saturday 10AM-2PM
- Website: rosstaxpreparation.com
- For emergencies or complex questions, offer to transfer to a human agent

## WHAT YOU CAN DO (TOOLS)
1. **Search for a client** by email or phone number
2. **Check a client's balance** and payment status
3. **Schedule appointments** for tax preparation or consultations
4. **Process payments** by collecting card information via keypad (DTMF)
5. **Transfer call** to a human agent (Anaelis) when the client requests it or when you can't resolve their issue
6. **Send appointment confirmation** via WhatsApp and SMS after scheduling
7. **Check IRS refund status** for a client's tax return
8. **Get client insights** from the AI Brain - use this after identifying the caller to know their history, pending balances, and opportunities. This helps you personalize the conversation.
9. **Create payment link** and send via SMS/WhatsApp - use this when a client prefers to pay online later or doesn't have their card at hand

## PAYMENT COLLECTION RULES
- NEVER ask the client to say their card number out loud
- Always use the keypad collection method: "Please enter your card number using your phone's keypad"
- Collect: card number (16 digits), expiration (4 digits MMYY), CVV (3-4 digits)
- Confirm the amount before processing

## APPOINTMENT SCHEDULING
- Available slots: Monday-Friday 9AM-5PM, Saturday 10AM-1PM
- Default appointment duration: 1 hour
- Always confirm date, time, and service type before booking

## CALL TRANSFER RULES
- When a client asks to speak with a human, says "I want to talk to a person", or you can't resolve their issue, use the transfer_call function
- Say: "Let me transfer you to our specialist Anaelis. One moment please."
- Transfer to the office number

## APPOINTMENT CONFIRMATION
- After successfully scheduling an appointment, ALWAYS use send_confirmation to send a WhatsApp and SMS confirmation
- The confirmation includes date, time, service type, and office address

## IRS REFUND STATUS
- Clients may ask "Where's my refund?" or "¿Dónde está mi reembolso?"
- Use check_refund_status with their SSN last 4 digits and filing year
- If no data available, recommend they visit irs.gov/refunds

## IMPORTANT
- If you don't know something, say "Let me connect you with one of our specialists" and use transfer_call
- Never make up information about tax laws or IRS rules
- Always end calls warmly: "Thank you for calling Ross Tax Preparation. Have a great day!"

## AI BRAIN USAGE
- After identifying a caller (via search_client), ALWAYS call get_client_insights to get their full context
- Use the insights to personalize: mention their last appointment, remind about pending balances, offer relevant services
- NEVER share classified business information (company revenue, total client count, employee info, internal finances)
- If a caller asks about classified info, politely decline: "I can only help with your personal account information"

## PAYMENT LINK RULES
- When a client wants to pay but doesn't have their card, offer to send a payment link
- Say: "I can send you a secure payment link via text message and WhatsApp. Would you like that?"
- After creating the link, confirm: "I've sent you a secure payment link to your phone. You can use it anytime within the next 7 days."
- Always confirm the amount before creating the link
"""

ROSS_TAX_FIRST_MESSAGE_ES = "Hola, gracias por llamar a Ross Tax Preparation. Mi nombre es Rosa, ¿en qué puedo ayudarle hoy?"
ROSS_TAX_FIRST_MESSAGE_EN = "Hi, thank you for calling Ross Tax Preparation. My name is Rosa, how can I help you today?"

VAPI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_client",
            "description": "Search for a client in the system by their email address or phone number. Use this when the caller wants to check their account, balance, or appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "The client's email address"
                    },
                    "phone": {
                        "type": "string",
                        "description": "The client's phone number"
                    }
                },
                "required": []
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_balance",
            "description": "Check the outstanding balance and payment history for a specific client. Requires the client's email or phone.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_email": {
                        "type": "string",
                        "description": "The client's email address"
                    }
                },
                "required": ["client_email"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_appointment",
            "description": "Schedule a new appointment for a client. Ask for the date, time, service type, and client information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string",
                        "description": "Full name of the client"
                    },
                    "client_email": {
                        "type": "string",
                        "description": "Client's email address"
                    },
                    "client_phone": {
                        "type": "string",
                        "description": "Client's phone number"
                    },
                    "date": {
                        "type": "string",
                        "description": "Appointment date in YYYY-MM-DD format"
                    },
                    "time": {
                        "type": "string",
                        "description": "Appointment time in HH:MM format (24h)"
                    },
                    "service_type": {
                        "type": "string",
                        "description": "Type of service: tax_preparation, bookkeeping, itin, amendment, consultation, business_formation",
                        "enum": ["tax_preparation", "bookkeeping", "itin", "amendment", "consultation", "business_formation"]
                    },
                    "notes": {
                        "type": "string",
                        "description": "Additional notes about the appointment"
                    }
                },
                "required": ["client_name", "client_phone", "date", "time", "service_type"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "process_payment",
            "description": "Process a payment for a client. Use DTMF keypad to collect card details securely. Never ask card numbers verbally.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_email": {
                        "type": "string",
                        "description": "The client's email"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Payment amount in USD"
                    },
                    "card_number": {
                        "type": "string",
                        "description": "Credit card number collected via DTMF"
                    },
                    "expiry": {
                        "type": "string",
                        "description": "Card expiration MMYY"
                    },
                    "cvv": {
                        "type": "string",
                        "description": "Card CVV collected via DTMF"
                    }
                },
                "required": ["client_email", "amount"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "transfer_call",
            "description": "Transfer the call to a human agent (Anaelis) at the office. Use this when the caller requests to speak with a person or when you cannot resolve their issue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Brief reason for the transfer"
                    }
                },
                "required": ["reason"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_confirmation",
            "description": "Send appointment confirmation via WhatsApp and SMS to the client. Call this immediately after successfully scheduling an appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string",
                        "description": "Client's full name"
                    },
                    "client_phone": {
                        "type": "string",
                        "description": "Client's phone number for SMS/WhatsApp"
                    },
                    "date": {
                        "type": "string",
                        "description": "Appointment date YYYY-MM-DD"
                    },
                    "time": {
                        "type": "string",
                        "description": "Appointment time HH:MM"
                    },
                    "service_type": {
                        "type": "string",
                        "description": "Type of service scheduled"
                    }
                },
                "required": ["client_name", "client_phone", "date", "time", "service_type"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_refund_status",
            "description": "Check the IRS refund status for a client's tax return. Ask for the client's email or last 4 digits of SSN and filing year.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_email": {
                        "type": "string",
                        "description": "Client's email to look up their tax return"
                    },
                    "filing_year": {
                        "type": "integer",
                        "description": "Tax filing year (e.g., 2025)"
                    }
                },
                "required": ["client_email"]
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_client_insights",
            "description": "Get AI Brain insights about a client - their history, pending balances, appointments, and service opportunities. Use this after identifying the caller to personalize the conversation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_email": {
                        "type": "string",
                        "description": "Client's email address"
                    },
                    "client_phone": {
                        "type": "string",
                        "description": "Client's phone number"
                    },
                    "question": {
                        "type": "string",
                        "description": "Specific question about the client (optional)"
                    }
                },
                "required": []
            }
        },
        "server": {
            "url": ""
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_payment_link_for_client",
            "description": "Generate a secure payment link for a client and send it via SMS and WhatsApp. Use this when a client wants to pay later or needs a link to pay online.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_email": {
                        "type": "string",
                        "description": "Client's email address"
                    },
                    "client_name": {
                        "type": "string",
                        "description": "Client's full name"
                    },
                    "client_phone": {
                        "type": "string",
                        "description": "Client's phone number to send the link"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Payment amount in USD"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what the payment is for"
                    }
                },
                "required": ["client_phone", "amount"]
            }
        },
        "server": {
            "url": ""
        }
    }
]


# ═══════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS - Create/Manage Assistant
# ═══════════════════════════════════════════════════════════════

@vapi_router.post('/vapi/setup-assistant')
async def setup_vapi_assistant(request: Request):
    """Create or update the default VAPI assistant (Rosa)"""
    return await _create_or_update_agent({
        "name": "Rosa",
        "voice_id": "Emma",
        "specialty": "receptionist",
        "is_default": True,
        "active": True,
    })


@vapi_router.get('/vapi/voices')
async def get_available_voices():
    """Get all available VAPI voices grouped by gender"""
    return {"success": True, "voices": AVAILABLE_VOICES, "specialties": SPECIALTIES}


@vapi_router.get('/vapi/agents')
async def list_agents(request: Request):
    """List all VAPI agents"""
    agents = await _db.vapi_agents.find({}).sort("created_at", -1).to_list(50)
    return {"success": True, "agents": [_serialize(a) for a in agents]}


@vapi_router.post('/vapi/agents')
async def create_agent(request: Request):
    """Create a new VAPI agent"""
    body = await request.json()
    name = body.get("name", "").strip()
    voice_id = body.get("voice_id", "Emma")
    specialty = body.get("specialty", "general")
    custom_prompt = body.get("custom_prompt", "")
    active = body.get("active", True)

    if not name:
        raise HTTPException(status_code=400, detail="Agent name is required")

    # Check for duplicate name
    existing = await _db.vapi_agents.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Agent '{name}' already exists")

    result = await _create_or_update_agent({
        "name": name,
        "voice_id": voice_id,
        "specialty": specialty,
        "custom_prompt": custom_prompt,
        "active": active,
        "is_default": False,
    })
    return result


@vapi_router.patch('/vapi/agents/{agent_id}')
async def update_agent(agent_id: str, request: Request):
    """Update an existing VAPI agent (activate/deactivate, change voice, etc.)"""
    body = await request.json()
    agent = await _db.vapi_agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # If toggling active status
    if "active" in body:
        new_active = body["active"]
        vapi_assistant_id = agent.get("vapi_assistant_id")

        if vapi_assistant_id and not new_active:
            # Deactivate: we don't delete from VAPI, just mark inactive locally
            pass

        await _db.vapi_agents.update_one(
            {"_id": ObjectId(agent_id)},
            {"$set": {"active": new_active, "updated_at": datetime.utcnow()}}
        )

        if new_active and vapi_assistant_id:
            # Re-sync with VAPI
            await _sync_agent_to_vapi(agent)

    # Update other fields
    update_fields = {}
    for field in ["name", "voice_id", "specialty", "custom_prompt"]:
        if field in body:
            update_fields[field] = body[field]

    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        await _db.vapi_agents.update_one(
            {"_id": ObjectId(agent_id)},
            {"$set": update_fields}
        )
        # Re-sync to VAPI if voice or prompt changed
        if any(f in update_fields for f in ["voice_id", "custom_prompt", "name", "specialty"]):
            updated_agent = await _db.vapi_agents.find_one({"_id": ObjectId(agent_id)})
            await _sync_agent_to_vapi(updated_agent)

    updated = await _db.vapi_agents.find_one({"_id": ObjectId(agent_id)})
    return {"success": True, "agent": _serialize(updated)}


@vapi_router.delete('/vapi/agents/{agent_id}')
async def delete_agent(agent_id: str, request: Request):
    """Delete a VAPI agent"""
    agent = await _db.vapi_agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete the default agent")

    # Delete from VAPI
    vapi_id = agent.get("vapi_assistant_id")
    if vapi_id:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.delete(f"{VAPI_BASE_URL}/assistant/{vapi_id}", headers=_vapi_headers())
        except Exception as e:
            logger.error(f"Error deleting from VAPI: {e}")

    await _db.vapi_agents.delete_one({"_id": ObjectId(agent_id)})
    return {"success": True, "message": f"Agent '{agent.get('name')}' deleted"}


async def _create_or_update_agent(config: dict):
    """Create or update an agent both locally and in VAPI"""
    name = config["name"]
    voice_id = config.get("voice_id", "Emma")
    specialty = config.get("specialty", "general")
    custom_prompt = config.get("custom_prompt", "")
    is_default = config.get("is_default", False)
    active = config.get("active", True)

    server_url = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')
    if server_url and not server_url.startswith('http'):
        server_url = f"https://{server_url}"
    if not server_url:
        server_url = "https://app-nueva-production.up.railway.app"
    webhook_url = f"{server_url}/api/vapi/webhook"

    # Build specialty-specific prompt additions
    specialty_prompts = {
        "receptionist": "You primarily handle scheduling appointments, answering general questions about services, and greeting callers warmly.",
        "collections": "You specialize in payment collection, checking balances, and processing payments. Be firm but polite about outstanding balances.",
        "tax_support": "You specialize in tax-related questions, refund status checks, and tax preparation guidance.",
        "itin_docs": "You specialize in ITIN applications and document requirements. Guide clients on what documents they need.",
        "bookkeeping": "You specialize in bookkeeping and payroll inquiries. Help clients understand their financial records.",
        "general": "You are a general-purpose assistant who can help with any inquiry.",
    }

    full_prompt = ROSS_TAX_SYSTEM_PROMPT
    if specialty in specialty_prompts:
        full_prompt += f"\n\n## YOUR SPECIALTY\n{specialty_prompts[specialty]}"
    if custom_prompt:
        full_prompt += f"\n\n## ADDITIONAL INSTRUCTIONS\n{custom_prompt}"
    full_prompt += f"\n\n## YOUR NAME\nYour name is {name}. Always introduce yourself as {name}."

    # Set server URL on all tools
    tools = json.loads(json.dumps(VAPI_TOOLS))
    for tool in tools:
        if "server" in tool:
            tool["server"]["url"] = webhook_url

    first_msg_es = f"Hola, gracias por llamar a Ross Tax Preparation. Mi nombre es {name}, ¿en qué puedo ayudarle hoy?"
    
    assistant_config = {
        "name": f"{name} - Ross Tax Preparation",
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [{"role": "system", "content": full_prompt}],
            "tools": tools,
            "temperature": 0.4
        },
        "voice": {"provider": "vapi", "voiceId": voice_id},
        "transcriber": {"provider": "deepgram", "model": "nova-3", "language": "multi"},
        "firstMessage": first_msg_es,
        "serverUrl": webhook_url,
        "endCallMessage": f"Gracias por llamar a Ross Tax Preparation. ¡Que tenga un excelente día!",
        "maxDurationSeconds": 600,
        "silenceTimeoutSeconds": 30,
        "backgroundSound": "office"
    }

    # Check if agent exists in DB
    existing = await _db.vapi_agents.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})

    async with httpx.AsyncClient(timeout=30) as client:
        if existing and existing.get("vapi_assistant_id"):
            resp = await client.patch(
                f"{VAPI_BASE_URL}/assistant/{existing['vapi_assistant_id']}",
                headers=_vapi_headers(), json=assistant_config
            )
        else:
            resp = await client.post(
                f"{VAPI_BASE_URL}/assistant",
                headers=_vapi_headers(), json=assistant_config
            )

        if resp.status_code not in [200, 201]:
            logger.error(f"VAPI API error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=f"VAPI error: {resp.text}")

        data = resp.json()
        vapi_assistant_id = data.get("id")

    # Upsert in DB
    agent_doc = {
        "name": name,
        "voice_id": voice_id,
        "specialty": specialty,
        "custom_prompt": custom_prompt,
        "is_default": is_default,
        "active": active,
        "vapi_assistant_id": vapi_assistant_id,
        "webhook_url": webhook_url,
        "updated_at": datetime.utcnow(),
    }

    if existing:
        await _db.vapi_agents.update_one({"_id": existing["_id"]}, {"$set": agent_doc})
        agent_doc["_id"] = existing["_id"]
    else:
        agent_doc["created_at"] = datetime.utcnow()
        agent_doc["total_calls"] = 0
        result = await _db.vapi_agents.insert_one(agent_doc)
        agent_doc["_id"] = result.inserted_id

    # Also update legacy vapi_config for backward compatibility
    if is_default:
        await _db.vapi_config.update_one(
            {"type": "assistant"},
            {"$set": {"type": "assistant", "assistant_id": vapi_assistant_id, "name": data.get("name"), "webhook_url": webhook_url, "updated_at": datetime.utcnow()}},
            upsert=True
        )

    return {
        "success": True,
        "agent": _serialize(agent_doc),
        "vapi_assistant_id": vapi_assistant_id,
        "message": f"Agent '{name}' configured successfully"
    }


async def _sync_agent_to_vapi(agent: dict):
    """Re-sync a local agent config to VAPI"""
    if not agent.get("vapi_assistant_id"):
        return
    await _create_or_update_agent({
        "name": agent["name"],
        "voice_id": agent.get("voice_id", "Emma"),
        "specialty": agent.get("specialty", "general"),
        "custom_prompt": agent.get("custom_prompt", ""),
        "active": agent.get("active", True),
        "is_default": agent.get("is_default", False),
    })


@vapi_router.get('/vapi/status')
async def vapi_status(request: Request):
    """Get VAPI dashboard status with agents, phone, and call stats"""
    agents = await _db.vapi_agents.find({}).to_list(50)
    phone = await _db.vapi_config.find_one({"type": "phone_number"})

    total_calls = await _db.vapi_call_logs.count_documents({})
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_calls = await _db.vapi_call_logs.count_documents({"created_at": {"$gte": today}})
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_calls = await _db.vapi_call_logs.count_documents({"created_at": {"$gte": week_ago}})

    # Calculate costs and duration
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": None,
            "total_cost": {"$sum": {"$ifNull": ["$cost", 0]}},
            "total_duration": {"$sum": {"$ifNull": ["$duration_seconds", 0]}},
            "avg_duration": {"$avg": {"$ifNull": ["$duration_seconds", 0]}},
        }}
    ]
    stats_result = await _db.vapi_call_logs.aggregate(pipeline).to_list(1)
    agg = stats_result[0] if stats_result else {}

    return {
        "success": True,
        "agents": [_serialize(a) for a in agents],
        "active_agents": sum(1 for a in agents if a.get("active")),
        "phone_number": {
            "id": phone.get("phone_id") if phone else None,
            "number": phone.get("number") if phone else None,
            "configured": bool(phone and phone.get("phone_id")),
        },
        "stats": {
            "total_calls": total_calls,
            "today_calls": today_calls,
            "week_calls": week_calls,
            "week_cost": round(agg.get("total_cost", 0), 4),
            "week_duration_minutes": round(agg.get("total_duration", 0) / 60, 1),
            "avg_call_duration_seconds": round(agg.get("avg_duration", 0), 0),
        }
    }


@vapi_router.get('/vapi/phone-numbers')
async def list_vapi_phone_numbers(request: Request):
    """List available VAPI phone numbers"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{VAPI_BASE_URL}/phone-number",
            headers=_vapi_headers()
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return {"success": True, "phone_numbers": resp.json()}


@vapi_router.post('/vapi/buy-phone-number')
async def buy_vapi_phone_number(request: Request):
    """Buy a new phone number from VAPI and attach to assistant"""
    body = await request.json()
    area_code = body.get("area_code", "713")  # Default Houston area code

    config = await _db.vapi_config.find_one({"type": "assistant"})
    if not config or not config.get("assistant_id"):
        raise HTTPException(status_code=400, detail="Setup assistant first")

    async with httpx.AsyncClient(timeout=30) as client:
        # Buy number
        resp = await client.post(
            f"{VAPI_BASE_URL}/phone-number",
            headers=_vapi_headers(),
            json={
                "provider": "vapi",
                "numberDesiredAreaCode": area_code,
                "assistantId": config["assistant_id"],
                "name": "Ross Tax Main Line"
            }
        )

        if resp.status_code not in [200, 201]:
            logger.error(f"VAPI phone error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        data = resp.json()
        phone_id = data.get("id")
        number = data.get("number")

        # Save to DB
        await _db.vapi_config.update_one(
            {"type": "phone_number"},
            {"$set": {
                "type": "phone_number",
                "phone_id": phone_id,
                "number": number,
                "area_code": area_code,
                "assistant_id": config["assistant_id"],
                "created_at": datetime.utcnow()
            }},
            upsert=True
        )

    return {
        "success": True,
        "phone_id": phone_id,
        "number": number,
        "message": f"Phone number {number} purchased and linked to Rosa assistant"
    }


@vapi_router.get('/vapi/call-logs')
async def get_vapi_call_logs(request: Request):
    """Get VAPI call history"""
    limit = int(request.query_params.get('limit', '20'))
    logs = await _db.vapi_call_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"success": True, "calls": [_serialize(l) for l in logs]}


# ═══════════════════════════════════════════════════════════════
# WEBHOOK - Function Call Handler
# ═══════════════════════════════════════════════════════════════

@vapi_router.post('/vapi/webhook')
async def vapi_webhook(request: Request):
    """Handle VAPI webhook events (function calls, status updates, end-of-call)"""
    body = await request.json()
    event_type = body.get("message", {}).get("type", "")

    logger.info(f"VAPI webhook received: {event_type}")

    if event_type == "function-call":
        return await _handle_function_call(body)
    elif event_type == "status-update":
        return await _handle_status_update(body)
    elif event_type == "end-of-call-report":
        return await _handle_end_of_call(body)
    elif event_type == "tool-calls":
        return await _handle_tool_calls(body)
    else:
        logger.info(f"Unhandled VAPI event: {event_type}")
        return {"success": True}


async def _handle_tool_calls(body: dict):
    """Handle the newer tool-calls format from VAPI"""
    message = body.get("message", {})
    tool_calls = message.get("toolCalls", [])
    results = []

    for tc in tool_calls:
        fn_name = tc.get("function", {}).get("name", "")
        fn_args = tc.get("function", {}).get("arguments", {})
        if isinstance(fn_args, str):
            try:
                fn_args = json.loads(fn_args)
            except Exception:
                fn_args = {}

        tool_call_id = tc.get("id", "")
        result = await _execute_function(fn_name, fn_args)

        results.append({
            "toolCallId": tool_call_id,
            "result": json.dumps(result) if isinstance(result, dict) else str(result)
        })

    return {"results": results}


async def _handle_function_call(body: dict):
    """Handle a function call from the VAPI assistant"""
    message = body.get("message", {})
    fn_call = message.get("functionCall", {})
    fn_name = fn_call.get("name", "")
    fn_args = fn_call.get("parameters", {})

    result = await _execute_function(fn_name, fn_args)
    return {"result": json.dumps(result) if isinstance(result, dict) else str(result)}


async def _execute_function(fn_name: str, fn_args: dict):
    """Execute a function and return the result"""
    logger.info(f"Executing function: {fn_name} with args: {fn_args}")

    try:
        if fn_name == "search_client":
            return await _fn_search_client(fn_args)
        elif fn_name == "check_balance":
            return await _fn_check_balance(fn_args)
        elif fn_name == "schedule_appointment":
            return await _fn_schedule_appointment(fn_args)
        elif fn_name == "process_payment":
            return await _fn_process_payment(fn_args)
        elif fn_name == "transfer_call":
            return await _fn_transfer_call(fn_args)
        elif fn_name == "send_confirmation":
            return await _fn_send_confirmation(fn_args)
        elif fn_name == "check_refund_status":
            return await _fn_check_refund_status(fn_args)
        elif fn_name == "get_client_insights":
            return await _fn_get_client_insights(fn_args)
        elif fn_name == "create_payment_link_for_client":
            return await _fn_create_payment_link_for_client(fn_args)
        else:
            return {"error": f"Unknown function: {fn_name}"}
    except Exception as e:
        logger.error(f"Function {fn_name} error: {str(e)}")
        return {"error": f"Error executing {fn_name}: {str(e)}"}


# ── Function Implementations ──

async def _fn_search_client(args: dict):
    """Search for a client by email or phone"""
    email = args.get("email", "").strip().lower()
    phone = args.get("phone", "").strip()

    if not email and not phone:
        return {"found": False, "message": "Please provide an email or phone number to search."}

    query = {}
    if email:
        query["email"] = {"$regex": f"^{email}$", "$options": "i"}
    elif phone:
        # Clean phone number
        clean_phone = ''.join(c for c in phone if c.isdigit())
        query["$or"] = [
            {"phone": {"$regex": clean_phone[-10:]}},
            {"phone_number": {"$regex": clean_phone[-10:]}}
        ]

    user = await _db.users.find_one(query)
    if not user:
        return {"found": False, "message": "No client found with that information."}

    return {
        "found": True,
        "client": {
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", user.get("phone_number", "")),
            "status": user.get("status", "active"),
        }
    }


async def _fn_check_balance(args: dict):
    """Check client balance and recent invoices"""
    email = args.get("client_email", "").strip().lower()
    if not email:
        return {"error": "Client email is required"}

    user = await _db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        return {"error": "Client not found"}

    # Get pending invoices
    invoices = await _db.invoices.find({
        "client_id": str(user["_id"]),
        "status": {"$in": ["pending", "sent", "overdue"]}
    }).sort("created_at", -1).to_list(10)

    total_balance = sum(inv.get("total", inv.get("amount", 0)) for inv in invoices)
    
    invoice_list = []
    for inv in invoices[:5]:
        invoice_list.append({
            "invoice_number": inv.get("invoice_number", "N/A"),
            "amount": inv.get("total", inv.get("amount", 0)),
            "status": inv.get("status", "pending"),
            "date": inv.get("created_at", "").isoformat() if isinstance(inv.get("created_at"), datetime) else str(inv.get("created_at", ""))[:10]
        })

    return {
        "client_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "total_balance": total_balance,
        "pending_invoices": len(invoices),
        "invoices": invoice_list,
        "message": f"The client has a total balance of ${total_balance:.2f} across {len(invoices)} pending invoice(s)." if total_balance > 0 else "The client has no outstanding balance."
    }


async def _fn_schedule_appointment(args: dict):
    """Schedule an appointment"""
    client_name = args.get("client_name", "").strip()
    client_phone = args.get("client_phone", "").strip()
    client_email = args.get("client_email", "").strip()
    date_str = args.get("date", "")
    time_str = args.get("time", "")
    service_type = args.get("service_type", "consultation")
    notes = args.get("notes", "")

    if not client_name or not date_str or not time_str:
        return {"error": "Client name, date, and time are required"}

    try:
        appt_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        return {"error": "Invalid date or time format. Use YYYY-MM-DD and HH:MM"}

    # Check if the slot is available (not on Sunday, within business hours)
    if appt_datetime.weekday() == 6:  # Sunday
        return {"error": "We are closed on Sundays. Please choose another day."}
    
    hour = appt_datetime.hour
    if appt_datetime.weekday() == 5:  # Saturday
        if hour < 10 or hour >= 14:
            return {"error": "Saturday hours are 10AM-2PM. Please choose a time within those hours."}
    else:  # Weekday
        if hour < 9 or hour >= 17:
            return {"error": "Weekday hours are 9AM-5PM. Please choose a time within those hours."}

    # Check for conflicts
    start = appt_datetime
    end = appt_datetime + timedelta(hours=1)
    conflict = await _db.appointments.find_one({
        "date": date_str,
        "status": {"$nin": ["cancelled", "no_show"]},
        "$or": [
            {"start_time": {"$gte": time_str, "$lt": (appt_datetime + timedelta(hours=1)).strftime("%H:%M")}},
        ]
    })

    service_labels = {
        "tax_preparation": "Tax Preparation",
        "bookkeeping": "Bookkeeping Consultation",
        "itin": "ITIN Application",
        "amendment": "Tax Amendment",
        "consultation": "General Consultation",
        "business_formation": "Business Formation"
    }

    # Create appointment
    appointment = {
        "client_name": client_name,
        "client_phone": client_phone,
        "client_email": client_email,
        "date": date_str,
        "start_time": time_str,
        "end_time": (appt_datetime + timedelta(hours=1)).strftime("%H:%M"),
        "service_type": service_type,
        "service_label": service_labels.get(service_type, service_type),
        "notes": f"[Scheduled via VAPI Phone Assistant] {notes}".strip(),
        "status": "confirmed",
        "source": "vapi_phone",
        "created_at": datetime.utcnow(),
    }

    result = await _db.appointments.insert_one(appointment)

    return {
        "success": True,
        "appointment_id": str(result.inserted_id),
        "message": f"Appointment scheduled for {client_name} on {date_str} at {time_str} for {service_labels.get(service_type, service_type)}. The appointment is confirmed."
    }


async def _fn_process_payment(args: dict):
    """Process a payment (logs the intent - actual NMI processing needs secure card data)"""
    email = args.get("client_email", "").strip()
    amount = args.get("amount", 0)
    card_number = args.get("card_number", "")
    expiry = args.get("expiry", "")
    cvv = args.get("cvv", "")

    if not email or not amount:
        return {"error": "Client email and amount are required"}

    user = await _db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        return {"error": "Client not found"}

    # If card details provided, attempt NMI payment
    if card_number and expiry and cvv:
        try:
            nmi_key = os.environ.get("NMI_SECURITY_KEY", "")
            if not nmi_key:
                return {"error": "Payment system is not configured. Please call during business hours."}

            async with httpx.AsyncClient(timeout=30) as client:
                nmi_resp = await client.post(
                    "https://secure.nmi.com/api/transact.php",
                    data={
                        "security_key": nmi_key,
                        "type": "sale",
                        "amount": f"{amount:.2f}",
                        "ccnumber": card_number,
                        "ccexp": expiry,
                        "cvv": cvv,
                        "first_name": user.get("first_name", ""),
                        "last_name": user.get("last_name", ""),
                        "email": email,
                    }
                )
                resp_text = nmi_resp.text
                resp_data = dict(x.split("=", 1) for x in resp_text.split("&") if "=" in x)

                if resp_data.get("response") == "1":
                    # Payment successful - log it
                    await _db.vapi_payments.insert_one({
                        "client_id": str(user["_id"]),
                        "client_email": email,
                        "amount": amount,
                        "transaction_id": resp_data.get("transactionid", ""),
                        "status": "approved",
                        "source": "vapi_phone",
                        "created_at": datetime.utcnow()
                    })
                    return {
                        "success": True,
                        "message": f"Payment of ${amount:.2f} processed successfully. Transaction ID: {resp_data.get('transactionid', 'N/A')}. A receipt will be sent to {email}."
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Payment declined: {resp_data.get('responsetext', 'Unknown error')}. Please try a different card or call during business hours."
                    }
        except Exception as e:
            logger.error(f"NMI payment error: {str(e)}")
            return {"error": "Payment processing error. Please try again or call during business hours."}
    else:
        # No card details - log as payment intent
        await _db.vapi_payments.insert_one({
            "client_id": str(user["_id"]),
            "client_email": email,
            "amount": amount,
            "status": "pending_card",
            "source": "vapi_phone",
            "created_at": datetime.utcnow(),
            "notes": "Card details not yet collected"
        })
        return {
            "success": True,
            "needs_card": True,
            "message": f"Ready to process ${amount:.2f} for {user.get('first_name', '')}. Please collect the card information securely using the keypad."
        }


async def _fn_transfer_call(args: dict):
    """Transfer the call to a human agent"""
    reason = args.get("reason", "Client requested human agent")
    office_number = os.environ.get("TWILIO_PHONE_NUMBER", "+18065914974")

    # Log the transfer
    await _db.vapi_call_logs.update_one(
        {"status": "in-progress"},
        {"$set": {"transfer_reason": reason, "transferred_at": datetime.utcnow()}},
    )

    return {
        "success": True,
        "transfer": True,
        "destination": office_number,
        "message": f"Transferring to Anaelis at the office. Reason: {reason}"
    }


async def _fn_send_confirmation(args: dict):
    """Send appointment confirmation via WhatsApp and SMS"""
    client_name = args.get("client_name", "")
    client_phone = args.get("client_phone", "").strip()
    date_str = args.get("date", "")
    time_str = args.get("time", "")
    service_type = args.get("service_type", "consultation")

    if not client_phone:
        return {"error": "Client phone number is required"}

    # Clean phone number
    clean_phone = ''.join(c for c in client_phone if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = "1" + clean_phone
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    service_labels = {
        "tax_preparation": "Preparación de Impuestos",
        "bookkeeping": "Contabilidad",
        "itin": "Aplicación ITIN",
        "amendment": "Enmienda de Impuestos",
        "consultation": "Consulta General",
        "business_formation": "Formación de Empresa"
    }
    service_label = service_labels.get(service_type, service_type)

    # Format date nicely
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        date_formatted = dt.strftime("%A, %B %d, %Y")
        time_formatted = dt.strftime("%I:%M %p")
    except Exception:
        date_formatted = date_str
        time_formatted = time_str

    confirmation_msg = (
        f"✅ *Cita Confirmada - Ross Tax Preparation*\n\n"
        f"👤 {client_name}\n"
        f"📅 {date_formatted}\n"
        f"🕐 {time_formatted}\n"
        f"📋 {service_label}\n"
        f"📍 Houston, TX\n\n"
        f"Para cancelar o reprogramar, llame al (832) 780-4637\n"
        f"Gracias por elegir Ross Tax Preparation! 🏛️"
    )

    sms_sent = False
    whatsapp_sent = False

    # Send SMS via Twilio
    try:
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")

        if twilio_sid and twilio_token and twilio_from:
            async with httpx.AsyncClient(timeout=15) as client:
                sms_resp = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json",
                    auth=(twilio_sid, twilio_token),
                    data={
                        "To": clean_phone,
                        "From": twilio_from,
                        "Body": confirmation_msg.replace("*", "")  # Remove markdown for SMS
                    }
                )
                if sms_resp.status_code in [200, 201]:
                    sms_sent = True
                    logger.info(f"SMS sent to {clean_phone}")
                else:
                    logger.error(f"SMS error: {sms_resp.text}")
    except Exception as e:
        logger.error(f"SMS send error: {str(e)}")

    # Send WhatsApp via Meta Business API
    try:
        wa_token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
        wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")

        if wa_token and wa_phone_id:
            # Format phone for WhatsApp (no + prefix)
            wa_phone = clean_phone.lstrip("+")
            async with httpx.AsyncClient(timeout=15) as client:
                wa_resp = await client.post(
                    f"https://graph.facebook.com/v18.0/{wa_phone_id}/messages",
                    headers={
                        "Authorization": f"Bearer {wa_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": wa_phone,
                        "type": "text",
                        "text": {"body": confirmation_msg}
                    }
                )
                if wa_resp.status_code in [200, 201]:
                    whatsapp_sent = True
                    logger.info(f"WhatsApp sent to {wa_phone}")
                else:
                    logger.error(f"WhatsApp error: {wa_resp.text}")
    except Exception as e:
        logger.error(f"WhatsApp send error: {str(e)}")

    return {
        "success": True,
        "sms_sent": sms_sent,
        "whatsapp_sent": whatsapp_sent,
        "message": f"Confirmation sent to {client_phone}" + (
            " via WhatsApp and SMS" if whatsapp_sent and sms_sent
            else " via WhatsApp" if whatsapp_sent
            else " via SMS" if sms_sent
            else " (delivery pending)"
        )
    }


async def _fn_check_refund_status(args: dict):
    """Check IRS refund status for a client"""
    email = args.get("client_email", "").strip().lower()
    filing_year = args.get("filing_year", datetime.utcnow().year - 1)

    if not email:
        return {"error": "Client email is required"}

    user = await _db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        return {"error": "Client not found in our system"}

    # Look for tax return in our system
    tax_return = await _db.tax_returns.find_one({
        "$or": [
            {"client_id": str(user["_id"])},
            {"user_id": str(user["_id"])},
            {"email": {"$regex": f"^{email}$", "$options": "i"}}
        ],
        "filing_year": {"$in": [filing_year, str(filing_year)]}
    })

    if not tax_return:
        # Check the broader returns collection
        tax_return = await _db.tax_returns.find_one({
            "$or": [
                {"client_id": str(user["_id"])},
                {"user_id": str(user["_id"])}
            ]
        }, sort=[("created_at", -1)])

    if not tax_return:
        return {
            "found": False,
            "message": f"No tax return found for {user.get('first_name', '')} for year {filing_year}. They may not have filed yet, or the return is being processed. Recommend visiting irs.gov/refunds for official status."
        }

    status = tax_return.get("status", "unknown")
    refund_amount = tax_return.get("refund_amount", tax_return.get("estimated_refund", 0))
    filed_date = tax_return.get("filed_date", tax_return.get("created_at", ""))

    status_messages = {
        "draft": "The tax return is still being prepared. It has not been submitted to the IRS yet.",
        "submitted": "The tax return has been submitted to the IRS and is being processed. Refunds typically take 21 days after acceptance.",
        "accepted": "Great news! The IRS has accepted the tax return. The refund should arrive within 21 days of acceptance.",
        "rejected": "The IRS rejected the tax return. Our team needs to review and correct it. Please schedule an appointment.",
        "completed": "The tax return has been completed and processed.",
        "refund_issued": "The IRS has issued the refund. It should arrive within 5 business days via direct deposit.",
    }

    return {
        "found": True,
        "client_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "filing_year": filing_year,
        "status": status,
        "refund_amount": refund_amount,
        "status_message": status_messages.get(status, f"Current status: {status}. For the most up-to-date information, visit irs.gov/refunds."),
        "filed_date": filed_date.isoformat() if isinstance(filed_date, datetime) else str(filed_date)[:10],
        "tip": "For real-time IRS refund tracking, visit irs.gov/refunds or use the IRS2Go app."
    }


async def _fn_get_client_insights(args: dict):
    """Get AI Brain insights about a client for personalized phone interactions"""
    email = args.get("client_email", "").strip()
    phone = args.get("client_phone", "").strip()
    question = args.get("question", "").strip()

    # Check for classified info requests
    if question and _is_classified_request(question):
        return {
            "error": "CLASSIFIED: This information cannot be shared over the phone. Only personal account information can be provided.",
            "message": "I can only help with your personal account information."
        }

    context = await get_ai_brain_client_context(email=email if email else None, phone=phone if phone else None)

    if not context.get("context"):
        return {"message": "No client record found. This may be a new caller."}

    return {
        "success": True,
        "insights": context["context"],
        "client_name": context.get("client_name", ""),
        "balance": context.get("balance", 0),
        "message": f"Context loaded for {context.get('client_name', 'client')}. Use this to personalize the conversation."
    }


async def _fn_create_payment_link_for_client(args: dict):
    """Create a payment link and send it to the client via SMS/WhatsApp"""
    client_email = args.get("client_email", "").strip()
    client_name = args.get("client_name", "").strip()
    client_phone = args.get("client_phone", "").strip()
    amount = float(args.get("amount", 0))
    description = args.get("description", "Payment to Ross Tax Preparation")

    if not amount or amount <= 0:
        return {"error": "A valid payment amount is required."}
    if not client_phone:
        return {"error": "Client phone number is required to send the payment link."}

    # Generate unique link
    link_token = str(uuid.uuid4()).replace("-", "")[:16]
    link_secret = hashlib.sha256(f"{link_token}{datetime.utcnow().isoformat()}".encode()).hexdigest()[:8]
    payment_code = f"{link_token}{link_secret}"
    base_url = "https://www.rosstaxpreparation.com"
    payment_url = f"{base_url}/pay/{payment_code}"

    # Store in DB
    payment_link = {
        "code": payment_code,
        "client_email": client_email,
        "client_name": client_name,
        "client_phone": client_phone,
        "amount": amount,
        "description": description,
        "payment_url": payment_url,
        "status": "active",
        "views": 0,
        "source": "vapi_phone",
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=7),
    }
    result = await _db.payment_links.insert_one(payment_link)

    # Clean phone
    clean_phone = ''.join(c for c in client_phone if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = "+1" + clean_phone
    elif not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    msg = (
        f"Ross Tax Preparation\n\n"
        f"Hola {client_name or 'Cliente'},\n"
        f"Enlace de pago: ${amount:.2f}\n"
        f"Pagar ahora: {payment_url}\n\n"
        f"Valido por 7 dias."
    )

    sms_sent = False
    whatsapp_sent = False

    # Send SMS
    try:
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
        if twilio_sid and twilio_token and twilio_from:
            async with httpx.AsyncClient(timeout=15) as http_client:
                r = await http_client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json",
                    auth=(twilio_sid, twilio_token),
                    data={"To": clean_phone, "From": twilio_from, "Body": msg}
                )
                sms_sent = r.status_code in [200, 201]
    except Exception as e:
        logger.error(f"SMS error for payment link: {e}")

    # Send WhatsApp
    try:
        wa_token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
        wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
        if wa_token and wa_phone_id:
            wa_phone = clean_phone.lstrip("+")
            async with httpx.AsyncClient(timeout=15) as http_client:
                r = await http_client.post(
                    f"https://graph.facebook.com/v18.0/{wa_phone_id}/messages",
                    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                    json={"messaging_product": "whatsapp", "to": wa_phone, "type": "text", "text": {"body": msg}}
                )
                whatsapp_sent = r.status_code in [200, 201]
    except Exception as e:
        logger.error(f"WhatsApp error for payment link: {e}")

    # Update DB with delivery status
    await _db.payment_links.update_one(
        {"_id": result.inserted_id},
        {"$set": {"sent_via": {"sms": sms_sent, "whatsapp": whatsapp_sent}, "sent_at": datetime.utcnow()}}
    )

    delivery = []
    if sms_sent:
        delivery.append("SMS")
    if whatsapp_sent:
        delivery.append("WhatsApp")

    return {
        "success": True,
        "payment_url": payment_url,
        "amount": amount,
        "sent_via": delivery if delivery else ["pending"],
        "message": f"Payment link for ${amount:.2f} has been sent to {client_phone}" + (
            f" via {' and '.join(delivery)}" if delivery else ". Delivery is pending."
        ) + ". The link is valid for 7 days."
    }


# ── Webhook Event Handlers ──

async def _handle_status_update(body: dict):
    """Handle call status updates"""
    message = body.get("message", {})
    status = message.get("status", "")
    call = message.get("call", {})
    call_id = call.get("id", "")

    logger.info(f"Call {call_id} status: {status}")

    await _db.vapi_call_logs.update_one(
        {"call_id": call_id},
        {"$set": {
            "call_id": call_id,
            "status": status,
            "phone_number": call.get("customer", {}).get("number", ""),
            "updated_at": datetime.utcnow()
        }, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    return {"success": True}


async def _handle_end_of_call(body: dict):
    """Handle end of call report - save transcript and summary"""
    message = body.get("message", {})
    call = message.get("call", {})
    call_id = call.get("id", "")
    transcript = message.get("transcript", "")
    summary = message.get("summary", "")
    duration = message.get("durationSeconds", 0)
    cost = message.get("cost", 0)

    await _db.vapi_call_logs.update_one(
        {"call_id": call_id},
        {"$set": {
            "call_id": call_id,
            "status": "ended",
            "transcript": transcript,
            "summary": summary,
            "duration_seconds": duration,
            "cost": cost,
            "ended_at": datetime.utcnow(),
            "phone_number": call.get("customer", {}).get("number", ""),
        }, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )

    # Feed transcript to AI Brain for learning
    await feed_transcript_to_brain({
        "call_id": call_id,
        "phone_number": call.get("customer", {}).get("number", ""),
        "transcript": transcript,
        "summary": summary,
        "duration_seconds": duration,
    })

    logger.info(f"Call {call_id} ended. Duration: {duration}s, Cost: ${cost:.4f}")
    return {"success": True}



# ═══════════════════════════════════════════════════════════════
# 1. AI BRAIN INTEGRATION
# ═══════════════════════════════════════════════════════════════

# Classified info filter - NEVER expose these to phone callers
CLASSIFIED_KEYWORDS = [
    "total clients", "total clientes", "how many clients", "cuantos clientes",
    "revenue", "ingresos", "profit", "ganancia", "salary", "salario",
    "employee", "empleado", "staff", "personal", "payroll", "nomina",
    "bank account", "cuenta bancaria", "company finances", "finanzas de la empresa",
    "how much we make", "cuanto ganamos", "business secrets", "secretos",
]

def _is_classified_request(text: str) -> bool:
    """Check if a request asks for classified business information"""
    lower = text.lower()
    return any(kw in lower for kw in CLASSIFIED_KEYWORDS)


async def get_ai_brain_client_context(email: str = None, phone: str = None) -> dict:
    """Get AI Brain context for a client (filtered for phone use)"""
    if _db is None:
        return {"context": ""}

    # Find the client
    query = {}
    if email:
        query["email"] = {"$regex": f"^{email}$", "$options": "i"}
    elif phone:
        clean = ''.join(c for c in phone if c.isdigit())
        query["$or"] = [{"phone": {"$regex": clean[-10:]}}, {"phone_number": {"$regex": clean[-10:]}}]

    user = await _db.users.find_one(query)
    if not user:
        return {"context": "New caller, no client record found."}

    uid = str(user["_id"])

    # Gather client context
    appointments = await _db.appointments.find({"$or": [
        {"client_id": uid}, {"client_email": user.get("email")}
    ]}).sort("date", -1).limit(3).to_list(3)

    invoices = await _db.invoices.find({
        "client_id": uid, "status": {"$in": ["pending", "sent", "overdue"]}
    }).to_list(10)

    tax_returns = await _db.tax_returns.find({
        "$or": [{"client_id": uid}, {"user_id": uid}]
    }).sort("created_at", -1).limit(2).to_list(2)

    total_balance = sum(inv.get("total", inv.get("amount", 0)) for inv in invoices)
    
    # Build safe context summary (NO classified data)
    context_parts = [
        f"Client: {user.get('first_name', '')} {user.get('last_name', '')}",
        f"Email: {user.get('email', 'N/A')}",
        f"Phone: {user.get('phone', user.get('phone_number', 'N/A'))}",
        f"Outstanding balance: ${total_balance:.2f}" if total_balance > 0 else "No outstanding balance",
        f"Pending invoices: {len(invoices)}",
    ]

    if appointments:
        last_appt = appointments[0]
        context_parts.append(f"Last appointment: {last_appt.get('date', 'N/A')} - {last_appt.get('service_type', 'N/A')}")

    if tax_returns:
        last_return = tax_returns[0]
        context_parts.append(f"Latest tax return: Year {last_return.get('filing_year', 'N/A')} - Status: {last_return.get('status', 'N/A')}")

    # Check for opportunities
    if not tax_returns:
        context_parts.append("OPPORTUNITY: Client has no tax returns filed. Offer tax preparation services.")
    if total_balance > 0:
        context_parts.append(f"REMINDER: Client owes ${total_balance:.2f}. Offer to process payment.")

    return {
        "context": "\n".join(context_parts),
        "client_id": uid,
        "client_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "balance": total_balance,
    }


async def feed_transcript_to_brain(call_log: dict):
    """Feed call transcript to AI Brain for learning"""
    try:
        transcript = call_log.get("transcript", "")
        phone = call_log.get("phone_number", "")
        summary = call_log.get("summary", "")
        if not transcript:
            return

        # Store in ai_brain_learnings collection
        await _db.ai_brain_learnings.insert_one({
            "type": "phone_call_transcript",
            "source": "vapi",
            "call_id": call_log.get("call_id"),
            "phone_number": phone,
            "transcript": transcript,
            "summary": summary,
            "duration_seconds": call_log.get("duration_seconds", 0),
            "insights_extracted": False,
            "created_at": datetime.utcnow()
        })
        logger.info(f"Transcript fed to AI Brain for learning: {call_log.get('call_id')}")
    except Exception as e:
        logger.error(f"Error feeding transcript to brain: {e}")


@vapi_router.post('/vapi/brain/client-context')
async def get_client_context_endpoint(request: Request):
    """Get AI Brain context for a client (for testing/admin use)"""
    body = await request.json()
    result = await get_ai_brain_client_context(
        email=body.get("email"), phone=body.get("phone")
    )
    return {"success": True, **result}


# ═══════════════════════════════════════════════════════════════
# 2. OUTBOUND CALLS - Schedule & Execute
# ═══════════════════════════════════════════════════════════════

@vapi_router.post('/vapi/outbound/schedule')
async def schedule_outbound_call(request: Request):
    """Schedule an outbound call to a client"""
    body = await request.json()
    client_phone = body.get("phone", "").strip()
    client_name = body.get("client_name", "")
    client_email = body.get("client_email", "")
    scheduled_time = body.get("scheduled_time", "")  # ISO format
    purpose = body.get("purpose", "follow_up")  # reminder, collection, follow_up, custom
    custom_message = body.get("custom_message", "")
    agent_name = body.get("agent_name", "Rosa")

    if not client_phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    # Clean phone
    clean_phone = ''.join(c for c in client_phone if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = "+1" + clean_phone
    elif not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Parse scheduled time
    try:
        sched_dt = datetime.fromisoformat(scheduled_time) if scheduled_time else datetime.utcnow() + timedelta(minutes=5)
    except Exception:
        sched_dt = datetime.utcnow() + timedelta(minutes=5)

    purpose_prompts = {
        "reminder": f"You are calling {client_name} to remind them about their upcoming appointment at Ross Tax Preparation. Be brief and friendly.",
        "collection": f"You are calling {client_name} to kindly remind them about their outstanding balance. Offer to process a payment over the phone.",
        "follow_up": f"You are calling {client_name} for a follow-up. Ask if they need any tax preparation services or have questions.",
        "custom": custom_message or f"You are calling {client_name}. Be professional and helpful.",
    }

    scheduled_call = {
        "client_phone": clean_phone,
        "client_name": client_name,
        "client_email": client_email,
        "scheduled_time": sched_dt,
        "purpose": purpose,
        "purpose_prompt": purpose_prompts.get(purpose, purpose_prompts["follow_up"]),
        "agent_name": agent_name,
        "status": "scheduled",
        "created_at": datetime.utcnow(),
    }
    result = await _db.vapi_scheduled_calls.insert_one(scheduled_call)

    return {
        "success": True,
        "call_id": str(result.inserted_id),
        "scheduled_time": sched_dt.isoformat(),
        "message": f"Call to {client_name} ({clean_phone}) scheduled for {sched_dt.strftime('%m/%d/%Y %I:%M %p')}"
    }


@vapi_router.post('/vapi/outbound/call-now')
async def make_outbound_call_now(request: Request):
    """Make an outbound call immediately"""
    body = await request.json()
    client_phone = body.get("phone", "").strip()
    client_name = body.get("client_name", "Unknown")
    purpose = body.get("purpose", "follow_up")
    custom_message = body.get("custom_message", "")
    agent_name = body.get("agent_name", "Rosa")

    if not client_phone:
        raise HTTPException(status_code=400, detail="Phone number required")

    clean_phone = ''.join(c for c in client_phone if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = "+1" + clean_phone
    elif not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # Find the agent
    agent = await _db.vapi_agents.find_one({"name": {"$regex": f"^{agent_name}$", "$options": "i"}, "active": True})
    if not agent:
        agent = await _db.vapi_agents.find_one({"is_default": True, "active": True})
    if not agent:
        raise HTTPException(status_code=400, detail="No active agent found")

    assistant_id = agent.get("vapi_assistant_id")
    phone_config = await _db.vapi_config.find_one({"type": "phone_number"})
    if not phone_config:
        raise HTTPException(status_code=400, detail="No phone number configured")

    purpose_messages = {
        "reminder": f"Hola {client_name}, le llamo de Ross Tax Preparation para recordarle sobre su cita programada. ¿Tiene un momento?",
        "collection": f"Hola {client_name}, le llamo de Ross Tax Preparation. Quería confirmar algunos detalles sobre su cuenta. ¿Tiene un momento?",
        "follow_up": f"Hola {client_name}, le llamo de Ross Tax Preparation para darle seguimiento. ¿Tiene un momento?",
        "custom": custom_message or f"Hola {client_name}, le llamo de Ross Tax Preparation. ¿Tiene un momento?",
    }

    # Make the call via VAPI API
    async with httpx.AsyncClient(timeout=30) as client_http:
        resp = await client_http.post(
            f"{VAPI_BASE_URL}/call",
            headers=_vapi_headers(),
            json={
                "assistantId": assistant_id,
                "phoneNumberId": phone_config["phone_id"],
                "customer": {"number": clean_phone, "name": client_name},
                "assistantOverrides": {
                    "firstMessage": purpose_messages.get(purpose, purpose_messages["follow_up"]),
                }
            }
        )
        if resp.status_code not in [200, 201]:
            logger.error(f"Outbound call error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=f"VAPI call error: {resp.text}")

        data = resp.json()

    # Log the call
    await _db.vapi_call_logs.insert_one({
        "call_id": data.get("id"),
        "direction": "outbound",
        "client_name": client_name,
        "phone_number": clean_phone,
        "purpose": purpose,
        "agent_name": agent_name,
        "status": "initiated",
        "created_at": datetime.utcnow()
    })

    return {
        "success": True,
        "vapi_call_id": data.get("id"),
        "message": f"Calling {client_name} at {clean_phone} now..."
    }


@vapi_router.get('/vapi/outbound/scheduled')
async def list_scheduled_calls(request: Request):
    """List all scheduled outbound calls"""
    status_filter = request.query_params.get("status", "")
    query = {}
    if status_filter:
        query["status"] = status_filter
    calls = await _db.vapi_scheduled_calls.find(query).sort("scheduled_time", 1).limit(50).to_list(50)
    return {"success": True, "scheduled_calls": [_serialize(c) for c in calls]}


@vapi_router.delete('/vapi/outbound/{call_id}')
async def cancel_scheduled_call(call_id: str, request: Request):
    """Cancel a scheduled outbound call"""
    result = await _db.vapi_scheduled_calls.update_one(
        {"_id": ObjectId(call_id), "status": "scheduled"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Call not found or already processed")
    return {"success": True, "message": "Scheduled call cancelled"}


# ═══════════════════════════════════════════════════════════════
# 3. PAYMENT LINKS - Generate & Send via SMS/Email/WhatsApp
# ═══════════════════════════════════════════════════════════════

@vapi_router.post('/vapi/payment-link/create')
async def create_payment_link(request: Request):
    """Generate a unique payment link for a client"""
    body = await request.json()
    client_email = body.get("client_email", "").strip()
    client_name = body.get("client_name", "")
    client_phone = body.get("client_phone", "")
    amount = float(body.get("amount", 0))
    description = body.get("description", "Payment to Ross Tax Preparation")
    invoice_id = body.get("invoice_id", "")

    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Valid amount is required")

    # Generate unique link token
    link_token = str(uuid.uuid4()).replace("-", "")[:16]
    link_secret = hashlib.sha256(f"{link_token}{datetime.utcnow().isoformat()}".encode()).hexdigest()[:8]
    payment_code = f"{link_token}{link_secret}"

    # Build payment URL
    base_url = "https://www.rosstaxpreparation.com"
    payment_url = f"{base_url}/pay/{payment_code}"

    payment_link = {
        "code": payment_code,
        "client_email": client_email,
        "client_name": client_name,
        "client_phone": client_phone,
        "amount": amount,
        "description": description,
        "invoice_id": invoice_id,
        "payment_url": payment_url,
        "status": "active",  # active, paid, expired, cancelled
        "views": 0,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=7),
    }
    result = await _db.payment_links.insert_one(payment_link)

    return {
        "success": True,
        "link_id": str(result.inserted_id),
        "payment_url": payment_url,
        "payment_code": payment_code,
        "amount": amount,
        "expires_at": payment_link["expires_at"].isoformat(),
    }


@vapi_router.post('/vapi/payment-link/{link_id}/send')
async def send_payment_link(link_id: str, request: Request):
    """Send payment link via SMS, Email, and/or WhatsApp"""
    body = await request.json()
    channels = body.get("channels", ["sms", "email", "whatsapp"])

    link = await _db.payment_links.find_one({"_id": ObjectId(link_id)})
    if not link:
        raise HTTPException(status_code=404, detail="Payment link not found")

    phone = link.get("client_phone", "")
    email = link.get("client_email", "")
    name = link.get("client_name", "Cliente")
    amount = link.get("amount", 0)
    url = link.get("payment_url", "")

    results = {"sms": False, "email": False, "whatsapp": False}

    msg_es = (
        f"🏛️ Ross Tax Preparation\n\n"
        f"Hola {name},\n\n"
        f"Le enviamos su enlace de pago:\n"
        f"💰 Monto: ${amount:.2f}\n"
        f"🔗 Pagar ahora: {url}\n\n"
        f"El enlace es seguro y expira en 7 días.\n"
        f"Gracias por su preferencia."
    )

    # SMS via Twilio
    if "sms" in channels and phone:
        try:
            clean_phone = ''.join(c for c in phone if c.isdigit())
            if len(clean_phone) == 10:
                clean_phone = "+1" + clean_phone
            elif not clean_phone.startswith("+"):
                clean_phone = "+" + clean_phone

            twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
            twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
            twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")
            if twilio_sid and twilio_token:
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.post(
                        f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json",
                        auth=(twilio_sid, twilio_token),
                        data={"To": clean_phone, "From": twilio_from, "Body": msg_es.replace("🏛️ ", "").replace("💰 ", "").replace("🔗 ", "")}
                    )
                    results["sms"] = r.status_code in [200, 201]
        except Exception as e:
            logger.error(f"SMS error: {e}")

    # Email via SendGrid
    if "email" in channels and email:
        try:
            sg_key = os.environ.get("SENDGRID_API_KEY")
            from_email = os.environ.get("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")
            if sg_key:
                email_html = f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:#0f172a;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
                    <h1 style="color:white;margin:0;font-size:20px;">Ross Tax Preparation</h1>
                  </div>
                  <div style="padding:30px;border:1px solid #e2e8f0;border-top:none;">
                    <p>Hola <strong>{name}</strong>,</p>
                    <p>Le enviamos su enlace de pago seguro:</p>
                    <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
                      <p style="font-size:28px;font-weight:bold;color:#0f172a;margin:0;">${amount:.2f}</p>
                      <p style="color:#64748b;margin:5px 0 15px;">Monto a pagar</p>
                      <a href="{url}" style="display:inline-block;background:#22c55e;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">💳 Pagar Ahora</a>
                    </div>
                    <p style="color:#94a3b8;font-size:12px;">Este enlace expira en 7 días. Si tiene preguntas, llámenos al (832) 780-4637.</p>
                  </div>
                </div>
                """
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={"Authorization": f"Bearer {sg_key}", "Content-Type": "application/json"},
                        json={
                            "personalizations": [{"to": [{"email": email}]}],
                            "from": {"email": from_email, "name": "Ross Tax Preparation"},
                            "subject": f"💳 Enlace de Pago - ${amount:.2f} | Ross Tax Preparation",
                            "content": [{"type": "text/html", "value": email_html}]
                        }
                    )
                    results["email"] = r.status_code in [200, 201, 202]
        except Exception as e:
            logger.error(f"Email error: {e}")

    # WhatsApp via Meta API
    if "whatsapp" in channels and phone:
        try:
            wa_token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
            wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
            if wa_token and wa_phone_id:
                wa_phone = ''.join(c for c in phone if c.isdigit())
                if len(wa_phone) == 10:
                    wa_phone = "1" + wa_phone
                async with httpx.AsyncClient(timeout=15) as client:
                    r = await client.post(
                        f"https://graph.facebook.com/v18.0/{wa_phone_id}/messages",
                        headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                        json={"messaging_product": "whatsapp", "to": wa_phone, "type": "text", "text": {"body": msg_es}}
                    )
                    results["whatsapp"] = r.status_code in [200, 201]
        except Exception as e:
            logger.error(f"WhatsApp error: {e}")

    # Update link with send info
    await _db.payment_links.update_one(
        {"_id": ObjectId(link_id)},
        {"$set": {"sent_via": results, "sent_at": datetime.utcnow()}}
    )

    return {"success": True, "sent": results, "payment_url": url}


@vapi_router.get('/vapi/payment-links')
async def list_payment_links(request: Request):
    """List all payment links"""
    status_filter = request.query_params.get("status", "")
    query = {}
    if status_filter:
        query["status"] = status_filter
    links = await _db.payment_links.find(query).sort("created_at", -1).limit(50).to_list(50)
    return {"success": True, "payment_links": [_serialize(l) for l in links]}


@vapi_router.get('/vapi/payment-link/verify/{code}')
async def verify_payment_link(code: str):
    """Public endpoint - verify a payment link is valid"""
    link = await _db.payment_links.find_one({"code": code, "status": "active"})
    if not link:
        return {"success": False, "message": "Link not found or expired"}

    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        await _db.payment_links.update_one({"_id": link["_id"]}, {"$set": {"status": "expired"}})
        return {"success": False, "message": "Link has expired"}

    # Increment view count
    await _db.payment_links.update_one({"_id": link["_id"]}, {"$inc": {"views": 1}})

    return {
        "success": True,
        "amount": link["amount"],
        "description": link.get("description", ""),
        "client_name": link.get("client_name", ""),
        "expires_at": link["expires_at"].isoformat() if link.get("expires_at") else None,
    }
