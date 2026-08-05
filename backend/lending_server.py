"""
═══════════════════════════════════════════════════════════════════
  ROSS LENDING SOLUTIONS — INDEPENDENT FASTAPI SERVER
═══════════════════════════════════════════════════════════════════
  
  Standalone backend for Ross Lending Solutions LLC.
  This server is fully independent from the Ross Tax backend.
  
  It includes:
  - Own authentication (users + sessions from shared DB)
  - All lending routers (loans, applications, payments, chat, config)
  - Notification services (email, SMS, push)
  - PDF generation services
  
  Usage:
    uvicorn lending_server:app --host 0.0.0.0 --port 8002 --reload
  
  Environment Variables:
    MONGO_URL          — MongoDB connection string
    DB_NAME            — Database name (default: taxportal, future: lending_db)
    JWT_SECRET_KEY     — Secret for JWT tokens
    LENDING_PORT       — Port to run on (default: 8002)
  
  © 2026 Ross Lending Solutions LLC — OCCC Regulated Lender
═══════════════════════════════════════════════════════════════════
"""

import os
import logging
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")  # Will become 'lending_db' after full migration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ross-tax-secret-key-2025-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 90
LENDING_PORT = int(os.getenv("LENDING_PORT", "8002"))

logger = logging.getLogger("lending_server")
logging.basicConfig(level=logging.INFO)

# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════

client: AsyncIOMotorClient = None
db = None


# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION — Independent copy from server.py
# ═══════════════════════════════════════════════════════════════

def create_session_token(user_id: str) -> str:
    """Generate a JWT session token."""
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from session token — Independent auth."""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")

    auth_str = str(authorization) if authorization else None
    if not auth_str:
        raise HTTPException(status_code=401, detail="No authorization header")

    token = auth_str.replace("Bearer ", "") if auth_str.startswith("Bearer ") else auth_str

    # Find session in database
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")

    # Check expiry
    expires_at = session["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user
    user_id = session["user_id"]
    try:
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = await db.users.find_one({"_id": user_id})
    except Exception as e:
        logger.error(f"Error finding user {user_id}: {e}")
        raise HTTPException(status_code=401, detail="Invalid user ID")

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    user_dict = dict(user)
    user_dict["id"] = str(user_dict.pop("_id"))
    return user_dict


async def get_user_from_token(token: str) -> Optional[dict]:
    """Get user from session token (for loan endpoints)."""
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        return None
    user_id = session["user_id"]
    try:
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = await db.users.find_one({"_id": user_id})
    except Exception:
        return None
    if not user:
        return None
    user_dict = dict(user)
    user_dict["id"] = str(user_dict.pop("_id"))
    return user_dict


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Require admin role."""
    user = await get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ═══════════════════════════════════════════════════════════════
# NOTIFICATION SERVICES
# ═══════════════════════════════════════════════════════════════

notification_service_instance = None
email_sender_instance = None


async def init_notification_services():
    """Initialize email, SMS, and push notification services."""
    global notification_service_instance, email_sender_instance

    try:
        from email_sender import init_email_sender
        email_sender_instance = init_email_sender(db)
        logger.info("📧 Email sender initialized")
    except Exception as e:
        logger.warning(f"⚠️ Email sender init failed: {e}")

    try:
        from notification_service import NotificationService
        config = await db.api_config.find_one({}) or {}
        notification_service_instance = NotificationService(config)
        notification_service_instance.set_tracking_db(db)  # Enable email tracking
        logger.info("🔔 Notification service initialized (with email tracking)")
    except Exception as e:
        logger.warning(f"⚠️ Notification service init failed: {e}")


