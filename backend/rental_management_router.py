"""
Rental Property Management Router (Aggregator)
================================================
Thin wrapper that imports and merges all rental sub-routers.
Maintains backward compatibility with router_registry.py and startup_services.py.

Sub-modules:
  rental/shared.py             – DB, auth, serialization, push helpers
  rental/auth_router.py        – Register, login, OTP, push tokens
  rental/properties_router.py  – Public + admin + landlord properties
  rental/tenant_router.py      – Tenant portal, maintenance, payments
  rental/contracts_router.py   – Leases, contracts, signatures
  rental/finances_router.py    – Expenses, performance, reports
  rental/owner_router.py       – Owner dashboard, banking, payouts
  rental/stripe_router.py      – Stripe Connect, payments, webhooks
  rental/investments_router.py – Inversiones CRUD
"""
import logging
from fastapi import APIRouter

from rental.shared import set_db, get_db

# Import all sub-routers
from rental.auth_router import router as auth_router
from rental.properties_router import router as properties_router
from rental.tenant_router import router as tenant_router
from rental.contracts_router import router as contracts_router
from rental.finances_router import router as finances_router
from rental.owner_router import router as owner_router
from rental.stripe_router import router as stripe_router
from rental.investments_router import router as investments_router
from rental.legal_router import router as legal_router
from rental.communications_router import router as communications_router
from rental.signatures_router import router as signatures_router
from rental.chat_router import router as chat_router
from rental.background_check_router import router as background_check_router
from rental.rent_reporting_router import router as rent_reporting_router
from rental.ai_chatbot_router import router as ai_chatbot_router
from rental.contract_renewal_router import router as contract_renewal_router
from rental.late_fee_router import router as late_fee_router
from rental.greenbutton_router import router as greenbutton_router

# ── Aggregate Router ──
rental_mgmt_router = APIRouter()
rental_mgmt_router.include_router(auth_router)
rental_mgmt_router.include_router(properties_router)
rental_mgmt_router.include_router(tenant_router)
rental_mgmt_router.include_router(contracts_router)
rental_mgmt_router.include_router(finances_router)
rental_mgmt_router.include_router(owner_router)
rental_mgmt_router.include_router(stripe_router)
rental_mgmt_router.include_router(investments_router)
rental_mgmt_router.include_router(legal_router)
rental_mgmt_router.include_router(communications_router)
rental_mgmt_router.include_router(signatures_router)
rental_mgmt_router.include_router(chat_router)
rental_mgmt_router.include_router(background_check_router)
rental_mgmt_router.include_router(rent_reporting_router)
rental_mgmt_router.include_router(ai_chatbot_router)
rental_mgmt_router.include_router(contract_renewal_router)
rental_mgmt_router.include_router(late_fee_router)
rental_mgmt_router.include_router(greenbutton_router)


def set_rental_database(db):
    """Initialize all rental sub-routers with the database connection."""
    set_db(db)
    logging.info("✅ Rental Management Router initialized (modular)")


# ── Re-export for startup_services.py ──
async def process_recurring_rental_payments():
    """Delegate to contracts router"""
    from rental.contracts_router import process_recurring_rental_payments as _impl
    return await _impl()
