"""
Stripe Payment Service
Handles all Stripe operations for subscriptions and payments
"""
import stripe
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorDatabase
from payment_models import (
    BillingInterval, SubscriptionStatus, PaymentStatus,
    PricingPlan, CustomerSubscription, PaymentMethod, PaymentHistory
)
import uuid

load_dotenv()

class StripeService:
    """Service for Stripe operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.stripe_key = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize Stripe with API key from database"""
        try:
            config = await self.db.api_config.find_one({'_id': 'main'})
            if config and config.get('stripe_api_key'):
                self.stripe_key = config['stripe_api_key']
                stripe.api_key = self.stripe_key
                self.initialized = True
                print("✅ Stripe initialized successfully")
            else:
                print("⚠️ Stripe API key not found in configuration")
        except Exception as e:
            print(f"❌ Failed to initialize Stripe: {e}")
    
    def _check_initialized(self):
        """Check if Stripe is initialized"""
        if not self.initialized:
            raise Exception("Stripe not initialized. Please configure API key in admin settings.")
    
    def _get_stripe_interval(self, interval: BillingInterval) -> Dict[str, Any]:
        """Convert our interval to Stripe interval"""
        interval_map = {
            BillingInterval.WEEKLY: {"interval": "week", "interval_count": 1},
            BillingInterval.BIWEEKLY: {"interval": "week", "interval_count": 2},
            BillingInterval.MONTHLY: {"interval": "month", "interval_count": 1},
            BillingInterval.YEARLY: {"interval": "year", "interval_count": 1}
        }
        return interval_map.get(interval, {"interval": "month", "interval_count": 1})
    
    async def create_product_and_price(self, plan: PricingPlan) -> Dict[str, str]:
        """Create Stripe product and price for a plan"""
        self._check_initialized()
        
        try:
            # Create product
            product = stripe.Product.create(
                name=plan.name,
                description=plan.description,
                metadata={"plan_id": plan.id}
            )
            
            # Create price
            interval_config = self._get_stripe_interval(plan.interval)
            price = stripe.Price.create(
                product=product.id,
                unit_amount=int(plan.price * 100),  # Convert to cents
                currency="usd",
                recurring={
                    "interval": interval_config["interval"],
                    "interval_count": interval_config["interval_count"]
                },
                metadata={"plan_id": plan.id}
            )
            
            return {
                "product_id": product.id,
                "price_id": price.id
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def get_or_create_customer(self, user_id: str, email: str, name: str) -> str:
        """Get existing Stripe customer or create new one"""
        self._check_initialized()
        
        try:
            # Check if user already has a customer
            subscription = await self.db.subscriptions.find_one({"user_id": user_id})
            if subscription and subscription.get('stripe_customer_id'):
                return subscription['stripe_customer_id']
            
            # Create new customer
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"user_id": user_id}
            )
            
            return customer.id
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def attach_payment_method(self, customer_id: str, payment_method_id: str, set_as_default: bool = False):
        """Attach payment method to customer"""
        self._check_initialized()
        
        try:
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id
            )
            
            # Set as default if requested
            if set_as_default:
                stripe.Customer.modify(
                    customer_id,
                    invoice_settings={
                        'default_payment_method': payment_method_id
                    }
                )
            
            return True
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def create_subscription(
        self, 
        customer_id: str, 
        price_id: str, 
        payment_method_id: Optional[str] = None
    ) -> stripe.Subscription:
        """Create a Stripe subscription"""
        self._check_initialized()
        
        try:
            subscription_data = {
                "customer": customer_id,
                "items": [{"price": price_id}],
                "payment_behavior": "default_incomplete",
                "payment_settings": {
                    "save_default_payment_method": "on_subscription"
                },
                "expand": ["latest_invoice.payment_intent"]
            }
            
            if payment_method_id:
                subscription_data["default_payment_method"] = payment_method_id
            
            subscription = stripe.Subscription.create(**subscription_data)
            return subscription
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def cancel_subscription(self, subscription_id: str, at_period_end: bool = True):
        """Cancel a Stripe subscription"""
        self._check_initialized()
        
        try:
            if at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                subscription = stripe.Subscription.delete(subscription_id)
            
            return subscription
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def update_subscription(self, subscription_id: str, new_price_id: str):
        """Update subscription to a new plan"""
        self._check_initialized()
        
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            
            stripe.Subscription.modify(
                subscription_id,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'price': new_price_id,
                }],
                proration_behavior='create_prorations'
            )
            
            return True
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def retrieve_subscription(self, subscription_id: str) -> stripe.Subscription:
        """Retrieve subscription details from Stripe"""
        self._check_initialized()
        
        try:
            return stripe.Subscription.retrieve(subscription_id)
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def list_customer_payment_methods(self, customer_id: str) -> List[stripe.PaymentMethod]:
        """List all payment methods for a customer"""
        self._check_initialized()
        
        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id,
                type="card"
            )
            return payment_methods.data
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def detach_payment_method(self, payment_method_id: str):
        """Remove a payment method"""
        self._check_initialized()
        
        try:
            stripe.PaymentMethod.detach(payment_method_id)
            return True
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def retrieve_invoice(self, invoice_id: str):
        """Retrieve invoice details"""
        self._check_initialized()
        
        try:
            return stripe.Invoice.retrieve(invoice_id)
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def list_customer_invoices(self, customer_id: str, limit: int = 10):
        """List customer invoices"""
        self._check_initialized()
        
        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit
            )
            return invoices.data
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    def construct_webhook_event(self, payload: bytes, sig_header: str, webhook_secret: str):
        """Construct and verify webhook event"""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            return event
        except ValueError as e:
            raise Exception("Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            raise Exception("Invalid signature")
    
    async def create_payment_link(
        self,
        amount: float,
        description: str,
        invoice_id: str,
        customer_email: str = None,
        customer_name: str = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """Create a Stripe Checkout Session for invoice payment"""
        self._check_initialized()
        
        try:
            # Create a checkout session
            session_params = {
                'payment_method_types': ['card'],
                'line_items': [{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': description or 'Ross Lending Solutions',
                            'description': f'Factura #{invoice_id[:8].upper()}',
                        },
                        'unit_amount': int(amount * 100),  # Convert to cents
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
                'success_url': success_url or 'https://www.rosslending.com/pago-exitoso?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url': cancel_url or 'https://www.rosslending.com/pago-cancelado',
                'metadata': {
                    'invoice_id': invoice_id,
                    'type': 'invoice_payment'
                },
                'payment_intent_data': {
                    'metadata': {
                        'invoice_id': invoice_id
                    }
                }
            }
            
            if customer_email:
                session_params['customer_email'] = customer_email
            
            session = stripe.checkout.Session.create(**session_params)
            
            return {
                'session_id': session.id,
                'payment_url': session.url,
                'expires_at': session.expires_at
            }
            
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def create_payment_intent(
        self,
        amount: float,
        description: str,
        invoice_id: str,
        customer_id: str = None
    ) -> Dict[str, Any]:
        """Create a Stripe Payment Intent for direct payment"""
        self._check_initialized()
        
        try:
            intent_params = {
                'amount': int(amount * 100),
                'currency': 'usd',
                'description': description,
                'metadata': {
                    'invoice_id': invoice_id,
                    'type': 'invoice_payment'
                }
            }
            
            if customer_id:
                intent_params['customer'] = customer_id
            
            intent = stripe.PaymentIntent.create(**intent_params)
            
            return {
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id
            }
            
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")


# Singleton instance
_stripe_service: Optional[StripeService] = None

def get_stripe_service(db: AsyncIOMotorDatabase) -> StripeService:
    """Get or create StripeService instance"""
    global _stripe_service
    if _stripe_service is None:
        _stripe_service = StripeService(db)
    return _stripe_service
