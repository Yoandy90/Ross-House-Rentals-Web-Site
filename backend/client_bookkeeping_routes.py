"""
Client Bookkeeping Routes
Client-facing endpoints for the "Mi Negocio" section.
Allows business clients to view their dashboard, transactions, upload receipts, and view P&L.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query, Body, Request
from bson import ObjectId

logger = logging.getLogger(__name__)

client_bk_router = APIRouter()
_db = None
_notification_service = None


def init_client_bk_router(db, notification_service=None):
    global _db, _notification_service
    _db = db
    _notification_service = notification_service
    # Pass DB reference to receipt AI service for OpenAI key lookup
    try:
        from receipt_ai_service import receipt_ai_service
        receipt_ai_service.set_db(db)
    except Exception:
        pass


async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except Exception:
            user = await _db.users.find_one({'_id': user_id})
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


# ================== HELPERS ==================

IRS_CATEGORIES = [
    {"id": "advertising", "name": "Publicidad", "name_en": "Advertising", "schedule_c_line": "8"},
    {"id": "car_expenses", "name": "Gastos de Vehículo", "name_en": "Car/Truck Expenses", "schedule_c_line": "9"},
    {"id": "commissions", "name": "Comisiones", "name_en": "Commissions & Fees", "schedule_c_line": "10"},
    {"id": "contract_labor", "name": "Mano de Obra Contratada", "name_en": "Contract Labor", "schedule_c_line": "11"},
    {"id": "depreciation", "name": "Depreciación", "name_en": "Depreciation", "schedule_c_line": "13"},
    {"id": "insurance", "name": "Seguros", "name_en": "Insurance", "schedule_c_line": "15"},
    {"id": "interest_mortgage", "name": "Intereses Hipotecarios", "name_en": "Mortgage Interest", "schedule_c_line": "16a"},
    {"id": "interest_other", "name": "Otros Intereses", "name_en": "Other Interest", "schedule_c_line": "16b"},
    {"id": "legal_professional", "name": "Servicios Legales/Profesionales", "name_en": "Legal & Professional", "schedule_c_line": "17"},
    {"id": "office_expense", "name": "Gastos de Oficina", "name_en": "Office Expense", "schedule_c_line": "18"},
    {"id": "rent_lease", "name": "Alquiler/Renta", "name_en": "Rent or Lease", "schedule_c_line": "20b"},
    {"id": "repairs", "name": "Reparaciones/Mantenimiento", "name_en": "Repairs & Maintenance", "schedule_c_line": "21"},
    {"id": "supplies", "name": "Suministros", "name_en": "Supplies", "schedule_c_line": "22"},
    {"id": "taxes_licenses", "name": "Impuestos/Licencias", "name_en": "Taxes & Licenses", "schedule_c_line": "23"},
    {"id": "travel", "name": "Viajes", "name_en": "Travel", "schedule_c_line": "24a"},
    {"id": "meals", "name": "Comidas de Negocio", "name_en": "Meals (Business)", "schedule_c_line": "24b"},
    {"id": "utilities", "name": "Servicios Públicos", "name_en": "Utilities", "schedule_c_line": "25"},
    {"id": "wages", "name": "Salarios", "name_en": "Wages", "schedule_c_line": "26"},
    {"id": "other_expense", "name": "Otros Gastos", "name_en": "Other Expenses", "schedule_c_line": "27a"},
    {"id": "cogs", "name": "Costo de Bienes Vendidos", "name_en": "Cost of Goods Sold", "schedule_c_line": "4"},
    {"id": "income", "name": "Ingresos", "name_en": "Gross Income", "schedule_c_line": "1"},
]


async def _get_client_business(user_id: str):
    """Get the business linked to a client user"""
    biz = await _db.bk_businesses.find_one({
        "$or": [
            {"linked_client_id": user_id},
            {"owner_email": {"$regex": user_id, "$options": "i"}}
        ],
        "status": "active"
    })
    return biz


# ================== CLIENT ENDPOINTS ==================

@client_bk_router.get("/my-business")
async def get_my_business(authorization: Optional[str] = Header(None)):
    """Get the client's linked business info"""
    user = await _get_current_user(authorization)
    
    # Try to find by linked_client_id first, then by email
    biz = await _db.bk_businesses.find_one({
        "$or": [
            {"linked_client_id": user['id']},
            {"owner_email": user.get('email', '')}
        ],
        "status": "active"
    })
    
    if not biz:
        return {"success": True, "has_business": False, "business": None}
    
    biz['_id'] = str(biz['_id'])
    return {"success": True, "has_business": True, "business": biz}


