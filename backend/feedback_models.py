"""
Feedback Models - Sistema de reseñas y feedback post-cita
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class FeedbackStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    APPROVED = "approved"
    PUBLISHED = "published"

class FeedbackSubmit(BaseModel):
    """Modelo para enviar feedback"""
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    publish_to_google: bool = False
    allow_use_name: bool = True
    
class FeedbackResponse(BaseModel):
    """Respuesta de feedback"""
    id: str
    appointment_id: str
    user_id: str
    user_name: str
    rating: int
    comment: Optional[str]
    publish_to_google: bool
    allow_use_name: bool
    status: str
    created_at: datetime
    google_published: bool
    admin_response: Optional[str]
    
class FeedbackStats(BaseModel):
    """Estadísticas de feedback"""
    total_reviews: int
    average_rating: float
    five_star: int
    four_star: int
    three_star: int
    two_star: int
    one_star: int
    response_rate: float
    pending_count: int
