"""
Trucker Phase 2 Routes — Specialized tools for Car Haulers, Tankers, Reefers + GPS Route Tracking.
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import jwt
import os
import math

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trucker", tags=["trucker-phase2"])

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


# ═══════════════════════════════════════════════════════════════
# ─── GPS ROUTE TRACKING ───
# ═══════════════════════════════════════════════════════════════

US_STATE_BOUNDS = {
    "AL": (30.22, -88.47, 35.01, -84.89), "AK": (51.21, -179.15, 71.39, 179.77),
    "AZ": (31.33, -114.81, 37.00, -109.04), "AR": (33.00, -94.62, 36.50, -89.64),
    "CA": (32.53, -124.41, 42.01, -114.13), "CO": (36.99, -109.06, 41.00, -102.04),
    "CT": (40.95, -73.73, 42.05, -71.79), "DE": (38.45, -75.79, 39.84, -75.05),
    "FL": (24.40, -87.63, 31.00, -80.03), "GA": (30.36, -85.61, 35.00, -80.84),
    "HI": (18.91, -160.24, 22.24, -154.81), "ID": (41.99, -117.24, 49.00, -111.04),
    "IL": (36.97, -91.51, 42.51, -87.02), "IN": (37.77, -88.10, 41.76, -84.78),
    "IA": (40.38, -96.64, 43.50, -90.14), "KS": (36.99, -102.05, 40.00, -94.59),
    "KY": (36.50, -89.57, 39.15, -81.96), "LA": (28.93, -94.04, 33.02, -88.82),
    "ME": (42.98, -71.08, 47.46, -66.95), "MD": (37.91, -79.49, 39.72, -75.05),
    "MA": (41.24, -73.50, 42.89, -69.93), "MI": (41.70, -90.42, 48.30, -82.12),
    "MN": (43.50, -97.24, 49.38, -89.49), "MS": (30.17, -91.66, 35.00, -88.10),
    "MO": (35.99, -95.77, 40.61, -89.10), "MT": (44.36, -116.05, 49.00, -104.04),
    "NE": (39.99, -104.05, 43.00, -95.31), "NV": (35.00, -120.01, 42.00, -114.04),
    "NH": (42.70, -72.56, 45.31, -70.70), "NJ": (38.93, -75.56, 41.36, -73.89),
    "NM": (31.33, -109.05, 37.00, -103.00), "NY": (40.50, -79.76, 45.02, -71.86),
    "NC": (33.84, -84.32, 36.59, -75.46), "ND": (45.94, -104.05, 49.00, -96.55),
    "OH": (38.40, -84.82, 42.33, -80.52), "OK": (33.62, -103.00, 37.00, -94.43),
    "OR": (41.99, -124.57, 46.29, -116.46), "PA": (39.72, -80.52, 42.27, -74.69),
    "RI": (41.15, -71.86, 42.02, -71.12), "SC": (32.03, -83.35, 35.22, -78.54),
    "SD": (42.48, -104.06, 45.95, -96.44), "TN": (34.98, -90.31, 36.68, -81.65),
    "TX": (25.84, -106.65, 36.50, -93.51), "UT": (36.99, -114.05, 42.00, -109.04),
    "VT": (42.73, -73.44, 45.02, -71.46), "VA": (36.54, -83.68, 39.47, -75.24),
    "WA": (45.54, -124.85, 49.00, -116.92), "WV": (37.20, -82.64, 40.64, -77.72),
    "WI": (42.49, -92.89, 47.31, -86.25), "WY": (40.99, -111.06, 45.01, -104.05),
}


def detect_state_from_coords(lat: float, lng: float) -> str:
    """Detect US state from GPS coordinates using bounding boxes."""
    best_state = ""
    for state, (min_lat, min_lng, max_lat, max_lng) in US_STATE_BOUNDS.items():
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            best_state = state
            break
    return best_state


def haversine_miles(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS points in miles."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


@router.post("/gps/start")
async def gps_start_tracking(request: Request):
    """Start GPS route tracking for a trip."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    # Check for existing active route
    active = await db.trucker_gps_routes.find_one({"user_id": user_id, "status": "active"})
    if active:
        return {"success": False, "error": "Ya tienes una ruta activa", "route_id": str(active["_id"])}

    body = await request.json()

    route = {
        "user_id": user_id,
        "status": "active",
        "origin": body.get("origin", ""),
        "destination": body.get("destination", ""),
        "waypoints": [],
        "states_detected": [],
        "total_miles": 0,
        "start_time": datetime.utcnow(),
        "end_time": None,
        "trip_id": body.get("trip_id"),
        "created_at": datetime.utcnow(),
    }

    # Add initial waypoint if provided
    if body.get("latitude") and body.get("longitude"):
        lat = float(body["latitude"])
        lng = float(body["longitude"])
        state = detect_state_from_coords(lat, lng)
        route["waypoints"].append({
            "lat": lat, "lng": lng, "timestamp": datetime.utcnow().isoformat(),
            "speed": float(body.get("speed", 0)), "state": state,
        })
        if state and state not in route["states_detected"]:
            route["states_detected"].append(state)

    result = await db.trucker_gps_routes.insert_one(route)
    logger.info(f"🛰️ GPS tracking started for user {user_id}")

    return {"success": True, "route_id": str(result.inserted_id), "status": "active"}


