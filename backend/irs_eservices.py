"""
IRS e-Services API Integration Service
Handles TINM (TIN Matching), TDS (Transcript Delivery System), and SOR (Software Developer Online Resource).

Uses the same OAuth 2.0 JWT Bearer authentication as IRIS A2A.

Company: Ross Tax Preparation LLC
API Client ID: a039bcd6-2b92-4f70-9e92-758b0b26dc00
Approved Services: SOR, TDS, TINM, IRIS
"""

import os
import logging
import uuid
import time
import jwt
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ============================================
# IRS API ENDPOINTS
# ============================================

IRS_ENDPOINTS = {
    "token": {
        "production": "https://api.www4.irs.gov/auth/oauth/v2/token",
        "test": "https://api.alt.www4.irs.gov/auth/oauth/v2/token",
    },
    "tinm": {
        "production": "https://api.irs.gov/esrv/api/tinm/request",
        "test": "https://api.alt.irs.gov/esrv/api/tinm/request",
    },
    "tinm_bulk": {
        "production": "https://api.irs.gov/esrv/api/tinm/bulk",
        "test": "https://api.alt.irs.gov/esrv/api/tinm/bulk",
    },
    "tds_transcript": {
        "production": "https://api.irs.gov/esrv/api/tds/transcript",
        "test": "https://api.alt.irs.gov/esrv/api/tds/transcript",
    },
    "tds_status": {
        "production": "https://api.irs.gov/esrv/api/tds/status",
        "test": "https://api.alt.irs.gov/esrv/api/tds/status",
    },
    "sor_mailbox": {
        "production": "https://api.irs.gov/esrv/api/sor/mailbox",
        "test": "https://api.alt.irs.gov/esrv/api/sor/mailbox",
    },
    "sor_schemas": {
        "production": "https://api.irs.gov/esrv/api/sor/schemas",
        "test": "https://api.alt.irs.gov/esrv/api/sor/schemas",
    },
    "sor_alerts": {
        "production": "https://api.irs.gov/esrv/api/sor/alerts",
        "test": "https://api.alt.irs.gov/esrv/api/sor/alerts",
    },
}

# TIN Matching result codes
TINM_RESULT_CODES = {
    0: {"status": "match", "description": "TIN and Name match IRS records", "description_es": "TIN y nombre coinciden con los registros del IRS"},
    1: {"status": "mismatch", "description": "TIN not found / TIN not issued yet", "description_es": "TIN no encontrado / TIN aún no emitido"},
    2: {"status": "mismatch", "description": "TIN does not match the Name provided", "description_es": "TIN no coincide con el nombre proporcionado"},
    3: {"status": "mismatch", "description": "TIN and Name do not match", "description_es": "TIN y nombre no coinciden"},
    4: {"status": "invalid", "description": "Invalid TIN format", "description_es": "Formato de TIN inválido"},
    5: {"status": "unavailable", "description": "TIN Matching service unavailable", "description_es": "Servicio de TIN Matching no disponible"},
    6: {"status": "deceased", "description": "TIN belongs to a deceased individual", "description_es": "TIN pertenece a una persona fallecida"},
    7: {"status": "mismatch", "description": "TIN not found in IRS records", "description_es": "TIN no encontrado en registros del IRS"},
    8: {"status": "invalid", "description": "Invalid request", "description_es": "Solicitud inválida"},
}

# Transcript types available via TDS
TRANSCRIPT_TYPES = {
    "return": {"code": "RETURN", "description": "Tax Return Transcript", "description_es": "Transcripción de Declaración de Impuestos"},
    "account": {"code": "ACCOUNT", "description": "Tax Account Transcript", "description_es": "Transcripción de Cuenta Tributaria"},
    "wage_income": {"code": "WAGE_INCOME", "description": "Wage and Income Transcript (W-2, 1099)", "description_es": "Transcripción de Salarios e Ingresos (W-2, 1099)"},
    "record_of_account": {"code": "RECORD_OF_ACCOUNT", "description": "Record of Account", "description_es": "Registro de Cuenta"},
    "verification_nonfiling": {"code": "VERIFICATION_NONFILING", "description": "Verification of Non-Filing", "description_es": "Verificación de No Declaración"},
}


