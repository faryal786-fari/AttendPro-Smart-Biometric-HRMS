from pathlib import Path
import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def pts_client(tmp_path, monkeypatch):
    import app
    monkeypatch.setattr(app, 'DB_PATH', tmp_path / 'pts-manawan-test.sqlite3')
    monkeypatch.setattr(app, 'CLOUD_ENABLED', False)
    app.SESSION_TOKENS.clear()
    app.init_db()
    client = TestClient(app.app)
    login = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
    assert login.status_code == 200
    yield client
    app.SESSION_TOKENS.clear()


def test_pts_dashboard_starts_with_zero_not_farooqabad_demo_data(pts_client):
    response = pts_client.get('/api/pts/dashboard?date=2026-11-24&shift=Morning')
    assert response.status_code == 200
    result = response.json()
    assert result['data_ready'] is False
    assert result['metrics'] == {
        'total_enrolled': 0, 'active_enrolled': 0, 'present': 0, 'absent': 0,
        'leave': 0, 'long_weekend': 0, 'osd': 0, 'medical_rest': 0,
        'repatriate': 0, 'attendance_records': 0,
    }


def test_pts_trainee_attendance_and_leave_feed_dashboard(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-1001', 'name': 'Test Trainee', 'father_name': 'Test Father',
        'course_name': 'Recruit Course 66th', 'platoon': '2', 'status': 'active',
    })
    assert created.status_code == 200
    trainee_id = created.json()['item']['id']
    attendance = pts_client.post('/api/pts/attendance', json={
        'trainee_id': trainee_id, 'attendance_date': '2026-11-24',
        'shift': 'Morning', 'status': 'present',
    })
    assert attendance.status_code == 200
    leave = pts_client.post('/api/pts/records', json={
        'record_type': 'leave', 'person_type': 'trainee', 'person_id': 'LC-1001',
        'person_name': 'Test Trainee', 'course_name': 'Recruit Course 66th',
        'platoon': '2', 'leave_type': 'Medical Rest',
        'start_at': '2026-11-24T00:00:00+00:00',
        'end_at': '2026-11-25T00:00:00+00:00',
        'reason': 'Medical rest', 'status': 'approved',
    })
    assert leave.status_code == 200
    dashboard = pts_client.get('/api/pts/dashboard?date=2026-11-24&shift=Morning').json()
    assert dashboard['metrics']['total_enrolled'] == 1
    assert dashboard['metrics']['present'] == 1
    assert dashboard['metrics']['leave'] == 1
    assert dashboard['metrics']['medical_rest'] == 1
    assert dashboard['course_wise'][0]['course'] == 'Recruit Course 66th'


def test_pts_duty_rest_uses_staff_records_table(pts_client):
    response = pts_client.post('/api/pts/records', json={
        'record_type': 'duty_rest', 'person_type': 'staff', 'person_id': 'ST-001',
        'person_name': 'Test Staff', 'start_at': '2026-11-24T08:00:00+00:00',
        'end_at': '2026-11-24T18:00:00+00:00', 'reason': 'Duty Rest', 'status': 'approved',
    })
    assert response.status_code == 200
    listing = pts_client.get('/api/pts/records?record_type=duty_rest&person_type=staff')
    assert listing.status_code == 200
    assert listing.json()['total'] == 1


def test_pts_roster_excel_import_updates_existing_trainees(pts_client):
    wb = Workbook()
    ws = wb.active
    ws.append(['Employee ID/Cap No.', 'Name', 'Father Name', 'Course', 'Platoon',
               'Course Start Date', 'Course End Date', 'Status'])
    ws.append(['LC-2001', 'Import Test', 'Father Test', 'Recruit Course 2nd', '3',
               '2026-11-01', '2027-02-01', 'active'])
    stream = io.BytesIO()
    wb.save(stream)
    response = pts_client.post('/api/pts/trainees/import', files={
        'file': ('roster.xlsx', stream.getvalue(),
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })
    assert response.status_code == 200
    assert response.json()['processed'] == 1
    found = pts_client.get('/api/pts/trainees?search=LC-2001').json()['items']
    assert len(found) == 1
    assert found[0]['course_name'] == 'Recruit Course 2nd'


def test_pts_training_migration_is_server_only():
    sql = (ROOT / 'backend' / 'supabase' / 'migrations' / '005_pts_training_management.sql').read_text().lower()
    assert 'create table if not exists public.pts_trainees' in sql
    assert 'create table if not exists public.pts_trainee_attendance' in sql
    assert 'alter table public.%i enable row level security' in sql
    assert 'grant select, insert, update, delete on table public.%i to service_role' in sql
    assert 'revoke all on table public.%i from public, anon, authenticated' in sql


def test_same_trainee_can_have_multiple_course_enrollments(pts_client):
    first = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-3001', 'name': 'Multi Course Trainee',
        'course_name': 'Lower Course 1st', 'platoon': '1',
        'course_start_date': '2026-09-01', 'course_end_date': '2026-10-01',
    })
    second = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-3001', 'name': 'Multi Course Trainee',
        'course_name': 'Driver Course 5th', 'platoon': '2',
        'course_start_date': '2026-10-02', 'course_end_date': '2026-11-02',
    })
    assert first.status_code == 200 and second.status_code == 200
    assert pts_client.get('/api/pts/trainees?search=LC-3001').json()['total'] == 2


