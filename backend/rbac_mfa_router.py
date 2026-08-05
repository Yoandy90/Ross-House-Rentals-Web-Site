"""
═══════════════════════════════════════════════════════════════════════════════
 RBAC + MFA Router — Ross Lending Solutions LLC
 Granular Role-Based Access Control & Multi-Factor Authentication
 Methods: SMS (Twilio), Email, TOTP (Authenticator App)
═══════════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, HTTPException, Request, Query, Body
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import pyotp
import qrcode
import io
import base64
import secrets
import hashlib
import random
import os
from dotenv import load_dotenv

load_dotenv()

rbac_mfa_router = APIRouter()

_db = None
_get_current_user = None

def init_rbac_mfa(db, get_current_user_func):
    global _db, _get_current_user
    _db = db
    _get_current_user = get_current_user_func


# ═══════════════════════════════════════════════════════════════════════════════
# TWILIO SMS HELPER (with Ross Lending descriptor)
# ═══════════════════════════════════════════════════════════════════════════════
def _send_sms_twilio(to_phone: str, code: str):
    """Send SMS via Twilio with Ross Lending branding. Reads credentials from DB first, then .env."""
    try:
        from twilio.rest import Client
        import asyncio
        
        sid = None
        token = None
        from_number = None
        
        # Try reading from DB (api_config collection)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're inside an async context, use sync approach
                import pymongo
                mongo_url = os.getenv("MONGO_URL", "")
                db_name = os.getenv("DB_NAME", "taxportal")
                sync_client = pymongo.MongoClient(mongo_url)
                config = sync_client[db_name]["api_config"].find_one({})
                if config:
                    sid = config.get("twilio_account_sid") or sid
                    token = config.get("twilio_auth_token") or token
                    from_number = config.get("twilio_phone_number") or from_number
                sync_client.close()
        except Exception as db_err:
            print(f"DB config read error: {db_err}")
        
        # Fallback to .env
        if not sid:
            sid = os.getenv("TWILIO_ACCOUNT_SID")
        if not token:
            token = os.getenv("TWILIO_AUTH_TOKEN")
        if not from_number:
            from_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if not all([sid, token, from_number]):
            raise Exception("Twilio not configured")
        
        # Normalize phone number
        clean_phone = to_phone.replace('-','').replace(' ','').replace('(','').replace(')','').strip()
        if not clean_phone.startswith("+"):
            clean_phone = f"+1{clean_phone}"
        
        client = Client(sid, token)
        message = client.messages.create(
            to=clean_phone,
            from_=from_number,
            body=f"[Ross Lending] Tu código de verificación es: {code}. No compartas este código. Válido por 5 minutos."
        )
        print(f"SMS sent to {clean_phone[-4:]}: {message.sid}")
        return True
    except Exception as e:
        print(f"Twilio SMS error: {e}")
        return False

def _send_email_code(to_email: str, code: str):
    """Send verification code via email."""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", os.getenv("EMAIL_USER", ""))
        smtp_pass = os.getenv("SMTP_PASS", os.getenv("EMAIL_PASS", ""))
        from_email = os.getenv("FROM_EMAIL", smtp_user)
        
        if not smtp_user or not smtp_pass:
            # Fallback: store code in DB for manual verification
            print(f"SMTP not configured. Email code for {to_email}: {code}")
            return True
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Ross Lending - Código de Verificación: {code}"
        msg["From"] = f"Ross Lending Solutions <{from_email}>"
        msg["To"] = to_email
        
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;background:#0C1220;border-radius:16px;border:1px solid #1F2937;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#10b981,#34d399);border-radius:12px;line-height:48px;color:#fff;font-weight:bold;font-size:18px;">RLS</div>
            </div>
            <h2 style="color:#fff;text-align:center;font-size:18px;margin-bottom:8px;">Código de Verificación</h2>
            <p style="color:#94a3b8;text-align:center;font-size:13px;">Usa este código para iniciar sesión en el Admin Panel</p>
            <div style="background:#111827;border:2px solid #10b981;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
                <span style="font-size:32px;font-weight:bold;color:#10b981;letter-spacing:8px;">{code}</span>
            </div>
            <p style="color:#64748b;text-align:center;font-size:11px;">Válido por 5 minutos. No compartas este código.</p>
            <p style="color:#334155;text-align:center;font-size:10px;margin-top:16px;">Ross Lending Solutions LLC</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email send error: {e}")
        return True  # Don't block login if email fails

# ═══════════════════════════════════════════════════════════════════════════════
# ROLE & PERMISSION DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

ROLES = {
    "super_admin": {
        "label": "Super Administrador",
        "level": 100,
        "description": "Acceso total al sistema, gestión de roles y MFA",
    },
    "admin": {
        "label": "Administrador",
        "level": 80,
        "description": "Acceso completo excepto gestión de roles",
    },
    "manager": {
        "label": "Gerente",
        "level": 60,
        "description": "Gestión de préstamos, clientes y pagos",
    },
    "analyst": {
        "label": "Analista",
        "level": 40,
        "description": "Underwriting, compliance y reportes",
    },
    "viewer": {
        "label": "Solo Lectura",
        "level": 20,
        "description": "Visualización de dashboards sin edición",
    },
}

# Permission matrix: role -> module -> actions
PERMISSIONS = {
    "super_admin": {
        "dashboard":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "clientes":        {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "prestamos":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "solicitudes":     {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "pagos":           {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "cobros":          {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "calculadora":     {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "documentos":      {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "notificaciones":  {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "underwriting":    {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "compliance":      {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "auditoria":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "reportes":        {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "configuracion":   {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "seguridad":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
    },
    "admin": {
        "dashboard":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "clientes":        {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "prestamos":       {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "solicitudes":     {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "pagos":           {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "cobros":          {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "calculadora":     {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "documentos":      {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "notificaciones":  {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "underwriting":    {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "compliance":      {"view": True, "create": True, "edit": True, "delete": True, "export": True},
        "auditoria":       {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "reportes":        {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "configuracion":   {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "seguridad":       {"view": True, "create": False, "edit": False, "delete": False, "export": False},
    },
    "manager": {
        "dashboard":       {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "clientes":        {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "prestamos":       {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "solicitudes":     {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "pagos":           {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "cobros":          {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "calculadora":     {"view": True, "create": True, "edit": False, "delete": False, "export": True},
        "documentos":      {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "notificaciones":  {"view": True, "create": True, "edit": False, "delete": False, "export": False},
        "underwriting":    {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "compliance":      {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "auditoria":       {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "reportes":        {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "configuracion":   {"view": False, "create": False, "edit": False, "delete": False, "export": False},
        "seguridad":       {"view": False, "create": False, "edit": False, "delete": False, "export": False},
    },
    "analyst": {
        "dashboard":       {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "clientes":        {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "prestamos":       {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "solicitudes":     {"view": True, "create": False, "edit": True, "delete": False, "export": True},
        "pagos":           {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "cobros":          {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "calculadora":     {"view": True, "create": True, "edit": False, "delete": False, "export": True},
        "documentos":      {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "notificaciones":  {"view": False, "create": False, "edit": False, "delete": False, "export": False},
        "underwriting":    {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "compliance":      {"view": True, "create": True, "edit": True, "delete": False, "export": True},
        "auditoria":       {"view": True, "create": False, "edit": False, "delete": False, "export": True},
        "reportes":        {"view": True, "create": True, "edit": False, "delete": False, "export": True},
        "configuracion":   {"view": False, "create": False, "edit": False, "delete": False, "export": False},
        "seguridad":       {"view": False, "create": False, "edit": False, "delete": False, "export": False},
    },
    "viewer": {
        "dashboard":       {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "clientes":        {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "prestamos":       {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "solicitudes":     {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "pagos":           {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "cobros":          {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "calculadora":     {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "documentos":      {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "notificaciones":  {"view": False, "create": False, "edit": False, "delete": False, "export": False},
        "underwriting":    {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "compliance":      {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "auditoria":       {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "reportes":        {"view": True, "create": False, "edit": False, "delete": False, "export": False},
        "configuracion":   {"view": False, "create": False, "edit": False, "delete": False, "export": False},
        "seguridad":       {"view": False, "create": False, "edit": False, "delete": False, "export": False},
    },
}

# Module → Sidebar route mapping (for frontend filtering)
MODULE_ROUTES = {
    "dashboard": "/admin",
    "clientes": "/admin/clientes",
    "prestamos": "/admin/prestamos",
    "solicitudes": "/admin/solicitudes",
    "pagos": "/admin/pagos",
    "cobros": "/admin/cobros",
    "calculadora": "/admin/calculadora",
    "documentos": "/admin/documentos",
    "notificaciones": "/admin/notificaciones",
    "underwriting": "/admin/underwriting",
    "compliance": "/admin/compliance",
    "auditoria": "/admin/auditoria",
    "reportes": "/admin/reportes",
    "configuracion": "/admin/configuracion",
    "seguridad": "/admin/seguridad",
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _auth_admin(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    admin_role = user.get("admin_role", "admin") if user.get("role") == "admin" else None
    if user.get("role") not in ["admin", "office_assistant"] and admin_role is None:
        raise HTTPException(403, "Acceso denegado")
    # Fallback: if no admin_role set, treat 'admin' as 'super_admin' for backwards compat
    if not admin_role and user.get("role") == "admin":
        admin_role = "super_admin"
    user["admin_role"] = admin_role
    return user


def get_permissions(admin_role: str) -> dict:
    """Get full permissions for a given admin role."""
    return PERMISSIONS.get(admin_role, PERMISSIONS["viewer"])


def check_permission(admin_role: str, module: str, action: str) -> bool:
    """Check if a role has a specific action on a module."""
    perms = get_permissions(admin_role)
    mod_perms = perms.get(module, {})
    return mod_perms.get(action, False)


# ═══════════════════════════════════════════════════════════════════════════════
# RBAC ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@rbac_mfa_router.get("/admin/rbac/my-permissions")
async def my_permissions(request: Request):
    """Return the current user's role and all their permissions."""
    user = await _auth_admin(request)
    role = user.get("admin_role", "super_admin")
    perms = get_permissions(role)
    
    # Build allowed routes
    allowed_routes = []
    for module, module_perms in perms.items():
        if module_perms.get("view"):
            route = MODULE_ROUTES.get(module)
            if route:
                allowed_routes.append(route)
    
    return {
        "user_id": user.get("id"),
        "email": user.get("email"),
        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "role": role,
        "role_label": ROLES.get(role, {}).get("label", role),
        "role_level": ROLES.get(role, {}).get("level", 0),
        "permissions": perms,
        "allowed_routes": allowed_routes,
        "mfa_enabled": user.get("mfa_enabled", False),
    }


