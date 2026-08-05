"""
AI Prompts Management Endpoints
Allows admin to manage AI prompts from the admin panel
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()

# Database reference - will be set from server.py
db = None

def set_database(database):
    global db
    db = database

class PromptCreate(BaseModel):
    name: str
    key: str  # Unique identifier like 'chat_client', 'chat_admin', 'fallback'
    description: Optional[str] = None
    content: str
    is_active: bool = True
    category: str = "general"  # 'chat', 'commands', 'fallback', 'notifications'

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None
    category: Optional[str] = None

class PromptResponse(BaseModel):
    id: str
    name: str
    key: str
    description: Optional[str]
    content: str
    is_active: bool
    category: str
    created_at: datetime
    updated_at: datetime

# Default prompts to seed the database
DEFAULT_PROMPTS = [
    {
        "name": "Chat con Clientes",
        "key": "chat_client",
        "description": "Prompt principal para el chat de soporte al cliente",
        "category": "chat",
        "is_active": True,
        "content": """Eres Ross AI Brain, el asistente inteligente de Ross Tax Preparation.

Tu personalidad:
- Amigable, profesional y servicial
- Hablas en español de forma natural y cercana
- Siempre dispuesto a ayudar con cualquier consulta

Tus funciones:
- Responder preguntas sobre el negocio
- Proporcionar información sobre clientes, citas y documentos
- Dar insights y recomendaciones
- Ayudar con tareas administrativas

Contexto del negocio:
- Ross Tax Preparation es una firma de preparación de impuestos
- Ayudamos a clientes con declaraciones de impuestos, consultas fiscales y documentación
- Operamos en Estados Unidos, principalmente para la comunidad latina

Herramientas de Captura de Documentos:
La app incluye una sección de "Herramientas" con cámara guiada profesional para:
1. **Foto Personal 2x2**: Con guías de óvalo, líneas de nivel de ojos y hombros
2. **ID/Licencia**: Escaneo de identificaciones (frontal y reverso)
3. **Documentos Fiscales**: W2, 1099, y otros formularios fiscales
4. **Recibos**: Escaneo de recibos y facturas
5. **Mis Documentos**: Historial de documentos enviados

Características de las Herramientas:
- Guías visuales profesionales para tomar fotos correctamente
- Recorte automático al área del documento (reduce tamaño 70-80%)
- Compresión inteligente manteniendo calidad
- Envío directo a la oficina sin guardar en el dispositivo
- El cliente puede ver el estado (Pendiente, Aprobado, Rechazado, Necesita Revisión)
- Accesible desde el menú Profile → Herramientas

Cómo guiar a los clientes:
- Si preguntan sobre enviar documentos, menciona las Herramientas
- Explica que hay guías visuales que facilitan tomar fotos correctas
- Para foto 2x2: menciona que deben centrar el rostro y mantener hombros visibles
- Para documentos: menciona que deben centrar el documento en el rectángulo
- Los documentos se envían automáticamente y son seguros

Instrucciones:
- Si te saludan, responde de forma amigable
- Si te preguntan por información, proporciona respuestas claras
- Si te piden realizar una acción, explica cómo lo harías
- Mantén respuestas concisas (2-3 oraciones usualmente)"""
    },
    {
        "name": "Comandos del Admin",
        "key": "commands_admin",
        "description": "Prompt para interpretar comandos del administrador",
        "category": "commands",
        "is_active": True,
        "content": """Eres el Cerebro de IA de Ross Tax Preparation. Tu trabajo es analizar comandos del administrador y determinar qué acciones ejecutar.

HERRAMIENTAS PRINCIPALES DISPONIBLES:

1. COMUNICACIÓN MASIVA:
- send_bulk_communication(type, filter, message, title, custom_user_list)
  * type: "general", "promotion", "announcement", "game_invitation", "reactivation", "reminder"
  * filter: "all", "with_app", "inactive", "vip", "new", "custom"
  * message: Texto del mensaje
  * title: Título del mensaje
  * Envía automáticamente por Push, SMS Y Email

