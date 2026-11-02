"""Static regression checks for the user's specifically requested UI changes."""
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'static'/'index.html').read_text()
JS=(ROOT/'frontend.js').read_text()

def test_employee_directory_matches_original_table_and_view_modal():
    doc=BeautifulSoup(HTML,'html.parser')
    screen=doc.find(id='screen-employees')
    assert screen is not None
    assert screen.find(id='empTbody') is not None
    headers=[x.get_text(' ',strip=True) for x in screen.select('table thead th')]
    assert len(headers)==8
    assert 'Employee ID' in headers[1] and headers[2].startswith('Name')
    assert any(x.startswith('Department') for x in headers) and 'Actions' in headers
    assert doc.find(id='empModal') is not None

def test_chart_is_larger():
    doc=BeautifulSoup(HTML,'html.parser')
    svg=doc.select_one('#screen-dashboard .donut-wrap svg')
    assert int(svg['width'])>=220 and int(svg['height'])>=220
    assert svg['viewbox']=='0 0 110 110'

def test_employee_view_modal_and_flat_attendance_records():
    assert 'function openEmployeeFromList(dbId)' in JS
    assert 'employeeSortKey=\'name\'' in JS
    assert 'openEmpModal(e)' in JS
    # final override is flat, not the old expandable attendance prototype
    final=JS[JS.rindex('async function renderRecords() {'):JS.rindex('function openAttendanceEditorByKey')]
    assert 'toggleRecordDetails' not in final
    assert 'record-detail-row' not in final

def test_backend_hooks_are_retained():
    for endpoint in ['/api/employee/','/api/employees','/api/attendance/history','/api/devices/']:
        assert endpoint in JS


def test_alphabetical_name_search_and_profile_fields():
    assert "employeeSortKey='name'" in JS
    assert "displayEmployeeName(e.name)" in JS and "sortValue(a).localeCompare(sortValue(b)" in JS
    assert 'function onEmployeeSearch()' in JS
    assert 'function clearEmployeeFilters()' in JS
    assert 'emp-profile-fields' in JS
    assert 'openEmployeeFromList' in JS[JS.rindex('function renderEmployees()'):]

def test_half_screen_sidebar_limit_and_same_backend():
    assert 'window.innerWidth*0.5' in JS
    assert 'function toggleSidebar()' in JS
    assert 'function initSidebarResizer()' in JS
    assert '/api/database/sync' in JS


def test_name_display_uses_non_destructive_rank_cleanup():
    assert 'function displayEmployeeName(sourceName)' in JS
    assert 'original database name:' not in JS
    assert 'displayEmployeeName(e.name)' in JS
    assert 'displayEmployeeName(e.name)' in JS


def test_attendance_records_has_no_absent_column_but_keeps_absent_status():
    doc=BeautifulSoup(HTML,'html.parser')
    record=doc.find(id='screen-records')
    headings=[x.get_text(' ',strip=True) for x in record.select('table thead th')]
    assert headings==['AC-No.','Name','Date','Timetable','Clock In','Clock Out','Department','Status','Action']
    final=JS[JS.rindex('async function renderRecords() {'):JS.rindex('function openAttendanceEditorByKey')]
    assert "<td>${escapeHtml(r.absent||'')}</td>" not in final
    assert "<td>${escapeHtml(r.dept)}</td>" in final
    assert 'colspan="9"' in final
    assert '<option value="Absent">Absent</option>' in str(record)

def test_names_only_not_source_service_numbers_in_profile_title():
    final=JS[JS.rindex('function displayEmployeeName(sourceName) {'):JS.rindex('function clearEmployeeFilters() {')]
    assert 'return name || source' in final
    title=JS[JS.rindex('function employeeProfileHTML(e,data)'):JS.rindex('function openEmployeeModalById(id)')]
    assert 'displayEmployeeName(e.name)' in title
    assert 'original database name:' not in title
    assert 'Full Name' in title
    assert 'AC-No.' in title  # identifiers remain available in expanded DETAILS only

def test_discrepancy_sidebar_and_review_page():
    doc=BeautifulSoup(HTML,'html.parser')
    assert doc.find(id='screen-discrepancies') is not None
    assert doc.find(id='discTbody') is not None
    assert doc.find(id='discrepancyModal') is not None
    assert any('Discrepancies' in x.get_text(' ',strip=True) for x in doc.select('.sb-nav .nav-item'))
    assert '/api/discrepancies/resolve' in JS
    assert '/api/discrepancies/biometric-status' in JS


def test_redis_monitor_defines_cloud_enabled_before_rendering_details():
    start=HTML.index('function renderRedisMonitor(cache,scheduler,cloud,logs,apiErrors={}){')
    end=HTML.index('\nasync function refreshRedisCache()', start)
    monitor=HTML[start:end]
    assert 'const cloudIsEnabled=monitorBool(cloud.enabled);' in monitor
    assert 'cloudEnabled?' not in monitor
    assert 'Promise.allSettled' in HTML
    assert 'window.ATTENDPRO_BUILD = "2026-11-02-redis-monitor-hotfix-2"' in HTML
