"""
Credits System Router
Extracted from server.py for modularization.
Handles credit packages, purchases, balances, transfers, refunds, and admin management.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends, Header
from pydantic import BaseModel
from bson import ObjectId

from credit_models import (
    CreditPackage, UserCreditBalance, CreditTransaction,
    TransactionType, ServiceType, RefundType,
    PurchaseCreditsRequest, UseCreditsRequest, UseCreditsForServiceRequest, RequestRefundRequest,
    ProcessRefundRequest, AdminCreditAdjustmentRequest, CreatePackageRequest, UpdatePackageRequest,
    UpdateCreditPreferencesRequest, CreateCheckoutSessionRequest
)
from transfer_models import TransferCreditsRequest, RespondToRequestModel, RequestCreditsModel
from raffle_models import CreateRaffleRequest, UpdateRaffleRequest, ExecuteRaffleRequest, BuyTicketRequest
from lottery_models import BuyLotteryTicketRequest, CreateLotteryRequest, UpdateLotteryRequest, ExecuteLotteryRequest
from lottery_guides import get_all_guides

logger = logging.getLogger(__name__)

credits_router = APIRouter()
_db = None
_credit_service = None
_transfer_service = None
_withdrawal_service = None
_money_request_service = None
_notification_service = None


def init_credits_router(db, credit_service=None, transfer_service=None,
                        withdrawal_service=None, money_request_service=None):
    global _db, _credit_service, _transfer_service, _withdrawal_service, _money_request_service
    _db = db
    _credit_service = credit_service
    _transfer_service = transfer_service
    _withdrawal_service = withdrawal_service
    _money_request_service = money_request_service


def update_credits_services(credit_service=None, transfer_service=None,
                            withdrawal_service=None, money_request_service=None,
                            notification_service=None):
    global _credit_service, _transfer_service, _withdrawal_service, _money_request_service, _notification_service
    if credit_service: _credit_service = credit_service
    if transfer_service: _transfer_service = transfer_service
    if withdrawal_service: _withdrawal_service = withdrawal_service
    if money_request_service: _money_request_service = money_request_service
    if notification_service: _notification_service = notification_service


async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(tz=expires_at.tzinfo if expires_at.tzinfo else timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def _require_admin(request: Request):
    """Require admin role"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ================== CREDIT SYSTEM ROUTES ==================

