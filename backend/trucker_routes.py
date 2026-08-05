"""
Trucker Routes — Industry-specific tools for truck driver business profiles.
Handles: Pre-trip inspections (DVIR), trip logs, fuel logs, and trucker profile data.
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timedelta
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trucker", tags=["trucker"])

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


# ─── BUSINESS PROFILE TYPE ───

BUSINESS_PROFILES = {
    "truck_driver": {
        "label": "Truck Driver / Camionero",
        "icon": "truck",
        "subtypes": [
            {"id": "car_hauler", "label": "Car Hauler / Transportador de Vehículos", "icon": "🚗"},
            {"id": "dry_van", "label": "Dry Van / Carga Seca", "icon": "📦"},
            {"id": "flatbed", "label": "Flatbed / Plataforma", "icon": "🪵"},
            {"id": "reefer", "label": "Refrigerado", "icon": "❄️"},
            {"id": "tanker", "label": "Tanker / Cisterna (Líquidos)", "icon": "🛢️"},
            {"id": "hazmat", "label": "Hazmat / Materiales Peligrosos", "icon": "☢️"},
            {"id": "intermodal", "label": "Intermodal / Contenedores", "icon": "🚢"},
            {"id": "other_transport", "label": "Otro Transporte", "icon": "🚛"},
        ],
    },
    "cleaning_service": {"label": "Cleaning Service / Limpieza", "icon": "🧹", "subtypes": []},
    "landscaping": {"label": "Landscaping / Jardinería", "icon": "🌿", "subtypes": []},
    "construction": {"label": "Construction / Construcción", "icon": "🏗️", "subtypes": []},
    "restaurant": {"label": "Restaurant / Restaurante", "icon": "🍽️", "subtypes": []},
    "retail": {"label": "Retail / Tienda", "icon": "🛒", "subtypes": []},
    "beauty_salon": {"label": "Beauty Salon / Salón de Belleza", "icon": "💇", "subtypes": []},
    "auto_repair": {"label": "Auto Repair / Mecánica", "icon": "🔧", "subtypes": []},
    "general": {"label": "General / Otro", "icon": "💼", "subtypes": []},
}


@router.get("/business-profiles")
async def list_business_profiles():
    """List all available business profile types"""
    profiles = []
    for key, val in BUSINESS_PROFILES.items():
        profiles.append({
            "id": key,
            "label": val["label"],
            "icon": val["icon"],
            "subtypes": val.get("subtypes", []),
        })
    return profiles


@router.get("/profile")
async def get_trucker_profile(request: Request):
    """Get trucker-specific profile data (CDL, MC, DOT, trailer info)"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    profile = await db.trucker_profiles.find_one({"user_id": user_id})
    if not profile:
        return {
            "exists": False,
            "business_type": "",
            "business_subtype": "",
            "cdl_type": "",
            "mc_number": "",
            "dot_number": "",
            "trailer_type": "",
            "trailer_length": "",
            "trailer_capacity": "",
            "company_name": "",
            "home_state": "",
        }

    profile["id"] = str(profile.pop("_id"))
    profile["exists"] = True
    return profile


