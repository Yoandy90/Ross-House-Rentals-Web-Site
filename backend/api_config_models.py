"""
API Configuration Models - Para almacenar credenciales de servicios externos
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class APIProvider(str, Enum):
    """Proveedores de API soportados"""
    AUTHORIZE_NET = "authorize_net"
    STRIPE = "stripe"
    SENDGRID = "sendgrid"
    TWILIO = "twilio"

class APIEnvironment(str, Enum):
    """Ambientes de API"""
    PRODUCTION = "production"
    SANDBOX = "sandbox"
    TEST = "test"

class APIConfigCreate(BaseModel):
    """Request para crear/actualizar configuración de API"""
    provider: APIProvider
    environment: APIEnvironment
    is_active: bool = False
    credentials: Dict[str, str]  # Credenciales encriptadas
    metadata: Optional[Dict[str, Any]] = {}

class APIConfigUpdate(BaseModel):
    """Request para actualizar configuración de API"""
    environment: Optional[APIEnvironment] = None
    is_active: Optional[bool] = None
    credentials: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None

class APIConfigResponse(BaseModel):
    """Response de configuración de API"""
    id: str
    provider: APIProvider
    environment: APIEnvironment
    is_active: bool
    credentials_set: bool  # Indica si hay credenciales, pero no las expone
    masked_credentials: Dict[str, str]  # Credenciales enmascaradas para mostrar
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None

class AuthorizeNetCredentials(BaseModel):
    """Credenciales específicas de Authorize.net"""
    api_login_id: str = Field(..., min_length=1, max_length=50)
    transaction_key: str = Field(..., min_length=1, max_length=50)
    signature_key: Optional[str] = None
    public_client_key: Optional[str] = None

class AuthorizeNetConfigRequest(BaseModel):
    """Request para configurar Authorize.net"""
    environment: APIEnvironment
    credentials: AuthorizeNetCredentials
    is_active: bool = False
    
class PaymentGatewayStatus(BaseModel):
    """Estado actual del gateway de pagos"""
    provider: APIProvider
    environment: APIEnvironment
    is_active: bool
    is_configured: bool
    last_transaction_at: Optional[datetime] = None
    total_transactions: int = 0