@router.post("/gps/waypoint")
async def gps_add_waypoint(request: Request):
    """Add a GPS waypoint to the active route."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    lat = float(body.get("latitude", 0))
    lng = float(body.get("longitude", 0))
    speed = float(body.get("speed", 0))

    if lat == 0 and lng == 0:
        raise HTTPException(status_code=400, detail="Coordenadas inválidas")

    active = await db.trucker_gps_routes.find_one({"user_id": user_id, "status": "active"})
    if not active:
        raise HTTPException(status_code=404, detail="No hay ruta activa")

    state = detect_state_from_coords(lat, lng)
    waypoint = {
        "lat": lat, "lng": lng, "timestamp": datetime.utcnow().isoformat(),
        "speed": speed, "state": state,
    }

    # Calculate incremental distance
    waypoints = active.get("waypoints", [])
    added_miles = 0
    if waypoints:
        last = waypoints[-1]
        added_miles = haversine_miles(last["lat"], last["lng"], lat, lng)

    update = {
        "$push": {"waypoints": waypoint},
        "$inc": {"total_miles": round(added_miles, 2)},
    }
    if state and state not in active.get("states_detected", []):
        update["$addToSet"] = {"states_detected": state}

    await db.trucker_gps_routes.update_one({"_id": active["_id"]}, update)

    return {
        "success": True,
        "added_miles": round(added_miles, 2),
        "total_miles": round(active.get("total_miles", 0) + added_miles, 2),
        "state": state,
        "waypoint_count": len(waypoints) + 1,
    }


@router.post("/gps/stop")
async def gps_stop_tracking(request: Request):
    """Stop GPS tracking and finalize route."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    active = await db.trucker_gps_routes.find_one({"user_id": user_id, "status": "active"})
    if not active:
        raise HTTPException(status_code=404, detail="No hay ruta activa")

    end_time = datetime.utcnow()
    duration_hours = (end_time - active["start_time"]).total_seconds() / 3600

    await db.trucker_gps_routes.update_one(
        {"_id": active["_id"]},
        {"$set": {
            "status": "completed",
            "end_time": end_time,
            "duration_hours": round(duration_hours, 2),
        }}
    )

    logger.info(f"🛰️ GPS tracking stopped: {active['total_miles']} miles, {len(active.get('states_detected', []))} states")

    return {
        "success": True,
        "total_miles": active.get("total_miles", 0),
        "states_detected": active.get("states_detected", []),
        "duration_hours": round(duration_hours, 2),
        "waypoint_count": len(active.get("waypoints", [])),
    }


@router.get("/gps/active")
async def gps_get_active(request: Request):
    """Get active GPS tracking session."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    active = await db.trucker_gps_routes.find_one({"user_id": user_id, "status": "active"})
    if not active:
        return {"active": False}

    active["id"] = str(active.pop("_id"))
    active["active"] = True
    return active


@router.get("/gps/routes")
async def gps_list_routes(request: Request):
    """List completed GPS routes."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    routes = []
    cursor = db.trucker_gps_routes.find(
        {"user_id": user_id, "status": "completed"}
    ).sort("end_time", -1).limit(limit)

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc.pop("waypoints", None)  # Don't send all waypoints in list view
        routes.append(doc)

    return {"routes": routes}


# ═══════════════════════════════════════════════════════════════
# ─── CAR HAULER LOADS ───
# ═══════════════════════════════════════════════════════════════

