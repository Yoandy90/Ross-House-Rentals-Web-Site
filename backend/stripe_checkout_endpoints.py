"""
Stripe Checkout Endpoints for Web Subscriptions
Handles Stripe Checkout sessions and webhooks for web-based subscription payments
"""
import stripe
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["Stripe Checkout"])

# Database dependency placeholder - will be set by main app
db: AsyncIOMotorDatabase = None

def set_database(database: AsyncIOMotorDatabase):
    """Set the database instance"""
    global db
    db = database
    logger.info("✅ Stripe Checkout endpoints: Database connected")

# Request/Response models
class CreateCheckoutSessionRequest(BaseModel):
    price_id: str
    user_email: Optional[str] = None
    user_id: Optional[str] = None
    success_url: str
    cancel_url: str

class WebhookResponse(BaseModel):
    received: bool

# Initialize Stripe
async def get_stripe_key():
    """Get Stripe API key from database or environment"""
    global db
    
    # First try environment variable
    stripe_key = os.getenv('STRIPE_SECRET_KEY')
    if stripe_key:
        return stripe_key
    
    # Then try Mi Caso USA app_config collection
    if db is not None:
        micaso_config = await db.app_config.find_one({'key': 'micasousa_settings'})
        if micaso_config and micaso_config.get('stripe_secret_key'):
            return micaso_config['stripe_secret_key']
    
    # Fallback: try legacy api_config collection
    if db is not None:
        config = await db.api_config.find_one({'_id': 'main'})
        if config and config.get('stripe_api_key'):
            return config['stripe_api_key']
        if config and config.get('stripe_secret_key'):
            return config['stripe_secret_key']
    
    return None

# Mi Caso USA Subscription plans configuration
SUBSCRIPTION_PLANS = {
    # Basic plans
    'basic_monthly': {
        'name': 'Plan Básico',
        'price': 99,  # $0.99 in cents
        'interval': 'month',
        'description': 'Hasta 3 casos (1 USCIS + 1 EOIR + 1 FOIA)'
    },
    'basic_yearly': {
        'name': 'Plan Básico Anual',
        'price': 999,  # $9.99 in cents
        'interval': 'year',
        'description': 'Hasta 3 casos — Ahorra 20% con el plan anual'
    },
    # Standard plans
    'standard_monthly': {
        'name': 'Plan Estándar',
        'price': 199,  # $1.99 in cents
        'interval': 'month',
        'description': 'Hasta 10 casos (4 USCIS + 3 EOIR + 3 FOIA) + Alertas push + IA Próximo Paso'
    },
    'standard_yearly': {
        'name': 'Plan Estándar Anual',
        'price': 1999,  # $19.99 in cents
        'interval': 'year',
        'description': 'Hasta 10 casos — Ahorra 20% con el plan anual'
    },
    # Premium plans
    'premium_monthly': {
        'name': 'Plan Premium',
        'price': 399,  # $3.99 in cents
        'interval': 'month',
        'description': 'Casos ilimitados + Soporte prioritario + Sin publicidad'
    },
    'premium_yearly': {
        'name': 'Plan Premium Anual',
        'price': 3999,  # $39.99 in cents
        'interval': 'year',
        'description': 'Casos ilimitados — Ahorra 20% con el plan anual'
    },
}

