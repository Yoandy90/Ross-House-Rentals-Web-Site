"""
Client-facing loan endpoints for the Ross Lending mobile app.
These are NON-admin endpoints that authenticated clients can use.
"""
import os
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId

# Import shared business logic (no more circular imports from regulated_lender_router)
from loan_shared_service import (
    calculate_hybrid,
    generate_regulated_schedule,
    build_pdf_loan_data,
    generate_schedule_for_loan,
)

logger = logging.getLogger(__name__)

client_loans_router = APIRouter()

# Will be set during init
_db = None
_get_current_user = None


def init_client_loans_router(db, get_current_user_fn):
    global _db, _get_current_user
    _db = db
    _get_current_user = get_current_user_fn


async def _get_user(authorization: Optional[str] = None):
    """Authenticate user from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user_id = session["user_id"]
    try:
        user = await _db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await _db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_id"] = str(user["_id"])
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-loans — Get all loans for the current authenticated user
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-loans")
async def get_my_loans(request: Request, authorization: Optional[str] = Header(None)):
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    # Search by email OR phone
    query_conditions = []
    if email:
        query_conditions.append({"client_email": {"$regex": email, "$options": "i"}})
    if phone:
        clean_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "").strip()
        if clean_phone:
            query_conditions.append({"client_phone": {"$regex": clean_phone}})

    if not query_conditions:
        return {"loans": []}

    query = {"$or": query_conditions}
    loans = []
    cursor = _db.regulated_loans.find(query).sort("created_at", -1)
    async for loan in cursor:
        loan["_id"] = str(loan["_id"])
        loans.append(loan)

    return {"loans": loans, "total": len(loans)}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-payments — Get payment history for all user's loans
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-payments")
async def get_my_payments(request: Request, authorization: Optional[str] = Header(None)):
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    # First get all user's loans
    query_conditions = []
    if email:
        query_conditions.append({"client_email": {"$regex": email, "$options": "i"}})
    if phone:
        clean_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "").strip()
        if clean_phone:
            query_conditions.append({"client_phone": {"$regex": clean_phone}})

    if not query_conditions:
        return {"payments": []}

    query = {"$or": query_conditions}
    loan_ids = []
    cursor = _db.regulated_loans.find(query, {"_id": 1, "loan_number": 1})
    async for loan in cursor:
        loan_ids.append(loan["_id"])

    if not loan_ids:
        return {"payments": []}

    # Get all payments for these loans
    payments = []
    for loan_id in loan_ids:
        loan = await _db.regulated_loans.find_one({"_id": loan_id})
        if loan and "payments" in loan:
            for payment in loan["payments"]:
                payment["loan_id"] = str(loan_id)
                payment["loan_number"] = loan.get("loan_number", "")
                payments.append(payment)

    # Sort by date descending
    payments.sort(key=lambda p: p.get("date", p.get("payment_date", "")), reverse=True)

    return {"payments": payments, "total": len(payments)}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-contracts — Get contracts for all user's loans
# ═══════════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────────
# Helper: verify loan ownership
# ───────────────────────────────────────────────────────────────────────────────
async def _verify_loan_ownership(loan_id: str, authorization: Optional[str]):
    """Verify that the authenticated user owns this loan. Returns (user, loan)."""
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    loan_email = (loan.get("client_email") or "").lower()
    loan_phone = (loan.get("client_phone") or "").replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
    user_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")

    authorized = False
    if email and loan_email and email == loan_email:
        authorized = True
    elif user_phone and loan_phone and user_phone in loan_phone:
        authorized = True
    if not authorized:
        raise HTTPException(status_code=403, detail="No tienes acceso a este préstamo")

    loan["_id"] = str(loan["_id"])
    return user, loan


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/{loan_id}/payment-schedule — Client payment schedule (calendar)
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/{loan_id}/payment-schedule")
async def get_payment_schedule(request: Request, loan_id: str, authorization: Optional[str] = Header(None)):
    """Generate and return the payment schedule/calendar for a client's loan."""
    user, loan = await _verify_loan_ownership(loan_id, authorization)

    # Generate schedule from loan data using shared service
    try:
        schedule_raw = generate_schedule_for_loan(loan)
    except Exception as e:
        logger.error(f"Error generating schedule: {e}")
        schedule_raw = []

    # Get existing payments to mark which are paid
    existing_payments = []
    payment_cursor = _db.regulated_loan_payments.find({"loan_id": loan_id}).sort("payment_date", 1)
    async for p in payment_cursor:
        existing_payments.append(p)

    # Also check the loan's payments array
    loan_payments = loan.get("payments", [])
    paid_count = len(existing_payments) + len(loan_payments)

    now = datetime.utcnow()
    schedule = []
    for item in schedule_raw:
        pnum = item["payment_number"]
        due_date = item.get("due_date", "")

        if pnum <= paid_count:
            status = "paid"
        elif due_date:
            try:
                due_dt = datetime.strptime(due_date, "%Y-%m-%d")
                if due_dt < now:
                    status = "overdue"
                else:
                    status = "upcoming"
            except:
                status = "upcoming"
        else:
            status = "upcoming"

        schedule.append({
            "payment_number": pnum,
            "due_date": due_date,
            "amount": item.get("payment_amount", 0),
            "principal": item.get("principal", 0),
            "interest": item.get("interest", 0),
            "admin_fee": item.get("admin_fee", 0),
            "balance": item.get("balance", 0),
            "status": status,
        })

    return {
        "schedule": schedule,
        "autopay": {"active": loan.get("autopay_active", False)},
        "total_payments": len(schedule),
        "paid_count": paid_count,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/{loan_id}/payments — Client payment history for a specific loan
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/{loan_id}/payments")
async def get_loan_payments(request: Request, loan_id: str, authorization: Optional[str] = Header(None)):
    """Get payment history for a specific loan owned by the client."""
    user, loan = await _verify_loan_ownership(loan_id, authorization)

    payments = []

    # Check regulated_loan_payments collection
    cursor = _db.regulated_loan_payments.find({"loan_id": loan_id}).sort("payment_date", -1)
    async for p in cursor:
        p["_id"] = str(p["_id"])
        payments.append({
            "_id": p["_id"],
            "amount": p.get("amount", 0),
            "payment_date": p.get("payment_date", ""),
            "method": p.get("method", "cash"),
            "status": p.get("status", "completed"),
            "confirmation": p.get("confirmation_number", ""),
        })

    # Also check embedded payments in loan document
    for p in loan.get("payments", []):
        payments.append({
            "_id": str(p.get("_id", "")),
            "amount": p.get("amount", 0),
            "payment_date": p.get("date", p.get("payment_date", "")),
            "method": p.get("method", "cash"),
            "status": p.get("status", "completed"),
            "confirmation": p.get("confirmation_number", ""),
        })

    return {"payments": payments}


@client_loans_router.get("/loans/my-contracts")
async def get_my_contracts(request: Request, authorization: Optional[str] = Header(None)):
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    query_conditions = []
    if email:
        query_conditions.append({"client_email": {"$regex": email, "$options": "i"}})
    if phone:
        clean_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "").strip()
        if clean_phone:
            query_conditions.append({"client_phone": {"$regex": clean_phone}})

    if not query_conditions:
        return {"contracts": []}

    query = {"$or": query_conditions}
    contracts = []
    cursor = _db.regulated_loans.find(query).sort("created_at", -1)
    async for loan in cursor:
        loan_type = loan.get("loan_type", "subchapter_f")
        type_label = {
            "subchapter_f": "Préstamo Personal",
            "subchapter_e": "Préstamo a Plazos",
            "hybrid": "Préstamo",
            "tax_advance": "Adelanto de Taxes",
        }.get(loan_type, "Préstamo")

        contracts.append({
            "_id": str(loan["_id"]),
            "loan_number": loan.get("loan_number", ""),
            "title": f"Contrato — {type_label} #{loan.get('loan_number', '')}",
            "amount": loan.get("amount", 0),
            "total_to_pay": loan.get("total_to_pay", 0),
            "signed_date": loan.get("created_at", ""),
            "status": loan.get("status", "active"),
            "has_contract": loan.get("contracts_generated", False),
        })

    return {"contracts": contracts, "total": len(contracts)}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-contracts/{loan_id}/download — Download contract PDF
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-contracts/{loan_id}/download")
async def download_my_contract(request: Request, loan_id: str, authorization: Optional[str] = Header(None), token: Optional[str] = Query(None), lang: Optional[str] = Query("es")):
    """Client-facing endpoint to download their own contract PDF.
    Supports auth via Authorization header OR ?token= query param (for iOS compatibility).
    Lang param selects ES or EN version.
    """
    # Support token as query param (iOS drops auth headers on downloadAsync)
    if not authorization and token:
        authorization = f"Bearer {token}"
    
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    # Verify this loan belongs to the user
    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    loan_email = (loan.get("client_email") or "").lower()
    loan_phone = (loan.get("client_phone") or "").replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
    user_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")

    if email and loan_email and email == loan_email:
        pass  # authorized
    elif user_phone and loan_phone and user_phone in loan_phone:
        pass  # authorized
    else:
        raise HTTPException(status_code=403, detail="No tienes acceso a este contrato")

    loan["_id"] = str(loan["_id"])

    # Normalize language
    lang = lang.lower() if lang else "es"
    if lang not in ("es", "en"):
        lang = "es"

    # Try to use pre-generated signed contract first
    pdf_key = f"contract_pdf_{lang}"
    if loan.get(pdf_key):
        try:
            import base64
            from fastapi.responses import Response
            pdf_bytes = base64.b64decode(loan[pdf_key])
            suffix = "ES" if lang == "es" else "EN"
            filename = f"Contrato_{loan.get('loan_number', 'RLS')}_{suffix}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'inline; filename="{filename}"',
                    "Content-Length": str(len(pdf_bytes)),
                }
            )
        except Exception as e:
            logger.warning(f"Pre-generated {lang} contract failed, regenerating: {e}")

    # Generate on the fly
    try:
        schedule = generate_schedule_for_loan(loan)
    except Exception as e:
        logger.error(f"Error generating schedule: {e}")
        schedule = []

    pdf_loan = build_pdf_loan_data(loan)

    try:
        import base64
        from loan_pdf_service import generate_loan_contract_pdf
        from fastapi.responses import Response
        pdf_base64 = generate_loan_contract_pdf(pdf_loan, schedule, lang=lang)
        pdf_bytes = base64.b64decode(pdf_base64)

        suffix = "ES" if lang == "es" else "EN"
        filename = f"Contrato_{loan.get('loan_number', 'RLS')}_{suffix}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            }
        )
    except Exception as e:
        logger.error(f"Error generating client contract PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando contrato: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-contracts/{loan_id}/download-base64 — iOS-safe PDF download
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-contracts/{loan_id}/download-base64")
async def download_my_contract_base64(request: Request, loan_id: str, authorization: Optional[str] = Header(None)):
    """Returns contract PDF as base64 JSON — reliable on ALL platforms including iOS."""
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    loan_email = (loan.get("client_email") or "").lower()
    loan_phone = (loan.get("client_phone") or "").replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
    user_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")

    is_admin = user.get("role") in ("admin", "superadmin")
    if not is_admin:
        if email and loan_email and email == loan_email:
            pass
        elif user_phone and loan_phone and user_phone in loan_phone:
            pass
        else:
            raise HTTPException(status_code=403, detail="No tienes acceso a este contrato")

    loan["_id"] = str(loan["_id"])

    try:
        schedule = generate_schedule_for_loan(loan)
    except Exception as e:
        logger.error(f"Error generating schedule: {e}")
        schedule = []

    pdf_loan = build_pdf_loan_data(loan)

    try:
        from loan_pdf_service import generate_loan_contract_pdf
        pdf_base64 = generate_loan_contract_pdf(pdf_loan, schedule, lang='es')
        filename = f"Contrato_{loan.get('loan_number', 'RLS')}.pdf"
        return {"pdf_base64": pdf_base64, "filename": filename}
    except Exception as e:
        logger.error(f"Error generating contract base64: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando contrato: {str(e)}")



# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-contracts/{loan_id}/details — Get full contract details for signing
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-contracts/{loan_id}/details")
async def get_contract_details(request: Request, loan_id: str, authorization: Optional[str] = Header(None)):
    """Get full loan details for the signing screen — TILA disclosure required by OCCC."""
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    # Verify ownership
    loan_email = (loan.get("client_email") or "").lower()
    loan_phone = (loan.get("client_phone") or "").replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
    user_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")

    authorized = False
    if email and loan_email and email == loan_email:
        authorized = True
    elif user_phone and loan_phone and user_phone in loan_phone:
        authorized = True
    if not authorized:
        raise HTTPException(status_code=403, detail="No tienes acceso a este contrato")

    # Build TILA disclosure data (legally required before signing)
    calc = loan.get("calculation", {})
    annual_apr = loan.get("annual_apr", calc.get("apr_effective", calc.get("effective_apr", 0)))

    signature = loan.get("signature")
    is_signed = signature is not None and signature.get("image_data")

    return {
        "loan_id": str(loan["_id"]),
        "loan_number": loan.get("loan_number", ""),
        "client_name": loan.get("client_name", ""),
        "loan_type": loan.get("loan_type", "subchapter_f"),
        "subchapter": calc.get("subchapter", "F"),
        "status": loan.get("status", "active"),

        # TILA Federal Disclosure (required by law before signature)
        "tila": {
            "apr": round(annual_apr, 2),
            "finance_charge": loan.get("total_interest", 0) + loan.get("admin_fee", 0),
            "amount_financed": loan.get("amount", 0),
            "total_of_payments": loan.get("total_to_pay", 0),
        },

        # Loan terms
        "terms": {
            "amount": loan.get("amount", 0),
            "interest_rate": loan.get("interest_rate", 0),
            "term_months": loan.get("term_months", 1),
            "monthly_payment": loan.get("monthly_payment", 0),
            "weekly_payment": loan.get("weekly_payment", round(loan.get("monthly_payment", 0) / 4.33, 2)),
            "total_interest": loan.get("total_interest", 0),
            "admin_fee": loan.get("admin_fee", 0),
            "total_to_pay": loan.get("total_to_pay", 0),
            "purpose": loan.get("purpose", ""),
            "first_payment_date": loan.get("first_payment_date", ""),
            "payment_frequency": loan.get("payment_frequency", "weekly"),
        },

        # Signature status
        "is_signed": bool(is_signed),
        "signature_type": signature.get("type", "") if signature else "",
        "signed_at": (signature.get("signed_at").isoformat() if signature and hasattr(signature.get("signed_at"), 'isoformat') else signature.get("signed_at", "")) if signature else "",

        "created_at": loan.get("created_at", ""),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/loans/my-contracts/{loan_id}/sign — Client signs their contract
# ═══════════════════════════════════════════════════════════════════════════════
class ClientSignRequest(BaseModel):
    image_data: str  # base64 signature PNG
    signer_name: str = ""

@client_loans_router.post("/loans/my-contracts/{loan_id}/sign")
async def client_sign_contract(request: Request, loan_id: str, body: ClientSignRequest, authorization: Optional[str] = Header(None)):
    """Client signs their loan contract from the mobile app."""
    import hashlib
    user = await _get_user(authorization)
    email = user.get("email", "").lower()
    phone = user.get("phone", "")

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    # Verify ownership
    loan_email = (loan.get("client_email") or "").lower()
    loan_phone = (loan.get("client_phone") or "").replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")
    user_phone = phone.replace("+1", "").replace("-", "").replace("(", "").replace(")", "").replace(" ", "")

    authorized = False
    if email and loan_email and email == loan_email:
        authorized = True
    elif user_phone and loan_phone and user_phone in loan_phone:
        authorized = True
    if not authorized:
        raise HTTPException(status_code=403, detail="No tienes acceso a este contrato")

    # Check if already signed
    if loan.get("signature") and loan["signature"].get("image_data"):
        raise HTTPException(status_code=400, detail="Este contrato ya fue firmado")

    if not body.image_data:
        raise HTTPException(status_code=400, detail="No se recibió la firma")

    # Create signature hash for integrity verification (same as admin flow)
    sig_payload = body.image_data.encode('utf-8')
    sig_hash = hashlib.sha256(sig_payload).hexdigest()

    now = datetime.utcnow()
    client_ip = request.client.host if request.client else 'unknown'

    signature_record = {
        "type": "mobile_canvas",
        "image_data": body.image_data,
        "biometric_data": "",
        "pad_model": "mobile_touch",
        "hash": sig_hash,
        "signed_at": now,
        "signed_by_client": email or phone,
        "signer_name": body.signer_name or loan.get("client_name", ""),
        "client_ip": client_ip,
        "device": "mobile_app",
    }

    update = {
        "signature": signature_record,
        "signature_status": "signed",
        "signature_type": "mobile_canvas",
        "signed_at": now,
        "updated_at": now,
    }

    # Auto-advance status
    current_status = loan.get("status", "active")
    if current_status in ["pending_signature", "approved", "active"]:
        update["status"] = "signed" if current_status == "pending_signature" else current_status

    history_entry = {
        "status": update.get("status", current_status),
        "changed_by": email or phone or "client",
        "changed_at": now.isoformat(),
        "comment": f"Contrato firmado digitalmente desde la app móvil por {loan.get('client_name', '')}. Hash: {sig_hash[:12]}..."
    }

    await _db.regulated_loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": update, "$push": {"status_history": history_entry}}
    )

    # Generate both ES and EN contract PDFs with the signature
    try:
        from loan_shared_service import build_pdf_loan_data, generate_schedule_for_loan
        from loan_pdf_service import generate_loan_contract_pdf

        updated_loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
        pdf_loan_data = build_pdf_loan_data(updated_loan)
        schedule = generate_schedule_for_loan(updated_loan)

        pdf_es = generate_loan_contract_pdf(pdf_loan_data, schedule, lang='es')
        pdf_en = generate_loan_contract_pdf(pdf_loan_data, schedule, lang='en')

        await _db.regulated_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "contract_pdf_es": pdf_es,
                "contract_pdf_en": pdf_en,
                "contracts_generated_at": now,
            }}
        )
        logger.info(f"Both ES/EN contracts generated for {loan.get('loan_number')}")
    except Exception as e:
        logger.error(f"Error generating bilingual contracts: {e}")

    logger.info(f"Contract {loan.get('loan_number')} signed by client {email or phone} via mobile app")

    return {
        "success": True,
        "message": "Contrato firmado exitosamente",
        "signed_at": now.isoformat(),
        "hash": sig_hash,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: POST /api/admin/lending/loans/{loan_id}/sign — Admin signs loan with Topaz/Canvas (in-office)
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.post("/admin/lending/loans/{loan_id}/sign")
async def admin_sign_loan(loan_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """Admin captures client signature in office using Topaz pad or canvas."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo admin puede firmar en oficina")

    body = await request.json()
    signature_data = body.get("image_data", "")
    sig_type = body.get("type", "canvas")  # 'topaz' or 'canvas'
    signer_name = body.get("signer_name", "")

    if not signature_data:
        raise HTTPException(status_code=400, detail="Firma requerida")

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    import hashlib
    now = datetime.utcnow()
    sig_hash = hashlib.sha256(f"{loan_id}{signature_data[:100]}{now.isoformat()}".encode()).hexdigest()

    signature_record = {
        "image_data": signature_data,
        "type": sig_type,
        "hash": sig_hash,
        "signed_at": now,
        "signed_by_client": signer_name or loan.get("client_name", ""),
        "witnessed_by": user.get("email"),
        "device": "topaz_office" if sig_type == "topaz" else "canvas_office",
        "pad_model": body.get("pad_model", "Topaz SigWeb" if sig_type == "topaz" else "Canvas"),
    }

    update_fields = {
        "signature": signature_record,
        "signature_status": "signed",
        "signature_type": f"office_{sig_type}",
        "signature_date": now.isoformat(),
        "signed_at": now,
        "status": "active",
        "disbursement_date": now.isoformat(),
        "updated_at": now,
    }

    history_entry = {
        "status": "active",
        "changed_by": user.get("email"),
        "changed_at": now.isoformat(),
        "comment": f"Contrato firmado en oficina ({sig_type}) por {signer_name or loan.get('client_name', '')}. Testigo: {user.get('email')}. Hash: {sig_hash[:12]}..."
    }

    await _db.regulated_loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": update_fields, "$push": {"status_history": history_entry}}
    )

    # Generate both ES and EN contract PDFs with the signature
    try:
        from loan_shared_service import build_pdf_loan_data, generate_schedule_for_loan
        from loan_pdf_service import generate_loan_contract_pdf

        updated_loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
        pdf_loan_data = build_pdf_loan_data(updated_loan)
        schedule = generate_schedule_for_loan(updated_loan)

        pdf_es = generate_loan_contract_pdf(pdf_loan_data, schedule, lang='es')
        pdf_en = generate_loan_contract_pdf(pdf_loan_data, schedule, lang='en')

        await _db.regulated_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "contract_pdf_es": pdf_es,
                "contract_pdf_en": pdf_en,
                "contracts_generated_at": now,
            }}
        )
        logger.info(f"Both ES/EN contracts generated for {loan.get('loan_number')} (admin sign)")
    except Exception as e:
        logger.error(f"Error generating bilingual contracts on admin sign: {e}")

    logger.info(f"Admin {user.get('email')} signed loan {loan.get('loan_number')} for client {loan.get('client_name')} via {sig_type}")

    return {
        "success": True,
        "message": "Contrato firmado exitosamente — préstamo activado",
        "signed_at": now.isoformat(),
        "hash": sig_hash,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/{loan_id}/contract-pdf?lang=es|en — Download bilingual contract
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/{loan_id}/contract-pdf")
async def get_loan_contract_pdf(loan_id: str, lang: str = Query("es"), authorization: Optional[str] = Header(None)):
    """Generate and return the loan contract PDF in the specified language."""
    user = await _get_user(authorization)

    loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    # Authorization: admin or client who owns the loan
    is_admin = user.get("role") in ("admin", "superadmin")
    is_owner = (
        user.get("email", "").lower() == (loan.get("client_email") or "").lower()
        or user.get("phone", "") == loan.get("client_phone", "")
    )
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="No autorizado")

    if lang not in ("en", "es"):
        lang = "es"

    try:
        from loan_pdf_service import generate_loan_contract_pdf
        schedule = generate_schedule_for_loan(loan)
        pdf_loan = build_pdf_loan_data(loan)
        pdf_base64 = generate_loan_contract_pdf(pdf_loan, schedule, lang=lang)

        import base64, io
        pdf_bytes = base64.b64decode(pdf_base64)
        lang_label = "ES" if lang == "es" else "EN"
        filename = f"Contrato_{loan.get('loan_number', loan_id)}_{lang_label}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.error(f"Error generating contract PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# PLAID INTEGRATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@client_loans_router.post("/plaid/create-link-token")
async def plaid_create_link_token(request: Request, authorization: Optional[str] = Header(None)):
    """Create a Plaid Link token for the authenticated user."""
    user = await _get_user(authorization)
    user_id = user.get("_id") or user.get("id") or user.get("email", "unknown")

    try:
        from plaid_service import create_link_token
        result = await create_link_token(str(user_id))
        return result
    except Exception as e:
        logger.error(f"Plaid create_link_token error: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating Plaid link: {str(e)}")


@client_loans_router.post("/plaid/exchange-token")
async def plaid_exchange_token(request: Request, authorization: Optional[str] = Header(None)):
    """Exchange a Plaid public token for account data."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id") or user.get("email", "unknown"))
    body = await request.json()
    public_token = body.get("public_token", "")

    if not public_token:
        raise HTTPException(status_code=400, detail="public_token required")

    try:
        from plaid_service import exchange_public_token
        result = await exchange_public_token(public_token, user_id)

        # Return only safe (masked) account info to the client
        safe_accounts = []
        for a in result.get("accounts", []):
            safe_accounts.append({
                "account_id": a.get("account_id", ""),
                "name": a.get("name", ""),
                "mask": a.get("mask", ""),
                "type": a.get("type", ""),
                "subtype": a.get("subtype", ""),
                "routing_last4": a.get("routing_number", "")[-4:] if a.get("routing_number") else "",
                "connected": True,
            })

        return {"success": True, "accounts": safe_accounts}
    except Exception as e:
        logger.error(f"Plaid exchange_token error: {e}")
        raise HTTPException(status_code=500, detail=f"Error connecting bank: {str(e)}")


