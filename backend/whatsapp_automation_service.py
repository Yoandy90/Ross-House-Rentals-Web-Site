"""
WhatsApp Automation Service
Handles automated WhatsApp notifications for appointments, documents, invoices, etc.
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

MIAMI_TZ = ZoneInfo("America/New_York")


class WhatsAppAutomationService:
    """Service for automated WhatsApp notifications"""
    
    def __init__(self, db: AsyncIOMotorDatabase, whatsapp_service):
        self.db = db
        self.whatsapp_service = whatsapp_service
    
    async def _find_user(self, user_id: str):
        """Find user by ID - handles both ObjectId and UUID formats"""
        # Try ObjectId first
        try:
            user = await self._find_user(user_id)
            if user:
                return user
        except:
            pass
        # Try as string ID (UUID)
        user = await self.db.users.find_one({'_id': user_id})
        if user:
            return user
        # Try by id field
        user = await self.db.users.find_one({'id': user_id})
        return user
    
    # ===========================================
    # APPOINTMENT NOTIFICATIONS
    # ===========================================
    
    async def _find_appointment(self, appointment_id: str):
        """Find appointment by ID - handles both ObjectId and UUID formats"""
        # Try as ObjectId first
        try:
            appointment = await self._find_appointment(appointment_id)
            if appointment:
                return appointment
        except:
            pass
        # Try as string UUID
        appointment = await self.db.appointments.find_one({'_id': appointment_id})
        if appointment:
            return appointment
        # Try by id field
        appointment = await self.db.appointments.find_one({'id': appointment_id})
        return appointment

    async def send_appointment_confirmation(self, appointment_id: str) -> Dict[str, Any]:
        """
        Send appointment confirmation via WhatsApp
        Trigger: When a new appointment is created
        """
        try:
            appointment = await self._find_appointment(appointment_id)
            if not appointment:
                return {'success': False, 'error': 'Appointment not found'}
            
            # Get user info
            user_id = appointment.get('user_id') or appointment.get('client_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            # Check WhatsApp opt-in
            if not user.get('whatsapp_optin', True):
                return {'success': False, 'error': 'User opted out of WhatsApp'}
            
            # Format date
            appt_date = appointment.get('date')
            if isinstance(appt_date, datetime):
                date_str = appt_date.strftime('%d de %B, %Y a las %I:%M %p')
            else:
                date_str = str(appt_date)
            
            service_type = appointment.get('service_type', 'Preparación de Impuestos')
            
            message = f"""✅ *Cita Confirmada - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

Tu cita ha sido agendada exitosamente:

📅 *Fecha:* {date_str}
📍 *Servicio:* {service_type}
🏢 *Ubicación:* Ross Tax Preparation

*Documentos a traer:*
• Identificación con foto
• W-2 de todos los empleos
• 1099 (si aplica)
• Seguro social de dependientes

Para cambiar o cancelar tu cita, responde CAMBIAR o usa nuestra app.

