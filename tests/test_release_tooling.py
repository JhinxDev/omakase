"""Tests for Omakase release tag verification and changelog extraction."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "github_release_notes.py"

spec = importlib.util.spec_from_file_location("github_release_notes", SCRIPT_PATH)
assert spec is not None and spec.loader is not None
release_notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_notes)


def test_current_repo_versions_match_changelog() -> None:
    versions = release_notes.read_repo_versions(REPO_ROOT)
    assert len(set(versions.values())) == 1
    version = next(iter(versions.values()))
    tag = f"v{version}"

    notes = release_notes.build_release_notes(tag, REPO_ROOT)
    assert f"docker pull ghcr.io/jhinxdev/omakase:{version}" in notes
    assert "docker pull ghcr.io/jhinxdev/omakase:latest" in notes


def test_parse_and_extract_reject_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="vMAJOR.MINOR.PATCH"):
        release_notes.parse_release_tag("1.0.1")

    with pytest.raises(ValueError, match="no section"):
        release_notes.extract_changelog_section("## 1.0.0\n\n- Initial\n", "9.9.9")

    with pytest.raises(ValueError, match="empty"):
        release_notes.extract_changelog_section("## 9.9.9\n\n## 1.0.0\n- x\n", "9.9.9")


def test_verify_tag_detects_version_mismatch(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "omakase"\nversion = "1.2.3"\n', encoding="utf-8"
    )
    (tmp_path / "src" / "omakase").mkdir(parents=True)
    (tmp_path / "src" / "omakase" / "__init__.py").write_text(
        '__version__ = "1.2.3"\n', encoding="utf-8"
    )
    (tmp_path / "uv.lock").write_text(
        '[[package]]\nname = "omakase"\nversion = "1.2.0"\n', encoding="utf-8"
    )

    with pytest.raises(ValueError, match="uv.lock=1.2.0"):
        release_notes.verify_tag_matches_repo("v1.2.3", tmp_path)
