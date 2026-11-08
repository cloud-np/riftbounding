# 02 — Game Board UI & Interactions (Riftbound simulator, play.riftatlas.com/game)

Recon of the **board chunk** `_next/static/immutable/chunks/0xawjzm3yjpr1.js` (1 103 KB raw,
2 380 KB prettified, **65 017 lines, ONE Turbopack module id `430427`**), plus
`439rnwycqsxxv.js` (layout-math modules `637428/426582/9961/997490/929289/793143/112691`),
`25vik2nxxo51i.js` (card module `298551`, flip module `612518`, card-motion module `938822`),
`2atnqtfqvj-z4.js` (setup/mulligan overlays) and the compiled Tailwind v4 CSS in
`.recon/site/playapp/dl/_next/static/immutable/chunks/*.css`.

Everything quoted below is **verbatim from the shipped bundle**. `f4`/`cs`/`sX`/`ps`… are the
minified names; descriptive names are marked _(derived)_.

---

## 0. Tech facts that shape the re-implementation

| concern | finding |
|---|---|
| framework | React 19 + **React Compiler** (memo-cache boilerplate `C[0]!==x?...`, `Symbol.for("react.memo_cache_sentinel")`) |
| styling | **Tailwind v4** compiled to `@layer theme/properties/components/utilities`; heavy use of arbitrary values incl. CSS-var-driven arithmetic (`w-(--card-width)`, `grid-cols-[var(--rune-play-width)_…]`, `[--x:calc(...)]`) |
| animation | **framer-motion** (`b.f.div`, `layoutId`, `AnimatePresence`) + WAAPI (`el.animate([...], opts)`) + CSS `@keyframes` |
| drag & drop | **native HTML5 DnD** (`draggable`, `onDragStart/onDragEnter/onDragOver/onDragLeave/onDrop/onDropCapture`) **and** raw pointer events for the ghost/ping/long-press paths (`onPointerDown/Move/Up`, `setPointerCapture`) — *no* dnd-kit |
| 3D | three.js only for the initiative dice stage + matchmaking rift (lazy chunks) |
| store | custom external store + `useSyncExternalStore`; props-drilled `GameBoardView` above it |
| text | i18n via key functions (`t6("sim.…")`, `eg("current.…")`); game-log has its own ~256-key catalogue per locale |

---

## 1. Component tree

```
GameBoardView  (f4, 0xawjzm3yjpr1.js:48589-65018)
├─ <section class="gb-board …">                       ← board root (2 variants, see §2.1)
│  ├─ <div data-board-play-area>                      ← playmat host
│  │   ├─ PlaymatSurface  (rH.t)  side="opponent"     ← opponent half of the playmat image
│  │   ├─ PlaymatGlass    (ar.f)  side="opponent"     ← frosted-glass overlay
│  │   ├─ PlaymatSurface  (rH.t)  side="self"
│  │   ├─ PlaymatGlass    (ar.f)  side="self"
│  │   ├─ RewindConfirmationPanel (hg)
│  │   ├─ TurnBanner (es)  {extraTurn, roomPhase, side, turnNumber}
│  │   ├─ InitiativeDiceStage (r1)                    ← lazy three.js dice (recentDieRolls)
│  │   ├─ InitiativesIndicator (iZ)
│  │   ├─ BoardLinesAndBase (m4)                      ← base + board-lines zone
│  │   ├─ BoardTurnControls (fX)                      ← end-turn / phase / time-warp (bottom + top)
│  │   ├─ PhaseIndicator (fG)  position="self"|"opponent"
│  │   ├─ ScoreTrack (ug)                             ← left/right score rails
│  │   ├─ PlayerLayer (cs)   × per player             ← legend / champion / main deck / trash /
│  │   │   │                                            runes / hand / lanes   (grid-area based)
│  │   │   ├─ LegendZone, ChampionZone, DeckPile (sJ/sq), TrashPile, BanishPile
│  │   │   ├─ RuneArea (sX sub-part), HandRail (sX)
│  │   │   ├─ NeekoLegendStack (gb-neeko-*), GbMiniaturePlayerLayer (um)
│  │   │   └─ CardTagStack / CounterOverlay / BuffBadge
│  │   ├─ BattlefieldLayer (ps)  × 1-4 columns         ← own / token / opponent (/ supplemental)
│  │   │   └─ BattlefieldSlot → BattlefieldPanel (mU might zone, markers, cards)
│  │   ├─ ShowdownPanel (m2) / ShowdownStatusRow (m1)
│  │   ├─ ChainPanel (c8) + ChainArtTimeline (cY)      ← right lane
│  │   ├─ DeckPeekPanel (mx)
│  │   └─ CardDragGhost (ux)                           ← fixed-position drag image
│  ├─ CompactOpponentRail (um) × N                     ← 3-4 player compact opponent boards
│  ├─ PresenceBadge (pJ) / RealtimePresenceRing        ← 2-player presence
│  ├─ HoverCardPreviewLayer (mt.HoverCardPreviewLayer) ← portal to document.body
│  ├─ TargetArrowOverlay (hj)  / TargetSelectionOverlay (hI)
│  ├─ BoardEmoteLayer (t3) / CardPingFlash (t4) / TokenBurstLayer (hA)
│  ├─ GameSelectionOverlay / SelectionPrompt (tK)
│  ├─ EmoteWheel (tn)  — see 02-hotkeys-and-menus.md §4
│  ├─ ActionMenuPanel (nc) / BoardActionPanels (nD)
│  ├─ GameSidebar (hu)                                 ← tabs: status|log|chat|chain|settings
│  │   ├─ SidebarStatusPanel (hw)  + Bo3Timers (hA)
│  │   ├─ SidebarHeader (hk)
│  │   ├─ GameLogPanel (ii)
│  │   ├─ GameSettingsPanel (u9)
│  │   └─ ChainPanel (c8) / ChainPanelMobile (ij)
│  ├─ OpponentLeftOverlay (m$) / PlayerReportDialog / JudgeChat panels
│  └─ overlays: tY (replay/timeline), tQ, tL, tG, pH.d, pH.m
└─ providers: eb.Provider (board context) → oI.z (drag/selection/hover context)
```

**Component inventory** (JSX-returning functions ≥ 9 top-level `jsx(` calls; line numbers in
`0xawjzm3yjpr1.js`):

| minified | lines | jsx | descriptive name |
|---|---|---|---|
| `ep` | 609-1191 | 15 | `SimulatorEntryStatus` / entry stage shell |
| `ek` | 1220-1444 | 19 | `TimeWarpDialog` (`time-warp-dialog*`, `time-warp-sweep`) |
| `tn` | 1671-1828 | 11 | **EmoteWheel** |
| `tR` | 2245-2375 | 10 | `GameSelectionIconButton` (`game-selection-icon/copy/actions`) |
| `tL` | 2497-2663 | 12 | `BanishedPlayPop` (`banished-play-pop*`) |
| `tW` | 3042-3287 | 22 | `GameSelectionPromptDialog` |
| `tX` | 3354-3619 | 12 | `DialogShell` + focus trap |
| `tG` | 3620-4074 | 27 | `DocksideBanishPrompt` / `KharoxOpponentPrompt` (`data-testid`s 4164/4244) |
| `tJ` | 4299-4530 | 15 | `InitiativeDecisionReveal` (`initiative-decision-reveal`) |
| `nc` | 7633-8060 | 14 | Action menu renderer |
| `nM`/`nE` | 8229-9459 | 15/24 | **Help tour** (spotlights, `data-board-hotkeys`, toggle scanning) |
| `oK`,`io`,`ij`,`iU` | 10071-15968 | 76/48/126/17 | **Judge & bug-report chat panels** (`judge-*`, `bug-report-*`) |
| `d_` | 19307-20553 | 41 | **Board card wrapper** (`data-hover-preview-anchor`, `onCardContextMenu`) |
| `sf` | 22514-23743 | 49 | Action/toggle menu panel (`data-board-action-panel`) |
| `sq` | 24180-24754 | 14 | **Pile** component (deck / trash / banish / rune deck) |
| `sX` | 24965-29048 | 100 | **HandRail + rune area + lane rails** |
| `ci` | 29234-29421 | 10 | Compact rune-domain counter rail |
| `cs` | 29518-31433 | 89 | **PlayerLayer** (`data-player-area`, `data-miniature-area`) |
| `cV` | 32073-32288 | 12 | Chain preview popover (`data-chain-preview`) |
| `cY` | 32289-32570 | 11 | **ChainArtTimeline** (`data-chain-art-timeline`) |
| `c8` | 32680-33870 | 68 | **ChainPanel** (`tablet-chain-*`) |
| `um` | 34053-34905 | 42 | **Compact opponent board / identity rail** |
| `ux` | 34969-35262 | 26 | **CardDragGhost** (`data-card-drag-ghost`) |
| `u9` | 37687-38070 | 26 | **GameSettingsPanel** |
| `mx` | 39176-39758 | 41 | **DeckPeekPanel** (`gb-deck-peek*`) |
| `m$` | 39865-40279 | 24 | OpponentLeftOverlay (`opponent-left-keep-playing-blocked`) |
| `mU` | 40397-40640 | 12 | Battlefield might zone (`data-battlefield-might-*`) |
| `m1` | 40675-40971 | 23 | Showdown status row (multiplayer) |
| `m2` | 40972-41402 | 25 | **ShowdownPanel** (`expected-action-button--showdown`) |
| `ps` | 41779-43178 | 58 | **BattlefieldLayer / BattlefieldPanel** |
| `p$` | 44135-44196 | 9 | **CardFlip shell** (`backface-hidden`, `perspective-[980px]`) |
| `hu` | 44656-45611 | 60 | **GameSidebar** (tablet + phone) |
| `hg` | 45639-45997 | 20 | **RewindConfirmationPanel** (`data-rewind-confirmation`) |
| `hw` | 46012-46341 | 20 | Sidebar status panel (turn/room/players) |
| `hk` | 46342-46634 | 22 | Sidebar header (`data-sidebar-room-header`) |
| `hI` | 46655-46953 | 11 | TargetSelectionOverlay (`var(--game-selection-backdrop)`) |
| `hA` | 46963-47584 | 24 | TokenBurst / Bo3 timer layer (`data-burst-token`) |
| `fX` | 48143-48546 | 28 | **BoardTurnControls** (`data-board-turn-controls`) |
| **`f4`** | 48589-65018 | 82 | **GameBoardView** (the whole board) |

---

## 2. Layout system

The entire board is positioned by **CSS custom properties set inline on the root `<section>`**
(`yw` object, `0xawjzm3yjpr1.js:61660-61790`) plus per-layer token blocks in the root `className`.
Card size is the master scale: `--card-width: 5.2rem`, `--card-height: 7.242857…rem`
(ratio `1.392857 = 7.242857/5.2`; helper `n(e,t)=(e/5.2)*t` in module `793143`).

### 2.1 Board root — two variants

**Variant A** (compact / no score track), `0xawjzm3yjpr1.js:61780`:

