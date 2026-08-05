"""
Credit Transfer Models for P2P transactions
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TransferCreditsRequest(BaseModel):
    recipient_identifier: str = Field(..., description="Email or phone number of recipient")
    amount: float = Field(..., gt=0, le=1000, description="Amount to transfer (1-1000)")
    note: Optional[str] = Field(None, max_length=200, description="Optional note")

class RequestCreditsModel(BaseModel):
    recipient_identifier: str = Field(..., description="Email or phone number of user to request from")
    amount: float = Field(..., gt=0, le=500, description="Amount to request (1-500)")
    reason: str = Field(..., min_length=10, max_length=200, description="Reason for request")

class RespondToRequestModel(BaseModel):
    request_id: str = Field(..., description="ID of the credit request")
    action: str = Field(..., pattern="^(approve|reject)$", description="approve or reject")

class CreditTransferResponse(BaseModel):
    success: bool
    message: str
    transaction_id: Optional[str] = None
    new_balance: Optional[float] = None
