"""
startup_services.py — Extracted from server.py
Contains all service initialization logic that runs on app startup.
"""

import os
import logging
import uuid
import asyncio
import requests
import traceback
import pytz
from datetime import datetime, timedelta, timezone

# Service imports
from payment_service import get_stripe_service
from credit_service import CreditService
from transfer_service import CreditTransferService
from raffle_service import RaffleService
from lottery_service import LotteryService
from referral_service import ReferralService
from google_calendar_service import GoogleCalendarService
from withdrawal_service import WithdrawalService
from money_request_service import MoneyRequestService
from whatsapp_service import WhatsAppService
from whatsapp_bot_service import WhatsAppBotService
from whatsapp_bot_service_v2 import WhatsAppBotServiceV2, init_whatsapp_bot_v2
from whatsapp_endpoints import init_whatsapp_services
from whatsapp_automation_service import init_whatsapp_automation
from whatsapp_scheduler import init_scheduler as init_whatsapp_scheduler
from document_capture_service import DocumentCaptureService
from tax_tools_service import TaxToolsService
from tax_tools_endpoints import init_tax_tools_endpoints
from tax_estimate_service import TaxEstimateService
from tax_estimate_endpoints import init_tax_estimate_endpoints
from contacts_service import ContactsService
from invitation_service import InvitationService
from invitation_endpoints import init_invitation_endpoints
from feedback_service import FeedbackService
from feedback_endpoints import init_feedback_endpoints
from invoice_service import InvoiceService
from invoice_endpoints import init_invoice_endpoints
from password_reset_service import PasswordResetService
from notification_service import NotificationService
from email_service import EmailService
from usps_labels_service import USPSLabelsService
from usps_labels_endpoints import set_usps_labels_service
from usps_service import USPSService
from usps_endpoints import set_usps_service
from service_orders_endpoints import set_db as set_service_orders_db, set_usps_service as set_service_orders_usps, set_usps_labels_service as set_service_orders_labels
from bolita_endpoints import set_database as set_bolita_database, set_notification_service as set_bolita_notification_service
from test_push_endpoint import set_database as set_test_push_database, set_notification_service as set_test_push_notification_service
from scratch_cards_endpoints import set_database as set_scratch_cards_database, set_notification_service as set_scratch_cards_notification_service
from quick_actions_endpoints import init_quick_actions_endpoints
from feature_flags_endpoints import init_feature_flags_endpoints
from immigration_motions_service import ImmigrationMotionsService
from motion_document_generator import MotionDocumentGenerator
from immigration_motions_endpoints import set_motions_service, set_document_generator
from merchant_one_service import MerchantOneService
from merchant_one_endpoints import set_merchant_service, set_plans_service, set_scheduled_batch_service, set_ach_auth_service, set_dunning_service
from subscription_plans_service import SubscriptionPlansService
from dunning_service import DunningService
from scheduled_batch_service import init_scheduled_batch_service, get_scheduled_batch_service, get_scheduled_batch_processor
from ach_authorization_service import init_ach_auth_service, get_ach_auth_service
from tax_preparer_endpoints import set_tax_preparer_service
from tax_preparer_service import init_tax_preparer_service
from tax_wizard import TaxWizardService
from tax_wizard.endpoints import set_wizard_service
from dynamic_services import initialize_default_services
from chat_ai_service import ChatAIService
from chat_ai_endpoints import set_chat_ai_service

# Route update functions (from existing route modules)
from credits_routes import update_credits_services
from appointment_routes import update_appointment_services
from referral_routes import update_referral_service as update_ref_svc, update_notification_service as update_ref_notif_svc
from whatsapp_routes import update_whatsapp_notification_service as update_wa_notif
from marketing_routes import update_marketing_notification_service as update_mkt_notif
from admin_clients_mgmt_routes import update_admin_clients_mgmt_services
from tax_season_routes import update_tax_season_notification_service
from client_bookkeeping_routes import init_client_bk_router

# Optional imports (may not exist in all environments)
try:
    from document_reminders_service import init_document_reminders_service
except ImportError:
    init_document_reminders_service = None

try:
    from ross_endpoints import init_ross_endpoints
except ImportError:
    init_ross_endpoints = None

try:
    from ross_proactive_alerts import init_ross_alerts
except ImportError:
    init_ross_alerts = None

try:
    from analytics_endpoints import init_analytics_service, set_analytics_deps
except ImportError:
    init_analytics_service = None
    set_analytics_deps = None

try:
    from rise_crm_sync_service import init_rise_sync_service
except ImportError:
    init_rise_sync_service = None

try:
    from rise_crm_webhook_handler import init_webhook_handler
except ImportError:
    init_webhook_handler = None

try:
    from calendar_routes import update_calendar_notification_service
except ImportError:
    update_calendar_notification_service = None

try:
    from faq_inline_routes import update_faq_notification_service
except ImportError:
    update_faq_notification_service = None

try:
    from admin_appt_detail_routes import update_admin_appt_notification_service
except ImportError:
    update_admin_appt_notification_service = None

try:
    from payment_links_routes import update_payment_links_notification_service
except ImportError:
    update_payment_links_notification_service = None

try:
    from admin_clients_export_routes import update_admin_clients_export_notification_service
except ImportError:
    update_admin_clients_export_notification_service = None

try:
    from google_reviews_routes import set_email_notif as set_google_reviews_email