```
gb-board relative h-full w-full grid grid-cols-[minmax(0,1fr)_var(--chain-lane-width)] [--battlefield-side-gap:calc(var(--card-width)*1.22)] gap-0 p-0 rounded-2xl border border-[rgba(134,168,246,0.42)] gb-board-root-bg shadow-[inset_0_-1px_0_rgba(6,12,27,0.4),0_12px_26px_rgba(3,8,20,0.5)] isolate select-none overflow-visible before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:gb-board-root-glow after:content-[''] after:absolute after:inset-[0.34rem] after:rounded-[0.48rem] after:pointer-events-none after:shadow-[inset_0_0_0_9999px_rgba(2,7,5,0.03)] [&_input]:select-text [&_textarea]:select-text [&_select]:select-text
```

**Variant B** (score track visible), `0xawjzm3yjpr1.js:63095`:

```
gb-board relative h-full w-full grid grid-cols-[minmax(0,1fr)_var(--chain-lane-width)]
[--score-track-lane-clearance:clamp(0.625rem,calc(var(--card-width)*0.12),0.9rem)]
[--battlefield-side-gap:max(6.3rem,calc(var(--card-width)*1.64),calc(var(--score-track-rail-width)+var(--track-player-nudge)+var(--track-player-nudge)+var(--score-track-lane-clearance)+var(--score-track-lane-clearance)))]
[--board-side-utility-edge-gap:0.5rem]
[--board-side-utility-width:min(9.4rem,calc(var(--battlefield-side-gap)-1rem))]
[--identity-badge-height:max(4.25rem,calc(var(--track-node-size)*1.18+0.32rem+var(--identity-badge-height-delta)))]
[--identity-badge-width:min(10.3rem,calc(var(--battlefield-side-gap)-0.5rem))]
[--identity-rail-width:var(--identity-badge-width)]
[--track-node-size:clamp(2.7rem,2.55cqw,3.9rem)]
[--track-node-winning-size:calc(var(--track-node-size)*1.24)]
[--score-track-column-gap:calc(var(--track-node-size)*0.34)]
[--score-track-rail-width:calc(var(--track-node-size)*2+var(--score-track-column-gap))]
[--score-track-stagger-offset:calc(var(--track-row-size)*0.5)]
[--score-track-terminal-offset:calc(var(--track-node-size)*0.5)]
[--track-row-size:calc(var(--track-node-size)*1.42)]
[--track-edge-inset:calc((var(--battlefield-side-gap)-var(--score-track-rail-width))/2)]
[--track-player-bottom:calc(var(--identity-badge-edge-inset)+var(--identity-badge-height)+var(--identity-track-gap))]
[--track-opponent-score-top:calc(var(--identity-badge-edge-inset)+var(--identity-badge-height)+var(--identity-track-gap))]
[--turn-control-bottom:calc(var(--battlefield-inset)-0.36rem)]
… + the same tail (border/shadow/gb-board-root-bg/before/after) as Variant A
```

Inline style map on the root (`yw`, verbatim keys):

```js
{ "--showdown-inline-left": s_ ? `${s_}px` : undefined,
  "--board-scale": sv,
  "--board-field-height": `${sb.fieldHeightRem}rem`,
  "--compact-turn-control-height": "2.75rem",
  "--tablet-hand-card-scale": sI,
  "--touch-player-band-padding": `${nW.G[sg.handControls]}rem`,
  "--desktop-ui-scale": tS.touchLayout ? 1 : Math.min(1.35, sb.boardScale <= 1 ? sb.boardScale : 1 + (sb.boardScale - 1) * 0.5),
  "--board-right-safety-gutter": `${sb.boardRightSafetyGutterRem}rem`,
  "--track-node-size", "--score-track-column-gap", "--score-track-rail-width", "--track-row-size",
  "--card-width": `${sP}rem`, "--card-height": `${sS}rem`,
  "--placed-card-width": `${sM}rem`, "--placed-card-height": `${sS * sA}rem`,
  "--card-peek-width": `clamp(${(8.8*ak).toFixed(3)}rem,${(24.2*ak).toFixed(3)}vw,${(15.4*ak).toFixed(3)}rem)`,
  "--battlefield-overlap": `${sT}rem`,
  "--battlefield-top-inset": touchLayout ? (sh ? "var(--tablet-opponent-band)" : phonePortrait ? "calc(var(--tablet-player-band) + var(--phone-score-height))" : "var(--tablet-player-band)") : (sh ? "calc(30% - 0.36rem)" : "calc(var(--battlefield-inset) - 0.36rem)"),
  "--battlefield-bottom-inset": touchLayout ? (phonePortrait ? "calc(var(--tablet-player-band) + var(--phone-score-height))" : "var(--tablet-player-band)") : "calc(var(--battlefield-inset) - 0.36rem)",
  "--local-player-layer-bottom-inset": `${0.32 * !!sh}rem`,
  "--chain-lane-width": `${sb.chainLaneWidthRem}rem`,
  "--identity-totem-width", "--identity-track-gap", "--identity-rail-pad", "--identity-rail-vpad",
  "--track-player-nudge", "--track-opponent-nudge", "--track-opponent-top",
  "--identity-badge-player-nudge", "--identity-badge-opponent-nudge",
  "--identity-badge-height-delta": "1.9rem",
  "--identity-badge-edge-inset": `${Math.max(0.16, sb.trackOpponentTopRem - 0.48)}rem`,
  "--turn-control-bottom": `${sb.turnControlBottomRem}rem` }
```

Root data attributes (all verbatim):

```
data-testid="game-ready"          data-lines-controls        data-end-turn-status
data-next-game-status             data-tablet-compact        data-tablet-layout
data-board-arrangement            data-board-measured        data-sidebar-presentation  ("overlay"|"inline")
data-hand-controls-above          data-board-density         data-board-short
data-board-tight-rail             data-player-identity-placement   data-hand-end-reserved
data-board-dragging               data-card-size-percent     data-compact-opponent-count
data-game-outcome                 data-suppress-board-hover-tone="false"
```

### 2.2 Play area + playmat halves

```jsx
<div data-board-play-area draggable
     className="relative h-full w-full rounded-xs overflow-visible"
     style={{ "--self-glass-intensity": yk.playmat?.intensity ?? 1,
              "--opponent-glass-intensity": yC?.playmat?.intensity ?? 1 }}>
```

| element | className (verbatim) |
|---|---|
| opponent playmat | `inset-x-[0.18rem] top-[0.18rem] bottom-1/2 z-0 rounded-t-[0.42rem]` |
| self playmat | `inset-x-[0.18rem] top-1/2 bottom-[0.18rem] z-0 rounded-b-[0.42rem]` |

### 2.3 Player band (per-player layer) — `cs`, `0xawjzm3yjpr1.js:30716`

`--player-band-size` tall, three rows, five columns, and a named `grid-template-areas`
(the single most important piece of board layout):

```
gb-board-layer absolute h-(--player-band-size) py-[0.22rem] grid
grid-cols-[var(--rune-play-width)_minmax(0,1.5fr)_var(--player-action-column-width)_var(--player-lane-column-width)_var(--player-lane-column-width)]
gap-x-[0.16rem] gap-y-(--player-board-row-gap) z-8 overflow-visible pointer-events-none
[--player-layer-inline-pad:0.16rem] [--deck-hand-shelf-lift:0.5rem] [--rune-deck-edge-lift:0.5rem]
[--rune-play-width:calc(var(--card-width)*5.45)]
[--left-lanes-x:calc(var(--battlefield-side-gap)-var(--player-layer-inline-pad))]
[--player-lane-column-width:calc(var(--card-width)*1.153846)]
[--player-action-column-width:max(calc(var(--card-width)*1.153846),7.05rem)]
[--player-board-row-gap:clamp(0.32rem,calc(var(--card-width)*0.075),0.58rem)]
[--wide-board-extra:max(0,calc(var(--board-scale)-1))]
[--wide-legend-base-clearance:min(calc(var(--card-width)*var(--wide-board-extra)*0.55),calc(var(--board-right-safety-gutter)*0.72))]
[--base-legend-clearance:max(0rem,calc(var(--left-lanes-x)-var(--lane-left-x)))]
[--right-lane-main-gap-offset:calc(var(--card-width)*0.04)]
[--right-lane-side-gap-offset:calc(var(--card-width)*0.12)]
[--lane-left-x:calc(var(--card-width)*1.175)]
[--lane-right-main-x:calc(var(--card-width)*0.03+var(--wide-legend-base-clearance)-var(--right-lane-main-gap-offset))]
[--lane-right-side-x:calc(var(--card-width)*-0.086538+var(--wide-legend-base-clearance)+var(--right-lane-side-gap-offset))]
[--lane-row-gap-y:clamp(0.46rem,calc(var(--card-width)*0.09),0.7rem)]
[--lane-front-natural-y:calc(var(--card-width)*0.682692)]
[--lane-pile-natural-y:clamp(calc(var(--card-width)*0.42),calc(var(--card-width)*1.211538-3.1dvh),calc(var(--card-width)*0.846154))]
[--lane-pile-viewport-max:clamp(0rem,calc(8dvh+0.38rem-env(safe-area-inset-bottom)),calc(8dvh+0.38rem))]
[--lane-pile-y:min(var(--lane-pile-natural-y),var(--lane-pile-viewport-max))]
[--lane-front-y:min(var(--lane-front-natural-y),max(0rem,calc(var(--lane-pile-y)-var(--lane-row-gap-y))))]
[--rune-deck-lane-y:calc(var(--lane-pile-y)+clamp(0.22rem,calc(var(--card-width)*0.055),0.42rem))]
[--hand-left-inset:calc(var(--rune-deck-lane-x)+(var(--card-width)*2.34)+(var(--card-width)*0.057692))]
[--hand-right-inset:calc(var(--card-width)*3.653846)]
grid-rows-[minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,0.5fr)]
[grid-template-areas:'leftLanes_leftLanes_._legend_champion'_'runeDeck_._deckHand_main_trash'_'hand_hand_hand_hand_hand']
```
and then one of:
```
top-0 left-(--board-right-safety-gutter) right-0 px-(--player-layer-inline-pad) rotate-180 origin-center      ← opponent (mirrored)
bottom-[var(--local-player-layer-bottom-inset,0rem)] left-0 right-(--board-right-safety-gutter) px-(--player-layer-inline-pad)   ← self
```

Grid-area placements (verbatim class fragments from `cs`):

| area | class |
|---|---|
| `leftLanes` | `[grid-area:leftLanes] min-h-0 min-w-0 mr-(--base-legend-clearance) grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] gap-[0.16rem]` |
| `runeDeck` | `[grid-area:runeDeck] min-h-0 w-fit self-end transform-[translate(var(--rune-deck-lane-x),calc(var(--rune-deck-lane-y)-var(--rune-deck-edge-lift)))] pointer-events-none` |
| `legend` | `[grid-area:legend] min-h-0 flex items-end justify-end transform-[translate(var(--lane-right-main-x),var(--hero-lane-y,var(--lane-front-y)))] pointer-events-auto overflow-visible` |
| `champion` | `[grid-area:champion] min-h-0 flex items-end justify-end transform-[translate(var(--lane-right-side-x),var(--hero-lane-y,var(--lane-front-y)))] pointer-events-auto overflow-visible` |
| `main` | `[grid-area:main] min-h-0 relative z-130 flex items-start justify-end place-self-end transform-[translate(var(--lane-right-main-x),calc(var(--lane-pile-y)-var(--deck-hand-shelf-lift)))] pointer-events-auto` |
| `trash` | `[grid-area:trash] min-h-0 place-self-end transform-[translate(var(--lane-right-side-x),var(--lane-pile-y))] pointer-events-auto` |
| `hand` | `[grid-area:hand] min-h-0 absolute left-(--hand-left-inset) right-(--hand-right-inset) bottom-[calc(-0.22rem+var(--deck-hand-shelf-lift))] overflow-visible pointer-events-none` |

