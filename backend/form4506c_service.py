"""
Form 4506-C Electronic Signature Service
IRS Transcript Authorization with e-signature support
Supports: Mobile canvas signature + Topaz SigWeb hardware pad
"""

import os
import logging
import base64
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
MIAMI_TZ = ZoneInfo("America/New_York")


# ═══════════════════════════════════════════════════════════════
# Form 4506-C Data Model & Service
# ═══════════════════════════════════════════════════════════════

TRANSCRIPT_TYPES = [
    {"code": "return", "label_en": "Tax Return Transcript", "label_es": "Transcripción de Declaración"},
    {"code": "account", "label_en": "Tax Account Transcript", "label_es": "Transcripción de Cuenta"},
    {"code": "wage", "label_en": "Wage and Income Transcript", "label_es": "Transcripción de Salarios e Ingresos"},
    {"code": "record_of_account", "label_en": "Record of Account", "label_es": "Registro de Cuenta"},
    {"code": "verification", "label_en": "Verification of Non-Filing", "label_es": "Verificación de No Declaración"},
]

FILING_STATUSES = [
    {"code": "single", "label_en": "Single", "label_es": "Soltero/a"},
    {"code": "married_joint", "label_en": "Married Filing Jointly", "label_es": "Casado/a Declaración Conjunta"},
    {"code": "married_separate", "label_en": "Married Filing Separately", "label_es": "Casado/a Declaración Separada"},
    {"code": "head_of_household", "label_en": "Head of Household", "label_es": "Jefe de Familia"},
    {"code": "qualifying_widow", "label_en": "Qualifying Surviving Spouse", "label_es": "Cónyuge Sobreviviente"},
]


