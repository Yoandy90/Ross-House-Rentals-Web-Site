"""
Payment Links Routes Router
Extracted from server.py for modularization.
Handles payment link creation, public payment processing, NMI integration, and receipts.
"""
import os
import logging
import secrets
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

payment_links_router = APIRouter()
_db = None
__notification_service = None


def init_payment_links_router(db):
    global _db
    _db = db


def update_payment_links_notification_service(notif_svc):
    global __notification_service
    __notification_service = notif_svc

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
            from bson import ObjectId as OID
            user = await _db.users.find_one({'_id': OID(session['user_id'])})
        except:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = user_dict.get('id', str(user_dict.get('_id', '')))
    if '_id' in user_dict:
        user_dict['_id'] = str(user_dict['_id'])
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

# ============== PAYMENT LINKS ENDPOINTS ==============

async def _notify_admin_payment_received(payer_name: str, amount: float, method: str, description: str, transaction_id: str, payment_type: str = 'Link de Pago'):
    """Send notification to all admins when a payment is received"""
    global _notification_service
    try:
        # Find all admin users
        admins = await _db.users.find({'role': 'admin'}).to_list(10)
        
        for admin in admins:
            # Push notification
            push_tokens = admin.get('push_tokens', [])
            if push_tokens and _notification_service:
                try:
                    title = f"💰 Pago Recibido - ${amount:.2f}"
                    body = f"{payer_name} pagó ${amount:.2f} via {payment_type}\n{method}"
                    if description:
                        body += f"\n📝 {description}"
                    await _notification_service.send_push_notification(
                        push_tokens, title, body,
                        data={'type': 'payment_received', 'amount': str(amount), 'transaction_id': transaction_id or ''}
                    )
                except Exception as e:
                    logging.error(f"Admin push notification error: {e}")
            
            # SMS notification  
            if admin.get('phone') and _notification_service and _notification_service.twilio_client:
                try:
                    phone = admin['phone'].strip().replace('-', '').replace(' ', '')
                    if not phone.startswith('+'):
                        if not phone.startswith('1'):
                            phone = '1' + phone
                        phone = '+' + phone
                    sms = f"💰 Ross Tax - Pago Recibido\n\n{payer_name} pagó ${amount:.2f}\n{method}\n{description}"
                    await _notification_service.send_sms(phone, sms)
                except Exception as e:
                    logging.error(f"Admin SMS notification error: {e}")
            
            # Email notification
            if admin.get('email') and _notification_service and _notification_service.sendgrid_client:
                try:
                    html = f"""
                    <div style="font-family: Arial; max-width: 500px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h2 style="color: white; margin: 0;">💰 Pago Recibido</h2>
                        </div>
                        <div style="background: white; padding: 25px; border: 1px solid #e5e7eb;">
                            <p style="font-size: 28px; font-weight: bold; color: #059669; text-align: center;">${amount:.2f}</p>
                            <table style="width: 100%; font-size: 14px;">
                                <tr><td style="padding: 6px; color: #6b7280;">Cliente</td><td style="padding: 6px; text-align: right; font-weight: bold;">{payer_name}</td></tr>
                                <tr><td style="padding: 6px; color: #6b7280;">Método</td><td style="padding: 6px; text-align: right;">{method}</td></tr>
                                <tr><td style="padding: 6px; color: #6b7280;">Tipo</td><td style="padding: 6px; text-align: right;">{payment_type}</td></tr>
                                {'<tr><td style="padding: 6px; color: #6b7280;">Concepto</td><td style="padding: 6px; text-align: right;">' + description + '</td></tr>' if description else ''}
                                {'<tr><td style="padding: 6px; color: #6b7280;">TX ID</td><td style="padding: 6px; text-align: right; font-family: monospace; font-size: 11px;">' + str(transaction_id) + '</td></tr>' if transaction_id else ''}
                            </table>
                        </div>
                        <div style="background: #f9fafb; padding: 10px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: 0;">
                            <p style="color: #9ca3af; font-size: 11px; margin: 0;">Procesado por Merchant One (NMI)</p>
                        </div>
                    </div>
                    """
                    await _notification_service.send_email(
                        admin['email'],
                        f"💰 Pago Recibido: ${amount:.2f} de {payer_name}",
                        html
                    )
                except Exception as e:
                    logging.error(f"Admin email notification error: {e}")
        
        logging.info(f"🔔 Admin notified: ${amount:.2f} payment from {payer_name}")
    except Exception as e:
        logging.error(f"Error notifying admin of payment: {e}")

