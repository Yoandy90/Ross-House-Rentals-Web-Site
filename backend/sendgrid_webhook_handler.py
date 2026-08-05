"""
SendGrid Webhook Handler
Recibe y procesa eventos de SendGrid (opens, clicks, deliveries, etc.)
"""
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class SendGridWebhookHandler:
    """Manejador de webhooks de SendGrid para tracking de emails"""
    
    def __init__(self, db):
        self.db = db
        self.collection = db.email_events
        
    async def process_event(self, event: Dict[str, Any]) -> bool:
        """Procesa un evento de SendGrid y lo guarda en MongoDB"""
        try:
            # Extraer información del evento
            event_type = event.get('event')
            email = event.get('email')
            timestamp = event.get('timestamp')
            
            # Crear documento para MongoDB
            event_doc = {
                'event_type': event_type,
                'email': email,
                'timestamp': datetime.fromtimestamp(timestamp) if timestamp else datetime.utcnow(),
                'sg_event_id': event.get('sg_event_id'),
                'sg_message_id': event.get('sg_message_id'),
                'category': event.get('category', []),
                'raw_event': event,
                'processed_at': datetime.utcnow()
            }
            
            # Agregar campos específicos según el tipo de evento
            if event_type == 'open':
                event_doc['user_agent'] = event.get('useragent')
                event_doc['ip'] = event.get('ip')
                
            elif event_type == 'click':
                event_doc['url'] = event.get('url')
                event_doc['user_agent'] = event.get('useragent')
                event_doc['ip'] = event.get('ip')
                
            elif event_type == 'bounce':
                event_doc['reason'] = event.get('reason')
                event_doc['status'] = event.get('status')
                event_doc['bounce_type'] = event.get('type')
                
            elif event_type == 'dropped':
                event_doc['reason'] = event.get('reason')
                
            elif event_type == 'spam_report':
                event_doc['ip'] = event.get('ip')
            
            # Guardar en MongoDB
            await self.collection.insert_one(event_doc)
            
            logger.info(f"📧 SendGrid event processed: {event_type} - {email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error processing SendGrid event: {e}")
            return False
    
    async def get_email_stats(self, email: str, days: int = 30) -> Dict[str, Any]:
        """Obtiene estadísticas de emails para un usuario específico"""
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Contar eventos por tipo
        pipeline = [
            {
                '$match': {
                    'email': email,
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
        
        results = await self.collection.aggregate(pipeline).to_list(None)
        
        stats = {
            'email': email,
            'period_days': days,
            'delivered': 0,
            'opens': 0,
            'clicks': 0,
            'bounces': 0,
            'spam_reports': 0
        }
        
        for result in results:
            event_type = result['_id']
            count = result['count']
            
            if event_type == 'delivered':
                stats['delivered'] = count
            elif event_type == 'open':
                stats['opens'] = count
            elif event_type == 'click':
                stats['clicks'] = count
            elif event_type == 'bounce':
                stats['bounces'] = count
            elif event_type == 'spam_report':
                stats['spam_reports'] = count
        
        # Calcular tasas
        if stats['delivered'] > 0:
            stats['open_rate'] = f"{(stats['opens'] / stats['delivered'] * 100):.1f}%"
            stats['click_rate'] = f"{(stats['clicks'] / stats['delivered'] * 100):.1f}%"
        else:
            stats['open_rate'] = "0%"
            stats['click_rate'] = "0%"
        
        return stats
    
    async def get_recent_opens(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Obtiene las aperturas más recientes"""
        events = await self.collection.find(
            {'event_type': 'open'},
            {'_id': 0, 'email': 1, 'timestamp': 1, 'user_agent': 1, 'ip': 1}
        ).sort('timestamp', -1).limit(limit).to_list(length=limit)
        
        return events
    
    async def get_engagement_report(self, days: int = 7) -> Dict[str, Any]:
        """Genera un reporte de engagement de emails"""
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Total de eventos por tipo
        pipeline = [
            {
                '$match': {
                    'timestamp': {'$gte': cutoff_date}
                }
            },
            {
                '$group': {
                    '_id': '$event_type',
                    'count': {'$sum': 1},
                    'unique_emails': {'$addToSet': '$email'}
                }
            }
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(None)
        
        report = {
            'period_days': days,
            'total_delivered': 0,
            'total_opens': 0,
            'total_clicks': 0,
            'unique_openers': 0,
            'unique_clickers': 0,
            'engagement_rate': '0%'
        }
        
        for result in results:
            event_type = result['_id']
            count = result['count']
            unique = len(result['unique_emails'])
            
            if event_type == 'delivered':
                report['total_delivered'] = count
            elif event_type == 'open':
                report['total_opens'] = count
                report['unique_openers'] = unique
            elif event_type == 'click':
                report['total_clicks'] = count
                report['unique_clickers'] = unique
        
        # Calcular engagement rate
        if report['total_delivered'] > 0:
            engagement = (report['unique_openers'] / report['total_delivered']) * 100
            report['engagement_rate'] = f"{engagement:.1f}%"
        
        return report


# Instancia global del handler
sendgrid_webhook_handler = None

def init_sendgrid_webhook_handler(db):
    """Inicializa el handler de webhooks"""
    global sendgrid_webhook_handler
    sendgrid_webhook_handler = SendGridWebhookHandler(db)
    logger.info("✅ SendGrid Webhook Handler initialized")


@router.post('/webhooks/sendgrid')
async def handle_sendgrid_webhook(request: Request):
    """
    Endpoint para recibir webhooks de SendGrid
    SendGrid enviará eventos aquí automáticamente
    """
    try:
        # SendGrid envía un array de eventos
        events = await request.json()
        
        if not isinstance(events, list):
            events = [events]
        
        processed_count = 0
        for event in events:
            success = await sendgrid_webhook_handler.process_event(event)
            if success:
                processed_count += 1
        
        logger.info(f"✅ Processed {processed_count}/{len(events)} SendGrid events")
        
        return {
            "status": "success",
            "processed": processed_count,
            "total": len(events)
        }
        
    except Exception as e:
        logger.error(f"❌ Error handling SendGrid webhook: {e}")
        # Siempre devolver 200 para que SendGrid no reintente
        return {"status": "error", "message": str(e)}


@router.get('/admin/email-analytics/user/{email}')
async def get_user_email_analytics(email: str, days: int = 30):
    """Obtiene analytics de email para un usuario específico (Admin only)"""
    if not sendgrid_webhook_handler:
        raise HTTPException(status_code=503, detail="Webhook handler not initialized")
    
    stats = await sendgrid_webhook_handler.get_email_stats(email, days)
    return stats


@router.get('/admin/email-analytics/report')
async def get_email_engagement_report(days: int = 7):
    """Obtiene reporte de engagement de emails (Admin only)"""
    if not sendgrid_webhook_handler:
        raise HTTPException(status_code=503, detail="Webhook handler not initialized")
    
    report = await sendgrid_webhook_handler.get_engagement_report(days)
    return report


@router.get('/admin/email-analytics/recent-opens')
async def get_recent_email_opens(limit: int = 50):
    """Obtiene las aperturas de email más recientes (Admin only)"""
    if not sendgrid_webhook_handler:
        raise HTTPException(status_code=503, detail="Webhook handler not initialized")
    
    opens = await sendgrid_webhook_handler.get_recent_opens(limit)
    return {"opens": opens, "count": len(opens)}
