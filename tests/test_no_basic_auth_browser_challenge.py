from fastapi.testclient import TestClient
import app


def test_unauthenticated_api_does_not_emit_browser_basic_auth_challenge(monkeypatch):
    monkeypatch.delenv("DASHBOARD_PASSWORD", raising=False)
    monkeypatch.setattr(app, "CLOUD_ENABLED", False)
    client = TestClient(app.app)
    response = client.get("/api/users")
    assert response.status_code == 401
    assert "www-authenticate" not in {k.lower() for k in response.headers}


def test_public_frontend_assets_are_served_without_portal_login():
    client = TestClient(app.app)
    assert client.get("/").status_code == 200
    assert client.get("/src/styles/main.css").status_code == 200
    assert client.get("/src/js/attendpro-app.js").status_code == 200
    assert client.get("/src/js/public-landing.js").status_code == 200
    assert client.get("/assets/ptc-college-crest.webp").status_code == 200
