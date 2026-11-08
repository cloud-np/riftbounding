# 04 — App shell & lobby spec: `play.riftatlas.com`

Sources: `.recon/site/playapp/playroot.html` + `playapp.rsc.txt` + `route_game.html`/`route_game.rsc.txt` (prerender),
`.recon/browser/10-simulator-landing.rendered.html` + `interactives.json` (hydrated lobby DOM), `12-import-deck-dom.html`, `15-use-deck-code-dom.html`,
screenshots `10-simulator-landing.png`, `19-solo-room-no-deck.png`, `11-deck-picker.png`, `12-import-deck-modal.png`,
chunks `.recon/pretty/playapp/35qz5rkx7yexy.js` (lobby/protocol/realtime), `0xawjzm3yjpr1.js` (board), `1w8d13szpogkp.js` (game realtime runtime), `2i0ajg8a836h8.js` (message schema), `1kx2ucot0m321.js` + `1tospps_lieni.js` (friends), `3-2i4k6s343ud.js` (account/social), `2goht72gp0rq8.js` (dialogs), `2-nry424r0961.js` (customize), `3lkda0iwi2gi6.js` (lazy chunk map).
EN strings referenced below exist verbatim in `.recon/specs/data/i18n-en.json` under `ui.sim.*`.

## 1. Routes

| path | render | notes |
|---|---|---|
| `/` | lobby. Prerender = "simulator entry" loading shell + SEO text; the lobby hydrates client-side | title `Play Riftbound Online - Rift Atlas Simulator`; description `Play Riftbound online with Rift Atlas, an unofficial fan-made simulator for room-code multiplayer, deck paste/import, solo testing, sealed practice, and manual board controls.`; canonical `https://play.riftatlas.com`; hreflang en/zh-CN/fr/ko/x-default |
| `/game` | board. Same prerendered entry shell; hydrates into the game board when a room session exists | robots-disallowed (`Disallow: /game`) |
| `/customize` | cosmetics (playmats, sleeves, nameplates, badges, tokens, emotes) — linked from lobby "Customize" | EN catalog namespace `sim.customization` |
| `/sign-in`, `/sign-up` | account auth pages | `Disallow` in robots; also embedded as an in-lobby `<dialog data-account-dialog>` |
| `/admin`, `/__browser/` | internal (disallowed) | |
| `/api/*` | app API (disallowed; includes `/api/version`, `/api/auth/*` passthroughs) | |
| i18n prefixes | `/fr`, `/ko`, `/zh-CN` for every route (`/fr/game`, …) | sitemap lists `/`, `/zh-CN`, `/fr`, `/ko` + xhtml alternates |

Root layout: `<html lang=en class="dark" data-riftbound-card-asset-locale="en" style="--riftbound-point-node-outline-image:url(…point-node-outline.png?v=1ea1e9a70be0ed76)">`, `<body class="Mjaeqa_variable lPk_nq_variable HIv3uW_variable _81nrpa_variable">` (font vars). Meta: `theme-color #07101c`, `color-scheme dark`, apple-mobile-web-app-capable, og:site_name `Rift Atlas Simulator`.

### Entry shell (SSR fallback, both `/` and `/game`)
`<main data-testid="simulator-shell" class="hub-theme relative isolate flex min-h-dvh flex-col items-center px-6 pb-10 pt-[max(2.5rem,calc((100dvh-30rem)/2))] text-text-main">`
- header `[data-testid=simulator-entry-header]`: hollow-gold mark (`…/brand/rift-atlas/rift-atlas-mark-hollow-gold.webp?v=20260713`, h-20), eyebrow `Play.Riftatlas`, `h1 RiftAtlas`
- loading card `[data-testid=simulator-entry-loading] role=status`: spinner + `Opening RiftAtlas…`
- recovery card `[data-testid=simulator-entry-recovery] role=status`: h2 `This is taking longer than usual`, p `RiftAtlas has not finished opening. Reload the page to start over.`, link `[data-testid=simulator-entry-retry]` `Reload page`
- sr-only SEO block `section[aria-labelledby=simulator-seo-title]`: h1 `Play Riftbound Online with Rift Atlas` + 3 paragraphs + 4 bullets (all in `sim.seo*` messages).

## 2. Lobby page shell (hydrated)

Structure (verbatim classes abbreviated; see rendered DOM for full strings):

