"""
Lending Site Configuration Router
Manages company settings, social media links, and public site data
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
_db = None

def init_lending_config_router(db):
    global _db
    _db = db
    return router

async def _get_current_user(authorization):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace('Bearer ', '')
    # Auth uses user_sessions collection (same as auth_routes.py)
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    from bson import ObjectId
    try:
        user = await _db.users.find_one({"_id": ObjectId(session["user_id"])})
    except:
        user = await _db.users.find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ═══════════════════════════════════════════════════════════════
# ADMIN: GET/PUT Lending Config
# ═══════════════════════════════════════════════════════════════

@router.get('/api/admin/lending/config')
async def get_lending_config(request: Request):
    """Get all lending site configuration"""
    user = await _get_current_user(request.headers.get('Authorization'))
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await _db.lending_config.find_one({"_type": "site_config"}) or {}
    config.pop('_id', None)
    config.pop('_type', None)
    return {"config": config}


@router.put('/api/admin/lending/config')
async def update_lending_config(request: Request):
    """Update lending site configuration"""
    user = await _get_current_user(request.headers.get('Authorization'))
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    body['_type'] = 'site_config'
    body['updated_at'] = datetime.utcnow().isoformat()
    body['updated_by'] = user.get('email', 'admin')
    
    await _db.lending_config.update_one(
        {"_type": "site_config"},
        {"$set": body},
        upsert=True
    )
    return {"success": True, "message": "Configuración guardada"}


# ═══════════════════════════════════════════════════════════════
# PUBLIC: Get Social Links (No Auth Required)
# ═══════════════════════════════════════════════════════════════

@router.get('/api/public/social-links')
async def get_social_links():
    """Public endpoint - returns social media links for the landing page"""
    config = await _db.lending_config.find_one({"_type": "site_config"}) or {}
    
    social = {
        "facebook": config.get("social_facebook", ""),
        "instagram": config.get("social_instagram", ""),
        "tiktok": config.get("social_tiktok", ""),
        "youtube": config.get("social_youtube", ""),
        "twitter": config.get("social_twitter", ""),
        "linkedin": config.get("social_linkedin", ""),
        "google_maps": config.get("social_google_maps", ""),
        "whatsapp": config.get("social_whatsapp", ""),
        "yelp": config.get("social_yelp", ""),
    }
    
    company = {
        "name": config.get("company_name", "Ross Lending Solutions LLC"),
        "phone": config.get("phone", "(806) 934-2018"),
        "email": config.get("email", "info@rosslending.com"),
        "address": config.get("address", "305 Bruce Ave, Dumas, TX 79029"),
        "hours": config.get("hours", "Lun-Vie: 9:00 AM - 6:00 PM"),
    }
    
    return {"social": social, "company": company}


# ═══════════════════════════════════════════════════════════════
# PUBLIC: Site Status (Maintenance Mode Check) — No Auth Required
# Called by Next.js middleware on every request
# ═══════════════════════════════════════════════════════════════

@router.get('/api/public/site-status')
async def get_site_status():
    """Public endpoint — returns maintenance mode and basic site flags"""
    config = await _db.lending_config.find_one({"_type": "site_config"}) or {}
    return {
        "maintenance_mode": config.get("maintenance_mode", False),
        "maintenance_message": config.get("maintenance_message", ""),
        "show_testimonials": config.get("show_testimonials", True),
    }


# ═══════════════════════════════════════════════════════════════
# ADMIN: Toggle Maintenance Mode
# ═══════════════════════════════════════════════════════════════

@router.put('/api/admin/maintenance-mode')
async def toggle_maintenance_mode(request: Request):
    """Toggle maintenance mode on/off"""
    user = await _get_current_user(request.headers.get('Authorization'))
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    maintenance = bool(body.get("maintenance_mode", False))
    
    await _db.lending_config.update_one(
        {"_type": "site_config"},
        {"$set": {
            "maintenance_mode": maintenance,
            "maintenance_updated_at": datetime.utcnow().isoformat(),
            "maintenance_updated_by": user.get('email', 'admin'),
        }},
        upsert=True
    )
    
    status = "activado" if maintenance else "desactivado"
    logger.info(f"🔧 Modo mantenimiento {status} por {user.get('email')}")
    return {"success": True, "maintenance_mode": maintenance, "message": f"Modo mantenimiento {status}"}


# ═══════════════════════════════════════════════════════════════
# ADMIN: Toggle Testimonials Visibility
# ═══════════════════════════════════════════════════════════════

@router.put('/api/admin/toggle-testimonials')
async def toggle_testimonials(request: Request):
    """Toggle testimonials section visibility on landing page"""
    user = await _get_current_user(request.headers.get('Authorization'))
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    show = bool(body.get("show_testimonials", True))
    
    await _db.lending_config.update_one(
        {"_type": "site_config"},
        {"$set": {
            "show_testimonials": show,
            "testimonials_updated_at": datetime.utcnow().isoformat(),
            "testimonials_updated_by": user.get('email', 'admin'),
        }},
        upsert=True
    )
    
    status = "visibles" if show else "ocultos"
    logger.info(f"💬 Testimonios {status} por {user.get('email')}")
    return {"success": True, "show_testimonials": show, "message": f"Testimonios {status}"}
