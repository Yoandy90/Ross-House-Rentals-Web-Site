from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AffiliateLink(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    service_name: str = Field(..., description="Name of the service (e.g., Yendo)")
    service_type: str = Field(..., description="Type of service (e.g., credit_card)")
    affiliate_url: str = Field(..., description="Affiliate URL")
    description_es: str = Field(..., description="Spanish description")
    description_en: str = Field(..., description="English description")
    benefits_es: list[str] = Field(default=[], description="Benefits in Spanish")
    benefits_en: list[str] = Field(default=[], description="Benefits in English")
    button_text_es: str = Field(default="Aplicar ahora", description="Button text in Spanish")
    button_text_en: str = Field(default="Apply now", description="Button text in English")
    is_active: bool = Field(default=True, description="Whether the link is active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_schema_extra = {
            "example": {
                "service_name": "Yendo",
                "service_type": "credit_card",
                "affiliate_url": "https://apply.yendo.com/?ref=ROSS",
                "description_es": "Yendo es la tarjeta de crédito respaldada por tu vehículo...",
                "description_en": "Yendo is the credit card powered by your car...",
                "benefits_es": ["Hasta $10,000 en crédito", "1.5% cashback ilimitado"],
                "benefits_en": ["Up to $10,000 in credit", "Unlimited 1.5% cashback"],
                "is_active": True
            }
        }


class AffiliateUpdateRequest(BaseModel):
    service_name: Optional[str] = None
    affiliate_url: Optional[str] = None
    description_es: Optional[str] = None
    description_en: Optional[str] = None
    benefits_es: Optional[list[str]] = None
    benefits_en: Optional[list[str]] = None
    button_text_es: Optional[str] = None
    button_text_en: Optional[str] = None
    is_active: Optional[bool] = None
