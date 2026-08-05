"""
Subscription System Routes Router
Extracted from server.py for modularization.
Handles subscription plans CRUD, subscription links, NMI recurring billing, and public subscribe endpoints.
"""
import os
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

subscription_router = APIRouter()
_db = None


def init_subscription_router(db):
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


# ================== Pydantic Models ==================

class SubscriptionPlanCreate(BaseModel):
    name: str
    amount: float
    frequency: str  # 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'
    description: str = ''


class SubscriptionLinkCreate(BaseModel):
    plan_id: Optional[str] = None
    custom_amount: Optional[float] = None
    custom_frequency: Optional[str] = None
    description: str = ''
    client_name: str = ''
    client_email: str = ''
    client_phone: str = ''
    send_sms: bool = True
    send_email: bool = True
    plan_payments: int = 0


# ================== Helper Functions ==================

def get_nmi_frequency_params(frequency: str) -> dict:
    freq_map = {
        'weekly': {'day_frequency': '7'},
        'biweekly': {'day_frequency': '14'},
        'monthly': {'month_frequency': '1', 'day_of_month': str(datetime.now().day)},
        'quarterly': {'month_frequency': '3', 'day_of_month': str(datetime.now().day)},
        'annual': {'month_frequency': '12', 'day_of_month': str(datetime.now().day)},
    }
    return freq_map.get(frequency, {'month_frequency': '1', 'day_of_month': str(datetime.now().day)})


def get_frequency_label(frequency: str) -> str:
    labels = {
        'weekly': 'Semanal',
        'biweekly': 'Quincenal',
        'monthly': 'Mensual',
        'quarterly': 'Trimestral',
        'annual': 'Anual',
    }
    return labels.get(frequency, frequency)


# ================== SUBSCRIPTION PLANS ==================

