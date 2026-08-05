"""
Withdrawal Service - Gestión de retiros con Stripe/Plaid ACH
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.auth_get_request import AuthGetRequest
import stripe
from dotenv import load_dotenv

from withdrawal_models import (
    BankAccount, WithdrawalRequest, BankAccountStatus, WithdrawalStatus
)
from encryption_service import EncryptionService

load_dotenv()


class WithdrawalService:
    """Servicio para gestión de retiros y cuentas bancarias"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.bank_accounts = db.bank_accounts
        self.withdrawal_requests = db.withdrawal_requests
        self.users = db.users
        self.user_credit_balance = db.user_credit_balance
        self.credit_transactions = db.credit_transactions
        self.encryption_service = EncryptionService()
        
        # Stripe Configuration
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        
        # Plaid Configuration
        plaid_client_id = os.getenv("PLAID_CLIENT_ID")
        plaid_secret = os.getenv("PLAID_SECRET")
        plaid_env = os.getenv("PLAID_ENV", "sandbox")  # sandbox, development, production
        
        configuration = plaid.Configuration(
            host=plaid.Environment.Production if plaid_env == "production" else plaid.Environment.Sandbox,
            api_key={
                'clientId': plaid_client_id,
                'secret': plaid_secret,
            }
        )
        
        api_client = plaid.ApiClient(configuration)
        self.plaid_client = plaid_api.PlaidApi(api_client)
        
        # Withdrawal Settings
        self.min_withdrawal_amount = float(os.getenv("MIN_WITHDRAWAL_AMOUNT", "10.0"))
        self.withdrawal_fee_percentage = float(os.getenv("WITHDRAWAL_FEE_PERCENTAGE", "0.0"))
        self.withdrawal_fee_fixed = float(os.getenv("WITHDRAWAL_FEE_FIXED", "0.0"))
    
    # ========================================================================
    # PLAID INTEGRATION
    # ========================================================================
    
    async def create_plaid_link_token(self, user_id: str) -> Dict[str, Any]:
        """
        Crea un Plaid Link Token para que el usuario conecte su cuenta bancaria
        """
        try:
            user = await self.users.find_one({"_id": user_id})
            if not user:
                raise ValueError("Usuario no encontrado")
            
            request = LinkTokenCreateRequest(
                user=LinkTokenCreateRequestUser(
                    client_user_id=user_id
                ),
                client_name="Ross Tax Preparation",
                products=[Products("auth")],  # auth product para verificación de cuentas
                country_codes=[CountryCode('US')],
                language='es',
                webhook='https://rosstaxpreparation.com/api/webhooks/plaid',  # Webhook para notificaciones
            )
            
            response = self.plaid_client.link_token_create(request)
            
            return {
                "link_token": response['link_token'],
                "expiration": response['expiration']
            }
            
        except Exception as e:
            print(f"❌ Error creating Plaid link token: {str(e)}")
            raise Exception(f"Error al crear token de Plaid: {str(e)}")
    
    async def exchange_plaid_public_token(
        self, 
        user_id: str,
        public_token: str,
        account_id: str,
        account_holder_name: str
    ) -> str:
        """
        Intercambia el token público de Plaid por un access token
        y crea la cuenta bancaria verificada
        """
        try:
            # Exchange public token for access token
            exchange_request = ItemPublicTokenExchangeRequest(
                public_token=public_token
            )
            exchange_response = self.plaid_client.item_public_token_exchange(exchange_request)
            access_token = exchange_response['access_token']
            
            # Get account details usando Auth
            auth_request = AuthGetRequest(
                access_token=access_token
            )
            auth_response = self.plaid_client.auth_get(auth_request)
            
            # Find the selected account
            account_info = None
            for account in auth_response['accounts']:
                if account['account_id'] == account_id:
                    account_info = account
                    break
            
            if not account_info:
                raise ValueError("Cuenta no encontrada")
            
            # Get bank account numbers
            account_numbers = None
            for numbers in auth_response['numbers']['ach']:
                if numbers['account_id'] == account_id:
                    account_numbers = numbers
                    break
            
            if not account_numbers:
                raise ValueError("Números de cuenta no encontrados")
            
            # Get user's Stripe customer ID or create one
            user = await self.users.find_one({"_id": user_id})
            stripe_customer_id = user.get("stripe_customer_id")
            
            if not stripe_customer_id:
                # Create Stripe customer
                customer = stripe.Customer.create(
                    email=user.get("email"),
                    name=user.get("name"),
                    metadata={"user_id": user_id}
                )
                stripe_customer_id = customer.id
                
                # Update user with Stripe customer ID
                await self.users.update_one(
                    {"_id": user_id},
                    {"$set": {"stripe_customer_id": stripe_customer_id}}
                )
            
            # Create Stripe Bank Account Token using Plaid
            bank_account_token = stripe.Token.create(
                bank_account={
                    "country": "US",
                    "currency": "usd",
                    "account_holder_name": account_holder_name,
                    "account_holder_type": "individual",
                    "routing_number": account_numbers['routing'],
                    "account_number": account_numbers['account'],
                }
            )
            
            # Attach bank account to Stripe customer
            bank_account = stripe.Customer.create_source(
                stripe_customer_id,
                source=bank_account_token.id
            )
            
            # Desactivar cuentas bancarias anteriores del usuario
            await self.bank_accounts.update_many(
                {"user_id": user_id},
                {"$set": {"is_default": False}}
            )
            
            # Encrypt sensitive data
            encrypted_access_token = self.encryption_service.encrypt(access_token)
            
            # Create bank account record
            bank_account_data = BankAccount(
                user_id=user_id,
                stripe_bank_account_token=bank_account.id,
                stripe_customer_id=stripe_customer_id,
                plaid_access_token=encrypted_access_token,
                bank_name=account_info.get('name', 'Unknown Bank'),
                account_holder_name=account_holder_name,
                last_four=account_numbers['account'][-4:],
                account_type=account_info.get('subtype', 'checking'),
                status=BankAccountStatus.VERIFIED,
                verified_at=datetime.utcnow(),
                verification_method="plaid",
                is_default=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            result = await self.bank_accounts.insert_one(bank_account_data.dict())
            bank_account_id = str(result.inserted_id)
            
            print(f"✅ Bank account verified and created: {bank_account_id}")
            
            return bank_account_id
            
        except Exception as e:
            print(f"❌ Error exchanging Plaid token: {str(e)}")
            raise Exception(f"Error al verificar cuenta bancaria: {str(e)}")
    
    # ========================================================================
    # BANK ACCOUNTS MANAGEMENT
    # ========================================================================
    
    async def get_user_bank_accounts(self, user_id: str) -> List[Dict[str, Any]]:
        """Obtiene las cuentas bancarias del usuario"""
        accounts = await self.bank_accounts.find({"user_id": user_id}).to_list(100)
        
        result = []
        for account in accounts:
            result.append({
                "id": str(account["_id"]),
                "bank_name": account.get("bank_name"),
                "account_holder_name": account["account_holder_name"],
                "last_four": account["last_four"],
                "account_type": account["account_type"],
                "status": account["status"],
                "is_default": account.get("is_default", False),
                "verified_at": account.get("verified_at").isoformat() if account.get("verified_at") else None,
                "created_at": account["created_at"].isoformat()
            })
        
        return result
    
    async def get_default_bank_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene la cuenta bancaria por defecto del usuario"""
        account = await self.bank_accounts.find_one({
            "user_id": user_id,
            "is_default": True,
            "status": BankAccountStatus.VERIFIED
        })
        
        if not account:
            return None
        
        return {
            "id": str(account["_id"]),
            "bank_name": account.get("bank_name"),
            "last_four": account["last_four"],
            "stripe_customer_id": account.get("stripe_customer_id"),
            "stripe_bank_account_token": account.get("stripe_bank_account_token")
        }
    
    # ========================================================================
    # WITHDRAWAL REQUESTS
    # ========================================================================
    
    async def calculate_withdrawal_fee(self, amount: float) -> Dict[str, float]:
        """Calcula el fee y monto neto del retiro"""
        fee = (amount * self.withdrawal_fee_percentage / 100) + self.withdrawal_fee_fixed
        net_amount = amount - fee
        
        return {
            "gross_amount": amount,
            "fee": round(fee, 2),
            "net_amount": round(net_amount, 2)
        }
    
    async def create_withdrawal_request(
        self,
        user_id: str,
        amount: float,
        bank_account_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> str:
        """
        Crea una solicitud de retiro y descuenta provisionalmente del balance
        """
        try:
            # Validar monto mínimo
            if amount < self.min_withdrawal_amount:
                raise ValueError(f"El monto mínimo de retiro es ${self.min_withdrawal_amount}")
            
            # Obtener balance del usuario
            balance = await self.user_credit_balance.find_one({"user_id": user_id})
            if not balance:
                raise ValueError("Balance no encontrado")
            
            available_balance = balance.get("balance", 0.0)
            if amount > available_balance:
                raise ValueError(f"Balance insuficiente. Disponible: ${available_balance}")
            
            # Obtener cuenta bancaria
            if not bank_account_id:
                # Usar cuenta por defecto
                default_account = await self.get_default_bank_account(user_id)
                if not default_account:
                    raise ValueError("No hay cuenta bancaria registrada. Por favor registra una cuenta primero.")
                bank_account_id = default_account["id"]
            else:
                # Verificar que la cuenta pertenezca al usuario
                account = await self.bank_accounts.find_one({
                    "_id": bank_account_id,
                    "user_id": user_id,
                    "status": BankAccountStatus.VERIFIED
                })
                if not account:
                    raise ValueError("Cuenta bancaria no encontrada o no verificada")
            
            # Calcular fees
            fee_calc = await self.calculate_withdrawal_fee(amount)
            
            # Obtener info del usuario
            user = await self.users.find_one({"_id": user_id})
            
            # Crear solicitud de retiro
            withdrawal = WithdrawalRequest(
                user_id=user_id,
                bank_account_id=bank_account_id,
                amount_credits=amount,
                amount_usd=amount,  # 1 credit = 1 USD
                fee_amount=fee_calc["fee"],
                net_amount=fee_calc["net_amount"],
                status=WithdrawalStatus.PENDING,
                requested_at=datetime.utcnow(),
                user_name=user.get("name"),
                user_email=user.get("email")
            )
            
            result = await self.withdrawal_requests.insert_one(withdrawal.dict())
            withdrawal_id = str(result.inserted_id)
            
            # Descontar PROVISIONALMENTE del balance
            # (se descuenta temporalmente, pero aún no es permanente)
            await self.user_credit_balance.update_one(
                {"user_id": user_id},
                {
                    "$inc": {"balance": -amount},
                    "$set": {"last_updated": datetime.utcnow()}
                }
            )
            
            # Registrar transacción provisional
            transaction = {
                "_id": str(uuid.uuid4()),
                "user_id": user_id,
                "transaction_type": "withdrawal_pending",
                "amount": -amount,
                "balance_after": available_balance - amount,
                "description": f"Retiro solicitado (Pendiente aprobación) - ${fee_calc['net_amount']} neto",
                "reference_id": withdrawal_id,
                "created_at": datetime.utcnow(),
                "status": "provisional"
            }
            await self.credit_transactions.insert_one(transaction)
            
            print(f"✅ Withdrawal request created: {withdrawal_id}, Amount: ${amount}")
            
            return withdrawal_id
            
        except Exception as e:
            print(f"❌ Error creating withdrawal request: {str(e)}")
            raise Exception(f"Error al crear solicitud de retiro: {str(e)}")
    
    async def get_user_withdrawals(self, user_id: str) -> List[Dict[str, Any]]:
        """Obtiene el historial de retiros del usuario"""
        withdrawals = await self.withdrawal_requests.find(
            {"user_id": user_id}
        ).sort("requested_at", -1).to_list(100)
        
        result = []
        for w in withdrawals:
            # Get bank account info
            bank_account = await self.bank_accounts.find_one({"_id": w["bank_account_id"]})
            
            result.append({
                "id": str(w["_id"]),
                "amount_credits": w["amount_credits"],
                "amount_usd": w["amount_usd"],
                "fee_amount": w["fee_amount"],
                "net_amount": w["net_amount"],
                "status": w["status"],
                "requested_at": w["requested_at"].isoformat(),
                "processed_at": w.get("processed_at").isoformat() if w.get("processed_at") else None,
                "completed_at": w.get("completed_at").isoformat() if w.get("completed_at") else None,
                "bank_account_last_four": bank_account["last_four"] if bank_account else None,
                "admin_notes": w.get("admin_notes"),
                "rejection_reason": w.get("rejection_reason")
            })
        
        return result
    
    # ========================================================================
    # ADMIN FUNCTIONS
    # ========================================================================
    
    async def get_all_withdrawal_requests(
        self,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Obtiene todas las solicitudes de retiro (Admin)"""
        query = {}
        if status:
            query["status"] = status
        
        withdrawals = await self.withdrawal_requests.find(query).sort("requested_at", -1).limit(limit).to_list(limit)
        
        result = []
        for w in withdrawals:
            # Get bank account info
            bank_account = await self.bank_accounts.find_one({"_id": w["bank_account_id"]})
            
            result.append({
                "id": str(w["_id"]),
                "user_id": w["user_id"],
                "user_name": w.get("user_name"),
                "user_email": w.get("user_email"),
                "amount_credits": w["amount_credits"],
                "amount_usd": w["amount_usd"],
                "fee_amount": w["fee_amount"],
                "net_amount": w["net_amount"],
                "status": w["status"],
                "requested_at": w["requested_at"].isoformat(),
                "processed_at": w.get("processed_at").isoformat() if w.get("processed_at") else None,
                "completed_at": w.get("completed_at").isoformat() if w.get("completed_at") else None,
                "bank_account_last_four": bank_account["last_four"] if bank_account else None,
                "bank_name": bank_account.get("bank_name") if bank_account else None,
                "admin_notes": w.get("admin_notes"),
                "rejection_reason": w.get("rejection_reason"),
                "stripe_payout_id": w.get("stripe_payout_id")
            })
        
        return result
    
    async def process_withdrawal(
        self,
        withdrawal_id: str,
        admin_id: str,
        status: str,
        admin_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None,
        stripe_payout_id: Optional[str] = None
    ) -> bool:
        """
        Procesa una solicitud de retiro (Completar o Rechazar)
        - Si se completa: descuento permanente
        - Si se rechaza: reembolso al balance
        """
        try:
            # Obtener solicitud de retiro
            withdrawal = await self.withdrawal_requests.find_one({"_id": withdrawal_id})
            if not withdrawal:
                raise ValueError("Solicitud de retiro no encontrada")
            
            if withdrawal["status"] != WithdrawalStatus.PENDING:
                raise ValueError(f"No se puede procesar un retiro en estado {withdrawal['status']}")
            
            user_id = withdrawal["user_id"]
            amount = withdrawal["amount_credits"]
            
            if status == "completed":
                # COMPLETADO: El descuento ya se hizo provisionalmente, ahora es permanente
                # Actualizar estado del retiro
                await self.withdrawal_requests.update_one(
                    {"_id": withdrawal_id},
                    {
                        "$set": {
                            "status": WithdrawalStatus.COMPLETED,
                            "processed_at": datetime.utcnow(),
                            "completed_at": datetime.utcnow(),
                            "processed_by_admin_id": admin_id,
                            "admin_notes": admin_notes,
                            "stripe_payout_id": stripe_payout_id
                        }
                    }
                )
                
                # Actualizar transacción de provisional a completada
                await self.credit_transactions.update_one(
                    {"reference_id": withdrawal_id, "status": "provisional"},
                    {
                        "$set": {
                            "transaction_type": "withdrawal_completed",
                            "status": "completed",
                            "description": f"Retiro completado - ${withdrawal['net_amount']} enviado a cuenta",
                            "completed_at": datetime.utcnow()
                        }
                    }
                )
                
                # Actualizar lifetime_spent
                await self.user_credit_balance.update_one(
                    {"user_id": user_id},
                    {"$inc": {"lifetime_spent": amount}}
                )
                
                print(f"✅ Withdrawal completed: {withdrawal_id}")
                
            elif status == "rejected":
                # RECHAZADO: Reembolsar al usuario
                await self.withdrawal_requests.update_one(
                    {"_id": withdrawal_id},
                    {
                        "$set": {
                            "status": WithdrawalStatus.REJECTED,
                            "processed_at": datetime.utcnow(),
                            "processed_by_admin_id": admin_id,
                            "admin_notes": admin_notes,
                            "rejection_reason": rejection_reason
                        }
                    }
                )
                
                # Reembolsar al balance
                balance = await self.user_credit_balance.find_one({"user_id": user_id})
                new_balance = balance.get("balance", 0.0) + amount
                
                await self.user_credit_balance.update_one(
                    {"user_id": user_id},
                    {
                        "$inc": {"balance": amount},
                        "$set": {"last_updated": datetime.utcnow()}
                    }
                )
                
                # Eliminar transacción provisional
                await self.credit_transactions.delete_one({
                    "reference_id": withdrawal_id,
                    "status": "provisional"
                })
                
                # Crear transacción de reembolso
                refund_transaction = {
                    "_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "transaction_type": "withdrawal_refund",
                    "amount": amount,
                    "balance_after": new_balance,
                    "description": f"Reembolso de retiro rechazado: {rejection_reason or 'No especificado'}",
                    "reference_id": withdrawal_id,
                    "created_at": datetime.utcnow(),
                    "status": "completed"
                }
                await self.credit_transactions.insert_one(refund_transaction)
                
                print(f"✅ Withdrawal rejected and refunded: {withdrawal_id}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error processing withdrawal: {str(e)}")
            raise Exception(f"Error al procesar retiro: {str(e)}")
    
    async def get_withdrawal_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de retiros (Admin)"""
        all_withdrawals = await self.withdrawal_requests.find({}).to_list(10000)
        
        stats = {
            "total_requests": len(all_withdrawals),
            "pending_count": 0,
            "processing_count": 0,
            "completed_count": 0,
            "rejected_count": 0,
            "total_withdrawn_usd": 0.0,
            "total_fees_collected": 0.0
        }
        
        for w in all_withdrawals:
            status = w["status"]
            if status == WithdrawalStatus.PENDING:
                stats["pending_count"] += 1
            elif status == WithdrawalStatus.PROCESSING:
                stats["processing_count"] += 1
            elif status == WithdrawalStatus.COMPLETED:
                stats["completed_count"] += 1
                stats["total_withdrawn_usd"] += w["net_amount"]
                stats["total_fees_collected"] += w["fee_amount"]
            elif status == WithdrawalStatus.REJECTED:
                stats["rejected_count"] += 1
        
        return stats