@client_loans_router.get("/plaid/accounts")
async def plaid_get_accounts(request: Request, authorization: Optional[str] = Header(None)):
    """Get the user's linked bank accounts (masked data only)."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id") or user.get("email", "unknown"))

    try:
        from plaid_service import get_user_bank_accounts
        accounts = await get_user_bank_accounts(user_id)
        return {"accounts": accounts}
    except Exception as e:
        logger.error(f"Plaid get_accounts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@client_loans_router.post("/admin/plaid/config")
async def admin_update_plaid_config(request: Request, authorization: Optional[str] = Header(None)):
    """Admin endpoint to update Plaid API keys without redeploying."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    body = await request.json()
    client_id = body.get("client_id", "")
    secret = body.get("secret", "")
    environment = body.get("environment", "sandbox")

    if not client_id or not secret:
        raise HTTPException(status_code=400, detail="client_id and secret required")

    try:
        from plaid_service import save_plaid_config
        await save_plaid_config(client_id, secret, environment)
        return {"success": True, "message": f"Plaid config updated ({environment})"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/options?amount=500 — Get loan term options for a given amount
# ═══════════════════════════════════════════════════════════════════════════════

@client_loans_router.get("/loans/options")
async def get_loan_options(
    amount: float = Query(..., ge=200, le=1800),
    request: Request = None,
    authorization: Optional[str] = Header(None),
):
    """
    Returns available loan term options with weekly/monthly payments.
    Respects the client's credit tier max_term_months.
    """
    # Get client's credit tier to determine max term
    max_term = 6  # fallback
    try:
        user = await _get_user(authorization)
        user_id = str(user.get("_id") or user.get("id") or "")
        email = user.get("email", "")
        phone = user.get("phone", "")
        from capital_pool_service import get_client_credit_tier
        tier_info = await get_client_credit_tier(user_id=user_id, email=email, phone=phone)
        max_term = tier_info.get("max_term_months", 6)
    except Exception as e:
        logger.warning(f"Could not determine credit tier, using default max_term=6: {e}")

    terms = list(range(1, max_term + 1))
    options = []

    for term in terms:
        try:
            calc = calculate_hybrid(amount, term)
            monthly_payment = calc.get("monthly_payment", 0)
            total_interest = calc.get("total_interest", 0)
            admin_fee = calc.get("admin_fee", 0)
            total_to_pay = calc.get("total_to_pay", 0)
            apr = calc.get("effective_apr", calc.get("apr_effective", 0))

            options.append({
                "term_months": term,
                "monthly_payment": round(monthly_payment, 2),
                "weekly_payment": round(monthly_payment / 4.33, 2),
                "biweekly_payment": round(monthly_payment / 2, 2),
                "total_interest": round(total_interest, 2),
                "admin_fee": round(admin_fee, 2),
                "total_to_pay": round(total_to_pay, 2),
                "apr": round(apr, 2),
                "subchapter": calc.get("subchapter", "F"),
            })
        except Exception as e:
            logger.warning(f"Error calculating term {term} for amount {amount}: {e}")

    return {
        "amount": amount,
        "options": options,
        "disclaimer_en": "Rates shown are estimates. Final terms subject to approval.",
        "disclaimer_es": "Las tasas mostradas son estimadas. Los términos finales están sujetos a aprobación.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/loans/my-credit-tier — Get client's credit tier and max loan amount
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-credit-tier")
async def get_my_credit_tier(request: Request, authorization: Optional[str] = Header(None)):
    """Returns the client's credit tier, max amount, and suggested amounts."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id") or "")
    email = user.get("email", "")
    phone = user.get("phone", "")

    try:
        from capital_pool_service import get_client_credit_tier
        tier_info = await get_client_credit_tier(user_id=user_id, email=email, phone=phone)
        return tier_info
    except Exception as e:
        logger.error(f"Error getting credit tier: {e}")
        # Default to new client
        return {"tier": "new", "max_amount": 500, "suggested_amounts": [200, 300, 500], "max_term_months": 3}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: GET /api/admin/capital-pool — Get capital pool status
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/admin/capital-pool")
async def admin_get_capital_pool(request: Request, authorization: Optional[str] = Header(None)):
    """Admin: view capital pool status — how much lent, collected, available."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        from capital_pool_service import get_pool_status
        return await get_pool_status()
    except Exception as e:
        logger.error(f"Error getting pool status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: PUT /api/admin/capital-pool — Update total capital
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.put("/admin/capital-pool")
async def admin_update_capital_pool(request: Request, authorization: Optional[str] = Header(None)):
    """Admin: update the total capital available for lending."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    body = await request.json()
    new_total = body.get("total_capital")
    notes = body.get("notes", "")

    if new_total is None or new_total < 0:
        raise HTTPException(status_code=400, detail="total_capital required (>= 0)")

    try:
        from capital_pool_service import update_total_capital
        result = await update_total_capital(float(new_total), user.get("email", "admin"), notes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: GET /api/admin/client-credit-tier/{email} — Check any client's tier
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/admin/client-credit-tier/{email}")
async def admin_get_client_tier(email: str, request: Request, authorization: Optional[str] = Header(None)):
    """Admin: check a specific client's credit tier."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        from capital_pool_service import get_client_credit_tier
        return await get_client_credit_tier(email=email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class LoanApplicationRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str = ""
    # New fields
    date_of_birth: str = ""
    ssn_last4: str = ""
    address_street: str = ""
    address_city: str = ""
    address_state: str = "TX"
    address_zip: str = ""
    # Employment
    employer: str = ""
    employment_type: str = "full_time"
    time_at_employer: str = ""
    monthly_income: str = ""
    # Loan details
    loan_type: str = "hybrid"
    amount: str = ""
    purpose: str = ""
    preferred_term: str = "3"
    notes: str = ""
    # Bank info (optional)
    bank_name: str = ""
    routing_number: str = ""
    account_number: str = ""
    account_type: str = "checking"


# ═══════════════════════════════════════════════════════════════════════════════
# ELIGIBILITY CHECK — Only 1 active loan OR pending application at a time
# ═══════════════════════════════════════════════════════════════════════════════
BLOCKING_LOAN_STATUSES = ["active", "delinquent", "pending_signature"]
BLOCKING_APP_STATUSES = ["pending", "info_requested", "docs_submitted"]


async def _check_client_can_apply(user_id: str, email: str = "") -> dict:
    """
    Returns {can_apply: bool, reason_es: str, reason_en: str, blocking_type, blocking_data}
    Checks both regulated_loans AND loan_applications collections.
    """
    # 1) Check for active regulated loans
    loan_query = {"status": {"$in": BLOCKING_LOAN_STATUSES}}
    if email:
        loan_query["$or"] = [{"user_id": user_id}, {"client_email": email.lower()}]
    else:
        loan_query["user_id"] = user_id

    active_loan = await _db.regulated_loans.find_one(loan_query, sort=[("created_at", -1)])
    if active_loan:
        status = active_loan.get("status", "active")
        amount = active_loan.get("amount", 0)
        loan_number = active_loan.get("loan_number", "")
        status_labels = {
            "active": ("activo", "active"),
            "delinquent": ("en mora", "delinquent"),
            "pending_signature": ("pendiente de firma", "pending signature"),
        }
        label_es, label_en = status_labels.get(status, ("activo", "active"))
        return {
            "can_apply": False,
            "reason_es": f"Ya tienes un préstamo {label_es} ({loan_number} — ${amount:,.0f}). Debes completar el pago antes de solicitar otro.",
            "reason_en": f"You have an {label_en} loan ({loan_number} — ${amount:,.0f}). You must complete payment before applying for another.",
            "blocking_type": "active_loan",
            "blocking_data": {
                "loan_number": loan_number,
                "status": status,
                "amount": amount,
                "balance": active_loan.get("balance", 0),
            }
        }

    # 2) Check for pending applications
    app_query = {"user_id": user_id, "status": {"$in": BLOCKING_APP_STATUSES}}
    pending_app = await _db.loan_applications.find_one(app_query, sort=[("created_at", -1)])
    if pending_app:
        status = pending_app.get("status", "pending")
        amount = pending_app.get("amount_requested", pending_app.get("amount", "?"))
        status_labels = {
            "pending": ("en revisión", "under review"),
            "info_requested": ("requiere documentos", "documents requested"),
            "docs_submitted": ("documentos enviados", "documents submitted"),
        }
        label_es, label_en = status_labels.get(status, ("pendiente", "pending"))
        return {
            "can_apply": False,
            "reason_es": f"Ya tienes una solicitud {label_es} por ${amount}. Debes esperar la decisión antes de enviar otra.",
            "reason_en": f"You already have an application {label_en} for ${amount}. You must wait for a decision before submitting another.",
            "blocking_type": "pending_application",
            "blocking_data": {
                "app_id": str(pending_app["_id"]),
                "status": status,
                "amount": amount,
            }
        }

    return {"can_apply": True, "reason_es": "", "reason_en": "", "blocking_type": None, "blocking_data": None}


@client_loans_router.get("/loans/can-apply")
async def check_can_apply(authorization: Optional[str] = Header(None)):
    """Client checks if they are eligible to submit a new loan application."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id"))
    email = user.get("email", "")
    result = await _check_client_can_apply(user_id, email)
    return result


@client_loans_router.post("/loans/apply")
async def submit_loan_application(
    request: Request,
    body: LoanApplicationRequest,
    authorization: Optional[str] = Header(None),
):
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id"))

    # ═══ BLOCK: Cannot apply if active loan or pending application ═══
    eligibility = await _check_client_can_apply(user_id, user.get("email", ""))
    if not eligibility["can_apply"]:
        raise HTTPException(
            status_code=409,
            detail=eligibility["reason_es"]
        )

    # ═══ ANTI-FRAUD: Use name from account, not from form ═══
    account_first = user.get("first_name", "")
    account_last = user.get("last_name", "")
    if not account_first:
        # Fallback: split from legacy "name" field
        parts = (user.get("name", "") or "").strip().split(' ', 1)
        account_first = parts[0]
        account_last = parts[1] if len(parts) > 1 else ""
    # Use account name (locked), ignore form name
    first_name = account_first or body.first_name.strip()
    last_name = account_last or body.last_name.strip()

    application = {
        "user_id": user_id,
        "first_name": first_name,
        "last_name": last_name,
        "phone": body.phone.strip(),
        "email": body.email.strip().lower() or user.get("email", ""),
        "date_of_birth": body.date_of_birth.strip(),
        "ssn_last4": body.ssn_last4.strip(),
        "address": {
            "street": body.address_street.strip(),
            "city": body.address_city.strip(),
            "state": body.address_state.strip().upper(),
            "zip": body.address_zip.strip(),
        },
        "employer": body.employer.strip(),
        "employment_type": body.employment_type,
        "time_at_employer": body.time_at_employer.strip(),
        "monthly_income": body.monthly_income.strip(),
        "loan_type": body.loan_type,
        "amount_requested": body.amount.strip(),
        "preferred_term": body.preferred_term,
        "purpose": body.purpose,
        "notes": body.notes.strip(),
        "bank_info": {
            "bank_name": body.bank_name.strip(),
            "routing_number": body.routing_number.strip(),
            "account_last4": body.account_number.strip()[-4:] if body.account_number.strip() else "",
            "account_type": body.account_type,
        } if body.bank_name.strip() else None,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = await _db.loan_applications.insert_one(application)
    application["_id"] = str(result.inserted_id)
    app_id_short = str(result.inserted_id)[:8].upper()

    logger.info(f"New loan application from {body.first_name} {body.last_name} — ${body.amount} ({body.loan_type})")

    client_name = f"{body.first_name} {body.last_name}".strip()
    client_email = application.get("email") or user.get("email", "")
    client_phone = body.phone.strip() or user.get("phone", "")

    # ═══ Fire-and-forget: Send all notifications in background ═══
    import asyncio

    async def _send_all_notifications():
        """Background task: send email, sms, push with Ross Lending branding"""
        from lending_notification_service import get_lending_notifications
        ns = get_lending_notifications()

        # Email to client
        try:
            if client_email:
                await ns.notify_application_received_client(
                    to_email=client_email,
                    name=client_name,
                    amount=body.amount,
                    loan_type=body.loan_type.replace('_', ' ').title(),
                    app_id=app_id_short,
                )
        except Exception as e:
            logger.error(f"⚠️ Client email failed: {e}")

        # Email to admin
        try:
            await ns.notify_application_received_admin(
                name=client_name,
                amount=body.amount,
                loan_type=body.loan_type.replace('_', ' ').title(),
                phone=client_phone,
                email=client_email,
                app_id=app_id_short,
            )
        except Exception as e:
            logger.error(f"⚠️ Admin email failed: {e}")

        # SMS to admin + client
        try:
            await ns.sms_application_received_admin(
                name=client_name,
                amount=body.amount,
                loan_type=body.loan_type.replace('_', ' ').title(),
                phone=client_phone,
                app_id=app_id_short,
            )
            if client_phone:
                await ns.sms_application_received_client(
                    phone=client_phone,
                    name=body.first_name,
                    amount=body.amount,
                    app_id=app_id_short,
                )
        except Exception as e:
            logger.error(f"⚠️ SMS notification failed: {e}")

        # Push to admins
        try:
            from push_notification_service import send_push_notification
            admin_users = await _db.users.find({"role": "admin", "push_token": {"$exists": True, "$ne": None}}).to_list(10)
            for admin in admin_users:
                admin_token = admin.get("push_token") or admin.get("expo_push_token")
                if admin_token:
                    await send_push_notification(
                        expo_push_token=admin_token,
                        title="📋 Nueva Solicitud de Préstamo",
                        body=f"{client_name} — ${body.amount}",
                        data={"type": "new_application", "app_id": str(result.inserted_id)},
                    )
        except Exception as e:
            logger.error(f"⚠️ Admin push failed: {e}")

        # Push to client
        try:
            from push_notification_service import send_push_notification
            client_user = await _db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
            if not client_user:
                client_user = await _db.users.find_one({"_id": user_id})
            client_token = None
            if client_user:
                client_token = client_user.get("push_token") or client_user.get("expo_push_token")
            if client_token:
                await send_push_notification(
                    expo_push_token=client_token,
                    title="✅ Solicitud Recibida",
                    body=f"Tu solicitud de préstamo por ${body.amount} ha sido enviada exitosamente. Te contactaremos pronto.",
                    data={"type": "application_submitted", "app_id": str(result.inserted_id)},
                )
        except Exception as e:
            logger.error(f"⚠️ Client push failed: {e}")

    # Launch notifications in background — don't block the response
    asyncio.create_task(_send_all_notifications())

    return {
        "success": True,
        "message": "Solicitud recibida exitosamente",
        "application_id": str(result.inserted_id),
    }



# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: GET /api/admin/lending/applications — List all loan applications
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/admin/lending/applications")
async def admin_list_applications(
    request: Request,
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    """Admin endpoint to list all loan applications from the mobile app."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    query_filter = {}
    if status and status != "all":
        query_filter["status"] = status
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query_filter["$or"] = [
            {"first_name": search_regex},
            {"last_name": search_regex},
            {"email": search_regex},
            {"phone": search_regex},
        ]

    cursor = _db.loan_applications.find(query_filter).sort("created_at", -1)
    apps = await cursor.to_list(length=200)

    results = []
    for app in apps:
        app["_id"] = str(app["_id"])
        # Map fields to match frontend expectations
        fn = app.get("first_name", "")
        ln = app.get("last_name", "")
        app["applicant_name"] = f"{fn} {ln}".strip() or app.get("applicant_name", "")
        app["applicant_email"] = app.get("email", app.get("applicant_email", ""))
        app["applicant_phone"] = app.get("phone", app.get("applicant_phone", ""))
        # amount_requested is stored as string, loan_amount as number
        raw_amount = app.get("amount_requested", app.get("loan_amount", app.get("amount", 0)))
        try:
            app["loan_amount"] = float(str(raw_amount).replace(",", "").replace("$", ""))
        except (ValueError, TypeError):
            app["loan_amount"] = 0
        app["loan_purpose"] = app.get("purpose", app.get("loan_purpose", ""))
        # monthly_income may be string
        raw_income = app.get("monthly_income", 0)
        try:
            app["monthly_income"] = float(str(raw_income).replace(",", "").replace("$", ""))
        except (ValueError, TypeError):
            app["monthly_income"] = 0
        # Include docs count
        app["documents_count"] = app.get("documents_count", len(app.get("documents", [])))
        results.append(app)

    return {"applications": results, "total": len(results)}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: PUT /api/admin/lending/applications/{app_id}/review — Approve/Reject
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.put("/admin/lending/applications/{app_id}/review")
async def admin_review_application(
    request: Request,
    app_id: str,
    authorization: Optional[str] = Header(None),
):
    """Admin reviews a loan application — approve, reject, or request documents."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    body = await request.json()
    decision = body.get("decision") or body.get("status")  # approved, rejected, info_requested
    notes = body.get("notes", "")
    required_documents = body.get("required_documents", [])  # e.g. ["photo_id", "pay_stub", "proof_address"]

    if decision not in ("approved", "rejected", "info_requested"):
        raise HTTPException(status_code=400, detail="Decisión inválida")

    # Build update
    now_iso = datetime.utcnow().isoformat()
    update_set = {
        "status": decision,
        "reviewed_by": user.get("email"),
        "reviewed_at": now_iso,
        "review_notes": notes,
        "updated_at": now_iso,
    }

    # If requesting documents, store which ones are needed
    if decision == "info_requested" and required_documents:
        doc_requests = []
        for doc_key in required_documents:
            doc_requests.append({
                "doc_type": doc_key,
                "requested_at": now_iso,
                "requested_by": user.get("email"),
                "status": "pending",  # pending, uploaded, approved, rejected
            })
        update_set["required_documents"] = doc_requests

    update = {
        "$set": update_set,
        "$push": {
            "status_history": {
                "status": decision,
                "by": user.get("email"),
                "at": now_iso,
                "notes": notes,
                "required_documents": required_documents if decision == "info_requested" else [],
            }
        }
    }

    result = await _db.loan_applications.update_one({"_id": ObjectId(app_id)}, update)
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    # Reload application data
    app_data = await _db.loan_applications.find_one({"_id": ObjectId(app_id)})

    # ═══ AUTO-CREATE REGULATED LOAN ON APPROVAL ═══
    loan_id = None
    if decision == "approved" and app_data:
        # ═══ BLOCK: Check if client already has an active loan ═══
        app_user_id = app_data.get("user_id", "")
        app_email = app_data.get("email", "")
        eligibility = await _check_client_can_apply(app_user_id, app_email)
        if not eligibility["can_apply"] and eligibility["blocking_type"] == "active_loan":
            raise HTTPException(
                status_code=409,
                detail=f"No se puede aprobar: {eligibility['reason_es']}"
            )
        try:
            loan_id = await _create_loan_from_application(app_data, user)
            # Store loan reference in application
            if loan_id:
                await _db.loan_applications.update_one(
                    {"_id": ObjectId(app_id)},
                    {"$set": {"regulated_loan_id": str(loan_id)}}
                )
                logger.info(f"✅ Created regulated loan {loan_id} from application {app_id}")
        except Exception as e:
            logger.error(f"Error creating regulated loan from application: {e}")

    # Send push notification to client
    if app_data:
        await _send_application_notification(app_data, decision, notes, required_documents)

    logger.info(f"Admin {user.get('email')} {decision} application {app_id}")
    resp = {"success": True, "message": f"Solicitud {decision}"}
    if loan_id:
        resp["loan_id"] = str(loan_id)
    return resp


async def _create_loan_from_application(app_data: dict, admin_user: dict) -> str:
    """
    When admin approves an application, auto-create a regulated loan
    with status 'pending_signature'. The loan stays inactive until signed.
    """
    from datetime import timedelta

    amount_raw = app_data.get("amount_requested", app_data.get("amount", 0))
    try:
        amount = float(str(amount_raw).replace(",", "").replace("$", ""))
    except (ValueError, TypeError):
        amount = 0

    if amount < 100:
        amount = 1000  # Default if invalid

    term_months_raw = app_data.get("term_months", app_data.get("preferred_term", 3))
    try:
        term_months = int(term_months_raw)
    except (ValueError, TypeError):
        term_months = 3

    # Enforce credit tier max term
    try:
        from capital_pool_service import get_client_credit_tier
        client_email = app_data.get("email", "")
        client_phone = app_data.get("phone", "")
        user_id = str(app_data.get("user_id", ""))
        tier_info = await get_client_credit_tier(user_id=user_id, email=client_email, phone=client_phone)
        max_term = tier_info.get("max_term_months", 6)
        max_amount = tier_info.get("max_amount", 1800)
        if term_months > max_term:
            logger.warning(f"⚠️ Term {term_months}m exceeds tier max {max_term}m — capping to {max_term}m")
            term_months = max_term
        if amount > max_amount:
            logger.warning(f"⚠️ Amount ${amount} exceeds tier max ${max_amount} — capping to ${max_amount}")
            amount = max_amount
    except Exception as e:
        logger.warning(f"Could not validate credit tier, using term as-is: {e}")
        if term_months > 6:
            term_months = 3  # Safe fallback

    # Calculate using hybrid method (Sub F ≤$1800, Sub E >$1800)
    calc = calculate_hybrid(amount, term_months)
    actual_subchapter = calc.get("subchapter", "F")
    loan_type = f"subchapter_{actual_subchapter.lower()}"

    # Generate loan number
    count = await _db.regulated_loans.count_documents({})
    loan_number = f"RL-{datetime.now().year}-{count + 1:04d}"

    # Client info from application
    first_name = app_data.get("first_name", "")
    last_name = app_data.get("last_name", "")
    client_name = f"{first_name} {last_name}".strip()
    client_email = app_data.get("email", "")
    client_phone = app_data.get("phone", "")
    ssn_last4 = app_data.get("ssn_last4", "")

    # Address info
    address = app_data.get("address", "")
    city = app_data.get("city", "")
    state = app_data.get("state", "TX")
    zipcode = app_data.get("zip", app_data.get("zipcode", ""))

    now_iso = datetime.now().isoformat()
    first_payment = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    loan_doc = {
        "loan_number": loan_number,
        "loan_type": loan_type,
        "subchapter": actual_subchapter,
        "client_name": client_name,
        "client_phone": client_phone,
        "client_email": client_email,
        "client_ssn_last4": ssn_last4,
        "client_address": address,
        "client_city": city,
        "client_state": state,
        "client_zip": zipcode,
        "amount": amount,
        "term_months": term_months,
        "interest_rate": calc.get("effective_apr", calc.get("apr_effective", 0)),
        "annual_apr": calc.get("effective_apr", calc.get("apr_effective", 0)),
        "amortization_method": "simple",
        "total_interest": calc.get("total_interest", 0),
        "admin_fee": calc.get("admin_fee", 0),
        "monthly_payment": calc.get("monthly_payment", 0),
        "total_to_pay": calc.get("total_to_pay", 0),
        "purpose": app_data.get("purpose", "personal"),
        "notes": f"Auto-generado desde solicitud #{str(app_data['_id'])[:8].upper()}",
        "status": "pending_signature",
        "balance": amount + calc.get("total_interest", 0) + calc.get("admin_fee", 0),
        "principal_paid": 0,
        "interest_paid": 0,
        "fees_paid": 0,
        "days_overdue": 0,
        "first_payment_date": first_payment,
        "next_payment_date": first_payment,
        "calculation": calc,
        # Link back to application
        "application_id": str(app_data["_id"]),
        "user_id": app_data.get("user_id"),
        # Signature tracking
        "signature": None,
        "signature_date": None,
        "signature_type": None,  # 'topaz', 'canvas', 'in_app'
        "contract_language": "es",
        # Meta
        "created_at": now_iso,
        "created_by": admin_user.get("email", "admin"),
        "updated_at": now_iso,
        "status_history": [{
            "status": "pending_signature",
            "date": now_iso,
            "by": admin_user.get("email", "admin"),
            "comment": "Solicitud aprobada — pendiente firma del cliente"
        }],
    }

    result = await _db.regulated_loans.insert_one(loan_doc)
    return result.inserted_id


async def _send_application_notification(app_data, decision, notes, required_documents):
    """Send Email, SMS, and Push notification to the client about their application status using Ross Lending branding."""
    import asyncio

    async def _do_send():
        try:
            from lending_notification_service import get_lending_notifications
            ns = get_lending_notifications()

            user_id = app_data.get("user_id")
            if not user_id:
                return

            # Find user
            try:
                client = await _db.users.find_one({"_id": ObjectId(user_id)})
            except:
                client = await _db.users.find_one({"_id": user_id})
            if not client:
                return

            client_name = f"{app_data.get('first_name', '')} {app_data.get('last_name', '')}".strip()
            client_email = app_data.get("email") or client.get("email", "")
            client_phone = app_data.get("phone") or client.get("phone", "")
            amount = app_data.get("amount_requested", 0)
            app_id_short = str(app_data["_id"])[:8].upper()
            push_token = client.get("push_token") or client.get("fcm_token") or client.get("expo_push_token")

            if decision == "approved":
                # Email
                term = app_data.get("term_months", 12)
                monthly = app_data.get("monthly_payment", 0)
                if client_email:
                    await ns.notify_loan_approved(client_email, client_name, float(amount), term, float(monthly), app_id_short)
                # SMS
                if client_phone:
                    await ns.sms_loan_approved(client_phone, client_name, float(amount), float(monthly))
                # Push
                title = "✅ ¡Solicitud Aprobada!"
                body_text = f"Tu préstamo de ${amount} ha sido aprobado. Te contactaremos pronto para los próximos pasos."

            elif decision == "rejected":
                # Email
                if client_email:
                    await ns.notify_loan_rejected(client_email, client_name, app_id_short, notes)
                # SMS
                if client_phone:
                    await ns.sms_loan_rejected(client_phone, client_name)
                # Push
                title = "❌ Solicitud No Aprobada"
                body_text = f"Lamentamos informarte que tu solicitud no fue aprobada en este momento. Contáctanos para más información."

            elif decision == "info_requested":
                doc_names = {
                    "photo_id": "Identificación con foto",
                    "pay_stub": "Pay Stub / Comprobante de ingreso",
                    "proof_address": "Comprobante de domicilio",
                    "bank_statement": "Estado de cuenta bancario",
                    "selfie": "Selfie de verificación",
                    "tax_return": "Declaración de impuestos",
                    "reference": "Referencia personal",
                    "other": "Documento adicional",
                }
                doc_list = ", ".join([doc_names.get(d, d) for d in required_documents[:3]])
                # Email
                if client_email:
                    await ns.notify_document_request(client_email, client_name, doc_list)
                # SMS
                if client_phone:
                    await ns.sms_document_request(client_phone, client_name, doc_list)
                # Push
                title = "📋 Documentos Requeridos"
                body_text = f"Tu solicitud de ${amount} necesita documentos: {doc_list}. Abre la app para subirlos."
            else:
                return

            # Send push notification
            if push_token:
                from push_notification_service import send_push_notification
                await send_push_notification(
                    expo_push_token=push_token,
                    title=title,
                    body=body_text,
                    data={"type": "loan_application_update", "application_id": str(app_data["_id"]), "decision": decision}
                )

            # Store in-app notification
            await _db.notifications.insert_one({
                "user_id": str(user_id),
                "title": title,
                "body": body_text,
                "type": "loan_application",
                "data": {"application_id": str(app_data["_id"]), "decision": decision},
                "read": False,
                "created_at": datetime.utcnow().isoformat(),
            })

            logger.info(f"📨 Notifications sent to {client_name} for application {app_data['_id']} ({decision})")
        except Exception as e:
            logger.error(f"Error sending application notification: {e}")

    # Fire and forget
    asyncio.create_task(_do_send())


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT: GET /api/loans/my-applications — Client views their own applications
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/loans/my-applications")
async def get_my_applications(authorization: Optional[str] = Header(None)):
    """Client views their loan applications and their current status."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id"))

    apps = []
    async for app in _db.loan_applications.find({"user_id": user_id}).sort("created_at", -1):
        app["_id"] = str(app["_id"])
        apps.append(app)

    return {"applications": apps, "total": len(apps)}


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT: POST /api/loans/applications/{app_id}/upload-document — Upload a doc
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.post("/loans/applications/{app_id}/upload-document")
async def upload_application_document(
    request: Request,
    app_id: str,
    authorization: Optional[str] = Header(None),
):
    """Client uploads a document for their loan application."""
    user = await _get_user(authorization)
    user_id = str(user.get("_id") or user.get("id"))

    body = await request.json()
    doc_type = body.get("doc_type", "other")
    file_data = body.get("file_data", "")  # base64
    file_name = body.get("file_name", f"{doc_type}.jpg")

    if not file_data:
        raise HTTPException(status_code=400, detail="No file data provided")

    # Verify the application belongs to this user
    app_data = await _db.loan_applications.find_one({"_id": ObjectId(app_id), "user_id": user_id})
    if not app_data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    now_iso = datetime.utcnow().isoformat()
    doc_id = str(ObjectId())

    document = {
        "id": doc_id,
        "doc_type": doc_type,
        "file_name": file_name,
        "file_data": file_data,
        "uploaded_at": now_iso,
        "status": "uploaded",  # uploaded, approved, rejected
    }

    # Add to uploaded_documents array and update the required_documents status
    await _db.loan_applications.update_one(
        {"_id": ObjectId(app_id)},
        {
            "$push": {"uploaded_documents": document},
            "$set": {"updated_at": now_iso},
        }
    )

    # Update the matching required document status to "uploaded"
    await _db.loan_applications.update_one(
        {"_id": ObjectId(app_id), "required_documents.doc_type": doc_type},
        {"$set": {"required_documents.$.status": "uploaded"}}
    )

    # Check if all required documents are now uploaded
    updated_app = await _db.loan_applications.find_one({"_id": ObjectId(app_id)})
    required = updated_app.get("required_documents", [])
    all_uploaded = all(d.get("status") in ("uploaded", "approved") for d in required) if required else False

    if all_uploaded and required:
        # Notify admin
        await _db.loan_applications.update_one(
            {"_id": ObjectId(app_id)},
            {"$set": {"docs_complete": True, "status": "docs_submitted"}}
        )
        # Store in-app notification for admins
        client_name = f"{app_data.get('first_name', '')} {app_data.get('last_name', '')}".strip()
        await _db.notifications.insert_one({
            "user_id": "admin",
            "title": "📎 Documentos Completos",
            "body": f"{client_name} ha subido todos los documentos requeridos para su solicitud.",
            "type": "admin_alert",
            "data": {"application_id": app_id},
            "read": False,
            "created_at": now_iso,
        })

    logger.info(f"Document {doc_type} uploaded for application {app_id}")
    return {
        "success": True,
        "document_id": doc_id,
        "all_required_uploaded": all_uploaded,
        "message": "Documento subido exitosamente"
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: GET /api/admin/lending/applications/{app_id}/documents — View docs
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/admin/lending/applications/{app_id}/documents")
async def get_application_documents(
    app_id: str,
    authorization: Optional[str] = Header(None),
):
    """Admin views all uploaded documents for a loan application."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    app_data = await _db.loan_applications.find_one({"_id": ObjectId(app_id)})
    if not app_data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    return {
        "application_id": app_id,
        "client_name": f"{app_data.get('first_name', '')} {app_data.get('last_name', '')}".strip(),
        "required_documents": app_data.get("required_documents", []),
        "uploaded_documents": [
            {**d, "file_data": d.get("file_data", "")[:100] + "..." if d.get("file_data") else ""}
            for d in app_data.get("uploaded_documents", [])
        ],
        "docs_complete": app_data.get("docs_complete", False),
        "status": app_data.get("status"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: PUT /api/admin/lending/applications/{app_id}/documents/{doc_id}/review
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.put("/admin/lending/applications/{app_id}/documents/{doc_id}/review")
async def review_application_document(
    request: Request,
    app_id: str,
    doc_id: str,
    authorization: Optional[str] = Header(None),
):
    """Admin approves or rejects a specific uploaded document."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    body = await request.json()
    doc_status = body.get("status", "approved")  # approved or rejected
    doc_notes = body.get("notes", "")

    if doc_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status inválido")

    now_iso = datetime.utcnow().isoformat()

    result = await _db.loan_applications.update_one(
        {"_id": ObjectId(app_id), "uploaded_documents.id": doc_id},
        {"$set": {
            "uploaded_documents.$.status": doc_status,
            "uploaded_documents.$.reviewed_at": now_iso,
            "uploaded_documents.$.reviewed_by": user.get("email"),
            "uploaded_documents.$.review_notes": doc_notes,
        }}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    return {"success": True, "message": f"Documento {doc_status}"}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN: GET /api/admin/lending/applications/{app_id}/document-file/{doc_id}
# ═══════════════════════════════════════════════════════════════════════════════
@client_loans_router.get("/admin/lending/applications/{app_id}/document-file/{doc_id}")
async def get_document_file(
    app_id: str,
    doc_id: str,
    authorization: Optional[str] = Header(None),
):
    """Admin downloads a specific document file (returns base64)."""
    user = await _get_user(authorization)
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    app_data = await _db.loan_applications.find_one({"_id": ObjectId(app_id)})
    if not app_data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    for doc in app_data.get("uploaded_documents", []):
        if doc.get("id") == doc_id:
            return {
                "doc_type": doc.get("doc_type"),
                "file_name": doc.get("file_name"),
                "file_data": doc.get("file_data", ""),
                "uploaded_at": doc.get("uploaded_at"),
            }

    raise HTTPException(status_code=404, detail="Documento no encontrado")


# NOTE: forgot-password endpoint is already in password_reset_endpoints.py
