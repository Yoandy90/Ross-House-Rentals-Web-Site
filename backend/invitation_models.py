"""
Appointment Invitations Models - Sistema de invitaciones
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class InvitationStatus(str, Enum):
    PENDING = "pending"
    VIEWED = "viewed"
    COMPLETED = "completed"
    EXPIRED = "expired"

class SentVia(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    BOTH = "both"

class AttendeeCreate(BaseModel):
    """Modelo para crear un asistente"""
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    user_contact_id: Optional[str] = None
    is_primary_user: bool = False

class AttendeeComplete(BaseModel):
    """Modelo para completar datos de asistente"""
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=500)
    ssn_itin: Optional[str] = Field(None, max_length=20)
    birthdate: Optional[str] = None

class GroupAppointmentCreate(BaseModel):
    """Modelo para crear citas grupales"""
    attendees: List[AttendeeCreate] = Field(..., min_items=1, max_items=10)
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    scheduled_at: str
    duration_minutes: int = Field(60, ge=15, le=240)
    appointment_type: str = Field("in_person")
    
class InvitationPublicResponse(BaseModel):
    """Respuesta pública de invitación (sin datos sensibles)"""
    attendee_name: str
    appointment_date: str
    appointment_time: str
    appointment_type: str
    duration_minutes: int
    invited_by: str
    office_address: Optional[str]
    status: str
    expires_at: datetime
    is_expired: bool
    already_completed: bool

class DocumentUpload(BaseModel):
    """Modelo para metadata de documento"""
    document_type: str = Field(..., min_length=1)
    file_name: str
    file_size: int

class AttendeeTrackingResponse(BaseModel):
    """Respuesta de seguimiento de asistente"""
    id: str
    name: str
    phone: Optional[str]
    email: Optional[str]
    invitation_status: str
    invitation_sent_at: Optional[datetime]
    invitation_opened_at: Optional[datetime]
    invitation_completed_at: Optional[datetime]
    documents_uploaded: int
    user_created: bool
    user_id: Optional[str]
