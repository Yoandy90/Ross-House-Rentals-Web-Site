"""
Bookkeeping Module — Backend Router
Manages business clients, income/expense transactions, and financial reporting.
Categories aligned with IRS Schedule C for seamless tax preparation.
"""
import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

bookkeeping_router = APIRouter(tags=["Bookkeeping"])

_db: AsyncIOMotorDatabase = None


def set_bookkeeping_db(db: AsyncIOMotorDatabase):
    global _db
    _db = db
    logger.info("✅ Bookkeeping module initialized")


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
# IRS SCHEDULE C CATEGORIES
# ═══════════════════════════════════════════════════════════════════════

EXPENSE_CATEGORIES = [
    {"key": "advertising", "label_en": "Advertising", "label_es": "Publicidad", "line": "8"},
    {"key": "car_truck", "label_en": "Car and truck expenses", "label_es": "Gastos de vehículo", "line": "9"},
    {"key": "commissions", "label_en": "Commissions and fees", "label_es": "Comisiones y tarifas", "line": "10"},
    {"key": "contract_labor", "label_en": "Contract labor", "label_es": "Trabajo por contrato", "line": "11"},
    {"key": "depreciation", "label_en": "Depreciation", "label_es": "Depreciación", "line": "13"},
    {"key": "employee_benefits", "label_en": "Employee benefit programs", "label_es": "Beneficios de empleados", "line": "14"},
    {"key": "insurance", "label_en": "Insurance (other than health)", "label_es": "Seguros (excepto salud)", "line": "15"},
    {"key": "interest_mortgage", "label_en": "Interest (mortgage)", "label_es": "Intereses (hipoteca)", "line": "16a"},
    {"key": "interest_other", "label_en": "Interest (other)", "label_es": "Intereses (otros)", "line": "16b"},
    {"key": "legal_professional", "label_en": "Legal and professional services", "label_es": "Servicios legales y profesionales", "line": "17"},
    {"key": "office_expense", "label_en": "Office expense", "label_es": "Gastos de oficina", "line": "18"},
    {"key": "pension", "label_en": "Pension and profit-sharing plans", "label_es": "Planes de pensión", "line": "19"},
    {"key": "rent_vehicles", "label_en": "Rent or lease (vehicles/equipment)", "label_es": "Renta (vehículos/equipo)", "line": "20a"},
    {"key": "rent_property", "label_en": "Rent or lease (business property)", "label_es": "Renta (propiedad comercial)", "line": "20b"},
    {"key": "repairs", "label_en": "Repairs and maintenance", "label_es": "Reparaciones y mantenimiento", "line": "21"},
    {"key": "supplies", "label_en": "Supplies", "label_es": "Suministros", "line": "22"},
    {"key": "taxes_licenses", "label_en": "Taxes and licenses", "label_es": "Impuestos y licencias", "line": "23"},
    {"key": "travel", "label_en": "Travel", "label_es": "Viajes", "line": "24a"},
    {"key": "meals", "label_en": "Meals (50% deductible)", "label_es": "Comidas (50% deducible)", "line": "24b"},
    {"key": "utilities", "label_en": "Utilities", "label_es": "Servicios públicos", "line": "25"},
    {"key": "wages", "label_en": "Wages", "label_es": "Salarios", "line": "26"},
    {"key": "cogs", "label_en": "Cost of goods sold", "label_es": "Costo de mercancía", "line": "4"},
    {"key": "other", "label_en": "Other expenses", "label_es": "Otros gastos", "line": "27"},
]

INCOME_CATEGORIES = [
    {"key": "sales", "label_en": "Sales / Revenue", "label_es": "Ventas / Ingresos"},
    {"key": "services", "label_en": "Service income", "label_es": "Ingresos por servicios"},
    {"key": "rental", "label_en": "Rental income", "label_es": "Ingresos por renta"},
    {"key": "interest", "label_en": "Interest income", "label_es": "Ingresos por intereses"},
    {"key": "refunds", "label_en": "Returns and refunds", "label_es": "Devoluciones y reembolsos"},
    {"key": "other", "label_en": "Other income", "label_es": "Otros ingresos"},
]

BUSINESS_TYPES = [
    {"key": "sole_proprietorship", "label_en": "Sole Proprietorship", "label_es": "Propietario Único"},
    {"key": "llc_single", "label_en": "LLC (Single Member)", "label_es": "LLC (Un Miembro)"},
    {"key": "llc_multi", "label_en": "LLC (Multi Member)", "label_es": "LLC (Varios Miembros)"},
    {"key": "s_corp", "label_en": "S Corporation", "label_es": "Corporación S"},
    {"key": "c_corp", "label_en": "C Corporation", "label_es": "Corporación C"},
    {"key": "partnership", "label_en": "Partnership", "label_es": "Sociedad"},
    {"key": "nonprofit", "label_en": "Non-profit", "label_es": "Sin Fines de Lucro"},
]


# ═══════════════════════════════════════════════════════════════════════
# GET: Categories Reference
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/categories")
async def get_categories(request: Request):
    await _auth_admin(request)
    return {
        "expense_categories": EXPENSE_CATEGORIES,
        "income_categories": INCOME_CATEGORIES,
        "business_types": BUSINESS_TYPES,
    }


