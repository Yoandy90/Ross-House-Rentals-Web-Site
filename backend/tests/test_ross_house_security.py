"""
Security tests for Ross House Rentals backend (deployed on Railway).

Covers:
- SEC-001: password bypass (email+phone) must be gone
- Login happy-path still works (admin)
- SEC-002: anti-enumeration – identical status+message for missing email vs wrong password
- SEC-003: /api/upload/image requires a valid JWT (weak/no token → 401)
- CORS: only whitelisted origins receive Access-Control-Allow-Origin

Notes:
- Rate limit on /login is 5 req/min per IP; lockout is 5 fails/account.
- We intentionally do the admin SUCCESS login FIRST, then run failure cases
  using throwaway emails (never the admin).
"""
import os
import time
import jwt
import pytest
import requests

BASE_URL = os.environ.get(
    "ROSS_BACKEND_URL",
    "https://ross-house-backend-production.up.railway.app",
).rstrip("/")

LOGIN_URL = f"{BASE_URL}/api/public/marketplace-login"
UPLOAD_URL = f"{BASE_URL}/api/upload/image"

ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"

# Throwaway emails so we never touch the admin account failure counter
THROWAWAY_MISSING_EMAIL = "noexiste-xyz-qa@example.com"
# QA account (may or may not exist) — used only for wrong-password test.
THROWAWAY_EXISTING_EMAIL = "test.comprador.qa@example.com"

GENERIC_ERR = "Credenciales inválidas"


# ── shared state across tests ─────────────────────────────────────────────
_state = {"admin_token": None, "admin_login_status": None}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── 1. Happy path FIRST (to reserve the admin account) ────────────────────
def test_01_admin_login_success(s):
    r = s.post(LOGIN_URL, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    _state["admin_login_status"] = r.status_code
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:400]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("token"), str) and len(body["token"]) > 20
    assert body.get("user", {}).get("email", "").lower() == ADMIN_EMAIL
    _state["admin_token"] = body["token"]


# ── 2. SEC-001: bypass with email+phone must NOT work ─────────────────────
def test_02_sec001_password_bypass_removed(s):
    """POST /marketplace-login with {email, phone} (no password) must return 401."""
    r = s.post(
        LOGIN_URL,
        json={"email": ADMIN_EMAIL, "phone": "5555550123"},
        timeout=30,
    )
    if r.status_code == 429:
        pytest.skip("Rate-limited by backend; 429 also blocks abuse (acceptable).")
    assert r.status_code == 401, (
        f"CRITICAL: phone/last-4 bypass may still be active. "
        f"Got {r.status_code} {r.text[:300]}"
    )
    body = r.json()
    assert body.get("detail") == GENERIC_ERR, f"unexpected detail: {body}"


# ── 3. SEC-002: anti-enumeration — same status + same message ─────────────
def test_03_sec002_missing_email_returns_generic_401(s):
    r = s.post(
        LOGIN_URL,
        json={"email": THROWAWAY_MISSING_EMAIL, "password": "x"},
        timeout=30,
    )
    if r.status_code == 429:
        pytest.skip("Rate-limited.")
    assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text[:300]}"
    assert r.json().get("detail") == GENERIC_ERR
    _state["missing_status"] = r.status_code
    _state["missing_detail"] = r.json().get("detail")


def test_04_sec002_wrong_password_returns_generic_401(s):
    r = s.post(
        LOGIN_URL,
        json={"email": THROWAWAY_EXISTING_EMAIL, "password": "definitelyWrong_zzz"},
        timeout=30,
    )
    if r.status_code == 429:
        pytest.skip("Rate-limited.")
    assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text[:300]}"
    assert r.json().get("detail") == GENERIC_ERR

    # Cross-check: same status AND same detail as the missing-email case.
    if "missing_status" in _state:
        assert r.status_code == _state["missing_status"], "status differs → enumeration risk"
        assert r.json().get("detail") == _state["missing_detail"], (
            "detail differs → enumeration risk"
        )


# ── 4. SEC-003: /api/upload/image requires a valid JWT ────────────────────
def test_05_sec003_upload_no_token_returns_401(s):
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    # requests session sets Content-Type: application/json in module fixture; strip it
    r = requests.post(UPLOAD_URL, files=files, timeout=30)
    assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text[:300]}"


def test_06_sec003_upload_weak_secret_token_rejected(s):
    """A JWT signed with a guessable/weak secret must be rejected."""
    weak_token = jwt.encode(
        {"user_id": "attacker", "email": "x@x.com", "role": "admin", "exp": int(time.time()) + 3600},
        "secret",  # classic weak default
        algorithm="HS256",
    )
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    r = requests.post(
        UPLOAD_URL,
        files=files,
        headers={"Authorization": f"Bearer {weak_token}"},
        timeout=30,
    )
    assert r.status_code == 401, (
        f"weak-secret JWT should be rejected, got {r.status_code} {r.text[:300]}"
    )


# ── 5. CORS: strict origin allowlist ─────────────────────────────────────
def test_07_cors_evil_origin_blocked():
    r = requests.options(
        LOGIN_URL,
        headers={
            "Origin": "https://evil-hacker.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=30,
    )
    acao = r.headers.get("access-control-allow-origin", "")
    # Must NOT reflect the evil origin (and must not be "*").
    assert acao != "https://evil-hacker.com", (
        f"CORS reflected evil origin: {acao}"
    )
    assert acao != "*", "CORS is wide open (allow_origins=*) in production"


def test_08_cors_prod_origin_allowed():
    r = requests.options(
        LOGIN_URL,
        headers={
            "Origin": "https://www.rosshouserentals.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=30,
    )
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao == "https://www.rosshouserentals.com", (
        f"expected prod origin echoed in Access-Control-Allow-Origin, got '{acao}'. "
        f"Status={r.status_code}"
    )
