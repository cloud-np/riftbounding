# 00 — Static Recon Inventory: Rift Atlas /play & simulator

Recon agent A (static assets), 2026-10-22. All fetches read-only GET against riftatlas.com /
play.riftatlas.com / assets.riftatlas-workers.com. Everything under `.recon/`.

## 0. CRITICAL FINDING — two apps, not one

- `https://riftatlas.com/play` is a **marketing/launcher page** (prerendered Next.js) that links
  "Open simulator (opens in a new tab)" → `https://play.riftatlas.com/`. It shows feature blurbs
  (Quick Match, Private Room, Solo Room, Spectate, Rewind, Auto-pay, Conquer prompts, Deck import,
  Sealed, Friends, Customize, mobile, 4 languages), a "Choose a deck" widget, 4 animated webp demos,
  FAQ, Discord CTA.
- The **actual simulator app** (lobby, matchmaking, board, game) is a separate Next.js deployment at
  `https://play.riftatlas.com/` — routes: `/` (lobby, client-rendered), `/game` (board; renders a
  loading shell that hydrates client-side), i18n prefixes `/fr /ko /zh-CN`, `/admin` (robots-disallowed).
- riftatlas.com also hosts the card DB site (/decks, /search, deck builder, card pages) — adjacent, not the game.
- Both trees were fully downloaded. **Simulator gameplay = the playapp tree.** The site tree still
  bundles shared simulator modules (lazy, locale game-log translations) but no /game route (404).

## 1. Framework / hosting

- **Next.js 16.4.2 (App Router) + Turbopack** build system (`turbopack-*.js` runtime, `_next/static/immutable/chunks/*`
  content-hashed chunks, `self.__next_f` flight payloads, `x-nextjs-prerender: 1`, `vary: rsc`).
- **React 19.3.0**; compiled with **React Compiler** (memo-cache pattern `b[0]!==e?...` pervasive).
- Hosting: **Vercel** (`server: Vercel`, `x-vercel-cache`, `?dpl=dpl_…`), edge PoP fra1; assets CDN on
  Cloudflare Workers (`assets.riftatlas-workers.com`, Cloudflare Image Resizing `/cdn-cgi/image/`).
- No service worker / PWA manifest (`/manifest.webmanifest` → 404).
- **Sourcemaps: NONE** — every `<chunk>.js.map`/`.css.map` probed → 404 on both hosts. Only original
  source leaked: `/media/glass-map.worker.<hash>.ts` (worker TS source served as static asset, saved).
- Build IDs: site `dpl_H8nCLPPCT5uDDUbTgLFBGZtH5T4Y`; playapp 404-shell `dpl_HU2arvMRUng7jwpXKhYieDoWXSMb`.
  `/api/version` on both: version `ed4138aab7e3…`, build 2026-10-19.

## 2. Routes

- riftatlas.com: `/`, `/play`, `/decks` (builder /decks/new), `/search`, `/changelog`, `/contact`,
  `/legal-notice`, `/media-kit`(?), `/privacy-policy`, `/terms-of-service`, `/sign-in|up`, `/mail`,
  `/private/…`, `/api/og/` (public OG images); i18n `/fr /ko /zh-CN` prefix for all.
- play.riftatlas.com: `/` (lobby), `/game` (+ `/fr|ko|zh-CN` prefixes), `/api/*` (disallowed),
  `/__browser/` (disallowed), `/admin`, `/sign-in|up`.
- sitemap.xml (riftatlas.com) includes deck URLs; robots.txt saved in `.recon/api/`.

## 3. File inventory (all under .recon/site/)