@router.post("/create-checkout-session")
async def create_checkout_session(request: CreateCheckoutSessionRequest):
    """
    Create a Stripe Checkout session for subscription purchase
    Returns checkout URL that redirects user to Stripe's hosted payment page
    """
    stripe_key = await get_stripe_key()
    
    if not stripe_key:
        raise HTTPException(
            status_code=500, 
            detail="Stripe no está configurado. Por favor configura la API key de Stripe."
        )
    
    stripe.api_key = stripe_key
    
    # Validate plan exists
    plan = SUBSCRIPTION_PLANS.get(request.price_id)
    if not plan:
        # Try to find in database
        if db is not None:
            db_plan = await db.subscription_plans.find_one({
                '$or': [
                    {'stripe_price_id': request.price_id},
                    {'_id': request.price_id}
                ]
            })
            if db_plan:
                plan = {
                    'name': db_plan.get('name', 'Subscription'),
                    'price': int(db_plan.get('price', 9.99) * 100),
                    'interval': db_plan.get('interval', 'month')
                }
    
    if not plan:
        raise HTTPException(status_code=400, detail="Plan de suscripción no válido")
    
    try:
        # Check if we have existing Stripe price or need to create inline
        checkout_params = {
            'mode': 'subscription',
            'success_url': request.success_url,
            'cancel_url': request.cancel_url,
            'allow_promotion_codes': True,
            'billing_address_collection': 'required',
            'metadata': {
                'user_id': request.user_id or '',
                'plan_id': request.price_id
            }
        }
        
        # Try to use existing Stripe price ID first
        try:
            # Check if this is a valid Stripe price ID
            if request.price_id.startswith('price_'):
                stripe.Price.retrieve(request.price_id)
                checkout_params['line_items'] = [{
                    'price': request.price_id,
                    'quantity': 1
                }]
            else:
                raise stripe.InvalidRequestError("Not a Stripe price ID", None)
        except stripe.InvalidRequestError:
            # Create price inline using price_data
            checkout_params['line_items'] = [{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan['name'],
                        'description': plan.get('description', ''),
                    },
                    'unit_amount': plan['price'],
                    'recurring': {
                        'interval': plan['interval']
                    }
                },
                'quantity': 1
            }]
        
        # Add customer email if provided
        if request.user_email:
            checkout_params['customer_email'] = request.user_email
        
        # Create checkout session
        session = stripe.checkout.Session.create(**checkout_params)
        
        logger.info(f"✅ Stripe Checkout session created: {session.id}")
        
        return {
            'session_id': session.id,
            'checkout_url': session.url
        }
        
    except stripe.StripeError as e:
        logger.error(f"❌ Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error de Stripe: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error inesperado: {str(e)}")

