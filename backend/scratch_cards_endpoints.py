"""
Scratch Cards (Raspaditos) Endpoints
Instant lottery game with prizes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging
from bson import ObjectId
import random

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
notification_service = None

def set_database(database):
    """Set the database instance"""
    global db
    db = database
    logger.info("✅ Scratch Cards database connection set")

def set_notification_service(service):
    """Set the notification service instance"""
    global notification_service
    notification_service = service
    logger.info("✅ Scratch Cards notification service set")

# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class PurchaseCardRequest(BaseModel):
    """Request to purchase a scratch card"""
    card_type: str = Field(..., description="Type: basic, premium, gold")
    price: float = Field(..., description="Price in credits")


class PurchaseCardResponse(BaseModel):
    """Response for card purchase"""
    success: bool
    card_id: str
    card_type: str
    prize: str
    prize_amount: float
    won: bool
    new_balance: float
    message: str


class CardHistoryResponse(BaseModel):
    """Response for card history"""
    history: List[dict]
    total_played: int
    total_won: int
    total_lost: int


class CardStatsResponse(BaseModel):
    """Response for card statistics"""
    total_played: int
    total_won: int
    total_lost: int
    total_spent: float
    total_won_amount: float
    net_result: float
    win_rate: float


# ============================================
# CARD CONFIGURATIONS
# ============================================

CARD_TYPES = {
    'basic': {
        'name': 'Raspadito Básico',
        'price': 10,
        'prizes': [
            {'amount': 5, 'probability': 0.30},    # 30%
            {'amount': 10, 'probability': 0.15},   # 15%
            {'amount': 25, 'probability': 0.04},   # 4%
            {'amount': 50, 'probability': 0.01},   # 1%
            {'amount': 0, 'probability': 0.50},    # 50% lose
        ]
    },
    'premium': {
        'name': 'Raspadito Premium',
        'price': 25,
        'prizes': [
            {'amount': 10, 'probability': 0.25},   # 25%
            {'amount': 25, 'probability': 0.20},   # 20%
            {'amount': 50, 'probability': 0.10},   # 10%
            {'amount': 100, 'probability': 0.05},  # 5%
            {'amount': 250, 'probability': 0.02},  # 2%
            {'amount': 0, 'probability': 0.38},    # 38% lose
        ]
    },
    'gold': {
        'name': 'Raspadito de Oro',
        'price': 50,
        'prizes': [
            {'amount': 25, 'probability': 0.20},   # 20%
            {'amount': 50, 'probability': 0.15},   # 15%
            {'amount': 100, 'probability': 0.10},  # 10%
            {'amount': 250, 'probability': 0.08},  # 8%
            {'amount': 500, 'probability': 0.04},  # 4%
            {'amount': 1000, 'probability': 0.01}, # 1%
            {'amount': 0, 'probability': 0.42},    # 42% lose
        ]
    }
}


# ============================================
# HELPER FUNCTIONS
# ============================================

def calculate_prize(card_type: str) -> tuple[float, bool]:
    """
    Calculate prize based on card type and probabilities
    
    Returns:
        (prize_amount, won)
    """
    if card_type not in CARD_TYPES:
        return 0, False
    
    card_config = CARD_TYPES[card_type]
    prizes = card_config['prizes']
    
    # Create weighted random selection
    amounts = [p['amount'] for p in prizes]
    probabilities = [p['probability'] for p in prizes]
    
    # Select prize based on probabilities
    prize = random.choices(amounts, weights=probabilities, k=1)[0]
    
    return prize, prize > 0


# ============================================
# ENDPOINTS
# ============================================

@router.post('/purchase', response_model=PurchaseCardResponse)
async def purchase_scratch_card(request: PurchaseCardRequest, user_id: str = None):
    """
    Purchase and play a scratch card
    
    Process:
    1. Validate card type and price
    2. Check user balance
    3. Deduct credits
    4. Calculate prize
    5. Award prize if won
    6. Save to database
    7. Send notifications
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        # Para testing, crear usuario de prueba
        if not user_id:
            test_user = await db.users.find_one({'email': 'test_scratch@test.com'})
            if not test_user:
                test_user_data = {
                    'email': 'test_scratch@test.com',
                    'name': 'Test User',
                    'credits': 1000,
                    'created_at': datetime.utcnow()
                }
                result = await db.users.insert_one(test_user_data)
                user_id = str(result.inserted_id)
            else:
                user_id = str(test_user['_id'])
        
        # Validate card type
        if request.card_type not in CARD_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de raspadito inválido")
        
        card_config = CARD_TYPES[request.card_type]
        
        # Validate price
        if request.price != card_config['price']:
            raise HTTPException(status_code=400, detail="Precio incorrecto")
        
        # Get user balance
        user = await db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        balance = user.get('credits', 0)
        if balance < request.price:
            raise HTTPException(
                status_code=400,
                detail=f"Saldo insuficiente. Necesitas {request.price} créditos pero solo tienes {balance}"
            )
        
        # Calculate prize
        prize_amount, won = calculate_prize(request.card_type)
        
        # Create card record
        card = {
            'user_id': user_id,
            'card_type': request.card_type,
            'price': request.price,
            'prize_amount': prize_amount,
            'won': won,
            'played_at': datetime.utcnow(),
        }
        
        result = await db.scratch_cards.insert_one(card)
        card_id = str(result.inserted_id)
        
        # Deduct price from balance
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'credits': -request.price}}
        )
        
        # Award prize if won
        if won:
            await db.users.update_one(
                {'_id': ObjectId(user_id)},
                {'$inc': {'credits': prize_amount}}
            )
        
        # Calculate new balance
        new_balance = balance - request.price + (prize_amount if won else 0)
        
        # Prepare response
        prize_text = f"${int(prize_amount)}" if won else "Lose"
        message = f"¡Ganaste ${int(prize_amount)}!" if won else "No ganaste esta vez. ¡Intenta de nuevo!"
        
        logger.info(f"🎫 Scratch card played: {user_id} - {request.card_type} - Won: {won} - Prize: ${prize_amount}")
        
        # Send notifications if won
        if won and notification_service and user:
            try:
                # Push Notification
                if user.get('push_token'):
                    await notification_service.send_push_notification(
                        user['push_token'],
                        '🎉 ¡Felicidades!',
                        f'¡Ganaste ${int(prize_amount)} en un {card_config["name"]}!'
                    )
                
                # Email Notification
                if user.get('email'):
                    await notification_service.send_email_notification(
                        user['email'],
                        '🎫 ¡Ganaste en tu Raspadito!',
                        f"""
                        <h2>🎉 ¡Felicidades!</h2>
                        <p>¡Ganaste en tu raspadito!</p>
                        <p><strong>Raspadito:</strong> {card_config['name']}</p>
                        <p><strong>Premio:</strong> ${int(prize_amount)}</p>
                        <p><strong>Nuevo saldo:</strong> {new_balance} créditos</p>
                        <hr>
                        <p>¡Sigue jugando para ganar más!</p>
                        """
                    )
                
                # SMS Notification
                if user.get('phone'):
                    await notification_service.send_sms_notification(
                        user['phone'],
                        f"🎫 ¡Ganaste ${int(prize_amount)} en un raspadito! Nuevo saldo: {new_balance} créditos."
                    )
                
                logger.info(f"📧 Win notifications sent to user {user_id}")
            except Exception as notif_error:
                logger.error(f"⚠️ Error sending notifications: {str(notif_error)}")
        
        return PurchaseCardResponse(
            success=True,
            card_id=card_id,
            card_type=request.card_type,
            prize=prize_text,
            prize_amount=prize_amount,
            won=won,
            new_balance=new_balance,
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purchasing scratch card: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al comprar el raspadito")


@router.get('/history', response_model=CardHistoryResponse)
async def get_scratch_card_history(user_id: str = None, limit: int = 20):
    """Get user's scratch card history"""
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        if not user_id:
            test_user = await db.users.find_one({'email': 'test_scratch@test.com'})
            if test_user:
                user_id = str(test_user['_id'])
            else:
                return CardHistoryResponse(
                    history=[],
                    total_played=0,
                    total_won=0,
                    total_lost=0
                )
        
        # Get cards history
        cursor = db.scratch_cards.find({'user_id': user_id}).sort('played_at', -1).limit(limit)
        cards = await cursor.to_list(length=limit)
        
        history = []
        total_won = 0
        total_lost = 0
        
        for card in cards:
            card_config = CARD_TYPES.get(card['card_type'], {})
            history.append({
                'id': str(card['_id']),
                'card_type': card['card_type'],
                'card_name': card_config.get('name', 'Unknown'),
                'price': card['price'],
                'prize_amount': card['prize_amount'],
                'won': card['won'],
                'played_at': card['played_at'].strftime('%Y-%m-%d %H:%M')
            })
            
            if card['won']:
                total_won += 1
            else:
                total_lost += 1
        
        return CardHistoryResponse(
            history=history,
            total_played=len(cards),
            total_won=total_won,
            total_lost=total_lost
        )
        
    except Exception as e:
        logger.error(f"Error getting scratch card history: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener historial")


@router.get('/stats', response_model=CardStatsResponse)
async def get_scratch_card_stats(user_id: str = None):
    """Get user's scratch card statistics"""
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not initialized")
        
        if not user_id:
            test_user = await db.users.find_one({'email': 'test_scratch@test.com'})
            if test_user:
                user_id = str(test_user['_id'])
            else:
                return CardStatsResponse(
                    total_played=0,
                    total_won=0,
                    total_lost=0,
                    total_spent=0,
                    total_won_amount=0,
                    net_result=0,
                    win_rate=0
                )
        
        # Get all cards for this user
        cursor = db.scratch_cards.find({'user_id': user_id})
        cards = await cursor.to_list(length=None)
        
        total_played = len(cards)
        total_won = sum(1 for c in cards if c['won'])
        total_lost = total_played - total_won
        total_spent = sum(c['price'] for c in cards)
        total_won_amount = sum(c['prize_amount'] for c in cards if c['won'])
        net_result = total_won_amount - total_spent
        win_rate = (total_won / total_played * 100) if total_played > 0 else 0
        
        return CardStatsResponse(
            total_played=total_played,
            total_won=total_won,
            total_lost=total_lost,
            total_spent=total_spent,
            total_won_amount=total_won_amount,
            net_result=net_result,
            win_rate=round(win_rate, 2)
        )
        
    except Exception as e:
        logger.error(f"Error getting scratch card stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas")


logger.info("✅ Scratch Cards endpoints initialized")