@client_bk_router.get("/my-business/categories")
async def get_categories(authorization: Optional[str] = Header(None)):
    """Get IRS expense categories"""
    await _get_current_user(authorization)
    return {"success": True, "categories": IRS_CATEGORIES}


@client_bk_router.get("/my-business/dashboard")
async def get_my_dashboard(
    authorization: Optional[str] = Header(None),
    year: int = 0,
    month: int = 0
):
    """Get client's business dashboard summary"""
    user = await _get_current_user(authorization)
    biz = await _get_client_business(user['id'])
    
    if not biz:
        # Also try by email
        biz = await _db.bk_businesses.find_one({
            "owner_email": user.get('email', ''),
            "status": "active"
        })
    
    if not biz:
        return {
            "success": True,
            "has_business": False,
            "dashboard": None
        }
    
    business_id = biz.get('id', str(biz['_id']))
    
    now = datetime.now(timezone.utc)
    target_year = year if year > 0 else now.year
    target_month = month if month > 0 else now.month
    
    # Get date range for current month
    month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Year range
    year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    
    # Monthly transactions
    month_txns = await _db.bk_transactions.find({
        "business_id": business_id,
        "date": {"$gte": month_start, "$lt": month_end}
    }).to_list(None)
    
    month_income = sum(t.get('amount', 0) for t in month_txns if t.get('type') == 'income')
    month_expenses = sum(abs(t.get('amount', 0)) for t in month_txns if t.get('type') == 'expense')
    
    # Year-to-date
    year_txns = await _db.bk_transactions.find({
        "business_id": business_id,
        "date": {"$gte": year_start, "$lt": year_end}
    }).to_list(None)
    
    ytd_income = sum(t.get('amount', 0) for t in year_txns if t.get('type') == 'income')
    ytd_expenses = sum(abs(t.get('amount', 0)) for t in year_txns if t.get('type') == 'expense')
    
    # Top expense categories this month
    category_totals = {}
    for t in month_txns:
        if t.get('type') == 'expense':
            cat = t.get('category', 'other_expense')
            category_totals[cat] = category_totals.get(cat, 0) + abs(t.get('amount', 0))
    
    top_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Recent receipts count
    receipts_count = await _db.receipts.count_documents({
        "user_id": user['id'],
        "created_at": {"$gte": month_start}
    })
    
    # Pending receipts (not yet linked to transactions)
    pending_receipts = await _db.receipts.count_documents({
        "user_id": user['id'],
        "status": {"$in": ["pending", "uploaded"]}
    })
    
    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(5, -1, -1):
        m = target_month - i
        y = target_year
        if m <= 0:
            m += 12
            y -= 1
        m_start = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            m_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        else:
            m_end = datetime(y, m + 1, 1, tzinfo=timezone.utc)
        
        def _safe_date(d):
            """Ensure date is timezone-aware for comparison"""
            if d is None:
                return datetime.min.replace(tzinfo=timezone.utc)
            if d.tzinfo is None:
                return d.replace(tzinfo=timezone.utc)
            return d
        m_txns = [t for t in year_txns if m_start <= _safe_date(t.get('date')) < m_end]
        m_inc = sum(t.get('amount', 0) for t in m_txns if t.get('type') == 'income')
        m_exp = sum(abs(t.get('amount', 0)) for t in m_txns if t.get('type') == 'expense')
        
        monthly_trend.append({
            "month": m,
            "year": y,
            "income": round(m_inc, 2),
            "expenses": round(m_exp, 2),
            "net": round(m_inc - m_exp, 2)
        })
    
    # Get subscription info
    subscription_info = None
    user_sub = await _db.user_subscriptions.find_one({
        "user_id": user['id'],
        "status": {"$in": ["active", "trialing"]}
    })
    if user_sub:
        subscription_info = {
            "id": str(user_sub['_id']),
            "plan": user_sub.get('plan_id', user_sub.get('plan', '')),
            "plan_name": user_sub.get('plan_name', ''),
            "status": user_sub.get('status', 'active'),
            "amount": user_sub.get('amount', 0),
            "interval": user_sub.get('interval', 'monthly'),
            "activated_at": user_sub.get('activated_at', user_sub.get('created_at', '')),
            "expires_at": user_sub.get('expires_at', ''),
            "payment_method": user_sub.get('payment_method', 'apple_iap'),
            "auto_renew": user_sub.get('auto_renew', True),
        }
        # Convert datetime to string
        for k in ['activated_at', 'expires_at']:
            if subscription_info[k] and hasattr(subscription_info[k], 'isoformat'):
                subscription_info[k] = subscription_info[k].isoformat()
    
    # Also check bk_businesses for plan info  
    biz_plan = {
        "plan": biz.get('service_plan', biz.get('subscription_plan', 'semilla')),
        "plan_name": biz.get('plan_name', ''),
        "status": biz.get('subscription_status', biz.get('status', 'active')),
    }

    # Get feature flags
    settings = await _db.app_settings.find_one({"key": "feature_flags"}) or {}
    feature_flags = settings.get("value", {})

    dashboard = {
        "business_name": biz.get('business_name', ''),
        "business_type": biz.get('business_type', ''),
        "service_plan": biz_plan.get('plan', 'semilla'),
        "subscription": subscription_info,
        "feature_flags": {
            "show_merchant_one": feature_flags.get("show_merchant_one", False),
            "show_bank_connect": feature_flags.get("show_bank_connect", False),
        },
        "month": target_month,
        "year": target_year,
        "month_income": round(month_income, 2),
        "month_expenses": round(month_expenses, 2),
        "month_net": round(month_income - month_expenses, 2),
        "ytd_income": round(ytd_income, 2),
        "ytd_expenses": round(ytd_expenses, 2),
        "ytd_net": round(ytd_income - ytd_expenses, 2),
        "top_categories": [{"category": c, "amount": round(a, 2)} for c, a in top_categories],
        "receipts_this_month": receipts_count,
        "pending_receipts": pending_receipts,
        "total_transactions_month": len(month_txns),
        "monthly_trend": monthly_trend
    }
    
    return {"success": True, "has_business": True, "dashboard": dashboard}


