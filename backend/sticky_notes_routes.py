"""
Sticky Notes & Announcements Module - Backend Routes
Inspired by Rise CRM sticky notes and announcements widgets.
"""
from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

sticky_notes_router = APIRouter()
_db = None


def init_sticky_notes_router(db):
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


# ─── STICKY NOTES (Personal To-Do) ───

STICKY_COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C']


@sticky_notes_router.get('/admin/sticky-notes')
async def list_sticky_notes(request: Request):
    user = await _require_admin(request)
    user_id = user.get('id') or str(user.get('_id', ''))
    notes = await _db.sticky_notes.find({'user_id': user_id}).sort('order', 1).to_list(100)
    for n in notes:
        n['_id'] = str(n['_id'])
    return {'notes': notes}


@sticky_notes_router.post('/admin/sticky-notes')
async def create_sticky_note(request: Request):
    user = await _require_admin(request)
    user_id = user.get('id') or str(user.get('_id', ''))
    data = await request.json()

    count = await _db.sticky_notes.count_documents({'user_id': user_id})
    note = {
        'user_id': user_id,
        'user_name': user.get('full_name') or user.get('name', 'Admin'),
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'color': data.get('color', STICKY_COLORS[count % len(STICKY_COLORS)]),
        'is_completed': False,
        'order': count,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = await _db.sticky_notes.insert_one(note)
    note['_id'] = str(result.inserted_id)
    return note


@sticky_notes_router.put('/admin/sticky-notes/{note_id}')
async def update_sticky_note(request: Request, note_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    data.pop('user_id', None)
    await _db.sticky_notes.update_one({'_id': ObjectId(note_id)}, {'$set': data})
    updated = await _db.sticky_notes.find_one({'_id': ObjectId(note_id)})
    return serialize(updated)


@sticky_notes_router.delete('/admin/sticky-notes/{note_id}')
async def delete_sticky_note(request: Request, note_id: str):
    await _require_admin(request)
    await _db.sticky_notes.delete_one({'_id': ObjectId(note_id)})
    return {'deleted': True}


# ─── ANNOUNCEMENTS ───

@sticky_notes_router.get('/admin/announcements')
async def list_announcements(request: Request):
    await _require_admin(request)
    announcements = await _db.announcements.find({}).sort('created_at', -1).to_list(50)
    for a in announcements:
        a['_id'] = str(a['_id'])
    return {'announcements': announcements}


@sticky_notes_router.post('/admin/announcements')
async def create_announcement(request: Request):
    user = await _require_admin(request)
    data = await request.json()
    announcement = {
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'type': data.get('type', 'info'),  # info, warning, success, urgent
        'pinned': data.get('pinned', False),
        'created_by': user.get('full_name') or user.get('name', 'Admin'),
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        'expires_at': data.get('expires_at'),
        'read_by': [],
    }
    result = await _db.announcements.insert_one(announcement)
    announcement['_id'] = str(result.inserted_id)
    return announcement


@sticky_notes_router.put('/admin/announcements/{announcement_id}')
async def update_announcement(request: Request, announcement_id: str):
    await _require_admin(request)
    data = await request.json()
    data['updated_at'] = datetime.now(timezone.utc)
    data.pop('_id', None)
    await _db.announcements.update_one({'_id': ObjectId(announcement_id)}, {'$set': data})
    updated = await _db.announcements.find_one({'_id': ObjectId(announcement_id)})
    return serialize(updated)


@sticky_notes_router.post('/admin/announcements/{announcement_id}/read')
async def mark_announcement_read(request: Request, announcement_id: str):
    user = await _require_admin(request)
    user_id = user.get('id') or str(user.get('_id', ''))
    await _db.announcements.update_one(
        {'_id': ObjectId(announcement_id)},
        {'$addToSet': {'read_by': user_id}}
    )
    return {'marked': True}


@sticky_notes_router.delete('/admin/announcements/{announcement_id}')
async def delete_announcement(request: Request, announcement_id: str):
    await _require_admin(request)
    await _db.announcements.delete_one({'_id': ObjectId(announcement_id)})
    return {'deleted': True}
