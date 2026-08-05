"""
Credit Transfer Service - P2P Transactions
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

class CreditTransferService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users = db.users
        self.credit_balances = db.user_credit_balance  # Corregido: usar user_credit_balance
        self.credit_transactions = db.credit_transactions
        self.credit_requests = db.credit_requests
        
    async def find_user_by_identifier(self, identifier: str) -> Optional[Dict]:
        """Find user by email or phone"""
        # Try email first
        user = await self.users.find_one({'email': identifier.lower()})
        if user:
            return user
            
        # Try phone
        user = await self.users.find_one({'phone': identifier})
        return user
    
    async def get_user_balance(self, user_id: str) -> float:
        """Get current credit balance for user"""
        balance_doc = await self.credit_balances.find_one({'user_id': user_id})
        if not balance_doc:
            # Create initial balance
            await self.credit_balances.insert_one({
                'user_id': user_id,
                'balance': 0.0,
                'lifetime_purchased': 0.0,
                'lifetime_earned_credits': 0.0,
                'lifetime_spent': 0.0,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            })
            return 0.0
        return balance_doc.get('balance', 0.0)
    
    async def transfer_credits(
        self, 
        sender_id: str, 
        recipient_identifier: str, 
        amount: float, 
        note: Optional[str] = None
    ) -> Dict:
        """Transfer credits from sender to recipient"""
        try:
            # Find recipient
            recipient = await self.find_user_by_identifier(recipient_identifier)
            if not recipient:
                return {
                    'success': False,
                    'message': 'Usuario no encontrado. Verifica el email o teléfono.'
                }
            
            recipient_id = str(recipient['_id'])
            
            # Check if trying to transfer to self
            if sender_id == recipient_id:
                return {
                    'success': False,
                    'message': 'No puedes transferir créditos a ti mismo.'
                }
            
            # Check sender balance
            sender_balance = await self.get_user_balance(sender_id)
            if sender_balance < amount:
                return {
                    'success': False,
                    'message': f'Saldo insuficiente. Tienes {sender_balance} créditos.'
                }
            
            # Create transaction record
            transaction_id = str(ObjectId())
            transaction_doc = {
                '_id': ObjectId(transaction_id),
                'type': 'transfer',
                'sender_id': sender_id,
                'recipient_id': recipient_id,
                'amount': amount,
                'note': note,
                'status': 'completed',
                'created_at': datetime.now(timezone.utc),
            }
            
            await self.credit_transactions.insert_one(transaction_doc)
            
            # Update sender balance (deduct)
            await self.credit_balances.update_one(
                {'user_id': sender_id},
                {
                    '$inc': {
                        'balance': -amount,
                        'lifetime_spent': amount
                    },
                    '$set': {'updated_at': datetime.now(timezone.utc)}
                }
            )
            
            # Update recipient balance (add)
            await self.credit_balances.update_one(
                {'user_id': recipient_id},
                {
                    '$inc': {
                        'balance': amount,
                        'lifetime_earned_credits': amount
                    },
                    '$set': {'updated_at': datetime.now(timezone.utc)}
                },
                upsert=True
            )
            
            # Get new sender balance
            new_balance = await self.get_user_balance(sender_id)
            
            logger.info(f"Transfer completed: {sender_id} -> {recipient_id}, amount: {amount}")
            
            return {
                'success': True,
                'message': f'Transferencia exitosa a {recipient.get("name", recipient.get("email"))}',
                'transaction_id': transaction_id,
                'new_balance': new_balance,
                'recipient_name': recipient.get('name', recipient.get('email'))
            }
            
        except Exception as e:
            logger.error(f"Error transferring credits: {e}")
            return {
                'success': False,
                'message': 'Error al procesar la transferencia. Intenta de nuevo.'
            }
    
    async def request_credits(
        self,
        requester_id: str,
        recipient_identifier: str,
        amount: float,
        reason: str
    ) -> Dict:
        """Create a credit request"""
        try:
            # Find recipient
            recipient = await self.find_user_by_identifier(recipient_identifier)
            if not recipient:
                return {
                    'success': False,
                    'message': 'Usuario no encontrado. Verifica el email o teléfono.'
                }
            
            recipient_id = str(recipient['_id'])
            
            # Check if requesting from self
            if requester_id == recipient_id:
                return {
                    'success': False,
                    'message': 'No puedes solicitar créditos a ti mismo.'
                }
            
            # Check recipient balance
            recipient_balance = await self.get_user_balance(recipient_id)
            if recipient_balance < amount:
                return {
                    'success': False,
                    'message': f'El usuario no tiene suficientes créditos ({recipient_balance} disponibles).'
                }
            
            # Create request
            request_id = str(ObjectId())
            request_doc = {
                '_id': ObjectId(request_id),
                'requester_id': requester_id,
                'recipient_id': recipient_id,
                'amount': amount,
                'reason': reason,
                'status': 'pending',
                'created_at': datetime.now(timezone.utc),
                'responded_at': None
            }
            
            await self.credit_requests.insert_one(request_doc)
            
            logger.info(f"Credit request created: {requester_id} -> {recipient_id}, amount: {amount}")
            
            return {
                'success': True,
                'message': f'Solicitud enviada a {recipient.get("name", recipient.get("email"))}',
                'request_id': request_id,
                'recipient_name': recipient.get('name', recipient.get('email'))
            }
            
        except Exception as e:
            logger.error(f"Error creating credit request: {e}")
            return {
                'success': False,
                'message': 'Error al crear la solicitud. Intenta de nuevo.'
            }
    
    async def respond_to_request(
        self,
        request_id: str,
        recipient_id: str,
        action: str
    ) -> Dict:
        """Approve or reject a credit request"""
        try:
            # Find request
            request = await self.credit_requests.find_one({
                '_id': ObjectId(request_id),
                'recipient_id': recipient_id,
                'status': 'pending'
            })
            
            if not request:
                return {
                    'success': False,
                    'message': 'Solicitud no encontrada o ya fue procesada.'
                }
            
            if action == 'approve':
                # Check balance
                balance = await self.get_user_balance(recipient_id)
                amount = request['amount']
                
                if balance < amount:
                    return {
                        'success': False,
                        'message': f'Saldo insuficiente. Tienes {balance} créditos.'
                    }
                
                # Perform transfer
                requester_id = request['requester_id']
                
                # Update balances
                await self.credit_balances.update_one(
                    {'user_id': recipient_id},
                    {
                        '$inc': {
                            'balance': -amount,
                            'lifetime_spent': amount
                        },
                        '$set': {'updated_at': datetime.now(timezone.utc)}
                    }
                )
                
                await self.credit_balances.update_one(
                    {'user_id': requester_id},
                    {
                        '$inc': {
                            'balance': amount,
                            'lifetime_earned_credits': amount
                        },
                        '$set': {'updated_at': datetime.now(timezone.utc)}
                    },
                    upsert=True
                )
                
                # Create transaction record
                transaction_doc = {
                    '_id': ObjectId(),
                    'type': 'request_approved',
                    'sender_id': recipient_id,
                    'recipient_id': requester_id,
                    'amount': amount,
                    'note': f'Solicitud aprobada: {request.get("reason", "")}',
                    'request_id': request_id,
                    'status': 'completed',
                    'created_at': datetime.now(timezone.utc),
                }
                await self.credit_transactions.insert_one(transaction_doc)
                
                # Update request status
                await self.credit_requests.update_one(
                    {'_id': ObjectId(request_id)},
                    {
                        '$set': {
                            'status': 'approved',
                            'responded_at': datetime.now(timezone.utc)
                        }
                    }
                )
                
                new_balance = await self.get_user_balance(recipient_id)
                
                return {
                    'success': True,
                    'message': f'Transferencia aprobada. {amount} créditos enviados.',
                    'new_balance': new_balance
                }
            
            else:  # reject
                # Update request status
                await self.credit_requests.update_one(
                    {'_id': ObjectId(request_id)},
                    {
                        '$set': {
                            'status': 'rejected',
                            'responded_at': datetime.now(timezone.utc)
                        }
                    }
                )
                
                return {
                    'success': True,
                    'message': 'Solicitud rechazada.'
                }
                
        except Exception as e:
            logger.error(f"Error responding to request: {e}")
            return {
                'success': False,
                'message': 'Error al procesar la respuesta. Intenta de nuevo.'
            }
    
    async def get_pending_requests(self, user_id: str) -> List[Dict]:
        """Get all pending requests for a user (both sent and received)"""
        try:
            # Requests received (user needs to approve/reject)
            received_cursor = self.credit_requests.find({
                'recipient_id': user_id,
                'status': 'pending'
            }).sort('created_at', -1)
            
            received = await received_cursor.to_list(length=100)
            
            # Get requester details
            for req in received:
                requester = await self.users.find_one({'_id': ObjectId(req['requester_id'])})
                req['requester_name'] = requester.get('name') if requester else 'Usuario'
                req['requester_email'] = requester.get('email') if requester else ''
                req['direction'] = 'received'
                req['id'] = str(req['_id'])
            
            # Requests sent (user is waiting for response)
            sent_cursor = self.credit_requests.find({
                'requester_id': user_id,
                'status': 'pending'
            }).sort('created_at', -1)
            
            sent = await sent_cursor.to_list(length=100)
            
            # Get recipient details
            for req in sent:
                recipient = await self.users.find_one({'_id': ObjectId(req['recipient_id'])})
                req['recipient_name'] = recipient.get('name') if recipient else 'Usuario'
                req['recipient_email'] = recipient.get('email') if recipient else ''
                req['direction'] = 'sent'
                req['id'] = str(req['_id'])
            
            return received + sent
            
        except Exception as e:
            logger.error(f"Error getting pending requests: {e}")
            return []
    
    async def get_transfer_history(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get transfer history for a user"""
        try:
            cursor = self.credit_transactions.find({
                '$or': [
                    {'sender_id': user_id},
                    {'recipient_id': user_id}
                ]
            }).sort('created_at', -1).limit(limit)
            
            transactions = await cursor.to_list(length=limit)
            
            # Enrich with user details
            for txn in transactions:
                txn['id'] = str(txn['_id'])
                
                if txn.get('sender_id'):
                    sender = await self.users.find_one({'_id': ObjectId(txn['sender_id'])})
                    txn['sender_name'] = sender.get('name') if sender else 'Usuario'
                    txn['sender_email'] = sender.get('email') if sender else ''
                
                if txn.get('recipient_id'):
                    recipient = await self.users.find_one({'_id': ObjectId(txn['recipient_id'])})
                    txn['recipient_name'] = recipient.get('name') if recipient else 'Usuario'
                    txn['recipient_email'] = recipient.get('email') if recipient else ''
                
                # Mark direction
                if txn.get('sender_id') == user_id:
                    txn['direction'] = 'sent'
                else:
                    txn['direction'] = 'received'
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error getting transfer history: {e}")
            return []