Miniature/compact variant uses `gridTemplateAreas: "'legend champion' 'main trash'"` (`s9`) or
`"'legend main champion trash'"` (`ce`). Enemy layers are the same component with
`--lane-left-x`/`--lane-right-*` translated to the opposite side and `rotate-180` on the band.

### 2.4 Hand fan — exact math (`439rnwycqsxxv.js` module `793143`, export `l`)

This is the complete algorithm; reimplement it verbatim for pixel fidelity.

```js
function handLayout({ cards, fanPresentation = "standard", suppressedCardIds,
                      dragIntent = T, layoutCardWidthRem = 5.2, railWidthRem,
                      maxRailWidthRem, remoteHoveredCardId = null, handEntryAnimations }) {
  const { previewGapIndex: u, layoutHoldingCardId: c, hiddenSourceCardId: h } = dragIntent;
  const f = suppressedCardIds ? cards.filter(e => !suppressedCardIds.has(e.id)) : cards;
  const p = typeof u === "number";
  const m = p && c ? f.findIndex(e => e.id === c) : -1;
  const g = m >= 0 ? f.filter(e => e.id !== c) : f;               // list without the dragged card
  const x = p ? Math.max(0, Math.min(u ?? 0, g.length)) : -1;      // gap index
  const y = p ? g.length + 1 : f.length;                           // count incl. preview gap
  const b = (y - 1) / 2;                                           // centre index

  // 1. card width shrinks when the rail gets tight (railWidthRem vs maxRailWidthRem)
  const v = layoutCardWidthRem -
            (railWidthRem == null || maxRailWidthRem == null
              ? 0
              : Math.max(0, Math.min(1, (maxRailWidthRem - railWidthRem - 0.1) / 8))) * rem(a, 0.28);
  const k = 1.392857 * v;                                          // card height

  // 2. per-slot X step  (E.H is the "step" helper of module 701010)
  const D = (count) => {
    const t = (0, E.H)(count, v);                                  // natural spread
    return (railWidthRem == null || count <= 1)
      ? t
      : Math.max(rem(a, 0.58), (Math.max(v, railWidthRem - 0.7) - v) / (count - 1));
  };
  const w = D(y);                                                  // packed step
  const I = fanPresentation === "compact";
  const M = (count) => I ? 0.7 : count <= 3 ? 2.6 : Math.max(1.9, 7.2 - 0.2 * count);   // max rotation
  const P = M(y);                                                  // rotation limit for packed set
  const C = y <= 3 ? 4.2 : Math.max(2.6, 10.4 - 0.24 * y);         // vertical arc depth
  const z = I ? 0.15 : C;
  const S = I ? 0.4 : 16;                                          // vertical base offset (px)
  const B = p && b > 0 ? (x - b) / b : 0;                          // gap-card angle factor

  // 3. visible set geometry
  const R = (f.length - 1) / 2;
  const j = D(f.length), A = M(f.length);
  const dropMidpointsRem = f.map((e, t) => {
    const n = t - R;
    return n * j + (Math.sin(((R > 0 ? (n / R) * A : 0) * Math.PI) / 180) * k) / 2;
  });

  // 4. per-slot style
  const slots = f.map((e, t) => {
    const n = c === e.id, r = h === e.id;
    let i = t;
    if (p && n) i = x;
    else if (p) { const e = m >= 0 && t > m ? t - 1 : t; i = e >= x ? e + 1 : e; }
    const a = i - b, o = b > 0 ? a / b : 0, l = o * P;
    return { card: e, sourceIndex: t, fanRotationDeg: l, isLayoutHoldingCard: n,
             isHiddenSourceCard: r, virtualIndex: i,
             style: { "--fan-offset-x": `${a * w}rem`,
                      zIndex: r ? 0 : handEntryAnimations?.has(e.id) ? 200 : i + 1,
                      "--fan-translate-y": `${S + o * o * z}px`,
                      "--fan-rotate": `${l}deg`,
                      "--fan-hover-raise": remoteHoveredCardId === e.id ? (I ? "0px" : "-12px") : undefined,
                      visibility: r ? "hidden" : undefined,
                      pointerEvents: r ? "none" : undefined } };
  });

  // 5. the preview gap card (where the dragged card would land)
  const gapStyle = p ? { "--fan-offset-x": `${(x - b) * w}rem`, zIndex: 0,
                         "--fan-translate-y": `${S + B * B * z}px`,
                         "--fan-rotate": `${B * P}deg` } : null;

  const fanBottomOverflow = S + z + (Math.sin((P * Math.PI) / 180) * v * 16) / 2;
  return { dropMidpointsRem,
           railStyle: { "--hand-fan-bottom-overflow": `${fanBottomOverflow}px`,
                        "--card-width": `${v}rem`, "--card-height": `${k}rem` },
           cardWidthRem: v, cardHeightRem: k, visibleCards: f, slots, gapStyle };
}
// companion (export Q): layoutCardWidthRem = usesCompactRail ? rem * scale + 0.65/1.392857 : rem
```

Fan slot DOM (`0xawjzm3yjpr1.js:28434`, `28680`, `28776`, `28879`):

```
group handFanSlot pointer-events-auto absolute left-1/2 top-0 z-0 flex items-start
w-(--card-width) h-(--card-height) origin-[center_bottom]
transform-[translate(calc(-50%+var(--fan-offset-x,0rem)),calc(var(--fan-translate-y,0px)+var(--fan-hover-raise,0px)))_rotate(var(--fan-rotate,0deg))]
transition-transform duration-220 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none
group-hover:z-80 group-focus-within:z-80
```

Rail: `handRail min-h-0 min-w-0 relative block w-full h-(--card-height) overflow-visible p-0 rounded-none` on a
`section[data-drop-zone-root="hand"][data-zone-owner="self"|"opponent"]`, inner wrapper
`min-h-0 border-none bg-transparent p-0 flex items-end justify-center shadow-none pointer-events-auto`,
card wrapper carries `data-mulligan-layout-id`, `data-mulligan-counter-rotation`,
`data-hover-preview-anchor="true"`, `data-preview-landscape="false"`, `data-preview-rotation="0"`,
`data-card-id`, `data-drop-zone="hand"`. `data-hand-fan-presentation`,
`data-hand-presentation-rail-width-rem`, `data-hand-drag-active` on the rail.

Hand reveal button: `group/action handRevealButton` (+`rotate-180 origin-center` for the opponent rail).

> **Note — the mulligan screen does NOT use this fan.** During `mulligan` the board sets `hideHands`
> and the mulligan UI in `2atnqtfqvj-z4.js` renders a **2-row flex ROW** (`gap-[1.1rem]`, its own
> `--mul-card-*` variables), not `handFanSlot`. Details: `.recon/specs/scratch/setup-mulligan-overlays.md`.

### 2.5 Pile stack math (`439rnwycqsxxv.js`, `sW`/`sK`/`sH`/`sF` at `0xawjzm3yjpr1.js:24096-24150`)

```js
// standard piles
sH = { depthThresholds: [{maxCount:0,value:0},{maxCount:1,value:1},{maxCount:3,value:2},
                         {maxCount:6,value:3},{maxCount:12,value:4},{maxCount:20,value:5},
                         {maxCount:35,value:6},{maxCount:Infinity,value:7}],
       spreadThresholds: [{maxCount:1,value:0},{maxCount:3,value:0.12},{maxCount:6,value:0.2},
                          {maxCount:12,value:0.29},{maxCount:20,value:0.38},{maxCount:35,value:0.47},
                          {maxCount:Infinity,value:0.56}],
       maxSpreadRem: 0.56, minLayerOpacity: 0.52, layerOpacityStep: 0.11,
       minLayerScale: 0.93, layerScaleStep: 0.017 };

// compact piles
sF = { depthThresholds:[{maxCount:0,value:0},{maxCount:1,value:1},{maxCount:Infinity,value:2}],
       spreadThresholds:[{maxCount:1,value:0},{maxCount:Infinity,value:0.16}],
       maxSpreadRem: 0.16, minLayerOpacity: 0.68, layerOpacityStep: 0.14,
       minLayerScale: 0.97, layerScaleStep: 0.012 };

function sW(count, t, centerTopCard = false) {
  const a = sK(count, t.depthThresholds), n = sK(count, t.spreadThresholds);
  const o = t.maxSpreadRem - n, i = centerTopCard ? t.maxSpreadRem / 2 : 0;
  const layers = a > 0 ? Array.from({length: a}).map((_, r) => {
    const l = Math.max(1, a - 1), d = a - 1 - r;
    return { offsetRem: o + (r / l) * n - i,
             opacity: Math.max(t.minLayerOpacity, 1 - d * t.layerOpacityStep),
             scale: d === 0 ? 1 : Math.max(t.minLayerScale, 1 - d * t.layerScaleStep),
             zIndex: r + 1 };
  }) : [];
  return { depth: a, maxSpreadRem: t.maxSpreadRem, topOffsetRem: t.maxSpreadRem - i, layers };
}
```
Pile box style (verbatim): `width: calc(var(--card-width) + ${maxSpreadRem}rem * var(--pile-stack-spread-scale,1))`,
`height: calc(var(--card-height) + ${…}rem * var(--pile-stack-spread-scale,1))`.
Pile data attrs: `data-pile-slot`, `data-pile-owner`, `data-pile-count`, `data-pile-count-placement`,
`data-stack-depth`, `data-stack-presentation`, `data-stack-top-card-centered`, `data-banished-pile-button`.
Pile label: `absolute left-[0.22rem] top-[0.16rem] text-(--text-dim) text-(length:--board-micro-label-size) uppercase tracking-[0.06em] text-shadow-none`.

### 2.6 Battlefield layer — `ps`, `43521`

```js
// slot layout, computed from (gameVariant, supplementalBattlefieldVisible, tokenColumnVisible)
if (supplementalVisible) return {
  slotKinds: tokenVisible ? ["own","opponent","supplemental","token"] : ["own","opponent","supplemental"],
  visibleSlotKinds: same, normalBattlefieldCount: 3,
  visibleColumnCount: tokenVisible ? 4 : 3,
  gridTemplateColumns: `repeat(${slotKinds.length}, minmax(0, 1fr))`,
  columnGapRem: tokenVisible ? 0.18 : 0.24 };
return {
  slotKinds: ["own","token","opponent"],
  visibleSlotKinds: tokenVisible ? ["own","token","opponent"] : ["own","opponent"],
  normalBattlefieldCount: 2, visibleColumnCount: tokenVisible ? 3 : 2,
  gridTemplateColumns: tokenVisible ? "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
                                    : "minmax(0,1fr) minmax(0,0fr) minmax(0,1fr)",
  columnGapRem: 0.24 };
```

