"""
Feedback Service - Gestión de reseñas y feedback post-cita
"""
import logging
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from bson import ObjectId
from notification_service_v2 import notification_service_v2

logger = logging.getLogger(__name__)

class FeedbackService:
    def __init__(self, db):
        self.db = db
        self.feedback_requests_collection = db.feedback_requests
        self.feedback_responses_collection = db.feedback_responses
        self.appointments_collection = db.appointments
        self.users_collection = db.users
        self.notification_service = notification_service_v2
        logger.info("✅ Feedback Service initialized")
    
    async def send_feedback_request(self, appointment_id: str) -> dict:
        """
        Envía solicitud de feedback cuando una cita se marca como completada
        """
        try:
            # Obtener cita (appointments use string IDs, not ObjectIds)
            appointment = await self.appointments_collection.find_one({
                'id': appointment_id
            })
            
            if not appointment:
                return {'success': False, 'error': 'Cita no encontrada'}
            
            # Obtener usuario (users use string IDs, not ObjectIds)
            user = await self.users_collection.find_one({
                '_id': appointment['user_id']
            })
            
            if not user:
                return {'success': False, 'error': 'Usuario no encontrado'}
            
            # Generar token único
            feedback_token = str(uuid.uuid4())
            
            # Crear solicitud de feedback
            request_doc = {
                'appointment_id': appointment_id,
                'user_id': appointment['user_id'],
                'feedback_token': feedback_token,
                'sent_at': datetime.utcnow(),
                'completed_at': None,
                'sms_sent': False,
                'email_sent': False,
                'reminder_sent': False
            }
            
            result = await self.feedback_requests_collection.insert_one(request_doc)
            
            # Construir link de feedback

            feedback_link = f"https://app-nueva-production.up.railway.app/feedback/{feedback_token}"

            feedback_link = f"https://app-nueva-production.up.railway.app/feedback/{feedback_token}"

            
            # Enviar SMS si tiene teléfono
            if user.get('phone'):
                sms_result = await self._send_feedback_sms(
                    phone=user['phone'],
                    name=user.get('name', 'Cliente'),
                    feedback_link=feedback_link
                )
                if sms_result['success']:
                    await self.feedback_requests_collection.update_one(
                        {'_id': result.inserted_id},
                        {'$set': {'sms_sent': True}}
                    )
            
            # Enviar Email si tiene email
            if user.get('email'):
                email_result = await self._send_feedback_email(
                    email=user['email'],
                    name=user.get('name', 'Cliente'),
                    feedback_link=feedback_link,
                    appointment_type=appointment.get('title', 'Consulta')
                )
                if email_result['success']:
                    await self.feedback_requests_collection.update_one(
                        {'_id': result.inserted_id},
                        {'$set': {'email_sent': True}}
                    )
            
            logger.info(f"✅ Feedback request sent for appointment {appointment_id}")
            
            return {
                'success': True,
                'request_id': str(result.inserted_id),
                'feedback_token': feedback_token,
                'message': 'Solicitud de feedback enviada'
            }
            
        except Exception as e:
            logger.error(f"❌ Error sending feedback request: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _send_feedback_sms(self, phone: str, name: str, feedback_link: str) -> dict:
        """Envía SMS de solicitud de feedback"""
        try:
            message_body = (
                f"¡Gracias por visitarnos {name}! 🌟\n\n"
                f"Tu opinión es muy importante para nosotros.\n"
                f"Califica tu experiencia aquí:\n{feedback_link}\n\n"
                f"¡Gracias por elegirnos! - Ross Tax"
            )
            
            message = self.notification_service.twilio_client.messages.create(
                body=message_body,
                from_=self.notification_service.twilio_phone,
                to=phone
            )
            
            logger.info(f"📱 Feedback SMS sent to {phone}")
            return {'success': True, 'message_sid': message.sid}
            
        except Exception as e:
            logger.error(f"❌ Failed to send feedback SMS: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _send_feedback_email(self, email: str, name: str, feedback_link: str, appointment_type: str) -> dict:
        """Envía email de solicitud de feedback"""
        if not self.notification_service.sendgrid_client:
            return {'success': False, 'error': 'SendGrid not configured'}
        
        try:
            from sendgrid.helpers.mail import Mail, Email, To, Content
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; }}
                    .stars {{ font-size: 40px; text-align: center; margin: 20px 0; }}
                    .button {{ display: inline-block; background: #4ECDC4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }}
                    .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>¡Gracias {name}!</h1>
                        <p>Tu opinión nos ayuda a mejorar</p>
                    </div>
                    <div class="content">
                        <p>Esperamos que hayas tenido una excelente experiencia en tu {appointment_type}.</p>
                        
                        <div class="stars">⭐⭐⭐⭐⭐</div>
                        
                        <p style="text-align: center;">
                            <strong>¿Cómo fue tu experiencia?</strong>
                        </p>
                        
                        <p>Tu feedback nos ayuda a seguir mejorando nuestros servicios y ayudar mejor a nuestra comunidad.</p>
                        
                        <center>
                            <a href="{feedback_link}" class="button">
                                📝 Dejar mi Opinión
                            </a>
                        </center>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px;">
                            Solo te tomará 2 minutos. ¡Gracias por tu tiempo!
                        </p>
                    </div>
                    <div class="footer">
                        <p>Ross Tax Preparation | Tu Socio en Impuestos</p>
                        <p>Este email se envió porque completaste una cita con nosotros.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.notification_service.from_email, "Ross Tax Preparation"),
                to_emails=To(email),
                subject="¡Gracias por visitarnos! Comparte tu experiencia 🌟",
                html_content=Content("text/html", html_content)
            )
            
            response = self.notification_service.sendgrid_client.send(message)
            logger.info(f"📧 Feedback email sent to {email}")
            
            return {'success': True, 'status_code': response.status_code}
            
        except Exception as e:
            logger.error(f"❌ Failed to send feedback email: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_feedback_request(self, token: str) -> Optional[dict]:
        """Obtiene solicitud de feedback por token"""
        try:
            request = await self.feedback_requests_collection.find_one({
                'feedback_token': token
            })
            
            if not request:
                return None
            
            # Obtener datos de la cita
            appointment = await self.appointments_collection.find_one({
                'id': request['appointment_id']
            })
            
            # Obtener datos del usuario
            user = await self.users_collection.find_one({
                '_id': request['user_id']
            })
            
            return {
                'request_id': str(request['_id']),
                'appointment_id': request['appointment_id'],
                'user_id': request['user_id'],
                'user_name': user.get('name', 'Cliente') if user else 'Cliente',
                'appointment_type': appointment.get('title', 'Consulta') if appointment else 'Consulta',
                'appointment_date': appointment.get('scheduled_at').strftime('%d/%m/%Y') if appointment else '',
                'already_completed': request.get('completed_at') is not None
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting feedback request: {e}")
            return None
    
    async def submit_feedback(
        self,
        token: str,
        rating: int,
        comment: Optional[str],
        publish_to_google: bool,
        allow_use_name: bool
    ) -> dict:
        """Guarda el feedback del cliente"""
        try:
            # Obtener solicitud
            request = await self.feedback_requests_collection.find_one({
                'feedback_token': token
            })
            
            if not request:
                return {'success': False, 'error': 'Solicitud no encontrada'}
            
            if request.get('completed_at'):
                return {'success': False, 'error': 'Ya has enviado tu feedback'}
            
            # Guardar respuesta
            response_doc = {
                'request_id': str(request['_id']),
                'appointment_id': request['appointment_id'],
                'user_id': request['user_id'],
                'rating': rating,
                'comment': comment,
                'publish_to_google': publish_to_google,
                'allow_use_name': allow_use_name,
                'status': 'approved' if rating >= 4 else 'pending',  # Auto-aprobar 4-5 estrellas
                'google_published': False,
                'admin_response': None,
                'created_at': datetime.utcnow()
            }
            
            result = await self.feedback_responses_collection.insert_one(response_doc)
            
            # Marcar solicitud como completada
            await self.feedback_requests_collection.update_one(
                {'_id': request['_id']},
                {'$set': {'completed_at': datetime.utcnow()}}
            )
            
            logger.info(f"✅ Feedback submitted: {rating} stars")
            
            # Link de Google Reviews para Ross Tax Preparation
            # Usando búsqueda por nombre que redirige automáticamente
            google_link = "https://search.google.com/local/writereview?placeid=ChIJX_hjXQPDQIYRqYK7XuZ7kzc"
            # Alternativa si el Place ID no funciona:
            # google_link = "https://www.google.com/maps/search/Ross+Tax+Preparation+305+Bruce+Ave+Dumas+TX"
            
            return {
                'success': True,
                'feedback_id': str(result.inserted_id),
                'rating': rating,
                'message': '¡Gracias por tu feedback!',
                'google_link': google_link if publish_to_google else None
            }
            
        except Exception as e:
            logger.error(f"❌ Error submitting feedback: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_all_feedback(self, status: Optional[str] = None, limit: int = 50) -> List[dict]:
        """Obtiene todo el feedback (admin)"""
        try:
            query = {}
            if status:
                query['status'] = status
            
            cursor = self.feedback_responses_collection.find(query).sort('created_at', -1).limit(limit)
            responses = await cursor.to_list(length=limit)
            
            # Enriquecer con datos de usuario
            enriched = []
            for resp in responses:
                user = await self.users_collection.find_one({'_id': resp['user_id']})
                
                # Create clean response object
                clean_resp = {
                    'id': str(resp['_id']),
                    'request_id': resp.get('request_id'),
                    'appointment_id': resp.get('appointment_id'),
                    'user_id': resp.get('user_id'),
                    'user_name': user.get('name', 'Usuario') if user else 'Usuario',
                    'rating': resp.get('rating'),
                    'comment': resp.get('comment'),
                    'publish_to_google': resp.get('publish_to_google', False),
                    'allow_use_name': resp.get('allow_use_name', True),
                    'status': resp.get('status', 'pending'),
                    'google_published': resp.get('google_published', False),
                    'admin_response': resp.get('admin_response'),
                    'created_at': resp.get('created_at').isoformat() if resp.get('created_at') else None
                }
                enriched.append(clean_resp)
            
            return enriched
            
        except Exception as e:
            logger.error(f"❌ Error getting feedback: {e}")
            return []
    
    async def get_feedback_stats(self) -> dict:
        """Calcula estadísticas de feedback"""
        try:
            # Total de respuestas
            total = await self.feedback_responses_collection.count_documents({})
            
            # Total de solicitudes
            total_requests = await self.feedback_requests_collection.count_documents({})
            
            # Contar por rating
            pipeline = [
                {'$group': {
                    '_id': '$rating',
                    'count': {'$sum': 1}
                }}
            ]
            rating_counts = await self.feedback_responses_collection.aggregate(pipeline).to_list(length=5)
            
            ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            total_rating_sum = 0
            
            for item in rating_counts:
                ratings[item['_id']] = item['count']
                total_rating_sum += item['_id'] * item['count']
            
            average = round(total_rating_sum / total, 2) if total > 0 else 0
            response_rate = round((total / total_requests * 100), 1) if total_requests > 0 else 0
            
            pending = await self.feedback_responses_collection.count_documents({'status': 'pending'})
            
            return {
                'total_reviews': total,
                'average_rating': average,
                'five_star': ratings[5],
                'four_star': ratings[4],
                'three_star': ratings[3],
                'two_star': ratings[2],
                'one_star': ratings[1],
                'response_rate': response_rate,
                'pending_count': pending
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculating stats: {e}")
            return {
                'total_reviews': 0,
                'average_rating': 0,
                'five_star': 0,
                'four_star': 0,
                'three_star': 0,
                'two_star': 0,
                'one_star': 0,
                'response_rate': 0,
                'pending_count': 0
            }