@rbac_mfa_router.get("/admin/rbac/roles")
async def list_roles(request: Request):
    """List all available roles and their permission summaries."""
    user = await _auth_admin(request)
    if not check_permission(user["admin_role"], "seguridad", "view"):
        raise HTTPException(403, "Sin permiso para ver roles")
    
    roles_list = []
    for key, meta in ROLES.items():
        perms = PERMISSIONS.get(key, {})
        view_count = sum(1 for m in perms.values() if m.get("view"))
        edit_count = sum(1 for m in perms.values() if m.get("edit"))
        total_modules = len(perms)
        roles_list.append({
            "role": key,
            **meta,
            "modules_view": view_count,
            "modules_edit": edit_count,
            "total_modules": total_modules,
        })
    
    return {"roles": roles_list}


@rbac_mfa_router.get("/admin/rbac/role/{role_name}")
async def get_role_detail(request: Request, role_name: str):
    """Get detailed permissions for a specific role."""
    user = await _auth_admin(request)
    if not check_permission(user["admin_role"], "seguridad", "view"):
        raise HTTPException(403, "Sin permiso")
    if role_name not in ROLES:
        raise HTTPException(404, "Rol no encontrado")
    return {
        "role": role_name,
        **ROLES[role_name],
        "permissions": PERMISSIONS[role_name],
    }