@router.put("/profile")
async def save_trucker_profile(request: Request):
    """Create or update trucker-specific profile"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    profile_data = {
        "user_id": user_id,
        "business_type": body.get("business_type", "truck_driver"),
        "business_subtype": body.get("business_subtype", ""),
        "cdl_type": body.get("cdl_type", ""),
        "mc_number": body.get("mc_number", "").strip(),
        "dot_number": body.get("dot_number", "").strip(),
        "trailer_type": body.get("trailer_type", ""),
        "trailer_length": body.get("trailer_length", ""),
        "trailer_capacity": body.get("trailer_capacity", ""),
        "company_name": body.get("company_name", "").strip(),
        "home_state": body.get("home_state", ""),
        "updated_at": datetime.utcnow(),
    }

    # Also update the business_type in user_business_profiles
    await db.user_business_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "business_type": body.get("business_type", "truck_driver"),
            "business_subtype": body.get("business_subtype", ""),
        }},
        upsert=False
    )

    result = await db.trucker_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_data, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )

    return {"success": True, "message": "Perfil de camionero guardado"}


# ─── PRE-TRIP INSPECTIONS (DVIR) ───

INSPECTION_CATEGORIES = [
    {
        "id": "exterior",
        "label": "Exterior del Vehículo",
        "icon": "🚛",
        "items": [
            {"id": "tires", "label": "Llantas y presión de aire"},
            {"id": "lights", "label": "Luces (frontales, traseras, direccionales)"},
            {"id": "mirrors", "label": "Espejos"},
            {"id": "windshield", "label": "Parabrisas y limpiaparabrisas"},
            {"id": "body_damage", "label": "Daños en carrocería"},
            {"id": "mud_flaps", "label": "Guardabarros / Mud flaps"},
            {"id": "license_plates", "label": "Placas y calcomanías"},
        ],
    },
    {
        "id": "engine",
        "label": "Motor y Mecánica",
        "icon": "⚙️",
        "items": [
            {"id": "oil_level", "label": "Nivel de aceite"},
            {"id": "coolant", "label": "Nivel de refrigerante"},
            {"id": "belts_hoses", "label": "Bandas y mangueras"},
            {"id": "battery", "label": "Batería y terminales"},
            {"id": "air_filter", "label": "Filtro de aire"},
            {"id": "leaks", "label": "Fugas de líquidos"},
        ],
    },
    {
        "id": "cabin",
        "label": "Cabina",
        "icon": "🪑",
        "items": [
            {"id": "seat_belt", "label": "Cinturón de seguridad"},
            {"id": "horn", "label": "Bocina / Horn"},
            {"id": "gauges", "label": "Indicadores del tablero"},
            {"id": "heater_ac", "label": "Calefacción / AC"},
            {"id": "emergency_kit", "label": "Kit de emergencia / Triángulos"},
            {"id": "fire_extinguisher", "label": "Extintor de incendios"},
        ],
    },
    {
        "id": "brakes",
        "label": "Frenos y Sistema de Aire",
        "icon": "🛑",
        "items": [
            {"id": "air_pressure", "label": "Presión de aire (120-125 PSI)"},
            {"id": "brake_test", "label": "Prueba de frenos"},
            {"id": "parking_brake", "label": "Freno de estacionamiento"},
            {"id": "air_lines", "label": "Líneas de aire"},
            {"id": "brake_pads", "label": "Pastillas de freno"},
        ],
    },
    {
        "id": "trailer",
        "label": "Trailer / Remolque",
        "icon": "🪝",
        "items": [
            {"id": "fifth_wheel", "label": "Quinta rueda / Fifth wheel"},
            {"id": "kingpin", "label": "Kingpin / Perno maestro"},
            {"id": "landing_gear", "label": "Patas de apoyo / Landing gear"},
            {"id": "trailer_lights", "label": "Luces del trailer"},
            {"id": "trailer_tires", "label": "Llantas del trailer"},
            {"id": "doors_latches", "label": "Puertas y seguros"},
            {"id": "cargo_secure", "label": "Carga asegurada"},
        ],
    },
    {
        "id": "documents",
        "label": "Documentos",
        "icon": "📋",
        "items": [
            {"id": "cdl", "label": "CDL vigente"},
            {"id": "medical_card", "label": "Tarjeta médica vigente"},
            {"id": "registration", "label": "Registro del vehículo"},
            {"id": "insurance", "label": "Seguro / Insurance"},
            {"id": "ifta_sticker", "label": "Calcomanía IFTA"},
            {"id": "permits", "label": "Permisos necesarios"},
        ],
    },
]


@router.get("/inspection-template")
async def get_inspection_template():
    """Get the inspection checklist template"""
    return {"categories": INSPECTION_CATEGORIES}


@router.get("/inspections")
async def list_inspections(request: Request):
    """List user's inspections (most recent first)"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    skip = int(request.query_params.get("skip", "0"))

    inspections = []
    cursor = db.trucker_inspections.find(
        {"user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit)

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        inspections.append(doc)

    total = await db.trucker_inspections.count_documents({"user_id": user_id})

    return {"inspections": inspections, "total": total}


@router.post("/inspections")
async def create_inspection(request: Request):
    """Save a completed inspection"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    items = body.get("items", {})  # {item_id: {status: 'pass'|'fail'|'na', notes: ''}}
    total_items = len(items)
    passed = sum(1 for v in items.values() if v.get("status") == "pass")
    failed = sum(1 for v in items.values() if v.get("status") == "fail")
    na_count = sum(1 for v in items.values() if v.get("status") == "na")

    inspection = {
        "user_id": user_id,
        "type": body.get("type", "pre_trip"),  # pre_trip, post_trip, en_route
        "vehicle_id": body.get("vehicle_id", ""),
        "odometer": body.get("odometer", ""),
        "location": body.get("location", ""),
        "items": items,
        "total_items": total_items,
        "passed": passed,
        "failed": failed,
        "na_count": na_count,
        "overall_status": "fail" if failed > 0 else "pass",
        "notes": body.get("notes", ""),
        "signature": body.get("signature", ""),
        "created_at": datetime.utcnow(),
    }

    result = await db.trucker_inspections.insert_one(inspection)

    return {
        "success": True,
        "id": str(result.inserted_id),
        "overall_status": inspection["overall_status"],
        "passed": passed,
        "failed": failed,
    }


@router.get("/inspections/{inspection_id}/html")
async def get_inspection_html(inspection_id: str, request: Request):
    """Generate shareable HTML report for an inspection"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    inspection = await db.trucker_inspections.find_one(
        {"_id": ObjectId(inspection_id), "user_id": user_id}
    )
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")

    profile = await db.trucker_profiles.find_one({"user_id": user_id}) or {}

    # Build item rows HTML
    items_html = ""
    for cat in INSPECTION_CATEGORIES:
        cat_html = f'<tr><td colspan="3" style="background:#0F172A;color:#fff;padding:10px 14px;font-weight:700;font-size:13px">{cat["icon"]} {cat["label"]}</td></tr>'
        has_items = False
        for item in cat["items"]:
            item_data = inspection.get("items", {}).get(item["id"])
            if item_data:
                has_items = True
                status = item_data.get("status", "")
                notes = item_data.get("notes", "")
                if status == "pass":
                    badge = '<span style="background:#059669;color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">✅ OK</span>'
                elif status == "fail":
                    badge = '<span style="background:#DC2626;color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">❌ FALLA</span>'
                else:
                    badge = '<span style="background:#6B7280;color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">N/A</span>'
                notes_cell = f'<div style="font-size:11px;color:#DC2626;margin-top:2px">{notes}</div>' if notes else ''
                cat_html += f'<tr><td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px">{item["label"]}{notes_cell}</td><td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;text-align:center">{badge}</td></tr>'
        if has_items:
            items_html += cat_html

    status_badge = "✅ APROBADA" if inspection.get("overall_status") == "pass" else "⚠️ CON FALLOS"
    status_color = "#059669" if inspection.get("overall_status") == "pass" else "#DC2626"
    created = inspection.get("created_at", datetime.utcnow())
    date_str = created.strftime("%d/%m/%Y %H:%M")

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:-apple-system,Arial,sans-serif;color:#111827;background:#fff}}table{{border-collapse:collapse}}
@media print{{@page{{margin:0.4in;size:letter}}}}</style></head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto">
<tr><td style="background:#0F172A;padding:28px 24px;color:#fff">
  <div style="font-size:10px;letter-spacing:3px;color:#94A3B8;font-weight:700">REPORTE DE INSPECCIÓN DVIR</div>
  <div style="font-size:22px;font-weight:900;color:#fff;margin-top:4px">{profile.get('company_name', 'Mi Empresa')}</div>
  <div style="display:inline-block;background:{status_color};color:#fff;padding:5px 14px;border-radius:12px;font-size:13px;font-weight:700;margin-top:10px">{status_badge}</div>
</td></tr>
<tr><td style="background:#F1F5F9;padding:12px 24px">
  <table width="100%"><tr>
    <td><b style="font-size:11px;color:#94A3B8">FECHA</b><br><span style="font-size:13px">{date_str}</span></td>
    <td><b style="font-size:11px;color:#94A3B8">ODÓMETRO</b><br><span style="font-size:13px">{inspection.get('odometer', '-')}</span></td>
    <td><b style="font-size:11px;color:#94A3B8">UBICACIÓN</b><br><span style="font-size:13px">{inspection.get('location', '-')}</span></td>
    <td><b style="font-size:11px;color:#94A3B8">TIPO</b><br><span style="font-size:13px">{'Pre-Viaje' if inspection.get('type') == 'pre_trip' else 'Post-Viaje'}</span></td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 24px">
  <div style="display:flex;gap:10px;margin-bottom:16px">
    <div style="background:#ECFDF5;padding:12px 20px;border-radius:10px;text-align:center;flex:1"><b style="font-size:20px;color:#059669">{inspection.get('passed',0)}</b><br><span style="font-size:11px;color:#6B7280">Aprobados</span></div>
    <div style="background:#FEF2F2;padding:12px 20px;border-radius:10px;text-align:center;flex:1"><b style="font-size:20px;color:#DC2626">{inspection.get('failed',0)}</b><br><span style="font-size:11px;color:#6B7280">Fallos</span></div>
    <div style="background:#F3F4F6;padding:12px 20px;border-radius:10px;text-align:center;flex:1"><b style="font-size:20px;color:#6B7280">{inspection.get('na_count',0)}</b><br><span style="font-size:11px;color:#6B7280">N/A</span></div>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
    {items_html}
  </table>
</td></tr>
<tr><td style="background:#0F172A;padding:16px 24px;text-align:center">
  <div style="font-size:11px;color:#94A3B8">MC# {profile.get('mc_number','-')} · DOT# {profile.get('dot_number','-')} · CDL {profile.get('cdl_type','-')}</div>
  <div style="font-size:10px;color:#475569;margin-top:4px">Generado por Mi Reembolso App</div>
</td></tr>
</table></body></html>"""

    return {"html": html, "inspection_id": inspection_id}


@router.get("/ifta-report")
async def get_ifta_report(request: Request):
    """Generate IFTA report HTML with fuel by state and miles by state"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    profile = await db.trucker_profiles.find_one({"user_id": user_id}) or {}

    # Fuel by state
    fuel_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$state", "gallons": {"$sum": "$gallons"}, "cost": {"$sum": "$total_cost"}}},
        {"$sort": {"gallons": -1}},
    ]
    fuel_by_state = {}
    total_gallons = 0
    total_fuel_cost = 0
    async for doc in db.trucker_fuel.aggregate(fuel_pipeline):
        fuel_by_state[doc["_id"]] = {"gallons": doc["gallons"], "cost": doc["cost"]}
        total_gallons += doc["gallons"]
        total_fuel_cost += doc["cost"]

    # Miles by state (from states_traveled in trips)
    # Each trip records states_traveled - distribute miles evenly among states for simplicity
    miles_by_state = {}
    total_miles = 0
    total_revenue = 0
    async for trip in db.trucker_trips.find({"user_id": user_id}):
        states = trip.get("states_traveled", [])
        miles = trip.get("miles", 0)
        total_miles += miles
        total_revenue += trip.get("rate", 0)
        if states:
            per_state = miles / len(states)
            for st in states:
                miles_by_state[st] = miles_by_state.get(st, 0) + per_state

    # All states involved
    all_states = sorted(set(list(fuel_by_state.keys()) + list(miles_by_state.keys())))

    # Build HTML rows
    rows_html = ""
    for st in all_states:
        gal = fuel_by_state.get(st, {}).get("gallons", 0)
        cost = fuel_by_state.get(st, {}).get("cost", 0)
        mi = miles_by_state.get(st, 0)
        mpg = mi / gal if gal > 0 else 0
        rows_html += f"""<tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E7EB;font-weight:700;font-size:14px">{st}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px">{mi:,.1f}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px">{gal:,.1f}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px">${cost:,.2f}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px">{mpg:.1f}</td>
        </tr>"""

    avg_mpg = total_miles / total_gallons if total_gallons > 0 else 0
    now = datetime.utcnow()

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:-apple-system,Arial,sans-serif;color:#111827;background:#fff}}table{{border-collapse:collapse}}
@media print{{@page{{margin:0.4in;size:letter}}}}</style></head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;margin:0 auto">
<tr><td style="background:#0F172A;padding:28px 24px;color:#fff">
  <table width="100%"><tr>
    <td><div style="font-size:10px;letter-spacing:3px;color:#94A3B8;font-weight:700">REPORTE IFTA</div>
    <div style="font-size:22px;font-weight:900;color:#fff;margin-top:4px">{profile.get('company_name', 'Mi Empresa')}</div>
    <div style="font-size:12px;color:#94A3B8;margin-top:4px">MC# {profile.get('mc_number','-')} · DOT# {profile.get('dot_number','-')}</div></td>
    <td style="text-align:right"><div style="font-size:11px;color:#94A3B8">Período</div>
    <div style="font-size:16px;font-weight:700;color:#fff">{now.strftime('%B %Y')}</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:20px 24px">
  <div style="display:flex;gap:10px;margin-bottom:20px">
    <div style="background:#EFF6FF;padding:14px;border-radius:10px;text-align:center;flex:1"><b style="font-size:22px;color:#1E40AF">{total_miles:,.0f}</b><br><span style="font-size:11px;color:#6B7280">Millas Totales</span></div>
    <div style="background:#FFFBEB;padding:14px;border-radius:10px;text-align:center;flex:1"><b style="font-size:22px;color:#D97706">{total_gallons:,.1f}</b><br><span style="font-size:11px;color:#6B7280">Galones</span></div>
    <div style="background:#FEF2F2;padding:14px;border-radius:10px;text-align:center;flex:1"><b style="font-size:22px;color:#DC2626">${total_fuel_cost:,.2f}</b><br><span style="font-size:11px;color:#6B7280">Gasto Combustible</span></div>
    <div style="background:#ECFDF5;padding:14px;border-radius:10px;text-align:center;flex:1"><b style="font-size:22px;color:#059669">{avg_mpg:.1f}</b><br><span style="font-size:11px;color:#6B7280">MPG Promedio</span></div>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
    <tr style="background:#0F172A">
      <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">ESTADO</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">MILLAS</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">GALONES</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">COSTO</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:1px;color:#E2E8F0;font-weight:600">MPG</th>
    </tr>
    {rows_html}
    <tr style="background:#F8FAFC;font-weight:800">
      <td style="padding:12px 14px;font-size:14px">TOTAL</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px">{total_miles:,.0f}</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px">{total_gallons:,.1f}</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px">${total_fuel_cost:,.2f}</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px">{avg_mpg:.1f}</td>
    </tr>
  </table>
  <div style="margin-top:20px;padding:14px;background:#ECFDF5;border-radius:8px;border:1px solid #86EFAC">
    <b style="color:#166534;font-size:14px">💰 Resumen Financiero</b>
    <div style="display:flex;gap:20px;margin-top:8px">
      <div><span style="font-size:12px;color:#6B7280">Ingresos:</span> <b style="color:#059669">${total_revenue:,.2f}</b></div>
      <div><span style="font-size:12px;color:#6B7280">Combustible:</span> <b style="color:#DC2626">${total_fuel_cost:,.2f}</b></div>
      <div><span style="font-size:12px;color:#6B7280">Ganancia Neta:</span> <b style="color:#059669">${total_revenue - total_fuel_cost:,.2f}</b></div>
    </div>
  </div>
