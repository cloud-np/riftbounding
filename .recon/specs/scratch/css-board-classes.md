# Riftbound simulator — custom board/UI CSS classes (verbatim)

Extracted from the six playapp CSS chunks:
`.recon/site/playapp/dl/_next/static/immutable/chunks/*.css`
(pretty source copies at `/tmp/opencode/css/*.pretty.css`).

Method: every rule whose selector contains a custom (non-Tailwind-utility) class token matching a
class family below, or a `data-*` attribute named for a family (`[data-card-...]`, `[data-touch-...]`, …).
Pure Tailwind utilities (`.mt-2`, `.bg-[…]`, `.sm:…`, `.--tw-*` plumbing, arbitrary-value utilities) are excluded.

Filing convention — a rule appears exactly once, chosen in this order:
1. family found after stripping a layout prefix (`.gb-playmat-x` → `playmat`, `.tablet-chain-panel` → `chain`);
2. family at class-name start (`.touch-card-preview` → `touch-`);
3. generic `.gb-*` rules scoped by a family `data-*` attribute → that attribute family
   (`.gb-board[data-card-label-stack]` → `card-`; attribute values count, e.g. `[data-player-area=runeDeck]` → `rune`);
4. attribute-only selectors (no class tokens) → attribute family (`[data-touch-layout=true]>[data-player-area=runeDeck]` → `touch-`).

The `phone-portrait` board arrangement is a cross-cutting dimension: 139 rules contain
`[data-board-arrangement=phone-portrait]` and are spread over their component families
(`tablet-` 54, `sidebar` 32, `identity` 10, `time-warp` 8, `hand` 6, `phone-` 6, `touch-` 5, `rune` 4,
`battlefield` 4, `score` 3, `chain` 3, `playmat` 2) — search the file for `phone-portrait` to list them all.
`@layer` / `@media` / `@supports` context is printed as a `/* … */` line above each rule. Values are verbatim.

Rule counts per family:

| family | rules | | family | rules |
|---|---|---|---|---|
| `playmat` | 28 | | `score` | 52 |
| `battlefield` | 38 | | `identity` | 115 |
| `showdown` | 7 | | `turn` | 5 |
| `time-warp` | 56 | | `log` | 0 |
| `expected-action-button` | 12 | | `chat` | 3 |
| `game-selection` | 13 | | `emote` | 0 |
| `mulligan` | 0 | | `die` | 0 |
| `touch-` | 163 | | `dice` | 0 |
| `banish` | 24 | | `card-` | 132 |
| `chain` | 56 | | `hand` | 45 |
| `sidebar` | 75 | | `pile` | 0 |
| `tablet-` | 97 | | `rune` | 14 |
| `phone-` | 13 | | `ping` | 0 |
| `sim-` | 6 | | `gb-` | 104 |

Total: **1058** rules, plus 100 rules in hashed support modules (end of file).

Notes on families with zero matches (checked against all six chunks):
- `mulligan`, `die`, `dice`, `emote` — no such class or attribute tokens exist in the compiled CSS at all.
- `ping` — the ping animation is driven by CSS vars (`--gb-ping-opacity-*`, `--gb-ping-scale-*`) and the
  `gbPingFlash/Pulse/InnerPulse/CornerPulse` keyframes; no `.gb-ping-*`/`.ping-*` class rules exist.
- `pile` — only `[data-pile-counter]` / `[data-pile-count-placement]` attribute-scoped rules, which are filed
  under the layout family of their enclosing `.gb-board[...]` selector (see `phone-`, `tablet-`, `gb-`).
- `log` — only `.tablet-log-panel`, and always inside combined selectors such as `.tablet-log-panel,.tablet-chat-panel`
  (filed under `chat`); no standalone log rules.
- `turn` — `.gb-turn-glass` and `[data-board-turn-controls]` rules only (see section).

---

## playmat

**28 rules**

### 1sj2l8ggay34g.css

```css
.gb-playmat-fissure-fill {
  opacity:0;
  transform:translateY(-150px);
}

.gb-playmat-fissure-fill[data-firing=true] {
  animation:.64s linear gb-playmat-fissure-fill;
}

/* @media (prefers-reduced-motion:reduce) */
.gb-playmat-fissure-fill,.gb-playmat-fissure-fill[data-firing=true] {
  animation:none;
  display:none;
}

.gb-playmat-zone-glass:after,.gb-playmat-zone-ornament:after {
  opacity:.96;
  filter:drop-shadow(0 1px 1px #000000e6)drop-shadow(0 0 3px #e1efff47)drop-shadow(0 0 8px #0309148f);
}

.gb-playmat-zone-header {
  z-index:2;
  padding:.02rem .08rem .02rem .14rem;
  position:relative;
}

.gb-playmat-zone-header h4 {
  color:#edf6ff;
  text-shadow:0 1px 1px #000000d6,0 0 7px #0000007a;
}

.gb-playmat-zone-header span {
  color:#eef7ff;
  text-shadow:0 1px 1px #000000e0,0 0 7px #00000080;
}

.gb-playmat-zone-count {
  text-align:center;
  background:linear-gradient(#ebf6ff21,#ebf6ff0a),#040a1457;
  border:1px solid #e6f1ff2e;
  border-radius:.16rem;
  min-width:1.32rem;
  padding:.04rem .2rem;
  box-shadow:inset 0 1px #ffffff1f,0 2px 8px #00000038;
}

.gb-playmat-zone-count-chip {
  background:linear-gradient(#ebf6ff26,#ebf6ff0d),#050c186b;
  border-color:#e6f1ff3d;
  box-shadow:inset 0 1px #ffffff24,inset 0 0 0 1px #ffffff0a,0 5px 14px #00000047;
}

.gb-playmat-zone-hidden-chrome:before,.gb-playmat-zone-hidden-chrome:after {
  opacity:0!important;
}

.gb-playmat-zone-frosted:before,.gb-playmat-resources-frosted>[data-resources-content]:before,[data-touch-layout=true] .gb-playmat-resources-frosted:before,.gb-playmat-battlefield-frost {
  --frost:var(--play-zone-frost,.3);
  --frost-curve:calc(var(--frost) * var(--frost));
  --pane-tone:brightness(1);
  content:"";
  z-index:0;
  -webkit-backdrop-filter:var(--liquid-lens,) blur(calc(var(--frost-curve) * 16px)) saturate(1.25) var(--pane-tone);
  backdrop-filter:var(--liquid-lens,) blur(calc(var(--frost-curve) * 16px)) saturate(1.25) var(--pane-tone);
  pointer-events:none;
  position:absolute;
  box-shadow:inset 0 1px 1px #ffffff4d,inset 0 -1px 2px #0000002e,inset 0 0 18px #ffffff12,0 6px 16px #0003;
}

.gb-playmat-zone-frosted:before {
  border-radius:.5rem;
  inset:.06rem .08rem .06rem .06rem;
}

.gb-playmat-zone-frosted[data-glass-mirrored]:before,.gb-playmat-battlefield-frost[data-glass-mirrored] {
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
}

.gb-playmat-zone-frosted[data-zone-owner=self]:before,.gb-playmat-battlefield-frost-bottom {
  --glass-intensity:var(--self-glass-intensity,1);
  opacity:var(--glass-intensity);
}

.gb-playmat-zone-frosted[data-zone-owner=opponent]:before,.gb-playmat-battlefield-frost-top {
  --glass-intensity:var(--opponent-glass-intensity,1);
  opacity:var(--glass-intensity);
}

.gb-playmat-zone-frosted.gb-playmat-zone-hidden-chrome:before {
  opacity:var(--glass-intensity,1)!important;
}

/* @media (prefers-reduced-transparency:reduce) */
.gb-playmat-zone-frosted:before,.gb-playmat-zone-frosted.gb-playmat-zone-hidden-chrome:before,.gb-playmat-resources-frosted>[data-resources-content]:before,[data-touch-layout=true] .gb-playmat-resources-frosted:before,.gb-playmat-battlefield-frost {
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
  background:#080f1cd1;
  opacity:1!important;
}

.gb-playmat-resources-frosted>[data-resources-content],[data-touch-layout=true] .gb-playmat-resources-frosted {
  isolation:isolate;
  position:relative;
}

.gb-playmat-resources-frosted:before {
  content:none;
}

[data-player-layer=self] .gb-playmat-resources-frosted {
  --glass-intensity:var(--self-glass-intensity,1);
}

[data-player-layer=opponent] .gb-playmat-resources-frosted {
  --glass-intensity:var(--opponent-glass-intensity,1);
}

.gb-playmat-resources-frosted>[data-resources-content]:before,[data-touch-layout=true] .gb-playmat-resources-frosted:before {
  --pane-tint:calc(.2 + var(--frost) * .25);
  --pane-tone:brightness(.7);
  background:rgb(8 15 28/var(--pane-tint));
  content:"";
  z-index:-1;
  opacity:var(--glass-intensity,1);
  border-radius:.16rem;
  inset:-.18rem -.3rem;
  box-shadow:0 4px 12px #00000029;
}

.gb-playmat-resources-frosted span {
  text-shadow:0 1px 2px #02060ebf;
}

.gb-playmat-battlefield-frost-top {
  border-radius:.5rem .5rem .2rem .2rem;
  inset:0 0 50%;
}

.gb-playmat-battlefield-frost-bottom {
  border-radius:.2rem .2rem .5rem .5rem;
  inset:50% 0 0;
}

.gb-board[data-tablet-compact=true] [data-board-play-area]>[data-board-playmat] {
  right:calc(.18rem - var(--compact-sidebar-width));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-play-area]>[data-board-playmat] {
  right:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-play-area]>[data-board-playmat-side=self] {
  bottom:calc(.18rem - var(--phone-toolbar-height));
  border-bottom-right-radius:.8rem;
  border-bottom-left-radius:.8rem;
}
```

## battlefield

**38 rules**

### 1sj2l8ggay34g.css

```css
.gb-battlefield-hide-top-chrome,.gb-battlefield-hide-bottom-chrome {
  border-color:#0000!important;
}

.gb-battlefield-hide-top-chrome:after {
  -webkit-mask:linear-gradient(#000 0 0) bottom/100% 50% no-repeat!important;
  mask:linear-gradient(#000 0 0) bottom/100% 50% no-repeat!important;
}

.gb-battlefield-hide-bottom-chrome:after {
  -webkit-mask:linear-gradient(#000 0 0) top/100% 50% no-repeat!important;
  mask:linear-gradient(#000 0 0) top/100% 50% no-repeat!important;
}

.gb-battlefield-hide-top-chrome.gb-battlefield-hide-bottom-chrome:after {
  opacity:0!important;
}

.gb-board-layer.gb-battlefield-hide-top-chrome {
  --frame-top:none;
}

.gb-board-layer.gb-battlefield-hide-bottom-chrome {
  --frame-bottom:none;
}

.gb-board[data-tablet-layout=true] [data-battlefield-surface] {
  transition:none;
}

.battlefield-border-line {
  border-width:inherit;
  border-style:inherit;
  border-color:inherit;
  border-radius:inherit;
  pointer-events:none;
  --might-mask-outset:1px;
  position:absolute;
  inset:-1px;
}

.battlefield-border-line,.gb-board-layer[data-might-border][data-lines-frame]:before,.gb-board-layer[data-might-border]:after {
  -webkit-mask-image:var(--frame-alpha,linear-gradient(#000 0 0)), linear-gradient(#000 0 0), linear-gradient(#000 0 0);
  -webkit-mask-image:var(--frame-alpha,linear-gradient(#000 0 0)), linear-gradient(#000 0 0), linear-gradient(#000 0 0);
  -webkit-mask-image:var(--frame-alpha,linear-gradient(#000 0 0)), linear-gradient(#000 0 0), linear-gradient(#000 0 0);
  mask-image:var(--frame-alpha,linear-gradient(#000 0 0)), linear-gradient(#000 0 0), linear-gradient(#000 0 0);
  -webkit-mask-size:100% 100%, var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-size:100% 100%, var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-size:100% 100%, var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  mask-size:100% 100%, var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-position:0 0, right calc(1.25rem + var(--might-mask-outset)) top -4px, right calc(1.25rem + var(--might-mask-outset)) bottom -4px;
  -webkit-mask-position:0 0, right calc(1.25rem + var(--might-mask-outset)) top -4px, right calc(1.25rem + var(--might-mask-outset)) bottom -4px;
  -webkit-mask-position:0 0, right calc(1.25rem + var(--might-mask-outset)) top -4px, right calc(1.25rem + var(--might-mask-outset)) bottom -4px;
  mask-position:0 0, right calc(1.25rem + var(--might-mask-outset)) top -4px, right calc(1.25rem + var(--might-mask-outset)) bottom -4px;
  -webkit-mask-composite:source-out,source-over;
  -webkit-mask-composite:source-out,source-over;
  -webkit-mask-repeat:no-repeat;
  mask-repeat:no-repeat;
  -webkit-mask-composite:source-out,source-over;
  mask-composite:subtract,add;
}

.battlefield-might,.battlefield-might-anchor {
  color:#d7e4f4;
  text-shadow:0 1px 2px #071321,0 0 5px #07132180;
  font-variant-numeric:tabular-nums;
  pointer-events:none;
  background:0 0;
  border:0;
  border-radius:3px;
  justify-content:center;
  align-items:center;
  gap:4px;
  min-width:38px;
  height:20px;
  padding:0 6px;
  font-size:11px;
  font-weight:650;
  line-height:1;
  display:inline-flex;
}

.battlefield-might {
  isolation:isolate;
}

.battlefield-might-surface {
  z-index:-1;
  border-radius:inherit;
  position:absolute;
  inset:0;
  overflow:hidden;
}

.battlefield-might-surface:before {
  content:"";
  border-radius:inherit;
  position:absolute;
  inset:0;
}

.battlefield-might[data-might-glass] .battlefield-might-surface {
  background:linear-gradient(155deg,#e8f6ff33,#b2d1f60a 48%,#060f1c33);
  box-shadow:inset 0 1px #ffffff6b,inset 1px 0 #eaf7ff26,inset -1px 0 #eaf7ff1a,inset 0 -1px #0208124d,0 2px 5px #02081229;
}

.battlefield-might[data-might-glass] .battlefield-might-surface:before {
  --frost:var(--play-zone-frost,.3);
  -webkit-backdrop-filter:var(--liquid-lens,) blur(calc(var(--frost) * var(--frost) * 12px)) saturate(1.25);
  backdrop-filter:var(--liquid-lens,) blur(calc(var(--frost) * var(--frost) * 12px)) saturate(1.25);
}

[data-battlefield-might-frame],[data-battlefield-might-side] {
  border-color:inherit;
}

[data-battlefield-might-side]:not(:empty):before,[data-battlefield-might-side]:not(:empty):after {
  content:"";
  border-color:inherit;
  border-style:solid;
  border-width:0 0 0 1px;
  width:1px;
  height:12px;
  position:absolute;
  top:50%;
  translate:0 -50%;
}

[data-battlefield-might-side]:before {
  left:-1px;
}

[data-battlefield-might-side]:after {
  right:-1px;
}

.gb-board-layer[data-top-board-lines]:not([data-state-border]) [data-battlefield-might-side=opponent]:before,.gb-board-layer[data-top-board-lines]:not([data-state-border]) [data-battlefield-might-side=opponent]:after,.gb-board-layer[data-bottom-board-lines]:not([data-state-border]) [data-battlefield-might-side=self]:before,.gb-board-layer[data-bottom-board-lines]:not([data-state-border]) [data-battlefield-might-side=self]:after {
  width:var(--lines-edge,.5rem);
  background:var(--side-edge-vertical) center / 100% 100% no-repeat;
  height:1rem;
  opacity:var(--side-alpha);
  border:0;
}

.gb-board-layer[data-top-board-lines] [data-battlefield-might-side=opponent] {
  --side-edge-vertical:var(--top-edge-vertical);
  --side-alpha:var(--top-alpha);
}

.gb-board-layer[data-bottom-board-lines] [data-battlefield-might-side=self] {
  --side-edge-vertical:var(--bottom-edge-vertical);
  --side-alpha:var(--bottom-alpha);
}

.gb-board-layer[data-top-board-lines]:not([data-state-border]) [data-battlefield-might-side=opponent]:before,.gb-board-layer[data-bottom-board-lines]:not([data-state-border]) [data-battlefield-might-side=self]:before {
  left:calc(var(--lines-edge,.5rem) / -2);
}

.gb-board-layer[data-top-board-lines]:not([data-state-border]) [data-battlefield-might-side=opponent]:after,.gb-board-layer[data-bottom-board-lines]:not([data-state-border]) [data-battlefield-might-side=self]:after {
  right:calc(var(--lines-edge,.5rem) / -2);
}

.battlefield-might-glint {
  background:linear-gradient(110deg,#0000 25%,#e8f5ff40 48%,#0000 70%);
  position:absolute;
  inset:0;
}

.battlefield-might-number {
  perspective:90px;
  text-align:center;
  align-items:center;
  min-width:2ch;
  height:16px;
  display:inline-grid;
  overflow:hidden;
}

.battlefield-might-number>span {
  backface-visibility:hidden;
  grid-area:1/1;
}

.battlefield-might img {
  opacity:.86;
  width:11px;
  height:11px;
}

/* @media (prefers-reduced-transparency:reduce) */
.battlefield-might[data-might-glass] .battlefield-might-surface {
  background:#17283f;
}

/* @media (prefers-reduced-transparency:reduce) */
.battlefield-might[data-might-glass] .battlefield-might-surface:before {
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
}

[data-battlefield-card-rows] {
  --battlefield-card-edge-shift:calc((var(--card-height) - var(--card-width)) / 2);
}

.gb-board[data-tablet-layout=true][data-board-short=true][data-board-arrangement=standard] [data-battlefield-card-rows] {
  padding-block:0;
}

.gb-board[data-tablet-layout=true][data-board-density=narrow] [data-battlefield-surface] {
  --tablet-battlefield-columns:repeat(2, minmax(0, 1fr));
  grid-auto-rows:minmax(0,1fr);
  row-gap:.5rem;
}

.gb-board[data-tablet-layout=true][data-board-density=narrow] [data-battlefield-visible=false] {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=leftLanes],.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-battlefield-surface] {
  --card-width:var(--placed-card-width);
  --card-height:var(--placed-card-height);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-battlefield-surface] {
  column-gap:.5rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-battlefield-surface-slot=own] [data-battlefield-marker] {
  left:29%;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-battlefield-surface-slot=opponent] [data-battlefield-marker] {
  left:71%;
}
```

## showdown

**7 rules**

### 1sj2l8ggay34g.css

```css
.gb-board[data-tablet-layout=false] [data-showdown-popup-anchor] {
  scale:var(--desktop-ui-scale,1);
  transform-origin:100%;
}

.gb-board[data-tablet-layout=true] [data-showdown-popup-anchor] {
  grid-template-columns:2.25rem minmax(0,1fr);
  width:12.3rem;
}

.gb-board[data-tablet-layout=true] [data-showdown-popup-anchor=multiplayer] {
  grid-template-columns:minmax(0,1fr);
}

.gb-board[data-tablet-layout=true] [data-showdown-popup-anchor] [data-showdown-dismiss] {
  width:2.25rem;
  height:2.25rem;
}

.gb-board[data-tablet-layout=true] [data-showdown-popup-anchor] [data-showdown-dismiss] svg {
  width:.95rem;
  height:.95rem;
}

.gb-board-layer[data-might-border]>:is([data-showdown-aura],[data-showdown-aura-frame]) {
  -webkit-mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0),linear-gradient(#000 0 0);
  mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0),linear-gradient(#000 0 0);
  -webkit-mask-clip:no-clip;
  mask-clip:no-clip;
  -webkit-mask-size:calc(100% + 48px) calc(100% + 48px), var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-size:calc(100% + 48px) calc(100% + 48px), var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-size:calc(100% + 48px) calc(100% + 48px), var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  mask-size:calc(100% + 48px) calc(100% + 48px), var(--might-opponent-gap,0px) 30px, var(--might-self-gap,0px) 30px;
  -webkit-mask-composite:source-out,source-over;
  -webkit-mask-composite:source-out,source-over;
  -webkit-mask-position:-24px -24px,right 1.25rem top -15px,right 1.25rem bottom -15px;
  mask-position:-24px -24px,right 1.25rem top -15px,right 1.25rem bottom -15px;
  -webkit-mask-repeat:no-repeat;
  mask-repeat:no-repeat;
  -webkit-mask-composite:source-out,source-over;
  mask-composite:subtract,add;
}

.gb-board[data-tablet-layout=true][data-board-density=narrow] [data-showdown-popup-anchor] {
  max-width:calc(100% - .5rem);
  left:auto;
  right:.25rem;
}
```

## time-warp

**56 rules**

### 1sj2l8ggay34g.css

```css
.time-warp-action {
  isolation:isolate;
  color:#d9f1ee;
  background:linear-gradient(155deg,#203b44,#152a36);
  border-color:#97d5d185;
  transition:border-color .16s,background-color .16s,box-shadow .16s;
  position:relative;
  box-shadow:inset 0 1px #e5fffa17,0 3px 10px #030c134d;
}

.time-warp-action[data-time-warp-active=true] {
  color:#e4faf4;
  background:linear-gradient(150deg,#214d4f,#172f3b 72%);
  border-color:#9cecdccc;
  box-shadow:inset 0 1px #d7fff224,0 0 0 1px #79dfce1a,0 0 14px #51ceb624;
}

.time-warp-action:enabled:hover {
  border-color:#c8f5e9;
  box-shadow:inset 0 1px #e5fffa24,0 0 16px #61dfc338;
}

.time-warp-action:focus-visible,.time-warp-cancel:focus-visible {
  outline-offset:2px;
  outline:2px solid #c8f5e9;
}

.time-warp-effect {
  border-radius:inherit;
  pointer-events:none;
  z-index:-1;
  position:absolute;
  inset:0;
  overflow:hidden;
}

.time-warp-sweep {
  opacity:0;
  background:linear-gradient(90deg,#0000,#baffeb29,#0000);
  width:35%;
  position:absolute;
  inset:-30% 0;
}

.time-warp-action:enabled[data-time-warp-active=true] .time-warp-sweep {
  animation:7s ease-in-out infinite time-warp-sweep;
}

.time-warp-action:disabled .time-warp-effect {
  opacity:.3;
}

.time-warp-action.time-warp-compact-toggle {
  color:#9fc4c0;
  background:linear-gradient(155deg,#203b44b8,#152a36b8);
  border-color:#97d5d152;
  border-radius:.5rem;
  width:2.75rem;
  height:2rem;
  min-height:2rem;
  box-shadow:inset 0 1px #e5fffa0f;
}

.time-warp-action.time-warp-compact-toggle[data-time-warp-active=true] {
  color:#f2fffb;
  background:linear-gradient(150deg,#3a8f82,#1f5a58 72%);
  border-color:#9cecdc;
  box-shadow:inset 0 1px #e5fffa38,0 0 0 1px #9cecdc33,0 0 14px #51ceb652;
}

.time-warp-compact-toggle:after {
  content:"";
  z-index:1;
  border-radius:inherit;
  position:absolute;
  inset:-.375rem 0;
}

.time-warp-compact-toggle .time-warp-clock {
  width:1.25rem;
  height:1.25rem;
}

.time-warp-chain-indicators {
  align-items:flex-start;
  top:.52rem;
  left:2.7rem;
  right:.4rem;
}

.time-warp-chain-badge {
  color:#e4faf4;
  letter-spacing:.02em;
  white-space:nowrap;
  background:linear-gradient(#1f5c58f5,#0f373afa);
  border:1px solid #9cecdc94;
  border-radius:999px;
  align-items:center;
  min-width:0;
  max-width:100%;
  padding:.38rem .6rem;
  font-size:.66rem;
  font-weight:600;
  line-height:1;
  display:inline-flex;
  position:relative;
  box-shadow:0 8px 20px #020e146b,inset 0 1px #defff62e;
}

.time-warp-chain-badge>span {
  text-overflow:ellipsis;
  overflow:hidden;
}

.time-warp-turn-group {
  --time-warp-cancel-height:1.75rem;
  --time-warp-cancel-gap:.2rem;
  width:100%;
  min-width:0;
  display:grid;
  position:relative;
}

.time-warp-turn-group .time-warp-turn-button {
  -webkit-backdrop-filter:blur(10px)saturate(1.3)brightness(.9);
  backdrop-filter:blur(10px)saturate(1.3)brightness(.9);
  background:linear-gradient(160deg,#c4ffee29,#78d6be14 50%,#06161a42);
  border-color:#aaecdc6b;
  border-radius:.2rem;
  min-height:3.38rem;
  box-shadow:inset 0 1px 1px #e6fff852,inset 0 -1px 2px #0000002e,inset 0 0 18px #8cf0d614,0 0 16px #5bd7ba1f,0 6px 16px #00000038;
}

.time-warp-turn-group .time-warp-turn-button:before,.time-warp-turn-group .time-warp-turn-button:after {
  content:none;
}

.time-warp-turn-group .time-warp-turn-button:enabled:hover {
  background:linear-gradient(160deg,#c4ffee38,#78d6be1f 50%,#06161a38);
  border-color:#c8f5e99e;
}

/* @media (prefers-reduced-transparency:reduce) */
.time-warp-turn-group .time-warp-turn-button {
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
  background:#0e282ce6;
}

.time-warp-turn-group[data-time-warp-layout=mouse] .time-warp-orbit {
  display:none;
}

.time-warp-clock {
  filter:drop-shadow(0 0 2px #a1f2d747);
  flex-shrink:0;
  width:1.15em;
  height:1.15em;
  display:inline-flex;
}

.time-warp-clock svg {
  width:100%;
  height:100%;
}

.time-warp-turn-label {
  letter-spacing:.045em;
  text-transform:uppercase;
  font-size:.72rem;
  font-weight:700;
  line-height:1.1;
  position:relative;
}

.time-warp-turn-badge {
  color:#beeedd;
  background:#0c262b8c;
  border:1px solid #97decb66;
  border-radius:.25rem;
  justify-content:center;
  align-items:center;
  gap:.25rem;
  margin-top:.3rem;
  padding:.2rem .35rem;
  font-size:.62rem;
  font-weight:650;
  line-height:1.1;
  display:inline-flex;
  position:relative;
}

.time-warp-cancel {
  width:100%;
  min-height:var(--time-warp-cancel-height);
  margin-bottom:var(--time-warp-cancel-gap);
  color:#a9c7c5;
  cursor:pointer;
  background:#0f1f2bf5;
  border:1px solid #95d1c438;
  border-radius:.2rem;
  order:-1;
  justify-content:center;
  align-items:center;
  gap:.3rem;
  padding:.3rem;
  font-size:.65rem;
  line-height:1.1;
  display:flex;
}

.time-warp-cancel:enabled:hover {
  color:#e2f5ee;
  background:#2a444c9e;
}

.time-warp-cancel:disabled {
  opacity:.5;
  cursor:default;
}

.time-warp-turn-count {
  display:none;
}

.time-warp-dialog-backdrop {
  z-index:300;
  padding:.75rem .75rem max(.75rem, env(safe-area-inset-bottom));
  -webkit-backdrop-filter:blur(3px);
  backdrop-filter:blur(3px);
  pointer-events:auto;
  background:#0208119e;
  justify-content:center;
  align-items:flex-end;
  display:flex;
  position:fixed;
  inset:0;
}

.time-warp-dialog {
  color:#edf8f5;
  background:linear-gradient(150deg,#142e37,#0d192c 72%);
  border:1px solid #97decb6b;
  border-radius:.8rem;
  outline:none;
  width:100%;
  max-width:24rem;
  max-height:calc(100dvh - 1.5rem);
  padding:1rem;
  overflow-y:auto;
  box-shadow:inset 0 1px #e6fff514,0 16px 50px #02070fa6;
}

.time-warp-dialog-header {
  align-items:center;
  gap:.7rem;
  display:flex;
}

.time-warp-dialog-header h2 {
  margin:0;
  font-size:.95rem;
  font-weight:700;
  line-height:1.3;
}

.time-warp-dialog-header>div>span {
  color:#a7d8cd;
  margin-top:.2rem;
  font-size:.72rem;
  display:block;
}

.time-warp-dialog-icon {
  color:#c3f3e1;
  background:#346b6338;
  border:1px solid #97decb4d;
  border-radius:.65rem;
  flex-shrink:0;
  place-items:center;
  width:2.6rem;
  height:2.6rem;
  font-size:1.4rem;
  display:grid;
}

.time-warp-dialog-close {
  color:#b2cacd;
  border-radius:.4rem;
  flex-shrink:0;
  place-items:center;
  width:2.75rem;
  height:2.75rem;
  margin-left:auto;
  display:grid;
}

.time-warp-dialog-description {
  color:#afc2cd;
  margin:.8rem 0 1rem;
  font-size:.78rem;
  line-height:1.5;
}

.time-warp-dialog-actions {
  gap:.75rem;
  display:grid;
}

.time-warp-dialog-actions button {
  border-radius:.45rem;
  justify-content:center;
  align-items:center;
  gap:.5rem;
  min-height:3.25rem;
  padding:.7rem 1rem;
  font-size:.84rem;
  font-weight:650;
  display:flex;
}

.time-warp-dialog-end>span:last-child {
  position:relative;
}

.time-warp-dialog-end {
  border:1px solid #9cecdccc;
}

.time-warp-dialog-cancel {
  color:#ccdae5;
  background:#0e1829b3;
  border:1px solid #abbed647;
}

.time-warp-dialog-cancel:enabled:hover,.time-warp-dialog-close:hover {
  background:#394c5b6b;
}

.time-warp-dialog button:focus-visible {
  outline-offset:3px;
  outline:2px solid #c5f9e8;
}

.time-warp-dialog-actions button:disabled {
  opacity:.5;
  cursor:default;
}

/* @media (prefers-reduced-motion:reduce) */
.time-warp-action:enabled[data-time-warp-active=true] .time-warp-sweep {
  animation:none;
}

/* @media (prefers-reduced-motion:reduce) */
.time-warp-action {
  transition:none;
}

/* @media (prefers-reduced-motion:reduce) */
.time-warp-sweep {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-group {
  flex:1;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-group>div {
  min-width:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-button {
  height:var(--phone-nameplate-height);
  min-height:var(--phone-nameplate-height);
  padding:.25rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-badge {
  border-radius:999px;
  gap:.25rem;
  margin-top:.25rem;
  padding:.15rem .42rem;
  font-size:.6rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-badge-label {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-turn-count {
  align-items:center;
  gap:.25rem;
  display:inline-flex;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-beginning-label {
  font-size:.6rem;
  line-height:1;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] .time-warp-cancel {
  display:none;
}
```

