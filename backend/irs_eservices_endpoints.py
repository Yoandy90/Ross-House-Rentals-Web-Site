"""
IRS e-Services API Endpoints
Routes for TINM, TDS, and SOR services.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/irs-eservices", tags=["IRS e-Services"])


class TINVerifyRequest(BaseModel):
    tin: str
    name: str
    tin_type: str = "SSN"  # SSN, EIN, UNKNOWN


class TINBulkVerifyRequest(BaseModel):
    records: list  # [{"tin": "...", "name": "...", "tin_type": "SSN"}, ...]


class TranscriptRequest(BaseModel):
    taxpayer_tin: str
    taxpayer_name: str
    transcript_type: str  # return, account, wage_income, record_of_account, verification_nonfiling
    tax_year: int
    caf_number: str = ""


# ============================================
# DEPENDENCY
# ============================================

async def get_service_and_admin(request: Request):
    from server import db, require_admin
    from irs_eservices import IRSEServicesService
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        auth_header = auth_header[7:]
    user = await require_admin(authorization=auth_header)
    admin_id = str(user.get('_id', user.get('id')))
    service = IRSEServicesService(db)
    return service, admin_id


# ============================================
# STATUS / DIAGNOSTICS
# ============================================

@router.get("/status")
async def irs_eservices_status(request: Request):
    """Check connectivity to all IRS e-Services"""
    service, admin_id = await get_service_and_admin(request)
    return await service.check_service_status()


# ============================================
# TINM — TIN MATCHING
# ============================================

@router.post("/tinm/verify")
async def verify_tin(data: TINVerifyRequest, request: Request):
    """Verify a single TIN (SSN/EIN) against IRS records"""
    service, admin_id = await get_service_and_admin(request)
    return await service.verify_tin(
        tin=data.tin,
        name=data.name,
        tin_type=data.tin_type,
        admin_id=admin_id,
    )


@router.post("/tinm/verify-bulk")
async def verify_tin_bulk(data: TINBulkVerifyRequest, request: Request):
    """Verify up to 25 TINs at once"""
    service, admin_id = await get_service_and_admin(request)
    return await service.verify_tin_bulk(
        records=data.records,
        admin_id=admin_id,
    )


@router.get("/tinm/history")
async def tinm_history(request: Request, limit: int = 50):
    """Get TIN verification history"""
    service, admin_id = await get_service_and_admin(request)
    history = await service.get_tinm_history(admin_id, limit)
    return {"history": history, "count": len(history)}


# ============================================
# TDS — TRANSCRIPT DELIVERY
# ============================================

@router.post("/tds/request")
async def request_transcript(data: TranscriptRequest, request: Request):
    """Request a tax transcript from the IRS"""
    service, admin_id = await get_service_and_admin(request)
    return await service.request_transcript(
        taxpayer_tin=data.taxpayer_tin,
        taxpayer_name=data.taxpayer_name,
        transcript_type=data.transcript_type,
        tax_year=data.tax_year,
        admin_id=admin_id,
        caf_number=data.caf_number,
    )


@router.get("/tds/status/{request_id}")
async def transcript_status(request_id: str, request: Request):
    """Check status of a transcript request"""
    service, admin_id = await get_service_and_admin(request)
    return await service.check_transcript_status(request_id)


@router.get("/tds/history")
async def transcript_history(request: Request, limit: int = 50):
    """Get transcript request history"""
    service, admin_id = await get_service_and_admin(request)
    history = await service.get_transcript_history(admin_id, limit)
    return {"history": history, "count": len(history)}


@router.get("/tds/types")
async def transcript_types(request: Request):
    """Get available transcript types"""
    service, admin_id = await get_service_and_admin(request)
    types = await service.get_available_transcript_types()
    return {"types": types}


# ============================================
# SOR — SOFTWARE DEVELOPER ONLINE RESOURCE
# ============================================

@router.get("/sor/mailbox")
async def sor_mailbox(request: Request):
    """Check IRS developer mailbox"""
    service, admin_id = await get_service_and_admin(request)
    return await service.get_sor_mailbox(admin_id)


@router.get("/sor/alerts")
async def sor_alerts(request: Request):
    """Get IRS developer alerts"""
    service, admin_id = await get_service_and_admin(request)
    return await service.get_sor_alerts(admin_id)


@router.get("/sor/schemas")
async def sor_schemas(request: Request, form_type: str = ""):
    """Get available IRS XML schemas"""
    service, admin_id = await get_service_and_admin(request)
    return await service.get_sor_schemas(form_type)


@router.get("/sor/history")
async def sor_message_history(request: Request, limit: int = 50):
    """Get cached SOR messages"""
    service, admin_id = await get_service_and_admin(request)
    history = await service.get_sor_message_history(admin_id, limit)
    return {"messages": history, "count": len(history)}
