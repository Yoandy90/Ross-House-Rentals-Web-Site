"""
router_registry.py — Centralized router registration for the FastAPI app.
Extracted from server.py for cleaner architecture.

All routers are organized into logical groups and registered in a
deterministic order to preserve FastAPI's path-matching behavior.
"""

import logging
import asyncio


# ═══════════════════════════════════════════════════════════════
#  Helper: safe registration with try/except
# ═══════════════════════════════════════════════════════════════

def _safe_register(app, router, *, prefix='/api', tags=None, label=''):
    """Register a router, catching import / init errors gracefully."""
    try:
        app.include_router(router, prefix=prefix, tags=tags or [])
        if label:
            print(f"  ✅ {label}")
    except Exception as e:
        print(f"  ⚠️  {label or 'Router'} not registered: {e}")


# ═══════════════════════════════════════════════════════════════
#  Main entry point
# ═══════════════════════════════════════════════════════════════

def register_all_routers(app, db, api_router, get_current_user, require_admin, get_user_from_token):
    """Register every router on the FastAPI app in the correct order."""

    print("\n🔧 Registering routers …")

    # ── 0. Core API router (shared by carousel & user-management) ──
    app.include_router(api_router)

    # ── 1. Auth & Security ─────────────────────────────────────
    _register_auth(app, db, get_current_user, require_admin)

    # ── 2. IRS / Tax Services ──────────────────────────────────
    _register_irs_tax(app, db, get_current_user, require_admin)

    # ── 3. Admin Panel ─────────────────────────────────────────
    _register_admin(app, db, api_router, get_current_user, require_admin, get_user_from_token)

    # ── 4. Appointments & Calendar ─────────────────────────────
    _register_appointments(app, db)

    # ── 5. Payments & Billing ──────────────────────────────────
    _register_payments(app, db, get_current_user, require_admin)

    # ── 6. Lending & Collections ───────────────────────────────
    _register_lending(app, db, get_current_user, require_admin)

    # ── 7. Immigration ─────────────────────────────────────────
    _register_immigration(app, db, get_current_user)

    # ── 8. Communication (Chat, Email, WhatsApp, Notifications) ─
    _register_communication(app, db, get_current_user, require_admin)

    # ── 9. Bookkeeping ─────────────────────────────────────────
    _register_bookkeeping(app, db)

    # ── 10. AI & Automation ────────────────────────────────────
    _register_ai(app, db, get_current_user, require_admin)

    # ── 11. CRM & Projects ────────────────────────────────────
    _register_crm(app, db)

    # ── 12. Business Tools (User-facing) ──────────────────────
    _register_business_tools(app, db, get_current_user, require_admin)

    # ── 13. Misc & Legacy ─────────────────────────────────────
    _register_misc(app, db, api_router, get_current_user, require_admin)

    print("🔧 All routers registered ✅\n")


# ═══════════════════════════════════════════════════════════════
#  1. Auth & Security
# ═══════════════════════════════════════════════════════════════

def _register_auth(app, db, get_current_user, require_admin):
    print("  ── Auth & Security ──")

    from auth_routes import auth_router, init_auth_router
    init_auth_router(db)
    app.include_router(auth_router, prefix='/api', tags=['Auth'])

    from two_factor_routes import two_factor_router, init_two_factor_router
    init_two_factor_router(db)
    app.include_router(two_factor_router, prefix='/api', tags=['Two-Factor Auth'])
    print("  ✅ Auth + 2FA routes")

    from password_reset_endpoints import router as password_reset_router
    app.include_router(password_reset_router, prefix='/api')
    print("  ✅ Password Reset routes")

    from rbac_mfa_router import rbac_mfa_router, init_rbac_mfa
    from client_2fa_router import client_2fa_router, init_client_2fa
    init_rbac_mfa(db, get_current_user)
    init_client_2fa(db)
    app.include_router(rbac_mfa_router, prefix='/api')
    app.include_router(client_2fa_router, prefix='/api')
    print("  ✅ RBAC + MFA routes")


# ═══════════════════════════════════════════════════════════════
#  2. IRS / Tax Services
# ═══════════════════════════════════════════════════════════════

