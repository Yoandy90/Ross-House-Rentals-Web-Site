"""
Subscription Management Endpoints - Admin
Gestión completa de suscripciones, productos y métodos de pago
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import uuid
import stripe

router = APIRouter(prefix='/admin/subscriptions', tags=['Admin Subscriptions'])

# Will be injected from server.py
db = None

def init_subscription_management(database):
    """Initialize with database"""
    global db
    db = database

# Auth dependency
async def require_admin(authorization: str = None) -> dict:
    """Require admin role"""
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    
    session = await db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    
    user = await db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    return {
        'id': user['_id'],
        'email': user['email'],
        'name': user.get('name', ''),
        'role': user.get('role', 'client')
    }


# ============================================================================
# PRODUCT/SERVICE MANAGEMENT WITH PAYMENT METHODS
# ============================================================================

class PaymentMethodConfig(BaseModel):
    card: bool = True
    ach: bool = False
    
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    billing_interval: str  # 'month', 'year', 'one_time'
    payment_methods: PaymentMethodConfig
    is_active: bool = True
    features: Optional[List[str]] = []
    stripe_product_id: Optional[str] = None
    stripe_price_id: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    payment_methods: Optional[PaymentMethodConfig] = None
    is_active: Optional[bool] = None
    features: Optional[List[str]] = None


@router.get('/products')
async def get_all_products(
    include_inactive: bool = False,
    admin: dict = Depends(require_admin)
):
    """Get all products/services with payment method configuration"""
    try:
        query = {} if include_inactive else {'is_active': True}
        products = await db.subscription_products.find(query).to_list(100)
        
        # Convert ObjectId to string
        for product in products:
            product['_id'] = str(product['_id'])
        
        return {'products': products, 'count': len(products)}
    except Exception as e:
        print(f"❌ Error getting products: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/products')
async def create_product(
    product: ProductCreate,
    admin: dict = Depends(require_admin)
):
    """Create new product/service with payment method configuration"""
    try:
        # Create Stripe product and price if needed
        stripe_product_id = product.stripe_product_id
        stripe_price_id = product.stripe_price_id
        
        if not stripe_product_id:
            # Create in Stripe
            stripe_product = stripe.Product.create(
                name=product.name,
                description=product.description,
                metadata={'source': 'rosstax_admin'}
            )
            stripe_product_id = stripe_product.id
        
        if not stripe_price_id and product.billing_interval != 'one_time':
            # Create recurring price
            stripe_price = stripe.Price.create(
                product=stripe_product_id,
                unit_amount=int(product.price * 100),  # Convert to cents
                currency='usd',
                recurring={'interval': product.billing_interval}
            )
            stripe_price_id = stripe_price.id
        elif not stripe_price_id:
            # Create one-time price
            stripe_price = stripe.Price.create(
                product=stripe_product_id,
                unit_amount=int(product.price * 100),
                currency='usd'
            )
            stripe_price_id = stripe_price.id
        
        # Save to database
        product_data = {
            'id': str(uuid.uuid4()),
            'name': product.name,
            'description': product.description,
            'price': product.price,
            'billing_interval': product.billing_interval,
            'payment_methods': product.payment_methods.dict(),
            'is_active': product.is_active,
            'features': product.features or [],
            'stripe_product_id': stripe_product_id,
            'stripe_price_id': stripe_price_id,
            'created_at': datetime.utcnow(),
            'created_by': admin['id']
        }
        
        await db.subscription_products.insert_one(product_data)
        
        product_data.pop('_id', None)
        return product_data
        
    except Exception as e:
        print(f"❌ Error creating product: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/products/{product_id}')
async def update_product(
    product_id: str,
    updates: ProductUpdate,
    admin: dict = Depends(require_admin)
):
    """Update product configuration including payment methods"""
    try:
        product = await db.subscription_products.find_one({'id': product_id})
        if not product:
            raise HTTPException(status_code=404, detail='Product not found')
        
        update_data = {}
        if updates.name is not None:
            update_data['name'] = updates.name
        if updates.description is not None:
            update_data['description'] = updates.description
        if updates.price is not None:
            update_data['price'] = updates.price
        if updates.payment_methods is not None:
            update_data['payment_methods'] = updates.payment_methods.dict()
        if updates.is_active is not None:
            update_data['is_active'] = updates.is_active
        if updates.features is not None:
            update_data['features'] = updates.features
        
        update_data['updated_at'] = datetime.utcnow()
        update_data['updated_by'] = admin['id']
        
        await db.subscription_products.update_one(
            {'id': product_id},
            {'$set': update_data}
        )
        
        updated_product = await db.subscription_products.find_one({'id': product_id})
        updated_product['_id'] = str(updated_product['_id'])
        
        return updated_product
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating product: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/products/{product_id}')
async def delete_product(
    product_id: str,
    admin: dict = Depends(require_admin)
):
    """Soft delete product (mark as inactive)"""
    try:
        result = await db.subscription_products.update_one(
            {'id': product_id},
            {'$set': {
                'is_active': False,
                'deleted_at': datetime.utcnow(),
                'deleted_by': admin['id']
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Product not found')
        
        return {'message': 'Product deleted successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting product: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SUBSCRIPTION MANAGEMENT (CREATE, UPDATE, CANCEL)
# ============================================================================

class SubscriptionCreate(BaseModel):
    user_id: str
    product_id: str
    payment_method_id: str  # Stripe payment method ID
    start_date: Optional[str] = None
    trial_days: Optional[int] = 0

class SubscriptionUpdate(BaseModel):
    product_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    cancel_at_period_end: Optional[bool] = None


@router.post('/create')
async def create_subscription_for_user(
    subscription: SubscriptionCreate,
    admin: dict = Depends(require_admin)
):
    """Create a new subscription for a user (admin action)"""
    try:
        # Get user
        user = await db.users.find_one({'_id': subscription.user_id})
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Get product
        product = await db.subscription_products.find_one({'id': subscription.product_id})
        if not product:
            raise HTTPException(status_code=404, detail='Product not found')
        
        # Get or create Stripe customer
        stripe_customer = await db.subscriptions.find_one({'user_id': subscription.user_id})
        if stripe_customer and stripe_customer.get('stripe_customer_id'):
            customer_id = stripe_customer['stripe_customer_id']
        else:
            customer = stripe.Customer.create(
                email=user['email'],
                name=user.get('name', ''),
                metadata={'user_id': subscription.user_id}
            )
            customer_id = customer.id
        
        # Create subscription in Stripe
        sub_params = {
            'customer': customer_id,
            'items': [{'price': product['stripe_price_id']}],
            'payment_method': subscription.payment_method_id,
            'default_payment_method': subscription.payment_method_id,
            'expand': ['latest_invoice.payment_intent']
        }
        
        if subscription.trial_days and subscription.trial_days > 0:
            sub_params['trial_period_days'] = subscription.trial_days
        
        stripe_sub = stripe.Subscription.create(**sub_params)
        
        # Save to database
        subscription_data = {
            'id': str(uuid.uuid4()),
            'user_id': subscription.user_id,
            'product_id': subscription.product_id,
            'stripe_subscription_id': stripe_sub.id,
            'stripe_customer_id': customer_id,
            'status': stripe_sub.status,
            'current_period_start': datetime.fromtimestamp(stripe_sub.current_period_start),
            'current_period_end': datetime.fromtimestamp(stripe_sub.current_period_end),
            'cancel_at_period_end': stripe_sub.cancel_at_period_end,
            'created_at': datetime.utcnow(),
            'created_by_admin': admin['id']
        }
        
        await db.subscriptions.insert_one(subscription_data)
        
        print(f"✅ Subscription created by admin for user {subscription.user_id}")
        
        subscription_data.pop('_id', None)
        return subscription_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/{subscription_id}')
async def update_subscription(
    subscription_id: str,
    updates: SubscriptionUpdate,
    admin: dict = Depends(require_admin)
):
    """Update subscription (change plan, payment method, etc)"""
    try:
        # Get subscription
        subscription = await db.subscriptions.find_one({'id': subscription_id})
        if not subscription:
            raise HTTPException(status_code=404, detail='Subscription not found')
        
        stripe_sub_id = subscription['stripe_subscription_id']
        update_params = {}
        
        # Change plan
        if updates.product_id:
            product = await db.subscription_products.find_one({'id': updates.product_id})
            if not product:
                raise HTTPException(status_code=404, detail='Product not found')
            
            # Get current subscription items
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            update_params['items'] = [{
                'id': stripe_sub['items']['data'][0].id,
                'price': product['stripe_price_id']
            }]
            
            await db.subscriptions.update_one(
                {'id': subscription_id},
                {'$set': {'product_id': updates.product_id}}
            )
        
        # Change payment method
        if updates.payment_method_id:
            update_params['default_payment_method'] = updates.payment_method_id
        
        # Cancel at period end
        if updates.cancel_at_period_end is not None:
            update_params['cancel_at_period_end'] = updates.cancel_at_period_end
            
            await db.subscriptions.update_one(
                {'id': subscription_id},
                {'$set': {'cancel_at_period_end': updates.cancel_at_period_end}}
            )
        
        # Update in Stripe
        if update_params:
            stripe.Subscription.modify(stripe_sub_id, **update_params)
        
        # Get updated subscription
        updated_sub = await db.subscriptions.find_one({'id': subscription_id})
        updated_sub['_id'] = str(updated_sub['_id'])
        
        print(f"✅ Subscription {subscription_id} updated by admin")
        
        return updated_sub
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/{subscription_id}/cancel')
async def cancel_subscription(
    subscription_id: str,
    immediate: bool = False,
    admin: dict = Depends(require_admin)
):
    """Cancel subscription (immediate or at period end)"""
    try:
        subscription = await db.subscriptions.find_one({'id': subscription_id})
        if not subscription:
            raise HTTPException(status_code=404, detail='Subscription not found')
        
        stripe_sub_id = subscription['stripe_subscription_id']
        
        if immediate:
            # Cancel immediately
            stripe.Subscription.delete(stripe_sub_id)
            
            await db.subscriptions.update_one(
                {'id': subscription_id},
                {'$set': {
                    'status': 'canceled',
                    'canceled_at': datetime.utcnow(),
                    'canceled_by_admin': admin['id']
                }}
            )
        else:
            # Cancel at period end
            stripe.Subscription.modify(
                stripe_sub_id,
                cancel_at_period_end=True
            )
            
            await db.subscriptions.update_one(
                {'id': subscription_id},
                {'$set': {
                    'cancel_at_period_end': True,
                    'cancel_requested_at': datetime.utcnow(),
                    'cancel_requested_by_admin': admin['id']
                }}
            )
        
        print(f"✅ Subscription {subscription_id} canceled by admin (immediate: {immediate})")
        
        return {
            'message': 'Subscription canceled successfully',
            'immediate': immediate
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/{subscription_id}/reactivate')
async def reactivate_subscription(
    subscription_id: str,
    admin: dict = Depends(require_admin)
):
    """Reactivate a canceled subscription (if not expired)"""
    try:
        subscription = await db.subscriptions.find_one({'id': subscription_id})
        if not subscription:
            raise HTTPException(status_code=404, detail='Subscription not found')
        
        if not subscription.get('cancel_at_period_end'):
            raise HTTPException(status_code=400, detail='Subscription is not set to cancel')
        
        stripe_sub_id = subscription['stripe_subscription_id']
        
        # Reactivate in Stripe
        stripe.Subscription.modify(
            stripe_sub_id,
            cancel_at_period_end=False
        )
        
        await db.subscriptions.update_one(
            {'id': subscription_id},
            {'$set': {
                'cancel_at_period_end': False,
                'reactivated_at': datetime.utcnow(),
                'reactivated_by_admin': admin['id']
            }}
        )
        
        print(f"✅ Subscription {subscription_id} reactivated by admin")
        
        return {'message': 'Subscription reactivated successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/user/{user_id}')
async def get_user_subscriptions(
    user_id: str,
    admin: dict = Depends(require_admin)
):
    """Get all subscriptions for a specific user"""
    try:
        subscriptions = await db.subscriptions.find({'user_id': user_id}).to_list(100)
        
        # Enrich with product info
        for sub in subscriptions:
            sub['_id'] = str(sub['_id'])
            product = await db.subscription_products.find_one({'id': sub['product_id']})
            if product:
                sub['product_name'] = product['name']
                sub['product_price'] = product['price']
        
        return {'subscriptions': subscriptions, 'count': len(subscriptions)}
        
    except Exception as e:
        print(f"❌ Error getting user subscriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
