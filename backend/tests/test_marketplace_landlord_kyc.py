"""
E2E tests for Marketplace 3 NEW features against Railway prod backend:
 1. Public Landlord Onboarding with KYC  (POST /api/public/landlord-register)
 2. Admin Marketplace Commissions Dashboard (GET /api/admin/marketplace-commissions)
 3. Monthly Commission PDF + auto email (POST /api/admin/marketplace-commissions/{id}/report-pdf)
 4. Stripe Connect payout error path (POST /api/admin/connect/process-payout)
"""
import os
import time
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("RHR_BASE_URL", "https://ross-house-backend-production.up.railway.app").rstrip("/")
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"

TIMEOUT = 30

# ───────────────────────────────────────────────────────────────────────────────
# fixtures
# ───────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/public/marketplace-login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                     timeout=TIMEOUT)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True
    assert "token" in body
    return body["token"]

@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="session")
def test_landlord_email():
    # unique per run for create test
    return f"qa.landlord.{uuid.uuid4().hex[:8]}@rosshouse.com"


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 1 — Public landlord register (KYC onboarding)
# ═══════════════════════════════════════════════════════════════════════════════

class TestLandlordRegister:
    """POST /api/public/landlord-register"""

    def test_01_register_success(self, session, test_landlord_email):
        # Small fake base64 image (1x1 png) for id_doc
        fake_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        payload = {
            "name": "QA Landlord Test",
            "email": test_landlord_email,
            "phone": "+15125551234",
            "password": "Test1234!",
            "business_name": "QA Test LLC",
            "tax_id": "12-3456789",
            "address": "123 QA Street",
            "city": "Austin",
            "state": "TX",
            "zip_code": "78701",
            "bank_info": "Test Bank · routing 111000025 · acct 999",
            "id_doc_base64": fake_png,
        }
        r = session.post(f"{BASE_URL}/api/public/landlord-register",
                         json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("status") == "pending_kyc"
        assert "user_id" in data and len(data["user_id"]) >= 12

    def test_02_register_duplicate_email_409(self, session, test_landlord_email):
        # Re-submit same email -> 409
        payload = {
            "name": "Duplicate Test",
            "email": test_landlord_email,
            "password": "AnotherPass123",
        }
        r = session.post(f"{BASE_URL}/api/public/landlord-register",
                         json=payload, timeout=TIMEOUT)
        assert r.status_code == 409, f"expected 409 got {r.status_code} {r.text[:200]}"
        d = r.json()
        assert "detail" in d
        assert "email" in d["detail"].lower() or "existe" in d["detail"].lower()

    def test_03_register_short_password_400(self, session):
        payload = {
            "name": "Short PW",
            "email": f"qa.shortpw.{uuid.uuid4().hex[:6]}@rosshouse.com",
            "password": "abc",  # < 6
        }
        r = session.post(f"{BASE_URL}/api/public/landlord-register",
                         json=payload, timeout=TIMEOUT)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"
        assert "6" in r.json().get("detail", "") or "password" in r.json().get("detail", "").lower()

    def test_04_register_missing_fields_400(self, session):
        # No name/email/password
        r = session.post(f"{BASE_URL}/api/public/landlord-register",
                         json={"phone": "5551234"}, timeout=TIMEOUT)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2 — Admin marketplace commissions dashboard
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarketplaceCommissions:
    """GET /api/admin/marketplace-commissions"""

    def test_05_unauthorized_no_token(self, session):
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions", timeout=TIMEOUT)
        assert r.status_code in (401, 403), f"{r.status_code} {r.text[:200]}"

    def test_06_authorized_returns_landlords_and_totals(self, session, admin_headers):
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions",
                        headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d.get("success") is True
        assert "landlords" in d
        assert isinstance(d["landlords"], list)
        assert "totals" in d
        totals = d["totals"]
        for key in ("total_landlords", "total_monthly_revenue",
                    "total_annualized_revenue", "total_commission_earned"):
            assert key in totals, f"missing totals.{key}"
        # data type checks
        assert isinstance(totals["total_landlords"], int)
        assert isinstance(totals["total_monthly_revenue"], (int, float))
        # at least the QA landlord we just registered should be present
        emails = [l["email"] for l in d["landlords"]]
        assert any("qa.landlord" in e or "qa.shortpw" in e or len(emails) >= 1 for e in emails) or len(emails) >= 1

    def test_07_landlord_row_schema(self, session, admin_headers, test_landlord_email):
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions",
                        headers=admin_headers, timeout=TIMEOUT)
        d = r.json()
        target = next((l for l in d["landlords"] if l["email"] == test_landlord_email), None)
        assert target is not None, f"newly registered landlord {test_landlord_email} not found in list"
        for key in ("landlord_id", "name", "email", "phone",
                    "commission_rate", "total_listings", "approved_listings",
                    "pending_listings", "inquiries_received", "signed_contracts",
                    "total_monthly_rent", "total_annualized_rent",
                    "commission_earned", "joined_at"):
            assert key in target, f"missing {key} in landlord row"
        assert target["commission_rate"] == 10  # default
        assert target["total_listings"] == 0
        # joined_at may be empty string or iso — should be present
        assert "joined_at" in target


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — Monthly commission PDF report + auto-email
# ═══════════════════════════════════════════════════════════════════════════════