| what | path | count | size |
|---|---|---|---|
| /play HTML + RSC | site/play.html (190KB), play.rsc.txt (133KB) | | |
| site JS/CSS/fonts | site/dl/_next/static/immutable/ | 63 js, 6 css, 8 woff2 | 7.1MB |
| playapp HTML/RSC | site/playapp/{playroot,route_game}.html + .rsc.txt | | ~930KB |
| playapp JS/CSS/fonts | site/playapp/dl/_next/static/immutable/ | 95 js, 6 css, 24 media (23 fonts + 1 ts) | 12MB |
| UI images/icons | site/assets/ (4 /play demo webp, icons, favicon) | 12 | 568KB |
| CDN static library | site/assets/cdn/ (board.webp, cardbacks, 83 icons, 20 tokens, 31 sounds, sets, sealed, setup) | 187 | 31MB |
| prettified bundles | pretty/site, pretty/playapp | 63 + 95 js | 9.2MB + 17MB |
| API/extracted data | api/ | 7 files | 18MB |

All chunk refs verified complete in both trees (recursive string crawl + dynamic-import arrays,
zero missing). Tools in `.recon/tools/`: crawl.sh, crawl2.sh, prettify.sh, classify.js, extract-cards.js.

## 4. External services / APIs / hosts

| service | endpoint | evidence / notes |
|---|---|---|
| **Convex** (shared backend) | `https://wary-sturgeon-712.convex.cloud` (prod; both apps) | `ConvexReactClient`/`ConvexHttpClient`; HTTP `/api/query|mutation|action|function`, ws sync; `GET /version` → `20261020T233710Z-…`; env `NEXT_PUBLIC_CONVEX_URL` |
| **PartyKit realtime** | `realtime.riftatlas-workers.com` (wss) | `NEXT_PUBLIC_PARTYKIT_HOST`; bundled PartySocket lib; matchmaking/room/game sync |
| Asset CDN | `https://assets.riftatlas-workers.com/riftbound/…` | `/static/…` (UI) + `/cards/…`; Cloudflare image resize |
| Auth | Clerk — `clerk.riftatlas.com` (staging `relieved-colt-39.clerk.accounts.dev`, `auth.staging.riftatlas-workers.com`) | `NEXT_PUBLIC_ACCOUNT_AUTH_*`; sign-in dialog; friend codes (20 chars) |
| Bot protection | Cloudflare Turnstile (`challenges.cloudflare.com`, site key in bundle) | account flows |
| Payments/membership | same-origin `/api/stripe/{checkout,cancel,status}`, `/api/membership/discord`, `/api/metafy/{sync,disconnect}` | relative fetches |
| Ops | `/api/version` (public, both hosts), `/api/og/` (public og images on site) | |
| Analytics | Vercel (`va.vercel-scripts.com`, `vercel.live`) | |
| Staging hosts | `web.staging.riftatlas-workers.com`, `play.staging.riftatlas-workers.com` | origin config |
| Misc outbound | tcgplayer affiliate, metafy.gg, buymeacoffee, discord.gg | links only |

Game transport model: **server-authoritative state over PartyKit websocket rooms** + Convex for
persistent data (decks, friends, accounts). No client-side rules engine found; client submits typed
actions and renders server state (optimistic local intents exist, e.g. `set_armed_action`).

## 5. Card data (public)

- Full **canonical card catalog is embedded in the JS bundle** (no public REST card API found):
  `playapp …/1s-b1v6u63dg2.js` → extracted to `api/cards.embedded.json` (**1510 cards**).
- Schema sample (per card): `{ id:"OGN-001", name:"Blazing Scorcher", energyCost:5, powerCost?:1,
  type:"Unit|Spell|Gear|Legend|Rune|Battlefield|Card|Unit Gear", domains:["Fury"], text:"…[ACCELERATE]…",
  might:5, imageUrl:"/cards/OGN-001.webp", imageLocale?:"zh-CN", rarity:"Common|Uncommon|Showcase|…",
  set:"Origins", keywords:["Accelerate"], subtypes:["Noxus","Dragon"] }`.
