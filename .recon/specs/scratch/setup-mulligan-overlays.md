# Setup flow / mulligan / sideboarding overlays — `2atnqtfqvj-z4.js`

Source: `.recon/pretty/playapp/2atnqtfqvj-z4.js` (263 KB, 5 288 lines, Turbopack chunk, module id **703180**).
Everything below is quoted **verbatim** from the prettified bundle. Line numbers are `file:line`.

Companion facts that live in *other* chunks are marked **[cross-chunk]** and were verified — they are
required to reproduce the mulligan screen, which is split across three files:

| owner | file | what it owns |
|---|---|---|
| this chunk | `2atnqtfqvj-z4.js` | `SetupFlowOverlays` (all setup overlays incl. the whole mulligan overlay), `SideboardingLeaveButton` |
| game route | `35qz5rkx7yexy.js` | mounts `SetupFlowOverlays` (`:39880-39901`), phase gates, dim backdrop, initiative-dice wrapper `lB`, first-player-choice overlay `t3`, all action dispatchers |
| board UI | `0xawjzm3yjpr1.js` | **hand fan** that the mulligan cards fly from (`handFanSlot`, `:28121-28900`) |
| helpers | `0b7ie2g_9_ubz.js` | module **407444** = mulligan layout-id / counter-rotation / flight-transition maths; module **801686** = mulligan timing constants; module **6717** = setup opponent identity strip |
| helper | `25vik2nxxo51i.js` | module **710625** = image `sizes`/quality constants (`H.*`) |
| dice | `3vkoknf821dno.js` (lazy) / `03azfb7rltdws.js` module 269913 | 3-D dice stage / **static dice fallback** (DOM shell + chooser banner) |
| CSS | `…/chunks/1sj2l8ggay34g.css` | `.setup-*`, `.handRail`, `.handFanSlot`, `[data-setup-overlay]` rules |

---

## 0. Mounting & shell (who renders what, z-order, backdrop)

`35qz5rkx7yexy.js:39792` — the frame class handed to **every** setup overlay as
`boardSurfaceOverlayFrameClass` (= `M` inside `SetupFlowOverlays`):

```
absolute inset-y-[0.28rem] left-[0.28rem] right-[var(--board-surface-overlay-right,0.28rem)] max-[1200px]:right-[0.28rem] overflow-hidden
```

`35qz5rkx7yexy.js:39864-39874` — dim backdrop. Gate `hq` (`:39093-39103`) =
`ha || hr || (b_ && i6?.phase === "initiative_roll") || hn || hi || hf || hv || hk` — i.e. it covers **all**
setup phases (sideboarding, battlefield, initiative_roll, dice, first-player choice, goldfish turn order,
mulligan, mulligan resolution). It slides away when the mulligan *resolution* starts (the `<motion.div>` animates to `opacity: +!hk`):

```
<div className={`pointer-events-none z-44 ${r}`} data-testid="setup-dim-overlay">
  <motion.div initial={false} animate={{ opacity: +!hk }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,36,62,0.32),rgba(4,10,21,0.66))]" />
```

Z-order ladder (CSS `.z-*` verified in the compiled CSS):

| layer | value | element |
|---|---|---|
| dim backdrop | `z-44` = 44 | `[data-testid=setup-dim-overlay]` (parent) |
| battlefield / sideboarding / mulligan overlays | `z-45` = 45 | `motion.div[data-setup-overlay=…]` |
| mulligan **resolution** overlay | `z-46` = 46 | `[data-testid=mulligan-resolution-overlay]` |
| static dice layer | `z-95` = 95 | dice container inside dice component |
| initiative (animated dice) | `z-96` = 96 | `pointer-events-none absolute inset-0 z-96` (`35qz:40211`) |

Global CSS for these overlays (`1sj2l8ggay34g.css`):

```
:is(.gb-board,[data-setup-overlay],[data-touch-card-surface],.touch-card-menu),
:is(.gb-board,[data-setup-overlay],[data-touch-card-surface],.touch-card-menu) *
  {-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}

[data-setup-overlay=sideboarding] .setup-sideboard-heading{…top:.75rem}   (≤600px / landscape)
.setup-sideboard-body{top:3rem;bottom:.75rem}
[data-has-seat-tabs=true] .setup-sideboard-body{top:5.5rem}
[data-setup-seat-tabs]{top:2.75rem;inset-inline:.75rem}
[data-testid=sideboarding-footer-actions]{grid-template-columns:repeat(2,minmax(0,1fr));gap:.375rem;display:grid}  (≤600px)
.setup-solo-chooser{max-height:calc(100% - 2rem)}
.setup-solo-mode-card{min-height:12.5rem;padding:.75rem}
.setup-opponent-random-battlefield{left:min(50% + 16rem,100% - 3.5rem);top:50%!important}  (landscape)
```

### 0.1 `SetupFlowOverlays` props (verbatim, `2atnqtfqvj-z4.js:2229-2260`)

```js
{ room: j, me: w, opponent: k, isBusy: N, opponentDisconnected: C,
  boardSurfaceOverlayFrameClass: M, showSideboardingOverlay: z,
  showBattlefieldOverlay: O, showMulliganOverlay: Q, showMulliganResolutionOverlay: Z,
  opponentHandRevealed: ec, showDeckChangeActions: eu, chooseDeckDisabled: ek,
  chooseDeckDisabledReason: eS, setup: eC, controllablePlayers: eM,
  activePlayerId: eD, soloOpponentSeatBusy: eB, onChooseDeck: eR, onImportDeck: eL,
  onChooseSoloOpponentDeck: ez, onChooseSoloOpponentRegistration: eF,
  onImportSoloOpponentDeck: eY, onConfirmGoldfish: ae, onQuickStartSolo: aa,
  onActivePlayerChange: at, onLeaveRoom: ar, matchRecoveryNotice: ai,
  onSideboardHoverPreviewChange: an, onReadableIdentityCardsChange: as }
```

Phase gates (`35qz5rkx7yexy.js:38849-38855`, `39011`), with `b_` = board view shown:

```js
hr = b_ && !!lT && (i6?.phase === "battlefield_pick" || bI.battlefieldRandomRevealActive)   // showBattlefieldOverlay
ha = b_ && !!lT && !hr && i6?.phase === "sideboarding"                                       // showSideboardingOverlay
hv = b_ && !!lT && i6?.phase === "mulligan"                                                  // showMulliganOverlay
hk = !!(b_ && lT && bI.mulliganResolution && (b2 || lL))                                     // showMulliganResolutionOverlay
hn = b_ && !!(lT && lL) && !hr && null !== bJ && bQ.pending                                  // initiative dice overlay
hi = b_ && !!(lT && lL) && i6?.phase === "first_player_choice" && !hr && !hn                 // choose-first-player overlay
```

### 0.2 Return tree (`2atnqtfqvj-z4.js:5256-5273`)

```js
y = jsxs(b, { initial: h, children: [u, g] })        // b = AnimatePresence (P.f), h = false, u = mulligan, g = mulligan resolution
v = jsxs(a.Fragment, { children: [x, f, y] })        // x = AnimatePresence(sideboarding tB), f = AnimatePresence(battlefield aN)
```

So: `Fragment[ <AnimatePresence initial={false}>{sideboarding}</AnimatePresence>,
<AnimatePresence initial={false}>{battlefield}</AnimatePresence>,
<AnimatePresence initial={false}>{mulligan}{mulliganResolution}</AnimatePresence> ]`.

Transition presets used by the three `data-setup-overlay` panels (identical for sideboarding + mulligan):

```js
initial: { opacity: 0, scale: 0.992, y: 8 }
animate: { opacity: 1, scale: 1, y: 0 }
exit:    { opacity: 0, scale: 0.994, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }
transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
className: `pointer-events-none z-45 select-none ${M}`
```

Battlefield differs (`:3892`, `:3955-3968`):

```js
initial: { opacity: 0 } ; animate: { opacity: 1 }
transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
exit: { opacity: 0, scale: 0.992, transition: { duration: 0.32, ease: [0.33, 1, 0.68, 1] } }
```

### 0.3 Shared module-level class/variable constants (`:251-284`)

