"""
Bookkeeping Banking Data Router
Lists all clients with Plaid-linked bank accounts and their routing/account numbers.
Aggregates from plaid_items collection joined with user data.
"""

import logging
import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/bookkeeping/banking-data", tags=["Bookkeeping Banking Data"])

db = None

def set_db(database):
    global db
    db = database


async def get_admin_user(request: Request):
    """Verify admin authentication"""
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(status_code=401, detail="No authorization")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"_id": session["user_id"]})
    if not user or user.get("role") not in ("admin", "office_assistant"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("")
async def list_plaid_banking_data(
    request: Request,
    search: str = Query("", description="Search by name, institution, email"),
    context: str = Query("", description="Filter: personal, business, or all"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """List all clients with Plaid-linked bank accounts"""
    await get_admin_user(request)

    # Get all active plaid items
    plaid_query = {"status": "active"}
    if context in ("personal", "business"):
        plaid_query["context"] = context

    plaid_items = await db.plaid_items.find(plaid_query).sort("created_at", -1).to_list(1000)

    # Get unique user IDs
    user_ids = list(set(item["user_id"] for item in plaid_items))

    # Fetch user data
    users_map = {}
    for uid in user_ids:
        user = await db.users.find_one({"id": uid}, {"name": 1, "email": 1, "phone": 1, "id": 1, "role": 1})
        if user:
            users_map[uid] = user

    # Build consolidated records
    records = []
    for item in plaid_items:
        user = users_map.get(item["user_id"], {})
        user_name = user.get("name", "Desconocido")
        user_email = user.get("email", "")
        user_phone = user.get("phone", "")
        institution = item.get("institution_name", "")
        ctx = item.get("context", "personal")

        for acct in item.get("accounts", []):
            record = {
                "id": str(item.get("_id", "")),
                "user_id": item["user_id"],
                "user_name": user_name,
                "user_email": user_email,
                "user_phone": user_phone,
                "institution_name": institution,
                "account_name": acct.get("name", ""),
                "official_name": acct.get("official_name", ""),
                "account_type": acct.get("type", ""),
                "account_subtype": acct.get("subtype", ""),
                "mask": acct.get("mask", ""),
                "current_balance": acct.get("current_balance"),
                "available_balance": acct.get("available_balance"),
                "account_id": acct.get("account_id", ""),
                "context": ctx,
                "routing_number": acct.get("routing_number", ""),
                "account_number": acct.get("account_number", ""),
                "auth_fetched": bool(acct.get("routing_number")),
                "linked_at": item.get("created_at", "").isoformat() if isinstance(item.get("created_at"), datetime) else str(item.get("created_at", "")),
            }
            records.append(record)

    # Apply search filter
    if search:
        search_lower = search.lower()
        records = [
            r for r in records
            if search_lower in r["user_name"].lower()
            or search_lower in r["user_email"].lower()
            or search_lower in r["institution_name"].lower()
            or search_lower in r.get("user_phone", "").lower()
            or search_lower in r.get("mask", "").lower()
        ]

    total = len(records)
    start = (page - 1) * limit
    end = start + limit
    paginated = records[start:end]

    return {
        "success": True,
        "records": paginated,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total > 0 else 1,
    }


@router.post("/fetch-auth/{user_id}")
async def fetch_auth_numbers(user_id: str, request: Request):
    """Fetch routing and account numbers from Plaid Auth API for a specific user and save them"""
    await get_admin_user(request)

    try:
        from plaid.model.auth_get_request import AuthGetRequest
        # Import the smart Plaid client from plaid_routes
        import plaid_routes
        client = await plaid_routes.get_smart_plaid_client()

        items = await db.plaid_items.find({"user_id": user_id, "status": "active"}).to_list(50)
        if not items:
            raise HTTPException(status_code=404, detail="No hay cuentas Plaid activas para este usuario")

        updated_count = 0
        errors = []

        for item in items:
            try:
                auth_request = AuthGetRequest(access_token=item["access_token"])
                response = client.auth_get(auth_request)

                numbers = response.get("numbers", {})
                ach_numbers = numbers.get("ach", [])

                # Update accounts with auth data
                accounts = item.get("accounts", [])
                for ach in ach_numbers:
                    for i, acct in enumerate(accounts):
                        if acct.get("account_id") == ach.get("account_id"):
                            accounts[i]["routing_number"] = ach.get("routing", "")
                            accounts[i]["account_number"] = ach.get("account", "")
                            accounts[i]["wire_routing"] = ach.get("wire_routing", "")
                            updated_count += 1

                # Save back to DB
                await db.plaid_items.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"accounts": accounts, "auth_fetched_at": datetime.utcnow()}}
                )

            except Exception as e:
                errors.append(f"{item.get('institution_name', 'Unknown')}: {str(e)}")
                logger.warning(f"Auth fetch error for {user_id}: {e}")

        return {
            "success": True,
            "updated_accounts": updated_count,
            "errors": errors,
            "message": f"Se obtuvieron {updated_count} números de cuenta" + (f" ({len(errors)} errores)" if errors else ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fetch auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fetch-all-auth")
async def fetch_all_auth_numbers(request: Request):
    """Fetch routing and account numbers from Plaid Auth API for ALL active users"""
    await get_admin_user(request)

    try:
        from plaid.model.auth_get_request import AuthGetRequest
        import plaid_routes
        client = await plaid_routes.get_smart_plaid_client()

        items = await db.plaid_items.find({"status": "active"}).to_list(500)
        if not items:
            return {"success": True, "message": "No hay cuentas Plaid activas", "updated_accounts": 0}

        total_updated = 0
        total_errors = []

        for item in items:
            try:
                auth_request = AuthGetRequest(access_token=item["access_token"])
                response = client.auth_get(auth_request)

                numbers = response.get("numbers", {})
                ach_numbers = numbers.get("ach", [])

                accounts = item.get("accounts", [])
                for ach in ach_numbers:
                    for i, acct in enumerate(accounts):
                        if acct.get("account_id") == ach.get("account_id"):
                            accounts[i]["routing_number"] = ach.get("routing", "")
                            accounts[i]["account_number"] = ach.get("account", "")
                            accounts[i]["wire_routing"] = ach.get("wire_routing", "")
                            total_updated += 1

                await db.plaid_items.update_one(
                    {"_id": item["_id"]},
                    {"$set": {
                        "accounts": accounts,
                        "auth_fetched_at": datetime.utcnow(),
                        "auth_error": None,
                    }}
                )

            except Exception as e:
                error_msg = str(e)[:200]
                # Detect Plaid ITEM_LOGIN_REQUIRED or 400 errors
                if '400' in error_msg or 'ITEM_LOGIN_REQUIRED' in error_msg or 'Bad Request' in error_msg:
                    friendly_msg = f"{item.get('institution_name', '')} ({item.get('context', 'unknown')}): ⚠️ Requiere re-autenticación. El cliente debe volver a vincular esta cuenta desde la app."
                elif 'INVALID_ACCESS_TOKEN' in error_msg:
                    friendly_msg = f"{item.get('institution_name', '')} ({item.get('context', 'unknown')}): ❌ Token inválido. La cuenta debe ser re-vinculada."
                else:
                    friendly_msg = f"{item.get('institution_name', '')} ({item.get('context', 'unknown')}): {error_msg}"
                total_errors.append(friendly_msg)
                # Mark that we tried (so admin knows it failed)
                await db.plaid_items.update_one(
                    {"_id": item["_id"]},
                    {"$set": {
                        "auth_fetched_at": datetime.utcnow(),
                        "auth_error": error_msg,
                    }}
                )

        error_detail = ""
        if total_errors:
            error_detail = " | Errores: " + " | ".join(total_errors)

        return {
            "success": True,
            "updated_accounts": total_updated,
            "total_items": len(items),
            "errors": total_errors,
            "message": f"Se obtuvieron {total_updated} números de ruta/cuenta de {len(items)} conexiones bancarias" + error_detail,
        }

    except Exception as e:
        logger.error(f"Fetch all auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def banking_data_stats(request: Request):
    """Get stats for Plaid banking data"""
    await get_admin_user(request)

    total_items = await db.plaid_items.count_documents({"status": "active"})
    business_items = await db.plaid_items.count_documents({"status": "active", "context": "business"})
    personal_items = await db.plaid_items.count_documents({"status": "active", "context": "personal"})

    # Count unique users
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    result = await db.plaid_items.aggregate(pipeline).to_list(1)
    unique_users = result[0]["total"] if result else 0

    # Count accounts with auth data
    with_auth = 0
    without_auth = 0
    async for item in db.plaid_items.find({"status": "active"}):
        for acct in item.get("accounts", []):
            if acct.get("routing_number"):
                with_auth += 1
            else:
                without_auth += 1

    return {
        "success": True,
        "total_connections": total_items,
        "business_connections": business_items,
        "personal_connections": personal_items,
        "unique_users": unique_users,
        "accounts_with_auth": with_auth,
        "accounts_without_auth": without_auth,
    }
