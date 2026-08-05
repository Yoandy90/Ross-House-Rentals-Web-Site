"""
Immigration Case Tracking Routes
- USCIS Case Status (scraping public endpoint initially, API later)
- EOIR Court Cases (scraping ACIS portal)
- Case Management (CRUD for user cases)
- Background polling for status changes
- Push notifications on status change
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timedelta
from bson import ObjectId
from typing import Optional
import logging
import httpx
import re
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/immigration", tags=["immigration"])

_db = None

# USCIS API credentials (sandbox)
USCIS_CLIENT_ID = os.getenv('USCIS_CLIENT_ID', 'VMignmUaFoGXHhBfvVrZNRJAHMOjmVlY')
USCIS_CLIENT_SECRET = os.getenv('USCIS_CLIENT_SECRET', 'vav8HuOHc97dGhY7')
USCIS_OAUTH_URL = os.getenv('USCIS_OAUTH_URL', 'https://api-int.uscis.gov/oauth/accesstoken')
USCIS_API_BASE = os.getenv('USCIS_API_BASE', 'https://api-int.uscis.gov/case-status')

# Token cache
_uscis_token = None
_uscis_token_expires = None

def set_db(database):
    global _db
    _db = database


# ═══════════════════════════════════════════════════════════════════
# AUTH HELPER
# ═══════════════════════════════════════════════════════════════════

async def get_user_id(request: Request) -> Optional[str]:
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:]
    try:
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get('sub') or payload.get('user_id')
    except:
        return None


# ═══════════════════════════════════════════════════════════════════
# DELETE ACCOUNT (Apple App Store Requirement 5.1.1(v))
# ═══════════════════════════════════════════════════════════════════

@router.delete("/user/account")
async def delete_immigration_account(request: Request):
    """
    Delete Mi Caso USA user account and all associated data.
    Required by Apple App Store guidelines 5.1.1(v).
    """
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    try:
        # Find the user first for logging
        user = await _db["immigration_users"].find_one({"_id": user_id})
        if not user:
            user = await _db["immigration_users"].find_one({"_id": ObjectId(user_id)})
        
        user_email = user.get('email', 'unknown') if user else 'unknown'
        
        # Collections to clean for Mi Caso USA user
        collections_to_clean = [
            'immigration_cases',
            'immigration_saved_cases',
            'user_sessions',
            'push_tokens',
            'notifications',
            'chat_messages',
        ]
        
        deleted_counts = {}
        for collection_name in collections_to_clean:
            try:
                result = await _db[collection_name].delete_many({'user_id': user_id})
                deleted_counts[collection_name] = result.deleted_count
            except Exception as e:
                logger.warning(f"Could not clean {collection_name}: {e}")
        
        # Delete from immigration_users
        result1 = await _db["immigration_users"].delete_one({"_id": user_id})
        if result1.deleted_count == 0:
            await _db["immigration_users"].delete_one({"_id": ObjectId(user_id)})
        
        # Also clean from generic users if they exist there
        await _db["users"].delete_one({"_id": user_id})
        
        # Log deletion for compliance/auditing
        await _db["account_deletions"].insert_one({
            'user_id': str(user_id),
            'email': user_email,
            'source': 'micasousa',
            'deleted_at': datetime.utcnow(),
            'data_cleaned': deleted_counts
        })
        
        logger.info(f"✅ Mi Caso USA account deleted: {user_id} ({user_email})")
        
        return {'message': 'Cuenta eliminada exitosamente', 'data_removed': deleted_counts}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting Mi Caso USA account {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar la cuenta. Contacta soporte.")


# ═══════════════════════════════════════════════════════════════════
# PUSH TOKEN REGISTRATION
# ═══════════════════════════════════════════════════════════════════

@router.post("/push-token")
async def register_push_token(request: Request):
    """Register or update the user's Expo Push Token."""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")

    body = await request.json()
    push_token = body.get("push_token", "").strip()
    platform = body.get("platform", "ios")
    device_name = body.get("device_name", "")
    source_app = body.get("source_app", "mi-caso-usa")  # Identify which app registered this token

    if not push_token:
        raise HTTPException(status_code=400, detail="Token requerido")

    # Save to immigration_users collection (Mi Caso USA independent)
    # Try to find user by 'id' field (UUID) or '_id' field (ObjectId)
    result = await _db["immigration_users"].update_one(
        {"$or": [
            {"id": user_id},
            {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id}
        ]},
        {"$set": {
            "expo_push_token": push_token,
            "push_platform": platform,
            "push_device_name": device_name,
            "push_token_updated": datetime.utcnow(),
            "push_token_source": source_app,
        }},
    )

    logger.info(f"[Push] Token registered for user {user_id}: {push_token[:20]}... source={source_app} (matched: {result.matched_count}, modified: {result.modified_count})")
    return {"success": True, "message": "Token registrado"}


# ═══════════════════════════════════════════════════════════════════
# SUBSCRIPTION / PAYWALL HELPER
# ═══════════════════════════════════════════════════════════════════

# Plan limits: how many active cases each tier can have
PLAN_LIMITS = {
    'free': 1,
    'basic': 3,
    'basico': 3,
    'standard': 10,
    'estandar': 10,
    'estándar': 10,
    'premium': 30,
}

