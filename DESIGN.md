# Public Omakase design contract (v2.2.0: Midnight Izakaya Atelier)

Updated November 27, 2026: removed all hardcoded model names and static starter lists from the web UI in favor of evergreen live `/api/providers/models` discovery, redesigned `#field-guide` into an always-visible 2x2 editorial card grid, and added `?v={{ asset_version }}` cache-busting to vector marks and hero artwork.

## Tokens & Typography

- Canvas `#0B0A0C` (charcoal lacquer), counter surface `#131115`, elevated surface `#1B181F`, hover `#231F28`, hairline borders `rgba(245, 239, 230, 0.09)` / `0.17`, warm parchment ink `#F5EFE6` / `#C8BEB0` / `#9A8F82`, lantern amber accent `#E2A35E` (`#F0C28A` focus), vermilion seal `#E05A47`, semantic green `#5FD39E`, semantic error `#F87171`.
- Self-hosted typography with zero external font calls (`font-src 'self'`): `Fraunces` display (`fraunces-400.woff2`, `fraunces-400-italic.woff2`, `fraunces-500.woff2`, SIL OFL 1.1) paired with `Geist` variable UI/body (`geist-variable.woff2`).
- Official colored local vector logos in `src/omakase/web/static/logos/` (`openai.svg`, `anthropic.svg`, `gemini.svg`, `deepseek.svg`, `openrouter.svg`, `openwebui.svg`, `anilist.svg`, `myanimelist.svg`) paired with `1.75px`-stroke UI icons and zero external CDN requests.

## Counter, Live Model Discovery & Result Menu

- Three explicit courses: Model (colored provider logos with timeless subtitles, request-local API key, live `/api/providers/models` catalog sorted dynamically by newest release timestamp and version descending, `All / Fast / Balanced / Reasoning / Free` filter pills hidden until models load, search, and custom model ID), History (AniList username or in-memory MyAnimeList XML/GZ export, optional Plan to Watch filter), and Taste (clickable starter chips, notes, or scores-only toggle).
- Sticky Tasting Slip (`menu_receipt.js`) mirrors current provider, model, key status, history, taste brief, and scope in memory without persistence or secret exposure.
- Returned tasting menu cards (`.recommendation`) feature an atmospheric anime banner backdrop (falling back to a soft blurred poster wash when no banner exists), an overlapping prominent anime poster (`116x168px` desktop, `s4.anilist.co` / `cdn.myanimelist.net` allowlisted in backend + CSP), Fraunces title, format/episode/studio/genre badges, reasoning, history pairing, predicted fit badge, side-by-side compare (`Compare this pick` up to 2 items), and Markdown copy (`Copy menu`).
- Field Guide (`#field-guide`) renders a balanced 2x2 editorial grid of always-visible `.field-guide__card` blocks without stretched disclosures.
- All guest API keys, watch history, and taste notes remain strictly request-local: held in memory for one request, cleared from the browser input on menu completion, and scrubbed in backend `finally` cleanup without accounts, cookies, keyrings, or database storage.
