"""
Payment and Subscription Models for Stripe Integration
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class BillingInterval(str, Enum):
    """Billing interval options"""
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class SubscriptionStatus(str, Enum):
    """Subscription status"""
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    TRIALING = "trialing"
    INCOMPLETE = "incomplete"

class PaymentStatus(str, Enum):
    """Payment status"""
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"

class PricingPlan(BaseModel):
    """Pricing plan model"""
    id: str
    name: str
    description: str
    price: float  # Price in dollars
    interval: BillingInterval
    stripe_price_id: Optional[str] = None  # Stripe Price ID
    stripe_product_id: Optional[str] = None  # Stripe Product ID
    apple_product_id: Optional[str] = None  # Apple In-App Purchase Product ID
    features: List[str] = []
    is_active: bool = True
    is_popular: bool = False
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CustomerSubscription(BaseModel):
    """Customer subscription model"""
    id: str
    user_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentMethod(BaseModel):
    """Saved payment method"""
    id: str
    user_id: str
    stripe_payment_method_id: Optional[str] = None  # Opcional para ACH
    type: str  # card, bank_account, etc.
    last4: str
    brand: Optional[str] = None  # visa, mastercard, etc.
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool = False
    billing_address_encrypted: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaymentHistory(BaseModel):
    """Payment transaction history"""
    id: str
    user_id: str
    subscription_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    stripe_invoice_id: Optional[str] = None
    amount: float
    currency: str = "usd"
    status: PaymentStatus
    description: str
    payment_method_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_message: Optional[str] = None

# Request/Response Models
class CreateSubscriptionRequest(BaseModel):
    """Request to create a subscription"""
    plan_id: str
    payment_method_id: Optional[str] = None

class UpdateSubscriptionRequest(BaseModel):
    """Request to update a subscription"""
    plan_id: Optional[str] = None
    cancel_at_period_end: Optional[bool] = None

class CreatePaymentMethodRequest(BaseModel):
    """Request to add a payment method"""
    stripe_token: Optional[str] = None  # Stripe token from frontend (production)
    # For demo/testing - card details (should use Stripe.js in production)
    card_number: Optional[str] = None
    card_name: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    cvv: Optional[str] = None
    billing_address: Optional[dict] = None  # Address for auto-fill feature
    set_as_default: bool = False

class ManualPaymentMethod(BaseModel):
    """Manual payment method with full encrypted data"""
    id: str
    user_id: str
    encrypted_card_number: str  # AES-256 encrypted
    encrypted_cvv: str  # AES-256 encrypted
    cardholder_name: str
    last4: str  # Last 4 digits (not encrypted for display)
    brand: str  # visa, mastercard, etc.
    exp_month: int
    exp_year: int
    billing_address: Optional[dict] = None
    is_default: bool = False
    user_consent: bool = True  # Consent to store data
    consent_date: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_accessed: Optional[datetime] = None
    access_log: List[dict] = []  # Track who accessed the data

class CreateManualPaymentMethodRequest(BaseModel):
    """Request to add a manual payment method with full data"""
    card_number: str
    cvv: str
    cardholder_name: str
    exp_month: int
    exp_year: int
    billing_address: Optional[dict] = None
    user_consent: bool
    set_as_default: bool = False

class CreatePlanRequest(BaseModel):
    """Admin request to create a pricing plan"""
    name: str
    description: str
    price: float
    interval: BillingInterval
    features: List[str] = []
    is_active: bool = True

class UpdatePlanRequest(BaseModel):
    """Admin request to update a pricing plan"""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
