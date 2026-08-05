"""
Ross Lending AI Brain Service
Cerebro de IA exclusivo para el negocio de préstamos de Ross Lending Solutions
Separado completamente del AI Brain de Ross Tax

Capacidades:
- Análisis de cartera de préstamos
- Scoring de riesgo crediticio con IA
- Cobranza inteligente (predicción de default, estrategias)
- Compliance OCCC Texas
- Business Intelligence (métricas, proyecciones)
- Comunicaciones automatizadas
- Chat conversacional para administradores

Powered by Gemini 2.5 Flash
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

logger = logging.getLogger(__name__)


class LendingAIBrain:
    """
    Cerebro de IA exclusivo para Ross Lending Solutions
    Gestiona y automatiza el negocio de préstamos
    """
    
    def __init__(self, db, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        self._available = False
        self._provider = 'none'
        
        # Try emergentintegrations with Emergent LLM Key
        self._llm_key = os.getenv('EMERGENT_LLM_KEY') or os.getenv('OPENAI_API_KEY') or os.getenv('GEMINI_API_KEY')
        if self._llm_key:
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                self._LlmChat = LlmChat
                self._UserMessage = UserMessage
                self._available = True
                self._provider = 'emergent'
                logger.info("🧠 Lending AI Brain - Using Emergent LLM (GPT-4o)")
            except ImportError:
                logger.warning("emergentintegrations not available, trying direct OpenAI")
                try:
                    from openai import OpenAI
                    self._openai_client = OpenAI(api_key=self._llm_key)
                    self._available = True
                    self._provider = 'openai'
                    logger.info("🧠 Lending AI Brain - Using OpenAI GPT-4o")
                except Exception as e:
                    logger.warning(f"OpenAI not available: {e}")
        
        if not self._available:
            logger.warning("⚠️ Lending AI Brain - No AI provider available (will use rule-based logic)")
        
        # Collections
        self.loans_col = db.loans
        self.loan_apps_col = db.loan_applications
        self.payments_col = db.loan_payments
        self.users_col = db.users
        self.compliance_col = db.occc_compliance
        self.fraud_col = db.fraud_alerts
        self.notifications_col = db.notifications
        self.collection_col = db.collection_actions
        self.ai_decisions_col = db.lending_ai_decisions
        self.ai_logs_col = db.lending_ai_logs
        
        logger.info("🧠 Ross Lending AI Brain initialized")

    # ═══════════════════════════════════════════════════════
    # PORTFOLIO ANALYSIS
    # ═══════════════════════════════════════════════════════

    async def get_portfolio_summary(self) -> Dict[str, Any]:
        """Resumen completo de la cartera de préstamos"""
        try:
            total_loans = await self.loans_col.count_documents({})
            active_loans = await self.loans_col.count_documents({'status': {'$in': ['active', 'current']}})
            delinquent = await self.loans_col.count_documents({'status': {'$in': ['delinquent', 'past_due', 'late']}})
            defaulted = await self.loans_col.count_documents({'status': 'defaulted'})
            paid_off = await self.loans_col.count_documents({'status': {'$in': ['paid_off', 'completed', 'paid']}})
            
            # Total portfolio value
            pipeline = [
                {'$match': {'status': {'$in': ['active', 'current']}}},
                {'$group': {
                    '_id': None,
                    'total_principal': {'$sum': {'$ifNull': ['$principal_amount', '$amount']}},
                    'total_balance': {'$sum': {'$ifNull': ['$remaining_balance', '$balance']}},
                    'avg_interest': {'$avg': '$interest_rate'},
                    'avg_term': {'$avg': '$term_months'}
                }}
            ]
            agg = await self.loans_col.aggregate(pipeline).to_list(1)
            portfolio_data = agg[0] if agg else {}
            
            # Payments this month
            now = datetime.utcnow()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            payments_pipeline = [
                {'$match': {'created_at': {'$gte': month_start}}},
                {'$group': {
                    '_id': None,
                    'total_collected': {'$sum': '$amount'},
                    'payment_count': {'$sum': 1}
                }}
            ]
            pay_agg = await self.payments_col.aggregate(payments_pipeline).to_list(1)
            payment_data = pay_agg[0] if pay_agg else {}
            
            # Pending applications
            pending_apps = await self.loan_apps_col.count_documents({'status': {'$in': ['pending', 'under_review']}})
            
            delinquency_rate = (delinquent / active_loans * 100) if active_loans > 0 else 0
            
            return {
                'success': True,
                'portfolio': {
                    'total_loans': total_loans,
                    'active_loans': active_loans,
                    'delinquent': delinquent,
                    'defaulted': defaulted,
                    'paid_off': paid_off,
                    'pending_applications': pending_apps,
                    'total_principal': portfolio_data.get('total_principal', 0),
                    'total_outstanding_balance': portfolio_data.get('total_balance', 0),
                    'avg_interest_rate': round(portfolio_data.get('avg_interest', 0), 2),
                    'avg_term_months': round(portfolio_data.get('avg_term', 0), 1),
                    'delinquency_rate': round(delinquency_rate, 1),
                    'monthly_collections': payment_data.get('total_collected', 0),
                    'monthly_payment_count': payment_data.get('payment_count', 0),
                },
                'health': 'good' if delinquency_rate < 5 else 'warning' if delinquency_rate < 15 else 'critical'
            }
        except Exception as e:
            logger.error(f"Error getting portfolio summary: {e}")
            return {'success': False, 'error': str(e)}

    async def analyze_loan_performance(self) -> Dict[str, Any]:
        """Análisis de rendimiento por tipo de préstamo"""
        try:
            pipeline = [
                {'$group': {
                    '_id': {'$ifNull': ['$loan_type', '$type']},
                    'count': {'$sum': 1},
                    'total_amount': {'$sum': {'$ifNull': ['$principal_amount', '$amount']}},
                    'avg_rate': {'$avg': '$interest_rate'},
                    'delinquent_count': {
                        '$sum': {'$cond': [{'$in': ['$status', ['delinquent', 'past_due', 'late']]}, 1, 0]}
                    }
                }},
                {'$sort': {'total_amount': -1}}
            ]
            results = await self.loans_col.aggregate(pipeline).to_list(20)
            
            performance = []
            for r in results:
                loan_type = r['_id'] or 'standard'
                delinquency = (r['delinquent_count'] / r['count'] * 100) if r['count'] > 0 else 0
                performance.append({
                    'type': loan_type,
                    'count': r['count'],
                    'total_amount': r['total_amount'],
                    'avg_interest_rate': round(r.get('avg_rate', 0) or 0, 2),
                    'delinquency_rate': round(delinquency, 1),
                    'health': 'good' if delinquency < 5 else 'warning' if delinquency < 15 else 'critical'
                })
            
            return {'success': True, 'performance': performance}
        except Exception as e:
            logger.error(f"Error analyzing loan performance: {e}")
            return {'success': False, 'error': str(e)}

    # ═══════════════════════════════════════════════════════
    # RISK SCORING
    # ═══════════════════════════════════════════════════════

    async def calculate_risk_score(self, user_id: str) -> Dict[str, Any]:
        """Calcula un score de riesgo crediticio con IA"""
        try:
            user = await self.users_col.find_one({'_id': ObjectId(user_id)}) if ObjectId.is_valid(user_id) else await self.users_col.find_one({'user_id': user_id})
            if not user:
                return {'success': False, 'error': 'Usuario no encontrado'}
            
            # Get user's loan history
            user_loans = await self.loans_col.find(
                {'$or': [{'user_id': str(user.get('_id'))}, {'user_id': user_id}]}
            ).to_list(50)
            
            # Get payment history
            user_payments = await self.payments_col.find(
                {'$or': [{'user_id': str(user.get('_id'))}, {'user_id': user_id}]}
            ).to_list(100)
            
            # Rule-based scoring (0-100)
            score = 50  # Base score
            factors = []
            
            # Payment history (40% weight)
            if user_payments:
                on_time = sum(1 for p in user_payments if p.get('status') in ['completed', 'on_time', 'paid'])
                late = sum(1 for p in user_payments if p.get('status') in ['late', 'overdue'])
                total_payments = len(user_payments)
                
                if total_payments > 0:
                    on_time_rate = on_time / total_payments
                    score += int(on_time_rate * 30)
                    if on_time_rate > 0.9:
                        factors.append({'factor': 'Historial de pagos excelente', 'impact': 'positive', 'weight': '+30'})
                    elif on_time_rate > 0.7:
                        factors.append({'factor': 'Buen historial de pagos', 'impact': 'positive', 'weight': '+20'})
                    else:
                        score -= 15
                        factors.append({'factor': 'Pagos atrasados frecuentes', 'impact': 'negative', 'weight': '-15'})
            else:
                factors.append({'factor': 'Sin historial de pagos', 'impact': 'neutral', 'weight': '0'})
            
            # Loan history (20% weight)
            if user_loans:
                completed = sum(1 for l in user_loans if l.get('status') in ['paid_off', 'completed', 'paid'])
                defaulted = sum(1 for l in user_loans if l.get('status') == 'defaulted')
                
                if completed > 0:
                    score += min(completed * 5, 15)
                    factors.append({'factor': f'{completed} préstamo(s) completado(s)', 'impact': 'positive', 'weight': f'+{min(completed * 5, 15)}'})
                if defaulted > 0:
                    score -= defaulted * 20
                    factors.append({'factor': f'{defaulted} préstamo(s) en default', 'impact': 'negative', 'weight': f'-{defaulted * 20}'})
            
            # Account age (10% weight)
            created = user.get('created_at') or user.get('createdAt')
            if created:
                if isinstance(created, str):
                    try:
                        created = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    except:
                        created = None
                if created:
                    days_old = (datetime.utcnow() - created.replace(tzinfo=None)).days
                    if days_old > 365:
                        score += 10
                        factors.append({'factor': 'Cliente antiguo (>1 año)', 'impact': 'positive', 'weight': '+10'})
                    elif days_old > 180:
                        score += 5
                        factors.append({'factor': 'Cliente de 6+ meses', 'impact': 'positive', 'weight': '+5'})
                    else:
                        factors.append({'factor': 'Cliente nuevo', 'impact': 'neutral', 'weight': '0'})
            
            # Clamp score
            score = max(0, min(100, score))
            
            # Risk level
            if score >= 80:
                risk_level = 'low'
                recommendation = 'Pre-aprobado para préstamos estándar'
            elif score >= 60:
                risk_level = 'medium'
                recommendation = 'Aprobación con verificación adicional'
            elif score >= 40:
                risk_level = 'high'
                recommendation = 'Requiere garantía o co-firmante'
            else:
                risk_level = 'critical'
                recommendation = 'Solicitud probablemente rechazada'
            
            # AI enhancement if available
            ai_analysis = None
            if self._available and user_loans:
                ai_analysis = await self._ai_risk_analysis(user, user_loans, user_payments, score)
            
            result = {
                'success': True,
                'score': score,
                'risk_level': risk_level,
                'recommendation': recommendation,
                'factors': factors,
                'ai_analysis': ai_analysis,
                'user_name': f"{user.get('first_name', user.get('name', ''))} {user.get('last_name', '')}".strip(),
            }
            
            # Save score
            await self.db.ai_scores.insert_one({
                'user_id': str(user.get('_id')),
                'score': score,
                'risk_level': risk_level,
                'factors': factors,
                'created_at': datetime.utcnow()
            })
            
            return result
        except Exception as e:
            logger.error(f"Error calculating risk score: {e}")
            return {'success': False, 'error': str(e)}

    async def _ai_risk_analysis(self, user, loans, payments, base_score) -> Optional[str]:
        """Análisis de riesgo enriquecido con IA"""
        try:
            prompt = f"""Eres un analista de riesgo crediticio para Ross Lending Solutions (Texas, OCCC regulated).
            