async def get_user_plan(user_id: str) -> dict:
    """
    Returns the user's active plan info.
    { 'plan': 'free'|'basic'|'standard'|'premium', 'case_limit': int, 'has_ai': bool }
    """
    if _db is None:
        return {'plan': 'free', 'case_limit': 1, 'has_ai': False}
    
    # Try multiple query strategies (same as credits_routes.py)
    subscription = None
    
    # Query 1: exact string match
    subscription = await _db.user_subscriptions.find_one({
        'user_id': user_id,
        'status': 'active'
    })
    
    # Query 2: search by email via users collection
    if not subscription:
        user_doc = await _db.users.find_one({'_id': ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        if user_doc:
            email = user_doc.get('email', '')
            if email:
                subscription = await _db.user_subscriptions.find_one({
                    '$or': [
                        {'email': email, 'status': 'active'},
                        {'user_email_cache': email, 'status': 'active'},
                    ]
                })
    
    if not subscription:
        return {'plan': 'free', 'case_limit': 1, 'has_ai': False}
    
    # Determine plan tier from plan_name or apple_product_id
    plan_name = (subscription.get('plan_name', '') or '').lower()
    apple_id = (subscription.get('apple_product_id', '') or '').lower()
    
    tier = 'basic'  # default if subscribed but can't determine tier
    for key in PLAN_LIMITS:
        if key in plan_name or key in apple_id:
            tier = key
            break
    
    # Normalize tier
    if tier in ('basico', 'básico', 'basico'):
        tier = 'basic'
    if tier in ('estandar', 'estándar'):
        tier = 'standard'
    
    case_limit = PLAN_LIMITS.get(tier, 3)
    has_ai = tier in ('standard', 'premium')
    
    return {
        'plan': tier,
        'case_limit': case_limit,
        'has_ai': has_ai,
        'subscription_id': str(subscription.get('_id', '')),
    }


# ═══════════════════════════════════════════════════════════════════
# USCIS CASE STATUS CHECKER
# ═══════════════════════════════════════════════════════════════════

USCIS_STATUS_URL = "https://egov.uscis.gov/casestatus/mycasestatus.do"

async def check_uscis_status(receipt_number: str, sandbox: bool = False) -> dict:
    """
    Check USCIS case status using official API.
    Priority: 1) Official USCIS Torch API 2) Sandbox fallback
    Receipt format: 3 letters + 10 digits (e.g., EAC2490123456)
    """
    receipt_number = receipt_number.strip().upper().replace("-", "").replace(" ", "")
    
    if not re.match(r'^[A-Z]{3}\d{10}$', receipt_number):
        return {'success': False, 'error': 'Número de recibo inválido. Formato: 3 letras + 10 dígitos (ej: EAC2490123456)'}
    
    # If sandbox mode is explicitly requested, return demo data immediately
    if sandbox:
        return _get_sandbox_uscis_result(receipt_number)
    
    # Try official USCIS API first
    if USCIS_CLIENT_ID and USCIS_CLIENT_SECRET:
        try:
            result = await _check_uscis_official_api(receipt_number)
            if result.get('success'):
                logger.info(f"✅ [USCIS API] Successfully queried {receipt_number}")
                return result
            else:
                # API returned an error (e.g., receipt not found)
                # If it's a "not recognized" error, return it directly
                error_msg = result.get('error', '')
                if 'not recognize' in error_msg.lower() or 'no encontrado' in error_msg.lower():
                    return result
                # Otherwise fall through to sandbox
                logger.warning(f"⚠️ [USCIS API] Failed for {receipt_number}: {error_msg}")
        except Exception as e:
            logger.error(f"❌ [USCIS API] Exception for {receipt_number}: {e}")
    
    # Fallback: sandbox data
    result = _get_sandbox_uscis_result(receipt_number)
    result['sandbox_mode'] = True
    result['sandbox_reason'] = 'API no disponible. Mostrando datos de demostración.'
    return result


def _get_sandbox_uscis_result(receipt_number: str) -> dict:
    """Generate realistic sandbox data based on receipt number prefix"""
    import hashlib
    
    # Use the receipt number to deterministically generate a "status"
    hash_val = int(hashlib.md5(receipt_number.encode()).hexdigest()[:8], 16) % 100
    
    # Prefix determines form type
    prefix = receipt_number[:3]
    form_types = {
        'EAC': 'Form I-765',  # EAD
        'WAC': 'Form I-130',  # Family petition
        'LIN': 'Form I-140',  # Employment petition
        'SRC': 'Form I-485',  # Adjustment of Status
        'MSC': 'Form N-400',  # Naturalization
        'IOE': 'Form I-131',  # Travel Document
    }
    form_type = form_types.get(prefix, 'Form I-485')
    
    # Determine status based on hash for variety
    if hash_val < 15:
        status = 'Case Was Received'
        desc = f'On {_fake_date(-60)}, we received your {form_type}, Receipt Number {receipt_number}, and sent you a receipt notice. The notice describes how we will process your case.'
    elif hash_val < 30:
        status = 'Fingerprint Fee Was Received'
        desc = f'On {_fake_date(-45)}, we received your fingerprint fee for your {form_type}, Receipt Number {receipt_number}. We will schedule your biometrics appointment.'
    elif hash_val < 45:
        status = 'Case Was Updated To Show Fingerprints Were Taken'
        desc = f'On {_fake_date(-30)}, we updated your {form_type}, Receipt Number {receipt_number}, to show that your fingerprints were taken.'
    elif hash_val < 55:
        status = 'Case Is Being Actively Reviewed'
        desc = f'As of {_fake_date(-10)}, your {form_type}, Receipt Number {receipt_number}, is being actively reviewed by USCIS. Processing times vary depending on the office.'
    elif hash_val < 65:
        status = 'Interview Was Scheduled'
        desc = f'On {_fake_date(-5)}, your interview for {form_type}, Receipt Number {receipt_number}, was scheduled. You will receive a notice with the date, time, and location.'
    elif hash_val < 75:
        status = 'Request for Evidence Was Sent'
        desc = f'On {_fake_date(-15)}, we sent a Request for Evidence (RFE) for your {form_type}, Receipt Number {receipt_number}. Please follow the instructions in the notice.'
    elif hash_val < 85:
        status = 'Case Was Approved'
        desc = f'On {_fake_date(-3)}, your {form_type}, Receipt Number {receipt_number}, was approved. If your case requires a card, it will be produced and mailed to you.'
    elif hash_val < 92:
        status = 'Card Is Being Produced'
        desc = f'On {_fake_date(-2)}, we began producing your card for your {form_type}, Receipt Number {receipt_number}. You will receive it in 7-10 business days.'
    else:
        status = 'Card Was Mailed To Me'
        desc = f'On {_fake_date(-1)}, your card for {form_type}, Receipt Number {receipt_number}, was mailed to the address on file. Delivery takes 7-10 days via USPS.'
    
    return {
        'success': True,
        'receipt_number': receipt_number,
        'status_title': status,
        'status_description': desc,
        'form_type': form_type,
        'checked_at': datetime.utcnow().isoformat(),
        'sandbox_mode': True,
    }


def _fake_date(days_offset: int) -> str:
    """Generate a fake date string relative to today"""
    d = datetime.utcnow() + timedelta(days=days_offset)
    months = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December']
    return f'{months[d.month - 1]} {d.day}, {d.year}'


async def _get_uscis_token() -> str:
    """Get a cached USCIS OAuth token, refreshing if expired"""
    global _uscis_token, _uscis_token_expires
    
    # Return cached token if still valid (with 60s buffer)
    if _uscis_token and _uscis_token_expires and datetime.utcnow() < _uscis_token_expires:
        return _uscis_token
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            USCIS_OAUTH_URL,
            data={
                'grant_type': 'client_credentials',
                'client_id': USCIS_CLIENT_ID,
                'client_secret': USCIS_CLIENT_SECRET,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        
        if response.status_code != 200:
            logger.error(f"USCIS OAuth failed: {response.status_code} {response.text[:200]}")
            raise Exception(f"USCIS OAuth failed: {response.status_code}")
        
        data = response.json()
        _uscis_token = data['access_token']
        expires_in = int(data.get('expires_in', 1700))
        _uscis_token_expires = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        
        logger.info(f"✅ [USCIS] Got new OAuth token (expires in {expires_in}s)")
        return _uscis_token


async def _check_uscis_official_api(receipt_number: str) -> dict:
    """Check case status using the official USCIS Torch API (Sandbox or Production)"""
    try:
        token = await _get_uscis_token()
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f'{USCIS_API_BASE}/{receipt_number}',
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
            )
            
            if response.status_code == 404 or response.status_code == 400:
                data = response.json()
                msg = data.get('message', 'Caso no encontrado')
                return {'success': False, 'error': f'USCIS: {msg}'}
            
            if response.status_code == 401:
                # Token expired, reset and retry once
                global _uscis_token
                _uscis_token = None
                token = await _get_uscis_token()
                response = await client.get(
                    f'{USCIS_API_BASE}/{receipt_number}',
                    headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'},
                )
            
            if response.status_code != 200:
                return {'success': False, 'error': f'USCIS API error: {response.status_code}'}
            
            data = response.json()
            cs = data.get('case_status', {})
            
            # Build history from API response
            history = []
            for h in cs.get('hist_case_status', []):
                history.append({
                    'date': h.get('date', ''),
                    'description_en': h.get('completed_text_en', ''),
                    'description_es': h.get('completed_text_es', ''),
                })
            
            # Extract form type (e.g., "I-130" from "Form I-130")
            form_type = cs.get('formType', '')
            if form_type and not form_type.startswith('Form '):
                form_type = f'Form {form_type}'
            
            return {
                'success': True,
                'receipt_number': cs.get('receiptNumber', receipt_number),
                'status_title': cs.get('current_case_status_text_en', ''),
                'status_title_es': cs.get('current_case_status_text_es', ''),
                'status_description': cs.get('current_case_status_desc_en', ''),
                'status_description_es': cs.get('current_case_status_desc_es', ''),
                'form_type': form_type,
                'submitted_date': cs.get('submittedDate', ''),
                'modified_date': cs.get('modifiedDate', ''),
                'history': history,
                'checked_at': datetime.utcnow().isoformat(),
                'source': 'uscis_official_api',
                'sandbox_mode': 'api-int' in USCIS_API_BASE,
            }
    except Exception as e:
        logger.error(f"USCIS Official API error: {e}")
        return {'success': False, 'error': f'Error API USCIS: {str(e)[:100]}'}


# ═══════════════════════════════════════════════════════════════════
# EOIR COURT CASE CHECKER
# ═══════════════════════════════════════════════════════════════════

EOIR_ACIS_URL = "https://acis.eoir.justice.gov/en/caseinformation"
EOIR_API_URL = "https://acis.eoir.justice.gov/en/search"

async def check_eoir_status(alien_number: str, sandbox: bool = False) -> dict:
    """
    Check EOIR Immigration Court case using ACIS portal.
    Alien number format: 9 digits (A-number without the 'A' prefix)
    """
    # Clean the alien number
    alien_number = alien_number.strip().upper().replace("A", "").replace("-", "").replace(" ", "")
    
    if not re.match(r'^\d{7,9}$', alien_number):
        return {'success': False, 'error': 'Número A inválido. Debe ser 7-9 dígitos (sin la letra A)'}
    
    # Pad to 9 digits
    alien_number = alien_number.zfill(9)
    
    if sandbox:
        return _get_sandbox_eoir_result(alien_number)
    
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # ACIS uses a REST-like endpoint
            response = await client.get(
                f"https://acis.eoir.justice.gov/en/caseinformation/{alien_number}",
                headers={
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                    'Accept': 'text/html,application/xhtml+xml,application/xml',
                }
            )
            
            if response.status_code == 404:
                # EOIR likely blocking or case truly not found - use sandbox
                result = _get_sandbox_eoir_result(alien_number)
                result['sandbox_mode'] = True
                result['sandbox_reason'] = 'No se pudo verificar directamente con EOIR.'
                return result
            
            if response.status_code in [403, 503]:
                # EOIR blocks cloud IPs too - use sandbox
                result = _get_sandbox_eoir_result(alien_number)
                result['sandbox_mode'] = True
                result['sandbox_reason'] = 'EOIR no permite consultas desde servidores cloud.'
                return result
            
            if response.status_code != 200:
                result = _get_sandbox_eoir_result(alien_number)
                result['sandbox_mode'] = True
                result['sandbox_reason'] = f'EOIR respondió con código {response.status_code}. Mostrando datos de demostración.'
                return result
            
            html = response.text
            
            # Parse case information
            hearing_match = re.search(r'(?:Next Hearing|Próxima Audiencia)[:\s]*([\w\s,]+\d{4})', html, re.IGNORECASE)
            next_hearing = hearing_match.group(1).strip() if hearing_match else None
            
            court_match = re.search(r'(?:Court|Corte)[:\s]*([^<\n]+)', html, re.IGNORECASE)
            court_location = court_match.group(1).strip() if court_match else None
            
            status_match = re.search(r'(?:Status|Estado)[:\s]*([^<\n]+)', html, re.IGNORECASE)
            case_status = status_match.group(1).strip() if status_match else None
            
            judge_match = re.search(r'(?:Judge|Juez)[:\s]*([^<\n]+)', html, re.IGNORECASE)
            judge_name = judge_match.group(1).strip() if judge_match else None
            
            charge_match = re.search(r'(?:Charge|Cargo)[:\s]*([^<\n]+)', html, re.IGNORECASE)
            charge = charge_match.group(1).strip() if charge_match else None
            
            return {
                'success': True,
                'alien_number': f'A{alien_number}',
                'next_hearing': next_hearing,
                'court_location': court_location,
                'case_status': case_status,
                'judge_name': judge_name,
                'charge': charge,
                'checked_at': datetime.utcnow().isoformat(),
                'sandbox_mode': False,
                'raw_available': bool(html and len(html) > 500),
            }
    except httpx.TimeoutException:
        result = _get_sandbox_eoir_result(alien_number)
        result['sandbox_mode'] = True
        result['sandbox_reason'] = 'Timeout conectando con EOIR.'
        return result
    except Exception as e:
        logger.error(f"EOIR check error: {e}")
        result = _get_sandbox_eoir_result(alien_number)
        result['sandbox_mode'] = True
        result['sandbox_reason'] = 'Error de conexión con EOIR.'
        return result


def _get_sandbox_eoir_result(alien_number: str) -> dict:
    """Generate realistic sandbox EOIR court data"""
    import hashlib
    import random
    
    hash_val = int(hashlib.md5(alien_number.encode()).hexdigest()[:8], 16) % 100
    
    courts = [
        'Houston Immigration Court, TX',
        'Los Angeles Immigration Court, CA', 
        'New York - Federal Plaza Immigration Court, NY',
        'Miami Immigration Court, FL',
        'San Antonio Immigration Court, TX',
        'Dallas Immigration Court, TX',
        'Chicago Immigration Court, IL',
        'Arlington Immigration Court, VA',
    ]
    
    judges = [
        'Hon. Maria Rodriguez', 'Hon. John Smith', 'Hon. Patricia Gonzalez',
        'Hon. Robert Chen', 'Hon. Angela Martinez', 'Hon. David Thompson',
    ]
    
    court_idx = hash_val % len(courts)
    judge_idx = hash_val % len(judges)
    
    # Generate next hearing date (2-6 months from now)
    days_ahead = 60 + (hash_val * 3)
    hearing_date = datetime.utcnow() + timedelta(days=days_ahead)
    next_hearing = hearing_date.strftime('%B %d, %Y at 9:00 AM')
    
    if hash_val < 25:
        case_status = 'Scheduled - Individual Hearing'
    elif hash_val < 45:
        case_status = 'Scheduled - Master Calendar Hearing'
    elif hash_val < 60:
        case_status = 'Continuance Granted'
    elif hash_val < 75:
        case_status = 'Awaiting Decision'
    elif hash_val < 85:
        case_status = 'Appeal Pending - BIA'
    else:
        case_status = 'Relief Granted'
    
    return {
        'success': True,
        'alien_number': f'A{alien_number}',
        'next_hearing': next_hearing,
        'court_location': courts[court_idx],
        'case_status': case_status,
        'judge_name': judges[judge_idx],
        'charge': 'INA §240 - Removal Proceedings',
        'checked_at': datetime.utcnow().isoformat(),
        'sandbox_mode': True,
    }


# ═══════════════════════════════════════════════════════════════════
# USER CASE MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post('/cases')
async def add_case(request: Request):
    """Add a new case to track — enforces subscription plan limits"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    body = await request.json()
    case_type = body.get('case_type')  # 'uscis', 'eoir', or 'foia'
    case_number = body.get('case_number', '').strip()
    nickname = body.get('nickname', '')
    
    if case_type not in ['uscis', 'eoir', 'foia']:
        raise HTTPException(status_code=400, detail="case_type debe ser 'uscis', 'eoir' o 'foia'")
    
    if not case_number:
        raise HTTPException(status_code=400, detail="case_number es requerido")
    
    # ── PAYWALL: Check subscription plan limits ──
    user_plan = await get_user_plan(user_id)
    current_case_count = await _db['immigration_cases'].count_documents({
        'user_id': user_id,
        'status': 'active'
    })
    
    if current_case_count >= user_plan['case_limit']:
        # Suggest the next plan up
        plan = user_plan['plan']
        if plan == 'free':
            suggested = 'Básico ($0.99/mes)'
        elif plan == 'basic':
            suggested = 'Estándar ($1.99/mes)'
        elif plan == 'standard':
            suggested = 'Premium ($3.99/mes)'
        else:
            suggested = 'Premium'
        
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=403,
            content={
                'detail': f'Has alcanzado el límite de {user_plan["case_limit"]} caso(s) en tu plan {plan}.',
                'subscription_required': True,
                'current_plan': plan,
                'current_limit': user_plan['case_limit'],
                'current_count': current_case_count,
                'suggested_plan': suggested,
            }
        )
    
    # Validate and check the case immediately
    if case_type == 'uscis':
        result = await check_uscis_status(case_number)
    elif case_type == 'eoir':
        # EOIR blocks server IPs - don't try from backend
        # Real data will come from the mobile app's WebView bridge
        alien_clean = case_number.strip().upper().replace("A", "").replace("-", "").replace(" ", "").zfill(9)
        result = {
            'success': True,
            'alien_number': f'A{alien_clean}',
            'case_status': 'Pendiente de verificación',
            'next_hearing': None,
            'court_location': None,
            'judge_name': None,
            'checked_at': datetime.utcnow().isoformat(),
            'sandbox_mode': False,
            'pending_device_check': True,
        }
    else:
        # FOIA: manual tracking, no API to check
        result = {
            'success': True,
            'status_title': 'Request Submitted',
            'status_description': 'FOIA request registered for tracking. Update status manually.',
        }
    
    # Clean the case number
    clean_number = case_number.upper().replace("-", "").replace(" ", "")
    if case_type == 'eoir':
        clean_number = clean_number.replace("A", "").zfill(9)
    if case_type == 'foia':
        clean_number = case_number.strip().upper()  # Keep as-is for FOIA
    
    # Check for duplicate (only among active cases)
    existing = await _db['immigration_cases'].find_one({
        'user_id': user_id,
        'case_number': clean_number,
        'case_type': case_type,
        'status': 'active',
    })
    if existing:
        raise HTTPException(status_code=409, detail="Ya estás rastreando este caso")
    
    # Create the case record
    if case_type == 'foia':
        display_num = f'FOIA-{clean_number}'
        current_status = body.get('foia_status', 'Solicitud Enviada')
        case_record = {
            'user_id': user_id,
            'case_type': 'foia',
            'case_number': clean_number,
            'display_number': display_num,
            'nickname': nickname or 'FOIA Request',
            'current_status': current_status,
            'last_description': body.get('foia_description', 'Solicitud FOIA registrada para seguimiento manual.'),
            'foia_agency': body.get('foia_agency', 'USCIS'),
            'foia_submitted_date': body.get('foia_submitted_date', datetime.utcnow().isoformat()),
            'form_type': 'G-639',
            'history': [{
                'status': current_status,
                'description': 'Caso FOIA registrado para seguimiento.',
                'checked_at': datetime.utcnow().isoformat(),
            }],
            'status': 'active',
            'notifications_enabled': True,
            'created_at': datetime.utcnow(),
            'last_checked': datetime.utcnow(),
            'check_success': True,
        }
    else:
        case_record = {
            'user_id': user_id,
            'case_type': case_type,
            'case_number': clean_number,
            'display_number': f'A{clean_number}' if case_type == 'eoir' else clean_number,
            'nickname': nickname or (result.get('form_type', '') if case_type == 'uscis' else ''),
            'current_status': result.get('status_title', '') if case_type == 'uscis' else result.get('case_status', ''),
            'last_description': result.get('status_description', ''),
            'next_hearing': result.get('next_hearing') if case_type == 'eoir' else None,
            'court_location': result.get('court_location') if case_type == 'eoir' else None,
            'judge_name': result.get('judge_name') if case_type == 'eoir' else None,
            'form_type': result.get('form_type') if case_type == 'uscis' else None,
            'history': [],
            'status': 'active',
            'notifications_enabled': True,
            'created_at': datetime.utcnow(),
            'last_checked': datetime.utcnow(),
            'check_success': result.get('success', False),
        }
        # If check was successful, add initial history entry
        if result.get('success'):
            case_record['history'].append({
                'status': case_record['current_status'],
                'description': case_record['last_description'],
                'checked_at': datetime.utcnow().isoformat(),
            })
    
    inserted = await _db['immigration_cases'].insert_one(case_record)
    case_record['id'] = str(inserted.inserted_id)
    del case_record['_id']
    
    return {
        'success': True,
        'case': case_record,
        'case_id': case_record['id'],
        'initial_check': result,
    }


@router.get('/cases')
async def list_cases(request: Request):
    """List all tracked cases for the user"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    cases = []
    async for case in _db['immigration_cases'].find({'user_id': user_id, 'status': 'active'}).sort('created_at', -1):
        case['id'] = str(case.pop('_id'))
        cases.append(case)
    
    return {'success': True, 'cases': cases, 'total': len(cases)}


@router.get('/cases/{case_id}')
async def get_case_detail(case_id: str, request: Request):
    """Get detailed case info with full history"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    case['id'] = str(case.pop('_id'))
    return {'success': True, 'case': case}


@router.post('/cases/{case_id}/refresh')
async def refresh_case(case_id: str, request: Request):
    """Manually refresh a case status"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Check status
    if case['case_type'] == 'uscis':
        result = await check_uscis_status(case['case_number'])
    elif case['case_type'] == 'eoir':
        result = await check_eoir_status(case['case_number'])
    elif case['case_type'] == 'foia':
        # FOIA is manual tracking — no API to refresh
        return {
            'success': True,
            'status_changed': False,
            'current_status': case.get('current_status', ''),
            'description': case.get('last_description', ''),
            'foia_manual': True,
            'message': 'Los casos FOIA se actualizan manualmente. Usa "Actualizar Estado" para cambiar el estado.'
        }
    else:
        result = await check_eoir_status(case['case_number'])
    
    if not result.get('success'):
        return {'success': False, 'error': result.get('error'), 'case_id': case_id}
    
    # Determine if status changed
    new_status = result.get('status_title', '') if case['case_type'] == 'uscis' else result.get('case_status', '')
    old_status = case.get('current_status', '')
    status_changed = new_status and new_status != old_status and old_status != ''
    
    # Update case
    updates = {
        'last_checked': datetime.utcnow(),
        'check_success': True,
    }
    
    if new_status:
        updates['current_status'] = new_status
    if result.get('status_description'):
        updates['last_description'] = result['status_description']
    if result.get('next_hearing'):
        updates['next_hearing'] = result['next_hearing']
    if result.get('court_location'):
        updates['court_location'] = result['court_location']
    if result.get('judge_name'):
        updates['judge_name'] = result['judge_name']
    
    # Add to history if status changed
    history_entry = None
    if status_changed:
        history_entry = {
            'status': new_status,
            'description': result.get('status_description', ''),
            'checked_at': datetime.utcnow().isoformat(),
            'previous_status': old_status,
        }
        updates['last_status_change'] = datetime.utcnow()
    
    update_ops = {'$set': updates}
    if history_entry:
        update_ops['$push'] = {'history': history_entry}
    
    await _db['immigration_cases'].update_one({'_id': ObjectId(case_id)}, update_ops)
    
    return {
        'success': True,
        'status_changed': status_changed,
        'current_status': new_status or old_status,
        'description': result.get('status_description', ''),
        'result': result,
    }



@router.post('/cases/{case_id}/eoir-result')
async def save_eoir_direct_result(case_id: str, request: Request):
    """
    Accept EOIR result submitted directly from the mobile app.
    The app queries EOIR from the device (residential IP) and sends us the result.
    """
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    if case.get('case_type') != 'eoir':
        raise HTTPException(status_code=400, detail="Este endpoint es solo para casos EOIR")
    
    body = await request.json()
    
    if not body.get('success'):
        return {'success': False, 'error': body.get('error', 'No data from EOIR')}
    
    # Extract fields from the client-submitted result
    new_status = body.get('case_status', '') or ''
    old_status = case.get('current_status', '')
    status_changed = new_status and new_status != old_status and old_status not in ['', 'Pendiente de verificación']
    
    updates = {
        'last_checked': datetime.utcnow(),
        'check_success': True,
        'last_check_source': 'device_direct',
    }
    
    if new_status:
        updates['current_status'] = new_status
    # Always update next_hearing (clear it if case is closed)
    if body.get('next_hearing'):
        hearing = body['next_hearing']
        if body.get('hearing_time'):
            hearing = f"{hearing} at {body['hearing_time']}"
        updates['next_hearing'] = hearing
    elif body.get('case_closed') or 'next_hearing' in body:
        # Explicitly clear next_hearing when case is closed
        updates['next_hearing'] = None
    if body.get('court_location'):
        updates['court_location'] = body['court_location']
    if body.get('court_contact'):
        updates['court_contact'] = body['court_contact']
    if body.get('judge_name'):
        updates['judge_name'] = body['judge_name']
    if body.get('charges'):
        updates['charges'] = body['charges']
    if body.get('clock_days') is not None:
        updates['clock_days'] = body['clock_days']
    if body.get('clock_status') is not None:
        updates['clock_status'] = body['clock_status']
    if body.get('alien_name'):
        updates['alien_name'] = body['alien_name']
    if body.get('decision_code'):
        updates['decision_code'] = body['decision_code']
    if body.get('appeal_due_date'):
        updates['appeal_due_date'] = body['appeal_due_date']
    if 'case_closed' in body:
        updates['case_closed'] = body['case_closed']
    
    # History entry if status changed
    history_entry = None
    if status_changed:
        history_entry = {
            'status': new_status,
            'description': f'Estado actualizado desde dispositivo: {new_status}',
            'checked_at': datetime.utcnow().isoformat(),
            'previous_status': old_status,
            'source': 'device_direct',
        }
        updates['last_status_change'] = datetime.utcnow()
    
    update_ops = {'$set': updates}
    if history_entry:
        update_ops['$push'] = {'history': history_entry}
    
    await _db['immigration_cases'].update_one({'_id': ObjectId(case_id)}, update_ops)
    
    return {
        'success': True,
        'status_changed': status_changed,
        'current_status': new_status or old_status,
        'source': 'device_direct',
    }



@router.delete('/cases/{case_id}')
async def delete_case(case_id: str, request: Request):
    """Remove a case from tracking"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    result = await _db['immigration_cases'].update_one(
        {'_id': ObjectId(case_id), 'user_id': user_id},
        {'$set': {'status': 'archived', 'archived_at': datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    return {'success': True, 'message': 'Caso eliminado del seguimiento'}



@router.put('/cases/{case_id}')
async def update_case(case_id: str, request: Request):
    """Update case details (nickname, etc.)"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    body = await request.json()
    update_data = {}
    
    if 'nickname' in body:
        update_data['nickname'] = body['nickname']
    
    # FOIA manual status update
    if 'foia_status' in body:
        case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
        if case and case.get('case_type') == 'foia':
            old_status = case.get('current_status', '')
            new_status = body['foia_status'].strip()
            if new_status and new_status != old_status:
                update_data['current_status'] = new_status
                update_data['last_status_change'] = datetime.utcnow()
                if body.get('foia_description'):
                    update_data['last_description'] = body['foia_description']
                # Add history entry
                history_entry = {
                    'status': new_status,
                    'description': body.get('foia_description', ''),
                    'checked_at': datetime.utcnow().isoformat(),
                    'previous_status': old_status,
                }
                await _db['immigration_cases'].update_one(
                    {'_id': ObjectId(case_id)},
                    {'$push': {'history': history_entry}}
                )
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data['updated_at'] = datetime.utcnow()
    
    result = await _db['immigration_cases'].update_one(
        {'_id': ObjectId(case_id), 'user_id': user_id},
        {'$set': update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    return {'success': True, 'message': 'Caso actualizado'}



# ═══════════════════════════════════════════════════════════════════
# QUICK CHECK (No auth required - for onboarding)
# ═══════════════════════════════════════════════════════════════════

@router.post('/quick-check')
async def quick_check(request: Request):
    """Quick case check without requiring login (for onboarding experience)"""
    body = await request.json()
    case_type = body.get('case_type', 'uscis')
    case_number = body.get('case_number', '').strip()
    sandbox = body.get('sandbox', False)
    
    if not case_number:
        raise HTTPException(status_code=400, detail="case_number es requerido")
    
    if case_type == 'uscis':
        result = await check_uscis_status(case_number, sandbox=sandbox)
    elif case_type == 'eoir':
        result = await check_eoir_status(case_number, sandbox=sandbox)
    elif case_type == 'foia':
        raise HTTPException(status_code=400, detail="Los casos FOIA no tienen consulta rápida. Agréguelo a su lista para seguimiento manual.")
    else:
        raise HTTPException(status_code=400, detail="case_type debe ser 'uscis', 'eoir' o 'foia'")
    
    # Translate status to Spanish if available
    if result.get('success') and result.get('status_title'):
        spanish = STATUS_TRANSLATIONS.get(result['status_title'], '')
        if spanish:
            result['status_spanish'] = spanish
    
    return result


@router.get('/processing-times')
async def get_processing_times():
    """Get estimated USCIS processing times for common forms"""
    return {
        'success': True,
        'last_updated': '2026-04-30',
        'forms': [
            {'form': 'I-130', 'name': 'Petición Familiar', 'time_range': '12-24 meses', 'category': 'family'},
            {'form': 'I-485', 'name': 'Ajuste de Estatus', 'time_range': '8-14 meses', 'category': 'green_card'},
            {'form': 'I-765', 'name': 'Permiso de Trabajo (EAD)', 'time_range': '3-7 meses', 'category': 'work'},
            {'form': 'N-400', 'name': 'Ciudadanía', 'time_range': '6-12 meses', 'category': 'citizenship'},
            {'form': 'I-131', 'name': 'Documento de Viaje', 'time_range': '4-8 meses', 'category': 'travel'},
            {'form': 'I-140', 'name': 'Petición de Trabajador', 'time_range': '6-18 meses', 'category': 'work'},
            {'form': 'I-751', 'name': 'Remover Condiciones (Green Card)', 'time_range': '12-24 meses', 'category': 'green_card'},
            {'form': 'I-90', 'name': 'Renovar Green Card', 'time_range': '8-14 meses', 'category': 'green_card'},
        ]
    }


# ═══════════════════════════════════════════════════════════════════
# STATUS TRANSLATION (English -> Spanish)
# ═══════════════════════════════════════════════════════════════════

STATUS_TRANSLATIONS = {
    'Case Was Received': 'Caso Recibido',
    'Case Was Approved': 'Caso Aprobado',
    'Case Was Denied': 'Caso Denegado',
    'Request for Evidence Was Sent': 'Solicitud de Evidencia Enviada (RFE)',
    'Request for Evidence Was Received': 'Evidencia Recibida por USCIS',
    'Case Is Being Actively Reviewed': 'Caso en Revisión Activa',
    'Fingerprint Fee Was Received': 'Pago de Huellas Recibido',
    'Card Is Being Produced': 'Tarjeta en Producción',
    'Card Was Produced': 'Tarjeta Producida',
    'Card Was Mailed To Me': 'Tarjeta Enviada por Correo',
    'Card Was Picked Up By The United States Postal Service': 'Tarjeta Recogida por USPS',
    'Card Was Delivered To Me By The Post Office': 'Tarjeta Entregada',
    'New Card Is Being Produced': 'Nueva Tarjeta en Producción',
    'Case Was Updated To Show Fingerprints Were Taken': 'Huellas Digitales Tomadas',
    'Interview Was Scheduled': 'Entrevista Programada',
    'Interview Was Completed': 'Entrevista Completada',
    'Decision Was Mailed': 'Decisión Enviada por Correo',
    'Case Was Transferred': 'Caso Transferido',
    'Case Closed': 'Caso Cerrado',
    'Withdrawal Acknowledged': 'Retiro Reconocido',
    'Case Rejected Because It Was Improperly Filed': 'Caso Rechazado (Mal Presentado)',
    'Name Was Updated': 'Nombre Actualizado',
    'Appeal Was Filed': 'Apelación Presentada',
    'Fee Waiver Was Approved': 'Exención de Tarifa Aprobada',
}

@router.get('/translate-status')
async def translate_status(status: str = Query('')):
    """Translate a USCIS status to Spanish"""
    translation = STATUS_TRANSLATIONS.get(status, '')
    return {'original': status, 'spanish': translation or status}


# ═══════════════════════════════════════════════════════════════════
# CASE INTELLIGENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

from immigration_intelligence import (
    get_form_intelligence, calculate_progress, calculate_rfe_deadline,
    get_poll_priority_label, DOCUMENT_CHECKLISTS, PROCESSING_TIMES, CASE_STAGES
)

@router.get('/case-intelligence/{case_id}')
async def get_case_intelligence(case_id: str, request: Request):
    """Get full intelligence for a tracked case — requires Standard+ plan for AI features"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    # ── PAYWALL: Check subscription for AI features ──
    user_plan = await get_user_plan(user_id)
    if not user_plan['has_ai']:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=403,
            content={
                'detail': 'Las predicciones de IA requieren el plan Estándar o superior.',
                'upgrade_required': True,
                'current_plan': user_plan['plan'],
                'required_plan': 'standard',
                'suggested_plan': 'Estándar ($1.99/mes)',
            }
        )
    
    case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    form_type = case.get('form_type', '')
    current_status = case.get('current_status', '')
    submitted_date = case.get('submitted_date', '')
    
    intelligence = get_form_intelligence(form_type, current_status, submitted_date)
    
    # Add RFE deadline if case has RFE history
    if 'Request for Evidence' in current_status:
        # Try to find exact RFE date from history
        rfe_date = None
        for h in reversed(case.get('history', [])):
            if 'Request for Evidence' in h.get('status', '') or 'RFE' in h.get('status', ''):
                try:
                    rfe_date = datetime.fromisoformat(h['checked_at'])
                except:
                    pass
                break
        if rfe_date:
            intelligence['rfe_deadline'] = calculate_rfe_deadline(rfe_date)
    
    # Add polling priority
    intelligence['poll_priority'] = get_poll_priority_label(current_status)
    
    return {
        'success': True,
        'case_id': case_id,
        'intelligence': intelligence,
    }


@router.get('/form-info/{form_type}')
async def get_form_info(form_type: str):
    """Get document checklist, processing times, and stages for a form type"""
    form_num = form_type.replace('Form ', '').replace('form ', '').strip().upper()
    if not form_num.startswith('I-'):
        form_num = f'I-{form_num}' if form_num.isdigit() else form_num
    
    intelligence = get_form_intelligence(f'Form {form_num}', '', '')
    
    return {
        'success': True,
        'form_type': form_num,
        'data': intelligence,
    }


@router.post('/cases/{case_id}/family-group')
async def set_family_group(case_id: str, request: Request):
    """Add a case to a family group for linked tracking"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    body = await request.json()
    group_name = body.get('group_name', '').strip()
    
    if not group_name:
        raise HTTPException(status_code=400, detail="group_name es requerido")
    
    case = await _db['immigration_cases'].find_one({'_id': ObjectId(case_id), 'user_id': user_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    await _db['immigration_cases'].update_one(
        {'_id': ObjectId(case_id)},
        {'$set': {'family_group': group_name, 'updated_at': datetime.utcnow()}}
    )
    
    return {'success': True, 'message': f'Caso agregado al grupo familiar: {group_name}'}


@router.get('/family-groups')
async def list_family_groups(request: Request):
    """List all family groups and their cases"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    pipeline = [
        {'$match': {'user_id': user_id, 'status': 'active', 'family_group': {'$exists': True, '$ne': ''}}},
        {'$group': {
            '_id': '$family_group',
            'cases': {'$push': {
                'id': {'$toString': '$_id'},
                'case_number': '$case_number',
                'display_number': '$display_number',
                'case_type': '$case_type',
                'current_status': '$current_status',
                'form_type': '$form_type',
                'nickname': '$nickname',
            }},
            'count': {'$sum': 1},
        }},
        {'$sort': {'_id': 1}},
    ]
    
    groups = []
    async for group in _db['immigration_cases'].aggregate(pipeline):
        groups.append({
            'group_name': group['_id'],
            'cases': group['cases'],
            'count': group['count'],
        })
    
    # Also get ungrouped cases
    ungrouped = await _db['immigration_cases'].count_documents({
        'user_id': user_id,
        'status': 'active',
        '$or': [{'family_group': {'$exists': False}}, {'family_group': ''}],
    })
    
    return {
        'success': True,
        'groups': groups,
        'ungrouped_count': ungrouped,
    }


@router.get('/rfe-deadlines')
async def get_rfe_deadlines(request: Request):
    """Get all active RFE deadlines for the user"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    rfe_cases = []
    async for case in _db['immigration_cases'].find({
        'user_id': user_id,
        'status': 'active',
        'current_status': {'$regex': 'Request for Evidence|RFE', '$options': 'i'},
    }):
        # Find RFE date from history
        rfe_date = None
        for h in reversed(case.get('history', [])):
            if 'Request for Evidence' in h.get('status', '') or 'RFE' in h.get('status', ''):
                try:
                    rfe_date = datetime.fromisoformat(h['checked_at'])
                except:
                    pass
                break
        
        if not rfe_date:
            rfe_date = case.get('last_status_change', datetime.utcnow() - timedelta(days=5))
        
        deadline_info = calculate_rfe_deadline(rfe_date)
        
        rfe_cases.append({
            'case_id': str(case['_id']),
            'case_number': case.get('display_number', case['case_number']),
            'form_type': case.get('form_type', ''),
            'nickname': case.get('nickname', ''),
            'deadline': deadline_info,
        })
    
    # Sort by urgency (most urgent first)
    rfe_cases.sort(key=lambda x: x['deadline']['days_remaining'])
    
    return {
        'success': True,
        'rfe_cases': rfe_cases,
        'total': len(rfe_cases),
    }


# ═══════════════════════════════════════════════════════════════════
# BACKGROUND POLLING (check all active cases periodically)
# ═══════════════════════════════════════════════════════════════════

_poll_task = None

async def poll_all_cases():
    """Background task: smart polling based on case priority"""
    from immigration_intelligence import get_poll_interval, POLL_PRIORITY
    
    while True:
        try:
            await asyncio.sleep(2 * 60 * 60)  # Base check every 2 hours
            if _db is None:
                continue
            
            logger.info("🔍 [Immigration] Starting smart periodic case status check...")
            
            cases_checked = 0
            status_changes = 0
            skipped = 0
            now = datetime.utcnow()
            
            async for case in _db['immigration_cases'].find({'status': 'active', 'notifications_enabled': True}):
                try:
                    current_status = case.get('current_status', '')
                    
                    # Smart polling: check interval based on status priority
                    poll_interval = get_poll_interval(current_status)
                    last_checked = case.get('last_checked')
                    
                    if last_checked:
                        time_since_check = (now - last_checked).total_seconds()
                        if time_since_check < poll_interval:
                            skipped += 1
                            continue
                    
                    if case['case_type'] == 'uscis':
                        result = await check_uscis_status(case['case_number'])
                    else:
                        result = await check_eoir_status(case['case_number'])
                    
                    if not result.get('success'):
                        continue
                    
                    new_status = result.get('status_title', '') if case['case_type'] == 'uscis' else result.get('case_status', '')
                    old_status = case.get('current_status', '')
                    
                    updates = {'last_checked': datetime.utcnow(), 'check_success': True}
                    
                    if new_status and new_status != old_status and old_status:
                        updates['current_status'] = new_status
                        updates['last_description'] = result.get('status_description', '')
                        updates['last_status_change'] = datetime.utcnow()
                        
                        history_entry = {
                            'status': new_status,
                            'description': result.get('status_description', ''),
                            'checked_at': datetime.utcnow().isoformat(),
                            'previous_status': old_status,
                        }
                        
                        await _db['immigration_cases'].update_one(
                            {'_id': case['_id']},
                            {'$set': updates, '$push': {'history': history_entry}}
                        )
                        
                        # Queue push notification
                        await _db['immigration_notifications'].insert_one({
                            'user_id': case['user_id'],
                            'case_id': str(case['_id']),
                            'case_number': case.get('display_number', case['case_number']),
                            'old_status': old_status,
                            'new_status': new_status,
                            'created_at': datetime.utcnow(),
                            'sent': False,
                        })
                        
                        # Send push notification with deep link data
                        # ONLY for subscribed users
                        try:
                            user = await _db['immigration_users'].find_one({'_id': ObjectId(case['user_id'])})
                            if user:
                                # Check if user has active subscription
                                is_subscribed = False
                                collections = await _db.list_collection_names()
                                if "user_subscriptions" in collections:
                                    sub = await _db['user_subscriptions'].find_one({
                                        'user_id': case['user_id'],
                                        'status': 'active',
                                        '$or': [
                                            {'expires_at': None},  # Lifetime subscription
                                            {'expires_at': {'$exists': False}},  # No expiry set
                                            {'expires_at': {'$gte': datetime.utcnow()}}  # Not expired
                                        ]
                                    })
                                    if sub:
                                        is_subscribed = True
                                
                                if is_subscribed:
                                    # Only use expo_push_token (Mi Caso USA specific)
                                    token = user.get('expo_push_token')
                                    if token and isinstance(token, str) and len(token) > 10:
                                        from push_notification_service import get_push_service
                                        ps = get_push_service()
                                        await ps.send_push_notification(
                                            push_tokens=[token],
                                            title=f"📋 {case.get('display_number', case['case_number'])}",
                                            body=f"{old_status} → {new_status}",
                                            data={
                                                "type": "case_status_change",
                                                "case_id": str(case['_id']),
                                                "case_number": case.get('display_number', case['case_number']),
                                            }
                                        )
                                        logger.info(f"📬 Push sent to subscribed user {user.get('email', '?')} for case {case['case_number']}")
                                    else:
                                        logger.info(f"⚠️ Subscribed user {user.get('email', '?')} has no push token")
                                else:
                                    logger.info(f"⏭️ User {user.get('email', '?')} not subscribed, skipping push for case {case['case_number']}")
                        except Exception as pe:
                            logger.warning(f"Push notification error for case {case['case_number']}: {pe}")
                        
                        status_changes += 1
                    else:
                        await _db['immigration_cases'].update_one(
                            {'_id': case['_id']}, {'$set': updates}
                        )
                    
                    cases_checked += 1
                    
                    # Rate limit: wait 2 seconds between checks
                    await asyncio.sleep(2)
                    
                except Exception as e:
                    logger.error(f"Error checking case {case.get('case_number')}: {e}")
            
            logger.info(f"✅ [Immigration] Smart poll: checked={cases_checked}, changes={status_changes}, skipped={skipped}")
        
        except Exception as e:
            logger.error(f"❌ [Immigration] Poll error: {e}")
            await asyncio.sleep(300)


def start_immigration_polling():
    """Start the background polling task"""
    global _poll_task
    if _poll_task is None or _poll_task.done():
        _poll_task = asyncio.create_task(poll_all_cases())
        logger.info("🟢 [Immigration] Background case polling started (every 6 hours)")
    
    # Start USCIS sandbox traffic generator (for production access requirements)
    try:
        from uscis_sandbox_traffic import start_uscis_traffic_scheduler
        start_uscis_traffic_scheduler()
    except Exception as e:
        logger.warning(f"⚠️ USCIS sandbox traffic scheduler failed to start: {e}")



# ═══════════════════════════════════════════════════════════════════
# USER PLAN INFO ENDPOINT
# ═══════════════════════════════════════════════════════════════════

@router.get('/user-plan')
async def get_user_plan_info(request: Request):
    """Get the current user's subscription plan and limits"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    plan_info = await get_user_plan(user_id)
    
    # Count current active cases
    case_count = await _db['immigration_cases'].count_documents({
        'user_id': user_id,
        'status': 'active'
    })
    
    return {
        'success': True,
        'plan': plan_info['plan'],
        'case_limit': plan_info['case_limit'],
        'cases_used': case_count,
        'cases_remaining': max(0, plan_info['case_limit'] - case_count),
        'has_ai': plan_info['has_ai'],
    }


# ═══════════════════════════════════════════════════════════════════
# ALERT SETTINGS & HISTORY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get('/alert-settings')
async def get_alert_settings(request: Request):
    """Get user's alert notification preferences"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    settings = await _db['immigration_alert_settings'].find_one({'user_id': user_id})
    if not settings:
        # Return defaults
        return {
            'success': True,
            'settings': {
                'alerts_enabled': True,
                'quiet_mode': True,
                'quiet_start': '23:00',
                'quiet_end': '07:00',
                'uscis_alerts': True,
                'eoir_alerts': True,
            }
        }
    
    settings.pop('_id', None)
    settings.pop('user_id', None)
    return {'success': True, 'settings': settings}


@router.put('/alert-settings')
async def update_alert_settings(request: Request):
    """Update user's alert notification preferences"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    body = await request.json()
    allowed_fields = ['alerts_enabled', 'quiet_mode', 'quiet_start', 'quiet_end', 'uscis_alerts', 'eoir_alerts']
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    update_data['updated_at'] = datetime.utcnow()
    
    await _db['immigration_alert_settings'].update_one(
        {'user_id': user_id},
        {'$set': update_data, '$setOnInsert': {'user_id': user_id, 'created_at': datetime.utcnow()}},
        upsert=True
    )
    
    return {'success': True, 'message': 'Configuración de alertas actualizada'}


@router.get('/alerts')
async def get_alert_history(request: Request):
    """Get user's alert/notification history"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    alerts = []
    async for alert in _db['immigration_notifications'].find(
        {'user_id': user_id}
    ).sort('created_at', -1).limit(50):
        alert['id'] = str(alert.pop('_id'))
        alerts.append(alert)
    
    # Count unread
    unread = sum(1 for a in alerts if not a.get('read', False))
    high_priority = sum(1 for a in alerts if a.get('priority') == 'high')
    
    return {
        'success': True,
        'alerts': alerts,
        'total': len(alerts),
        'unread': unread,
        'high_priority': high_priority,
    }


@router.put('/alerts/{alert_id}/read')
async def mark_alert_read(alert_id: str, request: Request):
    """Mark an alert as read"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    await _db['immigration_notifications'].update_one(
        {'_id': ObjectId(alert_id), 'user_id': user_id},
        {'$set': {'read': True, 'read_at': datetime.utcnow()}}
    )
    
    return {'success': True}


# ═══════════════════════════════════════════════════════════════════
# LEGAL CONTENT (Terms & Privacy) - Dynamic, editable from admin
# ═══════════════════════════════════════════════════════════════════

@router.get('/legal/{doc_type}')
async def get_legal_content(doc_type: str, lang: str = 'es'):
    """
    Get legal document content (terms or privacy).
    Returns dynamic content if saved in DB, otherwise empty (app uses defaults).
    """
    if doc_type not in ('terms', 'privacy'):
        raise HTTPException(status_code=400, detail="Tipo inválido. Use 'terms' o 'privacy'")
    
    doc = await _db['immigration_legal'].find_one({
        'type': doc_type,
        'lang': lang
    })
    
    if doc:
        return {
            'success': True,
            'content': doc.get('content', ''),
            'updated_at': doc.get('updated_at', '').isoformat() if hasattr(doc.get('updated_at', ''), 'isoformat') else str(doc.get('updated_at', ''))
        }
    
    return {'success': True, 'content': None}



# ── Contact Form & Newsletter ──────────────────────
@router.post("/contact")
async def contact_form(request: Request):
    """Save contact form submission"""
    body = await request.json()
    await _db['contact_messages'].insert_one({
        'name': body.get('name', ''),
        'email': body.get('email', ''),
        'subject': body.get('subject', ''),
        'message': body.get('message', ''),
        'read': False,
        'created_at': datetime.utcnow(),
    })
    return {'success': True, 'message': 'Mensaje recibido'}


@router.post("/newsletter")
async def newsletter_subscribe(request: Request):
    """Subscribe to newsletter"""
    body = await request.json()
    email = body.get('email', '').strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email requerido")
    existing = await _db['newsletter_subscribers'].find_one({'email': email})
    if existing:
        return {'success': True, 'message': 'Ya estás suscrito'}
    await _db['newsletter_subscribers'].insert_one({
        'email': email,
        'subscribed_at': datetime.utcnow(),
        'active': True,
    })
    return {'success': True, 'message': 'Suscripción exitosa'}
