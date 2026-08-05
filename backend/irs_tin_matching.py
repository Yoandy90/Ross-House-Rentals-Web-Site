"""
IRS TIN Matching Service
Integrates with IRS e-Services A2A API for real-time TIN/EIN verification.

Uses OAuth 2.0 JWT Bearer authentication (RS256) with IRS-issued Client ID.

Endpoints:
  - POST /api/tin-matching/verify       → Single TIN verification
  - POST /api/tin-matching/verify-batch  → Batch verification (up to 25)
  - GET  /api/tin-matching/history       → Verification history
"""

import jwt
import uuid
import time
import os
import json
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from cryptography.hazmat.primitives import serialization
from motor.motor_asyncio import AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("irs_tin_matching")

router = APIRouter(prefix="/tin-matching", tags=["IRS TIN Matching"])

# Module-level references
_db: Optional[AsyncIOMotorDatabase] = None
_get_current_user = None

# IRS Configuration
IRS_CLIENT_ID = os.getenv("IRS_IRIS_API_CLIENT_ID", "a039bcd6-2b92-4f70-9e92-758b0b26dc00")
IRS_USER_ID = os.getenv("IRS_IRIS_USER_ID", "HKBTX7O63F-15284021")
IRS_PRIVATE_KEY_PATH = os.getenv("IRIS_PRIVATE_KEY_PATH", "/app/memory/iris_private_key_v2.pem")
IRS_CERT_PATH = os.getenv("IRS_CERT_PATH", "/app/memory/iris_cert_v2.pem")
IRS_KID = "rosstax-iris-2026"

# IRS API Endpoints
IRS_TOKEN_URL = "https://api.www4.irs.gov/auth/oauth/v2/token"
IRS_TINM_URL = os.getenv("IRS_TINM_URL", "https://api.www4.irs.gov/esrv/api/tinm/request")

# Response code meanings
TIN_MATCH_CODES = {
    "0": {"status": "match", "message": "TIN y nombre coinciden con registros del IRS", "icon": "✅"},
    "1": {"status": "invalid_tin", "message": "TIN faltante o no tiene 9 dígitos", "icon": "⚠️"},
    "2": {"status": "not_issued", "message": "TIN no ha sido emitido actualmente", "icon": "❌"},
    "3": {"status": "no_match", "message": "TIN y nombre NO coinciden con registros del IRS", "icon": "❌"},
    "4": {"status": "invalid_request", "message": "Solicitud inválida - verificar formato", "icon": "⚠️"},
    "5": {"status": "duplicate", "message": "Solicitud duplicada - revisar resultados anteriores", "icon": "ℹ️"},
    "6": {"status": "partial_match_ssn", "message": "Coincidencia parcial solo por SSN", "icon": "⚠️"},
    "7": {"status": "partial_match_ein", "message": "Coincidencia parcial solo por EIN", "icon": "⚠️"},
    "8": {"status": "partial_match_itin", "message": "Coincidencia parcial solo por ITIN", "icon": "⚠️"},
}


def init_tin_matching(db, get_current_user):
    global _db, _get_current_user
    _db = db
    _get_current_user = get_current_user


def get_db():
    return _db


# ================== MODELS ==================

class TINVerifyRequest(BaseModel):
    tin: str  # 9-digit TIN (SSN or EIN)
    name: str  # Taxpayer or employer name
    tin_type: str = "EIN"  # "SSN", "EIN", or "UNKNOWN"


class TINBatchRequest(BaseModel):
    records: List[TINVerifyRequest]  # Max 25


# ================== IRS AUTH ==================

def _load_private_key():
    """Load the RSA private key from PEM file."""
    with open(IRS_PRIVATE_KEY_PATH, 'r') as f:
        return f.read()


def _create_client_jwt(token_url: str) -> str:
    """
    Create the Client Assertion JWT.
    Matches the pattern used in iris_service.py.
    """
    private_key = _load_private_key()
    
    now = int(time.time())
    
    headers = {
        "kid": IRS_KID,
    }
    
    payload = {
        "iss": IRS_CLIENT_ID,
        "sub": IRS_CLIENT_ID,
        "aud": token_url,
        "iat": now,
        "exp": now + 600,  # 10 minutes
        "jti": str(uuid.uuid4()),
    }
    
    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)


def _create_user_jwt(token_url: str) -> str:
    """
    Create the User Assertion JWT.
    Uses IRS User ID (not email) matching iris_service.py pattern.
    """
    private_key = _load_private_key()
    
    now = int(time.time())
    
    headers = {
        "kid": IRS_KID,
    }
    
    payload = {
        "iss": IRS_USER_ID,
        "sub": IRS_USER_ID,
        "aud": token_url,
        "iat": now,
        "exp": now + 600,
        "jti": str(uuid.uuid4()),
    }
    
    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)


