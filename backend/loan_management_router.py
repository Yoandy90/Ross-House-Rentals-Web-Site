"""
Loan Management Router - Préstamos Personales ($200-$1,000)

Extracted from server.py to reduce file size and improve maintainability.
Includes: CRUD, Payments, Amortization, CSV Export, PDF Contracts,
           Reminders, Delinquency Checks, Collection Logs, Aging Reports,
           and Client Portal endpoints.
"""
import os
import csv
import io as csv_io
import base64
import math
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

# Router instance
loan_mgmt_router = APIRouter()

# Module-level references (set via init)
_db = None
_get_user_from_token = None


def init_loan_management(db_instance, get_user_func):
    """Initialize the loan management module with dependencies."""
    global _db, _get_user_from_token
    _db = db_instance
    _get_user_from_token = get_user_func
    logger.info("✅ Loan Management Router initialized")


async def _get_db():
    return _db


async def _auth_admin(request: Request):
    """Authenticate and verify admin role."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = await _get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="No autorizado")
    return user


async def _auth_user(request: Request):
    """Authenticate any user."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = await _get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="No autorizado")
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_amortization_schedule(principal: float, annual_rate: float, term_months: int, method: str = "flat", start_date: str = None, payment_frequency: str = "monthly"):
    """Generate amortization schedule based on method.
    
    Methods:
    - flat: Simple flat rate per month (e.g., 20% monthly). Rate IS the monthly rate.
    - french: Standard amortization with fixed payments (rate is annual)
    - german: Fixed principal portions (rate is annual)
    - american: Interest only, principal at end (rate is annual)
    """
    schedule = []
    balance = principal
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now()

    if method == "flat":
        # ═══════════════════════════════════════════════════════
        # FLAT RATE: Simple monthly interest on outstanding balance
        # Rate parameter = monthly rate (e.g., 20 means 20% per month)
        # ═══════════════════════════════════════════════════════
        monthly_rate_pct = annual_rate  # For flat, rate IS the monthly rate
        interest = principal * (monthly_rate_pct / 100)
        total_due = principal + interest

        if payment_frequency == "weekly":
            # Split into 4 weekly payments
            num_payments = 4
            weekly_payment = total_due / num_payments
            for i in range(num_payments):
                due_date = start + timedelta(days=7 * i)
                is_last = (i == num_payments - 1)
                portion_principal = principal / num_payments
                portion_interest = interest / num_payments
                balance -= portion_principal
                if is_last:
                    balance = 0
                schedule.append({
                    "payment_number": i + 1,
                    "due_date": due_date.strftime("%Y-%m-%d"),
                    "payment_amount": round(weekly_payment, 2),
                    "principal": round(portion_principal, 2),
                    "interest": round(portion_interest, 2),
                    "balance": round(max(balance, 0), 2),
                    "frequency": "weekly",
                })
            return {
                "schedule": schedule,
                "total_interest": round(interest, 2),
                "total_to_pay": round(total_due, 2),
                "monthly_payment": round(total_due, 2),
                "weekly_payment": round(weekly_payment, 2),
                "biweekly_payment": round(total_due / 2, 2),
                "payment_frequency": "weekly",
                "num_payments": num_payments,
                "method": "flat",
            }
        elif payment_frequency == "biweekly":
            # Split into 2 biweekly payments (every 2 weeks)
            num_payments = 2
            biweekly_payment = total_due / num_payments
            for i in range(num_payments):
                due_date = start + timedelta(days=14 * i)
                is_last = (i == num_payments - 1)
                portion_principal = principal / num_payments
                portion_interest = interest / num_payments
                balance -= portion_principal
                if is_last:
                    balance = 0
                schedule.append({
                    "payment_number": i + 1,
                    "due_date": due_date.strftime("%Y-%m-%d"),
                    "payment_amount": round(biweekly_payment, 2),
                    "principal": round(portion_principal, 2),
                    "interest": round(portion_interest, 2),
                    "balance": round(max(balance, 0), 2),
                    "frequency": "biweekly",
                })
            return {
                "schedule": schedule,
                "total_interest": round(interest, 2),
                "total_to_pay": round(total_due, 2),
                "monthly_payment": round(total_due, 2),
                "weekly_payment": round(total_due / 4, 2),
                "biweekly_payment": round(biweekly_payment, 2),
                "payment_frequency": "biweekly",
                "num_payments": num_payments,
                "method": "flat",
            }
        else:
            # Single monthly payment
            due_date = start + timedelta(days=30)
            schedule.append({
                "payment_number": 1,
                "due_date": due_date.strftime("%Y-%m-%d"),
                "payment_amount": round(total_due, 2),
                "principal": round(principal, 2),
                "interest": round(interest, 2),
                "balance": 0,
                "frequency": "monthly",
            })
            return {
                "schedule": schedule,
                "total_interest": round(interest, 2),
                "total_to_pay": round(total_due, 2),
                "monthly_payment": round(total_due, 2),
                "weekly_payment": round(total_due / 4, 2),
                "biweekly_payment": round(total_due / 2, 2),
                "payment_frequency": "monthly",
                "num_payments": 1,
                "method": "flat",
            }

    # ═══════════════════════════════════════════════════════════
    # TRADITIONAL METHODS (rate is annual)
    # ═══════════════════════════════════════════════════════════
    monthly_rate = annual_rate / 100 / 12

    if method == "french":
        if monthly_rate > 0:
            monthly_payment = principal * (monthly_rate * (1 + monthly_rate) ** term_months) / ((1 + monthly_rate) ** term_months - 1)
        else:
            monthly_payment = principal / term_months

        for i in range(1, term_months + 1):
            interest = balance * monthly_rate
            principal_portion = monthly_payment - interest
            if i == term_months:
                principal_portion = balance
                monthly_payment = principal_portion + interest
            balance -= principal_portion
            if balance < 0.01:
                balance = 0
            due_date = start + timedelta(days=30 * i)
            schedule.append({
                "payment_number": i,
                "due_date": due_date.strftime("%Y-%m-%d"),
                "payment_amount": round(monthly_payment, 2),
                "principal": round(principal_portion, 2),
                "interest": round(interest, 2),
                "balance": round(max(balance, 0), 2),
            })

    elif method == "german":
        fixed_principal = principal / term_months
        for i in range(1, term_months + 1):
            interest = balance * monthly_rate
            payment = fixed_principal + interest
            if i == term_months:
                fixed_principal = balance
                payment = fixed_principal + interest
            balance -= fixed_principal
            if balance < 0.01:
                balance = 0
            due_date = start + timedelta(days=30 * i)
            schedule.append({
                "payment_number": i,
                "due_date": due_date.strftime("%Y-%m-%d"),
                "payment_amount": round(payment, 2),
                "principal": round(fixed_principal, 2),
                "interest": round(interest, 2),
                "balance": round(max(balance, 0), 2),
            })

    elif method == "american":
        for i in range(1, term_months + 1):
            interest = balance * monthly_rate
            if i == term_months:
                principal_portion = balance
                payment = principal_portion + interest
            else:
                principal_portion = 0
                payment = interest
            balance -= principal_portion
            due_date = start + timedelta(days=30 * i)
            schedule.append({
                "payment_number": i,
                "due_date": due_date.strftime("%Y-%m-%d"),
                "payment_amount": round(payment, 2),
                "principal": round(principal_portion, 2),
                "interest": round(interest, 2),
                "balance": round(max(balance, 0), 2),
            })

    total_interest = sum(p["interest"] for p in schedule)
    total_to_pay = sum(p["payment_amount"] for p in schedule)
    monthly_payment_avg = total_to_pay / term_months if term_months > 0 else 0

    return {
        "schedule": schedule,
        "total_interest": round(total_interest, 2),
        "total_to_pay": round(total_to_pay, 2),
        "monthly_payment": round(monthly_payment_avg, 2),
    }


async def generate_loan_number():
    """Generate sequential loan number: PREST-YYYY-NNN"""
    year = datetime.now().year
    prefix = f"PREST-{year}-"
    last_loan = await _db.loans.find_one(
        {"loan_number": {"$regex": f"^{prefix}"}},
        sort=[("loan_number", -1)]
    )
    if last_loan:
        try:
            last_num = int(last_loan["loan_number"].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    return f"{prefix}{next_num:03d}"


def _serialize_dates(doc: dict, fields: list) -> dict:
    """Convert datetime fields to ISO strings."""
    for field in fields:
        if doc.get(field) and hasattr(doc[field], 'isoformat'):
            doc[field] = doc[field].isoformat()
    return doc


DATE_FIELDS = ['application_date', 'approval_date', 'disbursement_date',
               'first_payment_date', 'maturity_date', 'closed_date',
               'created_at', 'updated_at']

PAYMENT_DATE_FIELDS = ['payment_date', 'due_date', 'created_at']


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ─── POST: Create Loan ──────────────────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans')
async def create_loan(request: Request):
    """Create a new loan application"""
    user = await _auth_admin(request)
    data = await request.json()

    required = ['client_name', 'amount', 'interest_rate', 'term_months']
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo requerido: {field}")

    amount = float(data['amount'])
    interest_rate = float(data['interest_rate'])
    term_months = int(data.get('term_months', 1))
    method = data.get('amortization_method', 'flat')
    payment_frequency = data.get('payment_frequency', 'monthly')

    # Personal loan limits
    MIN_LOAN_AMOUNT = 200
    MAX_LOAN_AMOUNT = 1000

    if amount < MIN_LOAN_AMOUNT or amount > MAX_LOAN_AMOUNT:
        raise HTTPException(status_code=400, detail=f"El monto debe estar entre ${MIN_LOAN_AMOUNT} y ${MAX_LOAN_AMOUNT}")
    if interest_rate < 0 or interest_rate > 50:
        raise HTTPException(status_code=400, detail="La tasa debe estar entre 0% y 50%")
    if method == 'flat':
        term_months = 1  # Flat loans are always 1-month renewable

    amort = generate_amortization_schedule(amount, interest_rate, term_months, method, payment_frequency=payment_frequency)
    loan_number = await generate_loan_number()

    now = datetime.utcnow()
    loan = {
        "loan_number": loan_number,
        "client_id": data.get('client_id'),
        "client_name": data['client_name'],
        "client_email": data.get('client_email', ''),
        "client_phone": data.get('client_phone', ''),
        "client_ssn_last4": data.get('client_ssn_last4', ''),
        "amount": amount,
        "interest_rate": interest_rate,
        "term_months": term_months,
        "purpose": data.get('purpose', ''),
        "amortization_method": method,
        "payment_frequency": payment_frequency,
        "monthly_payment": amort['monthly_payment'],
        "weekly_payment": amort.get('weekly_payment', amort['monthly_payment'] / 4),
        "biweekly_payment": amort.get('biweekly_payment', amort['monthly_payment'] / 2),
        "total_interest": amort['total_interest'],
        "total_to_pay": amort['total_to_pay'],
        "apr": interest_rate,
        "status": data.get('status', 'draft'),
        "application_date": now,
        "approval_date": None,
        "disbursement_date": None,
        "first_payment_date": data.get('first_payment_date'),
        "maturity_date": None,
        "closed_date": None,
        "principal_paid": 0,
        "interest_paid": 0,
        "fees_paid": 0,
        "balance": amount,
        "next_payment_date": data.get('first_payment_date'),
        "next_payment_amount": amort['monthly_payment'],
        "days_overdue": 0,
        "guarantor_name": data.get('guarantor_name', ''),
        "guarantor_phone": data.get('guarantor_phone', ''),
        "guarantor_relationship": data.get('guarantor_relationship', ''),
        "reference1_name": data.get('reference1_name', ''),
        "reference1_phone": data.get('reference1_phone', ''),
        "reference2_name": data.get('reference2_name', ''),
        "reference2_phone": data.get('reference2_phone', ''),
        "notes": data.get('notes', ''),
        "approved_by": None,
        "rejection_reason": None,
        "status_history": [{
            "status": data.get('status', 'draft'),
            "changed_by": user.get('email', 'admin'),
            "changed_at": now.isoformat(),
            "comment": "Préstamo creado"
        }],
        "created_at": now,
        "updated_at": now,
        "created_by": user.get('email', 'admin'),
    }

    result = await _db.loans.insert_one(loan)
    loan['_id'] = str(result.inserted_id)

    return {
        "success": True, 
        "loan_number": loan_number,
        "loan_id": str(result.inserted_id),
        "loan": {**loan, "_id": str(result.inserted_id), "application_date": now.isoformat(), "created_at": now.isoformat(), "updated_at": now.isoformat()}
    }


# ─── GET: List Loans ─────────────────────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans')
async def list_loans(request: Request, status: str = None, search: str = None, page: int = 1, limit: int = 50):
    """List all loans with optional filters"""
    user = await _auth_admin(request)

    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"client_name": {"$regex": search, "$options": "i"}},
            {"loan_number": {"$regex": search, "$options": "i"}},
            {"client_email": {"$regex": search, "$options": "i"}},
            {"client_phone": {"$regex": search, "$options": "i"}},
        ]

    total = await _db.loans.count_documents(query)
    skip = (page - 1) * limit

    loans = []
    async for loan in _db.loans.find(query).sort("created_at", -1).skip(skip).limit(limit):
        loan['_id'] = str(loan['_id'])
        _serialize_dates(loan, DATE_FIELDS)
        # Normalize old schema fields to new field names
        if 'amount' not in loan and 'principal' in loan:
            loan['amount'] = loan['principal']
        if 'balance' not in loan and 'outstanding_balance' in loan:
            loan['balance'] = loan['outstanding_balance']
        if 'interest_rate' not in loan and 'apr' in loan:
            loan['interest_rate'] = loan['apr']
        if 'term_months' not in loan and 'term_count' in loan:
            loan['term_months'] = loan['term_count']
        if 'client_name' not in loan and 'borrower_name' in loan:
            loan['client_name'] = loan['borrower_name']
        if 'client_phone' not in loan and 'borrower_phone' in loan:
            loan['client_phone'] = loan['borrower_phone']
        if 'principal_paid' not in loan:
            loan['principal_paid'] = loan.get('total_paid', 0)
        if 'interest_paid' not in loan:
            loan['interest_paid'] = loan.get('total_interest_paid', 0)
        loans.append(loan)

    return {"success": True, "loans": loans, "total": total, "page": page, "limit": limit}