@client_bk_router.get("/my-business/transactions")
async def get_my_transactions(
    authorization: Optional[str] = Header(None),
    year: int = 0,
    month: int = 0,
    category: str = "",
    type: str = "",
    page: int = 1,
    limit: int = 50
):
    """Get client's business transactions"""
    user = await _get_current_user(authorization)
    biz = await _get_client_business(user['id'])
    
    if not biz:
        biz = await _db.bk_businesses.find_one({"owner_email": user.get('email', ''), "status": "active"})
    
    if not biz:
        return {"success": True, "transactions": [], "total": 0, "has_business": False}
    
    business_id = biz.get('id', str(biz['_id']))
    now = datetime.now(timezone.utc)
    target_year = year if year > 0 else now.year
    
    query = {"business_id": business_id}
    
    if month > 0:
        month_start = datetime(target_year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(target_year, month + 1, 1, tzinfo=timezone.utc)
        query["date"] = {"$gte": month_start, "$lt": month_end}
    else:
        year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
        year_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        query["date"] = {"$gte": year_start, "$lt": year_end}
    
    if category:
        query["category"] = category
    if type:
        query["type"] = type
    
    total = await _db.bk_transactions.count_documents(query)
    skip = (page - 1) * limit
    
    txns = await _db.bk_transactions.find(query).sort("date", -1).skip(skip).limit(limit).to_list(None)
    
    for t in txns:
        t['_id'] = str(t['_id'])
    
    return {
        "success": True,
        "has_business": True,
        "transactions": txns,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@client_bk_router.post("/my-business/receipts")
async def upload_receipt(
    authorization: Optional[str] = Header(None),
    receipt_data: dict = Body(...)
):
    """Upload a receipt with optional AI classification"""
    user = await _get_current_user(authorization)
    
    image_base64 = receipt_data.get('image_base64', '')
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    
    # AI classification
    ai_result = {}
    try:
        from receipt_ai_service import classify_receipt
        ai_result = await classify_receipt(image_base64)
        logger.info(f"🔍 AI receipt result: {ai_result.get('category')} - ${ai_result.get('amount')}")
    except Exception as e:
        logger.warning(f"⚠️ AI classification failed: {e}")
        ai_result = {'success': False}
    
    receipt = {
        "id": str(uuid.uuid4()),
        "user_id": user['id'],
        "user_name": user.get('name', ''),
        "user_email": user.get('email', ''),
        "image_base64": image_base64,
        "category": receipt_data.get('category') or ai_result.get('category'),
        "merchant": receipt_data.get('merchant') or ai_result.get('merchant'),
        "amount": receipt_data.get('amount') or ai_result.get('amount'),
        "receipt_date": receipt_data.get('receipt_date') or ai_result.get('receipt_date'),
        "description": receipt_data.get('description') or ai_result.get('description', ''),
        "notes": receipt_data.get('notes', ''),
        "ai_confidence": ai_result.get('confidence', 0),
        "ai_classified": ai_result.get('success', False),
        "status": "uploaded",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await _db.receipts.insert_one(receipt)
    receipt.pop('image_base64', None)  # Don't return image in response
    receipt['_id'] = str(receipt.get('_id', ''))
    
    logger.info(f"📸 Receipt uploaded by {user.get('name')}: {receipt['merchant']} - ${receipt['amount']}")
    
    return {
        "success": True,
        "receipt": receipt,
        "ai_result": {
            "classified": ai_result.get('success', False),
            "category": ai_result.get('category'),
            "merchant": ai_result.get('merchant'),
            "amount": ai_result.get('amount'),
            "confidence": ai_result.get('confidence', 0)
        }
    }


@client_bk_router.get("/my-business/receipts")
async def get_my_receipts(
    authorization: Optional[str] = Header(None),
    page: int = 1,
    limit: int = 20,
    status: str = ""
):
    """Get client's uploaded receipts"""
    user = await _get_current_user(authorization)
    
    query = {"user_id": user['id']}
    if status:
        query["status"] = status
    
    total = await _db.receipts.count_documents(query)
    skip = (page - 1) * limit
    
    receipts = await _db.receipts.find(
        query,
        {"image_base64": 0}  # Exclude large image data
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    for r in receipts:
        r['_id'] = str(r['_id'])
    
    return {
        "success": True,
        "receipts": receipts,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@client_bk_router.get("/my-business/profit-loss")
async def get_my_profit_loss(
    authorization: Optional[str] = Header(None),
    year: int = 0
):
    """Get simplified P&L for client's business"""
    user = await _get_current_user(authorization)
    biz = await _get_client_business(user['id'])
    
    if not biz:
        biz = await _db.bk_businesses.find_one({"owner_email": user.get('email', ''), "status": "active"})
    
    if not biz:
        return {"success": True, "has_business": False, "profit_loss": None}
    
    business_id = biz.get('id', str(biz['_id']))
    now = datetime.now(timezone.utc)
    target_year = year if year > 0 else now.year
    
    year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    
    txns = await _db.bk_transactions.find({
        "business_id": business_id,
        "date": {"$gte": year_start, "$lt": year_end}
    }).to_list(None)
    
    total_income = 0
    total_expenses = 0
    expense_by_category = {}
    income_by_category = {}
    
    for t in txns:
        amount = t.get('amount', 0)
        cat = t.get('category', 'other_expense')
        
        if t.get('type') == 'income':
            total_income += amount
            income_by_category[cat] = income_by_category.get(cat, 0) + amount
        else:
            total_expenses += abs(amount)
            expense_by_category[cat] = expense_by_category.get(cat, 0) + abs(amount)
    
    # Map categories to display names
    cat_names = {c['id']: c for c in IRS_CATEGORIES}
    
    expense_breakdown = []
    for cat, amount in sorted(expense_by_category.items(), key=lambda x: x[1], reverse=True):
        cat_info = cat_names.get(cat, {"name": cat, "name_en": cat, "schedule_c_line": ""})
        expense_breakdown.append({
            "category": cat,
            "name": cat_info.get('name', cat),
            "name_en": cat_info.get('name_en', cat),
            "schedule_c_line": cat_info.get('schedule_c_line', ''),
            "amount": round(amount, 2)
        })
    
    profit_loss = {
        "year": target_year,
        "business_name": biz.get('business_name', ''),
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(total_income - total_expenses, 2),
        "expense_breakdown": expense_breakdown,
        "total_transactions": len(txns)
    }
    
    return {"success": True, "has_business": True, "profit_loss": profit_loss}


@client_bk_router.delete("/my-business/receipts/{receipt_id}")
async def delete_my_receipt(
    receipt_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a client's receipt"""
    user = await _get_current_user(authorization)
    
    result = await _db.receipts.delete_one({
        "id": receipt_id,
        "user_id": user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    return {"success": True, "message": "Receipt deleted"}


# ================== BOOKKEEPING SERVICE REQUEST ==================

@client_bk_router.post("/my-business/request-service")
async def request_bookkeeping_service(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Client requests a bookkeeping service plan - works with or without auth"""
    # Try to get user from auth, but don't require it
    user = {}
    try:
        if authorization:
            user = await _get_current_user(authorization)
    except Exception:
        pass  # Continue without auth - this is a lead capture form
    
    data = await request.json()
    
    plan = data.get("plan", "semilla")
    business_name = data.get("business_name", "")
    business_type = data.get("business_type", "")
    notes = data.get("notes", "")
    contact_name = data.get("contact_name", "")
    contact_email = data.get("contact_email", "")
    contact_phone = data.get("contact_phone", "")
    
    plan_prices = {"semilla": 199, "crecimiento": 399, "empresarial": 699}
    plan_names = {
        "semilla": "Plan Semilla ($199/mes)",
        "crecimiento": "Plan Crecimiento ($399/mes)",
        "empresarial": "Plan Empresarial ($699/mes)"
    }
    
    service_request = {
        "id": str(uuid.uuid4()),
        "type": "bookkeeping_request",
        "client_id": user.get("id", ""),
        "client_name": contact_name or user.get("full_name", user.get("name", "")),
        "client_email": contact_email or user.get("email", ""),
        "client_phone": contact_phone or user.get("phone", ""),
        "plan": plan,
        "plan_name": plan_names.get(plan, plan),
        "monthly_fee": plan_prices.get(plan, 0),
        "business_name": business_name,
        "business_type": business_type,
        "notes": notes,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    
    await _db.service_requests.insert_one(service_request)
    
    # Send notification to admin
    try:
        if _notification_service:
            admin_users = await _db.users.find({"role": "admin"}).to_list(10)
            for admin in admin_users:
                if admin.get("email"):
                    await _notification_service.send_email(
                        to_email=admin["email"],
                        subject=f"Nueva Solicitud de Bookkeeping - {service_request['client_name']}",
                        html_content=f"""
                        <h2>Nueva Solicitud de Servicio de Bookkeeping</h2>
                        <p><b>Cliente:</b> {service_request['client_name']}</p>
                        <p><b>Email:</b> {service_request['client_email']}</p>
                        <p><b>Teléfono:</b> {service_request['client_phone']}</p>
                        <p><b>Plan Solicitado:</b> {service_request['plan_name']}</p>
                        <p><b>Nombre del Negocio:</b> {business_name or 'No especificado'}</p>
                        <p><b>Tipo de Negocio:</b> {business_type or 'No especificado'}</p>
                        <p><b>Notas:</b> {notes or 'Ninguna'}</p>
                        <p>Accede al panel de bookkeeping para vincular este cliente.</p>
                        """
                    )
    except Exception as e:
        logger.error(f"Error sending bookkeeping request notification: {e}")
    
    return {
        "success": True,
        "message": "Solicitud enviada exitosamente",
        "request_id": service_request["id"]
    }


# ================== FEATURE FLAGS ==================

@client_bk_router.get("/my-business/feature-flags")
async def get_feature_flags():
    """Get feature flags for the mobile app"""
    settings = await _db.app_settings.find_one({"key": "feature_flags"}) or {}
    flags = settings.get("value", {})
    return {
        "success": True,
        "flags": {
            "show_merchant_one": flags.get("show_merchant_one", False),
            "show_bank_connect": flags.get("show_bank_connect", False),
        }
    }


@client_bk_router.get("/my-business/subscription")
async def get_my_subscription(authorization: Optional[str] = Header(None)):
    """Get current user's business subscription info (only business plans grant access)"""
    user = await _get_current_user(authorization)
    
    # Business plan identifiers - only these grant access to Mi Negocio
    BUSINESS_PLAN_IDS = ['seed', 'growth', 'enterprise', 'semilla', 'crecimiento', 'empresarial']
    BUSINESS_APPLE_PREFIXES = ['com.rosstax.plan.business', 'com.rosstax.plan.seed', 'com.rosstax.plan.growth', 'com.rosstax.plan.enterprise']
    
    # Check active subscription - must be a BUSINESS plan
    subs = _db.user_subscriptions.find({
        "user_id": user['id'],
        "status": {"$in": ["active", "trialing"]}
    })
    
    sub = None
    async for s in subs:
        plan_id = s.get('plan_id', '')
        plan_name = (s.get('plan_name', '') or '').lower()
        apple_id = (s.get('apple_product_id', '') or '').lower()
        
        # Check if this is a business plan
        is_business = (
            plan_id in BUSINESS_PLAN_IDS or
            plan_name in [p.lower() for p in BUSINESS_PLAN_IDS] or
            any(apple_id.startswith(prefix) for prefix in BUSINESS_APPLE_PREFIXES) or
            'business' in apple_id or 'negocio' in apple_id or
            'seed' in plan_id or 'growth' in plan_id or 'enterprise' in plan_id
        )
        if is_business:
            sub = s
            break
    
    if not sub:
        # Check bookkeeping business subscription
        biz = await _get_client_business(user['id'])
        if biz:
            # Only grant access if the business has an active subscription status
            biz_sub_status = biz.get('subscription_status', '').lower()
            if biz_sub_status in ['active', 'trialing', 'trial']:
                return {
                    "success": True,
                    "has_subscription": True,
                    "subscription": {
                        "plan": biz.get('service_plan', biz.get('subscription_plan', 'semilla')),
                        "plan_name": biz.get('plan_name', 'Plan Semilla'),
                        "status": biz_sub_status,
                        "payment_method": biz.get('payment_method', 'office'),
                        "amount": biz.get('monthly_fee', 0),
                        "interval": "monthly",
                    }
                }
        return {"success": True, "has_subscription": False, "subscription": None}
    
    sub_data = {
        "id": str(sub['_id']),
        "plan": sub.get('plan_id', sub.get('plan', '')),
        "plan_name": sub.get('plan_name', ''),
        "status": sub.get('status', 'active'),
        "amount": sub.get('amount', 0),
        "interval": sub.get('interval', 'monthly'),
        "payment_method": sub.get('payment_method', 'apple_iap'),
        "auto_renew": sub.get('auto_renew', True),
        "activated_at": "",
        "expires_at": "",
    }
    
    # If amount is 0, look up from subscription_plans
    if sub_data['amount'] == 0 and sub.get('plan_id'):
        try:
            from bson import ObjectId
            plan_doc = await _db.subscription_plans.find_one({'_id': ObjectId(sub['plan_id'])})
            if plan_doc:
                sub_data['amount'] = plan_doc.get('price', 0)
                if not sub_data['plan_name']:
                    sub_data['plan_name'] = plan_doc.get('name', '')
        except Exception:
            pass
    for k in ['activated_at', 'expires_at']:
        val = sub.get(k, sub.get('created_at'))
        if val and hasattr(val, 'isoformat'):
            sub_data[k] = val.isoformat()
        elif val:
            sub_data[k] = str(val)
    
    return {"success": True, "has_subscription": True, "subscription": sub_data}



# ================== CLIENT SUBSCRIPTION (Merchant One) ==================

@client_bk_router.post("/my-business/subscribe")
async def client_subscribe_merchant_one(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Client-facing subscription endpoint using Merchant One ACH.
    Creates vault customer + recurring subscription.
    """
    user = await _get_current_user(authorization)
    body = await request.json()
    
    plan_id = body.get('plan_id', 'semilla')
    
    # Plan definitions
    plans = {
        'semilla': {'name': 'Plan Semilla', 'amount': 199.00, 'frequency': 30},
        'crecimiento': {'name': 'Plan Crecimiento', 'amount': 399.00, 'frequency': 30},
        'empresarial': {'name': 'Plan Empresarial', 'amount': 699.00, 'frequency': 30},
    }
    
    if plan_id not in plans:
        raise HTTPException(status_code=400, detail="Plan inválido")
    
    plan = plans[plan_id]
    
    # Check if already has active subscription
    existing = await _db.user_subscriptions.find_one({
        "user_id": user['id'],
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes una suscripción activa. Cancela la actual primero.")
    
    # Get Merchant One service
    try:
        from merchant_one_service import MerchantOneService
        merchant_service = MerchantOneService(_db)
    except Exception as e:
        logger.error(f"Merchant One service init error: {e}")
        raise HTTPException(status_code=500, detail="Servicio de pago no disponible")
    
    # Build customer info from user profile
    profile = await _db.client_profiles.find_one({"user_id": user['id']}) or {}
    address = profile.get('address', {})
    
    from merchant_one_models import CustomerInfo, BankInfo, SubscriptionInfo
    from datetime import datetime, timedelta
    
    try:
        customer = CustomerInfo(
            firstName=profile.get('first_name', user.get('name', '').split(' ')[0] or 'N/A'),
            lastName=profile.get('last_name', user.get('name', '').split(' ')[-1] if len(user.get('name', '').split(' ')) > 1 else 'N/A'),
            email=user.get('email', ''),
            phone=user.get('phone', body.get('phone', '')),
            address1=address.get('street', body.get('address1', '123 Main St')),
            city=address.get('city', body.get('city', 'Miami')),
            state=address.get('state', body.get('state', 'FL')),
            postalCode=address.get('zip_code', body.get('zip', '33101')),
        )
        
        bank = BankInfo(
            checkName=body.get('check_name', f"{customer.firstName} {customer.lastName}"),
            routing=body.get('routing_number', ''),
            accountNumber=body.get('account_number', ''),
            accountHolderType=body.get('account_holder_type', 'personal'),
            accountType=body.get('account_type', 'checking'),
            secCode='WEB',  # Web-initiated
        )
        
        start_date = (datetime.utcnow() + timedelta(days=7)).strftime('%Y%m%d')
        subscription = SubscriptionInfo(
            planName=plan['name'],
            amount=plan['amount'],
            dayFrequency=plan['frequency'],
            startDate=start_date,
            planPayments=0,
            orderDescription=f"Ross Tax - {plan['name']}",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Datos inválidos: {str(e)}")
    
    # Create vault + subscription
    try:
        response = await merchant_service.create_vault_and_subscription(
            customer, bank, subscription
        )
        
        if response.success:
            # Save to user_subscriptions
            now = datetime.utcnow()
            sub_record = {
                "user_id": user['id'],
                "plan_id": plan_id,
                "plan_name": plan['name'],
                "amount": plan['amount'],
                "interval": "monthly",
                "status": "active",
                "payment_method": "merchant_one",
                "merchant_one_vault_id": response.vault_id,
                "merchant_one_subscription_id": response.subscription_id,
                "activated_at": now,
                "expires_at": now + timedelta(days=30),
                "auto_renew": True,
                "created_at": now,
            }
            await _db.user_subscriptions.insert_one(sub_record)
            
            return {
                "success": True,
                "message": f"¡Suscripción a {plan['name']} activada!",
                "subscription": {
                    "plan": plan_id,
                    "plan_name": plan['name'],
                    "amount": plan['amount'],
                    "status": "active",
                    "payment_method": "merchant_one",
                }
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Error de pago: {response.errorMessage or response.responseText or 'Error desconocido'}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription creation error: {e}")
        raise HTTPException(status_code=500, detail="Error procesando el pago")
