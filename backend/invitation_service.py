"""
Invitation Service - Sistema completo de invitaciones y auto-creación de usuarios
"""
import logging
import uuid
import secrets
import string
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from bson import ObjectId
from notification_service_v2 import notification_service_v2

logger = logging.getLogger(__name__)

class InvitationService:
    def __init__(self, db):
        self.db = db
        self.attendees_collection = db.appointment_attendees
        self.invitations_collection = db.appointment_invitations
        self.documents_collection = db.attendee_documents
        self.users_collection = db.users
        self.appointments_collection = db.appointments
        self.notification_service = notification_service_v2
        logger.info("✅ Invitation Service initialized")
    
    def generate_temp_password(self, length=12) -> str:
        """Genera una contraseña temporal aleatoria"""
        # Asegurar que tenga al menos: 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
        password = [
            secrets.choice(string.ascii_uppercase),
            secrets.choice(string.ascii_lowercase),
            secrets.choice(string.digits),
            secrets.choice('!@#$%')
        ]
        
        # Completar el resto
        all_chars = string.ascii_letters + string.digits + '!@#$%'
        password += [secrets.choice(all_chars) for _ in range(length - 4)]
        
        # Mezclar
        secrets.SystemRandom().shuffle(password)
        return ''.join(password)
    
    async def create_group_appointments(
        self,
        user_id: str,
        attendees_data: List[dict],
        appointment_data: dict
    ) -> dict:
        """
        Crea múltiples citas para un grupo y genera invitaciones
        
        Args:
            user_id: ID del usuario que agenda
            attendees_data: Lista de asistentes con sus datos
            appointment_data: Datos de la cita (fecha, hora, tipo, duración)
        """
        try:
            # Obtener datos del usuario que agenda
            inviting_user = await self.users_collection.find_one({'_id': ObjectId(user_id)})
            if not inviting_user:
                return {'success': False, 'error': 'Usuario no encontrado'}
            
            invited_by_name = inviting_user.get('name', 'Un usuario')
            
            created_appointments = []
            created_attendees = []
            created_invitations = []
            
            # Parsear fecha/hora base
            base_datetime = datetime.fromisoformat(appointment_data['scheduled_at'].replace('Z', '+00:00'))
            duration = appointment_data.get('duration_minutes', 60)
            
            # Crear una cita para cada asistente
            for index, attendee in enumerate(attendees_data):
                # Calcular hora para esta cita (consecutivas)
                appointment_time = base_datetime + timedelta(minutes=index * duration)
                
                # 1. Crear la cita
                appointment_doc = {
                    'user_id': user_id if attendee.get('is_primary_user') else None,  # null para invitados
                    'title': appointment_data.get('title', 'Consulta'),
                    'description': appointment_data.get('description'),
                    'scheduled_at': appointment_time,
                    'duration_minutes': duration,
                    'appointment_type': appointment_data.get('appointment_type', 'in_person'),
                    'status': 'scheduled',
                    'created_at': datetime.utcnow(),
                    'created_by': user_id,
                    'is_group_appointment': True,
                    'group_index': index + 1,
                    'total_in_group': len(attendees_data)
                }
                
                # Generar link de Jitsi si es videollamada
                if appointment_doc['appointment_type'] == 'video_call':
                    meeting_id = str(uuid.uuid4())[:8]
                    appointment_doc['meeting_link'] = f"https://meet.jit.si/RossTax-{meeting_id}"
                
                app_result = await self.appointments_collection.insert_one(appointment_doc)
                appointment_id = str(app_result.inserted_id)
                appointment_doc['id'] = appointment_id
                
                # 2. Crear el attendee
                attendee_doc = {
                    'appointment_id': appointment_id,
                    'name': attendee['name'],
                    'phone': attendee.get('phone'),
                    'email': attendee.get('email'),
                    'address': None,
                    'ssn_itin': None,
                    'birthdate': None,
                    'is_primary_user': attendee.get('is_primary_user', False),
                    'user_contact_id': attendee.get('user_contact_id'),
                    'created_user_id': None,  # Se llenará cuando complete el formulario
                    'created_at': datetime.utcnow(),
                    'invited_by': user_id
                }
                
                attendee_result = await self.attendees_collection.insert_one(attendee_doc)
                attendee_id = str(attendee_result.inserted_id)
                attendee_doc['id'] = attendee_id
                
                # 3. Si NO es el usuario principal, crear invitación
                if not attendee.get('is_primary_user'):
                    invitation_token = str(uuid.uuid4())
                    expires_at = datetime.utcnow() + timedelta(days=7)
                    
                    # Determinar cómo enviar (SMS, email, o ambos)
                    has_phone = bool(attendee.get('phone'))
                    has_email = bool(attendee.get('email'))
                    
                    if not has_phone and not has_email:
                        logger.warning(f"⚠️ Attendee {attendee['name']} has no contact info")
                        continue
                    
                    sent_via = 'both' if (has_phone and has_email) else ('sms' if has_phone else 'email')
                    
                    invitation_doc = {
                        'attendee_id': attendee_id,
                        'invitation_token': invitation_token,
                        'status': 'pending',
                        'sent_via': sent_via,
                        'sent_at': datetime.utcnow(),
                        'opened_at': None,
                        'completed_at': None,
                        'expires_at': expires_at,
                        'sms_delivery_status': None,
                        'email_delivery_status': None
                    }
                    
                    inv_result = await self.invitations_collection.insert_one(invitation_doc)
                    invitation_doc['id'] = str(inv_result.inserted_id)
                    
                    # 4. Enviar notificaciones

                    invitation_link = f"https://app-nueva-production.up.railway.app/invitation/{invitation_token}"

                    invitation_link = f"https://app-nueva-production.up.railway.app/invitation/{invitation_token}"

                    
                    formatted_date = appointment_time.strftime('%d de %B, %Y')
                    formatted_time = appointment_time.strftime('%I:%M %p')
                    formatted_expires = expires_at.strftime('%d de %B')
                    
                    # Enviar SMS
                    if has_phone:
                        sms_result = await self.notification_service.send_invitation_sms(
                            to_phone=attendee['phone'],
                            attendee_name=attendee['name'],
                            invited_by=invited_by_name,
                            appointment_date=formatted_date,
                            appointment_time=formatted_time,
                            invitation_link=invitation_link
                        )
                        
                        if sms_result['success']:
                            await self.invitations_collection.update_one(
                                {'_id': inv_result.inserted_id},
                                {'$set': {'sms_delivery_status': 'sent'}}
                            )
                            logger.info(f"📱 SMS sent to {attendee['name']}")
                        else:
                            logger.error(f"❌ SMS failed for {attendee['name']}")
                    
                    # Enviar Email
                    if has_email:
                        email_result = await self.notification_service.send_invitation_email(
                            to_email=attendee['email'],
                            attendee_name=attendee['name'],
                            invited_by=invited_by_name,
                            appointment_date=formatted_date,
                            appointment_time=formatted_time,
                            appointment_type=appointment_doc['appointment_type'],
                            invitation_link=invitation_link,
                            expires_date=formatted_expires
                        )
                        
                        if email_result['success']:
                            await self.invitations_collection.update_one(
                                {'_id': inv_result.inserted_id},
                                {'$set': {'email_delivery_status': 'sent'}}
                            )
                            logger.info(f"📧 Email sent to {attendee['name']}")
                        else:
                            logger.error(f"❌ Email failed for {attendee['name']}")
                    
                    created_invitations.append(invitation_doc)
                
                created_appointments.append(appointment_doc)
                created_attendees.append(attendee_doc)
            
            logger.info(f"✅ Created {len(created_appointments)} group appointments")
            
            return {
                'success': True,
                'appointments': created_appointments,
                'attendees': created_attendees,
                'invitations': created_invitations,
                'message': f'{len(created_appointments)} citas creadas exitosamente'
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating group appointments: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def get_invitation_by_token(self, token: str) -> Optional[dict]:
        """Obtiene invitación por token (página pública)"""
        try:
            invitation = await self.invitations_collection.find_one({
                'invitation_token': token
            })
            
            if not invitation:
                return None
            
            # Marcar como vista si es la primera vez
            if invitation['status'] == 'pending' and not invitation.get('opened_at'):
                await self.invitations_collection.update_one(
                    {'_id': invitation['_id']},
                    {'$set': {
                        'status': 'viewed',
                        'opened_at': datetime.utcnow()
                    }}
                )
                invitation['opened_at'] = datetime.utcnow()
            
            # Obtener datos del attendee
            attendee = await self.attendees_collection.find_one({
                '_id': ObjectId(invitation['attendee_id'])
            })
            
            if not attendee:
                return None
            
            # Obtener datos de la cita
            appointment = await self.appointments_collection.find_one({
                '_id': ObjectId(attendee['appointment_id'])
            })
            
            if not appointment:
                return None
            
            # Obtener nombre de quien invitó
            inviting_user = await self.users_collection.find_one({
                '_id': ObjectId(attendee['invited_by'])
            })
            invited_by_name = inviting_user.get('name', 'Un usuario') if inviting_user else 'Un usuario'
            
            # Verificar si ya expiró
            is_expired = datetime.utcnow() > invitation['expires_at']
            already_completed = invitation['status'] == 'completed'
            
            return {
                'invitation_id': str(invitation['_id']),
                'attendee_id': str(attendee['_id']),
                'attendee_name': attendee['name'],
                'attendee_phone': attendee.get('phone'),
                'attendee_email': attendee.get('email'),
                'appointment_date': appointment['scheduled_at'].strftime('%d de %B, %Y'),
                'appointment_time': appointment['scheduled_at'].strftime('%I:%M %p'),
                'appointment_type': appointment['appointment_type'],
                'duration_minutes': appointment['duration_minutes'],
                'invited_by': invited_by_name,
                'status': invitation['status'],
                'expires_at': invitation['expires_at'],
                'is_expired': is_expired,
                'already_completed': already_completed
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting invitation: {e}")
            return None
    
    async def complete_invitation(
        self,
        token: str,
        attendee_data: dict,
        uploaded_documents: List[dict]
    ) -> dict:
        """
        Completa la invitación, crea el usuario automáticamente y envía credenciales
        
        Args:
            token: Token de invitación
            attendee_data: Datos personales completados
            uploaded_documents: Lista de documentos subidos
        """
        try:
            # Obtener invitación
            invitation = await self.invitations_collection.find_one({
                'invitation_token': token
            })
            
            if not invitation:
                return {'success': False, 'error': 'Invitación no válida'}
            
            if invitation['status'] == 'completed':
                return {'success': False, 'error': 'Esta invitación ya fue completada'}
            
            if datetime.utcnow() > invitation['expires_at']:
                return {'success': False, 'error': 'Esta invitación ha expirado'}
            
            # Obtener attendee
            attendee = await self.attendees_collection.find_one({
                '_id': ObjectId(invitation['attendee_id'])
            })
            
            if not attendee:
                return {'success': False, 'error': 'Asistente no encontrado'}
            
            # Actualizar datos del attendee
            update_data = {k: v for k, v in attendee_data.items() if v is not None}
            update_data['updated_at'] = datetime.utcnow()
            
            await self.attendees_collection.update_one(
                {'_id': ObjectId(invitation['attendee_id'])},
                {'$set': update_data}
            )
            
            # Obtener el attendee actualizado
            attendee = await self.attendees_collection.find_one({
                '_id': ObjectId(invitation['attendee_id'])
            })
            
            # 🎯 AUTO-CREAR USUARIO
            email = attendee.get('email')
            if not email:
                return {'success': False, 'error': 'Se requiere email para crear la cuenta'}
            
            # Verificar si ya existe un usuario con este email
            existing_user = await self.users_collection.find_one({'email': email})
            
            if existing_user:
                logger.info(f"Usuario ya existe: {email}")
                user_id = str(existing_user['_id'])
                
                # Asociar cita al usuario existente
                await self.appointments_collection.update_one(
                    {'_id': ObjectId(attendee['appointment_id'])},
                    {'$set': {'user_id': user_id}}
                )
                
                # Marcar attendee con user_id
                await self.attendees_collection.update_one(
                    {'_id': ObjectId(invitation['attendee_id'])},
                    {'$set': {'created_user_id': user_id}}
                )
                
            else:
                # Crear nuevo usuario
                temp_password = self.generate_temp_password()
                
                # Hash de la contraseña
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                hashed_password = pwd_context.hash(temp_password)
                
                new_user = {
                    'email': email,
                    'password_hash': hashed_password,
                    'name': attendee['name'],
                    'phone': attendee.get('phone'),
                    'address': attendee.get('address'),
                    'role': 'client',
                    'created_at': datetime.utcnow(),
                    'invited_by': attendee['invited_by'],
                    'source': 'group_invitation',
                    'email_verified': True,  # Auto-verificado porque llegó vía link
                    'must_change_password': True,
                    'profile': {
                        'ssn_itin': attendee.get('ssn_itin'),
                        'birthdate': attendee.get('birthdate')
                    }
                }
                
                user_result = await self.users_collection.insert_one(new_user)
                user_id = str(user_result.inserted_id)
                
                logger.info(f"✅ Usuario auto-creado: {email}")
                
                # Asociar cita al nuevo usuario
                await self.appointments_collection.update_one(
                    {'_id': ObjectId(attendee['appointment_id'])},
                    {'$set': {'user_id': user_id}}
                )
                
                # Marcar attendee con user_id
                await self.attendees_collection.update_one(
                    {'_id': ObjectId(invitation['attendee_id'])},
                    {'$set': {'created_user_id': user_id}}
                )
                
                # 📧 Enviar credenciales por SMS y Email
                phone = attendee.get('phone')
                name = attendee['name']
                
                if phone:
                    await self.notification_service.send_welcome_credentials_sms(
                        to_phone=phone,
                        name=name,
                        email=email,
                        temp_password=temp_password
                    )
                
                if email:
                    await self.notification_service.send_welcome_credentials_email(
                        to_email=email,
                        name=name,
                        temp_password=temp_password
                    )
                
                logger.info(f"📱 Credenciales enviadas a {name}")
            
            # Asociar documentos al usuario
            if uploaded_documents:
                for doc in uploaded_documents:
                    doc['user_id'] = user_id
                    doc['uploaded_via'] = 'invitation'
                    await self.documents_collection.insert_one(doc)
            
            # Marcar invitación como completada
            await self.invitations_collection.update_one(
                {'_id': invitation['_id']},
                {'$set': {
                    'status': 'completed',
                    'completed_at': datetime.utcnow()
                }}
            )
            
            logger.info(f"✅ Invitation completed for {attendee['name']}")
            
            return {
                'success': True,
                'user_id': user_id,
                'message': 'Información completada exitosamente. Tu cuenta ha sido creada.',
                'credentials_sent': not existing_user
            }
            
        except Exception as e:
            logger.error(f"❌ Error completing invitation: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def get_appointment_attendees(self, appointment_ids: List[str]) -> List[dict]:
        """Obtiene todos los asistentes para un grupo de citas"""
        try:
            attendees = []
            
            for app_id in appointment_ids:
                attendee = await self.attendees_collection.find_one({
                    'appointment_id': app_id
                })
                
                if attendee:
                    attendee['id'] = str(attendee['_id'])
                    attendee['_id'] = str(attendee['_id'])
                    
                    # Obtener status de invitación si existe
                    invitation = await self.invitations_collection.find_one({
                        'attendee_id': str(attendee['_id'])
                    })
                    
                    if invitation:
                        attendee['invitation_status'] = invitation['status']
                        attendee['invitation_sent_at'] = invitation.get('sent_at')
                        attendee['invitation_opened_at'] = invitation.get('opened_at')
                        attendee['invitation_completed_at'] = invitation.get('completed_at')
                    else:
                        attendee['invitation_status'] = 'primary_user'
                    
                    # Contar documentos
                    doc_count = await self.documents_collection.count_documents({
                        'attendee_id': str(attendee['_id'])
                    })
                    attendee['documents_uploaded'] = doc_count
                    
                    attendees.append(attendee)
            
            return attendees
            
        except Exception as e:
            logger.error(f"❌ Error getting attendees: {e}")
            return []
