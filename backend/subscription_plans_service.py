"""
Merchant One Subscription Plans Management
Allows creating predefined plans that can be reused for multiple customers
"""

import logging
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ==================== MODELS ====================

class SubscriptionPlan(BaseModel):
    """Subscription plan template"""
    id: Optional[str] = None
    name: str  # e.g., "Plan Mensual Básico"
    description: Optional[str] = None
    amount: float  # e.g., 50.00
    dayFrequency: int  # e.g., 30 for monthly
    isActive: bool = True
    customerCount: int = 0  # How many customers use this plan
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class CreatePlanRequest(BaseModel):
    """Request to create a new plan"""
    name: str
    description: Optional[str] = None
    amount: float
    dayFrequency: int


class UpdatePlanRequest(BaseModel):
    """Request to update a plan"""
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    dayFrequency: Optional[int] = None
    isActive: Optional[bool] = None


# ==================== SERVICE ====================

class SubscriptionPlansService:
    """Service for managing subscription plans"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.subscription_plans
        logger.info("✅ Subscription Plans Service initialized")
    
    async def create_plan(self, plan: CreatePlanRequest) -> dict:
        """Create a new subscription plan"""
        import uuid
        
        plan_doc = {
            'id': str(uuid.uuid4()),
            'name': plan.name,
            'description': plan.description,
            'amount': plan.amount,
            'dayFrequency': plan.dayFrequency,
            'isActive': True,
            'customerCount': 0,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        await self.collection.insert_one(plan_doc)
        logger.info(f"✅ Plan created: {plan.name} - ${plan.amount}/{plan.dayFrequency} days")
        
        return plan_doc
    
    async def get_plans(self, active_only: bool = False) -> List[dict]:
        """Get all subscription plans"""
        if active_only:
            # Support both field names for backward compatibility
            query = {'$or': [{'isActive': True}, {'is_active': True}]}
        else:
            query = {}
        cursor = self.collection.find(query).sort('name', 1)
        plans = await cursor.to_list(100)
        
        # Convert ObjectId to string and normalize field names
        for plan in plans:
            plan['_id'] = str(plan['_id'])
            # Normalize: ensure isActive exists
            if 'is_active' in plan and 'isActive' not in plan:
                plan['isActive'] = plan['is_active']
            if 'price' in plan and 'amount' not in plan:
                plan['amount'] = plan['price']
            if 'billing_period' in plan and 'dayFrequency' not in plan:
                freq_map = {'weekly': 7, 'biweekly': 15, 'monthly': 30, 'yearly': 365}
                plan['dayFrequency'] = freq_map.get(plan['billing_period'], 30)
        
        return plans
    
    async def get_plan_by_id(self, plan_id: str) -> Optional[dict]:
        """Get a specific plan by ID"""
        plan = await self.collection.find_one({'id': plan_id})
        if plan:
            plan['_id'] = str(plan['_id'])
        return plan
    
    async def update_plan(self, plan_id: str, updates: UpdatePlanRequest) -> Optional[dict]:
        """Update a subscription plan"""
        update_data = {'updatedAt': datetime.utcnow()}
        
        if updates.name is not None:
            update_data['name'] = updates.name
        if updates.description is not None:
            update_data['description'] = updates.description
        if updates.amount is not None:
            update_data['amount'] = updates.amount
        if updates.dayFrequency is not None:
            update_data['dayFrequency'] = updates.dayFrequency
        if updates.isActive is not None:
            update_data['isActive'] = updates.isActive
        
        result = await self.collection.find_one_and_update(
            {'id': plan_id},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            result['_id'] = str(result['_id'])
            logger.info(f"✅ Plan updated: {plan_id}")
        
        return result
    
    async def delete_plan(self, plan_id: str) -> bool:
        """Delete a subscription plan (soft delete - mark as inactive)"""
        result = await self.collection.update_one(
            {'id': plan_id},
            {'$set': {'isActive': False, 'updatedAt': datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Plan deactivated: {plan_id}")
            return True
        return False
    
    async def hard_delete_plan(self, plan_id: str) -> bool:
        """Permanently delete a plan"""
        result = await self.collection.delete_one({'id': plan_id})
        return result.deleted_count > 0
    
    async def increment_customer_count(self, plan_id: str, increment: int = 1):
        """Increment or decrement the customer count for a plan"""
        await self.collection.update_one(
            {'id': plan_id},
            {
                '$inc': {'customerCount': increment},
                '$set': {'updatedAt': datetime.utcnow()}
            }
        )
    
    async def get_plan_stats(self) -> dict:
        """Get statistics about plans"""
        pipeline = [
            {'$match': {'isActive': True}},
            {'$group': {
                '_id': None,
                'totalPlans': {'$sum': 1},
                'totalCustomers': {'$sum': '$customerCount'},
                'avgAmount': {'$avg': '$amount'},
                'totalMonthlyRevenue': {
                    '$sum': {
                        '$multiply': ['$amount', '$customerCount']
                    }
                }
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        if result:
            return {
                'totalPlans': result[0]['totalPlans'],
                'totalCustomers': result[0]['totalCustomers'],
                'avgAmount': round(result[0]['avgAmount'] or 0, 2),
                'totalMonthlyRevenue': round(result[0]['totalMonthlyRevenue'] or 0, 2)
            }
        
        return {
            'totalPlans': 0,
            'totalCustomers': 0,
            'avgAmount': 0,
            'totalMonthlyRevenue': 0
        }
    
    async def seed_default_plans(self):
        """Create default plans if none exist"""
        count = await self.collection.count_documents({})
        
        if count == 0:
            default_plans = [
                CreatePlanRequest(
                    name="Plan Semanal",
                    description="Cobro cada 7 días",
                    amount=25.00,
                    dayFrequency=7
                ),
                CreatePlanRequest(
                    name="Plan Quincenal",
                    description="Cobro cada 15 días",
                    amount=40.00,
                    dayFrequency=15
                ),
                CreatePlanRequest(
                    name="Plan Mensual",
                    description="Cobro cada 30 días",
                    amount=50.00,
                    dayFrequency=30
                ),
                CreatePlanRequest(
                    name="Plan Mensual Premium",
                    description="Plan con servicios adicionales",
                    amount=100.00,
                    dayFrequency=30
                ),
            ]
            
            for plan in default_plans:
                await self.create_plan(plan)
            
            logger.info(f"✅ Seeded {len(default_plans)} default subscription plans")
