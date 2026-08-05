"""
Auth Routes Router
Extracted from server.py for modularization.
Handles authentication (register, login, logout, Apple Sign In, Google OAuth),
password reset, user profile management, and account deletion.
"""
import os
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from jose import JWTError, jwt
from passlib.context import CryptContext
import requests as http_requests
from collections import defaultdict
import time
import random
import os

logger = logging.getLogger(__name__)

auth_router = APIRouter()
_db = None

# ================== CONFIG ==================
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 7
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


# ================== MODELS ==================

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias='_id')
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    picture: Optional[str] = None
    role: str = 'client'
    phone: Optional[str] = None
    address: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""  # Legacy — will be auto-generated from first_name + last_name
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    recaptcha_token: Optional[str] = None

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

class LoginResponse(BaseModel):
    session_token: str
    user: dict

class AppleAuthRequest(BaseModel):
    identityToken: str
    authorizationCode: str
    fullName: Optional[dict] = None
    email: Optional[str] = None
    user: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Any] = None
    profile_picture: Optional[str] = None

class UpdateProfilePictureRequest(BaseModel):
    profile_picture: str


def init_auth_router(db):
    global _db
    _db = db


# ================== Auth Helpers ==================

def _hash_password(password: str) -> str:
    return pwd_context.hash(password)

