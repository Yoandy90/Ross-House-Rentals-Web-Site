"""
Data Analyzer - Analiza los 500+ clientes para entrenar la IA
Extrae patrones, comportamientos y datos para aprendizaje
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict
import json

logger = logging.getLogger(__name__)

class DataAnalyzer:
    def __init__(self, db):
        self.db = db
    
    async def analyze_all_clients(self) -> Dict[str, Any]:
        """Analiza todos los clientes y extrae patrones"""
        try:
            logger.info("🔍 Iniciando análisis de clientes...")
            
            # Obtener todos los clientes (con o sin role especificado)
            clients = await self.db.users.find({
                "$or": [
                    {"role": "client"},
                    {"role": {"$exists": False}},  # Usuarios sin role definido
                    {"role": None}  # Usuarios con role null
                ]
            }).to_list(None)
            total_clients = len(clients)
            
            logger.info(f"📊 Analizando {total_clients} clientes...")
            
            # Análisis básico
            basic_stats = await self._analyze_basic_stats(clients)
            
            # Análisis de comunicaciones
            communication_patterns = await self._analyze_communications()
            
            # Análisis de citas
            appointment_patterns = await self._analyze_appointments()
            
            # Análisis de documentos
            document_patterns = await self._analyze_documents()
            
            # Segmentación de clientes
            client_segments = await self._segment_clients(clients)
            
            # Patrones de éxito
            success_patterns = await self._extract_success_patterns()
            
            result = {
                "total_clients": total_clients,
                "basic_stats": basic_stats,
                "communication_patterns": communication_patterns,
                "appointment_patterns": appointment_patterns,
                "document_patterns": document_patterns,
                "client_segments": client_segments,
                "success_patterns": success_patterns,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            
            # Guardar análisis en DB
            await self.db.ai_data_analysis.insert_one(result)
            
            logger.info("✅ Análisis completado")
            return result
            
        except Exception as e:
            logger.error(f"Error en análisis: {e}")
            return {"error": str(e)}
    
    async def _analyze_basic_stats(self, clients: List[Dict]) -> Dict:
        """Estadísticas básicas de clientes"""
        stats = {
            "total": len(clients),
            "active": 0,
            "inactive": 0,
            "with_appointments": 0,
            "with_documents": 0,
            "with_email": 0,
            "with_phone": 0
        }
        
        for client in clients:
            # Verificar actividad (último login)
            last_login = client.get('last_login')
            if last_login:
                days_since_login = (datetime.utcnow() - last_login).days
                if days_since_login <= 30:
                    stats["active"] += 1
                else:
                    stats["inactive"] += 1
            else:
                stats["inactive"] += 1
            
            # Contar con email y teléfono
            if client.get('email'):
                stats["with_email"] += 1
            if client.get('phone'):
                stats["with_phone"] += 1
        
        # Contar clientes con citas
        clients_with_appointments = await self.db.appointments.distinct("client_id")
        stats["with_appointments"] = len(clients_with_appointments)
        
        # Contar clientes con documentos
        clients_with_documents = await self.db.documents.distinct("user_id")
        stats["with_documents"] = len(clients_with_documents)
        
        return stats
    
    async def _analyze_communications(self) -> Dict:
        """Analiza patrones de comunicación"""
        patterns = {
            "email_stats": {
                "total_sent": 0,
                "total_opened": 0,
                "open_rate": 0,
                "best_time": None,
                "best_day": None
            },
            "sms_stats": {
                "total_sent": 0,
                "response_rate": 0
            }
        }
        
        # Analizar emails (si existe tracking)
        try:
            email_count = await self.db.email_tracking.count_documents({})
            opened_count = await self.db.email_tracking.count_documents({"opened": True})
            
            patterns["email_stats"]["total_sent"] = email_count
            patterns["email_stats"]["total_opened"] = opened_count
            patterns["email_stats"]["open_rate"] = round((opened_count / email_count * 100) if email_count > 0 else 0, 2)
            
            # Analizar mejor hora para enviar
            opened_emails = await self.db.email_tracking.find({"opened": True}).to_list(None)
            if opened_emails:
                hour_counts = defaultdict(int)
                for email in opened_emails:
                    if email.get('first_opened_at'):
                        hour = email['first_opened_at'].hour
                        hour_counts[hour] += 1
                
                if hour_counts:
                    best_hour = max(hour_counts.items(), key=lambda x: x[1])
                    patterns["email_stats"]["best_time"] = f"{best_hour[0]}:00"
        
        except Exception as e:
            logger.warning(f"No email tracking data: {e}")
        
        return patterns
    
    async def _analyze_appointments(self) -> Dict:
        """Analiza patrones de citas"""
        patterns = {
            "total_appointments": 0,
            "completed": 0,
            "cancelled": 0,
            "no_show": 0,
            "completion_rate": 0,
            "popular_times": [],
            "popular_days": []
        }
        
        appointments = await self.db.appointments.find({}).to_list(None)
        patterns["total_appointments"] = len(appointments)
        
        status_counts = defaultdict(int)
        time_counts = defaultdict(int)
        day_counts = defaultdict(int)
        
        for apt in appointments:
            status = apt.get('status', 'scheduled')
            status_counts[status] += 1
            
            # Analizar horarios populares
            if apt.get('date'):
                hour = apt['date'].hour
                time_counts[hour] += 1
                
                day = apt['date'].strftime('%A')
                day_counts[day] += 1
        
        patterns["completed"] = status_counts.get('completed', 0)
        patterns["cancelled"] = status_counts.get('cancelled', 0)
        patterns["no_show"] = status_counts.get('no_show', 0)
        patterns["completion_rate"] = round((patterns["completed"] / patterns["total_appointments"] * 100) if patterns["total_appointments"] > 0 else 0, 2)
        
        # Top 3 horarios y días
        patterns["popular_times"] = sorted(time_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        patterns["popular_days"] = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return patterns
    
    async def _analyze_documents(self) -> Dict:
        """Analiza patrones de documentos"""
        patterns = {
            "total_documents": 0,
            "by_type": {},
            "avg_per_client": 0
        }
        
        documents = await self.db.documents.find({}).to_list(None)
        patterns["total_documents"] = len(documents)
        
        type_counts = defaultdict(int)
        for doc in documents:
            doc_type = doc.get('type', 'unknown')
            type_counts[doc_type] += 1
        
        patterns["by_type"] = dict(type_counts)
        
        # Promedio por cliente
        unique_clients = len(set(doc.get('user_id') for doc in documents if doc.get('user_id')))
        patterns["avg_per_client"] = round(patterns["total_documents"] / unique_clients, 2) if unique_clients > 0 else 0
        
        return patterns
    
    async def _segment_clients(self, clients: List[Dict]) -> Dict:
        """Segmenta clientes en grupos"""
        segments = {
            "high_value": [],
            "medium_value": [],
            "low_value": [],
            "at_risk": [],
            "new": [],
            "active": [],
            "inactive": []
        }
        
        for client in clients:
            client_id = str(client['_id'])
            
            # Contar citas del cliente
            apt_count = await self.db.appointments.count_documents({"client_id": client_id})
            
            # Contar documentos
            doc_count = await self.db.documents.count_documents({"user_id": client_id})
            
            # Última actividad
            last_login = client.get('last_login')
            days_since_login = 999
            if last_login:
                days_since_login = (datetime.utcnow() - last_login).days
            
            # Segmentar por valor
            total_value = apt_count + doc_count
            if total_value >= 10:
                segments["high_value"].append(client_id)
            elif total_value >= 3:
                segments["medium_value"].append(client_id)
            else:
                segments["low_value"].append(client_id)
            
            # Segmentar por actividad
            if days_since_login <= 7:
                segments["active"].append(client_id)
            elif days_since_login <= 30:
                segments["at_risk"].append(client_id)
            else:
                segments["inactive"].append(client_id)
            
            # Clientes nuevos (registrados en últimos 30 días)
            created_at = client.get('created_at')
            if created_at:
                days_since_created = (datetime.utcnow() - created_at).days
                if days_since_created <= 30:
                    segments["new"].append(client_id)
        
        # Convertir a conteos
        return {k: len(v) for k, v in segments.items()}
    
    async def _extract_success_patterns(self) -> Dict:
        """Extrae patrones de éxito"""
        patterns = {
            "high_conversion_factors": [],
            "best_practices": [],
            "warning_signs": []
        }
        
        # Analizar clientes con alta tasa de conversión
        # (múltiples citas completadas)
        successful_clients = await self.db.appointments.aggregate([
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$client_id",
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gte": 3}}},
            {"$limit": 50}
        ]).to_list(50)
        
        if successful_clients:
            patterns["high_conversion_factors"].append({
                "factor": "Multiple completed appointments",
                "count": len(successful_clients),
                "description": "Clients with 3+ completed appointments are highly engaged"
            })
        
        # Mejores prácticas identificadas
        patterns["best_practices"] = [
            "Send reminders 24 hours before appointment",
            "Follow up within 48 hours after completed appointment",
            "Request feedback after each service",
            "Offer document upload before first appointment"
        ]
        
        # Señales de advertencia
        patterns["warning_signs"] = [
            "No login for 30+ days",
            "Multiple cancelled appointments",
            "No documents uploaded",
            "No response to emails"
        ]
        
        return patterns
    
    async def generate_training_data(self) -> List[Dict]:
        """Genera datos de entrenamiento para Fine-Tuning"""
        training_data = []
        
        try:
            # Obtener interacciones exitosas
            successful_appointments = await self.db.appointments.find({
                "status": "completed"
            }).limit(500).to_list(500)
            
            for apt in successful_appointments:
                # Obtener cliente
                client = await self.db.users.find_one({"_id": apt.get('client_id')})
                if not client:
                    continue
                
                # Crear ejemplo de entrenamiento
                training_example = {
                    "messages": [
                        {
                            "role": "system",
                            "content": "Eres un asistente experto de Ross Tax Preparation que ayuda a gestionar clientes y optimizar comunicaciones."
                        },
                        {
                            "role": "user",
                            "content": f"Cliente: {client.get('name', 'Unknown')}, Email: {client.get('email')}, Cita: {apt.get('type', 'general')}"
                        },
                        {
                            "role": "assistant",
                            "content": f"Recomiendo contactar al cliente por {'email' if client.get('email') else 'teléfono'} para confirmar la cita. El mejor momento es por la mañana."
                        }
                    ]
                }
                
                training_data.append(training_example)
            
            # Guardar datos de entrenamiento
            if training_data:
                await self.db.ai_training_data.delete_many({})  # Limpiar anteriores
                await self.db.ai_training_data.insert_many(training_data)
                logger.info(f"✅ Generados {len(training_data)} ejemplos de entrenamiento")
            
            return training_data
            
        except Exception as e:
            logger.error(f"Error generando datos de entrenamiento: {e}")
            return []

logger.info("✅ Data Analyzer initialized")