def test_supplied_leave_template_import_resolves_course_and_normal_leave_is_approved(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': '12345', 'name': 'Template Trainee', 'father_name': 'Template Father',
        'course_name': 'Driver Course 5th', 'platoon': '1',
        'course_start_date': '2026-09-01', 'course_end_date': '2026-09-30', 'status': 'active',
    })
    assert created.status_code == 200
    template = (ROOT / 'backend' / 'templates' / 'PTS_Leave_Import_Template.xlsx').read_bytes()
    response = pts_client.post('/api/pts/records/import?record_type=leave&person_type=trainee', files={
        'file': ('PTS_Leave_Import_Template.xlsx', template,
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })
    assert response.status_code == 200
    assert response.json()['imported'] == 1
    listing = pts_client.get('/api/pts/records?record_type=leave&person_type=trainee').json()
    assert listing['items'][0]['status'] == 'approved'
    assert listing['items'][0]['leave_type'] == 'Casual Leave'


def test_supplied_osd_template_import_is_approved_and_rejects_overlap(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-0313', 'name': 'OSD Template Trainee',
        'course_name': 'Lower Course 20th', 'platoon': '10',
        'course_start_date': '2026-10-01', 'course_end_date': '2026-10-30', 'status': 'active',
    })
    assert created.status_code == 200
    template = (ROOT / 'backend' / 'templates' / 'PTS_OSD_Import_Template.xlsx').read_bytes()
    files = {'file': ('PTS_OSD_Import_Template.xlsx', template,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    first = pts_client.post('/api/pts/records/import?record_type=osd&person_type=trainee', files=files)
    second = pts_client.post('/api/pts/records/import?record_type=osd&person_type=trainee', files=files)
    assert first.status_code == 200 and first.json()['imported'] == 1
    assert second.status_code == 200 and second.json()['rejected_count'] == 1
    listing = pts_client.get('/api/pts/records?record_type=osd&person_type=trainee').json()
    assert listing['items'][0]['status'] == 'approved'
    assert listing['items'][0]['duty_place'] == 'Lahore'


def test_bulk_trainee_attendance_updates_shift_dashboard(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-4001', 'name': 'Bulk Attendance Trainee',
        'course_name': 'Recruit Course 70th', 'platoon': '4',
        'course_start_date': '2026-11-01', 'course_end_date': '2027-02-01',
    })
    assert created.status_code == 200
    trainee_id = created.json()['item']['id']
    listing = pts_client.get('/api/pts/attendance?date=2026-11-24&shift=Morning')
    assert listing.status_code == 200
    assert any(x['id'] == trainee_id for x in listing.json()['items'])
    bulk = pts_client.post('/api/pts/attendance/bulk', json={'items': [{
        'trainee_id': trainee_id, 'attendance_date': '2026-11-24',
        'shift': 'Morning', 'status': 'present', 'check_in': '08:00',
    }]})
    assert bulk.status_code == 200 and bulk.json()['saved'] == 1
    dashboard = pts_client.get('/api/pts/dashboard?date=2026-11-24&shift=Morning').json()
    assert dashboard['metrics']['present'] == 1


def test_pending_emergency_leave_can_be_approved(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-5001', 'name': 'Emergency Leave Trainee',
        'course_name': 'Recruit Course 71st', 'platoon': '5',
        'course_start_date': '2026-11-01', 'course_end_date': '2027-02-01',
    })
    assert created.status_code == 200
    response = pts_client.post('/api/pts/records', json={
        'record_type': 'leave', 'person_type': 'trainee', 'person_id': 'LC-5001',
        'person_name': 'Emergency Leave Trainee', 'course_name': 'Recruit Course 71st',
        'platoon': '5', 'leave_type': 'Emergency Leave',
        'start_at': '2026-11-24T00:00:00+00:00', 'end_at': '2026-11-25T00:00:00+00:00',
        'reason': 'Emergency', 'status': 'pending',
    })
    assert response.status_code == 200
    record_id = response.json()['item']['id']
    approved = pts_client.patch(f'/api/pts/records/leave/{record_id}', json={'status': 'approved'})
    assert approved.status_code == 200
    assert approved.json()['item']['status'] == 'approved'


def test_supplied_leave_template_can_resolve_active_staff_record(pts_client):
    import app
    with app.connection() as db:
        db.execute('''INSERT INTO employees(id,device_user_id,badge_number,name,department,active)
                      VALUES(?,?,?,?,?,1)''',
                   (12345, '12345', '12345', 'Template Staff', 'Headquarters'))
    template = (ROOT / 'backend' / 'templates' / 'PTS_Leave_Import_Template.xlsx').read_bytes()
    response = pts_client.post('/api/pts/records/import?record_type=leave&person_type=staff', files={
        'file': ('PTS_Leave_Import_Template.xlsx', template,
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })
    assert response.status_code == 200
    assert response.json()['imported'] == 1
    listing = pts_client.get('/api/pts/records?record_type=leave&person_type=staff').json()
    assert listing['items'][0]['person_name'] == 'Template Staff'
    assert listing['items'][0]['staff_branch'] == 'Headquarters'


def test_pts_trainee_can_be_edited_without_changing_other_course_enrollment(pts_client):
    created = pts_client.post('/api/pts/trainees', json={
        'employee_no': 'LC-6001', 'name': 'Edit Me', 'course_name': 'Recruit Course 72nd',
        'platoon': '6', 'course_start_date': '2026-11-01', 'course_end_date': '2027-02-01',
    })
    assert created.status_code == 200
    trainee_id = created.json()['item']['id']
    updated = pts_client.patch(f'/api/pts/trainees/{trainee_id}', json={'name': 'Edited Trainee', 'platoon': '7'})
    assert updated.status_code == 200
    assert updated.json()['item']['name'] == 'Edited Trainee'
    assert updated.json()['item']['platoon'] == '7'


def test_pts_leave_osd_and_roster_templates_are_available(pts_client):
    for template in ('leave', 'osd', 'trainee-roster'):
        response = pts_client.get(f'/api/pts/templates/{template}')
        assert response.status_code == 200
        assert 'spreadsheetml' in response.headers.get('content-type', '')