## expected-action-button

**12 rules**

### 1sj2l8ggay34g.css

```css
/* @layer components */
.expected-action-button {
  --expected-action-outline:#c9e2ff57;
  --expected-action-ring:#c9e2ff47;
  --expected-action-ring-strong:#e7f2ff85;
  --expected-action-glow:#71a8f742;
  --expected-action-glow-soft:#71a8f71f;
  --expected-action-ring-offset-block:-2px;
  --expected-action-ring-offset-inline:-2px;
  --expected-action-ring-offset-left:var(--expected-action-ring-offset-inline);
  --expected-action-ring-offset-right:var(--expected-action-ring-offset-inline);
  --expected-action-ring-clip:none;
  --expected-action-transform-origin:center;
  --expected-action-split-shadow:0 0 0 #0000;
  --expected-action-split-shadow-strong:0 0 0 #0000;
  isolation:isolate;
  outline:1px solid var(--expected-action-outline);
  outline-offset:1px;
  position:relative;
}

/* @layer components */
.expected-action-button:after {
  content:"";
  top:var(--expected-action-ring-offset-block);
  right:var(--expected-action-ring-offset-right);
  bottom:var(--expected-action-ring-offset-block);
  left:var(--expected-action-ring-offset-left);
  z-index:-1;
  border:1px solid var(--expected-action-ring);
  border-radius:inherit;
  clip-path:var(--expected-action-ring-clip);
  transform-origin:var(--expected-action-transform-origin);
  box-shadow:0 0 0 1px var(--expected-action-ring-strong), 0 0 11px var(--expected-action-glow), 0 0 18px var(--expected-action-glow-soft);
  pointer-events:none;
  animation:2.35s ease-in-out infinite expectedActionButtonPulse;
  position:absolute;
}

/* @layer components */
.expected-action-button--approval {
  --expected-action-outline:#d3e8ff6b;
  --expected-action-ring:#bddbff57;
  --expected-action-ring-strong:#eff8ff94;
  --expected-action-glow:#6cadff4d;
  --expected-action-glow-soft:#6cadff24;
}

/* @layer components */
.expected-action-button--showdown {
  --expected-action-outline:#ffbe9661;
  --expected-action-ring:#ffae704d;
  --expected-action-ring-strong:#ffdeb58a;
  --expected-action-glow:#ff845642;
  --expected-action-glow-soft:#ff84561f;
}

/* @layer components */
.expected-action-button--split-left {
  --expected-action-ring-offset-block:-1px;
  --expected-action-ring-offset-right:0px;
  --expected-action-ring-clip:none;
  --expected-action-split-shadow:-3px 0 7px var(--expected-action-glow-soft);
  --expected-action-split-shadow-strong:-5px 0 10px var(--expected-action-glow);
  --expected-action-transform-origin:right center;
}

/* @layer components */
.expected-action-button--split-right {
  --expected-action-ring-offset-block:-1px;
  --expected-action-ring-offset-left:0px;
  --expected-action-ring-clip:none;
  --expected-action-split-shadow:3px 0 7px var(--expected-action-glow-soft);
  --expected-action-split-shadow-strong:5px 0 10px var(--expected-action-glow);
  --expected-action-transform-origin:left center;
}

/* @layer components */
.expected-action-button.expected-action-button--split-left,.expected-action-button.expected-action-button--split-right {
  outline:none;
}

/* @layer components */
.expected-action-button.expected-action-button--split-left:after,.expected-action-button.expected-action-button--split-right:after {
  box-shadow:var(--expected-action-split-shadow-strong);
  animation:2.35s ease-in-out infinite expectedActionButtonSplitPulse;
  transform:none;
}

/* @layer components */
.expected-action-button.expected-action-button--split-left:after {
  border-right-width:0;
}

/* @layer components */
.expected-action-button.expected-action-button--split-right:after {
  border-left-width:0;
}

/* @layer components > @media (prefers-reduced-motion:reduce) */
.expected-action-button:after {
  opacity:.58;
  box-shadow:0 0 0 1px var(--expected-action-ring-strong), 0 0 10px var(--expected-action-glow-soft);
  animation:none;
  transform:none;
}

/* @layer components > @media (prefers-reduced-motion:reduce) */
.expected-action-button.expected-action-button--split-left:after,.expected-action-button.expected-action-button--split-right:after {
  box-shadow:var(--expected-action-split-shadow);
}
```

## game-selection

**13 rules**

### 1sj2l8ggay34g.css

```css
.game-selection-backdrop {
  background:var(--game-selection-backdrop);
}

.game-selection-target-focus {
  border-color:var(--game-selection-focus-border);
  box-shadow:inset 0 0 0 1px #baf1ff29, 0 0 22px var(--game-selection-focus-glow);
  background:radial-gradient(circle at 50% 18%,#98e6ff2e,#2964881a 42%,#09121f05 78%);
}

.game-selection-prompt {
  z-index:160;
  top:max(12px, calc(env(safe-area-inset-top) + 12px));
  color:#edf7ff;
  pointer-events:auto;
  background:linear-gradient(145deg,#1d3045fa,#102033fa);
  border:1px solid #a7d7ed55;
  border-radius:12px;
  align-items:center;
  gap:10px;
  width:max-content;
  max-width:min(480px,100vw - 24px);
  padding:10px 12px;
  display:flex;
  position:fixed;
  left:50%;
  transform:translate(-50%);
  box-shadow:0 12px 32px #02081370,inset 0 1px #e1f4ff12;
}

.game-selection-icon {
  color:#9ee5f4;
  background:#6ec7e414;
  border:1px solid #88d0e52b;
  border-radius:9px;
  flex:0 0 32px;
  place-items:center;
  height:32px;
  display:grid;
}

.game-selection-copy {
  text-wrap:balance;
  min-width:0;
  font-size:13px;
  font-weight:600;
  line-height:1.4;
}

.game-selection-actions {
  flex-shrink:0;
  align-items:center;
  gap:6px;
  display:flex;
}

.game-selection-cancel,.game-selection-secondary {
  color:#e3edf8;
  cursor:pointer;
  background:#d0e6ff0b;
  border:1px solid #bdd6eb38;
  border-radius:8px;
  flex-shrink:0;
  justify-content:center;
  align-items:center;
  gap:5px;
  min-height:34px;
  padding:6px 10px;
  font-size:12px;
  font-weight:600;
  line-height:1.2;
  transition:background-color .14s,border-color .14s;
  display:inline-flex;
}

.game-selection-cancel:hover,.game-selection-secondary:hover {
  background:#d0e6ff1a;
  border-color:#bdd6eb75;
}

.game-selection-cancel:focus-visible,.game-selection-secondary:focus-visible {
  outline-offset:3px;
  outline:2px solid #9ee5f4;
}

.game-selection-secondary {
  color:#ffc6c6;
  min-width:34px;
  padding-inline:8px;
}

:where(:root[data-sim-pointer=touch]) .game-selection-cancel,:where(:root[data-sim-pointer=touch]) .game-selection-secondary {
  min-width:44px;
  min-height:44px;
}

/* @media (max-width:420px) */
.game-selection-prompt {
  gap:8px;
  padding:8px;
}

/* @media (max-width:420px) */
.game-selection-icon {
  flex-basis:28px;
  height:28px;
}
```

## touch-

**163 rules**

### 1sj2l8ggay34g.css

```css
/* @layer base */
:where(:root:not([data-sim-pointer=touch])) ::-webkit-scrollbar-thumb:hover {
  background:linear-gradient(#bad6fffa,#85b2f4fa);
}

[data-touch-layout=true] [data-player-area=resources]>[data-resources-content] {
  display:contents;
}

[data-touch-layout=true] [data-player-area=resources]>[data-resources-content]:before {
  content:none;
}

:where(:root:not([data-sim-pointer=touch])) .group\/action:hover .gb-action-hover-label,.group\/action:focus-visible .gb-action-hover-label {
  opacity:1;
}

:where(:root:not([data-sim-pointer=touch])) .gb-board[data-suppress-board-hover-tone=false] .gb-local-board-hover-tone:hover {
  outline-offset:-1px;
  outline:1px solid #c4ffe48f;
  box-shadow:0 0 10px #78ddb747,0 0 18px #78ddb733;
  transition:none!important;
}

:where(:root:not([data-sim-pointer=touch])) .gb-board .gb-board-layer[data-board-drag-active=true] .gb-local-board-hover-tone:hover {
  box-shadow:none!important;
  outline:none!important;
}

:root[data-sim-pointer=touch] .gb-action-hover-label:not(:where(:focus-visible *)) {
  display:none;
}

:root[data-sim-pointer=touch] .gb-board .gb-local-board-hover-tone:hover {
  box-shadow:none!important;
  outline:none!important;
}

[data-touch-layout=true]>[data-player-area=actions] [data-help-anchor=board-controls]>div>button {
  align-content:center;
  gap:.1rem;
}

[data-touch-layout=true]>[data-player-area=actions] [data-help-anchor=board-controls]>div>button>svg {
  width:1.125rem;
  height:1.125rem;
}

.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions] {
  right:-3.5rem;
}

.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls] {
  width:100%;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-short=true] [data-touch-layout=true]>[data-player-area=actions] {
  bottom:.25rem;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-short=true] [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button {
  height:var(--rail-segment-height,2rem);
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-short=true] [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button>svg {
  width:1.125rem;
  height:1.125rem;
}

[data-touch-card-surface] {
  touch-action:pinch-zoom;
  -webkit-touch-callout:none;
  -webkit-user-select:none;
  user-select:none;
}

[data-touch-card-surface] img {
  -webkit-user-drag:none;
}

.touch-menu-backdrop {
  z-index:2147483601;
  background:#02091455;
  position:fixed;
  inset:0;
}

.touch-card-menu {
  z-index:2147483602;
  width:min(36rem,100vw - 1rem);
  max-height:calc(var(--sim-visible-height,100dvh) - 1rem);
  overscroll-behavior:contain;
  color:#e8f4ff;
  touch-action:pan-y pinch-zoom;
  background:#102139fc;
  border:1px solid #adc9e969;
  border-radius:.65rem;
  padding:.45rem;
  position:fixed;
  overflow-y:auto;
  box-shadow:0 20px 70px #020713a0;
}

.touch-card-action {
  text-align:left;
  border-top:1px solid #87a0be33;
  width:100%;
  min-height:2.75rem;
  padding:.55rem .7rem;
  font-size:.82rem;
  display:block;
}

.touch-card-action:disabled {
  opacity:.4;
}

.touch-card-action:focus-visible {
  outline-offset:-2px;
  outline:2px solid #a5dcff;
}

.touch-card-menu[data-has-preview=false] {
  width:min(20rem,100vw - 1rem);
}

.touch-card-menu-body {
  grid-template-columns:minmax(0,1fr) minmax(12rem,1fr);
  align-items:start;
  gap:.6rem;
  padding:.25rem;
  display:grid;
}

.touch-card-menu-body[data-has-preview=false] {
  grid-template-columns:minmax(0,1fr);
}

.touch-card-preview {
  width:min(100%, calc((var(--sim-visible-height,100dvh) - 5.5rem) * .716));
  --card-label-chip-height:1.3rem;
  --card-label-chip-font-size:.65rem;
  --card-label-chip-radius:.2rem;
  --card-label-chip-pad-x:.3rem;
  --card-label-stack-gap:.2rem;
  --card-label-stack-left:.25rem;
  --card-label-stack-width-offset:.5rem;
  border-radius:.45rem;
  justify-self:center;
  position:relative;
  overflow:hidden;
}

.touch-card-preview[data-preview-landscape=true] {
  width:min(100%, calc((var(--sim-visible-height,100dvh) - 5.5rem) * 394 / 284));
}

.touch-card-preview-image {
  aspect-ratio:63/88;
  border-radius:inherit;
  position:relative;
  overflow:hidden;
}

.touch-card-preview[data-preview-landscape=true] .touch-card-preview-image,.touch-card-menu[data-preview-landscape=true] .touch-card-preview-image {
  aspect-ratio:394/284;
}

.touch-card-preview-footer {
  margin-top:.4rem;
}

.touch-card-preview-rules {
  inset-inline:0;
  background:linear-gradient(#060c1800,#060c18 1rem);
  padding:1.2rem .7rem .55rem;
  font-size:.72rem;
  position:absolute;
  bottom:0;
}

.touch-card-preview-image:has(.touch-card-preview-rules) .touch-counter-readouts {
  top:.4rem;
  bottom:auto;
}

.touch-card-action-list {
  min-width:0;
  max-height:calc(var(--sim-visible-height,100dvh) - 5.5rem);
  overscroll-behavior:contain;
  overflow-y:auto;
}

.touch-label-picker {
  gap:.7rem;
  padding:.35rem;
  display:grid;
}

.touch-label-picker p {
  color:#afc1d8;
  font-size:.75rem;
  line-height:1.45;
}

.touch-editor-done {
  background:#28496b;
  border:1px solid #9bc7f282;
  border-radius:.35rem;
  min-height:2.75rem;
  padding:.45rem .7rem;
  font-size:.85rem;
  font-weight:700;
}

.touch-menu-backdrop[data-mode=counters] {
  background:0 0;
}

.touch-card-menu[data-mode=counters] {
  width:12.125rem;
  box-shadow:none;
  background:0 0;
  border:0;
  padding:0;
  overflow:visible;
}

.touch-card-menu[data-mode=counters] .touch-card-menu-body {
  padding:0;
}

.touch-card-menu[data-mode=counters] .touch-card-action-list {
  max-height:none;
  overflow:visible;
}

.touch-counter-column button:focus-visible {
  outline-offset:2px;
  outline:2px solid #61bdff;
}

.touch-counter-readouts {
  justify-content:center;
  gap:.4rem;
  display:flex;
  position:absolute;
  bottom:.4rem;
  left:.4rem;
  right:.4rem;
}

.touch-counter-readouts output {
  color:#132840;
  text-align:center;
  background:#e2ebf7;
  border:1px solid #e9f1fb;
  border-radius:.35rem;
  min-width:2.4rem;
  padding:.15rem .45rem;
  font-size:1.15rem;
  font-weight:800;
  box-shadow:0 3px 10px #02081388;
}

.touch-counter-readouts output[data-counter-color=red] {
  color:#fff0f1;
  background:#742532;
  border-color:#e98c99;
}

.touch-counter-editor {
  gap:.625rem;
  display:grid;
}

.touch-counter-column {
  color:#e5f3ff;
  --counter-control-bg:linear-gradient(170deg, #203750fa, #13263cf5);
  --counter-control-border:#718aa680;
  --counter-badge-bg:linear-gradient(172deg, #fcfeff, #e2e9f6);
  --counter-badge-color:#1f324c;
  --counter-badge-border:#e4ecf7db;
  --counter-item-y:22px;
  grid-template-columns:repeat(4,2.75rem);
  align-items:center;
  gap:.375rem;
  display:grid;
}

.touch-counter-column[data-counter-color=red] {
  color:#ffebee;
  --counter-control-bg:linear-gradient(170deg, #452636fa, #281d2df5);
  --counter-control-border:#b56f7a99;
  --counter-badge-bg:linear-gradient(172deg, #ad2626, #761717);
  --counter-badge-color:#ffebee;
  --counter-badge-border:#ffbebebd;
  --counter-item-y:76px;
}

.touch-counter-column button,.touch-counter-column output {
  border:1px solid var(--counter-control-border);
  background:var(--counter-control-bg);
  --counter-from-x:calc(var(--counter-origin-x,72px) - var(--counter-item-x));
  --counter-from-y:calc(var(--counter-origin-y,49px) - var(--counter-item-y));
  border-radius:.35rem;
  justify-content:center;
  align-items:center;
  width:2.75rem;
  height:2.75rem;
  animation:.34s cubic-bezier(.18,.7,.24,1) both touch-counter-unfold;
  display:flex;
  box-shadow:inset 0 1px #ffffff20,0 5px 12px #050a184f;
}

.touch-counter-column button {
  touch-action:manipulation;
  font-size:1.25rem;
  font-weight:700;
  transition:scale .14s cubic-bezier(.2,.8,.2,1),border-color .14s,filter .14s;
}

.touch-counter-column button:active:enabled {
  filter:brightness(1.22);
  border-color:#cce7ff;
  scale:.94;
}

.touch-counter-column button:first-of-type {
  --counter-item-x:22px;
  animation-delay:24ms;
}

.touch-counter-column button:nth-of-type(2) {
  --counter-item-x:122px;
  animation-delay:44ms;
}

.touch-counter-column button:last-child {
  --counter-item-x:172px;
  color:#afc4df;
  background:#13263cf5;
  border-color:#718aa655;
  animation-delay:64ms;
}

.touch-counter-column output {
  --counter-item-x:72px;
  background:var(--counter-badge-bg);
  color:var(--counter-badge-color);
  border-color:var(--counter-badge-border);
  font-variant-numeric:tabular-nums;
  font-size:1.15rem;
  font-weight:800;
  box-shadow:inset 0 1px #fff3,0 5px 12px #050a1873;
}

.touch-counter-value {
  animation:.2s cubic-bezier(.2,.8,.2,1) touch-counter-tick;
}

.touch-counter-column button:disabled,.touch-label-picker button:disabled {
  opacity:.45;
  --counter-control-opacity:.45;
}

/* @media (prefers-reduced-motion:reduce) */
.touch-counter-column button,.touch-counter-column output,.touch-counter-value {
  transition:none;
  animation:none;
}

/* @media (prefers-reduced-motion:reduce) */
.touch-counter-column button:active:enabled {
  scale:none;
}

.touch-label-presets {
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.35rem;
  display:grid;
}

.touch-existing-label button,.touch-custom-label-row button,.touch-custom-label-row input {
  overflow-wrap:anywhere;
  border:1px solid #7898b852;
  border-radius:.35rem;
  min-height:2.75rem;
  padding:.45rem;
  font-size:.75rem;
}

/* @media (pointer:coarse) */
.input-field,.touch-custom-label-row input {
  font-size:max(16px,1em);
}

.touch-existing-label {
  grid-template-columns:minmax(0,1fr) 2.75rem;
  gap:.2rem;
  display:grid;
}

.touch-existing-label button:last-child {
  place-items:center;
  display:grid;
}

.touch-existing-label button[aria-pressed=true] {
  outline-offset:-2px;
  background:#28496b;
  outline:2px solid #a5dcff;
}

.touch-label-picker label {
  margin-bottom:.25rem;
  font-size:.75rem;
  display:block;
}

.touch-custom-label-row {
  grid-template-columns:minmax(0,1fr) auto;
  gap:.25rem;
  display:grid;
}

.touch-custom-label-row input {
  background:#09192e;
  min-width:0;
}

:root[data-sim-keyboard-open=true] .touch-card-menu-body {
  grid-template-columns:minmax(0,1fr);
}

:root[data-sim-keyboard-open=true] .touch-card-preview {
  display:none;
}

:root[data-sim-keyboard-open=true] .touch-card-action-list {
  max-height:none;
  overflow:visible;
}

/* @media (max-width:540px) */
.touch-card-menu-body {
  grid-template-columns:minmax(0,1fr);
}

/* @media (max-width:540px) */
.touch-card-preview {
  max-width:12rem;
}

.touch-card-drag-handle {
  z-index:25;
  color:#fff;
  touch-action:pinch-zoom;
  background:#132840ef;
  border:1px solid #b5d5f570;
  border-radius:.35rem;
  place-items:center;
  width:2.75rem;
  height:2.75rem;
  display:none;
  position:absolute;
  bottom:.4rem;
  right:.4rem;
}

:where(:root[data-sim-pointer=touch]) .touch-card-drag-handle {
  display:grid;
}

.touch-actions-content {
  gap:.25rem;
  display:grid;
}

.touch-actions-content button {
  opacity:1!important;
  pointer-events:auto!important;
  width:100%!important;
  min-width:2.75rem!important;
  height:auto!important;
  min-height:2.75rem!important;
  padding:.55rem!important;
  position:relative!important;
  inset:auto!important;
  transform:none!important;
}

.touch-actions-content button .group-hover\:opacity-100 {
  opacity:1;
}

.touch-actions-content .group\/action>span:last-child {
  opacity:1;
  pointer-events:none;
  white-space:normal;
  position:static;
  transform:none;
}

[data-touch-scrollable=true] {
  touch-action:pan-y pinch-zoom;
}

[data-player-layer][data-touch-layout=false] {
  --hero-lane-y:min(var(--lane-front-y), max(0rem, calc(100% + var(--player-board-row-gap) + var(--lane-pile-y) - var(--deck-hand-shelf-lift) - var(--card-height))));
}

[data-player-layer][data-touch-layout=true] {
  left:var(--battlefield-side-gap);
  height:var(--tablet-player-band);
  grid-template-columns:max-content minmax(0, 1fr) repeat(2, calc(var(--card-width) + .6rem));
  grid-template-rows:calc(var(--card-height) + .2rem) calc(var(--tablet-hand-height) + 1rem);
  --base-legend-clearance:0rem;
  --left-lanes-x:0rem;
  --lane-front-y:0rem;
  --lane-right-main-x:0rem;
  --lane-right-side-x:0rem;
  --lane-pile-y:.5rem;
  --rune-deck-lane-x:0rem;
  --rune-deck-lane-y:.5rem;
  grid-template-areas:"leftLanes leftLanes legend champion""runeDeck hand main trash";
  gap:.2rem .35rem;
  padding:.4rem 0 0;
  bottom:0;
  right:.5rem;
}

[data-player-layer=opponent][data-touch-layout=true] {
  left:.5rem;
  right:var(--battlefield-side-gap);
  top:0;
  bottom:auto;
}

[data-touch-layout=true]>[data-player-area=hand] {
  align-self:end;
  padding:0 .25rem 0 2.125rem;
  position:relative;
  inset:auto;
}

.gb-board[data-board-density=regular] [data-touch-layout=true]>[data-player-area=hand] {
  padding-left:3rem;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] [data-player-area=resources] {
  z-index:10;
  align-self:center;
  position:relative;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] [data-player-area=resources]>div>div {
  grid-template-columns:2rem max-content minmax(1rem,max-content) 2rem;
  row-gap:.2rem;
  font-size:.875rem;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] [data-player-area=resources] button,.gb-board[data-board-density=regular] [data-touch-layout=true] [data-player-area=resources] span[aria-hidden=true] {
  width:2rem;
  height:2rem;
  font-size:1rem;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] [data-player-area=resources]>div>div>span {
  font-size:.875rem;
}

[data-touch-layout=true]>[data-player-area=runeDeck] {
  align-self:end;
}

[data-touch-layout=true]>[data-player-area=runeDeck]>div {
  grid-template-columns:auto minmax(0,1fr);
  column-gap:.35rem;
}

[data-touch-layout=true]>[data-player-area=main],[data-touch-layout=true]>[data-player-area=trash] {
  align-self:end;
  transform:none;
}

[data-touch-layout=true]>[data-player-area=actions] {
  width:2.75rem;
  padding:0;
  position:absolute;
  bottom:0;
  right:-3.55rem;
  transform:none;
}

[data-touch-layout=true]>[data-player-area=actions]>div {
  flex-direction:column;
  transform:none;
}

[data-touch-layout=true]>[data-player-area=runeDeck] {
  transform:none;
}

[data-touch-layout=true]>[data-player-area=runeDeck]>div {
  grid-template-rows:1fr;
  align-items:center;
  position:relative;
}

[data-touch-layout=true]>[data-player-area=actions],[data-touch-layout=true]>[data-player-area=actions]>div {
  translate:none;
}

.touch-menu-backdrop[data-holding=true] {
  -webkit-backdrop-filter:blur(2px);
  backdrop-filter:blur(2px);
  background:#020b1d88;
}

.touch-card-menu[data-mode=actions] {
  width:min(42rem,100vw - 1.5rem);
  box-shadow:none;
  touch-action:none;
  background:0 0;
  border:0;
  outline:none;
  padding:0;
  overflow:visible;
}

.touch-hold-instructions {
  text-align:center;
  color:#dcf7ff;
  text-shadow:0 2px 8px #000;
  margin:0 0 .65rem;
  font-size:.76rem;
  font-weight:600;
  animation:.18s ease-out both touch-hold-fade;
}

.touch-hold-instructions span {
  color:#adcad7;
  margin-top:.2rem;
  font-size:.65rem;
  font-weight:400;
  display:block;
}

.touch-card-menu[data-mode=actions] .touch-card-menu-body {
  grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);
  align-items:center;
  gap:1rem;
  padding:0;
}

/* @media (min-width:541px) */
.touch-card-menu[data-mode=actions][data-preview-side=right] .touch-card-menu-body {
  grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);
}

/* @media (min-width:541px) */
.touch-card-menu[data-mode=actions][data-preview-side=right] .touch-card-preview {
  grid-area:1/2;
}

/* @media (min-width:541px) */
.touch-card-menu[data-mode=actions][data-preview-side=right] .touch-card-action-list {
  grid-area:1/1;
}

.touch-card-menu[data-mode=actions][data-has-preview=false] {
  width:min(23rem,100vw - 1.5rem);
}

.touch-card-menu[data-mode=actions] .touch-card-menu-body[data-has-preview=false] {
  grid-template-columns:minmax(0,1fr);
}

.touch-card-menu[data-mode=actions] .touch-card-preview {
  width:min(100%, calc((var(--sim-visible-height,100dvh) - 6rem) * .716));
  animation:.46s cubic-bezier(.16,1,.3,1) both touch-hold-preview;
  box-shadow:0 24px 60px #010813aa;
}

.touch-card-menu[data-mode=actions][data-preview-landscape=true] .touch-card-preview {
  width:min(100%, calc((var(--sim-visible-height,100dvh) - 6rem) * 394 / 284));
}

.touch-card-menu[data-mode=actions] .touch-card-action-list {
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.65rem;
  padding:.5rem;
  display:grid;
  overflow:visible;
}

.touch-card-menu[data-mode=actions] .touch-actions-content {
  display:contents;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button {
  color:#eaf8ff;
  text-align:left;
  touch-action:none;
  background:linear-gradient(145deg,#25435af7,#0e223cfb);
  border:1px solid #93bce76e;
  border-radius:1rem;
  align-items:center;
  gap:.5rem;
  min-height:3.5rem;
  padding:.65rem .7rem;
  font-size:.78rem;
  font-weight:600;
  line-height:1.25;
  transition:scale .13s ease-out,border-color .1s,background .1s,box-shadow .1s;
  animation:.44s cubic-bezier(.16,1,.3,1) both touch-hold-option;
  display:flex;
  box-shadow:0 8px 18px #010b2099,inset 0 1px #daf4ff20;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button:nth-child(2n) {
  animation-delay:30ms;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button:nth-child(3n) {
  animation-delay:60ms;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button:nth-child(4n) {
  animation-delay:90ms;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button>svg {
  color:#a7dce8;
  flex-shrink:0;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button[data-hold-selected=true] {
  color:#fff;
  background:linear-gradient(135deg,#377a7b,#174554);
  border-color:#b2fff0;
  scale:1.06;
  box-shadow:0 0 0 3px #79efdc38,0 10px 30px #020e2699,0 0 24px #70e9d544;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list button:disabled {
  opacity:.35;
}

/* @media (max-width:540px) */
.touch-card-menu[data-mode=actions] .touch-card-menu-body {
  grid-template-columns:minmax(0,1fr);
  gap:.55rem;
}

/* @media (max-width:540px) */
.touch-card-menu[data-mode=actions] .touch-card-preview {
  width:min(18.5rem, calc(100vw - 1.75rem), calc((var(--sim-visible-height,100dvh) - var(--touch-menu-chrome-height,12.5rem)) * .716));
  max-width:none;
}

/* @media (max-width:540px) */
.touch-card-menu[data-mode=actions][data-preview-landscape=true] {
  width:calc(100vw - .75rem);
}

/* @media (max-width:540px) */
.touch-card-menu[data-mode=actions][data-preview-landscape=true] .touch-card-preview {
  width:100%;
  max-width:none;
}

/* @media (max-width:540px) */
.touch-card-menu[data-mode=actions] .touch-card-action-list {
  gap:.4rem;
}

/* @media (prefers-reduced-motion:reduce) */
.touch-card-menu[data-mode=actions] *,.touch-hold-instructions {
  transition:none!important;
  animation:none!important;
}

:is(.gb-board,[data-setup-overlay],[data-touch-card-surface],.touch-card-menu),:is(.gb-board,[data-setup-overlay],[data-touch-card-surface],.touch-card-menu) * {
  -webkit-user-select:none;
  user-select:none;
  -webkit-touch-callout:none;
}

:is(.gb-board,[data-setup-overlay],.touch-card-menu) :is(input,textarea,select,[contenteditable=true],[contenteditable=true] *,[data-chat-message-list],[data-chat-message-list] *) {
  -webkit-user-select:text;
  user-select:text;
  -webkit-touch-callout:default;
}

:where(:root[data-sim-pointer=touch]) [data-has-below-actions=true] {
  --card-list-below-reserve:calc(4.75rem + env(safe-area-inset-bottom,0px));
}

/* @media (min-width:601px) and (min-height:501px),(min-width:1101px) */
:root:not([data-sim-pointer=touch]) .gb-deck-peek {
  --card-peek-width:clamp(12rem, 18vw, 14rem);
}

:where(:root[data-sim-pointer=touch]) .gb-deck-peek-to-hand {
  display:block;
}

.touch-card-menu[data-mode=labels] {
  border-radius:18px;
  padding:12px;
}

.touch-card-menu[data-mode=labels] .touch-label-presets {
  grid-template-columns:minmax(0,1fr);
  gap:4px;
}

.touch-card-preview .card-tag-name {
  box-shadow:none;
  font-size:inherit;
  opacity:1;
  visibility:visible;
  background:0 0;
  border:0;
  padding:0 0 0 .25rem;
  position:static;
}

.touch-label-tile {
  color:#d8e3ed;
  background:#ffffff03;
  border:1px solid #91adc51f;
  border-radius:7px;
  align-items:center;
  height:46px;
  transition:background .12s,border-color .12s;
  display:flex;
  overflow:hidden;
}

.touch-label-tile[data-selected=true] {
  border-color:var(--label-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.touch-label-tile[data-selected=true] {
  border-color:color-mix(in srgb, var(--label-accent) 32%, transparent);
}

.touch-label-tile[data-selected=true] {
  background:var(--label-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.touch-label-tile[data-selected=true] {
  background:color-mix(in srgb, var(--label-accent) 8%, #102139);
}

.touch-label-tile[data-selected=true] {
  box-shadow:inset 3px 0 var(--label-accent);
  color:#f1f6fc;
}

.touch-label-tile-choice {
  text-transform:uppercase;
  text-align:left;
  flex:1;
  align-items:center;
  gap:10px;
  min-width:0;
  height:44px;
  padding:0 14px;
  font-size:12px;
  font-style:italic;
  font-weight:750;
  display:flex;
}

.touch-label-tile-choice .card-label-icon {
  color:var(--label-accent);
}

.touch-label-tile-choice>span:last-child:not(:nth-child(2)) {
  margin-left:auto;
}

.touch-label-tile-count {
  color:var(--label-accent);
  flex:none;
  grid-template-columns:44px 28px 44px;
  align-items:center;
  margin-right:2px;
  display:grid;
}

.touch-label-tile-count button {
  border-radius:5px;
  min-height:44px;
  font-size:19px;
}

.touch-label-tile-count button:active {
  background:#ffffff14;
}

.touch-label-tile-count output {
  text-align:center;
  color:#f1f6fc;
  font-variant-numeric:tabular-nums;
  font-size:15px;
  font-weight:750;
}

.touch-card-menu[data-mode=labels] {
  --label-sheet-height:min(800px, calc(var(--sim-visible-height,100dvh) - 16px));
  top:calc(var(--sim-visible-top,0px) + var(--sim-visible-height,100dvh) - var(--label-sheet-height) - 8px);
  height:var(--label-sheet-height);
  flex-direction:column;
  width:min(420px,100vw - 16px);
  display:flex;
  overflow:hidden;
}

.touch-card-menu[data-mode=labels] .touch-card-menu-body {
  flex:1;
  align-items:stretch;
  min-height:0;
  display:flex;
}

.touch-card-menu[data-mode=labels] .touch-card-action-list {
  flex-direction:column;
  flex:1;
  min-width:0;
  min-height:0;
  max-height:none;
  display:flex;
  overflow:hidden;
}

.touch-label-picker {
  flex-direction:column;
  flex:1;
  gap:10px;
  min-height:0;
  display:flex;
}

.touch-label-capacity {
  font-variant-numeric:tabular-nums;
  color:#d1deeb;
  white-space:nowrap;
  font-size:11px;
  font-weight:650;
}

.touch-label-scroll {
  overscroll-behavior:contain;
  scrollbar-width:thin;
  flex-direction:column;
  flex:1;
  gap:12px;
  min-height:0;
  padding:1px 2px 8px 1px;
  display:flex;
  overflow-y:auto;
}

.touch-label-presets,.touch-label-picker>.touch-editor-done {
  flex:none;
}

.touch-custom-label-heading {
  justify-content:space-between;
  align-items:center;
  min-height:28px;
  display:flex;
}

.touch-custom-label-heading button {
  padding:7px;
}

.touch-label-tile-choice:focus-visible,.touch-label-tile-count button:focus-visible {
  outline:2px solid var(--label-accent);
  outline-offset:-3px;
}

:root[data-sim-pointer=touch] .gb-neeko-legends-control:not([data-compact]):before {
  width:max(100%,44px);
  height:max(100%,44px);
  top:auto;
  bottom:0;
  translate:-50%;
}

:root[data-sim-pointer=touch] .gb-neeko-legends-control[data-rotated]:not([data-compact]):before {
  top:0;
  bottom:auto;
}

.touch-linked-card-icon {
  border-radius:50%;
  flex:none;
  width:1.9rem;
  height:1.9rem;
  position:relative;
  overflow:hidden;
  box-shadow:0 0 0 1.5px #c8a66a;
}

.touch-linked-card-label {
  text-align:left;
  min-width:0;
  display:grid;
}

.touch-linked-card-label>small {
  color:#c8a66a;
  letter-spacing:.06em;
  text-transform:uppercase;
  font-size:.6rem;
  font-weight:700;
}

.touch-linked-card-stack {
  flex:none;
  display:flex;
}

.touch-linked-card-stack>.touch-linked-card-icon+.touch-linked-card-icon {
  margin-left:-.85rem;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list {
  position:relative;
}

.touch-card-menu[data-mode=actions] .touch-card-action-list>button.touch-actions-close {
  background:#102139fc;
  border-radius:50%;
  place-items:center;
  width:2.5rem;
  height:2.5rem;
  min-height:0;
  padding:0;
  animation:none;
  display:grid;
  position:absolute;
  bottom:calc(100% + .15rem);
  right:.5rem;
}
```