class IRSEServicesService:
    """Service for IRS e-Services API: TINM, TDS, SOR"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.api_client_id = os.getenv("IRS_IRIS_API_CLIENT_ID", "")
        self.user_id = os.getenv("IRS_IRIS_USER_ID", "")
        self.environment = os.getenv("IRS_ESERVICES_ENVIRONMENT", os.getenv("IRS_IRIS_ENVIRONMENT", "test"))
        self.private_key_path = os.getenv("IRIS_PRIVATE_KEY_PATH", "/app/memory/iris_private_key_v2.pem")
        self._private_key = None
        self._access_token = None
        self._token_expiry = 0

        # MongoDB collections
        self.tinm_logs = db["tinm_verification_logs"]
        self.tds_requests = db["tds_transcript_requests"]
        self.sor_messages = db["sor_mailbox_messages"]

        logger.info(f"🏛️ IRS e-Services initialized (env: {self.environment}, services: TINM, TDS, SOR)")

    # ============================================
    # AUTHENTICATION (OAuth 2.0 JWT Bearer)
    # ============================================

    def _load_private_key(self) -> str:
        if self._private_key is None:
            try:
                with open(self.private_key_path, "r") as f:
                    self._private_key = f.read()
                logger.info("🔑 e-Services private key loaded")
            except FileNotFoundError:
                raise ValueError(f"Private key not found at {self.private_key_path}. Generate RSA key pair and register with IRS e-Services.")
        return self._private_key

    def _generate_jwt(self, issuer: str, subject: str, audience: str) -> str:
        private_key = self._load_private_key()
        now = int(time.time())
        payload = {
            "iss": issuer,
            "sub": subject,
            "aud": audience,
            "iat": now,
            "exp": now + 600,
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "rosstax-iris-2026"})

    async def _get_access_token(self) -> str:
        # Use cached token if still valid
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token

        if not self.api_client_id or not self.user_id:
            raise ValueError("IRS API Client ID and User ID must be configured in .env")

        token_url = IRS_ENDPOINTS["token"][self.environment]
        client_jwt = self._generate_jwt(self.api_client_id, self.api_client_id, token_url)
        user_jwt = self._generate_jwt(self.user_id, self.user_id, token_url)

        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": user_jwt,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_jwt,
        }

        logger.info("🔑 Requesting IRS e-Services OAuth token...")

        async with httpx.AsyncClient(timeout=30.0, verify=True) as client:
            response = await client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})

            if response.status_code == 200:
                token_data = response.json()
                self._access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 900)
                self._token_expiry = time.time() + expires_in
                logger.info(f"✅ IRS OAuth token acquired (expires in {expires_in}s)")
                return self._access_token
            else:
                error_text = response.text[:500]
                logger.error(f"❌ IRS token error {response.status_code}: {error_text}")
                raise Exception(f"IRS OAuth error {response.status_code}: {error_text}")

    async def _api_request(self, method: str, service: str, data: dict = None, params: dict = None) -> dict:
        access_token = await self._get_access_token()
        url = IRS_ENDPOINTS[service][self.environment]
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0, verify=True) as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")

            logger.info(f"IRS {service}: {response.status_code}")

            if response.status_code == 200:
                try:
                    return response.json()
                except Exception:
                    return {"raw_response": response.text[:2000]}
            else:
                error = response.text[:500]
                logger.error(f"IRS {service} error {response.status_code}: {error}")
                return {"error": True, "status_code": response.status_code, "message": error}

    # ============================================
    # TINM — TIN Matching Service
    # ============================================

    async def verify_tin(self, tin: str, name: str, tin_type: str = "SSN", admin_id: str = "") -> dict:
        """
        Verify a single TIN (SSN/EIN) against IRS records.
        
        tin_type: SSN, EIN, or UNKNOWN
        Returns: match status (0=match, 1-8=various issues)
        """
        try:
            # Clean TIN (remove dashes/spaces)
            clean_tin = tin.replace("-", "").replace(" ", "").strip()
            clean_name = name.strip().upper()

            if len(clean_tin) != 9:
                return {
                    "success": False,
                    "error": "TIN must be 9 digits",
                    "error_es": "TIN debe tener 9 dígitos",
                }

            payload = {
                "tinType": tin_type,
                "tin": clean_tin,
                "name": clean_name,
            }

            result = await self._api_request("POST", "tinm", data=payload)

            if result.get("error"):
                # If IRS API is unavailable, log and return graceful error
                log_entry = {
                    "admin_id": admin_id,
                    "tin_last4": clean_tin[-4:],
                    "name": clean_name,
                    "tin_type": tin_type,
                    "result_code": -1,
                    "result_status": "api_error",
                    "api_error": result.get("message", "Unknown error"),
                    "environment": self.environment,
                    "created_at": datetime.now(timezone.utc),
                }
                await self.tinm_logs.insert_one(log_entry)

                return {
                    "success": False,
                    "result_code": -1,
                    "status": "api_error",
                    "description": "IRS TIN Matching service unavailable. Verify manually.",
                    "description_es": "Servicio de TIN Matching del IRS no disponible. Verifique manualmente.",
                }

            # Parse result
            result_code = result.get("result", result.get("resultCode", -1))
            if isinstance(result_code, str):
                result_code = int(result_code)

            result_info = TINM_RESULT_CODES.get(result_code, {
                "status": "unknown", "description": f"Unknown result code: {result_code}",
                "description_es": f"Código de resultado desconocido: {result_code}"
            })

            # Log verification
            log_entry = {
                "admin_id": admin_id,
                "tin_last4": clean_tin[-4:],
                "name": clean_name,
                "tin_type": tin_type,
                "result_code": result_code,
                "result_status": result_info["status"],
                "description": result_info["description"],
                "environment": self.environment,
                "created_at": datetime.now(timezone.utc),
            }
            await self.tinm_logs.insert_one(log_entry)

            return {
                "success": True,
                "result_code": result_code,
                "status": result_info["status"],
                "is_match": result_code == 0,
                "description": result_info["description"],
                "description_es": result_info["description_es"],
                "tin_last4": clean_tin[-4:],
                "name_verified": clean_name,
            }

        except Exception as e:
            logger.error(f"TINM verification error: {e}")
            return {"success": False, "error": str(e), "error_es": f"Error de verificación: {e}"}

    async def verify_tin_bulk(self, records: List[dict], admin_id: str = "") -> dict:
        """
        Verify multiple TINs at once (batch). Max 25 per interactive request.
        
        records: [{"tin": "123456789", "name": "JOHN DOE", "tin_type": "SSN"}, ...]
        """
        try:
            if len(records) > 25:
                return {"success": False, "error": "Maximum 25 records per interactive batch", "error_es": "Máximo 25 registros por lote interactivo"}

            items = []
            for rec in records:
                clean_tin = rec.get("tin", "").replace("-", "").replace(" ", "").strip()
                items.append({
                    "tinType": rec.get("tin_type", "SSN"),
                    "tin": clean_tin,
                    "name": rec.get("name", "").strip().upper(),
                })

            result = await self._api_request("POST", "tinm_bulk", data={"records": items})

            if result.get("error"):
                return {"success": False, "error": result.get("message", "Batch verification failed")}

            # Process results
            results = []
            batch_results = result.get("results", result.get("records", []))
            for i, item_result in enumerate(batch_results):
                code = item_result.get("result", item_result.get("resultCode", -1))
                if isinstance(code, str):
                    code = int(code)
                info = TINM_RESULT_CODES.get(code, {"status": "unknown", "description": f"Code {code}", "description_es": f"Código {code}"})
                results.append({
                    "index": i,
                    "tin_last4": items[i]["tin"][-4:] if i < len(items) else "",
                    "name": items[i]["name"] if i < len(items) else "",
                    "result_code": code,
                    "status": info["status"],
                    "is_match": code == 0,
                    "description": info["description"],
                    "description_es": info["description_es"],
                })

            # Log batch
            await self.tinm_logs.insert_one({
                "admin_id": admin_id,
                "batch_size": len(records),
                "batch_type": "interactive",
                "match_count": sum(1 for r in results if r["is_match"]),
                "mismatch_count": sum(1 for r in results if not r["is_match"]),
                "environment": self.environment,
                "created_at": datetime.now(timezone.utc),
            })

            match_count = sum(1 for r in results if r["is_match"])
            return {
                "success": True,
                "total": len(results),
                "matches": match_count,
                "mismatches": len(results) - match_count,
                "results": results,
            }

        except Exception as e:
            logger.error(f"TINM bulk error: {e}")
            return {"success": False, "error": str(e)}

    async def get_tinm_history(self, admin_id: str, limit: int = 50) -> List[dict]:
        """Get TIN verification history"""
        logs = await self.tinm_logs.find(
            {"admin_id": admin_id}
        ).sort("created_at", -1).to_list(limit)

        return [{
            "id": str(log["_id"]),
            "tin_last4": log.get("tin_last4", ""),
            "name": log.get("name", ""),
            "tin_type": log.get("tin_type", ""),
            "result_code": log.get("result_code", -1),
            "result_status": log.get("result_status", ""),
            "description": log.get("description", ""),
            "batch_size": log.get("batch_size"),
            "environment": log.get("environment", ""),
            "created_at": str(log.get("created_at", "")),
        } for log in logs]

    # ============================================
    # TDS — Transcript Delivery System
    # ============================================

    async def request_transcript(self, taxpayer_tin: str, taxpayer_name: str,
                                  transcript_type: str, tax_year: int,
                                  admin_id: str = "", caf_number: str = "") -> dict:
        """
        Request a tax transcript from the IRS.
        
        transcript_type: return, account, wage_income, record_of_account, verification_nonfiling
        Requires: CAF number (Centralized Authorization File) from Form 2848/8821
        """
        try:
            clean_tin = taxpayer_tin.replace("-", "").replace(" ", "").strip()
            type_info = TRANSCRIPT_TYPES.get(transcript_type)
            if not type_info:
                return {"success": False, "error": f"Invalid transcript type: {transcript_type}"}

            payload = {
                "taxpayerTIN": clean_tin,
                "taxpayerName": taxpayer_name.strip().upper(),
                "transcriptType": type_info["code"],
                "taxYear": str(tax_year),
                "cafNumber": caf_number,
            }

            result = await self._api_request("POST", "tds_transcript", data=payload)

            # Save request to DB
            request_doc = {
                "admin_id": admin_id,
                "taxpayer_tin_last4": clean_tin[-4:],
                "taxpayer_name": taxpayer_name.strip().upper(),
                "transcript_type": transcript_type,
                "transcript_type_description": type_info["description"],
                "tax_year": tax_year,
                "caf_number": caf_number,
                "status": "completed" if not result.get("error") else "failed",
                "api_response_summary": str(result)[:500] if result.get("error") else "Transcript received",
                "transcript_data": result if not result.get("error") else None,
                "environment": self.environment,
                "created_at": datetime.now(timezone.utc),
            }
            insert_result = await self.tds_requests.insert_one(request_doc)

            if result.get("error"):
                return {
                    "success": False,
                    "request_id": str(insert_result.inserted_id),
                    "error": result.get("message", "Transcript request failed"),
                    "error_es": "Error al solicitar transcripción del IRS",
                }

            return {
                "success": True,
                "request_id": str(insert_result.inserted_id),
                "transcript_type": type_info["description"],
                "transcript_type_es": type_info["description_es"],
                "tax_year": tax_year,
                "taxpayer_tin_last4": clean_tin[-4:],
                "data": result,
                "message": "Transcript received successfully",
                "message_es": "Transcripción recibida exitosamente",
            }

        except Exception as e:
            logger.error(f"TDS transcript request error: {e}")
            return {"success": False, "error": str(e)}

    async def check_transcript_status(self, request_id: str) -> dict:
        """Check status of a transcript request"""
        try:
            request_doc = await self.tds_requests.find_one({"_id": ObjectId(request_id)})
            if not request_doc:
                return {"success": False, "error": "Request not found"}

            return {
                "success": True,
                "request_id": request_id,
                "status": request_doc.get("status", "unknown"),
                "transcript_type": request_doc.get("transcript_type_description", ""),
                "tax_year": request_doc.get("tax_year", ""),
                "taxpayer_tin_last4": request_doc.get("taxpayer_tin_last4", ""),
                "created_at": str(request_doc.get("created_at", "")),
                "has_data": request_doc.get("transcript_data") is not None,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_transcript_history(self, admin_id: str, limit: int = 50) -> List[dict]:
        """Get transcript request history"""
        requests = await self.tds_requests.find(
            {"admin_id": admin_id}
        ).sort("created_at", -1).to_list(limit)

        return [{
            "id": str(req["_id"]),
            "taxpayer_tin_last4": req.get("taxpayer_tin_last4", ""),
            "taxpayer_name": req.get("taxpayer_name", ""),
            "transcript_type": req.get("transcript_type", ""),
            "transcript_type_description": req.get("transcript_type_description", ""),
            "tax_year": req.get("tax_year", ""),
            "status": req.get("status", ""),
            "environment": req.get("environment", ""),
            "created_at": str(req.get("created_at", "")),
        } for req in requests]

    async def get_available_transcript_types(self) -> List[dict]:
        """Return available transcript types"""
        return [
            {"id": k, "code": v["code"], "description": v["description"], "description_es": v["description_es"]}
            for k, v in TRANSCRIPT_TYPES.items()
        ]

    # ============================================
    # SOR — Software Developer Online Resource
    # ============================================

    async def get_sor_mailbox(self, admin_id: str = "") -> dict:
        """
        Check the IRS developer mailbox for updates, alerts, and schema changes.
        """
        try:
            result = await self._api_request("GET", "sor_mailbox")

            if result.get("error"):
                return {
                    "success": False,
                    "error": result.get("message", "SOR mailbox unavailable"),
                    "error_es": "Buzón SOR del IRS no disponible",
                }

            # Save messages to DB
            messages = result.get("messages", result.get("items", []))
            if messages:
                for msg in messages:
                    msg["admin_id"] = admin_id
                    msg["fetched_at"] = datetime.now(timezone.utc)
                    msg["source"] = "sor_mailbox"
                    # Upsert by message ID to avoid duplicates
                    msg_id = msg.get("messageId", msg.get("id", str(uuid.uuid4())))
                    await self.sor_messages.update_one(
                        {"message_id": msg_id},
                        {"$set": {**msg, "message_id": msg_id}},
                        upsert=True,
                    )

            return {
                "success": True,
                "message_count": len(messages) if isinstance(messages, list) else 0,
                "messages": messages,
            }

        except Exception as e:
            logger.error(f"SOR mailbox error: {e}")
            return {"success": False, "error": str(e)}

    async def get_sor_alerts(self, admin_id: str = "") -> dict:
        """Get IRS alerts for software developers (schema updates, deadline notices, etc.)"""
        try:
            result = await self._api_request("GET", "sor_alerts")

            if result.get("error"):
                return {"success": False, "error": result.get("message", "SOR alerts unavailable")}

            alerts = result.get("alerts", result.get("items", []))

            return {
                "success": True,
                "alert_count": len(alerts) if isinstance(alerts, list) else 0,
                "alerts": alerts,
            }

        except Exception as e:
            logger.error(f"SOR alerts error: {e}")
            return {"success": False, "error": str(e)}

    async def get_sor_schemas(self, form_type: str = "") -> dict:
        """Get available IRS XML schemas for electronic filing"""
        try:
            params = {}
            if form_type:
                params["formType"] = form_type

            result = await self._api_request("GET", "sor_schemas", params=params)

            if result.get("error"):
                return {"success": False, "error": result.get("message", "SOR schemas unavailable")}

            schemas = result.get("schemas", result.get("items", []))

            return {
                "success": True,
                "schema_count": len(schemas) if isinstance(schemas, list) else 0,
                "schemas": schemas,
            }

        except Exception as e:
            logger.error(f"SOR schemas error: {e}")
            return {"success": False, "error": str(e)}

    async def get_sor_message_history(self, admin_id: str, limit: int = 50) -> List[dict]:
        """Get locally cached SOR messages"""
        messages = await self.sor_messages.find(
            {"admin_id": admin_id}
        ).sort("fetched_at", -1).to_list(limit)

        return [{
            "id": str(msg["_id"]),
            "message_id": msg.get("message_id", ""),
            "subject": msg.get("subject", msg.get("title", "")),
            "body": msg.get("body", msg.get("content", "")),
            "date": msg.get("date", msg.get("publishDate", "")),
            "source": msg.get("source", ""),
            "fetched_at": str(msg.get("fetched_at", "")),
        } for msg in messages]

    # ============================================
    # DIAGNOSTIC / STATUS
    # ============================================

    async def check_service_status(self) -> dict:
        """Check connectivity to all IRS e-Services"""
        status = {
            "environment": self.environment,
            "api_client_id_configured": bool(self.api_client_id),
            "user_id_configured": bool(self.user_id),
            "private_key_exists": os.path.exists(self.private_key_path),
            "services": {},
        }

        # Try to get token
        try:
            token = await self._get_access_token()
            status["oauth_token"] = "✅ Valid"
        except Exception as e:
            status["oauth_token"] = f"❌ {str(e)[:100]}"
            status["services"] = {"tinm": "❌ Cannot test (no token)", "tds": "❌ Cannot test", "sor": "❌ Cannot test"}
            return status

        # Test each service with a lightweight call
        for service_name, service_key in [("tinm", "tinm"), ("tds", "tds_status"), ("sor", "sor_alerts")]:
            try:
                url = IRS_ENDPOINTS[service_key][self.environment]
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                    })
                    status["services"][service_name] = f"{'✅' if resp.status_code < 400 else '⚠️'} HTTP {resp.status_code}"
            except Exception as e:
                status["services"][service_name] = f"❌ {str(e)[:60]}"

        return status
