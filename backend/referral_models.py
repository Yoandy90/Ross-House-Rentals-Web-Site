"""
Modelos para el sistema de referidos
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ReferralRewardTier(BaseModel):
    """Nivel de recompensa basado en cantidad de referidos completados"""
    id: Optional[str] = Field(alias="_id", default=None)
    min_referrals: int  # Mínimo de referidos para este nivel (ej: 1)
    max_referrals: int  # Máximo de referidos para este nivel (ej: 10)
    reward_amount_usd: float  # Cantidad en USD por referido (ej: 10.0)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class ReferralCode(BaseModel):
    """Código de referido único por usuario"""
    id: Optional[str] = Field(alias="_id", default=None)
    user_id: str
    code: str  # Código único generado (ej: ROSS-ABC123)
    referral_link: str  # Link completo: https://rosstaxpreparation.com/ref/ABC123
    qr_code_data: Optional[str] = None  # Base64 del QR code
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    total_referrals: int = 0  # Contador de referidos totales
    completed_referrals: int = 0  # Referidos que completaron cita
    pending_referrals: int = 0  # Referidos pendientes
    total_earned_usd: float = 0.0  # Total ganado en USD
    
    class Config:
        populate_by_name = True


class Referral(BaseModel):
    """Relación entre referidor y referido"""
    id: Optional[str] = Field(alias="_id", default=None)
    referrer_user_id: str  # Usuario que refirió
    referred_user_id: Optional[str] = None  # Usuario referido (puede ser None si aún no se registra)
    referred_name: Optional[str] = None  # Nombre del referido
    referred_email: Optional[str] = None  # Email del referido
    referred_phone: Optional[str] = None  # Teléfono del referido
    referral_code_used: str  # Código usado
    appointment_id: Optional[str] = None  # ID de la cita creada
    status: str = "pending"  # pending, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)  # Cuando se creó la cita
    completed_at: Optional[datetime] = None  # Cuando se completó la cita
    reward_given: bool = False
    reward_amount_usd: float = 0.0  # USD dados al referidor
    discount_applied_usd: float = 5.0  # Descuento al referido ($5)
    
    class Config:
        populate_by_name = True


class ValidateReferralCodeRequest(BaseModel):
    """Request para validar código de referido"""
    code: str


class CreateReferralFromAppointmentRequest(BaseModel):
    """Request para crear referido desde formulario de cita"""
    referral_code: str
    name: str
    email: str
    phone: str
    appointment_date: str
    appointment_time: str
    service_type: str


class CompleteReferralRequest(BaseModel):
    """Request para admin completar referido"""
    referral_id: str
    appointment_id: str


class CreateRewardTierRequest(BaseModel):
    """Request para crear nivel de recompensa"""
    min_referrals: int
    max_referrals: int
    reward_amount_usd: float


class UpdateRewardTierRequest(BaseModel):
    """Request para actualizar nivel de recompensa"""
    min_referrals: Optional[int] = None
    max_referrals: Optional[int] = None
    reward_amount_usd: Optional[float] = None
    is_active: Optional[bool] = None


class GetReferralsResponse(BaseModel):
    """Response con lista de referidos"""
    total_referrals: int
    completed_referrals: int
    pending_referrals: int
    referrals: List[dict]