## banish

**24 rules**

### 1sj2l8ggay34g.css

```css
.banished-play-pop {
  z-index:2147483100;
  pointer-events:auto;
  align-items:center;
  gap:.6rem;
  display:flex;
  position:fixed;
}

.banished-play-pop[data-side=left] {
  flex-direction:row-reverse;
}

.banished-play-pop-card {
  aspect-ratio:63/88;
  width:clamp(5.5rem,14vh,8rem);
  transform-origin:var(--pop-origin-x) var(--pop-origin-y);
  border-radius:7px;
  flex:none;
  animation:.26s cubic-bezier(.2,.9,.25,1.05) both banished-pop-card;
  position:relative;
  overflow:hidden;
  box-shadow:0 0 0 1.5px #c8a66a,0 16px 34px #010813cc;
}

.banished-play-pop[data-side=left] .banished-play-pop-card {
  transform-origin:calc(var(--pop-origin-x) - 100%) var(--pop-origin-y);
}

.banished-play-pop-actions {
  gap:.4rem;
  display:grid;
}

.banished-play-pop-action {
  color:#eaf8ff;
  white-space:nowrap;
  cursor:pointer;
  background:linear-gradient(145deg,#25435af7,#0e223cfb);
  border:1px solid #93bce76e;
  border-radius:999px;
  align-items:center;
  gap:.45rem;
  min-height:2.25rem;
  padding:.35rem .8rem .35rem .65rem;
  font-size:.8rem;
  font-weight:600;
  transition:border-color .12s,background .12s;
  animation:.24s cubic-bezier(.2,.9,.25,1) both banished-pop-action;
  display:inline-flex;
  box-shadow:0 8px 18px #010b2099,inset 0 1px #daf4ff20;
}

.banished-play-pop-action:nth-child(2) {
  animation-delay:40ms;
}

.banished-play-pop-action:nth-child(3) {
  animation-delay:80ms;
}

.banished-play-pop-action:nth-child(4) {
  animation-delay:.12s;
}

.banished-play-pop-action:hover:not(:disabled),.banished-play-pop-action:focus-visible {
  border-color:#b2fff0;
  outline:none;
}

.banished-play-pop-action:disabled {
  opacity:.4;
  cursor:default;
}

.banished-play-pop-primary {
  color:#f1fffb;
  background:linear-gradient(135deg,#2f6f72,#174554);
  border-color:#8fe3d27a;
}

.banished-play-pop-pay {
  color:#ffe2a3;
}

.banished-play-pop-cancel {
  color:#c9d8ea;
}

:where(:root[data-sim-pointer=touch]) .banished-play-pop-action {
  min-height:2.75rem;
}

.banished-play-pop[data-side=left] .banished-play-pop-action {
  animation-name:banished-pop-action-left;
}

/* @media (prefers-reduced-motion:reduce) */
.banished-play-pop-card,.banished-play-pop-action {
  animation:none;
}

.banish-reveal-flight {
  z-index:10000;
  pointer-events:none;
  filter:drop-shadow(0 14px 26px #000a);
  will-change:transform, opacity;
  position:fixed;
  top:0;
  left:0;
}

.banish-reveal-glow {
  filter:blur(14px);
  opacity:0;
  background:radial-gradient(closest-side,#a27ff0a8,#7656c855 55%,#0000);
  border-radius:50%;
  position:absolute;
  inset:-16% -22%;
}

.neeko-reveal-flight .banish-reveal-glow {
  background:radial-gradient(closest-side,#8beac0a8,#349b8555 55%,#0000);
}

.banish-reveal-clip {
  perspective:1100px;
  position:absolute;
  inset:0;
}

.banish-reveal-flip {
  width:100%;
  height:100%;
  transform-style:preserve-3d;
  position:relative;
}

.banish-reveal-front,.banish-reveal-back {
  backface-visibility:hidden;
  border-radius:8px;
  position:absolute;
  inset:0;
  overflow:hidden;
}

.banish-reveal-back {
  transform:rotateY(180deg);
}
```

## chain

**56 rules**

### 1sj2l8ggay34g.css

```css
.tablet-icon-button:focus-visible,.tablet-chain-action:focus-visible {
  outline-offset:2px;
  outline:2px solid #a5dcff;
}

.tablet-chain-panel[hidden] {
  display:none;
}

.tablet-chain-panel[data-chain-targeting=true] {
  visibility:hidden;
  pointer-events:none;
}

.tablet-chain-entry-heading {
  display:contents;
}

.tablet-compact-chain[data-chain-empty=true] .tablet-chain-entry-heading {
  display:none;
}

.tablet-compact-chain[data-chain-empty=true] .tablet-chain-summary {
  text-align:center;
  grid-column:1/-1;
  align-self:center;
}

.tablet-compact-chain[data-chain-empty=true] .tablet-chain-status p {
  color:#c5d9ea;
  margin:0;
  padding:.3rem;
  font-size:.75rem;
  font-weight:600;
}

.tablet-compact-chain:has(.tablet-chain-thumbnail) h3 {
  top:4.35rem;
  bottom:auto;
}

.tablet-chain-preview-trigger {
  text-align:left;
  color:#e5f3ff;
  touch-action:manipulation;
  border-radius:.25rem;
  align-items:center;
  gap:.4rem;
  width:100%;
  min-width:0;
  display:flex;
  position:relative;
}

.tablet-chain-preview-trigger .tablet-chain-name {
  display:none;
}

.tablet-chain-summary {
  flex-direction:column;
  justify-content:space-between;
  gap:.3rem;
  min-width:0;
  display:flex;
}

.tablet-chain-title {
  align-items:start;
  gap:.3rem;
  display:flex;
}

.tablet-chain-title .tablet-chain-name {
  flex:1;
}

.tablet-chain-priority {
  color:#ffc680;
  flex-shrink:0;
}

.tablet-chain-priority[data-ready=true] {
  color:#8bdebd;
}

.gb-board[data-tablet-layout=true] .tablet-chain-thumbnail {
  flex-basis:2.25rem;
  width:2.25rem;
  height:3.15rem;
}

.gb-board[data-tablet-layout=true] .tablet-chain-name {
  text-overflow:ellipsis;
  white-space:nowrap;
  overflow:hidden;
}

.gb-board[data-tablet-layout=true] .tablet-compact-chain:has(.tablet-chain-thumbnail) h3 {
  top:auto;
  bottom:.3rem;
}

.tablet-chain-preview-trigger:focus-visible {
  outline:2px solid #a5dcff;
}

.tablet-chain-thumbnail {
  border-radius:.2rem;
  flex:0 0 3.5rem;
  height:5.06rem;
  position:relative;
  overflow:hidden;
}

.tablet-chain-name {
  overflow-wrap:anywhere;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  min-width:0;
  margin:0;
  font-size:.72rem;
  line-height:1.15;
  display:-webkit-box;
  overflow:hidden;
}

.tablet-chain-panel[data-chain-dock=rail] {
  --chain-rail-card:var(--chain-rail-card-height,3.15rem);
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-compact-chain {
  grid-template-columns:minmax(0,1fr);
  gap:.2rem;
  min-height:0;
  padding:.25rem;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-preview-trigger {
  justify-content:center;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-thumbnail {
  width:calc(var(--chain-rail-card) / 1.4);
  height:var(--chain-rail-card);
  flex-basis:auto;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-title,.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-priority {
  display:none;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-summary {
  gap:.15rem;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-chain-action {
  min-height:1.5rem;
  padding:.1rem .15rem;
  font-size:.56rem;
}

.tablet-chain-panel[data-chain-dock=rail] .tablet-compact-chain:has(.tablet-chain-thumbnail) h3 {
  top:calc(var(--chain-rail-card) - .85rem);
  bottom:auto;
  left:.25rem;
}

.tablet-chain-panel[data-chain-dock=rail][data-chain-name=true] .tablet-chain-title {
  min-width:0;
  display:block;
}

.tablet-chain-panel[data-chain-dock=rail][data-chain-name=true] .tablet-chain-title .tablet-chain-name {
  text-align:center;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:.58rem;
  line-height:1.2;
  display:block;
  overflow:hidden;
}

.tablet-chain-panel[data-chain-dock=column] .tablet-compact-chain {
  grid-template-columns:1.6rem minmax(0,1fr);
  align-items:center;
  gap:.25rem;
  min-height:0;
  padding:.2rem;
}

.tablet-chain-panel[data-chain-dock=column] .tablet-chain-thumbnail {
  flex-basis:1.6rem;
  width:1.6rem;
  height:2.24rem;
}

.tablet-chain-panel[data-chain-dock=column] .tablet-chain-title {
  display:none;
}

.tablet-chain-panel[data-chain-dock=column] .tablet-chain-action {
  min-height:2.24rem;
  padding-inline:.2rem;
  font-size:.6rem;
}

.tablet-chain-panel[data-chain-dock=column] .tablet-compact-chain:has(.tablet-chain-thumbnail) h3 {
  top:auto;
  bottom:.15rem;
  left:.15rem;
}

.tablet-chain-preview-backdrop {
  z-index:174;
  background:#030b1620;
  position:fixed;
  inset:0;
}

body:has(.gb-board[data-board-dragging=true]) .tablet-chain-preview-backdrop {
  pointer-events:none;
}

.tablet-chain-preview {
  z-index:175;
  width:min(15.5rem,100vw - 1rem);
  max-height:calc(var(--sim-visible-height,100dvh) - 1rem);
  overscroll-behavior:contain;
  color:#e8f4ff;
  pointer-events:auto;
  background:#102139fc;
  border:1px solid #adc9e969;
  border-radius:.65rem;
  padding:.45rem;
  position:fixed;
  overflow-y:auto;
  box-shadow:0 20px 70px #020713a0;
}

.tablet-chain-preview[data-pinned=true] {
  z-index:155;
}

.tablet-chain-preview-heading {
  align-items:center;
  gap:.2rem;
  margin-bottom:.3rem;
  display:flex;
}

.tablet-chain-preview-heading strong {
  flex:1;
  font-size:.75rem;
}

.tablet-chain-grip,.tablet-chain-preview-control {
  color:#b7cbe2;
  border-radius:.25rem;
  flex-shrink:0;
  place-items:center;
  width:2.75rem;
  height:2.75rem;
  display:grid;
}

.tablet-chain-grip {
  cursor:grab;
  touch-action:none;
}

.tablet-chain-grip:active {
  cursor:grabbing;
}

.tablet-chain-grip:focus-visible,.tablet-chain-preview-control:focus-visible {
  outline:2px solid #a5dcff;
}

.tablet-chain-card {
  --compact-chain-card-height:min(20rem, calc(var(--sim-visible-height,100dvh) - 7rem));
  height:var(--compact-chain-card-height);
  margin-bottom:.4rem;
  position:relative;
}

.tablet-chain-preview [data-chain-stack-pose] {
  box-shadow:none;
}

.tablet-chain-status {
  text-align:center;
  grid-template-columns:minmax(0,1fr);
  align-items:center;
  gap:.3rem;
  display:grid;
}

.tablet-chain-status p:only-child {
  grid-column:1/-1;
}

.tablet-chain-status p {
  overflow-wrap:anywhere;
  font-size:.6rem;
  line-height:1.2;
}

.tablet-chain-action {
  border-width:1px;
  border-radius:.3rem;
  min-height:2rem;
  padding:.2rem .4rem;
  font-size:.65rem;
  font-weight:700;
}

.tablet-chain-action:disabled {
  opacity:.6;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-chain-thumbnail {
  flex-basis:2.25rem;
  width:2.25rem;
  height:3.15rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-chain-name {
  text-overflow:ellipsis;
  white-space:nowrap;
  overflow:hidden;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-compact-chain:has(.tablet-chain-thumbnail) h3 {
  top:auto;
  bottom:.3rem;
}
```

## sidebar

**75 rules**

### 1sj2l8ggay34g.css

```css
.gb-board[data-lines-controls] :is([data-board-turn-controls] button,[data-resources-content] button,[data-help-anchor=board-controls]>div>button,[data-token-quick-bar]>button,[data-zone-owner=self]>.handRevealButton,.tablet-sidebar-rail :is(.tablet-sidebar-corner,.tablet-sidebar-controls) button) {
  border-image:var(--lines-box) 10 / .42rem / .12rem stretch!important;
}

.gb-board[data-lines-controls]:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls),.gb-board[data-lines-controls]:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls] {
  border-radius:.15rem;
  border-image:var(--lines-box) 10 / .42rem / .12rem stretch!important;
}

.gb-board[data-lines-controls]:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) button:not([data-forward-control] *),.gb-board[data-lines-controls]:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button {
  border-image-source:none!important;
}

.gb-board[data-lines-controls][data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls>.tablet-rail-group,.gb-board[data-lines-controls][data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self]>[data-player-area=actions]>[data-help-anchor=board-controls] {
  border-radius:.15rem;
  border-image:var(--lines-box) 10 / .42rem / .12rem stretch!important;
}

.gb-board[data-lines-controls][data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls>.tablet-rail-group button:not([data-forward-control] *),.gb-board[data-lines-controls][data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button {
  border-image-source:none!important;
}

.tablet-sidebar {
  z-index:20;
  flex-direction:column;
  gap:.15rem;
  min-height:0;
  padding:.18rem;
  display:flex;
  position:relative;
}

.tablet-sidebar-top {
  gap:.12rem;
  min-height:0;
  display:grid;
}

.tablet-sidebar-controls {
  pointer-events:auto;
  justify-content:flex-end;
  gap:.25rem;
  display:flex;
  position:relative;
}

.tablet-sidebar-rail .tablet-icon-button {
  width:2.75rem;
  height:2.75rem;
}

.tablet-sidebar-rail {
  pointer-events:none;
  flex-direction:column;
  align-items:center;
  gap:.75rem;
  width:2.75rem;
  display:flex;
  position:absolute;
  top:.25rem;
  bottom:5.5rem;
  right:.25rem;
}

.tablet-sidebar-corner {
  z-index:31;
  position:relative;
}

.tablet-sidebar-corner,.tablet-game-actions {
  pointer-events:auto;
  flex-direction:column;
  align-items:center;
  gap:.25rem;
  width:100%;
  display:flex;
}

.tablet-sidebar[data-compact=true] {
  pointer-events:none;
  display:contents;
  position:absolute;
  inset:0;
}

.tablet-sidebar[data-compact=true] .tablet-full-sidebar,.tablet-sidebar[data-compact=true] .tablet-sidebar-top {
  display:contents;
}

.tablet-sidebar[data-compact=true] .tablet-chain-panel {
  z-index:150;
  pointer-events:auto;
  width:13rem;
  position:absolute;
}

.tablet-sidebar[data-compact=true] .tablet-sidebar-controls {
  z-index:31;
  flex-direction:column;
  justify-content:center;
  width:2.75rem;
  margin-block:auto;
}

.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls] {
  pointer-events:auto;
  background:linear-gradient(#172940f7,#0e1b2cf7);
  border:1px solid #84a2c64d;
  border-radius:.6rem;
  flex-direction:column;
  align-items:stretch;
  gap:0;
  padding:.125rem;
  display:flex;
  box-shadow:inset 0 1px #e2f0ff12,0 8px 20px #02071352;
}

.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button {
  width:100%;
  min-width:0;
  box-shadow:none;
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
  color:#e5f3ff;
  background:0 0;
  border:0;
  border-radius:.45rem;
}

:is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button):after {
  content:"";
  position:absolute;
  inset:0 -.1875rem;
}

:is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button)[aria-expanded=true],:is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button)[aria-pressed=true] {
  background:#6092c833;
  box-shadow:inset 0 0 0 1px #a0cdf842;
}

:is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button)[aria-pressed=true]:not([aria-expanded=true]) {
  color:#e4fff2;
  background:#2870546b;
  box-shadow:inset 0 0 0 1px #a2ecc66b;
}

:root:not([data-sim-pointer=touch]) :is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div>button):enabled:hover {
  background:#4872a24d;
}

.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] .tablet-control-label {
  color:#cee0f4db;
}

:is(.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] .tablet-rail-group>:not(:first-child,.tablet-game-actions),.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] .tablet-rail-group .tablet-game-actions>:not(.tablet-game-actions),.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-sidebar[data-compact=true] .tablet-sidebar-controls>:not(:first-child),.gb-board:not([data-board-arrangement=phone-portrait]) [data-touch-layout=true]>[data-player-area=actions]>[data-help-anchor=board-controls]>div:not(:first-child)):before {
  content:"";
  display:var(--rail-divider-display,block);
  pointer-events:none;
  background:#96b6da29;
  height:1px;
  position:absolute;
  top:0;
  left:.45rem;
  right:.45rem;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-tight-rail=true] .tablet-sidebar[data-compact=true] :is(.tablet-rail-group,.tablet-sidebar-controls) .tablet-icon-button:not([data-forward-control] *) {
  height:var(--rail-segment-height);
  min-height:var(--rail-segment-height);
  padding-block:0;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-tight-rail=true] .tablet-sidebar[data-compact=true] .tablet-control-label {
  display:none;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-tight-rail=true] .tablet-sidebar[data-compact=true] .tablet-rail-group [data-rail-keep-label] .tablet-icon-button {
  height:calc(var(--rail-segment-height) + .5rem);
  min-height:calc(var(--rail-segment-height) + .5rem);
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-tight-rail=true] .tablet-sidebar[data-compact=true] [data-rail-keep-label] .tablet-control-label {
  display:inline;
}

.tablet-sidebar[data-compact=true][data-open-panel=chat] .tablet-chat-panel,.tablet-sidebar[data-compact=true][data-open-panel=log] .tablet-log-panel {
  right:max(.5rem, env(safe-area-inset-right));
  top:calc(var(--sim-visible-top,0px) + max(.5rem, env(safe-area-inset-top)));
  width:min(24rem,100vw - 1rem);
  height:calc(var(--sim-visible-height,100dvh) - 1rem);
  z-index:160;
  pointer-events:auto;
  background:#0d1a2dfc;
  border:1px solid #8ca5c86b;
  border-radius:.65rem;
  grid-template-rows:auto minmax(0,1fr);
  gap:.3rem;
  max-height:48rem;
  padding:.45rem;
  display:grid;
  position:fixed;
  box-shadow:0 20px 60px #020713a0;
}

.tablet-sidebar[data-compact=true]:not([data-open-panel=none]) .tablet-sidebar-controls {
  z-index:161;
  flex-direction:column;
  width:2.75rem;
  position:fixed;
  top:auto;
  bottom:.7rem;
  right:calc(min(24rem,100vw - 1rem) + .9rem);
  transform:none;
}

.tablet-sidebar[data-open-panel=sidebar] .tablet-full-sidebar {
  inset:calc(var(--sim-visible-top,0px) + .5rem) .5rem auto;
  height:calc(var(--sim-visible-height,100dvh) - 1rem);
  z-index:160;
  pointer-events:auto;
  background:#0d1a2dfc;
  border:1px solid #8ca5c86b;
  border-radius:.65rem;
  grid-template-rows:auto minmax(8rem,.8fr) minmax(12rem,1.2fr) minmax(8rem,1fr);
  gap:.4rem;
  padding:.5rem;
  display:grid;
  position:fixed;
  overflow-y:auto;
  container-type:size;
}

.tablet-sidebar[data-open-panel=sidebar] .tablet-sidebar-top {
  grid-template-rows:auto minmax(0,1fr);
  display:grid;
}

.tablet-sidebar[data-open-panel=sidebar] .tablet-chain-panel {
  --chain-stack-height-limit:max(0rem, calc(100cqh - 8.8rem));
  width:auto;
  min-height:0;
  position:relative;
  overflow:hidden;
  container-type:size;
}

.tablet-sidebar[data-open-panel=sidebar] .tablet-sidebar-rail {
  visibility:hidden;
}

.gb-board[data-board-density=narrow] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls {
  gap:.1rem;
}

.gb-board[data-board-short=true] .tablet-sidebar-rail {
  gap:.25rem;
}

.gb-board[data-board-short=true] .tablet-sidebar-corner,.gb-board[data-board-short=true] .tablet-game-actions,.gb-board[data-board-short=true] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls,.gb-board[data-board-short=true] .tablet-corner-timing {
  gap:0;
}

.gb-board[data-tablet-layout=true][data-board-short=true] .tablet-sidebar-corner .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-short=true] .tablet-sidebar-controls .tablet-icon-button {
  height:2rem;
  min-height:2rem;
  padding-block:.15rem;
}

.gb-board[data-tablet-layout=true][data-board-short=true] .tablet-sidebar-corner .tablet-icon-button>svg,.gb-board[data-tablet-layout=true][data-board-short=true] .tablet-sidebar-controls .tablet-icon-button>svg {
  width:1rem;
  height:1rem;
}

.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-sidebar-rail,.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls {
  width:calc(2.75rem * var(--compact-ui-scale));
}

.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-icon-button,.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-corner-timing,.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-compact-chain {
  zoom:var(--compact-ui-scale);
}

.gb-board[data-tablet-layout=false] .tablet-sidebar[data-compact=true] .tablet-chain-panel {
  width:calc(13rem * var(--compact-ui-scale));
}

.tablet-sidebar[data-compact=false] {
  display:block;
}

.tablet-sidebar[data-compact=false] .tablet-full-sidebar {
  height:100%;
  container-type:size;
}

.tablet-sidebar[data-compact=false] .tablet-chain-panel {
  --chain-stack-height-limit:max(0rem, calc(55cqh - 8.8rem));
}

[data-sidebar-room-metadata] {
  container:sidebar-room-metadata/inline-size;
}

[data-sidebar-room-label] {
  display:none;
}

/* @container sidebar-room-metadata (min-width:10rem) */
[data-sidebar-room-label] {
  display:inline;
}

.tablet-sidebar[data-compact=false] [data-sidebar-header-tools] {
  margin-right:3.3rem;
}

.tablet-sidebar[data-compact=false] .tablet-sidebar-controls {
  z-index:5;
  gap:.14rem;
  height:2.3rem;
  position:absolute;
  top:.28rem;
  right:.2rem;
}

.tablet-sidebar[data-compact=false] .tablet-icon-button {
  width:1.6rem;
  min-width:1.6rem;
  min-height:1.6rem;
  padding:.2rem;
}

.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control {
  z-index:151;
  pointer-events:auto;
  position:absolute;
  top:0;
  right:-.125rem;
}

:is(.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control) .tablet-icon-button {
  background:0 0;
  border:0;
  min-width:2.75rem;
  min-height:1.5rem;
  padding:0;
}

:is(.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control) .tablet-icon-button:before {
  content:"";
  background:#152941e6;
  border:1px solid #718aa655;
  border-radius:.3rem;
  position:absolute;
  inset:.0625rem .625rem;
}

:where(:root:not([data-sim-pointer=touch])) :is(.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control) .tablet-icon-button:enabled:hover {
  background:0 0;
}

:where(:root:not([data-sim-pointer=touch])) :is(.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control) .tablet-icon-button:enabled:hover:before {
  background:#254362;
}

:is(.phone-fullscreen-control,.phone-settings-control,.phone-sidebar-control,.phone-social-control) .tablet-icon-button>svg {
  width:1rem;
  height:1rem;
  position:relative;
}

.phone-sidebar-control {
  top:1.5rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-rail {
  top:auto;
  left:var(--phone-toolbar-start);
  right:calc(2 * var(--phone-toolbar-action-width) + var(--phone-toolbar-bar-chrome) + var(--phone-toolbar-group-gap) + .25rem);
  width:auto;
  height:auto;
  bottom:.45rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-rail[data-replay-toolbar=true] {
  --phone-toolbar-button-width:min(2.5rem, calc(( 100vw - var(--phone-toolbar-start) - 1rem - 2 * var(--phone-toolbar-bar-chrome) - var(--phone-toolbar-group-gap) ) / 5));
  right:.45rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-corner {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls {
  gap:var(--phone-toolbar-group-gap);
  flex-direction:row;
  justify-content:flex-start;
  width:100%;
  margin:0;
  position:static;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar[data-compact=true] .tablet-sidebar-controls>.tablet-rail-group,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self]>[data-player-area=actions]>[data-help-anchor=board-controls] {
  pointer-events:auto;
  background:linear-gradient(#172940f7,#0e1b2cf7);
  border:1px solid #84a2c64d;
  border-radius:.6rem;
  flex-direction:row;
  gap:0;
  padding:.125rem;
  display:flex;
  box-shadow:inset 0 1px #e2f0ff12,0 8px 20px #02071352;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls>.tablet-rail-group>:not(:first-child),.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>[data-help-anchor=board-controls]>div:not(:first-child) {
  position:relative;
}

:is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls>.tablet-rail-group>:not(:first-child),.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>[data-help-anchor=board-controls]>div:not(:first-child)):before {
  content:"";
  pointer-events:none;
  background:#96b6da29;
  width:1px;
  position:absolute;
  top:.45rem;
  bottom:.45rem;
  left:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button {
  width:var(--phone-toolbar-button-width);
  min-width:var(--phone-toolbar-button-width);
  height:2.25rem;
  min-height:2.25rem;
  font-size:min(.6rem, calc(var(--phone-toolbar-button-width) * .27));
  box-shadow:none;
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
  color:#e5f3ff;
  background:0 0;
  border:0;
  border-radius:.45rem;
  padding:.2rem .05rem;
  position:relative;
}

:is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button)[aria-expanded=true],:is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button)[aria-pressed=true] {
  background:#6092c833;
  box-shadow:inset 0 0 0 1px #a0cdf842;
}

:is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button)[aria-pressed=true]:not([aria-expanded=true]) {
  color:#e4fff2;
  background:#2870546b;
  box-shadow:inset 0 0 0 1px #a2ecc66b;
}

:root:not([data-sim-pointer=touch]) :is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button):enabled:hover {
  background:#4872a24d;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-control-label {
  color:#cee0f4db;
  font-size:min(.56rem, calc(var(--phone-toolbar-button-width) * .27));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button:after,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button:after,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button:after,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button:after {
  content:"";
  position:absolute;
  inset:-.25rem 0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar-controls .tablet-icon-button svg,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button svg,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button svg,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button svg,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-rewind-control] button>span:first-child,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button>span:first-child,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button>span:first-child {
  width:1rem;
  height:1rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar[data-compact=true][data-open-panel=none] .tablet-chain-panel {
  width:10.75rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-sidebar[data-compact=true]:not([data-open-panel=none]) .tablet-sidebar-rail {
  visibility:hidden;
}

/* @media (pointer:coarse),(max-width:768px) */
.tablet-sidebar[data-compact=false][data-supplementary-sidebar=true] .tablet-chain-panel {
  --chain-stack-height-limit:max(0rem, calc(100cqh - 5rem));
}
```

