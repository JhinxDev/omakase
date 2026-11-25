"""Payload-contract tests for OpenAI-compatible providers."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from omakase.llm import get_llm
from omakase.llm.openai import OpenAILLM


def _mock_client():
    response = MagicMock()
    response.json.return_value = {"choices": [{"message": {"content": '{"ok": true}'}}]}

    client = MagicMock()
    client.post.return_value = response

    manager = MagicMock()
    manager.__enter__.return_value = client
    manager.__exit__.return_value = None
    return manager, client


@pytest.mark.parametrize(
    "model,expected_max_tokens",
    [
        ("deepseek-v4-flash", 8192),
        ("deepseek-v4-pro", 8192),
    ],
)
def test_current_deepseek_models_receive_a_complete_json_output_budget(
    model,
    expected_max_tokens,
):
    manager, client = _mock_client()

    with patch("httpx.Client", return_value=manager):
        llm = OpenAILLM("https://api.deepseek.com", model, api_key="request-key")
        llm.generate("Return JSON.", supports_json=True)

    payload = client.post.call_args.kwargs["json"]
    assert payload["max_tokens"] == expected_max_tokens
    assert payload["response_format"] == {"type": "json_object"}


def test_openwebui_uses_its_instance_chat_completions_endpoint():
    manager, client = _mock_client()

    with patch("httpx.Client", return_value=manager):
        llm = get_llm(
            "openwebui",
            "https://models.example.com/team/",
            "llama3.1:8b",
            api_key="openwebui-key",
        )
        llm.generate("Return JSON.", supports_json=False)

    assert client.post.call_args.args[0] == ("https://models.example.com/team/api/chat/completions")
    assert client.post.call_args.kwargs["headers"]["Authorization"] == ("Bearer openwebui-key")


def test_openai_gpt5_uses_max_completion_tokens_without_temperature():
    manager, client = _mock_client()

    with patch("httpx.Client", return_value=manager):
        llm = OpenAILLM("https://api.openai.com", "gpt-5-mini", api_key="openai-key")
        llm.generate("Return JSON.", temperature=0.4, supports_json=True)

    payload = client.post.call_args.kwargs["json"]
    assert payload["max_completion_tokens"] == 8192
    assert "max_tokens" not in payload
    assert "temperature" not in payload
    assert payload["response_format"] == {"type": "json_object"}


def test_gemini_passes_key_in_header_and_disables_redirects():
    response = MagicMock()
    response.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": '{"recommendations": []}'}]}}]
    }
    client = MagicMock()
    client.post.return_value = response
    manager = MagicMock()
    manager.__enter__.return_value = client
    manager.__exit__.return_value = None

    with patch("httpx.Client", return_value=manager) as client_cls:
        llm = get_llm(
            "gemini",
            "https://generativelanguage.googleapis.com",
            "gemini-3.8-flash",
            api_key="gem-key",
        )
        out = llm.generate("Return JSON.", supports_json=True)

    assert out == '{"recommendations": []}'
    assert client_cls.call_args.kwargs["follow_redirects"] is False
    call_kwargs = client.post.call_args.kwargs
    assert "params" not in call_kwargs
    assert call_kwargs["headers"]["x-goog-api-key"] == "gem-key"
    assert call_kwargs["json"]["generationConfig"]["maxOutputTokens"] == 8192


def test_anthropic_and_ollama_disable_redirects():
    response = MagicMock()
    response.json.return_value = {"content": [{"type": "text", "text": "{}"}], "response": "{}"}
    client = MagicMock()
    client.post.return_value = response
    manager = MagicMock()
    manager.__enter__.return_value = client
    manager.__exit__.return_value = None

    with patch("httpx.Client", return_value=manager) as client_cls:
        get_llm(
            "anthropic", "https://api.anthropic.com", "claude-haiku-4-5", api_key="ant"
        ).generate("hi")
        assert client_cls.call_args.kwargs["follow_redirects"] is False
        assert client.post.call_args.kwargs["json"]["max_tokens"] == 8192

        get_llm("ollama", "http://localhost:11434", "qwen3:8b").generate("hi")
        assert client_cls.call_args.kwargs["follow_redirects"] is False
