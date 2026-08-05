"""
Immigration Motions Models
Models for managing immigration court motions
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MotionType(str, Enum):
    COURT_CLOSURE = "court_closure"  # Moción para cierre de corte
    COURT_TRANSFER = "court_transfer"  # Moción para traslado de corte


class MotionStatus(str, Enum):
    NEW = "new"  # Nuevo caso
    IN_REVIEW = "in_review"  # En revisión
    DRAFTING = "drafting"  # Redactando moción
    LEGAL_REVIEW = "legal_review"  # Revisión legal
    SUBMITTED = "submitted"  # Presentada
    AWAITING_RESPONSE = "awaiting_response"  # En espera de respuesta
    APPROVED = "approved"  # Aprobada
    DENIED = "denied"  # Denegada
    CANCELLED = "cancelled"  # Cancelada


# Status labels in Spanish
MOTION_STATUS_LABELS = {
    MotionStatus.NEW: "Nuevo Caso",
    MotionStatus.IN_REVIEW: "En Revisión",
    MotionStatus.DRAFTING: "Redactando Moción",
    MotionStatus.LEGAL_REVIEW: "Revisión Legal",
    MotionStatus.SUBMITTED: "Presentada",
    MotionStatus.AWAITING_RESPONSE: "En Espera de Respuesta",
    MotionStatus.APPROVED: "Aprobada",
    MotionStatus.DENIED: "Denegada",
    MotionStatus.CANCELLED: "Cancelada"
}

MOTION_TYPE_LABELS = {
    MotionType.COURT_CLOSURE: "Cierre de Corte de Inmigración",
    MotionType.COURT_TRANSFER: "Traslado de Corte a Otro Tribunal"
}


class RequiredDocument(BaseModel):
    """Document required for a motion"""
    document_type: str  # nta, parol, residence_receipt, fingerprint_receipt, proof_of_address, etc.
    name: str
    description: str
    required: bool = True
    uploaded: bool = False
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    uploaded_at: Optional[datetime] = None


class StatusHistoryEntry(BaseModel):
    """Entry in the status history"""
    status: MotionStatus
    changed_at: datetime
    changed_by: str  # user_id
    changed_by_name: str
    notes: Optional[str] = None


class FamilyMember(BaseModel):
    """Family member for family motions"""
    full_name: str
    a_number: str
    relationship: str = Field(default="", description="Relación: spouse, child, parent, etc.")


class HostInfo(BaseModel):
    """Host information for transfer motions"""
    full_name: str
    address: str
    phone: Optional[str] = None
    relationship: str = Field(default="", description="Relación con el cliente")
    statement: Optional[str] = Field(None, description="Statement de que el cliente vivirá con el anfitrión")


class MotionCreateRequest(BaseModel):
    """Request to create a new motion"""
    motion_type: MotionType
    
    # Client info (if creating for existing client)
    client_id: Optional[str] = None
    
    # Or new client info
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_phone: Optional[str] = None
    
    # Common fields for all motions
    current_address: str = Field(..., description="Dirección postal actual")
    a_number: Optional[str] = Field(None, description="Número A del caso")
    current_court_id: Optional[str] = Field(None, description="ID del tribunal actual")
    current_court: Optional[str] = Field(None, description="Nombre del tribunal actual")
    current_court_address: Optional[str] = Field(None, description="Dirección del tribunal actual")
    
    # Family members (for family motions)
    is_family_motion: bool = Field(default=False, description="Si es moción familiar")
    family_members: List[FamilyMember] = Field(default=[], description="Miembros de la familia")
    
    # Additional fields for court transfer
    new_address: Optional[str] = Field(None, description="Nueva dirección donde vivirá")
    destination_court_id: Optional[str] = Field(None, description="ID del tribunal destino")
    destination_court: Optional[str] = Field(None, description="Nombre del tribunal destino")
    destination_court_address: Optional[str] = Field(None, description="Dirección del tribunal destino")
    
    # Justification (for transfers)
    justification: Optional[str] = Field(None, description="Justificación para el traslado")
    justification_reason: Optional[str] = Field(None, description="Razón breve: work, family, etc.")
    
    # Host info (for transfers when client doesn't have proof of address)
    host_info: Optional[HostInfo] = Field(None, description="Info del anfitrión si aplica")
    
    notes: Optional[str] = None
    priority: str = Field(default="normal", description="high, normal, low")
    deadline: Optional[datetime] = None


class MotionUpdateRequest(BaseModel):
    """Request to update a motion"""
    status: Optional[MotionStatus] = None
    notes: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    current_address: Optional[str] = None
    new_address: Optional[str] = None
    current_court: Optional[str] = None
    destination_court: Optional[str] = None
    a_number: Optional[str] = None
    admin_notes: Optional[str] = None


class MotionDocument(BaseModel):
    """Document attached to a motion"""
    id: str
    document_type: str
    name: str
    file_url: str
    file_name: str
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: datetime
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None


class MotionResponse(BaseModel):
    """Response model for a motion"""
    id: str
    motion_number: str
    motion_type: MotionType
    motion_type_label: str
    status: MotionStatus
    status_label: str
    
    # Client info
    client_id: str
    client_name: str
    client_email: str
    client_phone: str
    
    # Motion details
    current_address: str
    a_number: Optional[str]
    current_court: Optional[str]
    new_address: Optional[str]
    destination_court: Optional[str]
    
    # Metadata
    notes: Optional[str]
    admin_notes: Optional[str]
    priority: str
    deadline: Optional[datetime]
    
    # Documents
    required_documents: List[RequiredDocument]
    uploaded_documents: List[MotionDocument]
    
    # History
    status_history: List[StatusHistoryEntry]
    
    # Timestamps
    created_at: datetime
    created_by: str
    created_by_name: str
    updated_at: Optional[datetime]
    submitted_at: Optional[datetime]
    resolved_at: Optional[datetime]


class MotionListItem(BaseModel):
    """Simplified motion for list views"""
    id: str
    motion_number: str
    motion_type: MotionType
    motion_type_label: str
    status: MotionStatus
    status_label: str
    client_name: str
    client_email: str
    priority: str
    deadline: Optional[datetime]
    documents_complete: bool
    created_at: datetime
    updated_at: Optional[datetime]


class MotionStats(BaseModel):
    """Statistics for motions dashboard"""
    total: int
    by_status: dict
    by_type: dict
    pending_documents: int
    approaching_deadlines: int
    overdue: int


# Required documents by motion type
REQUIRED_DOCUMENTS_BY_TYPE = {
    MotionType.COURT_CLOSURE: [
        RequiredDocument(
            document_type="nta",
            name="NTA (Notice to Appear)",
            description="Papeles de inmigración entregados en frontera",
            required=True
        ),
        RequiredDocument(
            document_type="parol",
            name="Documento de Parol",
            description="Documento de parole si aplica",
            required=False
        ),
        RequiredDocument(
            document_type="residence_receipt",
            name="Recibo de Aplicación a Residencia",
            description="Recibo de la aplicación a la residencia",
            required=True
        ),
        RequiredDocument(
            document_type="fingerprint_receipt",
            name="Recibo de Huellas",
            description="Recibo de las huellas si aplica",
            required=False
        ),
        RequiredDocument(
            document_type="id_document",
            name="Identificación",
            description="Licencia de conducir u otra identificación válida",
            required=True
        )
    ],
    MotionType.COURT_TRANSFER: [
        RequiredDocument(
            document_type="nta",
            name="NTA (Notice to Appear)",
            description="Papeles de inmigración entregados en frontera",
            required=True
        ),
        RequiredDocument(
            document_type="parol",
            name="Documento de Parol",
            description="Documento de parole si aplica",
            required=False
        ),
        RequiredDocument(
            document_type="residence_receipt",
            name="Recibo de Aplicación a Residencia",
            description="Recibo de la aplicación a la residencia",
            required=True
        ),
        RequiredDocument(
            document_type="fingerprint_receipt",
            name="Recibo de Huellas",
            description="Recibo de las huellas si aplica",
            required=False
        ),
        RequiredDocument(
            document_type="id_document",
            name="Identificación",
            description="Licencia de conducir u otra identificación válida",
            required=True
        ),
        RequiredDocument(
            document_type="new_address_proof",
            name="Prueba de Nueva Dirección",
            description="Bill a su nombre o licencia con la nueva dirección",
            required=True
        ),
        RequiredDocument(
            document_type="new_license",
            name="Licencia con Nueva Dirección",
            description="Licencia de conducir con la nueva dirección",
            required=False
        ),
        RequiredDocument(
            document_type="host_id",
            name="Identificación del Anfitrión",
            description="Licencia de conducir de la persona donde vivirá",
            required=False
        ),
        RequiredDocument(
            document_type="host_bill",
            name="Bill del Anfitrión",
            description="Bill de la persona donde vivirá",
            required=False
        ),
        RequiredDocument(
            document_type="host_statement",
            name="Declaración del Anfitrión",
            description="Statement de que la persona vivirá con el anfitrión",
            required=False
        )
    ]
}