@router.post("/car-hauler/loads")
async def create_car_load(request: Request):
    """Create a new car hauler load with vehicle positions."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    vehicles = body.get("vehicles", [])

    load = {
        "user_id": user_id,
        "load_number": body.get("load_number", ""),
        "broker": body.get("broker", "") or body.get("broker_name", ""),
        "pickup_location": body.get("pickup_location", ""),
        "delivery_location": body.get("delivery_location", ""),
        "rate": body.get("rate", ""),
        "vehicles": [],
        "total_vehicles": 0,
        "estimated_weight": 0,
        "status": "planning",  # planning, loaded, in_transit, delivered
        "notes": body.get("notes", ""),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    total_weight = 0
    for i, v in enumerate(vehicles):
        weight = _estimate_vehicle_weight(v.get("type", "sedan"))
        vehicle = {
            "slot": v.get("slot", i + 1),
            "deck": v.get("deck", "lower"),  # upper or lower
            "vin": v.get("vin", "").upper(),
            "year": v.get("year", ""),
            "make": v.get("make", ""),
            "model": v.get("model", ""),
            "color": v.get("color", ""),
            "type": v.get("type", "sedan"),
            "pickup_address": v.get("pickup_address", ""),
            "delivery_address": v.get("delivery_address", ""),
            "status": "pending",  # pending, picked_up, delivered
            "estimated_weight": weight,
            "condition_notes": v.get("condition_notes", ""),
        }
        load["vehicles"].append(vehicle)
        total_weight += weight

    load["total_vehicles"] = len(load["vehicles"])
    load["estimated_weight"] = total_weight

    result = await db.trucker_car_loads.insert_one(load)
    return {"success": True, "id": str(result.inserted_id), "total_vehicles": load["total_vehicles"], "estimated_weight": total_weight}


def _estimate_vehicle_weight(vehicle_type: str) -> int:
    """Estimate vehicle weight in lbs by type."""
    weights = {
        "sedan": 3500, "suv": 4500, "truck": 5500, "van": 4800,
        "compact": 2800, "sports": 3200, "luxury": 4200, "electric": 4800,
        "motorcycle": 500, "other": 3500,
    }
    return weights.get(vehicle_type, 3500)


@router.get("/car-hauler/loads")
async def list_car_loads(request: Request):
    """List car hauler loads."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    status_filter = request.query_params.get("status")

    query = {"user_id": user_id}
    if status_filter:
        query["status"] = status_filter

    loads = []
    cursor = db.trucker_car_loads.find(query).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        loads.append(doc)

    total = await db.trucker_car_loads.count_documents({"user_id": user_id})
    return {"loads": loads, "total": total}


@router.put("/car-hauler/loads/{load_id}")
async def update_car_load(load_id: str, request: Request):
    """Update a car hauler load (status, add/update vehicles)."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    update_data = {"updated_at": datetime.utcnow()}

    for field in ["status", "broker", "broker_name", "load_number", "pickup_location", "delivery_location", "notes", "rate", "vehicles"]:
        if field in body:
            # Map broker_name to broker for consistency
            save_field = "broker" if field == "broker_name" else field
            update_data[save_field] = body[field]

    if "vehicles" in body:
        total_weight = sum(_estimate_vehicle_weight(v.get("type", "sedan")) for v in body["vehicles"])
        update_data["total_vehicles"] = len(body["vehicles"])
        update_data["estimated_weight"] = total_weight

    result = await db.trucker_car_loads.update_one(
        {"_id": ObjectId(load_id), "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Carga no encontrada")

    return {"success": True}


@router.delete("/car-hauler/loads/{load_id}")
async def delete_car_load(load_id: str, request: Request):
    """Delete a car hauler load."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_car_loads.delete_one({"_id": ObjectId(load_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Carga no encontrada")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# ─── TANKER CARGO LOGS ───
# ═══════════════════════════════════════════════════════════════

TANKER_CARGO_TYPES = [
    {"id": "gasoline", "label": "Gasolina", "icon": "⛽", "hazmat": True},
    {"id": "diesel_fuel", "label": "Diesel", "icon": "🛢️", "hazmat": True},
    {"id": "crude_oil", "label": "Petróleo Crudo", "icon": "🪨", "hazmat": True},
    {"id": "chemicals", "label": "Químicos", "icon": "⚗️", "hazmat": True},
    {"id": "milk", "label": "Leche", "icon": "🥛", "hazmat": False},
    {"id": "water", "label": "Agua", "icon": "💧", "hazmat": False},
    {"id": "juice", "label": "Jugo / Bebidas", "icon": "🧃", "hazmat": False},
    {"id": "lpg", "label": "Gas LP", "icon": "🔥", "hazmat": True},
    {"id": "other", "label": "Otro", "icon": "📦", "hazmat": False},
]