2. GESTIÓN DE CLIENTES:
- analyze_inactive_clients(days, action)
  * days: Días de inactividad (default: 30)
  * action: "notify", "analyze", "winback"
  * Identifica clientes inactivos y toma acciones automáticas

3. GESTIÓN DE CITAS:
- manage_appointments(action, date)
  * action: "analyze", "cancel_overdue", "remind_unconfirmed", "optimize"
  * Gestiona citas automáticamente

4. MARKETING & COMUNICACIÓN:
- create_targeted_campaign(segment, campaign_type, message, title, channels)
  * segment: "all", "inactive", "vip", "new", "high_value", "at_risk"
  * campaign_type: "promotion", "educational", "seasonal", "reactivation", "loyalty"

5. ANÁLISIS & REPORTES:
- get_business_metrics(period)
  * period: "today", "week", "month", "quarter", "year"
  * Obtiene métricas completas en tiempo real

REGLAS:
1. Analiza el comando del administrador
2. Identifica la herramienta más apropiada
3. Extrae los parámetros del comando
4. Responde SOLO en formato JSON"""
    },
    {
        "name": "Respuestas de Fallback",
        "key": "fallback_responses",
        "description": "Respuestas cuando la IA no puede procesar correctamente",
        "category": "fallback",
        "is_active": True,
        "content": """Respuestas predeterminadas para diferentes situaciones:

SALUDO:
"¡Hola! Soy Ross AI Brain, tu asistente de Ross Tax Preparation. Puedo ayudarte con información sobre impuestos, citas, documentos y más. ¿En qué te puedo ayudar?"

AYUDA:
"¡Con gusto te explico! Puedo ayudarte con:
📋 Información de servicios - Precios y tipos de declaraciones
📅 Citas - Agendar o consultar disponibilidad
📄 Documentos - Guiarte sobre qué documentos necesitas
💬 Preguntas - Responder dudas sobre impuestos
¿Qué te gustaría saber?"

CITAS:
"Para agendar una cita, puedes ir a la sección 'Citas' en la app y seleccionar la fecha y hora que te convenga. Nuestro horario es de Lunes a Viernes de 9:00 AM a 6:00 PM. ¿Te gustaría que te ayude con algo más?"

DOCUMENTOS:
"Para enviar documentos, ve a tu perfil y selecciona 'Herramientas'. Ahí encontrarás opciones para escanear tu ID, W2, 1099 y otros documentos con guías visuales que te ayudan a tomar la foto correcta. ¿Necesitas ayuda con algo específico?"

PRECIOS:
"Nuestros precios varían según el tipo de declaración. Una declaración simple empieza desde $75. Para cotizaciones más precisas, te recomiendo agendar una consulta gratuita. ¿Te gustaría más información?"

DEFAULT:
"Gracias por tu mensaje. Estoy aquí para ayudarte con cualquier pregunta sobre impuestos, citas o documentos. ¿Podrías darme más detalles sobre lo que necesitas?"
"""
    }
]


@router.get("/prompts", response_model=List[dict])
async def get_all_prompts():
    """Get all AI prompts"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    prompts = await db.ai_prompts.find({}).sort("created_at", -1).to_list(100)
    
    # If no prompts exist, seed with defaults
    if not prompts:
        await seed_default_prompts()
        prompts = await db.ai_prompts.find({}).sort("created_at", -1).to_list(100)
    
    return [{
        "id": str(p["_id"]),
        "name": p["name"],
        "key": p["key"],
        "description": p.get("description"),
        "content": p["content"],
        "is_active": p.get("is_active", True),
        "category": p.get("category", "general"),
        "created_at": p.get("created_at", datetime.now(timezone.utc)),
        "updated_at": p.get("updated_at", datetime.now(timezone.utc))
    } for p in prompts]


@router.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a specific prompt by ID"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        prompt = await db.ai_prompts.find_one({"_id": ObjectId(prompt_id)})
    except:
        prompt = await db.ai_prompts.find_one({"key": prompt_id})
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return {
        "id": str(prompt["_id"]),
        "name": prompt["name"],
        "key": prompt["key"],
        "description": prompt.get("description"),
        "content": prompt["content"],
        "is_active": prompt.get("is_active", True),
        "category": prompt.get("category", "general"),
        "created_at": prompt.get("created_at"),
        "updated_at": prompt.get("updated_at")
    }


