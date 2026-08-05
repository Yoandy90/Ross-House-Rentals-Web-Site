"""
Plaid Bookkeeping Integration — Bank Account Linking & Transaction Sync
Links business bank accounts via Plaid Link, syncs transactions automatically,
and maps Plaid categories to IRS Schedule C expense categories.
"""
import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

logger = logging.getLogger(__name__)

plaid_bk_router = APIRouter(tags=["Plaid Bookkeeping"])

_db: AsyncIOMotorDatabase = None

# ═══════════════════════════════════════════════════════════════════════
# PLAID CLIENT SETUP
# ═══════════════════════════════════════════════════════════════════════

PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID', '')
PLAID_SECRET = os.getenv('PLAID_SECRET', '')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')

ENV_MAP = {
    'sandbox': plaid.Environment.Sandbox,
    'development': plaid.Environment.Sandbox,   # Plaid SDK v20+ only has Sandbox/Production
    'production': plaid.Environment.Production,
}

# Lazy initialization — read env vars at request time (not at import time)
# This ensures Railway/Heroku env vars are available
_plaid_client = None

def get_plaid_client():
    """Get or create Plaid API client — lazy initialization to support Railway env vars"""
    global _plaid_client
    if _plaid_client is None:
        client_id = os.getenv('PLAID_CLIENT_ID', '') or PLAID_CLIENT_ID
        env = os.getenv('PLAID_ENV', 'sandbox') or PLAID_ENV
        
        # Auto-select the right secret based on environment
        if env == 'production':
            secret = os.getenv('PLAID_SECRET_PRODUCTION', '') or os.getenv('PLAID_SECRET', '') or PLAID_SECRET
        else:
            secret = os.getenv('PLAID_SECRET', '') or PLAID_SECRET
        
        if not client_id or not secret:
            logger.error(f"❌ Plaid credentials missing! PLAID_CLIENT_ID={'SET' if client_id else 'EMPTY'}, PLAID_SECRET={'SET' if secret else 'EMPTY'}, PLAID_ENV={env}")
            raise Exception("Plaid credentials not configured")
        
        configuration = plaid.Configuration(
            host=ENV_MAP.get(env, plaid.Environment.Sandbox),
            api_key={
                'clientId': client_id,
                'secret': secret,
            }
        )
        api_client = plaid.ApiClient(configuration)
        _plaid_client = plaid_api.PlaidApi(api_client)
        logger.info(f"✅ Plaid client initialized (env: {env}, host: {ENV_MAP.get(env, 'sandbox')}, client_id: {client_id[:8]}..., secret: {secret[:6]}...)")
    return _plaid_client


def set_plaid_bk_db(db: AsyncIOMotorDatabase):
    global _db
    _db = db
    logger.info(f"✅ Plaid Bookkeeping initialized (env: {PLAID_ENV})")


@plaid_bk_router.get('/admin/bookkeeping/plaid/status')
async def plaid_status(request: Request):
    """Endpoint de diagnóstico para verificar estado de Plaid (no revela credenciales)"""
    client_id = os.getenv('PLAID_CLIENT_ID', '')
    secret = os.getenv('PLAID_SECRET', '')
    plaid_env = os.getenv('PLAID_ENV', 'sandbox')
    
    return {
        "plaid_client_id_set": bool(client_id),
        "plaid_client_id_length": len(client_id),
        "plaid_client_id_preview": client_id[:4] + "..." if len(client_id) > 4 else "EMPTY",
        "plaid_secret_set": bool(secret),
        "plaid_secret_length": len(secret),
        "plaid_env": plaid_env,
        "lazy_client_initialized": _plaid_client is not None,
        "code_version": "robust-sync-v3",
    }



async def _auth_admin(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="No token")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await _db.users.find_one({"id": session["user_id"]})
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ═══════════════════════════════════════════════════════════════════════
# PLAID CATEGORY → IRS SCHEDULE C MAPPING
# ═══════════════════════════════════════════════════════════════════════

