"""
Projects & Tasks Module - Backend Routes
Inspired by Rise CRM project management
"""
from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

projects_router = APIRouter()
_db = None

def init_projects_router(db):
    global _db
    _db = db

async def _require_admin(request: Request):
    from server import verify_token
    token = request.cookies.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    user = await verify_token(token)
    if not user or user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

def serialize(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc


# ─── PROJECTS ───

@projects_router.get('/admin/projects')
async def list_projects(request: Request, status: str = None, search: str = None):
    await _require_admin(request)
    query = {}
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
        ]
    projects = await _db.projects.find(query).sort('created_at', -1).to_list(500)
    
    # Enrich with task counts
    for p in projects:
        pid = str(p['_id'])
        p['_id'] = pid
        p['tasks_total'] = await _db.tasks.count_documents({'project_id': pid})
        p['tasks_done'] = await _db.tasks.count_documents({'project_id': pid, 'status': 'done'})
        p['tasks_in_progress'] = await _db.tasks.count_documents({'project_id': pid, 'status': 'in_progress'})
        progress = 0
        if p['tasks_total'] > 0:
            progress = round((p['tasks_done'] / p['tasks_total']) * 100)
        p['progress'] = progress
    
    # Stats
    total = await _db.projects.count_documents({})
    open_count = await _db.projects.count_documents({'status': 'open'})
    completed = await _db.projects.count_documents({'status': 'completed'})
    on_hold = await _db.projects.count_documents({'status': 'on_hold'})
    
    return {
        'projects': projects,
        'stats': {
            'total': total,
            'open': open_count,
            'completed': completed,
            'on_hold': on_hold,
        }
    }

