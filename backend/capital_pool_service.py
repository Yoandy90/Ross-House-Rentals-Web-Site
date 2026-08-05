"""
Capital Pool & Credit Tier Management for Ross Lending
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tracks:
  - Total capital available for lending
  - Amount currently lent out (active loans)
  - Amount collected (payments received)
  - Available to lend = total_capital - active_outstanding

Credit Tiers:
  - NEW (first-time): max $200-$500
  - RETURNING (1-2 paid loans, good history): max $500-$1000
  - TRUSTED (3+ paid loans, excellent history): max $1000-$1800
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("capital_pool")

_db = None
POOL_COLLECTION = "capital_pool"
CREDIT_TIERS = {
    "new": {
        "label": "Nuevo Cliente",
        "label_en": "New Client",
        "max_amount": 500,
        "suggested_amounts": [200, 300, 500],
        "max_term_months": 3,
        "description_es": "Primera vez solicitando — máximo $500",
        "description_en": "First-time borrower — max $500",
    },
    "returning": {
        "label": "Cliente Recurrente",
        "label_en": "Returning Client",
        "max_amount": 1000,
        "suggested_amounts": [300, 500, 800, 1000],
        "max_term_months": 4,
        "description_es": "Ha pagado 1-2 préstamos — máximo $1,000",
        "description_en": "Paid 1-2 loans — max $1,000",
    },
    "trusted": {
        "label": "Cliente de Confianza",
        "label_en": "Trusted Client",
        "max_amount": 1800,
        "suggested_amounts": [500, 800, 1000, 1500, 1800],
        "max_term_months": 6,
        "description_es": "3+ préstamos pagados — máximo $1,800",
        "description_en": "3+ loans paid — max $1,800",
    },
}


async def init_capital_pool(db):
    """Initialize the capital pool service."""
    global _db
    _db = db

    # Create default pool if not exists
    pool = await db[POOL_COLLECTION].find_one({"type": "main_pool"})
    if not pool:
        await db[POOL_COLLECTION].insert_one({
            "type": "main_pool",
            "total_capital": 27400.00,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "notes": "Capital inicial de Ross Lending",
        })
        logger.info("✅ Capital pool initialized: $27,400")
    else:
        logger.info(f"✅ Capital pool loaded: ${pool.get('total_capital', 0):,.2f}")


async def get_pool_status() -> dict:
    """
    Calculate real-time pool status from actual loan data.
    Returns: total_capital, total_lent, total_collected, available, utilization%.
    """
    if _db is None:
        return {"error": "DB not initialized"}

    pool = await _db[POOL_COLLECTION].find_one({"type": "main_pool"})
    total_capital = pool.get("total_capital", 27400) if pool else 27400

    # Sum all active/pending loan amounts (money that's out)
    pipeline_lent = [
        {"$match": {"status": {"$in": ["active", "pending_signature", "delinquent"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    result_lent = await _db.regulated_loans.aggregate(pipeline_lent).to_list(1)
    total_lent = result_lent[0]["total"] if result_lent else 0

    # Sum all payments received (principal only, not interest)
    pipeline_payments = [
        {"$match": {"status": {"$in": ["completed", "verified"]}}},
        {"$group": {"_id": None, "total_principal": {"$sum": "$principal_portion"}, "total_all": {"$sum": "$amount"}}},
    ]
    result_payments = await _db.loan_payments.aggregate(pipeline_payments).to_list(1)
    total_collected_principal = result_payments[0]["total_principal"] if result_payments else 0
    total_collected_all = result_payments[0]["total_all"] if result_payments else 0

    # Loans fully paid off = capital returned
    pipeline_paid = [
        {"$match": {"status": "paid_off"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    result_paid = await _db.regulated_loans.aggregate(pipeline_paid).to_list(1)
    total_paid_off = result_paid[0]["total"] if result_paid else 0

    # Available = total capital - currently outstanding
    # Outstanding = lent - principal collected from active loans
    outstanding = max(0, total_lent - total_collected_principal)
    available = total_capital + total_paid_off - total_lent + total_collected_principal
    available = max(0, available)  # Never negative

    # Total profit earned (interest + fees from all payments)
    pipeline_profit = [
        {"$match": {"status": {"$in": ["completed", "verified"]}}},
        {"$group": {"_id": None, "interest": {"$sum": "$interest_portion"}, "fees": {"$sum": "$fee_portion"}}},
    ]
    result_profit = await _db.loan_payments.aggregate(pipeline_profit).to_list(1)
    total_profit = 0
    if result_profit:
        total_profit = (result_profit[0].get("interest", 0) or 0) + (result_profit[0].get("fees", 0) or 0)

    # Count loans by status
    active_count = await _db.regulated_loans.count_documents({"status": "active"})
    pending_signature_count = await _db.regulated_loans.count_documents({"status": "pending_signature"})
    delinquent_count = await _db.regulated_loans.count_documents({"status": "delinquent"})
    paid_off_count = await _db.regulated_loans.count_documents({"status": "paid_off"})
    total_loans_count = await _db.regulated_loans.count_documents({})

    utilization = (total_lent / total_capital * 100) if total_capital else 0

    # Get recent loans for dashboard table
    recent_loans = []
    try:
        cursor = _db.regulated_loans.find({}).sort("created_at", -1).limit(10)
        async for loan in cursor:
            recent_loans.append({
                "loan_number": loan.get("loan_number", "N/A"),
                "client_name": loan.get("client_name", "N/A"),
                "amount": loan.get("amount", 0),
                "status": loan.get("status", "unknown"),
                "term_months": loan.get("term_months", 0),
                "weekly_payment": loan.get("weekly_payment", 0),
                "monthly_payment": loan.get("monthly_payment", 0),
                "balance": loan.get("balance", loan.get("amount", 0)),
                "created_at": loan.get("created_at", ""),
            })
    except Exception as e:
        logger.error(f"Error fetching recent loans: {e}")

    return {
        "total_capital": round(total_capital, 2),
        "total_lent": round(total_lent, 2),
        "total_outstanding": round(outstanding, 2),
        "total_collected": round(total_collected_all, 2),
        "total_collected_principal": round(total_collected_principal, 2),
        "total_profit": round(total_profit, 2),
        "available_to_lend": round(available, 2),
        "utilization_pct": round(utilization, 1),
        "active_loans": active_count,
        "pending_signature_loans": pending_signature_count,
        "delinquent_loans": delinquent_count,
        "paid_off_loans": paid_off_count,
        "total_loans": total_loans_count,
        "recent_loans": recent_loans,
    }


async def can_fund_loan(amount: float) -> dict:
    """Check if there's enough capital to fund a new loan."""
    status = await get_pool_status()
    available = status.get("available_to_lend", 0)
    can_fund = available >= amount

    return {
        "can_fund": can_fund,
        "available": available,
        "requested": amount,
        "shortfall": max(0, amount - available) if not can_fund else 0,
    }