# ═══════════════════════════════════════════════════════════════
# APP LIFESPAN
# ═══════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global client, db

    # ─── STARTUP ───
    logger.info("🚀 Ross Lending Solutions — Starting independent server...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info(f"📦 Connected to MongoDB: {DB_NAME}")

    # Initialize notification services
    await init_notification_services()

    # ─── REGISTER ROUTERS ───
    register_lending_routers(app)

    # ─── Create indexes ───
    await create_lending_indexes()

    logger.info("✅ Ross Lending Server ready!")
    logger.info(f"🌐 Running on port {LENDING_PORT}")

    yield

    # ─── SHUTDOWN ───
    logger.info("🛑 Shutting down Ross Lending server...")
    if client:
        client.close()


# ═══════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="Ross Lending Solutions API",
    description="Independent backend for Ross Lending Solutions LLC — OCCC Regulated Lender",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins for now (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
# ROUTER REGISTRATION
# ═══════════════════════════════════════════════════════════════

def register_lending_routers(app: FastAPI):
    """Import and register all lending-related routers."""

    # 1. Client Loans (apply, status, documents)
    try:
        from client_loans_router import client_loans_router, init_client_loans_router
        init_client_loans_router(db, get_current_user)
        app.include_router(client_loans_router, prefix="/api")
        logger.info("  ✅ Client Loans Router")
    except Exception as e:
        logger.error(f"  ❌ Client Loans Router: {e}")

    # 2. Loan Management (admin CRUD)
    try:
        from loan_management_router import loan_mgmt_router, init_loan_management
        init_loan_management(db, get_current_user)
        app.include_router(loan_mgmt_router, prefix="/api")
        logger.info("  ✅ Loan Management Router")
    except Exception as e:
        logger.error(f"  ❌ Loan Management Router: {e}")

    # 3. Regulated Lender (OCCC compliance)
    try:
        from regulated_lender_router import regulated_lender_router, init_regulated_lender
        init_regulated_lender(db, get_current_user, notification_service_instance)
        app.include_router(regulated_lender_router, prefix="/api")
        logger.info("  ✅ Regulated Lender Router")
    except Exception as e:
        logger.error(f"  ❌ Regulated Lender Router: {e}")

    # 4. Lending Routes (general lending endpoints)
    try:
        from lending_routes import lending_router, init_lending_router
        init_lending_router(db)
        app.include_router(lending_router, tags=["Ross Lending"])
        logger.info("  ✅ Lending Routes")
    except Exception as e:
        logger.error(f"  ❌ Lending Routes: {e}")

    # 5. Lending Admin Dashboard
    try:
        from lending_admin_dashboard_router import router as admin_dashboard_router, init_admin_dashboard
        init_admin_dashboard(db, get_current_user)
        app.include_router(admin_dashboard_router, prefix="/api", tags=["Lending Admin Dashboard"])
        logger.info("  ✅ Lending Admin Dashboard")
    except Exception as e:
        logger.error(f"  ❌ Lending Admin Dashboard: {e}")

    # 6. Lending Chat
    try:
        from lending_chat_routes import router as lending_chat_router
        app.include_router(lending_chat_router, tags=["Lending Chat"])
        logger.info("  ✅ Lending Chat Router")
    except Exception as e:
        logger.error(f"  ❌ Lending Chat Router: {e}")

    # 7. Lending Config
    try:
        from lending_config_router import router as lending_config_router, init_lending_config_router
        init_lending_config_router(db)
        app.include_router(lending_config_router, tags=["Lending Config"])
        logger.info("  ✅ Lending Config Router")
    except Exception as e:
        logger.error(f"  ❌ Lending Config Router: {e}")

    # 8. Loan Endpoints (products, applications CRUD)
    try:
        from loan_endpoints import loan_router, init_loan_endpoints
        init_loan_endpoints(db, get_current_user)
        app.include_router(loan_router, prefix="/api", tags=["Loan Products"])
        logger.info("  ✅ Loan Endpoints (Products)")
    except Exception as e:
        logger.warning(f"  ⚠️ Loan Endpoints: {e}")

    # 9. CAB Loans (Credit Access Business)
    try:
        from cab_endpoints import router as cab_router, init_cab_endpoints
        init_cab_endpoints(db, get_current_user, require_admin)
        app.include_router(cab_router, prefix="/api", tags=["CAB Loans"])
        logger.info("  ✅ CAB Loans Router")
    except Exception as e:
        logger.warning(f"  ⚠️ CAB Loans Router: {e}")

    # 10. Two-Factor Authentication (Admin 2FA)
    try:
        from two_factor_routes import two_factor_router, init_two_factor_router
        init_two_factor_router(db, get_current_user)
        app.include_router(two_factor_router, prefix="/api", tags=["Two-Factor Auth"])
        logger.info("  ✅ Two-Factor Auth Router (Admin)")
    except Exception as e:
        logger.warning(f"  ⚠️ Two-Factor Auth Router: {e}")

    # 11. Client 2FA (SMS verification for client portal)
    try:
        from client_2fa_router import client_2fa_router, init_client_2fa
        init_client_2fa(db)
        app.include_router(client_2fa_router, prefix="/api", tags=["Client 2FA"])
        logger.info("  ✅ Client 2FA Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Client 2FA Router: {e}")

    # 12. Credit Check (Underwriting)
    try:
        from credit_check_router import credit_check_router, init_credit_check
        init_credit_check(db, get_current_user)
        app.include_router(credit_check_router, prefix="/api", tags=["Credit Check"])
        logger.info("  ✅ Credit Check Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Credit Check Router: {e}")

    # 13. Client Notes
    try:
        from client_notes_router import client_notes_router, init_client_notes_router
        init_client_notes_router(db, get_current_user)
        app.include_router(client_notes_router, prefix="/api", tags=["Client Notes"])
        logger.info("  ✅ Client Notes Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Client Notes Router: {e}")

    # 14. Approval Engine (auto-decision rules)
    try:
        from approval_engine_router import approval_engine_router, init_approval_engine
        init_approval_engine(db, get_current_user)
        app.include_router(approval_engine_router, prefix="/api", tags=["Approval Engine"])
        logger.info("  ✅ Approval Engine Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Approval Engine Router: {e}")

    # 15. Auto Collections (automated reminders)
    try:
        from auto_collections_router import auto_collections_router, init_auto_collections
        init_auto_collections(db, get_current_user)
        app.include_router(auto_collections_router, prefix="/api", tags=["Auto Collections"])
        logger.info("  ✅ Auto Collections Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Auto Collections Router: {e}")

    # 16. Referrals
    try:
        from referral_routes import referral_router, init_referral_router
        init_referral_router(db, get_current_user)
        app.include_router(referral_router, prefix="/api", tags=["Referrals"])
        logger.info("  ✅ Referral Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Referral Router: {e}")

    # 17. OCCC Loan Engine (Calculator, Portfolio, Contracts, Reports, Audit)
    try:
        from loan_engine.router import loan_engine_router, init_loan_engine
        init_loan_engine(db, get_current_user)
        app.include_router(loan_engine_router, prefix="/api", tags=["Loan Engine (OCCC)"])
        logger.info("  ✅ Loan Engine Router (OCCC)")
    except Exception as e:
        logger.warning(f"  ⚠️ Loan Engine Router: {e}")

    # 18. OCCC Compliance (Audit Log, Trust Reconciliation, Complaints, Cancellations, Checklist)
    try:
        from occc_compliance_router import router as occc_compliance_router, init_occc_compliance
        init_occc_compliance(db, get_current_user)
        app.include_router(occc_compliance_router, tags=["OCCC Compliance"])
        logger.info("  ✅ OCCC Compliance Router")
    except Exception as e:
        logger.warning(f"  ⚠️ OCCC Compliance Router: {e}")

    # 19. Analytics (Visitor Tracking, Page Views, Dashboard)
    try:
        from analytics_endpoints import router as analytics_router, set_dependencies as init_analytics_deps
        init_analytics_deps(db)
        app.include_router(analytics_router, prefix="/api", tags=["Analytics"])
        logger.info("  ✅ Analytics Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Analytics Router: {e}")

    # 20. Password Reset (Forgot Password, Verify Code, Reset)
    try:
        import password_reset_service as prs_module
        from password_reset_service import PasswordResetService
        from password_reset_endpoints import router as password_reset_router
        prs_module.password_reset_service = PasswordResetService(db, notification_service=notification_service_instance)
        app.include_router(password_reset_router, prefix="/api", tags=["Password Reset"])
        logger.info("  ✅ Password Reset Router")
    except Exception as e:
        logger.warning(f"  ⚠️ Password Reset Router: {e}")

    # ═══════════════════════════════════════════════════════
    # LENDING AI BRAIN (Exclusivo Ross Lending)
    # ═══════════════════════════════════════════════════════

    # 21. Lending AI Brain (Cerebro de IA para Préstamos)
    lending_brain_instance = None
    try:
        from lending_ai_brain_service import LendingAIBrain
        from lending_ai_brain_endpoints import router as lending_brain_router, init_lending_ai_brain

        lending_brain_instance = LendingAIBrain(db, notification_service=notification_service_instance)
        init_lending_ai_brain(lending_brain_instance)
        app.include_router(lending_brain_router, prefix="/api", tags=["Lending AI Brain"])
        logger.info("  ✅ Lending AI Brain Router (Portfolio, Risk, Collections, Compliance, Chat)")
    except Exception as e:
        logger.warning(f"  ⚠️ Lending AI Brain Router: {e}")

    # 22. AI Automation (Email Tracking, Click Tracking)
    try:
        from ai_automation_service import init_ai_automation_service
        from ai_automation_router import router as ai_automation_router, init_ai_automation_router

        ai_auto_service = init_ai_automation_service(db, notification_service_instance, None)
        init_ai_automation_router(ai_auto_service)
        app.include_router(ai_automation_router, prefix="/api", tags=["AI Automation"])
        logger.info("  ✅ AI Automation Router (Email Tracking)")
    except Exception as e:
        logger.warning(f"  ⚠️ AI Automation Router: {e}")



# ═══════════════════════════════════════════════════════════════
# LENDING-SPECIFIC INDEXES
# ═══════════════════════════════════════════════════════════════

async def create_lending_indexes():
    """Create MongoDB indexes for lending collections."""
    try:
        # Loan applications
        await db.loan_applications.create_index("user_id")
        await db.loan_applications.create_index("status")
        await db.loan_applications.create_index("created_at")

        # Loans
        await db.loans.create_index("user_id")
        await db.loans.create_index("status")
        await db.loans.create_index("borrower_id")

        # Regulated loans
        await db.regulated_loans.create_index("borrower_id")
        await db.regulated_loans.create_index("status")

        # Payments
        await db.loan_payments.create_index("loan_id")
        await db.loan_payments.create_index("user_id")

        # Chat
        await db.lending_chat_conversations.create_index("user_id")
        await db.lending_chat_messages.create_index("conversation_id")

        # Users (shared, but we create our indexes)
        await db.users.create_index("email", unique=True, sparse=True)
        await db.users.create_index("phone", sparse=True)

        # Sessions
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at")

        logger.info("📊 Lending indexes created")
    except Exception as e:
        logger.warning(f"⚠️ Index creation: {e}")


# ═══════════════════════════════════════════════════════════════
# HEALTH & AUTH ENDPOINTS (Independent)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok",
        "service": "Ross Lending Solutions API",
        "version": "1.1.0",
        "database": db_status,
        "database_name": DB_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Get current user profile — Independent endpoint."""
    user = await get_current_user(authorization)
    # Remove sensitive fields
    user.pop("password", None)
    user.pop("hashed_password", None)
    # Mask SSN
    ssn = user.get("ssn_encrypted", "")
    if ssn and len(ssn) >= 4:
        user["ssn_masked"] = f"***-**-{ssn[-4:]}"
    return user


@app.put("/api/users/me")
async def update_me(request: Request, authorization: Optional[str] = Header(None)):
    """Update current user profile — Independent endpoint."""
    user = await get_current_user(authorization)
    body = await request.json()

    # Allowed fields to update
    allowed = [
        "name", "first_name", "last_name", "phone", "email",
        "date_of_birth", "ssn_encrypted",
        "address_street", "address_city", "address_state", "address_zip",
        "employer", "employment_type", "time_at_employer", "monthly_income",
        "bank_name", "avatar_url",
    ]

    update_data = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not update_data:
        return {"success": True, "message": "No changes"}

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": update_data}
    )

    return {"success": True, "message": "Profile updated"}


@app.post("/api/auth/login")
async def login(request: Request):
    """Login endpoint — Independent."""
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    import bcrypt
    stored_pw = user.get("password") or user.get("hashed_password", "")
    if isinstance(stored_pw, str):
        stored_pw = stored_pw.encode("utf-8")

    try:
        if not bcrypt.checkpw(password.encode("utf-8"), stored_pw):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = str(user["_id"])
    token = create_session_token(user_id)

    # Save session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "device_info": body.get("device_info", "lending-app"),
    })

    return {
        "success": True,
        "token": token,
        "session_token": token,
        "user": {
            "id": user_id,
            "name": user.get("name", ""),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "role": user.get("role", "client"),
        }
    }


@app.post("/api/auth/register")
async def register(request: Request):
    """Register new user — Independent."""
    body = await request.json()
    import bcrypt

    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    phone = body.get("phone", "").strip()
    password = body.get("password", "")

    if not name or not password:
        raise HTTPException(status_code=400, detail="Name and password required")
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or phone required")

    # Check existing
    if email:
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

    # Hash password
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    user_doc = {
        "name": name,
        "first_name": body.get("first_name", name.split()[0] if name else ""),
        "last_name": body.get("last_name", " ".join(name.split()[1:]) if name else ""),
        "email": email or None,
        "phone": phone or None,
        "password": hashed.decode("utf-8"),
        "role": "client",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "source": "lending-app",
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_session_token(user_id)

    # Save session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "device_info": body.get("device_info", "lending-app"),
    })

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "phone": phone,
            "role": "client",
        }
    }


@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Logout — Delete session."""
    if not authorization:
        return {"success": True}
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    await db.user_sessions.delete_one({"session_token": token})
    return {"success": True}


@app.post("/api/auth/phone-login")
async def phone_login(request: Request):
    """Phone + OTP login — Independent."""
    body = await request.json()
    phone = body.get("phone", "").strip()
    code = body.get("code", "")

    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")

    # Verify OTP
    otp_record = await db.otp_codes.find_one({
        "phone": phone,
        "code": code,
        "used": {"$ne": True},
    })

    if not otp_record:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # Mark OTP as used
    await db.otp_codes.update_one({"_id": otp_record["_id"]}, {"$set": {"used": True}})

    # Find or create user
    user = await db.users.find_one({"phone": phone})
    if not user:
        result = await db.users.insert_one({
            "phone": phone,
            "name": "",
            "role": "client",
            "created_at": datetime.now(timezone.utc),
            "source": "lending-app-phone",
        })
        user = await db.users.find_one({"_id": result.inserted_id})

    user_id = str(user["_id"])
    token = create_session_token(user_id)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "device_info": "lending-app-phone",
    })

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "phone": phone,
            "role": user.get("role", "client"),
        }
    }