```js
en = "pointer-events-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-none border border-[rgba(132,150,184,0.3)] bg-[linear-gradient(180deg,rgba(9,18,32,0.96),rgba(5,12,23,0.94))] px-3 py-2 shadow-[inset_0_1px_0_rgba(219,231,249,0.025),0_8px_18px_rgba(2,8,19,0.2)]"
es = "shrink-0 whitespace-nowrap rounded-none border border-[rgba(132,150,184,0.3)] bg-[rgba(11,19,32,0.92)] px-2.5 py-[0.3rem] text-[0.72rem] text-text-main transition hover:border-[rgba(224,194,135,0.62)] hover:bg-[rgba(18,28,45,0.96)] focus-visible:border-[rgba(224,194,135,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
el = "shrink-0 whitespace-nowrap rounded-none border border-[rgba(197,120,120,0.4)] bg-[rgba(73,28,34,0.78)] px-2.5 py-[0.3rem] text-[0.72rem] text-[#ffd8d8] transition hover:border-[rgba(233,157,157,0.58)] hover:bg-[rgba(93,34,42,0.9)] focus-visible:border-[rgba(255,184,184,0.82)] focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
eo = "flex min-w-0 basis-full flex-wrap items-center gap-1.5 pb-0.5 max-[980px]:flex-nowrap max-[980px]:overflow-x-auto max-[980px]:[scrollbar-color:rgba(132,150,184,0.38)_transparent] max-[980px]:[scrollbar-width:thin]"
ed = "ml-auto inline-flex shrink-0 items-center gap-1 text-[0.58rem] uppercase tracking-[0.08em] text-text-soft min-[981px]:hidden"
ec = "inline-flex h-10 items-center justify-center gap-2 rounded-[0.12rem] border border-[rgba(236,204,143,0.86)] bg-[linear-gradient(180deg,rgba(42,82,128,0.98),rgba(10,35,69,0.98))] px-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#fff1d4] shadow-[inset_0_0_0_1px_rgba(255,233,190,0.14),0_10px_24px_rgba(2,8,19,0.5),0_0_18px_rgba(224,194,135,0.12)] transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-px hover:border-[rgba(255,226,169,1)] hover:bg-[linear-gradient(180deg,rgba(52,98,151,1),rgba(13,43,82,1))] hover:shadow-[inset_0_0_0_1px_rgba(255,239,207,0.22),0_12px_28px_rgba(2,8,19,0.58),0_0_22px_rgba(224,194,135,0.22)] focus-visible:border-[#ffe2a8] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(255,239,207,0.24),0_0_0_2px_rgba(224,194,135,0.24),0_10px_24px_rgba(2,8,19,0.5)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-50"
em = "pointer-events-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-[rgba(132,150,184,0.32)] bg-[rgba(8,14,24,0.72)] px-3 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[#eef3fa] shadow-[0_8px_18px_rgba(3,10,22,0.28)] transition hover:border-[rgba(139,222,189,0.62)] hover:bg-[rgba(18,38,36,0.86)] focus-visible:border-[rgba(139,222,189,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50"
ep = "min-w-48 rounded-none border border-[rgba(132,150,184,0.5)] bg-[rgba(8,14,24,0.72)] px-4 py-2 text-[0.76rem] uppercase tracking-widest text-text-soft transition-[border-color,background,color] duration-140 hover:border-[rgba(224,194,135,0.68)] hover:bg-[rgba(18,28,45,0.94)] hover:text-[#fff0d2] focus-visible:border-[rgba(224,194,135,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50 max-[720px]:w-full"
eb = "min-w-48 rounded-none border border-[rgba(110,215,177,0.62)] bg-[linear-gradient(180deg,rgba(22,91,74,0.92),rgba(10,52,47,0.94))] px-4 py-2 text-[0.76rem] font-semibold uppercase tracking-widest text-[#c9ffec] shadow-[inset_0_0_0_1px_rgba(191,255,231,0.08),0_8px_18px_rgba(3,10,22,0.36)] transition-[border-color,background,color] duration-140 hover:border-[rgba(139,240,201,0.84)] hover:bg-[linear-gradient(180deg,rgba(28,111,89,0.96),rgba(12,65,57,0.98))] focus-visible:border-[rgba(158,255,219,0.94)] focus-visible:outline-none disabled:cursor-default disabled:opacity-65 max-[720px]:w-full"
eu = "pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.14rem] border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.1em] transition-[transform,border-color,background-color,box-shadow,color] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_rgba(238,245,255,0.3),0_0_0_1px_rgba(9,18,34,0.9)] disabled:cursor-default disabled:opacity-50"

// CSS custom-property bundles (portrait card = 1 : 1.4 ; battlefield = 1 : 0.718)
eg = { "--bf-draft-w": "min(clamp(11.2rem,24vw,27.5rem), calc((100vw - 4.1rem) / 3), calc((100dvh - 14rem) / 1.436))",
       "--bf-draft-h": "calc(var(--bf-draft-w) * 0.718)" }
ex = { "--mul-card-w": "min(clamp(8.2rem,14vw,15.8rem), calc((100vw - 4.65rem) / 4), calc((100dvh - 14rem) / 2.8))",
       "--mul-card-h": "calc(var(--mul-card-w) * 1.4)" }
ef = { ...ex, top: "min(calc(50% + (var(--mul-card-h) / 2) + 1rem), calc(100% - 1.2rem))" }
ez = { "--mp-bf-w": "min(clamp(8.2rem,14vw,13rem), calc((100vw - 4rem) / 3))",
       "--mp-bf-h": "calc(var(--mp-bf-w) * 0.718)" }

eS = { active:   "border-[rgba(224,194,135,0.52)] bg-[rgba(71,53,26,0.58)] text-[#ffe8bd]",
       complete: "border-[rgba(110,215,177,0.42)] bg-[rgba(20,73,63,0.42)] text-[#9af4d6]",
       neutral:  "border-[rgba(132,150,184,0.28)] bg-[rgba(11,19,32,0.72)] text-text-soft",
       waiting:  "border-[rgba(132,150,184,0.32)] bg-[rgba(8,14,24,0.78)] text-[#d8e0ec]" }
eC = { active: "text-[#f0ce8b]", complete: "text-[#8ff0cf]", neutral: "text-white/38", waiting: "text-[#9ba9bc]" }
```

Heading component `eN` (`:427-484`) — the framed label used by every setup screen:

```js
<span className="h-px w-[1.85rem] bg-[linear-gradient(90deg,rgba(200,176,130,0),rgba(200,176,130,0.88))]" />
<span className="text-shadow-[0_1px_0_rgba(8,18,34,0.55)]">{children}</span>
<span className="h-px w-[1.85rem] bg-[linear-gradient(90deg,rgba(200,176,130,0.88),rgba(200,176,130,0))]" />
div className="text-center max-[600px]:gap-2 max-[600px]:text-[0.68rem] max-[600px]:tracking-[0.08em] flex items-center gap-[0.62rem] text-[0.8rem] uppercase tracking-[0.14em] text-[#e8dcc1]"
```
Wrapped by callers in
`rounded-none border border-[rgba(199,176,131,0.62)] bg-[linear-gradient(145deg,rgba(16,40,74,0.96),rgba(6,18,38,0.95))] px-[1.22rem] py-[0.52rem] shadow-[inset_0_0_0_1px_rgba(232,214,176,0.18),0_12px_28px_rgba(2,8,19,0.58)]`.

### 0.4 Roster/status strip `eP` (`:513-690`), chip `eB` (`:691-731`), icon `eD` (`:490-512`)

`eP` has `density: "compact" | "comfortable"` (default `"comfortable"`).
compact root: `pointer-events-none relative flex min-w-0 flex-1 items-stretch rounded-[0.16rem] border border-[rgba(132,150,184,0.28)] bg-[rgba(7,13,23,0.7)]`
+ `role="status" aria-atomic="false" aria-live="polite" data-player-count={x} data-ready-count={u} data-setup-roster-density="compact" data-testid={c}`.
compact summary chip: `flex shrink-0 items-center gap-1 border-r border-[rgba(132,150,184,0.22)] px-2 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-white/48` with `<span className="max-[480px]:sr-only">{label}</span><span className="text-white/76">{ready}/{total}</span>`.
compact list: `m-0 grid min-w-0 flex-1 grid-flow-col auto-cols-fr list-none divide-x divide-[rgba(132,150,184,0.18)] p-0`; each `<li className={"pointer-events-auto relative min-w-0 text-[0.58rem] font-semibold uppercase tracking-[0.06em] last:rounded-r-[0.12rem] " + (relation==="self" ? "bg-[rgba(74,56,28,0.26)] shadow-[inset_0_0_0_1px_rgba(224,194,135,0.28)]" : "bg-[rgba(9,16,27,0.3)]")} data-player-id data-player-relation data-setup-status data-turn-rank>` containing a `<details className="group relative h-full min-w-0" name={"<testId ?? setup-roster>-player-status"}>` + tooltip span.
comfortable root: `pointer-events-none flex min-w-0 flex-wrap items-center justify-center gap-1.5` + `data-setup-roster-density="comfortable"`.
`eB` chip: ``className={`flex min-w-0 items-center gap-1.5 rounded-[0.18rem] border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${eS[e.tone]}`}`` with `title={playerLabel, name, teamLabel, relationLabel, status joined by ", "}`.
`eD` status icon: `` let l = `h-3 w-3 shrink-0 stroke-[2.1] ${eC[n.tone]}` `` and icon choice
`complete → m.f`, `active → k` (local lucide **pencil-line**), `neutral → j.f`, `waiting → b.f`.

---

## 1. MULLIGAN screen (most important)

### 1.1 Overlay shell (`2atnqtfqvj-z4.js:4565-4600`, 5216-5240)

```js
motion.div { "data-setup-overlay": "mulligan",
  initial: { opacity: 0, scale: 0.992, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.994, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
  transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  className: `pointer-events-none z-45 select-none ${M}` }
```
Children (in order):
1. If not single-player: `er.M` = `[cross-chunk module 6717]` `<SetupOpponentIdentityStrip players presentations phase="mulligan" roomMode onHoverPreviewChange onReadableCardsChange>` →
   DOM: `div[data-setup-opponent-preview="mulligan"]` (CSS-module classes `layer`), inner `div[data-setup-opponent-strip][style]` (`strip`), lit-card ghosts `div[data-setup-identity-card=<cardId>]` (`litCard`), chips `m[data-setup-opponent-strip="inline"][data-multiple-opponents]`.
2. If not multiplayer-with-teams: centred heading band, absolute `inset-x-0 top-[49.4%] z-20 -translate-y-1/2 flex justify-center` →
   `eN` text = `aj ? "sim.chooseBothMulligans" : "sim.chooseYourMulligan"` when `canSubmitMulligan`, else `"sim.mulligan"`.
3. `J` (card-art readiness gate) wrapping either `eT` (multiplayer/teams) or the two-row layout.

If `showMulliganOverlay` is false the whole tree is absent (gated by `Q &&`).

### 1.2 Card layouts — it is a **flat ROW (flex), not a fan**

Two variants inside one `grid grid-rows-2`:

```
<div className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid grid-rows-2 gap-8 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4">
  <div className="relative grid place-items-center">   <!-- opponent row -->
    <div className={"relative translate-y-[-1.1rem] " + (aj ? "pointer-events-auto" : "pointer-events-none")}>
      … opponent "opponentKept / opponentLockedIn" chip …
      <div className="relative flex items-center justify-center">
        <div className="flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]">  <!-- the row -->
  <div className="relative grid place-items-center">   <!-- own row -->
    <div className="pointer-events-auto relative flex items-center justify-center">
      <div data-testid="mulligan-own-options" aria-busy={!ready}
           className="relative flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]">
```
* Row gap: `gap-[1.1rem]`, `gap-[0.55rem]` under 980 px. Opponent row is shifted up `translate-y-[-1.1rem]`; own row identical container.
* Opponent row renders `Array.from({ length: Math.max(4, eC.opponentDisplayedMulliganCards.length) })` — i.e. always ≥ 4 slots, empty slots render a card back.
* Card size comes solely from `style={ex}` on every card (`h-(--mul-card-h) w-(--mul-card-w)`), so the row width = `4 × --mul-card-w + 3 × 1.1rem`.

The **fan** exists only on the board behind the overlay **[cross-chunk]** (`0xawjzm3yjpr1.js:28434`, `28680`, `28776`, `28879`; classes quoted in `.recon/specs/02-board-ui.md` §2.4):

```
group handFanSlot pointer-events-auto absolute left-1/2 top-0 z-0 flex items-start w-(--card-width) h-(--card-height)
origin-[center_bottom] transform-[translate(calc(-50%+var(--fan-offset-x,0rem)),calc(var(--fan-translate-y,0px)+var(--fan-hover-raise,0px)))_rotate(var(--fan-rotate,0deg))]
transition-transform duration-220 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none group-hover:z-80 group-focus-within:z-80
```
with custom props `--card-width/--card-height/--fan-offset-x/--fan-translate-y/--fan-hover-raise/--fan-rotate/--hand-fan-bottom-overflow` computed by the board's fan math (see `02-board-ui.md`); CSS overrides `.handRail .handFanSlot:hover{--fan-hover-raise:0px}`, `.handRail .handFanSlot[data-card-action-hover-active=true]{--fan-hover-raise:-12px}`.
During `mulligan` the board hands are hidden from this component: `hideHands` is passed as `hv` (= phase === "mulligan") from `35qz:40067`.

### 1.3 Card button: selection states, animation, click

Own hand (`:4826-4900`), per card `i = mulliganSelection.includes(t.id)`:

