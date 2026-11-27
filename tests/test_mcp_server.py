"""Tests for the zero-dependency stdio MCP server."""

from __future__ import annotations

import io
import json

from omakase import __version__
from omakase.mcp_server import handle_message, serve_stdio
from omakase.types import Recommendation


def test_mcp_initialize_ping_and_list_tools():
    init = handle_message({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
    assert init is not None
    assert init["result"]["serverInfo"] == {"name": "omakase", "version": __version__}

    assert handle_message({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None

    ping = handle_message({"jsonrpc": "2.0", "id": 2, "method": "ping"})
    assert ping == {"jsonrpc": "2.0", "id": 2, "result": {}}

    listed = handle_message({"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
    assert listed is not None
    names = {tool["name"] for tool in listed["result"]["tools"]}
    assert names == {
        "omakase_list_sources",
        "omakase_list_backends",
        "omakase_list_models",
        "omakase_recommend",
    }


def test_mcp_list_sources_and_backends():
    src_resp = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/call",
            "params": {"name": "omakase_list_sources", "arguments": {}},
        }
    )
    assert src_resp is not None
    src_payload = json.loads(src_resp["result"]["content"][0]["text"])
    assert set(src_payload["sources"]) == {"anilist", "myanimelist"}

    backend_resp = handle_message(
        {
            "jsonrpc": "2.0",
            "id": 11,
            "method": "tools/call",
            "params": {"name": "omakase_list_backends", "arguments": {}},
        }
    )
    assert backend_resp is not None
    backend_payload = json.loads(backend_resp["result"]["content"][0]["text"])
    assert "openai" in backend_payload["backends"]
    assert backend_payload["presets"]["openai-fast"]["model"] == "gpt-6-luna"


def test_mcp_recommend_calls_pipeline_and_returns_enriched_json(monkeypatch):
    def fake_run(cfg):
        assert cfg.username == "demo-user"
        assert cfg.llm_type == "openai"
        assert cfg.model == "gpt-6-luna"
        return [
            Recommendation(
                title="Mushishi",
                predicted_score=9.4,
                reasoning="Atmospheric episodic mystery.",
                best_match_from_history="Kino's Journey",
                url="https://anilist.co/anime/457/",
                source="anilist",
                cover_image="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/457.jpg",
                genres=["Adventure", "Fantasy", "Mystery"],
                episodes=26,
                format="TV",
                studio="Artland",
                mean_score=85,
            )
        ]

    monkeypatch.setattr("omakase.mcp_server.run_pipeline", fake_run)

    stdin = io.StringIO(
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": 20,
                "method": "tools/call",
                "params": {
                    "name": "omakase_recommend",
                    "arguments": {
                        "username": "demo-user",
                        "llm_type": "openai",
                        "mode": "fast",
                    },
                },
            }
        )
        + "\n"
    )
    stdout = io.StringIO()
    serve_stdio(stdin=stdin, stdout=stdout)

    line = stdout.getvalue().strip()
    resp = json.loads(line)
    assert resp["id"] == 20
    assert resp["result"]["isError"] is False
    payload = json.loads(resp["result"]["content"][0]["text"])
    rec = payload["recommendations"][0]
    assert rec["title"] == "Mushishi"
    assert rec["studio"] == "Artland"
    assert rec["episodes"] == 26