@app.post("/api/auth/send-otp")
async def send_otp(request: Request):
    """Send OTP via Twilio — Independent."""
    body = await request.json()
    phone = body.get("phone", "").strip()

    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")

    import random
    code = str(random.randint(100000, 999999))

    # Save OTP
    await db.otp_codes.insert_one({
        "phone": phone,
        "code": code,
        "created_at": datetime.now(timezone.utc),
        "used": False,
    })

    # Send via Twilio
    try:
        config = await db.api_config.find_one({})
        if config:
            twilio_sid = config.get("TWILIO_ACCOUNT_SID") or config.get("twilio_account_sid")
            twilio_token = config.get("TWILIO_AUTH_TOKEN") or config.get("twilio_auth_token")
            twilio_from = config.get("TWILIO_PHONE_NUMBER") or config.get("twilio_phone_number")

            if twilio_sid and twilio_token and twilio_from:
                from twilio.rest import Client as TwilioClient
                twilio_client = TwilioClient(twilio_sid, twilio_token)
                twilio_client.messages.create(
                    body=f"Ross Lending: Your verification code is {code}",
                    from_=twilio_from,
                    to=phone,
                )
                logger.info(f"📱 OTP sent to {phone[-4:]}")
    except Exception as e:
        logger.error(f"Twilio OTP error: {e}")
        # Still return success — code is saved in DB for dev testing

    return {"success": True, "message": "Code sent"}


