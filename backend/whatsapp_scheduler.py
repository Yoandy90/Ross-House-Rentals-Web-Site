"""
WhatsApp Scheduler - Cron Jobs for automated reminders
Runs appointment reminders at scheduled intervals
"""
import asyncio
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

scheduler = None
db_instance = None
wa_automation_instance = None


async def run_appointment_reminders_job():
    """Job to send appointment reminders (24h and 1h before)"""
    try:
        if not wa_automation_instance:
            logger.warning("WhatsApp automation not available for scheduler")
            return
        
        logger.info("🕐 Running scheduled appointment reminders...")
        
        pending = await wa_automation_instance.get_pending_reminders()
        
        results = {
            '24h_sent': 0,
            '24h_failed': 0,
            '1h_sent': 0,
            '1h_failed': 0
        }
        
        # Process 24h reminders
        for appt in pending.get('24h', []):
            appt_id = str(appt.get('_id', appt.get('id')))
            result = await wa_automation_instance.send_appointment_reminder(appt_id, hours_before=24)
            
            if result.get('success'):
                results['24h_sent'] += 1
                await db_instance.appointments.update_one(
                    {'_id': appt['_id']},
                    {'$set': {'reminder_24h_sent': True}}
                )
            else:
                results['24h_failed'] += 1
        
        # Process 1h reminders
        for appt in pending.get('1h', []):
            appt_id = str(appt.get('_id', appt.get('id')))
            result = await wa_automation_instance.send_appointment_reminder(appt_id, hours_before=1)
            
            if result.get('success'):
                results['1h_sent'] += 1
                await db_instance.appointments.update_one(
                    {'_id': appt['_id']},
                    {'$set': {'reminder_1h_sent': True}}
                )
            else:
                results['1h_failed'] += 1
        
        logger.info(f"✅ Appointment reminders completed: 24h={results['24h_sent']}/{results['24h_sent']+results['24h_failed']}, 1h={results['1h_sent']}/{results['1h_sent']+results['1h_failed']}")
        
        # Log job run
        await db_instance.scheduler_logs.insert_one({
            'job_name': 'appointment_reminders',
            'run_at': datetime.utcnow(),
            'results': results,
            'status': 'completed'
        })
        
    except Exception as e:
        logger.error(f"❌ Error in appointment reminders job: {str(e)}")
        if db_instance:
            await db_instance.scheduler_logs.insert_one({
                'job_name': 'appointment_reminders',
                'run_at': datetime.utcnow(),
                'error': str(e),
                'status': 'failed'
            })


async def run_payment_reminders_job():
    """Job to send payment reminders for overdue invoices"""
    try:
        if not wa_automation_instance or not db_instance:
            logger.warning("Services not available for payment reminders")
            return
        
        logger.info("💰 Running scheduled payment reminders...")
        
        now = datetime.utcnow()
        
        # Get overdue invoices (not reminded in last 3 days)
        three_days_ago = now - timedelta(days=3)
        
        pending_invoices = await db_instance.invoices.find({
            'status': {'$in': ['pending', 'overdue']},
            'due_date': {'$lt': now},
            '$or': [
                {'last_payment_reminder': {'$lt': three_days_ago}},
                {'last_payment_reminder': {'$exists': False}}
            ]
        }).limit(50).to_list(50)
        
        results = {'sent': 0, 'failed': 0}
        
        for invoice in pending_invoices:
            invoice_id = str(invoice['_id'])
            result = await wa_automation_instance.send_invoice_created(invoice_id)
            
            if result.get('success'):
                results['sent'] += 1
                await db_instance.invoices.update_one(
                    {'_id': invoice['_id']},
                    {'$set': {'last_payment_reminder': now, 'status': 'overdue'}}
                )
            else:
                results['failed'] += 1
        
        logger.info(f"✅ Payment reminders completed: {results['sent']} sent, {results['failed']} failed")
        
        await db_instance.scheduler_logs.insert_one({
            'job_name': 'payment_reminders',
            'run_at': datetime.utcnow(),
            'results': results,
            'status': 'completed'
        })
        
    except Exception as e:
        logger.error(f"❌ Error in payment reminders job: {str(e)}")


