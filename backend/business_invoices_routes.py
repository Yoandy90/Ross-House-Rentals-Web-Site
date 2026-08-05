"""
Business Invoices CRUD - Create, send, and track professional invoices
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/business-invoices", tags=["business-invoices"])

db = None

def set_db(database):
    global db
    db = database


IRS_STANDARD_MILEAGE_RATE = 0.70  # 2025 rate


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
async def get_invoice_stats(request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    pipeline_outstanding = [
        {"$match": {"user_id": user_id, "status": {"$in": ["sent", "overdue"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    pipeline_paid_month = [
        {"$match": {"user_id": user_id, "status": "paid", "paid_date": {"$gte": start_of_month.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    pipeline_overdue = [
        {"$match": {"user_id": user_id, "status": "overdue"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]

    outstanding = await db.business_invoices.aggregate(pipeline_outstanding).to_list(1)
    paid = await db.business_invoices.aggregate(pipeline_paid_month).to_list(1)
    overdue = await db.business_invoices.aggregate(pipeline_overdue).to_list(1)

    # Total invoices count
    total_count = await db.business_invoices.count_documents({"user_id": user_id})

    return {
        "outstanding_total": outstanding[0]["total"] if outstanding else 0,
        "outstanding_count": outstanding[0]["count"] if outstanding else 0,
        "paid_this_month": paid[0]["total"] if paid else 0,
        "paid_count": paid[0]["count"] if paid else 0,
        "overdue_total": overdue[0]["total"] if overdue else 0,
        "overdue_count": overdue[0]["count"] if overdue else 0,
        "total_invoices": total_count,
    }


@router.get("")
async def list_invoices(request: Request, status: str = None, limit: int = 50, skip: int = 0):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    query = {"user_id": user_id}
    if status and status != "all":
        query["status"] = status

    cursor = db.business_invoices.find(query).sort("created_at", -1).skip(skip).limit(limit)
    invoices = []
    async for inv in cursor:
        inv["id"] = str(inv.pop("_id"))
        invoices.append(inv)

    return invoices


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    inv = await db.business_invoices.find_one({"_id": ObjectId(invoice_id), "user_id": user_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    inv["id"] = str(inv.pop("_id"))
    return inv


@router.post("")
async def create_invoice(request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    # Auto-generate invoice number
    count = await db.business_invoices.count_documents({"user_id": user_id})
    invoice_number = body.get("invoice_number") or f"INV-{count + 1:04d}"

    # Calculate totals from items
    items = body.get("items", [])
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    tax_rate = body.get("tax_rate", 0)
    tax_amount = subtotal * (tax_rate / 100)
    total = subtotal + tax_amount

    invoice = {
        "user_id": user_id,
        "invoice_number": invoice_number,
        "status": body.get("status", "draft"),
        "client_name": body.get("client_name", ""),
        "client_email": body.get("client_email", ""),
        "client_phone": body.get("client_phone", ""),
        "business_name": body.get("business_name", ""),
        "items": items,
        "subtotal": round(subtotal, 2),
        "tax_rate": tax_rate,
        "tax_amount": round(tax_amount, 2),
        "total": round(total, 2),
        "notes": body.get("notes", ""),
        "due_date": body.get("due_date", (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")),
        "paid_date": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.business_invoices.insert_one(invoice)
    invoice["id"] = str(result.inserted_id)
    invoice.pop("_id", None)
    return invoice


@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    # Recalculate totals if items changed
    if "items" in body:
        items = body["items"]
        subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
        tax_rate = body.get("tax_rate", 0)
        tax_amount = subtotal * (tax_rate / 100)
        body["subtotal"] = round(subtotal, 2)
        body["tax_amount"] = round(tax_amount, 2)
        body["total"] = round(subtotal + tax_amount, 2)

    body["updated_at"] = datetime.utcnow()
    body.pop("id", None)
    body.pop("_id", None)

    result = await db.business_invoices.update_one(
        {"_id": ObjectId(invoice_id), "user_id": user_id},
        {"$set": body}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    return {"success": True, "message": "Factura actualizada"}


@router.put("/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.business_invoices.update_one(
        {"_id": ObjectId(invoice_id), "user_id": user_id},
        {"$set": {"status": "paid", "paid_date": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    return {"success": True, "message": "Factura marcada como pagada"}


@router.put("/{invoice_id}/send")
async def send_invoice(invoice_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.business_invoices.update_one(
        {"_id": ObjectId(invoice_id), "user_id": user_id},
        {"$set": {"status": "sent", "sent_date": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    return {"success": True, "message": "Factura enviada"}


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.business_invoices.delete_one({"_id": ObjectId(invoice_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    return {"success": True, "message": "Factura eliminada"}
