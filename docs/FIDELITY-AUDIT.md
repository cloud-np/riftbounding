# Fidelity audit — clone vs. riftatlas.com/play + play.riftatlas.com

**Auditor:** B21 (read-only)
**Date:** 2026-10-23
**Stack used:** realtime `:2004` (persist `/tmp/opencode/b21-state`, seeded `atlas` / `1234`), play `:3100` (`NEXT_DIST_DIR=.next-b21`), site `:3101` (`NEXT_DIST_DIR=.next-b21`).
**Evidence:** `apps/play/.verify/b21/` (our screenshots, live-original screenshots, Playwright scripts, `cost-evidence.txt`, `timing-evidence.txt`, measured JSON). Original screens are cited as `.recon/screens/<file>`; live read-only captures are `apps/play/.verify/b21/original-*.png`.

> No source file under `apps/**` or `packages/**` was edited. B19/B20 areas (deck peek, emotes/pings, game-over, sideboard chips, opponent cosmetics, rewind storage, FFA/2v2, rematch/series, account sign-up) are marked **in progress** and were not ranked.

## Method

1. Ran the clone stack end-to-end (guest + `atlas` account, solo and two-client multiplayer) and drove the real UI with Playwright — no `window.__riftDebug` in the fidelity flows.
2. Captured every required state at 1920×1080, plus 1440×1000, 1000×1000 and 390×844 for the site, lobby, room shell and board.
3. Re-captured public original states read-only (`GET` only, no login, no form submission) and measured/diffed with ImageMagick (`compare -metric RMSE`) and DOM rects. Where the original is login-gated (live room/board), used `.recon/screens/50–54`, `.recon/screens/60`, `.recon/specs/`, and the prettified bundles.
4. Diffed original `data-*`/class hooks from `.recon/browser/45-board-preview-dom.html` against our rendered source. Found the hand area missing `z-9`, the action rail missing `data-player-area="actions"`, and the phone-layout selectors dead because `data-tablet-layout` is hard-coded `false`.
5. Re-ran any flow that hit a transient compile/reconnect issue; one reconnect banner (B20 reloading wrangler) was discarded.

## Ranked gaps

