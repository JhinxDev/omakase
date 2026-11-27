"""Provider metadata, curated starter models, and live model discovery."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx

from omakase.llm.anthropic import ANTHROPIC_VERSION
from omakase.types import DEFAULT_URLS

_DISCOVERY_TIMEOUT = 12.0
_OPENROUTER_CACHE_TTL = 600.0
_MAX_DISCOVERED_MODELS = 250

_openrouter_cache_lock = threading.Lock()
_openrouter_cache: tuple[float, list[dict[str, Any]]] | None = None


class ModelDiscoveryError(RuntimeError):
    """Raised when live provider model discovery fails cleanly."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class ProviderDescriptor:
    id: str
    label: str
    tagline: str
    default_url: str
    key_hint: str
    key_url: str
    hosted: bool
    requires_key: bool
    public_model_catalog: bool
    supports_discovery: bool
    starters: tuple[dict[str, str], ...]


PROVIDER_CATALOG: dict[str, ProviderDescriptor] = {
    "openai": ProviderDescriptor(
        id="openai",
        label="OpenAI",
        tagline="GPT-6 Luna, Sol & Astra",
        default_url=DEFAULT_URLS["openai"],
        key_hint="Create or manage an API key in your OpenAI Platform account.",
        key_url="https://platform.openai.com/api-keys",
        hosted=True,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "gpt-6-luna",
                "name": "GPT-6 Luna",
                "tier": "fast",
                "description": "Rapid, budget-friendly GPT-6 generation.",
            },
            {
                "id": "gpt-6.2-sol",
                "name": "GPT-6.2 Sol",
                "tier": "balanced",
                "description": "High-performance everyday reasoning & synthesis.",
            },
            {
                "id": "gpt-6.2-astra",
                "name": "GPT-6.2 Astra",
                "tier": "flagship",
                "description": "Flagship model for deep multi-title taste pairing.",
            },
            {
                "id": "gpt-6.2-astra-pro",
                "name": "GPT-6.2 Astra Pro",
                "tier": "reasoning",
                "description": "Extended reasoning for subtle taste nuance.",
            },
        ),
    ),
    "anthropic": ProviderDescriptor(
        id="anthropic",
        label="Anthropic",
        tagline="Claude 5.5 & Fable 5.2",
        default_url=DEFAULT_URLS["anthropic"],
        key_hint="Use an API key from your Anthropic Console account.",
        key_url="https://console.anthropic.com/settings/keys",
        hosted=True,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "claude-haiku-5-5",
                "name": "Claude Haiku 5.5",
                "tier": "fast",
                "description": "Fast, cost-efficient Claude generation.",
            },
            {
                "id": "claude-sonnet-5-5",
                "name": "Claude Sonnet 5.5",
                "tier": "balanced",
                "description": "Sharp taste analysis and concise prose.",
            },
            {
                "id": "claude-opus-5-5",
                "name": "Claude Opus 5.5",
                "tier": "flagship",
                "description": "Deepest long-context character & theme matching.",
            },
            {
                "id": "claude-fable-5-2",
                "name": "Claude Fable 5.2",
                "tier": "reasoning",
                "description": "Long-horizon reasoning over large histories.",
            },
        ),
    ),
    "gemini": ProviderDescriptor(
        id="gemini",
        label="Gemini",
        tagline="3.8 Flash & Gemini 4",
        default_url=DEFAULT_URLS["gemini"],
        key_hint="Use a Gemini API key from Google AI Studio.",
        key_url="https://aistudio.google.com/apikey",
        hosted=True,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "gemini-3.8-flash",
                "name": "Gemini 3.8 Flash",
                "tier": "fast",
                "description": "Fastest Gemini model with 1M context.",
            },
            {
                "id": "gemini-4-hydrogen",
                "name": "Gemini 4 Hydrogen",
                "tier": "balanced",
                "description": "Balanced next-gen taste reasoning.",
            },
            {
                "id": "gemini-4-neon",
                "name": "Gemini 4 Neon",
                "tier": "reasoning",
                "description": "High-reasoning pairing across large watchlists.",
            },
            {
                "id": "gemini-4-carbon",
                "name": "Gemini 4 Carbon",
                "tier": "flagship",
                "description": "Flagship depth for intricate taste profiles.",
            },
        ),
    ),
    "deepseek": ProviderDescriptor(
        id="deepseek",
        label="DeepSeek",
        tagline="V4.1 Flash & V4 Pro",
        default_url=DEFAULT_URLS["deepseek"],
        key_hint="Use an API key from the DeepSeek Platform.",
        key_url="https://platform.deepseek.com/api_keys",
        hosted=True,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "deepseek-flash",
                "name": "DeepSeek Flash",
                "tier": "fast",
                "description": "Fast, economical 1M-context recommendation engine.",
            },
            {
                "id": "deepseek-v4-pro",
                "name": "DeepSeek V4 Pro",
                "tier": "reasoning",
                "description": "Deep hybrid reasoning over complex histories.",
            },
        ),
    ),
    "openrouter": ProviderDescriptor(
        id="openrouter",
        label="OpenRouter",
        tagline="One key, live model hub",
        default_url=DEFAULT_URLS["openrouter"],
        key_hint="Use an OpenRouter key. Browse live models anytime; paste a key to cook.",
        key_url="https://openrouter.ai/keys",
        hosted=True,
        requires_key=True,
        public_model_catalog=True,
        supports_discovery=True,
        starters=(
            {
                "id": "openai/gpt-6.2-sol",
                "name": "OpenAI: GPT-6.2 Sol",
                "tier": "balanced",
                "description": "Balanced GPT-6.2 route on OpenRouter.",
            },
            {
                "id": "anthropic/claude-sonnet-5.5",
                "name": "Anthropic: Claude Sonnet 5.5",
                "tier": "balanced",
                "description": "Balanced Claude Sonnet via OpenRouter.",
            },
            {
                "id": "google/gemini-4-hydrogen",
                "name": "Google: Gemini 4 Hydrogen",
                "tier": "balanced",
                "description": "Balanced Gemini 4 route.",
            },
            {
                "id": "deepseek/deepseek-v4.1-flash",
                "name": "DeepSeek: DeepSeek V4.1 Flash",
                "tier": "fast",
                "description": "Fast 1M-context DeepSeek route.",
            },
            {
                "id": "openai/gpt-6.2-astra",
                "name": "OpenAI: GPT-6.2 Astra",
                "tier": "flagship",
                "description": "Flagship OpenAI synthesis route.",
            },
            {
                "id": "google/gemini-4-neon",
                "name": "Google: Gemini 4 Neon",
                "tier": "reasoning",
                "description": "Deep Gemini 4 reasoning route.",
            },
        ),
    ),
    "openwebui": ProviderDescriptor(
        id="openwebui",
        label="OpenWebUI",
        tagline="Your hosted model hub",
        default_url="",
        key_hint="Enter an allowlisted HTTPS instance URL and your OpenWebUI API key.",
        key_url="",
        hosted=True,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(),
    ),
    "ollama": ProviderDescriptor(
        id="ollama",
        label="Ollama",
        tagline="Local models on your machine",
        default_url=DEFAULT_URLS["ollama"],
        key_hint="No API key required for local Ollama.",
        key_url="",
        hosted=False,
        requires_key=False,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "qwen3:8b",
                "name": "Qwen 3 (8B)",
                "tier": "fast",
                "description": "Compact local model.",
            },
            {
                "id": "qwen3:14b",
                "name": "Qwen 3 (14B)",
                "tier": "balanced",
                "description": "Richer local reasoning.",
            },
        ),
    ),
    "lmstudio": ProviderDescriptor(
        id="lmstudio",
        label="LM Studio",
        tagline="Local OpenAI-compatible runtime",
        default_url=DEFAULT_URLS["lmstudio"],
        key_hint="Optional local API token.",
        key_url="",
        hosted=False,
        requires_key=False,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "qwen3-8b",
                "name": "Qwen 3 (8B)",
                "tier": "fast",
                "description": "Fast local GGUF/MLX model.",
            },
            {
                "id": "qwen3-14b",
                "name": "Qwen 3 (14B)",
                "tier": "balanced",
                "description": "Balanced local reasoning.",
            },
        ),
    ),
    "groq": ProviderDescriptor(
        id="groq",
        label="Groq",
        tagline="Ultra-fast LPU inference",
        default_url=DEFAULT_URLS["groq"],
        key_hint="Use a GroqCloud API key.",
        key_url="https://console.groq.com/keys",
        hosted=False,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "llama-3.3-70b-versatile",
                "name": "Llama 3.3 70B Versatile",
                "tier": "fast",
                "description": "Fast open-weights model on Groq.",
            },
            {
                "id": "qwen/qwen3-32b",
                "name": "Qwen 3 32B",
                "tier": "reasoning",
                "description": "Deeper open-weights reasoning.",
            },
        ),
    ),
    "together": ProviderDescriptor(
        id="together",
        label="Together",
        tagline="Open-weights cloud inference",
        default_url=DEFAULT_URLS["together"],
        key_hint="Use a Together AI API key.",
        key_url="https://api.together.xyz/settings/api-keys",
        hosted=False,
        requires_key=True,
        public_model_catalog=False,
        supports_discovery=True,
        starters=(
            {
                "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "name": "Llama 3.3 70B Turbo",
                "tier": "fast",
                "description": "Fast open-weights inference.",
            },
            {
                "id": "deepseek-ai/DeepSeek-R1",
                "name": "DeepSeek R1",
                "tier": "reasoning",
                "description": "Open-weights reasoning model.",
            },
        ),
    ),
}


