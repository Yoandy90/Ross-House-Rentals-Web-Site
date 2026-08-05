"""
Server Inline Routes - Extracted from server.py
Contains: Admin Config, Rental Payments, Webhooks, WebSocket Chat,
Public Services, Downloads, Health Check, Admin Reset Password.
"""

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse, FileResponse
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

_db = None
_get_current_user = None
_require_admin = None
_limiter = None
_SECRET_KEY = None


def init_inline_routes(db, get_current_user, require_admin, limiter=None, secret_key=None):
    global _db, _get_current_user, _require_admin, _limiter, _SECRET_KEY
    _db = db
    _get_current_user = get_current_user
    _require_admin = require_admin
    _limiter = limiter
    _SECRET_KEY = secret_key


# ═══════════════════════════════════════════════════════════════
# ADMIN CONFIG ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/config')
async def get_admin_config(request: Request):
    """Get all API configurations (admin only)"""
    current_user = await _get_current_user(request.headers.get('Authorization'))
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        config_doc = await _db.admin_config.find_one({}) or {}
        if '_id' in config_doc:
            del config_doc['_id']

        config_keys = {
            'TWILIO_ACCOUNT_SID': config_doc.get('TWILIO_ACCOUNT_SID', ''),
            'TWILIO_AUTH_TOKEN': config_doc.get('TWILIO_AUTH_TOKEN', ''),
            'TWILIO_PHONE_NUMBER': config_doc.get('TWILIO_PHONE_NUMBER', ''),
            'SENDGRID_API_KEY': config_doc.get('SENDGRID_API_KEY', ''),
            'SENDGRID_FROM_EMAIL': config_doc.get('SENDGRID_FROM_EMAIL', ''),
            'OPENAI_API_KEY': config_doc.get('OPENAI_API_KEY', ''),
            'STRIPE_SECRET_KEY': config_doc.get('STRIPE_SECRET_KEY', ''),
            'STRIPE_PUBLISHABLE_KEY': config_doc.get('STRIPE_PUBLISHABLE_KEY', ''),
            'RISE_CRM_URL': config_doc.get('RISE_CRM_URL', ''),
            'RISE_CRM_API_KEY': config_doc.get('RISE_CRM_API_KEY', ''),
        }

        return {'success': True, 'configs': config_keys}
    except Exception as e:
        logger.error(f"Error getting admin config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/api/admin/config')
async def save_admin_config(request: Request):
    """Save API configuration (admin only)"""
    current_user = await _get_current_user(request.headers.get('Authorization'))
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        body = await request.json()
        key = body.get('key')
        value = body.get('value')

        if not key:
            raise HTTPException(status_code=400, detail="Key is required")

        await _db.admin_config.update_one(
            {},
            {'$set': {key: value}},
            upsert=True
        )

        return {'success': True, 'message': 'Configuration saved successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving admin config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/api/admin/config/initialize')
async def initialize_config_from_env(request: Request):
    """Initialize config from environment variables (admin only)"""
    current_user = await _get_current_user(request.headers.get('Authorization'))
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        env_config = {
            'TWILIO_ACCOUNT_SID': os.getenv('TWILIO_ACCOUNT_SID', ''),
            'TWILIO_AUTH_TOKEN': os.getenv('TWILIO_AUTH_TOKEN', ''),
            'TWILIO_PHONE_NUMBER': os.getenv('TWILIO_PHONE_NUMBER', ''),
            'SENDGRID_API_KEY': os.getenv('SENDGRID_API_KEY', ''),
            'SENDGRID_FROM_EMAIL': os.getenv('SENDGRID_FROM_EMAIL', ''),
            'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY', ''),
            'STRIPE_SECRET_KEY': os.getenv('STRIPE_SECRET_KEY', ''),
            'STRIPE_PUBLISHABLE_KEY': os.getenv('STRIPE_PUBLISHABLE_KEY', ''),
            'RISE_CRM_URL': os.getenv('RISE_CRM_URL', ''),
            'RISE_CRM_API_KEY': os.getenv('RISE_CRM_API_KEY', ''),
        }

        update_data = {k: v for k, v in env_config.items() if v}

        if update_data:
            await _db.admin_config.update_one(
                {},
                {'$set': update_data},
                upsert=True
            )

        return {
            'success': True,
            'message': f'Initialized {len(update_data)} configurations from environment'
        }
    except Exception as e:
        logger.error(f"Error initializing config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/api/admin/config/test')
async def test_service_config(request: Request):
    """Test a service configuration (admin only)"""
    current_user = await _get_current_user(request.headers.get('Authorization'))
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        service = request.get('service', '').lower()
        config_doc = await _db.admin_config.find_one({}) or {}

        if service == 'twilio':
            account_sid = config_doc.get('TWILIO_ACCOUNT_SID')
            auth_token = config_doc.get('TWILIO_AUTH_TOKEN')
            if not account_sid or not auth_token:
                return {'success': False, 'message': 'Twilio credentials not configured'}
            if len(account_sid) > 10 and len(auth_token) > 10:
                return {'success': True, 'message': 'Twilio credentials format is valid'}
            else:
                return {'success': False, 'message': 'Invalid Twilio credentials format'}

        elif service == 'sendgrid':
            api_key = config_doc.get('SENDGRID_API_KEY')
            if not api_key:
                return {'success': False, 'message': 'SendGrid API key not configured'}
            if api_key.startswith('SG.') and len(api_key) > 20:
                return {'success': True, 'message': 'SendGrid API key format is valid'}
            else:
                return {'success': False, 'message': 'Invalid SendGrid API key format'}

        elif service == 'openai':
            api_key = config_doc.get('OPENAI_API_KEY')
            if not api_key:
                return {'success': False, 'message': 'OpenAI API key not configured'}
            if api_key.startswith('sk-') and len(api_key) > 20:
                return {'success': True, 'message': 'OpenAI API key format is valid'}
            else:
                return {'success': False, 'message': 'Invalid OpenAI API key format'}

        elif service == 'stripe':
            secret_key = config_doc.get('STRIPE_SECRET_KEY')
            if not secret_key:
                return {'success': False, 'message': 'Stripe secret key not configured'}
            if secret_key.startswith('sk_') and len(secret_key) > 20:
                return {'success': True, 'message': 'Stripe secret key format is valid'}
            else:
                return {'success': False, 'message': 'Invalid Stripe secret key format'}

        else:
            return {'success': False, 'message': f'Unknown service: {service}'}

    except Exception as e:
        logger.error(f"Error testing service config: {e}")
        return {'success': False, 'message': str(e)}


# ═══════════════════════════════════════════════════════════════
# RENTAL PAYMENT CRUD (inline endpoints)
# ═══════════════════════════════════════════════════════════════

@router.put('/api/admin/rental-payments/{payment_id}')
async def edit_rental_payment(payment_id: str, request: Request):
    """Update a rental payment"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    token_str = auth.replace('Bearer ', '')
    user = await _db.users.find_one({"session_token": token_str})
    if not user or user.get('role') not in ['admin', 'superadmin']:
        raise HTTPException(status_code=401, detail="No autorizado")
    data = await request.json()
    existing = await _db.rental_payments.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    update_fields = {"updated_at": datetime.utcnow()}
    for field in ["amount", "payment_method", "period_month", "period_year", "late_fee", "notes", "status"]:
        if field in data:
            update_fields[field] = float(data[field]) if field in ("amount", "late_fee") else data[field]
    await _db.rental_payments.update_one({"_id": ObjectId(payment_id)}, {"$set": update_fields})
    updated = await _db.rental_payments.find_one({"_id": ObjectId(payment_id)})
    updated['_id'] = str(updated['_id'])
    return {"success": True, "payment": updated}


@router.delete('/api/admin/rental-payments/{payment_id}')
async def remove_rental_payment(payment_id: str, request: Request):
    """Delete a rental payment"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    token_str = auth.replace('Bearer ', '')
    user = await _db.users.find_one({"session_token": token_str})
    if not user or user.get('role') not in ['admin', 'superadmin']:
        raise HTTPException(status_code=401, detail="No autorizado")
    existing = await _db.rental_payments.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    await _db.rental_payments.delete_one({"_id": ObjectId(payment_id)})
    return {"success": True, "message": "Pago eliminado exitosamente"}


@router.get('/api/deploy-check')
async def deploy_check():
    return {"deployed": True, "version": "2025-02-payments-crud", "routes": ["PUT rental-payments", "DELETE rental-payments"]}


# ═══════════════════════════════════════════════════════════════
# WEBHOOK ENDPOINTS (Meta/WhatsApp)
# ═══════════════════════════════════════════════════════════════

@router.get('/webhook')
async def direct_webhook_verify(request: Request):
    """Direct webhook verification without /api prefix"""
    params = dict(request.query_params)
    mode = params.get('hub.mode')
    token = params.get('hub.verify_token')
    challenge = params.get('hub.challenge')

    if mode == 'subscribe' and token in ['rosstax2025', 'ross_tax_whatsapp_2025']:
        return PlainTextResponse(content=str(challenge), status_code=200)
    return PlainTextResponse(content="Verification failed", status_code=403)


@router.post('/webhook')
async def direct_webhook_post(request: Request):
    """Direct webhook for receiving messages"""
    body = await request.body()
    data = json.loads(body)
    print(f"Webhook received: {data}")
    return {"status": "received"}


# ═══════════════════════════════════════════════════════════════
# WEBSOCKET CHAT
# ═══════════════════════════════════════════════════════════════

_chat_manager = None
_handle_ws_message = None


def set_websocket_deps(chat_manager, handle_ws_message):
    global _chat_manager, _handle_ws_message
    _chat_manager = chat_manager
    _handle_ws_message = handle_ws_message


@router.websocket("/ws/chat/{token}")
async def websocket_chat_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time chat"""
    user_id = None
    try:
        user = await _get_ws_user(token)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return

        user_id = str(user.get('_id') or user.get('id'))
        await _chat_manager.connect(websocket, user_id)

        while True:
            try:
                data = await websocket.receive_json()
                await _handle_ws_message(websocket, user_id, data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})

    except WebSocketDisconnect:
        if user_id:
            _chat_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if user_id:
            _chat_manager.disconnect(websocket)


async def _get_ws_user(token: str):
    """Helper to get user from token for WebSocket auth"""
    try:
        session = await _db.sessions.find_one({"session_token": token})
        if not session:
            return None
        user = await _db.users.find_one({"_id": session["user_id"]})
        return user
    except Exception as e:
        print(f"Token validation error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

@router.get("/health")
@router.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "ross-tax-api", "version": "3.0"}


# ═══════════════════════════════════════════════════════════════
# PUBLIC SERVICES
# ═══════════════════════════════════════════════════════════════

@router.get("/api/public/services")
async def get_public_services(request: Request):
    """Public endpoint - Returns all active dynamic services for the /servicios page"""
    try:
        lang = request.query_params.get('lang', '')
        if not lang:
            accept_lang = request.headers.get('Accept-Language', '')
            lang = 'en' if 'en' in accept_lang.lower() else 'es'

        all_services = []

        # 1. Get services from dynamic_services collection
        dynamic_services = await _db.dynamic_services.find({
            'active': True,
            'visible_in_app': {'$ne': False}
        }).sort('order_index', 1).to_list(100)

        for s in dynamic_services:
            s['id'] = str(s.pop('_id', ''))
            s['source'] = 'dynamic_services'
            if lang == 'en':
                if s.get('name_en'):
                    s['name'] = s['name_en']
                if s.get('short_description_en'):
                    s['short_description'] = s['short_description_en']
                if s.get('description_en'):
                    s['description'] = s['description_en']
            all_services.append(s)

        # 2. Get services from service_prices collection (admin-managed)
        admin_services = await _db.service_prices.find({
            'is_active': {'$ne': False}
        }).to_list(100)

        for s in admin_services:
            service_id = str(s.pop('_id', ''))
            service_name = s.get('name', '')
            mapped_service = {
                'id': service_id,
                'name': s.get('name_en', service_name) if lang == 'en' and s.get('name_en') else service_name,
                'description': s.get('description_en', s.get('description', '')) if lang == 'en' and s.get('description_en') else s.get('description', ''),
                'short_description': (s.get('description_en', s.get('description', ''))[:100] if lang == 'en' and s.get('description_en') else s.get('description', '')[:100]) if s.get('description') else '',
                'price': s.get('base_price', s.get('price_credits', 0)),
                'category': s.get('category', 'general'),
                'icon': s.get('icon', 'briefcase'),
                'color': s.get('color', '#6C1110'),
                'is_popular': s.get('is_popular', False),
                'active': True,
                'source': 'services',
                'order_index': s.get('order_index', 100)
            }

            # Avoid duplicates by name
            is_duplicate = False
            for existing in all_services:
                existing_name = existing.get('name', '').lower()
                new_name = mapped_service['name'].lower()
                if existing_name in new_name or new_name in existing_name or existing_name == new_name:
                    is_duplicate = True
                    break

            if not is_duplicate:
                all_services.append(mapped_service)

        all_services.sort(key=lambda x: x.get('order_index', 999))
        return {'services': all_services, 'count': len(all_services)}
    except Exception as e:
        print(f"Error getting public services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# DOWNLOAD ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/download-plugin")
async def download_plugin():
    """Download Ross Tax Connect plugin for Rise CRM"""
    file_path = "/app/rise_crm_plugin/ross_tax_connect.zip"
    if os.path.exists(file_path):
        return FileResponse(
            path=file_path,
            filename="ross_tax_connect.zip",
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=ross_tax_connect.zip"}
        )
    else:
        raise HTTPException(status_code=404, detail="Plugin file not found")


@router.get("/api/download/{filename}")
async def download_file(filename: str):
    """Download a specific file from static folder"""
    file_path = os.path.join(os.path.dirname(__file__), "static", filename)
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type='application/octet-stream',
            filename=filename
        )
    return {"error": "File not found"}


@router.get("/download/ross-apps")
async def download_ross_apps():
    """Download Ross Apps selector"""
    file_path = os.path.join(os.path.dirname(__file__), "static", "ross_apps_download.zip")
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="application/zip",
            filename="ross_apps_selector.zip"
        )
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/api/download/business-plan")
async def download_business_plan():
    """Download business plan PDF"""
    file_path = os.path.join(os.path.dirname(__file__), "static", "ross_tax_bookkeeping_plan.pdf")
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename="Ross_Tax_Plan_de_Negocio_Bookkeeping.pdf"
        )
    raise HTTPException(status_code=404, detail="PDF not found")


# ═══════════════════════════════════════════════════════════════
# ADMIN RESET PASSWORD
# ═══════════════════════════════════════════════════════════════

@router.post("/api/admin/reset-password/{user_id}")
async def admin_reset_user_password(user_id: str, request: Request):
    """Admin-only: force reset a user's password"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    token_str = auth.replace("Bearer ", "")
    try:
        from jose import jwt as _jwt
        payload = _jwt.decode(token_str, _SECRET_KEY, algorithms=["HS256"])
        admin_user = await _db.users.find_one({"id": payload.get("sub")})
        if not admin_user or admin_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    data = await request.json()
    new_password = data.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")

    import bcrypt as _bcrypt
    bcrypt_hash = _bcrypt.hashpw(new_password.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')

    # Try finding user by id field
    user = await _db.users.find_one({"id": user_id})
    if user:
        await _db.users.update_one({"id": user_id}, {"$set": {"password": bcrypt_hash, "password_hash": bcrypt_hash}})
        return {"success": True, "message": f"Password reset for {user.get('email')}"}

    # Try finding by email
    user = await _db.users.find_one({"email": user_id})
    if user:
        await _db.users.update_one({"email": user_id}, {"$set": {"password": bcrypt_hash, "password_hash": bcrypt_hash}})
        return {"success": True, "message": f"Password reset for {user.get('email')}"}

    # Try by _id string
    user = await _db.users.find_one({"_id": user_id})
    if user:
        await _db.users.update_one({"_id": user_id}, {"$set": {"password": bcrypt_hash, "password_hash": bcrypt_hash}})
        return {"success": True, "message": f"Password reset for {user.get('email')}"}

    raise HTTPException(status_code=404, detail="User not found")
