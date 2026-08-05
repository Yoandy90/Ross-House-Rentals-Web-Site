"""
Credit System Models for Ross Tax Preparation
Sistema de Créditos con Stored Value (Legal, sin licencias MTL)

CONFIGURACIÓN DEL SISTEMA:
- 1 crédito = $1 USD
- Paquetes: $50, $100, $200, $400
- Bonos por paquete: 10%, 15%, 15%, 20%
- Bonus primera compra: 10% adicional
- Sin expiración
- Reembolsos flexibles (créditos o pago original)
- Uso en todos los servicios Ross Tax
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

class TransactionType(str, Enum):
    """Tipos de transacciones de créditos"""
    PURCHASE = "purchase"  # Compra de créditos
    USAGE = "usage"  # Uso de créditos en servicios
    BONUS = "bonus"  # Bonificación (paquete + primera compra)
    REFUND = "refund"  # Reembolso
    ADMIN_ADD = "admin_add"  # Admin añade créditos manualmente
    ADMIN_DEDUCT = "admin_deduct"  # Admin deduce créditos manualmente

class TransactionStatus(str, Enum):
    """Estados de transacción"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentStatus(str, Enum):
    """Estados de pago Stripe"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"

class RefundType(str, Enum):
    """Tipo de reembolso"""
    CREDITS = "credits"  # Reembolso en créditos
    ORIGINAL_PAYMENT = "original_payment"  # Reembolso al método de pago original

class ServiceType(str, Enum):
    """Tipos de servicios pagables con créditos"""
    TAX_RETURN = "tax_return"  # Declaración de impuestos ($180+)
    APPOINTMENT = "appointment"  # Cita/consulta
    DOCUMENT_PROCESSING = "document_processing"  # Procesamiento documentos
    AMENDMENT = "amendment"  # Enmienda
    TAX_CONSULTATION = "tax_consultation"  # Consultoría fiscal
    PRIORITY_SUPPORT = "priority_support"  # Soporte prioritario
    OTHER = "other"

class CreditPackage(BaseModel):
    """Paquetes de créditos disponibles para compra"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # "Paquete Básico", "Paquete Pro", etc.
    description: str
    amount_usd: float  # Precio en USD (50, 100, 200, 400)
    base_credits: float  # Créditos base (50, 100, 200, 400)
    bonus_percentage: float  # % de bonus (10, 15, 15, 20)
    bonus_credits: float  # Créditos bonus calculados
    total_credits: float  # Total = base + bonus (sin contar primera compra)
    is_active: bool = True
    is_featured: bool = False  # Destacado en UI
    sort_order: int = 0  # Orden de visualización
    stripe_product_id: Optional[str] = None
    stripe_price_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreditBalance(BaseModel):
    """Balance de créditos del usuario"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Referencia al usuario
    balance: float = 0.0  # Balance actual en créditos
    lifetime_purchased: float = 0.0  # Total comprado (USD)
    lifetime_earned_credits: float = 0.0  # Total créditos recibidos (compra + bonos)
    lifetime_spent: float = 0.0  # Total gastado en créditos
    lifetime_bonus: float = 0.0  # Total de bonos recibidos
    first_purchase_completed: bool = False  # Si ya hizo primera compra
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_purchase_at: Optional[datetime] = None
    last_usage_at: Optional[datetime] = None

class CreditTransaction(BaseModel):
    """Registro detallado de transacción de créditos"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    transaction_type: TransactionType
    amount: float  # Cantidad de créditos (positivo = recibido, negativo = gastado)
    balance_before: float
    balance_after: float
    status: TransactionStatus = TransactionStatus.PENDING
    
    # Detalles de compra (si transaction_type = PURCHASE o BONUS)
    package_id: Optional[str] = None
    payment_amount_usd: Optional[float] = None
    stripe_payment_intent_id: Optional[str] = None
    stripe_charge_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    is_first_purchase_bonus: bool = False
    
    # Detalles de uso (si transaction_type = USAGE)
    service_type: Optional[ServiceType] = None
    service_id: Optional[str] = None  # ID del servicio relacionado
    service_name: Optional[str] = None
    
    # Detalles de reembolso (si transaction_type = REFUND)
    refund_type: Optional[RefundType] = None
    refunded_transaction_id: Optional[str] = None  # Transaction original que se reembolsa
    stripe_refund_id: Optional[str] = None
    
    # Detalles admin (si transaction_type = ADMIN_ADD o ADMIN_DEDUCT)
    admin_id: Optional[str] = None
    admin_reason: Optional[str] = None
    
    # Metadatos generales
    description: str
    notes: Optional[str] = None
    metadata: Dict[str, Any] = {}
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None

