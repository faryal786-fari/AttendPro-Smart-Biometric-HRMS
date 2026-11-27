#!/usr/bin/env python3
"""Create a separate, clearly-labelled AttendPro demo database for dashboard testing.

This script never touches the live production database unless the caller explicitly
points --database at that file. The default is data/demo/attendance.sqlite3.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
TZ = ZoneInfo("Asia/Karachi")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a separate AttendPro demo database.")
    parser.add_argument("--database", default=str(ROOT / "data" / "demo" / "attendance.sqlite3"))
    parser.add_argument("--reset", action="store_true", help="Delete only the selected demo database before seeding.")
    args = parser.parse_args()
    db_path = Path(args.database).expanduser().resolve()
    if db_path == (ROOT / "data" / "attendance.sqlite3").resolve():
        parser.error("Refusing to seed the production/default database. Choose a separate demo database path.")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if args.reset and db_path.exists():
        db_path.unlink()

    os.environ["SUPABASE_ENABLED"] = "false"
    os.environ["ATTENDANCE_DATA_DIR"] = str(db_path.parent)
    sys.path.insert(0, str(ROOT))
    from backend import app as service  # noqa: E402

    service.DB_PATH = db_path
    service.init_db()

    today = datetime.now(TZ).date()
    yesterday = today - timedelta(days=1)
    today_end = datetime.combine(today, datetime.max.time().replace(microsecond=0), TZ)
    yesterday_start = datetime.combine(yesterday, datetime.min.time(), TZ)
    far_end = datetime(2099, 12, 31, 23, 59, tzinfo=TZ)

    staff = [
        (990001, "DEMO-ST-001", "DEMO-ST-001", "DEMO-ST-001", "Demo Staff Present", "Training Wing", "Morning", "Instructor"),
        (990002, "DEMO-ST-002", "DEMO-ST-002", "DEMO-ST-002", "Demo Staff OSD", "Administration", "Morning", "Inspector"),
        (990003, "DEMO-ST-003", "DEMO-ST-003", "DEMO-ST-003", "Demo Staff OSD Permanent", "Commandant Office", "General", "Assistant"),
        (990004, "DEMO-ST-004", "DEMO-ST-004", "DEMO-ST-004", "Demo Staff Medical Leave", "Training Wing", "General", "Clerk"),
    ]
    trainees = [
        ("DEMO-TR-001", "Demo Trainee Present", "Lower Course Demo", "Platoon 1"),
        ("DEMO-TR-002", "Demo Trainee Absent", "Lower Course Demo", "Platoon 1"),
        ("DEMO-TR-003", "Demo Trainee Outdoor Leave", "Upper Course Demo", "Platoon 2"),
        ("DEMO-TR-004", "Demo Trainee Medical Rest", "Upper Course Demo", "Platoon 2"),
        ("DEMO-TR-005", "Demo Trainee OSD", "Special Course Demo", "Platoon 3"),
    ]

    with service.connection() as db:
        # Re-running the script refreshes only demo-seed rows; real rows are untouched.
        db.execute("DELETE FROM pts_osd_records WHERE created_by='demo_seed'")
        db.execute("DELETE FROM pts_leave_records WHERE created_by='demo_seed'")
        db.execute("DELETE FROM pts_leave_announcements WHERE created_by='demo_seed'")
        db.execute("DELETE FROM pts_holidays WHERE created_by='demo_seed'")
        for ident, device_id, source_id, badge, name, department, shift, designation in staff:
            db.execute(
                """INSERT INTO employees(id,device_user_id,source_userid,badge_number,name,department,active,designation,shift)
                   VALUES(?,?,?,?,?,?,1,?,?)
                   ON CONFLICT(id) DO UPDATE SET name=excluded.name,department=excluded.department,
                     designation=excluded.designation,shift=excluded.shift,active=1""",
                (ident, device_id, source_id, badge, name, department, designation, shift),
            )
            status = "present" if ident == 990001 else "absent"
            cin = "08:10" if ident == 990001 else None
            cout = "16:05" if ident == 990001 else None
            db.execute(
                """INSERT OR REPLACE INTO daily(employee_id,work_date,status,clock_in,clock_out,
                   late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
                   VALUES(?,?,?,?,?,?,?,?,?,'demo_seed','')""",
                (ident, today.isoformat(), status, cin, cout, 0, 0, 475 if cin else 0, "08:00" if shift == "Morning" else "09:00"),
            )
            db.execute(
                """INSERT OR REPLACE INTO daily(employee_id,work_date,status,clock_in,clock_out,
                   late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
                   VALUES(?,?,?,?,?,?,?,?,?,'demo_seed','')""",
                (ident, yesterday.isoformat(), "present" if ident == 990001 else "absent",
                 "08:15" if ident == 990001 else None, "16:00" if ident == 990001 else None,
                 0, 0, 465 if ident == 990001 else 0, "08:00" if shift == "Morning" else "09:00"),
            )

        trainee_ids = {}
        for i, (employee_no, name, course, platoon) in enumerate(trainees, start=1):
            existing = db.execute("SELECT id FROM pts_trainees WHERE employee_no=? AND course_name=?",
                                  (employee_no, course)).fetchone()
            if existing:
                trainee_id = int(existing["id"])
                db.execute("""UPDATE pts_trainees SET name=?,platoon=?,course_start_date=?,course_end_date=?,status='active'
                              WHERE id=?""",
                           (name, platoon, (today-timedelta(days=30)).isoformat(), (today+timedelta(days=90)).isoformat(), trainee_id))
            else:
                cur = db.execute("""INSERT INTO pts_trainees(employee_no,name,course_name,platoon,course_start_date,course_end_date,status)
                                    VALUES(?,?,?,?,?,?, 'active')""",
                                 (employee_no, name, course, platoon, (today-timedelta(days=30)).isoformat(), (today+timedelta(days=90)).isoformat()))
                trainee_id = int(cur.lastrowid)
            trainee_ids[employee_no] = trainee_id

        attendance_statuses = [
            ("DEMO-TR-001", "present", "07:35", "15:55"),
            ("DEMO-TR-002", "absent", None, None),
            ("DEMO-TR-003", "outdoor_leave", None, None),
            ("DEMO-TR-004", "medical_rest", None, None),
            ("DEMO-TR-005", "osd", None, None),
        ]
        for employee_no, status, cin, cout in attendance_statuses:
            db.execute(
                """INSERT OR REPLACE INTO pts_trainee_attendance(trainee_id,attendance_date,shift,status,check_in,check_out,course_name)
                   VALUES(?,?, 'Morning',?,?,?,?)""",
                (trainee_ids[employee_no], today.isoformat(), status, cin, cout,
                 next(c for e,n,c,p in trainees if e == employee_no)),
            )
            db.execute(
                """INSERT OR REPLACE INTO pts_trainee_attendance(trainee_id,attendance_date,shift,status,check_in,check_out,course_name)
                   VALUES(?,?, 'Morning',?,?,?,?)""",
                (trainee_ids[employee_no], yesterday.isoformat(), "present" if employee_no == "DEMO-TR-001" else "absent",
                 "07:40" if employee_no == "DEMO-TR-001" else None,
                 "15:50" if employee_no == "DEMO-TR-001" else None,
                 next(c for e,n,c,p in trainees if e == employee_no)),
            )

        # Approved temporary and permanent staff OSD; OSD staff are counted as Present.
        db.execute("""INSERT INTO pts_osd_records(person_type,person_id,person_name,staff_category,staff_branch,
                      start_at,end_at,reason,duty_place,reference_no,remarks,status,created_by,osd_type)
                      VALUES('staff','DEMO-ST-002','Demo Staff OSD','Inspector','Administration',?,?,?,?,?,'Demo temporary OSD','approved','demo_seed','temporary')""",
                   (yesterday_start.isoformat(), today_end.isoformat(), "Official duty", "Lahore", "DEMO/OSD/001"))
        db.execute("""INSERT INTO pts_osd_records(person_type,person_id,person_name,staff_category,staff_branch,
                      start_at,end_at,reason,duty_place,reference_no,remarks,status,created_by,osd_type)
                      VALUES('staff','DEMO-ST-003','Demo Staff OSD Permanent','Assistant','Commandant Office',?,?,?,?,?,'Permanent official duty','approved','demo_seed','permanent')""",
                   (yesterday_start.isoformat(), far_end.isoformat(), "Permanent official duty", "Commandant Office", "DEMO/OSD/P001"))
        db.execute("""INSERT INTO pts_leave_records(person_type,person_id,person_name,staff_category,staff_branch,
                      leave_type,start_at,end_at,reason,reference_no,remarks,status,created_by)
                      VALUES('staff','DEMO-ST-004','Demo Staff Medical Leave','Clerk','Training Wing',
                      'Medical Leave',?,?, 'Approved demo medical leave','DEMO/ML/001','Demo data only','approved','demo_seed')""",
                   (yesterday_start.isoformat(), far_end.isoformat()))
        # Trainee OSD, outdoor leave and medical-rest examples.
        db.execute("""INSERT INTO pts_osd_records(person_type,person_id,person_name,course_name,platoon,
                      start_at,end_at,reason,duty_place,reference_no,remarks,status,created_by,osd_type)
                      VALUES('trainee','DEMO-TR-005','Demo Trainee OSD','Special Course Demo','Platoon 3',
                      ?,?,'Training assignment','Manawan','DEMO/TR/OSD/001','Demo data only','approved','demo_seed','temporary')""",
                   (yesterday_start.isoformat(), far_end.isoformat()))
        for employee_no, name, leave_type, reason in [
            ("DEMO-TR-003", "Demo Trainee Outdoor Leave", "Outdoor Leave", "Approved outdoor leave"),
            ("DEMO-TR-004", "Demo Trainee Medical Rest", "Medical Rest", "Approved medical rest"),
        ]:
            db.execute("""INSERT INTO pts_leave_records(person_type,person_id,person_name,course_name,platoon,
                          leave_type,start_at,end_at,reason,reference_no,remarks,status,created_by)
                          VALUES('trainee',?,?,?, ?,?,?,?, ?,?,'Demo data only','approved','demo_seed')""",
                       (employee_no, name, "Upper Course Demo", "Platoon 2", leave_type,
                        yesterday_start.isoformat(), far_end.isoformat(), reason, "DEMO/TR/LEAVE/"+employee_no[-3:]))

        db.execute("""INSERT INTO pts_leave_announcements(title,message,start_date,end_date,audience,active,created_by)
                      VALUES(?,?,?,?, 'all',1,'demo_seed')""",
                   ("Demo Leave Announcement", "This is sample-only content for testing the announcement panel.",
                    today.isoformat(), (today+timedelta(days=7)).isoformat()))
        db.execute("""INSERT INTO pts_holidays(title,holiday_date,category,description,created_by)
                      VALUES(?,?,?,?, 'demo_seed')""",
                   ("Demo Institutional Holiday", (today+timedelta(days=14)).isoformat(),
                    "Institutional", "Sample-only holiday record."))

    print(f"Demo database created: {db_path}")
    print(f"Demo staff: {len(staff)} | Demo trainees: {len(trainees)}")
    print("Includes: staff present/absent, temporary OSD, permanent OSD, medical leave,")
    print("trainee present/absent/outdoor leave/medical rest/OSD, announcements and holiday.")
    print("IMPORTANT: This is a separate demo database; do not copy these demo rows into production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