```
div.hub-theme
  div.hub-persistent-controls-frame.pointer-events-none.fixed.z-170…top-3   ← sticky header
    header[data-testid=simulator-lobby-header][data-hub-persistent-header]  (grid max-w-7xl)
  section.sr-only (SEO)                                                     ← see entry shell
  div.contents[data-player-moderation-surface]
    div[data-testid=simulator-content]
      div.hub-theme.min-h-dvh
        div.contents[data-room-auth-recovery-surface]
          div[data-hub-scroll-frame][data-hub-scroll-surface=lobby] style="--hub-content-top:118px"
            div.lobby-shell … max-w-7xl, grid ≥1280px: 11rem | 1fr | 208px
              [rail promos] [lobby content col] [tournament promo] [footer]
```

### 2.1 Lobby header (`simulator-lobby-header`)
Grid `grid-cols-[minmax(0,1fr)_auto]`, `border-b border-[rgba(141,176,232,0.2)] pb-4`, cyan underline `after:w-36 after:bg-[linear-gradient(90deg,rgba(109,223,255,0.85),rgba(109,223,255,0))]`. Content:
- Brand block: link `aria-label="Lobby"` href `/` with hollow-gold mark `h-16 sm:h-20`; eyebrow `Play.Riftatlas` (10px uppercase `text-[#9fdff2]`); nav `aria-label="Card tools"`:
  - `a[data-testid=sim-card-browser-link]` → `https://riftatlas.com/cards` target=_blank, label `Card Browser` (lg+) / `Cards` (sm), external-link icon; title `Open Card Browser`.
  - button `[data-testid=sim-global-card-search-trigger]` `aria-keyshortcuts="Meta+K Control+K"`, `aria-label/title="Open quick card search (Control K)"`, kbd `⌘ K`/`Ctrl K`.
- h1 `Lobby` (`text-lg sm:text-xl md:text-2xl`), description `Paste a deck, then host or join a room.` (hidden <lg).
- phone menu button `.lobby-phone-menu-toggle` `aria-label="Open menu"` (lucide menu, hidden ≥sm).
- Account/utility cluster `[data-testid=simulator-account-actions]`:
  - locale `<select data-testid=hub-locale-select aria-label=Language>` options `EN / 简体中文 / FR / 한국어` (tone dark classes `text-slate-200 … scheme-dark`).
  - Contact `https://riftatlas.com/contact` (`aria-label="Contact Rift Atlas"`), Discord `https://discord.gg/8vfhVuUXmT` (`Discord-Symbol-White.png`; `aria-label="Join the Rift Atlas Discord"`), X `https://x.com/playriftatlas`.
  - signed-out: `Sign in` → `/sign-in?redirect_url=%2F` and `Sign up` → `/sign-up?redirect_url=%2F` (`[data-simulator-signed-out-actions]`).
  - utility row `[data-hub-utility-actions]`:
    - `button[data-hub-history-action=hub-game-history-trigger]` `Game history` — disabled signed-out, `title="Sign in to save game history and choose deck privacy."` (labels: `Game history`, ≥lg `History`).
    - `a[data-hub-page-action=customize]` `Customize` → `/customize` with red "new cosmetics" dot `[data-cosmetic-new-dot]` + sr-only `New cosmetics available`.
  - icon rail `.hub-icon-rail`: membership button `[data-riftatlas-membership-button][data-membership-dialog-trigger]` (`aria-label="Rift Atlas · Membership: Choose a membership"`), Buy Me a Coffee `https://buymeacoffee.com/riftatlas` (`aria-label="Support Rift Atlas on Buy Me a Coffee"`).

### 2.2 Builder-story announcement
`aside[data-testid=builder-story-announcement][aria-label="RiftAtlas builder story"]`
classes `flex min-h-11 items-center gap-2 border border-[rgba(109,223,255,0.24)] bg-[linear-gradient(90deg,rgba(12,35,48,0.88),rgba(10,24,40,0.78))] …`
- link `https://how-i-build.riftatlas.com`: `Six months of building RiftAtlas` (`Six months of RiftAtlas` on phones) — `Read the story` (cyan `text-[#79ddf5]`) + arrow-up-right
- `·`
- button: member mark + `Consider supporting us` / `Support us` (gold `text-[#ffe7b7]`) + heart
- dismiss `aria-label="Dismiss builder story announcement"`.

