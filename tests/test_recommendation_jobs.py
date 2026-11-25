from __future__ import annotations

import time
from io import BytesIO
from threading import Event
from urllib.error import HTTPError

from fastapi.testclient import TestClient

from omakase.types import Recommendation
from omakase.web import server


def _client(monkeypatch) -> TestClient:
    monkeypatch.setenv("OMAKASE_PUBLIC_HOSTED", "true")
    server.reset_rate_limits()
    server.reset_recommendation_jobs()
    return TestClient(server.app, base_url="https://omakase.example")


def _payload(**overrides):
    payload = {
        "llm_type": "deepseek",
        "llm_url": "https://api.deepseek.com",
        "api_key": "request-only-secret",
        "model": "deepseek-v4-pro",
        "source": "anilist",
        "username": "friend",
        "profile": "Patient mysteries and earned character arcs.",
        "mode": "pro",
        "use_planning": False,
        "skip_profile": False,
        "mal_export_b64": "",
        "mal_client_id": "",
    }
    payload.update(overrides)
    return payload


def _poll_until_terminal(client: TestClient, job_id: str) -> dict:
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        response = client.get(f"/api/recommend/jobs/{job_id}")
        assert response.status_code == 200
        data = response.json()
        if data["status"] in {"done", "error", "cancelled"}:
            return data
        time.sleep(0.01)
    raise AssertionError("recommendation job did not finish")


def test_hosted_deepseek_pro_runs_as_background_job_and_forgets_key(monkeypatch):
    client = _client(monkeypatch)
    captured = {}

    def fake_pipeline(cfg):
        captured["model"] = cfg.model
        captured["key"] = cfg.api_key
        return [
            Recommendation(
                title="Monster",
                predicted_score=9.2,
                reasoning="A patient psychological mystery.",
                best_match_from_history="Pluto",
                url="https://anilist.co/anime/19",
                source="anilist",
            )
        ]

    monkeypatch.setattr(server, "run_pipeline", fake_pipeline)
    response = client.post("/api/recommend/jobs", json=_payload())

    assert response.status_code == 202
    result = _poll_until_terminal(client, response.json()["job_id"])
    assert result["status"] == "done"
    assert result["recommendations"][0]["title"] == "Monster"
    assert "account_saved" not in result
    assert captured == {"model": "deepseek-v4-pro", "key": "request-only-secret"}
    assert "request-only-secret" not in server.recommendation_jobs_debug_snapshot()


def test_anilist_user_not_found_job_returns_actionable_error(monkeypatch):
    client = _client(monkeypatch)

    def missing_anilist_user(_cfg):
        raise HTTPError(
            "https://graphql.anilist.co",
            404,
            "Not Found",
            {},
            BytesIO(b'{"errors":[{"message":"User not found","status":404}]}'),
        )

    monkeypatch.setattr(server, "run_pipeline", missing_anilist_user)
    response = client.post("/api/recommend/jobs", json=_payload(username="missing-user"))

    assert response.status_code == 202
    result = _poll_until_terminal(client, response.json()["job_id"])
    assert result["status"] == "error"
    assert result["status_code"] == 400
    assert result["detail"] == (
        "AniList could not find that user. Check the username and make sure "
        "the anime list is public."
    )
    assert "key" not in result["detail"].lower()


def test_job_capacity_is_bounded(monkeypatch):
    client = _client(monkeypatch)
    release = Event()

    def blocked_pipeline(_cfg):
        release.wait(timeout=2)
        return []

    monkeypatch.setattr(server, "run_pipeline", blocked_pipeline)
    try:
        started = [
            client.post(
                "/api/recommend/jobs",
                json=_payload(username=f"friend-{index}"),
            )
            for index in range(3)
        ]
        assert [response.status_code for response in started] == [202, 202, 202]
        overflow = client.post(
            "/api/recommend/jobs",
            json=_payload(username="one-too-many"),
        )
        assert overflow.status_code == 429
        assert "counter is full" in overflow.json()["detail"]
    finally:
        release.set()


def test_job_rate_limit_blocks_excess_requests(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(server, "run_pipeline", lambda _cfg: [])

    for index in range(10):
        resp = client.post("/api/recommend/jobs", json=_payload(username=f"viewer-{index}"))
        assert resp.status_code == 202
        _poll_until_terminal(client, resp.json()["job_id"])

    limited = client.post("/api/recommend/jobs", json=_payload(username="viewer-11"))
    assert limited.status_code == 429
    assert "Too many recommendation requests" in limited.json()["detail"]


def test_cancelled_job_marks_status_cancelled(monkeypatch):
    client = _client(monkeypatch)
    release = Event()

    def blocked_pipeline(_cfg):
        release.wait(timeout=2)
        return [
            Recommendation(
                title="Should Not Finish",
                predicted_score=8,
                reasoning="Cancelled result",
                best_match_from_history="None",
            )
        ]

    monkeypatch.setattr(server, "run_pipeline", blocked_pipeline)
    started = client.post("/api/recommend/jobs", json=_payload())
    job_id = started.json()["job_id"]
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        if client.get(f"/api/recommend/jobs/{job_id}").json()["status"] == "running":
            break
        time.sleep(0.01)
    assert client.delete(f"/api/recommend/jobs/{job_id}").json()["status"] == "cancelled"
    release.set()
    time.sleep(0.05)
    assert client.get(f"/api/recommend/jobs/{job_id}").json()["status"] == "cancelled"


def test_expired_job_receipt_is_pruned(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(server, "run_pipeline", lambda _cfg: [])
    started = client.post("/api/recommend/jobs", json=_payload())
    job_id = started.json()["job_id"]
    assert _poll_until_terminal(client, job_id)["status"] == "done"

    with server._job_lock:
        server._recommendation_jobs[job_id]["updated_at"] = (
            time.monotonic() - server._JOB_TTL_SECONDS - 1
        )
    assert client.get(f"/api/recommend/jobs/{job_id}").status_code == 404