</td></tr>
<tr><td style="background:#0F172A;padding:16px 24px;text-align:center">
  <div style="font-size:10px;color:#475569">Generado {now.strftime('%d/%m/%Y %H:%M')} · Mi Reembolso App</div>
</td></tr>
</table></body></html>"""

    return {
        "html": html,
        "summary": {
            "total_miles": total_miles,
            "total_gallons": total_gallons,
            "total_fuel_cost": total_fuel_cost,
            "total_revenue": total_revenue,
            "net_income": total_revenue - total_fuel_cost,
            "avg_mpg": round(avg_mpg, 1),
            "states": len(all_states),
        }
    }

@router.get("/trips")
async def list_trips(request: Request):
    """List user's trip logs"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    skip = int(request.query_params.get("skip", "0"))

    trips = []
    cursor = db.trucker_trips.find(
        {"user_id": user_id}
    ).sort("trip_date", -1).skip(skip).limit(limit)

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        trips.append(doc)

    total = await db.trucker_trips.count_documents({"user_id": user_id})

    # Calculate totals
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_miles": {"$sum": "$miles"},
            "total_trips": {"$sum": 1},
        }}
    ]
    stats = None
    async for doc in db.trucker_trips.aggregate(pipeline):
        stats = doc

    return {
        "trips": trips,
        "total": total,
        "stats": {
            "total_miles": stats["total_miles"] if stats else 0,
            "total_trips": stats["total_trips"] if stats else 0,
        }
    }


