"""
Admin endpoints for Business Invoices, Mileage, and Receipts
View all clients' data for the bookkeeping admin panel
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/biz-modules", tags=["admin-biz-modules"])

db = None

def set_db(database):
    global db
    db = database


async def verify_admin(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth_header.replace('Bearer ', '')
    try:
        secret = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        user_id = payload.get('user_id') or payload.get('sub')
        # Check if admin
        user = await db.users.find_one({"$or": [{"id": user_id}, {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id}]})
        if not user or user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Solo administradores")
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


# ═══ INVOICES ═══

@router.get("/invoices")
async def admin_list_invoices(request: Request, status: str = None, limit: int = 50, skip: int = 0):
    await verify_admin(request)
    query = {}
    if status and status != "all":
        query["status"] = status

    cursor = db.business_invoices.find(query).sort("created_at", -1).skip(skip).limit(limit)
    invoices = []
    async for inv in cursor:
        inv["id"] = str(inv.pop("_id"))
        # Get user info
        user = await db.users.find_one({"$or": [{"id": inv.get("user_id")}, {"_id": ObjectId(inv["user_id"]) if ObjectId.is_valid(inv.get("user_id", "")) else None}]})
        inv["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Desconocido"
        inv["user_email"] = user.get("email", "") if user else ""
        invoices.append(inv)

    total = await db.business_invoices.count_documents(query)
    return {"invoices": invoices, "total": total}


@router.get("/invoices/stats")
async def admin_invoice_stats(request: Request):
    await verify_admin(request)

    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total = await db.business_invoices.count_documents({})
    drafts = await db.business_invoices.count_documents({"status": "draft"})
    sent = await db.business_invoices.count_documents({"status": "sent"})
    paid = await db.business_invoices.count_documents({"status": "paid"})
    overdue = await db.business_invoices.count_documents({"status": "overdue"})

    pipeline_total_amt = [
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    pipeline_paid_amt = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    pipeline_outstanding = [
        {"$match": {"status": {"$in": ["sent", "overdue"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]

    total_amt = await db.business_invoices.aggregate(pipeline_total_amt).to_list(1)
    paid_amt = await db.business_invoices.aggregate(pipeline_paid_amt).to_list(1)
    outstanding_amt = await db.business_invoices.aggregate(pipeline_outstanding).to_list(1)

    return {
        "total": total, "drafts": drafts, "sent": sent, "paid": paid, "overdue": overdue,
        "total_amount": round(total_amt[0]["total"], 2) if total_amt else 0,
        "paid_amount": round(paid_amt[0]["total"], 2) if paid_amt else 0,
        "outstanding_amount": round(outstanding_amt[0]["total"], 2) if outstanding_amt else 0,
    }


# ═══ MILEAGE ═══

@router.get("/mileage")
async def admin_list_mileage(request: Request, year: int = None, month: int = None, limit: int = 50, skip: int = 0):
    await verify_admin(request)
    query = {}
    now = datetime.utcnow()
    if year and month:
        query["date"] = {"$regex": f"^{year}-{month:02d}"}
    elif year:
        query["date"] = {"$regex": f"^{year}-"}

    cursor = db.mileage_trips.find(query).sort("date", -1).skip(skip).limit(limit)
    trips = []
    async for trip in cursor:
        trip["id"] = str(trip.pop("_id"))
        user = await db.users.find_one({"$or": [{"id": trip.get("user_id")}, {"_id": ObjectId(trip["user_id"]) if ObjectId.is_valid(trip.get("user_id", "")) else None}]})
        trip["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Desconocido"
        trips.append(trip)

    total = await db.mileage_trips.count_documents(query)
    return {"trips": trips, "total": total}


@router.get("/mileage/stats")
async def admin_mileage_stats(request: Request):
    await verify_admin(request)

    now = datetime.utcnow()
    year_prefix = f"{now.year}-"
    month_prefix = f"{now.year}-{now.month:02d}"

    pipeline_ytd = [
        {"$match": {"date": {"$regex": f"^{year_prefix}"}}},
        {"$group": {"_id": None, "total_miles": {"$sum": "$miles"}, "total_deduction": {"$sum": "$deduction_amount"}, "trip_count": {"$sum": 1}}}
    ]
    pipeline_month = [
        {"$match": {"date": {"$regex": f"^{month_prefix}"}}},
        {"$group": {"_id": None, "total_miles": {"$sum": "$miles"}, "total_deduction": {"$sum": "$deduction_amount"}, "trip_count": {"$sum": 1}}}
    ]
    # By user
    pipeline_by_user = [
        {"$match": {"date": {"$regex": f"^{year_prefix}"}}},
        {"$group": {"_id": "$user_id", "total_miles": {"$sum": "$miles"}, "total_deduction": {"$sum": "$deduction_amount"}, "trips": {"$sum": 1}}},
        {"$sort": {"total_miles": -1}},
        {"$limit": 10}
    ]

    ytd = await db.mileage_trips.aggregate(pipeline_ytd).to_list(1)
    month = await db.mileage_trips.aggregate(pipeline_month).to_list(1)
    by_user = await db.mileage_trips.aggregate(pipeline_by_user).to_list(10)

    # Enrich with user names
    for u in by_user:
        user = await db.users.find_one({"$or": [{"id": u["_id"]}, {"_id": ObjectId(u["_id"]) if ObjectId.is_valid(u.get("_id", "")) else None}]})
        u["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Desconocido"

    return {
        "ytd": {"total_miles": round(ytd[0]["total_miles"], 1) if ytd else 0, "total_deduction": round(ytd[0]["total_deduction"], 2) if ytd else 0, "trip_count": ytd[0]["trip_count"] if ytd else 0},
        "month": {"total_miles": round(month[0]["total_miles"], 1) if month else 0, "total_deduction": round(month[0]["total_deduction"], 2) if month else 0, "trip_count": month[0]["trip_count"] if month else 0},
        "top_users": [{"user_id": u["_id"], "user_name": u["user_name"], "miles": round(u["total_miles"], 1), "deduction": round(u["total_deduction"], 2), "trips": u["trips"]} for u in by_user],
    }


# ═══ RECEIPTS ═══

@router.get("/receipts")
async def admin_list_receipts(request: Request, category: str = None, limit: int = 50, skip: int = 0):
    await verify_admin(request)
    query = {}
    if category and category != "all":
        query["category"] = category

    cursor = db.business_receipts.find(query).sort("created_at", -1).skip(skip).limit(limit)
    receipts = []
    async for r in cursor:
        r["id"] = str(r.pop("_id"))
        r.pop("image_base64", None)
        user = await db.users.find_one({"$or": [{"id": r.get("user_id")}, {"_id": ObjectId(r["user_id"]) if ObjectId.is_valid(r.get("user_id", "")) else None}]})
        r["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Desconocido"
        receipts.append(r)

    total = await db.business_receipts.count_documents(query)
    return {"receipts": receipts, "total": total}


@router.get("/receipts/stats")
async def admin_receipt_stats(request: Request):
    await verify_admin(request)

    now = datetime.utcnow()
    total = await db.business_receipts.count_documents({})

    pipeline_total = [
        {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}}
    ]
    pipeline_by_cat = [
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]

    total_amt = await db.business_receipts.aggregate(pipeline_total).to_list(1)
    by_cat = await db.business_receipts.aggregate(pipeline_by_cat).to_list(50)

    return {
        "total_receipts": total,
        "total_amount": round(total_amt[0]["total_amount"], 2) if total_amt else 0,
        "by_category": [{"category": c["_id"] or "sin_categoria", "total": round(c["total"], 2), "count": c["count"]} for c in by_cat],
    }
