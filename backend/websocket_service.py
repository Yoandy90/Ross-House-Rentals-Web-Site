"""
WebSocket Service for Real-time Chat
Provides instant message delivery without polling
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
import json
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # Map of user_id -> list of WebSocket connections (user can have multiple devices)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Map of conversation_id -> set of user_ids subscribed to it
        self.conversation_subscribers: Dict[str, Set[str]] = {}
        # Map of WebSocket -> user_id (for cleanup)
        self.connection_user_map: Dict[WebSocket, str] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        self.connection_user_map[websocket] = user_id
        
        logger.info(f"🔌 WebSocket connected: user {user_id} (total connections: {len(self.active_connections[user_id])})")
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket):
        """Handle WebSocket disconnection"""
        user_id = self.connection_user_map.get(websocket)
        
        if user_id and user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # Clean up if no more connections for this user
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Remove from all conversation subscriptions
                for conv_id in list(self.conversation_subscribers.keys()):
                    self.conversation_subscribers[conv_id].discard(user_id)
        
        if websocket in self.connection_user_map:
            del self.connection_user_map[websocket]
        
        logger.info(f"🔌 WebSocket disconnected: user {user_id}")
    
    def subscribe_to_conversation(self, user_id: str, conversation_id: str):
        """Subscribe a user to receive updates for a conversation"""
        if conversation_id not in self.conversation_subscribers:
            self.conversation_subscribers[conversation_id] = set()
        
        self.conversation_subscribers[conversation_id].add(user_id)
        logger.info(f"👀 User {user_id} subscribed to conversation {conversation_id}")
    
    def unsubscribe_from_conversation(self, user_id: str, conversation_id: str):
        """Unsubscribe a user from a conversation"""
        if conversation_id in self.conversation_subscribers:
            self.conversation_subscribers[conversation_id].discard(user_id)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user"""
        if user_id in self.active_connections:
            disconnected = []
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to user {user_id}: {e}")
                    disconnected.append(websocket)
            
            # Clean up disconnected sockets
            for ws in disconnected:
                self.disconnect(ws)
    
    async def broadcast_to_conversation(self, conversation_id: str, message: dict, exclude_user: str = None):
        """Send a message to all users subscribed to a conversation"""
        if conversation_id in self.conversation_subscribers:
            for user_id in self.conversation_subscribers[conversation_id]:
                if user_id != exclude_user:
                    await self.send_to_user(user_id, message)
    
    async def send_new_message(self, conversation_id: str, message_data: dict, sender_id: str = None):
        """Broadcast a new chat message to all participants"""
        payload = {
            "type": "new_message",
            "conversation_id": conversation_id,
            "message": message_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_conversation(conversation_id, payload, exclude_user=sender_id)
        logger.info(f"📨 Broadcasted message to conversation {conversation_id}")
    
    async def send_typing_indicator(self, conversation_id: str, user_id: str, user_name: str, is_typing: bool):
        """Send typing indicator to conversation participants"""
        payload = {
            "type": "typing",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "user_name": user_name,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_conversation(conversation_id, payload, exclude_user=user_id)
    
    async def send_conversation_update(self, conversation_id: str, update_type: str, data: dict = None):
        """Send conversation status updates (read receipts, etc)"""
        payload = {
            "type": "conversation_update",
            "conversation_id": conversation_id,
            "update_type": update_type,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_conversation(conversation_id, payload)
    
    def get_online_users(self) -> List[str]:
        """Get list of currently connected user IDs"""
        return list(self.active_connections.keys())
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if a user is currently connected"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0


# Global connection manager instance
chat_manager = ConnectionManager()


async def handle_websocket_message(websocket: WebSocket, user_id: str, data: dict):
    """Handle incoming WebSocket messages from clients"""
    message_type = data.get("type")
    
    if message_type == "subscribe":
        # Subscribe to a conversation
        conversation_id = data.get("conversation_id")
        if conversation_id:
            chat_manager.subscribe_to_conversation(user_id, conversation_id)
            await websocket.send_json({
                "type": "subscribed",
                "conversation_id": conversation_id
            })
    
    elif message_type == "unsubscribe":
        # Unsubscribe from a conversation
        conversation_id = data.get("conversation_id")
        if conversation_id:
            chat_manager.unsubscribe_from_conversation(user_id, conversation_id)
    
    elif message_type == "typing":
        # Handle typing indicator
        conversation_id = data.get("conversation_id")
        is_typing = data.get("is_typing", False)
        user_name = data.get("user_name", "Usuario")
        if conversation_id:
            await chat_manager.send_typing_indicator(conversation_id, user_id, user_name, is_typing)
    
    elif message_type == "ping":
        # Keep-alive ping
        await websocket.send_json({"type": "pong"})
    
    else:
        logger.warning(f"Unknown WebSocket message type: {message_type}")


logger.info("✅ WebSocket Chat Manager initialized")
