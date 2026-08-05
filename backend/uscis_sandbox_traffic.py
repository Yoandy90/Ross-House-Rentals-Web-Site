"""
USCIS Sandbox Traffic Generator
================================
Generates consecutive calendar days of API traffic to the USCIS
Case Status API sandbox to meet production access requirements.

IMPORTANT: Uses OFFICIAL staging receipt numbers from:
https://developer.uscis.gov/api/case-status

Requirements met:
- OAuth 2.0 Client Credentials authentication
- Successful responses (200) using valid staging receipt numbers
- Error responses (4xx) using invalid receipt numbers
- HTTPS communication
- Consistent daily traffic

Runs every 4 hours via background scheduler.
"""

import asyncio
import httpx
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

# USCIS Sandbox Configuration
USCIS_CLIENT_ID = os.getenv('USCIS_CLIENT_ID', 'VMignmUaFoGXHhBfvVrZNRJAHMOjmVlY')
USCIS_CLIENT_SECRET = os.getenv('USCIS_CLIENT_SECRET', 'vav8HuOHc97dGhY7')
USCIS_OAUTH_URL = os.getenv('USCIS_OAUTH_URL', 'https://api-int.uscis.gov/oauth/accesstoken')
USCIS_API_BASE = os.getenv('USCIS_API_BASE', 'https://api-int.uscis.gov/case-status')

# ===================================================================
# OFFICIAL USCIS STAGING RECEIPT NUMBERS
# Source: https://developer.uscis.gov/api/case-status
# These are the ONLY numbers that return 200 in sandbox!
# ===================================================================

# Staging receiptNumbers WITH hist_case_data in payloads
VALID_RECEIPT_NUMBERS_WITH_HISTORY = [
    'EAC9999103403', 'EAC9999103404', 'EAC9999103405',
    'EAC9999103410', 'EAC9999103411', 'EAC9999103416',
    'EAC9999103419',
    'LIN9999106498', 'LIN9999106499', 'LIN9999106504',
    'LIN9999106505', 'LIN9999106506',
    'SRC9999102777', 'SRC9999102778', 'SRC9999102779',
    'SRC9999102780', 'SRC9999102781', 'SRC9999102782',
    'SRC9999102783', 'SRC9999102784', 'SRC9999102785',
    'SRC9999102786', 'SRC9999102787',
    'SRC9999132710', 'SRC9999132719',
]

# Staging receiptNumbers WITHOUT hist_case_data in payloads
VALID_RECEIPT_NUMBERS_NO_HISTORY = [
    'EAC9999103400', 'EAC9999103402', 'EAC9999103406',
    'EAC9999103407', 'EAC9999103408', 'EAC9999103409',
    'EAC9999103412', 'EAC9999103413', 'EAC9999103414',
    'EAC9999103415', 'EAC9999103420', 'EAC9999103421',
    'EAC9999103424', 'EAC9999103425', 'EAC9999103426',
    'EAC9999103428', 'EAC9999103429', 'EAC9999103431',
    'EAC9999103432',
    'LIN9999106501', 'LIN9999106507',
    'SRC9999132694', 'SRC9999132695',
    'SRC9999132706', 'SRC9999132707',
]

# All valid staging receipt numbers combined
ALL_VALID_RECEIPT_NUMBERS = VALID_RECEIPT_NUMBERS_WITH_HISTORY + VALID_RECEIPT_NUMBERS_NO_HISTORY

# Invalid receipt numbers for 4xx error testing
INVALID_RECEIPT_NUMBERS = [
    'INVALID123',
    'ZZZ0000000000',
    'WAC000',
    'ABC1234567890123',
]


