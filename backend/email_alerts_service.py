"""
Email Alerts Service
Sistema de alertas automáticas basado en engagement de emails
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class EmailAlertsService:
    """Servicio para monitorear engagement y generar alertas automáticas"""
    
    def __init__(self, db, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        self.email_events = db.email_events
        self.alerts_collection = db.email_alerts
        
        # Umbrales de alerta
        self.THRESHOLDS = {
            'low_open_rate': 20.0,  # %
            'high_bounce_rate': 5.0,  # %
            'spam_report_threshold': 1,  # número
            'inactive_days': 15,  # días sin abrir emails
        }
    
    async def check_all_alerts(self) -> List[Dict[str, Any]]:
        """Ejecuta todas las verificaciones de alertas"""
        alerts = []
        
        # 1. Verificar tasa de apertura baja
        open_rate_alert = await self.check_low_open_rate()
        if open_rate_alert:
            alerts.append(open_rate_alert)
        
        # 2. Verificar tasa alta de rebotes
        bounce_alert = await self.check_high_bounce_rate()
        if bounce_alert:
            alerts.append(bounce_alert)
        
        # 3. Verificar reportes de spam
        spam_alert = await self.check_spam_reports()
        if spam_alert:
            alerts.append(spam_alert)
        
        # 4. Verificar usuarios inactivos
        inactive_alert = await self.check_inactive_users()
        if inactive_alert:
            alerts.append(inactive_alert)
        
        # Guardar alertas en la base de datos
        for alert in alerts:
            await self.save_alert(alert)
            await self.send_alert_notification(alert)
        
        return alerts
    
    async def check_low_open_rate(self, days: int = 7) -> Dict[str, Any]:
        """Verifica si la tasa de apertura está por debajo del umbral"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Contar enviados y abiertos
        pipeline = [
            {
                '$match': {
                    'timestamp': {'$gte': cutoff_date}
                }
            },
            {
                '$group': {
                    '_id': '$event_type',
                    'count': {'$sum': 1}
                }
            }
        ]
        
        results = await self.email_events.aggregate(pipeline).to_list(None)
        
        delivered = 0
        opens = 0
        
        for result in results:
            if result['_id'] == 'delivered':
                delivered = result['count']
            elif result['_id'] == 'open':
                opens = result['count']
        
        if delivered > 0:
            open_rate = (opens / delivered) * 100
            
            if open_rate < self.THRESHOLDS['low_open_rate']:
                return {
                    'type': 'low_open_rate',
                    'severity': 'warning',
                    'title': '⚠️ Tasa de Apertura Baja',
                    'message': f'La tasa de apertura en los últimos {days} días es de {open_rate:.1f}%, por debajo del {self.THRESHOLDS["low_open_rate"]}%',
                    'data': {
                        'open_rate': open_rate,
                        'delivered': delivered,
                        'opens': opens,
                        'period_days': days
                    },
                    'recommendations': [
                        'Revisar el asunto de los emails',
                        'Verificar el horario de envío',
                        'Segmentar mejor la audiencia',
                        'Mejorar el contenido del email'
                    ],
                    'created_at': datetime.utcnow()
                }
        
        return None
    
    async def check_high_bounce_rate(self, days: int = 7) -> Dict[str, Any]:
        """Verifica si hay una alta tasa de rebotes"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {
                '$match': {
                    'timestamp': {'$gte': cutoff_date}
                }
            },
            {
                '$group': {
                    '_id': '$event_type',
                    'count': {'$sum': 1}
                }
            }
        ]
        
        results = await self.email_events.aggregate(pipeline).to_list(None)
        
        delivered = 0
        bounces = 0
        
        for result in results:
            if result['_id'] == 'delivered':
                delivered = result['count']
            elif result['_id'] == 'bounce':
                bounces = result['count']
        
        if delivered > 0:
            bounce_rate = (bounces / delivered) * 100
            
            if bounce_rate > self.THRESHOLDS['high_bounce_rate']:
                return {
                    'type': 'high_bounce_rate',
                    'severity': 'critical',
                    'title': '🚨 Alta Tasa de Rebotes',
                    'message': f'La tasa de rebote en los últimos {days} días es de {bounce_rate:.1f}%, por encima del {self.THRESHOLDS["high_bounce_rate"]}%',
                    'data': {
                        'bounce_rate': bounce_rate,
                        'delivered': delivered,
                        'bounces': bounces,
                        'period_days': days
                    },
                    'recommendations': [
                        'Limpiar la lista de emails inválidos',
                        'Verificar la calidad de los emails',
                        'Implementar verificación de emails al registro',
                        'Revisar la reputación del dominio'
                    ],
                    'created_at': datetime.utcnow()
                }
        
        return None
    
    async def check_spam_reports(self, days: int = 7) -> Dict[str, Any]:
        """Verifica si hay reportes de spam"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        spam_count = await self.email_events.count_documents({
            'event_type': 'spam_report',
            'timestamp': {'$gte': cutoff_date}
        })
        
        if spam_count >= self.THRESHOLDS['spam_report_threshold']:
            return {
                'type': 'spam_reports',
                'severity': 'critical',
                'title': '🚨 Reportes de Spam Detectados',
                'message': f'Se han detectado {spam_count} reporte(s) de spam en los últimos {days} días',
                'data': {
                    'spam_count': spam_count,
                    'period_days': days
                },
                'recommendations': [
                    'Revisar el contenido de los emails',
                    'Asegurar que los usuarios dieron consentimiento',
                    'Facilitar la opción de darse de baja',
                    'Evitar palabras spam en el asunto',
                    'Verificar la reputación del dominio'
                ],
                'created_at': datetime.utcnow()
            }
        
        return None
    
    async def check_inactive_users(self) -> Dict[str, Any]:
        """Identifica usuarios que no han abierto emails en X días"""
        cutoff_date = datetime.utcnow() - timedelta(days=self.THRESHOLDS['inactive_days'])
        
        # Obtener todos los usuarios que recibieron emails
        delivered_pipeline = [
            {
                '$match': {
                    'event_type': 'delivered'
                }
            },
            {
                '$group': {
                    '_id': '$email',
                    'last_delivered': {'$max': '$timestamp'}
                }
            }
        ]
        
        delivered_users = await self.email_events.aggregate(delivered_pipeline).to_list(None)
        
        # Obtener usuarios que abrieron recientemente
        opened_pipeline = [
            {
                '$match': {
                    'event_type': 'open',
                    'timestamp': {'$gte': cutoff_date}
                }
            },
            {
                '$group': {
                    '_id': '$email'
                }
            }
        ]
        
        active_emails = set()
        async for doc in self.email_events.aggregate(opened_pipeline):
            active_emails.add(doc['_id'])
        
        # Identificar inactivos
        inactive_users = []
        for user in delivered_users:
            if user['_id'] not in active_emails and user['last_delivered'] < cutoff_date:
                inactive_users.append(user['_id'])
        
        if len(inactive_users) >= 5:  # Umbral mínimo
            return {
                'type': 'inactive_users',
                'severity': 'info',
                'title': '📉 Usuarios Inactivos Detectados',
                'message': f'{len(inactive_users)} usuarios no han abierto emails en {self.THRESHOLDS["inactive_days"]} días',
                'data': {
                    'inactive_count': len(inactive_users),
                    'inactive_users': inactive_users[:20],  # Primeros 20
                    'inactive_days': self.THRESHOLDS['inactive_days']
                },
                'recommendations': [
                    'Enviar campaña de reactivación',
                    'Ofrecer incentivo especial',
                    'Verificar si los emails son válidos',
                    'Considerar remover de la lista activa'
                ],
                'created_at': datetime.utcnow()
            }
        
        return None
    
    async def save_alert(self, alert: Dict[str, Any]) -> str:
        """Guarda una alerta en la base de datos"""
        alert['status'] = 'new'
        alert['resolved'] = False
        result = await self.alerts_collection.insert_one(alert)
        logger.info(f"📧 Alert saved: {alert['type']} - {alert['title']}")
        return str(result.inserted_id)
    
    async def send_alert_notification(self, alert: Dict[str, Any]):
        """Envía notificación de alerta a los administradores"""
        if not self.notification_service:
            return
        
        # Obtener admins
        admins = await self.db.users.find({'role': 'admin'}).to_list(None)
        
        severity_emoji = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️'
        }
        
        emoji = severity_emoji.get(alert['severity'], '📧')
        
        for admin in admins:
            if admin.get('email'):
                # Enviar email al admin
                try:
                    import requests
                    
                    headers = {
                        "Authorization": f"Bearer {self.notification_service.sendgrid_api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    recommendations_html = ''.join([
                        f'<li>{rec}</li>' for rec in alert.get('recommendations', [])
                    ])
                    
                    html_content = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f7fa;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h1 style="color: #6C1110; margin-bottom: 16px;">{emoji} {alert['title']}</h1>
                            <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
                                {alert['message']}
                            </p>
                            
                            <div style="background-color: #f8f9fa; border-left: 4px solid #6C1110; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <h3 style="margin-top: 0; color: #6C1110;">📊 Datos:</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    {''.join([f'<li><strong>{k}:</strong> {v}</li>' for k, v in alert.get('data', {}).items()])}
                                </ul>
                            </div>
                            
                            <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <h3 style="margin-top: 0; color: #2e7d32;">💡 Recomendaciones:</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    {recommendations_html}
                                </ul>
                            </div>
                            
                            <p style="font-size: 12px; color: #7f8c8d; margin-top: 32px; text-align: center;">
                                Ross Tax Preparation - Sistema de Alertas de Email
                            </p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    email_data = {
                        "personalizations": [{
                            "to": [{"email": admin['email']}],
                            "subject": f"{emoji} {alert['title']}"
                        }],
                        "from": {
                            "email": self.notification_service.sendgrid_from_email,
                            "name": "Ross Tax - Email Alerts"
                        },
                        "content": [{
                            "type": "text/html",
                            "value": html_content
                        }]
                    }
                    
                    response = requests.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers=headers,
                        json=email_data,
                        timeout=10
                    )
                    
                    if response.status_code in [200, 202]:
                        logger.info(f"✅ Alert notification sent to {admin['email']}")
                
                except Exception as e:
                    logger.error(f"❌ Error sending alert notification: {e}")
    
    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Obtiene alertas activas (no resueltas)"""
        alerts = await self.alerts_collection.find(
            {'resolved': False}
        ).sort('created_at', -1).limit(50).to_list(length=50)
        
        return alerts
    
    async def resolve_alert(self, alert_id: str) -> bool:
        """Marca una alerta como resuelta"""
        result = await self.alerts_collection.update_one(
            {'_id': alert_id},
            {'$set': {'resolved': True, 'resolved_at': datetime.utcnow()}}
        )
        
        return result.modified_count > 0


# Instancia global
email_alerts_service = None

def init_email_alerts_service(db, notification_service=None):
    """Inicializa el servicio de alertas"""
    global email_alerts_service
    email_alerts_service = EmailAlertsService(db, notification_service)
    logger.info("✅ Email Alerts Service initialized")
    return email_alerts_service
