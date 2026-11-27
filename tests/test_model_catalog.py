"""Tests for live provider model discovery, resilient clients, and parser improvements."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from click.testing import CliRunner
from fastapi.testclient import TestClient

from omakase.cli import cli
from omakase.engine import _parse_recommendations
from omakase.llm.catalog import discover_provider_models, reset_openrouter_cache
from omakase.llm.gemini import GeminiLLM
from omakase.llm.openai import OpenAILLM
from omakase.mcp_server import handle_message
from omakase.web import server


def _mock_httpx_client(responses: list[MagicMock]):
    client = MagicMock()
    client.get.side_effect = responses
    client.post.side_effect = responses
    manager = MagicMock()
    manager.__enter__.return_value = client
    manager.__exit__.return_value = None
    return manager, client


def test_discover_openai_filters_non_chat_models():
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "data": [
            {"id": "gpt-6.2-astra", "owned_by": "openai"},
            {"id": "gpt-5-mini", "owned_by": "openai"},
            {"id": "text-embedding-3-large", "owned_by": "openai"},
            {"id": "whisper-1", "owned_by": "openai"},
            {"id": "tts-1-hd", "owned_by": "openai"},
            {"id": "dall-e-3", "owned_by": "openai"},
        ]
    }
    manager, client = _mock_httpx_client([resp])

    with patch("omakase.llm.catalog.httpx.Client", return_value=manager):
        result = discover_provider_models("openai", "https://api.openai.com", "sk-test")

    ids = [m["id"] for m in result["models"]]
    assert "gpt-6.2-astra" in ids
    assert "gpt-5-mini" in ids
    assert "text-embedding-3-large" not in ids
    assert "whisper-1" not in ids
    assert "tts-1-hd" not in ids
    assert "dall-e-3" not in ids
    assert result["key_verified"] is True
    assert client.get.call_args.kwargs["headers"]["Authorization"] == "Bearer sk-test"


def test_discover_gemini_filters_non_text_models_and_strips_prefix():
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "models": [
            {
                "name": "models/gemini-4-neon",
                "displayName": "Gemini 4 Neon",
                "inputTokenLimit": 1048576,
                "supportedGenerationMethods": ["generateContent"],
            },
            {
                "name": "models/gemini-3.8-flash",
                "displayName": "Gemini 3.8 Flash",
                "inputTokenLimit": 1048576,
                "supportedGenerationMethods": ["generateContent"],
            },
            {
                "name": "models/text-embedding-004",
                "displayName": "Embedding",
                "supportedGenerationMethods": ["embedContent"],
            },
            {
                "name": "models/gemini-2.5-flash-image",
                "displayName": "Gemini Image",
                "supportedGenerationMethods": ["generateContent"],
            },
        ]
    }
    manager, client = _mock_httpx_client([resp])

    with patch("omakase.llm.catalog.httpx.Client", return_value=manager):
        result = discover_provider_models(
            "gemini", "https://generativelanguage.googleapis.com", "gem-key"
        )

    ids = [m["id"] for m in result["models"]]
    assert ids == ["gemini-3.8-flash", "gemini-4-neon"]
    assert result["models"][0]["context_length"] == 1048576
    assert client.get.call_args.kwargs["headers"]["x-goog-api-key"] == "gem-key"


def test_discover_anthropic_and_openrouter_free_flags():
    ant_resp = MagicMock()
    ant_resp.status_code = 200
    ant_resp.json.return_value = {
        "data": [
            {"id": "claude-sonnet-5-5", "display_name": "Claude Sonnet 5.5"},
            {"id": "claude-haiku-5-5", "display_name": "Claude Haiku 5.5"},
        ]
    }
    manager, _ = _mock_httpx_client([ant_resp])
    with patch("omakase.llm.catalog.httpx.Client", return_value=manager):
        ant_result = discover_provider_models("anthropic", "https://api.anthropic.com", "ant-key")
    assert {m["tier"] for m in ant_result["models"]} == {"fast", "balanced"}

    reset_openrouter_cache()
    or_models = MagicMock()
    or_models.status_code = 200
    or_models.json.return_value = {
        "data": [
            {
                "id": "meta-llama/llama-3.3-70b-instruct:free",
                "name": "Llama 3.3 70B Free",
                "context_length": 131072,
                "pricing": {"prompt": "0", "completion": "0"},
                "architecture": {"output_modalities": ["text"]},
            },
            {
                "id": "openai/gpt-5-mini",
                "name": "OpenAI: GPT-5 mini",
                "context_length": 400000,
                "pricing": {"prompt": "0.00000025", "completion": "0.000002"},
                "architecture": {"output_modalities": ["text"]},
            },
        ]
    }
    or_key = MagicMock()
    or_key.status_code = 200
    or_key.json.return_value = {"data": {"label": "ok"}}
    manager2, _ = _mock_httpx_client([or_models, or_key])
    with patch("omakase.llm.catalog.httpx.Client", return_value=manager2):
        or_result = discover_provider_models("openrouter", "https://openrouter.ai/api", "or-key")
    assert or_result["source"] == "live"
    assert or_result["key_verified"] is True
    free_entry = next(
        m for m in or_result["models"] if m["id"] == "meta-llama/llama-3.3-70b-instruct:free"
    )
    assert free_entry["is_free"] is True


def test_hosted_provider_models_route_enforces_ssrf_and_key_guards(monkeypatch):
    monkeypatch.setenv("OMAKASE_PUBLIC_HOSTED", "true")
    server.reset_rate_limits()
    reset_openrouter_cache()
    client = TestClient(server.app)

    local_resp = client.post(
        "/api/providers/models",
        json={"llm_type": "ollama", "llm_url": "http://localhost:11434"},
    )
    assert local_resp.status_code == 400

    custom_url_resp = client.post(
        "/api/providers/models",
        json={"llm_type": "openai", "llm_url": "https://evil.example", "api_key": "sk-123"},
    )
    assert custom_url_resp.status_code == 400

    missing_key_resp = client.post(
        "/api/providers/models",
        json={"llm_type": "openai", "llm_url": "https://api.openai.com", "api_key": ""},
    )
    assert missing_key_resp.status_code == 400

    monkeypatch.setattr(
        server,
        "discover_provider_models",
        lambda llm_type, url, key: {
            "provider": llm_type,
            "source": "live_public",
            "key_verified": bool(key),
            "models": [{"id": "openai/gpt-5-mini", "name": "GPT-5 mini", "tier": "fast"}],
        },
    )
    or_resp = client.post(
        "/api/providers/models",
        json={"llm_type": "openrouter"},
    )
    assert or_resp.status_code == 200
    assert or_resp.json()["models"][0]["id"] == "openai/gpt-5-mini"


def test_openai_and_gemini_clients_retry_when_strict_params_rejected():
    bad = MagicMock()
    bad.status_code = 400
    bad.text = '{"error":{"message":"Unsupported parameter: response_format json_object"}}'
    good = MagicMock()
    good.status_code = 200
    good.json.return_value = {"choices": [{"message": {"content": '{"recommendations": []}'}}]}

    manager, client = _mock_httpx_client([bad, good])
    with patch("omakase.llm.openai.httpx.Client", return_value=manager):
        out = OpenAILLM("https://api.openai.com", "gpt-6.2-astra", api_key="k").generate(
            "hi", supports_json=True
        )
    assert out == '{"recommendations": []}'
    assert client.post.call_count == 2
    first_payload = client.post.call_args_list[0].kwargs["json"]
    second_payload = client.post.call_args_list[1].kwargs["json"]
    assert first_payload["max_completion_tokens"] == 8192
    assert "response_format" in first_payload
    assert "response_format" not in second_payload

    gem_bad = MagicMock()
    gem_bad.status_code = 400
    gem_bad.text = "JSON mode responseMimeType is not supported"
    gem_good = MagicMock()
    gem_good.status_code = 200
    gem_good.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": '{"recommendations": []}'}]}}]
    }
    gem_manager, gem_client = _mock_httpx_client([gem_bad, gem_good])
    with patch("omakase.llm.gemini.httpx.Client", return_value=gem_manager):
        gem_out = GeminiLLM(
            "https://generativelanguage.googleapis.com",
            "models/gemini-4-neon",
            api_key="gkey",
        ).generate("hi", supports_json=True)
    assert gem_out == '{"recommendations": []}'
    assert (
        gem_client.post.call_args_list[0].args[0].endswith("/models/gemini-4-neon:generateContent")
    )


def test_parse_recommendations_strips_think_blocks_and_handles_array_fallback():
    raw = (
        "<think>Comparing user's 9/10 ratings...</think>\n"
        '[{"title": "Pluto", "predicted_score": 9.1, '
        '"reasoning": "Matches Monster.", "best_match_from_history": "Monster"}]'
    )
    recs = _parse_recommendations(raw)
    assert len(recs) == 1
    assert recs[0].title == "Pluto"
    assert recs[0].predicted_score == 9.1


def test_cli_and_mcp_expose_model_discovery(monkeypatch):
    monkeypatch.setattr(
        "omakase.cli.discover_provider_models",
        lambda llm_type, url, key: {
            "provider": llm_type,
            "source": "live",
            "key_verified": True,
            "models": [{"id": "gpt-6.2-astra", "name": "GPT-6.2 Astra", "tier": "flagship"}],
        },
    )
    runner = CliRunner()
    res = runner.invoke(cli, ["models", "--llm-type", "openai", "--json"])
    assert res.exit_code == 0
    assert "gpt-6.2-astra" in res.output

    monkeypatch.setattr(
        "omakase.mcp_server.discover_provider_models",
        lambda llm_type, url: {
            "provider": llm_type,
            "source": "live_public",
            "key_verified": False,
            "models": [{"id": "openai/gpt-5-mini", "name": "GPT-5 mini", "tier": "fast"}],
        },
    )
    mcp_resp = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 99,
            "method": "tools/call",
            "params": {"name": "omakase_list_models", "arguments": {"llm_type": "openrouter"}},
        }
    )
    assert mcp_resp is not None
    payload = json.loads(mcp_resp["result"]["content"][0]["text"])
    assert payload["models"][0]["id"] == "openai/gpt-5-mini"
