"""
Bolita Cubana Endpoints
Traditional Cuban lottery game
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
notification_service = None
get_current_user_func = None

def set_database(database):
    """Set the database instance"""
    global db
    db = database
    logger.info("✅ Bolita database connection set")

def set_notification_service(service):
    """Set the notification service instance"""
    global notification_service
    notification_service = service
    logger.info("✅ Bolita notification service set")

def set_auth_dependency(auth_func):
    """Set the authentication function from server.py"""
    global get_current_user_func
    get_current_user_func = auth_func
    logger.info("✅ Bolita auth dependency set")


async def get_optional_user(authorization: Optional[str] = Header(None)):
    """Get current user if authenticated, otherwise return None"""
    if not authorization or not get_current_user_func:
        return None
    try:
        # Extract token from "Bearer <token>"
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
        
        # Query the session
        if db:
            session = await db.sessions.find_one({"session_token": token})
            if session:
                user_id = session.get("user_id")
                user = await db.users.find_one({"_id": user_id})
                if not user:
                    # Try with ObjectId
                    try:
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
                    except:
                        pass
                return user
    except Exception as e:
        logger.warning(f"Auth error in bolita: {e}")
    return None


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class BolitaBetRequest(BaseModel):
    """Request to place a bet"""
    type: str = Field(..., description="Tipo de apuesta: fijo, corrido, candado, parley")
    numbers: List[int] = Field(..., description="Números seleccionados (1-100)")
    amount: float = Field(..., description="Monto apostado en créditos")


class BolitaBetResponse(BaseModel):
    """Response for bet placement"""
    success: bool
    message: str
    bet_id: str
    balance: float


class MultipleBetsRequest(BaseModel):
    """Request to place multiple bets at once"""
    bets: List[BolitaBetRequest] = Field(..., description="Lista de apuestas a realizar")


class MultipleBetsResponse(BaseModel):
    """Response for multiple bets placement"""
    success: bool
    message: str
    bet_ids: List[str]
    total_amount: float
    balance: float
    bets_placed: int


class BolitaHistoryResponse(BaseModel):
    """Response for draw history"""
    history: List[dict]


# ============================================
# HELPER FUNCTIONS
# ============================================

def calculate_payout(bet_type: str, amount: float) -> float:
    """Calculate potential payout based on bet type"""
    multipliers = {
        'fijo': 85,
        'corrido': 25,
        'candado': 1000,
        'parley': 400
    }
    return amount * multipliers.get(bet_type, 0)


def validate_bet(bet_type: str, numbers: List[int]) -> tuple[bool, str]:
    """Validate bet numbers"""
    # Validar que números estén en rango 1-100
    if not all(1 <= num <= 100 for num in numbers):
        return False, "Los números deben estar entre 1 y 100"
    
    # Validar cantidad de números según tipo
    if bet_type not in ['fijo', 'corrido', 'candado', 'parley']:
        return False, "Tipo de apuesta inválido"
    
    # Fijo y Corrido: pueden seleccionar cuantos quieran (mínimo 1)
    if bet_type in ['fijo', 'corrido']:
        if len(numbers) < 1:
            return False, f"Para {bet_type} debes seleccionar al menos 1 número"
    
    # Candado: exactamente 3 números
    elif bet_type == 'candado':
        if len(numbers) != 3:
            return False, "Para candado debes seleccionar exactamente 3 números"
    
    # Parley: exactamente 2 números
    elif bet_type == 'parley':
        if len(numbers) != 2:
            return False, "Para parley debes seleccionar exactamente 2 números"
    
    # No puede haber números repetidos
    if len(numbers) != len(set(numbers)):
        return False, "No puedes seleccionar el mismo número dos veces"
    
    return True, "OK"


# ============================================
# ENDPOINTS
# ============================================

@router.post('/bet', response_model=BolitaBetResponse)
async def place_bolita_bet(request: BolitaBetRequest, user_id: str = None):
    """
    Place a bet on La Bolita Cubana
    
    Types:
    - fijo: 1 number, pays 85x
    - corrido: 1-2 numbers, pays 25x
    - candado: 3 numbers (all must match), pays 1000x
    - parley: 2 numbers (both must match), pays 400x
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Para testing, crear un usuario de prueba si no se proporciona user_id
        if not user_id:
            # Crear o buscar usuario de prueba
            test_user = await db.users.find_one({'email': 'test_bolita@test.com'})
            if not test_user:
                # Crear usuario de prueba
                test_user_data = {
                    'email': 'test_bolita@test.com',
                    'name': 'Test User',
                    'credits': 1000,
                    'created_at': datetime.utcnow()
                }
                result = await db.users.insert_one(test_user_data)
                user_id = str(result.inserted_id)
            else:
                user_id = str(test_user['_id'])
        
        # Validate bet
        is_valid, message = validate_bet(request.type, request.numbers)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)
        
        # Check amount
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
        
        # Get user balance
        user = await db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        balance = user.get('credits', 0)
        if balance < request.amount:
            raise HTTPException(status_code=400, detail="Saldo insuficiente")
        
        # Calculate potential win
        potential_win = calculate_payout(request.type, request.amount)
        
        # Create bet record
        bet = {
            'user_id': user_id,
            'type': request.type,
            'numbers': request.numbers,
            'amount': request.amount,
            'potential_win': potential_win,
            'status': 'pending',  # pending, won, lost
            'created_at': datetime.utcnow(),
            'draw_date': None,  # Se asigna cuando hay sorteo
        }
        
        result = await db.bolita_bets.insert_one(bet)
        
        # Deduct amount from user balance
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'credits': -request.amount}}
        )
        
        new_balance = balance - request.amount
        
        logger.info(f"✅ Bolita bet placed: {user_id} - {request.type} - {request.numbers} - ${request.amount}")
        
        # Send notifications to user
        if notification_service and user:
            bet_type_names = {
                'fijo': 'Número Fijo',
                'corrido': 'Números Corridos',
                'candado': 'Candado',
                'parley': 'Parley'
            }
            
            bet_type_name = bet_type_names.get(request.type, request.type)
            numbers_str = ', '.join(map(str, request.numbers))
            
            try:
                # Push Notification
                if user.get('push_token'):
                    await notification_service.send_push_notification(
                        user['push_token'],
                        '🇨🇺 Apuesta Realizada',
                        f'{bet_type_name}: {numbers_str} - ${request.amount}. ¡Buena suerte!'
                    )
                
                # Email Notification
                if user.get('email'):
                    await notification_service.send_email_notification(
                        user['email'],
                        '🇨🇺 Confirmación de Apuesta - La Bolita Cubana',
                        f"""
                        <h2>¡Tu apuesta ha sido registrada!</h2>
                        <p><strong>Tipo:</strong> {bet_type_name}</p>
                        <p><strong>Números:</strong> {numbers_str}</p>
                        <p><strong>Monto:</strong> ${request.amount}</p>
                        <p><strong>Ganancia potencial:</strong> ${potential_win}</p>
                        <p><strong>Nuevo saldo:</strong> {new_balance} créditos</p>
                        <hr>
                        <p>El sorteo se realizará pronto. ¡Mucha suerte!</p>
                        <p><small>ID de apuesta: {str(result.inserted_id)}</small></p>
                        """
                    )
                
                # SMS Notification (opcional, solo si el usuario tiene teléfono)
                if user.get('phone'):
                    await notification_service.send_sms_notification(
                        user['phone'],
                        f"🇨🇺 La Bolita: Apuesta registrada - {bet_type_name}: {numbers_str} - ${request.amount}. Ganancia potencial: ${potential_win}. ¡Buena suerte!"
                    )
                
                logger.info(f"📧 Notificaciones enviadas al usuario {user_id}")
            except Exception as notif_error:
                # No fallar la apuesta si las notificaciones fallan
                logger.error(f"⚠️ Error enviando notificaciones: {str(notif_error)}")
        
        return BolitaBetResponse(
            success=True,
            message=f"Apuesta realizada exitosamente. Ganancia potencial: {potential_win} créditos",
            bet_id=str(result.inserted_id),
            balance=new_balance
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error placing bolita bet: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al realizar la apuesta")


@router.get('/history', response_model=BolitaHistoryResponse)
async def get_bolita_history(limit: int = 10):
    """
    Get recent draw results
    
    Returns the last X draws with their winning numbers
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Get recent draws
        cursor = db.bolita_draws.find().sort('date', -1).limit(limit)
        draws = await cursor.to_list(length=limit)
        
        history = []
        for draw in draws:
            history.append({
                'date': draw['date'].strftime('%Y-%m-%d %H:%M'),
                'fijo': draw['fijo'],
                'corridos': draw['corridos']
            })
        
        return BolitaHistoryResponse(history=history)
        
    except Exception as e:
        logger.error(f"Error getting bolita history: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener historial")


@router.post('/bet/multiple', response_model=MultipleBetsResponse)
async def place_multiple_bolita_bets(
    request: MultipleBetsRequest, 
    current_user: dict = Depends(get_optional_user)
):
    """
    Place multiple bets at once (shopping cart style)
    
    All bets are processed in a single transaction.
    If any bet fails validation, the entire transaction is rejected.
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Get user from authentication or create test user
        user = current_user
        user_id = None
        
        if user:
            user_id = str(user.get('_id'))
        else:
            # Create or get test user for unauthenticated requests
            test_user = await db.users.find_one({'email': 'test_bolita@test.com'})
            if not test_user:
                test_user_data = {
                    'email': 'test_bolita@test.com',
                    'name': 'Test Bolita User',
                    'credits': 10000,
                    'created_at': datetime.utcnow()
                }
                result = await db.users.insert_one(test_user_data)
                user_id = str(result.inserted_id)
                user = await db.users.find_one({'_id': result.inserted_id})
            else:
                user_id = str(test_user['_id'])
                user = test_user
        
        balance = user.get('credits', 0)
        
        # Validate all bets first
        total_amount = 0
        validated_bets = []
        
        for i, bet in enumerate(request.bets):
            # Validate bet
            is_valid, message = validate_bet(bet.type, bet.numbers)
            if not is_valid:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Apuesta #{i+1}: {message}"
                )
            
            # Check amount
            if bet.amount <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Apuesta #{i+1}: El monto debe ser mayor a 0"
                )
            
            total_amount += bet.amount
            
            # Calculate potential win
            potential_win = calculate_payout(bet.type, bet.amount)
            
            validated_bets.append({
                'type': bet.type,
                'numbers': bet.numbers,
                'amount': bet.amount,
                'potential_win': potential_win
            })
        
        # Check total balance
        if balance < total_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Total requerido: {total_amount} créditos, disponible: {balance}"
            )
        
        # Create all bet records
        bet_ids = []
        for bet_data in validated_bets:
            bet = {
                'user_id': user_id,
                'type': bet_data['type'],
                'numbers': bet_data['numbers'],
                'amount': bet_data['amount'],
                'potential_win': bet_data['potential_win'],
                'status': 'pending',
                'created_at': datetime.utcnow(),
                'draw_date': None,
            }
            
            result = await db.bolita_bets.insert_one(bet)
            bet_ids.append(str(result.inserted_id))
        
        # Deduct total amount from user balance (single transaction)
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'credits': -total_amount}}
        )
        
        new_balance = balance - total_amount
        
        logger.info(f"✅ {len(bet_ids)} Bolita bets placed by {user_id} - Total: ${total_amount}")
        
        return MultipleBetsResponse(
            success=True,
            message=f"¡{len(bet_ids)} apuestas realizadas exitosamente!",
            bet_ids=bet_ids,
            total_amount=total_amount,
            balance=new_balance,
            bets_placed=len(bet_ids)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error placing multiple bolita bets: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al realizar las apuestas")


@router.get('/my-bets')
async def get_my_bolita_bets(
    limit: int = 20,
    current_user: dict = Depends(get_optional_user)
):
    """Get user's recent bets"""
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Get user_id from authentication or test user
        user_id = None
        if current_user:
            user_id = str(current_user.get('_id'))
        else:
            # Try to find test user
            test_user = await db.users.find_one({'email': 'test_bolita@test.com'})
            if test_user:
                user_id = str(test_user['_id'])
            else:
                return {'bets': []}
        
        cursor = db.bolita_bets.find({'user_id': user_id}).sort('created_at', -1).limit(limit)
        bets = await cursor.to_list(length=limit)
        
        result = []
        for bet in bets:
            result.append({
                'id': str(bet['_id']),
                'type': bet['type'],
                'numbers': bet['numbers'],
                'amount': bet['amount'],
                'potential_win': bet['potential_win'],
                'status': bet['status'],
                'created_at': bet['created_at'].strftime('%Y-%m-%d %H:%M'),
                'draw_date': bet.get('draw_date').strftime('%Y-%m-%d %H:%M') if bet.get('draw_date') else None
            })
        
        return {'bets': result}
        
    except Exception as e:
        logger.error(f"Error getting user bets: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener apuestas")


@router.get('/admin/stats')
async def get_bolita_admin_stats():
    """Get bolita statistics for admin dashboard"""
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Get total bets
        total_bets = await db.bolita_bets.count_documents({})
        pending_bets = await db.bolita_bets.count_documents({'status': 'pending'})
        won_bets = await db.bolita_bets.count_documents({'status': 'won'})
        lost_bets = await db.bolita_bets.count_documents({'status': 'lost'})
        
        # Get total amounts
        pipeline = [
            {'$group': {
                '_id': '$status',
                'total_amount': {'$sum': '$amount'},
                'total_potential_win': {'$sum': '$potential_win'},
                'count': {'$sum': 1}
            }}
        ]
        stats_by_status = await db.bolita_bets.aggregate(pipeline).to_list(10)
        
        # Calculate totals
        total_wagered = sum(s.get('total_amount', 0) for s in stats_by_status)
        total_paid_out = sum(s.get('total_potential_win', 0) for s in stats_by_status if s['_id'] == 'won')
        
        # Get draws count
        total_draws = await db.bolita_draws.count_documents({})
        
        # Get today's stats
        from datetime import datetime, timedelta
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_bets = await db.bolita_bets.count_documents({'created_at': {'$gte': today_start}})
        
        return {
            'success': True,
            'stats': {
                'total_bets': total_bets,
                'pending_bets': pending_bets,
                'won_bets': won_bets,
                'lost_bets': lost_bets,
                'total_wagered': total_wagered,
                'total_paid_out': total_paid_out,
                'total_draws': total_draws,
                'today_bets': today_bets,
                'profit': total_wagered - total_paid_out
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting bolita stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas")


@router.get('/admin/pending-bets')
async def get_pending_bolita_bets(limit: int = 50):
    """Get all pending bets for admin review"""
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        cursor = db.bolita_bets.find({'status': 'pending'}).sort('created_at', -1).limit(limit)
        bets = await cursor.to_list(length=limit)
        
        result = []
        for bet in bets:
            # Get user info
            user = None
            try:
                user_id = bet.get('user_id')
                if user_id:
                    user = await db.users.find_one({'_id': ObjectId(user_id)})
                    if not user:
                        user = await db.users.find_one({'_id': user_id})
            except:
                pass
            
            result.append({
                'id': str(bet['_id']),
                'user_id': bet.get('user_id'),
                'user_name': user.get('name', 'Usuario') if user else 'Usuario',
                'user_email': user.get('email', '') if user else '',
                'type': bet['type'],
                'numbers': bet['numbers'],
                'amount': bet['amount'],
                'potential_win': bet['potential_win'],
                'status': bet['status'],
                'created_at': bet['created_at'].strftime('%Y-%m-%d %H:%M') if bet.get('created_at') else None
            })
        
        return {
            'success': True,
            'pending_bets': result,
            'total': len(result)
        }
        
    except Exception as e:
        logger.error(f"Error getting pending bets: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener apuestas pendientes")


class CreateDrawRequest(BaseModel):
    """Request to create a new draw"""
    fijo: int = Field(..., description="Número fijo ganador (1-100)")
    corrido1: int = Field(..., description="Primer número corrido (1-100)")
    corrido2: int = Field(..., description="Segundo número corrido (1-100)")


@router.post('/admin/draw')
async def create_bolita_draw(request: CreateDrawRequest):
    """
    Admin endpoint to create a new draw and process winnings
    
    This would typically be called automatically by a scheduled job
    """
    fijo = request.fijo
    corrido1 = request.corrido1
    corrido2 = request.corrido2
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Validate numbers
        if not all(1 <= num <= 100 for num in [fijo, corrido1, corrido2]):
            raise HTTPException(status_code=400, detail="Números deben estar entre 1 y 100")
        
        if len(set([fijo, corrido1, corrido2])) != 3:
            raise HTTPException(status_code=400, detail="Los números deben ser diferentes")
        
        # Create draw record
        draw = {
            'date': datetime.utcnow(),
            'fijo': fijo,
            'corridos': [corrido1, corrido2],
            'processed': False
        }
        
        draw_result = await db.bolita_draws.insert_one(draw)
        draw_id = draw_result.inserted_id
        
        # Process pending bets
        pending_bets = await db.bolita_bets.find({'status': 'pending'}).to_list(length=None)
        
        winners_count = 0
        total_winnings = 0
        
        for bet in pending_bets:
            is_winner = False
            
            if bet['type'] == 'fijo':
                # Debe salir el número exacto como fijo
                is_winner = bet['numbers'][0] == fijo
                
            elif bet['type'] == 'corrido':
                # Si alguno de los números apostados sale como corrido o fijo
                is_winner = any(num in [fijo, corrido1, corrido2] for num in bet['numbers'])
                
            elif bet['type'] == 'candado':
                # Los 3 números deben salir (en cualquier orden)
                is_winner = set(bet['numbers']) == set([fijo, corrido1, corrido2])
                
            elif bet['type'] == 'parley':
                # Los 2 números deben salir (en cualquier orden)
                bet_set = set(bet['numbers'])
                draw_set = set([fijo, corrido1, corrido2])
                is_winner = bet_set.issubset(draw_set)
            
            # Update bet status
            new_status = 'won' if is_winner else 'lost'
            await db.bolita_bets.update_one(
                {'_id': bet['_id']},
                {
                    '$set': {
                        'status': new_status,
                        'draw_date': datetime.utcnow(),
                        'draw_id': draw_id
                    }
                }
            )
            
            # If winner, credit the amount
            if is_winner:
                winners_count += 1
                winnings = bet['potential_win']
                total_winnings += winnings
                
                await db.users.update_one(
                    {'_id': ObjectId(bet['user_id'])},
                    {'$inc': {'credits': winnings}}
                )
                
                logger.info(f"🎉 Bolita winner: {bet['user_id']} won {winnings} credits")
        
        # Mark draw as processed
        await db.bolita_draws.update_one(
            {'_id': draw_id},
            {'$set': {'processed': True}}
        )
        
        logger.info(f"✅ Bolita draw processed: {fijo}, {corrido1}, {corrido2} - {winners_count} winners")
        
        return {
            'success': True,
            'draw_id': str(draw_id),
            'fijo': fijo,
            'corridos': [corrido1, corrido2],
            'winners_count': winners_count,
            'total_winnings': total_winnings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating bolita draw: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al procesar sorteo")


@router.delete('/admin/draw/{draw_id}')
async def delete_bolita_draw(draw_id: str):
    """
    Admin endpoint to delete a bolita draw
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Try to find and delete the draw
        from bson import ObjectId
        
        # Try with ObjectId first
        result = None
        try:
            if ObjectId.is_valid(draw_id):
                result = await db.bolita_draws.delete_one({'_id': ObjectId(draw_id)})
        except:
            pass
        
        # If not found, try with string id
        if not result or result.deleted_count == 0:
            result = await db.bolita_draws.delete_one({'_id': draw_id})
        
        # Also try with 'id' field
        if not result or result.deleted_count == 0:
            result = await db.bolita_draws.delete_one({'id': draw_id})
        
        if result and result.deleted_count > 0:
            logger.info(f"🗑️ Bolita draw deleted: {draw_id}")
            return {
                'success': True,
                'message': 'Sorteo eliminado correctamente'
            }
        else:
            raise HTTPException(status_code=404, detail="Sorteo no encontrado")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting bolita draw: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al eliminar sorteo")


@router.get('/admin/draws')
async def get_all_bolita_draws(limit: int = 50):
    """
    Admin endpoint to get all bolita draws with full details
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        cursor = db.bolita_draws.find().sort('date', -1).limit(limit)
        draws = await cursor.to_list(length=limit)
        
        result = []
        for draw in draws:
            result.append({
                'id': str(draw['_id']),
                'date': draw.get('date').isoformat() if draw.get('date') else None,
                'fijo': draw.get('fijo'),
                'corridos': draw.get('corridos', []),
                'processed': draw.get('processed', False),
                'winners_count': draw.get('winners_count', 0),
                'total_winnings': draw.get('total_winnings', 0)
            })
        
        return {
            'success': True,
            'draws': result,
            'total': len(result)
        }
        
    except Exception as e:
        logger.error(f"Error getting bolita draws: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener sorteos")


logger.info("✅ Bolita Cubana endpoints initialized")