## tablet-

**97 rules**

### 1sj2l8ggay34g.css

```css
.tablet-full-sidebar {
  flex:1;
  gap:.14rem;
  min-height:0;
  display:grid;
}

.tablet-icon-button {
  color:#e5f3ff;
  cursor:pointer;
  touch-action:manipulation;
  background:#13263cf5;
  border:1px solid #718aa655;
  border-radius:.4rem;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:.1rem;
  min-width:2.75rem;
  min-height:2.75rem;
  padding:.35rem;
  display:inline-flex;
  position:relative;
}

:where(:root:not([data-sim-pointer=touch])) .tablet-icon-button:enabled:hover {
  background:#254362;
}

.tablet-icon-button:disabled {
  cursor:default;
  opacity:.42;
}

.tablet-control-label {
  word-break:keep-all;
  text-wrap:balance;
  font-size:.56rem;
  line-height:1;
}

.tablet-unread-badge {
  color:#fff;
  background:#db3349;
  border-radius:999px;
  place-items:center;
  min-width:1.3rem;
  height:1.3rem;
  padding:0 .2rem;
  font-size:.65rem;
  font-weight:800;
  display:grid;
  position:absolute;
  top:-.3rem;
  right:-.25rem;
  box-shadow:0 0 0 2px #102036;
}

.tablet-fullscreen-error {
  z-index:5;
  background:#14263e;
  padding:.5rem;
  font-size:.75rem;
  position:absolute;
  top:100%;
  right:0;
}

.tablet-corner-timing {
  text-align:center;
  font-variant-numeric:tabular-nums;
  color:#c5d3e9;
  gap:.3rem;
  display:grid;
}

.tablet-corner-timing p {
  white-space:nowrap;
  margin:0;
  font-size:.64rem;
  line-height:1.2;
}

.gb-board[data-tablet-compact=true] {
  --compact-sidebar-width:3.25rem;
  grid-template-columns:minmax(0, 1fr) var(--compact-sidebar-width);
}

.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-rail-group {
  width:100%;
  position:relative;
}

.gb-board:not([data-board-arrangement=phone-portrait]) .tablet-rail-group .tablet-game-actions {
  display:contents;
}

.tablet-compact-chain {
  background:#101e32ed;
  border:1px solid #8ca5c845;
  border-radius:.4rem;
  grid-template-columns:3.5rem minmax(0,1fr);
  gap:.45rem;
  min-height:3rem;
  padding:.3rem;
  display:grid;
  position:relative;
  box-shadow:0 4px 14px #02081355;
}

.tablet-compact-chain h3 {
  z-index:1;
  pointer-events:none;
  color:#b7cbe2;
  background:#233a57;
  border:1px solid #8ca5c86b;
  border-radius:.25rem;
  flex-shrink:0;
  justify-content:center;
  align-items:center;
  gap:.35rem;
  min-width:1rem;
  height:1rem;
  padding-inline:.15rem;
  font-size:.64rem;
  font-weight:600;
  line-height:1.2;
  display:flex;
  position:absolute;
  bottom:.5rem;
  left:.5rem;
}

.tablet-compact-chain>[data-chain-art-timeline] {
  grid-column:1/-1;
  height:1.9rem;
}

.tablet-compact-chain>[data-chain-art-timeline] [data-chain-timeline-card] {
  width:2.2rem;
  height:1.6rem;
}

.gb-board[data-tablet-layout=true] .tablet-compact-chain {
  grid-template-columns:2.25rem minmax(0,1fr);
  gap:.3rem;
}

.gb-board[data-tablet-layout=true] .tablet-compact-chain>[data-chain-art-timeline] {
  display:none;
}

.tablet-panel-backdrop {
  z-index:159;
  pointer-events:auto;
  background:#030b1650;
  position:fixed;
  inset:0;
}

.tablet-panel-heading {
  flex-shrink:0;
  justify-content:space-between;
  align-items:center;
  gap:.5rem;
  padding:.3rem;
  font-size:.85rem;
  display:flex;
}

.gb-board[data-board-short=true] .tablet-corner-timing {
  line-height:1;
}

.gb-board[data-tablet-layout=false] [data-player-layer] {
  --hand-left-inset:calc(var(--rune-deck-lane-x) + max(var(--card-width) * 2.39769, var(--card-width) + 7.5rem * var(--desktop-ui-scale,1)));
}

.gb-board[data-tablet-layout=false] [data-player-area=resources] {
  margin-bottom:calc(.1rem + .36rem / var(--desktop-ui-scale,1));
  grid-row:1/span 3;
  align-self:end;
}

.touch-card-menu[data-mode=counters] .tablet-panel-heading {
  display:none;
}

.gb-board[data-tablet-compact=true] [data-board-turn-controls] button {
  min-height:var(--compact-turn-control-height);
}

.gb-board[data-tablet-layout=true][data-board-short=true][data-board-arrangement=standard] [data-board-turn-controls] {
  container-type:inline-size;
}

.gb-board[data-tablet-layout=true][data-board-short=true][data-board-arrangement=standard] [data-board-turn-controls] button {
  min-height:var(--compact-turn-control-height);
  font-size:min(.72rem,9cqw);
  line-height:1.04;
}

.gb-board[data-tablet-layout=true][data-board-short=true][data-board-arrangement=standard] [data-board-turn-controls] button>span {
  font-size:inherit;
  white-space:nowrap;
}

.gb-board[data-tablet-layout=false][data-tablet-compact=true] {
  --compact-ui-scale:max(1, var(--desktop-ui-scale));
  --compact-sidebar-width:calc(3.25rem * var(--compact-ui-scale));
  --board-side-utility-width:min(calc(9.4rem * var(--compact-ui-scale)), calc(var(--battlefield-side-gap) - 1rem));
}

.gb-board[data-tablet-layout=true] {
  --tablet-hand-height:calc(var(--card-height) * var(--tablet-hand-card-scale));
  --tablet-player-band:calc(var(--card-height) + var(--tablet-hand-height) + var(--touch-player-band-padding));
  --tablet-opponent-band:30%;
  --player-band-size:var(--tablet-player-band);
  --battlefield-inset:var(--tablet-player-band);
}

.gb-board[data-tablet-layout=true] {
  --battlefield-token-left:-.5rem;
  --battlefield-token-top:calc(50% - .85rem);
}

.gb-board[data-tablet-layout=true][data-tablet-compact=false] [data-touch-layout=true]>[data-player-area=actions] {
  grid-area:main;
  justify-self:start;
  width:max-content;
  position:relative;
  bottom:auto;
  right:auto;
  transform:translate(calc(-100% - .25rem));
}

.gb-board[data-hand-end-reserved=true][data-tablet-compact=false] [data-player-layer=self]>[data-player-area=hand] {
  padding-right:3.5rem;
}

.gb-board[data-tablet-layout=true][data-tablet-compact=false][data-hand-end-reserved=false] [data-player-layer=self][data-touch-layout=true]>[data-player-area=hand] {
  padding-right:5rem;
}

html[data-sim-keyboard-open=true] .tablet-panel-heading {
  padding:0;
}

html[data-sim-keyboard-open=true] .tablet-panel-heading .tablet-icon-button {
  min-height:2rem;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-player-layer][data-touch-layout=true] {
  grid-template-columns:calc(var(--card-width) + .6rem) minmax(0, 1fr) repeat(2, calc(var(--card-width) + .6rem));
  grid-template-rows:calc(var(--card-height) + .2rem) 2rem calc(var(--tablet-hand-height) + 1rem);
  grid-template-areas:"leftLanes leftLanes legend champion""resources resources resources resources""runeDeck hand main trash";
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true]>[data-player-area=runeDeck],.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true]>[data-player-area=runeDeck]>div {
  display:contents;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true] [data-player-area=resources] {
  grid-area:resources;
  place-self:center start;
  align-items:center;
  gap:.5rem;
  display:flex;
  translate:none;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true] [data-player-area=resources]>div>div {
  align-items:center;
  gap:.25rem;
  display:flex;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true]>[data-player-area=hand] {
  padding-left:.25rem;
}

.touch-card-menu[data-mode=actions] .tablet-panel-heading {
  display:none;
}

.phone-social-control .tablet-icon-button>span:first-child {
  position:relative;
}

.phone-fullscreen-control .tablet-fullscreen-error {
  width:14rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] {
  --phone-toolbar-height:3.9rem;
  --phone-toolbar-start:7.5rem;
  --phone-toolbar-group-gap:.45rem;
  --phone-toolbar-bar-chrome:calc(.25rem + 2px);
  --phone-toolbar-action-extra:.25rem;
  --phone-toolbar-button-width:min(2.5rem, calc(( 100vw - var(--phone-toolbar-start) - .75rem - 3 * var(--phone-toolbar-bar-chrome) - 2 * var(--phone-toolbar-group-gap) - 2 * var(--phone-toolbar-action-extra) ) / 7));
  --phone-toolbar-action-width:calc(var(--phone-toolbar-button-width) + var(--phone-toolbar-action-extra));
  --phone-score-height:3.7rem;
  --phone-nameplate-height:3.7rem;
  --phone-supply-card-height:var(--card-height);
  --phone-supply-card-width:var(--card-width);
  --phone-hero-card-width:calc(var(--phone-supply-card-width) * 1.2);
  --phone-hero-card-height:calc(var(--phone-supply-card-height) * 1.2);
  --phone-zone-row-height:max(var(--phone-hero-card-height), calc(( var(--board-field-height) - 2 * var(--tablet-hand-height) - 2 * var(--phone-score-height) - 1.8rem ) / 6));
  --phone-supply-height:var(--phone-zone-row-height);
  --pile-stack-spread-scale:.14;
  --tablet-player-band:calc(var(--phone-zone-row-height) + var(--tablet-hand-height) + var(--phone-supply-height) + .9rem);
  --battlefield-side-gap:.4rem;
  --battlefield-inset:calc(var(--tablet-player-band) + var(--phone-score-height));
  padding-bottom:var(--phone-toolbar-height);
  grid-template-columns:minmax(0,1fr);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true] {
  grid-template-columns:calc(var(--phone-supply-card-width) + .2rem) max-content repeat(2, var(--phone-hero-card-width)) repeat(2, calc(var(--phone-supply-card-width) + .2rem));
  grid-template-rows:var(--phone-zone-row-height) var(--phone-supply-height) calc(var(--tablet-hand-height) + .55rem);
  grid-template-areas:"leftLanes leftLanes leftLanes leftLanes leftLanes leftLanes""runeDeck resources legend champion main trash""hand hand hand hand hand hand";
  justify-content:space-between;
  gap:.15rem .25rem;
  padding:0;
  left:.35rem;
  right:.35rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=leftLanes] {
  margin-right:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=legend],.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=champion] {
  --card-width:var(--phone-hero-card-width);
  --card-height:var(--phone-hero-card-height);
  place-self:center;
  margin-right:0;
  transform:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer]>[data-player-area=hand] {
  padding:0 .2rem 0 1.9rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] {
  flex-wrap:nowrap;
  justify-self:center;
  gap:.2rem;
  width:max-content;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources]>div>span {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources]>div>div {
  grid-template-columns:1.5rem max-content 1rem 1.5rem;
  justify-content:start;
  gap:.15rem;
  width:max-content;
  font-size:.65rem;
  display:grid;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] button,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] span[aria-hidden=true] {
  width:1.5rem;
  min-width:1.5rem;
  height:1.5rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust] {
  position:relative;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust]:before {
  content:"";
  position:absolute;
  inset:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust][data-resource-adjust$=decrease]:before {
  right:calc(-1px - .4rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust][data-resource-adjust$=increase]:before {
  left:calc(-1px - .4rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust][data-resource-adjust^=energy]:before {
  bottom:calc(-1px - .075rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust][data-resource-adjust^=power]:before {
  top:calc(-1px - .075rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] [data-player-area=resources] [data-resource-adjust]:focus-visible:before {
  content:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-token-quick-bar]>button:where(:root[data-sim-pointer=touch] *):before {
  content:"";
  position:absolute;
  inset:-3px;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-token-quick-bar]>button:where(:root[data-sim-pointer=touch] *):focus-visible:before {
  content:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores],.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores] {
  --tw-translate-x:0px;
  --tw-translate-y:0px;
  --track-node-size:max(1.5rem, calc(var(--phone-supply-card-width) * .44));
  --track-node-winning-size:max(1.85rem, calc(var(--track-node-size) * 1.2333));
  width:auto;
  height:var(--phone-score-height);
  pointer-events:none;
  justify-content:space-between;
  align-items:center;
  gap:0;
  display:flex;
  left:6.2rem;
  right:.3rem;
  transform:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores]>div,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores]>div {
  pointer-events:auto;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores] {
  bottom:var(--tablet-player-band);
  flex-direction:row-reverse;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores] {
  top:var(--tablet-player-band);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores]>div,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores]>div {
  --tw-translate-x:0px;
  --tw-translate-y:0px;
  width:var(--track-node-size);
  flex-shrink:0;
  transform:translate(0);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores]>span,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores]>span {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-room-actions] {
  margin-left:auto;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-next-control] button>span,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-leave-control] button>span {
  gap:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-pile-counter] {
  letter-spacing:0;
  border-radius:.24rem;
  padding:.08rem .2rem;
  font-size:.95rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-phone-rewind-control] [data-forward-control] {
  width:var(--phone-toolbar-button-width);
  top:auto;
  bottom:calc(100% + .35rem);
  right:0;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self]>[data-player-area=actions] {
  left:auto;
  right:0;
  bottom:calc(-1 * var(--phone-toolbar-height) + .45rem);
  width:calc(2 * var(--phone-toolbar-action-width) + var(--phone-toolbar-bar-chrome));
  grid-area:auto;
  position:absolute;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions]>div>div>button {
  width:var(--phone-toolbar-action-width);
  min-width:var(--phone-toolbar-action-width);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=actions] .board-control-label {
  font-size:min(.56rem, calc(var(--phone-toolbar-button-width) * .27));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] {
  left:.3rem;
  right:auto;
  bottom:calc(var(--tablet-player-band) + .15rem);
  width:5.6rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls]>div {
  display:flex;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-phase-status] {
  width:4.8rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-phase-status=self] {
  left:.3rem;
  right:auto;
  bottom:calc(var(--tablet-player-band) + .15rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-phase-status=opponent] {
  left:auto;
  right:.3rem;
  top:calc(var(--tablet-player-band) + .15rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-turn-controls] button {
  min-width:0;
  min-height:var(--phone-nameplate-height);
  flex:1;
  padding:.25rem;
  line-height:1.1;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-compact-chain {
  grid-template-columns:2.25rem minmax(0,1fr);
  gap:.3rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-compact-chain>[data-chain-art-timeline] {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-testid=game-info-hint] {
  left:0;
  right:auto;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-testid=game-info-hint-pointer] {
  left:.9rem;
  right:auto;
}

.touch-card-menu[data-mode=labels] .tablet-panel-heading {
  flex:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] {
  --neeko-phone-gap:.15rem;
  grid-template-columns:calc(var(--phone-supply-card-width) + .2rem) minmax(max-content, 1fr) minmax(0, max-content) var(--phone-hero-card-width) repeat(2, calc(var(--phone-supply-card-width) + .2rem));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends]>[data-player-area=legend] {
  pointer-events:none;
  justify-self:stretch;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-legend-stack {
  flex-direction:row-reverse;
  align-items:center;
  width:100%;
  display:flex;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-starting-legend {
  z-index:4;
  pointer-events:auto;
  flex:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-starting-legend[data-exhausted] {
  margin-left:var(--neeko-overhang);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-borrowed-legend {
  z-index:calc(3 - var(--neeko-legend-index,0));
  flex:0 1 calc(var(--card-width) + var(--neeko-phone-gap));
  pointer-events:auto;
  min-width:1.5rem;
  display:flex;
  position:relative;
  bottom:auto;
  right:auto;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-borrowed-legend[data-exhausted] {
  flex-basis:calc(var(--card-height) + var(--neeko-phone-gap));
  padding-left:var(--neeko-overhang);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .gb-neeko-borrowed-legend>section {
  width:var(--card-width);
  flex:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] [data-player-area=resources] {
  justify-self:center;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] [data-player-area=resources]>.gb-resources-summary {
  width:auto;
  min-width:1.9rem;
  height:auto;
  min-height:2.75rem;
  display:grid;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] [data-player-area=resources]>[data-resources-content] {
  display:none;
}
```

## phone-

**13 rules**

### 1sj2l8ggay34g.css

```css
/* @media (max-width:40rem),(max-width:60rem) and (max-height:32rem) */
[data-testid=simulator-lobby-header][data-phone-menu-open=true]:has([data-staff-tools-expanded=true]) {
  overscroll-behavior:contain;
  max-height:100dvh;
  overflow-y:auto;
}

[data-board-arrangement=phone-portrait] :is([data-board-lines],[data-lines-frame]) {
  --lines-edge:.5rem;
  --ink-corner:1.35rem;
  --ink-pile-corner:1rem;
  --ink-tick:.36rem .9rem;
  --ink-tick-flat:.9rem .36rem;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-short=true] {
  --rail-divider-display:none;
}

.gb-board:not([data-board-arrangement=phone-portrait])[data-board-tight-rail=true] {
  --rail-segment-height:clamp(1.25rem, calc((var(--sim-visible-height,100dvh) - 98px) / 11), 1.75rem);
  --rail-divider-display:block;
}

.gb-board[data-board-arrangement=phone-portrait] [data-pile-count-placement=top-right] {
  top:0;
  right:0;
  translate:0 -25%;
}

.gb-board[data-board-arrangement=phone-portrait] [data-pile-count-placement=top-right] [data-pile-counter] {
  padding:.06rem .26rem;
  font-size:1.02rem;
}

.phone-settings-control {
  top:3rem;
}

.phone-social-control {
  top:4.5rem;
}

.phone-social-control [data-social-badge] {
  top:0;
  right:.5rem;
}

.phone-social-control [data-social-indicator] {
  top:.0625rem;
  left:.5rem;
}

.phone-fullscreen-help {
  inset:calc(env(safe-area-inset-top,0px) + 3.5rem) .75rem auto auto;
  color:#e6efff;
  background:#14263e;
  border:1px solid #496581;
  border-radius:.6rem;
  width:min(18rem,100vw - 1.5rem);
  margin:0;
  padding:.85rem;
  font-size:.85rem;
  line-height:1.5;
  position:fixed;
  box-shadow:0 .5rem 2rem #0008;
}

.phone-fullscreen-help p {
  margin-top:.5rem;
}

.gb-board[data-board-arrangement=phone-portrait] .gb-board-layer[data-neeko-borrowed-legends] [data-player-area=leftLanes] {
  margin-right:var(--base-legend-clearance);
}
```

## sim-

**6 rules**

### 1sj2l8ggay34g.css

```css
.simulator-entry-loading {
  visibility:hidden;
  animation:10s linear simulator-entry-loading-hold;
}

.simulator-entry-recovery {
  opacity:0;
  pointer-events:none;
  visibility:hidden;
}

.simulator-entry-recovery--delayed {
  animation:1ms linear 10s forwards simulator-entry-recovery-reveal;
}

.simulator-entry-recovery--visible {
  opacity:1;
  pointer-events:auto;
  visibility:visible;
}

.sim-game-viewport {
  height:var(--sim-board-height,100dvh);
  min-height:0;
  padding:max(.3rem, env(safe-area-inset-top)) max(.3rem, env(safe-area-inset-right)) max(.3rem, env(safe-area-inset-bottom)) max(.3rem, env(safe-area-inset-left));
}

/* @media (max-width:980px) */
.sim-game-viewport {
  padding:max(.2rem, env(safe-area-inset-top)) max(.2rem, env(safe-area-inset-right)) max(.2rem, env(safe-area-inset-bottom)) max(.2rem, env(safe-area-inset-left));
}
```

## score

**52 rules**

### 1sj2l8ggay34g.css

```css
.scoreTrackHitArea {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-short=true]:not([data-board-arrangement=phone-portrait]) .scoreTrackHitArea {
  z-index:0;
  width:calc(var(--track-node-size) * 1.4);
  aspect-ratio:1;
  pointer-events:auto;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  border-radius:50%;
  display:block;
  position:absolute;
  top:50%;
  left:50%;
  translate:-50% -50%;
}

.scoreTrackNodeConstellation {
  --track-label-size:calc(var(--track-node-size) * .48);
  --track-node-rim:#8eb2d24d;
  --track-node-ring:#96bee41a;
  --track-node-sheen:#8cbae217;
  --track-node-face:#0c213e;
  --track-node-goal:#d6b270;
  isolation:isolate;
  width:var(--track-node-size);
  height:var(--track-node-size);
  border:1px solid var(--track-node-rim);
  background:radial-gradient(circle at 50% 16%, var(--track-node-sheen), transparent 52%), radial-gradient(circle, var(--track-node-face) 0 54%, #091a33 76%, #061228 100%);
  color:#8ea5b9;
  font-size:var(--track-label-size);
  letter-spacing:0;
  filter:none;
  border-radius:50%;
  place-items:center;
  padding:0;
  font-weight:850;
  line-height:1;
  transition:border-color .18s,box-shadow .18s,color .18s,filter .18s,transform .18s;
  display:grid;
  position:relative;
  overflow:hidden;
  box-shadow:inset 0 1px #d6eaff14,inset 0 -.2rem .4rem #01071275,0 .12rem .3rem #0106106b;
}

.scoreTrackNodeConstellation:after {
  z-index:0;
  border:1px solid var(--track-node-ring);
  content:"";
  pointer-events:none;
  border-radius:50%;
  transition:border-color .18s;
  position:absolute;
  inset:12%;
}

.scoreTrackNodeInteractive {
  cursor:pointer;
  -webkit-user-select:none;
  user-select:none;
}

:where(:root:not([data-sim-pointer=touch])) .scoreTrackNodeInteractive:hover {
  --track-node-rim:#b1d5ef6b;
  filter:brightness(1.08);
}

.scoreTrackNodeInteractive:active {
  transform:scale(.97);
}

.scoreTrackNodeInteractive:focus-visible {
  outline-offset:.12rem;
  outline:2px solid #a5daefc2;
}

.scoreTrackNodeWinning {
  --track-label-size:calc(var(--track-node-winning-size) * .46);
  width:var(--track-node-winning-size);
  height:var(--track-node-winning-size);
}

.scoreTrackNodeCore,.scoreTrackNodeArrival,.scoreTrackNodeCharge {
  pointer-events:none;
  position:absolute;
}

.scoreTrackNodeArrival {
  z-index:2;
  border:1.5px solid var(--track-node-accent);
  background:radial-gradient(circle, var(--track-node-accent-soft) 0 18%, var(--track-node-accent) 46%, transparent 72%);
  border-radius:50%;
  inset:8%;
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeArrival {
  background:radial-gradient(circle, var(--track-node-accent-soft) 0 18%, color-mix(in srgb, var(--track-node-accent) 26%, transparent) 46%, transparent 72%);
}

.scoreTrackNodeArrival {
  opacity:0;
}

.scoreTrackNodeCore {
  z-index:1;
  background:radial-gradient(circle at 50% 38%, var(--track-node-accent), var(--track-node-accent-soft) 44%, transparent 76%);
  border-radius:50%;
  inset:16%;
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeCore {
  background:radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--track-node-accent) 38%, transparent), var(--track-node-accent-soft) 44%, transparent 76%);
}

.scoreTrackNodeCore {
  opacity:0;
  transition:opacity .18s;
}

.scoreTrackNodeCharge {
  z-index:3;
  border:1.5px solid var(--track-node-accent);
  background:radial-gradient(circle, transparent 55%, var(--track-node-accent-soft) 100%);
  box-shadow:inset 0 0 .32rem var(--track-node-accent-soft), 0 0 .28rem var(--track-node-accent-soft);
  opacity:0;
  border-radius:50%;
  transition:opacity .18s,transform .22s;
  inset:8.5%;
  transform:scale(.9);
}

.scoreTrackNodeLabel {
  z-index:4;
  width:auto;
  height:auto;
  color:inherit;
  font-variant-numeric:tabular-nums;
  text-box:trim-both cap alphabetic;
  text-shadow:0 1px 2px #000000e0;
  position:relative;
}

.scoreTrackNodeConstellation[data-reached=true] {
  --track-node-rim:var(--track-node-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-reached=true] {
  --track-node-rim:color-mix(in srgb, var(--track-node-accent) 36%, #a6cce93d);
}

.scoreTrackNodeConstellation[data-reached=true] {
  --track-node-ring:var(--track-node-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-reached=true] {
  --track-node-ring:color-mix(in srgb, var(--track-node-accent) 22%, transparent);
}

.scoreTrackNodeConstellation[data-reached=true] {
  --track-node-sheen:#8cbae229;
  --track-node-face:#10284a;
  color:#dcecf4;
}

.scoreTrackNodeConstellation[data-reached=true] .scoreTrackNodeCore {
  opacity:.16;
}

.scoreTrackNodeConstellation[data-winning=true] {
  --track-node-rim:var(--track-node-goal);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-winning=true] {
  --track-node-rim:color-mix(in srgb, var(--track-node-goal) 52%, transparent);
}

.scoreTrackNodeConstellation[data-winning=true] {
  --track-node-ring:var(--track-node-goal);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-winning=true] {
  --track-node-ring:color-mix(in srgb, var(--track-node-goal) 20%, transparent);
}

.scoreTrackNodeConstellation[data-winning=true] {
  color:#b3ab99;
}

.scoreTrackNodeConstellation[data-active=true] {
  color:#fff;
  border-color:var(--track-node-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-active=true] {
  border-color:color-mix(in srgb, var(--track-node-accent) 58%, #dbedff4d);
}

.scoreTrackNodeConstellation[data-active=true] {
  box-shadow:inset 0 0 0 1px var(--track-node-accent), inset 0 -.16rem .38rem #0107125c, 0 0 .34rem var(--track-node-accent-soft);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-active=true] {
  box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--track-node-accent) 16%, transparent), inset 0 -.16rem .38rem #0107125c, 0 0 .34rem var(--track-node-accent-soft);
}

.scoreTrackNodeConstellation[data-active=true] {
  filter:brightness(1.08);
  transform:scale(1.04);
}

.scoreTrackNodeConstellation[data-active=true] .scoreTrackNodeCore {
  opacity:.46;
}

.scoreTrackNodeConstellation[data-active=true] .scoreTrackNodeCharge {
  opacity:1;
  transform:scale(1);
}

.scoreTrackNodeConstellation[data-active=true] .scoreTrackNodeLabel {
  text-shadow:0 1px 2px #000000eb, 0 0 4px var(--track-node-accent-soft);
}

.scoreTrackNodeConstellation[data-winning=true][data-reached=true] {
  --track-node-ring:var(--track-node-goal);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-winning=true][data-reached=true] {
  --track-node-ring:color-mix(in srgb, var(--track-node-goal) 34%, transparent);
}

.scoreTrackNodeConstellation[data-winning=true][data-reached=true] {
  border-color:var(--track-node-goal);
}

/* @supports (color:color-mix(in lab, red, red)) */
.scoreTrackNodeConstellation[data-winning=true][data-reached=true] {
  border-color:color-mix(in srgb, var(--track-node-goal) 86%, transparent);
}

.scoreTrackNodeConstellation[data-winning=true][data-reached=true] {
  color:#f6dca0;
}

.scoreTrackConnectorSurge {
  opacity:0;
  animation:.3s cubic-bezier(.18,.74,.18,1) both scoreTrackConnectorSurge;
}

.scoreTrackConnectorSurgeHalo {
  filter:blur(1.2px)drop-shadow(0 0 .18rem);
}

.scoreTrackConnectorSurgeCore {
  filter:drop-shadow(0 0 .1rem);
}

.scoreTrackArrivalActive {
  animation:.68s cubic-bezier(.16,.84,.2,1) scoreTrackNodeLand;
}

.scoreTrackArrivalActive .scoreTrackNodeArrival {
  animation:.54s cubic-bezier(.18,.8,.2,1) scoreTrackNodePulse;
}

.scoreTrackArrivalActive .scoreTrackNodeCharge {
  animation:.68s cubic-bezier(.16,.82,.2,1) scoreTrackNodeChargeArrival;
}

.scoreTrackArrivalActive .scoreTrackNodeLabel {
  animation:.6s cubic-bezier(.16,.84,.2,1) scoreTrackNodeLabelArrival;
}

/* @media (prefers-reduced-motion:reduce) */
.scoreTrackConnectorSurge,.scoreTrackArrivalActive,.scoreTrackArrivalActive .scoreTrackNodeArrival,.scoreTrackArrivalActive .scoreTrackNodeCharge,.scoreTrackArrivalActive .scoreTrackNodeLabel {
  animation:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .scoreTrackNodeLabel {
  place-items:center;
  padding-top:.08em;
  line-height:1;
  display:grid;
  position:absolute;
  inset:0;
}

:is(.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-player-scores]>div:has(.scoreTrackNodeWinning),.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-board-opponent-scores]>div:has(.scoreTrackNodeWinning)) {
  width:var(--track-node-winning-size);
}
```

