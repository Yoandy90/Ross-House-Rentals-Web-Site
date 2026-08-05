"""
Stripe Identity Verification Routes
KYC verification for loan disbursement
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import stripe
import os
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/loans/identity", tags=["Identity Verification"])

STRIPE_KEY = os.getenv("STRIPE_LENDING_SECRET_KEY") or os.getenv("STRIPE_SECRET_KEY")
stripe.api_key = STRIPE_KEY


class VerificationSessionResponse(BaseModel):
    session_id: str
    ephemeral_key_secret: str
    status: str


class VerificationStatusResponse(BaseModel):
    verified: bool
    status: str
    last_error: str | None = None


@router.post("/create-session", response_model=VerificationSessionResponse)
async def create_verification_session(request_data: dict = None):
    """
    Creates a Stripe Identity VerificationSession.
    Called from the mobile app when user taps 'Verify Identity'.
    """
    try:
        # Extract user/loan info from request
        loan_id = ""
        user_id = ""
        if request_data:
            loan_id = request_data.get("loan_id", "")
            user_id = request_data.get("user_id", "")

        # Create the verification session
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            options={
                "document": {
                    "allowed_types": ["driving_license", "passport", "id_card"],
                    "require_id_number": False,
                    "require_matching_selfie": True,
                    "require_live_capture": True,
                },
            },
            metadata={
                "loan_id": loan_id,
                "user_id": user_id,
                "source": "ross_lending_app",
            },
        )

        return VerificationSessionResponse(
            session_id=verification_session.id,
            ephemeral_key_secret=verification_session.client_secret,
            status=verification_session.status,
        )

    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@router.get("/status/{session_id}", response_model=VerificationStatusResponse)
async def get_verification_status(session_id: str):
    """
    Check the status of a verification session.
    """
    try:
        session = stripe.identity.VerificationSession.retrieve(session_id)

        return VerificationStatusResponse(
            verified=session.status == "verified",
            status=session.status,
            last_error=session.last_error.get("code") if session.last_error else None,
        )

    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.get("/check-loan/{loan_id}")
async def check_loan_verification(loan_id: str):
    """
    Check if a loan has been identity-verified.
    Looks up verification sessions by loan_id metadata.
    """
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        MONGO_URL = os.getenv("MONGO_URL")
        client = AsyncIOMotorClient(MONGO_URL)
        db = client["taxportal"]

        # Check our DB first for cached verification status
        loan = await db.regulated_loans.find_one({"_id": loan_id})
        if not loan:
            from bson import ObjectId
            try:
                loan = await db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
            except:
                pass

        if loan and loan.get("identity_verified"):
            return {
                "verified": True,
                "verification_session_id": loan.get("verification_session_id"),
                "verified_at": loan.get("identity_verified_at"),
            }

        return {"verified": False, "verification_session_id": None}

    except Exception as e:
        return {"verified": False, "error": str(e)}


@router.post("/confirm/{session_id}")
async def confirm_verification(session_id: str, data: dict):
    """
    Called after successful verification to update the loan record.
    """
    try:
        # Verify the session is actually verified with Stripe
        session = stripe.identity.VerificationSession.retrieve(session_id)

        if session.status != "verified":
            raise HTTPException(
                status_code=400,
                detail=f"Session not verified. Status: {session.status}"
            )

        loan_id = data.get("loan_id")
        if not loan_id:
            raise HTTPException(status_code=400, detail="loan_id required")

        from motor.motor_asyncio import AsyncIOMotorClient
        from datetime import datetime
        from bson import ObjectId

        MONGO_URL = os.getenv("MONGO_URL")
        client = AsyncIOMotorClient(MONGO_URL)
        db = client["taxportal"]

        # Update loan with verification info
        update_filter = {"_id": loan_id}
        try:
            update_filter_oid = {"_id": ObjectId(loan_id)}
        except:
            update_filter_oid = update_filter

        update_data = {
            "$set": {
                "identity_verified": True,
                "verification_session_id": session_id,
                "identity_verified_at": datetime.utcnow().isoformat(),
                "identity_verification_status": "verified",
            }
        }

        result = await db.regulated_loans.update_one(update_filter, update_data)
        if result.modified_count == 0:
            result = await db.regulated_loans.update_one(update_filter_oid, update_data)

        # ═══ ALSO mark the USER profile as identity_verified (persists across loans) ═══
        loan_doc = await db.regulated_loans.find_one(update_filter) or await db.regulated_loans.find_one(update_filter_oid)
        if loan_doc:
            user_id = loan_doc.get("user_id")
            if user_id:
                user_filter = {"_id": user_id}
                try:
                    user_filter_oid = {"_id": ObjectId(user_id)}
                except:
                    user_filter_oid = user_filter
                user_update = {"$set": {
                    "identity_verified": True,
                    "identity_verified_at": datetime.utcnow().isoformat(),
                    "identity_session_id": session_id,
                }}
                ures = await db.users.update_one(user_filter, user_update)
                if ures.modified_count == 0:
                    await db.users.update_one(user_filter_oid, user_update)
                logger.info(f"✅ User {user_id} marked as identity_verified")

        return {
            "success": True,
            "message": "Identity verified and loan updated",
            "verified_at": datetime.utcnow().isoformat(),
        }

    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ═══════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════

@router.get("/admin/verifications")
async def admin_list_verifications(limit: int = 50, status: str = None):
    """
    Admin: List all Stripe Identity verification sessions.
    Returns session details including extracted document data.
    """
    try:
        params = {"limit": min(limit, 100)}
        if status:
            params["status"] = status

        sessions = stripe.identity.VerificationSession.list(**params)

        results = []
        for s in sessions.data:
            item = {
                "id": s.id,
                "status": s.status,
                "type": s.type,
                "created": s.created,
                "client_reference_id": s.client_reference_id,
                "metadata": dict(s.metadata) if s.metadata else {},
                "last_error": None,
                "verified_outputs": None,
                "document_data": None,
                "selfie_data": None,
            }

            if s.last_error:
                item["last_error"] = {
                    "code": s.last_error.get("code"),
                    "reason": s.last_error.get("reason"),
                }

            # Get detailed info for verified sessions
            if s.status == "verified" and s.last_verification_report:
                try:
                    report = stripe.identity.VerificationReport.retrieve(s.last_verification_report)

                    # Document data (name, DOB, ID number, etc.)
                    if report.document:
                        doc = report.document
                        item["document_data"] = {
                            "status": doc.status,
                            "first_name": doc.first_name,
                            "last_name": doc.last_name,
                            "dob": {
                                "day": doc.dob.day if doc.dob else None,
                                "month": doc.dob.month if doc.dob else None,
                                "year": doc.dob.year if doc.dob else None,
                            } if doc.dob else None,
                            "id_number": doc.id_number,
                            "document_type": doc.type,
                            "issuing_country": doc.issuing_country,
                            "expiration_date": {
                                "day": doc.expiration_date.day if doc.expiration_date else None,
                                "month": doc.expiration_date.month if doc.expiration_date else None,
                                "year": doc.expiration_date.year if doc.expiration_date else None,
                            } if doc.expiration_date else None,
                            "address": {
                                "line1": doc.address.line1 if doc.address else None,
                                "city": doc.address.city if doc.address else None,
                                "state": doc.address.state if doc.address else None,
                                "postal_code": doc.address.postal_code if doc.address else None,
                            } if doc.address else None,
                        }
                        # Document images
                        if doc.files:
                            item["document_data"]["front_image"] = doc.files[0] if len(doc.files) > 0 else None
                            item["document_data"]["back_image"] = doc.files[1] if len(doc.files) > 1 else None

                    # Selfie data
                    if report.selfie:
                        item["selfie_data"] = {
                            "status": report.selfie.status,
                            "document_match": getattr(report.selfie, 'document', None),
                            "selfie_image": report.selfie.selfie if hasattr(report.selfie, 'selfie') else None,
                        }

                except Exception as e:
                    item["report_error"] = str(e)

            results.append(item)

        return {
            "verifications": results,
            "total": len(results),
            "has_more": sessions.has_more,
        }

    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.get("/admin/verification/{session_id}")
async def admin_get_verification_detail(session_id: str):
    """
    Admin: Get detailed verification info including document images.
    """
    try:
        session = stripe.identity.VerificationSession.retrieve(
            session_id,
            expand=["last_verification_report"]
        )

        result = {
            "id": session.id,
            "status": session.status,
            "type": session.type,
            "created": session.created,
            "metadata": dict(session.metadata) if session.metadata else {},
            "url": session.url,
            "document_data": None,
            "selfie_data": None,
            "last_error": None,
        }

        if session.last_error:
            result["last_error"] = {
                "code": session.last_error.get("code"),
                "reason": session.last_error.get("reason"),
            }

        # Get verification report
        report = session.last_verification_report
        if report and hasattr(report, 'document'):
            doc = report.document
            if doc:
                result["document_data"] = {
                    "status": doc.status,
                    "first_name": doc.first_name,
                    "last_name": doc.last_name,
                    "dob": f"{doc.dob.month}/{doc.dob.day}/{doc.dob.year}" if doc.dob else None,
                    "id_number": doc.id_number,
                    "document_type": doc.type,
                    "issuing_country": doc.issuing_country,
                    "expiration_date": f"{doc.expiration_date.month}/{doc.expiration_date.day}/{doc.expiration_date.year}" if doc.expiration_date else None,
                    "address": f"{doc.address.line1}, {doc.address.city}, {doc.address.state} {doc.address.postal_code}" if doc.address and doc.address.line1 else None,
                }

            if report.selfie:
                result["selfie_data"] = {
                    "status": report.selfie.status,
                }

        return result

    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.post("/admin/cancel/{session_id}")
async def admin_cancel_verification(session_id: str):
    """
    Admin: Cancel a pending verification session.
    """
    try:
        session = stripe.identity.VerificationSession.cancel(session_id)
        return {"success": True, "status": session.status}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