@rbac_mfa_router.get("/admin/rbac/team")
async def list_admin_team(request: Request):
    """List all admin/staff users with their roles."""
    user = await _auth_admin(request)
    if not check_permission(user["admin_role"], "seguridad", "view"):
        raise HTTPException(403, "Sin permiso")
    
    team = []
    async for u in _db["users"].find({"role": {"$in": ["admin", "office_assistant"]}}).sort("created_at", -1):
        role = u.get("admin_role", "admin")
        team.append({
            "id": str(u["_id"]),
            "email": u.get("email", ""),
            "first_name": u.get("first_name", u.get("name", "")),
            "last_name": u.get("last_name", ""),
            "phone": u.get("phone", ""),
            "role": u.get("role", ""),
            "admin_role": role,
            "admin_role_label": ROLES.get(role, {}).get("label", role),
            "mfa_enabled": u.get("mfa_enabled", False),
            "last_login": u.get("last_login"),
            "created_at": u.get("created_at"),
        })
    
    return {"team": team, "total": len(team)}


@rbac_mfa_router.put("/admin/rbac/team/{user_id}/role")
async def update_user_role(request: Request, user_id: str, body: dict = Body(...)):
    """Update a team member's admin_role. Only super_admin can do this."""
    admin = await _auth_admin(request)
    if admin["admin_role"] != "super_admin":
        raise HTTPException(403, "Solo el Super Administrador puede cambiar roles")
    
    new_role = body.get("admin_role")
    if new_role not in ROLES:
        raise HTTPException(400, f"Rol inválido. Opciones: {', '.join(ROLES.keys())}")
    
    # Prevent self-demotion from super_admin
    if str(admin.get("id")) == user_id and new_role != "super_admin":
        raise HTTPException(400, "No puedes cambiar tu propio rol de Super Administrador")
    
    # Update user
    try:
        oid = ObjectId(user_id)
        result = await _db["users"].update_one({"_id": oid}, {"$set": {"admin_role": new_role, "updated_at": datetime.now(timezone.utc).isoformat()}})
    except Exception:
        result = await _db["users"].update_one({"_id": user_id}, {"$set": {"admin_role": new_role, "updated_at": datetime.now(timezone.utc).isoformat()}})
    
    if result.modified_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    
    # Audit log
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(
            user_id=str(admin.get("id")),
            user_name=admin.get("email", ""),
            action="change_user_role",
            module="seguridad",
            severity="critical",
            details={"target_user": user_id, "new_role": new_role},
        )
    except Exception:
        pass
    
    return {"success": True, "message": f"Rol actualizado a {ROLES[new_role]['label']}"}


