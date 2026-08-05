"""
Plaid Integration Service for Ross Lending
Handles: Link token creation, public token exchange, and bank account retrieval (Auth).
Keys are loaded from environment variables and can also be stored in DB system_settings
for easy production key swapping via admin UI.
"""

import os
import logging
from datetime import datetime
from typing import Optional

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.auth_get_request import AuthGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products

logger = logging.getLogger("plaid_service")

_db = None
_plaid_client: Optional[plaid_api.PlaidApi] = None


def _build_plaid_client(client_id: str, secret: str, env: str = "sandbox") -> plaid_api.PlaidApi:
    """Create a Plaid API client."""
    env_map = {
        "sandbox": plaid.Environment.Sandbox,
        "development": plaid.Environment.Sandbox,
        "production": plaid.Environment.Production,
    }
    host = env_map.get(env.lower(), plaid.Environment.Sandbox)

    configuration = plaid.Configuration(
        host=host,
        api_key={
            "clientId": client_id,
            "secret": secret,
        },
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


async def init_plaid_service(db):
    """Initialize the Plaid service. Tries DB settings first, then falls back to env vars."""
    global _db, _plaid_client
    _db = db

    # Try loading from DB system_settings first (for easy key rotation via admin UI)
    client_id = None
    secret = None
    plaid_env = "sandbox"

    try:
        settings = await db.system_settings.find_one({"type": "plaid_config"})
        if settings:
            client_id = settings.get("client_id")
            secret = settings.get("secret")
            plaid_env = settings.get("environment", "sandbox")
            logger.info(f"Plaid config loaded from DB (env: {plaid_env})")
    except Exception as e:
        logger.warning(f"Could not load Plaid config from DB: {e}")

    # Fall back to environment variables
    if not client_id or not secret:
        client_id = os.getenv("PLAID_CLIENT_ID", "")
        secret = os.getenv("PLAID_SECRET", "")
        plaid_env = os.getenv("PLAID_ENV", "sandbox")
        logger.info(f"Plaid config loaded from env vars (env: {plaid_env})")

    if client_id and secret:
        _plaid_client = _build_plaid_client(client_id, secret, plaid_env)
        logger.info("✅ Plaid client initialized successfully")
    else:
        logger.warning("⚠️ Plaid credentials not configured — Plaid features disabled")


def get_plaid_client() -> Optional[plaid_api.PlaidApi]:
    return _plaid_client


async def create_link_token(user_id: str, user_name: str = "Loan Applicant") -> dict:
    """Create a Plaid Link token for the given user."""
    if not _plaid_client:
        raise Exception("Plaid not configured")

    user = LinkTokenCreateRequestUser(client_user_id=user_id)

    request = LinkTokenCreateRequest(
        user=user,
        client_name="Ross Lending",
        products=[Products("auth")],
        language="en",
        country_codes=[CountryCode("US")],
    )

    try:
        response = _plaid_client.link_token_create(request)
        data = response.to_dict()
        return {
            "link_token": data["link_token"],
            "expiration": str(data.get("expiration", "")),
        }
    except plaid.ApiException as e:
        logger.error(f"Plaid link_token_create error: {e}")
        raise Exception(f"Plaid error: {e.body}")


async def exchange_public_token(public_token: str, user_id: str) -> dict:
    """Exchange a public token for access token, then fetch bank accounts."""
    if not _plaid_client:
        raise Exception("Plaid not configured")

    # 1. Exchange public token for access token
    exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
    try:
        exchange_response = _plaid_client.item_public_token_exchange(exchange_request)
        data = exchange_response.to_dict()
        access_token = data["access_token"]
        item_id = data["item_id"]
    except plaid.ApiException as e:
        logger.error(f"Plaid exchange error: {e}")
        raise Exception(f"Plaid exchange error: {e.body}")

    # 2. Fetch bank accounts + routing/account numbers via Auth
    accounts_data = []
    try:
        auth_request = AuthGetRequest(access_token=access_token)
        auth_response = _plaid_client.auth_get(auth_request)
        auth_data = auth_response.to_dict()

        ach_numbers = {n["account_id"]: n for n in auth_data.get("numbers", {}).get("ach", [])}

        for acct in auth_data.get("accounts", []):
            acct_id = acct["account_id"]
            numbers = ach_numbers.get(acct_id, {})
            accounts_data.append({
                "account_id": acct_id,
                "name": acct.get("name", ""),
                "official_name": acct.get("official_name", ""),
                "mask": acct.get("mask", ""),
                "type": acct.get("type", ""),
                "subtype": acct.get("subtype", ""),
                "routing_number": numbers.get("routing", ""),
                "account_number": numbers.get("account", ""),
                "wire_routing": numbers.get("wire_routing", ""),
            })
    except plaid.ApiException as e:
        logger.warning(f"Plaid auth_get error (token exchanged but auth failed): {e}")

    # 3. Store Plaid item securely in DB (access_token encrypted ideally)
    if _db:
        plaid_item = {
            "user_id": user_id,
            "item_id": item_id,
            "access_token": access_token,  # TODO: encrypt in production
            "institution_id": "",
            "accounts": accounts_data,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        await _db.plaid_items.update_one(
            {"user_id": user_id},
            {"$set": plaid_item},
            upsert=True,
        )

    return {
        "item_id": item_id,
        "accounts": accounts_data,
    }


async def get_user_bank_accounts(user_id: str) -> list:
    """Retrieve stored bank accounts for a user."""
    if not _db:
        return []

    item = await _db.plaid_items.find_one({"user_id": user_id})
    if not item:
        return []

    # Return accounts without the full account number (masked)
    accounts = item.get("accounts", [])
    safe_accounts = []
    for a in accounts:
        safe_accounts.append({
            "account_id": a.get("account_id", ""),
            "name": a.get("name", ""),
            "mask": a.get("mask", ""),
            "type": a.get("type", ""),
            "subtype": a.get("subtype", ""),
            "routing_last4": a.get("routing_number", "")[-4:] if a.get("routing_number") else "",
            "has_routing": bool(a.get("routing_number")),
            "has_account": bool(a.get("account_number")),
        })
    return safe_accounts


async def save_plaid_config(client_id: str, secret: str, environment: str = "sandbox") -> bool:
    """Save Plaid configuration to DB for easy key rotation."""
    global _plaid_client
    if not _db:
        return False

    await _db.system_settings.update_one(
        {"type": "plaid_config"},
        {"$set": {
            "type": "plaid_config",
            "client_id": client_id,
            "secret": secret,
            "environment": environment,
            "updated_at": datetime.utcnow().isoformat(),
        }},
        upsert=True,
    )

    # Reinitialize client with new keys
    _plaid_client = _build_plaid_client(client_id, secret, environment)
    logger.info(f"✅ Plaid config updated and client reinitialized (env: {environment})")
    return True
