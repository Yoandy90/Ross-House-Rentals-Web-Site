"""
Admin Subscriptions Management - Unified endpoint for all plan types
Handles: Recibos Pro, Semilla, Crecimiento, Empresarial
Payment: Cash, Merchant One (card/ACH), recurring billing
"""
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

subscription_admin_router = APIRouter(prefix="/admin/subscriptions", tags=["Admin Subscriptions"])

# All available plans
AVAILABLE_PLANS = [
    {"id": "receipts_pro", "name": "Recibos Pro", "price": 4.99, "apple_product_id": "com.rosstax.plan.receipts.monthly", "category": "feature", "description": "Escaneo ilimitado de recibos"},
    {"id": "seed", "name": "Semilla", "price": 199.00, "apple_product_id": "com.rosstax.plan.seed.monthly", "category": "business", "description": "Freelancers y negocios nuevos - 50 transacciones/mes"},
    {"id": "growth", "name": "Crecimiento", "price": 399.00, "apple_product_id": "com.rosstax.plan.growth.monthly", "category": "business", "description": "Negocios en crecimiento - 200 transacciones/mes"},
    {"id": "enterprise", "name": "Empresarial", "price": 699.00, "apple_product_id": "com.rosstax.plan.enterprise.monthly", "category": "business", "description": "Transacciones ilimitadas + CFO virtual"},
]


def _get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    return client[os.getenv("DB_NAME", "taxportal")]


_db = _get_db()