@router.post("/trips")
async def create_trip(request: Request):
    """Log a new trip"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    trip = {
        "user_id": user_id,
        "trip_date": body.get("trip_date", datetime.utcnow().strftime("%Y-%m-%d")),
        "origin": body.get("origin", "").strip(),
        "origin_state": body.get("origin_state", "").strip(),
        "destination": body.get("destination", "").strip(),
        "destination_state": body.get("destination_state", "").strip(),
        "miles": float(body.get("miles", 0)),
        "loaded": body.get("loaded", True),  # loaded or empty miles
        "cargo_description": body.get("cargo_description", ""),
        "broker": body.get("broker", ""),
        "rate": float(body.get("rate", 0)),
        "states_traveled": body.get("states_traveled", []),  # list of state codes
        "notes": body.get("notes", ""),
        "created_at": datetime.utcnow(),
    }

    result = await db.trucker_trips.insert_one(trip)

    return {"success": True, "id": str(result.inserted_id)}


@router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, request: Request):
    """Delete a trip"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_trips.delete_one(
        {"_id": ObjectId(trip_id), "user_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    return {"success": True}



# ─── FUEL RECEIPT AI SCANNING ───

@router.post("/fuel/scan-receipt")
async def scan_fuel_receipt(request: Request):
    """Scan a fuel receipt image with AI to extract fuel purchase data"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    image_base64 = body.get("image_base64", "")
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    try:
        import httpx

        # Try to get API key
        api_key = None
        config = await db.admin_config.find_one({})
        if config:
            api_key = config.get("OPENAI_API_KEY") or config.get("openai_api_key")

        if not api_key:
            try:
                from receipt_ai_service import receipt_ai_service
                if receipt_ai_service.api_key:
                    api_key = receipt_ai_service.api_key
            except Exception:
                pass

        if not api_key:
            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("EMERGENT_LLM_KEY")

        if not api_key:
            return {"success": False, "error": "No hay clave API de AI configurada", "data": None}

        system_prompt = """You are a fuel receipt analyzer for truck drivers. Extract data from this fuel receipt:
- station: Gas station/truck stop name (e.g., "Pilot", "Love's", "Flying J")
- state: US state code (2-letter, e.g., "FL", "TX")
- city: City name
- gallons: Number of gallons (decimal)
- price_per_gallon: Price per gallon USD (decimal)
- total_cost: Total paid USD (decimal)
- fuel_type: "diesel", "def", or "gas"
- date: Purchase date as YYYY-MM-DD
- odometer: Odometer reading if visible (string or "")

Return ONLY valid JSON. Use null for fields you cannot determine.
Example: {"station":"Pilot","state":"FL","city":"Jacksonville","gallons":125.3,"price_per_gallon":3.89,"total_cost":487.42,"fuel_type":"diesel","date":"2026-04-15","odometer":"245000"}"""

        if not image_base64.startswith('data:'):
            image_url = f"data:image/jpeg;base64,{image_base64}"
        else:
            image_url = image_base64

        api_base = "https://api.openai.com/v1"
        headers_dict = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        if api_key and ("EMR" in api_key or "emr" in api_key):
            api_base = "https://api.emergentmind.com/v1"

        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": "Analiza este recibo de combustible y extrae la información en JSON."},
                    {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}}
                ]}
            ],
            "max_tokens": 500,
            "temperature": 0.1,
        }

        logger.info("⛽🔍 Scanning fuel receipt with AI...")

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{api_base}/chat/completions", headers=headers_dict, json=payload)

            if resp.status_code != 200:
                logger.error(f"AI fuel scan error {resp.status_code}: {resp.text[:300]}")
                return {"success": False, "error": f"Error AI: {resp.status_code}", "data": None}

            data = resp.json()
            response_text = data['choices'][0]['message']['content']
            logger.info(f"⛽ AI response: {response_text[:200]}")

            import json as json_mod
            import re
            clean = response_text.strip()
            if '```json' in clean:
                clean = clean.split('```json')[1].split('```')[0].strip()
            elif '```' in clean:
                clean = clean.split('```')[1].split('```')[0].strip()

            try:
                parsed = json_mod.loads(clean)
            except json_mod.JSONDecodeError:
                match = re.search(r'\{[^}]+\}', clean)
                if match:
                    parsed = json_mod.loads(match.group())
                else:
                    return {"success": False, "error": "No se pudo interpretar la respuesta", "data": None}

            logger.info(f"✅ Fuel receipt: {parsed.get('station')} - {parsed.get('gallons')} gal @ ${parsed.get('price_per_gallon')}/gal")

            return {
                "success": True,
                "data": {
                    "station": parsed.get("station", ""),
                    "state": (parsed.get("state") or "").upper()[:2],
                    "city": parsed.get("city", ""),
                    "gallons": parsed.get("gallons"),
                    "price_per_gallon": parsed.get("price_per_gallon"),
                    "total_cost": parsed.get("total_cost"),
                    "fuel_type": parsed.get("fuel_type", "diesel"),
                    "date": parsed.get("date", ""),
                    "odometer": str(parsed.get("odometer", "") or ""),
                },
                "confidence": 0.9,
            }

    except Exception as e:
        logger.error(f"❌ Fuel receipt scan error: {e}")
        return {"success": False, "error": str(e), "data": None}


# ─── FUEL LOGS ───

@router.get("/fuel")
async def list_fuel_logs(request: Request):
    """List user's fuel purchase logs"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    limit = int(request.query_params.get("limit", "20"))
    skip = int(request.query_params.get("skip", "0"))

    logs = []
    cursor = db.trucker_fuel.find(
        {"user_id": user_id}
    ).sort("date", -1).skip(skip).limit(limit)

    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        logs.append(doc)

    total = await db.trucker_fuel.count_documents({"user_id": user_id})

    # Stats
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_gallons": {"$sum": "$gallons"},
            "total_cost": {"$sum": "$total_cost"},
            "avg_price": {"$avg": "$price_per_gallon"},
        }}
    ]
    stats = None
    async for doc in db.trucker_fuel.aggregate(pipeline):
        stats = doc

    # IFTA: fuel by state
    ifta_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$state",
            "gallons": {"$sum": "$gallons"},
            "cost": {"$sum": "$total_cost"},
        }},
        {"$sort": {"gallons": -1}},
    ]
    ifta_by_state = []
    async for doc in db.trucker_fuel.aggregate(ifta_pipeline):
        ifta_by_state.append({"state": doc["_id"], "gallons": doc["gallons"], "cost": doc["cost"]})

    return {
        "logs": logs,
        "total": total,
        "stats": {
            "total_gallons": round(stats["total_gallons"], 2) if stats else 0,
            "total_cost": round(stats["total_cost"], 2) if stats else 0,
            "avg_price": round(stats["avg_price"], 3) if stats else 0,
        },
        "ifta_by_state": ifta_by_state,
    }


