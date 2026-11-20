"""Synthetic, non-sensitive fixture used by offline AttendPro tests.

The real client SQLite/MDB data is intentionally excluded from GitHub. Tests must
not depend on private production attendance records being bundled in the repository.
"""
from __future__ import annotations

from pathlib import Path

TEST_DAY = "2026-10-26"
DEPARTMENTS = ("Engineering", "Finance", "HR", "Operations", "Sales", "IT Support")


def seed_sample_database(app_module):
    """Initialize schema and add a deterministic 731-employee synthetic dataset."""
    app_module.init_db()
    employees = []
    daily = []
    raw_daily = []
    punches = []
    for employee_id in range(1, 732):
        department = DEPARTMENTS[(employee_id - 1) % len(DEPARTMENTS)]
        name = f"Test Employee {employee_id:04d}"
        badge = f"TEST-{employee_id:04d}"
        device_id = f"TEST-USER-{employee_id:04d}"
        employees.append((
            employee_id, device_id, str(employee_id), badge, name, department,
            "Staff", "General", "", "", "unknown", 1
        ))
        if employee_id <= 323:
            status = "late"
            clock_in = "09:25"
        elif employee_id <= 374:
            status = "present"
            clock_in = "08:55"
        else:
            status = "absent"
            clock_in = None
        # 76 rows have an IN but no OUT; 7 rows have an OUT but no IN.
        if employee_id <= 76:
            clock_out = None
        elif 375 <= employee_id <= 381:
            clock_out = "17:00"
        else:
            clock_out = "17:00" if clock_in else None
        values = (
            employee_id, TEST_DAY, status, clock_in, clock_out,
            15 if status == "late" else 0, 0, None, "09:00", "excel_detailed", None
        )
        daily.append(values)
        raw_daily.append(values)
        if clock_in:
            punches.append((
                employee_id, device_id, f"{TEST_DAY} {clock_in}:00",
                "IN", "sample-fixture", "I"
            ))
        if clock_out:
            punches.append((
                employee_id, device_id, f"{TEST_DAY} {clock_out}:00",
                "OUT", "sample-fixture", "O"
            ))

    with app_module.connection() as db:
        db.executemany(
            """INSERT INTO employees(
                id,device_user_id,source_userid,badge_number,name,department,
                designation,shift,phone,email,biometric_enrollment,active
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            employees,
        )
        db.executemany(
            """INSERT INTO daily(
                employee_id,work_date,status,clock_in,clock_out,late_minutes,
                early_minutes,work_minutes,shift,source,raw_absent
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            daily,
        )
        db.executemany(
            """INSERT INTO raw_daily(
                employee_id,work_date,status,clock_in,clock_out,late_minutes,
                early_minutes,work_minutes,shift,source,raw_absent
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            raw_daily,
        )
        db.executemany(
            """INSERT INTO punches(
                employee_id,device_user_id,happened_at,kind,source,raw_status
            ) VALUES(?,?,?,?,?,?)""",
            punches,
        )
        db.execute(
            """INSERT INTO imports(filename,source,employee_rows,attendance_rows,skipped_rows,details)
               VALUES(?,?,?,?,?,?)""",
            ("synthetic-test-fixture.xlsx", "test_fixture", 731, 731, 0,
             "Synthetic data only; not a copy of client attendance records."),
        )
    return app_module
