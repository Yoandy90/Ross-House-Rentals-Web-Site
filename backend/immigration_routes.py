"""
Immigration Services Router
Extracted from server.py for modularization.
Handles immigration cases, services, documents, quotes, invoices, and timeline management.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

immigration_router = APIRouter()
_db = None


def init_immigration_router(db):
    global _db
    _db = db


async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(tz=expires_at.tzinfo if expires_at.tzinfo else timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def _require_admin(request: Request):
    """Require admin role"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _get_current_user():
    """Dependency placeholder - uses request-based auth"""
    return Depends(_auth_user)

# ============== IMMIGRATION SERVICES ENDPOINTS ==============
print("🌐 Initializing Immigration Services...")

@immigration_router.get('/admin/immigration/services')
async def get_immigration_services(
    current_user: dict = Depends(_auth_user)
):
    """Get all immigration services"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        services = await _db.immigration_services.find().sort('category', 1).to_list(length=1000)
        for service in services:
            service['_id'] = str(service['_id'])
        return {"services": services, "total": len(services)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.post('/admin/immigration/services')
async def create_immigration_service(
    name: str = Body(...),
    description: str = Body(default=""),
    category: str = Body(default="otros"),
    price: float = Body(...),
    estimated_time: str = Body(default=""),
    requirements: list = Body(default=[]),
    is_active: bool = Body(default=True),
    current_user: dict = Depends(_auth_user)
):
    """Create a new immigration service"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = {
            "name": name,
            "description": description,
            "category": category,
            "price": price,
            "estimated_time": estimated_time,
            "requirements": requirements,
            "is_active": is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.immigration_services.insert_one(service)
        service['_id'] = str(result.inserted_id)
        
        return {"success": True, "service": service}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.put('/admin/immigration/services/{service_id}')