Container (verbatim):

```
absolute left-(--battlefield-side-gap) right-(--battlefield-side-gap) top-(--battlefield-top-inset)
bottom-(--battlefield-bottom-inset) z-7 grid pointer-events-auto
transition-[grid-template-columns,top,bottom] duration-280 ease-[cubic-bezier(0.2,0.7,0.2,1)]
```
plus `data-battlefield-surface`, `data-play-hidden-selecting`, `data-normal-battlefield-count`,
`data-battlefield-column-count`, `data-battlefield-slot-order`.
Slot wrapper: `relative z-1 min-h-0 min-w-0 h-full overflow-visible` with
`data-battlefield-surface-slot` = `own|opponent|token|supplemental`, `data-battlefield-visible`.

Battlefield panel token block (`42272`, verbatim):

```
gb-board-layer min-h-0 h-full relative rounded-[0.12rem] border border-[rgba(221,232,255,0.3)]
bg-transparent p-[0.16rem] after:content-[''] after:absolute after:inset-[0.12rem]
after:pointer-events-none after:opacity-[0.58] after:gb-ornament-field
```

Card-in-battlefield placement uses `var(--battlefield-card-edge-shift, 0rem)` to compensate for
rotated (exhausted) cards (`42752`, `42813`, `42918`, `42992`), and markers use
`--battlefield-token-left` / `--battlefield-token-top` (`42624-42627`).
Might zone: `data-battlefield-might-zone`, `data-battlefield-might-player`, `data-might-side`,
`data-might-glass`, `data-battlefield-might-value` (`mU`, 40397).
Zone chrome flags: `gb-battlefield-hide-top-chrome`, `gb-battlefield-hide-bottom-chrome`,
`gb-playmat-battlefield-frost{,-top,-bottom}`.

### 2.7 Rune area

* `data-drop-zone-root="runeArea"`, `data-zone-owner="self"|"opponent"`.
* Rune token: `relative grid h-(--miniature-rune-token-height) w-[calc(var(--miniature-rune-token-height)*0.68)] shrink-0 place-items-center overflow-hidden rounded-[0.1rem] border border-[#a6b4c5]/25 bg-[#0a1422] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(1,6,15,0.48)] transition-[transform,opacity] duration-200`; exhausted ⇒ `rotate-90 opacity-48 grayscale-[0.28] shadow-none`; compact ⇒ `h-[0.6rem] w-[0.41rem] rounded-[0.07rem]`.
* Domain art: `absolute inset-[0.08rem] overflow-hidden rounded-[0.055rem] border border-white/8` + per-domain class from `su[domain].art`.
* Attrs: `data-rune-form="card"`, `data-rune-domain`, `data-rune-orientation` (`tapped|upright`), `data-rune-state` (`exhausted|available`), `data-rune-ready-count`, `data-rune-used-count`, `data-rune-available-count`, `data-rune-exhausted-count`, `data-compact-rune-domain-rail`, `data-compact-rune-domain-counter`.
* Count chip: `text-[#9fb5e3] ml-auto` + (`gb-playmat-zone-count`), size `text-(length:--rune-zone-count-size) font-semibold` (rune area) or `text-(length:--zone-count-size)`.

### 2.8 Zone headers / frosted playmat panels

```
gb-playmat-zone            (frosted zone panel)
gb-playmat-zone-glass      / gb-playmat-zone-ornament   (two visual skins)
gb-playmat-zone-frosted    gb-playmat-zone-hidden-chrome  gb-playmat-zone-header
gb-playmat-zone-count      gb-playmat-zone-count-chip   gb-playmat-resources-frosted
gb-playmat-battlefield-frost gb-playmat-fissure-fill (animated) gb-playmat-zone-hidden-chrome
gb-lines-zone-header       gb-board-lines               gb-board-playmat / gb-board-glass / gb-board-glass-optics
header row: "flex justify-between items-baseline gap-[0.34rem]
             [&_h4]:text-[#d5e3ff] [&_h4]:text-(length:--zone-label-size) [&_h4]:leading-[1.2]
             [&_h4]:tracking-[0.03em] [&_h4]:uppercase [&_h4]:text-shadow-none"
```

---

## 3. Card component & visual states

### 3.1 Module map

* **module `298551`** (`25vik2nxxo51i.js:1024-3528`) = card primitives
  * `S` → `eu` = **GameCardFace** (art + gradient + label strip)
  * `L` → `ef` = **CardBack** (uses the card-back slot resolver)
  * `F` → `et` = **GameCardActionButton** tooltip/hover label
  * `a`/`K`, `f`/`J`, `x`/`G`, `I`/`ee` = the `gb-card-action-button*` variants
    (`gb-card-action-button`, `--danger`, `--resource`, `--positive`, `--active`, `--time-warp`)
  * `g` → `eh` = card-back image (`<img>` + `p.Z(slot)` resolver, `x.b` default quality)
  * `r` → `U` = **CardLabelStack**
  * `U` → `eg`, `y` → `eo`, `h` → `ep`, `E` → `es`, `M` → `ei`, `n` → `er`, `$` → `ed`, `m` → `el`
* **module `612518`** `Y` = **CardFlip** (`data-card-face="front"|"back"`,
  `data-card-face-rotation`, `data-card-face-initial`), default transition
  `{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }`, `flat` shortcut when `rotationDeg === 0 && !initial`.
  Wrapper class `gb-card-face relative w-full h-full motion-reduce:transition-none!`; faces use
  `absolute inset-0 backface-hidden [-webkit-backface-visibility:hidden]` and
  `… transform-[rotateY(180deg)]`; shell `absolute inset-0 overflow-hidden rounded-[0.22rem]
  border border-[rgba(165,184,207,0.22)] bg-[linear-gradient(165deg,rgba(49,73,99,0.96),rgba(34,53,74,0.94))]
  shadow-[inset_0_0_0_1px_rgba(188,206,228,0.06),0_10px_20px_rgba(4,10,24,0.42)]` inside
  `absolute inset-0 perspective-[980px]`.
* **module `938822`** = card-motion helpers: `S(transform)` →
  `translateX(_.x px) translateY(_.y px) scale(_.scale) rotate(_.rotate ?? 0 deg)`, `P(deg)` →
  `rotateY(deg)`, `E` → `translateX/Y/scale/rotate` string, `m` → default
  `{ default: O, transform: $ }` where `$ = { type: "spring", stiffness: 500, damping: 25, restSpeed: 10 }`
  and `en = { type: "spring", stiffness: 500, damping: 30 }`.

### 3.2 Card face (GameCardFace, verbatim geometry)

```jsx
<div data-battlefield-art-orientation={portrait ? "portrait" : undefined}
     className={portrait ? "absolute left-1/2 top-1/2" : "absolute inset-0"}
     style={portrait ? { width:"144.6153846154%", height:"69.1489361702%",
                         transform:"translate(-50%,-50%) rotate(90deg)" } : undefined}>
  {back ? <CardBack slot={slot} insetPx={0} sizes={…}/> : null}
  <GameCardArt src={card.imageUrl} cardId={card.cardCode} fill profile={imageProfile}
               className="h-full w-full select-none object-contain" />
</div>
<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,24,0)_0%,rgba(4,10,24,0)_58%,rgba(4,10,24,0.12)_78%,rgba(5,10,24,0.44)_100%)]" />
<CardLabelStack labels={…} insetPx={…} className="z-3" />
```
Outer clip: `<div className="absolute rounded-[inherit] overflow-hidden pointer-events-none" style={{inset:`${insetPx}px`}}>`.
Missing art fallback: `data-card-art-missing="true"` + `relative z-2 mt-auto rounded-none border-none bg-transparent p-0 grid gap-[0.02rem]`.
`imageProfile` ∈ `thumb | board | hand | preview | hover` (see §6 for the size/slot mapping).

### 3.3 Board-card visual states

| state | implementation |
|---|---|
| **exhausted** | `rO({exhausted})` returns **90** (deg); auto-pay preview state returns **45**. Passed as `rotationDeg` to the flip wrapper; battlefield placement compensates with `--battlefield-card-edge-shift` when `restRotationDeg % 180 !== 0`. |
| **face-down / hidden** | `rotationDeg: 180 * !!d` (or `180*showBackAtStart` / `180*showBackAtEnd` during mulligan & entry animations), `visibility: hidden` on the source slot while dragging. `set_card_hidden`, `data-play-hidden-target`, `data-play-hidden-selecting`. |
| **might / buff** | badge label `Buff ${temporaryMightBuff}` (verbatim template) merged with `customLabels`; `mightBuffAmount`, `showMightBuffBadge` props; remove-buff action `sim.removeBuff` → `adjust_card_might`. |
| **counters** | `card-counter-*` family — overlay root `data-card-counter-overlay-root`, layers `data-card-counter-layer` with `data-card-counter-owner/-zone/-card-id/-counter/-mode/-key`, badges `data-card-counter-badge/-display/-single/-paired/-frame`, controls `data-card-counter-control` + `data-card-counter-adjust="add"|"subtract"` + `data-card-counter-scroll`, hints `data-card-counter-action-hints`. CSS vars: `--card-counter-height/-control-height/-controls-height/-track-width/-slot-width/-min-width/-clear-width/-clear-icon-size/-pad-x/-font-size/-bottom/-free-shift/-gear-shift/-density-scale/-stack-step/-previous-exhausted/-attached-gear/-attached-limit/-control-radius`. |
| **attached gear** | `--card-counter-attached-gear`, `--card-counter-attached-limit`; gear cards with `attachedToCardId`. |
| **labels / tags** | `data-card-label-stack`, `data-card-label-chip`, class `card-tag-controls` / `card-tag-control` / `.card-tag-row`, colors from `(0,ts.N)(tag)` → `backgroundColor/borderColor/textColor` inline style; actions `set_card_label`; aria `sim.decreaseTag`, `sim.increaseTag`, `current.editCardLabel`, `current.deleteCardLabel`. |
| **duplicate / copy** | `--card-duplicate-badge-height`; 10 placement profiles are defined in `r0` (`[[],[0,0],[-1,-1],[1,1],…`) used to fan duplicated copies. |
| **selection / targetable glow** | `game-selection-target-focus z-2`, `var(--game-selection-backdrop)` / `var(--game-selection-focus-border)` / `var(--game-selection-focus-glow)`, `data-target-anchor="board"|"chain"`, `g p/battlefield` eligible/dimmed states (`"eligible" === p && "pointer-events-auto"`, else `pointerEvents:"none"`). |
| **revealed to opponent** | `handCardRevealIndicator pointer-events-none absolute z-90 inline-flex items-center justify-center` + `role="img"` + `aria-label` `sim.cardRevealed`, icon `h-3 w-3`. |
| **pinged / hovered (remote)** | `gbPingPulse`, `gbPingFlash`, `gbPingCornerPulse`, `gbPingInnerPulse` keyframes; `data-realtime-hover`, `data-realtime-ping`, `data-compact-realtime-presence-ring`; ghost `data-card-drag-ghost` |
| **entry/exit animations** | `r$({animation, restRotationDeg, animatedRotationDeg, entryInactiveRotationDeg, entryInactiveOpacity=0.94, exitActiveRotationDeg})` → `"entry"` kind animates `{x: active?0:offsetXPx, y: active?0:offsetYPx, opacity: active?1:0.94}` and screen-out animates `{x: active?offsetXPx:0, y: active?offsetYPx:0, opacity: active?0.86:1}`. Badge transition duration `0.32s`, ease `[0.22,1,0.36,1]`. |
| **action buttons** | `gb-card-action-button` variants; hover label `gb-action-hover-label pointer-events-none absolute left-1/2 -translate-x-1/2 inline-flex items-center justify-center whitespace-nowrap rounded-[0.12rem] border border-[rgba(171,191,238,0.42)] bg-[linear-gradient(168deg,rgba(27,44,72,0.96),rgba(36,56,88,0.94))] text-(--text-soft) font-semibold uppercase opacity-0 transition-opacity duration-120 group-hover/action:opacity-100 group-focus-visible/action:opacity-100 shadow-[inset_0_0_0_1px_rgba(209,224,255,0.08),0_8px_18px_rgba(3,8,20,0.45)]` with `variant="board"` positioning `bottom-[calc(100%+0.18rem)] z-130 flex-col px-[0.32rem] py-[0.18rem] text-(length:--card-action-hover-label-size) tracking-[0.03em]`. |