@router.get("/tanker/cargo-types")
async def list_tanker_cargo_types():
    """List available tanker cargo types."""
    return {"types": TANKER_CARGO_TYPES}


@router.post("/tanker/cargo")
async def create_tanker_cargo(request: Request):
    """Log a tanker cargo delivery."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    cargo = {
        "user_id": user_id,
        "cargo_type": body.get("cargo_type", ""),
        "capacity_gallons": float(body.get("capacity_gallons", 0)),
        "loaded_gallons": float(body.get("loaded_gallons", 0)),
        "temperature": body.get("temperature"),
        "hazmat_class": body.get("hazmat_class", ""),
        "hazmat_placard": body.get("hazmat_placard", ""),
        "origin": body.get("origin", ""),
        "destination": body.get("destination", ""),
        "shipper": body.get("shipper", ""),
        "receiver": body.get("receiver", ""),
        "rate": float(body.get("rate", 0)),
        "wash_required": body.get("wash_required", False),
        "wash_completed": body.get("wash_completed", False),
        "wash_location": body.get("wash_location", ""),
        "wash_cost": float(body.get("wash_cost", 0)),
        "status": body.get("status", "loaded"),  # loaded, in_transit, delivered, wash_pending
        "notes": body.get("notes", ""),
        "date": body.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "created_at": datetime.utcnow(),
    }

    result = await db.trucker_tanker_cargo.insert_one(cargo)
    return {"success": True, "id": str(result.inserted_id)}


@router.get("/tanker/cargo")
async def list_tanker_cargo(request: Request):
    """List tanker cargo history."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    logs = []
    cursor = db.trucker_tanker_cargo.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        logs.append(doc)

    # Stats
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_loads": {"$sum": 1},
            "total_gallons": {"$sum": "$loaded_gallons"},
            "total_revenue": {"$sum": "$rate"},
            "total_wash_cost": {"$sum": "$wash_cost"},
        }}
    ]
    stats = {"total_loads": 0, "total_gallons": 0, "total_revenue": 0, "total_wash_cost": 0}
    async for doc in db.trucker_tanker_cargo.aggregate(pipeline):
        stats = {
            "total_loads": doc["total_loads"],
            "total_gallons": round(doc["total_gallons"], 1),
            "total_revenue": round(doc["total_revenue"], 2),
            "total_wash_cost": round(doc["total_wash_cost"], 2),
        }

    return {"logs": logs, "stats": stats}


@router.delete("/tanker/cargo/{cargo_id}")
async def delete_tanker_cargo(cargo_id: str, request: Request):
    """Delete a tanker cargo log."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_tanker_cargo.delete_one({"_id": ObjectId(cargo_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# ─── REEFER TEMPERATURE & FUEL LOGS ───
# ═══════════════════════════════════════════════════════════════

@router.post("/reefer/temp-log")
async def create_reefer_temp_log(request: Request):
    """Log reefer temperature reading."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    set_temp = body.get("set_temp")
    actual_temp = body.get("actual_temp")

    temp_ok = True
    if set_temp is not None and actual_temp is not None:
        temp_ok = abs(float(actual_temp) - float(set_temp)) <= 5  # 5° tolerance

    log = {
        "user_id": user_id,
        "set_temp": float(set_temp) if set_temp is not None else None,
        "actual_temp": float(actual_temp) if actual_temp is not None else None,
        "temp_unit": body.get("temp_unit", "F"),  # F or C
        "temp_ok": temp_ok,
        "cargo_type": body.get("cargo_type", ""),
        "pre_cool_start": body.get("pre_cool_start"),
        "pre_cool_end": body.get("pre_cool_end"),
        "pre_cool_hours": float(body.get("pre_cool_hours", 0)),
        "reefer_fuel_gallons": float(body.get("reefer_fuel_gallons", 0)),
        "reefer_fuel_cost": float(body.get("reefer_fuel_cost", 0)),
        "reefer_hours": float(body.get("reefer_hours", 0)),
        "location": body.get("location", ""),
        "notes": body.get("notes", ""),
        "date": body.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "created_at": datetime.utcnow(),
    }

    result = await db.trucker_reefer_logs.insert_one(log)
    return {"success": True, "id": str(result.inserted_id), "temp_ok": temp_ok}