async def _get_access_token(use_test: bool = False) -> str:
    """
    Obtain an OAuth2 access token from the IRS using JWT Bearer authentication.
    """
    token_url = IRS_TOKEN_URL
    
    client_jwt = _create_client_jwt(token_url)
    user_jwt = _create_user_jwt(token_url)
    
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": user_jwt,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": client_jwt,
    }
    
    async with httpx.AsyncClient(verify=True, timeout=30.0) as client:
        response = await client.post(
            token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
    
    if response.status_code != 200:
        error_detail = response.text[:300]
        logger.warning(f"IRS Token Error ({token_url}): {response.status_code} - {error_detail}")
        
        if "ESRV124" in error_detail:
            raise HTTPException(
                503,
                "El consentimiento del IRS aún no se ha propagado. "
                "Esto puede tardar unas horas después de otorgar acceso. "
                "Intenta de nuevo más tarde."
            )
        
        raise HTTPException(502, f"Error obteniendo token del IRS: {response.status_code}")
    
    token_data = response.json()
    logger.info(f"IRS Token obtained. Scope: {token_data.get('scope')}")
    return token_data.get("access_token")


# ================== TIN MATCHING API ==================

async def _verify_tin_with_irs(tin: str, name: str, tin_type: str = "EIN", use_test: bool = False) -> dict:
    """
    Call the IRS TIN Matching API to verify a single TIN/name combination.
    """
    access_token = await _get_access_token(use_test=use_test)
    
    tinm_url = IRS_TINM_URL
    
    # Clean the TIN - remove dashes and spaces
    clean_tin = tin.replace("-", "").replace(" ", "").strip()
    
    payload = {
        "tinType": tin_type.upper(),
        "tin": clean_tin,
        "name": name.strip().upper(),
    }
    
    async with httpx.AsyncClient(verify=True, timeout=30.0) as client:
        response = await client.post(
            tinm_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
        )
    
    if response.status_code != 200:
        logger.error(f"IRS TINM Error: {response.status_code} - {response.text}")
        raise HTTPException(502, f"Error del IRS TIN Matching: {response.status_code}")
    
    return response.json()


def _serialize_doc(doc):
    """Convert MongoDB doc to serializable dict."""
    if doc:
        doc['_id'] = str(doc['_id'])
        for key in ['created_at', 'verified_at']:
            if key in doc and hasattr(doc[key], 'isoformat'):
                doc[key] = doc[key].isoformat()
    return doc


# ================== ENDPOINTS ==================

@router.post("/verify")
async def verify_tin(data: TINVerifyRequest, user=Depends(lambda: _get_current_user)):
    """
    Verify a single TIN/name combination with the IRS.
    Returns match status and stores result in history.
    """
    db = get_db()
    
    clean_tin = data.tin.replace("-", "").replace(" ", "").strip()
    
    if len(clean_tin) != 9 or not clean_tin.isdigit():
        raise HTTPException(400, "TIN debe tener exactamente 9 dígitos")
    
    try:
        # Call IRS API
        irs_response = await _verify_tin_with_irs(
            tin=clean_tin,
            name=data.name,
            tin_type=data.tin_type,
        )
        
        # Parse response code
        response_code = str(irs_response.get("responseCode", irs_response.get("code", "4")))
        match_info = TIN_MATCH_CODES.get(response_code, {
            "status": "unknown",
            "message": f"Código de respuesta desconocido: {response_code}",
            "icon": "❓"
        })
        
        result = {
            "success": True,
            "tin": f"***-**-{clean_tin[-4:]}" if data.tin_type == "SSN" else f"**-***{clean_tin[-4:]}",
            "tin_full": clean_tin,
            "name": data.name.upper(),
            "tin_type": data.tin_type,
            "response_code": response_code,
            "status": match_info["status"],
            "message": match_info["message"],
            "icon": match_info["icon"],
            "irs_raw": irs_response,
        }
        
        # Store in verification history
        history_doc = {
            "tin_last4": clean_tin[-4:],
            "tin_type": data.tin_type,
            "name": data.name.upper(),
            "response_code": response_code,
            "status": match_info["status"],
            "message": match_info["message"],
            "verified_at": datetime.now(timezone.utc),
            "verified_by": user.get("email", "unknown") if isinstance(user, dict) else "unknown",
        }
        await db.tin_verifications.insert_one(history_doc)
        
        # If it's an EIN match, also update the employer_eins collection
        if data.tin_type == "EIN" and response_code == "0":
            formatted_ein = f"{clean_tin[:2]}-{clean_tin[2:]}"
            await db.employer_eins.update_one(
                {"ein_normalized": clean_tin},
                {"$set": {
                    "irs_verified": True,
                    "irs_verified_at": datetime.now(timezone.utc),
                    "irs_response_code": response_code,
                }},
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TIN Matching error: {e}")
        raise HTTPException(500, f"Error en verificación TIN: {str(e)}")


@router.post("/verify-batch")
async def verify_tin_batch(data: TINBatchRequest, user=Depends(lambda: _get_current_user)):
    """
    Verify up to 25 TIN/name combinations with the IRS.
    """
    if len(data.records) > 25:
        raise HTTPException(400, "Máximo 25 registros por solicitud (límite del IRS)")
    
    if len(data.records) == 0:
        raise HTTPException(400, "Debe incluir al menos 1 registro")
    
    db = get_db()
    results = []
    
    # Get a single access token for all requests
    try:
        access_token = await _get_access_token()
    except Exception as e:
        raise HTTPException(502, f"Error autenticando con IRS: {str(e)}")
    
    tinm_url = IRS_TINM_URL
    
    async with httpx.AsyncClient(verify=True, timeout=60.0) as client:
        for record in data.records:
            clean_tin = record.tin.replace("-", "").replace(" ", "").strip()
            
            if len(clean_tin) != 9 or not clean_tin.isdigit():
                results.append({
                    "tin_last4": clean_tin[-4:] if len(clean_tin) >= 4 else clean_tin,
                    "name": record.name,
                    "status": "invalid_tin",
                    "message": "TIN inválido",
                    "icon": "⚠️",
                })
                continue
            
            try:
                payload = {
                    "tinType": record.tin_type.upper(),
                    "tin": clean_tin,
                    "name": record.name.strip().upper(),
                }
                
                response = await client.post(
                    tinm_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    }
                )
                
                if response.status_code == 200:
                    irs_resp = response.json()
                    code = str(irs_resp.get("responseCode", irs_resp.get("code", "4")))
                    match_info = TIN_MATCH_CODES.get(code, {"status": "unknown", "message": f"Código: {code}", "icon": "❓"})
                    
                    result = {
                        "tin_last4": clean_tin[-4:],
                        "name": record.name.upper(),
                        "tin_type": record.tin_type,
                        "response_code": code,
                        "status": match_info["status"],
                        "message": match_info["message"],
                        "icon": match_info["icon"],
                    }
                    results.append(result)
                    
                    # Store in history
                    await db.tin_verifications.insert_one({
                        "tin_last4": clean_tin[-4:],
                        "tin_type": record.tin_type,
                        "name": record.name.upper(),
                        "response_code": code,
                        "status": match_info["status"],
                        "verified_at": datetime.now(timezone.utc),
                        "batch": True,
                    })
                else:
                    results.append({
                        "tin_last4": clean_tin[-4:],
                        "name": record.name,
                        "status": "error",
                        "message": f"Error IRS: {response.status_code}",
                        "icon": "❌",
                    })
                    
            except Exception as e:
                results.append({
                    "tin_last4": clean_tin[-4:] if len(clean_tin) >= 4 else clean_tin,
                    "name": record.name,
                    "status": "error",
                    "message": str(e),
                    "icon": "❌",
                })
    
    matched = sum(1 for r in results if r.get("status") == "match")
    
    return {
        "success": True,
        "total": len(results),
        "matched": matched,
        "not_matched": len(results) - matched,
        "results": results,
    }


@router.get("/history")
async def verification_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(lambda: _get_current_user)
):
    """Get TIN verification history."""
    db = get_db()
    
    skip = (page - 1) * limit
    total = await db.tin_verifications.count_documents({})
    
    cursor = db.tin_verifications.find({}).sort("verified_at", -1).skip(skip).limit(limit)
    
    results = []
    async for doc in cursor:
        results.append(_serialize_doc(doc))
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "results": results,
    }