def _register_irs_tax(app, db, get_current_user, require_admin):
    print("  ── IRS / Tax Services ──")

    try:
        from iris_service import IRISService
        from iris_endpoints import iris_router, set_iris_service
        iris_svc = IRISService(db)
        set_iris_service(iris_svc, get_current_user)
        app.include_router(iris_router, prefix='/api', tags=['IRS IRIS'])
        print("  ✅ IRS IRIS A2A (TCC: DH55D)")
    except Exception as e:
        print(f"  ⚠️  IRIS: {e}")

    try:
        from tds_service import TDSService
        from tds_endpoints import tds_router, set_tds_service
        tds_svc = TDSService(db)
        set_tds_service(tds_svc, get_current_user)
        app.include_router(tds_router, prefix='/api', tags=['IRS TDS Transcripts'])
        print("  ✅ IRS TDS Transcripts")
    except Exception as e:
        print(f"  ⚠️  TDS: {e}")

    try:
        from tax_services import TranscriptParser, RefundTracker, ServiceBilling, ClientDashboardService
        from tax_services_endpoints import tax_services_router, set_tax_services
        tax_parser = TranscriptParser(db)
        tax_refund = RefundTracker(db)
        tax_billing = ServiceBilling(db)
        tax_client_dash = ClientDashboardService(db)
        set_tax_services(tax_parser, tax_refund, tax_billing, tax_client_dash, get_current_user, get_current_user)
        app.include_router(tax_services_router, prefix='/api', tags=['Tax Services'])
        print("  ✅ Tax Services (Transcripts, Refunds, Billing)")
    except Exception as e:
        print(f"  ⚠️  Tax Services: {e}")

    try:
        from form4506c_service import Form4506CService
        from form4506c_endpoints import form4506c_router, set_form4506c_service
        form4506c_svc = Form4506CService(db)
        set_form4506c_service(form4506c_svc, admin_auth=get_current_user)
        app.include_router(form4506c_router, prefix='/api', tags=['Form 4506-C'])
        print("  ✅ Form 4506-C E-Signature")
    except Exception as e:
        print(f"  ⚠️  Form 4506-C: {e}")

    from irs_eservices_endpoints import router as irs_eservices_router
    app.include_router(irs_eservices_router, prefix='/api', tags=['IRS e-Services'])
    print("  ✅ IRS e-Services")

    try:
        from irs_tin_matching import router as tin_matching_router, init_tin_matching
        init_tin_matching(db, get_current_user)
        app.include_router(tin_matching_router, prefix='/api')
        print("  ✅ IRS TIN Matching")
    except Exception as e:
        print(f"  ⚠️  TIN Matching: {e}")

    from tax_returns_routes import tax_returns_router, init_tax_returns_router
    init_tax_returns_router(db)
    app.include_router(tax_returns_router, prefix='/api', tags=['Tax Returns'])
    print("  ✅ Tax Returns")

    from tax_season_routes import tax_season_router, init_tax_season_router
    init_tax_season_router(db)
    app.include_router(tax_season_router, prefix='/api', tags=['Tax Season Tracking'])
    print("  ✅ Tax Season Tracking")

    from tax_seasons_mgmt_routes import tax_seasons_mgmt_router, init_tax_seasons_mgmt_router
    init_tax_seasons_mgmt_router(db)
    from season_context import init_season_context
    init_season_context(db)
    app.include_router(tax_seasons_mgmt_router, prefix='/api', tags=['Tax Seasons Management'])
    print("  ✅ Tax Seasons Management + Season Context")

    from tax_preparer_endpoints import tax_prep_router, set_tax_preparer_service
    from tax_preparer_service import init_tax_preparer_service
    app.include_router(tax_prep_router, prefix='/api', tags=['Tax Preparer'])
    print("  ✅ Tax Preparer")

    from pdf_extractor_routes import router as pdf_extractor_router
    app.include_router(pdf_extractor_router, tags=['PDF Extractor'])
    print("  ✅ PDF Extractor")

    from tax_wizard import TaxWizardService, tax_wizard_router
    app.include_router(tax_wizard_router, prefix='/api', tags=['Tax Wizard'])
    print("  ✅ Tax Wizard")

    from refund_tracker_endpoints import router as refund_tracker_router, init_refund_tracker
    init_refund_tracker(db, get_current_user, require_admin, None)
    app.include_router(refund_tracker_router, prefix='/api', tags=['Refund Tracking'])
    print("  ✅ Refund Tracker")

    from receipts_routes import receipts_router, init_receipts_router
    init_receipts_router(db)
    app.include_router(receipts_router, prefix='/api', tags=['Receipts'])
    print("  ✅ Receipts Management")

    from receipt_classification_routes import receipt_classification_router, init_receipt_classification_router
    init_receipt_classification_router(db)
    app.include_router(receipt_classification_router, prefix='/api', tags=['Receipt Classification'])
    print("  ✅ Receipt Classification")

    from receipt_generator_routes import receipt_generator_router
    app.include_router(receipt_generator_router, prefix="/api", tags=['Receipt Generator'])
    print("  ✅ Receipt Generator")

    from dependents_routes import router as dependents_router, set_db as set_dependents_db
    set_dependents_db(db)
    app.include_router(dependents_router, prefix='/api', tags=['Dependents'])
    print("  ✅ Dependents CRUD")

    from season_import_endpoints import init_season_endpoints
    season_router = init_season_endpoints(db)
    app.include_router(season_router)
    print("  ✅ Season Import")


# ═══════════════════════════════════════════════════════════════
#  3. Admin Panel
# ═══════════════════════════════════════════════════════════════

