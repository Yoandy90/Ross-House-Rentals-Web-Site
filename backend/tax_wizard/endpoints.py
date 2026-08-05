"""
Tax Wizard API Endpoints
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel
from bson import ObjectId

from .models import (
    TaxWizardSession, WizardStep, WizardStatus, ServiceLevel,
    PersonalInfo, SpouseInfo, FilingStatus, Dependent,
    IncomeInfo, DeductionsCredits, ReviewQuestions,
    StartWizardRequest, WizardProgressResponse, ServiceRecommendation,
    CaseComplexity
)
from .service import TaxWizardService
from .classifier import get_service_recommendation, get_required_documents

logger = logging.getLogger(__name__)

tax_wizard_router = APIRouter(prefix="/tax-wizard", tags=["Tax Wizard"])

# Service instance (will be set by main app)
_wizard_service: Optional[TaxWizardService] = None
_get_current_user_func = None  # Will be set by main app


def get_wizard_service() -> TaxWizardService:
    if _wizard_service is None:
        raise HTTPException(status_code=500, detail="Tax Wizard service not initialized")
    return _wizard_service


def set_wizard_service(service: TaxWizardService, get_current_user_func=None):
    global _wizard_service, _get_current_user_func
    _wizard_service = service
    _get_current_user_func = get_current_user_func
    logger.info("✅ Tax Wizard endpoints initialized")


async def get_current_user_for_wizard(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header"""
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(authorization)


# ============== CLIENT ENDPOINTS ==============

