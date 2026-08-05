"""
Loan Models - Ross Tax Preparation
Models for loan products, applications, loans, installments, payments
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# ==================== ENUMS ====================

class TermType(str, Enum):
    """Loan term frequency"""
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class InterestMethod(str, Enum):
    """Interest calculation method"""
    PRICE = "price"  # French amortization (fixed installment)
    SIMPLE = "simple"  # Simple interest
    FLAT = "flat"  # Flat rate


class ApplicationStatus(str, Enum):
    """Loan application status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    PENDING_DOCUMENTS = "pending_documents"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LoanStatus(str, Enum):
    """Loan status"""
    PENDING_SIGNATURE = "pending_signature"
    PENDING_DISBURSEMENT = "pending_disbursement"
    ACTIVE = "active"
    PAID_OFF = "paid_off"
    DEFAULTED = "defaulted"
    RESTRUCTURED = "restructured"
    CANCELLED = "cancelled"


class InstallmentStatus(str, Enum):
    """Installment payment status"""
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    WAIVED = "waived"


class PaymentMethod(str, Enum):
    """Payment method"""
    ACH = "ach"
    CARD = "card"
    CASH = "cash"
    TRANSFER = "transfer"
    CHECK = "check"


class PaymentStatus(str, Enum):
    """Payment transaction status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class DocumentType(str, Enum):
    """Document types"""
    ID_FRONT = "id_front"
    ID_BACK = "id_back"
    PROOF_OF_INCOME = "proof_of_income"
    BANK_STATEMENT = "bank_statement"
    PROOF_OF_ADDRESS = "proof_of_address"
    CONTRACT = "contract"
    PROMISSORY_NOTE = "promissory_note"
    OTHER = "other"


# ==================== FEE MODELS ====================

class FeeConfig(BaseModel):
    """Fee configuration (opening, late, etc)"""
    type: str = Field(..., description="percent or fixed")
    value: float = Field(..., description="Fee amount or percentage")


# ==================== LOAN PRODUCT ====================

class LoanProductPolicy(BaseModel):
    """Loan product policies"""
    dti_max: Optional[float] = Field(0.45, description="Max debt-to-income ratio")
    score_min: Optional[int] = Field(600, description="Minimum credit score")
    ltv_max: Optional[float] = Field(None, description="Max loan-to-value")
    required_documents: List[DocumentType] = Field(default_factory=list)


class LoanProduct(BaseModel):
    """Loan product definition"""
    id: str
    name: str
    description: Optional[str] = None
    currency: str = Field(default="USD")
    min_amount: float = Field(..., gt=0)
    max_amount: float = Field(..., gt=0)
    term_type: TermType
    term_count: int = Field(..., gt=0, description="Number of periods")
    apr: float = Field(..., ge=0, le=1, description="Annual percentage rate (0-1)")
    opening_fee: FeeConfig
    late_fee: FeeConfig
    grace_days: int = Field(default=3, ge=0)
    interest_method: InterestMethod = Field(default=InterestMethod.PRICE)
    policy: LoanProductPolicy = Field(default_factory=LoanProductPolicy)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    @validator('max_amount')
    def validate_max_amount(cls, v, values):
        if 'min_amount' in values and v < values['min_amount']:
            raise ValueError('max_amount must be >= min_amount')
        return v


class CreateLoanProductRequest(BaseModel):
    """Request to create loan product"""
    name: str
    description: Optional[str] = None
    currency: str = Field(default="USD")
    min_amount: float = Field(..., gt=0)
    max_amount: float = Field(..., gt=0)
    term_type: TermType
    term_count: int = Field(..., gt=0)
    apr: float = Field(..., ge=0, le=1)
    opening_fee: FeeConfig
    late_fee: FeeConfig
    grace_days: int = Field(default=3, ge=0)
    interest_method: InterestMethod = Field(default=InterestMethod.PRICE)
    policy: Optional[LoanProductPolicy] = None


# ==================== LOAN APPLICATION ====================

class ApplicantContact(BaseModel):
    """Applicant contact information"""
    phone: str
    whatsapp_optin: bool = Field(default=False)
    email: str
    language: str = Field(default="es")


class ApplicantFinancials(BaseModel):
    """Applicant financial information"""
    income_monthly: float = Field(..., gt=0)
    expenses_monthly: float = Field(..., ge=0)
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    employment_years: Optional[int] = None


class LoanApplication(BaseModel):
    """Loan application"""
    id: str
    user_id: str
    product_id: str
    amount: float = Field(..., gt=0)
    term_count: int = Field(..., gt=0)
    status: ApplicationStatus = Field(default=ApplicationStatus.DRAFT)
    
    # Applicant data
    contacts: ApplicantContact
    financials: ApplicantFinancials
    consents: List[str] = Field(default_factory=list)
    
    # Underwriting
    score: Optional[int] = None
    dti: Optional[float] = None
    decision_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None


class CreateLoanApplicationRequest(BaseModel):
    """Request to create loan application"""
    product_id: str
    amount: float = Field(..., gt=0)
    term_count: int = Field(..., gt=0)
    contacts: ApplicantContact
    financials: ApplicantFinancials
    consents: List[str] = Field(default_factory=list)


class ReviewLoanApplicationRequest(BaseModel):
    """Request to review/decide on application"""
    decision: str = Field(..., pattern="^(approve|reject|request_documents)$")
    notes: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None  # e.g., {"max_amount": 1500}


# ==================== LOAN ====================

class Installment(BaseModel):
    """Single loan installment"""
    idx: int = Field(..., ge=1, description="Installment number")
    due_date: date
    amount_due: float = Field(..., gt=0, description="Total payment due")
    interest: float = Field(..., ge=0)
    principal: float = Field(..., gt=0)
    balance_after: float = Field(..., ge=0)
    status: InstallmentStatus = Field(default=InstallmentStatus.PENDING)
    paid_at: Optional[datetime] = None
    paid_amount: float = Field(default=0, ge=0)
    late_fee_accrued: float = Field(default=0, ge=0)


class Loan(BaseModel):
    """Loan contract"""
    id: str
    application_id: str
    user_id: str
    product_id: str
    
    # Terms
    principal: float = Field(..., gt=0)
    apr: float = Field(..., ge=0, le=1)
    term_type: TermType
    term_count: int = Field(..., gt=0)
    opening_fee: float = Field(default=0, ge=0)
    opening_fee_paid: bool = Field(default=False)
    
    # Status
    status: LoanStatus = Field(default=LoanStatus.PENDING_SIGNATURE)
    
    # Schedule
    installments: List[Installment] = Field(default_factory=list)
    first_payment_date: Optional[date] = None
    
    # Tracking
    total_paid: float = Field(default=0, ge=0)
    outstanding_balance: float = Field(default=0, ge=0)
    total_interest_paid: float = Field(default=0, ge=0)
    total_late_fees: float = Field(default=0, ge=0)
    
    # Dates
    signed_at: Optional[datetime] = None
    signed_contract_url: Optional[str] = None
    disbursed_at: Optional[datetime] = None
    disbursement_method: Optional[str] = None
    disbursement_reference: Optional[str] = None
    paid_off_at: Optional[datetime] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateLoanRequest(BaseModel):
    """Request to create loan from approved application"""
    application_id: str
    first_payment_date: date


class SignLoanRequest(BaseModel):
    """Request to sign loan contract"""
    signature: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class DisburseLoanRequest(BaseModel):
    """Request to disburse loan"""
    method: PaymentMethod
    account_id: Optional[str] = None  # Stripe/bank account
    notes: Optional[str] = None


# ==================== PAYMENT ====================

class LoanPayment(BaseModel):
    """Loan payment transaction"""
    id: str
    loan_id: str
    user_id: str
    installment_idx: Optional[int] = None  # Which installment (if specific)
    
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    
    # Gateway details
    provider: Optional[str] = None  # stripe, dwolla, manual
    gateway_reference: Optional[str] = None
    
    # Application
    applied_to_principal: float = Field(default=0, ge=0)
    applied_to_interest: float = Field(default=0, ge=0)
    applied_to_late_fees: float = Field(default=0, ge=0)
    
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class RecordPaymentRequest(BaseModel):
    """Request to record a payment"""
    loan_id: str
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    installment_idx: Optional[int] = None
    gateway_reference: Optional[str] = None
    notes: Optional[str] = None


# ==================== DOCUMENT ====================

class LoanDocument(BaseModel):
    """Loan-related document"""
    id: str
    owner_type: str = Field(..., description="application or loan")
    owner_id: str
    type: DocumentType
    filename: str
    url: str
    size: Optional[int] = None
    checksum: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class UploadDocumentRequest(BaseModel):
    """Request to upload document"""
    type: DocumentType
    filename: str
    content: str  # Base64 encoded


# ==================== AUDIT ====================

class AuditLog(BaseModel):
    """Audit log entry"""
    id: str
    actor_id: str
    actor_email: Optional[str] = None
    entity: str  # loan_product, loan_application, loan, payment
    entity_id: str
    action: str  # created, updated, approved, rejected, etc.
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== DASHBOARD ====================

class LoanMetrics(BaseModel):
    """Loan portfolio metrics"""
    total_applications: int
    pending_review: int
    approved_today: int
    rejected_today: int
    
    active_loans: int
    total_portfolio: float
    total_disbursed: float
    total_collected: float
    
    current_loans: int
    current_balance: float
    
    overdue_loans: int
    overdue_balance: float
    
    par_30: float  # Portfolio at Risk > 30 days
    par_60: float
    par_90: float
    
    avg_loan_size: float
    avg_interest_rate: float