def _register_admin(app, db, api_router, get_current_user, require_admin, get_user_from_token):
    print("  ── Admin Panel ──")

    from admin_dashboard_routes import admin_dashboard_router, init_admin_dashboard_router
    init_admin_dashboard_router(db)
    app.include_router(admin_dashboard_router, prefix='/api', tags=['Admin Dashboard'])
    print("  ✅ Admin Dashboard")

    from admin_users_routes import admin_users_router, init_admin_users_router
    init_admin_users_router(db)
    app.include_router(admin_users_router, prefix='/api', tags=['Admin Users'])
    print("  ✅ Admin Users")

    from admin_clients_mgmt_routes import admin_clients_mgmt_router, init_admin_clients_mgmt_router
    init_admin_clients_mgmt_router(db)
    app.include_router(admin_clients_mgmt_router, prefix='/api', tags=['Admin Client Management'])
    print("  ✅ Admin Client Management")

    from admin_clients_export_routes import admin_clients_export_router, init_admin_clients_export_router
    init_admin_clients_export_router(db)
    app.include_router(admin_clients_export_router, prefix='/api', tags=['Admin Clients Export'])
    print("  ✅ Admin Clients Export")

    from admin_services_routes import admin_services_router, init_admin_services_router
    init_admin_services_router(db)
    app.include_router(admin_services_router, prefix='/api', tags=['Admin Services'])
    print("  ✅ Admin Services")

    from admin_appt_detail_routes import admin_appt_detail_router, init_admin_appt_detail_router
    init_admin_appt_detail_router(db)
    app.include_router(admin_appt_detail_router, prefix='/api', tags=['Admin Appointments Detail'])
    print("  ✅ Admin Appointments Detail")

    try:
        from admin_tools_endpoints import router as admin_tools_router, set_db as set_tools_db
        set_tools_db(db)
        app.include_router(admin_tools_router, prefix='/api/admin', tags=['Admin Tools'])
        print("  ✅ Admin Tools")
    except Exception as e:
        print(f"  ⚠️  Admin Tools: {e}")

    try:
        from admin_notifications_routes import admin_notifications_router, init_admin_notifications_router
        init_admin_notifications_router(db)
        app.include_router(admin_notifications_router, prefix='/api', tags=['Admin Notifications'])
        print("  ✅ Admin Notifications")
    except Exception as e:
        print(f"  ⚠️  Admin Notifications: {e}")

    try:
        from admin_biz_modules_routes import router as admin_biz_router, set_db as set_admin_biz_db
        set_admin_biz_db(db)
        app.include_router(admin_biz_router, prefix='/api', tags=['Admin Biz Modules'])
        print("  ✅ Admin Biz Modules")
    except Exception as e:
        print(f"  ⚠️  Admin Biz Modules: {e}")

    try:
        from admin_reports_routes import router as admin_reports_router, init_admin_reports
        init_admin_reports(db)
        app.include_router(admin_reports_router, prefix='/api', tags=['Admin Reports'])
        print("  ✅ Admin Reports")
    except Exception as e:
        print(f"  ⚠️  Admin Reports: {e}")

    try:
        from subscription_admin_routes import subscription_admin_router
        app.include_router(subscription_admin_router, prefix='/api', tags=['Admin Subscriptions'])
        print("  ✅ Admin Subscriptions")
    except Exception as e:
        print(f"  ⚠️  Admin Subscriptions: {e}")

    # These use api_router directly
    try:
        from carousel_endpoints import init_carousel_endpoints
        init_carousel_endpoints(app, api_router, db, get_current_user)
    except Exception as e:
        print(f"  ⚠️  Carousel: {e}")

    try:
        from user_management_endpoints import init_user_management_endpoints
        init_user_management_endpoints(app, api_router, db, require_admin, get_current_user)
    except Exception as e:
        print(f"  ⚠️  User Management: {e}")

    try:
        from server_inline_routes import router as inline_routes_router, init_inline_routes
        init_inline_routes(db, get_current_user, require_admin, secret_key='ross-tax-secret-key-2025-change-in-production')
        app.include_router(inline_routes_router, tags=['Server Inline Routes'])
        print("  ✅ Server Inline Routes (Config, Rental CRUD, Downloads, Health)")
    except Exception as e:
        print(f"  ⚠️  Server Inline Routes: {e}")

    try:
        from config_endpoints import router as config_router
        app.include_router(config_router)
        print("  ✅ Configuration Management")
    except Exception as e:
        print(f"  ⚠️  Config endpoints: {e}")

    try:
        from api_config_endpoints import router as api_config_router
        app.include_router(api_config_router, prefix='/api')
        print("  ✅ API Config (Credential Management)")
    except Exception as e:
        print(f"  ⚠️  API Config: {e}")

    try:
        from api_config_routes import router as unified_config_router
        app.include_router(unified_config_router, prefix='/api', tags=['Unified Config'])
        print("  ✅ Unified Config Manager")
    except Exception as e:
        print(f"  ⚠️  Unified Config: {e}")

    try:
        from ai_prompts_endpoints import router as ai_prompts_router, set_database as set_prompts_db
        set_prompts_db(db)
        app.include_router(ai_prompts_router, prefix='/api/admin', tags=['AI Prompts'])
        print("  ✅ AI Prompts Management")
    except Exception as e:
        print(f"  ⚠️  AI Prompts: {e}")

    try:
        from dynamic_fields_system import dynamic_fields_router, initialize_dynamic_fields_schema
        app.include_router(dynamic_fields_router, tags=['Dynamic Fields'])
        print("  ✅ Dynamic Fields System")
    except Exception as e:
        print(f"  ⚠️  Dynamic Fields: {e}")

    try:
        from feature_flags_endpoints import init_feature_flags_endpoints
        init_feature_flags_endpoints(app, api_router, require_admin, lambda: db)
        print("  ✅ Feature Flags")
    except Exception as e:
        print(f"  ⚠️  Feature Flags: {e}")


# ═══════════════════════════════════════════════════════════════
#  4. Appointments & Calendar
# ═══════════════════════════════════════════════════════════════

def _register_appointments(app, db):
    print("  ── Appointments & Calendar ──")

    from appointment_routes import appointment_router, init_appointment_router
    init_appointment_router(db)
    app.include_router(appointment_router, prefix='/api', tags=['Appointments'])
    print("  ✅ Appointments")

    from calendar_routes import calendar_router, init_calendar_router
    init_calendar_router(db)
    app.include_router(calendar_router, prefix='/api', tags=['Calendar'])
    print("  ✅ Calendar")

    from appointment_types_routes import appointment_types_router, init_appointment_types_router
    init_appointment_types_router(db)
    app.include_router(appointment_types_router, prefix='/api', tags=['Appointment Types'])
    print("  ✅ Appointment Types")

    from office_hours_endpoints import router as office_hours_router, init_office_hours_endpoints
    init_office_hours_endpoints(db)
    app.include_router(office_hours_router, prefix='/api')
    print("  ✅ Office Hours")


# ═══════════════════════════════════════════════════════════════
#  5. Payments & Billing
# ═══════════════════════════════════════════════════════════════

def _register_payments(app, db, get_current_user, require_admin):
    print("  ── Payments & Billing ──")

    from payment_endpoints import payment_router, init_payment_endpoints
    init_payment_endpoints(db)
    app.include_router(payment_router, prefix='/api')
    print("  ✅ Payment Endpoints (Stripe)")

    from subscription_management_endpoints import router as subscription_mgmt_router, init_subscription_management
    init_subscription_management(db)
    app.include_router(subscription_mgmt_router, prefix='/api')
    print("  ✅ Subscription Management")

    from subscription_routes import subscription_router, init_subscription_router
    init_subscription_router(db)
    app.include_router(subscription_router, prefix='/api', tags=['Subscriptions'])
    print("  ✅ Subscriptions")

    from clover_router import clover_router, init_clover_router
    init_clover_router(db, get_current_user)
    app.include_router(clover_router, prefix='/api', tags=['Clover POS'])
    print("  ✅ Clover POS")

    from payment_links_routes import payment_links_router, init_payment_links_router
    init_payment_links_router(db)
    app.include_router(payment_links_router, prefix='/api', tags=['Payment Links'])
    print("  ✅ Payment Links")

    from stripe_checkout_endpoints import router as stripe_checkout_router, set_database as set_stripe_checkout_db
    set_stripe_checkout_db(db)
    app.include_router(stripe_checkout_router, prefix='/api')
    print("  ✅ Stripe Checkout")

    from merchant_one_endpoints import merchant_router, set_merchant_service, set_plans_service, set_scheduled_batch_service, set_ach_auth_service, set_dunning_service
    app.include_router(merchant_router, prefix='/api', tags=['Merchant One ACH'])
    print("  ✅ Merchant One ACH")

    from withdrawal_endpoints import withdrawal_router, init_withdrawal_endpoints
    init_withdrawal_endpoints(db)
    app.include_router(withdrawal_router, prefix='/api/payments')
    print("  ✅ Withdrawal Requests")

    from ach_endpoints import ach_router, init_ach_endpoints
    from ach_service import ACHPaymentService
    ach_payment_service = ACHPaymentService(db)
    asyncio.create_task(ach_payment_service.initialize_nacha_versions())
    asyncio.create_task(ach_payment_service.initialize_async())
    init_ach_endpoints(ach_payment_service)
    app.include_router(ach_router, prefix='/api/payments')
    print("  ✅ ACH Payments (Authorize.net)")

    from service_payment_routes import router as service_payment_router, init_service_payment_router
    init_service_payment_router(db)
    app.include_router(service_payment_router, prefix='/api', tags=['Service & Payment'])
    print("  ✅ Service & Payment")

    from identity_routes import router as identity_router
    app.include_router(identity_router, tags=['Identity Verification'])
    print("  ✅ Stripe Identity Verification")

    return ach_payment_service