@router.get("/reefer/temp-logs")
async def list_reefer_temp_logs(request: Request):
    """List reefer temperature logs."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    logs = []
    cursor = db.trucker_reefer_logs.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        logs.append(doc)

    # Stats
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_logs": {"$sum": 1},
            "total_reefer_fuel": {"$sum": "$reefer_fuel_gallons"},
            "total_reefer_fuel_cost": {"$sum": "$reefer_fuel_cost"},
            "total_reefer_hours": {"$sum": "$reefer_hours"},
            "avg_set_temp": {"$avg": "$set_temp"},
            "avg_actual_temp": {"$avg": "$actual_temp"},
            "temp_alerts": {"$sum": {"$cond": [{"$eq": ["$temp_ok", False]}, 1, 0]}},
        }}
    ]
    stats = {}
    async for doc in db.trucker_reefer_logs.aggregate(pipeline):
        stats = {
            "total_logs": doc["total_logs"],
            "total_reefer_fuel": round(doc.get("total_reefer_fuel") or 0, 1),
            "total_reefer_fuel_cost": round(doc.get("total_reefer_fuel_cost") or 0, 2),
            "total_reefer_hours": round(doc.get("total_reefer_hours") or 0, 1),
            "avg_set_temp": round(doc.get("avg_set_temp") or 0, 1),
            "avg_actual_temp": round(doc.get("avg_actual_temp") or 0, 1),
            "temp_alerts": doc.get("temp_alerts", 0),
        }

    return {"logs": logs, "stats": stats}


@router.delete("/reefer/temp-logs/{log_id}")
async def delete_reefer_temp_log(log_id: str, request: Request):
    """Delete a reefer temp log."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_reefer_logs.delete_one({"_id": ObjectId(log_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# ─── SPECIALIZED INSPECTION TEMPLATES ───
# ═══════════════════════════════════════════════════════════════

