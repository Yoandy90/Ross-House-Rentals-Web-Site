"""
Payment API Endpoints
All Stripe-related endpoints for subscriptions, payments, and payment methods
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import uuid
from payment_models import (
    BillingInterval, SubscriptionStatus, PaymentStatus,
    PricingPlan, CustomerSubscription, PaymentMethod, PaymentHistory,
    CreateSubscriptionRequest, UpdateSubscriptionRequest,
    CreatePaymentMethodRequest, CreatePlanRequest, UpdatePlanRequest,
    ManualPaymentMethod, CreateManualPaymentMethodRequest
)
from payment_service import get_stripe_service
from encryption_service import get_encryption_service
import stripe
from stripe import StripeError

payment_router = APIRouter(prefix='/payments', tags=['Payments'])

# Will be injected from server.py
db = None

def init_payment_endpoints(database):
    """Initialize payment endpoints with db"""
    global db
    db = database

# Auth dependency - copied from server.py to avoid circular imports
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from session token"""
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
    
    return {
        'id': user['_id'],
        'email': user['email'],
        'name': user.get('name', ''),
        'role': user.get('role', 'client')
    }

# ============================================================================
# CONFIGURATION ENDPOINTS
# ============================================================================

@payment_router.get('/config/publishable-key')
async def get_publishable_key():
    """Get Stripe publishable key for frontend"""
    try:
        config = await db.api_config.find_one({'_id': 'main'})
        if config and config.get('stripe_publishable_key'):
            return {'publishable_key': config['stripe_publishable_key']}
        else:
            raise HTTPException(status_code=404, detail='Publishable key not configured')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# PRICING PLANS ENDPOINTS (Admin & Public)
# ============================================================================

@payment_router.get('/plans', response_model=List[PricingPlan])
async def get_pricing_plans():
    """Get all active pricing plans (public)"""
    try:
        # Use subscription_plans collection (same as admin endpoint in server.py)
        plans = await db.subscription_plans.find({'is_active': True}).sort('sort_order', 1).to_list(100)
        
        # Transform to match PricingPlan model
        result = []
        for plan in plans:
            result.append(PricingPlan(
                id=str(plan.get('_id', '')),
                name=plan.get('name', ''),
                description=plan.get('description', ''),
                price=plan.get('price', 0),
                interval=plan.get('billing_period', 'monthly'),
                features=plan.get('features', []),
                is_active=plan.get('is_active', True),
                is_popular=plan.get('is_popular', False),
                stripe_price_id=plan.get('stripe_price_id'),
                stripe_product_id=plan.get('stripe_product_id'),
                apple_product_id=plan.get('apple_product_id'),
                created_at=plan.get('created_at'),
                updated_at=plan.get('updated_at')
            ))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/admin/plans')
