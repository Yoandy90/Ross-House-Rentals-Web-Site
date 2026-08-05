"""
Tax Tools Endpoints - Todos los endpoints API para herramientas fiscales
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from tax_tools_models import (
    OCRDocumentRequest, TaxCalculationRequest, DocumentValidationRequest,
    RefundPredictionRequest, CaseStatusUpdate, SignatureRequest,
    ReportRequest, ServicePurchaseRequest, QuizAttempt, TaxScenarioRequest
)

# Este router será importado en server.py
tax_tools_router = APIRouter()

def init_tax_tools_endpoints(app, router, tax_tools_service, get_current_user, require_admin):
    """Inicializa todos los endpoints de tax tools"""
    
    # ==================== OCR Y EXTRACCIÓN ====================
    
    @router.post('/tax-tools/extract-ocr/{document_id}')
    async def extract_ocr_data(
        document_id: str,
        request: OCRDocumentRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Extrae datos de documentos fiscales usando OCR"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.extract_document_data(
            document_id=document_id,
            document_type=request.document_type
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Extraction failed'))
        
        return result
    
    # ==================== CALCULADORA DE IMPUESTOS ====================
    
    @router.post('/tax-tools/calculate-taxes')
    async def calculate_taxes(
        request: TaxCalculationRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Calcula impuestos federales y estatales para 2024 o 2025"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.calculate_taxes(
            filing_status=request.filing_status,
            income=request.income,
            deductions=request.deductions,
            credits=request.credits,
            withholding=request.withholding,
            state=request.state,
            tax_year=request.tax_year
        )
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    # ==================== VALIDADOR DE DOCUMENTOS ====================
    
    @router.post('/tax-tools/validate-document/{document_id}')
    async def validate_document(
        document_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Valida completitud y corrección de documentos fiscales"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.validate_document(document_id)
        
        if not result.get('success', True):
            raise HTTPException(status_code=400, detail=result.get('error', 'Validation failed'))
        
        return result
    
    # ==================== PREDICTOR DE REEMBOLSO ====================
    
    @router.post('/tax-tools/predict-refund')
    async def predict_refund(
        request: RefundPredictionRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Predice reembolso basado en histórico"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.predict_refund(
            user_id=request.user_id,
            current_year=request.current_year
        )
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    # ==================== GESTIÓN DE CASOS ====================
    
    @router.put('/tax-tools/case-status')
    async def update_case_status(
        request: CaseStatusUpdate,
        current_user: dict = Depends(require_admin)
    ):
        """Actualiza estado de un caso (admin only)"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.update_case_status(
            case_id=request.case_id,
            status=request.status,
            notes=request.notes,
            estimated_completion=request.estimated_completion
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('message', 'Update failed'))
        
        return result
    
    @router.get('/tax-tools/case-timeline/{case_id}')
    async def get_case_timeline(
        case_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene timeline completo de un caso"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.get_case_timeline(case_id)
        
        if not result.get('success', True):
            raise HTTPException(status_code=404, detail=result.get('error', 'Case not found'))
        
        return result
    
    # ==================== FIRMA DIGITAL ====================
    
    @router.post('/tax-tools/digital-signature')
    async def create_digital_signature(
        request: SignatureRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Crea firma digital legalmente válida"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.create_digital_signature(
            document_id=request.document_id,
            user_id=current_user['id'],
            signature_data=request.signature_data,
            ip_address=request.ip_address,
            device_info=request.device_info
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Signature creation failed'))
        
        return result
    
    # ==================== REPORTES ====================
    
    @router.post('/tax-tools/generate-report')
    async def generate_report(
        request: ReportRequest,
        current_user: dict = Depends(require_admin)
    ):
        """Genera reportes automáticos (admin only)"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.generate_report(
            report_type=request.report_type,
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    # ==================== PRIORIZACIÓN ====================
    
    @router.get('/tax-tools/prioritize-cases')
    async def prioritize_cases(
        current_user: dict = Depends(require_admin)
    ):
        """Obtiene casos priorizados por urgencia (admin only)"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        cases = await tax_tools_service.prioritize_cases()
        return {'cases': cases, 'total': len(cases)}
    
    # ==================== MARKETPLACE ====================
    
    @router.get('/tax-tools/services')
    async def get_services(
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene servicios disponibles en marketplace"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        services = await tax_tools_service.get_available_services()
        return {'services': services}
    
    @router.post('/tax-tools/purchase-service')
    async def purchase_service(
        request: ServicePurchaseRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Compra un servicio del marketplace"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.purchase_service(
            service_id=request.service_id,
            user_id=current_user['id'],
            payment_method=request.payment_method
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Purchase failed'))
        
        return result
    
    # ==================== EDUCACIÓN ====================
    
    @router.get('/tax-tools/educational-content')
    async def get_educational_content(
        content_type: Optional[str] = None,
        difficulty: Optional[str] = None,
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene contenido educacional"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        content = await tax_tools_service.get_educational_content(
            content_type=content_type,
            difficulty=difficulty
        )
        return {'content': content, 'total': len(content)}
    
    @router.post('/tax-tools/submit-quiz')
    async def submit_quiz(
        request: QuizAttempt,
        current_user: dict = Depends(get_current_user)
    ):
        """Envía respuestas de quiz y obtiene calificación"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.submit_quiz(
            quiz_id=request.quiz_id,
            user_id=current_user['id'],
            answers=request.answers
        )
        
        if not result.get('success', True):
            raise HTTPException(status_code=400, detail=result.get('error', 'Quiz submission failed'))
        
        return result
    
    # ==================== SIMULADOR ====================
    
    @router.post('/tax-tools/simulate-scenario')
    async def simulate_scenario(
        request: TaxScenarioRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Simula impacto fiscal de diferentes escenarios"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.simulate_tax_scenario(
            base_situation=request.base_situation,
            scenario_changes=request.scenario_changes
        )
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    # ==================== DETECTOR DE AUDITORÍAS ====================
    
    @router.get('/tax-tools/detect-audit-risks/{case_id}')
    async def detect_audit_risks(
        case_id: str,
        current_user: dict = Depends(require_admin)
    ):
        """Analiza riesgos de auditoría (admin only)"""
        if not tax_tools_service:
            raise HTTPException(status_code=503, detail="Tax tools service not available")
        
        result = await tax_tools_service.detect_audit_risks(case_id)
        
        if not result.get('success', True):
            raise HTTPException(status_code=404, detail=result.get('error', 'Case not found'))
        
        return result
    
    print("✅ Tax tools endpoints initialized")
