"""
Tax Wizard Appointment Service
Handles automatic appointment scheduling after wizard completion
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
import pytz

logger = logging.getLogger(__name__)

# Office timezone - Dumas, TX (Central Time)
CENTRAL_TZ = pytz.timezone('America/Chicago')

# Spanish day/month names for notifications
DIAS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
MESES_ES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

class TaxWizardAppointmentService:
    """Service for scheduling appointments after wizard completion"""
    
    def __init__(self, db):
        self.db = db
        self.appointments = db.appointments
        self.sessions = db.tax_wizard_sessions
    
    async def get_available_slots(
        self,
        start_date: Optional[datetime] = None,
        days_ahead: int = 14,
        slot_duration_minutes: int = 30
    ) -> List[dict]:
        """Get available appointment slots for the next X days
        All times are in Central Time (America/Chicago) for consistency.
        """
        # Always work in Central Time
        now_central = datetime.now(CENTRAL_TZ)
        
        if start_date:
            # Ensure start_date is in Central Time
            if start_date.tzinfo is None:
                start_date = CENTRAL_TZ.localize(start_date)
            else:
                start_date = start_date.astimezone(CENTRAL_TZ)
        else:
            start_date = now_central
        
        # Business hours: 10 AM - 2 PM Central Time, All days including weekends
        available_slots = []
        
        for day_offset in range(days_ahead):
            current_date = start_date + timedelta(days=day_offset)
            
            # All days: 10 AM - 2 PM Central Time
            start_hour, end_hour = 10, 14
            
            # Generate slots for each hour
            for hour in range(start_hour, end_hour):
                for minute in [0, 30]:
                    # Create slot time in Central Time
                    slot_time_central = CENTRAL_TZ.localize(
                        current_date.replace(
                            hour=hour,
                            minute=minute,
                            second=0,
                            microsecond=0
                        ).replace(tzinfo=None)
                    )
                    
                    # Skip past times
                    if slot_time_central <= now_central:
                        continue
                    
                    # Convert to UTC for database query
                    slot_time_utc = slot_time_central.astimezone(pytz.UTC)
                    
                    # Check if slot is already booked
                    existing = await self.appointments.find_one({
                        "scheduled_at": {
                            "$gte": slot_time_utc.replace(tzinfo=None),
                            "$lt": (slot_time_utc + timedelta(minutes=slot_duration_minutes)).replace(tzinfo=None)
                        },
                        "status": {"$in": ["scheduled", "confirmed"]}
                    })
                    
                    if not existing:
                        # Also check the old "date" field for backward compatibility
                        existing_legacy = await self.appointments.find_one({
                            "date": {
                                "$gte": slot_time_utc.replace(tzinfo=None),
                                "$lt": (slot_time_utc + timedelta(minutes=slot_duration_minutes)).replace(tzinfo=None)
                            },
                            "status": {"$in": ["scheduled", "confirmed"]}
                        })
                        
                        if not existing_legacy:
                            available_slots.append({
                                "datetime": slot_time_utc.isoformat(),
                                "datetime_central": slot_time_central.strftime("%Y-%m-%dT%H:%M:%S"),
                                "date": slot_time_central.strftime("%Y-%m-%d"),
                                "time": slot_time_central.strftime("%I:%M %p"),
                                "day_name": slot_time_central.strftime("%A"),
                                "day_name_es": self._get_spanish_day(slot_time_central.weekday()),
                                "formatted": slot_time_central.strftime("%A, %B %d at %I:%M %p") + " CT",
                                "formatted_es": f"{self._get_spanish_day(slot_time_central.weekday())}, {slot_time_central.day} de {self._get_spanish_month(slot_time_central.month)} a las {slot_time_central.strftime('%I:%M %p')} CT",
                                "timezone": "America/Chicago",
                                "available": True
                            })
            
            # Limit to 50 slots
            if len(available_slots) >= 50:
                break
        
        return available_slots
    
    def _get_spanish_day(self, weekday: int) -> str:
        days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        return days[weekday]
    
    def _get_spanish_month(self, month: int) -> str:
        months = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", 
                  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        return months[month]
    
    async def schedule_appointment(
        self,
        session_id: str,
        user_id: str,
        appointment_datetime: str,
        appointment_type: str = "tax_review",
        notes: str = ""
    ) -> dict:
        """Schedule an appointment after wizard completion.
        All times stored in UTC, displayed in Central Time.
        """
        
        # Parse datetime - handle both UTC and Central Time inputs
        try:
            apt_time = datetime.fromisoformat(appointment_datetime.replace('Z', '+00:00'))
            # If timezone-aware, convert to UTC
            if apt_time.tzinfo is not None:
                apt_time_utc = apt_time.astimezone(pytz.UTC).replace(tzinfo=None)
            else:
                # Assume UTC if no timezone info
                apt_time_utc = apt_time
            # Also get Central Time for display
            apt_time_central = pytz.UTC.localize(apt_time_utc).astimezone(CENTRAL_TZ)
        except ValueError:
            return {"success": False, "error": "Fecha inválida"}
        
        # Get session info
        try:
            session = await self.sessions.find_one({"_id": ObjectId(session_id)})
            logger.info(f"Session lookup for {session_id}: {'found' if session else 'not found'}")
        except Exception as e:
            logger.error(f"Session lookup error: {e}")
            return {"success": False, "error": "ID de sesión inválido"}
        
        if not session:
            return {"success": False, "error": "Sesión no encontrada"}
        
        # Get user info
        try:
            user = await self.db["users"].find_one({"_id": ObjectId(user_id)})
        except:
            user = await self.db["users"].find_one({"id": user_id})
        
        personal_info = session.get("personal_info", {})
        
        # Check if slot is still available
        existing = await self.appointments.find_one({
            "scheduled_at": {
                "$gte": apt_time_utc,
                "$lt": apt_time_utc + timedelta(minutes=30)
            },
            "status": {"$in": ["scheduled", "confirmed"]}
        })
        
        if existing:
            # Also check legacy "date" field
            pass
        else:
            existing = None
        
        if not existing:
            existing = await self.appointments.find_one({
                "date": {
                    "$gte": apt_time_utc,
                    "$lt": apt_time_utc + timedelta(minutes=30)
                },
                "status": {"$in": ["scheduled", "confirmed"]}
            })
        
        if existing:
            return {"success": False, "error": "Este horario ya no está disponible"}
        
        # Create appointment
        refund_estimate_data = session.get("refund_estimate") or {}
        refund_amount = refund_estimate_data.get("estimated_refund", 0) if isinstance(refund_estimate_data, dict) else 0
        
        # Use same fields as main appointments endpoint for consistency
        # Store in UTC, display in Central Time
        appointment_doc = {
            "user_id": user_id,
            "session_id": session_id,
            "tax_wizard_session_id": session_id,
            # Standard appointment fields - stored in UTC
            "scheduled_at": apt_time_utc,
            "date": apt_time_utc.strftime('%Y-%m-%d'),
            "time": apt_time_central.strftime('%H:%M'),
            "time_display": apt_time_central.strftime('%I:%M %p') + " CT",
            "end_date": apt_time_utc + timedelta(minutes=30),
            "duration_minutes": 30,
            "timezone": "America/Chicago",
            # Appointment type and service
            "type": appointment_type,
            "appointment_type": "in_person",
            "service_name": "Mi Reembolso - Revisión de Declaración",
            "service_type": "Mi Reembolso - Revisión de Declaración",
            "title": "Mi Reembolso - Revisión de Declaración",
            "status": "scheduled",
            # Customer info (both formats for compatibility)
            "customer_name": f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip(),
            "user_name": f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip(),
            "customer_email": personal_info.get("email") or (user.get("email") if user else ""),
            "user_email": personal_info.get("email") or (user.get("email") if user else ""),
            "customer_phone": personal_info.get("phone") or (user.get("phone") if user else ""),
            "user_phone": personal_info.get("phone") or (user.get("phone") if user else ""),
            "notes": notes,
            "tax_year": session.get("tax_year"),
            "refund_estimate": refund_amount,
            "source": "tax_wizard",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.appointments.insert_one(appointment_doc)
        appointment_id = str(result.inserted_id)
        
        # Update session with appointment info
        await self.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "appointment_id": appointment_id,
                "appointment_datetime": apt_time_utc,
                "appointment_scheduled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        logger.info(f"📅 Appointment scheduled for session {session_id} at {apt_time_central.strftime('%I:%M %p')} CT")
        
        # Send notifications asynchronously (don't block the response)
        try:
            await self._send_appointment_notifications(
                appointment_doc,
                apt_time_central,
                personal_info,
                user
            )
        except Exception as e:
            logger.error(f"Error sending notifications: {e}")
            # Don't fail the appointment creation if notifications fail
        
        return {
            "success": True,
            "appointment_id": appointment_id,
            "datetime": apt_time_utc.isoformat(),
            "datetime_central": apt_time_central.strftime("%Y-%m-%dT%H:%M:%S"),
            "timezone": "America/Chicago",
            "formatted": f"{self._get_spanish_day(apt_time_central.weekday())}, {apt_time_central.day} de {self._get_spanish_month(apt_time_central.month)} a las {apt_time_central.strftime('%I:%M %p')} CT",
            "message": "¡Cita agendada exitosamente!"
        }
    
    async def cancel_appointment(self, appointment_id: str, user_id: str) -> dict:
        """Cancel an appointment"""
        appointment = await self.appointments.find_one({"_id": ObjectId(appointment_id)})
        
        if not appointment:
            return {"success": False, "error": "Cita no encontrada"}
        
        if str(appointment.get("user_id")) != str(user_id):
            return {"success": False, "error": "No autorizado"}
        
        if appointment.get("status") == "completed":
            return {"success": False, "error": "No se puede cancelar una cita completada"}
        
        await self.appointments.update_one(
            {"_id": ObjectId(appointment_id)},
            {"$set": {
                "status": "cancelled",
                "cancelled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Update session
        if appointment.get("tax_wizard_session_id"):
            await self.sessions.update_one(
                {"_id": ObjectId(appointment.get("tax_wizard_session_id"))},
                {"$unset": {"appointment_id": "", "appointment_datetime": ""}}
            )
        
        return {"success": True, "message": "Cita cancelada"}
    
    async def get_user_appointments(self, user_id: str) -> List[dict]:
        """Get all appointments for a user"""
        appointments = await self.appointments.find({
            "user_id": user_id,
            "source": "tax_wizard",
            "status": {"$ne": "cancelled"}
        }).sort("date", -1).to_list(20)
        
        return [
            {
                "id": str(apt["_id"]),
                "datetime": apt["date"].isoformat(),
                "formatted": f"{self._get_spanish_day(apt['date'].weekday())}, {apt['date'].day} de {self._get_spanish_month(apt['date'].month)} a las {apt['date'].strftime('%I:%M %p')}",
                "status": apt["status"],
                "service_type": apt.get("service_type", "Revisión de Declaración"),
                "tax_year": apt.get("tax_year")
            }
            for apt in appointments
        ]
    
    async def get_all_wizard_appointments(self, status: str = None, limit: int = 50) -> List[dict]:
        """Get all tax wizard appointments for admin view"""
        query = {"source": "tax_wizard"}
        if status:
            query["status"] = status
        
        appointments = await self.appointments.find(query).sort("created_at", -1).to_list(limit)
        
        result = []
        for apt in appointments:
            try:
                # Handle date field that could be datetime, string, or None
                apt_date = apt.get("date")
                date_iso = None
                date_formatted = ""
                if apt_date:
                    if isinstance(apt_date, str):
                        try:
                            apt_date = datetime.fromisoformat(apt_date.replace('Z', '+00:00'))
                        except Exception:
                            apt_date = None
                    if isinstance(apt_date, datetime):
                        date_iso = apt_date.isoformat()
                        try:
                            date_formatted = f"{self._get_spanish_day(apt_date.weekday())}, {apt_date.day} de {self._get_spanish_month(apt_date.month)} a las {apt_date.strftime('%I:%M %p')}"
                        except Exception:
                            date_formatted = str(apt_date)
                
                created = apt.get("created_at")
                created_iso = None
                if created:
                    if isinstance(created, datetime):
                        created_iso = created.isoformat()
                    elif isinstance(created, str):
                        created_iso = created
                
                result.append({
                    "id": str(apt["_id"]),
                    "session_id": apt.get("session_id") or apt.get("tax_wizard_session_id"),
                    "customer_name": apt.get("customer_name", "Sin nombre"),
                    "customer_email": apt.get("customer_email", ""),
                    "customer_phone": apt.get("customer_phone", ""),
                    "datetime": date_iso,
                    "formatted": date_formatted,
                    "status": apt.get("status", "scheduled"),
                    "service_type": apt.get("service_type", "Revisión de Declaración"),
                    "tax_year": apt.get("tax_year"),
                    "refund_estimate": apt.get("refund_estimate", 0),
                    "notes": apt.get("notes", ""),
                    "created_at": created_iso
                })
            except Exception as e:
                logger.warning(f"Skipping appointment {apt.get('_id')}: {e}")
                continue
        
        return result
    
    async def _send_appointment_notifications(
        self, 
        appointment: dict, 
        apt_time: datetime,
        personal_info: dict,
        user: dict
    ):
        """Send WhatsApp/SMS and Email notifications for new appointment"""
        try:
            # Get notification config from environment variables (same as other services)
            config = {
                'sendgrid_api_key': os.getenv('SENDGRID_API_KEY'),
                'sendgrid_from_email': os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'),
                'sendgrid_from_name': 'Ross Tax Preparation',
                'twilio_account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
                'twilio_auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
                'twilio_phone_number': os.getenv('TWILIO_PHONE_NUMBER'),
                'company_phone': '806-934-2018'
            }
            
            if not config.get('sendgrid_api_key') and not config.get('twilio_account_sid'):
                logger.warning("No notification credentials found in environment")
                return
            
            # Import notification service
            from notification_service import NotificationService
            notif_service = NotificationService(config)
            
            # Format appointment date
            formatted_date = f"{DIAS_ES[apt_time.weekday()]}, {apt_time.day} de {MESES_ES[apt_time.month]} a las {apt_time.strftime('%I:%M %p')}"
            customer_name = appointment.get("customer_name") or "Cliente"
            
            # Get contact info
            customer_email = personal_info.get("email") or (user.get("email") if user else None)
            customer_phone = personal_info.get("phone") or (user.get("phone") if user else None)
            
            # Send Email notification
            if customer_email:
                email_html = self._generate_appointment_email_html(
                    customer_name=customer_name,
                    formatted_date=formatted_date,
                    tax_year=appointment.get("tax_year", 2025),
                    refund_estimate=appointment.get("refund_estimate", 0)
                )
                
                email_sent = await notif_service.send_email(
                    to_email=customer_email,
                    subject="📅 ¡Tu Cita de Revisión de Impuestos está Confirmada!",
                    html_content=email_html
                )
                
                if email_sent:
                    logger.info(f"📧 Email de confirmación enviado a {customer_email}")
                    # Record notification
                    await self.db["notification_logs"].insert_one({
                        "type": "email",
                        "recipient": customer_email,
                        "subject": "Confirmación de Cita - Mi Reembolso",
                        "appointment_id": str(appointment.get("_id", "")),
                        "sent_at": datetime.utcnow(),
                        "status": "sent"
                    })
            
            # Send SMS/WhatsApp notification
            if customer_phone:
                # Clean phone number
                clean_phone = ''.join(filter(str.isdigit, customer_phone))
                if len(clean_phone) == 10:
                    clean_phone = f"+1{clean_phone}"
                elif not clean_phone.startswith('+'):
                    clean_phone = f"+{clean_phone}"
                
                sms_message = f"""🗓️ ¡Cita Confirmada!