except ImportError:
    set_google_reviews_email = None

try:
    from job_applications_endpoints import set_email_notif as set_job_email, set_dependencies as set_job_deps
except ImportError:
    set_job_email = None
    set_job_deps = None

try:
    from rental_management_router import scheduled_recurring_rental_payments
except ImportError:
    scheduled_recurring_rental_payments = None

logger = logging.getLogger(__name__)


async def run_startup(db, app, api_router, get_current_user, require_admin, get_database, get_user_from_token, ach_payment_service=None):
    """
    Initialize all services on startup.
    Returns a dict with all initialized service instances.
    """
    # Service instances to return
    credit_service = None
    google_calendar_service = None
    transfer_service = None
    raffle_service = None
    lottery_service = None
    referral_service = None
    withdrawal_service = None
    money_request_service = None
    document_capture_service = None
    tax_tools_service = None
    tax_estimate_service = None
    whatsapp_service = None
    whatsapp_bot_service = None
    password_reset_service_instance = None
    notification_service_instance = None
    ai_brain_instance = None

    # Initialize Unified Config Manager
    from unified_config_manager import config_manager
    config_manager.set_db(db)
    await config_manager.seed_from_env()
    print("✅ Unified Config Manager initialized and seeded")
    
    # Initialize Stripe service
    stripe_service = get_stripe_service(db)
    await stripe_service.initialize()
    
    # Initialize Credit service with Stripe key from database
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    # Try to initialize with Stripe if available, otherwise use Authorize.net fallback
    if config_doc and config_doc.get('stripe_api_key'):
        credit_service = CreditService(db, config_doc['stripe_api_key'])
        print("✅ Credit service initialized with Stripe")
    else:
        # Initialize with dummy key but will use Authorize.net for payments
        credit_service = CreditService(db, "sk_test_dummy")
        print("✅ Credit service initialized with Authorize.net fallback")
        print("ℹ️  Using Authorize.net for credit purchases")
    
    # Initialize Credit Transfer Service
    transfer_service = CreditTransferService(db)
    print("✅ Transfer service initialized")
    
    # Initialize Raffle Service
    raffle_service = RaffleService(db)
    print("✅ Raffle service initialized")
    
    # Initialize Lottery Service
    lottery_service = LotteryService(db)
    print("✅ Lottery service initialized")
    
    # Initialize Referral Service
    referral_service = ReferralService(db)
    print("✅ Referral service initialized")
    # Update extracted referral router with initialized service
    try:
        update_ref_svc(referral_service)
    except:
        pass
    
    # Initialize Withdrawal Service
    withdrawal_service = WithdrawalService(db)
    print("✅ Withdrawal service initialized")
    
    # Initialize Money Request Service
    money_request_service = MoneyRequestService(db)
    print("✅ Money request service initialized")
    
    # Update extracted credits router with initialized services
    try:
        update_credits_services(credit_service, transfer_service, withdrawal_service, money_request_service)
        print("✅ Credits router services updated successfully")
    except Exception as e:
        print(f"❌ Error updating credits router services: {e}")
        import traceback
        traceback.print_exc()
    
    # Initialize Document Capture Service
    document_capture_service = DocumentCaptureService(db)
    print("✅ Document capture service initialized")
    
    # Initialize Tax Tools Service
    tax_tools_service = TaxToolsService(db)
    print("✅ Tax tools service initialized")
    
    # Initialize Tax Estimate Service
    tax_estimate_service = TaxEstimateService(db)
    print("✅ Tax estimate service initialized")
    
    # Initialize Tax Wizard Service (TurboTax-style wizard)
    tax_wizard_service = TaxWizardService(db)
    set_wizard_service(tax_wizard_service, get_current_user)
    print("✅ Tax Wizard service initialized")
    
    # Initialize Tax Wizard sub-services
    from tax_wizard.referral_service import init_referral_service
    from tax_wizard.reminder_service import init_reminder_service
    from tax_wizard.analytics_service import init_analytics_service
    from tax_wizard.promo_service import init_promo_service
    from tax_wizard.appointment_service import init_appointment_service
    init_referral_service(db)
    init_reminder_service(db)
    init_analytics_service(db)
    promo_svc = init_promo_service(db)
    init_appointment_service(db)
    # Create default promo codes
    import asyncio
    asyncio.create_task(promo_svc.create_default_codes())
    print("✅ Tax Wizard referral, reminder, analytics, promo, and appointment services initialized")
    
    # Initialize Contacts Service
    contacts_service = ContactsService(db)
    print("✅ Contacts service initialized")
    
    # Initialize Invitation Service
    invitation_service = InvitationService(db)
    print("✅ Invitation service initialized")
    
    # Initialize Feedback Service
    feedback_service = FeedbackService(db)
    print("✅ Feedback service initialized")
    
    # Initialize USPS Labels Service (OAuth-based for label creation)
    usps_client_id = os.getenv('USPS_CLIENT_ID')
    usps_client_secret = os.getenv('USPS_CLIENT_SECRET')
    if usps_client_id and usps_client_secret:
        usps_labels_service = USPSLabelsService(db)
        set_usps_labels_service(usps_labels_service)
        set_service_orders_labels(usps_labels_service)  # Connect labels to service orders
        print("✅ USPS Labels service initialized")
    else:
        print("⚠️  Warning: USPS Labels credentials not configured. Get your credentials from https://developer.usps.com/")
    
    # Initialize USPS Address Validation Service (OAuth2 API v3)
    usps_client_id_val = os.getenv('USPS_CLIENT_ID') or os.getenv('USPS_CONSUMER_KEY')
    if usps_client_id_val:
        from usps_service import USPSService
        from usps_labels_endpoints import set_usps_validation_service
        usps_validation_service = USPSService(usps_client_id_val, db)
        set_usps_validation_service(usps_validation_service)
        set_usps_service(usps_validation_service)  # Also set for usps_endpoints
        set_service_orders_usps(usps_validation_service)  # For service orders tracking
        print("✅ USPS Address Validation service initialized (OAuth2)")
    else:
        print("⚠️  Warning: USPS Address Validation credentials not configured")
    
    # Initialize Bolita Cubana Service (database only, notifications later)
    set_bolita_database(db)
    print("✅ Bolita Cubana service initialized")

    # Initialize Service Orders (shipping + tracking)
    set_service_orders_db(db)
    print("✅ Service Orders system initialized")
    
    # Initialize Google Calendar service
    google_client_id = os.getenv('GOOGLE_CLIENT_ID')
    google_client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8001').rstrip('/')
    redirect_uri = f"{backend_url}/api/admin/calendar/callback"
    
    if google_client_id and google_client_secret:
        google_calendar_service = GoogleCalendarService(
            client_id=google_client_id,
            client_secret=google_client_secret,
            redirect_uri=redirect_uri
        )
        print("✅ Google Calendar service initialized")
    else:
        print("⚠️  Warning: Google Calendar credentials not configured")
    
    # Initialize WhatsApp services
    whatsapp_phone_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
    whatsapp_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
    
    if whatsapp_phone_id and whatsapp_token:
        whatsapp_service = WhatsAppService(db)
        whatsapp_bot_service = WhatsAppBotService(db, whatsapp_service)
        init_whatsapp_services(whatsapp_service, whatsapp_bot_service)
        
        # Initialize WhatsApp Bot V2 (enhanced with lead capture, FAQ, appointments, AI Brain)
        whatsapp_bot_v2 = init_whatsapp_bot_v2(db, whatsapp_service, ai_brain_instance)
        
        # Initialize WhatsApp Automation Service
        from whatsapp_automation_service import init_whatsapp_automation, get_whatsapp_automation
        whatsapp_automation = init_whatsapp_automation(db, whatsapp_service)
        
        # Initialize WhatsApp Scheduler (cron jobs for reminders)
        try:
            from whatsapp_scheduler import init_scheduler
            scheduler = init_scheduler(db, whatsapp_automation)
            print("✅ WhatsApp Scheduler started (reminders every hour, payment daily at 10AM)")
        except Exception as sched_error:
            print(f"⚠️ Could not start scheduler: {sched_error}")
        
        print("✅ WhatsApp service initialized")
        print("✅ WhatsApp Bot V2 initialized (with lead capture, FAQ, appointments)")
        print("✅ WhatsApp Automation service initialized")
    else:
        print("⚠️  Warning: WhatsApp credentials not configured (will be enabled when you add them)")
    
    # Initialize Rise CRM Sync Service
    rise_crm_enabled = os.getenv('RISE_CRM_SYNC_ENABLED', 'false').lower() == 'true'
    if rise_crm_enabled:
        from rise_crm_sync_service import init_rise_sync_service
        from rise_crm_webhook_handler import init_webhook_handler
        init_rise_sync_service(db)
        init_webhook_handler(db)
        print("✅ Rise CRM Sync Service initialized")
        print("✅ Rise CRM Webhook Handler initialized")
    else:
        print("ℹ️  Rise CRM sync is disabled")
    
    # Initialize tax tools endpoints after all services are ready
    init_tax_tools_endpoints(app, api_router, tax_tools_service, get_current_user, require_admin)
    
    # Initialize tax estimate endpoints
    init_tax_estimate_endpoints(app, api_router, tax_estimate_service, tax_tools_service, get_current_user, require_admin)
    
    # Initialize invitation and contacts endpoints
    init_invitation_endpoints(app, api_router, contacts_service, invitation_service, get_current_user, require_admin)
    
    # Initialize feedback endpoints
    init_feedback_endpoints(app, api_router, feedback_service, get_current_user, require_admin)
    
    # Initialize invoice endpoints
    init_invoice_endpoints(app, api_router, get_current_user, require_admin, get_database, ach_payment_service)
    
    # Initialize Password Reset Service (will be connected to NotificationService below)
    import password_reset_service as prs_module
    from password_reset_service import PasswordResetService
    
    # Initialize Notification Service (Email + SMS) FIRST
    from notification_service import NotificationService
    notification_service_instance = None
    if config_doc:
        # WORKAROUND: Force correct SendGrid key from .env (MongoDB seems to have caching issues)
        correct_sg_key = os.getenv('SENDGRID_API_KEY')
        if correct_sg_key:
            config_doc['sendgrid_api_key'] = correct_sg_key
            print(f"🔑 Using SendGrid key from .env: {correct_sg_key[:20]}...")
        else:
            sg_key = config_doc.get('sendgrid_api_key', '')
            print(f"🔑 Using SendGrid key from MongoDB: {sg_key[:20]}..." if sg_key else "⚠️ No SendGrid key in config")
        
        # WORKAROUND: Force Twilio credentials from .env
        twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        if twilio_sid and twilio_token and twilio_phone:
            config_doc['twilio_account_sid'] = twilio_sid
            config_doc['twilio_auth_token'] = twilio_token
            config_doc['twilio_phone_number'] = twilio_phone
            print(f"📱 Using Twilio credentials from .env: {twilio_sid[:20]}...")
        
        notification_service_instance = NotificationService(config_doc)
        print(f"🔧 DEBUG: About to call set_tracking_db, db={db}, notification_service={notification_service_instance}")
        notification_service_instance.set_tracking_db(db)  # Enable email tracking
        # Update extracted referral router with notification service
        try:
            update_ref_notif_svc(notification_service_instance)
        except:
            pass
        # Update extracted whatsapp router with notification service
        try:
            update_wa_notif(notification_service_instance)
        except:
            pass
        # Update extracted marketing router with notification service
        try:
            update_mkt_notif(notification_service_instance)
        except:
            pass
        # Update extracted tax season router with notification service
        try:
            update_tax_season_notification_service(notification_service_instance)
        except:
            pass
        # Update extracted appointment router with notification service
        try:
            update_appointment_services(notification_service=notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating appointment notification service: {e}")
        # Update extracted calendar router with notification service
        try:
            from calendar_routes import update_calendar_notification_service
            update_calendar_notification_service(notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating calendar notification service: {e}")
        # Update extracted admin clients export router with notification service
        try:
            from admin_clients_export_routes import update_admin_clients_export_notification_service
            update_admin_clients_export_notification_service(notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating admin clients export notification service: {e}")
        # Update extracted admin clients mgmt router with services
        try:
            update_admin_clients_mgmt_services(notification_service=notification_service_instance, whatsapp_service=whatsapp_service)
        except Exception as e:
            print(f"⚠️ Error updating admin clients mgmt services: {e}")
        # Update extracted credits router with notification service
        try:
            update_credits_services(notification_service=notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating credits notification service: {e}")
        # Update extracted FAQ/inline router with notification service
        try:
            from faq_inline_routes import update_faq_notification_service
            update_faq_notification_service(notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating FAQ notification service: {e}")
        # Update extracted payment links router with notification service
        try:
            from payment_links_routes import update_payment_links_notification_service
            update_payment_links_notification_service(notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating payment links notification service: {e}")
        # Update extracted admin appointment detail router with notification service
        try:
            from admin_appt_detail_routes import update_admin_appt_notification_service
            update_admin_appt_notification_service(notification_service_instance)
        except Exception as e:
            print(f"⚠️ Error updating admin appt detail notification service: {e}")
        if notification_service_instance.twilio_client:
            print("✅ Twilio client initialized")
            print(f"📱 SMS Service initialized with Twilio phone: {notification_service_instance.twilio_phone_number}")
        else:
            print("⚠️  Warning: Twilio not configured in database")
        
        if notification_service_instance.sendgrid_client:
            print("✅ SendGrid client initialized for notifications")
        else:
            print("⚠️  Warning: SendGrid not configured for notifications")
        
        # Connect email_service to notification_service
        from email_service import set_notification_service as set_email_notif
        set_email_notif(notification_service_instance)
        print("📧 Email service connected to notification service")
        
        # Now initialize Password Reset Service WITH the notification service
        password_reset_service_instance = PasswordResetService(db, notification_service=notification_service_instance)
        prs_module.password_reset_service = password_reset_service_instance
        print("✅ Password Reset service initialized (with NotificationService)")
        
        # Connect AI Brain to notification service
        if ai_brain_instance:
            ai_brain_instance.notification_service = notification_service_instance
            print("🤖 AI Brain connected to notification service")
        
        # Initialize Job Applications endpoints with dependencies
        from job_applications_endpoints import set_dependencies as set_job_deps
        set_job_deps(db, notification_service_instance, ai_brain_instance)
        print("💼 Job Applications dependencies initialized")
        
        # Initialize Analytics endpoints with dependencies
        from analytics_endpoints import set_dependencies as set_analytics_deps
        set_analytics_deps(db, notification_service_instance)
        print("📊 Analytics dependencies initialized")
        
        # Initialize Immigration Motions Service
        motions_service_instance = ImmigrationMotionsService(db, notification_service_instance)
        set_motions_service(motions_service_instance, db)
        print("📋 Immigration Motions service initialized")
        
        # Initialize Motion Document Generator
        document_generator_instance = MotionDocumentGenerator(db)
        set_document_generator(document_generator_instance)
        print("📄 Motion Document Generator initialized")
        
        # Initialize Merchant One ACH Service
        merchant_service_instance = MerchantOneService(db)
        set_merchant_service(merchant_service_instance)
        print("💳 Merchant One ACH service initialized")
        
        # Initialize Dunning Service
        dunning_svc = DunningService(db, notification_service_instance)
        await dunning_svc.ensure_indexes()
        set_dunning_service(dunning_svc)
        print("🔔 Dunning Service initialized")
        
        # Load statement descriptor from DB
        try:
            from merchant_one_service import set_descriptor_cache
            desc_config = await db.settings.find_one({"key": "merchant_descriptor"})
            if desc_config:
                set_descriptor_cache(desc_config)
                print(f"📝 Statement descriptor loaded: {desc_config.get('descriptor', 'N/A')}")
            else:
                print("📝 No statement descriptor configured")
        except Exception as e:
            print(f"⚠️ Failed to load descriptor (non-critical): {e}")
        
        # Initialize Subscription Plans Service
        plans_service_instance = SubscriptionPlansService(db)
        set_plans_service(plans_service_instance)
        print("📋 Subscription Plans service initialized")
        
        # Initialize Scheduled Batch Service for drip uploads
        scheduled_batch_svc = init_scheduled_batch_service(db, merchant_service_instance)
        scheduled_batch_proc = get_scheduled_batch_processor()
        set_scheduled_batch_service(scheduled_batch_svc, scheduled_batch_proc)
        print("📦 Scheduled Batch service initialized")
        
        # Initialize ACH Authorization Service
        ach_auth_svc = init_ach_auth_service(db)
        set_ach_auth_service(ach_auth_svc)
        print("📄 ACH Authorization service initialized")
        
        # Initialize Tax Preparer Service
        tax_prep_svc = init_tax_preparer_service(db)
        set_tax_preparer_service(tax_prep_svc)
        print("📋 Tax Preparer service initialized")
        
        # Start the scheduled batch processor in background
        if scheduled_batch_proc:
            import asyncio
            asyncio.create_task(scheduled_batch_proc.start())
            print("▶️ Scheduled Batch processor started")
        
        # Initialize Ross Proactive Alerts System
        from ross_proactive_alerts import init_ross_alerts, get_ross_alerts
        ross_alerts_instance = init_ross_alerts(db)
        print("🔔 Ross Proactive Alerts system initialized")
        
        # Initialize Document Reminders Service
        from document_reminders_service import init_document_reminders_service, get_document_reminders_service
        doc_reminders_instance = init_document_reminders_service(db)
        print("📄 Document Reminders service initialized")
        
        # Initialize Ross endpoints
        from ross_endpoints import init_ross_endpoints
        print("📡 Initializing Ross endpoints...")
        init_ross_endpoints(app, api_router, require_admin, get_database, get_ross_alerts)
        print("🤖 Ross Dashboard endpoints initialized")
        
        # Schedule Ross to run analysis every hour
        try:
            from whatsapp_scheduler import scheduler
            from apscheduler.triggers.cron import CronTrigger
            
            async def run_ross_analysis_job():
                """Job that runs Ross proactive analysis every hour"""
                try:
                    alerts_service = get_ross_alerts()
                    if alerts_service:
                        result = await alerts_service.run_full_analysis()
                        urgent_count = result.get('summary', {}).get('urgent', 0)
                        if urgent_count > 0:
                            logging.info(f"🚨 Ross found {urgent_count} urgent alerts!")
                            # Notify admin of urgent alerts via push
                            admin_users = await db.users.find({
                                'role': 'admin',
                                'push_token': {'$exists': True, '$ne': None}
                            }).to_list(5)
                            for admin in admin_users:
                                push_token = admin.get('push_token')
                                if push_token and push_token.startswith('ExponentPushToken'):
                                    try:
                                        requests.post(
                                            "https://exp.host/--/api/v2/push/send",
                                            json={
                                                "to": push_token,
                                                "title": f"🤖 Ross: {urgent_count} alertas urgentes",
                                                "body": "Hay tareas que requieren tu atención inmediata.",
                                                "data": {"type": "ross_urgent_alerts"}
                                            },
                                            timeout=5
                                        )
                                    except:
                                        pass
                        logging.info(f"✅ Ross analysis complete: {result.get('summary', {}).get('total_alerts', 0)} alerts")
                except Exception as e:
                    logging.error(f"❌ Error in Ross scheduled analysis: {e}")
            
            # Add the scheduled job only if scheduler is available
            if scheduler is not None:
                scheduler.add_job(
                    run_ross_analysis_job,
                    CronTrigger(minute='30'),
                    id='ross_proactive_analysis',
                    name='Ross Proactive Analysis',
                    replace_existing=True
                )
                print("⏰ Ross scheduled to run analysis every hour")
                
                # Add Google Calendar sync job
                async def sync_google_calendar_job():
                    """Auto-sync Google Calendar every hour"""
                    try:
                        logging.info("📅 Running scheduled Google Calendar sync...")
                        
                        # Get all admin users with Google Calendar connected
                        admin_tokens = await db.calendar_tokens.find({}).to_list(100)
                        
                        for tokens_doc in admin_tokens:
                            try:
                                if not google_calendar_service:
                                    continue
                                    
                                credentials = google_calendar_service.get_credentials_from_tokens(
                                    tokens_doc['access_token'],
                                    tokens_doc['refresh_token']
                                )
                                
                                calendar_id = tokens_doc.get('calendar_id', 'primary')
                                now = datetime.now(timezone.utc)
                                time_max = now + timedelta(days=90)
                                
                                google_events = google_calendar_service.list_events(
                                    credentials=credentials,
                                    time_min=now,
                                    time_max=time_max,
                                    max_results=200,
                                    calendar_id=calendar_id
                                )
                                
                                imported = 0
                                for event in google_events:
                                    event_id = event.get('event_id')
                                    if not event_id:
                                        continue
                                    
                                    existing = await db.appointments.find_one({'calendar_event_id': event_id})
                                    if existing:
                                        continue
                                    
                                    summary = event.get('summary', 'Sin título')
                                    start_str = event.get('start')
                                    is_all_day = event.get('is_all_day', False)
                                    
                                    if not start_str:
                                        continue
                                    
                                    try:
                                        if is_all_day:
                                            start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=9, minute=0, tzinfo=timezone.utc)
                                        elif 'T' in str(start_str):
                                            start_dt = datetime.fromisoformat(str(start_str).replace('Z', '+00:00'))
                                        else:
                                            start_dt = datetime.strptime(str(start_str)[:10], '%Y-%m-%d').replace(hour=9, minute=0, tzinfo=timezone.utc)
                                    except:
                                        continue
                                    
                                    # Extract client name properly from summary
                                    client_name = summary.split(' - ')[0] if ' - ' in summary else summary
                                    # Format scheduled_at as ISO string with timezone
                                    import pytz
                                    texas_tz = pytz.timezone('America/Chicago')
                                    if start_dt.tzinfo:
                                        local_dt = start_dt.astimezone(texas_tz)
                                    else:
                                        local_dt = texas_tz.localize(start_dt)
                                    scheduled_at_str = local_dt.strftime('%Y-%m-%dT%H:%M:%S-06:00')
                                    
                                    new_appt = {
                                        '_id': str(uuid.uuid4()),
                                        'user_id': None,
                                        'user_name': client_name,  # Use user_name for consistency
                                        'client_name': client_name,
                                        'appointment_type': 'Consulta General',
                                        'date': local_dt.strftime('%Y-%m-%d'),
                                        'time': local_dt.strftime('%H:%M'),
                                        'time_slot': local_dt.strftime('%H:%M'),
                                        'scheduled_at': scheduled_at_str,  # ISO string with timezone
                                        'status': 'scheduled',
                                        'notes': f'Auto-importado: {client_name}',
                                        'calendar_event_id': event_id,
                                        'source': 'google_calendar_auto_sync',
                                        'created_at': datetime.now(timezone.utc)
                                    }
                                    await db.appointments.insert_one(new_appt)
                                    imported += 1
                                
                                if imported > 0:
                                    logging.info(f"📅 Auto-imported {imported} events from Google Calendar")
                                    
                            except Exception as token_err:
                                logging.error(f"Error syncing calendar for admin: {token_err}")
                                
                    except Exception as e:
                        logging.error(f"❌ Error in Google Calendar scheduled sync: {e}")
                
                # Google Calendar sync DISABLED - using closed circuit system
                # scheduler.add_job(sync_google_calendar_job...)
                print("📅 Google Calendar sync DESACTIVADO - sistema cerrado local")
                
                # Add daily document reminders job
                async def send_daily_document_reminders():
                    """Send document reminders to clients with missing docs"""
                    try:
                        from document_reminders_service import get_document_reminders_service
                        doc_service = get_document_reminders_service()
                        
                        if doc_service:
                            logging.info("📄 Running daily document reminders...")
                            result = await doc_service.send_document_reminders()
                            logging.info(f"✅ Document reminders sent: {result.get('reminders_sent', 0)}")
                    except Exception as e:
                        logging.error(f"❌ Error in document reminders job: {e}")
                
                scheduler.add_job(
                    send_daily_document_reminders,
                    CronTrigger(hour='9', minute='0'),  # Run daily at 9:00 AM
                    id='daily_document_reminders',
                    name='Daily Document Reminders',
                    replace_existing=True
                )
                print("📄 Document reminders scheduled to run daily at 9:00 AM")
                
                # Add daily birthday greetings job
                async def send_daily_birthday_greetings():
                    """Check for birthdays and send greetings"""
                    try:
                        logging.info("🎂 Running daily birthday check...")
                        if ai_brain_instance:
                            result = await ai_brain_instance.check_birthdays(days_ahead=0, send_wishes=True)
                            birthdays_found = result.get('birthdays_found', 0)
                            wishes_sent = result.get('wishes_sent', 0)
                            logging.info(f"🎂 Birthday check completed: {birthdays_found} birthdays found, {wishes_sent} wishes sent")
                        else:
                            logging.warning("⚠️ AI Brain not available for birthday check")
                    except Exception as e:
                        logging.error(f"❌ Error in birthday greetings job: {e}")
                
                scheduler.add_job(
                    send_daily_birthday_greetings,
                    CronTrigger(hour='8', minute='0'),  # Run daily at 8:00 AM
                    id='daily_birthday_greetings',
                    name='Daily Birthday Greetings',
                    replace_existing=True
                )
                print("🎂 Birthday greetings scheduled to run daily at 8:00 AM")
                
                # Job para limpiar sesiones expiradas diariamente
                async def cleanup_expired_sessions():
                    try:
                        logging.info("🧹 Limpiando sesiones expiradas...")
                        result = await db.user_sessions.delete_many({
                            'expires_at': {'$lt': datetime.now(timezone.utc)}
                        })
                        logging.info(f"🧹 Eliminadas {result.deleted_count} sesiones expiradas")
                    except Exception as e:
                        logging.error(f"❌ Error limpiando sesiones: {e}")
                
                scheduler.add_job(
                    cleanup_expired_sessions,
                    CronTrigger(hour='3', minute='0'),  # Run daily at 3:00 AM
                    id='cleanup_expired_sessions',
                    name='Cleanup Expired Sessions',
                    replace_existing=True
                )
                print("🧹 Session cleanup scheduled to run daily at 3:00 AM")
                
                # DISABLED: Square cache pre-warming (Square dependency removed)
                # async def prewarm_square_cache():
                #     try:
                #         # Square service removed (no longer used)
                #         logging.info("🔄 Pre-warming Square bookings cache...")
                #         bookings = square_service.list_bookings(limit=200, force_refresh=True)
                #         logging.info(f"✅ Square cache warmed with {len(bookings)} bookings")
                #     except Exception as e:
                #         logging.error(f"❌ Error pre-warming Square cache: {e}")
                
                # scheduler.add_job(
                #     prewarm_square_cache,
                #     CronTrigger(minute='*/10'),  # Run every 10 minutes
                #     id='prewarm_square_cache',
                #     name='Pre-warm Square Cache',
                #     replace_existing=True
                # )
                print("📅 Square dependency removed - using local database for appointments")
                
                # Schedule Google Reviews sync every 2 hours
                async def scheduled_review_sync():
                    try:
                        from google_reviews_routes import check_and_import_new_reviews
                        await check_and_import_new_reviews()
                    except Exception as e:
                        logging.error(f"❌ Error in scheduled review sync: {e}")
                
                scheduler.add_job(
                    scheduled_review_sync,
                    CronTrigger(hour='*/2'),  # Run every 2 hours
                    id='google_reviews_sync',
                    name='Google Reviews Sync',
                    replace_existing=True
                )
                print("⭐ Google Reviews sync scheduled every 2 hours")
                
                # ── Recurring Rental Payments (daily at 8:00 AM CT) ──
                async def scheduled_recurring_rental_payments():
                    try:
                        from rental_management_router import process_recurring_rental_payments
                        result = await process_recurring_rental_payments()
                        logging.info(f"🏠 Recurring rental payments: {result}")
                    except Exception as e:
                        logging.error(f"❌ Error processing recurring rental payments: {e}")

                scheduler.add_job(
                    scheduled_recurring_rental_payments,
                    CronTrigger(hour='14', minute='0'),  # 14:00 UTC = 8:00 AM CT
                    id='recurring_rental_payments',
                    name='Recurring Rental Payments',
                    replace_existing=True
                )
                print("🏠 Recurring rental payments scheduled to run daily at 8:00 AM CT")
                
                # DISABLED: Square startup cache warming
                # import asyncio
                # asyncio.create_task(prewarm_square_cache())
            else:
                print("⚠️ Scheduler not available, Ross hourly analysis disabled")
        except ImportError as e:
            print(f"⚠️ Could not import scheduler: {e}")
        
        # Connect Bolita Cubana to notification service
        set_bolita_notification_service(notification_service_instance)
        print("🇨🇺 Bolita Cubana notifications enabled")
        
        # Connect Test Push to database and notification service
        set_test_push_database(db)
        set_test_push_notification_service(notification_service_instance)
        print("🧪 Test Push service enabled")
        
        # Connect Scratch Cards to database and notification service
        set_scratch_cards_database(db)
        set_scratch_cards_notification_service(notification_service_instance)
        print("🎫 Scratch Cards service enabled")
        
        # Connect Client Bookkeeping to notification service
        from client_bookkeeping_routes import init_client_bk_router as _update_client_bk_notif
        _update_client_bk_notif(db, notification_service_instance)
        print("📚 Client Bookkeeping notification service connected")
        
        # Initialize Quick Actions endpoints
        init_quick_actions_endpoints(app, api_router, require_admin, get_database)
        print("📱 Quick Actions service enabled")
        
        # Initialize Feature Flags endpoints
        init_feature_flags_endpoints(app, api_router, require_admin, get_database)
        print("🚩 Feature Flags service enabled")
    else:
        print("⚠️  Warning: API config not found in database. Run setup endpoint first.")
        print("🔧 To setup: POST /api/admin/setup-notifications")
        # Still initialize Password Reset Service without notification service as fallback
        password_reset_service_instance = PasswordResetService(db, notification_service=None)
        prs_module.password_reset_service = password_reset_service_instance
        print("⚠️ Password Reset service initialized (without NotificationService - emails will not be sent)")
    
    # ============================================
    # CREATE MONGODB INDEXES FOR PERFORMANCE
    # ============================================
    try:
        print("📊 Creating MongoDB indexes for performance optimization...")
        
        # Users collection indexes
        await db.users.create_index("email", unique=True, sparse=True)
        await db.users.create_index("phone", sparse=True)
        await db.users.create_index("role")
        await db.users.create_index("created_at")
        await db.users.create_index([("name", 1), ("email", 1)])  # For search
        print("  ✅ Users indexes created")
        
        # Documents collection indexes
        await db.documents.create_index("user_id")
        await db.documents.create_index("status")
        await db.documents.create_index("uploaded_at")
        await db.documents.create_index("reviewed")
        await db.documents.create_index("category")
        await db.documents.create_index([("user_id", 1), ("status", 1)])  # Compound
        print("  ✅ Documents indexes created")
        
        # Appointments collection indexes
        await db.appointments.create_index("user_id")
        await db.appointments.create_index("scheduled_at")
        await db.appointments.create_index("status")
        await db.appointments.create_index([("scheduled_at", 1), ("status", 1)])  # For calendar queries
        print("  ✅ Appointments indexes created")
        
        # Tax returns collection indexes
        await db.tax_returns.create_index("user_id")
        await db.tax_returns.create_index("status")
        await db.tax_returns.create_index("tax_year")
        await db.completed_tax_returns.create_index("user_id")
        await db.completed_tax_returns.create_index("tax_year")
        print("  ✅ Tax returns indexes created")
        
        # Chat messages collection indexes
        await db.chat_messages.create_index("room_id")
        await db.chat_messages.create_index("user_id")
        await db.chat_messages.create_index("timestamp")
        await db.chat_messages.create_index([("room_id", 1), ("timestamp", -1)])  # For chat history
        print("  ✅ Chat messages indexes created")
        
        # KYC data collection indexes
        await db.kyc_data.create_index("user_id", unique=True, sparse=True)
        await db.kyc_data.create_index("completed")
        print("  ✅ KYC indexes created")
        
        # Service orders collection indexes
        await db.service_orders.create_index("user_id")
        await db.service_orders.create_index("status")
        await db.service_orders.create_index("created_at")
        print("  ✅ Service orders indexes created")
        
        # Invoices collection indexes
        await db.invoices.create_index("user_id")
        await db.invoices.create_index("status")
        await db.invoices.create_index("created_at")
        print("  ✅ Invoices indexes created")
        
        # Push tokens for notifications
        await db.users.create_index("push_token", sparse=True)
        await db.users.create_index("fcm_token", sparse=True)
        print("  ✅ Push notification indexes created")
        
        print("✅ All MongoDB indexes created successfully!")
        
    except Exception as e:
        print(f"⚠️  Warning: Could not create some indexes: {str(e)}")
        print("   App will continue but some queries may be slower")
    
    # Initialize Apple IAP subscription plans with correct product IDs
    try:
        print("🍎 Initializing Apple IAP subscription plans...")
        
        # Correct Apple product IDs as of June 2025
        correct_plans = [
            {
                'name': 'Plan Básico Mensual',
                'description': 'Acceso básico a servicios de preparación de impuestos',
                'price': 29.99,
                'billing_period': 'monthly',
                'apple_product_id': 'com.rosstax.plan.basic.monthly',
                'features': [
                    'Preparación de impuestos básica',
                    'Soporte por chat',
                    'Acceso a herramientas fiscales',
                    'Notificaciones de estado'
                ],
                'is_active': True,
                'sort_order': 1
            },
            {
                'name': 'Plan Profesional Mensual',
                'description': 'Acceso completo con servicios profesionales avanzados',
                'price': 59.99,
                'billing_period': 'monthly',
                'apple_product_id': 'com.rosstax.plan.professional.monthly',
                'features': [
                    'Todo del Plan Básico',
                    'Preparación avanzada de impuestos',
                    'Soporte prioritario',
                    'Consulta con especialista',
                    'Descuentos en servicios adicionales'
                ],
                'is_active': True,
                'sort_order': 2
            },
            {
                'name': 'Recibos Pro',
                'description': 'Escaneo ilimitado de recibos con AI — clasificación automática',
                'price': 9.99,
                'billing_period': 'monthly',
                'apple_product_id': 'com.rosstax.plan.receipts.monthly',
                'features': [
                    'Escaneos ilimitados de recibos',
                    'Clasificación automática con AI',
                    'Categorización según IRS Schedule C',
                    'Historial de gastos organizado',
                    'Reporte anual de gastos deducibles'
                ],
                'is_active': True,
                'sort_order': 3
            }
        ]
        
        for plan in correct_plans:
            # Upsert each plan based on apple_product_id
            existing = await db.subscription_plans.find_one({'apple_product_id': plan['apple_product_id']})
            if existing:
                await db.subscription_plans.update_one(
                    {'apple_product_id': plan['apple_product_id']},
                    {'$set': {
                        'name': plan['name'],
                        'description': plan['description'],
                        'price': plan['price'],
                        'billing_period': plan['billing_period'],
                        'features': plan['features'],
                        'is_active': plan['is_active'],
                        'sort_order': plan['sort_order'],
                        'updated_at': datetime.utcnow()
                    }}
                )
                print(f"  ✅ Updated: {plan['name']} ({plan['apple_product_id']})")
            else:
                plan['created_at'] = datetime.utcnow()
                plan['updated_at'] = datetime.utcnow()
                await db.subscription_plans.insert_one(plan)
                print(f"  ✅ Created: {plan['name']} ({plan['apple_product_id']})")
        
        print("✅ Apple IAP subscription plans initialized!")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize subscription plans: {str(e)}")
    
    # Initialize Dynamic Services (creates default services if none exist)
    try:
        await initialize_default_services(db)
        print("✅ Dynamic Services initialized!")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize dynamic services: {str(e)}")


    # Return all initialized services
    return {
        'credit_service': credit_service,
        'google_calendar_service': google_calendar_service,
        'transfer_service': transfer_service,
        'raffle_service': raffle_service,
        'lottery_service': lottery_service,
        'referral_service': referral_service,
        'withdrawal_service': withdrawal_service,
        'money_request_service': money_request_service,
        'document_capture_service': document_capture_service,
        'tax_tools_service': tax_tools_service,
        'tax_estimate_service': tax_estimate_service,
        'whatsapp_service': whatsapp_service,
        'whatsapp_bot_service': whatsapp_bot_service,
        'password_reset_service_instance': password_reset_service_instance,
        'notification_service_instance': notification_service_instance,
        'ai_brain_instance': ai_brain_instance,
    }
