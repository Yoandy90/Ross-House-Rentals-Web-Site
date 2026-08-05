"""
Ross Tax Credits Service
Maneja toda la lógica de negocio para el sistema de créditos
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import stripe
from credit_models import (
    CreditPackage, UserCreditBalance, CreditTransaction, CreditPurchase,
    CreditUsage, CreditRefund, TransactionType, TransactionStatus,
    PaymentStatus, RefundType, ServiceType
)
import uuid
import logging

logger = logging.getLogger(__name__)


class CreditService:
    """Service for managing credits system"""
    
    def __init__(self, db: AsyncIOMotorDatabase, stripe_api_key: str):
        self.db = db
        stripe.api_key = stripe_api_key
        self.low_balance_threshold = 50  # Default threshold for low balance alerts
    
    # ================== PACKAGES ==================
    
    async def get_active_packages(self) -> List[Dict[str, Any]]:
        """Get all active credit packages"""
        packages = await self.db.credit_packages.find(
            {"is_active": True}
        ).sort("sort_order", 1).to_list(100)
        return packages
    
    async def get_package_by_id(self, package_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific package"""
        return await self.db.credit_packages.find_one({"id": package_id})
    
    # ================== USER BALANCE ==================
    
    async def get_or_create_balance(self, user_id: str) -> Dict[str, Any]:
        """Get user balance or create if doesn't exist"""
        balance = await self.db.user_credit_balance.find_one({"user_id": user_id})
        
        if not balance:
            # Create new balance
            new_balance = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "balance": 0.0,
                "lifetime_purchased": 0.0,
                "lifetime_earned_credits": 0.0,
                "lifetime_spent": 0.0,
                "lifetime_bonus": 0.0,
                "first_purchase_completed": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "last_purchase_at": None,
                "last_usage_at": None
            }
            await self.db.user_credit_balance.insert_one(new_balance)
            return new_balance
        
        return balance
    
    async def update_balance(
        self,
        user_id: str,
        amount_change: float,
        transaction_type: TransactionType
    ) -> Dict[str, Any]:
        """Update user balance and return updated balance"""
        balance = await self.get_or_create_balance(user_id)
        
        new_balance = balance["balance"] + amount_change
        update_data = {
            "balance": new_balance,
            "updated_at": datetime.utcnow()
        }
        
        # Update lifetime stats
        if transaction_type == TransactionType.PURCHASE or transaction_type == TransactionType.BONUS:
            update_data["lifetime_earned_credits"] = balance.get("lifetime_earned_credits", 0) + amount_change
            update_data["last_purchase_at"] = datetime.utcnow()
            
            if transaction_type == TransactionType.BONUS:
                update_data["lifetime_bonus"] = balance.get("lifetime_bonus", 0) + amount_change
        
        elif transaction_type == TransactionType.USAGE:
            update_data["lifetime_spent"] = balance.get("lifetime_spent", 0) + abs(amount_change)
            update_data["last_usage_at"] = datetime.utcnow()
        
        await self.db.user_credit_balance.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        # Return updated balance
        return await self.get_or_create_balance(user_id)
    
    # ================== TRANSACTIONS ==================
    
    async def create_transaction(
        self,
        user_id: str,
        transaction_type: TransactionType,
        amount: float,
        description: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a credit transaction"""
        balance = await self.get_or_create_balance(user_id)
        balance_before = balance["balance"]
        balance_after = balance_before + amount
        
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "transaction_type": transaction_type.value,
            "amount": amount,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "status": TransactionStatus.PENDING.value,
            "description": description,
            "metadata": kwargs.get("metadata", {}),
            
            # Optional fields
            "package_id": kwargs.get("package_id"),
            "payment_amount_usd": kwargs.get("payment_amount_usd"),
            "stripe_payment_intent_id": kwargs.get("stripe_payment_intent_id"),
            "stripe_charge_id": kwargs.get("stripe_charge_id"),
            "stripe_customer_id": kwargs.get("stripe_customer_id"),
            "is_first_purchase_bonus": kwargs.get("is_first_purchase_bonus", False),
            
            "service_type": kwargs.get("service_type"),
            "service_id": kwargs.get("service_id"),
            "service_name": kwargs.get("service_name"),
            
            "refund_type": kwargs.get("refund_type"),
            "refunded_transaction_id": kwargs.get("refunded_transaction_id"),
            "stripe_refund_id": kwargs.get("stripe_refund_id"),
            
            "admin_id": kwargs.get("admin_id"),
            "admin_reason": kwargs.get("admin_reason"),
            
            "notes": kwargs.get("notes"),
            "created_at": datetime.utcnow(),
            "completed_at": None,
            "failed_at": None,
            "failure_reason": None
        }
        
        await self.db.credit_transactions.insert_one(transaction)
        return transaction
    
    async def complete_transaction(self, transaction_id: str) -> bool:
        """Mark transaction as completed"""
        result = await self.db.credit_transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": TransactionStatus.COMPLETED.value,
                "completed_at": datetime.utcnow()
            }}
        )
        return result.modified_count > 0
    
    async def fail_transaction(self, transaction_id: str, reason: str) -> bool:
        """Mark transaction as failed"""
        result = await self.db.credit_transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": TransactionStatus.FAILED.value,
                "failed_at": datetime.utcnow(),
                "failure_reason": reason
            }}
        )
        return result.modified_count > 0
    
    # ================== PURCHASE CREDITS ==================
    
    async def purchase_credits(
        self,
        user_id: str,
        package_id: str,
        payment_method_id: str,
        stripe_customer_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Purchase credits with Stripe"""
        
        # Get package
        package = await self.get_package_by_id(package_id)
        if not package:
            raise ValueError(f"Package {package_id} not found")
        
        if not package.get("is_active"):
            raise ValueError("Package is not active")
        
        # Get user balance
        balance = await self.get_or_create_balance(user_id)
        is_first_purchase = not balance.get("first_purchase_completed", False)
        
        # Calculate credits
        base_credits = package["base_credits"]
        bonus_credits = package["bonus_credits"]
        first_purchase_bonus = (base_credits + bonus_credits) * 0.10 if is_first_purchase else 0.0
        total_credits = base_credits + bonus_credits + first_purchase_bonus
        
        # Create Stripe Payment Intent
        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=int(package["amount_usd"] * 100),  # Convert to cents
                currency="usd",
                customer=stripe_customer_id,
                payment_method=payment_method_id,
                confirm=True,
                automatic_payment_methods={
                    "enabled": True,
                    "allow_redirects": "never"
                },
                metadata={
                    "user_id": user_id,
                    "package_id": package_id,
                    "credits": total_credits,
                    "is_first_purchase": str(is_first_purchase)
                },
                description=f"Ross Tax Credits - {package['name']}"
            )
        except stripe.error.StripeError as e:
            raise ValueError(f"Payment failed: {str(e)}")
        
        # Create purchase record
        purchase = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "package_id": package_id,
            "package_name": package["name"],
            "base_credits": base_credits,
            "bonus_credits": bonus_credits,
            "first_purchase_bonus": first_purchase_bonus,
            "total_credits": total_credits,
            "amount_usd": package["amount_usd"],
            "currency": "usd",
            "stripe_payment_intent_id": payment_intent.id,
            "stripe_customer_id": stripe_customer_id,
            "stripe_charge_id": payment_intent.charges.data[0].id if payment_intent.charges.data else None,
            "payment_status": PaymentStatus.SUCCEEDED.value if payment_intent.status == "succeeded" else PaymentStatus.PENDING.value,
            "is_first_purchase": is_first_purchase,
            "is_refunded": False,
            "created_at": datetime.utcnow(),
            "completed_at": datetime.utcnow() if payment_intent.status == "succeeded" else None,
            "transaction_ids": []
        }
        
        await self.db.credit_purchases.insert_one(purchase)
        
        # If payment succeeded, create transactions and update balance
        if payment_intent.status == "succeeded":
            # Create transaction for base + package bonus
            base_transaction = await self.create_transaction(
                user_id=user_id,
                transaction_type=TransactionType.PURCHASE,
                amount=base_credits + bonus_credits,
                description=f"Compra de {package['name']} - {base_credits + bonus_credits} créditos",
                package_id=package_id,
                payment_amount_usd=package["amount_usd"],
                stripe_payment_intent_id=payment_intent.id,
                stripe_charge_id=purchase["stripe_charge_id"],
                stripe_customer_id=stripe_customer_id,
                metadata={"purchase_id": purchase["id"]}
            )
            
            # Update balance
            await self.update_balance(user_id, base_credits + bonus_credits, TransactionType.PURCHASE)
            await self.complete_transaction(base_transaction["id"])
            
            purchase["transaction_ids"].append(base_transaction["id"])
            
            # Create transaction for first purchase bonus if applicable
            if is_first_purchase and first_purchase_bonus > 0:
                bonus_transaction = await self.create_transaction(
                    user_id=user_id,
                    transaction_type=TransactionType.BONUS,
                    amount=first_purchase_bonus,
                    description=f"Bonus de primera compra (10%) - {first_purchase_bonus} créditos",
                    package_id=package_id,
                    is_first_purchase_bonus=True,
                    metadata={"purchase_id": purchase["id"]}
                )
                
                # Update balance
                await self.update_balance(user_id, first_purchase_bonus, TransactionType.BONUS)
                await self.complete_transaction(bonus_transaction["id"])
                
                purchase["transaction_ids"].append(bonus_transaction["id"])
                
                # Mark first purchase as completed
                await self.db.user_credit_balance.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "first_purchase_completed": True,
                        "lifetime_purchased": balance.get("lifetime_purchased", 0) + package["amount_usd"]
                    }}
                )
            else:
                # Update lifetime purchased
                await self.db.user_credit_balance.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "lifetime_purchased": balance.get("lifetime_purchased", 0) + package["amount_usd"]
                    }}
                )
            
            # Update purchase with transaction IDs
            await self.db.credit_purchases.update_one(
                {"id": purchase["id"]},
                {"$set": {"transaction_ids": purchase["transaction_ids"]}}
            )
            
            # Send purchase success notification
            new_balance = await self.get_or_create_balance(user_id)
            send_email = package["amount_usd"] >= 100  # Send email for purchases >= $100
            
            await self._send_credit_notification(
                user_id=user_id,
                title="✅ ¡Compra Exitosa!",
                body=f"Has recibido {int(total_credits)} créditos. Nuevo balance: {int(new_balance['balance'])} créditos.",
                notification_type='credit_purchase',
                data={
                    'purchase_id': purchase["id"],
                    'package_name': package['name'],
                    'amount_usd': package["amount_usd"],
                    'base_credits': base_credits,
                    'bonus_credits': bonus_credits,
                    'first_purchase_bonus': first_purchase_bonus,
                    'total_credits': total_credits,
                    'new_balance': new_balance['balance']
                },
                send_email=send_email
            )
            
            # Send first purchase bonus notification separately if applicable
            if is_first_purchase and first_purchase_bonus > 0:
                await self._send_credit_notification(
                    user_id=user_id,
                    title="🎉 ¡Bonus de Primera Compra!",
                    body=f"¡Felicitaciones! Has recibido {int(first_purchase_bonus)} créditos extra como bonus de primera compra (10%).",
                    notification_type='credit_bonus',
                    data={
                        'purchase_id': purchase["id"],
                        'bonus_amount': first_purchase_bonus,
                        'bonus_percentage': 10,
                        'is_first_purchase': True
                    }
                )
        
        return purchase
    
    # ================== USE CREDITS ==================
    
    async def use_credits(
        self,
        user_id: str,
        service_type: ServiceType,
        service_id: str,
        service_name: str,
        service_description: str,
        credits_to_use: float,
        metadata: Dict[str, Any] = {}
    ) -> Dict[str, Any]:
        """Use credits for a service"""
        
        # Check balance
        balance = await self.get_or_create_balance(user_id)
        if balance["balance"] < credits_to_use:
            raise ValueError(f"Insufficient credits. Available: {balance['balance']}, Required: {credits_to_use}")
        
        # Create usage record
        usage = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "service_type": service_type.value,
            "service_id": service_id,
            "service_name": service_name,
            "service_description": service_description,
            "credits_used": credits_to_use,
            "is_refunded": False,
            "metadata": metadata,
            "created_at": datetime.utcnow(),
            "refunded_at": None,
            "transaction_id": None
        }
        
        await self.db.credit_usages.insert_one(usage)
        
        # Create transaction
        transaction = await self.create_transaction(
            user_id=user_id,
            transaction_type=TransactionType.USAGE,
            amount=-credits_to_use,  # Negative for deduction
            description=f"Uso de créditos: {service_name}",
            service_type=service_type.value,
            service_id=service_id,
            service_name=service_name,
            metadata={"usage_id": usage["id"], **metadata}
        )
        
        # Update balance
        await self.update_balance(user_id, -credits_to_use, TransactionType.USAGE)
        await self.complete_transaction(transaction["id"])
        
        # Link transaction to usage
        await self.db.credit_usages.update_one(
            {"id": usage["id"]},
            {"$set": {"transaction_id": transaction["id"]}}
        )
        
        # Get updated balance
        new_balance = await self.get_or_create_balance(user_id)
        
        # Send usage notification
        await self._send_credit_notification(
            user_id=user_id,
            title="💳 Créditos Utilizados",
            body=f"Has usado {int(credits_to_use)} créditos para {service_name}. Balance restante: {int(new_balance['balance'])} créditos.",
            notification_type='credit_usage',
            data={
                'usage_id': usage["id"],
                'service_name': service_name,
                'service_type': service_type.value,
                'credits_used': credits_to_use,
                'new_balance': new_balance['balance']
            }
        )
        
        # Check for low balance and send alert if needed
        await self._check_and_alert_low_balance(user_id, new_balance['balance'])
        
        return usage
    
    # ================== SERVICE PRICES ==================
    
    async def get_service_prices(self, is_active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all service prices"""
        from bson import ObjectId
        from datetime import datetime
        
        query = {"is_active": True} if is_active_only else {}
        prices = await self.db.service_prices.find(query).to_list(100)
        
        # Serialize ObjectId and datetime fields
        serialized_prices = []
        for price in prices:
            serialized = {}
            for key, value in price.items():
                if isinstance(value, ObjectId):
                    serialized[key] = str(value)
                elif isinstance(value, datetime):
                    serialized[key] = value.isoformat()
                elif hasattr(value, 'isoformat'):  # Any datetime-like object
                    serialized[key] = value.isoformat()
                else:
                    serialized[key] = value
            serialized_prices.append(serialized)
        
        return serialized_prices
    
    async def get_service_price(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get price for a specific service"""
        return await self.db.service_prices.find_one({"_id": service_id})
    
    async def use_credits_for_service(
        self,
        user_id: str,
        service_price_id: str,
        service_instance_id: str,
        additional_metadata: Dict[str, Any] = {}
    ) -> Dict[str, Any]:
        """
        Use credits to pay for a service
        Args:
            user_id: User's ID
            service_price_id: ID from service_prices collection (e.g., 'tax_return_standard')
            service_instance_id: ID of the specific service instance (e.g., tax return ID)
            additional_metadata: Additional metadata to store
        """
        # Get service price
        service_price = await self.get_service_price(service_price_id)
        if not service_price:
            raise ValueError(f"Service price not found: {service_price_id}")
        
        if not service_price.get("is_active", False):
            raise ValueError(f"Service is not available: {service_price['name']}")
        
        # Use credits
        usage = await self.use_credits(
            user_id=user_id,
            service_type=ServiceType(service_price["service_type"]),
            service_id=service_instance_id,
            service_name=service_price["name"],
            service_description=service_price["description"],
            credits_to_use=service_price["price_credits"],
            metadata={
                "service_price_id": service_price_id,
                **additional_metadata
            }
        )
        
        return {
            "usage": usage,
            "service_price": service_price,
            "credits_used": service_price["price_credits"]
        }
    
    # ================== HISTORY ==================
    
    async def get_transaction_history(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Get user's transaction history"""
        skip = (page - 1) * per_page
        
        # Query para incluir tanto transacciones regulares (user_id) como transferencias P2P (sender_id/recipient_id)
        query = {
            "$or": [
                {"user_id": user_id},
                {"sender_id": user_id},
                {"recipient_id": user_id}
            ]
        }
        
        transactions = await self.db.credit_transactions.find(
            query
        ).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
        
        # Normalizar transacciones para el frontend
        for txn in transactions:
            # Si es una transferencia P2P, agregar campos normalizados
            if txn.get('type') == 'transfer':
                if txn.get('sender_id') == user_id:
                    # Usuario es el que envía
                    txn['transaction_type'] = 'transfer_sent'
                    txn['user_id'] = user_id
                    txn['amount'] = -txn['amount']  # Negativo para envío
                    if txn.get('note'):
                        txn['description'] = f"Transferencia enviada: {txn.get('note')}"
                    else:
                        txn['description'] = "Transferencia enviada"
                elif txn.get('recipient_id') == user_id:
                    # Usuario es el que recibe
                    txn['transaction_type'] = 'transfer_received'
                    txn['user_id'] = user_id
                    if txn.get('note'):
                        txn['description'] = f"Transferencia recibida: {txn.get('note')}"
                    else:
                        txn['description'] = "Transferencia recibida"
        
        total_count = await self.db.credit_transactions.count_documents(query)
        
        balance = await self.get_or_create_balance(user_id)
        
        return {
            "transactions": transactions,
            "total_count": total_count,
            "current_balance": balance["balance"],
            "page": page,
            "per_page": per_page
        }
    
    # ================== ADMIN STATISTICS ==================
    
    async def get_admin_statistics(self) -> Dict[str, Any]:
        """Get comprehensive credit system statistics for admin dashboard"""
        
        # Get all balances
        all_balances = await self.db.user_credit_balances.find({}).to_list(10000)
        
        # Calculate totals
        total_credits_in_circulation = sum(b.get("balance", 0) for b in all_balances)
        total_lifetime_purchased = sum(b.get("lifetime_purchased", 0) for b in all_balances)
        total_lifetime_spent = sum(b.get("lifetime_spent", 0) for b in all_balances)
        total_lifetime_bonus = sum(b.get("lifetime_bonus", 0) for b in all_balances)
        total_users_with_credits = len([b for b in all_balances if b.get("balance", 0) > 0])
        
        # Get all purchases
        all_purchases = await self.db.credit_purchases.find(
            {"status": "completed"}
        ).to_list(10000)
        
        total_revenue = sum(p.get("amount_usd", 0) for p in all_purchases)
        total_purchases_count = len(all_purchases)
        
        # Get top purchasers (top 10)
        user_purchase_totals = {}
        for purchase in all_purchases:
            user_id = purchase.get("user_id")
            # Convert ObjectId to string if needed
            if user_id:
                user_id = str(user_id)
            amount = purchase.get("amount_usd", 0)
            if user_id in user_purchase_totals:
                user_purchase_totals[user_id] += amount
            else:
                user_purchase_totals[user_id] = amount
        
        top_purchasers = sorted(
            [{"user_id": uid, "total_spent": amt} for uid, amt in user_purchase_totals.items()],
            key=lambda x: x["total_spent"],
            reverse=True
        )[:10]
        
        # Get usage statistics
        all_usages = await self.db.credit_usages.find({}).to_list(10000)
        total_credits_used = sum(u.get("credits_used", 0) for u in all_usages)
        
        # Service usage breakdown
        service_usage = {}
        for usage in all_usages:
            service_type = usage.get("service_type", "unknown")
            credits = usage.get("credits_used", 0)
            if service_type in service_usage:
                service_usage[service_type]["count"] += 1
                service_usage[service_type]["total_credits"] += credits
            else:
                service_usage[service_type] = {"count": 1, "total_credits": credits}
        
        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_purchases = await self.db.credit_purchases.count_documents({
            "created_at": {"$gte": thirty_days_ago},
            "status": "completed"
        })
        
        recent_usages = await self.db.credit_usages.count_documents({
            "created_at": {"$gte": thirty_days_ago}
        })
        
        # Package statistics
        all_packages = await self.db.credit_packages.find({}).to_list(100)
        
        package_sales = {}
        for purchase in all_purchases:
            pkg_id = purchase.get("package_id")
            if pkg_id:
                # Convert to string if it's an ObjectId
                pkg_id_str = str(pkg_id)
                if pkg_id_str in package_sales:
                    package_sales[pkg_id_str] += 1
                else:
                    package_sales[pkg_id_str] = 1
        
        package_stats = []
        for pkg in all_packages:
            pkg_id = pkg.get("_id")
            if pkg_id:
                pkg_id_str = str(pkg_id)  # Convert ObjectId to string
            else:
                pkg_id_str = pkg.get("id", "unknown")
            
            package_stats.append({
                "package_id": pkg_id_str,
                "name": pkg.get("name"),
                "amount_usd": pkg.get("amount_usd"),
                "total_credits": pkg.get("total_credits"),
                "sales_count": package_sales.get(pkg_id_str, 0),
                "is_active": pkg.get("is_active", False)
            })
        
        # Refund statistics
        all_refunds = await self.db.credit_refunds.find({}).to_list(1000)
        pending_refunds = len([r for r in all_refunds if r.get("status") == "pending"])
        completed_refunds = len([r for r in all_refunds if r.get("status") == "completed"])
        rejected_refunds = len([r for r in all_refunds if r.get("status") == "rejected"])
        
        total_refunded_amount = sum(
            r.get("amount", 0) for r in all_refunds if r.get("status") == "completed"
        )
        
        return {
            "overview": {
                "total_credits_in_circulation": round(total_credits_in_circulation, 2),
                "total_lifetime_purchased": round(total_lifetime_purchased, 2),
                "total_lifetime_spent": round(total_lifetime_spent, 2),
                "total_lifetime_bonus": round(total_lifetime_bonus, 2),
                "total_users_with_credits": total_users_with_credits,
                "total_users": len(all_balances)
            },
            "revenue": {
                "total_revenue_usd": round(total_revenue, 2),
                "total_purchases": total_purchases_count,
                "average_purchase_value": round(total_revenue / total_purchases_count, 2) if total_purchases_count > 0 else 0
            },
            "usage": {
                "total_credits_used": round(total_credits_used, 2),
                "service_breakdown": service_usage,
                "total_services_purchased": len(all_usages)
            },
            "recent_activity": {
                "purchases_last_30_days": recent_purchases,
                "usages_last_30_days": recent_usages
            },
            "top_purchasers": top_purchasers,
            "package_statistics": package_stats,
            "refunds": {
                "pending": pending_refunds,
                "completed": completed_refunds,
                "rejected": rejected_refunds,
                "total_refunded_credits": round(total_refunded_amount, 2)
            }
        }
    
    # ================== ADMIN PACKAGE MANAGEMENT ==================
    
    async def create_package(
        self,
        name: str,
        description: str,
        amount_usd: float,
        base_credits: float,
        bonus_percentage: float = 0.0,
        is_first_purchase_bonus: bool = False,
        sort_order: int = 0
    ) -> Dict[str, Any]:
        """Create a new credit package"""
        
        total_credits = base_credits + (base_credits * bonus_percentage / 100)
        
        package = {
            "_id": f"package_{int(datetime.utcnow().timestamp())}",
            "name": name,
            "description": description,
            "amount_usd": amount_usd,
            "base_credits": base_credits,
            "bonus_percentage": bonus_percentage,
            "total_credits": total_credits,
            "is_active": True,
            "is_first_purchase_bonus": is_first_purchase_bonus,
            "sort_order": sort_order,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.db.credit_packages.insert_one(package)
        
        return package
    
    async def update_package(
        self,
        package_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing package"""
        
        # Recalculate total_credits if base_credits or bonus_percentage changed
        if "base_credits" in updates or "bonus_percentage" in updates:
            package = await self.db.credit_packages.find_one({"_id": package_id})
            if not package:
                raise ValueError(f"Package not found: {package_id}")
            
            base_credits = updates.get("base_credits", package.get("base_credits", 0))
            bonus_percentage = updates.get("bonus_percentage", package.get("bonus_percentage", 0))
            updates["total_credits"] = base_credits + (base_credits * bonus_percentage / 100)
        
        updates["updated_at"] = datetime.utcnow()
        
        await self.db.credit_packages.update_one(
            {"_id": package_id},
            {"$set": updates}
        )
        
        return await self.db.credit_packages.find_one({"_id": package_id})
    
    async def toggle_package_status(self, package_id: str) -> Dict[str, Any]:
        """Toggle package active status"""
        package = await self.db.credit_packages.find_one({"_id": package_id})
        if not package:
            raise ValueError(f"Package not found: {package_id}")
        
        new_status = not package.get("is_active", False)
        
        await self.db.credit_packages.update_one(
            {"_id": package_id},
            {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
        )
        
        return await self.db.credit_packages.find_one({"_id": package_id})
    
    # ================== ADMIN BALANCE ADJUSTMENTS ==================
    
    async def admin_adjust_balance(
        self,
        user_id: str,
        amount: float,
        admin_id: str,
        reason: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Admin manually adjusts user credit balance
        Positive amount = add credits, Negative amount = deduct credits
        """
        
        # Get or create balance
        balance = await self.get_or_create_balance(user_id)
        
        # Validate sufficient balance for deductions
        if amount < 0 and balance["balance"] < abs(amount):
            raise ValueError(f"Insufficient balance. User has {balance['balance']} credits, trying to deduct {abs(amount)}")
        
        # Create transaction
        transaction_type = TransactionType.BONUS if amount > 0 else TransactionType.USAGE
        
        transaction = await self.create_transaction(
            user_id=user_id,
            transaction_type=transaction_type,
            amount=abs(amount),
            description=f"Ajuste manual por admin: {reason}",
            admin_id=admin_id,
            admin_reason=reason,
            metadata={
                "adjustment_type": "admin_manual",
                "notes": notes,
                "original_balance": balance["balance"]
            }
        )
        
        # Update balance
        await self.update_balance(user_id, amount, transaction_type)
        
        # Complete transaction
        await self.complete_transaction(transaction["id"])
        
        # Get updated balance
        updated_balance = await self.get_or_create_balance(user_id)
        
        return {
            "transaction": transaction,
            "previous_balance": balance["balance"],
            "new_balance": updated_balance["balance"],
            "adjustment_amount": amount
        }
    
    # ================== REFUNDS ==================
    
    async def request_refund(
        self,
        user_id: str,
        refund_type: RefundType,
        amount: float,
        reason: str,
        purchase_id: Optional[str] = None,
        usage_id: Optional[str] = None,
        original_transaction_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        User requests a refund
        Args:
            user_id: User's ID
            refund_type: CREDITS or ORIGINAL_PAYMENT
            amount: Amount to refund (in credits or USD)
            reason: User's reason for refund
            purchase_id: Optional - if refunding a purchase
            usage_id: Optional - if refunding a service usage
            original_transaction_id: Optional - original transaction to refund
        """
        # Validate that at least one reference is provided
        if not purchase_id and not usage_id and not original_transaction_id:
            raise ValueError("Must provide purchase_id, usage_id, or original_transaction_id")
        
        # Create refund request
        refund_request = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "refund_type": refund_type.value,
            "amount": amount,
            "reason": reason,
            "purchase_id": purchase_id,
            "usage_id": usage_id,
            "original_transaction_id": original_transaction_id,
            "status": "pending",
            "requested_by": user_id,
            "approved_by": None,
            "rejection_reason": None,
            "stripe_refund_id": None,
            "requested_at": datetime.utcnow(),
            "processed_at": None,
            "refund_transaction_id": None
        }
        
        await self.db.credit_refunds.insert_one(refund_request)
        
        return refund_request
    
    async def get_user_refund_requests(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get user's refund requests"""
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        
        refunds = await self.db.credit_refunds.find(query).sort("requested_at", -1).to_list(100)
        return refunds
    
    async def get_all_refund_requests(
        self,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Get all refund requests (admin)"""
        query = {}
        if status:
            query["status"] = status
        
        skip = (page - 1) * per_page
        
        refunds = await self.db.credit_refunds.find(query).sort("requested_at", -1).skip(skip).limit(per_page).to_list(per_page)
        total_count = await self.db.credit_refunds.count_documents(query)
        
        return {
            "refunds": refunds,
            "total_count": total_count,
            "page": page,
            "per_page": per_page
        }
    
    async def process_refund(
        self,
        refund_id: str,
        admin_id: str,
        approved: bool,
        rejection_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Admin processes a refund request
        Args:
            refund_id: Refund request ID
            admin_id: Admin processing the refund
            approved: True to approve, False to reject
            rejection_reason: Required if rejected
        """
        # Get refund request
        refund = await self.db.credit_refunds.find_one({"id": refund_id})
        if not refund:
            raise ValueError(f"Refund request not found: {refund_id}")
        
        if refund["status"] != "pending":
            raise ValueError(f"Refund already processed with status: {refund['status']}")
        
        if not approved:
            # Reject refund
            await self.db.credit_refunds.update_one(
                {"id": refund_id},
                {"$set": {
                    "status": "rejected",
                    "approved_by": admin_id,
                    "rejection_reason": rejection_reason or "No reason provided",
                    "processed_at": datetime.utcnow()
                }}
            )
            
            # Send rejection notification
            await self._send_credit_notification(
                user_id=refund["user_id"],
                title="❌ Solicitud de Reembolso Rechazada",
                body=f"Tu solicitud de reembolso por {int(refund['amount'])} créditos ha sido rechazada. Motivo: {rejection_reason or 'No especificado'}",
                notification_type='credit_refund',
                data={
                    'refund_id': refund_id,
                    'amount': refund["amount"],
                    'status': 'rejected',
                    'rejection_reason': rejection_reason
                }
            )
            
            return await self.db.credit_refunds.find_one({"id": refund_id})
        
        # Approve refund
        refund_type = RefundType(refund["refund_type"])
        
        if refund_type == RefundType.CREDITS:
            # Refund as credits - add credits to user balance
            transaction = await self.create_transaction(
                user_id=refund["user_id"],
                transaction_type=TransactionType.REFUND,
                amount=refund["amount"],
                description=f"Reembolso en créditos: {refund['reason']}",
                refund_type=refund_type.value,
                refunded_transaction_id=refund["original_transaction_id"],
                metadata={
                    "refund_id": refund_id,
                    "original_purchase_id": refund.get("purchase_id"),
                    "original_usage_id": refund.get("usage_id")
                }
            )
            
            # Update balance
            await self.update_balance(refund["user_id"], refund["amount"], TransactionType.REFUND)
            await self.complete_transaction(transaction["id"])
            
            # Update refund request
            await self.db.credit_refunds.update_one(
                {"id": refund_id},
                {"$set": {
                    "status": "completed",
                    "approved_by": admin_id,
                    "processed_at": datetime.utcnow(),
                    "refund_transaction_id": transaction["id"]
                }}
            )
            
            # Get updated balance
            new_balance = await self.get_or_create_balance(refund["user_id"])
            
            # Send approval notification
            await self._send_credit_notification(
                user_id=refund["user_id"],
                title="✅ Reembolso Aprobado",
                body=f"Tu reembolso de {int(refund['amount'])} créditos ha sido aprobado. Nuevo balance: {int(new_balance['balance'])} créditos.",
                notification_type='credit_refund',
                data={
                    'refund_id': refund_id,
                    'amount': refund["amount"],
                    'refund_type': 'credits',
                    'status': 'completed',
                    'new_balance': new_balance['balance']
                }
            )
            
        elif refund_type == RefundType.ORIGINAL_PAYMENT:
            # Refund to original payment method (Stripe)
            # Get original purchase to find Stripe payment intent
            if not refund.get("purchase_id"):
                raise ValueError("Purchase ID required for original payment refund")
            
            purchase = await self.db.credit_purchases.find_one({"id": refund["purchase_id"]})
            if not purchase:
                raise ValueError(f"Purchase not found: {refund['purchase_id']}")
            
            # Process Stripe refund
            try:
                stripe_refund = stripe.Refund.create(
                    payment_intent=purchase["stripe_payment_intent_id"],
                    amount=int(refund["amount"] * 100),  # Convert to cents
                    reason="requested_by_customer",
                    metadata={
                        "refund_id": refund_id,
                        "user_id": refund["user_id"]
                    }
                )
                
                # Deduct credits from user balance (they were already given)
                # Calculate how many credits to deduct based on the purchase
                credits_to_deduct = (refund["amount"] / purchase["amount_usd"]) * purchase["total_credits"]
                
                transaction = await self.create_transaction(
                    user_id=refund["user_id"],
                    transaction_type=TransactionType.REFUND,
                    amount=-credits_to_deduct,  # Negative to deduct
                    description=f"Reembolso a método de pago original: {refund['reason']}",
                    refund_type=refund_type.value,
                    refunded_transaction_id=refund["original_transaction_id"],
                    stripe_refund_id=stripe_refund.id,
                    metadata={
                        "refund_id": refund_id,
                        "original_purchase_id": refund["purchase_id"],
                        "stripe_refund_amount_usd": refund["amount"]
                    }
                )
                
                # Update balance (deduct credits)
                await self.update_balance(refund["user_id"], -credits_to_deduct, TransactionType.REFUND)
                await self.complete_transaction(transaction["id"])
                
                # Update refund request
                await self.db.credit_refunds.update_one(
                    {"id": refund_id},
                    {"$set": {
                        "status": "completed",
                        "approved_by": admin_id,
                        "processed_at": datetime.utcnow(),
                        "stripe_refund_id": stripe_refund.id,
                        "refund_transaction_id": transaction["id"]
                    }}
                )
                
                # Send approval notification
                await self._send_credit_notification(
                    user_id=refund["user_id"],
                    title="✅ Reembolso Procesado",
                    body=f"Tu reembolso de ${refund['amount']:.2f} USD ha sido procesado a tu método de pago original. Los créditos correspondientes han sido deducidos de tu balance.",
                    notification_type='credit_refund',
                    data={
                        'refund_id': refund_id,
                        'amount_usd': refund["amount"],
                        'credits_deducted': credits_to_deduct,
                        'refund_type': 'original_payment',
                        'status': 'completed',
                        'stripe_refund_id': stripe_refund.id
                    },
                    send_email=True  # Always send email for financial refunds
                )
                
            except stripe.error.StripeError as e:
                # Stripe refund failed
                await self.db.credit_refunds.update_one(
                    {"id": refund_id},
                    {"$set": {
                        "status": "rejected",
                        "approved_by": admin_id,
                        "rejection_reason": f"Stripe refund failed: {str(e)}",
                        "processed_at": datetime.utcnow()
                    }}
                )
                raise ValueError(f"Stripe refund failed: {str(e)}")
        
        return await self.db.credit_refunds.find_one({"id": refund_id})
    
    # ================== NOTIFICATION HELPERS ==================
    
    async def _send_credit_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        data: Dict[str, Any] = None,
        send_email: bool = False
    ):
        """
        Helper function to send credit-related notifications
        
        Args:
            user_id: User ID to send notification to
            title: Notification title
            body: Notification body
            notification_type: Type of notification (credit_purchase, credit_usage, etc.)
            data: Additional data to include
            send_email: Whether to also send email notification
        """
        try:
            # Create in-app notification
            notification = {
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'title': title,
                'body': body,
                'data': data or {},
                'type': notification_type,
                'read': False,
                'created_at': datetime.utcnow(),
            }
            
            await self.db.notifications.insert_one(notification)
            logger.info(f"Credit notification created for user {user_id}: {notification_type}")
            
            # Get user details for push notification
            user = await self.db.users.find_one({'id': user_id})
            if not user:
                logger.warning(f"User {user_id} not found for notification")
                return
            
            # Check notification preferences
            preferences = user.get('notification_preferences', {})
            credits_enabled = preferences.get('credits', True)
            
            if not credits_enabled:
                logger.info(f"Credit notifications disabled for user {user_id}")
                return
            
            # Send push notification if user has push token and push enabled
            if user.get('push_token') and user.get('push_enabled', True):
                try:
                    # Import push notification service here to avoid circular imports
                    from push_notification_service import send_push_notification
                    
                    await send_push_notification(
                        push_token=user['push_token'],
                        title=title,
                        body=body,
                        data=data or {}
                    )
                    logger.info(f"Push notification sent for {notification_type}")
                except Exception as e:
                    logger.error(f"Failed to send push notification: {str(e)}")
            
            # Send email if requested and for large purchases
            if send_email and user.get('email'):
                try:
                    # Import notification service here
                    from notification_service import NotificationService
                    
                    # Get notification config from database
                    config = await self.db.api_config.find_one({'_id': 'main'})
                    if config:
                        notif_service = NotificationService(config)
                        await notif_service.send_email(
                            to_email=user['email'],
                            to_name=user.get('name', 'Cliente'),
                            subject=title,
                            body_html=f"<h2>{title}</h2><p>{body}</p>",
                            body_text=body
                        )
                        logger.info(f"Email notification sent for {notification_type}")
                except Exception as e:
                    logger.error(f"Failed to send email notification: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error sending credit notification: {str(e)}")
    
    async def _check_and_alert_low_balance(self, user_id: str, current_balance: float):
        """
        Check if balance is low and send alert if needed
        
        Args:
            user_id: User ID to check
            current_balance: Current credit balance
        """
        try:
            # Get user's low balance threshold (default 50)
            user = await self.db.users.find_one({'id': user_id})
            if not user:
                return
            
            # Get custom threshold from user preferences or use default
            user_prefs = user.get('credit_preferences', {})
            threshold = user_prefs.get('low_balance_threshold', self.low_balance_threshold)
            
            # Check if we should send alert
            if current_balance <= threshold and current_balance > 0:
                # Check if we already sent a recent alert (within last 24 hours)
                last_alert = await self.db.credit_low_balance_alerts.find_one({
                    'user_id': user_id,
                    'created_at': {'$gte': datetime.utcnow() - timedelta(hours=24)}
                })
                
                if not last_alert:
                    # Send low balance notification
                    await self._send_credit_notification(
                        user_id=user_id,
                        title="⚠️ Saldo Bajo de Créditos",
                        body=f"Te quedan solo {int(current_balance)} créditos. ¡Recarga ahora para continuar usando nuestros servicios!",
                        notification_type='credit_low_balance',
                        data={
                            'current_balance': current_balance,
                            'threshold': threshold,
                            'action': 'recharge'
                        }
                    )
                    
                    # Record that we sent the alert
                    await self.db.credit_low_balance_alerts.insert_one({
                        'id': str(uuid.uuid4()),
                        'user_id': user_id,
                        'balance_at_alert': current_balance,
                        'threshold': threshold,
                        'created_at': datetime.utcnow()
                    })
                    
                    logger.info(f"Low balance alert sent to user {user_id}")
                    
        except Exception as e:
            logger.error(f"Error checking low balance: {str(e)}")
    
    async def check_pending_payments(self):
        """
        Check for pending Stripe payments and notify users
        This should be run periodically (e.g., via a cron job)
        """
        try:
            # Find purchases with pending status older than 5 minutes
            pending_purchases = await self.db.credit_purchases.find({
                "payment_status": PaymentStatus.PENDING.value,
                "created_at": {"$lt": datetime.utcnow() - timedelta(minutes=5)}
            }).to_list(100)
            
            for purchase in pending_purchases:
                try:
                    # Check Stripe payment intent status
                    payment_intent = stripe.PaymentIntent.retrieve(purchase["stripe_payment_intent_id"])
                    
                    if payment_intent.status == "succeeded":
                        # Payment succeeded - update purchase and credit balance
                        # This handles cases where webhook failed or was delayed
                        logger.info(f"Late payment success detected for purchase {purchase['id']}")
                        
                        # Update purchase status
                        await self.db.credit_purchases.update_one(
                            {"id": purchase["id"]},
                            {"$set": {
                                "payment_status": PaymentStatus.SUCCEEDED.value,
                                "completed_at": datetime.utcnow()
                            }}
                        )
                        
                        # Add credits to balance if not already added
                        if not purchase.get("transaction_ids"):
                            # Create transaction and update balance
                            base_credits = purchase["base_credits"]
                            bonus_credits = purchase["bonus_credits"]
                            first_purchase_bonus = purchase.get("first_purchase_bonus", 0)
                            
                            transaction = await self.create_transaction(
                                user_id=purchase["user_id"],
                                transaction_type=TransactionType.PURCHASE,
                                amount=base_credits + bonus_credits + first_purchase_bonus,
                                description=f"Compra completada: {purchase['package_name']}",
                                package_id=purchase["package_id"],
                                payment_amount_usd=purchase["amount_usd"],
                                stripe_payment_intent_id=payment_intent.id
                            )
                            
                            await self.update_balance(purchase["user_id"], base_credits + bonus_credits + first_purchase_bonus, TransactionType.PURCHASE)
                            await self.complete_transaction(transaction["id"])
                            
                            # Mark first purchase if applicable
                            if purchase.get("is_first_purchase"):
                                await self.db.user_credit_balance.update_one(
                                    {"user_id": purchase["user_id"]},
                                    {"$set": {"first_purchase_completed": True}}
                                )
                            
                            # Send success notification
                            new_balance = await self.get_or_create_balance(purchase["user_id"])
                            await self._send_credit_notification(
                                user_id=purchase["user_id"],
                                title="✅ Pago Completado",
                                body=f"Tu pago ha sido procesado exitosamente. Has recibido {int(purchase['total_credits'])} créditos.",
                                notification_type='credit_purchase',
                                data={
                                    'purchase_id': purchase["id"],
                                    'total_credits': purchase['total_credits'],
                                    'new_balance': new_balance['balance']
                                }
                            )
                    
                    elif payment_intent.status in ["requires_payment_method", "requires_confirmation", "requires_action"]:
                        # Payment requires action
                        await self._send_credit_notification(
                            user_id=purchase["user_id"],
                            title="⚠️ Pago Pendiente",
                            body="Tu pago requiere acción adicional. Por favor, completa el proceso de pago.",
                            notification_type='credit_pending_payment',
                            data={
                                'purchase_id': purchase["id"],
                                'payment_intent_id': payment_intent.id,
                                'status': payment_intent.status
                            }
                        )
                    
                    elif payment_intent.status in ["canceled", "failed"]:
                        # Payment failed
                        await self.db.credit_purchases.update_one(
                            {"id": purchase["id"]},
                            {"$set": {
                                "payment_status": PaymentStatus.FAILED.value
                            }}
                        )
                        
                        await self._send_credit_notification(
                            user_id=purchase["user_id"],
                            title="❌ Pago Fallido",
                            body="Tu intento de compra de créditos ha fallado. Por favor, intenta nuevamente con otro método de pago.",
                            notification_type='credit_payment_failed',
                            data={
                                'purchase_id': purchase["id"],
                                'status': payment_intent.status
                            }
                        )
                        
                except Exception as e:
                    logger.error(f"Error checking payment for purchase {purchase['id']}: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in check_pending_payments: {str(e)}")

