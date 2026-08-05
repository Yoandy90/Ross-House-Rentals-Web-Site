"""
Admin Appointments Detail Routes Router
Extracted from server.py for modularization.
Handles individual appointment CRUD, appointment feedback, and admin appointment management.
"""
import logging
import uuid
import secrets
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body
from pydantic import BaseModel
from bson import ObjectId
from passlib.context import CryptContext
from notification_service import format_date_spanish

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

admin_appt_detail_router = APIRouter()
_db = None
_notification_service_instance = None


def init_admin_appt_detail_router(db):
    global _db
    _db = db


def update_admin_appt_notification_service(notif_svc):
    global _notification_service_instance
    _notification_service_instance = notif_svc

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

# ================== ADMIN APPOINTMENTS MANAGEMENT ==================

@admin_appt_detail_router.get('/admin/appointments/{appointment_id}')
async def get_appointment_details(
    appointment_id: str,
    request: Request
):
    """Get details of a specific appointment for admin"""
    try:
        # Try multiple ID formats
        appointment = None
        
        # Try ObjectId
        if len(appointment_id) == 24:
            try:
                appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
            except:
                pass
        
        # Try string _id
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        
        # Try id field
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
        
        # Try square_id
        if not appointment:
            appointment = await _db.appointments.find_one({'square_id': appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Get client info
        user_id = appointment.get('user_id')
        client = None
        if user_id:
            client = await _db.users.find_one({'_id': user_id})
            if not client:
                try:
                    client = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not client:
                client = await _db.users.find_one({'id': user_id})
        
        # Format response
        result = {
            'id': str(appointment.get('_id', '')),
            '_id': str(appointment.get('_id', '')),
            'user_id': str(user_id) if user_id else None,
            'user_name': appointment.get('user_name') or appointment.get('client_name', ''),
            'user_email': appointment.get('user_email') or appointment.get('client_email', ''),
            'user_phone': appointment.get('user_phone') or appointment.get('client_phone', ''),
            'service_name': appointment.get('service_name') or appointment.get('title', 'Consulta'),
            'scheduled_at': appointment.get('scheduled_at', ''),
            'date': appointment.get('date', ''),
            'time': appointment.get('time', ''),
            'status': appointment.get('status', 'pending'),
            'notes': appointment.get('notes', ''),
            'created_at': appointment.get('created_at').isoformat() if appointment.get('created_at') else None,
        }
        
        # Add client info if found
        if client:
            result['client'] = {
                'id': str(client.get('_id', '')),
                'name': client.get('full_name') or client.get('name', ''),
                'email': client.get('email', ''),
                'phone': client.get('phone', ''),
            }
            # Override with more complete info
            if not result['user_name'] and result['client']['name']:
                result['user_name'] = result['client']['name']
            if not result['user_email'] and result['client']['email']:
                result['user_email'] = result['client']['email']
            if not result['user_phone'] and result['client']['phone']:
                result['user_phone'] = result['client']['phone']
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error getting appointment details: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_appt_detail_router.get('/admin/appointments')
async def get_all_appointments(
    request: Request,
    start_date: str = None,
    end_date: str = None
):
    current_user = await _require_admin(request)

    """Get all appointments (admin only) - OPTIMIZED for faster loading"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    # Build query
    query = {}
    
    # Get all appointments
    appointments = await _db.appointments.find(query).sort('created_at', -1).to_list(500)
    
    # OPTIMIZATION: Batch load all users at once instead of one by one
    user_ids = set()
    for apt in appointments:
        user_id = apt.get('user_id', '')
        if user_id:
            user_ids.add(user_id)
            try:
                user_ids.add(ObjectId(user_id))
            except:
                pass
    
    # Fetch all users in one query
    users_map = {}
    if user_ids:
        users = await _db.users.find({'_id': {'$in': list(user_ids)}}).to_list(1000)
        for user in users:
            users_map[str(user.get('_id', ''))] = user
    
    # Format and enrich with user data (now using cached users)
    result = []
    for apt in appointments:
        user_id = apt.get('user_id', '')
        
        # Look up client from cache
        client = users_map.get(str(user_id))
        
        # Get date from various fields - PRESERVE full scheduled_at with time
        scheduled_at_value = apt.get('scheduled_at', '')
        date_value = apt.get('date', '')
        time_value = apt.get('time', '09:00')
        
        # If scheduled_at doesn't have time, build it
        # ALWAYS convert to America/Chicago timezone for consistency
        if isinstance(scheduled_at_value, str) and 'T' in scheduled_at_value:
            # Has full ISO format - parse and convert to Texas time
            final_scheduled_at = scheduled_at_value
            try:
                import pytz
                texas_tz = pytz.timezone('America/Chicago')
                # Parse the ISO datetime
                if scheduled_at_value.endswith('Z'):
                    from datetime import datetime as dt_cls
                    parsed_dt = dt_cls.fromisoformat(scheduled_at_value.replace('Z', '+00:00'))
                elif '+' in scheduled_at_value[10:] or scheduled_at_value.count('-') > 2:
                    from datetime import datetime as dt_cls
                    parsed_dt = dt_cls.fromisoformat(scheduled_at_value)
                else:
                    parsed_dt = None
                
                if parsed_dt and parsed_dt.tzinfo:
                    # Convert to Texas time
                    texas_dt = parsed_dt.astimezone(texas_tz)
                    if not date_value:
                        date_value = texas_dt.strftime('%Y-%m-%d')
                    if time_value == '09:00':
                        time_value = texas_dt.strftime('%H:%M')
                    final_scheduled_at = texas_dt.strftime('%Y-%m-%dT%H:%M:%S%z')
                else:
                    # No timezone info, assume already Texas time
                    if not date_value:
                        date_value = scheduled_at_value.split('T')[0]
                    if time_value == '09:00':
                        time_part = scheduled_at_value.split('T')[1]
                        time_value = time_part[:5]
            except Exception:
                # Fallback: simple extraction
                if not date_value:
                    date_value = scheduled_at_value.split('T')[0]
                if time_value == '09:00' and 'T' in scheduled_at_value:
                    time_part = scheduled_at_value.split('T')[1]
                    time_value = time_part[:5]
        elif date_value:
            # Build from date + time
            final_scheduled_at = f"{date_value}T{time_value}:00-06:00"
        else:
            final_scheduled_at = scheduled_at_value or date_value
        
        result.append({
            'id': str(apt.get('_id', '')),
            '_id': str(apt.get('_id', '')),
            'user_id': str(user_id),
            'client_id': str(user_id),
            'client_name': apt.get('user_name') or (client.get('name') or client.get('full_name', 'Cliente') if client else 'Cliente'),
            'client_email': apt.get('user_email') or (client.get('email', '') if client else ''),
            'client_phone': apt.get('user_phone') or (client.get('phone', '') if client else ''),
            'user_name': apt.get('user_name') or (client.get('name') or client.get('full_name', 'Cliente') if client else 'Cliente'),
            'user_email': apt.get('user_email') or (client.get('email', '') if client else ''),
            'date': date_value,
            'time': time_value,
            'scheduled_at': final_scheduled_at,
            'service_name': apt.get('service_name', 'Cita General'),
            'appointment_type': apt.get('appointment_type', 'consultation'),
            'status': apt.get('status', 'scheduled'),
            'notes': apt.get('notes', ''),
            'duration': apt.get('duration', 60),
            'duration_minutes': apt.get('duration', apt.get('duration_minutes', 60)),
            'created_at': apt.get('created_at'),
            'source': 'local',
            # Payment info
            'payment_method_id': apt.get('payment_method_id'),
            'payment_method_details': apt.get('payment_method_details'),
            'payment_status': apt.get('payment_status', 'pending'),
            'payment_amount': apt.get('payment_amount'),
            'invoice_number': apt.get('invoice_number'),
        })
    
    return {'appointments': result}

@admin_appt_detail_router.post('/admin/appointments')
async def admin_create_appointment(appointment_data: dict, request: Request):
    current_user = await _require_admin(request)
    """Create new appointment (admin only) with Email and SMS notifications
    Last updated: 2026-03-14 - Added allow_overlap for multiple appointments at same time
    """
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Get scheduled_at for conflict check
        scheduled_at = appointment_data.get('scheduled_at') or appointment_data.get('date')
        time_value = appointment_data.get('time', '09:00')
        
        # Build full datetime string if only date provided
        if scheduled_at and 'T' not in str(scheduled_at):
            scheduled_at = f"{scheduled_at}T{time_value}:00-06:00"
        
        # Check for time slot conflict (admin can override with allow_overlap)
        allow_overlap = appointment_data.get('allow_overlap', True)  # Default True for admin
        if not allow_overlap:
            conflict = await check_appointment_conflict(scheduled_at)
            if conflict:
                conflict_name = conflict.get('user_name') or conflict.get('client_name', 'otro cliente')
                raise HTTPException(
                    status_code=409,
                    detail=f'Este horario ya está ocupado por una cita con {conflict_name}. Por favor elige otro horario.'
                )
        
        # Get user_id from either client_id or user_id
        user_id = str(appointment_data.get('client_id') or appointment_data.get('user_id', ''))
        user_email = appointment_data.get('user_email', '').lower().strip()
        user_name = appointment_data.get('user_name', '')
        user_phone = appointment_data.get('user_phone', '')
        
        # If no user_id but we have email, find or create user
        if not user_id and user_email:
            existing_user = await _db.users.find_one({'email': user_email})
            if existing_user:
                user_id = str(existing_user.get('_id') or existing_user.get('id'))
                # Update name/phone if missing
                update_fields = {}
                if not existing_user.get('full_name') and user_name:
                    update_fields['full_name'] = user_name
                    update_fields['name'] = user_name
                if not existing_user.get('phone') and user_phone:
                    update_fields['phone'] = user_phone
                if update_fields:
                    await _db.users.update_one({'email': user_email}, {'$set': update_fields})
            else:
                # Create new client with temporary password
                user_id = str(uuid.uuid4())
                temp_password = secrets.token_urlsafe(8)  # 8 characters random password
                hashed_password = pwd_context.hash(temp_password)
                
                new_user = {
                    '_id': user_id,
                    'id': user_id,
                    'email': user_email,
                    'name': user_name,
                    'full_name': user_name,
                    'phone': user_phone,
                    'role': 'client',
                    'hashed_password': hashed_password,
                    'temp_password': True,  # Flag to require password change
                    'created_at': datetime.now(timezone.utc),
                    'source': 'admin_appointment'
                }
                await _db.users.insert_one(new_user)
                logging.info(f"✅ New client created from admin appointment: {user_email}")
                
                # Send welcome notification with credentials
                try:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        # Send SMS with credentials
                        if user_phone and notif_service.twilio_client:
                            sms_message = f"🎉 ¡Bienvenido a Ross Tax! Tu cuenta ha sido creada.\n\n📧 Usuario: {user_email}\n🔐 Clave temporal: {temp_password}\n\n📱 Descarga la app: rosstaxpreparation.com/app\n\nRoss Tax (806) 244-0443"
                            try:
                                notif_service.twilio_client.messages.create(
                                    body=sms_message,
                                    from_=config_doc.get('twilio_phone_number'),
                                    to=user_phone
                                )
                                logging.info(f"✅ Welcome SMS sent to {user_phone}")
                            except Exception as sms_err:
                                logging.warning(f"⚠️ Could not send welcome SMS: {sms_err}")
                        
                        # Send Email with credentials
                        if notif_service.sendgrid_client:
                            from sendgrid.helpers.mail import Mail
                            email_body = f'''
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">¡Bienvenido a Ross Tax!</h1>
                                </div>
                                <div style="padding: 30px; background: #f9f9f9;">
                                    <h2 style="color: #6C1110;">Hola {user_name},</h2>
                                    <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
                                    
                                    <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                        <p><strong>📧 Email:</strong> {user_email}</p>
                                        <p><strong>🔐 Contraseña temporal:</strong> {temp_password}</p>
                                    </div>
                                    
                                    <p style="color: #666;">Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
                                    
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="https://www.rosstaxpreparation.com/login" style="background: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Iniciar Sesión</a>
                                    </div>
                                    
                                    <p style="color: #666; font-size: 14px;">
                                        📱 También puedes descargar nuestra app móvil:<br>
                                        <a href="https://www.rosstaxpreparation.com/app">rosstaxpreparation.com/app</a>
                                    </p>
                                </div>
                                <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                                    <p>Ross Tax Preparation<br>301 Denrock Ave, Dalhart, TX 79022<br>(806) 244-0443</p>
                                </div>
                            </div>
                            '''
                            message = Mail(
                                from_email=config_doc.get('sendgrid_from_email', 'noreply@rosstaxpreparation.com'),
                                to_emails=user_email,
                                subject='🎉 ¡Bienvenido a Ross Tax! - Tus credenciales de acceso',
                                html_content=email_body
                            )
                            try:
                                notif_service.sendgrid_client.send(message)
                                logging.info(f"✅ Welcome email sent to {user_email}")
                            except Exception as email_err:
                                logging.warning(f"⚠️ Could not send welcome email: {email_err}")
                except Exception as notif_err:
                    logging.warning(f"⚠️ Could not send welcome notifications: {notif_err}")
        
        # Build appointment data
        management_token = secrets.token_urlsafe(32)
        new_appointment = {
            'user_id': user_id,
            'user_name': user_name,
            'user_email': user_email,
            'user_phone': user_phone,
            'service_id': appointment_data.get('service_id', ''),
            'service_name': appointment_data.get('service_name', appointment_data.get('appointment_type', 'Cita General')),
            'date': appointment_data.get('date') or appointment_data.get('scheduled_at'),
            'time': appointment_data.get('time', '09:00'),
            'scheduled_at': scheduled_at,
            'duration': appointment_data.get('duration') or appointment_data.get('duration_minutes', 60),
            'appointment_type': appointment_data.get('appointment_type', 'consultation'),
            'status': 'scheduled',
            'notes': appointment_data.get('notes', ''),
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.get('id') or current_user.get('_id') or str(current_user.get('_id', '')),
            'management_token': management_token,
        }
        
        result = await _db.appointments.insert_one(new_appointment)
        appointment_id = str(result.inserted_id)

        # Tag with active tax season
        try:
            from season_context import get_season_year
            tax_year = await get_season_year()
            await _db.appointments.update_one({'_id': result.inserted_id}, {'$set': {'tax_year': tax_year}})
        except Exception:
            pass

        manage_url = f"https://www.rosstaxpreparation.com/mi-cita/{management_token}"
        
        # Sync to Square
        square_booking_id = None
        try:
            from square_service import square_service
            
            # Format the start_at for Square
            square_start_at = scheduled_at
            if not square_start_at.endswith('Z') and '+' not in square_start_at and '-' not in square_start_at[-6:]:
                square_start_at = square_start_at + '-06:00'  # Add Texas timezone
            
            square_result = square_service.create_booking(
                start_at=square_start_at,
                customer_name=new_appointment.get('user_name'),
                customer_email=new_appointment.get('user_email'),
                customer_phone=new_appointment.get('user_phone'),
                duration_minutes=new_appointment.get('duration', 60),
                note=f"Cita creada desde webapp: {new_appointment.get('service_name', 'Cita')}"
            )
            
            # Check if Square booking was created successfully
            if square_result and square_result.get('success') and square_result.get('booking'):
                square_booking_id = square_result['booking'].get('id')
                if square_booking_id:
                    # Update local appointment with Square ID
                    await _db.appointments.update_one(
                        {'_id': result.inserted_id},
                        {'$set': {'square_id': square_booking_id, 'source': 'webapp'}}
                    )
                    logging.info(f"✅ Appointment synced to Square: {square_booking_id}")
            elif square_result:
                logging.warning(f"⚠️ Square booking failed: {square_result.get('error', 'Unknown error')}")
        except Exception as square_error:
            logging.warning(f"⚠️ Could not sync to Square (appointment still created locally): {square_error}")
        
        # Send notifications if requested
        notify_client = appointment_data.get('notify_client', True)
        if notify_client:
            user_email = new_appointment.get('user_email')
            user_phone = new_appointment.get('user_phone')
            user_name = new_appointment.get('user_name', 'Cliente')
            service_name = new_appointment.get('service_name', 'Cita')
            date_obj = new_appointment.get('date')
            time_str = new_appointment.get('time', '')
            
            # Format date
            if isinstance(date_obj, str):
                try:
                    date_obj = datetime.fromisoformat(date_obj.replace('Z', '+00:00'))
                except:
                    date_obj = datetime.now()
            date_formatted = format_date_spanish(date_obj) if date_obj else 'Fecha por confirmar'
            
            # Get config for notifications
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            
            # Send email notification
            if user_email and config_doc:
                try:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    if notif_service.sendgrid_client:
                        email_subject = '📅 Confirmación de Cita - Ross Tax Preparation'
                        email_body = f'''
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">Ross Tax Preparation</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <h2 style="color: #6C1110;">¡Hola {user_name}!</h2>
                                <p>Tu cita ha sido agendada exitosamente.</p>
                                
                                <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                    <p><strong>📋 Servicio:</strong> {service_name}</p>
                                    <p><strong>📅 Fecha:</strong> {date_formatted}</p>
                                    <p><strong>🕐 Hora:</strong> {time_str}</p>
                                </div>
                                
                                <p style="margin-top: 20px;"><strong>📋 Gestiona tu cita:</strong></p>
                                <p><a href="{manage_url}" style="background-color: #6C1110; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Ver o Modificar Cita</a></p>
                                
                                <p style="margin-top: 20px;">Si necesitas ayuda adicional, contáctanos:</p>
                                <p>📞 Teléfono: (806) 934-2018</p>
                                <p>📧 Email: yoandyross@gmail.com</p>
                                <p>📍 Dirección: 305 Bruce Ave, Dumas, TX 79029</p>
                            </div>
                        </div>
                        '''
                        await notif_service.send_email(user_email, email_subject, email_body)
                        print(f'✅ Email notification sent to {user_email}')
                except Exception as e:
                    print(f'❌ Error sending email: {e}')
            
            # Send SMS notification
            if user_phone and config_doc:
                try:
                    from notification_service import NotificationService
                    notif_svc = NotificationService(config_doc)
                    if notif_svc.twilio_client:
                        sms_message = f'Ross Tax: ¡Cita confirmada! {service_name} el {date_formatted} a las {time_str}.\n\n📋 Gestiona tu cita: {manage_url}\n\n📞 (806) 934-2018'
                        notif_svc.twilio_client.messages.create(
                            body=sms_message,
                            from_=notif_svc.twilio_phone_number,
                            to=user_phone
                        )
                        print(f'✅ SMS notification sent to {user_phone}')
                except Exception as e:
                    print(f'❌ Error sending SMS: {e}')
        
        # Create notification for admin/assistant who created the appointment
        try:
            admin_user_id = current_user.get('id') or current_user.get('_id') or ''
            await create_notification(
                user_id=str(admin_user_id),
                title='📅 Cita Creada',
                body=f'Nueva cita agendada: {new_appointment.get("user_name", "Cliente")} - {new_appointment.get("date")} {new_appointment.get("time")}',
                type='admin',
                data={'appointment_id': appointment_id}
            )
        except Exception as e:
            print(f'⚠️ Could not create notification: {str(e)}')
        
        return {'success': True, 'message': 'Appointment created successfully', 'id': appointment_id}
    except Exception as e:
        print(f'Error creating appointment: {e}')
        raise HTTPException(status_code=400, detail=str(e))

@admin_appt_detail_router.put('/admin/appointments/{appointment_id}')
async def update_appointment(
    appointment_id: str,
    appointment_data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Update appointment (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from bson import ObjectId
        
        update_data = {
            'scheduled_at': appointment_data['scheduled_at'],
            'appointment_type': appointment_data.get('appointment_type', 'consultation'),
            'duration_minutes': appointment_data.get('duration_minutes', 60),
            'notes': appointment_data.get('notes', ''),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'updated_by': current_user['id'],
        }
        
        if 'client_id' in appointment_data:
            # user_id is a UUID string, not an ObjectId
            update_data['user_id'] = appointment_data['client_id']
        
        # Get original appointment to check if scheduled_at changed
        original_apt = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
        if not original_apt:
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        result = await _db.appointments.update_one(
            {'_id': ObjectId(appointment_id)},
            {'$set': update_data}
        )
        
        # Send SMS if scheduled_at changed (rescheduled)
        if original_apt.get('scheduled_at') != appointment_data['scheduled_at']:
            try:
                # Get user info
                user = await _db.users.find_one({'_id': original_apt['user_id']})
                if user and user.get('phone'):
                    # Load config and send SMS
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        if notif_service.twilio_client:
                            from datetime import datetime
                            new_date = datetime.fromisoformat(appointment_data['scheduled_at'].replace('Z', '+00:00'))
                            date_str = new_date.strftime("%A, %d de %B")
                            time_str = new_date.strftime("%I:%M %p")
                            
                            apt_type = "Presencial" if appointment_data.get('appointment_type') == 'in_person' else "Videollamada"
                            
                            sms_message = f"""Tu cita ha sido REPROGRAMADA:

🔄 Nueva fecha: {date_str}
🕐 Nueva hora: {time_str}
📍 Tipo: {apt_type}

Si no puedes asistir, llámanos:
📞 806-934-2018

Ross Tax Preparation"""
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=user['phone']
                            )
                            logging.info(f"✅ Rescheduled SMS sent to {user['phone']}")
            except Exception as e:
                logging.error(f"❌ Error sending rescheduled SMS: {e}")
        
        return {'message': 'Appointment updated successfully'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@admin_appt_detail_router.put('/admin/appointments/{appointment_id}/status')
async def update_appointment_status(
    appointment_id: str,
    status_data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Update appointment status (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from bson import ObjectId
        
        # Try to find appointment with multiple ID formats
        appointment = None
        
        # Try as ObjectId first
        try:
            appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
        except:
            pass
        
        # Try as string _id
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        
        # Try as 'id' field
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            
        if not appointment:
            logging.error(f"❌ Appointment not found: {appointment_id}")
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        # Update using the found _id
        result = await _db.appointments.update_one(
            {'_id': appointment['_id']},
            {
                '$set': {
                    'status': status_data.get('status', 'scheduled'),
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                    'updated_by': current_user.get('id') or current_user.get('_id') or '',
                }
            }
        )
        
        logging.info(f"✅ Appointment {appointment_id} status updated to {status_data.get('status')}")
        
        # Send SMS if appointment was cancelled
        if status_data.get('status') == 'cancelled':
            try:
                # Get user info - try multiple ID formats
                user_id = appointment.get('user_id')
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
                
                phone = None
                if user and user.get('phone'):
                    phone = user.get('phone')
                elif appointment.get('user_phone'):
                    phone = appointment.get('user_phone')
                
                if phone:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_service = NotificationService(config_doc)
                        
                        if notif_service.twilio_client:
                            scheduled_at = appointment.get('scheduled_at') or appointment.get('date')
                            if scheduled_at:
                                if isinstance(scheduled_at, str):
                                    apt_date = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
                                else:
                                    apt_date = scheduled_at
                                date_str = apt_date.strftime("%A, %d de %B")
                                time_str = apt_date.strftime("%I:%M %p")
                            else:
                                date_str = "programada"
                                time_str = ""
                            
                            sms_message = f"""⚠️ Tu cita del {date_str} a las {time_str} ha sido CANCELADA.

Por favor contáctanos para reagendar:
📞 806-934-2018

Ross Tax Preparation"""
                            
                            clean_phone = phone.replace(' ', '').replace('-', '')
                            if not clean_phone.startswith('+'):
                                clean_phone = '+1' + clean_phone
                            
                            notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=clean_phone
                            )
                            logging.info(f"✅ Cancellation SMS sent to {clean_phone}")
            except Exception as e:
                logging.error(f"❌ Error sending cancellation SMS: {e}")
        
        # ENVIAR ENCUESTA AUTOMÁTICAMENTE cuando la cita se marca como COMPLETADA
        if status_data.get('status') == 'completed':
            try:
                from feedback_service import FeedbackService
                feedback_svc = FeedbackService(_db)
                # Usar el 'id' string de la cita, no el ObjectId
                apt_id = appointment.get('id', str(appointment['_id']))
                feedback_result = await feedback_svc.send_feedback_request(apt_id)
                if feedback_result.get('success'):
                    logging.info(f"✅ Feedback request sent automatically for appointment {appointment_id}")
                else:
                    logging.warning(f"⚠️ Could not send feedback request: {feedback_result.get('error')}")
            except Exception as e:
                logging.error(f"❌ Error sending automatic feedback request: {e}")
        
        return {'message': 'Status updated successfully'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@admin_appt_detail_router.post('/admin/appointments/{appointment_id}/remind')
async def send_appointment_reminder(appointment_id: str, request: Request):
    current_user = await _require_admin(request)
    """Send reminder notification for an appointment via Email and SMS"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Try to find appointment with multiple ID formats
        appointment = None
        try:
            appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
        except:
            pass
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            
        if not appointment:
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        user_email = appointment.get('user_email')
        user_phone = appointment.get('user_phone')
        user_name = appointment.get('user_name', 'Cliente')
        service_name = appointment.get('service_name', 'Cita')
        date_obj = appointment.get('date') or appointment.get('scheduled_at')
        time_str = appointment.get('time', '')
        
        # Format date
        if isinstance(date_obj, str):
            try:
                date_obj = datetime.fromisoformat(date_obj.replace('Z', '+00:00'))
            except:
                date_obj = datetime.now()
        date_formatted = date_obj.strftime('%d de %B, %Y') if date_obj else 'Fecha por confirmar'
        
        # If time not set, get from scheduled_at
        if not time_str and date_obj:
            time_str = date_obj.strftime('%I:%M %p')
        
        notifications_sent = []
        
        # Get notification service config
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        
        # Send email reminder
        if user_email and config_doc:
            try:
                from notification_service import NotificationService
                notif_service = NotificationService(config_doc)
                if notif_service.sendgrid_client:
                    email_subject = '⏰ Recordatorio de Cita - Ross Tax Preparation'
                    email_body = f'''
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Ross Tax Preparation</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #6C1110;">⏰ Recordatorio de Cita</h2>
                            <p>Hola {user_name}, este es un recordatorio de tu próxima cita.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                <p><strong>📋 Servicio:</strong> {service_name}</p>
                                <p><strong>📅 Fecha:</strong> {date_formatted}</p>
                                <p><strong>🕐 Hora:</strong> {time_str}</p>
                            </div>
                            
                            <p>¡Te esperamos!</p>
                            <p>📍 Dirección: 305 Bruce Ave, Dumas, TX 79029</p>
                            <p>📞 Teléfono: (806) 934-2018</p>
                        </div>
                    </div>
                    '''
                    await notif_service.send_email(user_email, email_subject, email_body)
                    notifications_sent.append('email')
                    print(f'✅ Reminder email sent to {user_email}')
            except Exception as e:
                print(f'Error sending reminder email: {e}')
        
        # Send SMS reminder
        if user_phone and config_doc:
            try:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                if notif_svc.twilio_client:
                    sms_message = f'Ross Tax: Recordatorio - Tu cita de {service_name} es el {date_formatted} a las {time_str}. Dirección: 12899 SW 132nd St, Miami. ¡Te esperamos!'
                    notif_svc.twilio_client.messages.create(
                        body=sms_message,
                        from_=notif_svc.twilio_phone_number,
                        to=user_phone
                    )
                    notifications_sent.append('sms')
                    print(f'✅ Reminder SMS sent to {user_phone}')
            except Exception as e:
                print(f'Error sending reminder SMS: {e}')
        
        return {'success': True, 'notifications_sent': notifications_sent}
    except Exception as e:
        print(f'Error sending reminder: {e}')
        raise HTTPException(status_code=500, detail=str(e))

# ============ Get Service Price for Dynamic Invoicing ============
@admin_appt_detail_router.get('/admin/service-price/{service_name}')
async def get_service_price_by_name(service_name: str, request: Request):
    current_user = await _require_admin(request)
    """Get price for a service by name - for dynamic invoicing"""
    try:
        # Search in service_prices collection
        price_doc = await _db.service_prices.find_one({
            'name': {'$regex': service_name, '$options': 'i'},
            'is_active': True
        })
        
        if price_doc:
            return {
                'service_name': price_doc.get('name', service_name),
                'price': price_doc.get('price', 180),
                'found': True
            }
        
        # Search in dynamic_services
        svc_doc = await _db.dynamic_services.find_one({
            'title': {'$regex': service_name, '$options': 'i'},
            'is_active': True
        })
        
        if svc_doc:
            return {
                'service_name': svc_doc.get('title', service_name),
                'price': svc_doc.get('price', 180),
                'found': True
            }
        
        # Default price
        return {
            'service_name': service_name,
            'price': 180,
            'found': False
        }
    except Exception as e:
        return {'service_name': service_name, 'price': 180, 'found': False}