async def _require_admin(request: Request):
    """Verify admin access"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.replace("Bearer ", "")
    
    import jwt, os
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET", "secret"), algorithms=["HS256"])
        user_id = payload.get("sub")
        user = await _db.users.find_one({"id": user_id})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@subscription_admin_router.get("/plans")
async def get_available_plans(request: Request):
    """Get all available subscription plans"""
    await _require_admin(request)
    return {"success": True, "plans": AVAILABLE_PLANS}


@subscription_admin_router.get("/all")
async def list_all_subscriptions(request: Request, status: str = "all", plan: str = "all"):
    """List all subscriptions across all plans"""
    await _require_admin(request)
    
    query = {}
    if status != "all":
        query["status"] = status
    if plan != "all":
        query["$or"] = [
            {"plan_id": plan},
            {"plan_name": {"$regex": plan, "$options": "i"}},
            {"apple_product_id": {"$regex": plan, "$options": "i"}},
        ]
    
    subs = await _db.user_subscriptions.find(query).sort("created_at", -1).to_list(500)
    
    subscribers = []
    stats = {"total": 0, "active": 0, "cancelled": 0, "total_revenue": 0.0, "mrr": 0.0}
    
    for s in subs:
        user = await _db.users.find_one({"id": s.get("user_id")}, {"name": 1, "email": 1, "phone": 1})
        user_name = user.get("name", "—") if user else "—"
        user_email = user.get("email", "—") if user else "—"
        user_phone = user.get("phone", "—") if user else "—"
        
        price = s.get("price", 0)
        if not price:
            # Look up from plan definition
            plan_match = next((p for p in AVAILABLE_PLANS if p["apple_product_id"] == s.get("apple_product_id")), None)
            if plan_match:
                price = plan_match["price"]
        
        sub_status = s.get("status", "unknown")
        stats["total"] += 1
        if sub_status == "active":
            stats["active"] += 1
            stats["mrr"] += price
        else:
            stats["cancelled"] += 1
        
        # Calculate months active
        created = s.get("created_at") or s.get("activated_at")
        months = 0
        if created:
            try:
                if isinstance(created, str):
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                else:
                    created_dt = created
                months = max(1, (datetime.utcnow() - created_dt.replace(tzinfo=None)).days // 30)
            except:
                months = 1
        
        stats["total_revenue"] += price * months
        
        subscribers.append({
            "subscription_id": str(s["_id"]),
            "user_id": s.get("user_id", ""),
            "user_name": user_name,
            "user_email": user_email,
            "user_phone": user_phone,
            "plan_id": s.get("plan_id", s.get("apple_product_id", "")),
            "plan_name": s.get("plan_name", ""),
            "price": price,
            "status": sub_status,
            "source": s.get("source", s.get("platform", "unknown")),
            "billing_period": s.get("billing_period", "monthly"),
            "activated_at": str(s.get("activated_at", s.get("created_at", ""))),
            "cancelled_at": str(s.get("cancelled_at", "")),
            "expires_at": str(s.get("expires_at", s.get("next_billing_date", ""))),
            "merchant_one_id": s.get("nmi_subscription_id", s.get("merchant_one_id", "")),
            "months_active": months,
            "total_paid": price * months,
        })
    
    return {"success": True, "subscribers": subscribers, "stats": stats}


@subscription_admin_router.get("/search-clients")
async def search_clients(request: Request, q: str = ""):
    """Search clients by name, email, or phone across users AND season_clients"""
    await _require_admin(request)
    
    if len(q.strip()) < 2:
        return {"success": True, "clients": []}
    
    query_str = q.strip()
    regex = {"$regex": query_str, "$options": "i"}
    seen_emails = set()
    clients = []
    
    # 1) Search in 'users' collection (app-registered users)
    app_users = await _db.users.find({
        "$or": [{"name": regex}, {"email": regex}, {"phone": {"$regex": query_str}}]
    }).limit(20).to_list(20)
    
    for u in app_users:
        user_id = u.get("id") or str(u.get("_id", ""))
        email = (u.get("email") or "").strip().lower()
        
        # Check current subscriptions
        active_subs = await _db.user_subscriptions.find({
            "user_id": user_id, "status": "active"
        }).to_list(10)
        plan_names = [s.get("plan_name", "") for s in active_subs]
        
        clients.append({
            "id": user_id,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "phone": u.get("phone", ""),
            "source": "app",
            "active_plans": plan_names,
        })
        if email:
            seen_emails.add(email)
    
    # 2) Search in 'season_clients' collection (office/walk-in clients)
    season_results = await _db.season_clients.find({
        "$or": [
            {"first_name": regex},
            {"last_name": regex},
            {"email": regex},
            {"phone": {"$regex": query_str}},
        ]
    }).limit(30).to_list(30)
    
    for sc in season_results:
        email = (sc.get("email") or "").strip().lower()
        # Skip duplicates already found in users collection
        if email and email in seen_emails:
            continue
        
        full_name = f"{sc.get('first_name', '')} {sc.get('last_name', '')}".strip()
        sc_id = str(sc.get("_id", ""))
        
        clients.append({
            "id": f"season_{sc_id}",
            "name": full_name,
            "email": sc.get("email", ""),
            "phone": sc.get("phone", ""),
            "source": "season",
            "active_plans": [],
        })
        if email:
            seen_emails.add(email)
    
    return {"success": True, "clients": clients}


@subscription_admin_router.post("/create-client")
async def create_client(request: Request):
    """Create a new client (for walk-ins who don't have an app account)"""
    admin = await _require_admin(request)
    body = await request.json()
    
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    phone = body.get("phone", "").strip()
    
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    # Check if exists
    existing = await _db.users.find_one({"email": email})
    if existing:
        return {"success": True, "client": {"id": existing["id"], "name": existing.get("name", name), "email": email, "phone": existing.get("phone", phone), "active_plans": []}, "already_exists": True}
    
    # Create new user
    import uuid, hashlib
    user_id = str(uuid.uuid4())
    temp_password = f"Temp{uuid.uuid4().hex[:6]}!"
    hashed = hashlib.sha256(temp_password.encode()).hexdigest()
    
    new_user = {
        "id": user_id,
        "name": name,
        "email": email,
        "phone": phone,
        "password": hashed,
        "role": "client",
        "created_at": datetime.utcnow(),
        "created_by": "admin_subscription",
    }
    await _db.users.insert_one(new_user)
    
    return {
        "success": True,
        "client": {"id": user_id, "name": name, "email": email, "phone": phone, "active_plans": []},
        "already_exists": False,
        "temp_password": temp_password,
    }


@subscription_admin_router.get("/client-payment-methods/{user_id}")
async def get_client_payment_methods(request: Request, user_id: str):
    """Get Merchant One payment methods for a client"""
    await _require_admin(request)
    
    from bson import ObjectId
    
    # Get payment methods from vault
    pms = await _db.payment_methods.find({
        "user_id": user_id, "active": {"$ne": False}
    }).to_list(20)
    
    methods = []
    for pm in pms:
        methods.append({
            "id": str(pm["_id"]),
            "type": pm.get("type", "card"),
            "last_4": pm.get("last_4", pm.get("card_last4", "")),
            "card_brand": pm.get("card_brand", pm.get("brand", "")),
            "exp_month": pm.get("exp_month", ""),
            "exp_year": pm.get("exp_year", ""),
            "bank_account_last4": pm.get("bank_account_last4", pm.get("account_last4", "")),
            "bank_account_type": pm.get("bank_account_type", ""),
            "account_holder_name": pm.get("account_holder_name", pm.get("holder_name", "")),
            "nmi_vault_id": pm.get("nmi_vault_id", ""),
            "is_default": pm.get("is_default", False),
        })
    
    return {"success": True, "payment_methods": methods}


@subscription_admin_router.post("/activate")
async def activate_subscription(request: Request):
    """
    Activate a subscription for a client.
    Body: { user_id, plan_id, payment_type: 'cash' | 'merchant_one' | 'merchant_one_recurring', payment_method_id? }
    """
    admin = await _require_admin(request)
    body = await request.json()
    
    user_id = body.get("user_id")
    plan_id = body.get("plan_id")
    payment_type = body.get("payment_type", "cash")
    payment_method_id = body.get("payment_method_id")
    
    if not user_id or not plan_id:
        raise HTTPException(status_code=400, detail="user_id and plan_id are required")
    
    # If the user_id is a season client (season_<objectid>), auto-create a user record
    if user_id.startswith("season_"):
        from bson import ObjectId as ObjId
        season_oid = user_id.replace("season_", "")
        sc = None
        if ObjId.is_valid(season_oid):
            sc = await _db.season_clients.find_one({"_id": ObjId(season_oid)})
        if not sc:
            raise HTTPException(status_code=404, detail="Cliente de temporada no encontrado")
        
        sc_email = (sc.get("email") or "").strip().lower()
        full_name = f"{sc.get('first_name', '')} {sc.get('last_name', '')}".strip()
        
        # Check if a user with this email already exists
        existing_user = None
        if sc_email:
            existing_user = await _db.users.find_one({"email": {"$regex": f"^{sc_email}$", "$options": "i"}})
        
        if existing_user:
            user_id = existing_user.get("id") or str(existing_user.get("_id", ""))
            logger.info(f"Season client matched to existing user: {user_id} ({sc_email})")
        else:
            # Create a new user from season data
            import uuid, hashlib
            user_id = str(uuid.uuid4())
            temp_password = f"Temp{uuid.uuid4().hex[:6]}!"
            hashed = hashlib.sha256(temp_password.encode()).hexdigest()
            new_user = {
                "id": user_id,
                "name": full_name,
                "email": sc_email or f"season_{season_oid}@placeholder.local",
                "phone": sc.get("phone", ""),
                "password": hashed,
                "role": "client",
                "created_at": datetime.utcnow(),
                "created_by": "admin_subscription_from_season",
                "season_client_id": season_oid,
            }
            await _db.users.insert_one(new_user)
            logger.info(f"Created user from season client: {user_id} ({full_name})")
    
    # Find plan
    plan = next((p for p in AVAILABLE_PLANS if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Plan '{plan_id}' not found")
    
    # Check if already has this plan active
    existing = await _db.user_subscriptions.find_one({
        "user_id": user_id,
        "apple_product_id": plan["apple_product_id"],
        "status": "active"
    })
    if existing:
        user = await _db.users.find_one({"id": user_id}, {"name": 1})
        return {"success": False, "message": f"{user.get('name', user_id) if user else user_id} ya tiene {plan['name']} activo."}
    
    merchant_one_id = ""
    
    # Process payment if Merchant One
    if payment_type in ("merchant_one", "merchant_one_recurring") and payment_method_id:
        from bson import ObjectId as ObjId
        
        pm = None
        if ObjId.is_valid(payment_method_id):
            pm = await _db.payment_methods.find_one({"_id": ObjId(payment_method_id), "active": {"$ne": False}})
        if not pm:
            pm = await _db.payment_methods.find_one({"nmi_vault_id": payment_method_id, "active": {"$ne": False}})
        
        if not pm:
            return {"success": False, "message": "Método de pago no encontrado"}
        
        nmi_vault_id = pm.get("nmi_vault_id")
        if not nmi_vault_id:
            return {"success": False, "message": "Este método no tiene token NMI."}
        
        if payment_type == "merchant_one_recurring":
            # Create recurring subscription
            from merchant_one_service import MerchantOneService
            from merchant_one_models import SubscriptionInfo
            
            merchant_svc = MerchantOneService(_db)
            sub_info = SubscriptionInfo(
                planName=plan["name"],
                amount=plan["price"],
                dayFrequency=30,
                startDate="",
                planPayments=0,
                orderDescription=f"{plan['name']} - {plan['description']} (${plan['price']}/mes)"
            )
            response = await merchant_svc.create_subscription(nmi_vault_id, sub_info)
            
            if not response.success or response.responseCode != '1':
                error_msg = response.errorMessage or response.responseText or 'Error desconocido'
                return {"success": False, "message": f"Error Merchant One: {error_msg}"}
            
            merchant_one_id = response.subscriptionId or response.transactionId or ""
        else:
            # One-time charge
            from merchant_one_service import MerchantOneService
            
            merchant_svc = MerchantOneService(_db)
            response = await merchant_svc.charge_vault(nmi_vault_id, plan["price"], f"{plan['name']} - {plan['description']}")
            
            if not response.success or response.responseCode != '1':
                error_msg = response.errorMessage or response.responseText or 'Error desconocido'
                return {"success": False, "message": f"Error al cobrar: {error_msg}"}
            
            merchant_one_id = response.transactionId or ""
    
    # Create subscription record
    sub_doc = {
        "user_id": user_id,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "apple_product_id": plan["apple_product_id"],
        "price": plan["price"],
        "billing_period": "monthly",
        "status": "active",
        "source": payment_type,
        "payment_method_id": payment_method_id or "",
        "nmi_subscription_id": merchant_one_id,
        "activated_at": datetime.utcnow().isoformat(),
        "activated_by": admin.get("id", admin.get("email", "admin")),
        "created_at": datetime.utcnow().isoformat(),
    }
    
    if payment_type == "merchant_one_recurring":
        sub_doc["next_billing_date"] = datetime.utcnow().isoformat()  # Will be set by NMI
    
    await _db.user_subscriptions.insert_one(sub_doc)
    
    user = await _db.users.find_one({"id": user_id}, {"name": 1})
    user_name = user.get("name", user_id) if user else user_id
    
    payment_label = {"cash": "Efectivo", "merchant_one": "Tarjeta/ACH (Único)", "merchant_one_recurring": "Tarjeta/ACH (Recurrente)"}
    
    logger.info(f"✅ Subscription '{plan['name']}' activated for {user_name} via {payment_type}")
    
    return {
        "success": True,
        "message": f"✅ {plan['name']} activado para {user_name} — {payment_label.get(payment_type, payment_type)} ${plan['price']}/mes",
    }


@subscription_admin_router.post("/deactivate")
async def deactivate_subscription(request: Request):
    """Deactivate a subscription. Body: { subscription_id }"""
    admin = await _require_admin(request)
    body = await request.json()
    
    subscription_id = body.get("subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="subscription_id required")
    
    from bson import ObjectId
    
    sub = await _db.user_subscriptions.find_one({"_id": ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Cancel NMI recurring if applicable
    nmi_sub_id = sub.get("nmi_subscription_id")
    if nmi_sub_id and sub.get("source") == "merchant_one_recurring":
        try:
            from merchant_one_service import MerchantOneService
            merchant_svc = MerchantOneService(_db)
            await merchant_svc.cancel_subscription(nmi_sub_id)
            logger.info(f"Cancelled NMI subscription: {nmi_sub_id}")
        except Exception as e:
            logger.warning(f"Failed to cancel NMI subscription {nmi_sub_id}: {e}")
    
    await _db.user_subscriptions.update_one(
        {"_id": ObjectId(subscription_id)},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "cancelled_by": admin.get("id", admin.get("email", "admin")),
        }}
    )
    
    user = await _db.users.find_one({"id": sub.get("user_id")}, {"name": 1})
    user_name = user.get("name", sub.get("user_id", "")) if user else ""
    
    return {"success": True, "message": f"Suscripción de {sub.get('plan_name', '')} cancelada para {user_name}"}


@subscription_admin_router.delete("/{subscription_id}")
async def delete_subscription(request: Request, subscription_id: str):
    """Permanently delete a subscription record"""
    admin = await _require_admin(request)
    
    from bson import ObjectId
    
    sub = await _db.user_subscriptions.find_one({"_id": ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Cancel NMI if recurring
    nmi_sub_id = sub.get("nmi_subscription_id")
    if nmi_sub_id and sub.get("source") == "merchant_one_recurring":
        try:
            from merchant_one_service import MerchantOneService
            merchant_svc = MerchantOneService(_db)
            await merchant_svc.cancel_subscription(nmi_sub_id)
        except:
            pass
    
    await _db.user_subscriptions.delete_one({"_id": ObjectId(subscription_id)})
    
    return {"success": True, "message": "Suscripción eliminada permanentemente"}
