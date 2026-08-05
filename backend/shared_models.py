"""
Shared Models - Core Pydantic models used across multiple route modules.
Centralized model definitions for the Ross Tax Platform.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, EmailStr

# ================== MODELS ==================

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias='_id')
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    picture: Optional[str] = None
    role: str = 'client'  # client or admin
    phone: Optional[str] = None
    address: Optional[dict] = None  # {street, city, state, zipCode, country}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaxReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tax_year: int
    status: str = 'pending'  # pending, in_progress, completed, filed
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class CompletedTaxReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tax_return_id: str
    tax_year: int
    filing_status: str  # single, married_joint, married_separate, head_of_household
    total_income: Optional[float] = None
    total_deductions: Optional[float] = None
    tax_owed: Optional[float] = None
    refund_amount: Optional[float] = None
    federal_return_pdf: Optional[str] = None  # base64 encoded PDF
    state_return_pdf: Optional[str] = None  # base64 encoded PDF
    filed_date: Optional[datetime] = None
    completed_by: Optional[str] = None  # Staff member who completed it
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tax_return_id: Optional[str] = None
    name: str
    file_data: str  # base64 encoded
    file_type: str
    size: int
    category: Optional[str] = None  # W2, 1099, receipts, etc.
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class DocumentUploadRequest(BaseModel):
    """Request model for document upload (no id required from client)"""
    name: str
    file_data: str  # base64 encoded
    file_type: str
    size: int
    category: Optional[str] = 'other'
    tax_year: Optional[int] = None  # Fiscal year for document organization

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 60
    status: str = 'scheduled'  # scheduled, completed, cancelled
    appointment_type: str = 'in_person'  # in_person, video_call
    meeting_link: Optional[str] = None
    video_call_room_id: Optional[str] = None  # Unique room ID for Jitsi
    calendar_event_id: Optional[str] = None  # Google Calendar event ID
    calendar_event_link: Optional[str] = None  # Google Calendar event link
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

# ================== AVAILABILITY MODELS ==================

class AvailabilitySlot(BaseModel):
    """Individual time slot for availability"""
    start_time: str  # Format: "HH:MM" (e.g., "09:00")
    end_time: str    # Format: "HH:MM" (e.g., "17:00")

class DayAvailability(BaseModel):
    """Availability for a specific day of the week"""
    day: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    enabled: bool = True
    slots: List[AvailabilitySlot] = []

class AvailabilityConfig(BaseModel):
    """Overall availability configuration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_id: str
    slot_duration_minutes: int = 30  # Default slot duration
    buffer_time_minutes: int = 0  # Buffer between appointments
    max_advance_days: int = 60  # How far in advance can clients book
    weekly_schedule: List[DayAvailability] = []
    blocked_dates: List[str] = []  # ISO date strings (holidays, vacations)
    google_calendar_connected: bool = False
    google_calendar_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class AvailabilityConfigRequest(BaseModel):
    """Request to create or update availability config"""
    slot_duration_minutes: int = 30
    buffer_time_minutes: int = 0
    max_advance_days: int = 60
    weekly_schedule: List[DayAvailability]
    blocked_dates: List[str] = []

class AvailableSlotResponse(BaseModel):
    """Response for available time slots"""
    date: str  # ISO date string
    time: str  # Format: "HH:MM"
    datetime: str  # ISO datetime string
    available: bool

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str  # user_id for 1-1 chats
    sender_id: str
    sender_name: str
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

# ================== REQUEST/RESPONSE MODELS ==================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[dict] = None
    recaptcha_token: Optional[str] = None  # reCAPTCHA v3 token

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

class LoginResponse(BaseModel):
    session_token: str
    user: dict

class SessionDataRequest(BaseModel):
    session_id: str

# ================== CLIENT MODULE MODELS ==================

class ClientStatus(str):
    """Client status enum"""
    NEW = "new"
    IN_PROGRESS = "in_progress"
    AWAITING_DOCS = "awaiting_docs"
    PENDING_SIGNATURE = "pending_signature"
    COMPLETED = "completed"
    PAYMENT_DUE = "payment_due"

class ClientType(str):
    """Client type enum"""
    INDIVIDUAL = "individual"
    BUSINESS = "business"

class TimelineStep(BaseModel):
    step: str
    status: Literal["done", "pending"]
    date: Optional[datetime] = None

class ClientUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    profile_picture: Optional[str] = None  # base64 encoded image

class RequestDocumentsRequest(BaseModel):
    document_types: List[str]
    message: Optional[str] = None
    send_whatsapp: bool = False
    send_email: bool = True

class WhatsAppLogRequest(BaseModel):
    message: str
    direction: Literal["outgoing", "incoming"] = "outgoing"

class ClientNoteRequest(BaseModel):
    content: str
    category: Optional[str] = "general"

class LegalDocument(BaseModel):
    type: Literal["terms", "privacy"]
    content: str
    version: str
    is_published: bool = False
    effective_date: Optional[datetime] = None


