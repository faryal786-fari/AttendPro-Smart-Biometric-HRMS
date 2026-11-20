import importlib
import os
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))
from sample_data import seed_sample_database


def test_shared_app_config_persists_across_app_reload(monkeypatch):
    temp = tempfile.TemporaryDirectory()
    try:
        monkeypatch.setenv("ATTENDANCE_DATA_DIR", temp.name)
        import app
        mod = importlib.reload(app)
        seed_sample_database(mod)
        with TestClient(mod.app) as client:
            assert client.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            original = client.get("/api/config").json()
            original["organization"]["name"] = "AttendPro Test Company"
            original["shifts"].append({
                "name": "Night Shift", "start": "22:00", "end": "06:00",
                "late_after": "22:15", "grace": 15
            })
            original["departments"].append({"name": "Quality", "head": "Test Head"})
            original["attendance_rules"]["minimum_working_hours"] = 7.5
            original["notifications"]["device_sync_failure"] = True
            saved = client.put("/api/config", json=original)
            assert saved.status_code == 200, saved.text
            assert saved.json()["saved_to"] == "local_database"

        # Reloading the Python application simulates a service restart.
        mod = importlib.reload(mod)
        with TestClient(mod.app) as client:
            assert client.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            result = client.get("/api/config").json()
            assert result["organization"]["name"] == "AttendPro Test Company"
            assert any(s["name"] == "Night Shift" for s in result["shifts"])
            assert any(d["name"] == "Quality" for d in result["departments"])
            assert result["attendance_rules"]["minimum_working_hours"] == 7.5
            assert result["notifications"]["device_sync_failure"] is True
    finally:
        temp.cleanup()
        monkeypatch.delenv("ATTENDANCE_DATA_DIR", raising=False)


def test_shared_app_config_rejects_invalid_shift(monkeypatch):
    temp = tempfile.TemporaryDirectory()
    try:
        monkeypatch.setenv("ATTENDANCE_DATA_DIR", temp.name)
        import app
        mod = importlib.reload(app)
        seed_sample_database(mod)
        with TestClient(mod.app) as client:
            assert client.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            config = client.get("/api/config").json()
            config["shifts"][0]["start"] = "not-a-time"
            response = client.put("/api/config", json=config)
            assert response.status_code == 400
    finally:
        temp.cleanup()
        monkeypatch.delenv("ATTENDANCE_DATA_DIR", raising=False)


def test_dashboard_leave_percentage_and_department_totals(monkeypatch):
    temp = tempfile.TemporaryDirectory()
    try:
        monkeypatch.setenv("ATTENDANCE_DATA_DIR", temp.name)
        import app
        mod = importlib.reload(app)
        seed_sample_database(mod)
        with mod.connection() as db:
            db.execute(
                "UPDATE daily SET status='on_leave' WHERE employee_id=1 AND work_date='2026-10-26'"
            )
        with TestClient(mod.app) as client:
            assert client.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            data = client.get("/api/dashboard?date=2026-10-26").json()
            metrics = data["metrics"]
            assert metrics["total"] == 731
            assert metrics["on_leave"] == 1
            assert metrics["present"] == 373
            assert metrics["missing_check_in"] == 7
            assert metrics["missing_check_out"] == 76
            assert metrics["attendance_percentage"] == round(373 / 730 * 100, 1)
            assert sum(d["total"] for d in data["departments"]) == 731
            assert sum(d["present"] for d in data["departments"]) == 373
            assert sum(d["absent"] for d in data["departments"]) == 357
            assert sum(d["on_leave"] for d in data["departments"]) == 1
    finally:
        temp.cleanup()
        monkeypatch.delenv("ATTENDANCE_DATA_DIR", raising=False)


def test_scheduler_next_run_is_calculated_from_last_completion(monkeypatch):
    temp = tempfile.TemporaryDirectory()
    try:
        monkeypatch.setenv("ATTENDANCE_DATA_DIR", temp.name)
        monkeypatch.setenv("ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS", "3600")
        import app
        mod = importlib.reload(app)
        seed_sample_database(mod)
        mod.save_scheduler_state(last_finished="2026-11-19T11:06:42")
        with TestClient(mod.app) as client:
            assert client.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            status = client.get("/api/scheduler/status").json()
            assert status["next_run"] == "2026-11-19T12:06:42"
    finally:
        temp.cleanup()
        monkeypatch.delenv("ATTENDANCE_DATA_DIR", raising=False)
        monkeypatch.delenv("ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS", raising=False)


def test_only_super_admin_can_change_shared_settings(monkeypatch):
    temp = tempfile.TemporaryDirectory()
    try:
        monkeypatch.setenv("ATTENDANCE_DATA_DIR", temp.name)
        import app
        mod = importlib.reload(app)
        seed_sample_database(mod)
        with TestClient(mod.app) as admin:
            assert admin.post("/api/auth/login", json={
                "username": "admin", "password": "admin123"
            }).status_code == 200
            created = admin.post("/api/users", json={
                "display_name": "Supervisor", "username": "settings-supervisor",
                "role": "supervisor", "password": "supervisor123"
            })
            assert created.status_code == 200
        with TestClient(mod.app) as supervisor:
            assert supervisor.post("/api/auth/login", json={
                "username": "settings-supervisor", "password": "supervisor123"
            }).status_code == 200
            config = supervisor.get("/api/config").json()
            config["organization"]["name"] = "Unauthorized Change"
            response = supervisor.put("/api/config", json=config)
            assert response.status_code == 403
    finally:
        temp.cleanup()
        monkeypatch.delenv("ATTENDANCE_DATA_DIR", raising=False)
