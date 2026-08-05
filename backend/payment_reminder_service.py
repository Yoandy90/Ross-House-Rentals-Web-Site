"""
Payment Reminder Service - Ross House Rentals
==============================================
Automated rent payment reminders via Push Notifications.
Runs as a scheduled task to remind tenants of upcoming payments.
"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class PaymentReminderService:
    """Service for automated payment reminders"""
    
    def __init__(self, db, push_service):
        self.db = db
        self.push_service = push_service
        self.is_running = False
        logger.info("✅ Payment Reminder Service initialized")
    
    async def get_tenants_with_pending_payments(self) -> List[Dict]:
        """Get tenants who have pending or upcoming rent payments"""
        try:
            # Get all active contracts with rent due
            today = datetime.utcnow()
            first_of_month = today.replace(day=1)
            
            # Find tenants with unpaid rent this month
            tenants = await self.db.users.find({
                "role": "tenant",
                "is_active": True,
                "push_token": {"$exists": True, "$ne": ""}
            }).to_list(500)
            
            results = []
            for tenant in tenants:
                # Check if they have a payment this month
                payment = await self.db.payments.find_one({
                    "tenant_id": str(tenant["_id"]),
                    "payment_type": "rent",
                    "created_at": {"$gte": first_of_month}
                })
                
                # If no payment found this month, add to reminder list
                if not payment:
                    # Get their contract info
                    contract = await self.db.contracts.find_one({
                        "tenant_id": str(tenant["_id"]),
                        "status": "active"
                    })
                    
                    if contract:
                        results.append({
                            "tenant_id": str(tenant["_id"]),
                            "name": f"{tenant.get('first_name', '')} {tenant.get('last_name', '')}".strip(),
                            "email": tenant.get("email"),
                            "phone": tenant.get("phone"),
                            "push_token": tenant.get("push_token"),
                            "rent_amount": contract.get("monthly_rent", 0),
                            "property_name": contract.get("property_name", ""),
                            "due_date": first_of_month.strftime("%Y-%m-%d"),
                        })
            
            return results
        except Exception as e:
            logger.error(f"Error getting tenants with pending payments: {e}")
            return []
    
    async def send_payment_reminder(self, tenant: Dict, reminder_type: str = "upcoming") -> bool:
        """Send payment reminder to a tenant"""
        try:
            push_token = tenant.get("push_token")
            if not push_token:
                return False
            
            name = tenant.get("name", "Inquilino")
            rent_amount = tenant.get("rent_amount", 0)
            property_name = tenant.get("property_name", "su propiedad")
            
            # Different messages based on reminder type
            messages = {
                "upcoming": {
                    "title": "🏠 Recordatorio de Renta",
                    "body": f"Hola {name}! Su pago de renta de ${rent_amount:,.0f} para {property_name} vence pronto. Pague a tiempo para evitar cargos por retraso.",
                },
                "due_today": {
                    "title": "⚠️ Renta Vence Hoy",
                    "body": f"Su pago de renta de ${rent_amount:,.0f} para {property_name} vence HOY. Realice su pago antes de medianoche.",
                },
                "overdue": {
                    "title": "🚨 Pago Atrasado",
                    "body": f"Su pago de renta de ${rent_amount:,.0f} está atrasado. Por favor pague lo antes posible para evitar acciones adicionales.",
                },
                "inspection_pending": {
                    "title": "📋 Inspección Pendiente",
                    "body": "Tiene una inspección de propiedad pendiente de firmar. Por favor revise y firme en la app.",
                },
            }
            
            msg = messages.get(reminder_type, messages["upcoming"])
            
            result = await self.push_service.send_push_notification(
                tokens=[push_token],
                title=msg["title"],
                body=msg["body"],
                data={
                    "type": "payment_reminder",
                    "reminder_type": reminder_type,
                    "tenant_id": tenant.get("tenant_id"),
                    "screen": "/pay/rent",
                }
            )
            
            # Log the reminder
            await self.db.payment_reminders.insert_one({
                "tenant_id": tenant.get("tenant_id"),
                "tenant_name": name,
                "reminder_type": reminder_type,
                "rent_amount": rent_amount,
                "property_name": property_name,
                "sent_at": datetime.utcnow(),
                "success": result.get("success", False),
                "push_result": result,
            })
            
            logger.info(f"📱 Payment reminder sent to {name}: {reminder_type}")
            return result.get("success", False)
            
        except Exception as e:
            logger.error(f"Error sending payment reminder: {e}")
            return False
    
    async def send_inspection_reminders(self) -> Dict:
        """Send reminders to tenants with pending inspection signatures"""
        try:
            # Find inspections pending tenant signature
            pending_inspections = await self.db.inspections.find({
                "status": {"$in": ["pending", "in_progress"]},
                "admin_signature": {"$exists": True, "$ne": None},
                "tenant_signature": {"$exists": False}
            }).to_list(100)
            
            sent = 0
            failed = 0
            
            for inspection in pending_inspections:
                tenant_id = inspection.get("tenant_id")
                if not tenant_id:
                    continue
                
                from bson import ObjectId
                tenant = await self.db.users.find_one({"_id": ObjectId(tenant_id)})
                if not tenant or not tenant.get("push_token"):
                    continue
                
                result = await self.send_payment_reminder(
                    {
                        "tenant_id": tenant_id,
                        "name": f"{tenant.get('first_name', '')} {tenant.get('last_name', '')}".strip(),
                        "push_token": tenant.get("push_token"),
                        "property_name": inspection.get("property_name", ""),
                    },
                    reminder_type="inspection_pending"
                )
                
                if result:
                    sent += 1
                else:
                    failed += 1
            
            return {"sent": sent, "failed": failed}
            
        except Exception as e:
            logger.error(f"Error sending inspection reminders: {e}")
            return {"sent": 0, "failed": 0, "error": str(e)}
    
    async def run_payment_reminders(self) -> Dict:
        """Run the payment reminder batch job"""
        try:
            today = datetime.utcnow()
            day = today.day
            
            results = {
                "upcoming": {"sent": 0, "failed": 0},
                "due_today": {"sent": 0, "failed": 0},
                "overdue": {"sent": 0, "failed": 0},
                "total_tenants": 0,
            }
            
            tenants = await self.get_tenants_with_pending_payments()
            results["total_tenants"] = len(tenants)
            
            for tenant in tenants:
                # Determine reminder type based on day of month
                if day <= 25:
                    # Early reminder (25th of previous month or earlier)
                    reminder_type = "upcoming"
                elif day <= 28:
                    # Late reminder approaching due date
                    reminder_type = "upcoming"
                elif day == 1:
                    # Due today
                    reminder_type = "due_today"
                else:
                    # Overdue (after the 1st)
                    reminder_type = "overdue"
                
                success = await self.send_payment_reminder(tenant, reminder_type)
                
                if success:
                    results[reminder_type]["sent"] += 1
                else:
                    results[reminder_type]["failed"] += 1
            
            # Also send inspection reminders
            inspection_results = await self.send_inspection_reminders()
            results["inspection_reminders"] = inspection_results
            
            logger.info(f"📊 Payment reminders complete: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error running payment reminders: {e}")
            return {"error": str(e)}
    
    async def start_scheduler(self, interval_hours: int = 24):
        """Start the reminder scheduler (runs daily)"""
        if self.is_running:
            logger.warning("Payment reminder scheduler already running")
            return
        
        self.is_running = True
        logger.info(f"🔔 Starting Payment Reminder Scheduler (every {interval_hours}h)")
        
        while self.is_running:
            try:
                # Run at 10 AM local time
                now = datetime.utcnow()
                if now.hour == 16:  # 10 AM CST = 16 UTC
                    results = await self.run_payment_reminders()
                    logger.info(f"📊 Daily payment reminders: {results}")
                
                # Wait 1 hour before next check
                await asyncio.sleep(3600)
                
            except Exception as e:
                logger.error(f"Error in payment reminder scheduler: {e}")
                await asyncio.sleep(60)  # Wait a minute on error
    
    def stop_scheduler(self):
        """Stop the reminder scheduler"""
        self.is_running = False
        logger.info("🛑 Payment Reminder Scheduler stopped")


# Global instance
payment_reminder_service: Optional[PaymentReminderService] = None


def init_payment_reminder_service(db, push_service) -> PaymentReminderService:
    """Initialize the payment reminder service"""
    global payment_reminder_service
    payment_reminder_service = PaymentReminderService(db, push_service)
    return payment_reminder_service


def get_payment_reminder_service() -> Optional[PaymentReminderService]:
    """Get the payment reminder service instance"""
    return payment_reminder_service
