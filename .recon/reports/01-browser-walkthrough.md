# Recon B — Live Browser Walkthrough: riftatlas.com/play + play.riftatlas.com

Date: 2026-10-22 · Agent B (headless browser) · Browser: **system Chromium 152** via Playwright 1.x (`executablePath: /usr/bin/chromium`), headless, 1920×1080 (plus 390×844 mobile passes).
Outputs: `.recon/screens/` (screenshots), `.recon/browser/` (DOM dumps, network/ws/console JSON, media + frames), `.recon/tools-browser/` (scripts).

Rules honored: no account, no login, no form submissions with personal data, no POST spam. Every room/join attempt was a single click used to observe the gate. Telemetry POSTs never fired because no room was ever created.

---

## 1. Entry points / URL map

| URL | What it is | Auth |
|---|---|---|
| `https://riftatlas.com/play` | Marketing landing for the simulator ("Play Riftbound online") | public |
| `https://play.riftatlas.com/` | **The simulator lobby** (the real app) | public (lobby only) |
| `https://play.riftatlas.com/customize` | Creator Studio cosmetics + **interactive read-only board preview** | public |
| `https://play.riftatlas.com/game` | redirects to lobby | public |
| `https://play.riftatlas.com/room/XXX` | 404 ("Page not found") — room URLs are not routable | — |
| `https://riftatlas.com/cards`, `/card/{CODE}` | Card browser + detail (JSON-LD metadata) | public |
| `https://riftatlas.com/decks`, `/decks/community/{id}` | Community decks + deck detail | public |
| `https://riftatlas.com/decks/new` | Deck builder (build anonymously; save needs login) | public build |
| `https://riftatlas.com/decks/mine` | "Sign in to see your decks" | login |
| `https://riftatlas.com/sealed` | Sealed: format chooser → pack opening → pool browser | public (play/save gated) |
| `https://auth.riftatlas.com/api/auth/get-session` | better-auth session endpoint hit on every app load | — |

---

## 2. Walkthrough (screens in `.recon/screens/`)

### 2.1 Landing `riftatlas.com/play`
- `01-landing.png` (full page), `01-landing-viewport.png`. Dark marketing page. Header nav: Advanced, Cards, Decks, Events, Sealed, Play, Contact, Discord, X, dark-mode toggle, language select (EN/简体中文/FR/한국어), membership, Buy-me-a-coffee, Sign in/Sign up.
- Hero: "Play Riftbound online." + buttons **Open simulator** (`https://play.riftatlas.com/`, new tab) and **Choose a deck** (`/decks`), plus a large real board screenshot (`board-chain-20260908.webp`, 1800×1000) with alt "Rebuke on the chain targeting the opposing Kai'Sa, Survivor at a battlefield."
- Sections with **60fps mp4 motion previews** (lazy-loaded, `loop muted`, click-to-play circle buttons): **Rewind** (`rewind-60fps-20260909.mp4`), **Auto-pay** (`auto-pay-60fps-20260909.mp4`), **Conquer prompts** (`conquer-60fps-20261008.mp4`) — screenshots `29-play-preview-1..7.png`.
- Feature copy captured verbatim: Quick Match (Constructed or Sealed, BO1/BO3, queue), Private Room (Duel/FFA/2v2 up to four players, room code), Solo Room (test a deck alone, play both sides), Spectate (room code), Rewind, Auto-pay (match log records every payment), Conquer prompts (Conquer + Score, showdown focus/pass), Deck import (list or deck code), Sealed, Friends & messages (friends by code, chat, invites), Customize, "Phones and tablets — touch layout", 4 languages.
- Footer: Patch Notes, Legal Notice, Privacy Policy, ToS, Media Kit, Contact.

