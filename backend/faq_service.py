"""
FAQ Service
Servicio para gestión de Preguntas Frecuentes
"""

import secrets
from datetime import datetime
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

class FAQService:
    """Servicio para gestionar FAQs"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.faqs_collection = db.faqs
        self.faq_categories_collection = db.faq_categories
        print("✅ FAQ Service initialized")
    
    # ==================== CATEGORÍAS ====================
    
    async def create_category(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Crea una nueva categoría de FAQ"""
        category = {
            "id": f"cat_{secrets.token_hex(8)}",
            "name": data["name"],
            "name_es": data["name_es"],
            "description": data.get("description"),
            "description_es": data.get("description_es"),
            "icon": data.get("icon", "❓"),
            "order": data.get("order", 0),
            "active": data.get("active", True),
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.faq_categories_collection.insert_one(category)
        category.pop("_id", None)
        return category
    
    async def get_categories(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Obtiene todas las categorías"""
        query = {"active": True} if active_only else {}
        categories = await self.faq_categories_collection.find(query).sort("order", 1).to_list(None)
        
        for cat in categories:
            cat.pop("_id", None)
        
        return categories
    
    async def get_category(self, category_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una categoría por ID"""
        category = await self.faq_categories_collection.find_one({"id": category_id})
        if category:
            category.pop("_id", None)
        return category
    
    async def update_category(self, category_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Actualiza una categoría"""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = datetime.utcnow()
        
        await self.faq_categories_collection.update_one(
            {"id": category_id},
            {"$set": update_data}
        )
        
        return await self.get_category(category_id)
    
    async def delete_category(self, category_id: str) -> bool:
        """Elimina una categoría (soft delete)"""
        result = await self.faq_categories_collection.update_one(
            {"id": category_id},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    # ==================== FAQs ====================
    
    async def create_faq(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Crea una nueva FAQ"""
        faq = {
            "id": f"faq_{secrets.token_hex(8)}",
            "category_id": data["category_id"],
            "question": data["question"],
            "question_es": data["question_es"],
            "answer": data["answer"],
            "answer_es": data["answer_es"],
            "tags": data.get("tags", []),
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": data.get("order", 0),
            "active": data.get("active", True),
            "created_by": created_by,
            "updated_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.faqs_collection.insert_one(faq)
        faq.pop("_id", None)
        return faq
    
    async def get_faqs(
        self, 
        category_id: Optional[str] = None, 
        active_only: bool = True,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Obtiene FAQs, opcionalmente filtradas por categoría"""
        query = {}
        
        if active_only:
            query["active"] = True
        
        if category_id:
            query["category_id"] = category_id
        
        cursor = self.faqs_collection.find(query).sort("order", 1)
        
        if limit:
            cursor = cursor.limit(limit)
        
        faqs = await cursor.to_list(None)
        
        for faq in faqs:
            faq.pop("_id", None)
        
        return faqs
    
    async def get_faq(self, faq_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una FAQ por ID"""
        faq = await self.faqs_collection.find_one({"id": faq_id})
        if faq:
            faq.pop("_id", None)
        return faq
    
    async def update_faq(self, faq_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Actualiza una FAQ"""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["updated_by"] = updated_by
        update_data["updated_at"] = datetime.utcnow()
        
        await self.faqs_collection.update_one(
            {"id": faq_id},
            {"$set": update_data}
        )
        
        return await self.get_faq(faq_id)
    
    async def delete_faq(self, faq_id: str) -> bool:
        """Elimina una FAQ (soft delete)"""
        result = await self.faqs_collection.update_one(
            {"id": faq_id},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    async def increment_view(self, faq_id: str) -> bool:
        """Incrementa el contador de vistas"""
        result = await self.faqs_collection.update_one(
            {"id": faq_id},
            {"$inc": {"views": 1}}
        )
        return result.modified_count > 0
    
    async def add_feedback(self, faq_id: str, helpful: bool) -> bool:
        """Agrega feedback a una FAQ"""
        field = "helpful_count" if helpful else "not_helpful_count"
        result = await self.faqs_collection.update_one(
            {"id": faq_id},
            {"$inc": {field: 1}}
        )
        return result.modified_count > 0
    
    async def search_faqs(self, query: str, category_id: Optional[str] = None, language: str = "en", limit: int = 10) -> List[Dict[str, Any]]:
        """Busca FAQs por texto"""
        search_query = {"active": True}
        
        if category_id:
            search_query["category_id"] = category_id
        
        # Buscar en pregunta y respuesta según idioma
        if language == "es":
            search_query["$or"] = [
                {"question_es": {"$regex": query, "$options": "i"}},
                {"answer_es": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}}
            ]
        else:
            search_query["$or"] = [
                {"question": {"$regex": query, "$options": "i"}},
                {"answer": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}}
            ]
        
        faqs = await self.faqs_collection.find(search_query).limit(limit).to_list(None)
        
        for faq in faqs:
            faq.pop("_id", None)
        
        return faqs
    
    async def get_faq_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de FAQs"""
        total_faqs = await self.faqs_collection.count_documents({"active": True})
        total_categories = await self.faq_categories_collection.count_documents({"active": True})
        total_views = await self.faqs_collection.aggregate([
            {"$match": {"active": True}},
            {"$group": {"_id": None, "total": {"$sum": "$views"}}}
        ]).to_list(None)
        
        # FAQs más vistas
        top_faqs = await self.faqs_collection.find({"active": True}).sort("views", -1).limit(5).to_list(None)
        
        for faq in top_faqs:
            faq.pop("_id", None)
        
        return {
            "total_faqs": total_faqs,
            "total_categories": total_categories,
            "total_views": total_views[0]["total"] if total_views else 0,
            "top_faqs": top_faqs
        }
    
    async def get_faqs_by_category_grouped(self) -> List[Dict[str, Any]]:
        """Obtiene FAQs agrupadas por categoría"""
        categories = await self.get_categories(active_only=True)
        
        result = []
        for category in categories:
            faqs = await self.get_faqs(category_id=category["id"], active_only=True)
            result.append({
                "category": category,
                "faqs": faqs,
                "count": len(faqs)
            })
        
        return result
