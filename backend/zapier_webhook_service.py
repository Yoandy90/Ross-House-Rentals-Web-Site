import logging
import aiohttp
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class ZapierWebhookService:
    """Service for sending events to Zapier webhook"""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        logger.info(f"🔗 Zapier Webhook Service initialized: {webhook_url}")
    
    async def send_event(self, event_type: str, data: Dict[str, Any]) -> Dict:
        """Send an event to Zapier webhook"""
        try:
            payload = {
                'event_type': event_type,
                'timestamp': datetime.utcnow().isoformat(),
                'data': data
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Zapier webhook sent: {event_type}")
                        return {'success': True, 'event_type': event_type}
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Zapier webhook failed ({response.status}): {error_text}")
                        return {'success': False, 'error': f'HTTP {response.status}'}
        
        except Exception as e:
            logger.error(f"❌ Zapier webhook error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= LOTTERY EVENTS =============
    
    async def send_lottery_purchase(self, user_data: Dict, ticket_data: Dict, lottery_data: Dict) -> Dict:
        """Send lottery ticket purchase event"""
        return await self.send_event('lottery_purchase', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'lottery': {
                'id': lottery_data.get('id'),
                'title': lottery_data.get('title'),
                'type': lottery_data.get('lottery_type'),
                'entry_cost': lottery_data.get('entry_cost'),
                'prize_pool': lottery_data.get('prize_pool')
            },
            'ticket': {
                'id': ticket_data.get('id'),
                'selected_numbers': ticket_data.get('selected_numbers'),
                'bet_type': ticket_data.get('bet_type'),
                'quantity': ticket_data.get('quantity'),
                'purchased_at': ticket_data.get('purchased_at')
            }
        })
    
    async def send_lottery_winner(self, user_data: Dict, ticket_data: Dict, lottery_data: Dict, prize: float) -> Dict:
        """Send lottery winner notification"""
        return await self.send_event('lottery_winner', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'lottery': {
                'id': lottery_data.get('id'),
                'title': lottery_data.get('title'),
                'type': lottery_data.get('lottery_type'),
                'winning_numbers': lottery_data.get('winning_numbers')
            },
            'ticket': {
                'id': ticket_data.get('id'),
                'selected_numbers': ticket_data.get('selected_numbers'),
                'bet_type': ticket_data.get('bet_type'),
                'matched_numbers': ticket_data.get('matched_numbers')
            },
            'prize': prize
        })
    
    # ============= CREDITS EVENTS =============
    
    async def send_credit_purchase(self, user_data: Dict, amount: float, payment_method: str, transaction_id: str) -> Dict:
        """Send credit purchase event"""
        return await self.send_event('credit_purchase', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'transaction': {
                'id': transaction_id,
                'amount': amount,
                'payment_method': payment_method,
                'timestamp': datetime.utcnow().isoformat()
            }
        })
    
    async def send_credit_transfer(self, sender_data: Dict, recipient_data: Dict, amount: float) -> Dict:
        """Send credit transfer event"""
        return await self.send_event('credit_transfer', {
            'sender': {
                'id': sender_data.get('id'),
                'name': sender_data.get('name'),
                'email': sender_data.get('email')
            },
            'recipient': {
                'id': recipient_data.get('id'),
                'name': recipient_data.get('name'),
                'email': recipient_data.get('email')
            },
            'amount': amount,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    # ============= RAFFLE EVENTS =============
    
    async def send_raffle_entry(self, user_data: Dict, raffle_data: Dict, tickets: int) -> Dict:
        """Send raffle entry event"""
        return await self.send_event('raffle_entry', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'raffle': {
                'id': raffle_data.get('id'),
                'title': raffle_data.get('title'),
                'prize': raffle_data.get('prize')
            },
            'tickets': tickets,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    async def send_raffle_winner(self, user_data: Dict, raffle_data: Dict, prize: str) -> Dict:
        """Send raffle winner notification"""
        return await self.send_event('raffle_winner', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'raffle': {
                'id': raffle_data.get('id'),
                'title': raffle_data.get('title'),
                'prize': prize
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    
    # ============= NOTIFICATION EVENTS =============
    
    async def send_appointment_scheduled(self, user_data: Dict, appointment_data: Dict) -> Dict:
        """Send appointment scheduled event"""
        return await self.send_event('appointment_scheduled', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'phone': user_data.get('phone')
            },
            'appointment': {
                'id': appointment_data.get('id'),
                'date': appointment_data.get('date'),
                'time': appointment_data.get('time'),
                'service': appointment_data.get('service'),
                'location': appointment_data.get('location')
            }
        })
    
    async def send_document_uploaded(self, user_data: Dict, document_data: Dict) -> Dict:
        """Send document upload event"""
        return await self.send_event('document_uploaded', {
            'user': {
                'id': user_data.get('id'),
                'name': user_data.get('name'),
                'email': user_data.get('email')
            },
            'document': {
                'id': document_data.get('id'),
                'name': document_data.get('name'),
                'type': document_data.get('type'),
                'category': document_data.get('category'),
                'uploaded_at': document_data.get('uploaded_at')
            }
        })

# Initialize Zapier webhook service
ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/20884107/uspqx1r/"
zapier_webhook_service = ZapierWebhookService(ZAPIER_WEBHOOK_URL)
