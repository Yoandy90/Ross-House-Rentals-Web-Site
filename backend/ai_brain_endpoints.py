"""
AI Brain API Endpoints
Endpoints para interactuar con el Cerebro de IA
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from ai_brain_service import RossAIBrain
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ross-tax-secret-key-2025-change-in-production")
ALGORITHM = "HS256"

# Import database connection
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Get database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'taxportal')]

# Simple auth function for AI Brain endpoints
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from session token (database lookup)"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🔐 AI Brain Auth - Authorization header: {authorization[:50] if authorization else 'None'}...")
    
    if not authorization:
        logger.error("❌ No authorization header")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Handle Bearer token
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    logger.info(f"🔑 Token extracted (preview): {token[:30]}...")
    
    # Find session in database
    session = await db.user_sessions.find_one({'session_token': token})
    logger.info(f"📦 Session found: {session is not None}")
    
    if not session:
        # Debug: show recent sessions
        recent_sessions = await db.user_sessions.find().sort('_id', -1).limit(3).to_list(3)
        logger.error(f"❌ Session not found. Recent sessions count: {len(recent_sessions)}")
        if recent_sessions:
            for s in recent_sessions:
                logger.info(f"  - Session token preview: {s.get('session_token', '')[:30]}... for user {s.get('user_id')}")
        raise HTTPException(status_code=401, detail="Invalid session token")
    
    # Get user from database to get role
    user_id = session['user_id']
    logger.info(f"👤 User ID from session: {user_id}")
    
    from bson import ObjectId
    # Try both string (UUID) and ObjectId formats
    user = None
    # First try as string (UUID format)
    user = await db.users.find_one({'_id': user_id})
    # If not found, try as ObjectId
    if not user:
        try:
            user = await db.users.find_one({'_id': ObjectId(user_id)})
        except:
            pass
    logger.info(f"👤 User found: {user is not None}")
    
    if not user:
        logger.error(f"❌ User not found for ID: {user_id}")
        raise HTTPException(status_code=401, detail="User not found")
    
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.get('_id', user_id))
    logger.info(f"✅ User authenticated: {user_dict.get('email')} (role: {user_dict.get('role')})")
    return user_dict

router = APIRouter(prefix="/ai-brain", tags=["AI Brain"])

# Pydantic models
class CommandRequest(BaseModel):
    command: str

class ChatMessage(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None

class ActionExecutionRequest(BaseModel):
    action_name: str
    params: Dict[str, Any] = {}

# Singleton AI Brain instance (será inicializado en server.py)
ai_brain: Optional[RossAIBrain] = None

def get_ai_brain():
    if ai_brain is None:
        raise HTTPException(status_code=500, detail="AI Brain not initialized")
    return ai_brain

@router.post("/command")
async def execute_command(
    request: CommandRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ejecuta un comando de texto que el Cerebro IA procesará y ejecutará
    
    Ejemplos de comandos:
    - "Analiza todos los clientes inactivos"
    - "Envía recordatorio a clientes con citas mañana"
    - "Muéstrame las métricas del negocio"
    - "Identifica oportunidades de venta"
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🎯 === AI BRAIN ENDPOINT CALLED ===")
    logger.info(f"👤 User: {current_user.get('id')} ({current_user.get('role')})")
    logger.info(f"📝 Command: {request.command}")
    
    # Solo admins pueden usar el AI Brain
    if current_user.get("role") != "admin":
        logger.error(f"❌ Access denied - not admin")
        raise HTTPException(status_code=403, detail="Only admins can use AI Brain")
    
    brain = get_ai_brain()
    logger.info(f"✅ AI Brain instance obtained")
    
    try:
        logger.info(f"🚀 Calling brain.process_command...")
        result = await brain.process_command(
            command=request.command,
            user_id=current_user.get("id")
        )
        logger.info(f"✅ Command processed successfully")
        logger.info(f"📦 Result: {result}")
        return result
    except Exception as e:
        print(f"Error executing command: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_with_ai(
    request: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    """
    Modo conversacional con la IA - como chatear contigo
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can chat with AI Brain")
    
    brain = get_ai_brain()
    
    try:
        response = await brain.chat(
            message=request.message,
            conversation_history=request.conversation_history or []
        )
        return {
            "response": response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/action/execute")
async def execute_action(
    request: ActionExecutionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ejecuta una acción específica directamente
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can execute actions")
    
    brain = get_ai_brain()
    
    try:
        result = await brain._execute_action({
            "name": request.action_name,
            "params": request.params
        })
        return {
            "action": request.action_name,
            "status": "success",
            "result": result
        }
    except Exception as e:
        print(f"Error executing action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/actions/available")
async def get_available_actions(
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene la lista de todas las acciones/herramientas disponibles
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    actions = []
    for name, func in brain.tools.items():
        actions.append({
            "name": name,
            "description": func.__doc__ or "No description available"
        })
    
    return {"actions": actions}

@router.get("/history")
async def get_action_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene el historial de acciones ejecutadas por la IA
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    try:
        history = await brain.get_action_history(limit=limit)
        return {"history": history, "count": len(history)}
    except Exception as e:
        print(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics/business")
async def get_business_metrics(
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene métricas clave del negocio
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    try:
        metrics = await brain.get_business_metrics()
        return metrics
    except Exception as e:
        print(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/clients")
async def analyze_all_clients(
    current_user: dict = Depends(get_current_user)
):
    """
    Análisis general de todos los clientes
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    try:
        analysis = await brain.analyze_clients()
        return analysis
    except Exception as e:
        print(f"Error analyzing clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/inactive-clients")
async def get_inactive_clients(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """
    Identifica clientes inactivos
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    try:
        result = await brain.analyze_inactive_clients(days=days)
        return result
    except Exception as e:
        print(f"Error analyzing inactive clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/payment-opportunities")
async def get_payment_opportunities(
    current_user: dict = Depends(get_current_user)
):
    """
    Detecta oportunidades de pago y upsell
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    brain = get_ai_brain()
    
    try:
        result = await brain.detect_payment_opportunities()
        return result
    except Exception as e:
        print(f"Error detecting opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """
    Verifica que el AI Brain esté funcionando
    """
    brain = get_ai_brain()
    return {
        "status": "healthy",
        "ai_brain_active": True,
        "available_tools": len(brain.tools),
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================
# NUEVOS ENDPOINTS - EMAIL TRACKING & AUTOMATION
# ============================================

@router.get("/automation/dashboard")
async def get_automation_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """
    Dashboard de automatización - Tracking de emails y decisiones de IA
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        # Importar el servicio de automatización
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service:
            return {
                "success": True,
                "message": "Automation service not initialized yet",
                "stats": {
                    "total_emails_tracked": 0,
                    "emails_opened": 0,
                    "open_rate": 0,
                    "total_ai_decisions": 0,
                    "decisions_executed": 0,
                    "automation_rate": 0
                }
            }
        
        # Estadísticas de tracking
        total_emails_tracked = await ai_automation_service.email_tracking_collection.count_documents({})
        emails_opened = await ai_automation_service.email_tracking_collection.count_documents({"opened": True})
        
        # Decisiones de IA
        total_decisions = await ai_automation_service.ai_decisions_collection.count_documents({})
        decisions_executed = await ai_automation_service.ai_decisions_collection.count_documents({"executed": True})
        
        # Calcular tasas
        open_rate = (emails_opened / total_emails_tracked * 100) if total_emails_tracked > 0 else 0
        automation_rate = (decisions_executed / total_decisions * 100) if total_decisions > 0 else 0
        
        # Decisiones recientes
        recent_decisions = await ai_automation_service.ai_decisions_collection.find().sort(
            'decided_at', -1
        ).limit(10).to_list(10)
        
        # Formatear decisiones
        formatted_decisions = []
        for decision in recent_decisions:
            formatted_decisions.append({
                "id": str(decision['_id']),
                "user_email": decision.get('email', 'Desconocido'),
                "trigger": decision.get('trigger', 'unknown'),
                "action": decision.get('ai_decision', {}).get('action', 'unknown'),
                "channel": decision.get('ai_decision', {}).get('channel', 'email'),
                "executed": decision.get('executed', False),
                "decided_at": decision.get('decided_at').isoformat() if decision.get('decided_at') else None,
                "reasoning": decision.get('ai_decision', {}).get('reasoning', '')[:100] + "..." if len(decision.get('ai_decision', {}).get('reasoning', '')) > 100 else decision.get('ai_decision', {}).get('reasoning', '')
            })
        
        return {
            "success": True,
            "stats": {
                "total_emails_tracked": total_emails_tracked,
                "emails_opened": emails_opened,
                "open_rate": round(open_rate, 1),
                "total_ai_decisions": total_decisions,
                "decisions_executed": decisions_executed,
                "automation_rate": round(automation_rate, 1)
            },
            "recent_decisions": formatted_decisions
        }
    except Exception as e:
        print(f"Error getting automation dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automation/email-stats")
async def get_email_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Estadísticas detalladas de emails
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service:
            return {
                "success": False,
                "error": "Automation service not initialized"
            }
        
        # Stats por tipo de email
        email_type_stats = await ai_automation_service.email_tracking_collection.aggregate([
            {
                "$group": {
                    "_id": "$email_type",
                    "total": {"$sum": 1},
                    "opened": {
                        "$sum": {"$cond": [{"$eq": ["$opened", True]}, 1, 0]}
                    },
                    "avg_open_count": {"$avg": "$open_count"}
                }
            }
        ]).to_list(100)
        
        # Formatear
        formatted_stats = []
        for stat in email_type_stats:
            total = stat['total']
            opened = stat['opened']
            open_rate = (opened / total * 100) if total > 0 else 0
            
            formatted_stats.append({
                "email_type": stat['_id'] or "unknown",
                "total_sent": total,
                "total_opened": opened,
                "open_rate": round(open_rate, 1),
                "avg_opens_per_email": round(stat.get('avg_open_count', 0), 1)
            })
        
        return {
            "success": True,
            "stats_by_type": formatted_stats
        }
    except Exception as e:
        print(f"Error getting email stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automation/user-insights/{user_id}")
async def get_user_automation_insights(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Insights de automatización para un usuario específico
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service:
            return {
                "success": False,
                "error": "Automation service not initialized"
            }
        
        insights = await ai_automation_service.get_user_insights(user_id)
        
        return {
            "success": True,
            "insights": insights
        }
    except Exception as e:
        print(f"Error getting user insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# LEARNING & ANALYSIS ENDPOINTS
# ============================================

@router.post("/learning/analyze-clients")
async def analyze_all_clients_data(
    current_user: dict = Depends(get_current_user)
):
    """Ejecuta análisis completo de todos los clientes (500+)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.data_analyzer:
            return {
                "success": False,
                "error": "Data analyzer not initialized"
            }
        
        # Ejecutar análisis completo
        analysis = await ai_automation_service.data_analyzer.analyze_all_clients()
        
        return {
            "success": True,
            "analysis": analysis
        }
    except Exception as e:
        print(f"Error analyzing clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learning/generate-training-data")
async def generate_training_data(
    current_user: dict = Depends(get_current_user)
):
    """Genera datos de entrenamiento para Fine-Tuning"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.data_analyzer:
            return {
                "success": False,
                "error": "Data analyzer not initialized"
            }
        
        # Generar datos de entrenamiento
        training_data = await ai_automation_service.data_analyzer.generate_training_data()
        
        return {
            "success": True,
            "training_examples": len(training_data),
            "message": f"Generated {len(training_data)} training examples"
        }
    except Exception as e:
        print(f"Error generating training data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/learning/memory-insights")
async def get_memory_insights(
    current_user: dict = Depends(get_current_user)
):
    """Obtiene insights de lo que la IA ha aprendido"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.rag_memory:
            return {
                "success": False,
                "error": "RAG Memory not initialized"
            }
        
        # Obtener insights
        insights = await ai_automation_service.rag_memory.generate_insights()
        
        return {
            "success": True,
            "insights": insights
        }
    except Exception as e:
        print(f"Error getting insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learning/remember-success")
async def remember_successful_strategy(
    strategy_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Registra una estrategia exitosa para que la IA la aprenda"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.rag_memory:
            return {
                "success": False,
                "error": "RAG Memory not initialized"
            }
        
        # Guardar estrategia exitosa
        memory_id = await ai_automation_service.rag_memory.remember_successful_strategy(
            strategy_type=strategy_data.get('type', 'general'),
            description=strategy_data.get('description', ''),
            results=strategy_data.get('results', {})
        )
        
        return {
            "success": True,
            "memory_id": memory_id,
            "message": "Strategy learned successfully"
        }
    except Exception as e:
        print(f"Error remembering strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/learning/client-context/{client_id}")
async def get_client_learning_context(
    client_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene todo el contexto aprendido sobre un cliente específico"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.rag_memory:
            return {
                "success": False,
                "error": "RAG Memory not initialized"
            }
        
        # Obtener contexto del cliente
        context = await ai_automation_service.rag_memory.get_client_context(
            client_id=client_id,
            limit=20
        )
        
        return {
            "success": True,
            "client_id": client_id,
            "context": context,
            "total_memories": len(context)
        }
    except Exception as e:
        print(f"Error getting client context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/learning/search-similar")
async def search_similar_situations(
    search_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Busca situaciones similares en la memoria de la IA"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    try:
        from ai_automation_service import ai_automation_service
        
        if not ai_automation_service or not ai_automation_service.rag_memory:
            return {
                "success": False,
                "error": "RAG Memory not initialized"
            }
        
        # Buscar memorias similares
        similar = await ai_automation_service.rag_memory.search_similar_memories(
            query=search_data.get('query', ''),
            memory_type=search_data.get('type'),
            limit=search_data.get('limit', 5),
            min_similarity=search_data.get('min_similarity', 0.7)
        )
        
        return {
            "success": True,
            "query": search_data.get('query'),
            "similar_memories": similar,
            "total_found": len(similar)
        }
    except Exception as e:
        print(f"Error searching similar situations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        print(f"Error getting user insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))

