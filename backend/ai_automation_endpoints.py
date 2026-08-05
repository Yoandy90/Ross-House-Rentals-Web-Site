"""
AI Automation Endpoints - Email Tracking & AI Insights
"""
import logging
from fastapi import Response
from PIL import Image
import io
from server import app, db
from ai_automation_service import init_ai_automation_service
from notification_service_v2 import notification_service_v2
from whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)

# Inicializar AI Automation Service
ai_service = init_ai_automation_service(db, notification_service_v2, whatsapp_service)

@app.get("/api/track/email/{tracking_id}")
async def track_email_open(tracking_id: str):
    """
    Pixel de tracking transparente 1x1 para detectar apertura de emails
    Se inserta como <img src="/api/track/email/{tracking_id}">
    """
    try:
        # Registrar apertura del email
        await ai_service.track_email_opened(tracking_id)
        
        # Generar pixel transparente 1x1
        img = Image.new('RGBA', (1, 1), (255, 255, 255, 0))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return Response(
            content=img_byte_arr.getvalue(),
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    except Exception as e:
        logger.error(f"Error tracking email open: {e}")
        # Retornar pixel transparente aunque falle
        img = Image.new('RGBA', (1, 1), (255, 255, 255, 0))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        return Response(content=img_byte_arr.getvalue(), media_type="image/png")

@app.get("/api/track/click/{tracking_id}")
async def track_email_click(tracking_id: str, url: str):
    """
    Redirect tracker para links en emails
    Registra el clic y redirige al destino
    """
    try:
        # Registrar clic
        await ai_service.track_email_click(tracking_id, url)
        
        # Redirigir a la URL destino
        return Response(
            status_code=307,
            headers={"Location": url}
        )
    except Exception as e:
        logger.error(f"Error tracking click: {e}")
        # Redirigir aunque falle el tracking
        return Response(status_code=307, headers={"Location": url})

@app.get("/api/ai/insights/{user_id}")
async def get_user_ai_insights(user_id: str):
    """
    Obtiene insights de IA sobre un usuario
    Muestra:
    - Historial de engagement
    - Decisiones tomadas por la IA
    - Recomendaciones personalizadas
    """
    try:
        insights = await ai_service.get_user_insights(user_id)
        return {
            "success": True,
            "insights": insights
        }
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/ai/dashboard")
async def get_ai_dashboard():
    """
    Dashboard de IA - Métricas generales del sistema
    """
    try:
        # Estadísticas de tracking
        total_emails_tracked = await ai_service.email_tracking_collection.count_documents({})
        emails_opened = await ai_service.email_tracking_collection.count_documents({"opened": True})
        
        # Decisiones de IA
        total_decisions = await ai_service.ai_decisions_collection.count_documents({})
        decisions_executed = await ai_service.ai_decisions_collection.count_documents({"executed": True})
        
        # Calcular tasa de apertura
        open_rate = (emails_opened / total_emails_tracked * 100) if total_emails_tracked > 0 else 0
        
        # Obtener decisiones recientes
        recent_decisions = await ai_service.ai_decisions_collection.find().sort(
            'decided_at', -1
        ).limit(10).to_list(10)
        
        return {
            "success": True,
            "stats": {
                "total_emails_tracked": total_emails_tracked,
                "emails_opened": emails_opened,
                "open_rate": f"{open_rate:.1f}%",
                "total_ai_decisions": total_decisions,
                "decisions_executed": decisions_executed,
                "automation_rate": f"{(decisions_executed / total_decisions * 100) if total_decisions > 0 else 0:.1f}%"
            },
            "recent_decisions": recent_decisions
        }
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}")
        return {
            "success": False,
            "error": str(e)
        }

logger.info("✅ AI Automation endpoints initialized")