Analiza este perfil de cliente y da una recomendación breve (3-4 oraciones máximo) en español:

Cliente: {user.get('first_name', '')} {user.get('last_name', '')}
Score base: {base_score}/100
Préstamos totales: {len(loans)}
Pagos realizados: {len(payments)}
Préstamos activos: {sum(1 for l in loans if l.get('status') in ['active', 'current'])}
Préstamos completados: {sum(1 for l in loans if l.get('status') in ['paid_off', 'completed', 'paid'])}
Pagos a tiempo: {sum(1 for p in payments if p.get('status') in ['completed', 'on_time', 'paid'])}
Pagos atrasados: {sum(1 for p in payments if p.get('status') in ['late', 'overdue'])}

Da tu análisis profesional considerando regulaciones OCCC de Texas."""
            
            if self._provider == 'emergent':
                chat = self._LlmChat(
                    api_key=self._llm_key,
                    session_id=f"risk-{user.get('_id', 'unknown')}",
                    system_message="Eres un analista de riesgo crediticio experto en regulaciones OCCC de Texas."
                ).with_model("openai", "gpt-4o")
                response = await chat.send_message(self._UserMessage(text=prompt))
                return response
            elif self._provider == 'openai':
                response = self._openai_client.chat.completions.create(
                    model='gpt-4o-mini',
                    messages=[{'role': 'user', 'content': prompt}],
                    max_tokens=300
                )
                return response.choices[0].message.content
        except Exception as e:
            logger.error(f"AI risk analysis error: {e}")
            return None

    # ═══════════════════════════════════════════════════════
    # COLLECTIONS / COBRANZA INTELIGENTE
    # ═══════════════════════════════════════════════════════

    async def get_delinquent_loans(self) -> Dict[str, Any]:
        """Obtiene préstamos morosos con estrategias de cobro sugeridas"""
        try:
            delinquent = await self.loans_col.find(
                {'status': {'$in': ['delinquent', 'past_due', 'late']}}
            ).to_list(100)
            
            results = []
            for loan in delinquent:
                user_id = loan.get('user_id')
                user = None
                if user_id:
                    if ObjectId.is_valid(user_id):
                        user = await self.users_col.find_one({'_id': ObjectId(user_id)})
                    if not user:
                        user = await self.users_col.find_one({'user_id': user_id})
                
                # Calculate days overdue
                due_date = loan.get('next_payment_date') or loan.get('due_date')
                days_overdue = 0
                if due_date:
                    if isinstance(due_date, str):
                        try:
                            due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                        except:
                            due_date = None
                    if due_date:
                        days_overdue = max(0, (datetime.utcnow() - due_date.replace(tzinfo=None)).days)
                
                # Determine collection strategy
                if days_overdue <= 7:
                    strategy = 'friendly_reminder'
                    urgency = 'low'
                    action = 'Enviar recordatorio amigable por SMS/email'
                elif days_overdue <= 30:
                    strategy = 'firm_reminder'
                    urgency = 'medium'
                    action = 'Llamada telefónica + email formal'
                elif days_overdue <= 60:
                    strategy = 'escalation'
                    urgency = 'high'
                    action = 'Contacto directo + plan de reestructuración'
                else:
                    strategy = 'legal_review'
                    urgency = 'critical'
                    action = 'Revisión legal + notificación formal'
                
                results.append({
                    'loan_id': str(loan.get('_id')),
                    'user_name': f"{(user or {}).get('first_name', '')} {(user or {}).get('last_name', '')}".strip() or 'N/A',
                    'user_email': (user or {}).get('email', ''),
                    'user_phone': (user or {}).get('phone', ''),
                    'amount_due': loan.get('payment_amount', loan.get('remaining_balance', 0)),
                    'total_balance': loan.get('remaining_balance', loan.get('balance', 0)),
                    'days_overdue': days_overdue,
                    'strategy': strategy,
                    'urgency': urgency,
                    'suggested_action': action,
                })
            
            results.sort(key=lambda x: x['days_overdue'], reverse=True)
            
            return {
                'success': True,
                'total_delinquent': len(results),
                'by_urgency': {
                    'critical': sum(1 for r in results if r['urgency'] == 'critical'),
                    'high': sum(1 for r in results if r['urgency'] == 'high'),
                    'medium': sum(1 for r in results if r['urgency'] == 'medium'),
                    'low': sum(1 for r in results if r['urgency'] == 'low'),
                },
                'loans': results
            }
        except Exception as e:
            logger.error(f"Error getting delinquent loans: {e}")
            return {'success': False, 'error': str(e)}

    async def predict_defaults(self) -> Dict[str, Any]:
        """Predice qué préstamos activos podrían caer en default"""
        try:
            active = await self.loans_col.find(
                {'status': {'$in': ['active', 'current']}}
            ).to_list(200)
            
            at_risk = []
            for loan in active:
                risk_score = 0
                risk_factors = []
                user_id = loan.get('user_id')
                
                # Check late payments history
                late_payments = await self.payments_col.count_documents({
                    'loan_id': str(loan.get('_id')),
                    'status': {'$in': ['late', 'overdue']}
                })
                if late_payments >= 3:
                    risk_score += 40
                    risk_factors.append(f'{late_payments} pagos atrasados')
                elif late_payments >= 1:
                    risk_score += 20
                    risk_factors.append(f'{late_payments} pago(s) atrasado(s)')
                
                # Check if high balance relative to income
                balance = loan.get('remaining_balance', loan.get('balance', 0))
                if balance and balance > 5000:
                    risk_score += 10
                    risk_factors.append('Balance alto (>$5,000)')
                
                # Check payment frequency
                total_payments = await self.payments_col.count_documents({
                    'loan_id': str(loan.get('_id'))
                })
                expected_term = loan.get('term_months', 12)
                if total_payments < expected_term * 0.3 and expected_term > 3:
                    risk_score += 15
                    risk_factors.append('Pocos pagos realizados vs. término')
                
                if risk_score >= 20:
                    user = None
                    if user_id:
                        if ObjectId.is_valid(user_id):
                            user = await self.users_col.find_one({'_id': ObjectId(user_id)})
                        if not user:
                            user = await self.users_col.find_one({'user_id': user_id})
                    
                    at_risk.append({
                        'loan_id': str(loan.get('_id')),
                        'user_name': f"{(user or {}).get('first_name', '')} {(user or {}).get('last_name', '')}".strip() or 'N/A',
                        'balance': balance,
                        'risk_score': min(risk_score, 100),
                        'risk_level': 'critical' if risk_score >= 60 else 'high' if risk_score >= 40 else 'medium',
                        'risk_factors': risk_factors,
                    })
            
            at_risk.sort(key=lambda x: x['risk_score'], reverse=True)
            
            return {
                'success': True,
                'total_active': len(active),
                'at_risk_count': len(at_risk),
                'at_risk_rate': round(len(at_risk) / max(len(active), 1) * 100, 1),
                'predictions': at_risk[:20]
            }
        except Exception as e:
            logger.error(f"Error predicting defaults: {e}")
            return {'success': False, 'error': str(e)}

    # ═══════════════════════════════════════════════════════
    # OCCC COMPLIANCE
    # ═══════════════════════════════════════════════════════

    async def check_compliance_status(self) -> Dict[str, Any]:
        """Verifica el estado de compliance OCCC de todos los préstamos"""
        try:
            total_compliance = await self.compliance_col.count_documents({})
            compliant = await self.compliance_col.count_documents({'status': 'compliant'})
            violations = await self.compliance_col.count_documents({'status': {'$in': ['violation', 'non_compliant']}})
            warnings = await self.compliance_col.count_documents({'status': 'warning'})
            
            # License status
            license_doc = await self.db.occc_license_status.find_one({})
            
            # Recent violations
            recent_violations = await self.compliance_col.find(
                {'status': {'$in': ['violation', 'non_compliant']}}
            ).sort('created_at', -1).limit(10).to_list(10)
            
            for v in recent_violations:
                v['_id'] = str(v['_id'])
            
            compliance_rate = (compliant / max(total_compliance, 1)) * 100
            
            return {
                'success': True,
                'compliance': {
                    'total_checks': total_compliance,
                    'compliant': compliant,
                    'violations': violations,
                    'warnings': warnings,
                    'compliance_rate': round(compliance_rate, 1),
                    'license_active': license_doc.get('active', False) if license_doc else False,
                    'license_expiry': str(license_doc.get('expiry_date', '')) if license_doc else '',
                },
                'recent_violations': recent_violations,
                'health': 'compliant' if compliance_rate >= 95 else 'at_risk' if compliance_rate >= 80 else 'non_compliant'
            }
        except Exception as e:
            logger.error(f"Error checking compliance: {e}")
            return {'success': False, 'error': str(e)}

    # ═══════════════════════════════════════════════════════
    # BUSINESS INTELLIGENCE
    # ═══════════════════════════════════════════════════════

    async def get_revenue_metrics(self, period: str = 'month') -> Dict[str, Any]:
        """Métricas de ingresos del negocio"""
        try:
            now = datetime.utcnow()
            
            if period == 'week':
                start = now - timedelta(days=7)
            elif period == 'month':
                start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            elif period == 'quarter':
                quarter_month = ((now.month - 1) // 3) * 3 + 1
                start = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Revenue from payments
            pipeline = [
                {'$match': {'created_at': {'$gte': start}, 'status': {'$in': ['completed', 'paid', 'on_time']}}},
                {'$group': {
                    '_id': None,
                    'total_revenue': {'$sum': '$amount'},
                    'payment_count': {'$sum': 1},
                    'avg_payment': {'$avg': '$amount'}
                }}
            ]
            rev = await self.payments_col.aggregate(pipeline).to_list(1)
            rev_data = rev[0] if rev else {}
            
            # New loans originated
            new_loans = await self.loans_col.count_documents({
                'created_at': {'$gte': start}
            })
            
            new_loans_pipeline = [
                {'$match': {'created_at': {'$gte': start}}},
                {'$group': {
                    '_id': None,
                    'total_originated': {'$sum': {'$ifNull': ['$principal_amount', '$amount']}},
                }}
            ]
            orig = await self.loans_col.aggregate(new_loans_pipeline).to_list(1)
            orig_data = orig[0] if orig else {}
            
            return {
                'success': True,
                'period': period,
                'revenue': {
                    'total_collected': rev_data.get('total_revenue', 0),
                    'payment_count': rev_data.get('payment_count', 0),
                    'avg_payment': round(rev_data.get('avg_payment', 0), 2),
                    'new_loans_count': new_loans,
                    'total_originated': orig_data.get('total_originated', 0),
                }
            }
        except Exception as e:
            logger.error(f"Error getting revenue: {e}")
            return {'success': False, 'error': str(e)}

    async def get_client_metrics(self) -> Dict[str, Any]:
        """Métricas de clientes"""
        try:
            total = await self.users_col.count_documents({})
            
            now = datetime.utcnow()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            new_this_month = await self.users_col.count_documents({'created_at': {'$gte': month_start}})
            
            # Clients with active loans
            active_borrowers_pipeline = [
                {'$match': {'status': {'$in': ['active', 'current']}}},
                {'$group': {'_id': '$user_id'}},
                {'$count': 'total'}
            ]
            borrowers = await self.loans_col.aggregate(active_borrowers_pipeline).to_list(1)
            active_borrowers = borrowers[0]['total'] if borrowers else 0
            
            return {
                'success': True,
                'clients': {
                    'total_registered': total,
                    'new_this_month': new_this_month,
                    'active_borrowers': active_borrowers,
                    'conversion_rate': round(active_borrowers / max(total, 1) * 100, 1)
                }
            }
        except Exception as e:
            logger.error(f"Error getting client metrics: {e}")
            return {'success': False, 'error': str(e)}

    # ═══════════════════════════════════════════════════════
    # AI CHAT (CONVERSATIONAL)
    # ═══════════════════════════════════════════════════════

    async def chat(self, message: str, conversation_history: List[Dict] = None) -> Dict[str, Any]:
        """Chat conversacional para admin - procesa comandos en lenguaje natural"""
        if not self._available:
            return {
                'success': True,
                'response': 'El módulo de IA no está disponible en este momento. Verifica la configuración de API keys.',
                'actions_taken': []
            }
        
        try:
            # Get live business context
            portfolio = await self.get_portfolio_summary()
            compliance = await self.check_compliance_status()
            clients = await self.get_client_metrics()
            
            context = f"""Eres el Cerebro de IA de Ross Lending Solutions, una empresa de préstamos regulada por OCCC en Texas.
            
