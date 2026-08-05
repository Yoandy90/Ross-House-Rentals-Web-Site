from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

class KYCData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    
    # Personal Information
    full_name: str
    date_of_birth: str  # YYYY-MM-DD format
    ssn_last_four: str  # Only last 4 digits for display
    ssn_full: Optional[str] = None  # Encrypted in production
    itin: Optional[str] = None
    address_street: str
    address_city: str
    address_state: str
    address_zip: str
    marital_status: str  # single, married, divorced, widowed
    
    # Family Information
    spouse_name: Optional[str] = None
    spouse_ssn_last_four: Optional[str] = None
    spouse_ssn_full: Optional[str] = None
    num_dependents: int = 0
    dependents: Optional[List[dict]] = []  # [{name, dob, ssn_last_four, relationship}]
    
    # Contact Preferences
    primary_phone: str
    secondary_phone: Optional[str] = None
    preferred_contact_method: str  # phone, email, text
    preferred_contact_time: str  # morning, afternoon, evening
    
    # Status
    completed: bool = False
    verified: bool = False
    priority_status: bool = False  # True if KYC completed
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
    
    @validator('ssn_last_four', 'spouse_ssn_last_four')
    def validate_ssn_last_four(cls, v):
        if v and not re.match(r'^\d{4}$', v):
            raise ValueError('SSN last 4 must be exactly 4 digits')
        return v
    
    @validator('address_zip')
    def validate_zip(cls, v):
        if not re.match(r'^\d{5}(-\d{4})?$', v):
            raise ValueError('Invalid ZIP code format')
        return v

class KYCSubmitRequest(BaseModel):
    # Personal Information
    full_name: str
    date_of_birth: str
    ssn_or_itin: str  # Will be validated and split
    address_street: str
    address_city: str
    address_state: str
    address_zip: str
    marital_status: str
    
    # Family Information
    spouse_name: Optional[str] = None
    spouse_ssn_or_itin: Optional[str] = None
    num_dependents: int = 0
    dependents: Optional[List[dict]] = []
    
    # Contact Preferences
    primary_phone: str
    secondary_phone: Optional[str] = None
    preferred_contact_method: str = 'email'
    preferred_contact_time: str = 'afternoon'

class KYCStatusResponse(BaseModel):
    has_kyc: bool
    completed: bool
    verified: bool
    priority_status: bool
    completed_at: Optional[datetime] = None
    completion_percentage: int = 0
