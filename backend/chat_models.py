"""
Chat Models - B2B Communication System
Allows clients and admins to communicate in real-time
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    SYSTEM = "system"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class ChatMessage(BaseModel):
    """Individual chat message"""
    message_id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str  # "admin" or "client"
    message_type: MessageType = MessageType.TEXT
    content: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    status: MessageStatus = MessageStatus.SENT
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None


class Conversation(BaseModel):
    """Chat conversation between client and admin"""
    conversation_id: str
    client_id: str
    client_name: str
    client_email: str
    admin_id: Optional[str] = None
    admin_name: Optional[str] = None
    status: ConversationStatus = ConversationStatus.ACTIVE
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_sender: Optional[str] = None
    unread_count_client: int = 0
    unread_count_admin: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation"""
    client_id: str
    initial_message: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Request to send a new message"""
    conversation_id: str
    content: str
    sender_id: Optional[str] = None  # Optional: 'ai_assistant' for AI messages
    message_type: MessageType = MessageType.TEXT
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None


class MarkAsReadRequest(BaseModel):
    """Request to mark messages as read"""
    conversation_id: str
    message_ids: List[str]


class TypingIndicatorRequest(BaseModel):
    """Request to indicate user is typing"""
    conversation_id: str
    is_typing: bool


class ConversationListResponse(BaseModel):
    """Response with list of conversations"""
    conversations: List[Conversation]
    total_unread: int


class MessagesResponse(BaseModel):
    """Response with list of messages"""
    messages: List[ChatMessage]
    conversation: Conversation
    has_more: bool = False


class ChatNotification(BaseModel):
    """Notification for new chat messages"""
    notification_id: str
    conversation_id: str
    sender_name: str
    message_preview: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