| # | Priority | Area | What the original does (evidence) | What ours does (evidence) | Suggested fix |
|---|---|---|---|---|---|
| 1 | **P0** | Card costs / payment | Hand cards cost energy. Original blocks a 3-cost with 2 ready runes, opens auto-pay/payment, and logs the payment (`52-board-autopay-rune-float.png`; spec `payment_batch`, `auto_pay_button` in `.recon/specs/02-hotkeys-and-menus.md`). | Dragging or context-menu **Play** sends a raw `move_card` from hand to base. In a real 2-client room a **3-cost Unit was played with 0 floating energy and 2 runes**, no payment prompt, no error; same in solo (4-cost at 0/2). `BoardInteractionProvider.tsx:572–598`. Evidence: `cost-evidence.txt`, `mp-cost-after.png`, `cost-test-after.png`. | Add a validated `play_card` intent used by both drag and menu; run `buildAutoPayPaymentBatch` + payment prompt, reject when unpayable, emit payment log rows. |
| 2 | **P0** | Responsive board / touch | Dedicated touch layout exists: original CSS only applies the phone/tablet rules under `[data-tablet-layout=true][data-board-arrangement=phone-portrait]`; landing advertises phones/tablets; `60-mobile-full-board.png`. | `data-tablet-layout="false"` and `data-tablet-compact="false"` are hard-coded (`GameBoardView.tsx:324–326`), so every phone/tablet rule in the verbatim CSS is dead. At 390×844 the battlefields are off-screen, hand is clipped, and the room-shell header overlaps (`board-390.png`, `room-shell-solo-mobile-390.png`). | Derive tablet/phone mode from viewport + pointer, set `data-tablet-layout`, `data-tablet-compact`, `data-touch-layout`; render `data-player-area="actions"`; verify 390/844 and 1000. |
| 3 | **P1** | Board hand/rune rail | At 1440 the original hand fan starts at x≈150 and the rune deck hugs the left score rail; the fan is left-anchored under the local band (`51-board-with-log.png`). | Our fan starts at x≈496; rune row x≈145 and rune deck x≈175 are shifted right. `--rune-deck-lane-x` is computed as `max(--lane-left-x, …)` and the rune area gets an extra `translate(--left-lanes-x)` wrapper (`PlayerLayer.tsx:135,140`). `board-1440-clean.png` vs `51-board-with-log.png`. | Use the original layout module’s rune-deck lane offset, drop the extra RuneArea translate, and re-check hand at x≈150 / rune deck at the left edge. |
| 4 | **P1** | Match log | Original log shows the newest action at the bottom (and “Rewound to before their last action.” rows) without clipping (`51-board-with-log.png`, `50-board-rewind-overlay.png`). | `ul` is `overflow-auto` with no scroll ref/effect (`GameLogPanel.tsx:71`); after a play the newest entry is below the clip, and rewind rows never appear in view. `board-after-play-1920.png`, `cost-test-after.png`, `board-rewind-overlay-1920.png`. | Add a ref and `scrollTop = scrollHeight` on entry/phase changes; reserve bottom padding; verify with a played card and rewind. |
| 5 | **P1** | Sidebar turn header | Two rows: `Turn N` + `Kai's turn`; below `04:15` + `ROOM: PZUSU` + 4 tool icons (`51-board-with-log.png`; `45-board-preview-full.png`). | Five stacked rows: `Turn 1` / `ATLAS'S TURN` / `MAIN PHASE` / `00:20` / `ROOM: …`, about twice as tall, pushing MATCH LOG down ~60 px (`BoardHeader.tsx:186–232`; `board-1440-clean.png`). | Two-row grid: turn + active player on row 1, clock + room on row 2; remove the separate phase line (or move it to a tooltip); match case/size. |
| 6 | **P1** | Rewind overlay | Small simple clock (~240 px) left of centre, strong board dim, rewind rows in log (`50-board-rewind-overlay.png`). | Ornate compass/clock asset at `min(30rem,42vh)` ≈ 453 px, weak dim, no log rows visible (`RewindOverlay.tsx:175–203`; `board-rewind-overlay-1920.png`). | Use the original simple clock/SVG at ~15 rem / 26 vh, stronger backdrop, and surface the rewind log entries. |
| 7 | **P1** | Radiance tab after import | Importing a Radiance deck switches the **card pool** to Radiance but keeps **CONSTRUCTED** selected (`26-lobby-deck-imported.png`). | `handleImport` sets both `cardPool: "radiance"` **and** `playModeTab: "radiance"` (`LobbyContainer.tsx:394–399`), so the Radiance tab is highlighted and persisted as `"sealed"`. `lobby-deck-imported-1920.png`. | Set only `cardPool`; leave `playModeTab` at `constructed`; persist `"constructed"`. |
| 8 | **P1** | Card-pool validation | With a Radiance deck, Standard is **locked** with a lock icon and a footer note “Deck uses Radiance cards” (`32-mode-change-picker.png`). | Both Standard and Radiance remain selectable; no note; panel is 403 px wide vs 383 px (`SidePanel.tsx:150–185`; `lobby-match-settings-with-deck-1920.png`). | Disable the incompatible pool, add the note, and use the original 24 rem panel width. |
| 9 | **P1** | First-player choice timing | Dice → chooser banner → choice; no empty period. | `initiativeHold` hides the first-player overlay for 4.4 s after the phase changes (`SetupOverlays.tsx:60–66`); measured **~5.5 s** of dimmed, empty board before the options appear. Evidence: `timing-evidence.txt`, `timing-first-player-a-1920.png` vs `timing-first-player-c-1920.png`. | Gate the hold on the dice stage finishing (or show the chooser banner during the hold); never unmount both overlays; reduce hold to the remaining animation time. |
| 10 | **P1** | `/customize` navigation | Public Creator Studio + read-only board preview (`38-customize.png`, `45-board-preview-full.png`). | The lobby header links to `/customize` (`AppHeader.tsx:310`), but the route returns 404. Feature is “later” in ARCHITECTURE, but the visible link is broken. | Hide/flag the link until the route exists, or add a placeholder route that does not 404. |
| 11 | **P1** | Room code | Five-character codes (`V30BY`, `PZUSU` in `.recon/reports/01-browser-walkthrough.md`); room label + copy icon fit on one line. | `ROOM_CODE_LENGTH = 6` (`apps/realtime/src/core/ids.ts:10`); at 1440 the copy icon overlaps the last two characters of `ROOM: B9HZ4G` (`board-1440-clean.png`, `crop-header-zoom.png`). | Set length 5 and add a gap before the copy icon. |
| 12 | **P2** | Account dialog (B20 in progress) | Email-only + OAuth + 208 px Turnstile, 432×434 modal, empty email field (`original-account-dialog-live-1920.png`, `28a-solo-gate.png`). | 432×672 modal (intentional password + guest section), 312 px Turnstile, placeholder `atlas`, different title mark (`AccountDialog.tsx:108, 312–327`; `account-dialog-1920.png`). | Keep local auth behind a second step; match Turnstile 13 rem, empty placeholder, original Rift Atlas mark. |
| 13 | **P2** | Import empty validation | Empty state uses the red/error panel and red-tinted textarea (`original-import-dialog-live-1920.png`, `12-import-deck-modal.png`). | Empty state uses the neutral blue panel (`DeckImportDialog.tsx:71–76`; `deck-import-dialog-1920.png`). | Use the error tint for `!hasInput`; keep the footer status neutral. |
| 14 | **P2** | Import copy/validation | Title “Import deck”; uppercase variants report only `Missing required section: Main Deck.` plus warnings (`25-import-*.png`, `25-import-variants.json`). | Title “Import Deck”; adds missing Legend/Champion/Battlefields/Runes and “must contain exactly …” errors (`packages/cards/src/deck-text.ts:588,669,693,708,723`; `ours-import-title-nocodes.png`). | Match the original blocking rules and copy verbatim; title-case the dialog. |
| 15 | **P2** | Membership nav | Crown icon + “Membership” label at desktop (`lobby-original-1000.png`, `lobby-original-1440.png`). | Crest icon only; no label (`AppHeader.tsx:330–360`; `lobby-ours-1000.png`). | Show the crown + label at ≥sm, keep icon-only on mobile. |
| 16 | **P2** | Deck STATS tab | Full-width 0–8 energy axis, domain glyphs, Power cost row, unit-might bars (`35-lobby-deck-stats.png`). | Only present buckets in a 10-column grid (right third empty), no axis labels, domain dots, no Power cost, unit-might bar clipped (`DeckStats.tsx:92–115`; `lobby-deck-stats-1920.png`). | Render fixed 0–8 buckets, domain icons, Power cost, and size the charts like the original. |
| 17 | **P2** | Board frame | 1 rem total inset, `rounded-sm` (2 px), page bg `rgb(7,16,28)` (`49-board-zonemap.json`, `51-board-with-log.png`). | `0.3rem` viewport padding, `rounded-2xl` (16 px), bg `#060b15` (`GameBoardView.tsx:84–87`, `GameScreen.tsx:528`, `.sim-game-viewport`). | Match the 0.5 rem gutter, 2 px radius and `#07101c` background. |
| 18 | **P2** | Setup option metadata | Multiplayer first-player options carry player/team/relation chips; the local mulligan 1st/2nd badge is mirrored to the left (`setup-mulligan-overlays.md`). | Labels only; both mulligan badges sit on the right (`FirstPlayerChoiceOverlay.tsx:102–118`, `MulliganOverlay`; `setup-mulligan-1920.png`). | Render the metadata chips and mirror the own-row badge. |
| 19 | **P2** | Phase indicator | One main-phase indicator in the original board (`51-board-with-log.png`). | When it is the opponent’s turn, both `PhaseIndicator` and `OpponentPhaseIndicator` render (`GameBoardView.tsx:447–460`); top-left and bottom-right “MAIN PHASE” both appear (`mp-board-guest-1920.png`). | Render one indicator based on active side; place it per the original. |
| 20 | **P2** | Turn action rail | Original player band has `data-player-area="actions"` with small 34 px Switch/End buttons (`.recon/browser/45-board-preview-dom.html`, `51-board-with-log.png`). | No `data-player-area="actions"`; 60–64 px card-like buttons (`TurnControls.tsx:44–97`; `board-1440-clean.png`). | Add the hook and match the original button dimensions/classes. |
| 21 | **P2** | Log styling | Blue/gold turn band, no per-row outline, inline card thumbnails (`51-board-with-log.png`). | Flat green band and outlined rows (`GameLogPanel.tsx:54,71`; `board-1440-clean.png`). | Match the original group band/row chrome and card chips. |
| 22 | **P2** | Hand stacking | Hand area class includes `z-9` (`.recon/browser/45-board-preview-dom.html`). | Missing `z-9` (`PlayerLayer.tsx:31`). | Add `z-9` and verify hand/hover stacking. |
| 23 | **P2** | Game history | Signed-in history exists in the original. | Placeholder modal (`GameHistoryDialog.tsx:14`), phase 2. | Gate/hide until implemented, or wire history. |
| 24 | **P2** | NEW DECK | Opens the `/decks/new` builder (`20-decks-new.png`). | Opens the Import dialog (`LobbyContainer.tsx:404–410`). Out of scope, but the label is misleading. | Link to the external builder or relabel as “Import”. |

