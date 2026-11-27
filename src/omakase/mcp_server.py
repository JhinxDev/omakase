"""Zero-dependency stdio Model Context Protocol (MCP) server for Omakase."""

from __future__ import annotations

import contextlib
import io
import json
import sys
from typing import Any, TextIO

from omakase import __version__
from omakase.adapters.base import list_sources
from omakase.engine import EmptyHistoryError, RecommendationOutputError
from omakase.engine import run as run_pipeline
from omakase.llm import list_backends
from omakase.llm.catalog import (
    PROVIDER_CATALOG,
    ModelDiscoveryError,
    discover_provider_models,
    serialize_provider_catalog,
)
from omakase.types import DEFAULT_URLS, MODEL_PRESETS, OmakaseConfig, resolve_model_preset

PROTOCOL_VERSION = "2024-11-05"

TOOLS: list[dict[str, Any]] = [
    {
        "name": "omakase_list_sources",
        "description": "List supported anime watch-history data sources.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "omakase_list_backends",
        "description": "List supported LLM backends, default endpoints, starter models, and presets.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "omakase_list_models",
        "description": "Discover live chat and reasoning models available from a provider.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "llm_type": {
                    "type": "string",
                    "description": "Provider name (openai, anthropic, gemini, deepseek, openrouter, openwebui, ollama, lmstudio, groq, together).",
                },
                "llm_url": {
                    "type": "string",
                    "description": "Optional base URL override (required for openwebui).",
                },
            },
            "required": ["llm_type"],
            "additionalProperties": False,
        },
    },
    {
        "name": "omakase_recommend",
        "description": (
            "Generate personalized anime recommendations from a public AniList or MyAnimeList "
            "watch history using the configured local or cloud LLM."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {"type": "string", "description": "Source username."},
                "source": {
                    "type": "string",
                    "enum": ["anilist", "myanimelist"],
                    "default": "anilist",
                },
                "llm_type": {
                    "type": "string",
                    "default": "ollama",
                    "description": "LLM backend name (e.g. ollama, openai, anthropic, gemini, deepseek).",
                },
                "mode": {"type": "string", "enum": ["fast", "pro"], "default": "fast"},
                "model": {"type": "string", "description": "Optional explicit model override."},
                "llm_url": {"type": "string", "description": "Optional backend base URL override."},
                "taste_profile": {
                    "type": "string",
                    "default": "",
                    "description": "Optional markdown taste notes.",
                },
                "use_planning": {"type": "boolean", "default": False},
                "candidate_pool_size": {
                    "type": "integer",
                    "minimum": 10,
                    "maximum": 250,
                    "default": 100,
                },
            },
            "required": ["username"],
            "additionalProperties": False,
        },
    },
]