# ═══════════════════════════════════════════════════════════════
#  6. Lending & Collections
# ═══════════════════════════════════════════════════════════════

def _register_lending(app, db, get_current_user, require_admin):
    print("  ── Lending & Collections ──")

    from loan_management_router import loan_mgmt_router, init_loan_management
    init_loan_management(db, get_current_user)
    app.include_router(loan_mgmt_router, prefix='/api')
    print("  ✅ Loan Management")

    from regulated_lender_router import regulated_lender_router, init_regulated_lender
    init_regulated_lender(db, get_current_user, None)
    app.include_router(regulated_lender_router, prefix='/api')
    print("  ✅ Regulated Lender (Ch.342)")

    from client_loans_router import client_loans_router, init_client_loans_router
    init_client_loans_router(db, get_current_user)
    app.include_router(client_loans_router, prefix='/api')
    print("  ✅ Client Loans")

    from cab_endpoints import router as cab_router, init_cab_endpoints
    init_cab_endpoints(db, get_current_user, require_admin)
    app.include_router(cab_router, prefix='/api', tags=['CAB Loans'])
    print("  ✅ CAB Loans")

    from credit_check_router import credit_check_router, init_credit_check
    init_credit_check(db, get_current_user)
    app.include_router(credit_check_router, prefix='/api', tags=['Credit Check'])
    print("  ✅ Credit Check")

    from collections_router import collections_router, init_collections
    init_collections(db, get_current_user)
    app.include_router(collections_router, prefix='/api', tags=['Collections & Metro 2'])
    print("  ✅ Collections & Metro 2")

    from approval_engine_router import approval_engine_router, init_approval_engine
    init_approval_engine(db, get_current_user)
    app.include_router(approval_engine_router, prefix='/api', tags=['Approval Engine'])
    print("  ✅ Approval Engine")

    from auto_collections_router import auto_collections_router, init_auto_collections
    init_auto_collections(db, get_current_user)
    app.include_router(auto_collections_router, prefix='/api', tags=['Auto Collections'])
    print("  ✅ Auto Collections")

    from document_upload_router import doc_upload_router, init_doc_upload
    init_doc_upload(db, get_current_user)
    app.include_router(doc_upload_router, prefix='/api', tags=['Document Upload'])
    print("  ✅ Document Upload (KYC)")

    from lending_admin_dashboard_router import router as lending_dashboard_router, init_admin_dashboard
    init_admin_dashboard(db, get_current_user)
    app.include_router(lending_dashboard_router, prefix='/api')
    print("  ✅ Lending Admin Dashboard")

    from audit_trail_router import audit_trail_router, init_audit_trail
    init_audit_trail(db, get_current_user)
    app.include_router(audit_trail_router, prefix='/api')
    print("  ✅ Audit Trail")

    from compliance_router import compliance_router, init_compliance
    init_compliance(db, get_current_user)
    app.include_router(compliance_router, prefix='/api')
    print("  ✅ Compliance (OCCC)")

    from lending_routes import lending_router, init_lending_router
    init_lending_router(db)
    app.include_router(lending_router, tags=['Ross Lending'])
    print("  ✅ Ross Lending")

    from lending_chat_routes import router as lending_chat_router
    app.include_router(lending_chat_router, tags=['Lending Chat'])
    print("  ✅ Lending Chat")

    from lending_config_router import router as lending_config_router, init_lending_config_router
    init_lending_config_router(db)
    app.include_router(lending_config_router, tags=['Lending Config'])
    print("  ✅ Lending Config")

    try:
        from plaid_service import init_plaid_service
        from capital_pool_service import init_capital_pool
        @app.on_event("startup")
        async def _init_lending_services():
            try:
                await init_plaid_service(db)
            except Exception as e:
                print(f"  ⚠️  Plaid init: {e}")
            try:
                await init_capital_pool(db)
            except Exception as e:
                print(f"  ⚠️  Capital pool init: {e}")
    except Exception as e:
        print(f"  ⚠️  Lending services import: {e}")


# ═══════════════════════════════════════════════════════════════
#  7. Immigration
# ═══════════════════════════════════════════════════════════════

def _register_immigration(app, db, get_current_user):
    print("  ── Immigration ──")

    from immigration_routes import immigration_router, init_immigration_router
    init_immigration_router(db)
    app.include_router(immigration_router, prefix='/api', tags=['Immigration'])
    print("  ✅ Immigration Routes")

    from immigration_case_routes import router as immigration_case_router, set_db as set_immigration_case_db, start_immigration_polling
    set_immigration_case_db(db)
    app.include_router(immigration_case_router, prefix='/api', tags=['Immigration-Cases'])
    start_immigration_polling()
    print("  ✅ Immigration Case Tracking (polling enabled)")

    from immigration_admin_routes import router as immigration_admin_router, set_immigration_admin_db
    set_immigration_admin_db(db)
    app.include_router(immigration_admin_router, prefix='/api', tags=['Immigration-Admin'])
    print("  ✅ Immigration Admin (Mi Caso USA)")

    from immigration_chat_routes import router as immigration_chat_router, set_chat_db
    set_chat_db(db)
    app.include_router(immigration_chat_router, prefix='/api', tags=['Immigration-Chat'])
    print("  ✅ Immigration Chat (Premium)")

    from immigration_enterprise_routes import router as enterprise_router, set_enterprise_db
    set_enterprise_db(db)
    app.include_router(enterprise_router, prefix='/api', tags=['Immigration-Enterprise'])
    print("  ✅ Immigration Enterprise")

    from immigration_motions_endpoints import motions_router, set_motions_service, set_document_generator
    from immigration_motions_service import ImmigrationMotionsService
    from motion_document_generator import MotionDocumentGenerator
    app.include_router(motions_router, prefix='/api', tags=['Immigration Motions'])
    print("  ✅ Immigration Motions")

    from eoir_routes import eoir_router, init_eoir_router
    init_eoir_router(db)
    app.include_router(eoir_router, prefix='/api', tags=['EOIR Case Lookup'])
    print("  ✅ EOIR Case Lookup")

    from passport_routes import passport_router, init_passport_router
    init_passport_router(db)
    app.include_router(passport_router, prefix='/api', tags=['Passport'])
    print("  ✅ Passport")


