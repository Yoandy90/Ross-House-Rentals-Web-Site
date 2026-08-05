"""
IRS IRIS A2A Integration Service
Handles 1099-NEC, 1099-MISC, and 1042-S electronic filing via IRS IRIS API.

TCC Information:
- A2A TCC: DH55D (Application-to-Application)
- Portal TCC: DH55F (Manual Portal)
- EIN: 33-1240497
- Firm: Ross Tax Preparation LLC

Endpoints:
- Production: https://api.www4.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/intake-acceptance
- ATS (Test): https://api.ats.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/intake-acceptance
"""

import os
import logging
import uuid
import time
import jwt  # PyJWT
import xml.etree.ElementTree as ET
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

# IRS IRIS Endpoints
IRIS_ENDPOINTS = {
    "production": "https://api.www4.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/intake-acceptance",
    "test": "https://api.alt.www4.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/intake-acceptance"
}

IRIS_STATUS_ENDPOINTS = {
    "production": "https://api.www4.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/transstatusorack",
    "test": "https://api.alt.www4.irs.gov/IRIntakeAcceptanceA2A/1.0/irisa2a/v1/transstatusorack"
}

# Token endpoint is the same for both environments
IRS_TOKEN_ENDPOINT = "https://api.www4.irs.gov/auth/oauth/v2/token"

# Private key path
IRIS_PRIVATE_KEY_PATH = os.getenv("IRIS_PRIVATE_KEY_PATH", "/app/memory/iris_private_key_v2.pem")
IRIS_KID = "rosstax-iris-2026"

# Company Info
TRANSMITTER_INFO = {
    "tcc": "DH55D",
    "portal_tcc": "DH55F",
    "ein": "331240497",  # No dashes for XML
    "ein_display": "33-1240497",
    "legal_name": "Ross Tax Preparation LLC",
    "dba": "Ross Tax Preparation",
    "address": "305 Bruce Ave",
    "city": "Dumas",
    "state": "TX",
    "zip": "79029",
    "phone": "8069342018",
    "contact_name": "Yoandy Ross"
}


