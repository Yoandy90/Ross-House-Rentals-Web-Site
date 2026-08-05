from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Rise CRM Sync Models
class RiseCRMSyncLog(BaseModel):
    """Model for tracking Rise CRM sync operations"""
    sync_id: str
    entity_type: str  # 'client', 'appointment', 'document', 'payment', 'ticket'
    entity_id: str
    ross_tax_id: Optional[str] = None
    rise_crm_id: Optional[str] = None
    action: str  # 'create', 'update', 'delete'
    direction: str  # 'ross_to_rise', 'rise_to_ross', 'bidirectional'
    status: str  # 'pending', 'success', 'failed'
    error_message: Optional[str] = None
    sync_timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Optional[dict] = None

class RiseCRMClient(BaseModel):
    """Model for Rise CRM Client"""
    id: Optional[int] = None
    company_name: Optional[str] = None
    contact_firstname: Optional[str] = None
    contact_lastname: Optional[str] = None
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None  # SSN o ITIN
    labels: Optional[List[str]] = []
    currency: str = "USD"
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None

class RiseCRMProject(BaseModel):
    """Model for Rise CRM Project (Tax Season/Year)"""
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    client_id: int
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    status: str = "open"  # open, completed, hold, cancelled
    labels: Optional[List[str]] = []
    created_date: Optional[datetime] = None

class RiseCRMTask(BaseModel):
    """Model for Rise CRM Task (Document requests, etc.)"""
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    project_id: int
    assigned_to: Optional[int] = None
    status: str = "to_do"  # to_do, in_progress, done
    priority: str = "medium"  # low, medium, high, urgent
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

class RiseCRMTicket(BaseModel):
    """Model for Rise CRM Support Ticket"""
    id: Optional[int] = None
    title: str
    description: str
    client_id: int
    ticket_type: str = "support"
    priority: str = "medium"
    status: str = "new"  # new, client_replied, working, closed
    created_date: Optional[datetime] = None

class RiseCRMInvoice(BaseModel):
    """Model for Rise CRM Invoice (for payments)"""
    id: Optional[int] = None
    client_id: int
    bill_date: datetime
    due_date: datetime
    invoice_value: float
    tax: float = 0.0
    total: float
    status: str = "draft"  # draft, sent, partially_paid, paid, overdue, cancelled
    note: Optional[str] = None
    created_date: Optional[datetime] = None

class RiseCRMPayment(BaseModel):
    """Model for Rise CRM Payment"""
    id: Optional[int] = None
    invoice_id: int
    payment_date: datetime
    amount: float
    payment_method: str = "stripe"
    transaction_id: Optional[str] = None
    note: Optional[str] = None

class RiseCRMWebhookPayload(BaseModel):
    """Model for Rise CRM Webhook payload"""
    event: str  # 'client.created', 'client.updated', etc.
    entity_type: str
    entity_id: int
    data: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)