@router.get("/verify-session")
async def verify_session(session_id: str):
    """
    Verify a checkout session was successful
    """
    stripe_key = await get_stripe_key()
    
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe no está configurado")
    
    stripe.api_key = stripe_key
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        return {
            'verified': True,
            'success': session.payment_status == 'paid',
            'status': session.status,
            'payment_status': session.payment_status,
            'customer_email': session.customer_details.email if session.customer_details else None,
            'subscription_id': session.subscription
        }
        
    except stripe.StripeError as e:
        logger.error(f"❌ Stripe error verifying session: {str(e)}")
        return {
            'verified': False,
            'success': False,
            'error': str(e)
        }

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events for subscription lifecycle
    """
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    
    if not webhook_secret:
        # Try to get from database
        if db is not None:
            config = await db.api_config.find_one({'_id': 'main'})
            if config:
                webhook_secret = config.get('stripe_webhook_secret')
    
    stripe_key = await get_stripe_key()
    if stripe_key:
        stripe.api_key = stripe_key
    
    try:
        if webhook_secret and sig_header:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        else:
            # For testing without webhook signature verification
            import json
            event = json.loads(payload)
            logger.warning("⚠️ Webhook signature not verified - testing mode")
        
        event_type = event.get('type', event.get('event_type', ''))
        logger.info(f"📥 Stripe webhook received: {event_type}")
        
        # Handle different event types
        if event_type == 'checkout.session.completed':
            await handle_checkout_completed(event['data']['object'])
        
        elif event_type == 'customer.subscription.created':
            await handle_subscription_created(event['data']['object'])
        
        elif event_type == 'customer.subscription.updated':
            await handle_subscription_updated(event['data']['object'])
        
        elif event_type == 'customer.subscription.deleted':
            await handle_subscription_deleted(event['data']['object'])
        
        elif event_type == 'invoice.payment_succeeded':
            await handle_payment_succeeded(event['data']['object'])
        
        elif event_type == 'invoice.payment_failed':
            await handle_payment_failed(event['data']['object'])
        
        return {'received': True}
        
    except ValueError as e:
        logger.error(f"❌ Invalid payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        logger.error(f"❌ Invalid signature: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"❌ Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Webhook event handlers
async def handle_checkout_completed(session):
    """Handle successful checkout completion"""
    global db
    
    logger.info(f"✅ Checkout completed: {session.get('id')}")
    
    if db is None:
        return
    
    try:
        user_id = session.get('metadata', {}).get('user_id')
        plan_id = session.get('metadata', {}).get('plan_id', '')
        customer_email = session.get('customer_details', {}).get('email') if session.get('customer_details') else session.get('customer_email')
        subscription_id = session.get('subscription')
        customer_id = session.get('customer')
        
        # Determine plan tier from plan_id
        plan_tier = 'basic'
        if 'premium' in plan_id:
            plan_tier = 'premium'
        elif 'standard' in plan_id:
            plan_tier = 'standard'
        
        is_yearly = 'yearly' in plan_id
        
        # Try to find user by email in immigration_users first (Mi Caso USA)
        immigration_user = None
        if customer_email:
            immigration_user = await db.immigration_users.find_one({'email': customer_email})
        
        if immigration_user:
            # Update Mi Caso USA user subscription
            await db.immigration_users.update_one(
                {'_id': immigration_user['_id']},
                {
                    '$set': {
                        'stripe_customer_id': customer_id,
                        'stripe_subscription_id': subscription_id,
                        'subscription_status': 'active',
                        'subscription_plan': plan_tier,
                        'subscription_interval': 'year' if is_yearly else 'month',
                        'subscription_source': 'stripe_web',
                        'subscription_updated_at': datetime.utcnow()
                    }
                }
            )
            logger.info(f"✅ Mi Caso USA user {customer_email} subscription activated: {plan_tier}")
        elif user_id:
            # Fallback: Update by user_id in generic users collection
            await db.users.update_one(
                {'_id': user_id},
                {
                    '$set': {
                        'stripe_customer_id': customer_id,
                        'stripe_subscription_id': subscription_id,
                        'subscription_status': 'active',
                        'subscription_plan': plan_tier,
                        'subscription_interval': 'year' if is_yearly else 'month',
                        'subscription_source': 'stripe_web',
                        'subscription_updated_at': datetime.utcnow()
                    }
                }
            )
            logger.info(f"✅ User {user_id} subscription activated: {plan_tier}")
        
        # Store webhook event
        await db.webhook_events.insert_one({
            'event_type': 'checkout.session.completed',
            'session_id': session.get('id'),
            'customer_id': customer_id,
            'subscription_id': subscription_id,
            'user_id': user_id,
            'email': customer_email,
            'plan_id': plan_id,
            'plan_tier': plan_tier,
            'processed': True,
            'created_at': datetime.utcnow()
        })
        
    except Exception as e:
        logger.error(f"❌ Error handling checkout completed: {str(e)}")

async def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    global db
    
    logger.info(f"✅ Subscription created: {subscription.get('id')}")
    
    if db is None:
        return
    
    try:
        await db.webhook_events.insert_one({
            'event_type': 'customer.subscription.created',
            'subscription_id': subscription.get('id'),
            'customer_id': subscription.get('customer'),
            'status': subscription.get('status'),
            'processed': True,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.error(f"❌ Error handling subscription created: {str(e)}")

async def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    global db
    
    logger.info(f"📝 Subscription updated: {subscription.get('id')}")
    
    if db is None:
        return
    
    try:
        # Update user subscription status
        await db.users.update_one(
            {'stripe_subscription_id': subscription.get('id')},
            {
                '$set': {
                    'subscription_status': subscription.get('status'),
                    'subscription_updated_at': datetime.utcnow()
                }
            }
        )
        
        await db.webhook_events.insert_one({
            'event_type': 'customer.subscription.updated',
            'subscription_id': subscription.get('id'),
            'customer_id': subscription.get('customer'),
            'status': subscription.get('status'),
            'processed': True,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.error(f"❌ Error handling subscription updated: {str(e)}")

async def handle_subscription_deleted(subscription):
    """Handle subscription cancellation"""
    global db
    
    logger.info(f"❌ Subscription deleted: {subscription.get('id')}")
    
    if db is None:
        return
    
    try:
        # Update user subscription status
        await db.users.update_one(
            {'stripe_subscription_id': subscription.get('id')},
            {
                '$set': {
                    'subscription_status': 'canceled',
                    'subscription_updated_at': datetime.utcnow()
                }
            }
        )
        
        await db.webhook_events.insert_one({
            'event_type': 'customer.subscription.deleted',
            'subscription_id': subscription.get('id'),
            'customer_id': subscription.get('customer'),
            'status': 'canceled',
            'processed': True,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.error(f"❌ Error handling subscription deleted: {str(e)}")

async def handle_payment_succeeded(invoice):
    """Handle successful payment"""
    global db
    
    logger.info(f"💰 Payment succeeded: {invoice.get('id')}")
    
    if db is None:
        return
    
    try:
        await db.webhook_events.insert_one({
            'event_type': 'invoice.payment_succeeded',
            'invoice_id': invoice.get('id'),
            'customer_id': invoice.get('customer'),
            'subscription_id': invoice.get('subscription'),
            'amount_paid': invoice.get('amount_paid'),
            'processed': True,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.error(f"❌ Error handling payment succeeded: {str(e)}")

async def handle_payment_failed(invoice):
    """Handle failed payment"""
    global db
    
    logger.info(f"⚠️ Payment failed: {invoice.get('id')}")
    
    if db is None:
        return
    
    try:
        # Update user subscription status
        await db.users.update_one(
            {'stripe_subscription_id': invoice.get('subscription')},
            {
                '$set': {
                    'subscription_status': 'past_due',
                    'subscription_updated_at': datetime.utcnow()
                }
            }
        )
        
        await db.webhook_events.insert_one({
            'event_type': 'invoice.payment_failed',
            'invoice_id': invoice.get('id'),
            'customer_id': invoice.get('customer'),
            'subscription_id': invoice.get('subscription'),
            'processed': True,
            'created_at': datetime.utcnow()
        })
    except Exception as e:
        logger.error(f"❌ Error handling payment failed: {str(e)}")

@router.get("/subscription-plans")
async def get_subscription_plans():
    """
    Get available subscription plans for the web (Mi Caso USA)
    """
    global db
    
    # First try to get from database
    if db is not None:
        plans = await db.subscription_plans.find({'is_active': True}).to_list(100)
        if plans:
            return {
                'plans': [
                    {
                        'id': str(plan.get('_id')),
                        'name': plan.get('name'),
                        'price': plan.get('price'),
                        'interval': plan.get('interval', 'month'),
                        'description': plan.get('description', ''),
                        'features': plan.get('features', []),
                        'stripe_price_id': plan.get('stripe_price_id')
                    }
                    for plan in plans
                ]
            }
    
    # Fallback to Mi Caso USA plans
    return {
        'plans': [
            {
                'id': 'basic_monthly',
                'name': 'Plan Básico',
                'price': 0.99,
                'interval': 'month',
                'description': 'Hasta 3 casos (1 USCIS + 1 EOIR + 1 FOIA)',
                'features': [
                    'Seguimiento de hasta 3 casos',
                    'Consultas USCIS y EOIR',
                    'Historial de cambios',
                    'Soporte por email'
                ],
                'stripe_price_id': 'basic_monthly'
            },
            {
                'id': 'basic_yearly',
                'name': 'Plan Básico Anual',
                'price': 9.99,
                'interval': 'year',
                'description': 'Hasta 3 casos — Ahorra 20%',
                'features': [
                    'Seguimiento de hasta 3 casos',
                    'Consultas USCIS y EOIR',
                    'Historial de cambios',
                    'Soporte por email',
                    '2 meses GRATIS'
                ],
                'stripe_price_id': 'basic_yearly'
            },
            {
                'id': 'standard_monthly',
                'name': 'Plan Estándar',
                'price': 1.99,
                'interval': 'month',
                'description': 'Hasta 10 casos + Alertas push + IA',
                'features': [
                    'Seguimiento de hasta 10 casos',
                    'Alertas push instantáneas',
                    'IA Próximo Paso',
                    'Modo descanso nocturno',
                    'Sin límite de consultas'
                ],
                'stripe_price_id': 'standard_monthly'
            },
            {
                'id': 'standard_yearly',
                'name': 'Plan Estándar Anual',
                'price': 19.99,
                'interval': 'year',
                'description': 'Hasta 10 casos — Ahorra 20%',
                'features': [
                    'Seguimiento de hasta 10 casos',
                    'Alertas push instantáneas',
                    'IA Próximo Paso',
                    'Modo descanso nocturno',
                    'Sin límite de consultas',
                    '2 meses GRATIS'
                ],
                'stripe_price_id': 'standard_yearly'
            },
            {
                'id': 'premium_monthly',
                'name': 'Plan Premium',
                'price': 3.99,
                'interval': 'month',
                'description': 'Casos ilimitados + Soporte prioritario',
                'features': [
                    'Casos ilimitados',
                    'Soporte prioritario 24/7',
                    'Sin publicidad',
                    'Acceso anticipado a nuevas funciones',
                    'Chat IA premium',
                    'Todas las funciones incluidas'
                ],
                'stripe_price_id': 'premium_monthly'
            },
            {
                'id': 'premium_yearly',
                'name': 'Plan Premium Anual',
                'price': 39.99,
                'interval': 'year',
                'description': 'Casos ilimitados — Ahorra 20%',
                'features': [
                    'Casos ilimitados',
                    'Soporte prioritario 24/7',
                    'Sin publicidad',
                    'Acceso anticipado a nuevas funciones',
                    'Chat IA premium',
                    'Todas las funciones incluidas',
                    '2 meses GRATIS'
                ],
                'stripe_price_id': 'premium_yearly'
            }
        ]
    }

@router.get("/config")
async def get_stripe_config():
    """
    Get Stripe configuration status (for admin panel)
    """
    global db
    
    config = {}
    if db is not None:
        stored = await db.api_config.find_one({'_id': 'main'})
        if stored:
            config = {
                'stripe_publishable_key': stored.get('stripe_publishable_key', ''),
                'stripe_secret_key_last4': stored.get('stripe_secret_key', '')[-4:] if stored.get('stripe_secret_key') else '',
                'stripe_webhook_secret_last4': stored.get('stripe_webhook_secret', '')[-4:] if stored.get('stripe_webhook_secret') else '',
                'has_stripe_key': bool(stored.get('stripe_secret_key') or stored.get('stripe_api_key')),
                'has_webhook_secret': bool(stored.get('stripe_webhook_secret')),
            }
    
    # Also check env
    env_key = os.getenv('STRIPE_SECRET_KEY')
    if env_key:
        config['has_stripe_key'] = True
        config['stripe_secret_key_last4'] = env_key[-4:]
    
    return {'success': True, 'config': config}

@router.put("/config")
async def update_stripe_config(request: Request):
    """
    Update Stripe configuration (from admin panel)
    """
    global db
    
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    body = await request.json()
    
    update_fields = {}
    if body.get('stripe_publishable_key'):
        update_fields['stripe_publishable_key'] = body['stripe_publishable_key']
    if body.get('stripe_secret_key'):
        update_fields['stripe_secret_key'] = body['stripe_secret_key']
    if body.get('stripe_webhook_secret'):
        update_fields['stripe_webhook_secret'] = body['stripe_webhook_secret']
    
    if update_fields:
        update_fields['stripe_updated_at'] = datetime.utcnow().isoformat()
        await db.api_config.update_one(
            {'_id': 'main'},
            {'$set': update_fields},
            upsert=True
        )
        logger.info("✅ Stripe config updated from admin panel")
    
    return {'success': True, 'message': 'Configuración de Stripe actualizada'}

@router.get("/user-subscription/{user_id}")
async def get_user_subscription(user_id: str):
    """
    Get user's current subscription status
    """
    global db
    
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    user = await db.users.find_one({'_id': user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {
        'subscription_id': user.get('stripe_subscription_id'),
        'status': user.get('subscription_status', 'inactive'),
        'customer_id': user.get('stripe_customer_id'),
        'updated_at': user.get('subscription_updated_at')
    }