### 2.3 Left rail promo rotator (≥1280px, col 1, `w-44`)
`div[data-testid=lobby-rail-promo-rotator] sticky top-[max(0.75rem,calc(50vh-20.625rem))]` containing two cross-fading children (`transition-opacity duration-700`):
1. `[data-testid=lobby-rail-promo-tcgplayer]` — `aside[aria-label="TCGplayer affiliate ad"]`, link `https://partner.tcgplayer.com/c/6933192/3841236/21018?u=…tcgplayer.com/categories/…/riftbound-league-of-legends-trading-card-game/unleashed` (`aria-label="Shop Riftbound on TCGplayer"`, rel `noopener noreferrer sponsored`), image `…/static/ads/tcgplayer-international-shipping-skyscraper.jpeg?v=13738ece4d852947` (176×660).
2. `[data-testid=lobby-rail-promo-metafy]` — `aside[data-testid=lobby-metafy-emotes-banner][aria-label="Rift Atlas membership emotes and artwork"]` h-[40.9rem] card: eyebrow `Members only`, title `Say it with Poros`, sub `Animated emotes, sleeves and tokens.`, collage of cosmetic thumbs from `https://play.riftatlas.com/cosmetics/creators/…/{playmats,sleeves,tokens}/…/thumb.webp`, animated Poro (Rive, `data-poro-rive` / `poro_wave`), CTA `Become a member` (gold outline) + credit `Art by Loot Pixie · nickangerPNG · Glitched Goober`; testid `lobby-metafy-emotes-banner-cta`.

### 2.4 Deck column (`section.lobby-deck-column`, col 2 left)
Background glow divs (radial gradients `rgba(110,78,255,.32)` / `rgba(81,225,255,.22)`, blur 70px).

**Deck overview row** `div.lobby-deck-overview.grid.gap-7.md:grid-cols-[11rem_minmax(0,1fr)]`:
- portrait `aside.lobby-deck-portrait`: `div[data-testid=sim-lobby-deck-preview][data-card-art-frame]` `aspect-[63/88]` bordered card-art frame; below, count rows (`text-[0.74rem] uppercase tracking-[0.12em] text-[#b9c7da]`, 6 rows):
  `Legend 0/1`, `Champion 0/1`, `Main Deck 0/39`, `Battlefields 0/3`, `Runes 0/12`, `Sideboard 0/10` (values `<strong class="text-gb-text-main">`).
- deck content `div.lobby-deck-content`:
  - heading: `p.truncate.text-[1.2rem]` — default `Paste a deck`; status badge `p.mt-2 … border-[rgba(242,138,138,0.54)] bg-[rgba(91,22,22,0.46)] text-[#ffd5d5]` — `Choose or import a deck first.` (red); other states from `sim.deck*` catalog.
  - toggle `button.lobby-deck-details-toggle` `View deck details` / `Hide deck details` (hidden <md), `aria-controls="lobby-deck-details"`.
  - toolbar `div.lobby-deck-toolbar`: tablist `[aria-label="Deck panel view"]` two tabs **List** (`#deck-list-tab`, `aria-selected=true`) / **Stats** (`#deck-stats-tab`), classes `h-8 min-w-18 text-[0.68rem] font-semibold uppercase tracking-[0.14em]`; right: `label Private deck` with checkbox (disabled signed-out, `title="Sign in to save game history and choose deck privacy."`, lock-keyhole icon).
  - details `#lobby-deck-details` → `#deck-list-panel[role=tabpanel]` `md:grid-cols-3`:
    - groups: Legend `No legend.`, Champion `No champion.`, Main Deck `No main deck cards.` | Sideboard `No sideboard.`, Battlefields `No battlefields.`, Runes `No runes.` (empty states), headings `text-[0.72rem] uppercase tracking-[0.14em] text-[#d9c28e]`.
    - populated list rows come from board chunk (grouped by type/energy), classes in `0xawjzm3yjpr1.js`.
  - actions `div.lobby-deck-actions` (`md:grid-cols-[auto_1fr_auto]`), all buttons share `inline-flex h-11 min-w-[10.5rem] … border-[rgba(194,162,255,0.34)] bg-[linear-gradient(180deg,rgba(63,44,94,0.9),rgba(34,25,58,0.94))] text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[#f3ebff] …`:
    - `Import Deck` (upload icon) — always enabled
    - `New Deck` (plus icon) — `title="Sign in to use your saved deck library."`
    - right group: `Choose Deck` (folder-open + lock icons), `Save Deck` (save + lock, `disabled` when signed out)
  - Deck-empty alert + errors in `sim.deckPaste*`, `sim.noPlayableDeckSaved`, etc.

