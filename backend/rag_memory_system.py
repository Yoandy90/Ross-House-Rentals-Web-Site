"""
RAG Memory System v2 - Sistema de memoria de largo plazo para Ross AI
Usa Gemini embeddings para recordar y aprender de interacciones pasadas
"""
import logging
import os
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class RAGMemorySystem:
    def __init__(self, db):
        self.db = db
        
        # Configurar Gemini para embeddings
        gemini_key = os.getenv('GEMINI_API_KEY')
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.embedding_model = 'models/gemini-embedding-001'
            logger.info("✅ RAG Memory System initialized with Gemini Embeddings")
        else:
            self.embedding_model = None
            logger.warning("⚠️ GEMINI_API_KEY not configured for RAG")
        
        # Collections
        self.memory_collection = db.ai_memory
        self.knowledge_base = db.ai_knowledge_base
        self.feedback_collection = db.ai_feedback
        self.learning_log = db.ai_learning_log
    
    async def create_embedding(self, text: str) -> List[float]:
        """Crea embedding usando Gemini"""
        try:
            if not self.embedding_model:
                logger.warning("No embedding model configured")
                return []
            
            # Truncate text to avoid token limits
            text = text[:8000] if len(text) > 8000 else text
            
            result = genai.embed_content(
                model=self.embedding_model,
                content=text
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Error creando embedding: {e}")
            return []
    
    async def store_memory(
        self,
        memory_type: str,
        content: str,
        metadata: Dict,
        user_id: Optional[str] = None,
        tags: List[str] = None
    ) -> str:
        """Almacena una memoria con su embedding"""
        try:
            embedding = await self.create_embedding(content)
            
            memory_doc = {
                "type": memory_type,
                "content": content,
                "embedding": embedding,
                "metadata": metadata,
                "user_id": user_id,
                "tags": tags or [],
                "created_at": datetime.utcnow(),
                "accessed_count": 0,
                "last_accessed": None,
                "relevance_score": 1.0
            }
            
            result = await self.memory_collection.insert_one(memory_doc)
            memory_id = str(result.inserted_id)
            
            logger.info(f"💾 Memoria almacenada: {memory_id} (tipo: {memory_type})")
            return memory_id
            
        except Exception as e:
            logger.error(f"Error almacenando memoria: {e}")
            return None
    
    async def search_similar_memories(
        self,
        query: str,
        memory_type: Optional[str] = None,
        limit: int = 5,
        min_similarity: float = 0.65
    ) -> List[Dict]:
        """Busca memorias similares usando búsqueda semántica"""
        try:
            query_embedding = await self.create_embedding(query)
            if not query_embedding:
                return []
            
            filter_query = {}
            if memory_type:
                filter_query["type"] = memory_type
            
            memories = await self.memory_collection.find(filter_query).to_list(500)
            
            similar_memories = []
            for memory in memories:
                memory_embedding = memory.get('embedding', [])
                if not memory_embedding or len(memory_embedding) != len(query_embedding):
                    continue
                
                similarity = self._cosine_similarity(query_embedding, memory_embedding)
                
                if similarity >= min_similarity:
                    similar_memories.append({
                        "memory_id": str(memory['_id']),
                        "type": memory['type'],
                        "content": memory['content'],
                        "metadata": memory.get('metadata', {}),
                        "tags": memory.get('tags', []),
                        "similarity": round(similarity, 3),
                        "created_at": memory.get('created_at'),
                        "accessed_count": memory.get('accessed_count', 0)
                    })
            
            similar_memories.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Update access count
            from bson import ObjectId
            for mem in similar_memories[:limit]:
                try:
                    await self.memory_collection.update_one(
                        {"_id": ObjectId(mem['memory_id'])},
                        {
                            "$inc": {"accessed_count": 1},
                            "$set": {"last_accessed": datetime.utcnow()}
                        }
                    )
                except Exception:
                    pass
            
            return similar_memories[:limit]
            
        except Exception as e:
            logger.error(f"Error buscando memorias: {e}")
            return []
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calcula similitud coseno entre dos vectores"""
        try:
            vec1 = np.array(vec1)
            vec2 = np.array(vec2)
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return float(dot_product / (norm1 * norm2))
        except Exception:
            return 0.0
    
    # ==================== KNOWLEDGE BASE ====================
    
    async def add_knowledge(
        self,
        title: str,
        content: str,
        category: str,
        source: str = "admin",
        tags: List[str] = None
    ) -> str:
        """Agrega conocimiento a la base de datos"""
        try:
            embedding = await self.create_embedding(f"{title} {content}")
            
            doc = {
                "title": title,
                "content": content,
                "category": category,
                "source": source,
                "tags": tags or [],
                "embedding": embedding,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "usage_count": 0,
                "active": True
            }
            
            result = await self.knowledge_base.insert_one(doc)
            kb_id = str(result.inserted_id)
            
            # Also store as memory
            await self.store_memory(
                memory_type="knowledge",
                content=f"{title}: {content}",
                metadata={"category": category, "kb_id": kb_id, "source": source},
                tags=tags
            )
            
            logger.info(f"📚 Conocimiento agregado: {title} (categoría: {category})")
            return kb_id
        except Exception as e:
            logger.error(f"Error agregando conocimiento: {e}")
            return None
    
    async def search_knowledge(self, query: str, category: str = None, limit: int = 5) -> List[Dict]:
        """Busca en la base de conocimiento"""
        try:
            query_embedding = await self.create_embedding(query)
            if not query_embedding:
                return []
            
            filter_q = {"active": True}
            if category:
                filter_q["category"] = category
            
            docs = await self.knowledge_base.find(filter_q).to_list(200)
            
            results = []
            for doc in docs:
                doc_embedding = doc.get('embedding', [])
                if not doc_embedding or len(doc_embedding) != len(query_embedding):
                    continue
                
                sim = self._cosine_similarity(query_embedding, doc_embedding)
                if sim >= 0.5:
                    results.append({
                        "id": str(doc['_id']),
                        "title": doc['title'],
                        "content": doc['content'],
                        "category": doc['category'],
                        "similarity": round(sim, 3),
                        "usage_count": doc.get('usage_count', 0)
                    })
            
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Update usage count
            from bson import ObjectId
            for r in results[:limit]:
                try:
                    await self.knowledge_base.update_one(
                        {"_id": ObjectId(r['id'])},
                        {"$inc": {"usage_count": 1}}
                    )
                except Exception:
                    pass
            
            return results[:limit]
        except Exception as e:
            logger.error(f"Error buscando conocimiento: {e}")
            return []
    
    async def get_all_knowledge(self, category: str = None) -> List[Dict]:
        """Obtiene toda la base de conocimiento"""
        try:
            filter_q = {"active": True}
            if category:
                filter_q["category"] = category
            
            docs = await self.knowledge_base.find(filter_q).sort("created_at", -1).to_list(500)
            return [{
                "id": str(d['_id']),
                "title": d['title'],
                "content": d['content'],
                "category": d['category'],
                "source": d.get('source', ''),
                "tags": d.get('tags', []),
                "usage_count": d.get('usage_count', 0),
                "created_at": d.get('created_at'),
                "active": d.get('active', True)
            } for d in docs]
        except Exception as e:
            logger.error(f"Error obteniendo conocimiento: {e}")
            return []
    
    async def delete_knowledge(self, kb_id: str) -> bool:
        """Desactiva conocimiento (soft delete)"""
        from bson import ObjectId
        try:
            result = await self.knowledge_base.update_one(
                {"_id": ObjectId(kb_id)},
                {"$set": {"active": False, "deleted_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error eliminando conocimiento: {e}")
            return False
    
    # ==================== FEEDBACK SYSTEM ====================
    
    async def record_feedback(
        self,
        interaction_id: str,
        query: str,
        response: str,
        rating: str,  # "positive", "negative", "correction"
        correction: str = None,
        admin_notes: str = None
    ) -> str:
        """Registra feedback sobre una respuesta de AI"""
        try:
            doc = {
                "interaction_id": interaction_id,
                "query": query,
                "response": response,
                "rating": rating,
                "correction": correction,
                "admin_notes": admin_notes,
                "created_at": datetime.utcnow(),
                "applied": False
            }
            
            result = await self.feedback_collection.insert_one(doc)
            fb_id = str(result.inserted_id)
            
            # If positive, store as successful interaction memory
            if rating == "positive":
                await self.store_memory(
                    memory_type="successful_response",
                    content=f"Pregunta: {query}\nRespuesta exitosa: {response}",
                    metadata={"rating": "positive", "feedback_id": fb_id},
                    tags=["feedback", "positive"]
                )
            
            # If correction, store the correction as knowledge
            if rating == "correction" and correction:
                await self.add_knowledge(
                    title=f"Corrección: {query[:100]}",
                    content=f"Pregunta: {query}\nRespuesta incorrecta: {response}\nRespuesta correcta: {correction}",
                    category="corrections",
                    source="admin_feedback",
                    tags=["correction", "feedback"]
                )
            
            logger.info(f"📝 Feedback registrado: {rating} (ID: {fb_id})")
            return fb_id
        except Exception as e:
            logger.error(f"Error registrando feedback: {e}")
            return None
    
    async def get_feedback_stats(self) -> Dict:
        """Obtiene estadísticas de feedback"""
        try:
            total = await self.feedback_collection.count_documents({})
            positive = await self.feedback_collection.count_documents({"rating": "positive"})
            negative = await self.feedback_collection.count_documents({"rating": "negative"})
            corrections = await self.feedback_collection.count_documents({"rating": "correction"})
            
            recent = await self.feedback_collection.find().sort("created_at", -1).limit(10).to_list(10)
            
            return {
                "total": total,
                "positive": positive,
                "negative": negative,
                "corrections": corrections,
                "satisfaction_rate": round((positive / max(total, 1)) * 100, 1),
                "recent": [{
                    "id": str(f['_id']),
                    "query": f['query'][:100],
                    "rating": f['rating'],
                    "created_at": f.get('created_at')
                } for f in recent]
            }
        except Exception as e:
            logger.error(f"Error obteniendo stats de feedback: {e}")
            return {"total": 0, "positive": 0, "negative": 0, "corrections": 0}
    
    # ==================== AUTO-LEARNING ====================
    
    async def learn_from_interaction(
        self,
        command: str,
        intent: str,
        actions_executed: List[Dict],
        success: bool,
        summary: str = ""
    ) -> str:
        """Aprende automáticamente de cada interacción con el admin"""
        try:
            content = f"Comando: {command}\nIntención: {intent}\nAcciones: {json.dumps(actions_executed, default=str)}\nÉxito: {success}\nResumen: {summary}"
            
            doc = {
                "command": command,
                "intent": intent,
                "actions": actions_executed,
                "success": success,
                "summary": summary,
                "created_at": datetime.utcnow()
            }
            await self.learning_log.insert_one(doc)
            
            # Only store successful interactions as memory
            if success:
                return await self.store_memory(
                    memory_type="command_execution",
                    content=content,
                    metadata={
                        "intent": intent,
                        "success": True,
                        "command": command[:200]
                    },
                    tags=["auto_learning", "command", intent]
                )
            return None
        except Exception as e:
            logger.error(f"Error learning from interaction: {e}")
            return None
    
    async def get_context_for_query(self, query: str) -> str:
        """Obtiene contexto relevante de la memoria para enriquecer respuestas"""
        try:
            # Search knowledge base
            knowledge = await self.search_knowledge(query, limit=3)
            
            # Search past successful interactions
            memories = await self.search_similar_memories(query, limit=3)
            
            context_parts = []
            
            if knowledge:
                context_parts.append("📚 CONOCIMIENTO RELEVANTE:")
                for k in knowledge:
                    context_parts.append(f"- {k['title']}: {k['content'][:300]}")
            
            if memories:
                context_parts.append("\n💡 INTERACCIONES ANTERIORES EXITOSAS:")
                for m in memories:
                    if m['type'] in ('successful_response', 'command_execution', 'knowledge'):
                        context_parts.append(f"- {m['content'][:300]}")
            
            return "\n".join(context_parts) if context_parts else ""
        except Exception as e:
            logger.error(f"Error getting context: {e}")
            return ""
    
    # ==================== INSIGHTS ====================
    
    async def generate_insights(self) -> Dict:
        """Genera insights completos sobre el aprendizaje"""
        try:
            total_memories = await self.memory_collection.count_documents({})
            total_knowledge = await self.knowledge_base.count_documents({"active": True})
            total_feedback = await self.feedback_collection.count_documents({})
            total_learnings = await self.learning_log.count_documents({})
            
            # Memory breakdown by type
            memory_types = await self.memory_collection.aggregate([
                {"$group": {"_id": "$type", "count": {"$sum": 1}}}
            ]).to_list(100)
            
            # Knowledge by category
            kb_categories = await self.knowledge_base.aggregate([
                {"$match": {"active": True}},
                {"$group": {"_id": "$category", "count": {"$sum": 1}}}
            ]).to_list(100)
            
            # Learning success rate
            successful = await self.learning_log.count_documents({"success": True})
            failed = await self.learning_log.count_documents({"success": False})
            
            # Feedback stats
            fb_stats = await self.get_feedback_stats()
            
            # Most accessed memories
            top_memories = await self.memory_collection.find(
                {"accessed_count": {"$gt": 0}}
            ).sort("accessed_count", -1).limit(5).to_list(5)
            
            # Recent learnings (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent_count = await self.learning_log.count_documents(
                {"created_at": {"$gte": week_ago}}
            )
            
            return {
                "total_memories": total_memories,
                "total_knowledge_items": total_knowledge,
                "total_feedback": total_feedback,
                "total_learnings": total_learnings,
                "memory_breakdown": {item['_id']: item['count'] for item in memory_types},
                "knowledge_categories": {item['_id']: item['count'] for item in kb_categories},
                "learning_success_rate": round((successful / max(successful + failed, 1)) * 100, 1),
                "feedback_satisfaction": fb_stats.get('satisfaction_rate', 0),
                "learnings_this_week": recent_count,
                "most_accessed_memories": [
                    {"content": m['content'][:150], "accesses": m['accessed_count']}
                    for m in top_memories
                ],
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error generando insights: {e}")
            return {"error": str(e)}


logger.info("✅ RAG Memory System v2 loaded")
