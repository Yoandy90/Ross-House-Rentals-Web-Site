"""
Identity Verification Service for DIY Tax Filing
Handles ID photo + selfie verification for IRS e-filing requirements
"""
import logging
import os
import base64
from datetime import datetime
from typing import Optional
from bson import ObjectId

logger = logging.getLogger(__name__)


class IdentityVerificationService:
    """Service for verifying identity via ID photo + selfie for DIY tax filing"""

    def __init__(self, db):
        self.db = db
        self.verifications = db.identity_verifications

    async def submit_verification(
        self,
        user_id: str,
        session_id: str,
        id_photo_base64: str,
        selfie_base64: str,
        id_type: str = "drivers_license",
        full_name: str = "",
    ) -> dict:
        """Submit ID photo and selfie for verification"""
        try:
            # Check if verification already exists for this session
            existing = await self.verifications.find_one({
                "session_id": session_id,
                "user_id": user_id,
            })

            verification_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "id_type": id_type,
                "full_name": full_name,
                "id_photo": id_photo_base64[:100] + "..." if len(id_photo_base64) > 100 else id_photo_base64,  # Store thumbnail reference
                "id_photo_size": len(id_photo_base64),
                "selfie_size": len(selfie_base64),
                "selfie": selfie_base64[:100] + "..." if len(selfie_base64) > 100 else selfie_base64,
                "status": "submitted",  # submitted -> under_review -> approved / rejected
                "submitted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "review_notes": "",
                "reviewed_by": None,
                "reviewed_at": None,
            }

            # Store actual images in a separate collection to keep verifications collection lean
            image_doc = {
                "user_id": user_id,
                "session_id": session_id,
                "id_photo_base64": id_photo_base64,
                "selfie_base64": selfie_base64,
                "created_at": datetime.utcnow(),
            }

            if existing:
                # Update existing
                await self.verifications.update_one(
                    {"_id": existing["_id"]},
                    {"$set": verification_doc}
                )
                await self.db.identity_verification_images.update_one(
                    {"session_id": session_id, "user_id": user_id},
                    {"$set": image_doc},
                    upsert=True
                )
                verification_id = str(existing["_id"])
            else:
                result = await self.verifications.insert_one(verification_doc)
                verification_id = str(result.inserted_id)
                await self.db.identity_verification_images.insert_one(image_doc)

            # Update the tax wizard session
            await self.db.tax_wizard_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {
                    "identity_verified": False,
                    "identity_verification_status": "submitted",
                    "identity_verification_id": verification_id,
                    "updated_at": datetime.utcnow(),
                }}
            )

            logger.info(f"🆔 Identity verification submitted for user {user_id}, session {session_id}")

            return {
                "success": True,
                "verification_id": verification_id,
                "status": "submitted",
                "message": "Tu verificación ha sido enviada. Será revisada en breve."
            }

        except Exception as e:
            logger.error(f"Error submitting identity verification: {e}")
            return {"success": False, "error": str(e)}

    async def get_verification_status(self, user_id: str, session_id: str) -> dict:
        """Get the current verification status"""
        try:
            verification = await self.verifications.find_one({
                "user_id": user_id,
                "session_id": session_id,
            })

            if not verification:
                return {
                    "has_verification": False,
                    "status": "not_submitted",
                    "message": "No se ha enviado verificación de identidad",
                }

            return {
                "has_verification": True,
                "verification_id": str(verification["_id"]),
                "status": verification.get("status", "submitted"),
                "id_type": verification.get("id_type", ""),
                "submitted_at": verification.get("submitted_at", "").isoformat() if verification.get("submitted_at") else None,
                "reviewed_at": verification.get("reviewed_at", "").isoformat() if verification.get("reviewed_at") else None,
                "review_notes": verification.get("review_notes", ""),
                "message": self._get_status_message(verification.get("status", "submitted")),
            }
        except Exception as e:
            logger.error(f"Error getting verification status: {e}")
            return {"has_verification": False, "status": "error", "error": str(e)}

    async def admin_review_verification(
        self,
        verification_id: str,
        admin_id: str,
        approved: bool,
        notes: str = ""
    ) -> dict:
        """Admin reviews and approves/rejects a verification"""
        try:
            verification = await self.verifications.find_one({"_id": ObjectId(verification_id)})
            if not verification:
                return {"success": False, "error": "Verificación no encontrada"}

            new_status = "approved" if approved else "rejected"

            await self.verifications.update_one(
                {"_id": ObjectId(verification_id)},
                {"$set": {
                    "status": new_status,
                    "reviewed_by": admin_id,
                    "reviewed_at": datetime.utcnow(),
                    "review_notes": notes,
                    "updated_at": datetime.utcnow(),
                }}
            )

            # Update tax wizard session
            session_id = verification.get("session_id")
            if session_id:
                await self.db.tax_wizard_sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$set": {
                        "identity_verified": approved,
                        "identity_verification_status": new_status,
                        "updated_at": datetime.utcnow(),
                    }}
                )

            logger.info(f"🆔 Identity verification {verification_id} {'approved' if approved else 'rejected'} by admin {admin_id}")

            return {
                "success": True,
                "status": new_status,
                "message": f"Verificación {'aprobada' if approved else 'rechazada'}"
            }
        except Exception as e:
            logger.error(f"Error reviewing verification: {e}")
            return {"success": False, "error": str(e)}

    async def get_pending_verifications(self, limit: int = 50) -> list:
        """Get all pending verifications for admin review"""
        try:
            cursor = self.verifications.find(
                {"status": "submitted"}
            ).sort("submitted_at", 1).limit(limit)

            results = []
            async for v in cursor:
                # Get user info
                user = await self.db.users.find_one({"id": v["user_id"]})
                results.append({
                    "id": str(v["_id"]),
                    "user_id": v["user_id"],
                    "user_name": user.get("name", "") if user else "",
                    "user_email": user.get("email", "") if user else "",
                    "session_id": v.get("session_id", ""),
                    "id_type": v.get("id_type", ""),
                    "full_name": v.get("full_name", ""),
                    "submitted_at": v.get("submitted_at", "").isoformat() if v.get("submitted_at") else None,
                    "status": v.get("status", "submitted"),
                })

            return results
        except Exception as e:
            logger.error(f"Error getting pending verifications: {e}")
            return []

    async def get_verification_images(self, verification_id: str) -> dict:
        """Get the actual ID and selfie images for admin review"""
        try:
            verification = await self.verifications.find_one({"_id": ObjectId(verification_id)})
            if not verification:
                return {"success": False, "error": "Not found"}

            images = await self.db.identity_verification_images.find_one({
                "session_id": verification["session_id"],
                "user_id": verification["user_id"],
            })

            if not images:
                return {"success": False, "error": "Images not found"}

            return {
                "success": True,
                "id_photo": images.get("id_photo_base64", ""),
                "selfie": images.get("selfie_base64", ""),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _get_status_message(self, status: str) -> str:
        messages = {
            "submitted": "Tu verificación está siendo revisada. Esto puede tomar unas horas.",
            "under_review": "Un agente está revisando tu identidad.",
            "approved": "✅ Tu identidad ha sido verificada exitosamente.",
            "rejected": "❌ Tu verificación fue rechazada. Por favor, envía fotos más claras.",
        }
        return messages.get(status, "Estado desconocido")


# Singleton
identity_verification_service = None

async def get_identity_verification_service(db):
    global identity_verification_service
    if identity_verification_service is None:
        identity_verification_service = IdentityVerificationService(db)
        logger.info("🆔 Identity Verification Service initialized")
    return identity_verification_service
