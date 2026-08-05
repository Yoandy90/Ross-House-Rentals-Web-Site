"""
Mileage Tracker CRUD - Track business trips and calculate tax deductions
IRS Standard Mileage Rate 2025: $0.70/mile
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mileage", tags=["mileage"])

db = None

IRS_RATE_2025 = 0.70  # $/mile for business use

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
async def get_mileage_stats(request: Request, year: int = None, month: int = None):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    now = datetime.utcnow()
    target_year = year or now.year
    target_month = month or now.month

    # Month prefix for filtering
    month_prefix = f"{target_year}-{target_month:02d}"
    year_prefix = f"{target_year}-"

    # This month stats
    pipeline_month = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{month_prefix}"}}},
        {"$group": {
            "_id": None,
            "total_miles": {"$sum": "$miles"},
            "total_deduction": {"$sum": "$deduction_amount"},
            "trip_count": {"$sum": 1}
        }}
    ]

    # YTD stats
    pipeline_ytd = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{year_prefix}"}}},
        {"$group": {
            "_id": None,
            "total_miles": {"$sum": "$miles"},
            "total_deduction": {"$sum": "$deduction_amount"},
            "trip_count": {"$sum": 1}
        }}
    ]

    # Monthly breakdown for chart
    pipeline_monthly = [
        {"$match": {"user_id": user_id, "date": {"$regex": f"^{year_prefix}"}}},
        {"$addFields": {"month_num": {"$substr": ["$date", 5, 2]}}},
        {"$group": {
            "_id": "$month_num",
            "miles": {"$sum": "$miles"},
            "deduction": {"$sum": "$deduction_amount"},
            "trips": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]

    month_data = await db.mileage_trips.aggregate(pipeline_month).to_list(1)
    ytd_data = await db.mileage_trips.aggregate(pipeline_ytd).to_list(1)
    monthly = await db.mileage_trips.aggregate(pipeline_monthly).to_list(12)

    return {
        "month": {
            "total_miles": round(month_data[0]["total_miles"], 1) if month_data else 0,
            "total_deduction": round(month_data[0]["total_deduction"], 2) if month_data else 0,
            "trip_count": month_data[0]["trip_count"] if month_data else 0,
        },
        "ytd": {
            "total_miles": round(ytd_data[0]["total_miles"], 1) if ytd_data else 0,
            "total_deduction": round(ytd_data[0]["total_deduction"], 2) if ytd_data else 0,
            "trip_count": ytd_data[0]["trip_count"] if ytd_data else 0,
        },
        "monthly_breakdown": [{"month": int(m["_id"]), "miles": round(m["miles"], 1), "deduction": round(m["deduction"], 2), "trips": m["trips"]} for m in monthly],
        "irs_rate": IRS_RATE_2025,
    }


@router.get("")
async def list_trips(request: Request, year: int = None, month: int = None, limit: int = 50, skip: int = 0):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    query = {"user_id": user_id}
    if year and month:
        prefix = f"{year}-{month:02d}"
        query["date"] = {"$regex": f"^{prefix}"}
    elif year:
        query["date"] = {"$regex": f"^{year}-"}

    cursor = db.mileage_trips.find(query).sort("date", -1).skip(skip).limit(limit)
    trips = []
    async for trip in cursor:
        trip["id"] = str(trip.pop("_id"))
        trips.append(trip)

    return trips


@router.post("")
async def create_trip(request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    miles = float(body.get("miles", 0))
    if body.get("round_trip", False):
        miles *= 2

    deduction = round(miles * IRS_RATE_2025, 2)

    trip = {
        "user_id": user_id,
        "date": body.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "from_location": body.get("from_location", ""),
        "to_location": body.get("to_location", ""),
        "miles": round(miles, 1),
        "purpose": body.get("purpose", "business"),
        "notes": body.get("notes", ""),
        "round_trip": body.get("round_trip", False),
        "deduction_amount": deduction,
        "created_at": datetime.utcnow(),
    }

    result = await db.mileage_trips.insert_one(trip)
    trip["id"] = str(result.inserted_id)
    trip.pop("_id", None)
    return trip


@router.put("/{trip_id}")
async def update_trip(trip_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    # Recalculate if miles changed
    if "miles" in body:
        miles = float(body["miles"])
        if body.get("round_trip", False):
            miles *= 2
        body["miles"] = round(miles, 1)
        body["deduction_amount"] = round(miles * IRS_RATE_2025, 2)

    body.pop("id", None)
    body.pop("_id", None)
    body["updated_at"] = datetime.utcnow()

    result = await db.mileage_trips.update_one(
        {"_id": ObjectId(trip_id), "user_id": user_id},
        {"$set": body}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    return {"success": True, "message": "Viaje actualizado"}


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str, request: Request):
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.mileage_trips.delete_one({"_id": ObjectId(trip_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    return {"success": True, "message": "Viaje eliminado"}
