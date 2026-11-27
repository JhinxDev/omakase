"""Core data types, model presets, and safe media URL helpers for Omakase."""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urlsplit

ALLOWED_COVER_HOSTS = frozenset({"s4.anilist.co", "cdn.myanimelist.net"})


def safe_cover_url(url: str | None) -> str | None:
    """Return an HTTPS cover image URL only if its host is an allowlisted anime CDN."""
    if not url or not isinstance(url, str):
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    try:
        parsed = urlsplit(cleaned)
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        return None
    if parsed.hostname.lower() not in ALLOWED_COVER_HOSTS:
        return None
    return cleaned


@dataclass
class MediaItem:
    """A single anime — either from the user's history or a candidate."""

    id: int
    title_romaji: str
    title_english: str | None = None
    genres: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    score: float | None = None  # user's score (history only)
    status: str | None = None  # CURRENT, COMPLETED, DROPPED, etc. (history only)
    format: str | None = None  # TV, Movie, OVA, etc.
    episodes: int | None = None
    studio: str | None = None
    description: str | None = None  # only for candidates
    mean_score: float | None = None  # global average score
    cover_image: str | None = None


@dataclass
class Recommendation:
    """A single recommendation from the LLM."""

    title: str
    predicted_score: float
    reasoning: str
    best_match_from_history: str
    url: str | None = None
    source: str | None = None
    cover_image: str | None = None
    genres: list[str] = field(default_factory=list)
    episodes: int | None = None
    format: str | None = None
    studio: str | None = None
    mean_score: float | None = None


@dataclass
class SourceData:
    """Normalized data from any source adapter."""

    username: str
    history: list[MediaItem]
    candidates: list[MediaItem]
    source_name: str  # e.g. "anilist", "myanimelist"


@dataclass
class OmakaseConfig:
    """Runtime configuration for a recommendation run."""

    source: str
    username: str
    llm_url: str
    model: str
    profile_path: str
    candidate_pool_size: int = 100
    temperature: float = 0.4
    num_ctx: int = 16384
    llm_type: str = "ollama"
    output_format: str = "terminal"  # terminal, json
    mode: str = "fast"  # fast or pro — controls model preset
    supports_json_mode: bool = True  # some models don't support response_format
    use_planning: bool = False  # use user's Planning list as candidates
    export_data: bytes | None = None  # raw uploaded list export (MAL XML or .xml.gz)
    taste_profile: str | None = None  # request-local profile; None loads profile_path
    api_key: str | None = None  # request-local model credential
    mal_client_id: str | None = None  # request-local MAL credential
    excluded_titles: tuple[str, ...] = ()  # optional titles to exclude from candidates


# Default API base URLs for each backend.
DEFAULT_URLS: dict[str, str] = {
    "ollama": "http://localhost:11434",
    "lmstudio": "http://localhost:1234",
    "openai": "https://api.openai.com",
    "openwebui": "http://localhost:3000",
    "anthropic": "https://api.anthropic.com",
    "gemini": "https://generativelanguage.googleapis.com",
    "deepseek": "https://api.deepseek.com",
    "openrouter": "https://openrouter.ai/api",
    "groq": "https://api.groq.com/openai",
    "together": "https://api.together.xyz",
}


# Model presets for fast/pro modes. supports_json controls whether we ask the
# backend for guaranteed JSON output (response_format). Some backends/models
# (e.g. DeepSeek reasoner, Anthropic, certain aggregator routes) need looser
# parsing instead.
MODEL_PRESETS: dict[str, dict[str, str]] = {
    # Local
    "ollama-fast": {"model": "qwen3:8b", "supports_json": "true"},
    "ollama-pro": {"model": "qwen3:14b", "supports_json": "true"},
    "lmstudio-fast": {"model": "qwen3-8b", "supports_json": "true"},
    "lmstudio-pro": {"model": "qwen3-14b", "supports_json": "true"},
    # OpenAI
    "openai-fast": {"model": "gpt-5-mini", "supports_json": "true"},
    "openai-pro": {"model": "gpt-5", "supports_json": "true"},
    # OpenWebUI can front models with different structured-output support.
    "openwebui-fast": {"model": "qwen3:8b", "supports_json": "false"},
    "openwebui-pro": {"model": "qwen3:14b", "supports_json": "false"},
    # Anthropic
    "anthropic-fast": {"model": "claude-haiku-5-5", "supports_json": "false"},
    "anthropic-pro": {"model": "claude-sonnet-5-5", "supports_json": "false"},
    # Google
    "gemini-fast": {"model": "gemini-3.8-flash", "supports_json": "true"},
    "gemini-pro": {"model": "gemini-4-hydrogen", "supports_json": "true"},
    # DeepSeek
    "deepseek-fast": {"model": "deepseek-flash", "supports_json": "true"},
    "deepseek-pro": {"model": "deepseek-v4-pro", "supports_json": "true"},
    # Aggregators (OpenAI-compatible)
    "openrouter-fast": {"model": "openai/gpt-5-mini", "supports_json": "true"},
    "openrouter-pro": {"model": "anthropic/claude-sonnet-5.5", "supports_json": "false"},
    "groq-fast": {"model": "llama-3.3-70b-versatile", "supports_json": "true"},
    "groq-pro": {"model": "qwen/qwen3-32b", "supports_json": "false"},
    "together-fast": {"model": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "supports_json": "true"},
    "together-pro": {"model": "deepseek-ai/DeepSeek-R1", "supports_json": "false"},
}

# Models the CLI/API treat as default sentinels and replace with the chosen
# backend's Fast/Pro preset model.
DEFAULT_MODEL_SENTINELS = {"qwen3:8b", "qwen3:14b", "qwen2.5:7b", "qwen2.5:14b"}


def _infer_supports_json(llm_type: str, model: str, fallback: bool) -> bool:
    """Infer whether response_format JSON mode is safe for an explicit model."""
    if llm_type in {"anthropic", "openwebui"}:
        return False
    low = model.lower()
    if any(tok in low for tok in ("anthropic/", "claude-", "deepseek-reasoner", "deepseek-r1")):
        return False
    if llm_type == "openrouter":
        return fallback and "/" in low and not low.startswith(("anthropic/", "meta-llama/"))
    return fallback


def resolve_model_preset(
    url: str,
    llm_type: str,
    model: str,
    mode: str,
) -> tuple[str, str, str, bool]:
    """Resolve a (url, llm_type, model, supports_json) tuple from the chosen preset.

    - If `url` is the Ollama default, substitute the canonical URL for the backend.
    - If `model` is a default sentinel or blank, substitute the preset's model.
    - `supports_json` adapts cleanly for explicit/custom model IDs.
    """
    if url == "http://localhost:11434" and llm_type in DEFAULT_URLS:
        url = DEFAULT_URLS[llm_type]

    key = f"{llm_type}-{mode}"
    preset = MODEL_PRESETS.get(key)
    if preset is None:
        return url, llm_type, model, True

    cleaned_model = model.strip()
    is_sentinel = not cleaned_model or cleaned_model in DEFAULT_MODEL_SENTINELS
    resolved_model = preset["model"] if is_sentinel else cleaned_model
    preset_supports_json = preset["supports_json"] == "true"
    supports_json = (
        preset_supports_json
        if is_sentinel
        else _infer_supports_json(llm_type, resolved_model, preset_supports_json)
    )
    return url, llm_type, resolved_model, supports_json
