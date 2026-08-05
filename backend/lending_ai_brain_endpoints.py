"""
Lending AI Brain Endpoints
API endpoints exclusivos para el AI Brain de Ross Lending Solutions
"""
import logging
from fastapi import APIRouter, Header
from typing import Optional, Dict, List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level reference
lending_ai_brain = None


def init_lending_ai_brain(brain_instance):
    """Initialize with LendingAIBrain instance"""
    global lending_ai_brain
    lending_ai_brain = brain_instance
    logger.info("✅ Lending AI Brain endpoints initialized")


# ── Models ──

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict]] = None

class RiskScoreRequest(BaseModel):
    user_id: str


# ── Endpoints ──

@router.get("/lending-brain/status")
async def get_brain_status():
    """Estado del AI Brain de Ross Lending"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.get_status()


@router.get("/lending-brain/portfolio")
async def get_portfolio():
    """Resumen de la cartera de préstamos"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.get_portfolio_summary()


@router.get("/lending-brain/performance")
async def get_performance():
    """Rendimiento por tipo de préstamo"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.analyze_loan_performance()


@router.post("/lending-brain/risk-score")
async def calculate_risk(request: RiskScoreRequest):
    """Calcula risk score de un usuario"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.calculate_risk_score(request.user_id)


@router.get("/lending-brain/delinquent")
async def get_delinquent():
    """Préstamos morosos con estrategias de cobro"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.get_delinquent_loans()


@router.get("/lending-brain/predict-defaults")
async def predict_defaults():
    """Predicción de defaults"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.predict_defaults()


@router.get("/lending-brain/compliance")
async def get_compliance():
    """Estado de compliance OCCC"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.check_compliance_status()


@router.get("/lending-brain/revenue")
async def get_revenue(period: str = "month"):
    """Métricas de ingresos"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.get_revenue_metrics(period)


@router.get("/lending-brain/clients")
async def get_client_metrics():
    """Métricas de clientes"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.get_client_metrics()


@router.post("/lending-brain/chat")
async def chat_with_brain(request: ChatRequest):
    """Chat conversacional con el AI Brain"""
    if not lending_ai_brain:
        return {"success": False, "response": "AI Brain not initialized"}
    return await lending_ai_brain.chat(request.message, request.conversation_history)


@router.post("/lending-brain/send-reminders")
async def send_reminders():
    """Enviar recordatorios de pago inteligentes"""
    if not lending_ai_brain:
        return {"success": False, "error": "AI Brain not initialized"}
    return await lending_ai_brain.send_payment_reminders()


logger.info("✅ Lending AI Brain endpoints module loaded")
