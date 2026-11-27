# Omakase — Agent & Contributor Instructions

Stateless Bring-Your-Own-Key (BYOK) anime sommelier with a Python/FastAPI web counter, CLI, and stdio MCP server (`omakase mcp`). Read `README.md`, `CONTRIBUTING.md`, and `DESIGN.md` before changing the application.

## Stack & Layout

- **Runtime:** Python 3.10+, FastAPI, Jinja2 (Carbon Obsidian `#09090B` + Iris Atelier `#A78BFA`, self-hosted Geist font), locked via `uv.lock`.
- **Layout:** `src/` (CLI, FastAPI app, LLM adapters, MCP server), `tests/`, `docs/`, `scripts/`.
- **Stateless BYOK:** Zero user accounts, zero database, and zero stored provider keys.

## Verify & Run Commands

```powershell
uv sync --frozen --extra dev
uv run --frozen --extra dev pytest
uv run --frozen --extra dev ruff check .
uv run --frozen --extra dev ruff format --check .
```

## Active Skills & Tools

- **Web UI & Quality:** `modern-web-guidance`, `hallmark`, `playwright`.
- **MCP & Engineering:** `mcp-builder`, `security-audit`, `gh-fix-ci`, `gh-address-comments`, `humanizer`.

## Guardrails & Security

- Keep `omakase` strictly stateless and Bring-Your-Own-Key; never store provider keys, add user accounts, or introduce a persistent database.
- Keep HTTP clients hardened (header-based keys where supported, `follow_redirects=False`, bounded timeouts).
- Never commit secrets, personal screenshots, or private homelab addresses. Follow `SECURITY.md` and `LICENSE`.
- Verify UI changes at desktop and mobile viewports against `DESIGN.md`, including keyboard focus and `prefers-reduced-motion`.

## Release & Deploy

- Bump SemVer across manifests and `uv.lock`, update `CHANGELOG.md`, merge via green PR CI into `main`, and push an annotated `vX.Y.Z` tag for automated GitHub Releases and GHCR image publishing.
