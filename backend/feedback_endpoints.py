"""
Feedback Endpoints - API endpoints para sistema de feedback
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from feedback_models import FeedbackSubmit, FeedbackResponse, FeedbackStats
import logging

logger = logging.getLogger(__name__)

def init_feedback_endpoints(app, router, feedback_service, get_current_user, require_admin):
    """Inicializa endpoints de feedback"""
    
    # ==================== PUBLIC ENDPOINTS (No Auth) ====================
    
    @app.get('/api/feedback/{token}')
    async def get_feedback_request(token: str):
        """Obtiene información de solicitud de feedback (público)"""
        request_data = await feedback_service.get_feedback_request(token)
        
        if not request_data:
            raise HTTPException(status_code=404, detail="Solicitud de feedback no encontrada")
        
        return request_data
    
    @app.post('/api/feedback/{token}/submit')
    async def submit_feedback(
        token: str,
        feedback: FeedbackSubmit
    ):
        """Envía feedback (público - sin autenticación)"""
        result = await feedback_service.submit_feedback(
            token=token,
            rating=feedback.rating,
            comment=feedback.comment,
            publish_to_google=feedback.publish_to_google,
            allow_use_name=feedback.allow_use_name
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    # ==================== ADMIN ENDPOINTS ====================
    
    @app.get('/api/admin/feedback')
    async def get_all_feedback(
        status: Optional[str] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        current_user: dict = Depends(require_admin)
    ):
        """Obtiene todo el feedback (admin)"""
        feedback_list = await feedback_service.get_all_feedback(status=status, limit=limit)
        return {'feedback': feedback_list, 'total': len(feedback_list)}
    
    @app.get('/api/admin/feedback/stats', response_model=FeedbackStats)
    async def get_feedback_stats(
        current_user: dict = Depends(require_admin)
    ):
        """Obtiene estadísticas de feedback (admin)"""
        stats = await feedback_service.get_feedback_stats()
        return stats
    
    @app.put('/api/admin/feedback/{feedback_id}/status')
    async def update_feedback_status(
        feedback_id: str,
        status: str,
        admin_response: Optional[str] = None,
        current_user: dict = Depends(require_admin)
    ):
        """Actualiza status de un feedback (admin)"""
        from bson import ObjectId
        
        update_doc = {'status': status}
        if admin_response:
            update_doc['admin_response'] = admin_response
        
        result = await feedback_service.feedback_responses_collection.update_one(
            {'_id': ObjectId(feedback_id)},
            {'$set': update_doc}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Feedback no encontrado")
        
        return {'success': True, 'message': 'Status actualizado'}
    
    @app.post('/api/admin/appointments/{appointment_id}/send-feedback')
    async def send_feedback_request_endpoint(
        appointment_id: str,
        current_user: dict = Depends(require_admin)
    ):
        """Envía solicitud de feedback cuando admin marca cita como completada"""
        result = await feedback_service.send_feedback_request(appointment_id)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    logger.info("✅ Feedback endpoints initialized")
