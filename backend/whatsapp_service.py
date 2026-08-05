"""
WhatsApp Service using Meta Cloud API
Handles sending messages, webhooks, and bot interactions
Now supports dynamic credentials from database (configurable via admin panel)
"""
import aiohttp
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        # Default credentials from environment (fallback)
        self._env_phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
        self._env_access_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
        self.verify_token = os.getenv('WHATSAPP_VERIFY_TOKEN', 'ross_tax_whatsapp_2025')
        
        # Cache for DB credentials (to avoid querying on every message)
        self._cached_credentials = None
        self._cache_timestamp = None
        self._cache_ttl = 300  # 5 minutes cache
        
        if not self._env_phone_number_id or not self._env_access_token:
            logger.warning("WhatsApp env credentials not configured - will try database")
        else:
            logger.info("✅ WhatsApp Service initialized with env credentials")
    
    async def _get_credentials(self) -> tuple:
        """
        Get WhatsApp credentials - first from database, then fallback to env vars.
        This allows changing credentials from the admin panel without restart.
        """
        import time
        
        # Check if we have valid cached credentials
        if self._cached_credentials and self._cache_timestamp:
            if time.time() - self._cache_timestamp < self._cache_ttl:
                return self._cached_credentials
        
        # Try to get credentials from database (system_settings or api_config)
        try:
            # First try system_settings (new format from /admin/configuracion)
            settings_doc = await self.db.system_settings.find_one({'_id': 'main'})
            if settings_doc and settings_doc.get('settings'):
                settings = settings_doc['settings']
                db_phone_id = settings.get('whatsapp_phone_number_id')
                db_token = settings.get('whatsapp_access_token')
                
                if db_phone_id and db_token:
                    logger.info("📱 Using WhatsApp credentials from system_settings (admin panel)")
                    self._cached_credentials = (db_phone_id, db_token)
                    self._cache_timestamp = time.time()
                    return self._cached_credentials
            
            # Fallback to api_config (legacy format)
            api_config = await self.db.api_config.find_one({'_id': 'main'})
            if api_config:
                db_phone_id = api_config.get('whatsapp_phone_number_id')
                db_token = api_config.get('whatsapp_access_token')
                
                if db_phone_id and db_token:
                    logger.info("📱 Using WhatsApp credentials from api_config")
                    self._cached_credentials = (db_phone_id, db_token)
                    self._cache_timestamp = time.time()
                    return self._cached_credentials
        
        except Exception as e:
            logger.warning(f"Could not load WhatsApp credentials from DB: {e}")
        
        # Fallback to environment variables
        if self._env_phone_number_id and self._env_access_token:
            logger.debug("📱 Using WhatsApp credentials from environment variables")
            return (self._env_phone_number_id, self._env_access_token)
        
        return (None, None)
    
    def clear_credentials_cache(self):
        """Clear the credentials cache to force reload from database"""
        self._cached_credentials = None
        self._cache_timestamp = None
        logger.info("🔄 WhatsApp credentials cache cleared")
    
    @property
    def phone_number_id(self):
        """Legacy property - for sync access, returns env value"""
        return self._env_phone_number_id
    
    @property
    def access_token(self):
        """Legacy property - for sync access, returns env value"""
        return self._env_access_token
    
    @property
    def api_url(self):
        """API URL using env phone number ID (for backwards compatibility)"""
        return f"https://graph.facebook.com/v18.0/{self._env_phone_number_id}/messages"
    
    async def send_message(
        self,
        to: str,
        message: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp message
        
        Args:
            to: Phone number (format: 1234567890, no + or spaces)
            message: Message text
            message_type: Type of message (text, template, etc)
        
        Returns:
            Response from WhatsApp API
        """
        try:
            # Get credentials dynamically (DB first, then env)
            phone_number_id, access_token = await self._get_credentials()
            
            if not phone_number_id or not access_token:
                raise Exception("WhatsApp not configured - set credentials in admin panel or environment")
            
            # Build API URL with current phone_number_id
            api_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
            
            # Format phone number (remove +, spaces, dashes)
            to_clean = to.replace('+', '').replace(' ', '').replace('-', '')
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_clean,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": message
                }
            }
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    json=payload,
                    headers=headers
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        # Save message to database
                        await self._save_message(
                            phone_number=to_clean,
                            message=message,
                            direction='outbound',
                            status='sent',
                            whatsapp_message_id=result.get('messages', [{}])[0].get('id')
                        )
                        
                        logger.info(f"WhatsApp message sent to {to_clean}")
                        return {
                            'success': True,
                            'message_id': result.get('messages', [{}])[0].get('id'),
                            'data': result
                        }
                    else:
                        logger.error(f"WhatsApp API error: {result}")
                        return {
                            'success': False,
                            'error': result.get('error', {}).get('message', 'Unknown error')
                        }
        
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_template(
        self,
        to: str,
        template_name: str,
        language_code: str = "es",
        components: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message
        Templates must be pre-approved by Meta
        """
        try:
            # Get credentials dynamically
            phone_number_id, access_token = await self._get_credentials()
            
            if not phone_number_id or not access_token:
                raise Exception("WhatsApp not configured")
            
            api_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
            to_clean = to.replace('+', '').replace(' ', '').replace('-', '')
            
            payload = {
                "messaging_product": "whatsapp",
                "to": to_clean,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language_code
                    }
                }
            }
            
            if components:
                payload["template"]["components"] = components
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    json=payload,
                    headers=headers
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        await self._save_message(
                            phone_number=to_clean,
                            message=f"Template: {template_name}",
                            direction='outbound',
                            status='sent',
                            message_type='template',
                            whatsapp_message_id=result.get('messages', [{}])[0].get('id')
                        )
                        
                        return {
                            'success': True,
                            'message_id': result.get('messages', [{}])[0].get('id')
                        }
                    else:
                        logger.error(f"WhatsApp template error: {result}")
                        return {
                            'success': False,
                            'error': result.get('error', {}).get('message', 'Unknown error')
                        }
        
        except Exception as e:
            logger.error(f"Error sending WhatsApp template: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_buttons(
        self,
        to: str,
        body: str,
        buttons: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Send interactive message with buttons
        
        Args:
            to: Phone number
            body: Message text
            buttons: List of buttons [{"id": "btn_1", "title": "Option 1"}, ...]
        """
        try:
            # Get credentials dynamically
            phone_number_id, access_token = await self._get_credentials()
            
            if not phone_number_id or not access_token:
                raise Exception("WhatsApp not configured")
            
            api_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
            to_clean = to.replace('+', '').replace(' ', '').replace('-', '')
            
            button_components = []
            for btn in buttons[:3]:  # WhatsApp allows max 3 buttons
                button_components.append({
                    "type": "reply",
                    "reply": {
                        "id": btn.get("id", f"btn_{len(button_components)}"),
                        "title": btn.get("title", "Option")[:20]  # Max 20 chars
                    }
                })
            
            payload = {
                "messaging_product": "whatsapp",
                "to": to_clean,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {
                        "text": body
                    },
                    "action": {
                        "buttons": button_components
                    }
                }
            }
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    json=payload,
                    headers=headers
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        await self._save_message(
                            phone_number=to_clean,
                            message=body,
                            direction='outbound',
                            status='sent',
                            message_type='interactive',
                            whatsapp_message_id=result.get('messages', [{}])[0].get('id')
                        )
                        
                        return {
                            'success': True,
                            'message_id': result.get('messages', [{}])[0].get('id')
                        }
                    else:
                        return {
                            'success': False,
                            'error': result.get('error', {}).get('message', 'Unknown error')
                        }
        
        except Exception as e:
            logger.error(f"Error sending WhatsApp buttons: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _save_message(
        self,
        phone_number: str,
        message: str,
        direction: str,
        status: str,
        message_type: str = 'text',
        whatsapp_message_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Save message to database for history"""
        try:
            # Find or create conversation
            conversation = await self.db.whatsapp_conversations.find_one({
                'phone_number': phone_number
            })
            
            if not conversation:
                # Create new conversation and lead
                conversation_id = f"conv_{phone_number}_{int(datetime.utcnow().timestamp())}"
                
                conversation = {
                    '_id': conversation_id,
                    'phone_number': phone_number,
                    'status': 'active',
                    'last_message_at': datetime.utcnow(),
                    'created_at': datetime.utcnow(),
                    'is_lead': True,
                    'lead_status': 'new',
                    'assigned_to': None
                }
                
                await self.db.whatsapp_conversations.insert_one(conversation)
            else:
                # Update last message time
                await self.db.whatsapp_conversations.update_one(
                    {'_id': conversation['_id']},
                    {
                        '$set': {
                            'last_message_at': datetime.utcnow()
                        }
                    }
                )
            
            # Save message
            message_doc = {
                'conversation_id': conversation.get('_id'),
                'phone_number': phone_number,
                'message': message,
                'direction': direction,  # inbound or outbound
                'status': status,  # sent, delivered, read, failed
                'message_type': message_type,
                'whatsapp_message_id': whatsapp_message_id,
                'metadata': metadata or {},
                'created_at': datetime.utcnow()
            }
            
            await self.db.whatsapp_messages.insert_one(message_doc)
            
        except Exception as e:
            logger.error(f"Error saving WhatsApp message: {str(e)}")
    
    async def get_conversation_history(
        self,
        phone_number: str,
        limit: int = 50
    ) -> List[Dict]:
        """Get conversation history for a phone number"""
        try:
            messages = await self.db.whatsapp_messages.find(
                {'phone_number': phone_number}
            ).sort('created_at', -1).limit(limit).to_list(limit)
            
            # Reverse to show oldest first
            messages.reverse()
            
            for msg in messages:
                msg['id'] = str(msg.pop('_id'))
                if 'created_at' in msg:
                    msg['created_at'] = msg['created_at'].isoformat()
            
            return messages
        
        except Exception as e:
            logger.error(f"Error getting conversation history: {str(e)}")
            return []
    
    async def get_all_conversations(
        self,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get all conversations for admin panel - optimized with aggregation"""
        try:
            pipeline = []
            
            # Match filter
            match_query: Dict = {}
            if status:
                match_query['status'] = status
            if match_query:
                pipeline.append({'$match': match_query})
            
            # Sort by last message
            pipeline.append({'$sort': {'last_message_at': -1}})
            pipeline.append({'$limit': limit})
            
            # Lookup last message
            pipeline.append({
                '$lookup': {
                    'from': 'whatsapp_messages',
                    'let': {'phone': '$phone_number'},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$phone_number', '$$phone']}}},
                        {'$sort': {'created_at': -1}},
                        {'$limit': 1},
                        {'$project': {'message': 1, '_id': 0}}
                    ],
                    'as': 'last_msg_arr'
                }
            })
            
            # Lookup unread count
            pipeline.append({
                '$lookup': {
                    'from': 'whatsapp_messages',
                    'let': {'phone': '$phone_number'},
                    'pipeline': [
                        {'$match': {
                            '$expr': {'$eq': ['$phone_number', '$$phone']},
                            'direction': 'inbound',
                            'status': {'$ne': 'read'}
                        }},
                        {'$count': 'count'}
                    ],
                    'as': 'unread_arr'
                }
            })
            
            # Add computed fields
            pipeline.append({
                '$addFields': {
                    'last_message': {'$arrayElemAt': ['$last_msg_arr.message', 0]},
                    'unread_count': {'$ifNull': [{'$arrayElemAt': ['$unread_arr.count', 0]}, 0]},
                }
            })
            
            # Remove temp arrays
            pipeline.append({
                '$project': {'last_msg_arr': 0, 'unread_arr': 0}
            })
            
            conversations = await self.db.whatsapp_conversations.aggregate(pipeline).to_list(limit)
            
            for conv in conversations:
                conv['id'] = str(conv.pop('_id'))
                if 'created_at' in conv and hasattr(conv['created_at'], 'isoformat'):
                    conv['created_at'] = conv['created_at'].isoformat()
                if 'last_message_at' in conv and hasattr(conv['last_message_at'], 'isoformat'):
                    conv['last_message_at'] = conv['last_message_at'].isoformat()
            
            return conversations
        
        except Exception as e:
            logger.error(f"Error getting conversations: {str(e)}")
            return []
    
    async def mark_as_read(self, phone_number: str):
        """Mark all messages from a phone number as read"""
        try:
            await self.db.whatsapp_messages.update_many(
                {
                    'phone_number': phone_number,
                    'direction': 'inbound',
                    'status': {'$ne': 'read'}
                },
                {
                    '$set': {'status': 'read'}
                }
            )
        except Exception as e:
            logger.error(f"Error marking messages as read: {str(e)}")
    
    async def update_conversation_status(
        self,
        phone_number: str,
        status: str,
        assigned_to: Optional[str] = None
    ):
        """Update conversation status and assignment"""
        try:
            update_data = {'status': status}
            if assigned_to is not None:
                update_data['assigned_to'] = assigned_to
            
            await self.db.whatsapp_conversations.update_one(
                {'phone_number': phone_number},
                {'$set': update_data}
            )
        except Exception as e:
            logger.error(f"Error updating conversation: {str(e)}")