# ─── GET: Loan Statistics (MUST be before {loan_id} routes) ──────────────────
@loan_mgmt_router.get('/admin/loans/stats')
async def get_loan_stats(request: Request):
    """Get loan portfolio statistics"""
    user = await _auth_admin(request)

    pipeline_status = [
        {"$addFields": {
            "_amount": {"$ifNull": ["$amount", {"$ifNull": ["$principal", 0]}]},
            "_balance": {"$ifNull": ["$balance", {"$ifNull": ["$outstanding_balance", 0]}]},
        }},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": "$_amount"}, "total_balance": {"$sum": "$_balance"}}}
    ]
    status_stats = {}
    async for doc in _db.loans.aggregate(pipeline_status):
        status_stats[doc['_id']] = {
            "count": doc['count'],
            "total_amount": round(doc.get('total_amount', 0), 2),
            "total_balance": round(doc.get('total_balance', 0), 2),
        }

    total_loans = await _db.loans.count_documents({})
    active_loans = await _db.loans.count_documents({"status": {"$in": ["active", "delinquent"]}})

    # Include signed, approved, active, and delinquent loans in portfolio stats
    portfolio_statuses = ["signed", "approved", "active", "delinquent"]
    pipeline_totals = [
        {"$match": {"status": {"$in": portfolio_statuses}}},
        {"$addFields": {
            "_amount": {"$ifNull": ["$amount", {"$ifNull": ["$principal", 0]}]},
            "_balance": {"$ifNull": ["$balance", {"$ifNull": ["$outstanding_balance", 0]}]},
            "_principal_paid": {"$ifNull": ["$principal_paid", {"$ifNull": ["$total_paid", 0]}]},
            "_interest_paid": {"$ifNull": ["$interest_paid", {"$ifNull": ["$total_interest_paid", 0]}]},
            "_rate": {"$cond": {
                "if": {"$and": [
                    {"$ifNull": ["$apr", False]},
                    {"$lt": ["$apr", 1]}
                ]},
                "then": {"$multiply": ["$apr", 100]},
                "else": {"$ifNull": ["$interest_rate", {"$ifNull": [{"$multiply": ["$apr", 100]}, 0]}]}
            }},
        }},
        {"$group": {
            "_id": None,
            "total_portfolio": {"$sum": "$_amount"},
            "total_balance": {"$sum": "$_balance"},
            "total_principal_paid": {"$sum": "$_principal_paid"},
            "total_interest_earned": {"$sum": "$_interest_paid"},
            "avg_interest_rate": {"$avg": "$_rate"},
            "avg_amount": {"$avg": "$_amount"},
        }}
    ]
    totals = {"total_portfolio": 0, "total_balance": 0, "total_principal_paid": 0, "total_interest_earned": 0, "avg_interest_rate": 0, "avg_amount": 0}
    async for doc in _db.loans.aggregate(pipeline_totals):
        totals = {
            "total_portfolio": round(doc.get('total_portfolio', 0), 2),
            "total_balance": round(doc.get('total_balance', 0), 2),
            "total_principal_paid": round(doc.get('total_principal_paid', 0), 2),
            "total_interest_earned": round(doc.get('total_interest_earned', 0), 2),
            "avg_interest_rate": round(doc.get('avg_interest_rate', 0), 2),
            "avg_amount": round(doc.get('avg_amount', 0), 2),
        }

    delinquent_count = await _db.loans.count_documents({"status": "delinquent"})
    delinquency_rate = round((delinquent_count / active_loans * 100) if active_loans > 0 else 0, 1)

    recent = []
    async for loan in _db.loans.find().sort("created_at", -1).limit(5):
        loan['_id'] = str(loan['_id'])
        _serialize_dates(loan, ['application_date', 'created_at'])
        # Normalize old schema for recent loans display
        loan_amount = loan.get('amount', loan.get('principal', 0))
        loan_name = loan.get('client_name', loan.get('borrower_name', ''))
        recent.append({
            "id": loan['_id'],
            "loan_number": loan.get('loan_number', ''),
            "client_name": loan_name,
            "amount": loan_amount,
            "status": loan.get('status', ''),
            "created_at": loan.get('created_at', ''),
        })

    return {
        "success": True,
        "total_loans": total_loans,
        "active_loans": active_loans,
        "delinquent_count": delinquent_count,
        "delinquency_rate": delinquency_rate,
        "by_status": status_stats,
        "portfolio": totals,
        "recent_loans": recent,
    }


# ─── POST: Calculate Amortization (Preview) ─────────────────────────────────
@loan_mgmt_router.post('/admin/loans/calculate')
async def calculate_loan(request: Request):
    """Calculate loan amortization without creating a loan"""
    data = await request.json()
    amount = float(data.get('amount', 0))
    interest_rate = float(data.get('interest_rate', 0))
    term_months = int(data.get('term_months', 12))
    method = data.get('amortization_method', 'french')
    start_date = data.get('start_date')
    payment_frequency = data.get('payment_frequency', 'monthly')

    if amount <= 0 or term_months <= 0:
        raise HTTPException(status_code=400, detail="Monto y plazo deben ser mayores a 0")

    result = generate_amortization_schedule(amount, interest_rate, term_months, method, start_date, payment_frequency)
    return {"success": True, "amount": amount, "interest_rate": interest_rate, "term_months": term_months, "amortization_method": method, "payment_frequency": payment_frequency, **result}


# ─── GET: Search Clients for Loan Creation ───────────────────────────────────
@loan_mgmt_router.get('/admin/loan-clients')
async def search_clients_for_loan(request: Request, q: str = ''):
    """Search existing clients to prefill loan application"""
    user = await _auth_admin(request)

    if not q or len(q) < 2:
        return {"success": True, "clients": []}

    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    }

    clients = []
    async for client in _db.users.find(query, {"password": 0, "profile_picture": 0}).limit(10):
        profile = await _db.client_profiles.find_one({"user_id": str(client['_id'])})
        clients.append({
            "id": str(client['_id']),
            "name": client.get('name', ''),
            "email": client.get('email', ''),
            "phone": client.get('phone', ''),
            "ssn_last4": profile.get('ssn_last_four', '') if profile else '',
            "address": client.get('address', {}),
        })

    return {"success": True, "clients": clients}


# ─── GET: Export Loans CSV ───────────────────────────────────────────────────
@loan_mgmt_router.get('/admin/loan-export-csv')
async def export_loans_csv(request: Request, status: str = None):
    """Export loans list as CSV"""
    user = await _auth_admin(request)

    query = {}
    if status:
        query["status"] = status

    output = csv_io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        'Número', 'Cliente', 'Email', 'Teléfono', 'Monto', 'Tasa %',
        'Plazo (meses)', 'Cuota Mensual', 'Saldo', 'Capital Pagado',
        'Intereses Pagados', 'Estado', 'Fecha Solicitud', 'Método', 'Propósito'
    ])

    status_labels = {
        'draft': 'Borrador', 'submitted': 'Enviada', 'under_review': 'En Evaluación',
        'approved': 'Aprobado', 'rejected': 'Rechazado', 'signed': 'Firmado',
        'active': 'Activo', 'delinquent': 'En Mora', 'closed': 'Cerrado', 'default': 'Incobrable'
    }

    async for loan in _db.loans.find(query).sort("created_at", -1):
        app_date = ''
        if loan.get('application_date'):
            try:
                app_date = loan['application_date'].strftime("%Y-%m-%d") if hasattr(loan['application_date'], 'strftime') else str(loan['application_date'])[:10]
            except:
                app_date = str(loan.get('application_date', ''))[:10]

        writer.writerow([
            loan.get('loan_number', ''),
            loan.get('client_name', ''),
            loan.get('client_email', ''),
            loan.get('client_phone', ''),
            f"${loan.get('amount', 0):.2f}",
            loan.get('interest_rate', 0),
            loan.get('term_months', 0),
            f"${loan.get('monthly_payment', 0):.2f}",
            f"${loan.get('balance', 0):.2f}",
            f"${loan.get('principal_paid', 0):.2f}",
            f"${loan.get('interest_paid', 0):.2f}",
            status_labels.get(loan.get('status', ''), loan.get('status', '')),
            app_date,
            loan.get('amortization_method', ''),
            loan.get('purpose', ''),
        ])

    csv_content = output.getvalue()
    output.close()
    csv_base64 = base64.b64encode(csv_content.encode('utf-8')).decode('utf-8')

    return {"success": True, "csv_base64": csv_base64, "filename": f"Prestamos_{datetime.utcnow().strftime('%Y%m%d')}.csv"}


