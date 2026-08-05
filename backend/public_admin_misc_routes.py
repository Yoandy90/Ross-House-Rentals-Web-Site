"""
Public & Admin Misc Routes Router
Extracted from server.py - Handles scratch cards, public company info,
AI Ross configuration, passport applications, and client import/export.
"""
import os, logging, uuid, json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from pydantic import BaseModel, Field
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

def init_public_admin_misc_router(db):
    global _db
    _db = db

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


# ================== SCRATCH CARDS ENDPOINTS ==================
# ================== SCRATCH CARDS ENDPOINTS ==================

import random

SCRATCH_CARD_TYPES = {
    'basic': {
        'name': 'Raspadito Básico',
        'price': 10,
        'prizes': {
            'Lose': 70,  # 70% probability
            '$5': 15,    # 15% probability
            '$10': 10,   # 10% probability  
            '$25': 4,    # 4% probability
            '$50': 1,    # 1% probability
        }
    },
    'premium': {
        'name': 'Raspadito Premium',
        'price': 25,
        'prizes': {
            'Lose': 60,  # 60% probability
            '$10': 20,   # 20% probability
            '$25': 12,   # 12% probability
            '$50': 6,    # 6% probability
            '$100': 1.5, # 1.5% probability
            '$250': 0.5, # 0.5% probability
        }
    },
    'gold': {
        'name': 'Raspadito de Oro',
        'price': 50,
        'prizes': {
            'Lose': 50,  # 50% probability
            '$25': 25,   # 25% probability
            '$50': 15,   # 15% probability
            '$100': 7,   # 7% probability
            '$250': 2.5, # 2.5% probability
            '$500': 0.4, # 0.4% probability
            '$1000': 0.1,# 0.1% probability
        }
    }
}

def select_prize(card_type: str) -> str:
    """Select a prize based on probabilities"""
    prizes_config = SCRATCH_CARD_TYPES[card_type]['prizes']
    prizes = list(prizes_config.keys())
    weights = list(prizes_config.values())
    
    selected = random.choices(prizes, weights=weights, k=1)[0]
    return selected


