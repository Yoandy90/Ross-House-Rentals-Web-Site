"""
User Contacts Models - Sistema de contactos guardados
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserContactCreate(BaseModel):
    """Modelo para crear un contacto"""
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    relationship: Optional[str] = Field(None, max_length=100)

class UserContactUpdate(BaseModel):
    """Modelo para actualizar un contacto"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    relationship: Optional[str] = Field(None, max_length=100)

class UserContactResponse(BaseModel):
    """Modelo de respuesta de contacto"""
    id: str
    user_id: str
    name: str
    phone: Optional[str]
    email: Optional[str]
    relationship: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
