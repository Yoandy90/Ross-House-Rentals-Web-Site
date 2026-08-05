"""
IRS Transcript Delivery System (TDS) Service
Handles requesting and retrieving tax transcripts (W-2, 1099, Tax Return, etc.)
via the IRS FBP (Forms-Based Products) A2A API.

Endpoints:
- Production: https://api.www4.irs.gov/fbp/1.0/a2a/...
- Test: https://api.alt.www4.irs.gov/fbp/1.0/a2a/...
"""

import os
import logging
import uuid
import time
import jwt  # PyJWT
from datetime import datetime
from typing import Dict, List, Any, Optional
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MIAMI_TZ = ZoneInfo("America/New_York")

# IRS FBP API Endpoints (for TDS transcript delivery)
FBP_ENDPOINTS = {
    "production": "https://api.www4.irs.gov/fbp/1.0/a2a",
    "test": "https://api.alt.www4.irs.gov/fbp/1.0/a2a"
}

# Token endpoint (same as IRIS)
IRS_TOKEN_ENDPOINT = "https://api.www4.irs.gov/auth/oauth/v2/token"

# Private key path (same key as IRIS)
IRIS_PRIVATE_KEY_PATH = os.getenv("IRIS_PRIVATE_KEY_PATH", "/app/memory/iris_private_key_v2.pem")
IRIS_KID = "rosstax-iris-2026"

# Transcript Types
TRANSCRIPT_TYPES = {
    "tax_return": {
        "code": "TAXRETURN",
        "name": "Tax Return Transcript",
        "description": "Shows most line items from the original tax return (Form 1040)",
        "years_available": "Current + 3 prior years",
        "product_id": "RTNTRN"
    },
    "wage_income": {
        "code": "WAGEINCOME",
        "name": "Wage & Income Transcript",
        "description": "Shows W-2, 1099, 1098, 5498 data reported to IRS by employers/payers",
        "years_available": "Current + 10 prior years",
        "product_id": "WITRN"
    },
    "account": {
        "code": "ACCOUNT",
        "name": "Account Transcript",
        "description": "Shows basic data including filing status, taxable income, payments, adjustments",
        "years_available": "Current + 3 prior years",
        "product_id": "ACCTTRN"
    },
    "record_of_account": {
        "code": "RECORDOFACCOUNT",
        "name": "Record of Account Transcript",
        "description": "Combines tax return and account transcript data",
        "years_available": "Current + 3 prior years",
        "product_id": "ROATRN"
    },
    "verification_nonfiling": {
        "code": "VRNF",
        "name": "Verification of Non-Filing Letter",
        "description": "Proof that a tax return was not filed for a specific year",
        "years_available": "Current + 3 prior years",
        "product_id": "VRNF"
    }
}


