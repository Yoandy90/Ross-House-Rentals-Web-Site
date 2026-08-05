"""Legal Endpoints - Terms, Privacy Policy, etc."""
from fastapi import APIRouter
from pydantic import BaseModel
from legal_content import (
    TERMS_OF_SERVICE,
    PRIVACY_POLICY,
    LEGAL_VERSION,
    EFFECTIVE_DATE,
    LAST_UPDATED
)

legal_router = APIRouter()

class LegalDocument(BaseModel):
    content: str
    version: str
    effective_date: str
    last_updated: str

@legal_router.get('/legal/terms', response_model=LegalDocument, tags=['Legal'])
async def get_terms_of_service():
    """
    Get Terms of Service
    
    Returns the current Terms and Conditions for Ross Tax Preparation
    """
    return LegalDocument(
        content=TERMS_OF_SERVICE,
        version=LEGAL_VERSION,
        effective_date=EFFECTIVE_DATE,
        last_updated=LAST_UPDATED
    )

@legal_router.get('/legal/privacy', response_model=LegalDocument, tags=['Legal'])
async def get_privacy_policy():
    """
    Get Privacy Policy
    
    Returns the current Privacy Policy for Ross Tax Preparation
    """
    return LegalDocument(
        content=PRIVACY_POLICY,
        version=LEGAL_VERSION,
        effective_date=EFFECTIVE_DATE,
        last_updated=LAST_UPDATED
    )

@legal_router.get('/legal/version', tags=['Legal'])
async def get_legal_version():
    """
    Get current version of legal documents
    """
    return {
        'version': LEGAL_VERSION,
        'effective_date': EFFECTIVE_DATE,
        'last_updated': LAST_UPDATED
    }
