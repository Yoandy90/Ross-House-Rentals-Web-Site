"""
Tax News Service
Servicio para gestión de noticias fiscales
"""

import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

class NewsService:
    """Servicio para gestionar noticias fiscales"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.news_collection = db.tax_news
        print("✅ Tax News Service initialized")
    
    async def create_news(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Crea una nueva noticia fiscal"""
        news = {
            "id": f"news_{secrets.token_hex(8)}",
            "title": data["title"],
            "title_es": data["title_es"],
            "content": data["content"],
            "content_es": data["content_es"],
            "summary": data.get("summary"),
            "summary_es": data.get("summary_es"),
            "source": data.get("source"),
            "source_url": data.get("source_url"),
            "impact_level": data.get("impact_level", "medium"),
            "news_type": data.get("news_type", "general"),
            "tags": data.get("tags", []),
            "featured_image": data.get("featured_image"),
            "views": 0,
            "active": data.get("active", True),
            "published_at": datetime.utcnow() if data.get("publish_now", True) else None,
            "created_by": created_by,
            "updated_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.news_collection.insert_one(news)
        news.pop("_id", None)
        return news
    
    async def get_news(
        self,
        impact_level: Optional[str] = None,
        news_type: Optional[str] = None,
        active_only: bool = True,
        published_only: bool = True,
        limit: Optional[int] = None,
        days: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Obtiene noticias con filtros opcionales"""
        query = {}
        
        if active_only:
            query["active"] = True
        
        if published_only:
            query["published_at"] = {"$ne": None}
        
        if impact_level:
            query["impact_level"] = impact_level
        
        if news_type:
            query["news_type"] = news_type
        
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query["published_at"] = {"$gte": cutoff_date}
        
        cursor = self.news_collection.find(query).sort("published_at", -1)
        
        if limit:
            cursor = cursor.limit(limit)
        
        news = await cursor.to_list(None)
        
        for item in news:
            item.pop("_id", None)
        
        return news
    
    async def get_single_news(self, news_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una noticia por ID"""
        news = await self.news_collection.find_one({"id": news_id})
        if news:
            news.pop("_id", None)
        return news
    
    async def update_news(self, news_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Actualiza una noticia"""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = datetime.utcnow()
        
        await self.news_collection.update_one(
            {"id": news_id},
            {"$set": update_data}
        )
        
        return await self.get_single_news(news_id)
    
    async def delete_news(self, news_id: str) -> bool:
        """Elimina una noticia (soft delete)"""
        result = await self.news_collection.update_one(
            {"id": news_id},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    async def increment_view(self, news_id: str) -> bool:
        """Incrementa el contador de vistas"""
        result = await self.news_collection.update_one(
            {"id": news_id},
            {"$inc": {"views": 1}}
        )
        return result.modified_count > 0
    
    async def search_news(self, query: str, impact_level: Optional[str] = None, news_type: Optional[str] = None, language: str = "en", limit: int = 10) -> List[Dict[str, Any]]:
        """Busca noticias por texto"""
        search_query = {"active": True, "published_at": {"$ne": None}}
        
        if impact_level:
            search_query["impact_level"] = impact_level
        
        if news_type:
            search_query["news_type"] = news_type
        
        if language == "es":
            search_query["$or"] = [
                {"title_es": {"$regex": query, "$options": "i"}},
                {"content_es": {"$regex": query, "$options": "i"}},
                {"summary_es": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}}
            ]
        else:
            search_query["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"content": {"$regex": query, "$options": "i"}},
                {"summary": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}}
            ]
        
        news = await self.news_collection.find(search_query).sort("published_at", -1).limit(limit).to_list(None)
        
        for item in news:
            item.pop("_id", None)
        
        return news
    
    async def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de noticias"""
        total_news = await self.news_collection.count_documents({"active": True, "published_at": {"$ne": None}})
        
        total_views = await self.news_collection.aggregate([
            {"$match": {"active": True, "published_at": {"$ne": None}}},
            {"$group": {"_id": None, "total": {"$sum": "$views"}}}
        ]).to_list(None)
        
        top_news = await self.news_collection.find(
            {"active": True, "published_at": {"$ne": None}}
        ).sort("views", -1).limit(5).to_list(None)
        
        for item in top_news:
            item.pop("_id", None)
        
        by_impact = await self.news_collection.aggregate([
            {"$match": {"active": True, "published_at": {"$ne": None}}},
            {"$group": {"_id": "$impact_level", "count": {"$sum": 1}}}
        ]).to_list(None)
        
        by_type = await self.news_collection.aggregate([
            {"$match": {"active": True, "published_at": {"$ne": None}}},
            {"$group": {"_id": "$news_type", "count": {"$sum": 1}}}
        ]).to_list(None)
        
        return {
            "total_news": total_news,
            "total_views": total_views[0]["total"] if total_views else 0,
            "top_news": top_news,
            "by_impact": {item["_id"]: item["count"] for item in by_impact},
            "by_type": {item["_id"]: item["count"] for item in by_type}
        }
    
    async def get_high_impact_news(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Obtiene noticias de alto impacto recientes"""
        return await self.get_news(
            impact_level="high",
            active_only=True,
            published_only=True,
            limit=limit,
            days=30
        )
