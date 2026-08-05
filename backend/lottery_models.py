"""
Lottery Models - Pydantic models for lottery system
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

# Lottery Types
class LotteryType:
    SCRATCH_CARD = "scratch_card"  # Raspaditos - Instantáneo
    BOLITA = "bolita"  # La Bolita Cubana - Números
    TRADITIONAL = "traditional"  # Lotería tradicional (6 números)

# Lottery Models
class CreateLotteryRequest(BaseModel):
    """Request model for creating a new lottery"""
    title: str
    description: str
    lottery_type: str  # 'scratch_card', 'bolita', 'traditional'
    prize_type: str  # 'service', 'credits', 'discount', 'product'
    prize_value: str
    prize_credits: Optional[int] = None
    ticket_price: int  # in credits
    
    # For traditional lottery
    numbers_to_pick: Optional[int] = 6  # How many numbers to pick
    number_range_min: Optional[int] = 1  # Minimum number
    number_range_max: Optional[int] = 49  # Maximum number
    
    # For scratch cards
    scratch_card_prizes: Optional[Dict[str, int]] = None  # {'2x': 50, '5x': 20, '10x': 10, 'jackpot': 1}
    total_cards: Optional[int] = None  # Total scratch cards available
    
    # For bolita
    bolita_number_range: Optional[int] = 100  # 0-99 or 1-100
    
    max_tickets_per_user: int = 10
    draw_date: Optional[datetime] = None  # None for instant games
    
class UpdateLotteryRequest(BaseModel):
    """Request model for updating lottery"""
    title: Optional[str] = None
    description: Optional[str] = None
    prize_value: Optional[str] = None
    draw_date: Optional[datetime] = None
    status: Optional[str] = None

class BuyLotteryTicketRequest(BaseModel):
    """Request model for buying lottery ticket"""
    lottery_id: str
    selected_numbers: Optional[List[int]] = None  # For bolita and traditional
    quantity: int = 1
    bet_type: Optional[str] = 'fijo'  # For bolita: 'fijo', 'corrido', 'parley'

class ExecuteLotteryRequest(BaseModel):
    """Request model for executing lottery draw"""
    lottery_id: str
    winning_number: Optional[int] = None  # For bolita (manual entry)

# Response Models
class LotteryTicketResponse(BaseModel):
    """Response model for lottery ticket"""
    id: str
    lottery_id: str
    lottery_title: str
    lottery_type: str
    user_id: str
    selected_numbers: Optional[List[int]] = None
    ticket_number: str
    purchased_at: datetime
    cost: int
    matched_numbers: Optional[int] = None
    prize_won: Optional[str] = None
    is_winner: bool = False
    revealed: bool = False  # For scratch cards
    
class LotteryGuideResponse(BaseModel):
    """Game guide/rules response"""
    lottery_type: str
    title: str
    description: str
    how_to_play: List[str]
    prize_structure: Dict[str, str]
    tips: List[str]
    min_bet: int
    max_tickets: int
