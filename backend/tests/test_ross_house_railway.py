"""
Production audit tests for Ross House Rentals backend on Railway.
Hits the LIVE production URL:
  https://ross-house-backend-production.up.railway.app

Covers:
  - Health
  - Marketplace login (JWT issuance)
  - Tenant endpoints with JWT
  - Credit Builder (recently re-deployed)
  - Section 8 (public + tenant declare)
  - Stripe endpoints (refactored to stripe_pkg/)
  - Critical admin endpoints
"""
import os
import pytest
import requests

BASE_URL = "https://ross-house-backend-production.up.railway.app"

# Primary tenant from test_credentials.md is failing in production (`Contraseña incorrecta`).
# Fall back to legacy tenant that authenticates successfully so we can exercise the JWT-protected paths.
TENANT_EMAIL = "maria@test.com"
TENANT_PASSWORD = "Test123!"
PRIMARY_TENANT_EMAIL = "yoandyross2025@icloud.com"
PRIMARY_TENANT_PASSWORD = "Test1234!"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"


# ----- fixtures -----
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def tenant_token(session):
    r = session.post(
        f"{BASE_URL}/api/public/marketplace-login",
        json={"email": TENANT_EMAIL, "password": TENANT_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Tenant login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("jwt")
    assert token, f"No token in tenant login response: {data}"
    return token


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(
        f"{BASE_URL}/api/public/marketplace-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("jwt")
    assert token, f"No token in admin login response: {data}"
    return token


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----- health -----
class TestHealth:
    def test_health_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200, r.text[:200]


# ----- auth -----
class TestAuth:
    def test_marketplace_login_tenant_returns_jwt(self, session):
        r = session.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": TENANT_EMAIL, "password": TENANT_PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        token = body.get("token") or body.get("access_token") or body.get("jwt")
        assert token and isinstance(token, str) and len(token) > 20

    def test_marketplace_login_admin_returns_jwt(self, session):
        r = session.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        token = body.get("token") or body.get("access_token") or body.get("jwt")
        assert token and len(token) > 20

    def test_marketplace_login_invalid_credentials(self, session):
        r = session.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": TENANT_EMAIL, "password": "wrong-password"},
            timeout=30,
        )
        assert r.status_code in (400, 401, 403)


# ----- tenant -----
class TestTenantEndpoints:
    def test_tenant_payments(self, session, tenant_token):
        r = session.get(f"{BASE_URL}/api/tenant/payments", headers=auth_headers(tenant_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # accept either list or {"payments": [...]}
        assert isinstance(body, (list, dict))

    def test_tenant_contracts(self, session, tenant_token):
        r = session.get(f"{BASE_URL}/api/tenant/contracts", headers=auth_headers(tenant_token), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_tenant_payment_methods(self, session, tenant_token):
        r = session.get(f"{BASE_URL}/api/tenant/payment-methods", headers=auth_headers(tenant_token), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_tenant_autopay_status(self, session, tenant_token):
        r = session.get(f"{BASE_URL}/api/tenant/autopay/status", headers=auth_headers(tenant_token), timeout=30)
        assert r.status_code == 200, r.text[:300]


# ----- credit builder -----
class TestCreditBuilder:
    def test_credit_builder_my_status_returns_200_not_500(self, session, tenant_token):
        r = session.get(
            f"{BASE_URL}/api/rent-reporting/my-status",
            headers=auth_headers(tenant_token),
            timeout=30,
        )
        # main acceptance: must NOT be 500 anymore
        assert r.status_code != 500, f"Credit Builder is still 500: {r.text[:300]}"
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        # must be JSON-serializable
        body = r.json()
        assert isinstance(body, dict)


# ----- section 8 -----
class TestSection8:
    def test_section8_welcome_public(self, session):
        # The request expected GET /api/public/section8-welcome, but no such route exists in the codebase.
        # Closest existing endpoints: GET /api/tenant/section8/status (auth) and POST /api/tenant/section8/declare (auth).
        r = session.get(f"{BASE_URL}/api/public/section8-welcome", timeout=30)
        assert r.status_code == 200, f"Endpoint missing on production (404 expected if route does not exist). status={r.status_code} body={r.text[:200]}"

    def test_section8_declare_requires_auth(self, session):
        # missing token
        r = session.post(f"{BASE_URL}/api/tenant/section8/declare", json={"is_section8": False}, timeout=30)
        assert r.status_code in (401, 403, 422)

    def test_section8_declare_with_jwt(self, session, tenant_token):
        # declare false -> safe op, idempotent for tests
        r = session.post(
            f"{BASE_URL}/api/tenant/section8/declare",
            headers=auth_headers(tenant_token),
            json={"is_section8": False},
            timeout=30,
        )
        # accept 200 or 400 (already declared) but never 500
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 400, 409), r.text[:300]

    def test_section8_status_with_jwt(self, session, tenant_token):
        # /api/tenant/section8/status is the real implemented endpoint per codebase.
        r = session.get(
            f"{BASE_URL}/api/tenant/section8/status",
            headers=auth_headers(tenant_token),
            timeout=30,
        )
        assert r.status_code != 500, r.text[:300]
        assert r.status_code == 200, r.text[:300]


class TestPrimaryTenantCredentials:
    """Documents that the credentials in test_credentials.md DO NOT work on Railway prod."""
    def test_primary_tenant_login_should_succeed_on_prod(self, session):
        r = session.post(
            f"{BASE_URL}/api/public/marketplace-login",
            json={"email": PRIMARY_TENANT_EMAIL, "password": PRIMARY_TENANT_PASSWORD},
            timeout=30,
        )
        assert r.status_code == 200, (
            f"Primary tenant {PRIMARY_TENANT_EMAIL} cannot log in on prod with "
            f"the password documented in /app/memory/test_credentials.md. "
            f"status={r.status_code} body={r.text[:200]}"
        )


# ----- stripe (refactored stripe_pkg/) -----
class TestStripeRefactor:
    def test_admin_rental_stripe_config(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/rental-stripe-config",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 404), r.text[:300]

    def test_admin_connect_status(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/connect/status",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 404)

    def test_admin_stripe_webhook_events(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/stripe/webhook-events",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 404)


# ----- admin -----
class TestAdminEndpoints:
    def test_admin_rental_payments(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/rental-payments",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]

    def test_admin_properties(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/properties",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]

    def test_admin_tenants(self, session, admin_token):
        r = session.get(
            f"{BASE_URL}/api/admin/tenants",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
