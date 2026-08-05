"""
Client Notes Router
Extracted from server.py for modularization.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

logger = logging.getLogger(__name__)

client_notes_router = APIRouter()
_db = None

def init_client_notes_router(db, get_current_user_func):
    global _db
    _db = db

async def _auth_user(request: Request):
    """Authenticate user from Bearer token — mirrors server.py get_current_user"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    # Handle both "Bearer <token>" and raw "<token>" formats
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Sesión expirada')
    # Get user — handle both ObjectId and UUID string IDs (matches server.py)
    user_id = session['user_id']
    user = None
    try:
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        pass
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=401, detail='Usuario no encontrado')
    user['id'] = str(user['_id'])
    return user

@client_notes_router.get("/admin/client-notes")
async def list_all_notes(request: Request):
    """List all notes with optional search and category filters"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

    category = request.query_params.get('category')
    search = request.query_params.get('search', '').strip()

    query = {}
    if current_user.get('role') == 'office_assistant':
        query['admin_only'] = {'$ne': True}
    if category and category != 'all':
        query['category'] = category
    if search:
        query['$or'] = [
            {'client_name': {'$regex': search, '$options': 'i'}},
            {'text': {'$regex': search, '$options': 'i'}},
            {'content': {'$regex': search, '$options': 'i'}},
        ]

    notes = await _db.client_notes.find(query).sort('created_at', -1).to_list(500)
    for note in notes:
        note['_id'] = str(note['_id'])
        # Normalize fields for frontend compatibility
        if 'text' in note and 'content' not in note:
            note['content'] = note['text']
        if 'content' in note and 'text' not in note:
            note['text'] = note['content']
    return notes


@client_notes_router.get("/admin/client-notes/{client_id}")
async def get_client_notes(client_id: str, request: Request):
    """Get all private notes for a specific client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    user_role = current_user.get('role', '')
    
    # Build query based on role
    query = {'client_id': client_id}
    if user_role == 'office_assistant':
        # Assistant can only see notes that are NOT admin_only
        query['admin_only'] = {'$ne': True}
    # Admin sees ALL notes (no filter needed)
    
    notes = await _db.client_notes.find(query).sort('created_at', -1).to_list(500)
    
    for note in notes:
        note['_id'] = str(note['_id'])
    
    return {'success': True, 'notes': notes}