async def _send_payment_receipt(link: dict, payer_name: str, payer_email: str, payer_phone: str, method: str, last4: str, transaction_id: str):
    """Send payment confirmation receipt via SMS and Email"""
    global _notification_service
    if not _notification_service:
        return
    
    amount = link.get('amount', 0)
    desc = link.get('description', '')
    
    # SMS Receipt
    if payer_phone:
        try:
            phone = payer_phone.strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            if not phone.startswith('+'):
                if not phone.startswith('1'):
                    phone = '1' + phone
                phone = '+' + phone
            
            sms = f"✅ Ross Tax - Recibo de Pago\n\nHola {payer_name},\nTu pago de ${amount:.2f} fue procesado exitosamente.\n{method} ****{last4}\nGracias por tu pago!"
            if _notification_service.twilio_client:
                await _notification_service.send_sms(phone, sms)
                logging.info(f"📱 Receipt SMS sent to {phone}")
        except Exception as e:
            logging.error(f"Receipt SMS error: {e}")
    
    # Email Receipt
    if payer_email:
        try:
            receipt_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 30px;">✅</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px;">¡Pago Exitoso!</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Recibo de pago</p>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb;">
                    <p style="color: #374151; font-size: 16px;">Hola <strong>{payer_name}</strong>,</p>
                    <p style="color: #6b7280;">Tu pago ha sido procesado exitosamente.</p>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Monto</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 20px; color: #059669;">${amount:.2f}</td></tr>
                            {f'<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Concepto</td><td style="padding: 8px 0; text-align: right; color: #374151;">{desc}</td></tr>' if desc else ''}
                            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Método</td><td style="padding: 8px 0; text-align: right; color: #374151;">{method} ****{last4}</td></tr>
                            {f'<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transacción</td><td style="padding: 8px 0; text-align: right; font-family: monospace; color: #374151; font-size: 12px;">{transaction_id}</td></tr>' if transaction_id else ''}
                            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha</td><td style="padding: 8px 0; text-align: right; color: #374151;">{datetime.now().strftime('%d/%m/%Y %H:%M')}</td></tr>
                        </table>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">Guarda este recibo para tus registros.</p>
                </div>
                <div style="background: #f9fafb; padding: 15px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: 0;">
                    <p style="color: #9ca3af; font-size: 11px; margin: 0;">Ross Tax Preparation LLC • (806) 934-2018</p>
                </div>
            </div>
            """
            if _notification_service.sendgrid_client:
                await _notification_service.send_email(
                    payer_email,
                    f"✅ Recibo de Pago - Ross Tax ${amount:.2f}",
                    receipt_html
                )
                logging.info(f"📧 Receipt email sent to {payer_email}")
        except Exception as e:
            logging.error(f"Receipt email error: {e}")

class CreatePaymentLinkRequest(BaseModel):
    amount: float = 0
    description: str = ""
    client_name: str = ""
    client_email: str = ""
    client_phone: str = ""
    save_card: bool = True
    send_sms: bool = False
    send_email: bool = False
    expires_in: str = "7d"
    open_amount: bool = False  # True = client chooses amount

@payment_links_router.post('/payment-links')
async def create_payment_link(
    data: CreatePaymentLinkRequest,
    request: Request
):
    current_user = await _auth_user(request)

    """Create a shareable payment link and optionally send via SMS/Email"""
    try:
        import secrets
        token = secrets.token_urlsafe(24)
        
        link_doc = {
            'token': token,
            'amount': data.amount,
            'description': data.description,
            'client_name': data.client_name,
            'client_email': data.client_email,
            'client_phone': data.client_phone,
            'save_card': data.save_card,
            'open_amount': data.open_amount,
            'status': 'pending',
            'created_by': current_user.get('email'),
            'created_at': datetime.now(timezone.utc),
            'paid_at': None,
            'payment_method_id': None,
            'transaction_id': None,
            'sms_sent': False,
            'email_sent': False,
        }
        
        # Calculate expiration
        from datetime import timedelta
        exp_map = {'24h': timedelta(hours=24), '48h': timedelta(hours=48), '7d': timedelta(days=7), '30d': timedelta(days=30)}
        if data.expires_in in exp_map:
            link_doc['expires_at'] = datetime.now(timezone.utc) + exp_map[data.expires_in]
        else:
            link_doc['expires_at'] = None  # never
        
        result = await _db.payment_links.insert_one(link_doc)
        link_doc['id'] = str(result.inserted_id)
        link_doc['_id'] = str(result.inserted_id)
        link_doc['created_at'] = link_doc['created_at'].isoformat()
        
        # Build the payment URL
        payment_url = f"https://www.rosstaxpreparation.com/pay/{token}"
        
        logging.info(f"🔗 Payment link created by {current_user.get('email')}: ${data.amount} token={token}")
        
        # Send SMS if phone number provided AND admin chose to send SMS
        sms_sent = False
        if data.send_sms and data.client_phone:
            try:
                phone = data.client_phone.strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
                if not phone.startswith('+'):
                    if not phone.startswith('1'):
                        phone = '1' + phone
                    phone = '+' + phone
                
                sms_message = (
                    f"Ross Tax Preparation - Link de Pago\n\n"
                    f"Hola {data.client_name or 'Cliente'},\n"
                )
                if data.open_amount:
                    sms_message += "Tienes un pago pendiente."
                else:
                    sms_message += f"Tienes un pago pendiente de ${data.amount:.2f}"
                if data.description:
                    sms_message += f" por: {data.description}"
                sms_message += f"\n\nPaga aquí: {payment_url}"
                
                global _notification_service
                if _notification_service and _notification_service.twilio_client:
                    sms_sent = await _notification_service.send_sms(phone, sms_message)
                    if sms_sent:
                        logging.info(f"📱 SMS sent to {phone} for payment link {token}")
                        await _db.payment_links.update_one(
                            {'_id': result.inserted_id},
                            {'$set': {'sms_sent': True}}
                        )
                else:
                    logging.warning("⚠️ Notification service not available for SMS")
            except Exception as sms_err:
                logging.error(f"SMS send error: {sms_err}")
        
        # Send Email if email provided AND admin chose to send email
        email_sent = False
        if data.send_email and data.client_email:
            try:
                email_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #991b1b, #7f1d1d); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">🏛️ Ross Tax Preparation</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0;">Link de Pago Seguro</p>
                    </div>
                    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb;">
                        <p style="color: #374151; font-size: 16px;">Hola <strong>{data.client_name or 'Cliente'}</strong>,</p>
                        <p style="color: #6b7280;">Tienes un pago pendiente:</p>
                        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                            <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0;">Total a pagar</p>
                            <p style="color: #111827; font-size: 36px; font-weight: bold; margin: 5px 0;">{'Monto abierto' if data.open_amount else f'${data.amount:.2f}'}</p>
                            {f'<p style="color: #6b7280; margin: 5px 0;">{data.description}</p>' if data.description else ''}
                        </div>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{payment_url}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #991b1b, #7f1d1d); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">
                                🔒 Pagar Ahora
                            </a>
                        </div>
                        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Pago seguro procesado por NMI • SSL Encriptado</p>
                    </div>
                    <div style="background: #f9fafb; padding: 15px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: 0;">
                        <p style="color: #9ca3af; font-size: 11px; margin: 0;">Ross Tax Preparation LLC • (806) 934-2018</p>
                    </div>
                </div>
                """
                
                if _notification_service and _notification_service.sendgrid_client:
                    email_sent = await _notification_service.send_email(
                        data.client_email,
                        f"Ross Tax - Link de Pago: ${data.amount:.2f}",
                        email_html
                    )
                    if email_sent:
                        logging.info(f"📧 Email sent to {data.client_email} for payment link {token}")
                        await _db.payment_links.update_one(
                            {'_id': result.inserted_id},
                            {'$set': {'email_sent': True}}
                        )
                else:
                    logging.warning("⚠️ Notification service not available for email")
            except Exception as email_err:
                logging.error(f"Email send error: {email_err}")
        
        link_doc['sms_sent'] = sms_sent
        link_doc['email_sent'] = email_sent
        link_doc['payment_url'] = payment_url
        
        return {'success': True, 'link': link_doc, 'token': token, 'sms_sent': sms_sent, 'email_sent': email_sent}
    except Exception as e:
        logging.error(f"Error creating payment link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.get('/payment-links')
async def list_payment_links(
    request: Request,

    status: Optional[str] = None

):
    """List all payment links (admin)"""
    try:
        query = {}
        if status and status != 'all':
            query['status'] = status
        
        links = await _db.payment_links.find(query).sort('created_at', -1).to_list(500)
        result = []
        for link in links:
            link['id'] = str(link.pop('_id'))
            if link.get('created_at'):
                link['created_at'] = link['created_at'].isoformat()
            if link.get('paid_at'):
                link['paid_at'] = link['paid_at'].isoformat()
            if link.get('expires_at'):
                link['expires_at'] = link['expires_at'].isoformat()
            result.append(link)
        
        return {'success': True, 'links': result, 'count': len(result)}
    except Exception as e:
        logging.error(f"Error listing payment links: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.delete('/payment-links/{link_id}')
async def cancel_payment_link(
    link_id: str,
    request: Request
):
    """Cancel/delete a payment link"""
    try:
        result = None
        if ObjectId.is_valid(link_id):
            result = await _db.payment_links.update_one(
                {'_id': ObjectId(link_id), 'status': 'pending'},
                {'$set': {'status': 'cancelled'}}
            )
        if not result or result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Link no encontrado o ya procesado")
        
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error cancelling payment link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.post('/payment-links/{link_id}/resend')
async def resend_payment_link(
    link_id: str,
    request: Request,
):
    """Resend SMS/Email for an existing pending payment link"""
    try:
        body = await request.json()
        resend_sms = body.get('send_sms', False)
        resend_email = body.get('send_email', False)
        
        link = None
        if ObjectId.is_valid(link_id):
            link = await _db.payment_links.find_one({'_id': ObjectId(link_id), 'status': 'pending'})
        if not link:
            raise HTTPException(status_code=404, detail="Link no encontrado o ya procesado")
        
        payment_url = f"https://www.rosstaxpreparation.com/pay/{link['token']}"
        sms_sent = False
        email_sent = False
        
        global _notification_service
        
        if resend_sms and link.get('client_phone'):
            try:
                phone = link['client_phone'].strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
                if not phone.startswith('+'):
                    if not phone.startswith('1'):
                        phone = '1' + phone
                    phone = '+' + phone
                
                sms_message = (
                    f"Ross Tax Preparation - Link de Pago\n\n"
                    f"Hola {link.get('client_name', 'Cliente')},\n"
                    f"Tienes un pago pendiente de ${link['amount']:.2f}"
                )
                if link.get('description'):
                    sms_message += f" por: {link['description']}"
                sms_message += f"\n\nPaga aquí: {payment_url}"
                
                if _notification_service and _notification_service.twilio_client:
                    sms_sent = await _notification_service.send_sms(phone, sms_message)
            except Exception as e:
                logging.error(f"Resend SMS error: {e}")
        
        if resend_email and link.get('client_email'):
            try:
                email_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #991b1b, #7f1d1d); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">🏛️ Ross Tax Preparation</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0;">Recordatorio - Link de Pago</p>
                    </div>
                    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb;">
                        <p style="color: #374151; font-size: 16px;">Hola <strong>{link.get('client_name', 'Cliente')}</strong>,</p>
                        <p style="color: #6b7280;">Te recordamos que tienes un pago pendiente:</p>
                        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                            <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0;">Total a pagar</p>
                            <p style="color: #111827; font-size: 36px; font-weight: bold; margin: 5px 0;">${link['amount']:.2f}</p>
                            {f'<p style="color: #6b7280; margin: 5px 0;">{link["description"]}</p>' if link.get('description') else ''}
                        </div>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{payment_url}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #991b1b, #7f1d1d); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">🔒 Pagar Ahora</a>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 15px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: 0;">
                        <p style="color: #9ca3af; font-size: 11px; margin: 0;">Ross Tax Preparation LLC • (806) 934-2018</p>
                    </div>
                </div>
                """
                if _notification_service and _notification_service.sendgrid_client:
                    email_sent = await _notification_service.send_email(
                        link['client_email'],
                        f"Recordatorio - Ross Tax Pago: ${link['amount']:.2f}",
                        email_html
                    )
            except Exception as e:
                logging.error(f"Resend email error: {e}")
        
        return {'success': True, 'sms_sent': sms_sent, 'email_sent': email_sent}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error resending payment link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.delete('/payment-links/cleanup/test')
async def cleanup_test_links(
    request: Request
):
    """Delete all test/low-amount payment links"""
    try:
        result = await _db.payment_links.delete_many({
            '$or': [
                {'description': {'$regex': 'test|Test|TEST|deploy|check|prueba.*deploy', '$options': 'i'}},
                {'client_name': {'$regex': 'test|Test|Deploy', '$options': 'i'}},
                {'amount': {'$lte': 1.0}},
            ]
        })
        return {'success': True, 'deleted': result.deleted_count}
    except Exception as e:
        logging.error(f"Error cleaning up test links: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---- PUBLIC endpoints (no auth required) ----

@payment_links_router.post('/public/open-payment')
async def process_open_payment(request: Request):
    """Process an open/free-form payment - client chooses the amount"""
    try:
        body = await request.json()
        payment_type = body.get('payment_type', 'card')
        amount = float(body.get('amount', 0))
        payer_name = body.get('payer_name', body.get('cardholder_name', ''))
        payer_email = body.get('email', '')
        payer_phone = body.get('phone', '')
        description = body.get('description', 'Pago abierto')
        
        if amount < 1:
            raise HTTPException(status_code=400, detail="El monto mínimo es $1.00")
        if not payer_name:
            raise HTTPException(status_code=400, detail="Nombre requerido")
        
        from merchant_one_service import (
            MerchantOneService, MERCHANT_ONE_SECURITY_KEY,
            is_merchant_success, extract_merchant_error,
            detect_card_brand, build_card_vault_payload
        )
        
        merchant_service_instance = MerchantOneService(_db)
        transaction_id = None
        brand = ''
        last4 = ''
        
        if payment_type == 'card':
            card_number = body.get('card_number', '').replace(' ', '').replace('-', '')
            cvv = body.get('cvv', '')
            exp_month = body.get('exp_month', '')
            exp_year = body.get('exp_year', '')
            
            if not card_number or len(card_number) < 13:
                raise HTTPException(status_code=400, detail="Número de tarjeta inválido")
            
            brand = detect_card_brand(card_number)
            last4 = card_number[-4:]
            
            name_parts = payer_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Add to NMI vault
            payload, vault_id = build_card_vault_payload(
                card_number=card_number,
                exp_month=int(exp_month),
                exp_year=int(exp_year),
                cvv=cvv,
                first_name=first_name,
                last_name=last_name,
                email=payer_email,
            )
            
            vault_response = await merchant_service_instance._make_request(payload)
            if not is_merchant_success(vault_response):
                error_msg = extract_merchant_error(vault_response)
                raise HTTPException(status_code=400, detail=f"Error al procesar tarjeta: {error_msg}")
            
            # Charge
            charge_payload = {
                'security_key': MERCHANT_ONE_SECURITY_KEY,
                'customer_vault_id': vault_id,
                'amount': f"{amount:.2f}",
                'type': 'sale',
                'order_description': description,
            }
            charge_response = await merchant_service_instance._make_request(charge_payload)
            if not is_merchant_success(charge_response):
                error_msg = extract_merchant_error(charge_response)
                raise HTTPException(status_code=400, detail=f"Error al cobrar: {error_msg}")
            
            transaction_id = getattr(charge_response, 'transactionId', None)
            
            # Encrypt and store card
            try:
                from encryption_service import get_encryption_service
                enc_svc = get_encryption_service()
                encrypted_number = enc_svc.encrypt(card_number)
                encrypted_cvv = enc_svc.encrypt(cvv)
            except Exception:
                encrypted_number = ''
                encrypted_cvv = ''
            
            import hashlib
            await _db.payment_methods.insert_one({
                'cardholder_name': payer_name,
                'user_email': payer_email,
                'brand': brand,
                'card_brand': brand,
                'last4': last4,
                'last_4': last4,
                'exp_month': exp_month,
                'exp_year': exp_year,
                'nmi_vault_id': vault_id,
                'card_hash': hashlib.sha256(card_number.encode()).hexdigest(),
                'is_default': False,
                'active': True,
                'payment_type': 'credit_card',
                'source': 'open_payment',
                'encrypted_number': encrypted_number,
                'encrypted_cvv': encrypted_cvv,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            })
        
        elif payment_type == 'bank':
            routing_number = body.get('routing_number', '')
            account_number = body.get('account_number', '')
            account_type = body.get('account_type', 'checking')
            
            if not routing_number or not account_number:
                raise HTTPException(status_code=400, detail="Datos bancarios incompletos")
            
            last4 = account_number[-4:]
            brand = 'ACH'
            
            ach_payload = {
                'security_key': MERCHANT_ONE_SECURITY_KEY,
                'type': 'sale',
                'payment': 'check',
                'amount': f"{amount:.2f}",
                'checkname': payer_name,
                'checkaba': routing_number,
                'checkaccount': account_number,
                'account_type': account_type,
                'order_description': description,
                'email': payer_email,
            }
            ach_response = await merchant_service_instance._make_request(ach_payload)
            if not is_merchant_success(ach_response):
                error_msg = extract_merchant_error(ach_response)
                raise HTTPException(status_code=400, detail=f"Error al procesar pago: {error_msg}")
            
            transaction_id = getattr(ach_response, 'transactionid', None)
        else:
            raise HTTPException(status_code=400, detail="Tipo de pago no soportado")
        
        # Log the open payment
        await _db.open_payments.insert_one({
            'payer_name': payer_name,
            'payer_email': payer_email,
            'payer_phone': payer_phone,
            'amount': amount,
            'description': description,
            'payment_type': payment_type,
            'brand': brand,
            'last4': last4,
            'transaction_id': transaction_id,
            'created_at': datetime.now(timezone.utc),
        })
        
        logging.info(f"✅ Open payment: ${amount} {brand} ****{last4} from {payer_name}")
        
        # Send receipt
        link_data = {'amount': amount, 'description': description, 'client_phone': payer_phone}
        await _send_payment_receipt(link_data, payer_name, payer_email, payer_phone, brand, last4, transaction_id or '')
        
        return {
            'success': True,
            'message': 'Pago procesado exitosamente',
            'transaction_id': transaction_id,
            'amount': amount,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Open payment error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.get('/public/payment-links/{token}')
async def get_public_payment_link(token: str):
    """Get payment link details (public, for client page)"""
    try:
        link = await _db.payment_links.find_one({'token': token})
        if not link:
            raise HTTPException(status_code=404, detail="Link de pago no encontrado")
        
        if link.get('status') == 'paid':
            return {'success': False, 'error': 'already_paid', 'message': 'Este link ya fue pagado'}
        if link.get('status') == 'cancelled':
            return {'success': False, 'error': 'cancelled', 'message': 'Este link fue cancelado'}
        if link.get('status') == 'expired':
            return {'success': False, 'error': 'expired', 'message': 'Este link ha expirado'}
        
        # Check expiration
        expires_at = link.get('expires_at')
        if expires_at and datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc) if expires_at.tzinfo is None else expires_at:
            await _db.payment_links.update_one({'_id': link['_id']}, {'$set': {'status': 'expired'}})
            return {'success': False, 'error': 'expired', 'message': 'Este link ha expirado'}
        
        return {
            'success': True,
            'link': {
                'amount': link['amount'],
                'description': link.get('description', ''),
                'client_name': link.get('client_name', ''),
                'client_email': link.get('client_email', ''),
                'status': link['status'],
                'open_amount': link.get('open_amount', False),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting payment link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@payment_links_router.post('/public/payment-links/{token}/pay')
async def process_payment_link(token: str, request: Request):
    """Process a public payment via payment link - stores card in encrypted vault"""
    try:
        link = await _db.payment_links.find_one({'token': token})
        if not link:
            raise HTTPException(status_code=404, detail="Link de pago no encontrado")
        if link.get('status') != 'pending':
            raise HTTPException(status_code=400, detail="Este link ya no está disponible")
        
        body = await request.json()
        payment_type = body.get('payment_type', 'card')  # 'card' or 'bank'
        
        # Determine the charge amount
        if link.get('open_amount'):
            custom_amount = body.get('custom_amount')
            if not custom_amount or float(custom_amount) < 1:
                raise HTTPException(status_code=400, detail="Monto inválido. Mínimo $1.00")
            charge_amount = float(custom_amount)
        else:
            charge_amount = link['amount']
        
        cardholder_name = body.get('cardholder_name', link.get('client_name', ''))
        client_email = body.get('email', link.get('client_email', ''))
        
        from merchant_one_service import (
            MerchantOneService, MERCHANT_ONE_SECURITY_KEY,
            is_merchant_success, extract_merchant_error,
            detect_card_brand
        )
        
        merchant_service_instance = MerchantOneService(_db)
        vault_id = None
        last4 = ''
        brand = ''
        exp_month = ''
        exp_year = ''
        encrypted_number = ''
        encrypted_cvv = ''
        card_hash = ''
        
        if payment_type == 'card':
            card_number = body.get('card_number', '').replace(' ', '').replace('-', '')
            cvv = body.get('cvv', '')
            exp_month = body.get('exp_month', '')
            exp_year = body.get('exp_year', '')
            
            if not card_number or len(card_number) < 13:
                raise HTTPException(status_code=400, detail="Número de tarjeta inválido")
            
            brand = detect_card_brand(card_number)
            last4 = card_number[-4:]
            
            import hashlib
            card_hash = hashlib.sha256(card_number.encode()).hexdigest()
            
            # Parse name
            name_parts = cardholder_name.split(' ', 1)
            first_name = name_parts[0] if name_parts else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Step 1: Add to NMI vault
            from merchant_one_service import build_card_vault_payload, extract_vault_id
            payload, generated_vault_id = build_card_vault_payload(
                card_number=card_number,
                exp_month=int(exp_month),
                exp_year=int(exp_year),
                cvv=cvv,
                first_name=first_name,
                last_name=last_name,
                email=client_email,
            )
            
            vault_response = await merchant_service_instance._make_request(payload)
            if not is_merchant_success(vault_response):
                error_msg = extract_merchant_error(vault_response)
                raise HTTPException(status_code=400, detail=f"Error al procesar tarjeta: {error_msg}")
            
            vault_id = generated_vault_id
            
            # Step 2: Charge the vaulted card
            charge_payload = {
                'security_key': MERCHANT_ONE_SECURITY_KEY,
                'customer_vault_id': vault_id,
                'amount': f"{charge_amount:.2f}",
                'type': 'sale',
                'order_description': link.get('description', f"Pago via link"),
            }
            
            charge_response = await merchant_service_instance._make_request(charge_payload)
            if not is_merchant_success(charge_response):
                error_msg = extract_merchant_error(charge_response)
                raise HTTPException(status_code=400, detail=f"Error al cobrar: {error_msg}")
            
            transaction_id = getattr(charge_response, 'transactionId', None)
            
            # Step 3: Encrypt and store card data
            try:
                from encryption_service import get_encryption_service
                enc_svc = get_encryption_service()
                encrypted_number = enc_svc.encrypt(card_number)
                encrypted_cvv = enc_svc.encrypt(cvv)
            except Exception as enc_err:
                logging.warning(f"⚠️ Could not encrypt card data: {enc_err}")
            
            # Save in payment_methods collection (same as app flow)
            payment_method = {
                'cardholder_name': cardholder_name,
                'user_email': client_email,
                'brand': brand,
                'card_brand': brand,
                'last4': last4,
                'last_4': last4,
                'exp_month': exp_month,
                'exp_year': exp_year,
                'nmi_vault_id': vault_id,
                'card_hash': card_hash,
                'is_default': False,
                'active': True,
                'payment_type': 'credit_card',
                'source': 'payment_link',
                'encrypted_number': encrypted_number,
                'encrypted_cvv': encrypted_cvv,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            pm_result = await _db.payment_methods.insert_one(payment_method)
            
            # Update link status
            await _db.payment_links.update_one(
                {'_id': link['_id']},
                {'$set': {
                    'status': 'paid',
                    'paid_at': datetime.now(timezone.utc),
                    'payment_method_id': str(pm_result.inserted_id),
                    'transaction_id': transaction_id,
                    'paid_brand': brand,
                    'paid_last4': last4,
                    'payer_name': cardholder_name,
                    'payer_email': client_email,
                    'paid_amount': charge_amount,
                }}
            )
            
            logging.info(f"✅ Payment link {token} paid: ${charge_amount} {brand} ****{last4}")
            
            # Send payment receipt to client
            link['amount'] = charge_amount  # Update for receipt
            await _send_payment_receipt(link, cardholder_name, client_email, link.get('client_phone'), brand, last4, transaction_id)
            
            # 🔔 Notify admin about the payment
            await _notify_admin_payment_received(
                payer_name=cardholder_name,
                amount=charge_amount,
                method=f"{brand} ****{last4}",
                description=link.get('description', ''),
                transaction_id=transaction_id,
                payment_type='Link de Pago'
            )
            
            return {
                'success': True,
                'message': 'Pago procesado exitosamente',
                'transaction_id': transaction_id,
                'amount': charge_amount,
            }
        
        elif payment_type == 'bank':
            account_name = body.get('account_name', cardholder_name)
            routing_number = body.get('routing_number', '')
            account_number = body.get('account_number', '')
            account_type = body.get('account_type', 'checking')
            
            if not routing_number or not account_number:
                raise HTTPException(status_code=400, detail="Datos bancarios incompletos")
            
            last4 = account_number[-4:]
            
            # Process ACH payment via NMI
            ach_payload = {
                'security_key': MERCHANT_ONE_SECURITY_KEY,
                'type': 'sale',
                'payment': 'check',
                'amount': f"{charge_amount:.2f}",
                'checkname': account_name,
                'checkaba': routing_number,
                'checkaccount': account_number,
                'account_type': account_type,
                'order_description': link.get('description', f"Pago ACH via link"),
                'email': client_email,
            }
            
            ach_response = await merchant_service_instance._make_request(ach_payload)
            if not is_merchant_success(ach_response):
                error_msg = extract_merchant_error(ach_response)
                raise HTTPException(status_code=400, detail=f"Error al procesar pago: {error_msg}")
            
            transaction_id = getattr(ach_response, 'transactionid', None)
            
            # Update link status
            await _db.payment_links.update_one(
                {'_id': link['_id']},
                {'$set': {
                    'status': 'paid',
                    'paid_at': datetime.now(timezone.utc),
                    'transaction_id': transaction_id,
                    'paid_brand': 'ACH',
                    'paid_last4': last4,
                    'payer_name': account_name,
                    'payer_email': client_email,
                    'paid_amount': charge_amount,
                }}
            )
            
            logging.info(f"✅ Payment link {token} paid via ACH: ${charge_amount} ****{last4}")
            
            # Send payment receipt
            link['amount'] = charge_amount  # Update for receipt
            await _send_payment_receipt(link, account_name, client_email, link.get('client_phone'), 'ACH', last4, transaction_id)
            
            # 🔔 Notify admin about the ACH payment
            await _notify_admin_payment_received(
                payer_name=account_name,
                amount=charge_amount,
                method=f"ACH ****{last4}",
                description=link.get('description', ''),
                transaction_id=transaction_id,
                payment_type='Link de Pago (ACH)'
            )
            
            return {
                'success': True,
                'message': 'Pago ACH procesado exitosamente',
                'transaction_id': transaction_id,
                'amount': charge_amount,
            }
        
        else:
            raise HTTPException(status_code=400, detail="Tipo de pago no soportado")
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing payment link {token}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
