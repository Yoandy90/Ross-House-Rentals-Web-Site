"""
Mi Caso USA - Enterprise API Routes
Provides endpoints for business/law firm accounts to manage
multiple clients and their immigration cases.
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel
import logging
import secrets

logger = logging.getLogger("immigration_enterprise")

router = APIRouter(prefix="/immigration/enterprise", tags=["Immigration-Enterprise"])

_db = None

def set_enterprise_db(db):
    global _db
    _db = db


async def get_user_from_token(request: Request) -> dict:
    """Get user from session token."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    token = auth.replace("Bearer ", "")
    session = await _db["user_sessions"].find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user_id = session["user_id"]
    try:
        user = await _db["users"].find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await _db["users"].find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def require_enterprise(request: Request) -> dict:
    """Verify user belongs to an enterprise account."""
    user = await get_user_from_token(request)
    user_id = str(user["_id"])
    enterprise = await _db["enterprises"].find_one({
        "$or": [
            {"owner_id": user_id},
            {"members.user_id": user_id}
        ]
    })
    if not enterprise:
        raise HTTPException(status_code=403, detail="No perteneces a una cuenta empresarial")
    role = "owner" if enterprise.get("owner_id") == user_id else "member"
    for m in enterprise.get("members", []):
        if m.get("user_id") == user_id:
            role = m.get("role", "member")
            break
    return {"user": user, "enterprise": enterprise, "enterprise_id": str(enterprise["_id"]), "role": role}


# ═══ REGISTRATION ═══

class EnterpriseRegister(BaseModel):
    business_name: str
    business_type: str = "law_firm"
    contact_email: str = ""
    contact_phone: str = ""

@router.post("/register")
async def register_enterprise(data: EnterpriseRegister, request: Request):
    user = await get_user_from_token(request)
    user_id = str(user["_id"])
    existing = await _db["enterprises"].find_one({"owner_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes una cuenta empresarial")
    enterprise = {
        "owner_id": user_id,
        "business_name": data.business_name,
        "business_type": data.business_type,
        "contact_email": data.contact_email or user.get("email", ""),
        "contact_phone": data.contact_phone or user.get("phone", ""),
        "plan": "business",
        "status": "active",
        "members": [],
        "clients": [],
        "invite_code": secrets.token_urlsafe(8),
        "max_cases": 50,
        "max_members": 5,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await _db["enterprises"].insert_one(enterprise)
    await _db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"enterprise_id": str(result.inserted_id), "enterprise_role": "owner"}}
    )
    return {"success": True, "enterprise_id": str(result.inserted_id), "invite_code": enterprise["invite_code"]}


# ═══ DASHBOARD ═══

@router.get("/dashboard")
async def get_enterprise_dashboard(request: Request):
    ctx = await require_enterprise(request)
    ent = ctx["enterprise"]
    client_ids = [c.get("user_id") for c in ent.get("clients", []) if c.get("user_id")]
    all_ids = list(set(filter(None, [ent["owner_id"]] + [m.get("user_id", "") for m in ent.get("members", [])] + client_ids)))
    total_cases = await _db["immigration_cases"].count_documents({"user_id": {"$in": all_ids}, "status": {"$ne": "archived"}})
    uscis = await _db["immigration_cases"].count_documents({"user_id": {"$in": all_ids}, "case_type": "uscis", "status": {"$ne": "archived"}})
    eoir = await _db["immigration_cases"].count_documents({"user_id": {"$in": all_ids}, "case_type": "eoir", "status": {"$ne": "archived"}})
    recent = []
    cursor = _db["immigration_cases"].find({"user_id": {"$in": all_ids}, "status": {"$ne": "archived"}}).sort("last_checked", -1).limit(10)
    async for c in cursor:
        client_name = ""
        for cl in ent.get("clients", []):
            if cl.get("user_id") == c.get("user_id"):
                client_name = cl.get("name", "")
                break
        recent.append({
            "case_number": c.get("display_number", c.get("case_number", "")),
            "case_type": c.get("case_type", ""),
            "current_status": c.get("current_status", ""),
            "nickname": c.get("nickname", ""),
            "client_name": client_name,
            "last_checked": c.get("last_checked", "").isoformat() if isinstance(c.get("last_checked"), datetime) else "",
        })
    return {
        "success": True,
        "dashboard": {
            "business_name": ent.get("business_name", ""),
            "plan": ent.get("plan", "business"),
            "total_cases": total_cases, "uscis_cases": uscis, "eoir_cases": eoir,
            "total_clients": len(ent.get("clients", [])),
            "total_members": len(ent.get("members", [])) + 1,
            "max_cases": ent.get("max_cases", 50),
            "max_members": ent.get("max_members", 5),
            "recent_changes": recent,
        },
    }


# ═══ TEAM ═══

class InviteMember(BaseModel):
    email: str = ""
    phone: str = ""
    role: str = "member"
    name: str = ""

