from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'static'/'index.html').read_text()

def test_quick_reports_have_distinct_actions_and_preview_handler():
    doc=BeautifulSoup(HTML,'html.parser')
    buttons=doc.select('#screen-reports .card button[onclick]')
    actions=[b.get('onclick','') for b in buttons]
    assert any("runQuickReport('today')" in x for x in actions)
    assert any("runQuickReport('week')" in x for x in actions)
    assert any("runQuickReport('late')" in x for x in actions)
    assert any("runQuickReport('missing_checkout')" in x for x in actions)
    assert any("runQuickReport('department')" in x for x in actions)
    assert 'async function runQuickReport(kind)' in HTML
    assert 'async function showReportPreview(options = {})' in HTML
    assert "currentDataDate || document.getElementById('recFrom').value" in HTML

def test_system_user_descriptions_are_english():
    doc=BeautifulSoup(HTML,'html.parser')
    screen=doc.find(id='screen-users')
    text=screen.get_text(' ',strip=True)
    assert 'and Super Admin' in text
    assert 'Can view the dashboard and attendance' in text
    assert 'Includes all View Only permissions' in text
    assert 'Full access: add, switch, configure, and sync devices' in text
    assert 'kar sakta' not in text and 'aur' not in text

def test_logout_browser_confirmation_is_english():
    assert "confirm('Are you sure you want to log out?')" in HTML
    assert "confirm('Logout karna hai?')" not in HTML

def test_automatic_biometric_rule_is_described_in_english():
    assert 'AttendPro automatically marks the effective attendance as On Leave' in HTML
    assert 'No automatic leave was created' not in HTML


def test_supabase_phase_3_migration_keeps_source_tables_immutable():
    sql=(ROOT/'supabase'/'002_hourly_cache_and_biometric_discrepancy.sql').read_text()
    assert 'attendpro_apply_biometric_exception' in sql
    assert "actor_label='AttendPro Scheduler'" in sql
    assert 'attendpro_source_daily' in sql and 'attendpro_raw_punches' in sql
    assert 'UPDATE public.attendpro_source_daily' not in sql
    assert 'UPDATE public.attendpro_raw_punches' not in sql
    assert 'GRANT EXECUTE ON FUNCTION public.attendpro_apply_biometric_exception' in sql
