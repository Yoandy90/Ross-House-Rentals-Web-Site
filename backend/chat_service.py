"""
Chat Service - B2B Communication
Manages conversations and messages between clients and admins
"""
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorDatabase
from chat_models import (
    Conversation,
    ChatMessage,
    ConversationStatus,
    MessageStatus,
    MessageType,
    ConversationListResponse,
    MessagesResponse
)

logger = logging.getLogger(__name__)

# WebSocket manager - will be set from server.py
websocket_manager = None

def set_websocket_manager(manager):
    """Set the WebSocket manager for real-time updates"""
    global websocket_manager
    websocket_manager = manager
    logger.info("🔌 WebSocket manager connected to Chat Service")


class ChatService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.conversations_collection = db.conversations
        self.messages_collection = db.chat_messages
        self.ai_service = None  # Will be set externally
        logger.info("✅ Chat Service initialized")
    
    def set_ai_service(self, ai_service):
        """Set the AI service for automated responses"""
        self.ai_service = ai_service
        logger.info("🤖 Chat AI Service connected to Chat Service")

    async def create_conversation(
        self,
        client_id: str,
        client_name: str,
        client_email: str,
        admin_id: Optional[str] = None,
        admin_name: Optional[str] = None,
        initial_message: Optional[str] = None
    ) -> Conversation:
        """Create a new conversation"""
        try:
            # Check if conversation already exists
            existing = await self.conversations_collection.find_one({
                "client_id": client_id,
                "status": {"$ne": ConversationStatus.ARCHIVED}
            })
            
            if existing:
                logger.info(f"📱 Conversation already exists for client {client_id}")
                return Conversation(**existing)

            conversation_id = str(uuid4())
            now = datetime.utcnow()
            
            conversation_data = {
                "conversation_id": conversation_id,
                "client_id": client_id,
                "client_name": client_name,
                "client_email": client_email,
                "admin_id": admin_id,
                "admin_name": admin_name,
                "status": ConversationStatus.ACTIVE,
                "last_message": initial_message,
                "last_message_at": now if initial_message else None,
                "last_message_sender": "client" if initial_message else None,
                "unread_count_client": 0,
                "unread_count_admin": 1 if initial_message else 0,
                "created_at": now,
                "updated_at": now,
                "metadata": {}
            }
            
            await self.conversations_collection.insert_one(conversation_data)
            
            # Send initial message if provided
            if initial_message:
                await self.send_message(
                    conversation_id=conversation_id,
                    sender_id=client_id,
                    sender_name=client_name,
                    sender_role="client",
                    content=initial_message,
                    message_type=MessageType.TEXT
                )
            
            logger.info(f"✅ Created conversation {conversation_id}")
            return Conversation(**conversation_data)
            
        except Exception as e:
            logger.error(f"❌ Error creating conversation: {e}")
            raise

    async def send_message(
        self,
        conversation_id: str,
        sender_id: str,
        sender_name: str,
        sender_role: str,
        content: str,
        message_type: MessageType = MessageType.TEXT,
        file_url: Optional[str] = None,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
        language: str = 'es'
    ) -> ChatMessage:
        """Send a new message"""
        try:
            # Debounce: Prevent duplicate messages within 3 seconds
            if sender_role == "client":
                from datetime import timedelta
                recent_cutoff = datetime.utcnow() - timedelta(seconds=3)
                recent_duplicate = await self.messages_collection.find_one({
                    "conversation_id": conversation_id,
                    "sender_id": sender_id,
                    "content": content,
                    "created_at": {"$gte": recent_cutoff}
                })
                if recent_duplicate:
                    logger.info(f"⏭️ Debounced duplicate message from {sender_name} in {conversation_id}")
                    return ChatMessage(**recent_duplicate)

            message_id = str(uuid4())
            now = datetime.utcnow()
            
            message_data = {
                "message_id": message_id,
                "conversation_id": conversation_id,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "sender_role": sender_role,
                "message_type": message_type,
                "content": content,
                "file_url": file_url,
                "file_name": file_name,
                "file_size": file_size,
                "status": MessageStatus.SENT,
                "is_read": False,
                "read_at": None,
                "created_at": now,
                "metadata": {}
            }
            
            await self.messages_collection.insert_one(message_data)
            
            # Update conversation
            update_data = {
                "last_message": content[:100],  # Preview
                "last_message_at": now,
                "last_message_sender": sender_role,
                "updated_at": now
            }
            
            # Prepare update query
            update_query = {"$set": update_data}
            
            # Increment unread count for receiver
            if sender_role == "client":
                update_query["$inc"] = {"unread_count_admin": 1}
            else:
                update_query["$inc"] = {"unread_count_client": 1}
            
            await self.conversations_collection.update_one(
                {"conversation_id": conversation_id},
                update_query
            )
            
            # Send notifications to the receiver
            if sender_role == "admin":
                # Admin sending to client - notify client
                await self._send_notification_to_client(
                    conversation_id, sender_name, content
                )
            else:
                # Client sending to admin - check if AI should respond
                ai_responded = False
                if self.ai_service:
                    ai_enabled = await self.ai_service.is_ai_enabled_for_conversation(conversation_id)
                    if ai_enabled:
                        # Generate AI response
                        ai_response = await self.ai_service.generate_ai_response(
                            conversation_id, content, sender_name, language=language
                        )
                        
                        if ai_response:
                            # Send AI response as admin
                            ai_sender_name = "AI Assistant" if language == 'en' else "Asistente IA"
                            await self.send_message(
                                conversation_id=conversation_id,
                                sender_id="ai-assistant",
                                sender_name=ai_sender_name,
                                sender_role="admin",
                                message_type=MessageType.TEXT,
                                content=ai_response
                            )
                            ai_responded = True
                            logger.info(f"🤖 AI auto-responded to client message in {conversation_id}")
                        
                        # Check if admin should be notified
                        should_notify = await self.ai_service.should_notify_admin(content, ai_response)
                        if should_notify:
                            await self._send_notification_to_admin(
                                conversation_id, sender_name, content, sender_id
                            )
                            logger.info(f"🔔 Admin notified - urgent message or AI couldn't respond")
                    else:
                        # AI not enabled, notify admin normally
                        await self._send_notification_to_admin(
                            conversation_id, sender_name, content, sender_id
                        )
                else:
                    # No AI service, notify admin normally
                    await self._send_notification_to_admin(
                        conversation_id, sender_name, content, sender_id
                    )
            
            # Send real-time WebSocket notification
            if websocket_manager:
                try:
                    await websocket_manager.send_new_message(
                        conversation_id=conversation_id,
                        message_data={
                            "message_id": message_id,
                            "conversation_id": conversation_id,
                            "sender_id": sender_id,
                            "sender_name": sender_name,
                            "sender_role": sender_role,
                            "content": content,
                            "message_type": message_type,
                            "created_at": now.isoformat(),
                            "is_read": False
                        },
                        sender_id=sender_id
                    )
                    logger.info(f"📨 WebSocket message sent for {conversation_id}")
                except Exception as ws_error:
                    logger.error(f"WebSocket send error: {ws_error}")
            
            logger.info(f"✅ Message sent: {message_id}")
            return ChatMessage(**message_data)
            
        except Exception as e:
            logger.error(f"❌ Error sending message: {e}")
            raise

    async def get_conversations(
        self,
        user_id: str,
        user_role: str,
        status: Optional[ConversationStatus] = None
    ) -> ConversationListResponse:
        """Get list of conversations for a user"""
        try:
            query: Dict[str, Any] = {}
            
            if user_role == "client":
                query["client_id"] = user_id
            # Admin can see all conversations
            
            if status:
                query["status"] = status
            
            conversations_cursor = self.conversations_collection.find(query).sort("updated_at", -1)
            conversations_list = await conversations_cursor.to_list(length=100)
            
            conversations = [Conversation(**conv) for conv in conversations_list]
            
            # Calculate total unread
            if user_role == "client":
                total_unread = sum(conv.unread_count_client for conv in conversations)
            else:
                total_unread = sum(conv.unread_count_admin for conv in conversations)
            
            return ConversationListResponse(
                conversations=conversations,
                total_unread=total_unread
            )
            
        except Exception as e:
            logger.error(f"❌ Error getting conversations: {e}")
            raise

    async def get_messages(
        self,
        conversation_id: str,
        limit: int = 50,
        before_message_id: Optional[str] = None
    ) -> MessagesResponse:
        """Get messages for a conversation"""
        try:
            query = {"conversation_id": conversation_id}
            
            if before_message_id:
                # Get message timestamp for pagination
                before_msg = await self.messages_collection.find_one(
                    {"message_id": before_message_id}
                )
                if before_msg:
                    query["created_at"] = {"$lt": before_msg["created_at"]}
            
            messages_cursor = self.messages_collection.find(query).sort("created_at", -1).limit(limit + 1)
            messages_list = await messages_cursor.to_list(length=limit + 1)
            
            has_more = len(messages_list) > limit
            if has_more:
                messages_list = messages_list[:limit]
            
            messages = [ChatMessage(**msg) for msg in reversed(messages_list)]
            
            # Get conversation
            conversation_data = await self.conversations_collection.find_one(
                {"conversation_id": conversation_id}
            )
            conversation = Conversation(**conversation_data) if conversation_data else None
            
            return MessagesResponse(
                messages=messages,
                conversation=conversation,
                has_more=has_more
            )
            
        except Exception as e:
            logger.error(f"❌ Error getting messages: {e}")
            raise

    async def mark_as_read(
        self,
        conversation_id: str,
        message_ids: List[str],
        reader_role: str
    ) -> int:
        """Mark messages as read"""
        try:
            now = datetime.utcnow()
            
            # Update messages
            result = await self.messages_collection.update_many(
                {
                    "conversation_id": conversation_id,
                    "message_id": {"$in": message_ids},
                    "is_read": False
                },
                {
                    "$set": {
                        "is_read": True,
                        "read_at": now,
                        "status": MessageStatus.READ
                    }
                }
            )
            
            # Reset unread count
            if reader_role == "client":
                await self.conversations_collection.update_one(
                    {"conversation_id": conversation_id},
                    {"$set": {"unread_count_client": 0}}
                )
            else:
                await self.conversations_collection.update_one(
                    {"conversation_id": conversation_id},
                    {"$set": {"unread_count_admin": 0}}
                )
            
            logger.info(f"✅ Marked {result.modified_count} messages as read")
            return result.modified_count
            
        except Exception as e:
            logger.error(f"❌ Error marking messages as read: {e}")
            raise

    async def update_conversation_status(
        self,
        conversation_id: str,
        status: ConversationStatus
    ) -> bool:
        """Update conversation status"""
        try:
            result = await self.conversations_collection.update_one(
                {"conversation_id": conversation_id},
                {"$set": {"status": status, "updated_at": datetime.utcnow()}}
            )
            
            logger.info(f"✅ Updated conversation status to {status}")
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"❌ Error updating conversation status: {e}")
            raise

    async def get_unread_count(self, user_id: str, user_role: str) -> int:
        """Get total unread messages count"""
        try:
            query = {}
            if user_role == "client":
                query["client_id"] = user_id
                field = "unread_count_client"
            else:
                field = "unread_count_admin"
            
            conversations = await self.conversations_collection.find(query).to_list(length=None)
            total = sum(conv.get(field, 0) for conv in conversations)
            
            return total
            
        except Exception as e:
            logger.error(f"❌ Error getting unread count: {e}")
            return 0

    async def _send_notification_to_client(
        self,
        conversation_id: str,
        sender_name: str,
        message_content: str
    ):
        """Send notifications to client (Push, Email, SMS)"""
        try:
            import aiohttp
            from bson import ObjectId
            
            # Get conversation to find client_id
            conversation = await self.conversations_collection.find_one({
                "conversation_id": conversation_id
            })
            
            if not conversation:
                logger.warning(f"⚠️ Conversation {conversation_id} not found")
                return
            
            client_id = conversation.get("client_id")
            if not client_id:
                logger.warning(f"⚠️ No client_id in conversation {conversation_id}")
                return
            
            # Get client info
            client = await self.db.users.find_one({"_id": ObjectId(client_id)})
            if not client:
                logger.warning(f"⚠️ Client {client_id} not found")
                return
            
            # 1. Send Push Notification
            push_token = client.get("push_token")
            if push_token:
                try:
                    notification_data = {
                        "to": push_token,
                        "sound": "default",
                        "title": f"💬 Mensaje de {sender_name}",
                        "body": message_content[:100],
                        "data": {
                            "type": "chat_message",
                            "conversation_id": conversation_id,
                            "sender": sender_name
                        },
                        "priority": "high",
                        "channelId": "default",
                    }
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            "https://exp.host/--/api/v2/push/send",
                            json=notification_data,
                            headers={"Content-Type": "application/json"}
                        ) as response:
                            if response.status == 200:
                                logger.info(f"✅ Push notification sent to client {client_id}")
                            else:
                                error_text = await response.text()
                                logger.error(f"❌ Push failed: {error_text}")
                except Exception as e:
                    logger.error(f"❌ Push notification error: {e}")
            
            # 2. Send Email Notification
            client_email = client.get("email")
            if client_email:
                try:
                    from notification_service import NotificationService
                    notification_service = NotificationService(self.db)
                    await notification_service.send_email(
                        to_email=client_email,
                        subject=f"Nuevo mensaje de {sender_name}",
                        html_content=f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #6C1110;">💬 Nuevo Mensaje</h2>
                            <p><strong>De:</strong> {sender_name}</p>
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0;">{message_content}</p>
                            </div>
                            <p>Inicia sesión en tu app para responder.</p>
                        </div>
                        """
                    )
                    logger.info(f"✅ Email notification sent to {client_email}")
                except Exception as e:
                    logger.error(f"❌ Email notification error: {e}")
            
            # 3. Send SMS Notification (optional, only if phone is available)
            client_phone = client.get("phone")
            if client_phone:
                try:
                    from notification_service import NotificationService
                    notification_service = NotificationService(self.db)
                    sms_message = f"💬 {sender_name}: {message_content[:100]}"
                    await notification_service.send_sms(
                        to_phone=client_phone,
                        message=sms_message
                    )
                    logger.info(f"✅ SMS notification sent to {client_phone}")
                except Exception as e:
                    logger.error(f"❌ SMS notification error: {e}")
                        
        except Exception as e:
            logger.error(f"❌ Error sending notifications to client: {e}")

    async def _send_notification_to_admin(
        self,
        conversation_id: str,
        sender_name: str,
        message_content: str,
        sender_id: str = None
    ):
        """Send notifications to admin (Push, Email)"""
        try:
            import aiohttp
            from bson import ObjectId
            
            # Get all admin users
            admin_users = await self.db.users.find({"role": "admin"}).to_list(length=None)
            
            if not admin_users:
                logger.warning(f"⚠️ No admin users found")
                return
            
            for admin in admin_users:
                admin_id = str(admin["_id"])
                
                # Skip if this admin is the sender (don't notify yourself)
                if sender_id and admin_id == sender_id:
                    logger.info(f"⏭️ Skipping notification to sender (admin {admin_id})")
                    continue
                
                # 1. Send Push Notification
                push_token = admin.get("push_token")
                if push_token:
                    try:
                        notification_data = {
                            "to": push_token,
                            "sound": "default",
                            "title": f"💬 Mensaje de {sender_name}",
                            "body": message_content[:100],
                            "data": {
                                "type": "chat_message",
                                "conversation_id": conversation_id,
                                "sender": sender_name
                            },
                            "priority": "high",
                            "channelId": "default",
                        }
                        
                        async with aiohttp.ClientSession() as session:
                            async with session.post(
                                "https://exp.host/--/api/v2/push/send",
                                json=notification_data,
                                headers={"Content-Type": "application/json"}
                            ) as response:
                                if response.status == 200:
                                    logger.info(f"✅ Push notification sent to admin {admin_id}")
                                else:
                                    error_text = await response.text()
                                    logger.error(f"❌ Push failed for admin: {error_text}")
                    except Exception as e:
                        logger.error(f"❌ Push notification error for admin: {e}")
                
                # 2. Send Email Notification
                admin_email = admin.get("email")
                if admin_email:
                    try:
                        from notification_service import NotificationService
                        notification_service = NotificationService(self.db)
                        await notification_service.send_email(
                            to_email=admin_email,
                            subject=f"Nuevo mensaje de cliente: {sender_name}",
                            html_content=f"""
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #6C1110;">💬 Nuevo Mensaje de Cliente</h2>
                                <p><strong>De:</strong> {sender_name}</p>
                                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p style="margin: 0;">{message_content}</p>
                                </div>
                                <p>Accede al panel de administración para responder.</p>
                            </div>
                            """
                        )
                        logger.info(f"✅ Email notification sent to admin {admin_email}")
                    except Exception as e:
                        logger.error(f"❌ Email notification error for admin: {e}")
                        
        except Exception as e:
            logger.error(f"❌ Error sending notifications to admin: {e}")

