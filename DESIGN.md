# Public Omakase design contract (v1.0.0: Carbon Obsidian + Iris Atelier)

Updated November 25, 2026: unified the BYOK counter and returned tasting-menu cards onto the Carbon Obsidian + Iris Atelier system matching `jhinx.dev`, and removed Omakase Lite accounts so the web app operates purely as a stateless Bring-Your-Own-Key (BYOK) experience.

## Tokens & Typography

- Canvas `#09090B`, bento surfaces `#111216` / `#181A20`, hover `#1E2028`, hairline borders `rgba(255, 255, 255, 0.09)` / `0.17`, iris violet accent `#A78BFA` (`#C4B5FD` focus), high-contrast text `#F4F4F5` / `#A1A1AA`.
- Self-hosted variable Geist typography (`geist-variable.woff2` with `GEIST-OFL.txt` + `GEIST-SOURCE.md` provenance) via `font-src 'self'` in CSP.
- Single-pass `style.css` and `result_menu.css` eliminate legacy paper/vermilion CSS override debt.

## Counter & Result Menu Surfaces

- Three explicit courses: Model (provider, Quick/Deep mode or optional override, BYOK credential), History (public AniList handle or in-memory MyAnimeList XML/GZ export, optional Plan to Watch filter), and Taste (notes or scores-only toggle).
- The preparation slip (`menu_receipt.js`) reflects current form readiness in memory without persistence or secret exposure.
- Returned recommendation cards (`.recommendation`) preserve full titles, reasoning, history pairing, predicted fit, side-by-side compare (`Compare this pick` up to 2 items), and safe outbound links while adding optional HTTPS cover art (`s4.anilist.co` / `cdn.myanimelist.net` allowlisted in both backend and CSP) and format/episode/studio/genre badges.
- All guest API keys, watch history, and taste notes remain strictly request-local: held in memory for one recommendation job, cleared from the browser input upon completion, and scrubbed in backend `finally` cleanup without accounts, cookies, keyrings, or database storage.