# ─── GET: Loan Detail ────────────────────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}')
async def get_loan_detail(loan_id: str, request: Request):
    """Get detailed loan information"""
    user = await _auth_admin(request)

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    loan['_id'] = str(loan['_id'])
    _serialize_dates(loan, DATE_FIELDS)

    payments = []
    async for pay in _db.loan_payments.find({"loan_id": loan_id}).sort("payment_number", 1):
        pay['_id'] = str(pay['_id'])
        _serialize_dates(pay, PAYMENT_DATE_FIELDS)
        payments.append(pay)

    amort = generate_amortization_schedule(
        loan.get('amount', loan.get('principal', 0)),
        loan.get('interest_rate', loan.get('apr', 0)),
        loan.get('term_months', loan.get('term_count', 12)),
        loan.get('amortization_method', 'french'),
        loan.get('first_payment_date') or datetime.utcnow().strftime("%Y-%m-%d"),
        payment_frequency=loan.get('payment_frequency', 'monthly')
    )

    # Normalize loan data - ensure frontend gets consistent field names
    if 'amount' not in loan and 'principal' in loan:
        loan['amount'] = loan['principal']
    if 'balance' not in loan and 'outstanding_balance' in loan:
        loan['balance'] = loan['outstanding_balance']
    if 'interest_rate' not in loan and 'apr' in loan:
        loan['interest_rate'] = loan['apr']
    if 'term_months' not in loan and 'term_count' in loan:
        loan['term_months'] = loan['term_count']
    if 'client_name' not in loan and 'borrower_name' in loan:
        loan['client_name'] = loan['borrower_name']
    if 'principal_paid' not in loan:
        loan['principal_paid'] = loan.get('total_paid', 0)
    if 'interest_paid' not in loan:
        loan['interest_paid'] = loan.get('total_interest_paid', 0)

    return {"success": True, "loan": loan, "payments": payments, "amortization": amort}


# ─── PUT: Update Loan ────────────────────────────────────────────────────────
@loan_mgmt_router.put('/admin/loans/{loan_id}')
async def update_loan(loan_id: str, request: Request):
    """Update loan information"""
    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    update_data = {"updated_at": datetime.utcnow()}

    allowed_fields = [
        'client_name', 'client_email', 'client_phone', 'client_ssn_last4',
        'purpose', 'guarantor_name', 'guarantor_phone', 'guarantor_relationship',
        'reference1_name', 'reference1_phone', 'reference2_name', 'reference2_phone',
        'notes', 'first_payment_date',
    ]

    if loan['status'] not in ['disbursed', 'active', 'delinquent', 'closed', 'default']:
        allowed_fields += ['amount', 'interest_rate', 'term_months', 'amortization_method']

    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    if any(f in data for f in ['amount', 'interest_rate', 'term_months', 'amortization_method']):
        amount = float(data.get('amount', loan['amount']))
        rate = float(data.get('interest_rate', loan['interest_rate']))
        term = int(data.get('term_months', loan['term_months']))
        method = data.get('amortization_method', loan.get('amortization_method', 'french'))
        pay_freq = data.get('payment_frequency', loan.get('payment_frequency', 'monthly'))

        amort = generate_amortization_schedule(amount, rate, term, method, payment_frequency=pay_freq)
        next_pmt = amort.get('weekly_payment', amort['monthly_payment']) if pay_freq == 'weekly' else amort['monthly_payment']
        update_data.update({
            'amount': amount, 'interest_rate': rate, 'term_months': term,
            'amortization_method': method, 'monthly_payment': amort['monthly_payment'],
            'weekly_payment': amort.get('weekly_payment', amort['monthly_payment'] / 4),
            'total_interest': amort['total_interest'], 'total_to_pay': amort['total_to_pay'],
            'balance': amount, 'next_payment_amount': next_pmt,
            'payment_frequency': pay_freq,
        })

    await _db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update_data})
    return {"success": True, "message": "Préstamo actualizado"}


# ─── PATCH: Update Loan Status ───────────────────────────────────────────────
@loan_mgmt_router.patch('/admin/loans/{loan_id}/status')
async def update_loan_status(loan_id: str, request: Request):
    """Update loan status with audit trail"""
    user = await _auth_admin(request)
    data = await request.json()

    new_status = data.get('status')
    comment = data.get('comment', '')

    valid_statuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'signed', 'disbursed', 'active', 'delinquent', 'closed', 'default']
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Válidos: {', '.join(valid_statuses)}")

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    now = datetime.utcnow()
    update = {"status": new_status, "updated_at": now}

    if new_status == 'approved':
        update['approval_date'] = now
        update['approved_by'] = user.get('email', 'admin')
    elif new_status == 'rejected':
        update['rejection_reason'] = data.get('rejection_reason', comment)
    elif new_status == 'disbursed':
        update['disbursement_date'] = now
        update['status'] = 'active'
        new_status = 'active'
        if loan.get('first_payment_date'):
            try:
                first_pay = datetime.strptime(loan['first_payment_date'], "%Y-%m-%d")
                maturity = first_pay + timedelta(days=30 * loan['term_months'])
                update['maturity_date'] = maturity
            except:
                pass
    elif new_status == 'closed':
        update['closed_date'] = now

    history_entry = {
        "status": new_status,
        "changed_by": user.get('email', 'admin'),
        "changed_at": now.isoformat(),
        "comment": comment
    }

    await _db.loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": update, "$push": {"status_history": history_entry}}
    )

    return {"success": True, "message": f"Estado actualizado a '{new_status}'", "new_status": new_status}


# ─── GET: Search Vault Customers for Loan Payments ──────────────────────────
@loan_mgmt_router.get('/admin/loans/vault-customers/search')
async def search_vault_customers(request: Request):
    """Search Customer Vault AND App Payment Methods for payment sources by name or email"""
    user = await _auth_admin(request)
    from urllib.parse import parse_qs
    query_str = str(request.url.query)
    params = parse_qs(query_str)
    search_term = params.get('q', [''])[0].strip().lower()

    if not search_term or len(search_term) < 2:
        return {"success": True, "customers": []}

    results = []
    seen_vault_ids = set()

    try:
        # ── 1. Search vault_customers (NMI Customer Vault — 368+ records) ──
        vc_filter = {"$or": [
            {"firstName": {"$regex": search_term, "$options": "i"}},
            {"lastName": {"$regex": search_term, "$options": "i"}},
            {"email": {"$regex": search_term, "$options": "i"}},
        ]}
        cursor = _db.vault_customers.find(vc_filter).limit(10)
        async for c in cursor:
            vault_id = c.get('customerVaultId', '')
            if vault_id:
                seen_vault_ids.add(vault_id)
            results.append({
                "vault_id": vault_id,
                "name": f"{c.get('firstName', '')} {c.get('lastName', '')}".strip(),
                "email": c.get('email', ''),
                "phone": c.get('phone', ''),
                "payment_type": 'ACH' if c.get('checkAba') or c.get('routingNumber') else 'Card',
                "card_last4": c.get('ccNumber', '')[-4:] if c.get('ccNumber') else (c.get('maskedAccount', '')[-4:] if c.get('maskedAccount') else ''),
                "card_brand": c.get('cardBrand', ''),
                "bank_name": c.get('checkName', c.get('bankName', '')),
                "account_last4": c.get('checkAccount', '')[-4:] if c.get('checkAccount') else '',
                "source": "vault",
            })

        # ── 2. Search payment_methods (App-saved cards — with or without NMI) ──
        pm_filter = {
            "active": {"$ne": False},
            "$or": [
                {"cardholder_name": {"$regex": search_term, "$options": "i"}},
                {"user_email": {"$regex": search_term, "$options": "i"}},
                {"last4": {"$regex": search_term, "$options": "i"}},
            ]
        }
        pm_cursor = _db.payment_methods.find(pm_filter).limit(10)
        async for pm in pm_cursor:
            nmi_id = pm.get('nmi_vault_id', '')
            # Skip if we already have this vault from NMI search
            if nmi_id and nmi_id in seen_vault_ids:
                continue
            
            # Get user name if needed
            pm_name = pm.get('cardholder_name', '')
            if not pm_name and pm.get('user_id'):
                try:
                    u = await _db.users.find_one({"_id": ObjectId(pm['user_id'])})
                    if u:
                        pm_name = u.get('full_name', u.get('name', ''))
                except:
                    pass

            results.append({
                "vault_id": nmi_id or str(pm.get('_id', '')),
                "name": pm_name or 'Sin nombre',
                "email": pm.get('user_email', ''),
                "phone": '',
                "payment_type": pm.get('payment_type', 'Card').upper() if pm.get('payment_type') else 'Card',
                "card_last4": pm.get('last4', pm.get('last_4', '')),
                "card_brand": pm.get('brand', pm.get('card_brand', '')),
                "bank_name": pm.get('bank_name', ''),
                "account_last4": pm.get('account_last4', ''),
                "source": "app" if not nmi_id else "app+vault",
                "has_nmi": bool(nmi_id),
            })

        return {"success": True, "customers": results, "count": len(results)}
    except Exception as e:
        logging.error(f"Vault search error: {e}")
        return {"success": True, "customers": [], "count": 0}