@router.get("/test-auth")
async def test_irs_auth(user=Depends(lambda: _get_current_user)):
    """
    Test the IRS authentication flow without making a TIN matching request.
    Useful for verifying credentials are correctly configured.
    """
    try:
        # Test JWT creation
        client_jwt = _create_client_jwt(IRS_TOKEN_URL)
        user_jwt = _create_user_jwt(IRS_TOKEN_URL)
        
        # Decode JWTs to show claims (without verification)
        client_claims = jwt.decode(client_jwt, options={"verify_signature": False})
        user_claims = jwt.decode(user_jwt, options={"verify_signature": False})
        
        return {
            "success": True,
            "message": "Credenciales IRS configuradas correctamente",
            "config": {
                "client_id": IRS_CLIENT_ID,
                "user_id": IRS_USER_ID,
                "kid": IRS_KID,
                "private_key_loaded": True,
                "token_url": IRS_TOKEN_URL,
                "tinm_url": IRS_TINM_URL,
            },
            "jwt_preview": {
                "client_jwt_claims": client_claims,
                "user_jwt_claims": user_claims,
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Error en la configuración de credenciales IRS",
        }


@router.post("/test-connection")
async def test_irs_connection(user=Depends(lambda: _get_current_user)):
    """
    Actually test the connection to IRS by requesting an access token.
    """
    try:
        access_token = await _get_access_token(use_test=False)
        
        return {
            "success": True,
            "message": "✅ Conexión exitosa con IRS e-Services",
            "token_received": True,
            "token_preview": access_token[:20] + "..." if access_token else None,
        }
    except HTTPException as e:
        return {
            "success": False,
            "message": f"❌ Error conectando con IRS: {e.detail}",
            "token_received": False,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"❌ Error: {str(e)}",
            "token_received": False,
        }
