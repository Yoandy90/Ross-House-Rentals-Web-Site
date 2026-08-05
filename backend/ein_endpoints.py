"""
EIN (Employer Identification Number) Database Endpoints
Allows storing, searching, and managing employer EINs for tax preparation.
Builds an internal database from W-2s and transcripts processed over time.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
import re
import logging

router = APIRouter(prefix="/ein", tags=["EIN Database"])

# Module-level references
_db: Optional[AsyncIOMotorDatabase] = None
_get_current_user = None
_require_admin = None


def init_ein_endpoints(db, get_current_user, require_admin):
    global _db, _get_current_user, _require_admin
    _db = db
    _get_current_user = get_current_user
    _require_admin = require_admin


def get_db():
    return _db


# ================== MODELS ==================

class EINCreate(BaseModel):
    employer_name: str
    ein: str  # Format: XX-XXXXXXX or XXXXXXXXX
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = "manual"  # manual, w2, transcript, import


class EINUpdate(BaseModel):
    employer_name: Optional[str] = None
    ein: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None


class EINBulkImport(BaseModel):
    records: List[EINCreate]


# ================== HELPERS ==================

def normalize_ein(ein: str) -> str:
    """Remove dashes and spaces, return 9-digit string."""
    return re.sub(r'[\s\-]', '', ein)


def format_ein(ein: str) -> str:
    """Format as XX-XXXXXXX."""
    clean = normalize_ein(ein)
    if len(clean) == 9:
        return f"{clean[:2]}-{clean[2:]}"
    return ein


def validate_ein(ein: str) -> bool:
    """Validate EIN is 9 digits."""
    clean = normalize_ein(ein)
    return bool(re.match(r'^\d{9}$', clean))


def serialize_doc(doc):
    """Convert MongoDB doc to JSON-serializable dict."""
    if doc:
        doc['_id'] = str(doc['_id'])
        # Convert datetime objects to ISO strings
        for key in ['created_at', 'updated_at']:
            if key in doc and hasattr(doc[key], 'isoformat'):
                doc[key] = doc[key].isoformat()
    return doc


# ================== ENDPOINTS ==================

@router.post("")
async def create_ein(data: EINCreate, user=Depends(lambda: _get_current_user)):
    """Add a new employer EIN to the database."""
    db = get_db()
    
    clean_ein = normalize_ein(data.ein)
    if not validate_ein(clean_ein):
        raise HTTPException(400, "EIN inválido. Debe contener 9 dígitos.")
    
    # Check for duplicate
    existing = await db.employer_eins.find_one({"ein_normalized": clean_ein})
    if existing:
        raise HTTPException(409, f"EIN {format_ein(clean_ein)} ya existe para: {existing.get('employer_name')}")
    
    doc = {
        "employer_name": data.employer_name.strip().upper(),
        "ein": format_ein(clean_ein),
        "ein_normalized": clean_ein,
        "ein_last4": clean_ein[-4:],
        "address": data.address.strip() if data.address else "",
        "city": data.city.strip().upper() if data.city else "",
        "state": data.state.strip().upper() if data.state else "",
        "zip_code": data.zip_code.strip() if data.zip_code else "",
        "phone": data.phone.strip() if data.phone else "",
        "source": data.source or "manual",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    result = await db.employer_eins.insert_one(doc)
    doc['_id'] = str(result.inserted_id)
    
    return {"success": True, "message": f"EIN {doc['ein']} agregado", "record": doc}


@router.get("/search")
async def search_ein(
    q: str = Query(..., min_length=1, description="Nombre del empleador o últimos 4 dígitos del EIN"),
    user=Depends(lambda: _get_current_user)
):
    """
    Search for an EIN by employer name or last 4 digits.
    Supports partial name matching and exact last-4 matching.
    """
    db = get_db()
    q = q.strip()
    
    # Determine search type
    is_digits = q.isdigit()
    
    if is_digits and len(q) == 4:
        # Search by last 4 digits
        cursor = db.employer_eins.find({"ein_last4": q}).sort("employer_name", 1)
    elif is_digits and len(q) == 9:
        # Search by full EIN
        cursor = db.employer_eins.find({"ein_normalized": q}).sort("employer_name", 1)
    elif is_digits and len(q) == 11 and '-' not in q:
        # Search by full EIN without dash
        clean = normalize_ein(q)
        cursor = db.employer_eins.find({"ein_normalized": clean}).sort("employer_name", 1)
    else:
        # Search by name (case-insensitive partial match)
        regex = re.escape(q)
        cursor = db.employer_eins.find({
            "employer_name": {"$regex": regex, "$options": "i"}
        }).sort("employer_name", 1)
    
    results = []
    async for doc in cursor.limit(50):
        results.append(serialize_doc(doc))
    
    return {
        "success": True,
        "query": q,
        "count": len(results),
        "results": results
    }


@router.get("")
async def list_eins(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort: str = Query("employer_name"),
    user=Depends(lambda: _get_current_user)
):
    """List all EINs with pagination."""
    db = get_db()
    
    skip = (page - 1) * limit
    total = await db.employer_eins.count_documents({})
    
    sort_field = sort if sort in ["employer_name", "ein", "state", "created_at"] else "employer_name"
    sort_dir = 1 if sort_field != "created_at" else -1
    
    cursor = db.employer_eins.find({}).sort(sort_field, sort_dir).skip(skip).limit(limit)
    
    results = []
    async for doc in cursor:
        results.append(serialize_doc(doc))
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "results": results
    }


@router.put("/{ein_id}")
async def update_ein(ein_id: str, data: EINUpdate, user=Depends(lambda: _get_current_user)):
    """Update an existing EIN record."""
    db = get_db()
    
    try:
        oid = ObjectId(ein_id)
    except Exception:
        raise HTTPException(400, "ID inválido")
    
    existing = await db.employer_eins.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "Registro EIN no encontrado")
    
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    
    if data.employer_name:
        update_fields["employer_name"] = data.employer_name.strip().upper()
    
    if data.ein:
        clean = normalize_ein(data.ein)
        if not validate_ein(clean):
            raise HTTPException(400, "EIN inválido")
        # Check duplicate
        dup = await db.employer_eins.find_one({"ein_normalized": clean, "_id": {"$ne": oid}})
        if dup:
            raise HTTPException(409, f"EIN ya existe para: {dup.get('employer_name')}")
        update_fields["ein"] = format_ein(clean)
        update_fields["ein_normalized"] = clean
        update_fields["ein_last4"] = clean[-4:]
    
    if data.address is not None:
        update_fields["address"] = data.address.strip()
    if data.city is not None:
        update_fields["city"] = data.city.strip().upper()
    if data.state is not None:
        update_fields["state"] = data.state.strip().upper()
    if data.zip_code is not None:
        update_fields["zip_code"] = data.zip_code.strip()
    if data.phone is not None:
        update_fields["phone"] = data.phone.strip()
    
    await db.employer_eins.update_one({"_id": oid}, {"$set": update_fields})
    
    updated = await db.employer_eins.find_one({"_id": oid})
    return {"success": True, "message": "EIN actualizado", "record": serialize_doc(updated)}


@router.delete("/{ein_id}")
async def delete_ein(ein_id: str, user=Depends(lambda: _get_current_user)):
    """Delete an EIN record."""
    db = get_db()
    
    try:
        oid = ObjectId(ein_id)
    except Exception:
        raise HTTPException(400, "ID inválido")
    
    result = await db.employer_eins.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Registro EIN no encontrado")
    
    return {"success": True, "message": "EIN eliminado"}


@router.post("/bulk")
async def bulk_import_eins(data: EINBulkImport, user=Depends(lambda: _get_current_user)):
    """Bulk import EIN records. Skips duplicates."""
    db = get_db()
    
    imported = 0
    skipped = 0
    errors = []
    
    for record in data.records:
        clean = normalize_ein(record.ein)
        if not validate_ein(clean):
            errors.append(f"{record.employer_name}: EIN inválido ({record.ein})")
            continue
        
        existing = await db.employer_eins.find_one({"ein_normalized": clean})
        if existing:
            skipped += 1
            continue
        
        doc = {
            "employer_name": record.employer_name.strip().upper(),
            "ein": format_ein(clean),
            "ein_normalized": clean,
            "ein_last4": clean[-4:],
            "address": record.address.strip() if record.address else "",
            "city": record.city.strip().upper() if record.city else "",
            "state": record.state.strip().upper() if record.state else "",
            "zip_code": record.zip_code.strip() if record.zip_code else "",
            "phone": record.phone.strip() if record.phone else "",
            "source": record.source or "import",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        await db.employer_eins.insert_one(doc)
        imported += 1
    
    return {
        "success": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "total_processed": len(data.records)
    }


@router.get("/stats")
async def ein_stats(user=Depends(lambda: _get_current_user)):
    """Get statistics about the EIN database."""
    db = get_db()
    
    total = await db.employer_eins.count_documents({})
    
    # Count by source
    pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    sources = {}
    async for doc in db.employer_eins.aggregate(pipeline):
        sources[doc['_id'] or 'unknown'] = doc['count']
    
    # Count by state
    state_pipeline = [
        {"$match": {"state": {"$ne": ""}}},
        {"$group": {"_id": "$state", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_states = []
    async for doc in db.employer_eins.aggregate(state_pipeline):
        top_states.append({"state": doc['_id'], "count": doc['count']})
    
    return {
        "success": True,
        "total_eins": total,
        "by_source": sources,
        "top_states": top_states
    }
