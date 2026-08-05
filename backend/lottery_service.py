"""
Lottery Service - Business Logic for Lottery System with 3 Game Types
"""
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class LotteryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.lotteries = db['lotteries']
        self.lottery_tickets = db['lottery_tickets']
        self.users = db['users']
        self.credit_transactions = db['credit_transactions']
        
    # ==================== CLIENT METHODS ====================
    
    async def get_active_lotteries(self) -> List[Dict]:
        """Get all active lotteries"""
        try:
            cursor = self.lotteries.find({
                'status': {'$in': ['active', 'full']},
            }).sort('created_at', -1)
            
            lotteries = await cursor.to_list(length=100)
            
            for lottery in lotteries:
                lottery['id'] = lottery['_id']
                # Calculate tickets sold
                tickets_sold = await self.lottery_tickets.count_documents({'lottery_id': lottery['_id']})
                lottery['tickets_sold'] = tickets_sold
                
                # Calculate participants
                participants = await self.lottery_tickets.distinct('user_id', {'lottery_id': lottery['_id']})
                lottery['participants_count'] = len(participants)
            
            return lotteries
            
        except Exception as e:
            logger.error(f"Error getting active lotteries: {e}")
            raise
    
    async def get_lottery_by_id(self, lottery_id: str) -> Optional[Dict]:
        """Get lottery details"""
        try:
            from bson import ObjectId
            # Try to convert to ObjectId if it's a valid ObjectId string
            try:
                query_id = ObjectId(lottery_id)
            except:
                # If not valid ObjectId, use as string
                query_id = lottery_id
            
            lottery = await self.lotteries.find_one({'_id': query_id})
            if lottery:
                lottery['id'] = str(lottery['_id'])
                
                # Calculate tickets sold using the ObjectId
                tickets_sold = await self.lottery_tickets.count_documents({'lottery_id': lottery['_id']})
                lottery['tickets_sold'] = tickets_sold
                
                # Calculate participants
                participants = await self.lottery_tickets.distinct('user_id', {'lottery_id': lottery['_id']})
                lottery['participants_count'] = len(participants)
            
            return lottery
            
        except Exception as e:
            logger.error(f"Error getting lottery: {e}")
            raise
    
    async def buy_lottery_tickets(
        self, 
        lottery_id: str, 
        user_id: str, 
        selected_numbers: Optional[List[int]] = None,
        quantity: int = 1,
        bet_type: str = 'fijo'
    ) -> Dict:
        """Buy lottery tickets - handles all 3 game types"""
        try:
            # Convert lottery_id to ObjectId if needed
            from bson import ObjectId
            try:
                query_id = ObjectId(lottery_id)
            except:
                query_id = lottery_id
            
            # Get lottery
            lottery = await self.lotteries.find_one({'_id': query_id})
            if not lottery:
                return {'success': False, 'message': 'Lotería no encontrada'}
            
            lottery_type = lottery.get('lottery_type', 'traditional')
            
            # Check status
            if lottery['status'] not in ['active', 'draft']:
                return {'success': False, 'message': 'Esta lotería no está activa'}
            
            # Handle different lottery types
            if lottery_type == 'scratch_card':
                return await self._buy_scratch_card(lottery, user_id, quantity)
            elif lottery_type == 'bolita':
                return await self._buy_bolita_ticket(lottery, user_id, selected_numbers, quantity, bet_type)
            else:  # traditional
                return await self._buy_traditional_ticket(lottery, user_id, selected_numbers, quantity)
            
        except Exception as e:
            logger.error(f"Error buying lottery tickets: {e}")
            raise
    
    async def _buy_scratch_card(self, lottery: Dict, user_id: str, quantity: int) -> Dict:
        """Buy scratch card - instant game"""
        try:
            lottery_id = lottery['_id']
            
            # Check max tickets per user
            user_tickets = await self.lottery_tickets.count_documents({
                'lottery_id': lottery_id,
                'user_id': user_id
            })
            
            if user_tickets + quantity > lottery['max_tickets_per_user']:
                return {
                    'success': False,
                    'message': f'Máximo {lottery["max_tickets_per_user"]} raspaditos por persona'
                }
            
            # Check total cards limit
            if lottery.get('total_cards'):
                total_sold = await self.lottery_tickets.count_documents({'lottery_id': lottery_id})
                if total_sold + quantity > lottery['total_cards']:
                    return {'success': False, 'message': 'No hay suficientes raspaditos disponibles'}
            
            # Calculate total cost
            total_cost = lottery['ticket_price'] * quantity
            
            # Check user balance
            user = await self.users.find_one({'_id': user_id})
            if not user:
                return {'success': False, 'message': 'Usuario no encontrado'}
            
            user_balance = user.get('credit_balance', 0)
            if user_balance < total_cost:
                return {
                    'success': False,
                    'message': f'Saldo insuficiente. Necesitas {total_cost} créditos'
                }
            
            # Generate scratch cards
            tickets = []
            prize_config = lottery.get('scratch_card_prizes', {'2x': 50, '5x': 20, '10x': 10, 'jackpot': 1})
            
            for i in range(quantity):
                # Determine prize (weighted random)
                is_winner, prize_multiplier = self._determine_scratch_prize(prize_config)
                
                ticket_number = f"SCRATCH-{lottery_id[:8]}-{random.randint(10000, 99999)}"
                ticket_id = str(uuid.uuid4())
                
                prize_won = None
                prize_credits = 0
                
                if is_winner:
                    if prize_multiplier == 'jackpot':
                        prize_credits = lottery.get('prize_credits', 100)
                        prize_won = f"JACKPOT: {prize_credits} créditos"
                    else:
                        multiplier = int(prize_multiplier.replace('x', ''))
                        prize_credits = lottery['ticket_price'] * multiplier
                        prize_won = f"{prize_multiplier}: {prize_credits} créditos"
                
                ticket_doc = {
                    'id': ticket_id,
                    '_id': ticket_id,
                    'lottery_id': lottery_id,
                    'lottery_title': lottery['title'],
                    'lottery_type': 'scratch_card',
                    'user_id': user_id,
                    'selected_numbers': None,
                    'ticket_number': ticket_number,
                    'purchased_at': datetime.now(timezone.utc),
                    'cost': lottery['ticket_price'],
                    'revealed': False,
                    'is_winner': is_winner,
                    'prize_won': prize_won,
                    'prize_credits': prize_credits,
                }
                
                await self.lottery_tickets.insert_one(ticket_doc)
                tickets.append(ticket_doc)
            
            # Deduct credits
            new_balance = user_balance - total_cost
            await self.users.update_one(
                {'_id': user_id},
                {'$set': {'credit_balance': new_balance}}
            )
            
            # Create transaction
            transaction_id = str(uuid.uuid4())
            transaction = {
                'id': transaction_id,
                '_id': transaction_id,
                'user_id': user_id,
                'type': 'usage',
                'amount': total_cost,
                'description': f'Compra de {quantity} raspadito(s): {lottery["title"]}',
                'service_type': 'lottery_scratch_card',
                'balance_after': new_balance,
                'created_at': datetime.now(timezone.utc),
            }
            await self.credit_transactions.insert_one(transaction)
            
            # Update lottery status
            if lottery['status'] == 'draft':
                await self.lotteries.update_one(
                    {'_id': lottery_id},
                    {'$set': {'status': 'active', 'updated_at': datetime.now(timezone.utc)}}
                )
            
            logger.info(f"User {user_id} bought {quantity} scratch card(s)")
            
            return {
                'success': True,
                'message': f'Compraste {quantity} raspadito(s). ¡Revélalos para ver si ganaste!',
                'tickets': tickets,
                'new_balance': new_balance,
                'total_cost': total_cost
            }
            
        except Exception as e:
            logger.error(f"Error buying scratch card: {e}")
            raise
    
    def _determine_scratch_prize(self, prize_config: Dict[str, int]) -> tuple:
        """Determine if scratch card wins and what prize"""
        # Create weighted list
        options = []
        for prize, weight in prize_config.items():
            options.extend([prize] * weight)
        
        # Add many "no prize" options to balance odds
        total_weight = sum(prize_config.values())
        options.extend(['none'] * (total_weight * 5))  # 5x more chance of losing
        
        result = random.choice(options)
        
        if result == 'none':
            return False, None
        else:
            return True, result
    
    async def _buy_bolita_ticket(
        self, 
        lottery: Dict, 
        user_id: str, 
        selected_numbers: Optional[List[int]],
        quantity: int,
        bet_type: str = 'fijo'
    ) -> Dict:
        """Buy La Bolita ticket - supports fijo (1 number), corrido (multiple), and parley (2 numbers)"""
        try:
            lottery_id = lottery['_id']
            
            # Validate selected numbers based on bet type
            if not selected_numbers:
                return {'success': False, 'message': 'Debes seleccionar al menos un número'}
            
            # Validate based on bet type
            if bet_type == 'fijo' and len(selected_numbers) != 1:
                return {'success': False, 'message': 'Debes seleccionar exactamente 1 número para apuesta Fijo'}
            elif bet_type == 'parley' and len(selected_numbers) != 2:
                return {'success': False, 'message': 'Debes seleccionar exactamente 2 números para apuesta Parley'}
            elif bet_type == 'corrido' and (len(selected_numbers) < 1 or len(selected_numbers) > 5):
                return {'success': False, 'message': 'Debes seleccionar entre 1 y 5 números para apuesta Corrido'}
            
            # Validate number range
            bolita_range = lottery.get('bolita_number_range', 100)
            for num in selected_numbers:
                if num < 0 or num >= bolita_range:
                    return {
                        'success': False,
                        'message': f'Todos los números deben estar entre 0 y {bolita_range - 1}'
                    }
            
            # Check draw date
            if lottery.get('draw_date'):
                draw_date = lottery['draw_date']
                if isinstance(draw_date, str):
                    draw_date = datetime.fromisoformat(draw_date.replace('Z', '+00:00'))
                elif isinstance(draw_date, datetime) and draw_date.tzinfo is None:
                    draw_date = draw_date.replace(tzinfo=timezone.utc)
                
                if draw_date < datetime.now(timezone.utc):
                    return {'success': False, 'message': 'Esta lotería ya ha cerrado'}
            
            # Check max tickets per user
            user_tickets = await self.lottery_tickets.count_documents({
                'lottery_id': lottery_id,
                'user_id': user_id
            })
            
            if user_tickets + quantity > lottery['max_tickets_per_user']:
                return {
                    'success': False,
                    'message': f'Máximo {lottery["max_tickets_per_user"]} boletos por persona'
                }
            
            # Calculate total cost based on bet type
            base_price = lottery['ticket_price']
            if bet_type == 'fijo':
                total_cost = base_price * quantity
            elif bet_type == 'corrido':
                # Corrido: base price per number selected
                total_cost = base_price * len(selected_numbers) * quantity
            elif bet_type == 'parley':
                # Parley: 1.5x base price
                total_cost = int(base_price * 1.5 * quantity)
            else:
                total_cost = base_price * quantity
            
            # Check user balance
            user = await self.users.find_one({'_id': user_id})
            if not user:
                return {'success': False, 'message': 'Usuario no encontrado'}
            
            user_balance = user.get('credit_balance', 0)
            if user_balance < total_cost:
                return {
                    'success': False,
                    'message': f'Saldo insuficiente. Necesitas {total_cost} créditos'
                }
            
            # Generate tickets
            tickets = []
            
            for i in range(quantity):
                # Generate ticket number with all selected numbers
                numbers_str = '-'.join([f"{num:02d}" for num in selected_numbers])
                ticket_number = f"BOLITA-{bet_type.upper()}-{numbers_str}-{random.randint(1000, 9999)}"
                ticket_id = str(uuid.uuid4())
                
                ticket_doc = {
                    'id': ticket_id,
                    '_id': ticket_id,
                    'lottery_id': str(lottery_id),
                    'lottery_title': lottery['title'],
                    'lottery_type': 'bolita',
                    'user_id': user_id,
                    'selected_numbers': selected_numbers,
                    'bet_type': bet_type,
                    'ticket_number': ticket_number,
                    'purchased_at': datetime.now(timezone.utc),
                    'cost': total_cost // quantity if quantity > 0 else total_cost,
                    'is_winner': False,
                    'prize_won': None,
                }
                
                # Insert with ObjectId for database
                db_ticket = ticket_doc.copy()
                db_ticket['lottery_id'] = lottery_id
                await self.lottery_tickets.insert_one(db_ticket)
                tickets.append(ticket_doc)
            
            # Deduct credits
            new_balance = user_balance - total_cost
            await self.users.update_one(
                {'_id': user_id},
                {'$set': {'credit_balance': new_balance}}
            )
            
            # Create transaction
            transaction_id = str(uuid.uuid4())
            transaction = {
                'id': transaction_id,
                '_id': transaction_id,
                'user_id': user_id,
                'type': 'usage',
                'amount': total_cost,
                'description': f'La Bolita {selected_numbers} - {quantity} boleto(s): {lottery["title"]}',
                'service_type': 'lottery_bolita',
                'balance_after': new_balance,
                'created_at': datetime.now(timezone.utc),
            }
            await self.credit_transactions.insert_one(transaction)
            
            # Update lottery status
            if lottery['status'] == 'draft':
                await self.lotteries.update_one(
                    {'_id': lottery_id},
                    {'$set': {'status': 'active', 'updated_at': datetime.now(timezone.utc)}}
                )
            
            logger.info(f"User {user_id} bought {quantity} Bolita ticket(s) with numbers {selected_numbers}")
            
            return {
                'success': True,
                'message': f'Compraste {quantity} boleto(s) con los números {selected_numbers}. ¡Buena suerte!',
                'tickets': tickets,
                'new_balance': new_balance,
                'total_cost': total_cost
            }
            
        except Exception as e:
            logger.error(f"Error buying Bolita ticket: {e}")
            raise
    
    async def _buy_traditional_ticket(
        self, 
        lottery: Dict, 
        user_id: str, 
        selected_numbers: Optional[List[int]],
        quantity: int
    ) -> Dict:
        """Buy traditional lottery ticket - pick 6 numbers from 1-49"""
        try:
            lottery_id = lottery['_id']
            
            # Validate selected numbers
            numbers_to_pick = lottery.get('numbers_to_pick', 6)
            if not selected_numbers or len(selected_numbers) != numbers_to_pick:
                return {
                    'success': False, 
                    'message': f'Debes seleccionar exactamente {numbers_to_pick} números'
                }
            
            # Check number range
            min_num = lottery.get('number_range_min', 1)
            max_num = lottery.get('number_range_max', 49)
            
            for num in selected_numbers:
                if num < min_num or num > max_num:
                    return {
                        'success': False,
                        'message': f'Los números deben estar entre {min_num} y {max_num}'
                    }
            
            # Check for duplicates
            if len(selected_numbers) != len(set(selected_numbers)):
                return {'success': False, 'message': 'No puedes repetir números'}
            
            # Check draw date
            if lottery.get('draw_date'):
                draw_date = lottery['draw_date']
                if isinstance(draw_date, str):
                    draw_date = datetime.fromisoformat(draw_date.replace('Z', '+00:00'))
                elif isinstance(draw_date, datetime) and draw_date.tzinfo is None:
                    draw_date = draw_date.replace(tzinfo=timezone.utc)
                
                if draw_date < datetime.now(timezone.utc):
                    return {'success': False, 'message': 'Esta lotería ya ha cerrado'}
            
            # Check max tickets per user
            user_tickets = await self.lottery_tickets.count_documents({
                'lottery_id': lottery_id,
                'user_id': user_id
            })
            
            if user_tickets + quantity > lottery['max_tickets_per_user']:
                return {
                    'success': False,
                    'message': f'Máximo {lottery["max_tickets_per_user"]} boletos por persona'
                }
            
            # Calculate total cost
            total_cost = lottery['ticket_price'] * quantity
            
            # Check user balance
            user = await self.users.find_one({'_id': user_id})
            if not user:
                return {'success': False, 'message': 'Usuario no encontrado'}
            
            user_balance = user.get('credit_balance', 0)
            if user_balance < total_cost:
                return {
                    'success': False,
                    'message': f'Saldo insuficiente. Necesitas {total_cost} créditos'
                }
            
            # Generate tickets
            tickets = []
            sorted_numbers = sorted(selected_numbers)
            
            for i in range(quantity):
                ticket_number = f"LOT-{lottery_id[:8]}-{random.randint(10000, 99999)}"
                ticket_id = str(uuid.uuid4())
                
                ticket_doc = {
                    'id': ticket_id,
                    '_id': ticket_id,
                    'lottery_id': lottery_id,
                    'lottery_title': lottery['title'],
                    'lottery_type': 'traditional',
                    'user_id': user_id,
                    'selected_numbers': sorted_numbers,
                    'ticket_number': ticket_number,
                    'purchased_at': datetime.now(timezone.utc),
                    'cost': lottery['ticket_price'],
                    'matched_numbers': None,
                    'prize_won': None,
                }
                
                await self.lottery_tickets.insert_one(ticket_doc)
                tickets.append(ticket_doc)
            
            # Deduct credits
            new_balance = user_balance - total_cost
            await self.users.update_one(
                {'_id': user_id},
                {'$set': {'credit_balance': new_balance}}
            )
            
            # Create transaction
            transaction_id = str(uuid.uuid4())
            transaction = {
                'id': transaction_id,
                '_id': transaction_id,
                'user_id': user_id,
                'type': 'usage',
                'amount': total_cost,
                'description': f'Compra de {quantity} boleto(s) de lotería: {lottery["title"]}',
                'service_type': 'lottery_ticket',
                'balance_after': new_balance,
                'created_at': datetime.now(timezone.utc),
            }
            await self.credit_transactions.insert_one(transaction)
            
            # Update lottery status
            if lottery['status'] == 'draft':
                await self.lotteries.update_one(
                    {'_id': lottery_id},
                    {'$set': {'status': 'active', 'updated_at': datetime.now(timezone.utc)}}
                )
            
            logger.info(f"User {user_id} bought {quantity} traditional lottery ticket(s)")
            
            return {
                'success': True,
                'message': f'Compraste {quantity} boleto(s) exitosamente',
                'tickets': tickets,
                'new_balance': new_balance,
                'total_cost': total_cost
            }
            
        except Exception as e:
            logger.error(f"Error buying traditional lottery tickets: {e}")
            raise
    
    async def get_user_tickets(self, user_id: str, lottery_id: Optional[str] = None) -> List[Dict]:
        """Get user's lottery tickets"""
        try:
            query = {'user_id': user_id}
            if lottery_id:
                query['lottery_id'] = lottery_id
            
            cursor = self.lottery_tickets.find(query).sort('purchased_at', -1)
            tickets = await cursor.to_list(length=1000)
            
            for ticket in tickets:
                ticket['id'] = str(ticket['_id']) if '_id' in ticket else ticket.get('id')
            
            return tickets
            
        except Exception as e:
            logger.error(f"Error getting user tickets: {e}")
            raise
    
    # ==================== ADMIN METHODS ====================
    
    async def create_lottery(self, lottery_data: Dict, admin_id: str) -> Dict:
        """Create a new lottery (admin only)"""
        try:
            lottery_id = str(uuid.uuid4())
            lottery_doc = {
                'id': lottery_id,
                '_id': lottery_id,
                **lottery_data,
                'admin_id': admin_id,
                'status': 'draft',
                'tickets_sold': 0,
                'participants_count': 0,
                'winning_numbers': None,
                'winners': [],
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            
            await self.lotteries.insert_one(lottery_doc)
            
            logger.info(f"Lottery created: {lottery_doc['title']} by admin {admin_id}")
            return lottery_doc
            
        except Exception as e:
            logger.error(f"Error creating lottery: {e}")
            raise
    
    async def get_all_lotteries_admin(self) -> List[Dict]:
        """Get all lotteries for admin"""
        try:
            cursor = self.lotteries.find({}).sort('created_at', -1)
            lotteries = await cursor.to_list(length=1000)
            
            for lottery in lotteries:
                lottery['id'] = lottery['_id']
                
                # Calculate tickets sold
                tickets_sold = await self.lottery_tickets.count_documents({'lottery_id': lottery['_id']})
                lottery['tickets_sold'] = tickets_sold
                
                # Calculate participants
                participants = await self.lottery_tickets.distinct('user_id', {'lottery_id': lottery['_id']})
                lottery['participants_count'] = len(participants)
            
            return lotteries
            
        except Exception as e:
            logger.error(f"Error getting admin lotteries: {e}")
            raise
    
    async def update_lottery(self, lottery_id: str, update_data: Dict) -> Dict:
        """Update lottery (admin only)"""
        try:
            update_data['updated_at'] = datetime.now(timezone.utc)
            
            await self.lotteries.update_one(
                {'_id': lottery_id},
                {'$set': update_data}
            )
            
            logger.info(f"Lottery {lottery_id} updated")
            return {'success': True, 'message': 'Lotería actualizada'}
            
        except Exception as e:
            logger.error(f"Error updating lottery: {e}")
            raise
    
    async def delete_lottery(self, lottery_id: str) -> Dict:
        """Delete lottery (admin only - only if no tickets sold)"""
        try:
            # Check if tickets sold
            tickets_count = await self.lottery_tickets.count_documents({'lottery_id': lottery_id})
            if tickets_count > 0:
                return {
                    'success': False,
                    'message': 'No se puede eliminar una lotería con boletos vendidos'
                }
            
            await self.lotteries.delete_one({'_id': lottery_id})
            logger.info(f"Lottery {lottery_id} deleted")
            
            return {'success': True, 'message': 'Lotería eliminada'}
            
        except Exception as e:
            logger.error(f"Error deleting lottery: {e}")
            raise

    
    async def reveal_scratch_card(self, ticket_id: str, user_id: str) -> Dict:
        """Reveal scratch card and award prize if winner"""
        try:
            ticket = await self.lottery_tickets.find_one({'_id': ticket_id, 'user_id': user_id})
            
            if not ticket:
                return {'success': False, 'message': 'Boleto no encontrado'}
            
            if ticket.get('revealed'):
                return {
                    'success': True,
                    'message': 'Ya revelaste este raspadito',
                    'is_winner': ticket.get('is_winner', False),
                    'prize_won': ticket.get('prize_won'),
                    'already_revealed': True
                }
            
            # Mark as revealed
            await self.lottery_tickets.update_one(
                {'_id': ticket_id},
                {'$set': {'revealed': True}}
            )
            
            # Award prize if winner
            if ticket.get('is_winner') and ticket.get('prize_credits', 0) > 0:
                user = await self.users.find_one({'_id': user_id})
                if user:
                    new_balance = user.get('credit_balance', 0) + ticket['prize_credits']
                    await self.users.update_one(
                        {'_id': user_id},
                        {'$set': {'credit_balance': new_balance}}
                    )
                    
                    # Create transaction
                    transaction_id = str(uuid.uuid4())
                    transaction = {
                        'id': transaction_id,
                        '_id': transaction_id,
                        'user_id': user_id,
                        'type': 'bonus',
                        'amount': ticket['prize_credits'],
                        'description': f'Premio raspadito: {ticket["prize_won"]}',
                        'balance_after': new_balance,
                        'created_at': datetime.now(timezone.utc),
                    }
                    await self.credit_transactions.insert_one(transaction)
                    
                    logger.info(f"User {user_id} won {ticket['prize_credits']} credits from scratch card")
            
            return {
                'success': True,
                'message': '¡Premio revelado!' if ticket.get('is_winner') else 'Intenta de nuevo',
                'is_winner': ticket.get('is_winner', False),
                'prize_won': ticket.get('prize_won'),
                'prize_credits': ticket.get('prize_credits', 0),
                'already_revealed': False
            }
            
        except Exception as e:
            logger.error(f"Error revealing scratch card: {e}")
            raise
    
    async def get_user_tickets(self, user_id: str, lottery_id: Optional[str] = None) -> List[Dict]:
        """Get user's lottery tickets"""
        try:
            query = {'user_id': user_id}
            if lottery_id:
                query['lottery_id'] = lottery_id
            
            cursor = self.lottery_tickets.find(query).sort('purchased_at', -1)
            tickets = await cursor.to_list(length=1000)
            
            for ticket in tickets:
                ticket['id'] = str(ticket['_id']) if '_id' in ticket else ticket.get('id')
            
            return tickets
            
        except Exception as e:
            logger.error(f"Error getting user tickets: {e}")
            raise
    
    # ==================== ADMIN METHODS ====================
    
    async def create_lottery(self, lottery_data: Dict, admin_id: str) -> Dict:
        """Create a new lottery (admin only)"""
        try:
            lottery_id = str(uuid.uuid4())
            lottery_type = lottery_data.get('lottery_type', 'traditional')
            
            lottery_doc = {
                'id': lottery_id,
                '_id': lottery_id,
                **lottery_data,
                'lottery_type': lottery_type,
                'admin_id': admin_id,
                'status': 'draft',
                'tickets_sold': 0,
                'participants_count': 0,
                'winning_numbers': None,
                'winners': [],
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            
            await self.lotteries.insert_one(lottery_doc)
            
            logger.info(f"Lottery created: {lottery_doc['title']} ({lottery_type}) by admin {admin_id}")
            return lottery_doc
            
        except Exception as e:
            logger.error(f"Error creating lottery: {e}")
            raise
    
    async def get_all_lotteries_admin(self) -> List[Dict]:
        """Get all lotteries for admin"""
        try:
            cursor = self.lotteries.find({}).sort('created_at', -1)
            lotteries = await cursor.to_list(length=1000)
            
            for lottery in lotteries:
                lottery['id'] = lottery['_id']
                
                # Calculate tickets sold
                tickets_sold = await self.lottery_tickets.count_documents({'lottery_id': lottery['_id']})
                lottery['tickets_sold'] = tickets_sold
                
                # Calculate participants
                participants = await self.lottery_tickets.distinct('user_id', {'lottery_id': lottery['_id']})
                lottery['participants_count'] = len(participants)
            
            return lotteries
            
        except Exception as e:
            logger.error(f"Error getting admin lotteries: {e}")
            raise
    
    async def update_lottery(self, lottery_id: str, update_data: Dict) -> Dict:
        """Update lottery (admin only)"""
        try:
            update_data['updated_at'] = datetime.now(timezone.utc)
            
            await self.lotteries.update_one(
                {'_id': lottery_id},
                {'$set': update_data}
            )
            
            logger.info(f"Lottery {lottery_id} updated")
            return {'success': True, 'message': 'Lotería actualizada'}
            
        except Exception as e:
            logger.error(f"Error updating lottery: {e}")
            raise
    
    async def delete_lottery(self, lottery_id: str) -> Dict:
        """Delete lottery (admin only - only if no tickets sold)"""
        try:
            # Check if tickets sold
            tickets_count = await self.lottery_tickets.count_documents({'lottery_id': lottery_id})
            if tickets_count > 0:
                return {
                    'success': False,
                    'message': 'No se puede eliminar una lotería con boletos vendidos'
                }
            
            await self.lotteries.delete_one({'_id': lottery_id})
            logger.info(f"Lottery {lottery_id} deleted")
            
            return {'success': True, 'message': 'Lotería eliminada'}
            
        except Exception as e:
            logger.error(f"Error deleting lottery: {e}")
            raise
    
    async def execute_lottery_draw(self, lottery_id: str, admin_id: str, winning_number: Optional[int] = None) -> Dict:
        """Execute lottery draw - handles all 3 game types"""
        try:
            # Get lottery
            lottery = await self.lotteries.find_one({'_id': lottery_id})
            if not lottery:
                return {'success': False, 'message': 'Lotería no encontrada'}
            
            if lottery['status'] not in ['active', 'full']:
                return {'success': False, 'message': 'Solo se pueden ejecutar loterías activas'}
            
            # Check if tickets sold
            tickets_count = await self.lottery_tickets.count_documents({'lottery_id': lottery_id})
            if tickets_count == 0:
                return {'success': False, 'message': 'No hay boletos vendidos'}
            
            lottery_type = lottery.get('lottery_type', 'traditional')
            
            # Handle different lottery types
            if lottery_type == 'scratch_card':
                return {'success': False, 'message': 'Los raspaditos no requieren sorteo (son instantáneos)'}
            elif lottery_type == 'bolita':
                return await self._execute_bolita_draw(lottery, admin_id, winning_number)
            else:  # traditional
                return await self._execute_traditional_draw(lottery, admin_id)
            
        except Exception as e:
            logger.error(f"Error executing lottery: {e}")
            raise
    
    async def _execute_bolita_draw(self, lottery: Dict, admin_id: str, winning_number: Optional[int]) -> Dict:
        """Execute La Bolita draw"""
        try:
            lottery_id = lottery['_id']
            
            # Determine winning number
            if winning_number is not None:
                # Admin provided winning number
                bolita_range = lottery.get('bolita_number_range', 100)
                if winning_number < 0 or winning_number >= bolita_range:
                    return {
                        'success': False,
                        'message': f'Número ganador debe estar entre 0 y {bolita_range - 1}'
                    }
            else:
                # Generate random winning number
                bolita_range = lottery.get('bolita_number_range', 100)
                winning_number = random.randint(0, bolita_range - 1)
            
            logger.info(f"Bolita winning number: {winning_number}")
            
            # Find all winning tickets
            cursor = self.lottery_tickets.find({
                'lottery_id': lottery_id,
                'selected_numbers': [winning_number]
            })
            winning_tickets = await cursor.to_list(length=10000)
            
            winners = []
            total_credits_awarded = 0
            prize_credits = lottery.get('prize_credits', 100)
            
            for ticket in winning_tickets:
                # Award credits to user
                if lottery['prize_type'] == 'credits' and prize_credits > 0:
                    user = await self.users.find_one({'_id': ticket['user_id']})
                    if user:
                        new_balance = user.get('credit_balance', 0) + prize_credits
                        await self.users.update_one(
                            {'_id': ticket['user_id']},
                            {'$set': {'credit_balance': new_balance}}
                        )
                        
                        # Create transaction
                        transaction_id = str(uuid.uuid4())
                        transaction = {
                            'id': transaction_id,
                            '_id': transaction_id,
                            'user_id': ticket['user_id'],
                            'type': 'bonus',
                            'amount': prize_credits,
                            'description': f'¡Ganaste La Bolita! Número {winning_number}: {lottery["title"]}',
                            'balance_after': new_balance,
                            'created_at': datetime.now(timezone.utc),
                        }
                        await self.credit_transactions.insert_one(transaction)
                        
                        total_credits_awarded += prize_credits
                
                prize_text = f"{prize_credits} créditos" if lottery['prize_type'] == 'credits' else lottery['prize_value']
                
                # Update ticket
                await self.lottery_tickets.update_one(
                    {'_id': ticket['_id']},
                    {
                        '$set': {
                            'is_winner': True,
                            'prize_won': prize_text
                        }
                    }
                )
                
                # Get user info
                user = await self.users.find_one({'_id': ticket['user_id']})
                
                winners.append({
                    'user_id': ticket['user_id'],
                    'user_name': user.get('name', 'Usuario') if user else 'Usuario',
                    'ticket_number': ticket['ticket_number'],
                    'selected_number': winning_number,
                    'prize': prize_text,
                })
            
            # Update lottery
            await self.lotteries.update_one(
                {'_id': lottery_id},
                {
                    '$set': {
                        'status': 'completed',
                        'winning_numbers': [winning_number],
                        'winners': winners,
                        'total_credits_awarded': total_credits_awarded,
                        'drawn_at': datetime.now(timezone.utc),
                        'drawn_by': admin_id,
                        'updated_at': datetime.now(timezone.utc),
                    }
                }
            )
            
            logger.info(f"Bolita {lottery_id} executed. Winning number: {winning_number}. Winners: {len(winners)}")
            
            return {
                'success': True,
                'message': f'Sorteo ejecutado. Número ganador: {winning_number}. {len(winners)} ganador(es)',
                'winning_number': winning_number,
                'winning_numbers': [winning_number],
                'winners': winners,
                'total_credits_awarded': total_credits_awarded
            }
            
        except Exception as e:
            logger.error(f"Error executing Bolita: {e}")
            raise
    
    async def _execute_traditional_draw(self, lottery: Dict, admin_id: str) -> Dict:
        """Execute traditional lottery draw"""
        try:
            lottery_id = lottery['_id']
            numbers_to_pick = lottery.get('numbers_to_pick', 6)
            min_num = lottery.get('number_range_min', 1)
            max_num = lottery.get('number_range_max', 49)
            
            # Generate winning numbers
            number_pool = list(range(min_num, max_num + 1))
            winning_numbers = sorted(random.sample(number_pool, numbers_to_pick))
            
            logger.info(f"Traditional lottery winning numbers: {winning_numbers}")
            
            # Get all tickets
            cursor = self.lottery_tickets.find({'lottery_id': lottery_id})
            all_tickets = await cursor.to_list(length=10000)
            
            # Calculate matches for each ticket
            winners_by_matches = {}
            
            for ticket in all_tickets:
                matched = len(set(ticket['selected_numbers']) & set(winning_numbers))
                ticket['matched_numbers'] = matched
                
                if matched >= 3:  # Only count 3+ matches as winners
                    if matched not in winners_by_matches:
                        winners_by_matches[matched] = []
                    winners_by_matches[matched].append(ticket)
                
                # Update ticket
                await self.lottery_tickets.update_one(
                    {'_id': ticket['_id']},
                    {'$set': {'matched_numbers': matched}}
                )
            
            # Award prizes based on matches
            winners = []
            total_credits_awarded = 0
            
            # Prize structure
            prize_structure = {
                numbers_to_pick: lottery.get('prize_credits', 100),  # All numbers
                numbers_to_pick - 1: int(lottery.get('prize_credits', 100) * 0.3),  # 5 of 6
                numbers_to_pick - 2: int(lottery.get('prize_credits', 100) * 0.1),  # 4 of 6
                numbers_to_pick - 3: 10,  # 3 of 6 (minimum)
            }
            
            for matches, prize_credits in prize_structure.items():
                if matches in winners_by_matches:
                    for ticket in winners_by_matches[matches]:
                        # Award credits to user
                        if lottery['prize_type'] == 'credits' and prize_credits > 0:
                            user = await self.users.find_one({'_id': ticket['user_id']})
                            if user:
                                new_balance = user.get('credit_balance', 0) + prize_credits
                                await self.users.update_one(
                                    {'_id': ticket['user_id']},
                                    {'$set': {'credit_balance': new_balance}}
                                )
                                
                                # Create transaction
                                transaction_id = str(uuid.uuid4())
                                transaction = {
                                    'id': transaction_id,
                                    '_id': transaction_id,
                                    'user_id': ticket['user_id'],
                                    'type': 'bonus',
                                    'amount': prize_credits,
                                    'description': f'Premio de lotería - {matches} aciertos: {lottery["title"]}',
                                    'balance_after': new_balance,
                                    'created_at': datetime.now(timezone.utc),
                                }
                                await self.credit_transactions.insert_one(transaction)
                                
                                total_credits_awarded += prize_credits
                        
                        prize_text = f"{prize_credits} créditos" if lottery['prize_type'] == 'credits' else lottery['prize_value']
                        
                        # Update ticket with prize
                        await self.lottery_tickets.update_one(
                            {'_id': ticket['_id']},
                            {'$set': {'prize_won': prize_text, 'is_winner': True}}
                        )
                        
                        # Get user info
                        user = await self.users.find_one({'_id': ticket['user_id']})
                        
                        winners.append({
                            'user_id': ticket['user_id'],
                            'user_name': user.get('name', 'Usuario') if user else 'Usuario',
                            'ticket_number': ticket['ticket_number'],
                            'selected_numbers': ticket['selected_numbers'],
                            'matched_numbers': matches,
                            'prize': prize_text,
                        })
            
            # Update lottery
            await self.lotteries.update_one(
                {'_id': lottery_id},
                {
                    '$set': {
                        'status': 'completed',
                        'winning_numbers': winning_numbers,
                        'winners': winners,
                        'total_credits_awarded': total_credits_awarded,
                        'drawn_at': datetime.now(timezone.utc),
                        'drawn_by': admin_id,
                        'updated_at': datetime.now(timezone.utc),
                    }
                }
            )
            
            logger.info(f"Traditional lottery {lottery_id} executed. Winners: {len(winners)}")
            
            return {
                'success': True,
                'message': f'Lotería ejecutada. {len(winners)} ganador(es)',
                'winning_numbers': winning_numbers,
                'winners': winners,
                'total_credits_awarded': total_credits_awarded
            }
            
        except Exception as e:
            logger.error(f"Error executing traditional lottery: {e}")
            raise

            
        except Exception as e:
            logger.error(f"Error deleting lottery: {e}")
            raise
    
    async def execute_lottery_draw(self, lottery_id: str, admin_id: str) -> Dict:
        """Execute lottery draw and determine winners"""
        try:
            # Get lottery
            lottery = await self.lotteries.find_one({'_id': lottery_id})
            if not lottery:
                return {'success': False, 'message': 'Lotería no encontrada'}
            
            if lottery['status'] != 'active':
                return {'success': False, 'message': 'Solo se pueden ejecutar loterías activas'}
            
            # Check if tickets sold
            tickets_count = await self.lottery_tickets.count_documents({'lottery_id': lottery_id})
            if tickets_count == 0:
                return {'success': False, 'message': 'No hay boletos vendidos'}
            
            # Generate winning numbers
            number_pool = list(range(lottery['number_range_min'], lottery['number_range_max'] + 1))
            winning_numbers = sorted(random.sample(number_pool, lottery['numbers_to_pick']))
            
            logger.info(f"Winning numbers for lottery {lottery_id}: {winning_numbers}")
            
            # Get all tickets
            cursor = self.lottery_tickets.find({'lottery_id': lottery_id})
            all_tickets = await cursor.to_list(length=10000)
            
            # Calculate matches for each ticket
            winners_by_matches = {}  # {matches_count: [tickets]}
            
            for ticket in all_tickets:
                matched = len(set(ticket['selected_numbers']) & set(winning_numbers))
                ticket['matched_numbers'] = matched
                
                if matched >= 3:  # Only count 3+ matches as winners
                    if matched not in winners_by_matches:
                        winners_by_matches[matched] = []
                    winners_by_matches[matched].append(ticket)
                
                # Update ticket
                await self.lottery_tickets.update_one(
                    {'_id': ticket['_id']},
                    {'$set': {'matched_numbers': matched}}
                )
            
            # Award prizes based on matches
            winners = []
            total_credits_awarded = 0
            
            # Prize structure (can be customized)
            prize_structure = {
                lottery['numbers_to_pick']: lottery.get('prize_credits', 100),  # All numbers
                lottery['numbers_to_pick'] - 1: int(lottery.get('prize_credits', 100) * 0.3),  # 5 of 6
                lottery['numbers_to_pick'] - 2: int(lottery.get('prize_credits', 100) * 0.1),  # 4 of 6
                lottery['numbers_to_pick'] - 3: 10,  # 3 of 6 (minimum)
            }
            
            for matches, prize_credits in prize_structure.items():
                if matches in winners_by_matches:
                    for ticket in winners_by_matches[matches]:
                        # Award credits to user
                        if lottery['prize_type'] == 'credits' and prize_credits > 0:
                            user = await self.users.find_one({'_id': ticket['user_id']})
                            if user:
                                new_balance = user.get('credit_balance', 0) + prize_credits
                                await self.users.update_one(
                                    {'_id': ticket['user_id']},
                                    {'$set': {'credit_balance': new_balance}}
                                )
                                
                                # Create transaction
                                transaction_id = str(uuid.uuid4())
                                transaction = {
                                    'id': transaction_id,
                                    '_id': transaction_id,
                                    'user_id': ticket['user_id'],
                                    'type': 'bonus',
                                    'amount': prize_credits,
                                    'description': f'Premio de lotería - {matches} aciertos: {lottery["title"]}',
                                    'balance_after': new_balance,
                                    'created_at': datetime.now(timezone.utc),
                                }
                                await self.credit_transactions.insert_one(transaction)
                                
                                total_credits_awarded += prize_credits
                        
                        prize_text = f"{prize_credits} créditos" if lottery['prize_type'] == 'credits' else lottery['prize_value']
                        
                        # Update ticket with prize
                        await self.lottery_tickets.update_one(
                            {'_id': ticket['_id']},
                            {'$set': {'prize_won': prize_text}}
                        )
                        
                        # Get user info
                        user = await self.users.find_one({'_id': ticket['user_id']})
                        
                        winners.append({
                            'user_id': ticket['user_id'],
                            'user_name': user.get('name', 'Usuario') if user else 'Usuario',
                            'ticket_number': ticket['ticket_number'],
                            'selected_numbers': ticket['selected_numbers'],
                            'matched_numbers': matches,
                            'prize': prize_text,
                        })
            
            # Update lottery
            await self.lotteries.update_one(
                {'_id': lottery_id},
                {
                    '$set': {
                        'status': 'completed',
                        'winning_numbers': winning_numbers,
                        'winners': winners,
                        'total_credits_awarded': total_credits_awarded,
                        'drawn_at': datetime.now(timezone.utc),
                        'drawn_by': admin_id,
                        'updated_at': datetime.now(timezone.utc),
                    }
                }
            )
            
            logger.info(f"Lottery {lottery_id} executed. Winners: {len(winners)}")
            
            return {
                'success': True,
                'message': f'Lotería ejecutada. {len(winners)} ganador(es)',
                'winning_numbers': winning_numbers,
                'winners': winners,
                'total_credits_awarded': total_credits_awarded
            }
            
        except Exception as e:
            logger.error(f"Error executing lottery: {e}")
            raise
