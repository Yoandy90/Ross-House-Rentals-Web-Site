"""
User Business Clients — Each app user manages their own client list
for invoicing purposes (separate from Ross Tax's client database).
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user-biz-clients", tags=["user-biz-clients"])

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
async def list_clients(request: Request, search: str = ""):
    """List all clients for the current user's business"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    query = {"user_id": user_id}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.user_business_clients.find(query).sort("name", 1)
    clients = []
    async for c in cursor:
        c["id"] = str(c.pop("_id"))
        clients.append(c)

    return clients


@router.post("")
async def create_client(request: Request):
    """Create a new business client for the user"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es requerido")

    client = {
        "user_id": user_id,
        "name": name,
        "email": body.get("email", "").strip(),
        "phone": body.get("phone", "").strip(),
        "business_name": body.get("business_name", "").strip(),
        "address": body.get("address", "").strip(),
        "notes": body.get("notes", "").strip(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.user_business_clients.insert_one(client)
    client["id"] = str(result.inserted_id)
    client.pop("_id", None)
    return client


@router.put("/{client_id}")
async def update_client(client_id: str, request: Request):
    """Update an existing business client"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    update_data = {}
    for field in ["name", "email", "phone", "business_name", "address", "notes"]:
        if field in body:
            update_data[field] = body[field].strip() if isinstance(body[field], str) else body[field]

    update_data["updated_at"] = datetime.utcnow()

    result = await db.user_business_clients.update_one(
        {"_id": ObjectId(client_id), "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return {"success": True, "message": "Cliente actualizado"}


@router.delete("/{client_id}")
async def delete_client(client_id: str, request: Request):
    """Delete a business client"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.user_business_clients.delete_one(
        {"_id": ObjectId(client_id), "user_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return {"success": True, "message": "Cliente eliminado"}
