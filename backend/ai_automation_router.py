"""
AI Automation Endpoints (Router version for lending_server.py)
Email Tracking & AI Insights - Compatible with both server.py and lending_server.py
"""
import logging
from fastapi import APIRouter, Response
from typing import Optional
import io

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level references (set during init)
_ai_service = None


def init_ai_automation_router(ai_service):
    """Initialize with AI Automation Service instance"""
    global _ai_service
    _ai_service = ai_service
    logger.info("✅ AI Automation Router initialized")


@router.get("/track/email/{tracking_id}")
async def track_email_open(tracking_id: str):
    """
    Pixel de tracking transparente 1x1 para detectar apertura de emails
    Se inserta como <img src="/api/track/email/{tracking_id}">
    """
    try:
        if _ai_service:
            await _ai_service.track_email_opened(tracking_id)
        
        # Also update the email_tracking collection directly
        try:
            from lending_server import db as lending_db
            if lending_db:
                from datetime import datetime
                await lending_db.email_tracking.update_one(
                    {'tracking_id': tracking_id},
                    {'$set': {'opened': True, 'opened_at': datetime.utcnow()}, '$inc': {'open_count': 1}}
                )
        except:
            pass
        
        # Generate 1x1 transparent PNG pixel (minimal bytes, no PIL dependency)
        pixel = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
            b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
            b'\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        
        return Response(
            content=pixel,
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    except Exception as e:
        logger.error(f"Error tracking email open: {e}")
        pixel = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
            b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
            b'\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        return Response(content=pixel, media_type="image/png")


@router.get("/track/click/{tracking_id}")
async def track_email_click(tracking_id: str, url: str):
    """
    Redirect tracker para links en emails
    Registra el clic y redirige al destino
    """
    try:
        if _ai_service:
            await _ai_service.track_email_click(tracking_id, url)
        
        return Response(
            status_code=307,
            headers={"Location": url}
        )
    except Exception as e:
        logger.error(f"Error tracking click: {e}")
        return Response(status_code=307, headers={"Location": url})


@router.get("/ai/insights/{user_id}")
async def get_user_ai_insights(user_id: str):
    """Obtiene insights de IA sobre un usuario"""
    try:
        if not _ai_service:
            return {"success": False, "error": "AI Automation not initialized"}
        insights = await _ai_service.get_user_insights(user_id)
        return {"success": True, "insights": insights}
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        return {"success": False, "error": str(e)}


@router.get("/ai/dashboard")
async def get_ai_dashboard():
    """Dashboard de IA - Métricas generales del sistema"""
    try:
        if not _ai_service:
            return {"success": False, "error": "AI Automation not initialized"}
        
        total_emails_tracked = await _ai_service.email_tracking_collection.count_documents({})
        emails_opened = await _ai_service.email_tracking_collection.count_documents({"opened": True})
        
        total_decisions = await _ai_service.ai_decisions_collection.count_documents({})
        decisions_executed = await _ai_service.ai_decisions_collection.count_documents({"executed": True})
        
        open_rate = (emails_opened / total_emails_tracked * 100) if total_emails_tracked > 0 else 0
        
        recent_decisions = await _ai_service.ai_decisions_collection.find().sort(
            'decided_at', -1
        ).limit(10).to_list(10)
        
        # Serialize ObjectIds
        for d in recent_decisions:
            d['_id'] = str(d['_id'])
        
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
        return {"success": False, "error": str(e)}


logger.info("✅ AI Automation Router module loaded")
