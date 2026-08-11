"""End-to-end tests for the 1099-NEC / W-9 module (Ross House backend on :8002).

Covers:
- /api/admin/1099/summary
- /api/admin/1099/providers/{id}/pdf
- Threshold auto-alert + auto W-9 request via POST /api/admin/service-providers/{id}/payments
- /api/public/w9/{token} GET + POST (valid + invalid TIN + invalid token)
- /api/admin/1099/w9-reminders/run (reminder + escalation)
- /api/admin/1099/copyb-config GET/PUT
- /api/admin/1099/copyb/send-batch
- /api/admin/1099/deadline-reminder/send
- /api/admin/1099/providers/{id}/request-w9

Cleans up all qa1099-* documents at the end.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta
from pymongo import MongoClient

# Local backend (NOT the supervisor one)
BASE_URL = "http://localhost:8002"
ADMIN_TOKEN = "qa-1099-session-f51c3cad7e57a694"
HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
YEAR = 2026

MONGO_URL = os.environ.get("MONGO_URL", "")
if not MONGO_URL:
    raise SystemExit("MONGO_URL env var requerida (nunca hardcodear credenciales)")
DB_NAME = os.environ.get("DB_NAME", "taxportal")

# QA provider ids
PROV_WITH_W9 = f"qa1099-with-w9-{uuid.uuid4().hex[:6]}"
PROV_NO_W9 = f"qa1099-no-w9-{uuid.uuid4().hex[:6]}"
PROV_REMINDER = f"qa1099-reminder-{uuid.uuid4().hex[:6]}"
PROV_COPYB = f"qa1099-copyb-{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def seed_and_cleanup(db):
    """Seed QA providers + payments then clean up at the end."""
    now = datetime(YEAR, 6, 15)

    # 1) Provider WITH W-9 (for summary + PDF tests) → $700 reportable + $200 excluded
    db.service_providers.insert_one({
        "_id": PROV_WITH_W9,
        "name": "TEST QA1099 With W9",
        "email": "yoandyross+qa1099w9@gmail.com",
        "phone": "+18069342018",
        "status": "active",
        "language_pref": "es",
        "w9": {
            "legal_name": "TEST QA1099 With W9 LLC",
            "tin_type": "ein",
            "tin": "123456789",
            "address": "100 Test St",
            "city": "Dumas",
            "state": "TX",
            "zip": "79029",
        },
    })
    for amt, method in [(400.0, "check"), (300.0, "zelle"), (200.0, "venmo")]:
        db.provider_payments.insert_one({
            "_id": f"qa1099-pay-{uuid.uuid4().hex[:8]}",
            "provider_id": PROV_WITH_W9,
            "provider_name": "TEST QA1099 With W9",
            "amount": amt,
            "method": method,
            "status": "paid",
            "paid_at": now,
            "notes": "QA 1099",
        })

    # 2) Provider WITHOUT W-9 for threshold-cross test (no prior payments; created via API)
    db.service_providers.insert_one({
        "_id": PROV_NO_W9,
        "name": "TEST QA1099 No W9",
        "email": "yoandyross+qa1099now9@gmail.com",
        "phone": "+18069342018",
        "status": "active",
        "language_pref": "es",
    })

    # 3) Provider for reminder cycle — has a pending w9_request already sent once
    db.service_providers.insert_one({
        "_id": PROV_REMINDER,
        "name": "TEST QA1099 Reminder",
        "email": "yoandyross+qa1099rem@gmail.com",
        "phone": "+18069342018",
        "status": "active",
        "language_pref": "es",
        "w9_request": {
            "token": f"qa1099tok-{uuid.uuid4().hex[:12]}",
            "sent_at": datetime.utcnow() - timedelta(days=15),
            "sends": 1,
        },
    })

    # 4) Provider for Copy B batch (has W-9 + email + $650 reportable)
    db.service_providers.insert_one({
        "_id": PROV_COPYB,
        "name": "TEST QA1099 CopyB",
        "email": "yoandyross+qa1099copyb@gmail.com",
        "phone": "+18069342018",
        "status": "active",
        "language_pref": "es",
        "w9": {
            "legal_name": "TEST QA1099 CopyB LLC",
            "tin_type": "ein",
            "tin": "987654321",
            "address": "200 Test Blvd",
            "city": "Dumas",
            "state": "TX",
            "zip": "79029",
        },
    })
    db.provider_payments.insert_one({
        "_id": f"qa1099-pay-{uuid.uuid4().hex[:8]}",
        "provider_id": PROV_COPYB,
        "provider_name": "TEST QA1099 CopyB",
        "amount": 650.0,
        "method": "check",
        "status": "paid",
        "paid_at": now,
        "notes": "QA 1099",
    })

    yield

    # ── cleanup ──
    db.service_providers.delete_many({"_id": {"$regex": "^qa1099-"}})
    db.provider_payments.delete_many({"_id": {"$regex": "^qa1099-"}})
    # remove any residual QA-created payments referencing our providers
    db.provider_payments.delete_many({"provider_id": {"$in": [
        PROV_WITH_W9, PROV_NO_W9, PROV_REMINDER, PROV_COPYB]}})


# ─────────────────────────────────────────────────────────────────────
# 1. Summary endpoint
# ─────────────────────────────────────────────────────────────────────
def test_1_summary_reports_provider_totals():
    r = requests.get(f"{BASE_URL}/api/admin/1099/summary?year={YEAR}", headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    row = next((x for x in data["rows"] if x["provider_id"] == PROV_WITH_W9), None)
    assert row is not None, "QA provider not found in summary"
    assert row["reportable"] == 700.0
    assert row["excluded"] == 200.0
    assert row["needs_1099"] is True
    assert row["w9_complete"] is True


# ─────────────────────────────────────────────────────────────────────
# 2. PDF generation
# ─────────────────────────────────────────────────────────────────────
def test_2_pdf_generation_official_1099nec():
    r = requests.get(
        f"{BASE_URL}/api/admin/1099/providers/{PROV_WITH_W9}/pdf?year={YEAR}",
        headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    body = r.content
    assert body.startswith(b"%PDF"), "not a valid PDF"
    assert len(body) > 20_000, f"PDF too small: {len(body)} bytes"


# ─────────────────────────────────────────────────────────────────────
# 3. Threshold alert + auto W-9 request
# ─────────────────────────────────────────────────────────────────────
def test_3_threshold_alert_triggers_and_auto_requests_w9(db):
    # Record a $650 check payment through the actual endpoint
    payload = {
        "amount": 650.0,
        "method": "check",
        "status": "paid",
        "description": "QA 1099 threshold trigger",
        "notes": "QA 1099",
        "notify_provider": False,
    }
    r = requests.post(
        f"{BASE_URL}/api/admin/service-providers/{PROV_NO_W9}/payments",
        headers=HEADERS, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    # The check_1099_threshold task is async — allow it to complete
    time.sleep(5)
    p = db.service_providers.find_one({"_id": PROV_NO_W9})
    assert p is not None
    alerts = (p.get("tax_1099_alerts") or {}).get(str(YEAR))
    assert alerts is not None, f"tax_1099_alerts.{YEAR} not set on provider"
    assert alerts.get("w9_requested") is True, "expected auto W-9 request (no W-9 on file)"
    # w9_request.token should be populated by send_w9_request
    assert (p.get("w9_request") or {}).get("token"), "w9_request.token missing after auto request"


# ─────────────────────────────────────────────────────────────────────
# 4. Public W-9 form API (GET + POST + invalid TIN + invalid token)
# ─────────────────────────────────────────────────────────────────────
def test_4a_public_w9_get_invalid_token():
    r = requests.get(f"{BASE_URL}/api/public/w9/does-not-exist-token", timeout=10)
    assert r.status_code == 404


def test_4b_public_w9_get_valid_token(db):
    tok = (db.service_providers.find_one({"_id": PROV_REMINDER}) or {}) \
        .get("w9_request", {}).get("token")
    assert tok, "seed token missing"
    r = requests.get(f"{BASE_URL}/api/public/w9/{tok}", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["name"] == "TEST QA1099 Reminder"
    assert body["lang"] == "es"
    assert body["completed"] is False


def test_4c_public_w9_post_invalid_tin(db):
    tok = (db.service_providers.find_one({"_id": PROV_REMINDER}) or {}) \
        .get("w9_request", {}).get("token")
    payload = {
        "legal_name": "Some Name",
        "tin": "123",  # invalid
        "tin_type": "ssn",
        "address": "1 A St",
        "city": "Dumas",
        "state": "TX",
        "zip": "79029",
        "certified": True,
        "signature": "Some Name",
    }
    r = requests.post(f"{BASE_URL}/api/public/w9/{tok}", json=payload, timeout=15)
    assert r.status_code == 422, r.text


def test_4d_public_w9_post_valid(db):
    # Use the NO_W9 provider's auto-created token from test_3
    p = db.service_providers.find_one({"_id": PROV_NO_W9})
    tok = (p.get("w9_request") or {}).get("token")
    assert tok, "provider does not have auto W-9 token"
    payload = {
        "legal_name": "TEST QA1099 No W9 LLC",
        "business_name": "QA Biz",
        "tax_classification": "llc",
        "tin": "111223333",
        "tin_type": "ein",
        "address": "300 Test Way",
        "city": "Dumas",
        "state": "TX",
        "zip": "79029",
        "certified": True,
        "signature": "TEST QA1099 No W9 LLC",
    }
    r = requests.post(f"{BASE_URL}/api/public/w9/{tok}", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    # Verify persistence
    p2 = db.service_providers.find_one({"_id": PROV_NO_W9})
    assert p2["w9"]["legal_name"] == "TEST QA1099 No W9 LLC"
    assert p2["w9"]["tin"] == "111223333"
    assert (p2.get("w9_request") or {}).get("completed_at") is not None


# ─────────────────────────────────────────────────────────────────────
# 5. W-9 reminders cycle
# ─────────────────────────────────────────────────────────────────────
def test_5a_w9_reminder_sends_second_notice(db):
    # PROV_REMINDER has sends=1, sent_at=15 days ago → should be reminded (send #2)
    # Ensure sent_at is 15+ days old
    db.service_providers.update_one(
        {"_id": PROV_REMINDER},
        {"$set": {"w9_request.sent_at": datetime.utcnow() - timedelta(days=15),
                  "w9_request.sends": 1}})
    r = requests.post(f"{BASE_URL}/api/admin/1099/w9-reminders/run",
                      headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    reminded_names = [x.get("name") for x in data.get("reminded", [])]
    assert "TEST QA1099 Reminder" in reminded_names, f"not reminded: {data}"
    entry = next(x for x in data["reminded"] if x["name"] == "TEST QA1099 Reminder")
    assert entry["send_num"] == 2


def test_5b_w9_reminder_escalates_after_3_sends(db):
    # Backdate sent_at and set sends=3 → sweep should escalate (not send more)
    db.service_providers.update_one(
        {"_id": PROV_REMINDER},
        {"$set": {"w9_request.sent_at": datetime.utcnow() - timedelta(days=15),
                  "w9_request.sends": 3},
         "$unset": {"w9_request.escalated_at": ""}})
    r = requests.post(f"{BASE_URL}/api/admin/1099/w9-reminders/run",
                      headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "TEST QA1099 Reminder" in data.get("escalated", []), f"not escalated: {data}"
    # persistence check
    p = db.service_providers.find_one({"_id": PROV_REMINDER})
    assert (p.get("w9_request") or {}).get("escalated_at") is not None

    # Second run should NOT escalate again (already has escalated_at)
    r2 = requests.post(f"{BASE_URL}/api/admin/1099/w9-reminders/run",
                       headers=HEADERS, timeout=30)
    assert r2.status_code == 200
    assert "TEST QA1099 Reminder" not in r2.json().get("escalated", [])


# ─────────────────────────────────────────────────────────────────────
# 6. Copy B config GET/PUT
# ─────────────────────────────────────────────────────────────────────
def test_6_copyb_config_get_and_toggle():
    r = requests.get(f"{BASE_URL}/api/admin/1099/copyb-config", headers=HEADERS, timeout=10)
    assert r.status_code == 200
    original = r.json().get("auto_send_copyb")

    r2 = requests.put(f"{BASE_URL}/api/admin/1099/copyb-config",
                      headers=HEADERS, json={"auto_send_copyb": False}, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["auto_send_copyb"] is False

    # Restore
    r3 = requests.put(f"{BASE_URL}/api/admin/1099/copyb-config",
                      headers=HEADERS, json={"auto_send_copyb": bool(original) if original is not None else True},
                      timeout=10)
    assert r3.status_code == 200


# ─────────────────────────────────────────────────────────────────────
# 7. Copy B send-batch
# ─────────────────────────────────────────────────────────────────────
def test_7_copyb_send_batch(db):
    # Ensure PROV_COPYB has NOT already been sent for YEAR
    db.service_providers.update_one(
        {"_id": PROV_COPYB},
        {"$unset": {f"form_1099_sent.{YEAR}": ""}})
    r = requests.post(f"{BASE_URL}/api/admin/1099/copyb/send-batch?year={YEAR}",
                      headers=HEADERS, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    # Our QA CopyB provider name should appear in `detail.sent`
    sent_names = data.get("detail", {}).get("sent", [])
    assert "TEST QA1099 CopyB" in sent_names, f"CopyB provider not sent. Full response: {data}"

    # Verify provider marked as sent for that year
    p = db.service_providers.find_one({"_id": PROV_COPYB})
    assert (p.get("form_1099_sent") or {}).get(str(YEAR)) is not None

    # Re-run: should count as already_sent
    r2 = requests.post(f"{BASE_URL}/api/admin/1099/copyb/send-batch?year={YEAR}",
                       headers=HEADERS, timeout=90)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["already_sent"] >= 1
    assert "TEST QA1099 CopyB" not in data2.get("detail", {}).get("sent", [])


# ─────────────────────────────────────────────────────────────────────
# 8. Deadline reminder
# ─────────────────────────────────────────────────────────────────────
def test_8_deadline_reminder():
    r = requests.post(f"{BASE_URL}/api/admin/1099/deadline-reminder/send?year={YEAR}",
                      headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert data.get("providers", 0) >= 1


# ─────────────────────────────────────────────────────────────────────
# 9. Manual request-w9
# ─────────────────────────────────────────────────────────────────────
def test_9_manual_request_w9(db):
    # PROV_REMINDER has email + incomplete W-9 → manual request should succeed
    # (endpoint resets cooldown)
    r = requests.post(
        f"{BASE_URL}/api/admin/1099/providers/{PROV_REMINDER}/request-w9",
        headers=HEADERS, timeout=30)
    # Might get 502 if sends>=3; reset sends first
    if r.status_code == 502:
        db.service_providers.update_one(
            {"_id": PROV_REMINDER},
            {"$set": {"w9_request.sends": 0}, "$unset": {"w9_request.sent_at": ""}})
        r = requests.post(
            f"{BASE_URL}/api/admin/1099/providers/{PROV_REMINDER}/request-w9",
            headers=HEADERS, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True


# ─────────────────────────────────────────────────────────────────────
# 10. Auth check (bad token)
# ─────────────────────────────────────────────────────────────────────
def test_10_summary_requires_admin_auth():
    r = requests.get(f"{BASE_URL}/api/admin/1099/summary?year={YEAR}",
                     headers={"Authorization": "Bearer bad-token"}, timeout=10)
    assert r.status_code in (401, 403)
