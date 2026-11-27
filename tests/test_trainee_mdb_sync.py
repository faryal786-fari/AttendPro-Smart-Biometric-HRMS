import pytest
from backend.trainee_mdb_sync import classify_trainee_roster, TraineeMDBError


def sample_data():
    departments = [
        {"DEPTID": "1", "DEPTNAME": "PTCL TRAINIES", "SUPDEPTID": "0"},
        {"DEPTID": "24", "DEPTNAME": "CORPORAL 02 TRAINIES F", "SUPDEPTID": "1"},
        {"DEPTID": "25", "DEPTNAME": "CORPORAL PUNJAB", "SUPDEPTID": "24"},
        {"DEPTID": "26", "DEPTNAME": "CORPORAL GILGIT", "SUPDEPTID": "24"},
        {"DEPTID": "11", "DEPTNAME": "LRC 19 PLATOON 01", "SUPDEPTID": "10"},
    ]
    users = [
        {"BADGENUMBER": "F001", "NAME": "Trainee One", "GENDER": "Corporal", "DEFAULTDEPTID": "25"},
        {"BADGENUMBER": "F002", "NAME": "Trainee Two", "GENDER": "", "DEFAULTDEPTID": "26"},
        {"BADGENUMBER": "S001", "NAME": "Staff One", "GENDER": "", "DEFAULTDEPTID": "11"},
    ]
    return departments, users


def test_only_direct_children_of_verified_female_trainee_department_are_selected():
    departments, users = sample_data()
    result = classify_trainee_roster(departments, users)
    assert result["candidate_count"] == 2
    assert result["department_counts"] == {"CORPORAL PUNJAB": 1, "CORPORAL GILGIT": 1}
    assert {r["employee_no"] for r in result["roster"]} == {"F001", "F002"}
    assert all(r["course_name"] == "CORPORAL 02 TRAINIES F" for r in result["roster"])


def test_missing_parent_aborts_instead_of_importing_every_user():
    departments, users = sample_data()
    departments = [d for d in departments if d["DEPTID"] != "24"]
    with pytest.raises(TraineeMDBError):
        classify_trainee_roster(departments, users)


def test_duplicate_badge_aborts_before_sync():
    departments, users = sample_data()
    users.append(dict(users[0], DEFAULTDEPTID="26"))
    with pytest.raises(TraineeMDBError):
        classify_trainee_roster(departments, users)


def test_missing_name_or_badge_aborts_before_sync():
    departments, users = sample_data()
    users[0]["NAME"] = ""
    with pytest.raises(TraineeMDBError):
        classify_trainee_roster(departments, users)
