"""
Admin Users Management Routes Router
Extracted from server.py for modularization.
Handles admin user management, user CRUD, role changes, and user search.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from bson import ObjectId

logger = logging.getLogger(__name__)

admin_users_router = APIRouter()
_db = None


def init_admin_users_router(db):
    global _db
    _db = db


# ================== Auth helpers ==================

async def _auth_user(request: Request):
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        try:
            user = await _db.users.find_one({'_id': ObjectId(session['user_id'])})
        except:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ================== ADMIN USERS ==================

@admin_users_router.get('/admin/users')
async def get_admin_users(
    request: Request,
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    skip: int = Query(0),
):
    current_user = await _require_admin(request)
    try:
        query = {}
        
        if search:
            import re
            search_regex = re.compile(re.escape(search), re.IGNORECASE)
            query['$or'] = [
                {'name': {'$regex': search_regex}},
                {'full_name': {'$regex': search_regex}},
                {'email': {'$regex': search_regex}},
                {'phone': {'$regex': search_regex}}
            ]
        
        if role:
            query['role'] = role
        
        total = await _db.users.count_documents(query)

        # Global role counts (from ALL users, not just the paginated page)
        pipeline = [{'$group': {'_id': '$role', 'count': {'$sum': 1}}}]
        role_counts_raw = await _db.users.aggregate(pipeline).to_list(20)
        global_role_counts = {}
        for rc in role_counts_raw:
            global_role_counts[rc['_id'] or 'undefined'] = rc['count']

        # Sort: admin first, then office_assistant, then clients, then by created_at desc
        sort_pipeline = [
            {'$match': query},
            {'$addFields': {
                '_sort_role': {
                    '$switch': {
                        'branches': [
                            {'case': {'$eq': ['$role', 'admin']}, 'then': 0},
                            {'case': {'$eq': ['$role', 'office_assistant']}, 'then': 1},
                        ],
                        'default': 2
                    }
                }
            }},
            {'$sort': {'_sort_role': 1, 'created_at': -1}},
            {'$skip': skip},
            {'$limit': limit},
        ]
        users = await _db.users.aggregate(sort_pipeline).to_list(limit)
        
        return {
            'users': [{
                'id': str(u['_id']),
                '_id': str(u['_id']),
                'user_id': u.get('id', str(u['_id'])),
                'name': u.get('name', u.get('full_name', 'Sin nombre')),
                'full_name': u.get('full_name', u.get('name', '')),
                'email': u.get('email', ''),
                'phone': u.get('phone', ''),
                'role': u.get('role', 'client'),
                'is_active': u.get('is_active', True),
                'status': u.get('status', 'active'),
                'created_at': u.get('created_at').isoformat() if u.get('created_at') else None,
                'last_login': u.get('last_login').isoformat() if u.get('last_login') else None,
                'has_push_token': bool(u.get('push_token')),
                'avatar': u.get('avatar', u.get('profile_image', '')),
            } for u in users],
            'total': total,
            'limit': limit,
            'skip': skip,
            'role_counts': global_role_counts,
        }
    except Exception as e:
        logging.error(f"Error getting admin users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_users_router.get('/admin/team')
async def get_team_members(request: Request):
    """Get team members (admin + office_assistant) for dropdowns"""
    await _require_admin(request)
    try:
        staff = await _db.users.find(
            {'role': {'$in': ['admin', 'office_assistant', 'preparer', 'tax_preparer']}},
            {'name': 1, 'full_name': 1, 'email': 1, 'role': 1, 'status': 1, 'avatar': 1, 'profile_image': 1}
        ).sort('name', 1).to_list(50)

        return {
            'team': [{
                'id': str(s['_id']),
                'name': s.get('name', s.get('full_name', 'Sin nombre')),
                'email': s.get('email', ''),
                'role': s.get('role', ''),
                'avatar': s.get('avatar', s.get('profile_image', '')),
            } for s in staff if s.get('status', 'active') != 'inactive'],
        }
    except Exception as e:
        logging.error(f"Error getting team members: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_users_router.get('/admin/users/{user_id}')
async def get_admin_user_detail(user_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        user = None
        if ObjectId.is_valid(user_id):
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            user = await _db.users.find_one({'_id': user_id})
        if not user:
            user = await _db.users.find_one({'id': user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        user_dict = dict(user)
        user_dict['id'] = str(user_dict.pop('_id'))
        
        # Remove sensitive fields
        user_dict.pop('password_hash', None)
        user_dict.pop('password', None)
        
        # Get related data counts
        user_id_str = user_dict['id']
        user_uuid = user_dict.get('uuid', user_dict.get('id', ''))
        
        docs_count = await _db.documents.count_documents({
            '$or': [{'user_id': user_id_str}, {'user_id': user_uuid}]
        })
        
        appointments_count = await _db.appointments.count_documents({
            '$or': [{'user_id': user_id_str}, {'user_id': user_uuid}, {'client_id': user_id_str}]
        })
        
        invoices = await _db.invoices.find({
            '$or': [
                {'user_id': user_id_str},
                {'user_id': user_uuid},
                {'user_email': user_dict.get('email', '')}
            ]
        }).to_list(100)
        
        total_invoiced = sum(inv.get('total', inv.get('amount', 0)) for inv in invoices)
        total_paid = sum(inv.get('total', inv.get('amount', 0)) for inv in invoices if inv.get('status') == 'paid')
        
        user_dict['stats'] = {
            'documents': docs_count,
            'appointments': appointments_count,
            'invoices_count': len(invoices),
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'balance': total_invoiced - total_paid,
        }
        
        return user_dict
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting user detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_users_router.put('/admin/users/{user_id}')
async def update_admin_user(user_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        data = await request.json()
        
        user = None
        query_id = None
        if ObjectId.is_valid(user_id):
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
            if user:
                query_id = {'_id': ObjectId(user_id)}
        if not user:
            user = await _db.users.find_one({'_id': user_id})
            if user:
                query_id = {'_id': user_id}
        if not user:
            user = await _db.users.find_one({'id': user_id})
            if user:
                query_id = {'_id': user['_id']}
        
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Build update data
        update_data = {}
        allowed_fields = [
            'name', 'full_name', 'email', 'phone', 'role', 'status',
            'address', 'city', 'state', 'zip_code', 'ssn_last4',
            'date_of_birth', 'filing_status', 'notes'
        ]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        if update_data:
            update_data['updated_at'] = datetime.now(timezone.utc)
            update_data['updated_by'] = current_user.get('email')
            
            await _db.users.update_one(query_id, {'$set': update_data})
        
        return {'success': True, 'message': 'Usuario actualizado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== CREATE USER (from admin panel) ==================

@admin_users_router.post('/admin/users')
async def create_admin_user(request: Request):
    """Create a new user with a specific role from the admin panel"""
    current_user = await _require_admin(request)

    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Solo administradores pueden crear usuarios')

    try:
        data = await request.json()
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'client')

        if not email:
            raise HTTPException(status_code=400, detail='Email es requerido')
        if not password:
            raise HTTPException(status_code=400, detail='Contraseña es requerida')

        # Validate role
        valid_roles = ['admin', 'office_assistant', 'client']
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail=f'Rol inválido. Opciones: {valid_roles}')

        # Check if user already exists
        existing = await _db.users.find_one({'email': email})
        if existing:
            raise HTTPException(status_code=409, detail='Ya existe un usuario con ese email')

        # Hash password
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash(password)

        import uuid
        new_user = {
            'id': str(uuid.uuid4()),
            'email': email,
            'name': name,
            'full_name': name,
            'phone': phone,
            'password_hash': hashed_password,
            'role': role,
            'status': 'active',
            'is_active': True,
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.get('email'),
            'updated_at': datetime.now(timezone.utc),
        }

        result = await _db.users.insert_one(new_user)
        logger.info(f"User created: {email} with role {role} by {current_user.get('email')}")

        return {
            'success': True,
            'message': f'Usuario {email} creado exitosamente como {role}',
            'user_id': str(result.inserted_id),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== CHANGE USER ROLE ==================

@admin_users_router.put('/admin/users/{user_id}/role')
async def update_user_role(user_id: str, request: Request):
    """Change a user's role (admin, office_assistant, client)"""
    current_user = await _require_admin(request)

    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Solo administradores pueden cambiar roles')

    try:
        data = await request.json()
        new_role = data.get('role', '')

        valid_roles = ['admin', 'office_assistant', 'client']
        if new_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f'Rol inválido. Opciones: {valid_roles}')

        # Find the user
        user = None
        query_id = None
        if ObjectId.is_valid(user_id):
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
            if user:
                query_id = {'_id': ObjectId(user_id)}
        if not user:
            user = await _db.users.find_one({'_id': user_id})
            if user:
                query_id = {'_id': user_id}
        if not user:
            user = await _db.users.find_one({'id': user_id})
            if user:
                query_id = {'_id': user['_id']}

        if not user:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')

        # Don't allow removing the last admin
        if user.get('role') == 'admin' and new_role != 'admin':
            admin_count = await _db.users.count_documents({'role': 'admin'})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail='No se puede remover el último administrador')

        await _db.users.update_one(query_id, {'$set': {
            'role': new_role,
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('email'),
        }})

        logger.info(f"User {user_id} role changed to {new_role} by {current_user.get('email')}")

        return {'success': True, 'message': f'Rol actualizado a {new_role}'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== TOGGLE USER STATUS ==================

@admin_users_router.put('/admin/users/{user_id}/status')
async def toggle_user_status(user_id: str, request: Request):
    """Toggle user active/inactive status"""
    current_user = await _require_admin(request)

    try:
        data = await request.json()
        is_active = data.get('is_active', True)

        # Find the user
        user = None
        query_id = None
        if ObjectId.is_valid(user_id):
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
            if user:
                query_id = {'_id': ObjectId(user_id)}
        if not user:
            user = await _db.users.find_one({'_id': user_id})
            if user:
                query_id = {'_id': user_id}
        if not user:
            user = await _db.users.find_one({'id': user_id})
            if user:
                query_id = {'_id': user['_id']}

        if not user:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')

        new_status = 'active' if is_active else 'inactive'

        await _db.users.update_one(query_id, {'$set': {
            'status': new_status,
            'is_active': is_active,
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('email'),
        }})

        logger.info(f"User {user_id} status changed to {new_status} by {current_user.get('email')}")

        return {'success': True, 'message': f'Estado actualizado a {new_status}'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error toggling status: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@admin_users_router.delete('/admin/users/{user_id}')
async def delete_admin_user(user_id: str, request: Request):
    current_user = await _require_admin(request)
    
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Only admin can delete users')
    
    try:
        user = None
        query_id = None
        if ObjectId.is_valid(user_id):
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
            if user:
                query_id = {'_id': ObjectId(user_id)}
        if not user:
            user = await _db.users.find_one({'_id': user_id})
            if user:
                query_id = {'_id': user_id}
        
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        if user.get('role') == 'admin':
            raise HTTPException(status_code=400, detail='Cannot delete admin user')
        
        # Soft delete - mark as inactive
        await _db.users.update_one(
            query_id,
            {'$set': {
                'status': 'deleted',
                'deleted_at': datetime.now(timezone.utc),
                'deleted_by': current_user.get('email')
            }}
        )
        
        logging.info(f"User {user_id} deleted by {current_user.get('email')}")
        
        return {'success': True, 'message': 'Usuario eliminado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_users_router.get('/admin/users/search/{query}')
async def search_admin_users(query: str, request: Request):
    current_user = await _require_admin(request)
    try:
        import re
        search_regex = re.compile(query, re.IGNORECASE)
        
        users = await _db.users.find({
            '$or': [
                {'name': {'$regex': search_regex}},
                {'full_name': {'$regex': search_regex}},
                {'email': {'$regex': search_regex}},
                {'phone': {'$regex': search_regex}}
            ]
        }).limit(20).to_list(20)
        
        return {
            'users': [{
                'id': str(u['_id']),
                'name': u.get('name', u.get('full_name', 'Sin nombre')),
                'email': u.get('email', ''),
                'phone': u.get('phone', ''),
                'role': u.get('role', 'client'),
            } for u in users]
        }
    except Exception as e:
        logging.error(f"Error searching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))
