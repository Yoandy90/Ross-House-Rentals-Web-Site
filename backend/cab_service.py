"""
CAB (Credit Access Business) Service
Core business logic for Texas CAB loan operations.
Handles loan creation, payment processing, trust account tracking, and OCCC reporting.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)
MIAMI_TZ = ZoneInfo("America/New_York")

# CAB Fee structures
CAB_FEE_TYPES = {
    "flat_monthly": "Tarifa fija mensual (%)",
    "per_100_borrowed": "Por cada $100 prestados",
    "tiered": "Escalonada por monto",
}

LOAN_STATUSES = ["active", "paid_off", "defaulted", "cancelled", "renewed"]

PAYMENT_METHODS = ["cash", "card", "ach", "check", "auto_pay"]


class CABService:
    """Complete CAB loan management service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cab_loans
        self.payments_col = db.cab_payments
        self.trust_col = db.cab_trust_account
        self.contracts_col = db.cab_contracts
        logger.info("✅ CAB Service initialized")

    # ═══════════════════════════════════════════════
    # LOAN CREATION
    # ═══════════════════════════════════════════════

    async def create_loan(
        self,
        client_id: str,
        client_name: str,
        client_email: str,
        client_phone: str,
        client_address: str,
        loan_amount: float,
        cab_fee_percent: float,  # e.g., 20 for 20% monthly
        term_months: int,
        lender_interest_annual: float = 10.0,  # Annual interest rate from lender
        lender_name: str = "",
        payment_frequency: str = "monthly",  # monthly, biweekly
        start_date: str = "",
        ssn_last4: str = "",
        filing_status: str = "",
        employment_status: str = "",
        monthly_income: float = 0,
        admin_id: str = "",
        admin_name: str = "",
    ) -> Dict:
        """Create a new CAB loan with full payment schedule"""
        now = datetime.now(MIAMI_TZ)

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=MIAMI_TZ)
            except ValueError:
                start_dt = now
        else:
            start_dt = now

        # Calculate payment schedule
        schedule = self._calculate_payment_schedule(
            loan_amount=loan_amount,
            cab_fee_percent=cab_fee_percent,
            term_months=term_months,
            lender_interest_annual=lender_interest_annual,
            start_date=start_dt,
            payment_frequency=payment_frequency,
        )

        # Generate loan number
        count = await self.collection.count_documents({})
        loan_number = f"CAB-{now.strftime('%Y%m')}-{count + 1:04d}"

        loan = {
            "loan_number": loan_number,
            "client_id": client_id,
            "client_name": client_name,
            "client_email": client_email,
            "client_phone": client_phone,
            "client_address": client_address,
            "ssn_last4": ssn_last4,
            "filing_status": filing_status,
            "employment_status": employment_status,
            "monthly_income": monthly_income,
            # Loan terms
            "loan_amount": loan_amount,
            "cab_fee_percent": cab_fee_percent,
            "term_months": term_months,
            "lender_interest_annual": lender_interest_annual,
            "lender_name": lender_name or "Third-Party Lender (TBD)",
            "payment_frequency": payment_frequency,
            "start_date": start_dt,
            "first_payment_date": schedule["first_payment_date"],
            "maturity_date": schedule["maturity_date"],
            # Calculated amounts
            "total_cab_fees": schedule["total_cab_fees"],
            "total_lender_interest": schedule["total_lender_interest"],
            "total_lender_portion": schedule["total_lender_portion"],
            "total_payable": schedule["total_payable"],
            "monthly_payment": schedule["monthly_payment"],
            "cab_fee_per_payment": schedule["cab_fee_per_payment"],
            "lender_per_payment": schedule["lender_per_payment"],
            # Payment schedule
            "payment_schedule": schedule["payments"],
            # Tracking
            "payments_made": 0,
            "total_paid": 0,
            "total_cab_collected": 0,
            "total_lender_collected": 0,
            "total_lender_remitted": 0,  # Amount sent to lender
            "outstanding_balance": schedule["total_payable"],
            "lender_balance_owed": loan_amount,  # Principal owed to lender
            # Status
            "status": "active",
            "auto_pay": False,
            "auto_pay_method": None,
            "vault_id": None,  # NMI vault ID for auto-pay
            # Admin
            "created_by": admin_id,
            "created_by_name": admin_name,
            "created_at": now,
            "updated_at": now,
            # Contracts
            "contracts_generated": False,
            "contract_ids": [],
            # Notes
            "notes": [],
            # OCCC reporting
            "occc_reported": False,
        }

        result = await self.collection.insert_one(loan)
        loan_id = str(result.inserted_id)

        logger.info(
            f"📋 CAB Loan created: {loan_number} | {client_name} | "
            f"${loan_amount:,.2f} | {cab_fee_percent}% | {term_months} months"
        )

        return {
            "success": True,
            "loan_id": loan_id,
            "loan_number": loan_number,
            "loan_amount": loan_amount,
            "cab_fee_percent": cab_fee_percent,
            "monthly_payment": schedule["monthly_payment"],
            "total_payable": schedule["total_payable"],
            "total_cab_fees": schedule["total_cab_fees"],
            "term_months": term_months,
            "first_payment_date": schedule["first_payment_date"].strftime("%m/%d/%Y"),
            "maturity_date": schedule["maturity_date"].strftime("%m/%d/%Y"),
        }

    def _calculate_payment_schedule(
        self,
        loan_amount: float,
        cab_fee_percent: float,
        term_months: int,
        lender_interest_annual: float,
        start_date: datetime,
        payment_frequency: str,
    ) -> Dict:
        """Calculate complete payment schedule with CAB fee and lender split"""

        # Monthly lender interest rate
        monthly_lender_rate = lender_interest_annual / 100 / 12

        # CAB fee per month (percentage of original loan amount)
        cab_fee_monthly = loan_amount * (cab_fee_percent / 100)
        total_cab_fees = cab_fee_monthly * term_months

        # Lender amortization (principal + interest)
        if monthly_lender_rate > 0:
            # Standard amortization formula
            lender_monthly = loan_amount * (
                monthly_lender_rate * (1 + monthly_lender_rate) ** term_months
            ) / ((1 + monthly_lender_rate) ** term_months - 1)
        else:
            lender_monthly = loan_amount / term_months

        total_lender_interest = (lender_monthly * term_months) - loan_amount
        total_lender_portion = lender_monthly * term_months

        # Total monthly payment = CAB fee + Lender portion
        monthly_payment = round(cab_fee_monthly + lender_monthly, 2)
        total_payable = round(monthly_payment * term_months, 2)

        # Build payment schedule
        payments = []
        remaining_principal = loan_amount
        first_payment_date = start_date + timedelta(days=30)

        for i in range(term_months):
            if payment_frequency == "biweekly":
                payment_date = start_date + timedelta(weeks=2 * (i + 1))
            else:
                payment_date = start_date + timedelta(days=30 * (i + 1))

            # Lender split
            interest_portion = round(remaining_principal * monthly_lender_rate, 2)
            principal_portion = round(lender_monthly - interest_portion, 2)

            # Last payment adjustment
            if i == term_months - 1:
                principal_portion = round(remaining_principal, 2)
                lender_payment = round(principal_portion + interest_portion, 2)
            else:
                lender_payment = round(lender_monthly, 2)

            remaining_principal = max(0, round(remaining_principal - principal_portion, 2))

            payments.append({
                "payment_number": i + 1,
                "due_date": payment_date,
                "total_amount": round(cab_fee_monthly + lender_payment, 2),
                "cab_fee": round(cab_fee_monthly, 2),
                "lender_principal": principal_portion,
                "lender_interest": interest_portion,
                "lender_total": lender_payment,
                "remaining_principal": remaining_principal,
                "status": "pending",
                "paid_date": None,
                "paid_amount": 0,
            })

        return {
            "payments": payments,
            "monthly_payment": monthly_payment,
            "cab_fee_per_payment": round(cab_fee_monthly, 2),
            "lender_per_payment": round(lender_monthly, 2),
            "total_cab_fees": round(total_cab_fees, 2),
            "total_lender_interest": round(total_lender_interest, 2),
            "total_lender_portion": round(total_lender_portion, 2),
            "total_payable": total_payable,
            "first_payment_date": first_payment_date,
            "maturity_date": payments[-1]["due_date"] if payments else start_date,
        }

    # ═══════════════════════════════════════════════
    # PAYMENT PROCESSING
    # ═══════════════════════════════════════════════

    async def record_payment(
        self,
        loan_id: str,
        amount: float,
        payment_method: str = "cash",
        reference: str = "",
        admin_id: str = "",
        admin_name: str = "",
    ) -> Dict:
        """Record a payment and split between CAB fee and lender portion"""
        loan = await self.collection.find_one({"_id": ObjectId(loan_id)})
        if not loan:
            raise ValueError("Loan not found")

        now = datetime.now(MIAMI_TZ)
        schedule = loan.get("payment_schedule", [])

        # Find next pending payment
        next_payment = None
        payment_idx = -1
        for i, p in enumerate(schedule):
            if p["status"] == "pending":
                next_payment = p
                payment_idx = i
                break

        if not next_payment:
            raise ValueError("No pending payments found")

        # Split the payment
        cab_fee = next_payment["cab_fee"]
        lender_portion = next_payment["lender_total"]

        # Mark payment as paid
        schedule[payment_idx]["status"] = "paid"
        schedule[payment_idx]["paid_date"] = now
        schedule[payment_idx]["paid_amount"] = amount

        # Record payment
        payment_record = {
            "loan_id": loan_id,
            "loan_number": loan.get("loan_number"),
            "client_name": loan.get("client_name"),
            "client_email": loan.get("client_email"),
            "payment_number": next_payment["payment_number"],
            "amount": amount,
            "cab_fee": cab_fee,
            "lender_portion": lender_portion,
            "payment_method": payment_method,
            "reference": reference,
            "recorded_by": admin_id,
            "recorded_by_name": admin_name,
            "trust_status": "pending_remittance",  # Needs to be sent to lender
            "created_at": now,
        }

        await self.payments_col.insert_one(payment_record)

        # Record trust account entry (lender's portion)
        await self.trust_col.insert_one({
            "loan_id": loan_id,
            "loan_number": loan.get("loan_number"),
            "client_name": loan.get("client_name"),
            "lender_name": loan.get("lender_name"),
            "amount": lender_portion,
            "type": "deposit",
            "status": "pending_remittance",
            "payment_number": next_payment["payment_number"],
            "created_at": now,
        })

        # Update loan totals
        payments_made = loan.get("payments_made", 0) + 1
        total_paid = loan.get("total_paid", 0) + amount
        total_cab_collected = loan.get("total_cab_collected", 0) + cab_fee
        total_lender_collected = loan.get("total_lender_collected", 0) + lender_portion
        outstanding = loan.get("outstanding_balance", 0) - amount
        lender_balance = next_payment.get("remaining_principal", 0)

        # Check if loan is fully paid
        status = loan["status"]
        if payments_made >= len(schedule):
            status = "paid_off"

        await self.collection.update_one(
            {"_id": ObjectId(loan_id)},
            {"$set": {
                "payment_schedule": schedule,
                "payments_made": payments_made,
                "total_paid": total_paid,
                "total_cab_collected": total_cab_collected,
                "total_lender_collected": total_lender_collected,
                "outstanding_balance": max(0, outstanding),
                "lender_balance_owed": lender_balance,
                "status": status,
                "updated_at": now,
            }}
        )

        logger.info(
            f"💰 Payment recorded: {loan.get('loan_number')} | #{next_payment['payment_number']} | "
            f"${amount:,.2f} (CAB: ${cab_fee:,.2f} | Lender: ${lender_portion:,.2f})"
        )

        return {
            "success": True,
            "payment_number": next_payment["payment_number"],
            "amount": amount,
            "cab_fee": cab_fee,
            "lender_portion": lender_portion,
            "payments_remaining": len(schedule) - payments_made,
            "outstanding_balance": max(0, outstanding),
            "status": status,
        }

    # ═══════════════════════════════════════════════
    # TRUST ACCOUNT MANAGEMENT
    # ═══════════════════════════════════════════════

    async def remit_to_lender(
        self,
        loan_id: str = "",
        lender_name: str = "",
        amount: float = 0,
        reference: str = "",
        admin_id: str = "",
    ) -> Dict:
        """Record remittance of funds to the third-party lender"""
        now = datetime.now(MIAMI_TZ)

        query = {"status": "pending_remittance"}
        if loan_id:
            query["loan_id"] = loan_id
        if lender_name:
            query["lender_name"] = lender_name

        pending = await self.trust_col.find(query).to_list(100)
        if not pending:
            raise ValueError("No pending remittances found")

        total_to_remit = sum(p.get("amount", 0) for p in pending)
        if amount > 0:
            total_to_remit = min(amount, total_to_remit)

        # Mark as remitted
        ids_to_update = [p["_id"] for p in pending]
        await self.trust_col.update_many(
            {"_id": {"$in": ids_to_update}},
            {"$set": {
                "status": "remitted",
                "remitted_at": now,
                "remittance_reference": reference,
            }}
        )

        # Update loan's lender remitted total
        if loan_id:
            await self.collection.update_one(
                {"_id": ObjectId(loan_id)},
                {"$inc": {"total_lender_remitted": total_to_remit}}
            )

        # Record remittance
        await self.trust_col.insert_one({
            "type": "remittance",
            "loan_id": loan_id,
            "lender_name": lender_name or "Third-Party Lender",
            "amount": total_to_remit,
            "reference": reference,
            "entries_count": len(pending),
            "status": "completed",
            "remitted_by": admin_id,
            "created_at": now,
        })

        logger.info(f"🏦 Remitted ${total_to_remit:,.2f} to lender ({len(pending)} entries)")

        return {
            "success": True,
            "amount_remitted": total_to_remit,
            "entries_processed": len(pending),
            "reference": reference,
        }

    async def get_trust_summary(self) -> Dict:
        """Get trust account summary"""
        pipeline_pending = [
            {"$match": {"type": "deposit", "status": "pending_remittance"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]
        pipeline_remitted = [
            {"$match": {"type": "remittance", "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]

        pending = await self.trust_col.aggregate(pipeline_pending).to_list(1)
        remitted = await self.trust_col.aggregate(pipeline_remitted).to_list(1)

        return {
            "pending_remittance": pending[0]["total"] if pending else 0,
            "pending_count": pending[0]["count"] if pending else 0,
            "total_remitted": remitted[0]["total"] if remitted else 0,
            "remittance_count": remitted[0]["count"] if remitted else 0,
        }

    # ═══════════════════════════════════════════════
    # QUERIES & DASHBOARD
    # ═══════════════════════════════════════════════

    async def get_loan(self, loan_id: str) -> Optional[Dict]:
        """Get a single loan with all details"""
        loan = await self.collection.find_one({"_id": ObjectId(loan_id)})
        if not loan:
            return None
        return self._serialize_loan(loan)

    async def list_loans(
        self, page: int = 1, limit: int = 20, status: str = "", search: str = ""
    ) -> Dict:
        """List all CAB loans with pagination"""
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"client_name": {"$regex": search, "$options": "i"}},
                {"client_email": {"$regex": search, "$options": "i"}},
                {"loan_number": {"$regex": search, "$options": "i"}},
            ]

        total = await self.collection.count_documents(query)
        loans = await self.collection.find(query).sort("created_at", -1).skip(
            (page - 1) * limit
        ).limit(limit).to_list(limit)

        return {
            "loans": [self._serialize_loan(l) for l in loans],
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
        }

    async def get_dashboard(self) -> Dict:
        """Get CAB dashboard statistics"""
        total = await self.collection.count_documents({})
        active = await self.collection.count_documents({"status": "active"})
        paid_off = await self.collection.count_documents({"status": "paid_off"})
        defaulted = await self.collection.count_documents({"status": "defaulted"})

        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$loan_amount"},
                "total_cab_fees": {"$sum": "$total_cab_collected"},
                "total_lender": {"$sum": "$total_lender_collected"},
            }}
        ]
        by_status = {}
        async for doc in self.collection.aggregate(pipeline):
            by_status[doc["_id"]] = {
                "count": doc["count"],
                "total_amount": doc["total_amount"],
                "total_cab_fees": doc["total_cab_fees"],
                "total_lender": doc["total_lender"],
            }

        trust = await self.get_trust_summary()

        # Recent payments
        recent_payments = await self.payments_col.find().sort(
            "created_at", -1
        ).limit(10).to_list(10)

        return {
            "total_loans": total,
            "active": active,
            "paid_off": paid_off,
            "defaulted": defaulted,
            "by_status": by_status,
            "trust_account": trust,
            "total_portfolio": sum(
                v.get("total_amount", 0) for v in by_status.values()
            ),
            "total_cab_revenue": sum(
                v.get("total_cab_fees", 0) for v in by_status.values()
            ),
            "recent_payments": [{
                "loan_number": p.get("loan_number"),
                "client_name": p.get("client_name"),
                "amount": p.get("amount"),
                "cab_fee": p.get("cab_fee"),
                "lender_portion": p.get("lender_portion"),
                "payment_method": p.get("payment_method"),
                "date": p.get("created_at").strftime("%m/%d/%Y %H:%M") if p.get("created_at") else "",
            } for p in recent_payments],
        }

    async def get_payment_history(self, loan_id: str) -> List[Dict]:
        """Get payment history for a loan"""
        payments = await self.payments_col.find(
            {"loan_id": loan_id}
        ).sort("created_at", -1).to_list(100)

        return [{
            "payment_number": p.get("payment_number"),
            "amount": p.get("amount"),
            "cab_fee": p.get("cab_fee"),
            "lender_portion": p.get("lender_portion"),
            "payment_method": p.get("payment_method"),
            "reference": p.get("reference", ""),
            "trust_status": p.get("trust_status"),
            "date": p.get("created_at").strftime("%m/%d/%Y") if p.get("created_at") else "",
        } for p in payments]

    # ═══════════════════════════════════════════════
    # OCCC REPORTING
    # ═══════════════════════════════════════════════

    async def generate_occc_report(self, year: int = 0, quarter: int = 0) -> Dict:
        """Generate data for OCCC Quarterly/Annual Report (Form CAB50)"""
        if not year:
            year = datetime.now(MIAMI_TZ).year

        # Determine date range
        if quarter and 1 <= quarter <= 4:
            quarter_ranges = {
                1: (datetime(year, 1, 1, tzinfo=MIAMI_TZ), datetime(year, 3, 31, 23, 59, 59, tzinfo=MIAMI_TZ)),
                2: (datetime(year, 4, 1, tzinfo=MIAMI_TZ), datetime(year, 6, 30, 23, 59, 59, tzinfo=MIAMI_TZ)),
                3: (datetime(year, 7, 1, tzinfo=MIAMI_TZ), datetime(year, 9, 30, 23, 59, 59, tzinfo=MIAMI_TZ)),
                4: (datetime(year, 10, 1, tzinfo=MIAMI_TZ), datetime(year, 12, 31, 23, 59, 59, tzinfo=MIAMI_TZ)),
            }
            start, end = quarter_ranges[quarter]
            report_type = "quarterly"
            period_label = f"Q{quarter} {year}"
            due_dates = {1: f"Abr 30, {year}", 2: f"Jul 31, {year}", 3: f"Oct 31, {year}", 4: f"Ene 31, {year+1}"}
            due_date = due_dates[quarter]
        else:
            start = datetime(year, 1, 1, tzinfo=MIAMI_TZ)
            end = datetime(year, 12, 31, 23, 59, 59, tzinfo=MIAMI_TZ)
            report_type = "annual"
            period_label = f"Anual {year}"
            due_date = f"Ene 31, {year+1}"

        query = {"created_at": {"$gte": start, "$lte": end}}

        # Loans originated in period
        originated = await self.collection.find(query).to_list(1000)
        total_originated = len(originated)
        total_amount_originated = sum(l.get("loan_amount", 0) for l in originated)
        total_cab_fees_charged = sum(l.get("total_cab_fees", 0) for l in originated)
        avg_loan_amount = total_amount_originated / total_originated if total_originated > 0 else 0
        avg_cab_fee_pct = sum(l.get("cab_fee_percent", 0) for l in originated) / total_originated if total_originated > 0 else 0
        avg_term = sum(l.get("term_months", 0) for l in originated) / total_originated if total_originated > 0 else 0

        # Breakdown by loan type (payday vs title)
        payday_loans = [l for l in originated if l.get("loan_type", "payday") == "payday"]
        title_loans = [l for l in originated if l.get("loan_type") == "title"]

        # Payments collected in period
        payment_query = {"created_at": {"$gte": start, "$lte": end}}
        payments = await self.payments_col.find(payment_query).to_list(10000)
        total_payments = len(payments)
        total_collected = sum(p.get("amount", 0) for p in payments)
        total_cab_collected = sum(p.get("cab_fee", 0) for p in payments)
        total_lender_collected = sum(p.get("lender_portion", 0) for p in payments)

        # Renewals/Refinances in period
        renewed = len([l for l in originated if l.get("status") == "renewed"])

        # Paid off in period
        paid_off_query = {"status": "paid_off", "updated_at": {"$gte": start, "$lte": end}}
        paid_off_count = await self.collection.count_documents(paid_off_query)

        # Delinquency
        all_active = await self.collection.find({"status": "active"}).to_list(1000)
        delinquent = 0
        now = datetime.now(MIAMI_TZ)
        for loan in all_active:
            for p in loan.get("payment_schedule", []):
                due = p.get("due_date")
                if due and isinstance(due, datetime):
                    if due.tzinfo is None:
                        due = due.replace(tzinfo=MIAMI_TZ)
                    if p.get("status") == "pending" and due < now:
                        delinquent += 1
                        break

        defaulted = await self.collection.count_documents(
            {"status": "defaulted", "created_at": {"$gte": start, "$lte": end}}
        )

        # Lender breakdown
        lender_summary = {}
        for l in originated:
            lname = l.get("lender_name", "Sin prestamista")
            if lname not in lender_summary:
                lender_summary[lname] = {"count": 0, "amount": 0, "cab_fees": 0}
            lender_summary[lname]["count"] += 1
            lender_summary[lname]["amount"] += l.get("loan_amount", 0)
            lender_summary[lname]["cab_fees"] += l.get("total_cab_fees", 0)

        return {
            "report_type": report_type,
            "report_year": year,
            "quarter": quarter if quarter else None,
            "period_label": period_label,
            "period_start": start.strftime("%m/%d/%Y"),
            "period_end": end.strftime("%m/%d/%Y"),
            "due_date": due_date,
            "generated_at": now.strftime("%m/%d/%Y %H:%M"),
            # Origination
            "loans_originated": total_originated,
            "total_amount_originated": round(total_amount_originated, 2),
            "total_cab_fees_charged": round(total_cab_fees_charged, 2),
            "average_loan_amount": round(avg_loan_amount, 2),
            "average_cab_fee_percent": round(avg_cab_fee_pct, 1),
            "average_term_months": round(avg_term, 1),
            # By type
            "payday_loans": len(payday_loans),
            "payday_amount": round(sum(l.get("loan_amount", 0) for l in payday_loans), 2),
            "title_loans": len(title_loans),
            "title_amount": round(sum(l.get("loan_amount", 0) for l in title_loans), 2),
            # Collections
            "total_payments_collected": total_payments,
            "total_amount_collected": round(total_collected, 2),
            "total_cab_fees_collected": round(total_cab_collected, 2),
            "total_lender_remitted": round(total_lender_collected, 2),
            # Status
            "renewals_refinances": renewed,
            "loans_paid_off": paid_off_count,
            "active_loans": len(all_active),
            "delinquent_loans": delinquent,
            "delinquency_rate": round(delinquent / len(all_active) * 100, 1) if all_active else 0,
            "defaulted_loans": defaulted,
            "default_rate": round(defaulted / total_originated * 100, 1) if total_originated else 0,
            # By lender
            "lender_breakdown": lender_summary,
        }

    # ═══════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════

    async def add_note(self, loan_id: str, note: str, admin_name: str = "") -> Dict:
        """Add a note to a loan"""
        now = datetime.now(MIAMI_TZ)
        await self.collection.update_one(
            {"_id": ObjectId(loan_id)},
            {
                "$push": {"notes": {"text": note, "by": admin_name, "date": now}},
                "$set": {"updated_at": now},
            }
        )
        return {"success": True}

    async def update_status(self, loan_id: str, status: str, note: str = "") -> Dict:
        """Update loan status"""
        if status not in LOAN_STATUSES:
            raise ValueError(f"Invalid status. Valid: {LOAN_STATUSES}")
        now = datetime.now(MIAMI_TZ)
        update: Dict[str, Any] = {"$set": {"status": status, "updated_at": now}}
        if note:
            update["$push"] = {"notes": {"text": f"Status → {status}: {note}", "by": "admin", "date": now}}
        await self.collection.update_one({"_id": ObjectId(loan_id)}, update)
        return {"success": True, "status": status}

    def _serialize_loan(self, loan: Dict) -> Dict:
        """Serialize a loan document for API response"""
        def fmt_date(d):
            if isinstance(d, datetime):
                return d.strftime("%m/%d/%Y")
            return str(d) if d else ""

        schedule = []
        for p in loan.get("payment_schedule", []):
            schedule.append({
                "payment_number": p.get("payment_number"),
                "due_date": fmt_date(p.get("due_date")),
                "total_amount": p.get("total_amount"),
                "cab_fee": p.get("cab_fee"),
                "lender_principal": p.get("lender_principal"),
                "lender_interest": p.get("lender_interest"),
                "lender_total": p.get("lender_total"),
                "remaining_principal": p.get("remaining_principal"),
                "status": p.get("status"),
                "paid_date": fmt_date(p.get("paid_date")),
                "paid_amount": p.get("paid_amount", 0),
            })

        notes = []
        for n in loan.get("notes", []):
            notes.append({
                "text": n.get("text"),
                "by": n.get("by", ""),
                "date": fmt_date(n.get("date")),
            })

        return {
            "id": str(loan["_id"]),
            "loan_number": loan.get("loan_number", ""),
            "client_name": loan.get("client_name", ""),
            "client_email": loan.get("client_email", ""),
            "client_phone": loan.get("client_phone", ""),
            "client_address": loan.get("client_address", ""),
            "ssn_last4": loan.get("ssn_last4", ""),
            "loan_amount": loan.get("loan_amount", 0),
            "cab_fee_percent": loan.get("cab_fee_percent", 0),
            "term_months": loan.get("term_months", 0),
            "lender_interest_annual": loan.get("lender_interest_annual", 0),
            "lender_name": loan.get("lender_name", ""),
            "payment_frequency": loan.get("payment_frequency", ""),
            "start_date": fmt_date(loan.get("start_date")),
            "first_payment_date": fmt_date(loan.get("first_payment_date")),
            "maturity_date": fmt_date(loan.get("maturity_date")),
            "monthly_payment": loan.get("monthly_payment", 0),
            "cab_fee_per_payment": loan.get("cab_fee_per_payment", 0),
            "lender_per_payment": loan.get("lender_per_payment", 0),
            "total_cab_fees": loan.get("total_cab_fees", 0),
            "total_lender_portion": loan.get("total_lender_portion", 0),
            "total_payable": loan.get("total_payable", 0),
            "payments_made": loan.get("payments_made", 0),
            "total_paid": loan.get("total_paid", 0),
            "total_cab_collected": loan.get("total_cab_collected", 0),
            "total_lender_collected": loan.get("total_lender_collected", 0),
            "total_lender_remitted": loan.get("total_lender_remitted", 0),
            "outstanding_balance": loan.get("outstanding_balance", 0),
            "lender_balance_owed": loan.get("lender_balance_owed", 0),
            "status": loan.get("status", ""),
            "auto_pay": loan.get("auto_pay", False),
            "payment_schedule": schedule,
            "notes": notes,
            "contracts_generated": loan.get("contracts_generated", False),
            "created_at": fmt_date(loan.get("created_at")),
            "updated_at": fmt_date(loan.get("updated_at")),
        }
