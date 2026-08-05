"""
Receipt Generator Module
Creates printable receipts with store templates (Walmart, Love's, Shell, etc.)
For expense documentation and tax purposes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import os, random, string

from dotenv import load_dotenv
load_dotenv()

receipt_generator_router = APIRouter()

# ─── DB helper ───────────────────────────────────────────────────────────
_db = None

def _get_db():
    global _db
    if _db is None:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
        _db = client[os.getenv("DB_NAME", "taxportal")]
    return _db

# ─── Auth helper ─────────────────────────────────────────────────────────
async def _require_admin(authorization: str = None):
    if not authorization:
        from fastapi import Header
        raise HTTPException(401, "Token requerido")
    try:
        from server import get_user_from_token
        token = authorization.replace("Bearer ", "")
        user = await get_user_from_token(token)
        if not user or user.get("role") not in ["admin", "super_admin", "office_assistant"]:
            raise HTTPException(403, "No autorizado")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Token inválido")


# ─── Models ──────────────────────────────────────────────────────────────
class ReceiptItem(BaseModel):
    description: str
    qty: float = 1
    unit_price: float
    sku: Optional[str] = None
    tax_code: Optional[str] = "T"  # T = taxable, N = non-taxable

class CreateReceiptRequest(BaseModel):
    template_id: str  # walmart, loves, shell, restaurant, generic, ross_tax
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_phone: Optional[str] = None
    store_number: Optional[str] = None
    register_number: Optional[str] = None
    cashier_name: Optional[str] = None
    transaction_date: Optional[str] = None  # ISO date string
    transaction_time: Optional[str] = None  # HH:MM format
    items: List[ReceiptItem] = []
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = "VISA"  # VISA, MASTERCARD, CASH, DEBIT, AMEX, EBT_SNAP, EBT_CASH
    card_last4: Optional[str] = "1234"
    language: Optional[str] = "en"
    custom_header: Optional[str] = None
    custom_footer: Optional[str] = None
    notes: Optional[str] = None
    client_name: Optional[str] = None  # For internal tracking
    # Walmart-specific fields
    manager_name: Optional[str] = None
    op_number: Optional[str] = None
    te_number: Optional[str] = None
    tr_number: Optional[str] = None
    tc_number: Optional[str] = None
    items_sold_count: Optional[int] = None
    # Love's fuel-specific fields
    pump_number: Optional[str] = None
    gallons: Optional[float] = None
    price_per_gallon: Optional[float] = None
    fuel_product: Optional[str] = None  # Super, Diesel, Unleaded, Premium
    aid_code: Optional[str] = None  # e.g. A0000000041010
    app_label: Optional[str] = None  # e.g. Debit Mastercard
    approval_code: Optional[str] = None
    ticket_number: Optional[str] = None
    sale_type: Optional[str] = None  # Tap, Swipe, Chip
    verification_method: Optional[str] = None  # Verified by PIN, Signature
    diesel_tax_per_gallon: Optional[float] = None
    renewable_blend_pct: Optional[int] = None  # e.g. 20
    # EBT / Split payment fields
    ebt_snap_amount: Optional[float] = None
    cash_tendered: Optional[float] = None
    change_due: Optional[float] = None
    rounding: Optional[float] = None
    ebt_account_last4: Optional[str] = None
    ebt_ref_number: Optional[str] = None
    ebt_approval_code: Optional[str] = None
    ebt_terminal: Optional[str] = None
    ebt_snap_beg_bal: Optional[float] = None
    ebt_snap_end_bal: Optional[float] = None
    ebt_cash_beg_bal: Optional[float] = None
    ebt_cash_end_bal: Optional[float] = None
    survey_id: Optional[str] = None

class UpdateReceiptRequest(BaseModel):
    template_id: Optional[str] = None
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_phone: Optional[str] = None
    store_number: Optional[str] = None
    register_number: Optional[str] = None
    cashier_name: Optional[str] = None
    transaction_date: Optional[str] = None
    transaction_time: Optional[str] = None
    items: Optional[List[ReceiptItem]] = None
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = None
    card_last4: Optional[str] = None
    language: Optional[str] = None
    custom_header: Optional[str] = None
    custom_footer: Optional[str] = None
    notes: Optional[str] = None
    client_name: Optional[str] = None


# ─── Template Definitions ────────────────────────────────────────────────
RECEIPT_TEMPLATES = {
    "walmart": {
        "id": "walmart",
        "name": "Walmart Supercenter",
        "icon": "🏪",
        "category": "retail",
        "default_store_name": "Walmart",
        "default_address": "2003 S DUMAS AVE\nDUMAS TX 79029",
        "default_phone": "806-935-9075",
        "default_tax_rate": 8.25,
        "default_manager": "JOSE",
        "default_store_num": "00812",
        "default_op_num": "009006",
        "default_te_num": "06",
        "header_style": "walmart_real",
        "has_barcode": True,
        "has_store_number": True,
        "has_register": True,
        "footer_text": "Low prices You Can Trust. Every Day.",
        "promo_text": "Get 50% off membership\nEnjoy free delivery\n& more with\nWalmart+ Assist.\nScan to start a trial.",
        "survey_url": "survey.walmart.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "GRN LEAF FIL", "qty": 1, "unit_price": 3.07, "sku": "716519090020", "tax_code": "N"},
            {"description": "12CT CUPCKE", "qty": 1, "unit_price": 5.94, "sku": "078742981030", "tax_code": "N"},
            {"description": "FAJITA BLEND", "qty": 1, "unit_price": 2.97, "sku": "681131093020", "tax_code": "N"},
            {"description": "COLESLAW", "qty": 1, "unit_price": 1.97, "sku": "681131387480", "tax_code": "N"},
            {"description": "COLESLAW", "qty": 1, "unit_price": 1.97, "sku": "681131387480", "tax_code": "N"},
            {"description": "2LB TILAPIA", "qty": 1, "unit_price": 8.87, "sku": "078742126620", "tax_code": "N"},
            {"description": "SLMN SKNLS 2", "qty": 1, "unit_price": 19.97, "sku": "194346135610", "tax_code": "N"},
            {"description": "TOMATO GRAPE", "qty": 1, "unit_price": 6.77, "sku": "751666776050", "tax_code": "N"},
            {"description": "BNLS CK BRST", "qty": 1, "unit_price": 11.72, "sku": "261638000000", "tax_code": "N"},
            {"description": "POTATOES", "qty": 1, "unit_price": 3.64, "sku": "033383530320", "tax_code": "N"},
            {"description": "HVRANCH 36OZ", "qty": 1, "unit_price": 6.97, "sku": "071100006680", "tax_code": "N"},
            {"description": "JUMEX NECTAR", "qty": 1, "unit_price": 3.38, "sku": "076406065500", "tax_code": "T"},
        ]
    },
    "loves": {
        "id": "loves",
        "name": "Love's Travel Stop",
        "icon": "⛽",
        "category": "gas_station",
        "default_store_name": "Love's",
        "default_address": "",
        "default_phone": "",
        "default_tax_rate": 0,
        "default_store_num": "626",
        "default_pump_number": "01",
        "default_gallons": 9.790,
        "default_price_per_gallon": 4.469,
        "default_fuel_product": "Super",
        "default_aid_code": "A0000000041010",
        "default_app_label": "Debit Mastercard",
        "default_sale_type": "Tap",
        "default_verification_method": "Verified by PIN",
        "default_diesel_tax": 0.16,
        "default_renewable_blend_pct": 20,
        "header_style": "loves_fuel",
        "has_barcode": False,
        "has_store_number": True,
        "has_register": False,
        "footer_text": "DID YOU LOVE IT?\nTell us more at\nLoves.com/survey",
        "font_family": "monospace",
        "sample_items": [
            {"description": "Super", "qty": 9.790, "unit_price": 4.469, "sku": "", "tax_code": "N"},
        ]
    },
    "shell": {
        "id": "shell",
        "name": "Shell Gas Station",
        "icon": "⛽",
        "category": "gas_station",
        "default_store_name": "Shell",
        "default_address": "5678 Highway Blvd",
        "default_phone": "(555) 456-7890",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": False,
        "has_store_number": True,
        "has_register": True,
        "footer_text": "Thank you for choosing Shell!\nFuel Rewards Member? Save more!\nwww.shell.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "REGULAR UNLEADED", "qty": 12.567, "unit_price": 3.099, "sku": "", "tax_code": "T"},
        ]
    },
    "home_depot": {
        "id": "home_depot",
        "name": "The Home Depot",
        "icon": "🔨",
        "category": "retail",
        "default_store_name": "The Home Depot",
        "default_address": "2000 Commerce Dr",
        "default_phone": "(555) 321-0987",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": True,
        "has_store_number": True,
        "has_register": True,
        "footer_text": "More saving. More doing.\nReturn Policy: 90 days\nwww.homedepot.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "2x4x8 LUMBER STD", "qty": 5, "unit_price": 3.98, "sku": "161640", "tax_code": "T"},
            {"description": "DRYWALL SCREW 1LB", "qty": 1, "unit_price": 8.97, "sku": "202345", "tax_code": "T"},
            {"description": "PAINT ROLLER 9IN", "qty": 2, "unit_price": 6.48, "sku": "305678", "tax_code": "T"},
        ]
    },
    "restaurant": {
        "id": "restaurant",
        "name": "Restaurant / Comida",
        "icon": "🍽️",
        "category": "food",
        "default_store_name": "Restaurant",
        "default_address": "123 Food Ave",
        "default_phone": "(555) 111-2222",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": False,
        "has_store_number": False,
        "has_register": False,
        "footer_text": "Thank you for dining with us!\nPlease visit us again",
        "font_family": "monospace",
        "sample_items": [
            {"description": "CHICKEN PLATE", "qty": 1, "unit_price": 12.99, "sku": "", "tax_code": "T"},
            {"description": "ICED TEA LG", "qty": 2, "unit_price": 2.99, "sku": "", "tax_code": "T"},
            {"description": "SIDE SALAD", "qty": 1, "unit_price": 4.50, "sku": "", "tax_code": "T"},
        ]
    },
    "dollar_general": {
        "id": "dollar_general",
        "name": "Dollar General",
        "icon": "💲",
        "category": "retail",
        "default_store_name": "Dollar General",
        "default_address": "900 Budget Lane",
        "default_phone": "(555) 333-4444",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": True,
        "has_store_number": True,
        "has_register": True,
        "footer_text": "Save time. Save money.\nEvery day!\nwww.dollargeneral.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "PAPER PLATES 50CT", "qty": 1, "unit_price": 3.50, "sku": "890123", "tax_code": "T"},
            {"description": "AA BATTERIES 8PK", "qty": 1, "unit_price": 5.00, "sku": "890456", "tax_code": "T"},
        ]
    },
    "autozone": {
        "id": "autozone",
        "name": "AutoZone",
        "icon": "🔧",
        "category": "automotive",
        "default_store_name": "AutoZone",
        "default_address": "456 Motor Blvd",
        "default_phone": "(555) 777-8888",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": True,
        "has_store_number": True,
        "has_register": True,
        "footer_text": "Get in the Zone - AutoZone!\nCore charge refund available\nwww.autozone.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "MOTOR OIL 5W30 5QT", "qty": 1, "unit_price": 24.99, "sku": "SYN5301", "tax_code": "T"},
            {"description": "OIL FILTER", "qty": 1, "unit_price": 7.99, "sku": "FLT4967", "tax_code": "T"},
        ]
    },
    "generic": {
        "id": "generic",
        "name": "Recibo Genérico",
        "icon": "🧾",
        "category": "other",
        "default_store_name": "Store Name",
        "default_address": "Store Address",
        "default_phone": "(555) 000-0000",
        "default_tax_rate": 8.25,
        "header_style": "center_bold",
        "has_barcode": False,
        "has_store_number": False,
        "has_register": False,
        "footer_text": "Thank you for your purchase!",
        "font_family": "monospace",
        "sample_items": [
            {"description": "ITEM 1", "qty": 1, "unit_price": 10.00, "sku": "", "tax_code": "T"},
        ]
    },
    "ross_tax": {
        "id": "ross_tax",
        "name": "Ross Tax Preparation",
        "icon": "📋",
        "category": "service",
        "default_store_name": "Ross Tax Preparation LLC",
        "default_address": "305 Bruce Ave, Dumas, TX 79029",
        "default_phone": "(806) 934-2018",
        "default_tax_rate": 0,
        "header_style": "center_bold",
        "has_barcode": False,
        "has_store_number": False,
        "has_register": False,
        "footer_text": "Thank you for choosing Ross Tax!\ninfo@rosstaxpreparation.com\nrosstaxpreparation.com",
        "font_family": "monospace",
        "sample_items": [
            {"description": "TAX PREPARATION 1040", "qty": 1, "unit_price": 250.00, "sku": "", "tax_code": "N"},
            {"description": "STATE FILING FEE", "qty": 1, "unit_price": 50.00, "sku": "", "tax_code": "N"},
        ]
    }
}


# ─── Routes ──────────────────────────────────────────────────────────────

@receipt_generator_router.get("/admin/recibos/templates")
async def get_templates(authorization: str = Header(None)):
    """Return all available receipt templates"""
    user = await _require_admin(authorization)
    
    templates = []
    for tid, t in RECEIPT_TEMPLATES.items():
        templates.append({
            "id": t["id"],
            "name": t["name"],
            "icon": t["icon"],
            "category": t["category"],
            "has_barcode": t["has_barcode"],
            "default_store_name": t["default_store_name"],
            "default_tax_rate": t["default_tax_rate"],
            "sample_items": t.get("sample_items", []),
        })
    return {"templates": templates}


@receipt_generator_router.get("/admin/recibos")
async def list_receipts(
    authorization: str = Header(None),
    search: str = "",
    template_id: str = "",
    limit: int = 50,
    skip: int = 0
):
    """List saved receipts with optional filters"""
    user = await _require_admin(authorization)
    db = _get_db()
    
    query = {}
    if search:
        query["$or"] = [
            {"store_name": {"$regex": search, "$options": "i"}},
            {"client_name": {"$regex": search, "$options": "i"}},
            {"receipt_number": {"$regex": search, "$options": "i"}},
        ]
    if template_id:
        query["template_id"] = template_id
    
    cursor = db.receipts.find(query).sort("created_at", -1).skip(skip).limit(limit)
    receipts = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        receipts.append(r)
    
    total = await db.receipts.count_documents(query)
    
    return {"receipts": receipts, "total": total}


@receipt_generator_router.post("/admin/recibos")
async def create_receipt(data: CreateReceiptRequest, authorization: str = Header(None)):
    """Create and save a new receipt"""
    user = await _require_admin(authorization)
    db = _get_db()
    
    # Generate receipt number
    count = await db.receipts.count_documents({})
    receipt_number = f"REC-{datetime.utcnow().strftime('%Y')}-{str(count + 1).zfill(4)}"
    
    # Get template defaults
    template = RECEIPT_TEMPLATES.get(data.template_id, RECEIPT_TEMPLATES["generic"])
    
    # Calculate totals if not provided
    items_data = [item.dict() for item in data.items]
    
    subtotal = data.subtotal
    if subtotal is None:
        subtotal = sum(item.qty * item.unit_price for item in data.items)
    
    tax_rate = data.tax_rate if data.tax_rate is not None else template["default_tax_rate"]
    
    taxable_subtotal = sum(
        item.qty * item.unit_price for item in data.items 
        if item.tax_code == "T"
    )
    
    tax_amount = data.tax_amount
    if tax_amount is None:
        tax_amount = round(taxable_subtotal * (tax_rate / 100), 2)
    
    total = data.total
    if total is None:
        total = round(subtotal + tax_amount, 2)
    
    # Generate transaction ID
    txn_id = ''.join(random.choices(string.digits, k=12))
    
    receipt_doc = {
        "receipt_number": receipt_number,
        "template_id": data.template_id,
        "store_name": data.store_name or template["default_store_name"],
        "store_address": data.store_address or template["default_address"],
        "store_phone": data.store_phone or template["default_phone"],
        "store_number": data.store_number or f"#{random.randint(1000, 9999)}",
        "register_number": data.register_number or str(random.randint(1, 20)),
        "cashier_name": data.cashier_name or "",
        "transaction_date": data.transaction_date or datetime.utcnow().strftime("%m/%d/%Y"),
        "transaction_time": data.transaction_time or datetime.utcnow().strftime("%I:%M %p"),
        "transaction_id": txn_id,
        "items": items_data,
        "subtotal": round(subtotal, 2),
        "tax_rate": tax_rate,
        "taxable_subtotal": round(taxable_subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "total": round(total, 2),
        "payment_method": data.payment_method or "VISA",
        "card_last4": data.card_last4 or "1234",
        "language": data.language or "en",
        "custom_header": data.custom_header or "",
        "custom_footer": data.custom_footer or "",
        "notes": data.notes or "",
        "client_name": data.client_name or "",
        # Walmart-specific fields
        "manager_name": data.manager_name or template.get("default_manager", ""),
        "op_number": data.op_number or template.get("default_op_num", ""),
        "te_number": data.te_number or template.get("default_te_num", ""),
        "tr_number": data.tr_number or f"{random.randint(1000, 99999):05d}",
        "tc_number": data.tc_number or f"{random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)}",
        "items_sold_count": data.items_sold_count or len([i for i in items_data if i.get("description", "").strip()]),
        "survey_id": data.survey_id or ''.join(random.choices(string.ascii_uppercase + string.digits, k=11)),
        # Love's fuel-specific fields
        "pump_number": data.pump_number or template.get("default_pump_number", ""),
        "gallons": data.gallons or template.get("default_gallons"),
        "price_per_gallon": data.price_per_gallon or template.get("default_price_per_gallon"),
        "fuel_product": data.fuel_product or template.get("default_fuel_product", ""),
        "aid_code": data.aid_code or template.get("default_aid_code", ""),
        "app_label": data.app_label or template.get("default_app_label", ""),
        "approval_code": data.approval_code or f"{'#' * 8}{data.card_last4 or '1234'}",
        "ticket_number": data.ticket_number or str(random.randint(10000, 99999)),
        "sale_type": data.sale_type or template.get("default_sale_type", ""),
        "verification_method": data.verification_method or template.get("default_verification_method", ""),
        "diesel_tax_per_gallon": data.diesel_tax_per_gallon or template.get("default_diesel_tax"),
        "renewable_blend_pct": data.renewable_blend_pct or template.get("default_renewable_blend_pct"),
        # EBT / Split payment fields
        "ebt_snap_amount": data.ebt_snap_amount,
        "cash_tendered": data.cash_tendered,
        "change_due": data.change_due,
        "rounding": data.rounding,
        "ebt_account_last4": data.ebt_account_last4 or "",
        "ebt_ref_number": data.ebt_ref_number or "",
        "ebt_approval_code": data.ebt_approval_code or "",
        "ebt_terminal": data.ebt_terminal or "",
        "ebt_snap_beg_bal": data.ebt_snap_beg_bal,
        "ebt_snap_end_bal": data.ebt_snap_end_bal,
        "ebt_cash_beg_bal": data.ebt_cash_beg_bal,
        "ebt_cash_end_bal": data.ebt_cash_end_bal,
        "template_config": {
            "has_barcode": template.get("has_barcode", False),
            "footer_text": template.get("footer_text", ""),
            "promo_text": template.get("promo_text", ""),
            "survey_url": template.get("survey_url", ""),
            "header_style": template.get("header_style", "center_bold"),
        },
        "created_by": user.get("email", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    result = await db.receipts.insert_one(receipt_doc)
    receipt_doc["_id"] = str(result.inserted_id)
    
    return {"success": True, "receipt": receipt_doc, "receipt_id": str(result.inserted_id)}


@receipt_generator_router.get("/admin/recibos/{receipt_id}")
async def get_receipt(receipt_id: str, authorization: str = Header(None)):
    """Get a single receipt by ID"""
    user = await _require_admin(authorization)
    db = _get_db()
    
    try:
        receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")
    
    if not receipt:
        raise HTTPException(404, "Recibo no encontrado")
    
    receipt["_id"] = str(receipt["_id"])
    return receipt


@receipt_generator_router.put("/admin/recibos/{receipt_id}")
async def update_receipt(receipt_id: str, data: UpdateReceiptRequest, authorization: str = Header(None)):
    """Update an existing receipt"""
    user = await _require_admin(authorization)
    db = _get_db()
    
    try:
        receipt = await db.receipts.find_one({"_id": ObjectId(receipt_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")
    
    if not receipt:
        raise HTTPException(404, "Recibo no encontrado")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Recalculate if items changed
    if "items" in update_data:
        items = update_data["items"]
        subtotal = sum(i["qty"] * i["unit_price"] for i in items)
        tax_rate = update_data.get("tax_rate", receipt.get("tax_rate", 8.25))
        taxable = sum(i["qty"] * i["unit_price"] for i in items if i.get("tax_code") == "T")
        tax_amount = round(taxable * (tax_rate / 100), 2)
        update_data["subtotal"] = round(subtotal, 2)
        update_data["taxable_subtotal"] = round(taxable, 2)
        update_data["tax_amount"] = tax_amount
        update_data["total"] = round(subtotal + tax_amount, 2)
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    await db.receipts.update_one({"_id": ObjectId(receipt_id)}, {"$set": update_data})
    
    return {"success": True, "message": "Recibo actualizado"}


@receipt_generator_router.delete("/admin/recibos/{receipt_id}")
async def delete_receipt(receipt_id: str, authorization: str = Header(None)):
    """Delete a receipt"""
    user = await _require_admin(authorization)
    db = _get_db()
    
    try:
        result = await db.receipts.delete_one({"_id": ObjectId(receipt_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")
    
    if result.deleted_count == 0:
        raise HTTPException(404, "Recibo no encontrado")
    
    return {"success": True, "message": "Recibo eliminado"}
