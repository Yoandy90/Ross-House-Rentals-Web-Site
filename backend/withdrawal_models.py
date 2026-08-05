"""
Withdrawal Models - Sistema de retiros con verificación bancaria Stripe/Plaid
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum

# ============================================================================
# ENUMS
# ============================================================================

class WithdrawalStatus(str, Enum):
    """Estados de solicitud de retiro"""
    PENDING = "pending"              # Pendiente de aprobación
    PROCESSING = "processing"        # En proceso de pago
    COMPLETED = "completed"          # Completado y pagado
    REJECTED = "rejected"            # Rechazado por admin
    CANCELLED = "cancelled"          # Cancelado por usuario


class BankAccountStatus(str, Enum):
    """Estados de cuenta bancaria"""
    PENDING_VERIFICATION = "pending_verification"    # Pendiente de verificación
    VERIFIED = "verified"                            # Verificada con Plaid/Stripe
    FAILED = "failed"                                # Falló verificación
    ACTIVE = "active"                                # Activa y lista para usar


# ============================================================================
# DATABASE MODELS (MongoDB Documents)
# ============================================================================

class BankAccount(BaseModel):
    """
    Cuenta bancaria del usuario (encriptada y verificada con Stripe/Plaid)
    Collection: bank_accounts
    """
    user_id: str
    
    # Stripe Integration
    stripe_bank_account_token: Optional[str] = None  # Token de Stripe para la cuenta
    stripe_customer_id: Optional[str] = None         # Customer ID de Stripe
    plaid_access_token: Optional[str] = None         # Token de Plaid (encriptado)
    
    # Bank Account Info (encriptado en DB)
    bank_name: Optional[str] = None
    account_holder_name: str
    last_four: str                                    # Últimos 4 dígitos (visible)
    account_type: Literal["checking", "savings"] = "checking"
    
    # Verification
    status: BankAccountStatus = BankAccountStatus.PENDING_VERIFICATION
    verified_at: Optional[datetime] = None
    verification_method: Optional[Literal["plaid", "micro_deposits"]] = None
    
    # Metadata
    is_default: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WithdrawalRequest(BaseModel):
    """
    Solicitud de retiro de créditos a cuenta bancaria
    Collection: withdrawal_requests
    """
    user_id: str
    bank_account_id: str                             # Referencia a bank_accounts
    
    # Amounts
    amount_credits: float                            # Créditos a retirar
    amount_usd: float                                # USD equivalente (1:1)
    fee_amount: float = 0.0                          # Fee de procesamiento (si aplica)
    net_amount: float                                # Monto neto a recibir
    
    # Status & Processing
    status: WithdrawalStatus = WithdrawalStatus.PENDING
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Admin Actions
    processed_by_admin_id: Optional[str] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Stripe Payment
    stripe_payout_id: Optional[str] = None           # ID del payout en Stripe
    stripe_transfer_id: Optional[str] = None         # ID de transferencia ACH
    
    # User Info (for admin view)
    user_name: Optional[str] = None
    user_email: Optional[str] = None


# ============================================================================
# REQUEST MODELS (API Input)
# ============================================================================

class CreateBankAccountRequest(BaseModel):
    """Request para crear cuenta bancaria con Plaid token"""
    plaid_public_token: str                          # Token público de Plaid
    account_id: str                                  # ID de cuenta seleccionada en Plaid
    account_holder_name: str


class CreateWithdrawalRequest(BaseModel):
    """Request para solicitar retiro"""
    amount: float                                    # Cantidad en créditos a retirar
    bank_account_id: Optional[str] = None            # ID de cuenta (usa default si no se especifica)
    notes: Optional[str] = None                      # Notas del usuario


class ProcessWithdrawalRequest(BaseModel):
    """Request para procesar retiro (Admin)"""
    status: Literal["completed", "rejected"]
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    stripe_payout_id: Optional[str] = None


# ============================================================================
# RESPONSE MODELS (API Output)
# ============================================================================

class BankAccountResponse(BaseModel):
    """Response con info de cuenta bancaria (segura)"""
    id: str
    bank_name: Optional[str] = None
    account_holder_name: str
    last_four: str
    account_type: str
    status: str
    is_default: bool
    verified_at: Optional[str] = None
    created_at: str


class WithdrawalResponse(BaseModel):
    """Response con info de retiro"""
    id: str
    amount_credits: float
    amount_usd: float
    fee_amount: float
    net_amount: float
    status: str
    requested_at: str
    processed_at: Optional[str] = None
    completed_at: Optional[str] = None
    bank_account_last_four: Optional[str] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class WithdrawalStatsResponse(BaseModel):
    """Estadísticas de retiros (Admin)"""
    total_requests: int
    pending_count: int
    processing_count: int
    completed_count: int
    rejected_count: int
    total_withdrawn_usd: float
    total_fees_collected: float


class PlaidLinkTokenResponse(BaseModel):
    """Response con token para inicializar Plaid Link"""
    link_token: str
    expiration: str
