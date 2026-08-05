"""
Money Request Models - Sistema de solicitudes de dinero
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class RequestStatus(str, Enum):
    """Estados de la solicitud"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class MoneyRequest(BaseModel):
    """Modelo de solicitud de dinero"""
    id: str
    requester_id: str  # Usuario que solicita dinero
    requester_email: str
    requester_name: str
    sender_id: str  # Usuario al que se le solicita
    sender_email: str
    sender_name: str
    amount: float
    note: Optional[str] = None
    status: RequestStatus = RequestStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime  # 48 horas por defecto
    responded_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "req_123",
                "requester_id": "user_abc",
                "requester_email": "solicitante@email.com",
                "requester_name": "Juan Pérez",
                "sender_id": "user_xyz",
                "sender_email": "enviador@email.com",
                "sender_name": "María García",
                "amount": 50.00,
                "note": "Pago de almuerzo",
                "status": "pending",
                "created_at": "2024-01-01T12:00:00",
                "expires_at": "2024-01-03T12:00:00"
            }
        }


class CreateMoneyRequestRequest(BaseModel):
    """Request para crear solicitud de dinero"""
    recipient_identifier: str  # Email o teléfono
    amount: float = Field(gt=0, description="Monto debe ser mayor a 0")
    note: Optional[str] = Field(None, max_length=200)


class RespondMoneyRequestRequest(BaseModel):
    """Request para responder a solicitud"""
    request_id: str
    action: str  # "approve" o "reject"
    rejection_reason: Optional[str] = None


class MoneyRequestResponse(BaseModel):
    """Response de solicitud de dinero"""
    success: bool
    message: str
    request: Optional[MoneyRequest] = None
    error: Optional[str] = None
