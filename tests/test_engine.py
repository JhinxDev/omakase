"""Tests for the LLM response parser."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import omakase.engine as engine
from omakase.engine import (
    EmptyHistoryError,
    _exclude_feedback_candidates,
    _parse_recommendations,
    _resolve_rec_urls,
)
from omakase.types import MediaItem, OmakaseConfig, Recommendation, SourceData

SAMPLE_JSON = """
{"recommendations": [
  {"title": "Vinland Saga", "predicted_score": 9, "reasoning": "Morally complex protagonist, dense world-building.", "best_match_from_history": "Berserk"},
  {"title": "Mushishi", "predicted_score": 8, "reasoning": "Quiet, atmospheric pacing.", "best_match_from_history": "Natsume's Book of Friends"}
]}
"""


def test_parses_clean_json():
    recs = _parse_recommendations(SAMPLE_JSON)
    assert len(recs) == 2
    assert recs[0].title == "Vinland Saga"
    assert recs[0].predicted_score == 9.0
    assert "Berserk" in recs[0].best_match_from_history


def test_strips_markdown_code_fences():
    wrapped = "```json\n" + SAMPLE_JSON.strip() + "\n```"
    recs = _parse_recommendations(wrapped)
    assert len(recs) == 2


def test_strips_leading_and_trailing_prose():
    noisy = "Here are your picks:\n" + SAMPLE_JSON.strip() + "\nHope you enjoy!"
    recs = _parse_recommendations(noisy)
    assert len(recs) == 2


def test_returns_empty_on_invalid_json_without_logging_model_output(capsys):
    recs = _parse_recommendations("PRIVATE TASTE MARKER: not json at all")
    assert recs == []
    captured = capsys.readouterr()
    assert "Failed to parse LLM output" in captured.err
    assert "PRIVATE TASTE MARKER" not in captured.err


def test_handles_missing_fields_gracefully():
    raw = '{"recommendations": [{"title": "Made in Abyss"}]}'
    recs = _parse_recommendations(raw)
    assert len(recs) == 1
    assert recs[0].title == "Made in Abyss"
    assert recs[0].predicted_score == 0.0
    assert recs[0].reasoning == ""


def _rec(title: str) -> Recommendation:
    return Recommendation(
        title=title,
        predicted_score=8.0,
        reasoning="",
        best_match_from_history="",
    )


def test_resolve_urls_anilist_permalink_on_title_match():
    candidates = [
        MediaItem(id=21, title_romaji="One Piece", title_english="One Piece"),
        MediaItem(id=99, title_romaji="Vinland Saga", title_english="Vinland Saga"),
    ]
    recs = [_rec("Vinland Saga")]
    _resolve_rec_urls(recs, candidates, "anilist")
    assert recs[0].source == "anilist"
    assert recs[0].url == "https://anilist.co/anime/99/"


def test_resolve_urls_mal_permalink_on_title_match():
    candidates = [
        MediaItem(
            id=5114,
            title_romaji="Hagane no Renkinjutsushi",
            title_english="Fullmetal Alchemist: Brotherhood",
        ),
    ]
    recs = [_rec("Fullmetal Alchemist: Brotherhood")]
    _resolve_rec_urls(recs, candidates, "myanimelist")
    assert recs[0].source == "myanimelist"
    assert recs[0].url == "https://myanimelist.net/anime/5114/"


def test_resolve_urls_falls_back_to_search_when_no_match():
    candidates = [MediaItem(id=1, title_romaji="Cowboy Bebop", title_english="Cowboy Bebop")]
    recs = [_rec("Some Obscure Title")]
    _resolve_rec_urls(recs, candidates, "anilist")
    assert recs[0].url is not None
    assert "anilist.co/search/anime" in recs[0].url
    assert "Some+Obscure+Title" in recs[0].url


def test_resolve_urls_match_is_case_insensitive_and_uses_romaji_too():
    candidates = [
        MediaItem(id=42, title_romaji="Shingeki no Kyojin", title_english="Attack on Titan"),
    ]
    recs_en = [_rec("attack on titan")]
    recs_ro = [_rec("Shingeki No Kyojin")]
    _resolve_rec_urls(recs_en, candidates, "anilist")
    _resolve_rec_urls(recs_ro, candidates, "anilist")
    assert recs_en[0].url == "https://anilist.co/anime/42/"
    assert recs_ro[0].url == "https://anilist.co/anime/42/"


def test_resolve_urls_enriches_allowlisted_cover_and_metadata():
    candidates = [
        MediaItem(
            id=154587,
            title_romaji="Sousou no Frieren",
            title_english="Frieren: Beyond Journey's End",
            genres=["Adventure", "Drama", "Fantasy"],
            format="TV",
            episodes=28,
            studio="Madhouse",
            mean_score=91,
            cover_image="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/154587.jpg",
            banner_image="https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg",
        ),
        MediaItem(
            id=999,
            title_romaji="Untrusted Host Show",
            title_english="Untrusted Host Show",
            cover_image="https://evil.example.invalid/poster.jpg",
            banner_image="https://evil.example.invalid/banner.jpg",
        ),
    ]
    recs = [_rec("Frieren: Beyond Journey's End"), _rec("Untrusted Host Show")]
    _resolve_rec_urls(recs, candidates, "anilist")
    assert recs[0].cover_image == (
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/154587.jpg"
    )
    assert recs[0].banner_image == (
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg"
    )
    assert recs[0].genres == ["Adventure", "Drama", "Fantasy"]
    assert recs[0].episodes == 28
    assert recs[0].format == "TV"
    assert recs[0].studio == "Madhouse"
    assert recs[0].mean_score == 91
    assert recs[1].cover_image is None
    assert recs[1].banner_image is None


def test_exclude_feedback_candidates_matches_english_and_romaji_titles():
    candidates = [
        MediaItem(id=1, title_romaji="Pluto", title_english="PLUTO"),
        MediaItem(id=2, title_romaji="Odd Taxi", title_english="ODDTAXI"),
        MediaItem(
            id=3,
            title_romaji="Kaguya-sama wa Kokurasetai",
            title_english="Kaguya-sama: Love is War",
        ),
    ]

    remaining = _exclude_feedback_candidates(
        candidates,
        ("pluto", "Kaguya sama Love is War"),
    )

    assert [item.title_romaji for item in remaining] == ["Odd Taxi"]


def test_run_stops_before_model_when_feedback_excludes_every_candidate(monkeypatch):
    source_data = SourceData(
        username="member",
        history=[MediaItem(id=10, title_romaji="Monster", score=9)],
        candidates=[MediaItem(id=20, title_romaji="Pluto")],
        source_name="anilist",
    )
    adapter = SimpleNamespace(fetch=lambda *_args, **_kwargs: source_data)
    monkeypatch.setattr(engine, "get_adapter", lambda _source: adapter)
    monkeypatch.setattr(
        engine,
        "get_llm",
        lambda *_args, **_kwargs: pytest.fail("the model must not be called"),
    )
    config = OmakaseConfig(
        source="anilist",
        username="member",
        llm_url="https://api.deepseek.com",
        model="deepseek-v4-pro",
        profile_path="",
        llm_type="deepseek",
        excluded_titles=("PLUTO",),
    )

    with pytest.raises(EmptyHistoryError, match="feedback history"):
        engine.run(config)