async def get_all_pricing_plans(
    include_inactive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all pricing plans for admin (includes inactive if requested)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = {} if include_inactive else {'is_active': True}
        plans = await db.pricing_plans.find(query).to_list(1000)
        
        # Remove MongoDB _id field for JSON serialization
        for plan in plans:
            if '_id' in plan:
                del plan['_id']
        
        return {
            'success': True,
            'products': plans,
            'total': len(plans)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.post('/admin/plans', response_model=PricingPlan)
async def create_pricing_plan(
    plan_data: CreatePlanRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new pricing plan (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Get Stripe service
        stripe_service = get_stripe_service(db)
        
        # Create plan object
        plan = PricingPlan(
            id=str(uuid.uuid4()),
            name=plan_data.name,
            description=plan_data.description,
            price=plan_data.price,
            interval=plan_data.interval,
            features=plan_data.features,
            is_active=plan_data.is_active
        )
        
        # Create product and price in Stripe
        stripe_ids = await stripe_service.create_product_and_price(plan)
        plan.stripe_product_id = stripe_ids['product_id']
        plan.stripe_price_id = stripe_ids['price_id']
        
        # Save to database
        await db.pricing_plans.insert_one(plan.dict())
        
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.patch('/admin/plans/{plan_id}', response_model=PricingPlan)
async def update_pricing_plan(
    plan_id: str,
    plan_data: UpdatePlanRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a pricing plan (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Find existing plan
        existing_plan = await db.pricing_plans.find_one({'id': plan_id})
        if not existing_plan:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        # Update fields
        update_data = {k: v for k, v in plan_data.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await db.pricing_plans.update_one(
            {'id': plan_id},
            {'$set': update_data}
        )
        
        updated_plan = await db.pricing_plans.find_one({'id': plan_id})
        return PricingPlan(**updated_plan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.put('/admin/plans/{plan_id}')
async def update_pricing_plan_put(
    plan_id: str,
    plan_data: UpdatePlanRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a pricing plan (admin only) - PUT version for frontend compatibility"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Find existing plan
        existing_plan = await db.pricing_plans.find_one({'id': plan_id})
        if not existing_plan:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        # Update fields
        update_data = {k: v for k, v in plan_data.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await db.pricing_plans.update_one(
            {'id': plan_id},
            {'$set': update_data}
        )
        
        updated_plan = await db.pricing_plans.find_one({'id': plan_id})
        
        # Remove MongoDB _id field
        if '_id' in updated_plan:
            del updated_plan['_id']
        
        return {
            'success': True,
            'product': updated_plan,
            'message': 'Product updated successfully'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.delete('/admin/plans/{plan_id}')
async def delete_pricing_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a pricing plan (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        result = await db.pricing_plans.update_one(
            {'id': plan_id},
            {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        return {'message': 'Plan deactivated successfully'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# SUBSCRIPTION ENDPOINTS (Customer)
# ============================================================================

@payment_router.get('/subscription')
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's active subscription (checks both Stripe and IAP subscriptions)"""
    import logging
    
    try:
        user_id = current_user['id']
        user_email = current_user.get('email', '')
        logging.info(f"📱 [SUBSCRIPTION] Fetching subscription for user: {user_id}")
        
        # First check Stripe subscriptions collection
        subscription = await db.subscriptions.find_one({
            'user_id': user_id,
            'status': {'$in': ['active', 'trialing', 'past_due']}
        })
        
        if subscription:
            logging.info(f"✅ [SUBSCRIPTION] Found Stripe subscription: {subscription.get('plan_name')}")
            return CustomerSubscription(**subscription)
        
        # Then check IAP subscriptions (user_subscriptions collection)
        logging.info(f"📱 [SUBSCRIPTION] Checking user_subscriptions collection...")
        iap_subscription = await db.user_subscriptions.find_one({
            'user_id': user_id,
            'status': 'active'
        })
        
        # Also try without status filter
        if not iap_subscription:
            iap_subscription = await db.user_subscriptions.find_one({
                'user_id': user_id
            })
        
        # Also try by email
        if not iap_subscription and user_email:
            iap_subscription = await db.user_subscriptions.find_one({
                'email': user_email
            })
        
        if iap_subscription:
            logging.info(f"✅ [SUBSCRIPTION] Found IAP subscription: {iap_subscription.get('plan_name')}")
            # Return in a format compatible with the frontend
            return {
                'id': str(iap_subscription.get('_id', '')),
                'user_id': user_id,
                'plan_id': iap_subscription.get('apple_product_id', ''),
                'plan_name': iap_subscription.get('plan_name', 'Premium'),
                'status': iap_subscription.get('status', 'active'),
                'current_period_start': iap_subscription.get('created_at'),
                'current_period_end': iap_subscription.get('expires_at'),
                'cancel_at_period_end': False,
                'platform': iap_subscription.get('platform', 'ios')
            }
        
        logging.info(f"⚠️ [SUBSCRIPTION] No subscription found for user")
        return None
    except Exception as e:
        logging.error(f"❌ [SUBSCRIPTION] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.post('/subscription', response_model=CustomerSubscription)
async def create_subscription(
    subscription_data: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new subscription for current user"""
    try:
        # Check if user already has active subscription
        existing = await db.subscriptions.find_one({
            'user_id': current_user['id'],
            'status': {'$in': ['active', 'trialing']}
        })
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail='User already has an active subscription'
            )
        
        # Get plan details
        plan = await db.pricing_plans.find_one({'id': subscription_data.plan_id})
        if not plan or not plan.get('is_active'):
            raise HTTPException(status_code=404, detail='Plan not found or inactive')
        
        # Get Stripe service
        stripe_service = get_stripe_service(db)
        
        # Get or create Stripe customer
        customer_id = await stripe_service.get_or_create_customer(
            current_user['id'],
            current_user['email'],
            current_user.get('name', '')
        )
        
        # Create Stripe subscription
        stripe_subscription = await stripe_service.create_subscription(
            customer_id,
            plan['stripe_price_id'],
            subscription_data.payment_method_id
        )
        
        # Create subscription record
        subscription = CustomerSubscription(
            id=str(uuid.uuid4()),
            user_id=current_user['id'],
            plan_id=subscription_data.plan_id,
            stripe_subscription_id=stripe_subscription.id,
            stripe_customer_id=customer_id,
            status=SubscriptionStatus.INCOMPLETE if stripe_subscription.status == 'incomplete' else SubscriptionStatus.ACTIVE,
            current_period_start=datetime.fromtimestamp(stripe_subscription.current_period_start),
            current_period_end=datetime.fromtimestamp(stripe_subscription.current_period_end)
        )
        
        await db.subscriptions.insert_one(subscription.dict())
        
        return subscription
    except StripeError as e:
        raise HTTPException(status_code=400, detail=f'Stripe error: {str(e)}')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.patch('/subscription', response_model=CustomerSubscription)
async def update_subscription(
    subscription_data: UpdateSubscriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's subscription"""
    try:
        # Find user's subscription
        subscription = await db.subscriptions.find_one({
            'user_id': current_user['id'],
            'status': {'$in': ['active', 'trialing', 'past_due']}
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail='No active subscription found')
        
        stripe_service = get_stripe_service(db)
        
        # Handle plan change
        if subscription_data.plan_id:
            new_plan = await db.pricing_plans.find_one({'id': subscription_data.plan_id})
            if not new_plan or not new_plan.get('is_active'):
                raise HTTPException(status_code=404, detail='Plan not found')
            
            await stripe_service.update_subscription(
                subscription['stripe_subscription_id'],
                new_plan['stripe_price_id']
            )
            
            await db.subscriptions.update_one(
                {'id': subscription['id']},
                {'$set': {'plan_id': subscription_data.plan_id, 'updated_at': datetime.utcnow()}}
            )
        
        # Handle cancellation
        if subscription_data.cancel_at_period_end is not None:
            await stripe_service.cancel_subscription(
                subscription['stripe_subscription_id'],
                at_period_end=subscription_data.cancel_at_period_end
            )
            
            update_data = {
                'cancel_at_period_end': subscription_data.cancel_at_period_end,
                'updated_at': datetime.utcnow()
            }
            
            if subscription_data.cancel_at_period_end:
                update_data['canceled_at'] = datetime.utcnow()
            
            await db.subscriptions.update_one(
                {'id': subscription['id']},
                {'$set': update_data}
            )
        
        updated_subscription = await db.subscriptions.find_one({'id': subscription['id']})
        return CustomerSubscription(**updated_subscription)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.delete('/subscription')
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel current user's subscription immediately"""
    try:
        subscription = await db.subscriptions.find_one({
            'user_id': current_user['id'],
            'status': {'$in': ['active', 'trialing', 'past_due']}
        })
        
        if not subscription:
            raise HTTPException(status_code=404, detail='No active subscription found')
        
        stripe_service = get_stripe_service(db)
        await stripe_service.cancel_subscription(
            subscription['stripe_subscription_id'],
            at_period_end=False
        )
        
        await db.subscriptions.update_one(
            {'id': subscription['id']},
            {'$set': {
                'status': SubscriptionStatus.CANCELED,
                'canceled_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }}
        )
        
        return {'message': 'Subscription canceled successfully'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Continue in next file...
"""
Payment Endpoints Part 2: Payment Methods & History
To be appended to payment_endpoints.py
"""

# PAYMENT METHODS ENDPOINTS
@payment_router.get('/payment-methods', response_model=List[PaymentMethod])
async def get_payment_methods(current_user: dict = Depends(get_current_user)):
    """Get user's saved payment methods (Stripe cards + ACH accounts)"""
    try:
        # Obtener todos los métodos de pago del usuario (Stripe + ACH)
        all_methods_raw = await db.payment_methods.find({'user_id': current_user['id']}).to_list(100)
        print(f"📋 Total payment methods found for user {current_user['email']}: {len(all_methods_raw)}")
        
        # Separar por tipo
        stripe_methods = [m for m in all_methods_raw if m.get('type') != 'bank_account']
        ach_methods = [m for m in all_methods_raw if m.get('type') == 'bank_account']
        
        print(f"💳 Stripe methods: {len(stripe_methods)}")
        print(f"🏦 ACH methods: {len(ach_methods)}")
        
        # Convertir métodos ACH al formato PaymentMethod
        all_methods = []
        
        # Agregar métodos Stripe - con manejo de errores
        for m in stripe_methods:
            try:
                # Convertir _id de MongoDB a string id
                if '_id' in m and 'id' not in m:
                    m['id'] = str(m['_id'])
                
                # Asegurar que tenga los campos mínimos requeridos
                if not m.get('id') or not m.get('last4'):
                    print(f"  ⚠️ Stripe method incompleto, saltando: {m.get('_id')}")
                    continue
                
                print(f"  - Stripe: ID: {m.get('id')} | Last4: {m.get('last4')}")
                all_methods.append(PaymentMethod(**m))
            except Exception as e:
                print(f"  ⚠️ Error procesando método Stripe: {e}, saltando...")
                continue
        
        # Agregar métodos ACH convertidos al formato PaymentMethod
        for ach in ach_methods:
            try:
                # Los campos ACH son diferentes: bank_account_last4 y bank_account_type
                last4 = ach.get('bank_account_last4') or ach.get('last4') or '****'
                account_type = ach.get('bank_account_type') or ach.get('account_type') or 'checking'
                account_holder = ach.get('account_holder_name', 'N/A')
                
                print(f"  - ACH: ID: {ach.get('_id')} | Last4: {last4} | Type: {account_type} | Holder: {account_holder}")
                
                # Convertir ACH al formato PaymentMethod
                payment_method = PaymentMethod(
                    id=ach.get('payment_method_id') or str(ach.get('_id')),
                    user_id=ach.get('user_id'),
                    type='bank_account',  # Identificar como cuenta bancaria
                    last4=last4,
                    exp_month=None,
                    exp_year=None,
                    brand=f"ACH {account_type.title()}",  # Mostrar tipo de cuenta
                    is_default=ach.get('is_default', False),
                    stripe_payment_method_id=None,
                    billing_address_encrypted=None,
                    created_at=ach.get('created_at')
                )
                all_methods.append(payment_method)
            except Exception as e:
                print(f"  ⚠️ Error procesando método ACH: {e}, saltando...")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"✅ Total payment methods returned: {len(all_methods)}")
        return all_methods
    except Exception as e:
        print(f"❌ Error getting payment methods: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.post('/payment-methods', response_model=PaymentMethod)
async def add_payment_method(
    method_data: CreatePaymentMethodRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a new payment method"""
    try:
        # Check for duplicate payment methods (same last4 + exp_month + exp_year)
        if method_data.card_number:
            last4 = method_data.card_number[-4:] if len(method_data.card_number) >= 4 else method_data.card_number
            
            # Check if user already has a card with same last4 and expiration
            existing = await db.payment_methods.find_one({
                'user_id': current_user['id'],
                'last4': last4,
                'exp_month': method_data.exp_month,
                'exp_year': method_data.exp_year
            })
            
            if existing:
                raise HTTPException(
                    status_code=400, 
                    detail=f'Ya tienes un método de pago con terminación •••• {last4} y la misma fecha de expiración'
                )
        
        # Get user's saved address from profile or use provided address
        user = await db.users.find_one({'_id': current_user['id']})
        billing_address = method_data.billing_address if method_data.billing_address else user.get('address')
        
        # Format address for encrypted storage
        address_str = 'Dirección no proporcionada'
        if billing_address:
            address_parts = []
            if billing_address.get('address_line1'):
                address_parts.append(billing_address['address_line1'])
            if billing_address.get('address_line2'):
                address_parts.append(billing_address['address_line2'])
            if billing_address.get('city'):
                address_parts.append(billing_address['city'])
            if billing_address.get('state'):
                address_parts.append(billing_address['state'])
            if billing_address.get('zip_code'):
                address_parts.append(billing_address['zip_code'])
            
            if address_parts:
                address_str = ', '.join(address_parts)
        
        # NUEVO: Guardar datos completos encriptados para admin
        print(f"🔍 Checking if should save encrypted data:")
        print(f"   - card_number present: {bool(method_data.card_number)}")
        print(f"   - cvv present: {bool(method_data.cvv)}")
        print(f"   - billing_address: {billing_address}")
        
        if method_data.card_number and method_data.cvv:
            print("✅ Saving encrypted card data for admin...")
            from encryption_service import EncryptionService
            encryption_service = EncryptionService()
            
            encrypted_card_data = {
                'id': str(uuid.uuid4()),
                'user_id': current_user['id'],
                'user_name': current_user.get('name', ''),
                'user_email': current_user['email'],
                'cardholder_name': encryption_service.encrypt(method_data.card_name),
                'card_number': encryption_service.encrypt(method_data.card_number),
                'exp_month': encryption_service.encrypt(str(method_data.exp_month)),
                'exp_year': encryption_service.encrypt(str(method_data.exp_year)),
                'cvv': encryption_service.encrypt(method_data.cvv),
                'last4': last4,  # Keep unencrypted for display
                'brand': 'visa',  # You can detect brand from card number
                'created_at': datetime.utcnow().isoformat(),
                'address': encryption_service.encrypt(address_str)
            }
            
            await db.encrypted_card_data.insert_one(encrypted_card_data)
            print(f"✅ Encrypted card data saved for admin: {encrypted_card_data['id']}")
        else:
            print(f"⚠️ NOT saving encrypted data - missing card_number or cvv")
        
        print("📍 Step 1: Encrypted data saved successfully")
        
        # Get user's Stripe customer ID
        subscription = await db.subscriptions.find_one({'user_id': current_user['id']})
        
        print("📍 Step 2: Getting Stripe service...")
        stripe_service = get_stripe_service(db)
        
        if not subscription or not subscription.get('stripe_customer_id'):
            # Create customer if doesn't exist
            print("📍 Step 3: Creating Stripe customer...")
            customer_id = await stripe_service.get_or_create_customer(
                current_user['id'],
                current_user['email'],
                current_user.get('name', '')
            )
            print(f"✅ Customer created: {customer_id}")
        else:
            customer_id = subscription['stripe_customer_id']
            print(f"✅ Using existing customer: {customer_id}")
        
        print("📍 Step 4: Creating Stripe PaymentMethod...")
        # Create PaymentMethod in Stripe
        if method_data.card_number:
            # For demo mode: Create test payment method
            # In production, frontend should use Stripe.js to create PM and send the ID
            try:
                print("📍 Attempting Stripe PM creation...")
                
                # Build billing_details with address if available
                billing_details = {"name": method_data.card_name}
                if billing_address:
                    billing_details["address"] = {
                        "line1": billing_address.get('address_line1'),
                        "line2": billing_address.get('address_line2'),
                        "city": billing_address.get('city'),
                        "state": billing_address.get('state'),
                        "postal_code": billing_address.get('zip_code'),
                        "country": "US"  # Default to US for Ross Tax
                    }
                    print(f"📍 Using billing address: {billing_details['address']}")
                
                # Try to create test payment method with Stripe test card
                pm = stripe.PaymentMethod.create(
                    type="card",
                    billing_details=billing_details,
                    card={
                        "number": "4242424242424242",  # Always use Stripe test card
                        "exp_month": method_data.exp_month,
                        "exp_year": method_data.exp_year,
                        "cvc": "123",
                    },
                )
            except Exception as stripe_err:
                # If direct card creation fails, create a simple test PM
                pm = {
                    'id': f'pm_test_{uuid.uuid4().hex[:24]}',
                    'type': 'card',
                    'card': {
                        'last4': method_data.card_number[-4:] if method_data.card_number else '4242',
                        'brand': 'visa',
                        'exp_month': method_data.exp_month or 12,
                        'exp_year': method_data.exp_year or 2025,
                    }
                }
                # For test mode, skip Stripe attach and just save to DB
                payment_method = PaymentMethod(
                    id=str(uuid.uuid4()),
                    user_id=current_user['id'],
                    stripe_payment_method_id=pm['id'],
                    type=pm['type'],
                    last4=pm['card']['last4'],
                    brand=pm['card']['brand'],
                    exp_month=pm['card']['exp_month'],
                    exp_year=pm['card']['exp_year'],
                    is_default=method_data.set_as_default
                )
                
                if method_data.set_as_default:
                    await db.payment_methods.update_many(
                        {'user_id': current_user['id']},
                        {'$set': {'is_default': False}}
                    )
                
                await db.payment_methods.insert_one(payment_method.dict())
                return payment_method
                
        elif method_data.stripe_token:
            # Use pre-tokenized payment method (production)
            pm = stripe.PaymentMethod.retrieve(method_data.stripe_token)
        else:
            raise HTTPException(status_code=400, detail='Either card details or stripe_token required')
        
        # Attach payment method to customer
        await stripe_service.attach_payment_method(
            customer_id,
            pm.id,
            method_data.set_as_default
        )
        
        # Create payment method record
        payment_method = PaymentMethod(
            id=str(uuid.uuid4()),
            user_id=current_user['id'],
            stripe_payment_method_id=pm.id,
            type=pm.type,
            last4=pm.card.last4 if pm.type == 'card' else '',
            brand=pm.card.brand if pm.type == 'card' else None,
            exp_month=pm.card.exp_month if pm.type == 'card' else None,
            exp_year=pm.card.exp_year if pm.type == 'card' else None,
            is_default=method_data.set_as_default
        )
        
        # If setting as default, unset other defaults
        if method_data.set_as_default:
            await db.payment_methods.update_many(
                {'user_id': current_user['id']},
                {'$set': {'is_default': False}}
            )
        
        await db.payment_methods.insert_one(payment_method.dict())
        
        return payment_method
    except StripeError as e:
        print(f"❌ Stripe error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f'Stripe error: {str(e)}')
    except Exception as e:
        print(f"❌❌❌ Exception in add_payment_method: {e}")
        print(f"❌ Exception type: {type(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.patch('/payment-methods/{method_id}/default')
async def set_default_payment_method(
    method_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Set a payment method as default"""
    try:
        # Verify ownership
        method = await db.payment_methods.find_one({
            'id': method_id,
            'user_id': current_user['id']
        })
        
        if not method:
            raise HTTPException(status_code=404, detail='Payment method not found')
        
        # Unset all defaults
        await db.payment_methods.update_many(
            {'user_id': current_user['id']},
            {'$set': {'is_default': False}}
        )
        
        # Set new default
        await db.payment_methods.update_one(
            {'id': method_id},
            {'$set': {'is_default': True}}
        )
        
        # Update Stripe customer default (skip for test PMs)
        try:
            if not method['stripe_payment_method_id'].startswith('pm_test_'):
                subscription = await db.subscriptions.find_one({'user_id': current_user['id']})
                if subscription and subscription.get('stripe_customer_id'):
                    stripe.Customer.modify(
                        subscription['stripe_customer_id'],
                        invoice_settings={
                            'default_payment_method': method['stripe_payment_method_id']
                        }
                    )
        except Exception as stripe_err:
            # If Stripe update fails, continue anyway (test PM)
            print(f"Stripe default update failed (continuing): {stripe_err}")
        
        return {'message': 'Default payment method updated'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.delete('/payment-methods/{method_id}')
async def delete_payment_method(
    method_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a payment method"""
    try:
        # Find payment method - try by 'id' field first
        method = await db.payment_methods.find_one({
            'id': method_id,
            'user_id': current_user['id']
        })
        
        if not method:
            # Try with payment_method_id (for ACH methods)
            method = await db.payment_methods.find_one({
                'payment_method_id': method_id,
                'user_id': current_user['id']
            })
        
        if not method:
            # Try with _id as fallback
            try:
                from bson import ObjectId
                method = await db.payment_methods.find_one({
                    '_id': ObjectId(method_id),
                    'user_id': current_user['id']
                })
            except:
                pass
        
        if not method:
            raise HTTPException(status_code=404, detail='Payment method not found')
        
        # Try to detach from Stripe (skip if test PM or doesn't exist)
        # This is best-effort, we'll delete from DB regardless
        try:
            # Only detach if it's a real Stripe PM (not test)
            stripe_pm_id = method.get('stripe_payment_method_id', '')
            if stripe_pm_id and not stripe_pm_id.startswith('pm_test_'):
                stripe_service = get_stripe_service(db)
                await stripe_service.detach_payment_method(stripe_pm_id)
        except Exception as stripe_err:
            # If Stripe detach fails, continue anyway (test PM or already deleted)
            print(f"⚠️ Stripe detach failed (continuing with DB deletion): {stripe_err}")
        
        # Delete from database - try multiple methods
        result = await db.payment_methods.delete_one({'id': method_id, 'user_id': current_user['id']})
        
        if result.deleted_count == 0:
            # Try with payment_method_id (for ACH methods)
            result = await db.payment_methods.delete_one({'payment_method_id': method_id, 'user_id': current_user['id']})
        
        if result.deleted_count == 0:
            # Try with _id
            try:
                from bson import ObjectId
                result = await db.payment_methods.delete_one({'_id': ObjectId(method_id), 'user_id': current_user['id']})
            except:
                pass
        
        print(f"✅ Deleted payment method {method_id} - deleted_count: {result.deleted_count}")
        
        return {'message': 'Payment method deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ACH BANK ACCOUNT PAYMENT METHODS
# ============================================================================

@payment_router.post('/payment-methods/ach/setup-intent')
async def create_ach_setup_intent(
    current_user: dict = Depends(get_current_user)
):
    """
    Create a SetupIntent for ACH bank account verification.
    This allows users to save their bank account for future payments.
    """
    try:
        stripe_service = get_stripe_service(db)
        
        # Get or create Stripe customer
        subscription = await db.subscriptions.find_one({'user_id': current_user['id']})
        
        if not subscription or not subscription.get('stripe_customer_id'):
            customer_id = await stripe_service.get_or_create_customer(
                current_user['id'],
                current_user['email'],
                current_user.get('name', '')
            )
        else:
            customer_id = subscription['stripe_customer_id']
        
        # Create SetupIntent for ACH
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=['us_bank_account'],
            payment_method_options={
                'us_bank_account': {
                    'verification_method': 'instant'  # Use Plaid for instant verification
                }
            }
        )
        
        return {
            'client_secret': setup_intent.client_secret,
            'setup_intent_id': setup_intent.id
        }
    except Exception as e:
        print(f"❌ Error creating ACH setup intent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@payment_router.post('/payment-methods/ach/confirm')
async def confirm_ach_payment_method(
    setup_intent_id: str,
    set_as_default: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm and save ACH payment method after SetupIntent is completed.
    Called after user completes bank verification.
    """
    try:
        # Retrieve SetupIntent to get payment method
        setup_intent = stripe.SetupIntent.retrieve(setup_intent_id)
        
        if setup_intent.status != 'succeeded':
            raise HTTPException(
                status_code=400,
                detail=f'SetupIntent not completed. Status: {setup_intent.status}'
            )
        
        payment_method_id = setup_intent.payment_method
        if not payment_method_id:
            raise HTTPException(status_code=400, detail='No payment method attached to SetupIntent')
        
        # Retrieve payment method details
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        
        if pm.type != 'us_bank_account':
            raise HTTPException(status_code=400, detail='Payment method is not a bank account')
        
        # Check for duplicate bank accounts (same last4)
        existing = await db.payment_methods.find_one({
            'user_id': current_user['id'],
            'type': 'us_bank_account',
            'last4': pm.us_bank_account.last4
        })
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f'Ya tienes una cuenta bancaria con terminación •••• {pm.us_bank_account.last4}'
            )
        
        # Set other methods as non-default if requested
        if set_as_default:
            await db.payment_methods.update_many(
                {'user_id': current_user['id']},
                {'$set': {'is_default': False}}
            )
        
        # Save payment method to database
        bank_account_method = {
            'id': str(uuid.uuid4()),
            'user_id': current_user['id'],
            'stripe_payment_method_id': pm.id,
            'type': 'us_bank_account',
            'last4': pm.us_bank_account.last4,
            'bank_name': pm.us_bank_account.bank_name,
            'account_holder_type': pm.us_bank_account.account_holder_type,
            'account_type': pm.us_bank_account.account_type,  # checking or savings
            'routing_number': pm.us_bank_account.routing_number,
            'is_default': set_as_default,
            'created_at': datetime.utcnow(),
            'verified_at': datetime.utcnow() if pm.us_bank_account.status_details.get('verified') else None
        }
        
        await db.payment_methods.insert_one(bank_account_method)
        
        print(f"✅ ACH payment method saved: {bank_account_method['id']}")
        
        # Remove internal fields before returning
        bank_account_method.pop('_id', None)
        
        return bank_account_method
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error confirming ACH payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# PAYMENT HISTORY ENDPOINTS
@payment_router.get('/history', response_model=List[PaymentHistory])
async def get_payment_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's payment history"""
    try:
        payments = await db.payment_history.find(
            {'user_id': current_user['id']}
        ).sort('created_at', -1).limit(limit).to_list(limit)
        
        return [PaymentHistory(**p) for p in payments]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/history/{payment_id}', response_model=PaymentHistory)
async def get_payment_detail(
    payment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific payment details"""
    try:
        payment = await db.payment_history.find_one({
            'id': payment_id,
            'user_id': current_user['id']
        })
        
        if not payment:
            raise HTTPException(status_code=404, detail='Payment not found')
        
        return PaymentHistory(**payment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ADMIN ENDPOINTS
@payment_router.get('/admin/payment-methods', response_model=List[dict])
async def get_all_payment_methods(current_user: dict = Depends(get_current_user)):
    """Get all payment methods from all users with enhanced details (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Get all payment methods
        methods = await db.payment_methods.find({}).to_list(1000)
        
        # Get Stripe service
        stripe_service = get_stripe_service(db)
        
        # Enrich with user data and Stripe details
        result = []
        for method in methods:
            user = await db.users.find_one({'_id': method['user_id']})
            
            # Convert ObjectId to string
            method_dict = dict(method)
            if '_id' in method_dict:
                method_dict['_id'] = str(method_dict['_id'])
            
            # Try to get additional data based on method type
            additional_data = {}
            
            if method.get('type') == 'bank_account':
                # Método de pago ACH/Bank Account
                additional_data['payment_type'] = 'ACH/Bank Transfer'
                additional_data['last4'] = method.get('bank_account_last4', '****')
                additional_data['account_type'] = method.get('bank_account_type', 'N/A')
                additional_data['account_holder'] = method.get('account_holder_name', 'N/A')
                additional_data['routing_number'] = method.get('routing_number', 'N/A')
                if method.get('ach_authorization_id'):
                    additional_data['ach_auth_id'] = method.get('ach_authorization_id')
            else:
                # Método de pago con tarjeta (Stripe)
                additional_data['payment_type'] = 'Card'
                try:
                    # Only fetch from Stripe if it's a real Stripe PM (not test)
                    stripe_pm_id = method.get('stripe_payment_method_id')
                    if stripe_pm_id and not stripe_pm_id.startswith('pm_test_'):
                        pm = stripe.PaymentMethod.retrieve(stripe_pm_id)
                        
                        # Extract additional billing details
                        if pm.billing_details:
                            additional_data['cardholder_name'] = pm.billing_details.get('name')
                            if pm.billing_details.address:
                                additional_data['country'] = pm.billing_details.address.get('country')
                        
                        # Card details
                        if pm.card:
                            additional_data['funding'] = pm.card.get('funding')  # credit, debit, prepaid
                            additional_data['country'] = additional_data.get('country') or pm.card.get('country')
                except Exception as stripe_err:
                    # If Stripe fetch fails, continue with basic data
                    pass
            
            result.append({
                **method_dict,
                **additional_data,
                'user_email': user.get('email') if user else 'N/A',
                'user_name': user.get('name') if user else 'N/A'
            })
        
        return result
    except Exception as e:
        print(f"❌ Error en el endpoint: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/admin/subscriptions', response_model=List[dict])
async def get_all_subscriptions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all subscriptions (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = {}
        if status:
            query['status'] = status
        
        subscriptions = await db.subscriptions.find(query).sort('created_at', -1).to_list(1000)
        
        # Enrich with user and plan data
        result = []
        for sub in subscriptions:
            user = await db.users.find_one({'_id': sub['user_id']})
            plan = await db.pricing_plans.find_one({'id': sub['plan_id']})
            
            result.append({
                **sub,
                'user_email': user.get('email') if user else 'N/A',
                'user_name': user.get('name') if user else 'N/A',
                'plan_name': plan.get('name') if plan else 'N/A'
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/admin/revenue-stats')
async def get_revenue_stats(current_user: dict = Depends(get_current_user)):
    """Get revenue statistics (admin only)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Active subscriptions count
        active_subs = await db.subscriptions.count_documents({
            'status': {'$in': ['active', 'trialing']}
        })
        
        # Total revenue this month
        from datetime import datetime
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        payments = await db.payment_history.find({
            'status': 'succeeded',
            'paid_at': {'$gte': month_start}
        }).to_list(10000)
        
        monthly_revenue = sum(p.get('amount', 0) for p in payments)
        
        # MRR (Monthly Recurring Revenue)
        active_subscriptions = await db.subscriptions.find({
            'status': {'$in': ['active', 'trialing']}
        }).to_list(10000)
        
        mrr = 0
        for sub in active_subscriptions:
            plan = await db.pricing_plans.find_one({'id': sub['plan_id']})
            if plan:
                # Convert to monthly
                if plan['interval'] == 'weekly':
                    mrr += plan['price'] * 4
                elif plan['interval'] == 'biweekly':
                    mrr += plan['price'] * 2
                elif plan['interval'] == 'monthly':
                    mrr += plan['price']
                elif plan['interval'] == 'yearly':
                    mrr += plan['price'] / 12
        
        return {
            'active_subscriptions': active_subs,
            'monthly_revenue': monthly_revenue,
            'mrr': round(mrr, 2),
            'month': month_start.strftime('%B %Y')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WEBHOOK ENDPOINT
@payment_router.post('/webhook')
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        # Get webhook secret from config
        config = await db.api_config.find_one({'_id': 'main'})
        webhook_secret = config.get('stripe_webhook_secret') if config else None
        
        if not webhook_secret:
            raise HTTPException(status_code=400, detail='Webhook secret not configured')
        
        # Verify webhook signature
        stripe_service = get_stripe_service(db)
        event = stripe_service.construct_webhook_event(payload, sig_header, webhook_secret)
        
        # Handle event
        if event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            await handle_subscription_updated(subscription)
        
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            await handle_subscription_deleted(subscription)
        
        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            await handle_payment_succeeded(invoice)
        
        elif event['type'] == 'invoice.payment_failed':
            invoice = event['data']['object']
            await handle_payment_failed(invoice)
        
        return {'status': 'success'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Webhook helper functions
async def handle_subscription_updated(subscription):
    """Handle subscription update webhook"""
    await db.subscriptions.update_one(
        {'stripe_subscription_id': subscription['id']},
        {'$set': {
            'status': subscription['status'],
            'current_period_start': datetime.fromtimestamp(subscription['current_period_start']),
            'current_period_end': datetime.fromtimestamp(subscription['current_period_end']),
            'cancel_at_period_end': subscription.get('cancel_at_period_end', False),
            'updated_at': datetime.utcnow()
        }}
    )

async def handle_subscription_deleted(subscription):
    """Handle subscription deletion webhook"""
    await db.subscriptions.update_one(
        {'stripe_subscription_id': subscription['id']},
        {'$set': {
            'status': SubscriptionStatus.CANCELED,
            'canceled_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }}
    )

async def handle_payment_succeeded(invoice):
    """Handle successful payment webhook"""
    subscription = await db.subscriptions.find_one({
        'stripe_subscription_id': invoice.get('subscription')
    })
    
    if subscription:
        payment = PaymentHistory(
            id=str(uuid.uuid4()),
            user_id=subscription['user_id'],
            subscription_id=subscription['id'],
            stripe_payment_intent_id=invoice.get('payment_intent'),
            stripe_invoice_id=invoice['id'],
            amount=invoice['amount_paid'] / 100,  # Convert from cents
            currency=invoice.get('currency', 'usd'),
            status=PaymentStatus.SUCCEEDED,
            description=f"Payment for subscription {subscription['plan_id']}",
            paid_at=datetime.utcnow()
        )
        
        await db.payment_history.insert_one(payment.dict())

async def handle_payment_failed(invoice):
    """Handle failed payment webhook"""
    subscription = await db.subscriptions.find_one({
        'stripe_subscription_id': invoice.get('subscription')
    })
    
    if subscription:
        payment = PaymentHistory(
            id=str(uuid.uuid4()),
            user_id=subscription['user_id'],
            subscription_id=subscription['id'],
            stripe_invoice_id=invoice['id'],
            amount=invoice['amount_due'] / 100,
            currency=invoice.get('currency', 'usd'),
            status=PaymentStatus.FAILED,
            description=f"Failed payment for subscription {subscription['plan_id']}",
            failed_at=datetime.utcnow(),
            failure_message=invoice.get('last_finalization_error', {}).get('message', 'Payment failed')
        )
        
        await db.payment_history.insert_one(payment.dict())
        
        # Update subscription status
        await db.subscriptions.update_one(
            {'id': subscription['id']},
            {'$set': {'status': SubscriptionStatus.PAST_DUE, 'updated_at': datetime.utcnow()}}
        )


# ============================================================================
# MANUAL PAYMENT METHODS ENDPOINTS (With Encryption)
# ============================================================================

@payment_router.post('/manual-payment-methods')
async def add_manual_payment_method(
    method_data: CreateManualPaymentMethodRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a manual payment method with full encrypted card data
    Requires user consent and stores data encrypted with AES-256
    """
    try:
        # Validate consent
        if not method_data.user_consent:
            raise HTTPException(
                status_code=400, 
                detail='User consent is required to store payment method data'
            )
        
        # Validate card number (basic validation)
        card_number = method_data.card_number.replace(' ', '').replace('-', '')
        if not card_number.isdigit() or len(card_number) < 13 or len(card_number) > 19:
            raise HTTPException(status_code=400, detail='Invalid card number')
        
        # Validate CVV
        if not method_data.cvv.isdigit() or len(method_data.cvv) < 3 or len(method_data.cvv) > 4:
            raise HTTPException(status_code=400, detail='Invalid CVV')
        
        # Detect card brand
        first_digit = card_number[0]
        if first_digit == '4':
            brand = 'visa'
        elif first_digit == '5':
            brand = 'mastercard'
        elif first_digit == '3':
            brand = 'amex'
        elif first_digit == '6':
            brand = 'discover'
        else:
            brand = 'unknown'
        
        # Get encryption service
        encryption_service = get_encryption_service()
        
        # Encrypt sensitive data
        encrypted_data = encryption_service.encrypt_card_data(card_number, method_data.cvv)
        
        # Create payment method
        payment_method = ManualPaymentMethod(
            id=str(uuid.uuid4()),
            user_id=current_user['id'],
            encrypted_card_number=encrypted_data['encrypted_card_number'],
            encrypted_cvv=encrypted_data['encrypted_cvv'],
            cardholder_name=method_data.cardholder_name,
            last4=encrypted_data['last4'],
            brand=brand,
            exp_month=method_data.exp_month,
            exp_year=method_data.exp_year,
            billing_address=method_data.billing_address,
            is_default=method_data.set_as_default,
            user_consent=True,
            consent_date=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            access_log=[]
        )
        
        # If set as default, unset other defaults
        if method_data.set_as_default:
            await db.manual_payment_methods.update_many(
                {'user_id': current_user['id']},
                {'$set': {'is_default': False}}
            )
        
        # Save to database
        await db.manual_payment_methods.insert_one(payment_method.dict())
        
        # Log the action
        print(f"✅ Manual payment method created for user {current_user['email']} - Last4: {encrypted_data['last4']}")
        
        # Return without sensitive data
        return {
            'id': payment_method.id,
            'last4': payment_method.last4,
            'brand': payment_method.brand,
            'cardholder_name': payment_method.cardholder_name,
            'exp_month': payment_method.exp_month,
            'exp_year': payment_method.exp_year,
            'is_default': payment_method.is_default,
            'message': 'Método de pago guardado de forma segura con encriptación AES-256'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating manual payment method: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/manual-payment-methods')
async def get_manual_payment_methods(current_user: dict = Depends(get_current_user)):
    """Get all manual payment methods for current user (without decryption)"""
    try:
        methods = await db.manual_payment_methods.find({'user_id': current_user['id']}).to_list(100)
        print(f"📋 MANUAL Payment methods found for user {current_user['email']}: {len(methods)}")
        for m in methods:
            print(f"  - ID: {m.get('id')} | Last4: {m.get('last4')}")
        
        # Return without sensitive data
        result = []
        for method in methods:
            result.append({
                'id': method['id'],
                'last4': method['last4'],
                'brand': method['brand'],
                'cardholder_name': method['cardholder_name'],
                'exp_month': method['exp_month'],
                'exp_year': method['exp_year'],
                'is_default': method['is_default'],
                'created_at': method['created_at'],
                'type': 'manual'  # To differentiate from Stripe methods
            })
        
        print(f"📤 Returning {len(result)} manual payment methods")
        return result
        
    except Exception as e:
        print(f"❌ Error fetching manual payment methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.delete('/manual-payment-methods/{method_id}')
async def delete_manual_payment_method(
    method_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a manual payment method"""
    try:
        # Find method
        method = await db.manual_payment_methods.find_one({
            'id': method_id,
            'user_id': current_user['id']
        })
        
        if not method:
            raise HTTPException(status_code=404, detail='Payment method not found')
        
        # Delete
        await db.manual_payment_methods.delete_one({'id': method_id})
        
        print(f"✅ Manual payment method deleted - ID: {method_id}")
        
        return {'message': 'Payment method deleted successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting manual payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.get('/admin/manual-payment-methods')
async def get_all_manual_payment_methods(current_user: dict = Depends(get_current_user)):
    """Get all manual payment methods from all users (admin only, without decryption)"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        methods = await db.manual_payment_methods.find({}).to_list(1000)
        
        # Enrich with user data
        result = []
        for method in methods:
            user = await db.users.find_one({'_id': method['user_id']})
            
            result.append({
                'id': method['id'],
                'user_id': method['user_id'],
                'user_email': user.get('email') if user else 'N/A',
                'user_name': user.get('name') if user else 'N/A',
                'last4': method['last4'],
                'brand': method['brand'],
                'cardholder_name': method['cardholder_name'],
                'exp_month': method['exp_month'],
                'exp_year': method['exp_year'],
                'billing_address': method.get('billing_address'),
                'is_default': method['is_default'],
                'created_at': method['created_at'],
                'consent_date': method.get('consent_date'),
                'type': 'manual',
                'encrypted': True  # Indicate data is encrypted
            })
        
        return result
        
    except Exception as e:
        print(f"❌ Error fetching all manual payment methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_router.post('/admin/manual-payment-methods/{method_id}/decrypt')
async def decrypt_manual_payment_method(
    method_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Decrypt and view full card data (admin only)
    This action is logged for security audit
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Find method
        method = await db.manual_payment_methods.find_one({'id': method_id})
        
        if not method:
            raise HTTPException(status_code=404, detail='Payment method not found')
        
        # Get encryption service
        encryption_service = get_encryption_service()
        
        # Decrypt data
        decrypted = encryption_service.decrypt_card_data(
            method['encrypted_card_number'],
            method['encrypted_cvv']
        )
        
        # Log the access
        access_log_entry = {
            'admin_id': current_user['id'],
            'admin_email': current_user['email'],
            'accessed_at': datetime.now(timezone.utc),
            'action': 'decrypt_view'
        }
        
        await db.manual_payment_methods.update_one(
            {'id': method_id},
            {
                '$set': {'last_accessed': datetime.now(timezone.utc)},
                '$push': {'access_log': access_log_entry}
            }
        )
        
        # Log to console
        print(f"🔓 SECURITY LOG: Admin {current_user['email']} accessed card data - Method ID: {method_id}")
        
        # Return decrypted data
        return {
            'id': method['id'],
            'user_id': method['user_id'],
            'card_number': decrypted['card_number'],
            'cvv': decrypted['cvv'],
            'cardholder_name': method['cardholder_name'],
            'last4': method['last4'],
            'brand': method['brand'],
            'exp_month': method['exp_month'],
            'exp_year': method['exp_year'],
            'billing_address': method.get('billing_address'),
            'is_default': method['is_default'],
            'created_at': method['created_at'],
            'warning': '⚠️ Datos sensibles desencriptados - Use responsablemente'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error decrypting payment method: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# ADMIN: Encrypted Card Data Management
# ========================================

@payment_router.get('/admin/encrypted-cards')
async def get_encrypted_cards(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all encrypted card data from BOTH legacy and NMI sources (Admin only)"""
    try:
        print(f"🔍 Admin encrypted cards request from: {current_user.get('email')}")
        print(f"   role: {current_user.get('role')}")
        print(f"   user_type: {current_user.get('user_type')}")
        print(f"   is_admin: {current_user.get('is_admin')}")
        
        # Verify admin - check BOTH role and user_type for compatibility
        is_admin = current_user.get('role') == 'admin' or current_user.get('user_type') == 'admin'
        
        if not is_admin:
            print(f"❌ Access denied - role is '{current_user.get('role')}' and user_type is '{current_user.get('user_type')}'")
            raise HTTPException(status_code=403, detail='Admin access required')
        
        print("✅ Admin verified, fetching encrypted cards...")
        result = []
        
        # === Source 1: Legacy encrypted_card_data collection ===
        legacy_cards = await db.encrypted_card_data.find({}).to_list(1000)
        for card in legacy_cards:
            name = card.get('user_name', '')
            email = card.get('user_email', '')
            if search and search.lower() not in f"{name}{email}{card.get('last4','')}".lower():
                continue
            result.append({
                'id': card['id'],
                'source': 'legacy',
                'user_name': name,
                'user_email': email,
                'last4': card.get('last4', '****'),
                'brand': card.get('brand', 'Unknown'),
                'exp_month': '',
                'exp_year': '',
                'cardholder_name': card.get('user_name', ''),
                'created_at': card.get('created_at', ''),
                'has_encrypted_data': True
            })
        
        # === Source 2: New NMI payment_methods collection ===
        from bson import ObjectId
        query = {'active': {'$ne': False}}
        nmi_cards = await db.payment_methods.find(query).sort('created_at', -1).to_list(500)
        for card in nmi_cards:
            user_info = {}
            if card.get('user_id'):
                try:
                    user = await db.users.find_one({'_id': ObjectId(card['user_id'])}) if ObjectId.is_valid(card['user_id']) else None
                    if not user:
                        user = await db.users.find_one({'id': card['user_id']})
                    if user:
                        user_info = {
                            'user_name': user.get('full_name', user.get('name', 'Sin nombre')),
                            'user_email': user.get('email', '')
                        }
                except:
                    pass
            
            name = user_info.get('user_name', card.get('cardholder_name', 'Sin nombre'))
            email = user_info.get('user_email', card.get('user_email', ''))
            if search and search.lower() not in f"{name}{email}{card.get('last4','')}".lower():
                continue
            
            result.append({
                'id': str(card['_id']),
                'source': 'nmi',
                'user_name': name,
                'user_email': email,
                'last4': card.get('last4', card.get('last_4', '****')),
                'brand': card.get('brand', card.get('card_brand', 'Unknown')),
                'exp_month': card.get('exp_month', ''),
                'exp_year': card.get('exp_year', ''),
                'cardholder_name': card.get('cardholder_name', ''),
                'created_at': card.get('created_at').isoformat() if card.get('created_at') else '',
                'has_encrypted_data': bool(card.get('encrypted_number'))
            })
        
        # Sort by created_at descending
        result.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        print(f"📊 Found {len(result)} encrypted cards (legacy: {len(legacy_cards)}, NMI: {len(nmi_cards)})")
        print(f"📤 Returning {len(result)} cards")
        return {'cards': result, 'count': len(result)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching encrypted cards: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@payment_router.post('/admin/encrypted-cards/{card_id}/decrypt')
async def decrypt_card_data(card_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Decrypt and return full card data (Admin only) - requires security PIN"""
    try:
        print(f"🔓 Decrypt request for card {card_id} from: {current_user.get('email')}")
        
        # Verify admin
        is_admin = current_user.get('role') == 'admin' or current_user.get('user_type') == 'admin'
        if not is_admin:
            raise HTTPException(status_code=403, detail='Admin access required')
        
        # Parse body for security_pin
        body = await request.json()
        security_pin = body.get('security_pin', '')
        
        if not security_pin:
            raise HTTPException(status_code=400, detail='Se requiere el PIN de seguridad')
        
        # Verify admin security PIN
        from passlib.context import CryptContext
        _pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
        
        admin_settings = await db.admin_security_settings.find_one({'admin_id': current_user.get('id')})
        if not admin_settings or not admin_settings.get('security_pin_hash'):
            admin_settings = await db.admin_security_settings.find_one({'type': 'global_pin'})
            if not admin_settings or not admin_settings.get('security_pin_hash'):
                raise HTTPException(status_code=403, detail="No has configurado tu PIN de seguridad. Ve a Configuración para establecerlo.")
        
        pin_valid = _pwd_ctx.verify(security_pin, admin_settings['security_pin_hash'])
        
        if not pin_valid:
            await db.security_audit.insert_one({
                'action': 'decrypt_card_FAILED_PIN',
                'card_id': card_id,
                'admin_id': current_user.get('id'),
                'admin_email': current_user.get('email'),
                'timestamp': datetime.now(timezone.utc),
            })
            raise HTTPException(status_code=403, detail="PIN de seguridad incorrecto")
        
        print("✅ Admin PIN verified for decryption")
        
        # Log successful access
        await db.security_audit.insert_one({
            'action': 'decrypt_card_SUCCESS',
            'card_id': card_id,
            'admin_id': current_user.get('id'),
            'admin_email': current_user.get('email'),
            'timestamp': datetime.now(timezone.utc),
        })
        
        encryption_service = get_encryption_service()
        
        # === Try legacy encrypted_card_data first ===
        card = await db.encrypted_card_data.find_one({'id': card_id})
        if card:
            print(f"📦 Found card in legacy encrypted_card_data")
            decrypted_data = {
                'id': card['id'],
                'source': 'legacy',
                'user_name': card.get('user_name', ''),
                'user_email': card.get('user_email', ''),
                'cardholder_name': encryption_service.decrypt(card['cardholder_name']) if card.get('cardholder_name') else '',
                'card_number': encryption_service.decrypt(card['card_number']) if card.get('card_number') else '',
                'exp_month': encryption_service.decrypt(card['exp_month']) if card.get('exp_month') else '',
                'exp_year': encryption_service.decrypt(card['exp_year']) if card.get('exp_year') else '',
                'cvv': encryption_service.decrypt(card['cvv']) if card.get('cvv') else '***',
                'last4': card.get('last4', '****'),
                'brand': card.get('brand', 'Unknown'),
                'created_at': card.get('created_at', ''),
            }
            print(f"⚠️  Admin {current_user['email']} decrypted LEGACY card for user {card.get('user_email')}")
            return decrypted_data
        
        # === Try NMI payment_methods collection ===
        from bson import ObjectId as ObjId
        nmi_card = None
        if ObjId.is_valid(card_id):
            nmi_card = await db.payment_methods.find_one({'_id': ObjId(card_id)})
        if not nmi_card:
            nmi_card = await db.payment_methods.find_one({'nmi_vault_id': card_id})
        if not nmi_card:
            nmi_card = await db.payment_methods.find_one({'_id': card_id})
        
        if nmi_card:
            print(f"📦 Found card in NMI payment_methods")
            card_number = f"****-****-****-{nmi_card.get('last4', '****')}"
            cvv = '***'
            
            if nmi_card.get('encrypted_number'):
                try:
                    card_number = encryption_service.decrypt(nmi_card['encrypted_number'])
                except Exception as dec_err:
                    print(f"⚠️ Decrypt error for number: {dec_err}")
            
            if nmi_card.get('encrypted_cvv'):
                try:
                    cvv = encryption_service.decrypt(nmi_card['encrypted_cvv'])
                except Exception as dec_err:
                    print(f"⚠️ Decrypt error for CVV: {dec_err}")
            
            # Get user info
            user_info = {'user_name': nmi_card.get('cardholder_name', ''), 'user_email': nmi_card.get('user_email', '')}
            if nmi_card.get('user_id'):
                try:
                    user = await db.users.find_one({'_id': ObjId(nmi_card['user_id'])}) if ObjId.is_valid(nmi_card['user_id']) else None
                    if user:
                        user_info['user_name'] = user.get('full_name', user.get('name', ''))
                        user_info['user_email'] = user.get('email', '')
                except:
                    pass
            
            decrypted_data = {
                'id': str(nmi_card['_id']),
                'source': 'nmi',
                'user_name': user_info['user_name'],
                'user_email': user_info['user_email'],
                'cardholder_name': nmi_card.get('cardholder_name', ''),
                'card_number': card_number,
                'exp_month': str(nmi_card.get('exp_month', '')),
                'exp_year': str(nmi_card.get('exp_year', '')),
                'cvv': cvv,
                'last4': nmi_card.get('last4', '****'),
                'brand': nmi_card.get('brand', nmi_card.get('card_brand', 'Unknown')),
                'nmi_vault_id': nmi_card.get('nmi_vault_id', ''),
                'created_at': nmi_card.get('created_at').isoformat() if nmi_card.get('created_at') else '',
            }
            print(f"⚠️  Admin {current_user['email']} decrypted NMI card ****{nmi_card.get('last4')}")
            return decrypted_data
        
        raise HTTPException(status_code=404, detail='Tarjeta no encontrada')
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error decrypting card data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@payment_router.delete('/admin/encrypted-cards/{card_id}')
async def delete_encrypted_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Delete encrypted card data (Admin only) - from both legacy and NMI sources"""
    try:
        # Verify admin
        is_admin = current_user.get('role') == 'admin' or current_user.get('user_type') == 'admin'
        if not is_admin:
            raise HTTPException(status_code=403, detail='Admin access required')
        
        # Try legacy collection first
        result = await db.encrypted_card_data.delete_one({'id': card_id})
        if result.deleted_count > 0:
            print(f"🗑️ Admin {current_user['email']} deleted LEGACY encrypted card {card_id}")
            return {'message': 'Tarjeta eliminada correctamente'}
        
        # Try NMI payment_methods collection
        from bson import ObjectId as ObjId
        if ObjId.is_valid(card_id):
            result = await db.payment_methods.update_one(
                {'_id': ObjId(card_id)},
                {'$set': {'active': False, 'deleted_at': datetime.now(timezone.utc)}}
            )
            if result.modified_count > 0:
                print(f"🗑️ Admin {current_user['email']} soft-deleted NMI card {card_id}")
                return {'message': 'Tarjeta eliminada correctamente'}
        
        raise HTTPException(status_code=404, detail='Tarjeta no encontrada')
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting encrypted card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