def serialize_provider_catalog(*, hosted_only: bool = False) -> dict[str, dict[str, Any]]:
    """Return frontend-safe provider metadata and curated starter models."""
    out: dict[str, dict[str, Any]] = {}
    for pid, desc in PROVIDER_CATALOG.items():
        if hosted_only and not desc.hosted:
            continue
        out[pid] = {
            "id": desc.id,
            "label": desc.label,
            "tagline": desc.tagline,
            "default_url": desc.default_url,
            "key_hint": desc.key_hint,
            "key_url": desc.key_url,
            "hosted": desc.hosted,
            "requires_key": desc.requires_key,
            "public_model_catalog": desc.public_model_catalog,
            "supports_discovery": desc.supports_discovery,
            "starters": [dict(item) for item in desc.starters],
        }
    return out


def reset_openrouter_cache() -> None:
    """Clear the cached public OpenRouter catalog (used by tests)."""
    global _openrouter_cache
    with _openrouter_cache_lock:
        _openrouter_cache = None


def infer_model_tier(provider: str, model_id: str, name: str = "") -> str:
    """Classify a model into 'fast', 'balanced', 'reasoning', or 'flagship'."""
    low = f"{model_id} {name}".lower()
    if any(tok in low for tok in ("reasoner", "thinking", "-r1", "deepseek-r1", "fable")):
        return "reasoning"
    if provider == "openai" or "openai/" in low:
        if any(tok in low for tok in ("-pro", "o1", "o3", "o4")):
            return "reasoning"
        if any(tok in low for tok in ("mini", "nano", "luna", "terra")):
            return "fast"
        if "astra" in low:
            return "flagship"
        if "sol" in low:
            return "balanced"
        if "gpt-6" in low:
            return "flagship"
        return "balanced"
    if provider == "anthropic" or "anthropic/" in low:
        if "haiku" in low:
            return "fast"
        if "opus" in low:
            return "flagship"
        return "balanced"
    if provider == "gemini" or "google/" in low:
        if "flash" in low:
            return "fast"
        if any(tok in low for tok in ("neon", "carbon")):
            return "flagship" if "carbon" in low else "reasoning"
        if any(tok in low for tok in ("hydrogen", "pro")):
            return "balanced"
        return "balanced"
    if provider == "deepseek" or "deepseek" in low:
        if any(tok in low for tok in ("flash", "chat")):
            return "fast"
        if any(tok in low for tok in ("pro", "reasoner", "r1")):
            return "reasoning"
        return "balanced"
    if any(tok in low for tok in ("flash", "mini", "nano", "haiku", "lite", "instant", "turbo")):
        return "fast"
    if any(tok in low for tok in ("opus", "pro", "reasoning", "reason", "o3", "o4", "r1")):
        return "reasoning"
    return "balanced"


