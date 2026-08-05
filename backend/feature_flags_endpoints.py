"""
Feature Flags Endpoints - Control de funciones especiales
Permite al admin activar/desactivar funciones como gambling, préstamos, etc.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class FeatureFlags(BaseModel):
    gambling_enabled: bool = False
    bolita_enabled: bool = False
    scratch_cards_enabled: bool = False
    raffles_enabled: bool = False
    loans_enabled: bool = False
    cab_enabled: bool = False
    tax_wizard_enabled: bool = True
    show_merchant_one: bool = False  # Show Merchant One payment in mobile app
    show_bank_connect: bool = False  # Show bank account connection in mobile app
    my_business_enabled: bool = True  # Show Mi Negocio module in mobile app
    personal_finance_enabled: bool = True  # Show Finanzas Personales module in mobile app
    show_free_plan: bool = False  # Show "Básico - Gratis" downgrade option in subscription screens

class FeatureFlagUpdate(BaseModel):
    gambling_enabled: Optional[bool] = None
    bolita_enabled: Optional[bool] = None
    scratch_cards_enabled: Optional[bool] = None
    raffles_enabled: Optional[bool] = None
    loans_enabled: Optional[bool] = None
    cab_enabled: Optional[bool] = None
    tax_wizard_enabled: Optional[bool] = None
    show_merchant_one: Optional[bool] = None  # Show Merchant One payment
    show_bank_connect: Optional[bool] = None  # Show bank account connection
    my_business_enabled: Optional[bool] = None  # Show Mi Negocio module
    personal_finance_enabled: Optional[bool] = None  # Show Finanzas Personales module
    show_free_plan: Optional[bool] = None  # Show free plan downgrade option

# Default flags - ALL SPECIAL FEATURES DISABLED
DEFAULT_FLAGS = {
    "_id": "feature_flags",
    "gambling_enabled": False,
    "bolita_enabled": False,
    "scratch_cards_enabled": False,
    "raffles_enabled": False,
    "loans_enabled": False,
    "cab_enabled": False,
    "tax_wizard_enabled": True,
    "show_merchant_one": False,
    "show_bank_connect": False,
    "my_business_enabled": True,
    "personal_finance_enabled": True,
    "updated_at": None,
    "updated_by": None
}

def init_feature_flags_endpoints(
    app,
    api_router: APIRouter,
    require_admin_func,
    get_database_func
):
    """Initialize feature flags endpoints"""
    
    db = get_database_func()
    
    async def ensure_flags_exist():
        """Ensure feature flags document exists"""
        flags = await db.feature_flags.find_one({"_id": "feature_flags"})
        if not flags:
            await db.feature_flags.insert_one(DEFAULT_FLAGS)
            logger.info("🚩 Feature flags initialized (gambling disabled)")
    
    # Initialize on startup
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(ensure_flags_exist())
        else:
            loop.run_until_complete(ensure_flags_exist())
    except:
        pass
    
    # ================== PUBLIC ENDPOINT ==================
    
    @app.get('/api/feature-flags')
    async def get_feature_flags():
        """Get current feature flags (public - for app to check)"""
        try:
            flags = await db.feature_flags.find_one({"_id": "feature_flags"})
            
            if not flags:
                return {
                    "gambling_enabled": False,
                    "bolita_enabled": False,
                    "scratch_cards_enabled": False,
                    "raffles_enabled": False,
                    "loans_enabled": False,
                    "cab_enabled": False,
                    "tax_wizard_enabled": True,
                    "my_business_enabled": True,
                    "personal_finance_enabled": True
                }
            
            return {
                "gambling_enabled": flags.get("gambling_enabled", False),
                "bolita_enabled": flags.get("bolita_enabled", False),
                "scratch_cards_enabled": flags.get("scratch_cards_enabled", False),
                "raffles_enabled": flags.get("raffles_enabled", False),
                "loans_enabled": flags.get("loans_enabled", False),
                "cab_enabled": flags.get("cab_enabled", False),
                "tax_wizard_enabled": flags.get("tax_wizard_enabled", True),
                "my_business_enabled": flags.get("my_business_enabled", True),
                "personal_finance_enabled": flags.get("personal_finance_enabled", True),
                "show_free_plan": flags.get("show_free_plan", False)
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting feature flags: {e}")
            # Default to disabled on error
            return {
                "gambling_enabled": False,
                "bolita_enabled": False,
                "scratch_cards_enabled": False,
                "raffles_enabled": False,
                "loans_enabled": False,
                "cab_enabled": False,
                "tax_wizard_enabled": True,
                "my_business_enabled": True,
                "personal_finance_enabled": True,
                "show_free_plan": False
            }
    
    # ================== ADMIN ENDPOINTS ==================
    
    @app.get('/api/admin/feature-flags')
    async def admin_get_feature_flags(
        current_user: dict = Depends(require_admin_func)
    ):
        """Get all feature flags with metadata (admin only)"""
        try:
            flags = await db.feature_flags.find_one({"_id": "feature_flags"})
            
            if not flags:
                await db.feature_flags.insert_one(DEFAULT_FLAGS)
                flags = DEFAULT_FLAGS
            
            return {
                "gambling_enabled": flags.get("gambling_enabled", False),
                "bolita_enabled": flags.get("bolita_enabled", False),
                "scratch_cards_enabled": flags.get("scratch_cards_enabled", False),
                "raffles_enabled": flags.get("raffles_enabled", False),
                "loans_enabled": flags.get("loans_enabled", False),
                "cab_enabled": flags.get("cab_enabled", False),
                "tax_wizard_enabled": flags.get("tax_wizard_enabled", True),
                "my_business_enabled": flags.get("my_business_enabled", True),
                "personal_finance_enabled": flags.get("personal_finance_enabled", True),
                "show_free_plan": flags.get("show_free_plan", False),
                "updated_at": flags.get("updated_at"),
                "updated_by": flags.get("updated_by")
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting feature flags: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.put('/api/admin/feature-flags')
    async def admin_update_feature_flags(
        updates: FeatureFlagUpdate,
        current_user: dict = Depends(require_admin_func)
    ):
        """Update feature flags (admin only)"""
        try:
            update_data = {k: v for k, v in updates.dict().items() if v is not None}
            update_data["updated_at"] = datetime.now(timezone.utc)
            update_data["updated_by"] = current_user.get("email", "admin")
            
            await db.feature_flags.update_one(
                {"_id": "feature_flags"},
                {"$set": update_data},
                upsert=True
            )
            
            # Log the change
            logger.info(f"🚩 Feature flags updated by {current_user.get('email')}: {update_data}")
            
            # Return updated flags
            flags = await db.feature_flags.find_one({"_id": "feature_flags"})
            
            return {
                "message": "Feature flags updated",
                "gambling_enabled": flags.get("gambling_enabled", False),
                "bolita_enabled": flags.get("bolita_enabled", False),
                "scratch_cards_enabled": flags.get("scratch_cards_enabled", False),
                "raffles_enabled": flags.get("raffles_enabled", False),
                "loans_enabled": flags.get("loans_enabled", False),
                "cab_enabled": flags.get("cab_enabled", False),
                "tax_wizard_enabled": flags.get("tax_wizard_enabled", True),
                "my_business_enabled": flags.get("my_business_enabled", True),
                "personal_finance_enabled": flags.get("personal_finance_enabled", True),
                "show_free_plan": flags.get("show_free_plan", False),
                "updated_at": flags.get("updated_at"),
                "updated_by": flags.get("updated_by")
            }
            
        except Exception as e:
            logger.error(f"❌ Error updating feature flags: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/feature-flags/toggle-gambling')
    async def admin_toggle_gambling(
        current_user: dict = Depends(require_admin_func)
    ):
        """Quick toggle for all gambling features (admin only)"""
        try:
            flags = await db.feature_flags.find_one({"_id": "feature_flags"})
            current_state = flags.get("gambling_enabled", False) if flags else False
            new_state = not current_state
            
            await db.feature_flags.update_one(
                {"_id": "feature_flags"},
                {"$set": {
                    "gambling_enabled": new_state,
                    "bolita_enabled": new_state,
                    "scratch_cards_enabled": new_state,
                    "raffles_enabled": new_state,
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": current_user.get("email", "admin")
                }},
                upsert=True
            )
            
            status = "activadas" if new_state else "desactivadas"
            logger.info(f"🎰 Funciones de gambling {status} por {current_user.get('email')}")
            
            return {
                "message": f"Funciones de gambling {status}",
                "gambling_enabled": new_state
            }
            
        except Exception as e:
            logger.error(f"❌ Error toggling gambling: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("🚩 Feature Flags endpoints initialized")
