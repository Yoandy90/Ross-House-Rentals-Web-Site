from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from news_models import TaxNewsCreateRequest, TaxNewsUpdateRequest, NewsSearchRequest
from news_service import NewsService

router = APIRouter(prefix="/news", tags=["Tax News"])

news_service: Optional[NewsService] = None
get_current_user_func = None
require_admin_func = None

def init_news_endpoints(db, get_current_user, require_admin):
    global news_service, get_current_user_func, require_admin_func
    news_service = NewsService(db)
    get_current_user_func = get_current_user
    require_admin_func = require_admin
    return router

@router.get("/", response_model=List[dict])
async def get_news_public(
    impact_level: Optional[str] = None,
    news_type: Optional[str] = None,
    limit: Optional[int] = 20,
    days: Optional[int] = None
):
    try:
        news = await news_service.get_news(
            impact_level=impact_level,
            news_type=news_type,
            active_only=True,
            published_only=True,
            limit=limit,
            days=days
        )
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/high-impact", response_model=List[dict])
async def get_high_impact_news():
    try:
        news = await news_service.get_high_impact_news(limit=5)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{news_id}", response_model=dict)
async def get_news_item(news_id: str):
    try:
        news = await news_service.get_single_news(news_id)
        if not news:
            raise HTTPException(status_code=404, detail="News not found")
        await news_service.increment_view(news_id)
        return news
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", response_model=List[dict])
async def search_news(request: NewsSearchRequest):
    try:
        news = await news_service.search_news(
            query=request.query,
            impact_level=request.impact_level,
            news_type=request.news_type,
            language=request.language,
            limit=request.limit
        )
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/overview", response_model=dict)
async def get_stats():
    try:
        stats = await news_service.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/", response_model=dict)
async def create_news_admin(request: TaxNewsCreateRequest, authorization: str = Header(None)):
    try:
        current_user = await require_admin_func(authorization)
        news = await news_service.create_news(data=request.dict(), created_by=current_user["id"])
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/all", response_model=List[dict])
async def get_all_news_admin(
    impact_level: Optional[str] = None,
    news_type: Optional[str] = None,
    authorization: str = Header(None)
):
    try:
        await require_admin_func(authorization)
        news = await news_service.get_news(
            impact_level=impact_level,
            news_type=news_type,
            active_only=False,
            published_only=False
        )
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/{news_id}", response_model=dict)
async def update_news_admin(news_id: str, request: TaxNewsUpdateRequest, authorization: str = Header(None)):
    try:
        current_user = await require_admin_func(authorization)
        news = await news_service.update_news(news_id=news_id, data=request.dict(exclude_none=True), updated_by=current_user["id"])
        if not news:
            raise HTTPException(status_code=404, detail="News not found")
        return news
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/{news_id}")
async def delete_news_admin(news_id: str, authorization: str = Header(None)):
    try:
        await require_admin_func(authorization)
        success = await news_service.delete_news(news_id)
        if not success:
            raise HTTPException(status_code=404, detail="News not found")
        return {"success": True, "message": "News deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