- Sets present: Origins(354), Spiritforged(303), Unleashed(293), Radiance(253), Vendetta(249),
  Proving Grounds(24), Arcane Box Set(12), Nexus Night variants, Secret Garden(2).
  Types: Unit 778, Spell 271, Legend 161, Gear 141, Rune 78, Battlefield 77. Domains: Body/Order/Calm/
  Mind/Fury/Chaos (+ "Unknown" for tokens).
- Card **text translations** per locale as separate JSON chunks (fr/ko/zh-CN in playapp: 02bk…, 0z861…,
  3xwrn…, 1-gn9…, 0euszz…; site tree also has fr/ko/zh game UI variants) + locale manifest
  `{schemaVersion:2, locales:{fr:{assetPathSegment,publishedSets…}}}` (api/locale-manifest.txt).
- Card image revisions: `api/card-image-revisions.json` (1509 entries, md5-ish cache keys `?v=`).

## 6. Image URL patterns

- Card art: `https://assets.riftatlas-workers.com/riftbound/cards/[<locale>/]{small-v2|original}/<CARDID>.webp?v=<revision>`
  → verified: `small-v2/OGN-001.webp` 384×536 (~52KB), `original/OGN-001.webp` 1030×1438 (~83KB),
  `zh-CN/small-v2/...` variant. Slot map: thumb/board/hand→`small-v2`, preview/hover/battlefieldDraft→`original`.
- Resizing: `https://assets.riftatlas-workers.com/cdn-cgi/image/width=<bucket>,quality=75-92,format=auto,fit=scale-down,onerror=redirect/riftbound/...`
  width buckets 96/128/192/256/320/384/512/…; allowlisted regexes validated client-side.
- UI assets: `https://assets.riftatlas-workers.com/riftbound/static/<path>?v=<revision>` — full 187-entry
  manifest (incl. revision hashes) extracted to `api/asset-manifest.json` and downloaded to site/assets/cdn/:
  `board.webp`, `cardback-{black,white,blue,black-landscape}.png`, `placeholder.svg`, `icons/` (83),
  `tokens/` + `tokens/thumbs/` (10 types ×2), `sounds/20260716/*.webm` (31: ui_click, turn_start,
  score_conquer, score_hold, game_rewind1/2/5, ping, chat_message, baron_nashor…), `sets/` (5), `sealed/` (6),
  `setup/` (3), `effects/`, `brand/`, `guide-banners/` (9).

## 7. UI libs (evidence)

- **Tailwind CSS v4** (`@layer theme/properties/components/utilities` in CSS; playapp main CSS 878KB,
  site main 302KB — both include arbitrary/variant utilities).
- **framer-motion** (`motion` primitives; vendor chunk playapp/25vik2nxxo51i.js, 303KB).
- **Rive runtime + rive-wasm** (3MB vendor chunk 37hpdmovr42bt.js; rive.app links) — animated art.
- **three.js** (vendor 1847m5h7yrvg-.js 572KB) used by lazy `InitiativeDiceStage` (3D dice roll,
  chunk 3vkoknf821dno.js) and `MatchmakingRiftScene` (3D rift, chunk 286zkw3d8ndo1.js).
- **PartySocket** (realtime lib, chunk 0cvaqmu9022vp.js) + **Convex client** libs (0cj_mgo_d57k9.js site 0i3lu0u9jz3zw.js).
- No Radix/HeadlessUI/MUI/shadcn/zustand/redux/xstate/dnd-kit/tanstack/lodash — **custom components +
  custom store** (React hooks/context; `useSyncExternalStore`-style patterns), clsx-like helpers.
- Card interactions (drag/hover/zoom) are custom pointer-event code inside the board chunk.
- Off-main-thread: `glass-map.worker` (TS source leaked as static asset) computes a board "glass map"
  texture via OffscreenCanvas PNG encode.
- i18n: custom message catalogues (ICU-style), locales `en, fr, ko, zh-CN`; game-log strings localized
  separately (~256 keys/locale).

## 8. Fonts (self-hosted woff2, all downloaded)

