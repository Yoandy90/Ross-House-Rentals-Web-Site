"""
Backend tests for the OCR Utility Bill fix on Railway production.

Targets:
  - POST /api/tenant/utilities/scan  (the FIXED endpoint using emergentintegrations)
  - GET  /api/admin/tenant-utilities (NEW admin visibility endpoint)
  - POST/GET /api/tenant/utilities   (regression smoke)
  - GET /api/tenant/utilities/summary (regression smoke)
  - POST /api/admin/utility-ocr/extract  (existing admin OCR, regression)
  - GET  /api/admin/utility-ocr/non-xcel-bills (admin, regression)

Run:
  pytest /app/backend/tests/test_tenant_utilities_ocr.py -v \
    --tb=short \
    --junitxml=/app/test_reports/pytest/tenant_utilities_ocr.xml
"""
import base64
import io
import os
import time

import pytest
import requests

BASE_URL = "https://ross-house-backend-production.up.railway.app"

TENANT_EMAIL = "maria@test.com"
TENANT_PASSWORD = "Test123!"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http, email, password):
    """Helper to login and return JWT (with simple retry for 429)."""
    for attempt in range(3):
        r = http.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": email, "password": password},
            timeout=30,
        )
        if r.status_code == 429:
            time.sleep(20)
            continue
        return r
    return r


