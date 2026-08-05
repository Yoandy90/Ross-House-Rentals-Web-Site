"""
Loan Shared Service — Centralizes business logic used by both:
  - regulated_lender_router.py (admin endpoints)
  - client_loans_router.py (client endpoints)

Eliminates circular imports and code duplication.
"""
import io
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ADMINISTRATIVE FEE SCHEDULE — Per Business Plan 2026-2028
# ═══════════════════════════════════════════════════════════════════════════════

ADMIN_FEE_SCHEDULE = [
    (200.00, 500.00, 50.00),
    (500.01, 1000.00, 75.00),
    (1000.01, 2500.00, 100.00),
    (2500.01, 5000.00, 125.00),
    (5000.01, 10000.00, 130.00),
]

def _get_admin_fee(principal: float) -> float:
    """
    Returns the flat administrative fee per Business Plan tiered schedule.
    $200-$500: $50 | $501-$1,000: $75 | $1,001-$2,500: $100
    $2,501-$5,000: $125 | $5,001-$10,000: $130
    Maximum: $130 (OCCC CPI-adjusted Feb 2026)
    Below $200: OCCC formula min(12.5% of principal, $130)
    """
    for min_amt, max_amt, fee in ADMIN_FEE_SCHEDULE:
        if min_amt <= principal <= max_amt:
            return fee
    if principal < 200.00:
        return round(min(principal * 0.125, 130.00), 2)
    return 130.00  # max cap


# ═══════════════════════════════════════════════════════════════════════════════
# OCCC INTEREST CALCULATION ENGINE — Texas Chapter 342
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_subchapter_f(principal: float, term_months: int) -> dict:
    """
    Subchapter F: Small loans up to $1,800
    Texas Finance Code § 342.251 / § 342.252

    Interest (installment account handling charge):
      - $0-$270: 20% monthly (~240% APR)
      - $270.01-$1,800: 15% monthly (~180% APR)

    Acquisition charge (admin fee):
      - OCCC maximum: lesser of 12.5% of cash advance or $125
      - Ref: OCCC Bulletin B24-1, 7 TAC § 83.605
    """
    if principal <= 270:
        monthly_rate = 0.20
    else:
        monthly_rate = 0.15

    monthly_interest = principal * monthly_rate
    total_interest = monthly_interest * term_months

    # Use the Business Plan tiered admin fee (falls back to OCCC formula for small amounts)
    admin_fee = _get_admin_fee(principal)
    total_to_pay = principal + total_interest + admin_fee
    monthly_payment = total_to_pay / term_months if term_months > 0 else total_to_pay

    return {
        "subchapter": "F",
        "principal": principal,
        "monthly_rate_pct": monthly_rate * 100,
        "apr_effective": monthly_rate * 12 * 100,
        "term_months": term_months,
        "monthly_interest": round(monthly_interest, 2),
        "total_interest": round(total_interest, 2),
        "admin_fee": round(admin_fee, 2),
        "total_to_pay": round(total_to_pay, 2),
        "monthly_payment": round(monthly_payment, 2),
    }


def calculate_subchapter_e(principal: float, term_months: int) -> dict:
    """
    Subchapter E: Installment loans $500-$10,000+
    Tiered annual rates (true daily earnings):
    - First $500: 30% APR
    - $500.01-$1,050: 24% APR
    - $1,050.01-$2,500: 18% APR
    - Over $2,500: 18% APR
    """
    years = term_months / 12.0
    interest = 0.0

    # Tier 1: first $500 at 30%
    tier1 = min(principal, 500)
    interest += tier1 * 0.30 * years

    # Tier 2: $500.01-$1,050 at 24%
    if principal > 500:
        tier2 = min(principal - 500, 550)
        interest += tier2 * 0.24 * years

    # Tier 3: $1,050.01-$2,500 at 18%
    if principal > 1050:
        tier3 = min(principal - 1050, 1450)
        interest += tier3 * 0.18 * years

    # Tier 4: over $2,500 at 18%
    if principal > 2500:
        tier4 = principal - 2500
        interest += tier4 * 0.18 * years

    admin_fee = _get_admin_fee(principal)  # Tiered per Business Plan
    total_to_pay = principal + interest + admin_fee
    monthly_payment = total_to_pay / term_months if term_months > 0 else total_to_pay
    effective_apr = (interest / principal / years * 100) if years > 0 else 0

    return {
        "subchapter": "E",
        "principal": principal,
        "effective_apr": round(effective_apr, 2),
        "term_months": term_months,
        "total_interest": round(interest, 2),
        "admin_fee": round(admin_fee, 2),
        "total_to_pay": round(total_to_pay, 2),
        "monthly_payment": round(monthly_payment, 2),
        "tier_breakdown": {
            "tier1_500_at_30": round(min(principal, 500) * 0.30 * years, 2),
            "tier2_550_at_24": round(min(max(principal - 500, 0), 550) * 0.24 * years, 2) if principal > 500 else 0,
            "tier3_1450_at_18": round(min(max(principal - 1050, 0), 1450) * 0.18 * years, 2) if principal > 1050 else 0,
            "tier4_rest_at_18": round(max(principal - 2500, 0) * 0.18 * years, 2) if principal > 2500 else 0,
        }
    }


