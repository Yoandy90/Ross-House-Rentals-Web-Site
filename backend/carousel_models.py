"""
Carousel Banner Models - Sistema de gestión de carruseles
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CarouselBanner(BaseModel):
    """Modelo de banner del carrusel"""
    id: str
    title: str = Field(..., min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    gradient_colors: list[str] = Field(default=["#6C1110", "#ED201D"])  # Array de colores hex
    icon: str = Field(default="gift-outline")  # Nombre del ícono de Ionicons
    button_text: Optional[str] = Field(None, max_length=50)
    button_action: Optional[str] = None  # URL o ruta de navegación
    order: int = Field(default=0, ge=0)  # Orden de visualización
    is_active: bool = Field(default=True)  # Mostrar u ocultar
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "banner_123",
                "title": "Programa de Referidos",
                "subtitle": "¡Gana hasta $500!",
                "description": "Refiere amigos y gana recompensas en efectivo",
                "gradient_colors": ["#7C3AED", "#EC4899"],
                "icon": "gift-outline",
                "button_text": "Empezar Ahora",
                "button_action": "/referrals",
                "order": 0,
                "is_active": True
            }
        }


class CreateCarouselBannerRequest(BaseModel):
    """Request para crear un banner"""
    title: str = Field(..., min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    gradient_colors: list[str] = Field(default=["#6C1110", "#ED201D"])
    icon: str = Field(default="gift-outline")
    button_text: Optional[str] = Field(None, max_length=50)
    button_action: Optional[str] = None
    order: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)


class UpdateCarouselBannerRequest(BaseModel):
    """Request para actualizar un banner"""
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    gradient_colors: Optional[list[str]] = None
    icon: Optional[str] = None
    button_text: Optional[str] = Field(None, max_length=50)
    button_action: Optional[str] = None
    order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CarouselBannerResponse(BaseModel):
    """Response con información de banner"""
    success: bool
    message: str
    banner: Optional[CarouselBanner] = None
    error: Optional[str] = None


class CarouselBannersListResponse(BaseModel):
    """Response con lista de banners"""
    success: bool
    banners: list[CarouselBanner]
    total: int