### 2.5 Right panel (`section.lobby-side-panel.lobby-entry-panel`)
1. **Player**: `label for=right-rail-player-name` `Player`; `input#right-rail-player-name placeholder="Your name" maxlength=24` (class `input-field mb-0! h-full w-full border-[rgba(112,196,214,0.26)] bg-[rgba(10,18,33,0.82)] px-3 py-[0.45rem]`).
2. **Quick Match** (`section[aria-labelledby=lobby-quick-match-heading]`):
   - h2 `Quick Match` (`text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-[#d4dde9]`).
   - mode fieldset (`legend.sr-only` `Play Mode`): 2-column segmented control (`border border-[rgba(132,150,184,0.2)] bg-[rgba(6,12,22,0.72)] p-1`), buttons `min-h-10 px-2 text-[0.76rem] tracking-[0.1em]`, active = `bg-[rgba(29,67,83,0.94)] text-[#eaf7ff] shadow-[inset_0_0_0_1px_rgba(116,239,255,0.6)]`:
     - `Constructed` (default; constructed vs sealed + pools/tables are chosen in the settings dialog)
     - `Radiance · Pre-Rift` (wordmark image `…/static/sets/radiance-wordmark.webp?v=cf8726d966838e8e` + `Pre-Rift` caption), disabled signed-out (`title="Sign in to use Radiance · Pre-Rift."`), lock icon + `NEW` hanging tag (`zZWz6q_hanger/pin/swing/string/tag`).
   - settings row (`[data-quick-match-settings]`, `border border-[rgba(132,150,184,0.18)] bg-[rgba(10,18,31,0.56)]`): `p[data-quick-match-summary]` = `1v1 · BO1 · Standard` (title same) + `Change` button (`sliders-horizontal` icon, `aria-haspopup=dialog`) opening the quick-match options dialog (`sim.matchmaking` strings: pools `Standard / Origins`, formats `Best of 1 / Best of 3`, tables `Duel / 3-player free-for-all / 4-player free-for-all / 2v2`, `Random`, teammate rules `Teammates may not share a Legend or battlefield.` etc.).
   - submit: **`Find Random Match`** (`h-12 w-full`, gradient `linear-gradient(180deg,rgba(120,78,255,0.94),rgba(39,101,207,0.96))`, glow, uppercase; wrap span `title="Sign in to play or spectate."` when signed out; `aria-busy` during search). Searching state renders cancel/resume UI from `sim` matchmaking strings (`Cancel Search`, `Resume Search`, `Search paused`, `Reconnecting to matchmaking`, `Your search may still be active. Resume to check for a match.`).
3. **Private play** (`section.lobby-private-play-section`):
   - h2 `Private play` (gold `text-[#f1dfba]`), buttons:
     - **`Host Room`** (cyan gradient, h-12)
     - **`Solo Room`** (gold gradient `rgba(78,52,28,0.9)→rgba(43,27,18,0.94)`, text `#f8e8c0`)
   - `form`: `label[for=join-code] Room Code` (`text-[0.68rem] …text-[#e7c98b]`), `input#join-code placeholder="AB12CD" maxlength=10` (`input-field … font-mono tracking-[0.18em] uppercase`), submit **`Join / Spectate`** (gold, h-11, `sm:min-w-[10rem]`).
   - Signed-out title on all four actions: `Sign in to play or spectate.` — clicking opens the account dialog (verified in `19-solo-room-no-deck.png`; solo also requires sign-in).

### 2.6 Tournament promo rail (≥1280px, col 3, 208×660, collapsible)
`aside[aria-label="RiftAtlas tournament promotion"]` sticky, panel `#lobby-tournament-promo-panel` with radial gradient border. Content: `h2 RiftAtlas Convergence #4` (`lobby-tournament-title`), `Premier Tournament Series`, date `October 31 / 5:15 PM / Your time · UTC+02:00` (button `[data-testid=tournament-promo-time-zone-trigger]`, `aria-label="Show Convergence time zone details. Your time: …"`), broadcast link `https://www.turnemsideways.gg/` (logo `turnem-sideways-logo-v1.webp?v=d788c9bc48fdec7b`, labels `Official Broadcast` / `Turn'em Sideways`), stats rows `Prize Pool Up to $5,500 / Entry $30 / Player Cap 256`, `Event Details` list `Format Swiss + Top 16`, `Matches Best of 3`, `Round Time 60 Minutes`, CTA `Register Now` → `https://topdeck.gg/event/convergence-4` (`aria-label="Register for RiftAtlas Convergence #4"`), collapse button `aria-label="Collapse tournament promotion"`.