## identity

**115 rules**

### 1sj2l8ggay34g.css

```css
.identityRailTurn {
  --identity-rail-clip-ms:.52s;
  --identity-rail-opacity-ms:.52s;
  --identity-rail-side-bleed:.42rem;
  --identity-rail-side-cut:calc(var(--identity-rail-side-bleed) * -1);
  overflow:visible;
}

.identityRailTurn:before {
  content:"";
  inset:.02rem calc(.08rem - var(--identity-rail-side-bleed));
  pointer-events:none;
  filter:blur(.58px);
  opacity:0;
  transition:clip-path var(--identity-rail-clip-ms) cubic-bezier(.22, .78, .2, 1), opacity var(--identity-rail-opacity-ms) ease-out;
  border-radius:.9rem;
  position:absolute;
  -webkit-mask-image:linear-gradient(90deg,#0000 -10%,#00000029 11%,#0000007a 21%,#000 36% 64%,#0000007a 79%,#00000029 89%,#0000 110%);
  mask-image:linear-gradient(90deg,#0000 -10%,#00000029 11%,#0000007a 21%,#000 36% 64%,#0000007a 79%,#00000029 89%,#0000 110%);
}

.identityRailTurn:after {
  content:"";
  inset:-.1rem calc(.04rem - var(--identity-rail-side-bleed));
  pointer-events:none;
  filter:blur(1.12px);
  opacity:0;
  transition:clip-path var(--identity-rail-clip-ms) cubic-bezier(.22, .78, .2, 1), opacity var(--identity-rail-opacity-ms) ease-out;
  border-radius:.9rem;
  position:absolute;
}

.identityRailTurnPlayer:before {
  clip-path:inset(100% var(--identity-rail-side-cut) 0 var(--identity-rail-side-cut) round .96rem);
  background:linear-gradient(#5f92dc00 0% 14%,#679ae205 28%,#83b1ee15 46%,#a5c7f621 70%,#cadffc30 100%),linear-gradient(90deg,#cee3ff00 0%,#cee3ff0e 50%,#cee3ff00 100%);
}

.identityRailTurnOpponent:before {
  clip-path:inset(0 var(--identity-rail-side-cut) 100% var(--identity-rail-side-cut) round .96rem);
  background:linear-gradient(#cadffc30 0%,#a5c7f621 30%,#83b1ee15 54%,#679ae205 72%,#5f92dc00 86% 100%),linear-gradient(90deg,#cee3ff00 0%,#cee3ff0e 50%,#cee3ff00 100%);
}

.identityRailTurnPlayer:after {
  clip-path:inset(100% var(--identity-rail-side-cut) 0 var(--identity-rail-side-cut) round .96rem);
  background:radial-gradient(108% 42% at 50% 100%,#e1f0ff24 0%,#b8d5f812 46%,#8ab8ee06 60%,#7cace900 78%),radial-gradient(74% 20% at 50% 92%,#e8f4ff17 0%,#bad6fb0b 40%,#bad6fb00 72%);
}

.identityRailTurnOpponent:after {
  clip-path:inset(0 var(--identity-rail-side-cut) 100% var(--identity-rail-side-cut) round .96rem);
  background:radial-gradient(108% 42% at 50% 0,#e1f0ff24 0%,#b8d5f812 46%,#8ab8ee06 60%,#7cace900 78%),radial-gradient(74% 20% at 50% 8%,#e8f4ff17 0%,#bad6fb0b 40%,#bad6fb00 72%);
}

.identityRailTurnOn {
  --identity-rail-clip-ms:.52s;
  --identity-rail-opacity-ms:.52s;
}

.identityRailTurnOn:before {
  opacity:.52;
}

.identityRailTurnOn:after {
  opacity:.3;
}

.identityRailTurnOn.identityRailTurnPlayer:before,.identityRailTurnOn.identityRailTurnPlayer:after,.identityRailTurnOn.identityRailTurnOpponent:before,.identityRailTurnOn.identityRailTurnOpponent:after {
  clip-path:inset(0 var(--identity-rail-side-cut) 0 var(--identity-rail-side-cut) round .96rem);
}

.identityRailTurnOff {
  --identity-rail-clip-ms:.52s;
  --identity-rail-opacity-ms:.52s;
}

.identityRailTurnOff:before,.identityRailTurnOff:after {
  opacity:0;
}

.identityRailTurnOff.identityRailTurnPlayer:before,.identityRailTurnOff.identityRailTurnPlayer:after {
  clip-path:inset(100% var(--identity-rail-side-cut) 0 var(--identity-rail-side-cut) round .96rem);
}

.identityRailTurnOff.identityRailTurnOpponent:before,.identityRailTurnOff.identityRailTurnOpponent:after {
  clip-path:inset(0 var(--identity-rail-side-cut) 100% var(--identity-rail-side-cut) round .96rem);
}

/* @media (prefers-reduced-motion:reduce) */
.identityRailTurn:before,.identityRailTurn:after {
  transition-duration:1ms;
}

.identityBadgeTotem {
  --identity-badge-max-size:2rem;
  --identity-frame-padding-bottom:.4rem;
  --identity-frame-padding-top:.9rem;
  --identity-frame-extension:0rem;
  grid-template-rows:minmax(0,1fr);
  gap:.08rem;
  display:grid;
}

.identityBadgeTotem[data-has-timer=true] {
  --identity-frame-extension:.22rem;
  grid-template-rows:minmax(0,1fr) 1.02rem;
}

.identityBadgeTotem>.identityBadgeFrame {
  height:calc(100% + var(--identity-frame-extension));
  padding-top:var(--identity-frame-padding-top);
  padding-bottom:calc(var(--identity-frame-padding-bottom) + var(--identity-frame-extension));
  grid-template-rows:minmax(0,1fr);
}

.identityBadgeTotem>.identityBadgeFrame[data-has-badges=true] {
  grid-template-rows:auto minmax(0,1fr);
}

.identityBadgeTotem [data-identity-badge-row] {
  --identity-badge-gap:.1rem;
  gap:var(--identity-badge-gap);
  min-width:0;
  height:100%;
  min-height:0;
  padding:0;
  container-type:size;
}

.identityBadgeTotem [data-identity-badge-item] {
  --identity-badge-size:min(var(--identity-badge-max-size), 100cqh, calc((100cqw - (var(--identity-badge-count) - 1) * var(--identity-badge-gap)) / var(--identity-badge-count)));
  flex:0 0 var(--identity-badge-size);
  width:var(--identity-badge-size);
  min-width:0;
  height:var(--identity-badge-size);
  min-height:0;
  font-size:min(.75rem, calc(var(--identity-badge-size) * .5));
  justify-content:center;
  align-items:center;
  padding:0;
  line-height:1;
  display:inline-flex;
}

.identityBadgeTotem [data-identity-badge-item]>span,.identityBadgeTotem [data-identity-badge-item] img {
  object-fit:contain;
  width:100%;
  max-width:100%;
  height:100%;
  max-height:100%;
}

.identityBadgeTotem>.identityBadgeClock {
  justify-self:center;
  height:100%;
  min-height:0;
  position:relative;
  bottom:auto;
  left:auto;
  transform:translateY(-.18rem);
}

.identityBadgeFrame {
  --identity-badge-accent:#91bbdb70;
  --identity-badge-accent-soft:#71a1c629;
  --identity-badge-art:linear-gradient(transparent, transparent);
  isolation:isolate;
  border:1px solid var(--identity-badge-accent);
  overflow:hidden;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame {
  border:1px solid color-mix(in srgb, var(--identity-badge-accent) 46%, transparent);
}

.identityBadgeFrame {
  background:var(--identity-badge-art), radial-gradient(ellipse 78% 120% at 50% 50%, var(--identity-badge-accent-soft), transparent 72%), linear-gradient(180deg, #0e1f3cb8, #050f22d1);
  clip-path:polygon(.28rem 0,calc(100% - .28rem) 0,100% .28rem,100% calc(100% - .28rem),calc(100% - .28rem) 100%,.28rem 100%,0 calc(100% - .28rem),0 .28rem);
  border-radius:.18rem;
  transition:border-color .15s,box-shadow .15s,filter .15s;
  box-shadow:inset 0 1px #e0eeff14,inset 0 -1px #01071280,0 .16rem .26rem #02071038;
}

.identityBadgeFrame:before {
  z-index:0;
  background:linear-gradient(112deg, transparent 8%, var(--identity-badge-accent) 34%, transparent 54%), radial-gradient(ellipse 88% 150% at 50% 46%, var(--identity-badge-accent-soft), transparent 68%);
  position:absolute;
  inset:0;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame:before {
  background:linear-gradient(112deg, transparent 8%, color-mix(in srgb, var(--identity-badge-accent) 22%, transparent) 34%, transparent 54%), radial-gradient(ellipse 88% 150% at 50% 46%, color-mix(in srgb, var(--identity-badge-accent-soft) 72%, transparent), transparent 68%);
}

.identityBadgeFrame:before {
  content:"";
  mix-blend-mode:screen;
  opacity:.18;
  pointer-events:none;
  transition:filter .15s,opacity .15s;
}

.identityBadgeFrame:after {
  z-index:1;
  border-top:1px solid var(--identity-badge-accent);
  position:absolute;
  inset:.18rem .34rem;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame:after {
  border-top:1px solid color-mix(in srgb, var(--identity-badge-accent) 42%, transparent);
}

.identityBadgeFrame:after {
  border-bottom:1px solid var(--identity-badge-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame:after {
  border-bottom:1px solid color-mix(in srgb, var(--identity-badge-accent) 28%, transparent);
}

.identityBadgeFrame:after {
  background:linear-gradient(90deg, transparent, var(--identity-badge-accent-soft) 48%, transparent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame:after {
  background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--identity-badge-accent-soft) 46%, transparent) 48%, transparent);
}

.identityBadgeFrame:after {
  content:"";
  opacity:.3;
  pointer-events:none;
  transition:opacity .15s;
}

.identityBadgeFramePlayer {
  --identity-badge-accent:#75e5d06b;
  --identity-badge-accent-soft:#4fb29f26;
}

.identityBadgeFramePlayer:before {
  -webkit-mask-image:linear-gradient(90deg,#000 0 78%,#0000 100%);
  mask-image:linear-gradient(90deg,#000 0 78%,#0000 100%);
}

.identityBadgeFrameOpponent {
  --identity-badge-accent:#e7b97566;
  --identity-badge-accent-soft:#ae753f24;
}

.identityBadgeFrameOpponent:before {
  -webkit-mask-image:linear-gradient(90deg,#0000 0,#000 22% 100%);
  mask-image:linear-gradient(90deg,#0000 0,#000 22% 100%);
}

.identityBadgePopup {
  --identity-badge-accent:#91bbdb70;
  --identity-badge-accent-soft:#71a1c629;
}

.identityBadgePopup[data-identity-popup=player] {
  --identity-badge-accent:#75e5d06b;
  --identity-badge-accent-soft:#4fb29f26;
}

.identityBadgePopup[data-identity-popup=opponent] {
  --identity-badge-accent:#e7b97566;
  --identity-badge-accent-soft:#ae753f24;
}

.identityBadgeFrameCartographer {
  --identity-badge-accent:#c493e280;
  --identity-badge-accent-soft:#9154b52b;
  --identity-badge-art:url(/ui/nameplates/metafy-legend-review.webp) center / 100% 100% no-repeat;
  --identity-nameplate-art-block-inset:-.24rem;
  --identity-nameplate-art-inline-inset:-.46rem;
  border-color:#0000;
}

.identityBadgeFrameAtlasPatron {
  --identity-badge-accent:#ebcc828f;
  --identity-badge-accent-soft:#5d8ee22b;
  --identity-badge-art:url(/ui/nameplates/metafy-signature-legend-review.webp) center / 100% 100% no-repeat;
  --identity-nameplate-art-block-inset:-.34rem;
  --identity-nameplate-art-inline-inset:-.62rem;
  border-color:#0000;
}

.identityBadgePopup.identityBadgeFrameCartographer {
  --identity-badge-accent:#c493e280;
  --identity-badge-accent-soft:#9154b52b;
}

.identityBadgePopup.identityBadgeFrameAtlasPatron {
  --identity-badge-accent:#ebcc828f;
  --identity-badge-accent-soft:#5d8ee22b;
}

.identityBadgeFrame[data-active=true]:before,.identityBadgeFrame:focus-visible:before {
  filter:brightness(1.08);
  opacity:.24;
}

.identityBadgeFrame[data-active=true]:after,.identityBadgeFrame:focus-visible:after {
  opacity:.44;
}

.identityBadgeFrame[data-active=true],.identityBadgeFrame:focus-visible {
  border-color:var(--identity-badge-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeFrame[data-active=true],.identityBadgeFrame:focus-visible {
  border-color:color-mix(in srgb, var(--identity-badge-accent) 72%, #daedff38);
}

.identityBadgeFrame[data-active=true],.identityBadgeFrame:focus-visible {
  box-shadow:inset 0 1px 0 #e6f2ff1a, inset 0 -1px 0 #0107126b, 0 0 .3rem var(--identity-badge-accent-soft);
}

.identityBadgeFrame.identityBadgeFrameCartographer,.identityBadgeFrame.identityBadgeFrameAtlasPatron {
  box-shadow:none;
  clip-path:none;
  background:0 0;
  border:1px solid #0000;
  border-radius:0;
  overflow:visible;
}

.identityBadgeFrame.identityBadgeFrameCartographer:before,.identityBadgeFrame.identityBadgeFrameAtlasPatron:before {
  z-index:0;
  inset:var(--identity-nameplate-art-block-inset) var(--identity-nameplate-art-inline-inset);
  background:var(--identity-badge-art);
  content:"";
  filter:drop-shadow(0 .12rem .2rem #0207114d);
  mix-blend-mode:normal;
  opacity:1;
  pointer-events:none;
  position:absolute;
  -webkit-mask-image:none;
  mask-image:none;
}

.identityBadgeFrame.identityBadgeFrameCartographer:after,.identityBadgeFrame.identityBadgeFrameAtlasPatron:after {
  content:none;
}

.identityBadgeFrame.identityBadgeFrameCartographer[data-active=true],.identityBadgeFrame.identityBadgeFrameAtlasPatron[data-active=true],.identityBadgeFrame.identityBadgeFrameCartographer:focus-visible,.identityBadgeFrame.identityBadgeFrameAtlasPatron:focus-visible {
  box-shadow:none;
  filter:brightness(1.04) drop-shadow(0 0 .22rem var(--identity-badge-accent-soft));
  border-color:#0000;
}

.identityBadgePopup {
  isolation:isolate;
  border:1px solid var(--identity-badge-accent);
  overflow:hidden;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgePopup {
  border:1px solid color-mix(in srgb, var(--identity-badge-accent) 72%, #d6e8f924);
}

.identityBadgePopup {
  background:radial-gradient(ellipse 86% 88% at 50% 0%, var(--identity-badge-accent-soft), transparent 72%), linear-gradient(180deg, #0c192af7, #050d1afa);
  border-radius:.3rem;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgePopup {
  background:radial-gradient(ellipse 86% 88% at 50% 0%, color-mix(in srgb, var(--identity-badge-accent-soft) 30%, transparent), transparent 72%), linear-gradient(180deg, #0c192af7, #050d1afa);
}

.identityBadgePopup {
  -webkit-backdrop-filter:blur(14px);
  backdrop-filter:blur(14px);
  box-shadow:inset 0 1px #e8f3ff12,inset 0 -1px #00040c7a,0 .65rem 1.4rem #02071261;
}

.identityBadgePopupOrnaments {
  z-index:0;
  pointer-events:none;
  position:absolute;
  inset:0;
  overflow:hidden;
}

.identityBadgePopupCorner,.identityBadgePopupNotch {
  background:var(--identity-badge-accent);
  display:block;
  position:absolute;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgePopupCorner,.identityBadgePopupNotch {
  background:color-mix(in srgb, var(--identity-badge-accent) 88%, #e9f5ff61);
}

.identityBadgePopupCorner,.identityBadgePopupNotch {
  opacity:.58;
}

.identityBadgePopupCorner {
  width:1rem;
  height:1rem;
  -webkit-mask:url(/ui/score-track/identity-popup-corner.svg) 50%/contain no-repeat;
  mask:url(/ui/score-track/identity-popup-corner.svg) 50%/contain no-repeat;
}

.identityBadgePopupCornerTopLeft {
  top:.08rem;
  left:.08rem;
}

.identityBadgePopupCornerTopRight {
  top:.08rem;
  right:.08rem;
  transform:rotate(90deg);
}

.identityBadgePopupCornerBottomRight {
  bottom:.08rem;
  right:.08rem;
  transform:rotate(180deg);
}

.identityBadgePopupCornerBottomLeft {
  bottom:.08rem;
  left:.08rem;
  transform:rotate(270deg);
}

.identityBadgePopupNotch {
  opacity:.5;
  width:2.5rem;
  height:.62rem;
  top:-.04rem;
  left:50%;
  transform:translate(-50%);
  -webkit-mask:url(/ui/score-track/identity-popup-notch.svg) 50%/contain no-repeat;
  mask:url(/ui/score-track/identity-popup-notch.svg) 50%/contain no-repeat;
}

.identityBadgePopupCard,.identityBadgePopupActions {
  z-index:1;
  position:relative;
}

.identityBadgePopupActions {
  border-color:var(--identity-badge-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgePopupActions {
  border-color:color-mix(in srgb, var(--identity-badge-accent) 34%, #d6e8f914);
}

.identityBadgePopupActions {
  background:#030a1557;
}

.identityBadgeClock {
  --identity-clock-accent:#91bbdb7a;
  --identity-clock-glow:#71a1c61c;
  z-index:4;
  border:1px solid var(--identity-clock-accent);
  min-width:3.08rem;
  min-height:1.02rem;
  padding:.11rem .4rem .09rem;
  position:absolute;
  bottom:0;
  left:50%;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeClock {
  border:1px solid color-mix(in srgb, var(--identity-clock-accent) 58%, #dcedff33);
}

.identityBadgeClock {
  background:linear-gradient(180deg, var(--identity-clock-accent), #050d19fa);
  border-radius:.3rem;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeClock {
  background:linear-gradient(180deg, color-mix(in srgb, var(--identity-clock-accent) 5%, #0f1d30fa), #050d19fa);
}

.identityBadgeClock {
  box-shadow:0 0 0 1px #020711a8, inset 0 1px 0 #e8f3ff12, inset 0 -1px 0 #00040c94, 0 .16rem .3rem #02071257, 0 0 .2rem var(--identity-clock-glow);
  pointer-events:none;
  transform:translate(-50%,42%);
}

.identityBadgeClock[data-variant=player] {
  --identity-clock-accent:#75e5d085;
  --identity-clock-glow:#4fb29f1f;
}

.identityBadgeClock[data-variant=opponent] {
  --identity-clock-accent:#e7b97580;
  --identity-clock-glow:#ae753f1c;
}

.identityBadgeClock[data-active=true] {
  border-color:var(--identity-clock-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeClock[data-active=true] {
  border-color:color-mix(in srgb, var(--identity-clock-accent) 72%, #ecf7ff38);
}

.identityBadgeClock[data-active=true] {
  box-shadow:0 0 0 1px #020711b3, inset 0 1px 0 var(--identity-clock-accent), inset 0 -1px 0 #00040c99, 0 .16rem .34rem #02071261, 0 0 .26rem var(--identity-clock-glow);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeClock[data-active=true] {
  box-shadow:0 0 0 1px #020711b3, inset 0 1px 0 color-mix(in srgb, var(--identity-clock-accent) 24%, transparent), inset 0 -1px 0 #00040c99, 0 .16rem .34rem #02071261, 0 0 .26rem var(--identity-clock-glow);
}

:is(.identityBadgeClockCartographer,.identityBadgeClockAtlasPatron) {
  background:var(--identity-clock-art) center / 100% 100% no-repeat;
  box-shadow:none;
  background-origin:border-box;
  background-clip:border-box;
  border:1px solid #0000;
  border-radius:0;
}

.identityBadgeClock.identityBadgeClockCartographer {
  --identity-clock-accent:#cc91e194;
  --identity-clock-art:url(/ui/nameplates/metafy-legend-clock.webp);
  --identity-clock-glow:#a162bb33;
  color:#dcc3eb;
}

.identityBadgeClockCartographer svg {
  color:#c795dc;
}

.identityBadgeClock.identityBadgeClockAtlasPatron {
  --identity-clock-accent:#f0cd77a8;
  --identity-clock-art:url(/ui/nameplates/metafy-signature-legend-clock.webp);
  --identity-clock-glow:#4e84e638;
  color:#f2dcaa;
}

.identityBadgeClockAtlasPatron svg {
  color:#73b5ff;
}

:is(.identityBadgeClockCartographer,.identityBadgeClockAtlasPatron)[data-active=true] {
  box-shadow:none;
  filter:brightness(1.06) drop-shadow(0 0 .18rem var(--identity-clock-glow));
  border-color:#0000;
}

.identityBadgeClockCartographer[data-active=true] {
  color:#f1ddfb;
}

.identityBadgeClockAtlasPatron[data-active=true] {
  color:#fff0c7;
}

.identityBadgeClockCompact {
  border-radius:.22rem;
  flex:none;
  min-width:2.72rem;
  min-height:.84rem;
  padding:.08rem .28rem .07rem;
  font-size:.54rem;
  position:relative;
  bottom:auto;
  left:auto;
  transform:none;
}

.identityBadgeMutedCorner {
  clip-path:polygon(.28rem 0,100% 0,100% 100%,0 100%,0 .28rem);
  border-bottom:1px solid var(--identity-badge-accent);
  width:1.18rem;
  height:1.02rem;
  padding:.16rem .16rem 0 0;
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeMutedCorner {
  border-bottom:1px solid color-mix(in srgb, var(--identity-badge-accent) 52%, transparent);
}

.identityBadgeMutedCorner {
  border-left:1px solid var(--identity-badge-accent);
}

/* @supports (color:color-mix(in lab, red, red)) */
.identityBadgeMutedCorner {
  border-left:1px solid color-mix(in srgb, var(--identity-badge-accent) 52%, transparent);
}

.identityBadgeMutedCorner {
  filter:drop-shadow(0 1px 2px #030812cc);
  pointer-events:none;
  background:linear-gradient(145deg,#0309124d,#030912e0);
}

.gb-board[data-tablet-layout=true] [data-player-identity-rail] {
  transform:translateZ(0);
}

.gb-board[data-player-identity-placement=raised] {
  --track-player-bottom:calc(var(--tablet-player-band) + var(--identity-badge-height) + var(--identity-track-gap));
}

.gb-board[data-player-identity-placement=raised] [data-player-identity-rail=self] {
  bottom:var(--tablet-player-band);
}

.gb-board[data-player-identity-placement=raised] [data-player-layer=self][data-touch-layout=true] {
  left:.5rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityRailTurn {
  display:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-identity-rail] {
  --identity-badge-width:5.6rem;
  --identity-badge-height:var(--phone-nameplate-height);
  --identity-rail-width:5.6rem;
  --track-node-size:max(1.5rem, calc(var(--phone-supply-card-width) * .44));
  left:.3rem;
  right:auto;
  transform:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-identity-rail=self] {
  bottom:calc(-1 * var(--phone-toolbar-height) + .25rem);
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-identity-player-name]>span {
  font-size:.75rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityBadgeTotem {
  --identity-badge-max-size:1.25rem;
  --identity-frame-padding-bottom:.25rem;
  --identity-frame-padding-top:.55rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityBadgeTotem[data-has-timer=true] {
  grid-template-rows:minmax(0,1fr) .8rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityBadgeFrame {
  padding:var(--identity-frame-padding-top) .2rem calc(var(--identity-frame-padding-bottom) + var(--identity-frame-extension));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityBadgeClock {
  border-radius:.22rem;
  gap:.15rem;
  min-width:2.25rem;
  min-height:.8rem;
  padding:.04rem .2rem;
  font-size:.6rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .identityBadgeClock svg {
  width:.55rem;
  height:.55rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-identity-rail=opponent] {
  --identity-badge-opponent-nudge:0rem;
  --identity-badge-width:5.6rem;
  top:calc(var(--tablet-player-band) + .1rem);
}
```

## turn

**5 rules**

### 1sj2l8ggay34g.css

```css
.gb-turn-glass {
  -webkit-backdrop-filter:blur(10px)saturate(1.3)brightness(.9);
  backdrop-filter:blur(10px)saturate(1.3)brightness(.9);
  background:linear-gradient(160deg,#e8f6ff24,#b2d1f60a 50%,#060f1c38);
  border:1px solid #dcecff38;
  border-radius:.2rem;
  box-shadow:inset 0 1px 1px #ffffff4d,inset 0 -1px 2px #0000002e,inset 0 0 18px #ffffff0f,0 6px 16px #00000038;
}

.gb-turn-glass:before,.gb-turn-glass:after {
  content:none;
}

.gb-turn-glass:enabled:hover {
  background:linear-gradient(160deg,#e8f6ff33,#b2d1f612 50%,#060f1c33);
  border-color:#e4f2ff57;
}

.gb-turn-glass:disabled {
  background:linear-gradient(160deg,#e8f6ff0f,#b2d1f605 50%,#060f1c42);
  border-color:#dcecff1f;
  box-shadow:inset 0 1px 1px #ffffff1f,0 4px 12px #0000002e;
}

/* @media (prefers-reduced-transparency:reduce) */
.gb-turn-glass {
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
  background:#080f1ce0;
}
```

## chat

**3 rules**

### 1sj2l8ggay34g.css

```css
.tablet-log-panel,.tablet-chat-panel {
  min-height:0;
  display:grid;
}

.tablet-log-panel[hidden],.tablet-chat-panel[hidden] {
  display:none;
}

/* @media (pointer:coarse) */
[data-testid=chat-composer-input] :is(textarea,pre) {
  font-size:16px;
}
```

## card-

**132 rules**

### 1sj2l8ggay34g.css

