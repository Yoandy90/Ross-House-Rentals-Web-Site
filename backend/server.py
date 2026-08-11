"""
server.py — Ross Tax Platform (FastAPI)
═══════════════════════════════════════
Slim orchestrator that wires together:
  • middleware.py        → CORS, Rate Limiting
  • socketio_setup.py    → Socket.IO server & events
  • router_registry.py   → All 100+ routers in organized groups
  • startup_services.py  → Service initialization on startup
"""

# ─── 0. Environment ───────────────────────────────────────────
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from dotenv import load_dotenv
import os
import logging

load_dotenv()

# ─── 1. Sentry Error Monitoring ──────────────────────────────
try:
    import sentry_sdk
    sentry_dsn = os.environ.get('SENTRY_DSN', '')
    if sentry_dsn:
        def before_send(event, hint):
            if 'exc_info' in hint:
                exc_type = hint['exc_info'][0]
                if exc_type and exc_type.__name__ == 'CancelledError':
                    return None
            return event

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=0.3,
            environment=os.environ.get('SENTRY_ENV', 'production'),
            send_default_pii=False,
            before_send=before_send,
        )
        print("✅ Sentry monitoring initialized")
    else:
        print("⚠️ Sentry DSN not configured")
except ImportError:
    print("⚠️ sentry-sdk not installed")

# ─── 2. MongoDB ──────────────────────────────────────────────
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def get_database():
    """Dependency injection helper."""
    return db


# ─── 3. JWT & Crypto ─────────────────────────────────────────
SECRET_KEY = os.environ['JWT_SECRET_KEY']
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 90

# ─── 4. Create FastAPI App ───────────────────────────────────
_is_production = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("PRODUCTION")
app = FastAPI(
    docs_url="/docs" if not _is_production else None,
    redoc_url="/redoc" if not _is_production else None,
    openapi_url="/openapi.json" if not _is_production else None,
)

# ─── 5. Middleware (CORS + Rate Limiting) ─────────────────────
from middleware import apply_all_middleware, ALLOWED_ORIGINS
apply_all_middleware(app)

# ─── 6. Socket.IO ────────────────────────────────────────────
from socketio_setup import create_socketio_server, create_socket_app
import socketio as _socketio

sio = create_socketio_server(ALLOWED_ORIGINS)
socket_app = create_socket_app(sio, app)

# ─── 7. Auth Helpers ─────────────────────────────────────────
from auth_helpers import (
    init_auth, hash_password, verify_password, create_session_token,
    get_current_user, get_user_from_token, verify_token, require_admin,
)
init_auth(db, secret_key=SECRET_KEY, expire_days=ACCESS_TOKEN_EXPIRE_DAYS)

# ─── 8. Shared API Router ────────────────────────────────────
api_router = APIRouter(prefix='/api')

# ─── 9. Register All Routers ─────────────────────────────────
from router_registry import register_all_routers
register_all_routers(app, db, api_router, get_current_user, require_admin, get_user_from_token)

# ─── 10. Logging ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# ─── 11. Global Service References ───────────────────────────
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


# ─── 12. Startup ─────────────────────────────────────────────
@app.on_event('startup')
async def startup_event():
    """Initialize all runtime services — delegated to startup_services.py."""
    global credit_service, google_calendar_service, transfer_service, raffle_service
    global lottery_service, referral_service, withdrawal_service, money_request_service
    global document_capture_service, tax_tools_service, tax_estimate_service
    global whatsapp_service, whatsapp_bot_service, password_reset_service_instance
    global notification_service_instance

    from startup_services import run_startup

    # ACH service created during router registration, fallback to None
    ach_payment_service = getattr(app.state, 'ach_payment_service', None)

    services = await run_startup(
        db=db,
        app=app,
        api_router=api_router,
        get_current_user=get_current_user,
        require_admin=require_admin,
        get_database=lambda: db,
        get_user_from_token=get_user_from_token,
        ach_payment_service=ach_payment_service,
    )

    credit_service             = services.get('credit_service')
    google_calendar_service    = services.get('google_calendar_service')
    transfer_service           = services.get('transfer_service')
    raffle_service             = services.get('raffle_service')
    lottery_service            = services.get('lottery_service')
    referral_service           = services.get('referral_service')
    withdrawal_service         = services.get('withdrawal_service')
    money_request_service      = services.get('money_request_service')
    document_capture_service   = services.get('document_capture_service')
    tax_tools_service          = services.get('tax_tools_service')
    tax_estimate_service       = services.get('tax_estimate_service')
    whatsapp_service           = services.get('whatsapp_service')
    whatsapp_bot_service       = services.get('whatsapp_bot_service')
    password_reset_service_instance = services.get('password_reset_service_instance')
    notification_service_instance   = services.get('notification_service_instance')

    # Late-bind notification service to test endpoints
    try:
        from test_notifications_endpoint import init_test_notifications
        init_test_notifications(db, notification_service_instance)
    except Exception:
        pass

    # OCCC Compliance Module (Audit Log, Trust Account, Complaints, Cancellations, Checklist)
    try:
        from occc_compliance_router import router as occc_compliance_router, init_occc_compliance
        init_occc_compliance(db, get_current_user)
        app.include_router(occc_compliance_router, tags=["OCCC Compliance"])
        print("  ✅ OCCC Compliance Router")
    except Exception as e:
        print(f"  ⚠️ OCCC Compliance Router: {e}")

    # Rental Email Inbox Module
    try:
        from rental.email_inbox_routes import router as rental_email_router
        app.include_router(rental_email_router, prefix="/api", tags=["Rental Email"])
        print("  ✅ Rental Email Inbox Router")
    except Exception as e:
        print(f"  ⚠️ Rental Email Inbox Router: {e}")

    # DB indexes
    try:
        from db_optimization import create_indexes
        await create_indexes(db)
    except Exception as e:
        print(f"⚠️ DB index creation: {e}")

    print('✅ All startup services initialized')


# ─── 13. Shutdown ─────────────────────────────────────────────
@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