async def run_daily_backup_job():
    """Job to create daily database backup stored in the database itself"""
    try:
        if not db_instance:
            logger.warning("Database not available for backup")
            return

        logger.info("💾 Running scheduled daily backup...")

        backup_data = {
            'backup_date': datetime.utcnow(),
            'type': 'automatic',
            'collections': {},
            'counts': {},
            'status': 'in_progress'
        }

        # Critical collections to backup
        critical_collections = [
            'users', 'clients', 'appointments', 'invoices', 'tax_returns',
            'dynamic_services', 'payment_methods', 'vault_customers',
            'subscriptions', 'referral_codes', 'client_banking',
            'notification_templates', 'office_hours', 'appointment_types',
            'whatsapp_settings', 'feature_flags'
        ]

        for col_name in critical_collections:
            try:
                collection = db_instance[col_name]
                docs = await collection.find({}).to_list(10000)
                # Convert ObjectIds to strings for JSON compatibility
                for doc in docs:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])
                backup_data['collections'][col_name] = docs
                backup_data['counts'][col_name] = len(docs)
            except Exception as e:
                logger.error(f"Error backing up {col_name}: {e}")
                backup_data['counts'][col_name] = f"ERROR: {str(e)}"

        backup_data['status'] = 'completed'
        backup_data['completed_at'] = datetime.utcnow()

        # Store backup in database
        await db_instance.automated_backups.insert_one(backup_data)

        # Keep only last 30 backups
        backup_count = await db_instance.automated_backups.count_documents({})
        if backup_count > 30:
            oldest = await db_instance.automated_backups.find().sort('backup_date', 1).limit(backup_count - 30).to_list(backup_count - 30)
            for old in oldest:
                await db_instance.automated_backups.delete_one({'_id': old['_id']})

        total_docs = sum(v for v in backup_data['counts'].values() if isinstance(v, int))
        logger.info(f"✅ Daily backup completed: {len(critical_collections)} collections, {total_docs} total documents")

        await db_instance.scheduler_logs.insert_one({
            'job_name': 'daily_backup',
            'run_at': datetime.utcnow(),
            'results': {'collections': len(critical_collections), 'total_docs': total_docs},
            'status': 'completed'
        })

    except Exception as e:
        logger.error(f"❌ Error in daily backup job: {str(e)}")


def init_scheduler(db: AsyncIOMotorDatabase, wa_automation):
    """Initialize the scheduler with jobs"""
    global scheduler, db_instance, wa_automation_instance
    
    db_instance = db
    wa_automation_instance = wa_automation
    
    scheduler = AsyncIOScheduler()
    
    # Run appointment reminders every hour
    scheduler.add_job(
        run_appointment_reminders_job,
        CronTrigger(minute=0),  # Every hour at :00
        id='appointment_reminders',
        name='Appointment Reminders',
        replace_existing=True
    )
    
    # Run payment reminders every day at 10 AM
    scheduler.add_job(
        run_payment_reminders_job,
        CronTrigger(hour=10, minute=0),  # Daily at 10:00 AM
        id='payment_reminders',
        name='Payment Reminders',
        replace_existing=True
    )
    
    # Run daily backup at 3 AM
    scheduler.add_job(
        run_daily_backup_job,
        CronTrigger(hour=3, minute=0),  # Daily at 3:00 AM
        id='daily_backup',
        name='Daily Database Backup',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("✅ WhatsApp Scheduler initialized with cron jobs")
    logger.info("   📅 Appointment reminders: Every hour")
    logger.info("   💰 Payment reminders: Daily at 10:00 AM")
    logger.info("   💾 Database backup: Daily at 3:00 AM")
    
    return scheduler


def get_scheduler():
    return scheduler


def stop_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("⏹️ Scheduler stopped")
