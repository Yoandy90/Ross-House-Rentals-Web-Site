"""
Remaining Small Routes Router
Extracted from server.py - Tax returns, chat, AI service, app version,
admin import stats, system settings, dynamic services, admin passport,
static files, and season import.
"""
import os, logging, uuid, json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from bson import ObjectId

logger = logging.getLogger(__name__)


class TaxReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tax_year: int
    status: str = 'pending'
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    sender_id: str
    sender_name: str
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


remaining_router = APIRouter()
_db = None

def init_remaining_router(db):
    global _db
    _db = db

# Import ai_service at module level
try:
    from ai_service import ai_service
except Exception as _e:
    ai_service = None
    logging.warning(f"⚠️ ai_service not available: {_e}")

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
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
    except:
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


# ================== TAX RETURN ROUTES ==================
# ================== TAX RETURN ROUTES ==================

@remaining_router.get('/tax-returns', response_model=List[TaxReturn])
async def get_tax_returns(current_user: dict = Depends(_get_current_user)):
    query = {'user_id': current_user['id']} if current_user['role'] == 'client' else {}
    returns = await _db.tax_returns.find(query).to_list(100)
    return [TaxReturn(**r) for r in returns]

@remaining_router.post('/tax-returns', response_model=TaxReturn)
async def create_tax_return(tax_return: TaxReturn, current_user: dict = Depends(_get_current_user)):
    tax_return.user_id = current_user['id']
    await _db.tax_returns.insert_one(tax_return.dict())
    return tax_return


