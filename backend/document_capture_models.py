"""
Document Capture Models - Para sistema de captura de documentos con cámara guiada
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

DocumentType = Literal[
    'photo_2x2',           # Foto personal 2x2
    'id_front',            # ID frontal
    'id_back',             # ID reverso
    'passport',            # Pasaporte
    'ssn_card',           # Social Security Card
    'w2',                 # Formulario W2
    '1099',               # Formulario 1099
    'receipt',            # Recibo
    'invoice',            # Factura
    'other'               # Otro documento
]

DocumentStatus = Literal['pending', 'approved', 'rejected', 'needs_revision']

class UploadDocumentRequest(BaseModel):
    document_type: DocumentType
    image_data: str = Field(..., description="Base64 encoded image")
    notes: Optional[str] = None
    year: Optional[int] = None  # Para documentos fiscales
    
class DocumentResponse(BaseModel):
    id: str
    user_id: str
    document_type: str
    status: str
    uploaded_at: str
    reviewed_at: Optional[str] = None
    notes: Optional[str] = None
    admin_notes: Optional[str] = None
    year: Optional[int] = None
    file_size: Optional[int] = None
    
class UpdateDocumentStatusRequest(BaseModel):
    status: DocumentStatus
    admin_notes: Optional[str] = None

class DocumentStatsResponse(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int
    needs_revision: int
