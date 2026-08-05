"""
Authentication Helpers for Ross Tax / Ross Lending Platform
Extracted from server.py — Handles password hashing, session tokens,
user authentication, and admin authorization.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException
from jose import jwt
from passlib.context import CryptContext

# Module-level state
_db = None
_SECRET_KEY = None
_ALGORITHM = 'HS256'
_ACCESS_TOKEN_EXPIRE_DAYS = 90
_pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def init_auth(db, secret_key: str = None, expire_days: int = 90):
    """Initialize auth module with database and JWT settings."""
    global _db, _SECRET_KEY, _ACCESS_TOKEN_EXPIRE_DAYS
    _db = db
    _SECRET_KEY = secret_key or os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
    _ACCESS_TOKEN_EXPIRE_DAYS = expire_days


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(plain_password, hashed_password)


def create_session_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {'sub': user_id, 'exp': expire}
    return jwt.encode(to_encode, _SECRET_KEY, algorithm=_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from session token"""
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    auth_str = str(authorization) if authorization else None
    if not auth_str:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    token = auth_str.replace('Bearer ', '') if auth_str.startswith('Bearer ') else auth_str
    
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    
    user_id = session['user_id']
    from bson import ObjectId
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except Exception as e:
        print(f"Error finding user with id {user_id}: {e}")
        raise HTTPException(status_code=401, detail='Invalid user ID')
    
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def get_user_from_token(token: str) -> dict:
    """Get user from session token (for loan endpoints)"""
    if not token:
        return None
    
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        return None
    
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        return None
    
    user_id = session['user_id']
    from bson import ObjectId
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except Exception as e:
        print(f"Error finding user with id {user_id}: {e}")
        return None
    
    if not user:
        return None
    
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def verify_token(token: str) -> dict:
    """Verify session token and return user (alias for get_user_from_token)"""
    return await get_user_from_token(token)


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Require admin or office_assistant role for admin panel access"""
    user = await get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user