## Matches well

- **Launcher site `/play` is effectively pixel-perfect.** 1920/1440/1000/390 viewports and the full-page captures match the original (1920 full-page both 4514 px; 390 full-page both 3774 px). ImageMagick RMSE: **0.26 %** at 1920 viewport, **0.30 %** at 1000, **0.51 %** at 390. All copy, sections, videos, footer and responsive breakpoints match.
- **Lobby layout and geometry.** Live original vs ours: header/logo/title, deck panel, buttons (`IMPORT`/`NEW`/`CHOOSE`/`SAVE`), player panel, quick-match, private play and room-code boxes align within ~5 px at 1920; deck panel and buttons are identical at 1000. Mobile 390 lobby is visually near-identical. Residual diff is almost entirely the missing “Membership” label and promo/ad imagery (RMSE 3.9 %/4.7 %/10.5 % at 1920/1440/1000).
- **Deck import dialog geometry/content.** Same 1021 px modal, header tabs, textarea, live counts, warning text and footer. Valid and colon-style imports produce identical counts; the only differences are the empty-panel tint and extra blocking copy listed above.
- **Room flow.** Guest/account sign-in, deck import, Host/Solo room creation, join by code, ready-up, Start Match, and authoritative two-client sync all work with no console/page errors.
- **Setup.** Battlefield pick, initiative roll, mulligan, and first-player choice are implemented with the original English copy and artwork; the goldfish overlay is especially close.
- **Board.** Uses the original design tokens/classes (`gb-*`), card faces/backs, hand fan math, score rails, identity rails, rune areas, battlefield surfaces, hover preview (with keyword rules and `S RESOLVE` / `T TARGET` chips), chat, settings sliders, action dock, context menus, drag ghost, and sounds. Chat, end turn, play/drag, rewind trigger and hover all worked; no page errors in any capture.
- **Static assets/fonts.** Bricolage Grotesque, card CDN art, playmats, card backs, set marks, rune/domain art and UI icons load; no unexpected 404s in the Playwright console (only filtered image/CDN noise).