### 2.7 Lobby footer
`footer` under a `mt-auto` row (col-span 3): `Play.Riftatlas is an unofficial fan project for Riftbound: League of Legends Trading Card Game. It uses Riot Games-owned IP under Riot Games' "Legal Jibber Jabber" policy. Riot Games does not endorse or sponsor this project.` + `nav[aria-label="Legal and support"]`: `Patch Notes https://riftatlas.com/changelog`, `Legal Notice …/legal-notice`, `Privacy Policy …/privacy-policy`, `Terms of Service …/terms-of-service`, `Contact …/contact` (all target=_blank, class `text-text-dim hover:text-text-main`).

### 2.8 Dialogs & overlays (always mounted)
- `<dialog data-account-dialog aria-modal>` (custom account-auth UI): "Sign in to Rift Atlas" title with mark, SSO buttons `Continue with Google / Discord / Twitch` (brand svgs), divider `or`, `Email address` + `Continue` (POST sign-in, Turnstile hidden input `cf-turnstile-response`), footer `New to Rift Atlas? Create an account`. Uses `--account-*` CSS vars; `account-card:` container-query classes for card layout. Close button `aria-label=Close`.
- 3× `<dialog data-metafy-membership-dialog data-membership-provider="metafy">` (membership tiers; content from `sim.customization.stripeMembership` catalog).
- toaster `div.pointer-events-none.fixed.right-4.bottom-4.z-180 …` (`[data-player-moderation-surface]` container above).
- `<section aria-label="Notifications alt+T" …>` (react-aria live region).

## 3. Guest vs signed-in behaviour (verified)

- Guests can: browse the lobby, view promos, type a player name, paste/import a deck (Import Deck modal works, deck stays client-side), open `/customize` link, open card browser, change locale/theme.
- Guests cannot: Choose Deck / Save Deck (disabled, lock icons), Game history (disabled), Radiance Pre-Rift, `Find Random Match`, `Host Room`, `Solo Room`, `Join / Spectate` (all carry `title="Sign in to play or spectate."` and clicking raises the account dialog — screenshot 19).
- Every play path (quick match, private room, solo) therefore requires an account. After sign-in the same buttons enqueue matchmaking / call the room API.

## 4. Deck import modal (`12-import-deck-dom.html`, `15-use-deck-code-dom.html`)

`div[role=dialog][aria-label="Import deck list"].lobby-deck-editor` (`max-h-[min(90vh,52rem)] w-full max-w-5xl border-[rgba(148,163,184,0.28)] bg-[linear-gradient(180deg,rgba(11,18,29,0.98),rgba(7,12,22,0.98))]`):
- header: eyebrow `Deck List`; `h2.heading-serif Import Deck`; status chip `.lobby-deck-editor-status` — `Paste a deck to continue` / `Ready to Import`(green `sim.readyToImport`) / error text; buttons `Use Deck Code` (`aria-label="Open deck code input"`, toggles code panel) and close `aria-label="Close deck editor"`.
- body grid `lg:grid-cols-[minmax(0,1fr)_18rem]`:
  - textarea `placeholder="Paste Riftbound deck export here..."` (`min-h-112 font-mono text-[0.95rem] leading-[1.52] text-[#ebf2ff]`, border turns red/green by parse state).
  - validation panel: heading `Import Validation`; empty copy `Paste a deck list to preview counts and validation.` + `Import stays locked until the parser has no errors.`; populated: per-section counts/sections/errors (`sim.deckParser*`, `sim.unknownHeaderIgnored`, `sim.exactCount` …); red theme while invalid.
- `Use Deck Code` panel: input `placeholder="Paste deck code..."`, buttons (Cancel / Apply, `disabled`) — code path uses `decodeDeckCode` + `sim.pasteDeckCodeFirst`, `sim.deckCodeUnknown`.
- footer: help `Paste a deck export to continue.`; `Cancel` (neutral) and `Import Deck` (purple, disabled until parse valid).
- After import the modal closes and the deck panel shows legend/champion/main/battlefields/runes/sideboard + counts; deck actions enable Choose/Save only when signed in.

## 5. Room shell (after creating/joining a room)

