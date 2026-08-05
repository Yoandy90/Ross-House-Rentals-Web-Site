"""
Notification Service V2 - SMS y Email para invitaciones
"""
import os
import logging
from twilio.rest import Client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class NotificationServiceV2:
    def __init__(self):
        # Twilio setup
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.twilio_phone = os.getenv('TWILIO_PHONE_NUMBER', '+18065914974')
        
        try:
            self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
            logger.info("✅ Twilio client initialized")
        except Exception as e:
            logger.error(f"❌ Twilio initialization failed: {e}")
            self.twilio_client = None
        
        # SendGrid setup
        self.sendgrid_api_key = os.getenv('SENDGRID_API_KEY')
        self.sendgrid_client = SendGridAPIClient(self.sendgrid_api_key) if self.sendgrid_api_key else None
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@rosstax.com')
        
        if self.sendgrid_client:
            logger.info("✅ SendGrid client initialized")
        else:
            logger.warning("⚠️ SendGrid API key not found")
        
        # App download links
        self.app_store_link = os.getenv('APP_STORE_LINK', 'https://apps.apple.com/app/rosstax')
        self.play_store_link = os.getenv('PLAY_STORE_LINK', 'https://play.google.com/store/apps/details?id=com.rosstax')
        self.expo_go_link = os.getenv('EXPO_GO_LINK', 'exp://rossbrain-app.ngrok.io')
        
        # Leer logo base64 desde archivo
        logo_base64_path = os.path.join(os.path.dirname(__file__), 'assets', 'logo_base64.txt')
        try:
            with open(logo_base64_path, 'r') as f:
                self.logo_base64 = f.read().strip()
            logger.info("✅ Logo base64 cargado correctamente")
        except Exception as e:
            logger.error(f"❌ Error cargando logo base64: {e}")
            # Fallback a logo en blanco si falla la carga
            self.logo_base64 = ""
    
    def _get_email_header(self, title: str, subtitle: str = "") -> str:
        """Genera header limpio y profesional para emails - Compatible con todos los clientes"""
        return f"""
        <div style="background: linear-gradient(135deg, #8B1513 0%, #A52A2A 50%, #8B1513 100%); padding: 50px 30px; text-align: center; border-radius: 12px 12px 0 0; -webkit-border-radius: 12px 12px 0 0; mso-border-radius: 12px 12px 0 0;">
            <!-- Logo/Marca como texto elegante -->
            <div style="margin-bottom: 25px;">
                <h2 style="color: #FFFFFF !important; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ⭐ ROSS TAX ⭐
                </h2>
                <p style="color: #FFFFFF !important; margin: 5px 0 0 0; font-size: 14px; letter-spacing: 2px; opacity: 0.9;">
                    PREPARATION
                </p>
            </div>
            
            <!-- Línea separadora elegante -->
            <div style="width: 100px; height: 2px; background: rgba(255,255,255,0.5); margin: 25px auto; border-radius: 1px;"></div>
            
            <!-- Título Principal -->
            <h1 style="color: #FFFFFF !important; margin: 20px 0 8px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.3;">{title}</h1>
            
            {f'<p style="color: #FFFFFF !important; margin: 8px 0 0 0; font-size: 16px; font-weight: 400; opacity: 0.95;">{subtitle}</p>' if subtitle else ''}
        </div>
        """
    
    def _get_email_footer(self) -> str:
        """Genera footer moderno y profesional para todos los emails"""
        return """
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 35px 20px; text-align: center; border-radius: 0 0 12px 12px; margin-top: 0;">
            <!-- Logo/Nombre de la empresa -->
            <div style="margin-bottom: 20px;">
                <span style="font-size: 24px; font-weight: 900; color: #FFFFFF !important; letter-spacing: 1px; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">ROSS TAX PREPARATION</span>
            </div>
            
            <!-- Información de contacto con iconos -->
            <table width="100%" cellpadding="8" cellspacing="0" style="margin: 20px 0; border-top: 2px solid rgba(255,255,255,0.4); border-bottom: 2px solid rgba(255,255,255,0.4);">
                <tr>
                    <td style="color: #FFFFFF; font-size: 16px; text-align: center; padding: 12px 0;">
                        📍 <strong style="color: #FFFFFF;">Dumas, TX 79029</strong>
                    </td>
                </tr>
                <tr>
                    <td style="color: #FFFFFF; font-size: 16px; text-align: center; padding: 12px 0;">
                        📧 <a href="mailto:info@rosstaxpreparation.com" style="color: #5DADE2; text-decoration: none;"><strong>info@rosstaxpreparation.com</strong></a>
                    </td>
                </tr>
                <tr>
                    <td style="color: #FFFFFF; font-size: 16px; text-align: center; padding: 12px 0;">
                        📱 <a href="tel:+18069307456" style="color: #5DADE2; text-decoration: none;"><strong>+1 (806) 930-7456</strong></a>
                    </td>
                </tr>
            </table>
            
            <!-- Mensaje profesional -->
            <p style="color: #FFFFFF !important; font-size: 15px !important; margin: 20px 0; font-style: italic; font-weight: 500 !important;">
                Tu socio de confianza en servicios fiscales 🤝
            </p>
            
            <!-- Copyright -->
            <p style="color: #FFFFFF !important; font-size: 14px !important; margin: 18px 0 0 0; font-weight: 500 !important;">
                © 2026 Ross Tax Preparation. Todos los derechos reservados.
            </p>
            
            <!-- Links sociales o adicionales (opcional) -->
            <div style="margin-top: 18px;">
                <span style="color: #FFFFFF !important; font-size: 13px !important; font-weight: 400 !important;">
                    Este email fue enviado porque tienes una cita programada con nosotros.
                </span>
            </div>
        </div>
        """
    
    async def send_invitation_sms(
        self,
        to_phone: str,
        attendee_name: str,
        invited_by: str,
        appointment_date: str,
        appointment_time: str,
        invitation_link: str
    ) -> dict:
        """Envía SMS de invitación"""
        if not self.twilio_client:
            logger.error("Twilio client not initialized")
            return {'success': False, 'error': 'SMS service not available'}
        
        try:
            message_body = (
                f"¡Hola {attendee_name}! {invited_by} te ha agendado una cita en Ross Tax "
                f"para el {appointment_date} a las {appointment_time}.\n\n"
                f"Completa tus datos y sube documentos aquí:\n{invitation_link}\n\n"
                f"⏰ Link válido por 7 días"
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone,
                to=to_phone
            )
            
            logger.info(f"✅ SMS sent to {to_phone}: {message.sid}")
            
            return {
                'success': True,
                'message_sid': message.sid,
                'status': message.status,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to send SMS to {to_phone}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_invitation_email(
        self,
        to_email: str,
        attendee_name: str,
        invited_by: str,
        appointment_date: str,
        appointment_time: str,
        appointment_type: str,
        invitation_link: str,
        expires_date: str,
        user_id: str = None
    ) -> dict:
        """Envía email de invitación con tracking"""
        if not self.sendgrid_client:
            logger.error("SendGrid client not initialized")
            return {'success': False, 'error': 'Email service not available'}
        
        try:
            # Crear tracking ID
            tracking_id = None
            if user_id:
                try:
                    from ai_automation_service import ai_automation_service
                    if ai_automation_service:
                        tracking_id = await ai_automation_service.track_email_sent(
                            email=to_email,
                            user_id=user_id,
                            email_type="invitation",
                            subject="Tu cita en Ross Tax Preparation - Acción requerida",
                            content_preview=f"Cita con {invited_by} el {appointment_date}",
                            metadata={
                                "appointment_date": appointment_date,
                                "appointment_time": appointment_time,
                                "appointment_type": appointment_type
                            }
                        )
                except Exception as e:
                    logger.warning(f"Could not create tracking: {e}")
            
            subject = "Tu cita en Ross Tax Preparation - Acción requerida"
            
            # Obtener dominio para tracking
            backend_url = os.getenv('BACKEND_URL', 'https://app.emergent.sh')
            tracking_pixel = f'<img src="{backend_url}/api/track/email/{tracking_id}" width="1" height="1" style="display:none;" alt="" />' if tracking_id else ''
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2c3e50; margin: 0; padding: 0; background: #f0f2f5; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 20px rgba(0,0,0,0.1); }}
                    .content {{ background: #ffffff; padding: 40px 30px; }}
                    .greeting {{ font-size: 24px; font-weight: 600; color: #2c3e50; margin-bottom: 15px; }}
                    .intro-text {{ font-size: 16px; color: #555; margin-bottom: 25px; line-height: 1.8; }}
                    .appointment-card {{ background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); padding: 25px; border-radius: 15px; margin: 25px 0; border: 2px solid #8B1513; box-shadow: 0 4px 12px rgba(139,21,19,0.1); }}
                    .info-row {{ display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e9ecef; }}
                    .info-row:last-child {{ border-bottom: none; }}
                    .info-icon {{ font-size: 24px; margin-right: 15px; width: 30px; }}
                    .info-label {{ font-weight: 700; color: #1a1a1a; margin-right: 8px; font-size: 15px; }}
                    .info-value {{ color: #1a1a1a; font-weight: 500; font-size: 15px; }}
                    .action-section {{ background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; }}
                    .action-title {{ font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; }}
                    .checklist {{ text-align: left; display: inline-block; margin: 15px 0; }}
                    .checklist-item {{ padding: 8px 0; font-size: 15px; color: #1a1a1a; font-weight: 500; }}
                    .checklist-item::before {{ content: "✓"; color: #28a745; font-weight: bold; margin-right: 10px; font-size: 18px; }}
                    .cta-button {{ display: inline-block; background: linear-gradient(135deg, #8B1513 0%, #A52A2A 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(139,21,19,0.3); transition: all 0.3s; }}
                    .warning-box {{ background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%); border-left: 4px solid #ffc107; padding: 18px 20px; border-radius: 10px; margin-top: 25px; }}
                    .warning-icon {{ font-size: 20px; margin-right: 8px; }}
                    .warning-text {{ color: #856404; font-size: 14px; margin: 0; font-weight: 500; }}
                    .footer-note {{ color: #999; font-size: 13px; margin-top: 25px; text-align: center; font-style: italic; }}
                </style>
            </head>
            <body>
                <div class="container">
                    {self._get_email_header("Tu Cita en Ross Tax", "Acción Requerida")}
                    <div class="content">
                        <div class="greeting">¡Hola {attendee_name}! 👋</div>
                        <p class="intro-text">
                            <strong>{invited_by}</strong> ha reservado una cita para ti en Ross Tax Preparation. 
                            Estamos listos para ayudarte con tus impuestos de manera profesional y eficiente.
                        </p>
                        
                        <div class="appointment-card">
                            <div style="font-weight: 700; color: #1a1a1a; font-size: 18px; margin-bottom: 15px; text-align: center; background: #8B1513; color: white; padding: 12px; border-radius: 10px; margin: -25px -25px 15px -25px;">
                                📋 Detalles de tu Cita
                            </div>
                            <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                <tr>
                                    <td style="padding: 15px; border-bottom: 2px solid #e9ecef; font-size: 16px; color: #000000;">
                                        <strong style="font-size: 20px;">📅</strong>&nbsp;&nbsp;
                                        <strong style="color: #000000;">Fecha:</strong>&nbsp;
                                        <strong style="color: #000000;">{appointment_date}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 2px solid #e9ecef; font-size: 16px; color: #000000;">
                                        <strong style="font-size: 20px;">🕐</strong>&nbsp;&nbsp;
                                        <strong style="color: #000000;">Hora:</strong>&nbsp;
                                        <strong style="color: #000000;">{appointment_time}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; font-size: 16px; color: #000000;">
                                        <strong style="font-size: 20px;">{'💻' if appointment_type == 'video_call' else '📍'}</strong>&nbsp;&nbsp;
                                        <strong style="color: #000000;">Modalidad:</strong>&nbsp;
                                        <strong style="color: #000000;">{'Videollamada Virtual' if appointment_type == 'video_call' else 'Presencial en Oficina'}</strong>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        
                        <div class="action-section">
                            <div class="action-title">🎯 Prepara tu Cita en 2 Pasos</div>
                            <div class="checklist">
                                <div class="checklist-item">Completa tu información personal</div>
                                <div class="checklist-item">Sube tus documentos fiscales</div>
                            </div>
                            <a href="{invitation_link}" class="cta-button">
                                🚀 Completar Ahora
                            </a>
                            <p style="font-size: 13px; color: #666; margin-top: 12px;">
                                Solo te tomará 5 minutos
                            </p>
                        </div>
                        
                        <div class="warning-box">
                            <p class="warning-text">
                                <span class="warning-icon">⏰</span>
                                <strong>Importante:</strong> Este enlace es válido hasta el <strong>{expires_date}</strong>
                            </p>
                        </div>
                        
                        <p class="footer-note">
                            Si no solicitaste esta cita, puedes ignorar este mensaje de forma segura.
                        </p>
                    </div>
                    {self._get_email_footer()}
                </div>
                {tracking_pixel}
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.from_email, "Ross Tax Preparation"),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            
            logger.info(f"✅ Email sent to {to_email}: {response.status_code}")
            
            return {
                'success': True,
                'status_code': response.status_code,
                'sent_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_welcome_credentials_sms(
        self,
        to_phone: str,
        name: str,
        email: str,
        temp_password: str
    ) -> dict:
        """Envía SMS con credenciales de acceso"""
        if not self.twilio_client:
            return {'success': False, 'error': 'SMS service not available'}
        
        try:
            message_body = (
                f"¡Bienvenid@ {name}! Tu cuenta en Ross Tax ha sido creada.\n\n"
                f"📱 Descarga la app en Expo Go: {self.expo_go_link}\n\n"
                f"👤 Usuario: {email}\n"
                f"🔑 Contraseña: {temp_password}\n\n"
                f"Por tu seguridad, cámbiala en tu primer login."
            )
            
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=self.twilio_phone,
                to=to_phone
            )
            
            logger.info(f"✅ Welcome SMS sent to {to_phone}")
            return {'success': True, 'message_sid': message.sid}
            
        except Exception as e:
            logger.error(f"❌ Failed to send welcome SMS: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_welcome_credentials_email(
        self,
        to_email: str,
        name: str,
        temp_password: str
    ) -> dict:
        """Envía email con credenciales de acceso"""
        if not self.sendgrid_client:
            return {'success': False, 'error': 'Email service not available'}
        
        try:
            subject = "¡Bienvenido a Ross Tax! - Tus credenciales de acceso"
            
            # Tracking pixel (empty for welcome emails)
            tracking_pixel = ''
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2c3e50; margin: 0; padding: 0; background: #f0f2f5; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 20px rgba(0,0,0,0.1); }}
                    .content {{ background: #ffffff; padding: 40px 30px; }}
                    .greeting {{ font-size: 24px; font-weight: 600; color: #2c3e50; margin-bottom: 15px; }}
                    .intro-text {{ font-size: 16px; color: #555; margin-bottom: 25px; line-height: 1.8; }}
                    .credentials-card {{ background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); padding: 25px; border-radius: 15px; margin: 25px 0; border: 2px solid #8B1513; box-shadow: 0 4px 12px rgba(139,21,19,0.1); }}
                    .credential-item {{ padding: 12px 0; border-bottom: 1px solid #e9ecef; }}
                    .credential-item:last-child {{ border-bottom: none; }}
                    .credential-label {{ font-weight: 700; color: #1a1a1a; display: inline-block; width: 140px; font-size: 15px; }}
                    .credential-value {{ color: #1a1a1a; background: #f8f9fa; padding: 8px 12px; border-radius: 8px; font-family: monospace; display: inline-block; font-weight: 600; }}
                    .warning-box {{ background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%); border-left: 4px solid #ffc107; padding: 18px 20px; border-radius: 10px; margin: 20px 0; }}
                    .warning-text {{ color: #856404; font-size: 14px; margin: 0; font-weight: 500; }}
                    .cta-button {{ display: inline-block; background: linear-gradient(135deg, #8B1513 0%, #A52A2A 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(139,21,19,0.3); }}
                    .features-section {{ background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 30px 0; }}
                    .features-title {{ font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; text-align: center; }}
                    .feature-item {{ padding: 12px 15px; margin: 8px 0; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); color: #1a1a1a; font-weight: 500; }}
                    .feature-item::before {{ content: "✓"; color: #28a745; font-weight: bold; margin-right: 10px; font-size: 18px; }}
                    .app-note {{ text-align: center; color: #666; font-size: 13px; margin-top: 12px; font-style: italic; }}
                </style>
            </head>
            <body>
                <div class="container">
                    {self._get_email_header("¡Bienvenido!", "Tu cuenta ha sido creada exitosamente")}
                    <div class="content">
                        <div class="greeting">¡Hola {name}! 👋</div>
                        <p class="intro-text">
                            Tu cuenta en <strong>Ross Tax Preparation</strong> ha sido creada exitosamente. 
                            Ya puedes acceder a todos nuestros servicios profesionales 24/7.
                        </p>
                        
                        <div class="credentials-card">
                            <div style="font-weight: 700; color: white; font-size: 18px; margin-bottom: 15px; text-align: center; background: #8B1513; padding: 12px; border-radius: 10px; margin: -25px -25px 15px -25px;">
                                🔐 Tus Credenciales de Acceso
                            </div>
                            <div class="credential-item">
                                <span class="credential-label">👤 Usuario:</span>
                                <span class="credential-value">{to_email}</span>
                            </div>
                            <div class="credential-item">
                                <span class="credential-label">🔑 Contraseña:</span>
                                <span class="credential-value">{temp_password}</span>
                            </div>
                        </div>
                        
                        <div class="warning-box">
                            <p class="warning-text">
                                <span style="font-size: 20px; margin-right: 8px;">⚠️</span>
                                <strong>Importante:</strong> Por tu seguridad, cambia tu contraseña en tu primer inicio de sesión.
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 15px;">
                                📱 Accede a la App
                            </div>
                            <a href="{self.expo_go_link}" class="cta-button">
                                🚀 Abrir en Expo Go
                            </a>
                            <p class="app-note">
                                La app está en desarrollo. Usa Expo Go para acceder temporalmente.
                            </p>
                        </div>
                        
                        <div class="features-section">
                            <div class="features-title">✨ Funciones Disponibles</div>
                            <div class="feature-item">Ver y gestionar tus citas programadas</div>
                            <div class="feature-item">Subir documentos fiscales en cualquier momento</div>
                            <div class="feature-item">Chatear con Ross Brain (Asistente AI)</div>
                            <div class="feature-item">Acceder a tus declaraciones de impuestos</div>
                            <div class="feature-item">Programar videollamadas con expertos</div>
                        </div>
                        
                        <p style="text-align: center; color: #999; font-size: 13px; margin-top: 25px; font-style: italic;">
                            Si tienes alguna pregunta, no dudes en contactarnos.
                        </p>
                    </div>
                    {self._get_email_footer()}
                </div>
                {tracking_pixel}
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.from_email, "Ross Tax Preparation"),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.sendgrid_client.send(message)
            logger.info(f"✅ Welcome email sent to {to_email}")
            
            return {'success': True, 'status_code': response.status_code}
            
        except Exception as e:
            logger.error(f"❌ Failed to send welcome email: {e}")
            return {'success': False, 'error': str(e)}

# Singleton instance
notification_service_v2 = NotificationServiceV2()
