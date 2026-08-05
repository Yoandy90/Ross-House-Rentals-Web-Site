"""
Tax Estimate Service - Gestión de estimados de impuestos solicitados por clientes
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

class TaxEstimateService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.estimates = db['tax_estimates']
        self.users = db['users']
        self.kyc_data = db['kyc_data']
        
    async def create_estimate(
        self,
        user_id: str,
        tax_year: int,
        filing_status: str,
        annual_income: float,
        deductions: float,
        credits: float,
        withholding: float,
        state: str,
        calculation_results: Dict,
        client_notes: Optional[str] = None,
        wants_office_appointment: bool = False
    ) -> Dict:
        """
        Crea un nuevo estimado de impuestos con datos del cliente
        """
        try:
            # Obtener información del usuario
            user = await self.users.find_one({'id': user_id})
            if not user:
                return {'success': False, 'error': 'User not found'}
            
            # Intentar obtener datos de KYC para completar información
            kyc = await self.kyc_data.find_one({'user_id': user_id})
            
            # Preparar información del cliente
            client_name = user.get('full_name', user.get('email', 'Unknown'))
            client_email = user.get('email', '')
            client_phone = user.get('phone', '')
            client_address = None
            
            # Si tiene KYC, usar esos datos
            if kyc:
                client_name = kyc.get('full_name', client_name)
                client_phone = kyc.get('primary_phone', client_phone)
                
                # Construir dirección completa
                address_parts = [
                    kyc.get('address_street', ''),
                    kyc.get('address_city', ''),
                    kyc.get('address_state', ''),
                    kyc.get('address_zip', '')
                ]
                client_address = ', '.join([p for p in address_parts if p])
            
            # Crear el estimado
            estimate_id = str(ObjectId())
            estimate = {
                '_id': estimate_id,
                'id': estimate_id,
                'user_id': user_id,
                
                # Info del cliente
                'client_name': client_name,
                'client_email': client_email,
                'client_phone': client_phone,
                'client_address': client_address,
                
                # Datos fiscales
                'tax_year': tax_year,
                'filing_status': filing_status,
                'annual_income': annual_income,
                'deductions': deductions,
                'credits': credits,
                'withholding': withholding,
                'state': state,
                
                # Resultados
                'calculation_results': calculation_results,
                'estimated_refund': calculation_results.get('refund_or_owed', 0),
                'estimated_tax': calculation_results.get('total_tax', 0),
                'effective_rate': calculation_results.get('effective_rate', 0),
                
                # Estado
                'status': 'pending_review',
                'client_notes': client_notes,
                'wants_office_appointment': wants_office_appointment,
                'admin_notes': None,
                
                # Auditoría
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'reviewed_at': None,
                'reviewed_by': None
            }
            
            await self.estimates.insert_one(estimate)
            
            logger.info(f"✅ Tax estimate created: {estimate_id} for user {user_id}")
            
            return {
                'success': True,
                'estimate_id': estimate_id,
                'calculation_results': calculation_results,
                'message': '¡Tu estimado ha sido guardado! Un asesor te contactará pronto.'
            }
            
        except Exception as e:
            logger.error(f"Error creating tax estimate: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_user_estimates(self, user_id: str) -> List[Dict]:
        """Obtiene todos los estimados de un usuario"""
        try:
            estimates = await self.estimates.find(
                {'user_id': user_id}
            ).sort('created_at', -1).to_list(length=None)
            
            return estimates
            
        except Exception as e:
            logger.error(f"Error getting user estimates: {e}")
            return []
    
    async def get_estimate_by_id(self, estimate_id: str) -> Optional[Dict]:
        """Obtiene un estimado específico"""
        try:
            estimate = await self.estimates.find_one({'_id': estimate_id})
            return estimate
            
        except Exception as e:
            logger.error(f"Error getting estimate: {e}")
            return None
    
    async def get_all_estimates(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> Dict:
        """
        Obtiene todos los estimados (para admin panel)
        """
        try:
            query = {}
            if status:
                query['status'] = status
            
            # Total count
            total = await self.estimates.count_documents(query)
            
            # Get estimates
            estimates = await self.estimates.find(query).sort(
                'created_at', -1
            ).skip(skip).limit(limit).to_list(length=limit)
            
            # Calcular estadísticas
            stats = await self._calculate_stats()
            
            return {
                'estimates': estimates,
                'total': total,
                'page': skip // limit + 1 if limit > 0 else 1,
                'pages': (total + limit - 1) // limit if limit > 0 else 1,
                'stats': stats
            }
            
        except Exception as e:
            logger.error(f"Error getting all estimates: {e}")
            return {'estimates': [], 'total': 0, 'page': 1, 'pages': 1, 'stats': {}}
    
    async def update_estimate_status(
        self,
        estimate_id: str,
        status: str,
        admin_notes: Optional[str] = None,
        admin_user_id: Optional[str] = None
    ) -> Dict:
        """
        Actualiza el status de un estimado (admin only)
        """
        try:
            update_data = {
                'status': status,
                'updated_at': datetime.now(timezone.utc)
            }
            
            if admin_notes:
                update_data['admin_notes'] = admin_notes
            
            if status == 'reviewed' and admin_user_id:
                update_data['reviewed_at'] = datetime.now(timezone.utc)
                update_data['reviewed_by'] = admin_user_id
            
            result = await self.estimates.update_one(
                {'_id': estimate_id},
                {'$set': update_data}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Estimate {estimate_id} status updated to {status}")
                return {'success': True, 'message': 'Status updated successfully'}
            else:
                return {'success': False, 'message': 'Estimate not found'}
                
        except Exception as e:
            logger.error(f"Error updating estimate status: {e}")
            return {'success': False, 'error': str(e)}
    
    async def delete_estimate(self, estimate_id: str) -> Dict:
        """Elimina un estimado"""
        try:
            result = await self.estimates.delete_one({'_id': estimate_id})
            
            if result.deleted_count > 0:
                return {'success': True, 'message': 'Estimate deleted'}
            else:
                return {'success': False, 'message': 'Estimate not found'}
                
        except Exception as e:
            logger.error(f"Error deleting estimate: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _calculate_stats(self) -> Dict:
        """Calcula estadísticas de estimados"""
        try:
            total_estimates = await self.estimates.count_documents({})
            pending = await self.estimates.count_documents({'status': 'pending_review'})
            reviewed = await self.estimates.count_documents({'status': 'reviewed'})
            converted = await self.estimates.count_documents({'status': 'converted_to_case'})
            wants_appointment = await self.estimates.count_documents({'wants_office_appointment': True})
            
            # Promedio de reembolsos estimados
            pipeline = [
                {'$group': {
                    '_id': None,
                    'avg_refund': {'$avg': '$estimated_refund'},
                    'total_refunds': {'$sum': '$estimated_refund'}
                }}
            ]
            
            agg_result = await self.estimates.aggregate(pipeline).to_list(length=1)
            avg_refund = agg_result[0]['avg_refund'] if agg_result else 0
            total_refunds = agg_result[0]['total_refunds'] if agg_result else 0
            
            return {
                'total_estimates': total_estimates,
                'pending_review': pending,
                'reviewed': reviewed,
                'converted_to_case': converted,
                'wants_appointment': wants_appointment,
                'avg_estimated_refund': round(avg_refund, 2) if avg_refund else 0,
                'total_estimated_refunds': round(total_refunds, 2) if total_refunds else 0
            }
            
        except Exception as e:
            logger.error(f"Error calculating stats: {e}")
            return {}