@client_notes_router.post("/admin/client-notes")
async def create_client_note(request: Request):
    """Create a new private note for a client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    data = await request.json()
    client_id = data.get('client_id', '')
    client_name = data.get('client_name', '')
    text = (data.get('text') or data.get('content', '')).strip()
    category = data.get('category', 'general')
    is_important = data.get('is_important', False)
    priority = data.get('priority', 'normal')
    
    if not text:
        raise HTTPException(status_code=400, detail='text or content is required')
    
    user_role = current_user.get('role', '')
    # Admin notes are private (admin_only=True), assistant notes are visible to both
    is_admin_only = (user_role == 'admin')
    
    note = {
        'client_id': client_id,
        'client_name': client_name,
        'text': text,
        'content': text,
        'category': category,
        'priority': priority,
        'is_important': is_important,
        'admin_only': is_admin_only,
        'created_by': current_user.get('email', 'admin'),
        'created_by_name': current_user.get('name', 'Admin'),
        'created_by_role': user_role,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    
    result = await _db.client_notes.insert_one(note)
    note['_id'] = str(result.inserted_id)
    
    return {'success': True, 'note': note}

@client_notes_router.put("/admin/client-notes/{note_id}")
async def update_client_note(note_id: str, request: Request):
    """Update a private note"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    data = await request.json()
    update_fields = {}
    
    if 'text' in data:
        update_fields['text'] = data['text'].strip()
    if 'category' in data:
        update_fields['category'] = data['category']
    if 'is_important' in data:
        update_fields['is_important'] = data['is_important']
    
    update_fields['updated_at'] = datetime.utcnow().isoformat()
    update_fields['updated_by'] = current_user.get('email', 'admin')
    
    result = await _db.client_notes.update_one(
        {'_id': ObjectId(note_id)},
        {'$set': update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Note not found')
    
    return {'success': True, 'message': 'Note updated'}

@client_notes_router.delete("/admin/client-notes/{note_id}")
async def delete_client_note(note_id: str, request: Request):
    """Delete a private note"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    user_role = current_user.get('role', '')
    
    # If assistant, verify the note is not admin_only before deleting
    if user_role == 'office_assistant':
        note = await _db.client_notes.find_one({'_id': ObjectId(note_id)})
        if not note:
            raise HTTPException(status_code=404, detail='Note not found')
        if note.get('admin_only'):
            raise HTTPException(status_code=403, detail='No tiene permiso para eliminar esta nota')
    
    result = await _db.client_notes.delete_one({'_id': ObjectId(note_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Note not found')
    
    return {'success': True, 'message': 'Note deleted'}

@client_notes_router.get("/admin/client-notes-summary")
async def get_client_notes_summary(request: Request):
    """Get summary of notes across all clients with client details"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    user_role = current_user.get('role', '')
    
    # Role-based filter: assistants cannot see admin_only notes
    match_filter = {}
    if user_role == 'office_assistant':
        match_filter = {'admin_only': {'$ne': True}}
    
    pipeline = []
    if match_filter:
        pipeline.append({'$match': match_filter})
    pipeline.extend([
        {'$group': {
            '_id': '$client_id',
            'count': {'$sum': 1},
            'last_note': {'$max': '$created_at'},
            'last_text': {'$last': '$text'},
            'last_category': {'$last': '$category'},
            'has_important': {'$max': {'$cond': [{'$eq': ['$is_important', True]}, 1, 0]}},
            'categories': {'$addToSet': '$category'}
        }},
        {'$sort': {'last_note': -1}}
    ])
    
    results = await _db.client_notes.aggregate(pipeline).to_list(1000)
    
    # Count documents respecting role filter
    count_filter = match_filter if match_filter else {}
    total_notes = await _db.client_notes.count_documents(count_filter)
    clients_with_notes = len(results)
    
    # Enrich with client details — handle both ObjectId and string IDs
    client_ids_oid = []
    client_ids_str = []
    for r in results:
        if r['_id'] is None:
            continue
        try:
            client_ids_oid.append(ObjectId(r['_id']))
        except Exception:
            client_ids_str.append(r['_id'])
    
    clients_map = {}
    # Lookup by ObjectId
    if client_ids_oid:
        clients_cursor = _db.users.find(
            {'_id': {'$in': client_ids_oid}},
            {'name': 1, 'email': 1, 'phone': 1, 'picture': 1, 'profile_picture': 1}
        )
        async for c in clients_cursor:
            clients_map[str(c['_id'])] = {
                'name': c.get('name', ''),
                'email': c.get('email', ''),
                'phone': c.get('phone', ''),
                'picture': c.get('picture') or c.get('profile_picture', ''),
            }
    # Lookup by string ID
    if client_ids_str:
        clients_cursor = _db.users.find(
            {'_id': {'$in': client_ids_str}},
            {'name': 1, 'email': 1, 'phone': 1, 'picture': 1, 'profile_picture': 1}
        )
        async for c in clients_cursor:
            clients_map[str(c['_id'])] = {
                'name': c.get('name', ''),
                'email': c.get('email', ''),
                'phone': c.get('phone', ''),
                'picture': c.get('picture') or c.get('profile_picture', ''),
            }
    
    # Merge client data into summaries (skip null client_ids)
    enriched = []
    for r in results:
        if r['_id'] is None:
            enriched.append({
                '_id': '__unassigned__',
                'count': r['count'],
                'last_note': r['last_note'],
                'last_text': (r.get('last_text') or '')[:80],
                'last_category': r.get('last_category', 'general'),
                'has_important': r['has_important'],
                'categories': r.get('categories', []),
                'client_name': 'Sin Asignar',
                'client_email': 'Notas sin cliente asignado',
                'client_phone': '',
                'client_picture': '',
            })
            continue
        client_data = clients_map.get(r['_id'], {})
        enriched.append({
            '_id': r['_id'],
            'count': r['count'],
            'last_note': r['last_note'],
            'last_text': (r.get('last_text') or '')[:80],
            'last_category': r.get('last_category', 'general'),
            'has_important': r['has_important'],
            'categories': r.get('categories', []),
            'client_name': client_data.get('name', 'Cliente'),
            'client_email': client_data.get('email', ''),
            'client_phone': client_data.get('phone', ''),
            'client_picture': client_data.get('picture', ''),
        })
    
    # Category breakdown (with role filter)
    cat_pipeline = []
    if match_filter:
        cat_pipeline.append({'$match': match_filter})
    cat_pipeline.extend([
        {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ])
    cat_results = await _db.client_notes.aggregate(cat_pipeline).to_list(20)
    
    # Important count (with role filter)
    important_filter = {'is_important': True}
    if match_filter:
        important_filter.update(match_filter)
    important_count = await _db.client_notes.count_documents(important_filter)
    
    return {
        'success': True,
        'total_notes': total_notes,
        'clients_with_notes': clients_with_notes,
        'important_count': important_count,
        'category_breakdown': cat_results,
        'client_summaries': enriched
    }
