#!/usr/bin/env python3
"""Read-only MDB trainee roster PREVIEW and approved private export.

Default command prints only aggregate department counts. A trainee roster CSV is
created ONLY if an operator independently verifies a trainee department, provides
its ID, course and a confirmation flag. This does not modify the MDB or Supabase.
"""
import argparse
import collections
import csv
import io
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def export_table(mdb: Path, table: str):
    tool = shutil.which("mdb-export")
    if not tool:
        raise RuntimeError("mdb-export missing. On Ubuntu: sudo apt install mdbtools")
    done = subprocess.run([tool, str(mdb), table], stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, timeout=120)
    if done.returncode:
        raise RuntimeError(f"MDB table {table} read failed (exit {done.returncode}).")
    content = done.stdout.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(content)))


def field(row, *names):
    normalized = {re.sub(r"[^a-z0-9]", "", str(k).lower()): str(v or "").strip()
                  for k, v in row.items()}
    for name in names:
        value = normalized.get(re.sub(r"[^a-z0-9]", "", name.lower()), "")
        if value:
            return value
    return ""


def main():
    parser = argparse.ArgumentParser(description="AttendPro private MDB trainee classification preview")
    parser.add_argument("--mdb", required=True, type=Path)
    parser.add_argument("--approved-dept-id", help="Department ID manually verified as trainees by the college")
    parser.add_argument("--course-name", help="Verified course, not inferred from biometric department")
    parser.add_argument("--platoon", default="")
    parser.add_argument("--output", type=Path, help="Private CSV outside the Git repository")
    parser.add_argument("--confirm", choices=["ROSTER_VERIFIED"],
                        help="Requires human verification before exporting personal records")
    args = parser.parse_args()
    mdb = args.mdb.expanduser().resolve()
    if not mdb.is_file():
        parser.error("MDB file is missing at --mdb path")

    departments = export_table(mdb, "DEPARTMENTS")
    people = export_table(mdb, "USERINFO")
    dept_names = {field(r, "DEPTID", "DEPARTMENTID", "ID"):
                  field(r, "DEPTNAME", "DEPARTMENTNAME", "NAME") for r in departments}
    counts = collections.Counter(field(p, "DEFAULTDEPTID", "DEPTID", "DEPARTMENTID")
                                 for p in people)
    print(f"MDB user rows: {len(people)} | departments: {len(departments)}")
    print("DEPARTMENT ID | DEPARTMENT LABEL | USER ROWS")
    for key, value in sorted(counts.items(), key=lambda item: item[0]):
        print(f"{key or '(none)':>13} | {dept_names.get(key, '(unmapped)')[:55]:<55} | {value}")
    print("NOTE: MDB users are not automatically trainees; female and staff records can coexist.")
    print("NOTE: This script does not export punch data or write to Supabase.")

    if not any((args.approved_dept_id, args.course_name, args.output, args.confirm)):
        print("PREVIEW ONLY: No personal data file was generated.")
        return 0
    if not all((args.approved_dept_id, args.course_name, args.output,
                args.confirm == "ROSTER_VERIFIED")):
        parser.error("Private roster export needs --approved-dept-id, --course-name, --output and --confirm ROSTER_VERIFIED")
    if args.approved_dept_id not in dept_names:
        parser.error("Approved trainee department ID does not exist in the MDB")
    if not args.course_name.strip():
        parser.error("A nonempty verified --course-name is required")

    output = args.output.expanduser().resolve()
    repo = Path(__file__).resolve().parents[2]
    try:
        output.relative_to(repo)
    except ValueError:
        pass
    else:
        parser.error("OUTPUT MUST BE OUTSIDE the AttendPro Git repository (private data).")
    if output.exists():
        parser.error("Output exists; refusing overwrite: " + str(output))
    if os.name != "posix":
        parser.error("This protected export script is designed for the user's Ubuntu laptop")

    selected = []
    missing = 0
    seen = set()
    for row in people:
        dept_id = field(row, "DEFAULTDEPTID", "DEPTID", "DEPARTMENTID")
        if dept_id != args.approved_dept_id:
            continue
        badge = field(row, "Badgenumber", "Badge Number", "EmployeeNo", "Employee ID", "Cap No")
        name = field(row, "Name", "Full Name")
        if not badge or not name:
            missing += 1
            continue
        if badge in seen:
            raise RuntimeError("Duplicate badge numbers in approved department; no export created.")
        seen.add(badge)
        selected.append({"Employee ID/Cap No.": badge,
                         "Name": name,
                         "Father Name": "",
                         "Course": args.course_name.strip(),
                         "Platoon": args.platoon.strip(),
                         "Course Start Date": "",
                         "Course End Date": "",
                         "Status": "active"})
    if not selected:
        raise RuntimeError("No valid verified trainee rows found. No file created.")
    output.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(output, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=list(selected[0]))
        writer.writeheader()
        writer.writerows(selected)
    print(f"Private roster created: {output}")
    print(f"Trainee rows: {len(selected)}; skipped incomplete: {missing}")
    print("NEXT: review this private file and use AttendPro > All Trainees > Import as Supervisor/Admin.")
    print("No data was uploaded automatically; no staff source table was changed.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
