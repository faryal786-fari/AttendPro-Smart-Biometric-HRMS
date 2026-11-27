"""Read-only classification of PTC Manawan female trainees from the ZKTeco MDB.

Only users assigned to direct child departments of the verified
'CORPORAL 02 TRAINIES F' department are considered trainees. The source MDB is
never modified. No punch records are read or imported by this module.
"""
from __future__ import annotations

import csv
import io
import re
import shutil
import subprocess
from pathlib import Path
from typing import Callable

PARENT_DEPARTMENT_NAME = "CORPORAL 02 TRAINIES F"


class TraineeMDBError(RuntimeError):
    """The MDB could not be safely classified for trainee roster sync."""


def _norm_key(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


def _norm_name(value: object) -> str:
    return " ".join(str(value or "").strip().upper().split())


def _field(row: dict, *names: str) -> str:
    normalized = {_norm_key(k): str(v or "").strip() for k, v in row.items()}
    for name in names:
        value = normalized.get(_norm_key(name), "")
        if value:
            return value
    return ""


def _export_table(mdb_path: str | Path, table: str,
                  runner: Callable = subprocess.run) -> list[dict[str, str]]:
    tool = shutil.which("mdb-export")
    if not tool:
        raise TraineeMDBError("mdb-export is not installed; install mdbtools on the MDB host.")
    path = Path(mdb_path).expanduser()
    if not path.is_file():
        raise TraineeMDBError(f"Configured MDB file is not accessible: {path}")
    try:
        completed = runner([tool, str(path), table], capture_output=True,
                           text=True, encoding="utf-8-sig", errors="replace", timeout=120)
    except Exception as exc:
        raise TraineeMDBError(f"Could not read MDB table {table}: {exc}") from exc
    if completed.returncode:
        detail = (completed.stderr or "").strip()[:300]
        raise TraineeMDBError(f"MDB table {table} export failed: {detail}")
    return list(csv.DictReader(io.StringIO(completed.stdout or "")))


def classify_trainee_roster(departments: list[dict], users: list[dict]) -> dict:
    """Return validated roster and counts; never guesses from Gender field.

    The verified department hierarchy is the classification source: the exact
    female-trainee parent label and its direct child platoons. This matters
    because USERINFO.GENDER in the supplied MDB contains 'Corporal' and blanks.
    """
    parent_rows = [r for r in departments
                   if _norm_name(_field(r, "DEPTNAME", "DEPARTMENTNAME", "NAME"))
                   == PARENT_DEPARTMENT_NAME]
    if len(parent_rows) != 1:
        raise TraineeMDBError(
            f"Expected exactly one '{PARENT_DEPARTMENT_NAME}' parent department; found {len(parent_rows)}."
        )
    parent = parent_rows[0]
    parent_id = _field(parent, "DEPTID", "DEPARTMENTID", "ID")
    parent_name = _field(parent, "DEPTNAME", "DEPARTMENTNAME", "NAME")
    if not parent_id:
        raise TraineeMDBError("Female-trainee parent department has no department ID.")

    children = []
    for row in departments:
        if _field(row, "SUPDEPTID", "PARENTDEPTID", "PARENTID") == parent_id:
            child_id = _field(row, "DEPTID", "DEPARTMENTID", "ID")
            child_name = _field(row, "DEPTNAME", "DEPARTMENTNAME", "NAME")
            if child_id and child_name:
                children.append((child_id, child_name))
    if not children:
        raise TraineeMDBError("No child platoon departments were found under the verified female-trainee parent.")

    child_by_id = {dept_id: name for dept_id, name in children}
    roster = []
    seen_badges = set()
    counts: dict[str, int] = {name: 0 for _, name in children}
    for user in users:
        dept_id = _field(user, "DEFAULTDEPTID", "DEPTID", "DEPARTMENTID")
        if dept_id not in child_by_id:
            continue
        badge = _field(user, "BADGENUMBER", "BADGE NUMBER", "EMPLOYEENO", "EMPLOYEE ID", "CAP NO")
        name = _field(user, "NAME", "FULL NAME")
        if not badge or not name:
            raise TraineeMDBError(
                f"A record in {child_by_id[dept_id]} is missing its badge/employee number or name; no roster was synced."
            )
        badge_key = badge.casefold()
        if badge_key in seen_badges:
            raise TraineeMDBError(f"Duplicate employee number '{badge}' exists in the female-trainee departments; no roster was synced.")
        seen_badges.add(badge_key)
        counts[child_by_id[dept_id]] += 1
        roster.append({
            "employee_no": badge,
            "name": name,
            "father_name": "",
            "course_name": parent_name,
            "platoon": child_by_id[dept_id],
            "course_start_date": None,
            "course_end_date": None,
            "status": "active",
        })

    if not roster:
        raise TraineeMDBError("No users were found in the verified female-trainee platoon departments; existing roster was left unchanged.")
    return {
        "roster": roster,
        "parent_department": parent_name,
        "department_counts": counts,
        "candidate_count": len(roster),
    }


def extract_trainee_roster(mdb_path: str | Path) -> dict:
    """Read only DEPARTMENTS and USERINFO, then classify the female trainee roster."""
    departments = _export_table(mdb_path, "DEPARTMENTS")
    users = _export_table(mdb_path, "USERINFO")
    return classify_trainee_roster(departments, users)