```css
/* @layer components */
.gb-card-action-button {
  --gb-card-action-icon:#c7d8e9;
  --gb-card-action-icon-hover:#f4fbff;
  --gb-card-action-rim:#9ec2de94;
  --gb-card-action-rim-hover:#c5e7f6eb;
  --gb-card-action-halo:#4dbbe057;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #3b5e7bfc 0%, #1b3753fc 44%, #081627 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #4b7797 0%, #1f4565 46%, #081c31 100%);
  isolation:isolate;
  color:var(--gb-card-action-icon);
  filter:drop-shadow(0 .26rem .34rem #02081380);
  background:0 0;
  border:0;
  border-radius:999px;
  transition:color .15s ease-out,filter .15s ease-out,opacity .12s ease-out;
}

/* @layer components */
.gb-card-action-button:before {
  content:"";
  pointer-events:none;
  z-index:0;
  border-radius:inherit;
  background:var(--gb-card-action-surface);
  box-shadow:inset 0 0 0 1px var(--gb-card-action-rim), inset 0 1px 0 #eff8ff3d, inset 0 -2px 5px #0108128f, 0 5px 12px #02091494;
  transition:background .15s ease-out,box-shadow .15s ease-out;
  position:absolute;
  inset:0;
}

/* @layer components */
.gb-card-action-button>:not(.gb-action-hover-label) {
  z-index:2;
  position:relative;
}

/* @layer components */
:where(:root:not([data-sim-pointer=touch])) .gb-card-action-button:not(:disabled):hover,.gb-card-action-button:focus-visible {
  color:var(--gb-card-action-icon-hover);
  filter:drop-shadow(0 0 .38rem var(--gb-card-action-halo)) drop-shadow(0 .34rem .4rem #02081394);
}

/* @layer components */
:where(:root:not([data-sim-pointer=touch])) .gb-card-action-button:not(:disabled):hover:before,.gb-card-action-button:focus-visible:before {
  background:var(--gb-card-action-surface-hover);
  box-shadow:inset 0 0 0 1px var(--gb-card-action-rim-hover), inset 0 1px 0 #f4fbff57, inset 0 -2px 5px #01081280, 0 0 0 2px var(--gb-card-action-halo), 0 0 13px var(--gb-card-action-halo), 0 6px 13px #020914a3;
}

/* @layer components > @supports (color:color-mix(in lab, red, red)) */
:where(:root:not([data-sim-pointer=touch])) .gb-card-action-button:not(:disabled):hover:before,.gb-card-action-button:focus-visible:before {
  box-shadow:inset 0 0 0 1px var(--gb-card-action-rim-hover), inset 0 1px 0 #f4fbff57, inset 0 -2px 5px #01081280, 0 0 0 2px color-mix(in srgb, var(--gb-card-action-halo) 48%, transparent), 0 0 13px var(--gb-card-action-halo), 0 6px 13px #020914a3;
}

/* @layer components */
.gb-card-action-button:focus-visible {
  opacity:1;
  pointer-events:auto;
  outline:none;
}

/* @layer components */
.gb-card-action-button:disabled {
  cursor:not-allowed;
  color:#8496aa;
  filter:saturate(.42)brightness(.72)drop-shadow(0 .2rem .28rem #0208136b);
}

/* @layer components */
.gb-card-action-button--danger {
  --gb-card-action-icon:#e9bcc7;
  --gb-card-action-icon-hover:#fff2f5;
  --gb-card-action-rim:#d3899c9e;
  --gb-card-action-rim-hover:#fab8c7e6;
  --gb-card-action-halo:#e0446a61;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #703a4dfc 0%, #442131fc 48%, #1e101a 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #8b4156 0%, #542336 50%, #27111d 100%);
}

/* @layer components */
.gb-card-action-button--resource {
  --gb-card-action-icon:#ead9ac;
  --gb-card-action-icon-hover:#fff5d5;
  --gb-card-action-rim:#d5b87099;
  --gb-card-action-rim-hover:#f7dc97eb;
  --gb-card-action-halo:#dea83657;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #675328fc 0%, #3e3018fc 48%, #1c150d 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #7f652d 0%, #4e3c19 50%, #231a0d 100%);
}

/* @layer components */
.gb-card-action-button--positive {
  --gb-card-action-icon:#c5ead8;
  --gb-card-action-icon-hover:#effff7;
  --gb-card-action-rim:#84ccaa99;
  --gb-card-action-rim-hover:#b1efd2eb;
  --gb-card-action-halo:#48c48b57;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #346950fc 0%, #1b4132fc 48%, #0b1e18 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #3e8260 0%, #1f523c 50%, #0c261c 100%);
}

/* @layer components */
.gb-card-action-button--active {
  --gb-card-action-icon:#d9f5ff;
  --gb-card-action-icon-hover:#f5fdff;
  --gb-card-action-rim:#70cfedbd;
  --gb-card-action-rim-hover:#b7effff5;
  --gb-card-action-halo:#37c0e46b;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #2f748e 0%, #134963 48%, #072030 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #3b8faa 0%, #165b77 50%, #07283a 100%);
  filter:drop-shadow(0 0 .28rem var(--gb-card-action-halo)) drop-shadow(0 .26rem .34rem #02081380);
}

/* @layer components */
.gb-card-action-button--time-warp {
  --gb-card-action-icon:#e4faf4;
  --gb-card-action-icon-hover:#f4fffb;
  --gb-card-action-rim:#9cecdccc;
  --gb-card-action-rim-hover:#c8f5e9f5;
  --gb-card-action-halo:#51ceb66b;
  --gb-card-action-surface:radial-gradient(circle at 32% 24%, #347a72 0%, #1b4f4f 48%, #0a252c 100%);
  --gb-card-action-surface-hover:radial-gradient(circle at 32% 24%, #409287 0%, #205f5d 50%, #0b2c33 100%);
  filter:drop-shadow(0 0 .28rem var(--gb-card-action-halo)) drop-shadow(0 .26rem .34rem #02081380);
}

/* @layer components > @media (prefers-reduced-motion:reduce) */
.gb-card-action-button,.gb-card-action-button:before {
  transition-duration:1ms;
}

/* @layer utilities */
.text-\(length\:--card-action-hover-detail-size\) {
  font-size:var(--card-action-hover-detail-size);
}

/* @layer utilities */
.text-\(length\:--card-action-hover-label-size\) {
  font-size:var(--card-action-hover-label-size);
}

/* @layer utilities */
.text-\(length\:--card-body-size\) {
  font-size:var(--card-body-size);
}

/* @layer utilities */
.text-\(length\:--card-counter-control-font-size\) {
  font-size:var(--card-counter-control-font-size);
}

/* @layer utilities */
.text-\(length\:--card-counter-font-size\) {
  font-size:var(--card-counter-font-size);
}

/* @layer utilities */
.text-\(length\:--card-label-chip-font-size\) {
  font-size:var(--card-label-chip-font-size);
}

/* @layer utilities */
.gb-card-back-gradient {
  background:linear-gradient(145deg,#3a567b,#2a425f);
}

/* @layer utilities */
.\[\&_small\]\:text-\(length\:--card-battlefield-body-size\) small {
  font-size:var(--card-battlefield-body-size);
}

/* @layer utilities */
.\[\&_small\]\:text-\(length\:--card-body-size\) small {
  font-size:var(--card-body-size);
}

/* @layer utilities */
.\[\&_strong\]\:text-\(length\:--card-battlefield-title-size\) strong {
  font-size:var(--card-battlefield-title-size);
}

/* @layer utilities */
.\[\&_strong\]\:text-\(length\:--card-title-size\) strong {
  font-size:var(--card-title-size);
}

/* @layer utilities */
.gb-card-action-hover-scope[data-card-action-hover-active=true] .\[\.gb-card-action-hover-scope\[data-card-action-hover-active\=true\]_\&\]\:opacity-100 {
  opacity:1;
}

.gb-card-action-hover-scope[data-card-action-hover-active=true] .group\/action {
  opacity:1;
  pointer-events:auto;
}

.gb-card-action-hover-scope:has(:focus-visible) .group\/action {
  opacity:1;
  pointer-events:auto;
}

:root[data-sim-pointer=touch] .gb-card-action-hover-scope:not(:has(:focus-visible)) .group\/action {
  opacity:0!important;
  pointer-events:none!important;
}

.gb-card-action-hover-scope[data-card-action-hover-active=true] .touch-card-drag-handle {
  display:none;
}

/* @starting-style */
.gb-card-face[data-card-face-initial] {
  transform:rotateY(var(--card-face-initial-rotation))!important;
}

/* @starting-style */
.gb-card-face[data-card-face-initial]>[data-card-face=front] {
  visibility:var(--card-front-initial-visibility)!important;
}

/* @starting-style */
.gb-card-face[data-card-face-initial]>[data-card-face=back] {
  visibility:var(--card-back-initial-visibility)!important;
}

[data-card-counter-single=true] {
  width:var(--card-counter-slot-width);
}

[data-card-counter-paired=true] {
  width:max-content;
  display:flex;
}

[data-card-counter-paired=true]>div {
  width:auto;
  min-width:var(--card-counter-min-width);
  display:flex;
  position:relative;
  inset:auto;
  translate:none;
}

[data-card-counter-paired=true]>div>:last-child {
  width:100%;
  position:relative;
  left:auto;
  translate:none;
}

[data-card-counter-paired=true]>div:first-child>:last-child {
  border-right-width:0;
  border-top-right-radius:0;
  border-bottom-right-radius:0;
}

[data-card-counter-paired=true]>div:last-child>:last-child {
  border-top-left-radius:0;
  border-bottom-left-radius:0;
}

[data-card-counter-frame] {
  --card-counter-bottom:calc(var(--card-counter-height) * -1 * (1 / 3 + var(--card-counter-progress) * 4 / 15) * var(--card-counter-density-scale,1));
  height:calc(var(--card-height) * (1 - var(--card-counter-progress)) + var(--card-width) * var(--card-counter-progress));
  transform:rotate(calc(-1 * var(--card-counter-angle) - var(--card-counter-player-rotation,0deg) - var(--card-counter-drag-roll,0deg)));
}

[data-card-counter-frame]>div {
  --card-counter-visible-width:calc(var(--card-width) * (1 - var(--card-counter-progress)) + var(--card-height) * var(--card-counter-progress));
  --card-counter-previous-width:calc(var(--card-width) * (1 - var(--card-counter-previous-exhausted,0)) + var(--card-height) * var(--card-counter-previous-exhausted,0));
  --card-counter-row-half:calc(50% * var(--card-counter-density-scale,1));
  --card-counter-on-card-shift:max(0px, var(--card-counter-visible-width) / 2 - 50% * var(--card-counter-density-scale,1));
  --card-counter-free-shift:max(-1 * var(--card-counter-on-card-shift), min(max(0px, (var(--card-counter-visible-width) + var(--card-counter-previous-width)) / 4 - var(--card-counter-stack-step,100rem) / 2), var(--card-counter-on-card-shift), var(--card-counter-attached-limit,100rem) - .15rem - var(--card-counter-row-half)));
  --card-counter-gear-shift:max(0px, var(--card-counter-visible-width) / 2 - var(--card-counter-row-half));
  translate:calc(-50% + var(--card-counter-stack-direction,1) * ( var(--card-counter-attached-gear,0) * var(--card-counter-gear-shift) + (1 - var(--card-counter-attached-gear,0)) * var(--card-counter-free-shift) ));
  scale:var(--card-counter-density-scale,1);
  transform-origin:bottom;
}

[data-card-counter-frame]>[data-card-counter-single] {
  --card-counter-row-half:calc(var(--card-counter-slot-width) / 2 * var(--card-counter-density-scale,1));
}

.card-pose-rotation {
  transition-property:transform;
}

.card-pose-rotation:has(.card-banish-frame,[data-card-counter-frame]:not(:empty)) {
  transition-property:--card-pose-rotation;
}

body:has(.gb-card-list-body:not([hidden] *))>[data-banished-pile-button] {
  visibility:hidden;
}

.gb-deck-peek .gb-card-list-grid {
  grid-template-columns:repeat(auto-fill, minmax(min(100%, calc(var(--card-peek-width) * .91)), 1fr));
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-body {
  gap:.5rem;
  padding:.5rem;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-header button {
  min-width:2.75rem;
  min-height:2.75rem;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-header {
  grid-template-columns:auto minmax(0,1fr) auto auto auto;
  gap:.25rem;
  display:grid;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-heading,.gb-deck-peek .gb-card-list-heading-details,.gb-deck-peek .gb-card-list-tools {
  display:contents;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-info {
  grid-area:1/3;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-count {
  grid-area:1/4;
  margin:0;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-close {
  grid-area:1/5;
  place-items:center;
  width:2.75rem;
  height:2.75rem;
  padding:0;
  display:grid;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-close>span {
  display:none;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-close-icon {
  display:block;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-title-actions {
  flex-wrap:nowrap;
  grid-area:2/1/3/4;
  margin:0;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-header-actions {
  grid-area:2/4/3/6;
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-info [role=tooltip] {
  position:fixed;
  top:3.5rem;
  left:50%;
  transform:translate(-50%);
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-card-list-grid {
  gap:.4rem;
  padding-right:0;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-card-list-count {
  padding:.25rem;
  font-size:.625rem;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-card-list-header button {
  font-size:.6875rem;
}

/* @media (max-width:600px) */
.gb-deck-peek [data-card-selection-control] {
  grid-template-columns:1fr;
  place-items:center;
  width:2rem;
  min-width:2rem;
  height:2rem;
  min-height:2rem;
  padding:0;
  display:grid;
  top:.25rem;
  left:.25rem;
  translate:none;
}

/* @media (max-width:600px) */
.gb-deck-peek [data-card-selection-control]>span:last-child {
  display:none;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-card-list-footer>div {
  gap:.25rem;
  padding:.25rem;
}

.gb-deck-peek .gb-card-list-info>button,.gb-deck-peek .gb-card-list-close,.gb-deck-peek [data-collapse-to-board] {
  box-shadow:none;
  background:0 0;
  border-color:#0000;
  border-radius:.25rem;
}

:where(:root:not([data-sim-pointer=touch])) .gb-deck-peek .gb-card-list-info>button:hover,:where(:root:not([data-sim-pointer=touch])) .gb-deck-peek .gb-card-list-close:hover,:where(:root:not([data-sim-pointer=touch])) .gb-deck-peek [data-collapse-to-board]:hover {
  background:#aecffe12;
}

.gb-deck-peek .gb-card-list-count {
  color:#a9bfd4;
  background:0 0;
  border:0;
  padding-inline:.25rem;
}

/* @media (min-width:700px) and (max-width:1100px) */
.gb-deck-peek .gb-card-list-header {
  display:flex;
}

/* @media (min-width:700px) and (max-width:1100px) */
.gb-deck-peek .gb-card-list-header h3 {
  margin-right:auto;
}

/* @media (min-width:700px) and (max-width:1100px) */
.gb-deck-peek .gb-card-list-title-actions {
  margin-inline:.5rem;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-card-list-title-actions {
  gap:.25rem;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-card-list-title-actions>button {
  padding-inline:.5rem;
}

.gb-deck-peek [data-card-action-strip] {
  visibility:hidden;
}

.gb-deck-peek .gb-card-action-hover-scope[data-card-action-hover-active=true] [data-card-action-strip],.gb-deck-peek .gb-card-action-hover-scope:focus-visible [data-card-action-strip],.gb-deck-peek [data-card-action-strip]:focus-within {
  visibility:visible;
}

:where(:root[data-sim-pointer=touch]) .gb-deck-peek .gb-card-list-footer button {
  min-height:2.75rem;
}

/* @media (max-width:600px),(max-height:500px) and (max-width:1100px) */
.gb-deck-peek [data-card-action-strip] {
  display:none;
}

.card-tag-row {
  pointer-events:none;
  outline:none;
}

.card-tag-row[data-hovered=true],.card-tag-row:focus-within {
  z-index:150;
}

.card-tag-controls {
  opacity:0;
  pointer-events:none;
  border:1px solid;
  border-radius:2px;
  margin-left:1px;
  padding:1px 2px;
  transition:opacity .12s;
  display:flex;
  position:absolute;
  top:50%;
  left:100%;
  transform:translateY(-50%)skew(-8deg);
  box-shadow:0 2px 5px #0005;
}

.card-tag-row[data-hovered=true] .card-tag-controls,.card-tag-row:focus-within .card-tag-controls {
  opacity:1;
  pointer-events:auto;
}

.card-tag-control {
  width:22px;
  height:22px;
  color:inherit;
  opacity:.8;
  background:0 0;
  border-radius:1px;
  justify-content:center;
  align-items:center;
  display:inline-flex;
  transform:skew(8deg);
}

.card-tag-control:hover,.card-tag-control:focus-visible {
  opacity:1;
  background:#ffffff20;
}

.card-tag-control:disabled {
  opacity:.35;
}

.card-keyword-tag {
  text-transform:uppercase;
  letter-spacing:.045em;
  text-shadow:0 1px 1px #0007;
  border-style:solid;
  border-width:1px;
  border-radius:2px;
  font-style:italic;
  font-weight:900;
  transform:skew(-8deg);
  box-shadow:inset 0 1px #ffffff32,inset 0 -1px #0003,0 3px 7px #0005;
}

.card-keyword-tag>span,.card-keyword-tag>b {
  transform:skew(8deg);
}

.card-keyword-count {
  font-variant-numeric:tabular-nums;
  background:#ffffff26;
  border-radius:2px;
  margin-left:.4em;
  padding:0 .25em;
  font-style:normal;
}

.card-tag-picker {
  background:linear-gradient(155deg,#20364a,#111d2c 75%);
  border:1px solid #8fb3d44d;
  border-radius:16px;
  width:min(360px,100vw - 24px);
  max-height:calc(100dvh - 24px);
  padding:16px;
  overflow-y:auto;
  box-shadow:0 20px 60px #0009,inset 0 1px #ffffff15;
}

.card-tag-picker-option {
  background:#08132055;
  border:1px solid #90acc521;
  border-radius:7px;
  justify-content:flex-start;
  align-items:center;
  min-width:0;
  min-height:44px;
  padding:5px 23px 5px 7px;
  transition:border-color .14s,background .14s;
  display:flex;
  position:relative;
}

.card-tag-picker-option:hover,.card-tag-picker-option[aria-pressed=true] {
  background:#41617c66;
  border-color:#b4d7ee99;
}

.card-tag-picker-option .card-keyword-tag {
  box-shadow:none;
  letter-spacing:0;
  border:none;
  align-items:center;
  gap:4px;
  padding:2px 0;
  font-size:11px;
  display:inline-flex;
}

.card-type-tag,.card-copy-tag {
  font-size:clamp(9px, calc(var(--card-width) * .12), 12px);
  padding:3px 5px;
  line-height:1.3;
  left:50%;
  right:auto;
  transform:translate(-50%,-50%);
}

.card-type-tag[data-paired] {
  left:0;
  transform:translateY(-50%);
}

.card-copy-tag[data-paired] {
  left:auto;
  right:0;
  transform:translateY(-50%);
}

.card-unit-tag {
  --unit-tag-portrait-size:calc(1.3em + 10px);
  left:calc(50% + var(--unit-tag-portrait-size) / 4);
  padding-left:calc(var(--unit-tag-portrait-size) / 2 + .3em);
}

.card-unit-tag-portrait {
  width:var(--unit-tag-portrait-size);
  height:var(--unit-tag-portrait-size);
  background:#162033;
  border-radius:999px;
  position:absolute;
  top:50%;
  left:-1px;
  overflow:hidden;
  transform:translate(-50%,-50%);
  box-shadow:0 0 0 1.5px #e0f2fed9,0 2px 5px #00000080;
}

.card-keyword-tag-long {
  font-size:calc(var(--card-label-chip-font-size) * .85);
  letter-spacing:0;
}

.card-keyword-tag-icon {
  gap:1px;
  position:relative;
  overflow:visible;
}

.card-label-icon {
  flex:none;
}

.gb-board [data-card-label-stack] {
  --card-label-stack-top:min(1.48rem, calc(var(--card-width) * .285));
}

.gb-board [data-card-label-stack]:has(>:nth-child(3)) {
  --card-label-chip-fit-height:min(var(--card-label-chip-height), calc(( var(--card-height) - var(--card-label-stack-top) - 2 * var(--card-label-stack-gap) - .2rem ) / 3));
}

.gb-board [data-card-label-stack]:has(>:nth-child(4)) {
  --card-label-chip-fit-height:min(var(--card-label-chip-height), calc(( var(--card-height) - var(--card-label-stack-top) - 3 * var(--card-label-stack-gap) - .2rem ) / 4));
}

.gb-board [data-card-label-stack] .card-label-icon {
  width:min(18px, calc(var(--card-label-chip-fit-height,var(--card-label-chip-height)) - .2rem));
  height:min(18px, calc(var(--card-label-chip-fit-height,var(--card-label-chip-height)) - .2rem));
}

.card-tag-name {
  white-space:nowrap;
  opacity:0;
  visibility:hidden;
  background:#101e30;
  border:1px solid;
  border-radius:3px;
  padding:5px 7px;
  font-size:11px;
  transition:opacity .12s;
  position:absolute;
  bottom:calc(100% + 5px);
  left:-1px;
  box-shadow:0 3px 10px #0009;
}

.card-tag-row[data-hovered=true] .card-tag-name,.card-tag-row:focus-within .card-tag-name {
  opacity:1;
  visibility:visible;
}

.card-tag-hotkey {
  color:#b7cbdc;
  background:#0a172466;
  border:1px solid #9cbbd333;
  border-radius:3px;
  place-items:center;
  width:16px;
  height:19px;
  font:10px ui-monospace,monospace;
  display:grid;
  position:absolute;
  top:50%;
  right:5px;
  transform:translateY(-50%);
}

.card-tag-picker-custom {
  color:#c8d9e8;
  font-size:11px;
  font-weight:600;
}

:root[data-sim-pointer=touch] .card-tag-controls,:root[data-sim-pointer=touch] [data-touch-has-label-editor] .card-tag-name {
  display:none;
}

[data-labels-suspended] .card-tag-row,[data-labels-suspended] .card-tag-controls {
  pointer-events:none;
}

.gb-card-art-crop {
  object-fit:cover;
  object-position:top;
  transform-origin:0 0;
  transform:translate(calc((.5 - var(--art-crop-zoom) * var(--art-crop-x)) * 100%), calc((.5 - var(--art-crop-zoom) * var(--art-crop-y) * 1.397) * 100%)) scale(var(--art-crop-zoom));
}

.gb-neeko-starting-legend[data-exhausted]:has([data-card-label-stack])>.gb-neeko-legends-control {
  --neeko-control-edge-inset:-2px;
}

.gb-neeko-starting-legend:has([data-legend-xp-overlay],[data-card-copy-tag],.card-type-tag)>.gb-neeko-legends-control {
  bottom:calc(100% + 2px);
}

.card-banish-frame {
  z-index:45;
  width:calc(100% + (var(--card-height,0px) - var(--card-width,0px)) * var(--banish-frame-progress));
  height:calc(100% - (var(--card-height,0px) - var(--card-width,0px)) * var(--banish-frame-progress));
  translate:-50% -50%;
  rotate:calc(-1 * var(--banish-frame-angle) - var(--card-counter-player-rotation,0deg) - var(--card-counter-drag-roll,0deg));
  pointer-events:none;
  position:absolute;
  top:50%;
  left:50%;
}

.card-banish-links {
  --banish-link-size:clamp(20px, calc(var(--card-width,64px) * .34), 38px);
  top:calc(3px - var(--banish-link-size));
  left:calc(100% - var(--banish-link-size) * .55);
  pointer-events:auto;
  display:flex;
  position:absolute;
}

[data-touch-card-surface]:has(.card-copy-tag[data-paired])>.card-banish-frame>.card-banish-links {
  left:calc(100% + 2px);
}

.card-banish-links[data-floating] {
  z-index:2147483000;
  animation:.16s cubic-bezier(.22,1,.36,1) banish-links-lift;
  position:fixed;
  translate:0 -100%;
}

.card-banish-links[data-floating]:before {
  content:"";
  inset:-2px -2px calc(var(--banish-link-size) * -.4) -2px;
  position:absolute;
}

.card-banish-links[data-lifted] {
  z-index:9;
  position:absolute;
}

.card-banish-frame[data-returning]>.card-banish-links,.card-banish-links[data-lifted][data-returning] {
  animation:.16s cubic-bezier(.22,1,.36,1) banish-links-step-back;
}

/* @media (prefers-reduced-motion:reduce) */
.card-banish-links {
  animation:none!important;
}

.card-banish-thumbnail {
  width:var(--banish-link-size);
  height:var(--banish-link-size);
  border-radius:50%;
  flex:none;
  transition:margin-right .14s ease-out;
  position:relative;
}

.card-banish-more>button {
  color:#f3d79d;
  font-size:calc(var(--banish-link-size) * .36);
  place-items:center;
  font-weight:800;
  line-height:1;
  display:grid;
}

[data-touch-card-surface]:has([data-visual-dragging=true])>.card-banish-frame {
  visibility:hidden;
}

.card-banish-thumbnail[data-arriving] {
  opacity:0;
  pointer-events:none;
}

.card-banish-thumbnail[data-leaving] {
  pointer-events:none;
  animation:.22s ease-in forwards banish-link-leave;
}

/* @media (prefers-reduced-motion:reduce) */
.card-banish-thumbnail[data-leaving] {
  opacity:0;
  animation:none;
}

.card-banish-thumbnail+.card-banish-thumbnail {
  margin-left:calc(var(--banish-link-size) * -.38);
}

.card-banish-links:hover .card-banish-thumbnail+.card-banish-thumbnail,.card-banish-links[data-floating] .card-banish-thumbnail+.card-banish-thumbnail {
  margin-left:4px;
}

.card-banish-thumbnail>button,.card-banish-thumbnail>.card-banish-ghost {
  cursor:pointer;
  background:#211827;
  border-radius:50%;
  transition:box-shadow .12s;
  position:absolute;
  inset:0;
  overflow:hidden;
  box-shadow:0 0 0 1.5px #c8a66a,0 0 0 3px #10182a,0 3px 8px #000a;
}

.card-banish-thumbnail>button:hover,.card-banish-thumbnail>button:focus-visible {
  outline:none;
  box-shadow:0 0 0 1.5px #f3d79d,0 0 0 3px #10182a,0 3px 8px #000a;
}

.card-banish-portrait {
  border-radius:inherit;
  position:absolute;
  inset:0;
  overflow:hidden;
}

.card-banish-top-action {
  z-index:50;
  opacity:0;
  pointer-events:none;
  justify-content:center;
  align-items:center;
  width:1.9rem;
  height:1.9rem;
  display:inline-flex;
  position:absolute;
  top:.1rem;
  right:.1rem;
}

/* @media (hover:hover) and (pointer:fine) */
[data-touch-card-surface]:hover>.card-banish-top-action,.card-banish-top-action:focus-visible {
  opacity:1;
  pointer-events:auto;
}
```

## hand

**45 rules**

### 1sj2l8ggay34g.css