class Form4506CService:
    """Service for managing IRS Form 4506-C (Transcript Authorization) with e-signatures"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("✅ Form 4506-C E-Signature Service initialized")
    
    # ── Create Form ────────────────────────────────────────────
    async def create_form(self, data: Dict) -> Dict:
        """Create a new Form 4506-C for a client to sign"""
        now = datetime.now(MIAMI_TZ)
        
        form_doc = {
            "form_id": str(uuid.uuid4()),
            # Client Info (Section 1 & 2)
            "client_id": data.get("client_id", ""),
            "client_email": data.get("client_email", ""),
            "client_phone": data.get("client_phone", ""),
            "taxpayer_name": data.get("taxpayer_name", ""),
            "taxpayer_ssn_last4": data.get("taxpayer_ssn_last4", ""),  # Only store last 4
            "spouse_name": data.get("spouse_name", ""),
            "spouse_ssn_last4": data.get("spouse_ssn_last4", ""),
            "current_address": {
                "street": data.get("street", ""),
                "city": data.get("city", ""),
                "state": data.get("state", ""),
                "zip": data.get("zip", ""),
            },
            "previous_address": {
                "street": data.get("prev_street", ""),
                "city": data.get("prev_city", ""),
                "state": data.get("prev_state", ""),
                "zip": data.get("prev_zip", ""),
            },
            # Transcript Details (Sections 6-9)
            "transcript_types": data.get("transcript_types", ["wage"]),
            "tax_years": data.get("tax_years", [str(now.year - 1)]),
            "filing_status": data.get("filing_status", "single"),
            # Third Party (Section 5)
            "third_party_name": data.get("third_party_name", "Ross Tax Preparation"),
            "third_party_address": data.get("third_party_address", ""),
            "third_party_ein": data.get("third_party_ein", ""),
            # Signature
            "signature_status": "pending",  # pending | signed | expired | revoked
            "signature_data": None,
            "signature_type": None,  # "canvas" | "topaz" | "typed"
            "signature_metadata": None,
            "signed_at": None,
            "signer_ip": None,
            "signer_user_agent": None,
            # Tracking
            "created_by": data.get("created_by", ""),
            "created_by_name": data.get("created_by_name", ""),
            "created_at": now,
            "updated_at": now,
            "expires_at": now + timedelta(days=120),  # IRS allows 120-day validity
            "submitted_to_irs": False,
            "submitted_at": None,
            "notes": data.get("notes", ""),
        }
        
        result = await self.db.form_4506c.insert_one(form_doc)
        form_doc["_id"] = str(result.inserted_id)
        
        logger.info(f"📝 Form 4506-C created for {form_doc['taxpayer_name']} ({form_doc['form_id']})")
        
        # Send push notification to client
        await self._send_signature_notification(form_doc)
        
        return {
            "id": str(result.inserted_id),
            "form_id": form_doc["form_id"],
            "taxpayer_name": form_doc["taxpayer_name"],
            "signature_status": "pending",
            "expires_at": form_doc["expires_at"].isoformat(),
        }
    
    async def _send_signature_notification(self, form_doc: Dict):
        """Send push notification to client when a new 4506-C is created"""
        try:
            client_email = form_doc.get("client_email", "")
            if not client_email:
                return
            
            # Find user and their push tokens
            user = await self.db.users.find_one({"email": client_email})
            if not user:
                return
            
            push_tokens = user.get("push_tokens", [])
            if not push_tokens:
                # Try legacy field
                token = user.get("expoPushToken", "") or user.get("push_token", "")
                if token:
                    push_tokens = [token]
            
            if not push_tokens:
                logger.info(f"No push tokens for {client_email}, skipping notification")
                return
            
            from push_notification_service import send_push_notification
            user_id = str(user.get("_id", ""))
            await send_push_notification(
                user_id=user_id,
                title="📝 Firma Requerida / Signature Required",
                body="Tu preparador de impuestos necesita tu firma para solicitar transcripciones del IRS. Abre la app para firmar.",
                data={
                    "type": "form_4506c",
                    "form_id": form_doc.get("form_id", ""),
                    "screen": "form-4506c",
                }
            )
            logger.info(f"🔔 Push notification sent to {client_email} for Form 4506-C signature")
        except Exception as e:
            logger.error(f"Error sending 4506-C notification: {e}")
    
    # ── Sign Form ──────────────────────────────────────────────
    async def sign_form(self, form_id: str, signature_data: Dict) -> Dict:
        """Sign a Form 4506-C with electronic signature"""
        now = datetime.now(MIAMI_TZ)
        
        # Find the form
        form = await self.db.form_4506c.find_one({"form_id": form_id})
        if not form:
            form = await self.db.form_4506c.find_one({"_id": ObjectId(form_id)}) if ObjectId.is_valid(form_id) else None
        if not form:
            raise ValueError("Formulario no encontrado")
        
        if form["signature_status"] == "signed":
            raise ValueError("Este formulario ya fue firmado")
        
        if form.get("expires_at") and form["expires_at"].replace(tzinfo=MIAMI_TZ) < now:
            raise ValueError("Este formulario ha expirado")
        
        # Validate signature
        sig_type = signature_data.get("type", "canvas")  # canvas | topaz | typed
        sig_image = signature_data.get("image_data", "")  # base64 PNG
        sig_biometric = signature_data.get("biometric_data", "")  # Topaz SigString
        
        if not sig_image and not sig_biometric:
            raise ValueError("Datos de firma requeridos")
        
        # Create signature hash for integrity verification
        sig_content = sig_image or sig_biometric
        sig_hash = hashlib.sha256(sig_content.encode()).hexdigest()
        
        # Build signature metadata
        metadata = {
            "type": sig_type,
            "hash": sig_hash,
            "timestamp": now.isoformat(),
            "ip_address": signature_data.get("ip_address", ""),
            "user_agent": signature_data.get("user_agent", ""),
            "device_info": signature_data.get("device_info", ""),
            "consent_text": (
                "I hereby authorize the Internal Revenue Service to release my tax "
                "information to the third party designated on this form. I understand "
                "that this authorization is valid for 120 days from the date of signature."
            ),
            "consent_text_es": (
                "Por la presente autorizo al Servicio de Impuestos Internos (IRS) a divulgar "
                "mi información tributaria a la tercera parte designada en este formulario. "
                "Entiendo que esta autorización es válida por 120 días desde la fecha de la firma."
            ),
        }
        
        if sig_type == "topaz":
            metadata["pad_model"] = signature_data.get("pad_model", "Topaz T-LBK750")
            metadata["pad_serial"] = signature_data.get("pad_serial", "")
        
        # Update the form
        update_data = {
            "signature_status": "signed",
            "signature_data": sig_image,
            "signature_biometric": sig_biometric if sig_type == "topaz" else None,
            "signature_type": sig_type,
            "signature_metadata": metadata,
            "signed_at": now,
            "signer_ip": signature_data.get("ip_address", ""),
            "signer_user_agent": signature_data.get("user_agent", ""),
            "updated_at": now,
        }
        
        await self.db.form_4506c.update_one(
            {"_id": form["_id"]},
            {"$set": update_data}
        )
        
        logger.info(f"✅ Form 4506-C signed by {form['taxpayer_name']} via {sig_type} ({form['form_id']})")
        
        return {
            "form_id": form["form_id"],
            "taxpayer_name": form["taxpayer_name"],
            "signature_status": "signed",
            "signature_type": sig_type,
            "signed_at": now.isoformat(),
            "signature_hash": sig_hash,
            "valid_until": form.get("expires_at", now).isoformat(),
        }
    
    # ── Get Forms (Admin) ──────────────────────────────────────
    async def list_forms(self, status: str = "", client_email: str = "", limit: int = 50) -> Dict:
        """List all Form 4506-C records"""
        query = {}
        if status:
            query["signature_status"] = status
        if client_email:
            query["client_email"] = client_email
        
        forms = await self.db.form_4506c.find(query).sort("created_at", -1).to_list(limit)
        
        return {
            "forms": [{
                "id": str(f["_id"]),
                "form_id": f.get("form_id", ""),
                "taxpayer_name": f.get("taxpayer_name", ""),
                "client_email": f.get("client_email", ""),
                "transcript_types": f.get("transcript_types", []),
                "tax_years": f.get("tax_years", []),
                "filing_status": f.get("filing_status", ""),
                "signature_status": f.get("signature_status", "pending"),
                "signature_type": f.get("signature_type", ""),
                "signed_at": f["signed_at"].isoformat() if f.get("signed_at") else None,
                "created_at": f["created_at"].isoformat() if f.get("created_at") else "",
                "expires_at": f["expires_at"].isoformat() if f.get("expires_at") else "",
                "submitted_to_irs": f.get("submitted_to_irs", False),
                "created_by_name": f.get("created_by_name", ""),
            } for f in forms],
            "total": len(forms),
        }
    
    # ── Get Single Form ────────────────────────────────────────
    async def get_form(self, form_id: str) -> Optional[Dict]:
        """Get a single form with full details"""
        form = await self.db.form_4506c.find_one({"form_id": form_id})
        if not form:
            form = await self.db.form_4506c.find_one({"_id": ObjectId(form_id)}) if ObjectId.is_valid(form_id) else None
        if not form:
            return None
        
        return {
            "id": str(form["_id"]),
            "form_id": form.get("form_id", ""),
            "taxpayer_name": form.get("taxpayer_name", ""),
            "spouse_name": form.get("spouse_name", ""),
            "taxpayer_ssn_last4": form.get("taxpayer_ssn_last4", ""),
            "spouse_ssn_last4": form.get("spouse_ssn_last4", ""),
            "client_email": form.get("client_email", ""),
            "client_phone": form.get("client_phone", ""),
            "current_address": form.get("current_address", {}),
            "previous_address": form.get("previous_address", {}),
            "transcript_types": form.get("transcript_types", []),
            "tax_years": form.get("tax_years", []),
            "filing_status": form.get("filing_status", ""),
            "third_party_name": form.get("third_party_name", ""),
            "third_party_address": form.get("third_party_address", ""),
            "third_party_ein": form.get("third_party_ein", ""),
            "signature_status": form.get("signature_status", "pending"),
            "signature_type": form.get("signature_type", ""),
            "signature_data": form.get("signature_data", ""),
            "signed_at": form["signed_at"].isoformat() if form.get("signed_at") else None,
            "created_at": form["created_at"].isoformat() if form.get("created_at") else "",
            "expires_at": form["expires_at"].isoformat() if form.get("expires_at") else "",
            "submitted_to_irs": form.get("submitted_to_irs", False),
            "created_by_name": form.get("created_by_name", ""),
            "notes": form.get("notes", ""),
        }
    
    # ── Client: Get Pending Forms ──────────────────────────────
    async def get_client_pending_forms(self, client_email: str) -> List[Dict]:
        """Get forms pending signature for a client"""
        forms = await self.db.form_4506c.find({
            "client_email": client_email,
            "signature_status": "pending",
        }).sort("created_at", -1).to_list(20)
        
        return [{
            "id": str(f["_id"]),
            "form_id": f.get("form_id", ""),
            "taxpayer_name": f.get("taxpayer_name", ""),
            "transcript_types": f.get("transcript_types", []),
            "tax_years": f.get("tax_years", []),
            "created_at": f["created_at"].isoformat() if f.get("created_at") else "",
            "expires_at": f["expires_at"].isoformat() if f.get("expires_at") else "",
            "third_party_name": f.get("third_party_name", ""),
        } for f in forms]
    
    # ── Client: Get Signed Forms ──────────────────────────────
    async def get_client_signed_forms(self, client_email: str) -> List[Dict]:
        """Get signed forms for a client"""
        forms = await self.db.form_4506c.find({
            "client_email": client_email,
            "signature_status": "signed",
        }).sort("signed_at", -1).to_list(50)
        
        return [{
            "id": str(f["_id"]),
            "form_id": f.get("form_id", ""),
            "taxpayer_name": f.get("taxpayer_name", ""),
            "transcript_types": f.get("transcript_types", []),
            "tax_years": f.get("tax_years", []),
            "signed_at": f["signed_at"].isoformat() if f.get("signed_at") else "",
            "expires_at": f["expires_at"].isoformat() if f.get("expires_at") else "",
            "signature_type": f.get("signature_type", ""),
        } for f in forms]
    
    # ── Mark as Submitted to IRS ────────────────────────────────
    async def mark_submitted(self, form_id: str) -> Dict:
        """Mark form as submitted to IRS via TDS"""
        now = datetime.now(MIAMI_TZ)
        result = await self.db.form_4506c.update_one(
            {"form_id": form_id},
            {"$set": {
                "submitted_to_irs": True,
                "submitted_at": now,
                "updated_at": now,
            }}
        )
        return {"form_id": form_id, "submitted": True, "submitted_at": now.isoformat()}
    
    # ── Revoke Authorization ────────────────────────────────────
    async def revoke_form(self, form_id: str, reason: str = "") -> Dict:
        """Revoke a signed authorization"""
        now = datetime.now(MIAMI_TZ)
        await self.db.form_4506c.update_one(
            {"form_id": form_id},
            {"$set": {
                "signature_status": "revoked",
                "revoked_at": now,
                "revoke_reason": reason,
                "updated_at": now,
            }}
        )
        return {"form_id": form_id, "status": "revoked"}