@router.post('/scratch-cards/purchase')
async def purchase_scratch_card(
    purchase_data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Purchase a scratch card"""
    try:
        card_type = purchase_data.get('card_type')
        
        if card_type not in SCRATCH_CARD_TYPES:
            raise HTTPException(status_code=400, detail='Tipo de raspadito inválido')
        
        card_config = SCRATCH_CARD_TYPES[card_type]
        price = card_config['price']
        
        # Check user balance
        user = await _db.users.find_one({'_id': current_user['id']})
        if not user:
            raise HTTPException(status_code=404, detail='Usuario no encontrado')
        
        current_balance = user.get('wallet_balance', 0)
        if current_balance < price:
            return {
                'success': False,
                'message': f'Saldo insuficiente. Necesitas {price} créditos.'
            }
        
        # Deduct credits
        new_balance = current_balance - price
        await _db.users.update_one(
            {'_id': current_user['id']},
            {'$set': {'wallet_balance': new_balance}}
        )
        
        # Record transaction
        await _db.credit_transactions.insert_one({
            'user_id': current_user['id'],
            'type': 'debit',
            'amount': price,
            'description': f'Compra de {card_config["name"]}',
            'category': 'scratch_card',
            'created_at': datetime.now(timezone.utc),
            'balance_after': new_balance
        })
        
        # Determine prize
        prize = select_prize(card_type)
        
        # Create scratch card record
        card_id = str(uuid.uuid4())
        card_doc = {
            '_id': card_id,
            'user_id': current_user['id'],
            'card_type': card_type,
            'card_name': card_config['name'],
            'price_paid': price,
            'prize': prize,
            'scratched': False,
            'created_at': datetime.now(timezone.utc),
            'scratched_at': None
        }
        
        await _db.scratch_cards.insert_one(card_doc)
        
        # If won, credit the prize
        if prize != 'Lose':
            prize_amount = int(prize.replace('$', ''))
            new_balance_after_win = new_balance + prize_amount
            
            await _db.users.update_one(
                {'_id': current_user['id']},
                {'$set': {'wallet_balance': new_balance_after_win}}
            )
            
            await _db.credit_transactions.insert_one({
                'user_id': current_user['id'],
                'type': 'credit',
                'amount': prize_amount,
                'description': f'Premio de {card_config["name"]}: {prize}',
                'category': 'scratch_card_win',
                'created_at': datetime.now(timezone.utc),
                'balance_after': new_balance_after_win
            })
            
            # Create notification
            try:
                await create_notification(
                    user_id=current_user['id'],
                    title='🎉 ¡Ganaste!',
                    body=f'Ganaste {prize} en tu raspadito {card_config["name"]}',
                    type='prize',
                    data={'card_id': card_id, 'prize': prize}
                )
            except:
                pass
        
        return {
            'success': True,
            'message': 'Raspadito comprado exitosamente',
            'card': {
                'id': card_id,
                'type': card_type,
                'name': card_config['name'],
                'prize': prize,
                'created_at': card_doc['created_at'].isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error purchasing scratch card: {str(e)}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/scratch-cards/my-cards')
async def get_my_scratch_cards(
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(_get_current_user)
):
    """Get user's scratch card history"""
    try:
        cards = await _db.scratch_cards.find(
            {'user_id': current_user['id']}
        ).sort('created_at', -1).limit(limit).to_list(limit)
        
        formatted_cards = []
        for card in cards:
            formatted_cards.append({
                'id': card['_id'],
                'type': card.get('card_type'),
                'name': card.get('card_name'),
                'price_paid': card.get('price_paid'),
                'prize': card.get('prize'),
                'scratched': card.get('scratched', True),
                'created_at': card['created_at'].isoformat() if isinstance(card['created_at'], datetime) else card['created_at']
            })
        
        return {
            'success': True,
            'cards': formatted_cards,
            'total': len(formatted_cards)
        }
        
    except Exception as e:
        logging.error(f'Error getting scratch cards: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== PUBLIC COMPANY INFO ==================
# ================== PUBLIC COMPANY INFO ==================

@router.get('/public/company-info')
async def get_public_company_info():
    """Get public company information (no auth required)"""
    try:
        # Get settings from database
        settings_doc = await _db.system_settings.find_one({'_id': 'main'})
        settings = settings_doc.get('settings', {}) if settings_doc else {}
        
        # Only return public-safe fields with defaults
        company_info = {
            'name': settings.get('business_name', 'Ross Tax Preparation'),
            'legal_name': settings.get('business_legal_name', 'Ross Tax Preparation LLC'),
            'address': settings.get('business_address', '305 Bruce Ave, Dumas, TX 79029'),
            'phone': settings.get('business_phone', '(806) 934-2018'),
            'email': settings.get('business_email', 'info@rosstaxpreparation.com'),
            'website': settings.get('business_website', 'https://rosstaxpreparation.com'),
            'facebook': settings.get('facebook_url', 'https://facebook.com/profile.php?id=61569473257694'),
            'instagram': settings.get('instagram_url', 'https://instagram.com/ross_tax_preparation'),
            'whatsapp': settings.get('whatsapp_number', '+18069342018'),
            'hours': {
                'weekdays': settings.get('hours_weekdays', '9:00 AM - 6:00 PM'),
                'saturday': settings.get('hours_saturday', '10:00 AM - 2:00 PM'),
                'sunday': settings.get('hours_sunday', 'Cerrado'),
                'timezone': settings.get('timezone', 'CST')
            },
            'app_links': {
                'ios': settings.get('app_store_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX'),
                'android': settings.get('play_store_url', '')
            }
        }
        
        return {'success': True, 'company': company_info}
        
    except Exception as e:
        logging.error(f'Error getting company info: {e}')
        # Return defaults on error
        return {
            'success': True,
            'company': {
                'name': 'Ross Tax Preparation',
                'legal_name': 'Ross Tax Preparation LLC',
                'address': '305 Bruce Ave, Dumas, TX 79029',
                'phone': '(806) 934-2018',
                'email': 'info@rosstaxpreparation.com',
                'website': 'https://rosstaxpreparation.com',
                'facebook': 'https://facebook.com/profile.php?id=61569473257694',
                'instagram': 'https://instagram.com/ross_tax_preparation',
                'whatsapp': '+18069342018',
                'hours': {
                    'weekdays': '9:00 AM - 6:00 PM',
                    'saturday': '10:00 AM - 2:00 PM',
                    'sunday': 'Cerrado',
                    'timezone': 'CST'
                },
                'app_links': {
                    'ios': 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX',
                    'android': ''
                }
            }
        }


@router.put('/admin/settings')
async def update_system_settings(data: dict, current_user: dict = Depends(_get_current_user)):
    """Update system settings (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        new_settings = data.get('settings', {})
        
        # Get existing settings
        existing_doc = await _db.system_settings.find_one({'_id': 'main'})
        existing_settings = existing_doc.get('settings', {}) if existing_doc else {}
        
        # Don't overwrite masked values
        for key, value in new_settings.items():
            if value and str(value).startswith('****'):
                new_settings[key] = existing_settings.get(key, '')
        
        # Merge settings
        merged_settings = {**existing_settings, **new_settings}
        
        # Update in database
        await _db.system_settings.update_one(
            {'_id': 'main'},
            {
                '$set': {
                    'settings': merged_settings,
                    'updated_at': datetime.now(timezone.utc),
                    'updated_by': str(current_user.get('_id', ''))
                }
            },
            upsert=True
        )
        
        # Also update api_config for backward compatibility
        api_config_updates = {}
        
        # Map settings to api_config fields
        field_mapping = {
            'stripe_secret_key': 'stripe_secret_key',
            'stripe_publishable_key': 'stripe_publishable_key',
            'stripe_webhook_secret': 'stripe_webhook_secret',
            'twilio_account_sid': 'twilio_account_sid',
            'twilio_auth_token': 'twilio_auth_token',
            'twilio_phone_number': 'twilio_phone_number',
            'sendgrid_api_key': 'sendgrid_api_key',
            'whatsapp_phone_number_id': 'whatsapp_phone_number_id',
            'whatsapp_access_token': 'whatsapp_access_token',
            'whatsapp_business_account_id': 'whatsapp_business_account_id',
            'google_client_id': 'google_calendar_client_id',
            'google_client_secret': 'google_calendar_client_secret',
            'vapi_api_key': 'vapi_api_key',
            'vapi_phone_number': 'vapi_phone_number',
            'vapi_phone_number_id': 'vapi_phone_number_id',
            'google_maps_api_key': 'google_maps_api_key',
            'nmi_security_key': 'nmi_security_key',
            'merchant_one_api_url': 'merchant_one_api_url',
            'plaid_client_id': 'plaid_client_id',
            'plaid_secret': 'plaid_secret',
            'plaid_environment': 'plaid_environment',
            'sentry_dsn': 'sentry_dsn',
            'gemini_api_key': 'gemini_api_key',
        }
        
        for settings_key, config_key in field_mapping.items():
            if settings_key in merged_settings and merged_settings[settings_key]:
                api_config_updates[config_key] = merged_settings[settings_key]
        
        if api_config_updates:
            await _db.api_config.update_one(
                {'_id': 'main'},
                {'$set': api_config_updates},
                upsert=True
            )
        
        # Clear WhatsApp credentials cache if WhatsApp settings were updated
        whatsapp_keys = ['whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_business_account_id']
        if any(key in new_settings for key in whatsapp_keys):
            if whatsapp_service:
                whatsapp_service.clear_credentials_cache()
                logging.info('🔄 WhatsApp credentials cache cleared after settings update')
        
        logging.info(f'✅ System settings updated by {current_user.get("email")}')
        
        return {'success': True, 'message': 'Settings updated successfully'}
        
    except Exception as e:
        logging.error(f'Error updating settings: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/settings/payment-methods')
async def get_payment_methods_settings(current_user: dict = Depends(_get_current_user)):
    """Get alternative payment methods settings"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        settings_doc = await _db.payment_settings.find_one({'_id': 'alternative_methods'})
        
        default_settings = {
            'zelle_email': 'yoandyross@gmail.com',
            'venmo_username': '@RossTaxPrep',
            'cashapp_username': '$RossTaxPrep',
            'paypal_link': 'paypal.me/rosstaxprep'
        }
        
        if settings_doc:
            settings = {**default_settings, **settings_doc.get('settings', {})}
        else:
            settings = default_settings
        
        return {'success': True, 'settings': settings}
        
    except Exception as e:
        logging.error(f'Error getting payment settings: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/settings/payment-methods')
async def update_payment_methods_settings(data: dict, current_user: dict = Depends(_get_current_user)):
    """Update alternative payment methods settings"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        settings = data.get('settings', {})
        
        await _db.payment_settings.update_one(
            {'_id': 'alternative_methods'},
            {
                '$set': {
                    'settings': settings,
                    'updated_at': datetime.now(timezone.utc),
                    'updated_by': str(current_user.get('id', current_user.get('_id', '')))
                }
            },
            upsert=True
        )
        
        logging.info(f'✅ Payment methods settings updated by {current_user.get("email")}')
        
        return {'success': True, 'message': 'Payment settings saved'}
        
    except Exception as e:
        logging.error(f'Error updating payment settings: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/app/settings')
async def get_app_settings():
    """Get public app settings (for mobile app)"""
    try:
        settings_doc = await _db.system_settings.find_one({'_id': 'main'})
        settings = settings_doc.get('settings', {}) if settings_doc else {}
        
        # Return only public fields
        public_settings = {
            'business_name': settings.get('business_name', 'Ross Tax Preparation'),
            'business_address': settings.get('business_address', '305 Bruce Ave, Dumas, TX 79029'),
            'business_phone': settings.get('business_phone', '(806) 934-2018'),
            'business_email': settings.get('business_email', 'yoandyross@gmail.com'),
            'app_store_url': settings.get('app_store_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120'),
            'play_store_url': settings.get('play_store_url', 'https://play.google.com/store/apps/details?id=com.rosstax.app'),
            'stripe_publishable_key': settings.get('stripe_publishable_key', ''),
        }
        
        return {'success': True, 'settings': public_settings}
        
    except Exception as e:
        logging.error(f'Error getting app settings: {e}')
        return {'success': True, 'settings': {}}




# ================== AI ROSS CONFIGURATION ENDPOINTS ==================
# ================== AI ROSS CONFIGURATION ENDPOINTS ==================

class AIRossConfig(BaseModel):
    enabled: bool = True
    auto_appointment: bool = True
    slot_cascade: bool = True
    language: str = "es"
    document_email: str = "docu@rosstaxpreparation.com"
    office_address: str = "305 Bruce Ave, Dumas, TX 79029"
    office_phone: str = "(806) 934-2018"
    office_hours: str = "Lunes-Viernes 9:00 AM - 6:00 PM"

@router.get('/admin/ai-ross/config')
async def get_ai_ross_config(current_user: dict = Depends(_require_admin)):
    """Get AI Ross configuration"""
    try:
        config = await _db.ai_ross_config.find_one({'_id': 'main'})
        if not config:
            # Return default config
            default_config = AIRossConfig()
            return {'config': default_config.dict()}
        
        # Remove MongoDB _id from response
        config.pop('_id', None)
        return {'config': config}
    except Exception as e:
        logging.error(f"Error getting AI Ross config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/admin/ai-ross/config')
async def update_ai_ross_config(config: AIRossConfig, current_user: dict = Depends(_require_admin)):
    """Update AI Ross configuration"""
    try:
        config_dict = config.dict()
        config_dict['updated_at'] = datetime.now(timezone.utc)
        config_dict['updated_by'] = current_user.get('email', 'admin')
        
        await _db.ai_ross_config.update_one(
            {'_id': 'main'},
            {'$set': config_dict},
            upsert=True
        )
        
        logging.info(f"✅ AI Ross config updated by {current_user.get('email')}")
        return {'success': True, 'message': 'Configuración guardada correctamente'}
    except Exception as e:
        logging.error(f"Error updating AI Ross config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/admin/ai-ross/stats')
async def get_ai_ross_stats(current_user: dict = Depends(_require_admin)):
    """Get AI Ross statistics"""
    try:
        # Get stats from whatsapp_messages collection
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Total conversations (unique phone numbers)
        total_conversations = await _db.whatsapp_messages.distinct('phone_number')
        
        # Messages today
        messages_today = await _db.whatsapp_messages.count_documents({
            'created_at': {'$gte': today}
        })
        
        # Appointments booked by AI
        appointments_booked = await _db.appointments.count_documents({
            'booked_via': 'whatsapp_ai'
        })
        
        # Slot offers from cascade system
        slot_offers_sent = await _db.slot_offers.count_documents({})
        slot_offers_accepted = await _db.slot_offers.count_documents({
            'status': 'accepted'
        })
        
        stats = {
            'total_conversations': len(total_conversations) if total_conversations else 0,
            'appointments_booked': appointments_booked,
            'slot_offers_sent': slot_offers_sent,
            'slot_offers_accepted': slot_offers_accepted,
            'messages_today': messages_today
        }
        
        return {'stats': stats}
    except Exception as e:
        logging.error(f"Error getting AI Ross stats: {e}")
        return {'stats': {
            'total_conversations': 0,
            'appointments_booked': 0,
            'slot_offers_sent': 0,
            'slot_offers_accepted': 0,
            'messages_today': 0
        }}

class AITestMessage(BaseModel):
    message: str

@router.post('/admin/ai-ross/test')
async def test_ai_ross(request: AITestMessage, current_user: dict = Depends(_require_admin)):
    """Test AI Ross with a sample message"""
    try:
        # Get AI config
        config = await _db.ai_ross_config.find_one({'_id': 'main'})
        if config and not config.get('enabled', True):
            return {'response': '⚠️ AI Ross está desactivada. Actívala primero para probar.'}
        
        # Try to use the AI service - use unique session per call to avoid history buildup
        import uuid
        try:
            from ai_service import ai_service
            unique_session = f'test_admin_{uuid.uuid4().hex[:8]}'
            response = await ai_service.chat_with_assistant(
                user_message=request.message,
                session_id=unique_session
            )
            return {'response': response}
        except Exception as ai_error:
            logging.error(f"AI service error: {ai_error}")
            return {'response': f'⚠️ Error del servicio AI: {str(ai_error)}'}
        
    except Exception as e:
        logging.error(f"Error testing AI Ross: {e}")
        return {'response': f'Error: {str(e)}'}



# ================== PASSPORT APPLICATION ENDPOINTS ==================
# ============== PASSPORT APPLICATION ENDPOINTS ==============

class PassportDraftRequest(BaseModel):
    form_data: dict

# =====================================================================
# SUBSCRIPTION SYSTEM (Extracted to subscription_routes.py)
# =====================================================================

class PassportSubmitRequest(BaseModel):
    form_data: dict
    draft_id: Optional[str] = None
    price: float

@router.get('/passport-applications/draft')
async def get_passport_draft(current_user: dict = Depends(_get_current_user)):
    """Get user's passport application draft"""
    try:
        draft = await _db.passport_drafts.find_one({
            'user_id': current_user['id'],
            'status': 'draft'
        })
        
        if draft:
            return {
                'draft': {
                    'id': str(draft['_id']),
                    'form_data': draft.get('form_data', {}),
                    'last_step': draft.get('last_step', 1)
                }
            }
        return {'draft': None}
    except Exception as e:
        logging.error(f"Error getting passport draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/passport-applications/draft')
async def save_passport_draft(
    request: PassportDraftRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Save passport application draft"""
    try:
        draft_data = {
            'user_id': current_user['id'],
            'form_data': request.form_data,
            'last_step': request.last_step,
            'status': 'draft',
            'updated_at': datetime.utcnow()
        }
        
        if request.draft_id and ObjectId.is_valid(request.draft_id):
            # Update existing draft
            await _db.passport_drafts.update_one(
                {'_id': ObjectId(request.draft_id), 'user_id': current_user['id']},
                {'$set': draft_data}
            )
            draft_id = request.draft_id
        else:
            # Create new draft
            draft_data['created_at'] = datetime.utcnow()
            result = await _db.passport_drafts.insert_one(draft_data)
            draft_id = str(result.inserted_id)
        
        return {'success': True, 'draft_id': draft_id}
    except Exception as e:
        logging.error(f"Error saving passport draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/passport-applications/submit')
async def submit_passport_application(
    request: PassportSubmitRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Submit passport application and create service order"""
    try:
        form_data = request.form_data
        
        # Create service order
        order_data = {
            'user_id': current_user['id'],
            'service_type': 'passport_cuban',
            'service_name': 'Solicitud de Pasaporte Cubano',
            'status': 'pending_payment',
            'amount': request.price,
            'form_data': form_data,
            'client_info': {
                'nombre': f"{form_data.get('primer_nombre', '')} {form_data.get('segundo_nombre', '')}".strip(),
                'apellidos': f"{form_data.get('primer_apellido', '')} {form_data.get('segundo_apellido', '')}".strip(),
                'telefono': form_data.get('telefono', ''),
                'email': form_data.get('email', current_user.get('email', '')),
            },
            'tramite_type': form_data.get('tramite_type', ''),
            'documents': {
                'foto_pasaporte': form_data.get('foto_pasaporte'),
                'firma_digital': form_data.get('firma_digital'),
                'documento_identidad': form_data.get('documento_identidad'),
                'acta_nacimiento': form_data.get('acta_nacimiento'),
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await _db.service_orders.insert_one(order_data)
        order_id = str(result.inserted_id)
        
        # Update draft status if exists
        if request.draft_id and ObjectId.is_valid(request.draft_id):
            await _db.passport_drafts.update_one(
                {'_id': ObjectId(request.draft_id)},
                {'$set': {'status': 'submitted', 'order_id': order_id, 'updated_at': datetime.utcnow()}}
            )
        
        logging.info(f"🛂 Passport application submitted: {order_id} by user {current_user['id']}")
        
        return {
            'success': True,
            'order_id': order_id,
            'message': 'Solicitud creada exitosamente'
        }
    except Exception as e:
        logging.error(f"Error submitting passport application: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/passport-applications/preview-pdf')
async def generate_passport_preview_pdf(
    form_data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Generate PDF preview from form data without saving"""
    try:
        from passport_pdf_service import generate_passport_pdf
        from fastapi.responses import Response
        import base64
        
        # Convert date parts to formatted date
        if form_data.get('fecha_nacimiento_dia') and form_data.get('fecha_nacimiento_mes') and form_data.get('fecha_nacimiento_año'):
            form_data['fecha_nacimiento'] = f"{form_data['fecha_nacimiento_dia']}/{form_data['fecha_nacimiento_mes']}/{form_data['fecha_nacimiento_año']}"
        
        # Generate PDF
        pdf_bytes = generate_passport_pdf(form_data, f"PREVIEW-{current_user['id'][:8]}")
        
        # Return as base64 for mobile app
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            'success': True,
            'pdf_base64': pdf_base64,
            'filename': f"vista_previa_pasaporte.pdf"
        }
    except Exception as e:
        logging.error(f"Error generating passport preview PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/passport-applications')
async def get_passport_applications(
    current_user: dict = Depends(_get_current_user),
    status: Optional[str] = None
):
    """Get user's passport applications"""
    try:
        query = {'user_id': current_user['id'], 'service_type': 'passport_cuban'}
        if status:
            query['status'] = status
            
        applications = await _db.service_orders.find(query).sort('created_at', -1).to_list(50)
        
        result = []
        for app in applications:
            result.append({
                'id': str(app['_id']),
                'status': app.get('status', 'pending'),
                'tramite_type': app.get('tramite_type', ''),
                'amount': app.get('amount', 0),
                'client_info': app.get('client_info', {}),
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at')
            })
        
        return {'applications': result, 'count': len(result)}
    except Exception as e:
        logging.error(f"Error getting passport applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/passport-applications/{application_id}/pdf')
async def generate_passport_pdf_endpoint(
    application_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Generate PDF for passport application"""
    try:
        from passport_pdf_service import generate_passport_pdf
        from fastapi.responses import Response
        
        if not ObjectId.is_valid(application_id):
            raise HTTPException(status_code=400, detail="Invalid application ID")
        
        # Get application
        application = await _db.service_orders.find_one({
            '_id': ObjectId(application_id),
            'service_type': 'passport_cuban'
        })
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Check authorization (user or admin)
        if application['user_id'] != current_user['id'] and current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Not authorized")
        
        form_data = application.get('form_data', {})
        
        # Generate PDF
        pdf_bytes = generate_passport_pdf(form_data, application_id)
        
        # Return PDF as downloadable file
        filename = f"solicitud_pasaporte_{application_id[:8]}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating passport PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# REFERRAL SYSTEM V2 ENDPOINTS
# =====================================================

# Referral Service V2 initialization moved to server.py

# ═ DUPLICATE REFERRAL ENDPOINTS REMOVED (originals at ~line 23898) ═



# ================== CLIENT IMPORT/EXPORT ==================
# ============== CLIENT IMPORT/EXPORT ==============

import csv
import io
from fastapi.responses import StreamingResponse

# (duplicate export-csv function removed - original exists earlier in server.py)
# (duplicate import-csv function removed - original exists earlier in server.py)
# (duplicate import-stats function removed - original exists earlier in server.py)

@router.get('/admin/clients/csv-template')
async def download_csv_template(current_user: dict = Depends(_get_current_user)):
    """Download a sample CSV template for client import"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header row with descriptions
        headers = [
            'first_name', 'last_name', 'email', 'phone', 
            'address', 'city', 'state', 'zip_code',
            'birthdate', 'notes'
        ]
        writer.writerow(headers)
        
        # Sample data rows
        writer.writerow([
            'Juan', 'Pérez García', 'juan.perez@email.com', '+18065551234',
            '123 Main St', 'Dalhart', 'TX', '79022',
            '01/15/1985', 'Cliente VIP'
        ])
        writer.writerow([
            'María', 'López Rodríguez', 'maria.lopez@email.com', '+18065555678',
            '456 Oak Ave', 'Dalhart', 'TX', '79022',
            '03/20/1990', ''
        ])
        writer.writerow([
            'Carlos', 'Hernández', 'carlos.h@email.com', '+18065559012',
            '789 Elm St Apt 2B', 'Amarillo', 'TX', '79101',
            '07/10/1978', 'Referido por Juan Pérez'
        ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=plantilla_clientes.csv"
            }
        )
    except Exception as e:
        logging.error(f"Error generating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))