SPECIALIZED_INSPECTIONS = {
    "car_hauler": {
        "label": "Car Hauler — Inspección Especializada",
        "categories": [
            {
                "id": "ramps_hydraulics", "label": "Rampas e Hidráulicos", "icon": "🔧",
                "items": [
                    {"id": "ch_upper_ramp", "label": "Rampa superior funcional"},
                    {"id": "ch_lower_ramp", "label": "Rampa inferior funcional"},
                    {"id": "ch_hydraulic_pump", "label": "Bomba hidráulica sin fugas"},
                    {"id": "ch_hydraulic_lines", "label": "Líneas hidráulicas en buen estado"},
                    {"id": "ch_ramp_locks", "label": "Seguros de rampas funcionando"},
                ],
            },
            {
                "id": "tie_downs", "label": "Amarre y Sujeción", "icon": "🔗",
                "items": [
                    {"id": "ch_wheel_straps", "label": "Correas de rueda (wheel straps) en buen estado"},
                    {"id": "ch_wheel_nets", "label": "Redes de rueda (wheel nets) sin daño"},
                    {"id": "ch_ratchets", "label": "Ratchets funcionando correctamente"},
                    {"id": "ch_chain_hooks", "label": "Cadenas y ganchos sin desgaste"},
                    {"id": "ch_tire_clearance", "label": "Espacio adecuado entre vehículos"},
                ],
            },
            {
                "id": "deck_structure", "label": "Estructura del Deck", "icon": "🏗️",
                "items": [
                    {"id": "ch_upper_deck", "label": "Deck superior sin grietas/daños"},
                    {"id": "ch_lower_deck", "label": "Deck inferior sin grietas/daños"},
                    {"id": "ch_deck_rails", "label": "Rieles del deck en posición"},
                    {"id": "ch_deck_pins", "label": "Pines de ajuste del deck seguros"},
                    {"id": "ch_walkways", "label": "Pasarelas y escalones seguros"},
                ],
            },
        ],
    },
    "tanker": {
        "label": "Tanker — Inspección Especializada",
        "categories": [
            {
                "id": "tank_body", "label": "Cuerpo del Tanque", "icon": "🛢️",
                "items": [
                    {"id": "tk_tank_exterior", "label": "Exterior del tanque sin daños/corrosión"},
                    {"id": "tk_manhole_covers", "label": "Tapas de registro (manhole) selladas"},
                    {"id": "tk_baffles", "label": "Baffles internos (si aplica)"},
                    {"id": "tk_insulation", "label": "Aislamiento térmico intacto"},
                ],
            },
            {
                "id": "valves_fittings", "label": "Válvulas y Conexiones", "icon": "🔩",
                "items": [
                    {"id": "tk_discharge_valve", "label": "Válvula de descarga funcional"},
                    {"id": "tk_emergency_valve", "label": "Válvula de emergencia operativa"},
                    {"id": "tk_vapor_recovery", "label": "Sistema de recuperación de vapores"},
                    {"id": "tk_hose_connections", "label": "Conexiones de manguera sin fugas"},
                    {"id": "tk_pressure_gauge", "label": "Medidor de presión funcional"},
                ],
            },
            {
                "id": "hazmat_safety", "label": "Seguridad HAZMAT", "icon": "☢️",
                "items": [
                    {"id": "tk_placards", "label": "Placards/señalización correcta"},
                    {"id": "tk_spill_kit", "label": "Kit de derrames completo"},
                    {"id": "tk_ppe", "label": "Equipo de protección personal (PPE)"},
                    {"id": "tk_shipping_papers", "label": "Documentos de embarque HAZMAT"},
                    {"id": "tk_emergency_response", "label": "Guía de respuesta a emergencias"},
                ],
            },
        ],
    },
    "reefer": {
        "label": "Refrigerado — Inspección Especializada",
        "categories": [
            {
                "id": "reefer_unit", "label": "Unidad de Refrigeración", "icon": "❄️",
                "items": [
                    {"id": "rf_unit_running", "label": "Unidad reefer encendida y funcionando"},
                    {"id": "rf_temp_display", "label": "Display de temperatura funcional"},
                    {"id": "rf_set_temp", "label": "Temperatura configurada correcta"},
                    {"id": "rf_fuel_level", "label": "Nivel de diesel del reefer adecuado"},
                    {"id": "rf_belts", "label": "Bandas del compresor en buen estado"},
                    {"id": "rf_coolant", "label": "Refrigerante sin fugas"},
                ],
            },
            {
                "id": "cargo_area", "label": "Área de Carga", "icon": "📦",
                "items": [
                    {"id": "rf_air_chute", "label": "Air chute / conducto de aire en posición"},
                    {"id": "rf_drain_holes", "label": "Drenajes abiertos y limpios"},
                    {"id": "rf_floor_condition", "label": "Piso sin daños ni acumulación"},
                    {"id": "rf_walls_ceiling", "label": "Paredes y techo sin daño/humedad"},
                    {"id": "rf_door_seals", "label": "Sellos de puerta herméticos"},
                    {"id": "rf_load_bars", "label": "Barras de carga disponibles"},
                ],
            },
            {
                "id": "pre_cool", "label": "Pre-enfriamiento", "icon": "🌡️",
                "items": [
                    {"id": "rf_pre_cool_done", "label": "Pre-cool completado (temp estable)"},
                    {"id": "rf_pre_cool_time", "label": "Tiempo de pre-cool adecuado (≥2hrs)"},
                    {"id": "rf_pulp_temp", "label": "Temperatura de pulpa verificada"},
                ],
            },
        ],
    },
}


@router.get("/specialized-inspection/{subtype}")
async def get_specialized_inspection(subtype: str):
    """Get specialized inspection template for a truck subtype."""
    template = SPECIALIZED_INSPECTIONS.get(subtype)
    if not template:
        return {"categories": [], "label": ""}
    return template



# ═══════════════════════════════════════════════════════════════
# ─── AI LOAD PLANNER (CAR HAULER) ───
# ═══════════════════════════════════════════════════════════════

VEHICLE_WEIGHTS = {
    "sedan": 3500, "suv": 4500, "truck": 5500, "van": 4800,
    "compact": 2800, "sports": 3200, "luxury": 4200, "electric": 4800,
    "motorcycle": 500, "other": 3500,
}

VEHICLE_HEIGHTS = {
    "sedan": 57, "suv": 70, "truck": 76, "van": 74,
    "compact": 55, "sports": 50, "luxury": 57, "electric": 57,
    "motorcycle": 45, "other": 60,
}


