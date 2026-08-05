"""
Iteration 5 — Backend E2E for 4 NEW Investor Portal features on Railway prod.

Features:
  1) OTP Forgot Password (anti-enumeration, error paths)
  2) Waterfall Calculator
  3) Cap Table PDF Export
  4) Subscription Signature + Receipt

Plus regression: admin login, investor login (bcrypt), dashboard, deals.

Cleanup runs in the last class.
"""
import os
import pytest
import requests

BASE_URL = "https://ross-house-backend-production.up.railway.app"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 60


class S:
    admin_token: str = ""
    deal_id: str = ""
    empty_deal_id: str = ""  # Deal with no investments (for waterfall 400 test)
    inv1_id: str = ""
    inv2_id: str = ""
    inv1_user_id: str = ""
    inv2_user_id: str = ""
    inv1_temp_pw: str = ""
    inv2_temp_pw: str = ""
    inv1_token: str = ""
    inv2_token: str = ""


def _admin_headers():
    return {"Authorization": f"Bearer {S.admin_token}", "Content-Type": "application/json"}


def _inv_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───────────────────────────────────────────────────────────────────────────
# SETUP — admin login + create deal + 2 investors
# ───────────────────────────────────────────────────────────────────────────
class TestSetup:
    def test_00_admin_login(self):
        r = requests.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.admin_token = r.json()["token"]
        assert S.admin_token

    def test_01_create_deal(self):
        payload = {
            "name": "Iter5 OTP Deal",
            "property_address": "789 OTP Lane, Dumas TX",
            "property_type": "multifamily",
            "units": 8,
            "target_raise": 500000,
            "min_investment": 25000,
            "preferred_return": 8,
            "projected_irr": 18,
            "hold_period_months": 60,
            "lp_percent": 80,
            "gp_percent": 20,
            "status": "open",
        }
        r = requests.post(f"{BASE_URL}/api/admin/syndication/deals", json=payload, headers=_admin_headers(), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        S.deal_id = r.json()["deal"]["id"]

    def test_02_create_empty_deal_no_investments(self):
        """A deal w/ target_raise but no investments — used for waterfall 400 test."""
        payload = {
            "name": "Iter5 Empty Deal",
            "property_address": "0 Nowhere, Dumas TX",
            "property_type": "multifamily",
            "units": 1,
            "target_raise": 500000,
            "min_investment": 25000,
            "preferred_return": 8,
            "status": "draft",
        }
        r = requests.post(f"{BASE_URL}/api/admin/syndication/deals", json=payload, headers=_admin_headers(), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        S.empty_deal_id = r.json()["deal"]["id"]

    def test_03_add_investor1(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/investments",
            json={
                "investor_name": "OTP Test Investor",
                "investor_email": "otp.test@rosshouse.com",
                "amount": 100000,
                "status": "active",
            },
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv1_id = r.json()["investment"]["id"]

        # need user id — fetch via investors directory
        rl = requests.get(f"{BASE_URL}/api/admin/syndication/investors", headers=_admin_headers(), timeout=TIMEOUT)
        assert rl.status_code == 200
        row = next((i for i in rl.json()["investors"] if i["email"] == "otp.test@rosshouse.com"), None)
        assert row is not None, "investor row not found"
        S.inv1_user_id = row["id"]

    def test_04_add_investor2_for_403_test(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/investments",
            json={
                "investor_name": "Other Investor",
                "investor_email": "otp.other@rosshouse.com",
                "amount": 50000,
                "status": "active",
            },
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv2_id = r.json()["investment"]["id"]
        rl = requests.get(f"{BASE_URL}/api/admin/syndication/investors", headers=_admin_headers(), timeout=TIMEOUT)
        row = next((i for i in rl.json()["investors"] if i["email"] == "otp.other@rosshouse.com"), None)
        assert row is not None
        S.inv2_user_id = row["id"]

    def test_05_reset_investor1_password(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/investors/{S.inv1_user_id}/reset-password",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv1_temp_pw = r.json()["temp_password"]
        assert S.inv1_temp_pw

    def test_06_reset_investor2_password(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/investors/{S.inv2_user_id}/reset-password",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv2_temp_pw = r.json()["temp_password"]


# ───────────────────────────────────────────────────────────────────────────
# FEATURE 1 — Forgot Password (OTP) anti-enumeration & error paths
# ───────────────────────────────────────────────────────────────────────────
class TestF1ForgotPassword:
    def test_07_forgot_nonexistent_email_returns_200(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/forgot-password",
            json={"email": "nonexistent@rosshouse.com"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Anti-enumeration: must be 200. Got {r.status_code} {r.text}"
        j = r.json()
        assert j.get("success") is True
        assert "message" in j and j["message"]
        assert "email_masked" in j
        assert j["email_masked"] == "n*********t@rosshouse.com" or "@" in j["email_masked"]
        # Must NOT leak existence
        msg = (j["message"] or "").lower()
        for leak in ("not found", "no existe", "doesn't exist", "no encontr"):
            assert leak not in msg, f"Possible enumeration leak in message: {j['message']}"

    def test_08_forgot_real_email_returns_masked(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/forgot-password",
            json={"email": "otp.test@rosshouse.com"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("success") is True
        assert j.get("email_masked") == "o******t@rosshouse.com", f"got {j.get('email_masked')}"

    def test_09_reset_with_wrong_code_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/reset-password",
            json={"email": "otp.test@rosshouse.com", "code": "000000", "new_password": "NewSecure123"},
            timeout=TIMEOUT,
        )
        # Could be 400 ("Código incorrecto") or 429 (already 5+ attempts from prior runs)
        assert r.status_code in (400, 429), f"Expected 400/429, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert ("código" in detail or "code" in detail or "intentos" in detail), f"Unexpected detail: {detail}"

    def test_10_reset_short_password_returns_400(self):
        # Must be triggered by validation (any code, valid email) — must return 400 with min-length msg
        r = requests.post(
            f"{BASE_URL}/api/investor/reset-password",
            json={"email": "otp.test@rosshouse.com", "code": "123456", "new_password": "abc"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400 for short pw, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert "6 caracteres" in detail or "6 characters" in detail or "at least 6" in detail, f"got: {detail}"

    def test_11_reset_missing_fields_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/reset-password",
            json={"email": "", "code": "", "new_password": ""},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400


# ───────────────────────────────────────────────────────────────────────────
# FEATURE 2 — Waterfall Calculator
# ───────────────────────────────────────────────────────────────────────────
class TestF2Waterfall:
    def test_12_waterfall_happy_path(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/waterfall",
            json={"exit_value": 300000, "months_elapsed": 60, "catch_up_pct": 100},
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("success") is True
        wf = j["waterfall"]
        assert "tiers" in wf and len(wf["tiers"]) == 4, f"Expected 4 tiers, got {len(wf.get('tiers', []))}"
        assert "totals" in wf
        assert wf["totals"]["lp_total"] > 0
        assert "per_lp_allocation" in wf
        assert len(wf["per_lp_allocation"]) >= 2, f"Expected ≥2 LPs, got {len(wf['per_lp_allocation'])}"
        # Math: lp_total + gp_total ≈ exit_value
        total = wf["totals"]["lp_total"] + wf["totals"]["gp_total"]
        assert abs(total - 300000) <= 10, f"Sum {total} not within $10 of exit 300000"

    def test_13_waterfall_invalid_exit_value(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/waterfall",
            json={"exit_value": -100, "months_elapsed": 60},
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400 for negative exit, got {r.status_code}: {r.text}"

    def test_14_waterfall_zero_exit_value(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/waterfall",
            json={"exit_value": 0},
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_15_waterfall_no_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/waterfall",
            json={"exit_value": 1000000},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_16_waterfall_no_investments(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.empty_deal_id}/waterfall",
            json={"exit_value": 1000000, "months_elapsed": 60},
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400 for no-capital deal, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert "capital lp" in detail or "no tiene" in detail, f"Unexpected detail: {detail}"


# ───────────────────────────────────────────────────────────────────────────
# FEATURE 3 — Cap Table PDF Export
# ───────────────────────────────────────────────────────────────────────────
class TestF3CapTablePDF:
    def test_17_cap_table_pdf_success(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/cap-table.pdf",
            headers={"Authorization": f"Bearer {S.admin_token}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf"), f"CT: {r.headers.get('content-type')}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and "filename" in cd, f"Content-Disposition: {cd}"
        # PDF magic bytes
        assert r.content[:4] == b"%PDF", f"Not a valid PDF (starts with {r.content[:8]!r})"
        assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"

    def test_18_cap_table_pdf_no_auth(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/cap-table.pdf",
            timeout=TIMEOUT,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_19_cap_table_pdf_nonexistent_deal(self):
        # Use a syntactically valid ObjectId that doesn't exist
        fake = "507f1f77bcf86cd799439011"
        r = requests.get(
            f"{BASE_URL}/api/admin/syndication/deals/{fake}/cap-table.pdf",
            headers={"Authorization": f"Bearer {S.admin_token}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"


# ───────────────────────────────────────────────────────────────────────────
# FEATURE 4 — Subscription Signature + Receipt
# ───────────────────────────────────────────────────────────────────────────
class TestF4SubscriptionSign:
    def test_20_login_investor1(self):
        assert S.inv1_temp_pw, "Need temp pw from setup"
        r = requests.post(
            f"{BASE_URL}/api/investor/login",
            json={"email": "otp.test@rosshouse.com", "password": S.inv1_temp_pw},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Investor login failed: {r.status_code} {r.text}"
        j = r.json()
        assert "token" in j and j["token"]
        assert j["user"]["role"] == "investor"
        S.inv1_token = j["token"]

    def test_21_login_investor2(self):
        assert S.inv2_temp_pw
        r = requests.post(
            f"{BASE_URL}/api/investor/login",
            json={"email": "otp.other@rosshouse.com", "password": S.inv2_temp_pw},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv2_token = r.json()["token"]

    def test_22_sign_subscription_first_time(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/investments/{S.inv1_id}/sign-subscription",
            headers=_inv_headers(S.inv1_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("success") is True
        assert j.get("signed_at"), "Missing signed_at ISO timestamp"
        # signed_at should look ISO-like
        assert "T" in j["signed_at"], f"signed_at not ISO: {j['signed_at']}"

    def test_23_sign_subscription_already_signed(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/investments/{S.inv1_id}/sign-subscription",
            headers=_inv_headers(S.inv1_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("success") is True
        assert j.get("already_signed") is True, f"Expected already_signed:true, got {j}"

    def test_24_sign_other_investor_returns_403(self):
        # inv2 attempts to sign inv1's investment
        r = requests.post(
            f"{BASE_URL}/api/investor/investments/{S.inv1_id}/sign-subscription",
            headers=_inv_headers(S.inv2_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, f"Expected 403 for cross-investor sign, got {r.status_code}: {r.text}"

    def test_25_admin_patch_documents_signed_triggers_receipt(self):
        # inv2 was created un-signed. Admin PATCHes documents_signed=true → should populate signed_at + send email.
        # Verify response shows documents_signed:true and signed_at populated.
        r = requests.patch(
            f"{BASE_URL}/api/admin/syndication/investments/{S.inv2_id}",
            json={"documents_signed": True},
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        # Verify persisted state via GET deal
        get_r = requests.get(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert get_r.status_code == 200
        deal_data = get_r.json()
        inv2 = next((i for i in deal_data["investments"] if i["id"] == S.inv2_id), None)
        assert inv2 is not None
        assert inv2.get("documents_signed") is True, f"documents_signed not persisted: {inv2}"
        assert inv2.get("signed_at"), f"signed_at not populated after admin sign: {inv2}"


# ───────────────────────────────────────────────────────────────────────────
# REGRESSION — make sure iteration_4 endpoints still work
# ───────────────────────────────────────────────────────────────────────────
class TestRegression:
    def test_26_admin_login_still_works(self):
        # Already tested in setup, but explicit regression check
        r = requests.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_27_investor_login_with_bcrypt_temp_pw(self):
        # The reset-password endpoint creates fresh hash (should be bcrypt now)
        # Sanity check: login with temp pw works (already confirmed in test_20, but explicit)
        assert S.inv1_temp_pw
        r = requests.post(
            f"{BASE_URL}/api/investor/login",
            json={"email": "otp.test@rosshouse.com", "password": S.inv1_temp_pw},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"bcrypt migration regression: {r.status_code} {r.text}"

    def test_28_investor_dashboard_regression(self):
        assert S.inv1_token
        r = requests.get(
            f"{BASE_URL}/api/investor/dashboard",
            headers=_inv_headers(S.inv1_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"dashboard regression: {r.status_code} {r.text}"
        j = r.json()
        assert "summary" in j
        assert "investments" in j

    def test_29_investor_deals_regression(self):
        assert S.inv1_token
        r = requests.get(
            f"{BASE_URL}/api/investor/deals",
            headers=_inv_headers(S.inv1_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"deals regression: {r.status_code} {r.text}"
        j = r.json()
        assert "deals" in j


# ───────────────────────────────────────────────────────────────────────────
# CLEANUP
# ───────────────────────────────────────────────────────────────────────────
class TestZCleanup:
    def test_90_delete_inv1(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/syndication/investments/{S.inv1_id}",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

    def test_91_delete_inv2(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/syndication/investments/{S.inv2_id}",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

    def test_92_delete_main_deal(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

    def test_93_delete_empty_deal(self):
        r = requests.delete(
            f"{BASE_URL}/api/admin/syndication/deals/{S.empty_deal_id}",
            headers=_admin_headers(),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
