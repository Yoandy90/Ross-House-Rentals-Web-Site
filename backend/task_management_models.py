from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None  # user_id of team member
    assigned_by: str  # user_id of creator
    client_id: Optional[str] = None  # Optional client association
    project_id: Optional[str] = None  # Optional project association
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "todo"  # todo, in_progress, review, completed, cancelled
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    tags: List[str] = []
    attachments: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    tags: List[str] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    tags: Optional[List[str]] = None

class Estimate(BaseModel):
    id: str
    estimate_number: str
    client_id: str
    title: str
    description: Optional[str] = None
    items: List[dict]  # [{name, description, quantity, rate, amount}]
    subtotal: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total: float
    status: str = "draft"  # draft, sent, accepted, declined, expired, invoiced
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    created_by: str
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    invoice_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class EstimateCreate(BaseModel):
    client_id: str
    title: str
    description: Optional[str] = None
    items: List[dict]
    tax_rate: float = 0.0
    discount_amount: float = 0.0
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None

class EstimateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[dict]] = None
    tax_rate: Optional[float] = None
    discount_amount: Optional[float] = None
    status: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None

class Expense(BaseModel):
    id: str
    category: str  # office, travel, supplies, utilities, software, etc.
    amount: float
    description: str
    vendor: Optional[str] = None
    date: datetime
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    is_billable: bool = False
    is_reimbursable: bool = False
    reimbursed: bool = False
    status: str = "pending"  # pending, approved, declined, reimbursed
    created_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str
    vendor: Optional[str] = None
    date: datetime
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    is_billable: bool = False
    is_reimbursable: bool = False

class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    date: Optional[datetime] = None
    status: Optional[str] = None
    is_billable: Optional[bool] = None
    reimbursed: Optional[bool] = None

class TimeEntry(BaseModel):
    id: str
    user_id: str  # Team member
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    description: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None  # Calculated
    is_billable: bool = True
    hourly_rate: Optional[float] = None
    amount: Optional[float] = None  # Calculated: duration * rate
    status: str = "active"  # active, stopped, billed
    invoice_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TimeEntryCreate(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    description: str
    start_time: Optional[datetime] = None
    is_billable: bool = True
    hourly_rate: Optional[float] = None

class TimeEntryUpdate(BaseModel):
    description: Optional[str] = None
    end_time: Optional[datetime] = None
    is_billable: Optional[bool] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None
