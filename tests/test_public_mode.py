from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def _load_public_app(monkeypatch):
    monkeypatch.delenv("OMAKASE_PLUS_PRIVATE", raising=False)
    sys.modules.pop("omakase.web.server", None)
    server = importlib.import_module("omakase.web.server")
    return server.app


def test_public_mode_promotes_byok_and_has_no_accounts(monkeypatch):
    monkeypatch.setenv("OMAKASE_PUBLIC_HOSTED", "true")
    app = _load_public_app(monkeypatch)
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "Cook my recommendation menu" in response.text
    assert "never written to disk, logs, cookies, or a database" in response.text
    assert "No account, no saved keys, no database." in response.text
    assert "Private Plus automation is not connected to this demo." in response.text
    assert "Lite accounts" not in response.text
    assert "/account" not in response.text
    assert "Sign in" not in response.text
    assert "watching-dialog" not in response.text
    assert "watched-dialog" not in response.text
    assert "recommend-again" not in response.text
    assert "Ollama" not in response.text
    assert "LM Studio" not in response.text
    assert "DeepSeek" in response.text
    assert "OpenWebUI" in response.text
    assert 'id="openwebui_url"' in response.text
    assert 'id="openwebui_model"' in response.text
    assert "—" not in response.text
    assert "/static/url_safety.js?v=" in response.text
    assert "/static/favicon.svg?v=" in response.text
    assert "/static/omakase-mark.svg?v=" in response.text
    assert 'class="field-guide__card"' in response.text
    field_guide_slice = response.text.split('id="field-guide"', 1)[1].split("</section>", 1)[0]
    assert "<details" not in field_guide_slice
    lower_html = response.text.lower()
    for hardcoded in (
        "gpt-5",
        "gpt-6",
        "gemini-3",
        "gemini-4",
        "claude-haiku",
        "claude-sonnet",
        "claude-opus",
        "claude-fable",
        "deepseek-v4",
        "llama3.1",
    ):
        assert hardcoded not in lower_html, f"Found hardcoded model reference: {hardcoded}"
    assert 'name="provider_credential"' in response.text
    assert 'class="masked-credential"' in response.text
    assert 'name="provider_credential"\n                    type="password"' not in response.text


def test_public_mode_does_not_mount_account_or_plus_routes(monkeypatch):
    app = _load_public_app(monkeypatch)
    client = TestClient(app)

    for path in (
        "/plus",
        "/plus/login",
        "/plus/dashboard",
        "/account",
        "/account/login",
        "/api/account/session",
    ):
        response = client.get(path, follow_redirects=False)
        assert response.status_code == 404


def test_compose_stack_mounts_no_keyring_or_account_database():
    compose = Path("compose.yaml").read_text(encoding="utf-8")

    assert "lite_keyring" not in compose
    assert "omakase_lite_data" not in compose
    assert "access_discord" not in compose
    assert "webhook" not in compose.lower()