# ═══════════════════════════════════════════════════════════════════════════════
# MFA (TOTP) ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@rbac_mfa_router.post("/admin/mfa/setup")
async def mfa_setup(request: Request):
    """Generate TOTP secret and QR code for MFA setup."""
    user = await _auth_admin(request)
    
    # Generate TOTP secret
    secret = pyotp.random_base32()
    
    # Generate provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.get("email", "admin"),
        issuer_name="Ross Lending Admin"
    )
    
    # Generate QR code as base64
    qr = qrcode.make(provisioning_uri)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    # Generate recovery codes
    recovery_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    hashed_codes = [hashlib.sha256(c.encode()).hexdigest() for c in recovery_codes]
    
    # Store pending MFA setup (not yet verified)
    uid = user.get("id")
    try:
        oid = ObjectId(uid)
        await _db["users"].update_one({"_id": oid}, {"$set": {
            "mfa_secret_pending": secret,
            "mfa_recovery_hashes_pending": hashed_codes,
        }})
    except Exception:
        await _db["users"].update_one({"_id": uid}, {"$set": {
            "mfa_secret_pending": secret,
            "mfa_recovery_hashes_pending": hashed_codes,
        }})
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "provisioning_uri": provisioning_uri,
        "recovery_codes": recovery_codes,
        "message": "Escanea el QR con Google Authenticator o similar. Luego verifica con un código para activar MFA.",
    }


@rbac_mfa_router.post("/admin/mfa/verify-setup")
async def mfa_verify_setup(request: Request, body: dict = Body(...)):
    """Verify the TOTP code to activate MFA. Must be called after /setup."""
    user = await _auth_admin(request)
    code = body.get("code", "").strip()
    
    if not code:
        raise HTTPException(400, "Código requerido")
    
    # Get pending secret
    uid = user.get("id")
    try:
        db_user = await _db["users"].find_one({"_id": ObjectId(uid)})
    except Exception:
        db_user = await _db["users"].find_one({"_id": uid})
    
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    
    pending_secret = db_user.get("mfa_secret_pending")
    if not pending_secret:
        raise HTTPException(400, "No hay configuración MFA pendiente. Llama primero a /admin/mfa/setup")
    
    # Verify TOTP
    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(400, "Código inválido. Intenta de nuevo.")
    
    # Activate MFA
    recovery_hashes = db_user.get("mfa_recovery_hashes_pending", [])
    update = {
        "mfa_enabled": True,
        "mfa_secret": pending_secret,
        "mfa_recovery_hashes": recovery_hashes,
        "mfa_enabled_at": datetime.now(timezone.utc).isoformat(),
    }
    unset = {"mfa_secret_pending": "", "mfa_recovery_hashes_pending": ""}
    
    try:
        await _db["users"].update_one({"_id": ObjectId(uid)}, {"$set": update, "$unset": unset})
    except Exception:
        await _db["users"].update_one({"_id": uid}, {"$set": update, "$unset": unset})
    
    # Audit
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(user.get("id"), user.get("email", ""), "mfa_enabled", "seguridad", "critical", {})
    except Exception:
        pass
    
    return {"success": True, "message": "MFA activado exitosamente. A partir de ahora necesitarás tu código TOTP para iniciar sesión."}