```js
<motion.button type="button" aria-pressed={i}
  disabled={!ready || isBusy || myMulliganDone || !canSubmitMulligan}
  onClick={() => toggleMulliganSelection(t.id)}
  initial={{ opacity: 0, y: 26, scale: 0.9 }}
  animate={{ opacity: 1, y: -20, scale: i ? 0.92 : 1 }}
  transition={{ delay: 0.05 * index, type: "spring", stiffness: 176, damping: 24 }}
  className={`relative h-(--mul-card-h) w-(--mul-card-w) rounded-none border overflow-hidden shadow-[0_16px_28px_rgba(3,10,22,0.5)] ${i ? "border-[rgba(255,174,128,0.78)] brightness-[0.83]" : "border-[rgba(188,165,122,0.38)]"} ${myMulliganDone || !canSubmitMulligan ? "cursor-default" : "cursor-pointer"}`}
  style={{ ...ex, visibility: ready ? undefined : "hidden" }} />
```
* Selected = **amber border + brightness 0.83 + scale 0.92**; unselected = parchment border. No glow, no rotation, no hover class (hover feedback is `cursor-pointer` only).
* Opposite hand (`:4720-4795`): `initial={{opacity:0,y:-24,scale:0.9}}`, `animate={{opacity:1,y:20,scale: selected ? 0.92 : 1}}`, `transition={{delay:0.05*index, spring stiffness 170, damping 23}}`, class
  `` `relative h-(--mul-card-h) w-(--mul-card-w) rounded-none border bg-[rgba(14,26,48,0.82)] shadow-[0_12px_24px_rgba(3,10,22,0.5)] overflow-hidden ${sel ? "border-[rgba(255,174,128,0.78)] brightness-[0.83]" : "border-[rgba(184,166,136,0.38)]"} ${aj && !opponentMulliganDone ? "cursor-pointer" : "cursor-default"}` ``.
  Interactive **only in solo-lab** (`aj`), click → `toggleOpponentMulliganSelection(id)`.
* Card art: `T.GameCardArt { src: r.Y(entry), cardId, profile: "preview", loading: "eager", onReady, readinessTimeoutMs: 5000, retainFallbackOnRetry: true, sizes: H.Y, className: "object-cover" }`; face-down mode → `A.L { customization, alt: i18n("sim.setup.handCardBack"|"sim.opponentHandCardBack"), insetPx: 0, sizes: H.Y, quality: H.n }`.
  `H.Y` = `"(max-width: 980px) 24vw, (max-width: 1400px) 15vw, 15.8rem"`, `H.n` = `90` (module 710625 in `25vik2nxxo51i.js`).
* Readiness gate `J` (`:176-201`) counts `onCardReady(id)` and only flips `ready` when `cardIds.every(...)`; while not ready the cards are `visibility: hidden` and `ee` shows the loading status:
  `span[role=status][data-testid=mulligan-art-loading].absolute inset-0 flex items-center justify-center gap-2 text-[0.8rem] text-text-soft` → spinner `size-4 animate-spin motion-reduce:animate-none` + `sim.setup.loadingHand` ("Loading your hand…"); it appears only after a 250 ms `setTimeout`.
* **Keyboard shortcuts: none.** No `onKeyDown`/keydown listener exists anywhere in this chunk for the mulligan flow (verified by grep). Selection is click-only; buttons are real `<button>`s so Tab/Enter/Space work through native activation. Escape has no handler here.

### 1.4 `local-mulligan-turn-rank` and the 1st/2nd badges

* `S = turnRank ? i18n("sim.setup.turnRank", { rank }) : null` and `S` is rendered as
  `<span data-testid="local-mulligan-turn-rank">{S}</span>` inside
  `div.flex flex-wrap items-center justify-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-white/76` (children: playerLabel, name (`normal-case tracking-normal text-white/88`), teamLabel, turn rank). `sim.setup.turnRank` = `"{rank}st/nd/rd/th"`.
* Badge floated next to each row (own/opponent) — `1st` if that player is first player, else `2nd`:
  opponent (`:4655`): class
  `max-[600px]:left-1/2 max-[600px]:top-[-0.3rem] max-[600px]:-translate-x-1/2 max-[600px]:ml-0 max-[600px]:text-[0.65rem] absolute left-full top-1/2 ml-[0.8rem] inline-flex shrink-0 -translate-y-1/2 items-center justify-center rounded-[0.3rem] border border-white/18 bg-black/22 px-[0.7rem] py-[0.28rem] text-[1.05rem] font-semibold tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-[2px] max-[980px]:ml-[0.45rem] max-[980px]:px-[0.58rem] max-[980px]:py-[0.22rem] max-[980px]:text-[0.9rem]`
  own (`:4800`): mirrored `absolute right-full top-1/2 mr-[0.8rem] … max-[600px]:right-auto max-[600px]:left-1/2 max-[600px]:top-[-2.8rem] …`.
  Text: `a6 ? i18n("sim.first") : i18n("sim.second")` (= `"1st"` / `"2nd"`).

### 1.5 Submit / confirm UI + "lock status"

Own row footer, absolutely positioned with `style={ef}` under the row
(`<div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center gap-2" style={ef}>`),
rendered only when `canSubmitMulligan`:

| case | element |
|---|---|
| solo-lab, both done | `<span className="inline-flex min-w-[8.6rem] items-center justify-center rounded-none border border-[rgba(110,215,177,0.5)] text-[#8ff6d3] bg-[rgba(20,73,63,0.62)] py-[0.42rem] px-[0.8rem] text-[0.76rem] uppercase tracking-[0.09em]">sim.bothLockedIn</span>` |
| solo-lab | `<button className="min-w-42 cursor-pointer rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] text-[#fff0d2] text-[0.76rem] uppercase tracking-[0.09em] py-[0.42rem] px-[0.8rem] shadow-[inset_0_0_0_1px_rgba(246,223,176,0.16),0_8px_18px_rgba(3,10,22,0.45)] transition-[transform,box-shadow,border-color,background] duration-140 hover:-translate-y-px hover:border-[rgba(243,214,157,0.96)] hover:bg-[linear-gradient(180deg,rgba(42,93,144,1),rgba(12,39,77,1))] hover:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.26),0_10px_22px_rgba(3,10,22,0.5)] active:translate-y-0 active:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.18),0_6px_14px_rgba(3,10,22,0.42)] disabled:opacity-[0.56] disabled:cursor-default disabled:transform-none" disabled={!ready||busy||mulliganSubmitting} onClick={submitBothMulligans}>` label = `mulliganSubmitting ? sim.lockingInBoth : (sel+oppSel>0 ? sim.lockInBothMulligan({count}) : sim.lockInBothKeep)` |
| already locked in | `<span>` (same green chip class as above) label `sim.lockedIn` ("Locked In") |
| normal | `<button className="min-w-[8.6rem] cursor-pointer rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] text-[#fff0d2] text-[0.76rem] uppercase tracking-[0.09em] py-[0.42rem] px-[0.8rem] shadow-[inset_0_0_0_1px_rgba(246,223,176,0.16),0_8px_18px_rgba(3,10,22,0.45)] transition-[transform,box-shadow,border-color,background] duration-140 hover:-translate-y-px hover:border-[rgba(243,214,157,0.96)] hover:bg-[linear-gradient(180deg,rgba(42,93,144,1),rgba(12,39,77,1))] hover:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.26),0_10px_22px_rgba(3,10,22,0.5)] active:translate-y-0 active:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.18),0_6px_14px_rgba(3,10,22,0.42)] disabled:opacity-[0.56] disabled:cursor-default disabled:transform-none" disabled={!ready||busy||mulliganSubmitting} onClick={submitMulligan}>` label = `mulliganSelection.length > 0 ? i18n("sim.mulliganCount",{count}) : i18n("sim.keepHand")` |

Labels (English, resolved from the flight catalogue in `site/playapp/playroot.html`):
`sim.mulligan` "Mulligan" · `sim.mulliganCount` "Mulligan {count}" · `sim.keepHand` "Keep Hand" ·
`sim.setup.mulliganCount` "Mulligan {count}" · `sim.setup.keepHand` "Keep Hand" · `sim.setup.lockedIn` "Locked In" ·
`sim.lockedIn` "Locked In" · `sim.lockInBothMulligan` "Lock In Both · Mulligan {count}" · `sim.lockInBothKeep` "Lock In Both · Keep both" ·
`sim.lockingInBoth` "Locking In Both..." · `sim.bothLockedIn` "Both Locked In" · `sim.chooseYourMulligan` "Choose Your Mulligan" ·
`sim.chooseBothMulligans` "Choose Both Mulligans" · `sim.opponentKept` "Opponent kept {count}" · `sim.opponentLockedIn` "Opponent Locked In" ·
`sim.setup.loadingHand` "Loading your hand…" · `sim.setup.handCardBack` "Hand card back" · `sim.opponentHandCardBack` "Opponent hand card back" ·
`sim.opponentHandCard` "Opponent hand card" · `sim.first` "1st" · `sim.second` "2nd" · `sim.you` "You" · `sim.opponent` "Opponent" · `sim.setup.ally` "Ally".

"Lock status" strip = `eP` with `aria-label = i18n("sim.setup.mulliganLockStatus")` ("Mulligan lock status") and rows built at `:2470-2485`:
`status = aR.has(id) ? "sim.setup.locked" : mine ? "sim.setup.choosing" : "sim.setup.waiting"`, `tone = done ? "complete" : mine ? "active" : "waiting"`, where `aR = new Set(room.mulliganDonePlayerIds ?? [])`.
Rendered above the body: `eP` inside `absolute inset-x-[2.2rem] top-[2.2rem] … flex min-h-0 flex-col items-center justify-between` (multiplayer variant only).

Opponent kept chip (`:4633-4646`) shows `sim.opponentKept {count}` when the count is known, else `sim.opponentLockedIn`:
```js
a0 = typeof redrawCount === "number" ? Math.max(0, 4 - redrawCount) : <log regex> ;
re = /finalized mulligan \((\d+) recycled,/i  →  Math.max(0, 4 - parseInt(m[1]))
```
cross-chunk source: `room.mulliganPlaybackByPlayerId[opponentId].redrawCount`.

### 1.6 Multiplayer mulligan picker `eT` (`:1134-1364`)

Used when `aC` (variant → "duel" === false && players > 2, module 298824 `R`) and a presentation row for me exists.

```
<div className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] flex min-h-0 flex-col items-center justify-between gap-3 pt-2 pb-3 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4"
     data-testid="multiplayer-mulligan-picker">
  [eP roster strip, aria-label = sim.setup.mulliganLockStatus]
  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-white/76">
          <span>{playerLabel}</span>
          <span className="normal-case tracking-normal text-white/88">{name}</span>
          <span>{teamLabel}</span>
          [<span data-testid="local-mulligan-turn-rank">  "{N}th" via sim.setup.turnRank </span>]
      </div>
      <div data-testid="mulligan-own-options" aria-busy={!art.ready}
           className="relative pointer-events-auto flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]" style={ex}>
          [ee loading status when !ready]
          {displayedMulliganCards.map(<motion.button> … same card class as 1.3 but without bg-… ) }
      </div>
      {canSubmitMulligan && ( locked chip | submit button `sim.setup.mulliganCount`/`sim.setup.keepHand` )}
  </div>
</div>
```
Card in `eT` (`:1247-1262`): `className={`relative h-(--mul-card-h) w-(--mul-card-w) overflow-hidden rounded-none border shadow-[0_16px_28px_rgba(3,10,22,0.5)] ${selected ? "border-[rgba(255,174,128,0.78)] brightness-[0.83]" : "border-[rgba(188,165,122,0.38)]"} ${myMulliganDone || !canSubmitMulligan ? "cursor-default" : "cursor-pointer"}`}`,
`initial={{opacity:0,y:22,scale:0.92}}`, `animate={{opacity:1,y:0,scale:selected?0.92:1}}`, `transition={{delay:0.05*index, type:"spring", stiffness:176, damping:24}}`; **no `aria-pressed`** here (unlike the 2-player overlay).
Submit button in `eT` (`:1314-1330`): `className="pointer-events-auto min-w-[8.6rem] cursor-pointer rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] px-[0.8rem] py-[0.42rem] text-[0.76rem] uppercase tracking-[0.09em] text-[#fff0d2] shadow-[inset_0_0_0_1px_rgba(246,223,176,0.16),0_8px_18px_rgba(3,10,22,0.45)] disabled:cursor-default disabled:opacity-[0.56]"`.

