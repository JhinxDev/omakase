# Public Omakase design contract (v2.1.0: Midnight Izakaya Atelier)

Updated November 27, 2026: added bundled real colored official brand logos (`src/omakase/web/static/logos/`), anime banner + overlapping poster cards, and current late-2026 model presets (`gpt-6-luna` / `gpt-6.2-sol` / `gpt-6.2-astra`, `claude-haiku-5-5` / `claude-sonnet-5-5` / `claude-opus-5-5` / `claude-fable-5-2`, `gemini-3.8-flash` / `gemini-4-hydrogen` / `gemini-4-neon`, `deepseek-flash` / `deepseek-v4-pro`).

## Tokens & Typography

- Canvas `#0B0A0C` (charcoal lacquer), counter surface `#131115`, elevated surface `#1B181F`, hover `#231F28`, hairline borders `rgba(245, 239, 230, 0.09)` / `0.17`, warm parchment ink `#F5EFE6` / `#C8BEB0` / `#9A8F82`, lantern amber accent `#E2A35E` (`#F0C28A` focus), vermilion seal `#E05A47`, semantic green `#5FD39E`, semantic error `#F87171`.
- Self-hosted typography with zero external font calls (`font-src 'self'`): `Fraunces` display (`fraunces-400.woff2`, `fraunces-400-italic.woff2`, `fraunces-500.woff2`, SIL OFL 1.1) paired with `Geist` variable UI/body (`geist-variable.woff2`).
- Official colored local vector logos in `src/omakase/web/static/logos/` (`openai.svg`, `anthropic.svg`, `gemini.svg`, `deepseek.svg`, `openrouter.svg`, `openwebui.svg`, `anilist.svg`, `myanimelist.svg`) paired with `1.75px`-stroke UI icons and zero external CDN requests.

## Counter, Live Model Discovery & Result Menu

- Three explicit courses: Model (colored provider logos, request-local API key, live `/api/providers/models` catalog with `All / Fast / Balanced / Reasoning / Free` filter pills, search, and custom model ID), History (AniList username or in-memory MyAnimeList XML/GZ export, optional Plan to Watch filter), and Taste (clickable starter chips, notes, or scores-only toggle).
- Sticky Tasting Slip (`menu_receipt.js`) mirrors current provider, model, key status, history, taste brief, and scope in memory without persistence or secret exposure.
- Returned tasting menu cards (`.recommendation`) feature an atmospheric anime banner backdrop (falling back to a soft blurred poster wash when no banner exists), an overlapping prominent anime poster (`116x168px` desktop, `s4.anilist.co` / `cdn.myanimelist.net` allowlisted in backend + CSP), Fraunces title, format/episode/studio/genre badges, reasoning, history pairing, predicted fit badge, side-by-side compare (`Compare this pick` up to 2 items), and Markdown copy (`Copy menu`).
- All guest API keys, watch history, and taste notes remain strictly request-local: held in memory for one request, cleared from the browser input on menu completion, and scrubbed in backend `finally` cleanup without accounts, cookies, keyrings, or database storage.
