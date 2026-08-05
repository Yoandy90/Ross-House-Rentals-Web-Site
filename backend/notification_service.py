"""
Notification Service for sending Email and SMS notifications
Includes automatic email tracking (open/click tracking)
"""
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from twilio.rest import Client
from datetime import datetime
from typing import Optional
import logging
import requests
import uuid
import os

logger = logging.getLogger(__name__)

# ================== SPANISH DATE FORMATTING ==================
MESES_ES = {
    1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
    5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
    9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
}

DIAS_ES = {
    'monday': 'lunes', 'tuesday': 'martes', 'wednesday': 'miércoles',
    'thursday': 'jueves', 'friday': 'viernes', 'saturday': 'sábado', 'sunday': 'domingo'
}

def format_date_spanish(dt: datetime) -> str:
    """Format datetime to Spanish: 'lunes, 12 de marzo del 2026'"""
    if not dt:
        return ''
    day_en = dt.strftime('%A').lower()
    day_es = DIAS_ES.get(day_en, day_en)
    return f"{day_es}, {dt.day} de {MESES_ES.get(dt.month, '')} del {dt.year}"

def format_date_spanish_short(dt: datetime) -> str:
    """Format datetime to Spanish short: '12 de marzo, 2026'"""
    if not dt:
        return ''
    return f"{dt.day} de {MESES_ES.get(dt.month, '')}, {dt.year}"


