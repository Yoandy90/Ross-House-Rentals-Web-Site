"""
IRS Transcript Delivery System (TDS) API Endpoints
Admin endpoints for requesting and managing tax transcripts (W-2, 1099, Tax Return, etc.)
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List, Dict

logger = logging.getLogger(__name__)

tds_router = APIRouter(prefix="/admin/tds", tags=["TDS Transcripts"])

# Service and auth instances
tds_service = None
_get_current_user = None


def set_tds_service(service, auth_func=None):
    global tds_service, _get_current_user
    tds_service = service
    _get_current_user = auth_func
    logger.info("📋 TDS endpoints initialized")


async def get_admin_user(authorization: Optional[str] = Header(None)):
    """Auth wrapper"""
    if _get_current_user:
        return await _get_current_user(authorization)
    raise HTTPException(status_code=401, detail="Auth not configured")


# ─── Transcript Types ─────────────────────────────────────────

@tds_router.get('/transcript-types')
async def get_transcript_types(current_user: dict = Depends(get_admin_user)):
    """Get available transcript types"""
    try:
        return {"types": tds_service.get_transcript_types()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Request Transcript ───────────────────────────────────────

class TranscriptRequest(BaseModel):
    client_tin: str
    client_name: str
    transcript_type: str  # wage_income, tax_return, account, record_of_account, verification_nonfiling
    tax_year: str
    client_id: str = ""
    client_address: str = ""
    client_dob: str = ""


@tds_router.post('/request')
async def request_transcript(data: TranscriptRequest, current_user: dict = Depends(get_admin_user)):
    """Request a transcript from the IRS"""
    try:
        result = await tds_service.request_transcript(
            client_tin=data.client_tin,
            client_name=data.client_name,
            transcript_type=data.transcript_type,
            tax_year=data.tax_year,
            client_id=data.client_id,
            client_address=data.client_address,
            client_dob=data.client_dob
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Transcript request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Bulk Request ─────────────────────────────────────────────

class BulkTranscriptRequest(BaseModel):
    requests: List[Dict]  # [{tin, name, tax_year, client_id, address, dob}]
    transcript_type: str = "wage_income"


@tds_router.post('/request/bulk')
async def bulk_request_transcripts(data: BulkTranscriptRequest, current_user: dict = Depends(get_admin_user)):
    """Request transcripts for multiple clients"""
    try:
        result = await tds_service.bulk_request_transcripts(
            requests=data.requests,
            transcript_type=data.transcript_type
        )
        return result
    except Exception as e:
        logger.error(f"Bulk transcript request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Check Status ─────────────────────────────────────────────

@tds_router.get('/request/{request_id}/status')
async def check_request_status(request_id: str, current_user: dict = Depends(get_admin_user)):
    """Check the status of a transcript request"""
    try:
        return await tds_service.check_request_status(request_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Download Transcript ──────────────────────────────────────

@tds_router.get('/request/{request_id}/download')
async def download_transcript(request_id: str, current_user: dict = Depends(get_admin_user)):
    """Download a completed transcript"""
    from fastapi.responses import Response
    try:
        result = await tds_service.download_transcript(request_id)
        return Response(
            content=result["content"],
            media_type=result.get("content_type", "application/pdf"),
            headers={
                "Content-Disposition": f"attachment; filename=transcript_{request_id}.pdf"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Search by TIN ────────────────────────────────────────────

class TINSearchRequest(BaseModel):
    tin: str


@tds_router.post('/search')
async def search_by_tin(data: TINSearchRequest, current_user: dict = Depends(get_admin_user)):
    """Search for existing transcript requests by TIN"""
    try:
        return await tds_service.search_by_tin(data.tin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── List Requests ────────────────────────────────────────────

@tds_router.get('/requests')
async def list_requests(
    page: int = 1,
    limit: int = 20,
    status: str = "",
    transcript_type: str = "",
    current_user: dict = Depends(get_admin_user)
):
    """List transcript requests with filtering"""
    try:
        return await tds_service.list_requests(page, limit, status, transcript_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dashboard ────────────────────────────────────────────────

@tds_router.get('/dashboard')
async def get_dashboard(current_user: dict = Depends(get_admin_user)):
    """Get TDS dashboard statistics"""
    try:
        return await tds_service.get_dashboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