def _is_non_chat_openai_model(model_id: str) -> bool:
    low = model_id.lower()
    excluded_tokens = (
        "embedding",
        "whisper",
        "tts",
        "dall-e",
        "moderation",
        "realtime",
        "audio",
        "image",
        "sora",
        "babbage",
        "davinci",
        "transcribe",
        "diarize",
        "search-",
        "codex",
    )
    if any(tok in low for tok in excluded_tokens):
        return True
    return not (
        low.startswith(("gpt-", "o1", "o3", "o4", "chatgpt-")) or low in {"gpt-5", "gpt-4o"}
    )


def _is_non_text_gemini_model(model_id: str, item: dict[str, Any]) -> bool:
    methods = item.get("supportedGenerationMethods") or []
    if "generateContent" not in methods:
        return True
    low = model_id.lower()
    excluded = (
        "embedding",
        "aqa",
        "tts",
        "image",
        "veo",
        "imagen",
        "robotics",
        "native-audio",
        "live",
        "gemma",
    )
    return any(tok in low for tok in excluded)


def _format_display_name(model_id: str) -> str:
    clean = model_id.strip()
    if "/" in clean and not clean.startswith("models/"):
        prefix, rest = clean.split("/", 1)
        return f"{prefix}: {rest}"
    return clean