@router.post("/car-hauler/ai-plan")
async def ai_load_plan(request: Request):
    """
    AI-powered load planning for car haulers.
    Analyzes vehicles, addresses, weights, and heights to suggest optimal trailer positions.
    """
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    vehicles = body.get("vehicles", [])

    if not vehicles or len(vehicles) == 0:
        raise HTTPException(status_code=400, detail="Se requiere al menos un vehículo")

    if len(vehicles) > 9:
        raise HTTPException(status_code=400, detail="Máximo 9 vehículos por carga")

    # Enrich vehicles with weight/height data
    enriched = []
    for i, v in enumerate(vehicles):
        vtype = v.get("type", "sedan")
        enriched.append({
            "index": i + 1,
            "year": v.get("year", ""),
            "make": v.get("make", ""),
            "model": v.get("model", ""),
            "type": vtype,
            "color": v.get("color", ""),
            "weight_lbs": VEHICLE_WEIGHTS.get(vtype, 3500),
            "height_inches": VEHICLE_HEIGHTS.get(vtype, 60),
            "pickup_address": v.get("pickup_address", ""),
            "delivery_address": v.get("delivery_address", ""),
        })

    total_weight = sum(v["weight_lbs"] for v in enriched)
    trailer_type = body.get("trailer_type", "9-car carrier")

    # Build AI prompt
    vehicle_list = "\n".join([
        f"  {v['index']}. {v['year']} {v['make']} {v['model']} ({v['type']}) — "
        f"{v['weight_lbs']} lbs, {v['height_inches']}\" alto — "
        f"Pickup: {v['pickup_address']} → Delivery: {v['delivery_address']}"
        for v in enriched
    ])

    system_prompt = """You are an expert car hauler load planner with 20+ years of experience. 
You must plan the optimal vehicle positions on a 9-car carrier trailer considering:
1. WEIGHT DISTRIBUTION: Keep total weight ≤80,000 lbs. Balance front-to-back and left-to-right.
2. HEIGHT RESTRICTIONS: Vehicles on upper deck must be shorter. SUVs/trucks go on lower deck.
3. DELIVERY ORDER: Last delivery goes in the most accessible position (rear lower). First delivery can go upper.
4. ROUTE OPTIMIZATION: Group vehicles by delivery area.
5. SAFETY: Heavy vehicles on lower deck for stability. No top-heavy loading.

Trailer layout:
- UPPER DECK: Positions U1(front), U2(mid-front), U3(mid-back), U4(back) — Max height ~62 inches
- LOWER DECK: Positions L1(front), L2(mid-front), L3(mid-back), L4(mid-back-2), L5(rear/ramp) — More height clearance

RESPOND IN JSON FORMAT ONLY with this exact structure:
{
  "plan": [
    {"vehicle_index": 1, "position": "U1", "deck": "upper", "reason": "Light sedan, first delivery, upper front safe"},
    ...
  ],
  "load_order": [1, 3, 2, ...],
  "route_sequence": ["Address 1", "Address 2", ...],
  "weight_analysis": {
    "total_weight": 12345,
    "upper_deck_weight": 5000,
    "lower_deck_weight": 7345,
    "balance_score": 85,
    "warnings": ["String warning if any"]
  },
  "tips": ["Tip 1", "Tip 2"],
  "safety_notes": ["Note about this specific load"]
}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation outside JSON."""

    user_prompt = f"""Plan the optimal loading for this {trailer_type} with {len(enriched)} vehicles:

{vehicle_list}

Total weight: {total_weight} lbs
Trailer: {trailer_type}

Consider the delivery addresses for route optimization.
Respond in JSON format as instructed."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json
        import uuid

        api_key = os.getenv('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")

        chat = LlmChat(
            api_key=api_key,
            session_id=f"load-plan-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=user_prompt))
        response_text = str(response)

        # Parse JSON from response
        # Clean markdown code blocks if present
        clean = response_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

        plan_data = json.loads(clean)

        # Save plan to DB
        plan_record = {
            "user_id": user_id,
            "vehicles": enriched,
            "plan": plan_data.get("plan", []),
            "load_order": plan_data.get("load_order", []),
            "route_sequence": plan_data.get("route_sequence", []),
            "weight_analysis": plan_data.get("weight_analysis", {}),
            "tips": plan_data.get("tips", []),
            "safety_notes": plan_data.get("safety_notes", []),
            "total_vehicles": len(enriched),
            "total_weight": total_weight,
            "trailer_type": trailer_type,
            "created_at": datetime.utcnow(),
        }
        result = await db.trucker_load_plans.insert_one(plan_record)

        logger.info(f"🤖 AI Load Plan generated for user {user_id}: {len(enriched)} vehicles")

        return {
            "success": True,
            "plan_id": str(result.inserted_id),
            "plan": plan_data.get("plan", []),
            "load_order": plan_data.get("load_order", []),
            "route_sequence": plan_data.get("route_sequence", []),
            "weight_analysis": plan_data.get("weight_analysis", {}),
            "tips": plan_data.get("tips", []),
            "safety_notes": plan_data.get("safety_notes", []),
            "total_vehicles": len(enriched),
            "total_weight": total_weight,
        }

    except json.JSONDecodeError as e:
        logger.error(f"AI Load Plan JSON parse error: {e}")
        # Fallback: Simple rule-based planning
        plan = _fallback_load_plan(enriched)
        return {
            "success": True,
            "plan_id": None,
            "plan": plan["plan"],
            "load_order": plan["load_order"],
            "route_sequence": [],
            "weight_analysis": plan["weight_analysis"],
            "tips": ["Plan generado con reglas básicas (AI no disponible)"],
            "safety_notes": [],
            "total_vehicles": len(enriched),
            "total_weight": total_weight,
            "fallback": True,
        }
    except Exception as e:
        logger.error(f"AI Load Plan error: {e}")
        # Fallback
        plan = _fallback_load_plan(enriched)
        return {
            "success": True,
            "plan_id": None,
            "plan": plan["plan"],
            "load_order": plan["load_order"],
            "route_sequence": [],
            "weight_analysis": plan["weight_analysis"],
            "tips": ["Plan generado con reglas básicas (AI temporalmente no disponible)"],
            "safety_notes": [],
            "total_vehicles": len(enriched),
            "total_weight": total_weight,
            "fallback": True,
        }


def _fallback_load_plan(vehicles: list) -> dict:
    """Rule-based fallback load planner when AI is unavailable."""
    upper_positions = ["U1", "U2", "U3", "U4"]
    lower_positions = ["L1", "L2", "L3", "L4", "L5"]

    # Sort: Lighter/shorter → upper, heavier/taller → lower
    sorted_vehicles = sorted(vehicles, key=lambda v: (v["height_inches"], v["weight_lbs"]))

    plan = []
    upper_idx = 0
    lower_idx = 0
    upper_weight = 0
    lower_weight = 0

    for v in sorted_vehicles:
        # Put short/light on upper, tall/heavy on lower
        if v["height_inches"] <= 62 and upper_idx < len(upper_positions):
            plan.append({
                "vehicle_index": v["index"],
                "position": upper_positions[upper_idx],
                "deck": "upper",
                "reason": f"{'Compacto' if v['type'] in ['compact','sedan','sports'] else 'Adecuado'} para deck superior ({v['height_inches']}\" alto)",
            })
            upper_weight += v["weight_lbs"]
            upper_idx += 1
        elif lower_idx < len(lower_positions):
            plan.append({
                "vehicle_index": v["index"],
                "position": lower_positions[lower_idx],
                "deck": "lower",
                "reason": f"{'Alto' if v['height_inches'] > 62 else 'Pesado'} — mejor en deck inferior ({v['weight_lbs']} lbs)",
            })
            lower_weight += v["weight_lbs"]
            lower_idx += 1
        elif upper_idx < len(upper_positions):
            plan.append({
                "vehicle_index": v["index"],
                "position": upper_positions[upper_idx],
                "deck": "upper",
                "reason": "Deck inferior lleno, colocado en superior",
            })
            upper_weight += v["weight_lbs"]
            upper_idx += 1

    total = upper_weight + lower_weight
    balance = int(100 - abs(upper_weight - lower_weight) / max(total, 1) * 100) if total > 0 else 50

    return {
        "plan": plan,
        "load_order": [p["vehicle_index"] for p in plan],
        "weight_analysis": {
            "total_weight": total,
            "upper_deck_weight": upper_weight,
            "lower_deck_weight": lower_weight,
            "balance_score": balance,
            "warnings": ["⚠️ Peso total excede 80,000 lbs"] if total > 80000 else [],
        },
    }


@router.get("/car-hauler/plans")
async def list_load_plans(request: Request):
    """List saved AI load plans."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    plans = []
    cursor = db.trucker_load_plans.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        plans.append(doc)

    return {"plans": plans}
