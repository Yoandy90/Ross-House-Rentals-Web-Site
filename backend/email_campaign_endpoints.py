"""
Email Campaign Endpoints
API endpoints para gestión de campañas de email
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Modelos Pydantic
class CampaignCreate(BaseModel):
    name: str
    subject: str
    from_name: str
    from_email: EmailStr
    html_content: str
    audience_filter: Optional[Dict[str, Any]] = {}
    scheduled_at: Optional[datetime] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    from_name: Optional[str] = None
    from_email: Optional[EmailStr] = None
    html_content: Optional[str] = None
    audience_filter: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None

class TemplateCreate(BaseModel):
    name: str
    description: str
    html_content: str
    category: str = 'general'
    variables: Optional[List[str]] = None


# Dependencias (se inyectarán desde server.py)
email_campaign_service = None

def set_campaign_service(service):
    global email_campaign_service
    email_campaign_service = service


@router.post('/admin/campaigns/create')
async def create_campaign(campaign: CampaignCreate, current_user: dict = None):
    """Crea una nueva campaña de email"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        result = await email_campaign_service.create_campaign(
            name=campaign.name,
            subject=campaign.subject,
            from_name=campaign.from_name,
            from_email=campaign.from_email,
            html_content=campaign.html_content,
            audience_filter=campaign.audience_filter,
            scheduled_at=campaign.scheduled_at,
            created_by=str(current_user.get('_id')) if current_user else None
        )
        
        return {
            "success": True,
            "campaign_id": result['_id'],
            "message": "Campaign created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/campaigns/list')
async def list_campaigns(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Lista todas las campañas"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        campaigns = await email_campaign_service.list_campaigns(status, limit, skip)
        return {
            "success": True,
            "campaigns": campaigns,
            "count": len(campaigns)
        }
    except Exception as e:
        logger.error(f"Error listing campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/campaigns/{campaign_id}')
async def get_campaign(campaign_id: str):
    """Obtiene detalles de una campaña"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        campaign = await email_campaign_service.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "success": True,
            "campaign": campaign
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/admin/campaigns/{campaign_id}')
async def update_campaign(campaign_id: str, updates: CampaignUpdate):
    """Actualiza una campaña"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        
        success = await email_campaign_service.update_campaign(campaign_id, update_dict)
        
        if not success:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "success": True,
            "message": "Campaign updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/campaigns/{campaign_id}/schedule')
async def schedule_campaign(campaign_id: str, scheduled_at: datetime):
    """Programa una campaña para envío futuro"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        success = await email_campaign_service.schedule_campaign(campaign_id, scheduled_at)
        
        if not success:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "success": True,
            "message": f"Campaign scheduled for {scheduled_at}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/campaigns/{campaign_id}/send')
async def send_campaign(campaign_id: str):
    """Envía una campaña inmediatamente"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        result = await email_campaign_service.send_campaign(campaign_id)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Unknown error'))
        
        return {
            "success": True,
            "message": "Campaign sent successfully",
            "stats": {
                "sent": result['sent'],
                "failed": result['failed'],
                "total": result['total']
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/campaigns/{campaign_id}/cancel')
async def cancel_campaign(campaign_id: str):
    """Cancela una campaña programada"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        success = await email_campaign_service.cancel_campaign(campaign_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Campaign not found or not scheduled")
        
        return {
            "success": True,
            "message": "Campaign cancelled successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/campaigns/{campaign_id}/stats')
async def get_campaign_stats(campaign_id: str):
    """Obtiene estadísticas detalladas de una campaña"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        stats = await email_campaign_service.get_campaign_stats(campaign_id)
        
        if not stats:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "success": True,
            "stats": stats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting campaign stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/campaigns/{campaign_id}/duplicate')
async def duplicate_campaign(campaign_id: str):
    """Duplica una campaña existente"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        new_campaign_id = await email_campaign_service.duplicate_campaign(campaign_id)
        
        if not new_campaign_id:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        return {
            "success": True,
            "new_campaign_id": new_campaign_id,
            "message": "Campaign duplicated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error duplicating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/campaigns/{campaign_id}/preview')
async def get_audience_preview(campaign_id: str):
    """Obtiene una preview de la audiencia"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        campaign = await email_campaign_service.get_campaign(campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        audience = await email_campaign_service.get_audience(campaign['audience_filter'])
        
        # Retornar solo los primeros 50 para preview
        preview = [
            {
                'name': user.get('name', 'N/A'),
                'email': user.get('email'),
                'created_at': user.get('created_at')
            }
            for user in audience[:50]
        ]
        
        return {
            "success": True,
            "total_recipients": len(audience),
            "preview": preview,
            "preview_count": len(preview)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audience preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ENDPOINTS DE PLANTILLAS

@router.post('/admin/templates/create')
async def create_template(template: TemplateCreate):
    """Crea una nueva plantilla de email"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        template_id = await email_campaign_service.create_template(
            name=template.name,
            description=template.description,
            html_content=template.html_content,
            category=template.category,
            variables=template.variables
        )
        
        return {
            "success": True,
            "template_id": template_id,
            "message": "Template created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/templates/list')
async def list_templates(category: Optional[str] = None):
    """Lista todas las plantillas"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        templates = await email_campaign_service.list_templates(category)
        
        return {
            "success": True,
            "templates": templates,
            "count": len(templates)
        }
    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/templates/{template_id}')
async def get_template(template_id: str):
    """Obtiene una plantilla por ID"""
    if not email_campaign_service:
        raise HTTPException(status_code=503, detail="Campaign service not initialized")
    
    try:
        template = await email_campaign_service.get_template(template_id)
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "success": True,
            "template": template
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))