```css
/* @layer utilities */
.\[grid-area\:hand\] {
  grid-area:hand;
}

.handRail {
  --hand-shelf-height:clamp(1rem, 22%, 2.4rem);
  background:0 0;
  border:none;
}

.gb-board[data-board-dragging=false] [data-drop-zone-root=hand] {
  pointer-events:none;
}

.handRail:after {
  content:"";
  height:var(--hand-shelf-height);
  pointer-events:none;
  z-index:0;
  inset-inline:0;
  background:radial-gradient(at 50% 100%,#36567a3d,#0000 72%),linear-gradient(#09132300,#09132370);
  border-radius:50% 50% .35rem .35rem/.75rem .75rem .25rem .25rem;
  position:absolute;
  bottom:0;
  -webkit-mask-image:linear-gradient(90deg,#0000,#000 10% 90%,#0000);
  mask-image:linear-gradient(90deg,#0000,#000 10% 90%,#0000);
}

.handRail:before {
  content:"";
  pointer-events:none;
  z-index:1;
  inset-inline:4%;
  background:linear-gradient(90deg,#0000,#8cbee052 25%,#b4daf778 50%,#8cbee052 75%,#0000);
  height:1px;
  position:absolute;
  bottom:0;
}

.handRevealButton {
  --hand-reveal-size:1.65rem;
  z-index:50;
  width:var(--hand-reveal-size);
  height:var(--hand-reveal-size);
  color:#96afc8;
  pointer-events:auto;
  background:#0c1b2ac2;
  border:1px solid #93b2cf30;
  border-radius:.4rem;
  justify-content:center;
  align-items:center;
  transition:background-color .15s,color .15s,border-color .15s;
  display:inline-flex;
  position:absolute;
  top:.18rem;
  left:.22rem;
}

:where(:root:not([data-sim-pointer=touch])) .handRevealButton:hover,.handRevealButton[aria-pressed=true] {
  color:#cfedff;
  background:#1b3549;
  border-color:#8bd7f580;
}

.handRevealButton:focus-visible {
  outline-offset:2px;
  outline:2px solid #a5dcff;
}

.handRevealButton:disabled {
  opacity:.58;
  cursor:default;
}

/* @media (pointer:coarse) */
:where(:root:not([data-sim-pointer=mouse])) .handRevealButton {
  --hand-reveal-size:2.75rem;
}

.handCardRevealIndicator {
  color:#082f49;
  background:#7dd3fc;
  border-radius:.1rem;
  width:1.6rem;
  height:.8rem;
  transition:left .22s cubic-bezier(.22,1,.36,1),transform .22s cubic-bezier(.22,1,.36,1),top .22s cubic-bezier(.22,1,.36,1),width .22s cubic-bezier(.22,1,.36,1),height .22s cubic-bezier(.22,1,.36,1),border-radius .22s cubic-bezier(.22,1,.36,1),box-shadow .22s ease-out,background-color .22s ease-out,color .22s ease-out;
  top:-.6rem;
  left:50%;
  transform:translate(-50%);
}

.handCardRevealIndicator>svg {
  transition:opacity .14s ease-out,transform .22s cubic-bezier(.22,1,.36,1);
}

.handCardRevealMorphAction:before {
  opacity:0;
}

.handFanSlot[data-card-action-hover-active=true] .handCardRevealIndicator {
  color:#e0f2fe;
  background:#1b3753;
  border-radius:50%;
  width:1.9rem;
  height:1.9rem;
  top:-2rem;
  left:.1rem;
  transform:translate(0);
  box-shadow:inset 0 0 0 1px #c5e7f6eb,inset 0 1px #eff8ff3d,0 0 12px #4dbbe057;
}

.handFanSlot:has(:focus-visible) .handCardRevealIndicator {
  color:#e0f2fe;
  background:#1b3753;
  border-radius:50%;
  width:1.9rem;
  height:1.9rem;
  top:-2rem;
  left:.1rem;
  transform:translate(0);
  box-shadow:inset 0 0 0 1px #c5e7f6eb,inset 0 1px #eff8ff3d,0 0 12px #4dbbe057;
}

.handFanSlot[data-card-action-hover-active=true] .handCardRevealIndicator>svg {
  opacity:0;
  transform:scale(1.4);
}

.handFanSlot:has(:focus-visible) .handCardRevealIndicator>svg {
  opacity:0;
  transform:scale(1.4);
}

/* @media (prefers-reduced-motion:reduce) */
.handCardRevealIndicator,.handCardRevealIndicator>svg {
  transition:none;
}

.gb-board .handRail .handFanSlot[data-card-action-hover-active=true],.gb-board .handRail .handFanSlot:focus-within {
  z-index:80!important;
}

.gb-board [data-player-area=hand]:has(>[data-zone-owner=self] :is(.handFanSlot[data-card-action-hover-active=true],.handFanSlot :focus-visible)) {
  z-index:150;
}

.gb-board[data-suppress-board-hover-tone=false] .handRail .handFanSlot:where([data-card-action-hover-active=true]) {
  --fan-hover-raise:-12px;
}

.gb-board .handRail[data-hand-drag-active=true] .handFanSlot,:where(:root:not([data-sim-pointer=touch])) .gb-board .handRail[data-hand-drag-active=true] .handFanSlot:hover {
  --fan-hover-raise:0px;
}

.gb-board .handRail[data-hand-drag-active=true] .handFanSlot .group\/action,.gb-board .handRail[data-hand-drag-active=true] .handFanSlot .group\/action * {
  opacity:0!important;
  pointer-events:none!important;
}

.gb-board[data-suppress-board-hover-tone=true] .handRail .handFanSlot,:where(:root:not([data-sim-pointer=touch])) .gb-board[data-suppress-board-hover-tone=true] .handRail .handFanSlot:hover {
  --fan-hover-raise:0px;
}

.gb-board[data-suppress-board-hover-tone=true] .handRail .handFanSlot .group\/action,.gb-board[data-suppress-board-hover-tone=true] .handRail .handFanSlot .group\/action * {
  opacity:0!important;
  pointer-events:none!important;
}

:root[data-sim-pointer=touch] .gb-board .handRail .handFanSlot {
  --fan-hover-raise:0px!important;
}

[data-card-rail-resizing=true] :is([data-card-travel],.handFanSlot) {
  transition:none;
}

.gb-board[data-tablet-layout=false] [data-board-turn-controls]>div,.gb-board[data-tablet-layout=false] [data-player-area=actions]>div,.gb-board[data-tablet-layout=false] [data-player-area=resources],.gb-board[data-tablet-layout=false] .handRevealButton {
  zoom:var(--desktop-ui-scale,1);
}

.gb-board[data-tablet-layout=false] .handRevealButton {
  left:calc(-1 * var(--hand-reveal-size) - .5rem);
}

[data-touch-layout=true] .handRail {
  margin-bottom:var(--hand-fan-bottom-overflow);
}

[data-touch-layout=true] .handRevealButton {
  --hand-reveal-size:1.875rem;
  top:auto;
  bottom:.18rem;
  left:-2.125rem;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] .handRevealButton {
  --hand-reveal-size:2.75rem;
  left:-2.75rem;
}

.gb-board[data-board-density=regular] [data-touch-layout=true] .handRevealButton>svg {
  width:1.25rem;
  height:1.25rem;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true] .handRevealButton {
  bottom:calc(100% + .2rem);
  left:auto;
  right:0;
}

.gb-board[data-tablet-layout=true][data-tablet-compact=false][data-hand-controls-above=true] [data-player-layer=self] .handRevealButton {
  right:calc(-1 * (var(--card-width) + 1rem));
}

.gb-board[data-tablet-layout=true][data-tablet-compact=false][data-hand-controls-above=true][data-hand-end-reserved=true] [data-player-layer=self] .handRevealButton {
  right:0;
  translate:3.25rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .handRail {
  --phone-hand-control-size:min(1.75rem, calc((var(--card-height) - .4rem) / 3));
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer] .handRevealButton {
  width:var(--phone-hand-control-size);
  height:var(--phone-hand-control-size);
  border-radius:.2rem;
  inset:0 auto auto -1.9rem;
  translate:none;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=opponent] .handRevealButton {
  translate:0 -.5rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self] .handRevealButton,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer=self] .phone-hand-utilities {
  translate:0 .2rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .phone-hand-utilities {
  left:-1.9rem;
  top:calc(var(--phone-hand-control-size) + .2rem);
  pointer-events:auto;
  flex-direction:column;
  gap:.2rem;
  display:flex;
  position:absolute;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .phone-hand-utilities .tablet-icon-button {
  width:var(--phone-hand-control-size);
  min-width:var(--phone-hand-control-size);
  height:var(--phone-hand-control-size);
  min-height:var(--phone-hand-control-size);
  border-radius:.2rem;
  padding:0;
}

:root[data-sim-pointer=touch] .gb-board .handRevealButton {
  --hand-reveal-size:2.75rem;
}

:root[data-sim-pointer=mouse] .gb-board .handRevealButton {
  --hand-reveal-size:min(1.65rem, var(--phone-hand-control-size,1.65rem));
  width:var(--hand-reveal-size);
  height:var(--hand-reveal-size);
}

:root[data-sim-pointer=mouse] .gb-board .handRevealButton>svg {
  width:.9rem;
  height:.9rem;
}
```

## rune

**14 rules**

### 1sj2l8ggay34g.css

```css
/* @layer utilities */
.text-\(length\:--rune-zone-count-size\) {
  font-size:var(--rune-zone-count-size);
}

/* @layer utilities */
.\[grid-area\:runeDeck\] {
  grid-area:runeDeck;
}

.gb-board-layer[data-touch-layout=false]>[data-player-area=runeDeck],.gb-board-layer[data-touch-layout=true] .tablet-rune-pile,.gb-board-layer[data-player-layer=opponent][data-touch-layout=false]>[data-player-area=trash] {
  z-index:10;
}

[data-touch-layout=true] .tablet-rune-float-drop {
  height:100%;
  width:calc(100% - var(--card-width) - .6rem);
  background:#243d5cf5;
  grid-area:auto;
  position:absolute;
  inset:0 0 0 auto;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true] .tablet-rune-pile {
  grid-area:runeDeck;
  align-self:end;
}

.gb-board[data-tablet-layout=true][data-hand-controls-above=true] [data-touch-layout=true] .tablet-rune-float-drop {
  top:calc(var(--card-height) + .8rem);
  width:100%;
  height:2rem;
  bottom:auto;
  left:0;
  right:auto;
}

.gb-board[data-board-density=narrow] [data-drop-zone-root=runeArea]>:not([data-zone-owner]) {
  z-index:150;
  pointer-events:none;
  position:absolute;
}

.gb-board[data-board-density=narrow] [data-drop-zone-root=runeArea][data-zone-owner=self]>:not([data-zone-owner]) {
  bottom:0;
  right:0;
  translate:20% 45%;
}

.gb-board[data-board-density=narrow] [data-drop-zone-root=runeArea][data-zone-owner=opponent]>:not([data-zone-owner]) {
  top:0;
  left:0;
  translate:-20% -45%;
}

.gb-board[data-board-density=narrow] [data-drop-zone-root=runeArea] [data-rune-ready-count] {
  background:#08101ccc;
  border:1px solid #dcecff33;
  border-radius:.3rem;
  padding:.04rem .22rem;
  line-height:1.25;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-touch-layout=true] .tablet-rune-pile,.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=main],.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-area=trash] {
  --card-width:var(--phone-supply-card-width);
  --card-height:var(--phone-supply-card-height);
  align-self:center;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-rune-pile {
  align-items:center;
  display:flex;
  translate:-.2rem;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] .tablet-rune-float-drop {
  grid-area:resources;
  height:100%;
  position:relative;
  inset:auto;
}

.gb-board[data-tablet-layout=true][data-board-arrangement=phone-portrait] [data-player-layer][data-touch-layout=true][data-neeko-borrowed-legends] .tablet-rune-float-drop {
  z-index:5;
  grid-column:2/4;
}
```

## gb-

**104 rules**

### 1sj2l8ggay34g.css

```css
/* @layer utilities */
.gb-board-field-vignette {
  background:radial-gradient(100% 80%,#8cb4ff08 0%,#648cdc03 35%,#0000 55%),radial-gradient(circle,#f1f7ff05,#0000 45%),linear-gradient(#050d231f 0%,#050d2308 18% 82%,#050d231f 100%);
}

/* @layer utilities */
.gb-board-root-bg {
  background:repeating-linear-gradient(90deg, transparent 0, transparent 1px, #b6cbff03 1px, #b6cbff03 2px), repeating-linear-gradient(0deg, transparent 0, transparent 1px, #b6cbff03 1px, #b6cbff03 2px), repeating-linear-gradient(-18deg, #08143208 0, #08143208 2px, transparent 2px, transparent 10px), radial-gradient(ellipse 140% 120% at 50% 50%, #1e376e38 0%, #12265559 35%, var(--color-gb-bg-1) 55%, var(--color-gb-bg-2) 75%, var(--color-gb-bg-0) 100%);
}

/* @layer utilities */
.before\:gb-board-root-glow:before {
  content:var(--tw-content);
  background:radial-gradient(80% 70%,#78a5ff12 0%,#8c64dc08 40%,#c8aa6405 55%,#0000 70%),radial-gradient(circle,#5a8cff0a 0%,#0000 50%);
}

/* @layer utilities */
.before\:gb-centerline-dash:before {
  content:var(--tw-content);
  background:repeating-linear-gradient(90deg,#0000 0 16px,#95b4f561 16px 18px);
}

/* @layer utilities */
.before\:gb-ornament-field:before {
  content:var(--tw-content);
  background:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top right / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom right / .4rem .4rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px 1.1rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1.05rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1px 1.15rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1.1rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1px 1.05rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px 1.15rem no-repeat, radial-gradient(120% 100% at 50% 0, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) top center / 1.15rem .5rem no-repeat, radial-gradient(120% 100% at 50% 100%, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) bottom center / 1.15rem .5rem no-repeat;
}

/* @layer utilities */
.after\:gb-ornament-corner-bottom-right:after {
  content:var(--tw-content);
  background:linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / .72rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px .68rem no-repeat, radial-gradient(120% 100% at 0 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center left / .56rem .5rem no-repeat, radial-gradient(120% 100% at 100% 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center right / .56rem .5rem no-repeat;
}

/* @layer utilities */
.after\:gb-ornament-corner-top-left:after {
  content:var(--tw-content);
  background:linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / .72rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px .68rem no-repeat, radial-gradient(120% 100% at 0 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center left / .56rem .5rem no-repeat, radial-gradient(120% 100% at 100% 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center right / .56rem .5rem no-repeat;
}

/* @layer utilities */
.after\:gb-ornament-field:after {
  content:var(--tw-content);
  background:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top right / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom right / .4rem .4rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px 1.1rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1.05rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1px 1.15rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1.1rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1px 1.05rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px 1.15rem no-repeat, radial-gradient(120% 100% at 50% 0, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) top center / 1.15rem .5rem no-repeat, radial-gradient(120% 100% at 50% 100%, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) bottom center / 1.15rem .5rem no-repeat;
}

/* @layer utilities */
.after\:gb-ornament-pile:after {
  content:var(--tw-content);
  background:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top left / .35rem .35rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom right / .35rem .35rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / .78rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px .74rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / .78rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px .74rem no-repeat;
}

/* @layer utilities */
.after\:gb-ornament-zone:after {
  content:var(--tw-content);
  background:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top left / .35rem .35rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top right / .35rem .35rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom left / .35rem .35rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom right / .35rem .35rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / .9rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px .86rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / .82rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1px .9rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / .86rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1px .82rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / .92rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px .88rem no-repeat, radial-gradient(120% 100% at 0 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center left / .56rem .5rem no-repeat, radial-gradient(120% 100% at 100% 50%, transparent 68%, var(--color-gb-ornament-soft) 70% 72%, transparent 74%) center right / .56rem .5rem no-repeat;
}

.gb-board {
  --board-scale:1;
  --board-right-safety-gutter:1.5rem;
  --card-width:5.2rem;
  --card-height:7.24286rem;
  --card-peek-width:clamp(8.8rem, 24.2vw, 15.4rem);
  --card-radius-main:.3rem;
  --card-radius-tight:.24rem;
  --card-radius-peek:.28rem;
  --card-body-size:clamp(.5rem, calc(var(--card-width) * .098), .7rem);
  --card-title-size:clamp(.56rem, calc(var(--card-width) * .108), .78rem);
  --card-badge-micro-size:clamp(.42rem, calc(var(--card-width) * .082), .58rem);
  --card-buff-badge-inset:clamp(.14rem, calc(var(--card-width) * .031), .22rem);
  --card-buff-badge-height:clamp(1.06rem, calc(var(--card-width) * .223), 1.3rem);
  --card-buff-badge-min-width:clamp(2.1rem, calc(var(--card-width) * .45), 2.72rem);
  --card-buff-badge-value-min-width:clamp(.86rem, calc(var(--card-width) * .185), 1.12rem);
  --card-buff-badge-value-pad-x:clamp(.14rem, calc(var(--card-width) * .031), .2rem);
  --card-buff-badge-label-pad-x:clamp(.18rem, calc(var(--card-width) * .038), .26rem);
  --card-buff-remove-hit-width:clamp(2.9rem, calc(var(--card-width) * .58), 3.55rem);
  --card-buff-remove-hit-height:clamp(1.32rem, calc(var(--card-width) * .27), 1.58rem);
  --card-buff-remove-pad-x:clamp(.16rem, calc(var(--card-width) * .035), .24rem);
  --card-buff-remove-icon-size:clamp(.82rem, calc(var(--card-width) * .17), 1.04rem);
  --card-buff-remove-x-size:clamp(.54rem, calc(var(--card-width) * .113), .72rem);
  --card-duplicate-badge-height:clamp(.96rem, calc(var(--card-width) * .196), 1.14rem);
  --card-label-chip-height:clamp(1.1rem, calc(var(--card-width) * .23), 1.4rem);
  --card-label-chip-font-size:clamp(.57rem, calc(var(--card-width) * .105), .75rem);
  --card-label-chip-pad-x:clamp(.22rem, calc(var(--card-width) * .046), .32rem);
  --card-label-chip-pad-y:clamp(.08rem, calc(var(--card-width) * .015), .12rem);
  --card-label-chip-radius:.28rem;
  --card-label-stack-gap:clamp(.12rem, calc(var(--card-width) * .027), .18rem);
  --card-label-stack-left:clamp(.14rem, calc(var(--card-width) * .031), .22rem);
  --card-label-stack-width-offset:.4rem;
  --card-label-action-size:clamp(1rem, calc(var(--card-width) * .208), 1.28rem);
  --card-label-action-icon-size:clamp(.42rem, calc(var(--card-width) * .088), .56rem);
  --card-counter-height:clamp(1.58rem, calc(var(--card-width) * .35), 2.12rem);
  --card-counter-control-height:clamp(1.36rem, calc(var(--card-width) * .3), 1.84rem);
  --card-counter-controls-height:calc(var(--card-counter-height) + var(--card-counter-control-height));
  --card-counter-track-width:clamp(4.2rem, calc(var(--card-width) * .942), 5.72rem);
  --card-counter-slot-width:clamp(2.02rem, calc(var(--card-width) * .45), 2.72rem);
  --card-counter-min-width:clamp(1.82rem, calc(var(--card-width) * .4), 2.48rem);
  --card-counter-clear-width:clamp(1.32rem, calc(var(--card-width) * .296), 1.76rem);
  --card-counter-clear-icon-size:clamp(.78rem, calc(var(--card-width) * .173), 1.02rem);
  --card-counter-pad-x:clamp(.28rem, calc(var(--card-width) * .062), .4rem);
  --card-counter-font-size:clamp(.98rem, calc(var(--card-width) * .219), 1.34rem);
  --card-counter-control-font-size:clamp(1.04rem, calc(var(--card-width) * .235), 1.44rem);
  --card-counter-radius:clamp(.32rem, calc(var(--card-width) * .069), .46rem);
  --card-counter-control-radius:clamp(.3rem, calc(var(--card-width) * .065), .42rem);
  --card-battlefield-body-size:clamp(.48rem, calc(var(--card-width) * .092), .66rem);
  --card-battlefield-title-size:clamp(.54rem, calc(var(--card-width) * .104), .74rem);
  --card-action-hover-label-size:clamp(.54rem, calc(var(--card-width) * .104), .7rem);
  --card-action-hover-detail-size:clamp(.48rem, calc(var(--card-width) * .094), .62rem);
  --board-action-font-size:clamp(.72rem, calc(var(--card-width) * .132), .92rem);
  --board-floating-label-size:clamp(.56rem, calc(var(--card-width) * .105), .72rem);
  --board-floating-value-size:clamp(.72rem, calc(var(--card-width) * .132), .92rem);
  --board-micro-label-size:clamp(.48rem, calc(var(--card-width) * .09), .62rem);
  --board-pill-font-size:clamp(.68rem, calc(var(--card-width) * .126), .9rem);
  --zone-label-size:clamp(.46rem, calc(var(--card-width) * .088), .64rem);
  --zone-label-compact-size:clamp(.52rem, calc(var(--card-width) * .102), .68rem);
  --zone-count-size:clamp(.54rem, calc(var(--card-width) * .102), .7rem);
  --rune-zone-count-size:clamp(.7rem, calc(var(--card-width) * .132), .92rem);
  --player-band-size:40%;
  --battlefield-overlap:3.2rem;
  --battlefield-inset:calc(var(--player-band-size) - var(--battlefield-overlap));
  --bg-0:#0e2049;
  --bg-1:#0b1a3d;
  --bg-2:#07132f;
  --panel:#152857;
  --panel-soft:#10224b;
  --line:#d6e2ff4d;
  --line-strong:#e9f1ff80;
  --sep:#c0d3ff3d;
  --sep-soft:#c0d3ff29;
  --sep-strong:#d5e5ff61;
  --text-main:#eef4ff;
  --text-soft:#ccdbf7;
  --text-dim:#94a9d3;
  --accent-green:#78ddb7;
  --accent-orange:#ffbb6e;
  --play-area-bg:#d6e2ff0d;
  --play-lane-bg:#e2ecff0f;
  --ornament-ink:#ecf3ff85;
  --ornament-soft:#bcd0ff57;
  touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;
  container-type:inline-size;
}

.gb-board-glass {
  contain:paint;
}

.gb-board-glass .gb-board-playmat {
  backface-visibility:visible;
  transform:none;
}

.gb-board-glass-optics {
  --frost:var(--play-zone-frost,.3);
  filter:var(--glass-lens,blur(calc(var(--frost) * var(--frost) * 16px))) saturate(1.25);
}

/* @media (prefers-reduced-transparency:reduce) */
.gb-board-glass {
  display:none;
}

:is([data-board-lines=legend],[data-board-lines=signature_legend]):is(.after\:gb-ornament-zone,.after\:gb-ornament-pile):after {
  opacity:var(--lines-alpha);
}

:is([data-board-lines=legend],[data-board-lines=signature_legend]).after\:gb-ornament-zone:after {
  inset:calc(var(--lines-corner) * -.11);
}

:is([data-board-lines=legend],[data-board-lines=signature_legend]).after\:gb-ornament-pile:after {
  inset:calc(var(--lines-pile-corner) * -.11);
}

[data-board-lines].after\:gb-ornament-zone:after {
  background:var(--lines-corner-top-left) top left / var(--lines-corner) no-repeat, var(--lines-corner-top-right) top right / var(--lines-corner) no-repeat, var(--lines-corner-bottom-left) bottom left / var(--lines-corner) no-repeat, var(--lines-corner-bottom-right) bottom right / var(--lines-corner) no-repeat, var(--lines-tick-left) center left / var(--lines-tick) no-repeat, var(--lines-tick-right) center right / var(--lines-tick) no-repeat;
}

.gb-lines-zone-header {
  --lines-header-inset:calc(var(--lines-corner) * .3);
  --lines-header-drop:calc(var(--lines-corner) * var(--lines-header-reach,.16));
}

.gb-lines-zone-header.rotate-180 {
  --lines-header-drop:calc(var(--lines-corner) * var(--lines-header-reach,.16) * -1);
}

.gb-lines-zone-header>h4 {
  transform:translate(var(--lines-header-inset), var(--lines-header-drop));
}

.gb-lines-zone-header>[role=status] {
  transform:translate(calc(var(--lines-header-inset) * -1), var(--lines-header-drop));
}

[data-board-lines].after\:gb-ornament-pile:after {
  background:var(--lines-corner-top-left) top left / var(--lines-pile-corner) no-repeat, var(--lines-corner-bottom-right) bottom right / var(--lines-pile-corner) no-repeat;
}

[data-board-lines]:is(.after\:gb-ornament-corner-top-left,.after\:gb-ornament-corner-bottom-right):after {
  background:0 0;
}

.gb-board-layer[data-lines-frame] {
  --top-alpha:.66;
  --bottom-alpha:.66;
  --frame-line:linear-gradient(#dde8ff75 0 0);
  --frame-inset:calc(var(--lines-edge) / 2);
  --frame-half:calc(50% - var(--lines-edge) / 2);
  --frame-top:var(--frame-line) 50% var(--frame-inset) / calc(100% - var(--lines-edge)) 1px no-repeat, var(--frame-line) var(--frame-inset) var(--frame-inset) / 1px var(--frame-half) no-repeat, var(--frame-line) right var(--frame-inset) top var(--frame-inset) / 1px var(--frame-half) no-repeat;
  --frame-bottom:var(--frame-line) 50% calc(100% - var(--frame-inset)) / calc(100% - var(--lines-edge)) 1px no-repeat, var(--frame-line) left var(--frame-inset) bottom var(--frame-inset) / 1px var(--frame-half) no-repeat, var(--frame-line) right var(--frame-inset) bottom var(--frame-inset) / 1px var(--frame-half) no-repeat;
  --field-top:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) top right / .4rem .4rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top left / 1px 1.1rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1.05rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) top right / 1px 1.15rem no-repeat, radial-gradient(120% 100% at 50% 0, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) top center / 1.15rem .5rem no-repeat;
  --field-bottom:radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom left / .4rem .4rem no-repeat, radial-gradient(circle, var(--color-gb-ornament-ink) 0 1px, transparent 1px) bottom right / .4rem .4rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1.1rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom left / 1px 1.05rem no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1.15rem 1px no-repeat, linear-gradient(var(--color-gb-ornament-ink) 0 0) bottom right / 1px 1.15rem no-repeat, radial-gradient(120% 100% at 50% 100%, transparent 66%, var(--color-gb-ornament-soft) 68% 70%, transparent 72%) bottom center / 1.15rem .5rem no-repeat;
}

.gb-board-layer[data-lines-frame]:not([data-state-border]) {
  border-color:#0000;
}

.gb-board-layer[data-lines-frame][data-state-border] {
  --frame-line:linear-gradient(transparent 0 0);
}

.gb-board-layer[data-top-board-lines=ink] {
  --top-corner:var(--ink-corner);
  --top-corner-left:url(/board-lines/corner-top-left.svg);
  --top-corner-right:url(/board-lines/corner-top-right.svg);
  --top-edge-horizontal:url(/board-lines/edge-horizontal.svg);
  --top-edge-vertical:url(/board-lines/edge-vertical.svg);
  --top-edge-trim:var(--frame-inset);
  --field-top:url(/board-lines/tick-top.svg) top center / var(--ink-tick-flat) no-repeat;
}

.gb-board-layer[data-bottom-board-lines=ink] {
  --bottom-corner:var(--ink-corner);
  --bottom-corner-left:url(/board-lines/corner-bottom-left.svg);
  --bottom-corner-right:url(/board-lines/corner-bottom-right.svg);
  --bottom-edge-horizontal:url(/board-lines/edge-horizontal.svg);
  --bottom-edge-vertical:url(/board-lines/edge-vertical.svg);
  --bottom-edge-trim:var(--frame-inset);
  --field-bottom:url(/board-lines/tick-bottom.svg) bottom center / var(--ink-tick-flat) no-repeat;
}

.gb-board-layer:is([data-top-board-lines=legend],[data-top-board-lines=signature_legend]) {
  --top-alpha:.92;
  --top-corner:calc(var(--lines-edge) * 64 / 18);
  --top-edge-trim:calc(var(--frame-inset) + var(--top-corner) * .5);
  --field-top:none;
}

.gb-board-layer:is([data-bottom-board-lines=legend],[data-bottom-board-lines=signature_legend]) {
  --bottom-alpha:.92;
  --bottom-corner:calc(var(--lines-edge) * 64 / 18);
  --bottom-edge-trim:calc(var(--frame-inset) + var(--bottom-corner) * .5);
  --field-bottom:none;
}

.gb-board-layer[data-top-board-lines=legend] {
  --top-corner-left:url(/board-lines/legend/corner-top-left.svg);
  --top-corner-right:url(/board-lines/legend/corner-top-right.svg);
  --top-tick:url(/board-lines/legend/tick-top.svg);
  --top-edge-horizontal:url(/board-lines/legend/edge-horizontal.svg);
  --top-edge-vertical:url(/board-lines/legend/edge-vertical.svg);
}

.gb-board-layer[data-bottom-board-lines=legend] {
  --bottom-corner-left:url(/board-lines/legend/corner-bottom-left.svg);
  --bottom-corner-right:url(/board-lines/legend/corner-bottom-right.svg);
  --bottom-tick:url(/board-lines/legend/tick-bottom.svg);
  --bottom-edge-horizontal:url(/board-lines/legend/edge-horizontal.svg);
  --bottom-edge-vertical:url(/board-lines/legend/edge-vertical.svg);
}

.gb-board-layer[data-top-board-lines=signature_legend] {
  --top-corner-left:url(/board-lines/signature-legend/corner-top-left.svg);
  --top-corner-right:url(/board-lines/signature-legend/corner-top-right.svg);
  --top-tick:url(/board-lines/signature-legend/tick-top.svg);
  --top-edge-horizontal:url(/board-lines/signature-legend/edge-horizontal.svg);
  --top-edge-vertical:url(/board-lines/signature-legend/edge-vertical.svg);
}

.gb-board-layer[data-bottom-board-lines=signature_legend] {
  --bottom-corner-left:url(/board-lines/signature-legend/corner-bottom-left.svg);
  --bottom-corner-right:url(/board-lines/signature-legend/corner-bottom-right.svg);
  --bottom-tick:url(/board-lines/signature-legend/tick-bottom.svg);
  --bottom-edge-horizontal:url(/board-lines/signature-legend/edge-horizontal.svg);
  --bottom-edge-vertical:url(/board-lines/signature-legend/edge-vertical.svg);
}

.gb-board-layer[data-top-board-lines] {
  --top-corner-at:calc(var(--frame-inset) + .5px - var(--top-corner) * .11);
  --frame-top:var(--top-corner-left) left var(--top-corner-at) top var(--top-corner-at) / var(--top-corner) no-repeat, var(--top-corner-right) right var(--top-corner-at) top var(--top-corner-at) / var(--top-corner) no-repeat, var(--top-tick,none) center top calc(var(--frame-inset) + .5px - var(--lines-edge) * .39) / calc(var(--lines-edge) * 2.5) var(--lines-edge) no-repeat, var(--top-edge-horizontal) 50% .5px / calc(100% - var(--top-edge-trim) * 2) var(--lines-edge) no-repeat, var(--top-edge-vertical) .5px var(--top-edge-trim) / var(--lines-edge) calc(50% - var(--top-edge-trim)) no-repeat, var(--top-edge-vertical) right .5px top var(--top-edge-trim) / var(--lines-edge) calc(50% - var(--top-edge-trim)) no-repeat;
}

.gb-board-layer[data-bottom-board-lines] {
  --bottom-corner-at:calc(var(--frame-inset) + .5px - var(--bottom-corner) * .11);
  --frame-bottom:var(--bottom-corner-left) left var(--bottom-corner-at) bottom var(--bottom-corner-at) / var(--bottom-corner) no-repeat, var(--bottom-corner-right) right var(--bottom-corner-at) bottom var(--bottom-corner-at) / var(--bottom-corner) no-repeat, var(--bottom-tick,none) center bottom calc(var(--frame-inset) + .5px - var(--lines-edge) * .39) / calc(var(--lines-edge) * 2.5) var(--lines-edge) no-repeat, var(--bottom-edge-horizontal) 50% calc(100% - .5px) / calc(100% - var(--bottom-edge-trim) * 2) var(--lines-edge) no-repeat, var(--bottom-edge-vertical) left .5px bottom var(--bottom-edge-trim) / var(--lines-edge) calc(50% - var(--bottom-edge-trim)) no-repeat, var(--bottom-edge-vertical) right .5px bottom var(--bottom-edge-trim) / var(--lines-edge) calc(50% - var(--bottom-edge-trim)) no-repeat;
}

.gb-board-layer[data-lines-frame]:before {
  --frame-alpha:linear-gradient(to bottom, rgb(0 0 0/var(--top-alpha)) 50%, rgb(0 0 0/var(--bottom-alpha)) 50%);
  inset:calc(-1px - var(--frame-inset));
  background:var(--frame-top), var(--frame-bottom);
  content:"";
  -webkit-mask-image:var(--frame-alpha);
  -webkit-mask-image:var(--frame-alpha);
  -webkit-mask-image:var(--frame-alpha);
  mask-image:var(--frame-alpha);
  pointer-events:none;
  position:absolute;
}

.gb-board-layer[data-lines-frame]:after {
  background:var(--field-top), var(--field-bottom);
}

.gb-board[data-lines-controls=ink] {
  --lines-box:url(/board-lines/box.svg);
}

.gb-board[data-lines-controls=legend] {
  --lines-box:url(/board-lines/legend/box.svg);
}

.gb-board[data-lines-controls=signature_legend] {
  --lines-box:url(/board-lines/signature-legend/box.svg);
}

.gb-board[data-board-tight-rail=true] .board-control-label {
  display:none;
}

.gb-board-layer[data-might-border] {
  border-image:linear-gradient(#0000 0 0) 1;
}

.gb-board-layer[data-might-border][data-lines-frame]:before {
  --might-mask-outset:calc(1px + var(--frame-inset));
}

.gb-board-layer[data-might-border]:after {
  --might-mask-outset:-.12rem;
}

.gb-board-layer.rotate-180,[data-compact-observer-player-layer] {
  --card-counter-player-rotation:180deg;
  --card-counter-stack-direction:-1;
}

/* @media (max-width:640px),(max-height:500px) */
.gb-board {
  --card-counter-height:clamp(1.25rem, calc(var(--card-width) * .28), 1.7rem);
  --card-counter-track-width:clamp(3.36rem, calc(var(--card-width) * .754), 4.58rem);
  --card-counter-slot-width:clamp(1.62rem, calc(var(--card-width) * .36), 2.18rem);
  --card-counter-min-width:clamp(1.46rem, calc(var(--card-width) * .32), 1.98rem);
  --card-counter-pad-x:clamp(.22rem, calc(var(--card-width) * .05), .32rem);
  --card-counter-font-size:clamp(.8rem, calc(var(--card-width) * .175), 1.07rem);
  --card-counter-radius:clamp(.26rem, calc(var(--card-width) * .055), .37rem);
}

.gb-board-playmat {
  contain:paint;
  backface-visibility:hidden;
  transform:translateZ(0);
}

.gb-deck-peek {
  --card-peek-width:clamp(8rem, 14vw, 10rem);
}

.gb-deck-peek [data-compact-only] {
  display:none;
}

.gb-deck-peek-more-panel {
  max-height:calc(var(--sim-visible-height,100dvh) - 8rem);
  overflow-y:auto;
}

.gb-off-board-touch-actions {
  display:contents;
}

/* @media (max-width:1100px) */
.gb-deck-peek [data-collapse-to-board] {
  grid-area:1/1;
}

/* @media (max-width:1100px) */
.gb-deck-peek h3 {
  white-space:nowrap;
  grid-area:1/2;
  font-size:.75rem;
}

/* @media (max-width:600px) */
.gb-deck-peek {
  --card-peek-width:calc((100vw - 2.875rem) / 3);
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-deck-peek-secondary-actions,.gb-deck-peek-more-label {
  display:none;
}

/* @media (max-width:600px) */
.gb-deck-peek [data-compact-only] {
  display:block;
}

/* @media (max-height:500px) and (max-width:1100px) */
.gb-deck-peek {
  --card-peek-width:min(7rem, calc((var(--sim-visible-height,100dvh) - var(--card-height) - 10rem) * 63 / 88));
}

/* @media (max-width:1100px) */
.gb-deck-peek .gb-deck-peek-secondary-actions,.gb-deck-peek .gb-deck-peek-more-label {
  display:none;
}

/* @media (max-width:1100px) */
.gb-deck-peek [data-compact-only] {
  display:block;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-header-full-label {
  display:none;
}

/* @media (max-width:600px) */
.gb-deck-peek .gb-header-compact-label {
  display:inline;
}

.gb-deck-peek-to-hand {
  z-index:20;
  color:#e2f1f8;
  background:#0e2638f2;
  border:1px solid #b5d8e66b;
  border-radius:.2rem;
  width:max-content;
  min-height:1.875rem;
  padding:.2rem .4rem;
  font-size:.625rem;
  font-weight:600;
  display:none;
  position:absolute;
  top:2.75rem;
  left:50%;
  translate:-50%;
  box-shadow:0 2px 6px #020b1855;
}

/* @media (max-width:600px),(max-height:500px) and (max-width:1100px) */
.gb-deck-peek-to-hand {
  display:block;
}

.gb-deck-peek-to-hand:disabled {
  opacity:.45;
}

.gb-deck-peek-to-hand:active {
  background:#244d60;
}

/* @media (max-width:600px) */
.gb-deck-peek-to-hand {
  top:2.5rem;
  left:.25rem;
  translate:none;
}

.gb-neeko-legend-stack {
  --neeko-overhang:calc((var(--card-height) - var(--card-width)) / 2);
}

.gb-neeko-borrowed-legend {
  --neeko-self-exhausted:0;
  --neeko-start-exhausted:0;
  bottom:0;
  right:calc(100% + var(--card-width) * .04 + var(--card-width) * 1.04 * var(--neeko-legend-index,0) + var(--neeko-overhang) * ( 2 * var(--neeko-exhausted-before,0) + var(--neeko-self-exhausted) + var(--neeko-start-exhausted) ));
  position:absolute;
}

.gb-neeko-borrowed-legend[data-exhausted] {
  --neeko-self-exhausted:1;
}

.gb-neeko-starting-legend[data-exhausted]~.gb-neeko-borrowed-legend {
  --neeko-start-exhausted:1;
}

.gb-board-layer[data-neeko-borrowed-legends] [data-player-area=leftLanes] {
  margin-right:calc(var(--base-legend-clearance) + var(--card-width) * (1.04 * var(--neeko-borrowed-count) - .25) + (var(--card-height) - var(--card-width)) / 2 * var(--neeko-overhang-count,0));
}

.gb-resources-popover {
  --text-soft:#ccdbf7;
  --board-floating-label-size:.62rem;
  z-index:2147483000;
  color:#d9e6f5;
  font-variant-numeric:tabular-nums;
  background:#0b1423;
  border:1px solid #aec7e347;
  border-radius:.3rem;
  padding:.35rem .4rem;
  line-height:1;
  position:fixed;
  box-shadow:inset 0 1px #ffffff0f,0 .6rem 1.4rem #02060e8c;
}

.gb-resources-popover>[data-resources-content]>div {
  grid-template-columns:2.25rem max-content 1.1rem 2.25rem;
  gap:.3rem;
  font-size:.8rem;
}

.gb-resources-popover>[data-resources-content] button,.gb-resources-popover>[data-resources-content] span[aria-hidden=true] {
  width:2.25rem;
  min-width:2.25rem;
  height:2.25rem;
  font-size:1rem;
}

.gb-resources-summary {
  color:#d9e6f5;
  font-variant-numeric:tabular-nums;
  background:#152941db;
  border:1px solid #a6b9d13d;
  border-radius:.3rem;
  align-content:center;
  justify-items:center;
  gap:.25rem;
  min-width:1.75rem;
  min-height:2.75rem;
  padding:.3rem .2rem;
  font-size:.7rem;
  font-weight:700;
  line-height:1;
  display:none;
}

button.gb-resources-summary {
  cursor:pointer;
  width:auto;
  height:auto;
  position:relative;
}

button.gb-resources-summary:before {
  content:"";
  width:max(100%,44px);
  height:max(100%,44px);
  position:absolute;
  top:50%;
  left:50%;
  translate:-50% -50%;
}

button.gb-resources-summary[aria-expanded=true] {
  background:#1d2f48f0;
  border-color:#cce2f980;
}

button.gb-resources-summary:focus-visible {
  outline-offset:1px;
  outline:2px solid #c9e2ffb8;
}

.gb-resources-summary-energy {
  color:#0a0f18;
  background:#f3f5f9;
  border-radius:999px;
  place-items:center;
  width:1.05rem;
  height:1.05rem;
  font-size:.62rem;
  display:grid;
  box-shadow:0 1px 2px #00000059;
}

.gb-resources-summary-energy[data-tone=gain] {
  background:#8fe0a7;
}

.gb-resources-summary-energy[data-tone=loss] {
  background:#ff9fa6;
}

.gb-resources-summary-power {
  align-items:center;
  gap:.1rem;
  display:inline-flex;
}

.gb-resources-summary-power>img {
  width:.7rem;
  height:.7rem;
}

.gb-neeko-legends-control {
  --neeko-portrait-size:clamp(1.05rem, calc(var(--card-width) * .25), 1.4rem);
  --neeko-control-padding:.12rem;
  --neeko-control-edge-inset:calc(var(--neeko-portrait-size) * .5 + var(--neeko-control-padding) + 1px);
  bottom:calc(100% - var(--neeko-control-edge-inset));
  z-index:45;
  padding:var(--neeko-control-padding);
  pointer-events:auto;
  cursor:pointer;
  background:#0c1626f0;
  border:1px solid #e2c48080;
  border-radius:999px;
  align-items:center;
  transition:border-color .12s,background-color .12s;
  display:flex;
  position:absolute;
  left:50%;
  translate:-50%;
  box-shadow:inset 0 1px #ffffff0f,0 .2rem .5rem #0207108c;
}

.gb-neeko-legends-control:disabled {
  cursor:default;
}

.gb-neeko-legends-control:hover:not(:disabled),.gb-neeko-legends-control:focus-visible {
  background:#16263cf5;
  border-color:#f0d696e6;
}

.gb-neeko-legends-control:focus-visible {
  outline-offset:1px;
  outline:2px solid #c9e2ffb8;
}

.gb-neeko-legends-control:before {
  content:"";
  width:max(100%,24px);
  height:max(100%,24px);
  position:absolute;
  top:50%;
  left:50%;
  translate:-50% -50%;
}

.gb-neeko-legend-portrait {
  width:var(--neeko-portrait-size);
  height:var(--neeko-portrait-size);
  background:#162033;
  border-radius:999px;
  flex:none;
  transition:margin-left .16s;
  position:relative;
  overflow:hidden;
  box-shadow:0 0 0 1.5px #0c1626;
}

.gb-neeko-legend-portrait+.gb-neeko-legend-portrait {
  margin-left:calc(var(--neeko-portrait-size) * -.34);
}

.gb-neeko-legends-control:hover:not(:disabled) .gb-neeko-legend-portrait+.gb-neeko-legend-portrait {
  margin-left:calc(var(--neeko-portrait-size) * -.08);
}

.gb-neeko-starting-legend[data-exhausted]>.gb-neeko-legends-control {
  bottom:calc(100% - var(--neeko-overhang) - var(--neeko-control-edge-inset));
}

.gb-neeko-legends-control[data-compact] {
  --neeko-portrait-size:clamp(.5rem, calc(var(--card-width) * .26), .8rem);
  --neeko-control-padding:.06rem;
}

.gb-neeko-borrowed-tag {
  --neeko-tag-size:clamp(.9rem, calc(var(--card-width) * .3), 1.5rem);
  top:calc(var(--neeko-tag-size) * -.28);
  right:calc(var(--neeko-tag-size) * -.28);
  z-index:60;
  width:var(--neeko-tag-size);
  height:var(--neeko-tag-size);
  pointer-events:none;
  background:linear-gradient(150deg,#9af3d6,#3b9f86);
  border-radius:999px;
  padding:1.5px;
  position:absolute;
  box-shadow:0 0 0 1px #060e1ae6,0 2px 5px #00000080;
}

.gb-neeko-borrowed-tag[data-exhausted]:not([data-mirrored]) {
  top:auto;
  right:auto;
  bottom:calc(var(--neeko-tag-size) * -.28);
  left:calc(var(--neeko-tag-size) * -.28);
}

.gb-neeko-borrowed-tag[data-mirrored][data-exhausted] {
  right:auto;
  left:calc(var(--neeko-tag-size) * -.28);
}

.gb-board .gb-neeko-borrowed-legend[data-compact] .gb-neeko-borrowed-tag {
  --neeko-tag-size:clamp(.45rem, calc(var(--card-width) * .24), .75rem);
  top:auto;
  right:auto;
  bottom:calc(var(--neeko-tag-size) * -.28);
  left:calc(var(--neeko-tag-size) * -.28);
  padding:1px;
}

.gb-board .gb-neeko-borrowed-legend[data-compact] .gb-neeko-borrowed-tag[data-exhausted] {
  right:calc(var(--neeko-tag-size) * -.28);
  left:auto;
}

.gb-neeko-borrowed-tag-art {
  background:#162033;
  border-radius:999px;
  width:100%;
  height:100%;
  display:block;
  position:relative;
  overflow:hidden;
}

.gb-board .gb-neeko-borrowed-legend[data-compact] {
  right:auto;
  left:calc(var(--card-width) * .16 * (var(--neeko-legend-index,0) + 1));
  bottom:calc(var(--card-width) * .12 * (var(--neeko-legend-index,0) + 1));
  z-index:calc(-1 - var(--neeko-legend-index,0));
}
```

