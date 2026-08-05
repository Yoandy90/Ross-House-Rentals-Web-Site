"""
AI Learning Endpoints - Endpoints para el sistema de aprendizaje de Ross AI
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-learning", tags=["AI Learning"])

# Dependencies - set from server.py
rag_memory = None
ai_brain = None
bi_learner = None

def init_learning(rag_memory_instance, ai_brain_instance, bi_learner_instance=None):
    global rag_memory, ai_brain, bi_learner
    rag_memory = rag_memory_instance
    ai_brain = ai_brain_instance
    bi_learner = bi_learner_instance
    logger.info("✅ AI Learning endpoints initialized")


# ==================== MODELS ====================

class KnowledgeInput(BaseModel):
    title: str
    content: str
    category: str
    tags: Optional[List[str]] = []

class FeedbackInput(BaseModel):
    interaction_id: Optional[str] = ""
    query: str
    response: str
    rating: str  # "positive", "negative", "correction"
    correction: Optional[str] = None
    admin_notes: Optional[str] = None

class KnowledgeSearchInput(BaseModel):
    query: str
    category: Optional[str] = None
    limit: Optional[int] = 5

class TrainTestInput(BaseModel):
    message: str


# ==================== KNOWLEDGE BASE ====================

@router.post("/knowledge")
async def add_knowledge(data: KnowledgeInput):
    """Agrega conocimiento a la base de Ross AI"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    kb_id = await rag_memory.add_knowledge(
        title=data.title,
        content=data.content,
        category=data.category,
        source="admin",
        tags=data.tags
    )
    
    if not kb_id:
        raise HTTPException(status_code=500, detail="Error adding knowledge")
    
    return {"success": True, "id": kb_id, "message": f"Conocimiento '{data.title}' agregado exitosamente"}


@router.get("/knowledge")
async def get_knowledge(category: str = None):
    """Obtiene toda la base de conocimiento"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    items = await rag_memory.get_all_knowledge(category)
    
    # Get unique categories
    all_items = await rag_memory.get_all_knowledge()
    categories = list(set(i['category'] for i in all_items))
    
    return {
        "success": True,
        "items": items,
        "total": len(items),
        "categories": categories
    }


@router.delete("/knowledge/{kb_id}")
async def delete_knowledge(kb_id: str):
    """Elimina un item de la base de conocimiento"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    success = await rag_memory.delete_knowledge(kb_id)
    if not success:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    
    return {"success": True, "message": "Conocimiento eliminado"}


@router.post("/knowledge/search")
async def search_knowledge(data: KnowledgeSearchInput):
    """Busca en la base de conocimiento por similitud semántica"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    results = await rag_memory.search_knowledge(
        query=data.query,
        category=data.category,
        limit=data.limit
    )
    
    return {"success": True, "results": results, "total": len(results)}


@router.post("/knowledge/bulk")
async def bulk_add_knowledge(items: List[KnowledgeInput]):
    """Agrega múltiples items de conocimiento"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    added = 0
    for item in items:
        kb_id = await rag_memory.add_knowledge(
            title=item.title,
            content=item.content,
            category=item.category,
            source="admin_bulk",
            tags=item.tags
        )
        if kb_id:
            added += 1
    
    return {"success": True, "added": added, "total": len(items)}


# ==================== FEEDBACK ====================

@router.post("/feedback")
async def submit_feedback(data: FeedbackInput):
    """Registra feedback sobre una respuesta de Ross AI"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    fb_id = await rag_memory.record_feedback(
        interaction_id=data.interaction_id,
        query=data.query,
        response=data.response,
        rating=data.rating,
        correction=data.correction,
        admin_notes=data.admin_notes
    )
    
    if not fb_id:
        raise HTTPException(status_code=500, detail="Error recording feedback")
    
    return {"success": True, "feedback_id": fb_id, "message": f"Feedback '{data.rating}' registrado"}


@router.get("/feedback/stats")
async def get_feedback_stats():
    """Obtiene estadísticas de feedback"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    stats = await rag_memory.get_feedback_stats()
    return {"success": True, "stats": stats}


# ==================== INSIGHTS & MEMORY ====================

@router.get("/insights")
async def get_learning_insights():
    """Obtiene insights completos del sistema de aprendizaje"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    insights = await rag_memory.generate_insights()
    return {"success": True, "insights": insights}


@router.post("/memory/search")
async def search_memories(data: KnowledgeSearchInput):
    """Busca en las memorias de Ross AI"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    results = await rag_memory.search_similar_memories(
        query=data.query,
        limit=data.limit or 5
    )
    
    return {"success": True, "memories": results, "total": len(results)}