class CreditPurchase(BaseModel):
    """Registro de compra de créditos (con Stripe)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    package_id: str
    package_name: str
    
    # Créditos
    base_credits: float  # Créditos base del paquete
    bonus_credits: float  # Bonus del paquete (%)
    first_purchase_bonus: float = 0.0  # 10% extra si es primera compra
    total_credits: float  # base + bonus + first_purchase_bonus
    
    # Pago
    amount_usd: float  # Precio pagado en USD
    currency: str = "usd"
    
    # Stripe
    stripe_payment_intent_id: str
    stripe_customer_id: Optional[str] = None
    stripe_charge_id: Optional[str] = None
    payment_status: PaymentStatus = PaymentStatus.PENDING
    
    # Flags
    is_first_purchase: bool = False
    is_refunded: bool = False
    refund_amount_usd: Optional[float] = None
    refund_amount_credits: Optional[float] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    
    # Referencias
    transaction_ids: List[str] = []  # IDs de CreditTransaction relacionados


class CreditUsage(BaseModel):
    """Registro de uso de créditos en servicios"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    service_type: ServiceType
    service_id: str
    service_name: str
    service_description: str
    credits_used: float
    
    # Flags
    is_refunded: bool = False
    refunded_credits: Optional[float] = None
    
    # Metadata
    metadata: Dict[str, Any] = {}
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    refunded_at: Optional[datetime] = None
    
    # Referencia
    transaction_id: Optional[str] = None  # Link a CreditTransaction


class CreditRefund(BaseModel):
    """Registro de solicitud de reembolso"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    refund_type: RefundType
    amount: float  # En créditos o USD según refund_type
    reason: str
    
    # Referencias
    purchase_id: Optional[str] = None
    usage_id: Optional[str] = None
    original_transaction_id: Optional[str] = None
    
    # Procesamiento
    status: str = "pending"  # pending, approved, rejected, completed
    requested_by: str  # user_id o admin_id
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Stripe (si refund_type = ORIGINAL_PAYMENT)
    stripe_refund_id: Optional[str] = None
    
    # Timestamps
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    
    # Referencia
    refund_transaction_id: Optional[str] = None  # Link a CreditTransaction del refund


# ================== REQUEST/RESPONSE MODELS ==================

class CreatePackageRequest(BaseModel):
    """Admin request: crear paquete de créditos"""
    name: str
    description: str
    amount_usd: float
    base_credits: float
    bonus_percentage: float
    is_active: bool = True
    is_featured: bool = False
    sort_order: int = 0


class UpdatePackageRequest(BaseModel):
    """Admin request: actualizar paquete de créditos"""
    name: Optional[str] = None
    description: Optional[str] = None
    amount_usd: Optional[float] = None
    base_credits: Optional[float] = None
    bonus_percentage: Optional[float] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


class PurchaseCreditsRequest(BaseModel):
    """Client request: comprar créditos"""
    package_id: str
    payment_method_id: Optional[str] = None  # Stripe payment method ID (required for mobile, not for web checkout)


class CreateCheckoutSessionRequest(BaseModel):
    """Client request: crear sesión de checkout de Stripe"""
    package_id: str
    custom_amount: Optional[float] = None  # For custom amounts (monto personalizado)


class UseCreditsRequest(BaseModel):
    """Request: usar créditos en un servicio"""
    service_type: ServiceType
    service_id: str
    service_name: str
    service_description: str
    credits_to_use: float
    metadata: Dict[str, Any] = {}


class UseCreditsForServiceRequest(BaseModel):
    """Request: usar créditos para un servicio con precio configurado"""
    service_price_id: str  # ID del servicio en service_prices (ej: 'tax_return_standard')
    service_instance_id: str  # ID de la instancia del servicio (ej: tax_return_id)
    metadata: Dict[str, Any] = {}


class RequestRefundRequest(BaseModel):
    """Client request: solicitar reembolso"""
    purchase_id: Optional[str] = None
    usage_id: Optional[str] = None
    refund_type: RefundType
    reason: str


class ProcessRefundRequest(BaseModel):
    """Admin request: procesar solicitud de reembolso"""
    refund_id: str
    action: str  # "approve" o "reject"
    rejection_reason: Optional[str] = None


class AdminCreditAdjustmentRequest(BaseModel):
    """Admin request: ajustar créditos manualmente"""
    user_id: str
    amount: float  # Positivo para añadir, negativo para quitar
    reason: str
    notes: Optional[str] = None


class CreditBalanceResponse(BaseModel):
    """Response: balance de créditos del usuario"""
    user_id: str
    balance: float
    lifetime_purchased: float
    lifetime_earned_credits: float
    lifetime_spent: float
    lifetime_bonus: float
    first_purchase_completed: bool
    last_purchase_at: Optional[datetime] = None
    last_usage_at: Optional[datetime] = None


class CreditHistoryResponse(BaseModel):
    """Response: historial de transacciones de créditos"""
    transactions: List[CreditTransaction]
    total_count: int
    current_balance: float
    page: int = 1
    per_page: int = 50


class CreditStatistics(BaseModel):
    """Estadísticas del sistema de créditos (Admin)"""
    total_balance_all_users: float
    total_purchased_usd: float
    total_credits_sold: float
    total_credits_used: float
    total_bonus_given: float
    active_users_with_balance: int
    total_transactions: int
    revenue_this_month: float
    revenue_lifetime: float
    average_balance_per_user: float
    top_purchasers: List[Dict[str, Any]]
    popular_services: List[Dict[str, Any]]


class UpdateCreditPreferencesRequest(BaseModel):
    """Request to update user credit preferences"""
    low_balance_threshold: Optional[int] = Field(None, ge=10, le=500, description="Threshold for low balance alert (10-500 credits)")
    email_notifications: Optional[bool] = Field(None, description="Enable/disable email notifications for credits")
    push_notifications: Optional[bool] = Field(None, description="Enable/disable push notifications for credits")
