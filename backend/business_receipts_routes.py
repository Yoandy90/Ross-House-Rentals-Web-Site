"""
Business Receipts CRUD — Independent receipt management for Mi Negocio
Separate collection from personal receipts (classified_receipts)
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/business-receipts", tags=["business-receipts"])

db = None

BUSINESS_CATEGORIES = [
    "office_expense", "supplies", "meals", "car_expenses", "utilities",
    "rent_lease", "travel", "insurance", "repairs", "advertising",
    "contract_labor", "cogs", "equipment", "phone_internet",
    "professional_services", "other_expense"
]

def set_db(database):
    global db
    db = database


async def get_current_user_id(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.replace('Bearer ', '')
    try:
        secret = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload.get('user_id') or payload.get('sub')
    except Exception:
        return None


@router.get("/stats")
async def get_receipt_stats(request: Request, year: int = None):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    now = datetime.utcnow()
    target_year = year or now.year

    match_q = {"user_id": user_id, "year": target_year}

    # By category
    pipeline = [
        {"$match": match_q},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]

    categories = await db.business_receipts.aggregate(pipeline).to_list(50)
    total = await db.business_receipts.count_documents(match_q)

    pipeline_total = [
        {"$match": match_q},
        {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}}
    ]
    total_amt = await db.business_receipts.aggregate(pipeline_total).to_list(1)

    # Monthly breakdown
    pipeline_monthly = [
        {"$match": match_q},
        {"$group": {
            "_id": "$month",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    monthly = await db.business_receipts.aggregate(pipeline_monthly).to_list(12)

    return {
        "total_receipts": total,
        "total_amount": round(total_amt[0]["total_amount"], 2) if total_amt else 0,
        "by_category": [{"category": c["_id"], "total": round(c["total"], 2), "count": c["count"]} for c in categories],
        "monthly": [{"month": m["_id"], "total": round(m["total"], 2), "count": m["count"]} for m in monthly],
        "year": target_year,
    }


@router.get("")
async def list_receipts(request: Request, year: int = None, category: str = None, limit: int = 50, skip: int = 0):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    now = datetime.utcnow()
    query = {"user_id": user_id, "year": year or now.year}
    if category and category != "all":
        query["category"] = category

    cursor = db.business_receipts.find(query).sort("date", -1).skip(skip).limit(limit)
    receipts = []
    async for r in cursor:
        r["id"] = str(r.pop("_id"))
        r.pop("image_base64", None)  # Don't send image in list
        receipts.append(r)

    total = await db.business_receipts.count_documents(query)
    return {"receipts": receipts, "total": total}


@router.get("/{receipt_id}")
async def get_receipt(receipt_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    r = await db.business_receipts.find_one({"_id": ObjectId(receipt_id), "user_id": user_id})
    if not r:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")
    r["id"] = str(r.pop("_id"))
    return r


@router.post("")
async def create_receipt(request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    now = datetime.utcnow()

    date_str = body.get("date", now.strftime("%Y-%m-%d"))
    parts = date_str.split("-")
    yr = int(parts[0]) if len(parts) >= 1 else now.year
    mo = int(parts[1]) if len(parts) >= 2 else now.month

    receipt = {
        "user_id": user_id,
        "merchant": body.get("merchant", ""),
        "amount": round(float(body.get("amount", 0)), 2),
        "category": body.get("category", "other_expense"),
        "date": date_str,
        "year": yr,
        "month": mo,
        "notes": body.get("notes", ""),
        "image_base64": body.get("image_base64", None),
        "tax_deductible": body.get("tax_deductible", True),
        "created_at": now,
    }

    result = await db.business_receipts.insert_one(receipt)
    receipt["id"] = str(result.inserted_id)
    receipt.pop("_id", None)
    receipt.pop("image_base64", None)
    return receipt


@router.put("/{receipt_id}")
async def update_receipt(receipt_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    body.pop("id", None)
    body.pop("_id", None)
    body.pop("user_id", None)

    if "amount" in body:
        body["amount"] = round(float(body["amount"]), 2)
    if "date" in body:
        parts = body["date"].split("-")
        body["year"] = int(parts[0]) if len(parts) >= 1 else datetime.utcnow().year
        body["month"] = int(parts[1]) if len(parts) >= 2 else datetime.utcnow().month

    body["updated_at"] = datetime.utcnow()

    result = await db.business_receipts.update_one(
        {"_id": ObjectId(receipt_id), "user_id": user_id},
        {"$set": body}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    return {"success": True, "message": "Recibo actualizado"}


@router.delete("/{receipt_id}")
async def delete_receipt(receipt_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.business_receipts.delete_one({"_id": ObjectId(receipt_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    return {"success": True, "message": "Recibo eliminado"}
