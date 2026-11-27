# Changelog

All notable changes to Omakase are documented in this file.

## Unreleased

## 2.2.0 - 2026-11-27

- **Evergreen live model discovery without hardcoded UI models**: removed all hardcoded model names, versioned provider subtitles, and static starter lists from the web UI and `/api/backends` catalog; direct providers now guide guests to paste their key to load live `/models` (or type any model ID), OpenRouter auto-loads its public catalog without pinning stale models, and live discovery sorts purely dynamically by newest `created` timestamp and semantic version descending.
- **Clean Field Guide & cache-busted brand assets**: replaced the stretched `<details>` FAQ grid in `#field-guide` with a balanced always-visible 2x2 card layout, and appended `?v={{ asset_version }}` to `/static/omakase-mark.svg`, `/static/favicon.svg`, and `/static/generated/omakase-atelier.webp` so browser caches immediately pick up the warm amber brand mark.
- **Repository & dependency hygiene**: consolidated open Dependabot requirement bumps (`click>=8.5.1`, `rich>=15.0.0`, `ruff>=0.17.6`), switched Dependabot to monthly grouped PRs, and removed legacy `.coderabbit.yaml`.

## 2.1.0 - 2026-11-27

- **Real colored brand logos**: replaced generic line icons with bundled local official brand SVGs (`openai.svg`, `anthropic.svg`, `gemini.svg`, `deepseek.svg`, `openrouter.svg`, `openwebui.svg`, `anilist.svg`, `myanimelist.svg`) inside tinted brand badges.
- **Anime banners & prominent poster cards**: enriched AniList candidate queries and best-effort artwork backfill with `bannerImage` and `extraLarge` `coverImage`, and redesigned result cards with atmospheric top banner backdrops, overlaid pick/score badges, and prominent overlapping anime posters.
- **Current late-2026 model lineup & live catalog cleanup**: updated curated defaults to `gpt-6-luna` / `gpt-6.2-sol` / `gpt-6.2-astra`, `claude-haiku-5-5` / `claude-sonnet-5-5` / `claude-opus-5-5` / `claude-fable-5-2`, `gemini-3.8-flash` / `gemini-4-hydrogen` / `gemini-4-neon`, and `deepseek-flash` / `deepseek-v4-pro`; stripped `:batch` endpoints from OpenRouter discovery and sorted live catalogs by newest `created` timestamp first.

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
