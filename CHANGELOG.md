# Changelog

All notable changes to Omakase are documented in this file.

## Unreleased

## 1.0.1 - 2026-11-26

- **Container packaging & CI gate**: add a `Docker build` check to `.github/workflows/ci.yml`, publish multi-tag container images to `ghcr.io/jhinxdev/omakase` on `main` pushes and `v*` tags via `.github/workflows/docker-publish.yml`, and point `compose.yaml` to the prebuilt GHCR image by default.
- **Automated GitHub Releases**: add `scripts/github_release_notes.py`, release-metadata unit tests (`tests/test_release_tooling.py`), and `.github/workflows/release.yml` so every `vX.Y.Z` tag validates `pyproject.toml`, `src/omakase/__init__.py`, `uv.lock`, and `CHANGELOG.md` before publishing.
- **Maintenance**: upgrade GitHub Actions workflows off deprecated Node 20 runners and add Dependabot for `pip` and `github-actions`.

## 1.0.0 - 2026-11-25

- Stateless Bring-Your-Own-Key (BYOK) rework with Carbon Obsidian + Iris Atelier UI, late-2026 model presets (GPT-5, Gemini 3.8 Flash / 4 Hydrogen, Claude 4.5 / 4.6, DeepSeek V4, Qwen3, OpenRouter, OpenWebUI), hardened HTTP clients, and stdio MCP server (`omakase mcp`).
