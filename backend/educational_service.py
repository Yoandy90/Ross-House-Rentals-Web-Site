"""
Educational Content Service
Servicio para gestión de contenido educativo
"""

import secrets
from datetime import datetime
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

class EducationalService:
    """Servicio para gestionar contenido educativo"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.articles_collection = db.educational_articles
        self.categories_collection = db.educational_categories
        self.user_progress_collection = db.educational_user_progress
        print("✅ Educational Service initialized")
    
    # ==================== CATEGORÍAS ====================
    
    async def create_category(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Crea una nueva categoría educativa"""
        category = {
            "id": f"educat_{secrets.token_hex(8)}",
            "name": data["name"],
            "name_es": data["name_es"],
            "description": data.get("description"),
            "description_es": data.get("description_es"),
            "icon": data.get("icon", "📚"),
            "order": data.get("order", 0),
            "active": data.get("active", True),
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.categories_collection.insert_one(category)
        category.pop("_id", None)
        return category
    
    async def get_categories(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Obtiene todas las categorías"""
        query = {"active": True} if active_only else {}
        categories = await self.categories_collection.find(query).sort("order", 1).to_list(None)
        
        for cat in categories:
            cat.pop("_id", None)
        
        return categories
    
    async def get_category(self, category_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una categoría por ID"""
        category = await self.categories_collection.find_one({"id": category_id})
        if category:
            category.pop("_id", None)
        return category
    
    async def update_category(self, category_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Actualiza una categoría"""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = datetime.utcnow()
        
        await self.categories_collection.update_one(
            {"id": category_id},
            {"$set": update_data}
        )
        
        return await self.get_category(category_id)
    
    async def delete_category(self, category_id: str) -> bool:
        """Elimina una categoría (soft delete)"""
        result = await self.categories_collection.update_one(
            {"id": category_id},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    # ==================== ARTÍCULOS ====================
    
    async def create_article(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Crea un nuevo artículo educativo"""
        article = {
            "id": f"eduart_{secrets.token_hex(8)}",
            "category_id": data["category_id"],
            "title": data["title"],
            "title_es": data["title_es"],
            "content": data["content"],
            "content_es": data["content_es"],
            "summary": data.get("summary"),
            "summary_es": data.get("summary_es"),
            "level": data.get("level", "beginner"),
            "tags": data.get("tags", []),
            "featured_image": data.get("featured_image"),
            "estimated_read_time": data.get("estimated_read_time", 5),
            "views": 0,
            "likes": 0,
            "bookmarks": 0,
            "active": data.get("active", True),
            "published_at": datetime.utcnow() if data.get("publish_now", True) else None,
            "created_by": created_by,
            "updated_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.articles_collection.insert_one(article)
        article.pop("_id", None)
        return article
    
    async def get_articles(
        self, 
        category_id: Optional[str] = None,
        level: Optional[str] = None,
        active_only: bool = True,
        published_only: bool = True,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Obtiene artículos con filtros opcionales"""
        query = {}
        
        if active_only:
            query["active"] = True
        
        if published_only:
            query["published_at"] = {"$ne": None}
        
        if category_id:
            query["category_id"] = category_id
        
        if level:
            query["level"] = level
        
        cursor = self.articles_collection.find(query).sort("published_at", -1)
        
        if limit:
            cursor = cursor.limit(limit)
        
        articles = await cursor.to_list(None)
        
        for article in articles:
            article.pop("_id", None)
        
        return articles
    
    async def get_article(self, article_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un artículo por ID"""
        article = await self.articles_collection.find_one({"id": article_id})
        if article:
            article.pop("_id", None)
        return article
    
    async def update_article(self, article_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Actualiza un artículo"""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = datetime.utcnow()
        
        await self.articles_collection.update_one(
            {"id": article_id},
            {"$set": update_data}
        )
        
        return await self.get_article(article_id)
    
    async def delete_article(self, article_id: str) -> bool:
        """Elimina un artículo (soft delete)"""
        result = await self.articles_collection.update_one(
            {"id": article_id},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    async def increment_view(self, article_id: str) -> bool:
        """Incrementa el contador de vistas"""
        result = await self.articles_collection.update_one(
            {"id": article_id},
            {"$inc": {"views": 1}}
        )
        return result.modified_count > 0
    
    async def add_like(self, article_id: str, user_id: str) -> bool:
        """Agrega un like a un artículo"""
        # Verificar si ya dio like
        existing = await self.user_progress_collection.find_one({
            "user_id": user_id,
            "article_id": article_id,
            "liked": True
        })
        
        if existing:
            return False
        
        # Registrar like
        await self.user_progress_collection.update_one(
            {"user_id": user_id, "article_id": article_id},
            {"$set": {"liked": True, "liked_at": datetime.utcnow()}},
            upsert=True
        )
        
        # Incrementar contador
        result = await self.articles_collection.update_one(
            {"id": article_id},
            {"$inc": {"likes": 1}}
        )
        return result.modified_count > 0
    
    async def add_bookmark(self, article_id: str, user_id: str) -> bool:
        """Agrega un bookmark a un artículo"""
        # Verificar si ya tiene bookmark
        existing = await self.user_progress_collection.find_one({
            "user_id": user_id,
            "article_id": article_id,
            "bookmarked": True
        })
        
        if existing:
            return False
        
        # Registrar bookmark
        await self.user_progress_collection.update_one(
            {"user_id": user_id, "article_id": article_id},
            {"$set": {"bookmarked": True, "bookmarked_at": datetime.utcnow()}},
            upsert=True
        )
        
        # Incrementar contador
        result = await self.articles_collection.update_one(
            {"id": article_id},
            {"$inc": {"bookmarks": 1}}
        )
        return result.modified_count > 0
    
    async def mark_complete(self, article_id: str, user_id: str) -> bool:
        """Marca un artículo como completado"""
        result = await self.user_progress_collection.update_one(
            {"user_id": user_id, "article_id": article_id},
            {"$set": {"completed": True, "completed_at": datetime.utcnow()}},
            upsert=True
        )
        return result.modified_count > 0
    
    async def search_articles(self, query: str, category_id: Optional[str] = None, level: Optional[str] = None, language: str = "en", limit: int = 10) -> List[Dict[str, Any]]:
        """Busca artículos por texto"""
        search_query = {"active": True, "published_at": {"$ne": None}}
        
        if category_id:
            search_query["category_id"] = category_id
        
        if level:
            search_query["level"] = level
        
        # Buscar en título y contenido según idioma
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
        
        articles = await self.articles_collection.find(search_query).limit(limit).to_list(None)
        
        for article in articles:
            article.pop("_id", None)
        
        return articles
    
    async def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de contenido educativo"""
        total_articles = await self.articles_collection.count_documents({"active": True, "published_at": {"$ne": None}})
        total_categories = await self.categories_collection.count_documents({"active": True})
        
        total_views = await self.articles_collection.aggregate([
            {"$match": {"active": True, "published_at": {"$ne": None}}},
            {"$group": {"_id": None, "total": {"$sum": "$views"}}}
        ]).to_list(None)
        
        # Artículos más vistos
        top_articles = await self.articles_collection.find(
            {"active": True, "published_at": {"$ne": None}}
        ).sort("views", -1).limit(5).to_list(None)
        
        for article in top_articles:
            article.pop("_id", None)
        
        # Artículos por nivel
        by_level = await self.articles_collection.aggregate([
            {"$match": {"active": True, "published_at": {"$ne": None}}},
            {"$group": {"_id": "$level", "count": {"$sum": 1}}}
        ]).to_list(None)
        
        return {
            "total_articles": total_articles,
            "total_categories": total_categories,
            "total_views": total_views[0]["total"] if total_views else 0,
            "top_articles": top_articles,
            "by_level": {item["_id"]: item["count"] for item in by_level}
        }
    
    async def get_user_progress(self, user_id: str) -> Dict[str, Any]:
        """Obtiene el progreso de un usuario"""
        progress = await self.user_progress_collection.find({"user_id": user_id}).to_list(None)
        
        completed = [p["article_id"] for p in progress if p.get("completed")]
        bookmarked = [p["article_id"] for p in progress if p.get("bookmarked")]
        liked = [p["article_id"] for p in progress if p.get("liked")]
        
        return {
            "user_id": user_id,
            "completed": completed,
            "bookmarked": bookmarked,
            "liked": liked,
            "completed_count": len(completed),
            "bookmarked_count": len(bookmarked),
            "liked_count": len(liked)
        }
    
    async def get_articles_grouped_by_category(self) -> List[Dict[str, Any]]:
        """Obtiene artículos agrupados por categoría"""
        categories = await self.get_categories(active_only=True)
        
        result = []
        for category in categories:
            articles = await self.get_articles(
                category_id=category["id"],
                active_only=True,
                published_only=True
            )
            result.append({
                "category": category,
                "articles": articles,
                "count": len(articles)
            })
        
        return result