# ─── POST: Register Payment ─────────────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans/{loan_id}/payments')
async def register_loan_payment(loan_id: str, request: Request):
    """Register a payment for a loan. Supports cash, card, or ACH via Merchant One."""
    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if loan['status'] not in ['active', 'delinquent', 'signed']:
        raise HTTPException(status_code=400, detail="Solo se pueden registrar pagos en préstamos activos, firmados o en mora")

    amount = float(data.get('amount', 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El monto del pago debe ser mayor a 0")

    payment_method = data.get('payment_method', 'cash')  # cash, card, ach
    vault_id = data.get('customer_vault_id', '')
    nmi_transaction = None

    # ═══ PROCESS NMI PAYMENT (Card / ACH) ═══
    if payment_method in ('card', 'ach') and vault_id:
        try:
            from merchant_one_enhanced import charge_vault_customer
            loan_number = loan.get('loan_number', str(loan_id))
            client_name = loan.get('client_name', '')
            nmi_result = await charge_vault_customer(
                customer_vault_id=vault_id,
                amount=amount,
                order_description=f"Pago préstamo {loan_number} - {client_name}"
            )
            if not nmi_result.get('success'):
                error_msg = nmi_result.get('responseText', nmi_result.get('error', 'Error desconocido'))
                raise HTTPException(status_code=400, detail=f"El cobro fue rechazado: {error_msg}")

            nmi_transaction = {
                "transaction_id": nmi_result.get('transactionId', ''),
                "vault_id": vault_id,
                "response_text": nmi_result.get('responseText', ''),
                "method": payment_method,
            }
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"NMI charge error: {e}")
            raise HTTPException(status_code=500, detail=f"Error procesando cobro NMI: {str(e)}")

    balance = loan.get('balance', loan.get('amount', 0))
    loan_method = loan.get('amortization_method', 'flat')
    loan_rate = loan.get('interest_rate', 0)

    if loan_method == 'flat':
        # ═══ FLAT MODEL ═══
        # Total owed = balance + (balance × rate%)
        # Payment reduces the total. Remaining unpaid becomes new principal.
        interest_due = balance * (loan_rate / 100)
        total_due = balance + interest_due

        if amount >= total_due:
            # Full payment - loan is cleared
            principal_portion = balance
            interest_portion = interest_due
            new_balance = 0
        else:
            # Partial payment - rest becomes new principal for next cycle
            # Payment first covers interest, then principal
            if amount <= interest_due:
                interest_portion = amount
                principal_portion = 0
                new_balance = balance  # No principal reduction
            else:
                interest_portion = interest_due
                principal_portion = amount - interest_due
                new_balance = balance - principal_portion
    else:
        # ═══ TRADITIONAL AMORTIZATION ═══
        monthly_rate = loan_rate / 100 / 12
        interest_portion = balance * monthly_rate
        principal_portion = amount - interest_portion

        if principal_portion < 0:
            interest_portion = amount
            principal_portion = 0
        if principal_portion > balance:
            principal_portion = balance

        new_balance = balance - principal_portion

    if new_balance < 0.01:
        new_balance = 0

    payment_count = await _db.loan_payments.count_documents({"loan_id": loan_id})

    now = datetime.utcnow()
    payment = {
        "loan_id": loan_id,
        "payment_number": payment_count + 1,
        "amount": amount,
        "principal_portion": round(principal_portion, 2),
        "interest_portion": round(interest_portion, 2),
        "fee_portion": float(data.get('late_fee', 0)),
        "payment_date": now,
        "due_date": data.get('due_date'),
        "payment_method": payment_method,
        "status": "completed",
        "late_fee": float(data.get('late_fee', 0)),
        "notes": data.get('notes', ''),
        "recorded_by": user.get('email', 'admin'),
        "created_at": now,
    }
    # Add NMI transaction info if paid electronically
    if nmi_transaction:
        payment["nmi_transaction"] = nmi_transaction
        payment["customer_vault_id"] = vault_id

    await _db.loan_payments.insert_one(payment)

    loan_update = {
        "balance": round(new_balance, 2),
        "principal_paid": round(loan.get('principal_paid', 0) + principal_portion, 2),
        "interest_paid": round(loan.get('interest_paid', 0) + interest_portion, 2),
        "fees_paid": round(loan.get('fees_paid', 0) + float(data.get('late_fee', 0)), 2),
        "updated_at": now,
        "days_overdue": 0,
    }

    if loan.get('next_payment_date'):
        try:
            next_date = datetime.strptime(loan['next_payment_date'], "%Y-%m-%d") if isinstance(loan['next_payment_date'], str) else loan['next_payment_date']
            pay_freq = loan.get('payment_frequency', 'monthly')
            if pay_freq == 'weekly':
                loan_update['next_payment_date'] = (next_date + timedelta(days=7)).strftime("%Y-%m-%d")
            elif pay_freq == 'biweekly':
                loan_update['next_payment_date'] = (next_date + timedelta(days=14)).strftime("%Y-%m-%d")
            else:
                loan_update['next_payment_date'] = (next_date + timedelta(days=30)).strftime("%Y-%m-%d")
        except:
            pass

    # For flat loans: recalculate next period based on remaining balance
    if loan_method == 'flat' and new_balance > 0:
        new_interest = new_balance * (loan_rate / 100)
        new_total = new_balance + new_interest
        pay_freq = loan.get('payment_frequency', 'monthly')
        loan_update['monthly_payment'] = round(new_total, 2)
        loan_update['weekly_payment'] = round(new_total / 4, 2)
        loan_update['biweekly_payment'] = round(new_total / 2, 2)
        if pay_freq == 'weekly':
            loan_update['next_payment_amount'] = round(new_total / 4, 2)
        elif pay_freq == 'biweekly':
            loan_update['next_payment_amount'] = round(new_total / 2, 2)
        else:
            loan_update['next_payment_amount'] = round(new_total, 2)
        loan_update['total_to_pay'] = round(new_total, 2)
        loan_update['total_interest'] = round(new_interest, 2)

    if new_balance <= 0:
        loan_update['status'] = 'closed'
        loan_update['closed_date'] = now
        loan_update['balance'] = 0
        await _db.loans.update_one(
            {"_id": ObjectId(loan_id)},
            {"$push": {"status_history": {
                "status": "closed",
                "changed_by": "system",
                "changed_at": now.isoformat(),
                "comment": "Préstamo liquidado completamente"
            }}}
        )
    elif loan['status'] == 'delinquent':
        loan_update['status'] = 'active'

    await _db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": loan_update})

    return {
        "success": True,
        "message": f"Pago #{payment_count + 1} registrado exitosamente",
        "payment": {
            "amount": amount,
            "principal": round(principal_portion, 2),
            "interest": round(interest_portion, 2),
            "new_balance": round(new_balance, 2),
        }
    }


# ─── GET: Loan Payments ─────────────────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}/payments')
async def get_loan_payments(loan_id: str, request: Request):
    """Get payment history for a loan"""
    user = await _auth_admin(request)

    payments = []
    async for pay in _db.loan_payments.find({"loan_id": loan_id}).sort("payment_number", 1):
        pay['_id'] = str(pay['_id'])
        _serialize_dates(pay, PAYMENT_DATE_FIELDS)
        payments.append(pay)

    return {"success": True, "payments": payments}


# ─── DELETE: Delete Loan (admin force-delete any status) ─────────────────────
@loan_mgmt_router.delete('/admin/loans/{loan_id}')
async def delete_loan(loan_id: str, request: Request):
    """Delete a loan. Admin can force-delete any loan with ?force=true."""
    user = await _auth_admin(request)

    # Check force param
    from urllib.parse import parse_qs
    query = str(request.url.query)
    params = parse_qs(query)
    force = params.get('force', ['false'])[0].lower() == 'true'

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if not force and loan.get('status') not in ['draft', 'rejected', 'closed']:
        raise HTTPException(status_code=400, detail="Use ?force=true para eliminar préstamos activos/firmados")

    loan_number = loan.get('loan_number', str(loan_id))
    client_name = loan.get('client_name', loan.get('borrower_name', ''))

    await _db.loans.delete_one({"_id": ObjectId(loan_id)})
    await _db.loan_payments.delete_many({"loan_id": loan_id})

    return {"success": True, "message": f"Préstamo {loan_number} ({client_name}) eliminado permanentemente"}


# ─── POST: Bulk Delete Loans ─────────────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans/bulk-delete')
async def bulk_delete_loans(request: Request):
    """Bulk delete multiple loans by IDs."""
    user = await _auth_admin(request)
    data = await request.json()
    loan_ids = data.get('loan_ids', [])

    if not loan_ids:
        raise HTTPException(status_code=400, detail="No se proporcionaron IDs")

    deleted = 0
    errors = []
    for lid in loan_ids:
        try:
            result = await _db.loans.delete_one({"_id": ObjectId(lid)})
            if result.deleted_count > 0:
                await _db.loan_payments.delete_many({"loan_id": lid})
                deleted += 1
            else:
                errors.append(f"{lid}: no encontrado")
        except Exception as e:
            errors.append(f"{lid}: {str(e)}")

    return {
        "success": True,
        "deleted": deleted,
        "total_requested": len(loan_ids),
        "errors": errors,
        "message": f"{deleted} préstamo(s) eliminado(s) de {len(loan_ids)} solicitado(s)"
    }


# ─── POST: Sign Loan Contract ────────────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans/{loan_id}/sign')
async def sign_loan_contract(loan_id: str, request: Request):
    """Sign a loan contract with canvas or Topaz pad signature"""
    import hashlib
    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    sig_type = data.get('type', 'canvas')  # 'canvas' or 'topaz'
    image_data = data.get('image_data', '')
    biometric_data = data.get('biometric_data', '')
    pad_model = data.get('pad_model', '')

    if not image_data and not biometric_data:
        raise HTTPException(status_code=400, detail="No se recibió firma")

    # Create signature hash for integrity verification
    sig_payload = (image_data or biometric_data).encode('utf-8')
    sig_hash = hashlib.sha256(sig_payload).hexdigest()

    now = datetime.utcnow()
    client_ip = request.client.host if request.client else 'unknown'

    signature_record = {
        "type": sig_type,
        "image_data": image_data,
        "biometric_data": biometric_data if sig_type == 'topaz' else '',
        "pad_model": pad_model,
        "hash": sig_hash,
        "signed_at": now,
        "signed_by_admin": user.get('email', 'admin'),
        "signer_name": loan.get('client_name', ''),
        "client_ip": client_ip,
    }

    update = {
        "signature": signature_record,
        "signature_status": "signed",
        "signature_type": sig_type,
        "signed_at": now,
        "updated_at": now,
    }

    # Auto-advance status to 'signed' if in eligible status
    current_status = loan.get('status', 'draft')
    if current_status in ['draft', 'submitted', 'under_review', 'approved']:
        update['status'] = 'signed'

    history_entry = {
        "status": update.get('status', current_status),
        "changed_by": user.get('email', 'admin'),
        "changed_at": now.isoformat(),
        "comment": f"Contrato firmado ({sig_type}{' — ' + pad_model if pad_model else ''}) por {loan.get('client_name', '')}. Hash: {sig_hash[:12]}..."
    }

    await _db.loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": update, "$push": {"status_history": history_entry}}
    )

    return {
        "success": True,
        "message": "Contrato firmado exitosamente",
        "signature_type": sig_type,
        "signed_at": now.isoformat(),
        "hash": sig_hash,
    }


# ─── GET: Get Loan Signature ────────────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}/signature')
async def get_loan_signature(loan_id: str, request: Request):
    """Get signature data for a loan"""
    user = await _auth_admin(request)

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    signature = loan.get('signature')
    if not signature:
        return {"success": True, "signed": False, "signature": None}

    # Convert datetime to string
    if signature.get('signed_at') and hasattr(signature['signed_at'], 'isoformat'):
        signature['signed_at'] = signature['signed_at'].isoformat()

    return {
        "success": True,
        "signed": True,
        "signature": {
            "type": signature.get('type', ''),
            "image_data": signature.get('image_data', ''),
            "signed_at": signature.get('signed_at', ''),
            "signer_name": signature.get('signer_name', ''),
            "hash": signature.get('hash', ''),
            "pad_model": signature.get('pad_model', ''),
        }
    }


# ─── GET: Generate Loan Contract PDF ─────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}/contract-pdf')
async def get_loan_contract_pdf(loan_id: str, request: Request, lang: str = 'en'):
    """Generate and return loan contract as PDF (base64). Use ?lang=en or ?lang=es"""
    from loan_pdf_service import generate_loan_contract_pdf

    user = await _auth_admin(request)

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    loan['_id'] = str(loan['_id'])
    amort = generate_amortization_schedule(
        loan['amount'], loan['interest_rate'], loan['term_months'],
        loan.get('amortization_method', 'french'),
        loan.get('first_payment_date') or datetime.utcnow().strftime("%Y-%m-%d"),
        loan.get('payment_frequency', 'monthly')
    )

    if lang not in ('en', 'es'):
        lang = 'en'
    pdf_base64 = generate_loan_contract_pdf(loan, amort.get('schedule', []), lang=lang)
    prefix = "Contract" if lang == 'en' else "Contrato"
    return {"success": True, "pdf_base64": pdf_base64, "filename": f"{prefix}_{loan.get('loan_number', loan_id)}.pdf"}


