"""
Admin Services Routes Router
Extracted from server.py for modularization.
Handles service types CRUD, service categories, and pricing management.
"""
import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

admin_services_router = APIRouter()
_db = None


def init_admin_services_router(db):
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

# =============================================

@admin_services_router.get('/admin/services')
async def get_all_services(
    request: Request,
    category: Optional[str] = Query(None),
    active_only: bool = Query(True)
):
    current_user = await _require_admin(request)

    """Get all services/products for invoicing"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    query = {}
    if active_only:
        query['is_active'] = True
    if category:
        query['category'] = category
    
    services = await _db.service_prices.find(query).sort('name', 1).to_list(100)
    
    return {
        'services': [{
            '_id': str(s.get('_id', '')),
            'name': s.get('name', s.get('name_es', 'Sin nombre')),
            'description': s.get('description', s.get('description_es', '')),
            'price_credits': s.get('price_credits', 0),
            'base_price': s.get('base_price', s.get('price_credits', 0)),
            'category': s.get('category', 'general'),
            'is_active': s.get('is_active', True),
            'estimated_time': s.get('estimated_time', ''),
        } for s in services],
        'total': len(services)
    }


@admin_services_router.get('/admin/clients/diagnostic')
async def get_clients_diagnostic(request: Request):
    """Diagnóstico de clientes - identifica problemas comunes"""
    current_user = await _require_admin(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Contar total de clientes (excluyendo admins)
        total = await _db.users.count_documents({'role': {'$nin': ['admin', 'office_assistant']}})
        
        # Clientes SIN contraseña (no pueden usar la app)
        sin_password = await _db.users.find({
            'role': {'$nin': ['admin', 'office_assistant']},
            '$or': [
                {'password_hash': {'$exists': False}},
                {'password_hash': None},
                {'password_hash': ''}
            ]
        }).to_list(1000)
        
        # Clientes CON app (has_app = true o tienen push_token)
        con_app = await _db.users.count_documents({
            'role': {'$nin': ['admin', 'office_assistant']},
            '$or': [
                {'has_app': True},
                {'push_token': {'$exists': True, '$ne': None}},
                {'expo_push_token': {'$exists': True, '$ne': None}}
            ]
        })
        
        # Clientes con contraseña pero sin app
        con_password_sin_app = await _db.users.count_documents({
            'role': {'$nin': ['admin', 'office_assistant']},
            'password_hash': {'$exists': True, '$ne': None, '$ne': ''},
            'has_app': {'$ne': True},
            'push_token': {'$exists': False}
        })
        
        # Contar tokens de reset pendientes
        tokens_pendientes = await _db.password_reset_tokens.count_documents({})
        
        # Lista de clientes sin contraseña (primeros 50)
        clientes_sin_password = [{
            'id': str(c.get('_id')),
            'name': c.get('name') or c.get('full_name', 'Sin nombre'),
            'email': c.get('email', 'Sin email'),
            'phone': c.get('phone', ''),
            'created_at': c.get('created_at')
        } for c in sin_password[:50]]
        
        return {
            'resumen': {
                'total_clientes': total,
                'con_app': con_app,
                'sin_password': len(sin_password),
                'con_password_sin_app': con_password_sin_app,
                'pueden_usar_app': total - len(sin_password),
                'tokens_reset_pendientes': tokens_pendientes
            },
            'problema': {
                'descripcion': f'{len(sin_password)} clientes no tienen contraseña y NO pueden usar la app',
                'solucion': 'Enviar email de bienvenida con link para crear contraseña, o asignar contraseña temporal'
            },
            'clientes_sin_password': clientes_sin_password,
            'total_sin_password': len(sin_password)
        }
    except Exception as e:
        logging.error(f'Error in diagnostic: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_services_router.post('/admin/clients/test-welcome-flow')
async def test_welcome_flow(
    data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Prueba el flujo de bienvenida con un cliente específico"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from twilio.rest import Client as TwilioClient
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        import secrets
        
        client_id = data.get('client_id')
        phone_override = data.get('phone')  # Para pruebas, enviar a otro número
        email_override = data.get('email')  # Para pruebas, enviar a otro email
        
        if not client_id:
            raise HTTPException(status_code=400, detail='client_id es requerido')
        
        # Buscar cliente
        client = await _db.users.find_one({'_id': client_id})
        if not client and len(str(client_id)) == 24:
            try:
                client = await _db.users.find_one({'_id': ObjectId(client_id)})
            except:
                pass
        if not client:
            client = await _db.users.find_one({'id': client_id})
        
        if not client:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        name = client.get('name') or client.get('full_name', 'Cliente')
        email = email_override or client.get('email')
        phone = phone_override or client.get('phone')
        
        # Generar token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Guardar token
        await _db.password_reset_tokens.update_one(
            {'user_id': str(client['_id'])},
            {'$set': {
                'user_id': str(client['_id']),
                'token': reset_token,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        reset_link = f"https://www.rosstaxpreparation.com/reset-password?token={reset_token}"
        
        result = {
            'client_name': name,
            'reset_link': reset_link,
            'token': reset_token,
            'expires_at': str(expires_at),
            'sms_sent': False,
            'email_sent': False
        }
        
        # Enviar SMS si hay teléfono
        if phone:
            try:
                twilio_client = TwilioClient(
                    os.getenv('TWILIO_ACCOUNT_SID'),
                    os.getenv('TWILIO_AUTH_TOKEN')
                )
                twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
                
                phone_clean = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                if not phone_clean.startswith('+'):
                    phone_clean = '+1' + phone_clean if len(phone_clean) == 10 else '+' + phone_clean
                
                sms_message = f"Hola {name.split()[0]}! Tu cuenta de Ross Tax esta lista. Crea tu contraseña aquí: {reset_link}"
                
                twilio_client.messages.create(
                    body=sms_message,
                    from_=twilio_phone,
                    to=phone_clean
                )
                result['sms_sent'] = True
                result['sms_phone'] = phone_clean
            except Exception as sms_err:
                result['sms_error'] = str(sms_err)
        
        # Enviar email si hay email
        if email and '@' in email:
            try:
                sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
                message = Mail(
                    from_email=('notifications@rosstaxpreparation.com', 'Ross Tax Preparation'),
                    to_emails=email,
                    subject='🎉 Bienvenido a Ross Tax - Configura tu cuenta',
                    html_content=f'''
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6C1110;">¡Hola {name}!</h2>
                        <p>Tu cuenta en Ross Tax Preparation ha sido creada. Para comenzar a usar nuestra app móvil, necesitas crear tu contraseña.</p>
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="{reset_link}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Crear mi Contraseña
                            </a>
                        </p>
                        <p>Este enlace expira en 7 días.</p>
                        <p>Si tienes alguna pregunta, llámanos al (806) 922-2318.</p>
                    </div>
                    '''
                )
                sg.send(message)
                result['email_sent'] = True
                result['email_to'] = email
            except Exception as email_err:
                result['email_error'] = str(email_err)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error in test welcome flow: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@admin_services_router.post('/admin/clients/resend-welcome-sms')
async def resend_welcome_sms_with_apology(
    request: Request
):
    current_user = await _require_admin(request)

    """Reenvía SMS de bienvenida a clientes con tokens existentes con mensaje de disculpa"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from twilio.rest import Client as TwilioClient
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        import secrets
        
        # Obtener todos los tokens existentes
        existing_tokens = await _db.password_reset_tokens.find().to_list(500)
        
        sms_sent = 0
        email_sent = 0
        failed = 0
        skipped = 0
        
        # Configurar Twilio
        twilio_client = TwilioClient(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Configurar SendGrid
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        
        for token_doc in existing_tokens:
            user_id = token_doc.get('user_id')
            
            # Buscar el usuario
            user = await _db.users.find_one({'_id': user_id})
            if not user and len(str(user_id)) == 24:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not user:
                user = await _db.users.find_one({'id': user_id})
            
            if not user:
                failed += 1
                continue
            
            name = user.get('name') or user.get('full_name', 'Cliente')
            email = user.get('email')
            phone = user.get('phone')
            
            # Verificar que tenga teléfono real
            if not phone or len(phone) < 10:
                skipped += 1
                continue
            
            # Verificar email real
            has_real_email = email and '@' in email and '@temp' not in email and '@placeholder' not in email
            
            # Generar nuevo token
            new_token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
            
            # Actualizar token en DB
            await _db.password_reset_tokens.update_one(
                {'user_id': user_id},
                {'$set': {
                    'token': new_token,
                    'expires_at': expires_at,
                    'created_at': datetime.now(timezone.utc)
                }}
            )
            
            reset_link = f"https://www.rosstaxpreparation.com/reset-password?token={new_token}"
            first_name = name.split()[0] if name else 'Cliente'
            
            # Enviar SMS con mensaje de disculpa
            try:
                phone_clean = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                if not phone_clean.startswith('+'):
                    phone_clean = '+1' + phone_clean if len(phone_clean) == 10 else '+' + phone_clean
                
                sms_message = f"Hola {first_name}! El link anterior tuvo un error tecnico. Aqui esta el correcto para activar tu cuenta Ross Tax: {reset_link} - Agenda citas, ve tus declaraciones y mas!"
                
                twilio_client.messages.create(
                    body=sms_message,
                    from_=twilio_phone,
                    to=phone_clean
                )
                sms_sent += 1
            except Exception as sms_err:
                logging.warning(f'SMS failed for {phone}: {sms_err}')
                failed += 1
            
            # Enviar email también si tiene email válido
            if has_real_email:
                try:
                    message = Mail(
                        from_email=('notifications@rosstaxpreparation.com', 'Ross Tax Preparation'),
                        to_emails=email,
                        subject='🔗 Nuevo enlace - Activa tu cuenta Ross Tax',
                        html_content=f'''
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #6C1110;">¡Hola {name}!</h2>
                            <p>Disculpa las molestias. El enlace anterior tuvo un error técnico.</p>
                            <p>Aquí tienes el enlace correcto para activar tu cuenta:</p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="{reset_link}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                    Activar mi Cuenta
                                </a>
                            </p>
                            <p><strong>Con tu cuenta puedes:</strong></p>
                            <ul>
                                <li>📅 Agendar citas</li>
                                <li>📄 Ver tus declaraciones de impuestos</li>
                                <li>📤 Subir documentos</li>
                                <li>💬 Chatear con nosotros</li>
                            </ul>
                            <p>Este enlace expira en 7 días.</p>
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                            <p style="color: #666; font-size: 12px;">Ross Tax Preparation LLC<br>Tel: (806) 922-2318</p>
                        </div>
                        '''
                    )
                    sg.send(message)
                    email_sent += 1
                except Exception as email_err:
                    logging.warning(f'Email failed: {email_err}')
        
        return {
            'message': f'Reenvío completado. SMS: {sms_sent}, Emails: {email_sent}, Fallidos: {failed}, Sin teléfono: {skipped}',
            'sms_sent': sms_sent,
            'email_sent': email_sent,
            'failed': failed,
            'skipped': skipped,
            'total_tokens': len(existing_tokens)
        }
        
    except Exception as e:
        logging.error(f'Error in resend welcome SMS: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@admin_services_router.post('/admin/clients/send-welcome-email')
async def send_welcome_email_to_clients(
    data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Envía email de bienvenida con link para crear contraseña"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    client_ids = data.get('client_ids', [])
    send_to_all_without_password = data.get('send_to_all_without_password', False)
    
    try:
        clients_to_email = []
        
        if send_to_all_without_password:
            # Obtener todos los clientes sin contraseña
            clients_to_email = await _db.users.find({
                'role': {'$nin': ['admin', 'office_assistant']},
                '$or': [
                    {'password_hash': {'$exists': False}},
                    {'password_hash': None},
                    {'password_hash': ''}
                ],
                'email': {'$exists': True, '$ne': None, '$regex': '@'}
            }).to_list(1000)
        elif client_ids:
            for cid in client_ids:
                client = await _db.users.find_one({'_id': cid})
                if not client and len(cid) == 24:
                    client = await _db.users.find_one({'_id': ObjectId(cid)})
                if client:
                    clients_to_email.append(client)
        
        sent = 0
        failed = 0
        
        for client in clients_to_email:
            email = client.get('email')
            name = client.get('name') or client.get('full_name', 'Cliente')
            
            if not email or '@placeholder' in email:
                failed += 1
                continue
            
            # Generar token de reset password
            import secrets
            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
            
            # Guardar token
            await _db.password_reset_tokens.insert_one({
                'user_id': str(client['_id']),
                'token': reset_token,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc)
            })
            
            # Enviar email
            try:
                reset_link = f"https://www.rosstaxpreparation.com/reset-password?token={reset_token}"
                
                # Usar SendGrid
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                
                sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
                
                message = Mail(
                    from_email=('notifications@rosstaxpreparation.com', 'Ross Tax Preparation'),
                    to_emails=email,
                    subject='🎉 Bienvenido a Ross Tax - Configura tu cuenta',
                    html_content=f'''
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6C1110;">¡Hola {name}!</h2>
                        <p>Tu cuenta en Ross Tax Preparation ha sido creada. Para comenzar a usar nuestra app móvil, necesitas crear tu contraseña.</p>
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="{reset_link}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Crear mi Contraseña
                            </a>
                        </p>
                        <p>Este enlace expira en 7 días.</p>
                        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">Ross Tax Preparation LLC<br>Tel: (806) 922-2318</p>
                    </div>
                    '''
                )
                
                sg.send(message)
                sent += 1
            except Exception as email_error:
                logging.error(f'Error sending welcome email to {email}: {email_error}')
                failed += 1
        
        return {
            'message': f'Emails enviados: {sent}, Fallidos: {failed}',
            'sent': sent,
            'failed': failed,
            'total_processed': len(clients_to_email)
        }
    except Exception as e:
        logging.error(f'Error sending welcome emails: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_services_router.post('/admin/clients/send-welcome-sms-email')
async def send_welcome_sms_and_email(
    data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Envía SMS y email de bienvenida a clientes sin contraseña que tienen datos reales"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from twilio.rest import Client as TwilioClient
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        import secrets
        
        # Obtener clientes sin contraseña con email y teléfono real
        clients = await _db.users.find({
            'role': {'$nin': ['admin', 'office_assistant']},
            '$or': [
                {'password_hash': {'$exists': False}},
                {'password_hash': None},
                {'password_hash': ''}
            ],
            'email': {'$exists': True, '$ne': None, '$ne': '', '$not': {'$regex': '@temp|@placeholder'}},
            'phone': {'$exists': True, '$ne': None, '$regex': '^\\+?[0-9]{10,}$'}
        }).to_list(500)
        
        # Filtrar solo los que tienen email con @ (email real)
        eligible_clients = [c for c in clients if c.get('email') and '@' in c.get('email', '') and 
                          '@temp' not in c.get('email', '') and '@placeholder' not in c.get('email', '')]
        
        sms_sent = 0
        email_sent = 0
        failed = 0
        results = []
        
        # Configurar Twilio
        twilio_client = TwilioClient(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Configurar SendGrid
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        
        for client in eligible_clients:
            client_id = str(client['_id'])
            name = client.get('name') or client.get('full_name', 'Cliente')
            email = client.get('email')
            phone = client.get('phone')
            
            try:
                # Generar token de reset password
                reset_token = secrets.token_urlsafe(32)
                expires_at = datetime.now(timezone.utc) + timedelta(days=7)
                
                # Guardar token
                await _db.password_reset_tokens.update_one(
                    {'user_id': client_id},
                    {'$set': {
                        'user_id': client_id,
                        'token': reset_token,
                        'expires_at': expires_at,
                        'created_at': datetime.now(timezone.utc)
                    }},
                    upsert=True
                )
                
                reset_link = f"https://www.rosstaxpreparation.com/reset-password?token={reset_token}"
                
                client_result = {'name': name, 'email': email, 'phone': phone, 'sms': False, 'email': False}
                
                # Enviar SMS
                if phone and twilio_phone:
                    try:
                        # Formatear teléfono
                        phone_clean = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                        if not phone_clean.startswith('+'):
                            phone_clean = '+1' + phone_clean if len(phone_clean) == 10 else '+' + phone_clean
                        
                        sms_message = f"Hola {name.split()[0]}! Tu cuenta de Ross Tax está lista. Crea tu contraseña aquí: {reset_link} - Ross Tax Preparation"
                        
                        twilio_client.messages.create(
                            body=sms_message,
                            from_=twilio_phone,
                            to=phone_clean
                        )
                        sms_sent += 1
                        client_result['sms'] = True
                    except Exception as sms_err:
                        logging.warning(f'SMS failed for {phone}: {sms_err}')
                
                # Enviar Email
                if email:
                    try:
                        message = Mail(
                            from_email=('notifications@rosstaxpreparation.com', 'Ross Tax Preparation'),
                            to_emails=email,
                            subject='🎉 Bienvenido a Ross Tax - Configura tu cuenta',
                            html_content=f'''
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #6C1110;">¡Hola {name}!</h2>
                                <p>Tu cuenta en Ross Tax Preparation ha sido creada. Para comenzar a usar nuestra app móvil, necesitas crear tu contraseña.</p>
                                <p style="text-align: center; margin: 30px 0;">
                                    <a href="{reset_link}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                        Crear mi Contraseña
                                    </a>
                                </p>
                                <p>Este enlace expira en 7 días.</p>
                                <p><strong>También puedes descargar nuestra app:</strong></p>
                                <ul>
                                    <li><a href="https://apps.apple.com/app/ross-tax/id6755496120">App Store (iPhone)</a></li>
                                </ul>
                                <p>Si tienes alguna pregunta, no dudes en contactarnos al (806) 922-2318.</p>
                                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                                <p style="color: #666; font-size: 12px;">Ross Tax Preparation LLC<br>Tel: (806) 922-2318</p>
                            </div>
                            '''
                        )
                        sg.send(message)
                        email_sent += 1
                        client_result['email_sent'] = True
                    except Exception as email_err:
                        logging.warning(f'Email failed for {email}: {email_err}')
                
                results.append(client_result)
                
            except Exception as client_err:
                logging.error(f'Error processing client {name}: {client_err}')
                failed += 1
        
        return {
            'message': f'Proceso completado. SMS: {sms_sent}, Emails: {email_sent}, Fallidos: {failed}',
            'sms_sent': sms_sent,
            'email_sent': email_sent,
            'failed': failed,
            'total_eligible': len(eligible_clients),
            'results': results[:20]  # Mostrar primeros 20 resultados
        }
        
    except Exception as e:
        logging.error(f'Error in send welcome SMS/email: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============== BIRTHDAY MANAGEMENT ==============