"""
Invoice Models - Modelos para sistema de facturación
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

class InvoiceStatus(str, Enum):
    """Estados de factura"""
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class InvoiceItemCreate(BaseModel):
    """Item de factura"""
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0)  # Allow 0 for free services
    total: Optional[float] = None
    
    def get_total(self) -> float:
        """Calculate total for item"""
        return self.quantity * self.unit_price
    
    def model_post_init(self, __context):
        """Calculate total after initialization"""
        if self.total is None:
            object.__setattr__(self, 'total', self.quantity * self.unit_price)

class InvoiceCreate(BaseModel):
    """Request para crear factura"""
    user_id: str = Field(..., description="ID del cliente")
    service_name: str = Field(..., min_length=1, max_length=200)
    items: List[InvoiceItemCreate] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=1000)
    due_date: Optional[datetime] = None

class InvoiceUpdate(BaseModel):
    """Request para actualizar factura"""
    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

class InvoiceResponse(BaseModel):
    """Response de factura"""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    id: str
    invoice_number: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    service_name: Optional[str] = None
    items: List[Any] = []
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    status: InvoiceStatus = InvoiceStatus.PENDING
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payment_method_id: Optional[str] = None
    created_by_admin_id: Optional[str] = None
    created_by_admin_name: Optional[str] = None

class InvoicePaymentRequest(BaseModel):
    """Request para pagar factura"""
    payment_method_id: str = Field(..., description="ID del método de pago")
    save_payment_method: bool = Field(default=False, description="Guardar método para futuros pagos")
