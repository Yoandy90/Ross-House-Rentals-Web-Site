"""
Tax Wizard Reminder Service
Sends automatic reminders to users with incomplete wizard sessions
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

class TaxWizardReminderService:
    """Service for sending wizard completion reminders"""
    
    def __init__(self, db):
        self.db = db
        self.sendgrid_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = "noreply@rosstaxpreparation.com"
        self.from_name = "Ross Tax - Mi Reembolso"
    
    async def get_incomplete_sessions(self, hours_since_update: int = 24, limit: int = 100) -> List[dict]:
        """Get sessions that haven't been updated in X hours and are incomplete"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_since_update)
        
        incomplete_sessions = await self.db["tax_wizard_sessions"].find({
            "status": {"$in": ["in_progress", "started"]},
            "updated_at": {"$lt": cutoff_time},
            "reminder_sent_at": {"$exists": False}  # Haven't sent reminder yet
        }).limit(limit).to_list(limit)
        
        return incomplete_sessions
    
    async def get_sessions_needing_reminder(self, reminder_type: str = "24h") -> List[dict]:
        """
        Get sessions needing a specific reminder type
        reminder_type: "24h", "48h", "7d"
        """
        now = datetime.utcnow()
        
        if reminder_type == "24h":
            min_time = now - timedelta(hours=48)
            max_time = now - timedelta(hours=24)
            reminder_field = "reminder_24h_sent"
        elif reminder_type == "48h":
            min_time = now - timedelta(hours=96)
            max_time = now - timedelta(hours=48)
            reminder_field = "reminder_48h_sent"
        elif reminder_type == "7d":
            min_time = now - timedelta(days=14)
            max_time = now - timedelta(days=7)
            reminder_field = "reminder_7d_sent"
        else:
            return []
        
        sessions = await self.db["tax_wizard_sessions"].find({
            "status": {"$in": ["in_progress", "started"]},
            "updated_at": {"$gte": min_time, "$lt": max_time},
            reminder_field: {"$ne": True}
        }).to_list(100)
        
        return sessions
    
    def _get_reminder_content(self, session: dict, reminder_type: str) -> dict:
        """Get email content based on reminder type"""
        personal_info = session.get("personal_info", {})
        first_name = personal_info.get("first_name", "Cliente")
        progress = session.get("progress_percentage", 0)
        refund_estimate = session.get("refund_estimate", {})
        estimated_refund = refund_estimate.get("estimated_refund", 0)
        
        if reminder_type == "24h":
            subject = f"💰 {first_name}, ¡tu reembolso te espera!"
            preview = f"Estás al {progress}% de completar tu declaración"
            message = f"""
            <p>Hola {first_name},</p>
            
            <p>Notamos que empezaste tu declaración de impuestos pero aún no la has terminado.</p>
            
            <p><strong>Tu progreso actual: {progress}%</strong></p>
            
            {f'<p style="font-size: 24px; color: #10B981;"><strong>Reembolso estimado: ${estimated_refund:,.2f}</strong></p>' if estimated_refund > 0 else ''}
            
            <p>¡No dejes pasar la oportunidad de recibir tu reembolso! Solo te toma unos minutos más completar tu declaración.</p>
            
            <p><a href="https://rosstaxpreparation.com/tax-wizard" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Continuar Mi Declaración</a></p>
            """
            
        elif reminder_type == "48h":
            subject = f"⏰ {first_name}, tu declaración está esperando"
            preview = f"No pierdas tu progreso - Complétala hoy"
            message = f"""
            <p>Hola {first_name},</p>
            
            <p>Han pasado 2 días desde que iniciaste tu declaración de impuestos con Mi Reembolso.</p>
            
            <p>Tu información está guardada y lista para continuar:</p>
            <ul>
                <li>Progreso: {progress}%</li>
                <li>Información ya ingresada segura</li>
                {f'<li>Reembolso estimado: ${estimated_refund:,.2f}</li>' if estimated_refund > 0 else ''}
            </ul>
            
            <p>La temporada de impuestos termina pronto. ¡Asegura tu reembolso ahora!</p>
            
            <p><a href="https://rosstaxpreparation.com/tax-wizard" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Completar Ahora</a></p>
            
            <p style="color: #666; font-size: 12px;">¿Necesitas ayuda? Llámanos al (806) 934-2018</p>
            """
            
        else:  # 7d
            subject = f"📋 {first_name}, última oportunidad para tu reembolso"
            preview = f"Tu declaración sigue esperándote"
            message = f"""
            <p>Hola {first_name},</p>
            
            <p>Ha pasado una semana desde que comenzaste tu declaración. Queremos asegurarnos de que no pierdas tu reembolso.</p>
            
            {f'<p style="font-size: 20px;"><strong>Tienes ${estimated_refund:,.2f} esperándote</strong></p>' if estimated_refund > 0 else ''}
            
            <p>Entendemos que la vida es ocupada. Por eso hemos guardado toda tu información para que puedas continuar exactamente donde lo dejaste.</p>
            
            <p><strong>¿Prefieres ayuda personalizada?</strong> Agenda una cita con uno de nuestros preparadores y te ayudamos a completar tu declaración.</p>
            
            <p>
                <a href="https://rosstaxpreparation.com/tax-wizard" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-right: 10px;">Continuar Online</a>
                <a href="tel:+18069342018" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Llamar Ahora</a>
            </p>
            """
        
        return {
            "subject": subject,
            "preview": preview,
            "message": message
        }
    
    async def send_reminder_email(self, session: dict, reminder_type: str) -> bool:
        """Send a reminder email for a session"""
        if not self.sendgrid_key:
            logger.warning("SendGrid not configured, skipping reminder")
            return False
        
        # Get user email
        user_id = session.get("user_id")
        user = await self.db["users"].find_one({"_id": ObjectId(user_id)})
        
        if not user or not user.get("email"):
            logger.warning(f"No email found for user {user_id}")
            return False
        
        email_address = user.get("email")
        content = self._get_reminder_content(session, reminder_type)
        
        try:
            sg = SendGridAPIClient(self.sendgrid_key)
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #065F46;">💰 Mi Reembolso</h1>
                    <p style="color: #666;">by Ross Tax Preparation</p>
                </div>
                
                {content['message']}
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <div style="text-align: center; color: #666; font-size: 12px;">
                    <p>Ross Tax Preparation<br>
                    305 Bruce Ave, Dumas, TX 79029<br>
                    (806) 934-2018</p>
                    <p><a href="https://rosstaxpreparation.com/unsubscribe" style="color: #999;">Cancelar suscripción</a></p>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(email_address),
                subject=content["subject"],
                html_content=Content("text/html", html_content)
            )
            
            response = sg.send(message)
            
            if response.status_code in [200, 201, 202]:
                # Mark reminder as sent
                reminder_field = f"reminder_{reminder_type}_sent"
                await self.db["tax_wizard_sessions"].update_one(
                    {"_id": session["_id"]},
                    {"$set": {
                        reminder_field: True,
                        f"reminder_{reminder_type}_sent_at": datetime.utcnow()
                    }}
                )
                
                logger.info(f"✅ Sent {reminder_type} reminder to {email_address} for session {session['_id']}")
                return True
            else:
                logger.error(f"Failed to send reminder: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending reminder email: {e}")
            return False
    
    async def run_reminder_job(self) -> dict:
        """Run the reminder job - call this from a scheduler"""
        results = {
            "24h": {"sent": 0, "failed": 0},
            "48h": {"sent": 0, "failed": 0},
            "7d": {"sent": 0, "failed": 0}
        }
        
        for reminder_type in ["24h", "48h", "7d"]:
            sessions = await self.get_sessions_needing_reminder(reminder_type)
            
            for session in sessions:
                success = await self.send_reminder_email(session, reminder_type)
                if success:
                    results[reminder_type]["sent"] += 1
                else:
                    results[reminder_type]["failed"] += 1
        
        total_sent = sum(r["sent"] for r in results.values())
        logger.info(f"📧 Reminder job complete: {total_sent} emails sent")
        
        return results
    
    async def get_reminder_stats(self) -> dict:
        """Get statistics about reminders sent"""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        
        # Count reminders sent today
        today_24h = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_24h_sent_at": {"$gte": today_start}
        })
        today_48h = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_48h_sent_at": {"$gte": today_start}
        })
        today_7d = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_7d_sent_at": {"$gte": today_start}
        })
        
        # Count reminders sent this week
        week_24h = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_24h_sent_at": {"$gte": week_start}
        })
        week_48h = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_48h_sent_at": {"$gte": week_start}
        })
        week_7d = await self.db["tax_wizard_sessions"].count_documents({
            "reminder_7d_sent_at": {"$gte": week_start}
        })
        
        # Count incomplete sessions
        incomplete = await self.db["tax_wizard_sessions"].count_documents({
            "status": {"$in": ["in_progress", "started"]}
        })
        
        return {
            "today": {
                "24h": today_24h,
                "48h": today_48h,
                "7d": today_7d,
                "total": today_24h + today_48h + today_7d
            },
            "this_week": {
                "24h": week_24h,
                "48h": week_48h,
                "7d": week_7d,
                "total": week_24h + week_48h + week_7d
            },
            "incomplete_sessions": incomplete
        }


# Global instance
reminder_service: Optional[TaxWizardReminderService] = None

def init_reminder_service(db):
    global reminder_service
    reminder_service = TaxWizardReminderService(db)
    logger.info("✅ Tax Wizard Reminder Service initialized")
    return reminder_service
