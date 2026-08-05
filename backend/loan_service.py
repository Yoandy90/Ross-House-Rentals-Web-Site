"""
Loan Service - Ross Lending Solutions
Business logic for loan management, calculations, and operations
"""

import uuid
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
import math

from loan_models import (
    LoanProduct, CreateLoanProductRequest,
    LoanApplication, CreateLoanApplicationRequest, ReviewLoanApplicationRequest,
    Loan, CreateLoanRequest, SignLoanRequest, DisburseLoanRequest,
    LoanPayment, RecordPaymentRequest,
    Installment, InstallmentStatus, ApplicationStatus, LoanStatus,
    PaymentStatus, TermType, InterestMethod, AuditLog, LoanMetrics
)

logger = logging.getLogger(__name__)


class LoanService:
    """Service for loan operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        
    # ==================== HELPER METHODS ====================
    
    def _calculate_periodic_rate(self, apr: float, term_type: TermType) -> float:
        """Calculate periodic interest rate from APR"""
        if term_type == TermType.WEEKLY:
            return apr / 52
        elif term_type == TermType.BIWEEKLY:
            return apr / 26
        else:  # MONTHLY
            return apr / 12
    
    def _calculate_installment_price(
        self, 
        principal: float, 
        apr: float, 
        term_type: TermType, 
        term_count: int
    ) -> float:
        """
        Calculate fixed installment amount using Price (French) amortization
        Formula: A = P * i / (1 - (1 + i)^(-n))
        """
        i = self._calculate_periodic_rate(apr, term_type)
        
        if i == 0:
            # No interest case
            return principal / term_count
        
        n = term_count
        installment = principal * i / (1 - math.pow(1 + i, -n))
        
        return round(installment, 2)
    
    def _generate_amortization_schedule(
        self,
        principal: float,
        apr: float,
        term_type: TermType,
        term_count: int,
        first_payment_date: date,
        opening_fee: float = 0
    ) -> List[Installment]:
        """Generate complete amortization schedule using Price method"""
        
        installment_amount = self._calculate_installment_price(principal, apr, term_type, term_count)
        periodic_rate = self._calculate_periodic_rate(apr, term_type)
        
        # Calculate days between payments
        if term_type == TermType.WEEKLY:
            days_delta = 7
        elif term_type == TermType.BIWEEKLY:
            days_delta = 14
        else:  # MONTHLY
            days_delta = 30
        
        schedule = []
        balance = principal
        current_date = first_payment_date
        
        for idx in range(1, term_count + 1):
            # Calculate interest for this period
            interest = round(balance * periodic_rate, 2)
            
            # Principal payment
            principal_payment = round(installment_amount - interest, 2)
            
            # Adjust last payment to close out any rounding differences
            if idx == term_count:
                principal_payment = balance
                installment_amount = interest + principal_payment
            
            # Update balance
            balance = round(balance - principal_payment, 2)
            
            installment = Installment(
                idx=idx,
                due_date=current_date,
                amount_due=installment_amount,
                interest=interest,
                principal=principal_payment,
                balance_after=max(0, balance),
                status=InstallmentStatus.PENDING
            )
            
            schedule.append(installment)
            
            # Move to next payment date
            current_date = current_date + timedelta(days=days_delta)
        
        return schedule
    
    def _calculate_late_fee(
        self,
        installment: Installment,
        late_fee_config: dict,
        grace_days: int
    ) -> float:
        """Calculate late fee for overdue installment"""
        
        if installment.status != InstallmentStatus.OVERDUE:
            return 0
        
        days_late = (date.today() - installment.due_date).days - grace_days
        
        if days_late <= 0:
            return 0
        
        if late_fee_config['type'] == 'daily_percent':
            # Daily percentage of outstanding
            daily_rate = late_fee_config['value'] / 100
            outstanding = installment.amount_due - installment.paid_amount
            return round(outstanding * daily_rate * days_late, 2)
        else:
            # Fixed amount per day
            return round(late_fee_config['value'] * days_late, 2)
    
    async def _log_audit(
        self,
        actor_id: str,
        actor_email: str,
        entity: str,
        entity_id: str,
        action: str,
        before: Optional[dict] = None,
        after: Optional[dict] = None,
        notes: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log audit entry"""
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            actor_id=actor_id,
            actor_email=actor_email,
            entity=entity,
            entity_id=entity_id,
            action=action,
            before=before,
            after=after,
            notes=notes,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        
        await self.db.loan_audit_logs.insert_one(audit_log.dict())
    
    # ==================== LOAN PRODUCTS ====================
    
    async def create_product(
        self, 
        request: CreateLoanProductRequest,
        created_by: str,
        creator_email: str
    ) -> LoanProduct:
        """Create new loan product"""
        
        product = LoanProduct(
            id=str(uuid.uuid4()),
            name=request.name,
            description=request.description,
            currency=request.currency,
            min_amount=request.min_amount,
            max_amount=request.max_amount,
            term_type=request.term_type,
            term_count=request.term_count,
            apr=request.apr,
            opening_fee=request.opening_fee,
            late_fee=request.late_fee,
            grace_days=request.grace_days,
            interest_method=request.interest_method,
            policy=request.policy or {},
            is_active=True,
            created_by=created_by
        )
        
        await self.db.loan_products.insert_one(product.dict())
        
        await self._log_audit(
            created_by, creator_email,
            'loan_product', product.id,
            'created', None, product.dict()
        )
        
        logger.info(f"✅ Loan product created: {product.id} - {product.name}")
        
        return product
    
    async def get_products(
        self,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 100
    ) -> List[LoanProduct]:
        """Get loan products"""
        
        query = {}
        if active_only:
            query['is_active'] = True
        
        cursor = self.db.loan_products.find(query).skip(skip).limit(limit)
        products = await cursor.to_list(length=limit)
        
        # Remove MongoDB _id from each document
        for p in products:
            if '_id' in p:
                del p['_id']
        
        return [LoanProduct(**p) for p in products]
    
    async def get_product(self, product_id: str) -> Optional[LoanProduct]:
        """Get single product"""
        
        product = await self.db.loan_products.find_one({'id': product_id})
        
        if not product:
            return None
        
        # Remove MongoDB _id before creating Pydantic model
        if '_id' in product:
            del product['_id']
        
        return LoanProduct(**product)
    
    async def update_product(
        self,
        product_id: str,
        updates: dict,
        updated_by: str,
        updater_email: str
    ) -> Optional[LoanProduct]:
        """Update loan product"""
        
        product = await self.get_product(product_id)
        if not product:
            return None
        
        before = product.dict()
        
        updates['updated_at'] = datetime.utcnow()
        
        await self.db.loan_products.update_one(
            {'id': product_id},
            {'$set': updates}
        )
        
        updated_product = await self.get_product(product_id)
        
        await self._log_audit(
            updated_by, updater_email,
            'loan_product', product_id,
            'updated', before, updated_product.dict()
        )
        
        return updated_product
    
    # ==================== LOAN APPLICATIONS ====================
    
    async def create_application(
        self,
        user_id: str,
        request: CreateLoanApplicationRequest
    ) -> LoanApplication:
        """Create loan application"""
        
        # Verify product exists and is active
        product = await self.get_product(request.product_id)
        if not product or not product.is_active:
            raise ValueError("Product not found or inactive")
        
        # Validate amount
        if request.amount < product.min_amount or request.amount > product.max_amount:
            raise ValueError(f"Amount must be between {product.min_amount} and {product.max_amount}")
        
        # Calculate DTI
        dti = request.financials.expenses_monthly / request.financials.income_monthly if request.financials.income_monthly > 0 else 0
        
        application = LoanApplication(
            id=str(uuid.uuid4()),
            user_id=user_id,
            product_id=request.product_id,
            amount=request.amount,
            term_count=request.term_count,
            status=ApplicationStatus.SUBMITTED,
            contacts=request.contacts,
            financials=request.financials,
            consents=request.consents,
            dti=round(dti, 4),
            submitted_at=datetime.utcnow()
        )
        
        # Convert to dict and insert
        app_dict = application.dict()
        await self.db.loan_applications.insert_one(app_dict)
        
        logger.info(f"✅ Loan application created: {application.id} - User {user_id} - Amount ${request.amount}")
        
        # Auto-sync to Rise CRM (non-blocking)
        try:
            from rise_crm_sync_service import rise_sync_service
            if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
                import asyncio
                asyncio.create_task(rise_sync_service.sync_loan_application_to_rise(application.id))
                logger.info(f"🔄 Auto-sync triggered for loan application: {application.id}")
        except Exception as e:
            logger.warning(f"⚠️ Auto-sync failed (non-critical): {str(e)}")
        
        # Return fresh copy without MongoDB _id
        return application
    
    async def get_application(self, application_id: str) -> Optional[LoanApplication]:
        """Get loan application"""
        
        app = await self.db.loan_applications.find_one({'id': application_id})
        
        if not app:
            return None
        
        # Remove MongoDB _id before creating Pydantic model
        if '_id' in app:
            del app['_id']
        
        return LoanApplication(**app)
    
    async def get_user_applications(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> List[LoanApplication]:
        """Get user's applications"""
        
        cursor = self.db.loan_applications.find(
            {'user_id': user_id}
        ).sort('created_at', -1).skip(skip).limit(limit)
        
        apps = await cursor.to_list(length=limit)
        
        # Remove MongoDB _id from each document before creating Pydantic models
        for app in apps:
            if '_id' in app:
                del app['_id']
        
        return [LoanApplication(**a) for a in apps]
    
    async def get_applications_by_status(
        self,
        status: ApplicationStatus,
        skip: int = 0,
        limit: int = 100
    ) -> List[LoanApplication]:
        """Get applications by status"""
        
        cursor = self.db.loan_applications.find(
            {'status': status.value}
        ).sort('created_at', -1).skip(skip).limit(limit)
        
        apps = await cursor.to_list(length=limit)
        
        return [LoanApplication(**a) for a in apps]
    
    async def review_application(
        self,
        application_id: str,
        request: ReviewLoanApplicationRequest,
        reviewer_id: str,
        reviewer_email: str
    ) -> LoanApplication:
        """Review and decide on application"""
        
        application = await self.get_application(application_id)
        if not application:
            raise ValueError("Application not found")
        
        before = application.dict()
        
        # Update status based on decision
        if request.decision == 'approve':
            new_status = ApplicationStatus.APPROVED
        elif request.decision == 'reject':
            new_status = ApplicationStatus.REJECTED
        else:
            new_status = ApplicationStatus.PENDING_DOCUMENTS
        
        updates = {
            'status': new_status.value,
            'decision_notes': request.notes,
            'reviewed_by': reviewer_id,
            'reviewed_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        await self.db.loan_applications.update_one(
            {'id': application_id},
            {'$set': updates}
        )
        
        updated_app = await self.get_application(application_id)
        
        await self._log_audit(
            reviewer_id, reviewer_email,
            'loan_application', application_id,
            f'reviewed_{request.decision}',
            before, updated_app.dict(),
            request.notes
        )
        
        logger.info(f"✅ Application {application_id} reviewed: {request.decision} by {reviewer_email}")
        
        return updated_app
    
    # ==================== LOANS ====================
    
    async def create_loan(
        self,
        request: CreateLoanRequest,
        created_by: str,
        creator_email: str
    ) -> Loan:
        """Create loan from approved application"""
        
        # Get application
        application = await self.get_application(request.application_id)
        if not application:
            raise ValueError("Application not found")
        
        if application.status != ApplicationStatus.APPROVED:
            raise ValueError("Application must be approved first")
        
        # Get product
        product = await self.get_product(application.product_id)
        if not product:
            raise ValueError("Product not found")
        
        # Calculate opening fee
        if product.opening_fee.type == 'percent':
            opening_fee = round(application.amount * product.opening_fee.value / 100, 2)
        else:
            opening_fee = product.opening_fee.value
        
        # Generate schedule
        installments = self._generate_amortization_schedule(
            principal=application.amount,
            apr=product.apr,
            term_type=product.term_type,
            term_count=application.term_count,
            first_payment_date=request.first_payment_date,
            opening_fee=opening_fee
        )
        
        loan = Loan(
            id=str(uuid.uuid4()),
            application_id=application.id,
            user_id=application.user_id,
            product_id=product.id,
            principal=application.amount,
            apr=product.apr,
            term_type=product.term_type,
            term_count=application.term_count,
            opening_fee=opening_fee,
            status=LoanStatus.PENDING_SIGNATURE,
            installments=installments,
            first_payment_date=request.first_payment_date,
            outstanding_balance=application.amount
        )
        
        await self.db.loans.insert_one(loan.dict())
        
        await self._log_audit(
            created_by, creator_email,
            'loan', loan.id,
            'created', None, loan.dict()
        )
        
        logger.info(f"✅ Loan created: {loan.id} - Amount ${application.amount}")
        
        return loan
    
    async def get_loan(self, loan_id: str) -> Optional[Loan]:
        """Get loan"""
        
        loan = await self.db.loans.find_one({'id': loan_id})
        
        if not loan:
            return None
        
        return Loan(**loan)
    
    async def get_user_loans(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> List[Loan]:
        """Get user's loans"""
        
        cursor = self.db.loans.find(
            {'user_id': user_id}
        ).sort('created_at', -1).skip(skip).limit(limit)
        
        loans = await cursor.to_list(length=limit)
        
        return [Loan(**l) for l in loans]
    
    async def sign_loan(
        self,
        loan_id: str,
        request: SignLoanRequest,
        user_id: str
    ) -> Loan:
        """Sign loan contract"""
        
        loan = await self.get_loan(loan_id)
        if not loan:
            raise ValueError("Loan not found")
        
        if loan.user_id != user_id:
            raise ValueError("Unauthorized")
        
        if loan.status != LoanStatus.PENDING_SIGNATURE:
            raise ValueError("Loan is not pending signature")
        
        # In production, generate PDF, apply signature, upload to S3
        # For now, just mark as signed
        contract_url = f"contracts/{loan_id}_signed.pdf"
        
        updates = {
            'status': LoanStatus.PENDING_DISBURSEMENT.value,
            'signed_at': datetime.utcnow(),
            'signed_contract_url': contract_url,
            'updated_at': datetime.utcnow()
        }
        
        await self.db.loans.update_one(
            {'id': loan_id},
            {'$set': updates}
        )
        
        updated_loan = await self.get_loan(loan_id)
        
        await self._log_audit(
            user_id, '',
            'loan', loan_id,
            'signed', None, None,
            f"Signed from IP: {request.ip_address}"
        )
        
        logger.info(f"✅ Loan {loan_id} signed by user {user_id}")
        
        return updated_loan
    
    async def disburse_loan(
        self,
        loan_id: str,
        request: DisburseLoanRequest,
        disbursed_by: str,
        disburser_email: str
    ) -> Loan:
        """Disburse loan funds"""
        
        loan = await self.get_loan(loan_id)
        if not loan:
            raise ValueError("Loan not found")
        
        if loan.status != LoanStatus.PENDING_DISBURSEMENT:
            raise ValueError("Loan is not pending disbursement")
        
        # In production, initiate ACH/card payout via Stripe
        # For now, just mark as disbursed
        
        updates = {
            'status': LoanStatus.ACTIVE.value,
            'disbursed_at': datetime.utcnow(),
            'disbursement_method': request.method.value,
            'disbursement_reference': request.account_id or 'manual',
            'updated_at': datetime.utcnow()
        }
        
        await self.db.loans.update_one(
            {'id': loan_id},
            {'$set': updates}
        )
        
        updated_loan = await self.get_loan(loan_id)
        
        await self._log_audit(
            disbursed_by, disburser_email,
            'loan', loan_id,
            'disbursed', None, None,
            f"Method: {request.method.value}, Notes: {request.notes}"
        )
        
        logger.info(f"✅ Loan {loan_id} disbursed: ${loan.principal} via {request.method.value}")
        
        return updated_loan
    
    # ==================== PAYMENTS ====================
    
    async def record_payment(
        self,
        request: RecordPaymentRequest,
        recorded_by: str,
        recorder_email: str
    ) -> LoanPayment:
        """Record a loan payment"""
        
        loan = await self.get_loan(request.loan_id)
        if not loan:
            raise ValueError("Loan not found")
        
        # Create payment record
        payment = LoanPayment(
            id=str(uuid.uuid4()),
            loan_id=loan.id,
            user_id=loan.user_id,
            installment_idx=request.installment_idx,
            amount=request.amount,
            method=request.method,
            status=PaymentStatus.COMPLETED,
            provider='manual',
            gateway_reference=request.gateway_reference,
            notes=request.notes,
            recorded_by=recorded_by,
            completed_at=datetime.utcnow()
        )
        
        # Apply payment to loan
        await self._apply_payment_to_loan(loan, payment)
        
        await self.db.loan_payments.insert_one(payment.dict())
        
        await self._log_audit(
            recorded_by, recorder_email,
            'loan_payment', payment.id,
            'recorded', None, payment.dict()
        )
        
        logger.info(f"✅ Payment recorded: {payment.id} - Loan {loan.id} - ${request.amount}")
        
        return payment
    
    async def _apply_payment_to_loan(self, loan: Loan, payment: LoanPayment):
        """Apply payment to loan installments"""
        
        remaining = payment.amount
        applied_principal = 0
        applied_interest = 0
        applied_late_fees = 0
        
        # Apply to installments in order
        for installment in loan.installments:
            if remaining <= 0:
                break
            
            if installment.status in [InstallmentStatus.PAID, InstallmentStatus.WAIVED]:
                continue
            
            # Calculate what's owed
            owed = installment.amount_due - installment.paid_amount + installment.late_fee_accrued
            
            if owed <= 0:
                continue
            
            # Apply payment
            payment_to_installment = min(remaining, owed)
            
            # Allocate: late fees -> interest -> principal
            if installment.late_fee_accrued > 0:
                late_fee_payment = min(payment_to_installment, installment.late_fee_accrued)
                applied_late_fees += late_fee_payment
                payment_to_installment -= late_fee_payment
                installment.late_fee_accrued -= late_fee_payment
            
            if payment_to_installment > 0:
                # Interest
                interest_owed = installment.interest - (installment.paid_amount if installment.paid_amount <= installment.interest else installment.interest)
                interest_payment = min(payment_to_installment, interest_owed)
                applied_interest += interest_payment
                payment_to_installment -= interest_payment
            
            if payment_to_installment > 0:
                # Principal
                applied_principal += payment_to_installment
            
            installment.paid_amount += (payment_to_installment + (late_fee_payment if installment.late_fee_accrued >= 0 else 0))
            
            # Update installment status
            if installment.paid_amount >= installment.amount_due:
                installment.status = InstallmentStatus.PAID
                installment.paid_at = datetime.utcnow()
            elif installment.paid_amount > 0:
                installment.status = InstallmentStatus.PARTIAL
            
            remaining -= (payment_to_installment + (late_fee_payment if 'late_fee_payment' in locals() else 0))
        
        # Update payment allocation
        payment.applied_to_principal = applied_principal
        payment.applied_to_interest = applied_interest
        payment.applied_to_late_fees = applied_late_fees
        
        # Update loan totals
        loan.total_paid += payment.amount
        loan.outstanding_balance = max(0, loan.outstanding_balance - applied_principal)
        loan.total_interest_paid += applied_interest
        loan.total_late_fees += applied_late_fees
        loan.updated_at = datetime.utcnow()
        
        # Check if paid off
        if loan.outstanding_balance == 0:
            loan.status = LoanStatus.PAID_OFF
            loan.paid_off_at = datetime.utcnow()
        
        # Save loan
        await self.db.loans.update_one(
            {'id': loan.id},
            {'$set': loan.dict()}
        )
    
    # ==================== REPORTS & METRICS ====================
    
    async def get_metrics(self) -> LoanMetrics:
        """Get portfolio metrics"""
        
        today = date.today()
        
        # Applications
        total_applications = await self.db.loan_applications.count_documents({})
        pending_review = await self.db.loan_applications.count_documents({
            'status': ApplicationStatus.UNDER_REVIEW.value
        })
        
        approved_today = await self.db.loan_applications.count_documents({
            'status': ApplicationStatus.APPROVED.value,
            'reviewed_at': {'$gte': datetime.combine(today, datetime.min.time())}
        })
        
        rejected_today = await self.db.loan_applications.count_documents({
            'status': ApplicationStatus.REJECTED.value,
            'reviewed_at': {'$gte': datetime.combine(today, datetime.min.time())}
        })
        
        # Active loans
        active_loans = await self.db.loans.count_documents({
            'status': LoanStatus.ACTIVE.value
        })
        
        # Portfolio aggregation
        pipeline = [
            {'$match': {'status': LoanStatus.ACTIVE.value}},
            {'$group': {
                '_id': None,
                'total_outstanding': {'$sum': '$outstanding_balance'},
                'total_disbursed': {'$sum': '$principal'},
                'total_collected': {'$sum': '$total_paid'},
                'avg_loan_size': {'$avg': '$principal'},
                'avg_apr': {'$avg': '$apr'}
            }}
        ]
        
        result = await self.db.loans.aggregate(pipeline).to_list(1)
        
        if result:
            stats = result[0]
            total_portfolio = stats.get('total_outstanding', 0)
            total_disbursed = stats.get('total_disbursed', 0)
            total_collected = stats.get('total_collected', 0)
            avg_loan_size = stats.get('avg_loan_size', 0)
            avg_interest_rate = stats.get('avg_apr', 0)
        else:
            total_portfolio = 0
            total_disbursed = 0
            total_collected = 0
            avg_loan_size = 0
            avg_interest_rate = 0
        
        # Current vs overdue
        current_loans = 0
        current_balance = 0
        overdue_loans = 0
        overdue_balance = 0
        
        # PAR calculation (simplified)
        par_30 = 0
        par_60 = 0
        par_90 = 0
        
        # Get all active loans for detailed analysis
        loans = await self.db.loans.find({'status': LoanStatus.ACTIVE.value}).to_list(None)
        
        for loan_dict in loans:
            loan = Loan(**loan_dict)
            has_overdue = False
            max_days_late = 0
            
            for inst in loan.installments:
                if inst.status in [InstallmentStatus.OVERDUE, InstallmentStatus.PARTIAL]:
                    has_overdue = True
                    days_late = (today - inst.due_date).days
                    max_days_late = max(max_days_late, days_late)
            
            if has_overdue:
                overdue_loans += 1
                overdue_balance += loan.outstanding_balance
                
                if max_days_late >= 90:
                    par_90 += loan.outstanding_balance
                elif max_days_late >= 60:
                    par_60 += loan.outstanding_balance
                elif max_days_late >= 30:
                    par_30 += loan.outstanding_balance
            else:
                current_loans += 1
                current_balance += loan.outstanding_balance
        
        return LoanMetrics(
            total_applications=total_applications,
            pending_review=pending_review,
            approved_today=approved_today,
            rejected_today=rejected_today,
            active_loans=active_loans,
            total_portfolio=round(total_portfolio, 2),
            total_disbursed=round(total_disbursed, 2),
            total_collected=round(total_collected, 2),
            current_loans=current_loans,
            current_balance=round(current_balance, 2),
            overdue_loans=overdue_loans,
            overdue_balance=round(overdue_balance, 2),
            par_30=round(par_30, 2),
            par_60=round(par_60, 2),
            par_90=round(par_90, 2),
            avg_loan_size=round(avg_loan_size, 2),
            avg_interest_rate=round(avg_interest_rate, 4)
        )