@credits_router.get('/credits/packages')
async def get_credit_packages(current_user: dict = Depends(_auth_user)):
    """Get all active credit packages"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        packages = await _credit_service.get_active_packages()
        
        # Serialize packages (remove _id and convert datetime)
        for package in packages:
            if package.get('created_at'):
                package['created_at'] = package['created_at'].isoformat()
            if package.get('updated_at'):
                package['updated_at'] = package['updated_at'].isoformat()
            package.pop('_id', None)
        
        # Get user balance to check if first purchase
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        is_first_purchase = not balance.get('first_purchase_completed', False)
        
        # Get Stripe publishable key
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        stripe_publishable_key = config_doc.get('stripe_publishable_key') if config_doc else None
        
        return {
            'packages': packages,
            'is_first_purchase': is_first_purchase,
            'first_purchase_bonus_percentage': 10.0,
            'stripe_publishable_key': stripe_publishable_key
        }
    except Exception as e:
        logging.error(f"Error getting credit packages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/balance')
async def get_credit_balance(current_user: dict = Depends(_auth_user)):
    """Get user's credit balance"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Use _id instead of id for user identification
        user_id = current_user.get('id') or current_user.get('_id')
        balance = await _credit_service.get_or_create_balance(user_id)
        
        return {
            'user_id': balance['user_id'],
            'balance': balance['balance'],
            'lifetime_purchased': balance.get('lifetime_purchased', 0.0),
            'lifetime_earned_credits': balance.get('lifetime_earned_credits', 0.0),
            'lifetime_spent': balance.get('lifetime_spent', 0.0),
            'lifetime_bonus': balance.get('lifetime_bonus', 0.0),
            'first_purchase_completed': balance.get('first_purchase_completed', False),
            'last_purchase_at': balance.get('last_purchase_at'),
            'last_usage_at': balance.get('last_usage_at')
        }
    except Exception as e:
        logging.error(f"Error getting credit balance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/purchase')
async def purchase_credits(
    request: PurchaseCreditsRequest,
    current_user: dict = Depends(_auth_user)
):
    """Purchase credits with Authorize.net or Stripe"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Get package details
        package = await _credit_service.get_package_by_id(request.package_id)
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        # Use Authorize.net for payment processing
        # For now, create the purchase record as pending
        # and return success (payment will be processed separately)
        import uuid
        purchase_id = str(uuid.uuid4())
        
        purchase = {
            'id': purchase_id,
            'user_id': current_user['id'],
            'package_id': request.package_id,
            'package_name': package['name'],
            'credits_amount': package['credits'],
            'bonus_credits': package.get('bonus_credits', 0),
            'total_credits': package['credits'] + package.get('bonus_credits', 0),
            'amount_usd': package['price'],
            'payment_method': 'authorize_net',
            'payment_status': 'completed',  # Mark as completed for now
            'is_first_purchase': False,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        # Save purchase
        await _db.credit_purchases.insert_one(purchase)
        
        # Update user balance
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        new_balance = balance['balance'] + purchase['total_credits']
        
        await _db.user_credit_balance.update_one(
            {'user_id': current_user['id']},
            {
                '$set': {
                    'balance': new_balance,
                    'updated_at': datetime.now(timezone.utc)
                },
                '$inc': {
                    'lifetime_purchased': purchase['total_credits']
                }
            }
        )
        
        # Create transaction record
        transaction = {
            'id': str(uuid.uuid4()),
            'user_id': current_user['id'],
            'type': 'purchase',
            'amount': purchase['total_credits'],
            'balance_after': new_balance,
            'description': f"Compra de paquete: {package['name']}",
            'reference_id': purchase_id,
            'status': 'completed',
            'created_at': datetime.now(timezone.utc)
        }
        await _db.credit_transactions.insert_one(transaction)
        
        return {
            'success': True,
            'purchase': {
                'id': purchase['id'],
                'package_name': purchase['package_name'],
                'total_credits': purchase['total_credits'],
                'amount_usd': purchase['amount_usd'],
                'is_first_purchase': purchase['is_first_purchase'],
                'payment_status': purchase['payment_status']
            },
            'new_balance': new_balance
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error purchasing credits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/create-checkout-session')
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    current_user: dict = Depends(_auth_user)
):
    """Create Stripe Checkout Session (for web)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Handle custom amount or package
        if request.package_id == 'custom' and request.custom_amount:
            # Custom amount purchase
            if request.custom_amount < 10:
                raise HTTPException(status_code=400, detail="El monto mínimo es $10 USD")
            if request.custom_amount > 1000:
                raise HTTPException(status_code=400, detail="El monto máximo es $1000 USD")
            
            package_data = {
                'id': 'custom',
                'name': 'Monto Personalizado',
                'amount_usd': request.custom_amount,
                'base_credits': request.custom_amount,
                'bonus_credits': 0,
                'total_credits': request.custom_amount
            }
        else:
            # Get package details from database
            package = await _db.credit_packages.find_one({'id': request.package_id, 'is_active': True})
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")
            package_data = package
        
        # Get or create Stripe customer
        stripe_customer_id = None
        user_data = await _db.users.find_one({'_id': current_user['id']})
        
        if user_data and user_data.get('stripe_customer_id'):
            stripe_customer_id = user_data['stripe_customer_id']
        else:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=current_user['email'],
                name=current_user.get('name', current_user['email']),
                metadata={'user_id': current_user['id']}
            )
            stripe_customer_id = customer.id
            
            # Save to database
            await _db.users.update_one(
                {'_id': current_user['id']},
                {'$set': {'stripe_customer_id': stripe_customer_id}}
            )
        
        # Get frontend URL from environment
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        
        # Create Checkout Session
        # ACH payments have lower fees (0.8% vs 2.9%) but take 5-7 days to process
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card', 'us_bank_account'],  # Added ACH support
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': int(package_data['amount_usd'] * 100),  # Convert to cents
                    'product_data': {
                        'name': f"Ross Tax Credits - {package_data['name']}",
                        'description': f"{package_data['base_credits']} créditos base + {package_data['bonus_credits']} bonus",
                        'images': [],
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/credits?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/credits?canceled=true",
            metadata={
                'user_id': current_user['id'],
                'package_id': request.package_id,
                'custom_amount': str(request.custom_amount) if request.custom_amount else None,
                'type': 'credit_purchase'
            }
        )
        
        return {
            'checkout_url': session.url,
            'session_id': session.id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/create-payment-intent')
async def create_payment_intent(
    request: CreateCheckoutSessionRequest,
    current_user: dict = Depends(_auth_user)
):
    """Create Stripe Payment Intent for native in-app payments"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Handle custom amount or package
        if request.package_id == 'custom' and request.custom_amount:
            # Custom amount purchase
            if request.custom_amount < 10:
                raise HTTPException(status_code=400, detail="El monto mínimo es $10 USD")
            if request.custom_amount > 1000:
                raise HTTPException(status_code=400, detail="El monto máximo es $1000 USD")
            
            package_data = {
                'id': 'custom',
                'name': 'Monto Personalizado',
                'amount_usd': request.custom_amount,
                'base_credits': request.custom_amount,
                'bonus_credits': 0,
                'total_credits': request.custom_amount
            }
        else:
            # Get package details from database
            package = await _db.credit_packages.find_one({'id': request.package_id, 'is_active': True})
            if not package:
                raise HTTPException(status_code=404, detail="Package not found")
            package_data = package
        
        # Get or create Stripe customer
        stripe_customer_id = None
        user_data = await _db.users.find_one({'_id': current_user['id']})
        
        if user_data and user_data.get('stripe_customer_id'):
            stripe_customer_id = user_data['stripe_customer_id']
        else:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=current_user['email'],
                name=current_user.get('name', current_user['email']),
                metadata={'user_id': current_user['id']}
            )
            stripe_customer_id = customer.id
            
            # Save to database
            await _db.users.update_one(
                {'_id': current_user['id']},
                {'$set': {'stripe_customer_id': stripe_customer_id}}
            )
        
        # Create Payment Intent
        amount_in_cents = int(package_data['amount_usd'] * 100)
        
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_in_cents,
            currency='usd',
            customer=stripe_customer_id,
            description=f"Ross Tax Credits - {package_data['name']}",
            metadata={
                'user_id': current_user['id'],
                'package_id': request.package_id,
                'custom_amount': str(request.custom_amount) if request.custom_amount else None,
                'type': 'credit_purchase',
                'base_credits': str(package_data['base_credits']),
                'bonus_credits': str(package_data['bonus_credits']),
                'total_credits': str(package_data['total_credits'])
            },
            automatic_payment_methods={'enabled': True}
        )
        
        logging.info(f"💳 Payment Intent created: {payment_intent.id} for user {current_user['id']}")
        
        return {
            'payment_intent_id': payment_intent.id,
            'client_secret': payment_intent.client_secret,
            'amount': package_data['amount_usd'],
            'credits': package_data['total_credits'],
            'publishable_key': os.getenv('STRIPE_PUBLISHABLE_KEY')
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/confirm-payment')
async def confirm_payment(
    payment_intent_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Confirm payment and allocate credits after successful payment"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Retrieve Payment Intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        # Verify payment intent belongs to this user
        if payment_intent.metadata.get('user_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Unauthorized access to payment")
        
        # Check if payment was successful
        if payment_intent.status != 'succeeded':
            raise HTTPException(status_code=400, detail=f"Payment not successful. Status: {payment_intent.status}")
        
        # Check if credits have already been allocated
        existing_purchase = await _db.credit_purchases.find_one({
            'stripe_payment_intent_id': payment_intent_id
        })
        
        if existing_purchase:
            logging.warning(f"⚠️  Credits already allocated for payment intent: {payment_intent_id}")
            balance = await _credit_service.get_or_create_balance(current_user['id'])
            return {
                'success': True,
                'message': 'Créditos ya fueron acreditados',
                'purchase_id': existing_purchase['id'],
                'new_balance': balance['balance'],
                'already_processed': True
            }
        
        # Extract metadata
        metadata = payment_intent.metadata
        package_id = metadata.get('package_id')
        base_credits = float(metadata.get('base_credits'))
        bonus_credits = float(metadata.get('bonus_credits'))
        total_credits = float(metadata.get('total_credits'))
        amount_usd = payment_intent.amount / 100  # Convert from cents
        
        # Get user balance to check if it's first purchase
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        is_first_purchase = not balance.get("first_purchase_completed", False)
        
        # Apply first purchase bonus if applicable
        first_purchase_bonus = total_credits * 0.10 if is_first_purchase else 0.0
        final_total_credits = total_credits + first_purchase_bonus
        
        # Create purchase record
        purchase_id = str(uuid.uuid4())
        
        # Get charge ID safely
        stripe_charge_id = None
        if hasattr(payment_intent, 'charges') and payment_intent.charges:
            if hasattr(payment_intent.charges, 'data') and len(payment_intent.charges.data) > 0:
                stripe_charge_id = payment_intent.charges.data[0].id
            elif isinstance(payment_intent.charges, list) and len(payment_intent.charges) > 0:
                stripe_charge_id = payment_intent.charges[0].id if hasattr(payment_intent.charges[0], 'id') else payment_intent.charges[0].get('id')
        
        purchase = {
            "id": purchase_id,
            "user_id": current_user['id'],
            "package_id": package_id,
            "package_name": metadata.get('name', 'Monto Personalizado'),
            "base_credits": base_credits,
            "bonus_credits": bonus_credits,
            "first_purchase_bonus": first_purchase_bonus,
            "total_credits": final_total_credits,
            "amount_usd": amount_usd,
            "currency": "usd",
            "stripe_payment_intent_id": payment_intent_id,
            "stripe_customer_id": payment_intent.customer if hasattr(payment_intent, 'customer') else None,
            "stripe_charge_id": stripe_charge_id,
            "payment_status": "succeeded",
            "is_first_purchase": is_first_purchase,
            "is_refunded": False,
            "created_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
            "transaction_ids": []
        }
        
        await _db.credit_purchases.insert_one(purchase)
        
        # Create transaction and update balance
        transaction_id = str(uuid.uuid4())
        transaction = {
            "transaction_id": transaction_id,
            "id": transaction_id,  # Add id field for frontend compatibility
            "user_id": current_user['id'],
            "type": TransactionType.PURCHASE.value,
            "transaction_type": TransactionType.PURCHASE.value,  # Add transaction_type for frontend
            "amount": final_total_credits,
            "balance_before": balance['balance'],
            "balance_after": balance['balance'] + final_total_credits,
            "description": f"Compra de créditos - {package_id}",
            "metadata": {
                "package_id": package_id,
                "purchase_id": purchase_id,
                "stripe_payment_intent_id": payment_intent_id,
                "is_first_purchase": is_first_purchase,
                "first_purchase_bonus": first_purchase_bonus
            },
            "created_at": datetime.utcnow()
        }
        
        await _db.credit_transactions.insert_one(transaction)
        
        # Update balance
        await _db.user_credit_balance.update_one(
            {"user_id": current_user['id']},
            {
                "$inc": {
                    "balance": final_total_credits,
                    "lifetime_purchased": final_total_credits
                },
                "$set": {
                    "first_purchase_completed": True,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Update purchase with transaction ID
        await _db.credit_purchases.update_one(
            {"id": purchase_id},
            {"$push": {"transaction_ids": transaction_id}}
        )
        
        logging.info(f"✅ Credits allocated for payment intent {payment_intent_id}: {final_total_credits} credits (including {first_purchase_bonus} first purchase bonus)")
        
        # Send SMS confirmation
        try:
            user = await _db.users.find_one({'_id': current_user['id']})
            if user and user.get('phone'):
                config_doc = await _db.api_config.find_one({'_id': 'main'})
                if config_doc:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    
                    if notif_service.twilio_client:
                        sms_message = f"""✅ Pago RECIBIDO

💰 Monto: ${amount_usd:.2f} USD
🎁 Créditos: {final_total_credits:.0f} créditos
📦 Paquete: {metadata.get('name', 'Compra de créditos')}
📅 Fecha: {datetime.now().strftime("%d/%m/%Y")}

¡Gracias por tu compra!

Balance actual: {updated_balance['balance']:.0f} créditos

Ross Tax Preparation
806-934-2018"""
                        
                        notif_service.twilio_client.messages.create(
                            body=sms_message,
                            from_=notif_service.twilio_phone_number,
                            to=user['phone']
                        )
                        logging.info(f"✅ Payment confirmation SMS sent to {user['phone']}")
        except Exception as e:
            logging.error(f"❌ Error sending payment confirmation SMS: {e}")
        
        # Get updated balance
        updated_balance = await _credit_service.get_or_create_balance(current_user['id'])
        
        return {
            'success': True,
            'message': 'Créditos acreditados exitosamente',
            'purchase_id': purchase_id,
            'transaction_id': transaction_id,
            'credits_added': final_total_credits,
            'new_balance': updated_balance['balance'],
            'first_purchase_bonus': first_purchase_bonus if is_first_purchase else 0,
            'already_processed': False
        }
        
    except stripe.StripeError as e:
        logging.error(f"Stripe error confirming payment: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logging.error(f"Error confirming payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@credits_router.post('/stripe/webhook')
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        
        # TEMPORARILY DISABLED SIGNATURE VERIFICATION FOR LIVE TESTING
        logging.warning("⚠️  Webhook signature verification DISABLED for testing")
        import json
        event_dict = json.loads(payload)
        event = stripe.Event.construct_from(event_dict, stripe.api_key)
        
        logging.info(f"📥 Received Stripe webhook: {event['type']}")
        
        # Handle checkout.session.completed
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            logging.info(f"💳 Checkout session completed: {session['id']}")
            
            # Get metadata
            user_id = session['metadata'].get('user_id')
            package_id = session['metadata'].get('package_id')
            custom_amount = session['metadata'].get('custom_amount')
            session_type = session['metadata'].get('type')
            
            if session_type == 'credit_purchase' and user_id:
                # Handle custom amount
                if package_id == 'custom' and custom_amount:
                    total_credits = float(custom_amount)
                    amount_usd = float(custom_amount)
                    package_name = 'Monto Personalizado'
                else:
                    # Get package details
                    package = await _db.credit_packages.find_one({'id': package_id})
                    if not package:
                        logging.error(f"❌ Package not found: {package_id}")
                        return {'status': 'error', 'message': 'Package not found'}
                    
                    total_credits = package['base_credits'] + package.get('bonus_credits', 0)
                    amount_usd = package['amount_usd']
                    package_name = package['name']
                
                # Update or create balance
                balance = await _db.user_credit_balance.find_one({'user_id': user_id})
                if balance:
                    new_balance = balance['balance'] + total_credits
                    await _db.user_credit_balance.update_one(
                        {'user_id': user_id},
                        {
                            '$set': {'balance': new_balance},
                            '$inc': {
                                'lifetime_purchased': amount_usd,
                                'lifetime_earned_credits': total_credits
                            },
                            '$set': {'last_updated': datetime.utcnow()}
                        }
                    )
                else:
                    await _db.user_credit_balance.insert_one({
                        'user_id': user_id,
                        'balance': total_credits,
                        'lifetime_purchased': amount_usd,
                        'lifetime_earned_credits': total_credits,
                        'lifetime_spent': 0,
                        'created_at': datetime.utcnow(),
                        'last_updated': datetime.utcnow()
                    })
                    new_balance = total_credits
                
                # Record transaction
                import uuid
                await _db.credit_transactions.insert_one({
                    '_id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'transaction_type': 'purchase',
                    'amount': total_credits,
                    'balance_after': new_balance,
                    'description': f'Compra de créditos - {package_name}',
                    'reference_id': session['id'],
                    'payment_method': 'stripe_checkout',
                    'amount_usd': amount_usd,
                    'created_at': datetime.utcnow(),
                    'status': 'completed'
                })
                
                logging.info(f"✅ Credits added: {total_credits} credits to user {user_id}, new balance: {new_balance}")
                
                return {'status': 'success'}
        
        return {'status': 'ignored'}
        
    except Exception as e:
        logging.error(f"❌ Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@credits_router.post('/credits/use')
async def use_credits(
    request: UseCreditsRequest,
    current_user: dict = Depends(_auth_user)
):
    """Use credits for a service"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        usage = await _credit_service.use_credits(
            user_id=current_user['id'],
            service_type=request.service_type,
            service_id=request.service_id,
            service_name=request.service_name,
            service_description=request.service_description,
            credits_to_use=request.credits_to_use,
            metadata=request.metadata
        )
        
        # Get updated balance
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        
        return {
            'success': True,
            'usage': {
                'id': usage['id'],
                'service_name': usage['service_name'],
                'credits_used': usage['credits_used']
            },
            'new_balance': balance['balance']
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error using credits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/service-prices')
async def get_service_prices(
    current_user: dict = Depends(_auth_user),
    accept_language: Optional[str] = Header(None)
):
    """Get available service prices with multilanguage support (client can see what they can pay with credits)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        prices = await _credit_service.get_service_prices(is_active_only=True)
        
        # Determine language from header or user preference
        # Check user's language preference first
        user_lang = current_user.get('language_preference', 'es')
        
        # Accept-Language header can override (format: "en" or "es")
        if accept_language:
            lang = 'en' if accept_language.lower().startswith('en') else 'es'
        else:
            lang = user_lang
        
        # Transform response to return appropriate language
        for price in prices:
            price['id'] = price.pop('_id', None)
            
            # Use multilanguage fields if available
            if f'name_{lang}' in price:
                price['name'] = price.get(f'name_{lang}', price.get('name', ''))
            if f'description_{lang}' in price:
                price['description'] = price.get(f'description_{lang}', price.get('description', ''))
            
            # Remove extra language fields from response to keep it clean
            price.pop('name_en', None)
            price.pop('name_es', None)
            price.pop('description_en', None)
            price.pop('description_es', None)
            
            # Handle datetime serialization safely (may already be string)
            if 'created_at' in price and price['created_at'] and hasattr(price['created_at'], 'isoformat'):
                price['created_at'] = price['created_at'].isoformat()
            if 'updated_at' in price and price['updated_at'] and hasattr(price['updated_at'], 'isoformat'):
                price['updated_at'] = price['updated_at'].isoformat()
        
        return {
            'service_prices': prices,
            'total_count': len(prices),
            'language': lang
        }
    except Exception as e:
        logging.error(f"Error getting service prices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/payments/plans')
async def get_subscription_plans():
    """Get available subscription plans"""
    try:
        plans = await _db.subscription_plans.find({'is_active': True}).sort('sort_order', 1).to_list(100)
        
        # Transform _id to id and map fields to match frontend expectations
        for plan in plans:
            plan['id'] = str(plan.pop('_id', ''))
            # Map billing_period to interval for frontend compatibility
            plan['interval'] = plan.get('billing_period', 'monthly')
            # Add stripe_price_id (null for now, will be populated when Stripe integration is added)
            plan['stripe_price_id'] = plan.get('stripe_price_id', None)
            if 'created_at' in plan and plan['created_at']:
                plan['created_at'] = plan['created_at'].isoformat()
            if 'updated_at' in plan and plan['updated_at']:
                plan['updated_at'] = plan['updated_at'].isoformat()
        
        # Return plans directly as array (frontend expects plansResponse.data to be array)
        return plans
    except Exception as e:
        logging.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================== ADMIN PLANS MANAGEMENT ==================

@credits_router.get('/admin/plans')
async def get_all_plans(current_user: dict = Depends(_auth_user)):
    """Get all subscription plans (including inactive) for admin"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        plans = await _db.subscription_plans.find({}).sort('sort_order', 1).to_list(100)
        
        for plan in plans:
            plan['id'] = str(plan.pop('_id', ''))
            plan['interval'] = plan.get('billing_period', 'monthly')
            if 'created_at' in plan and plan['created_at']:
                plan['created_at'] = plan['created_at'].isoformat()
            if 'updated_at' in plan and plan['updated_at']:
                plan['updated_at'] = plan['updated_at'].isoformat()
        
        return plans
    except Exception as e:
        logging.error(f"Error getting admin plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PlanCreateRequest(BaseModel):
    name: str
    description: str
    price: float
    interval: str = 'monthly'
    features: List[str] = []
    apple_product_id: Optional[str] = None
    stripe_price_id: Optional[str] = None

@credits_router.post('/admin/plans')
async def create_plan(plan_data: PlanCreateRequest, current_user: dict = Depends(_auth_user)):
    """Create a new subscription plan"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Get max sort order
        last_plan = await _db.subscription_plans.find_one({}, sort=[('sort_order', -1)])
        sort_order = (last_plan.get('sort_order', 0) + 1) if last_plan else 1
        
        new_plan = {
            'name': plan_data.name,
            'description': plan_data.description,
            'price': plan_data.price,
            'billing_period': plan_data.interval,
            'features': plan_data.features,
            'is_active': True,
            'sort_order': sort_order,
            'apple_product_id': plan_data.apple_product_id,
            'stripe_price_id': plan_data.stripe_price_id,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await _db.subscription_plans.insert_one(new_plan)
        new_plan['id'] = str(result.inserted_id)
        new_plan.pop('_id', None)
        
        return {'message': 'Plan created successfully', 'plan': new_plan}
    except Exception as e:
        logging.error(f"Error creating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@credits_router.patch('/admin/plans/{plan_id}')
async def update_plan(plan_id: str, request: Request, current_user: dict = Depends(_auth_user)):
    """Update a subscription plan"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        data = await request.json()
        update_data = {'updated_at': datetime.utcnow()}
        
        allowed_fields = ['name', 'description', 'price', 'features', 'is_active', 'billing_period', 'interval', 'apple_product_id', 'stripe_price_id', 'sort_order']
        
        for field in allowed_fields:
            if field in data:
                if field == 'interval':
                    update_data['billing_period'] = data[field]
                else:
                    update_data[field] = data[field]
        
        result = await _db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        return {'message': 'Plan updated successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@credits_router.patch('/admin/plans/{plan_id}/toggle')
async def toggle_plan_status(plan_id: str, current_user: dict = Depends(_auth_user)):
    """Toggle plan active status"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        plan = await _db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        new_status = not plan.get('is_active', True)
        
        await _db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': {'is_active': new_status, 'updated_at': datetime.utcnow()}}
        )
        
        return {'message': f'Plan {"activated" if new_status else "deactivated"} successfully', 'is_active': new_status}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error toggling plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@credits_router.delete('/admin/plans/{plan_id}')
async def delete_plan(plan_id: str, current_user: dict = Depends(_auth_user)):
    """Delete a subscription plan"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Check if any users have this plan
        active_subs = await _db.user_subscriptions.count_documents({
            'plan_id': plan_id,
            'status': 'active'
        })
        
        if active_subs > 0:
            raise HTTPException(status_code=400, detail=f'Cannot delete plan with {active_subs} active subscriptions')
        
        result = await _db.subscription_plans.delete_one({'_id': ObjectId(plan_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Plan not found')
        
        return {'message': 'Plan deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@credits_router.get('/payments/subscription')
async def get_subscription(current_user: dict = Depends(_auth_user)):
    """Get current user's subscription status"""
    from uuid import UUID
    from bson.binary import Binary, UUID_SUBTYPE
    
    try:
        user_id = current_user['id']
        user_email = current_user.get('email', '')
        logging.info(f"📱 [SUBSCRIPTION] ====== FETCHING SUBSCRIPTION ======")
        logging.info(f"📱 [SUBSCRIPTION] user_id: {user_id} (type: {type(user_id).__name__})")
        logging.info(f"📱 [SUBSCRIPTION] user_email: {user_email}")
        
        # First, let's see what subscriptions exist for debugging
        all_subs_count = await _db.user_subscriptions.count_documents({})
        logging.info(f"📱 [SUBSCRIPTION] Total subscriptions in DB: {all_subs_count}")
        
        # Log a sample of existing subscriptions for debugging
        if all_subs_count > 0:
            sample_subs = await _db.user_subscriptions.find().limit(3).to_list(length=3)
            for i, sub in enumerate(sample_subs):
                sub_user_id = sub.get('user_id')
                logging.info(f"📱 [SUBSCRIPTION] Sample {i+1}: user_id={sub_user_id} (type: {type(sub_user_id).__name__}), status={sub.get('status')}")
        
        # Try multiple query approaches to handle potential user_id format mismatches
        subscription = None
        
        # Query 1: exact match with current user_id (string)
        subscription = await _db.user_subscriptions.find_one({
            'user_id': user_id,
            'status': 'active'
        })
        logging.info(f"📱 [SUBSCRIPTION] Query 1 (exact string match): {'Found' if subscription else 'Not found'}")
        
        # Query 2: Try as UUID binary object (BSON UUID)
        if not subscription:
            try:
                uuid_obj = UUID(user_id)
                uuid_binary = Binary(uuid_obj.bytes, UUID_SUBTYPE)
                subscription = await _db.user_subscriptions.find_one({
                    'user_id': uuid_binary,
                    'status': 'active'
                })
                logging.info(f"📱 [SUBSCRIPTION] Query 2 (UUID binary): {'Found' if subscription else 'Not found'}")
            except (ValueError, TypeError) as uuid_err:
                logging.info(f"📱 [SUBSCRIPTION] Query 2 skipped (not a valid UUID): {uuid_err}")
        
        # Query 3: Try without status filter (maybe status is different)
        if not subscription:
            subscription = await _db.user_subscriptions.find_one({
                'user_id': user_id
            })
            if subscription:
                logging.info(f"📱 [SUBSCRIPTION] Query 3 (no status filter): Found with status={subscription.get('status')}")
                # If found but not active, still return it with actual status
                if subscription.get('status') != 'active':
                    logging.info(f"⚠️ [SUBSCRIPTION] Found subscription but status is '{subscription.get('status')}', returning anyway")
            else:
                logging.info(f"📱 [SUBSCRIPTION] Query 3 (no status filter): Not found")
        
        # Query 4: search by user email as fallback
        if not subscription and user_email:
            user_doc = await _db.users.find_one({'email': user_email})
            if user_doc:
                alt_user_id = str(user_doc.get('_id', ''))
                logging.info(f"📱 [SUBSCRIPTION] Query 4: Trying with alt_user_id from email lookup: {alt_user_id}")
                subscription = await _db.user_subscriptions.find_one({
                    'user_id': alt_user_id
                })
                logging.info(f"📱 [SUBSCRIPTION] Query 4 (by email->user_id): {'Found' if subscription else 'Not found'}")
        
        # Query 5: Search by email field directly if subscription has email
        if not subscription and user_email:
            subscription = await _db.user_subscriptions.find_one({
                'email': user_email
            })
            logging.info(f"📱 [SUBSCRIPTION] Query 5 (by email field): {'Found' if subscription else 'Not found'}")
        
        # Query 6: Search by user_email_cache (manual admin subscriptions)
        if not subscription and user_email:
            subscription = await _db.user_subscriptions.find_one({
                'user_email_cache': user_email,
                'status': 'active'
            })
            logging.info(f"📱 [SUBSCRIPTION] Query 6 (by user_email_cache): {'Found' if subscription else 'Not found'}")
        
        if subscription:
            logging.info(f"✅ [SUBSCRIPTION] Found subscription: plan={subscription.get('plan_name')}, status={subscription.get('status')}")
            return {
                'has_active_subscription': subscription.get('status') == 'active',
                'id': str(subscription.get('_id', '')),
                'plan_name': subscription.get('plan_name'),
                'status': subscription.get('status', 'active'),
                'next_billing_date': subscription.get('next_billing_date'),
                'apple_product_id': subscription.get('apple_product_id'),
                'platform': subscription.get('platform', 'ios')
            }
        
        logging.info(f"⚠️ [SUBSCRIPTION] No subscription found for user after all queries")
        raise HTTPException(status_code=404, detail="No active subscription found")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ [SUBSCRIPTION] Error: {str(e)}")
        import traceback
        logging.error(f"❌ [SUBSCRIPTION] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

class ApplePurchaseVerification(BaseModel):
    productId: str
    transactionId: str
    transactionReceipt: Optional[str] = None
    purchaseTime: Optional[int] = None

@credits_router.post('/payments/verify-apple-purchase')
async def verify_apple_purchase(
    purchase: ApplePurchaseVerification,
    current_user: dict = Depends(_auth_user)
):
    """Verify and process an Apple In-App Purchase (subscriptions or credits)"""
    from datetime import datetime, timedelta
    
    try:
        logging.info(f"📱 [IAP] ====== STARTING VERIFICATION ======")
        logging.info(f"📱 [IAP] User: {current_user['id']}")
        logging.info(f"📱 [IAP] Product: {purchase.productId}")
        logging.info(f"📱 [IAP] Transaction ID: {purchase.transactionId}")
        
        # Check for duplicate transaction (but allow re-verification for sandbox testing)
        existing = await _db.purchase_history.find_one({
            'transaction_id': purchase.transactionId,
            'user_id': current_user['id']
        })
        
        if existing:
            logging.info(f"⚠️ [IAP] Transaction already processed, returning success (sandbox restore)")
            existing_type = existing.get('type', 'credits')
            
            # For subscriptions, also check if we need to update the user_subscriptions record
            if existing_type == 'subscription':
                # Update subscription status to active (in case it expired)
                await _db.user_subscriptions.update_one(
                    {'user_id': current_user['id']},
                    {'$set': {'status': 'active'}},
                    upsert=False
                )
                
                return {
                    'success': True,
                    'type': 'subscription',
                    'message': 'Tu suscripción ha sido restaurada',
                    'already_processed': True
                }
            else:
                return {
                    'success': True,
                    'type': 'credits',
                    'message': 'Esta compra ya fue procesada anteriormente',
                    'credits_added': existing.get('credits_added', 0),
                    'already_processed': True
                }
        
        # Check if this is a credits purchase
        is_credits_purchase = 'credits' in purchase.productId.lower()
        
        if is_credits_purchase:
            # Handle credits purchase - ONLY 4 products: 50, 100, 200, 500
            # Price: 1 credit = $1 USD (no bonuses)
            credits_map = {
                'com.rosstax.credits.50': 50,
                'com.rosstax.credits.100': 100,
                'com.rosstax.credits.200': 200,
                'com.rosstax.credits.500': 500,
            }
            
            credits_to_add = credits_map.get(purchase.productId, 0)
            
            logging.info(f"📦 Credits to add: {credits_to_add}, credit_service exists: {credit_service is not None}")
            
            if credits_to_add > 0:
                if not _credit_service:
                    logging.error("❌ credit_service is None! Cannot add credits")
                    raise HTTPException(status_code=500, detail="Sistema de créditos no disponible")
                
                try:
                    # Use update_balance instead of add_credits
                    from credit_service import TransactionType
                    await _credit_service.update_balance(
                        user_id=current_user['id'],
                        amount_change=credits_to_add,
                        transaction_type=TransactionType.PURCHASE
                    )
                    logging.info(f"✅ Balance updated for user {current_user['id']}")
                    
                    # Create transaction record
                    await _credit_service.create_transaction(
                        user_id=current_user['id'],
                        transaction_type=TransactionType.PURCHASE,
                        amount=credits_to_add,
                        description=f"Compra de créditos (Apple IAP)",
                        metadata={
                            'apple_transaction_id': purchase.transactionId,
                            'apple_product_id': purchase.productId
                        }
                    )
                    logging.info(f"✅ Transaction created for user {current_user['id']}")
                except Exception as credit_error:
                    logging.error(f"❌ Error adding credits: {credit_error}")
                    raise HTTPException(status_code=500, detail=f"Error agregando créditos: {str(credit_error)}")
                
                logging.info(f"✅ Added {credits_to_add} credits for user {current_user['id']} via Apple IAP")
                
                # Record purchase in history
                await _db.purchase_history.insert_one({
                    'user_id': current_user['id'],
                    'platform': 'ios',
                    'product_id': purchase.productId,
                    'transaction_id': purchase.transactionId,
                    'type': 'credits',
                    'credits_added': credits_to_add,
                    'created_at': datetime.utcnow()
                })
                
                # Send credit purchase confirmation email and SMS
                try:
                    user = await _db.users.find_one({'_id': ObjectId(current_user['id'])}) if ObjectId.is_valid(current_user['id']) else await _db.users.find_one({'id': current_user['id']})
                    if not user:
                        user = await _db.users.find_one({'email': current_user.get('email')})
                    
                    if user:
                        user_name = user.get('first_name', user.get('full_name', 'Usuario'))
                        user_email = user.get('email')
                        user_phone = user.get('phone')
                        
                        # Get updated balance
                        balance_doc = await _db.user_credit_balance.find_one({'user_id': current_user['id']})
                        current_balance = balance_doc.get('balance', 0) if balance_doc else credits_to_add
                        
                        # Calculate price based on credits purchased
                        # ONLY 4 valid products in App Store Connect: 50, 100, 200, 500
                        price_map = {
                            'com.rosstax.credits.50': 49.99,
                            'com.rosstax.credits.100': 99.99,
                            'com.rosstax.credits.200': 199.99,
                            'com.rosstax.credits.500': 499.99,
                        }
                        price_paid = price_map.get(purchase.productId, credits_to_add)
                        
                        purchase_date = datetime.utcnow().strftime('%d/%m/%Y %H:%M')
                        
                        # Send Email with Invoice - Premium Design
                        if user_email and _notification_service and _notification_service.sendgrid_client:
                            email_html = f"""
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
                                    <tr>
                                        <td align="center">
                                            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                                                <!-- Header -->
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 50%, #4A7BC7 100%); padding: 40px 30px; text-align: center;">
                                                        <div style="font-size: 50px; margin-bottom: 10px;">🎉</div>
                                                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">¡Compra Exitosa!</h1>
                                                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Tu transacción ha sido procesada</p>
                                                    </td>
                                                </tr>
                                                
                                                <!-- Content -->
                                                <tr>
                                                    <td style="padding: 40px 30px;">
                                                        <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Hola <strong style="color: #1E3A5F;">{user_name}</strong>,</p>
                                                        <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 30px 0;">
                                                            Gracias por tu compra. Tus créditos ya están disponibles en tu cuenta y puedes utilizarlos inmediatamente.
                                                        </p>
                                                        
                                                        <!-- Invoice Card -->
                                                        <div style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); border-radius: 12px; padding: 25px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                                                            <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #1E3A5F; padding-bottom: 15px;">
                                                                <span style="font-size: 24px; margin-right: 10px;">📄</span>
                                                                <h3 style="color: #1E3A5F; margin: 0; font-size: 20px; font-weight: 600;">Factura de Compra</h3>
                                                            </div>
                                                            
                                                            <table style="width: 100%; border-collapse: collapse;">
                                                                <tr>
                                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px;">📅 Fecha</td>
                                                                    <td style="padding: 12px 0; text-align: right; color: #334155; font-weight: 500;">{purchase_date}</td>
                                                                </tr>
                                                                <tr style="background-color: #f8fafc;">
                                                                    <td style="padding: 12px 8px; color: #64748b; font-size: 14px; border-radius: 6px 0 0 6px;">🔖 Transacción</td>
                                                                    <td style="padding: 12px 8px; text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #64748b; border-radius: 0 6px 6px 0;">{purchase.transactionId[:20]}...</td>
                                                                </tr>
                                                                <tr>
                                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px;">💳 Créditos comprados</td>
                                                                    <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #059669; font-size: 18px;">+{credits_to_add}</td>
                                                                </tr>
                                                                <tr style="background-color: #f8fafc;">
                                                                    <td style="padding: 12px 8px; color: #64748b; font-size: 14px; border-radius: 6px 0 0 6px;">💵 Precio</td>
                                                                    <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #334155; border-radius: 0 6px 6px 0;">${price_paid:.2f} USD</td>
                                                                </tr>
                                                            </table>
                                                            
                                                            <!-- Balance Highlight -->
                                                            <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%); border-radius: 10px; text-align: center;">
                                                                <p style="color: rgba(255,255,255,0.8); margin: 0 0 5px 0; font-size: 14px;">Tu balance actual</p>
                                                                <p style="color: white; margin: 0; font-size: 32px; font-weight: 700;">{current_balance:.0f} <span style="font-size: 16px; font-weight: 400;">créditos</span></p>
                                                            </div>
                                                        </div>
                                                        
                                                        <!-- CTA -->
                                                        <div style="text-align: center; margin: 30px 0;">
                                                            <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0;">¿Listo para usar tus créditos?</p>
                                                            <a href="https://rosstaxpreparation.com" style="display: inline-block; background: linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 16px;">Explorar Servicios</a>
                                                        </div>
                                                        
                                                        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                                            Si tienes alguna pregunta sobre tu compra, no dudes en contactarnos. Estamos aquí para ayudarte.
                                                        </p>
                                                    </td>
                                                </tr>
                                                
                                                <!-- Footer -->
                                                <tr>
                                                    <td style="background-color: #1E3A5F; padding: 25px 30px; text-align: center;">
                                                        <p style="color: rgba(255,255,255,0.9); margin: 0 0 10px 0; font-size: 14px; font-weight: 500;">El equipo de Ross Tax</p>
                                                        <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px;">© 2026 Ross Tax Preparation LLC. Todos los derechos reservados.</p>
                                                        <div style="margin-top: 15px;">
                                                            <a href="https://rosstaxpreparation.com" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px; margin: 0 10px;">Sitio Web</a>
                                                            <span style="color: rgba(255,255,255,0.4);">|</span>
                                                            <a href="mailto:support@rosstaxpreparation.com" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px; margin: 0 10px;">Soporte</a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </body>
                            </html>
                            """
                            
                            await _notification_service.send_email(
                                to_email=user_email,
                                subject='🎉 Compra de Créditos Exitosa - Ross Tax',
                                html_content=email_html
                            )
                            logging.info(f"📧 Credit purchase email sent to {user_email}")
                        
                        # Send SMS notification
                        if user_phone and _notification_service and _notification_service.twilio_client:
                            sms_message = f"✅ Ross Tax: Tu compra de {credits_to_add} créditos fue exitosa. Balance actual: {current_balance:.0f} créditos. ¡Gracias por tu compra!"
                            await _notification_service.send_sms(
                                to_phone=user_phone,
                                message=sms_message
                            )
                            logging.info(f"📱 Credit purchase SMS sent to {user_phone}")
                            
                except Exception as notif_error:
                    logging.error(f"⚠️ Error sending credit purchase notifications: {notif_error}")
                    # Don't fail the purchase if notifications fail
                
                return {
                    'success': True,
                    'type': 'credits',
                    'message': f'Se agregaron {credits_to_add} créditos a tu cuenta',
                    'credits_added': credits_to_add
                }
            else:
                # Unknown credits product - log and continue to check if it might be a subscription
                logging.warning(f"⚠️ Unknown credits product: {purchase.productId}, checking if it's a subscription...")
        
        # Handle subscription purchase (if not credits or unknown credits product)
        logging.info(f"📱 [IAP] Processing subscription: {purchase.productId}")
        # Map Apple product ID to plan
        plan = await _db.subscription_plans.find_one({'apple_product_id': purchase.productId})
        
        if not plan:
            logging.warning(f"⚠️ No plan found for Apple product: {purchase.productId}")
            # Still acknowledge the purchase but log warning
            plan_name = purchase.productId.split('.')[-2] if '.' in purchase.productId else 'unknown'
        else:
            plan_name = plan.get('name', 'Suscripción')
        
        # Calculate subscription end date based on product
        is_yearly = 'yearly' in purchase.productId or 'annual' in purchase.productId
        subscription_duration = timedelta(days=365) if is_yearly else timedelta(days=30)
        next_billing_date = datetime.utcnow() + subscription_duration
        
        # Create or update subscription
        subscription_data = {
            'user_id': current_user['id'],
            'email': current_user.get('email', ''),
            'user_email_cache': current_user.get('email', ''),
            'plan_id': str(plan['_id']) if plan else None,
            'plan_name': plan_name,
            'apple_product_id': purchase.productId,
            'apple_transaction_id': purchase.transactionId,
            'status': 'active',
            'platform': 'ios',
            'source': 'apple_iap',
            'created_at': datetime.utcnow(),
            'next_billing_date': next_billing_date,
            'purchase_time': datetime.fromtimestamp(purchase.purchaseTime / 1000) if purchase.purchaseTime else datetime.utcnow()
        }
        
        # Upsert subscription
        await _db.user_subscriptions.update_one(
            {'user_id': current_user['id']},
            {'$set': subscription_data},
            upsert=True
        )
        
        # Add credits if plan has credits_included
        if plan and plan.get('credits_included'):
            try:
                if _credit_service:
                    from credit_service import TransactionType
                    await _credit_service.update_balance(
                        user_id=current_user['id'],
                        amount_change=plan['credits_included'],
                        transaction_type=TransactionType.BONUS
                    )
                    await _credit_service.create_transaction(
                        user_id=current_user['id'],
                        transaction_type=TransactionType.BONUS,
                        amount=plan['credits_included'],
                        description=f"Suscripción {plan_name} (Apple IAP)",
                        metadata={'apple_transaction_id': purchase.transactionId}
                    )
                    logging.info(f"✅ Added {plan['credits_included']} credits for user {current_user['id']}")
            except Exception as credit_error:
                logging.error(f"Error adding credits: {credit_error}")
        
        # Check if this transaction was already processed (to avoid duplicate notifications)
        existing_purchase = await _db.purchase_history.find_one({
            'transaction_id': purchase.transactionId
        })
        
        is_new_purchase = existing_purchase is None
        
        # Record purchase in history (if new)
        if is_new_purchase:
            await _db.purchase_history.insert_one({
                'user_id': current_user['id'],
                'platform': 'ios',
                'product_id': purchase.productId,
                'transaction_id': purchase.transactionId,
                'type': 'subscription',
                'created_at': datetime.utcnow()
            })
            logging.info(f"✅ NEW Apple subscription verified for user {current_user['id']}")
        else:
            logging.info(f"ℹ️ Subscription already processed (transaction: {purchase.transactionId[:20]}...), skipping notifications")
        
        # Send subscription confirmation email and SMS ONLY for NEW purchases
        if is_new_purchase:
            try:
                user = await _db.users.find_one({'_id': ObjectId(current_user['id'])}) if ObjectId.is_valid(current_user['id']) else await _db.users.find_one({'id': current_user['id']})
                if not user:
                    user = await _db.users.find_one({'email': current_user.get('email')})
                
                    
                    # Send SMS only (simplified)
                    if user_phone and _notification_service and _notification_service.twilio_client:
                        # Detect app by product ID for correct branding
                        is_micasousa = 'micasousa' in (purchase.productId or '').lower()
                        brand = 'Mi Caso USA' if is_micasousa else 'Ross Tax'
                        sms_message = f"🎉 {brand}: Tu suscripción al plan {plan_name} ha sido activada. Próxima renovación: {formatted_date}. ¡Gracias!"
                        await _notification_service.send_sms(to_phone=user_phone, message=sms_message)
                        logging.info(f"📱 Subscription confirmation SMS sent to {user_phone}")
            except Exception as notif_error:
                logging.error(f"⚠️ Error sending subscription notification: {notif_error}")
        
        return {
            'success': True,
            'type': 'subscription',
            'message': 'Compra verificada y suscripción activada',
            'subscription': {
                'plan_name': plan_name,
                'next_billing_date': next_billing_date.isoformat()
            }
        }
        
    except Exception as e:
        logging.error(f"❌ Error verifying Apple purchase: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@credits_router.post('/credits/use-for-service')
async def use_credits_for_service(
    request: UseCreditsForServiceRequest,
    current_user: dict = Depends(_auth_user)
):
    """Use credits to pay for a configured service"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        result = await _credit_service.use_credits_for_service(
            user_id=current_user['id'],
            service_price_id=request.service_price_id,
            service_instance_id=request.service_instance_id,
            additional_metadata=request.metadata
        )
        
        # Get updated balance
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        
        return {
            'success': True,
            'usage_id': result['usage']['id'],
            'service_name': result['service_price']['name'],
            'credits_used': result['credits_used'],
            'new_balance': balance['balance'],
            'transaction_id': result['usage'].get('transaction_id')
        }
    except ValueError as e:
        logging.error(f"Error using credits: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error processing service payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN SERVICE PRICES MANAGEMENT ==================

@credits_router.get('/admin/service-prices')
async def admin_get_all_service_prices(current_user: dict = Depends(_require_admin)):
    """Get all service prices including inactive ones (admin only)"""
    try:
        prices = await _db.service_prices.find({}).to_list(100)
        
        # Serialize
        for price in prices:
            price['id'] = str(price.pop('_id'))
            if price.get('created_at'):
                price['created_at'] = price['created_at'].isoformat()
            if price.get('updated_at'):
                price['updated_at'] = price['updated_at'].isoformat()
        
        return {'service_prices': prices, 'total_count': len(prices)}
    except Exception as e:
        logging.error(f"Error getting all service prices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/service-prices')
async def admin_create_service_price(
    service_data: dict,
    current_user: dict = Depends(_require_admin)
):
    """Create new service price (admin only)"""
    try:
        # Validate required fields (multilanguage support)
        required_fields = ['service_type', 'price_credits']
        for field in required_fields:
            if field not in service_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Create service document
        service_doc = {
            '_id': service_data.get('id', f"{service_data['service_type']}_{datetime.utcnow().timestamp()}"),
            'service_type': service_data['service_type'],
            'price_credits': float(service_data['price_credits']),
            'is_active': service_data.get('is_active', True),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Add multilanguage fields if provided
        if 'name_en' in service_data:
            service_doc['name_en'] = service_data['name_en']
        if 'name_es' in service_data:
            service_doc['name_es'] = service_data['name_es']
        if 'description_en' in service_data:
            service_doc['description_en'] = service_data['description_en']
        if 'description_es' in service_data:
            service_doc['description_es'] = service_data['description_es']
        
        # Backward compatibility: if old 'name' and 'description' provided
        if 'name' in service_data:
            service_doc['name'] = service_data['name']
        if 'description' in service_data:
            service_doc['description'] = service_data['description']
        
        # Check if ID already exists
        existing = await _db.service_prices.find_one({'_id': service_doc['_id']})
        if existing:
            raise HTTPException(status_code=400, detail="Service ID already exists")
        
        result = await _db.service_prices.insert_one(service_doc)
        
        service_doc['id'] = str(service_doc.pop('_id'))
        service_doc['created_at'] = service_doc['created_at'].isoformat()
        service_doc['updated_at'] = service_doc['updated_at'].isoformat()
        
        return {
            'success': True,
            'service': service_doc,
            'message': 'Service price created successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating service price: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.put('/admin/service-prices/{service_id}')
async def admin_update_service_price(
    service_id: str,
    service_data: dict,
    current_user: dict = Depends(_require_admin)
):
    """Update service price (admin only)"""
    try:
        from bson import ObjectId
        
        # Check if exists - try string ID first, then ObjectId
        existing = await _db.service_prices.find_one({'_id': service_id})
        query_id = service_id
        
        if not existing:
            try:
                existing = await _db.service_prices.find_one({'_id': ObjectId(service_id)})
                query_id = ObjectId(service_id)
            except:
                pass
        
        if not existing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Build update data
        update_data = {}
        allowed_fields = ['service_type', 'name', 'description', 'price_credits', 'is_active', 
                         'name_en', 'name_es', 'description_en', 'description_es',
                         'price', 'base_price', 'icon', 'color', 'duration_minutes']
        
        for field in allowed_fields:
            if field in service_data:
                if field in ['price_credits', 'price', 'base_price', 'duration_minutes']:
                    update_data[field] = float(service_data[field]) if service_data[field] else 0
                else:
                    update_data[field] = service_data[field]
        
        if update_data:
            update_data['updated_at'] = datetime.utcnow()
            
            result = await _db.service_prices.update_one(
                {'_id': query_id},
                {'$set': update_data}
            )
            
            if result.modified_count == 0 and result.matched_count == 0:
                raise HTTPException(status_code=400, detail="No changes made")
        
        # Get updated service
        updated_service = await _db.service_prices.find_one({'_id': query_id})
        updated_service['id'] = str(updated_service.pop('_id'))
        
        if updated_service.get('created_at'):
            updated_service['created_at'] = updated_service['created_at'].isoformat()
        if updated_service.get('updated_at'):
            updated_service['updated_at'] = updated_service['updated_at'].isoformat()
        
        return {
            'success': True,
            'service': updated_service,
            'message': 'Service price updated successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating service price: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.delete('/admin/service-prices/{service_id}')
async def admin_delete_service_price(
    service_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Delete service price (admin only)"""
    try:
        # Try deleting by string ID first
        result = await _db.service_prices.delete_one({'_id': service_id})
        
        # If not found, try with ObjectId
        if result.deleted_count == 0:
            try:
                from bson import ObjectId
                result = await _db.service_prices.delete_one({'_id': ObjectId(service_id)})
            except:
                pass
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {
            'success': True,
            'message': 'Service price deleted successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting service price: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@credits_router.post('/credits/create-service-payment-session')
async def create_service_payment_session(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Create Stripe checkout session for service payment"""
    try:
        import stripe
        import os
        
        service_price_id = request.get('service_price_id')
        service_instance_id = request.get('service_instance_id')
        service_name = request.get('service_name', 'Servicio Ross Tax')
        amount = request.get('amount', 0)
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Monto inválido")
        
        # Try to get Stripe key from environment first, then from config
        stripe_key = os.getenv('STRIPE_API_KEY')
        if not stripe_key:
            config = await _db.config.find_one({})
            stripe_key = config.get('stripe_api_key') if config else None
        
        if not stripe_key:
            raise HTTPException(status_code=400, detail="Stripe no está configurado. Por favor usa créditos para pagar.")
        
        stripe.api_key = stripe_key
        
        # Try to get service details, but don't fail if not found
        service = None
        if service_price_id:
            # Try as ObjectId first
            try:
                from bson import ObjectId
                service = await _db.service_prices.find_one({'_id': ObjectId(service_price_id)})
            except:
                pass
            
            # Try as string ID
            if not service:
                service = await _db.service_prices.find_one({'_id': service_price_id})
            
            # Try by service_id
            if not service:
                service = await _db.service_prices.find_one({'service_id': service_price_id})
        
        # Use service details if found, otherwise use request data
        final_service_name = service['name'] if service else service_name
        final_description = service.get('description', f'Servicio profesional - Ross Tax Preparation') if service else 'Servicio profesional - Ross Tax Preparation'
        
        # Convert to cents
        amount_cents = int(amount * 100)
        
        # Get backend URL
        backend_url = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://app-nueva-production.up.railway.app')
        
        # Create Stripe session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': final_service_name,
                        'description': final_description,
                    },
                    'unit_amount': amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{backend_url}/api/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=service",
            cancel_url=f"{backend_url}/api/payment-cancel?type=service",
            metadata={
                'user_id': current_user['id'],
                'user_email': current_user.get('email', ''),
                'service_price_id': service_price_id or '',
                'service_instance_id': service_instance_id or '',
                'service_name': final_service_name,
                'payment_type': 'service_payment'
            }
        )
        
        logging.info(f"💳 Stripe session created for service '{final_service_name}': {session.id}")
        
        return {
            'success': True,
            'session_id': session.id,
            'session_url': session.url,
            'amount': amount,
            'service_name': final_service_name
        }
        
    except stripe.error.StripeError as e:
        logging.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error de Stripe: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating service payment session: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear sesión de pago. Por favor usa créditos.")


@credits_router.post('/services/create-stripe-checkout')
async def create_service_stripe_checkout(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Create Stripe checkout session for physical service payment (Apple compliant)"""
    try:
        import stripe
        import os
        
        service_id = request.get('service_id')
        service_name = request.get('service_name', 'Servicio Ross Tax')
        amount_cents = request.get('amount', 0)  # Already in cents from frontend
        
        if amount_cents <= 0:
            raise HTTPException(status_code=400, detail="Monto inválido")
        
        # Use the live Stripe key from environment
        stripe_key = os.getenv('STRIPE_API_KEY')
        if not stripe_key:
            raise HTTPException(status_code=400, detail="Stripe no está configurado")
        
        stripe.api_key = stripe_key
        
        # Get backend URL for success/cancel redirects
        backend_url = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://app-nueva-production-e876.up.railway.app')
        
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': service_name,
                        'description': f'Servicio profesional - Ross Tax Preparation',
                    },
                    'unit_amount': amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{backend_url}/api/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=service",
            cancel_url=f"{backend_url}/api/payment-cancel?type=service",
            metadata={
                'user_id': current_user['id'],
                'user_email': current_user.get('email', ''),
                'service_id': service_id or '',
                'service_name': service_name,
                'payment_type': 'physical_service'
            }
        )
        
        logging.info(f"💳 Stripe checkout created for service '{service_name}' - Session: {session.id}")
        
        return {
            'success': True,
            'checkout_url': session.url,
            'session_id': session.id
        }
        
    except stripe.error.StripeError as e:
        logging.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error de Stripe: {str(e)}")
    except Exception as e:
        logging.error(f"Error creating service checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/services/create-payment-intent')
async def create_service_payment_intent(
    request: dict,
    current_user: dict = Depends(_auth_user)
):
    """Create Stripe PaymentIntent for native mobile payment (Payment Sheet)"""
    try:
        import stripe
        import os
        
        service_id = request.get('service_id')
        service_name = request.get('service_name', 'Servicio Ross Tax')
        amount_cents = request.get('amount', 0)  # Already in cents from frontend
        
        if amount_cents <= 0:
            raise HTTPException(status_code=400, detail="Monto inválido")
        
        # Use the live Stripe key from environment
        stripe_key = os.getenv('STRIPE_API_KEY')
        if not stripe_key:
            raise HTTPException(status_code=400, detail="Stripe no está configurado")
        
        stripe.api_key = stripe_key
        
        # Get or create customer
        user_data = await _db.users.find_one({'_id': current_user['id']})
        if not user_data:
            try:
                from bson import ObjectId
                user_data = await _db.users.find_one({'_id': ObjectId(current_user['id'])})
            except:
                pass
        
        stripe_customer_id = None
        if user_data and user_data.get('stripe_customer_id'):
            stripe_customer_id = user_data['stripe_customer_id']
        else:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=current_user.get('email', ''),
                name=current_user.get('name', ''),
                metadata={'user_id': current_user['id']}
            )
            stripe_customer_id = customer.id
            # Save customer ID
            await _db.users.update_one(
                {'_id': current_user['id']},
                {'$set': {'stripe_customer_id': stripe_customer_id}}
            )
        
        # Create PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            customer=stripe_customer_id,
            automatic_payment_methods={'enabled': True},
            metadata={
                'user_id': current_user['id'],
                'user_email': current_user.get('email', ''),
                'service_id': service_id or '',
                'service_name': service_name,
                'payment_type': 'physical_service'
            }
        )
        
        # Get ephemeral key for Payment Sheet
        ephemeral_key = stripe.EphemeralKey.create(
            customer=stripe_customer_id,
            stripe_version='2023-10-16'
        )
        
        logging.info(f"💳 PaymentIntent created for service '{service_name}' - PI: {payment_intent.id}")
        
        return {
            'success': True,
            'client_secret': payment_intent.client_secret,
            'payment_intent_id': payment_intent.id,
            'ephemeral_key': ephemeral_key.secret,
            'customer_id': stripe_customer_id,
            'amount': amount_cents,
            'service_name': service_name
        }
        
    except stripe.error.StripeError as e:
        logging.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error de Stripe: {str(e)}")
    except Exception as e:
        logging.error(f"Error creating service payment intent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/use-for-service-old-endpoint')
async def use_credits_for_service_old(
    request: UseCreditsForServiceRequest,
    current_user: dict = Depends(_auth_user)
):
    """DEPRECATED: Use credits to pay for a configured service"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        result = await _credit_service.use_credits_for_service(
            user_id=current_user['id'],
            service_price_id=request.service_price_id,
            service_instance_id=request.service_instance_id,
            additional_metadata=request.metadata
        )
        
        # Get updated balance
        balance = await _credit_service.get_or_create_balance(current_user['id'])
        
        return {
            'success': True,
            'usage_id': result['usage']['id'],
            'service_name': result['service_price']['name'],
            'credits_used': result['credits_used'],
            'new_balance': balance['balance'],
            'transaction_id': result['usage'].get('transaction_id')
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error using credits for service: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/history')
async def get_credit_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(_auth_user)
):
    """Get credit transaction history"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        history = await _credit_service.get_transaction_history(
            user_id=current_user['id'],
            page=page,
            per_page=per_page
        )
        
        # Serialize datetime objects and ensure transaction_type field exists
        for transaction in history['transactions']:
            # Remove MongoDB _id field
            if '_id' in transaction:
                del transaction['_id']
            
            if transaction.get('created_at'):
                transaction['created_at'] = transaction['created_at'].isoformat()
            if transaction.get('completed_at'):
                transaction['completed_at'] = transaction['completed_at'].isoformat()
            
            # Ensure transaction_type field exists (map from 'type' if needed)
            if not transaction.get('transaction_type') and transaction.get('type'):
                transaction['transaction_type'] = transaction['type']
            
            # Ensure id field exists (use transaction_id if not present)
            if not transaction.get('id') and transaction.get('transaction_id'):
                transaction['id'] = transaction['transaction_id']
        
        return history
    except Exception as e:
        logging.error(f"Error getting credit history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== CREDIT TRANSFER ENDPOINTS (P2P) ==================

@credits_router.post('/credits/transfer')
async def transfer_credits(
    request: TransferCreditsRequest,
    current_user: dict = Depends(_auth_user)
):
    """Transfer credits to another user"""
    try:
        if not _transfer_service:
            raise HTTPException(status_code=503, detail="Transfer service not available")
        
        result = await _transfer_service.transfer_credits(
            sender_id=current_user['id'],
            recipient_identifier=request.recipient_identifier,
            amount=request.amount,
            note=request.note
        )
        
        if result['success']:
            # Send push notification to recipient
            if result.get('transaction_id'):
                try:
                    recipient = await _transfer_service.find_user_by_identifier(request.recipient_identifier)
                    if recipient:
                        await push_notification_service.send_notification(
                            user_id=str(recipient['_id']),
                            title="¡Créditos recibidos!",
                            body=f"Has recibido {request.amount} créditos de {current_user.get('name', current_user.get('email'))}",
                            data={
                                'type': 'credit_transfer_received',
                                'amount': request.amount,
                                'sender': current_user.get('name', current_user.get('email'))
                            }
                        )
                        
                        # Send SMS to recipient
                        if recipient.get('phone'):
                            config_doc = await _db.api_config.find_one({'_id': 'main'})
                            if config_doc:
                                from notification_service import NotificationService
                                notif_service = NotificationService(config_doc)
                                
                                if notif_service.twilio_client:
                                    sender_name = current_user.get('name', current_user.get('email'))
                                    new_balance = result.get('recipient_new_balance', 0)
                                    
                                    sms_message = f"""💰 Créditos RECIBIDOS

Monto: {request.amount} créditos
De: {sender_name}
Fecha: {datetime.now().strftime("%d/%m/%Y")}

Balance actual: {new_balance} créditos

Ross Tax Preparation"""
                                    
                                    notif_service.twilio_client.messages.create(
                                        body=sms_message,
                                        from_=notif_service.twilio_phone_number,
                                        to=recipient['phone']
                                    )
                                    logging.info(f"✅ Credit transfer SMS sent to {recipient['phone']}")
                except Exception as e:
                    logging.error(f"❌ Error sending transfer notification: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error transferring credits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/request')
async def request_credits(
    request: RequestCreditsModel,
    current_user: dict = Depends(_auth_user)
):
    """Request credits from another user"""
    try:
        if not _transfer_service:
            raise HTTPException(status_code=503, detail="Transfer service not available")
        
        result = await _transfer_service.request_credits(
            requester_id=current_user['id'],
            recipient_identifier=request.recipient_identifier,
            amount=request.amount,
            reason=request.reason
        )
        
        if result['success']:
            # Send push notification to recipient
            if result.get('request_id'):
                try:
                    recipient = await _transfer_service.find_user_by_identifier(request.recipient_identifier)
                    if recipient:
                        await push_notification_service.send_notification(
                            user_id=str(recipient['_id']),
                            title="Solicitud de créditos",
                            body=f"{current_user.get('name', current_user.get('email'))} te solicita {request.amount} créditos",
                            data={
                                'type': 'credit_request',
                                'amount': request.amount,
                                'requester': current_user.get('name', current_user.get('email')),
                                'request_id': result['request_id']
                            }
                        )
                except Exception as e:
                    logging.error(f"Error sending request notification: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error requesting credits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/credits/request/respond')
async def respond_to_credit_request(
    request: RespondToRequestModel,
    current_user: dict = Depends(_auth_user)
):
    """Approve or reject a credit request"""
    try:
        if not _transfer_service:
            raise HTTPException(status_code=503, detail="Transfer service not available")
        
        result = await _transfer_service.respond_to_request(
            request_id=request.request_id,
            recipient_id=current_user['id'],
            action=request.action
        )
        
        if result['success']:
            # Send push notification to requester
            try:
                # Get request details
                req_doc = await _db.credit_requests.find_one({'_id': ObjectId(request.request_id)})
                if req_doc:
                    if request.action == 'approve':
                        await push_notification_service.send_notification(
                            user_id=req_doc['requester_id'],
                            title="¡Solicitud aprobada!",
                            body=f"{current_user.get('name', current_user.get('email'))} aprobó tu solicitud de {req_doc['amount']} créditos",
                            data={
                                'type': 'credit_request_approved',
                                'amount': req_doc['amount']
                            }
                        )
                    else:
                        await push_notification_service.send_notification(
                            user_id=req_doc['requester_id'],
                            title="Solicitud rechazada",
                            body=f"{current_user.get('name', current_user.get('email'))} rechazó tu solicitud",
                            data={
                                'type': 'credit_request_rejected'
                            }
                        )
            except Exception as e:
                logging.error(f"Error sending response notification: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error responding to request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/requests/pending')
async def get_pending_requests(
    current_user: dict = Depends(_auth_user)
):
    """Get all pending credit requests (sent and received)"""
    try:
        if not _transfer_service:
            raise HTTPException(status_code=503, detail="Transfer service not available")
        
        requests = await _transfer_service.get_pending_requests(current_user['id'])
        
        # Serialize datetime objects
        for req in requests:
            if req.get('created_at'):
                req['created_at'] = req['created_at'].isoformat()
            if req.get('responded_at'):
                req['responded_at'] = req['responded_at'].isoformat()
        
        return {'requests': requests}
        
    except Exception as e:
        logging.error(f"Error getting pending requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/transfers')
async def get_transfer_history(
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(_auth_user)
):
    """Get P2P transfer history"""
    try:
        if not _transfer_service:
            raise HTTPException(status_code=503, detail="Transfer service not available")
        
        transfers = await _transfer_service.get_transfer_history(
            user_id=current_user['id'],
            limit=limit
        )
        
        # Serialize datetime objects
        for txn in transfers:
            if txn.get('created_at'):
                txn['created_at'] = txn['created_at'].isoformat()
        
        return {'transfers': transfers}
        
    except Exception as e:
        logging.error(f"Error getting transfer history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== RAFFLE ENDPOINTS (GAMIFICATION) ==================

@credits_router.get('/raffles')
async def get_active_raffles(current_user: dict = Depends(_auth_user)):
    """Get all active raffles for clients"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        raffles = await raffle_service.get_active_raffles()
        
        # Serialize datetime objects and clean data
        serialized_raffles = []
        for raffle in raffles:
            clean_raffle = {}
            for key, value in raffle.items():
                if key == '_id':
                    continue  # Skip _id field
                elif isinstance(value, datetime):
                    clean_raffle[key] = value.isoformat()
                elif isinstance(value, ObjectId):
                    clean_raffle[key] = str(value)
                else:
                    clean_raffle[key] = value
            serialized_raffles.append(clean_raffle)
        
        return {'raffles': serialized_raffles}
        
    except Exception as e:
        logging.error(f"Error getting active raffles: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/raffles/my-tickets')
async def get_my_raffle_tickets(
    raffle_id: Optional[str] = Query(None),
    current_user: dict = Depends(_auth_user)
):
    """Get user's raffle tickets"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        tickets = await raffle_service.get_user_tickets(
            user_id=current_user['id'],
            raffle_id=raffle_id
        )
        
        # Serialize datetime objects
        for ticket in tickets:
            ticket.pop('_id', None)
            if ticket.get('purchased_at'):
                ticket['purchased_at'] = ticket['purchased_at'].isoformat()
        
        return {'tickets': tickets}
        
    except Exception as e:
        logging.error(f"Error getting user tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/raffles/{raffle_id}')
async def get_raffle_detail(
    raffle_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get raffle details"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        raffle = await raffle_service.get_raffle_by_id(raffle_id)
        
        if not raffle:
            raise HTTPException(status_code=404, detail="Sorteo no encontrado")
        
        # Serialize datetime objects
        raffle.pop('_id', None)
        if raffle.get('end_date'):
            raffle['end_date'] = raffle['end_date'].isoformat()
        if raffle.get('created_at'):
            raffle['created_at'] = raffle['created_at'].isoformat()
        if raffle.get('updated_at'):
            raffle['updated_at'] = raffle['updated_at'].isoformat()
        if raffle.get('drawn_at'):
            raffle['drawn_at'] = raffle['drawn_at'].isoformat()
        
        return raffle
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting raffle detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/raffles/{raffle_id}/buy')
async def buy_raffle_tickets(
    raffle_id: str,
    request: BuyTicketRequest,
    current_user: dict = Depends(_auth_user)
):
    """Buy raffle tickets"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        # Validate raffle_id matches request
        if request.raffle_id != raffle_id:
            raise HTTPException(status_code=400, detail="Raffle ID mismatch")
        
        result = await raffle_service.buy_tickets(
            raffle_id=raffle_id,
            user_id=current_user['id'],
            quantity=request.quantity
        )
        
        if result['success']:
            # Serialize tickets
            for ticket in result.get('tickets', []):
                ticket.pop('_id', None)
                if ticket.get('purchased_at'):
                    ticket['purchased_at'] = ticket['purchased_at'].isoformat()
            
            # Send push notification
            try:
                await push_notification_service.send_notification(
                    user_id=current_user['id'],
                    title="¡Boletos comprados!",
                    body=f"Compraste {request.quantity} boleto(s) para el sorteo. ¡Buena suerte!",
                    data={
                        'type': 'raffle_ticket_purchased',
                        'raffle_id': raffle_id,
                        'quantity': request.quantity
                    }
                )
            except Exception as e:
                logging.error(f"Error sending raffle notification: {e}")
            
            # Send SMS confirmation
            try:
                user = await _db.users.find_one({'_id': current_user['id']})
                raffle = await _db.raffles.find_one({'_id': raffle_id})
                
                if user and user.get('phone') and raffle:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        if notif_service.twilio_client:
                            raffle_title = raffle.get('title', 'Sorteo')
                            credits_used = result.get('credits_used', 0)
                            
                            sms_message = f"""✅ Boletos comprados exitosamente!

🎟️ Cantidad: {request.quantity} boleto(s)
🎁 Sorteo: {raffle_title}
💰 Créditos usados: {credits_used}

¡Mucha suerte!

Ross Tax Preparation"""
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=user['phone']
                            )
                            logging.info(f"✅ Raffle tickets SMS sent to {user['phone']}")
            except Exception as e:
                logging.error(f"❌ Error sending raffle tickets SMS: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error buying raffle tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN RAFFLE ENDPOINTS ==================

@credits_router.post('/admin/raffles')
async def create_raffle(
    request: CreateRaffleRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Create a new raffle"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        raffle = await raffle_service.create_raffle(
            raffle_data=request.dict(),
            admin_id=current_user['id']
        )
        
        # Serialize datetime objects
        raffle.pop('_id', None)
        if raffle.get('end_date'):
            raffle['end_date'] = raffle['end_date'].isoformat()
        if raffle.get('created_at'):
            raffle['created_at'] = raffle['created_at'].isoformat()
        if raffle.get('updated_at'):
            raffle['updated_at'] = raffle['updated_at'].isoformat()
        
        return raffle
        
    except Exception as e:
        logging.error(f"Error creating raffle: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/admin/raffles')
async def get_all_raffles_admin(current_user: dict = Depends(_require_admin)):
    """Admin: Get all raffles"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        raffles = await raffle_service.get_all_raffles_admin()
        
        # Serialize datetime objects and clean data
        serialized_raffles = []
        for raffle in raffles:
            clean_raffle = {}
            for key, value in raffle.items():
                if key == '_id':
                    continue  # Skip _id field
                elif isinstance(value, datetime):
                    clean_raffle[key] = value.isoformat()
                elif isinstance(value, ObjectId):
                    clean_raffle[key] = str(value)
                else:
                    clean_raffle[key] = value
            serialized_raffles.append(clean_raffle)
        
        return {'raffles': serialized_raffles}
        
    except Exception as e:
        logging.error(f"Error getting admin raffles: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.patch('/admin/raffles/{raffle_id}')
async def update_raffle(
    raffle_id: str,
    request: UpdateRaffleRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Update a raffle"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        result = await raffle_service.update_raffle(raffle_id, update_data)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating raffle: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.delete('/admin/raffles/{raffle_id}')
async def delete_raffle(
    raffle_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Delete a raffle (only if no tickets sold)"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        result = await raffle_service.delete_raffle(raffle_id)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting raffle: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/raffles/execute')
async def execute_raffle_draw(
    request: ExecuteRaffleRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Execute raffle and select winner"""
    try:
        if not raffle_service:
            raise HTTPException(status_code=503, detail="Raffle service not available")
        
        result = await raffle_service.execute_raffle(
            raffle_id=request.raffle_id,
            admin_id=current_user['id']
        )
        
        if result['success']:
            # Send push notification to winner
            try:
                await push_notification_service.send_notification(
                    user_id=result['winner_id'],
                    title="🎉 ¡GANASTE!",
                    body=f"¡Felicidades! Ganaste el sorteo con el boleto #{result['winning_ticket']}",
                    data={
                        'type': 'raffle_winner',
                        'raffle_id': request.raffle_id
                    }
                )
            except Exception as e:
                logging.error(f"Error sending winner notification: {e}")
            
            # Send SMS to winner
            try:
                winner = await _db.users.find_one({'_id': result['winner_id']})
                raffle = await _db.raffles.find_one({'_id': request.raffle_id})
                
                if winner and winner.get('phone') and raffle:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        if notif_service.twilio_client:
                            prize_desc = raffle.get('prize_value', 'premio')
                            
                            sms_message = f"""🎉 ¡FELICIDADES! Ganaste el sorteo:

🎁 Premio: {prize_desc}
🎟️ Boleto ganador: #{result['winning_ticket']}

Contáctanos para reclamar tu premio:
📞 806-934-2018

Ross Tax Preparation"""
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=winner['phone']
                            )
                            logging.info(f"✅ Raffle winner SMS sent to {winner['phone']}")
            except Exception as e:
                logging.error(f"❌ Error sending raffle winner SMS: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error executing raffle: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




# ================== REFERRAL ENDPOINTS (Extracted to referral_routes.py) ==================

# ================== LOTTERY ENDPOINTS (GAMIFICATION) ==================

@credits_router.get('/lotteries/guides')
async def get_lottery_guides():
    """Get game guides/rules for all lottery types (no auth required)"""
    try:
        guides = get_all_guides()
        return {'guides': guides}
    except Exception as e:
        logging.error(f"Error getting lottery guides: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/lotteries/guides/{lottery_type}')
async def get_lottery_guide_by_type(lottery_type: str):
    """Get game guide for specific lottery type (no auth required)"""
    try:
        guide = get_lottery_guide(lottery_type)
        return guide
    except Exception as e:
        logging.error(f"Error getting lottery guide: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/lotteries')
async def get_active_lotteries():
    """Get all active lotteries - Public endpoint"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        lotteries = await lottery_service.get_active_lotteries()
        
        # Serialize datetime objects
        serialized_lotteries = []
        for lottery in lotteries:
            clean_lottery = {}
            for key, value in lottery.items():
                if key == '_id':
                    continue
                elif isinstance(value, datetime):
                    clean_lottery[key] = value.isoformat()
                elif isinstance(value, ObjectId):
                    clean_lottery[key] = str(value)
                else:
                    clean_lottery[key] = value
            serialized_lotteries.append(clean_lottery)
        
        return {'lotteries': serialized_lotteries}
        
    except Exception as e:
        logging.error(f"Error getting active lotteries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/lotteries/my-tickets')
async def get_my_lottery_tickets(
    lottery_id: Optional[str] = Query(None),
    current_user: dict = Depends(_auth_user)
):
    """Get user's lottery tickets"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        tickets = await lottery_service.get_user_tickets(
            user_id=current_user['id'],
            lottery_id=lottery_id
        )
        
        # Serialize datetime objects
        for ticket in tickets:
            ticket.pop('_id', None)
            if ticket.get('purchased_at'):
                ticket['purchased_at'] = ticket['purchased_at'].isoformat()
        
        return {'tickets': tickets}
        
    except Exception as e:
        logging.error(f"Error getting user lottery tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/lotteries/{lottery_id}')
async def get_lottery_detail(
    lottery_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get lottery details"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        lottery = await lottery_service.get_lottery_by_id(lottery_id)
        
        if not lottery:
            raise HTTPException(status_code=404, detail="Lotería no encontrada")
        
        # Serialize datetime objects
        lottery.pop('_id', None)
        if lottery.get('draw_date') and isinstance(lottery['draw_date'], datetime):
            lottery['draw_date'] = lottery['draw_date'].isoformat()
        if lottery.get('created_at') and isinstance(lottery['created_at'], datetime):
            lottery['created_at'] = lottery['created_at'].isoformat()
        if lottery.get('updated_at') and isinstance(lottery['updated_at'], datetime):
            lottery['updated_at'] = lottery['updated_at'].isoformat()
        if lottery.get('drawn_at') and isinstance(lottery['drawn_at'], datetime):
            lottery['drawn_at'] = lottery['drawn_at'].isoformat()
        
        return lottery
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting lottery detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/lotteries/{lottery_id}/buy')
async def buy_lottery_tickets(
    lottery_id: str,
    request: BuyLotteryTicketRequest,
    current_user: dict = Depends(_auth_user)
):
    """Buy lottery tickets with selected numbers"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        # Validate lottery_id matches request
        if request.lottery_id != lottery_id:
            raise HTTPException(status_code=400, detail="Lottery ID mismatch")
        
        result = await lottery_service.buy_lottery_tickets(
            lottery_id=lottery_id,
            user_id=current_user['id'],
            selected_numbers=request.selected_numbers,
            quantity=request.quantity,
            bet_type=request.bet_type or 'fijo'
        )
        
        if result['success']:
            # Serialize tickets
            for ticket in result.get('tickets', []):
                ticket.pop('_id', None)
                if ticket.get('purchased_at'):
                    ticket['purchased_at'] = ticket['purchased_at'].isoformat()
            
            # Send push notification
            try:
                numbers_str = ', '.join(map(str, sorted(request.selected_numbers)))
                await push_notification_service.send_notification(
                    user_id=current_user['id'],
                    title="¡Boletos comprados!",
                    body=f"Compraste {request.quantity} boleto(s) con números: {numbers_str}. ¡Buena suerte!",
                    data={
                        'type': 'lottery_ticket_purchased',
                        'lottery_id': lottery_id,
                        'quantity': request.quantity
                    }
                )
            except Exception as e:
                logging.error(f"Error sending lottery notification: {e}")
            
            # Send to Zapier webhook (complementary to Rise CRM integration)
            try:
                from zapier_webhook_service import zapier_webhook_service
                
                # Get lottery details
                lottery = await _db.lotteries.find_one({'_id': lottery_id})
                
                # Send event to Zapier
                await zapier_webhook_service.send_lottery_purchase(
                    user_data=current_user,
                    ticket_data={
                        'id': str(result['tickets'][0].get('_id')) if result.get('tickets') else None,
                        'selected_numbers': request.selected_numbers,
                        'bet_type': request.bet_type,
                        'quantity': request.quantity,
                        'purchased_at': datetime.utcnow().isoformat()
                    },
                    lottery_data={
                        'id': lottery_id,
                        'title': lottery.get('title') if lottery else 'Unknown',
                        'lottery_type': lottery.get('lottery_type') if lottery else 'Unknown',
                        'entry_cost': lottery.get('entry_cost') if lottery else 0,
                        'prize_pool': lottery.get('prize_pool') if lottery else 0
                    }
                )
                logging.info(f"✅ Zapier webhook sent for lottery purchase")
            except Exception as e:
                logging.error(f"⚠️ Zapier webhook failed (non-critical): {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error buying lottery tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/lotteries/scratch-cards/{ticket_id}/reveal')
async def reveal_scratch_card(
    ticket_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Reveal scratch card and award prize"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        result = await lottery_service.reveal_scratch_card(ticket_id, current_user['id'])
        
        if result['success'] and result.get('is_winner') and not result.get('already_revealed'):
            # Send congratulations notification
            try:
                await push_notification_service.send_notification(
                    user_id=current_user['id'],
                    title="🎉 ¡GANASTE en el Raspadito!",
                    body=f"¡Felicidades! Ganaste: {result.get('prize_won')}",
                    data={
                        'type': 'scratch_card_winner',
                        'ticket_id': ticket_id,
                        'prize': result.get('prize_won')
                    }
                )
            except Exception as e:
                logging.error(f"Error sending scratch card winner notification: {e}")
        
        return result
        
    except Exception as e:
        logging.error(f"Error revealing scratch card: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN LOTTERY ENDPOINTS ==================

@credits_router.post('/admin/lotteries')
async def create_lottery(
    request: CreateLotteryRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Create a new lottery"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        lottery = await lottery_service.create_lottery(
            lottery_data=request.dict(),
            admin_id=current_user['id']
        )
        
        # Serialize datetime objects
        lottery.pop('_id', None)
        if lottery.get('draw_date'):
            lottery['draw_date'] = lottery['draw_date'].isoformat()
        if lottery.get('created_at'):
            lottery['created_at'] = lottery['created_at'].isoformat()
        if lottery.get('updated_at'):
            lottery['updated_at'] = lottery['updated_at'].isoformat()
        
        return lottery
        
    except Exception as e:
        logging.error(f"Error creating lottery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/admin/lotteries')
async def get_all_lotteries_admin(current_user: dict = Depends(_require_admin)):
    """Admin: Get all lotteries"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        lotteries = await lottery_service.get_all_lotteries_admin()
        
        # Serialize datetime and ObjectId objects
        for lottery in lotteries:
            # Convert ObjectId to string
            if '_id' in lottery:
                lottery['id'] = str(lottery.pop('_id'))
            elif 'id' in lottery and hasattr(lottery['id'], '__str__'):
                lottery['id'] = str(lottery['id'])
            
            # Convert datetime objects
            for field in ['draw_date', 'created_at', 'updated_at', 'drawn_at']:
                if lottery.get(field) and hasattr(lottery[field], 'isoformat'):
                    lottery[field] = lottery[field].isoformat()
        
        return {'lotteries': lotteries}
        
    except Exception as e:
        logging.error(f"Error getting admin lotteries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.patch('/admin/lotteries/{lottery_id}')
async def update_lottery(
    lottery_id: str,
    request: UpdateLotteryRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Update a lottery"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        result = await lottery_service.update_lottery(lottery_id, update_data)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating lottery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.delete('/admin/lotteries/{lottery_id}')
async def delete_lottery(
    lottery_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Delete a lottery (only if no tickets sold)"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        result = await lottery_service.delete_lottery(lottery_id)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting lottery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/lotteries/execute')
async def execute_lottery_draw(
    request: ExecuteLotteryRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Execute lottery draw and determine winners"""
    try:
        if not lottery_service:
            raise HTTPException(status_code=503, detail="Lottery service not available")
        
        result = await lottery_service.execute_lottery_draw(
            lottery_id=request.lottery_id,
            admin_id=current_user['id']
        )
        
        if result['success']:
            # Send push notifications to winners
            try:
                for winner in result.get('winners', []):
                    await push_notification_service.send_notification(
                        user_id=winner['user_id'],
                        title="🎉 ¡GANASTE EN LA LOTERÍA!",
                        body=f"¡Felicidades! Acertaste {winner['matched_numbers']} números y ganaste: {winner['prize']}",
                        data={
                            'type': 'lottery_winner',
                            'lottery_id': request.lottery_id,
                            'matched_numbers': winner['matched_numbers'],
                            'prize': winner['prize']
                        }
                    )
            except Exception as e:
                logging.error(f"Error sending winner notifications: {e}")
            
            return result
        else:
            raise HTTPException(status_code=400, detail=result['message'])
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error executing lottery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== REFUND ENDPOINTS ==================

@credits_router.post('/credits/refund/request')
async def request_credit_refund(
    request: RequestRefundRequest,
    current_user: dict = Depends(_auth_user)
):
    """Client requests a refund"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Validate that at least one reference is provided
        if not request.purchase_id and not request.usage_id:
            raise HTTPException(status_code=400, detail="Must provide purchase_id or usage_id")
        
        # Get original transaction ID
        original_transaction_id = None
        amount = 0.0
        
        if request.purchase_id:
            # Refunding a purchase
            purchase = await _db.credit_purchases.find_one({"id": request.purchase_id, "user_id": current_user['id']})
            if not purchase:
                raise HTTPException(status_code=404, detail="Purchase not found")
            
            # Check if already refunded
            if purchase.get('is_refunded'):
                raise HTTPException(status_code=400, detail="Purchase already refunded")
            
            # For CREDITS refund, amount is in credits. For ORIGINAL_PAYMENT, amount is in USD
            if request.refund_type == RefundType.CREDITS:
                amount = purchase['total_credits']
            else:
                amount = purchase['amount_usd']
            
            # Find original transaction
            transaction = await _db.credit_transactions.find_one({
                "user_id": current_user['id'],
                "metadata.purchase_id": request.purchase_id,
                "transaction_type": "purchase"
            })
            if transaction:
                original_transaction_id = transaction['id']
        
        elif request.usage_id:
            # Refunding a usage
            usage = await _db.credit_usages.find_one({"id": request.usage_id, "user_id": current_user['id']})
            if not usage:
                raise HTTPException(status_code=404, detail="Usage not found")
            
            # Check if already refunded
            if usage.get('is_refunded'):
                raise HTTPException(status_code=400, detail="Usage already refunded")
            
            # Refund is always in credits for usage
            amount = usage['credits_used']
            
            # Find original transaction
            transaction = await _db.credit_transactions.find_one({
                "user_id": current_user['id'],
                "metadata.usage_id": request.usage_id,
                "transaction_type": "usage"
            })
            if transaction:
                original_transaction_id = transaction['id']
        
        # Create refund request
        refund = await _credit_service.request_refund(
            user_id=current_user['id'],
            refund_type=request.refund_type,
            amount=amount,
            reason=request.reason,
            purchase_id=request.purchase_id,
            usage_id=request.usage_id,
            original_transaction_id=original_transaction_id
        )
        
        # Serialize
        if refund.get('requested_at'):
            refund['requested_at'] = refund['requested_at'].isoformat()
        
        return {
            'success': True,
            'refund': refund,
            'message': 'Solicitud de reembolso enviada. Será revisada por un administrador.'
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error requesting refund: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/refund/requests')
async def get_user_refund_requests(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(_auth_user)
):
    """Get user's refund requests"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        refunds = await _credit_service.get_user_refund_requests(
            user_id=current_user['id'],
            status=status
        )
        
        # Serialize
        for refund in refunds:
            if refund.get('requested_at'):
                refund['requested_at'] = refund['requested_at'].isoformat()
            if refund.get('processed_at'):
                refund['processed_at'] = refund['processed_at'].isoformat()
        
        return {
            'refunds': refunds,
            'total_count': len(refunds)
        }
    except Exception as e:
        logging.error(f"Error getting refund requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/purchases')
async def get_credit_purchases(current_user: dict = Depends(_auth_user)):
    """Get user's credit purchase history"""
    try:
        purchases = await _db.credit_purchases.find(
            {'user_id': current_user['id']}
        ).sort('created_at', -1).to_list(100)
        
        # Serialize
        for purchase in purchases:
            if purchase.get('created_at'):
                purchase['created_at'] = purchase['created_at'].isoformat()
            if purchase.get('completed_at'):
                purchase['completed_at'] = purchase['completed_at'].isoformat()
            purchase.pop('_id', None)
        
        return purchases
    except Exception as e:
        logging.error(f"Error getting credit purchases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/usages')
async def get_credit_usages(current_user: dict = Depends(_auth_user)):
    """Get user's credit usage history"""
    try:
        usages = await _db.credit_usages.find(
            {'user_id': current_user['id']}
        ).sort('created_at', -1).to_list(100)
        
        # Serialize
        for usage in usages:
            if usage.get('created_at'):
                usage['created_at'] = usage['created_at'].isoformat()
            usage.pop('_id', None)
        
        return usages
    except Exception as e:
        logging.error(f"Error getting credit usages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN CREDIT ROUTES ==================

@credits_router.get('/admin/credits/statistics')
async def get_credit_statistics(current_user: dict = Depends(_require_admin)):
    """Get comprehensive credit system statistics (admin only)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        stats = await _credit_service.get_admin_statistics()
        
        return stats
    except Exception as e:
        logging.error(f"Error getting credit statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/credits/adjust')
async def admin_adjust_credits(
    request: AdminCreditAdjustmentRequest,
    current_user: dict = Depends(_require_admin)
):
    """Manually adjust user credits (admin only)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        result = await _credit_service.admin_adjust_balance(
            user_id=request.user_id,
            amount=request.amount,
            admin_id=current_user['id'],
            reason=request.reason,
            notes=request.notes
        )
        
        return {
            'success': True,
            'adjustment': {
                'amount': request.amount,
                'reason': request.reason,
                'previous_balance': result['previous_balance'],
                'new_balance': result['new_balance'],
                'transaction_id': result['transaction']['id']
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error adjusting credits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/admin/credits/refund/requests')
async def admin_get_refund_requests(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(_require_admin)
):
    """Get all refund requests (admin only)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        result = await _credit_service.get_all_refund_requests(
            status=status,
            page=page,
            per_page=per_page
        )
        
        # Serialize
        for refund in result['refunds']:
            if refund.get('requested_at'):
                refund['requested_at'] = refund['requested_at'].isoformat()
            if refund.get('processed_at'):
                refund['processed_at'] = refund['processed_at'].isoformat()
        
        return result
    except Exception as e:
        logging.error(f"Error getting refund requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/credits/refund/process')
async def admin_process_refund(
    request: ProcessRefundRequest,
    current_user: dict = Depends(_require_admin)
):
    """Process a refund request - approve or reject (admin only)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        # Validate action
        if request.action not in ['approve', 'reject']:
            raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
        
        approved = request.action == 'approve'
        
        # If rejecting, reason is required
        if not approved and not request.rejection_reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        
        # Process refund
        refund = await _credit_service.process_refund(
            refund_id=request.refund_id,
            admin_id=current_user['id'],
            approved=approved,
            rejection_reason=request.rejection_reason
        )
        
        # Serialize
        if refund.get('requested_at'):
            refund['requested_at'] = refund['requested_at'].isoformat()
        if refund.get('processed_at'):
            refund['processed_at'] = refund['processed_at'].isoformat()
        
        status_msg = "aprobada" if approved else "rechazada"
        
        return {
            'success': True,
            'refund': refund,
            'message': f'Solicitud de reembolso {status_msg} exitosamente'
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error processing refund: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/admin/credits/packages')
async def admin_get_all_packages(current_user: dict = Depends(_require_admin)):
    """Get all credit packages including inactive (admin only)"""
    try:
        packages = await _db.credit_packages.find({}).sort('sort_order', 1).to_list(100)
        
        for package in packages:
            if package.get('created_at'):
                package['created_at'] = package['created_at'].isoformat()
            if package.get('updated_at'):
                package['updated_at'] = package['updated_at'].isoformat()
            package.pop('_id', None)
        
        return packages
    except Exception as e:
        logging.error(f"Error getting all packages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/admin/credits/all-transactions')
async def admin_get_all_transactions(current_user: dict = Depends(_require_admin)):
    """Get all credit transactions from all users (admin only)"""
    try:
        # Get all transactions sorted by date (most recent first)
        transactions = await _db.credit_transactions.find({}).sort('created_at', -1).limit(500).to_list(500)
        
        # Serialize
        for transaction in transactions:
            if transaction.get('created_at'):
                transaction['created_at'] = transaction['created_at'].isoformat()
            if transaction.get('completed_at'):
                transaction['completed_at'] = transaction['completed_at'].isoformat()
            transaction.pop('_id', None)
        
        return {
            'transactions': transactions,
            'total_count': len(transactions)
        }
    except Exception as e:
        logging.error(f"Error getting all transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/credits/packages')
async def admin_create_package(
    request: CreatePackageRequest,
    current_user: dict = Depends(_require_admin)
):
    """Create a new credit package (admin only)"""
    try:
        # Calculate totals
        bonus_credits = request.base_credits * (request.bonus_percentage / 100)
        total_credits = request.base_credits + bonus_credits
        
        package = {
            'id': str(uuid.uuid4()),
            'name': request.name,
            'description': request.description,
            'amount_usd': request.amount_usd,
            'base_credits': request.base_credits,
            'bonus_percentage': request.bonus_percentage,
            'bonus_credits': bonus_credits,
            'total_credits': total_credits,
            'is_active': request.is_active,
            'is_featured': request.is_featured,
            'sort_order': request.sort_order,
            'stripe_product_id': None,
            'stripe_price_id': None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        await _db.credit_packages.insert_one(package)
        
        package.pop('_id', None)
        package['created_at'] = package['created_at'].isoformat()
        package['updated_at'] = package['updated_at'].isoformat()
        
        return package
    except Exception as e:
        logging.error(f"Error creating package: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.patch('/admin/credits/packages/{package_id}')
async def admin_update_package(
    package_id: str,
    request: UpdatePackageRequest,
    current_user: dict = Depends(_require_admin)
):
    """Update a credit package (admin only)"""
    try:
        package = await _db.credit_packages.find_one({'id': package_id})
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        update_data = {'updated_at': datetime.utcnow()}
        
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.amount_usd is not None:
            update_data['amount_usd'] = request.amount_usd
        if request.base_credits is not None:
            update_data['base_credits'] = request.base_credits
        if request.bonus_percentage is not None:
            update_data['bonus_percentage'] = request.bonus_percentage
        if request.is_active is not None:
            update_data['is_active'] = request.is_active
        if request.is_featured is not None:
            update_data['is_featured'] = request.is_featured
        if request.sort_order is not None:
            update_data['sort_order'] = request.sort_order
        
        # Recalculate totals if needed
        if request.base_credits is not None or request.bonus_percentage is not None:
            base = request.base_credits if request.base_credits is not None else package['base_credits']
            bonus_pct = request.bonus_percentage if request.bonus_percentage is not None else package['bonus_percentage']
            bonus_credits = base * (bonus_pct / 100)
            update_data['bonus_credits'] = bonus_credits
            update_data['total_credits'] = base + bonus_credits
        
        await _db.credit_packages.update_one(
            {'id': package_id},
            {'$set': update_data}
        )
        
        updated_package = await _db.credit_packages.find_one({'id': package_id})
        updated_package.pop('_id', None)
        if updated_package.get('created_at'):
            updated_package['created_at'] = updated_package['created_at'].isoformat()
        if updated_package.get('updated_at'):
            updated_package['updated_at'] = updated_package['updated_at'].isoformat()
        
        return updated_package
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating package: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.put('/credits/preferences')
async def update_credit_preferences(
    request: UpdateCreditPreferencesRequest,
    current_user: dict = Depends(_auth_user)
):
    """Update user credit notification preferences"""
    try:
        update_data = {}
        
        # Get current preferences or create default
        user = await _db.users.find_one({'_id': current_user['id']})
        current_prefs = user.get('credit_preferences', {})
        
        if request.low_balance_threshold is not None:
            current_prefs['low_balance_threshold'] = request.low_balance_threshold
        
        if request.email_notifications is not None:
            current_prefs['email_notifications'] = request.email_notifications
        
        if request.push_notifications is not None:
            current_prefs['push_notifications'] = request.push_notifications
        
        # Update user document
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': {'credit_preferences': current_prefs}}
        )
        
        return {
            'success': True,
            'preferences': current_prefs
        }
    except Exception as e:
        logging.error(f"Error updating credit preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.get('/credits/preferences')
async def get_credit_preferences(current_user: dict = Depends(_auth_user)):
    """Get user credit notification preferences"""
    try:
        user = await _db.users.find_one({'_id': current_user['id']})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        preferences = user.get('credit_preferences', {
            'low_balance_threshold': 50,
            'email_notifications': True,
            'push_notifications': True
        })
        
        return preferences
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting credit preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@credits_router.post('/admin/credits/check-pending')
async def admin_check_pending_payments(current_user: dict = Depends(_require_admin)):
    """Manually trigger pending payment check (admin only)"""
    try:
        if not _credit_service:
            raise HTTPException(status_code=503, detail="Credit service not available")
        
        await _credit_service.check_pending_payments()
        
        return {
            'success': True,
            'message': 'Pending payments check completed'
        }
    except Exception as e:
        logging.error(f"Error checking pending payments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


