"""
Referral Routes Router
Extracted from server.py for modularization.
Handles referral code management, friend recommendations, admin referral operations, and reward tiers.
"""
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

referral_router = APIRouter()
_db = None
_referral_service = None
_notification_service = None


def init_referral_router(db, referral_service=None, notification_service=None):
    global _db, _referral_service, _notification_service
    _db = db
    _referral_service = referral_service
    _notification_service = notification_service


def update_referral_service(referral_service):
    """Update referral service after startup initialization"""
    global _referral_service
    _referral_service = referral_service


def update_notification_service(notification_service):
    """Update notification service after startup initialization"""
    global _notification_service
    _notification_service = notification_service


# ================== Auth helpers ==================

async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        from datetime import timezone
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(tz=expires_at.tzinfo if expires_at.tzinfo else None):
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def _require_admin(request: Request):
    """Require admin role"""
    user = await _auth_user(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return user


# ================== Pydantic Models ==================

class RecommendFriendRequest(BaseModel):
    friend_name: str
    friend_phone: str


class ValidateReferralCodeRequest(BaseModel):
    code: str


class CreateRewardTierRequest(BaseModel):
    min_referrals: int
    max_referrals: int
    reward_amount_usd: float


class UpdateRewardTierRequest(BaseModel):
    min_referrals: Optional[int] = None
    max_referrals: Optional[int] = None
    reward_amount_usd: Optional[float] = None
    is_active: Optional[bool] = None


# ================== CLIENT ENDPOINTS ==================

@referral_router.get('/referrals/test')
async def test_referral():
    """Test endpoint to verify referral service works"""
    try:
        if not _referral_service:
            return {"error": "Referral service not available"}
        test_code = await _referral_service.create_referral_code(
            user_id='3a7e9852-1718-4ec1-a5c9-451927cd4173',
            user_name='Cliente Demo'
        )
        return {
            "success": True,
            "code": test_code.get('code'),
            "has_link": bool(test_code.get('referral_link')),
            "has_qr": bool(test_code.get('qr_code_data')),
            "qr_length": len(test_code.get('qr_code_data', ''))
        }
    except Exception as e:
        return {"error": str(e)}


@referral_router.get('/referrals/my-code')
async def get_my_referral_code(request: Request):
    """Get or create referral code with link and QR code"""
    current_user = await _auth_user(request)
    try:
        logging.info(f"🎁 Referral code requested by user: {current_user.get('email')} (ID: {current_user.get('id')})")
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        referral_code = await _referral_service.create_referral_code(
            user_id=current_user['id'],
            user_name=current_user['name']
        )
        logging.info(f"✅ Referral code generated: {referral_code.get('code')}, QR: {bool(referral_code.get('qr_code_data'))}")
        referral_code.pop('_id', None)
        if referral_code.get('created_at'):
            referral_code['created_at'] = referral_code['created_at'].isoformat()
        return referral_code
    except Exception as e:
        logging.error(f"❌ Error getting referral code: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/referrals/validate')
async def validate_referral_code(request_body: ValidateReferralCodeRequest):
    """Validate a referral code (public endpoint)"""
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        referral_code = await _referral_service.validate_referral_code(request_body.code)
        if not referral_code:
            return {'valid': False, 'message': 'Código de referido no válido'}
        return {
            'valid': True,
            'code': referral_code['code'],
            'referrer_user_id': referral_code['user_id']
        }
    except Exception as e:
        logging.error(f"Error validating referral code: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/referrals/validate/{code}')
async def validate_referral_code_get(code: str):
    """Validate a referral code by GET (public endpoint)"""
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        referral_code = await _referral_service.validate_referral_code(code)
        if not referral_code:
            return {'valid': False, 'message': 'Código de referido no válido'}
        referrer = await _db.users.find_one({'id': referral_code['user_id']})
        referrer_name = referrer.get('full_name') or referrer.get('name') if referrer else None
        return {
            'valid': True,
            'code': referral_code['code'],
            'referrer_name': referrer_name,
            'referrer_user_id': referral_code['user_id']
        }
    except Exception as e:
        logging.error(f"Error validating referral code: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/referrals/my-referrals')
async def get_my_referrals(request: Request):
    """Get user's referral statistics and list of referred users"""
    current_user = await _auth_user(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        referrals_data = await _referral_service.get_user_referrals(current_user['id'])
        return referrals_data
    except Exception as e:
        logging.error(f"Error getting user referrals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/referrals/recommend-friend')
async def recommend_friend(request_body: RecommendFriendRequest, request: Request):
    """Send SMS invitation to a friend and create a lead."""
    current_user = await _auth_user(request)
    try:
        phone_digits = ''.join(filter(str.isdigit, request_body.friend_phone))
        if len(phone_digits) < 10:
            raise HTTPException(status_code=400, detail="Número de teléfono inválido")
        if len(phone_digits) == 10:
            formatted_phone = f"+1{phone_digits}"
        elif len(phone_digits) == 11 and phone_digits.startswith('1'):
            formatted_phone = f"+{phone_digits}"
        else:
            formatted_phone = f"+{phone_digits}"

        existing_lead = await _db.leads.find_one({'phone': {'$regex': phone_digits[-10:]}})
        existing_user = await _db.users.find_one({'phone': {'$regex': phone_digits[-10:]}})
        if existing_user:
            raise HTTPException(status_code=400, detail="Esta persona ya es cliente de Ross Tax")

        if not _referral_service:
            raise HTTPException(status_code=503, detail="Servicio no disponible")
        referral_code_data = await _referral_service.create_referral_code(
            current_user['id'], current_user.get('name', 'Usuario')
        )
        referral_code = referral_code_data.get('code', '')

        booking_link = f"https://rosstaxpreparation.com/agendar?ref={referral_code}&invited_by={current_user.get('name', 'un amigo')}"

        lead_data = {
            'name': request_body.friend_name,
            'phone': formatted_phone,
            'source': 'friend_recommendation',
            'referred_by_user_id': current_user['id'],
            'referred_by_name': current_user.get('name', 'Usuario'),
            'referral_code': referral_code,
            'status': 'new',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'sms_sent': False, 'sms_sent_at': None,
            'appointment_booked': False, 'appointment_id': None,
            'converted': False, 'converted_at': None
        }

        if existing_lead:
            await _db.leads.update_one(
                {'_id': existing_lead['_id']},
                {'$set': {
                    'referred_by_user_id': current_user['id'],
                    'referred_by_name': current_user.get('name', 'Usuario'),
                    'referral_code': referral_code,
                    'updated_at': datetime.utcnow()
                }}
            )
            lead_id = str(existing_lead['_id'])
        else:
            result = await _db.leads.insert_one(lead_data)
            lead_id = str(result.inserted_id)

        sms_message = f"""🎉 ¡Hola {request_body.friend_name}!

{current_user.get('name', 'Un amigo')} te recomienda con Ross Tax Preparation para tus impuestos.

📅 Agenda tu cita GRATIS:
{booking_link}

📍 305 Bruce Ave, Dumas, TX
📞 (806) 934-2018

¡Te esperamos!"""

        sms_sent = False
        if _notification_service:
            sms_sent = await _notification_service.send_sms(formatted_phone, sms_message)
            if sms_sent:
                await _db.leads.update_one(
                    {'_id': ObjectId(lead_id)},
                    {'$set': {'sms_sent': True, 'sms_sent_at': datetime.utcnow()}}
                )

        logging.info(f"📱 Friend recommendation: {current_user.get('name')} → {request_body.friend_name} ({formatted_phone}), SMS sent: {sms_sent}")
        return {
            'success': True,
            'message': f'Invitación enviada a {request_body.friend_name}',
            'lead_id': lead_id,
            'sms_sent': sms_sent,
            'referral_code': referral_code
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in recommend_friend: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al enviar la recomendación")


# ================== ADMIN ENDPOINTS ==================

@referral_router.post('/admin/referrals/{referral_id}/complete')
async def complete_referral(referral_id: str, appointment_id: str = Query(...), request: Request = None):
    """Admin: Mark referral as completed when appointment is completed"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        result = await _referral_service.complete_referral(referral_id, appointment_id)
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        try:
            referrer = await _db.users.find_one({'_id': result['referrer_user_id']})
            if referrer:
                logging.info(f"Referral completed for user {result['referrer_user_id']}, earned ${result['reward_amount']}")
        except Exception as e:
            logging.error(f"Error sending notification: {e}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error completing referral: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/admin/referrals')
async def get_all_referrals(
    request: Request,
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100)
):
    """Admin: Get all referrals with optional status filter"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        query = {}
        if status:
            query['status'] = status
        referrals = await _db.referrals.find(query).limit(limit).to_list(limit)
        enriched_referrals = []
        for ref in referrals:
            referrer = await _db.users.find_one({'_id': ref['referrer_user_id']})
            enriched_referrals.append({
                'id': str(ref['_id']),
                'referrer_name': referrer.get('name', 'Usuario') if referrer else 'Usuario',
                'referrer_email': referrer.get('email', '') if referrer else '',
                'referred_name': ref.get('referred_name', 'Usuario'),
                'referred_email': ref.get('referred_email', ''),
                'referred_phone': ref.get('referred_phone', ''),
                'code': ref['referral_code_used'],
                'appointment_id': ref.get('appointment_id'),
                'status': ref['status'],
                'created_at': ref['created_at'].isoformat(),
                'completed_at': ref['completed_at'].isoformat() if ref.get('completed_at') else None,
                'reward_given': ref.get('reward_given', False),
                'reward_amount_usd': ref.get('reward_amount_usd', 0),
                'discount_applied_usd': ref.get('discount_applied_usd', 5.0)
            })
        return {'referrals': enriched_referrals, 'total': len(enriched_referrals)}
    except Exception as e:
        logging.error(f"Error getting all referrals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/admin/referrals')
async def create_manual_referral(request: Request):
    """Admin: Manually create a referral record"""
    current_user = await _require_admin(request)
    try:
        data = await request.json()
        referrer_name = data.get('referrer_name', '').strip()
        referred_name = data.get('referred_name', '').strip()
        if not referrer_name or not referred_name:
            raise HTTPException(status_code=400, detail="referrer_name and referred_name are required")
        referral_doc = {
            'referrer_name': referrer_name,
            'referrer_phone': data.get('referrer_phone', ''),
            'referred_name': referred_name,
            'referred_phone': data.get('referred_phone', ''),
            'referral_code_used': 'MANUAL',
            'referrer_user_id': None,
            'status': 'pending',
            'reward_given': False,
            'reward_amount_usd': 0,
            'created_at': datetime.utcnow(),
            'created_by': current_user.get('email', 'admin'),
            'source': 'admin_manual',
        }
        result = await _db.referrals.insert_one(referral_doc)
        referral_doc['_id'] = str(result.inserted_id)
        referral_doc['created_at'] = referral_doc['created_at'].isoformat()
        return {'success': True, 'referral': referral_doc}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating manual referral: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/admin/referrals/{referral_id}/pay-reward')
async def pay_referral_reward(referral_id: str, request: Request):
    """Admin: Mark a referral's reward as paid"""
    current_user = await _require_admin(request)
    try:
        result = await _db.referrals.update_one(
            {'_id': ObjectId(referral_id)},
            {'$set': {
                'reward_given': True,
                'reward_paid': True,
                'reward_paid_at': datetime.utcnow(),
                'reward_paid_by': current_user.get('email', 'admin'),
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Referral not found")
        return {'success': True, 'message': 'Recompensa marcada como pagada'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error paying referral reward: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/admin/referrals/stats')
async def get_referral_stats(request: Request):
    """Admin: Get referral program statistics"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        total_codes = await _db.referral_codes.count_documents({})
        active_codes = await _db.referral_codes.count_documents({'is_active': True})
        total_referrals = await _db.referrals.count_documents({})
        pending_referrals = await _db.referrals.count_documents({'status': 'pending'})
        completed_referrals = await _db.referrals.count_documents({'status': 'completed'})
        rewards_pipeline = [
            {'$match': {'status': 'completed'}},
            {'$group': {'_id': None, 'total': {'$sum': '$reward_amount_usd'}}}
        ]
        rewards_result = await _db.referrals.aggregate(rewards_pipeline).to_list(1)
        total_rewards_usd = rewards_result[0]['total'] if rewards_result else 0
        top_referrers = await _db.referral_codes.find(
            {'total_referrals': {'$gt': 0}}
        ).sort('completed_referrals', -1).limit(10).to_list(10)
        enriched_top = []
        for code in top_referrers:
            user = await _db.users.find_one({'_id': code['user_id']})
            if user:
                enriched_top.append({
                    'user_name': user.get('name', 'Usuario'),
                    'user_email': user.get('email', ''),
                    'code': code['code'],
                    'total_referrals': code['total_referrals'],
                    'completed_referrals': code.get('completed_referrals', 0),
                    'pending_referrals': code.get('pending_referrals', 0),
                    'total_earned_usd': code.get('total_earned_usd', 0.0)
                })
        return {
            'total_codes': total_codes,
            'active_codes': active_codes,
            'total_referrals': total_referrals,
            'pending_referrals': pending_referrals,
            'completed_referrals': completed_referrals,
            'total_rewards_usd': total_rewards_usd,
            'top_referrers': enriched_top
        }
    except Exception as e:
        logging.error(f"Error getting referral stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/admin/referrals/pending-payouts')
async def get_pending_payouts(request: Request):
    """Admin: Get list of pending payouts to referrers"""
    current_user = await _require_admin(request)
    try:
        pending_payouts = await _db.referral_payments.find({'status': 'pending_payout'}).to_list(100)
        enriched_payouts = []
        for payout in pending_payouts:
            user = await _db.users.find_one({'_id': payout['referrer_user_id']})
            referral = await _db.referrals.find_one({'_id': payout['referral_id']})
            if user and referral:
                enriched_payouts.append({
                    'id': str(payout['_id']),
                    'referrer_name': user.get('name', 'Usuario'),
                    'referrer_email': user.get('email', ''),
                    'referred_name': referral.get('referred_name', ''),
                    'amount_usd': payout['amount_usd'],
                    'created_at': payout['created_at'].isoformat(),
                    'status': payout['status']
                })
        total_pending = sum(p['amount_usd'] for p in enriched_payouts)
        return {
            'payouts': enriched_payouts,
            'total_count': len(enriched_payouts),
            'total_amount_usd': total_pending
        }
    except Exception as e:
        logging.error(f"Error getting pending payouts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/admin/referrals/payouts/{payout_id}/mark-paid')
async def mark_payout_paid(payout_id: str, request: Request):
    """Admin: Mark a payout as paid"""
    current_user = await _require_admin(request)
    try:
        result = await _db.referral_payments.update_one(
            {'_id': ObjectId(payout_id)},
            {'$set': {'status': 'paid', 'paid_at': datetime.utcnow(), 'paid_by': current_user['id']}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Pago no encontrado")
        return {'success': True, 'message': 'Pago marcado como completado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking payout paid: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.get('/admin/referrals/leads')
async def get_referral_leads(request: Request, status: Optional[str] = Query(None)):
    """Admin: Get all leads generated from referrals"""
    current_user = await _require_admin(request)
    try:
        query = {'source': 'friend_recommendation'}
        if status:
            query['status'] = status
        leads = await _db.leads.find(query).sort('created_at', -1).limit(200).to_list(200)
        enriched = []
        for lead in leads:
            enriched.append({
                'id': str(lead['_id']),
                'name': lead.get('name', ''),
                'phone': lead.get('phone', ''),
                'referred_by_name': lead.get('referred_by_name', ''),
                'referred_by_user_id': lead.get('referred_by_user_id', ''),
                'referral_code': lead.get('referral_code', ''),
                'status': lead.get('status', 'new'),
                'sms_sent': lead.get('sms_sent', False),
                'appointment_booked': lead.get('appointment_booked', False),
                'converted': lead.get('converted', False),
                'created_at': lead['created_at'].isoformat() if lead.get('created_at') else None,
            })
        return {'leads': enriched, 'total': len(enriched)}
    except Exception as e:
        logging.error(f"Error getting referral leads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/admin/referrals/leads/{lead_id}/update-status')
async def update_lead_status(lead_id: str, request: Request):
    """Admin: Update a lead's status"""
    current_user = await _require_admin(request)
    try:
        body = await request.json()
        new_status = body.get('status')
        if new_status not in ['new', 'contacted', 'appointment_booked', 'converted', 'lost']:
            raise HTTPException(status_code=400, detail="Estado inválido")
        updates = {'status': new_status, 'updated_at': datetime.utcnow()}
        if new_status == 'converted':
            updates['converted'] = True
            updates['converted_at'] = datetime.utcnow()
        if new_status == 'appointment_booked':
            updates['appointment_booked'] = True
        result = await _db.leads.update_one({'_id': ObjectId(lead_id)}, {'$set': updates})
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Lead no encontrado")
        return {'success': True, 'message': f'Estado actualizado a: {new_status}'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating lead status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== REWARD TIERS MANAGEMENT ==========

@referral_router.get('/admin/referrals/reward-tiers')
async def get_reward_tiers(request: Request):
    """Admin: Get all reward tiers"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        tiers = await _referral_service.get_reward_tiers()
        for tier in tiers:
            tier['id'] = str(tier.pop('_id'))
            if tier.get('created_at'):
                tier['created_at'] = tier['created_at'].isoformat()
        return {'tiers': tiers}
    except Exception as e:
        logging.error(f"Error getting reward tiers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.post('/admin/referrals/reward-tiers')
async def create_reward_tier(request_body: CreateRewardTierRequest, request: Request):
    """Admin: Create new reward tier"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        tier = await _referral_service.create_reward_tier(
            min_referrals=request_body.min_referrals,
            max_referrals=request_body.max_referrals,
            reward_amount_usd=request_body.reward_amount_usd
        )
        tier['id'] = str(tier.pop('_id'))
        if tier.get('created_at'):
            tier['created_at'] = tier['created_at'].isoformat()
        return tier
    except Exception as e:
        logging.error(f"Error creating reward tier: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.patch('/admin/referrals/reward-tiers/{tier_id}')
async def update_reward_tier(tier_id: str, request_body: UpdateRewardTierRequest, request: Request):
    """Admin: Update reward tier"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        updates = {}
        if request_body.min_referrals is not None:
            updates['min_referrals'] = request_body.min_referrals
        if request_body.max_referrals is not None:
            updates['max_referrals'] = request_body.max_referrals
        if request_body.reward_amount_usd is not None:
            updates['reward_amount_usd'] = request_body.reward_amount_usd
        if request_body.is_active is not None:
            updates['is_active'] = request_body.is_active
        success = await _referral_service.update_reward_tier(tier_id, updates)
        if not success:
            raise HTTPException(status_code=404, detail="Tier not found")
        return {'success': True, 'message': 'Tier updated successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating reward tier: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@referral_router.delete('/admin/referrals/reward-tiers/{tier_id}')
async def delete_reward_tier(tier_id: str, request: Request):
    """Admin: Delete reward tier"""
    current_user = await _require_admin(request)
    try:
        if not _referral_service:
            raise HTTPException(status_code=503, detail="Referral service not available")
        success = await _referral_service.delete_reward_tier(tier_id)
        if not success:
            raise HTTPException(status_code=404, detail="Tier not found")
        return {'success': True, 'message': 'Tier deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting reward tier: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