async def update_immigration_service(
    service_id: str,
    name: str = Body(default=None),
    description: str = Body(default=None),
    category: str = Body(default=None),
    price: float = Body(default=None),
    estimated_time: str = Body(default=None),
    requirements: list = Body(default=None),
    is_active: bool = Body(default=None),
    current_user: dict = Depends(_auth_user)
):
    """Update an immigration service"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        update_data = {"updated_at": datetime.utcnow()}
        
        if name is not None:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if category is not None:
            update_data["category"] = category
        if price is not None:
            update_data["price"] = price
        if estimated_time is not None:
            update_data["estimated_time"] = estimated_time
        if requirements is not None:
            update_data["requirements"] = requirements
        if is_active is not None:
            update_data["is_active"] = is_active
        
        result = await _db.immigration_services.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {"success": True, "message": "Service updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.delete('/admin/immigration/services/{service_id}')
async def delete_immigration_service(
    service_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete an immigration service"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_services.delete_one({"_id": ObjectId(service_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {"success": True, "message": "Service deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.get('/admin/immigration/services/{service_id}')
async def get_immigration_service(
    service_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get a single immigration service"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        service = await _db.immigration_services.find_one({"_id": ObjectId(service_id)})
        
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        service['_id'] = str(service['_id'])
        return {"service": service}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("🌐 Immigration Services endpoints registered!")

# ============== IMMIGRATION CASES ENDPOINTS ==============
print("📁 Initializing Immigration Cases...")

CASE_STATUSES = ['pending', 'in_progress', 'under_review', 'completed', 'rejected', 'cancelled']

@immigration_router.get('/admin/immigration/cases')
async def get_immigration_cases(
    status: str = None,
    client_id: str = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(_auth_user)
):
    """Get all immigration cases with optional filters"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if status:
            query['status'] = status
        if client_id:
            query['client_id'] = client_id
        
        cases = await _db.immigration_cases.find(query).sort('created_at', -1).skip(skip).limit(limit).to_list(length=limit)
        total = await _db.immigration_cases.count_documents(query)
        
        # Enrich with client and service info
        for case in cases:
            case['_id'] = str(case['_id'])
            # Get client info - support both ObjectId and UUID formats
            if case.get('client_id'):
                try:
                    client = None
                    client_id = case['client_id']
                    # Try ObjectId first
                    if ObjectId.is_valid(client_id):
                        client = await _db.users.find_one({"_id": ObjectId(client_id)})
                    # Try string _id
                    if not client:
                        client = await _db.users.find_one({"_id": client_id})
                    # Try 'id' field
                    if not client:
                        client = await _db.users.find_one({"id": client_id})
                    
                    if client:
                        case['client_name'] = client.get('name') or client.get('full_name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() or 'Sin nombre'
                        case['client_email'] = client.get('email', '')
                        case['client_phone'] = client.get('phone', '')
                except Exception:
                    pass
            # Get service info
            if case.get('service_id'):
                try:
                    service = await _db.immigration_services.find_one({"_id": ObjectId(case['service_id'])})
                    if service:
                        case['service_name'] = service.get('name', '')
                        case['service_category'] = service.get('category', '')
                except Exception:
                    pass
        
        return {"cases": cases, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.post('/admin/immigration/cases')
async def create_immigration_case(
    client_id: str = Body(...),
    service_id: str = Body(...),
    title: str = Body(...),
    description: str = Body(default=""),
    status: str = Body(default="pending"),
    priority: str = Body(default="normal"),
    documents_required: list = Body(default=[]),
    documents_submitted: list = Body(default=[]),
    important_dates: list = Body(default=[]),
    notes: str = Body(default=""),
    assigned_to: str = Body(default=None),
    current_user: dict = Depends(_auth_user)
):
    """Create a new immigration case"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if status not in CASE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {CASE_STATUSES}")
    
    try:
        # Verify client exists - support both ObjectId and UUID formats
        client = None
        # Try ObjectId first
        if ObjectId.is_valid(client_id):
            client = await _db.users.find_one({"_id": ObjectId(client_id)})
        # Try string _id (UUID format)
        if not client:
            client = await _db.users.find_one({"_id": client_id})
        # Try 'id' field
        if not client:
            client = await _db.users.find_one({"id": client_id})
        
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Store the actual client _id for the case
        actual_client_id = str(client.get('_id'))
        
        # Verify service exists
        service = await _db.immigration_services.find_one({"_id": ObjectId(service_id)})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Generate case number
        count = await _db.immigration_cases.count_documents({})
        case_number = f"IMM-{datetime.utcnow().strftime('%Y%m')}-{count + 1:04d}"
        
        case = {
            "case_number": case_number,
            "client_id": actual_client_id,
            "service_id": service_id,
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "documents_required": documents_required or service.get('requirements', []),
            "documents_submitted": documents_submitted,
            "important_dates": important_dates,
            "notes": notes,
            "assigned_to": assigned_to,
            "created_by": str(current_user.get('_id', '')),
            "history": [{
                "action": "case_created",
                "timestamp": datetime.utcnow().isoformat(),
                "user": current_user.get('email', ''),
                "details": f"Caso creado: {title}"
            }],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.immigration_cases.insert_one(case)
        case['_id'] = str(result.inserted_id)
        
        return {"success": True, "case": case}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.put('/admin/immigration/cases/{case_id}')
async def update_immigration_case(
    case_id: str,
    title: str = Body(default=None),
    description: str = Body(default=None),
    status: str = Body(default=None),
    priority: str = Body(default=None),
    documents_required: list = Body(default=None),
    documents_submitted: list = Body(default=None),
    important_dates: list = Body(default=None),
    notes: str = Body(default=None),
    assigned_to: str = Body(default=None),
    current_user: dict = Depends(_auth_user)
):
    """Update an immigration case"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if status and status not in CASE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {CASE_STATUSES}")
    
    try:
        existing_case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not existing_case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        history_entry = {
            "action": "case_updated",
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user.get('email', ''),
            "changes": []
        }
        
        if title is not None and title != existing_case.get('title'):
            update_data["title"] = title
            history_entry["changes"].append(f"Título actualizado")
        if description is not None:
            update_data["description"] = description
        if status is not None and status != existing_case.get('status'):
            update_data["status"] = status
            history_entry["changes"].append(f"Estado: {existing_case.get('status')} → {status}")
        if priority is not None and priority != existing_case.get('priority'):
            update_data["priority"] = priority
            history_entry["changes"].append(f"Prioridad: {priority}")
        if documents_required is not None:
            update_data["documents_required"] = documents_required
        if documents_submitted is not None:
            update_data["documents_submitted"] = documents_submitted
            history_entry["changes"].append(f"Documentos actualizados")
        if important_dates is not None:
            update_data["important_dates"] = important_dates
        if notes is not None:
            update_data["notes"] = notes
        if assigned_to is not None:
            update_data["assigned_to"] = assigned_to
        
        # Add history entry if there were changes
        if history_entry["changes"]:
            history_entry["details"] = ", ".join(history_entry["changes"])
            await _db.immigration_cases.update_one(
                {"_id": ObjectId(case_id)},
                {"$push": {"history": history_entry}}
            )
        
        await _db.immigration_cases.update_one(
            {"_id": ObjectId(case_id)},
            {"$set": update_data}
        )
        
        return {"success": True, "message": "Case updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.get('/admin/immigration/cases/{case_id}')
async def get_immigration_case(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get a single immigration case with full details"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        case['_id'] = str(case['_id'])
        
        # Get client info - support both ObjectId and UUID formats
        if case.get('client_id'):
            try:
                client = None
                client_id = case['client_id']
                # Try ObjectId first
                if ObjectId.is_valid(client_id):
                    client = await _db.users.find_one({"_id": ObjectId(client_id)})
                # Try string _id
                if not client:
                    client = await _db.users.find_one({"_id": client_id})
                # Try 'id' field
                if not client:
                    client = await _db.users.find_one({"id": client_id})
                
                if client:
                    client_name = client.get('name') or client.get('full_name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() or 'Sin nombre'
                    case['client'] = {
                        "id": str(client['_id']),
                        "name": client_name,
                        "email": client.get('email', ''),
                        "phone": client.get('phone', '')
                    }
                    case['client_name'] = client_name
                    case['client_email'] = client.get('email', '')
                    case['client_phone'] = client.get('phone', '')
            except Exception:
                pass
        
        # Get service info
        if case.get('service_id'):
            service = await _db.immigration_services.find_one({"_id": ObjectId(case['service_id'])})
            if service:
                case['service'] = {
                    "id": str(service['_id']),
                    "name": service.get('name', ''),
                    "category": service.get('category', ''),
                    "price": service.get('price', 0)
                }
        
        return {"case": case}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.delete('/admin/immigration/cases/{case_id}')
async def delete_immigration_case(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete an immigration case"""
    if current_user.get('role') not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_cases.delete_one({"_id": ObjectId(case_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Case not found")
        
        return {"success": True, "message": "Case deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.post('/admin/immigration/cases/{case_id}/add-note')
async def add_case_note(
    case_id: str,
    note: str = Body(..., embed=True),
    current_user: dict = Depends(_auth_user)
):
    """Add a note to a case history"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        history_entry = {
            "action": "note_added",
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user.get('email', ''),
            "details": note
        }
        
        result = await _db.immigration_cases.update_one(
            {"_id": ObjectId(case_id)},
            {
                "$push": {"history": history_entry},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Case not found")
        
        return {"success": True, "message": "Note added"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@immigration_router.get('/admin/immigration/cases/stats/summary')
async def get_immigration_cases_stats(
    current_user: dict = Depends(_auth_user)
):
    """Get summary statistics for immigration cases"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        total = await _db.immigration_cases.count_documents({})
        pending = await _db.immigration_cases.count_documents({"status": "pending"})
        in_progress = await _db.immigration_cases.count_documents({"status": "in_progress"})
        under_review = await _db.immigration_cases.count_documents({"status": "under_review"})
        completed = await _db.immigration_cases.count_documents({"status": "completed"})
        rejected = await _db.immigration_cases.count_documents({"status": "rejected"})
        
        return {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "under_review": under_review,
            "completed": completed,
            "rejected": rejected
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/dashboard')
async def get_immigration_dashboard(
    current_user: dict = Depends(_auth_user)
):
    """Get comprehensive dashboard data for immigration module"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from datetime import datetime, timedelta
        
        # Case statistics
        total_cases = await _db.immigration_cases.count_documents({})
        pending = await _db.immigration_cases.count_documents({"status": "pending"})
        in_progress = await _db.immigration_cases.count_documents({"status": "in_progress"})
        under_review = await _db.immigration_cases.count_documents({"status": "under_review"})
        completed = await _db.immigration_cases.count_documents({"status": "completed"})
        rejected = await _db.immigration_cases.count_documents({"status": "rejected"})
        cancelled = await _db.immigration_cases.count_documents({"status": "cancelled"})
        
        # Priority breakdown
        urgent = await _db.immigration_cases.count_documents({"priority": "urgent", "status": {"$nin": ["completed", "rejected", "cancelled"]}})
        high_priority = await _db.immigration_cases.count_documents({"priority": "high", "status": {"$nin": ["completed", "rejected", "cancelled"]}})
        
        # Time-based stats
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        cases_this_week = await _db.immigration_cases.count_documents({"created_at": {"$gte": week_ago}})
        cases_this_month = await _db.immigration_cases.count_documents({"created_at": {"$gte": month_ago}})
        completed_this_month = await _db.immigration_cases.count_documents({
            "status": "completed",
            "updated_at": {"$gte": month_ago}
        })
        
        # Service statistics
        total_services = await _db.immigration_services.count_documents({})
        active_services = await _db.immigration_services.count_documents({"is_active": True})
        
        # Cases by service (top 5)
        pipeline = [
            {"$match": {"service_id": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$service_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        cases_by_service_raw = await _db.immigration_cases.aggregate(pipeline).to_list(length=5)
        
        # Enrich with service names
        cases_by_service = []
        for item in cases_by_service_raw:
            service = await _db.immigration_services.find_one({"_id": ObjectId(item["_id"])})
            cases_by_service.append({
                "service_id": item["_id"],
                "service_name": service.get("name", "Servicio desconocido") if service else "Servicio desconocido",
                "count": item["count"]
            })
        
        # Recent cases (last 5)
        recent_cases = await _db.immigration_cases.find({}).sort("created_at", -1).limit(5).to_list(length=5)
        recent_cases_formatted = []
        for case in recent_cases:
            # Get client name
            client_name = "Sin cliente"
            if case.get("client_id"):
                try:
                    client = None
                    client_id = case["client_id"]
                    if ObjectId.is_valid(client_id):
                        client = await _db.users.find_one({"_id": ObjectId(client_id)})
                    if not client:
                        client = await _db.users.find_one({"_id": client_id})
                    if not client:
                        client = await _db.users.find_one({"id": client_id})
                    if client:
                        client_name = client.get("name") or client.get("full_name") or "Sin nombre"
                except:
                    pass
            
            recent_cases_formatted.append({
                "id": str(case["_id"]),
                "case_number": case.get("case_number", ""),
                "title": case.get("title", ""),
                "status": case.get("status", "pending"),
                "priority": case.get("priority", "normal"),
                "client_name": client_name,
                "created_at": case.get("created_at").isoformat() if case.get("created_at") else None
            })
        
        return {
            "cases": {
                "total": total_cases,
                "by_status": {
                    "pending": pending,
                    "in_progress": in_progress,
                    "under_review": under_review,
                    "completed": completed,
                    "rejected": rejected,
                    "cancelled": cancelled
                },
                "active": pending + in_progress + under_review,
                "urgent": urgent,
                "high_priority": high_priority,
                "this_week": cases_this_week,
                "this_month": cases_this_month,
                "completed_this_month": completed_this_month
            },
            "services": {
                "total": total_services,
                "active": active_services,
                "cases_by_service": cases_by_service
            },
            "recent_cases": recent_cases_formatted,
            "success_rate": round((completed / total_cases * 100), 1) if total_cases > 0 else 0
        }
    except Exception as e:
        print(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("📁 Immigration Cases endpoints registered!")

# ============== IMMIGRATION APPOINTMENTS ENDPOINTS ==============

APPOINTMENT_TYPES = ['consultation', 'document_review', 'follow_up', 'interview_prep', 'filing']
APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']

@immigration_router.get('/admin/immigration/appointments')
async def get_immigration_appointments(
    start_date: str = None,
    end_date: str = None,
    status: str = None,
    type: str = None,
    client_id: str = None,
    case_id: str = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(_auth_user)
):
    """Get immigration appointments with filters"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        
        # Date range filter
        if start_date and end_date:
            query['date'] = {
                '$gte': datetime.fromisoformat(start_date.replace('Z', '+00:00')),
                '$lte': datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            }
        elif start_date:
            query['date'] = {'$gte': datetime.fromisoformat(start_date.replace('Z', '+00:00'))}
        elif end_date:
            query['date'] = {'$lte': datetime.fromisoformat(end_date.replace('Z', '+00:00'))}
        
        if status:
            query['status'] = status
        if type:
            query['appointment_type'] = type
        if client_id:
            query['client_id'] = client_id
        if case_id:
            query['case_id'] = case_id
        
        total = await _db.immigration_appointments.count_documents(query)
        appointments = await _db.immigration_appointments.find(query).sort("date", 1).skip(skip).limit(limit).to_list(length=limit)
        
        # Enrich with client and case info
        for appt in appointments:
            appt['_id'] = str(appt['_id'])
            
            # Get client info
            if appt.get('client_id'):
                try:
                    client = None
                    client_id_val = appt['client_id']
                    if ObjectId.is_valid(client_id_val):
                        client = await _db.users.find_one({"_id": ObjectId(client_id_val)})
                    if not client:
                        client = await _db.users.find_one({"_id": client_id_val})
                    if not client:
                        client = await _db.users.find_one({"id": client_id_val})
                    if client:
                        appt['client_name'] = client.get('name') or client.get('full_name') or 'Sin nombre'
                        appt['client_email'] = client.get('email', '')
                        appt['client_phone'] = client.get('phone', '')
                except:
                    pass
            
            # Get case info
            if appt.get('case_id'):
                try:
                    case = await _db.immigration_cases.find_one({"_id": ObjectId(appt['case_id'])})
                    if case:
                        appt['case_number'] = case.get('case_number', '')
                        appt['case_title'] = case.get('title', '')
                except:
                    pass
        
        return {"appointments": appointments, "total": total}
    except Exception as e:
        print(f"Get appointments error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/appointments')
async def create_immigration_appointment(
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Create a new immigration appointment"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        client_id = data.get('client_id')
        case_id = data.get('case_id')
        appointment_type = data.get('appointment_type', 'consultation')
        date = data.get('date')
        time = data.get('time')
        duration = data.get('duration', 60)  # minutes
        title = data.get('title', '')
        notes = data.get('notes', '')
        location = data.get('location', 'office')  # office, virtual, phone
        virtual_link = data.get('virtual_link', '')
        
        if not client_id or not date or not time:
            raise HTTPException(status_code=400, detail="client_id, date and time are required")
        
        if appointment_type not in APPOINTMENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid appointment type. Must be one of: {APPOINTMENT_TYPES}")
        
        # Verify client exists
        client = None
        if ObjectId.is_valid(client_id):
            client = await _db.users.find_one({"_id": ObjectId(client_id)})
        if not client:
            client = await _db.users.find_one({"_id": client_id})
        if not client:
            client = await _db.users.find_one({"id": client_id})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        actual_client_id = str(client.get('_id'))
        
        # Parse datetime
        appointment_datetime = datetime.fromisoformat(f"{date}T{time}")
        
        appointment = {
            "client_id": actual_client_id,
            "case_id": case_id,
            "appointment_type": appointment_type,
            "date": appointment_datetime,
            "time": time,
            "duration": duration,
            "title": title or f"Cita de {appointment_type}",
            "notes": notes,
            "location": location,
            "virtual_link": virtual_link,
            "status": "scheduled",
            "reminder_sent": False,
            "created_by": str(current_user.get('_id', '')),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.immigration_appointments.insert_one(appointment)
        appointment['_id'] = str(result.inserted_id)
        
        return {"message": "Appointment created successfully", "appointment": appointment}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create appointment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/appointments/{appointment_id}')
async def get_immigration_appointment(
    appointment_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get a single immigration appointment"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        appointment = await _db.immigration_appointments.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        appointment['_id'] = str(appointment['_id'])
        
        # Get client info
        if appointment.get('client_id'):
            try:
                client = None
                client_id = appointment['client_id']
                if ObjectId.is_valid(client_id):
                    client = await _db.users.find_one({"_id": ObjectId(client_id)})
                if not client:
                    client = await _db.users.find_one({"_id": client_id})
                if client:
                    appointment['client'] = {
                        "id": str(client['_id']),
                        "name": client.get('name') or client.get('full_name') or 'Sin nombre',
                        "email": client.get('email', ''),
                        "phone": client.get('phone', '')
                    }
            except:
                pass
        
        # Get case info
        if appointment.get('case_id'):
            try:
                case = await _db.immigration_cases.find_one({"_id": ObjectId(appointment['case_id'])})
                if case:
                    appointment['case'] = {
                        "id": str(case['_id']),
                        "case_number": case.get('case_number', ''),
                        "title": case.get('title', ''),
                        "status": case.get('status', '')
                    }
            except:
                pass
        
        return appointment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.put('/admin/immigration/appointments/{appointment_id}')
async def update_immigration_appointment(
    appointment_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Update an immigration appointment"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        appointment = await _db.immigration_appointments.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        
        # Updateable fields
        if 'appointment_type' in data:
            if data['appointment_type'] not in APPOINTMENT_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {APPOINTMENT_TYPES}")
            update_data['appointment_type'] = data['appointment_type']
        
        if 'status' in data:
            if data['status'] not in APPOINTMENT_STATUSES:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {APPOINTMENT_STATUSES}")
            update_data['status'] = data['status']
        
        if 'date' in data and 'time' in data:
            update_data['date'] = datetime.fromisoformat(f"{data['date']}T{data['time']}")
            update_data['time'] = data['time']
        elif 'date' in data:
            current_time = appointment.get('time', '09:00')
            update_data['date'] = datetime.fromisoformat(f"{data['date']}T{current_time}")
        
        for field in ['duration', 'title', 'notes', 'location', 'virtual_link', 'case_id']:
            if field in data:
                update_data[field] = data[field]
        
        await _db.immigration_appointments.update_one(
            {"_id": ObjectId(appointment_id)},
            {"$set": update_data}
        )
        
        updated = await _db.immigration_appointments.find_one({"_id": ObjectId(appointment_id)})
        updated['_id'] = str(updated['_id'])
        
        return {"message": "Appointment updated successfully", "appointment": updated}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update appointment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.delete('/admin/immigration/appointments/{appointment_id}')
async def delete_immigration_appointment(
    appointment_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete an immigration appointment"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_appointments.delete_one({"_id": ObjectId(appointment_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        return {"message": "Appointment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/appointments/calendar/week')
async def get_immigration_appointments_week(
    date: str = None,
    current_user: dict = Depends(_auth_user)
):
    """Get appointments for the week containing the given date"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        if date:
            center_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        else:
            center_date = datetime.utcnow()
        
        # Get start of week (Monday)
        start_of_week = center_date - timedelta(days=center_date.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_week = start_of_week + timedelta(days=7)
        
        appointments = await _db.immigration_appointments.find({
            "date": {"$gte": start_of_week, "$lt": end_of_week}
        }).sort("date", 1).to_list(length=100)
        
        # Group by day
        days = {}
        for i in range(7):
            day = start_of_week + timedelta(days=i)
            days[day.strftime('%Y-%m-%d')] = []
        
        for appt in appointments:
            appt['_id'] = str(appt['_id'])
            day_key = appt['date'].strftime('%Y-%m-%d')
            if day_key in days:
                # Get client name
                if appt.get('client_id'):
                    try:
                        client = None
                        client_id = appt['client_id']
                        if ObjectId.is_valid(client_id):
                            client = await _db.users.find_one({"_id": ObjectId(client_id)})
                        if not client:
                            client = await _db.users.find_one({"_id": client_id})
                        if client:
                            appt['client_name'] = client.get('name') or client.get('full_name') or 'Sin nombre'
                    except:
                        pass
                days[day_key].append(appt)
        
        return {
            "week_start": start_of_week.isoformat(),
            "week_end": end_of_week.isoformat(),
            "days": days
        }
    except Exception as e:
        print(f"Week calendar error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/appointments/stats')
async def get_immigration_appointments_stats(
    current_user: dict = Depends(_auth_user)
):
    """Get appointment statistics"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        week_end = today + timedelta(days=7)
        
        total = await _db.immigration_appointments.count_documents({})
        today_count = await _db.immigration_appointments.count_documents({
            "date": {"$gte": today, "$lt": tomorrow},
            "status": {"$nin": ["cancelled", "no_show"]}
        })
        this_week = await _db.immigration_appointments.count_documents({
            "date": {"$gte": today, "$lt": week_end},
            "status": {"$nin": ["cancelled", "no_show"]}
        })
        pending_confirmation = await _db.immigration_appointments.count_documents({"status": "scheduled"})
        completed = await _db.immigration_appointments.count_documents({"status": "completed"})
        cancelled = await _db.immigration_appointments.count_documents({"status": "cancelled"})
        
        return {
            "total": total,
            "today": today_count,
            "this_week": this_week,
            "pending_confirmation": pending_confirmation,
            "completed": completed,
            "cancelled": cancelled
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("📅 Immigration Appointments endpoints registered!")

# ============== IMMIGRATION QUOTES ENDPOINTS ==============

QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']

@immigration_router.get('/admin/immigration/quotes')
async def get_immigration_quotes(
    status: str = None,
    client_id: str = None,
    case_id: str = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(_auth_user)
):
    """Get immigration quotes with filters"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if status:
            query['status'] = status
        if client_id:
            query['client_id'] = client_id
        if case_id:
            query['case_id'] = case_id
        
        total = await _db.immigration_quotes.count_documents(query)
        quotes = await _db.immigration_quotes.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        for quote in quotes:
            quote['_id'] = str(quote['_id'])
            # Get client info
            if quote.get('client_id'):
                try:
                    client = None
                    client_id_val = quote['client_id']
                    if ObjectId.is_valid(client_id_val):
                        client = await _db.users.find_one({"_id": ObjectId(client_id_val)})
                    if not client:
                        client = await _db.users.find_one({"_id": client_id_val})
                    if not client:
                        client = await _db.users.find_one({"id": client_id_val})
                    if client:
                        quote['client_name'] = client.get('name') or client.get('full_name') or 'Sin nombre'
                        quote['client_email'] = client.get('email', '')
                except:
                    pass
        
        return {"quotes": quotes, "total": total}
    except Exception as e:
        print(f"Get quotes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/quotes')
async def create_immigration_quote(
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Create a new immigration quote"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        client_id = data.get('client_id')
        case_id = data.get('case_id')
        services = data.get('services', [])  # List of {service_id, name, price, quantity}
        notes = data.get('notes', '')
        valid_days = data.get('valid_days', 30)
        discount_percent = data.get('discount_percent', 0)
        discount_amount = data.get('discount_amount', 0)
        
        if not client_id:
            raise HTTPException(status_code=400, detail="client_id is required")
        
        if not services or len(services) == 0:
            raise HTTPException(status_code=400, detail="At least one service is required")
        
        # Verify client exists
        client = None
        if ObjectId.is_valid(client_id):
            client = await _db.users.find_one({"_id": ObjectId(client_id)})
        if not client:
            client = await _db.users.find_one({"_id": client_id})
        if not client:
            client = await _db.users.find_one({"id": client_id})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        actual_client_id = str(client.get('_id'))
        
        # Generate quote number
        count = await _db.immigration_quotes.count_documents({})
        quote_number = f"COT-INM-{str(count + 1).zfill(5)}"
        
        # Calculate totals
        subtotal = sum(item.get('price', 0) * item.get('quantity', 1) for item in services)
        
        # Apply discount
        discount = 0
        if discount_percent > 0:
            discount = subtotal * (discount_percent / 100)
        elif discount_amount > 0:
            discount = discount_amount
        
        total = subtotal - discount
        
        # Calculate expiry date
        expiry_date = datetime.utcnow() + timedelta(days=valid_days)
        
        quote = {
            "quote_number": quote_number,
            "client_id": actual_client_id,
            "case_id": case_id,
            "services": services,
            "subtotal": subtotal,
            "discount_percent": discount_percent,
            "discount_amount": discount,
            "total": total,
            "notes": notes,
            "status": "draft",
            "valid_days": valid_days,
            "expiry_date": expiry_date,
            "created_by": str(current_user.get('_id', '')),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "sent_at": None,
            "viewed_at": None,
            "accepted_at": None,
            "rejected_at": None
        }
        
        result = await _db.immigration_quotes.insert_one(quote)
        quote['_id'] = str(result.inserted_id)
        
        return {"message": "Quote created successfully", "quote": quote}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create quote error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/quotes/{quote_id}')
async def get_immigration_quote(
    quote_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get a single immigration quote"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        quote = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        quote['_id'] = str(quote['_id'])
        
        # Get client info
        if quote.get('client_id'):
            try:
                client = None
                client_id = quote['client_id']
                if ObjectId.is_valid(client_id):
                    client = await _db.users.find_one({"_id": ObjectId(client_id)})
                if not client:
                    client = await _db.users.find_one({"_id": client_id})
                if client:
                    quote['client'] = {
                        "id": str(client['_id']),
                        "name": client.get('name') or client.get('full_name') or 'Sin nombre',
                        "email": client.get('email', ''),
                        "phone": client.get('phone', ''),
                        "address": client.get('address', '')
                    }
            except:
                pass
        
        # Get case info if linked
        if quote.get('case_id'):
            try:
                case = await _db.immigration_cases.find_one({"_id": ObjectId(quote['case_id'])})
                if case:
                    quote['case'] = {
                        "id": str(case['_id']),
                        "case_number": case.get('case_number', ''),
                        "title": case.get('title', '')
                    }
            except:
                pass
        
        return quote
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.put('/admin/immigration/quotes/{quote_id}')
async def update_immigration_quote(
    quote_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Update an immigration quote"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        quote = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        
        # Status changes
        if 'status' in data:
            new_status = data['status']
            if new_status not in QUOTE_STATUSES:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {QUOTE_STATUSES}")
            update_data['status'] = new_status
            
            # Track status change timestamps
            if new_status == 'sent' and not quote.get('sent_at'):
                update_data['sent_at'] = datetime.utcnow()
            elif new_status == 'viewed' and not quote.get('viewed_at'):
                update_data['viewed_at'] = datetime.utcnow()
            elif new_status == 'accepted':
                update_data['accepted_at'] = datetime.utcnow()
            elif new_status == 'rejected':
                update_data['rejected_at'] = datetime.utcnow()
        
        # Update services and recalculate
        if 'services' in data:
            services = data['services']
            subtotal = sum(item.get('price', 0) * item.get('quantity', 1) for item in services)
            discount_percent = data.get('discount_percent', quote.get('discount_percent', 0))
            discount_amount = data.get('discount_amount', 0)
            
            discount = 0
            if discount_percent > 0:
                discount = subtotal * (discount_percent / 100)
            elif discount_amount > 0:
                discount = discount_amount
            
            update_data['services'] = services
            update_data['subtotal'] = subtotal
            update_data['discount_percent'] = discount_percent
            update_data['discount_amount'] = discount
            update_data['total'] = subtotal - discount
        
        # Other updateable fields
        for field in ['notes', 'valid_days', 'case_id']:
            if field in data:
                update_data[field] = data[field]
        
        if 'valid_days' in data:
            update_data['expiry_date'] = datetime.utcnow() + timedelta(days=data['valid_days'])
        
        await _db.immigration_quotes.update_one(
            {"_id": ObjectId(quote_id)},
            {"$set": update_data}
        )
        
        updated = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        updated['_id'] = str(updated['_id'])
        
        return {"message": "Quote updated successfully", "quote": updated}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update quote error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.delete('/admin/immigration/quotes/{quote_id}')
async def delete_immigration_quote(
    quote_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete an immigration quote"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_quotes.delete_one({"_id": ObjectId(quote_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        return {"message": "Quote deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/quotes/{quote_id}/send')
async def send_immigration_quote(
    quote_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Send quote to client via email"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        quote = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # Get client info
        client = None
        if quote.get('client_id'):
            if ObjectId.is_valid(quote['client_id']):
                client = await _db.users.find_one({"_id": ObjectId(quote['client_id'])})
            if not client:
                client = await _db.users.find_one({"_id": quote['client_id']})
        
        if not client or not client.get('email'):
            raise HTTPException(status_code=400, detail="Client email not found")
        
        # Update quote status
        await _db.immigration_quotes.update_one(
            {"_id": ObjectId(quote_id)},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # TODO: Send email with quote PDF
        # For now, just mark as sent
        
        return {
            "message": "Quote marked as sent",
            "client_email": client.get('email'),
            "note": "Email sending to be implemented"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/quotes/{quote_id}/duplicate')
async def duplicate_immigration_quote(
    quote_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Duplicate an existing quote"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        original = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        if not original:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # Generate new quote number
        count = await _db.immigration_quotes.count_documents({})
        quote_number = f"COT-INM-{str(count + 1).zfill(5)}"
        
        # Create new quote
        new_quote = {
            "quote_number": quote_number,
            "client_id": original.get('client_id'),
            "case_id": original.get('case_id'),
            "services": original.get('services', []),
            "subtotal": original.get('subtotal', 0),
            "discount_percent": original.get('discount_percent', 0),
            "discount_amount": original.get('discount_amount', 0),
            "total": original.get('total', 0),
            "notes": original.get('notes', ''),
            "status": "draft",
            "valid_days": original.get('valid_days', 30),
            "expiry_date": datetime.utcnow() + timedelta(days=original.get('valid_days', 30)),
            "created_by": str(current_user.get('_id', '')),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "sent_at": None,
            "viewed_at": None,
            "accepted_at": None,
            "rejected_at": None
        }
        
        result = await _db.immigration_quotes.insert_one(new_quote)
        new_quote['_id'] = str(result.inserted_id)
        
        return {"message": "Quote duplicated successfully", "quote": new_quote}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/quotes/stats/summary')
async def get_immigration_quotes_stats(
    current_user: dict = Depends(_auth_user)
):
    """Get quote statistics"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        total = await _db.immigration_quotes.count_documents({})
        draft = await _db.immigration_quotes.count_documents({"status": "draft"})
        sent = await _db.immigration_quotes.count_documents({"status": "sent"})
        accepted = await _db.immigration_quotes.count_documents({"status": "accepted"})
        rejected = await _db.immigration_quotes.count_documents({"status": "rejected"})
        expired = await _db.immigration_quotes.count_documents({"status": "expired"})
        
        # Calculate totals
        pipeline = [
            {"$match": {"status": "accepted"}},
            {"$group": {"_id": None, "total_value": {"$sum": "$total"}}}
        ]
        result = await _db.immigration_quotes.aggregate(pipeline).to_list(length=1)
        total_accepted_value = result[0]['total_value'] if result else 0
        
        # Conversion rate
        conversion_rate = 0
        if sent + accepted + rejected > 0:
            conversion_rate = round((accepted / (sent + accepted + rejected)) * 100, 1)
        
        return {
            "total": total,
            "by_status": {
                "draft": draft,
                "sent": sent,
                "accepted": accepted,
                "rejected": rejected,
                "expired": expired
            },
            "total_accepted_value": total_accepted_value,
            "conversion_rate": conversion_rate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("💰 Immigration Quotes endpoints registered!")

# ============== IMMIGRATION CASE TYPES ENDPOINTS ==============

# Default case types for immigration
DEFAULT_CASE_TYPES = [
    {
        "code": "residencia_permanente",
        "name": "Aplicación para Residencia Permanente",
        "name_en": "Permanent Residence Application",
        "description": "Proceso para obtener la Green Card (tarjeta verde)",
        "category": "residencia",
        "estimated_duration_days": 365,
        "base_price": 1500,
        "documents_required": ["Pasaporte válido", "Acta de nacimiento", "Certificado de antecedentes", "Fotos tipo pasaporte", "Formulario I-485"],
        "is_active": True
    },
    {
        "code": "visa_trabajo_h1b",
        "name": "Visa de Trabajo H-1B",
        "name_en": "H-1B Work Visa",
        "description": "Visa para trabajadores especializados con oferta de empleo",
        "category": "visa_trabajo",
        "estimated_duration_days": 180,
        "base_price": 2000,
        "documents_required": ["Pasaporte válido", "Carta de oferta de empleo", "Título universitario", "CV/Resume", "Formulario I-129"],
        "is_active": True
    },
    {
        "code": "visa_trabajo_l1",
        "name": "Visa de Transferencia L-1",
        "name_en": "L-1 Transfer Visa",
        "description": "Visa para transferencias intracompañía",
        "category": "visa_trabajo",
        "estimated_duration_days": 120,
        "base_price": 1800,
        "documents_required": ["Pasaporte válido", "Carta de la empresa", "Comprobantes de empleo", "Formulario I-129"],
        "is_active": True
    },
    {
        "code": "ciudadania",
        "name": "Naturalización / Ciudadanía",
        "name_en": "Naturalization / Citizenship",
        "description": "Proceso para convertirse en ciudadano estadounidense",
        "category": "ciudadania",
        "estimated_duration_days": 365,
        "base_price": 800,
        "documents_required": ["Green Card", "Pasaporte", "Declaraciones de impuestos (5 años)", "Formulario N-400"],
        "is_active": True
    },
    {
        "code": "reunion_familiar",
        "name": "Reunificación Familiar",
        "name_en": "Family Reunification",
        "description": "Petición para familiares (cónyuge, hijos, padres)",
        "category": "familia",
        "estimated_duration_days": 730,
        "base_price": 1200,
        "documents_required": ["Prueba de ciudadanía/residencia", "Acta de matrimonio", "Actas de nacimiento", "Formulario I-130"],
        "is_active": True
    },
    {
        "code": "visa_prometido_k1",
        "name": "Visa de Prometido(a) K-1",
        "name_en": "K-1 Fiancé(e) Visa",
        "description": "Visa para prometidos de ciudadanos estadounidenses",
        "category": "familia",
        "estimated_duration_days": 270,
        "base_price": 1000,
        "documents_required": ["Pasaporte", "Pruebas de relación", "Certificado de soltería", "Formulario I-129F"],
        "is_active": True
    },
    {
        "code": "asilo",
        "name": "Solicitud de Asilo",
        "name_en": "Asylum Application",
        "description": "Protección para personas que huyen de persecución",
        "category": "proteccion",
        "estimated_duration_days": 365,
        "base_price": 0,
        "documents_required": ["Pasaporte/ID", "Pruebas de persecución", "Declaración personal", "Formulario I-589"],
        "is_active": True
    },
    {
        "code": "tps",
        "name": "Estatus de Protección Temporal (TPS)",
        "name_en": "Temporary Protected Status (TPS)",
        "description": "Protección temporal para nacionales de países designados",
        "category": "proteccion",
        "estimated_duration_days": 180,
        "base_price": 500,
        "documents_required": ["Pasaporte/ID", "Prueba de nacionalidad", "Prueba de residencia continua", "Formulario I-821"],
        "is_active": True
    },
    {
        "code": "daca",
        "name": "DACA (Acción Diferida)",
        "name_en": "DACA (Deferred Action)",
        "description": "Acción diferida para llegados en la infancia",
        "category": "proteccion",
        "estimated_duration_days": 120,
        "base_price": 495,
        "documents_required": ["Prueba de llegada antes de 16 años", "Prueba de residencia continua", "Registros escolares", "Formulario I-821D"],
        "is_active": True
    },
    {
        "code": "visa_inversionista_eb5",
        "name": "Visa de Inversionista EB-5",
        "name_en": "EB-5 Investor Visa",
        "description": "Green Card para inversionistas ($800,000+)",
        "category": "inversion",
        "estimated_duration_days": 730,
        "base_price": 5000,
        "documents_required": ["Prueba de fondos", "Plan de negocios", "Documentos financieros", "Formulario I-526"],
        "is_active": True
    },
    {
        "code": "visa_turista_b1b2",
        "name": "Visa de Turista B1/B2",
        "name_en": "B1/B2 Tourist Visa",
        "description": "Visa de visitante para turismo o negocios",
        "category": "visitante",
        "estimated_duration_days": 60,
        "base_price": 300,
        "documents_required": ["Pasaporte válido", "Formulario DS-160", "Foto", "Prueba de solvencia económica"],
        "is_active": True
    },
    {
        "code": "visa_estudiante_f1",
        "name": "Visa de Estudiante F-1",
        "name_en": "F-1 Student Visa",
        "description": "Visa para estudios académicos en EE.UU.",
        "category": "estudiante",
        "estimated_duration_days": 90,
        "base_price": 400,
        "documents_required": ["I-20 de la institución", "Pasaporte", "Prueba de fondos", "Formulario DS-160"],
        "is_active": True
    },
    {
        "code": "permiso_trabajo_ead",
        "name": "Permiso de Trabajo (EAD)",
        "name_en": "Employment Authorization Document (EAD)",
        "description": "Autorización de empleo para trabajar en EE.UU.",
        "category": "trabajo",
        "estimated_duration_days": 120,
        "base_price": 410,
        "documents_required": ["Prueba de elegibilidad", "Fotos", "Formulario I-765"],
        "is_active": True
    },
    {
        "code": "permiso_viaje_advance_parole",
        "name": "Permiso de Viaje (Advance Parole)",
        "name_en": "Travel Permit (Advance Parole)",
        "description": "Permiso para viajar fuera de EE.UU. mientras se tramita otro caso",
        "category": "viaje",
        "estimated_duration_days": 90,
        "base_price": 410,
        "documents_required": ["Prueba de caso pendiente", "Fotos", "Formulario I-131"],
        "is_active": True
    },
    {
        "code": "renovacion_green_card",
        "name": "Renovación de Green Card",
        "name_en": "Green Card Renewal",
        "description": "Renovación de tarjeta de residencia permanente",
        "category": "residencia",
        "estimated_duration_days": 180,
        "base_price": 540,
        "documents_required": ["Green Card actual", "Fotos", "Formulario I-90"],
        "is_active": True
    }
]

CASE_CATEGORIES = {
    "residencia": {"name": "Residencia Permanente", "color": "#10B981", "icon": "🏠"},
    "trabajo": {"name": "Permisos de Trabajo", "color": "#3B82F6", "icon": "💼"},
    "ciudadania": {"name": "Ciudadanía", "color": "#8B5CF6", "icon": "🇺🇸"},
    "asilo": {"name": "Asilo y Refugio", "color": "#EF4444", "icon": "🛡️"},
    "familiar": {"name": "Peticiones Familiares", "color": "#EC4899", "icon": "👨‍👩‍👧‍👦"},
    "viajes": {"name": "Documentos de Viaje", "color": "#F59E0B", "icon": "✈️"},
    "visas": {"name": "Visas y Extensiones", "color": "#06B6D4", "icon": "📋"},
    "daca": {"name": "DACA", "color": "#84CC16", "icon": "🎓"},
    "otros": {"name": "Otros Trámites", "color": "#6B7280", "icon": "📁"}
}


@immigration_router.get('/admin/immigration/categories')
async def get_immigration_categories(
    current_user: dict = Depends(_auth_user)
):
    """Get all immigration categories"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Try to get from database first
        db_categories = await _db.immigration_categories.find().to_list(length=100)
        
        if db_categories:
            categories = []
            for cat in db_categories:
                categories.append({
                    "code": cat.get('code'),
                    "name": cat.get('name'),
                    "color": cat.get('color', '#6B7280'),
                    "icon": cat.get('icon', '📁')
                })
            return {"categories": categories}
        
        # Fallback to hardcoded categories
        categories = [
            {"code": k, **v} for k, v in CASE_CATEGORIES.items()
        ]
        return {"categories": categories}
    except Exception as e:
        print(f"Get categories error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/case-types')
async def get_immigration_case_types(
    category: str = None,
    active_only: bool = True,
    current_user: dict = Depends(_auth_user)
):
    """Get all immigration case types"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {}
        if category:
            query['category'] = category
        if active_only:
            query['is_active'] = True
        
        case_types = await _db.immigration_case_types.find(query).sort("name", 1).to_list(length=100)
        
        # If no case types in DB, seed with defaults
        if len(case_types) == 0 and not category:
            for ct in DEFAULT_CASE_TYPES:
                ct['created_at'] = datetime.utcnow()
                ct['updated_at'] = datetime.utcnow()
                await _db.immigration_case_types.insert_one(ct)
            case_types = await _db.immigration_case_types.find(query).sort("name", 1).to_list(length=100)
        
        for ct in case_types:
            ct['_id'] = str(ct['_id'])
        
        return {
            "case_types": case_types,
            "categories": CASE_CATEGORIES,
            "total": len(case_types)
        }
    except Exception as e:
        print(f"Get case types error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/case-types')
async def create_immigration_case_type(
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Create a new immigration case type"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        code = data.get('code', '').lower().replace(' ', '_')
        name = data.get('name', '')
        
        if not code or not name:
            raise HTTPException(status_code=400, detail="code and name are required")
        
        # Check for duplicate code
        existing = await _db.immigration_case_types.find_one({"code": code})
        if existing:
            raise HTTPException(status_code=400, detail="A case type with this code already exists")
        
        case_type = {
            "code": code,
            "name": name,
            "name_en": data.get('name_en', name),
            "description": data.get('description', ''),
            "category": data.get('category', 'otro'),
            "estimated_duration_days": data.get('estimated_duration_days', 180),
            "base_price": data.get('base_price', 0),
            "documents_required": data.get('documents_required', []),
            "is_active": data.get('is_active', True),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.immigration_case_types.insert_one(case_type)
        case_type['_id'] = str(result.inserted_id)
        
        return {"message": "Case type created successfully", "case_type": case_type}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create case type error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.put('/admin/immigration/case-types/{case_type_id}')
async def update_immigration_case_type(
    case_type_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Update an immigration case type"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        case_type = await _db.immigration_case_types.find_one({"_id": ObjectId(case_type_id)})
        if not case_type:
            raise HTTPException(status_code=404, detail="Case type not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        
        for field in ['name', 'name_en', 'description', 'category', 'estimated_duration_days', 'base_price', 'documents_required', 'is_active']:
            if field in data:
                update_data[field] = data[field]
        
        await _db.immigration_case_types.update_one(
            {"_id": ObjectId(case_type_id)},
            {"$set": update_data}
        )
        
        updated = await _db.immigration_case_types.find_one({"_id": ObjectId(case_type_id)})
        updated['_id'] = str(updated['_id'])
        
        return {"message": "Case type updated successfully", "case_type": updated}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update case type error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.delete('/admin/immigration/case-types/{case_type_id}')
async def delete_immigration_case_type(
    case_type_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete an immigration case type"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_case_types.delete_one({"_id": ObjectId(case_type_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Case type not found")
        
        return {"message": "Case type deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("📋 Immigration Case Types endpoints registered!")

# ============== IMMIGRATION CASE DOCUMENTS TRACKING ==============

DOCUMENT_STATUSES = ['pending', 'received', 'reviewing', 'approved', 'rejected', 'expired']

@immigration_router.get('/admin/immigration/cases/{case_id}/documents')
async def get_case_documents(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get all documents for a specific immigration case"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        documents = await _db.immigration_case_documents.find({"case_id": case_id}).sort("created_at", -1).to_list(length=100)
        
        for doc in documents:
            doc['_id'] = str(doc['_id'])
        
        # Calculate stats
        total = len(documents)
        pending = len([d for d in documents if d.get('status') == 'pending'])
        received = len([d for d in documents if d.get('status') == 'received'])
        approved = len([d for d in documents if d.get('status') == 'approved'])
        
        return {
            "documents": documents,
            "stats": {
                "total": total,
                "pending": pending,
                "received": received,
                "approved": approved,
                "completion_rate": round((approved / total * 100), 1) if total > 0 else 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/cases/{case_id}/documents')
async def add_case_document(
    case_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Add a document requirement to a case"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        document = {
            "case_id": case_id,
            "name": data.get('name', ''),
            "description": data.get('description', ''),
            "status": data.get('status', 'pending'),
            "is_required": data.get('is_required', True),
            "file_url": data.get('file_url'),
            "file_name": data.get('file_name'),
            "notes": data.get('notes', ''),
            "due_date": datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
            "received_date": None,
            "reviewed_by": None,
            "reviewed_at": None,
            "created_by": str(current_user.get('_id', '')),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.immigration_case_documents.insert_one(document)
        document['_id'] = str(result.inserted_id)
        
        return {"message": "Document added successfully", "document": document}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.put('/admin/immigration/cases/{case_id}/documents/{doc_id}')
async def update_case_document(
    case_id: str,
    doc_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Update a case document"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        document = await _db.immigration_case_documents.find_one({"_id": ObjectId(doc_id), "case_id": case_id})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        
        if 'status' in data:
            if data['status'] not in DOCUMENT_STATUSES:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {DOCUMENT_STATUSES}")
            update_data['status'] = data['status']
            
            if data['status'] == 'received' and not document.get('received_date'):
                update_data['received_date'] = datetime.utcnow()
            elif data['status'] in ['approved', 'rejected']:
                update_data['reviewed_by'] = str(current_user.get('_id', ''))
                update_data['reviewed_at'] = datetime.utcnow()
        
        for field in ['name', 'description', 'notes', 'file_url', 'file_name', 'is_required']:
            if field in data:
                update_data[field] = data[field]
        
        if 'due_date' in data:
            update_data['due_date'] = datetime.fromisoformat(data['due_date']) if data['due_date'] else None
        
        await _db.immigration_case_documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": update_data}
        )
        
        updated = await _db.immigration_case_documents.find_one({"_id": ObjectId(doc_id)})
        updated['_id'] = str(updated['_id'])
        
        return {"message": "Document updated successfully", "document": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.put('/admin/immigration/cases/{case_id}/checklist/{doc_index}')
async def update_checklist_document(
    case_id: str,
    doc_index: int,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Update a document in the case checklist by index"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        # Get the case
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Get checklist
        checklist = case.get('documents_checklist', [])
        if doc_index < 0 or doc_index >= len(checklist):
            raise HTTPException(status_code=404, detail="Document index out of range")
        
        # Update the document
        if 'status' in data:
            checklist[doc_index]['status'] = data['status']
            if data['status'] == 'uploaded':
                checklist[doc_index]['uploadedAt'] = datetime.utcnow().isoformat()
        if 'notes' in data:
            checklist[doc_index]['notes'] = data['notes']
        if 'fileUrl' in data:
            checklist[doc_index]['fileUrl'] = data['fileUrl']
        
        # Update case
        await _db.immigration_cases.update_one(
            {"_id": ObjectId(case_id)},
            {
                "$set": {
                    "documents_checklist": checklist,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "message": "Document updated successfully",
            "document": checklist[doc_index]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.delete('/admin/immigration/cases/{case_id}/documents/{doc_id}')
async def delete_case_document(
    case_id: str,
    doc_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Delete a case document"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await _db.immigration_case_documents.delete_one({"_id": ObjectId(doc_id), "case_id": case_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/cases/{case_id}/documents/init-from-type')
async def init_documents_from_case_type(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Initialize document requirements from the case type"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Get case type documents
        case_type = None
        if case.get('case_type_id'):
            case_type = await _db.immigration_case_types.find_one({"_id": ObjectId(case['case_type_id'])})
        
        if not case_type:
            # Try to get from service
            if case.get('service_id'):
                service = await _db.immigration_services.find_one({"_id": ObjectId(case['service_id'])})
                if service and service.get('requirements'):
                    documents_required = service['requirements']
                else:
                    documents_required = []
            else:
                documents_required = case.get('documents_required', [])
        else:
            documents_required = case_type.get('documents_required', [])
        
        # Create document entries
        created_count = 0
        for doc_name in documents_required:
            # Check if already exists
            existing = await _db.immigration_case_documents.find_one({"case_id": case_id, "name": doc_name})
            if not existing:
                document = {
                    "case_id": case_id,
                    "name": doc_name,
                    "description": "",
                    "status": "pending",
                    "is_required": True,
                    "file_url": None,
                    "file_name": None,
                    "notes": "",
                    "due_date": None,
                    "received_date": None,
                    "reviewed_by": None,
                    "reviewed_at": None,
                    "created_by": str(current_user.get('_id', '')),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await _db.immigration_case_documents.insert_one(document)
                created_count += 1
        
        return {"message": f"{created_count} documents initialized", "created": created_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("📄 Immigration Case Documents endpoints registered!")


# ============== IMMIGRATION CASE TIMELINE ==============

@immigration_router.get('/admin/immigration/cases/{case_id}/timeline')
async def get_case_timeline(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get the timeline/history for a case"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Get case history
        history = case.get('history', [])
        
        # Get appointments for this case
        appointments = await _db.immigration_appointments.find({"case_id": case_id}).sort("date", 1).to_list(length=50)
        
        # Get documents status changes
        documents = await _db.immigration_case_documents.find({"case_id": case_id}).to_list(length=100)
        
        # Build timeline
        timeline = []
        
        # Add history events
        for event in history:
            timeline.append({
                "type": "status_change",
                "date": event.get('timestamp'),
                "title": event.get('action', '').replace('_', ' ').title(),
                "description": event.get('details', ''),
                "user": event.get('user', ''),
                "icon": "clock"
            })
        
        # Add appointments
        for appt in appointments:
            timeline.append({
                "type": "appointment",
                "date": appt.get('date').isoformat() if appt.get('date') else None,
                "title": f"Cita: {appt.get('title', appt.get('appointment_type', ''))}",
                "description": f"Estado: {appt.get('status', '')}",
                "status": appt.get('status'),
                "icon": "calendar"
            })
        
        # Add document milestones
        for doc in documents:
            if doc.get('received_date'):
                timeline.append({
                    "type": "document",
                    "date": doc.get('received_date').isoformat() if doc.get('received_date') else None,
                    "title": f"Documento recibido: {doc.get('name', '')}",
                    "description": f"Estado: {doc.get('status', '')}",
                    "icon": "file"
                })
        
        # Sort by date
        timeline.sort(key=lambda x: x.get('date') or '', reverse=True)
        
        return {"timeline": timeline, "case_number": case.get('case_number')}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/cases/{case_id}/timeline')
async def add_timeline_event(
    case_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Add a custom event to the case timeline"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        event = {
            "action": data.get('action', 'custom_event'),
            "timestamp": datetime.utcnow().isoformat(),
            "user": current_user.get('email', ''),
            "details": data.get('details', ''),
            "event_type": data.get('event_type', 'note')
        }
        
        await _db.immigration_cases.update_one(
            {"_id": ObjectId(case_id)},
            {
                "$push": {"history": event},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {"message": "Event added to timeline", "event": event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("📅 Immigration Case Timeline endpoints registered!")


# ============== IMMIGRATION ALERTS & REMINDERS ==============

@immigration_router.get('/admin/immigration/alerts')
async def get_immigration_alerts(
    current_user: dict = Depends(_auth_user)
):
    """Get all active alerts for immigration cases"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        week_ahead = today + timedelta(days=7)
        
        alerts = []
        
        # 1. Appointments today
        today_appts = await _db.immigration_appointments.find({
            "date": {"$gte": today, "$lt": tomorrow},
            "status": {"$nin": ["cancelled", "completed"]}
        }).to_list(length=20)
        
        for appt in today_appts:
            # Get client info
            client_name = "Cliente"
            client_phone = None
            client_email = None
            if appt.get('client_id'):
                try:
                    client_oid = ObjectId(appt['client_id']) if ObjectId.is_valid(appt['client_id']) else None
                    client = await _db.users.find_one({"_id": client_oid}) if client_oid else None
                    if client:
                        client_name = client.get('name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() or 'Cliente'
                        client_phone = client.get('phone')
                        client_email = client.get('email')
                except:
                    pass
            
            alerts.append({
                "type": "appointment_today",
                "priority": "high",
                "title": f"Cita hoy: {appt.get('title', '')}",
                "description": f"{client_name} - {appt.get('time', '')}",
                "case_id": appt.get('case_id'),
                "appointment_id": str(appt['_id']),
                "date": appt.get('date').isoformat() if appt.get('date') else None,
                "client_name": client_name,
                "client_phone": client_phone,
                "client_email": client_email
            })
        
        # 2. Documents due this week
        due_docs = await _db.immigration_case_documents.find({
            "due_date": {"$gte": today, "$lte": week_ahead},
            "status": "pending"
        }).to_list(length=20)
        
        for doc in due_docs:
            days_until = (doc['due_date'] - today).days
            alerts.append({
                "type": "document_due",
                "priority": "medium" if days_until > 2 else "high",
                "title": f"Documento pendiente: {doc.get('name', '')}",
                "description": f"Vence en {days_until} días",
                "case_id": doc.get('case_id'),
                "document_id": str(doc['_id']),
                "date": doc.get('due_date').isoformat() if doc.get('due_date') else None
            })
        
        # 3. Urgent/high priority cases with no recent activity
        week_ago = today - timedelta(days=7)
        stale_cases = await _db.immigration_cases.find({
            "status": {"$in": ["pending", "in_progress"]},
            "priority": {"$in": ["urgent", "high"]},
            "updated_at": {"$lt": week_ago}
        }).limit(10).to_list(length=10)
        
        for case in stale_cases:
            # Get client info for stale cases
            client_name = None
            client_phone = None
            client_email = None
            case_number = case.get('case_number', '')
            if case.get('client_id'):
                try:
                    client_oid = ObjectId(case['client_id']) if ObjectId.is_valid(str(case['client_id'])) else None
                    client = await _db.users.find_one({"_id": client_oid}) if client_oid else None
                    if client:
                        client_name = client.get('name') or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() or None
                        client_phone = client.get('phone')
                        client_email = client.get('email')
                except:
                    pass
            
            alerts.append({
                "type": "case_stale",
                "priority": "medium",
                "title": f"Caso sin actividad: {case_number}",
                "description": f"{case.get('title', '')} - Última actualización hace más de 7 días",
                "case_id": str(case['_id']),
                "case_number": case_number,
                "date": case.get('updated_at').isoformat() if case.get('updated_at') else None,
                "client_name": client_name,
                "client_phone": client_phone,
                "client_email": client_email
            })
        
        # 4. Quotes expiring soon
        expiring_quotes = await _db.immigration_quotes.find({
            "status": {"$in": ["sent", "viewed"]},
            "expiry_date": {"$gte": today, "$lte": week_ahead}
        }).to_list(length=10)
        
        for quote in expiring_quotes:
            days_until = (quote['expiry_date'] - today).days
            alerts.append({
                "type": "quote_expiring",
                "priority": "low",
                "title": f"Cotización por vencer: {quote.get('quote_number', '')}",
                "description": f"Vence en {days_until} días - ${quote.get('total', 0):,.2f}",
                "quote_id": str(quote['_id']),
                "date": quote.get('expiry_date').isoformat() if quote.get('expiry_date') else None
            })
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        alerts.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 3))
        
        return {
            "alerts": alerts,
            "counts": {
                "high": len([a for a in alerts if a.get('priority') == 'high']),
                "medium": len([a for a in alerts if a.get('priority') == 'medium']),
                "low": len([a for a in alerts if a.get('priority') == 'low']),
                "total": len(alerts)
            }
        }
    except Exception as e:
        print(f"Alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("🔔 Immigration Alerts endpoints registered!")


# ============== IMMIGRATION INVOICING FROM QUOTES ==============

@immigration_router.post('/admin/immigration/quotes/{quote_id}/convert-to-invoice')
async def convert_quote_to_invoice(
    quote_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Convert an accepted quote to an invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json() if request else {}
        
        quote = await _db.immigration_quotes.find_one({"_id": ObjectId(quote_id)})
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # Generate invoice number
        count = await _db.invoices.count_documents({})
        invoice_number = f"INV-INM-{str(count + 1).zfill(5)}"
        
        # Get client info
        client = None
        if quote.get('client_id'):
            if ObjectId.is_valid(quote['client_id']):
                client = await _db.users.find_one({"_id": ObjectId(quote['client_id'])})
            if not client:
                client = await _db.users.find_one({"_id": quote['client_id']})
        
        # Create invoice
        invoice = {
            "invoice_number": invoice_number,
            "quote_id": quote_id,
            "quote_number": quote.get('quote_number'),
            "client_id": quote.get('client_id'),
            "client_name": client.get('name') or client.get('full_name') if client else 'Cliente',
            "client_email": client.get('email') if client else '',
            "case_id": quote.get('case_id'),
            "services": quote.get('services', []),
            "subtotal": quote.get('subtotal', 0),
            "discount_percent": quote.get('discount_percent', 0),
            "discount_amount": quote.get('discount_amount', 0),
            "total": quote.get('total', 0),
            "amount_paid": 0,
            "balance_due": quote.get('total', 0),
            "status": "pending",
            "due_date": datetime.utcnow() + timedelta(days=data.get('due_days', 30)),
            "notes": quote.get('notes', ''),
            "payment_plan": data.get('payment_plan'),  # Optional payment plan
            "created_by": str(current_user.get('_id', '')),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await _db.invoices.insert_one(invoice)
        invoice['_id'] = str(result.inserted_id)
        
        # Update quote status
        await _db.immigration_quotes.update_one(
            {"_id": ObjectId(quote_id)},
            {"$set": {
                "status": "accepted",
                "accepted_at": datetime.utcnow(),
                "invoice_id": str(result.inserted_id),
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {"message": "Invoice created successfully", "invoice": invoice}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Convert to invoice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/invoices/{invoice_id}/payment')
async def record_invoice_payment(
    invoice_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Record a payment against an invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        data = await request.json()
        
        invoice = await _db.invoices.find_one({"_id": ObjectId(invoice_id)})
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        amount = data.get('amount', 0)
        payment_method = data.get('payment_method', 'cash')
        notes = data.get('notes', '')
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be positive")
        
        # Create payment record
        payment = {
            "invoice_id": invoice_id,
            "amount": amount,
            "payment_method": payment_method,
            "notes": notes,
            "recorded_by": str(current_user.get('_id', '')),
            "recorded_at": datetime.utcnow()
        }
        
        await _db.invoice_payments.insert_one(payment)
        
        # Update invoice
        new_amount_paid = invoice.get('amount_paid', 0) + amount
        new_balance = invoice.get('total', 0) - new_amount_paid
        new_status = 'paid' if new_balance <= 0 else 'partial'
        
        await _db.invoices.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {
                "amount_paid": new_amount_paid,
                "balance_due": max(0, new_balance),
                "status": new_status,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "message": "Payment recorded successfully",
            "payment": payment,
            "invoice_status": new_status,
            "balance_due": max(0, new_balance)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

print("💳 Immigration Invoicing endpoints registered!")


# ============== IMMIGRATION REPORTS ==============

@immigration_router.get('/admin/immigration/reports/summary')
async def get_immigration_reports_summary(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(_auth_user)
):
    """Get comprehensive immigration reports"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Date filters
        date_filter = {}
        if start_date:
            date_filter['$gte'] = datetime.fromisoformat(start_date)
        if end_date:
            date_filter['$lte'] = datetime.fromisoformat(end_date)
        
        query = {}
        if date_filter:
            query['created_at'] = date_filter
        
        # Cases by status
        cases_by_status = {}
        for status in ['pending', 'in_progress', 'under_review', 'completed', 'rejected', 'cancelled']:
            count = await _db.immigration_cases.count_documents({**query, "status": status})
            cases_by_status[status] = count
        
        total_cases = sum(cases_by_status.values())
        
        # Cases by type
        pipeline = [
            {"$match": query} if query else {"$match": {}},
            {"$group": {"_id": "$service_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        cases_by_type_raw = await _db.immigration_cases.aggregate(pipeline).to_list(length=10)
        
        cases_by_type = []
        for item in cases_by_type_raw:
            if item['_id']:
                service = await _db.immigration_services.find_one({"_id": ObjectId(item['_id'])})
                cases_by_type.append({
                    "name": service.get('name', 'Otro') if service else 'Otro',
                    "count": item['count']
                })
        
        # Revenue from accepted quotes
        quote_query = {"status": "accepted"}
        if date_filter:
            quote_query['accepted_at'] = date_filter
        
        revenue_pipeline = [
            {"$match": quote_query},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
        ]
        revenue_result = await _db.immigration_quotes.aggregate(revenue_pipeline).to_list(length=1)
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        accepted_quotes = revenue_result[0]['count'] if revenue_result else 0
        
        # Conversion rate
        total_quotes = await _db.immigration_quotes.count_documents({})
        sent_quotes = await _db.immigration_quotes.count_documents({"status": {"$in": ["sent", "viewed", "accepted", "rejected"]}})
        conversion_rate = round((accepted_quotes / sent_quotes * 100), 1) if sent_quotes > 0 else 0
        
        # Average case duration (for completed cases)
        duration_pipeline = [
            {"$match": {"status": "completed"}},
            {"$project": {
                "duration": {"$subtract": ["$updated_at", "$created_at"]}
            }},
            {"$group": {"_id": None, "avg_duration": {"$avg": "$duration"}}}
        ]
        duration_result = await _db.immigration_cases.aggregate(duration_pipeline).to_list(length=1)
        avg_duration_ms = duration_result[0]['avg_duration'] if duration_result else 0
        avg_duration_days = round(avg_duration_ms / (1000 * 60 * 60 * 24)) if avg_duration_ms else 0
        
        # Appointments stats
        total_appointments = await _db.immigration_appointments.count_documents(query)
        completed_appointments = await _db.immigration_appointments.count_documents({**query, "status": "completed"})
        
        return {
            "cases": {
                "total": total_cases,
                "by_status": cases_by_status,
                "by_type": cases_by_type,
                "success_rate": round((cases_by_status.get('completed', 0) / total_cases * 100), 1) if total_cases > 0 else 0,
                "avg_duration_days": avg_duration_days
            },
            "revenue": {
                "total": total_revenue,
                "accepted_quotes": accepted_quotes,
                "conversion_rate": conversion_rate
            },
            "appointments": {
                "total": total_appointments,
                "completed": completed_appointments,
                "completion_rate": round((completed_appointments / total_appointments * 100), 1) if total_appointments > 0 else 0
            }
        }
    except Exception as e:
        print(f"Reports error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("📊 Immigration Reports endpoints registered!")


# ============== IMMIGRATION DOCUMENT TEMPLATES ==============

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
import io
import base64

# Predefined document templates
DOCUMENT_TEMPLATES = {
    "engagement_letter": {
        "name": "Carta de Compromiso",
        "name_en": "Engagement Letter",
        "description": "Carta de compromiso de servicios legales de inmigración",
        "category": "contracts",
        "variables": ["client_name", "client_address", "service_type", "fee", "date"]
    },
    "service_contract": {
        "name": "Contrato de Servicios",
        "name_en": "Service Contract",
        "description": "Contrato formal de servicios de inmigración",
        "category": "contracts",
        "variables": ["client_name", "client_address", "service_description", "total_fee", "payment_terms", "date"]
    },
    "power_of_attorney": {
        "name": "Poder Notarial (G-28)",
        "name_en": "Power of Attorney (G-28)",
        "description": "Autorización para representación ante USCIS",
        "category": "legal",
        "variables": ["client_name", "client_address", "client_dob", "a_number", "representative_name", "date"]
    },
    "document_checklist": {
        "name": "Lista de Documentos Requeridos",
        "name_en": "Required Documents Checklist",
        "description": "Lista de verificación de documentos para el caso",
        "category": "checklists",
        "variables": ["client_name", "case_type", "documents_list"]
    },
    "case_status_letter": {
        "name": "Carta de Estado del Caso",
        "name_en": "Case Status Letter",
        "description": "Carta informando el estado actual del caso",
        "category": "correspondence",
        "variables": ["client_name", "case_number", "case_type", "current_status", "next_steps", "date"]
    },
    "receipt_letter": {
        "name": "Carta de Recibo de Pago",
        "name_en": "Payment Receipt Letter",
        "description": "Confirmación de pago recibido",
        "category": "financial",
        "variables": ["client_name", "amount", "payment_method", "service_description", "date"]
    },
    "appointment_confirmation": {
        "name": "Confirmación de Cita",
        "name_en": "Appointment Confirmation",
        "description": "Confirmación de cita programada",
        "category": "correspondence",
        "variables": ["client_name", "appointment_date", "appointment_time", "location", "purpose"]
    }
}

TEMPLATE_CATEGORIES = {
    "contracts": {"name": "Contratos", "icon": "file-text"},
    "legal": {"name": "Documentos Legales", "icon": "scale"},
    "checklists": {"name": "Listas de Verificación", "icon": "check-square"},
    "correspondence": {"name": "Correspondencia", "icon": "mail"},
    "financial": {"name": "Financieros", "icon": "dollar-sign"}
}


def generate_pdf_engagement_letter(data: dict) -> bytes:
    """Generate engagement letter PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER, spaceAfter=20)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, alignment=TA_JUSTIFY, spaceAfter=12, leading=14)
    
    story = []
    
    # Header
    story.append(Paragraph("ROSS TAX & IMMIGRATION SERVICES", title_style))
    story.append(Paragraph(f"Fecha: {data.get('date', datetime.utcnow().strftime('%d/%m/%Y'))}", header_style))
    story.append(Spacer(1, 20))
    
    # Client info
    story.append(Paragraph(f"<b>Para:</b> {data.get('client_name', '[Nombre del Cliente]')}", body_style))
    story.append(Paragraph(f"<b>Dirección:</b> {data.get('client_address', '[Dirección]')}", body_style))
    story.append(Spacer(1, 20))
    
    # Title
    story.append(Paragraph("<b>CARTA DE COMPROMISO DE SERVICIOS</b>", ParagraphStyle('SubTitle', parent=styles['Heading2'], alignment=TA_CENTER, spaceAfter=20)))
    
    # Body
    body_text = f"""
    Por medio de la presente, nos complace confirmar que Ross Tax & Immigration Services ha sido contratado 
    para proporcionar servicios de inmigración relacionados con: <b>{data.get('service_type', '[Tipo de Servicio]')}</b>.
    
    <br/><br/>
    
    <b>Alcance de los Servicios:</b><br/>
    Nuestros servicios incluirán la preparación y presentación de todos los formularios necesarios, 
    revisión de documentación de respaldo, comunicación con las autoridades de inmigración en su nombre, 
    y asesoría continua durante todo el proceso.
    
    <br/><br/>
    
    <b>Honorarios:</b><br/>
    El costo total por nuestros servicios será de <b>${data.get('fee', '[Monto]')}</b>, 
    el cual no incluye las tarifas gubernamentales de presentación.
    
    <br/><br/>
    
    <b>Términos:</b><br/>
    - Se requiere un depósito del 50% para iniciar el caso.<br/>
    - El saldo restante deberá ser pagado antes de la presentación final.<br/>
    - Los honorarios no son reembolsables una vez iniciado el trabajo.
    
    <br/><br/>
    
    Al firmar esta carta, usted acepta los términos y condiciones aquí establecidos.
    """
    story.append(Paragraph(body_text, body_style))
    story.append(Spacer(1, 40))
    
    # Signatures
    sig_data = [
        ["_________________________", "_________________________"],
        ["Cliente: " + data.get('client_name', ''), "Ross Tax & Immigration Services"],
        ["Fecha:", "Fecha:"]
    ]
    sig_table = Table(sig_data, colWidths=[3*inch, 3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    return buffer.getvalue()


def generate_pdf_service_contract(data: dict) -> bytes:
    """Generate service contract PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, alignment=TA_JUSTIFY, spaceAfter=12, leading=14)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, spaceBefore=15, spaceAfter=10)
    
    story = []
    
    story.append(Paragraph("CONTRATO DE SERVICIOS DE INMIGRACIÓN", title_style))
    story.append(Paragraph(f"Fecha: {data.get('date', datetime.utcnow().strftime('%d/%m/%Y'))}", ParagraphStyle('Date', alignment=TA_RIGHT)))
    story.append(Spacer(1, 20))
    
    # Parties
    story.append(Paragraph("1. PARTES", section_style))
    story.append(Paragraph(f"""
    Este contrato se celebra entre:<br/>
    <b>Proveedor:</b> Ross Tax & Immigration Services<br/>
    <b>Cliente:</b> {data.get('client_name', '[Nombre]')}<br/>
    <b>Dirección:</b> {data.get('client_address', '[Dirección]')}
    """, body_style))
    
    # Services
    story.append(Paragraph("2. DESCRIPCIÓN DE SERVICIOS", section_style))
    story.append(Paragraph(f"""
    El Proveedor acuerda proporcionar los siguientes servicios:<br/>
    {data.get('service_description', '[Descripción de servicios]')}
    """, body_style))
    
    # Fees
    story.append(Paragraph("3. HONORARIOS Y PAGOS", section_style))
    story.append(Paragraph(f"""
    <b>Costo Total:</b> ${data.get('total_fee', '[Monto]')}<br/>
    <b>Términos de Pago:</b> {data.get('payment_terms', 'Pago inicial del 50%, saldo antes de presentación')}
    """, body_style))
    
    # Terms
    story.append(Paragraph("4. TÉRMINOS Y CONDICIONES", section_style))
    story.append(Paragraph("""
    - El cliente se compromete a proporcionar información veraz y completa.<br/>
    - Los honorarios no incluyen tarifas gubernamentales.<br/>
    - No se garantiza la aprobación del caso por las autoridades.<br/>
    - La cancelación después de iniciado el trabajo no da derecho a reembolso.
    """, body_style))
    
    story.append(Spacer(1, 40))
    
    # Signatures
    sig_data = [
        ["_________________________", "_________________________"],
        ["Cliente", "Representante Autorizado"],
        [data.get('client_name', ''), "Ross Tax & Immigration Services"]
    ]
    sig_table = Table(sig_data, colWidths=[3*inch, 3*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    return buffer.getvalue()


def generate_pdf_document_checklist(data: dict) -> bytes:
    """Generate document checklist PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, spaceAfter=8)
    
    story = []
    
    story.append(Paragraph("LISTA DE DOCUMENTOS REQUERIDOS", title_style))
    story.append(Paragraph(f"<b>Cliente:</b> {data.get('client_name', '[Nombre]')}", body_style))
    story.append(Paragraph(f"<b>Tipo de Caso:</b> {data.get('case_type', '[Tipo de Caso]')}", body_style))
    story.append(Paragraph(f"<b>Fecha:</b> {data.get('date', datetime.utcnow().strftime('%d/%m/%Y'))}", body_style))
    story.append(Spacer(1, 20))
    
    # Documents table
    documents = data.get('documents_list', [])
    if not documents:
        documents = ["Pasaporte válido", "Acta de nacimiento", "Fotos tipo pasaporte", "Comprobante de domicilio"]
    
    table_data = [["#", "Documento", "Estado", "Notas"]]
    for i, doc in enumerate(documents, 1):
        if isinstance(doc, dict):
            table_data.append([str(i), doc.get('name', ''), "☐ Pendiente", ""])
        else:
            table_data.append([str(i), doc, "☐ Pendiente", ""])
    
    table = Table(table_data, colWidths=[0.5*inch, 3*inch, 1.2*inch, 2*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
    ]))
    story.append(table)
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("<b>Notas Importantes:</b>", body_style))
    story.append(Paragraph("- Todos los documentos deben ser originales o copias certificadas.", body_style))
    story.append(Paragraph("- Los documentos en otro idioma requieren traducción certificada.", body_style))
    story.append(Paragraph("- Las fotos deben cumplir con los requisitos de USCIS.", body_style))
    
    doc.build(story)
    return buffer.getvalue()


def generate_pdf_case_status_letter(data: dict) -> bytes:
    """Generate case status letter PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=14, alignment=TA_CENTER, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, alignment=TA_JUSTIFY, spaceAfter=12, leading=14)
    
    story = []
    
    story.append(Paragraph("ROSS TAX & IMMIGRATION SERVICES", title_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"Fecha: {data.get('date', datetime.utcnow().strftime('%d/%m/%Y'))}", ParagraphStyle('Date', alignment=TA_RIGHT)))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph(f"<b>Para:</b> {data.get('client_name', '[Nombre del Cliente]')}", body_style))
    story.append(Paragraph(f"<b>Número de Caso:</b> {data.get('case_number', '[Número]')}", body_style))
    story.append(Paragraph(f"<b>Tipo de Caso:</b> {data.get('case_type', '[Tipo]')}", body_style))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("<b>ACTUALIZACIÓN DEL ESTADO DE SU CASO</b>", ParagraphStyle('SubTitle', alignment=TA_CENTER, fontSize=12, spaceAfter=15)))
    
    story.append(Paragraph(f"""
    Estimado/a {data.get('client_name', 'Cliente')},<br/><br/>
    
    Por medio de la presente le informamos sobre el estado actual de su caso de inmigración:<br/><br/>
    
    <b>Estado Actual:</b> {data.get('current_status', '[Estado]')}<br/><br/>
    
    <b>Próximos Pasos:</b><br/>
    {data.get('next_steps', 'Estamos en espera de respuesta de las autoridades de inmigración.')}
    <br/><br/>
    
    Si tiene alguna pregunta sobre su caso, no dude en contactarnos.<br/><br/>
    
    Atentamente,<br/>
    Ross Tax & Immigration Services
    """, body_style))
    
    doc.build(story)
    return buffer.getvalue()


def generate_pdf_receipt(data: dict) -> bytes:
    """Generate payment receipt PDF"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER, spaceAfter=20)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, spaceAfter=10)
    
    story = []
    
    story.append(Paragraph("RECIBO DE PAGO", title_style))
    story.append(Paragraph("Ross Tax & Immigration Services", ParagraphStyle('Subtitle', alignment=TA_CENTER, fontSize=12)))
    story.append(Spacer(1, 30))
    
    # Receipt details
    receipt_data = [
        ["Fecha:", data.get('date', datetime.utcnow().strftime('%d/%m/%Y'))],
        ["Cliente:", data.get('client_name', '[Nombre]')],
        ["Concepto:", data.get('service_description', '[Descripción del servicio]')],
        ["Método de Pago:", data.get('payment_method', 'Efectivo')],
        ["Monto:", f"${data.get('amount', '0.00')}"],
    ]
    
    table = Table(receipt_data, colWidths=[2*inch, 4*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]))
    story.append(table)
    
    story.append(Spacer(1, 40))
    story.append(Paragraph("_________________________", ParagraphStyle('Sig', alignment=TA_CENTER)))
    story.append(Paragraph("Firma Autorizada", ParagraphStyle('Sig', alignment=TA_CENTER, fontSize=10)))
    
    doc.build(story)
    return buffer.getvalue()


PDF_GENERATORS = {
    "engagement_letter": generate_pdf_engagement_letter,
    "service_contract": generate_pdf_service_contract,
    "document_checklist": generate_pdf_document_checklist,
    "case_status_letter": generate_pdf_case_status_letter,
    "receipt_letter": generate_pdf_receipt,
}


@immigration_router.get('/admin/immigration/templates')
async def get_document_templates(
    category: str = None,
    current_user: dict = Depends(_auth_user)
):
    """Get available document templates"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    templates = []
    for key, template in DOCUMENT_TEMPLATES.items():
        if category and template.get('category') != category:
            continue
        templates.append({
            "id": key,
            **template
        })
    
    return {
        "templates": templates,
        "categories": TEMPLATE_CATEGORIES
    }


@immigration_router.post('/admin/immigration/templates/{template_id}/generate')
async def generate_document_from_template(
    template_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Generate a PDF document from template"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if template_id not in DOCUMENT_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        data = await request.json()
        
        # Get generator function
        generator = PDF_GENERATORS.get(template_id)
        if not generator:
            raise HTTPException(status_code=400, detail="PDF generator not available for this template")
        
        # Add default date if not provided
        if 'date' not in data:
            data['date'] = datetime.utcnow().strftime('%d/%m/%Y')
        
        # Generate PDF
        pdf_bytes = generator(data)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Save to history if case_id provided
        if data.get('case_id'):
            history_entry = {
                "template_id": template_id,
                "template_name": DOCUMENT_TEMPLATES[template_id]['name'],
                "generated_by": str(current_user.get('_id', '')),
                "generated_at": datetime.utcnow(),
                "data_used": {k: v for k, v in data.items() if k != 'case_id'}
            }
            await _db.immigration_cases.update_one(
                {"_id": ObjectId(data['case_id'])},
                {"$push": {"generated_documents": history_entry}}
            )
        
        return {
            "message": "Document generated successfully",
            "pdf_base64": pdf_base64,
            "filename": f"{template_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf",
            "template": DOCUMENT_TEMPLATES[template_id]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.post('/admin/immigration/templates/{template_id}/preview')
async def preview_document_template(
    template_id: str,
    request: Request,
    current_user: dict = Depends(_auth_user)
):
    """Preview a document template with sample data"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if template_id not in DOCUMENT_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    
    try:
        data = await request.json() if request else {}
        
        # Use sample data for preview
        sample_data = {
            "client_name": data.get('client_name', "Juan Pérez García"),
            "client_address": data.get('client_address', "305 Bruce Ave, Dumas, TX 79029"),
            "service_type": data.get('service_type', "Aplicación para Residencia Permanente"),
            "service_description": data.get('service_description', "Preparación y presentación de formularios I-485, I-130, y documentos de respaldo"),
            "fee": data.get('fee', "1,500.00"),
            "total_fee": data.get('total_fee', "1,500.00"),
            "payment_terms": data.get('payment_terms', "50% inicial, 50% antes de presentación"),
            "case_number": data.get('case_number', "INM-2026-00001"),
            "case_type": data.get('case_type', "Residencia Permanente"),
            "current_status": data.get('current_status', "En Proceso - Documentos en revisión"),
            "next_steps": data.get('next_steps', "1. Completar recopilación de documentos\n2. Preparar formularios\n3. Presentar ante USCIS"),
            "amount": data.get('amount', "750.00"),
            "payment_method": data.get('payment_method', "Tarjeta de Crédito"),
            "documents_list": data.get('documents_list', ["Pasaporte válido", "Acta de nacimiento", "Certificado de antecedentes", "Fotos tipo pasaporte", "Comprobante de domicilio"]),
            "date": datetime.utcnow().strftime('%d/%m/%Y')
        }
        
        generator = PDF_GENERATORS.get(template_id)
        if not generator:
            raise HTTPException(status_code=400, detail="PDF generator not available")
        
        pdf_bytes = generator(sample_data)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "message": "Preview generated",
            "pdf_base64": pdf_base64,
            "sample_data": sample_data
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@immigration_router.get('/admin/immigration/cases/{case_id}/generate-documents')
async def get_case_for_document_generation(
    case_id: str,
    current_user: dict = Depends(_auth_user)
):
    """Get case data prepared for document generation"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        case = await _db.immigration_cases.find_one({"_id": ObjectId(case_id)})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Get client info
        client_data = {}
        if case.get('client_id'):
            client = None
            if ObjectId.is_valid(case['client_id']):
                client = await _db.users.find_one({"_id": ObjectId(case['client_id'])})
            if not client:
                client = await _db.users.find_one({"_id": case['client_id']})
            if client:
                client_data = {
                    "client_name": client.get('name') or client.get('full_name') or '',
                    "client_email": client.get('email', ''),
                    "client_phone": client.get('phone', ''),
                    "client_address": client.get('address', '')
                }
        
        # Get service info
        service_data = {}
        if case.get('service_id'):
            service = await _db.immigration_services.find_one({"_id": ObjectId(case['service_id'])})
            if service:
                service_data = {
                    "service_type": service.get('name', ''),
                    "service_description": service.get('description', ''),
                    "fee": str(service.get('price', 0))
                }
        
        # Get documents list
        documents = await _db.immigration_case_documents.find({"case_id": case_id}).to_list(length=50)
        documents_list = [d.get('name') for d in documents]
        
        return {
            "case_number": case.get('case_number', ''),
            "case_type": case.get('title', ''),
            "current_status": case.get('status', ''),
            **client_data,
            **service_data,
            "documents_list": documents_list,
            "generated_documents": case.get('generated_documents', [])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ═══════════════════════════════════════════════════════════════
# ASYLUM JUDGE STATISTICS (Public - No Auth Required)
# ═══════════════════════════════════════════════════════════════

@immigration_router.get("/asylum/judge-stats")
async def get_asylum_judge_stats(request: Request):
    """
    Public endpoint: Get asylum judge statistics with search, filter, sort.
    Query params:
      - court: filter by court name
      - search: search judge name
      - min_approval: minimum approval %
      - max_approval: maximum approval %
      - sort: field to sort by (approved_pct, denied_pct, total_cases, judge_name)
      - dir: sort direction (1=asc, -1=desc)
      - page: page number
      - limit: results per page
    """
    court = request.query_params.get("court", "").strip()
    search = request.query_params.get("search", "").strip()
    min_approval = request.query_params.get("min_approval", "")
    max_approval = request.query_params.get("max_approval", "")
    sort_field = request.query_params.get("sort", "court")
    sort_dir = int(request.query_params.get("dir", 1))
    page = int(request.query_params.get("page", 1))
    limit = int(request.query_params.get("limit", 50))
    
    query = {}
    
    if court:
        query["court"] = {"$regex": court, "$options": "i"}
    
    if search:
        query["judge_name"] = {"$regex": search, "$options": "i"}
    
    if min_approval:
        query.setdefault("approved_pct", {})["$gte"] = float(min_approval)
    
    if max_approval:
        query.setdefault("approved_pct", {})["$lte"] = float(max_approval)
    
    total = await _db["asylum_judge_stats"].count_documents(query)
    skip = (page - 1) * limit
    
    cursor = _db["asylum_judge_stats"].find(query).sort(
        sort_field, sort_dir
    ).skip(skip).limit(limit)
    
    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "court": doc["court"],
            "judge_name": doc["judge_name"],
            "total_cases": doc["total_cases"],
            "approved_pct": doc["approved_pct"],
            "other_pct": doc["other_pct"],
            "denied_pct": doc["denied_pct"],
            "data_period": doc.get("data_period", "2018-2023"),
        })
    
    return {
        "judges": results,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@immigration_router.get("/asylum/courts")
async def get_asylum_courts():
    """Public: Get list of all courts for filtering."""
    courts = await _db["asylum_judge_stats"].distinct("court")
    courts_with_counts = []
    for court in sorted(courts):
        count = await _db["asylum_judge_stats"].count_documents({"court": court})
        courts_with_counts.append({"name": court, "judge_count": count})
    return {"courts": courts_with_counts}
