from pathlib import Path

from fastapi.testclient import TestClient

from omakase.web import server
from omakase.web.server import app

client = TestClient(app)


def test_home_links_static_favicon():
    response = client.get("/")

    assert response.status_code == 200
    assert '<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">' in response.text


def test_favicon_ico_compat_route_serves_svg():
    response = client.get("/favicon.ico")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "Omakase, a bowl beneath a star" in response.text


def test_generated_atelier_art_is_present():
    art = Path(server.__file__).parent / "static" / "generated" / "omakase-atelier.webp"

    assert art.is_file()
    assert art.stat().st_size > 100_000


def test_provider_and_source_brand_logos_are_served():
    for name in (
        "openai.svg",
        "anthropic.svg",
        "gemini.svg",
        "deepseek.svg",
        "openrouter.svg",
        "openwebui.svg",
        "anilist.svg",
        "myanimelist.svg",
    ):
        resp = client.get(f"/static/logos/{name}")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("image/svg+xml")
        assert "<svg" in resp.text
