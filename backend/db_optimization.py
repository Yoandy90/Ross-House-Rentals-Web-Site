"""
═══════════════════════════════════════════════════════════════════════════════
 Database Optimization — Ross Lending Solutions LLC
 Creates indexes for all critical collections to speed up queries.
 Run this once (idempotent — safe to re-run).
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def create_indexes(db):
    """Create indexes for all critical collections. Idempotent."""
    t = datetime.utcnow()
    indexes_created = 0

    try:
        # regulated_loans — most queried collection
        await db["regulated_loans"].create_index("status")
        await db["regulated_loans"].create_index("client_email")
        await db["regulated_loans"].create_index("client_name")
        await db["regulated_loans"].create_index("loan_number")
        await db["regulated_loans"].create_index("next_payment_date")
        await db["regulated_loans"].create_index([("status", 1), ("next_payment_date", 1)])
        indexes_created += 6

        # collection_actions — used in aggregations
        await db["collection_actions"].create_index("loan_id")
        await db["collection_actions"].create_index("created_at")
        await db["collection_actions"].create_index([("loan_id", 1), ("created_at", -1)])
        indexes_created += 3

        # payment_plans
        await db["payment_plans"].create_index("loan_id")
        await db["payment_plans"].create_index("status")
        await db["payment_plans"].create_index([("loan_id", 1), ("status", 1)])
        indexes_created += 3

        # credit_checks
        await db["credit_checks"].create_index("applicant_name")
        await db["credit_checks"].create_index("ssn_last4")
        await db["credit_checks"].create_index("pulled_at")
        await db["credit_checks"].create_index("pull_type")
        indexes_created += 4

        # client_documents
        await db["client_documents"].create_index("user_id")
        await db["client_documents"].create_index("status")
        await db["client_documents"].create_index([("status", 1), ("uploaded_at", -1)])
        indexes_created += 3

        # audit_logs
        await db["audit_logs"].create_index("created_at")
        await db["audit_logs"].create_index("module")
        await db["audit_logs"].create_index("action")
        await db["audit_logs"].create_index([("module", 1), ("created_at", -1)])
        indexes_created += 4

        # approval evaluations
        await db["approval_evaluations"].create_index("evaluated_at")
        indexes_created += 1

        # collection_reminder_log
        await db["collection_reminder_log"].create_index("sent_date")
        await db["collection_reminder_log"].create_index([("loan_id", 1), ("config_name", 1), ("sent_date", 1)])
        indexes_created += 2

        # metro2_exports
        await db["metro2_exports"].create_index("created_at")
        indexes_created += 1

        # users
        await db["users"].create_index("email", unique=True, sparse=True)
        await db["users"].create_index("phone", sparse=True)
        indexes_created += 2

        elapsed = (datetime.utcnow() - t).total_seconds()
        logger.info(f"✅ DB Optimization: {indexes_created} indexes created/ensured in {elapsed:.2f}s")

    except Exception as e:
        logger.warning(f"DB Index creation partial failure: {e}")

    return indexes_created