# ─── GET: Generate Payment Receipt PDF ───────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}/payments/{payment_id}/receipt')
async def get_payment_receipt_pdf(loan_id: str, payment_id: str, request: Request, lang: str = 'en'):
    """Generate payment receipt as PDF (base64). Use ?lang=en or ?lang=es"""
    from loan_pdf_service import generate_payment_receipt_pdf

    user = await _auth_admin(request)

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    payment = await _db.loan_payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    loan['_id'] = str(loan['_id'])
    payment['_id'] = str(payment['_id'])

    if lang not in ('en', 'es'):
        lang = 'en'
    pdf_base64 = generate_payment_receipt_pdf(loan, payment, lang=lang)
    prefix = "Receipt" if lang == 'en' else "Recibo_Pago"
    return {"success": True, "pdf_base64": pdf_base64, "filename": f"{prefix}_{loan.get('loan_number', '')}_{payment.get('payment_number', '')}.pdf"}



# ─── POST: Add Payment Method (Card) to Client Vault ─────────────────────────
@loan_mgmt_router.post('/admin/loans/{loan_id}/add-payment-method')
async def add_payment_method_for_loan(loan_id: str, request: Request):
    """Add a credit/debit card to the NMI vault for the loan's client.
    Body: { card_number, exp_month, exp_year, cvv }
    Creates vault entry in NMI + saves to payment_methods collection.
    """
    import uuid
    import httpx

    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    card_number = data.get('card_number', '').replace(' ', '').replace('-', '')
    exp_month = int(data.get('exp_month', 0))
    exp_year = int(data.get('exp_year', 0))
    cvv = str(data.get('cvv', ''))

    if not card_number or len(card_number) < 13:
        raise HTTPException(status_code=400, detail="Número de tarjeta inválido")
    if exp_month < 1 or exp_month > 12:
        raise HTTPException(status_code=400, detail="Mes de expiración inválido")
    if exp_year < 25:
        raise HTTPException(status_code=400, detail="Año de expiración inválido")
    if not cvv or len(cvv) < 3:
        raise HTTPException(status_code=400, detail="CVV inválido")

    # Build NMI payload
    security_key = os.getenv('MERCHANTONE_PRIVATE_SECURITY_KEY', '')
    if not security_key:
        raise HTTPException(status_code=500, detail="Clave de seguridad de NMI no configurada")

    vault_id = str(uuid.uuid4())
    exp_formatted = f"{exp_month:02d}{str(exp_year)[-2:]}"

    # Detect card brand
    card_type = 'Visa'
    if card_number.startswith('4'):
        card_type = 'Visa'
    elif card_number[:2] in ('51', '52', '53', '54', '55') or (2221 <= int(card_number[:4]) <= 2720):
        card_type = 'Mastercard'
    elif card_number[:2] in ('34', '37'):
        card_type = 'Amex'
    elif card_number[:4] == '6011' or card_number[:2] == '65':
        card_type = 'Discover'

    nmi_payload = {
        'security_key': security_key,
        'customer_vault': 'add_customer',
        'customer_vault_id': vault_id,
        'payment': 'creditcard',
        'ccnumber': card_number,
        'ccexp': exp_formatted,
        'cvv': cvv,
        'first_name': loan.get('client_name', '').split(' ')[0] if loan.get('client_name') else '',
        'last_name': ' '.join(loan.get('client_name', '').split(' ')[1:]) if loan.get('client_name') else '',
        'email': loan.get('client_email', ''),
        'phone': loan.get('client_phone', ''),
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                'https://secure.networkmerchants.com/api/transact.php',
                data=nmi_payload
            )
            response_text = r.text
            response_data = dict(x.split('=', 1) for x in response_text.split('&') if '=' in x)

        if response_data.get('response', '') != '1':
            return {
                "success": False,
                "error": response_data.get('responsetext', 'Error desconocido al agregar tarjeta')
            }

        # Save to payment_methods collection
        card_last4 = card_number[-4:]
        pm_record = {
            'id': str(uuid.uuid4()),
            'user_id': loan.get('client_id', ''),
            'client_name': loan.get('client_name', ''),
            'type': 'card',
            'card_type': card_type,
            'card_last4': card_last4,
            'last4': card_last4,
            'exp_month': exp_month,
            'exp_year': exp_year,
            'vault_id': vault_id,
            'customer_vault_id': vault_id,
            'nmi_vault_id': vault_id,
            'gateway': 'nmi',
            'is_default': False,
            'status': 'active',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'source': 'loan_module',
        }
        result = await _db.payment_methods.insert_one(pm_record)
        pm_record['_id'] = str(result.inserted_id)

        logger.info(f"✅ Card added to vault for loan {loan.get('loan_number')}: {card_type} ****{card_last4}")

        return {
            "success": True,
            "payment_method": {
                "_id": pm_record['_id'],
                "id": pm_record['id'],
                "type": "card",
                "card_type": card_type,
                "card_last4": card_last4,
                "last4": card_last4,
                "vault_id": vault_id,
            },
            "message": f"✅ Tarjeta {card_type} ****{card_last4} agregada exitosamente"
        }

    except Exception as e:
        logger.error(f"❌ Error adding card to vault: {e}")
        raise HTTPException(status_code=500, detail=f"Error al agregar tarjeta: {str(e)}")