# ═══════════════════════════════════════════════════════════════
#  8. Communication
# ═══════════════════════════════════════════════════════════════

def _register_communication(app, db, get_current_user, require_admin):
    print("  ── Communication ──")

    from chat_routes import chat_router, init_chat_router
    init_chat_router(db)
    app.include_router(chat_router, prefix='/api', tags=['Chat'])
    print("  ✅ Chat (Admin + Client)")

    from email_routes import email_router, init_email_router
    from email_inbox_service import email_inbox_service
    email_inbox_service.set_dependencies(db, None)
    init_email_router(db, email_inbox_service)
    app.include_router(email_router, prefix='/api', tags=['Email'])
    print("  ✅ Email")

    from email_engine import init_email_engine
    init_email_engine(db)
    print("  ✅ Email Engine (AI booking + sent tracking)")

    from whatsapp_routes import whatsapp_router, init_whatsapp_router
    init_whatsapp_router(db)
    app.include_router(whatsapp_router, prefix='/api', tags=['WhatsApp'])
    print("  ✅ WhatsApp")

    from whatsapp_endpoints import whatsapp_router as whatsapp_endpoints_router
    app.include_router(whatsapp_endpoints_router, prefix='/api')
    print("  ✅ WhatsApp Endpoints")

    from marketing_routes import marketing_router, init_marketing_router
    init_marketing_router(db)
    app.include_router(marketing_router, prefix='/api', tags=['Marketing'])
    print("  ✅ Marketing")

    from campaign_routes import campaign_routes_router, init_campaign_routes_router
    init_campaign_routes_router(db)
    app.include_router(campaign_routes_router, prefix='/api', tags=['Campaigns'])
    print("  ✅ Campaigns")

    from client_notes_router import client_notes_router, init_client_notes_router
    init_client_notes_router(db, get_current_user)
    app.include_router(client_notes_router, prefix='/api', tags=['Client Notes'])
    print("  ✅ Client Notes")

    from notification_templates_router import notif_templates_router, init_notif_templates_router
    init_notif_templates_router(db, get_current_user)
    app.include_router(notif_templates_router, prefix='/api', tags=['Notification Templates'])
    print("  ✅ Notification Templates")

    from email_templates_routes import templates_router, init_templates_router
    init_templates_router(db)
    app.include_router(templates_router, tags=['Email Templates'])
    print("  ✅ Email Templates")

    from email_campaign_endpoints import router as email_campaign_router, set_campaign_service
    from email_campaign_service import EmailCampaignService
    email_campaign_svc = EmailCampaignService(db)
    set_campaign_service(email_campaign_svc)
    app.include_router(email_campaign_router, prefix='/api', tags=['Email Campaigns'])
    print("  ✅ Email Campaigns")

    from sendgrid_webhook_handler import router as sendgrid_webhook_router, init_sendgrid_webhook_handler
    init_sendgrid_webhook_handler(db)
    app.include_router(sendgrid_webhook_router, prefix='/api')
    print("  ✅ SendGrid Webhook Handler")

    from business_contact_routes import business_router
    app.include_router(business_router, prefix='/api', tags=['Business Contact'])
    print("  ✅ Business Contact & Email Config")

    from contact_routes import contact_router, init_contact_routes
    init_contact_routes(db)
    app.include_router(contact_router)
    print("  ✅ Contact Form")

    from email_sender import init_email_sender
    init_email_sender(db)
    print("  ✅ Email Sender")

    from personal_reminders_routes import router as personal_reminders_router, set_db as set_personal_reminders_db, reminder_background_loop
    set_personal_reminders_db(db)
    app.include_router(personal_reminders_router, tags=['Personal Reminders'])
    print("  ✅ Personal Reminders")

    @app.on_event("startup")
    async def start_reminder_checker():
        asyncio.create_task(reminder_background_loop())
        print("  ⏰ Personal reminders background checker started")


# ═══════════════════════════════════════════════════════════════
#  9. Bookkeeping
# ═══════════════════════════════════════════════════════════════

def _register_bookkeeping(app, db):
    print("  ── Bookkeeping ──")

    from bookkeeping_router import bookkeeping_router, set_bookkeeping_db
    set_bookkeeping_db(db)
    app.include_router(bookkeeping_router, prefix='/api')
    print("  ✅ Bookkeeping")

    from bk_payroll_router import payroll_router, set_payroll_db
    set_payroll_db(db)
    app.include_router(payroll_router, prefix='/api')
    print("  ✅ Bookkeeping Payroll")

    from plaid_bookkeeping_router import plaid_bk_router, set_plaid_bk_db
    set_plaid_bk_db(db)
    app.include_router(plaid_bk_router, prefix='/api')
    print("  ✅ Plaid Bookkeeping")

    from bk_banking_data_router import router as bk_banking_data_router, set_db as set_bk_banking_db
    set_bk_banking_db(db)
    app.include_router(bk_banking_data_router)
    print("  ✅ Bookkeeping Banking Data")

    from client_bookkeeping_routes import client_bk_router, init_client_bk_router
    init_client_bk_router(db)
    app.include_router(client_bk_router, prefix='/api', tags=['Client Bookkeeping'])
    print("  ✅ Client Bookkeeping (Mi Negocio)")


# ═══════════════════════════════════════════════════════════════
#  10. AI & Automation
# ═══════════════════════════════════════════════════════════════

