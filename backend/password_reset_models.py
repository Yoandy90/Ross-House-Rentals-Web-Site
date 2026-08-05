"""
Password Reset Models
"""
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional
from datetime import datetime
import re


class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset - supports email or phone"""
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    
    @model_validator(mode='after')
    def check_email_or_phone(self):
        if not self.email and not self.phone_number:
            raise ValueError('Debes proporcionar un email o número de teléfono')
        return self
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v):
        if v:
            # Remove all non-digits
            digits = re.sub(r'\D', '', v)
            if len(digits) < 10:
                raise ValueError('El número de teléfono debe tener al menos 10 dígitos')
        return v


class VerifyResetCodeRequest(BaseModel):
    """Request to verify reset code"""
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    code: str
    
    @model_validator(mode='after')
    def check_email_or_phone(self):
        if not self.email and not self.phone_number:
            raise ValueError('Debes proporcionar un email o número de teléfono')
        return self
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v or len(v) != 6:
            raise ValueError('El código debe tener 6 dígitos')
        if not v.isdigit():
            raise ValueError('El código debe contener solo números')
        return v


class ResetPasswordRequest(BaseModel):
    """Request to reset password with verified code"""
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    code: str
    new_password: str
    
    @model_validator(mode='after')
    def check_email_or_phone(self):
        if not self.email and not self.phone_number:
            raise ValueError('Debes proporcionar un email o número de teléfono')
        return self
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if not v or len(v) != 6:
            raise ValueError('El código debe tener 6 dígitos')
        if not v.isdigit():
            raise ValueError('El código debe contener solo números')
        return v
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('La contraseña debe tener al menos 6 caracteres')
        return v


class PasswordResetResponse(BaseModel):
    """Response for password reset operations"""
    success: bool
    message: str
    code_sent: Optional[bool] = False
    method: Optional[str] = None  # 'email' or 'sms'