**3/4-player flow**: the picker shows only *your* row + roster strip; other players' rows are not shown here — the multiplayer `grid grid-rows-2` variant (1.2) is used only in 2-player/duel. In 3/4p the opponent row is replaced by the roster strip + your row (grid-rows-1 in the resolution overlay).

### 1.7 Resolution / opponent redraw playback (`:5003-5240`) — `[data-testid=mulligan-resolution-overlay]`

```js
motion.div { "data-testid": "mulligan-resolution-overlay", initial: false, animate: { opacity: 1 },
  className: `pointer-events-none z-46 select-none ${M}` }
└ <div className={`absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid gap-[1.6rem] max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4 ${aC ? "grid-rows-1" : "grid-rows-2"}`}>
```
`step` states drive both rows: `"show"` → `{opacity:1, y:±20, rotate:0, scale:1}`, transition `{duration:0.22, ease:[0.22,1,0.36,1]}`;
anything else → `{opacity:0, y:±6, rotate:index%2===0 ? -2.4 : 2.4, scale:0.94}`, transition `{duration: ei.D/1000, delay: index*ei.p/1000, ease:[0.4,0,0.2,1]}` — i.e. **0.26 s + 18 ms stagger** (`ei` = module 801686 constants `D = 260`, `p = 18`).
Cards whose layout is still flying are *not rendered*: `if (step === "fly_draw" || (step === "fly_kept" && kept)) return null`.
Each card motion.div carries `layoutId={layout}` + `data-mulligan-layout-id={layout}` / `data-mulligan-card-id`, `layoutCrossfade: false`, and class
`relative h-(--mul-card-h) w-(--mul-card-w) rounded-none border border-[rgba(188,165,122,0.38)] overflow-hidden shadow-[0_16px_28px_rgba(3,10,22,0.5)]` (opponent row: `border-[rgba(184,166,136,0.38)] bg-[rgba(14,26,48,0.82)] shadow-[0_12px_24px_rgba(3,10,22,0.5)]`), `style={ex}`; content = `A.S { card, imageInsetPx:0, imageProfile:"hand", imageSizes:H.Y, imageLoading:"eager", showCustomLabels:false }` or card back.

**[cross-chunk] layout ids & counter rotation** — module **407444** in `0b7ie2g_9_ubz.js:267-317`:
```js
p = (roomCode, playerId, index) => `mulligan-hand:${roomCode}:${playerId}:${index}`   // used as layoutId + data-mulligan-layout-id
r = (deg, topSide) => -(deg + 180 * !!topSide)                                        // data-mulligan-counter-rotation value
V = x   // flight transition: {type:"tween", duration: (320+70*clamp(i,0,3)+100)/1000, ease: piecewise, delay:0, path: <arc projection>}
G = x minus `path`  // rotate-only transition
W = (cardId, renderedHandCards, simulatedDraws) => `hand:${playerId}:${index}`-style id via module 862657 H
E = Map-merge helper that keeps old values for ids that persist
```
Flight tween easing (module 407444 `b`, `:235-256`): duration `320 + 70*i` ms is used for the *easing phases* — 0→260 ms uses `cubic-bezier(0.22,0,0.4,1)`, then a 46 % plateau, then the last 100 ms uses `cubic-bezier(0.16,0,0.48,0.84)`; `path` = curved projection (`d({strength,peak})` per index 0.15/0.36, 0.17/0.38, 0.18/0.4, 0.16/0.42) built from a quadratic Bézier `l()` + `o()` angle maths producing `rotate`.
Board side: the fan slot has `layoutId = mulliganHandLayoutIds.get(index) ?? cardIdKey` (`0xawjzm3yjpr1.js:28261`, merge at `:28044` via `dG.E`), and the card wrapper carries
`data-mulligan-layout-id={mulliganHandLayoutIds.get(index)}` + `data-mulligan-counter-rotation={S ? dG.r(fanRotationDeg, topSide) : null}` (`:28448-28459`), so during a layout animation the card's fan rotation is cancelled by the negative counter-rotation.

**[cross-chunk] timeline driving `step`** (`35qz5rkx7yexy.js:37100-37160`, module 801686 constants):
```js
step = "show"                                              // immediately, + submittedHandCards/keptCards
setTimeout(→ step = "fly_kept"; also push hiddenRefillCardIds, hide rune ids)  after ri.g  = 220 ms
setTimeout(→ step = "fly_draw")                                               after ri.y(s) = 220 + max(c(s-1),314) + 92 ms
setTimeout(→ resolution = null, delete playback)                              after ri.A(s) = ri.y(s) + 140 ms
// c(n) = 320 + 70*clamp(n,0,3) + 100 ; s = max(my keptCards.length, opponent kept)
```
`mulliganPlaybackByPlayerId[playerId] = { submittedHandCards, keptCards, submittedRuneAreaCardIds, redrawCount, hiddenRefillCardIds, hiddenRuneCardIds, draws }`.

**`submit_mulligan` action payload** (`35qz:37864`, `:37981`):
```js
ex(playerId, { type: "submit_mulligan", cardIds: n })   // n = the ids you recycle (cards you clicked)
```
Selection is capped at **2** cards (`// 35qz:37872  j.length >= 2` → ignore further clicks); solo submits two actions in sequence (self, then opponent) inside one busy flag. The same callback also optimistically writes `mulliganPlaybackByPlayerId[playerId] = {submittedHandCards, keptCards, submittedRuneAreaCardIds, redrawCount}`.
Solo auto-submit: `35qz:39006  bI.myMulliganDone || bI.submitMulligan()`; solo-lab auto: `bI.submitBothMulligans()`.

---

## 2. Initiative roll / 3-D dice / choose first player **[cross-chunk]**

None of this lives in `2atnqtfqvj-z4.js` (verified: the only hits for `initiative|firstPlayer|roll_` in this
chunk are `sim.setup.firstPlayerBattlefieldWait` and `firstPlayerId` reads). The DOM shell is:

`35qz5rkx7yexy.js:13962-14070` — wrapper `lB({ players, meId, chooserId, onComplete })`:
* tries the animated stage `lT(e.A(355332))` → `(await e).InitiativeDiceStage` from lazy chunk `3vkoknf821dno.js`; on failure logs `"[riftbound-sim] Animated initiative dice failed to load; using the static fallback."` and falls back to module **269913** (`03azfb7rltdws.js:680+`), exported as `lP.y`, rendered via `next/dynamic` (`lL`).
* timers: 5 000 ms watchdog before forcing the static mode; then `roll` locked at once, `1700 ms` → `rolling=false`… precisely: on `onReady(mode)` it schedules `w(true) @+1700 ms`, `C(true) @+1450 ms` (decision reveal), `onComplete() @+4000 ms`; `players.map(p => ({...p, rolling: !isStatic && !liftedAt1700, lifted: isStatic || lifted}))`.
* container `35qz:40211`: `motion.div… className: "pointer-events-none absolute inset-0 z-96"` keyed on the roll result (`bJ` = JSON of `[roomCode, initiativeRound, firstPlayerChooserId, [[playerId, value]…]]`).