@rbac_mfa_router.post("/admin/mfa/disable")
async def mfa_disable(request: Request, body: dict = Body(...)):
    """Disable MFA. Requires current TOTP code or recovery code."""
    user = await _auth_admin(request)
    code = body.get("code", "").strip()
    
    if not code:
        raise HTTPException(400, "Código TOTP o de recuperación requerido")
    
    uid = user.get("id")
    try:
        db_user = await _db["users"].find_one({"_id": ObjectId(uid)})
    except Exception:
        db_user = await _db["users"].find_one({"_id": uid})
    
    if not db_user or not db_user.get("mfa_enabled"):
        raise HTTPException(400, "MFA no está habilitado")
    
    secret = db_user.get("mfa_secret")
    
    # Check TOTP code
    totp = pyotp.TOTP(secret)
    valid = totp.verify(code, valid_window=1)
    
    # If TOTP fails, check recovery codes
    if not valid:
        code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
        recovery_hashes = db_user.get("mfa_recovery_hashes", [])
        if code_hash in recovery_hashes:
            valid = True
            # Remove used recovery code
            recovery_hashes.remove(code_hash)
            try:
                await _db["users"].update_one({"_id": ObjectId(uid)}, {"$set": {"mfa_recovery_hashes": recovery_hashes}})
            except Exception:
                await _db["users"].update_one({"_id": uid}, {"$set": {"mfa_recovery_hashes": recovery_hashes}})
    
    if not valid:
        raise HTTPException(400, "Código inválido")
    
    # Disable MFA
    unset = {"mfa_secret": "", "mfa_recovery_hashes": "", "mfa_enabled_at": ""}
    try:
        await _db["users"].update_one({"_id": ObjectId(uid)}, {"$set": {"mfa_enabled": False}, "$unset": unset})
    except Exception:
        await _db["users"].update_one({"_id": uid}, {"$set": {"mfa_enabled": False}, "$unset": unset})
    
    try:
        from audit_trail_router import log_audit_event
        await log_audit_event(user.get("id"), user.get("email", ""), "mfa_disabled", "seguridad", "critical", {})
    except Exception:
        pass
    
    return {"success": True, "message": "MFA desactivado"}


@rbac_mfa_router.post("/admin/mfa/verify-login")
async def mfa_verify_login(request: Request, body: dict = Body(...)):
    """Verify MFA code during login. Supports SMS, Email, TOTP, and recovery codes."""
    email = body.get("email", "")
    code = body.get("code", "").strip()
    session_token = body.get("session_token", "")
    
    if not email or not code:
        raise HTTPException(400, "Email y código requeridos")
    
    db_user = await _db["users"].find_one({"email": email})
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    
    if not db_user.get("mfa_enabled"):
        return {"verified": True, "message": "MFA no requerido"}
    
    method = db_user.get("mfa_method", "sms")
    valid = False
    
    # ── Check TOTP (Authenticator App) ──
    if method == "totp":
        secret = db_user.get("mfa_secret")
        if secret:
            totp = pyotp.TOTP(secret)
            valid = totp.verify(code, valid_window=1)
    
    # ── Check SMS/Email code (6-digit stored hash) ──
    if not valid and method in ("sms", "email"):
        stored_hash = db_user.get("mfa_login_code")
        expires_str = db_user.get("mfa_login_code_expires", "")
        attempts = db_user.get("mfa_login_attempts", 0)
        
        if attempts >= 5:
            raise HTTPException(429, "Demasiados intentos. Solicita un nuevo código.")
        
        if stored_hash and expires_str:
            try:
                expires = datetime.fromisoformat(expires_str)
            except Exception:
                expires = datetime.now(timezone.utc)
            if datetime.now(timezone.utc) <= expires:
                if hashlib.sha256(code.encode()).hexdigest() == stored_hash:
                    valid = True
                    await _db["users"].update_one(
                        {"_id": db_user["_id"]},
                        {"$unset": {"mfa_login_code": "", "mfa_login_code_expires": "", "mfa_login_attempts": ""}}
                    )
                else:
                    await _db["users"].update_one(
                        {"_id": db_user["_id"]},
                        {"$inc": {"mfa_login_attempts": 1}}
                    )
            else:
                raise HTTPException(400, "Código expirado. Solicita uno nuevo.")
    
    # ── Check recovery codes (any method) ──
    if not valid:
        code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
        recovery_hashes = db_user.get("mfa_recovery_hashes", [])
        if code_hash in recovery_hashes:
            valid = True
            recovery_hashes.remove(code_hash)
            await _db["users"].update_one({"_id": db_user["_id"]}, {"$set": {"mfa_recovery_hashes": recovery_hashes}})
    
    if not valid:
        raise HTTPException(400, "Código MFA inválido")
    
    return {"verified": True, "session_token": session_token, "message": "MFA verificado"}


