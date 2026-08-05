"""
Ross Lending Solutions - Stripe Instant Disbursement Service
Uses Stripe Connect to push funds to client debit cards via Visa Direct / MC Send.

Flow:
1. Client provides debit card in Expo app → tokenized by Stripe SDK
2. Backend creates a Connected Account for the client (invisible to them)
3. Adds the debit card as an external account on the connected account
4. When admin approves disbursement → Transfer funds + Instant Payout
"""

import os
import stripe
from stripe import StripeError
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Initialize Stripe with the Ross Lending secret key
STRIPE_LENDING_KEY = os.getenv('STRIPE_LENDING_SECRET_KEY', os.getenv('STRIPE_SECRET_KEY', ''))

STATEMENT_DESCRIPTOR = "ROSS LENDING"


def _set_stripe_key():
    """Set the correct Stripe key before each API call (prevents overwrite by other modules)."""
    stripe.api_key = STRIPE_LENDING_KEY


class StripeDisbursementService:
    """Handles Stripe Connect instant payouts for loan disbursements."""

    def __init__(self, db):
        self.db = db

    async def create_connected_account(self, client_email: str, client_name: str, client_phone: str = '') -> dict:
        """
        Create a Stripe Connected Account (Custom) for the borrower.
        This allows us to payout to their debit card.
        """
        try:
            _set_stripe_key()
            # Check if client already has a connected account
            existing = await self.db.client_payment_vault.find_one({
                "client_email": client_email,
                "stripe_connected_account_id": {"$exists": True, "$ne": ""}
            })
            if existing and existing.get('stripe_connected_account_id'):
                return {
                    "success": True,
                    "account_id": existing['stripe_connected_account_id'],
                    "already_exists": True
                }

            # Split name
            parts = client_name.strip().split(' ', 1)
            first_name = parts[0] if parts else client_name
            last_name = parts[1] if len(parts) > 1 else ''

            # Create Custom connected account
            account = stripe.Account.create(
                type="custom",
                country="US",
                email=client_email,
                capabilities={
                    "transfers": {"requested": True},
                },
                business_type="individual",
                individual={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": client_email,
                },
                business_profile={
                    "product_description": "Loan disbursement recipient",
                    "mcc": "6012",  # Financial institutions
                },
                tos_acceptance={
                    "date": int(datetime.utcnow().timestamp()),
                    "ip": "0.0.0.0",  # Will be updated with real IP
                },
                settings={
                    "payouts": {
                        "schedule": {
                            "interval": "manual"
                        }
                    }
                },
                metadata={
                    "platform": "ross_lending",
                    "client_email": client_email,
                }
            )

            # Save to vault
            await self.db.client_payment_vault.update_one(
                {"client_email": client_email},
                {"$set": {
                    "stripe_connected_account_id": account.id,
                    "client_name": client_name,
                    "client_email": client_email,
                    "updated_at": datetime.utcnow(),
                }},
                upsert=True
            )

            return {
                "success": True,
                "account_id": account.id,
                "already_exists": False
            }

        except StripeError as e:
            return {"success": False, "error": str(e.user_message or e)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def add_debit_card(self, client_email: str, card_token: str) -> dict:
        """
        Add a debit card as external account on the client's connected account.
        card_token comes from Stripe SDK tokenization in the Expo app.
        """
        try:
            _set_stripe_key()
            # Get connected account ID
            vault = await self.db.client_payment_vault.find_one({
                "client_email": client_email,
                "stripe_connected_account_id": {"$exists": True}
            })
            if not vault or not vault.get('stripe_connected_account_id'):
                return {"success": False, "error": "Cliente no tiene cuenta conectada. Crear primero."}

            account_id = vault['stripe_connected_account_id']

            # Add the card as external account
            external_account = stripe.Account.create_external_account(
                account_id,
                external_account=card_token,
            )

            # Save card info to vault
            card_info = {
                "stripe_external_account_id": external_account.id,
                "card_last4": external_account.last4,
                "card_brand": external_account.brand.lower() if external_account.brand else "",
                "card_exp_month": external_account.exp_month,
                "card_exp_year": external_account.exp_year,
                "card_type": getattr(external_account, 'account_type', 'debit'),
                "instant_payout_eligible": True,  # Stripe validates this
                "updated_at": datetime.utcnow(),
            }

            await self.db.client_payment_vault.update_one(
                {"client_email": client_email},
                {"$set": {
                    "debit_card": card_info,
                    "method_type": "debit_card",
                    **card_info,
                }},
                upsert=True
            )

            return {
                "success": True,
                "external_account_id": external_account.id,
                "card_last4": external_account.last4,
                "card_brand": external_account.brand,
            }

        except StripeError as e:
            return {"success": False, "error": str(e.user_message or e)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def execute_instant_payout(self, loan_id: str, amount_cents: int, client_email: str) -> dict:
        """
        Execute instant payout to client's debit card.
        amount_cents: Amount in cents to disburse (after fee deduction)
        """
        try:
            _set_stripe_key()
            # Get connected account
            vault = await self.db.client_payment_vault.find_one({
                "client_email": client_email,
                "stripe_connected_account_id": {"$exists": True}
            })
            if not vault or not vault.get('stripe_connected_account_id'):
                return {"success": False, "error": "No se encontró cuenta conectada del cliente"}

            account_id = vault['stripe_connected_account_id']

            # Step 1: Transfer funds from platform to connected account
            transfer = stripe.Transfer.create(
                amount=amount_cents,
                currency="usd",
                destination=account_id,
                transfer_group=f"loan_{loan_id}",
                description="Desembolso préstamo - Ross Lending",
                metadata={
                    "loan_id": loan_id,
                    "type": "loan_disbursement",
                    "platform": "ross_lending",
                }
            )

            # Step 2: Create instant payout from connected account to their debit card
            payout = stripe.Payout.create(
                amount=amount_cents,
                currency="usd",
                method="instant",
                statement_descriptor=STATEMENT_DESCRIPTOR,
                metadata={
                    "loan_id": loan_id,
                    "transfer_id": transfer.id,
                },
                stripe_account=account_id,
            )

            # Update loan with payout details
            now = datetime.utcnow()
            await self.db.loans.update_one(
                {"_id": loan_id} if isinstance(loan_id, object) else {"loan_number": loan_id},
                {"$set": {
                    "disbursement_status": "completed",
                    "disbursement_completed_at": now,
                    "stripe_transfer_id": transfer.id,
                    "stripe_payout_id": payout.id,
                    "stripe_payout_status": payout.status,
                    "disbursement_reference": f"STRIPE-{payout.id}",
                    "status": "active",
                    "activated_at": now,
                    "updated_at": now,
                }}
            )

            return {
                "success": True,
                "transfer_id": transfer.id,
                "payout_id": payout.id,
                "payout_status": payout.status,
                "amount": amount_cents / 100,
                "message": f"✅ Depósito instantáneo de ${amount_cents/100:.2f} enviado a tarjeta ****{vault.get('card_last4', '????')}"
            }

        except stripe.error.StripeError as e:
            error_msg = str(e.user_message or e)
            # If instant payout fails, try standard
            if "instant" in error_msg.lower():
                return {"success": False, "error": f"Payout instantáneo no disponible: {error_msg}. Intente ACH estándar."}
            return {"success": False, "error": error_msg}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def check_payout_status(self, payout_id: str, account_id: str) -> dict:
        """Check the status of an existing payout."""
        try:
            _set_stripe_key()
            payout = stripe.Payout.retrieve(
                payout_id,
                stripe_account=account_id,
            )
            return {
                "success": True,
                "status": payout.status,
                "amount": payout.amount / 100,
                "arrival_date": payout.arrival_date,
            }
        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e.user_message or e)}

    async def get_fee_estimate(self, amount: float) -> dict:
        """
        Estimate the Stripe fee for instant payout.
        Stripe charges ~1.5% for instant payouts (min $0.50).
        """
        fee_pct = 0.015  # 1.5%
        min_fee = 0.50
        fee = max(amount * fee_pct, min_fee)
        net = amount - fee
        return {
            "amount": amount,
            "fee": round(fee, 2),
            "fee_percentage": fee_pct * 100,
            "net_disbursement": round(net, 2),
            "method": "instant",
            "processor": "stripe_visa_direct",
        }

    async def create_card_token_intent(self, client_email: str) -> dict:
        """
        Create a SetupIntent for the client to securely add their debit card.
        The Expo app uses this to collect card details natively.
        """
        try:
            _set_stripe_key()
            # Get or create connected account
            vault = await self.db.client_payment_vault.find_one({
                "client_email": client_email,
                "stripe_connected_account_id": {"$exists": True}
            })

            if not vault or not vault.get('stripe_connected_account_id'):
                return {"success": False, "error": "Primero se debe crear la cuenta conectada"}

            account_id = vault['stripe_connected_account_id']

            # Create a SetupIntent on the connected account
            setup_intent = stripe.SetupIntent.create(
                payment_method_types=["card"],
                metadata={
                    "client_email": client_email,
                    "purpose": "disbursement_card",
                },
                stripe_account=account_id,
            )

            return {
                "success": True,
                "client_secret": setup_intent.client_secret,
                "setup_intent_id": setup_intent.id,
                "connected_account_id": account_id,
            }
        except StripeError as e:
            return {"success": False, "error": str(e.user_message or e)}
        except Exception as e:
            return {"success": False, "error": str(e)}
