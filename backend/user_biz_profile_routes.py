"""
User Business Profile — Stores the user's business info (name, phone, address, logo)
for auto-filling invoices. Each user has ONE business profile.
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user-biz-profile", tags=["user-biz-profile"])

db = None

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


@router.get("")
async def get_profile(request: Request):
    """Get the user's business profile. If none exists, auto-populate from bk_businesses."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    profile = await db.user_business_profiles.find_one({"user_id": user_id})

    if not profile:
        # Try to auto-populate from bookkeeping business data
        biz = await db.bk_businesses.find_one({
            "$or": [
                {"linked_client_id": user_id},
            ],
            "status": "active"
        })

        # Also try by user email
        if not biz:
            user_doc = await db.users.find_one({"id": user_id})
            if user_doc:
                user_email = user_doc.get("email", "")
                if user_email:
                    biz = await db.bk_businesses.find_one({
                        "owner_email": {"$regex": user_email, "$options": "i"},
                        "status": "active"
                    })

        if biz:
            # Build address from parts
            address_parts = [biz.get("address", "")]
            city = biz.get("city", "")
            state = biz.get("state", "")
            zip_code = biz.get("zip_code", "")
            if city or state or zip_code:
                address_parts.append(f"{city}, {state} {zip_code}".strip())
            full_address = ", ".join([p for p in address_parts if p])

            return {
                "business_name": biz.get("business_name", ""),
                "business_phone": biz.get("owner_phone", ""),
                "business_address": full_address,
                "business_logo": "",
                "default_tax_rate": 0,
                "default_notes": "",
                "payment_methods": [],
                "_auto_populated": True,  # Flag to indicate this came from bk_businesses
            }

        return {
            "business_name": "",
            "business_phone": "",
            "business_address": "",
            "business_logo": "",
            "default_tax_rate": 0,
            "default_notes": "",
            "payment_methods": [],
        }

    profile["id"] = str(profile.pop("_id"))
    # Ensure payment_methods field exists for older profiles
    if "payment_methods" not in profile:
        profile["payment_methods"] = []
    return profile


@router.put("")
async def save_profile(request: Request):
    """Create or update the user's business profile"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    # payment_methods is a list of {type, handle, label}
    # e.g. [{"type": "cashapp", "handle": "$myuser"}, {"type": "zelle", "handle": "myemail@gmail.com"}]
    payment_methods = body.get("payment_methods", [])

    profile_data = {
        "user_id": user_id,
        "business_name": body.get("business_name", "").strip(),
        "business_phone": body.get("business_phone", "").strip(),
        "business_address": body.get("business_address", "").strip(),
        "business_logo": body.get("business_logo", ""),  # base64 image
        "default_tax_rate": body.get("default_tax_rate", 0),
        "default_notes": body.get("default_notes", "").strip(),
        "payment_methods": payment_methods,
        "updated_at": datetime.utcnow(),
    }

    # Upsert - create if not exists, update if exists
    result = await db.user_business_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_data, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )

    return {"success": True, "message": "Perfil actualizado"}