- riftatlas.com: **Geist Sans + Geist Mono** (variable), Bricolage Grotesque (variable 200-800),
  Rajdhani 400/700 (latin + arabic subsets), Cardo (serif), Cookie (script; site header).
- playapp: Geist variable, Bricolage Grotesque, Rajdhani, Cardo (12 woff2 = many subsets), = design
  system shared with site; card body text uses a serif (Cardo/Times fallbacks), UI uses Geist/Bricolage.

## 9. Chunk → feature map

### play.riftatlas.com (simulator). Raw sizes; prettified under .recon/pretty/playapp/
| chunk (raw KB) | role |
|---|---|
| 0xawjzm3yjpr1.js (1103) | **Board UI + all interactions**: GameCardArt, hand/battlefield/runes layout, mulligan hand layout, auto-pay UI, arrows/targeting prompts, deck peek, labels, counters, keyboard/hotkeys, emotes overlay |
| 1s-b1v6u63dg2.js (566) | **Card catalog + rules helpers**: 1510-card DB, card-type/domain/tag sets, text/keyword parsing |
| 35qz5rkx7yexy.js (722) | **Game protocol + realtime client**: all 138 action types, room states, phase machine (initiative_roll → first_player_choice → mulligan → in_game), rewind/forward classification, deck select, spectate, matchmaking messages |
| 2atnqtfqvj-z4.js (263) | Setup/sideboarding flows (SetupFlowOverlays, SideboardingLeaveButton) |
| 1w8d13szpogkp.js (159) | Gameplay action client: auto-pay, stale-state/forward errors |
| 3-2i4k6s343ud.js (127) | Account/profile (auth writes, player name) |
| 2goht72gp0rq8.js (154) | Concede/report/comment/replay dialogs |
| 1kx2ucot0m321.js (120) | Friends/invites/chat UI |
| 0ltxa4_95njgw.js (67) | Emote/ping/chat protocol constants |
| 2-nry424r0961.js (75) | Sleeves/playmat/board-line customization |
| 439rnwycqsxxv.js (75) | glass-map worker bootstrap (board texture) |
| 3vkoknf821dno.js / 286zkw3d8ndo1.js | 3D initiative dice / matchmaking rift (three.js lazy pairs) |
| 1847m5h7yrvg-.js (572) | three.js vendor; 37hpdmovr42bt.js (2982) rive vendor; 25vik2nxxo51i.js (303) framer-motion |
| 0cvaqmu9022vp.js, 0cj_mgo_d57k9.js, 00oh4fvv81zin.js, 4203q4bmv23nj.js | vendors: PartySocket, Convex, react-dom, next router |
| 1ixua9twvm95a.js (69) | asset manifest + card/static image URL builders |
| 123h3ohyw0ag5.js (61) | image loader/allowlist (cdn-cgi transform validation) |
| 1uw-ffl94kbzv.js, 0evbr82vl51g3.js, 0r12sly2zwo8g.js, 0p4ahzekegpbg.js, 1wtthi75czt6u.js, 02bk…, 0z861…, 1-gn9…, 0euszz… | locale manifests + card text/game-log translations (en/fr/ko/zh-CN) |
| turbopack-2flrc96g-xrc4.js + turbopack-worker-17xj571juv_5b.js + 37nl_3xxi7for.js | worker runtime for glass-map |

### riftatlas.com /play route — 28 initial chunks (list: site/play_route_chunks.txt)
Launcher page uses the site-wide shell + lazy locale/simulator-shared chunks (mulligan/spectate
translations). Chunks: app shell/vendors (0c0hxoamwjsbw, 2ir_dv_10dq9s, 2pr9ntbtierih), Riftbound
keyword glossary (0-apqcpiqnpdw), launcher UI/account (27hoiz43d4jxw, 0o8520f52rc9g, 42eigi-l_2-h5),
realtime/spectate client (0n2p7fu--6rjx.js) + PartySocket (0nb1p04rur_lh.js), lazy game-log locales
(04d-…, 1e6zkf-…, 1z_d5b0sfp_zn, 1wrtwhgcl-tng, 3u5w87zgq6isk), image/asset helpers, etc.

