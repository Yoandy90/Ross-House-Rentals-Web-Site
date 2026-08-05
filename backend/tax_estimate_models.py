"""
Tax Estimate Models - Modelos para estimados de impuestos generados por clientes
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Literal
from datetime import datetime, timezone
import uuid

class TaxEstimateRequest(BaseModel):
    """Request para crear un nuevo estimado de impuestos"""
    # Datos fiscales
    tax_year: int
    filing_status: Literal['single', 'married_joint', 'married_separate', 'head_of_household', 'widow']
    annual_income: float
    deductions: float = 0
    credits: float = 0
    withholding: float = 0
    state: str = 'FL'
    
    # Nuevos campos avanzados
    num_children_under_17: int = 0
    num_children_17_plus: int = 0
    self_employment_income: float = 0
    investment_income: float = 0
    
    # Notas adicionales del cliente
    notes: Optional[str] = None
    wants_office_appointment: bool = False

class TaxEstimate(BaseModel):
    """Modelo completo de un estimado de impuestos"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    
    # Información del cliente (copiada del perfil/KYC)
    client_name: str
    client_email: str
    client_phone: str
    client_address: Optional[str] = None
    
    # Datos fiscales ingresados
    tax_year: int
    filing_status: str
    annual_income: float
    deductions: float
    credits: float
    withholding: float
    state: str
    
    # Resultados del cálculo
    calculation_results: Dict  # Guarda todo el resultado de calculate_taxes
    estimated_refund: float  # refund_or_owed del cálculo
    estimated_tax: float  # total_tax del cálculo
    effective_rate: float
    
    # Estado y seguimiento
    status: Literal['pending_review', 'reviewed', 'contacted', 'appointment_scheduled', 'converted_to_case', 'archived'] = 'pending_review'
    admin_notes: Optional[str] = None
    client_notes: Optional[str] = None
    wants_office_appointment: bool = False
    
    # Auditoría
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # admin user_id
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

class TaxEstimateResponse(BaseModel):
    """Response al crear un estimado"""
    success: bool
    estimate_id: str
    calculation_results: Dict
    message: str

class TaxEstimateStatusUpdate(BaseModel):
    """Request para actualizar status de un estimado"""
    estimate_id: str
    status: Literal['pending_review', 'reviewed', 'contacted', 'appointment_scheduled', 'converted_to_case', 'archived']
    admin_notes: Optional[str] = None

class TaxEstimateListItem(BaseModel):
    """Item resumido para lista de estimados"""
    id: str
    client_name: str
    client_email: str
    tax_year: int
    filing_status: str
    annual_income: float
    estimated_refund: float
    status: str
    wants_office_appointment: bool
    created_at: datetime
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