def calculate_hybrid(principal: float, term_months: int) -> dict:
    """
    Hybrid OCCC Logic — Ross Lending Business Plan Default:
    - ≤ $1,800: Subchapter F (15-20% monthly — higher yield)
    - > $1,800:  Subchapter E (18-30% APR — tiered)
    Automatically routes to the correct subchapter based on principal.
    
    OCCC Compliance: Enforces max term limits.
    - Subchapter F (≤$1,800): max 6 months
    - Subchapter E (>$1,800): max 12 months
    """
    # Enforce OCCC max term limits at the calculation layer
    if principal <= 1800 and term_months > 6:
        logger.warning(f"OCCC guard: Capping term from {term_months}m to 6m for Sub F loan ${principal}")
        term_months = 6
    elif principal > 1800 and term_months > 12:
        logger.warning(f"OCCC guard: Capping term from {term_months}m to 12m for Sub E loan ${principal}")
        term_months = 12
    
    if principal <= 1800:
        return calculate_subchapter_f(principal, term_months)
    else:
        return calculate_subchapter_e(principal, term_months)


def calculate_tax_advance(principal: float) -> dict:
    """
    Tax Refund Advance — single payment when IRS refund arrives.
    Uses Subchapter F rates (15-20% for 1 month typical).
    Acquisition charge: min(12.5% of principal, $125) per OCCC.
    """
    if principal <= 270:
        monthly_rate = 0.20
    else:
        monthly_rate = 0.15

    interest_1_month = principal * monthly_rate
    admin_fee = _get_admin_fee(principal)  # Tiered per Business Plan
    total_to_collect = principal + interest_1_month + admin_fee

    return {
        "subchapter": "F",
        "loan_type": "tax_advance",
        "principal": principal,
        "monthly_rate_pct": monthly_rate * 100,
        "interest_1_month": round(interest_1_month, 2),
        "admin_fee": round(admin_fee, 2),
        "total_to_collect": round(total_to_collect, 2),
        "profit": round(interest_1_month + admin_fee, 2),
        "roi_pct": round((interest_1_month + admin_fee) / principal * 100, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# AMORTIZATION SCHEDULE GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_regulated_schedule(
    principal: float,
    total_interest: float,
    admin_fee: float,
    term_months: int,
    start_date_str: Optional[str] = None,
    payment_frequency: str = "weekly",
) -> List[Dict[str, Any]]:
    """
    Generate an amortization schedule based on payment frequency.
    Supports: 'weekly' (4 payments/month), 'biweekly' (2/month), 'monthly' (1/month).
    """
    schedule = []
    total = principal + total_interest + admin_fee

    if payment_frequency == "weekly":
        num_payments = term_months * 4
        interval_days = 7
    elif payment_frequency == "biweekly":
        num_payments = term_months * 2
        interval_days = 14
    else:  # monthly
        num_payments = term_months
        interval_days = 30

    if num_payments <= 0:
        num_payments = 1

    pmt = total / num_payments
    pmt_principal = principal / num_payments
    pmt_interest = total_interest / num_payments
    pmt_fee = admin_fee / num_payments

    start = datetime.strptime(start_date_str, "%Y-%m-%d") if start_date_str else datetime.now()
    balance = principal

    for i in range(num_payments):
        due_date = start + timedelta(days=interval_days * (i + 1))
        p_portion = pmt_principal
        i_portion = pmt_interest
        f_portion = pmt_fee
        if i == num_payments - 1:
            p_portion = balance  # last payment covers remaining balance
        balance -= p_portion
        if balance < 0.01:
            balance = 0
        schedule.append({
            "payment_number": i + 1,
            "due_date": due_date.strftime("%Y-%m-%d"),
            "payment_amount": round(pmt, 2),
            "principal": round(p_portion, 2),
            "interest": round(i_portion, 2),
            "admin_fee": round(f_portion, 2),
            "balance": round(balance, 2),
        })
    return schedule


# ═══════════════════════════════════════════════════════════════════════════════
# PDF DATA MAPPER — Builds the dict expected by loan_pdf_service.py
# ═══════════════════════════════════════════════════════════════════════════════

def build_pdf_loan_data(loan: dict) -> dict:
    """
    Maps a regulated_loans document to the flat dict expected by
    loan_pdf_service.generate_loan_contract_pdf().
    Works for both admin and client contexts.
    """
    # Compute annual_apr if missing (legacy loans)
    annual_apr = loan.get("annual_apr", 0)
    if not annual_apr:
        calc = loan.get("calculation", {})
        annual_apr = calc.get("apr_effective", calc.get("effective_apr", loan.get("interest_rate", 0)))

    # Determine payment frequency (default weekly for Sub F small loans)
    subchapter = loan.get("subchapter", loan.get("calculation", {}).get("subchapter", "F"))
    default_freq = "weekly" if subchapter == "F" else "monthly"
    payment_freq = loan.get("payment_frequency", default_freq)

    # Calculate weekly payment if not stored
    monthly_pmt = loan.get("monthly_payment", 0)
    weekly_pmt = loan.get("weekly_payment", round(monthly_pmt / 4.33, 2) if monthly_pmt else 0)

    return {
        "loan_number": loan.get("loan_number", ""),
        "client_name": loan.get("client_name", ""),
        "client_email": loan.get("client_email", ""),
        "client_phone": loan.get("client_phone", ""),
        "client_ssn_last4": loan.get("client_ssn_last4", ""),
        "amount": loan.get("amount", 0),
        "interest_rate": loan.get("interest_rate", 0),
        "annual_apr": annual_apr,
        "term_months": loan.get("term_months", 1),
        "monthly_payment": monthly_pmt,
        "weekly_payment": weekly_pmt,
        "total_interest": loan.get("total_interest", 0),
        "total_to_pay": loan.get("total_to_pay", 0),
        "purpose": loan.get("purpose", ""),
        "application_date": loan.get("created_at", datetime.now().isoformat()),
        "first_payment_date": loan.get("first_payment_date", ""),
        "amortization_method": loan.get("amortization_method", "flat"),
        "payment_frequency": payment_freq,
        "admin_fee": loan.get("admin_fee", 0),
        # Subchapter identifier (F or E) for dynamic contract generation
        "subchapter": loan.get("subchapter", loan.get("calculation", {}).get("subchapter", "F")),
        "loan_type": loan.get("loan_type", "subchapter_f"),
        # Optional fields (admin-only or present on some loans)
        "guarantor_name": loan.get("guarantor_name", ""),
        "guarantor_phone": loan.get("guarantor_phone", ""),
        "guarantor_relationship": loan.get("guarantor_relationship", ""),
        # Bank / payment method info for ACH authorization section
        "bank_info": loan.get("bank_info", {}),
        "bank_name": loan.get("bank_name", ""),
        "routing_number": loan.get("routing_number", ""),
        "account_number": loan.get("account_number", ""),
        "account_type": loan.get("account_type", "checking"),
        "payment_method": loan.get("payment_method", ""),
        "disbursement_method": loan.get("disbursement_method", ""),
        "card_last4": loan.get("card_last4", ""),
        # Signature (may be None)
        "signature": loan.get("signature"),
    }


def generate_schedule_for_loan(loan: dict) -> list:
    """Convenience: generate an amortization schedule from a loan document."""
    # Default to weekly for Subchapter F (small loans), monthly for Sub E
    subchapter = loan.get("subchapter", loan.get("calculation", {}).get("subchapter", "F"))
    default_freq = "weekly" if subchapter == "F" else "monthly"
    frequency = loan.get("payment_frequency", default_freq)

    return generate_regulated_schedule(
        loan.get("amount", 0),
        loan.get("total_interest", 0),
        loan.get("admin_fee", 0),
        loan.get("term_months", 1),
        loan.get("first_payment_date"),
        payment_frequency=frequency,
    )


def generate_contract_pdf_bytes(loan: dict, lang: str = 'es') -> bytes:
    """
    Generate PDF contract bytes for a loan. Returns raw PDF bytes.
    Raises Exception on failure.
    """
    from loan_pdf_service import generate_loan_contract_pdf

    schedule = generate_schedule_for_loan(loan)
    pdf_loan = build_pdf_loan_data(loan)
    pdf_base64 = generate_loan_contract_pdf(pdf_loan, schedule, lang=lang)
    return base64.b64decode(pdf_base64)