def _normalize_model(
    *,
    provider: str,
    model_id: str,
    name: str | None = None,
    context_length: int | None = None,
    is_free: bool = False,
    owned_by: str = "",
    created: int = 0,
) -> dict[str, Any]:
    display = (name or "").strip() or _format_display_name(model_id)
    tier = infer_model_tier(provider, model_id, display)
    return {
        "id": model_id,
        "name": display,
        "tier": tier,
        "context_length": context_length,
        "is_free": is_free,
        "owned_by": owned_by,
        "_created": created,
    }


def _prioritize_models(provider: str, models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Put curated starter IDs first (in starter order), then newest models descending."""
    desc = PROVIDER_CATALOG.get(provider)
    starter_order = {item["id"]: index for index, item in enumerate(desc.starters if desc else ())}

    def sort_key(entry: dict[str, Any]) -> tuple[int, int, int, str]:
        mid = entry["id"]
        if mid in starter_order:
            return (0, starter_order[mid], 0, mid.lower())
        created = int(entry.get("_created") or 0)
        return (1, -created, 0 if entry.get("is_free") else 1, mid.lower())

    deduped: dict[str, dict[str, Any]] = {}
    for item in models:
        mid = str(item.get("id") or "").strip()
        if mid and mid not in deduped:
            deduped[mid] = item
    sorted_items = sorted(deduped.values(), key=sort_key)[:_MAX_DISCOVERED_MODELS]
    return [{k: v for k, v in item.items() if k != "_created"} for item in sorted_items]


def _translate_http_error(provider_label: str, exc: httpx.HTTPStatusError) -> ModelDiscoveryError:
    code = exc.response.status_code
    if code in (401, 403):
        return ModelDiscoveryError(
            401,
            f"{provider_label} rejected your API key. Double-check the key you pasted.",
        )
    if code == 429:
        return ModelDiscoveryError(
            429,
            f"{provider_label} rate-limited model discovery. Wait a moment and try again.",
        )
    if code == 404:
        return ModelDiscoveryError(
            502,
            f"{provider_label} did not expose a model list at that endpoint. Enter a model ID directly.",
        )
    return ModelDiscoveryError(
        502,
        f"{provider_label} returned HTTP {code} while loading models. You can still enter a model ID manually.",
    )


def _fetch_openrouter_public_models(base_url: str, client: httpx.Client) -> list[dict[str, Any]]:
    global _openrouter_cache
    now = time.monotonic()
    with _openrouter_cache_lock:
        if _openrouter_cache is not None:
            ts, cached = _openrouter_cache
            if now - ts < _OPENROUTER_CACHE_TTL:
                return [dict(m) for m in cached]

    resp = client.get(f"{base_url}/v1/models", headers={"Accept": "application/json"})
    resp.raise_for_status()
    payload = resp.json()
    raw_items = payload.get("data") or []
    parsed: list[dict[str, Any]] = []
    for item in raw_items:
        mid = str(item.get("id") or "").strip()
        if not mid or mid.endswith(":batch"):
            continue
        arch = item.get("architecture") or {}
        output_mods = arch.get("output_modalities") or []
        if output_mods and "text" not in output_mods:
            continue
        pricing = item.get("pricing") or {}
        prompt_price = str(pricing.get("prompt") or "").strip()
        comp_price = str(pricing.get("completion") or "").strip()
        is_free = mid.endswith(":free") or (prompt_price == "0" and comp_price == "0")
        ctx = item.get("context_length")
        context_length = int(ctx) if isinstance(ctx, (int, float)) and ctx > 0 else None
        created = item.get("created")
        created_ts = int(created) if isinstance(created, (int, float)) else 0
        parsed.append(
            _normalize_model(
                provider="openrouter",
                model_id=mid,
                name=str(item.get("name") or "").strip() or mid,
                context_length=context_length,
                is_free=is_free,
                owned_by=mid.split("/", 1)[0] if "/" in mid else "",
                created=created_ts,
            )
        )

    prioritized = _prioritize_models("openrouter", parsed)
    with _openrouter_cache_lock:
        _openrouter_cache = (now, prioritized)
    return [dict(m) for m in prioritized]


def discover_provider_models(
    llm_type: str,
    url: str,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Fetch live available chat/reasoning models from the provider's official API."""
    provider = llm_type.strip().lower()
    desc = PROVIDER_CATALOG.get(provider)
    if desc is None:
        raise ModelDiscoveryError(400, f"Unknown model provider '{llm_type}'.")

    base_url = (url or desc.default_url).strip().rstrip("/")
    key = (api_key or "").strip()
    label = desc.label

    try:
        with httpx.Client(timeout=_DISCOVERY_TIMEOUT, follow_redirects=False) as client:
            if provider == "openrouter":
                models = _fetch_openrouter_public_models(base_url, client)
                key_verified = False
                if key:
                    auth_resp = client.get(
                        f"{base_url}/v1/key",
                        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
                    )
                    auth_resp.raise_for_status()
                    key_verified = True
                return {
                    "provider": provider,
                    "source": "live" if key_verified else "live_public",
                    "key_verified": key_verified,
                    "models": models,
                }

            if provider == "anthropic":
                headers = {
                    "anthropic-version": ANTHROPIC_VERSION,
                    "Accept": "application/json",
                }
                if key:
                    headers["x-api-key"] = key
                resp = client.get(f"{base_url}/v1/models?limit=100", headers=headers)
                resp.raise_for_status()
                raw_items = resp.json().get("data") or []
                models = [
                    _normalize_model(
                        provider=provider,
                        model_id=str(item.get("id") or "").strip(),
                        name=str(item.get("display_name") or "").strip(),
                        owned_by="anthropic",
                    )
                    for item in raw_items
                    if str(item.get("id") or "").strip()
                ]
                return {
                    "provider": provider,
                    "source": "live",
                    "key_verified": bool(key),
                    "models": _prioritize_models(provider, models),
                }

            if provider == "gemini":
                headers = {"Accept": "application/json"}
                if key:
                    headers["x-goog-api-key"] = key
                resp = client.get(f"{base_url}/v1beta/models?pageSize=100", headers=headers)
                resp.raise_for_status()
                raw_items = resp.json().get("models") or []
                models = []
                for item in raw_items:
                    raw_name = str(item.get("name") or "").strip()
                    mid = raw_name.removeprefix("models/")
                    if not mid or _is_non_text_gemini_model(mid, item):
                        continue
                    ctx = item.get("inputTokenLimit")
                    context_length = int(ctx) if isinstance(ctx, (int, float)) and ctx > 0 else None
                    models.append(
                        _normalize_model(
                            provider=provider,
                            model_id=mid,
                            name=str(item.get("displayName") or "").strip() or mid,
                            context_length=context_length,
                            owned_by="google",
                        )
                    )
                return {
                    "provider": provider,
                    "source": "live",
                    "key_verified": bool(key),
                    "models": _prioritize_models(provider, models),
                }

            if provider == "ollama":
                resp = client.get(f"{base_url}/api/tags", headers={"Accept": "application/json"})
                resp.raise_for_status()
                raw_items = resp.json().get("models") or []
                models = [
                    _normalize_model(
                        provider=provider,
                        model_id=str(item.get("name") or "").strip(),
                        name=str(item.get("name") or "").strip(),
                        owned_by="ollama",
                    )
                    for item in raw_items
                    if str(item.get("name") or "").strip()
                ]
                return {
                    "provider": provider,
                    "source": "live",
                    "key_verified": True,
                    "models": _prioritize_models(provider, models),
                }

            if provider == "openwebui":
                headers = {"Accept": "application/json"}
                if key:
                    headers["Authorization"] = f"Bearer {key}"
                resp = client.get(f"{base_url}/api/models", headers=headers)
                resp.raise_for_status()
                payload = resp.json()
                raw_items = payload.get("data")
                if raw_items is None:
                    raw_items = payload.get("models") or []
                models = []
                for item in raw_items:
                    if isinstance(item, str):
                        mid = item.strip()
                        display = mid
                    elif isinstance(item, dict):
                        mid = str(item.get("id") or item.get("model") or "").strip()
                        display = str(item.get("name") or "").strip() or mid
                    else:
                        continue
                    if not mid:
                        continue
                    models.append(
                        _normalize_model(
                            provider=provider,
                            model_id=mid,
                            name=display,
                            owned_by="openwebui",
                        )
                    )
                return {
                    "provider": provider,
                    "source": "live",
                    "key_verified": bool(key),
                    "models": _prioritize_models(provider, models),
                }

            # OpenAI, DeepSeek, LM Studio, Groq, Together (/v1/models)
            headers = {"Accept": "application/json"}
            if key:
                headers["Authorization"] = f"Bearer {key}"
            resp = client.get(f"{base_url}/v1/models", headers=headers)
            resp.raise_for_status()
            payload = resp.json()
            raw_items = payload.get("data") or []
            models = []
            for item in raw_items:
                mid = str(item.get("id") or "").strip()
                if not mid:
                    continue
                if provider == "openai" and _is_non_chat_openai_model(mid):
                    continue
                created = item.get("created")
                created_ts = int(created) if isinstance(created, (int, float)) else 0
                models.append(
                    _normalize_model(
                        provider=provider,
                        model_id=mid,
                        name=str(item.get("name") or "").strip() or mid,
                        owned_by=str(item.get("owned_by") or provider),
                        created=created_ts,
                    )
                )
            return {
                "provider": provider,
                "source": "live",
                "key_verified": bool(key) or not desc.requires_key,
                "models": _prioritize_models(provider, models),
            }
    except httpx.HTTPStatusError as exc:
        raise _translate_http_error(label, exc) from exc
    except httpx.TimeoutException as exc:
        raise ModelDiscoveryError(
            504,
            f"{label} took too long to return its model list. You can enter a model ID manually.",
        ) from exc
    except httpx.RequestError as exc:
        raise ModelDiscoveryError(
            502,
            f"Omakase could not reach {label} right now. Check the URL or enter a model ID manually.",
        ) from exc
    except ValueError as exc:
        raise ModelDiscoveryError(
            502,
            f"{label} returned an unexpected model list format. Enter a model ID manually.",
        ) from exc