Hola {customer_name},

Tu cita para revisar tu declaración de impuestos ha sido agendada:

📅 {formatted_date}
📞 Te llamaremos al número registrado

Si necesitas cambiar la cita, llámanos al 806-934-2018.

- Ross Tax Preparation 💰"""
                
                sms_sent = await notif_service.send_sms(
                    to_phone=clean_phone,
                    message=sms_message
                )
                
                if sms_sent:
                    logger.info(f"📱 SMS de confirmación enviado a {clean_phone}")
                    # Record notification
                    await self.db["notification_logs"].insert_one({
                        "type": "sms",
                        "recipient": clean_phone,
                        "message": "Confirmación de Cita - Mi Reembolso",
                        "appointment_id": str(appointment.get("_id", "")),
                        "sent_at": datetime.utcnow(),
                        "status": "sent"
                    })
            
            # Also notify admin
            admin_email = os.getenv("ADMIN_EMAIL", "yoandyross@gmail.com")
            admin_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>📅 Nueva Cita de Mi Reembolso</h2>
                <p><strong>Cliente:</strong> {customer_name}</p>
                <p><strong>Email:</strong> {customer_email or 'No disponible'}</p>
                <p><strong>Teléfono:</strong> {customer_phone or 'No disponible'}</p>
                <p><strong>Fecha:</strong> {formatted_date}</p>
                <p><strong>Reembolso Estimado:</strong> ${appointment.get('refund_estimate', 0):,.2f}</p>
                <p><strong>Año Fiscal:</strong> {appointment.get('tax_year', 2025)}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Ver todas las citas en el <a href="https://app-nueva-production.up.railway.app/admin/wizard-appointments">Panel de Admin</a>
                </p>
            </div>
            """
            
            await notif_service.send_email(
                to_email=admin_email,
                subject=f"📅 Nueva Cita: {customer_name} - {formatted_date}",
                html_content=admin_html
            )
            
        except Exception as e:
            logger.error(f"Error sending appointment notifications: {e}")
    
    def _generate_appointment_email_html(
        self, 
        customer_name: str, 
        formatted_date: str,
        tax_year: int,
        refund_estimate: float
    ) -> str:
        """Generate beautiful HTML email for appointment confirmation"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #065F46, #10B981); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📅 ¡Cita Confirmada!</h1>
            <p style="color: #D1FAE5; margin: 10px 0 0 0; font-size: 16px;">Tu revisión de impuestos está agendada</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #1F2937; margin: 0 0 20px 0;">
                Hola <strong>{customer_name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
                ¡Gracias por completar tu declaración de impuestos con Mi Reembolso! 
                Tu cita para revisar tu declaración con uno de nuestros expertos ha sido confirmada.
            </p>
            
            <!-- Appointment Card -->
            <div style="background-color: #ECFDF5; border: 2px solid #10B981; border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px;">
                <p style="color: #065F46; font-size: 14px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Fecha y Hora</p>
                <p style="color: #065F46; font-size: 24px; font-weight: bold; margin: 0;">
                    {formatted_date}
                </p>
            </div>
            
            <!-- Refund Preview -->
            {f'''
            <div style="background-color: #FEF3C7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 30px;">
                <p style="color: #92400E; font-size: 14px; margin: 0 0 5px 0;">Tu Reembolso Estimado</p>
                <p style="color: #D97706; font-size: 32px; font-weight: bold; margin: 0;">
                    ${refund_estimate:,.2f}
                </p>
                <p style="color: #92400E; font-size: 12px; margin: 5px 0 0 0;">Año fiscal {tax_year}</p>
            </div>
            ''' if refund_estimate > 0 else ''}
            
            <!-- What to expect -->
            <div style="background-color: #F3F4F6; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #1F2937; margin: 0 0 15px 0; font-size: 18px;">📋 ¿Qué esperar?</h3>
                <ul style="color: #4B5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>Te llamaremos al número que registraste</li>
                    <li>Revisaremos juntos tu declaración</li>
                    <li>Responderemos todas tus preguntas</li>
                    <li>Maximizaremos tu reembolso</li>
                </ul>
            </div>
            
            <!-- Contact Info -->
            <div style="text-align: center; padding: 20px 0; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px; margin: 0 0 10px 0;">
                    ¿Necesitas cambiar tu cita?
                </p>
                <p style="margin: 0;">
                    <a href="tel:806-934-2018" style="color: #10B981; font-weight: bold; font-size: 18px; text-decoration: none;">
                        📞 806-934-2018
                    </a>
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #1F2937; padding: 30px; text-align: center;">
            <p style="color: #9CA3AF; margin: 0 0 10px 0; font-size: 14px;">
                Ross Tax Preparation LLC
            </p>
            <p style="color: #6B7280; margin: 0; font-size: 12px;">
                Tu éxito financiero es nuestra prioridad 💚
            </p>
        </div>
    </div>
</body>
</html>
"""


# Global instance
appointment_service: Optional[TaxWizardAppointmentService] = None

def init_appointment_service(db):
    global appointment_service
    appointment_service = TaxWizardAppointmentService(db)
    logger.info("✅ Tax Wizard Appointment Service initialized")
    return appointment_service
