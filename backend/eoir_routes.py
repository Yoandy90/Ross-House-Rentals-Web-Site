"""
EOIR Case Lookup API - Uses 2Captcha to solve hCaptcha and query EOIR ACIS
"""
import os
import httpx
import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

eoir_router = APIRouter()
_db = None

EOIR_API_URL = "https://eoir-ws.eoir.justice.gov/api/Case/GetCaseInfo"
HCAPTCHA_SITEKEY = "5e28069e-3532-4d77-a479-a3939690e810"
EOIR_PAGE_URL = "https://acis.eoir.justice.gov/en/"
TWO_CAPTCHA_KEY = os.getenv("TWO_CAPTCHA_KEY", "ee2a9419e53dc35a3b24ffd9d6877fe6")


def init_eoir_router(db):
    global _db
    _db = db


class EoirLookupRequest(BaseModel):
    alienNumber: str
    nationality: str


class EoirLookupResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    checkedAt: str


async def solve_hcaptcha_2captcha() -> str:
    """Solve EOIR's hCaptcha using 2Captcha API (async)"""
    logger.info("🔐 Solving hCaptcha via 2Captcha...")
    
    # Step 1: Submit captcha task
    async with httpx.AsyncClient(timeout=30) as client:
        submit_resp = await client.post("https://2captcha.com/in.php", params={
            "key": TWO_CAPTCHA_KEY,
            "method": "hcaptcha",
            "sitekey": HCAPTCHA_SITEKEY,
            "pageurl": EOIR_PAGE_URL,
            "json": 1,
        })
        submit_data = submit_resp.json()
        
        if submit_data.get("status") != 1:
            raise Exception(f"2Captcha submit failed: {submit_data.get('request', 'unknown error')}")
        
        task_id = submit_data["request"]
        logger.info(f"🔐 2Captcha task submitted: {task_id}")
    
    # Step 2: Poll for result (max 120 seconds)
    for attempt in range(40):  # 40 * 3s = 120s max
        await asyncio.sleep(3)
        async with httpx.AsyncClient(timeout=15) as client:
            result_resp = await client.get("https://2captcha.com/res.php", params={
                "key": TWO_CAPTCHA_KEY,
                "action": "get",
                "id": task_id,
                "json": 1,
            })
            result_data = result_resp.json()
            
            if result_data.get("status") == 1:
                token = result_data["request"]
                logger.info(f"✅ hCaptcha solved! Token length: {len(token)}")
                return token
            elif result_data.get("request") == "CAPCHA_NOT_READY":
                continue
            else:
                raise Exception(f"2Captcha error: {result_data.get('request', 'unknown')}")
    
    raise Exception("2Captcha timeout - captcha not solved within 120 seconds")


async def query_eoir_api(alien_number: str, nationality: str, captcha_token: str) -> dict:
    """Call EOIR API with solved captcha token"""
    clean_num = ''.join(c for c in alien_number if c.isdigit()).zfill(9)
    
    url = f"{EOIR_API_URL}?alienNumber={clean_num}&languageCode=ES&natCode={nationality}"
    
    headers = {
        "Captcha-Token": captcha_token,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    }
    
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        logger.info(f"EOIR API response status: {response.status_code}")
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            # Try again with different headers
            headers2 = {
                "Captcha-Token": captcha_token,
                "Accept": "application/json, text/plain, */*",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Origin": "https://acis.eoir.justice.gov",
                "Referer": "https://acis.eoir.justice.gov/",
            }
            response2 = await client.get(url, headers=headers2)
            if response2.status_code == 200:
                return response2.json()
            raise Exception(f"Captcha token rechazado por EOIR (status: {response2.status_code})")
        else:
            raise Exception(f"EOIR API error: {response.status_code}")


@eoir_router.post("/eoir/lookup")
async def eoir_case_lookup(req: EoirLookupRequest):
    """
    Look up an EOIR immigration case.
    Uses 2Captcha to solve hCaptcha, then queries EOIR API directly.
    """
    checked_at = datetime.utcnow().isoformat()
    clean_num = ''.join(c for c in req.alienNumber if c.isdigit()).zfill(9)
    
    try:
        # Check cache first (avoid unnecessary captcha solves)
        if _db is not None:
            cached = await _db.eoir_cache.find_one({
                "alienNumber": clean_num,
                "nationality": req.nationality,
                "cachedAt": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)}
            })
            if cached and cached.get("data"):
                logger.info(f"📋 Using cached EOIR data for A{clean_num}")
                return EoirLookupResponse(
                    success=True,
                    data=cached["data"],
                    checkedAt=cached.get("cachedAt", checked_at) if isinstance(cached.get("cachedAt"), str) else checked_at,
                )
        
        # Step 1: Solve hCaptcha
        captcha_token = await solve_hcaptcha_2captcha()
        
        # Step 2: Query EOIR API
        data = await query_eoir_api(clean_num, req.nationality, captcha_token)
        
        # Step 3: Cache the result
        if _db is not None and data:
            await _db.eoir_cache.update_one(
                {"alienNumber": clean_num, "nationality": req.nationality},
                {"$set": {
                    "data": data,
                    "cachedAt": datetime.utcnow(),
                }},
                upsert=True,
            )
        
        if data and data.get("Data", {}).get("ValidAlienNumber"):
            return EoirLookupResponse(
                success=True,
                data=data,
                checkedAt=checked_at,
            )
        else:
            return EoirLookupResponse(
                success=False,
                error="No se encontró información para este número A. Verifica el número y la nacionalidad.",
                checkedAt=checked_at,
            )
    
    except Exception as e:
        logger.error(f"❌ EOIR lookup failed for A{clean_num}: {str(e)}")
        return EoirLookupResponse(
            success=False,
            error=str(e),
            checkedAt=checked_at,
        )