## Coverage matrix (required screens/flows)

| Original capture | Reproduced? | Result |
|---|---|---|
| `01-landing`, `31-mobile-landing` | yes (`site-play-*.png`) | match; see RMSE above |
| `10-simulator-landing`, `30-mobile-lobby` | yes (`lobby-*`, `lobby-original-*`) | match; Membership label gap |
| `11-deck-picker` | yes (`lobby-deck-picker-1920.png`) | saved-deck picker opens; empty state (no saved decks) |
| `12-import-deck-modal`, `15`, `16`, `25-*` | yes (`deck-import-dialog-1920.png`, `ours-import-*`) | geometry match; P2 tint/copy |
| `19`, `27`, `28a–d` gates | yes (`account-dialog-1920.png`) | account dialog; intentional guest path |
| `26-lobby-deck-imported`, `35-stats`, `32-mode-picker` | yes (`lobby-deck-imported-1920.png`, `lobby-deck-stats-1920.png`, `lobby-match-settings-with-deck-1920.png`) | P1 Radiance/pool, P2 stats |
| `49–54` board states | yes (`board-1920.png`, `board-1440-clean.png`, `board-rewind-overlay-1920.png`, `board-after-play-1920.png`) | P1 hand/header/log/rewind |
| `60-mobile-full-board` | yes (`board-390.png`) | P0 touch layout |
| `13/14/17/20/21/23/38–48` marketing/decks/cards/sealed/customize | no (out of scope by ARCHITECTURE) | `/customize` link is a P1 404; the rest are not in `apps/site` phase 1 |
| `36-ctrl-k-card-browser` | partial (`lobby-card-search-1920.png`) | command palette exists; original capture does not show the open state, so not ranked |
| `29-play-preview-*` | yes via launcher site | match |