PLAID_TO_IRS_MAP = {
    # Income mappings
    'INCOME': 'sales',
    'TRANSFER_IN': 'sales',
    'DEPOSIT': 'sales',

    # Expense mappings by Plaid personal_finance_category
    'FOOD_AND_DRINK': 'meals',
    'GENERAL_MERCHANDISE': 'supplies',
    'GENERAL_SERVICES': 'contract_labor',
    'GOVERNMENT_AND_NON_PROFIT': 'taxes_licenses',
    'HOME_IMPROVEMENT': 'repairs',
    'MEDICAL': 'insurance',
    'PERSONAL_CARE': 'other',
    'RENT_AND_UTILITIES': 'utilities',
    'TRANSPORTATION': 'car_truck',
    'TRAVEL': 'travel',
    'ENTERTAINMENT': 'other',
    'LOAN_PAYMENTS': 'interest_other',
    'BANK_FEES': 'other',
    'TRANSFER_OUT': 'other',

    # More specific mappings
    'RENT_AND_UTILITIES_RENT': 'rent_property',
    'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY': 'utilities',
    'RENT_AND_UTILITIES_INTERNET_AND_CABLE': 'utilities',
    'RENT_AND_UTILITIES_TELEPHONE': 'utilities',
    'RENT_AND_UTILITIES_WATER': 'utilities',
    'TRANSPORTATION_GAS': 'car_truck',
    'TRANSPORTATION_PARKING': 'car_truck',
    'TRANSPORTATION_TOLLS': 'car_truck',
    'TRANSPORTATION_PUBLIC_TRANSIT': 'travel',
    'GENERAL_MERCHANDISE_OFFICE_SUPPLIES': 'office_expense',
    'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING': 'legal_professional',
    'GENERAL_SERVICES_INSURANCE': 'insurance',
    'GENERAL_SERVICES_LEGAL': 'legal_professional',
    'GENERAL_SERVICES_POSTAGE_AND_SHIPPING': 'office_expense',
    'FOOD_AND_DRINK_RESTAURANTS': 'meals',
    'FOOD_AND_DRINK_GROCERIES': 'meals',
}


def map_plaid_to_irs(plaid_category: str, detailed_category: str = '') -> str:
    """Map a Plaid category to an IRS Schedule C category key"""
    # Try detailed first
    if detailed_category:
        combined = f"{plaid_category}_{detailed_category}".upper().replace(' ', '_')
        if combined in PLAID_TO_IRS_MAP:
            return PLAID_TO_IRS_MAP[combined]

    # Try primary
    primary = plaid_category.upper().replace(' ', '_') if plaid_category else ''
    return PLAID_TO_IRS_MAP.get(primary, 'other')


def determine_type(amount: float, plaid_category: str = '') -> str:
    """Determine if transaction is income or expense.
    Plaid: negative amounts = income (money in), positive = expense (money out)
    """
    cat_upper = (plaid_category or '').upper()
    if cat_upper in ('INCOME', 'TRANSFER_IN', 'DEPOSIT'):
        return 'income'
    if amount < 0:
        return 'income'
    return 'expense'


# ═══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@plaid_bk_router.post("/admin/bookkeeping/plaid/create-link-token")
async def create_link_token(request: Request):
    """Create a Plaid Link token for connecting a bank account to a business"""
    await _auth_admin(request)
    data = await request.json()
    business_id = data.get("business_id", "")

    if not business_id:
        raise HTTPException(status_code=400, detail="business_id required")

    biz = await _db.bk_businesses.find_one({"id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    try:
        req = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="Ross Tax Preparation",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=business_id),
        )
        response = get_plaid_client().link_token_create(req)
        return {
            "success": True,
            "link_token": response.link_token,
            "expiration": str(response.expiration),
        }
    except plaid.ApiException as e:
        logger.error(f"❌ Plaid Link Token API error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid API error: {e.body}")
    except Exception as e:
        logger.error(f"❌ Plaid Link Token general error: {str(e)}")
        # Reset client so it can be re-initialized with correct creds
        global _plaid_client
        _plaid_client = None
        raise HTTPException(status_code=500, detail=f"Plaid error: {str(e)}")


