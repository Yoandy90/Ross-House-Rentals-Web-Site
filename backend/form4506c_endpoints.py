"""
Form 4506-C API Endpoints
Admin: Create, list, manage forms
Client: View pending, sign forms
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger(__name__)

form4506c_router = APIRouter()
form4506c_service = None
_get_current_user = None


def set_form4506c_service(service, admin_auth=None):
    global form4506c_service, _get_current_user
    form4506c_service = service
    _get_current_user = admin_auth
    logger.info("✅ Form 4506-C endpoints initialized")


# ── Request Models ─────────────────────────────────────────

class CreateFormRequest(BaseModel):
    client_id: str = ""
    client_email: str
    client_phone: str = ""
    taxpayer_name: str
    taxpayer_ssn_last4: str = ""
    spouse_name: str = ""
    spouse_ssn_last4: str = ""
    street: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    prev_street: str = ""
    prev_city: str = ""
    prev_state: str = ""
    prev_zip: str = ""
    transcript_types: List[str] = ["wage"]
    tax_years: List[str] = ["2025"]
    filing_status: str = "single"
    third_party_name: str = "Ross Tax Preparation"
    third_party_address: str = ""
    third_party_ein: str = ""
    notes: str = ""


class SignFormRequest(BaseModel):
    type: str = "canvas"
    image_data: str = ""
    biometric_data: str = ""
    ip_address: str = ""
    user_agent: str = ""
    device_info: str = ""
    pad_model: str = ""
    pad_serial: str = ""


# ── Auth Dependencies ──────────────────────────────────────

async def get_admin_user(authorization: Optional[str] = Header(None)):
    if _get_current_user:
        return await _get_current_user(authorization)
    raise HTTPException(status_code=401, detail="Auth not configured")


async def get_any_user(authorization: Optional[str] = Header(None)):
    if _get_current_user:
        return await _get_current_user(authorization)
    raise HTTPException(status_code=401, detail="Auth not configured")


# ═══════════════════════════════════════════════════════════════
# Admin Endpoints
# ═══════════════════════════════════════════════════════════════

@form4506c_router.post('/admin/form-4506c')
async def create_form(data: CreateFormRequest, request: Request, current_user: dict = Depends(get_admin_user)):
    """Create a new Form 4506-C for client signature"""
    try:
        form_data = data.dict()
        form_data["created_by"] = str(current_user.get("_id", ""))
        form_data["created_by_name"] = current_user.get("name", current_user.get("email", ""))
        result = await form4506c_service.create_form(form_data)
        return result
    except Exception as e:
        logger.error(f"Error creating form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.get('/admin/form-4506c')
async def list_forms(status: str = "", client_email: str = "", limit: int = 50, current_user: dict = Depends(get_admin_user)):
    """List all Form 4506-C records"""
    try:
        return await form4506c_service.list_forms(status=status, client_email=client_email, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.get('/admin/form-4506c/{form_id}')
async def get_form_detail(form_id: str, current_user: dict = Depends(get_admin_user)):
    """Get full form details"""
    try:
        form = await form4506c_service.get_form(form_id)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        return form
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.post('/admin/form-4506c/{form_id}/sign')
async def admin_sign_form(form_id: str, data: SignFormRequest, request: Request, current_user: dict = Depends(get_admin_user)):
    """Sign form via admin (Topaz pad in office)"""
    try:
        sig_data = data.dict()
        sig_data["ip_address"] = request.client.host if request.client else ""
        sig_data["user_agent"] = request.headers.get("user-agent", "")
        return await form4506c_service.sign_form(form_id, sig_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error signing form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.post('/admin/form-4506c/{form_id}/submit')
async def mark_submitted(form_id: str, current_user: dict = Depends(get_admin_user)):
    """Mark form as submitted to IRS"""
    try:
        return await form4506c_service.mark_submitted(form_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.post('/admin/form-4506c/{form_id}/revoke')
async def revoke_form(form_id: str, reason: str = "", current_user: dict = Depends(get_admin_user)):
    """Revoke a signed authorization"""
    try:
        return await form4506c_service.revoke_form(form_id, reason)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# Client Endpoints
# ═══════════════════════════════════════════════════════════════

@form4506c_router.get('/client/form-4506c/pending')
async def client_pending_forms(current_user: dict = Depends(get_any_user)):
    """Get pending forms for client to sign"""
    try:
        email = current_user.get("email", "")
        return await form4506c_service.get_client_pending_forms(email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.get('/client/form-4506c/signed')
async def client_signed_forms(current_user: dict = Depends(get_any_user)):
    """Get signed forms for client"""
    try:
        email = current_user.get("email", "")
        return await form4506c_service.get_client_signed_forms(email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.get('/client/form-4506c/{form_id}')
async def client_get_form(form_id: str, current_user: dict = Depends(get_any_user)):
    """Get form details for client review"""
    try:
        form = await form4506c_service.get_form(form_id)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.get("client_email") != current_user.get("email", ""):
            raise HTTPException(status_code=403, detail="Access denied")
        return form
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@form4506c_router.post('/client/form-4506c/{form_id}/sign')
async def client_sign_form(form_id: str, data: SignFormRequest, request: Request, current_user: dict = Depends(get_any_user)):
    """Client signs form via mobile app"""
    try:
        form = await form4506c_service.get_form(form_id)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        if form.get("client_email") != current_user.get("email", ""):
            raise HTTPException(status_code=403, detail="Access denied")
        
        sig_data = data.dict()
        sig_data["ip_address"] = request.client.host if request.client else ""
        sig_data["user_agent"] = request.headers.get("user-agent", "")
        sig_data["device_info"] = f"Mobile App - {current_user.get('email', '')}"
        return await form4506c_service.sign_form(form_id, sig_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error client signing form: {e}")
        raise HTTPException(status_code=500, detail=str(e))