def _register_ai(app, db, get_current_user, require_admin):
    """Register AI-related routers. Returns references for startup wiring."""
    print("  ── AI & Automation ──")

    from ai_brain_service import RossAIBrain
    from ai_brain_endpoints import router as ai_brain_router
    import ai_brain_endpoints

    ai_brain_instance = RossAIBrain(db)
    ai_brain_endpoints.ai_brain = ai_brain_instance
    app.include_router(ai_brain_router, prefix='/api')
    print("  ✅ AI Brain (Rosa)")

    from vapi_endpoints import init_vapi_endpoints, connect_ai_brain
    vapi_router = init_vapi_endpoints(db)
    app.include_router(vapi_router)
    connect_ai_brain(ai_brain_instance)
    print("  ✅ Vapi Voice AI (connected to AI Brain)")

    from vapi_router import vapi_router as vapi_router2, set_vapi_database
    set_vapi_database(db, get_current_user)
    app.include_router(vapi_router2, prefix='/api')
    print("  ✅ VAPI AI Phone Assistant")

    from rag_memory_system import RAGMemorySystem
    from business_intelligence_learner import BusinessIntelligenceLearner
    from ai_learning_endpoints import router as ai_learning_router, init_learning
    rag_memory_instance = RAGMemorySystem(db)
    bi_learner_instance = BusinessIntelligenceLearner(db, rag_memory_instance)
    init_learning(rag_memory_instance, ai_brain_instance, bi_learner_instance)
    app.include_router(ai_learning_router, prefix='/api')
    print("  ✅ AI Learning (RAG Memory + BI)")

    from chat_ai_endpoints import set_chat_ai_service
    from chat_ai_endpoints import router as chat_ai_router
    from chat_endpoints import set_chat_service
    from chat_service import ChatService, set_websocket_manager
    from chat_ai_service import ChatAIService
    from websocket_service import chat_manager

    chat_service_instance = ChatService(db)
    chat_ai_service_instance = ChatAIService(db, ai_brain=ai_brain_instance)
    chat_service_instance.set_ai_service(chat_ai_service_instance)
    set_websocket_manager(chat_manager)
    set_chat_service(chat_service_instance)
    set_chat_ai_service(chat_ai_service_instance)
    app.include_router(chat_ai_router, prefix='/api', tags=['Chat AI'])
    print("  ✅ Chat AI (connected to AI Brain)")

    from public_chat_endpoints import router as public_chat_router, set_dependencies as set_public_chat_deps
    set_public_chat_deps(db, ai_brain_instance)
    app.include_router(public_chat_router, prefix='/api', tags=['Public Chat'])
    print("  ✅ Public Chat AI (website)")

    # Store references for startup wiring
    app.state.ai_brain_instance = ai_brain_instance
    app.state.rag_memory_instance = rag_memory_instance
    app.state.bi_learner_instance = bi_learner_instance


# ═══════════════════════════════════════════════════════════════
#  11. CRM & Projects
# ═══════════════════════════════════════════════════════════════

def _register_crm(app, db):
    print("  ── CRM & Projects ──")

    from projects_routes import projects_router, init_projects_router
    init_projects_router(db)
    app.include_router(projects_router, prefix='/api', tags=['Projects & Tasks'])
    print("  ✅ Projects & Tasks")

    from sticky_notes_routes import sticky_notes_router, init_sticky_notes_router
    init_sticky_notes_router(db)
    app.include_router(sticky_notes_router, prefix='/api', tags=['Sticky Notes & Announcements'])
    print("  ✅ Sticky Notes & Announcements")

    from crm_pro_routes import router as crm_pro_router, set_crm_database
    set_crm_database(db)
    app.include_router(crm_pro_router, tags=['CRM Pro'])
    print("  ✅ CRM Pro (Kanban, KB, Contracts, Time Tracking)")

    from reports_roles_routes import router as reports_roles_router, set_reports_database
    set_reports_database(db)
    app.include_router(reports_roles_router, tags=['Reports & Roles'])
    print("  ✅ Reports & Roles/Permissions")

    from rise_crm_endpoints import router as rise_crm_router
    app.include_router(rise_crm_router, prefix='/api')
    print("  ✅ Rise CRM")


# ═══════════════════════════════════════════════════════════════
#  12. Business Tools (User-facing)
# ═══════════════════════════════════════════════════════════════

def _register_business_tools(app, db, get_current_user, require_admin):
    print("  ── Business Tools ──")

    from plaid_routes import router as plaid_router, set_db as set_plaid_db, start_auto_sync as start_plaid_auto_sync
    set_plaid_db(db)
    app.include_router(plaid_router, prefix='/api', tags=['Plaid'])
    start_plaid_auto_sync()
    print("  ✅ Plaid Bank Integration (auto-sync)")

    from personal_finance_routes import finance_router, set_finance_db
    set_finance_db(db)
    app.include_router(finance_router, prefix='/api', tags=['Personal Finance'])
    print("  ✅ Personal Finance")

    from business_invoices_routes import router as biz_invoices_router, set_db as set_biz_invoices_db
    set_biz_invoices_db(db)
    app.include_router(biz_invoices_router, prefix='/api', tags=['Business Invoices'])
    print("  ✅ Business Invoices")

    from user_biz_clients_routes import router as user_biz_clients_router, set_db as set_user_biz_clients_db
    set_user_biz_clients_db(db)
    app.include_router(user_biz_clients_router, prefix='/api', tags=['User Business Clients'])
    print("  ✅ User Business Clients")

    from user_biz_profile_routes import router as user_biz_profile_router, set_db as set_user_biz_profile_db
    set_user_biz_profile_db(db)
    app.include_router(user_biz_profile_router, prefix='/api', tags=['User Business Profile'])
    print("  ✅ User Business Profile")

    from trucker_routes import router as trucker_router, set_db as set_trucker_db
    set_trucker_db(db)
    app.include_router(trucker_router, prefix='/api', tags=['Trucker Tools'])
    print("  ✅ Trucker Tools")

    from trucker_phase2_routes import router as trucker_p2_router, set_db as set_trucker_p2_db
    set_trucker_p2_db(db)
    app.include_router(trucker_p2_router, prefix='/api', tags=['Trucker Phase 2'])
    print("  ✅ Trucker Phase 2 (GPS, Car Hauler, Tanker, Reefer)")

    from mileage_routes import router as mileage_router, set_db as set_mileage_db
    set_mileage_db(db)
    app.include_router(mileage_router, prefix='/api', tags=['Mileage Tracker'])
    print("  ✅ Mileage Tracker")

    from business_receipts_routes import router as biz_receipts_router, set_db as set_biz_receipts_db
    set_biz_receipts_db(db)
    app.include_router(biz_receipts_router, prefix='/api', tags=['Business Receipts'])
    print("  ✅ Business Receipts")

    from employers_routes import employers_router, init_employers_router
    init_employers_router(db)
    app.include_router(employers_router, prefix='/api', tags=['Employers'])
    print("  ✅ Employers")

    from location_endpoints import router as location_router, init_dependencies as init_location_deps
    init_location_deps(get_current_user, lambda: db)
    app.include_router(location_router, prefix='/api')
    print("  ✅ Location Tracking")

    from ein_endpoints import router as ein_router, init_ein_endpoints
    init_ein_endpoints(db, get_current_user, require_admin)
    app.include_router(ein_router, prefix='/api')
    print("  ✅ EIN Database")

    from financial_diagnosis_routes import diagnosis_router
    app.include_router(diagnosis_router, tags=['Financial Diagnosis'])
    print("  ✅ Financial Diagnosis")