DATOS EN TIEMPO REAL:
- Préstamos activos: {portfolio.get('portfolio', {}).get('active_loans', 0)}
- Cartera total: ${portfolio.get('portfolio', {}).get('total_outstanding_balance', 0):,.2f}
- Tasa de morosidad: {portfolio.get('portfolio', {}).get('delinquency_rate', 0)}%
- Préstamos morosos: {portfolio.get('portfolio', {}).get('delinquent', 0)}
- Solicitudes pendientes: {portfolio.get('portfolio', {}).get('pending_applications', 0)}
- Compliance OCCC: {compliance.get('compliance', {}).get('compliance_rate', 0)}%
- Total clientes: {clients.get('clients', {}).get('total_registered', 0)}
- Cobros del mes: ${portfolio.get('portfolio', {}).get('monthly_collections', 0):,.2f}
- Salud del portafolio: {portfolio.get('health', 'unknown')}

Responde siempre en español, de forma profesional y concisa. Si el admin te pide ejecutar una acción, confirma lo que harías.
Eres experto en regulaciones OCCC de Texas, CAB loans, y prácticas de cobranza éticas."""

            history_text = ""
            if conversation_history:
                for msg in conversation_history[-6:]:
                    role = "Admin" if msg.get('role') == 'user' else "AI Brain"
                    history_text += f"\n{role}: {msg.get('content', '')}"
            
            full_prompt = f"{context}\n\nHistorial:{history_text}\n\nAdmin: {message}\n\nAI Brain:"
            
            if self._provider == 'emergent':
                import uuid
                chat = self._LlmChat(
                    api_key=self._llm_key,
                    session_id=f"lending-brain-{uuid.uuid4().hex[:8]}",
                    system_message=context
                ).with_model("openai", "gpt-4o")
                ai_response = await chat.send_message(self._UserMessage(text=message))
            elif self._provider == 'openai':
                response = self._openai_client.chat.completions.create(
                    model='gpt-4o-mini',
                    messages=[
                        {'role': 'system', 'content': context},
                        {'role': 'user', 'content': message}
                    ],
                    max_tokens=1000
                )
                ai_response = response.choices[0].message.content
            else:
                ai_response = "IA no disponible"
            
            # Log the interaction
            await self.ai_logs_col.insert_one({
                'type': 'chat',
                'user_message': message,
                'ai_response': ai_response,
                'timestamp': datetime.utcnow()
            })
            
            return {
                'success': True,
                'response': ai_response,
                'context_used': {
                    'active_loans': portfolio.get('portfolio', {}).get('active_loans', 0),
                    'portfolio_health': portfolio.get('health', 'unknown'),
                }
            }
        except Exception as e:
            logger.error(f"AI Chat error: {e}")
            return {'success': False, 'response': f'Error: {str(e)}'}

    # ═══════════════════════════════════════════════════════
    # AUTOMATED COMMUNICATIONS
    # ═══════════════════════════════════════════════════════

    async def send_payment_reminders(self) -> Dict[str, Any]:
        """Envía recordatorios de pago inteligentes"""
        try:
            if not self.notification_service:
                return {'success': False, 'error': 'Notification service not available'}
            
            # Find loans with upcoming payments (next 3 days)
            now = datetime.utcnow()
            upcoming = now + timedelta(days=3)
            
            loans = await self.loans_col.find({
                'status': {'$in': ['active', 'current']},
                'next_payment_date': {'$lte': upcoming, '$gte': now}
            }).to_list(100)
            
            sent_count = 0
            for loan in loans:
                user_id = loan.get('user_id')
                user = None
                if user_id and ObjectId.is_valid(user_id):
                    user = await self.users_col.find_one({'_id': ObjectId(user_id)})
                
                if user and user.get('email'):
                    name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                    amount = loan.get('payment_amount', 0)
                    due = loan.get('next_payment_date')
                    
                    await self.notification_service.send_email(
                        to_email=user['email'],
                        subject=f"Recordatorio de Pago - Ross Lending",
                        html_content=f"""
                        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                            <div style="background-color: #0d47a1; padding: 20px; text-align: center;">
                                <h2 style="color: #ffffff !important; margin: 0;"><span style="color: #ffffff;">Ross Lending Solutions</span></h2>
                            </div>
                            <div style="padding: 25px; background: #ffffff;">
                                <p style="color: #333;">Hola {name},</p>
                                <p style="color: #555;">Tu próximo pago de <strong>${amount:,.2f}</strong> vence el <strong>{due}</strong>.</p>
                                <p style="color: #555;">Realiza tu pago a tiempo para mantener tu buen historial crediticio.</p>
                                <p style="color: #999; font-size: 12px;">Ross Lending Solutions — Servicios Financieros</p>
                            </div>
                        </div>
                        """
                    )
                    sent_count += 1
            
            return {
                'success': True,
                'reminders_sent': sent_count,
                'total_upcoming': len(loans)
            }
        except Exception as e:
            logger.error(f"Error sending reminders: {e}")
            return {'success': False, 'error': str(e)}

    # ═══════════════════════════════════════════════════════
    # BRAIN STATUS
    # ═══════════════════════════════════════════════════════

    async def get_status(self) -> Dict[str, Any]:
        """Estado completo del AI Brain"""
        try:
            total_decisions = await self.ai_decisions_col.count_documents({})
            total_logs = await self.ai_logs_col.count_documents({})
            
            last_action = await self.ai_logs_col.find_one(
                {}, sort=[('timestamp', -1)]
            )
            
            portfolio = await self.get_portfolio_summary()
            
            return {
                'success': True,
                'brain_active': self._available,
                'ai_provider': getattr(self, '_provider', 'none'),
                'total_decisions': total_decisions,
                'total_interactions': total_logs,
                'last_activity': str(last_action.get('timestamp', '')) if last_action else None,
                'portfolio_health': portfolio.get('health', 'unknown'),
                'modules': {
                    'portfolio_analysis': True,
                    'risk_scoring': True,
                    'collections': True,
                    'compliance_occc': True,
                    'business_intelligence': True,
                    'ai_chat': self._available,
                    'automated_communications': self.notification_service is not None,
                    'default_prediction': True,
                }
            }
        except Exception as e:
            logger.error(f"Error getting brain status: {e}")
            return {'success': False, 'error': str(e)}