async def update_total_capital(new_total: float, admin_email: str, notes: str = "") -> dict:
    """Admin updates the total capital pool (e.g., adding more funds)."""
    if _db is None:
        return {"error": "DB not initialized"}

    old = await _db[POOL_COLLECTION].find_one({"type": "main_pool"})
    old_amount = old.get("total_capital", 0) if old else 0

    await _db[POOL_COLLECTION].update_one(
        {"type": "main_pool"},
        {
            "$set": {
                "total_capital": new_total,
                "updated_at": datetime.utcnow().isoformat(),
                "updated_by": admin_email,
            },
            "$push": {
                "history": {
                    "date": datetime.utcnow().isoformat(),
                    "old_amount": old_amount,
                    "new_amount": new_total,
                    "change": new_total - old_amount,
                    "by": admin_email,
                    "notes": notes,
                }
            },
        },
        upsert=True,
    )

    return {"success": True, "old": old_amount, "new": new_total, "change": new_total - old_amount}


async def get_client_credit_tier(user_id: str = None, email: str = None, phone: str = None) -> dict:
    """
    Determine client's credit tier based on their loan history.
    Returns: tier (new/returning/trusted), max_amount, suggested_amounts, max_term.
    """
    if _db is None:
        return {"tier": "new", **CREDIT_TIERS["new"]}

    # Find all loans for this client
    query = {"$or": []}
    if user_id:
        query["$or"].append({"user_id": user_id})
    if email:
        query["$or"].append({"client_email": {"$regex": f"^{email}$", "$options": "i"}})
    if phone:
        query["$or"].append({"client_phone": phone})

    if not query["$or"]:
        return {"tier": "new", **CREDIT_TIERS["new"]}

    loans = await _db.regulated_loans.find(query).to_list(50)

    if not loans:
        return {"tier": "new", **CREDIT_TIERS["new"]}

    # Analyze history
    paid_off = [l for l in loans if l.get("status") == "paid_off"]
    active = [l for l in loans if l.get("status") in ("active", "pending_signature")]
    delinquent = [l for l in loans if l.get("status") == "delinquent"]
    defaulted = [l for l in loans if l.get("status") == "default"]

    # If they have any defaults, stay at new tier
    if defaulted:
        tier_data = {**CREDIT_TIERS["new"]}
        tier_data["max_amount"] = 200  # Reduced for defaulters
        tier_data["suggested_amounts"] = [200]
        tier_data["warning"] = "Cliente con préstamo en default"
        return {"tier": "restricted", **tier_data}

    # If currently delinquent, stay at new tier
    if delinquent:
        return {"tier": "new", **CREDIT_TIERS["new"], "warning": "Préstamo en mora activo"}

    # Count completed (paid off) loans
    paid_count = len(paid_off)

    if paid_count >= 3:
        return {"tier": "trusted", **CREDIT_TIERS["trusted"], "paid_loans": paid_count}
    elif paid_count >= 1:
        return {"tier": "returning", **CREDIT_TIERS["returning"], "paid_loans": paid_count}
    else:
        return {"tier": "new", **CREDIT_TIERS["new"], "paid_loans": 0}