# ═══════════════════════════════════════════════════════════════
#  13. Misc & Legacy
# ═══════════════════════════════════════════════════════════════

def _register_misc(app, db, api_router, get_current_user, require_admin):
    print("  ── Misc & Legacy ──")

    try:
        from rental_management_router import rental_mgmt_router, set_rental_database
        set_rental_database(db)
        app.include_router(rental_mgmt_router, prefix='/api')
        print("  ✅ Rental Management")
    except Exception as e:
        import traceback
        logging.error(f"  ❌ Rental Management FAILED to load: {e}")
        logging.error(traceback.format_exc())
        print(f"  ❌ Rental Management FAILED: {e}")

    try:
        from rental_storage_service import init_storage as init_rental_storage
        init_rental_storage()
    except Exception as e:
        logging.warning(f"  Rental storage init deferred: {e}")

    try:
        from rental.tenant_utilities_router import router as tenant_utilities_router
        app.include_router(tenant_utilities_router, prefix='/api', tags=['Tenant Utilities'])
        print("  ✅ Tenant Utilities")
    except Exception as e:
        import traceback
        logging.error(f"  ❌ Tenant Utilities FAILED to load: {e}")
        logging.error(traceback.format_exc())
        print(f"  ❌ Tenant Utilities FAILED: {e}")

    try:
        from rental.emergency_contacts_router import router as emergency_contacts_router
        app.include_router(emergency_contacts_router, prefix='/api', tags=['Emergency Contacts'])
        print("  ✅ Emergency Contacts")
    except Exception as e:
        import traceback
        logging.error(f"  ❌ Emergency Contacts FAILED to load: {e}")
        logging.error(traceback.format_exc())
        print(f"  ❌ Emergency Contacts FAILED: {e}")

    from family_employees_router import router as family_employees_router
    app.include_router(family_employees_router, prefix='/api', tags=['Family Employees'])
    print("  ✅ Family Employees")

    from payroll_router import router as payroll_router
    app.include_router(payroll_router, prefix='/api', tags=['Payroll'])
    print("  ✅ Payroll")

    from service_orders_routes import service_orders_router, init_service_orders_router
    init_service_orders_router(db)
    app.include_router(service_orders_router, prefix='/api', tags=['Service Orders'])
    print("  ✅ Service Orders")

    from referral_routes import referral_router, init_referral_router
    init_referral_router(db)
    app.include_router(referral_router, prefix='/api', tags=['Referrals'])
    print("  ✅ Referrals")

    from referral_service_v2 import init_referral_service_v2
    @app.on_event("startup")
    async def init_referral_v2():
        init_referral_service_v2(db)
        logging.info("  ✅ Referral Service V2 initialized")

    from credits_routes import credits_router, init_credits_router
    init_credits_router(db)
    app.include_router(credits_router, prefix='/api', tags=['Credits'])
    print("  ✅ Credits")

    from education_endpoints import education_router, init_education_endpoints
    init_education_endpoints(db)
    app.include_router(education_router, prefix='/api')
    print("  ✅ Education")

    from faq_endpoints import init_faq_endpoints
    faq_router = init_faq_endpoints(db, get_current_user, require_admin)
    app.include_router(faq_router, prefix='/api')
    print("  ✅ FAQ")

    from faq_inline_routes import faq_inline_router, init_faq_inline_router
    init_faq_inline_router(db)
    app.include_router(faq_inline_router, prefix='/api', tags=['FAQ Inline'])
    print("  ✅ FAQ Inline")

    from educational_endpoints import init_educational_endpoints
    educational_router = init_educational_endpoints(db, get_current_user, require_admin)
    app.include_router(educational_router, prefix='/api')
    print("  ✅ Educational Content")

    from news_endpoints import init_news_endpoints
    news_router = init_news_endpoints(db, get_current_user, require_admin)
    app.include_router(news_router, prefix='/api')
    print("  ✅ Tax News")

    from google_reviews_routes import google_reviews_router, init_google_reviews_router
    init_google_reviews_router(db)
    app.include_router(google_reviews_router, prefix='/api', tags=['Google Reviews'])
    print("  ✅ Google Reviews")

    from documents_routes import documents_router, init_documents_router
    init_documents_router(db)
    app.include_router(documents_router, prefix='/api', tags=['Documents'])
    print("  ✅ Documents")

    from admin_finance_ops_routes import admin_finance_ops_router, init_admin_finance_ops_router
    init_admin_finance_ops_router(db)
    app.include_router(admin_finance_ops_router, prefix='/api', tags=['Admin Finance & Ops'])
    print("  ✅ Admin Finance & Operations")

    from misc_extracted_routes import misc_extracted_router, init_misc_extracted_router
    init_misc_extracted_router(db)
    app.include_router(misc_extracted_router, prefix='/api', tags=['Misc Extracted'])
    print("  ✅ Misc Extracted (Analytics, Notifications, Queue)")

    from client_profile_routes import router as client_profile_router, init_client_profile_router
    init_client_profile_router(db)
    app.include_router(client_profile_router, prefix='/api', tags=['Client Profile'])
    print("  ✅ Client Profile")

    from public_admin_misc_routes import router as public_admin_misc_router, init_public_admin_misc_router
    init_public_admin_misc_router(db)
    app.include_router(public_admin_misc_router, prefix='/api', tags=['Public & Admin Misc'])
    print("  ✅ Public & Admin Misc")

    from services_catalog_endpoints import router as services_catalog_router, set_db as set_services_db
    set_services_db(db)
    app.include_router(services_catalog_router, prefix='/api', tags=['Services Catalog'])
    print("  ✅ Services Catalog")

    from portfolio_routes import portfolio_router
    app.include_router(portfolio_router, prefix='/api', tags=['Portfolio'])
    print("  ✅ Portfolio PDF")

    from mashvisor_routes import router as mashvisor_router
    app.include_router(mashvisor_router, prefix='/api', tags=['Market Data'])
    print("  ✅ Mashvisor Market Data")

    from analytics_endpoints import router as analytics_router
    app.include_router(analytics_router, prefix='/api', tags=['Analytics'])
    print("  ✅ Analytics")

    from banking_data_routes import router as banking_data_router, set_db as set_banking_db
    set_banking_db(db)
    app.include_router(banking_data_router, tags=['Banking Data'])
    print("  ✅ Banking Data")

    from money_request_endpoints import router as money_request_router, init_money_request_endpoints
    init_money_request_endpoints(db, get_current_user, None)
    app.include_router(money_request_router, prefix='/api', tags=['money-requests'])
    print("  ✅ Money Requests")

    from quick_actions_endpoints import init_quick_actions_endpoints
    init_quick_actions_endpoints(app, api_router, require_admin, lambda: db)
    print("  ✅ Quick Actions")

    from charada_endpoints import router as charada_router
    app.include_router(charada_router, prefix='/api', tags=['charada'])
    print("  ✅ Charada China")

    try:
        from service_orders_endpoints import router as service_orders_router2
        app.include_router(service_orders_router2, prefix='/api', tags=['Service Orders'])
    except Exception as e:
        print(f"  ⚠️  Service Orders endpoints: {e}")

    try:
        from usps_labels_endpoints import router as usps_labels_router
        app.include_router(usps_labels_router, prefix='/api/usps', tags=['USPS Labels'])
        print("  ✅ USPS Labels")
    except Exception as e:
        print(f"  ⚠️  USPS Labels: {e}")

    try:
        from usps_endpoints import api_router as usps_api_router
        app.include_router(usps_api_router, prefix='/api/usps', tags=['USPS Shipments'])
        print("  ✅ USPS Shipments")
    except Exception as e:
        print(f"  ⚠️  USPS Shipments: {e}")

    try:
        from bolita_endpoints import router as bolita_router
        app.include_router(bolita_router, prefix='/api/bolita', tags=['Bolita Cubana'])
        print("  ✅ Bolita Cubana")
    except Exception as e:
        print(f"  ⚠️  Bolita: {e}")

    try:
        from test_push_endpoint import router as test_push_router
        from test_notifications_endpoint import router as test_notif_router
        app.include_router(test_push_router, prefix='/api/test', tags=['Test Push'])
        app.include_router(test_notif_router, prefix='/api', tags=['Test Notifications'])
        print("  ✅ Test Push & Notifications")
    except Exception as e:
        print(f"  ⚠️  Test Push: {e}")

    try:
        from scratch_cards_endpoints import router as scratch_cards_router
        app.include_router(scratch_cards_router, prefix='/api/scratch-cards', tags=['Scratch Cards'])
        print("  ✅ Scratch Cards")
    except Exception as e:
        print(f"  ⚠️  Scratch Cards: {e}")

    try:
        from legal_endpoints import legal_router
        app.include_router(legal_router, prefix='/api', tags=['Legal'])
        print("  ✅ Legal")
    except Exception as e:
        print(f"  ⚠️  Legal: {e}")

    try:
        from legal_docs_routes import router as legal_docs_router_v2
        app.include_router(legal_docs_router_v2, tags=['Legal Documents'])
        print("  ✅ Legal Documents")
    except Exception as e:
        print(f"  ⚠️  Legal Documents: {e}")

    try:
        from legal_documents_routes import router as legal_docs_router_v3
        app.include_router(legal_docs_router_v3, tags=['Legal Documents V2'])
        print("  ✅ Legal Documents V2")
    except Exception as e:
        print(f"  ⚠️  Legal Documents V2: {e}")

    try:
        from landing_leads_routes import router as landing_leads_router
        app.include_router(landing_leads_router, tags=['Landing Leads'])
        print("  ✅ Landing Leads")
    except Exception as e:
        print(f"  ⚠️  Landing Leads: {e}")

    # Email Inbox Routes (using existing email_inbox_service - SiteGround IMAP)
    # Note: email routes already registered above via email_routes.py
    # No need for duplicate email_inbox_routes.py

    try:
        from remaining_routes import remaining_router, init_remaining_router
        init_remaining_router(db)
        app.include_router(remaining_router, prefix='/api', tags=['Remaining'])
        print("  ✅ Remaining Routes")
    except Exception as e:
        print(f"  ⚠️  Remaining Routes: {e}")

    try:
        from job_applications_endpoints import router as job_applications_router
        app.include_router(job_applications_router, tags=['Job Applications'])
        print("  ✅ Job Applications (public)")
    except Exception as e:
        print(f"  ⚠️  Job Applications: {e}")

    try:
        from setup_endpoint import setup_router
        from populate_endpoint import populate_router
        from cron_endpoints import cron_router
        app.include_router(setup_router, prefix='/api')
        app.include_router(populate_router, prefix='/api')
        app.include_router(cron_router, prefix='/api')
        print("  ✅ Setup/Populate/Cron (temporal)")
    except Exception as e:
        print(f"  ⚠️  Setup: {e}")

    # Static file download
    from fastapi.responses import FileResponse
    import os as _os

    @app.get("/api/downloads/{filename}")
    async def download_file(filename: str):
        from fastapi import HTTPException
        filepath = _os.path.join(_os.path.dirname(__file__), "static", filename)
        if not _os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(filepath, filename=filename, media_type="application/pdf")

    # Startup migrations
    from startup_migrations import schedule_startup_migrations
    schedule_startup_migrations(db)
