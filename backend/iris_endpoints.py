"""
IRS IRIS A2A API Endpoints
Admin endpoints for managing 1099/1042-S electronic filing
"""

import logging
from typing import Optional, Callable
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from pydantic import BaseModel
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

iris_router = APIRouter(prefix="/admin/iris", tags=["IRIS"])

# Service and auth instances (set during initialization)
iris_service = None
_get_current_user = None


def set_iris_service(service, auth_func=None):
    global iris_service, _get_current_user
    iris_service = service
    _get_current_user = auth_func
    logger.info("📋 IRIS endpoints initialized")


async def get_admin_user(authorization: Optional[str] = Header(None)):
    """Auth wrapper that uses the main app's auth function"""
    if _get_current_user:
        user = await _get_current_user(authorization)
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    raise HTTPException(status_code=401, detail="Not authenticated")


# ─── Models ────────────────────────────────────────────────────

class RecipientCreate(BaseModel):
    name: str
    business_name: str = ""
    tin_type: str = "SSN"
    tin: str
    address: str
    city: str
    state: str
    zip: str
    email: str = ""
    phone: str = ""

class RecipientUpdate(BaseModel):
    name: str = ""
    business_name: str = ""
    tin_type: str = ""
    tin: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    email: str = ""
    phone: str = ""

class Form1099Create(BaseModel):
    recipient_id: str
    form_type: str = "1099-NEC"
    tax_year: str = ""
    nonemployee_compensation: float = 0
    federal_tax_withheld: float = 0
    direct_sales: bool = False
    # 1099-MISC fields
    rents: float = 0
    royalties: float = 0
    other_income: float = 0
    medical_payments: float = 0
    crop_insurance: float = 0
    golden_parachute: float = 0
    nonqualified_deferred: float = 0
    section_409a: float = 0
    # 1042-S fields
    gross_income: float = 0
    tax_withheld: float = 0
    income_code: str = ""
    tax_rate: float = 0
    exemption_code: str = ""
    country_code: str = ""
    # State filing
    state_income: float = 0
    filing_state: str = ""
    state_payer_id: str = ""
    state_tax_withheld: float = 0

class SubmitForms(BaseModel):
    form_ids: List[str]
    tax_year: str = ""

class IRISConfig(BaseModel):
    api_client_id: str = ""
    iris_user_id: str = ""
    environment: str = ""


# ─── Dashboard ─────────────────────────────────────────────────

