"""
Tax Wizard Promo Code Service
Handles discount codes and promotions for the Mi Reembolso wizard
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId

logger = logging.getLogger(__name__)

class TaxWizardPromoService:
    """Service for managing promo codes"""
    
    def __init__(self, db):
        self.db = db
        self.collection = db["tax_wizard_promo_codes"]
        self.usage_collection = db["tax_wizard_promo_usage"]
    
    async def create_promo_code(
        self,
        code: str,
        discount_type: str,  # "percentage" or "fixed"
        discount_value: float,
        description: str = "",
        max_uses: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        min_purchase: float = 0,
        first_time_only: bool = False
    ) -> dict:
        """Create a new promo code"""
        code = code.upper().strip()
        
        # Check if code already exists
        existing = await self.collection.find_one({"code": code})
        if existing:
            return {"success": False, "error": "El código ya existe"}
        
        promo_doc = {
            "code": code,
            "discount_type": discount_type,
            "discount_value": discount_value,
            "description": description,
            "max_uses": max_uses,
            "current_uses": 0,
            "expires_at": expires_at,
            "min_purchase": min_purchase,
            "first_time_only": first_time_only,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        result = await self.collection.insert_one(promo_doc)
        
        logger.info(f"✅ Created promo code: {code}")
        
        return {
            "success": True,
            "promo_id": str(result.inserted_id),
            "code": code
        }
    
    async def validate_promo_code(
        self,
        code: str,
        user_id: str,
        purchase_amount: float
    ) -> dict:
        """Validate a promo code and calculate discount"""
        code = code.upper().strip()
        
        promo = await self.collection.find_one({
            "code": code,
            "is_active": True
        })
        
        if not promo:
            return {"valid": False, "error": "Código no válido"}
        
        # Check expiration
        if promo.get("expires_at") and promo["expires_at"] < datetime.utcnow():
            return {"valid": False, "error": "Código expirado"}
        
        # Check max uses
        if promo.get("max_uses") and promo["current_uses"] >= promo["max_uses"]:
            return {"valid": False, "error": "Código agotado"}
        
        # Check minimum purchase
        if purchase_amount < promo.get("min_purchase", 0):
            return {
                "valid": False,
                "error": f"Mínimo de compra: ${promo['min_purchase']:.2f}"
            }
        
        # Check first-time only
        if promo.get("first_time_only"):
            previous_use = await self.usage_collection.find_one({
                "user_id": user_id,
                "promo_code": code
            })
            if previous_use:
                return {"valid": False, "error": "Código solo para nuevos usuarios"}
            
            # Also check if user has completed a wizard before
            previous_session = await self.db["tax_wizard_sessions"].find_one({
                "user_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
                "status": "completed"
            })
            if previous_session:
                return {"valid": False, "error": "Código solo para primera declaración"}
        
        # Calculate discount
        if promo["discount_type"] == "percentage":
            discount_amount = purchase_amount * (promo["discount_value"] / 100)
            discount_display = f"{promo['discount_value']}%"
        else:  # fixed
            discount_amount = min(promo["discount_value"], purchase_amount)
            discount_display = f"${promo['discount_value']:.2f}"
        
        final_amount = max(0, purchase_amount - discount_amount)
        
        return {
            "valid": True,
            "code": code,
            "discount_type": promo["discount_type"],
            "discount_value": promo["discount_value"],
            "discount_display": discount_display,
            "discount_amount": round(discount_amount, 2),
            "original_amount": purchase_amount,
            "final_amount": round(final_amount, 2),
            "description": promo.get("description", "")
        }
    
    async def apply_promo_code(
        self,
        code: str,
        user_id: str,
        session_id: str,
        original_amount: float,
        discount_amount: float
    ) -> dict:
        """Apply a promo code to a session"""
        code = code.upper().strip()
        
        # Record usage
        usage_doc = {
            "promo_code": code,
            "user_id": user_id,
            "session_id": session_id,
            "original_amount": original_amount,
            "discount_amount": discount_amount,
            "final_amount": original_amount - discount_amount,
            "applied_at": datetime.utcnow()
        }
        
        await self.usage_collection.insert_one(usage_doc)
        
        # Increment usage count
        await self.collection.update_one(
            {"code": code},
            {"$inc": {"current_uses": 1}}
        )
        
        # Update session with promo info
        await self.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "promo_code": code,
                "promo_discount": discount_amount,
                "original_price": original_amount,
                "final_price": original_amount - discount_amount,
                "updated_at": datetime.utcnow()
            }}
        )
        
        logger.info(f"✅ Applied promo {code} to session {session_id}, discount: ${discount_amount}")
        
        return {"success": True}
    
    async def get_all_promo_codes(self, include_inactive: bool = False) -> List[dict]:
        """Get all promo codes for admin"""
        query = {} if include_inactive else {"is_active": True}
        
        promos = await self.collection.find(query).sort("created_at", -1).to_list(100)
        
        return [
            {
                "id": str(p["_id"]),
                "code": p["code"],
                "discount_type": p["discount_type"],
                "discount_value": p["discount_value"],
                "description": p.get("description", ""),
                "max_uses": p.get("max_uses"),
                "current_uses": p.get("current_uses", 0),
                "expires_at": p.get("expires_at").isoformat() if p.get("expires_at") else None,
                "min_purchase": p.get("min_purchase", 0),
                "first_time_only": p.get("first_time_only", False),
                "is_active": p.get("is_active", True),
                "created_at": p["created_at"].isoformat()
            }
            for p in promos
        ]
    
    async def deactivate_promo_code(self, code: str) -> dict:
        """Deactivate a promo code"""
        result = await self.collection.update_one(
            {"code": code.upper()},
            {"$set": {"is_active": False}}
        )
        
        if result.modified_count:
            return {"success": True}
        return {"success": False, "error": "Código no encontrado"}
    
    async def get_promo_stats(self) -> dict:
        """Get promo code statistics"""
        active_count = await self.collection.count_documents({"is_active": True})
        total_uses = await self.usage_collection.count_documents({})
        
        # Total discount given
        pipeline = [
            {"$group": {"_id": None, "total_discount": {"$sum": "$discount_amount"}}}
        ]
        discount_result = await self.usage_collection.aggregate(pipeline).to_list(1)
        total_discount = discount_result[0]["total_discount"] if discount_result else 0
        
        # Most used codes
        top_codes = await self.collection.find(
            {"current_uses": {"$gt": 0}}
        ).sort("current_uses", -1).limit(5).to_list(5)
        
        return {
            "active_codes": active_count,
            "total_uses": total_uses,
            "total_discount_given": round(total_discount, 2),
            "top_codes": [
                {"code": c["code"], "uses": c["current_uses"]}
                for c in top_codes
            ]
        }
    
    async def create_default_codes(self):
        """Create default promo codes if they don't exist"""
        default_codes = [
            {
                "code": "PRIMERAVEZ",
                "discount_type": "percentage",
                "discount_value": 15,
                "description": "15% de descuento en tu primera declaración",
                "first_time_only": True
            },
            {
                "code": "FAMILIA2024",
                "discount_type": "fixed",
                "discount_value": 25,
                "description": "$25 de descuento para familias",
                "min_purchase": 100
            },
            {
                "code": "ROSSTAX10",
                "discount_type": "percentage",
                "discount_value": 10,
                "description": "10% de descuento general"
            }
        ]
        
        for promo in default_codes:
            existing = await self.collection.find_one({"code": promo["code"]})
            if not existing:
                await self.create_promo_code(**promo)
                logger.info(f"Created default promo: {promo['code']}")


# Global instance
promo_service: Optional[TaxWizardPromoService] = None

def init_promo_service(db):
    global promo_service
    promo_service = TaxWizardPromoService(db)
    logger.info("✅ Tax Wizard Promo Service initialized")
    return promo_service
