"""Regression coverage for Vercel/Render origin, employee edits and hosted UI."""
from pathlib import Path
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[1]


def test_no_native_browser_dialogs_in_current_frontend():
    html=(ROOT/'static/index.html').read_text()
    assert 'alert(' not in html
    assert 'confirm(' not in html
    assert 'prompt(' not in html
    assert 'id="apNotifPanel"' in html
    assert 'id="apToastStack"' in html
    assert 'id="deptSummaryScroll"' in html
    assert 'viewEmployeeRecords(${Number(e.dbId)})' in html
    assert 'openEmployeeEditor(${Number(e.dbId)})' in html
    assert 'id="loginError"' in html


def test_vercel_rewrite_and_supabase_profile_override_migration():
    import json
    conf=json.loads((ROOT/'static/vercel.json').read_text())
    assert conf['rewrites'][0]['destination']=='https://attendpro-smart-biometric-hrms.onrender.com/api/:path*'
    sql=(ROOT/'supabase/003_employee_profile_overrides.sql').read_text()
    assert 'attendpro_employee_profile_overrides' in sql
    assert 'alter table public.attendpro_employee_profile_overrides enable row level security;' in sql.lower()


def test_vercel_origin_is_allowlisted_without_disabling_other_csrf_checks():
    import app
    old=app.CLOUD_ENABLED
    app.CLOUD_ENABLED=True
    try:
        # No lifespan needed to test request middleware; avoid mutating any sample DB.
        client=TestClient(app.app)
        ok=client.post('/api/auth/login',json={'username':'notanemail','password':'x'},
                 headers={'Origin':'https://attendpro-smart-biometric-hrms-stat.vercel.app'})
        assert ok.status_code==400
        bad=client.post('/api/auth/login',json={'username':'notanemail','password':'x'},
                 headers={'Origin':'https://attacker.invalid'})
        assert bad.status_code==403
    finally:
        app.CLOUD_ENABLED=old
