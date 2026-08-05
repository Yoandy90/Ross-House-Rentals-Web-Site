"""
CAB (Credit Access Business) API Endpoints
Full CRUD for CAB loan management, payments, trust account, contracts, and OCCC reports.
"""

import os
import logging
import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from cab_service import CABService
from cab_contracts_pdf import generate_all_contracts, generate_occc_report_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cab", tags=["CAB Loans"])

# Dependencies
db = None
get_current_user = None
require_admin = None
cab_service: Optional[CABService] = None


def init_cab_endpoints(database, auth_func, admin_func):
    """Initialize CAB endpoints with database and auth"""
    global db, get_current_user, require_admin, cab_service
    db = database
    get_current_user = auth_func
    require_admin = admin_func
    cab_service = CABService(database)
    logger.info("✅ CAB Endpoints initialized")


async def _admin_dep(authorization: Optional[str] = Header(None)):
    """Admin dependency wrapper - forwards auth header"""
    return await require_admin(authorization)


async def _user_dep(authorization: Optional[str] = Header(None)):
    """User dependency wrapper - forwards auth header"""
    return await get_current_user(authorization)


# ═══════════════════════════════════════════════
# Request Models
# ═══════════════════════════════════════════════

class CreateLoanRequest(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    client_phone: str = ""
    client_address: str = ""
    loan_amount: float
    cab_fee_percent: float = 20.0
    term_months: int = 3
    lender_interest_annual: float = 10.0
    lender_name: str = ""
    payment_frequency: str = "monthly"
    start_date: str = ""
    ssn_last4: str = ""
    filing_status: str = ""
    employment_status: str = ""
    monthly_income: float = 0


class RecordPaymentRequest(BaseModel):
    amount: float
    payment_method: str = "cash"
    reference: str = ""


class RemitToLenderRequest(BaseModel):
    loan_id: str = ""
    lender_name: str = ""
    amount: float = 0
    reference: str = ""


class UpdateStatusRequest(BaseModel):
    status: str
    note: str = ""


class AddNoteRequest(BaseModel):
    note: str


class CreateLenderRequest(BaseModel):
    name: str
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    interest_rate_annual: float = 10.0
    max_loan_amount: float = 5000.0
    min_loan_amount: float = 100.0
    loan_types: list = []  # ["payday", "title"]
    notes: str = ""


class UpdateLenderRequest(BaseModel):
    name: str = ""
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    interest_rate_annual: float = 0
    max_loan_amount: float = 0
    min_loan_amount: float = 0
    loan_types: list = []
    notes: str = ""
    active: bool = True


# ═══════════════════════════════════════════════
# Admin Endpoints — Lenders (Prestamistas)
# ═══════════════════════════════════════════════

@router.get("/admin/lenders")
async def list_lenders(user=Depends(_admin_dep)):
    """List all third-party lenders"""
    lenders = []
    cursor = db.cab_lenders.find().sort("name", 1)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        lenders.append(doc)
    return lenders


@router.post("/admin/lenders")
async def create_lender(req: CreateLenderRequest, user=Depends(_admin_dep)):
    """Add a new third-party lender"""
    lender = {
        "name": req.name.strip(),
        "contact_name": req.contact_name.strip(),
        "contact_email": req.contact_email.strip(),
        "contact_phone": req.contact_phone.strip(),
        "interest_rate_annual": req.interest_rate_annual,
        "max_loan_amount": req.max_loan_amount,
        "min_loan_amount": req.min_loan_amount,
        "loan_types": req.loan_types or ["payday", "title"],
        "notes": req.notes.strip(),
        "active": True,
        "total_loans": 0,
        "total_amount_originated": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = await db.cab_lenders.insert_one(lender)
    lender["id"] = str(result.inserted_id)
    lender.pop("_id", None)
    return lender


@router.put("/admin/lenders/{lender_id}")
async def update_lender(lender_id: str, req: UpdateLenderRequest, user=Depends(_admin_dep)):
    """Update a lender"""
    update_fields = {"updated_at": datetime.utcnow().isoformat()}
    data = req.dict(exclude_unset=True)
    for key, val in data.items():
        if key == "name" and val:
            update_fields["name"] = val.strip()
        elif key in ("contact_name", "contact_email", "contact_phone", "notes") and val:
            update_fields[key] = val.strip() if isinstance(val, str) else val
        elif key in ("interest_rate_annual", "max_loan_amount", "min_loan_amount") and val > 0:
            update_fields[key] = val
        elif key == "loan_types" and val:
            update_fields["loan_types"] = val
        elif key == "active":
            update_fields["active"] = val
    result = await db.cab_lenders.update_one({"_id": ObjectId(lender_id)}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lender not found")
    return {"success": True, "message": "Lender updated"}


@router.delete("/admin/lenders/{lender_id}")
async def delete_lender(lender_id: str, user=Depends(_admin_dep)):
    """Delete a lender"""
    # Check if lender has loans
    lender = await db.cab_lenders.find_one({"_id": ObjectId(lender_id)})
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    loan_count = await db.cab_loans.count_documents({"lender_name": lender.get("name", "")})
    if loan_count > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: tiene {loan_count} préstamos asociados. Desactívelo en su lugar.")
    await db.cab_lenders.delete_one({"_id": ObjectId(lender_id)})
    return {"success": True, "message": "Lender deleted"}


# ═══════════════════════════════════════════════
# Admin Endpoints — Loans
# ═══════════════════════════════════════════════

@router.get("/admin/dashboard")
async def cab_dashboard(user=Depends(_admin_dep)):
    """Get CAB dashboard with stats"""
    return await cab_service.get_dashboard()


@router.get("/admin/loans")
async def list_loans(
    page: int = 1, limit: int = 20, status: str = "", search: str = "",
    user=Depends(_admin_dep)
):
    """List all CAB loans"""
    return await cab_service.list_loans(page=page, limit=limit, status=status, search=search)


@router.get("/admin/loans/{loan_id}")
async def get_loan(loan_id: str, user=Depends(_admin_dep)):
    """Get single loan details"""
    loan = await cab_service.get_loan(loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.post("/admin/loans")
async def create_loan(data: CreateLoanRequest, user=Depends(_admin_dep)):
    """Create a new CAB loan"""
    try:
        result = await cab_service.create_loan(
            client_id=data.client_id,
            client_name=data.client_name,
            client_email=data.client_email,
            client_phone=data.client_phone,
            client_address=data.client_address,
            loan_amount=data.loan_amount,
            cab_fee_percent=data.cab_fee_percent,
            term_months=data.term_months,
            lender_interest_annual=data.lender_interest_annual,
            lender_name=data.lender_name,
            payment_frequency=data.payment_frequency,
            start_date=data.start_date,
            ssn_last4=data.ssn_last4,
            filing_status=data.filing_status,
            employment_status=data.employment_status,
            monthly_income=data.monthly_income,
            admin_id=str(user.get("_id", "")),
            admin_name=user.get("name", "Admin"),
        )
        return result
    except Exception as e:
        logger.error(f"Error creating CAB loan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/loans/{loan_id}")
async def delete_loan(loan_id: str, user=Depends(_admin_dep)):
    """Delete a CAB loan"""
    result = await db.cab_loans.delete_one({"_id": ObjectId(loan_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Loan not found")
    # Also delete related payments and trust entries
    await db.cab_payments.delete_many({"loan_id": loan_id})
    await db.cab_trust_account.delete_many({"loan_id": loan_id})
    return {"success": True, "message": "Loan and related records deleted"}


# ═══════════════════════════════════════════════
# Admin Endpoints — Payments
# ═══════════════════════════════════════════════

@router.post("/admin/loans/{loan_id}/payment")
async def record_payment(loan_id: str, data: RecordPaymentRequest, user=Depends(_admin_dep)):
    """Record a payment for a CAB loan"""
    try:
        result = await cab_service.record_payment(
            loan_id=loan_id,
            amount=data.amount,
            payment_method=data.payment_method,
            reference=data.reference,
            admin_id=str(user.get("_id", "")),
            admin_name=user.get("name", "Admin"),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error recording payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/loans/{loan_id}/payments")
async def get_payment_history(loan_id: str, user=Depends(_admin_dep)):
    """Get payment history for a loan"""
    payments = await cab_service.get_payment_history(loan_id)
    return {"payments": payments, "count": len(payments)}


# ═══════════════════════════════════════════════
# Admin Endpoints — Trust Account
# ═══════════════════════════════════════════════

@router.get("/admin/trust-account")
async def get_trust_summary(user=Depends(_admin_dep)):
    """Get trust account summary"""
    return await cab_service.get_trust_summary()


@router.post("/admin/trust-account/remit")
async def remit_to_lender(data: RemitToLenderRequest, user=Depends(_admin_dep)):
    """Remit funds to third-party lender"""
    try:
        result = await cab_service.remit_to_lender(
            loan_id=data.loan_id,
            lender_name=data.lender_name,
            amount=data.amount,
            reference=data.reference,
            admin_id=str(user.get("_id", "")),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/trust-account/entries")
async def get_trust_entries(
    status: str = "", limit: int = 50,
    user=Depends(_admin_dep)
):
    """Get trust account entries"""
    query = {}
    if status:
        query["status"] = status
    entries = await db.cab_trust_account.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [{
        "id": str(e["_id"]),
        "loan_id": e.get("loan_id", ""),
        "loan_number": e.get("loan_number", ""),
        "client_name": e.get("client_name", ""),
        "lender_name": e.get("lender_name", ""),
        "amount": e.get("amount", 0),
        "type": e.get("type", ""),
        "status": e.get("status", ""),
        "payment_number": e.get("payment_number", ""),
        "date": e.get("created_at").strftime("%m/%d/%Y") if e.get("created_at") else "",
    } for e in entries]


# ═══════════════════════════════════════════════
# Admin Endpoints — Status & Notes
# ═══════════════════════════════════════════════

@router.put("/admin/loans/{loan_id}/status")
async def update_loan_status(loan_id: str, data: UpdateStatusRequest, user=Depends(_admin_dep)):
    """Update loan status"""
    try:
        return await cab_service.update_status(loan_id, data.status, data.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/loans/{loan_id}")
async def update_loan(loan_id: str, request: Request, user=Depends(_admin_dep)):
    """Update loan details (client info, lender, notes, etc.)"""
    data = await request.json()
    loan = await cab_service.get_loan(loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    update_fields = {"updated_at": datetime.utcnow()}
    editable = ['client_name', 'client_email', 'client_phone', 'client_address', 'lender_name']
    for f in editable:
        if f in data:
            update_fields[f] = data[f]

    if 'cab_fee_percent' in data:
        update_fields['cab_fee_percent'] = float(data['cab_fee_percent'])
    if 'lender_interest_annual' in data:
        update_fields['lender_interest_annual'] = float(data['lender_interest_annual'])

    await db.cab_loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update_fields})
    return {"success": True, "message": "Préstamo actualizado exitosamente"}


@router.post("/admin/loans/{loan_id}/note")
async def add_note(loan_id: str, data: AddNoteRequest, user=Depends(_admin_dep)):
    """Add a note to a loan"""
    return await cab_service.add_note(loan_id, data.note, user.get("name", "Admin"))


# ═══════════════════════════════════════════════
# Admin Endpoints — Contracts & Documents
# ═══════════════════════════════════════════════

@router.post("/admin/loans/{loan_id}/generate-contracts")
async def generate_contracts(loan_id: str, user=Depends(_admin_dep)):
    """Generate all 5 legal contracts for a CAB loan"""
    try:
        loan = await cab_service.get_loan(loan_id)
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        # Generate all contracts
        output_dir = f"/tmp/cab_contracts_{loan_id}"
        os.makedirs(output_dir, exist_ok=True)
        paths = generate_all_contracts(loan, output_dir)

        # Store contract references in DB
        contract_ids = []
        for doc_type, path in paths.items():
            with open(path, 'rb') as f:
                pdf_data = f.read()

            contract_doc = {
                "loan_id": loan_id,
                "loan_number": loan.get("loan_number"),
                "client_name": loan.get("client_name"),
                "document_type": doc_type,
                "file_name": os.path.basename(path),
                "pdf_base64": base64.b64encode(pdf_data).decode('utf-8'),
                "generated_at": datetime.now(),
            }
            result = await db.cab_contracts.insert_one(contract_doc)
            contract_ids.append(str(result.inserted_id))

        # Mark contracts as generated
        await db.cab_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "contracts_generated": True,
                "contract_ids": contract_ids,
                "updated_at": datetime.now(),
            }}
        )

        # AUTO-SEND contracts via email to client
        try:
            client_email = loan.get("client_email", "")
            client_name = loan.get("client_name", "")
            if client_email:
                await _send_contracts_email(client_email, client_name, loan, paths)
                logger.info(f"📧 Contracts emailed to {client_email}")
        except Exception as email_err:
            logger.warning(f"Email send failed (non-blocking): {email_err}")

        return {
            "success": True,
            "contracts": list(paths.keys()),
            "count": len(paths),
            "contract_ids": contract_ids,
            "emailed_to": loan.get("client_email", ""),
        }
    except Exception as e:
        logger.error(f"Error generating contracts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/loans/{loan_id}/contracts")
async def list_contracts(loan_id: str, user=Depends(_admin_dep)):
    """List all contracts for a loan"""
    contracts = await db.cab_contracts.find(
        {"loan_id": loan_id}, {"pdf_base64": 0}
    ).to_list(20)

    return [{
        "id": str(c["_id"]),
        "document_type": c.get("document_type", ""),
        "file_name": c.get("file_name", ""),
        "generated_at": c.get("generated_at").strftime("%m/%d/%Y %H:%M") if c.get("generated_at") else "",
    } for c in contracts]


@router.get("/admin/contracts/{contract_id}/download")
async def download_contract(contract_id: str, user=Depends(_admin_dep)):
    """Download a specific contract PDF"""
    contract = await db.cab_contracts.find_one({"_id": ObjectId(contract_id)})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    pdf_data = base64.b64decode(contract.get("pdf_base64", ""))
    file_name = contract.get("file_name", "contract.pdf")
    temp_path = f"/tmp/{file_name}"

    with open(temp_path, 'wb') as f:
        f.write(pdf_data)

    return FileResponse(temp_path, media_type="application/pdf", filename=file_name)


# ═══════════════════════════════════════════════
# Admin Endpoints — OCCC Reports
# ═══════════════════════════════════════════════

@router.get("/admin/occc-report")
async def get_occc_report(year: int = 0, quarter: int = 0, user=Depends(_admin_dep)):
    """Generate OCCC quarterly or annual report data"""
    return await cab_service.generate_occc_report(year, quarter)


@router.get("/admin/occc-report/pdf")
async def download_occc_report(year: int = 0, quarter: int = 0, user=Depends(_admin_dep)):
    """Download OCCC report as PDF"""
    report_data = await cab_service.generate_occc_report(year, quarter)
    pdf_path = generate_occc_report_pdf(report_data)
    q_label = f"Q{quarter}_" if quarter else "Annual_"
    return FileResponse(pdf_path, media_type="application/pdf",
                       filename=f"OCCC_Report_{q_label}{report_data.get('report_year', '')}.pdf")


# ═══════════════════════════════════════════════
# Admin Endpoints — Clients Search
# ═══════════════════════════════════════════════

@router.get("/admin/clients-search")
async def search_clients(search: str = "", user=Depends(_admin_dep)):
    """Search clients for creating new CAB loans"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    clients = await db.users.find(query, {
        "_id": 1, "name": 1, "email": 1, "phone": 1, "address": 1
    }).limit(20).to_list(20)

    return [{
        "id": str(c["_id"]),
        "name": c.get("name", ""),
        "email": c.get("email", ""),
        "phone": c.get("phone", ""),
        "address": c.get("address", ""),
    } for c in clients]


# ═══════════════════════════════════════════════
# Client Endpoints
# ═══════════════════════════════════════════════

@router.get("/my-loans")
async def client_my_loans(user=Depends(_user_dep)):
    """Get CAB loans for the current client"""
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loans = await db.cab_loans.find({
            "$or": [{"client_id": user_id}, {"client_email": email}]
        }).sort("created_at", -1).to_list(50)

        return {
            "loans": [cab_service._serialize_loan(loan_doc) for loan_doc in loans],
            "count": len(loans),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client CAB loans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-loans/{loan_id}")
async def client_get_loan(loan_id: str, user=Depends(_user_dep)):
    """Get a specific CAB loan for the current client"""
    try:
        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loan = await db.cab_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [{"client_id": user_id}, {"client_email": email}]
        })
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        return cab_service._serialize_loan(loan)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ClientAutoPayRequest(BaseModel):
    vault_id: str
    payment_method_label: str = ""


@router.put("/my-loans/{loan_id}/auto-pay")
async def client_setup_auto_pay(loan_id: str, data: ClientAutoPayRequest, user=Depends(_user_dep)):
    """Client can enable auto-pay on their own loan using their vault"""
    try:
        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loan = await db.cab_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [{"client_id": user_id}, {"client_email": email}]
        })
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        await db.cab_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "auto_pay": True,
                "vault_id": data.vault_id,
                "auto_pay_method": data.payment_method_label or f"Vault {data.vault_id[:8]}...",
                "updated_at": datetime.now(),
            }}
        )
        logger.info(f"🔄 Client auto-pay enabled for {loan.get('loan_number')}")
        return {"success": True, "message": "Auto-pay activado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/my-loans/{loan_id}/auto-pay")
async def client_disable_auto_pay(loan_id: str, user=Depends(_user_dep)):
    """Client can disable auto-pay on their own loan"""
    try:
        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loan = await db.cab_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [{"client_id": user_id}, {"client_email": email}]
        })
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        await db.cab_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {"auto_pay": False, "vault_id": None, "auto_pay_method": None, "updated_at": datetime.now()}}
        )
        return {"success": True, "message": "Auto-pay desactivado"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-loans/{loan_id}/contracts")
async def client_get_contracts(loan_id: str, user=Depends(_user_dep)):
    """Client can view their loan contracts"""
    try:
        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loan = await db.cab_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [{"client_id": user_id}, {"client_email": email}]
        })
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        contracts = await db.cab_contracts.find(
            {"loan_id": loan_id}, {"pdf_base64": 0}
        ).to_list(20)

        return {
            "contracts": [{
                "id": str(c["_id"]),
                "document_type": c.get("document_type", ""),
                "file_name": c.get("file_name", ""),
                "generated_at": c.get("generated_at").strftime("%m/%d/%Y") if c.get("generated_at") else "",
            } for c in contracts],
            "count": len(contracts),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-loans/{loan_id}/contracts/{contract_id}/download")
async def client_download_contract(loan_id: str, contract_id: str, user=Depends(_user_dep)):
    """Client can download a specific contract PDF"""
    try:
        email = user.get("email", "")
        user_id = str(user.get("_id", ""))

        loan = await db.cab_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [{"client_id": user_id}, {"client_email": email}]
        })
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        contract = await db.cab_contracts.find_one({"_id": ObjectId(contract_id), "loan_id": loan_id})
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")

        pdf_data = base64.b64decode(contract.get("pdf_base64", ""))
        file_name = contract.get("file_name", "contract.pdf")
        temp_path = f"/tmp/{file_name}"

        with open(temp_path, 'wb') as f:
            f.write(pdf_data)

        return FileResponse(temp_path, media_type="application/pdf", filename=file_name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-payment-methods")
async def client_payment_methods(user=Depends(_user_dep)):
    """Get client's saved payment methods from NMI vault for auto-pay selection"""
    try:
        user_id = str(user.get("_id", "")) if user.get("_id") else user.get("id", "")

        methods = await db.payment_methods.find({
            "user_id": user_id,
            "active": {"$ne": False},
        }).to_list(20)

        return {
            "methods": [{
                "id": str(m["_id"]),
                "vault_id": m.get("nmi_vault_id", m.get("vault_id", "")),
                "type": m.get("type", "card"),
                "label": m.get("label", ""),
                "card_last4": m.get("card_last4", m.get("last4", "")),
                "card_brand": m.get("card_brand", m.get("brand", "")),
                "bank_name": m.get("bank_name", ""),
                "is_default": m.get("is_default", False),
            } for m in methods],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════
# CRON: Daily Auto-Pay Processing
# ═══════════════════════════════════════════════

@router.post("/admin/process-auto-payments")
async def process_auto_payments(user=Depends(_admin_dep)):
    """Process auto-pay for all active loans with due payments today (admin/cron trigger)"""
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("America/New_York"))
        today_str = now.strftime("%m/%d/%Y")

        active_loans = await db.cab_loans.find({
            "status": "active",
            "auto_pay": True,
            "vault_id": {"$ne": None},
        }).to_list(500)

        processed = 0
        failed = 0

        for loan in active_loans:
            for p in loan.get("payment_schedule", []):
                if p.get("status") != "pending":
                    continue

                due_date = p.get("due_date")
                if isinstance(due_date, datetime):
                    due_str = due_date.strftime("%m/%d/%Y")
                else:
                    due_str = str(due_date)

                if due_str == today_str:
                    # This payment is due today - attempt charge
                    try:
                        from merchant_one_service import MERCHANT_ONE_SECURITY_KEY
                        import httpx
                        amount = p.get("total_amount", 0)
                        vault_id = loan.get("vault_id")

                        async with httpx.AsyncClient() as client:
                            payload = {
                                'security_key': MERCHANT_ONE_SECURITY_KEY,
                                'customer_vault_id': vault_id,
                                'amount': f"{amount:.2f}",
                                'type': 'sale',
                                'order_description': f"CAB Loan {loan.get('loan_number')} - Payment #{p.get('payment_number')}",
                            }
                            response = await client.post(
                                'https://secure.merchantonegateway.com/api/transact.php',
                                data=payload, timeout=30
                            )
                            from urllib.parse import parse_qs
                            parsed = parse_qs(response.text, keep_blank_values=True)
                            result = {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}

                            if result.get('response') == '1':
                                await cab_service.record_payment(
                                    loan_id=str(loan["_id"]),
                                    amount=amount,
                                    payment_method="auto_pay",
                                    reference=f"NMI TXN {result.get('transactionid', '')}",
                                    admin_id="cron_auto_pay",
                                    admin_name="Auto-Pay CRON",
                                )
                                processed += 1

                                # Notify client
                                client_user = await db.users.find_one({"email": loan.get("client_email")})
                                if client_user and client_user.get("push_token"):
                                    await _send_push_notification(
                                        client_user["push_token"],
                                        "💳 Pago Automático Procesado",
                                        f"Se cobró ${amount:.2f} de tu préstamo {loan.get('loan_number')}",
                                        {"type": "cab_auto_pay", "loan_id": str(loan["_id"])}
                                    )
                            else:
                                failed += 1
                                logger.warning(f"Auto-pay failed for {loan.get('loan_number')}: {result.get('responsetext')}")
                    except Exception as charge_err:
                        failed += 1
                        logger.error(f"Auto-pay charge error for {loan.get('loan_number')}: {charge_err}")
                    break

        return {"success": True, "processed": processed, "failed": failed}
    except Exception as e:
        logger.error(f"Process auto-payments error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════
# AUTO-PAY with NMI Customer Vault
# ═══════════════════════════════════════════════

class SetupAutoPayRequest(BaseModel):
    vault_id: str
    payment_method_label: str = ""  # e.g., "Visa ending 4242"


@router.put("/admin/loans/{loan_id}/auto-pay")
async def setup_auto_pay(loan_id: str, data: SetupAutoPayRequest, user=Depends(_admin_dep)):
    """Setup auto-pay for a CAB loan using NMI Customer Vault"""
    try:
        loan = await db.cab_loans.find_one({"_id": ObjectId(loan_id)})
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        await db.cab_loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "auto_pay": True,
                "vault_id": data.vault_id,
                "auto_pay_method": data.payment_method_label or f"Vault {data.vault_id[:8]}...",
                "updated_at": datetime.now(),
            }}
        )

        logger.info(f"🔄 Auto-pay enabled for {loan.get('loan_number')} with vault {data.vault_id[:8]}...")
        return {"success": True, "message": "Auto-pay configurado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/loans/{loan_id}/auto-pay")
async def disable_auto_pay(loan_id: str, user=Depends(_admin_dep)):
    """Disable auto-pay for a CAB loan"""
    await db.cab_loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": {"auto_pay": False, "vault_id": None, "auto_pay_method": None, "updated_at": datetime.now()}}
    )
    return {"success": True, "message": "Auto-pay desactivado"}


@router.post("/admin/loans/{loan_id}/charge-auto-pay")
async def charge_auto_pay(loan_id: str, user=Depends(_admin_dep)):
    """Manually trigger an auto-pay charge for a CAB loan using NMI vault"""
    try:
        from merchant_one_service import MERCHANT_ONE_SECURITY_KEY
        
        loan = await db.cab_loans.find_one({"_id": ObjectId(loan_id)})
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        if not loan.get("vault_id"):
            raise HTTPException(status_code=400, detail="No vault_id configured for auto-pay")
        if not loan.get("auto_pay"):
            raise HTTPException(status_code=400, detail="Auto-pay is not enabled")

        # Find next pending payment
        schedule = loan.get("payment_schedule", [])
        next_payment = None
        for p in schedule:
            if p.get("status") == "pending":
                next_payment = p
                break

        if not next_payment:
            raise HTTPException(status_code=400, detail="No pending payments")

        amount = next_payment.get("total_amount", 0)
        vault_id = loan.get("vault_id")

        # Charge the vault via NMI
        import httpx
        async with httpx.AsyncClient() as client:
            payload = {
                'security_key': MERCHANT_ONE_SECURITY_KEY,
                'customer_vault_id': vault_id,
                'amount': f"{amount:.2f}",
                'type': 'sale',
                'order_description': f"CAB Loan {loan.get('loan_number')} - Payment #{next_payment.get('payment_number')}",
            }
            response = await client.post(
                'https://secure.merchantonegateway.com/api/transact.php',
                data=payload, timeout=30
            )
            
            from urllib.parse import parse_qs
            parsed = parse_qs(response.text, keep_blank_values=True)
            result = {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}
            
            if result.get('response') == '1':
                # Success - record the payment
                payment_result = await cab_service.record_payment(
                    loan_id=loan_id,
                    amount=amount,
                    payment_method="auto_pay",
                    reference=f"NMI TXN {result.get('transactionid', '')}",
                    admin_id="auto_pay",
                    admin_name="Auto-Pay System",
                )
                
                logger.info(f"✅ Auto-pay charged ${amount:.2f} for {loan.get('loan_number')}")
                
                # Send push notification to client
                try:
                    client_user = await db.users.find_one({"email": loan.get("client_email")})
                    if client_user and client_user.get("push_token"):
                        from notification_service import NotificationService
                        # Use global notification service
                        await _send_push_notification(
                            client_user["push_token"],
                            "💳 Pago Automático Procesado",
                            f"Se cobró ${amount:.2f} de tu préstamo {loan.get('loan_number')}",
                            {"type": "cab_auto_pay", "loan_id": loan_id}
                        )
                except Exception as notif_err:
                    logger.warning(f"Push notification failed: {notif_err}")
                
                return {"success": True, "transaction_id": result.get('transactionid'), **payment_result}
            else:
                error_msg = result.get('responsetext', 'Charge failed')
                logger.error(f"❌ Auto-pay failed for {loan.get('loan_number')}: {error_msg}")
                return {"success": False, "error": error_msg}
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auto-pay charge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════
# Payment Due Reminder Notifications
# ═══════════════════════════════════════════════

@router.post("/admin/send-payment-reminders")
async def send_payment_reminders(user=Depends(_admin_dep)):
    """Send push notifications for payments due in the next 3 days"""
    try:
        from zoneinfo import ZoneInfo
        from datetime import timedelta
        
        now = datetime.now(ZoneInfo("America/New_York"))
        reminder_window = now + timedelta(days=3)
        
        active_loans = await db.cab_loans.find({"status": "active"}).to_list(500)
        sent_count = 0
        
        for loan in active_loans:
            for p in loan.get("payment_schedule", []):
                if p.get("status") != "pending":
                    continue
                    
                due_date = p.get("due_date")
                if not due_date:
                    continue
                if isinstance(due_date, datetime):
                    if due_date.tzinfo is None:
                        due_date = due_date.replace(tzinfo=ZoneInfo("America/New_York"))
                    
                    if now <= due_date <= reminder_window:
                        # This payment is due soon - send reminder
                        client_user = await db.users.find_one({"email": loan.get("client_email")})
                        if client_user and client_user.get("push_token"):
                            days_until = (due_date - now).days
                            amount = p.get("total_amount", 0)
                            
                            await _send_push_notification(
                                client_user["push_token"],
                                f"⏰ Pago en {days_until} día{'s' if days_until != 1 else ''}",
                                f"Tu pago de ${amount:,.2f} para préstamo {loan.get('loan_number')} vence el {due_date.strftime('%m/%d')}",
                                {"type": "cab_payment_reminder", "loan_id": str(loan["_id"])}
                            )
                            sent_count += 1
                        break  # Only send for the next pending payment
        
        return {"success": True, "reminders_sent": sent_count}
    except Exception as e:
        logger.error(f"Error sending reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════

async def _send_contracts_email(client_email: str, client_name: str, loan: dict, contract_paths: dict):
    """Send all generated contracts to the client via SendGrid"""
    import base64 as b64
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    from dotenv import load_dotenv
    load_dotenv()
    
    SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
    FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
    
    if not SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not configured, skipping email")
        return
    
    loan_number = loan.get('loan_number', '')
    loan_amount = loan.get('loan_amount', 0)
    
    doc_labels = {
        "cab_agreement": "Acuerdo de Servicios CAB",
        "promissory_note": "Pagaré (Promissory Note)",
        "disclosure": "Declaración de Divulgación",
        "cancel_notice": "Aviso de Derecho a Cancelar",
        "payment_schedule": "Calendario de Pagos",
    }
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=client_email,
        subject=f'📋 Documentos de Préstamo {loan_number} — Ross Tax',
        html_content=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #065F46, #10B981); padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Ross Tax Preparation</h1>
                <p style="color: #d1fae5; margin: 5px 0 0;">Documentos de Préstamo</p>
            </div>
            <div style="background: #fff; padding: 25px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Hola {client_name},</h2>
                <p style="color: #4a5568;">Adjuntos están los documentos legales de tu préstamo:</p>
                <div style="background: #f7fafc; border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><b>Préstamo:</b> {loan_number}</p>
                    <p style="margin: 5px 0;"><b>Monto:</b> ${loan_amount:,.2f}</p>
                    <p style="margin: 5px 0;"><b>Pago Mensual:</b> ${loan.get('monthly_payment', 0):,.2f}</p>
                </div>
                <p style="color: #4a5568;">Documentos adjuntos:</p>
                <ul style="color: #4a5568;">
                    {''.join(f'<li>📄 {doc_labels.get(k, k)}</li>' for k in contract_paths.keys())}
                </ul>
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px;">
                    <p style="color: #92400e; margin: 0; font-size: 13px;">
                        <b>Importante:</b> Tienes 3 días hábiles para cancelar este acuerdo sin penalidad.
                        Ver el documento "Aviso de Derecho a Cancelar" adjunto.
                    </p>
                </div>
            </div>
            <div style="background: #f7fafc; padding: 12px; text-align: center; border-radius: 0 0 10px 10px;">
                <p style="color: #a0aec0; font-size: 11px; margin: 0;">Ross Tax Preparation — Confidencial</p>
            </div>
        </div>
        """
    )
    
    # Attach all PDFs
    for doc_type, file_path in contract_paths.items():
        with open(file_path, 'rb') as f:
            pdf_data = f.read()
        
        attachment = Attachment()
        attachment.file_content = FileContent(b64.b64encode(pdf_data).decode('utf-8'))
        attachment.file_name = FileName(os.path.basename(file_path))
        attachment.file_type = FileType('application/pdf')
        attachment.disposition = Disposition('attachment')
        message.add_attachment(attachment)
    
    sg = SendGridAPIClient(SENDGRID_API_KEY)
    response = sg.send(message)
    logger.info(f"📧 Contracts emailed to {client_email} — Status: {response.status_code}")


async def _send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo"""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "to": push_token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
            }
            await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=payload,
                timeout=10
            )
    except Exception as e:
        logger.warning(f"Push notification error: {e}")