@router.post("/fuel")
async def create_fuel_log(request: Request):
    """Log a fuel purchase"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()

    gallons = float(body.get("gallons", 0))
    price_per_gallon = float(body.get("price_per_gallon", 0))
    total_cost = body.get("total_cost", gallons * price_per_gallon)

    fuel_log = {
        "user_id": user_id,
        "date": body.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
        "station": body.get("station", "").strip(),
        "state": body.get("state", "").strip().upper(),
        "city": body.get("city", "").strip(),
        "gallons": gallons,
        "price_per_gallon": price_per_gallon,
        "total_cost": float(total_cost),
        "fuel_type": body.get("fuel_type", "diesel"),
        "odometer": body.get("odometer", ""),
        "receipt_image": body.get("receipt_image", ""),
        "notes": body.get("notes", ""),
        "created_at": datetime.utcnow(),
    }

    result = await db.trucker_fuel.insert_one(fuel_log)

    return {"success": True, "id": str(result.inserted_id)}


@router.delete("/fuel/{fuel_id}")
async def delete_fuel_log(fuel_id: str, request: Request):
    """Delete a fuel log"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_fuel.delete_one(
        {"_id": ObjectId(fuel_id), "user_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    return {"success": True}


# ─── TRUCKER DASHBOARD STATS ───

@router.get("/dashboard")
async def trucker_dashboard(request: Request):
    """Get trucker dashboard summary data"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_str = month_start.strftime("%Y-%m")

    # Trucker profile
    profile = await db.trucker_profiles.find_one({"user_id": user_id})

    # This month trips
    trip_pipeline = [
        {"$match": {"user_id": user_id, "trip_date": {"$gte": month_str}}},
        {"$group": {
            "_id": None,
            "total_miles": {"$sum": "$miles"},
            "total_trips": {"$sum": 1},
            "total_revenue": {"$sum": "$rate"},
            "loaded_miles": {"$sum": {"$cond": [{"$eq": ["$loaded", True]}, "$miles", 0]}},
            "empty_miles": {"$sum": {"$cond": [{"$eq": ["$loaded", False]}, "$miles", 0]}},
        }}
    ]
    trip_stats = None
    async for doc in db.trucker_trips.aggregate(trip_pipeline):
        trip_stats = doc

    # This month fuel
    fuel_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": month_str}}},
        {"$group": {
            "_id": None,
            "total_gallons": {"$sum": "$gallons"},
            "total_fuel_cost": {"$sum": "$total_cost"},
        }}
    ]
    fuel_stats = None
    async for doc in db.trucker_fuel.aggregate(fuel_pipeline):
        fuel_stats = doc

    # Recent inspections
    last_inspection = await db.trucker_inspections.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )

    # States traveled this month
    states_pipeline = [
        {"$match": {"user_id": user_id, "trip_date": {"$gte": month_str}}},
        {"$unwind": "$states_traveled"},
        {"$group": {"_id": "$states_traveled"}},
        {"$sort": {"_id": 1}},
    ]
    states_this_month = []
    async for doc in db.trucker_trips.aggregate(states_pipeline):
        states_this_month.append(doc["_id"])

    miles = trip_stats["total_miles"] if trip_stats else 0
    fuel_cost = fuel_stats["total_fuel_cost"] if fuel_stats else 0
    revenue = trip_stats["total_revenue"] if trip_stats else 0
    gallons = fuel_stats["total_gallons"] if fuel_stats else 0

    return {
        "has_profile": bool(profile),
        "business_subtype": profile.get("business_subtype", "") if profile else "",
        "month": now.strftime("%B %Y"),
        "trips": {
            "total": trip_stats["total_trips"] if trip_stats else 0,
            "miles": round(miles, 1),
            "loaded_miles": round(trip_stats["loaded_miles"], 1) if trip_stats else 0,
            "empty_miles": round(trip_stats["empty_miles"], 1) if trip_stats else 0,
            "revenue": round(revenue, 2),
        },
        "fuel": {
            "gallons": round(gallons, 1),
            "cost": round(fuel_cost, 2),
            "avg_mpg": round(miles / gallons, 1) if gallons > 0 else 0,
            "cost_per_mile": round(fuel_cost / miles, 2) if miles > 0 else 0,
        },
        "net_income": round(revenue - fuel_cost, 2),
        "states_traveled": states_this_month,
        "last_inspection": {
            "date": last_inspection["created_at"].isoformat() if last_inspection else None,
            "status": last_inspection["overall_status"] if last_inspection else None,
            "failed_items": last_inspection.get("failed", 0) if last_inspection else 0,
        } if last_inspection else None,
    }


# ═══════════════════════════════════════════════════════════════
# ─── IFTA QUARTERLY REPORT GENERATOR ───
# ═══════════════════════════════════════════════════════════════

# 2026 Q1 Diesel Tax Rates ($/gallon) — Source: IFTA Tax Rate Matrix
IFTA_DIESEL_RATES = {
    "AL": 0.3100, "AZ": 0.2600, "AR": 0.2850, "CA": 0.9710, "CO": 0.3250,
    "CT": 0.4890, "DE": 0.2200, "FL": 0.4027, "GA": 0.3710, "ID": 0.3200,
    "IL": 0.7490, "IN": 0.6100, "IA": 0.3250, "KS": 0.2600, "KY": 0.2200,
    "LA": 0.2000, "ME": 0.3120, "MD": 0.4675, "MA": 0.2400, "MI": 0.5240,
    "MN": 0.3260, "MS": 0.2100, "MO": 0.2950, "MT": 0.2975, "NE": 0.3180,
    "NV": 0.2700, "NH": 0.2220, "NJ": 0.5190, "NM": 0.2100, "NY": 0.3875,
    "NC": 0.4100, "ND": 0.2300, "OH": 0.4700, "OK": 0.1900, "OR": 0.3800,
    "PA": 0.7410, "RI": 0.4000, "SC": 0.2800, "SD": 0.2800, "TN": 0.2700,
    "TX": 0.2000, "UT": 0.3790, "VT": 0.3100, "VA": 0.3270, "WA": 0.5840,
    "WV": 0.3570, "WI": 0.3290, "WY": 0.2400,
}

QUARTER_DATES = {
    "Q1": {"start_month": 1, "end_month": 3, "deadline": "April 30"},
    "Q2": {"start_month": 4, "end_month": 6, "deadline": "July 31"},
    "Q3": {"start_month": 7, "end_month": 9, "deadline": "October 31"},
    "Q4": {"start_month": 10, "end_month": 12, "deadline": "January 31"},
}


@router.get("/ifta/tax-rates")
async def get_ifta_tax_rates():
    """Get current IFTA diesel tax rates by state."""
    rates = [{"state": k, "rate": v} for k, v in sorted(IFTA_DIESEL_RATES.items())]
    return {
        "rates": rates,
        "quarter": "Q1 2026",
        "fuel_type": "diesel",
        "note": "Rates sourced from IFTA Tax Rate Matrix. Verify with base jurisdiction.",
    }


@router.get("/ifta/quarterly-report")
async def generate_ifta_quarterly_report(request: Request):
    """
    Generate a complete IFTA quarterly report with tax calculations.
    Query params: quarter (Q1-Q4), year (2026)
    """
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    quarter = request.query_params.get("quarter", "Q1").upper()
    year = int(request.query_params.get("year", "2026"))

    if quarter not in QUARTER_DATES:
        raise HTTPException(status_code=400, detail="Quarter inválido. Usa Q1, Q2, Q3, Q4.")

    qd = QUARTER_DATES[quarter]
    start_date = f"{year}-{qd['start_month']:02d}-01"
    end_month = qd['end_month']
    if end_month in [1, 3, 5, 7, 8, 10, 12]:
        end_day = 31
    elif end_month in [4, 6, 9, 11]:
        end_day = 30
    else:
        end_day = 28
    end_date = f"{year}-{end_month:02d}-{end_day}"

    # Get all trips in this quarter
    trips_cursor = db.trucker_trips.find({
        "user_id": user_id,
        "created_at": {"$gte": datetime.fromisoformat(start_date), "$lte": datetime.fromisoformat(end_date + "T23:59:59")},
    })
    trips = []
    total_miles = 0
    miles_by_state = {}

    async for trip in trips_cursor:
        trips.append(trip)
        total_miles += float(trip.get("miles", 0))
        for state in trip.get("states_traveled", []):
            # Distribute miles evenly across states if no per-state breakdown
            state_miles = float(trip.get("miles", 0)) / max(len(trip.get("states_traveled", [])), 1)
            miles_by_state[state] = miles_by_state.get(state, 0) + state_miles

    # Get all fuel purchases in this quarter
    fuel_cursor = db.trucker_fuel.find({
        "user_id": user_id,
        "created_at": {"$gte": datetime.fromisoformat(start_date), "$lte": datetime.fromisoformat(end_date + "T23:59:59")},
    })
    total_gallons = 0
    total_fuel_cost = 0
    gallons_by_state = {}

    async for fuel in fuel_cursor:
        gallons = float(fuel.get("gallons", 0))
        total_gallons += gallons
        total_fuel_cost += float(fuel.get("total_cost", 0))
        state = fuel.get("state", "").upper()
        if state:
            gallons_by_state[state] = gallons_by_state.get(state, 0) + gallons

    # Calculate MPG
    mpg = total_miles / total_gallons if total_gallons > 0 else 6.0  # Default 6 MPG for semis

    # Calculate IFTA tax per state
    all_states = set(list(miles_by_state.keys()) + list(gallons_by_state.keys()))
    state_reports = []
    total_tax_due = 0
    total_tax_paid = 0
    total_net_tax = 0

    for state in sorted(all_states):
        state_miles = miles_by_state.get(state, 0)
        state_gallons_purchased = gallons_by_state.get(state, 0)
        tax_rate = IFTA_DIESEL_RATES.get(state, 0.30)

        # IFTA Formula:
        # Taxable gallons = Miles in state / Fleet MPG
        taxable_gallons = state_miles / mpg if mpg > 0 else 0

        # Tax owed = Taxable gallons × State rate
        tax_owed = taxable_gallons * tax_rate

        # Tax paid = Gallons purchased × State rate (included at pump)
        tax_paid = state_gallons_purchased * tax_rate

        # Net = Owed - Paid (positive = you owe, negative = refund)
        net_tax = tax_owed - tax_paid

        total_tax_due += tax_owed
        total_tax_paid += tax_paid
        total_net_tax += net_tax

        state_reports.append({
            "state": state,
            "miles": round(state_miles, 1),
            "taxable_gallons": round(taxable_gallons, 2),
            "gallons_purchased": round(state_gallons_purchased, 2),
            "tax_rate": tax_rate,
            "tax_owed": round(tax_owed, 2),
            "tax_paid": round(tax_paid, 2),
            "net_tax": round(net_tax, 2),
            "status": "owe" if net_tax > 0 else "credit",
        })

    # Get trucker profile for report header
    profile = await db.trucker_profiles.find_one({"user_id": user_id})

    report = {
        "quarter": quarter,
        "year": year,
        "period": f"{start_date} to {end_date}",
        "deadline": f"{qd['deadline']}, {year if quarter != 'Q4' else year + 1}",
        "carrier_info": {
            "company": profile.get("company_name", "") if profile else "",
            "mc_number": profile.get("mc_number", "") if profile else "",
            "dot_number": profile.get("dot_number", "") if profile else "",
            "home_state": profile.get("home_state", "") if profile else "",
        },
        "summary": {
            "total_miles": round(total_miles, 1),
            "total_gallons": round(total_gallons, 2),
            "total_fuel_cost": round(total_fuel_cost, 2),
            "fleet_mpg": round(mpg, 2),
            "total_trips": len(trips),
            "states_traveled": len(all_states),
            "total_tax_owed": round(total_tax_due, 2),
            "total_tax_paid": round(total_tax_paid, 2),
            "net_tax_due": round(total_net_tax, 2),
            "net_status": "DEBE" if total_net_tax > 0 else "CRÉDITO",
        },
        "state_reports": state_reports,
    }

    return {"success": True, "report": report}


@router.get("/ifta/quarterly-report/export")
async def export_ifta_report(request: Request):
    """Export IFTA quarterly report as HTML (for PDF rendering)."""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    quarter = request.query_params.get("quarter", "Q1").upper()
    year = int(request.query_params.get("year", "2026"))

    # Reuse the report generation logic
    from starlette.responses import HTMLResponse
    import json

    # Get the report data
    # Create a mock request to reuse logic
    class MockReq:
        def __init__(self, qp, headers):
            self.query_params = qp
            self.headers = headers
    mock = MockReq({"quarter": quarter, "year": str(year)}, request.headers)
    # Direct call - since we can't easily redirect, recalculate inline
    qd = QUARTER_DATES[quarter]
    start_date = f"{year}-{qd['start_month']:02d}-01"
    end_month = qd['end_month']
    end_day = 31 if end_month in [1,3,5,7,8,10,12] else (30 if end_month in [4,6,9,11] else 28)
    end_date = f"{year}-{end_month:02d}-{end_day}"

    trips_cursor = db.trucker_trips.find({
        "user_id": user_id,
        "created_at": {"$gte": datetime.fromisoformat(start_date), "$lte": datetime.fromisoformat(end_date + "T23:59:59")},
    })
    total_miles = 0
    miles_by_state = {}
    trip_count = 0
    async for trip in trips_cursor:
        trip_count += 1
        total_miles += float(trip.get("miles", 0))
        for state in trip.get("states_traveled", []):
            sm = float(trip.get("miles", 0)) / max(len(trip.get("states_traveled", [])), 1)
            miles_by_state[state] = miles_by_state.get(state, 0) + sm

    fuel_cursor = db.trucker_fuel.find({
        "user_id": user_id,
        "created_at": {"$gte": datetime.fromisoformat(start_date), "$lte": datetime.fromisoformat(end_date + "T23:59:59")},
    })
    total_gallons = 0
    total_fuel_cost = 0
    gallons_by_state = {}
    async for fuel in fuel_cursor:
        g = float(fuel.get("gallons", 0))
        total_gallons += g
        total_fuel_cost += float(fuel.get("total_cost", 0))
        st = fuel.get("state", "").upper()
        if st:
            gallons_by_state[st] = gallons_by_state.get(st, 0) + g

    mpg = total_miles / total_gallons if total_gallons > 0 else 6.0
    all_states = sorted(set(list(miles_by_state.keys()) + list(gallons_by_state.keys())))

    profile = await db.trucker_profiles.find_one({"user_id": user_id})
    company = profile.get("company_name", "—") if profile else "—"
    mc = profile.get("mc_number", "—") if profile else "—"
    dot = profile.get("dot_number", "—") if profile else "—"

    # Build HTML rows
    rows_html = ""
    total_tax_owed = 0
    total_tax_paid = 0
    total_net = 0
    for state in all_states:
        sm = miles_by_state.get(state, 0)
        sg = gallons_by_state.get(state, 0)
        rate = IFTA_DIESEL_RATES.get(state, 0.30)
        taxable = sm / mpg if mpg > 0 else 0
        owed = taxable * rate
        paid = sg * rate
        net = owed - paid
        total_tax_owed += owed
        total_tax_paid += paid
        total_net += net
        color = "#DC2626" if net > 0 else "#059669"
        rows_html += f"""<tr>
            <td style="font-weight:600">{state}</td>
            <td style="text-align:right">{sm:,.1f}</td>
            <td style="text-align:right">{taxable:,.2f}</td>
            <td style="text-align:right">{sg:,.2f}</td>
            <td style="text-align:right">${rate:.4f}</td>
            <td style="text-align:right">${owed:,.2f}</td>
            <td style="text-align:right">${paid:,.2f}</td>
            <td style="text-align:right;color:{color};font-weight:700">${net:,.2f}</td>
        </tr>"""

    net_label = "DEBE" if total_net > 0 else "CRÉDITO"
    net_color = "#DC2626" if total_net > 0 else "#059669"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>IFTA Report {quarter} {year}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 30px; color: #1C1C1E; font-size: 12px; }}
h1 {{ color: #1E40AF; font-size: 20px; margin-bottom: 4px; }}
h2 {{ color: #374151; font-size: 14px; margin-top: 20px; }}
.header {{ border-bottom: 2px solid #1E40AF; padding-bottom: 12px; margin-bottom: 16px; }}
.info {{ display: flex; gap: 30px; margin-bottom: 12px; }}
.info div {{ font-size: 11px; }}
.info label {{ font-weight: 700; color: #6B7280; }}
.summary {{ background: #EFF6FF; border-radius: 8px; padding: 14px; margin-bottom: 16px; display: flex; gap: 20px; flex-wrap: wrap; }}
.stat {{ text-align: center; }}
.stat .val {{ font-size: 18px; font-weight: 800; color: #1E40AF; }}
.stat .lbl {{ font-size: 10px; color: #6B7280; }}
table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
th {{ background: #F3F4F6; padding: 8px 6px; text-align: left; font-weight: 700; border-bottom: 2px solid #D1D5DB; }}
td {{ padding: 6px; border-bottom: 1px solid #E5E7EB; }}
.footer {{ margin-top: 20px; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 10px; }}
.net-box {{ background: {net_color}15; border: 2px solid {net_color}; border-radius: 8px; padding: 12px; text-align: center; margin-top: 12px; }}
.net-box .amount {{ font-size: 24px; font-weight: 900; color: {net_color}; }}
</style></head><body>
<div class="header">
    <h1>📋 IFTA Quarterly Fuel Tax Report</h1>
    <p style="margin:0;color:#6B7280">{quarter} {year} — Período: {start_date} al {end_date}</p>
    <p style="margin:4px 0 0;color:#DC2626;font-weight:600">📅 Fecha límite: {qd['deadline']}, {year if quarter != 'Q4' else year + 1}</p>
</div>

<div class="info">
    <div><label>Empresa:</label> {company}</div>
    <div><label>MC#:</label> {mc}</div>
    <div><label>DOT#:</label> {dot}</div>
    <div><label>Fleet MPG:</label> {mpg:.2f}</div>
</div>

<div class="summary">
    <div class="stat"><div class="val">{total_miles:,.0f}</div><div class="lbl">Millas Totales</div></div>
    <div class="stat"><div class="val">{total_gallons:,.0f}</div><div class="lbl">Galones Totales</div></div>
    <div class="stat"><div class="val">{trip_count}</div><div class="lbl">Viajes</div></div>
    <div class="stat"><div class="val">{len(all_states)}</div><div class="lbl">Estados</div></div>
    <div class="stat"><div class="val">${total_fuel_cost:,.2f}</div><div class="lbl">Costo Combustible</div></div>
</div>

<h2>Desglose por Estado / Jurisdicción</h2>
<table>
<thead><tr>
    <th>Estado</th><th style="text-align:right">Millas</th><th style="text-align:right">Gal. Gravables</th>
    <th style="text-align:right">Gal. Comprados</th><th style="text-align:right">Tasa</th>
    <th style="text-align:right">Impuesto Debido</th><th style="text-align:right">Impuesto Pagado</th>
    <th style="text-align:right">Neto</th>
</tr></thead>
<tbody>{rows_html}
<tr style="font-weight:800;border-top:2px solid #374151">
    <td>TOTAL</td><td style="text-align:right">{total_miles:,.1f}</td>
    <td style="text-align:right">{total_miles/mpg if mpg > 0 else 0:,.2f}</td>
    <td style="text-align:right">{total_gallons:,.2f}</td><td></td>
    <td style="text-align:right">${total_tax_owed:,.2f}</td>
    <td style="text-align:right">${total_tax_paid:,.2f}</td>
    <td style="text-align:right;color:{net_color}">${total_net:,.2f}</td>
</tr></tbody></table>

<div class="net-box">
    <div style="font-size:12px;color:#6B7280">{net_label}</div>
    <div class="amount">${abs(total_net):,.2f}</div>
    <div style="font-size:11px;color:#6B7280">{'Monto a pagar al estado base' if total_net > 0 else 'Crédito / Reembolso disponible'}</div>
</div>

<div class="footer">
    <p>Generado automáticamente por Ross Tax — Herramientas del Camionero</p>
    <p>Fórmula IFTA: Galones Gravables = Millas en Estado ÷ MPG Fleet. Impuesto = Gal. Gravables × Tasa Estatal.</p>
    <p>⚠️ Verifique las tasas con el IFTA Tax Rate Matrix oficial antes de presentar. Este reporte es informativo.</p>
</div>
</body></html>"""

    return HTMLResponse(content=html)


# ─── SAVED ADDRESSES ───

@router.get("/addresses")
async def list_saved_addresses(request: Request):
    """List user's saved addresses for quick selection in trip forms"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    cursor = db.trucker_addresses.find({"user_id": user_id}).sort("used_count", -1).limit(20)
    addresses = []
    async for addr in cursor:
        addresses.append({
            "_id": str(addr["_id"]),
            "label": addr.get("label", ""),
            "address": addr.get("address", ""),
            "state": addr.get("state", ""),
            "used_count": addr.get("used_count", 0),
            "type": addr.get("type", "general"),  # origin, destination, general
        })
    return {"success": True, "addresses": addresses}


@router.post("/addresses")
async def save_address(request: Request):
    """Save a new address or increment usage count if it exists"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    body = await request.json()
    address = body.get("address", "").strip()
    label = body.get("label", "").strip()
    state = body.get("state", "").strip()
    addr_type = body.get("type", "general")

    if not address:
        raise HTTPException(status_code=400, detail="Dirección requerida")

    # Auto-generate label from address if not provided
    if not label:
        parts = address.split(',')
        label = parts[0].strip() if parts else address[:30]

    # Check if address already exists for this user
    existing = await db.trucker_addresses.find_one({
        "user_id": user_id,
        "address": address,
    })

    if existing:
        # Increment usage count
        await db.trucker_addresses.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"used_count": 1}, "$set": {"last_used": datetime.utcnow()}}
        )
        return {"success": True, "action": "incremented", "id": str(existing["_id"])}
    else:
        # Create new
        doc = {
            "user_id": user_id,
            "label": label,
            "address": address,
            "state": state.upper() if state else "",
            "type": addr_type,
            "used_count": 1,
            "created_at": datetime.utcnow(),
            "last_used": datetime.utcnow(),
        }
        result = await db.trucker_addresses.insert_one(doc)
        return {"success": True, "action": "created", "id": str(result.inserted_id)}