@iris_router.get('/dashboard')
async def get_iris_dashboard(current_user: dict = Depends(get_admin_user)):
    """Get IRIS filing dashboard statistics"""
    try:
        return await iris_service.get_dashboard_stats()
    except Exception as e:
        logger.error(f"Error getting IRIS dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── ATS Testing ──────────────────────────────────────────────

@iris_router.post('/ats-test')
async def run_ats_test(current_user: dict = Depends(get_admin_user)):
    """Run ATS (Assurance Testing System) test submission with dummy data"""
    try:
        result = await iris_service.run_ats_test()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"ATS test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@iris_router.get('/status/{transmission_id}')
async def check_submission_status(transmission_id: str, current_user: dict = Depends(get_admin_user)):
    """Check the status of a transmission with the IRS"""
    try:
        return await iris_service.check_submission_status(transmission_id)
    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Recipients ────────────────────────────────────────────────

@iris_router.get('/recipients')
async def list_recipients(
    search: str = "",
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_admin_user)
):
    """List 1099 recipients"""
    try:
        return await iris_service.list_recipients(search=search, page=page, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.post('/recipients')
async def create_recipient(data: RecipientCreate, current_user: dict = Depends(get_admin_user)):
    """Create a new 1099 recipient"""
    try:
        return await iris_service.create_recipient(data.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@iris_router.put('/recipients/{recipient_id}')
async def update_recipient(recipient_id: str, data: RecipientUpdate, current_user: dict = Depends(get_admin_user)):
    """Update a recipient"""
    try:
        return await iris_service.update_recipient(recipient_id, data.dict(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@iris_router.delete('/recipients/{recipient_id}')
async def delete_recipient(recipient_id: str, current_user: dict = Depends(get_admin_user)):
    """Delete a recipient"""
    try:
        return await iris_service.delete_recipient(recipient_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Forms ─────────────────────────────────────────────────────

@iris_router.get('/forms')
async def list_forms(
    form_type: str = "",
    status: str = "",
    tax_year: str = "",
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_admin_user)
):
    """List 1099 forms"""
    try:
        return await iris_service.list_forms(
            form_type=form_type, status=status, tax_year=tax_year,
            page=page, limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.post('/forms')
async def create_form(data: Form1099Create, current_user: dict = Depends(get_admin_user)):
    """Create a new 1099 form"""
    try:
        return await iris_service.create_1099_form(data.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.put('/forms/{form_id}')
async def update_form(form_id: str, data: dict = Body(...), current_user: dict = Depends(get_admin_user)):
    """Update a draft form"""
    try:
        return await iris_service.update_form(form_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.delete('/forms/{form_id}')
async def delete_form(form_id: str, current_user: dict = Depends(get_admin_user)):
    """Delete a draft form"""
    try:
        return await iris_service.delete_form(form_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Submissions ───────────────────────────────────────────────

@iris_router.post('/submit')
async def submit_forms(data: SubmitForms, current_user: dict = Depends(get_admin_user)):
    """Submit forms to IRS IRIS"""
    try:
        return await iris_service.submit_forms(data.form_ids, data.tax_year)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"IRIS submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.get('/submissions')
async def list_submissions(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_admin_user)
):
    """List submission history"""
    try:
        total = await iris_service.db.iris_submissions.count_documents({})
        skip = (page - 1) * limit
        subs = await iris_service.db.iris_submissions.find().sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return {
            "submissions": [{
                "id": str(s["_id"]),
                "transmission_id": s.get("transmission_id"),
                "tax_year": s.get("tax_year"),
                "environment": s.get("environment"),
                "status": s.get("status"),
                "forms_count": s.get("forms_count", 0),
                "total_amount": s.get("total_amount", 0),
                "error_message": s.get("error_message"),
                "submitted_at": s.get("submitted_at", "").isoformat() if s.get("submitted_at") else None
            } for s in subs],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.get('/submissions/{submission_id}')
async def get_submission(submission_id: str, current_user: dict = Depends(get_admin_user)):
    """Get submission details"""
    try:
        return await iris_service.get_submission_detail(submission_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Configuration ─────────────────────────────────────────────

@iris_router.post('/config')
async def update_config(data: IRISConfig, current_user: dict = Depends(get_admin_user)):
    """Update IRIS API configuration"""
    try:
        return await iris_service.update_configuration(data.dict(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@iris_router.get('/config')
async def get_config(current_user: dict = Depends(get_admin_user)):
    """Get current IRIS configuration"""
    try:
        return {
            "api_client_id": "***" + iris_service.api_client_id[-4:] if iris_service.api_client_id else "",
            "iris_user_id": "***" + iris_service.iris_user_id[-4:] if iris_service.iris_user_id else "",
            "environment": iris_service.environment,
            "tcc": "DH55D",
            "portal_tcc": "DH55F",
            "ein": "33-1240497"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 1: CSV/Excel Bulk Import ──────────────────────────

@iris_router.post('/bulk-import')
async def bulk_import_recipients(current_user: dict = Depends(get_admin_user)):
    """Import recipients and forms from CSV/Excel file"""
    from fastapi import UploadFile, File, Request
    from starlette.requests import Request as StarletteRequest
    import json
    
    # Manual file parsing from request body
    try:
        from starlette.datastructures import UploadFile as StarletteUpload
        
        # We need to handle this differently - get raw request
        raise HTTPException(
            status_code=501,
            detail="Use /bulk-import-file endpoint with multipart/form-data"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@iris_router.post('/bulk-import-file')
async def bulk_import_file(
    file: bytes = Body(...),
    filename: str = Body("upload.csv"),
    current_user: dict = Depends(get_admin_user)
):
    """Import recipients from uploaded file (base64 encoded)"""
    import base64
    try:
        # Decode base64 file content
        file_content = base64.b64decode(file) if isinstance(file, str) else file
        result = await iris_service.bulk_import_recipients(file_content, filename)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Bulk import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkImportRequest(BaseModel):
    file_content: str  # base64 encoded
    filename: str = "upload.csv"


@iris_router.post('/import')
async def import_recipients(
    data: BulkImportRequest,
    current_user: dict = Depends(get_admin_user)
):
    """Import recipients and forms from CSV/Excel (base64 encoded content)"""
    import base64
    try:
        file_bytes = base64.b64decode(data.file_content)
        result = await iris_service.bulk_import_recipients(file_bytes, data.filename)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 2: PDF Copy B Generation ─────────────────────────

@iris_router.get('/forms/{form_id}/copy-b')
async def download_copy_b(form_id: str, current_user: dict = Depends(get_admin_user)):
    """Download Copy B PDF for a 1099 form"""
    from fastapi.responses import Response
    try:
        pdf_bytes = await iris_service.generate_copy_b_pdf(form_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=CopyB_{form_id}.pdf"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 3: Email Copy B ──────────────────────────────────

@iris_router.post('/forms/{form_id}/email-copy-b')
async def email_copy_b(form_id: str, current_user: dict = Depends(get_admin_user)):
    """Email Copy B PDF to the recipient"""
    try:
        result = await iris_service.email_copy_b(form_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Email error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkEmailRequest(BaseModel):
    form_ids: List[str]


@iris_router.post('/email-copy-b/bulk')
async def bulk_email_copy_b(data: BulkEmailRequest, current_user: dict = Depends(get_admin_user)):
    """Email Copy B to multiple recipients"""
    try:
        result = await iris_service.bulk_email_copy_b(data.form_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 4: TIN Matching ──────────────────────────────────

class TINValidateRequest(BaseModel):
    tin: str
    name: str
    tin_type: str = "SSN"


@iris_router.post('/tin-match')
async def validate_tin(data: TINValidateRequest, current_user: dict = Depends(get_admin_user)):
    """Validate a single TIN against IRS records"""
    try:
        result = await iris_service.validate_tin(data.tin, data.name, data.tin_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BulkTINRequest(BaseModel):
    recipient_ids: List[str] = []


@iris_router.post('/tin-match/bulk')
async def bulk_validate_tins(data: BulkTINRequest, current_user: dict = Depends(get_admin_user)):
    """Validate TINs for multiple recipients"""
    try:
        result = await iris_service.bulk_validate_tins(data.recipient_ids if data.recipient_ids else None)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 5: Corrections ───────────────────────────────────

class CorrectionRequest(BaseModel):
    corrected_amounts: Dict[str, float]


@iris_router.post('/forms/{form_id}/correct')
async def submit_correction(form_id: str, data: CorrectionRequest, current_user: dict = Depends(get_admin_user)):
    """Create a correction for a previously submitted form"""
    try:
        result = await iris_service.submit_correction(form_id, data.corrected_amounts)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 6: Deadline Reminders ────────────────────────────

@iris_router.get('/deadlines')
async def get_deadlines(current_user: dict = Depends(get_admin_user)):
    """Get upcoming 1099 filing deadlines and alerts"""
    try:
        return await iris_service.check_deadlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Feature 7: Filing Summary ────────────────────────────────

@iris_router.get('/summary')
async def get_filing_summary(tax_year: str = "", current_user: dict = Depends(get_admin_user)):
    """Get comprehensive filing summary for a tax year"""
    try:
        return await iris_service.get_filing_summary(tax_year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Submission Status Check ──────────────────────────────────

@iris_router.get('/transmission/{transmission_id}/status')
async def get_transmission_status(transmission_id: str, current_user: dict = Depends(get_admin_user)):
    """Check the status of a transmission with the IRS"""
    try:
        return await iris_service.check_submission_status(transmission_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── CSV Template Download ────────────────────────────────────

@iris_router.get('/template/csv')
async def download_csv_template(current_user: dict = Depends(get_admin_user)):
    """Download a CSV template for bulk import"""
    from fastapi.responses import Response
    
    csv_content = """name,business_name,tin_type,tin,address,city,state,zip,email,phone,form_type,amount,federal_tax_withheld,tax_year
John Doe,,SSN,000-11-1111,123 Main St,Dumas,TX,79029,john@example.com,8005551234,1099-NEC,5000.00,0.00,2025
Jane Smith,Smith LLC,EIN,00-2222222,456 Oak Ave,Dumas,TX,79029,jane@example.com,8005555678,1099-NEC,7500.00,500.00,2025
"""
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=iris_import_template.csv"
        }
    )
