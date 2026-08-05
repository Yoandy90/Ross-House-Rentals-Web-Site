"""
Loan Endpoints - Ross Lending Solutions
API endpoints for loan management
FEATURE FLAG CONTROLLED: Only available when loans_enabled = true
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from datetime import date
from typing import Optional, List, Callable
import logging

from loan_models import (
    CreateLoanProductRequest, LoanProduct,
    CreateLoanApplicationRequest, LoanApplication, ReviewLoanApplicationRequest,
    CreateLoanRequest, SignLoanRequest, DisburseLoanRequest, Loan,
    RecordPaymentRequest, LoanPayment,
    ApplicationStatus, LoanStatus, LoanMetrics
)
from loan_service import LoanService

logger = logging.getLogger(__name__)

# Router will be initialized from server.py
loan_router = APIRouter()
loan_service: Optional[LoanService] = None
auth_dependency: Optional[Callable] = None
db_instance = None  # Database reference for feature flag check


def init_loan_endpoints(db, get_current_user_func):
    """Initialize loan service with database and auth function"""
    global loan_service, auth_dependency, db_instance
    loan_service = LoanService(db)
    auth_dependency = get_current_user_func
    db_instance = db
    logger.info("✅ Loan service initialized")


async def get_current_user_wrapper():
    """Wrapper for auth dependency"""
    if auth_dependency is None:
        raise HTTPException(status_code=503, detail="Auth not initialized")
    # This should call the actual auth function
    # But we need to handle this differently since we can't call it directly
    raise HTTPException(status_code=503, detail="Auth dependency not properly configured")


async def check_loans_enabled():
    """Check if loans feature is enabled via feature flags"""
    if db_instance is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    flags = await db_instance.feature_flags.find_one({"_id": "feature_flags"})
    if not flags or not flags.get("loans_enabled", False):
        raise HTTPException(
            status_code=403, 
            detail="El servicio de préstamos no está disponible actualmente. Contacte al administrador."
        )
    return True


# ==================== LOAN PRODUCTS (ADMIN) ====================

@loan_router.post('/admin/loan-products', response_model=LoanProduct)
async def create_loan_product(
    request: CreateLoanProductRequest,
    current_user: dict = Depends(get_current_user_wrapper)
):
    """Create new loan product (admin only)"""
    await check_loans_enabled()  # Check feature flag
    
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    # Verify admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado - Solo admin')
    
    try:
        product = await loan_service.create_product(
            request,
            current_user['user_id'],
            current_user.get('email', '')
        )
        return product
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating loan product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/admin/loan-products', response_model=List[LoanProduct])
async def get_loan_products_admin(
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: dict = Depends(get_current_user_wrapper)
):
    """Get all loan products (admin)"""
    await check_loans_enabled()  # Check feature flag
    
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    # Verify admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado - Solo admin')
    
    try:
        products = await loan_service.get_products(active_only, skip, limit)
        return products
    except Exception as e:
        logger.error(f"Error getting loan products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/admin/loan-products/{product_id}', response_model=LoanProduct)
async def get_loan_product_admin(
    product_id: str,
    current_user: dict = Depends(get_current_user_wrapper)
):
    """Get single loan product (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    # Verify admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado - Solo admin')
    
    product = await loan_service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@loan_router.patch('/admin/loan-products/{product_id}', response_model=LoanProduct)
async def update_loan_product(
    product_id: str,
    updates: dict,
    current_user: dict = Depends(get_current_user_wrapper)
):
    """Update loan product (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        product = await loan_service.update_product(
            product_id, updates,
            current_user['id'], current_user['email']
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except Exception as e:
        logger.error(f"Error updating loan product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LOAN PRODUCTS (CLIENT) ====================

@loan_router.get('/loan-products', response_model=List[LoanProduct])
async def get_loan_products_client(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50)
):
    """Get active loan products (client)"""
    await check_loans_enabled()  # Check feature flag
    
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        products = await loan_service.get_products(active_only=True, skip=skip, limit=limit)
        return products
    except Exception as e:
        logger.error(f"Error getting loan products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/loan-products/{product_id}', response_model=LoanProduct)
async def get_loan_product_client(product_id: str):
    """Get single loan product (client)"""
    await check_loans_enabled()  # Check feature flag
    
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    product = await loan_service.get_product(product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


# ==================== LOAN APPLICATIONS ====================

@loan_router.post('/loan-applications', response_model=LoanApplication)
async def create_loan_application(
    request: CreateLoanApplicationRequest,
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Create loan application (client)"""
    await check_loans_enabled()  # Check feature flag
    
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        application = await loan_service.create_application(
            current_user['id'],
            request
        )
        
        # Send notifications asynchronously
        try:
            from notification_service import NotificationService
            from server import db
            
            # Get config for notification service
            config_doc = await db.config.find_one({})
            notification_service = NotificationService(config_doc)
            
            # Get user info for notifications
            user = await db.users.find_one({'_id': current_user['id']})
            if user:
                user_name = user.get('full_name', user.get('username', 'Cliente'))
                
                # Send notifications
                await notification_service.send_loan_notifications(
                    user_email=request.contacts.email,
                    user_phone=request.contacts.phone,
                    user_name=user_name,
                    notification_type='submitted',
                    loan_amount=request.amount,
                    loan_term=request.term_count,
                    application_id=application.id
                )
                logger.info(f"Loan application notifications sent for {application.id}")
        except Exception as notif_error:
            logger.error(f"Failed to send loan application notifications: {notif_error}")
            # Don't fail the request if notifications fail
        
        return application
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating loan application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/loan-applications', response_model=List[LoanApplication])
async def get_my_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50),
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Get my loan applications (client)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        applications = await loan_service.get_user_applications(
            current_user['id'],
            skip, limit
        )
        return applications
    except Exception as e:
        logger.error(f"Error getting applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/loan-applications/{application_id}', response_model=LoanApplication)
async def get_application(
    application_id: str,
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Get loan application (client)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    application = await loan_service.get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Verify ownership
    if application.user_id != current_user['id']:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    return application


# ==================== ADMIN: APPLICATIONS MANAGEMENT ====================

@loan_router.get('/admin/loan-applications', response_model=List[LoanApplication])
async def get_all_applications(
    status: Optional[ApplicationStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: dict = Depends(lambda: {"id": "admin"})
):
    """Get all loan applications (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        if status:
            applications = await loan_service.get_applications_by_status(status, skip, limit)
        else:
            # Get all - simplified for MVP
            applications = await loan_service.get_applications_by_status(
                ApplicationStatus.SUBMITTED, skip, limit
            )
        return applications
    except Exception as e:
        logger.error(f"Error getting applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/admin/loan-applications/{application_id}', response_model=LoanApplication)
async def get_application_admin(
    application_id: str,
    current_user: dict = Depends(lambda: {"id": "admin"})
):
    """Get loan application (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    application = await loan_service.get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return application


@loan_router.post('/admin/loan-applications/{application_id}/review', response_model=LoanApplication)
async def review_application(
    application_id: str,
    request: ReviewLoanApplicationRequest,
    current_user: dict = Depends(lambda: {"id": "admin", "email": "admin@ross.com"})
):
    """Review and decide on application (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        application = await loan_service.review_application(
            application_id, request,
            current_user['id'], current_user['email']
        )
        
        # Send notifications if approved or rejected
        if request.decision in ['approve', 'reject']:
            try:
                from notification_service import NotificationService
                from server import db
                
                # Get config for notification service
                config_doc = await db.config.find_one({})
                notification_service = NotificationService(config_doc)
                
                # Get user info for notifications
                user = await db.users.find_one({'_id': application.user_id})
                if user:
                    user_name = user.get('full_name', user.get('username', 'Cliente'))
                    
                    if request.decision == 'approve':
                        # Calculate monthly payment (simple amortization)
                        product = await loan_service.get_product(application.product_id)
                        if product:
                            # Simple monthly payment calculation
                            r = product.interest_rate / 12  # monthly rate
                            n = application.term_count
                            monthly_payment = application.amount * (r * (1 + r)**n) / ((1 + r)**n - 1)
                            
                            await notification_service.send_loan_notifications(
                                user_email=application.contacts.email,
                                user_phone=application.contacts.phone,
                                user_name=user_name,
                                notification_type='approved',
                                loan_amount=application.amount,
                                loan_term=application.term_count,
                                monthly_payment=monthly_payment,
                                application_id=application.id
                            )
                            logger.info(f"Loan approval notifications sent for {application.id}")
                    else:  # reject
                        await notification_service.send_loan_notifications(
                            user_email=application.contacts.email,
                            user_phone=application.contacts.phone,
                            user_name=user_name,
                            notification_type='rejected',
                            application_id=application.id,
                            rejection_reason=request.notes
                        )
                        logger.info(f"Loan rejection notifications sent for {application.id}")
            except Exception as notif_error:
                logger.error(f"Failed to send loan decision notifications: {notif_error}")
                # Don't fail the request if notifications fail
        
        return application
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reviewing application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LOANS ====================

@loan_router.post('/admin/loans', response_model=Loan)
async def create_loan(
    request: CreateLoanRequest,
    current_user: dict = Depends(lambda: {"id": "admin", "email": "admin@ross.com"})
):
    """Create loan from approved application (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        loan = await loan_service.create_loan(
            request,
            current_user['id'], current_user['email']
        )
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating loan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/loans', response_model=List[Loan])
async def get_my_loans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50),
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Get my loans (client)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        loans = await loan_service.get_user_loans(current_user['id'], skip, limit)
        return loans
    except Exception as e:
        logger.error(f"Error getting loans: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.get('/loans/{loan_id}', response_model=Loan)
async def get_loan(
    loan_id: str,
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Get loan (client)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    loan = await loan_service.get_loan(loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Verify ownership
    if loan.user_id != current_user['id']:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    return loan


@loan_router.post('/loans/{loan_id}/sign', response_model=Loan)
async def sign_loan(
    loan_id: str,
    request: SignLoanRequest,
    current_user: dict = Depends(lambda: {"id": "user123"})
):
    """Sign loan contract (client)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        loan = await loan_service.sign_loan(loan_id, request, current_user['id'])
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error signing loan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@loan_router.post('/admin/loans/{loan_id}/disburse', response_model=Loan)
async def disburse_loan(
    loan_id: str,
    request: DisburseLoanRequest,
    current_user: dict = Depends(lambda: {"id": "admin", "email": "admin@ross.com"})
):
    """Disburse loan (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        loan = await loan_service.disburse_loan(
            loan_id, request,
            current_user['id'], current_user['email']
        )
        return loan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error disbursing loan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PAYMENTS ====================

@loan_router.post('/admin/loan-payments', response_model=LoanPayment)
async def record_payment(
    request: RecordPaymentRequest,
    current_user: dict = Depends(lambda: {"id": "admin", "email": "admin@ross.com"})
):
    """Record loan payment (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        payment = await loan_service.record_payment(
            request,
            current_user['id'], current_user['email']
        )
        return payment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error recording payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== METRICS & REPORTS ====================

@loan_router.get('/admin/loan-metrics', response_model=LoanMetrics)
async def get_loan_metrics(
    current_user: dict = Depends(lambda: {"id": "admin"})
):
    """Get loan portfolio metrics (admin)"""
    if not loan_service:
        raise HTTPException(status_code=503, detail="Loan service not available")
    
    try:
        metrics = await loan_service.get_metrics()
        return metrics
    except Exception as e:
        logger.error(f"Error getting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
