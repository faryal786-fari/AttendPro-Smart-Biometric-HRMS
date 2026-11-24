"""Regression tests for the PTC Manawan secure login refresh."""
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "static" / "index.html").read_text()


def test_ptc_crest_and_flags_assets_are_present_and_referenced():
    assert (ROOT / "static" / "assets" / "ptc-college-crest.webp").is_file()
    assert (ROOT / "static" / "assets" / "ptc-college-crest.png").is_file()
    assert (ROOT / "static" / "assets" / "ptc-manawan-flags-campus.webp").is_file()
    assert HTML.count('/assets/ptc-college-crest.webp') >= 5
    assert '/assets/ptc-manawan-flags-campus.webp' in HTML


def test_login_is_a_full_screen_manawan_branded_page_not_a_translucent_modal():
    doc = BeautifulSoup(HTML, "html.parser")
    overlay = doc.find(id="loginOverlay")
    assert overlay is not None
    assert overlay.select_one(".ptc-login-shell .ptc-login-brand")
    form = overlay.select_one("form.login-card")
    assert form is not None
    assert form.find(id="loginUsername") is not None
    assert form.find(id="loginPassword") is not None
    assert form.find(id="loginError") is not None
    assert "ptclahore.co" in form.get_text(" ", strip=True)
    assert form.find("a", href="https://ptclahore.co/") is not None
    assert "ptc-manawan-flags-campus.webp" in str(overlay)
    assert "portal-login-open" in HTML
    assert "body.portal-login-open .app" in HTML
    assert "background:radial-gradient" in HTML


def test_login_state_hides_dashboard_until_success_and_restores_after_login():
    assert "document.body.classList.add('portal-login-open')" in HTML
    assert "document.body.classList.remove('portal-login-open')" in HTML
    assert "document.body.classList.toggle('portal-login-open',!authenticated)" in HTML
    assert "currentUser=result.user;" in HTML


def test_plain_text_api_errors_are_displayed_instead_of_only_status_code():
    assert "const raw = await response.text().catch(() => '');" in HTML
    assert "detail = raw.trim().slice(0, 280) || detail;" in HTML


def test_manawan_landing_gallery_uses_both_user_supplied_campus_photos():
    doc = BeautifulSoup(HTML, "html.parser")
    gallery = doc.select_one(".aplp-gallery-manawan-grid")
    assert gallery is not None
    images = [img.get("src", "") for img in gallery.select("img")]
    assert any("ptc-manawan-flags-campus.webp" in src for src in images)
    assert any("ptc-manawan-entrance.jpg" in src for src in images)
    assert len(gallery.select(".aplp-gallery-item")) == 2


def test_public_landing_stays_visible_without_a_portal_hash():
    assert "else if(typeof aplpPortalScreenFromHash==='function' && aplpPortalScreenFromHash())" in HTML
    assert "document.body.classList.remove('portal-login-open')" in HTML


def test_environment_example_points_to_requested_domain_and_exact_preview():
    env = (ROOT / ".env.example").read_text()
    assert "ATTENDPRO_PUBLIC_ORIGIN=https://ptclahore.co" in env
    assert "https://www.ptclahore.co" in env
    assert "https://attendpro-smart-biometric-hrms-static-op69zq26j-faryal3.vercel.app" in env
