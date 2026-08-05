"""
User Management Models
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from roles_permissions import UserRole


class UserCreate(BaseModel):
    """Model for creating a new user"""
    name: str
    email: EmailStr
    password: str
    role: UserRole
    phone: Optional[str] = None
    
    @field_validator('name')
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        return v.strip()
    
    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class UserUpdate(BaseModel):
    """Model for updating a user"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    """Model for resetting user password"""
    new_password: str
    
    @field_validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class UserResponse(BaseModel):
    """Model for user response"""
    id: str
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    is_active: bool = True  # Default to True for users without this field
    created_at: datetime
    last_login: Optional[datetime] = None
    permissions: List[str] = []
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Model for user list response"""
    users: List[UserResponse]
    total: int
    admins_count: int
    assistants_count: int