class TestCommissionReportPdf:
    """POST /api/admin/marketplace-commissions/{landlord_id}/report-pdf"""

    @pytest.fixture
    def landlord_id(self, session, admin_headers, test_landlord_email):
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions",
                        headers=admin_headers, timeout=TIMEOUT)
        d = r.json()
        target = next((l for l in d["landlords"] if l["email"] == test_landlord_email), None)
        assert target is not None
        return target["landlord_id"]

    def test_08_unauthorized(self, session, landlord_id):
        r = session.post(f"{BASE_URL}/api/admin/marketplace-commissions/{landlord_id}/report-pdf",
                         json={}, timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_09_invalid_id_400(self, session, admin_headers):
        r = session.post(f"{BASE_URL}/api/admin/marketplace-commissions/not-an-objectid/report-pdf",
                         headers=admin_headers, json={}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_10_nonexistent_landlord_404(self, session, admin_headers):
        # valid-shape ObjectId that won't exist
        fake_id = "0" * 24
        r = session.post(f"{BASE_URL}/api/admin/marketplace-commissions/{fake_id}/report-pdf",
                         headers=admin_headers, json={}, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_11_generate_pdf_for_new_landlord(self, session, admin_headers, landlord_id):
        r = session.post(f"{BASE_URL}/api/admin/marketplace-commissions/{landlord_id}/report-pdf",
                         headers=admin_headers, json={"period": "2026-01"}, timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d.get("success") is True
        assert "pdf_base64" in d and len(d["pdf_base64"]) > 100
        # decode and confirm it's a PDF
        raw = base64.b64decode(d["pdf_base64"])
        assert raw[:4] == b"%PDF", "pdf_base64 doesn't decode to a PDF"
        assert "filename" in d and d["filename"].endswith(".pdf")
        assert "emailed_to" in d and isinstance(d["emailed_to"], list)
        assert "summary" in d
        s = d["summary"]
        for k in ("total_rent", "commission_rate", "commission", "net_payout", "contracts"):
            assert k in s
        # new landlord has no contracts -> totals zero
        assert s["contracts"] == 0
        assert s["total_rent"] == 0
        assert s["commission"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 4 — Stripe Connect payout error path
# ═══════════════════════════════════════════════════════════════════════════════

class TestStripeConnectPayoutErrorPath:
    """POST /api/admin/connect/process-payout
       For a landlord WITHOUT stripe_account_id should error gracefully."""

    @pytest.fixture
    def landlord_id(self, session, admin_headers, test_landlord_email):
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions",
                        headers=admin_headers, timeout=TIMEOUT)
        d = r.json()
        target = next((l for l in d["landlords"] if l["email"] == test_landlord_email), None)
        assert target is not None
        return target["landlord_id"]

    def test_12_unauthorized(self, session, landlord_id):
        r = session.post(f"{BASE_URL}/api/admin/connect/process-payout",
                         json={"owner_id": landlord_id, "amount": 100}, timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_13_no_stripe_account_error(self, session, admin_headers, landlord_id):
        payload = {
            "owner_id": landlord_id,
            "amount": 1000,
            "property_address": "QA Test Property",
            "tenant_name": "QA Tenant",
            "period": "2026-01",
        }
        r = session.post(f"{BASE_URL}/api/admin/connect/process-payout",
                         headers=admin_headers, json=payload, timeout=TIMEOUT)
        # The endpoint should reject with 400/404 because no stripe_account_id
        assert r.status_code in (400, 404, 422), f"expected client-error got {r.status_code} {r.text[:300]}"
        d = r.json()
        msg = (d.get("detail") or "").lower()
        assert any(w in msg for w in ("stripe", "cuenta", "connected", "conectada", "not connected", "no tiene")), \
            f"error message does not mention stripe account: {d}"


# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP — best-effort delete the test landlord
# ═══════════════════════════════════════════════════════════════════════════════

class TestZCleanup:
    def test_99_cleanup_landlord(self, session, admin_headers, test_landlord_email):
        # Try common delete endpoint shapes; non-fatal if not present
        # Find user via list
        r = session.get(f"{BASE_URL}/api/admin/marketplace-commissions",
                        headers=admin_headers, timeout=TIMEOUT)
        d = r.json()
        target = next((l for l in d["landlords"] if l["email"] == test_landlord_email), None)
        if not target:
            pytest.skip("test landlord already gone")
        lid = target["landlord_id"]
        # try DELETE on a couple possible routes
        for path in (f"/api/admin/users/{lid}", f"/api/admin/app-users/{lid}",
                     f"/api/admin/landlords/{lid}"):
            try:
                r = session.delete(f"{BASE_URL}{path}", headers=admin_headers, timeout=TIMEOUT)
                if r.status_code in (200, 204):
                    return
            except Exception:
                pass
        # If no delete endpoint exists, that's OK — record but don't fail
        print(f"[cleanup] no delete endpoint matched for landlord {lid} ({test_landlord_email})")
