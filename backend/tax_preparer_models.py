"""
Tax Preparer Module - Data Models
Models for IRS form preparation, e-filing, and client management
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# ==================== ENUMS ====================

class TaxpayerType(str, Enum):
    INDIVIDUAL = "individual"
    BUSINESS = "business"
    TRUST = "trust"
    ESTATE = "estate"


class FormType(str, Enum):
    F1099_NEC = "1099-NEC"
    F1099_MISC = "1099-MISC"
    F1099_INT = "1099-INT"
    F1099_DIV = "1099-DIV"
    F1099_K = "1099-K"
    F1095_A = "1095-A"
    W2 = "W-2"
    F1040 = "1040"


class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CORRECTED = "corrected"


class DocumentType(str, Enum):
    W2 = "W-2"
    F1099 = "1099"
    ID_FRONT = "id_front"
    ID_BACK = "id_back"
    SSN_CARD = "ssn_card"
    CONSENT = "consent"
    CONTRACT = "contract"
    OTHER = "other"


class ConsentType(str, Enum):
    E_FILE = "e_file"
    TRANSCRIPT = "transcript"
    DISCLOSURE = "disclosure"
    REPRESENTATION = "representation"


# ==================== REQUEST/RESPONSE MODELS ====================

class TaxpayerCreate(BaseModel):
    """Create a new taxpayer/client"""
    taxpayerType: TaxpayerType = TaxpayerType.INDIVIDUAL
    firstName: str
    lastName: str
    middleName: Optional[str] = None
    suffix: Optional[str] = None
    ssn: Optional[str] = None  # Will be encrypted
    ein: Optional[str] = None  # For businesses
    dateOfBirth: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address1: str
    address2: Optional[str] = None
    city: str
    state: str
    zipCode: str
    country: str = "US"
    # Spouse info (if applicable)
    spouseFirstName: Optional[str] = None
    spouseLastName: Optional[str] = None
    spouseSSN: Optional[str] = None
    spouseDOB: Optional[str] = None


class TaxpayerResponse(BaseModel):
    """Taxpayer response with masked sensitive data"""
    id: str
    taxpayerType: str
    firstName: str
    lastName: str
    middleName: Optional[str] = None
    ssnMasked: str  # XXX-XX-1234
    einMasked: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address1: str
    city: str
    state: str
    zipCode: str
    tinVerified: bool = False
    tinVerifiedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class PayerCreate(BaseModel):
    """Create a payer (company that pays contractors)"""
    name: str
    ein: str
    address1: str
    address2: Optional[str] = None
    city: str
    state: str
    zipCode: str
    country: str = "US"
    phone: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None


class Form1099NECCreate(BaseModel):
    """Create a 1099-NEC form"""
    taxYear: int
    payerId: str
    recipientId: str  # Taxpayer ID
    nonemployeeCompensation: float  # Box 1
    federalTaxWithheld: float = 0  # Box 4
    stateTaxWithheld: float = 0  # Box 5
    statePayerNumber: Optional[str] = None  # Box 6
    stateIncome: float = 0  # Box 7
    accountNumber: Optional[str] = None
    secondTinNotice: bool = False
    directSalesIndicator: bool = False


class Form1099MISCCreate(BaseModel):
    """Create a 1099-MISC form"""
    taxYear: int
    payerId: str
    recipientId: str
    rents: float = 0  # Box 1
    royalties: float = 0  # Box 2
    otherIncome: float = 0  # Box 3
    federalTaxWithheld: float = 0  # Box 4
    fishingBoatProceeds: float = 0  # Box 5
    medicalPayments: float = 0  # Box 6
    substitutePayments: float = 0  # Box 8
    cropInsurance: float = 0  # Box 9
    grossProceeds: float = 0  # Box 10
    fishPurchased: float = 0  # Box 11
    section409ADeferrals: float = 0  # Box 12
    excessGoldenParachute: float = 0  # Box 13
    nonqualifiedDeferred: float = 0  # Box 14
    stateTaxWithheld: float = 0  # Box 15
    statePayerNumber: Optional[str] = None  # Box 16
    stateIncome: float = 0  # Box 17
    accountNumber: Optional[str] = None
    fatcaFiling: bool = False
    secondTinNotice: bool = False


class TINMatchRequest(BaseModel):
    """Request for TIN matching"""
    tin: str  # SSN or EIN
    name: str  # Name to match
    tinType: str = "SSN"  # SSN or EIN


class TINMatchResponse(BaseModel):
    """Response from TIN matching"""
    matched: bool
    tinMasked: str
    name: str
    matchCode: str  # 0=match, 1=tin mismatch, etc.
    matchDescription: str
    checkedAt: datetime


class DocumentUpload(BaseModel):
    """Document upload metadata"""
    documentType: DocumentType
    taxpayerId: str
    taxYear: Optional[int] = None
    description: Optional[str] = None


class OCRResult(BaseModel):
    """Result from OCR processing"""
    documentId: str
    documentType: str
    extractedFields: Dict[str, Any]
    confidence: float
    needsReview: bool
    rawText: Optional[str] = None


class ConsentCreate(BaseModel):
    """Create consent/authorization"""
    taxpayerId: str
    consentType: ConsentType
    taxYears: List[int]
    description: str
    signatureData: Optional[str] = None  # Base64 signature image


class SubmissionCreate(BaseModel):
    """Create a submission to IRS"""
    formType: FormType
    formId: str
    submissionType: str = "original"  # original, corrected, void


class IRSCredentialsCreate(BaseModel):
    """Store IRS credentials securely"""
    efin: str
    etin: Optional[str] = None
    tcc: Optional[str] = None  # Transmitter Control Code
    firePin: Optional[str] = None
    eServicesUsername: Optional[str] = None
    eServicesPassword: Optional[str] = None  # Will be encrypted


# ==================== DASHBOARD MODELS ====================

class TaxPrepDashboardStats(BaseModel):
    """Dashboard statistics"""
    totalClients: int
    newClientsThisMonth: int
    totalForms: int
    formsByType: Dict[str, int]
    pendingSubmissions: int
    acceptedSubmissions: int
    rejectedSubmissions: int
    acceptanceRate: float
    documentsNeedingReview: int
    tinMatchesPending: int


class FormSummary(BaseModel):
    """Summary of a form"""
    id: str
    formType: str
    taxYear: int
    payerName: str
    recipientName: str
    amount: float
    status: str
    createdAt: datetime
    submittedAt: Optional[datetime] = None
    acceptedAt: Optional[datetime] = None


class SubmissionSummary(BaseModel):
    """Summary of a submission"""
    id: str
    formId: str
    formType: str
    recipientName: str
    status: str
    submittedAt: datetime
    responseAt: Optional[datetime] = None
    ackCode: Optional[str] = None
    errors: Optional[List[Dict[str, str]]] = None
