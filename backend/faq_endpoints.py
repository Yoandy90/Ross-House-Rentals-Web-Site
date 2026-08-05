"""
FAQ API Endpoints
Endpoints para gestión de Preguntas Frecuentes
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from faq_models import (
    FAQ, FAQCategory, FAQCreateRequest, FAQUpdateRequest,
    FAQCategoryCreateRequest, FAQCategoryUpdateRequest,
    FAQSearchRequest, FAQFeedbackRequest
)
from faq_service import FAQService

router = APIRouter(prefix="/faqs", tags=["FAQs"])

# Variables globales (serán inicializadas desde server.py)
faq_service: Optional[FAQService] = None
get_current_user_func = None
require_admin_func = None

def init_faq_endpoints(db, get_current_user, require_admin):
    """Inicializa el servicio y las funciones de autenticación"""
    global faq_service, get_current_user_func, require_admin_func
    faq_service = FAQService(db)
    get_current_user_func = get_current_user
    require_admin_func = require_admin
    return router

# ==================== ENDPOINTS PÚBLICOS (Clientes) ====================

@router.get("/categories", response_model=List[dict])
async def get_categories_public():
    """Obtiene todas las categorías activas (público)"""
    try:
        categories = await faq_service.get_categories(active_only=True)
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/category/{category_id}", response_model=dict)
async def get_category_public(category_id: str):
    """Obtiene una categoría por ID (público)"""
    try:
        category = await faq_service.get_category(category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        return category
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[dict])
async def get_faqs_public(
    category_id: Optional[str] = None,
    limit: Optional[int] = None
):
    """Obtiene FAQs activas, opcionalmente filtradas por categoría (público)"""
    try:
        faqs = await faq_service.get_faqs(
            category_id=category_id,
            active_only=True,
            limit=limit
        )
        return faqs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/grouped", response_model=List[dict])
async def get_faqs_grouped():
    """Obtiene FAQs agrupadas por categoría (público)"""
    try:
        grouped = await faq_service.get_faqs_by_category_grouped()
        return grouped
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{faq_id}", response_model=dict)
async def get_faq_public(faq_id: str):
    """Obtiene una FAQ por ID e incrementa vistas (público)"""
    try:
        faq = await faq_service.get_faq(faq_id)
        if not faq:
            raise HTTPException(status_code=404, detail="FAQ not found")
        
        # Incrementar vistas
        await faq_service.increment_view(faq_id)
        
        return faq
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", response_model=List[dict])
async def search_faqs(request: FAQSearchRequest):
    """Busca FAQs por texto (público)"""
    try:
        faqs = await faq_service.search_faqs(
            query=request.query,
            category_id=request.category_id,
            language=request.language,
            limit=request.limit
        )
        return faqs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def add_faq_feedback(request: FAQFeedbackRequest):
    """Agrega feedback a una FAQ (público)"""
    try:
        success = await faq_service.add_feedback(request.faq_id, request.helpful)
        if not success:
            raise HTTPException(status_code=404, detail="FAQ not found")
        return {"success": True, "message": "Feedback recorded"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/overview", response_model=dict)
async def get_faq_stats():
    """Obtiene estadísticas de FAQs (público)"""
    try:
        stats = await faq_service.get_faq_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ENDPOINTS ADMIN ====================

@router.post("/admin/categories", response_model=dict)
async def create_category_admin(
    request: FAQCategoryCreateRequest,
    authorization: str = Header(None)
):
    """Crea una nueva categoría (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        category = await faq_service.create_category(
            data=request.dict(),
            created_by=current_user["id"]
        )
        return category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/categories", response_model=List[dict])
async def get_all_categories_admin(
    authorization: str = Header(None)
):
    """Obtiene todas las categorías incluyendo inactivas (admin)"""
    try:
        await require_admin_func(authorization)
        categories = await faq_service.get_categories(active_only=False)
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/categories/{category_id}", response_model=dict)
async def update_category_admin(
    category_id: str,
    request: FAQCategoryUpdateRequest,
    authorization: str = Header(None)
):
    """Actualiza una categoría (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        category = await faq_service.update_category(
            category_id=category_id,
            data=request.dict(exclude_none=True),
            updated_by=current_user["id"]
        )
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        return category
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/categories/{category_id}")
async def delete_category_admin(
    category_id: str,
    authorization: str = Header(None)
):
    """Elimina una categoría (admin)"""
    try:
        await require_admin_func(authorization)
        success = await faq_service.delete_category(category_id)
        if not success:
            raise HTTPException(status_code=404, detail="Category not found")
        return {"success": True, "message": "Category deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/", response_model=dict)
async def create_faq_admin(
    request: FAQCreateRequest,
    authorization: str = Header(None)
):
    """Crea una nueva FAQ (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        faq = await faq_service.create_faq(
            data=request.dict(),
            created_by=current_user["id"]
        )
        return faq
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/all", response_model=List[dict])
async def get_all_faqs_admin(
    category_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """Obtiene todas las FAQs incluyendo inactivas (admin)"""
    try:
        await require_admin_func(authorization)
        faqs = await faq_service.get_faqs(
            category_id=category_id,
            active_only=False
        )
        return faqs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/{faq_id}", response_model=dict)
async def update_faq_admin(
    faq_id: str,
    request: FAQUpdateRequest,
    authorization: str = Header(None)
):
    """Actualiza una FAQ (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        faq = await faq_service.update_faq(
            faq_id=faq_id,
            data=request.dict(exclude_none=True),
            updated_by=current_user["id"]
        )
        if not faq:
            raise HTTPException(status_code=404, detail="FAQ not found")
        return faq
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/{faq_id}")
async def delete_faq_admin(
    faq_id: str,
    authorization: str = Header(None)
):
    """Elimina una FAQ (admin)"""
    try:
        await require_admin_func(authorization)
        success = await faq_service.delete_faq(faq_id)
        if not success:
            raise HTTPException(status_code=404, detail="FAQ not found")
        return {"success": True, "message": "FAQ deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