Per-card CSS variables on the card container (from the root banner search): `--card-motion-rotation`,
`--card-pose-rotation` (default 0, set in the `@layer properties` `:root,:host` block),
`--card-battlefield-body-size`, `--card-battlefield-title-size`, `--card-body-size`, `--card-title-size`,
`--card-badge-micro-size`, `--card-radius-main/-tight/-peek`, `--card-peek-width`.

---

## 4. Hover preview / zoom panel (`HoverCardPreviewLayer`, `439rnwycqsxxv.js:1113-1385`)

Portal to `document.body`, `z-index: 2147483647`:

```jsx
<div data-hover-card-preview="true" className="pointer-events-none fixed z-2147483647"
     style={{ left:`${x}px`, top:`${y}px`, width:`${outerWidth}px` }} aria-hidden>
  <div className="relative rounded-[0.56rem] overflow-hidden border-none bg-[rgba(12,20,40,0.95)] shadow-[0_24px_42px_rgba(0,0,0,0.55)]"
       style={{ width:`${outerWidth}px`, height:`${outerHeight}px` }}>
     <div className={rotationDeg === 0 ? "absolute inset-0" : "absolute left-1/2 top-1/2"}
          style={rotationDeg ? { width:`${imageWidth}px`, height:`${imageHeight}px`,
                                 transform:`translate(-50%,-50%) rotate(${rotationDeg}deg)` } : undefined}>
        <img src={underlay} className="absolute inset-0 h-full w-full object-cover" />   {underlay = playmat art}
        <GameCardArt slot={landscape ? "hover" : "preview"} fill loading="eager" fetchPriority="high" className="object-cover" />
     </div>
  </div>
  {rules ? (
    <div style={{ marginTop: "4px" }}>
      <KeywordRulesPanel rules={rules} keywords={card.keywords}
        className="rounded-[0.5rem] border border-[rgba(141,176,232,0.12)] bg-[#090f1d] px-[0.8em] pb-[0.55em] pt-[0.45em] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
        style={{ fontSize: `${11 * (scale ?? 1)}px` }} />
    </div>) : null}
</div>
```

Positioning: `x` clamps horizontally into the viewport (`(0,a.O)(anchorClientX, r, Math.max(r,i))`),
`y = Math.max(s.v, Math.min(y, window.innerHeight - s.v - outerHeight - 4 - rulesHeight))` where
`s.v` is the module's minimum margin; `outerWidth/Height` come from the size-solver `s.c({landscape,
rotationDeg, sizeVariant, scale})` + `s.u(...)`. Anchors are elements with
`data-hover-preview-anchor="true"` (+ optional `[data-card-id]`, `data-preview-landscape`,
`data-preview-rotation`). Board-side sidebar variant: `data-hover-preview-sidebar="true"`.
Suppression: `suppressCardHoverPreview`, `hoverPreviewExemptCardIds`, `externalHoverPreview`.

---

## 5. Drag & drop, targeting

### 5.1 Zones and identity attributes

| attribute | values |
|---|---|
| `data-drop-zone-root` | `hand`, `runeArea` (plus `data-drop-zone` per card: `hand`, `base`, `battlefieldA/B/C/Token`, `chain`) |
| `data-zone-owner` | `self` / `opponent` |
| `data-drop-index`, `data-ordered-drop-preview-index` | ordinal preview insertion point |
| `data-drop-zone-root="hand"` also carries `data-ordered-rail-horizontal-alignment`, `data-ordered-rail-vertical-alignment` |
| `data-pile-slot` | `mainDeck`, `runeDeck`, `trash`, `banished` |

Canonical zones (`z` array in module `997490`): `["hand","base","runeArea","battlefieldA",
"battlefieldToken","battlefieldB","battlefieldC"]`.

Card acceptance per zone is computed by `c`/`V` helpers (module `780855` + `h.Q`) plus a big
predicate in module `9961` export `h` (`canDrop({…}, to, {board, sharedBattlefieldToken, sourceCard, occupancy})`)
— it returns `false` for zone-owner violations, hidden-card rules, empty champion slot etc.

### 5.2 Native DnD path

`<div data-board-play-area draggable onDragStart={gS} onDropCapture={gR} onDragOver={gN} onDrop={gA}>`
plus per-zone `onDrop/onDragEnter/onDragOver/onDragLeave` on the hand `section` and the rune area.

**Custom drag MIME types** (`0xawjzm3yjpr1.js:35263`):

```js
uw = { boardCard:      "application/x-riftbound-card",
       chainEntry:     "application/x-riftbound-chain-entry",
       deckPeekCard:   "application/x-riftbound-deck-peek-card",
       mainDeckCard:   "application/x-riftbound-main-deck-card",
       battlefieldMarker: "application/x-riftbound-battlefield-marker" };
uk = "data-drag-origin-persist-until";
uW = '[data-drop-zone-root="battlefieldA"], [data-drop-zone-root="battlefieldB"], [data-drop-zone-root="battlefieldC"], [data-drop-zone-root="battlefieldToken"]';
uq = ["hand","base","battlefieldA","battlefieldToken","battlefieldB","battlefieldC","trash","banished","champion","legend","runeArea"];
```

**Origin pickup/hide animation** (CSS classes on the dragged source element):
`.dragOriginPickup { opacity:.14; transition:opacity 90ms ease-out }` is applied on the next frame,
then after `pickupDelayMs ?? 90` ms it becomes
`.dragOriginHidden { pointer-events:none; opacity:0!important }` (unless the drag session token
changed); the origin is restored on drag end. Helper `u_(root, now)` sweeps all origins and honours
a `data-drag-origin-persist-until` timestamp (`Number.parseInt`); `uX(el, t = -2)` returns the drop
indicator anchor `{ left: rect.left + rect.width/2, top: rect.top + t }`.

The drop effect is decided by `w()` (module `9961`):

```js
mainDeckTop → "deck_top"; mainDeckBottom → "deck_bottom"; hand → "hand";
trash → shiftKey ? "banished" : "trash";
dropOnMainDeck → shiftKey ? "deck_top" : "deck_bottom";
dropOnTrash   → shiftKey ? "banished" : "trash";
dropOnHand    → "hand"; default → "trash"
```

The ghost element uses two stacked z-indexes (`z-2147483500` when a deck drop position is active,
otherwise `z-2147483550`) and starts parked at `translate3d(-9999px,-9999px,0)`.

**Drag start / teardown** (`eZ` 35842, `eU` 35655): `dataTransfer.effectAllowed = "copyMove"`,
`setData(<mime>, JSON.stringify(payload))`, `setDragImage(dragImageRef.current ?? defaultImage, 0, 0)`;
listeners: `dragend` capture on `window` + on the source element, `drop` on `document` (only if not
already `defaultPrevented`), and **both** `keydown` and `keyup` for `Escape`/`Esc` with
`preventDefault`. Ghost mount is deferred one rAF + `startTransition`. Drop effect:
`uN(kind,payload) → "copy"` for `battlefieldMarker` or a `boardCard` from `legend`, else `"move"`.

**Ghost follow physics** (rAF loop, `0xawjzm3yjpr1.js:35680-36060`) — reproduce exactly:

```js
// pointer sample
let n = Number.isFinite(ts) && ts > 0 ? ts : (lastPointerTs > 0 ? lastPointerTs + 16 : 0);
if (lastPointerTs > 0 && n >= lastPointerTs) {
  let r = Math.max(1, n - lastPointerTs),
      o = (x - lastPointerX) / r, i = (y - lastPointerY) / r;   // px per ms
  velocityX = 0.45 * velocityX + 0.55 * o;
  velocityY = 0.45 * velocityY + 0.55 * i;
}
targetX = x; targetY = y; lastPointerX = x; lastPointerY = y; lastPointerTs = n;

// frame
let n = Math.max(1, now - lastFrameTs); lastFrameTs = now;
let o = Math.exp(-n / 118);                 // velocity decay, τ = 118 ms
velocityX *= o; velocityY *= o;
let i = 1000 * velocityX, l = 1000 * velocityY;             // px/s
let d = clamp(-0.0115 * l, -13, 13);        // rotateX target, ±13°
let s = clamp( 0.0115 * i, -13, 13);        // rotateY target, ±13°
let c = clamp( 0.0075 * i,  -8,  8);        // rotateZ target, ±8°
let u = 1 - Math.exp(-n / 42);              // follow smoothing, τ = 42 ms
tiltX += (d - tiltX) * u; tiltY += (s - tiltY) * u; roll += (c - roll) * u;
el.style.transform =
  `perspective(980px) translate3d(${targetX.toFixed(2)}px,${targetY.toFixed(2)}px,0) ` +
  `translate(-50%, -50%) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) ` +
  `rotateZ(${roll.toFixed(2)}deg) scale(1.02)`;
