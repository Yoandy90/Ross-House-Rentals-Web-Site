"""
Two-Factor Authentication (2FA) via SMS - Routes
Provides optional SMS-based 2FA for user accounts.
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import random
import os
import logging

logger = logging.getLogger(__name__)

two_factor_router = APIRouter()
_db = None
_get_current_user = None  # Will be injected from auth_routes

# ============================================================
# Models
# ============================================================

class TwoFactorSetupRequest(BaseModel):
    phone: str  # Phone number to receive codes

class TwoFactorVerifyCodeRequest(BaseModel):
    code: str
    temp_token: Optional[str] = None  # For login flow
    remember_device: bool = False  # Trust this device for 30 days
    device_name: Optional[str] = None  # e.g. "iPhone de Yoandy", "Chrome Windows"

class TwoFactorDisableRequest(BaseModel):
    password: str  # Require password to disable 2FA

class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    phone_last_4: Optional[str] = None

# ============================================================
# Config
# ============================================================
CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5
TRUSTED_DEVICE_DAYS = 30

def init_two_factor_router(db, get_current_user_func=None):
    global _db, _get_current_user
    _db = db
    _get_current_user = get_current_user_func

# ============================================================
# Helpers
# ============================================================

def _generate_code() -> str:
    """Generate a random 6-digit code"""
    return ''.join([str(random.randint(0, 9)) for _ in range(CODE_LENGTH)])

def _mask_phone(phone: str) -> str:
    """Show only last 4 digits: ****4974"""
    if len(phone) >= 4:
        return '•' * (len(phone) - 4) + phone[-4:]
    return phone

async def _get_current_user_from_token(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail='Token requerido')
    
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    
    from jose import jwt, JWTError
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail='Token inválido')
    except JWTError:
        raise HTTPException(status_code=401, detail='Token inválido')
    
    # Try both ObjectId and UUID/string formats
    try:
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=401, detail='Usuario no encontrado')
    
    return user

async def _send_sms_code(phone: str, code: str) -> bool:
    """Send 2FA code via Twilio SMS"""
    try:
        from twilio.rest import Client as TwilioClient
        
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        from_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        if not all([account_sid, auth_token, from_number]):
            logger.error("Twilio credentials not configured")
            return False
        
        client = TwilioClient(account_sid, auth_token)
        
        message = client.messages.create(
            body=f"Ross Tax - Tu código de verificación es: {code}. Expira en {CODE_EXPIRY_MINUTES} minutos. No compartas este código.",
            from_=from_number,
            to=phone
        )
        
        logger.info(f"2FA SMS sent to {_mask_phone(phone)}, SID: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to send 2FA SMS: {e}")
        return False

def _format_phone(phone: str) -> str:
    """Clean and format phone number for Twilio"""
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 10:
        digits = '1' + digits
    if not digits.startswith('+'):
        digits = '+' + digits
    return digits

# ============================================================
# Endpoints
# ============================================================

@two_factor_router.get('/auth/2fa/status')
async def get_2fa_status(user: dict = Depends(_get_current_user_from_token)):
    """Check if 2FA is enabled for current user"""
    enabled = user.get('two_factor_enabled', False)
    phone = user.get('two_factor_phone', '')
    
    return TwoFactorStatusResponse(
        enabled=enabled,
        phone_last_4=phone[-4:] if phone and len(phone) >= 4 else None
    )

@two_factor_router.post('/auth/2fa/setup')
async def setup_2fa(request: TwoFactorSetupRequest, user: dict = Depends(_get_current_user_from_token)):
    """Start 2FA setup - sends verification code to provided phone"""
    phone = _format_phone(request.phone)
    
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail='Número de teléfono inválido')
    
    # Generate and store code
    code = _generate_code()
    
    await _db.two_factor_codes.delete_many({'user_id': str(user['_id']), 'purpose': 'setup'})
    await _db.two_factor_codes.insert_one({
        'user_id': str(user['_id']),
        'phone': phone,
        'code': code,
        'purpose': 'setup',
        'attempts': 0,
        'created_at': datetime.now(timezone.utc),
        'expires_at': datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES),
    })
    
    # Send SMS
    sent = await _send_sms_code(phone, code)
    if not sent:
        raise HTTPException(status_code=500, detail='Error al enviar SMS. Verifica el número.')
    
    return {
        'success': True,
        'message': f'Código enviado a {_mask_phone(phone)}',
        'phone_masked': _mask_phone(phone),
        'expires_in': CODE_EXPIRY_MINUTES * 60,
    }

@two_factor_router.post('/auth/2fa/verify-setup')
async def verify_2fa_setup(request: TwoFactorVerifyCodeRequest, user: dict = Depends(_get_current_user_from_token)):
    """Verify setup code and enable 2FA"""
    record = await _db.two_factor_codes.find_one({
        'user_id': str(user['_id']),
        'purpose': 'setup',
        'expires_at': {'$gt': datetime.now(timezone.utc)},
    })
    
    if not record:
        raise HTTPException(status_code=400, detail='No hay código pendiente o ha expirado. Solicita uno nuevo.')
    
    if record.get('attempts', 0) >= MAX_VERIFY_ATTEMPTS:
        await _db.two_factor_codes.delete_one({'_id': record['_id']})
        raise HTTPException(status_code=429, detail='Demasiados intentos. Solicita un nuevo código.')
    
    if record['code'] != request.code.strip():
        await _db.two_factor_codes.update_one(
            {'_id': record['_id']},
            {'$inc': {'attempts': 1}}
        )
        remaining = MAX_VERIFY_ATTEMPTS - record.get('attempts', 0) - 1
        raise HTTPException(status_code=400, detail=f'Código incorrecto. {remaining} intentos restantes.')
    
    # Enable 2FA on user
    await _db.users.update_one(
        {'_id': user['_id']},
        {'$set': {
            'two_factor_enabled': True,
            'two_factor_phone': record['phone'],
            'two_factor_enabled_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Clean up
    await _db.two_factor_codes.delete_many({'user_id': str(user['_id']), 'purpose': 'setup'})
    
    logger.info(f"2FA enabled for user {user.get('email', user['_id'])}")
    
    return {
        'success': True,
        'message': 'Autenticación de dos factores activada correctamente',
        'phone_masked': _mask_phone(record['phone']),
    }

@two_factor_router.post('/auth/2fa/disable')
async def disable_2fa(request: TwoFactorDisableRequest, user: dict = Depends(_get_current_user_from_token)):
    """Disable 2FA - requires password confirmation"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    if not user.get('password_hash'):
        raise HTTPException(status_code=400, detail='No se puede verificar la contraseña')
    
    if not pwd_context.verify(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Contraseña incorrecta')
    
    await _db.users.update_one(
        {'_id': user['_id']},
        {'$set': {
            'two_factor_enabled': False,
            'two_factor_phone': None,
            'two_factor_disabled_at': datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Clean up any pending codes
    await _db.two_factor_codes.delete_many({'user_id': str(user['_id'])})
    
    logger.info(f"2FA disabled for user {user.get('email', user['_id'])}")
    
    return {
        'success': True,
        'message': 'Autenticación de dos factores desactivada',
    }

@two_factor_router.post('/auth/2fa/send-code')
async def send_login_2fa_code(request: Request):
    """Send 2FA code during login flow (called with temp_token)"""
    body = await request.json()
    temp_token = body.get('temp_token')
    
    if not temp_token:
        raise HTTPException(status_code=400, detail='Token temporal requerido')
    
    # Find the pending 2FA login
    pending = await _db.two_factor_pending.find_one({
        'temp_token': temp_token,
        'expires_at': {'$gt': datetime.now(timezone.utc)},
    })
    
    if not pending:
        raise HTTPException(status_code=400, detail='Sesión expirada. Inicia sesión de nuevo.')
    
    try:
        user = await _db.users.find_one({'_id': ObjectId(pending['user_id'])})
    except Exception:
        user = await _db.users.find_one({'_id': pending['user_id']})
    if not user or not user.get('two_factor_phone'):
        raise HTTPException(status_code=400, detail='2FA no configurado')
    
    # Generate and store code
    code = _generate_code()
    
    await _db.two_factor_codes.delete_many({'user_id': pending['user_id'], 'purpose': 'login'})
    await _db.two_factor_codes.insert_one({
        'user_id': pending['user_id'],
        'phone': user['two_factor_phone'],
        'code': code,
        'purpose': 'login',
        'attempts': 0,
        'created_at': datetime.now(timezone.utc),
        'expires_at': datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES),
    })
    
    sent = await _send_sms_code(user['two_factor_phone'], code)
    if not sent:
        raise HTTPException(status_code=500, detail='Error al enviar SMS')
    
    return {
        'success': True,
        'message': f'Código enviado a {_mask_phone(user["two_factor_phone"])}',
        'phone_masked': _mask_phone(user['two_factor_phone']),
        'expires_in': CODE_EXPIRY_MINUTES * 60,
    }

@two_factor_router.post('/auth/2fa/verify-login')
async def verify_login_2fa(request: TwoFactorVerifyCodeRequest, req: Request = None):
    """Verify 2FA code during login and return session token"""
    if not request.temp_token:
        raise HTTPException(status_code=400, detail='Token temporal requerido')
    
    # Find pending login
    pending = await _db.two_factor_pending.find_one({
        'temp_token': request.temp_token,
        'expires_at': {'$gt': datetime.now(timezone.utc)},
    })
    
    if not pending:
        raise HTTPException(status_code=400, detail='Sesión expirada. Inicia sesión de nuevo.')
    
    # Find the code
    code_record = await _db.two_factor_codes.find_one({
        'user_id': pending['user_id'],
        'purpose': 'login',
        'expires_at': {'$gt': datetime.now(timezone.utc)},
    })
    
    if not code_record:
        raise HTTPException(status_code=400, detail='Código expirado. Solicita uno nuevo.')
    
    if code_record.get('attempts', 0) >= MAX_VERIFY_ATTEMPTS:
        await _db.two_factor_codes.delete_one({'_id': code_record['_id']})
        await _db.two_factor_pending.delete_one({'_id': pending['_id']})
        raise HTTPException(status_code=429, detail='Demasiados intentos. Inicia sesión de nuevo.')
    
    if code_record['code'] != request.code.strip():
        await _db.two_factor_codes.update_one(
            {'_id': code_record['_id']},
            {'$inc': {'attempts': 1}}
        )
        remaining = MAX_VERIFY_ATTEMPTS - code_record.get('attempts', 0) - 1
        raise HTTPException(status_code=400, detail=f'Código incorrecto. {remaining} intentos restantes.')
    
    # Success! Create real session
    try:
        user = await _db.users.find_one({'_id': ObjectId(pending['user_id'])})
    except Exception:
        user = await _db.users.find_one({'_id': pending['user_id']})
    if not user:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    from jose import jwt as jose_jwt
    import secrets
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
    ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv('ACCESS_TOKEN_EXPIRE_DAYS', '30'))
    
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    session_token = jose_jwt.encode({'sub': str(user['_id']), 'exp': expire}, JWT_SECRET_KEY, algorithm='HS256')
    
    # Save session
    await _db.user_sessions.insert_one({
        'user_id': str(user['_id']),
        'session_token': session_token,
        'expires_at': expire,
    })
    
    # Update user
    await _db.users.update_one(
        {'_id': user['_id']},
        {'$set': {
            'has_app': True,
            'last_app_access': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Handle "Remember this device" / Trusted Device
    device_token = None
    if request.remember_device:
        device_token = secrets.token_urlsafe(48)
        device_name = request.device_name or 'Dispositivo desconocido'
        
        # Get user-agent for device info
        user_agent = ''
        if req:
            user_agent = req.headers.get('user-agent', '')
        
        await _db.trusted_devices.insert_one({
            'user_id': str(user['_id']),
            'device_token': device_token,
            'device_name': device_name,
            'user_agent': user_agent,
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_DAYS),
            'last_used': datetime.now(timezone.utc),
        })
        
        logger.info(f"Trusted device registered for {user.get('email', user['_id'])}: {device_name}")
    
    # Clean up
    await _db.two_factor_codes.delete_many({'user_id': pending['user_id'], 'purpose': 'login'})
    await _db.two_factor_pending.delete_one({'_id': pending['_id']})
    
    # Build user response
    user_response = dict(user)
    user_response['id'] = str(user_response.pop('_id'))
    user_response.pop('password_hash', None)
    user_response.pop('profile_picture', None)
    user_response['has_app'] = True
    user_response['last_app_access'] = datetime.now(timezone.utc).isoformat()
    
    logger.info(f"2FA login successful for {user.get('email', user['_id'])}")
    
    response = {
        'success': True,
        'session_token': session_token,
        'user': user_response,
    }
    
    if device_token:
        response['device_token'] = device_token
        response['device_trusted_until'] = (datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_DAYS)).isoformat()
    
    return response


# ============================================================
# Trusted Devices Management
# ============================================================

@two_factor_router.get('/auth/2fa/trusted-devices')
async def list_trusted_devices(user: dict = Depends(_get_current_user_from_token)):
    """List all trusted devices for current user"""
    devices = await _db.trusted_devices.find({
        'user_id': str(user['_id']),
        'expires_at': {'$gt': datetime.now(timezone.utc)},
    }).to_list(50)
    
    result = []
    for d in devices:
        result.append({
            'id': str(d['_id']),
            'device_name': d.get('device_name', 'Dispositivo desconocido'),
            'created_at': d.get('created_at', '').isoformat() if hasattr(d.get('created_at', ''), 'isoformat') else str(d.get('created_at', '')),
            'expires_at': d.get('expires_at', '').isoformat() if hasattr(d.get('expires_at', ''), 'isoformat') else str(d.get('expires_at', '')),
            'last_used': d.get('last_used', '').isoformat() if hasattr(d.get('last_used', ''), 'isoformat') else str(d.get('last_used', '')),
        })
    
    return {'success': True, 'devices': result}

@two_factor_router.delete('/auth/2fa/trusted-devices/{device_id}')
async def revoke_trusted_device(device_id: str, user: dict = Depends(_get_current_user_from_token)):
    """Revoke a trusted device"""
    try:
        result = await _db.trusted_devices.delete_one({
            '_id': ObjectId(device_id),
            'user_id': str(user['_id']),
        })
    except Exception:
        raise HTTPException(status_code=400, detail='ID de dispositivo inválido')
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Dispositivo no encontrado')
    
    return {'success': True, 'message': 'Dispositivo eliminado'}

@two_factor_router.delete('/auth/2fa/trusted-devices')
async def revoke_all_trusted_devices(user: dict = Depends(_get_current_user_from_token)):
    """Revoke ALL trusted devices for current user"""
    result = await _db.trusted_devices.delete_many({'user_id': str(user['_id'])})
    
    return {
        'success': True,
        'message': f'{result.deleted_count} dispositivo(s) eliminado(s)',
        'count': result.deleted_count,
    }