### Game protocol artefacts (extracted)
- `api/game-action-types.txt` — **138 action types** incl. `submit_mulligan`, `roll_initiative`,
  `choose_first_player`, `select_battlefield`, `submit_deck`, `submit_sealed_draft`, `submit_sideboard`,
  `draw_rune`, `channel_rune_deck`, `send_rune_to_deck_bottom`, `recycle_rune_for_floating_energy`,
  `draw_cards`, `move_card`, `move_cards_to_trash_batch`, `create_token`, `equip_card`, `adjust_might`,
  `adjust_score`, `score_conquer`, `battlefield_conquer_confirm|dismiss|pass_focus|pass_response`,
  `attacker_confirm_conquer`, `chain_add|resolve|set_repeat|set_flow|set_resolve_vote`, `end_turn`,
  `roll_die`, `rewind_last_action`, `forward_last_rewind`, `respond_rewind_confirmation`, `chat`, …
- Lobby/room states: `solo_lab`, `single_player`, `battlefield_pick`, `initiative_roll`,
  `first_player_choice`, `mulligan`, `in_game`; room ops `create_room`, `join_room`, `take_seat`,
  `search_quick_match`, `cancel_matchmaking`, `set_lobby_*`; formats `free_for_all_3|4`, `teams_2v2`.

## 10. Recommended analysis splits (for specialist sub-agents)

1. **Launcher page (/play) replication** → site/dl CSS (2wc4toplanayo 302KB, 3go3sf…, 12ah2p…, 3zwv5emf…),
   play.html + play.rsc.txt text content, 4 /play demo webps, fonts (Geist/Bricolage/Rajdhani).
2. **Game protocol & engine semantics** → pretty/playapp/35qz5rkx7yexy.js (action union, phases, rewind),
   api/game-action-types.txt, 1w8d13szpogkp.js (auto-pay), 2atnqtfqvj-z4.js (setup/sideboard).
3. **Board rendering & interaction UX** → pretty/playapp/0xawjzm3yjpr1.js (primary), 2-nry424r0961.js
   (sleeves/board customization), 439rnwycqsxxv.js (glass map), 0ltxa4_95njgw.js (emotes/pings).
4. **Card data & imagery pipeline** → api/cards.embedded.json (1510), card-image-revisions.json,
   1ixua9twvm95a.js, 123h3ohyw0ag5.js, 1s-b1v6u63dg2.js, site/assets/cdn/ (board/tokens/icons/sounds).
5. **Realtime/net layer** → 0cvaqmu9022vp.js (PartySocket), 35qz5rkx7yexy.js matchmaking sections,
   realtime.riftatlas-workers.com, Convex client 0cj_mgo_d57k9.js.
6. **Lobby/friends/account UI** → 1kx2ucot0m321.js, 3-2i4k6s343ud.js, 2goht72gp0rq8.js,
   site 27hoiz43d4jxw.js, 0o8520f52rc9g.js.
7. **Animation/3D polish** → 25vik2nxxo51i.js (framer-motion), 37hpdmovr42bt.js (rive),
   1847m5h7yrvg-.js + 3vkoknf821dno.js + 286zkw3d8ndo1.js (three.js scenes), playapp CSS (animations).
8. **i18n systems** → locale chunks (playapp 0evbr82…, 0r12sl…, 0p4ahz…, 1wtthi…; manifests 1uw-…, 0euszz…,
   0z861…; card text 02bk-…, 3xwrn…, 1-gn9…).

Caveats: server-authoritative gameplay means an exact *functional* copy needs the rules running
somewhere (re-implement client-side engine or a game server); the client protocol above is the
contract to satisfy. No sourcemaps, so board/engine behavior must be inferred from prettified
bundles + runtime capture (agent B).
