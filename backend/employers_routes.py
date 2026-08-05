"""
Employers Database Routes
CRUD for employer records + public autocomplete search
"""
import logging
from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

employers_router = APIRouter()
_db = None


def init_employers_router(db):
    global _db
    _db = db
    logger.info("🏢 Employers router initialized")


async def _get_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    user = await _db.users.find_one({"session_token": token})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


async def _require_admin(authorization: Optional[str] = Header(None)):
    user = await _get_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ═══ PUBLIC: Autocomplete search ═══
@employers_router.get("/employers/search")
async def search_employers(
    q: str = Query("", min_length=1),
    limit: int = Query(10, le=50),
):
    """Public endpoint for autocomplete. Returns employer names matching the query."""
    if not q or len(q) < 1:
        return {"employers": []}

    results = await _db.employers.find(
        {
            "name": {"$regex": q, "$options": "i"},
            "active": {"$ne": False},
        },
        {"_id": 0, "name": 1, "industry": 1, "city": 1},
    ).sort("name", 1).limit(limit).to_list(limit)

    return {"employers": results}


# ═══ ADMIN: List all employers ═══
@employers_router.get("/admin/employers")
async def list_employers(
    search: str = "",
    page: int = 1,
    limit: int = 50,
    authorization: Optional[str] = Header(None),
):
    await _require_admin(authorization)
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"industry": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
        ]

    total = await _db.employers.count_documents(query)
    skip = (page - 1) * limit
    items = await _db.employers.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)

    for item in items:
        item["_id"] = str(item["_id"])

    return {"employers": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


# ═══ ADMIN: Create employer ═══
class EmployerCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = "TX"
    phone: Optional[str] = ""
    industry: Optional[str] = ""
    contact_person: Optional[str] = ""
    notes: Optional[str] = ""


@employers_router.post("/admin/employers")
async def create_employer(body: EmployerCreate, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    # Check for duplicate name
    existing = await _db.employers.find_one({"name": {"$regex": f"^{body.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=409, detail=f"Employer '{body.name}' already exists")

    doc = {
        **body.dict(),
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "loan_count": 0,
    }
    result = await _db.employers.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    logger.info(f"🏢 Employer created: {body.name}")
    return {"success": True, "employer": doc}


# ═══ ADMIN: Update employer ═══
@employers_router.put("/admin/employers/{employer_id}")
async def update_employer(employer_id: str, body: EmployerCreate, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    existing = await _db.employers.find_one({"_id": ObjectId(employer_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Employer not found")

    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    await _db.employers.update_one({"_id": ObjectId(employer_id)}, {"$set": update_data})

    logger.info(f"🏢 Employer updated: {body.name}")
    return {"success": True, "message": "Employer updated"}


# ═══ ADMIN: Delete employer ═══
@employers_router.delete("/admin/employers/{employer_id}")
async def delete_employer(employer_id: str, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    result = await _db.employers.delete_one({"_id": ObjectId(employer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employer not found")

    logger.info(f"🏢 Employer deleted: {employer_id}")
    return {"success": True, "message": "Employer deleted"}