@router.delete("/addresses/{address_id}")
async def delete_saved_address(request: Request, address_id: str):
    """Delete a saved address"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")

    result = await db.trucker_addresses.delete_one({
        "_id": ObjectId(address_id),
        "user_id": user_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dirección no encontrada")
    return {"success": True}


# ─── VIN DECODER ───

@router.get("/vin-decode/{vin}")
async def decode_vin(vin: str):
    """Decode a VIN using NHTSA free API and return vehicle details"""
    import httpx
    
    vin = vin.strip().upper()
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN debe tener exactamente 17 caracteres")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
            )
        
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Error al conectar con NHTSA")
        
        data = resp.json()
        results = data.get("Results", [{}])
        r = results[0] if results else {}
        
        # Map body class to our vehicle types
        body = (r.get("BodyClass", "") or "").lower()
        if "sedan" in body or "coupe" in body or "hatchback" in body or "convertible" in body:
            vehicle_type = "sedan"
        elif "suv" in body or "sport utility" in body:
            vehicle_type = "suv"
        elif "pickup" in body or "truck" in body:
            vehicle_type = "pickup"
        elif "van" in body or "minivan" in body:
            vehicle_type = "van"
        elif "motorcycle" in body:
            vehicle_type = "motorcycle"
        else:
            vehicle_type = "sedan"
        
        # Parse weight from GVWR
        weight = 0
        gvwr = r.get("GVWR", "") or ""
        import re
        weight_match = re.search(r'([\d,]+)\s*(?:lb|pound)', gvwr, re.IGNORECASE)
        if weight_match:
            weight = int(weight_match.group(1).replace(",", ""))
        
        return {
            "success": True,
            "vin": vin,
            "year": r.get("ModelYear", ""),
            "make": r.get("Make", ""),
            "model": r.get("Model", ""),
            "type": vehicle_type,
            "body_class": r.get("BodyClass", ""),
            "doors": r.get("Doors", ""),
            "drive_type": r.get("DriveType", ""),
            "engine": f"{r.get('DisplacementL', '')}L {r.get('EngineCylinders', '')}cyl",
            "weight_lbs": weight,
            "fuel_type": r.get("FuelTypePrimary", ""),
            "vehicle_type_raw": r.get("VehicleType", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIN decode error: {e}")
        raise HTTPException(status_code=500, detail=f"Error decodificando VIN: {str(e)}")


# ─── VEHICLE INSPECTION (Car Hauler) ───

@router.post("/car-hauler/vehicle-inspections")
async def create_vehicle_inspection(request: Request):
    """Create a vehicle inspection with photos for car hauler loads"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    
    body = await request.json()
    
    doc = {
        "user_id": user_id,
        "load_id": body.get("load_id", ""),
        "slot": body.get("slot", ""),
        "vin": body.get("vin", ""),
        "vehicle_info": body.get("vehicle_info", {}),
        "inspection_type": body.get("inspection_type", "pickup"),  # pickup or delivery
        "photos": body.get("photos", []),  # [{base64, label, timestamp}]
        "condition_notes": body.get("condition_notes", ""),
        "damage_reported": body.get("damage_reported", False),
        "damage_details": body.get("damage_details", ""),
        "odometer": body.get("odometer", ""),
        "created_at": datetime.utcnow(),
    }
    
    result = await db.vehicle_inspections.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}


