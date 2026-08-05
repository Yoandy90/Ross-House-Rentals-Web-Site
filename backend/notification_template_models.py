"""
Notification Template Models
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class NotificationTemplate(BaseModel):
    """Notification template model"""
    id: str
    type: str  # 'email' or 'sms'
    category: str  # 'appointment', 'loan', 'credit', 'general'
    name: str
    description: str
    subject: Optional[str] = None  # For emails only
    template_content: str  # HTML for email, plain text for SMS
    variables: List[str] = []  # List of available variables like {user_name}, {amount}, etc.
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "loan_approved_email",
                "type": "email",
                "category": "loan",
                "name": "Préstamo Aprobado - Email",
                "description": "Email enviado cuando un préstamo es aprobado",
                "subject": "¡Préstamo Aprobado! - {company_name}",
                "template_content": "<html>...</html>",
                "variables": ["user_name", "loan_amount", "monthly_payment", "company_name"],
                "is_active": True
            }
        }


class UpdateTemplateRequest(BaseModel):
    """Request to update notification template"""
    subject: Optional[str] = None
    template_content: str
    is_active: Optional[bool] = None


class TestNotificationRequest(BaseModel):
    """Request to test a notification template"""
    template_id: str
    test_email: Optional[str] = None
    test_phone: Optional[str] = None
    test_variables: dict = {}