### 2.2 Simulator lobby `play.riftatlas.com/`
- `10-simulator-landing.png`, `-viewport.png`. Three-column dark UI (bg `rgb(7,16,28)`, font **Bricolage Grotesque**).
  - Left rail (x≈110-280): TCGPlayer affiliate ad card.
  - Center deck panel: deck summary chips `LEGEND 0/1 · CHAMPION 0/1 · MAIN DECK 0/39 · BATTLEFIELDS 0/3 · RUNES 0/12 · SIDEBOARD 0/10`; LIST/STATS tabs (`#deck-list-tab`, `#deck-stats-tab`); "Private deck" toggle; buttons IMPORT DECK (303,646), NEW DECK (479,646), CHOOSE DECK (791,646), SAVE DECK (975,646); hint "Choose or import a deck first."
  - Right rail: PLAYER name input (`#right-rail-player-name`, placeholder "Your name"); QUICK MATCH panel with tabs CONSTRUCTED / **PRE-RIFT (disabled, title "Sign in to use Radiance · Pre-Rift.")**, mode line "1v1 · BO1 · Standard" + CHANGE, **FIND RANDOM MATCH** (1188,456); PRIVATE PLAY: **HOST ROOM** (1188,573) / **SOLO ROOM** (1387,573); ROOM CODE input (`#join-code`, placeholder AB12CD) + **JOIN / SPECTATE**.
  - Right-most: event promo panel (Convergence #4 countdown "October 31 5:15 PM your time · UTC+02:00", REGISTER NOW → topdeck.gg).
  - Header: PLAY.RIFTATLAS logo, CARD BROWSER link, Ctrl K, language, Discord/X, Sign in/Sign up, **Game history** (disabled, title "Sign in to save game history and choose deck privacy."), **Customize** (badge "New cosmetics available"), membership, support banner "Six months of building RiftAtlas — Read the story".
- **Deck import works without login.** `12-import-deck-modal.png`: dialog "Import Deck" (accessible name "Import deck list") with tabs DECK LIST / USE DECK CODE, textarea "Paste Riftbound deck export here…", live IMPORT VALIDATION panel (counts per section + line-by-line warnings/errors), CANCEL / IMPORT DECK.
  - Parser format discovered experimentally (`15-`, `16-`, `25-*` screenshots):
    - Lines: `N Card Name` or `N Card Name [ABC-123]` (no "x" suffix).
    - Section headers **with a colon**: `Legend:`, `Champion:`, `Main Deck:`, `Battlefields:`, `Runes:`, `Sideboard:` (hint text also accepts `MainDeck:`).
    - Errors are explicit ("Unknown section header … Did you mean …?", "Missing required section: Main Deck.", counts like `39/39 main deck`), and IMPORT is enabled only at "READY TO IMPORT".
  - `USE DECK CODE` tab: input "Paste deck code…" + LOAD DECK; "Paste a deck code to load the full deck list." (no public code format found to test).
  - Imported a real 58-card community deck (extracted from `/decks/community/jh799bw9vxekd68b9vf6hz0zh18fwjc3`, "Riven Tempo Midrange"): `26-lobby-deck-imported.png` — all counts 1/1, 1/1, 39/39, 3/3, 12/12, 10/10; deck renders in LIST with card thumbs; **mode auto-switches to "1v1 · BO1 · Radiance"** because the deck contains Radiance cards; `35-lobby-deck-stats.png` shows the STATS tab.
- **Every room action is login-gated** (`28a-d-*.png`): SOLO ROOM, HOST ROOM, JOIN/SPECTATE (tried code ABC123), FIND RANDOM MATCH all open the sign-in dialog (`dialog[data-account-dialog]`): "Sign in to Rift Atlas" — Google / Discord / Twitch OAuth, email field, Continue, "New to Rift Atlas? Create an account", plus Cloudflare Turnstile ("Verify you are human"). Opening it loads Turnstile scripts from challenges.cloudflare.com (the only POSTs observed).

### 2.3 Deck flows on riftatlas.com
- `/decks` (`13-decks-page.png`): "Community Decks", legend filter, sort (Recent/Trending/Hearts/Comments/Clones), deck cards with clone counts, `by author · date`; **Play** button on a deck card → sign-in modal (`14-after-deck-play-click.png`); deck links go to `/decks/community/{nanoid}`.
- `/decks/community/{id}` (`21-deck-detail.png`): full decklist with section headers and `1X Card Name` rows, energy/might chips, hover row highlights, LIST/STATS tabs, comments, "Save to my decks" (gated), Share (link-only modal, `23-share-modal.png`), TCGPlayer "Buy this Deck" affiliate link.
- `/decks/new` (`20-`, `40-decks-new.png`): public **deck builder** — card pool pane ("58 of 58 cards for Legend"), DECK WORKSPACE with Legend/Champion/Main Deck/Battlefields/Sideboard/Runes counters, grouping (No Grouping/By Type/By Energy/By Power/By Domain), sort (Name/Type/Energy/Power/Domain/Copies), "Load 24 more cards", validation "7 issues", Save (needs login), **Play in Simulator** (disabled until deck valid).
- `/cards` (`17-cards-page.png`): image-first card browser, 1,510 cards, search with syntax help, filters by set/domain/type; JSON-LD exposes names+codes; `/card/{CODE}` JSON-LD exposes Domain, Rarity, Set, Energy, Might, Subtypes, category.

### 2.4 Customize / Creator Studio — **the login-free board preview**
- `38-customize.png`, `45-board-preview-full/top.png`, `45-preview-phone/tablet/desktop.png`, `46-preview-click-token-panel.png`, `60-mobile-full-board.png` (390×844).
- Page: "CREATOR STUDIO / Customization — Playmats, sleeves and member cosmetics." Cards: PLAYMAT (Riftbound default), SLEEVES (Card / Rune deck / Battlefield), OTHER (Nameplates, Account badges 0 of 5, Tokens 0-4, Points rail, Board lines), EMOTE WHEEL (👍❤️😂❌⏳😠), Preview layout Desktop/Tablet/Phone with a mini live board (Opponent/You, MAIN/RUNES zones), membership CTA, "Art by …" credits.
- **"View full board" opens a full-size interactive read-only Simulator board preview** (modal, no login): real board component with zones, turn tracks, buttons (`PLAY FROM HIDDEN`, `REVEAL TO OPPONENT`, `TARGET`, `TOKEN PANEL`, `MAIN PHASE`), nameplates "You"/"Opponent", FLOATING Energy/Power with +/- steppers, CHAT + Help/Send, MATCH LOG, SWITCH/LEAVE, "Turn 1 00:00 ROOM: PREVIEW".
- Read-only behavior: clicking a card adds a glow highlight; right-click shows no menu; TOKEN PANEL opens a popover of ~10 token cards (`46-preview-click-token-panel.png`); MAIN PHASE/steppers are inert here.

### 2.5 Sealed (`riftatlas.com/sealed`)
- `39-sealed.png`, `42-sealed-start.png`: "Choose your Sealed format" modal — **Radiance · Pre-Rift** (1 starter kit + 5 boosters · 85 cards), **Vendetta · Sealed** (6 boosters · 84 cards · Historical), Vendetta · Pre-Rift, Unleashed · Pre-Rift, **Build your own pool** (Origins/Spiritforged/Unleashed/Vendetta steppers, up to 12 packs), "Saved Drafts", per-format share buttons.
- Open packs (`43-sealed-after-open.png`): "Custom Sealed — 3 Unleashed · 3 Vendetta · 84 cards", "Open with friends", "Sound on", "Open all", "Skip", 6 booster tiles (14 cards each) with Open actions, progress "0 of 6 products opened"; URL persists state as `?format=mix-unl3-ven3&seed=s.xxxxx` (shareable, public).
- Pack opening (`48e/f/g-*.png`): full-screen booster with "Booster N" title, bottom strip of the 6 boosters, Back to packs / Open all / Skip.
- Pool browser (`48-sealed-products.png`): tabs All Cards 84 / Legend 1 / Champion 3 / Main Deck 74 / Battlefields 3 / Runes 6, domain groups (Fury 10 cards, Calm 15 …), card tiles with cost/might badges, right DECK WORKSPACE (Add Legend/Champion/Main/Battlefields/Runes, List/Full Art/Stats, Clear Deck, "Save to account" = gated), bottom bar "0/25+ Core deck · 0/12 Runes · 0/3 Domains" + **Play in Simulator (disabled, needs login)**.

---

## 3. Game board layout (from the real board: hero image + rewind/auto-pay/conquer videos + read-only preview)

Canvas ≈ 1900×1000 dark navy (`rgb(7,16,28)`) inside a `rounded-sm` border `rgba(134,168,246,0.28)`; subtle 1px grid lines; accent cyan `#74efff`; gold `#d8bd84`/`rgb(242,176,45)`; primary blue buttons; font **Bricolage Grotesque** (UI) with Geist/GeistMono for tabular numbers.

Top→bottom:
1. **Top bar**: score badge left (0) and right (0); opponent nameplate ("Ari") top-right with timer (16:29); turn header top-right: "Turn 5 · Kai's turn · 35:25 · ROOM: V30BY" + icon buttons (rewind, settings, layout, fullscreen); spectator seat buttons **PLAY AS KAI** (green, active) / **PLAY AS ARI**; **NEXT** (with rewind icon) and **LEAVE**.
2. **Opponent zone (top half)**: deck pile top-left with count badge (33); hidden "No card" slots; hand as a tilted fan of card backs top-center; legend slot (card back) with might badge (7); FLOATING Energy 0 / Power 0 counters; opponent rune row (3 Fury + 2 Mind, tilted when exhausted) with a `5/5` label.
3. **Middle**: two battlefield rows (one per player) split by a divider, each with two large zones (left ≈x178-828, right ≈x852-1465 at 1800px width), soft borders `rgba(132,150,184,0.2)`, `+` button at a zone corner, small counter chips (`1/2`, `0`, `1`), unit/battlefield cards rendered inside; **MAIN PHASE** button on the right edge; **turn track** (0-9) on both left and right edges, current turn ringed in green.
4. **You zone (bottom half)**: nameplate "You"/"Kai" bottom-left + timer (18:56); own deck pile with count (10); FLOATING Energy/Power with +/- steppers and eye (privacy) icons; hand bottom-center (face-up with a **HAND REVEALED** banner when revealed); rune deck bottom-right with count (32); score badge (0).
5. **Right rail (top→bottom)**: turn header, MATCH LOG (entries grouped "TURN 5 · KAI" with timestamps, icons: played/paid/moved/dismissed), big blue **Resolve (S)** button, CHAT panel ("Type message…", Help, Send), bottom-right icons (log/lightning, privacy eye). Card preview popover shows hotkeys "S RESOLVE / T TARGET".

Preview-modal geometry (1920×1080): board root at (23,80) 1604×984; You nameplate (336,838) 210×48; Opponent nameplate (1500,347); SWITCH (1632,127) / LEAVE (1821,127); hand placeholder "No card" (158,249) 112×155; page bg `rgb(7,16,28)`; modal is a `<dialog>`-like overlay titled "View full board".

Mobile (390×844, `60-mobile-full-board.png`): board squeezes into a tall narrow layout — opponent + turn track top-left, MATCH LOG, stacked battlefield zones, MAIN PHASE, CHAT, "You" bottom-left, FLOATING steppers bottom-center, deck bottom. The landing page advertises a dedicated touch layout.

---

## 4. Interactive controls inventory

**Lobby**: LIST/STATS tabs · Private-deck toggle · IMPORT DECK (modal: paste list / deck code, live validation, CANCEL/IMPORT) · NEW DECK → `/decks/new` · CHOOSE DECK (login) · SAVE DECK (login) · player name field · CONSTRUCTED / PRE-RIFT tabs (PRE-RIFT disabled pre-login) · CHANGE → **MATCH SETTINGS** dialog: Table (1v1, 1v1v1, 1v1v1v1, 2v2), Format (BO1, BO3), Card pool (Standard, Radiance), each with "Most played in the last few hours" hint, footer note "Deck uses Radiance cards" (`32-mode-change-picker.png`) · FIND RANDOM MATCH (login) · HOST ROOM (login) · SOLO ROOM (login) · ROOM CODE + JOIN/SPECTATE (login) · Game history (disabled) · Customize · language select · dark mode (site header) · membership/coffee/support/event/ad links.

**Board (observed in videos + read-only preview)**: NEXT (pass/advance), rewind icon → **REWIND overlay** (big clock, "Rewound to before their last action." log entry), Resolve (S) hotkey, TARGET (T) hotkey, MAIN PHASE, END TURN, SWITCH SEAT / PLAY AS X, LEAVE, TOKEN PANEL popover, PLAY FROM HIDDEN, REVEAL TO OPPONENT, FLOATING Energy/Power +/- steppers, privacy eye toggles (hide hand), CHAT (Help/Send), MATCH LOG, turn track, score badges, unit drag to battlefield (conquer video), conquer prompt with **Conquer + Score**, showdown focus/pass prompts, auto-pay animation when paying costs, hand reveal banner.

**Deck builder**: tabs List/Full Art/Stats, grouping & sort dropdowns, filters, "Load 24 more cards", per-section "Add …" buttons, validation issues counter, Save (login), Play in Simulator (disabled until valid).

**Sealed**: format cards, pack steppers (Origins/Spiritforged/Unleashed/Vendetta), Open packs/Open all/Skip, Sound toggle, "Open with friends", pack Open animation, pool tabs & domain groups, deck workspace, Save to account (login), Play in Simulator (login).

## 5. Animations noticed
- Landing: three looping 60fps mp4 motion previews (rewind, auto-pay, conquer).
- Board: rewind clock overlay animation; auto-pay — rune card floats/tilts as it is exhausted/recycled (frame series `52-`); conquer prompt appearing beside a moved unit (`53-`, `54-`); card hover glow in preview; turn track highlight.
- Sealed: pack front/center reveal + booster strip.
- Lobby: standard Tailwind transition-colors hovers; no heavy animation observed.

## 6. Network / realtime findings
- `play.riftatlas.com` is a Next.js App Router app (RSC flight payloads, `/_next/static/immutable/chunks/*.js`), fonts Geist/GeistMono/Bricolage; images from `assets.riftatlas-workers.com` (`/riftbound/cards/small-v2/{CODE}.webp`, `.../original/{CODE}.webp`, Cloudflare `/cdn-cgi/image/width=…` transforms); sound assets `/riftbound/static/sounds/20260716/*.webm` (e.g. `game_start.webm`); cosmetics `/cosmetics/poro/pals.riv`.
- Every load hits `auth.riftatlas.com/api/auth/get-session` (better-auth).
- **No WebSocket connections were opened anywhere pre-login** (lobby, import, board preview, customize, sealed: 0 sockets, 0 frames). No XHR/fetch data APIs observed pre-login. Room realtime transport (likely WS) could not be observed because all room entry is login-gated.
- Only third-party POSTs were Cloudflare Turnstile challenge calls, fired when the sign-in dialog opened.
- Room codes seen in demo media are 5 chars (V30BY, PZUSU; "PREVIEW" in read-only mode).
- Anonymous telemetry: none sent during our session (telemetry object initialized but idle; `inGame:false, roomCode:null`).

## 7. Storage
- localStorage: `riftbound_telemetry_client_id_v1` (uuid), `riftatlas.analytics_sample.v1` (0-1 float), `riftbound_feedback_client_id_v1` (uuid), `riftbound_session_telemetry_v2.<tabId>` (JSON: version, sessionId, startedAt, lastSeenAt, cleanEnd, lastVisibilityState, **inGame, roomCode, roomPhase**, maxHeapMb, heapLimitMb, errorCount, recentErrors, recentActions), `riftbound_simulator_play_mode` ("constructed").
- sessionStorage: `riftbound_simulator_tab_id`, `riftbound_session_telemetry_tab_id_v1`.
- Cookies: none (anonymous, no tracking cookies).

## 8. Login walls (all blocked pre-account)
CHOOSE DECK / deck picker · community-deck Play · SAVE DECK · SOLO ROOM · HOST ROOM · JOIN/SPECTATE · FIND RANDOM MATCH · PRE-RIFT pool (disabled) · Game history (disabled) · `/decks/mine` · deck Save in builder · sealed "Save to account" + "Play in Simulator" · share modal's sign-in CTA. Auth = Google/Discord/Twitch/email + Cloudflare Turnstile. **Consequence: no live match, mulligan, drag-to-board, context-menu or in-game chat interaction could be performed; the board could only be studied via the login-free read-only preview and the site's own board videos/screenshot.**

## 9. Artifact index
- Screens: `01-*` landing · `10-*` lobby · `11-*` deck-picker gate · `12-`/`15-`/`16-`/`25-*` import modal+parser · `13-`/`14-`/`21-`/`23-` decks · `17-` cards · `19-`/`27-`/`28a-d` room gates · `26-` lobby-with-deck · `29-*` landing previews · `30-`/`31-` mobile lobby/landing · `32-` mode picker · `35-` stats · `36-` ctrl+K · `38-` customize · `39-`/`42-`/`43-`/`48e-h` sealed · `40-` deck builder · `45-`/`46-`/`47-`/`49-` board preview + zonemap · `50-54` board states from videos · `60-` mobile board.
- Data: `.recon/browser/*.rendered.html` (lobby, /play, cards, deck detail), `*.network.json`, `*.ws.json` (empty), `*.console.json` (no errors), `storage.json`, `interactives.json`, `dom-outline.json`, `24-riven-deck.json` (importable deck), `45-board-preview-dom.html` (212 KB board DOM), `49-board-zonemap.json`, `18-cards-index.json` (card codes), `media/` (3 mp4s + board hero webp + extracted frames).
- Scripts: `.recon/tools-browser/01-capture.js … 60-mobile-board.js` (all reusable; `lib.js` helper; `capture-url.js <url> <name>`).
