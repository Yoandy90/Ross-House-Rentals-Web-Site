"""
Modelos de datos para el Tax Wizard
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============== ENUMS ==============

class ServiceLevel(str, Enum):
    """Niveles de servicio disponibles"""
    FULL_SERVICE = "full_service"      # Ross Tax hace todo
    ASSISTED = "assisted"               # Cliente llena, Ross revisa
    DIY = "diy"                         # Hazlo con Ross Tax


class FilingStatus(str, Enum):
    """Estado civil para declaración"""
    SINGLE = "single"
    MARRIED_JOINT = "married_filing_jointly"
    MARRIED_SEPARATE = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    WIDOW = "qualifying_widow"


class CaseComplexity(str, Enum):
    """Complejidad del caso"""
    SIMPLE = "simple"       # W-2 básico, pocos dependientes
    MEDIUM = "medium"       # W-2 + dependientes + créditos
    COMPLEX = "complex"     # Self-employed, múltiples 1099, negocio


class WizardStatus(str, Enum):
    """Estado del wizard"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DOCUMENTS_PENDING = "documents_pending"
    UNDER_REVIEW = "under_review"
    READY_FOR_SIGNATURE = "ready_for_signature"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    NEEDS_ATTENTION = "needs_attention"


class WizardStep(str, Enum):
    """Pasos del wizard"""
    SERVICE_SELECTION = "service_selection"
    PERSONAL_INFO = "personal_info"
    FILING_STATUS = "filing_status"
    INCOME = "income"
    DEPENDENTS = "dependents"
    DEDUCTIONS = "deductions"
    REVIEW = "review"
    DOCUMENTS = "documents"
    RECOMMENDATION = "recommendation"
    PAYMENT = "payment"
    COMPLETE = "complete"


# ============== SUB-MODELS ==============

class PersonalInfo(BaseModel):
    """Información personal del contribuyente"""
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    ssn_last_four: Optional[str] = None  # Solo últimos 4 dígitos para seguridad
    ssn_encrypted: Optional[str] = None  # SSN encriptado completo
    has_itin: bool = False
    itin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_language: str = "es"


