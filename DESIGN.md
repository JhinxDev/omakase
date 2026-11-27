# Public Omakase design contract (v2.0.0: Midnight Izakaya Atelier)

Updated November 27, 2026: redesigned the stateless Bring-Your-Own-Key (BYOK) web counter and tasting menu onto the Midnight Izakaya Atelier visual system with crisp SVG provider logos and live `/models` discovery.

## Tokens & Typography

- Canvas `#0B0A0C` (charcoal lacquer), counter surface `#131115`, elevated surface `#1B181F`, hover `#231F28`, hairline borders `rgba(245, 239, 230, 0.09)` / `0.17`, warm parchment ink `#F5EFE6` / `#C8BEB0` / `#9A8F82`, lantern amber accent `#E2A35E` (`#F0C28A` focus), vermilion seal `#E05A47`, semantic green `#5FD39E`, semantic error `#F87171`.
- Self-hosted typography with zero external font calls (`font-src 'self'`): `Fraunces` display (`fraunces-400.woff2`, `fraunces-400-italic.woff2`, `fraunces-500.woff2`, SIL OFL 1.1) paired with `Geist` variable UI/body (`geist-variable.woff2`).
- Consistent inline SVG brand marks (`24x24` viewBox) for OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, OpenWebUI, AniList, and MyAnimeList, plus `1.75px`-stroke UI icons.

## Counter, Live Model Discovery & Result Menu

- Three explicit courses: Model (provider logos, request-local API key, live `/api/providers/models` catalog with `All / Fast / Balanced / Reasoning / Free` filter pills, search, and custom model ID), History (AniList username or in-memory MyAnimeList XML/GZ export, optional Plan to Watch filter), and Taste (clickable starter chips, notes, or scores-only toggle).
- Sticky Tasting Slip (`menu_receipt.js`) mirrors current provider, model, key status, history, taste brief, and scope in memory without persistence or secret exposure.
- Returned tasting menu cards (`.recommendation`) preserve full titles, reasoning, history pairing, predicted fit, side-by-side compare (`Compare this pick` up to 2 items), Markdown copy (`Copy menu`), allowlisted HTTPS cover art (`s4.anilist.co` / `cdn.myanimelist.net`), and format/episode/studio/genre badges.
- All guest API keys, watch history, and taste notes remain strictly request-local: held in memory for one request, cleared from the browser input on menu completion, and scrubbed in backend `finally` cleanup without accounts, cookies, keyrings, or database storage.
