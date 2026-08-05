"""
Tax Wizard Referral System
Handles referral bonuses for the Mi Reembolso wizard
"""
import logging
from datetime import datetime
from typing import Optional, List
from bson import ObjectId
import secrets
import string

logger = logging.getLogger(__name__)

class TaxWizardReferralService:
    """Service for managing tax wizard referrals"""
    
    def __init__(self, db):
        self.db = db
        self.collection = db["tax_wizard_referrals"]
        self.bonus_collection = db["tax_wizard_referral_bonuses"]
    
    def _generate_referral_code(self, length: int = 8) -> str:
        """Generate a unique referral code"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    async def get_or_create_referral_code(self, user_id: str) -> dict:
        """Get existing or create new referral code for a user"""
        # Check if user already has a code
        existing = await self.collection.find_one({"user_id": user_id})
        
        if existing:
            return {
                "referral_code": existing["referral_code"],
                "created_at": existing["created_at"],
                "total_referrals": existing.get("total_referrals", 0),
                "successful_referrals": existing.get("successful_referrals", 0),
                "total_earned": existing.get("total_earned", 0)
            }
        
        # Generate new code
        code = self._generate_referral_code()
        
        # Ensure uniqueness
        while await self.collection.find_one({"referral_code": code}):
            code = self._generate_referral_code()
        
        # Create new referral record
        referral_doc = {
            "user_id": user_id,
            "referral_code": code,
            "created_at": datetime.utcnow(),
            "total_referrals": 0,
            "successful_referrals": 0,
            "total_earned": 0,
            "is_active": True
        }
        
        await self.collection.insert_one(referral_doc)
        
        return {
            "referral_code": code,
            "created_at": referral_doc["created_at"],
            "total_referrals": 0,
            "successful_referrals": 0,
            "total_earned": 0
        }
    
    async def validate_referral_code(self, code: str) -> Optional[dict]:
        """Validate a referral code and return referrer info"""
        referral = await self.collection.find_one({
            "referral_code": code.upper(),
            "is_active": True
        })
        
        if not referral:
            return None
        
        # Get referrer info
        user = await self.db["users"].find_one({"_id": ObjectId(referral["user_id"])})
        
        return {
            "valid": True,
            "referrer_id": referral["user_id"],
            "referrer_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Usuario",
            "bonus_amount": 25.00  # Fixed bonus amount
        }
    
    async def apply_referral_to_session(self, session_id: str, referral_code: str) -> dict:
        """Apply a referral code to a wizard session"""
        # Validate code
        validation = await self.validate_referral_code(referral_code)
        
        if not validation or not validation.get("valid"):
            return {"success": False, "error": "Código de referido inválido"}
        
        # Get session
        session = await self.db["tax_wizard_sessions"].find_one({"_id": ObjectId(session_id)})
        
        if not session:
            return {"success": False, "error": "Sesión no encontrada"}
        
        # Check if session already has a referral
        if session.get("referral_code"):
            return {"success": False, "error": "Esta sesión ya tiene un código de referido aplicado"}
        
        # Check user is not referring themselves
        if str(session.get("user_id")) == validation["referrer_id"]:
            return {"success": False, "error": "No puedes usar tu propio código de referido"}
        
        # Apply referral to session
        await self.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "referral_code": referral_code.upper(),
                "referrer_id": validation["referrer_id"],
                "referral_applied_at": datetime.utcnow()
            }}
        )
        
        # Increment referral count
        await self.collection.update_one(
            {"referral_code": referral_code.upper()},
            {"$inc": {"total_referrals": 1}}
        )
        
        return {
            "success": True,
            "message": f"¡Código aplicado! Referido por {validation['referrer_name']}",
            "bonus_amount": validation["bonus_amount"]
        }
    
    async def complete_referral(self, session_id: str) -> dict:
        """
        Complete a referral when a session is paid/completed.
        Awards bonus to referrer.
        """
        session = await self.db["tax_wizard_sessions"].find_one({"_id": ObjectId(session_id)})
        
        if not session:
            return {"success": False, "error": "Session not found"}
        
        if not session.get("referral_code"):
            return {"success": False, "error": "No referral code on session"}
        
        if session.get("referral_completed"):
            return {"success": False, "error": "Referral already completed"}
        
        referral_code = session["referral_code"]
        referrer_id = session.get("referrer_id")
        bonus_amount = 25.00  # Fixed bonus
        
        # Update referral stats
        await self.collection.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {
                    "successful_referrals": 1,
                    "total_earned": bonus_amount
                }
            }
        )
        
        # Create bonus record
        bonus_doc = {
            "referrer_id": referrer_id,
            "referred_session_id": session_id,
            "referred_user_id": str(session.get("user_id")),
            "referral_code": referral_code,
            "amount": bonus_amount,
            "status": "pending",  # Will be "paid" when actually paid out
            "created_at": datetime.utcnow()
        }
        
        await self.bonus_collection.insert_one(bonus_doc)
        
        # Mark referral as completed on session
        await self.db["tax_wizard_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"referral_completed": True, "referral_completed_at": datetime.utcnow()}}
        )
        
        logger.info(f"✅ Referral completed: {referral_code}, bonus ${bonus_amount} for user {referrer_id}")
        
        return {
            "success": True,
            "bonus_amount": bonus_amount,
            "referrer_id": referrer_id
        }
    
    async def get_referral_stats(self, user_id: str) -> dict:
        """Get referral statistics for a user"""
        referral = await self.collection.find_one({"user_id": user_id})
        
        if not referral:
            return {
                "has_code": False,
                "referral_code": None,
                "total_referrals": 0,
                "successful_referrals": 0,
                "total_earned": 0,
                "pending_bonuses": 0
            }
        
        # Get pending bonuses
        pending = await self.bonus_collection.count_documents({
            "referrer_id": user_id,
            "status": "pending"
        })
        
        # Get bonus history
        bonuses = await self.bonus_collection.find({
            "referrer_id": user_id
        }).sort("created_at", -1).limit(10).to_list(10)
        
        return {
            "has_code": True,
            "referral_code": referral["referral_code"],
            "total_referrals": referral.get("total_referrals", 0),
            "successful_referrals": referral.get("successful_referrals", 0),
            "total_earned": referral.get("total_earned", 0),
            "pending_bonuses": pending,
            "recent_bonuses": [
                {
                    "amount": b["amount"],
                    "status": b["status"],
                    "created_at": b["created_at"].isoformat()
                }
                for b in bonuses
            ]
        }
    
    async def get_admin_referral_report(self, limit: int = 100) -> dict:
        """Get admin report of all referrals"""
        # Top referrers
        top_referrers = await self.collection.find(
            {"successful_referrals": {"$gt": 0}}
        ).sort("successful_referrals", -1).limit(10).to_list(10)
        
        # Pending bonuses
        pending_bonuses = await self.bonus_collection.find(
            {"status": "pending"}
        ).to_list(100)
        
        total_pending = sum(b["amount"] for b in pending_bonuses)
        
        # Stats
        total_referrals = await self.collection.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$total_referrals"}}}
        ]).to_list(1)
        
        total_successful = await self.collection.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$successful_referrals"}}}
        ]).to_list(1)
        
        total_paid = await self.bonus_collection.aggregate([
            {"$match": {"status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        return {
            "total_referrals": total_referrals[0]["total"] if total_referrals else 0,
            "total_successful": total_successful[0]["total"] if total_successful else 0,
            "total_pending_payout": total_pending,
            "total_paid_out": total_paid[0]["total"] if total_paid else 0,
            "pending_bonuses_count": len(pending_bonuses),
            "top_referrers": [
                {
                    "user_id": r["user_id"],
                    "referral_code": r["referral_code"],
                    "successful_referrals": r["successful_referrals"],
                    "total_earned": r["total_earned"]
                }
                for r in top_referrers
            ]
        }


# Global instance
referral_service: Optional[TaxWizardReferralService] = None

def init_referral_service(db):
    global referral_service
    referral_service = TaxWizardReferralService(db)
    logger.info("✅ Tax Wizard Referral Service initialized")
    return referral_service
