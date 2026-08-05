"""
Service & Payment Routes Router
Extracted from server.py - Handles complete service flow, invoice payment links,
affiliate links, withdrawals, and Stripe configuration.
"""
import os, logging, uuid, json, stripe
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId
try:
    from affiliate_models import AffiliateLink, AffiliateUpdateRequest
except ImportError:
    pass

try:
    from withdrawal_models import CreateBankAccountRequest, CreateWithdrawalRequest, ProcessWithdrawalRequest
except ImportError:
    pass

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

def init_service_payment_router(db):
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


# ================== COMPLETE SERVICE FLOW ==================
# ================== COMPLETE SERVICE FLOW (After Appointment) ==================

@router.post('/admin/appointments/{appointment_id}/complete-service')
async def complete_appointment_service(
    appointment_id: str,
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(_require_admin)
):
    """
    Complete appointment service flow:
    1. Mark appointment as completed
    2. Create tax return(s) with refund info
    3. Create invoice for service
    4. Send thank you + feedback notifications
    5. Add client to IRS tracking flow
    """
    try:
        logging.info(f'📋 Complete service flow for appointment: {appointment_id}')
        
        # Find appointment
        appointment = None
        query_id = None
        
        if len(appointment_id) == 24:
            try:
                query_id = ObjectId(appointment_id)
                appointment = await _db.appointments.find_one({'_id': query_id})
            except:
                pass
        
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
            if appointment:
                query_id = appointment_id
        
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        if not appointment:
            appointment = await _db.appointments.find_one({'square_id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Get client info
        user_id = appointment.get('user_id')
        client_name = appointment.get('user_name', 'Cliente')
        client_email = appointment.get('user_email')
        client_phone = appointment.get('user_phone')
        
        # Try to get user from DB for more info
        user = None
        if user_id:
            user = await _db.users.find_one({'_id': user_id})
            if not user:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not user:
                user = await _db.users.find_one({'id': user_id})
        
        if user:
            client_name = user.get('full_name') or user.get('name', client_name)
            client_email = user.get('email', client_email)
            client_phone = user.get('phone', client_phone)
            user_id = str(user.get('_id'))
        
        # Mark appointment as completed
        if query_id:
            await _db.appointments.update_one(
                {'_id': query_id},
                {'$set': {
                    'status': 'completed',
                    'completed_at': datetime.now(timezone.utc),
                    'attended': True,
                    'completed_by': current_user.get('name', 'Admin')
                }}
            )
        
        results = {
            'appointment_completed': True,
            'tax_returns_created': [],
            'invoice_created': None,
            'notifications_sent': {'sms': False, 'email': False}
        }
        
        # ===== CREATE TAX RETURNS =====
        tax_returns_data = request.get('tax_returns', [])
        for tr_data in tax_returns_data:
            tax_return_id = str(uuid.uuid4())
            tax_year = tr_data.get('tax_year', str(datetime.now().year - 1))  # Tax season: filing for previous year
            
            tax_return = {
                'id': tax_return_id,
                'appointment_id': appointment_id,
                'client_id': user_id,
                'client_name': client_name,
                'client_email': client_email,
                'client_phone': client_phone,
                'tax_year': tax_year,
                'total_income': tr_data.get('total_income'),
                'federal_refund': tr_data.get('federal_refund'),
                'state_refund': tr_data.get('state_refund'),
                'refund_amount': (tr_data.get('federal_refund') or 0) + (tr_data.get('state_refund') or 0),
                'status': 'submitted',  # Starts as submitted to IRS
                'notes': tr_data.get('notes'),
                'created_by': current_user.get('name', 'Admin'),
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            
            await _db.admin_tax_returns.insert_one(tax_return)
            results['tax_returns_created'].append({
                'id': tax_return_id,
                'tax_year': tax_year,
                'refund_amount': tax_return['refund_amount']
            })
            logging.info(f'✅ Tax return created: {tax_return_id} for year {tax_year}')
        
        # ===== CREATE INVOICE =====
        invoice_data = request.get('invoice')
        if invoice_data:
            invoice_id = str(uuid.uuid4())
            invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{invoice_id[:8].upper()}"
            
            invoice = {
                'id': invoice_id,
                'invoice_number': invoice_number,
                'appointment_id': appointment_id,
                'user_id': user_id,
                'client_name': client_name,
                'client_email': client_email,
                'client_phone': client_phone,
                'service_type': invoice_data.get('service_type', 'Declaración de Impuestos'),
                'description': invoice_data.get('description', f'Preparación de declaración de impuestos'),
                'amount': invoice_data.get('amount', 180.00),
                'tax_years': [tr.get('tax_year') for tr in tax_returns_data] if tax_returns_data else [],
                'status': 'pending',
                'due_date': datetime.now(timezone.utc) + timedelta(days=30),
                'created_by': current_user.get('name', 'Admin'),
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            }
            
            await _db.invoices.insert_one(invoice)
            results['invoice_created'] = {
                'id': invoice_id,
                'invoice_number': invoice_number,
                'amount': invoice['amount']
            }
            logging.info(f'✅ Invoice created: {invoice_number} for ${invoice["amount"]}')
        
        # ===== SEND NOTIFICATIONS =====
        send_notifications = request.get('send_notifications', True)
        if send_notifications:
            try:
                config_doc = await _db.api_config.find_one({'_id': 'main'})
                if config_doc:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    
                    first_name = client_name.split()[0] if client_name else 'Cliente'
                    
                    # Build refund summary
                    refund_summary = ""
                    total_refund = 0
                    for tr in results['tax_returns_created']:
                        total_refund += tr.get('refund_amount', 0)
                        refund_summary += f"\n   📅 Año {tr['tax_year']}: ${tr['refund_amount']:,.2f}"
                    
                    # Feedback URL
                    import secrets
                    feedback_token = secrets.token_urlsafe(32)
                    feedback_url = f"https://www.rosstaxpreparation.com/feedback/{feedback_token}"
                    google_review_url = "https://g.page/r/Ca-92RHBZeMzEBM/review"
                    
                    # Create feedback request
                    feedback_request = {
                        'appointment_id': appointment_id,
                        'user_id': user_id or '',
                        'user_name': client_name,
                        'user_email': client_email,
                        'user_phone': client_phone,
                        'token': feedback_token,
                        'status': 'pending',
                        'created_at': datetime.now(timezone.utc),
                        'expires_at': datetime.now(timezone.utc) + timedelta(days=7)
                    }
                    await _db.feedback_requests.insert_one(feedback_request)
                    
                    # ===== SEND SMS =====
                    if client_phone and notif_service.twilio_client:
                        sms_message = f"""🎉 ¡Gracias por tu visita, {first_name}!

Tu declaración está en proceso con el IRS.
{refund_summary}

💰 Total estimado: ${total_refund:,.2f}

Te notificaremos cuando sea aceptada.

⭐ ¿Nos ayudas con una reseña?
{google_review_url}

Ross Tax: (806) 934-2018"""
                        
                        try:
                            phone = client_phone.replace(' ', '').replace('-', '')
                            if not phone.startswith('+'):
                                phone = '+1' + phone
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=phone
                            )
                            results['notifications_sent']['sms'] = True
                            logging.info(f'✅ Thank you SMS sent to {phone}')
                        except Exception as sms_err:
                            logging.error(f'❌ SMS error: {sms_err}')
                    
                    # ===== SEND EMAIL =====
                    if client_email and notif_service.sendgrid_client:
                        # Build tax returns table
                        tax_rows = ""
                        for tr in results['tax_returns_created']:
                            tax_rows += f"""
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">{tr['tax_year']}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #10B981; font-weight: bold;">${tr['refund_amount']:,.2f}</td>
                            </tr>
                            """
                        
                        invoice_section = ""
                        if results['invoice_created']:
                            inv = results['invoice_created']
                            invoice_section = f"""
                            <div style="background-color: #FEF3C7; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                <h3 style="color: #92400E; margin-top: 0;">💳 Factura Generada</h3>
                                <p style="color: #78350F; margin: 5px 0;"><strong>No.:</strong> {inv['invoice_number']}</p>
                                <p style="color: #78350F; margin: 5px 0;"><strong>Monto:</strong> ${inv['amount']:,.2f}</p>
                                <p style="color: #78350F; margin: 5px 0;"><strong>Estado:</strong> Pendiente</p>
                            </div>
                            """
                        
                        email_html = f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">🎉 ¡Gracias por tu visita!</h1>
                            </div>
                            
                            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hola {first_name},</h2>
                                
                                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                    Fue un placer atenderte hoy en Ross Tax Preparation. Tu declaración de impuestos 
                                    ya fue enviada al IRS y está en proceso.
                                </p>
                                
                                <div style="background-color: #D1FAE5; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                    <h3 style="color: #065F46; margin-top: 0;">📊 Resumen de tu Declaración</h3>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr style="background-color: #A7F3D0;">
                                            <th style="padding: 12px; text-align: left; color: #065F46;">Año Fiscal</th>
                                            <th style="padding: 12px; text-align: right; color: #065F46;">Reembolso Estimado</th>
                                        </tr>
                                        {tax_rows}
                                        <tr style="background-color: #10B981; color: white;">
                                            <td style="padding: 12px; font-weight: bold;">TOTAL</td>
                                            <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 18px;">${total_refund:,.2f}</td>
                                        </tr>
                                    </table>
                                </div>
                                
                                {invoice_section}
                                
                                <div style="background-color: #EFF6FF; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                    <h3 style="color: #1E40AF; margin-top: 0;">📋 ¿Qué sigue?</h3>
                                    <ol style="color: #1E3A8A; line-height: 1.8;">
                                        <li>El IRS procesará tu declaración (10-21 días)</li>
                                        <li>Te notificaremos cuando sea aceptada</li>
                                        <li>Recibirás tu reembolso por depósito directo</li>
                                    </ol>
                                </div>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <p style="color: #555; margin-bottom: 15px;">¿Nos ayudas con una reseña? Tu opinión nos ayuda mucho ⭐</p>
                                    <a href="{google_review_url}" style="display: inline-block; background-color: #FBBF24; color: #78350F; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                        ⭐ Dejar Reseña en Google
                                    </a>
                                </div>
                                
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                
                                <p style="color: #888; font-size: 14px; text-align: center;">
                                    ¿Preguntas? Llámenos al <strong>(806) 934-2018</strong><br>
                                    Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029
                                </p>
                                
                                <p style="color: #6C1110; text-align: center; font-size: 16px; margin-top: 20px;">
                                    ¡Gracias por confiar en Ross Tax! 🙏
                                </p>
                            </div>
                        </body>
                        </html>
                        """
                        
                        try:
                            await notif_service.send_email(
                                to_email=client_email,
                                subject="🎉 ¡Gracias por tu visita! - Tu declaración está en proceso",
                                html_content=email_html
                            )
                            results['notifications_sent']['email'] = True
                            logging.info(f'✅ Thank you email sent to {client_email}')
                        except Exception as email_err:
                            logging.error(f'❌ Email error: {email_err}')
                            
            except Exception as notif_error:
                logging.error(f'❌ Notification error: {notif_error}')
        
        # ===== ADD CLIENT TO MARKETING LIST =====
        try:
            if client_email:
                existing = await _db.marketing_list.find_one({'email': client_email})
                tax_year = tax_returns_data[0].get('tax_year') if tax_returns_data else str(datetime.now().year)
                
                if existing:
                    await _db.marketing_list.update_one(
                        {'email': client_email},
                        {'$set': {
                            'name': client_name,
                            'phone': client_phone,
                            'last_tax_year': tax_year,
                            'updated_at': datetime.now(timezone.utc),
                            'status': 'active'
                        },
                        '$addToSet': {
                            'tax_years_completed': tax_year
                        }}
                    )
                else:
                    await _db.marketing_list.insert_one({
                        'client_id': user_id,
                        'email': client_email,
                        'name': client_name,
                        'phone': client_phone,
                        'last_tax_year': tax_year,
                        'tax_years_completed': [tax_year],
                        'status': 'active',
                        'subscribed_at': datetime.now(timezone.utc),
                        'updated_at': datetime.now(timezone.utc),
                        'email_preferences': {'tips': True, 'news': True, 'promotions': True, 'reminders': True},
                        'campaigns_sent': [],
                        'last_email_sent': None
                    })
                logging.info(f'✅ Cliente agregado a marketing: {client_email}')
                results['added_to_marketing'] = True
        except Exception as marketing_error:
            logging.error(f'❌ Marketing list error: {marketing_error}')
        
        return {
            'success': True,
            'message': 'Servicio completado exitosamente',
            'results': results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error completing service: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



# ================== INVOICE PAYMENT LINKS ==================
# ================== INVOICE PAYMENT LINKS ==================

@router.post('/invoices/{invoice_id}/payment-link')
async def create_invoice_payment_link(
    invoice_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Create a Stripe payment link for an invoice"""
    try:
        # Find invoice
        invoice = await _db.invoices.find_one({'id': invoice_id})
        if not invoice:
            try:
                invoice = await _db.invoices.find_one({'_id': ObjectId(invoice_id)})
            except:
                pass
        
        if not invoice:
            raise HTTPException(status_code=404, detail='Factura no encontrada')
        
        if invoice.get('status') == 'paid':
            raise HTTPException(status_code=400, detail='Esta factura ya está pagada')
        
        # Get Stripe service
        from payment_service import get_stripe_service
        stripe_svc = get_stripe_service(_db)
        await stripe_svc.initialize()
        
        # Create payment link
        result = await stripe_svc.create_payment_link(
            amount=invoice.get('amount', 0),
            description=invoice.get('service_type', 'Servicio Ross Tax'),
            invoice_id=invoice_id,
            customer_email=invoice.get('client_email'),
            customer_name=invoice.get('client_name')
        )
        
        # Update invoice with payment link
        await _db.invoices.update_one(
            {'id': invoice_id},
            {'$set': {
                'payment_link': result['payment_url'],
                'stripe_session_id': result['session_id'],
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        
        return {
            'success': True,
            'payment_url': result['payment_url'],
            'expires_at': result['expires_at']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error creating payment link: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/invoices/{invoice_id}/send-payment-request')
async def send_invoice_payment_request(
    invoice_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Send payment request notification to client"""
    try:
        # Find invoice
        invoice = await _db.invoices.find_one({'id': invoice_id})
        if not invoice:
            try:
                invoice = await _db.invoices.find_one({'_id': ObjectId(invoice_id)})
            except:
                pass
        
        if not invoice:
            raise HTTPException(status_code=404, detail='Factura no encontrada')
        
        # Create payment link if doesn't exist
        payment_url = invoice.get('payment_link')
        if not payment_url:
            from payment_service import get_stripe_service
            stripe_svc = get_stripe_service(_db)
            await stripe_svc.initialize()
            
            result = await stripe_svc.create_payment_link(
                amount=invoice.get('amount', 0),
                description=invoice.get('service_type', 'Servicio Ross Tax'),
                invoice_id=invoice_id,
                customer_email=invoice.get('client_email')
            )
            payment_url = result['payment_url']
            
            await _db.invoices.update_one(
                {'id': invoice_id},
                {'$set': {
                    'payment_link': payment_url,
                    'stripe_session_id': result['session_id'],
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
        
        # Get notification service
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail='Configuración no encontrada')
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        client_name = invoice.get('client_name', 'Cliente')
        client_email = invoice.get('client_email')
        client_phone = invoice.get('client_phone')
        amount = invoice.get('amount', 0)
        invoice_number = invoice.get('invoice_number', invoice_id[:8].upper())
        first_name = client_name.split()[0] if client_name else 'Cliente'
        
        notifications_sent = {'sms': False, 'email': False}
        
        # Send SMS
        if client_phone and notif_service.twilio_client:
            sms_message = f"""💳 Solicitud de Pago - Ross Tax

Hola {first_name},

Factura: #{invoice_number}
Monto: ${amount:,.2f}

Paga fácilmente aquí:
{payment_url}

¿Preguntas? (806) 934-2018"""
            
            try:
                phone = client_phone.replace(' ', '').replace('-', '')
                if not phone.startswith('+'):
                    phone = '+1' + phone
                
                notif_service.twilio_client.messages.create(
                    body=sms_message,
                    from_=notif_service.twilio_phone_number,
                    to=phone
                )
                notifications_sent['sms'] = True
            except Exception as sms_err:
                logging.error(f'SMS error: {sms_err}')
        
        # Send Email
        if client_email and notif_service.sendgrid_client:
            email_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">💳 Solicitud de Pago</h1>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-top: 0;">Hola {first_name},</h2>
                    
                    <p style="color: #555; font-size: 16px;">
                        Gracias por confiar en Ross Tax Preparation. A continuación encontrará los detalles de su factura:
                    </p>
                    
                    <div style="background-color: #fff; border: 1px solid #eee; border-radius: 10px; padding: 20px; margin: 20px 0;">
                        <table style="width: 100%;">
                            <tr>
                                <td style="color: #666;">Factura No.:</td>
                                <td style="text-align: right; font-weight: bold;">#{invoice_number}</td>
                            </tr>
                            <tr>
                                <td style="color: #666;">Servicio:</td>
                                <td style="text-align: right;">{invoice.get('service_type', 'Preparación de Impuestos')}</td>
                            </tr>
                            <tr>
                                <td colspan="2"><hr style="border: none; border-top: 1px solid #eee;"></td>
                            </tr>
                            <tr>
                                <td style="color: #333; font-weight: bold; font-size: 18px;">Total:</td>
                                <td style="text-align: right; color: #6C1110; font-weight: bold; font-size: 24px;">${amount:,.2f}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{payment_url}" style="display: inline-block; background-color: #10B981; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                            💳 Pagar Ahora
                        </a>
                    </div>
                    
                    <p style="color: #888; font-size: 14px; text-align: center;">
                        Aceptamos todas las tarjetas de crédito y débito.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    
                    <p style="color: #888; font-size: 14px; text-align: center;">
                        ¿Preguntas? Llámenos al <strong>(806) 934-2018</strong><br>
                        Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029
                    </p>
                </div>
            </body>
            </html>
            """
            
            try:
                await notif_service.send_email(
                    to_email=client_email,
                    subject=f"💳 Solicitud de Pago - Factura #{invoice_number}",
                    html_content=email_html
                )
                notifications_sent['email'] = True
            except Exception as email_err:
                logging.error(f'Email error: {email_err}')
        
        # Update invoice
        await _db.invoices.update_one(
            {'id': invoice_id},
            {'$set': {
                'payment_request_sent': True,
                'payment_request_sent_at': datetime.now(timezone.utc)
            }}
        )
        
        return {
            'success': True,
            'message': 'Solicitud de pago enviada',
            'payment_url': payment_url,
            'notifications_sent': notifications_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error sending payment request: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/my-invoices')
async def get_client_invoices(
    status: str = Query(None),
    current_user: dict = Depends(_get_current_user)
):
    """Get invoices for the logged in client"""
    try:
        user_id = str(current_user.get('_id', ''))
        user_email = current_user.get('email', '')
        
        query = {
            '$or': [
                {'user_id': user_id},
                {'client_email': user_email}
            ]
        }
        
        if status:
            query['status'] = status
        
        invoices = await _db.invoices.find(query).sort('created_at', -1).to_list(50)
        
        result = []
        for inv in invoices:
            result.append({
                'id': inv.get('id', str(inv.get('_id'))),
                'invoice_number': inv.get('invoice_number'),
                'service_type': inv.get('service_type'),
                'description': inv.get('description'),
                'amount': inv.get('amount'),
                'status': inv.get('status', 'pending'),
                'payment_link': inv.get('payment_link'),
                'created_at': inv.get('created_at').isoformat() if inv.get('created_at') else None,
                'paid_at': inv.get('paid_at').isoformat() if inv.get('paid_at') else None,
                'due_date': inv.get('due_date').isoformat() if inv.get('due_date') else None
            })
        
        return {
            'success': True,
            'invoices': result,
            'total_pending': sum(1 for i in result if i['status'] == 'pending'),
            'total_amount_pending': sum(i['amount'] for i in result if i['status'] == 'pending')
        }
        
    except Exception as e:
        logging.error(f'Error getting client invoices: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== AFFILIATE LINKS ENDPOINTS ==================
# ================== AFFILIATE LINKS ENDPOINTS ==================

@router.get('/affiliate-links')
async def get_active_affiliate_links(current_user: dict = Depends(_get_current_user)):
    """Get all active affiliate links (client endpoint)"""
    try:
        links = await _db.affiliate_links.find({'is_active': True}).to_list(100)
        
        # Serialize
        for link in links:
            link['id'] = str(link.pop('_id'))
            if link.get('created_at'):
                link['created_at'] = link['created_at'].isoformat()
            if link.get('updated_at'):
                link['updated_at'] = link['updated_at'].isoformat()
        
        return {'links': links}
    except Exception as e:
        logging.error(f"Error getting affiliate links: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/affiliate-links/{link_id}')
async def get_affiliate_link(
    link_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Get specific affiliate link by ID"""
    try:
        link = await _db.affiliate_links.find_one({'_id': ObjectId(link_id)})
        
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")
        
        link['id'] = str(link.pop('_id'))
        if link.get('created_at'):
            link['created_at'] = link['created_at'].isoformat()
        if link.get('updated_at'):
            link['updated_at'] = link['updated_at'].isoformat()
        
        return link
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting affiliate link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/affiliate-links')
async def admin_get_all_affiliate_links(current_user: dict = Depends(_require_admin)):
    """Get all affiliate links including inactive (admin only)"""
    try:
        links = await _db.affiliate_links.find({}).to_list(100)
        
        # Serialize
        for link in links:
            link['id'] = str(link.pop('_id'))
            if link.get('created_at'):
                link['created_at'] = link['created_at'].isoformat()
            if link.get('updated_at'):
                link['updated_at'] = link['updated_at'].isoformat()
        
        return {'links': links}
    except Exception as e:
        logging.error(f"Error getting all affiliate links: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/affiliate-links')
async def admin_create_affiliate_link(
    link: AffiliateLink,
    current_user: dict = Depends(_require_admin)
):
    """Create new affiliate link (admin only)"""
    try:
        link_dict = link.dict(by_alias=True, exclude={'id'})
        link_dict['created_at'] = datetime.utcnow()
        link_dict['updated_at'] = datetime.utcnow()
        
        result = await _db.affiliate_links.insert_one(link_dict)
        link_dict['id'] = str(result.inserted_id)
        link_dict.pop('_id', None)
        
        # Serialize datetime
        if link_dict.get('created_at'):
            link_dict['created_at'] = link_dict['created_at'].isoformat()
        if link_dict.get('updated_at'):
            link_dict['updated_at'] = link_dict['updated_at'].isoformat()
        
        return {
            'success': True,
            'link': link_dict,
            'message': 'Affiliate link created successfully'
        }
    except Exception as e:
        logging.error(f"Error creating affiliate link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/admin/affiliate-links/{link_id}')
async def admin_update_affiliate_link(
    link_id: str,
    request: AffiliateUpdateRequest,
    current_user: dict = Depends(_require_admin)
):
    """Update affiliate link (admin only)"""
    try:
        # Check if link exists
        existing_link = await _db.affiliate_links.find_one({'_id': ObjectId(link_id)})
        if not existing_link:
            raise HTTPException(status_code=404, detail="Affiliate link not found")
        
        # Build update data
        update_data = request.dict(exclude_unset=True)
        if update_data:
            update_data['updated_at'] = datetime.utcnow()
            
            result = await _db.affiliate_links.update_one(
                {'_id': ObjectId(link_id)},
                {'$set': update_data}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=400, detail="No changes made")
        
        # Get updated link
        updated_link = await _db.affiliate_links.find_one({'_id': ObjectId(link_id)})
        updated_link['id'] = str(updated_link.pop('_id'))
        
        # Serialize datetime
        if updated_link.get('created_at'):
            updated_link['created_at'] = updated_link['created_at'].isoformat()
        if updated_link.get('updated_at'):
            updated_link['updated_at'] = updated_link['updated_at'].isoformat()
        
        return {
            'success': True,
            'link': updated_link,
            'message': 'Affiliate link updated successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating affiliate link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/admin/affiliate-links/{link_id}')
async def admin_delete_affiliate_link(
    link_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Delete affiliate link (admin only)"""
    try:
        result = await _db.affiliate_links.delete_one({'_id': ObjectId(link_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Affiliate link not found")
        
        return {
            'success': True,
            'message': 'Affiliate link deleted successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting affiliate link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== WITHDRAWAL ENDPOINTS ==================
# ================== WITHDRAWAL ENDPOINTS ==================

@router.get('/withdrawals/plaid-link-token')
async def get_plaid_link_token(current_user: dict = Depends(_get_current_user)):
    """
    Genera un Plaid Link Token para que el usuario conecte su cuenta bancaria
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        user_id = current_user['_id']
        
        result = await withdrawal_service.create_plaid_link_token(user_id)
        
        return PlaidLinkTokenResponse(
            link_token=result["link_token"],
            expiration=result["expiration"]
        )
        
    except Exception as e:
        logging.error(f"Error creating Plaid link token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/withdrawals/bank-accounts')
async def create_bank_account(
    request: CreateBankAccountRequest,
    current_user: dict = Depends(_get_current_user)
):
    """
    Crea una cuenta bancaria verificada usando el token de Plaid
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        user_id = current_user['_id']
        
        bank_account_id = await withdrawal_service.exchange_plaid_public_token(
            user_id=user_id,
            public_token=request.plaid_public_token,
            account_id=request.account_id,
            account_holder_name=request.account_holder_name
        )
        
        return {
            'success': True,
            'message': 'Cuenta bancaria verificada exitosamente',
            'bank_account_id': bank_account_id
        }
        
    except Exception as e:
        logging.error(f"Error creating bank account: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get('/withdrawals/bank-accounts')
async def get_bank_accounts(current_user: dict = Depends(_get_current_user)):
    """
    Obtiene las cuentas bancarias del usuario
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        user_id = current_user['id']  # Usar 'id' en lugar de '_id'
        
        accounts = await withdrawal_service.get_user_bank_accounts(user_id)
        
        return {
            'bank_accounts': accounts
        }
        
    except Exception as e:
        logging.error(f"Error getting bank accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/withdrawals/request')
async def request_withdrawal(
    request: CreateWithdrawalRequest,
    current_user: dict = Depends(_get_current_user)
):
    """
    Solicita un retiro de créditos a cuenta bancaria
    Descuenta provisionalmente del balance
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        user_id = current_user['_id']
        
        withdrawal_id = await withdrawal_service.create_withdrawal_request(
            user_id=user_id,
            amount=request.amount,
            bank_account_id=request.bank_account_id,
            notes=request.notes
        )
        
        return {
            'success': True,
            'message': 'Solicitud de retiro creada exitosamente',
            'withdrawal_id': withdrawal_id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error requesting withdrawal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/withdrawals/history')
async def get_withdrawal_history(current_user: dict = Depends(_get_current_user)):
    """
    Obtiene el historial de retiros del usuario
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        user_id = current_user['_id']
        
        withdrawals = await withdrawal_service.get_user_withdrawals(user_id)
        
        return {
            'withdrawals': withdrawals
        }
        
    except Exception as e:
        logging.error(f"Error getting withdrawal history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/withdrawals/fees')
async def calculate_withdrawal_fee(
    amount: float,
    current_user: dict = Depends(_get_current_user)
):
    """
    Calcula el fee y monto neto de un retiro
    """
    try:
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than 0")
        
        fee_info = await withdrawal_service.calculate_withdrawal_fee(amount)
        
        return fee_info
        
    except Exception as e:
        logging.error(f"Error calculating withdrawal fee: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ================== ADMIN WITHDRAWAL ENDPOINTS ==================
# ================== ADMIN WITHDRAWAL ENDPOINTS ==================

@router.get('/admin/withdrawals')
async def get_all_withdrawals(
    status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(_get_current_user)
):
    """
    Obtiene todas las solicitudes de retiro (Admin)
    """
    try:
        # Check admin role
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        withdrawals = await withdrawal_service.get_all_withdrawal_requests(
            status=status,
            limit=limit
        )
        
        return {
            'withdrawals': withdrawals,
            'total': len(withdrawals)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting all withdrawals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/withdrawals/{withdrawal_id}/process')
async def process_withdrawal_request(
    withdrawal_id: str,
    request: ProcessWithdrawalRequest,
    current_user: dict = Depends(_get_current_user)
):
    """
    Procesa una solicitud de retiro (completar o rechazar)
    - completed: Descuento permanente
    - rejected: Reembolso al balance del usuario
    """
    try:
        # Check admin role
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        admin_id = current_user['_id']
        
        # Get withdrawal before processing
        withdrawal = await _db.withdrawal_requests.find_one({'id': withdrawal_id})
        if not withdrawal:
            raise HTTPException(status_code=404, detail="Withdrawal not found")
        
        success = await withdrawal_service.process_withdrawal(
            withdrawal_id=withdrawal_id,
            admin_id=admin_id,
            status=request.status,
            admin_notes=request.admin_notes,
            rejection_reason=request.rejection_reason,
            stripe_payout_id=request.stripe_payout_id
        )
        
        # Send SMS notification
        if success:
            try:
                user = await _db.users.find_one({'_id': withdrawal['user_id']})
                if user and user.get('phone'):
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        if notif_service.twilio_client:
                            amount = withdrawal.get('amount', 0)
                            
                            if request.status == 'completed':
                                sms_message = f"""✅ Tu retiro ha sido APROBADO

💰 Monto: ${amount:.2f}
📅 Procesado: {datetime.now().strftime("%d/%m/%Y")}

Recibirás el pago en 3-5 días hábiles.

Ross Tax Preparation
806-934-2018"""
                            else:  # rejected
                                reason = request.rejection_reason or "No especificado"
                                sms_message = f"""⚠️ Tu solicitud de retiro fue RECHAZADA

💰 Monto: ${amount:.2f}
📝 Motivo: {reason}

Tus créditos han sido devueltos a tu cuenta.

Para más información:
📞 806-934-2018

Ross Tax Preparation"""
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=user['phone']
                            )
                            logging.info(f"✅ Withdrawal {request.status} SMS sent to {user['phone']}")
            except Exception as e:
                logging.error(f"❌ Error sending withdrawal SMS: {e}")
        
        if success:
            return {
                'success': True,
                'message': f"Retiro {request.status} exitosamente"
            }
        else:
            raise HTTPException(status_code=400, detail="No se pudo procesar el retiro")
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing withdrawal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/withdrawals/stats')
async def get_withdrawal_stats(current_user: dict = Depends(_get_current_user)):
    """
    Obtiene estadísticas de retiros (Admin)
    """
    try:
        # Check admin role
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if not withdrawal_service:
            raise HTTPException(status_code=503, detail="Withdrawal service not initialized")
        
        stats = await withdrawal_service.get_withdrawal_stats()
        
        return WithdrawalStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting withdrawal stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




# ================== STRIPE CONFIGURATION ENDPOINTS ==================
# ================== STRIPE CONFIGURATION ENDPOINTS (ADMIN) ==================

@router.get('/admin/stripe-config')
async def get_stripe_config(
    current_user: dict = Depends(_require_admin)
):
    """Get Stripe configuration (test and live keys)"""
    try:
        config = await _db.stripe_config.find_one({})
        
        if not config:
            # Return empty config if none exists
            return {
                'test_mode': {
                    'secret_key': '',
                    'publishable_key': '',
                    'webhook_secret': ''
                },
                'live_mode': {
                    'secret_key': '',
                    'publishable_key': '',
                    'webhook_secret': ''
                },
                'active_mode': 'test'
            }
        
        # Remove sensitive fields from response (only show last 4 chars)
        def mask_key(key):
            if not key:
                return ''
            if len(key) <= 8:
                return key
            return f"{key[:8]}...{key[-4:]}"
        
        return {
            'test_mode': {
                'secret_key_masked': mask_key(config.get('test_secret_key', '')),
                'publishable_key': config.get('test_publishable_key', ''),
                'webhook_secret_masked': mask_key(config.get('test_webhook_secret', '')),
                'has_secret_key': bool(config.get('test_secret_key')),
                'has_webhook_secret': bool(config.get('test_webhook_secret'))
            },
            'live_mode': {
                'secret_key_masked': mask_key(config.get('live_secret_key', '')),
                'publishable_key': config.get('live_publishable_key', ''),
                'webhook_secret_masked': mask_key(config.get('live_webhook_secret', '')),
                'has_secret_key': bool(config.get('live_secret_key')),
                'has_webhook_secret': bool(config.get('live_webhook_secret'))
            },
            'active_mode': config.get('active_mode', 'test')
        }
        
    except Exception as e:
        logging.error(f"Error getting Stripe config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/stripe-config')
async def update_stripe_config(
    mode: str = Query(..., pattern='^(test|live)$'),
    secret_key: Optional[str] = None,
    publishable_key: Optional[str] = None,
    webhook_secret: Optional[str] = None,
    current_user: dict = Depends(_require_admin)
):
    """Update Stripe configuration for test or live mode"""
    try:
        config = await _db.stripe_config.find_one({})
        
        if not config:
            config = {
                'test_secret_key': '',
                'test_publishable_key': '',
                'test_webhook_secret': '',
                'live_secret_key': '',
                'live_publishable_key': '',
                'live_webhook_secret': '',
                'active_mode': 'test',
                'updated_at': datetime.utcnow(),
                'updated_by': current_user['email']
            }
        
        # Update the appropriate mode's keys
        prefix = f'{mode}_'
        update_fields = {
            'updated_at': datetime.utcnow(),
            'updated_by': current_user['email']
        }
        
        if secret_key is not None:
            update_fields[f'{prefix}secret_key'] = secret_key
        if publishable_key is not None:
            update_fields[f'{prefix}publishable_key'] = publishable_key
        if webhook_secret is not None:
            update_fields[f'{prefix}webhook_secret'] = webhook_secret
        
        if not config.get('_id'):
            # Create new config
            config.update(update_fields)
            await _db.stripe_config.insert_one(config)
        else:
            # Update existing config
            await _db.stripe_config.update_one(
                {'_id': config['_id']},
                {'$set': update_fields}
            )
        
        # Reinitialize Stripe with new keys if updating active mode
        if mode == config.get('active_mode', 'test'):
            updated_config = await _db.stripe_config.find_one({})
            active_secret = updated_config.get(f'{mode}_secret_key')
            if active_secret:
                stripe.api_key = active_secret
                logging.info(f"✅ Stripe reinitialized with {mode} mode keys")
        
        return {
            'success': True,
            'message': f'Stripe {mode} mode configuration updated successfully',
            'active_mode': config.get('active_mode', 'test')
        }
        
    except Exception as e:
        logging.error(f"Error updating Stripe config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/stripe-config/switch-mode')
async def switch_stripe_mode(
    mode: str = Query(..., pattern='^(test|live)$'),
    current_user: dict = Depends(_require_admin)
):
    """Switch between test and live Stripe modes"""
    try:
        config = await _db.stripe_config.find_one({})
        
        if not config:
            raise HTTPException(status_code=404, detail="Stripe configuration not found. Please configure keys first.")
        
        # Check if keys exist for the target mode
        secret_key = config.get(f'{mode}_secret_key')
        publishable_key = config.get(f'{mode}_publishable_key')
        
        if not secret_key or not publishable_key:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing {mode} mode keys. Please configure {mode} keys before switching."
            )
        
        # Update active mode
        await _db.stripe_config.update_one(
            {'_id': config['_id']},
            {
                '$set': {
                    'active_mode': mode,
                    'updated_at': datetime.utcnow(),
                    'updated_by': current_user['email']
                }
            }
        )
        
        # Reinitialize Stripe with new mode
        stripe.api_key = secret_key
        logging.info(f"✅ Stripe switched to {mode} mode")
        
        return {
            'success': True,
            'message': f'Successfully switched to {mode} mode',
            'active_mode': mode,
            'publishable_key': publishable_key
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error switching Stripe mode: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



