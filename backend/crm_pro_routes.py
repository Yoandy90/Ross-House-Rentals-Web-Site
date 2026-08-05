"""
CRM Pro Features: Kanban, Knowledge Base, Contracts, Time Tracking
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import pytz

router = APIRouter(prefix="/api/admin/crm", tags=["CRM Pro"])
CT = pytz.timezone("America/Chicago")

_db = None

def set_crm_database(database):
    global _db
    _db = database

def get_db(request: Request = None):
    return _db

def serialize(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc

# ═══════════════════════════════════════════════
# KANBAN BOARD
# ═══════════════════════════════════════════════

@router.get("/kanban/boards")
async def list_boards(request: Request):
    db = get_db(request)
    boards = await db.kanban_boards.find().sort("created_at", -1).to_list(50)
    return {"boards": [serialize(b) for b in boards]}

@router.post("/kanban/boards")
async def create_board(request: Request):
    db = get_db(request)
    body = await request.json()
    board = {
        "name": body.get("name", "Nuevo Tablero"),
        "description": body.get("description", ""),
        "columns": body.get("columns", [
            {"id": "todo", "title": "Por Hacer", "color": "#3B82F6"},
            {"id": "in_progress", "title": "En Progreso", "color": "#F59E0B"},
            {"id": "review", "title": "En Revisión", "color": "#8B5CF6"},
            {"id": "done", "title": "Completado", "color": "#22C55E"},
        ]),
        "created_at": datetime.now(CT).isoformat(),
    }
    result = await db.kanban_boards.insert_one(board)
    board["_id"] = str(result.inserted_id)
    return {"success": True, "board": board}

@router.get("/kanban/tasks")
async def list_tasks(request: Request, board_id: str = None):
    db = get_db(request)
    query = {}
    if board_id:
        query["board_id"] = board_id
    tasks = await db.kanban_tasks.find(query).sort("position", 1).to_list(500)
    return {"tasks": [serialize(t) for t in tasks]}

@router.post("/kanban/tasks")
async def create_task(request: Request):
    db = get_db(request)
    body = await request.json()
    count = await db.kanban_tasks.count_documents({"column": body.get("column", "todo")})
    task = {
        "board_id": body.get("board_id", "default"),
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "column": body.get("column", "todo"),
        "priority": body.get("priority", "medium"),
        "assigned_to": body.get("assigned_to", ""),
        "due_date": body.get("due_date"),
        "labels": body.get("labels", []),
        "position": count,
        "created_at": datetime.now(CT).isoformat(),
        "updated_at": datetime.now(CT).isoformat(),
    }
    result = await db.kanban_tasks.insert_one(task)
    task["_id"] = str(result.inserted_id)
    return {"success": True, "task": task}

@router.put("/kanban/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    db = get_db(request)
    body = await request.json()
    body["updated_at"] = datetime.now(CT).isoformat()
    body.pop("_id", None)
    await db.kanban_tasks.update_one({"_id": ObjectId(task_id)}, {"$set": body})
    return {"success": True}

@router.delete("/kanban/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    db = get_db(request)
    await db.kanban_tasks.delete_one({"_id": ObjectId(task_id)})
    return {"success": True}

# ═══════════════════════════════════════════════
# KNOWLEDGE BASE (Base de Conocimiento)
# ═══════════════════════════════════════════════

@router.get("/knowledge-base")
async def list_articles(request: Request, category: str = None, search: str = None):
    db = get_db(request)
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]
    articles = await db.knowledge_base.find(query).sort("updated_at", -1).to_list(200)
    categories = await db.knowledge_base.distinct("category")
    return {"articles": [serialize(a) for a in articles], "categories": categories}

@router.post("/knowledge-base")
async def create_article(request: Request):
    db = get_db(request)
    body = await request.json()
    article = {
        "title": body.get("title", ""),
        "content": body.get("content", ""),
        "category": body.get("category", "General"),
        "tags": body.get("tags", []),
        "author": body.get("author", "Admin"),
        "is_pinned": body.get("is_pinned", False),
        "views": 0,
        "created_at": datetime.now(CT).isoformat(),
        "updated_at": datetime.now(CT).isoformat(),
    }
    result = await db.knowledge_base.insert_one(article)
    article["_id"] = str(result.inserted_id)
    return {"success": True, "article": article}

@router.get("/knowledge-base/{article_id}")
async def get_article(article_id: str, request: Request):
    db = get_db(request)
    article = await db.knowledge_base.find_one({"_id": ObjectId(article_id)})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.knowledge_base.update_one({"_id": ObjectId(article_id)}, {"$inc": {"views": 1}})
    return {"article": serialize(article)}

@router.put("/knowledge-base/{article_id}")
async def update_article(article_id: str, request: Request):
    db = get_db(request)
    body = await request.json()
    body["updated_at"] = datetime.now(CT).isoformat()
    body.pop("_id", None)
    await db.knowledge_base.update_one({"_id": ObjectId(article_id)}, {"$set": body})
    return {"success": True}

@router.delete("/knowledge-base/{article_id}")
async def delete_article(article_id: str, request: Request):
    db = get_db(request)
    await db.knowledge_base.delete_one({"_id": ObjectId(article_id)})
    return {"success": True}

# ═══════════════════════════════════════════════
# CONTRACTS (Contratos)
# ═══════════════════════════════════════════════

@router.get("/contracts")
async def list_contracts(request: Request, status: str = None):
    db = get_db(request)
    query = {}
    if status:
        query["status"] = status
    contracts = await db.contracts.find(query).sort("created_at", -1).to_list(200)
    stats = {
        "total": await db.contracts.count_documents({}),
        "draft": await db.contracts.count_documents({"status": "draft"}),
        "sent": await db.contracts.count_documents({"status": "sent"}),
        "signed": await db.contracts.count_documents({"status": "signed"}),
        "expired": await db.contracts.count_documents({"status": "expired"}),
    }
    return {"contracts": [serialize(c) for c in contracts], "stats": stats}

@router.post("/contracts")
async def create_contract(request: Request):
    db = get_db(request)
    body = await request.json()
    contract = {
        "title": body.get("title", ""),
        "client_name": body.get("client_name", ""),
        "client_email": body.get("client_email", ""),
        "content": body.get("content", ""),
        "value": body.get("value", 0),
        "start_date": body.get("start_date"),
        "end_date": body.get("end_date"),
        "status": "draft",
        "signed_at": None,
        "signature_data": None,
        "created_at": datetime.now(CT).isoformat(),
        "updated_at": datetime.now(CT).isoformat(),
    }
    result = await db.contracts.insert_one(contract)
    contract["_id"] = str(result.inserted_id)
    return {"success": True, "contract": contract}

@router.put("/contracts/{contract_id}")
async def update_contract(contract_id: str, request: Request):
    db = get_db(request)
    body = await request.json()
    body["updated_at"] = datetime.now(CT).isoformat()
    body.pop("_id", None)
    if body.get("status") == "signed" and not body.get("signed_at"):
        body["signed_at"] = datetime.now(CT).isoformat()
    await db.contracts.update_one({"_id": ObjectId(contract_id)}, {"$set": body})
    return {"success": True}

@router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: str, request: Request):
    db = get_db(request)
    await db.contracts.delete_one({"_id": ObjectId(contract_id)})
    return {"success": True}

# ═══════════════════════════════════════════════
# TIME TRACKING (Control de Horas)
# ═══════════════════════════════════════════════

@router.get("/time-tracking")
async def list_time_entries(request: Request, date: str = None, user: str = None):
    db = get_db(request)
    query = {}
    if date:
        query["date"] = date
    if user:
        query["user"] = user
    entries = await db.time_entries.find(query).sort("created_at", -1).to_list(500)
    
    # Calculate totals
    pipeline = [
        {"$group": {
            "_id": None,
            "total_hours": {"$sum": "$hours"},
            "total_entries": {"$sum": 1},
            "billable_hours": {"$sum": {"$cond": [{"$eq": ["$billable", True]}, "$hours", 0]}},
        }}
    ]
    totals_cursor = db.time_entries.aggregate(pipeline)
    totals_list = await totals_cursor.to_list(1)
    totals = totals_list[0] if totals_list else {"total_hours": 0, "total_entries": 0, "billable_hours": 0}
    totals.pop("_id", None)
    
    return {"entries": [serialize(e) for e in entries], "totals": totals}

@router.post("/time-tracking")
async def create_time_entry(request: Request):
    db = get_db(request)
    body = await request.json()
    entry = {
        "user": body.get("user", "Admin"),
        "client": body.get("client", ""),
        "project": body.get("project", ""),
        "task": body.get("task", ""),
        "hours": body.get("hours", 0),
        "description": body.get("description", ""),
        "date": body.get("date", datetime.now(CT).strftime("%Y-%m-%d")),
        "billable": body.get("billable", True),
        "rate": body.get("rate", 0),
        "created_at": datetime.now(CT).isoformat(),
    }
    result = await db.time_entries.insert_one(entry)
    entry["_id"] = str(result.inserted_id)
    return {"success": True, "entry": entry}

@router.put("/time-tracking/{entry_id}")
async def update_time_entry(entry_id: str, request: Request):
    db = get_db(request)
    body = await request.json()
    body.pop("_id", None)
    await db.time_entries.update_one({"_id": ObjectId(entry_id)}, {"$set": body})
    return {"success": True}

@router.delete("/time-tracking/{entry_id}")
async def delete_time_entry(entry_id: str, request: Request):
    db = get_db(request)
    await db.time_entries.delete_one({"_id": ObjectId(entry_id)})
    return {"success": True}

# ═══════════════════════════════════════════════
# CRM DASHBOARD STATS
# ═══════════════════════════════════════════════

@router.get("/stats")
async def crm_stats(request: Request):
    db = get_db(request)
    return {
        "kanban_tasks": await db.kanban_tasks.count_documents({}),
        "kanban_todo": await db.kanban_tasks.count_documents({"column": "todo"}),
        "kanban_in_progress": await db.kanban_tasks.count_documents({"column": "in_progress"}),
        "kanban_done": await db.kanban_tasks.count_documents({"column": "done"}),
        "articles": await db.knowledge_base.count_documents({}),
        "contracts_total": await db.contracts.count_documents({}),
        "contracts_signed": await db.contracts.count_documents({"status": "signed"}),
        "contracts_pending": await db.contracts.count_documents({"status": {"$in": ["draft", "sent"]}}),
        "time_entries": await db.time_entries.count_documents({}),
    }
