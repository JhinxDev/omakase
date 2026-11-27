# Changelog

All notable changes to Omakase are documented in this file.

## Unreleased

## 2.0.0 - 2026-11-27

- **Midnight Izakaya Atelier UI**: complete redesign of the public counter and tasting menu onto a warm charcoal lacquer (`#0B0A0C`) and lantern amber (`#E2A35E`) visual system with self-hosted `Fraunces` display + `Geist` UI typography, crisp inline SVG provider and list-source logos, a live preparation tasting slip, taste-note starter chips, and one-click Markdown menu copy.
- **Live provider model discovery & custom model selection**: replaced the static Quick/Deep toggle with `POST /api/providers/models` live `/models` querying across OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter (including public browsing and `:free` filtering), and allowlisted OpenWebUI hubs, paired with speed/reasoning/free tier filters, search, and freeform custom model IDs.
- **CLI & MCP parity + resilient parsing**: added `omakase models` and `omakase_list_models`, updated model presets (`claude-haiku-5-5`, `claude-sonnet-5-5`, `deepseek-flash`, `gpt-5-mini`, `gemini-3.8-flash`), added automatic HTTP 400 fallback retries in OpenAI/Gemini clients, stripped `<think>` reasoning blocks in `engine._parse_recommendations`, and added transient retries to the AniList adapter.

## 1.0.1 - 2026-11-26

- **Container packaging & CI gate**: add a `Docker build` check to `.github/workflows/ci.yml`, publish multi-tag container images to `ghcr.io/jhinxdev/omakase` on `main` pushes and `v*` tags via `.github/workflows/docker-publish.yml`, and point `compose.yaml` to the prebuilt GHCR image by default.
- **Automated GitHub Releases**: add `scripts/github_release_notes.py`, release-metadata unit tests (`tests/test_release_tooling.py`), and `.github/workflows/release.yml` so every `vX.Y.Z` tag validates `pyproject.toml`, `src/omakase/__init__.py`, `uv.lock`, and `CHANGELOG.md` before publishing.
- **Maintenance**: upgrade GitHub Actions workflows off deprecated Node 20 runners and add Dependabot for `pip` and `github-actions`.

## 1.0.0 - 2026-11-25

- Stateless Bring-Your-Own-Key (BYOK) rework with Carbon Obsidian + Iris Atelier UI, late-2026 model presets (GPT-5, Gemini 3.8 Flash / 4 Hydrogen, Claude 4.5 / 4.6, DeepSeek V4, Qwen3, OpenRouter, OpenWebUI), hardened HTTP clients, and stdio MCP server (`omakase mcp`).