Static dice DOM (module 269913, `03azfb7rltdws.js:1330-1400`):
```
div[data-initiative-layout="multiplayer-grid"|"duel-vertical"]
  className="pointer-events-none absolute inset-y-[0.28rem] left-[0.28rem] right-[16.28rem] z-95 overflow-hidden max-[1200px]:right-[0.28rem]"
  children: [ …dies… , chooser banner ]
```
per die (`y`, `:1009-1326`):
```
div[data-initiative-player-id][data-initiative-relation][data-initiative-winner="true"?][data-team-label]
   role="img" aria-label="<playerLabel · name>: <rolling|result N|waiting>"
   className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-55 w-55 ${positionClassName}`}
   style={{ width: winner ? "74%" : "62%", color: self #2bc78f | ally #4fafd0 | opponent #d88936 }}
└ svg viewBox="0 0 200 210" class="overflow-visible drop-shadow-[0_10px_12px_rgba(0,0,0,0.42)]"
   └ hexagon path "M100 12 183 50 179 151 100 197 21 151 17 50Z" + 10 shading facets
   └ text x=100 y=118 fontFamily="Georgia, serif" fontSize=42 fill="#fff1d1" stroke="#142c26"  → "?" / "…" / number
   └ path[data-initiative-orientation-line=<die value>] d="M90 125H110"  (only for 6 and 9, to disambiguate 6/9)
   └ sr-only "<label> <team/relation> <status>"
   └ (compact) span[data-initiative-identity-cue={relationLabel}][data-initiative-player-name={name}]
        class="pointer-events-auto inline-flex min-h-5 min-w-0 max-w-full cursor-default items-center gap-1 rounded-[0.18rem] border px-1.5 py-0.5 text-[0.7rem] font-bold leading-none shadow-[0_3px_10px_rgba(0,0,0,0.42)] <tone>",
        tones: self "border-[rgba(100,224,169,0.5)] bg-[rgba(7,31,23,0.9)] text-[#83dfb3]",
               ally "border-[rgba(111,186,214,0.52)] bg-[rgba(8,29,38,0.9)] text-[#8ed8ef]",
               opponent "border-[rgba(239,178,106,0.5)] bg-[rgba(40,24,8,0.9)] text-[#efbd7b]"
```
die positions: 2p `["left-[46%] top-[18%]", "left-[46%] top-[68%]"]`; 3p `["left-[30%] top-[24%]", "left-[62%] top-[24%]", "left-[46%] top-[70%]"]`; 4p `["left-[30%] top-[24%]", "left-[62%] top-[24%]", "left-[30%] top-[70%]", "left-[62%] top-[70%]"]`; die box `{ width: "clamp(10.5rem, 16vw, 14.5rem)", height: "clamp(10.5rem, 16vw, 14.5rem)" }`; the login order puts *me* last (`f()` sorts competitors so the perspective player is drawn last / waiting slot).
labels: `sim.setup.initiativeRollingStatus` "rolling" · `initiativeWaitingStatus` "waiting" · `initiativeResultStatus` "result {value}" · `initiativeDieWaitingSelf` "Your initiative die is waiting" · `initiativeDieWaitingOpponent` "Opponent initiative die is waiting".

Chooser banner (module 269913 `o`, exported `y.G`, reused by the animated stage as `s.G`), `:680-770`:
```
div[data-initiative-decision=<chooserId>] role="status"
  className="absolute left-[46%] top-[44%] z-20 w-max max-w-[88%] -translate-x-1/2 -translate-y-1/2 text-center motion-safe:animate-[initiative-decision-reveal_300ms_550ms_both]"
 └ <div className="rounded-none border border-[rgba(199,176,131,0.62)] bg-[linear-gradient(145deg,rgba(16,40,74,0.96),rgba(6,18,38,0.95))] px-[1.22rem] py-[0.52rem] shadow-[inset_0_0_0_1px_rgba(232,214,176,0.18),0_12px_28px_rgba(2,8,19,0.58)] max-sm:px-3">
    └ <div className="flex items-center gap-[0.62rem] text-[0.8rem] uppercase tracking-[0.14em] text-[#e8dcc1]"> hairline + label + hairline </div>
```
label: `chooser.id === meId ? "sim.setup.initiativeYouChoose" : "sim.setup.initiativePlayerChooses"({playerName})`.
CSS keyframes: `@keyframes initiative-decision-reveal{0%{opacity:0;margin-top:6px} …}` → `.motion-safe:animate-[…]{animation:.3s .55s both initiative-decision-reveal}`.

**Actions**
* `roll_initiative` (room action, no payload) is fired by the hook created at `35qz:38484-38499`:
  `sendRoll: (e,t) => pu(e, { type: "roll_initiative" }, { rethrowRetryableSignals: true, clientActionId: t })`; error fallback message `"Initiative roll failed. Please try again."` (`sim.initiativeRollFailed`). Sound = `ui_click` (`0xawjzm3yjpr1.js:53890-53891`).
* `roll_die` is **not** a setup action — it is an in-game dice tool: `0xawjzm3yjpr1.js:54205-54212  c5 = useCallback(e => c0({ type: "roll_die", sides: e }))`, sound `ui_click` (`:11115`).
* `choose_first_player` → `35qz:38912  bj(chooserPlayerId, { type: "choose_first_player", firstPlayerId })` (sound `ui_click`), and for single-player/goldfish
  `35qz:38930  bj(lT.id, { type: "choose_single_player_turn_order", turnOrder: "play_first" | "play_second" })`.
* Solo/solo-lab auto-advance (`35qz:38985-39000`): first-player_choice + `hf`/solo → `choose_single_player_turn_order { turnOrder: "play_first" }` (solo_lab: `choose_first_player` with own id); battlefield_pick → `chooseRandomBattlefield()`/`chooseRandomOpponentBattlefield()`; sideboarding → `submitSideboard()`/`submitBothSideboards()`; mulligan → `submitMulligan()`/`submitBothMulligans()`.

**Choose-first-player overlay** `t3` (`35qz:2105-2300`), rendered at `35qz:39985` (`variant:"players"`, only when `hi`) and `:39999` (`variant:"goldfish"`, only when `hf`):
```
section { role: "dialog", "aria-label": label, "aria-live": isGoldfish ? undefined : "polite",
          "data-testid": isGoldfish ? "single-player-turn-order-overlay" : "first-player-choice-overlay",
          className: `pointer-events-none z-45 select-none ${frameClassName}` }
├ heading band (same eN-style markup, absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2)
└ div { "data-choice-layout": "multiplayer-grid" | "self-above-opponent" | "opponent-above-self",
        className: `absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid gap-[0.92rem] max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4 ${m ? "grid-cols-2 grid-rows-2" : "grid-rows-2"}` }
   └ button { "aria-label": label, "data-player-label", "data-player-relation", "data-team-label",
              className: `pointer-events-auto relative cursor-pointer rounded-none border bg-cover bg-center px-[0.9rem] py-[0.8rem] transition-[border-color,filter,box-shadow] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-55 disabled:hover:brightness-100 ${visual.className}`,
              style: visual.style, disabled, onClick }
      ├ p className="m-0 text-center text-[1.12rem] font-semibold uppercase tracking-[0.04em] text-shadow-[0_2px_12px_rgba(0,0,0,0.78)]">{label}
      └ metadata chips (multiplayer only): div.mt-2.flex.flex-wrap.items-center.justify-center.gap-1.5.text-[0.64rem].font-semibold.uppercase.tracking-[0.1em].text-white/76
            span className="rounded-[0.18rem] border border-white/22 bg-black/24 px-1.5 py-0.5"  (playerLabel)
            span className="rounded-[0.18rem] border border-white/16 bg-black/18 px-1.5 py-0.5"  (teamLabel, optional)
            span className="rounded-[0.18rem] border border-white/16 bg-black/18 px-1.5 py-0.5"  (relationLabel)
```
Labels:
* goldfish variant: heading `sim.chooseGoldfishTurnOrder` "Choose Goldfish Turn Order"; options `sim.playFirst` **"Play First"** (green visual `t2`) and `sim.playSecond` **"Play Second"** (orange visual `t1`); backgrounds `/setup/first-player-choice-self-v2.webp` + `/setup/first-player-choice-opponent-v2.webp`.
* players variant: heading = canChoose ? `sim.chooseWhoGoesFirst` "Choose Who Goes First" : `sim.waitingFirstPlayerChoice` "Waiting for {playerName} to decide who goes first."; per-option label (2p) `sim.youStart` "You Start" / `sim.opponentStarts` "Opponent Starts", (3/4p or solo-lab) `sim.playerStarts` "{playerName} Starts".
* Visual tones: self/playFirst `border-[rgba(140,221,191,0.58)] bg-[#0d2824] text-[#defdf1] hover:border-[rgba(176,246,218,0.84)] hover:brightness-115 hover:shadow-[inset_0_0_0_1px_rgba(219,255,243,0.07),0_12px_30px_rgba(2,8,19,0.28)] focus-visible:ring-[rgba(167,239,212,0.62)]`; ally `border-[rgba(111,186,214,0.68)] bg-[#112a34] text-[#dcf7ff] …`; opponent/playSecond `border-[rgba(236,163,103,0.72)] bg-[#261714] text-[#ffe7cf] …`.
* **Hotkeys: none** (no key handlers on this overlay; only click/Enter on the buttons).

---

## 3. Battlefield pick screen (`data-setup-overlay="battlefield"`, `:3892-3955`)

```js
motion.div { "data-setup-overlay": "battlefield",
  initial:{opacity:0}, animate:{opacity:1},
  exit:{opacity:0, scale:0.992, transition:{duration:0.32, ease:[0.33,1,0.68,1]}},
  transition:{duration:0.28, ease:[0.22,1,0.36,1]}, className:`pointer-events-none z-45 select-none ${M}` }
```
Children: opponent identity strip (`phase:"battlefield"`), `eE` solo chooser (if solo setup pending), `eA` deck actions,
heading band (`opacity: +!flightActive`, `style: soloSetup||teams ? {display:"none"} : …`, label `sim.chooseBattlefield` "Choose Battlefield"),
then either `eq` (**multiplayer** contributor picker) or the 2-row duel layout:

```
<div className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] grid grid-rows-2 gap-8 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4" style={soloSetup ? {display:"none"} : undefined}>
  <div className="relative grid place-items-center" style={eg}>   <!-- opponent -->
      <div className={`${aj ? "pointer-events-auto" : "pointer-events-none"} flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]`}>
  <div className="relative grid place-items-center" style={eg} data-testid="battlefield-own-options" aria-busy={battlefieldRandomPickPending}>
      <div className="pointer-events-auto flex items-center justify-center gap-[1.1rem] max-[980px]:gap-[0.55rem]">
```
Card buttons (`motion.button`, `layout: true`, key `my-bf-{name}` / `opp-bf-{name}`), own:
```
className={`relative h-(--bf-draft-h) w-(--bf-draft-w) rounded-none border overflow-hidden shadow-[0_16px_28px_rgba(3,10,22,0.5)] ${randomSel ? "border-[rgba(174,255,223,0.92)] shadow-[0_20px_44px_rgba(3,10,22,0.62),0_0_28px_rgba(91,214,170,0.28)]" : sel ? "border-[rgba(139,222,189,0.66)]" : "border-[rgba(188,165,122,0.38)]"} ${battlefieldRandomPickPending ? "animate-pulse opacity-75" : ""} ${… ? "cursor-pointer" : "cursor-default"}`}
initial={{opacity:0,y:34,scale:0.9,rotate:0}}
animate={ flyingToBoard ? {opacity:[1,1,1], x:[0,curveX,x], y:[-24,curveY,y], rotate:0, scale:[1,min(1.08,scale+0.08),scale]} : randomSel ? {opacity:1,y:[-24,-38,-26],x:0,rotate:[0,-1.4,1.1,0],scale:[1,1.055,1.018]} : hidden ? {opacity:0,y:220,x:(index-1)*96,rotate:0,scale:0.88} : {opacity:1,y:-24,x:0,rotate:0,scale:1} }
transition={ flying ? {duration:0.58, times:[0,0.56,1], ease:[0.2,0.76,0.18,1]} : randomSel ? {duration:0.72, times:[0,0.52,1], ease:[0.2,0.76,0.18,1]} : {type:"spring", stiffness:178, damping:24} }
aria-label = cardsFaceDown ? "sim.setup.battlefieldCardBack" : blank ? "sim.setup.chooseBlankBattlefield" : "sim.setup.chooseBattlefield"({battlefieldName})
aria-pressed = selected ; presence flag `data-battlefield-random-selected={randomSel ? "true" : undefined}`
```
Random pick flash (randomSel only): two motion spans
`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(203,255,233,0.34),rgba(91,214,170,0.12)_34%,transparent_62%)] mix-blend-screen` and
`pointer-events-none absolute inset-x-[-24%] top-1/2 h-[18%] -translate-y-1/2 rotate-[-8deg] bg-[linear-gradient(90deg,transparent,rgba(226,255,241,0.48),transparent)] blur-[2px] mix-blend-screen`.
Opponent cards additionally use the 3-D flip wrapper:
```
<div className="relative h-full w-full perspective-[900px] rotate-180 origin-center">
  <div className={`relative h-full w-full transform-3d transition-transform duration-190 ease-linear will-change-transform ${faceUp ? "transform-[rotateY(180deg)]" : "transform-[rotateY(0deg)]"}`}>
    <div className="absolute inset-0 backface-hidden [-webkit-backface-visibility:hidden]"> …card back… </div>
    <div className="absolute inset-0 w-full h-full backface-hidden [-webkit-backface-visibility:hidden] transform-[rotateY(180deg)]"> …art… </div>
```
Random buttons: class `em` (`h-8 … "Random"`), labels `sim.random` / `sim.setup.chooseRandom` "Choose Random" / `sim.setup.choosing` "Choosing..." (spinner `h-3.5 w-3.5 animate-spin`), positioned
`pointer-events-auto absolute left-1/2 -translate-x-1/2` + `style={{ top: "calc(50% + (var(--bf-draft-h) / 2) + 0.85rem)" }}` (opponent one adds `setup-opponent-random-battlefield`).
`eq` multiplayer picker (`:915-1130`): root
```
<div className="absolute inset-x-[2.2rem] top-[2.2rem] bottom-[1.8rem] flex min-h-0 flex-col items-center justify-between gap-4 pt-2 pb-4 max-[980px]:inset-x-3 max-[980px]:top-[2.6rem] max-[980px]:bottom-4" data-testid="multiplayer-battlefield-picker">
  [eP roster with aria-label sim.setup.battlefieldContributorStatus]
  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
     <div className="text-center">
        <p className="m-0 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-[#e8dcc1]">{ locked ? sim.setup.battlefieldLocked : sim.setup.chooseBattlefieldOrRandom }</p>
        <p className="mt-1 mb-0 text-[0.68rem] text-text-soft">{ locked ? (n>0 ? sim.setup.waitingContributors({count}) : sim.setup.allContributorsReady) : sim.setup.chooseRegisteredBattlefield }</p>
     </fieldset data-testid="multiplayer-battlefield-options" aria-busy={randomPickPending} aria-label={sim.setup.eligibleBattlefields} className="pointer-events-auto m-0 flex min-w-0 items-center justify-center gap-3 border-0 p-0 max-[980px]:gap-1.5" style={ez}>
        buttons className={`pointer-events-auto relative h-(--mp-bf-h) w-(--mp-bf-w) overflow-hidden rounded-[0.16rem] border bg-[rgba(14,26,48,0.82)] shadow-[0_12px_24px_rgba(3,10,22,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ff6d3] ${sel ? "border-[rgba(110,215,177,0.82)] shadow-[0_14px_30px_rgba(3,10,22,0.58),0_0_22px_rgba(91,214,170,0.2)]" : locked ? "border-[rgba(110,215,177,0.24)] opacity-45" : pending ? "animate-pulse cursor-wait border-[rgba(139,222,189,0.42)] opacity-75" : canChoose ? "cursor-pointer border-[rgba(188,165,122,0.38)] hover:border-[rgba(139,222,189,0.72)]" : "cursor-default border-[rgba(188,165,122,0.3)]"}`}
     blank-battlefield overlay: span className="pointer-events-none absolute inset-x-2 bottom-2 border border-[rgba(216,198,158,0.4)] bg-[rgba(5,12,23,0.88)] px-2 py-1 text-center text-[0.55rem] font-medium uppercase tracking-[0.1em] text-[#e8dcc1]">{sim.setup.blankBattlefield}
     random button (class em, aria-label sim.setup.chooseRandomBattlefield, busy spinner)
  </div>
</div>
```
"First player does not contribute" panel (`when !meContributes`):
`max-w-xl rounded-[0.2rem] border border-[rgba(132,150,184,0.34)] bg-[linear-gradient(145deg,rgba(16,40,74,0.92),rgba(6,18,38,0.94))] px-7 py-6 text-center shadow-[inset_0_0_0_1px_rgba(232,214,176,0.1),0_16px_34px_rgba(2,8,19,0.46)]` with `sim.setup.youGoFirst` "You go first" + `sim.setup.firstPlayerBattlefieldWait`.
Action: `setup.chooseBattlefield(name)` / `chooseRandomBattlefield()` / `chooseOpponentBattlefield(name)` / `chooseRandomOpponentBattlefield()`; the wire action is `select_battlefield` (`… , { random: true }` for the random variant — `35qz:37820`), sound `card_click` (`0xawjzm3yjpr1.js:53899`), random variant sound `ui_confirm`.
Status rows for battlefield (`:2432-2460`): `sim.setup.noBattlefield` "No battlefield" (neutral) / `sim.setup.locked` "Locked" (complete) / `sim.setup.chooseOrRandom` "Choose / Random" (active) / `sim.setup.waiting` "Waiting".

## 4. Deck select / solo setup chooser

Buttons `eA` (`:1365-1453`) — top-left of the sideboarding **and** battlefield overlays:
```
<div className="pointer-events-auto absolute left-4 top-4 z-30 flex flex-wrap justify-start gap-2.5">
  <button className={ec} disabled={chooseDisabled} title={chooseDisabledReason} onClick={onChooseDeck}>{icon (module 495928 "folder-open", h-4 w-4)} <span>sim.chooseDeck "Choose Deck"</span></button>
  <button className={ec} onClick={onImportDeck}>{icon (module 796457 "upload")} <span>sim.importDeck "Import Deck"</span></button>
</div>
```
Seat tabs `eH` (`:1454-1522`) — solo-lab only, `data-setup-seat-tabs`:
```
<div data-setup-seat-tabs className="pointer-events-auto absolute right-3 top-3 z-30 flex items-center border border-[rgba(132,150,184,0.3)] bg-[rgba(7,13,23,0.9)] p-1 shadow-[0_8px_18px_rgba(3,10,22,0.4)]">
  <button aria-pressed={isActive} className={`min-w-28 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.09em] transition ${isActive ? "bg-[rgba(35,78,119,0.92)] text-[#fff0d2]" : "text-[#aebed1] hover:bg-[rgba(23,39,61,0.78)] hover:text-[#edf5ff]"}`}>
    2 seats ? (seat 0 ? sim.yourDeck "Your deck" : sim.opponent "Opponent") : `P${seat+1} · ${name}`, + (done ? ` · sim.ready "Ready"` : "")
```
Solo chooser `eE` (`:1655-1974`) + mode cards `eY` (`:1523-1654`) — shown when `roomMode === "solo_lab" && soloSetupPending`:
```
<div className="setup-solo-chooser pointer-events-auto absolute left-1/2 top-1/2 z-30 max-h-[calc(100%-6rem)] w-[min(56rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto px-1 py-2">
  <div className="mb-5 text-center">
    <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[#cbbd9e]">sim.practiceRoom "Practice room"</p>
    <h2 className="mt-1.5 text-[1.24rem] font-semibold tracking-[0.01em] text-[#f3f6fb]">sim.howDoYouWantToPlay "How do you want to play?"</h2>
  <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
    [eY index="01" tone="gold"  icon=fish(solo)  eyebrow sim.oneDeck|sim.oneRegistration  title sim.goldfish  description sim.goldfishDescription
       children: <button className={`${eu} group/button w-full border-[rgba(216,183,110,0.5)] bg-[linear-gradient(180deg,rgba(117,82,33,0.82),rgba(74,51,25,0.88))] text-[#fff2d7] shadow-[inset_0_1px_0_rgba(255,239,205,0.12),0_8px_20px_rgba(2,8,19,0.24)] hover:-translate-y-px hover:border-[rgba(247,215,151,0.82)] hover:bg-[linear-gradient(180deg,rgba(137,95,38,0.9),rgba(88,59,27,0.94))]`}>sim.startGoldfish + fast-forward icon</button>
                 <button className={`${eu} mt-3 w-full border-[rgba(216,183,110,0.24)] bg-[rgba(16,29,49,0.5)] text-[#dbc79e] hover:border-[rgba(247,215,151,0.6)] hover:text-[#fff2d7]`}>sim.skipSoloSetup</button>]
    [eY index="02" tone="cyan" icon=flask-conical eyebrow sim.twoDecks|sim.twoRegistrations title sim.twoSidedPractice description sim.twoSidedPracticeConstructedDescription
       children: grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[480px]:grid-cols-1 (sealed: grid grid-cols-1 gap-2)
         <button className={`${eu} group/button border-[rgba(116,239,255,0.46)] bg-[linear-gradient(180deg,rgba(16,94,116,0.84),rgba(9,57,77,0.9))] text-[#e4fbff] shadow-[inset_0_1px_0_rgba(220,250,255,0.12),0_8px_20px_rgba(2,8,19,0.24)] hover:-translate-y-px hover:border-[rgba(151,246,255,0.82)] hover:bg-[linear-gradient(180deg,rgba(19,111,135,0.92),rgba(11,68,89,0.96))]`}>sim.chooseOpponentDeck|sim.chooseOpponentRegistration</button>
         <button className={`${eu} border-[rgba(190,211,239,0.2)] bg-[rgba(16,29,49,0.78)] px-3 text-[#b8c9df] hover:border-[rgba(205,224,249,0.4)] hover:bg-[rgba(25,43,68,0.9)] hover:text-[#eef6ff]`} aria-label={sim.importOpponentDeck} title={sim.pasteOrImportOpponentDeck}>sim.importDeck</button>
         <button className={`${eu} w-full border-[rgba(116,239,255,0.24)] bg-[rgba(16,29,49,0.5)] text-[#a9eaf3] hover:border-[rgba(151,246,255,0.6)] hover:text-[#e4fbff]`}>sim.skipSoloSetupWithPreset</button>]
```
Mode card `eY` root (verbatim, gold/cyan branches):
```
`setup-solo-mode-card group relative isolate flex min-h-72 flex-col justify-between overflow-hidden rounded-[0.2rem] border px-6 py-6 text-left shadow-[inset_0_0_0_1px_rgba(226,237,255,0.045),0_18px_42px_rgba(2,8,19,0.46)] transition-[border-color,box-shadow] duration-150 after:pointer-events-none after:absolute after:inset-[0.16rem] after:z-0 after:rounded-[0.1rem] after:opacity-[0.18] after:content-[''] after:gb-ornament-field max-[720px]:min-h-64 max-[720px]:px-5 max-[720px]:py-5 ${gold ? "border-[rgba(216,183,110,0.4)] bg-[radial-gradient(circle_at_8%_0%,rgba(163,113,40,0.26),transparent_44%),linear-gradient(148deg,rgba(20,30,44,0.98),rgba(13,25,42,0.98)_62%,rgba(18,27,40,0.98))] hover:border-[rgba(236,203,132,0.72)] hover:shadow-[inset_0_0_0_1px_rgba(255,235,193,0.07),0_22px_50px_rgba(2,8,19,0.56),0_0_28px_rgba(166,118,40,0.1)]" : "border-[rgba(116,220,239,0.4)] bg-[radial-gradient(circle_at_8%_0%,rgba(25,154,182,0.24),transparent_44%),linear-gradient(148deg,rgba(17,32,47,0.98),rgba(13,25,42,0.98)_62%,rgba(16,29,43,0.98))] hover:border-[rgba(116,239,255,0.7)] hover:shadow-[inset_0_0_0_1px_rgba(205,249,255,0.07),0_22px_50px_rgba(2,8,19,0.56),0_0_30px_rgba(35,183,214,0.12)]"}`
```
(plus top hairline `bg-[linear-gradient(90deg,transparent,rgba(255,224,160,0.72),transparent)]`, blurred orb `-right-12 -top-16 h-52 w-52 rounded-full blur-3xl`, ghost index number `right-3 top-0 text-[5.4rem] font-black leading-none tracking-[-0.08em] opacity-[0.055]`, icon tile `grid h-18 w-18 place-items-center rounded-[0.18rem] border …`, eyebrow chip, `h3.mt-6 text-[1.45rem]`, `p.mt-2 min-h-12 text-[0.8rem]`).
Mode-card actions are props (`:1655-1974`); the parent wires them as: `onConfirmGoldfish: ae` → `confirm_solo_setup` (`35qz:38254-38262`, only `single_player` + `soloSetupPending`), `onQuickStartSolo: aa` → quick-start `"single_player"` / `"solo_lab"`; deck registration itself is `submit_deck` (`35qz:29067`, sent by the deck-editor/registration path, not by this overlay).

## 5. Sideboarding (`data-setup-overlay="sideboarding"`, `:2830-3860`)

Shell is the same motion preset, `pointer-events-none z-45 select-none ${M}`, plus:
```
"data-setup-overlay": "sideboarding",
"data-champion-selection-only": <bool aw>,
"data-has-seat-tabs": <soloLab && controllablePlayers.length > 1>,
```
Children order: opponent identity strip (`phase:"sideboarding"`), `eA` deck buttons, `eH` seat tabs (solo-lab), heading band
```
`setup-sideboard-heading absolute left-1/2 z-20 -translate-x-1/2 rounded-none border border-[rgba(199,176,131,0.62)] bg-[linear-gradient(145deg,rgba(16,40,74,0.96),rgba(6,18,38,0.95))] px-[1.22rem] py-[0.52rem] shadow-[inset_0_0_0_1px_rgba(232,214,176,0.18),0_12px_28px_rgba(2,8,19,0.58)] ${soloSetup || canSubmitSideboard ? "top-8 max-[980px]:top-6" : "top-1/2 -translate-y-1/2"}`
```
heading label = `soloSetup ? sim.soloSetup` : `canSubmitSideboard ? (championOnly ? sim.chooseChampion : sealed ? sim.goldfishFormat({format})/sim.sealed : sim.sideboarding) : waitingText`, where
`waitingText` = `sim.setup.allPlayersReadyNextStep` / `sim.bothPlayersReadySetup` / `sim.waitingForPlayerAction({player, action})` / `sim.waitingForPlayersAction({action})`, `action` = `sim.confirmChampion` | `sim.finishRegistration` | `sim.finishSideboarding`.
Body:
```
<div className="setup-sideboard-body absolute inset-x-[2.2rem] top-[5.05rem] bottom-8 max-[980px]:inset-x-3 max-[980px]:top-[4.7rem] max-[980px]:bottom-6">
  <div className="setup-sideboard-content mx-auto flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden" style={{ maxWidth: "clamp(34rem,58vw,50rem)" }}>
```
* Champion / legend / rune sections use `en` panels with `p.text-[0.72rem].uppercase.tracking-[0.14em].text-text-dim` titles (`sim.legend "Legend"`, `sim.champion "Champion"`), value `p.text-[0.9rem].text-text-main`, swap buttons `es` (`sim.swapTo "Swap to"` + card name), clear buttons `el` (`sim.clearLegend` "Clear Legend", `sim.clearChampion` "Clear Champion"), scrollable option rows `eo` with hint `ed` (`sim.setup.scrollChoices` "Scroll choices"), option aria-labels `sim.swapToCard({cardName})` / `sim.setup.selectCard({cardName})`.
* Two columns:
```
<div className="setup-sideboard-lists pointer-events-auto relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-[clamp(0.7rem,1.2vw,1rem)] overflow-hidden max-[980px]:grid-cols-1">
  <section className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)] rounded-none border border-[rgba(132,150,184,0.3)] bg-[rgba(8,14,24,0.62)]">
     header: div.flex.items-center.justify-between.border-b.border-[rgba(132,150,184,0.22)].px-3.5.py-1.5
             title: sim.registeredMainDeck|sim.mainDeck / sim.remainingPool|sim.sideboard
             count chip: `rounded-none border px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] ${ok ? "border-[rgba(110,215,177,0.4)] bg-[rgba(20,73,63,0.36)] text-[#8ff6d3]" : "border-[rgba(236,128,128,0.42)] bg-[rgba(82,28,32,0.36)] text-[#ffb3b3]"}` → `${count}/39` or `${count}/${formatTarget(24|25)}`; sideboard chip text-soft → `${count}/10`
     scroll: div ref data-testid="sideboard-main-deck-scroll" className="min-h-0 overflow-y-auto overflow-x-visible px-1.5 py-1.5" → div.grid.content-start.gap-1 (refs kept for scroll restore)
             second scroll: data-testid="sideboard-secondary-scroll"
             empty state: div.rounded-none.border.border-dashed.border-[rgba(132,150,184,0.22)].bg-[rgba(8,14,24,0.18)].px-3.py-4.text-[0.85rem].text-text-soft → sim.noSideboardCards|sim.noExtraPoolCards