---

## Hashed support modules (score track, mini board preview, board-lines preview, setup overlay)

These use CSS-module hashed class names; included because they render board/score imagery.

### mini-board-preview — 33 rules

#### 1z02gj58hv2tl.css

```css
._4RegNa_root {
  --rail-compact:0;
  --rail-accent:#b7f4d9;
  border:0;
  width:100%;
  min-width:0;
  margin:0;
  padding:0;
  position:relative;
}

._4RegNa_root[data-tone=amber] {
  --rail-accent:#ffdab2;
}

._4RegNa_rail {
  isolation:isolate;
  width:100%;
  height:100%;
  position:relative;
}

._4RegNa_preview {
  width:min(100%,104px);
  height:218px;
}

._4RegNa_board {
  --ink-board-width:min(calc(var(--score-track-rail-width) * 1.35), calc(var(--battlefield-side-gap) - .5rem));
  --number-scale:1.08;
  grid-column:1/-1;
  grid-row:1 / span var(--ink-rows);
  width:var(--ink-board-width);
  height:min(calc(var(--track-row-size) * var(--ink-rows)), calc(var(--ink-board-width) * 2.1));
  translate:calc(var(--track-player-nudge) * -1) 0;
}

._4RegNa_board[data-variant=opponent] {
  translate:var(--track-opponent-nudge) 0;
}

._4RegNa_canvas {
  pointer-events:none;
  opacity:0;
  width:calc(100% + 48px);
  height:calc(100% + 48px);
  position:absolute;
  inset:-24px;
}

._4RegNa_root[data-ink-renderer=canvas] ._4RegNa_canvas {
  opacity:1;
}

._4RegNa_point {
  width:56%;
  height:calc(200% / (var(--point-count) + 1));
  color:#9fb0b1;
  -webkit-tap-highlight-color:transparent;
  background:0 0;
  border:0;
  border-radius:50%;
  padding:0;
  position:absolute;
  transform:translate(-50%,-50%);
}

button._4RegNa_point {
  cursor:pointer;
  pointer-events:auto;
}

._4RegNa_point[data-reached=true] {
  color:#dfeae4;
}

._4RegNa_point[data-active=true] {
  color:#fff6dc;
}

._4RegNa_point[data-winning=true],._4RegNa_point[data-terminal=true] {
  color:#c4b995;
}

._4RegNa_point[data-winning=true][data-reached=true],._4RegNa_point[data-terminal=true][data-reached=true] {
  color:#f3d18b;
}

._4RegNa_point:disabled {
  cursor:wait;
}

._4RegNa_point:focus-visible {
  outline:1px solid var(--rail-accent);
  outline-offset:-3px;
}

._4RegNa_poster {
  opacity:.9;
  pointer-events:none;
  width:100%;
  height:100%;
  position:absolute;
  inset:0;
  overflow:visible;
}

._4RegNa_root[data-ink-renderer=canvas] ._4RegNa_poster {
  visibility:hidden;
}

._4RegNa_number {
  color:inherit;
  --number-size:max(10px, min(calc(var(--track-node-size,34px) * .57), calc(210px / (var(--point-count) + 1)), 25px));
  font-family:Times New Roman,Times,serif;
  font-size:calc(var(--number-size) * var(--number-emphasis,1) * var(--number-scale,1));
  font-variant-numeric:lining-nums tabular-nums;
  -webkit-text-stroke:.14em #030a14d1;
  paint-order:stroke fill;
  text-shadow:0 0 .32em #030a14b8,0 1px 2px #030a14e6;
  pointer-events:none;
  font-weight:400;
  line-height:1;
  transition:font-size .16s cubic-bezier(.2,.7,.2,1),color .16s ease-out;
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
}

._4RegNa_number:before {
  --bead-tint:#4f88a6;
  content:"";
  z-index:-1;
  background:radial-gradient(34% 22% at 40% 30%, #ffffff38, transparent), radial-gradient(closest-side, color-mix(in srgb, var(--bead-tint) 18%, transparent), transparent);
  -webkit-backdrop-filter:blur(1.2px)brightness(1.18)saturate(1.1);
  backdrop-filter:blur(1.2px)brightness(1.18)saturate(1.1);
  border-radius:50%;
  width:1.8em;
  height:1.8em;
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  -webkit-mask-image:radial-gradient(closest-side,#000 35%,#0000);
  mask-image:radial-gradient(closest-side,#000 35%,#0000);
}

._4RegNa_point[data-reached=false] ._4RegNa_number:before {
  --bead-tint:#527080b3;
}

._4RegNa_point[data-active=true] ._4RegNa_number:before {
  --bead-tint:var(--rail-accent);
}

._4RegNa_point[data-winning=true] ._4RegNa_number:before,._4RegNa_point[data-terminal=true] ._4RegNa_number:before {
  --bead-tint:#c9a961;
}

._4RegNa_point[data-active=true] ._4RegNa_number {
  --number-emphasis:1.15;
}

/* @media (hover:hover) */
button._4RegNa_point:hover ._4RegNa_number {
  color:#fff5d4;
}

._4RegNa_root[data-compact=true] {
  --number-scale:1;
  width:100%;
  height:44px;
  translate:none;
}

._4RegNa_root[data-compact=true] ._4RegNa_point {
  width:calc(100% / var(--point-count));
  border-radius:4px;
  height:100%;
}

._4RegNa_root[data-compact=true] ._4RegNa_number {
  --number-size:max(10px, min(3.8vw, 17px, calc(150px / var(--point-count))));
}

/* @container (max-width:380px) */
._4RegNa_preview {
  --rail-compact:1;
  width:100%;
  height:44px;
}

[data-board-arrangement=phone-portrait] ._4RegNa_board {
  --rail-compact:1;
  flex:1;
  width:100%;
  height:100%;
}

[data-board-arrangement=phone-portrait] ._4RegNa_board ._4RegNa_number {
  --number-size:max(10px, min(13px, calc(150px / var(--point-count))));
}

._4RegNa_root[data-variant=opponent][data-compact=false] ._4RegNa_rail {
  transform:rotate(180deg);
}

._4RegNa_root[data-variant=opponent][data-compact=false] ._4RegNa_number {
  transform:translate(-50%,-50%)rotate(180deg);
}
```

### score-track-rail — 35 rules

#### 1z02gj58hv2tl.css

```css
.ZQOajW_point,.ZQOajW_connector {
  --tier-metal:#d39572;
  --tier-accent:#b27ae0;
  --tier-numeral:#8d8291;
  --tier-numeral-reached:#ecd0bb;
  --tier-numeral-goal:#a3918a;
  --tier-numeral-active:#fff3e8;
  --tier-numeral-glow:#b268e8bf;
  --weld-arc:#efd9ff;
  --weld-glow:#a35cff;
  --weld-hot:#fff4dc;
  --weld-ember:#ff8740;
  --weld-crest:#c98bff;
}

.ZQOajW_point[data-tier-point=signature_legend],.ZQOajW_connector[data-rail-style=signature_legend] {
  --tier-metal:#e9bb5f;
  --tier-accent:#5f8cff;
  --tier-numeral:#8e8f9d;
  --tier-numeral-reached:#f4e0a8;
  --tier-numeral-goal:#a59d89;
  --tier-numeral-active:#fffaea;
  --tier-numeral-glow:#f3b13fb3;
  --weld-arc:#dce8ff;
  --weld-glow:#3f74ff;
  --weld-hot:#fffbec;
  --weld-ember:#ffb43c;
  --weld-crest:#f2f8ff;
}

.ZQOajW_point {
  --track-label-size:calc(var(--track-node-size) * .5);
  width:var(--track-node-size);
  height:var(--track-node-size);
  color:var(--tier-numeral);
  font-size:var(--track-label-size);
  -webkit-tap-highlight-color:transparent;
  place-items:center;
  display:grid;
  position:relative;
}

.ZQOajW_art {
  pointer-events:none;
  width:100%;
  height:100%;
  position:absolute;
  inset:0;
  overflow:visible;
}

.ZQOajW_face {
  fill:#090f1d;
  stroke:var(--tier-metal);
  stroke-opacity:.2;
  stroke-width:1.3px;
  transition:stroke-opacity .22s;
}

.ZQOajW_point[data-reached=true] .ZQOajW_face {
  stroke-opacity:.48;
}

.ZQOajW_goalGuide {
  opacity:.5;
}

.ZQOajW_point[data-reached=true]:not([data-active=true]) .ZQOajW_goalGuide {
  opacity:.9;
  filter:none;
}

.ZQOajW_point[data-winning=true] {
  color:var(--tier-numeral-goal);
}

.ZQOajW_ornament {
  opacity:0;
  transition:opacity .26s ease-out;
}

.ZQOajW_point[data-active=true] .ZQOajW_ornament {
  opacity:1;
  transition:none;
}

.ZQOajW_reveal {
  fill:none;
  stroke:#fff;
  stroke-width:24px;
  stroke-dasharray:1;
  stroke-dashoffset:0;
}

.ZQOajW_trailHot,.ZQOajW_trailEmber {
  fill:none;
  stroke-linecap:round;
  opacity:0;
}

.ZQOajW_trailHot {
  stroke:var(--weld-hot);
  stroke-width:3px;
}

.ZQOajW_trailEmber {
  stroke:var(--weld-ember);
  stroke-width:5.6px;
  mix-blend-mode:plus-lighter;
}

.ZQOajW_glare {
  mix-blend-mode:screen;
  pointer-events:none;
}

.ZQOajW_arc>g {
  opacity:0;
}

.ZQOajW_arcInner {
  stop-color:var(--weld-arc);
}

.ZQOajW_arcOuter {
  stop-color:var(--weld-glow);
}

.ZQOajW_fxShape {
  transform-box:fill-box;
  transform-origin:50%;
}

.ZQOajW_fxHidden {
  opacity:0;
}

.ZQOajW_crest {
  fill:var(--weld-crest);
}

.ZQOajW_point[data-tier-point=legend] .ZQOajW_crest {
  mix-blend-mode:screen;
}

.ZQOajW_label {
  z-index:1;
  color:inherit;
  font-family:var(--font-heading), "Times New Roman", serif;
  font-variant-numeric:lining-nums tabular-nums;
  text-box:trim-both cap alphabetic;
  text-shadow:0 1px 2px #01040ce6;
  pointer-events:none;
  font-weight:700;
  line-height:1;
  transition:color .22s;
  position:relative;
}

.ZQOajW_point[data-reached=true] {
  color:var(--tier-numeral-reached);
}

.ZQOajW_point[data-active=true] {
  color:var(--tier-numeral-active);
}

.ZQOajW_point[data-active=true] .ZQOajW_label {
  text-shadow:0 1px 2px #01040cf2, 0 0 .35em var(--tier-numeral-glow);
}

.ZQOajW_interactive {
  cursor:pointer;
  -webkit-user-select:none;
  user-select:none;
}

:where(:root:not([data-sim-pointer=touch])) .ZQOajW_interactive:hover .ZQOajW_face {
  stroke-opacity:.72;
}

.ZQOajW_interactive:focus-visible {
  outline:2px solid color-mix(in srgb, var(--tier-metal) 80%, white);
  outline-offset:.12rem;
}

.ZQOajW_connector {
  width:100%;
  height:100%;
  display:block;
  overflow:visible;
}

.ZQOajW_connectorShade,.ZQOajW_connectorLine {
  fill:none;
  stroke-linecap:round;
}

.ZQOajW_connectorShade {
  stroke:#020915;
  stroke-opacity:.45;
  stroke-width:3px;
}

.ZQOajW_connectorLine {
  stroke:var(--tier-metal);
  stroke-opacity:.22;
  stroke-width:1px;
  transition:stroke-opacity .24s,stroke-width .24s;
}

.ZQOajW_connector[data-reached=true] .ZQOajW_connectorLine {
  stroke-opacity:.62;
  stroke-width:1.4px;
}
```

### board-lines-preview — 3 rules

#### 0mq6k3dqx1du5.css

```css
.hcW62G_stage {
  place-items:center;
  width:100%;
  height:104px;
  display:grid;
}

.hcW62G_frame {
  border:1px solid #a5bee642;
  border-radius:.08rem;
  width:min(100%,9.5rem);
  height:4.9rem;
  position:relative;
}

.hcW62G_frame[data-board-lines] {
  --ink-corner:1.25rem;
  --ink-tick:.36rem .9rem;
  --lines-edge:.36rem;
}
```

### showcase-rail — 14 rules

#### 1z02gj58hv2tl.css

```css
.x5f_1a_vertical {
  width:100%;
  height:104px;
  display:block;
}

.x5f_1a_horizontal {
  width:100%;
  height:56px;
  display:none;
}

.x5f_1a_vertical[data-preview-layout=phone] {
  display:none;
}

.x5f_1a_horizontal[data-preview-layout=phone] {
  display:block;
}

/* @media (pointer:coarse) and (max-width:600px) and (orientation:portrait) */
.x5f_1a_vertical[data-preview-layout=auto] {
  display:none;
}

/* @media (pointer:coarse) and (max-width:600px) and (orientation:portrait) */
.x5f_1a_horizontal[data-preview-layout=auto] {
  display:block;
}

.x5f_1a_showcaseFrame {
  place-items:center;
  width:100%;
  display:grid;
  container-type:inline-size;
}

.x5f_1a_showcaseRail {
  --track-node-size:1.25rem;
  --track-node-winning-size:calc(var(--track-node-size) * 1.14);
  --track-row-size:calc(var(--track-node-size) * 1.26);
  --score-track-column-gap:calc(var(--track-node-size) * .34);
  --score-track-rail-width:calc(var(--track-node-size) * 2 + var(--score-track-column-gap));
  --score-track-stagger-offset:calc(var(--track-row-size) * .5);
  --score-track-terminal-offset:calc(var(--track-node-size) * .42);
  --battlefield-side-gap:calc(var(--score-track-rail-width) * 1.35 + .5rem);
  width:var(--score-track-rail-width);
  grid-template-columns:var(--track-node-size) var(--track-node-size);
  grid-auto-rows:var(--track-row-size);
  place-items:center;
  column-gap:var(--score-track-column-gap);
  pointer-events:none;
  padding-top:2.1rem;
  display:grid;
}

.x5f_1a_showcaseRow {
  --track-node-size:min(1.6rem, 18cqi);
  --track-node-winning-size:calc(var(--track-node-size) * 1.16);
  pointer-events:none;
  flex-direction:row-reverse;
  justify-content:space-between;
  align-items:center;
  width:min(100%,17rem);
  height:3rem;
  display:flex;
}

.x5f_1a_membershipRow {
  --track-node-size:min(2.4rem, 13cqi);
  width:min(100%,21rem);
  height:3.6rem;
}

.x5f_1a_showcaseRow>div {
  width:var(--track-node-size);
  flex-shrink:0;
  transform:translate(0,0);
}

.x5f_1a_showcaseRow>div:has([data-winning=true]) {
  width:var(--track-node-winning-size);
}

.x5f_1a_showcaseRow>span {
  display:none;
}

.x5f_1a_showcaseRow>fieldset {
  height:100%;
}
```

### setup-overlay — 15 rules

#### 3of7_4i02s81l.css

```css
.RsxO5q_layer {
  z-index:-1;
  pointer-events:none;
  position:absolute;
  inset:0;
}

.RsxO5q_litCard {
  background:#07101b;
  position:absolute;
  overflow:hidden;
  box-shadow:0 0 0 1px #e8d6b04d;
}

.RsxO5q_strip {
  pointer-events:auto;
  flex-wrap:wrap;
  gap:.5rem;
  max-width:calc(100% - 2rem);
  display:flex;
  position:absolute;
  top:1rem;
  left:1rem;
}

.RsxO5q_inlineStrip {
  pointer-events:auto;
  flex-wrap:wrap;
  align-items:center;
  gap:.4rem;
  display:flex;
}

/* @media (min-width:980px) */
.RsxO5q_inlineStrip:not([data-multiple-opponents]) {
  display:none;
}

/* @media (min-width:980px) */
[data-setup-overlay]:has([data-setup-opponent-strip=inline][data-multiple-opponents]) .RsxO5q_layer {
  display:none;
}

/* @media (max-width:979.98px) */
[data-setup-overlay]:has([data-setup-opponent-strip=inline]) .RsxO5q_layer {
  display:none;
}

/* @media (max-width:979.98px) */
.RsxO5q_inlineStrip[data-multiple-opponents] {
  flex-basis:100%;
}

.RsxO5q_plate {
  background:linear-gradient(145deg,#10284af5,#061226f2);
  border:1px solid #c7b0839e;
  align-items:center;
  gap:.25rem;
  padding:.25rem;
  display:flex;
  box-shadow:inset 0 0 0 1px #e8d6b02e,0 12px 28px #02081394;
}

.RsxO5q_inlineStrip .RsxO5q_plate {
  border-color:#c7b0836b;
  padding:.2rem;
  box-shadow:inset 0 0 0 1px #e8d6b01a;
}

.RsxO5q_plateLabel {
  color:#fffc;
  letter-spacing:.08em;
  text-transform:uppercase;
  white-space:nowrap;
  padding:0 .3rem 0 .15rem;
  font-size:.6rem;
  font-weight:600;
}

.RsxO5q_mini {
  aspect-ratio:5/7;
  cursor:default;
  touch-action:pinch-zoom;
  -webkit-touch-callout:none;
  background:#07101b;
  border:1px solid #e8d6b03d;
  border-radius:.14rem;
  flex-shrink:0;
  width:2.25rem;
  padding:0;
  transition:border-color .14s;
  position:relative;
  overflow:hidden;
}

.RsxO5q_inlineStrip .RsxO5q_mini {
  width:1.6rem;
}

.RsxO5q_mini:hover,.RsxO5q_mini:focus-visible {
  border-color:#e8d6b0;
}

.RsxO5q_mini:focus-visible {
  outline-offset:2px;
  outline:2px solid #ebc69bcc;
}
```

