"""
Immigration Motions Endpoints
API endpoints for managing immigration court motions
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Header
from typing import Optional
import base64
import uuid
from datetime import datetime

from immigration_motions_models import (
    MotionType, MotionStatus, MotionCreateRequest, MotionUpdateRequest,
    MOTION_STATUS_LABELS, MOTION_TYPE_LABELS
)

from immigration_courts_catalog import (
    get_all_courts, get_courts_by_state, get_court_by_id, 
    format_court_address, STATES_WITH_COURTS, REGIONS
)

logger = logging.getLogger(__name__)

# Router for immigration motions
motions_router = APIRouter(prefix="/motions", tags=["Immigration Motions"])

# Service instance and db - will be set by server.py
motions_service = None
db = None


def set_motions_service(service, database=None):
    """Set the motions service instance"""
    global motions_service, db
    motions_service = service
    db = database
    logger.info("✅ Immigration Motions endpoints initialized")


async def _get_current_user(authorization: Optional[str] = None):
    """Get current user from session token"""
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    from bson import ObjectId
    
    # Handle Bearer token
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    
    # Find session in database
    session = await db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    
    # Get user
    user_id = session['user_id']
    try:
        try:
            user = await db.users.find_one({'_id': ObjectId(user_id)})
        except Exception:
            user = await db.users.find_one({'_id': user_id})
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


# ==================== ADMIN ENDPOINTS ====================

@motions_router.get("/admin/list")
async def admin_list_motions(
    authorization: Optional[str] = Header(None),
    status: Optional[str] = Query(None),
    motion_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """List all motions (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await motions_service.list_motions(
        status=status,
        motion_type=motion_type,
        priority=priority,
        search=search,
        limit=limit,
        offset=offset
    )
    return result


@motions_router.get("/admin/stats")
async def admin_get_stats(authorization: Optional[str] = Header(None)):
    """Get motion statistics (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = await motions_service.get_stats()
    return stats


@motions_router.post("/admin/create")
async def admin_create_motion(
    request: MotionCreateRequest,
    authorization: Optional[str] = Header(None)
):
    """Create a new motion (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Admin")
    
    motion = await motions_service.create_motion(
        request=request,
        created_by=user_id,
        created_by_name=user_name
    )
    return {"success": True, "motion": motion}


@motions_router.get("/admin/{motion_id}")
async def admin_get_motion(
    motion_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get motion details (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    motion = await motions_service.get_motion(motion_id)
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    return motion


@motions_router.put("/admin/{motion_id}")
async def admin_update_motion(
    motion_id: str,
    request: MotionUpdateRequest,
    authorization: Optional[str] = Header(None)
):
    """Update a motion (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Admin")
    
    motion = await motions_service.update_motion(
        motion_id=motion_id,
        request=request,
        updated_by=user_id,
        updated_by_name=user_name
    )
    
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    return {"success": True, "motion": motion}


@motions_router.post("/admin/{motion_id}/document")
async def admin_add_document(
    motion_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """Add a document to a motion (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Admin")
    
    # Read file content and encode to base64 (for storage)
    content = await file.read()
    file_base64 = base64.b64encode(content).decode('utf-8')
    
    # Generate file URL
    file_id = str(uuid.uuid4())
    file_url = f"/api/motions/documents/{file_id}"
    
    # Store file in database for now
    await motions_service.db.motion_documents.insert_one({
        "id": file_id,
        "motion_id": motion_id,
        "document_type": document_type,
        "file_name": file.filename,
        "content_type": file.content_type,
        "file_data": file_base64,
        "uploaded_at": datetime.utcnow()
    })
    
    motion = await motions_service.add_document(
        motion_id=motion_id,
        document_type=document_type,
        file_url=file_url,
        file_name=file.filename,
        uploaded_by=user_id,
        uploaded_by_name=user_name
    )
    
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    return {"success": True, "motion": motion}


@motions_router.post("/admin/{motion_id}/document/{document_id}/verify")
async def admin_verify_document(
    motion_id: str,
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark a document as verified (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_id = current_user.get("id") or current_user.get("user_id")
    
    motion = await motions_service.verify_document(
        motion_id=motion_id,
        document_id=document_id,
        verified_by=user_id
    )
    
    if not motion:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    return {"success": True, "motion": motion}


@motions_router.delete("/admin/{motion_id}/document/{document_id}")
async def admin_delete_document(
    motion_id: str,
    document_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a document from a motion (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    success = await motions_service.delete_document(
        motion_id=motion_id,
        document_id=document_id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    return {"success": True}


@motions_router.post("/admin/{motion_id}/create-invoice")
async def admin_create_invoice_for_motion(
    motion_id: str,
    amount: float = Query(..., description="Monto de la factura"),
    description: str = Query(default="Moción de Cierre de Corte de Inmigración"),
    authorization: Optional[str] = Header(None)
):
    """Create an invoice for a motion service (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Admin")
    
    invoice = await motions_service.create_invoice_for_motion(
        motion_id=motion_id,
        amount=amount,
        description=description,
        created_by=user_id,
        created_by_name=user_name
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    return {"success": True, "invoice": invoice}


# ==================== CLIENT ENDPOINTS ====================

@motions_router.get("/my-motions")
async def client_get_my_motions(authorization: Optional[str] = Header(None)):
    """Get client's own motions"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    user_id = current_user.get("id") or current_user.get("user_id")
    
    motions = await motions_service.get_motions_by_client(user_id)
    return {"motions": motions}


@motions_router.get("/my-motions/{motion_id}")
async def client_get_motion(
    motion_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get a specific motion (client can only see their own)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    user_id = current_user.get("id") or current_user.get("user_id")
    
    motion = await motions_service.get_motion(motion_id)
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    # Verify ownership
    if motion.get("client_id") != user_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a esta moción")
    
    return motion


@motions_router.post("/request")
async def client_request_motion(
    request: MotionCreateRequest,
    authorization: Optional[str] = Header(None)
):
    """Request a new motion (client)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Cliente")
    user_email = current_user.get("email")
    user_phone = current_user.get("phone")
    
    # Override client info with logged-in user
    request.client_id = user_id
    request.client_name = user_name
    request.client_email = user_email
    request.client_phone = user_phone
    
    motion = await motions_service.create_motion(
        request=request,
        created_by=user_id,
        created_by_name=user_name
    )
    return {"success": True, "motion": motion}


@motions_router.post("/my-motions/{motion_id}/document")
async def client_upload_document(
    motion_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """Upload a document to client's own motion"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    user_id = current_user.get("id") or current_user.get("user_id")
    user_name = current_user.get("full_name", "Cliente")
    
    # Verify ownership
    motion = await motions_service.get_motion(motion_id)
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    if motion.get("client_id") != user_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a esta moción")
    
    # Read file content and encode to base64
    content = await file.read()
    file_base64 = base64.b64encode(content).decode('utf-8')
    
    # Generate file URL
    file_id = str(uuid.uuid4())
    file_url = f"/api/motions/documents/{file_id}"
    
    # Store file in database
    await motions_service.db.motion_documents.insert_one({
        "id": file_id,
        "motion_id": motion_id,
        "document_type": document_type,
        "file_name": file.filename,
        "content_type": file.content_type,
        "file_data": file_base64,
        "uploaded_at": datetime.utcnow()
    })
    
    updated_motion = await motions_service.add_document(
        motion_id=motion_id,
        document_type=document_type,
        file_url=file_url,
        file_name=file.filename,
        uploaded_by=user_id,
        uploaded_by_name=user_name
    )
    
    return {"success": True, "motion": updated_motion}


# ==================== PUBLIC ENDPOINTS ====================

@motions_router.get("/types")
async def get_motion_types():
    """Get available motion types"""
    return {
        "types": [
            {"value": mt.value, "label": MOTION_TYPE_LABELS.get(mt, mt.value)}
            for mt in MotionType
        ]
    }


@motions_router.get("/statuses")
async def get_motion_statuses():
    """Get available motion statuses"""
    return {
        "statuses": [
            {"value": ms.value, "label": MOTION_STATUS_LABELS.get(ms, ms.value)}
            for ms in MotionStatus
        ]
    }


@motions_router.get("/documents/{file_id}")
async def get_document_file(file_id: str):
    """Download a document file"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    doc = await motions_service.db.motion_documents.find_one({"id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    from fastapi.responses import Response
    
    file_data = base64.b64decode(doc["file_data"])
    return Response(
        content=file_data,
        media_type=doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{doc.get("file_name", "document")}"'
        }
    )



# ==================== IMMIGRATION COURTS ENDPOINTS ====================

@motions_router.get("/courts")
async def get_immigration_courts(state: Optional[str] = Query(None)):
    """Get list of immigration courts, optionally filtered by state"""
    if state:
        courts = get_courts_by_state(state)
    else:
        courts = get_all_courts()
    
    return {
        "courts": courts,
        "total": len(courts)
    }


@motions_router.get("/courts/states")
async def get_states_with_courts():
    """Get list of states that have immigration courts"""
    return {
        "states": STATES_WITH_COURTS,
        "regions": REGIONS
    }


@motions_router.get("/courts/{court_id}")
async def get_court_details(court_id: str):
    """Get details for a specific immigration court"""
    court = get_court_by_id(court_id)
    if not court:
        raise HTTPException(status_code=404, detail="Tribunal no encontrado")
    
    return {
        "court": court,
        "formatted_address": format_court_address(court)
    }


# ==================== DOCUMENT GENERATION ENDPOINTS ====================

# Document generator instance - will be set by server.py
document_generator = None


def set_document_generator(generator):
    """Set the document generator instance"""
    global document_generator
    document_generator = generator
    logger.info("✅ Motion Document Generator endpoints initialized")


@motions_router.post("/admin/{motion_id}/generate-document")
async def admin_generate_motion_document(
    motion_id: str,
    use_ai: bool = Query(default=False, description="Usar IA para mejorar el lenguaje legal"),
    authorization: Optional[str] = Header(None)
):
    """Generate motion document in both languages (admin only)"""
    if not document_generator:
        raise HTTPException(status_code=500, detail="Document generator service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await document_generator.generate_motion_documents(
            motion_id=motion_id,
            use_ai_enhancement=use_ai
        )
        
        # Add to status history
        if motions_service:
            now = datetime.utcnow()
            user_id = current_user.get("id") or current_user.get("user_id")
            user_name = current_user.get("full_name", "Admin")
            
            history_entry = {
                "status": "document_generated",
                "changed_at": now,
                "changed_by": user_id,
                "changed_by_name": user_name,
                "notes": f"Documento de moción generado (AI: {'Sí' if use_ai else 'No'})"
            }
            
            await motions_service.collection.update_one(
                {"id": motion_id},
                {"$push": {"status_history": history_entry}}
            )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating motion document: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando documento: {str(e)}")


@motions_router.get("/admin/{motion_id}/preview-document")
async def admin_preview_motion_document(
    motion_id: str,
    lang: str = Query(default="es", description="Idioma: 'es' o 'en'"),
    authorization: Optional[str] = Header(None)
):
    """Preview motion document content without generating PDF (admin only)"""
    if not motions_service:
        raise HTTPException(status_code=500, detail="Motions service not initialized")
    
    current_user = await _get_current_user(authorization)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    motion = await motions_service.get_motion(motion_id)
    if not motion:
        raise HTTPException(status_code=404, detail="Moción no encontrada")
    
    # Check if document was already generated
    if motion.get("motion_content_es") and motion.get("motion_content_en"):
        return {
            "motion_id": motion_id,
            "motion_number": motion.get("motion_number"),
            "content_es": motion.get("motion_content_es"),
            "content_en": motion.get("motion_content_en"),
            "generated_at": motion.get("generated_at"),
            "pdf_es_url": f"/api/motions/documents/pdf/{os.path.basename(motion.get('pdf_es_path', ''))}" if motion.get("pdf_es_path") else None,
            "pdf_en_url": f"/api/motions/documents/pdf/{os.path.basename(motion.get('pdf_en_path', ''))}" if motion.get("pdf_en_path") else None,
            "already_generated": True
        }
    
    # Generate preview content without saving
    if not document_generator:
        raise HTTPException(status_code=500, detail="Document generator service not initialized")
    
    content_es, content_en = document_generator.generate_motion_content(motion)
    
    return {
        "motion_id": motion_id,
        "motion_number": motion.get("motion_number"),
        "content_es": content_es,
        "content_en": content_en,
        "generated_at": None,
        "already_generated": False
    }


@motions_router.get("/documents/pdf/{filename}")
async def get_motion_pdf(filename: str):
    """Download a motion PDF document"""
    if not document_generator:
        raise HTTPException(status_code=500, detail="Document generator service not initialized")
    
    # Security: only allow PDF files from our directory
    if not filename.endswith('.pdf') or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    pdf_content = document_generator.get_pdf_file(filename)
    if not pdf_content:
        raise HTTPException(status_code=404, detail="PDF no encontrado")
    
    from fastapi.responses import Response
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