def _verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def _create_session_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {'sub': user_id, 'exp': expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
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
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except Exception as e:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user


# ================== AUTH ROUTES ==================
# ================== AUTH ROUTES ==================

@auth_router.post('/auth/register', response_model=LoginResponse)
async def register(request: RegisterRequest):
    # Verify reCAPTCHA token if provided
    if request.recaptcha_token:
        import httpx
        recaptcha_secret = os.getenv('RECAPTCHA_SECRET_KEY', '6LdXSH0sAAAAAMexcTA21oi_UQycsJnpOqrqdfNU')
        async with httpx.AsyncClient() as client:
            recaptcha_response = await client.post(
                'https://www.google.com/recaptcha/api/siteverify',
                data={
                    'secret': recaptcha_secret,
                    'response': request.recaptcha_token
                }
            )
            result = recaptcha_response.json()
            if not result.get('success'):
                logging.warning(f"⚠️ reCAPTCHA verification failed for registration: {result}")
                raise HTTPException(status_code=400, detail="Verificación de seguridad fallida. Por favor, intenta de nuevo.")
            
            # Check score for v3 (score > 0.5 is usually human)
            score = result.get('score', 1.0)
            if score < 0.3:
                logging.warning(f"⚠️ Low reCAPTCHA score for registration: {score} - possible bot")
                raise HTTPException(status_code=400, detail="Verificación de seguridad fallida. Por favor, intenta de nuevo.")
            
            logging.info(f"✅ reCAPTCHA verified for registration with score: {score}")
    
    # Check if user exists by email
    existing = await _db.users.find_one({'email': request.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered / Email ya registrado')

    # ═══ ANTI-FRAUD: Unique phone check ═══
    if request.phone:
        clean_phone = request.phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '').replace('+', '')
        if len(clean_phone) == 11 and clean_phone.startswith('1'):
            clean_phone = clean_phone[1:]  # Remove country code
        existing_phone = await _db.users.find_one({
            '$or': [
                {'phone': clean_phone},
                {'phone': request.phone},
                {'phone': {'$regex': clean_phone[-10:] + '$'}}
            ]
        })
        if existing_phone:
            raise HTTPException(status_code=400, detail='Teléfono ya registrado con otra cuenta / Phone already registered')

    # Build first_name / last_name from either new fields or legacy "name"
    first_name = (request.first_name or "").strip()
    last_name = (request.last_name or "").strip()
    if not first_name and request.name:
        parts = request.name.strip().split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
    full_name = f"{first_name} {last_name}".strip() or request.name.strip()

    # Create user with address
    user = User(
        email=request.email,
        name=full_name,
        phone=request.phone,
        address=request.address,
        password_hash=_hash_password(request.password)
    )
    
    user_dict = user.dict(by_alias=True)
    # Store first_name and last_name separately for anti-fraud locked fields
    user_dict['first_name'] = first_name
    user_dict['last_name'] = last_name
    await _db.users.insert_one(user_dict)
    
    # Send Welcome SMS and Email
    try:
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if config_doc and request.phone:
            from notification_service import NotificationService
            notif_service = NotificationService(config_doc)
            
            # Welcome SMS with app download link
            if notif_service.twilio_client:
                welcome_sms = f"""¡Bienvenido a Ross Tax, {request.name}! 🎉

Tu cuenta está lista:
📧 Usuario: {request.email}
🔑 Usa la clave que creaste

📱 Descarga nuestra app:
iOS: https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX
Android: Próximamente

Ross Tax: 806-934-2018"""
                
                try:
                    message = notif_service.twilio_client.messages.create(
                        body=welcome_sms,
                        from_=notif_service.twilio_phone_number,
                        to=request.phone
                    )
                    logging.info(f"✅ Welcome SMS sent to {request.phone}")
                except Exception as e:
                    logging.error(f"❌ Error sending welcome SMS: {e}")
            
            # Welcome Email
            if notif_service.sendgrid_client:
                try:
                    welcome_html = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0;">¡Bienvenido a Ross Tax! 🎉</h1>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #333;">Hola {request.name},</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                Tu cuenta ha sido creada exitosamente. Ahora tienes acceso a todos nuestros servicios:
                            </p>
                            
                            <div style="background-color: #fff; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                <h3 style="color: #6C1110; margin-top: 0;">Tus credenciales:</h3>
                                <p style="margin: 5px 0;"><strong>📧 Email:</strong> {request.email}</p>
                                <p style="margin: 5px 0;"><strong>🔑 Contraseña:</strong> La que elegiste al registrarte</p>
                            </div>
                            
                            <h3 style="color: #333;">¿Qué puedes hacer ahora?</h3>
                            <ul style="color: #555; line-height: 1.8;">
                                <li>📅 Agendar citas con nuestros expertos</li>
                                <li>📄 Subir documentos de forma segura</li>
                                <li>💰 Gestionar tus pagos y facturas</li>
                                <li>🎁 Participar en promociones exclusivas</li>
                                <li>📊 Ver el estado de tus declaraciones</li>
                            </ul>
                            
                            <div style="background-color: #E8F5E9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                                <h3 style="color: #2E7D32; margin-top: 0;">📱 Descarga nuestra App</h3>
                                <p style="color: #555;">Usa las mismas credenciales para acceder desde tu celular</p>
                                <a href="https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX" style="display: inline-block; background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 10px 5px;">
                                    📱 App Store (iPhone)
                                </a>
                            </div>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            
                            <p style="color: #888; font-size: 14px; text-align: center;">
                                ¿Preguntas? Llámanos al <strong>(806) 934-2018</strong><br>
                                Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029
                            </p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    await notif_service.send_email(
                        to_email=request.email,
                        subject="¡Bienvenido a Ross Tax Preparation! 🎉",
                        html_content=welcome_html
                    )
                    logging.info(f"✅ Welcome email sent to {request.email}")
                except Exception as e:
                    logging.error(f"❌ Error sending welcome email: {e}")
                    
    except Exception as e:
        logging.error(f"❌ Error in welcome notification process: {e}")
        # Don't fail registration if notifications fail
    
    # ═══ Send branded welcome email via template system (Ross Lending) ═══
    try:
        from email_sender import send_welcome
        import asyncio
        asyncio.create_task(send_welcome(
            client_email=request.email,
            client_name=request.name
        ))
    except Exception as e:
        logging.error(f"⚠️ Template welcome email failed (non-critical): {e}")

    # Auto-sync to Rise CRM (non-blocking)
    try:
        from rise_crm_sync_service import rise_sync_service
        if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
            import asyncio
            asyncio.create_task(rise_sync_service.sync_user_to_rise(user_dict['_id']))
            print(f"🔄 Auto-sync triggered for new user: {user_dict['_id']}")
    except Exception as e:
        print(f"⚠️ Auto-sync failed (non-critical): {str(e)}")
    
    # Create session
    session_token = _create_session_token(user_dict['_id'])
    session = UserSession(
        user_id=user_dict['_id'],
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    await _db.user_sessions.insert_one(session.dict())
    
    user_response = user_dict.copy()
    user_response['id'] = user_response.pop('_id')
    user_response.pop('password_hash', None)
    
    return LoginResponse(
        session_token=session_token,
        user=user_response
    )

# ============================================================
# Rate Limiting for Login - Prevents brute force attacks
# ============================================================
_login_attempts: dict = defaultdict(list)  # IP -> [timestamps]
_LOGIN_MAX_ATTEMPTS = 5  # Max attempts per window
_LOGIN_WINDOW_SECONDS = 300  # 5 minutes

def _check_login_rate_limit(request: Request):
    """Block IP after too many failed login attempts"""
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    # Clean old attempts
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _LOGIN_WINDOW_SECONDS]
    if len(_login_attempts[ip]) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos de inicio de sesión. Intente de nuevo en 5 minutos."
        )

def _record_failed_login(request: Request):
    """Record a failed login attempt"""
    ip = request.client.host if request.client else "unknown"
    _login_attempts[ip].append(time.time())

def _clear_login_attempts(request: Request):
    """Clear failed attempts on successful login"""
    ip = request.client.host if request.client else "unknown"
    _login_attempts.pop(ip, None)

@auth_router.post('/auth/login', response_model=LoginResponse)
async def login(request: LoginRequest, req: Request):
    # Rate limit check
    _check_login_rate_limit(req)
    
    # Validar que se proporcione email o teléfono
    if not request.email and not request.phone:
        raise HTTPException(status_code=400, detail='Se requiere email o número de teléfono')
    
    user = None
    identifier = None
    
    if request.email:
        # Clean email (remove any special characters, trim whitespace)
        clean_email = request.email.strip().replace('`', '').replace('\u2018', '').replace('\u2019', '')
        identifier = clean_email
        logger.info(f"LOGIN ATTEMPT - Email: {clean_email}")
        
        # Find user by email
        user = await _db.users.find_one({'email': clean_email})
    
    elif request.phone:
        # Clean phone number (remove spaces, dashes, parentheses)
        clean_phone = ''.join(filter(str.isdigit, request.phone))
        # Ensure it starts with country code
        if len(clean_phone) == 10:
            clean_phone = '1' + clean_phone  # Add US country code
        identifier = clean_phone
        logger.info(f"LOGIN ATTEMPT - Phone: {clean_phone}")
        
        # Find user by phone (try multiple formats)
        user = await _db.users.find_one({
            '$or': [
                {'phone': clean_phone},
                {'phone': '+' + clean_phone},
                {'phone': '+1' + clean_phone[-10:]},
                {'phone': clean_phone[-10:]}
            ]
        })
    
    if not user or not user.get('password_hash'):
        logger.info(f"Login failed: user not found for {identifier}")
        _record_failed_login(req)
        raise HTTPException(status_code=401, detail='Credenciales inválidas')
    
    # Verify password
    password_ok = _verify_password(request.password, user['password_hash'])
    
    if not password_ok:
        logger.info(f"Login failed: wrong password for {identifier}")
        _record_failed_login(req)
        raise HTTPException(status_code=401, detail='Credenciales inválidas')
    
    # Check if user has 2FA enabled
    if user.get('two_factor_enabled'):
        import secrets
        
        # Check for trusted device token in request body
        device_token = getattr(request, 'device_token', None)
        if not device_token and hasattr(request, '__dict__'):
            device_token = None
        
        # Try to get device_token from request headers or body
        try:
            # Check X-Device-Token header
            device_token_header = req.headers.get('x-device-token', '') if req else ''
            if device_token_header:
                # Verify trusted device
                trusted = await _db.trusted_devices.find_one({
                    'user_id': str(user['_id']),
                    'device_token': device_token_header,
                    'expires_at': {'$gt': datetime.now(timezone.utc)},
                })
                if trusted:
                    # Device is trusted - skip 2FA, update last_used
                    await _db.trusted_devices.update_one(
                        {'_id': trusted['_id']},
                        {'$set': {'last_used': datetime.now(timezone.utc)}}
                    )
                    logger.info(f"Trusted device login for {identifier} - skipping 2FA")
                    # Fall through to normal token generation below
                    pass
                else:
                    # Device token invalid/expired - require 2FA
                    device_token_header = ''
            
            if not device_token_header:
                # No valid trusted device - require 2FA
                
                # ── Rate limit: max 1 SMS per 60 seconds ──
                recent_code = await _db.two_factor_codes.find_one({
                    'user_id': str(user['_id']),
                    'purpose': 'login',
                    'created_at': {'$gt': datetime.now(timezone.utc) - timedelta(seconds=60)},
                })
                if recent_code:
                    # Already sent a code recently - reuse the pending token
                    existing_pending = await _db.two_factor_pending.find_one({'user_id': str(user['_id'])})
                    phone = user.get('two_factor_phone', '')
                    phone_masked = '•' * (len(phone) - 4) + phone[-4:] if len(phone) >= 4 else phone
                    _clear_login_attempts(req)
                    raise HTTPException(
                        status_code=202,
                        detail={
                            'requires_2fa': True,
                            'temp_token': existing_pending['temp_token'] if existing_pending else '',
                            'phone_masked': phone_masked,
                            'message': f'Código ya enviado a {phone_masked}. Espera 60 segundos para reenviar.',
                        }
                    )
                
                temp_token = secrets.token_urlsafe(32)
                
                await _db.two_factor_pending.delete_many({'user_id': str(user['_id'])})
                await _db.two_factor_pending.insert_one({
                    'user_id': str(user['_id']),
                    'temp_token': temp_token,
                    'created_at': datetime.now(timezone.utc),
                    'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10),
                })
                
                # Send 2FA code automatically
                phone = user.get('two_factor_phone', '')
                if phone:
                    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
                    await _db.two_factor_codes.delete_many({'user_id': str(user['_id']), 'purpose': 'login'})
                    await _db.two_factor_codes.insert_one({
                        'user_id': str(user['_id']),
                        'phone': phone,
                        'code': code,
                        'purpose': 'login',
                        'attempts': 0,
                        'created_at': datetime.now(timezone.utc),
                        'expires_at': datetime.now(timezone.utc) + timedelta(minutes=5),
                    })
                    
                    try:
                        from twilio.rest import Client as TwilioClient
                        twilio_client = TwilioClient(os.getenv('TWILIO_ACCOUNT_SID'), os.getenv('TWILIO_AUTH_TOKEN'))
                        twilio_client.messages.create(
                            body=f"Ross Tax - Tu código de verificación es: {code}. Expira en 5 minutos.",
                            from_=os.getenv('TWILIO_PHONE_NUMBER'),
                            to=phone
                        )
                    except Exception as e:
                        logger.error(f"Failed to send 2FA SMS: {e}")
                
                phone_masked = '•' * (len(phone) - 4) + phone[-4:] if len(phone) >= 4 else phone
                _clear_login_attempts(req)
                raise HTTPException(
                    status_code=202,
                    detail={
                        'requires_2fa': True,
                        'temp_token': temp_token,
                        'phone_masked': phone_masked,
                        'message': f'Código enviado a {phone_masked}',
                    }
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"2FA check error: {e}")
    
    # Update user: mark as having the app and update last access
    _clear_login_attempts(req)
    
    await _db.users.update_one(
        {'_id': user['_id']},
        {
            '$set': {
                'has_app': True,
                'last_app_access': datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create session
    session_token = _create_session_token(str(user['_id']))
    session = UserSession(
        user_id=str(user['_id']),
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    await _db.user_sessions.insert_one(session.dict())
    
    user_response = dict(user)
    user_response['id'] = str(user_response.pop('_id'))
    user_response.pop('password_hash', None)
    # Exclude large profile_picture from login response for faster mobile loading
    # Profile picture can be loaded separately via /auth/me
    user_response.pop('profile_picture', None)
    user_response['has_app'] = True
    user_response['last_app_access'] = datetime.now(timezone.utc).isoformat()
    
    print(f"Login successful for {identifier}, role: {user_response.get('role')}")
    
    return LoginResponse(
        session_token=session_token,
        user=user_response
    )

@auth_router.get('/auth/me')
async def get_me(current_user: dict = Depends(_get_current_user)):
    user_response = current_user.copy()
    user_response.pop('password_hash', None)
    # Ensure identity_verified has a default value
    if 'identity_verified' not in user_response:
        user_response['identity_verified'] = False
    return user_response

@auth_router.post('/auth/logout')
async def logout(current_user: dict = Depends(_get_current_user), authorization: str = Header(None)):
    token = authorization.replace('Bearer ', '') if authorization.startswith('Bearer ') else authorization
    await _db.user_sessions.delete_one({'session_token': token})
    return {'message': 'Logged out successfully'}


# ═══════════════════════════════════════════════════════════════════
# PUSH TOKEN REGISTRATION — Save Expo Push Token for Notifications
# ═══════════════════════════════════════════════════════════════════

class RegisterPushTokenRequest(BaseModel):
    push_token: str
    platform: str = "ios"
    device_name: str = ""

@auth_router.post('/notifications/register-push-token')
async def register_push_token(
    body: RegisterPushTokenRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Save the user's Expo push token for push notifications."""
    if not body.push_token:
        raise HTTPException(status_code=400, detail="push_token is required")

    user_id = current_user.get('_id') or current_user.get('id')
    update_data = {
        'push_token': body.push_token,
        'push_platform': body.platform,
        'push_device_name': body.device_name,
        'push_token_updated_at': datetime.now(timezone.utc).isoformat(),
    }

    # Update user document with push token
    from bson import ObjectId
    try:
        await _db.users.update_one({'_id': ObjectId(user_id)}, {'$set': update_data})
    except:
        await _db.users.update_one({'_id': user_id}, {'$set': update_data})

    logging.info(f"📱 Push token registered for {current_user.get('email')} ({body.platform} / {body.device_name})")
    return {"success": True, "message": "Push token registered"}


@auth_router.get('/auth/validate-reset-token')
async def validate_reset_token(token: str = Query(...)):
    """Validate a password reset token"""
    try:
        # Find the token
        token_doc = await _db.password_reset_tokens.find_one({'token': token})
        
        if not token_doc:
            return {'valid': False, 'detail': 'Token no encontrado'}
        
        # Check if expired
        expires_at = token_doc.get('expires_at')
        if expires_at:
            # Ensure both datetimes are timezone-aware
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if expires_at < now:
                return {'valid': False, 'detail': 'El enlace ha expirado'}
        
        # Get user name
        user_id = token_doc.get('user_id')
        user = None
        if user_id:
            user = await _db.users.find_one({'_id': user_id})
            if not user and len(str(user_id)) == 24:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not user:
                user = await _db.users.find_one({'id': user_id})
        
        user_name = ''
        user_email = ''
        if user:
            user_name = user.get('name') or user.get('full_name', '')
            if user_name:
                user_name = user_name.split()[0]  # First name only
            user_email = user.get('email', '')
        
        return {
            'valid': True,
            'user_name': user_name,
            'user_email': user_email
        }
    except Exception as e:
        logging.error(f'Error validating reset token: {e}')
        return {'valid': False, 'detail': 'Error al validar el token'}


@auth_router.post('/auth/reset-password-token')
async def reset_password_with_token(data: dict):
    """Reset password using a token"""
    try:
        token = data.get('token')
        new_password = data.get('new_password')
        new_email = data.get('new_email')  # Optional: for users without email
        
        if not token or not new_password:
            raise HTTPException(status_code=400, detail='Token y contraseña son requeridos')
        
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail='La contraseña debe tener al menos 6 caracteres')
        
        # Validate new email if provided
        if new_email:
            import re
            email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
            if not re.match(email_pattern, new_email):
                raise HTTPException(status_code=400, detail='Email no válido')
            
            # Check if email already exists for another user
            existing = await _db.users.find_one({'email': new_email.lower().strip()})
            if existing:
                # Get current token to check if it's the same user
                token_doc_check = await _db.password_reset_tokens.find_one({'token': token})
                if token_doc_check and str(existing.get('_id')) != str(token_doc_check.get('user_id')):
                    raise HTTPException(status_code=400, detail='Este email ya está en uso por otro usuario')
        
        # Find and validate token
        token_doc = await _db.password_reset_tokens.find_one({'token': token})
        
        if not token_doc:
            raise HTTPException(status_code=400, detail='Token no válido')
        
        expires_at = token_doc.get('expires_at')
        if expires_at:
            # Ensure both datetimes are timezone-aware
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if expires_at < now:
                raise HTTPException(status_code=400, detail='El enlace ha expirado')
        
        user_id = token_doc.get('user_id')
        
        # Find user
        user = None
        actual_id = None
        
        if user_id:
            user = await _db.users.find_one({'_id': user_id})
            if user:
                actual_id = user_id
            
            if not user and len(str(user_id)) == 24:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    if user:
                        actual_id = ObjectId(user_id)
                except:
                    pass
            
            if not user:
                user = await _db.users.find_one({'id': user_id})
                if user:
                    actual_id = user.get('_id')
        
        if not user:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')
        
        # Hash new password
        password_hash = _hash_password(new_password)
        
        # Update user password and set role to client if not set
        update_data = {
            'password_hash': password_hash,
            'updated_at': datetime.now(timezone.utc),
            'password_updated_at': datetime.now(timezone.utc)
        }
        
        # If new email provided, update it
        if new_email:
            update_data['email'] = new_email.lower().strip()
            logging.info(f'Updating email for user {actual_id} from {user.get("email")} to {new_email}')
        
        # If user has no role, set as client
        if not user.get('role'):
            update_data['role'] = 'client'
        
        await _db.users.update_one(
            {'_id': actual_id},
            {'$set': update_data}
        )
        
        # Delete the used token
        await _db.password_reset_tokens.delete_one({'token': token})
        
        # Log the password reset
        logging.info(f'Password reset successful for user {user.get("email")}')
        
        return {'message': 'Contraseña actualizada correctamente'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error resetting password: {e}')
        raise HTTPException(status_code=500, detail='Error al cambiar la contraseña')


@auth_router.delete('/auth/delete-account')
async def delete_account(current_user: dict = Depends(_get_current_user), authorization: str = Header(None)):
    """
    Delete user account and all associated data.
    Required by Apple App Store guidelines 5.1.1(v).
    Handles both Ross Tax and Mi Caso USA accounts.
    """
    try:
        user_id = current_user['id']
        
        # Delete all user data from various collections
        collections_to_clean = [
            'user_sessions',
            'documents', 
            'appointments',
            'tax_returns',
            'chat_messages',
            'notifications',
            'push_tokens',
            'invoices',
            'kyc_submissions',
            'service_orders',
            'receipts',
            'referrals',
            'user_credits',
            'credit_transactions',
            'subscriptions',
            'immigration_cases',
            'immigration_saved_cases',
            # Ross Lending collections
            'payment_methods',
            'loan_applications',
            'regulated_loans',
            'autopay_settings',
        ]
        
        deleted_counts = {}
        for collection_name in collections_to_clean:
            try:
                result = await _db[collection_name].delete_many({'user_id': user_id})
                deleted_counts[collection_name] = result.deleted_count
            except Exception as e:
                logging.warning(f"Could not clean {collection_name}: {e}")
        
        # Delete the user account from both collections
        await _db.users.delete_one({'_id': user_id})
        await _db.immigration_users.delete_one({'_id': user_id})
        
        # Log the deletion for compliance
        await _db.account_deletions.insert_one({
            'user_id': str(user_id),
            'email': current_user.get('email', 'unknown'),
            'deleted_at': datetime.utcnow(),
            'data_cleaned': deleted_counts
        })
        
        logging.info(f"Account deleted for user {user_id}: {deleted_counts}")
        
        return {
            'message': 'Account deleted successfully',
            'data_removed': deleted_counts
        }
        
    except Exception as e:
        logging.error(f"Error deleting account: {e}")
        raise HTTPException(status_code=500, detail='Error deleting account. Please contact support.')

# ================== APPLE SIGN IN ==================

class AppleAuthRequest(BaseModel):
    identityToken: str
    authorizationCode: str
    fullName: Optional[dict] = None
    email: Optional[str] = None
    user: str  # Apple's user identifier

@auth_router.post('/auth/apple', response_model=LoginResponse)
async def apple_sign_in(auth_data: AppleAuthRequest):
    """
    Handle Sign in with Apple
    Verifies the identity token and creates/logs in the user
    """
    try:
        import jwt
        import httpx
        
        # For production, you should verify the token with Apple's public keys
        # For now, we'll decode without verification and trust the client
        # In production: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
        
        try:
            # Decode the JWT token (without verification for simplicity)
            # In production, fetch Apple's public keys and verify
            decoded = jwt.decode(auth_data.identityToken, options={"verify_signature": False})
            
            apple_user_id = decoded.get('sub') or auth_data.user
            email = decoded.get('email') or auth_data.email
            
        except Exception as decode_error:
            print(f"JWT decode error: {decode_error}")
            apple_user_id = auth_data.user
            email = auth_data.email
        
        # Check if user exists by Apple ID or email
        existing_user = await _db.users.find_one({
            '$or': [
                {'apple_user_id': apple_user_id},
                {'email': email} if email else {'_id': None}
            ]
        })
        
        if existing_user:
            # User exists - log them in
            user_id = str(existing_user['_id'])
            
            # Update Apple user ID if not set
            if not existing_user.get('apple_user_id'):
                await _db.users.update_one(
                    {'_id': existing_user['_id']},
                    {'$set': {'apple_user_id': apple_user_id}}
                )
            
            user = existing_user
            print(f"✅ Apple Sign In: Existing user {email}")
        else:
            # Create new user
            # Extract name from fullName if available
            first_name = ''
            last_name = ''
            if auth_data.fullName:
                first_name = auth_data.fullName.get('givenName', '')
                last_name = auth_data.fullName.get('familyName', '')
            
            full_name = f"{first_name} {last_name}".strip() or 'Apple User'
            
            new_user = {
                'id': str(uuid.uuid4()),
                'email': email or f"{apple_user_id}@privaterelay.appleid.com",
                'name': full_name,
                'apple_user_id': apple_user_id,
                'role': 'user',
                'created_at': datetime.utcnow(),
                'auth_provider': 'apple',
                'email_verified': True,  # Apple verifies emails
                'is_active': True
            }
            
            result = await _db.users.insert_one(new_user)
            new_user['_id'] = result.inserted_id
            user = new_user
            print(f"✅ Apple Sign In: Created new user {email}")
        
        # Create session
        session_token = secrets.token_urlsafe(32)
        session = {
            'session_token': session_token,
            'user_id': str(user['_id']),
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=30),
            'auth_provider': 'apple'
        }
        await _db.user_sessions.insert_one(session)
        
        # Prepare user response
        user_response = {
            'id': str(user['_id']),
            'email': user.get('email', ''),
            'name': user.get('name', ''),
            'role': user.get('role', 'user'),
            'phone': user.get('phone', ''),
            'profile_picture': user.get('profile_picture', '')
        }
        
        return LoginResponse(
            session_token=session_token,
            user=user_response
        )
        
    except Exception as e:
        print(f"❌ Apple Sign In error: {str(e)}")
        raise HTTPException(status_code=400, detail=f'Apple sign in failed: {str(e)}')

# ================== USER PROFILE ROUTES ==================

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Any] = None  # Accept string or dict
    profile_picture: Optional[str] = None  # base64 encoded image
    # Extended profile fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    ssn_encrypted: Optional[str] = None  # Full SSN, stored encrypted
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    employer: Optional[str] = None
    employment_type: Optional[str] = None
    monthly_income: Optional[str] = None


class UpdateProfilePictureRequest(BaseModel):
    profile_picture: str  # base64 encoded image

@auth_router.put('/users/profile-picture')
async def update_profile_picture(
    data: UpdateProfilePictureRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Update current user's profile picture"""
    try:
        if not data.profile_picture:
            raise HTTPException(status_code=400, detail='Profile picture data is required')
        
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': {
                'profile_picture': data.profile_picture,
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"✅ Profile picture updated for user {current_user['email']}")
        return {"success": True, "message": "Profile picture updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Profile picture update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@auth_router.delete('/users/profile-picture')
async def delete_profile_picture(
    current_user: dict = Depends(_get_current_user)
):
    """Delete current user's profile picture"""
    try:
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': {
                'profile_picture': '',
                'updated_at': datetime.utcnow()
            }}
        )
        logger.info(f"✅ Profile picture deleted for user {current_user['email']}")
        return {"success": True, "message": "Profile picture deleted"}
    except Exception as e:
        logger.error(f"❌ Profile picture delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@auth_router.get('/users/profile-picture')
async def get_profile_picture(
    current_user: dict = Depends(_get_current_user)
):
    """Get current user's profile picture"""
    try:
        from bson import ObjectId
        uid = current_user['id']
        user = await _db.users.find_one(
            {'_id': ObjectId(uid) if ObjectId.is_valid(uid) else uid},
            {'profile_picture': 1}
        )
        pic = user.get('profile_picture', '') if user else ''
        return {"success": True, "profile_picture": pic}
    except Exception as e:
        logger.error(f"❌ Get profile picture error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@auth_router.put('/users/me')
async def update_profile(
    profile_data: UpdateProfileRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Update current user's profile"""
    try:
        print(f"📝 Update profile request for user: {current_user['email']}")
        print(f"   Data received: name={profile_data.name}, email={profile_data.email}, phone={profile_data.phone}")
        print(f"   Address: {profile_data.address}")
        print(f"   Profile picture: {'Yes' if profile_data.profile_picture else 'No'}")
        
        update_data = {}
        
        # ═══ ANTI-FRAUD: Name is LOCKED for clients — only admin can change ═══
        # Client cannot change their own name to prevent loan fraud
        if profile_data.name is not None and profile_data.name.strip():
            if current_user.get('role') in ('admin', 'superadmin'):
                update_data['name'] = profile_data.name
            else:
                logging.warning(f"⚠️ ANTI-FRAUD: Client {current_user['email']} attempted to change name to '{profile_data.name}' — BLOCKED")
        
        if profile_data.email is not None and profile_data.email.strip():
            # Check if email is already taken by another user
            existing = await _db.users.find_one({
                'email': profile_data.email,
                '_id': {'$ne': current_user['id']}
            })
            if existing:
                raise HTTPException(status_code=400, detail='Email ya está en uso')
            update_data['email'] = profile_data.email
        
        if profile_data.phone is not None:
            update_data['phone'] = profile_data.phone
        
        if profile_data.address is not None:
            update_data['address'] = profile_data.address
        
        if profile_data.profile_picture is not None:
            print(f"✅ Profile picture will be updated (size: {len(profile_data.profile_picture)} chars)")
            update_data['profile_picture'] = profile_data.profile_picture
        
        # Extended profile fields
        # ═══ ANTI-FRAUD: first_name and last_name are LOCKED for clients ═══
        locked_fields = ['first_name', 'last_name'] if current_user.get('role') not in ('admin', 'superadmin') else []
        for field in ['first_name', 'last_name', 'date_of_birth', 'ssn_encrypted',
                      'address_street', 'address_city', 'address_state', 'address_zip',
                      'employer', 'employment_type', 'monthly_income',
                      'time_at_employer', 'bank_name']:
            if field in locked_fields:
                val = getattr(profile_data, field, None)
                if val is not None:
                    logging.warning(f"⚠️ ANTI-FRAUD: Client {current_user['email']} attempted to change {field} — BLOCKED")
                continue
            val = getattr(profile_data, field, None)
            if val is not None:
                # For SSN, store masked version too for display + uniqueness check
                if field == 'ssn_encrypted' and val:
                    clean_ssn = val.replace('-', '').replace(' ', '')
                    # ═══ ANTI-FRAUD: SSN uniqueness check ═══
                    if len(clean_ssn) >= 9:
                        existing_ssn = await _db.users.find_one({
                            'ssn_encrypted': clean_ssn,
                            '_id': {'$ne': current_user['id']}
                        })
                        if existing_ssn:
                            raise HTTPException(status_code=400, detail='Este número de seguro social ya está registrado con otra cuenta')
                    if len(clean_ssn) >= 4:
                        update_data['ssn_last4'] = clean_ssn[-4:]
                        update_data['ssn_masked'] = f"***-**-{clean_ssn[-4:]}"
                    update_data[field] = clean_ssn  # Store full SSN
                else:
                    update_data[field] = val.strip() if isinstance(val, str) else val
        
        if not update_data:
            # If no data to update, just return current user
            print(f"⚠️ No data to update, returning current user")
            user_response = dict(await _db.users.find_one({'_id': current_user['id']}))
            user_response['id'] = user_response.pop('_id')
            user_response.pop('password_hash', None)
            return user_response
        
        print(f"✅ Updating user {current_user['id']} with {len(update_data)} fields: {list(update_data.keys())}")
        
        # Update user in database
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': update_data}
        )
        
        # Get updated user
        updated_user = await _db.users.find_one({'_id': current_user['id']})
        user_response = dict(updated_user)
        user_response['id'] = user_response.pop('_id')
        user_response.pop('password_hash', None)
        
        print(f"✅ Profile updated successfully for {current_user['email']}")
        
        return user_response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error updating profile: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoint to update any client's profile
@auth_router.put('/admin/clients/{client_id}')
async def update_client_profile(
    client_id: str,
    profile_data: UpdateProfileRequest,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Update any client's profile"""
    try:
        from bson import ObjectId
        
        update_data = {}
        
        if profile_data.name is not None:
            update_data['name'] = profile_data.name
        
        if profile_data.email is not None:
            # Check if email is already taken by another user
            existing = await _db.users.find_one({
                'email': profile_data.email,
                '_id': {'$ne': client_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail='Email ya está en uso')
            update_data['email'] = profile_data.email
        
        if profile_data.phone is not None:
            update_data['phone'] = profile_data.phone
        
        if profile_data.address is not None:
            update_data['address'] = profile_data.address
        
        if profile_data.profile_picture is not None:
            update_data['profile_picture'] = profile_data.profile_picture
        
        if not update_data:
            raise HTTPException(status_code=400, detail='No se proporcionaron datos para actualizar')
        
        # Try to find and update with multiple ID formats
        user = None
        actual_id = None
        
        # Try ObjectId format first
        if ObjectId.is_valid(client_id):
            user = await _db.users.find_one({'_id': ObjectId(client_id)})
            if user:
                actual_id = ObjectId(client_id)
        
        # Try string _id
        if not user:
            user = await _db.users.find_one({'_id': client_id})
            if user:
                actual_id = client_id
        
        # Try 'id' field (UUID format)
        if not user:
            user = await _db.users.find_one({'id': client_id})
            if user:
                actual_id = user.get('_id')
        
        if not user:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        # Update client in database using the correct ID
        result = await _db.users.update_one(
            {'_id': actual_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        # Get updated user
        updated_user = await _db.users.find_one({'_id': actual_id})
        user_response = dict(updated_user)
        user_response['id'] = str(user_response.pop('_id'))
        user_response.pop('password_hash', None)
        
        return user_response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error updating client profile: {e}')
        raise HTTPException(status_code=500, detail=str(e))

# Google OAuth endpoints
@auth_router.post('/auth/session-data', response_model=LoginResponse)
async def session_data(x_session_id: str = Header(...)):
    """Process Emergent Google OAuth session_id"""
    try:
        # Call Emergent auth service
        response = http_requests.post(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': x_session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail='Invalid session ID')
        
        data = response.json()
        
        # Check if user exists
        user = await _db.users.find_one({'email': data['email']})
        
        if not user:
            # Create new user
            user = User(
                email=data['email'],
                name=data['name'],
                picture=data.get('picture'),
                role='client'
            )
            user_dict = user.dict(by_alias=True)
            await _db.users.insert_one(user_dict)
            user = user_dict
        
        # Create session with provided token
        session = UserSession(
            user_id=user['_id'],
            session_token=data['session_token'],
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        await _db.user_sessions.insert_one(session.dict())
        
        user_response = dict(user)
        user_response['id'] = user_response.pop('_id')
        user_response.pop('password_hash', None)
        
        return LoginResponse(
            session_token=data['session_token'],
            user=user_response
        )
    
    except Exception as e:
        logging.error(f'Google OAuth error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== PHONE OTP AUTH (Mi Caso USA) ==================
# Login/Register by phone number using SMS OTP code
# No password required - phone verification is the auth method

class PhoneSendOTPRequest(BaseModel):
    phone: str
    country_code: str = '+1'

class PhoneVerifyOTPRequest(BaseModel):
    phone: str
    code: str
    country_code: str = '+1'
    name: Optional[str] = None  # For new users

def _normalize_phone(phone: str, country_code: str = '+1') -> str:
    """Normalize phone number to E.164 format"""
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 10:
        return f'{country_code}{digits}'
    elif len(digits) == 11 and digits.startswith('1'):
        return f'+{digits}'
    elif len(digits) > 10:
        return f'+{digits}'
    return f'{country_code}{digits}'


@auth_router.post('/auth/phone/send-otp')
async def phone_send_otp(request: PhoneSendOTPRequest):
    """Send a 6-digit OTP code via SMS to the given phone number"""
    phone = _normalize_phone(request.phone, request.country_code)
    
    if len(''.join(filter(str.isdigit, phone))) < 10:
        raise HTTPException(status_code=400, detail='Número de teléfono inválido')
    
    # Rate limit: max 3 OTP per phone per 10 minutes
    from datetime import datetime as dt
    ten_min_ago = dt.utcnow() - timedelta(minutes=10)
    recent_otps = await _db.phone_otps.count_documents({
        'phone': phone,
        'created_at': {'$gte': ten_min_ago}
    })
    if recent_otps >= 5:
        raise HTTPException(status_code=429, detail='Demasiados intentos. Espera 10 minutos.')
    
    # Generate 6-digit code
    code = f'{random.randint(100000, 999999)}'
    now = dt.utcnow()
    expires_at = now + timedelta(minutes=5)
    
    # Store OTP in DB
    await _db.phone_otps.insert_one({
        'phone': phone,
        'code': code,
        'expires_at': expires_at,
        'created_at': now,
        'verified': False,
        'attempts': 0,
    })
    
    # Send SMS via Twilio
    sms_sent = False
    try:
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        twilio_sid = None
        twilio_token = None
        twilio_phone = None
        
        if config_doc:
            twilio_sid = config_doc.get('twilio_account_sid') or config_doc.get('TWILIO_ACCOUNT_SID')
            twilio_token = config_doc.get('twilio_auth_token') or config_doc.get('TWILIO_AUTH_TOKEN')
            twilio_phone = config_doc.get('twilio_phone_number') or config_doc.get('TWILIO_PHONE_NUMBER')
        
        if not twilio_sid:
            twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
            twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
            twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if twilio_sid and twilio_token and twilio_phone:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            
            message = client.messages.create(
                body=f'Ross Tax: Tu código de verificación es {code}. Expira en 5 minutos.',
                from_=twilio_phone,
                to=phone
            )
            sms_sent = True
            logger.info(f"✅ OTP SMS sent to {phone[-4:].rjust(len(phone), '*')}: SID={message.sid}")
        else:
            logger.error("❌ Twilio credentials not found for OTP SMS")
    except Exception as e:
        logger.error(f"❌ Error sending OTP SMS to {phone}: {e}")
    
    # Check if this phone is already registered
    existing_user = await _db.users.find_one({
        '$or': [
            {'phone': phone},
            {'phone': phone.replace('+1', '')},
            {'phone': phone[-10:]},
        ]
    })
    
    return {
        'success': True,
        'sms_sent': sms_sent,
        'phone_masked': f'***-***-{phone[-4:]}',
        'is_new_user': existing_user is None,
        'expires_in_seconds': 300,
        'message': 'Código enviado por SMS' if sms_sent else 'Error enviando SMS. Intenta de nuevo.',
    }


@auth_router.post('/auth/phone/verify-otp')
async def phone_verify_otp(request: PhoneVerifyOTPRequest):
    """Verify OTP code and login/register the user"""
    from datetime import datetime as dt
    phone = _normalize_phone(request.phone, request.country_code)
    
    if not request.code or len(request.code) != 6:
        raise HTTPException(status_code=400, detail='Código de 6 dígitos requerido')
    
    # Find the most recent valid OTP for this phone
    now = dt.utcnow()
    otp_record = await _db.phone_otps.find_one(
        {
            'phone': phone,
            'code': request.code,
            'verified': False,
            'expires_at': {'$gt': now},
            'attempts': {'$lt': 5},
        },
        sort=[('created_at', -1)]
    )
    
    if not otp_record:
        # Record attempt on the latest OTP
        latest = await _db.phone_otps.find_one(
            {'phone': phone, 'verified': False},
            sort=[('created_at', -1)]
        )
        if latest:
            await _db.phone_otps.update_one(
                {'_id': latest['_id']},
                {'$inc': {'attempts': 1}}
            )
        raise HTTPException(status_code=400, detail='Código incorrecto o expirado')
    
    # Mark OTP as verified
    await _db.phone_otps.update_one(
        {'_id': otp_record['_id']},
        {'$set': {'verified': True, 'verified_at': now}}
    )
    
    # Find or create user in immigration_users (Mi Caso USA independent collection)
    user = await _db.immigration_users.find_one({
        '$or': [
            {'phone': phone},
            {'phone': phone.replace('+1', '')},
            {'phone': phone[-10:]},
        ]
    })
    
    if user:
        # Existing user - log in
        user_id = str(user['_id'])
        
        # Update phone to normalized format
        await _db.immigration_users.update_one(
            {'_id': user['_id']},
            {'$set': {'phone': phone, 'last_login': now, 'phone_verified': True}}
        )
        
        logger.info(f"✅ Phone OTP login: {phone[-4:].rjust(10, '*')} (existing user: {user.get('email', 'no email')})")
    else:
        # New user - register in immigration_users
        user_name = request.name or f'Usuario {phone[-4:]}'
        phone_digits = ''.join(filter(str.isdigit, phone))
        placeholder_email = f'phone_{phone_digits}@micasousa.app'
        
        new_user = {
            '_id': str(uuid.uuid4()),
            'phone': phone,
            'name': user_name,
            'email': placeholder_email,
            'password_hash': None,
            'role': 'client',
            'source': 'micasousa',
            'phone_verified': True,
            'auth_method': 'phone_otp',
            'created_at': now,
            'last_login': now,
        }
        
        try:
            await _db.immigration_users.insert_one(new_user)
        except Exception as e:
            # If duplicate email (unlikely with phone-based placeholder), try with uuid
            if 'duplicate' in str(e).lower():
                new_user['email'] = f'phone_{phone_digits}_{uuid.uuid4().hex[:6]}@micasousa.app'
                new_user['_id'] = str(uuid.uuid4())
                await _db.immigration_users.insert_one(new_user)
            else:
                raise
        
        user = new_user
        user_id = str(new_user['_id'])
        
        logger.info(f"✅ Phone OTP registration: new user {user_name} ({phone[-4:].rjust(10, '*')})")
    
    # Create session
    session_token = _create_session_token(user_id)
    await _db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        'created_at': now,
        'auth_method': 'phone_otp',
    })
    
    # Clean up old OTPs for this phone
    await _db.phone_otps.delete_many({
        'phone': phone,
        'created_at': {'$lt': now - timedelta(hours=1)},
    })
    
    user_dict = dict(user)
    user_id_val = user_dict.pop('_id', user_id)
    is_new = user_dict.get('created_at', now) >= now - timedelta(seconds=5) if isinstance(user_dict.get('created_at'), type(now)) else False
    
    return {
        'session_token': session_token,
        'user': {
            'id': str(user_id_val),
            'name': user_dict.get('name', ''),
            'email': user_dict.get('email', ''),
            'phone': phone,
            'role': user_dict.get('role', 'client'),
            'phone_verified': True,
            'is_new_user': is_new,
        }
    }



# ═══════════════════════════════════════════════════════════════════
# LENDING Phone OTP — Uses `users` collection instead of immigration_users
# ═══════════════════════════════════════════════════════════════════

@auth_router.post('/auth/lending/phone/send-otp')
async def lending_phone_send_otp(request: PhoneSendOTPRequest):
    """Send a 6-digit OTP code via SMS for Ross Lending users"""
    phone = _normalize_phone(request.phone, request.country_code)
    
    if len(''.join(filter(str.isdigit, phone))) < 10:
        raise HTTPException(status_code=400, detail='Número de teléfono inválido')
    
    from datetime import datetime as dt
    ten_min_ago = dt.utcnow() - timedelta(minutes=10)
    recent_otps = await _db.phone_otps.count_documents({
        'phone': phone,
        'source': 'lending',
        'created_at': {'$gte': ten_min_ago}
    })
    if recent_otps >= 5:
        raise HTTPException(status_code=429, detail='Demasiados intentos. Espera 10 minutos.')
    
    code = f'{random.randint(100000, 999999)}'
    now = dt.utcnow()
    expires_at = now + timedelta(minutes=5)
    
    await _db.phone_otps.insert_one({
        'phone': phone,
        'code': code,
        'expires_at': expires_at,
        'created_at': now,
        'verified': False,
        'attempts': 0,
        'source': 'lending',
    })
    
    # Send SMS via Twilio
    sms_sent = False
    try:
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        twilio_sid = twilio_token = twilio_phone = None
        
        if config_doc:
            twilio_sid = config_doc.get('twilio_account_sid') or config_doc.get('TWILIO_ACCOUNT_SID')
            twilio_token = config_doc.get('twilio_auth_token') or config_doc.get('TWILIO_AUTH_TOKEN')
            twilio_phone = config_doc.get('twilio_phone_number') or config_doc.get('TWILIO_PHONE_NUMBER')
        
        if not twilio_sid:
            twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
            twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
            twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if twilio_sid and twilio_token and twilio_phone:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            message = client.messages.create(
                body=f'Ross Lending: Tu código de verificación es {code}. Expira en 5 minutos.',
                from_=twilio_phone,
                to=phone
            )
            sms_sent = True
            logger.info(f"✅ Lending OTP SMS sent to ***{phone[-4:]}: SID={message.sid}")
        else:
            logger.error("❌ Twilio credentials not found for Lending OTP")
    except Exception as e:
        logger.error(f"❌ Error sending Lending OTP SMS: {e}")
    
    existing_user = await _db.users.find_one({
        '$or': [
            {'phone': phone},
            {'phone': phone.replace('+1', '')},
            {'phone': phone[-10:]},
        ]
    })
    
    return {
        'success': True,
        'sms_sent': sms_sent,
        'phone_masked': f'***-***-{phone[-4:]}',
        'is_new_user': existing_user is None,
        'expires_in_seconds': 300,
        'message': 'Código enviado por SMS' if sms_sent else 'Error enviando SMS. Intenta de nuevo.',
    }


@auth_router.post('/auth/lending/phone/verify-otp')
async def lending_phone_verify_otp(request: PhoneVerifyOTPRequest):
    """Verify OTP code and login/register the user in the lending users collection"""
    from datetime import datetime as dt
    phone = _normalize_phone(request.phone, request.country_code)
    
    if not request.code or len(request.code) != 6:
        raise HTTPException(status_code=400, detail='Código de 6 dígitos requerido')
    
    now = dt.utcnow()
    otp_record = await _db.phone_otps.find_one(
        {
            'phone': phone,
            'code': request.code,
            'verified': False,
            'expires_at': {'$gt': now},
            'attempts': {'$lt': 5},
        },
        sort=[('created_at', -1)]
    )
    
    if not otp_record:
        latest = await _db.phone_otps.find_one(
            {'phone': phone, 'verified': False},
            sort=[('created_at', -1)]
        )
        if latest:
            await _db.phone_otps.update_one(
                {'_id': latest['_id']},
                {'$inc': {'attempts': 1}}
            )
        raise HTTPException(status_code=400, detail='Código incorrecto o expirado')
    
    await _db.phone_otps.update_one(
        {'_id': otp_record['_id']},
        {'$set': {'verified': True, 'verified_at': now}}
    )
    
    # Find or create user in LENDING users collection
    user = await _db.users.find_one({
        '$or': [
            {'phone': phone},
            {'phone': phone.replace('+1', '')},
            {'phone': phone[-10:]},
        ]
    })
    
    if user:
        user_id = str(user['_id'])
        await _db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'phone': phone, 'last_login': now, 'phone_verified': True}}
        )
        logger.info(f"✅ Lending Phone OTP login: ***{phone[-4:]} (existing user)")
    else:
        user_name = request.name or f'Usuario {phone[-4:]}'
        phone_digits = ''.join(filter(str.isdigit, phone))
        placeholder_email = f'phone_{phone_digits}@rosslending.com'
        
        new_user = {
            '_id': str(uuid.uuid4()),
            'phone': phone,
            'name': user_name,
            'email': placeholder_email,
            'password_hash': None,
            'role': 'client',
            'source': 'rosslending_web',
            'phone_verified': True,
            'auth_method': 'phone_otp',
            'created_at': now,
            'last_login': now,
        }
        
        try:
            await _db.users.insert_one(new_user)
        except Exception as e:
            if 'duplicate' in str(e).lower():
                new_user['email'] = f'phone_{phone_digits}_{uuid.uuid4().hex[:6]}@rosslending.com'
                new_user['_id'] = str(uuid.uuid4())
                await _db.users.insert_one(new_user)
            else:
                raise
        
        user = new_user
        user_id = str(new_user['_id'])
        logger.info(f"✅ Lending Phone OTP registration: {user_name} (***{phone[-4:]})")
    
    session_token = _create_session_token(user_id)
    await _db.user_sessions.insert_one({
        'user_id': user_id,
        'session_token': session_token,
        'expires_at': now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        'created_at': now,
        'auth_method': 'phone_otp',
    })
    
    await _db.phone_otps.delete_many({
        'phone': phone,
        'created_at': {'$lt': now - timedelta(hours=1)},
    })
    
    user_dict = dict(user)
    user_id_val = user_dict.pop('_id', user_id)
    
    return {
        'session_token': session_token,
        'user': {
            'id': str(user_id_val),
            'name': user_dict.get('name', ''),
            'email': user_dict.get('email', ''),
            'phone': phone,
            'role': user_dict.get('role', 'client'),
            'phone_verified': True,
        }
    }