@router.get("/status")
async def get_learning_status():
    """Estado del sistema de aprendizaje"""
    if not rag_memory:
        return {
            "active": False,
            "message": "Learning system not initialized"
        }
    
    insights = await rag_memory.generate_insights()
    
    return {
        "active": True,
        "total_memories": insights.get('total_memories', 0),
        "total_knowledge": insights.get('total_knowledge_items', 0),
        "total_feedback": insights.get('total_feedback', 0),
        "total_learnings": insights.get('total_learnings', 0),
        "learning_success_rate": insights.get('learning_success_rate', 0),
        "satisfaction_rate": insights.get('feedback_satisfaction', 0)
    }


# ==================== TRAINING TEST ====================

@router.post("/test")
async def test_with_learning(data: TrainTestInput):
    """Prueba Ross AI con contexto de aprendizaje (muestra qué conocimiento usa)"""
    if not rag_memory or not ai_brain:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    # Get relevant context from memory
    context = await rag_memory.get_context_for_query(data.message)
    
    # Generate response using AI Brain with enriched context
    enriched_prompt = data.message
    if context:
        enriched_prompt = f"""Usa este conocimiento relevante para responder:

{context}

---
Pregunta del usuario: {data.message}

Responde de forma natural usando el conocimiento proporcionado si es relevante."""
    
    response = await ai_brain.chat(enriched_prompt)
    
    return {
        "success": True,
        "response": response,
        "context_used": context if context else "No se encontró contexto relevante",
        "has_context": bool(context)
    }


@router.post("/seed-business-knowledge")
async def seed_business_knowledge():
    """Carga conocimiento base del negocio Ross Tax automáticamente"""
    if not rag_memory:
        raise HTTPException(status_code=503, detail="Learning system not initialized")
    
    business_knowledge = [
        {
            "title": "Precio de Declaración Individual",
            "content": "La preparación de impuestos individuales (Form 1040) cuesta $180.00. Incluye revisión de documentos, preparación completa y e-file electrónico al IRS.",
            "category": "precios",
            "tags": ["precio", "individual", "1040"]
        },
        {
            "title": "Precio de Declaración de Negocio",
            "content": "La declaración de impuestos de negocio cuesta entre $300-$500 dependiendo de la complejidad. Incluye Schedule C, 1120, 1120-S, o 1065.",
            "category": "precios",
            "tags": ["precio", "negocio", "business"]
        },
        {
            "title": "Formación de LLC",
            "content": "Ross Tax ofrece servicio de formación de LLC con precios desde $349 (paquete básico) hasta $749 (paquete premium con EIN, Operating Agreement y compliance anual).",
            "category": "servicios",
            "tags": ["LLC", "formacion", "negocio"]
        },
        {
            "title": "Horario de Atención",
            "content": "Ross Tax Preparation está disponible de Lunes a Viernes de 10:00 AM a 2:30 PM EST. Se pueden agendar citas fuera de horario con previo aviso.",
            "category": "general",
            "tags": ["horario", "disponibilidad"]
        },
        {
            "title": "Contacto",
            "content": "Teléfono: (806) 934-2018. WhatsApp disponible. Email: info@rosstaxpreparation.com. Ubicación: Miami, FL.",
            "category": "general",
            "tags": ["contacto", "telefono", "email"]
        },
        {
            "title": "Documentos Necesarios para Tax Return",
            "content": "Los documentos necesarios incluyen: W-2 (empleo), 1099 (freelance/contratista), SSN o ITIN de todos los dependientes, comprobantes de gastos deducibles, 1095-A (seguro médico), y cualquier carta del IRS.",
            "category": "documentos",
            "tags": ["documentos", "requisitos", "W2", "1099"]
        },
        {
            "title": "ITIN Application",
            "content": "Ross Tax ofrece servicios de solicitud de ITIN (Individual Taxpayer Identification Number) para personas sin SSN. El costo es $75 adicional a la declaración. Se requiere pasaporte original o copia certificada.",
            "category": "servicios",
            "tags": ["ITIN", "documentos", "inmigración"]
        },
        {
            "title": "1099 Filing Service",
            "content": "Ofrecemos servicio de filing de 1099 para negocios. Precio: $15 por cada formulario 1099. Filing masivo disponible con descuento por volumen.",
            "category": "servicios",
            "tags": ["1099", "filing", "negocio"]
        },
        {
            "title": "Planes de Suscripción",
            "content": "Plan Básico: $19.99/mes (declaración individual, soporte básico). Plan Profesional: $49.99/mes (declaración individual + negocio, soporte prioritario, revisión trimestral). Todos los planes incluyen acceso a la app móvil.",
            "category": "precios",
            "tags": ["planes", "suscripción", "mensual"]
        },
        {
            "title": "Política de Reembolso",
            "content": "Si el cliente no está satisfecho con el servicio antes de la presentación al IRS, se ofrece reembolso completo. Después de la presentación, se puede ofrecer crédito para el próximo año fiscal.",
            "category": "politicas",
            "tags": ["reembolso", "garantía", "política"]
        },
        {
            "title": "Tax Season - Fechas Importantes",
            "content": "15 de enero: Inicio de temporada de impuestos. 15 de abril: Fecha límite de declaración. 15 de octubre: Fecha límite de extensión. Ross Tax recomienda presentar antes de marzo para recibir reembolso más rápido.",
            "category": "general",
            "tags": ["fechas", "temporada", "deadline"]
        },
        {
            "title": "Servicios de Inmigración",
            "content": "Ross Tax ofrece apoyo con documentación de inmigración relacionada con impuestos: ITIN, certificaciones fiscales para visas, y cartas de estado fiscal para ajuste de estatus.",
            "category": "servicios",
            "tags": ["inmigración", "visa", "ITIN"]
        }
    ]
    
    added = 0
    for item in business_knowledge:
        kb_id = await rag_memory.add_knowledge(
            title=item["title"],
            content=item["content"],
            category=item["category"],
            source="system_seed",
            tags=item["tags"]
        )
        if kb_id:
            added += 1
    
    return {
        "success": True,
        "added": added,
        "total": len(business_knowledge),
        "message": f"Se cargaron {added} items de conocimiento base del negocio"
    }



