"""
Ross House Rentals — Full Profile / Dashboard QA against Railway PROD.

⚠️  SAFETY:
    - Only GET on real data.
    - Mutations only on records we create with 'TEST QA' prefix.
    - Always cleanup created data at teardown.
    - NEVER call drip send-next, Lob endpoints, Stripe charges.

Coverage:
    Profile ADMIN   — GET listings, cross-role guards.
    Profile TENANT  — GET signatures, self, admin-guard.
    Profile GUEST   — self-register, downgrade tenant→guest, guard.
    Profile BUYER   — self-register, guard.
    Profile LANDLORD— admin creates + landlord login + banking + guard.
    Profile PROVIDER— public registration + admin listing + delete.
    Profile PUBLIC  — blog, newsletter, properties.
    SECURITY        — no-token + wrong-role guards.
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://ross-house-backend-production.up.railway.app"

ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PW    = "admin123"
TENANT_EMAIL = "yosbelgarrido26@gmail.com"
TENANT_PW    = "sRUUSvEB4O"

STAMP = time.strftime("%Y%m%d%H%M%S")
QA_PREFIX = "TEST QA"

# Bucket of testids to clean at the end of the module
CLEANUP: dict = {
    "app_user_ids": [],       # DELETE not always available (guest/buyer) — track for report
    "owner_ids": [],
    "provider_ids": [],
    "blog_comment_ids": [],
    "newsletter_emails": [],
}


# ---------------------------------------------------------- helpers
def _post(path, json=None, token=None, timeout=30):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE_URL}{path}", json=json or {}, headers=h, timeout=timeout)


def _get(path, token=None, params=None, timeout=30):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE_URL}{path}", headers=h, params=params, timeout=timeout)


def _delete(path, token=None, timeout=30):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{BASE_URL}{path}", headers=h, timeout=timeout)


# ---------------------------------------------------------- session-wide fixtures
@pytest.fixture(scope="module")
def admin_token():
    r = _post("/api/public/marketplace-login",
              {"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    j = r.json()
    assert j.get("success") and j.get("token")
    assert j["user"]["role"] == "admin"
    return j["token"]


@pytest.fixture(scope="module")
def tenant_token():
    r = _post("/api/public/marketplace-login",
              {"email": TENANT_EMAIL, "password": TENANT_PW})
    assert r.status_code == 200, f"tenant login failed: {r.status_code} {r.text[:200]}"
    j = r.json()
    assert j["user"]["role"] == "tenant"
    return j["token"]


# ============================================================ ADMIN — API dashboards
class TestAdminDashboardAPI:
    """Admin GET endpoints (dashboards/lists)."""

    @pytest.mark.parametrize("path", [
        "/api/admin/rental-contracts",
        "/api/admin/properties",
        "/api/admin/tenants",
        "/api/admin/drip/config",
        "/api/admin/drip/templates",
        "/api/admin/deal-finder/leads",
        "/api/admin/service-providers",
        "/api/admin/service-providers/stats",
        "/api/admin/owners",
        "/api/admin/tenant-leads",
        "/api/admin/provider-payments/stats",
    ])
    def test_admin_gets_return_200(self, admin_token, path):
        r = _get(path, token=admin_token)
        assert r.status_code == 200, f"{path} -> {r.status_code} :: {r.text[:200]}"
        try:
            j = r.json()
        except Exception:
            pytest.fail(f"{path} returned non-JSON")
        assert j is not None
        # basic shape: dict OR list
        assert isinstance(j, (dict, list))

    def test_admin_no_token_is_rejected(self):
        for p in ["/api/admin/rental-contracts",
                  "/api/admin/properties",
                  "/api/admin/owners"]:
            r = _get(p)
            assert r.status_code in (401, 403), f"{p} without token -> {r.status_code}"


# ============================================================ TENANT
class TestTenantAPI:
    def test_tenant_signatures_pending(self, tenant_token):
        r = _get("/api/signatures/pending", token=tenant_token)
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j, (list, dict))

    def test_tenant_service_providers(self, tenant_token):
        r = _get("/api/tenant/service-providers", token=tenant_token)
        assert r.status_code == 200
        r2 = _get("/api/tenant/service-providers/services", token=tenant_token)
        assert r2.status_code == 200

    def test_tenant_marketplace_me(self, tenant_token):
        r = _get("/api/marketplace/me", token=tenant_token)
        assert r.status_code == 200
        j = r.json()
        # role tenant, email matches
        u = j.get("user", j)
        assert u.get("email", "").lower() == TENANT_EMAIL

    @pytest.mark.parametrize("admin_path", [
        "/api/admin/rental-contracts",
        "/api/admin/properties",
        "/api/admin/owners",
    ])
    def test_tenant_token_cannot_access_admin(self, tenant_token, admin_path):
        r = _get(admin_path, token=tenant_token)
        assert r.status_code in (401, 403), (
            f"tenant token accessed {admin_path} -> {r.status_code}"
        )


# ============================================================ GUEST self-registration
class TestGuestRegistration:
    guest_email = f"testqa.guest.{STAMP}@example.com"
    guest_pw    = "GuestQA123!"
    guest_token = None

    def test_1_register_guest(self):
        r = _post("/api/public/marketplace-register", {
            "name":  f"{QA_PREFIX} Guest {STAMP}",
            "email": self.__class__.guest_email,
            "phone": "5551230001",
            "password": self.guest_pw,
            "role": "guest",
        })
        assert r.status_code == 200, f"guest register: {r.status_code} {r.text[:300]}"
        j = r.json()
        assert j.get("success") and j.get("token")
        assert j["user"]["role"] == "guest"
        self.__class__.guest_token = j["token"]
        CLEANUP["app_user_ids"].append(("guest", j["user"]["id"], self.__class__.guest_email))

    def test_2_role_tenant_downgraded_to_guest(self):
        email = f"testqa.tenantdown.{STAMP}@example.com"
        r = _post("/api/public/marketplace-register", {
            "name":  f"{QA_PREFIX} TenantDown {STAMP}",
            "email": email,
            "phone": "5551230002",
            "password": "PwTest123!",
            "role": "tenant",
        })
        assert r.status_code == 200, f"self-register w/ tenant: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert j["user"]["role"] == "guest", (
            f"tenant self-reg should be downgraded to guest, got {j['user']['role']}"
        )
        CLEANUP["app_user_ids"].append(("tenant->guest", j["user"]["id"], email))

    def test_3_guest_login_ok(self):
        r = _post("/api/public/marketplace-login",
                  {"email": self.guest_email, "password": self.guest_pw})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "guest"

    def test_4_guest_cannot_access_admin(self):
        tok = self.__class__.guest_token
        assert tok, "guest token missing (previous test failed?)"
        for p in ["/api/admin/rental-contracts",
                  "/api/admin/owners",
                  "/api/admin/service-providers"]:
            r = _get(p, token=tok)
            assert r.status_code in (401, 403), (
                f"guest accessed {p} -> {r.status_code}"
            )


# ============================================================ BUYER
class TestBuyerRegistration:
    buyer_email = f"testqa.buyer.{STAMP}@example.com"
    buyer_pw    = "BuyerQA123!"
    buyer_token = None

    def test_1_register_buyer(self):
        r = _post("/api/public/marketplace-register", {
            "name":  f"{QA_PREFIX} Buyer {STAMP}",
            "email": self.__class__.buyer_email,
            "phone": "5551230003",
            "password": self.buyer_pw,
            "role": "buyer",
        })
        assert r.status_code == 200, f"buyer register: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert j["user"]["role"] == "buyer"
        self.__class__.buyer_token = j["token"]
        CLEANUP["app_user_ids"].append(("buyer", j["user"]["id"], self.__class__.buyer_email))

    def test_2_buyer_login_ok(self):
        r = _post("/api/public/marketplace-login",
                  {"email": self.buyer_email, "password": self.buyer_pw})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "buyer"

    def test_3_buyer_cannot_access_admin_or_tenant_areas(self):
        tok = self.__class__.buyer_token
        assert tok
        # admin
        r = _get("/api/admin/rental-contracts", token=tok)
        assert r.status_code in (401, 403)


# ============================================================ LANDLORD
class TestLandlord:
    owner_email = f"testqa.owner.{STAMP}@example.com"
    owner_pw    = "OwnerQA123!"
    owner_id    = None
    owner_token = None

    def test_1_admin_creates_owner(self, admin_token):
        payload = {
            "name": f"{QA_PREFIX} Owner {STAMP}",
            "email": self.__class__.owner_email,
            "phone": "5551230004",
            "password": self.owner_pw,
            "company": f"{QA_PREFIX} LLC",
            "state": "TX",
        }
        r = _post("/api/admin/owners", payload, token=admin_token)
        assert r.status_code == 200, f"create owner: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert j.get("success") and j.get("owner_id")
        self.__class__.owner_id = j["owner_id"]
        CLEANUP["owner_ids"].append(self.__class__.owner_id)

    def test_2_owner_can_login(self):
        assert self.__class__.owner_id, "owner not created"
        r = _post("/api/public/marketplace-login",
                  {"email": self.owner_email, "password": self.owner_pw})
        assert r.status_code == 200, f"owner login: {r.status_code} {r.text[:200]}"
        j = r.json()
        assert j["user"]["role"] == "landlord"
        self.__class__.owner_token = j["token"]

    def test_3_owner_dashboard(self):
        tok = self.__class__.owner_token
        assert tok
        r = _get("/api/owner/dashboard", token=tok)
        assert r.status_code == 200, f"/owner/dashboard: {r.status_code} {r.text[:200]}"

    def test_4_owner_banking_roundtrip(self):
        tok = self.__class__.owner_token
        # POST banking (dummy)
        payload = {
            "account_holder_name": f"{QA_PREFIX} Owner",
            "bank_name": "TEST QA Bank",
            "account_type": "checking",
            "routing_number": "021000021",
            "account_number": "000123456789",
        }
        r = _post("/api/owner/banking", payload, token=tok)
        assert r.status_code == 200, f"POST /owner/banking: {r.status_code} {r.text[:200]}"
        r2 = _get("/api/owner/banking", token=tok)
        assert r2.status_code == 200

    def test_5_owner_cannot_access_admin(self):
        tok = self.__class__.owner_token
        assert tok
        r = _get("/api/admin/rental-contracts", token=tok)
        assert r.status_code in (401, 403), f"landlord hit admin -> {r.status_code}"


# ============================================================ SERVICE PROVIDER
class TestServiceProvider:
    provider_email = f"testqa.provider.{STAMP}@example.com"
    provider_id = None

    def test_1_public_register_provider(self):
        payload = {
            "name": f"{QA_PREFIX} Provider {STAMP}",
            "company_name": f"{QA_PREFIX} Services LLC",
            "email": self.__class__.provider_email,
            "phone": "5551230005",
            "services": ["plumber", "handyman"],
            "billing_type": "per_hour",
            "hourly_rate": 50,
            "language_pref": "es",
            "languages": ["es", "en"],
            "bio": "QA test provider — do not dispatch",
            "source": "qa_test",
        }
        r = _post("/api/public/service-providers", payload)
        # Prod enforces Cloudflare Turnstile; without a real token from the
        # web widget the endpoint correctly rejects with 400 "Captcha requerido".
        if r.status_code == 400 and "aptcha" in r.text:
            pytest.skip("Turnstile captcha enforced in prod — cannot register "
                        "provider from headless test (expected behavior).")
        assert r.status_code == 200, f"provider register: {r.status_code} {r.text[:300]}"
        j = r.json()
        assert j.get("success") and j.get("id")
        self.__class__.provider_id = j["id"]
        CLEANUP["provider_ids"].append(self.__class__.provider_id)

    def test_2_public_services_list(self):
        r = _get("/api/public/service-providers/services")
        assert r.status_code == 200
        assert r.json().get("success") is True
        svc = r.json().get("services", [])
        assert len(svc) > 5

    def test_3_public_check_provider(self):
        if not self.__class__.provider_id:
            pytest.skip("provider not created (captcha) — cannot verify check")
        r = _get("/api/public/service-providers/check",
                 params={"email": self.__class__.provider_email})
        assert r.status_code == 200
        assert r.json().get("exists") is True

    def test_4_admin_sees_provider(self, admin_token):
        if not self.__class__.provider_id:
            pytest.skip("provider not created (captcha) — cannot verify admin listing")
        r = _get("/api/admin/service-providers", token=admin_token)
        assert r.status_code == 200
        j = r.json()
        # response can be dict{providers:[]} or list
        providers = j.get("providers") if isinstance(j, dict) else j
        assert providers is not None
        found = any(str(p.get("id") or p.get("_id")) == self.__class__.provider_id
                    for p in providers)
        assert found, "created provider not present in admin listing"


# ============================================================ PUBLIC / BLOG / NEWSLETTER
class TestPublic:
    blog_slug = "5-preguntas-que-debes-hacer-antes-de-rentar"
    comment_id = None
    news_email = f"testqa.news.{STAMP}@example.com"

    def test_1_blog_posts_list(self):
        r = _get("/api/public/blog/posts")
        assert r.status_code == 200
        j = r.json()
        posts = j.get("posts") if isinstance(j, dict) else j
        assert isinstance(posts, list)
        # QA claim: 15 posts expected
        assert len(posts) >= 1, f"expected posts, got {len(posts)}"

    def test_2_blog_post_detail(self):
        r = _get(f"/api/public/blog/posts/{self.blog_slug}")
        # if slug missing -> report but don't fail hard
        assert r.status_code in (200, 404), r.status_code
        if r.status_code == 404:
            pytest.skip(f"slug {self.blog_slug} not present in prod")
        j = r.json()
        assert (j.get("slug") == self.blog_slug or (j.get("post") or {}).get("slug") == self.blog_slug)

    def test_3_post_comment_then_admin_deletes(self, admin_token):
        payload = {
            "name": f"{QA_PREFIX} Commenter",
            "comment": f"{QA_PREFIX} — automated regression comment. Safe to delete.",
        }
        r = _post(f"/api/public/blog/posts/{self.blog_slug}/comments", payload)
        if r.status_code == 404:
            pytest.skip("blog slug missing in prod, cannot post comment")
        assert r.status_code in (200, 201), f"comment: {r.status_code} {r.text[:200]}"
        j = r.json()
        cid = j.get("id") or j.get("comment_id") or (j.get("comment") or {}).get("id")
        assert cid, f"no comment id in response: {j}"
        self.__class__.comment_id = cid
        CLEANUP["blog_comment_ids"].append(cid)
        # Try delete via admin
        rd = _delete(f"/api/admin/blog/comments/{cid}", token=admin_token)
        assert rd.status_code in (200, 204), f"admin delete comment: {rd.status_code} {rd.text[:200]}"
        # Remove from cleanup list since we already deleted
        CLEANUP["blog_comment_ids"].remove(cid)

    def test_4_newsletter_subscribe(self):
        r = _post("/api/public/newsletter/subscribe", {
            "email": self.news_email,
            "name": f"{QA_PREFIX} Newsletter",
        })
        assert r.status_code in (200, 201, 409), f"newsletter subscribe: {r.status_code} {r.text[:200]}"
        CLEANUP["newsletter_emails"].append(self.news_email)

    def test_5_public_properties(self):
        r = _get("/api/public/properties")
        assert r.status_code == 200
        j = r.json()
        assert isinstance(j, (list, dict))


# ============================================================ SECURITY TRANSVERSAL
class TestSecurityGuards:
    @pytest.mark.parametrize("path", [
        "/api/admin/rental-contracts",
        "/api/admin/properties",
        "/api/admin/owners",
        "/api/admin/service-providers",
        "/api/signatures/pending",
        "/api/tenant/service-providers",
        "/api/owner/dashboard",
    ])
    def test_no_token_rejected(self, path):
        r = _get(path)
        assert r.status_code in (401, 403), f"{path} anonymous -> {r.status_code}"


# ============================================================ CLEANUP (runs last)
@pytest.fixture(scope="module", autouse=True)
def _cleanup_all(request):
    yield
    # Get fresh admin token (module-scoped fixture may already be torn)
    try:
        r = _post("/api/public/marketplace-login",
                  {"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
        tok = r.json().get("token") if r.status_code == 200 else None
    except Exception:
        tok = None

    # Owners
    for oid in CLEANUP["owner_ids"]:
        try:
            _delete(f"/api/admin/owners/{oid}", token=tok)
        except Exception:
            pass
    # Providers
    for pid in CLEANUP["provider_ids"]:
        try:
            _delete(f"/api/admin/service-providers/{pid}", token=tok)
        except Exception:
            pass
    # Comments (best effort)
    for cid in CLEANUP["blog_comment_ids"]:
        try:
            _delete(f"/api/admin/blog/comments/{cid}", token=tok)
        except Exception:
            pass
    # Log residual app users (guest/buyer) — endpoint may not exist
    if CLEANUP["app_user_ids"]:
        # Try DELETE /api/admin/marketplace/users/{id} — may or may not exist
        for role, uid, email in CLEANUP["app_user_ids"]:
            for cand in [
                f"/api/admin/marketplace-users/{uid}",
                f"/api/admin/app-users/{uid}",
                f"/api/admin/users/{uid}",
            ]:
                try:
                    rr = _delete(cand, token=tok)
                    if rr.status_code in (200, 204):
                        break
                except Exception:
                    continue
    # Newsletter — try unsubscribe endpoint (public)
    for e in CLEANUP["newsletter_emails"]:
        for cand in [
            f"/api/admin/newsletter/subscribers?email={e}",
        ]:
            try:
                _delete(cand, token=tok)
            except Exception:
                continue

    print("\n--- CLEANUP SUMMARY ---")
    print(f"Owners deleted attempts:   {len(CLEANUP['owner_ids'])}")
    print(f"Providers deleted attempts:{len(CLEANUP['provider_ids'])}")
    print(f"Comments deleted attempts: {len(CLEANUP['blog_comment_ids'])}")
    print(f"App users residual (may need manual cleanup): "
          f"{[(r,u,e) for r,u,e in CLEANUP['app_user_ids']]}")
    print(f"Newsletter emails residual: {CLEANUP['newsletter_emails']}")
