"""
Educational Content API Endpoints
Endpoints para gesti��n de contenido educativo
"""

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from educational_models import (
    EducationalArticle, EducationalCategory,
    EducationalCategoryCreateRequest, EducationalCategoryUpdateRequest,
    EducationalArticleCreateRequest, EducationalArticleUpdateRequest,
    EducationalSearchRequest, ArticleActionRequest
)
from educational_service import EducationalService

router = APIRouter(prefix="/educational", tags=["Educational Content"])

# Variables globales (serán inicializadas desde server.py)
educational_service: Optional[EducationalService] = None
get_current_user_func = None
require_admin_func = None

def init_educational_endpoints(db, get_current_user, require_admin):
    """Inicializa el servicio y las funciones de autenticación"""
    global educational_service, get_current_user_func, require_admin_func
    educational_service = EducationalService(db)
    get_current_user_func = get_current_user
    require_admin_func = require_admin
    return router

# ==================== ENDPOINTS PÚBLICOS (Clientes) ====================

@router.get("/categories", response_model=List[dict])
async def get_categories_public():
    """Obtiene todas las categorías activas (público)"""
    try:
        categories = await educational_service.get_categories(active_only=True)
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/category/{category_id}", response_model=dict)
async def get_category_public(category_id: str):
    """Obtiene una categoría por ID (público)"""
    try:
        category = await educational_service.get_category(category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        return category
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/articles", response_model=List[dict])
async def get_articles_public(
    category_id: Optional[str] = None,
    level: Optional[str] = None,
    limit: Optional[int] = None
):
    """Obtiene artículos publicados (público)"""
    try:
        articles = await educational_service.get_articles(
            category_id=category_id,
            level=level,
            active_only=True,
            published_only=True,
            limit=limit
        )
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/articles/grouped", response_model=List[dict])
async def get_articles_grouped():
    """Obtiene artículos agrupados por categoría (público)"""
    try:
        grouped = await educational_service.get_articles_grouped_by_category()
        return grouped
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/articles/{article_id}", response_model=dict)
async def get_article_public(article_id: str):
    """Obtiene un artículo por ID e incrementa vistas (público)"""
    try:
        article = await educational_service.get_article(article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Incrementar vistas
        await educational_service.increment_view(article_id)
        
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", response_model=List[dict])
async def search_articles(request: EducationalSearchRequest):
    """Busca artículos por texto (público)"""
    try:
        articles = await educational_service.search_articles(
            query=request.query,
            category_id=request.category_id,
            level=request.level,
            language=request.language,
            limit=request.limit
        )
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/article/like")
async def like_article(request: ArticleActionRequest):
    """Agrega like a un artículo (requiere autenticación)"""
    try:
        success = await educational_service.add_like(request.article_id, request.user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Already liked or article not found")
        return {"success": True, "message": "Article liked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/article/bookmark")
async def bookmark_article(request: ArticleActionRequest):
    """Agrega bookmark a un artículo (requiere autenticación)"""
    try:
        success = await educational_service.add_bookmark(request.article_id, request.user_id)
        if not success:
            raise HTTPException(status_code=400, detail="Already bookmarked or article not found")
        return {"success": True, "message": "Article bookmarked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/article/complete")
async def complete_article(request: ArticleActionRequest):
    """Marca un artículo como completado (requiere autenticación)"""
    try:
        success = await educational_service.mark_complete(request.article_id, request.user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Article not found")
        return {"success": True, "message": "Article marked as complete"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/progress", response_model=dict)
async def get_user_progress(user_id: str):
    """Obtiene el progreso de un usuario"""
    try:
        progress = await educational_service.get_user_progress(user_id)
        return progress
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=dict)
async def get_stats():
    """Obtiene estadísticas de contenido educativo (público)"""
    try:
        stats = await educational_service.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ENDPOINTS ADMIN ====================

@router.post("/admin/categories", response_model=dict)
async def create_category_admin(
    request: EducationalCategoryCreateRequest,
    authorization: str = Header(None)
):
    """Crea una nueva categoría (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        category = await educational_service.create_category(
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
        categories = await educational_service.get_categories(active_only=False)
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/categories/{category_id}", response_model=dict)
async def update_category_admin(
    category_id: str,
    request: EducationalCategoryUpdateRequest,
    authorization: str = Header(None)
):
    """Actualiza una categoría (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        category = await educational_service.update_category(
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
        success = await educational_service.delete_category(category_id)
        if not success:
            raise HTTPException(status_code=404, detail="Category not found")
        return {"success": True, "message": "Category deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/articles", response_model=dict)
async def create_article_admin(
    request: EducationalArticleCreateRequest,
    authorization: str = Header(None)
):
    """Crea un nuevo artículo (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        article = await educational_service.create_article(
            data=request.dict(),
            created_by=current_user["id"]
        )
        return article
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/articles", response_model=List[dict])
async def get_all_articles_admin(
    category_id: Optional[str] = None,
    level: Optional[str] = None,
    authorization: str = Header(None)
):
    """Obtiene todos los artículos incluyendo inactivos (admin)"""
    try:
        await require_admin_func(authorization)
        articles = await educational_service.get_articles(
            category_id=category_id,
            level=level,
            active_only=False,
            published_only=False
        )
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/articles/{article_id}", response_model=dict)
async def update_article_admin(
    article_id: str,
    request: EducationalArticleUpdateRequest,
    authorization: str = Header(None)
):
    """Actualiza un artículo (admin)"""
    try:
        current_user = await require_admin_func(authorization)
        article = await educational_service.update_article(
            article_id=article_id,
            data=request.dict(exclude_none=True),
            updated_by=current_user["id"]
        )
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/articles/{article_id}")
async def delete_article_admin(
    article_id: str,
    authorization: str = Header(None)
):
    """Elimina un artículo (admin)"""
    try:
        await require_admin_func(authorization)
        success = await educational_service.delete_article(article_id)
        if not success:
            raise HTTPException(status_code=404, detail="Article not found")
        return {"success": True, "message": "Article deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
