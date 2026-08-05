"""
Tax Tools Models - Modelos para todas las herramientas fiscales avanzadas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Literal
from datetime import datetime

# ==================== OCR Y EXTRACCIÓN ====================

class OCRDocumentRequest(BaseModel):
    document_id: str
    document_type: Literal['w2', '1099', 'receipt', 'id', 'other']
    
class OCRDataResponse(BaseModel):
    success: bool
    document_type: str
    extracted_data: Dict
    confidence_score: float
    fields_detected: List[str]
    needs_review: bool

# ==================== CALCULADORA DE IMPUESTOS ====================

class TaxCalculationRequest(BaseModel):
    filing_status: Literal['single', 'married_joint', 'married_separate', 'head_of_household', 'widow']
    income: float
    deductions: float = 0
    credits: float = 0
    withholding: float = 0
    state: str = 'FL'
    tax_year: int = 2024
    
class TaxCalculationResponse(BaseModel):
    federal_tax: float
    state_tax: float
    total_tax: float
    effective_rate: float
    refund_or_owed: float
    breakdown: Dict

# ==================== VALIDADOR DE DOCUMENTOS ====================

class DocumentValidationRequest(BaseModel):
    document_id: str
    
class DocumentValidationResponse(BaseModel):
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    missing_fields: List[str]
    compliance_score: int

# ==================== PREDICTOR DE REEMBOLSO ====================

class RefundPredictionRequest(BaseModel):
    user_id: str
    current_year: int
    
class RefundPredictionResponse(BaseModel):
    predicted_refund: float
    confidence: str
    comparison_previous_years: List[Dict]
    factors: List[str]
    recommendations: List[str]

# ==================== ESTADO DE CASO ====================

CaseStatus = Literal[
    'pending_documents',
    'documents_received', 
    'under_review',
    'in_preparation',
    'ready_for_signature',
    'filed',
    'accepted',
    'refund_issued',
    'completed'
]

class CaseStatusUpdate(BaseModel):
    case_id: str
    status: CaseStatus
    notes: Optional[str] = None
    estimated_completion: Optional[str] = None

class CaseTimeline(BaseModel):
    case_id: str
    events: List[Dict]
    current_status: str
    progress_percentage: int

# ==================== FIRMA DIGITAL ====================

class SignatureRequest(BaseModel):
    document_id: str
    signature_data: str  # Base64
    ip_address: str
    device_info: str
    
class SignatureResponse(BaseModel):
    success: bool
    signature_id: str
    timestamp: str
    legal_binding: bool

# ==================== REPORTES ====================

class ReportRequest(BaseModel):
    report_type: Literal['weekly', 'monthly', 'yearly', 'custom']
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    
class ReportResponse(BaseModel):
    report_id: str
    data: Dict
    charts: List[Dict]
    insights: List[str]
    generated_at: str

# ==================== PRIORIZACIÓN ====================

class TaskPriority(BaseModel):
    case_id: str
    priority_score: int
    deadline: str
    urgency_level: Literal['critical', 'high', 'medium', 'low']
    reason: str

# ==================== SERVICIOS ADICIONALES ====================

class ServiceMarketplaceItem(BaseModel):
    id: str
    name: str
    description: str
    price: float
    category: str
    available: bool

class ServicePurchaseRequest(BaseModel):
    service_id: str
    user_id: str
    payment_method: str

# ==================== EDUCACIÓN ====================

class EducationalContent(BaseModel):
    id: str
    title: str
    type: Literal['video', 'article', 'quiz', 'interactive']
    duration_minutes: int
    difficulty: Literal['beginner', 'intermediate', 'advanced']
    topics: List[str]

class QuizAttempt(BaseModel):
    quiz_id: str
    user_id: str
    answers: List[Dict]
    
class QuizResult(BaseModel):
    score: int
    passed: bool
    correct_answers: int
    total_questions: int
    certificate_earned: bool

# ==================== ESCENARIOS FISCALES ====================

class TaxScenarioRequest(BaseModel):
    base_situation: Dict
    scenario_changes: Dict  # ej: {"married": true, "children": 1}
    
class TaxScenarioResponse(BaseModel):
    current_tax: float
    scenario_tax: float
    difference: float
    impact_percentage: float
    recommendations: List[str]