@projects_router.post('/admin/projects')
async def create_project(request: Request):
    await _require_admin(request)
    data = await request.json()
    project = {
        'name': data.get('name', ''),
        'description': data.get('description', ''),
        'status': data.get('status', 'open'),
        'priority': data.get('priority', 'medium'),
        'start_date': data.get('start_date'),
        'deadline': data.get('deadline'),
        'assigned_to': data.get('assigned_to', []),
        'client_id': data.get('client_id'),
        'tags': data.get('tags', []),
        'color': data.get('color', '#3B82F6'),
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = await _db.projects.insert_one(project)
    project['_id'] = str(result.inserted_id)
    return project

@projects_router.get('/admin/projects/{project_id}')
async def get_project(request: Request, project_id: str):
    await _require_admin(request)
    project = await _db.projects.find_one({'_id': ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    project['_id'] = str(project['_id'])
    project['tasks_total'] = await _db.tasks.count_documents({'project_id': project_id})
    project['tasks_done'] = await _db.tasks.count_documents({'project_id': project_id, 'status': 'done'})
    tasks = await _db.tasks.find({'project_id': project_id}).sort('created_at', -1).to_list(500)
    for t in tasks:
        t['_id'] = str(t['_id'])
    project['tasks'] = tasks
    return project


@projects_router.put('/admin/projects/{project_id}')
async def update_project(request: Request, project_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    await _db.projects.update_one({'_id': ObjectId(project_id)}, {'$set': data})
    updated = await _db.projects.find_one({'_id': ObjectId(project_id)})
    return serialize(updated)

@projects_router.delete('/admin/projects/{project_id}')
async def delete_project(request: Request, project_id: str):
    await _require_admin(request)
    await _db.projects.delete_one({'_id': ObjectId(project_id)})
    await _db.tasks.delete_many({'project_id': project_id})
    return {'deleted': True}


# ─── TASKS ───

@projects_router.get('/admin/tasks')
async def list_tasks(request: Request, project_id: str = None, status: str = None, assigned_to: str = None):
    await _require_admin(request)
    query = {}
    if project_id:
        query['project_id'] = project_id
    if status:
        query['status'] = status
    if assigned_to:
        query['assigned_to'] = assigned_to
    
    tasks = await _db.tasks.find(query).sort('created_at', -1).to_list(1000)
    for t in tasks:
        t['_id'] = str(t['_id'])
    
    return {'tasks': tasks}

@projects_router.post('/admin/tasks')
async def create_task(request: Request):
    user = await _require_admin(request)
    data = await request.json()
    task = {
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'project_id': data.get('project_id'),
        'status': data.get('status', 'to_do'),
        'priority': data.get('priority', 'medium'),
        'assigned_to': data.get('assigned_to', ''),
        'assigned_name': data.get('assigned_name', ''),
        'due_date': data.get('due_date'),
        'tags': data.get('tags', []),
        'created_by': user.get('full_name') or user.get('name', 'Admin'),
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        'completed_at': None,
    }
    result = await _db.tasks.insert_one(task)
    task['_id'] = str(result.inserted_id)
    return task

@projects_router.put('/admin/tasks/{task_id}')
async def update_task(request: Request, task_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    if data.get('status') == 'done' and not data.get('completed_at'):
        data['completed_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    await _db.tasks.update_one({'_id': ObjectId(task_id)}, {'$set': data})
    updated = await _db.tasks.find_one({'_id': ObjectId(task_id)})
    return serialize(updated)

@projects_router.delete('/admin/tasks/{task_id}')
async def delete_task(request: Request, task_id: str):
    await _require_admin(request)
    await _db.tasks.delete_one({'_id': ObjectId(task_id)})
    return {'deleted': True}


# ─── TICKETS ───

@projects_router.get('/admin/tickets')
async def list_tickets(request: Request, status: str = None):
    await _require_admin(request)
    query = {}
    if status:
        query['status'] = status
    tickets = await _db.tickets.find(query).sort('created_at', -1).to_list(500)
    for t in tickets:
        t['_id'] = str(t['_id'])
    
    new_count = await _db.tickets.count_documents({'status': 'new'})
    open_count = await _db.tickets.count_documents({'status': 'open'})
    closed_count = await _db.tickets.count_documents({'status': 'closed'})
    
    return {
        'tickets': tickets,
        'stats': {'new': new_count, 'open': open_count, 'closed': closed_count, 'total': new_count + open_count + closed_count}
    }

@projects_router.post('/admin/tickets')
async def create_ticket(request: Request):
    user = await _require_admin(request)
    data = await request.json()
    ticket = {
        'subject': data.get('subject', ''),
        'description': data.get('description', ''),
        'status': 'new',
        'priority': data.get('priority', 'medium'),
        'category': data.get('category', 'general'),
        'created_by': user.get('full_name') or user.get('name', 'Admin'),
        'assigned_to': data.get('assigned_to', ''),
        'client_name': data.get('client_name', ''),
        'replies': [],
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = await _db.tickets.insert_one(ticket)
    ticket['_id'] = str(result.inserted_id)
    return ticket

@projects_router.put('/admin/tickets/{ticket_id}')
async def update_ticket(request: Request, ticket_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    await _db.tickets.update_one({'_id': ObjectId(ticket_id)}, {'$set': data})
    updated = await _db.tickets.find_one({'_id': ObjectId(ticket_id)})
    return serialize(updated)

@projects_router.post('/admin/tickets/{ticket_id}/reply')
async def reply_ticket(request: Request, ticket_id: str):
    user = await _require_admin(request)
    data = await request.json()
    reply = {
        'message': data.get('message', ''),
        'by': user.get('full_name') or user.get('name', 'Admin'),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await _db.tickets.update_one(
        {'_id': ObjectId(ticket_id)},
        {'$push': {'replies': reply}, '$set': {'status': 'open', 'updated_at': datetime.now(timezone.utc)}}
    )
    return reply


# ─── ESTIMATES ───

@projects_router.get('/admin/estimates')
async def list_estimates(request: Request, status: str = None):
    await _require_admin(request)
    query = {}
    if status:
        query['status'] = status
    estimates = await _db.estimates.find(query).sort('created_at', -1).to_list(500)
    for e in estimates:
        e['_id'] = str(e['_id'])
    return {'estimates': estimates}

@projects_router.post('/admin/estimates')
async def create_estimate(request: Request):
    user = await _require_admin(request)
    data = await request.json()
    
    # Auto-generate estimate number
    count = await _db.estimates.count_documents({})
    estimate = {
        'estimate_number': f'EST-{count + 1:04d}',
        'client_name': data.get('client_name', ''),
        'client_email': data.get('client_email', ''),
        'items': data.get('items', []),
        'subtotal': data.get('subtotal', 0),
        'tax_rate': data.get('tax_rate', 0),
        'tax_amount': data.get('tax_amount', 0),
        'total': data.get('total', 0),
        'notes': data.get('notes', ''),
        'status': 'draft',
        'valid_until': data.get('valid_until'),
        'created_by': user.get('full_name') or user.get('name', 'Admin'),
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = await _db.estimates.insert_one(estimate)
    estimate['_id'] = str(result.inserted_id)
    return estimate

@projects_router.put('/admin/estimates/{estimate_id}')
async def update_estimate(request: Request, estimate_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    await _db.estimates.update_one({'_id': ObjectId(estimate_id)}, {'$set': data})
    updated = await _db.estimates.find_one({'_id': ObjectId(estimate_id)})
    return serialize(updated)

@projects_router.delete('/admin/estimates/{estimate_id}')
async def delete_estimate(request: Request, estimate_id: str):
    await _require_admin(request)
    await _db.estimates.delete_one({'_id': ObjectId(estimate_id)})
    return {'deleted': True}