@router.get("/team")
async def get_team(request: Request):
    ctx = await require_enterprise(request)
    ent = ctx["enterprise"]
    try:
        owner = await _db["users"].find_one({"_id": ObjectId(ent["owner_id"])})
    except Exception:
        owner = None
    members = [{
        "user_id": ent["owner_id"],
        "name": (owner.get("name") or owner.get("first_name", "Owner")) if owner else "Owner",
        "email": owner.get("email", "") if owner else "",
        "phone": owner.get("phone", "") if owner else "",
        "role": "owner",
        "joined_at": ent.get("created_at", "").isoformat() if isinstance(ent.get("created_at"), datetime) else "",
    }]
    for m in ent.get("members", []):
        members.append({
            "user_id": m.get("user_id", ""),
            "name": m.get("name", ""),
            "email": m.get("email", ""),
            "phone": m.get("phone", ""),
            "role": m.get("role", "member"),
            "joined_at": m.get("joined_at", "").isoformat() if isinstance(m.get("joined_at"), datetime) else "",
        })
    return {"success": True, "team": members, "invite_code": ent.get("invite_code", ""), "max_members": ent.get("max_members", 5)}


@router.post("/team/invite")
async def invite_member(data: InviteMember, request: Request):
    ctx = await require_enterprise(request)
    if ctx["role"] not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Solo owners y managers pueden invitar")
    ent = ctx["enterprise"]
    if len(ent.get("members", [])) + 1 >= ent.get("max_members", 5):
        raise HTTPException(status_code=400, detail=f"Límite de {ent.get('max_members', 5)} miembros alcanzado")
    new_member = {"user_id": "", "name": data.name, "email": data.email, "phone": data.phone, "role": data.role, "status": "invited", "joined_at": datetime.utcnow()}
    await _db["enterprises"].update_one({"_id": ObjectId(ctx["enterprise_id"])}, {"$push": {"members": new_member}})
    return {"success": True, "message": f"Invitación enviada a {data.name or data.email}"}


# ═══ CLIENTS ═══

class AddClient(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    notes: str = ""

@router.get("/clients")
async def get_clients(request: Request):
    ctx = await require_enterprise(request)
    ent = ctx["enterprise"]
    clients = []
    for cl in ent.get("clients", []):
        case_count = 0
        if cl.get("user_id"):
            case_count = await _db["immigration_cases"].count_documents({"user_id": cl["user_id"], "status": {"$ne": "archived"}})
        clients.append({
            "id": cl.get("id", ""), "user_id": cl.get("user_id", ""),
            "name": cl.get("name", ""), "phone": cl.get("phone", ""),
            "email": cl.get("email", ""), "notes": cl.get("notes", ""),
            "case_count": case_count,
            "added_at": cl.get("added_at", "").isoformat() if isinstance(cl.get("added_at"), datetime) else "",
        })
    return {"success": True, "clients": clients}


@router.post("/clients")
async def add_client(data: AddClient, request: Request):
    ctx = await require_enterprise(request)
    client = {"id": str(ObjectId()), "user_id": "", "name": data.name, "phone": data.phone, "email": data.email, "notes": data.notes, "added_at": datetime.utcnow()}
    if data.phone:
        user = await _db["users"].find_one({"phone": data.phone.replace("+1", "").replace("+", "")})
        if user:
            client["user_id"] = str(user["_id"])
    elif data.email:
        user = await _db["users"].find_one({"email": data.email})
        if user:
            client["user_id"] = str(user["_id"])
    await _db["enterprises"].update_one({"_id": ObjectId(ctx["enterprise_id"])}, {"$push": {"clients": client}})
    return {"success": True, "client_id": client["id"], "message": f"Cliente {data.name} agregado"}


# ═══ ENTERPRISE CASES ═══

@router.get("/cases")
async def get_enterprise_cases(request: Request):
    ctx = await require_enterprise(request)
    ent = ctx["enterprise"]
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 25))
    search = request.query_params.get("search", "").strip()
    case_type = request.query_params.get("type", "")
    client_ids = [c.get("user_id") for c in ent.get("clients", []) if c.get("user_id")]
    all_ids = list(set(filter(None, [ent["owner_id"]] + [m.get("user_id", "") for m in ent.get("members", [])] + client_ids)))
    query = {"user_id": {"$in": all_ids}, "status": {"$ne": "archived"}}
    if search:
        query["$or"] = [{"case_number": {"$regex": search, "$options": "i"}}, {"display_number": {"$regex": search, "$options": "i"}}, {"nickname": {"$regex": search, "$options": "i"}}]
    if case_type:
        query["case_type"] = case_type
    total = await _db["immigration_cases"].count_documents(query)
    cases = []
    cursor = _db["immigration_cases"].find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    async for c in cursor:
        client_name = ""
        for cl in ent.get("clients", []):
            if cl.get("user_id") == c.get("user_id"):
                client_name = cl.get("name", "")
                break
        cases.append({
            "id": str(c["_id"]), "case_type": c.get("case_type", "uscis"),
            "case_number": c.get("case_number", ""), "display_number": c.get("display_number", ""),
            "current_status": c.get("current_status", ""), "nickname": c.get("nickname", ""),
            "form_type": c.get("form_type", ""), "client_name": client_name,
            "created_at": c.get("created_at", "").isoformat() if isinstance(c.get("created_at"), datetime) else "",
            "last_checked": c.get("last_checked", "").isoformat() if isinstance(c.get("last_checked"), datetime) else "",
            "history_count": len(c.get("history", [])),
        })
    return {"success": True, "cases": cases, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}