@subscription_router.post('/subscription-plans')
async def create_subscription_plan(plan: SubscriptionPlanCreate, request: Request):
    current_user = await _require_admin(request)
    try:
        plan_doc = {
            'name': plan.name,
            'amount': plan.amount,
            'frequency': plan.frequency,
            'description': plan.description,
            'active': True,
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user['id'],
        }
        result = await _db.subscription_plans.insert_one(plan_doc)
        plan_doc['_id'] = str(result.inserted_id)
        logging.info(f"✅ Subscription plan created: {plan.name} - ${plan.amount}/{plan.frequency}")
        return {'success': True, 'plan': plan_doc}
    except Exception as e:
        logging.error(f"Error creating subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.get('/subscription-plans')
async def list_subscription_plans(request: Request):
    current_user = await _auth_user(request)
    try:
        plans = await _db.subscription_plans.find({'active': True}).sort('created_at', -1).to_list(100)
        for p in plans:
            p['_id'] = str(p['_id'])
        return {'success': True, 'plans': plans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.delete('/subscription-plans/{plan_id}')
async def delete_subscription_plan(plan_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        await _db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': {'active': False}}
        )
        return {'success': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.get('/public/subscription-plans')
async def list_public_subscription_plans():
    try:
        plans = await _db.subscription_plans.find({'active': True}).sort('amount', 1).to_list(100)
        for p in plans:
            p['_id'] = str(p['_id'])
        return {'success': True, 'plans': plans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================== SUBSCRIPTION LINKS ==================

@subscription_router.post('/subscription-links')
async def create_subscription_link(link: SubscriptionLinkCreate, request: Request):
    current_user = await _require_admin(request)
    try:
        token = secrets.token_urlsafe(24)
        
        if link.plan_id:
            plan = await _db.subscription_plans.find_one({'_id': ObjectId(link.plan_id), 'active': True})
            if not plan:
                raise HTTPException(status_code=404, detail="Plan no encontrado")
            amount = plan['amount']
            frequency = plan['frequency']
            plan_name = plan['name']
            description = link.description or plan.get('description', '')
        else:
            if not link.custom_amount or link.custom_amount < 1:
                raise HTTPException(status_code=400, detail="Monto inválido")
            if not link.custom_frequency:
                raise HTTPException(status_code=400, detail="Frecuencia requerida")
            amount = link.custom_amount
            frequency = link.custom_frequency
            plan_name = f"Suscripción ${amount:.2f}/{get_frequency_label(frequency)}"
            description = link.description or plan_name
        
        link_doc = {
            'token': token,
            'plan_id': link.plan_id,
            'plan_name': plan_name,
            'amount': amount,
            'frequency': frequency,
            'description': description,
            'client_name': link.client_name,
            'client_email': link.client_email,
            'client_phone': link.client_phone,
            'plan_payments': link.plan_payments,
            'status': 'pending',
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user['id'],
        }
        
        await _db.subscription_links.insert_one(link_doc)
        
        base_url = "https://www.rosstaxpreparation.com"
        sub_url = f"{base_url}/subscribe/{token}"
        freq_label = get_frequency_label(frequency)
        
        sms_sent = False
        email_sent = False
        
        if link.send_sms and link.client_phone:
            try:
                from twilio.rest import Client as TwilioClient
                twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
                twilio_token_env = os.getenv('TWILIO_AUTH_TOKEN')
                twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
                if twilio_sid and twilio_token_env and twilio_phone:
                    twilio_client = TwilioClient(twilio_sid, twilio_token_env)
                    phone = link.client_phone.strip()
                    if not phone.startswith('+'):
                        phone = '+1' + phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
                    
                    sms_body = f"🔄 Ross Tax Preparation\n\nHola {link.client_name or 'Cliente'},\n\nTe invitamos a suscribirte a: {plan_name}\n💰 ${amount:.2f}/{freq_label}\n\nSuscríbete aquí:\n{sub_url}\n\n📞 (806) 934-2018"
                    
                    twilio_client.messages.create(body=sms_body, from_=twilio_phone, to=phone)
                    sms_sent = True
                    logging.info(f"📱 Subscription link SMS sent to {phone}")
            except Exception as e:
                logging.error(f"SMS error: {e}")
        
        if link.send_email and link.client_email:
            try:
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                sg_key = os.getenv('SENDGRID_API_KEY')
                if sg_key:
                    sg = SendGridAPIClient(sg_key)
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #7f1d1d, #991b1b); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px;">🔄 Invitación de Suscripción</h1>
                            <p style="margin: 10px 0 0; opacity: 0.8;">Ross Tax Preparation LLC</p>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
                            <p>Hola <strong>{link.client_name or 'Cliente'}</strong>,</p>
                            <p>Te invitamos a suscribirte al siguiente plan:</p>
                            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                                <h2 style="margin: 0; color: #1f2937;">{plan_name}</h2>
                                <p style="font-size: 32px; font-weight: bold; color: #7f1d1d; margin: 10px 0;">${amount:.2f}<span style="font-size: 14px; color: #6b7280;">/{freq_label}</span></p>
                                {f'<p style="color: #6b7280;">{description}</p>' if description else ''}
                            </div>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{sub_url}" style="display: inline-block; background: linear-gradient(135deg, #7f1d1d, #991b1b); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">Suscribirme Ahora</a>
                            </div>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                            <p style="text-align: center; color: #9ca3af; font-size: 12px;">Ross Tax Preparation LLC • (806) 934-2018</p>
                        </div>
                    </div>
                    """
                    message = Mail(
                        from_email=os.getenv('SENDGRID_FROM_EMAIL', 'noreply@rosstaxpreparation.com'),
                        to_emails=link.client_email,
                        subject=f"🔄 Suscripción - {plan_name} - Ross Tax Preparation",
                        html_content=email_html
                    )
                    sg.send(message)
                    email_sent = True
                    logging.info(f"📧 Subscription link email sent to {link.client_email}")
            except Exception as e:
                logging.error(f"Email error: {e}")
        
        link_doc['_id'] = str(link_doc.get('_id', ''))
        return {
            'success': True,
            'link': link_doc,
            'url': sub_url,
            'sms_sent': sms_sent,
            'email_sent': email_sent,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating subscription link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.get('/subscription-links')
async def list_subscription_links(request: Request):
    current_user = await _require_admin(request)
    try:
        links = await _db.subscription_links.find().sort('created_at', -1).to_list(200)
        for l in links:
            l['_id'] = str(l['_id'])
        return {'success': True, 'links': links}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================== ACTIVE SUBSCRIPTIONS ==================

@subscription_router.get('/subscriptions')
async def list_subscriptions(request: Request):
    current_user = await _require_admin(request)
    try:
        subs = await _db.subscriptions.find().sort('created_at', -1).to_list(500)
        for s in subs:
            s['_id'] = str(s['_id'])
        return {'success': True, 'subscriptions': subs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post('/subscriptions/{sub_id}/cancel')
async def cancel_subscription(sub_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        from merchant_one_service import MERCHANT_ONE_SECURITY_KEY, MERCHANT_ONE_API_URL
        import httpx
        
        sub = await _db.subscriptions.find_one({'_id': ObjectId(sub_id)})
        if not sub:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        
        if sub.get('nmi_subscription_id'):
            try:
                cancel_payload = {
                    'security_key': MERCHANT_ONE_SECURITY_KEY,
                    'recurring': 'delete_subscription',
                    'subscription_id': sub['nmi_subscription_id'],
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(MERCHANT_ONE_API_URL, data=cancel_payload)
                    logging.info(f"NMI cancel subscription response: {resp.text[:200]}")
            except Exception as e:
                logging.error(f"NMI cancel error: {e}")
        
        await _db.subscriptions.update_one(
            {'_id': ObjectId(sub_id)},
            {'$set': {
                'status': 'cancelled',
                'cancelled_at': datetime.now(timezone.utc),
                'cancelled_by': current_user['id'],
            }}
        )
        
        logging.info(f"✅ Subscription {sub_id} cancelled by admin {current_user['id']}")
        return {'success': True, 'message': 'Suscripción cancelada'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post('/subscription-links/{link_id}/cancel')
async def cancel_subscription_link(link_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        link = await _db.subscription_links.find_one({'_id': ObjectId(link_id)})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado")
        
        nmi_sub_id = link.get('nmi_subscription_id', '')
        
        if link.get('subscription_id'):
            sub = await _db.subscriptions.find_one({'_id': ObjectId(link['subscription_id'])})
            if sub:
                nmi_sub_id = nmi_sub_id or sub.get('nmi_subscription_id', '')
                await _db.subscriptions.update_one(
                    {'_id': ObjectId(link['subscription_id'])},
                    {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc), 'cancelled_by': current_user['id']}}
                )
        
        if nmi_sub_id:
            try:
                from merchant_one_service import MERCHANT_ONE_SECURITY_KEY, MERCHANT_ONE_API_URL
                import httpx
                cancel_payload = {
                    'security_key': MERCHANT_ONE_SECURITY_KEY,
                    'recurring': 'delete_subscription',
                    'subscription_id': nmi_sub_id,
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(MERCHANT_ONE_API_URL, data=cancel_payload)
                    logging.info(f"NMI cancel from link response: {resp.text[:200]}")
            except Exception as e:
                logging.error(f"NMI cancel from link error: {e}")
        
        await _db.subscription_links.update_one(
            {'_id': ObjectId(link_id)},
            {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc)}}
        )
        
        logging.info(f"✅ Subscription link {link_id} cancelled by admin {current_user['id']}")
        return {'success': True, 'message': 'Suscripción cancelada exitosamente'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling subscription link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.delete('/subscription-links/{link_id}')
async def delete_subscription_link(link_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        link = await _db.subscription_links.find_one({'_id': ObjectId(link_id)})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado")
        
        if link.get('status') == 'subscribed':
            raise HTTPException(status_code=400, detail="No se puede eliminar un link con suscripción activa. Cancélalo primero.")
        
        await _db.subscription_links.delete_one({'_id': ObjectId(link_id)})
        return {'success': True, 'message': 'Link eliminado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting subscription link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post('/subscription-links/{link_id}/resend')
async def resend_subscription_link(link_id: str, request: Request):
    current_user = await _require_admin(request)
    try:
        link = await _db.subscription_links.find_one({'_id': ObjectId(link_id)})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado")
        
        if link.get('status') == 'subscribed':
            raise HTTPException(status_code=400, detail="Este link ya fue utilizado")
        
        token = link.get('token', '')
        sub_url = f"https://www.rosstaxpreparation.com/subscribe/{token}"
        plan_name = link.get('plan_name', 'Suscripción')
        amount = link.get('amount', 0)
        frequency_label = get_frequency_label(link.get('frequency', ''))
        
        sms_sent = False
        email_sent = False
        
        if link.get('client_phone'):
            try:
                sms_body = f"Ross Tax: Tu link de suscripción {plan_name} (${amount:.2f}/{frequency_label}): {sub_url}"
                from twilio.rest import Client as TwilioClient
                twilio_client = TwilioClient(os.getenv('TWILIO_ACCOUNT_SID'), os.getenv('TWILIO_AUTH_TOKEN'))
                twilio_client.messages.create(body=sms_body, from_=os.getenv('TWILIO_PHONE_NUMBER'), to=f"+1{link['client_phone']}")
                sms_sent = True
            except Exception as e:
                logging.error(f"Resend SMS error: {e}")
        
        if link.get('client_email'):
            try:
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
                msg = Mail(
                    from_email=os.getenv('SENDGRID_FROM_EMAIL', 'noreply@rosstaxpreparation.com'),
                    to_emails=link['client_email'],
                    subject=f'Ross Tax - Link de Suscripción: {plan_name}',
                    html_content=f'<h2>Suscripción: {plan_name}</h2><p>Monto: ${amount:.2f}/{frequency_label}</p><p><a href="{sub_url}" style="padding:12px 24px;background:#6C1110;color:white;text-decoration:none;border-radius:8px;">Suscribirse</a></p>'
                )
                sg.send(msg)
                email_sent = True
            except Exception as e:
                logging.error(f"Resend email error: {e}")
        
        return {'success': True, 'sms_sent': sms_sent, 'email_sent': email_sent}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error resending subscription link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== PUBLIC SUBSCRIPTION ENDPOINTS ==================

@subscription_router.get('/public/subscription-links/{token}')
async def get_public_subscription_link(token: str):
    try:
        link = await _db.subscription_links.find_one({'token': token})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado")
        
        if link.get('status') == 'subscribed':
            return {'success': False, 'message': 'Este link ya fue utilizado'}
        
        return {
            'success': True,
            'link': {
                'plan_name': link.get('plan_name', ''),
                'amount': link['amount'],
                'frequency': link['frequency'],
                'frequency_label': get_frequency_label(link['frequency']),
                'description': link.get('description', ''),
                'client_name': link.get('client_name', ''),
                'client_email': link.get('client_email', ''),
                'status': link['status'],
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@subscription_router.post('/public/subscription-links/{token}/subscribe')
async def process_subscription(token: str, request: Request):
    """Process a subscription from a public link - supports card and ACH"""
    try:
        from merchant_one_service import MERCHANT_ONE_SECURITY_KEY, MERCHANT_ONE_API_URL
        import httpx
        import urllib.parse
        
        link = await _db.subscription_links.find_one({'token': token})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado")
        if link.get('status') == 'subscribed':
            raise HTTPException(status_code=400, detail="Este link ya fue utilizado")
        
        body = await request.json()
        payment_type = body.get('payment_type', 'card')
        cardholder_name = body.get('cardholder_name', link.get('client_name', ''))
        client_email = body.get('email', link.get('client_email', ''))
        client_phone = body.get('phone', link.get('client_phone', ''))
        client_address = body.get('address', '')
        client_city = body.get('city', '')
        client_state = body.get('state', '')
        client_zip = body.get('zip', '')
        
        freq_params = get_nmi_frequency_params(link['frequency'])
        start_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime('%Y%m%d')
        
        first_name = cardholder_name.split(' ')[0] if cardholder_name else ''
        last_name = ' '.join(cardholder_name.split(' ')[1:]) if len(cardholder_name.split(' ')) > 1 else ''
        
        if payment_type == 'bank':
            routing_number = body.get('routing_number', '')
            account_number = body.get('account_number', '')
            account_type = body.get('account_type', 'checking')
            
            if not routing_number or len(routing_number) != 9:
                raise HTTPException(status_code=400, detail="Número de ruta inválido (9 dígitos)")
            if not account_number:
                raise HTTPException(status_code=400, detail="Número de cuenta requerido")
            
            brand = 'ACH'
            last4 = account_number[-4:]
            payment_method_type = 'bank_account'
        else:
            card_number = body.get('card_number', '')
            exp_month = body.get('exp_month', '')
            exp_year = body.get('exp_year', '')
            cvv = body.get('cvv', '')
            
            if not card_number or not exp_month or not exp_year or not cvv:
                raise HTTPException(status_code=400, detail="Datos de tarjeta incompletos")
            
            clean_card = card_number.replace(' ', '')
            if clean_card.startswith('4'): brand = 'Visa'
            elif clean_card[:2] in ['51','52','53','54','55']: brand = 'Mastercard'
            elif clean_card[:2] in ['34','37']: brand = 'Amex'
            elif clean_card[:4] == '6011' or clean_card[:2] == '65': brand = 'Discover'
            else: brand = 'Card'
            last4 = clean_card[-4:]
            payment_method_type = 'card'
        
        unique_order_id = f"SUB-{uuid.uuid4().hex[:12]}"
        pre_generated_vault_id = str(uuid.uuid4().hex[:20])
        
        async with httpx.AsyncClient(timeout=30) as nmi_client:
            if payment_type == 'bank':
                step1_payload = {
                    'security_key': MERCHANT_ONE_SECURITY_KEY,
                    'type': 'sale',
                    'payment': 'check',
                    'amount': f"{link['amount']:.2f}",
                    'checkname': body.get('account_name', cardholder_name),
                    'checkaba': body.get('routing_number', ''),
                    'checkaccount': body.get('account_number', ''),
                    'account_type': body.get('account_type', 'checking'),
                    'customer_vault': 'add_customer',
                    'customer_vault_id': pre_generated_vault_id,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': client_email,
                    'phone': client_phone,
                    'address1': client_address,
                    'city': client_city,
                    'state': client_state,
                    'zip': client_zip,
                    'order_description': f"Primer pago - {link.get('plan_name', 'Suscripción')}",
                    'orderid': unique_order_id,
                }
            else:
                ccexp_val = f"{str(body.get('exp_month', '')).zfill(2)}{str(body.get('exp_year', ''))[-2:]}"
                step1_payload = {
                    'security_key': MERCHANT_ONE_SECURITY_KEY,
                    'type': 'sale',
                    'amount': f"{link['amount']:.2f}",
                    'ccnumber': body.get('card_number', ''),
                    'ccexp': ccexp_val,
                    'cvv': body.get('cvv', ''),
                    'customer_vault': 'add_customer',
                    'customer_vault_id': pre_generated_vault_id,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': client_email,
                    'phone': client_phone,
                    'address1': client_address,
                    'city': client_city,
                    'state': client_state,
                    'zip': client_zip,
                    'order_description': f"Primer pago - {link.get('plan_name', 'Suscripción')}",
                    'orderid': unique_order_id,
                    'dup_seconds': '0',
                }
            
            step1_resp = await nmi_client.post(MERCHANT_ONE_API_URL, data=step1_payload)
            step1_result = dict(urllib.parse.parse_qsl(step1_resp.text))
            logging.info(f"NMI Step 1 (Sale+Vault) response: {step1_resp.text[:200]}")
            
            if step1_result.get('response') != '1':
                error_msg = step1_result.get('responsetext', 'Pago rechazado')
                raise HTTPException(status_code=400, detail=f"Pago rechazado: {error_msg}")
            
            initial_transaction_id = step1_result.get('transactionid', '')
            customer_vault_id = step1_result.get('customer_vault_id', '') or pre_generated_vault_id
            logging.info(f"✅ Step 1 OK: TX={initial_transaction_id}, Vault={customer_vault_id}")
            
            nmi_subscription_id = ''
            if customer_vault_id:
                step2_payload = {
                    'security_key': MERCHANT_ONE_SECURITY_KEY,
                    'recurring': 'add_subscription',
                    'plan_payments': str(link.get('plan_payments', 0)),
                    'plan_amount': f"{link['amount']:.2f}",
                    'customer_vault_id': customer_vault_id,
                    'start_date': start_date,
                    'order_description': link.get('description', f"Suscripción {link.get('plan_name', '')}"),
                }
                step2_payload.update(freq_params)
                
                step2_resp = await nmi_client.post(MERCHANT_ONE_API_URL, data=step2_payload)
                step2_result = dict(urllib.parse.parse_qsl(step2_resp.text))
                logging.info(f"NMI Step 2 (Subscription) response: {step2_resp.text[:200]}")
                
                if step2_result.get('response') == '1':
                    nmi_subscription_id = (
                        step2_result.get('subscription_id', '') or 
                        step2_result.get('transactionid', '') or 
                        step2_result.get('subscription', '') or
                        step2_result.get('id', '')
                    )
                    logging.info(f"✅ Step 2 OK: Subscription ID={nmi_subscription_id}")
                else:
                    logging.warning(f"⚠️ NMI subscription creation issue: {step2_result.get('responsetext', 'Unknown')}")
        
        subscription_doc = {
            'link_token': token,
            'link_id': str(link['_id']),
            'plan_name': link.get('plan_name', ''),
            'amount': link['amount'],
            'frequency': link['frequency'],
            'frequency_label': get_frequency_label(link['frequency']),
            'plan_payments': link.get('plan_payments', 0),
            'payment_type': payment_type,
            'client_name': cardholder_name,
            'client_email': client_email,
            'client_phone': client_phone,
            'client_address': client_address,
            'client_city': client_city,
            'client_state': client_state,
            'client_zip': client_zip,
            'nmi_subscription_id': nmi_subscription_id,
            'customer_vault_id': customer_vault_id,
            'card_brand': brand,
            'card_last4': last4,
            'initial_transaction_id': initial_transaction_id,
            'status': 'active',
            'created_at': datetime.now(timezone.utc),
            'next_charge_date': start_date,
        }
        
        sub_result_db = await _db.subscriptions.insert_one(subscription_doc)
        
        await _db.subscription_links.update_one(
            {'_id': link['_id']},
            {'$set': {
                'status': 'subscribed',
                'subscribed_at': datetime.now(timezone.utc),
                'subscription_id': str(sub_result_db.inserted_id),
                'nmi_subscription_id': nmi_subscription_id,
                'subscriber_name': cardholder_name,
                'subscriber_email': client_email,
            }}
        )
        
        pm_doc = {
            'user_email': client_email,
            'client_name': cardholder_name,
            'type': payment_method_type,
            'brand': brand,
            'last4': last4,
            'customer_vault_id': customer_vault_id,
            'source': 'subscription_link',
            'created_at': datetime.now(timezone.utc),
        }
        if payment_type == 'card':
            pm_doc['exp_month'] = str(body.get('exp_month', '')).zfill(2)
            pm_doc['exp_year'] = str(body.get('exp_year', ''))
        else:
            pm_doc['routing_number'] = routing_number[-4:]
            pm_doc['account_type'] = account_type
        await _db.payment_methods.insert_one(pm_doc)
        
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            sg_key = os.getenv('SENDGRID_API_KEY')
            if sg_key and client_email:
                sg = SendGridAPIClient(sg_key)
                freq_label = get_frequency_label(link['frequency'])
                method_label = f"{brand} ****{last4}" if payment_type == 'card' else f"ACH ****{last4}"
                receipt_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #065f46, #047857); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">✅ Suscripción Activada</h1>
                        <p style="margin: 10px 0 0; opacity: 0.8;">Ross Tax Preparation LLC</p>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px;">
                        <p>Hola <strong>{cardholder_name}</strong>,</p>
                        <p>Tu suscripción ha sido activada exitosamente.</p>
                        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 8px 0; color: #6b7280;">Plan:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">{link.get('plan_name', 'Suscripción')}</td></tr>
                                <tr><td style="padding: 8px 0; color: #6b7280;">Monto:</td><td style="padding: 8px 0; font-weight: bold; text-align: right; color: #7f1d1d;">${link['amount']:.2f}/{freq_label}</td></tr>
                                <tr><td style="padding: 8px 0; color: #6b7280;">Método:</td><td style="padding: 8px 0; text-align: right;">{method_label}</td></tr>
                                <tr><td style="padding: 8px 0; color: #6b7280;">ID Transacción:</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">{initial_transaction_id}</td></tr>
                            </table>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">Tu cuenta será cargada automáticamente cada periodo. Para cancelar, contacta a Ross Tax Preparation.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="text-align: center; color: #9ca3af; font-size: 12px;">Ross Tax Preparation LLC • (806) 934-2018</p>
                    </div>
                </div>
                """
                message = Mail(
                    from_email=os.getenv('SENDGRID_FROM_EMAIL', 'noreply@rosstaxpreparation.com'),
                    to_emails=client_email,
                    subject=f"✅ Suscripción Activada - {link.get('plan_name', 'Ross Tax')}",
                    html_content=receipt_html
                )
                sg.send(message)
                logging.info(f"📧 Subscription receipt sent to {client_email}")
        except Exception as e:
            logging.error(f"Receipt email error: {e}")
        
        logging.info(f"✅ Subscription activated ({payment_type}): {cardholder_name} - {link.get('plan_name')} - ${link['amount']}/{link['frequency']}")
        
        return {
            'success': True,
            'message': 'Suscripción activada exitosamente',
            'transaction_id': initial_transaction_id,
            'subscription_id': str(sub_result_db.inserted_id),
            'amount': link['amount'],
            'frequency_label': get_frequency_label(link['frequency']),
            'payment_type': payment_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))