# ─── POST: Send Payment Reminder ─────────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans/{loan_id}/send-reminder')
async def send_loan_payment_reminder(loan_id: str, request: Request):
    """Send payment reminder via email/SMS"""
    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    reminder_type = data.get('type', 'email')
    custom_message = data.get('message', '')
    results = {"email_sent": False, "sms_sent": False}

    # Send Email
    if reminder_type in ['email', 'both'] and loan.get('client_email'):
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            sg_key = os.environ.get('SENDGRID_API_KEY')
            if sg_key:
                subject = f"Recordatorio de Pago — {loan.get('loan_number', '')}"
                html_content = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1a5632; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">Ross Lending Solutions</h1>
                    </div>
                    <div style="padding: 30px; background: #fff;">
                        <h2 style="color: #333;">Recordatorio de Pago</h2>
                        <p>Estimado/a <strong>{loan.get('client_name', 'Cliente')}</strong>,</p>
                        <p>Le recordamos que tiene un pago pendiente en su préstamo:</p>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background: #f8f9fa;"><td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Préstamo:</strong></td><td style="padding: 10px; border: 1px solid #dee2e6;">{loan.get('loan_number', '')}</td></tr>
                            <tr><td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Cuota Mensual:</strong></td><td style="padding: 10px; border: 1px solid #dee2e6;">${loan.get('monthly_payment', 0):,.2f}</td></tr>
                            <tr style="background: #f8f9fa;"><td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Saldo Pendiente:</strong></td><td style="padding: 10px; border: 1px solid #dee2e6;">${loan.get('balance', 0):,.2f}</td></tr>
                            <tr><td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Próximo Pago:</strong></td><td style="padding: 10px; border: 1px solid #dee2e6;">{loan.get('next_payment_date', 'Pendiente')}</td></tr>
                        </table>
                        {"<p><strong>Mensaje:</strong> " + custom_message + "</p>" if custom_message else ""}
                        <p>Para realizar su pago, comuníquese con nosotros al <strong>(806) 934-2018</strong> o visite nuestra oficina.</p>
                        <p style="color: #666; font-size: 12px; margin-top: 30px;">Ross Lending Solutions LLC · 305 Bruce Ave, Dumas TX 79029</p>
                    </div>
                </div>
                """
                message = Mail(
                    from_email=os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@rosstaxpreparation.com'),
                    to_emails=loan['client_email'],
                    subject=subject,
                    html_content=html_content
                )
                sg = SendGridAPIClient(sg_key)
                sg.send(message)
                results['email_sent'] = True
        except Exception as e:
            logger.error(f"Error sending loan reminder email: {e}")

    # Send SMS
    if reminder_type in ['sms', 'both'] and loan.get('client_phone'):
        try:
            twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
            twilio_from = os.environ.get('TWILIO_PHONE_NUMBER')

            if twilio_sid and twilio_token and twilio_from:
                from twilio.rest import Client as TwilioClient
                twilio = TwilioClient(twilio_sid, twilio_token)
                sms_body = (
                    f"Ross Tax - Recordatorio: Su pago de préstamo {loan.get('loan_number', '')} "
                    f"por ${loan.get('monthly_payment', 0):,.2f} está pendiente. "
                    f"Saldo: ${loan.get('balance', 0):,.2f}. "
                    f"Llame al (806) 934-2018."
                )
                if custom_message:
                    sms_body += f" {custom_message}"
                twilio.messages.create(body=sms_body, from_=twilio_from, to=loan['client_phone'])
                results['sms_sent'] = True
        except Exception as e:
            logger.error(f"Error sending loan reminder SMS: {e}")

    # Log the reminder
    await _db.loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$push": {"status_history": {
            "status": loan.get('status', 'active'),
            "changed_by": user.get('email', 'admin'),
            "changed_at": datetime.utcnow().isoformat(),
            "comment": f"Recordatorio enviado ({reminder_type}): {'Email ✅' if results['email_sent'] else 'Email ❌'} {'SMS ✅' if results['sms_sent'] else 'SMS ❌'}"
        }}}
    )

    return {"success": True, "results": results}


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECTIONS / COBRANZA ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ─── POST: Check and Auto-Update Delinquent Loans ───────────────────────────
@loan_mgmt_router.post('/admin/loan-check-delinquency')
async def check_delinquency(request: Request):
    """Scan active loans and mark overdue ones as delinquent"""
    user = await _auth_admin(request)

    now = datetime.utcnow()
    updated_count = 0

    async for loan in _db.loans.find({"status": {"$in": ["active", "delinquent"]}}):
        next_pay = loan.get('next_payment_date')
        if not next_pay:
            continue

        try:
            if isinstance(next_pay, str):
                next_pay_date = datetime.strptime(next_pay, "%Y-%m-%d")
            else:
                next_pay_date = next_pay

            days_overdue = (now - next_pay_date).days

            if days_overdue > 0:
                update = {"days_overdue": days_overdue, "updated_at": now}
                if loan['status'] != 'delinquent' and days_overdue >= 5:
                    update['status'] = 'delinquent'
                    await _db.loans.update_one(
                        {"_id": loan['_id']},
                        {"$push": {"status_history": {
                            "status": "delinquent",
                            "changed_by": "system",
                            "changed_at": now.isoformat(),
                            "comment": f"Mora automática: {days_overdue} días de atraso"
                        }}}
                    )
                await _db.loans.update_one({"_id": loan['_id']}, {"$set": update})
                updated_count += 1
            elif loan.get('days_overdue', 0) > 0:
                await _db.loans.update_one({"_id": loan['_id']}, {"$set": {"days_overdue": 0, "updated_at": now}})
        except Exception as e:
            logger.error(f"Error checking delinquency for loan {loan.get('loan_number')}: {e}")

    return {"success": True, "updated": updated_count}


# ─── POST: Log Collection Contact ───────────────────────────────────────────
@loan_mgmt_router.post('/admin/loans/{loan_id}/collection-log')
async def add_collection_log(loan_id: str, request: Request):
    """Log a collection contact attempt"""
    user = await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    now = datetime.utcnow()
    log_entry = {
        "loan_id": loan_id,
        "loan_number": loan.get('loan_number', ''),
        "client_name": loan.get('client_name', ''),
        "contact_type": data.get('contact_type', 'phone'),
        "result": data.get('result', 'no_answer'),
        "notes": data.get('notes', ''),
        "promise_date": data.get('promise_date'),
        "promise_amount": float(data.get('promise_amount', 0)) if data.get('promise_amount') else None,
        "logged_by": user.get('email', 'admin'),
        "created_at": now,
    }

    await _db.collection_logs.insert_one(log_entry)

    result_labels = {
        'answered': 'Contestó', 'no_answer': 'No contestó', 'promised': 'Prometió pago',
        'refused': 'Se negó', 'wrong_number': 'Número equivocado'
    }
    contact_labels = {
        'phone': 'Llamada', 'visit': 'Visita', 'email': 'Email', 'sms': 'SMS', 'whatsapp': 'WhatsApp'
    }

    comment = f"Cobranza — {contact_labels.get(data.get('contact_type', ''), data.get('contact_type', ''))}: {result_labels.get(data.get('result', ''), data.get('result', ''))}"
    if data.get('notes'):
        comment += f" — {data['notes']}"
    if data.get('promise_date'):
        comment += f" — Promesa: {data['promise_date']}"

    await _db.loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$push": {"status_history": {
            "status": loan.get('status', 'delinquent'),
            "changed_by": user.get('email', 'admin'),
            "changed_at": now.isoformat(),
            "comment": comment
        }}, "$set": {"updated_at": now}}
    )

    return {"success": True, "message": "Registro de cobranza guardado"}


# ─── GET: Collection Logs for a Loan ────────────────────────────────────────
@loan_mgmt_router.get('/admin/loans/{loan_id}/collection-logs')
async def get_collection_logs(loan_id: str, request: Request):
    """Get collection contact logs for a loan"""
    user = await _auth_admin(request)

    logs = []
    async for log in _db.collection_logs.find({"loan_id": loan_id}).sort("created_at", -1):
        log['_id'] = str(log['_id'])
        _serialize_dates(log, ['created_at'])
        logs.append(log)

    return {"success": True, "logs": logs}


# ─── GET: Aging Report (Cobranza Dashboard) ─────────────────────────────────
@loan_mgmt_router.get('/admin/loan-aging-report')
async def get_aging_report(request: Request):
    """Get loan aging analysis for collections dashboard"""
    user = await _auth_admin(request)

    now = datetime.utcnow()

    aging = {
        "current": {"count": 0, "balance": 0, "loans": []},
        "days_1_30": {"count": 0, "balance": 0, "loans": []},
        "days_31_60": {"count": 0, "balance": 0, "loans": []},
        "days_61_90": {"count": 0, "balance": 0, "loans": []},
        "days_90_plus": {"count": 0, "balance": 0, "loans": []},
    }

    async for loan in _db.loans.find({"status": {"$in": ["active", "delinquent"]}}):
        days = loan.get('days_overdue', 0)
        loan_summary = {
            "id": str(loan['_id']),
            "loan_number": loan.get('loan_number', ''),
            "client_name": loan.get('client_name', ''),
            "client_phone": loan.get('client_phone', ''),
            "amount": loan.get('amount', 0),
            "balance": loan.get('balance', 0),
            "monthly_payment": loan.get('monthly_payment', 0),
            "days_overdue": days,
            "next_payment_date": str(loan.get('next_payment_date', ''))[:10] if loan.get('next_payment_date') else '',
            "status": loan.get('status', ''),
        }

        if days <= 0:
            aging["current"]["count"] += 1
            aging["current"]["balance"] += loan.get('balance', 0)
            aging["current"]["loans"].append(loan_summary)
        elif days <= 30:
            aging["days_1_30"]["count"] += 1
            aging["days_1_30"]["balance"] += loan.get('balance', 0)
            aging["days_1_30"]["loans"].append(loan_summary)
        elif days <= 60:
            aging["days_31_60"]["count"] += 1
            aging["days_31_60"]["balance"] += loan.get('balance', 0)
            aging["days_31_60"]["loans"].append(loan_summary)
        elif days <= 90:
            aging["days_61_90"]["count"] += 1
            aging["days_61_90"]["balance"] += loan.get('balance', 0)
            aging["days_61_90"]["loans"].append(loan_summary)
        else:
            aging["days_90_plus"]["count"] += 1
            aging["days_90_plus"]["balance"] += loan.get('balance', 0)
            aging["days_90_plus"]["loans"].append(loan_summary)

    for bucket in aging.values():
        bucket["balance"] = round(bucket["balance"], 2)

    recent_logs = []
    async for log in _db.collection_logs.find().sort("created_at", -1).limit(20):
        log['_id'] = str(log['_id'])
        _serialize_dates(log, ['created_at'])
        recent_logs.append(log)

    return {"success": True, "aging": aging, "recent_logs": recent_logs}


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT PORTAL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ─── GET: Client Portal - My Loans ──────────────────────────────────────────
@loan_mgmt_router.get('/my-loans')
async def get_my_loans(request: Request):
    """Get loans for the authenticated client (by email match)"""
    user = await _auth_user(request)

    email = user.get('email', '')
    loans_list = []

    async for loan in _db.loans.find({
        "$or": [
            {"client_email": {"$regex": f"^{email}$", "$options": "i"}},
            {"client_id": str(user.get('_id', ''))}
        ]
    }).sort("created_at", -1):
        loan['_id'] = str(loan['_id'])
        _serialize_dates(loan, DATE_FIELDS)

        safe_loan = {
            "_id": loan['_id'],
            "loan_number": loan.get('loan_number', ''),
            "amount": loan.get('amount', 0),
            "interest_rate": loan.get('interest_rate', 0),
            "term_months": loan.get('term_months', 0),
            "monthly_payment": loan.get('monthly_payment', 0),
            "total_to_pay": loan.get('total_to_pay', 0),
            "total_interest": loan.get('total_interest', 0),
            "status": loan.get('status', ''),
            "purpose": loan.get('purpose', ''),
            "balance": loan.get('balance', 0),
            "principal_paid": loan.get('principal_paid', 0),
            "interest_paid": loan.get('interest_paid', 0),
            "next_payment_date": loan.get('next_payment_date'),
            "next_payment_amount": loan.get('next_payment_amount', 0),
            "days_overdue": loan.get('days_overdue', 0),
            "application_date": loan.get('application_date'),
            "approval_date": loan.get('approval_date'),
            "first_payment_date": loan.get('first_payment_date'),
            "created_at": loan.get('created_at'),
        }
        loans_list.append(safe_loan)

    return {"success": True, "loans": loans_list}


# ─── GET: Client Portal - My Loan Detail ────────────────────────────────────
@loan_mgmt_router.get('/my-loans/{loan_id}')
async def get_my_loan_detail(loan_id: str, request: Request):
    """Get specific loan detail for the authenticated client"""
    user = await _auth_user(request)

    try:
        loan_object_id = ObjectId(loan_id)
    except:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    email = user.get('email', '')
    loan = await _db.loans.find_one({
        "_id": loan_object_id,
        "$or": [
            {"client_email": {"$regex": f"^{email}$", "$options": "i"}},
            {"client_id": str(user.get('_id', ''))}
        ]
    })

    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    loan['_id'] = str(loan['_id'])
    _serialize_dates(loan, DATE_FIELDS)

    payments = []
    async for pay in _db.loan_payments.find({"loan_id": loan_id}).sort("payment_date", -1):
        pay['_id'] = str(pay['_id'])
        _serialize_dates(pay, ['payment_date'])
        payments.append(pay)

    amortization = generate_amortization_schedule(
        loan.get('amount', 0), loan.get('interest_rate', 0),
        loan.get('term_months', 0), loan.get('amortization_method', 'french'),
        loan.get('first_payment_date')
    )

    return {"success": True, "loan": loan, "payments": payments, "amortization": amortization}



# ═══════════════════════════════════════════════════════════════════════
# AUTO-PAY CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class AutoPayRequest(BaseModel):
    enabled: bool
    payment_method_id: str = ""
    payment_method_last4: str = ""
    payment_method_type: str = "card"  # card or bank_account

@loan_mgmt_router.put("/admin/loans/{loan_id}/auto-pay")
async def update_auto_pay(loan_id: str, req: AutoPayRequest, request: Request):
    """Enable or disable auto-pay for a loan"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    
    update_data = {
        "auto_pay_enabled": req.enabled,
        "auto_pay_updated_at": datetime.utcnow().isoformat(),
        "auto_pay_updated_by": current_user.get('email', ''),
    }
    
    if req.enabled:
        if not req.payment_method_id:
            raise HTTPException(status_code=400, detail="Se requiere un método de pago para activar el pago automático")
        update_data["auto_pay_method_id"] = req.payment_method_id
        update_data["auto_pay_method_last4"] = req.payment_method_last4
        update_data["auto_pay_method_type"] = req.payment_method_type
    else:
        update_data["auto_pay_method_id"] = ""
        update_data["auto_pay_method_last4"] = ""
        update_data["auto_pay_method_type"] = ""
    
    await _db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update_data})
    
    return {"success": True, "message": f"Pago automático {'activado' if req.enabled else 'desactivado'}"}

# ═══════════════════════════════════════════════════════════════════════
# ADMIN NOTIFICATION EMAIL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class NotificationEmailConfig(BaseModel):
    service: str  # loans, properties, taxes, services, general
    email: str
    enabled: bool = True

@loan_mgmt_router.get("/admin/notification-emails")
async def get_notification_emails(request: Request):
    """Get notification email config for all services"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    configs = []
    async for c in _db.admin_notification_emails.find().sort("service", 1):
        c['_id'] = str(c['_id'])
        configs.append(c)
    
    # Default services if none configured
    default_services = [
        {"service": "loans", "label": "Préstamos", "email": "", "enabled": True},
        {"service": "properties", "label": "Propiedades", "email": "", "enabled": True},
        {"service": "taxes", "label": "Impuestos", "email": "", "enabled": True},
        {"service": "services", "label": "Servicios", "email": "", "enabled": True},
        {"service": "general", "label": "General", "email": "", "enabled": True},
    ]
    
    # Merge with existing config
    existing_services = {c['service']: c for c in configs}
    merged = []
    for ds in default_services:
        if ds['service'] in existing_services:
            merged.append(existing_services[ds['service']])
        else:
            merged.append(ds)
    
    return {"success": True, "configs": merged}

@loan_mgmt_router.put("/admin/notification-emails")
async def update_notification_emails(request: Request):
    """Update notification email config"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    body = await request.json()
    configs = body.get('configs', [])
    
    for cfg in configs:
        service = cfg.get('service', '')
        email = cfg.get('email', '').strip()
        enabled = cfg.get('enabled', True)
        
        if not service:
            continue
        
        await _db.admin_notification_emails.update_one(
            {"service": service},
            {"$set": {
                "service": service,
                "email": email,
                "enabled": enabled,
                "updated_at": datetime.utcnow().isoformat(),
                "updated_by": current_user.get('email', ''),
            }},
            upsert=True
        )
    
    return {"success": True, "message": "Configuración de emails actualizada"}