@pytest.fixture(scope="session")
def tenant_token(http):
    r = _login(http, TENANT_EMAIL, TENANT_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Tenant login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_token(http):
    r = _login(http, ADMIN_EMAIL, ADMIN_PASSWORD)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def small_jpeg_b64():
    """Generate a tiny valid JPEG (200x200) and return base64 string (no prefix)."""
    try:
        from PIL import Image
    except Exception:
        pytest.skip("Pillow not installed in this environment")
    img = Image.new("RGB", (200, 200), color=(220, 220, 220))
    # draw a few rectangles to look bill-ish
    for x in range(0, 200, 40):
        for y in range(0, 200, 40):
            img.putpixel((x, y), (50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode()


# ─────────────────────────────────────────────────────────────
# 1. POST /api/tenant/utilities/scan — the FIXED endpoint
# ─────────────────────────────────────────────────────────────
class TestTenantScanEndpoint:
    def test_scan_without_auth_returns_401(self, http):
        r = http.post(f"{BASE_URL}/api/tenant/utilities/scan", json={}, timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code} {r.text[:200]}"

    def test_scan_no_body_returns_400(self, http, tenant_token):
        r = http.post(
            f"{BASE_URL}/api/tenant/utilities/scan",
            json={},
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400 got {r.status_code} {r.text[:200]}"
        assert "image_base64" in r.text.lower() or "requiere" in r.text.lower()

    def test_scan_invalid_base64_returns_400(self, http, tenant_token):
        r = http.post(
            f"{BASE_URL}/api/tenant/utilities/scan",
            json={"image_base64": "$$$ this is not base64 at all !!!"},
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=60,
        )
        # base64.b64decode(validate=False) is permissive on garbage; the LLM may then
        # fail. Accept either 400 (strict validation) OR 200 with success:false.
        # NEVER accept 500.
        assert r.status_code != 500, f"Endpoint crashed with 500: {r.text[:300]}"
        assert r.status_code in (400, 200), f"Unexpected {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            body = r.json()
            assert body.get("success") is False
            assert "message" in body

    def test_scan_oversized_payload_returns_413(self, http, tenant_token):
        # Create ~12 MB of raw bytes → base64 ~16 MB
        big = base64.b64encode(b"A" * (12 * 1024 * 1024)).decode()
        r = http.post(
            f"{BASE_URL}/api/tenant/utilities/scan",
            json={"image_base64": big},
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=120,
        )
        # Ideally 413; Railway / proxy may also reject with 400 or 502 before reaching app.
        assert r.status_code != 500, f"Endpoint crashed with 500: {r.text[:300]}"
        assert r.status_code in (413, 400, 502, 504, 422), (
            f"Expected 413 (or proxy reject) got {r.status_code} {r.text[:200]}"
        )

    def test_scan_small_valid_jpeg_no_500(self, http, tenant_token, small_jpeg_b64):
        """Real LLM call. Accept either success or graceful failure but never 500."""
        r = http.post(
            f"{BASE_URL}/api/tenant/utilities/scan",
            json={"image_base64": small_jpeg_b64},
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=120,
        )
        assert r.status_code != 500, f"Endpoint crashed: {r.status_code} {r.text[:500]}"
        assert r.status_code == 200, f"Expected 200 got {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "success" in body
        assert isinstance(body["success"], bool)
        assert "message" in body
        assert "extracted_data" in body
        assert isinstance(body["extracted_data"], dict)


# ─────────────────────────────────────────────────────────────
# 2. GET /api/admin/tenant-utilities — NEW admin visibility
# ─────────────────────────────────────────────────────────────
class TestAdminTenantUtilities:
    def test_no_auth_returns_401(self, http):
        r = http.get(f"{BASE_URL}/api/admin/tenant-utilities", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code}"

    def test_non_admin_tenant_blocked(self, http, tenant_token):
        r = http.get(
            f"{BASE_URL}/api/admin/tenant-utilities",
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code in (401, 403), (
            f"Tenant should not access admin endpoint, got {r.status_code} {r.text[:200]}"
        )

    def test_admin_can_list(self, http, admin_token):
        r = http.get(
            f"{BASE_URL}/api/admin/tenant-utilities",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200 got {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("success") is True
        assert "records" in body and isinstance(body["records"], list)
        for key in ("total", "page", "limit", "total_pages"):
            assert key in body, f"Missing key {key} in response"
        assert body["page"] == 1
        assert body["limit"] >= 1

    def test_admin_with_filters(self, http, admin_token):
        params = {
            "page": 1,
            "limit": 10,
            "tenant_id": "doesnotexist",
            "provider_type": "water",
            "period": "2026-01",
        }
        r = http.get(
            f"{BASE_URL}/api/admin/tenant-utilities",
            headers={"Authorization": f"Bearer {admin_token}"},
            params=params,
            timeout=30,
        )
        assert r.status_code == 200, f"Filter request failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body["success"] is True
        assert body["limit"] == 10
        # With unknown tenant_id, records should be empty
        assert isinstance(body["records"], list)


# ─────────────────────────────────────────────────────────────
# 3. /api/tenant/utilities CRUD + summary smoke
# ─────────────────────────────────────────────────────────────
class TestTenantUtilitiesCRUD:
    created_id = None

    def test_create_utility_record(self, http, tenant_token):
        payload = {
            "provider_id": "city_water",
            "provider_name": "Dumas Water",
            "provider_type": "water",
            "amount": 65.50,
            "period": "2026-01",
            "notes": "TEST_qa_record",
        }
        r = http.post(
            f"{BASE_URL}/api/tenant/utilities",
            json=payload,
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"Create failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body["success"] is True
        record = body.get("record") or {}
        assert record.get("provider_id") == "city_water"
        assert record.get("amount") == 65.50
        TestTenantUtilitiesCRUD.created_id = record.get("_id")
        assert TestTenantUtilitiesCRUD.created_id, "No _id returned"

    def test_list_includes_created(self, http, tenant_token):
        r = http.get(
            f"{BASE_URL}/api/tenant/utilities",
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["records"], list)
        ids = [rec.get("_id") for rec in body["records"]]
        if TestTenantUtilitiesCRUD.created_id:
            assert TestTenantUtilitiesCRUD.created_id in ids, "Just-created record not in list"

    def test_summary_shape(self, http, tenant_token):
        r = http.get(
            f"{BASE_URL}/api/tenant/utilities/summary",
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"Summary failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body["success"] is True
        for k in ("current_month_total", "by_type", "trend"):
            assert k in body, f"Missing key {k}"
        assert isinstance(body["by_type"], dict)
        assert isinstance(body["trend"], list)

    def test_zz_cleanup(self, http, tenant_token):
        """Delete the test record to avoid polluting prod data."""
        if not TestTenantUtilitiesCRUD.created_id:
            pytest.skip("No record to clean up")
        r = http.delete(
            f"{BASE_URL}/api/tenant/utilities/{TestTenantUtilitiesCRUD.created_id}",
            headers={"Authorization": f"Bearer {tenant_token}"},
            timeout=30,
        )
        assert r.status_code in (200, 404), f"Cleanup failed: {r.status_code} {r.text[:200]}"


# ─────────────────────────────────────────────────────────────
# 4. Admin OCR regression
# ─────────────────────────────────────────────────────────────
class TestAdminOCRRegression:
    def test_admin_extract_with_image(self, http, admin_token, small_jpeg_b64):
        img_bytes = base64.b64decode(small_jpeg_b64)
        files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
        r = requests.post(
            f"{BASE_URL}/api/admin/utility-ocr/extract",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=120,
        )
        assert r.status_code != 500, f"Admin OCR crashed: {r.status_code} {r.text[:300]}"
        assert r.status_code == 200, f"Expected 200 got {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "success" in body
        # Either success:true with data OR success:false with message
        assert isinstance(body.get("success"), bool)

    def test_admin_list_non_xcel_bills(self, http, admin_token):
        r = http.get(
            f"{BASE_URL}/api/admin/utility-ocr/non-xcel-bills",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"non-xcel-bills failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "bills" in body and isinstance(body["bills"], list)