@router.get("/prompts/key/{key}")
async def get_prompt_by_key(key: str):
    """Get a prompt by its unique key"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    prompt = await db.ai_prompts.find_one({"key": key, "is_active": True})
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return {
        "id": str(prompt["_id"]),
        "name": prompt["name"],
        "key": prompt["key"],
        "content": prompt["content"],
        "is_active": prompt.get("is_active", True),
        "category": prompt.get("category", "general")
    }


@router.post("/prompts")
async def create_prompt(prompt_data: PromptCreate):
    """Create a new prompt"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Check if key already exists
    existing = await db.ai_prompts.find_one({"key": prompt_data.key})
    if existing:
        raise HTTPException(status_code=400, detail="Prompt with this key already exists")
    
    now = datetime.now(timezone.utc)
    prompt_doc = {
        "name": prompt_data.name,
        "key": prompt_data.key,
        "description": prompt_data.description,
        "content": prompt_data.content,
        "is_active": prompt_data.is_active,
        "category": prompt_data.category,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.ai_prompts.insert_one(prompt_doc)
    
    return {
        "message": "Prompt created successfully",
        "id": str(result.inserted_id)
    }


@router.put("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, prompt_data: PromptUpdate):
    """Update an existing prompt"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if prompt_data.name is not None:
        update_data["name"] = prompt_data.name
    if prompt_data.description is not None:
        update_data["description"] = prompt_data.description
    if prompt_data.content is not None:
        update_data["content"] = prompt_data.content
    if prompt_data.is_active is not None:
        update_data["is_active"] = prompt_data.is_active
    if prompt_data.category is not None:
        update_data["category"] = prompt_data.category
    
    try:
        result = await db.ai_prompts.update_one(
            {"_id": ObjectId(prompt_id)},
            {"$set": update_data}
        )
    except:
        result = await db.ai_prompts.update_one(
            {"key": prompt_id},
            {"$set": update_data}
        )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Prompt not found or no changes made")
    
    return {"message": "Prompt updated successfully"}


@router.delete("/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str):
    """Delete a prompt"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        result = await db.ai_prompts.delete_one({"_id": ObjectId(prompt_id)})
    except:
        result = await db.ai_prompts.delete_one({"key": prompt_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return {"message": "Prompt deleted successfully"}


@router.post("/prompts/{prompt_id}/toggle")
async def toggle_prompt(prompt_id: str):
    """Toggle prompt active status"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        prompt = await db.ai_prompts.find_one({"_id": ObjectId(prompt_id)})
    except:
        prompt = await db.ai_prompts.find_one({"key": prompt_id})
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    new_status = not prompt.get("is_active", True)
    
    await db.ai_prompts.update_one(
        {"_id": prompt["_id"]},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": f"Prompt {'activated' if new_status else 'deactivated'}",
        "is_active": new_status
    }


@router.post("/prompts/seed")
async def seed_prompts():
    """Seed default prompts (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    count = await seed_default_prompts()
    return {"message": f"Seeded {count} default prompts"}


async def seed_default_prompts():
    """Helper function to seed default prompts"""
    count = 0
    now = datetime.now(timezone.utc)
    
    for prompt in DEFAULT_PROMPTS:
        existing = await db.ai_prompts.find_one({"key": prompt["key"]})
        if not existing:
            prompt["created_at"] = now
            prompt["updated_at"] = now
            await db.ai_prompts.insert_one(prompt)
            count += 1
    
    return count


# Function to get prompt content for AI Brain
async def get_prompt_content(key: str, default: str = "") -> str:
    """Get prompt content by key, with fallback to default"""
    if db is None:
        return default
    
    prompt = await db.ai_prompts.find_one({"key": key, "is_active": True})
    if prompt:
        return prompt["content"]
    return default