# ═══════════════════════════════════════════════════════════════════════
# CLIENT PORTAL - LOAN APPLICATION
# ═══════════════════════════════════════════════════════════════════════

class ClientLoanApplication(BaseModel):
    amount: float
    purpose: str = "Préstamo personal"
    term_months: int = 1
    employment_status: str = ""
    monthly_income: float = 0
    employer_name: str = ""
    notes: str = ""


@loan_mgmt_router.post('/my-loans/apply')
async def client_apply_for_loan(request: Request):
    """Client submits a new loan application from the web or app"""
    user = await _auth_user(request)
    data = await request.json()

    amount = float(data.get('amount', 0))
    if amount < 200 or amount > 1000:
        raise HTTPException(status_code=400, detail="El monto debe estar entre $200 y $1,000")

    term_months = int(data.get('term_months', 1))
    purpose = data.get('purpose', 'Préstamo personal')
    payment_frequency = data.get('payment_frequency', 'monthly')  # weekly, biweekly, monthly

    # OCCC-compliant rates (Texas Chapter 342F)
    # $200-$270: Max 240% APR = 20% monthly
    # $271-$1,800: Max 180% APR = 15% monthly
    if amount <= 270:
        interest_rate = 20.0  # 20% monthly (240% APR - legal for ≤$270)
    else:
        interest_rate = 15.0  # 15% monthly (180% APR - legal for $271-$1,800)
    method = 'flat'

    # Calculate total cost
    total_fee = amount * (interest_rate / 100) * term_months
    total_to_pay = amount + total_fee

    # Calculate payment amount based on frequency
    if payment_frequency == 'weekly':
        num_payments = term_months * 4  # 4 weeks per month
        payment_amount = round(total_to_pay / num_payments, 2)
    elif payment_frequency == 'biweekly':
        num_payments = term_months * 2  # 2 biweekly per month
        payment_amount = round(total_to_pay / num_payments, 2)
    else:  # monthly
        num_payments = term_months
        payment_amount = round(total_to_pay / num_payments, 2)

    amort = generate_amortization_schedule(amount, interest_rate, term_months, method)
    loan_number = await generate_loan_number()

    now = datetime.utcnow()
    loan = {
        "loan_number": loan_number,
        "client_id": str(user.get('_id', '')),
        "client_name": user.get('name', ''),
        "client_email": user.get('email', ''),
        "client_phone": user.get('phone', ''),
        "amount": amount,
        "interest_rate": interest_rate,
        "term_months": term_months,
        "purpose": purpose,
        "amortization_method": method,
        "payment_frequency": payment_frequency,
        "num_payments": num_payments,
        "payment_amount": payment_amount,
        "monthly_payment": amort['monthly_payment'],
        "total_interest": total_fee,
        "total_to_pay": total_to_pay,
        "apr": interest_rate * 12,
        "status": "submitted",
        "application_date": now,
        "approval_date": None,
        "disbursement_date": None,
        "first_payment_date": None,
        "maturity_date": None,
        "closed_date": None,
        "principal_paid": 0,
        "interest_paid": 0,
        "fees_paid": 0,
        "balance": amount,
        "next_payment_date": None,
        "next_payment_amount": amort['monthly_payment'],
        "days_overdue": 0,
        "employment_status": data.get('employment_status', ''),
        "monthly_income": float(data.get('monthly_income', 0)),
        "employer_name": data.get('employer_name', ''),
        "notes": data.get('notes', ''),
        "approved_by": None,
        "rejection_reason": None,
        "status_history": [{
            "status": "submitted",
            "changed_by": user.get('email', ''),
            "changed_at": now.isoformat(),
            "comment": "Solicitud enviada por el cliente"
        }],
        "created_at": now,
        "updated_at": now,
        "source": "client_portal",
    }

    result = await _db.loans.insert_one(loan)

    return {
        "success": True,
        "loan_id": str(result.inserted_id),
        "loan_number": loan_number,
        "message": f"Solicitud {loan_number} enviada. La revisaremos en 24-48 horas.",
        "summary": {
            "amount": amount,
            "interest_rate": interest_rate,
            "payment_frequency": payment_frequency,
            "num_payments": num_payments,
            "payment_amount": payment_amount,
            "total_interest": total_fee,
            "total_to_pay": total_to_pay,
            "term_months": term_months,
        }
    }


@loan_mgmt_router.post('/my-loans/{loan_id}/pay')
async def client_make_payment(loan_id: str, request: Request):
    """Client makes a payment on a loan from the web portal"""
    user = await _auth_user(request)
    data = await request.json()

    email = user.get('email', '')
    loan = await _db.loans.find_one({
        "_id": ObjectId(loan_id),
        "$or": [
            {"client_email": {"$regex": f"^{email}$", "$options": "i"}},
            {"client_id": str(user.get('_id', ''))}
        ]
    })

    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if loan.get('status') not in ['active', 'delinquent']:
        raise HTTPException(status_code=400, detail="Este préstamo no acepta pagos en este momento")

    amount = float(data.get('amount', loan.get('monthly_payment', 0)))
    balance = loan.get('balance', 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Monto inválido")
    if amount > balance:
        amount = balance

    # Get next payment number
    last_payment = await _db.loan_payments.find_one(
        {'loan_id': loan_id},
        sort=[('payment_number', -1)]
    )
    next_num = (last_payment.get('payment_number', 0) + 1) if last_payment else 1

    # Calculate principal and interest portions (flat method)
    interest_rate = loan.get('interest_rate', 20)
    interest_portion = min(balance * (interest_rate / 100), amount)
    principal_portion = amount - interest_portion

    now = datetime.utcnow()
    payment = {
        "loan_id": loan_id,
        "loan_number": loan.get('loan_number', ''),
        "payment_number": next_num,
        "amount": amount,
        "principal_portion": principal_portion,
        "interest_portion": interest_portion,
        "payment_date": now,
        "payment_method": data.get('payment_method', 'web_portal'),
        "status": "completed",
        "recorded_by": email,
        "created_at": now,
    }

    await _db.loan_payments.insert_one(payment)

    # Update loan balance
    new_balance = max(0, balance - amount)
    update_fields = {
        "balance": new_balance,
        "principal_paid": loan.get('principal_paid', 0) + principal_portion,
        "interest_paid": loan.get('interest_paid', 0) + interest_portion,
        "updated_at": now,
    }

    if new_balance <= 0:
        update_fields['status'] = 'closed'
        update_fields['closed_date'] = now

    await _db.loans.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": update_fields}
    )

    # Send email notification
    try:
        import asyncio
        from email_sender import send_payment_confirmation, send_loan_paid_off
        client_name = user.get('name', '')

        asyncio.create_task(send_payment_confirmation(
            client_email=email,
            client_name=client_name,
            amount=amount,
            payment_number=next_num,
            loan_number=loan.get('loan_number', ''),
            payment_method='Portal Web',
            new_balance=new_balance
        ))

        if new_balance <= 0:
            asyncio.create_task(send_loan_paid_off(
                client_email=email,
                client_name=client_name,
                loan_number=loan.get('loan_number', ''),
                total_paid=loan.get('total_to_pay', amount)
            ))
    except Exception as e:
        logger.error(f"Payment email error: {e}")

    return {
        "success": True,
        "payment_number": next_num,
        "amount": amount,
        "new_balance": new_balance,
        "status": "closed" if new_balance <= 0 else "active",
        "message": f"Pago #{next_num} de ${amount:.2f} procesado correctamente"
    }



# ═══════════════════════════════════════════════════════════════════════════════
# DISBURSEMENT / DESEMBOLSO
# ═══════════════════════════════════════════════════════════════════════════════

DISBURSEMENT_METHODS = {
    "cash": {"label": "Efectivo", "fee": 0, "speed": "Inmediato", "icon": "💵"},
    "zelle": {"label": "Zelle", "fee": 0, "speed": "Instantáneo", "icon": "📱"},
    "ach": {"label": "ACH Direct Deposit", "fee": 0, "speed": "2-3 días laborables", "icon": "🏧"},
    "visa_direct": {"label": "Visa Direct / MC Send", "fee": 4.95, "speed": "Instantáneo", "icon": "⚡"},
}


@loan_mgmt_router.get('/disbursement/methods')
async def get_disbursement_methods(request: Request):
    """Get available disbursement methods with fees (public for client portal)"""
    # Check if there's a custom fee in unified_config
    config = await _db.unified_config.find_one({"key": "disbursement_settings"})
    methods = dict(DISBURSEMENT_METHODS)
    if config and config.get('visa_direct_fee'):
        methods['visa_direct']['fee'] = float(config['visa_direct_fee'])
    return {"methods": methods}


@loan_mgmt_router.post('/my-loans/{loan_id}/select-disbursement')
async def client_select_disbursement(loan_id: str, request: Request):
    """Client selects how to receive their loan funds after approval."""
    user = await _auth_user(request)
    data = await request.json()

    email = user.get('email', '')
    # Search in both collections
    loan = await _db.loans.find_one({
        "_id": ObjectId(loan_id),
        "$or": [
            {"client_email": {"$regex": f"^{email}$", "$options": "i"}},
            {"client_id": str(user.get('_id', ''))}
        ]
    })
    loan_collection = 'loans'
    if not loan:
        loan = await _db.regulated_loans.find_one({
            "_id": ObjectId(loan_id),
            "$or": [
                {"client_email": {"$regex": f"^{email}$", "$options": "i"}},
            ]
        })
        loan_collection = 'regulated_loans'

    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if loan.get('status') not in ['approved', 'submitted']:
        raise HTTPException(status_code=400, detail="El préstamo debe estar aprobado para seleccionar método de desembolso")

    method = data.get('disbursement_method', '')
    if method not in DISBURSEMENT_METHODS:
        raise HTTPException(status_code=400, detail=f"Método inválido. Opciones: {', '.join(DISBURSEMENT_METHODS.keys())}")

    # Get fee (check config for custom fee)
    config = await _db.unified_config.find_one({"key": "disbursement_settings"})
    fee = DISBURSEMENT_METHODS[method]['fee']
    if method == 'visa_direct' and config and config.get('visa_direct_fee'):
        fee = float(config['visa_direct_fee'])

    loan_amount = loan.get('amount', 0)
    net_disbursement = loan_amount - fee

    # Save client's bank account or card info if provided
    account_info = {}
    if method == 'ach':
        account_info = {
            "routing_number": data.get('routing_number', ''),
            "account_number": data.get('account_number', ''),
            "account_type": data.get('account_type', 'checking'),
            "bank_name": data.get('bank_name', ''),
            "plaid_verified": data.get('plaid_verified', False),
        }
    elif method == 'visa_direct':
        account_info = {
            "card_last4": data.get('card_last4', ''),
            "card_brand": data.get('card_brand', ''),
            "card_token": data.get('card_token', ''),
            "plaid_account_id": data.get('plaid_account_id', ''),
            "plaid_verified": data.get('plaid_verified', False),
        }
    elif method == 'zelle':
        account_info = {
            "zelle_email": data.get('zelle_email', email),
            "zelle_phone": data.get('zelle_phone', ''),
        }

    now = datetime.utcnow()
    disbursement_data = {
        "disbursement_method": method,
        "disbursement_fee": fee,
        "net_disbursement": net_disbursement,
        "disbursement_status": "pending",
        "disbursement_account": account_info,
        "disbursement_selected_at": now,
        "disbursement_speed": DISBURSEMENT_METHODS[method]['speed'],
        "updated_at": now,
    }

    await _db[loan_collection].update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": disbursement_data}
    )

    # Also save to client's vault for future use
    if account_info and (method in ['ach', 'visa_direct']):
        vault_entry = {
            "client_id": str(user.get('_id', '')),
            "client_name": user.get('name', loan.get('client_name', '')),
            "client_email": email,
            "method_type": "bank_account" if method == 'ach' else "debit_card",
            **account_info,
            "loan_id": loan_id,
            "created_at": now,
            "updated_at": now,
        }
        # Upsert: update if exists, create if not
        await _db.client_payment_vault.update_one(
            {"client_email": email, "method_type": vault_entry['method_type']},
            {"$set": vault_entry},
            upsert=True
        )

    return {
        "success": True,
        "disbursement_method": method,
        "disbursement_fee": fee,
        "loan_amount": loan_amount,
        "net_disbursement": net_disbursement,
        "speed": DISBURSEMENT_METHODS[method]['speed'],
        "status": "pending",
        "message": f"Método de desembolso seleccionado: {DISBURSEMENT_METHODS[method]['label']}. {'Fee de $' + f'{fee:.2f} descontado del monto.' if fee > 0 else 'Sin costo adicional.'}"
    }


