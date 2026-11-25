from fastapi.testclient import TestClient

from omakase.web import server


def test_public_responses_set_browser_security_headers(monkeypatch):
    monkeypatch.setenv("OMAKASE_PUBLIC_HOSTED", "true")
    response = TestClient(server.app).get("/")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["strict-transport-security"].startswith("max-age=")
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert "font-src 'self'" in response.headers["content-security-policy"]
    assert "https://s4.anilist.co" in response.headers["content-security-policy"]
    assert "script-src 'self'" in response.headers["content-security-policy"]


def test_api_responses_are_not_browser_cached():
    client = TestClient(server.app)

    assert client.get("/api/health").headers["cache-control"] == "no-store"
    assert client.get("/api/sources").headers["cache-control"] == "no-store"