@remaining_router.get('/tax-returns/current')
async def get_current_tax_return(current_user: dict = Depends(_get_current_user)):
    """Get the most recent/active tax return for the current user with progress info"""
    try:
        user_id = current_user['id']
        current_year = datetime.now().year
        
        # First, try to find an active/in-progress tax return
        active_return = await _db.tax_returns.find_one({
            'user_id': user_id,
            'status': {'$nin': ['completed', 'filed', 'cancelled']},
            'year': {'$gte': current_year - 1}  # Current or last year
        }, sort=[('year', -1), ('created_at', -1)])
        
        if not active_return:
            # Try seguimiento fiscal
            active_return = await _db.tax_tracking.find_one({
                'user_id': user_id,
                'status': {'$nin': ['completed', 'filed', 'cancelled']}
            }, sort=[('year', -1), ('created_at', -1)])
        
        if not active_return:
            # Check if there's any tax return for this user
            any_return = await _db.tax_returns.find_one({
                'user_id': user_id
            }, sort=[('year', -1), ('created_at', -1)])
            
            if any_return:
                active_return = any_return
        
        if not active_return:
            return {'success': False, 'message': 'No active tax return found'}
        
        # Format the return
        return {
            'success': True,
            'tax_return': {
                'id': str(active_return.get('_id')),
                'year': active_return.get('year') or active_return.get('tax_year') or current_year,
                'status': active_return.get('status', 'pending'),
                'filing_status': active_return.get('filing_status'),
                'created_at': active_return.get('created_at').isoformat() if active_return.get('created_at') else None,
                'updated_at': active_return.get('updated_at').isoformat() if active_return.get('updated_at') else None,
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting current tax return: {e}")
        return {'success': False, 'error': str(e)}



# ================== CHAT ROUTES ==================
# ================== CHAT ROUTES ==================

@remaining_router.get('/chat/history/{room_id}')
async def get_chat_history(room_id: str, current_user: dict = Depends(_get_current_user)):
    messages = await _db.chat_messages.find({'room_id': room_id}).sort('timestamp', -1).limit(100).to_list(100)
    return [ChatMessage(**m).dict() for m in messages]

@remaining_router.post('/chat/ai-message')
async def ai_chat_message(message: str, current_user: dict = Depends(_get_current_user)):
    """Chat with AI assistant"""
    try:
        session_id = f"user_{current_user['id']}"
        response = await ai_service.chat_with_assistant(message, session_id)
        
        # Save both user message and AI response to database
        user_msg = ChatMessage(
            room_id=f"ai_chat_{current_user['id']}",
            sender_id=current_user['id'],
            sender_name=current_user['name'],
            message=message
        )
        await _db.chat_messages.insert_one(user_msg.dict())
        
        ai_msg = ChatMessage(
            room_id=f"ai_chat_{current_user['id']}",
            sender_id='ai_assistant',
            sender_name='Asistente Ross Tax',
            message=response
        )
        await _db.chat_messages.insert_one(ai_msg.dict())
        
        return {'response': response}
    except Exception as e:
        logging.error(f'AI chat error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


class AIChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context_messages: Optional[list] = []


@remaining_router.post('/chat/ai-response')
async def ai_chat_auto_response(request: AIChatRequest, current_user: dict = Depends(_get_current_user)):
    """Get AI auto-response for support chat - acts as first responder before human agent"""
    try:
        user_name = current_user.get('name', current_user.get('first_name', ''))
        session_id = f"support_chat_{current_user['id']}"
        
        # Build chat history context for better responses
        chat_history = []
        if request.context_messages:
            for msg in request.context_messages[-8:]:
                chat_history.append({
                    'role': msg.get('sender_role', 'client'),
                    'content': msg.get('content', '')
                })
        
        response = await ai_service.chat_with_assistant(
            request.message, 
            session_id,
            chat_history
        )
        
        return {
            'response': response,
            'is_ai': True,
            'sender_name': 'Ross AI'
        }
    except Exception as e:
        logging.error(f'AI auto-response error: {str(e)}')
        # Return a fallback response instead of failing
        return {
            'response': 'Gracias por tu mensaje. Un agente humano te responderá pronto. Mientras tanto, puedes explorar nuestras funciones en la app.',
            'is_ai': True,
            'is_fallback': True,
            'sender_name': 'Ross AI'
        }


# ================== AI SERVICE ROUTES ==================
# ================== AI SERVICE ROUTES ==================

@remaining_router.post('/ai/categorize-document')
async def categorize_document_endpoint(document_name: str, document_text: Optional[str] = None, current_user: dict = Depends(_get_current_user)):
    """Auto-categorize a document"""
    try:
        category = await ai_service.categorize_document(document_name, document_text)
        return {'category': category}
    except Exception as e:
        logging.error(f'Document categorization error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


class DocumentVisionRequest(BaseModel):
    image_base64: str
    document_name: Optional[str] = ""


@remaining_router.post('/ai/categorize-document-vision')
async def categorize_document_vision_endpoint(
    request: DocumentVisionRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Auto-categorize a document using AI vision to analyze the actual image"""
    try:
        result = await ai_service.categorize_document_with_vision(
            request.image_base64, 
            request.document_name
        )
        return result
    except Exception as e:
        logging.error(f'Document vision categorization error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@remaining_router.post('/ai/analyze-document')
async def analyze_document_endpoint(document_name: str, document_content: str, current_user: dict = Depends(_get_current_user)):
    """Analyze document and extract key information"""
    try:
        analysis = await ai_service.analyze_document(document_name, document_content)
        return analysis
    except Exception as e:
        logging.error(f'Document analysis error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@remaining_router.get('/ai/suggest-documents/{tax_year}')
async def suggest_missing_documents_endpoint(tax_year: int, current_user: dict = Depends(_get_current_user)):
    """Get suggestions for missing documents"""
    try:
        # Get user's existing documents
        docs = await _db.documents.find({'user_id': current_user['id']}).to_list(100)
        existing_categories = [doc.get('category', 'other') for doc in docs]
        
        suggestions = await ai_service.suggest_missing_documents(tax_year, existing_categories)
        return {'suggestions': suggestions}
    except Exception as e:
        logging.error(f'Document suggestions error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== APP VERSION CONTROL ==================
# ================== APP VERSION CONTROL ==================

@remaining_router.get('/app-version')
async def get_app_version():
    """Get current app version requirements"""
    # Get version config from database
    version_config = await _db.app_version.find_one({'_id': 'current'})
    
    if not version_config:
        # Default version if none exists
        return {
            'current_version': '1.0.0',
            'minimum_version': '1.0.0',
            'force_update': False,
            'update_message': 'Una nueva versión está disponible',
            'ios_url': 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX',
            'android_url': 'https://play.google.com/store/apps/your-app-link',
        }
    
    return {
        'current_version': version_config.get('current_version', '1.0.0'),
        'minimum_version': version_config.get('minimum_version', '1.0.0'),
        'force_update': version_config.get('force_update', False),
        'update_message': version_config.get('update_message', 'Una nueva versión está disponible'),
        'ios_url': version_config.get('ios_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX'),
        'android_url': version_config.get('android_url', 'https://play.google.com/store/apps/your-app-link'),
    }

@remaining_router.post('/admin/app-version')
async def update_app_version(version_data: dict, current_user: dict = Depends(_get_current_user)):
    """Update app version configuration (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    version_config = {
        '_id': 'current',
        'current_version': version_data.get('current_version', '1.0.0'),
        'minimum_version': version_data.get('minimum_version', '1.0.0'),
        'force_update': version_data.get('force_update', False),
        'update_message': version_data.get('update_message', 'Una nueva versión está disponible'),
        'ios_url': version_data.get('ios_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX'),
        'android_url': version_data.get('android_url', 'https://play.google.com/store/apps/your-app-link'),
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'updated_by': current_user['id'],
    }
    
    await _db.app_version.replace_one(
        {'_id': 'current'},
        version_config,
        upsert=True
    )
    
    return {'message': 'App version updated successfully'}


# ================== ADMIN IMPORT STATS ==================
# ================== ADMIN - IMPORT STATS (MUST BE BEFORE DYNAMIC ROUTES) ==================

@remaining_router.get('/admin/clients/import-stats')
async def get_client_import_stats(current_user: dict = Depends(_get_current_user)):
    """Get statistics about imported clients - MUST BE BEFORE /admin/clients/{user_id}"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        total_clients = await _db.users.count_documents({'role': 'client'})
        csv_imported = await _db.users.count_documents({'role': 'client', 'source': 'csv_import'})
        excel_imported = await _db.users.count_documents({'role': 'client', 'source': {'$regex': 'excel', '$options': 'i'}})
        manual = max(0, total_clients - csv_imported - excel_imported)
        
        return {
            'total': total_clients,
            'csv_imported': csv_imported,
            'excel_imported': excel_imported,
            'manual': manual
        }
    except Exception as e:
        logging.error(f"Error getting import stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== SYSTEM SETTINGS ENDPOINTS ==================
# ================== SYSTEM SETTINGS ENDPOINTS ==================

@remaining_router.get('/admin/settings')
async def get_system_settings(current_user: dict = Depends(_get_current_user)):
    """Get all system settings (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Get settings from database
        settings_doc = await _db.system_settings.find_one({'_id': 'main'})
        
        if not settings_doc:
            # Return default settings
            settings_doc = {'settings': {}}
        
        settings = settings_doc.get('settings', {})
        
        # Mask sensitive fields
        masked_settings = {}
        sensitive_fields = ['stripe_secret_key', 'stripe_webhook_secret', 'twilio_auth_token', 
                           'sendgrid_api_key', 'whatsapp_access_token', 'google_client_secret',
                           'vapi_api_key', 'google_maps_api_key', 'nmi_security_key',
                           'plaid_secret', 'sentry_dsn', 'gemini_api_key']
        
        for key, value in settings.items():
            if key in sensitive_fields and value and len(str(value)) > 4:
                masked_settings[key] = '****' + str(value)[-4:]
            else:
                masked_settings[key] = value
        
        return {'success': True, 'settings': masked_settings}
        
    except Exception as e:
        logging.error(f'Error getting settings: {e}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== DYNAMIC SERVICES ENDPOINTS ==================
# ============== DYNAMIC SERVICES ENDPOINTS ==============

# One-time endpoint to update passport service - remove after use
@remaining_router.post('/update-passport-service-name')
async def update_passport_service_name():
    """One-time update to change Pasaporte Cubano to Trámites de Pasaporte"""
    try:
        result = await _db.dynamic_services.update_one(
            {'service_type': 'passport_services'},
            {
                '$set': {
                    'title': 'Trámites de Pasaporte',
                    'name': 'Trámites de Pasaporte',
                    'description': 'Solicitud y renovación de pasaportes',
                    'short_description': 'Pasaportes de diferentes nacionalidades',
                    'service_type': 'passport_services',
                    'icon': 'document-text',
                    'color': '#1a365d'
                }
            }
        )
        if result.modified_count > 0:
            return {'success': True, 'message': 'Service updated to Trámites de Pasaporte'}
        else:
            # Try by service_type passport_cuban
            result2 = await _db.dynamic_services.update_one(
                {'service_type': 'passport_cuban'},
                {
                    '$set': {
                        'title': 'Trámites de Pasaporte',
                        'name': 'Trámites de Pasaporte',
                        'description': 'Solicitud y renovación de pasaportes',
                        'short_description': 'Pasaportes de diferentes nacionalidades',
                        'service_type': 'passport_services',
                        'icon': 'document-text',
                        'color': '#1a365d'
                    }
                }
            )
            return {'success': result2.modified_count > 0, 'message': f'Updated {result2.modified_count} by service_type'}
    except Exception as e:
        logging.error(f"Error updating passport service: {e}")
        return {'success': False, 'error': str(e)}


# ================== ADMIN PASSPORT APPLICATIONS ==================
# ============== ADMIN PASSPORT APPLICATIONS ==============
@remaining_router.get('/admin/passport-applications')
async def admin_get_all_passport_applications(
    current_user: dict = Depends(_get_current_user),
    status: Optional[str] = None,
    limit: int = 50
):
    """Admin: Get all passport applications"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = {'service_type': 'passport_cuban'}
        if status:
            query['status'] = status
        
        applications = await _db.service_orders.find(query).sort('created_at', -1).to_list(limit)
        
        result = []
        for app in applications:
            user = await _db.users.find_one({'_id': ObjectId(app['user_id'])}) if ObjectId.is_valid(app.get('user_id', '')) else None
            
            result.append({
                'id': str(app['_id']),
                'status': app.get('status', 'pending'),
                'tramite_type': app.get('tramite_type', ''),
                'amount': app.get('amount', 0),
                'client_info': app.get('client_info', {}),
                'user_email': user.get('email') if user else 'N/A',
                'user_name': user.get('name') if user else 'N/A',
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at'),
                'has_documents': bool(app.get('documents', {}).get('foto_pasaporte'))
            })
        
        return {'applications': result, 'count': len(result)}
    except Exception as e:
        logging.error(f"Error getting admin passport applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== STATIC FILES ==================
# ============== STATIC FILES ==============

# =====================================================