@router.get("/car-hauler/vehicle-inspections/{load_id}")
async def get_vehicle_inspections(request: Request, load_id: str):
    """Get all vehicle inspections for a car hauler load"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    
    cursor = db.vehicle_inspections.find({"user_id": user_id, "load_id": load_id}).sort("created_at", -1)
    inspections = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        inspections.append(doc)
    
    return {"success": True, "inspections": inspections}


# ═══════════════════════════════════════════════════════════
# ADMIN ENDPOINTS — For Web Admin Bookkeeping Trucker Module
# ═══════════════════════════════════════════════════════════

async def _require_admin(request: Request):
    """Check that the request comes from an admin user"""
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autorizado")
    # user_id is UUID string, query by 'id' field not '_id'
    user = await db.users.find_one({"id": user_id})
    if not user:
        # Fallback: try querying by _id as string
        user = await db.users.find_one({"_id": user_id})
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    return user


async def _get_user_name(user_id: str) -> tuple:
    """Get user name and email from user_id (UUID format)"""
    if not user_id:
        return "Desconocido", ""
    user = await db.users.find_one({"id": user_id}, {"first_name": 1, "last_name": 1, "email": 1})
    if not user:
        user = await db.users.find_one({"_id": user_id}, {"first_name": 1, "last_name": 1, "email": 1})
    if user:
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        return name or "Sin nombre", user.get("email", "")
    return "Desconocido", ""


@router.get("/admin/dashboard")
async def admin_trucker_dashboard(request: Request):
    """Get overview stats of all trucker activity for admin dashboard"""
    try:
        await _require_admin(request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")

    try:
        # GPS Routes stats
        total_routes = await db.trucker_gps_routes.count_documents({})
        active_routes = await db.trucker_gps_routes.count_documents({"status": "active"})
        completed_routes = await db.trucker_gps_routes.count_documents({"status": "completed"})

        # Total miles
        pipeline = [{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total_miles": {"$sum": "$total_miles"}}}]
        miles_result = await db.trucker_gps_routes.aggregate(pipeline).to_list(1)
        total_miles = miles_result[0]["total_miles"] if miles_result else 0

        # Car Hauler loads
        total_loads = await db.trucker_car_hauler_loads.count_documents({})
        active_loads = await db.trucker_car_hauler_loads.count_documents({"status": {"$in": ["planning", "in_transit"]}})
        delivered_loads = await db.trucker_car_hauler_loads.count_documents({"status": "delivered"})

        # Total vehicles transported
        veh_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_vehicles"}}}]
        veh_result = await db.trucker_car_hauler_loads.aggregate(veh_pipeline).to_list(1)
        total_vehicles = veh_result[0]["total"] if veh_result else 0

        # Vehicle inspections
        total_inspections = await db.vehicle_inspections.count_documents({})

        # IFTA reports
        total_ifta = await db.trucker_ifta_reports.count_documents({})

        # Unique truckers (users who have GPS routes)
        trucker_ids = await db.trucker_gps_routes.distinct("user_id")
        total_truckers = len(trucker_ids)

        return {
            "success": True,
            "stats": {
                "total_truckers": total_truckers,
                "gps": {"total": total_routes, "active": active_routes, "completed": completed_routes, "total_miles": round(total_miles, 1)},
                "loads": {"total": total_loads, "active": active_loads, "delivered": delivered_loads, "total_vehicles": total_vehicles},
                "inspections": total_inspections,
                "ifta_reports": total_ifta,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")


@router.get("/admin/gps-routes")
async def admin_gps_routes(request: Request, limit: int = 50, skip: int = 0):
    """Get all GPS routes across all users for admin view"""
    await _require_admin(request)

    cursor = db.trucker_gps_routes.find({}).sort("created_at", -1).skip(skip).limit(limit)
    routes = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("user_id"):
            name, email = await _get_user_name(doc["user_id"])
            doc["user_name"] = name
            doc["user_email"] = email
        for key in ["created_at", "completed_at", "started_at"]:
            if key in doc and hasattr(doc[key], "isoformat"):
                doc[key] = doc[key].isoformat()
        routes.append(doc)

    total = await db.trucker_gps_routes.count_documents({})
    return {"success": True, "routes": routes, "total": total}


@router.get("/admin/car-hauler-loads")
async def admin_car_hauler_loads(request: Request, limit: int = 50, skip: int = 0):
    """Get all car hauler loads across all users for admin view"""
    await _require_admin(request)

    cursor = db.trucker_car_hauler_loads.find({}).sort("created_at", -1).skip(skip).limit(limit)
    loads = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("user_id"):
            name, _ = await _get_user_name(doc["user_id"])
            doc["user_name"] = name
        for key in ["created_at", "updated_at"]:
            if key in doc and hasattr(doc[key], "isoformat"):
                doc[key] = doc[key].isoformat()
        loads.append(doc)

    total = await db.trucker_car_hauler_loads.count_documents({})
    return {"success": True, "loads": loads, "total": total}


@router.get("/admin/vehicle-inspections")
async def admin_vehicle_inspections(request: Request, limit: int = 50, skip: int = 0):
    """Get all vehicle inspections across all users"""
    await _require_admin(request)

    cursor = db.vehicle_inspections.find({}).sort("created_at", -1).skip(skip).limit(limit)
    inspections = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if doc.get("user_id"):
            name, _ = await _get_user_name(doc["user_id"])
            doc["user_name"] = name
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        inspections.append(doc)

    total = await db.vehicle_inspections.count_documents({})
    return {"success": True, "inspections": inspections, "total": total}