# ═══════════════════════════════════════════════════════════════════════
# BUSINESSES CRUD
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/businesses")
async def list_businesses(request: Request, search: str = "", status: str = ""):
    await _auth_admin(request)
    query = {}
    if search:
        query["$or"] = [
            {"business_name": {"$regex": search, "$options": "i"}},
            {"owner_name": {"$regex": search, "$options": "i"}},
            {"ein": {"$regex": search, "$options": "i"}},
        ]
    if status:
        query["status"] = status

    businesses = await _db.bk_businesses.find(query).sort("created_at", -1).to_list(500)
    for b in businesses:
        b["_id"] = str(b["_id"])
        # Get quick totals for current year
        year = datetime.utcnow().year
        year_start = datetime(year, 1, 1)
        income = await _db.bk_transactions.aggregate([
            {"$match": {"business_id": b["id"], "type": "income", "date": {"$gte": year_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        expenses = await _db.bk_transactions.aggregate([
            {"$match": {"business_id": b["id"], "type": "expense", "date": {"$gte": year_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        b["ytd_income"] = income[0]["total"] if income else 0
        b["ytd_expenses"] = expenses[0]["total"] if expenses else 0
        b["ytd_profit"] = b["ytd_income"] - b["ytd_expenses"]

    return {"businesses": businesses, "total": len(businesses)}


@bookkeeping_router.get("/admin/bookkeeping/businesses/{business_id}")
async def get_business(business_id: str, request: Request):
    await _auth_admin(request)
    biz = await _db.bk_businesses.find_one({"id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    biz["_id"] = str(biz["_id"])
    return {"business": biz}


@bookkeeping_router.post("/admin/bookkeeping/businesses")
async def create_business(request: Request):
    await _auth_admin(request)
    data = await request.json()

    required = ["business_name", "owner_name"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")

    biz = {
        "id": str(uuid.uuid4()),
        "business_name": data["business_name"],
        "owner_name": data["owner_name"],
        "owner_email": data.get("owner_email", ""),
        "owner_phone": data.get("owner_phone", ""),
        "ein": data.get("ein", ""),
        "ssn_last4": data.get("ssn_last4", ""),
        "business_type": data.get("business_type", "sole_proprietorship"),
        "industry": data.get("industry", ""),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", "TX"),
        "zip_code": data.get("zip_code", ""),
        "fiscal_year_end": data.get("fiscal_year_end", "december"),
        "service_plan": data.get("service_plan", "monthly"),
        "monthly_fee": float(data.get("monthly_fee", 0)),
        "status": "active",
        "notes": data.get("notes", ""),
        "linked_client_id": data.get("linked_client_id", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await _db.bk_businesses.insert_one(biz)
    biz["_id"] = str(biz["_id"])
    logger.info(f"📊 New bookkeeping business created: {biz['business_name']}")
    return {"success": True, "business": biz}


@bookkeeping_router.put("/admin/bookkeeping/businesses/{business_id}")
async def update_business(business_id: str, request: Request):
    await _auth_admin(request)
    data = await request.json()
    data.pop("_id", None)
    data.pop("id", None)
    data["updated_at"] = datetime.utcnow()
    result = await _db.bk_businesses.update_one({"id": business_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"success": True}


@bookkeeping_router.delete("/admin/bookkeeping/businesses/{business_id}")
async def delete_business(business_id: str, request: Request):
    await _auth_admin(request)
    await _db.bk_businesses.delete_one({"id": business_id})
    await _db.bk_transactions.delete_many({"business_id": business_id})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════
# TRANSACTIONS CRUD
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/transactions")
async def list_transactions(
    request: Request,
    business_id: str = "",
    type: str = "",
    category: str = "",
    date_from: str = "",
    date_to: str = "",
    search: str = "",
    source: str = "",
    limit: int = 50,
    offset: int = 0,
):
    await _auth_admin(request)
    query = {}
    if business_id:
        query["business_id"] = business_id
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if source:
        query["source"] = source
    if date_from:
        query.setdefault("date", {})["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        query.setdefault("date", {})["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
    if search:
        query["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"vendor": {"$regex": search, "$options": "i"}},
            {"reference": {"$regex": search, "$options": "i"}},
        ]

    total = await _db.bk_transactions.count_documents(query)
    txns = await _db.bk_transactions.find(query).sort("date", -1).skip(offset).limit(limit).to_list(limit)
    for t in txns:
        t["_id"] = str(t["_id"])

    # Totals
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    agg = await _db.bk_transactions.aggregate(pipeline).to_list(10)
    totals = {r["_id"]: {"total": r["total"], "count": r["count"]} for r in agg}

    return {
        "transactions": txns,
        "total": total,
        "has_more": offset + limit < total,
        "totals": totals,
    }


@bookkeeping_router.post("/admin/bookkeeping/transactions")
async def create_transaction(request: Request):
    await _auth_admin(request)
    data = await request.json()

    required = ["business_id", "type", "category", "amount", "date"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")

    if data["type"] not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="Type must be 'income' or 'expense'")

    txn = {
        "id": str(uuid.uuid4()),
        "business_id": data["business_id"],
        "type": data["type"],
        "category": data["category"],
        "amount": round(float(data["amount"]), 2),
        "date": datetime.fromisoformat(data["date"]) if isinstance(data["date"], str) else data["date"],
        "description": data.get("description", ""),
        "vendor": data.get("vendor", ""),
        "reference": data.get("reference", ""),
        "payment_method": data.get("payment_method", ""),
        "is_recurring": data.get("is_recurring", False),
        "recurring_frequency": data.get("recurring_frequency", ""),
        "receipt_url": data.get("receipt_url", ""),
        "notes": data.get("notes", ""),
        "tax_deductible": data.get("tax_deductible", True if data["type"] == "expense" else False),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await _db.bk_transactions.insert_one(txn)
    txn["_id"] = str(txn["_id"])
    return {"success": True, "transaction": txn}


@bookkeeping_router.post("/admin/bookkeeping/transactions/batch")
async def create_batch_transactions(request: Request):
    """Create multiple transactions at once"""
    await _auth_admin(request)
    data = await request.json()
    transactions = data.get("transactions", [])
    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")

    created = []
    for item in transactions:
        txn = {
            "id": str(uuid.uuid4()),
            "business_id": item["business_id"],
            "type": item["type"],
            "category": item["category"],
            "amount": round(float(item["amount"]), 2),
            "date": datetime.fromisoformat(item["date"]) if isinstance(item["date"], str) else item["date"],
            "description": item.get("description", ""),
            "vendor": item.get("vendor", ""),
            "reference": item.get("reference", ""),
            "payment_method": item.get("payment_method", ""),
            "tax_deductible": item.get("tax_deductible", True if item["type"] == "expense" else False),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await _db.bk_transactions.insert_one(txn)
        txn["_id"] = str(txn["_id"])
        created.append(txn)

    return {"success": True, "created": len(created), "transactions": created}


@bookkeeping_router.put("/admin/bookkeeping/transactions/{txn_id}")
async def update_transaction(txn_id: str, request: Request):
    await _auth_admin(request)
    data = await request.json()
    data.pop("_id", None)
    data.pop("id", None)
    if "date" in data and isinstance(data["date"], str):
        data["date"] = datetime.fromisoformat(data["date"])
    if "amount" in data:
        data["amount"] = round(float(data["amount"]), 2)
    data["updated_at"] = datetime.utcnow()
    result = await _db.bk_transactions.update_one({"id": txn_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True}


@bookkeeping_router.delete("/admin/bookkeeping/transactions/{txn_id}")
async def delete_transaction(txn_id: str, request: Request):
    await _auth_admin(request)
    result = await _db.bk_transactions.delete_one({"id": txn_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════
# DASHBOARD & REPORTS
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/dashboard")
async def get_dashboard(request: Request, business_id: str = "", year: int = 0):
    await _auth_admin(request)
    if year == 0:
        year = datetime.utcnow().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    base_query = {"date": {"$gte": year_start, "$lte": year_end}}
    if business_id:
        base_query["business_id"] = business_id

    # Monthly breakdown
    monthly_pipeline = [
        {"$match": base_query},
        {"$group": {
            "_id": {
                "month": {"$month": "$date"},
                "type": "$type"
            },
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.month": 1}}
    ]
    monthly_data = await _db.bk_transactions.aggregate(monthly_pipeline).to_list(100)

    month_names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    monthly_chart = []
    for m in range(1, 13):
        income = next((d["total"] for d in monthly_data if d["_id"]["month"] == m and d["_id"]["type"] == "income"), 0)
        expense = next((d["total"] for d in monthly_data if d["_id"]["month"] == m and d["_id"]["type"] == "expense"), 0)
        monthly_chart.append({
            "month": m,
            "month_name": month_names[m - 1],
            "income": round(income, 2),
            "expenses": round(expense, 2),
            "profit": round(income - expense, 2),
        })

    # Category breakdown (expenses)
    cat_pipeline = [
        {"$match": {**base_query, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    expense_by_category = await _db.bk_transactions.aggregate(cat_pipeline).to_list(50)

    # Income category breakdown
    income_cat_pipeline = [
        {"$match": {**base_query, "type": "income"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    income_by_category = await _db.bk_transactions.aggregate(income_cat_pipeline).to_list(50)

    # Totals
    total_income = sum(m["income"] for m in monthly_chart)
    total_expenses = sum(m["expenses"] for m in monthly_chart)
    total_profit = total_income - total_expenses

    # Recent transactions
    recent_query = dict(base_query)
    if business_id:
        recent_query["business_id"] = business_id
    recent = await _db.bk_transactions.find(recent_query).sort("date", -1).limit(10).to_list(10)
    for r in recent:
        r["_id"] = str(r["_id"])

    # Business count
    biz_count = await _db.bk_businesses.count_documents({"status": "active"})

    return {
        "year": year,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "total_profit": round(total_profit, 2),
        "profit_margin": round((total_profit / total_income * 100) if total_income > 0 else 0, 1),
        "monthly_chart": monthly_chart,
        "expense_by_category": [{"category": d["_id"], "total": round(d["total"], 2), "count": d["count"]} for d in expense_by_category],
        "income_by_category": [{"category": d["_id"], "total": round(d["total"], 2), "count": d["count"]} for d in income_by_category],
        "recent_transactions": recent,
        "active_businesses": biz_count,
    }


@bookkeeping_router.get("/admin/bookkeeping/profit-loss")
async def get_profit_loss(
    request: Request,
    business_id: str = "",
    date_from: str = "",
    date_to: str = "",
):
    """Generate Profit & Loss report"""
    await _auth_admin(request)

    now = datetime.utcnow()
    if not date_from:
        date_from = datetime(now.year, 1, 1).isoformat()
    if not date_to:
        date_to = now.isoformat()

    query = {
        "date": {
            "$gte": datetime.fromisoformat(date_from),
            "$lte": datetime.fromisoformat(date_to + "T23:59:59") if "T" not in date_to else datetime.fromisoformat(date_to)
        }
    }
    if business_id:
        query["business_id"] = business_id

    # Income breakdown
    income_pipeline = [
        {"$match": {**query, "type": "income"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    income_items = await _db.bk_transactions.aggregate(income_pipeline).to_list(50)

    # Expense breakdown
    expense_pipeline = [
        {"$match": {**query, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    expense_items = await _db.bk_transactions.aggregate(expense_pipeline).to_list(50)

    total_income = sum(i["total"] for i in income_items)
    total_expenses = sum(e["total"] for e in expense_items)
    net_profit = total_income - total_expenses

    # Get business name if specific
    biz_name = "Todos los Negocios"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz["business_name"]

    return {
        "business_name": biz_name,
        "period": {"from": date_from, "to": date_to},
        "income": {
            "items": [{"category": i["_id"], "total": round(i["total"], 2), "count": i["count"]} for i in income_items],
            "total": round(total_income, 2),
        },
        "expenses": {
            "items": [{"category": e["_id"], "total": round(e["total"], 2), "count": e["count"]} for e in expense_items],
            "total": round(total_expenses, 2),
        },
        "net_profit": round(net_profit, 2),
        "profit_margin": round((net_profit / total_income * 100) if total_income > 0 else 0, 1),
    }



# ═══════════════════════════════════════════════════════════════════════
# SCHEDULE C REPORT
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/schedule-c")
async def get_schedule_c(
    request: Request,
    business_id: str = "",
    year: int = 0,
):
    """Generate IRS Schedule C formatted report"""
    await _auth_admin(request)
    if year == 0:
        year = datetime.utcnow().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    query = {"date": {"$gte": year_start, "$lte": year_end}}
    if business_id:
        query["business_id"] = business_id

    # Gross Income (Line 1-7)
    income_pipeline = [
        {"$match": {**query, "type": "income"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    income_items = await _db.bk_transactions.aggregate(income_pipeline).to_list(50)
    income_map = {i["_id"]: round(i["total"], 2) for i in income_items}

    gross_receipts = sum(income_map.get(k, 0) for k in ["sales", "services", "other"])
    other_income = sum(income_map.get(k, 0) for k in ["rental", "interest", "refunds"])

    # COGS (Line 4)
    cogs = 0
    expense_pipeline = [
        {"$match": {**query, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    expense_items = await _db.bk_transactions.aggregate(expense_pipeline).to_list(50)
    expense_map = {e["_id"]: round(e["total"], 2) for e in expense_items}

    cogs = expense_map.pop("cogs", 0)
    gross_profit = gross_receipts - cogs

    # Expenses by Schedule C line
    schedule_c_lines = {}
    total_expenses = 0
    for cat_info in EXPENSE_CATEGORIES:
        key = cat_info["key"]
        if key == "cogs":
            continue
        amount = expense_map.get(key, 0)
        if amount > 0:
            schedule_c_lines[cat_info["line"]] = {
                "line": cat_info["line"],
                "label_en": cat_info["label_en"],
                "label_es": cat_info["label_es"],
                "key": key,
                "amount": amount,
            }
            total_expenses += amount

    # Meals are 50% deductible
    if "24b" in schedule_c_lines:
        full_meals = schedule_c_lines["24b"]["amount"]
        schedule_c_lines["24b"]["full_amount"] = full_meals
        schedule_c_lines["24b"]["amount"] = round(full_meals * 0.5, 2)
        total_expenses = total_expenses - full_meals + schedule_c_lines["24b"]["amount"]

    net_profit = gross_profit + other_income - total_expenses

    # Business info
    biz_info = {}
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_info = {
                "name": biz.get("business_name", ""),
                "owner": biz.get("owner_name", ""),
                "ein": biz.get("ein", ""),
                "business_type": biz.get("business_type", ""),
                "address": f"{biz.get('address', '')}, {biz.get('city', '')}, {biz.get('state', '')} {biz.get('zip_code', '')}",
                "industry": biz.get("industry", ""),
            }

    return {
        "year": year,
        "business": biz_info,
        "part_i": {
            "line_1": round(gross_receipts, 2),
            "line_2": 0,  # Returns/allowances
            "line_3": round(gross_receipts, 2),
            "line_4": round(cogs, 2),
            "line_5": round(gross_profit, 2),
            "line_6": round(other_income, 2),
            "line_7": round(gross_profit + other_income, 2),
        },
        "part_ii": {
            "lines": schedule_c_lines,
            "line_28": round(total_expenses, 2),
        },
        "line_29": round(net_profit, 2),  # Tentative profit
        "line_31": round(net_profit, 2),  # Net profit/loss
        "income_breakdown": [{"category": k, "amount": v} for k, v in income_map.items()],
        "expense_breakdown": [{"category": k, "amount": v} for k, v in expense_map.items()],
    }


# ═══════════════════════════════════════════════════════════════════════
# BALANCE SHEET
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/balance-sheet")
async def get_balance_sheet(
    request: Request,
    business_id: str = "",
    as_of: str = "",
):
    """Generate Balance Sheet report.
    Since this is a small-business bookkeeping tool (primarily Schedule C / sole proprietorship),
    we compute a simplified balance sheet:
    - Assets = cash/bank balances (from Plaid if available) + accounts receivable
    - Liabilities = accounts payable + loans
    - Owner's Equity = cumulative net income + owner contributions - owner draws
    """
    await _auth_admin(request)
    if not as_of:
        as_of = datetime.utcnow().isoformat()

    as_of_dt = datetime.fromisoformat(as_of.split("T")[0] + "T23:59:59")

    query = {"date": {"$lte": as_of_dt}}
    if business_id:
        query["business_id"] = business_id

    # Calculate cumulative income & expenses
    income_agg = await _db.bk_transactions.aggregate([
        {"$match": {**query, "type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    expense_agg = await _db.bk_transactions.aggregate([
        {"$match": {**query, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    total_income = income_agg[0]["total"] if income_agg else 0
    total_expenses = expense_agg[0]["total"] if expense_agg else 0
    retained_earnings = total_income - total_expenses

    # Monthly trends for the current year
    year = as_of_dt.year
    year_start = datetime(year, 1, 1)
    monthly_pipeline = [
        {"$match": {**query, "date": {"$gte": year_start, "$lte": as_of_dt}}},
        {"$group": {
            "_id": {"month": {"$month": "$date"}, "type": "$type"},
            "total": {"$sum": "$amount"},
        }},
        {"$sort": {"_id.month": 1}},
    ]
    monthly_data = await _db.bk_transactions.aggregate(monthly_pipeline).to_list(100)

    # Get linked bank balances from Plaid
    cash_balance = 0
    linked_accounts = []
    if business_id:
        plaid_items = await _db.bk_plaid_items.find({"business_id": business_id, "status": "active"}).to_list(20)
        for item in plaid_items:
            for acc in item.get("accounts", []):
                bal = acc.get("current_balance", 0) or 0
                cash_balance += bal
                linked_accounts.append({
                    "institution": item.get("institution_name", ""),
                    "name": acc.get("name", ""),
                    "mask": acc.get("mask", ""),
                    "type": acc.get("type", ""),
                    "balance": round(bal, 2),
                })

    # Build simplified balance sheet
    assets = {
        "cash_and_bank": round(cash_balance, 2),
        "linked_accounts": linked_accounts,
        "accounts_receivable": 0,  # Could be computed from unpaid invoices
        "inventory": 0,
        "other_current_assets": 0,
        "fixed_assets": 0,
        "total_assets": round(cash_balance, 2),
    }

    liabilities = {
        "accounts_payable": 0,
        "credit_cards": 0,
        "loans": 0,
        "other_liabilities": 0,
        "total_liabilities": 0,
    }

    equity = {
        "owner_investment": 0,
        "retained_earnings": round(retained_earnings, 2),
        "owner_draws": 0,
        "net_income_ytd": round(total_income - total_expenses, 2),
        "total_equity": round(retained_earnings, 2),
    }

    # Business info
    biz_name = "Todos los Negocios"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz["business_name"]

    return {
        "business_name": biz_name,
        "as_of": as_of_dt.strftime("%Y-%m-%d"),
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_liabilities_equity": round(liabilities["total_liabilities"] + equity["total_equity"], 2),
        "is_balanced": abs(assets["total_assets"] - (liabilities["total_liabilities"] + equity["total_equity"])) < 0.01,
        "summary": {
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "net_income": round(retained_earnings, 2),
        }
    }


# ═══════════════════════════════════════════════════════════════════════
# QUARTERLY COMPARISON
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/quarterly")
async def get_quarterly_comparison(
    request: Request,
    business_id: str = "",
    year: int = 0,
):
    """Generate quarterly comparison report"""
    await _auth_admin(request)
    if year == 0:
        year = datetime.utcnow().year

    quarters = []
    for q in range(1, 5):
        q_start = datetime(year, (q - 1) * 3 + 1, 1)
        if q < 4:
            q_end = datetime(year, q * 3 + 1, 1) - timedelta(seconds=1)
        else:
            q_end = datetime(year, 12, 31, 23, 59, 59)

        query = {"date": {"$gte": q_start, "$lte": q_end}}
        if business_id:
            query["business_id"] = business_id

        income_agg = await _db.bk_transactions.aggregate([
            {"$match": {**query, "type": "income"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)

        expense_agg = await _db.bk_transactions.aggregate([
            {"$match": {**query, "type": "expense"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)

        income = income_agg[0]["total"] if income_agg else 0
        expenses = expense_agg[0]["total"] if expense_agg else 0

        quarters.append({
            "quarter": f"Q{q}",
            "period": f"{q_start.strftime('%b %d')} - {q_end.strftime('%b %d, %Y')}",
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "profit": round(income - expenses, 2),
            "margin": round((income - expenses) / income * 100, 1) if income > 0 else 0,
            "txn_count": (income_agg[0]["count"] if income_agg else 0) + (expense_agg[0]["count"] if expense_agg else 0),
        })

    totals = {
        "income": sum(q["income"] for q in quarters),
        "expenses": sum(q["expenses"] for q in quarters),
        "profit": sum(q["profit"] for q in quarters),
    }

    return {
        "year": year,
        "quarters": quarters,
        "totals": totals,
        "avg_quarterly_profit": round(totals["profit"] / 4, 2),
    }


# ═══════════════════════════════════════════════════════════════════════
# CSV EXPORT
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/export/transactions-csv")
async def export_transactions_csv(
    request: Request,
    business_id: str = "",
    date_from: str = "",
    date_to: str = "",
    type: str = "",
):
    """Export transactions as CSV"""
    await _auth_admin(request)

    query = {}
    if business_id:
        query["business_id"] = business_id
    if type:
        query["type"] = type
    if date_from:
        query.setdefault("date", {})["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        query.setdefault("date", {})["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")

    txns = await _db.bk_transactions.find(query).sort("date", -1).to_list(10000)

    # Build business name map
    biz_ids = list(set(t.get("business_id", "") for t in txns))
    businesses = await _db.bk_businesses.find({"id": {"$in": biz_ids}}).to_list(500)
    biz_map = {b["id"]: b["business_name"] for b in businesses}

    # Category label maps
    exp_map = {c["key"]: c["label_en"] for c in EXPENSE_CATEGORIES}
    inc_map = {c["key"]: c["label_en"] for c in INCOME_CATEGORIES}

    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Business", "Type", "Category", "Description", "Vendor", "Amount", "Reference", "Source", "Payment Method"])

    for t in txns:
        cat_label = exp_map.get(t.get("category", ""), "") if t.get("type") == "expense" else inc_map.get(t.get("category", ""), "")
        writer.writerow([
            t.get("date", "").strftime("%Y-%m-%d") if hasattr(t.get("date", ""), "strftime") else str(t.get("date", "")),
            biz_map.get(t.get("business_id", ""), ""),
            t.get("type", ""),
            cat_label or t.get("category", ""),
            t.get("description", ""),
            t.get("vendor", ""),
            t.get("amount", 0),
            t.get("reference", ""),
            t.get("source", "manual"),
            t.get("payment_method", ""),
        ])

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )


@bookkeeping_router.get("/admin/bookkeeping/export/pnl-csv")
async def export_pnl_csv(
    request: Request,
    business_id: str = "",
    date_from: str = "",
    date_to: str = "",
):
    """Export P&L report as CSV"""
    await _auth_admin(request)

    now = datetime.utcnow()
    if not date_from:
        date_from = datetime(now.year, 1, 1).isoformat()
    if not date_to:
        date_to = now.isoformat()

    query = {
        "date": {
            "$gte": datetime.fromisoformat(date_from),
            "$lte": datetime.fromisoformat(date_to + "T23:59:59") if "T" not in date_to else datetime.fromisoformat(date_to)
        }
    }
    if business_id:
        query["business_id"] = business_id

    income_pipeline = [
        {"$match": {**query, "type": "income"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]
    expense_pipeline = [
        {"$match": {**query, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]

    income_items = await _db.bk_transactions.aggregate(income_pipeline).to_list(50)
    expense_items = await _db.bk_transactions.aggregate(expense_pipeline).to_list(50)

    inc_map = {c["key"]: c["label_en"] for c in INCOME_CATEGORIES}
    exp_map = {c["key"]: c["label_en"] for c in EXPENSE_CATEGORIES}

    total_income = sum(i["total"] for i in income_items)
    total_expenses = sum(e["total"] for e in expense_items)

    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)

    biz_name = "All Businesses"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz["business_name"]

    writer.writerow([f"Profit & Loss Statement - {biz_name}"])
    writer.writerow([f"Period: {date_from} to {date_to}"])
    writer.writerow([])
    writer.writerow(["INCOME", "Amount"])
    for i in income_items:
        writer.writerow([inc_map.get(i["_id"], i["_id"]), f"${i['total']:,.2f}"])
    writer.writerow(["Total Income", f"${total_income:,.2f}"])
    writer.writerow([])
    writer.writerow(["EXPENSES (Schedule C)", "Amount"])
    for e in expense_items:
        writer.writerow([exp_map.get(e["_id"], e["_id"]), f"${e['total']:,.2f}"])
    writer.writerow(["Total Expenses", f"${total_expenses:,.2f}"])
    writer.writerow([])
    writer.writerow(["NET PROFIT / (LOSS)", f"${(total_income - total_expenses):,.2f}"])

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=PnL_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )


# ═══════════════════════════════════════════════════════════════════════
# CSV IMPORT (Bank Statements)
# ═══════════════════════════════════════════════════════════════════════

PLAID_CATEGORY_MAP = {
    # Common Plaid categories → IRS Schedule C
    "food and drink": "meals",
    "shops": "supplies",
    "travel": "travel",
    "transfer": "other",
    "payment": "other",
    "service": "contract_labor",
    "recreation": "other",
    "healthcare": "insurance",
    "tax": "taxes_licenses",
    "bank fees": "other",
    "interest": "interest_other",
    "rent": "rent_property",
    "utilities": "utilities",
    "transportation": "car_truck",
    "insurance": "insurance",
    "legal": "legal_professional",
    "wages": "wages",
    "office": "office_expense",
}


@bookkeeping_router.post("/admin/bookkeeping/import/csv")
async def import_csv_transactions(request: Request):
    """Import bank statement CSV into bookkeeping transactions.
    Expected CSV columns: Date, Description, Amount (or Debit/Credit), Category (optional)
    """
    await _auth_admin(request)
    data = await request.json()

    business_id = data.get("business_id", "")
    csv_text = data.get("csv_data", "")
    default_type = data.get("default_type", "expense")  # If amount doesn't indicate
    column_mapping = data.get("column_mapping", {})

    if not business_id:
        raise HTTPException(status_code=400, detail="business_id required")
    if not csv_text:
        raise HTTPException(status_code=400, detail="csv_data required")

    # Verify business exists
    biz = await _db.bk_businesses.find_one({"id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    import csv
    import io
    reader = csv.DictReader(io.StringIO(csv_text))

    # Detect column names
    date_col = column_mapping.get("date", None)
    desc_col = column_mapping.get("description", None)
    amount_col = column_mapping.get("amount", None)
    debit_col = column_mapping.get("debit", None)
    credit_col = column_mapping.get("credit", None)
    category_col = column_mapping.get("category", None)

    if reader.fieldnames:
        fields_lower = {f.lower().strip(): f for f in reader.fieldnames}
        if not date_col:
            for k in ["date", "fecha", "transaction date", "post date", "posting date"]:
                if k in fields_lower:
                    date_col = fields_lower[k]
                    break
        if not desc_col:
            for k in ["description", "descripcion", "memo", "details", "transaction"]:
                if k in fields_lower:
                    desc_col = fields_lower[k]
                    break
        if not amount_col:
            for k in ["amount", "monto", "total"]:
                if k in fields_lower:
                    amount_col = fields_lower[k]
                    break
        if not debit_col:
            for k in ["debit", "débito", "withdrawal", "retiro"]:
                if k in fields_lower:
                    debit_col = fields_lower[k]
                    break
        if not credit_col:
            for k in ["credit", "crédito", "deposit", "depósito"]:
                if k in fields_lower:
                    credit_col = fields_lower[k]
                    break
        if not category_col:
            for k in ["category", "categoría", "type", "tipo"]:
                if k in fields_lower:
                    category_col = fields_lower[k]
                    break

    created = 0
    skipped = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        try:
            # Parse date
            raw_date = row.get(date_col, "").strip() if date_col else ""
            if not raw_date:
                skipped += 1
                continue

            # Try various date formats
            parsed_date = None
            for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%m-%d-%Y", "%Y/%m/%d"]:
                try:
                    parsed_date = datetime.strptime(raw_date, fmt)
                    break
                except ValueError:
                    continue
            if not parsed_date:
                errors.append(f"Row {row_num}: Invalid date '{raw_date}'")
                continue

            # Parse amount
            if amount_col and row.get(amount_col):
                raw_amount = row[amount_col].strip().replace("$", "").replace(",", "").replace("(", "-").replace(")", "")
                amount = float(raw_amount) if raw_amount else 0
                txn_type = "income" if amount > 0 else "expense"
                amount = abs(amount)
            elif debit_col or credit_col:
                debit_val = row.get(debit_col, "").strip().replace("$", "").replace(",", "") if debit_col else ""
                credit_val = row.get(credit_col, "").strip().replace("$", "").replace(",", "") if credit_col else ""
                if debit_val:
                    amount = abs(float(debit_val))
                    txn_type = "expense"
                elif credit_val:
                    amount = abs(float(credit_val))
                    txn_type = "income"
                else:
                    skipped += 1
                    continue
            else:
                skipped += 1
                continue

            if amount == 0:
                skipped += 1
                continue

            # Description
            desc = row.get(desc_col, "").strip() if desc_col else ""

            # Auto-categorize
            category = "other"
            if category_col and row.get(category_col):
                raw_cat = row[category_col].strip().lower()
                # Try to match to Schedule C
                for plaid_key, sched_c_key in PLAID_CATEGORY_MAP.items():
                    if plaid_key in raw_cat:
                        category = sched_c_key
                        break
            else:
                # Simple keyword-based auto-categorization
                desc_lower = desc.lower()
                if any(w in desc_lower for w in ["rent", "renta", "lease"]):
                    category = "rent_property"
                elif any(w in desc_lower for w in ["insurance", "seguro"]):
                    category = "insurance"
                elif any(w in desc_lower for w in ["electric", "gas", "water", "internet", "phone", "luz", "agua"]):
                    category = "utilities"
                elif any(w in desc_lower for w in ["gas station", "fuel", "gasolina", "uber", "lyft"]):
                    category = "car_truck"
                elif any(w in desc_lower for w in ["restaurant", "food", "comida", "starbucks", "mcdonald"]):
                    category = "meals"
                elif any(w in desc_lower for w in ["office", "staples", "amazon", "oficina"]):
                    category = "office_expense"
                elif any(w in desc_lower for w in ["travel", "hotel", "airline", "flight", "viaje"]):
                    category = "travel"
                elif any(w in desc_lower for w in ["advertising", "facebook ads", "google ads", "publicidad"]):
                    category = "advertising"

                if txn_type == "income":
                    category = "sales"

            txn = {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "type": txn_type,
                "category": category,
                "amount": round(amount, 2),
                "date": parsed_date,
                "description": desc,
                "vendor": desc[:50] if desc else "",
                "reference": "",
                "payment_method": "",
                "source": "csv_import",
                "auto_categorized": True,
                "review_status": "pending",
                "notes": f"Imported from CSV row {row_num}",
                "tax_deductible": txn_type == "expense",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            await _db.bk_transactions.insert_one(txn)
            created += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    logger.info(f"📊 CSV Import: {created} created, {skipped} skipped, {len(errors)} errors for business {biz.get('business_name', business_id)}")

    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "errors": errors[:20],  # Limit error messages
        "total_rows": created + skipped + len(errors),
        "message": f"Importadas {created} transacciones exitosamente" + (f" ({len(errors)} errores)" if errors else ""),
    }



# ═══════════════════════════════════════════════════════════════════════
# QUARTERLY TAX ESTIMATES
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/tax-estimates")
async def get_tax_estimates(
    request: Request,
    business_id: str = "",
    year: int = 0,
):
    """Calculate quarterly estimated tax payments (IRS Form 1040-ES)"""
    await _auth_admin(request)
    if year == 0:
        year = datetime.utcnow().year

    # Federal quarterly deadlines
    deadlines = {
        "Q1": f"{year}-04-15",
        "Q2": f"{year}-06-15",
        "Q3": f"{year}-09-15",
        "Q4": f"{year + 1}-01-15",
    }

    # Get annual income/expense projections
    today = datetime.utcnow()
    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    query = {"date": {"$gte": year_start, "$lte": min(today, year_end)}}
    if business_id:
        query["business_id"] = business_id

    income_agg = await _db.bk_transactions.aggregate([
        {"$match": {**query, "type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    expense_agg = await _db.bk_transactions.aggregate([
        {"$match": {**query, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    ytd_income = income_agg[0]["total"] if income_agg else 0
    ytd_expenses = expense_agg[0]["total"] if expense_agg else 0
    ytd_profit = ytd_income - ytd_expenses

    # Project annual profit
    months_elapsed = max((today - year_start).days / 30.44, 1)
    projected_annual_profit = (ytd_profit / months_elapsed) * 12

    # Simplified SE tax calculation
    se_tax_rate = 0.153  # 15.3% Social Security + Medicare
    se_net = projected_annual_profit * 0.9235  # 92.35% subject to SE tax
    annual_se_tax = max(se_net * se_tax_rate, 0)

    # Federal income tax brackets 2026 (simplified)
    def calc_federal_tax(income: float) -> float:
        if income <= 0:
            return 0
        brackets = [
            (11600, 0.10), (47150, 0.12), (100525, 0.22),
            (191950, 0.24), (243725, 0.32), (609350, 0.35),
            (float('inf'), 0.37),
        ]
        tax = 0
        prev = 0
        taxable = income - 14600  # Standard deduction (single)
        if taxable <= 0:
            return 0
        for limit, rate in brackets:
            bracket_income = min(taxable, limit) - prev
            if bracket_income <= 0:
                break
            tax += bracket_income * rate
            prev = limit
        return tax

    annual_income_tax = calc_federal_tax(projected_annual_profit - (annual_se_tax / 2))
    total_annual_tax = annual_income_tax + annual_se_tax
    quarterly_payment = round(total_annual_tax / 4, 2)

    # Check which quarters have passed
    quarters = []
    for q_name, deadline in deadlines.items():
        deadline_dt = datetime.fromisoformat(deadline)
        is_past = today > deadline_dt
        quarters.append({
            "quarter": q_name,
            "deadline": deadline,
            "is_past": is_past,
            "amount_due": quarterly_payment,
            "status": "past_due" if is_past else "upcoming",
        })

    # Get business info
    biz_name = "Todos los negocios"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz.get("business_name", "")

    return {
        "year": year,
        "business_name": biz_name,
        "ytd_data": {
            "income": round(ytd_income, 2),
            "expenses": round(ytd_expenses, 2),
            "profit": round(ytd_profit, 2),
            "months_elapsed": round(months_elapsed, 1),
        },
        "projections": {
            "annual_profit": round(projected_annual_profit, 2),
            "se_tax": round(annual_se_tax, 2),
            "income_tax": round(annual_income_tax, 2),
            "total_tax": round(total_annual_tax, 2),
            "effective_rate": round((total_annual_tax / projected_annual_profit * 100) if projected_annual_profit > 0 else 0, 1),
        },
        "quarterly_payment": quarterly_payment,
        "quarters": quarters,
    }


# ═══════════════════════════════════════════════════════════════════════
# FORM 1099 GENERATION
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/1099-report")
async def get_1099_report(
    request: Request,
    business_id: str = "",
    year: int = 0,
    min_amount: float = 600,
):
    """Generate 1099-NEC report for contractors paid $600+ in a calendar year"""
    await _auth_admin(request)
    if year == 0:
        year = datetime.utcnow().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    query = {
        "type": "expense",
        "category": "contract_labor",
        "date": {"$gte": year_start, "$lte": year_end},
    }
    if business_id:
        query["business_id"] = business_id

    # Aggregate payments by vendor
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$vendor",
            "total_paid": {"$sum": "$amount"},
            "payment_count": {"$sum": 1},
            "first_payment": {"$min": "$date"},
            "last_payment": {"$max": "$date"},
            "descriptions": {"$push": "$description"},
        }},
        {"$sort": {"total_paid": -1}},
    ]

    vendors = await _db.bk_transactions.aggregate(pipeline).to_list(500)

    requiring_1099 = []
    below_threshold = []

    for v in vendors:
        vendor_name = v["_id"] or "Sin nombre"
        record = {
            "vendor_name": vendor_name,
            "total_paid": round(v["total_paid"], 2),
            "payment_count": v["payment_count"],
            "first_payment": v["first_payment"].strftime("%Y-%m-%d") if v["first_payment"] else "",
            "last_payment": v["last_payment"].strftime("%Y-%m-%d") if v["last_payment"] else "",
        }

        if v["total_paid"] >= min_amount:
            requiring_1099.append(record)
        else:
            below_threshold.append(record)

    # Business info
    biz_name = "Todos los negocios"
    payer_info = {}
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz.get("business_name", "")
            payer_info = {
                "name": biz.get("business_name", ""),
                "ein": biz.get("ein", ""),
                "address": f"{biz.get('address', '')}, {biz.get('city', '')}, {biz.get('state', '')} {biz.get('zip_code', '')}",
            }

    return {
        "year": year,
        "business_name": biz_name,
        "payer_info": payer_info,
        "threshold": min_amount,
        "requiring_1099": requiring_1099,
        "below_threshold": below_threshold,
        "total_requiring": len(requiring_1099),
        "total_amount_1099": round(sum(r["total_paid"] for r in requiring_1099), 2),
        "filing_deadline": f"{year + 1}-01-31",
        "message": f"{len(requiring_1099)} contratistas requieren Form 1099-NEC para {year}" if requiring_1099 else f"No hay contratistas que superen ${min_amount} en {year}",
    }


# ═══════════════════════════════════════════════════════════════════════
# AUTO-CATEGORIZATION RULES
# ═══════════════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/categorization-rules")
async def get_categorization_rules(request: Request, business_id: str = ""):
    """Get custom auto-categorization rules for a business"""
    await _auth_admin(request)
    query = {}
    if business_id:
        query["business_id"] = business_id

    rules = await _db.bk_categorization_rules.find(query).sort("keyword", 1).to_list(500)
    for r in rules:
        r["id"] = str(r.pop("_id", ""))

    return {"rules": rules}


@bookkeeping_router.post("/admin/bookkeeping/categorization-rules")
async def create_categorization_rule(request: Request):
    """Create a custom auto-categorization rule"""
    await _auth_admin(request)
    data = await request.json()

    keyword = data.get("keyword", "").strip().lower()
    category = data.get("category", "")
    txn_type = data.get("type", "expense")
    business_id = data.get("business_id", "")

    if not keyword or not category:
        raise HTTPException(status_code=400, detail="keyword and category required")

    rule = {
        "id": str(uuid.uuid4()),
        "business_id": business_id,
        "keyword": keyword,
        "category": category,
        "type": txn_type,
        "created_at": datetime.utcnow(),
    }
    await _db.bk_categorization_rules.insert_one(rule)
    rule.pop("_id", None)

    logger.info(f"📏 New categorization rule: '{keyword}' → {category}")
    return {"success": True, "rule": rule}


@bookkeeping_router.delete("/admin/bookkeeping/categorization-rules/{rule_id}")
async def delete_categorization_rule(request: Request, rule_id: str):
    """Delete a categorization rule"""
    await _auth_admin(request)
    result = await _db.bk_categorization_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True}


@bookkeeping_router.post("/admin/bookkeeping/recategorize")
async def recategorize_transactions(request: Request):
    """Re-apply categorization rules to existing transactions"""
    await _auth_admin(request)
    data = await request.json()
    business_id = data.get("business_id", "")

    if not business_id:
        raise HTTPException(status_code=400, detail="business_id required")

    # Get custom rules for this business
    rules = await _db.bk_categorization_rules.find({"business_id": business_id}).to_list(500)

    # Get uncategorized or auto-categorized transactions
    txns = await _db.bk_transactions.find({
        "business_id": business_id,
        "auto_categorized": True,
        "review_status": "pending",
    }).to_list(10000)

    updated = 0
    for txn in txns:
        desc_lower = (txn.get("description", "") + " " + txn.get("vendor", "")).lower()
        for rule in rules:
            if rule["keyword"] in desc_lower:
                await _db.bk_transactions.update_one(
                    {"id": txn["id"]},
                    {"$set": {
                        "category": rule["category"],
                        "type": rule.get("type", txn.get("type", "expense")),
                        "auto_categorized": True,
                        "updated_at": datetime.utcnow(),
                    }}
                )
                updated += 1
                break

    return {
        "success": True,
        "updated": updated,
        "total_checked": len(txns),
        "rules_applied": len(rules),
    }



# ═══════════════════════════════════════════════════════════════
# SERVICE REQUESTS MANAGEMENT (Admin)
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/service-requests")
async def list_service_requests(request: Request, status: str = "", limit: int = 50, offset: int = 0):
    """Admin: List all bookkeeping service requests"""
    await _auth_admin(request)
    query = {"type": "bookkeeping_request"}
    if status:
        query["status"] = status
    
    total = await _db.service_requests.count_documents(query)
    requests_list = await _db.service_requests.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    result = []
    for r in requests_list:
        r["id"] = r.pop("_id", r.get("id", ""))
        if isinstance(r.get("id"), ObjectId):
            r["id"] = str(r["id"])
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        if isinstance(r.get("approved_at"), datetime):
            r["approved_at"] = r["approved_at"].isoformat()
        result.append(r)
    
    return {"requests": result, "total": total}


@bookkeeping_router.patch("/admin/bookkeeping/service-requests/{request_id}")
async def update_service_request(request_id: str, request: Request):
    """Admin: Update a service request (approve/reject)"""
    await _auth_admin(request)
    data = await request.json()
    new_status = data.get("status", "")
    
    # Find the request
    sr = await _db.service_requests.find_one({"id": request_id})
    if not sr:
        try:
            sr = await _db.service_requests.find_one({"_id": ObjectId(request_id)})
        except Exception:
            pass
    if not sr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    update = {"status": new_status, "updated_at": datetime.utcnow()}
    if data.get("admin_notes"):
        update["admin_notes"] = data["admin_notes"]
    
    sr_filter = {"id": request_id} if "id" in sr and sr["id"] == request_id else {"_id": sr["_id"]}
    
    # If approving → auto-create business and link client
    if new_status == "approved":
        update["approved_at"] = datetime.utcnow()
        
        # Create the business
        biz = {
            "id": str(uuid.uuid4()),
            "business_name": sr.get("business_name", "Nuevo Negocio"),
            "business_type": sr.get("business_type", "sole_proprietorship"),
            "owner_name": sr.get("client_name", ""),
            "owner_email": sr.get("client_email", ""),
            "owner_phone": sr.get("client_phone", ""),
            "linked_client_id": sr.get("client_id", ""),
            "service_plan": sr.get("plan", "semilla"),
            "monthly_fee": sr.get("monthly_fee", 0),
            "status": "active",
            "ein": "",
            "industry": "",
            "address": "",
            "city": "",
            "state": "TX",
            "zip_code": "",
            "notes": sr.get("notes", ""),
            "created_at": datetime.utcnow(),
        }
        await _db.bk_businesses.insert_one(biz)
        update["business_id"] = biz["id"]
        
        # Notify client by email
        try:
            from notification_service import NotificationService
            ns = NotificationService(_db)
            if sr.get("client_email"):
                await ns.send_email(
                    to_email=sr["client_email"],
                    subject="¡Tu servicio de Bookkeeping ha sido aprobado! 🎉",
                    html_content=f"""
                    <h2>¡Bienvenido al servicio de Bookkeeping de Ross Tax!</h2>
                    <p>Hola {sr.get('client_name', '')},</p>
                    <p>Tu solicitud de bookkeeping ha sido aprobada.</p>
                    <p><b>Negocio:</b> {sr.get('business_name', '')}</p>
                    <p><b>Plan:</b> {sr.get('plan_name', '')}</p>
                    <p><b>Mensualidad:</b> ${sr.get('monthly_fee', 0)}/mes</p>
                    <p>Ya puedes acceder a tu dashboard financiero desde la app Ross Tax.</p>
                    <p>— El equipo de Ross Tax</p>
                    """
                )
        except Exception as e:
            print(f"Error sending approval email: {e}")
    
    elif new_status == "rejected":
        # Notify client
        try:
            from notification_service import NotificationService
            ns = NotificationService(_db)
            if sr.get("client_email"):
                reason = data.get("admin_notes", "")
                await ns.send_email(
                    to_email=sr["client_email"],
                    subject="Actualización de tu solicitud de Bookkeeping",
                    html_content=f"""
                    <h2>Actualización de tu solicitud</h2>
                    <p>Hola {sr.get('client_name', '')},</p>
                    <p>Lamentablemente no pudimos aprobar tu solicitud en este momento.</p>
                    {f'<p><b>Motivo:</b> {reason}</p>' if reason else ''}
                    <p>Por favor contacta a nuestro equipo para más información.</p>
                    <p>— El equipo de Ross Tax</p>
                    """
                )
        except Exception as e:
            print(f"Error sending rejection email: {e}")
    
    await _db.service_requests.update_one(sr_filter, {"$set": update})
    return {"success": True, "status": new_status}


@bookkeeping_router.delete("/admin/bookkeeping/service-requests/{request_id}")
async def delete_service_request(request_id: str, request: Request):
    """Admin: Delete a service request"""
    await _auth_admin(request)
    result = await _db.service_requests.delete_one({"id": request_id})
    if result.deleted_count == 0:
        try:
            result = await _db.service_requests.delete_one({"_id": ObjectId(request_id)})
        except Exception:
            pass
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# CASH FLOW STATEMENT
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/cash-flow")
async def get_cash_flow_statement(
    request: Request,
    business_id: str = "",
    date_from: str = "",
    date_to: str = "",
):
    """Generate Cash Flow Statement"""
    await _auth_admin(request)
    
    now = datetime.utcnow()
    if not date_from:
        date_from = f"{now.year}-01-01"
    if not date_to:
        date_to = now.strftime("%Y-%m-%d")
    
    dt_from = datetime.fromisoformat(date_from)
    dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
    
    query: dict = {"date": {"$gte": dt_from, "$lte": dt_to}}
    if business_id:
        query["business_id"] = business_id
    
    txns = await _db.bk_transactions.find(query).sort("date", 1).to_list(5000)
    
    # Operating activities
    operating_income = sum(t["amount"] for t in txns if t.get("type") == "income" and t.get("category") in ["sales", "services", "refunds", "other"])
    operating_expenses = sum(t["amount"] for t in txns if t.get("type") == "expense" and t.get("category") not in ["depreciation", "interest_mortgage", "interest_other"])
    depreciation = sum(t["amount"] for t in txns if t.get("type") == "expense" and t.get("category") == "depreciation")
    net_operating = operating_income - operating_expenses
    
    # Investing activities
    investing_in = sum(t["amount"] for t in txns if t.get("type") == "income" and t.get("category") in ["rental", "interest"])
    investing_out = sum(t["amount"] for t in txns if t.get("type") == "expense" and t.get("category") in ["depreciation", "rent_property"])
    net_investing = investing_in - investing_out
    
    # Financing activities
    financing_in = sum(t["amount"] for t in txns if t.get("type") == "income" and t.get("category") in ["loans", "investment"])
    financing_out = sum(t["amount"] for t in txns if t.get("type") == "expense" and t.get("category") in ["interest_mortgage", "interest_other"])
    net_financing = financing_in - financing_out
    
    net_change = net_operating + net_investing + net_financing
    
    # Monthly breakdown
    monthly = {}
    for t in txns:
        d = t.get("date")
        if isinstance(d, datetime):
            key = d.strftime("%Y-%m")
        elif isinstance(d, str):
            key = d[:7]
        else:
            continue
        if key not in monthly:
            monthly[key] = {"month": key, "inflow": 0, "outflow": 0}
        if t.get("type") == "income":
            monthly[key]["inflow"] += t["amount"]
        else:
            monthly[key]["outflow"] += t["amount"]
    
    monthly_list = sorted(monthly.values(), key=lambda x: x["month"])
    for m in monthly_list:
        m["net"] = round(m["inflow"] - m["outflow"], 2)
        m["inflow"] = round(m["inflow"], 2)
        m["outflow"] = round(m["outflow"], 2)
    
    biz_name = "Todos los Negocios"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz.get("business_name", biz_name)
    
    return {
        "success": True,
        "business_name": biz_name,
        "period": {"from": date_from, "to": date_to},
        "operating": {
            "income": round(operating_income, 2),
            "expenses": round(operating_expenses, 2),
            "depreciation": round(depreciation, 2),
            "net": round(net_operating, 2),
        },
        "investing": {
            "income": round(investing_in, 2),
            "expenses": round(investing_out, 2),
            "net": round(net_investing, 2),
        },
        "financing": {
            "income": round(financing_in, 2),
            "expenses": round(financing_out, 2),
            "net": round(net_financing, 2),
        },
        "net_change": round(net_change, 2),
        "monthly_breakdown": monthly_list,
    }


# ═══════════════════════════════════════════════════════════════
# ACCOUNTS RECEIVABLE / PAYABLE (AR/AP)
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/ar-ap")
async def list_ar_ap(request: Request, business_id: str = "", type: str = "", status: str = ""):
    """List accounts receivable and payable"""
    await _auth_admin(request)
    query: dict = {}
    if business_id:
        query["business_id"] = business_id
    if type:
        query["type"] = type  # 'receivable' or 'payable'
    if status:
        query["status"] = status  # 'pending', 'partial', 'paid', 'overdue'
    
    items = await _db.bk_ar_ap.find(query).sort("due_date", 1).to_list(200)
    
    result = []
    total_receivable = 0
    total_payable = 0
    total_overdue = 0
    
    for item in items:
        item["id"] = str(item.pop("_id", ""))
        for field in ["due_date", "created_at", "paid_date"]:
            if isinstance(item.get(field), datetime):
                item[field] = item[field].isoformat()
        
        # Check if overdue
        if item.get("status") == "pending" and item.get("due_date"):
            try:
                due = datetime.fromisoformat(item["due_date"].replace("Z", "+00:00")) if isinstance(item["due_date"], str) else item["due_date"]
                if due < datetime.utcnow():
                    item["status"] = "overdue"
                    await _db.bk_ar_ap.update_one({"_id": ObjectId(item["id"])}, {"$set": {"status": "overdue"}})
            except Exception:
                pass
        
        if item.get("type") == "receivable":
            total_receivable += item.get("amount", 0) - item.get("paid_amount", 0)
        else:
            total_payable += item.get("amount", 0) - item.get("paid_amount", 0)
        if item.get("status") == "overdue":
            total_overdue += item.get("amount", 0) - item.get("paid_amount", 0)
        
        result.append(item)
    
    return {
        "items": result,
        "total": len(result),
        "total_receivable": round(total_receivable, 2),
        "total_payable": round(total_payable, 2),
        "total_overdue": round(total_overdue, 2),
    }


@bookkeeping_router.post("/admin/bookkeeping/ar-ap")
async def create_ar_ap(request: Request):
    """Create an account receivable or payable entry"""
    await _auth_admin(request)
    data = await request.json()
    
    entry = {
        "business_id": data.get("business_id", ""),
        "type": data.get("type", "receivable"),  # 'receivable' or 'payable'
        "contact_name": data.get("contact_name", ""),
        "contact_email": data.get("contact_email", ""),
        "description": data.get("description", ""),
        "amount": float(data.get("amount", 0)),
        "paid_amount": 0,
        "due_date": datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None,
        "status": "pending",
        "invoice_number": data.get("invoice_number", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow(),
    }
    
    result = await _db.bk_ar_ap.insert_one(entry)
    entry["id"] = str(result.inserted_id)
    return {"success": True, "item": entry}


@bookkeeping_router.patch("/admin/bookkeeping/ar-ap/{item_id}")
async def update_ar_ap(item_id: str, request: Request):
    """Update an AR/AP entry (mark payment, update status)"""
    await _auth_admin(request)
    data = await request.json()
    
    update: dict = {}
    if "status" in data:
        update["status"] = data["status"]
    if "paid_amount" in data:
        update["paid_amount"] = float(data["paid_amount"])
    if "paid_date" in data:
        update["paid_date"] = datetime.fromisoformat(data["paid_date"])
    if "notes" in data:
        update["notes"] = data["notes"]
    if "due_date" in data:
        update["due_date"] = datetime.fromisoformat(data["due_date"])
    if "amount" in data:
        update["amount"] = float(data["amount"])
    if "contact_name" in data:
        update["contact_name"] = data["contact_name"]
    if "description" in data:
        update["description"] = data["description"]
    
    # Auto-detect if fully paid
    if "paid_amount" in update:
        item = await _db.bk_ar_ap.find_one({"_id": ObjectId(item_id)})
        if item and update["paid_amount"] >= item.get("amount", 0):
            update["status"] = "paid"
            update["paid_date"] = datetime.utcnow()
        elif update["paid_amount"] > 0:
            update["status"] = "partial"
    
    update["updated_at"] = datetime.utcnow()
    await _db.bk_ar_ap.update_one({"_id": ObjectId(item_id)}, {"$set": update})
    return {"success": True}


@bookkeeping_router.delete("/admin/bookkeeping/ar-ap/{item_id}")
async def delete_ar_ap(item_id: str, request: Request):
    """Delete an AR/AP entry"""
    await _auth_admin(request)
    await _db.bk_ar_ap.delete_one({"_id": ObjectId(item_id)})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# UNUSUAL EXPENSE ALERTS
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/expense-alerts")
async def get_expense_alerts(request: Request, business_id: str = ""):
    """Detect unusual expenses by comparing against historical averages"""
    await _auth_admin(request)
    
    now = datetime.utcnow()
    # Get last 6 months of transactions for baseline
    six_months_ago = now - timedelta(days=180)
    
    query: dict = {"type": "expense", "date": {"$gte": six_months_ago, "$lte": now}}
    if business_id:
        query["business_id"] = business_id
    
    txns = await _db.bk_transactions.find(query).to_list(5000)
    
    # Calculate monthly averages by category
    cat_monthly: dict = {}
    for t in txns:
        cat = t.get("category", "other")
        d = t.get("date")
        if isinstance(d, datetime):
            month_key = d.strftime("%Y-%m")
        elif isinstance(d, str):
            month_key = d[:7]
        else:
            continue
        
        if cat not in cat_monthly:
            cat_monthly[cat] = {}
        if month_key not in cat_monthly[cat]:
            cat_monthly[cat][month_key] = 0
        cat_monthly[cat][month_key] += t.get("amount", 0)
    
    # Current month expenses
    current_month = now.strftime("%Y-%m")
    alerts = []
    
    for cat, months_data in cat_monthly.items():
        historical = [v for k, v in months_data.items() if k != current_month]
        current = months_data.get(current_month, 0)
        
        if not historical or len(historical) < 2:
            continue
        
        avg = sum(historical) / len(historical)
        if avg == 0:
            continue
        
        deviation = ((current - avg) / avg) * 100
        
        # Alert if >50% above average
        if deviation > 50 and current > 100:
            cat_label = cat
            for c in EXPENSE_CATEGORIES:
                if c["key"] == cat:
                    cat_label = c.get("label_es", c.get("label_en", cat))
                    break
            
            alerts.append({
                "category": cat,
                "category_label": cat_label,
                "current_month_total": round(current, 2),
                "monthly_average": round(avg, 2),
                "deviation_percent": round(deviation, 1),
                "severity": "high" if deviation > 100 else "medium",
                "message": f"Gastos de '{cat_label}' están {round(deviation)}% por encima del promedio mensual",
            })
    
    # Sort by deviation
    alerts.sort(key=lambda x: x["deviation_percent"], reverse=True)
    
    return {
        "alerts": alerts,
        "total": len(alerts),
        "analysis_period": f"Últimos 6 meses hasta {current_month}",
    }


# ═══════════════════════════════════════════════════════════════
# MONTHLY REPORT EMAIL
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.post("/admin/bookkeeping/send-monthly-report/{business_id}")
async def send_monthly_report(business_id: str, request: Request):
    """Generate and email monthly financial report to client"""
    await _auth_admin(request)
    
    biz = await _db.bk_businesses.find_one({"id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    
    email = biz.get("owner_email", "")
    if not email:
        raise HTTPException(status_code=400, detail="El negocio no tiene email registrado")
    
    now = datetime.utcnow()
    # Get current month data
    month_start = datetime(now.year, now.month, 1)
    if now.month == 1:
        prev_month_start = datetime(now.year - 1, 12, 1)
    else:
        prev_month_start = datetime(now.year, now.month - 1, 1)
    
    query = {"business_id": business_id, "date": {"$gte": prev_month_start, "$lt": month_start}}
    txns = await _db.bk_transactions.find(query).to_list(2000)
    
    income = sum(t["amount"] for t in txns if t.get("type") == "income")
    expenses = sum(t["amount"] for t in txns if t.get("type") == "expense")
    net = income - expenses
    txn_count = len(txns)
    
    # Top expense categories
    cat_totals: dict = {}
    for t in txns:
        if t.get("type") == "expense":
            cat = t.get("category", "other")
            cat_totals[cat] = cat_totals.get(cat, 0) + t.get("amount", 0)
    
    top_categories = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5]
    
    month_name = prev_month_start.strftime("%B %Y")
    
    cat_rows = ""
    for cat, total in top_categories:
        label = cat
        for c in EXPENSE_CATEGORIES:
            if c["key"] == cat:
                label = c["label"]
                break
        cat_rows += f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{label}</td><td style='padding:8px;border-bottom:1px solid #eee;text-align:right;color:#ef4444;font-weight:bold'>${total:,.2f}</td></tr>"
    
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:linear-gradient(135deg,#059669,#10b981);padding:30px;text-align:center;color:white">
            <h1 style="margin:0;font-size:24px">📊 Reporte Mensual</h1>
            <p style="margin:8px 0 0;opacity:0.9">{biz.get('business_name','')} — {month_name}</p>
        </div>
        <div style="padding:30px">
            <div style="display:flex;gap:12px;margin-bottom:24px">
                <div style="flex:1;background:#ecfdf5;border-radius:12px;padding:16px;text-align:center">
                    <p style="margin:0;font-size:12px;color:#059669">Ingresos</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#059669">${income:,.2f}</p>
                </div>
                <div style="flex:1;background:#fef2f2;border-radius:12px;padding:16px;text-align:center">
                    <p style="margin:0;font-size:12px;color:#ef4444">Gastos</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#ef4444">${expenses:,.2f}</p>
                </div>
                <div style="flex:1;background:{'#ecfdf5' if net >= 0 else '#fef2f2'};border-radius:12px;padding:16px;text-align:center">
                    <p style="margin:0;font-size:12px;color:{'#059669' if net >= 0 else '#ef4444'}">Ganancia Neta</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:{'#059669' if net >= 0 else '#ef4444'}">${net:,.2f}</p>
                </div>
            </div>
            <p style="color:#6b7280;font-size:14px">Total de transacciones: <b>{txn_count}</b></p>
            <h3 style="margin:20px 0 12px;font-size:16px;color:#111827">Top 5 Gastos</h3>
            <table style="width:100%;border-collapse:collapse">{cat_rows}</table>
            <div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
                <p style="margin:0;font-size:13px;color:#166534">💡 Este reporte fue generado automáticamente por Ross Tax. Para preguntas sobre tus finanzas, responde a este email o contáctanos por la app.</p>
            </div>
        </div>
    </div>
    """
    
    try:
        from notification_service import NotificationService
        ns = NotificationService(_db)
        await ns.send_email(
            to_email=email,
            subject=f"📊 Reporte Mensual — {biz.get('business_name','')} — {month_name}",
            html_content=html
        )
        return {"success": True, "message": f"Reporte enviado a {email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando email: {str(e)}")


# ═══════════════════════════════════════════════════════════════
# CASH FLOW FORECASTING
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/forecast")
async def get_cash_flow_forecast(request: Request, business_id: str = "", months: int = 6):
    """AI-powered cash flow forecast based on historical trends"""
    await _auth_admin(request)
    
    now = datetime.utcnow()
    # Get 12 months of history for projection
    history_start = now - timedelta(days=365)
    
    query: dict = {"date": {"$gte": history_start, "$lte": now}}
    if business_id:
        query["business_id"] = business_id
    
    txns = await _db.bk_transactions.find(query).to_list(10000)
    
    # Build monthly aggregates
    monthly_data: dict = {}
    for t in txns:
        d = t.get("date")
        if isinstance(d, datetime):
            key = d.strftime("%Y-%m")
        elif isinstance(d, str):
            key = d[:7]
        else:
            continue
        if key not in monthly_data:
            monthly_data[key] = {"income": 0, "expenses": 0, "txn_count": 0}
        if t.get("type") == "income":
            monthly_data[key]["income"] += t.get("amount", 0)
        else:
            monthly_data[key]["expenses"] += t.get("amount", 0)
        monthly_data[key]["txn_count"] += 1
    
    # Calculate trends
    sorted_months = sorted(monthly_data.keys())
    history = []
    for m in sorted_months:
        d = monthly_data[m]
        history.append({
            "month": m,
            "income": round(d["income"], 2),
            "expenses": round(d["expenses"], 2),
            "net": round(d["income"] - d["expenses"], 2),
            "txn_count": d["txn_count"],
        })
    
    # Simple linear regression for forecasting
    if len(history) >= 3:
        recent = history[-6:] if len(history) >= 6 else history
        avg_income = sum(h["income"] for h in recent) / len(recent)
        avg_expenses = sum(h["expenses"] for h in recent) / len(recent)
        
        # Calculate growth rates
        if len(recent) >= 2:
            income_growth = (recent[-1]["income"] - recent[0]["income"]) / max(recent[0]["income"], 1) / len(recent)
            expense_growth = (recent[-1]["expenses"] - recent[0]["expenses"]) / max(recent[0]["expenses"], 1) / len(recent)
        else:
            income_growth = 0
            expense_growth = 0
        
        # Cap growth rates at reasonable levels
        income_growth = max(-0.1, min(0.1, income_growth))
        expense_growth = max(-0.1, min(0.1, expense_growth))
    else:
        avg_income = 0
        avg_expenses = 0
        income_growth = 0
        expense_growth = 0
    
    # Generate forecast months
    forecast = []
    cumulative_balance = sum(h["net"] for h in history)
    
    for i in range(1, months + 1):
        future_date = now + timedelta(days=30 * i)
        proj_income = avg_income * (1 + income_growth * i)
        proj_expenses = avg_expenses * (1 + expense_growth * i)
        proj_net = proj_income - proj_expenses
        cumulative_balance += proj_net
        
        forecast.append({
            "month": future_date.strftime("%Y-%m"),
            "projected_income": round(max(0, proj_income), 2),
            "projected_expenses": round(max(0, proj_expenses), 2),
            "projected_net": round(proj_net, 2),
            "cumulative_balance": round(cumulative_balance, 2),
            "confidence": "high" if i <= 2 else "medium" if i <= 4 else "low",
        })
    
    # Calculate key insights
    total_future_income = sum(f["projected_income"] for f in forecast)
    total_future_expenses = sum(f["projected_expenses"] for f in forecast)
    
    # Find breakeven month
    breakeven_month = None
    running = cumulative_balance - sum(f["projected_net"] for f in forecast)
    for f in forecast:
        running += f["projected_net"]
        if running > 0 and breakeven_month is None and cumulative_balance <= 0:
            breakeven_month = f["month"]
    
    biz_name = "Todos los Negocios"
    if business_id:
        biz = await _db.bk_businesses.find_one({"id": business_id})
        if biz:
            biz_name = biz.get("business_name", biz_name)
    
    return {
        "success": True,
        "business_name": biz_name,
        "history": history,
        "forecast": forecast,
        "insights": {
            "avg_monthly_income": round(avg_income, 2),
            "avg_monthly_expenses": round(avg_expenses, 2),
            "avg_monthly_net": round(avg_income - avg_expenses, 2),
            "income_trend": f"+{round(income_growth*100, 1)}%" if income_growth > 0 else f"{round(income_growth*100, 1)}%",
            "expense_trend": f"+{round(expense_growth*100, 1)}%" if expense_growth > 0 else f"{round(expense_growth*100, 1)}%",
            "total_projected_income_6mo": round(total_future_income, 2),
            "total_projected_expenses_6mo": round(total_future_expenses, 2),
            "projected_cumulative_balance": round(cumulative_balance, 2),
            "breakeven_month": breakeven_month,
        },
    }


# ═══════════════════════════════════════════════════════════════
# IRS REFUND STATUS TRACKING (Enhanced)
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.post("/admin/bookkeeping/refund-tracker")
async def create_refund_tracker(request: Request):
    """Create a new IRS refund tracker for a client"""
    await _auth_admin(request)
    data = await request.json()
    
    tracker = {
        "id": str(uuid.uuid4()),
        "client_id": data.get("client_id", ""),
        "client_name": data.get("client_name", ""),
        "client_email": data.get("client_email", ""),
        "client_phone": data.get("client_phone", ""),
        "ssn_last4": data.get("ssn_last4", ""),
        "tax_year": data.get("tax_year", datetime.utcnow().year - 1),
        "filing_status": data.get("filing_status", "single"),
        "refund_amount": float(data.get("refund_amount", 0)),
        "filing_date": data.get("filing_date", datetime.utcnow().isoformat()),
        "status": "filed",
        "irs_status": "received",
        "estimated_deposit_date": None,
        "timeline": [
            {
                "date": datetime.utcnow().isoformat(),
                "status": "filed",
                "irs_status": "received",
                "note": "Declaración presentada al IRS",
            }
        ],
        "notifications_sent": 0,
        "last_checked": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow(),
    }
    
    await _db.refund_trackers.insert_one(tracker)
    return {"success": True, "tracker": tracker}


@bookkeeping_router.get("/admin/bookkeeping/refund-trackers")
async def list_refund_trackers(request: Request, status: str = ""):
    """List all refund trackers"""
    await _auth_admin(request)
    query: dict = {}
    if status:
        query["status"] = status
    
    trackers = await _db.refund_trackers.find(query).sort("created_at", -1).to_list(200)
    
    result = []
    for t in trackers:
        t.pop("_id", None)
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        result.append(t)
    
    # Stats
    total = len(result)
    active = len([t for t in result if t.get("status") in ["filed", "processing"]])
    completed = len([t for t in result if t.get("status") == "deposited"])
    total_refunds = sum(t.get("refund_amount", 0) for t in result if t.get("status") == "deposited")
    
    return {
        "trackers": result,
        "stats": {
            "total": total,
            "active": active,
            "completed": completed,
            "total_refunds_deposited": round(total_refunds, 2),
        }
    }


@bookkeeping_router.patch("/admin/bookkeeping/refund-tracker/{tracker_id}")
async def update_refund_tracker(tracker_id: str, request: Request):
    """Update refund tracker status (manual IRS update)"""
    await _auth_admin(request)
    data = await request.json()
    
    tracker = await _db.refund_trackers.find_one({"id": tracker_id})
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker no encontrado")
    
    new_status = data.get("status", tracker.get("status"))
    irs_status = data.get("irs_status", tracker.get("irs_status"))
    note = data.get("note", "")
    
    irs_status_labels = {
        "received": "Declaración recibida por el IRS",
        "processing": "En proceso de revisión",
        "approved": "Reembolso aprobado",
        "sent": "Reembolso enviado al banco",
        "deposited": "Reembolso depositado",
        "held": "Reembolso retenido — se requiere acción",
        "rejected": "Declaración rechazada",
    }
    
    timeline_entry = {
        "date": datetime.utcnow().isoformat(),
        "status": new_status,
        "irs_status": irs_status,
        "note": note or irs_status_labels.get(irs_status, "Actualización de estado"),
    }
    
    update: dict = {
        "status": new_status,
        "irs_status": irs_status,
        "last_checked": datetime.utcnow().isoformat(),
    }
    
    if data.get("estimated_deposit_date"):
        update["estimated_deposit_date"] = data["estimated_deposit_date"]
    
    if new_status == "deposited":
        update["deposit_date"] = datetime.utcnow().isoformat()
    
    await _db.refund_trackers.update_one(
        {"id": tracker_id},
        {"$set": update, "$push": {"timeline": timeline_entry}, "$inc": {"notifications_sent": 1}}
    )
    
    # Send notification to client
    try:
        from notification_service import NotificationService
        ns = NotificationService(_db)
        client_email = tracker.get("client_email")
        if client_email:
            status_emoji = {"received": "📥", "processing": "⏳", "approved": "✅", "sent": "🚀", "deposited": "💰", "held": "⚠️", "rejected": "❌"}
            emoji = status_emoji.get(irs_status, "📋")
            
            await ns.send_email(
                to_email=client_email,
                subject=f"{emoji} Actualización de tu Reembolso — Tax Year {tracker.get('tax_year', '')}",
                html_content=f"""
                <div style="font-family:Arial;max-width:500px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;text-align:center;color:white">
                        <h2 style="margin:0">{emoji} Actualización de Reembolso</h2>
                    </div>
                    <div style="padding:24px">
                        <p>Hola {tracker.get('client_name', '')},</p>
                        <p style="font-size:18px;font-weight:bold;color:#059669">{irs_status_labels.get(irs_status, irs_status)}</p>
                        <p><b>Monto del reembolso:</b> ${tracker.get('refund_amount', 0):,.2f}</p>
                        <p><b>Año fiscal:</b> {tracker.get('tax_year', '')}</p>
                        {f'<p><b>Nota:</b> {note}</p>' if note else ''}
                        {f'<p><b>Fecha estimada de depósito:</b> {data.get("estimated_deposit_date", "")}</p>' if data.get("estimated_deposit_date") else ''}
                        <p style="color:#6b7280;font-size:12px;margin-top:20px">— Ross Tax Preparation</p>
                    </div>
                </div>
                """
            )
    except Exception as e:
        print(f"Error sending refund notification: {e}")
    
    return {"success": True, "status": new_status, "irs_status": irs_status}


# ═══════════════════════════════════════════════════════════════
# CLIENT: MY REFUND STATUS (Mobile App)
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/my-refund-status")
async def get_my_refund_status(request: Request, authorization: Optional[str] = None):
    """Client: Get their refund tracking status"""
    from fastapi import Header
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(status_code=401, detail="No authorization")
    
    token = auth_header.replace("Bearer ", "")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await _db.users.find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    email = user.get("email", "")
    trackers = await _db.refund_trackers.find({"client_email": email}).sort("created_at", -1).to_list(10)
    
    result = []
    for t in trackers:
        t.pop("_id", None)
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = t["created_at"].isoformat()
        result.append(t)
    
    return {"trackers": result}


# ═══════════════════════════════════════════════════════════════
# CALENDAR EXPORT (ICS)
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/calendar/export.ics")
async def export_calendar_ics(request: Request):
    """Export all appointments as ICS file for Google/Apple Calendar sync"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(status_code=401, detail="No authorization")
    
    token = auth_header.replace("Bearer ", "")
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await _db.users.find_one({"_id": session["user_id"]})
    user_email = user.get("email", "") if user else ""
    is_admin = user.get("role") == "admin" if user else False
    
    # Get appointments
    if is_admin:
        appts = await _db.appointments.find({"status": {"$in": ["confirmed", "pending"]}}).sort("scheduled_at", 1).to_list(500)
    else:
        appts = await _db.appointments.find({
            "client_email": user_email,
            "status": {"$in": ["confirmed", "pending"]}
        }).sort("scheduled_at", 1).to_list(100)
    
    # Build ICS
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ross Tax//Appointments//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Ross Tax Citas",
    ]
    
    for a in appts:
        uid = str(a.get("_id", ""))
        scheduled = a.get("scheduled_at")
        if not scheduled:
            continue
        
        if isinstance(scheduled, str):
            try:
                scheduled = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
            except Exception:
                continue
        
        if not isinstance(scheduled, datetime):
            continue
        
        end_time = scheduled + timedelta(minutes=a.get("duration_minutes", 30))
        
        dtstart = scheduled.strftime("%Y%m%dT%H%M%SZ")
        dtend = end_time.strftime("%Y%m%dT%H%M%SZ")
        summary = a.get("service_type", a.get("type", "Cita")) or "Cita Ross Tax"
        description = f"Cliente: {a.get('client_name', '')}\\nEmail: {a.get('client_email', '')}\\nTeléfono: {a.get('client_phone', '')}"
        location = a.get("location", "Ross Tax Office")
        
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}@rosstax",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{location}",
            f"STATUS:CONFIRMED",
            "END:VEVENT",
        ])
    
    lines.append("END:VCALENDAR")
    
    ics_content = "\r\n".join(lines)
    
    from fastapi.responses import Response
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=ross_tax_citas.ics"}
    )



# ═══════════════════════════════════════════════════════════════
# NPS SURVEYS — Customer Satisfaction Tracking
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.post("/admin/bookkeeping/nps-survey")
async def create_nps_survey(request: Request):
    """Send or record an NPS survey for a bookkeeping client"""
    await _auth_admin(request)
    data = await request.json()

    survey = {
        "id": str(uuid.uuid4()),
        "business_id": data.get("business_id", ""),
        "business_name": data.get("business_name", ""),
        "client_email": data.get("client_email", ""),
        "client_name": data.get("client_name", ""),
        "score": None,
        "feedback": "",
        "status": "pending",
        "survey_type": data.get("survey_type", "quarterly"),  # onboarding, monthly, quarterly
        "sent_at": datetime.utcnow(),
        "responded_at": None,
        "created_at": datetime.utcnow(),
    }

    await _db.nps_surveys.insert_one(survey)

    # Send email with survey link
    try:
        from notification_service import NotificationService
        ns = NotificationService(_db)
        survey_url = f"https://www.rosstaxpreparation.com/nps/{survey['id']}"
        if survey["client_email"]:
            await ns.send_email(
                to_email=survey["client_email"],
                subject="⭐ ¿Cómo ha sido tu experiencia con Ross Tax Bookkeeping?",
                html_content=f"""
                <div style="font-family:Arial;max-width:500px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;text-align:center;color:white">
                        <h2 style="margin:0">⭐ Tu Opinión Importa</h2>
                    </div>
                    <div style="padding:24px;text-align:center">
                        <p>Hola {survey['client_name']},</p>
                        <p>En una escala del 0 al 10, ¿qué tan probable es que recomiendes nuestro servicio de Bookkeeping?</p>
                        <div style="margin:20px 0">
                            {''.join([f'<a href="{survey_url}?score={i}" style="display:inline-block;width:36px;height:36px;line-height:36px;margin:3px;border-radius:8px;background:{("#ef4444" if i<=6 else "#f59e0b" if i<=8 else "#10b981")};color:white;text-decoration:none;font-weight:bold;font-size:14px">{i}</a>' for i in range(11)])}
                        </div>
                        <p style="color:#9ca3af;font-size:11px">0 = Nada probable · 10 = Definitivamente</p>
                    </div>
                </div>
                """
            )
    except Exception as e:
        print(f"Error sending NPS survey email: {e}")

    return {"success": True, "survey_id": survey["id"]}


@bookkeeping_router.get("/admin/bookkeeping/nps-surveys")
async def list_nps_surveys(request: Request):
    """List all NPS surveys with analytics"""
    await _auth_admin(request)

    surveys = await _db.nps_surveys.find().sort("created_at", -1).to_list(500)
    result = []
    for s in surveys:
        s.pop("_id", None)
        for k in ["sent_at", "responded_at", "created_at"]:
            if isinstance(s.get(k), datetime):
                s[k] = s[k].isoformat()
        result.append(s)

    # Calculate NPS
    responded = [s for s in result if s.get("score") is not None]
    if responded:
        promoters = len([s for s in responded if s["score"] >= 9])
        passives = len([s for s in responded if 7 <= s["score"] <= 8])
        detractors = len([s for s in responded if s["score"] <= 6])
        total = len(responded)
        nps_score = round(((promoters - detractors) / total) * 100)
        avg_score = round(sum(s["score"] for s in responded) / total, 1)
    else:
        promoters = passives = detractors = 0
        nps_score = 0
        avg_score = 0

    return {
        "surveys": result,
        "analytics": {
            "total_sent": len(result),
            "total_responded": len(responded),
            "response_rate": round(len(responded) / max(len(result), 1) * 100, 1),
            "nps_score": nps_score,
            "avg_score": avg_score,
            "promoters": promoters,
            "passives": passives,
            "detractors": detractors,
        }
    }


# Public endpoint for clients to respond to NPS
@bookkeeping_router.post("/nps/{survey_id}/respond")
async def respond_nps_survey(survey_id: str, request: Request):
    """Client responds to NPS survey (public endpoint)"""
    data = await request.json()
    score = data.get("score")
    feedback = data.get("feedback", "")

    if score is None or not (0 <= int(score) <= 10):
        raise HTTPException(status_code=400, detail="Score debe ser entre 0 y 10")

    survey = await _db.nps_surveys.find_one({"id": survey_id})
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    await _db.nps_surveys.update_one(
        {"id": survey_id},
        {"$set": {
            "score": int(score),
            "feedback": feedback,
            "status": "responded",
            "responded_at": datetime.utcnow(),
        }}
    )
    return {"success": True, "message": "¡Gracias por tu respuesta!"}


# ═══════════════════════════════════════════════════════════════
# SERVICE AGREEMENTS — Digital Contracts
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.post("/admin/bookkeeping/service-agreement")
async def create_service_agreement(request: Request):
    """Generate a digital service agreement for a bookkeeping client"""
    await _auth_admin(request)
    data = await request.json()

    plan_details = {
        "semilla": {
            "name": "Plan Semilla", "price": 199,
            "includes": [
                "Hasta 50 transacciones por mes",
                "Categorización automática con revisión mensual",
                "1 cuenta bancaria sincronizada",
                "Reporte P&L mensual",
                "Hasta 20 escaneos de recibos por mes",
                "Soporte vía chat/email (respuesta en 48h)",
                "Revisión contable mensual",
            ],
            "excludes": [
                "Sales Tax preparation",
                "Cuentas por cobrar/pagar",
                "Payroll processing",
                "Consultoría financiera",
                "Representación ante el IRS",
            ],
        },
        "crecimiento": {
            "name": "Plan Crecimiento", "price": 399,
            "includes": [
                "Hasta 200 transacciones por mes",
                "Categorización automática con revisión semanal",
                "Hasta 3 cuentas bancarias sincronizadas",
                "Reportes: P&L, Balance General, Flujo de Caja",
                "Escaneo ilimitado de recibos",
                "Seguimiento básico de cuentas por cobrar/pagar",
                "Preparación mensual de Sales Tax (Florida)",
                "Soporte chat/email (24h) + 1 llamada mensual",
                "Revisión contable quincenal",
                "Estimados trimestrales de impuestos",
            ],
            "excludes": [
                "Payroll processing",
                "Consultoría financiera personalizada",
                "Representación ante el IRS",
            ],
        },
        "empresarial": {
            "name": "Plan Empresarial", "price": 699,
            "includes": [
                "Transacciones ilimitadas",
                "Categorización automática con revisión semanal",
                "Cuentas bancarias ilimitadas",
                "Reportes completos + KPIs + Dashboard en tiempo real",
                "Escaneo ilimitado de recibos",
                "Gestión completa de cuentas por cobrar/pagar",
                "Preparación y presentación de Sales Tax",
                "Procesamiento mensual de Payroll",
                "Consultoría financiera (1 sesión 30min/mes)",
                "Soporte prioritario (mismo día) + 2 llamadas/mes",
                "Revisión contable semanal",
                "Preparación de impuestos incluida",
            ],
            "excludes": [
                "Servicios que requieran licencia CPA",
            ],
        },
    }

    plan = data.get("plan", "semilla")
    plan_info = plan_details.get(plan, plan_details["semilla"])

    agreement = {
        "id": str(uuid.uuid4()),
        "business_id": data.get("business_id", ""),
        "business_name": data.get("business_name", ""),
        "client_name": data.get("client_name", ""),
        "client_email": data.get("client_email", ""),
        "plan": plan,
        "plan_name": plan_info["name"],
        "monthly_fee": plan_info["price"],
        "services_included": plan_info["includes"],
        "services_excluded": plan_info["excludes"],
        "cleanup_fee": data.get("cleanup_fee", 0),
        "cleanup_description": data.get("cleanup_description", ""),
        "start_date": data.get("start_date", datetime.utcnow().strftime("%Y-%m-%d")),
        "billing_day": data.get("billing_day", 1),
        "status": "pending_signature",
        "signed_at": None,
        "signed_ip": None,
        "terms": [
            "El cliente autoriza a Ross Tax Preparation LLC a acceder a sus cuentas bancarias mediante Plaid para sincronización automática de transacciones.",
            "Ross Tax Preparation LLC mantendrá la confidencialidad de toda la información financiera del cliente.",
            "El servicio puede ser cancelado por cualquiera de las partes con 30 días de aviso previo.",
            "Los reportes y clasificaciones se basan en la información proporcionada por el cliente y las transacciones importadas.",
            "Ross Tax no ofrece asesoría legal ni servicios que requieran licencia de CPA.",
            "El fee de limpieza (cleanup), si aplica, se cobra una sola vez al inicio del servicio.",
            "Los precios pueden ajustarse con 60 días de aviso previo al cliente.",
        ],
        "created_at": datetime.utcnow(),
    }

    await _db.service_agreements.insert_one(agreement)

    # Send agreement email
    try:
        from notification_service import NotificationService
        ns = NotificationService(_db)
        sign_url = f"https://www.rosstaxpreparation.com/agreement/{agreement['id']}"
        if agreement["client_email"]:
            includes_html = "".join([f"<li style='margin:4px 0;font-size:13px'>✅ {s}</li>" for s in plan_info["includes"]])
            excludes_html = "".join([f"<li style='margin:4px 0;font-size:13px;color:#9ca3af'>❌ {s}</li>" for s in plan_info["excludes"]])
            await ns.send_email(
                to_email=agreement["client_email"],
                subject=f"📋 Acuerdo de Servicio — {plan_info['name']} — Ross Tax Bookkeeping",
                html_content=f"""
                <div style="font-family:Arial;max-width:600px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;text-align:center;color:white">
                        <h2 style="margin:0">📋 Acuerdo de Servicio de Bookkeeping</h2>
                    </div>
                    <div style="padding:24px">
                        <p>Hola {agreement['client_name']},</p>
                        <p>Tu acuerdo de servicio de <b>{plan_info['name']}</b> está listo para firmar.</p>
                        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
                            <p style="font-size:24px;font-weight:900;color:#059669;margin:0">${plan_info['price']}/mes</p>
                            <p style="font-size:12px;color:#6b7280;margin:4px 0 0 0">{plan_info['name']}</p>
                        </div>
                        <p style="font-size:13px;font-weight:bold;margin-top:16px">Servicios Incluidos:</p>
                        <ul style="padding-left:20px">{includes_html}</ul>
                        <p style="font-size:13px;font-weight:bold;margin-top:12px">No Incluido:</p>
                        <ul style="padding-left:20px">{excludes_html}</ul>
                        <div style="text-align:center;margin-top:24px">
                            <a href="{sign_url}" style="display:inline-block;padding:14px 32px;background:#059669;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px">
                                ✍️ Revisar y Firmar Acuerdo
                            </a>
                        </div>
                        <p style="color:#9ca3af;font-size:11px;margin-top:20px;text-align:center">— Ross Tax Preparation LLC</p>
                    </div>
                </div>
                """
            )
    except Exception as e:
        print(f"Error sending agreement email: {e}")

    return {"success": True, "agreement": agreement}


@bookkeeping_router.get("/admin/bookkeeping/service-agreements")
async def list_service_agreements(request: Request):
    """List all service agreements"""
    await _auth_admin(request)
    agreements = await _db.service_agreements.find().sort("created_at", -1).to_list(200)
    result = []
    for a in agreements:
        a.pop("_id", None)
        for k in ["created_at", "signed_at"]:
            if isinstance(a.get(k), datetime):
                a[k] = a[k].isoformat()
        result.append(a)

    stats = {
        "total": len(result),
        "signed": len([a for a in result if a.get("status") == "signed"]),
        "pending": len([a for a in result if a.get("status") == "pending_signature"]),
        "mrr": sum(a.get("monthly_fee", 0) for a in result if a.get("status") == "signed"),
    }
    return {"agreements": result, "stats": stats}


# Public: Sign agreement
@bookkeeping_router.post("/agreement/{agreement_id}/sign")
async def sign_service_agreement(agreement_id: str, request: Request):
    """Client signs the service agreement (public endpoint)"""
    data = await request.json()
    agr = await _db.service_agreements.find_one({"id": agreement_id})
    if not agr:
        raise HTTPException(status_code=404, detail="Acuerdo no encontrado")

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")

    await _db.service_agreements.update_one(
        {"id": agreement_id},
        {"$set": {
            "status": "signed",
            "signed_at": datetime.utcnow(),
            "signed_ip": client_ip,
            "signed_name": data.get("signed_name", ""),
        }}
    )
    return {"success": True, "message": "Acuerdo firmado exitosamente"}


# ═══════════════════════════════════════════════════════════════
# OPERATIONAL METRICS — Business Intelligence Dashboard
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.get("/admin/bookkeeping/operational-metrics")
async def get_operational_metrics(request: Request):
    """Get operational metrics: MRR, Churn, CAC, LTV, client/analyst ratio"""
    await _auth_admin(request)

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)
    ninety_days_ago = now - timedelta(days=90)

    # Get all businesses
    businesses = await _db.bk_businesses.find().to_list(1000)
    total_businesses = len(businesses)

    # Active businesses (with transactions in last 60 days)
    active_biz_ids = set()
    recent_txns = await _db.bk_transactions.find({"date": {"$gte": sixty_days_ago}}).to_list(10000)
    for t in recent_txns:
        if t.get("business_id"):
            active_biz_ids.add(t["business_id"])

    active_count = len(active_biz_ids)

    # MRR calculation
    plan_prices = {"semilla": 199, "crecimiento": 399, "empresarial": 699, "monthly": 199}
    mrr = 0
    plan_distribution = {"semilla": 0, "crecimiento": 0, "empresarial": 0}
    for b in businesses:
        plan = b.get("service_plan", b.get("subscription_plan", "semilla"))
        price = plan_prices.get(plan, b.get("monthly_fee", 199))
        mrr += price
        if plan in plan_distribution:
            plan_distribution[plan] += 1

    # Churn: businesses created > 30 days ago with no transactions in last 30 days
    churned = 0
    for b in businesses:
        created = b.get("created_at")
        if isinstance(created, datetime) and created < thirty_days_ago:
            if b.get("id") not in active_biz_ids:
                churned += 1

    eligible_for_churn = len([b for b in businesses if isinstance(b.get("created_at"), datetime) and b.get("created_at") < thirty_days_ago])
    churn_rate = round((churned / max(eligible_for_churn, 1)) * 100, 1)

    # Average Revenue Per Account (ARPA)
    arpa = round(mrr / max(total_businesses, 1), 2)

    # LTV = ARPA / Churn Rate (monthly)
    monthly_churn_decimal = churn_rate / 100
    ltv = round(arpa / max(monthly_churn_decimal, 0.01), 2) if monthly_churn_decimal > 0 else round(arpa * 24, 2)

    # Client/Analyst ratio (assuming 1 analyst for now)
    analyst_count = 1
    client_analyst_ratio = f"{total_businesses}:{analyst_count}"

    # New clients this month
    new_this_month = len([b for b in businesses if isinstance(b.get("created_at"), datetime) and b.get("created_at") >= thirty_days_ago])

    # NPS data
    nps_data = {"nps_score": 0, "avg_score": 0, "total_responses": 0}
    try:
        nps_surveys = await _db.nps_surveys.find({"score": {"$ne": None}}).to_list(500)
        if nps_surveys:
            scores = [s["score"] for s in nps_surveys]
            promoters = len([s for s in scores if s >= 9])
            detractors = len([s for s in scores if s <= 6])
            nps_data = {
                "nps_score": round(((promoters - detractors) / len(scores)) * 100),
                "avg_score": round(sum(scores) / len(scores), 1),
                "total_responses": len(scores),
            }
    except Exception:
        pass

    # Agreements stats
    signed_agreements = await _db.service_agreements.count_documents({"status": "signed"})
    pending_agreements = await _db.service_agreements.count_documents({"status": "pending_signature"})

    # Transaction volume this month
    txn_this_month = await _db.bk_transactions.count_documents({"date": {"$gte": thirty_days_ago}})

    return {
        "success": True,
        "metrics": {
            "mrr": mrr,
            "arr": mrr * 12,
            "total_clients": total_businesses,
            "active_clients": active_count,
            "new_this_month": new_this_month,
            "churn_rate": churn_rate,
            "churned_count": churned,
            "arpa": arpa,
            "ltv": ltv,
            "client_analyst_ratio": client_analyst_ratio,
            "txn_volume_monthly": txn_this_month,
            "plan_distribution": plan_distribution,
            "signed_agreements": signed_agreements,
            "pending_agreements": pending_agreements,
        },
        "nps": nps_data,
        "capacity": {
            "analyst_count": analyst_count,
            "max_semilla_per_analyst": 35,
            "max_crecimiento_per_analyst": 20,
            "max_empresarial_per_analyst": 12,
            "utilization": round(total_businesses / 35 * 100, 1),
            "hire_recommendation": "Contratar nuevo bookkeeper" if total_businesses > 30 else "Capacidad suficiente",
        },
    }

# ═══════════════════════════════════════════════════════════════
# PUBLIC — Contact Form for Bookkeeping Landing Page
# ═══════════════════════════════════════════════════════════════

@bookkeeping_router.post("/contact-bookkeeping")
async def contact_bookkeeping(request: Request):
    """Public contact form submission from the bookkeeping landing page"""
    data = await request.json()

    lead = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "business": data.get("business", ""),
        "message": data.get("message", ""),
        "plan_interest": data.get("plan", ""),
        "source": "bookkeeping_landing",
        "status": "new",
        "created_at": datetime.utcnow(),
    }

    await _db.bookkeeping_leads.insert_one(lead)

    # Send notification email to admin
    try:
        from notification_service import NotificationService
        ns = NotificationService(_db)
        plan_names = {"semilla": "Plan Semilla ($199)", "crecimiento": "Plan Crecimiento ($399)", "empresarial": "Plan Empresarial ($699)", "no_se": "Necesita asesoría"}
        plan_label = plan_names.get(lead["plan_interest"], lead["plan_interest"])

        await ns.send_email(
            to_email="yoandyross@gmail.com",
            subject=f"🆕 Nuevo Lead de Bookkeeping — {lead['name']}",
            html_content=f"""
            <div style="font-family:Arial;max-width:500px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
                <div style="background:linear-gradient(135deg,#059669,#10b981);padding:20px;text-align:center;color:white">
                    <h2 style="margin:0">🆕 Nuevo Lead de Bookkeeping</h2>
                </div>
                <div style="padding:20px">
                    <table style="width:100%;font-size:14px">
                        <tr><td style="padding:6px 0;color:#9ca3af;width:120px">Nombre:</td><td style="font-weight:bold">{lead['name']}</td></tr>
                        <tr><td style="padding:6px 0;color:#9ca3af">Email:</td><td>{lead['email']}</td></tr>
                        <tr><td style="padding:6px 0;color:#9ca3af">Teléfono:</td><td>{lead['phone'] or 'No proporcionado'}</td></tr>
                        <tr><td style="padding:6px 0;color:#9ca3af">Negocio:</td><td>{lead['business'] or 'No proporcionado'}</td></tr>
                        <tr><td style="padding:6px 0;color:#9ca3af">Plan:</td><td style="font-weight:bold;color:#059669">{plan_label}</td></tr>
                        <tr><td style="padding:6px 0;color:#9ca3af">Mensaje:</td><td>{lead['message'] or '—'}</td></tr>
                    </table>
                    <div style="margin-top:16px;text-align:center">
                        <a href="tel:{lead['phone']}" style="display:inline-block;padding:10px 24px;background:#059669;color:white;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">📞 Llamar al Lead</a>
                    </div>
                </div>
            </div>
            """
        )
    except Exception as e:
        print(f"Error sending lead notification: {e}")

    return {"success": True, "message": "Solicitud recibida. Un asesor te contactará pronto."}


@bookkeeping_router.get("/admin/bookkeeping/leads")
async def list_bookkeeping_leads(request: Request):
    """List all bookkeeping leads from the landing page"""
    await _auth_admin(request)
    leads = await _db.bookkeeping_leads.find().sort("created_at", -1).to_list(200)
    result = []
    for l in leads:
        l.pop("_id", None)
        if isinstance(l.get("created_at"), datetime):
            l["created_at"] = l["created_at"].isoformat()
        result.append(l)

    stats = {
        "total": len(result),
        "new": len([l for l in result if l.get("status") == "new"]),
        "contacted": len([l for l in result if l.get("status") == "contacted"]),
        "converted": len([l for l in result if l.get("status") == "converted"]),
    }
    return {"leads": result, "stats": stats}


@bookkeeping_router.patch("/admin/bookkeeping/lead/{lead_id}")
async def update_bookkeeping_lead(lead_id: str, request: Request):
    """Update lead status"""
    await _auth_admin(request)
    data = await request.json()
    result = await _db.bookkeeping_leads.update_one(
        {"id": lead_id},
        {"$set": {k: v for k, v in data.items() if k in ["status", "notes"]}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return {"success": True}

