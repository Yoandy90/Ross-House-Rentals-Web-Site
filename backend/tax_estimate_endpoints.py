"""Tax Estimate Endpoints - API endpoints para estimados de impuestos"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from tax_estimate_models import TaxEstimateRequest, TaxEstimateStatusUpdate

def init_tax_estimate_endpoints(app, router, tax_estimate_service, tax_tools_service, get_current_user, require_admin):
    """Inicializa endpoints de estimados de impuestos"""
    
    # ==================== ENDPOINTS PARA CLIENTES ====================
    
    @app.post('/api/tax-estimates/create')
    async def create_tax_estimate(
        request: TaxEstimateRequest,
        current_user: dict = Depends(get_current_user)
    ):
        """Crea un nuevo estimado de impuestos"""
        try:
            # 1. Calcular impuestos (con parámetros avanzados)
            calculation = await tax_tools_service.calculate_taxes(
                filing_status=request.filing_status,
                income=request.annual_income,
                deductions=request.deductions,
                credits=request.credits,
                withholding=request.withholding,
                state=request.state,
                tax_year=request.tax_year,
                num_children_under_17=request.num_children_under_17,
                num_children_17_plus=request.num_children_17_plus,
                self_employment_income=request.self_employment_income,
                investment_income=request.investment_income,
            )
            
            if 'error' in calculation:
                raise HTTPException(status_code=400, detail=calculation['error'])
            
            # 2. Crear el estimado en la base de datos
            result = await tax_estimate_service.create_estimate(
                user_id=current_user['id'],
                tax_year=request.tax_year,
                filing_status=request.filing_status,
                annual_income=request.annual_income,
                deductions=request.deductions,
                credits=request.credits,
                withholding=request.withholding,
                state=request.state,
                calculation_results=calculation,
                client_notes=request.notes,
                wants_office_appointment=request.wants_office_appointment
            )
            
            if not result.get('success'):
                raise HTTPException(status_code=400, detail=result.get('error', 'Failed to create estimate'))
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/tax-estimates/my-estimates')
    async def get_my_estimates(
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene todos los estimados del usuario actual"""
        estimates = await tax_estimate_service.get_user_estimates(current_user['id'])
        return {'estimates': estimates, 'total': len(estimates)}
    
    @app.get('/api/tax-estimates/{estimate_id}')
    async def get_estimate(
        estimate_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene un estimado específico (solo el dueño o admin)"""
        estimate = await tax_estimate_service.get_estimate_by_id(estimate_id)
        
        if not estimate:
            raise HTTPException(status_code=404, detail="Estimate not found")
        
        # Verificar que el usuario sea el dueño o admin
        if estimate['user_id'] != current_user['id'] and current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Not authorized")
        
        return estimate
    
    # ==================== ENDPOINTS PARA ADMIN ====================
    
    @app.get('/api/admin/tax-estimates')
    async def get_all_estimates_admin(
        status: Optional[str] = Query(None, description="Filter by status"),
        page: int = Query(1, ge=1),
        limit: int = Query(50, ge=1, le=100),
        current_user: dict = Depends(require_admin)
    ):
        """Obtiene todos los estimados (admin only)"""
        skip = (page - 1) * limit
        result = await tax_estimate_service.get_all_estimates(
            status=status,
            limit=limit,
            skip=skip
        )
        return result
    
    @app.put('/api/admin/tax-estimates/{estimate_id}/status')
    async def update_estimate_status_admin(
        estimate_id: str,
        request: TaxEstimateStatusUpdate,
        current_user: dict = Depends(require_admin)
    ):
        """Actualiza el status de un estimado (admin only)"""
        result = await tax_estimate_service.update_estimate_status(
            estimate_id=estimate_id,
            status=request.status,
            admin_notes=request.admin_notes,
            admin_user_id=current_user['id']
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('message', 'Update failed'))
        
        return result
    
    @app.delete('/api/admin/tax-estimates/{estimate_id}')
    async def delete_estimate_admin(
        estimate_id: str,
        current_user: dict = Depends(require_admin)
    ):
        """Elimina un estimado (admin only)"""
        result = await tax_estimate_service.delete_estimate(estimate_id)
        
        if not result.get('success'):
            raise HTTPException(status_code=404, detail=result.get('message', 'Not found'))
        
        return result
    
    print("✅ Tax estimate endpoints initialized")