```
* Row `eK` (`:1988-2164`) — one card-transfer row, button `data-setup-transfer-direction={ "main-to-secondary" | "secondary-to-main" }`:
```
S = main-to-secondary:
  "group relative grid w-full grid-cols-[2.58rem_auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-[0.18rem] border border-[rgba(132,150,184,0.18)] bg-[rgba(11,19,32,0.7)] px-2 py-[0.22rem] text-left transition hover:border-[rgba(224,194,135,0.72)] hover:bg-[rgba(18,28,45,0.9)] focus-visible:border-[rgba(224,194,135,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50"
else:
  "group relative grid w-full grid-cols-[auto_2.58rem_auto_minmax(0,1fr)] items-center gap-x-2 rounded-[0.18rem] border border-[rgba(132,150,184,0.18)] bg-[rgba(11,19,32,0.7)] px-2 py-[0.22rem] text-left transition hover:border-[rgba(140,221,191,0.58)] hover:bg-[rgba(18,28,45,0.9)] focus-visible:border-[rgba(176,246,218,0.82)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50"
children: direction chip (h-[1.32rem] w-[1.32rem] rounded-none border … chevron), count badge "x{count}"
  ("inline-flex min-w-[2.22rem] items-center justify-center rounded-none border border-[rgba(166,188,226,0.34)] bg-[rgba(23,36,59,0.96)] px-[0.26rem] py-[0.08rem] text-[0.81rem] font-bold leading-none text-[#eefcff]"),
  thumb "relative h-[1.88rem] w-[2.58rem] overflow-hidden rounded-[0.18rem] bg-[linear-gradient(180deg,rgba(24,31,48,0.86),rgba(10,14,24,0.92))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" with inner inset ring "pointer-events-none absolute inset-0 rounded-[0.18rem] shadow-[inset_0_0_0_2px_rgba(22,27,36,0.94)]",
  name p "truncate text-[0.83rem] font-semibold leading-none text-text-main [text-shadow:0_1px_1px_rgba(3,8,17,0.92)]"