@loan_mgmt_router.post('/admin/loans/{loan_id}/process-disbursement')
async def admin_process_disbursement(loan_id: str, request: Request):
    """Admin marks a loan disbursement as processed/completed."""
    await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    loan_collection = 'loans'
    if not loan:
        loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
        loan_collection = 'regulated_loans'
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    action = data.get('action', 'complete')  # complete, cancel
    now = datetime.utcnow()

    if action == 'complete':
        update = {
            "disbursement_status": "completed",
            "disbursement_completed_at": now,
            "disbursement_completed_by": data.get('admin_email', ''),
            "disbursement_reference": data.get('reference', ''),
            "disbursement_notes": data.get('notes', ''),
            "status": "active",
            "activated_at": now,
            "updated_at": now,
        }
        status_msg = "Desembolso completado. Préstamo activado."
    elif action == 'cancel':
        update = {
            "disbursement_status": "cancelled",
            "disbursement_cancelled_at": now,
            "disbursement_notes": data.get('notes', ''),
            "updated_at": now,
        }
        status_msg = "Desembolso cancelado."
    else:
        raise HTTPException(status_code=400, detail="Acción inválida")

    await _db[loan_collection].update_one({"_id": ObjectId(loan_id)}, {"$set": update})

    return {
        "success": True,
        "disbursement_status": update.get('disbursement_status'),
        "message": status_msg,
    }


@loan_mgmt_router.get('/admin/loans/{loan_id}/disbursement-info')
async def admin_get_disbursement_info(loan_id: str, request: Request):
    """Admin views disbursement details including client account info (PIN protected on frontend)."""
    await _auth_admin(request)
    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        loan = await _db.regulated_loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    return {
        "loan_id": loan_id,
        "loan_number": loan.get('loan_number', ''),
        "client_name": loan.get('client_name', ''),
        "amount": loan.get('amount', 0),
        "disbursement_method": loan.get('disbursement_method', ''),
        "disbursement_fee": loan.get('disbursement_fee', 0),
        "net_disbursement": loan.get('net_disbursement', 0),
        "disbursement_status": loan.get('disbursement_status', 'not_selected'),
        "disbursement_speed": loan.get('disbursement_speed', ''),
        "disbursement_account": loan.get('disbursement_account', {}),
        "disbursement_selected_at": str(loan.get('disbursement_selected_at', '')),
        "disbursement_completed_at": str(loan.get('disbursement_completed_at', '')),
        "disbursement_reference": loan.get('disbursement_reference', ''),
        "disbursement_notes": loan.get('disbursement_notes', ''),
    }


@loan_mgmt_router.get('/my-loans/{loan_id}/saved-accounts')
async def client_get_saved_accounts(loan_id: str, request: Request):
    """Client retrieves their saved payment accounts from vault."""
    user = await _auth_user(request)
    email = user.get('email', '')

    accounts = await _db.client_payment_vault.find(
        {"client_email": {"$regex": f"^{email}$", "$options": "i"}}
    ).to_list(length=10)

    # Mask sensitive data for display
    safe_accounts = []
    for acc in accounts:
        safe = {
            "id": str(acc.get('_id', '')),
            "method_type": acc.get('method_type', ''),
            "created_at": str(acc.get('created_at', '')),
        }
        if acc.get('method_type') == 'bank_account':
            safe['bank_name'] = acc.get('bank_name', '')
            safe['account_last4'] = acc.get('account_number', '')[-4:] if acc.get('account_number') else ''
            safe['account_type'] = acc.get('account_type', '')
            safe['plaid_verified'] = acc.get('plaid_verified', False)
        elif acc.get('method_type') == 'debit_card':
            safe['card_last4'] = acc.get('card_last4', '')
            safe['card_brand'] = acc.get('card_brand', '')
            safe['plaid_verified'] = acc.get('plaid_verified', False)
        safe_accounts.append(safe)

    return {"accounts": safe_accounts}


@loan_mgmt_router.put('/admin/disbursement-settings')
async def update_disbursement_settings(request: Request):
    """Admin updates disbursement fee configuration."""
    await _auth_admin(request)
    data = await request.json()

    now = datetime.utcnow()
    settings = {
        "key": "disbursement_settings",
        "visa_direct_fee": float(data.get('visa_direct_fee', 4.95)),
        "ach_fee": float(data.get('ach_fee', 0)),
        "zelle_fee": float(data.get('zelle_fee', 0)),
        "cash_fee": float(data.get('cash_fee', 0)),
        "updated_at": now,
        "updated_by": data.get('admin_email', ''),
    }

    await _db.unified_config.update_one(
        {"key": "disbursement_settings"},
        {"$set": settings},
        upsert=True
    )

    return {"success": True, "message": "Configuración de desembolso actualizada", "settings": settings}


@loan_mgmt_router.get('/admin/disbursement-settings')
async def get_disbursement_settings(request: Request):
    """Admin gets current disbursement fee configuration."""
    await _auth_admin(request)
    config = await _db.unified_config.find_one({"key": "disbursement_settings"})
    if not config:
        return {
            "visa_direct_fee": 4.95,
            "ach_fee": 0,
            "zelle_fee": 0,
            "cash_fee": 0,
        }
    config.pop('_id', None)
    return config


# ═══════════════════════════════════════════════════════════════════════════════
# STRIPE INSTANT PAYOUT (Visa Direct / MC Send)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from stripe_disbursement_service import StripeDisbursementService
    _stripe_available = True
except ImportError:
    _stripe_available = False

_stripe_service = None

def _get_stripe_service():
    global _stripe_service
    if not _stripe_service and _stripe_available:
        _stripe_service = StripeDisbursementService(_db)
    return _stripe_service


@loan_mgmt_router.post('/stripe/create-connected-account')
async def stripe_create_connected_account(request: Request):
    """Create a Stripe Connected Account for a loan client (for receiving payouts)."""
    user = await _auth_user(request)
    data = await request.json()

    email = data.get('email', user.get('email', ''))
    name = data.get('name', user.get('name', ''))
    phone = data.get('phone', '')

    if not email or not name:
        raise HTTPException(status_code=400, detail="Email y nombre son requeridos")

    service = _get_stripe_service()
    if not service:
        raise HTTPException(status_code=503, detail="Stripe service not available")
    
    result = await service.create_connected_account(email, name, phone)

    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])

    return result


@loan_mgmt_router.post('/stripe/add-debit-card')
async def stripe_add_debit_card(request: Request):
    """Add a debit card token to the client's connected account for instant payouts."""
    user = await _auth_user(request)
    data = await request.json()

    email = data.get('email', user.get('email', ''))
    card_token = data.get('card_token', '')

    if not card_token:
        raise HTTPException(status_code=400, detail="Token de tarjeta requerido")

    service = _get_stripe_service()
    result = await service.add_debit_card(email, card_token)

    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])

    return result


@loan_mgmt_router.post('/stripe/setup-intent')
async def stripe_create_setup_intent(request: Request):
    """Create a SetupIntent for native card collection in the Expo app."""
    user = await _auth_user(request)
    data = await request.json()
    email = data.get('email', user.get('email', ''))

    service = _get_stripe_service()

    # Ensure connected account exists first
    name = data.get('name', user.get('name', email))
    acct_result = await service.create_connected_account(email, name)
    if not acct_result['success']:
        raise HTTPException(status_code=400, detail=acct_result['error'])

    # Create SetupIntent
    result = await service.create_card_token_intent(email)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])

    return result


@loan_mgmt_router.post('/admin/loans/{loan_id}/instant-payout')
async def admin_execute_instant_payout(loan_id: str, request: Request):
    """Admin triggers instant payout to client's debit card via Stripe Visa Direct."""
    await _auth_admin(request)
    data = await request.json()

    loan = await _db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if loan.get('disbursement_status') == 'completed':
        raise HTTPException(status_code=400, detail="El desembolso ya fue completado")

    if loan.get('disbursement_method') != 'visa_direct':
        raise HTTPException(status_code=400, detail="Este préstamo no tiene método de depósito instantáneo seleccionado")

    # Calculate amount in cents (after fee)
    fee = loan.get('disbursement_fee', 0)
    amount = loan.get('amount', 0) - fee
    amount_cents = int(amount * 100)

    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Monto inválido para desembolso")

    client_email = loan.get('client_email', '')
    if not client_email:
        raise HTTPException(status_code=400, detail="El préstamo no tiene email del cliente")

    service = _get_stripe_service()
    result = await service.execute_instant_payout(loan_id, amount_cents, client_email)

    if not result['success']:
        raise HTTPException(status_code=400, detail=result['error'])

    return result


@loan_mgmt_router.get('/stripe/fee-estimate')
async def stripe_fee_estimate(request: Request, amount: float = 500):
    """Get estimated Stripe fee for instant payout."""
    await _auth_user(request)
    service = _get_stripe_service()
    if not service:
        raise HTTPException(status_code=503, detail="Stripe service not available")
    return await service.get_fee_estimate(amount)


@loan_mgmt_router.get('/stripe/account-status')
async def stripe_account_status(request: Request):
    """Check if current user has a Stripe connected account with a debit card."""
    user = await _auth_user(request)
    email = user.get('email', '')

    vault = await _db.client_payment_vault.find_one({
        "client_email": {"$regex": f"^{email}$", "$options": "i"},
        "stripe_connected_account_id": {"$exists": True}
    })

    if not vault:
        return {
            "has_account": False,
            "has_card": False,
            "account_id": None,
            "card_last4": None,
        }

    return {
        "has_account": True,
        "has_card": bool(vault.get('card_last4')),
        "account_id": vault.get('stripe_connected_account_id', ''),
        "card_last4": vault.get('card_last4', ''),
        "card_brand": vault.get('card_brand', ''),
    }