class SpouseInfo(BaseModel):
    """Información del cónyuge (si aplica)"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    ssn_last_four: Optional[str] = None
    ssn_encrypted: Optional[str] = None
    has_itin: bool = False


class Dependent(BaseModel):
    """Información de un dependiente"""
    id: Optional[str] = None
    first_name: str
    last_name: str
    date_of_birth: str
    relationship: str  # child, parent, sibling, other
    ssn_last_four: Optional[str] = None
    lived_with_you: bool = True
    months_lived: int = 12
    claimed_before: bool = False
    is_student: bool = False
    is_disabled: bool = False
    provides_own_support: bool = False


class IncomeSource(BaseModel):
    """Fuente de ingreso"""
    type: str  # w2, 1099_nec, 1099_misc, 1099_g, self_employment, other
    employer_name: Optional[str] = None
    ein: Optional[str] = None
    amount: float = 0
    federal_withheld: float = 0
    state_withheld: float = 0
    document_uploaded: bool = False
    document_id: Optional[str] = None


class IncomeInfo(BaseModel):
    """Información de ingresos"""
    has_w2: bool = False
    w2_count: int = 0
    w2_sources: List[IncomeSource] = []
    
    has_1099: bool = False
    form_1099_types: List[str] = []  # nec, misc, int, div, g, etc.
    form_1099_sources: List[IncomeSource] = []
    
    has_self_employment: bool = False
    self_employment_type: Optional[str] = None
    self_employment_income: float = 0
    self_employment_expenses: float = 0
    
    has_unemployment: bool = False
    unemployment_amount: float = 0
    
    has_other_income: bool = False
    other_income_description: Optional[str] = None
    other_income_amount: float = 0
    
    total_income: float = 0
    total_withheld: float = 0


class DeductionsCredits(BaseModel):
    """Deducciones y créditos"""
    # Child Tax Credit
    eligible_for_ctc: bool = False
    ctc_qualifying_children: int = 0
    
    # Earned Income Credit
    eligible_for_eic: bool = False
    
    # Education Credits
    has_education_expenses: bool = False
    education_expenses: float = 0
    education_institution: Optional[str] = None
    
    # Child Care
    has_childcare_expenses: bool = False
    childcare_expenses: float = 0
    childcare_provider: Optional[str] = None
    
    # Health Insurance
    had_health_insurance: bool = True
    health_insurance_type: Optional[str] = None  # employer, marketplace, medicaid, none
    
    # Itemized Deductions
    wants_itemize: bool = False
    mortgage_interest: float = 0
    property_taxes: float = 0
    charitable_donations: float = 0
    medical_expenses: float = 0
    state_local_taxes: float = 0
    
    # Other
    has_student_loan_interest: bool = False
    student_loan_interest: float = 0
    
    has_retirement_contributions: bool = False
    retirement_contributions: float = 0
    retirement_account_type: Optional[str] = None  # 401k, ira, roth


class ReviewQuestions(BaseModel):
    """Preguntas de revisión final"""
    filed_last_year: bool = False
    filed_with_ross_tax: bool = False
    major_life_changes: bool = False
    life_changes_description: Optional[str] = None
    has_pending_documents: bool = False
    pending_documents_list: List[str] = []
    wants_professional_review: bool = False
    additional_notes: Optional[str] = None


class RefundEstimate(BaseModel):
    """Estimación de reembolso"""
    total_income: float = 0
    total_adjustments: float = 0
    adjusted_gross_income: float = 0
    standard_deduction: float = 0
    itemized_deduction: float = 0
    deduction_used: str = "standard"
    taxable_income: float = 0
    estimated_tax: float = 0
    total_credits: float = 0
    total_withheld: float = 0
    estimated_refund: float = 0
    is_refund: bool = True
    confidence_level: str = "estimate"  # estimate, calculated, reviewed


# ============== MAIN MODEL ==============

class TaxWizardSession(BaseModel):
    """Sesión completa del Tax Wizard"""
    # Identificadores
    id: Optional[str] = None
    user_id: str
    tax_year: int = 2025
    
    # Estado
    service_level: Optional[ServiceLevel] = None
    current_step: WizardStep = WizardStep.SERVICE_SELECTION
    status: WizardStatus = WizardStatus.NOT_STARTED
    case_complexity: Optional[CaseComplexity] = None
    progress_percentage: int = 0
    
    # Datos del wizard
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    filing_status: Optional[FilingStatus] = None
    spouse_info: Optional[SpouseInfo] = None
    dependents: List[Dependent] = []
    income: IncomeInfo = Field(default_factory=IncomeInfo)
    deductions_credits: DeductionsCredits = Field(default_factory=DeductionsCredits)
    review: ReviewQuestions = Field(default_factory=ReviewQuestions)
    
    # Estimaciones
    refund_estimate: Optional[RefundEstimate] = None
    
    # Documentos
    documents_required: List[str] = []
    documents_uploaded: List[str] = []
    documents_missing: List[str] = []
    
    # Servicio recomendado
    recommended_service: Optional[ServiceLevel] = None
    recommended_reason: Optional[str] = None
    
    # Precios
    base_price: float = 0
    additional_fees: float = 0
    total_price: float = 0
    price_breakdown: Dict[str, float] = {}
    
    # Pago
    payment_status: str = "pending"  # pending, paid, partial
    payment_id: Optional[str] = None
    
    # Cita
    appointment_required: bool = False
    appointment_id: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    last_step_completed: Optional[WizardStep] = None
    steps_completed: List[str] = []
    
    # Notas admin
    admin_notes: Optional[str] = None
    assigned_preparer: Optional[str] = None


# ============== REQUEST/RESPONSE MODELS ==============

class StartWizardRequest(BaseModel):
    """Iniciar nuevo wizard"""
    tax_year: int = 2025
    service_level: Optional[ServiceLevel] = None


class UpdateWizardStepRequest(BaseModel):
    """Actualizar un paso del wizard"""
    step: WizardStep
    data: Dict[str, Any]


class WizardProgressResponse(BaseModel):
    """Respuesta de progreso del wizard"""
    session_id: str
    current_step: WizardStep
    progress_percentage: int
    steps_completed: List[str]
    next_step: Optional[WizardStep] = None
    refund_estimate: Optional[float] = None
    status: WizardStatus


class ServiceRecommendation(BaseModel):
    """Recomendación de servicio"""
    recommended_service: ServiceLevel
    reason: str
    reason_es: str
    case_complexity: CaseComplexity
    price: float
    price_range: str
    estimated_time: str
    features: List[str]
    next_steps: List[str]