```
`--card-counter-drag-roll` is written to every `[data-card-counter-frame]` / `.card-banish-frame`
so the counter overlays tilt with the card. With `prefers-reduced-motion: reduce` the transform
collapses to `translate3d(x,y,0) translate(-50%,-50%)` and the roll is forced to `0deg`.

### 5.3 Pointer path (ghost + reorder preview)

`ux` (34969-35262) renders the drag ghost:
```
fixed -left-2499.75 -top-2499.75 pointer-events-none z-[-1] w-px h-px opacity-0     ← hidden live-ref container
fixed left-0 top-0 pointer-events-none will-change-transform                        ← ghost
w-(--card-width) min-w-(--card-width) h-(--card-height) rounded-(--card-radius-main) border-none bg-transparent shadow-none
absolute inset-0 origin-center
transition-transform duration-140 ease-[cubic-bezier(0.2,0.7,0.2,1)]  (on the ghost card)
```
Drag intent state machine (module `997490`, export `B/p`): `{phase:"idle"|"dragging"|"settling",
source:{zone,cardId,exhausted}, targetZone, dropEffect, previewGapByZone, layoutHoldingCardIdByZone,
layoutHoldingCardExhaustedByZone, hiddenSourceCardIdByZone, indicators}` with indicator fields
`chainDropActive, runeFloatDropActive, runeFloatDropIndicatorPos, trashDropMode,
trashDropIndicatorPos, spellTargetIndicator, equipDropIndicator, mainDeckDropPosition,
mainDeckDropIndicatorPos, runeDeckDropPosition, runeDeckDropIndicatorPos` (all positions compared
with a 0.5 px tolerance `P(e,t)`).

### 5.4 Targeting arrows

* Click a card while a target mode is armed → `board onClickCapture` handler (`63180`) creates an
  arrow via `dr({sourceCardId, sourceAnchor}, {targetCardId, targetAnchor})` → `target_arrow_remove`
  is sent if the same pair already exists, otherwise the add action; `sourceAnchor`/`targetAnchor`
  ∈ `"board" | "chain"`.
* `l8(...)` validates the pair; `lL` is the current arrow list.
* `Escape` (or clicking empty space) clears the armed mode; `sim.clearArrows` clears all arrows.
* Overlays: `hI` (TargetSelectionOverlay) marks `data-target-opening`, `data-target-selection-overlay`,
  `data-selection-kind`; `hj` renders the arrows; chain preview is `data-chain-preview`.

### 5.5 Cursor / hover behaviour

* Card slots use `pointer-events-auto cursor-pointer opacity-100` / `pointer-events-none opacity-0`
  pairs to enable/disable interaction per state.
* `data-local-board-hover-tone`, `data-suppress-board-hover-tone` tone the local board on hover.
* Remote hover: `onRealtimeHoverCardIdChange`, presence ring `data-realtime-presence-ring`,
  `data-realtime-online`.

---

## 6. Assets

Static CDN root: `https://assets.riftatlas-workers.com/riftbound/static/…?v=<revision>`
(full manifest in `.recon/api/asset-manifest.json`, downloaded to `.recon/site/assets/cdn/`).
Card art: `https://assets.riftatlas-workers.com/riftbound/cards/[<locale>/]{small-v2|original}/<CARDID>.webp?v=<revision>`.

| board element | asset |
|---|---|
| playmat / board background | `board.webp` (default), overridable per player by board customization — playmats/sleeves live **same-origin** at `/cosmetics/creators/<slug>/{board,preview,store,thumb}.webp?v=` (a 15-item catalogue, 2 free: `table_skin_rift_atlas_starfall`, `sleeve_pack_rift_atlas`), with `intensity`/`contrast`/`glass`/`frost` clamps (`0.8`, `0.7`, `0.3`) fed into `--self-glass-intensity` / `--opponent-glass-intensity`; board slot names `deckSleeve`, `runeDeckSleeve`, `battlefieldSleeve`, `playmat`; board-line skins `default|ink|legend|signature_legend` via `boardLines`/`pointsRail` (CSS hooks `gb-board-playmat`, `gb-board-glass`, `gb-board-glass-optics`, `data-*-board-lines`, `data-lines-frame`, `data-lines-controls`) |
| card backs | `cardback-black.png`, `cardback-white.png`, `cardback-blue.png`, `cardback-black-landscape.png`. Default per slot (verbatim `2-nry424r0961.js:231`): `runeDeck → /cardback-white.png`, `battlefield → /cardback-black.png`, everything else (`deck`) `→ /cardback-blue.png`; the **landscape** back is used for hidden/face-down battlefield cards and for opponent-hand / mulligan / face-down board states. Sleeves override per slot via `{ deckSleeve, runeDeckSleeve, battlefieldSleeve }` from board customization (`2-nry424r0961.js:825-899`). Labels: `sim.cardBack`, `sim.board.namedCardBack`, `sim.runeCardBack`, `sim.hiddenCard` |
| token art | `tokens/<Name>.webp` + `tokens/thumbs/<Name>.webp` for `Recruit, Gold, Mech, SandSoldier, Sprite, Bird, Reflection, ShadowClone, Tentacle` (+ `Bomb` from the on-demand allowlist). Verbatim table in `0xawjzm3yjpr1.js:21900-21930` |
| placeholder | `placeholder.svg` (`data-card-art-missing` fallback) |
| icons, sets, sealed, setup, effects, brand, guide-banners | rest of the manifest |
| sounds | `sounds/20260716/*.webm` — see `.recon/specs/scratch/assets-sounds.md` |

Image slots (`resolveGameCardImageSlot`): `thumb|board|hand → small-v2`, `preview|hover|battlefieldDraft → original`.
CDN resize form: `/cdn-cgi/image/width=<bucket>,quality=<75-92>,format=auto,fit=scale-down,onerror=redirect/riftbound/…`
with width buckets 96/128/192/256/320/384/512/… and a client-side allowlist regex (module `123h3ohyw0ag5`).

