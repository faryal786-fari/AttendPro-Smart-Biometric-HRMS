"""Regression tests for dashboard filters, OSD overlays, View Only limits and PTS workflows."""
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient


def _app(tmp_path, monkeypatch):
    monkeypatch.setenv("ATTENDANCE_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SUPABASE_ENABLED", "false")
    import importlib
    import app
    mod = importlib.reload(app)
    mod.CLOUD_ENABLED = False
    mod.init_db()
    return mod


def _login(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200, response.text


def _staff(mod, ident, badge, name, shift):
    with mod.connection() as db:
        db.execute(
            """INSERT INTO employees(id,device_user_id,source_userid,badge_number,name,department,
               active,designation,shift) VALUES(?,?,?,?,?,?,1,'Officer',?)""",
            (ident, badge, badge, badge, name, "Training", shift),
        )


def _record(mod, table, columns, values):
    with mod.connection() as db:
        db.execute(f"INSERT INTO {table}({columns}) VALUES({','.join('?' for _ in values)})", values)


def test_staff_dashboard_shift_filters_and_osd_overrides(tmp_path, monkeypatch):
    mod = _app(tmp_path, monkeypatch)
    day = mod.today_iso()
    future = (date.fromisoformat(day) + timedelta(days=10)).isoformat()
    _staff(mod, 91001, "TEST-M-01", "Morning Present", "Morning")
    _staff(mod, 91002, "TEST-M-02", "Morning OSD", "Morning")
    _staff(mod, 91003, "TEST-G-01", "General OSD Permanent", "General")
    _staff(mod, 91004, "TEST-G-02", "General Medical", "General")
    for ident, shift in [(91001, "08:00"), (91002, "08:00"), (91003, "09:00"), (91004, "09:00")]:
        state = "present" if ident == 91001 else "absent"
        _record(mod, "daily", "employee_id,work_date,status,shift,source", (ident, day, state, shift, "test"))
    for badge, name, shift, osd_type in [
        ("TEST-M-02", "Morning OSD", "Morning", "temporary"),
        ("TEST-G-01", "General OSD Permanent", "General", "permanent"),
    ]:
        _record(mod, "pts_osd_records",
                "person_type,person_id,person_name,staff_category,staff_branch,start_at,end_at,reason,duty_place,status,created_by,osd_type",
                ("staff", badge, name, "Officer", "Training", day+"T00:00:00+05:00",
                 future+"T23:59:00+05:00", "Official duty", "Lahore", "approved", "test", osd_type))
    _record(mod, "pts_leave_records",
            "person_type,person_id,person_name,staff_category,staff_branch,leave_type,start_at,end_at,reason,status,created_by",
            ("staff", "TEST-G-02", "General Medical", "Officer", "Training", "Medical Leave",
             day+"T00:00:00+05:00", future+"T23:59:00+05:00", "Medical leave", "approved", "test"))

    client = TestClient(mod.app)
    with client:
        _login(client)
        morning = client.get("/api/dashboard", params={"date": day, "shift": "Morning"})
        assert morning.status_code == 200, morning.text
        mm = morning.json()["metrics"]
        assert (mm["total"], mm["present"], mm["absent"], mm["osd"], mm["osd_permanent"]) == (2, 2, 0, 1, 0)

        general = client.get("/api/dashboard", params={"date": day, "shift": "General"})
        assert general.status_code == 200, general.text
        gm = general.json()["metrics"]
        assert (gm["total"], gm["present"], gm["absent"], gm["on_leave"]) == (2, 1, 0, 1)
        assert gm["osd_permanent"] == 1 and gm["medical_leave"] == 1


def test_osd_temporary_and_permanent_lists_are_separate(tmp_path, monkeypatch):
    mod = _app(tmp_path, monkeypatch)
    day = mod.today_iso()
    client = TestClient(mod.app)
    with client:
        _login(client)
        for kind, person_id, name in [
            ("osd", "ST-100", "Temporary Officer"),
            ("osd_permanent", "ST-101", "Permanent Officer"),
        ]:
            response = client.post("/api/pts/records", json={
                "record_type": kind, "person_type": "staff", "person_id": person_id, "person_name": name,
                "start_at": day+"T08:00:00+05:00",
                "end_at": day+"T18:00:00+05:00" if kind == "osd" else "",
                "reason": "Official duty", "status": "approved",
            })
            assert response.status_code == 200, response.text
        temporary = client.get("/api/pts/records", params={"record_type": "osd", "person_type": "staff"})
        permanent = client.get("/api/pts/records", params={"record_type": "osd_permanent", "person_type": "staff"})
        assert temporary.json()["total"] == 1
        assert permanent.json()["total"] == 1
        assert permanent.json()["items"][0]["osd_type"] == "permanent"


def test_view_only_is_previous_day_only_and_cannot_open_admin_apis(tmp_path, monkeypatch):
    mod = _app(tmp_path, monkeypatch)
    with mod.connection() as db:
        db.execute("INSERT INTO app_users(username,display_name,role,password_hash,active) VALUES(?,?,?,?,1)",
                   ("observer", "Observer", "view_only", mod.hash_password("securepass123")))
    admin = TestClient(mod.app)
    observer = TestClient(mod.app)
    with admin, observer:
        _login(admin)
        day = mod.yesterday_iso()
        today = mod.today_iso()
        published = admin.post("/api/pts/leave-announcements", json={
            "title": "View Only Announcement", "message": "This notice is visible to observers.",
            "start_date": day, "end_date": today, "audience": "all",
        })
        assert published.status_code == 200
        assert observer.post("/api/auth/login", json={"username": "observer", "password": "securepass123"}).status_code == 200
        view = observer.get("/api/view-only/dashboard")
        assert view.status_code == 200 and view.json()["date"] == day
        assert set(view.json()["metrics"]) == {"total_staff", "osd", "osd_permanent", "medical_leave"}
        assert view.json()["announcements"][0]["title"] == "View Only Announcement"
        assert observer.get("/api/pts/leave-announcements").status_code == 200
        assert observer.get("/api/dashboard", params={"date": today}).status_code == 403
        assert observer.get("/api/attendance", params={"date": today}).status_code == 403
        assert observer.get("/api/attendance", params={"date": day}).status_code == 200
        assert observer.get("/api/employees").status_code == 403
        assert observer.get("/api/pts/dashboard").status_code == 403
        assert observer.get("/api/discrepancies").status_code == 403
        assert observer.post("/api/pts/leave-announcements", json={"title":"No","start_date":day,"end_date":day}).status_code == 403


def test_leave_announcement_and_holiday_management(tmp_path, monkeypatch):
    mod = _app(tmp_path, monkeypatch)
    day = mod.today_iso()
    client = TestClient(mod.app)
    with client:
        _login(client)
        announcement = client.post("/api/pts/leave-announcements", json={
            "title": "Institutional Leave", "message": "Training is suspended.",
            "start_date": day, "end_date": day, "audience": "all",
        })
        assert announcement.status_code == 200, announcement.text
        assert client.get("/api/pts/leave-announcements").json()["total"] == 1
        holiday = client.post("/api/pts/holidays", json={
            "title": "Demo Holiday", "holiday_date": day, "category": "Institutional",
            "description": "Testing only",
        })
        assert holiday.status_code == 200, holiday.text
        assert client.get("/api/pts/holidays").json()["total"] == 1


def test_trainee_dashboard_distribution_live_rows_and_history_report(tmp_path, monkeypatch):
    mod = _app(tmp_path, monkeypatch)
    day = mod.today_iso()
    client = TestClient(mod.app)
    with client:
        _login(client)
        created = client.post("/api/pts/trainees", json={
            "employee_no": "DEMO-OUT-01", "name": "Outdoor Leave Trainee",
            "course_name": "Demo Course", "platoon": "1", "status": "active",
        })
        assert created.status_code == 200, created.text
        trainee_id = created.json()["item"]["id"]
        saved = client.post("/api/pts/attendance", json={
            "trainee_id": trainee_id, "attendance_date": day, "shift": "Morning",
            "status": "outdoor_leave",
        })
        assert saved.status_code == 200, saved.text
        dashboard = client.get("/api/pts/dashboard", params={"date": day, "shift": "Morning"})
        assert dashboard.status_code == 200, dashboard.text
        result = dashboard.json()
        assert result["status_distribution"]["leave"] == 1
        assert result["attendance_rows"][0]["status"] == "outdoor_leave"
        history = client.get("/api/pts/attendance/history", params={"from_date": day, "to_date": day})
        assert history.status_code == 200 and history.json()["total"] == 1


def test_frontend_has_requested_dashboard_and_directory_controls():
    root = Path(__file__).resolve().parents[1]
    html = (root / "frontend" / "index.html").read_text(encoding="utf-8")
    js = (root / "frontend" / "src" / "js" / "attendpro-app.js").read_text(encoding="utf-8")
    assert 'id="staffDashboardDate"' in html and 'id="staffDashboardShift"' in html
    assert 'id="ptsStatusDistribution"' in html and 'id="ptsRecentActivityTbody"' in html
    assert 'id="liveTraineeView"' in html and 'id="ptsLiveTbody"' in html
    assert 'id="ptsStaffOsdPermanentTbody"' in html and 'id="ptsTraineeReportPanel"' in html
    assert 'id="viewOnlyDashboard"' in html and 'id="viewOnlyAttendanceTbody"' in html
    assert '<select id="newEmpDept"' in html and '<select id="newEmpShift"' in html
    assert "openDashboardDiscrepancies('missing_check_in')" in html
    assert "loadPtsLiveAttendance" in js and "loadTraineeReport" in js
    assert "openDiscrepancyPunchEditor" in js and "pendingRealReload" in js
