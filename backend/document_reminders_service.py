"""
Document Reminders Service - Smart Reminders for Missing Documents using Ross AI
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class DocumentRemindersService:
    """Service for intelligent document reminders"""
    
    # Common documents needed for tax preparation
    REQUIRED_DOCUMENTS = {
        'w2': {
            'name': 'Formulario W-2',
            'description': 'Comprobante de salarios y retenciones de tu empleador',
            'priority': 'high',
            'category': 'income'
        },
        '1099': {
            'name': 'Formulario 1099',
            'description': 'Ingresos de trabajo freelance o contractor',
            'priority': 'high',
            'category': 'income'
        },
        '1098': {
            'name': 'Formulario 1098',
            'description': 'Intereses hipotecarios pagados',
            'priority': 'medium',
            'category': 'deductions'
        },
        'bank_statements': {
            'name': 'Estados de Cuenta Bancarios',
            'description': 'Estados de cuenta de los últimos 12 meses',
            'priority': 'medium',
            'category': 'verification'
        },
        'id_document': {
            'name': 'Identificación Oficial',
            'description': 'Licencia de conducir o pasaporte vigente',
            'priority': 'high',
            'category': 'identity'
        },
        'ssn_card': {
            'name': 'Tarjeta de Seguro Social',
            'description': 'Tarjeta de SSN o ITIN',
            'priority': 'high',
            'category': 'identity'
        },
        'receipts': {
            'name': 'Recibos de Gastos',
            'description': 'Recibos de gastos deducibles',
            'priority': 'low',
            'category': 'deductions'
        },
        'medical_expenses': {
            'name': 'Gastos Médicos',
            'description': 'Recibos de gastos médicos del año',
            'priority': 'low',
            'category': 'deductions'
        },
        'education_expenses': {
            'name': 'Gastos Educativos',
            'description': 'Formulario 1098-T o recibos de educación',
            'priority': 'medium',
            'category': 'deductions'
        },
        'childcare_expenses': {
            'name': 'Gastos de Cuidado Infantil',
            'description': 'Recibos de daycare o niñera',
            'priority': 'medium',
            'category': 'deductions'
        }
    }
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("✅ Document Reminders Service initialized")
    
    async def get_user_uploaded_documents(self, user_id: str) -> List[str]:
        """Get list of document categories already uploaded by user"""
        try:
            documents = await self.db.documents.find({
                '$or': [
                    {'user_id': user_id},
                    {'uploaded_by': user_id}
                ]
            }).to_list(100)
            
            categories = set()
            for doc in documents:
                category = doc.get('category', '').lower()
                if category:
                    categories.add(category)
                
                # Also check filename for common patterns
                filename = (doc.get('filename', '') or doc.get('name', '')).lower()
                for doc_type in self.REQUIRED_DOCUMENTS.keys():
                    if doc_type.replace('_', '') in filename.replace('_', '').replace('-', '').replace(' ', ''):
                        categories.add(doc_type)
            
            return list(categories)
        except Exception as e:
            logger.error(f"Error getting user documents: {e}")
            return []
    
    async def get_missing_documents(self, user_id: str) -> List[Dict]:
        """Identify which documents are missing for a user"""
        uploaded = await self.get_user_uploaded_documents(user_id)
        
        missing = []
        for doc_type, doc_info in self.REQUIRED_DOCUMENTS.items():
            # Check if this document type was uploaded
            if doc_type not in uploaded:
                missing.append({
                    'type': doc_type,
                    **doc_info
                })
        
        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        missing.sort(key=lambda x: priority_order.get(x['priority'], 2))
        
        return missing
    
    async def get_users_needing_reminders(self) -> List[Dict]:
        """Get users who need document reminders"""
        try:
            # Get users with upcoming appointments or active tax returns
            now = datetime.utcnow()
            two_weeks_from_now = now + timedelta(days=14)
            
            # Find users with appointments in next 2 weeks
            appointments = await self.db.appointments.find({
                'scheduled_at': {
                    '$gte': now,
                    '$lte': two_weeks_from_now
                },
                'status': {'$in': ['scheduled', 'confirmed', 'pending']}
            }).to_list(100)
            
            user_ids = set()
            for apt in appointments:
                user_id = apt.get('user_id') or apt.get('client_id')
                if user_id:
                    user_ids.add(str(user_id))
            
            # Also include users with pending tax returns
            tax_returns = await self.db.tax_returns.find({
                'status': {'$in': ['pending', 'in_progress', 'awaiting_documents']}
            }).to_list(100)
            
            for tr in tax_returns:
                user_id = tr.get('user_id')
                if user_id:
                    user_ids.add(str(user_id))
            
            # Get user details
            users = []
            for user_id in user_ids:
                user = await self.db.users.find_one({'id': user_id})
                if not user:
                    from bson import ObjectId
                    try:
                        user = await self.db.users.find_one({'_id': ObjectId(user_id)})
                    except:
                        pass
                
                if user:
                    users.append({
                        'id': str(user.get('id', user.get('_id', ''))),
                        'name': user.get('name', user.get('full_name', '')),
                        'email': user.get('email', ''),
                        'phone': user.get('phone', '')
                    })
            
            return users
        except Exception as e:
            logger.error(f"Error getting users needing reminders: {e}")
            return []
    
    async def generate_reminder_message(self, user_id: str, user_name: str) -> Optional[Dict]:
        """Generate a personalized reminder message for missing documents"""
        missing_docs = await self.get_missing_documents(user_id)
        
        if not missing_docs:
            return None
        
        # Get high priority documents
        high_priority = [d for d in missing_docs if d['priority'] == 'high']
        medium_priority = [d for d in missing_docs if d['priority'] == 'medium']
        
        # Create message
        greeting = f"¡Hola {user_name}! 👋"
        
        if high_priority:
            doc_list = ', '.join([d['name'] for d in high_priority[:3]])
            message = f"{greeting}\n\nPara completar tu declaración de impuestos, necesitamos los siguientes documentos importantes:\n\n"
            
            for i, doc in enumerate(high_priority[:3], 1):
                message += f"📄 {i}. {doc['name']}\n   {doc['description']}\n\n"
            
            if medium_priority:
                message += f"También sería útil si pudieras subir: {', '.join([d['name'] for d in medium_priority[:2]])}.\n\n"
            
            message += "Puedes subir estos documentos directamente desde la app Ross Tax. ¿Necesitas ayuda?"
        else:
            doc_list = ', '.join([d['name'] for d in medium_priority[:3]])
            message = f"{greeting}\n\nPara maximizar tus deducciones, te recomendamos subir:\n\n"
            
            for i, doc in enumerate(medium_priority[:3], 1):
                message += f"📎 {i}. {doc['name']}\n"
            
            message += "\n¿Tienes alguna pregunta sobre estos documentos?"
        
        return {
            'user_id': user_id,
            'user_name': user_name,
            'message': message,
            'missing_count': len(missing_docs),
            'high_priority_count': len(high_priority),
            'documents': missing_docs[:5]  # Top 5 missing
        }
    
    async def send_document_reminders(self) -> Dict:
        """Send document reminders to all users who need them"""
        results = {
            'total_users': 0,
            'reminders_sent': 0,
            'errors': 0,
            'details': []
        }
        
        try:
            users = await self.get_users_needing_reminders()
            results['total_users'] = len(users)
            
            for user in users:
                try:
                    reminder = await self.generate_reminder_message(
                        user['id'], 
                        user.get('name', 'Cliente')
                    )
                    
                    if reminder and reminder['high_priority_count'] > 0:
                        # Create notification
                        notification = {
                            'user_id': user['id'],
                            'type': 'document_reminder',
                            'title': '📄 Documentos Faltantes',
                            'message': f"Tienes {reminder['high_priority_count']} documentos importantes pendientes de subir.",
                            'data': {
                                'missing_documents': reminder['documents'],
                                'action': 'upload_documents'
                            },
                            'is_read': False,
                            'created_at': datetime.utcnow(),
                            'priority': 'high'
                        }
                        
                        await self.db.notifications.insert_one(notification)
                        
                        # Send WhatsApp if available
                        try:
                            from whatsapp_service import get_whatsapp_service
                            wa = get_whatsapp_service()
                            if wa and user.get('phone'):
                                await wa.send_message(
                                    user['phone'],
                                    reminder['message']
                                )
                        except Exception as wa_error:
                            logger.debug(f"WhatsApp send skipped: {wa_error}")
                        
                        results['reminders_sent'] += 1
                        results['details'].append({
                            'user': user['name'],
                            'missing_docs': reminder['high_priority_count'],
                            'status': 'sent'
                        })
                        
                except Exception as user_error:
                    logger.error(f"Error sending reminder to {user.get('name')}: {user_error}")
                    results['errors'] += 1
            
            logger.info(f"📧 Document reminders sent: {results['reminders_sent']}/{results['total_users']}")
            
        except Exception as e:
            logger.error(f"Error in send_document_reminders: {e}")
            results['errors'] += 1
        
        return results


# Global instance
_document_reminders_service = None

def init_document_reminders_service(db: AsyncIOMotorDatabase) -> DocumentRemindersService:
    global _document_reminders_service
    _document_reminders_service = DocumentRemindersService(db)
    return _document_reminders_service

def get_document_reminders_service() -> Optional[DocumentRemindersService]:
    return _document_reminders_service