class NotificationService:
    def __init__(self, config: dict):
        """
        Initialize notification service with API credentials from config
        
        Args:
            config: Dictionary containing API keys and company info
        """
        self.config = config
        
        # SendGrid setup
        self.sendgrid_api_key = config.get('sendgrid_api_key')
        self.sendgrid_from_email = config.get('sendgrid_from_email', 'noreply@rosstaxprep.com')
        self.sendgrid_from_name = config.get('sendgrid_from_name', 'Ross Tax Preparation')
        
        # Twilio setup
        self.twilio_account_sid = config.get('twilio_account_sid')
        self.twilio_auth_token = config.get('twilio_auth_token')
        self.twilio_phone_number = config.get('twilio_phone_number')
        
        # Company info
        self.company_name = config.get('company_name', 'Ross Tax Preparation')
        self.company_phone = config.get('company_phone', '806-934-2018')
        self.company_address = config.get('company_address', '305 Bruce Ave, Dumas, TX 79029')
        self.company_email = config.get('company_email', 'info@rosstaxpreparation.com')
        
        # Initialize clients
        self.sendgrid_client = None
        self.twilio_client = None
        
        if self.sendgrid_api_key:
            try:
                self.sendgrid_client = SendGridAPIClient(self.sendgrid_api_key)
                logger.info("SendGrid client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize SendGrid client: {e}")
        
        if self.twilio_account_sid and self.twilio_auth_token:
            try:
                self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
                logger.info("Twilio client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
        
        # Email tracking
        self._tracking_db = None
        self._tracking_base_url = os.getenv('TRACKING_BASE_URL', 'https://app-nueva-production-4d5d.up.railway.app/api')
    
    def set_tracking_db(self, db):
        """Set MongoDB database reference for email tracking"""
        self._tracking_db = db
        print(f"📧 Email tracking enabled (db={db is not None})")
        logger.info("📧 Email tracking enabled")
    
    async def _create_tracking_record(self, to_email: str, subject: str) -> Optional[str]:
        """Create a tracking record and return tracking_id"""
        if self._tracking_db is None:
            return None
        try:
            tracking_id = str(uuid.uuid4())
            await self._tracking_db.email_tracking.insert_one({
                'tracking_id': tracking_id,
                'to_email': to_email,
                'subject': subject,
                'sent_at': datetime.utcnow(),
                'opened': False,
                'opened_at': None,
                'open_count': 0,
                'clicked': False,
                'clicked_at': None,
                'click_count': 0,
                'from_email': self.sendgrid_from_email,
                'from_name': self.sendgrid_from_name,
            })
            return tracking_id
        except Exception as e:
            logger.error(f"Error creating tracking record: {e}")
            return None
    
    def _inject_tracking_pixel(self, html_content: str, tracking_id: str) -> str:
        """Inject invisible tracking pixel before </body> or at end of HTML"""
        pixel_url = f"{self._tracking_base_url}/track/email/{tracking_id}"
        pixel_tag = f'<img src="{pixel_url}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />'
        
        if '</body>' in html_content:
            return html_content.replace('</body>', f'{pixel_tag}</body>')
        elif '</html>' in html_content:
            return html_content.replace('</html>', f'{pixel_tag}</html>')
        else:
            return html_content + pixel_tag
    
    def _format_phone_e164(self, phone: str) -> str:
        """
        Format phone number to E.164 format for Twilio.
        Strips non-digit characters, then prepends +1 for US numbers if missing.
        """
        if not phone:
            return phone
        # Strip all non-digit characters except leading +
        cleaned = phone.strip()
        if cleaned.startswith('+'):
            digits = '+' + ''.join(c for c in cleaned[1:] if c.isdigit())
        else:
            digits = ''.join(c for c in cleaned if c.isdigit())
        
        # If already has country code with +, return as-is
        if digits.startswith('+'):
            return digits
        
        # US numbers: 10 digits → prepend +1
        if len(digits) == 10:
            return f"+1{digits}"
        # Already has country code (11 digits starting with 1)
        if len(digits) == 11 and digits.startswith('1'):
            return f"+{digits}"
        
        # Fallback: prepend + if not present
        return f"+{digits}"

    async def send_sms(self, to_phone: str, message: str) -> bool:
        """
        Generic method to send SMS via Twilio
        
        Args:
            to_phone: Recipient phone number
            message: SMS message content
            
        Returns:
            bool: True if sent successfully, False otherwise
        """
        if not self.twilio_client:
            logger.error("Twilio client not initialized")
            return False
        
        try:
            # Format phone to E.164 (e.g. +18069342018)
            formatted_phone = self._format_phone_e164(to_phone)
            logger.info(f"📱 Formatting phone: '{to_phone}' → '{formatted_phone}'")
            
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_phone_number,
                to=formatted_phone
            )
            logger.info(f"✅ SMS sent to {to_phone}, SID: {message_obj.sid}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send SMS to {to_phone}: {e}")
            return False
    
    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Generic method to send email via SendGrid with automatic tracking
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of email
            
        Returns:
            bool: True if sent successfully, False otherwise
        """
        if not self.sendgrid_client:
            logger.error("SendGrid client not initialized")
            return False
        
        try:
            # Auto-inject tracking pixel if DB is available
            tracking_id = None
            tracked_html = html_content
            if self._tracking_db is not None:
                tracking_id = await self._create_tracking_record(to_email, subject)
                if tracking_id:
                    tracked_html = self._inject_tracking_pixel(html_content, tracking_id)
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", tracked_html)
            )
            
            response = self.sendgrid_client.send(message)
            
            if tracking_id:
                logger.info(f"✅ Email sent to {to_email} [tracked:{tracking_id[:8]}], status: {response.status_code}")
            else:
                logger.info(f"✅ Email sent to {to_email}, status: {response.status_code}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {e}")
            return False
    
    async def send_appointment_confirmation_email(
        self,
        to_email: str,
        user_name: str,
        appointment_date: datetime,
        appointment_type: str,
        description: Optional[str] = None,
        meeting_link: Optional[str] = None,
        appointment_id: Optional[str] = None
    ) -> bool:
        """Send appointment confirmation email with manage link"""
        if not self.sendgrid_api_key:
            logger.warning("SendGrid not configured, skipping email notification")
            return False
        
        try:
            # Format date and time in Spanish
            date_str = format_date_spanish(appointment_date)
            time_str = appointment_date.strftime("%I:%M %p")
            
            # Determine if this is a video call
            is_video_call = 'video' in appointment_type.lower() or meeting_link is not None
            
            # Deep link and App Store fallback
            app_deep_link = "rosstax://appointments"
            app_store_link = "https://apps.apple.com/app/id6755496120"
            
            # Create email content
            subject = f"{'📹 Videollamada' if is_video_call else '📅 Cita'} Confirmada - {self.company_name}"
            
            # Video call specific section
            video_call_section = ""
            if is_video_call and meeting_link:
                video_call_section = f"""
                        <div style="background-color: #10B981; color: white; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center;">
                            <h3 style="margin: 0 0 10px 0;">📹 Tu Videollamada</h3>
                            <p style="margin: 0 0 15px 0; font-size: 14px;">Haz clic en el botón para unirte a la reunión:</p>
                            <a href="{meeting_link}" style="display: inline-block; background-color: white; color: #10B981; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                🎥 Unirse a la Videollamada
                            </a>
                            <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.9;">
                                Link: {meeting_link}
                            </p>
                        </div>
                        
                        <div style="background-color: #ECFDF5; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10B981;">
                            <h4 style="color: #059669; margin: 0 0 10px 0;">📋 Antes de la videollamada:</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #047857;">
                                <li>Asegúrate de tener buena conexión a internet</li>
                                <li>Busca un lugar tranquilo y bien iluminado</li>
                                <li>Prueba tu cámara y micrófono antes de la cita</li>
                                <li>Ten tus documentos listos para mostrar en pantalla</li>
                                <li>Puedes unirte hasta 15 minutos antes de la hora</li>
                            </ul>
                        </div>
                """
            
            # In-person specific section
            in_person_section = ""
            if not is_video_call:
                in_person_section = f"""
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">📍 Información de Contacto</h3>
                            <p style="margin: 5px 0;"><strong>Dirección:</strong> {self.company_address}</p>
                            <p style="margin: 5px 0;"><strong>Teléfono:</strong> {self.company_phone}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {self.company_email}</p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <h3 style="color: #6C1110;">📋 Importante - Por favor trae:</h3>
                            <ul>
                                <li>Identificación válida (ID o licencia de conducir)</li>
                                <li>Tarjeta de Seguro Social o ITIN</li>
                                <li>Todos los documentos fiscales relevantes</li>
                                <li>Información de ingresos del año fiscal</li>
                            </ul>
                        </div>
                """
            
            # Manage appointment section
            manage_section = f"""
                        <div style="text-align: center; margin: 30px 0 10px 0;">
                            <a href="{app_deep_link}" style="display: inline-block; background-color: #1E3A5F; color: white; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">
                                📱 Gestionar mi Cita
                            </a>
                            <p style="margin: 12px 0 0 0; font-size: 13px; color: #888;">
                                Abre la app para ver, cancelar o reprogramar tu cita
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 12px;">
                                <a href="{app_store_link}" style="color: #1E3A5F;">¿No tienes la app? Descárgala aquí</a>
                            </p>
                        </div>
            """
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">{self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: #6C1110;">{'📹 ¡Videollamada Confirmada!' if is_video_call else '✅ ¡Cita Confirmada!'}</h2>
                        
                        <p>Hola {user_name},</p>
                        
                        <p>Tu {'videollamada' if is_video_call else 'cita'} ha sido programada exitosamente. Aquí están los detalles:</p>
                        
                        <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid {'#10B981' if is_video_call else '#5DC1D9'};">
                            <p style="margin: 5px 0;"><strong>📌 Tipo:</strong> {appointment_type}</p>
                            <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> {date_str}</p>
                            <p style="margin: 5px 0;"><strong>⏰ Hora:</strong> {time_str}</p>
                            {f'<p style="margin: 5px 0;"><strong>📝 Detalles:</strong> {description}</p>' if description else ''}
                        </div>
                        
                        {video_call_section}
                        {in_person_section}
                        {manage_section}
                        
                        <p style="margin-top: 20px;">¡Esperamos {'hablar contigo' if is_video_call else 'verte'} pronto!</p>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666;">
                            Este es un correo automático, por favor no respondas a este mensaje.
                            Si tienes preguntas, contáctanos al {self.company_phone} o {self.company_email}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Send email using requests directly (more reliable than SDK in FastAPI context)
            logger.info(f"🔑 SendGrid API Key (first 20 chars): {self.sendgrid_api_key[:20] if self.sendgrid_api_key else 'None'}")
            headers = {
                "Authorization": f"Bearer {self.sendgrid_api_key}",
                "Content-Type": "application/json"
            }
            
            email_data = {
                "personalizations": [{
                    "to": [{"email": to_email}],
                    "subject": subject
                }],
                "from": {
                    "email": self.sendgrid_from_email,
                    "name": self.sendgrid_from_name
                },
                "content": [{
                    "type": "text/html",
                    "value": html_content
                }]
            }
            
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers=headers,
                json=email_data,
                timeout=10
            )
            
            if response.status_code in [200, 202]:
                logger.info(f"Email sent successfully to {to_email}. Status: {response.status_code}")
                return True
            else:
                logger.error(f"SendGrid API error: {response.status_code} - {response.text}")
                return False
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    async def send_appointment_confirmation_sms(
        self,
        to_phone: str,
        user_name: str,
        appointment_date: datetime,
        appointment_type: str
    ) -> bool:
        """Send appointment confirmation SMS with manage link"""
        if not self.twilio_client or not self.twilio_phone_number:
            logger.warning("Twilio not configured, skipping SMS notification")
            return False
        
        try:
            # Format date and time
            date_str = appointment_date.strftime("%m/%d/%Y")
            time_str = appointment_date.strftime("%I:%M %p")
            
            # App Store link for managing
            app_store_link = "https://apps.apple.com/app/id6755496120"
            
            # Create SMS message with manage link
            message_body = (
                f"{self.company_name}: Cita Confirmada!\n\n"
                f"Hola {user_name},\n"
                f"Tipo: {appointment_type}\n"
                f"Fecha: {date_str}\n"
                f"Hora: {time_str}\n"
                f"Dirección: {self.company_address}\n\n"
                f"📱 Gestiona tu cita desde la app:\n{app_store_link}\n\n"
                f"Para dudas llámanos: {self.company_phone}"
            )
            
            # Format phone to E.164
            formatted_phone = self._format_phone_e164(to_phone)
            
            # Send SMS
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=formatted_phone
            )
            
            logger.info(f"SMS sent successfully to {formatted_phone}. SID: {message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send SMS to {to_phone}: {e}")
            return False

    
    async def send_appointment_cancellation_sms(
        self,
        to_phone: str,
        user_name: str,
        appointment_title: str,
        appointment_date: datetime
    ) -> bool:
        """Send appointment cancellation SMS"""
        if not self.twilio_client or not self.twilio_phone_number:
            logger.warning("Twilio not configured, skipping SMS notification")
            return False
        
        try:
            # Format date and time
            date_str = appointment_date.strftime("%m/%d/%Y")
            time_str = appointment_date.strftime("%I:%M %p")
            
            # Create SMS message
            message_body = (
                f"{self.company_name}: Cita Cancelada\n\n"
                f"Hola {user_name},\n"
                f"Tu cita '{appointment_title}' del {date_str} a las {time_str} ha sido cancelada.\n\n"
                f"Si necesitas reagendar, contáctanos: {self.company_phone}\n"
                f"O visita nuestra app."
            )
            
            # Send SMS
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Cancellation SMS sent successfully to {to_phone}. SID: {message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send cancellation SMS to {to_phone}: {e}")
            return False

    
    async def send_appointment_notification(
        self,
        user_email: str,
        user_phone: Optional[str],
        user_name: str,
        appointment_date: datetime,
        appointment_type: str,
        description: Optional[str] = None
    ) -> dict:
        """
        Send both email and SMS notifications for appointment
        
        Returns:
            dict with status of each notification type
        """
        results = {
            'email_sent': False,
            'sms_sent': False
        }
        
        # Send email
        if user_email:
            results['email_sent'] = await self.send_appointment_confirmation_email(
                to_email=user_email,
                user_name=user_name,
                appointment_date=appointment_date,
                appointment_type=appointment_type,
                description=description
            )
        
        # Send SMS
        if user_phone:
            results['sms_sent'] = await self.send_appointment_confirmation_sms(
                to_phone=user_phone,
                user_name=user_name,
                appointment_date=appointment_date,
                appointment_type=appointment_type
            )
        
        return results


    # ====== LOAN NOTIFICATIONS ======
    
    async def send_loan_application_submitted_email(
        self,
        to_email: str,
        user_name: str,
        loan_amount: float,
        loan_term: int,
        application_id: str
    ) -> bool:
        """Send email notification when loan application is submitted"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping email notification")
            return False
        
        try:
            subject = f"Solicitud de Préstamo Recibida - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">{self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: #6C1110;">¡Solicitud Recibida!</h2>
                        
                        <p>Hola {user_name},</p>
                        
                        <p>Hemos recibido tu solicitud de préstamo. Nuestro equipo la está revisando y te contactaremos pronto.</p>
                        
                        <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #5DC1D9;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Detalles de tu Solicitud</h3>
                            <p style="margin: 5px 0;"><strong>ID de Solicitud:</strong> {application_id}</p>
                            <p style="margin: 5px 0;"><strong>Monto Solicitado:</strong> ${loan_amount:,.2f}</p>
                            <p style="margin: 5px 0;"><strong>Plazo:</strong> {loan_term} meses</p>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Próximos Pasos</h3>
                            <ol style="margin: 10px 0; padding-left: 20px;">
                                <li>Revisaremos tu información financiera</li>
                                <li>Evaluaremos tu capacidad de pago</li>
                                <li>Te contactaremos dentro de 24-48 horas</li>
                            </ol>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
                            <p style="margin: 0;"><strong>Importante:</strong> Ten a la mano documentos de identificación y comprobantes de ingresos por si los necesitamos.</p>
                        </div>
                        
                        <p style="margin-top: 30px;">Si tienes preguntas sobre tu solicitud, no dudes en contactarnos.</p>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Información de Contacto</h3>
                            <p style="margin: 5px 0;"><strong>Teléfono:</strong> {self.company_phone}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {self.company_email}</p>
                            <p style="margin: 5px 0;"><strong>Dirección:</strong> {self.company_address}</p>
                        </div>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666;">
                            Este es un correo automático, por favor no respondas a este mensaje.
                            Para consultas, contáctanos al {self.company_phone} o {self.company_email}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Loan application email sent to {to_email}. Status: {response.status_code}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send loan application email to {to_email}: {e}")
            return False

    async def send_loan_application_submitted_sms(
        self,
        to_phone: str,
        user_name: str,
        loan_amount: float,
        application_id: str
    ) -> bool:
        """Send SMS notification when loan application is submitted"""
        if not self.twilio_client:
            logger.warning("Twilio not configured, skipping SMS notification")
            return False
        
        try:
            message_body = (
                f"Hola {user_name}, tu solicitud de préstamo por ${loan_amount:,.0f} "
                f"(ID: {application_id[:8]}) ha sido recibida. Te contactaremos pronto. "
                f"- {self.company_name}"
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Loan application SMS sent to {to_phone}. SID: {message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send loan application SMS to {to_phone}: {e}")
            return False

    async def send_loan_approved_email(
        self,
        to_email: str,
        user_name: str,
        loan_amount: float,
        loan_term: int,
        monthly_payment: float,
        application_id: str
    ) -> bool:
        """Send email notification when loan is approved"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping email notification")
            return False
        
        try:
            subject = f"¡Préstamo Aprobado! - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">¡Felicidades!</h1>
                        <h2 style="margin: 10px 0 0 0;">Tu Préstamo Ha Sido Aprobado</h2>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <p>Hola {user_name},</p>
                        
                        <p style="font-size: 18px; color: #10B981; font-weight: bold;">¡Excelentes noticias! Tu solicitud de préstamo ha sido aprobada.</p>
                        
                        <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
                            <h3 style="color: #10B981; margin-top: 0;">Detalles de tu Préstamo</h3>
                            <p style="margin: 5px 0;"><strong>ID de Solicitud:</strong> {application_id}</p>
                            <p style="margin: 5px 0;"><strong>Monto Aprobado:</strong> <span style="font-size: 24px; color: #10B981;">${loan_amount:,.2f}</span></p>
                            <p style="margin: 5px 0;"><strong>Plazo:</strong> {loan_term} meses</p>
                            <p style="margin: 5px 0;"><strong>Pago Mensual:</strong> ${monthly_payment:,.2f}</p>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Próximos Pasos</h3>
                            <ol style="margin: 10px 0; padding-left: 20px;">
                                <li>Revisa los términos y condiciones</li>
                                <li>Firma los documentos del préstamo</li>
                                <li>Recibirás los fondos en tu cuenta</li>
                            </ol>
                            <p style="margin-top: 15px;"><strong>Nos contactaremos contigo pronto para completar el proceso.</strong></p>
                        </div>
                        
                        <div style="background-color: #d1fae5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #10B981;">
                            <p style="margin: 0;"><strong>Nota:</strong> Los fondos serán desembolsados una vez que se completen todos los documentos necesarios.</p>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Información de Contacto</h3>
                            <p style="margin: 5px 0;"><strong>Teléfono:</strong> {self.company_phone}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {self.company_email}</p>
                            <p style="margin: 5px 0;"><strong>Dirección:</strong> {self.company_address}</p>
                        </div>
                        
                        <p style="margin-top: 30px;">¡Gracias por confiar en nosotros!</p>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666;">
                            Este es un correo automático, por favor no respondas a este mensaje.
                            Para consultas, contáctanos al {self.company_phone} o {self.company_email}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Loan approved email sent to {to_email}. Status: {response.status_code}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send loan approved email to {to_email}: {e}")
            return False

    async def send_loan_approved_sms(
        self,
        to_phone: str,
        user_name: str,
        loan_amount: float,
        monthly_payment: float
    ) -> bool:
        """Send SMS notification when loan is approved"""
        if not self.twilio_client:
            logger.warning("Twilio not configured, skipping SMS notification")
            return False
        
        try:
            message_body = (
                f"¡Felicidades {user_name}! Tu préstamo por ${loan_amount:,.0f} ha sido APROBADO. "
                f"Pago mensual: ${monthly_payment:,.0f}. Te contactaremos pronto. "
                f"- {self.company_name}"
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Loan approved SMS sent to {to_phone}. SID: {message.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send loan approved SMS to {to_phone}: {e}")
            return False

    async def send_loan_rejected_email(
        self,
        to_email: str,
        user_name: str,
        application_id: str,
        rejection_reason: Optional[str] = None
    ) -> bool:
        """Send email notification when loan is rejected"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping email notification")
            return False
        
        try:
            subject = f"Actualización de Solicitud de Préstamo - {self.company_name}"
            
            reason_text = f"<p><strong>Razón:</strong> {rejection_reason}</p>" if rejection_reason else ""
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">{self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: #6C1110;">Actualización de tu Solicitud</h2>
                        
                        <p>Hola {user_name},</p>
                        
                        <p>Lamentablemente, después de revisar cuidadosamente tu solicitud de préstamo (ID: {application_id}), no podemos aprobarla en este momento.</p>
                        
                        {reason_text}
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">¿Qué puedes hacer?</h3>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Puedes volver a aplicar en el futuro cuando tu situación financiera mejore</li>
                                <li>Contáctanos para obtener más información sobre los requisitos</li>
                                <li>Considera mejorar tu historial crediticio antes de volver a solicitar</li>
                            </ul>
                        </div>
                        
                        <p style="margin-top: 30px;">Apreciamos tu interés en nuestros servicios y esperamos poder ayudarte en el futuro.</p>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Información de Contacto</h3>
                            <p style="margin: 5px 0;"><strong>Teléfono:</strong> {self.company_phone}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {self.company_email}</p>
                            <p style="margin: 5px 0;"><strong>Dirección:</strong> {self.company_address}</p>
                        </div>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666;">
                            Este es un correo automático, por favor no respondas a este mensaje.
                            Para consultas, contáctanos al {self.company_phone} o {self.company_email}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Loan rejected email sent to {to_email}. Status: {response.status_code}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send loan rejected email to {to_email}: {e}")
            return False

    async def send_loan_notifications(
        self,
        user_email: str,
        user_phone: str,
        user_name: str,
        notification_type: str,
        **kwargs
    ) -> dict:
        """
        Send loan notifications via email and SMS
        
        Args:
            user_email: User's email address
            user_phone: User's phone number
            user_name: User's name
            notification_type: Type of notification ('submitted', 'approved', 'rejected')
            **kwargs: Additional parameters specific to notification type
            
        Returns:
            dict with status of each notification type
        """
        results = {
            'email_sent': False,
            'sms_sent': False,
            'push_sent': False  # For future implementation
        }
        
        if notification_type == 'submitted':
            # Send submission notifications
            if user_email:
                results['email_sent'] = await self.send_loan_application_submitted_email(
                    to_email=user_email,
                    user_name=user_name,
                    loan_amount=kwargs.get('loan_amount'),
                    loan_term=kwargs.get('loan_term'),
                    application_id=kwargs.get('application_id')
                )
            
            if user_phone:
                results['sms_sent'] = await self.send_loan_application_submitted_sms(
                    to_phone=user_phone,
                    user_name=user_name,
                    loan_amount=kwargs.get('loan_amount'),
                    application_id=kwargs.get('application_id')
                )
        
        elif notification_type == 'approved':
            # Send approval notifications
            if user_email:
                results['email_sent'] = await self.send_loan_approved_email(
                    to_email=user_email,
                    user_name=user_name,
                    loan_amount=kwargs.get('loan_amount'),
                    loan_term=kwargs.get('loan_term'),
                    monthly_payment=kwargs.get('monthly_payment'),
                    application_id=kwargs.get('application_id')
                )
            
            if user_phone:
                results['sms_sent'] = await self.send_loan_approved_sms(
                    to_phone=user_phone,
                    user_name=user_name,
                    loan_amount=kwargs.get('loan_amount'),
                    monthly_payment=kwargs.get('monthly_payment')
                )
        
        elif notification_type == 'rejected':
            # Send rejection notifications
            if user_email:
                results['email_sent'] = await self.send_loan_rejected_email(
                    to_email=user_email,
                    user_name=user_name,
                    application_id=kwargs.get('application_id'),
                    rejection_reason=kwargs.get('rejection_reason')
                )
        
        return results

    
    # ====== MONEY REQUEST NOTIFICATIONS ======
    
    async def send_money_request_email(
        self,
        to_email: str,
        recipient_name: str,
        requester_name: str,
        amount: float,
        note: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> bool:
        """Send email notification when someone requests money"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping money request email")
            return False
        
        try:
            subject = f"💸 Nueva Solicitud de Dinero - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">💸 Solicitud de Dinero</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #6C1110; margin-top: 0;">Hola {recipient_name},</h2>
                        
                        <p style="font-size: 16px;">{requester_name} te ha enviado una solicitud de dinero.</p>
                        
                        <div style="background: linear-gradient(135deg, #5DC1D9 0%, #10B981 100%); color: white; padding: 25px; margin: 25px 0; border-radius: 12px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Monto Solicitado</p>
                            <p style="margin: 10px 0 0 0; font-size: 42px; font-weight: bold;">${amount:.2f}</p>
                        </div>
                        
                        {f'''
                        <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #5DC1D9; border-radius: 8px;">
                            <p style="margin: 0;"><strong>Mensaje:</strong></p>
                            <p style="margin: 10px 0 0 0; font-style: italic;">"{note}"</p>
                        </div>
                        ''' if note else ''}
                        
                        <div style="background-color: #FFF9E6; border: 2px solid #FFA500; padding: 20px; margin: 25px 0; border-radius: 8px;">
                            <p style="margin: 0; color: #8B6914;"><strong>⚡ Acción Requerida</strong></p>
                            <p style="margin: 10px 0 0 0; color: #8B6914;">Puedes aprobar o rechazar esta solicitud desde tu app Ross Tax.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #666; font-size: 14px;">Abre la app Ross Tax y ve a tu Wallet para gestionar esta solicitud</p>
                        </div>
                        
                        <div style="background-color: white; padding: 20px; margin-top: 30px; border-top: 2px solid #e0e0e0;">
                            <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                                {self.company_name}<br>
                                {self.company_phone} | {self.company_email}<br>
                                {self.company_address}
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Money request email sent to {to_email} (Status: {response.status_code})")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send money request email to {to_email}: {e}")
            return False
    
    async def send_money_request_sms(
        self,
        to_phone: str,
        recipient_name: str,
        requester_name: str,
        amount: float
    ) -> bool:
        """Send SMS notification when someone requests money"""
        if not self.twilio_client:
            logger.warning("Twilio not configured, skipping money request SMS")
            return False
        
        try:
            message_body = (
                f"💸 Ross Tax: {requester_name} te solicita ${amount:.2f}. "
                f"Abre tu app para aprobar o rechazar esta solicitud."
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Money request SMS sent to {to_phone} (SID: {message.sid})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send money request SMS to {to_phone}: {e}")
            return False
    
    async def send_money_request_approved_email(
        self,
        to_email: str,
        requester_name: str,
        sender_name: str,
        amount: float
    ) -> bool:
        """Send email notification when money request is approved"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping money request approved email")
            return False
        
        try:
            subject = f"✅ ¡Solicitud Aprobada! - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">✅ ¡Solicitud Aprobada!</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #10B981; margin-top: 0;">¡Excelentes noticias, {requester_name}!</h2>
                        
                        <p style="font-size: 16px;">{sender_name} ha aprobado tu solicitud de dinero.</p>
                        
                        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 25px; margin: 25px 0; border-radius: 12px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Créditos Recibidos</p>
                            <p style="margin: 10px 0 0 0; font-size: 42px; font-weight: bold;">${amount:.2f}</p>
                        </div>
                        
                        <div style="background-color: #E6F7F1; border: 2px solid #10B981; padding: 20px; margin: 25px 0; border-radius: 8px;">
                            <p style="margin: 0; color: #047857;"><strong>✨ Los créditos ya están en tu wallet</strong></p>
                            <p style="margin: 10px 0 0 0; color: #047857;">Puedes usarlos de inmediato para pagar servicios.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #666; font-size: 14px;">Abre la app Ross Tax para ver tu balance actualizado</p>
                        </div>
                        
                        <div style="background-color: white; padding: 20px; margin-top: 30px; border-top: 2px solid #e0e0e0;">
                            <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                                {self.company_name}<br>
                                {self.company_phone} | {self.company_email}<br>
                                {self.company_address}
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Money request approved email sent to {to_email} (Status: {response.status_code})")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send money request approved email to {to_email}: {e}")
            return False
    
    async def send_money_request_approved_sms(
        self,
        to_phone: str,
        requester_name: str,
        sender_name: str,
        amount: float
    ) -> bool:
        """Send SMS notification when money request is approved"""
        if not self.twilio_client:
            logger.warning("Twilio not configured, skipping money request approved SMS")
            return False
        
        try:
            message_body = (
                f"✅ Ross Tax: {sender_name} aprobó tu solicitud. "
                f"${amount:.2f} han sido agregados a tu wallet. ¡Disfrútalos!"
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Money request approved SMS sent to {to_phone} (SID: {message.sid})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send money request approved SMS to {to_phone}: {e}")
            return False


    # ======
    # DOCUMENT REQUEST NOTIFICATIONS
    # ======
    
    async def send_document_request_email(
        self,
        to_email: str,
        user_name: str,
        document_name: str,
        due_date: Optional[datetime] = None,
        priority: str = "normal"
    ) -> bool:
        """Send email notification when a document is requested"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping document request email")
            return False
        
        try:
            priority_badge = ""
            priority_color = "#5DC1D9"
            if priority == "urgent":
                priority_badge = '<span style="background-color: #EF4444; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold;">URGENTE</span>'
                priority_color = "#EF4444"
            elif priority == "high":
                priority_badge = '<span style="background-color: #F59E0B; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold;">ALTA PRIORIDAD</span>'
                priority_color = "#F59E0B"
            
            due_date_text = ""
            if due_date:
                due_date_str = format_date_spanish_short(due_date)
                due_date_text = f"""
                <div style="background-color: #FEF3C7; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #F59E0B;">
                    <p style="margin: 0;"><strong>⏰ Fecha límite:</strong> {due_date_str}</p>
                </div>
                """
            
            subject = f"📄 Documento Solicitado - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">📄 {self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: {priority_color};">Documento Solicitado</h2>
                        {priority_badge}
                        
                        <p>Hola {user_name},</p>
                        
                        <p>Necesitamos que subas el siguiente documento para continuar con tu trámite:</p>
                        
                        <div style="background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid {priority_color};">
                            <p style="margin: 5px 0; font-size: 18px;"><strong>📋 {document_name}</strong></p>
                        </div>
                        
                        {due_date_text}
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Cómo subir el documento</h3>
                            <ol style="margin: 10px 0; padding-left: 20px;">
                                <li>Abre la app Ross Tax Preparation</li>
                                <li>Ve a la sección "Documentos"</li>
                                <li>Toca "Subir Documento"</li>
                                <li>Selecciona o toma foto del documento</li>
                                <li>Confirma y envía</li>
                            </ol>
                        </div>
                        
                        <div style="background-color: #d1fae5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #10B981;">
                            <p style="margin: 0;"><strong>💡 Consejo:</strong> Asegúrate de que el documento esté completo y legible antes de subirlo.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                                📤 Subir Documento Ahora
                            </a>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">¿Necesitas Ayuda?</h3>
                            <p style="margin: 5px 0;"><strong>Teléfono:</strong> {self.company_phone}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> {self.company_email}</p>
                        </div>
                        
                        <p style="margin-top: 30px;">¡Gracias por tu cooperación!</p>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666; font-size: 12px;">
                            Este es un correo automático. Para consultas, contáctanos al {self.company_phone}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Document request email sent to {to_email} (Status: {response.status_code})")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send document request email to {to_email}: {e}")
            return False
    
    async def send_document_request_sms(
        self,
        to_phone: str,
        user_name: str,
        document_name: str
    ) -> bool:
        """Send SMS notification when a document is requested"""
        if not self.twilio_client:
            logger.warning("Twilio not configured, skipping document request SMS")
            return False
        
        try:
            message_body = (
                f"📄 Ross Tax: Hola {user_name}, necesitamos que subas: {document_name}. "
                f"Entra a la app > Documentos > Subir. ¡Gracias!"
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone_number,
                to=to_phone
            )
            
            logger.info(f"Document request SMS sent to {to_phone} (SID: {message.sid})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send document request SMS to {to_phone}: {e}")
            return False
    
    # ======
    # CREDIT NOTIFICATIONS
    # ======
    
    async def send_credit_low_balance_email(
        self,
        to_email: str,
        user_name: str,
        current_balance: int,
        threshold: int = 50
    ) -> bool:
        """Send email when credit balance is low"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping low balance email")
            return False
        
        try:
            subject = f"⚠️ Saldo Bajo de Créditos - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">💳 {self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: #F59E0B;">⚠️ Saldo Bajo de Créditos</h2>
                        
                        <p>Hola {user_name},</p>
                        
                        <p>Tu saldo de créditos está bajo:</p>
                        
                        <div style="background-color: #FEF3C7; padding: 20px; margin: 20px 0; border-left: 4px solid #F59E0B; text-align: center;">
                            <p style="margin: 0; font-size: 14px; color: #92400E;">Saldo Actual</p>
                            <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #F59E0B;">{current_balance} créditos</p>
                            <p style="margin: 0; font-size: 12px; color: #92400E;">Recomendamos mantener al menos {threshold} créditos</p>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">¿Por qué necesito créditos?</h3>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Consultar con el Asistente AI Ross</li>
                                <li>Generar informes personalizados</li>
                                <li>Acceder a funciones premium</li>
                                <li>Obtener análisis detallados</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                                💰 Comprar Créditos
                            </a>
                        </div>
                        
                        <div style="background-color: #d1fae5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #10B981;">
                            <p style="margin: 0;"><strong>💡 Consejo:</strong> Compra paquetes más grandes para obtener mejor valor por tu dinero.</p>
                        </div>
                        
                        <p style="margin-top: 30px;">¡Gracias por usar nuestros servicios!</p>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666; font-size: 12px;">
                            Este es un correo automático. Para consultas, contáctanos al {self.company_phone}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Low balance email sent to {to_email} (Status: {response.status_code})")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send low balance email to {to_email}: {e}")
            return False
    
    # ======
    # REFERRAL PROGRAM NOTIFICATIONS
    # ======
    
    async def send_referral_reward_email(
        self,
        to_email: str,
        user_name: str,
        referred_name: str,
        reward_amount: int
    ) -> bool:
        """Send email when user earns referral reward"""
        if not self.sendgrid_client:
            logger.warning("SendGrid not configured, skipping referral reward email")
            return False
        
        try:
            subject = f"🎉 ¡Ganaste Créditos por Referir! - {self.company_name}"
            
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #6C1110; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">🎉 {self.company_name}</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; margin-top: 20px;">
                        <h2 style="color: #10B981;">🎉 ¡Felicidades! Ganaste Créditos</h2>
                        
                        <p>Hola {user_name},</p>
                        
                        <p>¡Excelente noticia! {referred_name} se registró usando tu código de referido.</p>
                        
                        <div style="background-color: #d1fae5; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981; text-align: center;">
                            <p style="margin: 0; font-size: 14px; color: #065F46;">Créditos Ganados</p>
                            <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #10B981;">+{reward_amount} créditos</p>
                            <p style="margin: 0; font-size: 12px; color: #065F46;">Ya están disponibles en tu wallet</p>
                        </div>
                        
                        <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                            <h3 style="color: #5DC1D9; margin-top: 0;">Sigue Ganando Más</h3>
                            <p>Cada vez que alguien use tu código de referido, ¡ganas créditos!</p>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Comparte tu código con amigos y familiares</li>
                                <li>Ellos obtienen beneficios al registrarse</li>
                                <li>Tú ganas créditos por cada referido exitoso</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                            <a href="https://app-nueva-production.up.railway.app" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">

                                🎁 Ver Mi Código de Referido
                            </a>
                        </div>
                        
                        <div style="background-color: #FEF3C7; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #F59E0B;">
                            <p style="margin: 0;"><strong>💡 Consejo:</strong> Cuantos más amigos invites, ¡más créditos gratis obtienes!</p>
                        </div>
                        
                        <p style="margin-top: 30px;">¡Gracias por recomendar nuestros servicios!</p>
                        
                        <p style="margin-top: 30px; font-style: italic; color: #666; font-size: 12px;">
                            Este es un correo automático. Para consultas, contáctanos al {self.company_phone}
                        </p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>{self.company_name} - {self.company_address}</p>
                        <p>© {datetime.now().year} Todos los derechos reservados</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.sendgrid_from_email, self.sendgrid_from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"Referral reward email sent to {to_email} (Status: {response.status_code})")
            return response.status_code in [200, 201, 202]
            
        except Exception as e:
            logger.error(f"Failed to send referral reward email to {to_email}: {e}")
            return False
    
    async def send_referral_reward_push(
        self,
        user_id: str,
        referred_name: str,
        reward_amount: int
    ) -> bool:
        """Send push notification for referral reward"""
        try:
            from push_notification_service import send_push_notification
            
            return await send_push_notification(
                user_id=user_id,
                title="🎉 ¡Ganaste Créditos!",
                body=f"{referred_name} usó tu código. +{reward_amount} créditos agregados.",
                data={
                    "type": "referral_reward",
                    "reward_amount": reward_amount,
                    "referred_name": referred_name
                }
            )
        except Exception as e:
            logger.error(f"Failed to send referral reward push notification: {e}")
            return False

