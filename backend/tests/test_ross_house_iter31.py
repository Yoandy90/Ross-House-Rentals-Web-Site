"""
Iteration 31 — Ross House Rentals backend regression tests.

Scope:
- SECURITY: admin 2FA bypass via marketplace-login is closed (403 admin_2fa_required).
- Admin 2FA login-step1: bad password, correct password, account lockout.
- Newsletter Pro: CRUD, schedule, recurring, tracking; AI topics + generate.
- Chat: admin conversations, /conversations/{id}/messages alias, read, ai toggle, admin send.
- Consent forms PDF: background-check, income-verification, photo-video, ach-authorization.

Backend base URL: http://localhost:8002  (Ross House FastAPI, NOT /app/backend).
"""
import os
import time
import base64
from datetime import datetime, timedelta

import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

# Load .env from the real backend
load_dotenv("/app/ross-house-backend/.env")

BASE_URL = "http://localhost:8002"
ADMIN_EMAIL = "yoandyross@gmail.com"
ADMIN_PASSWORD = "admin123"
ADMIN_USER_ID = "6a208b7544faaaa88a194d05"  # per main agent note

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "taxportal")

# ───────────────────────── shared state ─────────────────────────
_state = {
    "admin_token": None,
    "created_campaign_ids": [],
    "orig_2fa_enabled": True,
}


# ───────────────────────── fixtures ─────────────────────────
@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="session", autouse=True)
def disable_admin_2fa_then_restore(mongo):
    """Disable 2FA for admin so we can grab a token via step1 without OTP,
    and reset lockout on the admin user. Restore at teardown."""
    # Find current settings
    orig = mongo.admin_2fa_settings.find_one({"user_id": ADMIN_USER_ID}) or {}
    _state["orig_2fa_enabled"] = orig.get("enabled", True)

    mongo.admin_2fa_settings.update_one(
        {"user_id": ADMIN_USER_ID},
        {"$set": {"user_id": ADMIN_USER_ID, "enabled": False,
                  "channel": orig.get("channel", "email"),
                  "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    # Clear any lockout on admin so tests aren't blocked
    mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})

    yield

    # Teardown: cleanup any test campaigns still around
    if _state["created_campaign_ids"]:
        mongo.newsletter_campaigns.delete_many({"_id": {"$in": _state["created_campaign_ids"]}})
        mongo.newsletter_recipients.delete_many({"campaign_id": {"$in": _state["created_campaign_ids"]}})

    # Reset admin lockout after lockout test
    mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})

    # Re-enable 2FA to the original value (defaulting to True per prod policy)
    mongo.admin_2fa_settings.update_one(
        {"user_id": ADMIN_USER_ID},
        {"$set": {"enabled": bool(_state["orig_2fa_enabled"] if _state["orig_2fa_enabled"] is not None else True),
                  "updated_at": datetime.utcnow()}},
        upsert=True,
    )


