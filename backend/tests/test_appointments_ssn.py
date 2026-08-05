"""
Regression tests: appointments, office hours, SSN search & tax-prefill.
Run: python -m pytest /app/backend/tests/test_appointments_ssn.py -v
Uses the live preview backend (REACT/EXPO_PUBLIC_BACKEND_URL from frontend/.env).
"""
import os
import re
import pytest
import requests

def _backend_url():
    with open('/app/frontend/.env') as f:
        for line in f:
            m = re.match(r'EXPO_PUBLIC_BACKEND_URL=(.+)', line.strip())
            if m:
                return m.group(1).strip()
    raise RuntimeError('EXPO_PUBLIC_BACKEND_URL not found')

BASE = _backend_url() + '/api'
CLIENT_CREDS = {'email': 'yoandyross2025@icloud.com', 'password': 'Interface@123'}
ADMIN_CREDS = {'email': 'yoandyross@gmail.com', 'password': 'admin123'}


def _login(creds):
    r = requests.post(f'{BASE}/auth/login', json=creds, timeout=30)
    assert r.status_code == 200, f'login failed: {r.status_code} {r.text[:200]}'
    return r.json()['session_token']


@pytest.fixture(scope='module')
def client_token():
    return _login(CLIENT_CREDS)


@pytest.fixture(scope='module')
def admin_token():
    return _login(ADMIN_CREDS)


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


# ---------- Appointments ----------

def test_my_appointments(client_token):
    r = requests.get(f'{BASE}/appointments/my', headers=_auth(client_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for apt in data:
        assert 'scheduled_at' in apt and 'status' in apt


def test_office_hours_status():
    r = requests.get(f'{BASE}/office-hours/status', timeout=30)
    assert r.status_code == 200
    assert 'is_open' in r.json()


def test_office_hours_config():
    r = requests.get(f'{BASE}/local/office-hours', timeout=30)
    assert r.status_code == 200
    data = r.json()
    schedule = data.get('regular_schedule', {})
    assert 'monday' in schedule and 'sunday' in schedule
    for day_cfg in schedule.values():
        assert 'is_open' in day_cfg


def test_available_slots_respect_closed_day():
    """Sunday is closed in the weekly schedule -> no available slots."""
    r = requests.get(f'{BASE}/public/available-slots?date=2026-06-14', timeout=30)
    assert r.status_code == 200
    body = r.json()
    slots = body if isinstance(body, list) else body.get('slots', [])
    assert sum(1 for s in slots if s.get('available')) == 0


def test_available_slots_open_day_within_hours():
    """Monday is open 10:00-14:00 -> slots exist and stay inside office hours."""
    r = requests.get(f'{BASE}/public/available-slots?date=2026-06-15', timeout=30)
    assert r.status_code == 200
    body = r.json()
    all_slots = body if isinstance(body, list) else body.get('slots', [])
    slots = [s for s in all_slots if s.get('available')]
    assert len(slots) > 0
    for s in slots:
        hour = int(s['time'].split(':')[0])
        assert 10 <= hour < 14, f"slot {s['time']} outside office hours"


# ---------- SSN: admin search ----------

def test_banking_data_ssn_search(admin_token):
    r = requests.get(
        f'{BASE}/admin/banking-data?search=1234&has_ssn=yes&page=1&limit=5',
        headers=_auth(admin_token), timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    assert 'total' in data
    records = data.get('records', data.get('data', []))
    for rec in records:
        assert rec.get('has_ssn') is True


def test_banking_data_has_ssn_no_filter(admin_token):
    r = requests.get(
        f'{BASE}/admin/banking-data?has_ssn=no&page=1&limit=5',
        headers=_auth(admin_token), timeout=30,
    )
    assert r.status_code == 200
    records = r.json().get('records', r.json().get('data', []))
    for rec in records:
        assert not rec.get('has_ssn')


# ---------- SSN: tax wizard prefill ----------

def test_tax_prefill_returns_ssn_for_returning_client(client_token):
    r = requests.get(f'{BASE}/profile/tax-prefill', headers=_auth(client_token), timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert 'ssn' in data and 'ssn_source' in data
    if data['ssn']:
        assert len(data['ssn']) == 9
        assert data['ssn_last_four'] == data['ssn'][-4:]
        assert data['ssn_source'] in (
            'previous_wizard', 'banking_records', 'season_records', 'banking_name_match'
        )


def test_tax_prefill_requires_auth():
    r = requests.get(f'{BASE}/profile/tax-prefill', timeout=30)
    assert r.status_code in (401, 403)
