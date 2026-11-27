"""Tests for the model preset resolver and default URL substitution."""

from __future__ import annotations

import pytest

from omakase.types import DEFAULT_URLS, MODEL_PRESETS, resolve_model_preset

OLLAMA_DEFAULT = "http://localhost:11434"


@pytest.mark.parametrize(
    "llm_type,mode,expected_supports_json",
    [
        ("ollama", "fast", True),
        ("ollama", "pro", True),
        ("anthropic", "fast", False),
        ("anthropic", "pro", False),
        ("gemini", "fast", True),
        ("gemini", "pro", True),
        ("deepseek", "fast", True),
        ("deepseek", "pro", True),
        ("openai", "fast", True),
        ("openrouter", "fast", True),
        ("openrouter", "pro", False),
    ],
)
def test_preset_supports_json(llm_type, mode, expected_supports_json):
    _, _, _, supports_json = resolve_model_preset(OLLAMA_DEFAULT, llm_type, "qwen3:8b", mode)
    assert supports_json is expected_supports_json


def test_resolver_substitutes_default_url_for_non_ollama_backend():
    url, _, _, _ = resolve_model_preset(OLLAMA_DEFAULT, "anthropic", "qwen3:8b", "fast")
    assert url == DEFAULT_URLS["anthropic"]


def test_resolver_keeps_custom_url():
    url, _, _, _ = resolve_model_preset(
        "https://my-proxy.example.com", "openai", "qwen3:8b", "fast"
    )
    assert url == "https://my-proxy.example.com"


def test_resolver_substitutes_preset_model_when_default_passed():
    _, _, model, _ = resolve_model_preset(OLLAMA_DEFAULT, "anthropic", "qwen3:8b", "fast")
    assert model == MODEL_PRESETS["anthropic-fast"]["model"]


@pytest.mark.parametrize(
    "backend,mode,expected_model",
    [
        ("openai", "fast", "gpt-6-luna"),
        ("openai", "pro", "gpt-6.2-astra"),
        ("anthropic", "fast", "claude-haiku-5-5"),
        ("anthropic", "pro", "claude-sonnet-5-5"),
        ("gemini", "fast", "gemini-3.8-flash"),
        ("gemini", "pro", "gemini-4-hydrogen"),
        ("deepseek", "fast", "deepseek-flash"),
        ("deepseek", "pro", "deepseek-v4-pro"),
    ],
)
def test_resolver_uses_current_cloud_models(backend, mode, expected_model):
    url, llm_type, model, _ = resolve_model_preset(
        OLLAMA_DEFAULT,
        backend,
        "qwen3:8b",
        mode,
    )
    assert (url, llm_type, model) == (
        DEFAULT_URLS[backend],
        backend,
        expected_model,
    )


def test_resolver_accepts_legacy_default_sentinel():
    _, _, model, _ = resolve_model_preset(OLLAMA_DEFAULT, "openai", "qwen2.5:7b", "fast")
    assert model == "gpt-6-luna"


def test_resolver_keeps_user_model_when_explicit():
    _, _, model, _ = resolve_model_preset(OLLAMA_DEFAULT, "openai", "gpt-4o-2024-11-20", "fast")
    assert model == "gpt-4o-2024-11-20"


def test_unknown_backend_returns_inputs_unchanged():
    url, llm_type, model, supports_json = resolve_model_preset(
        "https://x.example", "made-up-backend", "some-model", "fast"
    )
    assert (url, llm_type, model, supports_json) == (
        "https://x.example",
        "made-up-backend",
        "some-model",
        True,
    )


def test_all_backends_have_default_urls():
    from omakase.llm import list_backends

    for backend in list_backends():
        assert backend in DEFAULT_URLS, f"{backend} missing from DEFAULT_URLS"