@pytest.fixture(scope="session")
def admin_token(mongo):
    """Obtain admin bearer token via login-step1 with 2FA disabled."""
    if _state["admin_token"]:
        return _state["admin_token"]
    r = requests.post(f"{BASE_URL}/api/admin/auth/login-step1",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login-step1 failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("step") == "complete", f"expected step=complete when 2FA disabled, got {data}"
    assert data.get("token"), "no token returned"
    _state["admin_token"] = data["token"]
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ══════════════════════ SECURITY: admin 2FA bypass ═══════════════════════
class TestAdmin2FASecurity:
    def test_marketplace_login_admin_returns_403(self):
        r = requests.post(f"{BASE_URL}/api/public/marketplace-login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} body={r.text}"
        body = r.json()
        assert body.get("detail") == "admin_2fa_required", f"unexpected detail: {body}"

    def test_step1_wrong_password_returns_401(self, mongo):
        # Ensure not locked before test
        mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})
        r = requests.post(f"{BASE_URL}/api/admin/auth/login-step1",
                          json={"email": ADMIN_EMAIL, "password": "wrong-password-xyz"}, timeout=15)
        assert r.status_code == 401
        assert "Credenciales" in r.json().get("detail", "")
        # reset again
        mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})

    def test_step1_correct_password_with_2fa_disabled_returns_complete(self, admin_token):
        # admin_token fixture already exercises this
        assert admin_token and len(admin_token) > 20

    def test_step1_lockout_after_5_wrong_attempts(self, mongo):
        # Reset first
        mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})
        for i in range(5):
            r = requests.post(f"{BASE_URL}/api/admin/auth/login-step1",
                              json={"email": ADMIN_EMAIL, "password": f"bad-pw-{i}"}, timeout=15)
            assert r.status_code == 401
        # 6th attempt: still 401 with lockout in effect
        r = requests.post(f"{BASE_URL}/api/admin/auth/login-step1",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 401, "6th attempt should still be 401 due to lockout"
        # Verify locked_until was set
        user = mongo.app_users.find_one({"_id": ObjectId(ADMIN_USER_ID)})
        assert user and user.get("locked_until") is not None
        assert user.get("failed_login_attempts", 0) >= 5
        # CRITICAL: reset lockout so subsequent tests can use admin_token
        mongo.app_users.update_many({}, {"$set": {"failed_login_attempts": 0, "locked_until": None}})


# ══════════════════════ Newsletter Pro ═══════════════════════
class TestNewsletterPro:
    def test_no_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/newsletter/pro/campaigns", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"

    def test_create_draft_campaign(self, admin_headers):
        payload = {
            "mode": "draft",
            "subject": "TEST_iter31 Draft Subject",
            "message": "TEST_iter31 Draft message body in Spanish.",
            "subject_en": "TEST_iter31 Draft English",
            "message_en": "TEST_iter31 English body.",
            "audience": "newsletter",
        }
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/pro/campaigns",
                          headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        camp = data["campaign"]
        assert camp["status"] == "draft"
        assert camp["subject"] == payload["subject"]
        _state["draft_id"] = camp["_id"] if "_id" in camp else camp.get("id")
        _state["created_campaign_ids"].append(_state["draft_id"])

    def test_update_campaign_subject(self, admin_headers):
        cid = _state["draft_id"]
        r = requests.put(f"{BASE_URL}/api/admin/newsletter/pro/campaigns/{cid}",
                         headers=admin_headers,
                         json={"subject": "TEST_iter31 Draft Subject EDITED"}, timeout=15)
        assert r.status_code == 200, r.text
        # GET list to verify
        r2 = requests.get(f"{BASE_URL}/api/admin/newsletter/pro/campaigns",
                          headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        found = next((c for c in r2.json()["campaigns"] if (c.get("_id") or c.get("id")) == cid), None)
        assert found is not None, "campaign not found in list after update"
        assert "EDITED" in found["subject"]
        assert "tracking" in found
        for k in ("delivered", "opened", "clicked", "bounced"):
            assert k in found["tracking"]

    def test_create_scheduled_campaign(self, admin_headers):
        send_at = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
        payload = {
            "mode": "schedule",
            "subject": "TEST_iter31 Scheduled",
            "message": "Programada",
            "audience": "newsletter",
            "send_at": send_at,
        }
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/pro/campaigns",
                          headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        camp = r.json()["campaign"]
        assert camp["status"] == "scheduled"
        assert camp.get("send_at")
        _state["created_campaign_ids"].append(camp.get("_id") or camp.get("id"))

    def test_create_recurring_campaign(self, admin_headers):
        payload = {
            "mode": "recurring",
            "subject": "TEST_iter31 Recurring",
            "message": "Recurrente",
            "audience": "newsletter",
            "frequency": "monthly",
        }
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/pro/campaigns",
                          headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        camp = r.json()["campaign"]
        assert camp["status"] == "recurring"
        assert camp.get("next_run_at")
        _state["recurring_id"] = camp.get("_id") or camp.get("id")
        _state["created_campaign_ids"].append(_state["recurring_id"])

    def test_get_campaign_detail_has_opened_arrays(self, admin_headers):
        cid = _state["draft_id"]
        r = requests.get(f"{BASE_URL}/api/admin/newsletter/pro/campaigns/{cid}",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "campaign" in data
        assert "tracking" in data
        assert "opened" in data and isinstance(data["opened"], list)
        assert "not_opened" in data and isinstance(data["not_opened"], list)

    def test_duplicate_campaign(self, admin_headers):
        cid = _state["draft_id"]
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/pro/campaigns/{cid}/duplicate",
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        dup = r.json()["campaign"]
        assert dup["status"] == "draft"
        assert "(copia)" in dup["subject"]
        _state["created_campaign_ids"].append(dup.get("_id") or dup.get("id"))

    def test_delete_campaign(self, admin_headers):
        # Delete the recurring one and verify gone
        cid = _state["recurring_id"]
        r = requests.delete(f"{BASE_URL}/api/admin/newsletter/pro/campaigns/{cid}",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        # Verify gone
        r2 = requests.get(f"{BASE_URL}/api/admin/newsletter/pro/campaigns/{cid}",
                          headers=admin_headers, timeout=15)
        assert r2.status_code == 404
        _state["created_campaign_ids"].remove(cid)

    def test_ai_topics(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/ai/topics",
                          headers=admin_headers, json={"count": 5}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "topics" in data
        assert isinstance(data["topics"], list)
        assert len(data["topics"]) >= 1, "expected at least 1 topic"
        assert "title" in data["topics"][0]

    def test_ai_generate_bilingual(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/newsletter/ai/generate",
                          headers=admin_headers,
                          json={"topic": "Consejos de mantenimiento de invierno"}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("subject_es", "message_es", "subject_en", "message_en"):
            assert k in data and data[k], f"missing/empty {k}"


# ══════════════════════ Chat / Messages ═══════════════════════
class TestChat:
    def test_list_admin_conversations(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/chat/admin/conversations",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Try to find conversations list under common keys
        convs = data.get("conversations") if isinstance(data, dict) else data
        assert isinstance(convs, list), f"expected list, got {type(convs)} data={data}"
        if convs:
            first = convs[0]
            _state["conv_id"] = first.get("_id") or first.get("id") or first.get("conversation_id")
            assert _state["conv_id"], f"no id field in conversation: {first}"

    def test_get_messages_alias(self, admin_headers):
        cid = _state.get("conv_id")
        if not cid:
            pytest.skip("No conversation available to test messages")
        r = requests.get(f"{BASE_URL}/api/chat/conversations/{cid}/messages",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        msgs = data.get("messages") if isinstance(data, dict) else data
        assert isinstance(msgs, list), f"expected messages list, got {data}"
        # Verify chronological order if 2+ messages exist
        if len(msgs) >= 2:
            def _ts(m):
                return m.get("created_at") or m.get("timestamp") or ""
            timestamps = [_ts(m) for m in msgs]
            assert timestamps == sorted(timestamps), "messages not in chronological order"

    def test_mark_read(self, admin_headers):
        cid = _state.get("conv_id")
        if not cid:
            pytest.skip("No conversation")
        r = requests.post(f"{BASE_URL}/api/chat/conversations/{cid}/read",
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_ai_status_and_toggle(self, admin_headers):
        cid = _state.get("conv_id")
        if not cid:
            pytest.skip("No conversation")
        r = requests.get(f"{BASE_URL}/api/chat/ai/status/{cid}",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ai_enabled" in data
        assert "ai_enabled_global" in data
        original = data["ai_enabled"]

        # Toggle off
        r2 = requests.post(f"{BASE_URL}/api/chat/ai/toggle/{cid}",
                           headers=admin_headers, json={"enabled": False}, timeout=15)
        assert r2.status_code == 200, r2.text
        r3 = requests.get(f"{BASE_URL}/api/chat/ai/status/{cid}",
                          headers=admin_headers, timeout=15)
        assert r3.json()["ai_enabled"] is False

        # Restore to original
        requests.post(f"{BASE_URL}/api/chat/ai/toggle/{cid}",
                      headers=admin_headers, json={"enabled": bool(original)}, timeout=15)

    def test_admin_send(self, admin_headers):
        cid = _state.get("conv_id")
        if not cid:
            pytest.skip("No conversation")
        r = requests.post(f"{BASE_URL}/api/chat/admin/send",
                          headers=admin_headers,
                          json={"conversation_id": cid,
                                "content": "TEST_iter31 admin reply (please ignore)",
                                "message_type": "text"}, timeout=15)
        assert r.status_code == 200, r.text


# ══════════════════════ Consent forms PDF ═══════════════════════
class TestConsentPDFs:
    _applicant_payload = {"applicant_name": "TEST_iter31 Test", "property_address": "121 Oak"}
    _tenant_payload = {"tenant_name": "TEST_iter31 Test", "property_address": "121 Oak"}

    def _check(self, endpoint, admin_headers, payload):
        r = requests.post(f"{BASE_URL}/api/consents/{endpoint}",
                          headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"{endpoint} → {r.status_code} {r.text[:400]}"
        data = r.json()
        assert data.get("pdf_base64"), f"{endpoint}: empty pdf_base64"
        try:
            raw = base64.b64decode(data["pdf_base64"][:200])
            assert raw.startswith(b"%PDF"), f"{endpoint}: not a PDF header"
        except Exception as e:
            pytest.fail(f"{endpoint}: base64 decode error {e}")

    def test_background_check(self, admin_headers):
        self._check("background-check", admin_headers, self._applicant_payload)

    def test_income_verification(self, admin_headers):
        self._check("income-verification", admin_headers, self._applicant_payload)

    def test_photo_video(self, admin_headers):
        self._check("photo-video", admin_headers, self._tenant_payload)

    def test_ach_authorization(self, admin_headers):
        self._check("ach-authorization", admin_headers, self._tenant_payload)
