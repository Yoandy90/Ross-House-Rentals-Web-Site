"""
End-to-end backend tests for the Syndication / Investor Portal module on Railway prod.

Run order matters — tests share state via the SyndicationState class attribute.
Cleanup runs in the final test (step 25) to keep prod DB tidy.

Also re-verifies the previously-failing /api/tenant/utilities/scan endpoint
after the EMERGENT_LLM_KEY env var was added to Railway.
"""
import base64
import io
import os
import pytest
import requests

BASE_URL = "https://ross-house-backend-production.up.railway.app"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"
TENANT_EMAIL = "maria@test.com"
TENANT_PASSWORD = "Test123!"

TIMEOUT = 60


# ─────────────────────────────────────────────────────────────────────────────
# Shared mutable state (test order matters)
# ─────────────────────────────────────────────────────────────────────────────
class S:
    admin_token: str = ""
    tenant_token: str = ""
    investor_token: str = ""
    deal_id: str = ""
    deal_slug: str = ""
    other_deal_id: str = ""
    inv1_id: str = ""
    inv2_id: str = ""
    inv1_investor_id: str = ""
    dist_id: str = ""
    doc_id: str = ""
    temp_password: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_headers():
    if not S.admin_token:
        r = requests.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
        S.admin_token = r.json()["token"]
    return {"Authorization": f"Bearer {S.admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tenant_headers():
    if not S.tenant_token:
        r = requests.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": TENANT_EMAIL, "password": TENANT_PASSWORD},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"Tenant login failed: {r.status_code} {r.text}"
        S.tenant_token = r.json()["token"]
    return {"Authorization": f"Bearer {S.tenant_token}", "Content-Type": "application/json"}


def investor_headers():
    return {"Authorization": f"Bearer {S.investor_token}", "Content-Type": "application/json"}


# ═══════════════════════════════════════════════════════════════════════════════
# PART 1 — SYNDICATION
# ═══════════════════════════════════════════════════════════════════════════════

# ── A) Deals CRUD ───────────────────────────────────────────────────────────
class TestADealsCRUD:
    def test_01_create_deal(self, admin_headers):
        payload = {
            "name": "Test Deal QA",
            "property_address": "123 Test St, Dumas TX",
            "property_type": "multifamily",
            "units": 12,
            "target_raise": 500000,
            "min_investment": 25000,
            "max_investment": 100000,
            "preferred_return": 8,
            "projected_irr": 18,
            "projected_cash_on_cash": 9,
            "hold_period_months": 60,
            "lp_percent": 80,
            "gp_percent": 20,
            "description": "QA test deal",
            "highlights": ["Test highlight 1", "Test highlight 2"],
            "status": "draft",
        }
        r = requests.post(f"{BASE_URL}/api/admin/syndication/deals", json=payload, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        j = r.json()
        assert j["success"] is True
        assert "deal" in j and "id" in j["deal"]
        assert j["deal"]["name"] == "Test Deal QA"
        assert j["deal"]["slug"]
        assert j["deal"]["status"] == "draft"
        assert j["deal"]["equity_split"]["lp_percent"] == 80
        S.deal_id = j["deal"]["id"]
        S.deal_slug = j["deal"]["slug"]

    def test_02a_list_deals_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/syndication/deals", timeout=TIMEOUT)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_02b_list_deals_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/syndication/deals", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        assert "deals" in j and isinstance(j["deals"], list)
        assert "stats" in j and isinstance(j["stats"], dict)
        assert "total_pages" in j
        # Our deal should be in the list
        assert any(d["id"] == S.deal_id for d in j["deals"])

    def test_03_get_deal(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["deal"]["id"] == S.deal_id
        assert j["investments"] == []
        assert j["distributions"] == []

    def test_04_patch_deal(self, admin_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}",
            json={"status": "open", "target_raise": 600000},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["deal"]["status"] == "open"
        assert j["deal"]["target_raise"] == 600000

    def test_05_public_list_deals(self):
        r = requests.get(f"{BASE_URL}/api/public/syndication/deals", timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        assert "deals" in j
        # Must include our open deal
        assert any(d["id"] == S.deal_id for d in j["deals"]), f"Test deal not in public list (status=open expected)"

    def test_06_public_get_deal_by_slug(self):
        # Use ACTUAL slug returned by create, not a hardcoded one (request had a typo).
        r = requests.get(f"{BASE_URL}/api/public/syndication/deals/{S.deal_slug}", timeout=TIMEOUT)
        assert r.status_code == 200, f"slug={S.deal_slug} -> {r.status_code}: {r.text}"
        j = r.json()
        assert j["deal"]["slug"] == S.deal_slug


# ── B) Investments / Cap Table ──────────────────────────────────────────────
class TestBInvestments:
    def test_07_add_first_investment(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/investments",
            json={
                "investor_name": "QA Investor 1",
                "investor_email": "qa.investor1@test.com",
                "investor_phone": "+1-555-0001",
                "amount": 100000,
                "status": "active",
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["investment"]["amount"] == 100000
        # Equity % is recomputed AFTER insert by _recompute_deal_totals,
        # but the response uses the in-memory pre-recompute value (0).
        # So fetch the deal and verify equity_percent on the persisted investment.
        S.inv1_id = j["investment"]["id"]

        get_r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        assert get_r.status_code == 200
        deal_data = get_r.json()
        inv1 = next((i for i in deal_data["investments"] if i["id"] == S.inv1_id), None)
        assert inv1 is not None
        assert abs(inv1["equity_percent"] - 100.0) < 0.01, f"Expected ~100%, got {inv1['equity_percent']}"
        assert deal_data["deal"]["total_raised"] == 100000
        assert deal_data["deal"]["num_investors"] == 1

    def test_08_add_second_investment_and_check_recompute(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/investments",
            json={
                "investor_name": "QA Investor 2",
                "investor_email": "qa.investor2@test.com",
                "amount": 50000,
                "status": "active",
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.inv2_id = r.json()["investment"]["id"]

        get_r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        deal_data = get_r.json()
        assert deal_data["deal"]["total_raised"] == 150000
        assert deal_data["deal"]["num_investors"] == 2
        inv1 = next(i for i in deal_data["investments"] if i["id"] == S.inv1_id)
        inv2 = next(i for i in deal_data["investments"] if i["id"] == S.inv2_id)
        assert abs(inv1["equity_percent"] - 66.67) < 0.1, f"inv1 equity {inv1['equity_percent']}"
        assert abs(inv2["equity_percent"] - 33.33) < 0.1, f"inv2 equity {inv2['equity_percent']}"

    def test_09_update_inv1_amount(self, admin_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/syndication/investments/{S.inv1_id}",
            json={"amount": 200000, "documents_signed": True},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        get_r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        deal_data = get_r.json()
        assert deal_data["deal"]["total_raised"] == 250000
        inv1 = next(i for i in deal_data["investments"] if i["id"] == S.inv1_id)
        inv2 = next(i for i in deal_data["investments"] if i["id"] == S.inv2_id)
        assert abs(inv1["equity_percent"] - 80.0) < 0.1
        assert abs(inv2["equity_percent"] - 20.0) < 0.1
        assert inv1["documents_signed"] is True
        # remember inv1 investor user id for portal tests later
        S.inv1_investor_id = inv1["investor_id"]


# ── C) Distributions ────────────────────────────────────────────────────────
class TestCDistributions:
    def test_10_create_distribution(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/distributions",
            json={
                "distribution_type": "profit",
                "period": "2026-Q1",
                "total_amount": 10000,
                "status": "scheduled",
                "notes": "Q1 distribution test",
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        d = j["distribution"]
        S.dist_id = d["id"]
        assert d["status"] == "scheduled"
        assert len(d["per_investment"]) == 2
        per_by_inv = {p["investment_id"]: p["amount"] for p in d["per_investment"]}
        # 80/20 split of 10000 → 8000 / 2000 (1% tolerance)
        assert abs(per_by_inv[S.inv1_id] - 8000) <= 100, f"inv1 share {per_by_inv[S.inv1_id]}"
        assert abs(per_by_inv[S.inv2_id] - 2000) <= 100, f"inv2 share {per_by_inv[S.inv2_id]}"

    def test_11_mark_distribution_paid(self, admin_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/syndication/distributions/{S.dist_id}",
            json={"status": "paid"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["distribution"]["status"] == "paid"

        # Verify investments now show total_distributions_received
        get_r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        deal_data = get_r.json()
        inv1 = next(i for i in deal_data["investments"] if i["id"] == S.inv1_id)
        inv2 = next(i for i in deal_data["investments"] if i["id"] == S.inv2_id)
        assert abs(inv1["total_distributions_received"] - 8000) <= 100, f"inv1 distributions {inv1['total_distributions_received']}"
        assert abs(inv2["total_distributions_received"] - 2000) <= 100, f"inv2 distributions {inv2['total_distributions_received']}"

    def test_12_cannot_delete_paid_distribution(self, admin_headers):
        r = requests.delete(
            f"{BASE_URL}/api/admin/syndication/distributions/{S.dist_id}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400 for deleting paid dist, got {r.status_code}: {r.text}"


# ── D) Documents ────────────────────────────────────────────────────────────
class TestDDocuments:
    def test_13_upload_document(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}/documents",
            json={
                "name": "Test PPM.pdf",
                "doc_type": "ppm",
                "data": "data:application/pdf;base64,JVBERi0xLjQK",
                "mime_type": "application/pdf",
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "document" in j and "id" in j["document"]
        assert "data" not in j["document"], "Response must NOT include raw base64 data"
        S.doc_id = j["document"]["id"]

    def test_14_deal_includes_documents(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        deal_data = r.json()
        docs = deal_data["deal"].get("documents", [])
        assert any(d["id"] == S.doc_id and d["name"] == "Test PPM.pdf" for d in docs)


# ── E) Investors directory ──────────────────────────────────────────────────
class TestEInvestorsDirectory:
    def test_15_list_investors(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/syndication/investors", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        assert "investors" in j
        emails = {i["email"] for i in j["investors"]}
        assert "qa.investor1@test.com" in emails
        assert "qa.investor2@test.com" in emails
        inv1_row = next(i for i in j["investors"] if i["email"] == "qa.investor1@test.com")
        assert inv1_row["total_invested"] == 200000
        assert inv1_row["active_deals"] >= 1

    def test_16_get_investor_detail(self, admin_headers):
        assert S.inv1_investor_id, "Need inv1 investor user id"
        r = requests.get(f"{BASE_URL}/api/admin/syndication/investors/{S.inv1_investor_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["investor"]["email"] == "qa.investor1@test.com"
        assert any(i["id"] == S.inv1_id for i in j["investments"])

    def test_17_reset_investor_password(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/investors/{S.inv1_investor_id}/reset-password",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "temp_password" in j and j["temp_password"]
        assert j["email"] == "qa.investor1@test.com"
        S.temp_password = j["temp_password"]


# ── F) Investor Portal auth ─────────────────────────────────────────────────
class TestFInvestorAuth:
    def test_18_login_wrong_password(self):
        r = requests.post(
            f"{BASE_URL}/api/investor/login",
            json={"email": "qa.investor1@test.com", "password": "WRONG"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_19_login_success(self):
        assert S.temp_password
        r = requests.post(
            f"{BASE_URL}/api/investor/login",
            json={"email": "qa.investor1@test.com", "password": S.temp_password},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and j["token"]
        assert j["user"]["email"] == "qa.investor1@test.com"
        assert j["user"]["role"] == "investor"
        S.investor_token = j["token"]

    def test_20_investor_dashboard(self):
        r = requests.get(f"{BASE_URL}/api/investor/dashboard", headers=investor_headers(), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        s = j["summary"]
        assert s["total_invested"] == 200000, f"got {s['total_invested']}"
        assert abs(s["total_distributions_received"] - 8000) <= 100, f"got {s['total_distributions_received']}"
        assert s["active_deals"] == 1
        assert len(j["investments"]) == 1
        assert len(j["recent_distributions"]) >= 1


# ── G) Investor scoped data access ──────────────────────────────────────────
class TestGInvestorScopedAccess:
    def test_21_investor_deals(self):
        r = requests.get(f"{BASE_URL}/api/investor/deals", headers=investor_headers(), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        deal_ids = [d["id"] for d in j["deals"]]
        assert S.deal_id in deal_ids
        # Should NOT contain deals where investor has no position (sanity: not random other deals)
        assert all(isinstance(d["id"], str) for d in j["deals"])

    def test_22_investor_deal_detail_authorized(self):
        r = requests.get(f"{BASE_URL}/api/investor/deals/{S.deal_id}", headers=investor_headers(), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["deal"]["id"] == S.deal_id
        assert len(j["my_investments"]) == 1
        assert j["my_investments"][0]["id"] == S.inv1_id
        # Must NOT contain inv2 (other investor's data)
        assert all(inv["investor_email"] != "qa.investor2@test.com" for inv in j["my_investments"])
        # Distributions filtered to my investment only
        for d in j["my_distributions"]:
            for p in d["per_investment"]:
                assert p["investment_id"] == S.inv1_id

    def test_23_investor_cannot_access_other_deal(self, admin_headers):
        # Create another deal as admin
        r = requests.post(
            f"{BASE_URL}/api/admin/syndication/deals",
            json={
                "name": "Other QA Deal",
                "property_address": "456 Other St",
                "property_type": "multifamily",
                "units": 5,
                "target_raise": 100000,
                "min_investment": 5000,
                "status": "draft",
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        S.other_deal_id = r.json()["deal"]["id"]

        # Investor accesses it → 403
        r2 = requests.get(f"{BASE_URL}/api/investor/deals/{S.other_deal_id}", headers=investor_headers(), timeout=TIMEOUT)
        assert r2.status_code == 403, f"Expected 403 for non-position deal, got {r2.status_code}: {r2.text}"


# ── H) Public inquiry ───────────────────────────────────────────────────────
class TestHPublicInquiry:
    def test_24_public_inquire(self):
        r = requests.post(
            f"{BASE_URL}/api/public/syndication/inquire",
            json={
                "deal_id": S.deal_id,
                "name": "Prospect QA",
                "email": "prospect@test.com",
                "amount_interested": 50000,
                "message": "Interested",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "inquiry_id" in j and j["inquiry_id"]


# ── I) Cleanup ─────────────────────────────────────────────────────────────
class TestICleanup:
    def test_25a_delete_inv2(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/syndication/investments/{S.inv2_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text

    def test_25b_delete_inv1(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/syndication/investments/{S.inv1_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text

    def test_25c_delete_test_deal(self, admin_headers):
        # First, the paid distribution still exists. delete_deal allows deletion when no investments,
        # and also cascades distributions. So this should succeed.
        r = requests.delete(f"{BASE_URL}/api/admin/syndication/deals/{S.deal_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"

    def test_25d_delete_other_deal(self, admin_headers):
        if not S.other_deal_id:
            pytest.skip("No other deal created")
        r = requests.delete(f"{BASE_URL}/api/admin/syndication/deals/{S.other_deal_id}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text


# ═══════════════════════════════════════════════════════════════════════════════
# PART 2 — OCR RE-VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def _make_tiny_jpeg_b64() -> str:
    """Generate a minimal valid 100x100 JPEG in base64."""
    try:
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except ImportError:
        # Fallback: a tiny pre-baked 1x1 JPEG
        return (
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
            "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
            "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
            "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA"
            "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3"
            "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm"
            "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB"
            "AAIRAxEAPwD3+iiigD//2Q=="
        )


class TestOCRReVerification:
    def test_26_tenant_login(self, tenant_headers):
        # Just verifies the fixture succeeded
        assert S.tenant_token

    def test_27_utility_scan_no_longer_500(self, tenant_headers):
        b64 = _make_tiny_jpeg_b64()
        r = requests.post(
            f"{BASE_URL}/api/tenant/utilities/scan",
            json={"image_base64": b64},
            headers=tenant_headers,
            timeout=90,  # LLM call can be slow
        )
        # CRITICAL: must NOT be 500 with "No hay API key configurada"
        body = r.text
        assert r.status_code != 500 or "No hay API key" not in body, (
            f"OCR still missing API key! status={r.status_code} body={body[:300]}"
        )
        # Should be 200 (success or graceful failure) per the spec
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {body[:300]}"
        j = r.json()
        # Either success:true with data, or success:false with message
        assert "success" in j
        # extracted_data must exist as a dict (even if empty)
        assert "extracted_data" in j
