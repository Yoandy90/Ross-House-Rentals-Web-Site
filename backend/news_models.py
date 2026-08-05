"""
Tax News Models
Modelos de datos para noticias fiscales
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TaxNews(BaseModel):
    """Noticia fiscal"""
    id: str
    title: str
    title_es: str
    content: str
    content_es: str
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    impact_level: str  # high, medium, low
    news_type: str  # federal, state, local, general
    tags: List[str] = []
    featured_image: Optional[str] = None
    views: int = 0
    active: bool = True
    published_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class TaxNewsCreateRequest(BaseModel):
    """Request para crear noticia fiscal"""
    title: str
    title_es: str
    content: str
    content_es: str
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    impact_level: str = "medium"  # high, medium, low
    news_type: str = "general"  # federal, state, local, general
    tags: List[str] = []
    featured_image: Optional[str] = None
    active: bool = True
    publish_now: bool = True

class TaxNewsUpdateRequest(BaseModel):
    """Request para actualizar noticia"""
    title: Optional[str] = None
    title_es: Optional[str] = None
    content: Optional[str] = None
    content_es: Optional[str] = None
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    impact_level: Optional[str] = None
    news_type: Optional[str] = None
    tags: Optional[List[str]] = None
    featured_image: Optional[str] = None
    active: Optional[bool] = None

class NewsSearchRequest(BaseModel):
    """Request para búsqueda de noticias"""
    query: str
    impact_level: Optional[str] = None
    news_type: Optional[str] = None
    language: str = "en"
    limit: int = 10
