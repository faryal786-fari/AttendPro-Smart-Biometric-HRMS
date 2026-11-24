"""Regression checks for the PTC Manawan visual refresh."""
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "static" / "index.html").read_text(encoding="utf-8")


def test_user_supplied_ptc_logo_and_location_building_assets_are_present():
    assets = ROOT / "static" / "assets"
    for name in (
        "ptc-college-crest.png",
        "ptc-college-crest.webp",
        "ptc-lahore-logo.png",
        "ptc-lahore-logo.webp",
        "ptc-manawan-flags-campus.webp",
        "ptc-manawan-location-building.jpg",
        "ptc-manawan-location-building.webp",
    ):
        assert (assets / name).is_file(), name
    assert HTML.count("/assets/ptc-college-crest.webp") >= 5


def test_location_section_contains_the_supplied_building_reference_photo():
    doc = BeautifulSoup(HTML, "html.parser")
    location = doc.select_one("#campuses .aplp-location-building")
    assert location is not None
    image = location.select_one("img")
    assert image is not None
    assert image.get("src") == "/assets/ptc-manawan-location-building.jpg"
    assert "Reference View" in location.get_text(" ", strip=True)


def test_sidebar_groups_keep_every_existing_screen_route():
    doc = BeautifulSoup(HTML, "html.parser")
    nav = doc.select_one(".sb-nav")
    assert nav is not None
    # Existing links are grouped at runtime; their route names remain in source.
    expected = {
        "dashboard", "live", "trainees", "pts-trainee-attendance",
        "pts-trainee-leave", "pts-trainee-osd", "employees",
        "pts-staff-leave", "pts-staff-osd", "pts-duty-rest",
        "records", "discrepancies", "leave", "reports", "device",
        "redis", "settings", "users",
    }
    found = set()
    for item in nav.select(".nav-item[data-screen]"):
        found.add(item.get("data-screen"))
    assert expected.issubset(found)
    assert "Leave &amp; Permissions" in HTML
    assert "Attendance &amp; Records" in HTML
    assert "function initPtcSidebarNavigation()" in HTML
    assert len(nav.select(".nav-item")) == 18
    assert sum("Leave & Holidays" in item.get_text(" ", strip=True) for item in nav.select(".nav-item")) == 1
    assert "attendpro-open-nav-groups" in HTML
    assert "aria-expanded" in HTML


def test_login_overlay_hides_the_dashboard_even_if_only_overlay_class_is_set():
    assert "body:has(#loginOverlay.open) .app" in HTML
    assert "body.portal-login-open .app" in HTML
    assert "function initPtcLoginIsolation()" in HTML
    assert "z-index:99999!important" in HTML


def test_mobile_sidebar_uses_a_drawer_and_existing_hamburger():
    assert "window.toggleSidebar=function()" in HTML
    assert "body.sidebar-open .sidebar" in HTML
    assert "body.sidebar-open .main:before" in HTML


def test_vercel_api_rewrite_is_preserved():
    import json
    config = json.loads((ROOT / "static" / "vercel.json").read_text())
    rewrites = config.get("rewrites", [])
    assert any(
        r.get("source") == "/api/:path*"
        and "attendpro-smart-biometric-hrms.onrender.com/api/:path*" in r.get("destination", "")
        for r in rewrites
    )