## In-progress areas (not ranked)

- **B19:** deck peek, emote/ping wheel, game-over overlay, sideboard chips, opponent cosmetics. Components exist (`DeckPeekPanel`, `EmoteWheel`, `GameOverOverlay`, `SideboardingOverlay`) and were intentionally not audited visually.
- **B20:** rewind storage/snapshots, FFA/2v2 matchmaking + lobby UI, rematch/series, account sign-up. Rewind trigger works; 2v2 is present in the table picker; account sign-up is under active edit. One transient “Realtime room connection lost” banner appeared while wrangler reloaded; retried and discarded.
- **Payment/targeting/showdown prompts:** source components exist, but the payment prompt is effectively unreachable while gap #1 is present; no public original capture of the live prompts exists beyond the demo frames (`53-board-conquer-prompt.png`).

## Reproduction

```bash
# realtime
WRANGLER_PERSIST_TO=/tmp/opencode/b21-state pnpm --filter realtime exec wrangler dev --port 2004 --persist-to /tmp/opencode/b21-state
cd apps/realtime && WRANGLER_PERSIST_TO=/tmp/opencode/b21-state node scripts/auth-bootstrap.mjs

# play
cd apps/play && NEXT_DIST_DIR=.next-b21 NEXT_PUBLIC_REALTIME_HOST=localhost:2004 \
  NEXT_PUBLIC_AUTH_BASE=http://localhost:2004 pnpm exec next dev --port 3100

# site
cd apps/site && NEXT_DIST_DIR=.next-b21 pnpm exec next dev --port 3101

# audit scripts (all under apps/play/.verify/b21)
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/capture-basics.mjs
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/capture-game.mjs
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/capture-board-clean.mjs
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/capture-multiplayer.mjs
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/check-mp-cost.mjs
PLAY_URL=http://localhost:3100 REALTIME_URL=http://localhost:2004 node apps/play/.verify/b21/check-first-player-timing.mjs
node apps/play/.verify/b21/capture-live-original.mjs   # read-only GET, no login
```