Once a room exists the lobby switches to the *room shell* (same URL `/`; state from `room_shell_sync`): seats grid `1..4` with `Team 1/2` for 2v2, `Open` seats, `Seat` labels, `Ready Up` / `Not Ready`, `Ready` states, `Both players need to click Ready.`, `Invite` (room code + `Copy` → `Room code copied`), deck registration status per seat (`Deck ready`, `Change deck`), host controls per `sim` errors: *only host can change game type/format/play mode/team seats/deck rules*, `Randomize Teams` (`Fill all four seats to randomize teams (n/4).`), `Start Game` gated by ready checks, `Return to Lobby` (private multiplayer only), `Create next game` for BO3, chat panel (`sim.lobbyChat`, `Lobby chat`, message count, retention), spectator roster + broadcast view for casters.
Room modes (wire values): `multiplayer` (Host Room), `solo_lab` (single-account sandbox — localized catalogs call it "Solo Lab", e.g. error `Rewind the latest Solo Lab action`), `single_player` (`Solo Room` → `Practice room` with `Add opponent`, `Two-Sided Practice`, goldfish). Game variants: `duel | free_for_all_3 | free_for_all_4 | teams_2v2`. Play modes: `constructed | sealed` (Radiance Pre-Rift unlocks signed-in only). Match formats: `bo1 | bo3` (3-4 player variants force BO1).

## 6. `/game` route & board shell

- Prerender identical to lobby entry shell.
- Hydrated board = other agent's scope (board chunk `0xawjzm3yjpr1.js`); shell-level facts: full-viewport board with `hub-theme`, top bar (room code chip, copy, turn/phase, settings `Game settings`, `Help`), right-side `sim.*` UI (score tracks, conquering prompts, rewind, log, chat/emotes), mobile touch layout (`disk`/`phoneControls` variants), spectators see restricted view (`watchingGame`, `Spectating: <name>`), broadcast view for staff.
- Missing/expired room states: `sim.shell.loadingDescription`, `preparingTitle`, `productName`; error copy `This room is unavailable: the server can no longer load it. Return to the lobby to start a new game.`; resync banner `Realtime match state is resyncing. Please wait.`

## 7. `/customize` route (cosmetics)

Sections from `sim.customization` catalog: page eyebrow `Rift Atlas membership`, title `Customization`, `Playmats, sleeves and member cosmetics.`; board cosmetics `Choose one playmat and separate sleeves for your main deck, rune deck, and battlefield deck.`; tabs/slots `Playmat`, `Card sleeve`, `Rune deck sleeve`, `Battlefield sleeve`, `Nameplates`, `Account badges`, `Tokens`, `Other`; controls `Artwork visibility`, `Glass behind play zones`, `Playmat motion`, `Hide standard board chrome`; live preview panel (`You`/`Opponent`, `Main`/`Runes`/`Battlefields`, `View full board`); membership panel (`Membership`, tiers Community Member/Supporter/Champion/Legend/Signature Legend, `Become a member`, Stripe checkout states, Metafy linking); voucher redeem + account history popovers. Requires sign-in for saving; free designs equippable by any account.

## 8. Rebuild checklist (key data-testids & CSS hooks)

`simulator-shell`, `simulator-entry-header/loading/recovery/retry`, `simulator-lobby-header`, `sim-card-browser-link`, `sim-global-card-search-trigger`, `simulator-account-actions`, `hub-locale-select`, `builder-story-announcement`, `lobby-rail-promo-rotator|tcgplayer|metafy`, `lobby-metafy-emotes-banner(-cta)`, `sim-lobby-deck-preview`, `lobby-deck-details`, `deck-list-tab`, `deck-stats-tab`, `right-rail-player-name`, `join-code`, `lobby-quick-match-heading`, `data-quick-match-summary`, `data-quick-match-settings`, `lobby-private-play-actions`, `lobby-room-code-actions`, `tournament-promo-time-zone-trigger`, `lobby-tournament-promo-panel`, `data-account-dialog`, `data-metafy-membership-dialog`, `data-hub-persistent-header`, `data-hub-scroll-frame`, `data-hub-scroll-surface=lobby`, `data-player-moderation-surface`, `data-room-auth-recovery-surface`, `data-room-auth-surface-portal-host`. CSS hooks: `hub-theme`, `hub-header-*`, `hub-icon-rail`, `hub-phone-*`, `hub-game-history-*`, `lobby-shell`, `lobby-deck-*`, `lobby-entry-panel`, `lobby-side-panel`, `lobby-main-grid`, `input-field`, `btn-standard`, `heading-serif`, `page-shell`, plus responsive breakpoints `sm 640 / lg 1024 / xl 1280 / min-[1280px] grid / 2xl 1536`.
