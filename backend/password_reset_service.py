"""
Password Reset Service
Handles password reset logic including code generation, validation and email/SMS sending
Uses the platform's own NotificationService (DB-based config) instead of direct SendGrid/Twilio.
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
import re

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PasswordResetService:
    """Service to handle password reset operations using platform notification service"""
    
    def __init__(self, db: AsyncIOMotorClient, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        
        if self.notification_service:
            logger.info("✅ Password Reset Service - Using platform NotificationService (email + SMS)")
        else:
            logger.warning("⚠️ Password Reset Service - No notification service provided, email/SMS will be disabled")
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to E.164 format"""
        digits = re.sub(r'\D', '', phone)
        if len(digits) == 10:
            return f"+1{digits}"
        elif len(digits) == 11 and digits.startswith('1'):
            return f"+{digits}"
        elif len(digits) > 10:
            return f"+{digits}"
        return f"+1{digits}"
    
    def _ensure_timezone_aware(self, dt: datetime) -> datetime:
        """Ensure datetime is timezone aware"""
        if isinstance(dt, datetime) and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    
    def generate_reset_code(self) -> str:
        """Generate a 6-digit reset code"""
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    async def initiate_password_reset(self, email: Optional[str] = None, phone_number: Optional[str] = None) -> Dict[str, Any]:
        """
        Initiate password reset process
        - Verify user exists (by email or phone)
        - Generate reset code
        - Store code in database
        - Send email or SMS with code
        """
        try:
            user = None
            method = 'email'
            contact = email
            
            # Find user by email or phone
            if email:
                user = await self.db.users.find_one({'email': email.lower().strip()})
                method = 'email'
                contact = email.lower().strip()
            elif phone_number:
                # Normalize phone and search
                normalized_phone = self._normalize_phone(phone_number)
                # Try different phone formats
                user = await self.db.users.find_one({
                    '$or': [
                        {'phone': normalized_phone},
                        {'phone': phone_number},
                        {'phone': re.sub(r'\D', '', phone_number)},
                        {'phone': {'$regex': re.sub(r'\D', '', phone_number)[-10:] + '$'}}
                    ]
                })
                method = 'sms'
                contact = normalized_phone
            
            if not user:
                # For security, don't reveal if user exists
                logger.info(f"Password reset attempted for non-existent {'email' if email else 'phone'}: {contact}")
                return {
                    'success': True,
                    'message': 'Si la cuenta existe, recibirás un código de verificación',
                    'code_sent': False,
                    'method': method
                }
            
            # Get phone from user if available for SMS
            user_phone = user.get('phone')
            user_email = user.get('email')
            
            # Generate reset code
            reset_code = self.generate_reset_code()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
            
            # Store reset request in database
            reset_request = {
                'user_id': str(user['_id']),
                'email': user_email,
                'phone': user_phone,
                'code': reset_code,
                'method': method,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc),
                'verified': False,
                'used': False
            }
            
            await self.db.password_resets.insert_one(reset_request)
            logger.info(f"✅ Password reset code generated for user: {user['_id']}")
            
            # Send code based on method
            code_sent = False
            if method == 'sms' and user_phone:
                code_sent = await self.send_reset_sms(user_phone, user.get('name', 'Usuario'), reset_code)
            else:
                code_sent = await self.send_reset_email(user_email, user.get('name', 'Usuario'), reset_code)
            
            return {
                'success': True,
                'message': f'Si la cuenta existe, recibirás un código de verificación por {"SMS" if method == "sms" else "email"}',
                'code_sent': code_sent,
                'method': method
            }
            
        except Exception as e:
            logger.error(f"❌ Error initiating password reset: {e}")
            raise
    
    async def send_reset_sms(self, phone: str, name: str, code: str) -> bool:
        """Send password reset SMS with code using platform notification service"""
        if not self.notification_service:
            logger.warning("⚠️ NotificationService not available, cannot send SMS")
            print(f"📱 PASSWORD RESET CODE FOR {phone}: {code}")
            return False
        
        try:
            normalized_phone = self._normalize_phone(phone)
            message_body = (
                f"🔐 Ross Lending Solutions - Código de Recuperación\n\n"
                f"Hola {name},\n\n"
                f"Tu código de verificación es: {code}\n\n"
                f"⏰ Este código expira en 15 minutos.\n\n"
                f"Si no solicitaste este código, ignora este mensaje.\n\n"
                f"- Ross Lending Solutions"
            )

            sent = await self.notification_service.send_sms(normalized_phone, message_body)
            
            if sent:
                logger.info(f"✅ Password reset SMS sent to: {phone}")
                return True
            else:
                logger.warning(f"⚠️ SMS sending returned False for: {phone}")
                print(f"📱 PASSWORD RESET CODE FOR {phone}: {code}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Error sending reset SMS: {e}")
            print(f"📱 PASSWORD RESET CODE FOR {phone}: {code}")
            return False
    
    async def send_reset_email(self, email: str, name: str, code: str) -> bool:
        """Send password reset email with code using platform notification service"""
        if not self.notification_service:
            logger.warning("⚠️ NotificationService not available, cannot send email")
            print(f"📧 PASSWORD RESET CODE FOR {email}: {code}")
            return False
        
        try:
            subject = "Código de Recuperación de Contraseña - Ross Lending"
            
            # HTML email content
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="color-scheme" content="light dark">
                <meta name="supported-color-schemes" content="light dark">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f8;">
                <div style="max-width: 600px; margin: 0 auto;">
                    <!-- Header - Blue with white text -->
                    <div style="background-color: #0d47a1; padding: 45px 20px; text-align: center;">
                        <h1 style="color: #ffffff !important; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;"><span style="color: #ffffff !important;">Ross Lending Solutions</span></h1>
                        <p style="color: #bbdefb !important; margin: 10px 0 0 0; font-size: 16px;"><span style="color: #bbdefb !important;">Recuperación de Contraseña</span></p>
                    </div>
                    
                    <!-- Content - White bg -->
                    <div style="background-color: #ffffff; padding: 40px 25px;">
                        <h2 style="color: #1a202c; font-size: 22px; margin: 0 0 16px 0; font-weight: 700;"><span style="color: #1a202c;">Hola {name},</span></h2>
                        
                        <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;"><span style="color: #4a5568;">Recibimos una solicitud para recuperar tu contraseña. Usa el siguiente código de verificación en la aplicación:</span></p>
                        
                        <!-- Code Box - Blue bg white text for max contrast -->
                        <div style="background-color: #0d47a1; border-radius: 12px; padding: 30px; text-align: center; margin: 25px 0;">
                            <div style="font-size: 12px; color: #bbdefb !important; margin-bottom: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;"><span style="color: #bbdefb !important;">Tu Código de Verificación</span></div>
                            <div style="font-size: 44px; font-weight: 800; color: #ffffff !important; letter-spacing: 10px; font-family: 'Courier New', monospace;"><span style="color: #ffffff !important;">{code}</span></div>
                        </div>
                        
                        <!-- Warning -->
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5; font-weight: 600;"><span style="color: #92400e;">⏰ Este código expira en 15 minutos</span></p>
                        </div>
                        
                        <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;"><span style="color: #718096;">Si no solicitaste este código, puedes ignorar este correo de forma segura. Tu contraseña no será modificada.</span></p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f7fafc; padding: 25px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color: #a0aec0; font-size: 12px; margin: 0 0 8px 0;"><span style="color: #a0aec0;">Ross Lending Solutions — Servicios Financieros Profesionales</span></p>
                        <p style="color: #cbd5e0; font-size: 11px; margin: 0;"><span style="color: #cbd5e0;">Este es un correo automático, por favor no respondas a este mensaje.</span></p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            sent = await self.notification_service.send_email(
                to_email=email,
                subject=subject,
                html_content=html_content
            )
            
            if sent:
                logger.info(f"✅ Password reset email sent to: {email}")
                return True
            else:
                logger.warning(f"⚠️ Email sending returned False for: {email}")
                print(f"📧 PASSWORD RESET CODE FOR {email}: {code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error sending reset email: {e}")
            print(f"📧 PASSWORD RESET CODE FOR {email}: {code}")
            return False
    
    async def verify_reset_code(self, identifier: str, code: str) -> Dict[str, Any]:
        """
        Verify reset code
        - Check if code exists and is valid (by email or phone)
        - Check if code has expired
        - Mark code as verified
        """
        try:
            # Determine if identifier is email or phone
            is_email = '@' in identifier
            
            # Build query based on identifier type
            if is_email:
                query = {'email': identifier.lower().strip(), 'code': code, 'used': False}
            else:
                # Search by phone number
                normalized_phone = self._normalize_phone(identifier)
                query = {
                    '$or': [
                        {'phone': normalized_phone},
                        {'phone': identifier},
                        {'phone': re.sub(r'\D', '', identifier)}
                    ],
                    'code': code,
                    'used': False
                }
            
            # Find the most recent reset request
            reset_request = await self.db.password_resets.find_one(
                query,
                sort=[('created_at', -1)]
            )
            
            if not reset_request:
                return {
                    'success': False,
                    'message': 'Código inválido o ya fue utilizado'
                }
            
            # Check if code has expired
            expires_at = reset_request['expires_at']
            if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                return {
                    'success': False,
                    'message': 'El código ha expirado. Solicita uno nuevo'
                }
            
            # Mark as verified
            await self.db.password_resets.update_one(
                {'_id': reset_request['_id']},
                {
                    '$set': {
                        'verified': True,
                        'verified_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"✅ Reset code verified for: {identifier}")
            
            return {
                'success': True,
                'message': 'Código verificado correctamente'
            }
            
        except Exception as e:
            logger.error(f"❌ Error verifying reset code: {e}")
            raise
    
    async def reset_password(self, identifier: str, code: str, new_password: str) -> Dict[str, Any]:
        """
        Reset user password
        - Verify code is valid and verified (by email or phone)
        - Update user password
        - Mark code as used
        """
        try:
            # Determine if identifier is email or phone
            is_email = '@' in identifier
            
            # Build query based on identifier type
            if is_email:
                query = {'email': identifier.lower().strip(), 'code': code, 'verified': True, 'used': False}
            else:
                # Search by phone number
                normalized_phone = self._normalize_phone(identifier)
                query = {
                    '$or': [
                        {'phone': normalized_phone},
                        {'phone': identifier},
                        {'phone': re.sub(r'\D', '', identifier)}
                    ],
                    'code': code,
                    'verified': True,
                    'used': False
                }
            
            # Find verified reset request
            reset_request = await self.db.password_resets.find_one(
                query,
                sort=[('created_at', -1)]
            )
            
            if not reset_request:
                return {
                    'success': False,
                    'message': 'Código inválido, no verificado o ya fue utilizado'
                }
            
            # Check if code has expired
            expires_at = reset_request['expires_at']
            if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                return {
                    'success': False,
                    'message': 'El código ha expirado. Solicita uno nuevo'
                }
            
            # Find user
            user = await self.db.users.find_one({'_id': reset_request['user_id']})
            if not user:
                return {
                    'success': False,
                    'message': 'Usuario no encontrado'
                }
            
            # Hash new password
            hashed_password = pwd_context.hash(new_password)
            
            # Update user password
            await self.db.users.update_one(
                {'_id': user['_id']},
                {
                    '$set': {
                        'password_hash': hashed_password,
                        'password_updated_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            # Mark reset request as used
            await self.db.password_resets.update_one(
                {'_id': reset_request['_id']},
                {
                    '$set': {
                        'used': True,
                        'used_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"✅ Password reset successfully for user: {user['_id']}")
            
            # Invalidate all user sessions for security
            await self.db.user_sessions.delete_many({'user_id': str(user['_id'])})
            logger.info(f"✅ All sessions invalidated for user: {user['_id']}")
            
            return {
                'success': True,
                'message': 'Contraseña actualizada exitosamente'
            }
            
        except Exception as e:
            logger.error(f"❌ Error resetting password: {e}")
            raise


# Global service instance (will be initialized in server.py)
password_reset_service: Optional[PasswordResetService] = None
