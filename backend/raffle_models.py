"""
Raffle Models - Sistema de Sorteos
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class RafflePrizeType(str, Enum):
    service = "service"  # Servicio gratis (declaración, consulta)
    credits = "credits"  # Créditos Ross Tax
    discount = "discount"  # Descuento en servicios
    product = "product"  # Producto físico

class RaffleStatus(str, Enum):
    draft = "draft"  # Borrador
    active = "active"  # Activo, aceptando participantes
    full = "full"  # Lleno, max participantes alcanzado
    completed = "completed"  # Sorteo realizado
    cancelled = "cancelled"  # Cancelado

class CreateRaffleRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., min_length=10, max_length=500)
    prize_type: RafflePrizeType
    prize_value: str = Field(..., max_length=200)  # Descripción del premio
    prize_credits: Optional[int] = Field(None, ge=0)  # Si es premio de créditos
    ticket_price: int = Field(..., ge=1, le=100)  # Precio del boleto en créditos
    max_tickets_per_user: Optional[int] = Field(10, ge=1, le=100)
    total_tickets: Optional[int] = Field(None, ge=10, le=10000)  # None = ilimitado
    end_date: datetime
    image_url: Optional[str] = None
    terms: Optional[str] = None

class UpdateRaffleRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=100)
    description: Optional[str] = Field(None, min_length=10, max_length=500)
    prize_value: Optional[str] = None
    end_date: Optional[datetime] = None
    status: Optional[RaffleStatus] = None
    image_url: Optional[str] = None
    terms: Optional[str] = None

class BuyTicketRequest(BaseModel):
    raffle_id: str
    quantity: int = Field(1, ge=1, le=10)

class ExecuteRaffleRequest(BaseModel):
    raffle_id: str
