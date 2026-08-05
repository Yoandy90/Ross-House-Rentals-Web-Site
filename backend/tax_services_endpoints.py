"""
Tax Services API Endpoints
1. Transcript Auto-Populate
2. Refund Status Tracker
3. 1099 Service Billing
4. Client 1099 Dashboard
"""

import logging
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

tax_services_router = APIRouter(tags=["Tax Services"])

# Service instances
transcript_parser = None
refund_tracker = None
service_billing = None
client_dashboard = None
_get_current_user = None
_get_client_user = None


def set_tax_services(parser, tracker, billing, dashboard, admin_auth=None, client_auth=None):
    global transcript_parser, refund_tracker, service_billing, client_dashboard, _get_current_user, _get_client_user
    transcript_parser = parser
    refund_tracker = tracker
    service_billing = billing
    client_dashboard = dashboard
    _get_current_user = admin_auth
    _get_client_user = client_auth
    logger.info("📋 Tax Services endpoints initialized (Transcripts, Refunds, Billing, Client Dashboard)")


async def get_admin_user(authorization: Optional[str] = Header(None)):
    if _get_current_user:
        return await _get_current_user(authorization)
    raise HTTPException(status_code=401, detail="Auth not configured")


async def get_client(authorization: Optional[str] = Header(None)):
    if _get_client_user:
        return await _get_client_user(authorization)
    if _get_current_user:
        return await _get_current_user(authorization)
    raise HTTPException(status_code=401, detail="Auth not configured")


# ═══════════════════════════════════════════════════════════════
# Feature 1: Transcript Parser / Auto-Populate
# ═══════════════════════════════════════════════════════════════

class ParseTranscriptRequest(BaseModel):
    client_id: str
    transcript_text: str
    tax_year: str = ""


@tax_services_router.post('/admin/transcripts/parse')
async def parse_transcript(data: ParseTranscriptRequest, current_user: dict = Depends(get_admin_user)):
    """Parse a W&I transcript and extract W-2/1099 data"""
    try:
        result = await transcript_parser.parse_wage_income_transcript(
            client_id=data.client_id,
            transcript_text=data.transcript_text,
            tax_year=data.tax_year
        )
        return result
    except Exception as e:
        logger.error(f"Parse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/admin/transcripts/parsed/{client_id}')
async def get_parsed_transcript(client_id: str, tax_year: str = "", current_user: dict = Depends(get_admin_user)):
    """Get parsed transcript data for a client"""
    try:
        result = await transcript_parser.get_parsed_data(client_id, tax_year)
        if not result:
            raise HTTPException(status_code=404, detail="No parsed transcript found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# Feature 2: Refund Status Tracker
# ═══════════════════════════════════════════════════════════════

class CreateTrackerRequest(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    tax_year: str
    filing_type: str = "e-file"
    filing_status: str = "single"
    refund_amount: float
    filed_date: str = ""
    refund_method: str = "direct_deposit"


@tax_services_router.post('/admin/refund-tracker')
async def create_refund_tracker(data: CreateTrackerRequest, current_user: dict = Depends(get_admin_user)):
    """Create a refund status tracker for a client"""
    try:
        result = await refund_tracker.create_refund_tracker(
            client_id=data.client_id,
            client_name=data.client_name,
            client_email=data.client_email,
            tax_year=data.tax_year,
            filing_type=data.filing_type,
            filing_status=data.filing_status,
            refund_amount=data.refund_amount,
            filed_date=data.filed_date,
            refund_method=data.refund_method
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateStageRequest(BaseModel):
    new_stage: str
    note: str = ""


@tax_services_router.put('/admin/refund-tracker/{tracker_id}/stage')
async def update_refund_stage(tracker_id: str, data: UpdateStageRequest, current_user: dict = Depends(get_admin_user)):
    """Update the refund stage for a tracker"""
    try:
        return await refund_tracker.update_stage(tracker_id, data.new_stage, data.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/admin/refund-trackers')
async def list_refund_trackers(page: int = 1, limit: int = 20, status: str = "", current_user: dict = Depends(get_admin_user)):
    """List all refund trackers (admin)"""
    try:
        return await refund_tracker.list_all_trackers(page, limit, status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/admin/refund-tracker/dashboard')
async def refund_dashboard(current_user: dict = Depends(get_admin_user)):
    """Get refund tracking dashboard"""
    try:
        return await refund_tracker.get_dashboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# Feature 3: Service Billing
# ═══════════════════════════════════════════════════════════════

@tax_services_router.get('/admin/billing/pricing')
async def get_pricing(current_user: dict = Depends(get_admin_user)):
    """Get current 1099 service pricing"""
    try:
        return await service_billing.get_pricing()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.put('/admin/billing/pricing')
async def update_pricing(pricing: Dict, current_user: dict = Depends(get_admin_user)):
    """Update pricing table"""
    try:
        return await service_billing.update_pricing(pricing)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateInvoiceRequest(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    items: List[Dict]
    notes: str = ""


@tax_services_router.post('/admin/billing/invoice')
async def create_invoice(data: CreateInvoiceRequest, current_user: dict = Depends(get_admin_user)):
    """Create a service invoice"""
    try:
        return await service_billing.create_service_invoice(
            client_id=data.client_id,
            client_name=data.client_name,
            client_email=data.client_email,
            items=data.items,
            notes=data.notes
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/admin/billing/invoices')
async def list_invoices(client_id: str = "", status: str = "", page: int = 1, limit: int = 20, current_user: dict = Depends(get_admin_user)):
    """List service invoices"""
    try:
        return await service_billing.list_invoices(client_id, status, page, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateInvoiceStatus(BaseModel):
    status: str  # "pending", "paid", "cancelled"


@tax_services_router.put('/admin/billing/invoice/{invoice_id}')
async def update_invoice(invoice_id: str, data: UpdateInvoiceStatus, current_user: dict = Depends(get_admin_user)):
    """Update invoice status"""
    try:
        return await service_billing.update_invoice_status(invoice_id, data.status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/admin/billing/dashboard')
async def billing_dashboard(current_user: dict = Depends(get_admin_user)):
    """Get billing dashboard"""
    try:
        return await service_billing.get_billing_dashboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# Feature 4: Client Dashboard API (for Mobile App)
# ═══════════════════════════════════════════════════════════════

@tax_services_router.get('/client/tax-dashboard')
async def get_client_tax_dashboard(current_user: dict = Depends(get_client)):
    """Get client's 1099/tax dashboard (for mobile app)"""
    try:
        email = current_user.get("email", "")
        if not email:
            raise HTTPException(status_code=400, detail="User email not found")
        return await client_dashboard.get_client_dashboard(email)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/client/tax-forms')
async def get_client_forms(tax_year: str = "", current_user: dict = Depends(get_client)):
    """Get client's 1099 forms"""
    try:
        email = current_user.get("email", "")
        return await client_dashboard.get_client_forms(email, tax_year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_services_router.get('/client/refund-status')
async def get_client_refund_status(current_user: dict = Depends(get_client)):
    """Get client's refund tracking status"""
    try:
        email = current_user.get("email", "")
        return await refund_tracker.get_client_trackers(client_email=email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