¡Te esperamos! 🎉"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            # Log the notification
            await self._log_notification(
                user_id=str(user_id),
                notification_type='appointment_confirmation',
                reference_id=appointment_id,
                status='sent' if result.get('success') else 'failed'
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending appointment confirmation: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_appointment_reminder(self, appointment_id: str, hours_before: int = 24) -> Dict[str, Any]:
        """
        Send appointment reminder via WhatsApp
        Trigger: Scheduled job 24h and 1h before appointment
        """
        try:
            appointment = await self._find_appointment(appointment_id)
            if not appointment:
                return {'success': False, 'error': 'Appointment not found'}
            
            if appointment.get('status') in ['cancelled', 'completed']:
                return {'success': False, 'error': 'Appointment cancelled or completed'}
            
            # Get user info
            user_id = appointment.get('user_id') or appointment.get('client_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            # Format date
            appt_date = appointment.get('date')
            if isinstance(appt_date, datetime):
                if hours_before >= 24:
                    time_msg = f"mañana a las {appt_date.strftime('%I:%M %p')}"
                else:
                    time_msg = f"en {hours_before} hora(s)"
                date_str = appt_date.strftime('%d de %B a las %I:%M %p')
            else:
                time_msg = "pronto"
                date_str = str(appt_date)
            
            message = f"""📅 *Recordatorio de Cita - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

Te recordamos que tienes una cita {time_msg}.

📆 *{date_str}*
📍 Ross Tax Preparation

¿Confirmas tu asistencia?
Responde *SÍ* para confirmar o *NO* para cancelar.

Si necesitas cambiar la hora, responde *CAMBIAR*."""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            await self._log_notification(
                user_id=str(user_id),
                notification_type=f'appointment_reminder_{hours_before}h',
                reference_id=appointment_id,
                status='sent' if result.get('success') else 'failed'
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending appointment reminder: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_appointment_cancelled(self, appointment_id: str, reason: str = None) -> Dict[str, Any]:
        """
        Send appointment cancellation notification
        Trigger: When appointment is cancelled by admin
        """
        try:
            appointment = await self._find_appointment(appointment_id)
            if not appointment:
                return {'success': False, 'error': 'Appointment not found'}
            
            user_id = appointment.get('user_id') or appointment.get('client_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            reason_text = f"\n📝 *Motivo:* {reason}" if reason else ""
            
            message = f"""❌ *Cita Cancelada - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]},

Tu cita ha sido cancelada.{reason_text}

Para agendar una nueva cita, visita nuestra app o responde *AGENDAR*.

Disculpa las molestias.
- Equipo Ross Tax"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending cancellation: {e}")
            return {'success': False, 'error': str(e)}
    
    # ===========================================
    # DOCUMENT NOTIFICATIONS
    # ===========================================
    
    async def send_document_received(self, document_id: str) -> Dict[str, Any]:
        """
        Send notification when a document is received
        Trigger: When client uploads a document
        """
        try:
            document = await self.db.documents.find_one({'_id': ObjectId(document_id)})
            if not document:
                return {'success': False, 'error': 'Document not found'}
            
            user_id = document.get('user_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            doc_name = document.get('name', document.get('category', 'Documento'))
            
            message = f"""📄 *Documento Recibido - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

Hemos recibido tu documento:
📎 *{doc_name}*

✅ Lo estamos revisando y te notificaremos si necesitamos algo más.

¡Gracias por usar Ross Tax!"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending document received notification: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_documents_pending(self, user_id: str, pending_documents: List[str]) -> Dict[str, Any]:
        """
        Send reminder about pending documents
        Trigger: Scheduled job or manual trigger from admin
        """
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            docs_list = "\n".join([f"• {doc}" for doc in pending_documents])
            
            message = f"""⚠️ *Documentos Pendientes - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]},

Para continuar con tu declaración de impuestos, necesitamos los siguientes documentos:

{docs_list}

📱 Puedes subirlos fácilmente desde nuestra app o tomarles una foto y enviarlos aquí.

¿Tienes preguntas? Responde a este mensaje.

- Equipo Ross Tax"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            await self._log_notification(
                user_id=str(user_id),
                notification_type='documents_pending',
                status='sent' if result.get('success') else 'failed'
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending pending documents reminder: {e}")
            return {'success': False, 'error': str(e)}
    
    # ===========================================
    # INVOICE NOTIFICATIONS
    # ===========================================
    
    async def send_invoice_created(self, invoice_id: str) -> Dict[str, Any]:
        """
        Send notification when an invoice is created
        Trigger: When admin creates invoice
        """
        try:
            invoice = await self.db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                return {'success': False, 'error': 'Invoice not found'}
            
            user_id = invoice.get('user_id') or invoice.get('client_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            total = invoice.get('total', 0)
            invoice_num = invoice.get('invoice_number', str(invoice['_id'])[:8])
            due_date = invoice.get('due_date')
            
            if isinstance(due_date, datetime):
                due_str = due_date.strftime('%d de %B, %Y')
            else:
                due_str = "Próximamente"
            
            message = f"""💰 *Nueva Factura - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]},

Se ha generado una nueva factura:

🧾 *Factura #:* {invoice_num}
💵 *Total:* ${total:,.2f}
📅 *Vence:* {due_str}

Puedes pagar desde nuestra app o responde *PAGAR* para más opciones.

¡Gracias por confiar en Ross Tax!"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending invoice notification: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_payment_received(self, invoice_id: str, amount: float) -> Dict[str, Any]:
        """
        Send notification when a payment is received
        Trigger: When payment is processed
        """
        try:
            invoice = await self.db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                return {'success': False, 'error': 'Invoice not found'}
            
            user_id = invoice.get('user_id') or invoice.get('client_id')
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            invoice_num = invoice.get('invoice_number', str(invoice['_id'])[:8])
            
            message = f"""✅ *Pago Recibido - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

Hemos recibido tu pago:

💵 *Monto:* ${amount:,.2f}
🧾 *Factura #:* {invoice_num}

¡Gracias por tu pago! Tu recibo está disponible en la app.

- Equipo Ross Tax 🎉"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending payment confirmation: {e}")
            return {'success': False, 'error': str(e)}
    
    # ===========================================
    # TAX RETURN NOTIFICATIONS
    # ===========================================
    
    async def send_tax_return_ready(self, user_id: str, tax_year: int, refund_amount: float = None) -> Dict[str, Any]:
        """
        Send notification when tax return is ready
        Trigger: When admin marks return as completed
        """
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            refund_text = ""
            if refund_amount and refund_amount > 0:
                refund_text = f"\n\n💰 *Reembolso Estimado:* ${refund_amount:,.2f}"
            elif refund_amount and refund_amount < 0:
                refund_text = f"\n\n💳 *Impuesto a Pagar:* ${abs(refund_amount):,.2f}"
            
            message = f"""🎉 *¡Tu Declaración Está Lista! - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

¡Excelentes noticias! Tu declaración de impuestos del {tax_year} está completa.{refund_text}

📱 Revisa los detalles en la app y firma electrónicamente para enviar al IRS.

¿Preguntas? Responde a este mensaje o llámanos.

¡Gracias por confiar en Ross Tax! 🙏"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending tax return ready notification: {e}")
            return {'success': False, 'error': str(e)}
    
    # ===========================================
    # MARKETING / CAMPAIGNS
    # ===========================================
    
    async def send_tax_season_reminder(self, user_id: str) -> Dict[str, Any]:
        """
        Send tax season reminder
        Trigger: Scheduled campaign in January
        """
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            message = f"""📢 *¡Es Temporada de Taxes! - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

La temporada de impuestos 2025 ha comenzado. 🗓️

✅ Agenda tu cita ahora y evita las filas
✅ Preparación profesional y rápida
✅ Máximo reembolso garantizado

🎁 *Oferta Especial:* Agenda antes del 31 de Enero y obtén 10% de descuento.

Responde *AGENDAR* o visita nuestra app.

- Ross Tax Preparation"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending tax season reminder: {e}")
            return {'success': False, 'error': str(e)}
    
    async def send_referral_bonus(self, referrer_id: str, referred_name: str, bonus_amount: float) -> Dict[str, Any]:
        """
        Send referral bonus notification
        Trigger: When a referred client completes their first service
        """
        try:
            user = await self.db.users.find_one({'_id': ObjectId(referrer_id)})
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            message = f"""🎉 *¡Ganaste un Bono de Referido! - Ross Tax*

Hola {user.get('name', 'Cliente').split()[0]}!

¡Felicidades! {referred_name} completó su servicio gracias a tu referido.

💰 *Has ganado:* ${bonus_amount:,.2f} en créditos

Tu saldo actual está disponible en la app. ¡Sigue refiriendo y ganando!

👥 Comparte tu código de referido y gana más.

- Equipo Ross Tax 🙏"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending referral bonus notification: {e}")
            return {'success': False, 'error': str(e)}
    
    # ===========================================
    # HELPER METHODS
    # ===========================================
    
    async def _log_notification(
        self,
        user_id: str,
        notification_type: str,
        reference_id: str = None,
        status: str = 'sent'
    ):
        """Log notification to database"""
        try:
            await self.db.whatsapp_notifications_log.insert_one({
                'user_id': user_id,
                'notification_type': notification_type,
                'reference_id': reference_id,
                'status': status,
                'sent_at': datetime.utcnow()
            })
        except Exception as e:
            logger.error(f"Error logging notification: {e}")
    
    async def get_pending_reminders(self) -> List[Dict]:
        """
        Get appointments that need reminders
        Called by scheduled job
        """
        try:
            now = datetime.utcnow()
            
            # 24 hours from now
            reminder_24h_start = now + timedelta(hours=23)
            reminder_24h_end = now + timedelta(hours=25)
            
            # 1 hour from now
            reminder_1h_start = now + timedelta(minutes=50)
            reminder_1h_end = now + timedelta(minutes=70)
            
            appointments_24h = await self.db.appointments.find({
                'date': {'$gte': reminder_24h_start, '$lte': reminder_24h_end},
                'status': {'$nin': ['cancelled', 'completed']},
                'reminder_24h_sent': {'$ne': True}
            }).to_list(100)
            
            appointments_1h = await self.db.appointments.find({
                'date': {'$gte': reminder_1h_start, '$lte': reminder_1h_end},
                'status': {'$nin': ['cancelled', 'completed']},
                'reminder_1h_sent': {'$ne': True}
            }).to_list(100)
            
            return {
                '24h': appointments_24h,
                '1h': appointments_1h
            }
            
        except Exception as e:
            logger.error(f"Error getting pending reminders: {e}")
            return {'24h': [], '1h': []}
    
    # ===========================================
    # AUTOMATIC REMINDER SCHEDULER
    # ===========================================
    
    async def process_scheduled_reminders(self) -> Dict[str, Any]:
        """
        Process all pending reminders - called by scheduler every 15 minutes
        """
        results = {'sent_24h': 0, 'sent_1h': 0, 'errors': []}
        
        try:
            pending = await self.get_pending_reminders()
            
            # Send 24h reminders
            for appt in pending.get('24h', []):
                try:
                    result = await self.send_appointment_reminder(str(appt['_id']), hours_before=24)
                    if result.get('success'):
                        await self.db.appointments.update_one(
                            {'_id': appt['_id']},
                            {'$set': {'reminder_24h_sent': True, 'reminder_24h_sent_at': datetime.utcnow()}}
                        )
                        results['sent_24h'] += 1
                except Exception as e:
                    results['errors'].append(f"24h reminder error: {str(e)}")
            
            # Send 1h reminders
            for appt in pending.get('1h', []):
                try:
                    result = await self.send_appointment_reminder(str(appt['_id']), hours_before=1)
                    if result.get('success'):
                        await self.db.appointments.update_one(
                            {'_id': appt['_id']},
                            {'$set': {'reminder_1h_sent': True, 'reminder_1h_sent_at': datetime.utcnow()}}
                        )
                        results['sent_1h'] += 1
                except Exception as e:
                    results['errors'].append(f"1h reminder error: {str(e)}")
            
            logger.info(f"📅 Reminders sent: {results['sent_24h']} (24h), {results['sent_1h']} (1h)")
            return results
            
        except Exception as e:
            logger.error(f"Error processing scheduled reminders: {e}")
            return results
    
    # ===========================================
    # DOCUMENT FOLLOW-UP
    # ===========================================
    
    # Required documents checklist
    REQUIRED_DOCUMENTS = {
        'basic': [
            {'id': 'id_photo', 'name': 'Identificación con foto', 'required': True},
            {'id': 'ssn_card', 'name': 'Tarjeta de Seguro Social', 'required': True},
            {'id': 'w2', 'name': 'W-2 (de cada empleo)', 'required': True},
        ],
        'optional': [
            {'id': '1099', 'name': '1099 (ingresos adicionales)', 'required': False},
            {'id': '1098', 'name': '1098 (intereses hipoteca)', 'required': False},
            {'id': '1095', 'name': '1095-A (seguro de salud)', 'required': False},
            {'id': 'dependents_ssn', 'name': 'SSN de dependientes', 'required': False},
            {'id': 'bank_info', 'name': 'Info bancaria para depósito', 'required': False},
        ],
        'business': [
            {'id': 'income_records', 'name': 'Registros de ingresos del negocio', 'required': True},
            {'id': 'expense_receipts', 'name': 'Recibos de gastos', 'required': True},
            {'id': 'mileage_log', 'name': 'Registro de millas (si aplica)', 'required': False},
        ]
    }
    
    async def check_client_documents(self, user_id: str) -> Dict[str, Any]:
        """
        Check what documents a client has uploaded vs what's needed
        """
        try:
            # Get user's uploaded documents
            uploaded_docs = await self.db.documents.find({
                'user_id': user_id,
                'status': {'$ne': 'rejected'}
            }).to_list(100)
            
            # Get user's service type to determine required docs
            user = await self._find_user(user_id)
            tax_return = await self.db.tax_returns.find_one(
                {'user_id': user_id, 'year': datetime.now().year},
                sort=[('created_at', -1)]
            )
            
            has_business = tax_return.get('has_business', False) if tax_return else False
            
            # Map uploaded documents by category
            uploaded_categories = set()
            for doc in uploaded_docs:
                cat = doc.get('category', '').lower()
                if 'w2' in cat or 'w-2' in cat:
                    uploaded_categories.add('w2')
                elif 'id' in cat or 'licen' in cat or 'passport' in cat:
                    uploaded_categories.add('id_photo')
                elif 'social' in cat or 'ssn' in cat or 'ss card' in cat:
                    uploaded_categories.add('ssn_card')
                elif '1099' in cat:
                    uploaded_categories.add('1099')
                elif '1098' in cat:
                    uploaded_categories.add('1098')
                elif '1095' in cat:
                    uploaded_categories.add('1095')
                elif 'bank' in cat or 'cuenta' in cat:
                    uploaded_categories.add('bank_info')
            
            # Check what's missing
            missing = []
            for doc in self.REQUIRED_DOCUMENTS['basic']:
                if doc['id'] not in uploaded_categories:
                    missing.append(doc)
            
            if has_business:
                for doc in self.REQUIRED_DOCUMENTS['business']:
                    if doc['id'] not in uploaded_categories and doc['required']:
                        missing.append(doc)
            
            return {
                'user_id': user_id,
                'uploaded_count': len(uploaded_docs),
                'uploaded_categories': list(uploaded_categories),
                'missing_required': [d for d in missing if d.get('required', True)],
                'missing_optional': [d for d in missing if not d.get('required', True)],
                'is_complete': len([d for d in missing if d.get('required', True)]) == 0,
                'has_business': has_business
            }
            
        except Exception as e:
            logger.error(f"Error checking client documents: {e}")
            return {'error': str(e)}
    
    async def send_document_followup(self, user_id: str) -> Dict[str, Any]:
        """
        Send document follow-up reminder via WhatsApp
        """
        try:
            # Check what's missing
            doc_status = await self.check_client_documents(user_id)
            
            if doc_status.get('error'):
                return {'success': False, 'error': doc_status['error']}
            
            if doc_status.get('is_complete'):
                return {'success': True, 'message': 'All documents complete, no follow-up needed'}
            
            # Get user info
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            # Build message
            missing_required = doc_status.get('missing_required', [])
            missing_count = len(missing_required)
            
            docs_list = '\n'.join([f"  📄 {doc['name']}" for doc in missing_required[:5]])
            
            first_name = user.get('name', 'Cliente').split()[0]
            
            message = f"""📋 *Seguimiento de Documentos - Ross Tax*

Hola {first_name}! 👋

Para completar tu declaración de impuestos, nos faltan {missing_count} documento(s):

{docs_list}

📱 *¿Cómo enviarlos?*
Simplemente toma una foto clara y envíala aquí por WhatsApp.

💡 *Tips para buenas fotos:*
• Buena iluminación
• Documento completo visible
• Sin reflejos ni sombras

¿Tienes alguna pregunta sobre los documentos? Estoy aquí para ayudarte! 😊"""

            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            # Log the follow-up
            await self._log_notification(
                user_id=user_id,
                notification_type='document_followup',
                reference_id=None,
                status='sent' if result.get('success') else 'failed',
                details={'missing_count': missing_count}
            )
            
            return {
                'success': result.get('success', False),
                'missing_documents': missing_required,
                'message_sent': True
            }
            
        except Exception as e:
            logger.error(f"Error sending document follow-up: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_clients_needing_documents(self) -> List[Dict]:
        """
        Get list of clients with incomplete documents
        For admin dashboard and batch follow-ups
        """
        try:
            # Get active clients with tax returns in progress
            clients = await self.db.users.find({
                'role': 'client',
                'is_active': True
            }).to_list(500)
            
            clients_needing_docs = []
            
            for client in clients:
                doc_status = await self.check_client_documents(str(client['_id']))
                if not doc_status.get('is_complete') and not doc_status.get('error'):
                    clients_needing_docs.append({
                        'user_id': str(client['_id']),
                        'name': client.get('name', 'N/A'),
                        'phone': client.get('phone', ''),
                        'email': client.get('email', ''),
                        'missing_count': len(doc_status.get('missing_required', [])),
                        'missing_documents': doc_status.get('missing_required', []),
                        'uploaded_count': doc_status.get('uploaded_count', 0)
                    })
            
            # Sort by missing count (most missing first)
            clients_needing_docs.sort(key=lambda x: x['missing_count'], reverse=True)
            
            return clients_needing_docs
            
        except Exception as e:
            logger.error(f"Error getting clients needing documents: {e}")
            return []
    
    # ===========================================
    # TAX RETURN STATUS NOTIFICATIONS
    # ===========================================
    
    STATUS_MESSAGES = {
        'documents_received': {
            'emoji': '📥',
            'title': 'Documentos Recibidos',
            'message': '''Hola {name}! 

Hemos recibido tus documentos. Nuestro equipo comenzará a revisar tu información pronto.

📋 *Próximo paso:* Te notificaremos cuando tu declaración esté lista para revisión.

¡Gracias por confiar en Ross Tax! 🙏'''
        },
        'in_progress': {
            'emoji': '⚙️',
            'title': 'Declaración en Proceso',
            'message': '''Hola {name}!

Tu declaración de impuestos está siendo preparada por nuestro equipo. 📊

⏱️ *Tiempo estimado:* 24-48 horas

Te avisaremos cuando esté lista para tu revisión.'''
        },
        'ready_for_review': {
            'emoji': '👀',
            'title': 'Lista para Revisión',
            'message': '''Hola {name}! 🎉

¡Tu declaración de impuestos está lista!

📱 *Revísala en nuestra app:*
https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX

💰 *Reembolso estimado:* ${refund_amount}

Por favor revisa que todo esté correcto y confírmanos para enviarla al IRS.

¿Tienes preguntas? Responde este mensaje.'''
        },
        'submitted_to_irs': {
            'emoji': '🚀',
            'title': 'Enviada al IRS',
            'message': '''Hola {name}!

✅ *¡Tu declaración ha sido enviada al IRS!*

📋 *Número de confirmación:* {confirmation_number}
📅 *Fecha de envío:* {submit_date}

⏱️ *¿Cuándo llega mi reembolso?*
• E-file + Depósito directo: 10-21 días
• E-file + Cheque: 4-6 semanas

Te notificaremos cuando el IRS acepte tu declaración.

¡Gracias por elegir Ross Tax! 🙏'''
        },
        'irs_accepted': {
            'emoji': '✅',
            'title': 'Aceptada por el IRS',
            'message': '''🎉 *¡Excelentes noticias, {name}!*

El IRS ha ACEPTADO tu declaración de impuestos.

💰 *Tu reembolso de ${refund_amount} está en camino!*

📅 *Fecha estimada de depósito:* {deposit_date}

Puedes verificar el estado en:
🔗 irs.gov/refunds

¡Gracias por confiar en Ross Tax! Nos vemos el próximo año. 🙌'''
        },
        'irs_rejected': {
            'emoji': '⚠️',
            'title': 'Requiere Atención',
            'message': '''Hola {name},

Tu declaración necesita una corrección antes de ser aceptada por el IRS.

📋 *Motivo:* {rejection_reason}

No te preocupes, esto es común y fácil de resolver. Un asesor te contactará en las próximas horas para ayudarte.

📞 O llámanos: (806) 922-2318'''
        },
        'payment_received': {
            'emoji': '💳',
            'title': 'Pago Recibido',
            'message': '''✅ *Pago Recibido - Ross Tax*

Hola {name}!

Hemos recibido tu pago de ${amount}.

📋 *Recibo:* #{receipt_number}
📅 *Fecha:* {payment_date}

¡Gracias por tu pago! Si tienes alguna pregunta, estamos aquí para ayudarte.'''
        }
    }
    
    async def send_status_notification(
        self, 
        user_id: str, 
        status: str, 
        extra_data: Dict = None
    ) -> Dict[str, Any]:
        """
        Send tax return status notification via WhatsApp
        
        Args:
            user_id: Client user ID
            status: One of the STATUS_MESSAGES keys
            extra_data: Additional data to fill in the message template
        """
        try:
            if status not in self.STATUS_MESSAGES:
                return {'success': False, 'error': f'Unknown status: {status}'}
            
            # Get user info
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            # Get status template
            template = self.STATUS_MESSAGES[status]
            first_name = user.get('name', 'Cliente').split()[0]
            
            # Build message with data
            message_data = {
                'name': first_name,
                'refund_amount': extra_data.get('refund_amount', '0') if extra_data else '0',
                'confirmation_number': extra_data.get('confirmation_number', 'N/A') if extra_data else 'N/A',
                'submit_date': extra_data.get('submit_date', datetime.now().strftime('%d/%m/%Y')) if extra_data else datetime.now().strftime('%d/%m/%Y'),
                'deposit_date': extra_data.get('deposit_date', 'Por confirmar') if extra_data else 'Por confirmar',
                'rejection_reason': extra_data.get('rejection_reason', 'Ver detalles en la app') if extra_data else 'Ver detalles en la app',
                'amount': extra_data.get('amount', '0') if extra_data else '0',
                'receipt_number': extra_data.get('receipt_number', 'N/A') if extra_data else 'N/A',
                'payment_date': extra_data.get('payment_date', datetime.now().strftime('%d/%m/%Y')) if extra_data else datetime.now().strftime('%d/%m/%Y'),
            }
            
            message = f"{template['emoji']} *{template['title']} - Ross Tax*\n\n"
            message += template['message'].format(**message_data)
            
            result = await self.whatsapp_service.send_message(
                to=user.get('phone'),
                message=message
            )
            
            # Log the notification
            await self._log_notification(
                user_id=user_id,
                notification_type=f'status_{status}',
                reference_id=extra_data.get('tax_return_id') if extra_data else None,
                status='sent' if result.get('success') else 'failed'
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending status notification: {e}")
            return {'success': False, 'error': str(e)}
    
    async def notify_tax_return_status_change(self, tax_return_id: str, new_status: str) -> Dict[str, Any]:
        """
        Called when a tax return status changes - sends appropriate notification
        """
        try:
            tax_return = await self.db.tax_returns.find_one({'_id': ObjectId(tax_return_id)})
            if not tax_return:
                return {'success': False, 'error': 'Tax return not found'}
            
            user_id = tax_return.get('user_id')
            
            # Map internal status to notification status
            status_mapping = {
                'documents_pending': None,  # Don't notify
                'documents_received': 'documents_received',
                'in_progress': 'in_progress',
                'pending_review': 'ready_for_review',
                'ready_for_review': 'ready_for_review',
                'approved': 'ready_for_review',
                'submitted': 'submitted_to_irs',
                'accepted': 'irs_accepted',
                'rejected': 'irs_rejected',
            }
            
            notification_status = status_mapping.get(new_status)
            if not notification_status:
                return {'success': True, 'message': 'No notification needed for this status'}
            
            extra_data = {
                'tax_return_id': tax_return_id,
                'refund_amount': tax_return.get('estimated_refund', 0),
                'confirmation_number': tax_return.get('irs_confirmation', 'Pendiente'),
                'submit_date': tax_return.get('submitted_at', datetime.now()).strftime('%d/%m/%Y') if tax_return.get('submitted_at') else datetime.now().strftime('%d/%m/%Y'),
                'rejection_reason': tax_return.get('rejection_reason', 'Ver app para detalles'),
            }
            
            return await self.send_status_notification(user_id, notification_status, extra_data)
            
        except Exception as e:
            logger.error(f"Error notifying tax return status change: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== AUTOMATION METHODS ====================

    async def send_birthday_greeting(self, user_id: str) -> Dict[str, Any]:
        """Send birthday greeting to client"""
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            name = user.get('name', user.get('full_name', '')).split()[0] if user.get('name', user.get('full_name', '')) else 'Cliente'
            
            message = f"""🎂 ¡Feliz Cumpleaños {name}! 🎉

De parte de todo el equipo de Ross Tax Preparation, te deseamos un día increíble lleno de alegría.

🎁 Como regalo especial, tienes *10% de descuento* en tu próxima declaración de impuestos.

Usa el código: *BIRTHDAY{datetime.now().year}*

¡Que cumplas muchos más! 🥳

- El equipo de Ross Tax"""

            result = await self.whatsapp_service.send_message(user['phone'], message)
            
            await self._log_notification(user_id, 'birthday_greeting', message, result.get('success', False))
            
            return {'success': True, 'message_id': result.get('message_id')}
            
        except Exception as e:
            logger.error(f"Error sending birthday greeting: {e}")
            return {'success': False, 'error': str(e)}

    async def send_tax_deadline_reminder(self, days_until_deadline: int = 30) -> Dict[str, Any]:
        """Send reminder about tax deadline to all clients"""
        try:
            clients = await self.db.users.find({'phone': {'$exists': True, '$ne': ''}}).to_list(None)
            
            sent_count = 0
            errors = []
            
            for client in clients:
                try:
                    name = client.get('full_name', '').split()[0] or 'Cliente'
                    
                    if days_until_deadline <= 7:
                        urgency = "⚠️ *URGENTE*"
                    elif days_until_deadline <= 14:
                        urgency = "⏰ *Importante*"
                    else:
                        urgency = "📅 *Recordatorio*"
                    
                    message = f"""{urgency}

Hola {name}, te recordamos que faltan solo *{days_until_deadline} días* para la fecha límite de declaración de impuestos.

📋 ¿Ya preparaste tu declaración?

Si aún no lo has hecho, agenda tu cita ahora:
📞 (806) 922-2318
📱 O responde "agendar" a este mensaje

💰 Nuestros precios:
• Individual: $180
• Con Negocio: $200

¡No te quedes sin tu reembolso! 💵

- Ross Tax Preparation"""

                    result = await self.whatsapp_service.send_message(client['phone'], message)
                    if result.get('success'):
                        sent_count += 1
                    
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    errors.append(str(e))
            
            return {
                'success': True,
                'sent_count': sent_count,
                'total_clients': len(clients),
                'errors': errors[:5] if errors else None
            }
            
        except Exception as e:
            logger.error(f"Error sending tax deadline reminders: {e}")
            return {'success': False, 'error': str(e)}

    async def send_referral_invitation(self, user_id: str, referral_code: str) -> Dict[str, Any]:
        """Send referral program invitation"""
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            name = user.get('name', user.get('full_name', '')).split()[0] if user.get('name', user.get('full_name', '')) else 'Cliente'
            
            message = f"""💰 ¡{name}, gana dinero refiriendo amigos!

Tu código de referido: *{referral_code}*

🎁 *Así funciona:*
• Comparte tu código con amigos/familia
• Cuando hagan su declaración con nosotros
• ¡Tú recibes $25 de crédito!

📲 Comparte este mensaje:
_"Hago mis taxes con Ross Tax Preparation y me ahorran mucho. Usa mi código {referral_code} y recibe $10 de descuento. Llama al (806) 922-2318"_

¡No hay límite de referidos! 🚀

- Ross Tax Preparation"""

            result = await self.whatsapp_service.send_message(user['phone'], message)
            
            return {'success': True, 'message_id': result.get('message_id')}
            
        except Exception as e:
            logger.error(f"Error sending referral invitation: {e}")
            return {'success': False, 'error': str(e)}

    async def send_new_year_promotion(self) -> Dict[str, Any]:
        """Send new year tax season promotion to all clients"""
        try:
            clients = await self.db.users.find({'phone': {'$exists': True, '$ne': ''}}).to_list(None)
            
            sent_count = 0
            current_year = datetime.now().year
            
            for client in clients:
                try:
                    name = client.get('full_name', '').split()[0] or 'Cliente'
                    
                    message = f"""🎊 ¡Feliz Año Nuevo {name}! 🎉

¡Que el {current_year} te traiga mucha prosperidad!

📋 *Nueva Temporada de Taxes*
Ya puedes preparar tu declaración del {current_year - 1}.

🎁 *PROMOCIÓN AÑO NUEVO:*
*20% de descuento* si agendas antes del 31 de enero

💰 Precios especiales:
• Individual: $180 → *$144*
• Con Negocio: $200 → *$160*

📅 Agenda ahora:
📞 (806) 922-2318
📱 Responde "agendar"

¡Te esperamos! 🌟

- Ross Tax Preparation"""

                    result = await self.whatsapp_service.send_message(client['phone'], message)
                    if result.get('success'):
                        sent_count += 1
                    
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    pass
            
            return {'success': True, 'sent_count': sent_count}
            
        except Exception as e:
            logger.error(f"Error sending new year promotion: {e}")
            return {'success': False, 'error': str(e)}

    async def send_review_request(self, user_id: str) -> Dict[str, Any]:
        """Send request for Google review after service completion"""
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            name = user.get('name', user.get('full_name', '')).split()[0] if user.get('name', user.get('full_name', '')) else 'Cliente'
            
            review_link = "https://g.page/r/rosstaxpreparation/review"
            
            message = f"""⭐ Hola {name}, ¡gracias por confiar en nosotros!

Esperamos que hayas tenido una excelente experiencia con Ross Tax Preparation.

🙏 *¿Nos ayudas con una reseña?*
Tu opinión nos ayuda a seguir mejorando y a que más personas nos conozcan.

📝 Deja tu reseña aquí:
{review_link}

¡Solo toma 1 minuto! ⏱️

Gracias por ser parte de nuestra familia de clientes. 💙

- El equipo de Ross Tax"""

            result = await self.whatsapp_service.send_message(user['phone'], message)
            
            await self._log_notification(user_id, 'review_request', message, result.get('success', False))
            
            return {'success': True, 'message_id': result.get('message_id')}
            
        except Exception as e:
            logger.error(f"Error sending review request: {e}")
            return {'success': False, 'error': str(e)}

    async def send_incomplete_appointment_followup(self) -> Dict[str, Any]:
        """Follow up with users who started but didn't complete appointment booking"""
        try:
            incomplete = await self.db.whatsapp_conversations.find({
                'current_flow': 'appointment',
                'flow_started_at': {'$lt': datetime.utcnow() - timedelta(hours=2)}
            }).to_list(None)
            
            sent_count = 0
            
            for conv in incomplete:
                try:
                    phone = conv.get('phone_number')
                    name = conv.get('user_name', '').split()[0] if conv.get('user_name') else 'Cliente'
                    
                    message = f"""👋 Hola {name}!

Noté que estabas agendando una cita con nosotros pero no la completaste.

📅 ¿Todavía necesitas agendar?

Responde:
• *"Sí"* - Para continuar agendando
• *"No"* - Si ya no lo necesitas
• *"Ayuda"* - Si tuviste algún problema

Estamos aquí para ayudarte 😊

- Ross Tax"""

                    result = await self.whatsapp_service.send_message(phone, message)
                    if result.get('success'):
                        sent_count += 1
                        
                        await self.db.whatsapp_conversations.update_one(
                            {'phone_number': phone},
                            {'$set': {
                                'current_flow': None,
                                'followup_sent_at': datetime.utcnow()
                            }}
                        )
                    
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    pass
            
            return {'success': True, 'sent_count': sent_count}
            
        except Exception as e:
            logger.error(f"Error sending incomplete appointment followup: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== MEJORA 1: CAMPAÑA DE RECUPERACIÓN ====================
    
    async def get_lost_clients(self) -> Dict[str, Any]:
        """Get clients from 2024 who did NOT return in 2025 (preview without sending)"""
        try:
            lost_clients = await self.db.season_clients.find({
                "tax_year": 2024,
                "efiled": "YES",
                "$or": [
                    {"efiled_2025": {"$exists": False}},
                    {"efiled_2025": None},
                    {"efiled_2025": "NO"}
                ]
            }).to_list(None)
            
            clients_with_phone = []
            clients_without_phone = []
            
            for c in lost_clients:
                phone = c.get('phone', c.get('phone_number', ''))
                name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()
                info = {
                    'name': name,
                    'phone': phone,
                    'email': c.get('email', ''),
                    'last_service': '2024'
                }
                if phone and len(phone) >= 10:
                    clients_with_phone.append(info)
                else:
                    clients_without_phone.append(info)
            
            return {
                'success': True,
                'total_lost': len(lost_clients),
                'with_phone': len(clients_with_phone),
                'without_phone': len(clients_without_phone),
                'clients': clients_with_phone[:20]  # Preview first 20
            }
            
        except Exception as e:
            logger.error(f"Error getting lost clients: {e}")
            return {'success': False, 'error': str(e)}

    async def send_recovery_campaign(self, dry_run: bool = True) -> Dict[str, Any]:
        """Send recovery messages to 2024 clients who haven't returned in 2025"""
        try:
            lost_clients = await self.db.season_clients.find({
                "tax_year": 2024,
                "efiled": "YES",
                "$or": [
                    {"efiled_2025": {"$exists": False}},
                    {"efiled_2025": None},
                    {"efiled_2025": "NO"}
                ]
            }).to_list(None)
            
            sent_count = 0
            skipped = 0
            errors = []
            
            for c in lost_clients:
                phone = c.get('phone', c.get('phone_number', ''))
                if not phone or len(phone) < 10:
                    skipped += 1
                    continue
                
                # Normalize phone
                if not phone.startswith('+'):
                    phone = f"+1{phone}" if not phone.startswith('1') else f"+{phone}"
                
                first_name = c.get('first_name', '').strip().title() or 'Cliente'
                
                message = f"""👋 ¡Hola {first_name}!

Te escribimos de *Ross Tax Preparation*. El año pasado nos confiaste tu declaración de impuestos y queremos asegurarnos de que no te pierdas tu reembolso este año.

📅 *La fecha límite se acerca* — ¿Ya presentaste tus taxes del 2025?

🎁 *Oferta especial para clientes que regresan:*
• *$20 de descuento* en tu declaración
• Cita prioritaria sin espera

📞 Agenda ahora:
• Llama al (806) 922-2318
• Responde *"agendar"* a este mensaje
• Visítanos: 305 Bruce Ave, Dumas, TX

¡Te esperamos de vuelta! 💙

_Si ya presentaste tus taxes, ignora este mensaje._

- Ross Tax Preparation"""

                if dry_run:
                    sent_count += 1
                else:
                    try:
                        result = await self.whatsapp_service.send_message(phone, message)
                        if result.get('success'):
                            sent_count += 1
                            # Mark as contacted
                            await self.db.season_clients.update_one(
                                {'_id': c['_id']},
                                {'$set': {
                                    'recovery_contacted_at': datetime.utcnow(),
                                    'recovery_channel': 'whatsapp'
                                }}
                            )
                        else:
                            errors.append(f"{phone}: {result.get('error', 'unknown')}")
                    except Exception as e:
                        errors.append(f"{phone}: {str(e)[:50]}")
                    
                    await asyncio.sleep(1)  # Rate limiting
            
            return {
                'success': True,
                'dry_run': dry_run,
                'total_lost': len(lost_clients),
                'sent_count': sent_count,
                'skipped_no_phone': skipped,
                'errors': errors[:10] if errors else []
            }
            
        except Exception as e:
            logger.error(f"Error in recovery campaign: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== MEJORA 2: SOLICITAR RESEÑA GOOGLE ====================
    
    async def send_review_request(self, user_id: str) -> Dict[str, Any]:
        """Send request for Google review after service completion"""
        try:
            user = await self._find_user(user_id)
            if not user or not user.get('phone'):
                return {'success': False, 'error': 'User or phone not found'}
            
            name = user.get('name', user.get('full_name', '')).split()[0] if user.get('name', user.get('full_name', '')) else 'Cliente'
            phone = user.get('phone', '')
            if not phone.startswith('+'):
                phone = f"+1{phone}" if not phone.startswith('1') else f"+{phone}"
            
            review_link = "https://g.page/r/CWVj-xC8_S8hEBM/review"
            
            message = f"""⭐ Hola {name}, ¡gracias por confiar en nosotros!

Esperamos que hayas tenido una excelente experiencia con Ross Tax Preparation.

🙏 *¿Nos ayudas con una reseña?*
Tu opinión nos ayuda a seguir mejorando y a que más personas nos conozcan.

📝 Deja tu reseña aquí:
{review_link}

¡Solo toma 1 minuto! ⏱️

Gracias por ser parte de nuestra familia de clientes. 💙

- El equipo de Ross Tax"""

            result = await self.whatsapp_service.send_message(phone, message)
            
            if result.get('success'):
                await self._log_notification(user_id, 'review_request', message, True)
            
            return {'success': result.get('success', False), 'message_id': result.get('message_id')}
            
        except Exception as e:
            logger.error(f"Error sending review request: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== MEJORA 3: SEGMENTACIÓN INTELIGENTE ====================
    
    async def send_segmented_campaign(self, segment: str, message_template: str = None, dry_run: bool = True) -> Dict[str, Any]:
        """Send targeted campaign to a specific client segment.
        
        Segments:
        - 'business': Clients with business tax returns
        - 'individual': Personal returns only
        - 'high_value': Returns > $200
        - 'new_2025': New clients in 2025 (not in 2024)
        - 'returning': Clients who returned from 2024 to 2025
        """
        try:
            query = {}
            default_msg = ""
            
            if segment == 'business':
                query = {"service_type": {"$regex": "negocio|business|schedule_c", "$options": "i"}}
                default_msg = """📊 ¡Hola {name}! Como dueño de negocio, recuerda que puedes deducir más gastos este año.

🧾 Trae tus recibos de:
• Materiales y suministros
• Gasolina y mantenimiento de vehículo
• Herramientas y equipo
• Seguro de negocio

💰 ¡Maximiza tu reembolso! Agenda: (806) 922-2318"""

            elif segment == 'individual':
                query = {"$or": [
                    {"service_type": {"$regex": "personal|individual", "$options": "i"}},
                    {"service_type": {"$exists": False}}
                ]}
                default_msg = """💵 ¡Hola {name}! ¿Sabías que podrías obtener más reembolso?

📋 Verifica si calificas para:
• Crédito por hijos (hasta $2,000 por hijo)
• Crédito Earned Income (EITC)
• Créditos de educación

📞 Agenda tu consulta: (806) 922-2318 o responde "agendar" """

            elif segment == 'high_value':
                # Find clients with invoices > $200
                high_value_invs = await self.db.invoices.find({
                    "total": {"$gt": 200},
                    "status": "paid"
                }).to_list(None)
                user_ids = list(set([inv.get('user_id') for inv in high_value_invs if inv.get('user_id')]))
                query = {"_id": {"$in": user_ids}} if user_ids else {"_id": "none"}
                default_msg = """🌟 ¡Hola {name}! Como cliente VIP, tienes beneficios exclusivos.

🎁 Este año recibes:
• Revisión prioritaria de tu declaración
• Consulta gratuita de planificación fiscal
• 15% de descuento en servicios adicionales

📞 (806) 922-2318"""

            elif segment == 'new_2025':
                query = {"source": "import_2025_season", "efiled_2025": "YES"}
                default_msg = """🎉 ¡Hola {name}! Bienvenido a la familia Ross Tax.

Gracias por confiar en nosotros con tus impuestos. 

📱 ¿Ya descargaste nuestra app? Puedes:
• Ver el estado de tu declaración
• Guardar documentos
• Agendar citas

🎁 Refiere a un amigo y gana $25 de crédito.

- Ross Tax Preparation"""

            elif segment == 'returning':
                query = {"tax_year": 2024, "efiled": "YES", "efiled_2025": "YES"}
                default_msg = """💙 ¡Hola {name}! Gracias por regresar con nosotros.

Tu lealtad es muy importante para nosotros. Como agradecimiento:

🎁 *$15 de descuento* en tu próxima declaración.
Código: *LEAL2025*

📞 (806) 922-2318"""
            
            else:
                return {'success': False, 'error': f'Unknown segment: {segment}. Valid: business, individual, high_value, new_2025, returning'}
            
            msg_template = message_template or default_msg
            
            # Get clients from season_clients or users depending on segment
            if segment in ['new_2025', 'returning', 'business', 'individual']:
                clients = await self.db.season_clients.find(query).to_list(None)
            else:
                clients = await self.db.users.find(query).to_list(None)
            
            sent_count = 0
            skipped = 0
            
            for c in clients:
                phone = c.get('phone', c.get('phone_number', ''))
                if not phone or len(phone) < 10:
                    skipped += 1
                    continue
                
                if not phone.startswith('+'):
                    phone = f"+1{phone}" if not phone.startswith('1') else f"+{phone}"
                
                first_name = c.get('name', c.get('first_name', '')).strip().split()[0] if c.get('name', c.get('first_name', '')) else 'Cliente'
                
                message = msg_template.replace('{name}', first_name)
                
                if dry_run:
                    sent_count += 1
                else:
                    try:
                        result = await self.whatsapp_service.send_message(phone, message)
                        if result.get('success'):
                            sent_count += 1
                        await asyncio.sleep(1)
                    except:
                        pass
            
            return {
                'success': True,
                'segment': segment,
                'dry_run': dry_run,
                'total_in_segment': len(clients),
                'would_send': sent_count,
                'skipped_no_phone': skipped
            }
            
        except Exception as e:
            logger.error(f"Error in segmented campaign: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== MEJORA 4: CRON RECORDATORIOS AUTOMÁTICOS ====================
    
    async def auto_daily_reminders(self) -> Dict[str, Any]:
        """Automated daily job: Send appointment reminders for tomorrow and in 1 hour"""
        try:
            results = {
                'reminders_24h': 0,
                'reminders_1h': 0,
                'review_requests': 0,
                'incomplete_followups': 0,
                'errors': []
            }
            
            now = datetime.utcnow()
            tomorrow = now + timedelta(days=1)
            tomorrow_str = tomorrow.strftime('%Y-%m-%d')
            
            # 1. Send 24h reminders for tomorrow's appointments
            tomorrow_apts = await self.db.appointments.find({
                'date': tomorrow_str,
                'status': {'$in': ['scheduled', 'confirmed']},
                'reminder_24h_sent': {'$ne': True}
            }).to_list(None)
            
            for apt in tomorrow_apts:
                phone = apt.get('client_phone', apt.get('phone_number', ''))
                if not phone:
                    continue
                if not phone.startswith('+'):
                    phone = f"+1{phone}" if not phone.startswith('1') else f"+{phone}"
                
                name = apt.get('client_name', '').split()[0] if apt.get('client_name') else 'Cliente'
                time_str = apt.get('time', '10:00')
                
                message = f"""📅 *Recordatorio de Cita*

Hola {name}, te recordamos que mañana tienes cita:

⏰ Hora: {time_str}
📍 Lugar: 305 Bruce Ave, Dumas, TX 79029

*No olvides traer:*
• Identificación oficial
• W-2 de todos los empleos
• Seguro Social de todos los dependientes

📞 ¿Necesitas cambiar tu cita? Llama al (806) 922-2318

¡Te esperamos! 😊"""

                try:
                    result = await self.whatsapp_service.send_message(phone, message)
                    if result.get('success'):
                        results['reminders_24h'] += 1
                        await self.db.appointments.update_one(
                            {'_id': apt['_id']},
                            {'$set': {'reminder_24h_sent': True, 'reminder_24h_at': datetime.utcnow()}}
                        )
                    await asyncio.sleep(0.5)
                except Exception as e:
                    results['errors'].append(str(e)[:50])
            
            # 2. Send 1h reminders for appointments in the next hour
            one_hour = now + timedelta(hours=1)
            today_str = now.strftime('%Y-%m-%d')
            current_time = now.strftime('%H:%M')
            one_hour_time = one_hour.strftime('%H:%M')
            
            soon_apts = await self.db.appointments.find({
                'date': today_str,
                'time': {'$gte': current_time, '$lte': one_hour_time},
                'status': {'$in': ['scheduled', 'confirmed']},
                'reminder_1h_sent': {'$ne': True}
            }).to_list(None)
            
            for apt in soon_apts:
                phone = apt.get('client_phone', apt.get('phone_number', ''))
                if not phone:
                    continue
                if not phone.startswith('+'):
                    phone = f"+1{phone}" if not phone.startswith('1') else f"+{phone}"
                
                name = apt.get('client_name', '').split()[0] if apt.get('client_name') else 'Cliente'
                
                message = f"""⏰ ¡{name}, tu cita es en 1 hora!

📍 305 Bruce Ave, Dumas, TX 79029
🕐 {apt.get('time', '')}

¡Te esperamos! 👋"""

                try:
                    result = await self.whatsapp_service.send_message(phone, message)
                    if result.get('success'):
                        results['reminders_1h'] += 1
                        await self.db.appointments.update_one(
                            {'_id': apt['_id']},
                            {'$set': {'reminder_1h_sent': True, 'reminder_1h_at': datetime.utcnow()}}
                        )
                    await asyncio.sleep(0.5)
                except Exception as e:
                    results['errors'].append(str(e)[:50])
            
            # 3. Follow up incomplete appointment flows (>2 hours old)
            followup_result = await self.send_incomplete_appointment_followup()
            results['incomplete_followups'] = followup_result.get('sent_count', 0)
            
            return {
                'success': True,
                'timestamp': datetime.utcnow().isoformat(),
                **results
            }
            
        except Exception as e:
            logger.error(f"Error in auto daily reminders: {e}")
            return {'success': False, 'error': str(e)}


# Global instance
whatsapp_automation = None

def get_whatsapp_automation():
    return whatsapp_automation

def init_whatsapp_automation(db, whatsapp_service):
    global whatsapp_automation
    whatsapp_automation = WhatsAppAutomationService(db, whatsapp_service)
    logger.info("✅ WhatsApp Automation Service initialized")
    return whatsapp_automation

