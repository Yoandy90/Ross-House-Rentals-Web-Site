"""
FAQ Models
Modelos de datos para el sistema de Preguntas Frecuentes
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class FAQCategory(BaseModel):
    """Categoría de FAQ"""
    id: str
    name: str
    name_es: str
    description: Optional[str] = None
    description_es: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0
    active: bool = True
    created_at: datetime
    updated_at: datetime

class FAQ(BaseModel):
    """Pregunta Frecuente"""
    id: str
    category_id: str
    question: str
    question_es: str
    answer: str
    answer_es: str
    tags: List[str] = []
    views: int = 0
    helpful_count: int = 0
    not_helpful_count: int = 0
    order: int = 0
    active: bool = True
    created_by: Optional[str] = None  # admin user_id
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class FAQCreateRequest(BaseModel):
    """Request para crear FAQ"""
    category_id: str
    question: str
    question_es: str
    answer: str
    answer_es: str
    tags: List[str] = []
    order: int = 0
    active: bool = True

class FAQUpdateRequest(BaseModel):
    """Request para actualizar FAQ"""
    category_id: Optional[str] = None
    question: Optional[str] = None
    question_es: Optional[str] = None
    answer: Optional[str] = None
    answer_es: Optional[str] = None
    tags: Optional[List[str]] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class FAQCategoryCreateRequest(BaseModel):
    """Request para crear categoría de FAQ"""
    name: str
    name_es: str
    description: Optional[str] = None
    description_es: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0
    active: bool = True

class FAQCategoryUpdateRequest(BaseModel):
    """Request para actualizar categoría"""
    name: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    description_es: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class FAQSearchRequest(BaseModel):
    """Request para búsqueda de FAQs"""
    query: str
    category_id: Optional[str] = None
    language: str = "en"  # "en" o "es"
    limit: int = 10

class FAQFeedbackRequest(BaseModel):
    """Request para feedback de FAQ"""
    faq_id: str
    helpful: bool  # True = helpful, False = not helpful