class IRISService:
    """Service for IRS IRIS A2A electronic filing of information returns"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.api_client_id = os.getenv("IRS_IRIS_API_CLIENT_ID", "")
        self.iris_user_id = os.getenv("IRS_IRIS_USER_ID", "")
        self.environment = os.getenv("IRS_IRIS_ENVIRONMENT", "test")  # "test" or "production"
        self._private_key = None
        logger.info(f"📋 IRIS Service initialized (env: {self.environment}, TCC: {TRANSMITTER_INFO['tcc']})")
    
    # ─── JWT / OAuth Authentication ────────────────────────────────
    
    def _load_private_key(self) -> str:
        """Load the RSA private key from file"""
        if self._private_key is None:
            try:
                with open(IRIS_PRIVATE_KEY_PATH, "r") as f:
                    self._private_key = f.read()
                logger.info("🔑 IRIS private key loaded")
            except FileNotFoundError:
                raise ValueError(f"IRIS private key not found at {IRIS_PRIVATE_KEY_PATH}")
        return self._private_key
    
    def _generate_client_jwt(self) -> str:
        """Generate Client JWT for OAuth authentication (represents the application)"""
        private_key = self._load_private_key()
        now = int(time.time())
        
        payload = {
            "iss": self.api_client_id,
            "sub": self.api_client_id,
            "aud": IRS_TOKEN_ENDPOINT,
            "iat": now,
            "exp": now + 600,  # 10 minutes
            "jti": str(uuid.uuid4())
        }
        
        headers = {
            "kid": IRIS_KID
        }
        
        token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
        logger.debug(f"🔑 Client JWT generated (iss={self.api_client_id[:8]}...)")
        return token
    
    def _generate_user_jwt(self) -> str:
        """Generate User JWT for OAuth authorization (represents the resource owner)"""
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
        
        headers = {
            "kid": IRIS_KID
        }
        
        token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
        logger.debug(f"🔑 User JWT generated (iss={self.iris_user_id[:8]}...)")
        return token
    
    async def _get_access_token(self) -> str:
        """Get OAuth 2.0 access token from IRS using JWT Bearer assertion"""
        if not self.api_client_id or not self.iris_user_id:
            raise ValueError("IRIS API Client ID and User ID must be configured")
        
        client_jwt = self._generate_client_jwt()
        user_jwt = self._generate_user_jwt()
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": user_jwt,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_jwt
        }
        
        logger.info(f"🔑 Requesting OAuth token from IRS...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                IRS_TOKEN_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 900)
                logger.info(f"✅ IRS OAuth token acquired (expires in {expires_in}s)")
                return access_token
            else:
                error_text = response.text[:1000]
                logger.error(f"❌ IRS token error {response.status_code}: {error_text}")
                raise Exception(f"IRS OAuth token error {response.status_code}: {error_text}")
    
    async def check_submission_status(self, transmission_id: str) -> Dict:
        """Check the status of a previously submitted transmission"""
        try:
            access_token = await self._get_access_token()
            
            status_endpoint = IRIS_STATUS_ENDPOINTS.get(self.environment, IRIS_STATUS_ENDPOINTS["test"])
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/xml"
            }
            
            params = {"transmissionId": transmission_id}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(status_endpoint, headers=headers, params=params)
                
                result = {
                    "transmission_id": transmission_id,
                    "status_code": response.status_code,
                    "response": response.text[:5000]
                }
                
                # Update DB record
                await self.db.iris_submissions.update_one(
                    {"transmission_id": transmission_id},
                    {"$set": {
                        "last_status_check": datetime.now(MIAMI_TZ),
                        "last_status_response": response.text[:5000],
                        "last_status_code": response.status_code
                    }}
                )
                
                logger.info(f"📋 Status check for {transmission_id}: {response.status_code}")
                return result
                
        except Exception as e:
            logger.error(f"Error checking status: {e}")
            raise
    
    # ─── ATS Test Submission ──────────────────────────────────────
    
    async def run_ats_test(self) -> Dict:
        """
        Run ATS (Assurance Testing System) test submission.
        Creates dummy recipients and 1099-NEC forms with test TINs (000-xx-xxxx)
        and submits them to the IRS ATS endpoint.
        """
        logger.info("🧪 Starting IRIS ATS test submission...")
        
        tax_year = "2025"
        
        # Step 1: Create test recipients with 000 TINs (IRS ATS requirement)
        test_recipients = [
            {
                "name": "John ATS Testrecipient",
                "business_name": "",
                "tin_type": "SSN",
                "tin_encrypted": "000111111",
                "tin_last4": "1111",
                "address": "123 Test Street",
                "city": "Dumas",
                "state": "TX",
                "zip": "79029",
                "email": "test1@test.com",
                "phone": "8005551111",
                "forms_count": 0,
                "is_ats_test": True,
                "created_at": datetime.now(MIAMI_TZ),
                "updated_at": datetime.now(MIAMI_TZ)
            },
            {
                "name": "Jane ATS Testrecipient",
                "business_name": "Test Business LLC",
                "tin_type": "EIN",
                "tin_encrypted": "000222222",
                "tin_last4": "2222",
                "address": "456 Test Avenue",
                "city": "Dumas",
                "state": "TX",
                "zip": "79029",
                "email": "test2@test.com",
                "phone": "8005552222",
                "forms_count": 0,
                "is_ats_test": True,
                "created_at": datetime.now(MIAMI_TZ),
                "updated_at": datetime.now(MIAMI_TZ)
            }
        ]
        
        recipient_ids = []
        recipients_map = {}
        
        for r in test_recipients:
            result = await self.db.iris_recipients.insert_one(r)
            rid = str(result.inserted_id)
            recipient_ids.append(rid)
            r["_id"] = result.inserted_id
            recipients_map[rid] = r
        
        logger.info(f"✅ Created {len(test_recipients)} ATS test recipients")
        
        # Step 2: Create 2 test 1099-NEC forms
        test_forms = [
            {
                "recipient_id": recipient_ids[0],
                "recipient_name": "John ATS Testrecipient",
                "recipient_tin_last4": "1111",
                "form_type": "1099-NEC",
                "tax_year": tax_year,
                "status": "generated",
                "amounts": {
                    "box1_nonemployee_compensation": 5000.00,
                    "box4_federal_tax_withheld": 0.00,
                },
                "total_amount": 5000.00,
                "direct_sales_indicator": False,
                "payer_info": {
                    "name": TRANSMITTER_INFO["legal_name"],
                    "ein": TRANSMITTER_INFO["ein_display"],
                    "address": TRANSMITTER_INFO["address"],
                    "city": TRANSMITTER_INFO["city"],
                    "state": TRANSMITTER_INFO["state"],
                    "zip": TRANSMITTER_INFO["zip"],
                    "phone": TRANSMITTER_INFO["phone"]
                },
                "is_ats_test": True,
                "created_at": datetime.now(MIAMI_TZ),
                "updated_at": datetime.now(MIAMI_TZ)
            },
            {
                "recipient_id": recipient_ids[1],
                "recipient_name": "Jane ATS Testrecipient",
                "recipient_tin_last4": "2222",
                "form_type": "1099-NEC",
                "tax_year": tax_year,
                "status": "generated",
                "amounts": {
                    "box1_nonemployee_compensation": 7500.00,
                    "box4_federal_tax_withheld": 500.00,
                },
                "total_amount": 7500.00,
                "direct_sales_indicator": False,
                "payer_info": {
                    "name": TRANSMITTER_INFO["legal_name"],
                    "ein": TRANSMITTER_INFO["ein_display"],
                    "address": TRANSMITTER_INFO["address"],
                    "city": TRANSMITTER_INFO["city"],
                    "state": TRANSMITTER_INFO["state"],
                    "zip": TRANSMITTER_INFO["zip"],
                    "phone": TRANSMITTER_INFO["phone"]
                },
                "is_ats_test": True,
                "created_at": datetime.now(MIAMI_TZ),
                "updated_at": datetime.now(MIAMI_TZ)
            }
        ]
        
        form_ids = []
        forms_for_xml = []
        for f in test_forms:
            result = await self.db.iris_1099_forms.insert_one(f)
            form_ids.append(str(result.inserted_id))
            f["_id"] = result.inserted_id
            forms_for_xml.append(f)
        
        logger.info(f"✅ Created {len(test_forms)} ATS test 1099-NEC forms")
        
        # Step 3: Generate XML
        xml_content, transmission_id = self._generate_transmission_xml(
            forms_for_xml, recipients_map, tax_year
        )
        
        logger.info(f"📄 Generated XML transmission: {transmission_id}")
        
        # Step 4: Get OAuth token and submit
        submission_record = {
            "transmission_id": transmission_id,
            "tax_year": tax_year,
            "environment": self.environment,
            "form_ids": form_ids,
            "forms_count": len(forms_for_xml),
            "total_amount": sum(f.get("total_amount", 0) for f in forms_for_xml),
            "xml_content": xml_content,
            "is_ats_test": True,
            "status": "pending",
            "submitted_at": datetime.now(MIAMI_TZ),
            "created_at": datetime.now(MIAMI_TZ)
        }
        
        try:
            access_token = await self._get_access_token()
            
            endpoint = IRIS_ENDPOINTS.get(self.environment, IRIS_ENDPOINTS["test"])
            
            headers = {
                "Content-Type": "application/xml",
                "Accept": "application/xml",
                "Authorization": f"Bearer {access_token}"
            }
            
            logger.info(f"📤 Submitting ATS test to {endpoint}...")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint, content=xml_content, headers=headers)
                
                submission_record["response_status"] = response.status_code
                submission_record["response_body"] = response.text[:5000]
                
                if response.status_code in [200, 201, 202]:
                    submission_record["status"] = "submitted"
                    # Update all forms
                    for f in forms_for_xml:
                        await self.db.iris_1099_forms.update_one(
                            {"_id": f["_id"]},
                            {"$set": {
                                "status": "submitted",
                                "submission_id": transmission_id,
                                "submitted_at": datetime.now(MIAMI_TZ)
                            }}
                        )
                    logger.info(f"✅ ATS test submitted successfully! Status: {response.status_code}")
                else:
                    submission_record["status"] = "error"
                    submission_record["error_message"] = response.text[:2000]
                    logger.error(f"❌ ATS test submission failed: {response.status_code} - {response.text[:500]}")
                    
        except Exception as e:
            submission_record["status"] = "error"
            submission_record["error_message"] = str(e)
            logger.error(f"❌ ATS test error: {e}")
        
        # Save submission record
        result = await self.db.iris_submissions.insert_one(submission_record)
        
        return {
            "submission_id": str(result.inserted_id),
            "transmission_id": transmission_id,
            "status": submission_record["status"],
            "response_status": submission_record.get("response_status"),
            "response_body": submission_record.get("response_body", "")[:2000],
            "error": submission_record.get("error_message"),
            "forms_submitted": len(forms_for_xml),
            "total_amount": submission_record["total_amount"],
            "test_recipients": [{"name": r["name"], "tin_last4": r["tin_last4"]} for r in test_recipients]
        }
    
    # ─── Dashboard Stats ───────────────────────────────────────────
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get IRIS filing dashboard statistics"""
        try:
            now = datetime.now(MIAMI_TZ)
            current_tax_year = str(now.year - 1) if now.month < 4 else str(now.year)
            
            total_recipients = await self.db.iris_recipients.count_documents({})
            total_forms = await self.db.iris_1099_forms.count_documents({})
            forms_by_status = {}
            
            for status in ["draft", "generated", "submitted", "accepted", "rejected", "corrected"]:
                count = await self.db.iris_1099_forms.count_documents({"status": status})
                forms_by_status[status] = count
            
            total_submissions = await self.db.iris_submissions.count_documents({})
            recent_submissions = await self.db.iris_submissions.find().sort("submitted_at", -1).to_list(5)
            
            # Forms by type
            forms_by_type = {}
            for form_type in ["1099-NEC", "1099-MISC", "1042-S"]:
                count = await self.db.iris_1099_forms.count_documents({"form_type": form_type})
                forms_by_type[form_type] = count
            
            # Calculate total amounts
            pipeline = [
                {"$match": {"status": {"$ne": "void"}}},
                {"$group": {
                    "_id": "$form_type",
                    "total_amount": {"$sum": "$total_amount"},
                    "count": {"$sum": 1}
                }}
            ]
            amount_by_type = {}
            async for doc in self.db.iris_1099_forms.aggregate(pipeline):
                amount_by_type[doc["_id"]] = {
                    "total": doc["total_amount"],
                    "count": doc["count"]
                }
            
            return {
                "current_tax_year": current_tax_year,
                "transmitter_info": {
                    "tcc": TRANSMITTER_INFO["tcc"],
                    "ein": TRANSMITTER_INFO["ein_display"],
                    "name": TRANSMITTER_INFO["legal_name"],
                    "environment": self.environment,
                    "api_configured": bool(self.api_client_id and self.iris_user_id)
                },
                "recipients": {
                    "total": total_recipients,
                },
                "forms": {
                    "total": total_forms,
                    "by_status": forms_by_status,
                    "by_type": forms_by_type,
                    "amounts_by_type": amount_by_type
                },
                "submissions": {
                    "total": total_submissions,
                    "recent": [{
                        "id": str(s["_id"]),
                        "transmission_id": s.get("transmission_id"),
                        "status": s.get("status"),
                        "forms_count": s.get("forms_count", 0),
                        "submitted_at": s.get("submitted_at", "").isoformat() if s.get("submitted_at") else None
                    } for s in recent_submissions]
                },
                "setup_checklist": {
                    "tcc_active": True,
                    "api_client_id": bool(self.api_client_id),
                    "a2a_consent": bool(self.iris_user_id),
                    "ats_testing": False,  # Will be updated when ATS passes
                    "production_ready": bool(self.api_client_id and self.iris_user_id and self.environment == "production")
                }
            }
        except Exception as e:
            logger.error(f"Error getting IRIS dashboard stats: {e}")
            raise
    
    # ─── Recipient CRUD ────────────────────────────────────────────
    
    async def list_recipients(self, search: str = "", page: int = 1, limit: int = 20) -> Dict:
        """List 1099 recipients with pagination"""
        query = {}
        if search:
            query = {"$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"business_name": {"$regex": search, "$options": "i"}},
                {"tin_last4": {"$regex": search}},
                {"email": {"$regex": search, "$options": "i"}}
            ]}
        
        total = await self.db.iris_recipients.count_documents(query)
        skip = (page - 1) * limit
        recipients = await self.db.iris_recipients.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
        
        return {
            "recipients": [{
                "id": str(r["_id"]),
                "name": r.get("name", ""),
                "business_name": r.get("business_name", ""),
                "tin_type": r.get("tin_type", "SSN"),  # SSN or EIN
                "tin_last4": r.get("tin_last4", "****"),
                "address": r.get("address", ""),
                "city": r.get("city", ""),
                "state": r.get("state", ""),
                "zip": r.get("zip", ""),
                "email": r.get("email", ""),
                "phone": r.get("phone", ""),
                "forms_count": r.get("forms_count", 0),
                "created_at": r.get("created_at", "").isoformat() if r.get("created_at") else None
            } for r in recipients],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    async def create_recipient(self, data: Dict) -> Dict:
        """Create a new 1099 recipient"""
        tin = data.get("tin", "")
        tin_clean = tin.replace("-", "").replace(" ", "")
        
        recipient = {
            "name": data.get("name", "").strip(),
            "business_name": data.get("business_name", "").strip(),
            "tin_type": data.get("tin_type", "SSN"),
            "tin_encrypted": tin_clean,  # In production, encrypt this
            "tin_last4": tin_clean[-4:] if len(tin_clean) >= 4 else "****",
            "address": data.get("address", "").strip(),
            "city": data.get("city", "").strip(),
            "state": data.get("state", "").strip().upper(),
            "zip": data.get("zip", "").strip(),
            "email": data.get("email", "").strip().lower(),
            "phone": data.get("phone", "").strip(),
            "forms_count": 0,
            "created_at": datetime.now(MIAMI_TZ),
            "updated_at": datetime.now(MIAMI_TZ)
        }
        
        result = await self.db.iris_recipients.insert_one(recipient)
        recipient["_id"] = result.inserted_id
        
        logger.info(f"📋 Created IRIS recipient: {recipient['name']} (***{recipient['tin_last4']})")
        return {"id": str(result.inserted_id), "message": "Recipient created successfully"}
    
    async def update_recipient(self, recipient_id: str, data: Dict) -> Dict:
        """Update a recipient"""
        update_data = {
            "updated_at": datetime.now(MIAMI_TZ)
        }
        
        for field in ["name", "business_name", "tin_type", "address", "city", "state", "zip", "email", "phone"]:
            if field in data:
                update_data[field] = data[field].strip() if isinstance(data[field], str) else data[field]
        
        if "tin" in data and data["tin"]:
            tin_clean = data["tin"].replace("-", "").replace(" ", "")
            update_data["tin_encrypted"] = tin_clean
            update_data["tin_last4"] = tin_clean[-4:] if len(tin_clean) >= 4 else "****"
        
        await self.db.iris_recipients.update_one(
            {"_id": ObjectId(recipient_id)},
            {"$set": update_data}
        )
        
        return {"message": "Recipient updated successfully"}
    
    async def delete_recipient(self, recipient_id: str) -> Dict:
        """Delete a recipient (only if no submitted forms)"""
        submitted = await self.db.iris_1099_forms.count_documents({
            "recipient_id": recipient_id,
            "status": {"$in": ["submitted", "accepted"]}
        })
        
        if submitted > 0:
            raise ValueError("Cannot delete recipient with submitted forms")
        
        await self.db.iris_recipients.delete_one({"_id": ObjectId(recipient_id)})
        await self.db.iris_1099_forms.delete_many({
            "recipient_id": recipient_id,
            "status": "draft"
        })
        
        return {"message": "Recipient deleted successfully"}
    
    # ─── 1099 Form Management ─────────────────────────────────────
    
    async def create_1099_form(self, data: Dict) -> Dict:
        """Create a 1099 form for a recipient"""
        recipient = await self.db.iris_recipients.find_one({"_id": ObjectId(data["recipient_id"])})
        if not recipient:
            raise ValueError("Recipient not found")
        
        form_type = data.get("form_type", "1099-NEC")
        tax_year = data.get("tax_year", str(datetime.now(MIAMI_TZ).year - 1))
        
        form = {
            "recipient_id": data["recipient_id"],
            "recipient_name": recipient["name"],
            "recipient_tin_last4": recipient["tin_last4"],
            "form_type": form_type,
            "tax_year": tax_year,
            "status": "draft",
            "payer_info": {
                "name": TRANSMITTER_INFO["legal_name"],
                "ein": TRANSMITTER_INFO["ein_display"],
                "address": TRANSMITTER_INFO["address"],
                "city": TRANSMITTER_INFO["city"],
                "state": TRANSMITTER_INFO["state"],
                "zip": TRANSMITTER_INFO["zip"],
                "phone": TRANSMITTER_INFO["phone"]
            },
            "created_at": datetime.now(MIAMI_TZ),
            "updated_at": datetime.now(MIAMI_TZ)
        }
        
        # Form-specific fields
        if form_type == "1099-NEC":
            form["amounts"] = {
                "box1_nonemployee_compensation": float(data.get("nonemployee_compensation", 0)),
                "box4_federal_tax_withheld": float(data.get("federal_tax_withheld", 0)),
            }
            form["total_amount"] = float(data.get("nonemployee_compensation", 0))
            form["direct_sales_indicator"] = data.get("direct_sales", False)
            
        elif form_type == "1099-MISC":
            form["amounts"] = {
                "box1_rents": float(data.get("rents", 0)),
                "box2_royalties": float(data.get("royalties", 0)),
                "box3_other_income": float(data.get("other_income", 0)),
                "box4_federal_tax_withheld": float(data.get("federal_tax_withheld", 0)),
                "box5_fishing_boat_proceeds": float(data.get("fishing_boat", 0)),
                "box6_medical_payments": float(data.get("medical_payments", 0)),
                "box7_payer_direct_sales": float(data.get("payer_direct_sales", 0)),
                "box8_substitute_payments": float(data.get("substitute_payments", 0)),
                "box10_crop_insurance": float(data.get("crop_insurance", 0)),
                "box13_golden_parachute": float(data.get("golden_parachute", 0)),
                "box14_nonqualified_deferred": float(data.get("nonqualified_deferred", 0)),
                "box15_section_409a": float(data.get("section_409a", 0)),
            }
            form["total_amount"] = sum(v for k, v in form["amounts"].items() if not k.endswith("withheld"))
        
        elif form_type == "1042-S":
            form["amounts"] = {
                "gross_income": float(data.get("gross_income", 0)),
                "tax_withheld": float(data.get("tax_withheld", 0)),
                "income_code": data.get("income_code", ""),
                "tax_rate": float(data.get("tax_rate", 0)),
                "exemption_code": data.get("exemption_code", ""),
                "country_code": data.get("country_code", ""),
            }
            form["total_amount"] = float(data.get("gross_income", 0))
        
        # State filing info
        if data.get("state_income"):
            form["state_filing"] = {
                "state": data.get("filing_state", "TX"),
                "state_id": data.get("state_payer_id", ""),
                "state_income": float(data.get("state_income", 0)),
                "state_tax_withheld": float(data.get("state_tax_withheld", 0))
            }
        
        result = await self.db.iris_1099_forms.insert_one(form)
        
        # Update recipient forms count
        await self.db.iris_recipients.update_one(
            {"_id": ObjectId(data["recipient_id"])},
            {"$inc": {"forms_count": 1}}
        )
        
        logger.info(f"📋 Created {form_type} for {recipient['name']} - ${form['total_amount']:,.2f}")
        return {"id": str(result.inserted_id), "message": f"{form_type} created successfully"}
    
    async def list_forms(self, form_type: str = "", status: str = "", tax_year: str = "",
                         page: int = 1, limit: int = 20) -> Dict:
        """List 1099 forms with filters"""
        query = {}
        if form_type:
            query["form_type"] = form_type
        if status:
            query["status"] = status
        if tax_year:
            query["tax_year"] = tax_year
        
        total = await self.db.iris_1099_forms.count_documents(query)
        skip = (page - 1) * limit
        forms = await self.db.iris_1099_forms.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return {
            "forms": [{
                "id": str(f["_id"]),
                "recipient_id": f.get("recipient_id"),
                "recipient_name": f.get("recipient_name"),
                "recipient_tin_last4": f.get("recipient_tin_last4"),
                "form_type": f.get("form_type"),
                "tax_year": f.get("tax_year"),
                "total_amount": f.get("total_amount", 0),
                "status": f.get("status"),
                "amounts": f.get("amounts", {}),
                "submission_id": f.get("submission_id"),
                "unique_record_id": f.get("unique_record_id"),
                "created_at": f.get("created_at", "").isoformat() if f.get("created_at") else None
            } for f in forms],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    async def update_form(self, form_id: str, data: Dict) -> Dict:
        """Update a draft 1099 form"""
        form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise ValueError("Form not found")
        if form["status"] not in ["draft", "rejected"]:
            raise ValueError("Can only edit draft or rejected forms")
        
        update_data = {"updated_at": datetime.now(MIAMI_TZ)}
        
        if "amounts" in data:
            update_data["amounts"] = data["amounts"]
            # Recalculate total
            total = sum(v for k, v in data["amounts"].items() 
                       if isinstance(v, (int, float)) and not k.endswith("withheld"))
            update_data["total_amount"] = total
        
        if "status" in data and data["status"] in ["draft", "generated"]:
            update_data["status"] = data["status"]
        
        await self.db.iris_1099_forms.update_one(
            {"_id": ObjectId(form_id)},
            {"$set": update_data}
        )
        
        return {"message": "Form updated successfully"}
    
    async def delete_form(self, form_id: str) -> Dict:
        """Delete a draft form"""
        form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise ValueError("Form not found")
        if form["status"] not in ["draft"]:
            raise ValueError("Can only delete draft forms")
        
        await self.db.iris_1099_forms.delete_one({"_id": ObjectId(form_id)})
        
        # Update recipient count
        if form.get("recipient_id"):
            await self.db.iris_recipients.update_one(
                {"_id": ObjectId(form["recipient_id"])},
                {"$inc": {"forms_count": -1}}
            )
        
        return {"message": "Form deleted successfully"}
    
    # ─── XML Generation ───────────────────────────────────────────
    
    def _generate_transmission_xml(self, forms: List[Dict], recipients_map: Dict, 
                                     tax_year: str, is_correction: bool = False) -> str:
        """Generate IRS IRIS A2A XML for a batch of 1099 forms"""
        
        transmission_id = str(uuid.uuid4()).replace("-", "").upper()[:20]
        
        # Root element
        root = ET.Element("IRTransmission")
        root.set("xmlns", "urn:us:gov:treasury:irs:ext:aca:air:ty" + tax_year)
        
        # Transmission Header
        header = ET.SubElement(root, "TransmissionHeader")
        ET.SubElement(header, "TransmissionUniqueId").text = transmission_id
        ET.SubElement(header, "TCC").text = TRANSMITTER_INFO["tcc"]
        ET.SubElement(header, "EIN").text = TRANSMITTER_INFO["ein"]
        ET.SubElement(header, "TransmitterNameGrp")
        name_grp = header.find("TransmitterNameGrp")
        ET.SubElement(name_grp, "BusinessNameLine1Txt").text = TRANSMITTER_INFO["legal_name"]
        ET.SubElement(header, "TransmitterForeignEntityInd").text = "false"
        ET.SubElement(header, "ContactNameGrp")
        contact = header.find("ContactNameGrp")
        ET.SubElement(contact, "PersonFirstNm").text = "Yoandy"
        ET.SubElement(contact, "PersonLastNm").text = "Ross"
        ET.SubElement(header, "ContactPhoneNum").text = TRANSMITTER_INFO["phone"]
        ET.SubElement(header, "ContactEmailAddressTxt").text = "yoandyross@gmail.com"
        ET.SubElement(header, "RequestTypeCd").text = "C" if is_correction else "A"  # A=Add, C=Correct
        ET.SubElement(header, "TotalPayeeRecordCnt").text = str(len(forms))
        ET.SubElement(header, "TotalPayerRecordCnt").text = "1"
        ET.SubElement(header, "SoftwareId").text = "ROSSTAX01"
        
        # Submission Group  
        submission = ET.SubElement(root, "IRSubmission1Grp")
        ET.SubElement(submission, "SubmissionId").text = str(uuid.uuid4()).replace("-", "").upper()[:20]
        
        # Payer Info
        payer = ET.SubElement(submission, "PayerGrp")
        ET.SubElement(payer, "PayerEIN").text = TRANSMITTER_INFO["ein"]
        payer_name = ET.SubElement(payer, "PayerNameGrp")
        ET.SubElement(payer_name, "BusinessNameLine1Txt").text = TRANSMITTER_INFO["legal_name"]
        payer_addr = ET.SubElement(payer, "PayerUSAddressGrp")
        ET.SubElement(payer_addr, "AddressLine1Txt").text = TRANSMITTER_INFO["address"]
        ET.SubElement(payer_addr, "CityNm").text = TRANSMITTER_INFO["city"]
        ET.SubElement(payer_addr, "USStateCd").text = TRANSMITTER_INFO["state"]
        ET.SubElement(payer_addr, "USZIPCd").text = TRANSMITTER_INFO["zip"]
        ET.SubElement(payer, "PhoneNum").text = TRANSMITTER_INFO["phone"]
        
        # Add each form as a payee record
        for form in forms:
            recipient = recipients_map.get(form.get("recipient_id", ""), {})
            
            if form["form_type"] == "1099-NEC":
                self._add_1099_nec_record(submission, form, recipient, is_correction)
            elif form["form_type"] == "1099-MISC":
                self._add_1099_misc_record(submission, form, recipient, is_correction)
        
        # Generate XML string
        xml_str = ET.tostring(root, encoding="unicode", xml_declaration=True)
        return xml_str, transmission_id
    
    def _add_1099_nec_record(self, parent, form: Dict, recipient: Dict, is_correction: bool):
        """Add a 1099-NEC record to XML"""
        record = ET.SubElement(parent, "Form1099NECDetail")
        
        unique_id = str(uuid.uuid4()).replace("-", "").upper()[:20]
        ET.SubElement(record, "UniqueRecordId").text = unique_id
        
        if is_correction and form.get("unique_record_id"):
            ET.SubElement(record, "OriginalUniqueRecordId").text = form["unique_record_id"]
        
        # Payee info
        payee = ET.SubElement(record, "PayeeGrp")
        ET.SubElement(payee, "TINRequestTypeCd").text = "1" if recipient.get("tin_type") == "SSN" else "2"
        ET.SubElement(payee, "PayeeTIN").text = recipient.get("tin_encrypted", "000000000")
        payee_name = ET.SubElement(payee, "PayeeNameGrp")
        if recipient.get("business_name"):
            ET.SubElement(payee_name, "BusinessNameLine1Txt").text = recipient["business_name"]
        else:
            ET.SubElement(payee_name, "PersonFirstNm").text = recipient.get("name", "").split()[0] if recipient.get("name") else ""
            ET.SubElement(payee_name, "PersonLastNm").text = " ".join(recipient.get("name", "").split()[1:]) if recipient.get("name") else ""
        
        payee_addr = ET.SubElement(payee, "PayeeUSAddressGrp")
        ET.SubElement(payee_addr, "AddressLine1Txt").text = recipient.get("address", "")
        ET.SubElement(payee_addr, "CityNm").text = recipient.get("city", "")
        ET.SubElement(payee_addr, "USStateCd").text = recipient.get("state", "")
        ET.SubElement(payee_addr, "USZIPCd").text = recipient.get("zip", "")
        
        # Amounts
        amounts = form.get("amounts", {})
        ET.SubElement(record, "NonemployeeCompensationAmt").text = f"{amounts.get('box1_nonemployee_compensation', 0):.2f}"
        
        if amounts.get("box4_federal_tax_withheld", 0) > 0:
            ET.SubElement(record, "FederalIncomeTaxWithheldAmt").text = f"{amounts.get('box4_federal_tax_withheld', 0):.2f}"
        
        if form.get("direct_sales_indicator"):
            ET.SubElement(record, "DirectSalesInd").text = "true"
        
        return unique_id
    
    def _add_1099_misc_record(self, parent, form: Dict, recipient: Dict, is_correction: bool):
        """Add a 1099-MISC record to XML"""
        record = ET.SubElement(parent, "Form1099MISCDetail")
        
        unique_id = str(uuid.uuid4()).replace("-", "").upper()[:20]
        ET.SubElement(record, "UniqueRecordId").text = unique_id
        
        if is_correction and form.get("unique_record_id"):
            ET.SubElement(record, "OriginalUniqueRecordId").text = form["unique_record_id"]
        
        # Payee info
        payee = ET.SubElement(record, "PayeeGrp")
        ET.SubElement(payee, "TINRequestTypeCd").text = "1" if recipient.get("tin_type") == "SSN" else "2"
        ET.SubElement(payee, "PayeeTIN").text = recipient.get("tin_encrypted", "000000000")
        payee_name = ET.SubElement(payee, "PayeeNameGrp")
        if recipient.get("business_name"):
            ET.SubElement(payee_name, "BusinessNameLine1Txt").text = recipient["business_name"]
        else:
            ET.SubElement(payee_name, "PersonFirstNm").text = recipient.get("name", "").split()[0] if recipient.get("name") else ""
            ET.SubElement(payee_name, "PersonLastNm").text = " ".join(recipient.get("name", "").split()[1:]) if recipient.get("name") else ""
        
        payee_addr = ET.SubElement(payee, "PayeeUSAddressGrp")
        ET.SubElement(payee_addr, "AddressLine1Txt").text = recipient.get("address", "")
        ET.SubElement(payee_addr, "CityNm").text = recipient.get("city", "")
        ET.SubElement(payee_addr, "USStateCd").text = recipient.get("state", "")
        ET.SubElement(payee_addr, "USZIPCd").text = recipient.get("zip", "")
        
        # Amounts
        amounts = form.get("amounts", {})
        amount_fields = {
            "box1_rents": "RentsAmt",
            "box2_royalties": "RoyaltiesAmt",
            "box3_other_income": "OtherIncomeAmt",
            "box4_federal_tax_withheld": "FederalIncomeTaxWithheldAmt",
            "box6_medical_payments": "MedicalAndHealthCarePaymentsAmt",
            "box10_crop_insurance": "CropInsuranceProceedsAmt",
            "box13_golden_parachute": "ExcessGoldenParachutePaymentsAmt",
            "box14_nonqualified_deferred": "Section409ADeferralAmt",
        }
        
        for key, xml_tag in amount_fields.items():
            val = amounts.get(key, 0)
            if val > 0:
                ET.SubElement(record, xml_tag).text = f"{val:.2f}"
        
        return unique_id
    
    # ─── Submission ────────────────────────────────────────────────
    
    async def submit_forms(self, form_ids: List[str], tax_year: str = "") -> Dict:
        """Submit forms to IRS IRIS via A2A API"""
        
        if not self.api_client_id:
            raise ValueError("IRS IRIS API Client ID not configured. Please set IRS_IRIS_API_CLIENT_ID in environment.")
        
        # Get all forms
        forms = []
        for fid in form_ids:
            form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(fid)})
            if form:
                if form["status"] not in ["draft", "generated", "rejected"]:
                    raise ValueError(f"Form {fid} is already {form['status']}")
                forms.append(form)
        
        if not forms:
            raise ValueError("No valid forms to submit")
        
        if not tax_year:
            tax_year = forms[0].get("tax_year", str(datetime.now(MIAMI_TZ).year - 1))
        
        # Get all recipients
        recipient_ids = list(set(f.get("recipient_id", "") for f in forms))
        recipients_map = {}
        for rid in recipient_ids:
            if rid:
                r = await self.db.iris_recipients.find_one({"_id": ObjectId(rid)})
                if r:
                    recipients_map[rid] = r
        
        # Generate XML
        xml_content, transmission_id = self._generate_transmission_xml(forms, recipients_map, tax_year)
        
        # Determine endpoint
        endpoint = IRIS_ENDPOINTS.get(self.environment, IRIS_ENDPOINTS["test"])
        
        # Submit to IRS
        submission_record = {
            "transmission_id": transmission_id,
            "tax_year": tax_year,
            "environment": self.environment,
            "form_ids": [str(f["_id"]) for f in forms],
            "forms_count": len(forms),
            "total_amount": sum(f.get("total_amount", 0) for f in forms),
            "xml_content": xml_content,
            "status": "pending",
            "submitted_at": datetime.now(MIAMI_TZ),
            "created_at": datetime.now(MIAMI_TZ)
        }
        
        try:
            access_token = await self._get_access_token()
            
            headers = {
                "Content-Type": "application/xml",
                "Accept": "application/xml",
                "Authorization": f"Bearer {access_token}"
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint, content=xml_content, headers=headers)
                
                submission_record["response_status"] = response.status_code
                submission_record["response_body"] = response.text[:5000]
                
                if response.status_code in [200, 201, 202]:
                    submission_record["status"] = "submitted"
                    # Update all forms
                    for form in forms:
                        await self.db.iris_1099_forms.update_one(
                            {"_id": form["_id"]},
                            {"$set": {
                                "status": "submitted",
                                "submission_id": transmission_id,
                                "submitted_at": datetime.now(MIAMI_TZ)
                            }}
                        )
                else:
                    submission_record["status"] = "error"
                    submission_record["error_message"] = response.text[:2000]
                    logger.error(f"IRIS submission failed: {response.status_code} - {response.text[:500]}")
                    
        except Exception as e:
            submission_record["status"] = "error"
            submission_record["error_message"] = str(e)
            logger.error(f"IRIS submission error: {e}")
        
        # Save submission record
        result = await self.db.iris_submissions.insert_one(submission_record)
        
        return {
            "submission_id": str(result.inserted_id),
            "transmission_id": transmission_id,
            "status": submission_record["status"],
            "forms_submitted": len(forms),
            "total_amount": submission_record["total_amount"],
            "error": submission_record.get("error_message")
        }
    
    async def get_submission_detail(self, submission_id: str) -> Dict:
        """Get detailed submission info"""
        submission = await self.db.iris_submissions.find_one({"_id": ObjectId(submission_id)})
        if not submission:
            raise ValueError("Submission not found")
        
        return {
            "id": str(submission["_id"]),
            "transmission_id": submission.get("transmission_id"),
            "tax_year": submission.get("tax_year"),
            "environment": submission.get("environment"),
            "status": submission.get("status"),
            "forms_count": submission.get("forms_count", 0),
            "total_amount": submission.get("total_amount", 0),
            "form_ids": submission.get("form_ids", []),
            "response_status": submission.get("response_status"),
            "error_message": submission.get("error_message"),
            "submitted_at": submission.get("submitted_at", "").isoformat() if submission.get("submitted_at") else None,
            "created_at": submission.get("created_at", "").isoformat() if submission.get("created_at") else None
        }
    
    # ─── Configuration ─────────────────────────────────────────────
    
    async def update_configuration(self, data: Dict) -> Dict:
        """Update IRIS API configuration"""
        updates = {}
        
        if "api_client_id" in data:
            self.api_client_id = data["api_client_id"]
            updates["IRS_IRIS_API_CLIENT_ID"] = data["api_client_id"]
        
        if "iris_user_id" in data:
            self.iris_user_id = data["iris_user_id"]
            updates["IRS_IRIS_USER_ID"] = data["iris_user_id"]
        
        if "environment" in data and data["environment"] in ["test", "production"]:
            self.environment = data["environment"]
            updates["IRS_IRIS_ENVIRONMENT"] = data["environment"]
        
        # Save to database config
        if updates:
            await self.db.system_config.update_one(
                {"type": "iris_config"},
                {"$set": {**updates, "updated_at": datetime.now(MIAMI_TZ)}},
                upsert=True
            )
        
        logger.info(f"📋 IRIS configuration updated: {list(updates.keys())}")
        return {"message": "Configuration updated", "updated_fields": list(updates.keys())}
    
    async def load_configuration(self):
        """Load IRIS configuration from database"""
        config = await self.db.system_config.find_one({"type": "iris_config"})
        if config:
            if config.get("IRS_IRIS_API_CLIENT_ID"):
                self.api_client_id = config["IRS_IRIS_API_CLIENT_ID"]
            if config.get("IRS_IRIS_USER_ID"):
                self.iris_user_id = config["IRS_IRIS_USER_ID"]
            if config.get("IRS_IRIS_ENVIRONMENT"):
                self.environment = config["IRS_IRIS_ENVIRONMENT"]
            logger.info(f"📋 IRIS config loaded from DB (env: {self.environment})")


    # ─── Feature 1: CSV/Excel Bulk Upload ─────────────────────────
    
    async def bulk_import_recipients(self, file_content: bytes, filename: str) -> Dict:
        """
        Import recipients from CSV or Excel file.
        Expected columns: name, business_name, tin_type, tin, address, city, state, zip, email, phone,
                          form_type, amount, federal_tax_withheld, tax_year
        """
        import pandas as pd
        import io
        
        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_content))
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(file_content))
            else:
                raise ValueError("Unsupported file format. Use CSV or XLSX.")
            
            # Normalize column names
            df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
            
            required_cols = ['name', 'tin', 'address', 'city', 'state', 'zip']
            missing = [c for c in required_cols if c not in df.columns]
            if missing:
                raise ValueError(f"Missing required columns: {', '.join(missing)}")
            
            results = {"imported": 0, "forms_created": 0, "errors": [], "recipients": []}
            
            for idx, row in df.iterrows():
                try:
                    tin = str(row.get('tin', '')).replace('-', '').replace(' ', '').strip()
                    if len(tin) < 9:
                        results["errors"].append(f"Row {idx+2}: Invalid TIN length")
                        continue
                    
                    name = str(row.get('name', '')).strip()
                    if not name:
                        results["errors"].append(f"Row {idx+2}: Name is required")
                        continue
                    
                    # Check if recipient already exists
                    existing = await self.db.iris_recipients.find_one({
                        "tin_last4": tin[-4:],
                        "name": {"$regex": f"^{name}$", "$options": "i"}
                    })
                    
                    if existing:
                        recipient_id = str(existing["_id"])
                    else:
                        recipient = {
                            "name": name,
                            "business_name": str(row.get('business_name', '')).strip(),
                            "tin_type": str(row.get('tin_type', 'SSN')).upper().strip(),
                            "tin_encrypted": tin,
                            "tin_last4": tin[-4:],
                            "address": str(row.get('address', '')).strip(),
                            "city": str(row.get('city', '')).strip(),
                            "state": str(row.get('state', '')).strip().upper(),
                            "zip": str(row.get('zip', '')).strip(),
                            "email": str(row.get('email', '')).strip().lower() if pd.notna(row.get('email')) else '',
                            "phone": str(row.get('phone', '')).strip() if pd.notna(row.get('phone')) else '',
                            "forms_count": 0,
                            "created_at": datetime.now(MIAMI_TZ),
                            "updated_at": datetime.now(MIAMI_TZ)
                        }
                        r = await self.db.iris_recipients.insert_one(recipient)
                        recipient_id = str(r.inserted_id)
                        results["imported"] += 1
                    
                    results["recipients"].append({"id": recipient_id, "name": name, "tin_last4": tin[-4:]})
                    
                    # If amount column exists, auto-create 1099 form
                    amount = row.get('amount') or row.get('nonemployee_compensation') or row.get('compensation')
                    if pd.notna(amount) and float(amount) > 0:
                        form_type = str(row.get('form_type', '1099-NEC')).strip()
                        tax_year = str(row.get('tax_year', str(datetime.now(MIAMI_TZ).year - 1))).strip()
                        
                        form_data = {
                            "recipient_id": recipient_id,
                            "form_type": form_type,
                            "tax_year": tax_year,
                            "nonemployee_compensation": float(amount),
                            "federal_tax_withheld": float(row.get('federal_tax_withheld', 0)) if pd.notna(row.get('federal_tax_withheld')) else 0,
                        }
                        await self.create_1099_form(form_data)
                        results["forms_created"] += 1
                        
                except Exception as e:
                    results["errors"].append(f"Row {idx+2}: {str(e)}")
            
            logger.info(f"📋 Bulk import: {results['imported']} recipients, {results['forms_created']} forms")
            return results
            
        except Exception as e:
            logger.error(f"Bulk import error: {e}")
            raise
    
    # ─── Feature 2: PDF Copy B Generation ─────────────────────────
    
    async def generate_copy_b_pdf(self, form_id: str) -> bytes:
        """Generate IRS Copy B PDF (recipient copy) for a 1099 form"""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
        import io
        
        form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise ValueError("Form not found")
        
        recipient = await self.db.iris_recipients.find_one({"_id": ObjectId(form["recipient_id"])})
        if not recipient:
            raise ValueError("Recipient not found")
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        form_type = form.get("form_type", "1099-NEC")
        tax_year = form.get("tax_year", "2025")
        amounts = form.get("amounts", {})
        
        # ─── Header ───
        c.setFont("Helvetica-Bold", 16)
        c.drawString(1*inch, height - 1*inch, f"Form {form_type}")
        c.setFont("Helvetica", 10)
        c.drawString(1*inch, height - 1.3*inch, f"Tax Year {tax_year} — Copy B (For Recipient)")
        
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.red)
        c.drawString(1*inch, height - 1.6*inch, "THIS IS IMPORTANT TAX INFORMATION AND IS BEING FURNISHED TO THE IRS.")
        c.setFillColor(colors.black)
        
        # ─── Payer Information ───
        y = height - 2.2*inch
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*inch, y, "PAYER'S Information:")
        c.setFont("Helvetica", 9)
        y -= 15
        c.drawString(1*inch, y, TRANSMITTER_INFO["legal_name"])
        y -= 12
        c.drawString(1*inch, y, TRANSMITTER_INFO["address"])
        y -= 12
        c.drawString(1*inch, y, f"{TRANSMITTER_INFO['city']}, {TRANSMITTER_INFO['state']} {TRANSMITTER_INFO['zip']}")
        y -= 12
        c.drawString(1*inch, y, f"Phone: {TRANSMITTER_INFO['phone'][:3]}-{TRANSMITTER_INFO['phone'][3:6]}-{TRANSMITTER_INFO['phone'][6:]}")
        y -= 12
        c.drawString(1*inch, y, f"EIN: {TRANSMITTER_INFO['ein_display']}")
        
        # ─── Recipient Information ───
        y -= 30
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*inch, y, "RECIPIENT'S Information:")
        c.setFont("Helvetica", 9)
        y -= 15
        c.drawString(1*inch, y, recipient.get("name", ""))
        if recipient.get("business_name"):
            y -= 12
            c.drawString(1*inch, y, recipient["business_name"])
        y -= 12
        c.drawString(1*inch, y, recipient.get("address", ""))
        y -= 12
        c.drawString(1*inch, y, f"{recipient.get('city', '')}, {recipient.get('state', '')} {recipient.get('zip', '')}")
        y -= 12
        c.drawString(1*inch, y, f"TIN: ***-**-{recipient.get('tin_last4', '****')}")
        
        # ─── Amounts Box ───
        y -= 40
        c.setStrokeColor(colors.black)
        c.setLineWidth(1)
        
        if form_type == "1099-NEC":
            # Box 1
            box_y = y
            c.rect(1*inch, box_y - 50, 3*inch, 50)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(1.1*inch, box_y - 12, "1  Nonemployee compensation")
            c.setFont("Helvetica", 14)
            amt = amounts.get("box1_nonemployee_compensation", 0)
            c.drawString(1.1*inch, box_y - 38, f"$ {amt:,.2f}")
            
            # Box 4
            c.rect(4.2*inch, box_y - 50, 3*inch, 50)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(4.3*inch, box_y - 12, "4  Federal income tax withheld")
            c.setFont("Helvetica", 14)
            withheld = amounts.get("box4_federal_tax_withheld", 0)
            c.drawString(4.3*inch, box_y - 38, f"$ {withheld:,.2f}")
            
        elif form_type == "1099-MISC":
            box_y = y
            misc_boxes = [
                ("1", "Rents", "box1_rents"),
                ("2", "Royalties", "box2_royalties"),
                ("3", "Other income", "box3_other_income"),
                ("4", "Federal tax withheld", "box4_federal_tax_withheld"),
                ("6", "Medical payments", "box6_medical_payments"),
                ("10", "Crop insurance", "box10_crop_insurance"),
            ]
            
            col = 0
            for box_num, label, key in misc_boxes:
                x_pos = 1*inch + (col % 2) * 3.2*inch
                y_pos = box_y - (col // 2) * 55
                c.rect(x_pos, y_pos - 50, 3*inch, 50)
                c.setFont("Helvetica-Bold", 8)
                c.drawString(x_pos + 5, y_pos - 12, f"{box_num}  {label}")
                c.setFont("Helvetica", 12)
                val = amounts.get(key, 0)
                if val > 0:
                    c.drawString(x_pos + 5, y_pos - 35, f"$ {val:,.2f}")
                col += 1
        
        # ─── Footer ───
        c.setFont("Helvetica", 7)
        c.drawString(1*inch, 1.5*inch, f"Form {form_type} (Rev. 01-{tax_year})  —  Department of the Treasury - Internal Revenue Service")
        c.drawString(1*inch, 1.3*inch, "This is Copy B and is being furnished to you by the payer. Attach this copy to your federal tax return if required.")
        c.drawString(1*inch, 1.1*inch, f"Generated by Ross Tax Preparation LLC — {datetime.now(MIAMI_TZ).strftime('%m/%d/%Y %I:%M %p ET')}")
        
        c.showPage()
        c.save()
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        logger.info(f"📄 Generated Copy B PDF for {form_type} - {recipient.get('name')} ({len(pdf_bytes)} bytes)")
        return pdf_bytes
    
    # ─── Feature 3: Email Copy B to Recipients ────────────────────
    
    async def email_copy_b(self, form_id: str) -> Dict:
        """Email Copy B PDF to the recipient"""
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
        import base64
        
        form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise ValueError("Form not found")
        
        recipient = await self.db.iris_recipients.find_one({"_id": ObjectId(form["recipient_id"])})
        if not recipient:
            raise ValueError("Recipient not found")
        
        email = recipient.get("email", "")
        if not email:
            raise ValueError(f"Recipient {recipient.get('name')} has no email address")
        
        # Generate PDF
        pdf_bytes = await self.generate_copy_b_pdf(form_id)
        
        form_type = form.get("form_type", "1099-NEC")
        tax_year = form.get("tax_year", "2025")
        recipient_name = recipient.get("name", "Recipient")
        
        # Build email
        sendgrid_key = os.getenv("SENDGRID_API_KEY", "")
        if not sendgrid_key:
            raise ValueError("SendGrid API key not configured")
        
        message = Mail(
            from_email=("tax@rosstaxpreparation.com", "Ross Tax Preparation"),
            to_emails=email,
            subject=f"Your {form_type} Tax Form for Tax Year {tax_year}",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a365d;">Your {form_type} Tax Form</h2>
                <p>Dear {recipient_name},</p>
                <p>Please find attached your <strong>{form_type}</strong> form for Tax Year <strong>{tax_year}</strong> 
                from <strong>Ross Tax Preparation LLC</strong>.</p>
                <p>This is <strong>Copy B</strong> — please keep this for your records and attach it to your 
                federal tax return if required.</p>
                <hr style="border: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #718096;">
                    This is an automatically generated email from Ross Tax Preparation LLC.<br>
                    305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018<br>
                    EIN: 33-1240497
                </p>
            </div>
            """
        )
        
        # Attach PDF
        encoded_pdf = base64.b64encode(pdf_bytes).decode()
        attachment = Attachment(
            FileContent(encoded_pdf),
            FileName(f"{form_type}_{tax_year}_{recipient_name.replace(' ', '_')}.pdf"),
            FileType("application/pdf"),
            Disposition("attachment")
        )
        message.attachment = attachment
        
        try:
            sg = SendGridAPIClient(sendgrid_key)
            response = sg.send(message)
            
            # Update form record
            await self.db.iris_1099_forms.update_one(
                {"_id": ObjectId(form_id)},
                {"$set": {
                    "copy_b_emailed": True,
                    "copy_b_emailed_at": datetime.now(MIAMI_TZ),
                    "copy_b_email_to": email
                }}
            )
            
            logger.info(f"📧 Copy B emailed to {email} for {form_type} - {recipient_name}")
            return {
                "message": f"Copy B emailed to {email}",
                "status_code": response.status_code,
                "recipient": recipient_name,
                "form_type": form_type
            }
        except Exception as e:
            logger.error(f"Email error: {e}")
            raise ValueError(f"Failed to send email: {str(e)}")
    
    async def bulk_email_copy_b(self, form_ids: List[str]) -> Dict:
        """Send Copy B emails for multiple forms"""
        results = {"sent": 0, "failed": 0, "errors": []}
        
        for fid in form_ids:
            try:
                await self.email_copy_b(fid)
                results["sent"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"form_id": fid, "error": str(e)})
        
        return results
    
    # ─── Feature 4: TIN Matching (SOR API) ────────────────────────
    
    async def validate_tin(self, tin: str, name: str, tin_type: str = "SSN") -> Dict:
        """
        Validate a TIN against IRS records using TIN Matching.
        Returns whether the TIN/Name combination is valid.
        """
        try:
            access_token = await self._get_access_token()
            
            tin_clean = tin.replace("-", "").replace(" ", "")
            
            # TIN Matching endpoint
            tin_match_url = "https://api.www4.irs.gov/tinm/v2/tin-matching"
            if self.environment == "test":
                tin_match_url = "https://api.alt.www4.irs.gov/tinm/v2/tin-matching"
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            payload = {
                "tinType": "1" if tin_type.upper() == "SSN" else "2",
                "tin": tin_clean,
                "nameControl": name[:4].upper()  # First 4 chars of last name
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(tin_match_url, json=payload, headers=headers)
                
                result = {
                    "tin_last4": tin_clean[-4:],
                    "name": name,
                    "status_code": response.status_code,
                    "valid": False,
                    "response": {}
                }
                
                if response.status_code == 200:
                    data = response.json()
                    result["response"] = data
                    # IRS returns code 0 for match, 1+ for various mismatches
                    result["valid"] = data.get("responseCode") == "0"
                    result["response_code"] = data.get("responseCode")
                    result["response_desc"] = data.get("responseDescription", "")
                else:
                    result["error"] = response.text[:500]
                
                logger.info(f"🔍 TIN validation for ***{tin_clean[-4:]}: {'✅ Valid' if result['valid'] else '❌ Invalid'}")
                return result
                
        except Exception as e:
            logger.error(f"TIN validation error: {e}")
            return {
                "tin_last4": tin[-4:] if len(tin) >= 4 else "****",
                "name": name,
                "valid": False,
                "error": str(e)
            }
    
    async def bulk_validate_tins(self, recipient_ids: List[str] = None) -> Dict:
        """Validate TINs for multiple recipients"""
        query = {}
        if recipient_ids:
            query = {"_id": {"$in": [ObjectId(rid) for rid in recipient_ids]}}
        
        recipients = await self.db.iris_recipients.find(query).to_list(100)
        
        results = {"validated": 0, "valid": 0, "invalid": 0, "errors": 0, "details": []}
        
        for r in recipients:
            try:
                tin = r.get("tin_encrypted", "")
                name = r.get("name", "")
                tin_type = r.get("tin_type", "SSN")
                
                validation = await self.validate_tin(tin, name, tin_type)
                
                # Update recipient record
                await self.db.iris_recipients.update_one(
                    {"_id": r["_id"]},
                    {"$set": {
                        "tin_validated": validation.get("valid", False),
                        "tin_validated_at": datetime.now(MIAMI_TZ),
                        "tin_validation_code": validation.get("response_code", "")
                    }}
                )
                
                results["validated"] += 1
                if validation.get("valid"):
                    results["valid"] += 1
                else:
                    results["invalid"] += 1
                
                results["details"].append({
                    "recipient_id": str(r["_id"]),
                    "name": name,
                    "tin_last4": r.get("tin_last4", "****"),
                    "valid": validation.get("valid", False),
                    "code": validation.get("response_code", ""),
                    "description": validation.get("response_desc", "")
                })
                
            except Exception as e:
                results["errors"] += 1
                results["details"].append({
                    "recipient_id": str(r["_id"]),
                    "name": r.get("name", ""),
                    "error": str(e)
                })
        
        return results
    
    # ─── Feature 5: Corrections Submission ────────────────────────
    
    async def submit_correction(self, form_id: str, corrected_amounts: Dict) -> Dict:
        """Submit a correction for a previously accepted form"""
        form = await self.db.iris_1099_forms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise ValueError("Form not found")
        
        if form.get("status") not in ["accepted", "submitted"]:
            raise ValueError("Can only correct accepted or submitted forms")
        
        original_unique_id = form.get("unique_record_id")
        if not original_unique_id:
            raise ValueError("Original form has no unique record ID — cannot submit correction")
        
        # Create corrected form
        corrected_form = {
            "recipient_id": form["recipient_id"],
            "recipient_name": form.get("recipient_name"),
            "recipient_tin_last4": form.get("recipient_tin_last4"),
            "form_type": form["form_type"],
            "tax_year": form["tax_year"],
            "status": "draft",
            "is_correction": True,
            "original_form_id": str(form["_id"]),
            "original_unique_record_id": original_unique_id,
            "payer_info": form.get("payer_info"),
            "amounts": corrected_amounts,
            "total_amount": sum(v for k, v in corrected_amounts.items() 
                              if isinstance(v, (int, float)) and not k.endswith("withheld")),
            "created_at": datetime.now(MIAMI_TZ),
            "updated_at": datetime.now(MIAMI_TZ)
        }
        
        result = await self.db.iris_1099_forms.insert_one(corrected_form)
        
        # Mark original as corrected
        await self.db.iris_1099_forms.update_one(
            {"_id": form["_id"]},
            {"$set": {"status": "corrected", "correction_id": str(result.inserted_id)}}
        )
        
        logger.info(f"✏️ Correction created for {form['form_type']} - {form.get('recipient_name')}")
        return {
            "correction_id": str(result.inserted_id),
            "original_form_id": form_id,
            "message": "Correction form created. Submit when ready."
        }
    
    # ─── Feature 6: Deadline Reminders ────────────────────────────
    
    async def check_deadlines(self) -> Dict:
        """Check upcoming 1099 filing deadlines and return alerts"""
        now = datetime.now(MIAMI_TZ)
        current_year = now.year
        
        deadlines = {
            "1099-NEC": {
                "form_type": "1099-NEC",
                "deadline": datetime(current_year, 1, 31, 23, 59, 59, tzinfo=MIAMI_TZ),
                "description": "1099-NEC filing deadline (to IRS and recipients)",
                "penalty": "$60/form if filed within 30 days, $120/form if by Aug 1, $310/form after Aug 1"
            },
            "1099-MISC": {
                "form_type": "1099-MISC", 
                "deadline": datetime(current_year, 3, 31, 23, 59, 59, tzinfo=MIAMI_TZ),
                "description": "1099-MISC electronic filing deadline to IRS",
                "recipient_deadline": datetime(current_year, 1, 31, 23, 59, 59, tzinfo=MIAMI_TZ),
                "penalty": "$60-$310/form depending on delay"
            },
            "1042-S": {
                "form_type": "1042-S",
                "deadline": datetime(current_year, 3, 15, 23, 59, 59, tzinfo=MIAMI_TZ),
                "description": "1042-S filing deadline",
                "penalty": "Varies"
            }
        }
        
        alerts = []
        
        for form_type, info in deadlines.items():
            deadline = info["deadline"]
            days_until = (deadline - now).days
            
            # Count unfiled forms
            draft_count = await self.db.iris_1099_forms.count_documents({
                "form_type": form_type,
                "tax_year": str(current_year - 1),
                "status": {"$in": ["draft", "generated"]}
            })
            
            submitted_count = await self.db.iris_1099_forms.count_documents({
                "form_type": form_type,
                "tax_year": str(current_year - 1),
                "status": {"$in": ["submitted", "accepted"]}
            })
            
            alert = {
                "form_type": form_type,
                "deadline": deadline.isoformat(),
                "days_until_deadline": days_until,
                "description": info["description"],
                "penalty_info": info["penalty"],
                "draft_forms": draft_count,
                "submitted_forms": submitted_count,
                "status": "overdue" if days_until < 0 else "urgent" if days_until <= 14 else "upcoming" if days_until <= 30 else "ok"
            }
            
            if draft_count > 0 and days_until <= 30:
                alert["action_required"] = f"⚠️ {draft_count} {form_type} forms still in draft! Deadline in {days_until} days."
            
            alerts.append(alert)
        
        # Check for forms without Copy B sent to recipients  
        unsent_copyb = await self.db.iris_1099_forms.count_documents({
            "tax_year": str(current_year - 1),
            "status": {"$in": ["submitted", "accepted"]},
            "copy_b_emailed": {"$ne": True}
        })
        
        if unsent_copyb > 0:
            alerts.append({
                "form_type": "ALL",
                "description": f"📧 {unsent_copyb} forms have not had Copy B emailed to recipients",
                "status": "action_needed",
                "action_required": "Send Copy B to recipients before Jan 31"
            })
        
        return {
            "current_date": now.isoformat(),
            "tax_year": str(current_year - 1),
            "alerts": alerts
        }
    
    # ─── Feature 7: Enhanced Dashboard ────────────────────────────
    
    async def get_filing_summary(self, tax_year: str = "") -> Dict:
        """Get comprehensive filing summary for a tax year"""
        if not tax_year:
            now = datetime.now(MIAMI_TZ)
            tax_year = str(now.year - 1) if now.month < 4 else str(now.year)
        
        # Forms summary by type and status
        pipeline = [
            {"$match": {"tax_year": tax_year}},
            {"$group": {
                "_id": {"form_type": "$form_type", "status": "$status"},
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$total_amount"}
            }}
        ]
        
        summary_by_type = {}
        async for doc in self.db.iris_1099_forms.aggregate(pipeline):
            ft = doc["_id"]["form_type"]
            status = doc["_id"]["status"]
            if ft not in summary_by_type:
                summary_by_type[ft] = {"statuses": {}, "total_forms": 0, "total_amount": 0}
            summary_by_type[ft]["statuses"][status] = {
                "count": doc["count"],
                "amount": doc["total_amount"]
            }
            summary_by_type[ft]["total_forms"] += doc["count"]
            summary_by_type[ft]["total_amount"] += doc["total_amount"]
        
        # Copy B email status
        total_forms = await self.db.iris_1099_forms.count_documents({"tax_year": tax_year})
        emailed = await self.db.iris_1099_forms.count_documents({
            "tax_year": tax_year, "copy_b_emailed": True
        })
        
        # TIN validation status  
        total_recipients = await self.db.iris_recipients.count_documents({})
        validated_tins = await self.db.iris_recipients.count_documents({"tin_validated": True})
        
        # Submission history
        submissions = await self.db.iris_submissions.find(
            {"tax_year": tax_year}
        ).sort("submitted_at", -1).to_list(10)
        
        return {
            "tax_year": tax_year,
            "forms_by_type": summary_by_type,
            "total_forms": total_forms,
            "copy_b_status": {
                "total": total_forms,
                "emailed": emailed,
                "pending": total_forms - emailed
            },
            "tin_validation": {
                "total_recipients": total_recipients,
                "validated": validated_tins,
                "pending": total_recipients - validated_tins
            },
            "recent_submissions": [{
                "id": str(s["_id"]),
                "transmission_id": s.get("transmission_id"),
                "status": s.get("status"),
                "forms_count": s.get("forms_count", 0),
                "submitted_at": s.get("submitted_at", "").isoformat() if s.get("submitted_at") else None
            } for s in submissions]
        }
