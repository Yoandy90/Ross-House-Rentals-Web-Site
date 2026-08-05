"""
Tax Wizard Service - Lógica principal del wizard
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from .models import (
    TaxWizardSession, WizardStep, WizardStatus, ServiceLevel,
    PersonalInfo, SpouseInfo, FilingStatus, Dependent,
    IncomeInfo, IncomeSource, DeductionsCredits, ReviewQuestions,
    WizardProgressResponse, ServiceRecommendation, CaseComplexity
)
from .calculator import calculate_refund_estimate
from .classifier import get_service_recommendation, get_required_documents

logger = logging.getLogger(__name__)


class TaxWizardService:
    """Servicio principal del Tax Wizard"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.tax_wizard_sessions
        logger.info("🧩 Tax Wizard Service initialized")
    
    # ============== CRUD OPERATIONS ==============
    
    async def create_session(self, user_id: str, tax_year: int = 2025) -> TaxWizardSession:
        """Crea una nueva sesión de wizard"""
        # Verificar si ya existe una sesión activa
        existing = await self.get_active_session(user_id, tax_year)
        if existing:
            logger.info(f"📝 Returning existing session for user {user_id}")
            return existing
        
        session = TaxWizardSession(
            user_id=user_id,
            tax_year=tax_year,
            status=WizardStatus.NOT_STARTED,
            current_step=WizardStep.SERVICE_SELECTION,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        session_dict = session.dict()
        session_dict['created_at'] = datetime.utcnow()
        session_dict['updated_at'] = datetime.utcnow()
        
        result = await self.collection.insert_one(session_dict)
        session.id = str(result.inserted_id)
        
        logger.info(f"✨ Created new tax wizard session {session.id} for user {user_id}")
        return session
    
    async def get_session(self, session_id: str) -> Optional[TaxWizardSession]:
        """Obtiene una sesión por ID"""
        try:
            doc = await self.collection.find_one({"_id": ObjectId(session_id)})
            if doc:
                doc['id'] = str(doc.pop('_id'))
                return TaxWizardSession(**doc)
        except Exception as e:
            logger.error(f"Error getting session: {e}")
        return None
    
    async def get_active_session(self, user_id: str, tax_year: int = 2025) -> Optional[TaxWizardSession]:
        """Obtiene la sesión activa de un usuario"""
        doc = await self.collection.find_one({
            "user_id": user_id,
            "tax_year": tax_year,
            "status": {"$nin": [WizardStatus.COMPLETED.value]}
        })
        if doc:
            doc['id'] = str(doc.pop('_id'))
            return TaxWizardSession(**doc)
        return None
    
    async def get_user_sessions(self, user_id: str) -> List[TaxWizardSession]:
        """Obtiene todas las sesiones de un usuario"""
        sessions = []
        cursor = self.collection.find({"user_id": user_id}).sort("created_at", -1)
        async for doc in cursor:
            doc['id'] = str(doc.pop('_id'))
            sessions.append(TaxWizardSession(**doc))
        return sessions
    
    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[TaxWizardSession]:
        """Actualiza una sesión"""
        updates['updated_at'] = datetime.utcnow()
        
        await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": updates}
        )
        
        return await self.get_session(session_id)
    
    async def delete_session(self, session_id: str) -> bool:
        """Elimina una sesión"""
        result = await self.collection.delete_one({"_id": ObjectId(session_id)})
        return result.deleted_count > 0
    
    # ============== WIZARD STEP HANDLERS ==============
    
    async def select_service_level(self, session_id: str, service_level: ServiceLevel) -> TaxWizardSession:
        """Selecciona el nivel de servicio"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        updates = {
            "service_level": service_level.value,
            "current_step": WizardStep.PERSONAL_INFO.value,
            "status": WizardStatus.IN_PROGRESS.value,
            "steps_completed": [WizardStep.SERVICE_SELECTION.value],
            "last_step_completed": WizardStep.SERVICE_SELECTION.value,
            "progress_percentage": 10
        }
        
        return await self.update_session(session_id, updates)
    
    async def save_personal_info(self, session_id: str, info: PersonalInfo) -> TaxWizardSession:
        """Guarda información personal"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.PERSONAL_INFO.value not in steps_completed:
            steps_completed.append(WizardStep.PERSONAL_INFO.value)
        
        updates = {
            "personal_info": info.dict(),
            "current_step": WizardStep.FILING_STATUS.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.PERSONAL_INFO.value,
            "progress_percentage": 20
        }
        
        return await self.update_session(session_id, updates)
    
    async def save_filing_status(self, session_id: str, status: FilingStatus, spouse: Optional[SpouseInfo] = None) -> TaxWizardSession:
        """Guarda estado civil"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.FILING_STATUS.value not in steps_completed:
            steps_completed.append(WizardStep.FILING_STATUS.value)
        
        updates = {
            "filing_status": status.value,
            "current_step": WizardStep.INCOME.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.FILING_STATUS.value,
            "progress_percentage": 30
        }
        
        if spouse:
            updates["spouse_info"] = spouse.dict()
        
        return await self.update_session(session_id, updates)
    
    async def save_income(self, session_id: str, income: IncomeInfo) -> TaxWizardSession:
        """Guarda información de ingresos"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Calcular total de ingresos
        total_income = 0
        total_withheld = 0
        
        for w2 in income.w2_sources:
            total_income += w2.amount
            total_withheld += w2.federal_withheld
        
        for f1099 in income.form_1099_sources:
            total_income += f1099.amount
            total_withheld += f1099.federal_withheld
        
        if income.has_self_employment:
            total_income += max(0, income.self_employment_income - income.self_employment_expenses)
        
        if income.has_unemployment:
            total_income += income.unemployment_amount
        
        if income.has_other_income:
            total_income += income.other_income_amount
        
        income.total_income = total_income
        income.total_withheld = total_withheld
        
        steps_completed = session.steps_completed or []
        if WizardStep.INCOME.value not in steps_completed:
            steps_completed.append(WizardStep.INCOME.value)
        
        updates = {
            "income": income.dict(),
            "current_step": WizardStep.DEPENDENTS.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.INCOME.value,
            "progress_percentage": 45
        }
        
        return await self.update_session(session_id, updates)
    
    async def save_dependents(self, session_id: str, dependents: List[Dependent]) -> TaxWizardSession:
        """Guarda información de dependientes"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Asignar IDs a dependientes
        for i, dep in enumerate(dependents):
            if not dep.id:
                dep.id = f"dep_{i+1}"
        
        steps_completed = session.steps_completed or []
        if WizardStep.DEPENDENTS.value not in steps_completed:
            steps_completed.append(WizardStep.DEPENDENTS.value)
        
        updates = {
            "dependents": [d.dict() for d in dependents],
            "current_step": WizardStep.DEDUCTIONS.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.DEPENDENTS.value,
            "progress_percentage": 55
        }
        
        return await self.update_session(session_id, updates)
    
    async def save_deductions(self, session_id: str, deductions: DeductionsCredits) -> TaxWizardSession:
        """Guarda deducciones y créditos"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.DEDUCTIONS.value not in steps_completed:
            steps_completed.append(WizardStep.DEDUCTIONS.value)
        
        updates = {
            "deductions_credits": deductions.dict(),
            "current_step": WizardStep.REVIEW.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.DEDUCTIONS.value,
            "progress_percentage": 65
        }
        
        return await self.update_session(session_id, updates)
    
    async def save_review(self, session_id: str, review: ReviewQuestions) -> TaxWizardSession:
        """Guarda preguntas de revisión y genera recomendación"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Actualizar review
        session.review = review
        
        # Calcular estimación de reembolso
        refund_estimate = calculate_refund_estimate(session)
        
        # Obtener recomendación de servicio
        recommendation = get_service_recommendation(session)
        
        # Obtener documentos requeridos
        required_docs = get_required_documents(session)
        
        # Calcular precio
        price_info = self._calculate_price(session, recommendation)
        
        steps_completed = session.steps_completed or []
        if WizardStep.REVIEW.value not in steps_completed:
            steps_completed.append(WizardStep.REVIEW.value)
        
        updates = {
            "review": review.dict(),
            "refund_estimate": refund_estimate.dict(),
            "case_complexity": recommendation.case_complexity.value,
            "recommended_service": recommendation.recommended_service.value,
            "recommended_reason": recommendation.reason_es,
            "documents_required": required_docs,
            "base_price": price_info['base_price'],
            "additional_fees": price_info['additional_fees'],
            "total_price": price_info['total_price'],
            "price_breakdown": price_info['breakdown'],
            "current_step": WizardStep.RECOMMENDATION.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.REVIEW.value,
            "progress_percentage": 75
        }
        
        return await self.update_session(session_id, updates)
    
    def _calculate_price(self, session: TaxWizardSession, recommendation: ServiceRecommendation) -> Dict:
        """Calcula el precio basado en el servicio y complejidad"""
        # Precios base por servicio
        base_prices = {
            ServiceLevel.DIY: 49.99,
            ServiceLevel.ASSISTED: 129.99,
            ServiceLevel.FULL_SERVICE: 199.99
        }
        
        service = session.service_level or recommendation.recommended_service
        base_price = base_prices.get(service, 129.99)
        
        breakdown = {"Servicio base": base_price}
        additional = 0
        
        # Ajustes por complejidad
        if session.case_complexity == CaseComplexity.COMPLEX:
            complexity_fee = 50.00
            breakdown["Caso complejo"] = complexity_fee
            additional += complexity_fee
        
        # Ajustes por self-employment
        if session.income.has_self_employment:
            se_fee = 75.00
            breakdown["Schedule C (negocio)"] = se_fee
            additional += se_fee
        
        # Ajustes por múltiples estados
        # (simplificado - podría expandirse)
        
        # Dependientes adicionales (más de 3)
        if len(session.dependents) > 3:
            extra_deps = len(session.dependents) - 3
            dep_fee = extra_deps * 10.00
            breakdown[f"Dependientes adicionales ({extra_deps})"] = dep_fee
            additional += dep_fee
        
        total = base_price + additional
        
        return {
            "base_price": base_price,
            "additional_fees": additional,
            "total_price": total,
            "breakdown": breakdown
        }
    
    async def confirm_recommendation(self, session_id: str, accepted_service: ServiceLevel) -> TaxWizardSession:
        """Confirma el servicio seleccionado después de la recomendación"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.RECOMMENDATION.value not in steps_completed:
            steps_completed.append(WizardStep.RECOMMENDATION.value)
        
        # Determinar si necesita cita
        needs_appointment = accepted_service == ServiceLevel.FULL_SERVICE
        
        # Determinar siguiente paso
        next_step = WizardStep.DOCUMENTS
        if needs_appointment:
            next_step = WizardStep.DOCUMENTS  # Primero documentos, luego cita
        
        updates = {
            "service_level": accepted_service.value,
            "appointment_required": needs_appointment,
            "current_step": next_step.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.RECOMMENDATION.value,
            "progress_percentage": 80
        }
        
        return await self.update_session(session_id, updates)
    
    async def mark_documents_uploaded(self, session_id: str, document_ids: List[str]) -> TaxWizardSession:
        """Marca documentos como subidos y vincula con el año fiscal de la sesión"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Actualizar lista de documentos
        uploaded = list(set(session.documents_uploaded + document_ids))
        
        # Vincular documentos con el año fiscal de la sesión
        tax_year = session.tax_year
        if tax_year and document_ids:
            try:
                for doc_id in document_ids:
                    await self.db.documents.update_one(
                        {'id': doc_id},
                        {'$set': {'tax_year': tax_year}}
                    )
                logging.info(f"📂 Linked {len(document_ids)} documents to tax year {tax_year}")
            except Exception as e:
                logging.error(f"Error linking documents to tax year: {e}")
        
        # Calcular faltantes
        required = session.documents_required or []
        missing = [doc for doc in required if doc not in uploaded]
        
        steps_completed = session.steps_completed or []
        
        # Determinar siguiente paso
        if len(missing) == 0:
            if WizardStep.DOCUMENTS.value not in steps_completed:
                steps_completed.append(WizardStep.DOCUMENTS.value)
            next_step = WizardStep.PAYMENT
            progress = 90
        else:
            next_step = WizardStep.DOCUMENTS
            progress = 85
        
        updates = {
            "documents_uploaded": uploaded,
            "documents_missing": missing,
            "current_step": next_step.value,
            "steps_completed": steps_completed,
            "progress_percentage": progress
        }
        
        if len(missing) == 0:
            updates["last_step_completed"] = WizardStep.DOCUMENTS.value
        
        return await self.update_session(session_id, updates)
    
    async def mark_payment_complete(self, session_id: str, payment_id: str) -> TaxWizardSession:
        """Marca el pago como completado"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.PAYMENT.value not in steps_completed:
            steps_completed.append(WizardStep.PAYMENT.value)
        
        # Determinar estado final
        if session.appointment_required:
            next_step = WizardStep.COMPLETE
            status = WizardStatus.DOCUMENTS_PENDING
        else:
            next_step = WizardStep.COMPLETE
            status = WizardStatus.UNDER_REVIEW
        
        updates = {
            "payment_status": "paid",
            "payment_id": payment_id,
            "current_step": next_step.value,
            "status": status.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.PAYMENT.value,
            "progress_percentage": 100
        }
        
        return await self.update_session(session_id, updates)
    
    async def complete_wizard(self, session_id: str) -> TaxWizardSession:
        """Marca el wizard como completado"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        steps_completed = session.steps_completed or []
        if WizardStep.COMPLETE.value not in steps_completed:
            steps_completed.append(WizardStep.COMPLETE.value)
        
        updates = {
            "current_step": WizardStep.COMPLETE.value,
            "status": WizardStatus.SUBMITTED.value,
            "steps_completed": steps_completed,
            "last_step_completed": WizardStep.COMPLETE.value,
            "completed_at": datetime.utcnow(),
            "progress_percentage": 100
        }
        
        return await self.update_session(session_id, updates)
    
    # ============== PROGRESS & ESTIMATION ==============
    
    async def get_progress(self, session_id: str) -> WizardProgressResponse:
        """Obtiene el progreso actual del wizard"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Determinar siguiente paso
        step_order = [
            WizardStep.SERVICE_SELECTION,
            WizardStep.PERSONAL_INFO,
            WizardStep.FILING_STATUS,
            WizardStep.INCOME,
            WizardStep.DEPENDENTS,
            WizardStep.DEDUCTIONS,
            WizardStep.REVIEW,
            WizardStep.RECOMMENDATION,
            WizardStep.DOCUMENTS,
            WizardStep.PAYMENT,
            WizardStep.COMPLETE
        ]
        
        current_idx = step_order.index(session.current_step)
        next_step = step_order[current_idx + 1] if current_idx < len(step_order) - 1 else None
        
        refund = None
        if session.refund_estimate:
            refund = session.refund_estimate.estimated_refund
            if not session.refund_estimate.is_refund:
                refund = -refund
        
        return WizardProgressResponse(
            session_id=session_id,
            current_step=session.current_step,
            progress_percentage=session.progress_percentage,
            steps_completed=session.steps_completed,
            next_step=next_step,
            refund_estimate=refund,
            status=session.status
        )
    
    async def calculate_live_estimate(self, session_id: str) -> Dict:
        """Calcula estimación en vivo (para mostrar mientras llena)"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        estimate = calculate_refund_estimate(session)
        
        return {
            "estimated_refund": estimate.estimated_refund,
            "is_refund": estimate.is_refund,
            "total_income": estimate.total_income,
            "taxable_income": estimate.taxable_income,
            "total_credits": estimate.total_credits,
            "total_withheld": estimate.total_withheld,
            "confidence_level": estimate.confidence_level
        }
    
    # ============== ADMIN OPERATIONS ==============
    
    async def get_all_sessions(
        self,
        status: Optional[WizardStatus] = None,
        complexity: Optional[CaseComplexity] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[TaxWizardSession]:
        """Obtiene todas las sesiones (para admin)"""
        query = {}
        
        if status:
            query["status"] = status.value
        
        if complexity:
            query["case_complexity"] = complexity.value
        
        sessions = []
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        
        async for doc in cursor:
            doc['id'] = str(doc.pop('_id'))
            sessions.append(TaxWizardSession(**doc))
        
        return sessions
    
    async def get_stats(self) -> Dict:
        """Obtiene estadísticas del wizard"""
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        status_counts = {}
        async for doc in self.collection.aggregate(pipeline):
            status_counts[doc['_id']] = doc['count']
        
        # Conteos por complejidad
        complexity_pipeline = [
            {
                "$group": {
                    "_id": "$case_complexity",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        complexity_counts = {}
        async for doc in self.collection.aggregate(complexity_pipeline):
            if doc['_id']:
                complexity_counts[doc['_id']] = doc['count']
        
        total = await self.collection.count_documents({})
        completed = status_counts.get(WizardStatus.COMPLETED.value, 0)
        in_progress = status_counts.get(WizardStatus.IN_PROGRESS.value, 0)
        
        return {
            "total_sessions": total,
            "completed": completed,
            "in_progress": in_progress,
            "by_status": status_counts,
            "by_complexity": complexity_counts,
            "completion_rate": (completed / total * 100) if total > 0 else 0
        }
    
    async def update_status(self, session_id: str, status: WizardStatus, admin_notes: Optional[str] = None) -> TaxWizardSession:
        """Actualiza el estado de una sesión (admin)"""
        updates = {"status": status.value}
        
        if admin_notes:
            updates["admin_notes"] = admin_notes
        
        if status == WizardStatus.COMPLETED:
            updates["completed_at"] = datetime.utcnow()
        
        return await self.update_session(session_id, updates)
    
    async def assign_preparer(self, session_id: str, preparer_id: str) -> TaxWizardSession:
        """Asigna un preparador a una sesión"""
        return await self.update_session(session_id, {"assigned_preparer": preparer_id})
