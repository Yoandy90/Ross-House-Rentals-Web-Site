"""
ACH Payment Models - MongoDB Models for Authorize.net Integration
Ross Tax Preparation
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal, Dict, Any
from datetime import datetime
from enum import Enum

# Enums
class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"

class SignatureType(str, Enum):
    DRAW = "draw"
    TYPED = "typed"
    CHECKBOX_TYPED = "checkbox_typed"

class AuthorizationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SETTLED = "settled"
    FAILED = "failed"
    VOID = "void"

class EventType(str, Enum):
    FORM_VIEW = "FORM_VIEW"
    FORM_SUBMIT = "FORM_SUBMIT"
    SIGNATURE_CAPTURED = "SIGNATURE_CAPTURED"
    PAYMENT_REQUESTED = "PAYMENT_REQUESTED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_SETTLED = "PAYMENT_SETTLED"
    PAYMENT_VOID = "PAYMENT_VOID"
    PDF_GENERATED = "PDF_GENERATED"
    EMAIL_SENT = "EMAIL_SENT"

# Request Models
class ACHPaymentRequest(BaseModel):
    """Request para iniciar un pago ACH"""
    customer_id: str = Field(..., description="ID del cliente en MongoDB")
    invoice_id: Optional[str] = Field(None, description="ID de factura relacionada")
    amount_cents: int = Field(..., ge=0, description="Monto en centavos (USD) - 0 para solo guardar método de pago")
    
    # Información bancaria
    routing_number: str = Field(..., min_length=9, max_length=9, description="Routing number (9 dígitos)")
    account_number: str = Field(..., min_length=4, max_length=17, description="Número de cuenta bancaria")
    account_type: AccountType = Field(..., description="Tipo de cuenta: checking o savings")
    
    # Información del cliente
    customer_name: str = Field(..., min_length=2, description="Nombre completo del cliente")
    customer_email: str = Field(..., description="Email del cliente")
    
    # Firma electrónica
    signature_type: SignatureType = Field(..., description="Tipo de firma electrónica")
    signature_data: str = Field(..., description="Datos de la firma (base64 para draw, texto para typed)")
    
    # Metadata de autorización
    ip_address: str = Field(..., description="IP del dispositivo del cliente")
    user_agent: str = Field(..., description="User agent del navegador")
    
    # Aceptación de términos
    terms_accepted: bool = Field(..., description="Cliente aceptó términos NACHA")
    authorization_version: str = Field(default="v1.0-es", description="Versión del texto NACHA")
    
    @validator('routing_number')
    def validate_routing(cls, v):
        if not v.isdigit():
            raise ValueError('Routing number debe contener solo dígitos')
        return v
    
    @validator('account_number')
    def validate_account(cls, v):
        if not v.isdigit():
            raise ValueError('Account number debe contener solo dígitos')
        return v
    
    @validator('terms_accepted')
    def validate_terms(cls, v):
        if not v:
            raise ValueError('Cliente debe aceptar términos NACHA')
        return v

class ACHTransactionStatusRequest(BaseModel):
    """Request para verificar el estado de una transacción"""
    authorization_id: str = Field(..., description="ID de la autorización ACH")

# Response Models
class ACHAuthorizationResponse(BaseModel):
    """Respuesta con detalles de una autorización ACH"""
    id: str
    customer_id: str
    invoice_id: Optional[str]
    
    amount_cents: int
    currency: str
    
    routing_last4: str
    account_last4: str
    account_type: str
    
    authorization_text_hash: str
    authorization_version: str
    
    ip_address: str
    signature_type: str
    signed_at: datetime
    
    evidence_pdf_path: Optional[str]
    
    authnet_transaction_id: Optional[str]
    authnet_response_code: Optional[str]
    authnet_response_text: Optional[str]
    
    status: str
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ACHPaymentResponse(BaseModel):
    """Respuesta al iniciar un pago ACH"""
    success: bool
    message: str
    authorization_id: Optional[str] = None
    transaction_id: Optional[str] = None
    status: Optional[str] = None
    authorization_details: Optional[ACHAuthorizationResponse] = None
    error_code: Optional[str] = None
    amount_cents: Optional[int] = None
    pdf_url: Optional[str] = None

class ACHEventCreate(BaseModel):
    """Modelo para crear un evento de auditoría"""
    authorization_id: str
    event_type: EventType
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ACHEventResponse(BaseModel):
    """Respuesta con detalles de un evento"""
    id: str
    authorization_id: str
    event_type: str
    event_timestamp: datetime
    ip_address: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Database Models (MongoDB Documents)
class ACHAuthorizationDocument(BaseModel):
    """Documento MongoDB para autorizaciones ACH"""
    customer_id: str
    invoice_id: Optional[str] = None
    
    # Información financiera
    amount_cents: int
    currency: str = "USD"
    
    # Información bancaria (solo últimos 4 dígitos)
    routing_last4: str
    account_last4: str
    account_type: str
    
    # Autorización NACHA
    authorization_text_hash: str
    authorization_version: str
    
    # Datos de auditoría
    ip_address: str
    user_agent: str
    
    # Firma electrónica
    signature_type: str
    signature_data: str  # Encriptado
    signed_at: datetime
    
    # PDF de evidencia
    evidence_pdf_path: Optional[str] = None
    
    # Integración con Authorize.net
    authnet_transaction_id: Optional[str] = None
    authnet_response_code: Optional[str] = None
    authnet_response_text: Optional[str] = None
    
    # Estado
    status: str = "pending"
    
    # Metadata
    raw_payload: Optional[Dict[str, Any]] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ACHEventDocument(BaseModel):
    """Documento MongoDB para eventos de auditoría"""
    authorization_id: str
    event_type: str
    event_timestamp: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NACHAVersionDocument(BaseModel):
    """Documento MongoDB para versiones del texto NACHA"""
    version: str
    language_code: str = "es"
    authorization_text: str
    text_hash: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