```
* Footer (`data-testid="sideboarding-footer"`, `data-sideboard-skip-state=<skipState>`):
```
className="pointer-events-auto relative z-10 flex shrink-0 items-center justify-between gap-3 rounded-none border border-[rgba(132,150,184,0.24)] bg-[linear-gradient(180deg,rgba(10,18,31,0.94),rgba(7,12,22,0.98))] px-3.5 py-3 shadow-[0_-8px_18px_rgba(3,10,22,0.24)] min-[980px]:has-[[data-multiple-opponents]]:flex-wrap max-[980px]:flex-col max-[980px]:items-stretch"
  status: div[data-setup-sideboard-status][data-has-status] className="flex min-h-6 min-w-0 flex-1 items-center gap-3 min-[980px]:has-[[data-multiple-opponents]]:basis-auto max-[980px]:flex-col max-[980px]:items-stretch"
          validation message p: div.text-[0.82rem].text-[#ffd8c8]
          sealed rune chip: sim.runesFixed({count}) "Runes Fixed {count}/12"
          readiness strip eP aria-label sim.setup.sideboardReadiness, testId "sideboard-readiness-strip" (multiplayer)
          solo chip: `inline-flex items-center rounded-none border px-2 py-1 text-[0.7rem] uppercase tracking-[0.08em] …` → sim.bothDecksReady "Both decks ready" / sim.lockedDecksCount({locked,total}) / sim.reviewBothTabsLockTogether
          duel chip: sim.playerReady({player}) / sim.waitingForPlayer({player})
  actions: div data-testid="sideboarding-footer-actions" className="flex shrink-0 items-center gap-2 self-end min-[980px]:ml-auto max-[980px]:self-stretch max-[720px]:flex-col"
          [SideboardingLeaveButton (multiplayer only)]
          [skip-sideboarding button class `ep`] → sim.skipSideboarding|sim.skipBothSideboards|sim.skipAllSideboards
          [skip-request cluster] request-sideboard-skip (ep) / accept-sideboard-skip-request (eb, sim.acceptSideboardSkip "Accept Skip") / declined status / waiting status (eb or ep) / cancel-sideboard-skip-request (small ghost) / decline-sideboard-skip-request
          [popover e$ data-testid="sideboard-skip-popover" data-sideboard-skip-popover-kind="requester"|"responder" (auto-dismisses via `ei.l` = 3000 ms timer)]
          [lock-in button data-testid="lock-in-sideboard"]:
            className="min-w-56 rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] px-4 py-2 text-[0.8rem] uppercase tracking-widest text-[#fff0d2] shadow-[inset_0_0_0_1px_rgba(246,223,176,0.16),0_8px_18px_rgba(3,10,22,0.45)] transition-[transform,box-shadow,border-color,background] duration-140 hover:-translate-y-px hover:border-[rgba(243,214,157,0.96)] hover:bg-[linear-gradient(180deg,rgba(42,93,144,1),rgba(12,39,77,1))] hover:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.26),0_10px_22px_rgba(3,10,22,0.5)] active:translate-y-0 active:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.18),0_6px_14px_rgba(3,10,22,0.42)] disabled:cursor-default disabled:opacity-50 disabled:transform-none max-[720px]:w-full"
            disabled = isBusy || (soloLab ? bothDone : mySideboardDone) || sideboardSubmitting || !!validationMessage
            label: championOnly? (locked? sim.championLockedIn : sim.confirmChampion) : submittingVisible? (solo? sim.savingBothDecks : sealed? sim.savingRegistration : sim.savingSideboard) : solo? (bothReady? sim.bothDecksLockedIn : sim.lockInBothDecks) : (done? (sealed? sim.registrationLockedIn : sim.sideboardLockedIn) : (sealed? sim.lockInRegistration : sim.lockInSideboard))
```
* `SideboardingLeaveButton` `ew` (`:330-423`) — `data-testid="sideboarding-leave-game"`, `aria-haspopup="dialog"`, `aria-expanded`, class
  `pointer-events-auto rounded-none border border-[rgba(215,133,142,0.4)] bg-[rgba(72,30,38,0.58)] px-3 py-2 text-[0.76rem] font-semibold uppercase tracking-widest text-[#f1dadd] hover:bg-[rgba(92,37,46,0.72)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e1a1aa] max-[720px]:w-full`, label `sim.leaveGame` "Leave Game"; wrapper `pointer-events-auto relative max-[720px]:w-full`; opens shared confirm dialog `O.T` with `canReturnToLobby:false, concession, portalLayer:"overlay"`; outside-click close checks `[data-action-confirm-popover="leave"]`.
* Actions: `submit_sideboard`, `request_sideboard_skip`, `respond_sideboard_skip("accept"|"decline"|"cancel")` (the solo path issues two `submit_sideboard` actions / client-side `submitBothSideboards`); sounds `ui_confirm`; `data-sideboard-skip-state` values from `resolveSideboardSkipControlState` (`:307-329`): `"hidden" | "immediate" | "request" | "requester_waiting" | "recipient_pending" | "recipient_accepted_waiting" | "declined"`.
* `formatSetupOverlayValidationMessage` (`:299-306`): strips a leading `"<playerName>: "` prefix (using `name + ": "` or `"："` for zh), localizes via module 642126/849650.

---

## 6. Component inventory (every module-level function in `2atnqtfqvj-z4.js`)

| minified | lines | JSX-returning | descriptive name | purpose |
|---|---|---|---|---|
| `J` | 176-201 | (render-prop) | **CardArtReadinessGate** | Provider: collects `onCardReady(id)`, exposes `{ready, onCardReady}` to a children function |
| `Z` | 202-204 | – | `emptyReadySet` | `() => new Set()` memo factory |
| `ee` | 205-284 | ✔ 2 | **MulliganArtLoadingStatus** | `span[role=status][data-testid=mulligan-art-loading]` spinner + "Loading your hand…" after 250 ms |
| `eh` | 285-287 | – | `toMainDeckEntry` | `{...card, source:"mainDeck", exhausted:false, createdAt:0}` |
| `ey` | 288-293 | – | `lockMinHeight` | converts element height → `style.minHeight` (scroll-anchor stabiliser) |
| `ev` | 294-298 | – | `resolveBattlefieldName` | card name, or `Private battlefield N` i18n |
| `e_` | 299-306 | – | **formatSetupOverlayValidationMessage** (exported) | strips "Player: " prefix + localizes validation text |
| `ej` | 307-329 | – | **resolveSideboardSkipControlState** (exported) | returns skip-control state key from room/format/request |
| `ew` | 330-423 | ✔ 3 | **SideboardingLeaveButton** (exported) | leave-game button + concession confirm popover |
| `ek` | 424-426 | – | `notBusy` | `!e` predicate |
| `eN` | 427-484 | ✔ 4 | **SetupOverlayHeading** | gold-haired framed label used by all setup screens |
| `eM` | 485-489 | – | `playerRowAriaLabel` | joins label/name/team/relation/status for aria |
| `eD` | 490-512 | ✔ 1 | **SetupStatusIcon** | 3-unit icon coloured by tone (complete/active/neutral/waiting) |
| `eP` | 513-690 | ✔ 15 | **SetupRosterStatusStrip** | `role=status` roster strip, `compact` (grid + details tooltips) / `comfortable` (chips) |
| `eB` | 691-731 | ✔ 7 | **SetupRosterChip** | one comfortable-density player chip |
| `eR` | 732-734 | – | `countCompleteRows` | reduce helper for ready-count |
| `e$` | 735-786 | ✔ 2 | **SideboardSkipPopover** | anchored popover `[data-testid=sideboard-skip-popover]`, 3 s auto-dismiss |
| `eI` | 787-807 | ✔ 1 | **SideboardSkipPlayerStatusList** | `[data-testid=sideboard-skip-player-status-list]` list |
| `eL` | 808-856 | ✔ 6 | **SideboardSkipPlayerStatusRow** | one accept/decline/pending row |
| `eO` | 857-914 | ✔ 3 | **BattlefieldCardBack** | sleeve-aware landscape card back (+90° rotation when sleeved) |
| `eq` | 915-1130 | ✔ 19 | **MultiplayerBattlefieldPicker** | `[data-testid=multiplayer-battlefield-picker]` + contributor picker + random button |
| `eF` | 1131-1133 | – | `isContributorPending` | tone ∈ {active, waiting} |
| `eT` | 1134-1364 | ✔ 15 | **MultiplayerMulliganPicker** | `[data-testid=multiplayer-mulligan-picker]`, own row + lock-status |
| `eA` | 1365-1453 | ✔ 7 | **SetupDeckActions** | top-left "Choose Deck" / "Import Deck" buttons (`ec`) |
| `eH` | 1454-1522 | ✔ 2 | **SetupSeatTabs** | `[data-setup-seat-tabs]` solo seat switcher |
| `eY` | 1523-1654 | ✔ 11 | **SoloSetupModeCard** | `.setup-solo-mode-card` gold/cyan card with ornament overlay |
| `eE` | 1655-1974 | ✔ 22 | **SoloSetupChooser** | `.setup-solo-chooser` two-mode practice-room chooser |
| `eW` | 1975-1977 | – | `mulliganCardImageUrl` | `(0, r.Y)(card)` image URL |
| `eG` | 1978-1987 | – | `entryDisplayName` | name + cardCode display via module 607273 |
| `eK` | 1988-2164 | ✔ 10 | **SideboardTransferRow** | one `[data-setup-transfer-direction]` card row |
| `eV`,`eU`,`eX`,`eQ`,`eJ`,`eZ`,`e0`,`e1`,`e2`,`e8`,`e4`,`e3`,`e5`,`e6`,`e9`,`e7` | 2165-2210 | – | key/reduce helpers | `id`, `cardCode ?? name`, `source-key`, truthy, count reducers, joiners |
| *(anonymous)* | 2217-5274 | ✔ 173 | **SetupFlowOverlays** (exported) | the entire setup overlay tree (mulligan / battlefield / sideboarding / solo / deck actions) |

Only two names are exported: `e.s(["SetupFlowOverlays",0,fn, "SideboardingLeaveButton",0,ew, "formatSetupOverlayValidationMessage",0,e_, "resolveSideboardSkipControlState",0,ej], 703180)` (`:2213-2224`, `:5275-5284`).

Icon/inline components created in this chunk (`:20-153`): `u.f({name:"fast-forward"})` → `x`, `{name:"fish"}` → `h`, `{name:"flask-conical"}` → `v`, `{name:"pencil-line"}` → `k`, `{name:"shuffle"}` → `S` (used as the random/spinner icon), `{name:"wifi-off"}` → `D`.

---

## 7. English i18n strings used by this flow (from the flight catalogue in `site/playapp/playroot.html`)

| key | value |
|---|---|
| sim.mulligan | "Mulligan" |
| sim.mulliganCount | "Mulligan {count}" |
| sim.keepHand | "Keep Hand" |
| sim.setup.mulliganCount | "Mulligan {count}" |
| sim.setup.keepHand | "Keep Hand" |
| sim.setup.lockedIn | "Locked In" |
| sim.setup.mulliganLockStatus | "Mulligan lock status" |
| sim.setup.loadingHand | "Loading your hand…" |
| sim.setup.turnRank | "{rank}st/nd/rd/th" |
| sim.setup.handCardBack / sim.opponentHandCardBack | "Hand card back" / "Opponent hand card back" |
| sim.setup.chooseBattlefield | "Choose {battlefieldName}" |
| sim.setup.chooseRandomBattlefield | "Choose your random battlefield" |
| sim.setup.chooseRandom | "Choose Random" |
| sim.setup.choosing | "Choosing..." |
| sim.setup.blankBattlefield | "Blank Battlefield" |
| sim.setup.battlefieldCardBack / opponentBattlefieldCardBack | "Battlefield card back" / "Opponent battlefield card back" |
| sim.setup.privateBattlefield | "Private battlefield {number}" |
| sim.setup.youGoFirst | "You go first" |
| sim.setup.firstPlayerBattlefieldWait | "The first player does not contribute a battlefield in this mode. Waiting for the other battlefield contributors to lock their choices." |
| sim.setup.initiativeYouChoose / initiativePlayerChooses | "You choose who goes first" / "{playerName} chooses who goes first" |
| sim.chooseWhoGoesFirst / waitingFirstPlayerChoice | "Choose Who Goes First" / "Waiting for {playerName} to decide who goes first." |
| sim.playFirst / playSecond | "Play First" / "Play Second" |
| sim.youStart / opponentStarts / playerStarts | "You Start" / "Opponent Starts" / "{playerName} Starts" |
| sim.chooseGoldfishTurnOrder | "Choose Goldfish Turn Order" |
| sim.initiativeRollFailed / initiativeWinner | "Initiative roll failed. Please try again." / "initiative winner" |
| sim.sideboarding / sim.sideboard / sim.mainDeck / sim.remainingPool / sim.registeredMainDeck | "Sideboarding" / "Sideboard" / "Main Deck" / "Remaining Pool" / "Registered Main Deck" |
| sim.requestSkipSideboarding / skipSideboarding / skipBothSideboards / skipAllSideboards | "Skip card swaps" / "Skip Sideboarding" / "Skip Both Sideboards" / "Skip All Sideboards" |
| sim.acceptSideboardSkip / declineSkipRequest / cancelSkipRequest / sideboardSkipDeclined | "Accept Skip" / "Decline" / "Cancel Request" / "Skip Declined" |
| sim.lockInSideboard / lockInBothDecks / lockInRegistration / lockInBothMulligan / lockInBothKeep | "Lock In Sideboard" / "Lock In Both Decks" / "Lock In Registration" / "Lock In Both · Mulligan {count}" / "Lock In Both · Keep both" |
| sim.bothLockedIn / bothDecksLockedIn / bothDecksReady / lockedDecksCount | "Both Locked In" / "Both Decks Locked In" / "Both decks ready" / "{locked} of {total} decks locked" |
| sim.soloSetup / practiceRoom / howDoYouWantToPlay / goldfish / startGoldfish / skipSoloSetup / skipSoloSetupWithPreset | "Solo Setup" / "Practice room" / "How do you want to play?" / "Goldfish" / "Start Goldfish" / "Skip setup" / "Skip setup with preset deck" |
| sim.chooseDeck / importDeck / importOpponentDeck / pasteOrImportOpponentDeck | "Choose Deck" / "Import Deck" / "Import opponent deck" / "Paste or import an opponent deck" |
| sim.you / opponent / ready / yourDeck | "You" / "Opponent" / "Ready" / "Your deck" |
| sim.leagueStyle helpers | n/a |

---

## 8. Open questions / gaps

1. **No keyboard shortcuts** could be found for the mulligan screen, the dice screen, or the first-player choice
   (grepped `onKeyDown|keydown|aria-keyshortcuts|hotkey|Key[A-Z]` in `2atnqtfqvj-z4.js`, `0xawjzm3yjpr1.js`, `35qz5rkx7yexy.js`, `03azfb7rltdws.js` → only Escape/dialog handlers). Runtime capture should confirm.
2. `choose_first_player` **option buttons are the `t3` overlay** — the dice screen itself only *announces* the chooser. It is unclear whether the animated dice chunk adds extra choosing UI on top of `s.G`; it renders the same `data-initiative-layout` container and the same `s.G` banner, so no.
3. `mulliganPlaybackByPlayerId` internals (`draws[].handCountBeforeDraw`, `hiddenRuneCardIds`) can only be observed at runtime; the server payload shape was not found statically (client writes an optimistic copy at `35qz:37839-37855`).
4. The exact 3-D dice visuals (canvas, camera, die faces) are in the lazy chunk `3vkoknf821dno.js` (module 157661) — deliberately not analysed; only its shell (`data-initiative-layout`, `z-96`, `z-95`) is documented above.
5. `er.M` / `er.h` (module 6717) use **CSS-module** classes (`m.default.layer|strip|litCard|plate|plateLabel|mini|inlineStrip`) whose hashed names live in the CSS chunks — mapping them to readable selectors would need a CSS-chunk pass.
6. Font-family of the die digit is literal `"Georgia, serif"` inline (not a self-hosted font).
