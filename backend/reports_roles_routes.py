"""
Advanced Reports & Roles/Permissions
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from bson import ObjectId
from datetime import datetime, timedelta
import pytz

router = APIRouter(prefix="/api/admin", tags=["Reports & Roles"])
CT = pytz.timezone("America/Chicago")

_db = None

def set_reports_database(database):
    global _db
    _db = database

def serialize(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ═══════════════════════════════════════════════
# ADVANCED REPORTS
# ═══════════════════════════════════════════════

@router.get("/reports/revenue")
async def revenue_report(period: str = "monthly"):
    """Revenue report by period (daily, weekly, monthly, yearly)"""
    db = _db
    now = datetime.now(CT)
    
    # Determine date ranges
    if period == "daily":
        start = now - timedelta(days=30)
        group_format = "%Y-%m-%d"
    elif period == "weekly":
        start = now - timedelta(weeks=12)
        group_format = "%Y-W%U"
    elif period == "yearly":
        start = now - timedelta(days=365*3)
        group_format = "%Y"
    else:  # monthly
        start = now - timedelta(days=365)
        group_format = "%Y-%m"

    # Get invoices grouped by period
    pipeline = [
        {"$match": {"created_at": {"$gte": start.isoformat()}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10 if period == "daily" else 7]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
            "paid": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$amount", 0]}},
            "pending": {"$sum": {"$cond": [{"$ne": ["$status", "paid"]}, "$amount", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    
    try:
        data = await db.invoices.aggregate(pipeline).to_list(365)
    except:
        data = []

    # Summary stats
    total_revenue = sum(d.get("total", 0) for d in data)
    total_paid = sum(d.get("paid", 0) for d in data)
    total_pending = sum(d.get("pending", 0) for d in data)
    total_invoices = sum(d.get("count", 0) for d in data)

    return {
        "period": period,
        "data": data,
        "summary": {
            "total_revenue": total_revenue,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "total_invoices": total_invoices,
            "avg_per_period": total_revenue / max(len(data), 1),
        }
    }


@router.get("/reports/clients")
async def clients_report():
    """Client growth and demographics report"""
    db = _db
    now = datetime.now(CT)
    
    # Total clients
    total = await db.users.count_documents({"role": {"$ne": "admin"}})
    
    # Clients created per month (last 12 months)
    pipeline = [
        {"$match": {"role": {"$ne": "admin"}}},
        {"$group": {
            "_id": {"$substr": [{"$ifNull": ["$created_at", "2024-01"]}, 0, 7]},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12},
    ]
    
    try:
        growth = await db.users.aggregate(pipeline).to_list(12)
    except:
        growth = []
    
    # KYC Stats
    kyc_complete = await db.users.count_documents({"kyc_completed": True})
    has_app = await db.users.count_documents({"has_app": True})
    
    # Active in last 30 days
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    active_30d = await db.users.count_documents({"last_access": {"$gte": thirty_days_ago}})
    
    return {
        "total": total,
        "growth": growth,
        "kyc_complete": kyc_complete,
        "has_app": has_app,
        "active_30d": active_30d,
        "kyc_rate": round(kyc_complete / max(total, 1) * 100, 1),
        "app_rate": round(has_app / max(total, 1) * 100, 1),
    }


@router.get("/reports/services")
async def services_report():
    """Service performance report"""
    db = _db
    
    # Tax returns by status
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }}
    ]
    
    try:
        status_data = await db.tax_returns.aggregate(pipeline).to_list(20)
    except:
        status_data = []
    
    # Top services
    try:
        service_pipeline = [
            {"$group": {
                "_id": "$service_type",
                "count": {"$sum": 1},
                "revenue": {"$sum": "$amount"},
            }},
            {"$sort": {"revenue": -1}},
            {"$limit": 10},
        ]
        top_services = await db.invoices.aggregate(service_pipeline).to_list(10)
    except:
        top_services = []
    
    return {
        "status_breakdown": status_data,
        "top_services": top_services,
    }


@router.get("/reports/overview")
async def overview_report():
    """Full dashboard overview with key metrics"""
    db = _db
    now = datetime.now(CT)
    today = now.replace(hour=0, minute=0, second=0).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0).isoformat()
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0).isoformat()
    
    # Counts
    total_clients = await db.users.count_documents({"role": {"$ne": "admin"}})
    total_invoices = await db.invoices.count_documents({})
    
    # Revenue calculations
    try:
        rev_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        total_rev = await db.invoices.aggregate(rev_pipeline).to_list(1)
        total_revenue = total_rev[0]["total"] if total_rev else 0
    except:
        total_revenue = 0
    
    try:
        monthly_pipeline = [
            {"$match": {"created_at": {"$gte": month_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
        monthly = await db.invoices.aggregate(monthly_pipeline).to_list(1)
        monthly_revenue = monthly[0]["total"] if monthly else 0
        monthly_invoices = monthly[0]["count"] if monthly else 0
    except:
        monthly_revenue = 0
        monthly_invoices = 0
    
    # Appointments today
    try:
        appts_today = await db.appointments.count_documents({"date": {"$regex": now.strftime("%Y-%m-%d")}})
    except:
        appts_today = 0
    
    # Leads this month
    try:
        leads_month = await db.leads.count_documents({"created_at": {"$gte": month_start}})
    except:
        leads_month = 0
    
    # Pending documents
    try:
        pending_docs = await db.documents.count_documents({"status": "pending"})
    except:
        pending_docs = 0
    
    return {
        "total_clients": total_clients,
        "total_invoices": total_invoices,
        "total_revenue": total_revenue,
        "monthly_revenue": monthly_revenue,
        "monthly_invoices": monthly_invoices,
        "appointments_today": appts_today,
        "leads_this_month": leads_month,
        "pending_documents": pending_docs,
    }


# ═══════════════════════════════════════════════
# ROLES & PERMISSIONS
# ═══════════════════════════════════════════════

DEFAULT_ROLES = {
    "super_admin": {
        "name": "Super Admin",
        "name_es": "Super Administrador",
        "color": "#EF4444",
        "permissions": ["*"],
        "description": "Full access to all features",
        "description_es": "Acceso completo a todas las funciones",
    },
    "admin": {
        "name": "Admin",
        "name_es": "Administrador",
        "color": "#F59E0B",
        "permissions": ["clients.*", "invoices.*", "appointments.*", "leads.*", "reports.view", "documents.*", "kb.*"],
        "description": "Full access except system settings",
        "description_es": "Acceso completo excepto configuración del sistema",
    },
    "tax_preparer": {
        "name": "Tax Preparer",
        "name_es": "Preparador de Impuestos",
        "color": "#3B82F6",
        "permissions": ["clients.view", "clients.edit", "tax_returns.*", "documents.*", "appointments.view"],
        "description": "Can manage tax returns and client documents",
        "description_es": "Puede gestionar declaraciones y documentos de clientes",
    },
    "receptionist": {
        "name": "Receptionist",
        "name_es": "Recepcionista",
        "color": "#8B5CF6",
        "permissions": ["clients.view", "clients.create", "appointments.*", "leads.create", "leads.view"],
        "description": "Can manage appointments and create leads",
        "description_es": "Puede gestionar citas y crear leads",
    },
    "viewer": {
        "name": "Viewer",
        "name_es": "Solo Lectura",
        "color": "#6B7280",
        "permissions": ["clients.view", "invoices.view", "reports.view"],
        "description": "Read-only access to basic data",
        "description_es": "Acceso de solo lectura a datos básicos",
    },
}

PERMISSION_CATEGORIES = {
    "clients": {
        "label": "Clients",
        "label_es": "Clientes",
        "permissions": ["clients.view", "clients.create", "clients.edit", "clients.delete"],
    },
    "invoices": {
        "label": "Invoices",
        "label_es": "Facturas",
        "permissions": ["invoices.view", "invoices.create", "invoices.edit", "invoices.delete"],
    },
    "appointments": {
        "label": "Appointments",
        "label_es": "Citas",
        "permissions": ["appointments.view", "appointments.create", "appointments.edit", "appointments.delete"],
    },
    "leads": {
        "label": "Leads",
        "label_es": "Leads",
        "permissions": ["leads.view", "leads.create", "leads.edit", "leads.delete"],
    },
    "documents": {
        "label": "Documents",
        "label_es": "Documentos",
        "permissions": ["documents.view", "documents.upload", "documents.delete"],
    },
    "tax_returns": {
        "label": "Tax Returns",
        "label_es": "Declaraciones",
        "permissions": ["tax_returns.view", "tax_returns.create", "tax_returns.edit"],
    },
    "reports": {
        "label": "Reports",
        "label_es": "Reportes",
        "permissions": ["reports.view", "reports.export"],
    },
    "kb": {
        "label": "Knowledge Base",
        "label_es": "Base de Conocimiento",
        "permissions": ["kb.view", "kb.create", "kb.edit", "kb.delete"],
    },
    "system": {
        "label": "System",
        "label_es": "Sistema",
        "permissions": ["system.settings", "system.roles", "system.users"],
    },
}


@router.get("/roles")
async def list_roles():
    """List all roles"""
    db = _db
    try:
        custom_roles = await db.crm_roles.find().to_list(100)
        custom_roles = [serialize(r) for r in custom_roles]
    except:
        custom_roles = []
    
    return {
        "default_roles": DEFAULT_ROLES,
        "custom_roles": custom_roles,
        "permission_categories": PERMISSION_CATEGORIES,
    }


@router.post("/roles")
async def create_role(request: Request):
    """Create a custom role"""
    db = _db
    data = await request.json()
    
    role = {
        "name": data.get("name", ""),
        "name_es": data.get("name_es", ""),
        "color": data.get("color", "#6B7280"),
        "permissions": data.get("permissions", []),
        "description": data.get("description", ""),
        "description_es": data.get("description_es", ""),
        "created_at": datetime.now(CT).isoformat(),
        "updated_at": datetime.now(CT).isoformat(),
    }
    
    result = await db.crm_roles.insert_one(role)
    role["_id"] = str(result.inserted_id)
    
    return {"success": True, "role": role}


@router.put("/roles/{role_id}")
async def update_role(role_id: str, request: Request):
    """Update a custom role"""
    db = _db
    data = await request.json()
    data["updated_at"] = datetime.now(CT).isoformat()
    
    result = await db.crm_roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"success": True}


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    """Delete a custom role"""
    db = _db
    result = await db.crm_roles.delete_one({"_id": ObjectId(role_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"success": True}


@router.get("/team")
async def list_team():
    """List team members with their roles"""
    db = _db
    try:
        members = await db.team_members.find().to_list(100)
        members = [serialize(m) for m in members]
    except:
        members = []
    
    return {"members": members}


@router.post("/team")
async def add_team_member(request: Request):
    """Add a team member"""
    db = _db
    data = await request.json()
    
    member = {
        "name": data.get("name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "role": data.get("role", "viewer"),
        "avatar": data.get("avatar", ""),
        "is_active": True,
        "created_at": datetime.now(CT).isoformat(),
        "last_login": None,
    }
    
    result = await db.team_members.insert_one(member)
    member["_id"] = str(result.inserted_id)
    
    return {"success": True, "member": member}


@router.put("/team/{member_id}")
async def update_team_member(member_id: str, request: Request):
    """Update a team member"""
    db = _db
    data = await request.json()
    data["updated_at"] = datetime.now(CT).isoformat()
    
    result = await db.team_members.update_one(
        {"_id": ObjectId(member_id)},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"success": True}


@router.delete("/team/{member_id}")
async def delete_team_member(member_id: str):
    """Delete a team member"""
    db = _db
    result = await db.team_members.delete_one({"_id": ObjectId(member_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"success": True}
