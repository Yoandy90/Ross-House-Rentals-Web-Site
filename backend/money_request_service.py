"""
Money Request Service - Servicio para gestionar solicitudes de dinero
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid

from money_request_models import (
    MoneyRequest, 
    RequestStatus,
    CreateMoneyRequestRequest,
    RespondMoneyRequestRequest,
    MoneyRequestResponse
)

logger = logging.getLogger(__name__)


class MoneyRequestService:
    """Servicio para gestionar solicitudes de dinero"""
    
    def __init__(self, db: AsyncIOMotorDatabase, notification_service=None):
        self.db = db
        self.collection = db.money_requests
        self._notification_service = notification_service
    
    async def _get_notification_service(self):
        """Get or create notification service"""
        if self._notification_service:
            logger.info("Using cached notification service")
            return self._notification_service
        
        # Load notification service on demand
        try:
            logger.info("Loading notification service from config...")
            config_doc = await self.db.config.find_one({})
            if config_doc:
                logger.info("Config found, creating NotificationService")
                from notification_service import NotificationService
                self._notification_service = NotificationService(config_doc)
                logger.info("✅ NotificationService created successfully")
                return self._notification_service
            else:
                logger.warning("⚠️ No config document found in database")
        except Exception as e:
            logger.error(f"❌ Error loading notification service: {e}")
        
        return None
    
    async def create_request(
        self,
        sender_id: str,
        sender_email: str,
        sender_name: str,
        receiver_email: str,
        amount: float,
        message: Optional[str] = None
    ) -> dict:
        """
        Crear una nueva solicitud de dinero
        """
        try:
            # Buscar al usuario destinatario por email o teléfono
            recipient = await self.db.users.find_one({
                "$or": [
                    {"email": receiver_email},
                    {"phone": receiver_email}
                ]
            })
            
            if not recipient:
                return {
                    'success': False,
                    'message': "Usuario no encontrado",
                    'error': "El email o teléfono no está registrado en nuestra plataforma"
                }
            
            # Verificar que no se solicite a sí mismo
            if str(recipient['_id']) == sender_id:
                return {
                    'success': False,
                    'message': "Error",
                    'error': "No puedes solicitarte dinero a ti mismo"
                }
            
            # Crear la solicitud
            request_id = f"req_{uuid.uuid4().hex[:12]}"
            expires_at = datetime.utcnow() + timedelta(hours=48)
            
            money_request = MoneyRequest(
                id=request_id,
                requester_id=sender_id,
                requester_email=sender_email,
                requester_name=sender_name,
                sender_id=str(recipient['_id']),
                sender_email=recipient.get('email', ''),
                sender_name=recipient.get('full_name', recipient.get('name', 'Usuario')),
                amount=amount,
                note=message,
                status=RequestStatus.PENDING,
                created_at=datetime.utcnow(),
                expires_at=expires_at
            )
            
            # Guardar en base de datos
            await self.collection.insert_one(money_request.dict())
            
            logger.info(f"💸 Money request created: {request_id} from {sender_name} to {recipient.get('full_name')} for ${amount}")
            
            # Enviar notificaciones al destinatario (quien debe pagar)
            notification_service = await self._get_notification_service()
            if notification_service:
                try:
                    recipient_email = recipient.get('email')
                    recipient_phone = recipient.get('phone')
                    recipient_name = recipient.get('full_name', recipient.get('name', 'Usuario'))
                    
                    # Enviar email
                    if recipient_email:
                        await notification_service.send_money_request_email(
                            to_email=recipient_email,
                            recipient_name=recipient_name,
                            requester_name=sender_name,
                            amount=amount,
                            note=message,
                            request_id=request_id
                        )
                        logger.info(f"📧 Money request email sent to {recipient_email}")
                    
                    # Enviar SMS
                    if recipient_phone:
                        await notification_service.send_money_request_sms(
                            to_phone=recipient_phone,
                            recipient_name=recipient_name,
                            requester_name=sender_name,
                            amount=amount
                        )
                        logger.info(f"📱 Money request SMS sent to {recipient_phone}")
                        
                except Exception as notif_error:
                    logger.error(f"Error sending money request notifications: {notif_error}")
                    # No fallar la creación de la solicitud si las notificaciones fallan
            
            return {
                'success': True,
                'message': "Solicitud enviada exitosamente",
                'request': money_request,
                'request_id': request_id
            }
            
        except Exception as e:
            logger.error(f"Error creating money request: {e}")
            return {
                'success': False,
                'message': "Error al crear solicitud",
                'error': str(e)
            }
    
    async def get_received_requests(self, user_id: str) -> List[MoneyRequest]:
        """
        Obtener solicitudes recibidas por un usuario (solicitudes donde él es el sender)
        """
        try:
            cursor = self.collection.find({
                "sender_id": user_id,
                "status": RequestStatus.PENDING
            }).sort("created_at", -1)
            
            requests = await cursor.to_list(length=100)
            
            # Convertir a modelos Pydantic
            return [MoneyRequest(**{k: v for k, v in req.items() if k != '_id'}) for req in requests]
            
        except Exception as e:
            logger.error(f"Error getting received requests: {e}")
            return []
    
    async def get_sent_requests(self, user_id: str) -> List[MoneyRequest]:
        """
        Obtener solicitudes enviadas por un usuario (donde él es el requester)
        """
        try:
            cursor = self.collection.find({
                "requester_id": user_id
            }).sort("created_at", -1).limit(50)
            
            requests = await cursor.to_list(length=100)
            
            # Convertir a modelos Pydantic
            return [MoneyRequest(**{k: v for k, v in req.items() if k != '_id'}) for req in requests]
            
        except Exception as e:
            logger.error(f"Error getting sent requests: {e}")
            return []
    
    async def approve_request(
        self,
        request_id: str,
        receiver_id: str
    ) -> dict:
        """Aprobar una solicitud de dinero"""
        return await self._respond_to_request(
            request_id=request_id,
            sender_id=receiver_id,
            action="approve"
        )
    
    async def reject_request(
        self,
        request_id: str,
        receiver_id: str
    ) -> dict:
        """Rechazar una solicitud de dinero"""
        return await self._respond_to_request(
            request_id=request_id,
            sender_id=receiver_id,
            action="reject"
        )
    
    async def _respond_to_request(
        self,
        request_id: str,
        sender_id: str,
        action: str,  # "approve" o "reject"
        rejection_reason: Optional[str] = None
    ) -> dict:
        """
        Responder a una solicitud de dinero (método interno)
        """
        try:
            # Obtener la solicitud
            logger.info(f"🔍 Responding to request {request_id}, action: {action}")
            request = await self.collection.find_one({"id": request_id})
            
            if not request:
                logger.warning(f"❌ Request {request_id} not found")
                return {
                    'success': False,
                    'message': "Solicitud no encontrada",
                    'error': "La solicitud no existe o ha sido eliminada"
                }
            
            logger.info(f"📝 Request found: sender_id={request['sender_id']}, requester_id={request['requester_id']}, status={request['status']}")
            
            # Verificar que el usuario sea el destinatario
            if request['sender_id'] != sender_id:
                logger.warning(f"❌ Authorization failed: request sender_id={request['sender_id']} vs user sender_id={sender_id}")
                return {
                    'success': False,
                    'message': "No autorizado",
                    'error': "No tienes permiso para responder a esta solicitud"
                }
            
            # Verificar que esté pendiente
            if request['status'] != RequestStatus.PENDING:
                return {
                    'success': False,
                    'message': "Solicitud ya procesada",
                    'error': f"Esta solicitud ya fue {request['status']}"
                }
            
            # Verificar que no haya expirado
            if datetime.utcnow() > request['expires_at']:
                await self.collection.update_one(
                    {"id": request_id},
                    {"$set": {"status": RequestStatus.EXPIRED}}
                )
                return {
                    'success': False,
                    'message': "Solicitud expirada",
                    'error': "Esta solicitud ha expirado"
                }
            
            if action == "approve":
                # Verificar saldo del sender
                balance_doc = await self.db.user_credit_balance.find_one({"user_id": sender_id})
                
                current_balance = balance_doc.get('balance', 0) if balance_doc else 0
                
                if current_balance < request['amount']:
                    return {
                        'success': False,
                        'message': "Saldo insuficiente",
                        'error': f"Tu saldo actual (${current_balance:.2f}) no es suficiente para esta transferencia"
                    }
                
                # Realizar la transferencia interna (no requiere Stripe)
                # Descontar del sender
                sender_update = await self.db.user_credit_balance.update_one(
                    {"user_id": sender_id},
                    {"$inc": {"balance": -request['amount']}}
                )
                
                if sender_update.modified_count == 0:
                    logger.error(f"Failed to deduct balance from sender {sender_id}")
                    return {
                        'success': False,
                        'message': "Error en transferencia",
                        'error': "No se pudo descontar el saldo"
                    }
                
                # Agregar al requester
                await self.db.user_credit_balance.update_one(
                    {"user_id": request['requester_id']},
                    {"$inc": {"balance": request['amount']}},
                    upsert=True
                )
                
                # Crear transacciones para historial
                # Transacción para el requester (quien recibe)
                await self.db.credit_transactions.insert_one({
                    "user_id": request['requester_id'],
                    "transaction_type": "transfer_received",
                    "amount": request['amount'],
                    "description": f"Solicitud aprobada: {request.get('note', 'Sin nota')}",
                    "status": "completed",
                    "created_at": datetime.utcnow()
                })
                
                # Transacción para el sender (quien envía)
                await self.db.credit_transactions.insert_one({
                    "user_id": sender_id,
                    "transaction_type": "transfer_sent",
                    "amount": -request['amount'],
                    "description": f"Solicitud aprobada para {request['requester_name']}",
                    "status": "completed",
                    "created_at": datetime.utcnow()
                })
                
                logger.info(f"💸 Transfer completed: ${request['amount']} from {sender_id} to {request['requester_id']}")
                
                if not sender_update:
                    return {
                        'success': False,
                        'message': 'Error en transferencia',
                        'error': 'Error desconocido'
                    }
                
                # Actualizar estado de la solicitud
                updated_request = await self.collection.find_one_and_update(
                    {"id": request_id},
                    {
                        "$set": {
                            "status": RequestStatus.APPROVED,
                            "responded_at": datetime.utcnow()
                        }
                    },
                    return_document=True
                )
                
                logger.info(f"✅ Money request approved: {request_id} - ${updated_request['amount']} transferred")
                
                # Enviar notificaciones al solicitante (quien pidió el dinero)
                notification_service = await self._get_notification_service()
                if notification_service:
                    try:
                        requester = await self.db.users.find_one({"_id": updated_request['requester_id']}) or \
                                   await self.db.users.find_one({"email": updated_request['requester_email']})
                        
                        if requester:
                            requester_email = requester.get('email')
                            requester_phone = requester.get('phone')
                            
                            # Enviar email
                            if requester_email:
                                await notification_service.send_money_request_approved_email(
                                    to_email=requester_email,
                                    requester_name=updated_request['requester_name'],
                                    sender_name=updated_request['sender_name'],
                                    amount=updated_request['amount']
                                )
                                logger.info(f"📧 Money request approved email sent to {requester_email}")
                            
                            # Enviar SMS
                            if requester_phone:
                                await notification_service.send_money_request_approved_sms(
                                    to_phone=requester_phone,
                                    requester_name=updated_request['requester_name'],
                                    sender_name=updated_request['sender_name'],
                                    amount=updated_request['amount']
                                )
                                logger.info(f"📱 Money request approved SMS sent to {requester_phone}")
                                
                    except Exception as notif_error:
                        logger.error(f"Error sending approval notifications: {notif_error}")
                        # No fallar si las notificaciones fallan
                
                return {
                    'success': True,
                    'message': f"Transferencia exitosa de ${updated_request['amount']:.2f}",
                    'request': MoneyRequest(**{k: v for k, v in updated_request.items() if k != '_id'})
                }
                
            elif action == "reject":
                # Rechazar la solicitud
                updated_request = await self.collection.find_one_and_update(
                    {"id": request_id},
                    {
                        "$set": {
                            "status": RequestStatus.REJECTED,
                            "responded_at": datetime.utcnow(),
                            "rejection_reason": rejection_reason
                        }
                    },
                    return_document=True
                )
                
                logger.info(f"❌ Money request rejected: {request_id}")
                
                return {
                    'success': True,
                    'message': "Solicitud rechazada",
                    'request': MoneyRequest(**{k: v for k, v in updated_request.items() if k != '_id'})
                }
            
            else:
                return {
                    'success': False,
                    'message': "Acción inválida",
                    'error': "La acción debe ser 'approve' o 'reject'"
                }
                
        except Exception as e:
            logger.error(f"Error responding to request: {e}")
            return {
                'success': False,
                'message': "Error al procesar respuesta",
                'error': str(e)
            }
    
    async def cancel_request(self, request_id: str, requester_id: str) -> dict:
        """
        Cancelar una solicitud pendiente
        """
        try:
            request = await self.collection.find_one({"id": request_id})
            
            if not request:
                return {
                    'success': False,
                    'message': "Solicitud no encontrada"
                }
            
            if request['requester_id'] != requester_id:
                return {
                    'success': False,
                    'message': "No autorizado"
                }
            
            if request['status'] != RequestStatus.PENDING:
                return {
                    'success': False,
                    'message': "Solo se pueden cancelar solicitudes pendientes"
                }
            
            await self.collection.update_one(
                {"id": request_id},
                {"$set": {"status": RequestStatus.CANCELLED}}
            )
            
            return {
                'success': True,
                'message': "Solicitud cancelada"
            }
            
        except Exception as e:
            logger.error(f"Error cancelling request: {e}")
            return {
                'success': False,
                'message': "Error al cancelar solicitud",
                'error': str(e)
            }
    
    async def expire_old_requests(self):
        """
        Marcar como expiradas las solicitudes antiguas (tarea programada)
        """
        try:
            result = await self.collection.update_many(
                {
                    "status": RequestStatus.PENDING,
                    "expires_at": {"$lt": datetime.utcnow()}
                },
                {
                    "$set": {"status": RequestStatus.EXPIRED}
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"⏰ Expired {result.modified_count} old money requests")
            
        except Exception as e:
            logger.error(f"Error expiring requests: {e}")


# Instancia global
money_request_service = None

def init_money_request_service(db: AsyncIOMotorDatabase):
    """Inicializar el servicio de solicitudes"""
    global money_request_service
    money_request_service = MoneyRequestService(db)
    logger.info("✅ Money request service initialized")
    return money_request_service
