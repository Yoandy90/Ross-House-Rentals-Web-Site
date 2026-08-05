"""
Dependents CRUD endpoints - manages tax dependents for client profiles
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dependents", tags=["dependents"])

db = None

def set_db(database):
    global db
    db = database


async def get_current_user_id(request: Request):
    """Extract user_id from JWT token"""
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


@router.get('')
async def get_dependents(request: Request):
    """Get all dependents for the current user"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        dependents_collection = db['dependents']
        cursor = dependents_collection.find(
            {'user_id': user_id},
            {'_id': 1, 'first_name': 1, 'last_name': 1, 'relationship': 1,
             'date_of_birth': 1, 'ssn_last4': 1, 'is_student': 1, 'is_disabled': 1}
        ).sort('created_at', -1)

        results = []
        async for doc in cursor:
            doc['id'] = str(doc.pop('_id'))
            results.append(doc)

        return results
    except Exception as e:
        logger.error(f"Error listing dependents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('')
async def create_dependent(request: Request):
    """Create a new dependent"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        body = await request.json()
        dep_data = {
            'user_id': user_id,
            'first_name': body.get('first_name', ''),
            'last_name': body.get('last_name', ''),
            'relationship': body.get('relationship', 'child'),
            'date_of_birth': body.get('date_of_birth', ''),
            'ssn_last4': body.get('ssn_last4', ''),
            'is_student': body.get('is_student', False),
            'is_disabled': body.get('is_disabled', False),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        result = await db['dependents'].insert_one(dep_data)
        dep_data['id'] = str(result.inserted_id)
        dep_data.pop('_id', None)

        return {'success': True, 'dependent': dep_data}
    except Exception as e:
        logger.error(f"Error creating dependent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/{dependent_id}')
async def update_dependent(dependent_id: str, request: Request):
    """Update an existing dependent"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        body = await request.json()
        update_fields = {k: v for k, v in body.items() if k in [
            'first_name', 'last_name', 'relationship', 'date_of_birth',
            'ssn_last4', 'is_student', 'is_disabled'
        ] and v is not None}
        update_fields['updated_at'] = datetime.utcnow()

        result = await db['dependents'].update_one(
            {'_id': ObjectId(dependent_id), 'user_id': user_id},
            {'$set': update_fields}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Dependent not found")

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating dependent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/{dependent_id}')
async def delete_dependent(dependent_id: str, request: Request):
    """Delete a dependent"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        result = await db['dependents'].delete_one(
            {'_id': ObjectId(dependent_id), 'user_id': user_id}
        )

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Dependent not found")

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dependent: {e}")
        raise HTTPException(status_code=500, detail=str(e))