# ==================== BUSINESS INTELLIGENCE ====================

@router.post("/analyze-business")
async def analyze_business_data():
    """Analiza TODOS los datos del negocio (facturas, citas, clientes, emails) y genera conocimiento automático"""
    if not bi_learner:
        raise HTTPException(status_code=503, detail="Business Intelligence Learner not initialized")
    
    results = await bi_learner.analyze_all_and_learn()
    
    return {
        "success": True,
        "results": {
            "invoices": {
                "total": results.get("invoices", {}).get("total_invoices", 0),
                "revenue": results.get("invoices", {}).get("total_revenue", 0),
                "avg_invoice": results.get("invoices", {}).get("average_invoice", 0),
                "payment_methods": results.get("invoices", {}).get("payment_methods", {}),
                "top_services": results.get("invoices", {}).get("top_services", {}),
                "knowledge_generated": results.get("invoices", {}).get("knowledge_generated", 0)
            },
            "appointments": {
                "total": results.get("appointments", {}).get("total_appointments", 0),
                "busiest_days": results.get("appointments", {}).get("busiest_days", {}),
                "busiest_hours": results.get("appointments", {}).get("busiest_hours", {}),
                "knowledge_generated": results.get("appointments", {}).get("knowledge_generated", 0)
            },
            "clients": {
                "total": results.get("clients", {}).get("total_clients", 0),
                "season_2024": results.get("clients", {}).get("season_2024", {}),
                "season_2025": results.get("clients", {}).get("season_2025_current", {}),
                "retention_rate": results.get("clients", {}).get("retention_rate", 0),
                "returning_clients": results.get("clients", {}).get("returning_clients", 0),
                "top_states": results.get("clients", {}).get("top_states", {}),
                "monthly_filings_2025": results.get("clients", {}).get("monthly_filings_2025", {}),
                "knowledge_generated": results.get("clients", {}).get("knowledge_generated", 0)
            },
            "emails": {
                "total": results.get("emails", {}).get("total_emails", 0),
                "knowledge_generated": results.get("emails", {}).get("knowledge_generated", 0)
            }
        },
        "summary": results.get("summary", ""),
        "message": "Análisis de negocio completado. Conocimiento generado y almacenado."
    }


@router.get("/analyze-business/invoices")
async def analyze_invoices():
    """Analiza solo las facturas"""
    if not bi_learner:
        raise HTTPException(status_code=503, detail="Business Intelligence Learner not initialized")
    result = await bi_learner.analyze_invoices()
    return {"success": True, "data": result}


@router.get("/analyze-business/appointments")
async def analyze_appointments():
    """Analiza solo las citas"""
    if not bi_learner:
        raise HTTPException(status_code=503, detail="Business Intelligence Learner not initialized")
    result = await bi_learner.analyze_appointments()
    return {"success": True, "data": result}


@router.get("/analyze-business/clients")
async def analyze_clients():
    """Analiza solo los clientes"""
    if not bi_learner:
        raise HTTPException(status_code=503, detail="Business Intelligence Learner not initialized")
    result = await bi_learner.analyze_clients()
    return {"success": True, "data": result}


@router.get("/analyze-business/emails")
async def analyze_emails():
    """Analiza solo los emails"""
    if not bi_learner:
        raise HTTPException(status_code=503, detail="Business Intelligence Learner not initialized")
    result = await bi_learner.analyze_emails()
    return {"success": True, "data": result}