# ═══════════════════════════════════════════════════════════════
# USPS ADDRESS VALIDATION (Independent copy)
# ═══════════════════════════════════════════════════════════════

@app.post("/api/usps/address/validate-simple")
async def validate_address_simple(request: Request):
    """Validate address via USPS API."""
    body = await request.json()
    try:
        config = await db.api_config.find_one({})
        usps_key = config.get("USPS_API_KEY") or config.get("usps_api_key") if config else None
        if not usps_key:
            return {"valid": False, "dpvMessage": "USPS API not configured"}

        import httpx
        async with httpx.AsyncClient(timeout=10) as hc:
            resp = await hc.get(
                "https://secure.shippingapis.com/ShippingAPI.dll",
                params={
                    "API": "Verify",
                    "XML": f'<AddressValidateRequest USERID="{usps_key}"><Address><Address1></Address1><Address2>{body.get("street","")}</Address2><City>{body.get("city","")}</City><State>{body.get("state","")}</State><Zip5>{body.get("zip","")}</Zip5><Zip4></Zip4></Address></AddressValidateRequest>'
                }
            )
            import xml.etree.ElementTree as ET
            root = ET.fromstring(resp.text)
            error = root.find(".//Error")
            if error is not None:
                return {"valid": False, "dpvMessage": error.findtext("Description", "Address not found")}
            addr = root.find(".//Address")
            if addr is not None:
                return {
                    "valid": True,
                    "standardized": {
                        "streetAddress": addr.findtext("Address2", ""),
                        "city": addr.findtext("City", ""),
                        "state": addr.findtext("State", ""),
                        "ZIPCode": addr.findtext("Zip5", ""),
                        "ZIPPlus4": addr.findtext("Zip4", ""),
                    }
                }
    except Exception as e:
        logger.error(f"USPS validation error: {e}")
    return {"valid": False, "dpvMessage": "Validation unavailable"}