Token preview object shape (verbatim):
```js
{ id: `token-preview:${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`, name, source:"token",
  exhausted:false, createdAt:0, imageUrl }
```

### 6.1 Sounds — trigger map (SFX engine module `123139` in `2goht72gp0rq8.js`)

Registry (`2goht72gp0rq8.js:3799-3928`): each key maps to `{ variants:[{src}], volume, cooldownMs? }`
with `src = staticUrl("/sounds/20260716/<file>.webm")`; the volume store persists under
`localStorage` key `riftbound_simulator_sfx_volume:v2`. Play API: `y(key, {volumeScale, cooldownKey,
cooldownMs})`, preload `C(key)` / `c()` (preload all).

| sound key | files | triggered by (board-relevant) |
|---|---|---|
| `ui_click` | `ui_click*.webm` | switch seat, all 7 mode toggles (counter/buff/target/label/emote/ping/duplicate), end-turn / time-warp buttons, rail + leave + next-game buttons, sideboard edit clicks |
| `ui_confirm` | — | mulligan submit, sideboard submit, battlefield pick (random), rewind-confirmation approve, next-game/leave confirm |
| `card_hover` | `card_hover1..3` | pointer enters a **hand** card while idle (cooldown 35 ms) — `0xawjzm3yjpr1.js:51026` |
| `card_click` | `card_click1` | battlefield pick, mulligan card toggle, and the action-echo for `select_battlefield`, `target_arrow_*`, `equip_card`, `adjust_card_counter`, `clear_card_counter`, `adjust_card_might`, `set_card_label` |
| `card_play` | `card_play1` | drop/double-click of a hand card onto a play zone; action-echo; observed opponent play (`volumeScale 0.6`, cooldown 260 ms) |
| `card_draw` | `card_draw1` | draw from deck, draw rune, conquer draw |
| `card_discard` | `card_discard1` | move to trash/banished, `move_cards_to_trash_batch`, chain→trash |
| `card_exhaust` | `card_exhaust1..2` | `toggle_exhausted` result, rune exhaust batch |
| `card_recycle` | — | rune → deck bottom, `send_to_rune_deck`/`send_to_deck`, `recycle_deck_peek_card`, `recycle_all_trash_to_deck`, chain→deck |
| `card_autopay` | `card_autopay1..3` | `payment_batch` with `paymentGroupOrigin === "auto_pay_button"` |
| `score_conquer` / `score_hold` / `score_generic` / `score_end` | — | score gain from `battlefield_conquer_confirm` / hold-at-turn-boundary / manual `set_score`\|`adjust_score` / crossing the victory score |
| `ping` | `ping-v2.webm` | realtime card ping received from another player (deduped by `cardId+pingedAt+intent`, TTL 2400 ms, intents `general|trigger_ability|discard_target`, volume 0.08) — `:51073` |
| `chat_message` | `chat_message.webm` | incoming chat message authored by someone else (rate 0.6, volume 0.1) — `:13062`, `:13083` |
| `turn_start` / `time_warp` | — | turn number increased (time_warp when an extra-turn resume is pending) — `:59368` |
| `game_rewind` / `game_forward` | `game_rewind1|2|5` | rewind/forward overlay token change — `:64874-64875` |
| `baron_nashor` | `baron_nashor.webm` | shared battlefield token reveal becomes active (cleared after 3400 ms) — `:52177` |
| `game_start` | — | game shell mount / match start (preloaded at `35qz5rkx7yexy.js:26606`) |

Full 31-file list + every call site: `.recon/specs/scratch/assets-sounds.md` §§B.1-B.4.

---

## 7. Per-player colours & identity

```js
eP = ["p1","p2","p3","p4"];
eS = { p1:{solid:"#69c8e6",border:"rgba(105,200,230,0.68)",glow:"rgba(105,200,230,0.14)",surface:"rgba(105,200,230,0.1)",text:"#cef4ff"},
       p2:{solid:"#de7c77",border:"rgba(222,124,119,0.68)",glow:"rgba(222,124,119,0.14)",surface:"rgba(222,124,119,0.1)",text:"#ffe0dd"},
       p3:{solid:"#d7b260",border:"rgba(215,178,96,0.68)",glow:"rgba(215,178,96,0.14)",surface:"rgba(215,178,96,0.1)",text:"#ffedc9"},
       p4:{solid:"#a995e8",border:"rgba(169,149,232,0.68)",glow:"rgba(169,149,232,0.14)",surface:"rgba(169,149,232,0.1)",text:"#e9e1ff"} };
eN(i) = eP[Math.max(0,Math.trunc(i)) % 4] ?? "p1";
```
Identity rail attrs: `data-player-identity-rail`, `data-player-color`, `data-player-label`,
`data-realtime-online`, `data-realtime-hover`, `data-realtime-ping`, `data-compact-realtime-presence-ring`,
`data-player-muted`, `data-has-silence-action`, `data-relation`, `data-density`, `data-active`,
`data-active-size`, `data-compact-observer-player-layer`, `data-miniature-area`,
`data-miniature-top-side`, `data-miniature-base-zone`, `data-measured-width-rem`,
`data-measured-height-rem`.
(Note: there is **no** `data-realtime-presence-ring` attribute in the bundle — the presence ring is
`data-compact-realtime-presence-ring`, `0xawjzm3yjpr1.js:34287`.)
Compact badge classes: `inset-[0.08rem] z-0 rounded-[0.22rem]`, ring dots `h-[0.38rem] w-[0.38rem] shrink-0 rounded-full border border-white/25`,
online dot `bg-[#68d9ff] shadow-[0_0_8px_rgba(83,205,255,0.86)]`, menu rows
`grid min-h-[2.4rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.42rem] rounded-[0.1rem] px-[0.4rem] py-[0.28rem] text-left text-[#e8f4ff] transition-[background-color,color] duration-150 hover:bg-[rgba(38,65,91,0.54)] focus-visible:bg-[rgba(45,74,101,0.62)] focus-visible:outline-none`.

---

## 8. Turn / phase / score / chain surfaces

* **Turn controls** (`fX`): container `pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center`
  (self: `right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90`; opponent: `left-[0.28rem] top-[calc(var(--battlefield-inset)-0.36rem)]`).
  Phase text: `relative z-1 block text-center text-[0.78rem] font-bold uppercase leading-none tracking-[0.08em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]`
  (+`text-[0.72rem] tracking-[0.045em]` variants). Glass skin class `gb-turn-glass`.
  Time-warp buttons `time-warp-action time-warp-turn-button`, keyboard hint `sim.keySpace`,
  click sound `ui_click`.
* **Chain panel** (`c8`): `tablet-chain-panel`, `tablet-chain-entry-heading`, `tablet-chain-title`,
  `tablet-chain-name`, `tablet-chain-priority`, `tablet-chain-status`, `tablet-chain-summary`,
  `tablet-chain-card`, `tablet-chain-preview-control`, `time-warp-compact-toggle`; stack height var
  `--chain-stack-height`; lane width `--chain-lane-width`; extra-turn badge
  `data-chain-extra-turn-badge`, toggle `data-chain-extra-turn-toggle`.
* **Showdown** (`m2`): tones `data-showdown-visual-tone` (`neutral|danger|success|warn` style maps) and
  `data-showdown-action-tone`; buttons `expected-action-button expected-action-button--showdown`,
  `--split-left`, `--split-right`, `--approval`; keys `confirm_conquer`, `pass_focus`, `pass_response`,
  `optional_pass`; close button `h-[2.4rem] w-[2.4rem] rounded-[0.35rem]`.
* **Score track**: rail widths from `--score-track-rail-width`, node size `--track-node-size`
  (clamped `2.7rem … 3.9rem`, winning ×1.24), keyframes `scoreTrackNodeLand`,
  `scoreTrackNodePulse`, `scoreTrackNodeLabelArrival`, `scoreTrackNodeChargeArrival`,
  `scoreTrackConnectorSurge`; `data-score-track-*`; computed in module `272907`
  (`eO.w({maxValue, baseTrackNodeSize, maxTrackNodeSizeRem, maxTrackStackBottomRem,
  trackStaticTopOffsetRem})`).
* **Deck peek** (`mx`): `gb-deck-peek`, `gb-deck-peek-more-panel`,
  `absolute top-[calc(100%+0.36rem)] z-200 flex w-48 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[0.22rem] border border-[rgba(201,218,249,0.22)] bg-[rgba(8,16,34,0.98)] text-(--text-soft) shadow-[0_14px_28px_rgba(2,6,18,0.54),inset_0_1px_0_rgba(230,239,255,0.06)]`,
  more-label `gb-deck-peek-more-label leading-none`, secondary actions `gb-deck-peek-secondary-actions contents`,
  to-hand button `gb-deck-peek-to-hand`; `absolute inset-0 pointer-events-none z-92` scrim.
* **Rewind confirmation** (`hg`): `pointer-events-none absolute left-1/2 top-[0.58rem] z-[145] w-[min(29rem,calc(100%-1rem))] -translate-x-1/2 max-sm:top-auto max-sm:bottom-[calc(env(safe-area-inset-bottom)+0.62rem)]`,
  progress bar `absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-[rgba(110,159,193,0.13)]` +
  `h-full origin-left bg-[linear-gradient(90deg,#70d4bd,#8acdf5)] shadow-[0_0_8px_rgba(115,211,224,0.54)]`.
* **Deck / pile quick controls**: `gb-card-action-button--resource`, `data-resource-adjust`,
  `data-resources-toggle`, `gb-resources-popover`, `gb-resources-summary`, `gb-resources-summary-energy`,
  `gb-resources-summary-power`.
* **Legend / Neeko**: `gb-neeko-legend-stack`, `gb-neeko-starting-legend`, `gb-neeko-borrowed-legend`,
  `gb-neeko-borrowed-tag`, `gb-neeko-borrowed-tag-art`, `gb-neeko-legend-portrait`,
  `gb-neeko-legends-control`, `data-neeko-legend-option`, `data-neeko-borrowed-legend`,
  `data-neeko-reveal-arriving`; legend XP chip `legend-xp` (`set_show_legend_xp_counter`).

---

## 9. Responsive breakpoints

Sources: board-chunk inline breakpoints and CSS `@media` blocks in the big CSS file (Tailwind's
default `sm 40rem / md 48rem / lg 64rem / xl 80rem / 2xl 96rem` are the *theme* names, but the board
uses **px** media queries, not Tailwind's `sm:` prefix):

| query | effect |
|---|---|
| `@media (width <= 760px)` | opponent-left overlay reflows: `max-[760px]:ml-[3.75rem] max-[760px]:w-[calc(100%-3.75rem)] max-[760px]:justify-end`, `max-[760px]:flex-wrap` |
| `@media (width <= 680px)` | `max-[680px]:gap-3 max-[680px]:pl-3` |
| `@media (width <= 520px)` | `max-[520px]:ml-0 max-[520px]:w-full`, hides the 2.75 rem icon (`max-[520px]:hidden`) |
| `@media (width <= 850px)` | layout helper: `narrow` density (`s = e.widthPx <= 850 \|\| phonePortrait`) |
| `@media (width <= 1000px)` | touch: `phonePortrait` when portrait; `usesCompactOpponentRail` |
| `@media (width <= 600px)` | `phone-portrait` arrangement for touch |
| `@media (height > width)` (portrait) | phone-portrait layout; `H(e,t)` = `touch && !(height<=width) && (width<=600 \|\| (!(width>1000) && max(height,layoutHeight) >= 1.72*width))` |
| `@media (min-width:1024px) and (min-height:600px)` | tablet mode on touch (`o(e,t) => "touch" === t && e.widthPx >= 1024 && e.heightPx >= 600`) |

Layout presets (module `929289`, export `f`) return `{arrangement: "phone-portrait"|"standard",
density: "narrow"|"regular", …}` with constants `L = { beside: 1.8, above: 4 }`
(rem) used as `h = 2.12 * cardHeightPx + L.above * rootRemPx`.
Container queries are used too: `[container-type:inline-size]` on the board shell and `2.55cqw`
in `--track-node-size`, `min-h-[clamp(6rem,12cqh,8rem)]` in the chain panel.

Also: `motion-reduce:transition-none` is applied on every animated board element;
`env(safe-area-inset-bottom)` is honoured in the lane stack and rewind panel.

---

## 10. Design tokens & fonts

See `02-design-tokens.css` for the verbatim token file (945 declarations / 560 distinct names, 46
`@keyframes`, 38 `@font-face`). Key groups: `--color-gb-bg-0/1/2`
(`#0e2049 / #0b1a3d / #07132f`), `--color-gb-text-main` `#eef4ff`, `--color-gb-ornament-ink`
`#ecf3ff85`, `--color-gb-ornament-soft` `#bcd0ff57`, `--color-bg-top` `#1d324d`,
`--color-bg-bottom` `#1a2b43`, `--color-text-main` `#f2f5f7`, `--color-text-soft` `#bfd5e3`,
`--color-text-dim` `#8ea7ba`, `--color-border` `#8496b86b`, `--color-primary`/`--color-ring` `#74efff`,
`--game-selection-backdrop` `#0308129e`, `--game-selection-focus-border` `#88e0ffb8`,
`--game-selection-focus-glow` `#4ca6d02e`.

**Fonts** (all `next/font` self-hosted, exposed as CSS variables on the wrapper classes from
`0mq6k3dqx1du5.css` / `3ij80xvxm0krf.css`; no `@font-face` lives in the big board CSS chunk):

| var | family | where it is used |
|---|---|---|
| `--font-ui` | `"Bricolage Grotesque", "Bricolage Grotesque Fallback"` | default app UI (`body { font-family: var(--font-ui), "Segoe UI", sans-serif }`) |
| `--font-heading` | `"Cardo", "Cardo Fallback"` | `var(--font-heading), ui-serif, Georgia, serif` — serif/display accents; card rules text on the hover-preview keyword panel |
| `--font-brand` | `"Rajdhani", "Rajdhani Fallback"` | brand lockups / numerals |
| `--font-sans` | Tailwind default system stack | explicit `font-sans` usages in the board chunk (`0xawjzm3yjpr1.js:2287`, `2342` — RealtimePing / token-burst labels) |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | `font-mono` on the room-code / clock (`0xawjzm3yjpr1.js:46509`); a `JetBrains Mono,SFMono-Regular,Consolas,monospace` override exists for one component |
| (other) | `Cookie` | decorative script (site header only) |

**Breakpoints confirmed in compiled CSS** (ad-hoc px, *not* Tailwind's scale):
`(max-width:600px)`, `(max-width:1100px)`, `(max-width:540px)`, `(max-width:420px)`,
`(max-width:640px) and (max-height:500px)`, `(min-width:700px) and (max-width:1100px)`, plus
`container-type:inline-size` + `@container (min-width:64rem)` on the board shell and layout-mode
switching on `data-tablet-layout` / `data-touch-layout` / `data-board-arrangement="phone-portrait"`.

**CSS keyframes used on the board** (all in `02-design-tokens.css`): `gbPingPulse`, `gbPingFlash`,
`gbPingCornerPulse`, `gbPingInnerPulse`, `gb-playmat-fissure-fill`, `cardMaterialize`,
`expectedActionButtonPulse`, `expectedActionButtonSplitPulse`, `showdownPanelFadeIn`,
`showdownActionPulse`, `showdownBattlefieldAura`, `showdownBattlefieldPulse`,
`scoreTrackNodeLand|Pulse|LabelArrival|ChargeArrival`, `scoreTrackConnectorSurge`,
`time-warp-sweep`, `touch-counter-tick`, `touch-counter-unfold`, `touch-hold-*`,
`banished-pop-*`, `banish-link-*`, `initiative-decision-reveal`, `simulator-entry-*`,
`animate-ping` / `animate-pulse` / `animate-spin` (Tailwind).

Z-index ladder observed (verbatim Tailwind classes): `z-0 … z-3`, `z-7` (battlefields),
`z-8` (player band), `z-16`, `z-40`, `z-50`, `z-70`, `z-80`, `z-90`, `z-92`, `z-120`, `z-130`,
`z-140`, `z-145`, `z-150`, `z-170` (menu panels), `z-180` (emote wheel), `z-200`, `z-204`,
`z-2147483647` (hover-preview portal).

Spacing scale: Tailwind default `--spacing: .25rem`, but the board almost exclusively uses
`rem` math derived from `--card-width` and arbitrary `clamp()`/`calc()` values as quoted above.

---

## 11. Floating resources / auto-pay payment UI

* `FloatingResourcesSummary` (`0xawjzm3yjpr1.js:20860-20970`): `gb-resources-summary` (or
  `gb-resources-summary pointer-events-auto` when interactive), `data-resources-toggle`,
  `aria-expanded`, `aria-label` = `sim.floatingResourcesSummary({energy,power})`; energy span
  `gb-resources-summary-energy` + `data-resources-summary-energy={value}` + `data-tone`,
  power span `gb-resources-summary-power` + `data-resources-summary-power={value}` with a 12×12
  power icon (`oP.r`). Values are adjusted by the `adjust_floating_resources` action and the
  `data-resource-adjust` / `gb-resources-summary-energy|power` controls.
* `ResourcesPopover` (`0xawjzm3yjpr1.js:20845`): `data-resources-popover` + `gb-resources-popover`,
  rendered with `createPortal(node, document.fullscreenElement ?? document.body)` (works in
  fullscreen).
* Auto-pay: **not a distinct action type** — the board sends a `payment_batch` action with
  `paymentGroupOrigin: "auto_pay_button"` plus an `autoPay` intent
  (`{ purpose: "play" | "empower", zone, cardId }`, `1w8d13szpogkp.js`). The client plans the
  payment itself (floating resources → rune exhaustion → power-rune recycle → conduit/gold/legend
  sources, with a card-text cost parser and two "ability costs less" regexes, ≤128 operations) and
  sets `autoPayUi.previewCardId` + `autoPayPreviewExhausted/Recycled/RecycledExhaustedCardIds`
  while a preview is armed; `set_auto_pay_in_flight` blocks re-entry. The only user-facing failure
  is `auto_pay_unavailable` (`AutoPayUnavailableError`); there are also stale-state, forward and
  transport error classes. Card menu item `auto-pay` (`current.autoPayCardCost`), hover affordance
  `sim.autoPay`, sound `card_autopay1|2|3.webm`. While a preview is armed the exhausted rotation
  becomes **45°** instead of 90° (`rO({autoPayPreviewExhausted:true})`).
* Payment breakdown strings (verbatim game-log keys): `paymentDetail.float`, `paymentDetail.exhaust`,
  `paymentDetail.recycle`, `paymentDetail.countedCard`, `paymentDetail.gold`, `paymentDetail.card`,
  `payment.auto`, `autoPaid`, `autoPaidCardCosts`, `autoPay`.

---

## 12. Live-browser confirmation (screenshots 49-54, `.recon/screens/`)

Confirmed against real captures on 2026-10-22:

* **Score tracks are vertical zig-zag rails** on the far left and far right of the board, numbered
  `0..8`; the current node is ringed (opponent track on the right showed node 8 highlighted white,
  the local track on the left showed a green ring on node 4 = the target/winning tier). Identity
  badges (`Kai` bottom-left, `Ari` top-right) carry the player name, current score and a personal
  clock (`18:56` / `16:29`).
* **Sidebar (right)**: `Turn 5` + match clock `35:25` + room code `V3QBY`, seat-switch buttons
  `PLAY AS KAI` / `PLAY AS ARI`, `⇤ rewind` / `⇥ forward` buttons, `NEXT`, `LEAVE`, then the match
  log (`PLAYED … Rebu|e from hand`, `Paid … — Exhaust 2 · Recycle 2`, `Dismissed showdown at …`,
  `Moved … Kaï'Sa, Survivor to Grove of the God-Willow`) and a large action row **`Resolve (S)`**,
  then the hovered card preview with its keyword-rules panel (`Rebuke`, orange ribbon) and the
  `CHAT` composer with a `Help` affordance.
* **Battlefields** are two large dashed-border panels with a `+` badge on their left edge and a
  `0` counter chip at the top-right; a `2` / `2` / `3` might badge sits at the bottom-left of cards
  placed on them and the energy cost badge at the top-right.
* **Runes** render as flat rectangles in a row directly under the opponent's hand; an exhausted rune
  is drawn rotated 90° (purple rune tilted in `52-board-autopay-rune-float.png`).
* **Hand** is a fan: 6 cards, slight outward rotation, arc lift, energy-cost badge top-left, power
  badge top-right, `HAND REVEALED` chip centered above the fan when the hand is revealed.
* **Deck / base**: deck stack with a big count (`32`) bottom-right and a `0` floating score chip;
  base/legend stack bottom-left (`LEAGUE LEGENDS` with the `10` / `7` XP-or-might badge).
* `SWITCH SEAT` and `END TURN` are stacked buttons at the right edge of the local player band, with
  the `↵`/`Space` glyph under END TURN.
* `FLOATING Energy 0 / Power 0` panel sits above the local player's rune row.
* **Rewind overlay** (`50-board-rewind-overlay.png`): the board dims and a large **clock face** with a
  single arrow and the word `REWIND` (letter-spaced, uppercase) is centred over the battlefield
  columns; the sidebar log fills with `Rewound to before their last action.` rows, and a
  `⇤`/`⇥` button pair appears in the room header next to `NEXT` / `LEAVE`.
* **Reveal chips**: `HAND REVEALED` above the local fan and `OPPONENT HAND REVEALED` above the
  opponent's hand (`.gb-playmat-zone-header` variant); both cards in the opponent hand are shown
  face-up when revealed.
* **Hover preview action hints**: the preview card shows chip rows `S RESOLVE` / `T TARGET` on the
  right and a power badge (`7`) on the left; the art has a landscape/hidden variant.
* **Clocks**: identity badges show `m:ss` (`0:28`, `04:18`); the room header shows the match clock
  (`04:18`) plus the room code (`PZUSU`).
* Battlefield panels carry a `0` counter chip top-right; the rune row shows a `6/6` paired counter
  (`data-rune-ready-count` / `data-rune-used-count`).

**"View full board" preview window** (`47-preview-click-*.png`) confirms the structural model:

* Each side owns a **vertical score rail of 10 nodes labelled `0`–`9`** (victory score = the far
  node `9`); the two rails are mirror images — the local rail is the `rotate-180` copy, so its `0`
  node sits nearest the local identity badge. The **current score node is ringed** (green ring for
  self, gold for the opponent) and matches the number inside the identity badge.
* Empty zones render as **dashed rectangles** with corner brackets: two `No card` slots at the
  opponent's edge (top) and two at the local edge (bottom) = champion/legend slots; the main deck
  shows a plain card back with a large count (`12`) and a separate `0` score chip beside it.
* The local `legend` card shows a small energy badge (`6`) at its top-right corner.
* `FLOATING / Energy 0 / Power 0` is laid out with `−` / `+` adjusters and renders twice (once per
  side, mirrored).
* The phase label `MAIN PHASE` is set in bold uppercase next to the END TURN button; the turn
  indicator reads `Turn 1` with a running clock `00:01` underneath.
* `gb-board-lines` draws thin bracket/dot **ornament marks** inside each battlefield panel rather than
  a full grid.

---

## 13. Open questions for live-browser confirmation

1. Exact pixel geometry of `--player-band-size`, `--board-field-height`, `--battlefield-inset`,
   `--chain-lane-width`, `--tablet-opponent-band`, `--tablet-player-band`, `--phone-score-height`,
   `--board-scale` — computed at runtime in modules not fully recovered
   (`eO`/`272907`, `iq`/`958745`, `dP`/`426582`, layout module `929289`). **Measure from the live
   board at a known viewport width** (`getComputedStyle(document.querySelector('.gb-board'))`
   for the inline `--*` map, plus each `.gb-board-layer` rect).
2. The **action menu** (`nc`/`sf`) item list and grouping, and the full board-toggle set, as actually
   rendered (a live `[data-board-toggle]` dump would settle it).
3. The 4-player (FFA) and 2v2 arrangements. **Partially resolved statically:**
   `ss = e.players.filter(p => p.id !== me.id).slice(0, 3)` and
   `sh = e.players.length > 2 && ss.length > 1` (`0xawjzm3yjpr1.js:52187-52204`) — the full-width
   opponent `PlayerLayer` + presence badge (`pJ`) is rendered **only** when `!sh`, i.e. **2-player
   duel**; with 3-4 players each opponent becomes one entry in the **compact opponent rail**
   (`um`, `data-compact-opponent-board`, `data-compact-opponent-count`), and
   `--local-player-layer-bottom-inset` becomes 0.32rem so the self band shifts down. What still needs
   a live check: the vertical stacking order of the compact rails, and how the two battlefields per
   player map onto shared columns for `free_for_all_3|4` vs `teams_2v2`.
   Perspective cycling (`sim.switchSeat` / `SwitchPerspective`) is enabled only when
   `allowPerspectiveSwitch && uZ.length > 1 && (viewerRole === "spectator" || roomMode === "solo_lab")`
   and cycles to `uZ[(index+1) % length]`.
4. Battlefield "supplemental" column (third battlefield) trigger conditions — the CSS supports 3-4
   columns; no capture yet.
5. Whether the ghost drag (`ux`) is used *in addition to* the native HTML5 DnD path or only on touch
   devices (the play area is `draggable` **and** a `fixed` ghost exists).
6. Sound file ↔ event mapping (deferred to `assets-sounds.md`).
7. The exact `--chain-lane-width` value and the chain lane collapse behaviour on tablet/phone.
8. English text for runtime-only strings (labels come from i18n keys; keys are listed in
   `02-hotkeys-and-menus.md`).
9. Score-track semantics: which track belongs to which player, and what the ringed node means
   (current score vs. required-to-win tier) — needs a game with a non-zero score.
10. Whether `HAND REVEALED` is the exact English string for `sim.handRevealed`-style key and where the
    chip is anchored (it renders centered above the self hand fan).

**Resolved after the first draft** (see `.recon/specs/scratch/setup-mulligan-overlays.md`):
* the mulligan screen is a **2-row flex row**, *not* a fan — the fan is hidden via `hideHands` during
  `mulligan`; selected cards use `border-[rgba(255,174,128,0.78)] brightness-[0.83]` with a spring
  scale `0.92`; there are **no keyboard shortcuts** in the mulligan/setup flows (grep-verified);
* `data-mulligan-layout-id` = `` `mulligan-hand:${room}:${player}:${index}` `` and
  `data-mulligan-counter-rotation` = `-(deg + 180 * topSide)` (module `407444`);
* `submit_mulligan` carries `{ cardIds }`, selection cap 2; resolution runs 0.26 s with an 18 ms
  stagger, and keep/draw flights are tweened at `320 + 70i` ms along a curved `path`;
* setup panels are `pointer-events-none z-45` over a `z-44` dim backdrop (initiative dice `z-95/96`).

---

## 14. Multi-player (FFA / 2v2) layout rules

| rule | source |
|---|---|
| `ss = players.filter(p => p.id !== me.id).slice(0, 3)` — up to three opponents | `0xawjzm3yjpr1.js:52187` |
| `sh = players.length > 2 && ss.length > 1` → `usesCompactOpponentRail` | `:52204` |
| `sh === true` ⇒ each opponent renders a **compact board** (`um`, `data-compact-opponent-board`) instead of the full `PlayerLayer`; the full-width opponent layer + `pJ` presence badge is rendered only when `!sh && opponent` | `:63195-63210` |
| `sh === true` ⇒ `--local-player-layer-bottom-inset: 0.32rem` (self band drops); `--battlefield-top-inset: var(--tablet-opponent-band)` on touch, `calc(30% - 0.36rem)` on desktop | `:61660-61790` |
| `data-compact-opponent-count` on the board root | `:63040` |
| compact opponent mini-board surface: `absolute bottom-[0.12rem] left-[0.14rem] right-[1.28rem] top-[1.3rem] z-10 min-h-0 overflow-hidden rounded-[0.12rem] after:pointer-events-none after:absolute after:inset-[0.08rem] after:z-30 after:opacity-20 after:gb-ornament-zone after:content-['']` | `um`, `:34060` |
| `L = { beside: 1.8, above: 4 }` rem and `h = 2.12 * cardHeightPx + L.above * rootRemPx` — the compact-rail height budget | `439rnwycqsxxv.js` module `929289` |
| battlefield columns adapt: 2 normal battlefields (3 with the shared-token column, 4 with a "supplemental" battlefield) | `43500-43530` |
| spectator view (`viewerRole === "spectator"`) renders **all** players (`uZ = e.players`) and can cycle perspective | `:56020` |

---