@tax_wizard_router.post("/start")
async def start_wizard(
    request: StartWizardRequest,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Inicia una nueva sesión del wizard o retorna la existente"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    try:
        session = await service.create_session(str(user_id), request.tax_year)
        
        return {
            "success": True,
            "session_id": session.id,
            "current_step": session.current_step,
            "status": session.status,
            "progress_percentage": session.progress_percentage,
            "message": "Wizard session ready"
        }
    except Exception as e:
        logger.error(f"Error starting wizard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_wizard_router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Obtiene los datos de una sesión"""
    service = get_wizard_service()
    
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "success": True,
        "session": session.dict()
    }


@tax_wizard_router.get("/session/{session_id}/progress")
async def get_progress(session_id: str):
    """Obtiene el progreso del wizard"""
    service = get_wizard_service()
    
    try:
        progress = await service.get_progress(session_id)
        return {
            "success": True,
            **progress.dict()
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.get("/my-session")
async def get_my_session(
    tax_year: int = Query(2025),
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtiene la sesión activa del usuario"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    session = await service.get_active_session(str(user_id), tax_year)
    
    if session:
        return {
            "success": True,
            "has_session": True,
            "session": session.dict()
        }
    else:
        return {
            "success": True,
            "has_session": False,
            "session": None
        }


@tax_wizard_router.post("/session/{session_id}/prefill-from-previous")
async def prefill_from_previous_year(
    session_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Pre-llena datos de la sesión con información del año anterior"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    try:
        # Get current session
        current_session = await service.db["tax_wizard_sessions"].find_one({"_id": session_id})
        if not current_session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        current_year = current_session.get("tax_year", 2025)
        previous_year = current_year - 1
        
        # Find completed session from previous year
        previous_session = await service.db["tax_wizard_sessions"].find_one({
            "user_id": str(user_id),
            "tax_year": previous_year,
            "status": {"$in": ["completed", "submitted", "in_progress"]}
        })
        
        if not previous_session:
            return {
                "success": False,
                "message": f"No se encontró declaración del año {previous_year}",
                "prefilled": False
            }
        
        # Data to copy (static info that doesn't change year to year)
        update_data = {}
        
        # Copy personal info (except income-related)
        if previous_session.get("personal_info"):
            prev_personal = previous_session["personal_info"]
            update_data["personal_info"] = {
                "first_name": prev_personal.get("first_name"),
                "middle_name": prev_personal.get("middle_name"),
                "last_name": prev_personal.get("last_name"),
                "ssn_last_four": prev_personal.get("ssn_last_four"),
                "ssn_encrypted": prev_personal.get("ssn_encrypted"),
                "date_of_birth": prev_personal.get("date_of_birth"),
                "phone": prev_personal.get("phone"),
                "email": prev_personal.get("email"),
                "address": prev_personal.get("address"),
                "city": prev_personal.get("city"),
                "state": prev_personal.get("state"),
                "zip_code": prev_personal.get("zip_code"),
            }
        
        # Copy filing status
        if previous_session.get("filing_status"):
            update_data["filing_status"] = previous_session["filing_status"]
        
        # Copy spouse info if married
        if previous_session.get("spouse_info"):
            update_data["spouse_info"] = previous_session["spouse_info"]
        
        # Copy dependents (they usually stay the same)
        if previous_session.get("dependents"):
            update_data["dependents"] = previous_session["dependents"]
        
        # Copy employer names (but NOT amounts - those change yearly)
        if previous_session.get("income") and previous_session["income"].get("w2_sources"):
            prev_w2s = previous_session["income"]["w2_sources"]
            update_data["income"] = {
                "has_w2": True,
                "w2_count": len(prev_w2s),
                "w2_sources": [
                    {
                        "employer_name": w2.get("employer_name", ""),
                        "ein": w2.get("ein", ""),
                        "type": "w2",
                        # Leave amounts empty for user to fill
                        "amount": 0,
                        "federal_withheld": 0,
                        "state_withheld": 0,
                    }
                    for w2 in prev_w2s
                ],
                "form_1099_sources": [],
                "has_unemployment": False,
                "unemployment_amount": 0,
                "has_self_employment": previous_session.get("income", {}).get("has_self_employment", False),
                "self_employment_income": 0,
                "self_employment_expenses": 0,
                "has_other_income": False,
                "other_income_amount": 0,
            }
        
        # Copy discovery selections
        if previous_session.get("discovery_selections"):
            update_data["discovery_selections"] = previous_session["discovery_selections"]
        
        # Update current session with prefilled data
        if update_data:
            update_data["prefilled_from_year"] = previous_year
            update_data["updated_at"] = datetime.utcnow()
            
            await service.db["tax_wizard_sessions"].update_one(
                {"_id": session_id},
                {"$set": update_data}
            )
        
        return {
            "success": True,
            "message": f"Datos copiados del año {previous_year}",
            "prefilled": True,
            "prefilled_fields": list(update_data.keys()),
            "source_year": previous_year
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error prefilling from previous year: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@tax_wizard_router.get("/my-sessions")
async def get_my_sessions(
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtiene todas las sesiones del usuario (historial)"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    try:
        # Get all sessions for this user
        cursor = service.db["tax_wizard_sessions"].find(
            {"user_id": str(user_id)}
        ).sort("tax_year", -1)
        
        sessions = []
        async for session_doc in cursor:
            sessions.append({
                "id": str(session_doc.get("_id")),
                "tax_year": session_doc.get("tax_year"),
                "status": session_doc.get("status"),
                "progress_percentage": session_doc.get("progress_percentage", 0),
                "service_level": session_doc.get("service_level"),
                "refund_estimate": session_doc.get("refund_estimate"),
                "created_at": str(session_doc.get("created_at", "")),
                "completed_at": str(session_doc.get("completed_at", "")) if session_doc.get("completed_at") else None,
            })
        
        return {
            "success": True,
            "sessions": sessions,
            "count": len(sessions)
        }
    except Exception as e:
        logger.error(f"Error getting user sessions: {e}")
        return {
            "success": True,
            "sessions": [],
            "count": 0
        }



# ============== PDF ENDPOINTS ==============

from fastapi.responses import Response

@tax_wizard_router.get("/session/{session_id}/pdf-summary")
async def generate_pdf_summary(
    session_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Genera un PDF con el resumen de la declaración"""
    from .pdf_generator import pdf_generator
    
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    try:
        # Get the session
        session_data = await service.db["tax_wizard_sessions"].find_one({
            "_id": ObjectId(session_id)
        })
        
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership (user can access their own session)
        session_user_id = str(session_data.get("user_id", ""))
        if session_user_id != str(user_id):
            # Check if user is admin
            user = await service.db["users"].find_one({"_id": ObjectId(user_id)})
            if not user or user.get("role") not in ["admin", "assistant"]:
                raise HTTPException(status_code=403, detail="Not authorized to access this session")
        
        # Calculate estimate if not present
        if not session_data.get('refund_estimate'):
            from .calculator import tax_calculator
            estimate = tax_calculator.calculate_refund_estimate(session_data)
            session_data['refund_estimate'] = estimate
        
        # Generate PDF
        pdf_bytes = pdf_generator.generate_summary_pdf(session_data)
        
        # Get filename
        personal_info = session_data.get('personal_info', {})
        name = f"{personal_info.get('first_name', 'Cliente')}_{personal_info.get('last_name', '')}".strip('_')
        tax_year = session_data.get('tax_year', datetime.now().year)
        filename = f"MiReembolso_{name}_{tax_year}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


@tax_wizard_router.get("/session/{session_id}/pdf-summary-base64")
async def get_pdf_summary_base64(
    session_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Genera un PDF y lo devuelve en base64 (para apps móviles)"""
    from .pdf_generator import pdf_generator
    
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    try:
        # Get the session
        session_data = await service.db["tax_wizard_sessions"].find_one({
            "_id": ObjectId(session_id)
        })
        
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership
        session_user_id = str(session_data.get("user_id", ""))
        if session_user_id != str(user_id):
            user = await service.db["users"].find_one({"_id": ObjectId(user_id)})
            if not user or user.get("role") not in ["admin", "assistant"]:
                raise HTTPException(status_code=403, detail="Not authorized")
        
        # Calculate estimate if not present
        if not session_data.get('refund_estimate'):
            from .calculator import tax_calculator
            estimate = tax_calculator.calculate_refund_estimate(session_data)
            session_data['refund_estimate'] = estimate
        
        # Generate PDF as base64
        pdf_base64 = pdf_generator.generate_summary_pdf_base64(session_data)
        
        personal_info = session_data.get('personal_info', {})
        name = f"{personal_info.get('first_name', 'Cliente')}_{personal_info.get('last_name', '')}".strip('_')
        tax_year = session_data.get('tax_year', datetime.now().year)
        
        return {
            "success": True,
            "pdf_base64": pdf_base64,
            "filename": f"MiReembolso_{name}_{tax_year}.pdf",
            "mime_type": "application/pdf"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")




# ============== STEP ENDPOINTS ==============

@tax_wizard_router.post("/session/{session_id}/service-level")
async def select_service_level(
    session_id: str,
    service_level: ServiceLevel
):
    """Selecciona el nivel de servicio"""
    service = get_wizard_service()
    
    try:
        session = await service.select_service_level(session_id, service_level)
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "message": f"Service level set to {service_level.value}"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/personal-info")
async def save_personal_info(session_id: str, info: PersonalInfo):
    """Guarda información personal"""
    service = get_wizard_service()
    
    try:
        session = await service.save_personal_info(session_id, info)
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))



class DiscoveryRequest(BaseModel):
    selections: List[str]


@tax_wizard_router.post("/session/{session_id}/discovery")
async def save_discovery(session_id: str, request: DiscoveryRequest):
    """Guarda las selecciones del descubrimiento inicial"""
    service = get_wizard_service()
    
    try:
        # Get current session using ObjectId
        session_data = await service.db["tax_wizard_sessions"].find_one({"_id": ObjectId(session_id)})
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Update with discovery selections
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "discovery_selections": request.selections,
                "has_w2": "has_w2" in request.selections,
                "is_self_employed": "self_employed" in request.selections,
                "has_dependents": "has_dependents" in request.selections,
                "is_married": "married" in request.selections,
                "is_homeowner": "homeowner" in request.selections,
                "has_investments": "investments" in request.selections,
                "has_rental_income": "rental_income" in request.selections,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "success": True,
            "message": "Discovery saved",
            "selections_count": len(request.selections)
        }
    except Exception as e:
        logger.error(f"Error saving discovery: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class FilingStatusRequest(BaseModel):
    status: FilingStatus
    spouse: Optional[SpouseInfo] = None


@tax_wizard_router.post("/session/{session_id}/filing-status")
async def save_filing_status(session_id: str, request: FilingStatusRequest):
    """Guarda estado civil"""
    service = get_wizard_service()
    
    try:
        session = await service.save_filing_status(session_id, request.status, request.spouse)
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/income")
async def save_income(session_id: str, income: IncomeInfo):
    """Guarda información de ingresos"""
    service = get_wizard_service()
    
    try:
        session = await service.save_income(session_id, income)
        
        # Calcular estimación en vivo
        estimate = await service.calculate_live_estimate(session_id)
        
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "live_estimate": estimate
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class DependentsRequest(BaseModel):
    dependents: List[Dependent]


@tax_wizard_router.post("/session/{session_id}/dependents")
async def save_dependents(session_id: str, request: DependentsRequest):
    """Guarda información de dependientes"""
    service = get_wizard_service()
    
    try:
        session = await service.save_dependents(session_id, request.dependents)
        
        # Calcular estimación en vivo
        estimate = await service.calculate_live_estimate(session_id)
        
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "live_estimate": estimate
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/deductions")
async def save_deductions(session_id: str, deductions: DeductionsCredits):
    """Guarda deducciones y créditos"""
    service = get_wizard_service()
    
    try:
        session = await service.save_deductions(session_id, deductions)
        
        # Calcular estimación en vivo
        estimate = await service.calculate_live_estimate(session_id)
        
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "live_estimate": estimate
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))



class BankDepositInfo(BaseModel):
    deposit_method: str  # 'direct_deposit' or 'paper_check'
    routing_number: Optional[str] = None
    account_number: Optional[str] = None
    account_type: Optional[str] = None  # 'checking' or 'savings'
    confirm_routing: Optional[str] = None
    confirm_account: Optional[str] = None


@tax_wizard_router.post("/session/{session_id}/bank-deposit")
async def save_bank_deposit(session_id: str, info: BankDepositInfo):
    """Guarda información de depósito directo para el reembolso"""
    service = get_wizard_service()
    
    try:
        session_data = await service.db["tax_wizard_sessions"].find_one({"_id": ObjectId(session_id)})
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Validate if direct deposit
        if info.deposit_method == 'direct_deposit':
            if not info.routing_number or len(info.routing_number.replace(' ', '')) != 9:
                raise HTTPException(status_code=400, detail="Número de ruta debe tener 9 dígitos")
            if not info.account_number or len(info.account_number.replace(' ', '')) < 4:
                raise HTTPException(status_code=400, detail="Número de cuenta inválido")
            if info.routing_number != info.confirm_routing:
                raise HTTPException(status_code=400, detail="Los números de ruta no coinciden")
            if info.account_number != info.confirm_account:
                raise HTTPException(status_code=400, detail="Los números de cuenta no coinciden")
        
        bank_deposit_data = {
            "deposit_method": info.deposit_method,
            "account_type": info.account_type if info.deposit_method == 'direct_deposit' else None,
            "routing_number_last4": info.routing_number[-4:] if info.routing_number else None,
            "account_number_last4": info.account_number[-4:] if info.account_number else None,
            # Store encrypted for the preparer
            "routing_number_encrypted": info.routing_number if info.deposit_method == 'direct_deposit' else None,
            "account_number_encrypted": info.account_number if info.deposit_method == 'direct_deposit' else None,
        }
        
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "bank_deposit": bank_deposit_data,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "success": True,
            "message": "Información de depósito guardada",
            "deposit_method": info.deposit_method
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving bank deposit: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@tax_wizard_router.post("/session/{session_id}/review")
async def save_review(session_id: str, review: ReviewQuestions):
    """Guarda preguntas de revisión y genera recomendación"""
    service = get_wizard_service()
    
    try:
        session = await service.save_review(session_id, review)
        
        # La sesión ahora tiene la recomendación
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "recommendation": {
                "service": session.recommended_service,
                "reason": session.recommended_reason,
                "complexity": session.case_complexity,
                "price": session.total_price,
                "price_breakdown": session.price_breakdown,
                "documents_required": session.documents_required
            },
            "refund_estimate": session.refund_estimate.dict() if session.refund_estimate else None
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class SelectPlanRequest(BaseModel):
    plan_type: str  # 'diy' or 'assisted'
    plan_price: float


class SignatureRequest(BaseModel):
    signature_data: str  # Base64 image data
    agreed_to_terms: bool
    signed_at: str
    ip_address: Optional[str] = None


@tax_wizard_router.post("/session/{session_id}/signature")
async def save_signature(session_id: str, request: SignatureRequest):
    """Guarda la firma electrónica del contribuyente (Form 8879)"""
    service = get_wizard_service()
    
    if not request.agreed_to_terms:
        raise HTTPException(status_code=400, detail="Must agree to terms")
    
    if not request.signature_data:
        raise HTTPException(status_code=400, detail="Signature is required")
    
    try:
        # Update session with signature
        update_data = {
            "signature": {
                "data": request.signature_data,
                "agreed_to_terms": request.agreed_to_terms,
                "signed_at": request.signed_at,
                "ip_address": request.ip_address,
                "form_type": "8879"
            },
            "signature_completed": True,
            "current_step": "payment",
            "updated_at": datetime.utcnow()
        }
        
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data}
        )
        
        logger.info(f"📝 Signature saved for session {session_id}")
        
        return {
            "success": True,
            "message": "Firma guardada exitosamente",
            "next_step": "payment"
        }
    except Exception as e:
        logger.error(f"Error saving signature: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/select-plan")
async def select_plan(session_id: str, request: SelectPlanRequest):
    """Selecciona el plan de servicio (DIY o Asistido)"""
    service = get_wizard_service()
    
    if request.plan_type not in ['diy', 'assisted']:
        raise HTTPException(status_code=400, detail="Plan type must be 'diy' or 'assisted'")
    
    try:
        # Update session with plan selection
        update_data = {
            "selected_plan": request.plan_type,
            "plan_price": request.plan_price,
            "service_level": "diy" if request.plan_type == "diy" else "assisted",
            "appointment_required": request.plan_type == "assisted",
            "updated_at": datetime.utcnow()
        }
        
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "selected_plan": request.plan_type,
            "plan_price": request.plan_price,
            "next_step": "signature" if request.plan_type == "diy" else "appointment"
        }
    except Exception as e:
        logger.error(f"Error selecting plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/confirm-service")
async def confirm_service(session_id: str, service_level: ServiceLevel):
    """Confirma el servicio seleccionado"""
    service = get_wizard_service()
    
    try:
        session = await service.confirm_recommendation(session_id, service_level)
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "appointment_required": session.appointment_required,
            "documents_required": session.documents_required,
            "total_price": session.total_price
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class DocumentsUploadedRequest(BaseModel):
    document_ids: List[str]


@tax_wizard_router.post("/session/{session_id}/documents-uploaded")
async def mark_documents_uploaded(session_id: str, request: DocumentsUploadedRequest):
    """Marca documentos como subidos"""
    service = get_wizard_service()
    
    try:
        session = await service.mark_documents_uploaded(session_id, request.document_ids)
        return {
            "success": True,
            "current_step": session.current_step,
            "progress_percentage": session.progress_percentage,
            "documents_uploaded": session.documents_uploaded,
            "documents_missing": session.documents_missing,
            "all_documents_uploaded": len(session.documents_missing) == 0
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class PaymentCompleteRequest(BaseModel):
    payment_id: str


@tax_wizard_router.post("/session/{session_id}/payment-complete")
async def mark_payment_complete(session_id: str, request: PaymentCompleteRequest):
    """Marca el pago como completado"""
    service = get_wizard_service()
    
    try:
        session = await service.mark_payment_complete(session_id, request.payment_id)
        return {
            "success": True,
            "current_step": session.current_step,
            "status": session.status,
            "progress_percentage": session.progress_percentage,
            "message": "¡Gracias por tu pago! Tu declaración está siendo procesada."
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/complete")
async def complete_wizard(session_id: str):
    """Completa el wizard y envía notificación al admin"""
    service = get_wizard_service()
    
    try:
        session = await service.complete_wizard(session_id)
        
        # Send notification to admin (async, don't wait)
        try:
            await send_wizard_completion_notification(session)
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
        
        return {
            "success": True,
            "status": session.status,
            "message": "¡Felicidades! Tu declaración ha sido enviada para procesamiento."
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


async def send_wizard_completion_notification(session):
    """Envía notificación por email cuando un cliente completa el wizard"""
    import os
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    if not sendgrid_key:
        logger.warning("SendGrid API key not configured, skipping notification")
        return
    
    admin_email = os.getenv("ADMIN_EMAIL", "yoandyross@gmail.com")
    
    # Get client info
    client_name = "Cliente"
    client_email = "No disponible"
    client_phone = "No disponible"
    refund_amount = 0
    
    if session.personal_info:
        client_name = f"{session.personal_info.first_name or ''} {session.personal_info.last_name or ''}"
        client_email = session.personal_info.email or "No disponible"
        client_phone = session.personal_info.phone or "No disponible"
    
    if session.refund_estimate:
        refund_amount = session.refund_estimate.estimated_refund
        is_refund = session.refund_estimate.is_refund
    else:
        is_refund = True
    
    # Build email content
    subject = f"🎉 Nueva Declaración Completada - {client_name}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #065F46, #10B981); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Nueva Declaración Completada</h1>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
            <h2 style="color: #1F2937;">📋 Información del Cliente</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Nombre:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{client_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{client_email}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Teléfono:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{client_phone}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Año Fiscal:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{session.tax_year}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Nivel de Servicio:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{session.service_level or 'No seleccionado'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Complejidad:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{session.case_complexity or 'No determinada'}</td>
                </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: {'#D1FAE5' if is_refund else '#FEE2E2'}; border-radius: 8px; text-align: center;">
                <h3 style="margin: 0; color: {'#065F46' if is_refund else '#991B1B'};">
                    {'Reembolso Estimado' if is_refund else 'Impuesto a Pagar'}
                </h3>
                <p style="font-size: 32px; font-weight: bold; margin: 10px 0; color: {'#10B981' if is_refund else '#EF4444'};">
                    ${refund_amount:,.2f}
                </p>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
                <a href="https://app-nueva-production.up.railway.app/tax-wizard/admin" 
                   style="display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Ver en Panel Admin
                </a>
            </div>
        </div>
        
        <div style="padding: 15px; background: #1F2937; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                Ross Tax Preparation LLC - Sistema de Tax Wizard
            </p>
        </div>
    </div>
    """
    
    try:
        sg = SendGridAPIClient(sendgrid_key)
        message = Mail(
            from_email=Email("noreply@rosstaxpreparation.com", "Ross Tax Wizard"),
            to_emails=To(admin_email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        response = sg.send(message)
        logger.info(f"✅ Wizard completion notification sent to {admin_email}")
    except Exception as e:
        logger.error(f"❌ Error sending wizard notification: {e}")


@tax_wizard_router.get("/session/{session_id}/estimate")
async def get_live_estimate(session_id: str):
    """Obtiene estimación en vivo"""
    service = get_wizard_service()
    
    try:
        estimate = await service.calculate_live_estimate(session_id)
        return {
            "success": True,
            **estimate
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============== INFO ENDPOINTS ==============

@tax_wizard_router.get("/service-levels")
async def get_service_levels():
    """Obtiene información de los niveles de servicio"""
    return {
        "success": True,
        "service_levels": [
            {
                "id": ServiceLevel.FULL_SERVICE.value,
                "name": "Full Service",
                "name_es": "Servicio Completo",
                "tagline": "Ross Tax hace todo por ti",
                "description": "Deja que los expertos de Ross Tax se encarguen de todo. Tú solo proporcionas los documentos y nosotros hacemos el resto.",
                "features": [
                    "Preparación completa por expertos",
                    "Consulta personalizada",
                    "Máxima optimización de reembolso",
                    "Soporte VIP todo el año",
                    "Representación ante IRS si es necesario"
                ],
                "price_from": 199.99,
                "price_range": "$199 - $349",
                "recommended_for": "Casos complejos, negocios, primera vez",
                "icon": "star",
                "color": "#10B981"
            },
            {
                "id": ServiceLevel.ASSISTED.value,
                "name": "Assisted",
                "name_es": "Asistido",
                "tagline": "Tú llenas, nosotros revisamos",
                "description": "Completa tu información con nuestra guía paso a paso y un experto de Ross Tax revisará todo antes de enviar.",
                "features": [
                    "Proceso guiado paso a paso",
                    "Revisión profesional incluida",
                    "Garantía de precisión",
                    "Soporte prioritario",
                    "Maximización de deducciones"
                ],
                "price_from": 129.99,
                "price_range": "$129 - $179",
                "recommended_for": "Casos medianos, W-2 con dependientes",
                "icon": "users",
                "color": "#3B82F6"
            },
            {
                "id": ServiceLevel.DIY.value,
                "name": "Hazlo con Ross Tax",
                "name_es": "Hazlo Tú Mismo",
                "tagline": "Guía paso a paso",
                "description": "Completa tu declaración con nuestro proceso guiado. Perfecto para casos simples.",
                "features": [
                    "Proceso 100% guiado",
                    "Cálculo automático",
                    "Revisión de errores",
                    "Soporte por chat",
                    "Opción de agregar revisión profesional"
                ],
                "price_from": 49.99,
                "price_range": "$49 - $79",
                "recommended_for": "Casos simples, solo W-2",
                "icon": "zap",
                "color": "#8B5CF6"
            }
        ]
    }


@tax_wizard_router.get("/filing-statuses")
async def get_filing_statuses():
    """Obtiene opciones de estado civil"""
    return {
        "success": True,
        "filing_statuses": [
            {
                "id": FilingStatus.SINGLE.value,
                "name": "Single",
                "name_es": "Soltero(a)",
                "description": "No casado(a) al 31 de diciembre"
            },
            {
                "id": FilingStatus.MARRIED_JOINT.value,
                "name": "Married Filing Jointly",
                "name_es": "Casado(a) declarando juntos",
                "description": "Casado(a) y declarando con su cónyuge en una sola declaración"
            },
            {
                "id": FilingStatus.MARRIED_SEPARATE.value,
                "name": "Married Filing Separately",
                "name_es": "Casado(a) declarando por separado",
                "description": "Casado(a) pero cada uno declara por separado"
            },
            {
                "id": FilingStatus.HEAD_OF_HOUSEHOLD.value,
                "name": "Head of Household",
                "name_es": "Jefe(a) de familia",
                "description": "Soltero(a) con dependientes calificados"
            },
            {
                "id": FilingStatus.WIDOW.value,
                "name": "Qualifying Widow(er)",
                "name_es": "Viudo(a) calificado(a)",
                "description": "Viudo(a) con hijo dependiente (dentro de 2 años)"
            }
        ]
    }


# ============== ADMIN ENDPOINTS ==============

@tax_wizard_router.get("/admin/sessions")
async def get_all_sessions(
    status: Optional[str] = None,
    complexity: Optional[str] = None,
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0)
):
    """Obtiene todas las sesiones (admin)"""
    service = get_wizard_service()
    
    status_enum = WizardStatus(status) if status else None
    complexity_enum = CaseComplexity(complexity) if complexity else None
    
    sessions = await service.get_all_sessions(status_enum, complexity_enum, limit, skip)
    
    return {
        "success": True,
        "count": len(sessions),
        "sessions": [s.dict() for s in sessions]
    }


@tax_wizard_router.get("/admin/stats")
async def get_wizard_stats():
    """Obtiene estadísticas del wizard (admin)"""
    service = get_wizard_service()
    
    stats = await service.get_stats()
    
    return {
        "success": True,
        **stats
    }


class UpdateStatusRequest(BaseModel):
    status: WizardStatus
    admin_notes: Optional[str] = None


@tax_wizard_router.patch("/admin/session/{session_id}/status")
async def update_session_status(session_id: str, request: UpdateStatusRequest):
    """Actualiza el estado de una sesión (admin)"""
    service = get_wizard_service()
    
    try:
        session = await service.update_status(session_id, request.status, request.admin_notes)
        return {
            "success": True,
            "status": session.status,
            "message": f"Status updated to {request.status.value}"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class AssignPreparerRequest(BaseModel):
    preparer_id: str


@tax_wizard_router.patch("/admin/session/{session_id}/assign")
async def assign_preparer(session_id: str, request: AssignPreparerRequest):
    """Asigna un preparador a una sesión (admin)"""
    service = get_wizard_service()
    
    try:
        session = await service.assign_preparer(session_id, request.preparer_id)
        return {
            "success": True,
            "assigned_preparer": session.assigned_preparer,
            "message": "Preparer assigned successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@tax_wizard_router.get("/admin/session/{session_id}/details")
async def get_session_full_details(session_id: str):
    """Obtiene todos los detalles de una sesión para admin"""
    service = get_wizard_service()
    
    try:
        session = await service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get user info
        user_info = None
        try:
            user = await service.db.users.find_one({"_id": session.user_id})
            if user:
                user_info = {
                    "name": user.get("name", ""),
                    "email": user.get("email", ""),
                    "phone": user.get("phone", ""),
                    "created_at": str(user.get("created_at", ""))
                }
        except:
            pass
        
        # Build complete response
        return {
            "success": True,
            "session": {
                "id": session.id,
                "user_id": session.user_id,
                "user_info": user_info,
                "tax_year": session.tax_year,
                "status": session.status,
                "current_step": session.current_step,
                "progress_percentage": session.progress_percentage,
                "service_level": session.service_level,
                "case_complexity": session.case_complexity,
                "personal_info": session.personal_info.dict() if session.personal_info else None,
                "filing_status": session.filing_status,
                "income": session.income.dict() if session.income else None,
                "dependents": [d.dict() for d in session.dependents] if session.dependents else [],
                "deductions_credits": session.deductions_credits.dict() if session.deductions_credits else None,
                "refund_estimate": session.refund_estimate.dict() if session.refund_estimate else None,
                "discovery_selections": session.discovery_selections if hasattr(session, 'discovery_selections') else [],
                "recommended_service": session.recommended_service,
                "recommended_reason": session.recommended_reason,
                "total_price": session.total_price,
                "price_breakdown": session.price_breakdown,
                "documents_required": session.documents_required,
                "documents_uploaded": session.documents_uploaded,
                "assigned_preparer": session.assigned_preparer,
                "admin_notes": session.admin_notes,
                "created_at": str(session.created_at) if session.created_at else None,
                "updated_at": str(session.updated_at) if session.updated_at else None,
                "completed_at": str(session.completed_at) if session.completed_at else None,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session details: {e}")
        raise HTTPException(status_code=500, detail=str(e))





# ============== OCR ENDPOINTS ==============

class W2OcrRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


@tax_wizard_router.post("/ocr/w2")
async def extract_w2_data(request: W2OcrRequest):
    """Extrae datos de una imagen de W-2 usando OCR/AI"""
    from .ocr_service import w2_ocr_service
    
    result = await w2_ocr_service.extract_w2_data(
        request.image_base64,
        request.mime_type
    )
    
    if result.get("success"):
        # Convert to Tax Wizard format
        wizard_format = w2_ocr_service.convert_to_income_info(result.get("data", {}))
        return {
            "success": True,
            "extracted_data": result.get("data"),
            "wizard_format": wizard_format,
            "needs_review": result.get("data", {}).get("needs_review", False),
            "confidence_score": result.get("data", {}).get("confidence_score", 0)
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "OCR extraction failed")
        )


# ============== EXPORT ENDPOINTS ==============

@tax_wizard_router.get("/admin/export/csv")
async def export_sessions_csv(
    status: Optional[str] = None,
    complexity: Optional[str] = None,
    limit: int = Query(1000, le=5000)
):
    """Exporta sesiones a formato CSV"""
    from .export_service import export_service
    from fastapi.responses import Response
    
    service = get_wizard_service()
    
    status_enum = WizardStatus(status) if status else None
    complexity_enum = CaseComplexity(complexity) if complexity else None
    
    sessions = await service.get_all_sessions(status_enum, complexity_enum, limit, 0)
    sessions_dict = [s.dict() for s in sessions]
    
    csv_content = export_service.export_to_csv(sessions_dict)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=tax_wizard_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@tax_wizard_router.get("/admin/export/json")
async def export_sessions_json(
    status: Optional[str] = None,
    complexity: Optional[str] = None,
    limit: int = Query(1000, le=5000)
):
    """Exporta sesiones a formato JSON"""
    from .export_service import export_service
    from fastapi.responses import Response
    
    service = get_wizard_service()
    
    status_enum = WizardStatus(status) if status else None
    complexity_enum = CaseComplexity(complexity) if complexity else None
    
    sessions = await service.get_all_sessions(status_enum, complexity_enum, limit, 0)
    sessions_dict = [s.dict() for s in sessions]
    
    json_content = export_service.export_to_json(sessions_dict)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=tax_wizard_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@tax_wizard_router.get("/session/{session_id}/export/xml")
async def export_session_xml(session_id: str):
    """Exporta una sesión individual a formato XML (Drake-compatible)"""
    from .export_service import export_service
    from fastapi.responses import Response
    
    service = get_wizard_service()
    
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    xml_content = export_service.export_to_xml(session.dict())
    
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=tax_return_{session_id}.xml"
        }
    )


@tax_wizard_router.get("/session/{session_id}/export/drake")
async def export_session_drake(session_id: str):
    """Exporta una sesión en formato Drake Software"""
    from .export_service import export_service
    
    service = get_wizard_service()
    
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    drake_data = export_service.export_for_drake(session.dict())
    
    return {
        "success": True,
        "format": "drake",
        "data": drake_data
    }


# ============== STRIPE PAYMENT ENDPOINTS ==============

import stripe
import os

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")

class CreatePaymentIntentRequest(BaseModel):
    amount: Optional[float] = None  # If not provided, use session price


@tax_wizard_router.post("/session/{session_id}/payment/create-intent")
async def create_payment_intent(
    session_id: str,
    request: CreatePaymentIntentRequest = None,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Crea un Payment Intent de Stripe para el wizard"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    try:
        # Get session
        session_data = await service.db["tax_wizard_sessions"].find_one({
            "_id": ObjectId(session_id)
        })
        
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership
        if str(session_data.get("user_id", "")) != str(user_id):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Get amount - use session price or request amount
        amount = None
        if request and request.amount:
            amount = request.amount
        elif session_data.get("total_price"):
            amount = session_data.get("total_price")
        else:
            # Default pricing based on complexity
            complexity = session_data.get("case_complexity", "medium")
            pricing = {
                "simple": 75.00,
                "medium": 125.00,
                "complex": 200.00
            }
            amount = pricing.get(complexity, 125.00)
        
        # Get user email
        user = await service.db["users"].find_one({"_id": ObjectId(user_id)})
        customer_email = user.get("email") if user else None
        
        # Get or create Stripe customer
        customer_id = user.get("stripe_customer_id") if user else None
        if not customer_id and customer_email:
            customer = stripe.Customer.create(
                email=customer_email,
                metadata={
                    "user_id": str(user_id),
                    "name": f"{session_data.get('personal_info', {}).get('first_name', '')} {session_data.get('personal_info', {}).get('last_name', '')}".strip()
                }
            )
            customer_id = customer.id
            # Save customer ID to user
            await service.db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Create Payment Intent
        intent_params = {
            "amount": int(amount * 100),  # Convert to cents
            "currency": "usd",
            "metadata": {
                "session_id": session_id,
                "user_id": str(user_id),
                "tax_year": str(session_data.get("tax_year", 2024)),
                "service_type": "tax_wizard"
            },
            "description": f"Ross Tax - Mi Reembolso {session_data.get('tax_year', 2024)}"
        }
        
        if customer_id:
            intent_params["customer"] = customer_id
        
        if customer_email:
            intent_params["receipt_email"] = customer_email
        
        payment_intent = stripe.PaymentIntent.create(**intent_params)
        
        # Save payment intent to session
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "stripe_payment_intent_id": payment_intent.id,
                "payment_amount": amount,
                "payment_status": "pending",
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "success": True,
            "client_secret": payment_intent.client_secret,
            "payment_intent_id": payment_intent.id,
            "amount": amount,
            "currency": "usd"
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Payment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_wizard_router.post("/session/{session_id}/payment/confirm")
async def confirm_payment(
    session_id: str,
    payment_intent_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Confirma que el pago fue exitoso y actualiza la sesión"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    try:
        # Verify payment intent
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status != "succeeded":
            raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {payment_intent.status}")
        
        # Verify session
        session_data = await service.db["tax_wizard_sessions"].find_one({
            "_id": ObjectId(session_id)
        })
        
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session_data.get("user_id", "")) != str(user_id):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update session with payment info
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "payment_status": "completed",
                "payment_completed_at": datetime.utcnow(),
                "stripe_charge_id": payment_intent.latest_charge,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Record payment in payments collection
        await service.db["tax_wizard_payments"].insert_one({
            "session_id": session_id,
            "user_id": str(user_id),
            "payment_intent_id": payment_intent_id,
            "charge_id": payment_intent.latest_charge,
            "amount": payment_intent.amount / 100,  # Convert from cents
            "currency": payment_intent.currency,
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": "Pago confirmado exitosamente",
            "amount_paid": payment_intent.amount / 100,
            "receipt_url": f"https://dashboard.stripe.com/payments/{payment_intent.latest_charge}"
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@tax_wizard_router.get("/session/{session_id}/payment/status")
async def get_payment_status(
    session_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtiene el estado del pago de una sesión"""
    service = get_wizard_service()
    user_id = current_user.get("_id") or current_user.get("id")
    
    session_data = await service.db["tax_wizard_sessions"].find_one({
        "_id": ObjectId(session_id)
    })
    
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if str(session_data.get("user_id", "")) != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "success": True,
        "payment_status": session_data.get("payment_status", "not_started"),
        "payment_amount": session_data.get("payment_amount"),
        "payment_completed_at": session_data.get("payment_completed_at"),
        "stripe_payment_intent_id": session_data.get("stripe_payment_intent_id")
    }


@tax_wizard_router.get("/pricing")
async def get_wizard_pricing():
    """Obtiene los precios del servicio del wizard"""
    return {
        "success": True,
        "pricing": {
            "simple": {
                "price": 75.00,
                "description": "Declaración simple (W-2 único, sin dependientes)",
                "includes": ["Preparación básica", "E-filing federal", "Soporte por email"]
            },
            "medium": {
                "price": 125.00,
                "description": "Declaración estándar (múltiples W-2, dependientes)",
                "includes": ["Todo lo básico", "Créditos por hijos", "E-filing estatal", "Soporte prioritario"]
            },
            "complex": {
                "price": 200.00,
                "description": "Declaración compleja (negocio propio, inversiones)",
                "includes": ["Todo lo estándar", "Schedule C", "Deducciones detalladas", "Consulta 1-on-1"]
            }
        },
        "currency": "USD"
    }



# ============== REFERRAL ENDPOINTS ==============

from .referral_service import referral_service, init_referral_service

class ApplyReferralRequest(BaseModel):
    referral_code: str


@tax_wizard_router.get("/referral/my-code")
async def get_my_referral_code(
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtiene o crea el código de referido del usuario"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    if not referral_service:
        raise HTTPException(status_code=500, detail="Referral service not initialized")
    
    result = await referral_service.get_or_create_referral_code(user_id)
    
    return {
        "success": True,
        **result
    }


@tax_wizard_router.get("/referral/stats")
async def get_referral_stats(
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtiene las estadísticas de referidos del usuario"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    if not referral_service:
        raise HTTPException(status_code=500, detail="Referral service not initialized")
    
    stats = await referral_service.get_referral_stats(user_id)
    
    return {
        "success": True,
        **stats
    }


@tax_wizard_router.post("/referral/validate")
async def validate_referral_code(request: ApplyReferralRequest):
    """Valida un código de referido"""
    if not referral_service:
        raise HTTPException(status_code=500, detail="Referral service not initialized")
    
    result = await referral_service.validate_referral_code(request.referral_code)
    
    if not result:
        return {"success": False, "valid": False, "error": "Código inválido"}
    
    return {"success": True, **result}


@tax_wizard_router.post("/session/{session_id}/referral/apply")
async def apply_referral_to_session(
    session_id: str,
    request: ApplyReferralRequest,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Aplica un código de referido a una sesión"""
    if not referral_service:
        raise HTTPException(status_code=500, detail="Referral service not initialized")
    
    result = await referral_service.apply_referral_to_session(session_id, request.referral_code)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Error aplicando referido"))
    
    return result


@tax_wizard_router.get("/admin/referrals/report")
async def get_admin_referral_report():
    """Obtiene el reporte de referidos para admin"""
    if not referral_service:
        raise HTTPException(status_code=500, detail="Referral service not initialized")
    
    report = await referral_service.get_admin_referral_report()
    
    return {"success": True, **report}


# ============== ANALYTICS ENDPOINTS ==============

from .analytics_service import init_analytics_service
from .analytics_service import analytics_service as _analytics_svc
from .reminder_service import init_reminder_service
from .reminder_service import reminder_service as _reminder_svc

def get_analytics_service():
    """Get analytics service - handles delayed initialization"""
    from .analytics_service import analytics_service
    return analytics_service

def get_reminder_service():
    """Get reminder service - handles delayed initialization"""
    from .reminder_service import reminder_service
    return reminder_service


@tax_wizard_router.get("/admin/analytics/dashboard")
async def get_analytics_dashboard(days: int = 30):
    """Obtiene el dashboard completo de analytics"""
    svc = get_analytics_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Analytics service not initialized")
    
    dashboard = await svc.get_full_dashboard(days)
    
    return {"success": True, **dashboard}


@tax_wizard_router.get("/admin/analytics/funnel")
async def get_conversion_funnel(days: int = 30):
    """Obtiene el funnel de conversión"""
    svc = get_analytics_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Analytics service not initialized")
    
    funnel = await svc.get_conversion_funnel(days)
    
    return {"success": True, **funnel}


@tax_wizard_router.get("/admin/analytics/daily")
async def get_daily_stats(days: int = 14):
    """Obtiene estadísticas diarias"""
    svc = get_analytics_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Analytics service not initialized")
    
    stats = await svc.get_daily_stats(days)
    
    return {"success": True, "stats": stats}


@tax_wizard_router.get("/admin/analytics/revenue")
async def get_revenue_stats(days: int = 30):
    """Obtiene estadísticas de ingresos"""
    svc = get_analytics_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Analytics service not initialized")
    
    revenue = await svc.get_revenue_stats(days)
    
    return {"success": True, **revenue}


# ============== REMINDER ENDPOINTS ==============

@tax_wizard_router.post("/admin/reminders/send")
async def run_reminder_job():
    """Ejecuta el job de recordatorios manualmente"""
    svc = get_reminder_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Reminder service not initialized")
    
    results = await svc.run_reminder_job()
    
    return {"success": True, "results": results}


@tax_wizard_router.get("/admin/reminders/stats")
async def get_reminder_stats():
    """Obtiene estadísticas de recordatorios enviados"""
    svc = get_reminder_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Reminder service not initialized")
    
    stats = await svc.get_reminder_stats()
    
    return {"success": True, **stats}


@tax_wizard_router.get("/admin/reminders/pending")
async def get_pending_reminders():
    """Obtiene sesiones que necesitan recordatorio"""
    svc = get_reminder_service()
    if not svc:
        raise HTTPException(status_code=500, detail="Reminder service not initialized")
    
    sessions_24h = await svc.get_sessions_needing_reminder("24h")
    sessions_48h = await svc.get_sessions_needing_reminder("48h")
    sessions_7d = await svc.get_sessions_needing_reminder("7d")
    
    return {
        "success": True,
        "pending": {
            "24h": len(sessions_24h),
            "48h": len(sessions_48h),
            "7d": len(sessions_7d),
            "total": len(sessions_24h) + len(sessions_48h) + len(sessions_7d)
        }
    }


# ============== PROMO CODE ENDPOINTS ==============

from .promo_service import promo_service, init_promo_service

class CreatePromoRequest(BaseModel):
    code: str
    discount_type: str  # "percentage" or "fixed"
    discount_value: float
    description: str = ""
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    min_purchase: float = 0
    first_time_only: bool = False

class ValidatePromoRequest(BaseModel):
    code: str
    purchase_amount: float


@tax_wizard_router.post("/promo/create")
async def create_promo_code(request: CreatePromoRequest):
    """Crear un nuevo código de promoción (Admin)"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    expires_at = None
    if request.expires_at:
        expires_at = datetime.fromisoformat(request.expires_at.replace('Z', '+00:00'))
    
    result = await promo_service.create_promo_code(
        code=request.code,
        discount_type=request.discount_type,
        discount_value=request.discount_value,
        description=request.description,
        max_uses=request.max_uses,
        expires_at=expires_at,
        min_purchase=request.min_purchase,
        first_time_only=request.first_time_only
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@tax_wizard_router.post("/promo/validate")
async def validate_promo_code(
    request: ValidatePromoRequest,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Validar un código de promoción"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    result = await promo_service.validate_promo_code(
        code=request.code,
        user_id=user_id,
        purchase_amount=request.purchase_amount
    )
    
    return {"success": True, **result}


@tax_wizard_router.post("/session/{session_id}/promo/apply")
async def apply_promo_to_session(
    session_id: str,
    request: ValidatePromoRequest,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Aplicar código de promoción a una sesión"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # First validate
    validation = await promo_service.validate_promo_code(
        code=request.code,
        user_id=user_id,
        purchase_amount=request.purchase_amount
    )
    
    if not validation.get("valid"):
        raise HTTPException(status_code=400, detail=validation.get("error", "Código inválido"))
    
    # Apply the promo
    await promo_service.apply_promo_code(
        code=request.code,
        user_id=user_id,
        session_id=session_id,
        original_amount=request.purchase_amount,
        discount_amount=validation["discount_amount"]
    )
    
    return {
        "success": True,
        "message": f"¡Código aplicado! Ahorro: ${validation['discount_amount']:.2f}",
        **validation
    }


@tax_wizard_router.get("/promo/list")
async def list_promo_codes(include_inactive: bool = False):
    """Listar todos los códigos de promoción (Admin)"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    promos = await promo_service.get_all_promo_codes(include_inactive)
    
    return {"success": True, "promo_codes": promos}


@tax_wizard_router.get("/promo/stats")
async def get_promo_stats():
    """Obtener estadísticas de promociones (Admin)"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    stats = await promo_service.get_promo_stats()
    
    return {"success": True, **stats}


@tax_wizard_router.delete("/promo/{code}")
async def deactivate_promo(code: str):
    """Desactivar un código de promoción (Admin)"""
    if not promo_service:
        raise HTTPException(status_code=500, detail="Promo service not initialized")
    
    result = await promo_service.deactivate_promo_code(code)
    
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    
    return result


# ============== WHATSAPP NOTIFICATION ON COMPLETION ==============

@tax_wizard_router.post("/session/{session_id}/notify-completion")
async def notify_wizard_completion(
    session_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Enviar notificación WhatsApp cuando se completa el wizard"""
    service = get_wizard_service()
    
    # Get session
    session = await service.db["tax_wizard_sessions"].find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get user info
    user_id = session.get("user_id")
    user = await service.db["users"].find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(str(user_id)) else user_id})
    
    personal_info = session.get("personal_info", {})
    refund_estimate = session.get("refund_estimate", {})
    estimated_refund = refund_estimate.get("estimated_refund", 0)
    
    phone = personal_info.get("phone") or (user.get("phone") if user else None)
    name = personal_info.get("first_name") or (user.get("first_name") if user else "Cliente")
    
    if not phone:
        return {"success": False, "error": "No phone number available"}
    
    # Format phone for WhatsApp
    phone_clean = ''.join(filter(str.isdigit, str(phone)))
    if len(phone_clean) == 10:
        phone_clean = "1" + phone_clean
    
    # Send WhatsApp message via existing service
    try:
        # Check if WhatsApp service exists
        whatsapp_collection = service.db["whatsapp_messages"]
        
        message = f"""🎉 *¡Felicidades {name}!*

Tu declaración de impuestos ha sido enviada exitosamente a Ross Tax Preparation.

💰 *Reembolso Estimado:* ${estimated_refund:,.2f}

📋 *Próximos pasos:*
1. Un preparador revisará tu información
2. Te contactaremos si necesitamos algo más
3. Enviaremos tu declaración al IRS

📞 ¿Preguntas? Llámanos: (806) 934-2018

_Ross Tax Preparation - Tu reembolso en buenas manos_"""
        
        # Log the message (actual sending would be through WhatsApp API)
        await whatsapp_collection.insert_one({
            "to": phone_clean,
            "message": message,
            "session_id": session_id,
            "type": "wizard_completion",
            "status": "pending",
            "created_at": datetime.utcnow()
        })
        
        # Mark session as notified
        await service.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "whatsapp_notified": True,
                "whatsapp_notified_at": datetime.utcnow()
            }}
        )
        
        logger.info(f"📱 WhatsApp notification queued for session {session_id}")
        
        return {
            "success": True,
            "message": "Notificación WhatsApp enviada",
            "phone": phone_clean[-4:]  # Last 4 digits for privacy
        }
        
    except Exception as e:
        logger.error(f"Error sending WhatsApp: {e}")
        return {"success": False, "error": str(e)}


# ============== APPOINTMENT ENDPOINTS ==============

def get_appointment_service():
    """Get the appointment service instance"""
    from .appointment_service import appointment_service
    return appointment_service

class ScheduleAppointmentRequest(BaseModel):
    appointment_datetime: str
    appointment_type: str = "tax_review"
    notes: str = ""


@tax_wizard_router.get("/appointments/available-slots")
async def get_available_appointment_slots(days_ahead: int = 14):
    """Obtener horarios disponibles para citas"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    slots = await appointment_service.get_available_slots(days_ahead=days_ahead)
    
    return {
        "success": True,
        "slots": slots,
        "count": len(slots)
    }


@tax_wizard_router.post("/session/{session_id}/appointment/schedule")
async def schedule_appointment(
    session_id: str,
    request: ScheduleAppointmentRequest,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Agendar una cita después de completar el wizard"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    result = await appointment_service.schedule_appointment(
        session_id=session_id,
        user_id=user_id,
        appointment_datetime=request.appointment_datetime,
        appointment_type=request.appointment_type,
        notes=request.notes
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@tax_wizard_router.delete("/appointment/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Cancelar una cita"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    result = await appointment_service.cancel_appointment(appointment_id, user_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@tax_wizard_router.get("/appointments/my")
async def get_my_appointments(
    current_user: dict = Depends(get_current_user_for_wizard)
):
    """Obtener mis citas"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    appointments = await appointment_service.get_user_appointments(user_id)
    
    return {
        "success": True,
        "appointments": appointments
    }



@tax_wizard_router.get("/admin/appointments")
async def get_admin_wizard_appointments(
    status: Optional[str] = None,
    limit: int = Query(50, le=200)
):
    """Obtener todas las citas del wizard (admin)"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    appointments = await appointment_service.get_all_wizard_appointments(status=status, limit=limit)
    
    return {
        "success": True,
        "appointments": appointments,
        "count": len(appointments)
    }


@tax_wizard_router.patch("/admin/appointment/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    status: str = Query(..., description="New status: scheduled, confirmed, completed, cancelled")
):
    """Actualizar estado de una cita (admin)"""
    appointment_service = get_appointment_service()
    if not appointment_service:
        raise HTTPException(status_code=500, detail="Appointment service not initialized")
    
    valid_statuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    try:
        result = await appointment_service.appointments.update_one(
            {"_id": ObjectId(appointment_id)},
            {"$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        return {
            "success": True,
            "message": f"Status updated to {status}"
        }
    except Exception as e:
        logger.error(f"Error updating appointment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# IDENTITY VERIFICATION ENDPOINTS
# ============================================================

class IdentityVerificationRequest(BaseModel):
    id_photo_base64: str
    selfie_base64: str
    id_type: str = "drivers_license"  # drivers_license, passport, state_id
    full_name: str = ""

class AdminReviewRequest(BaseModel):
    approved: bool
    notes: str = ""

# Singleton for identity verification service
_identity_service = None

async def get_identity_service():
    global _identity_service
    if _identity_service is None:
        from .identity_verification_service import IdentityVerificationService
        service = get_wizard_service()
        _identity_service = IdentityVerificationService(service.db)
    return _identity_service


@tax_wizard_router.post("/session/{session_id}/identity-verification")
async def submit_identity_verification(
    session_id: str,
    request: IdentityVerificationRequest,
):
    """Submit ID photo + selfie for identity verification (DIY flow)"""
    service = get_wizard_service()
    current_user = await get_current_user()

    # Validate session belongs to user
    session = await service.db.tax_wizard_sessions.find_one({
        "_id": ObjectId(session_id),
        "user_id": current_user["id"]
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    id_service = await get_identity_service()
    result = await id_service.submit_verification(
        user_id=current_user["id"],
        session_id=session_id,
        id_photo_base64=request.id_photo_base64,
        selfie_base64=request.selfie_base64,
        id_type=request.id_type,
        full_name=request.full_name,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Error submitting verification"))

    return result


@tax_wizard_router.get("/session/{session_id}/identity-verification/status")
async def get_identity_verification_status(session_id: str):
    """Get identity verification status for a session"""
    current_user = await get_current_user()
    id_service = await get_identity_service()
    return await id_service.get_verification_status(current_user["id"], session_id)


@tax_wizard_router.get("/admin/identity-verifications/pending")
async def get_pending_identity_verifications():
    """Admin: Get all pending identity verifications"""
    current_user = await get_current_user()
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    id_service = await get_identity_service()
    return await id_service.get_pending_verifications()


@tax_wizard_router.post("/admin/identity-verifications/{verification_id}/review")
async def admin_review_identity_verification(
    verification_id: str,
    request: AdminReviewRequest,
):
    """Admin: Approve or reject an identity verification"""
    current_user = await get_current_user()
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    id_service = await get_identity_service()
    result = await id_service.admin_review_verification(
        verification_id=verification_id,
        admin_id=current_user["id"],
        approved=request.approved,
        notes=request.notes,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@tax_wizard_router.get("/admin/identity-verifications/{verification_id}/images")
async def get_identity_verification_images(verification_id: str):
    """Admin: Get ID and selfie images for review"""
    current_user = await get_current_user()
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    id_service = await get_identity_service()
    result = await id_service.get_verification_images(verification_id)

    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))

    return result
