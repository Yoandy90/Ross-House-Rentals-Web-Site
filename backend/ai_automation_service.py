"""
AI Automation Service - Ross Tax Intelligent Notification System
Controla automáticamente emails, SMS y toma decisiones basadas en comportamiento del cliente
"""
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import openai
from motor.motor_asyncio import AsyncIOMotorDatabase
import os

logger = logging.getLogger(__name__)

class AIAutomationService:
    def __init__(self, db: AsyncIOMotorDatabase, notification_service, whatsapp_service):
        self.db = db
        self.notification_service = notification_service
        self.whatsapp_service = whatsapp_service
        
        # Initialize OpenAI with Emergent LLM Key
        emergent_key = os.getenv('EMERGENT_LLM_KEY')
        if emergent_key:
            openai.api_key = emergent_key
            openai.api_base = "https://api.elevenlabs.io/v1"
            logger.info("✅ AI Automation Service initialized with Emergent LLM Key")
        else:
            logger.warning("⚠️ EMERGENT_LLM_KEY not configured")
        
        # Collection para tracking
        self.email_tracking_collection = db.email_tracking
        self.sms_tracking_collection = db.sms_tracking
        self.ai_decisions_collection = db.ai_decisions
        
        # Inicializar RAG Memory System
        from rag_memory_system import RAGMemorySystem
        self.rag_memory = RAGMemorySystem(db)
        logger.info("✅ RAG Memory System integrated")
        
        # Inicializar Data Analyzer
        from data_analyzer import DataAnalyzer
        self.data_analyzer = DataAnalyzer(db)
        logger.info("✅ Data Analyzer integrated")
        
        logger.info("✅ AI Automation Service initialized with Learning capabilities")
    
    async def track_email_sent(
        self,
        email: str,
        user_id: str,
        email_type: str,
        subject: str,
        content_preview: str,
        metadata: Optional[Dict] = None
    ) -> str:
        """Registra envío de email y genera tracking ID único"""
        tracking_id = f"email_{user_id}_{int(datetime.utcnow().timestamp())}"
        
        tracking_doc = {
            'tracking_id': tracking_id,
            'email': email,
            'user_id': user_id,
            'email_type': email_type,
            'subject': subject,
            'content_preview': content_preview,
            'sent_at': datetime.utcnow(),
            'opened': False,
            'open_count': 0,
            'first_opened_at': None,
            'last_opened_at': None,
            'clicks': [],
            'metadata': metadata or {},
            'ai_processed': False
        }
        
        await self.email_tracking_collection.insert_one(tracking_doc)
        logger.info(f"📧 Email tracking creado: {tracking_id}")
        return tracking_id
    
    async def track_email_opened(self, tracking_id: str) -> bool:
        """Registra apertura de email y dispara automatización de IA"""
        try:
            update_data = {
                '$set': {'opened': True, 'last_opened_at': datetime.utcnow()},
                '$inc': {'open_count': 1}
            }
            
            # Si es primera apertura, registrar
            tracking = await self.email_tracking_collection.find_one({'tracking_id': tracking_id})
            if tracking and not tracking.get('opened'):
                update_data['$set']['first_opened_at'] = datetime.utcnow()
            
            await self.email_tracking_collection.update_one(
                {'tracking_id': tracking_id},
                update_data
            )
            
            logger.info(f"👁️ Email abierto: {tracking_id}")
            
            # Disparar análisis de IA
            await self._ai_analyze_email_behavior(tracking_id)
            
            return True
        except Exception as e:
            logger.error(f"Error tracking email open: {e}")
            return False
    
    async def track_email_click(self, tracking_id: str, link_url: str) -> bool:
        """Registra clic en link del email"""
        try:
            click_data = {
                'url': link_url,
                'clicked_at': datetime.utcnow()
            }
            
            await self.email_tracking_collection.update_one(
                {'tracking_id': tracking_id},
                {'$push': {'clicks': click_data}}
            )
            
            logger.info(f"🖱️ Link clickeado: {tracking_id} -> {link_url}")
            
            # Disparar análisis de IA sobre el clic
            await self._ai_analyze_click_behavior(tracking_id, link_url)
            
            return True
        except Exception as e:
            logger.error(f"Error tracking email click: {e}")
            return False
    
    async def _ai_analyze_email_behavior(self, tracking_id: str):
        """IA analiza comportamiento del cliente y decide acciones usando RAG"""
        try:
            tracking = await self.email_tracking_collection.find_one({'tracking_id': tracking_id})
            if not tracking:
                return
            
            # Obtener historial del usuario
            user_history = await self._get_user_engagement_history(tracking['user_id'])
            
            # USAR RAG: Buscar situaciones similares del pasado
            similar_context = f"Cliente abrió email de tipo {tracking['email_type']} después de {(datetime.utcnow() - tracking['sent_at']).total_seconds() / 3600:.1f} horas"
            similar_memories = await self.rag_memory.search_similar_memories(
                query=similar_context,
                memory_type="successful_strategy",
                limit=3,
                min_similarity=0.7
            )
            
            # Obtener mejores prácticas relevantes
            best_practices = await self.rag_memory.get_best_practices(
                context=similar_context,
                limit=3
            )
            
            # Construir contexto enriquecido con RAG
            rag_insights = ""
            if similar_memories:
                rag_insights += "\n\nEstrategias exitosas en situaciones similares:\n"
                for mem in similar_memories:
                    rag_insights += f"- {mem['content'][:200]}...\n"
            
            if best_practices:
                rag_insights += "\n\nMejores prácticas aprendidas:\n"
                for bp in best_practices:
                    rag_insights += f"- {bp['description'][:200]}...\n"
            
            # Construir contexto para la IA
            context = f"""
            Usuario: {tracking['email']}
            Acción: Abrió email "{tracking['subject']}"
            Tipo de email: {tracking['email_type']}
            Tiempo desde envío: {(datetime.utcnow() - tracking['sent_at']).total_seconds() / 3600:.1f} horas
            
            Historial del usuario:
            - Emails enviados: {user_history['total_emails']}
            - Emails abiertos: {user_history['emails_opened']}
            - Tasa de apertura: {user_history['open_rate']:.1%}
            - Último email abierto: {user_history['last_opened']}
            
            {rag_insights}
            
            Como asistente inteligente de Ross Tax que aprende de experiencias pasadas, decide:
            1. ¿Debo enviar un follow-up?
            2. ¿Qué canal usar (Email/SMS/WhatsApp)?
            3. ¿Qué mensaje enviar?
            4. ¿Cuándo enviarlo?
            
            Responde en formato JSON:
            {{
                "action": "send_followup" | "wait" | "schedule_call",
                "channel": "email" | "sms" | "whatsapp",
                "message": "texto del mensaje",
                "timing": "immediate" | "in_2_hours" | "tomorrow",
                "reasoning": "por qué tomaste esta decisión basándote en experiencias pasadas"
            }}
            """
            
            # Llamar a la IA usando nueva API
            from openai import AsyncOpenAI
            
            emergent_key = os.getenv('EMERGENT_LLM_KEY')
            if not emergent_key:
                logger.warning("No EMERGENT_LLM_KEY para IA")
                return
            
            client = AsyncOpenAI(
                api_key=emergent_key,
                base_url="https://api.openai.com/v1"
            )
            
            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Eres un asistente inteligente de Ross Tax que automatiza comunicaciones con clientes."},
                    {"role": "user", "content": context}
                ],
                temperature=0.7
            )
            
            ai_decision = json.loads(response.choices[0].message.content)
            
            # Guardar decisión de la IA
            decision_doc = {
                'tracking_id': tracking_id,
                'user_id': tracking['user_id'],
                'email': tracking['email'],
                'trigger': 'email_opened',
                'ai_decision': ai_decision,
                'decided_at': datetime.utcnow(),
                'executed': False,
                'executed_at': None
            }
            
            await self.ai_decisions_collection.insert_one(decision_doc)
            logger.info(f"🤖 IA decidió: {ai_decision['action']} via {ai_decision['channel']}")
            
            # Ejecutar la acción si es inmediata
            if ai_decision['timing'] == 'immediate':
                await self._execute_ai_decision(decision_doc)
            
            # Marcar como procesado por IA
            await self.email_tracking_collection.update_one(
                {'tracking_id': tracking_id},
                {'$set': {'ai_processed': True}}
            )
            
        except Exception as e:
            logger.error(f"Error en análisis de IA: {e}")
    
    async def _ai_analyze_click_behavior(self, tracking_id: str, link_url: str):
        """IA analiza clic en link y toma decisiones"""
        try:
            tracking = await self.email_tracking_collection.find_one({'tracking_id': tracking_id})
            if not tracking:
                return
            
            context = f"""
            Usuario: {tracking['email']}
            Acción: Clickeó en: {link_url}
            Tipo de email: {tracking['email_type']}
            
            El usuario mostró interés activo al hacer clic. 
            ¿Qué acción de seguimiento recomiendas?
            
            Responde en formato JSON:
            {{
                "action": "send_reminder" | "schedule_call" | "offer_discount",
                "urgency": "high" | "medium" | "low",
                "message": "mensaje personalizado",
                "reasoning": "razonamiento"
            }}
            """
            
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Eres un asistente de ventas inteligente."},
                    {"role": "user", "content": context}
                ],
                temperature=0.7
            )
            
            ai_decision = json.loads(response.choices[0].message.content)
            
            decision_doc = {
                'tracking_id': tracking_id,
                'user_id': tracking['user_id'],
                'email': tracking['email'],
                'trigger': 'link_clicked',
                'link_url': link_url,
                'ai_decision': ai_decision,
                'decided_at': datetime.utcnow(),
                'executed': False
            }
            
            await self.ai_decisions_collection.insert_one(decision_doc)
            logger.info(f"🤖 IA analizó clic: {ai_decision['action']}")
            
        except Exception as e:
            logger.error(f"Error en análisis de clic: {e}")
    
    async def _execute_ai_decision(self, decision_doc: Dict):
        """Ejecuta la decisión tomada por la IA"""
        try:
            ai_decision = decision_doc['ai_decision']
            user_email = decision_doc['email']
            
            if ai_decision['action'] == 'send_followup':
                if ai_decision['channel'] == 'email':
                    # Enviar email de seguimiento
                    await self.notification_service.send_email(
                        to_email=user_email,
                        subject="Seguimiento de Ross Tax",
                        body=ai_decision['message']
                    )
                    logger.info(f"📧 Follow-up email enviado por IA a {user_email}")
                
                elif ai_decision['channel'] == 'sms':
                    # Buscar teléfono del usuario
                    user = await self.db.users.find_one({'email': user_email})
                    if user and user.get('phone'):
                        await self.notification_service.send_sms(
                            to_phone=user['phone'],
                            message=ai_decision['message']
                        )
                        logger.info(f"📱 Follow-up SMS enviado por IA")
                
                elif ai_decision['channel'] == 'whatsapp':
                    user = await self.db.users.find_one({'email': user_email})
                    if user and user.get('phone'):
                        await self.whatsapp_service.send_message(
                            to_phone=user['phone'],
                            message=ai_decision['message']
                        )
                        logger.info(f"💬 Follow-up WhatsApp enviado por IA")
            
            # Marcar como ejecutado
            await self.ai_decisions_collection.update_one(
                {'_id': decision_doc['_id']},
                {'$set': {'executed': True, 'executed_at': datetime.utcnow()}}
            )
            
            # APRENDIZAJE: Guardar esta acción en memoria RAG para futuras decisiones
            await self.rag_memory.remember_client_interaction(
                client_id=decision_doc['user_id'],
                interaction_type=f"ai_action_{ai_decision['action']}",
                details={
                    "channel": ai_decision['channel'],
                    "message_preview": ai_decision['message'][:100],
                    "timing": ai_decision['timing'],
                    "executed_at": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Error ejecutando decisión de IA: {e}")
    
    async def _get_user_engagement_history(self, user_id: str) -> Dict:
        """Obtiene historial de engagement del usuario"""
        try:
            emails = await self.email_tracking_collection.find(
                {'user_id': user_id}
            ).to_list(100)
            
            total_emails = len(emails)
            emails_opened = len([e for e in emails if e.get('opened')])
            open_rate = emails_opened / total_emails if total_emails > 0 else 0
            
            last_opened = None
            if emails_opened > 0:
                opened_emails = [e for e in emails if e.get('opened')]
                last_opened = max(e.get('first_opened_at') for e in opened_emails if e.get('first_opened_at'))
            
            return {
                'total_emails': total_emails,
                'emails_opened': emails_opened,
                'open_rate': open_rate,
                'last_opened': last_opened.strftime('%Y-%m-%d') if last_opened else 'Nunca'
            }
        except Exception as e:
            logger.error(f"Error obteniendo historial: {e}")
            return {
                'total_emails': 0,
                'emails_opened': 0,
                'open_rate': 0,
                'last_opened': 'Desconocido'
            }
    
    async def get_user_insights(self, user_id: str) -> Dict:
        """Obtiene insights de IA sobre un usuario específico"""
        try:
            history = await self._get_user_engagement_history(user_id)
            
            # Obtener decisiones tomadas por la IA
            ai_decisions = await self.ai_decisions_collection.find(
                {'user_id': user_id}
            ).sort('decided_at', -1).limit(10).to_list(10)
            
            return {
                'engagement': history,
                'ai_decisions': ai_decisions,
                'recommendations': await self._get_ai_recommendations(user_id, history)
            }
        except Exception as e:
            logger.error(f"Error obteniendo insights: {e}")
            return {}
    
    async def _get_ai_recommendations(self, user_id: str, history: Dict) -> List[str]:
        """IA genera recomendaciones personalizadas"""
        try:
            context = f"""
            Usuario ID: {user_id}
            Tasa de apertura: {history['open_rate']:.1%}
            Emails totales: {history['total_emails']}
            Último email abierto: {history['last_opened']}
            
            Genera 3 recomendaciones específicas para mejorar el engagement de este usuario.
            """
            
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Eres un experto en marketing y comunicación con clientes."},
                    {"role": "user", "content": context}
                ],
                temperature=0.8
            )
            
            recommendations = response.choices[0].message.content.split('\n')
            return [r.strip() for r in recommendations if r.strip()]
            
        except Exception as e:
            logger.error(f"Error generando recomendaciones: {e}")
            return ["Error generando recomendaciones"]

# Instancia global
ai_automation_service = None

def init_ai_automation_service(db, notification_service, whatsapp_service):
    global ai_automation_service
    ai_automation_service = AIAutomationService(db, notification_service, whatsapp_service)
    return ai_automation_service
