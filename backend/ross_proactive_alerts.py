"""
Ross AI Brain - Proactive Alerts System
Monitors business metrics and generates intelligent alerts for admins
"""

import os
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

MIAMI_TZ = ZoneInfo("America/New_York")


class RossProactiveAlerts:
    """
    Sistema de Alertas Proactivas del AI Brain Ross
    Monitorea métricas del negocio y genera alertas inteligentes
    """
    
    ALERT_TYPES = {
        'urgent': {'icon': '🚨', 'color': '#ef4444', 'priority': 1},
        'warning': {'icon': '⚠️', 'color': '#f59e0b', 'priority': 2},
        'info': {'icon': 'ℹ️', 'color': '#3b82f6', 'priority': 3},
        'success': {'icon': '✅', 'color': '#10b981', 'priority': 4},
        'opportunity': {'icon': '💡', 'color': '#8b5cf6', 'priority': 2},
    }
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("🤖 Ross Proactive Alerts System initialized")
    
    async def run_full_analysis(self) -> Dict[str, Any]:
        """
        Ejecuta un análisis completo del negocio y genera alertas
        """
        logger.info("🔍 Ross running full business analysis...")
        
        alerts = []
        insights = []
        recommendations = []
        
        try:
            # 1. Analizar documentos pendientes
            doc_alerts = await self._analyze_pending_documents()
            alerts.extend(doc_alerts)
            
            # 2. Analizar recibos sin clasificar
            receipt_alerts = await self._analyze_pending_receipts()
            alerts.extend(receipt_alerts)
            
            # 3. Analizar citas del día
            appt_alerts = await self._analyze_today_appointments()
            alerts.extend(appt_alerts)
            
            # 4. Analizar clientes inactivos
            inactive_alerts = await self._analyze_inactive_clients()
            alerts.extend(inactive_alerts)
            
            # 5. Detectar oportunidades de negocio
            opportunity_alerts = await self._detect_opportunities()
            alerts.extend(opportunity_alerts)
            
            # 6. Verificar cumpleaños
            birthday_alerts = await self._check_upcoming_birthdays()
            alerts.extend(birthday_alerts)
            
            # 7. Analizar métricas del negocio
            metrics = await self._get_business_metrics()
            
            # 8. Generar insights inteligentes
            insights = await self._generate_insights(metrics)
            
            # 9. Generar recomendaciones
            recommendations = await self._generate_recommendations(alerts, metrics)
            
            # Ordenar alertas por prioridad
            alerts.sort(key=lambda x: self.ALERT_TYPES.get(x.get('type', 'info'), {}).get('priority', 5))
            
            # Guardar análisis en DB
            analysis_record = {
                '_id': f"analysis_{datetime.now(MIAMI_TZ).replace(tzinfo=None).strftime('%Y%m%d_%H%M%S')}",
                'timestamp': datetime.now(MIAMI_TZ).replace(tzinfo=None),
                'alerts_count': len(alerts),
                'alerts': alerts[:20],  # Top 20 alertas
                'insights': insights,
                'recommendations': recommendations,
                'metrics': metrics,
            }
            await self.db.ross_analyses.insert_one(analysis_record)
            
            logger.info(f"✅ Ross analysis complete: {len(alerts)} alerts, {len(insights)} insights")
            
            return {
                'success': True,
                'timestamp': datetime.now(MIAMI_TZ).replace(tzinfo=None).isoformat(),
                'summary': {
                    'total_alerts': len(alerts),
                    'urgent': sum(1 for a in alerts if a.get('type') == 'urgent'),
                    'warnings': sum(1 for a in alerts if a.get('type') == 'warning'),
                    'opportunities': sum(1 for a in alerts if a.get('type') == 'opportunity'),
                },
                'alerts': alerts[:20],
                'insights': insights,
                'recommendations': recommendations,
                'metrics': metrics,
            }
            
        except Exception as e:
            logger.error(f"❌ Error in Ross analysis: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _analyze_pending_documents(self) -> List[Dict]:
        """Analiza documentos pendientes de revisión"""
        alerts = []
        
        try:
            # Documentos pendientes
            pending_docs = await self.db.documents.count_documents({'status': 'pending'})
            
            if pending_docs > 10:
                alerts.append({
                    'type': 'urgent',
                    'category': 'documents',
                    'title': f'{pending_docs} documentos pendientes',
                    'message': f'Hay {pending_docs} documentos esperando revisión. Algunos clientes pueden estar esperando.',
                    'action': 'review_documents',
                    'action_label': 'Revisar Documentos',
                })
            elif pending_docs > 5:
                alerts.append({
                    'type': 'warning',
                    'category': 'documents',
                    'title': f'{pending_docs} documentos por revisar',
                    'message': f'Tienes {pending_docs} documentos pendientes de revisión.',
                    'action': 'review_documents',
                    'action_label': 'Ver Documentos',
                })
            
            # Documentos antiguos sin procesar (más de 3 días)
            three_days_ago = datetime.now(MIAMI_TZ).replace(tzinfo=None) - timedelta(days=3)
            old_pending = await self.db.documents.count_documents({
                'status': 'pending',
                'uploaded_at': {'$lt': three_days_ago}
            })
            
            if old_pending > 0:
                alerts.append({
                    'type': 'urgent',
                    'category': 'documents',
                    'title': f'{old_pending} documentos con más de 3 días',
                    'message': f'Hay {old_pending} documentos esperando más de 3 días. Los clientes podrían estar frustrados.',
                    'action': 'review_old_documents',
                    'action_label': 'Priorizar',
                })
                
        except Exception as e:
            logger.error(f"Error analyzing documents: {e}")
        
        return alerts
    
    async def _analyze_pending_receipts(self) -> List[Dict]:
        """Analiza recibos de gastos sin clasificar"""
        alerts = []
        
        try:
            pending_receipts = await self.db.expense_receipts.count_documents({
                'status': {'$in': ['pending', 'processing']}
            })
            
            if pending_receipts > 5:
                alerts.append({
                    'type': 'warning',
                    'category': 'receipts',
                    'title': f'{pending_receipts} recibos sin clasificar',
                    'message': f'Hay {pending_receipts} recibos de gastos esperando clasificación o revisión.',
                    'action': 'classify_receipts',
                    'action_label': 'Clasificar Recibos',
                })
            
            # Calcular total de gastos este año
            current_year = datetime.now(MIAMI_TZ).replace(tzinfo=None).year
            pipeline = [
                {'$match': {'year': current_year, 'amount': {'$ne': None}}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ]
            result = await self.db.expense_receipts.aggregate(pipeline).to_list(1)
            total_expenses = result[0]['total'] if result else 0
            
            if total_expenses > 10000:
                alerts.append({
                    'type': 'info',
                    'category': 'receipts',
                    'title': f'${total_expenses:,.2f} en gastos registrados',
                    'message': f'Los clientes han registrado ${total_expenses:,.2f} en gastos este año. Revisa las deducciones potenciales.',
                    'action': 'view_expenses_dashboard',
                    'action_label': 'Ver Dashboard',
                })
                
        except Exception as e:
            logger.error(f"Error analyzing receipts: {e}")
        
        return alerts
    
    async def _analyze_today_appointments(self) -> List[Dict]:
        """Analiza las citas del día"""
        alerts = []
        
        try:
            today = datetime.now(MIAMI_TZ).replace(tzinfo=None).date()
            tomorrow = today + timedelta(days=1)
            
            # Citas de hoy
            today_appts = await self.db.appointments.count_documents({
                'scheduled_at': {
                    '$gte': datetime.combine(today, datetime.min.time()),
                    '$lt': datetime.combine(tomorrow, datetime.min.time())
                },
                'status': {'$ne': 'cancelled'}
            })
            
            if today_appts > 0:
                alerts.append({
                    'type': 'info',
                    'category': 'appointments',
                    'title': f'{today_appts} citas programadas hoy',
                    'message': f'Tienes {today_appts} citas para hoy. Prepárate para atender a tus clientes.',
                    'action': 'view_calendar',
                    'action_label': 'Ver Calendario',
                })
            
            # Citas sin confirmar para mañana
            day_after = tomorrow + timedelta(days=1)
            unconfirmed = await self.db.appointments.count_documents({
                'scheduled_at': {
                    '$gte': datetime.combine(tomorrow, datetime.min.time()),
                    '$lt': datetime.combine(day_after, datetime.min.time())
                },
                'status': 'scheduled',
                'confirmed': {'$ne': True}
            })
            
            if unconfirmed > 0:
                alerts.append({
                    'type': 'warning',
                    'category': 'appointments',
                    'title': f'{unconfirmed} citas sin confirmar para mañana',
                    'message': f'Hay {unconfirmed} citas para mañana que no han sido confirmadas.',
                    'action': 'send_confirmations',
                    'action_label': 'Enviar Confirmaciones',
                })
                
        except Exception as e:
            logger.error(f"Error analyzing appointments: {e}")
        
        return alerts
    
    async def _analyze_inactive_clients(self) -> List[Dict]:
        """Detecta clientes inactivos"""
        alerts = []
        
        try:
            thirty_days_ago = datetime.now(MIAMI_TZ).replace(tzinfo=None) - timedelta(days=30)
            
            # Clientes que no han interactuado en 30 días
            inactive_count = await self.db.users.count_documents({
                'role': 'client',
                'last_activity': {'$lt': thirty_days_ago}
            })
            
            if inactive_count > 10:
                alerts.append({
                    'type': 'opportunity',
                    'category': 'clients',
                    'title': f'{inactive_count} clientes inactivos',
                    'message': f'{inactive_count} clientes no han interactuado en 30+ días. Una campaña de re-engagement podría recuperarlos.',
                    'action': 'create_reengagement_campaign',
                    'action_label': 'Crear Campaña',
                })
            
            # Clientes nuevos esta semana
            week_ago = datetime.now(MIAMI_TZ).replace(tzinfo=None) - timedelta(days=7)
            new_clients = await self.db.users.count_documents({
                'role': 'client',
                'created_at': {'$gte': week_ago}
            })
            
            if new_clients > 0:
                alerts.append({
                    'type': 'success',
                    'category': 'clients',
                    'title': f'{new_clients} clientes nuevos esta semana',
                    'message': f'¡Excelente! Has ganado {new_clients} clientes nuevos esta semana.',
                    'action': 'view_new_clients',
                    'action_label': 'Ver Clientes',
                })
                
        except Exception as e:
            logger.error(f"Error analyzing clients: {e}")
        
        return alerts
    
    async def _detect_opportunities(self) -> List[Dict]:
        """Detecta oportunidades de negocio"""
        alerts = []
        
        try:
            # Clientes con documentos completos pero sin declaración
            # Use pipeline-based $lookup to only fetch _id (avoids 16MB memory limit with large docs)
            pipeline = [
                {'$match': {'role': 'client'}},
                {'$lookup': {
                    'from': 'documents',
                    'let': {'uid': '$_id'},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$user_id', '$$uid']}}},
                        {'$project': {'_id': 1}},
                        {'$limit': 7}
                    ],
                    'as': 'docs'
                }},
                {'$match': {'docs.5': {'$exists': True}}},  # Al menos 6 documentos
                {'$lookup': {
                    'from': 'tax_returns',
                    'let': {'uid': '$_id'},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$user_id', '$$uid']}}},
                        {'$project': {'_id': 1}},
                        {'$limit': 1}
                    ],
                    'as': 'returns'
                }},
                {'$match': {'returns': {'$size': 0}}},  # Sin declaraciones
                {'$count': 'total'}
            ]
            result = await self.db.users.aggregate(pipeline, allowDiskUse=True).to_list(1)
            ready_clients = result[0]['total'] if result else 0
            
            if ready_clients > 0:
                alerts.append({
                    'type': 'opportunity',
                    'category': 'tax_returns',
                    'title': f'{ready_clients} clientes listos para declarar',
                    'message': f'{ready_clients} clientes tienen documentos completos pero no han iniciado su declaración.',
                    'action': 'start_tax_returns',
                    'action_label': 'Iniciar Declaraciones',
                })
            
            # Meses de tax season (Enero - Abril)
            current_month = datetime.now(MIAMI_TZ).replace(tzinfo=None).month
            if current_month in [1, 2, 3, 4]:
                alerts.append({
                    'type': 'info',
                    'category': 'tax_season',
                    'title': '📅 Temporada de impuestos activa',
                    'message': 'Estamos en temporada de impuestos. Prioriza las declaraciones y mantén a los clientes informados.',
                    'action': 'view_tax_dashboard',
                    'action_label': 'Ver Dashboard',
                })
                
        except Exception as e:
            logger.error(f"Error detecting opportunities: {e}")
        
        return alerts
    
    async def _check_upcoming_birthdays(self) -> List[Dict]:
        """Verifica cumpleaños próximos"""
        alerts = []
        
        try:
            # Use date-only comparison to avoid time-of-day affecting day count
            miami_now = datetime.now(MIAMI_TZ).replace(tzinfo=None)
            today = miami_now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Buscar cumpleaños en los próximos 7 días
            upcoming = []
            clients = await self.db.users.find({
                'role': 'client',
                'birthdate': {'$exists': True, '$ne': None}
            }).to_list(1000)
            
            for client in clients:
                try:
                    birthdate = client.get('birthdate')
                    if isinstance(birthdate, str):
                        birthdate = datetime.fromisoformat(birthdate.replace('Z', '+00:00'))
                    
                    # Calcular próximo cumpleaños - compare date only
                    next_birthday = birthdate.replace(year=today.year, hour=0, minute=0, second=0, microsecond=0)
                    if next_birthday < today:
                        next_birthday = next_birthday.replace(year=today.year + 1)
                    
                    days_until = (next_birthday - today).days
                    if 0 <= days_until <= 7:
                        upcoming.append({
                            'name': client.get('name', 'Cliente'),
                            'days': days_until
                        })
                except:
                    continue
            
            if upcoming:
                today_bdays = [b for b in upcoming if b['days'] == 0]
                upcoming_bdays = [b for b in upcoming if b['days'] > 0]
                
                if today_bdays:
                    names = ', '.join([b['name'] for b in today_bdays[:3]])
                    alerts.append({
                        'type': 'info',
                        'category': 'birthdays',
                        'title': f'🎂 {len(today_bdays)} cumpleaños hoy',
                        'message': f'¡Hoy cumplen años: {names}! Envía felicitaciones.',
                        'action': 'send_birthday_wishes',
                        'action_label': 'Felicitar',
                    })
                
                if upcoming_bdays:
                    alerts.append({
                        'type': 'info',
                        'category': 'birthdays',
                        'title': f'{len(upcoming_bdays)} cumpleaños próximos',
                        'message': f'{len(upcoming_bdays)} clientes cumplen años esta semana.',
                        'action': 'view_birthdays',
                        'action_label': 'Ver Lista',
                    })
                    
        except Exception as e:
            logger.error(f"Error checking birthdays: {e}")
        
        return alerts
    
    async def _get_business_metrics(self) -> Dict[str, Any]:
        """Obtiene métricas clave del negocio"""
        try:
            today = datetime.now(MIAMI_TZ).replace(tzinfo=None)
            month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            year_start = today.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Conteos básicos - Use same query as /admin/clients endpoint
            # Include all users except admin and office_assistant
            client_query = {'role': {'$nin': ['admin', 'office_assistant']}}
            total_clients = await self.db.users.count_documents(client_query)
            
            active_clients = await self.db.users.count_documents({
                '$and': [
                    client_query,
                    {'last_activity': {'$gte': today - timedelta(days=30)}}
                ]
            })
            
            # Documentos
            total_docs = await self.db.documents.count_documents({})
            pending_docs = await self.db.documents.count_documents({'status': 'pending'})
            
            # Citas este mes
            month_appointments = await self.db.appointments.count_documents({
                'scheduled_at': {'$gte': month_start},
                'status': {'$ne': 'cancelled'}
            })
            
            # Recibos
            total_receipts = await self.db.expense_receipts.count_documents({'year': today.year})
            
            # Ingresos (si hay colección de pagos)
            try:
                pipeline = [
                    {'$match': {'created_at': {'$gte': month_start}, 'status': 'completed'}},
                    {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
                ]
                revenue_result = await self.db.payments.aggregate(pipeline).to_list(1)
                month_revenue = revenue_result[0]['total'] if revenue_result else 0
            except:
                month_revenue = 0
            
            return {
                'total_clients': total_clients,
                'active_clients': active_clients,
                'inactive_clients': total_clients - active_clients,
                'total_documents': total_docs,
                'pending_documents': pending_docs,
                'month_appointments': month_appointments,
                'total_receipts_year': total_receipts,
                'month_revenue': month_revenue,
                'client_activity_rate': round((active_clients / total_clients * 100) if total_clients > 0 else 0, 1),
            }
            
        except Exception as e:
            logger.error(f"Error getting metrics: {e}")
            return {}
    
    async def _generate_insights(self, metrics: Dict) -> List[str]:
        """Genera insights basados en las métricas"""
        insights = []
        
        try:
            activity_rate = metrics.get('client_activity_rate', 0)
            if activity_rate < 50:
                insights.append(f"⚠️ Solo el {activity_rate}% de tus clientes están activos. Considera una campaña de re-engagement.")
            elif activity_rate > 80:
                insights.append(f"🌟 ¡Excelente! El {activity_rate}% de tus clientes están activos.")
            
            pending = metrics.get('pending_documents', 0)
            total = metrics.get('total_documents', 1)
            if pending > 0 and (pending / total) > 0.2:
                insights.append(f"📄 El {round(pending/total*100)}% de los documentos están pendientes. Prioriza la revisión.")
            
            if metrics.get('month_appointments', 0) > 20:
                insights.append(f"📅 Mes ocupado: {metrics['month_appointments']} citas programadas.")
            
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
        
        return insights
    
    async def _generate_recommendations(self, alerts: List, metrics: Dict) -> List[Dict]:
        """Genera recomendaciones accionables"""
        recommendations = []
        
        try:
            urgent_count = sum(1 for a in alerts if a.get('type') == 'urgent')
            
            if urgent_count > 3:
                recommendations.append({
                    'title': 'Priorizar tareas urgentes',
                    'description': f'Tienes {urgent_count} alertas urgentes. Te recomiendo atenderlas primero.',
                    'priority': 'high',
                })
            
            if metrics.get('inactive_clients', 0) > 20:
                recommendations.append({
                    'title': 'Campaña de re-engagement',
                    'description': 'Muchos clientes inactivos. Envía un newsletter o promoción para recuperarlos.',
                    'priority': 'medium',
                })
            
            # Tax season recommendation
            if datetime.now(MIAMI_TZ).replace(tzinfo=None).month in [1, 2, 3]:
                recommendations.append({
                    'title': 'Preparar para tax season',
                    'description': 'Es temporada de impuestos. Asegúrate de tener capacidad para atender a todos los clientes.',
                    'priority': 'high',
                })
                
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
        
        return recommendations
    
    async def get_latest_analysis(self) -> Optional[Dict]:
        """Obtiene el último análisis realizado"""
        try:
            analysis = await self.db.ross_analyses.find_one(
                sort=[('timestamp', -1)]
            )
            return analysis
        except Exception as e:
            logger.error(f"Error getting latest analysis: {e}")
            return None
    
    async def get_alert_history(self, days: int = 7) -> List[Dict]:
        """Obtiene historial de alertas"""
        try:
            since = datetime.now(MIAMI_TZ).replace(tzinfo=None) - timedelta(days=days)
            analyses = await self.db.ross_analyses.find({
                'timestamp': {'$gte': since}
            }).sort('timestamp', -1).to_list(100)
            return analyses
        except Exception as e:
            logger.error(f"Error getting alert history: {e}")
            return []


# Singleton instance
ross_alerts: Optional[RossProactiveAlerts] = None

def init_ross_alerts(db: AsyncIOMotorDatabase):
    global ross_alerts
    ross_alerts = RossProactiveAlerts(db)
    return ross_alerts

def get_ross_alerts() -> Optional[RossProactiveAlerts]:
    return ross_alerts
