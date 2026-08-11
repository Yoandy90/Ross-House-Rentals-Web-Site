"""Dynamic API Key Manager — backend tests

Covers /api/admin/api-keys CRUD + reveal + at-rest encryption + audit trail.
Backend under test: http://localhost:8002 (ross-house-backend, uvicorn).
"""
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = "http://localhost:8002"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASS = "admin123"

# Load Mongo config from the REAL backend's .env
_env = dotenv_values("/app/ross-house-backend/.env")
MONGO_URL = _env.get("MONGO_URL") or os.environ.get("MONGO_URL")
DB_NAME = "taxportal"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/public/marketplace-login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    tok = data.get("token")
    assert tok, "no token in login response"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def mongo_col():
    assert MONGO_URL, "MONGO_URL not configured"
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    yield client[DB_NAME].admin_config
    client.close()


# ── 1. List keys — grouped, masked, source correct ──────────────────────────

def test_list_api_keys_returns_groups(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=auth_headers, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    groups = body.get("groups") or []
    cats = {g["category"] for g in groups}
    for expected in ["SendGrid (Emails)", "Twilio (SMS)", "Lob (Correo Directo)",
                      "Plaid (Bancos)", "TikTok (Marketing)", "OpenAI (IA)",
                      "Emergent (IA / Escáner de Recibos)",
                      "Mashvisor (Análisis de Mercado)", "Expo (Notificaciones Push)"]:
        assert expected in cats, f"missing category: {expected}"


def _find_key(groups, key_name):
    for g in groups:
        for k in g["keys"]:
            if k["key"] == key_name:
                return k
    return None


def test_lob_api_key_masked_and_from_db(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=auth_headers, timeout=10)
    body = r.json()
    lob = _find_key(body["groups"], "LOB_API_KEY")
    assert lob is not None, "LOB_API_KEY missing from registry"
    assert lob["source"] == "db", f"expected LOB source=db, got {lob['source']}"
    assert lob["secret"] is True
    # Masked value should be bullets + last 4 (contains dots + 'e1de' or similar)
    assert lob["masked"].endswith("e1de"), f"LOB mask should end with 'e1de': {lob['masked']}"
    assert "•" in lob["masked"] or "*" in lob["masked"] or "·" in lob["masked"], \
        f"LOB masked value should contain bullets: {lob['masked']}"


def test_non_secret_key_shown_in_full(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=auth_headers, timeout=10)
    body = r.json()
    # SENDGRID_FROM_EMAIL is secret=False → should be shown in full
    sfe = _find_key(body["groups"], "SENDGRID_FROM_EMAIL")
    if sfe and sfe.get("has_value"):
        assert "•" not in sfe["masked"] and "*" not in sfe["masked"], \
            f"non-secret should be shown in full: {sfe['masked']}"


# ── 2. PUT TWILIO_AUTH_TOKEN → live rotation ────────────────────────────────

def test_put_twilio_auth_token_success(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/admin/api-keys/TWILIO_AUTH_TOKEN",
        json={"value": "test_token_abc123"},
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True
    assert d.get("source") == "db"
    assert d.get("masked", "").endswith("c123")


def test_list_after_put_shows_twilio_from_db(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=auth_headers, timeout=10)
    body = r.json()
    tw = _find_key(body["groups"], "TWILIO_AUTH_TOKEN")
    assert tw is not None
    assert tw["source"] == "db", f"expected source=db, got {tw['source']}"
    assert tw["masked"].endswith("c123"), f"masked should end 'c123': {tw['masked']}"


# ── 3. Reveal ───────────────────────────────────────────────────────────────

def test_reveal_returns_plaintext(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/api-keys/TWILIO_AUTH_TOKEN/reveal",
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True
    assert d.get("value") == "test_token_abc123"


# ── 4. Encryption at rest ───────────────────────────────────────────────────

def test_encryption_at_rest_fernet_ciphertext(mongo_col):
    doc = mongo_col.find_one({"type": "api_keys"})
    assert doc is not None, "admin_config {type:api_keys} not found"
    enc = (doc.get("keys") or {}).get("TWILIO_AUTH_TOKEN")
    assert enc, "TWILIO_AUTH_TOKEN not in DB after PUT"
    # Should NOT be plaintext
    assert enc != "test_token_abc123", "value stored as plaintext!"
    # Fernet tokens are base64url and start with 'gAAAA' (version byte 0x80)
    assert enc.startswith("gAAAA"), f"not a Fernet ciphertext: {enc[:20]}"


# ── 5. DELETE TWILIO_AUTH_TOKEN (cleanup) ───────────────────────────────────

def test_delete_twilio_auth_token(auth_headers):
    r = requests.delete(
        f"{BASE_URL}/api/admin/api-keys/TWILIO_AUTH_TOKEN",
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("success") is True
    # No .env value existed → source should be 'missing'
    assert d.get("source") in ("missing", "env"), f"unexpected source: {d.get('source')}"


def test_list_after_delete_twilio(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=auth_headers, timeout=10)
    body = r.json()
    tw = _find_key(body["groups"], "TWILIO_AUTH_TOKEN")
    assert tw is not None
    # after delete + no .env fallback → 'missing' (or 'env' if some fallback exists)
    assert tw["source"] in ("missing", "env"), f"twilio source after delete: {tw['source']}"


# ── 6. Security ─────────────────────────────────────────────────────────────

def test_list_without_token_401():
    r = requests.get(f"{BASE_URL}/api/admin/api-keys", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_put_empty_value_400(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/admin/api-keys/TWILIO_AUTH_TOKEN",
        json={"value": ""},
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_put_unknown_key_404(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/admin/api-keys/NONEXISTENT_KEY_XYZ",
        json={"value": "abc"},
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}"


def test_reveal_unknown_key_404(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/api-keys/NONEXISTENT_KEY_XYZ/reveal",
        headers=auth_headers, timeout=10,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}"


# ── 7. Audit trail ──────────────────────────────────────────────────────────

def test_audit_log_contains_actions(mongo_col):
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    try:
        audit = client[DB_NAME].vault_audit_log
        recent = list(audit.find({"target": "TWILIO_AUTH_TOKEN"}).sort("at", -1).limit(20))
        actions = {r.get("action") for r in recent}
        assert "api_key_updated" in actions, f"missing api_key_updated in {actions}"
        assert "api_key_revealed" in actions, f"missing api_key_revealed in {actions}"
        assert "api_key_deleted" in actions, f"missing api_key_deleted in {actions}"
    finally:
        client.close()