@rbac_mfa_router.get("/admin/mfa/status")
async def mfa_status(request: Request):
    """Check current user's MFA status and preferred method."""
    user = await _auth_admin(request)
    uid = user.get("id")
    try:
        db_user = await _db["users"].find_one({"_id": ObjectId(uid)})
    except Exception:
        db_user = await _db["users"].find_one({"_id": uid})
    
    return {
        "mfa_enabled": db_user.get("mfa_enabled", False) if db_user else False,
        "mfa_method": db_user.get("mfa_method", "sms") if db_user else "sms",
        "mfa_enabled_at": db_user.get("mfa_enabled_at") if db_user else None,
        "recovery_codes_remaining": len(db_user.get("mfa_recovery_hashes", [])) if db_user else 0,
        "phone": db_user.get("phone", "") if db_user else "",
        "email": db_user.get("email", "") if db_user else "",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MFA METHOD PREFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

@rbac_mfa_router.put("/admin/mfa/set-method")
async def set_mfa_method(request: Request, body: dict = Body(...)):
    """Set preferred MFA method: 'sms', 'email', or 'totp'."""
    user = await _auth_admin(request)
    method = body.get("method", "sms")
    if method not in ("sms", "email", "totp"):
        raise HTTPException(400, "Método inválido. Opciones: sms, email, totp")
    
    uid = user.get("id")
    update_data: dict = {"mfa_method": method, "mfa_enabled": True}
    
    if method == "sms":
        phone = body.get("phone", "")
        if phone:
            update_data["phone"] = phone
    
    try:
        await _db["users"].update_one({"_id": ObjectId(uid)}, {"$set": update_data})
    except Exception:
        await _db["users"].update_one({"_id": uid}, {"$set": update_data})
    
    labels = {"sms": "SMS", "email": "Email", "totp": "Authenticator App"}
    return {"success": True, "method": method, "message": f"Método 2FA actualizado a {labels[method]}"}


# ═══════════════════════════════════════════════════════════════════════════════
# MFA SEND CODE (SMS / EMAIL) — Called during login
# ═══════════════════════════════════════════════════════════════════════════════

@rbac_mfa_router.post("/admin/mfa/send-code")
async def mfa_send_code(body: dict = Body(...)):
    """Send 2FA verification code via SMS or Email after password is verified."""
    email = body.get("email", "")
    if not email:
        raise HTTPException(400, "Email requerido")
    
    db_user = await _db["users"].find_one({"email": email})
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    
    if not db_user.get("mfa_enabled", False):
        return {"required": False, "message": "MFA no habilitado"}
    
    method = db_user.get("mfa_method", "sms")
    code = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Store code hash in DB
    await _db["users"].update_one(
        {"_id": db_user["_id"]},
        {"$set": {
            "mfa_login_code": hashlib.sha256(code.encode()).hexdigest(),
            "mfa_login_code_expires": expires.isoformat(),
            "mfa_login_attempts": 0,
        }}
    )
    
    sent = False
    if method == "sms":
        phone = db_user.get("phone", "")
        if not phone:
            raise HTTPException(400, "No hay teléfono configurado para SMS 2FA")
        sent = _send_sms_twilio(phone, code)
    elif method == "email":
        sent = _send_email_code(email, code)
    elif method == "totp":
        return {"required": True, "method": "totp", "message": "Ingresa el código de tu app authenticator"}
    
    if not sent:
        raise HTTPException(500, "Error enviando código de verificación")
    
    if method == "sms":
        phone = db_user.get("phone", "")
        masked = f"***-***-{phone[-4:]}" if len(phone) >= 4 else "***"
    else:
        parts = email.split("@")
        masked = f"{parts[0][:2]}***@{parts[1]}" if len(parts) == 2 else "***"
    
    return {
        "required": True,
        "method": method,
        "sent_to": masked,
        "message": f"Código enviado vía {method.upper()}"
    }
