"""
═══════════════════════════════════════════════════════════════════════════════
 Document Upload Router — Ross Lending Solutions LLC
 Clients upload ID, pay stubs, proof of address from the mobile app.
 Admin reviews documents in the Underwriting pipeline.
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
import base64
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId

logger = logging.getLogger(__name__)

doc_upload_router = APIRouter()
_db = None
_get_current_user = None

DOC_COLLECTION = "client_documents"

DOC_TYPES = {
    "photo_id": {"label": "Identificación con Foto", "icon": "🪪", "required": True},
    "proof_address": {"label": "Comprobante de Domicilio", "icon": "🏠", "required": True},
    "pay_stub": {"label": "Pay Stub / Comprobante de Ingreso", "icon": "💰", "required": True},
    "bank_statement": {"label": "Estado de Cuenta Bancario", "icon": "🏦", "required": False},
    "tax_return": {"label": "Declaración de Impuestos", "icon": "📋", "required": False},
    "reference_letter": {"label": "Carta de Referencia", "icon": "📝", "required": False},
    "selfie": {"label": "Selfie de Verificación", "icon": "🤳", "required": False},
    "other": {"label": "Otro Documento", "icon": "📄", "required": False},
}


def init_doc_upload(db_instance, get_user_func):
    global _db, _get_current_user
    _db = db_instance
    _get_current_user = get_user_func
    logger.info("Document Upload Router initialized")


async def _auth_user(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    if not user:
        raise HTTPException(401, "Token inválido")
    return user


async def _auth_admin(request: Request):
    user = await _auth_user(request)
    if user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(403, "Acceso denegado")
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT ENDPOINTS (Mobile App)
# ═══════════════════════════════════════════════════════════════════════════════

@doc_upload_router.post("/documents/upload")
async def upload_document(request: Request, body: dict = Body(...)):
    """Client uploads a document (base64 image)."""
    user = await _auth_user(request)
    db = _db

    doc_type = body.get("doc_type", "other")
    file_data = body.get("file_data", "")  # base64 string
    file_name = body.get("file_name", "document")
    loan_application_id = body.get("loan_application_id")
    notes = body.get("notes", "")

    if not file_data:
        raise HTTPException(400, "file_data (base64) es requerido")

    if doc_type not in DOC_TYPES:
        raise HTTPException(400, f"doc_type inválido. Opciones: {', '.join(DOC_TYPES.keys())}")

    # Validate base64 size (max ~10MB)
    try:
        decoded = base64.b64decode(file_data)
        size_mb = len(decoded) / (1024 * 1024)
        if size_mb > 10:
            raise HTTPException(400, "Archivo muy grande (máx 10MB)")
    except Exception as e:
        if "muy grande" in str(e):
            raise
        raise HTTPException(400, "Datos base64 inválidos")

    user_id = str(user.get("id") or user.get("_id", ""))

    doc = {
        "user_id": user_id,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("name", ""),
        "user_email": user.get("email", ""),
        "doc_type": doc_type,
        "doc_type_label": DOC_TYPES[doc_type]["label"],
        "file_name": file_name,
        "file_data": file_data,
        "file_size_mb": round(size_mb, 2),
        "loan_application_id": loan_application_id,
        "notes": notes,
        "status": "pending",  # pending, approved, rejected
        "review_notes": "",
        "reviewed_by": "",
        "reviewed_at": None,
        "uploaded_at": datetime.utcnow().isoformat(),
    }

    result = await db[DOC_COLLECTION].insert_one(doc)

    return {
        "success": True,
        "document_id": str(result.inserted_id),
        "message": f"Documento '{DOC_TYPES[doc_type]['label']}' subido exitosamente",
    }


@doc_upload_router.get("/documents/my-documents")
async def my_documents(request: Request):
    """Client gets their uploaded documents."""
    user = await _auth_user(request)
    db = _db
    user_id = str(user.get("id") or user.get("_id", ""))

    docs = []
    async for doc in db[DOC_COLLECTION].find({"user_id": user_id}).sort("uploaded_at", -1):
        doc["_id"] = str(doc["_id"])
        doc.pop("file_data", None)  # Don't send file data in list
        docs.append(doc)

    # Check which required docs are missing
    uploaded_types = set(d["doc_type"] for d in docs if d["status"] != "rejected")
    required_docs = []
    for dtype, info in DOC_TYPES.items():
        required_docs.append({
            "doc_type": dtype,
            "label": info["label"],
            "icon": info["icon"],
            "required": info["required"],
            "uploaded": dtype in uploaded_types,
            "status": next((d["status"] for d in docs if d["doc_type"] == dtype), None),
        })

    return {
        "documents": docs,
        "required_docs": required_docs,
        "total_uploaded": len(docs),
        "all_required_uploaded": all(
            d["uploaded"] for d in required_docs if d["required"]
        ),
    }


@doc_upload_router.get("/documents/types")
async def get_document_types(request: Request):
    """Get list of document types with requirements."""
    return {
        "types": [
            {"key": k, **v} for k, v in DOC_TYPES.items()
        ]
    }


@doc_upload_router.delete("/documents/{doc_id}")
async def delete_my_document(request: Request, doc_id: str):
    """Client deletes their own document."""
    user = await _auth_user(request)
    db = _db
    user_id = str(user.get("id") or user.get("_id", ""))

    try:
        doc = await db[DOC_COLLECTION].find_one({"_id": ObjectId(doc_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    if doc.get("user_id") != user_id:
        raise HTTPException(403, "No tienes permiso")
    if doc.get("status") == "approved":
        raise HTTPException(400, "No puedes eliminar documentos ya aprobados")

    await db[DOC_COLLECTION].delete_one({"_id": ObjectId(doc_id)})
    return {"success": True, "message": "Documento eliminado"}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS (Document Review)
# ═══════════════════════════════════════════════════════════════════════════════

@doc_upload_router.get("/admin/documents/pending")
async def admin_pending_documents(
    request: Request,
    search: str = Query(""),
    doc_type: str = Query(""),
    status: str = Query("pending"),
    limit: int = Query(50),
):
    """Admin: list documents for review."""
    await _auth_admin(request)
    db = _db

    query: dict = {}
    if status:
        query["status"] = status
    if doc_type:
        query["doc_type"] = doc_type
    if search:
        query["$or"] = [
            {"user_name": {"$regex": search, "$options": "i"}},
            {"user_email": {"$regex": search, "$options": "i"}},
        ]

    docs = []
    async for doc in db[DOC_COLLECTION].find(query).sort("uploaded_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        doc.pop("file_data", None)  # Don't send file data in list view
        docs.append(doc)

    # Stats
    total_pending = await db[DOC_COLLECTION].count_documents({"status": "pending"})
    total_approved = await db[DOC_COLLECTION].count_documents({"status": "approved"})
    total_rejected = await db[DOC_COLLECTION].count_documents({"status": "rejected"})

    return {
        "documents": docs,
        "total": len(docs),
        "stats": {
            "pending": total_pending,
            "approved": total_approved,
            "rejected": total_rejected,
        },
    }


@doc_upload_router.get("/admin/documents/{doc_id}")
async def admin_get_document(request: Request, doc_id: str):
    """Admin: get full document with file data for review."""
    await _auth_admin(request)
    db = _db

    try:
        doc = await db[DOC_COLLECTION].find_one({"_id": ObjectId(doc_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")

    if not doc:
        raise HTTPException(404, "Documento no encontrado")

    doc["_id"] = str(doc["_id"])
    return doc


@doc_upload_router.put("/admin/documents/{doc_id}/review")
async def admin_review_document(request: Request, doc_id: str, body: dict = Body(...)):
    """Admin: approve or reject a document."""
    admin = await _auth_admin(request)
    db = _db

    decision = body.get("decision")  # approved or rejected
    review_notes = body.get("notes", "")

    if decision not in ["approved", "rejected"]:
        raise HTTPException(400, "decision debe ser 'approved' o 'rejected'")

    try:
        result = await db[DOC_COLLECTION].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": decision,
                "review_notes": review_notes,
                "reviewed_by": admin.get("email", ""),
                "reviewed_at": datetime.utcnow().isoformat(),
            }}
        )
    except Exception:
        raise HTTPException(400, "ID inválido")

    if result.modified_count == 0:
        raise HTTPException(404, "Documento no encontrado")

    # Also update the loan application KYC status if applicable
    doc = await db[DOC_COLLECTION].find_one({"_id": ObjectId(doc_id)})
    if doc and doc.get("loan_application_id") and decision == "approved":
        kyc_field_map = {
            "photo_id": "id_verified",
            "proof_address": "address_verified",
            "pay_stub": "income_verified",
            "reference_letter": "reference_verified",
        }
        field = kyc_field_map.get(doc.get("doc_type"))
        if field:
            # Try updating in regulated_loans
            await db["regulated_loans"].update_many(
                {"client_email": doc.get("user_email")},
                {"$set": {field: True}}
            )

    # Audit
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(
            user_id=str(admin.get("id")),
            user_name=admin.get("email", ""),
            action=f"document_{decision}",
            module="underwriting",
            severity="info",
            details={"doc_id": doc_id, "doc_type": doc.get("doc_type"), "user": doc.get("user_name")},
        )
    except Exception:
        pass

    return {"success": True, "message": f"Documento {decision}"}


@doc_upload_router.get("/admin/documents/by-user/{user_id}")
async def admin_docs_by_user(request: Request, user_id: str):
    """Admin: get all documents for a specific user."""
    await _auth_admin(request)
    db = _db

    docs = []
    async for doc in db[DOC_COLLECTION].find({"user_id": user_id}).sort("uploaded_at", -1):
        doc["_id"] = str(doc["_id"])
        doc.pop("file_data", None)
        docs.append(doc)

    return {"documents": docs, "total": len(docs)}