# ═══════════════════════════════════════════════════════════════
# PLAID ENDPOINTS (Independent copy)
# ═══════════════════════════════════════════════════════════════

@app.post("/api/plaid/create-link-token")
async def create_plaid_link_token(request: Request, authorization: Optional[str] = Header(None)):
    """Create Plaid Link token."""
    user = await get_current_user(authorization)
    try:
        config = await db.api_config.find_one({})
        plaid_client_id = config.get("PLAID_CLIENT_ID") or config.get("plaid_client_id") if config else None
        plaid_secret = config.get("PLAID_SECRET") or config.get("plaid_secret") if config else None
        plaid_env = config.get("PLAID_ENV", "sandbox")

        if not plaid_client_id or not plaid_secret:
            raise HTTPException(status_code=500, detail="Plaid not configured")

        env_url = {
            "sandbox": "https://sandbox.plaid.com",
            "development": "https://development.plaid.com",
            "production": "https://production.plaid.com",
        }.get(plaid_env, "https://sandbox.plaid.com")

        import httpx
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(f"{env_url}/link/token/create", json={
                "client_id": plaid_client_id,
                "secret": plaid_secret,
                "user": {"client_user_id": user["id"]},
                "client_name": "Ross Lending Solutions",
                "products": ["auth"],
                "country_codes": ["US"],
                "language": "en",
            })
            data = resp.json()
            if "link_token" in data:
                return {"link_token": data["link_token"]}
            raise HTTPException(status_code=500, detail=data.get("error_message", "Plaid error"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/plaid/exchange-token")
async def exchange_plaid_token(request: Request, authorization: Optional[str] = Header(None)):
    """Exchange Plaid public token for access token."""
    user = await get_current_user(authorization)
    body = await request.json()
    try:
        config = await db.api_config.find_one({})
        plaid_client_id = config.get("PLAID_CLIENT_ID") or config.get("plaid_client_id")
        plaid_secret = config.get("PLAID_SECRET") or config.get("plaid_secret")
        plaid_env = config.get("PLAID_ENV", "sandbox")

        env_url = {
            "sandbox": "https://sandbox.plaid.com",
            "development": "https://development.plaid.com",
            "production": "https://production.plaid.com",
        }.get(plaid_env, "https://sandbox.plaid.com")

        import httpx
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(f"{env_url}/item/public_token/exchange", json={
                "client_id": plaid_client_id,
                "secret": plaid_secret,
                "public_token": body.get("public_token"),
            })
            data = resp.json()
            if "access_token" in data:
                # Save to user's plaid data
                institution_name = body.get("institution", {}).get("name", "Bank")
                await db.plaid_items.update_one(
                    {"user_id": user["id"]},
                    {"$set": {
                        "access_token": data["access_token"],
                        "item_id": data["item_id"],
                        "institution_name": institution_name,
                        "updated_at": datetime.now(timezone.utc),
                    }},
                    upsert=True,
                )
                return {"success": True, "institution_name": institution_name}
            raise HTTPException(status_code=500, detail="Token exchange failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/plaid/fetch-my-auth")
async def fetch_plaid_auth(request: Request, authorization: Optional[str] = Header(None)):
    """Fetch bank auth details from Plaid."""
    user = await get_current_user(authorization)
    try:
        plaid_item = await db.plaid_items.find_one({"user_id": user["id"]})
        if not plaid_item or not plaid_item.get("access_token"):
            return {"success": False, "saved_accounts": 0}

        config = await db.api_config.find_one({})
        plaid_client_id = config.get("PLAID_CLIENT_ID") or config.get("plaid_client_id")
        plaid_secret = config.get("PLAID_SECRET") or config.get("plaid_secret")
        plaid_env = config.get("PLAID_ENV", "sandbox")

        env_url = {
            "sandbox": "https://sandbox.plaid.com",
            "development": "https://development.plaid.com",
            "production": "https://production.plaid.com",
        }.get(plaid_env, "https://sandbox.plaid.com")

        import httpx
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(f"{env_url}/auth/get", json={
                "client_id": plaid_client_id,
                "secret": plaid_secret,
                "access_token": plaid_item["access_token"],
            })
            data = resp.json()
            accounts = data.get("accounts", [])
            numbers = data.get("numbers", {}).get("ach", [])

            saved = 0
            for num in numbers:
                await db.plaid_accounts.update_one(
                    {"user_id": user["id"], "account_id": num["account_id"]},
                    {"$set": {
                        "routing": num.get("routing"),
                        "account": num.get("account"),
                        "wire_routing": num.get("wire_routing"),
                        "updated_at": datetime.now(timezone.utc),
                    }},
                    upsert=True,
                )
                saved += 1

            return {"success": True, "saved_accounts": saved}
    except Exception as e:
        logger.error(f"Plaid auth error: {e}")
        return {"success": False, "saved_accounts": 0}


# ═══════════════════════════════════════════════════════════════
# EMPLOYER SEARCH (Independent copy)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/employers/search")
async def search_employers(q: str = "", limit: int = 6):
    """Search employers from cached database."""
    if not q or len(q) < 2:
        return {"employers": []}
    try:
        results = await db.employers.find(
            {"name": {"$regex": q, "$options": "i"}},
            {"name": 1, "industry": 1, "city": 1}
        ).limit(limit).to_list(limit)
        return {"employers": [{"name": r.get("name"), "industry": r.get("industry"), "city": r.get("city")} for r in results]}
    except Exception:
        return {"employers": []}


# ═══════════════════════════════════════════════════════════════
# PUSH NOTIFICATIONS (Independent registration)
# ═══════════════════════════════════════════════════════════════

@app.post("/api/push-token/register")
async def register_push_token(request: Request, authorization: Optional[str] = Header(None)):
    """Register Expo push token for the current user."""
    user = await get_current_user(authorization)
    body = await request.json()
    push_token = body.get("push_token") or body.get("token")

    if not push_token:
        raise HTTPException(status_code=400, detail="Push token required")

    await db.push_tokens.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "token": push_token,
            "platform": body.get("platform", "ios"),
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# API CONFIG (for admin panel)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/admin/api-config")
async def get_api_config(authorization: Optional[str] = Header(None)):
    """Get API configuration — Admin only."""
    await require_admin(authorization)
    config = await db.api_config.find_one({})
    if config:
        config["_id"] = str(config["_id"])
    return config or {}


@app.put("/api/admin/api-config")
async def update_api_config(request: Request, authorization: Optional[str] = Header(None)):
    """Update API configuration — Admin only."""
    await require_admin(authorization)
    body = await request.json()
    body["updated_at"] = datetime.now(timezone.utc)
    await db.api_config.update_one({}, {"$set": body}, upsert=True)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# STRIPE PAYMENT METHODS (Independent)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/payment-methods")
async def get_payment_methods(authorization: Optional[str] = Header(None)):
    """Get user's saved payment methods."""
    user = await get_current_user(authorization)
    methods = await db.payment_methods.find(
        {"user_id": user["id"]},
        {"_id": 1, "type": 1, "bank_name": 1, "name": 1, "account_last4": 1, "last4": 1}
    ).to_list(20)
    for m in methods:
        m["_id"] = str(m["_id"])
    return methods


# ═══════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "lending_server:app",
        host="0.0.0.0",
        port=LENDING_PORT,
        reload=True,
    )