@plaid_bk_router.post("/admin/bookkeeping/plaid/exchange-token")
async def exchange_public_token(request: Request):
    """Exchange Plaid public_token for access_token after user links account"""
    await _auth_admin(request)
    data = await request.json()
    public_token = data.get("public_token", "")
    business_id = data.get("business_id", "")
    institution_name = data.get("institution_name", "")

    if not public_token or not business_id:
        raise HTTPException(status_code=400, detail="public_token and business_id required")

    try:
        # Exchange token
        exchange_req = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_resp = get_plaid_client().item_public_token_exchange(exchange_req)
        access_token = exchange_resp.access_token
        item_id = exchange_resp.item_id

        # Get account details
        accounts_req = AccountsGetRequest(access_token=access_token)
        accounts_resp = get_plaid_client().accounts_get(accounts_req)
        accounts = accounts_resp.accounts

        # Save linked account
        linked_account = {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "plaid_item_id": item_id,
            "plaid_access_token": access_token,
            "institution_name": institution_name or "Bank",
            "accounts": [
                {
                    "account_id": acc.account_id,
                    "name": acc.name,
                    "official_name": acc.official_name or acc.name,
                    "type": acc.type.value if hasattr(acc.type, 'value') else str(acc.type),
                    "subtype": acc.subtype.value if acc.subtype and hasattr(acc.subtype, 'value') else str(acc.subtype) if acc.subtype else '',
                    "mask": acc.mask or '',
                    "current_balance": acc.balances.current,
                    "available_balance": acc.balances.available,
                }
                for acc in accounts
            ],
            "last_synced": None,
            "sync_cursor": "",
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await _db.bk_linked_accounts.insert_one(linked_account)

        # Update business
        await _db.bk_businesses.update_one(
            {"id": business_id},
            {"$set": {
                "has_linked_bank": True,
                "linked_institution": institution_name,
                "updated_at": datetime.utcnow()
            }}
        )

        logger.info(f"✅ Bank linked for business {business_id}: {institution_name} ({len(accounts)} accounts)")

        linked_account.pop("plaid_access_token", None)
        linked_account["_id"] = str(linked_account.get("_id", ""))

        return {
            "success": True,
            "linked_account": linked_account,
            "accounts_count": len(accounts),
        }

    except plaid.ApiException as e:
        logger.error(f"❌ Plaid Exchange error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")


@plaid_bk_router.get("/admin/bookkeeping/plaid/linked-accounts/{business_id}")
async def get_linked_accounts(business_id: str, request: Request):
    """Get all linked bank accounts for a business"""
    await _auth_admin(request)
    accounts = await _db.bk_linked_accounts.find(
        {"business_id": business_id, "status": "active"}
    ).to_list(50)
    for a in accounts:
        a["_id"] = str(a["_id"])
        a.pop("plaid_access_token", None)
    return {"linked_accounts": accounts}


@plaid_bk_router.post("/admin/bookkeeping/plaid/sync-transactions/{business_id}")
async def sync_transactions(business_id: str, request: Request):
    """Sync new transactions from Plaid for all linked accounts of a business"""
    await _auth_admin(request)

    try:
        linked_accounts = await _db.bk_linked_accounts.find(
            {"business_id": business_id, "status": "active"}
        ).to_list(50)

        if not linked_accounts:
            raise HTTPException(status_code=404, detail="No linked accounts found")

        total_added = 0
        total_modified = 0
        total_removed = 0
        errors = []

        for linked in linked_accounts:
            access_token = linked.get("plaid_access_token")
            if not access_token:
                errors.append(f"Account {linked.get('id','?')}: missing access token")
                continue

            cursor = linked.get("sync_cursor", "")
            has_more = True
            account_errors = []

            while has_more:
                try:
                    sync_req = TransactionsSyncRequest(
                        access_token=access_token,
                        cursor=cursor or "",
                    )
                    sync_resp = get_plaid_client().transactions_sync(sync_req)

                    # Process added transactions
                    for txn in sync_resp.added:
                        try:
                            plaid_cat = ''
                            plaid_detailed = ''
                            if hasattr(txn, 'personal_finance_category') and txn.personal_finance_category:
                                plaid_cat = txn.personal_finance_category.primary or ''
                                plaid_detailed = txn.personal_finance_category.detailed or ''

                            txn_type = determine_type(txn.amount, plaid_cat)
                            irs_category = map_plaid_to_irs(plaid_cat, plaid_detailed)

                            # For income, Plaid uses negative amounts
                            amount = abs(txn.amount)

                            # Check if already exists
                            existing = await _db.bk_transactions.find_one({
                                "plaid_transaction_id": txn.transaction_id
                            })
                            if existing:
                                continue

                            new_txn = {
                                "id": str(uuid.uuid4()),
                                "business_id": business_id,
                                "type": txn_type,
                                "category": irs_category if txn_type == 'expense' else ('sales' if irs_category == 'other' else irs_category),
                                "amount": round(amount, 2),
                                "date": datetime.combine(txn.date, datetime.min.time()),
                                "description": txn.name or '',
                                "vendor": txn.merchant_name or txn.name or '',
                                "reference": txn.transaction_id[:12],
                                "payment_method": txn.payment_channel or '',
                                "notes": "",
                                "tax_deductible": txn_type == 'expense',
                                "plaid_transaction_id": txn.transaction_id,
                                "plaid_category": plaid_cat,
                                "plaid_detailed_category": plaid_detailed,
                                "plaid_pending": txn.pending,
                                "plaid_account_id": txn.account_id,
                                "source": "plaid",
                                "auto_categorized": True,
                                "review_status": "pending",
                                "created_at": datetime.utcnow(),
                                "updated_at": datetime.utcnow(),
                            }
                            await _db.bk_transactions.insert_one(new_txn)
                            total_added += 1
                        except Exception as te:
                            logger.error(f"⚠️ Error processing txn {txn.transaction_id}: {str(te)}")

                    # Process modified transactions
                    for txn in sync_resp.modified:
                        try:
                            amount = abs(txn.amount)
                            plaid_cat = ''
                            if hasattr(txn, 'personal_finance_category') and txn.personal_finance_category:
                                plaid_cat = txn.personal_finance_category.primary or ''

                            await _db.bk_transactions.update_one(
                                {"plaid_transaction_id": txn.transaction_id},
                                {"$set": {
                                    "amount": round(amount, 2),
                                    "description": txn.name or '',
                                    "vendor": txn.merchant_name or txn.name or '',
                                    "plaid_pending": txn.pending,
                                    "updated_at": datetime.utcnow(),
                                }}
                            )
                            total_modified += 1
                        except Exception as te:
                            logger.error(f"⚠️ Error modifying txn: {str(te)}")

                    # Process removed transactions
                    for txn in sync_resp.removed:
                        try:
                            await _db.bk_transactions.delete_one(
                                {"plaid_transaction_id": txn.transaction_id}
                            )
                            total_removed += 1
                        except Exception as te:
                            logger.error(f"⚠️ Error removing txn: {str(te)}")

                    cursor = sync_resp.next_cursor
                    has_more = sync_resp.has_more

                except plaid.ApiException as e:
                    error_body = str(e.body) if hasattr(e, 'body') else str(e)
                    logger.error(f"❌ Plaid Sync API error: {error_body}")
                    account_errors.append(error_body)
                    has_more = False
                except Exception as e:
                    logger.error(f"❌ Plaid Sync general error: {str(e)}")
                    account_errors.append(str(e))
                    has_more = False

            # Update cursor and last sync time
            await _db.bk_linked_accounts.update_one(
                {"id": linked["id"]},
                {"$set": {
                    "sync_cursor": cursor,
                    "last_synced": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }}
            )

            if account_errors:
                errors.extend(account_errors)

        logger.info(f"✅ Plaid sync for {business_id}: +{total_added} ~{total_modified} -{total_removed} errors={len(errors)}")

        return {
            "success": True,
            "added": total_added,
            "modified": total_modified,
            "removed": total_removed,
            "errors": errors if errors else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Plaid sync fatal error for {business_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al sincronizar: {str(e)}")


@plaid_bk_router.delete("/admin/bookkeeping/plaid/unlink/{linked_account_id}")
async def unlink_account(linked_account_id: str, request: Request):
    """Unlink a bank account"""
    await _auth_admin(request)
    result = await _db.bk_linked_accounts.update_one(
        {"id": linked_account_id},
        {"$set": {"status": "disconnected", "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Linked account not found")
    return {"success": True}



# ═══════════════════════════════════════════════════════════════════════
# PLAID AUTH — Bank Account Verification for Datos Bancarios Module
# ═══════════════════════════════════════════════════════════════════════

@plaid_bk_router.post("/admin/plaid/create-auth-link-token")
async def create_auth_link_token(request: Request):
    """Create a Plaid Link token with Auth product for bank verification"""
    await _auth_admin(request)
    data = await request.json()
    client_id = data.get("client_id", str(uuid.uuid4()))

    try:
        req = LinkTokenCreateRequest(
            products=[Products("auth")],
            client_name="Ross Tax Preparation",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=client_id),
        )
        response = get_plaid_client().link_token_create(req)
        return {
            "success": True,
            "link_token": response.link_token,
            "expiration": str(response.expiration),
        }
    except plaid.ApiException as e:
        logger.error(f"❌ Plaid Auth Link Token error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")


@plaid_bk_router.post("/admin/plaid/verify-bank-account")
async def verify_bank_account(request: Request):
    """Exchange public token and retrieve verified routing/account numbers via Plaid Auth"""
    await _auth_admin(request)
    data = await request.json()
    public_token = data.get("public_token", "")
    institution_name = data.get("institution_name", "")

    if not public_token:
        raise HTTPException(status_code=400, detail="public_token required")

    try:
        # Exchange token
        exchange_req = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_resp = get_plaid_client().item_public_token_exchange(exchange_req)
        access_token = exchange_resp.access_token

        # Get Auth data (routing/account numbers)
        from plaid.model.auth_get_request import AuthGetRequest
        auth_req = AuthGetRequest(access_token=access_token)
        auth_resp = get_plaid_client().auth_get(auth_req)

        verified_accounts = []
        for acc in auth_resp.accounts:
            # Find matching numbers
            numbers = None
            for num in auth_resp.numbers.ach:
                if num.account_id == acc.account_id:
                    numbers = num
                    break

            verified_accounts.append({
                "account_id": acc.account_id,
                "name": acc.name,
                "official_name": acc.official_name or acc.name,
                "type": acc.type.value if hasattr(acc.type, 'value') else str(acc.type),
                "subtype": acc.subtype.value if acc.subtype and hasattr(acc.subtype, 'value') else str(acc.subtype) if acc.subtype else '',
                "mask": acc.mask or '',
                "current_balance": acc.balances.current,
                "available_balance": acc.balances.available,
                "routing_number": numbers.routing if numbers else '',
                "account_number": numbers.account if numbers else '',
                "wire_routing": numbers.wire_routing if numbers and hasattr(numbers, 'wire_routing') else '',
                "institution_name": institution_name,
                "verified": True,
                "verified_at": datetime.utcnow().isoformat(),
            })

        # Get identity info if available
        identity_info = {}
        try:
            for owner in auth_resp.accounts[0].owners if hasattr(auth_resp.accounts[0], 'owners') and auth_resp.accounts[0].owners else []:
                identity_info = {
                    "name": ' '.join([n.first for n in owner.names]) if owner.names else '',
                    "email": owner.emails[0].data if owner.emails else '',
                    "phone": owner.phone_numbers[0].data if owner.phone_numbers else '',
                    "address": f"{owner.addresses[0].data.street}, {owner.addresses[0].data.city}, {owner.addresses[0].data.region} {owner.addresses[0].data.postal_code}" if owner.addresses else '',
                }
                break
        except Exception:
            pass

        logger.info(f"✅ Plaid Auth verified {len(verified_accounts)} accounts from {institution_name}")

        return {
            "success": True,
            "institution_name": institution_name,
            "accounts": verified_accounts,
            "identity": identity_info,
        }

    except plaid.ApiException as e:
        logger.error(f"❌ Plaid Auth error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")