class TDSService:
    """IRS Transcript Delivery System Service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.api_client_id = os.getenv("IRS_IRIS_API_CLIENT_ID", "")
        self.iris_user_id = os.getenv("IRS_IRIS_USER_ID", "")
        self.environment = os.getenv("IRS_IRIS_ENVIRONMENT", "test")
        self._private_key = None
        logger.info(f"📋 TDS Service initialized (env: {self.environment})")
    
    # ─── JWT / OAuth Authentication (shared with IRIS) ─────────
    
    def _load_private_key(self) -> str:
        if self._private_key is None:
            try:
                with open(IRIS_PRIVATE_KEY_PATH, "r") as f:
                    self._private_key = f.read()
            except FileNotFoundError:
                raise ValueError(f"Private key not found at {IRIS_PRIVATE_KEY_PATH}")
        return self._private_key
    
    def _generate_client_jwt(self) -> str:
        private_key = self._load_private_key()
        now = int(time.time())
        payload = {
            "iss": self.api_client_id,
            "sub": self.api_client_id,
            "aud": IRS_TOKEN_ENDPOINT,
            "iat": now,
            "exp": now + 600,
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": IRIS_KID})
    
    def _generate_user_jwt(self) -> str:
        private_key = self._load_private_key()
        now = int(time.time())
        payload = {
            "iss": self.iris_user_id,
            "sub": self.iris_user_id,
            "aud": IRS_TOKEN_ENDPOINT,
            "iat": now,
            "exp": now + 600,
            "jti": str(uuid.uuid4())
        }
        return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": IRIS_KID})
    
    async def _get_access_token(self) -> str:
        if not self.api_client_id or not self.iris_user_id:
            raise ValueError("API Client ID and User ID must be configured")
        
        client_jwt = self._generate_client_jwt()
        user_jwt = self._generate_user_jwt()
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": user_jwt,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_jwt
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                IRS_TOKEN_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                token_data = response.json()
                return token_data.get("access_token")
            else:
                raise Exception(f"IRS OAuth error {response.status_code}: {response.text[:500]}")
    
    # ─── Transcript Types ─────────────────────────────────────
    
    def get_transcript_types(self) -> List[Dict]:
        """Return available transcript types"""
        return [
            {
                "id": key,
                "code": val["code"],
                "name": val["name"],
                "description": val["description"],
                "years_available": val["years_available"]
            }
            for key, val in TRANSCRIPT_TYPES.items()
        ]
    
    # ─── Request Transcript ───────────────────────────────────
    
    async def request_transcript(
        self,
        client_tin: str,
        client_name: str,
        transcript_type: str,
        tax_year: str,
        client_id: str = "",
        client_address: str = "",
        client_dob: str = ""
    ) -> Dict:
        """
        Request a transcript from the IRS TDS/FBP system.
        
        Args:
            client_tin: Client's SSN or EIN (will be used for PII header)
            client_name: Client's full name
            transcript_type: One of the TRANSCRIPT_TYPES keys
            tax_year: Tax year to request (e.g., "2024")
            client_id: Internal client ID reference
            client_address: Client's address for verification
            client_dob: Client's date of birth (MM/DD/YYYY)
        """
        if transcript_type not in TRANSCRIPT_TYPES:
            raise ValueError(f"Invalid transcript type. Valid types: {list(TRANSCRIPT_TYPES.keys())}")
        
        tin_clean = client_tin.replace("-", "").replace(" ", "")
        if len(tin_clean) != 9:
            raise ValueError("TIN must be 9 digits")
        
        transcript_info = TRANSCRIPT_TYPES[transcript_type]
        
        # Create request record in DB
        request_record = {
            "client_name": client_name,
            "client_tin_last4": tin_clean[-4:],
            "client_id": client_id,
            "transcript_type": transcript_type,
            "transcript_name": transcript_info["name"],
            "tax_year": tax_year,
            "status": "pending",
            "environment": self.environment,
            "requested_at": datetime.now(MIAMI_TZ),
            "created_at": datetime.now(MIAMI_TZ)
        }
        
        try:
            access_token = await self._get_access_token()
            
            base_url = FBP_ENDPOINTS.get(self.environment, FBP_ENDPOINTS["test"])
            
            # Submit document request to FBP
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-FBP-PII": f"tin={tin_clean}"
            }
            
            # FBP document request payload
            request_payload = {
                "productType": transcript_info["product_id"],
                "taxYear": tax_year,
                "taxpayerName": client_name,
                "tin": tin_clean,
                "requestType": "TRANSCRIPT",
                "deliveryMethod": "ELECTRONIC"
            }
            
            if client_address:
                request_payload["taxpayerAddress"] = client_address
            if client_dob:
                request_payload["dateOfBirth"] = client_dob
            
            logger.info(f"📋 Requesting {transcript_info['name']} for ***{tin_clean[-4:]} (year {tax_year})...")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{base_url}/documents",
                    json=request_payload,
                    headers=headers
                )
                
                request_record["response_status"] = response.status_code
                request_record["response_body"] = response.text[:5000]
                
                if response.status_code in [200, 201, 202]:
                    resp_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    request_record["status"] = "submitted"
                    request_record["transaction_id"] = resp_data.get("transactionId", "")
                    request_record["product_id"] = resp_data.get("productId", "")
                    logger.info(f"✅ Transcript request submitted: {resp_data.get('transactionId', 'N/A')}")
                else:
                    request_record["status"] = "error"
                    request_record["error_message"] = response.text[:2000]
                    logger.error(f"❌ Transcript request failed: {response.status_code}")
                    
        except Exception as e:
            request_record["status"] = "error"
            request_record["error_message"] = str(e)
            logger.error(f"❌ Transcript request error: {e}")
        
        # Save to DB
        result = await self.db.tds_requests.insert_one(request_record)
        
        return {
            "request_id": str(result.inserted_id),
            "client_name": client_name,
            "client_tin_last4": tin_clean[-4:],
            "transcript_type": transcript_info["name"],
            "tax_year": tax_year,
            "status": request_record["status"],
            "transaction_id": request_record.get("transaction_id", ""),
            "error": request_record.get("error_message", ""),
            "response_status": request_record.get("response_status")
        }
    
    # ─── Check Request Status ─────────────────────────────────
    
    async def check_request_status(self, request_id: str) -> Dict:
        """Check the status of a transcript request"""
        record = await self.db.tds_requests.find_one({"_id": ObjectId(request_id)})
        if not record:
            raise ValueError("Request not found")
        
        transaction_id = record.get("transaction_id")
        if not transaction_id:
            return {
                "request_id": request_id,
                "status": record.get("status"),
                "message": "No transaction ID - request may not have been submitted successfully"
            }
        
        try:
            access_token = await self._get_access_token()
            base_url = FBP_ENDPOINTS.get(self.environment, FBP_ENDPOINTS["test"])
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{base_url}/documents/{transaction_id}",
                    headers=headers
                )
                
                result = {
                    "request_id": request_id,
                    "transaction_id": transaction_id,
                    "status_code": response.status_code,
                    "status": record.get("status")
                }
                
                if response.status_code == 200:
                    data = response.json() if "json" in response.headers.get("content-type", "") else {}
                    result["irs_status"] = data.get("status", "")
                    result["product_id"] = data.get("productId", "")
                    
                    # Update DB
                    update = {
                        "last_status_check": datetime.now(MIAMI_TZ),
                        "irs_status": data.get("status", "")
                    }
                    
                    if data.get("status") == "COMPLETED":
                        update["status"] = "ready"
                        result["status"] = "ready"
                        result["message"] = "Transcript is ready for download"
                    
                    await self.db.tds_requests.update_one(
                        {"_id": ObjectId(request_id)},
                        {"$set": update}
                    )
                else:
                    result["error"] = response.text[:1000]
                
                return result
                
        except Exception as e:
            return {
                "request_id": request_id,
                "status": record.get("status"),
                "error": str(e)
            }
    
    # ─── Download Transcript ──────────────────────────────────
    
    async def download_transcript(self, request_id: str) -> Dict:
        """Download a completed transcript"""
        record = await self.db.tds_requests.find_one({"_id": ObjectId(request_id)})
        if not record:
            raise ValueError("Request not found")
        
        product_id = record.get("product_id")
        if not product_id:
            raise ValueError("No product ID available - transcript may not be ready")
        
        try:
            access_token = await self._get_access_token()
            base_url = FBP_ENDPOINTS.get(self.environment, FBP_ENDPOINTS["test"])
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/pdf,application/json"
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(
                    f"{base_url}/products/{product_id}/content",
                    headers=headers
                )
                
                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "")
                    
                    # Update DB
                    await self.db.tds_requests.update_one(
                        {"_id": ObjectId(request_id)},
                        {"$set": {
                            "status": "downloaded",
                            "downloaded_at": datetime.now(MIAMI_TZ)
                        }}
                    )
                    
                    return {
                        "request_id": request_id,
                        "content_type": content_type,
                        "content": response.content,
                        "size": len(response.content)
                    }
                else:
                    raise ValueError(f"Download failed: {response.status_code} - {response.text[:500]}")
                    
        except Exception as e:
            logger.error(f"Transcript download error: {e}")
            raise
    
    # ─── Search Requests by Client TIN ────────────────────────
    
    async def search_by_tin(self, tin: str) -> Dict:
        """Search for existing transcript requests by TIN via IRS"""
        tin_clean = tin.replace("-", "").replace(" ", "")
        
        try:
            access_token = await self._get_access_token()
            base_url = FBP_ENDPOINTS.get(self.environment, FBP_ENDPOINTS["test"])
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "X-FBP-PII": f"tin={tin_clean}"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{base_url}/documents",
                    headers=headers
                )
                
                result = {
                    "tin_last4": tin_clean[-4:],
                    "status_code": response.status_code
                }
                
                if response.status_code == 200:
                    data = response.json() if "json" in response.headers.get("content-type", "") else {}
                    result["documents"] = data.get("documents", [])
                    result["count"] = len(result["documents"])
                else:
                    result["error"] = response.text[:500]
                
                return result
                
        except Exception as e:
            return {"tin_last4": tin_clean[-4:], "error": str(e)}
    
    # ─── Bulk Request for Multiple Clients ────────────────────
    
    async def bulk_request_transcripts(
        self,
        requests: List[Dict],
        transcript_type: str = "wage_income"
    ) -> Dict:
        """
        Request transcripts for multiple clients.
        Each request: {tin, name, tax_year, client_id (optional)}
        """
        results = {"submitted": 0, "failed": 0, "details": []}
        
        for req in requests:
            try:
                result = await self.request_transcript(
                    client_tin=req["tin"],
                    client_name=req["name"],
                    transcript_type=transcript_type,
                    tax_year=req.get("tax_year", str(datetime.now(MIAMI_TZ).year - 1)),
                    client_id=req.get("client_id", ""),
                    client_address=req.get("address", ""),
                    client_dob=req.get("dob", "")
                )
                
                if result.get("status") == "submitted":
                    results["submitted"] += 1
                else:
                    results["failed"] += 1
                
                results["details"].append(result)
                
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "client_name": req.get("name", "Unknown"),
                    "error": str(e)
                })
        
        return results
    
    # ─── List Requests from DB ────────────────────────────────
    
    async def list_requests(
        self,
        page: int = 1,
        limit: int = 20,
        status: str = "",
        transcript_type: str = ""
    ) -> Dict:
        """List transcript requests with filtering"""
        query = {}
        if status:
            query["status"] = status
        if transcript_type:
            query["transcript_type"] = transcript_type
        
        total = await self.db.tds_requests.count_documents(query)
        skip = (page - 1) * limit
        
        requests = await self.db.tds_requests.find(query).sort(
            "requested_at", -1
        ).skip(skip).limit(limit).to_list(limit)
        
        return {
            "requests": [{
                "id": str(r["_id"]),
                "client_name": r.get("client_name", ""),
                "client_tin_last4": r.get("client_tin_last4", "****"),
                "transcript_type": r.get("transcript_type", ""),
                "transcript_name": r.get("transcript_name", ""),
                "tax_year": r.get("tax_year", ""),
                "status": r.get("status", ""),
                "transaction_id": r.get("transaction_id", ""),
                "error": r.get("error_message", ""),
                "requested_at": r.get("requested_at", "").isoformat() if r.get("requested_at") else None
            } for r in requests],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    # ─── Dashboard Stats ──────────────────────────────────────
    
    async def get_dashboard(self) -> Dict:
        """Get TDS dashboard statistics"""
        total = await self.db.tds_requests.count_documents({})
        pending = await self.db.tds_requests.count_documents({"status": "pending"})
        submitted = await self.db.tds_requests.count_documents({"status": "submitted"})
        ready = await self.db.tds_requests.count_documents({"status": "ready"})
        downloaded = await self.db.tds_requests.count_documents({"status": "downloaded"})
        errors = await self.db.tds_requests.count_documents({"status": "error"})
        
        # By type
        pipeline = [
            {"$group": {
                "_id": "$transcript_type",
                "count": {"$sum": 1}
            }}
        ]
        by_type = {}
        async for doc in self.db.tds_requests.aggregate(pipeline):
            t = doc["_id"]
            if t and t in TRANSCRIPT_TYPES:
                by_type[t] = {
                    "name": TRANSCRIPT_TYPES[t]["name"],
                    "count": doc["count"]
                }
        
        # Recent requests
        recent = await self.db.tds_requests.find().sort(
            "requested_at", -1
        ).limit(5).to_list(5)
        
        return {
            "total_requests": total,
            "status_breakdown": {
                "pending": pending,
                "submitted": submitted,
                "ready": ready,
                "downloaded": downloaded,
                "errors": errors
            },
            "by_type": by_type,
            "recent": [{
                "id": str(r["_id"]),
                "client_name": r.get("client_name", ""),
                "transcript_name": r.get("transcript_name", ""),
                "tax_year": r.get("tax_year", ""),
                "status": r.get("status", ""),
                "requested_at": r.get("requested_at", "").isoformat() if r.get("requested_at") else None
            } for r in recent],
            "environment": self.environment,
            "transcript_types_available": len(TRANSCRIPT_TYPES)
        }
