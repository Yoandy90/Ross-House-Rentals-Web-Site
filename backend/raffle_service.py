"""
Raffle Service - Business Logic for Raffles
"""
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

class RaffleService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.raffles = db.raffles
        self.raffle_tickets = db.raffle_tickets
        self.users = db.users
        self.credit_balances = db.credit_balances
        self.credit_transactions = db.credit_transactions
    
    async def create_raffle(self, raffle_data: Dict, admin_id: str) -> Dict:
        """Create a new raffle (admin only)"""
        try:
            raffle_id = str(uuid.uuid4())
            raffle_doc = {
                'id': raffle_id,
                '_id': raffle_id,  # Use UUID as _id for consistency
                **raffle_data,
                'admin_id': admin_id,
                'status': 'draft',
                'tickets_sold': 0,
                'participants_count': 0,
                'winner_id': None,
                'winner_name': None,
                'drawn_at': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            
            await self.raffles.insert_one(raffle_doc)
            
            logger.info(f"Raffle created: {raffle_doc['title']} by admin {admin_id}")
            return raffle_doc
            
        except Exception as e:
            logger.error(f"Error creating raffle: {e}")
            raise
    
    async def get_active_raffles(self) -> List[Dict]:
        """Get all active raffles for clients"""
        try:
            cursor = self.raffles.find({
                'status': {'$in': ['active', 'full']},
                'end_date': {'$gt': datetime.now(timezone.utc)}
            }).sort('created_at', -1)
            
            raffles = await cursor.to_list(length=100)
            
            for raffle in raffles:
                raffle['id'] = raffle['_id']
                # Calculate tickets remaining
                if raffle.get('total_tickets'):
                    raffle['tickets_remaining'] = raffle['total_tickets'] - raffle.get('tickets_sold', 0)
                else:
                    raffle['tickets_remaining'] = None  # Unlimited
            
            return raffles
            
        except Exception as e:
            logger.error(f"Error getting active raffles: {e}")
            return []
    
    async def get_raffle_by_id(self, raffle_id: str) -> Optional[Dict]:
        """Get raffle details"""
        try:
            # Try with string first
            raffle = await self.raffles.find_one({'_id': raffle_id})
            
            # If not found, try with ObjectId
            if not raffle:
                try:
                    from bson import ObjectId
                    if ObjectId.is_valid(raffle_id):
                        raffle = await self.raffles.find_one({'_id': ObjectId(raffle_id)})
                except:
                    pass
            
            # Also try with 'id' field
            if not raffle:
                raffle = await self.raffles.find_one({'id': raffle_id})
            
            if raffle:
                raffle['id'] = str(raffle['_id'])
                if raffle.get('total_tickets'):
                    raffle['tickets_remaining'] = raffle['total_tickets'] - raffle.get('tickets_sold', 0)
                else:
                    raffle['tickets_remaining'] = None
            return raffle
        except Exception as e:
            logger.error(f"Error getting raffle: {e}")
            return None
    
    async def buy_tickets(self, raffle_id: str, user_id: str, quantity: int) -> Dict:
        """Buy raffle tickets"""
        try:
            # Get raffle
            raffle = await self.get_raffle_by_id(raffle_id)
            if not raffle:
                return {'success': False, 'message': 'Sorteo no encontrado'}
            
            # Check status
            if raffle['status'] not in ['active', 'full']:
                return {'success': False, 'message': 'Este sorteo no está activo'}
            
            # Check end date
            end_date = raffle['end_date']
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            elif isinstance(end_date, datetime) and end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            
            if end_date < datetime.now(timezone.utc):
                return {'success': False, 'message': 'Este sorteo ha finalizado'}
            
            # Check max tickets per user
            user_tickets_count = await self.raffle_tickets.count_documents({
                'raffle_id': raffle_id,
                'user_id': user_id
            })
            
            max_per_user = raffle.get('max_tickets_per_user', 10)
            if user_tickets_count + quantity > max_per_user:
                return {
                    'success': False,
                    'message': f'Máximo {max_per_user} boletos por persona. Ya tienes {user_tickets_count}'
                }
            
            # Check total tickets available
            if raffle.get('total_tickets'):
                tickets_remaining = raffle['total_tickets'] - raffle.get('tickets_sold', 0)
                if quantity > tickets_remaining:
                    return {
                        'success': False,
                        'message': f'Solo quedan {tickets_remaining} boletos disponibles'
                    }
            
            # Check user balance
            total_cost = raffle['ticket_price'] * quantity
            balance_doc = await self.credit_balances.find_one({'user_id': user_id})
            if not balance_doc or balance_doc.get('balance', 0) < total_cost:
                return {
                    'success': False,
                    'message': f'Saldo insuficiente. Necesitas {total_cost} créditos'
                }
            
            # Generate ticket numbers
            tickets = []
            for i in range(quantity):
                ticket_id = str(uuid.uuid4())
                ticket_doc = {
                    'id': ticket_id,
                    '_id': ticket_id,
                    'raffle_id': raffle_id,
                    'raffle_title': raffle['title'],
                    'user_id': user_id,
                    'ticket_number': f"{raffle.get('tickets_sold', 0) + i + 1:06d}",
                    'purchased_at': datetime.now(timezone.utc),
                    'cost': raffle['ticket_price'],
                }
                await self.raffle_tickets.insert_one(ticket_doc)
                tickets.append(ticket_doc)
            
            # Deduct credits
            await self.credit_balances.update_one(
                {'user_id': user_id},
                {
                    '$inc': {
                        'balance': -total_cost,
                        'lifetime_spent': total_cost
                    },
                    '$set': {'updated_at': datetime.now(timezone.utc)}
                }
            )
            
            # Record transaction
            await self.credit_transactions.insert_one({
                'user_id': user_id,
                'type': 'raffle_purchase',
                'amount': -total_cost,
                'description': f'Compra de {quantity} boleto(s) para: {raffle["title"]}',
                'raffle_id': raffle_id,
                'created_at': datetime.now(timezone.utc),
            })
            
            # Update raffle
            participants_count = await self.raffle_tickets.distinct('user_id', {'raffle_id': raffle_id})
            new_status = raffle['status']
            if raffle.get('total_tickets') and (raffle.get('tickets_sold', 0) + quantity) >= raffle['total_tickets']:
                new_status = 'full'
            
            await self.raffles.update_one(
                {'_id': raffle_id},
                {
                    '$inc': {'tickets_sold': quantity},
                    '$set': {
                        'participants_count': len(participants_count) + (1 if user_tickets_count == 0 else 0),
                        'status': new_status,
                        'updated_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            # Get new balance
            new_balance_doc = await self.credit_balances.find_one({'user_id': user_id})
            new_balance = new_balance_doc.get('balance', 0) if new_balance_doc else 0
            
            logger.info(f"User {user_id} bought {quantity} tickets for raffle {raffle_id}")
            
            return {
                'success': True,
                'message': f'¡Compra exitosa! {quantity} boleto(s) adquirido(s)',
                'tickets': tickets,
                'new_balance': new_balance,
                'total_cost': total_cost
            }
            
        except Exception as e:
            logger.error(f"Error buying tickets: {e}")
            return {'success': False, 'message': 'Error al comprar boletos'}
    
    async def get_user_tickets(self, user_id: str, raffle_id: Optional[str] = None) -> List[Dict]:
        """Get user's raffle tickets"""
        try:
            query = {'user_id': user_id}
            if raffle_id:
                query['raffle_id'] = raffle_id
            
            cursor = self.raffle_tickets.find(query).sort('purchased_at', -1)
            tickets = await cursor.to_list(length=1000)
            
            for ticket in tickets:
                ticket['id'] = str(ticket['_id']) if '_id' in ticket else ticket.get('id')
            
            return tickets
            
        except Exception as e:
            logger.error(f"Error getting user tickets: {e}")
            return []
    
    async def execute_raffle(self, raffle_id: str, admin_id: str) -> Dict:
        """Execute raffle and select winner"""
        try:
            # Get raffle
            raffle = await self.get_raffle_by_id(raffle_id)
            if not raffle:
                return {'success': False, 'message': 'Sorteo no encontrado'}
            
            if raffle['status'] == 'completed':
                return {'success': False, 'message': 'Este sorteo ya fue ejecutado'}
            
            if raffle.get('tickets_sold', 0) == 0:
                return {'success': False, 'message': 'No hay participantes en este sorteo'}
            
            # Get all tickets
            tickets = await self.raffle_tickets.find({'raffle_id': raffle_id}).to_list(length=10000)
            
            if not tickets:
                return {'success': False, 'message': 'No hay boletos vendidos'}
            
            # Select random winner
            winning_ticket = random.choice(tickets)
            winner_id = winning_ticket['user_id']
            
            # Get winner info
            winner = await self.users.find_one({'_id': winner_id})
            winner_name = winner.get('name', 'Usuario') if winner else 'Usuario'
            
            # Update raffle
            await self.raffles.update_one(
                {'_id': raffle_id},
                {
                    '$set': {
                        'status': 'completed',
                        'winner_id': winner_id,
                        'winner_name': winner_name,
                        'winning_ticket_number': winning_ticket.get('ticket_number'),
                        'drawn_at': datetime.now(timezone.utc),
                        'updated_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            # Award prize if it's credits
            if raffle['prize_type'] == 'credits' and raffle.get('prize_credits'):
                await self.credit_balances.update_one(
                    {'user_id': winner_id},
                    {
                        '$inc': {
                            'balance': raffle['prize_credits'],
                            'lifetime_earned_credits': raffle['prize_credits']
                        },
                        '$set': {'updated_at': datetime.now(timezone.utc)}
                    },
                    upsert=True
                )
                
                await self.credit_transactions.insert_one({
                    'user_id': winner_id,
                    'type': 'raffle_prize',
                    'amount': raffle['prize_credits'],
                    'description': f'Premio de sorteo: {raffle["title"]}',
                    'raffle_id': raffle_id,
                    'created_at': datetime.now(timezone.utc),
                })
            
            logger.info(f"Raffle {raffle_id} executed. Winner: {winner_name} ({winner_id})")
            
            return {
                'success': True,
                'message': 'Sorteo ejecutado exitosamente',
                'winner_id': winner_id,
                'winner_name': winner_name,
                'winning_ticket': winning_ticket.get('ticket_number'),
                'total_participants': raffle.get('participants_count', 0),
                'total_tickets': raffle.get('tickets_sold', 0)
            }
            
        except Exception as e:
            logger.error(f"Error executing raffle: {e}")
            return {'success': False, 'message': 'Error al ejecutar el sorteo'}
    
    async def get_all_raffles_admin(self) -> List[Dict]:
        """Get all raffles for admin panel"""
        try:
            cursor = self.raffles.find({}).sort('created_at', -1)
            raffles = await cursor.to_list(length=1000)
            
            for raffle in raffles:
                raffle['id'] = raffle['_id']
                if raffle.get('total_tickets'):
                    raffle['tickets_remaining'] = raffle['total_tickets'] - raffle.get('tickets_sold', 0)
                else:
                    raffle['tickets_remaining'] = None
            
            return raffles
            
        except Exception as e:
            logger.error(f"Error getting admin raffles: {e}")
            return []
    
    async def update_raffle(self, raffle_id: str, update_data: Dict) -> Dict:
        """Update raffle (admin only)"""
        try:
            update_data['updated_at'] = datetime.now(timezone.utc)
            
            await self.raffles.update_one(
                {'_id': raffle_id},
                {'$set': update_data}
            )
            
            logger.info(f"Raffle {raffle_id} updated")
            return {'success': True, 'message': 'Sorteo actualizado'}
            
        except Exception as e:
            logger.error(f"Error updating raffle: {e}")
            return {'success': False, 'message': 'Error al actualizar sorteo'}
    
    async def delete_raffle(self, raffle_id: str) -> Dict:
        """Delete raffle (admin only, only if no tickets sold)"""
        try:
            raffle = await self.get_raffle_by_id(raffle_id)
            if not raffle:
                return {'success': False, 'message': 'Sorteo no encontrado'}
            
            if raffle.get('tickets_sold', 0) > 0:
                return {
                    'success': False,
                    'message': 'No se puede eliminar un sorteo con boletos vendidos'
                }
            
            # Try to delete with the original _id type
            from bson import ObjectId
            deleted = False
            
            # Try with string
            result = await self.raffles.delete_one({'_id': raffle_id})
            if result.deleted_count > 0:
                deleted = True
            
            # Try with ObjectId
            if not deleted and ObjectId.is_valid(raffle_id):
                result = await self.raffles.delete_one({'_id': ObjectId(raffle_id)})
                if result.deleted_count > 0:
                    deleted = True
            
            # Try with 'id' field
            if not deleted:
                result = await self.raffles.delete_one({'id': raffle_id})
                if result.deleted_count > 0:
                    deleted = True
            
            if deleted:
                logger.info(f"Raffle {raffle_id} deleted")
                return {'success': True, 'message': 'Sorteo eliminado'}
            else:
                return {'success': False, 'message': 'No se pudo eliminar el sorteo'}
            
        except Exception as e:
            logger.error(f"Error deleting raffle: {e}")
            return {'success': False, 'message': 'Error al eliminar sorteo'}