def _jsonrpc_result(req_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _jsonrpc_error(req_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _tool_text(payload: Any, *, is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "isError": is_error,
    }


def _call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "omakase_list_sources":
        return _tool_text({"sources": list_sources()})

    if name == "omakase_list_backends":
        return _tool_text(
            {
                "backends": list_backends(),
                "default_urls": DEFAULT_URLS,
                "presets": MODEL_PRESETS,
                "providers": serialize_provider_catalog(),
            }
        )

    if name == "omakase_list_models":
        llm_type = str(arguments.get("llm_type") or "").strip().lower()
        if llm_type not in PROVIDER_CATALOG:
            return _tool_text({"error": f"Unknown llm_type: {llm_type}"}, is_error=True)
        raw_url = str(arguments.get("llm_url") or DEFAULT_URLS.get(llm_type, "")).strip()
        try:
            return _tool_text(discover_provider_models(llm_type, raw_url))
        except ModelDiscoveryError as exc:
            return _tool_text({"error": exc.detail}, is_error=True)

    if name == "omakase_recommend":
        username = str(arguments.get("username") or "").strip()
        if not username:
            return _tool_text({"error": "username is required"}, is_error=True)

        source = str(arguments.get("source") or "anilist").strip()
        if source not in list_sources():
            return _tool_text({"error": f"Unknown source: {source}"}, is_error=True)

        llm_type = str(arguments.get("llm_type") or "ollama").strip()
        if llm_type not in list_backends():
            return _tool_text({"error": f"Unknown llm_type: {llm_type}"}, is_error=True)

        mode = str(arguments.get("mode") or "fast").strip()
        if mode not in {"fast", "pro"}:
            return _tool_text({"error": "mode must be 'fast' or 'pro'"}, is_error=True)

        raw_url = str(arguments.get("llm_url") or DEFAULT_URLS["ollama"]).strip()
        raw_model = str(arguments.get("model") or "qwen3:8b").strip()
        llm_url, llm_type, model, supports_json = resolve_model_preset(
            raw_url, llm_type, raw_model, mode
        )
        pool_size = int(arguments.get("candidate_pool_size") or 100)
        pool_size = max(10, min(250, pool_size))

        cfg = OmakaseConfig(
            source=source,
            username=username,
            llm_url=llm_url,
            model=model,
            profile_path="",
            candidate_pool_size=pool_size,
            llm_type=llm_type,
            output_format="json",
            mode=mode,
            supports_json_mode=supports_json,
            use_planning=bool(arguments.get("use_planning", False)),
            taste_profile=str(arguments.get("taste_profile") or ""),
        )

        # Keep MCP stdout strictly clean JSON-RPC by redirecting engine progress logs.
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                recs = run_pipeline(cfg)
        except (EmptyHistoryError, RecommendationOutputError, ValueError) as exc:
            return _tool_text({"error": str(exc)}, is_error=True)
        except Exception as exc:
            return _tool_text(
                {"error": f"Recommendation failed: {type(exc).__name__}"}, is_error=True
            )

        return _tool_text(
            {
                "source": source,
                "username": username,
                "llm_type": llm_type,
                "model": model,
                "recommendations": [
                    {
                        "title": r.title,
                        "predicted_score": r.predicted_score,
                        "reasoning": r.reasoning,
                        "best_match_from_history": r.best_match_from_history,
                        "url": r.url,
                        "source": r.source,
                        "cover_image": r.cover_image,
                        "banner_image": r.banner_image,
                        "genres": r.genres,
                        "episodes": r.episodes,
                        "format": r.format,
                        "studio": r.studio,
                        "mean_score": r.mean_score,
                    }
                    for r in recs
                ],
            }
        )

    return _tool_text({"error": f"Unknown tool: {name}"}, is_error=True)


def handle_message(msg: dict[str, Any]) -> dict[str, Any] | None:
    """Process one JSON-RPC request/notification and return a response dict (or None)."""
    method = msg.get("method")
    req_id = msg.get("id")

    if method == "notifications/initialized":
        return None
    if req_id is None:
        return None

    if method == "initialize":
        return _jsonrpc_result(
            req_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "omakase", "version": __version__},
            },
        )
    if method == "ping":
        return _jsonrpc_result(req_id, {})
    if method == "tools/list":
        return _jsonrpc_result(req_id, {"tools": TOOLS})
    if method == "tools/call":
        params = msg.get("params") or {}
        if not isinstance(params, dict):
            return _jsonrpc_error(req_id, -32602, "Invalid params")
        name = str(params.get("name") or "")
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            return _jsonrpc_error(req_id, -32602, "Tool arguments must be an object")
        return _jsonrpc_result(req_id, _call_tool(name, arguments))

    return _jsonrpc_error(req_id, -32601, f"Method not found: {method}")


def serve_stdio(stdin: TextIO | None = None, stdout: TextIO | None = None) -> None:
    """Run the newline-delimited JSON-RPC stdio loop."""
    in_stream = stdin or sys.stdin
    out_stream = stdout or sys.stdout

    for line in in_stream:
        raw = line.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            resp = _jsonrpc_error(None, -32700, "Parse error")
            out_stream.write(json.dumps(resp) + "\n")
            out_stream.flush()
            continue

        if not isinstance(msg, dict):
            resp = _jsonrpc_error(None, -32600, "Invalid Request")
            out_stream.write(json.dumps(resp) + "\n")
            out_stream.flush()
            continue

        resp = handle_message(msg)
        if resp is not None:
            out_stream.write(json.dumps(resp) + "\n")
            out_stream.flush()