async def _get_sandbox_token() -> str:
    """Get OAuth token from USCIS sandbox."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            USCIS_OAUTH_URL,
            data={
                'grant_type': 'client_credentials',
                'client_id': USCIS_CLIENT_ID,
                'client_secret': USCIS_CLIENT_SECRET,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        
        if response.status_code != 200:
            logger.error(f"[USCIS Traffic] OAuth failed: {response.status_code} - {response.text[:200]}")
            return ""
        
        data = response.json()
        token = data.get('access_token', '')
        logger.info(f"[USCIS Traffic] ✅ OAuth token obtained (expires in {data.get('expires_in', '?')}s)")
        return token


async def _check_case(token: str, receipt_number: str) -> dict:
    """Make a case status request to the sandbox API."""
    if not token:
        return {"error": "No token", "status_code": 0}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                f'{USCIS_API_BASE}/{receipt_number}',
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
            )
            
            result = {
                "receipt_number": receipt_number,
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "response_size": len(response.text),
            }
            
            # Log individual results for debugging
            if response.status_code == 200:
                logger.info(f"[USCIS Traffic] ✅ 200 OK: {receipt_number}")
            else:
                logger.warning(f"[USCIS Traffic] ⚠️ {response.status_code}: {receipt_number} - {response.text[:100]}")
            
            return result
        except Exception as e:
            logger.error(f"[USCIS Traffic] ❌ Error for {receipt_number}: {e}")
            return {
                "receipt_number": receipt_number,
                "status_code": 0,
                "success": False,
                "error": str(e),
            }


async def generate_uscis_sandbox_traffic():
    """
    Generate a batch of sandbox API calls.
    Called every 4 hours by the scheduler.
    Uses OFFICIAL staging receipt numbers for 200 responses.
    """
    logger.info("[USCIS Traffic] 🚀 Starting sandbox traffic generation...")
    
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "oauth_success": False,
        "total_requests": 0,
        "success_200": 0,
        "errors_4xx": 0,
        "errors_5xx": 0,
        "rate_limited": 0,
        "other_errors": 0,
        "details": [],
    }
    
    # Step 1: Get OAuth token
    token = await _get_sandbox_token()
    if not token:
        logger.error("[USCIS Traffic] ❌ Failed to get OAuth token. Aborting.")
        results["oauth_success"] = False
        return results
    
    results["oauth_success"] = True
    
    # Step 2: Make requests with OFFICIAL staging receipt numbers (expect 200s)
    # Use a subset each time to stay within daily quota (200/day)
    # Rotate through the list to cover different receipt numbers
    import random
    selected_valid = random.sample(
        ALL_VALID_RECEIPT_NUMBERS, 
        min(15, len(ALL_VALID_RECEIPT_NUMBERS))
    )
    
    for rn in selected_valid:
        result = await _check_case(token, rn)
        results["total_requests"] += 1
        results["details"].append(result)
        
        sc = result.get("status_code", 0)
        if sc == 200:
            results["success_200"] += 1
        elif sc == 429:
            results["rate_limited"] += 1
            await asyncio.sleep(5)
        elif 400 <= sc < 500:
            results["errors_4xx"] += 1
        elif sc >= 500:
            results["errors_5xx"] += 1
        else:
            results["other_errors"] += 1
        
        # Respect rate limit: 10 TPS max, 1 req every 100ms
        # Use 200ms to be safe
        await asyncio.sleep(0.2)
    
    # Step 3: Make a few error requests with invalid receipt numbers (for 4xx testing)
    for rn in INVALID_RECEIPT_NUMBERS[:3]:
        result = await _check_case(token, rn)
        results["total_requests"] += 1
        results["details"].append(result)
        
        sc = result.get("status_code", 0)
        if sc == 200:
            results["success_200"] += 1
        elif sc == 429:
            results["rate_limited"] += 1
            await asyncio.sleep(5)
        elif 400 <= sc < 500:
            results["errors_4xx"] += 1
        elif sc >= 500:
            results["errors_5xx"] += 1
        else:
            results["other_errors"] += 1
        
        await asyncio.sleep(0.2)
    
    logger.info(
        f"[USCIS Traffic] ✅ Complete! "
        f"OAuth: {'✓' if results['oauth_success'] else '✗'} | "
        f"Requests: {results['total_requests']} | "
        f"200s: {results['success_200']} | "
        f"4xx: {results['errors_4xx']} | "
        f"5xx: {results['errors_5xx']} | "
        f"Rate limited: {results['rate_limited']} | "
        f"Errors: {results['other_errors']}"
    )
    
    # Save log to database for tracking
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        load_dotenv()
        MONGO_URL = os.getenv('MONGO_URL', '')
        if MONGO_URL:
            log_entry = {k: v for k, v in results.items() if k != 'details'}
            log_entry['sample_details'] = results['details'][:5]
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[os.getenv('DB_NAME', 'taxportal')]
            await db['uscis_sandbox_traffic_log'].insert_one(log_entry)
            client.close()
    except Exception as e:
        logger.warning(f"[USCIS Traffic] Could not save log to DB: {e}")
    
    return results


def start_uscis_traffic_scheduler():
    """Start the background scheduler that runs every 4 hours."""
    import threading
    
    async def _run_loop():
        while True:
            try:
                result = await generate_uscis_sandbox_traffic()
                if result.get("success_200", 0) > 0:
                    logger.info(f"[USCIS Traffic] 🎯 Got {result['success_200']} successful 200 responses!")
                else:
                    logger.warning("[USCIS Traffic] ⚠️ No 200 responses in this batch!")
            except Exception as e:
                logger.error(f"[USCIS Traffic] Scheduler error: {e}")
            
            # Wait 4 hours before next run
            await asyncio.sleep(4 * 60 * 60)
    
    def _thread_target():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run_loop())
    
    thread = threading.Thread(target=_thread_target, daemon=True)
    thread.start()
    logger.info("[USCIS Traffic] 📡 Sandbox traffic scheduler started (every 4 hours)")
