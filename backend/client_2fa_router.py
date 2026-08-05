"""
═══════════════════════════════════════════════════════════════════════════════
 Client 2FA Router — Ross Lending Solutions
 SMS 2FA for client portal login + Device Trust (30-day remember)
═══════════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timezone, timedelta
import hashlib
import random
import secrets
import os
from dotenv import load_dotenv

load_dotenv()

client_2fa_router = APIRouter()

_db = None

def init_client_2fa(db):
    global _db
    _db = db


def _send_sms_twilio_client(to_phone: str, code: str):
    """Send SMS via Twilio with Ross Lending branding for client 2FA."""
    try:
        from twilio.rest import Client
        
        sid = None
        token = None
        from_number = None
        
        # Read from DB api_config
        try:
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
        if not sid: sid = os.getenv("TWILIO_ACCOUNT_SID")
        if not token: token = os.getenv("TWILIO_AUTH_TOKEN")
        if not from_number: from_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if not all([sid, token, from_number]):
            raise Exception("Twilio not configured")
        
        clean_phone = to_phone.replace('-','').replace(' ','').replace('(','').replace(')','').strip()
        if not clean_phone.startswith("+"):
            clean_phone = f"+1{clean_phone}"
        
        client = Client(sid, token)
        message = client.messages.create(
            to=clean_phone,
            from_=from_number,
            body=f"[Ross Lending] Tu código de verificación es: {code}. No compartas este código. Válido por 5 minutos."
        )
        print(f"Client 2FA SMS sent to {clean_phone[-4:]}: {message.sid}")
        return True
    except Exception as e:
        print(f"Client 2FA SMS error: {e}")
        return False


@client_2fa_router.post("/auth/lending/2fa/send-code")
async def client_send_2fa_code(body: dict = Body(...)):
    """Send 2FA SMS code to client after password auth succeeds."""
    email = body.get("email", "")
    session_token = body.get("session_token", "")
    device_token = body.get("device_token", "")
    
    if not email:
        raise HTTPException(400, "Email requerido")
    
    db_user = await _db["users"].find_one({"email": email})
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    
    phone = db_user.get("phone", "")
    if not phone:
        return {"required": False, "message": "No phone - 2FA skipped"}
    
    # Check if device is trusted (30-day remember)
    if device_token:
        trusted_devices = db_user.get("trusted_devices", [])
        for td in trusted_devices:
            if td.get("token_hash") == hashlib.sha256(device_token.encode()).hexdigest():
                expires = td.get("expires", "")
                try:
                    if datetime.fromisoformat(expires) > datetime.now(timezone.utc):
                        return {"required": False, "trusted": True, "message": "Dispositivo confiable"}
                except:
                    pass
        # Clean expired tokens
        await _db["users"].update_one(
            {"_id": db_user["_id"]},
            {"$pull": {"trusted_devices": {"expires": {"$lt": datetime.now(timezone.utc).isoformat()}}}}
        )
    
    # Generate and send code
    code = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    await _db["users"].update_one(
        {"_id": db_user["_id"]},
        {"$set": {
            "client_2fa_code": hashlib.sha256(code.encode()).hexdigest(),
            "client_2fa_expires": expires.isoformat(),
            "client_2fa_attempts": 0,
        }}
    )
    
    sent = _send_sms_twilio_client(phone, code)
    if not sent:
        raise HTTPException(500, "Error enviando código de verificación")
    
    masked = f"***-***-{phone[-4:]}" if len(phone) >= 4 else "***"
    
    return {
        "required": True,
        "sent_to": masked,
        "message": f"Código enviado a {masked}"
    }


@client_2fa_router.post("/auth/lending/2fa/verify")
async def client_verify_2fa(body: dict = Body(...)):
    """Verify client 2FA code. Optionally trust device for 30 days."""
    email = body.get("email", "")
    code = body.get("code", "").strip()
    session_token = body.get("session_token", "")
    remember_device = body.get("remember_device", False)
    
    if not email or not code:
        raise HTTPException(400, "Email y código requeridos")
    
    db_user = await _db["users"].find_one({"email": email})
    if not db_user:
        raise HTTPException(404, "Usuario no encontrado")
    
    # Check attempts
    attempts = db_user.get("client_2fa_attempts", 0)
    if attempts >= 5:
        raise HTTPException(429, "Demasiados intentos. Solicita un nuevo código.")
    
    # Verify code
    stored_hash = db_user.get("client_2fa_code")
    expires_str = db_user.get("client_2fa_expires", "")
    
    if not stored_hash or not expires_str:
        raise HTTPException(400, "No hay código pendiente. Solicita uno nuevo.")
    
    try:
        expires = datetime.fromisoformat(expires_str)
    except:
        expires = datetime.now(timezone.utc)
    
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(400, "Código expirado. Solicita uno nuevo.")
    
    if hashlib.sha256(code.encode()).hexdigest() != stored_hash:
        await _db["users"].update_one(
            {"_id": db_user["_id"]},
            {"$inc": {"client_2fa_attempts": 1}}
        )
        raise HTTPException(400, "Código incorrecto")
    
    # Code is valid — clear it
    update = {
        "$unset": {"client_2fa_code": "", "client_2fa_expires": "", "client_2fa_attempts": ""}
    }
    
    # Generate device trust token if requested
    device_token = None
    if remember_device:
        device_token = secrets.token_urlsafe(48)
        trust_entry = {
            "token_hash": hashlib.sha256(device_token.encode()).hexdigest(),
            "created": datetime.now(timezone.utc).isoformat(),
            "expires": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        }
        update["$push"] = {"trusted_devices": trust_entry}
    
    await _db["users"].update_one({"_id": db_user["_id"]}, update)
    
    return {
        "verified": True,
        "session_token": session_token,
        "device_token": device_token,
        "message": "Verificación exitosa"
    }
