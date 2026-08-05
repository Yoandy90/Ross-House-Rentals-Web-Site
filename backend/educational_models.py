"""
Educational Content Models
Modelos de datos para contenido educativo
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class EducationalCategory(BaseModel):
    """Categoría de contenido educativo"""
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

class EducationalArticle(BaseModel):
    """Artículo educativo"""
    id: str
    category_id: str
    title: str
    title_es: str
    content: str
    content_es: str
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    level: str  # beginner, intermediate, advanced
    tags: List[str] = []
    featured_image: Optional[str] = None
    estimated_read_time: int = 5  # minutes
    views: int = 0
    likes: int = 0
    bookmarks: int = 0
    active: bool = True
    published_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class EducationalCategoryCreateRequest(BaseModel):
    """Request para crear categoría educativa"""
    name: str
    name_es: str
    description: Optional[str] = None
    description_es: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0
    active: bool = True

class EducationalCategoryUpdateRequest(BaseModel):
    """Request para actualizar categoría"""
    name: Optional[str] = None
    name_es: Optional[str] = None
    description: Optional[str] = None
    description_es: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None

class EducationalArticleCreateRequest(BaseModel):
    """Request para crear artículo educativo"""
    category_id: str
    title: str
    title_es: str
    content: str
    content_es: str
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    level: str = "beginner"  # beginner, intermediate, advanced
    tags: List[str] = []
    featured_image: Optional[str] = None
    estimated_read_time: int = 5
    active: bool = True
    publish_now: bool = True

class EducationalArticleUpdateRequest(BaseModel):
    """Request para actualizar artículo"""
    category_id: Optional[str] = None
    title: Optional[str] = None
    title_es: Optional[str] = None
    content: Optional[str] = None
    content_es: Optional[str] = None
    summary: Optional[str] = None
    summary_es: Optional[str] = None
    level: Optional[str] = None
    tags: Optional[List[str]] = None
    featured_image: Optional[str] = None
    estimated_read_time: Optional[int] = None
    active: Optional[bool] = None

class EducationalSearchRequest(BaseModel):
    """Request para búsqueda de contenido"""
    query: str
    category_id: Optional[str] = None
    level: Optional[str] = None
    language: str = "en"
    limit: int = 10

class ArticleActionRequest(BaseModel):
    """Request para acciones en artículos (like, bookmark)"""
    article_id: str
    user_id: str
    action: str  # like, bookmark, complete
