# Board chunk 35k–48k — reverse-engineering spec

Source: `.recon/pretty/playapp/0xawjzm3yjpr1.js` (65 017 lines). This file is **one single
Turbopack module**, id `430427` (module tuple `[<script>, 430427, (e)=>{…}]` at lines 1–65011;
the second module `2642` at 65012–65017 only exports `supplementarySidebar`). All module-level
exports are declared once via `e.s([...], 430427)` at **line 63977**.
All minified identifiers are meaningless; everything below is keyed off string literals,
`className`s, `data-*` attributes and logic.

React Compiler memo-cache boilerplate (`(0,n.c)(N)`, `x[i] !== v ? (…) : (v = x[i])`) is
ignored throughout.

Conventions used below:
* `[A]` = "identifier present in this range".
* `[X→line]` = "identifier is defined *outside* this range; exact line given".

---

## 0. Scope, boundaries, and where the requested identifiers actually live

The requested identifiers are **not all inside 35 000–48 600**. Verified locations:

| identifier | line(s) | inside range? |
|---|---|---|
| `data-player-identity-rail` | 15847 (`"self"`), 15902 (`"opponent"`) | ❌ |
| `data-board-opponent-scores` / `data-board-player-scores` | 15978, 15809 | ❌ |
| `data-miniature-area` | 29799–30046 (`base`,`runes`,`hand`,`legend`,`champion`,`mainDeck`,`trash`) | ❌ |
| `data-compact-opponent-board` | 34249 | ❌ (just below range) |
| `data-realtime-presence-ring` | **does not exist**; the real attribute is `data-compact-realtime-presence-ring` | ✅ at 34287 |
| `data-compact-player-menu-*` | 34423 `-trigger`, 34490 `-copy`, 34539 `-silence`, 34567 `-report` | ❌ |
| `data-compact-player-muted-indicator` | 34513 | ❌ |
| `data-compact-player-color-accent` | 34295 | ❌ |
| `data-player-color` | 16194, 20035, 20063, 20376, 34255 | ❌ (nearest 34255) |
| `data-board-turn-controls` | 48454 `[A]` | ✅ |
| `data-board-phase-status` | 48512 `[A]` | ✅ |
| `data-end-turn-status` | 63075 | ❌ |
| `data-extra-turns-pending` | 48455 `[A]` | ✅ |
| `gb-turn-glass` | 48317, 48341 `[A]` | ✅ |
| `time-warp-*` | 562–1216 (flourish + icons), 1219–1432 (dialog), 15148–15160 (chain badge), 33113–33147 (compact rail), 48244–48385 `[A]` | ✅ (partial) |
| `data-card-drag-ghost` | 35040 `[A]` | ✅ |
| `data-drag-origin-persist-until` | 35267 `[A]` | ✅ |
| `data-ghost-zone` | 42267 `[A]` | ✅ |
| `data-drop-zone-root` | 26009, 27765, 28944, **42663, 42833** `[A]`, 50914… | ✅ (battlefield) |
| `data-ordered-drop-preview-index` | 27766, 28945, **42666, 42836** `[A]` | ✅ (battlefield) |
| `gb-deck-peek*` / `deck-peek:*` | 38469, 38502, 39329, 39422, 39491 `[A]`; ids 61956–62043 `[X→61956]` | ✅ (render) / ❌ (ids) |
| `data-pile-slot` | 8556, 8574, 24387…, **36292/37181 only as selectors** `[A]` | ❌ (definition 24464) |
| `data-pile-count`, `data-pile-owner`, `data-pile-count-placement` | 24466, 24465, 24387, 27092 | ❌ |
| `data-pile-counter` | 24092 | ❌ |
| `data-banished-pile-button` | 25178 | ❌ |
| `data-stack-depth`, `data-stack-presentation`, `data-stack-top-card-centered` | 24467/24468/24469, 24687–24689, 27769/27770 | ❌ |
| pile stack visual constants (`sH`, `sF`, `sW`) | 24099–24180 | ❌ |
| `tablet-*`, `phone-*` | 44864–45590 `[A]` (plus CSS) | ✅ |
| `data-tablet-panel` | 45444 `"log"`, 45500 `"chat"`, 45558 `"sidebar"` `[A]` | ✅ |
| `data-sidebar-room-header` | 46421 `[A]` | ✅ |
| `data-sidebar-turn-indicator`, `-room-metadata`, `-room-label`, `-header-tools` | 46428, 46460, 46502, 46536 `[A]` | ✅ |
| `data-sidebar-presentation` | 63081 | ❌ |
| `data-hover-preview-sidebar` | 45588 `[A]` (also read at 50943) | ✅ |
| `game-settings` | 37538 `data-game-settings-sample`, 37790 `data-game-settings-panel`, 37999/38002 trigger `[A]` | ✅ |
| `game-info-dialog` | 7834, 9037, 14292 | ❌ |
| emote picker / chat composer / game-log entries | **not in this chunk at all** (injected as `log`/`chat`/`supplementaryPanel` props, see §6) | ❌ |

Chunk-region map (top-level declarations, indentation-4 / `function` boundaries):

```
34906–35477  drag-ghost component + drag helpers/consts
35478–37420  uV  — the giant useCardDragAndDrop hook (pointer + native HTML5 DnD)
37421–38074  monitor/volume icons, game-settings sample + slider
37687–38071  u9  — game-settings popover trigger + panel
38076–38810  deck-peek: empty state, per-card action builders, button systems, "More" menu
38810–39790  deck-peek per-card actions, pile popover (trash/banished), deck-peek panel,
             opponent deck-peek overlay
39789–40396  mR/mq — opponent hand redaction + battlefield might panel
39865–40279  m$ — "opponent left" alert dialog
40397–41415  mU/m1/m2 — battlefield might panel, conquer-assist prompt, showdown prompt
41416–41746  m4 — battlefield prompt placement solver (occlusion costing)
41595–41746  po — card face/flip shell
41747–44655  ps/pm/pT/pB/pO — battlefield surfaces, board cards, opponent player layer,
             zone-move flights; presence bridges pG/pV/pQ/pJ
44656–45611  hu — the tablet/phone sidebar shell (rail + rail groups + log/chat/sidebar panels)
45612–46341  hg (rewind confirmation dialog), hw (BO3 game-timing badge)
46342–46634  hk — sidebar room header (turn indicator, clocks, room code, tools)
46641–46953  hI — spell-target selection overlay
46960–47584  hA/hM/hD — rewind/forward transition FX
47585–48084  ui-state reducer (hL/hB/…), hotkey-state helpers, misc predicates
47999–48467  fU/fZ/fX — turn control button class, phase label, turn controls
48468–48547  fG — board phase status chip
48547–48600+ fY/f0/f1/f5/f4 — board-model helpers feeding the board root
```

External helper modules referenced by name below (all *outside* this file, so their bodies are
not quoted): `dN`=9961 (drag/drop accept rules), `dS`=929289 (drag render intent),
`dP`=426582 (geometry/wheel consts), `eO`=272907 (zone/card queries), `of`=147801 (card-face
class constants), `tp`=298551 (card art / card back / pile popover `tp.U` / kbd badge `tp.F`),
`oI`=663456 (card-size context), `rE`=644093 (room-action buttons/bar; `rE.h` button, `rE.v` icon,
`rE.m` bar), `rH`=533812 (board customization provider `rH.M`, board field `rH.t`, line drawing
`rH.w`), `iW`=980303 (identity badge `iW.z` / score track `iW.a` / action timer `iW.G`),
`ev`=313578 (time-warp glyphs, `ev.Z` ring, `ev.v` clock), `K`=711839
(label/tooltip wrapper `K.f`), `tc`=779142 (preferences store, `aQ()`), `te`=701010 (`te.O` clamp),
`F`=858709 (`F.b` client entry id), `dY`=938822 (`dY.S`/`dY.P` transform builders),
`dV`=612518 (flip card), `ew`=365151 (dialog hook `ew.f`), `ex`=244534 (portal root),
`nq`=957423 (static asset URL), `cw`=719377 (card-size bounds), `cC`=720153 (preview-size bounds),
`u3`=608607 (SFX volume bounds), `u6`=675519 (opponent-cosmetics bounds), `pF`=537435 (ping equality),
`iq`=958745 (selector-hook wrapper `iq.I`), `B`=946505 (store subscription `B.q`/`B.V`),
`ue/ur/u5/uJ/m.f/f.X/eU.f/c9.f/…` (lucide-derived icons; `f.X` = X, `eU.f` = check, `c9.f` = copy).

---

## 1. Player identity rail / compact opponent board / miniature player layer

### 1.1 The per-player colour system (line 1448–1487) — **core, used everywhere**

```js
let eP = ["p1", "p2", "p3", "p4"],
  eS = {
    p1: { solid: "#69c8e6", border: "rgba(105, 200, 230, 0.68)", glow: "rgba(105, 200, 230, 0.14)", surface: "rgba(105, 200, 230, 0.1)",  text: "#cef4ff" },
    p2: { solid: "#de7c77", border: "rgba(222, 124, 119, 0.68)", glow: "rgba(222, 124, 119, 0.14)", surface: "rgba(222, 124, 119, 0.1)",  text: "#ffe0dd" },
    p3: { solid: "#d7b260", border: "rgba(215, 178, 96, 0.68)",  glow: "rgba(215, 178, 96, 0.14)",  surface: "rgba(215, 178, 96, 0.1)",   text: "#ffedc9" },
    p4: { solid: "#a995e8", border: "rgba(169, 149, 232, 0.68)", glow: "rgba(169, 149, 232, 0.14)", surface: "rgba(169, 149, 232, 0.1)",  text: "#e9e1ff" },
  };
function eN(e) {                                   // seat index → colour key
  return eP[(Number.isFinite(e) ? Math.max(0, Math.trunc(e)) : 0) % eP.length] ?? "p1";
}
```

* Colour key is chosen **purely by seat index modulo 4** (`eN`). `playerColorKeyByPlayerId`
  is the map name used by the board root (`eN(t)` at line 57106 for socket events).
* Fallbacks when a player has no colour key (target arrows, line 16183–16188):
  self → `solid = "rgba(135,231,255,0.96)"`, `glow = "rgba(95,201,230,0.34)"`;
  opponent → `solid = "rgba(255,200,132,0.96)"`, `glow = "rgba(255,170,90,0.34)"`.
* Arrow-head marker ids: `` `gb-target-arrow-head-${playerColorKey}` `` else
  `` `gb-target-arrow-head-${"self"|"opponent"}` `` (line 16187).
* Turn-rail gold/green accents used by the sidebar header (46429): self = `bg-[#78ddb7]`,
  opponent = `bg-[#f4d06f]`. BO3 breakdown rails: perspective `bg-[#78ddb7]` / text
  `text-[#bdebdc]`, opponent `bg-[#ffbb6e]` / text `text-[#ffd39e]` (46195–46205).
* Colour values are applied **inline** (`style={{borderColor, background, color, boxShadow}}`),
  never via CSS attribute selectors — there are no `[data-player-color=…]` rules in the CSS.

### 1.2 The miniature/compact opponent board (lives at 34249–34590, immediately below this range)

Structure (verbatim, for cross-referencing):

```
<article
  data-compact-opponent-board={playerId}
  data-active="true|false"          data-active-size="emphasized|default"
  data-density                      data-relation="ally|opponent"
  data-player-label                 data-player-color={playerColorKey}
  data-realtime-online="true|false" data-realtime-hover="true|false"
  data-realtime-ping="true|false"   data-player-muted="true|false"
  data-has-silence-action="true|false" data-has-report-action="true|false"
  aria-current={active && "true"} aria-label={t("sim.compactPlayerScoreSummary",{player,status,score,victoryScore})}
  className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-[0.3rem] border gb-board-root-bg
             transition-[border-color,box-shadow,opacity] duration-180 ease-out motion-reduce:transition-none
             [container-type:inline-size]"
  + relation==="ally"  ? "border-[rgba(105,221,179,0.48)] shadow-[inset_0_0_0_1px_rgba(105,221,179,0.08),0_8px_18px_rgba(2,8,18,0.2)]"
                       : "border-[rgba(147,183,222,0.3)] shadow-[inset_0_0_0_1px_rgba(220,233,249,0.035),0_8px_18px_rgba(2,8,18,0.2)]"
  + active               && "border-[rgba(104,213,255,0.72)] shadow-[inset_0_0_0_1px_rgba(104,213,255,0.12),0_0_0_1px_rgba(78,190,237,0.12),0_0_20px_rgba(54,167,220,0.13)]"
  + muted                && "opacity-65 grayscale-[0.3]"
>
  <BoardFieldBackground customization className="inset-[0.08rem] z-0 rounded-[0.22rem]" sizes loading="eager" />   // rH.t
  {showRing && ring && <span data-compact-realtime-presence-ring
      className="pointer-events-none absolute inset-px z-50 rounded-[0.26rem] border"
      style={{borderColor: ring.border, boxShadow:`inset 0 0 10px ${ring.glow}`}} aria-hidden />}
  {ring && <span data-compact-player-color-accent
      className="pointer-events-none absolute left-[0.42rem] top-0 z-50 h-px w-[2.25rem] opacity-60"
      style={{backgroundColor: ring.solid, boxShadow:`0 0 7px ${ring.glow}`}} aria-hidden />}
  <div className="pointer-events-none absolute inset-0 z-1 gb-board-field-vignette opacity-80" aria-hidden />
  <header className="pointer-events-none absolute left-0 right-[2.55rem] top-0 z-40 flex h-[1.42rem] min-w-0
                     items-center gap-[0.3rem] bg-[linear-gradient(180deg,rgba(4,13,31,0.82),rgba(4,13,31,0.52)_62%,transparent)]
                     px-[0.42rem]">
    <span class="h-[0.38rem] w-[0.38rem] shrink-0 rounded-full border border-white/25"
          + muted ? "bg-[#6e7d8e]"
          : !ring && active ? "bg-[#68d9ff] shadow-[0_0_8px_rgba(83,205,255,0.86)]"
          : ring || relation!=="ally" ? (ring ? undefined : "bg-[#c76780]")
          : "bg-[#69ddb3]"                                    // ally, no ring
          style={!muted && ring ? {backgroundColor:ring.solid, opacity: active||showRing ? 1 : 0.55, boxShadow: (active||showRing) ? `0 0 8px ${ring.border}` : undefined} : undefined}/>
    <span class="shrink-0 rounded-[0.12rem] border border-[#8da3bb]/25 bg-[#10233a]/72 px-[0.2rem] py-[0.08rem]
                 text-[0.42rem] font-black leading-none tracking-[0.04em] text-[#c8d7e7]">{playerLabel}</span>
    <span class="min-w-0 truncate text-[0.66rem] font-bold tracking-[0.01em] text-[#eef6ff]">{name}</span>
    <ActionTimer variant="opponent" compact />                        // iW.G
    <span class="shrink-0 rounded-full border px-[0.26rem] py-[0.08rem] text-[0.4rem] font-bold uppercase tracking-[0.08em]"
          + ally ? "border-[#69ddb3]/35 bg-[#69ddb3]/10 text-[#a8f0d4]"
                 : "border-[#d3758c]/30 bg-[#d3758c]/10 text-[#f1b6c3]">{teamLabel ?? "Team N"}</span>
    <span class="ml-auto shrink-0 rounded-full border border-[#66d5ff]/35 bg-[#4fc9f5]/10 px-[0.3rem] py-[0.08rem]
                 text-[0.4rem] font-extrabold uppercase tracking-[0.09em] text-[#98e5ff]">{t("sim.compactTurn")}</span>
    <span data-compact-realtime-activity={ping?"ping":"hover"}
          class="shrink-0 rounded-full border border-[#8da3bb]/24 bg-[#10233a]/72 px-[0.25rem] py-[0.07rem]
                 text-[0.38rem] font-bold uppercase tracking-[0.07em] text-[#c8d7e7]" + (!active && "ml-auto")
          >{t(ping?"sim.compactPing":"sim.compactViewing")}</span>
  </header>
  <div ref={menuAnchorRef} className="absolute right-[1.3rem] top-[0.16rem] z-70"
       onClick={stopPropagation} onContextMenu={preventDefault+stopPropagation}>
     … menu trigger + menu (see 1.3)
  </div>
</article>
```

### 1.3 Compact player context menu (34293–34589)

Trigger (verbatim):

```
<button ref type="button"
  data-compact-player-menu-trigger={playerId}  data-muted="true|false"
  aria-label={t("playerMenu",{playerName})} aria-haspopup="menu" aria-expanded aria-controls={menuId}
  title={t("playerMenu",{playerName})}
  className="inline-flex h-[1.04rem] w-[1.04rem] items-center justify-center rounded-[0.12rem] border
             border-[rgba(145,179,214,0.25)] bg-[rgba(10,24,42,0.82)] text-[#bdd3e8]
             shadow-[inset_0_1px_0_rgba(245,250,255,0.06)]
             transition-[border-color,background-color,color] duration-150
             hover:border-[rgba(156,214,238,0.42)] hover:bg-[rgba(27,52,76,0.94)] hover:text-[#edf8ff]
             focus-visible:border-[rgba(165,226,248,0.58)] focus-visible:outline-none
             focus-visible:ring-1 focus-visible:ring-[rgba(126,207,239,0.38)]">
  <ue.f className="h-[0.72rem] w-[0.72rem]" strokeWidth={2.2} />   // dots/ellipsis icon
</button>
```

Muted indicator (`data-compact-player-muted-indicator`, 34513):

```
<span role="img" aria-label={t("opponentSilenced")} title={t("opponentSilenced")}
  className="pointer-events-none absolute -bottom-[0.18rem] -left-[0.18rem] inline-flex h-[0.58rem] w-[0.58rem]
             items-center justify-center rounded-full border border-[rgba(218,187,122,0.44)]
             bg-[rgba(34,28,25,0.94)] text-[#d9bd83] shadow-[0_1px_4px_rgba(3,8,18,0.42)]">
  <ur.f className="h-[0.38rem] w-[0.38rem]" strokeWidth={2.5} />   // bell-off
</span>
```

Menu container (34495):

```
<div id role="menu" aria-label={t("playerMenu",{playerName})}
  className="absolute right-0 top-[calc(100%+0.18rem)] z-80 grid w-[min(11.8rem,calc(100cqw-0.8rem))] gap-[0.08rem]
             overflow-hidden rounded-[0.16rem] border border-[rgba(155,184,220,0.3)]
             bg-[linear-gradient(180deg,rgba(14,25,42,0.99),rgba(7,13,25,0.99))] p-[0.18rem] text-[#dfeeff]
             shadow-[inset_0_1px_0_rgba(245,250,255,0.08),0_14px_30px_rgba(3,8,18,0.52)] backdrop-blur-xl"
  onKeyDown={…ArrowUp/ArrowDown/Home/End roving focus over "[role='menuitem']:not(:disabled), [role='menuitemcheckbox']:not(:disabled)"…}>
```

Items (exact labels + actions):

| data-attr | role | label (i18n keys) | sub-label | action |
|---|---|---|---|---|
| `data-compact-player-menu-copy` (34490) | `menuitem` | player name (truncated) | — | `onClick: () => void en()` → clipboard copy; icon `c9.f`; on success `eU.f` + `t("copied")`; on failure `t("copyFailed")`. `aria-label={t("copyPlayerName",{playerName})}`, `title={t("copyUsername")}`. `aria-live="polite"` status span, `text-[#8ef0d6]` on `"copied"`, `text-[#f0a8a8]` on `"failed"`. |
| `data-compact-player-menu-silence` (34539) | `menuitemcheckbox`, `aria-checked={muted}` | `t("silencePlayer")` | `t("silenceDescription")` | toggles mute; trailing `<ua.f enabled={muted} />` switch |
| `data-compact-player-menu-report` (34567) | `menuitem` | `t("reportPlayer")` | `t("reportDescription")` | opens report flow; trailing `<ut.f className="h-[0.72rem] w-[0.72rem] text-[#d1a9a9]" strokeWidth={1.9}/>` |

Both rows share: `className="grid min-h-[2.4rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.42rem] rounded-[0.1rem] px-[0.4rem] py-[0.28rem] text-left text-[#e8f4ff] transition-[background-color,color] duration-150 hover:bg-[rgba(38,65,91,0.54)] focus-visible:bg-[rgba(45,74,101,0.62)] focus-visible:outline-none"`.
Label text style: `block truncate text-[0.66rem] font-bold leading-tight`; sub-label:
`mt-[0.08rem] block text-[0.5rem] font-semibold leading-tight text-[#8fa6bf]`.

Menu visibility is driven by two flags computed upstream: `hasSilenceAction` (`data-has-silence-action`)
and `hasReportAction` (`data-has-report-action`) — items are *not rendered* when unavailable.
A local copy-state machine (`"idle" | "copied" | "failed"`) resets after 1600 ms
(`window.setTimeout(() => O("idle"), 1600)`, line 34244).

### 1.4 The full-size identity rail (15847 / 15902 — outside range, quoted for completeness)

```
<div data-player-identity-rail="self"
     className="absolute left-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)]
                bottom-(--identity-badge-edge-inset) z-13 flex translate-x-(--identity-badge-player-nudge)
                items-center pointer-events-none"
     style={{height:"var(--identity-badge-height)"}}>
  <div className="relative flex items-center justify-center">
    <IdentityBadge name variant="player" identity matchWins totalWinsNeeded actionTimer menu />   // iW.z
    <LocalRealtimeBadge phase localRealtimeConnected />                                          // iF (15469)
  </div>
</div>

<div data-player-identity-rail="opponent"
     className="absolute top-(--identity-badge-edge-inset)
                right-[calc(var(--track-edge-inset)+var(--score-track-rail-width)/2-var(--identity-badge-width)/2)]
                z-13 flex -translate-x-(--identity-badge-opponent-nudge) items-center pointer-events-none"
     style={{height:"var(--identity-badge-height)"}}>
  <div className="relative flex items-center justify-center">
    <IdentityBadge name variant="opponent" identity matchWins={bo3 ? wins : 0} totalWinsNeeded={2*(bo3)} actionTimer menu muted />
    <OpponentPresenceBridge phase opponent roomMode opponentPresenceStatusStore />   // iK
  </div>
</div>
```

Turn glow rails (CSS, `.identityRailTurn*`, `identityRailTurnPlayer|Opponent`, `…On|…Off`):
`--identity-rail-clip-ms:.52s; --identity-rail-opacity-ms:.52s; --identity-rail-side-bleed:.42rem;
--identity-rail-side-cut:calc(var(--identity-rail-side-bleed) * -1)`. On = `:before{opacity:.52}`,
`:after{opacity:.3}`; Off clips via `clip-path: inset(0 X 100% X round .96rem)` (opponent) /
`inset(100% X 0 X round .96rem)` (player) — i.e. the glow sweeps from the player's side.
`--identity-rail-pad` / `--identity-rail-vpad` are set from `p6(0.64, g)` / `p6(0.62, g)`
(line 47966–47967, in the board-root layout code just above this range).

### 1.5 Presence / hover / ping / mute plumbing **inside this range**

* Selectors + stores (44080–44224):
  * `pz = (e) => e.boardCardAnimations`
  * `pL = (e) => e.zoneMoveFlights`
  * `pN()` → fresh `{handEntryAnimations, runeAreaCardAnimations, boardCardAnimations, zoneMoveFlights, hiddenHandCardIds}` (all `Map`/`Set`)
  * `pD = pN()`, `pR() = B.V(pN())`, `pI = new Set()`, `pP/pS = new Map()`
  * `pM(e)` = composite change key `` `${handEntryAnimations.size}:${boardCardAnimations.size}:${runeAreaCardAnimations.size}:${zoneMoveFlights.size}` ``
  * `pq()` = `` "u" < typeof document || !document.hidden `` (visibility store getter), `pZ` = subscribe that installs a single `visibilitychange` listener, `pX = () => !0` (server snapshot). `pU()` fans out to all subscribers.
* **Presence bridge components (render `null`, push into a presence store):**
  * `ug` (34906) — destructures `presenceStore` + rest, subscribes `hoveredCardIdByPlayerId` (`uf`) and `cardPingByPlayerId` (`ub`) via `(0,B.q)(store, selector, fallback)`, renders `uh` (local sync writer).
  * `pG` (44228, `memo`) — the **local presence sync writer**. Props:
    `playerId, hoveredCardId, presenceStatus, cardPing, boardEmote,
     onHoverCardIdChange, onPresenceStatusChange, onCardPingChange, onBoardEmoteChange`.
    Behaviour: keyed off `useSyncExternalStore(pZ, pq, pX)` (tab visibility); maintains 4
    `useRef`s to avoid duplicate emits; when `playerId` is falsy or the tab is hidden it calls
    `A()` which emits `null` for presence/hover/ping/emote. Presence default:
    `status ?? (anythingActive ? {online:true, lastDisconnected:null} : null)`.
    Ping/emote/hoover are suppressed (`null`) while `!online`. Emote equality is
    `emoteId + emoteAt`; ping equality via `(0,pF.o)`.
  * `pV` (44375, `memo`) — opponent wrapper, prefixes every callback with
    `(e, t) => handler(t)` (server id already known).
  * `pQ` (44482, `memo`) — `{presenceStore, silenced, ...rest}`: derives
    `hoveredCardId/cardPing/boardEmote` for `rest.playerId` via `pY(store, playerId)` and
    **nulls out ping + emote when `silenced`**.
  * `pJ` (44516, `memo`) — same but for `rest.opponentId`, feeding `pV`.
  * `pY(e,t)` (44444) — three separate `useSyncExternalStore`-ish subscriptions
    (`(0,B.q)(e, sel, null)`) for hoveredCardId / cardPing / boardEmote of one player id.
* **Card ping animation constants** (44550–44563): `p1 = 3.58`, `p2 = 0.36`, `p5 = 0.72`,
  `p4 = 1450`, `p3 = 670`; `p0(e,t,r=false) = Math.max(0, e - Math.max(0, t - p2) - (r ? 2.75 : p1) - (r ? 0.35 : p5))`.
  Helpers: `p8(e,t,r) = Math.max(t, Math.min(r, e))` (clamp), `p6(e,t) = Number((e*t).toFixed(3))`,
  `p7(e,t) = (typeof e === "number" && Number.isFinite(e) && e > 0) ? e : t`.
* **Opponent player layer with flights** — `pT` (43924): props
  `{flightStore, authoritativeResetPending, opponentBoard, forcedHiddenOpponentHandCardIds, layerProps}`;
  subscribes `boardCardAnimations` through `pB` path and renders `cc` (`= (0, y.memo)(…)` at 30116,
  the actual opponent player layer) with `{...layerProps, model}`.
* **`pB`** (44081) clones the board model with `topZoneCardAnimations` (substituted with `pS`
  while `authoritativeResetPending`) and renders `pm` (the battlefield).
* **`pO`** (44113, memo) renders all `zoneMoveFlights` values through `p$` under the board
  customization provider (`rH.M`). `p$` (44135) is the **card flight** element:

```
<motion.div initial={false}
  animate={{ ...springish({x: active?offsetXPx:0, y: active?offsetYPx:0, rotate: active?endRotateDeg:startRotateDeg}),
             opacity: active ? 0.92 : 1 }}
  transition={{duration: eO.F/1e3, ease:[0.22,0.9,0.2,1]}}
  className="pointer-events-none fixed z-204"
  style={{left:startLeftPx, top:startTopPx, width:widthPx, height:heightPx}}>
  <div className="absolute inset-0 perspective-[980px]">
    <motion.div animate={flipFor(active?endBack:startBack)} transition={{duration:…, ease:[0.22,1,0.36,1]}}
                className="relative h-full w-full" style={{transformStyle:"preserve-3d"}}>
      <div className="absolute inset-0 backface-hidden [-webkit-backface-visibility:hidden]">
        <div className="absolute inset-0 overflow-hidden rounded-[0.22rem] border border-[rgba(165,184,207,0.22)]
                        bg-[linear-gradient(165deg,rgba(49,73,99,0.96),rgba(34,53,74,0.94))]
                        shadow-[inset_0_0_0_1px_rgba(188,206,228,0.06),0_10px_20px_rgba(4,10,24,0.42)]">
          <GameCardArt card imageInsetPx={0} imageProfile="hand" />
        </div>
      </div>
      <div className="absolute inset-0 backface-hidden [-webkit-backface-visibility:hidden] transform-[rotateY(180deg)]">…<CardBack insetPx={0}/></div>
    </motion.div>
  </div>
</motion.div>
```

* **Opponent hand redaction** — `mR` (39789): `{revealed, board, retainHiddenCardsForInspection, playerId}`.
  When not revealed it returns a board whose `handRevealToOpponent:false` and whose hand is
  either `hand.map(c => ({...c, hidden:true}))` (inspection) or placeholder cards
  `{id: (0,mS.H)({playerId, zone:"hand", index}), name:"", source:"mainDeck", exhausted:false, createdAt:index, isPlaceholder:true}`
  — memoised in a `WeakMap` (`mN`) keyed by hand array → Map<playerId, cards>.
  `mw(e) = !e.isPlaceholder && e.name.trim().length > 0` decides whether an opponent
  deck-peek card is actually revealed.

---

## 2. Turn / phase indicator, end-turn control, time-warp

### 2.1 `fX` — turn control (lines 48139–48467, `(0,y.memo)(function(e){…})`)

Props: `showTurnControl=true, beginningPhaseAdvance, canEndTurn, canSwitchSeat, compactTurnControl,
description, extraTurnCount, canCancelExtraTurn, label, onCancelExtraTurn, onEndTurn, onSwitchSeat,
switchSeatAriaLabel, turnContextKey`.

Derived:
```js
E = aQ()                                     // pointer/preference boolean (store tc = 779142)
[T,z] = useState(null)                       // open time-warp dialog turnContextKey
B = extraTurnCount > 0 && (compactTurnControl || !E)     // touch layout
L = T === turnContextKey
O = canEndTurn || (B && canCancelExtraTurn)              // button enabled
$ = () => { B ? z(turnContextKey) : onEndTurn() }        // click: open dialog (touch) or end turn
useEffect(() => { z(e => (B && e === turnContextKey ? e : null)) }, [B, turnContextKey])
H = () => { (0, rl.y)("ui_click"); onSwitchSeat() }
F = extraTurnCount > 0 ? "true" : undefined
```

DOM:

```
<div className="pointer-events-auto grid w-full gap-[0.14rem]">
  {canSwitchSeat && <ActionButton aria-label={switchSeatAriaLabel}
      icon={<ActionIcon kind="switchPerspective"/>} label={t("sim.switchSeat")} title={switchSeatAriaLabel}
      tone="rewind" onClick={H}
      className="min-h-[2.46rem] justify-center rounded-[0.2rem] px-[0.32rem] py-[0.22rem] text-[0.62rem]
                 tracking-[0.075em] shadow-[inset_0_1px_0_rgba(235,246,255,0.07),0_8px_18px_rgba(3,8,18,0.2)]
                 enabled:hover:translate-y-0 [&>span:first-child>span]:h-[1.24rem] [&>span:first-child>span]:w-[1.24rem]
                 [&>span:last-child]:w-[2.8rem] [&>span:last-child]:shrink-0 [&>span:last-child]:overflow-visible
                 [&>span:last-child]:text-left [&>span:last-child]:text-clip [&>span:last-child]:leading-[1.08]
                 [&>span:last-child]:whitespace-normal" />}       // rE.h / rE.v

  {showTurnControl && (
    <div className="time-warp-turn-group"
         data-time-warp-active={extraTurnCount > 0}
         data-time-warp-layout={extraTurnCount > 0 ? (B ? "touch" : "mouse") : undefined}>
      <LabelTooltip disabled={!O} label={label} description={description}>   // K.f
        {extraTurnCount > 0
          ? <button type="button" aria-label={label}
              className={clsx(fU, "time-warp-action time-warp-turn-button")}
              data-time-warp-active="true" disabled={!O} title={description} aria-description={description}
              aria-haspopup={B?"dialog":undefined} aria-expanded={B?L:undefined}
              onClick={$}
              onKeyDown={e => { /* Space (no modifiers) while touch layout → preventDefault, stopPropagation, setOpen(turnContextKey) */ }}>
              <TimeWarpRing/>                                    {/* ev.Z */}
              <span className={clsx("time-warp-turn-label", beginningPhaseAdvance && "time-warp-beginning-label")}>{label}</span>
              <span className="time-warp-turn-badge">
                <TimeWarpClockGlyph/>                            {/* ev.v */}
                <span className="time-warp-turn-badge-label">{t("sim.extraTurnsBadge",{count:extraTurnCount})}</span>
                <span className="time-warp-turn-count" aria-hidden>
                  {t("sim.extraTurnCountShort",{count:extraTurnCount})}<chevron size={10}/>
                </span>
              </span>
            </button>
          : beginningPhaseAdvance
            ? <button type="button" aria-label={label}
                className={clsx(fU, "gb-turn-glass")} disabled={!canEndTurn}
                title={description} aria-description={description} onClick={$}>
                <span className="relative z-1 block text-center text-[0.72rem] font-bold uppercase leading-[1.04]
                                 tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">{t("sim.endBeginning")}</span>
                <span className="relative z-1 mt-[0.1rem] block text-center text-[0.72rem] font-bold uppercase
                                 leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">{t("sim.phase")}</span>
              </button>
            : <button type="button" aria-label={label} aria-keyshortcuts="Space"
                className={clsx(fU, "gb-turn-glass", "group/action")} disabled={!canEndTurn}
                title={E ? undefined : description} aria-description={description} onClick={$}>
                <span className="relative z-1 block text-center text-[0.78rem] font-bold uppercase leading-none
                                 tracking-[0.08em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">{label}</span>
                {E && canEndTurn ? <KbdBadge variant="board" label={t("sim.keySpace")} /> : null}   {/* tp.F */}
              </button>}
      </LabelTooltip>
      {extraTurnCount > 0 && !B &&
        <button type="button" className="time-warp-cancel" aria-label={t("sim.cancelExtraTurn")}
                title={t("sim.cancelExtraTurn")} disabled={!canCancelExtraTurn} onClick={onCancelExtraTurn}>
          <X size={14} className="time-warp-cancel-glyph" aria-hidden/>
          <span className="time-warp-cancel-label">{t("sim.cancelExtraTurn")}</span>
        </button>}
    </div>)}
</div>

{M && B && L ? <TimeWarpDialog canCancelExtraTurn canEndTurn description extraTurnCount label
                               onClose={()=>setOpen(null)}
                               onEndTurn={()=>{setOpen(null); onEndTurn()}}
                               onCancelExtraTurn={()=>{setOpen(null); onCancelExtraTurn()}} /> : null}

<div data-board-turn-controls
     data-extra-turns-pending={F}                      // "true" when extraTurnCount > 0
     className="pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)]
                z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center">
  <div className="pointer-events-auto grid w-full gap-[0.14rem]">   {/* c */}
     {switchSeatButton}   {/* d */}
     {turnGroup}          {/* s */}
  </div>
  {isTimeWarpDialogOpen && <TimeWarpDialog … />}   {/* u — url'd into a portal by ek */}
</div>
```

`fU` (the shared button shell, 48084) — verbatim:

```
"relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem]
 border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff]
 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_24px_rgba(3,8,18,0.24)] backdrop-blur-md
 transition-[border-color,background-color,box-shadow,color] duration-150
 before:content-[''] before:pointer-events-none before:absolute before:inset-[0.09rem] before:rounded-[0.14rem]
   before:border before:border-[rgba(228,239,255,0.08)]
   before:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]
 after:content-[''] after:pointer-events-none after:absolute after:left-[0.42rem] after:right-[0.42rem] after:top-[0.22rem]
   after:h-px after:bg-[linear-gradient(90deg,rgba(167,222,249,0),rgba(167,222,249,0.52),rgba(167,222,249,0))]
 enabled:hover:border-[rgba(204,226,249,0.42)] enabled:hover:bg-[rgba(23,40,63,0.92)]
 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_26px_rgba(3,8,18,0.28)]
 disabled:border-[rgba(160,186,204,0.16)] disabled:bg-[rgba(16,29,48,0.72)] disabled:text-[rgba(231,240,247,0.54)]"
```

`gb-turn-glass` (CSS) overrides the shell with a glass look:
`backdrop-filter:blur(10px) saturate(1.3) brightness(.9);
background:linear-gradient(160deg,#e8f6ff24,#b2d1f60a 50%,#060f1c38); border:1px solid #dcecff38;
border-radius:.2rem; box-shadow:inset 0 1px 1px #ffffff4d, inset 0 -1px 2px #0000002e,
inset 0 0 18px #ffffff0f, 0 6px 16px #00000038;` and **kills the `::before/::after` ornament**
(`.gb-turn-glass:before,.gb-turn-glass:after{content:none}`). Disabled variant
`linear-gradient(160deg,#e8f6ff0f,#b2d1f605 50%,#060f1c42)`; hover `#e8f6ff33/#b2d1f612`.
Phone-portrait variant replaces it with `background:#080f1ce0` (no backdrop filter).

### 2.2 `fG` — board phase status chip (48468–48547)

```
position = position === "self"
  ? "right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)]"
  : "left-[0.28rem] top-[calc(var(--battlefield-inset)-0.36rem)]";
<div role="status" data-board-phase-status={position}
     className={clsx("pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center", position)}
     aria-label={t(phase==="beginning" ? "sim.beginningPhase" : "sim.mainPhase")}>
  <div className="w-full">
    <div className="relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible
                    rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)]
                    px-[0.42rem] py-[0.38rem] text-[#edf6ff]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_20px_rgba(3,8,18,0.2)] backdrop-blur-md
                    before:… after:… (same ornament as fU)"><PhaseLabel phase/></div>
  </div>
</div>
```

`fZ` — the inner phase label (48085):

```
<span className={clsx("relative z-1 block text-center text-[0.72rem] font-bold uppercase leading-[1.04]
        tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]", className)}>
  {t(phase === "beginning" ? "sim.beginning" : "sim.main")}
</span>
<span className={clsx("relative z-1 mt-[0.1rem] block text-center text-[0.72rem] font-bold uppercase
        leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]", className)}>
  {t("sim.phase")}
</span>
```

So the *displayed* phase words are **"Beginning" / "Main" + "Phase"** ("BEGINNING PHASE" /
"MAIN PHASE"), and the end-turn button reads **"END BEGINNING PHASE"** in the beginning phase,
otherwise whatever `label` the caller passes (turn-control `label`, e.g. "End Turn").

### 2.3 Action strings actually sent

The turn control only calls `onEndTurn()` / `onCancelExtraTurn()` / `onSwitchSeat()` props.
The action **strings** live outside this range:
* hotkey table `end_turn` (line 6365): `{id:"end_turn", description:"Advance the turn",
  shortcuts:[{code:"Space"},{key:" "}], enabled: e => e.canEndTurn, run: e => e.onEndTurn(),
  allowRepeat:false, preventDefault:true}`.
* `toggle_perspective` (6380): `Space+Shift` / `KeyV`.
* dispatch site (55776): `let uv = beginningPhase ? "end_beginning_phase" : "end_turn";` then
  `{ type: "end_turn", observed }` / `{ type: "end_beginning_phase", observed }` (55962–55973,
  repeated at 59321–59323). Sound: `(0, rl.y)(e.extraTurnResumePlayerId ? "time_warp" : "turn_start")` (59368).
* Action list that is *not* allowed to be observed/rewound: 4832–4856 (`"end_beginning_phase"`,
  `"end_turn"`).
* Deck-peek / drag actions sent from **this** range are listed in §3, §4.

### 2.4 Time-warp dialog `ek` (lines 1219–1432 — *above* this range, but rendered by `fX`)

```
<div className="time-warp-dialog-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
  <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby aria-describedby tabIndex={-1}
       className="time-warp-dialog" onKeyDown={handleDialogKeyDown}>
    <header className="time-warp-dialog-header">
      <span className="time-warp-dialog-icon" aria-hidden><ev.v/></span>
      <div><h2 id>{t("sim.extraTurnQueued")}</h2>
           {extraTurnCount > 1 && <span>{t("sim.extraTurnsBadge",{count:extraTurnCount})}</span>}</div>
      <button type="button" className="time-warp-dialog-close" aria-label={t("common.close")} onClick={onClose}><X size={18}/></button>
    </header>
    <p id className="time-warp-dialog-description">{description}</p>
    <div className="time-warp-dialog-actions">
      <button type="button" className="time-warp-action time-warp-dialog-end" data-time-warp-active="true"
              disabled={!canEndTurn} onClick={onEndTurn}>
        <ev.Z/><ev.v className="relative"/><span>{label}</span>
      </button>
      <button type="button" className="time-warp-dialog-cancel" disabled={!canCancelExtraTurn} onClick={onCancelExtraTurn}>
        <X size={16} aria-hidden/>{t("sim.cancelExtraTurn")}
      </button>
    </div>
  </div>
</div>  → portal into `(0,ex.Q)()` root
```
CSS: `.time-warp-dialog-backdrop{z-index:300;padding:.75rem .75rem max(.75rem, env(safe-area-inset-bottom));
backdrop-filter:blur(3px);background:#0208119e;display:flex;justify-content:center;align-items:flex-end;position:fixed;inset:0}`
`.time-warp-dialog{max-width:24rem;max-height:calc(100dvh - 1.5rem);border-radius:.8rem;padding:1rem;
background:linear-gradient(150deg,#142e37,#0d192c 72%);border:1px solid #97decb6b;box-shadow:inset 0 1px #e6fff514,0 16px 50px #02070fa6}`
`.time-warp-dialog-actions{gap:.75rem;display:grid}` — i.e. stacked full-width buttons on phone.

### 2.5 Extra-turn flourish `ep` (583–1216, above range) + trigger `es` (557–608)

`es({extraTurn, roomPhase, side, turnNumber})` watches the turn number while `roomPhase === "in_game"` and
`extraTurn` is set; when `turnNumber` increments it sets `{turnNumber, side}` for **2200 ms** and
renders `ep`. `ep` renders `data-extra-turn-flourish` on
`"pointer-events-none absolute inset-0 z-80 overflow-hidden rounded-[inherit]"` with
three layers: (a) an SVG `feImage`/`feDisplacementMap`/`feComposite` "well" filter (reference-only),
(b) a `<canvas className="absolute inset-0 h-full w-full">` ripple, (c) a motion headline
`"absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.9em]
text-[clamp(0.95rem,calc(var(--card-width,6rem)*0.24),1.6rem)]"` containing two
`"block h-px w-[3.2em]"` gradient bars (origin-right / origin-left) and the word
`t("sim.extraTurn")` in `"block whitespace-nowrap bg-[linear-gradient(180deg,#ffffff_20%,#bdf6ea)]
bg-clip-text font-bold uppercase leading-none text-transparent"`. Timing curve constants
`ec = [0, 0.97/2.2, 1.25/2.2, 1.6/2.2, (1.6+0.45)/2.2]`,
`eu = ["linear", [0.16,0.84,0.3,1], "linear", [0.55,0,0.9,0.45]]`, total duration **2.2 s**;
letter-spacing animates `0.7em → 0.3em → 0.45em`, `time-warp-<uuid>`. Reduced motion ⇒ duration 0.
Shader "well" sizing: `sigma = Math.min(0.3*w, 0.5*h)`, `pinchPx = 0.1*min(w,h)`,
`ripplePx = 0.045*min(w,h)`, canvas at 25 % resolution.

### 2.6 Other time-warp UI in this range / near it
* `time-warp-chain-indicators` + `time-warp-chain-badge` (15148–15160) — chain pending badge in the
  compact rail; CSS `{align-items:flex-start; top:.52rem; left:2.7rem; right:.4rem}` /
  white-space:nowrap pill `background:linear-gradient(#1f5c58f5,#0f373afa); border:1px solid #9cecdc94; border-radius:999px; padding:.38rem .6rem; font-size:.66rem`.
* `time-warp-compact-toggle ... relative inline-flex items-center justify-center gap-0.5 rounded-[0.3rem] border`
  with `data-time-warp-active` (33113–33147) — compact rail extra-turn toggle, uses
  `t("sim.extraTurnCountShort")`, `aria-label={t("sim.extraTurnQueued")}`.
* `time-warp-sweep` CSS animation (7 s ease-in-out infinite, disabled under reduced motion).
* `time-warp-turn-group` CSS: `--time-warp-cancel-height:1.75rem; --time-warp-cancel-gap:.2rem; width:100%; display:grid`.
  Cancel button is `order:-1`, phone variant `display:none`.
* `time-warp-turn-count{display:none}` by default, `inline-flex` on phone (only the short count +
  chevron shows there); `time-warp-turn-badge-label{display:none}` on phone.

---

## 3. Drag ghost / drag preview / drop zones

### 3.1 Card-size / geometry constants

| name | line | value |
|---|---|---|
| `uH` | 35425 | `(13.2 / 5.2) * 0.7` ≈ **1.7769** (large-shell scale) |
| `uw` | 35263 | drag MIME map |
| `uk` | 35267 | `"data-drag-origin-persist-until"` |
| `uW` | 35453 | battlefield drop-root selector string |
| `uq` | 35454 | canonical zone order array |
| `uX(e,t=-2)` | 35468 | `{left: r.left + r.width/2, top: r.top + t}` — indicator anchor from an element rect |
| `uK` | 35431 | empty board model (`score, floatingEnergy, floatingPower, deck, hand, handRevealToOpponent, base, trash, banished, battlefieldA/B/C, battlefieldToken, champion, legend, runeDeck, runeArea, deckPeek{cardIds,revealedCardIds}`) |

```js
let uw = {
      boardCard: "application/x-riftbound-card",
      chainEntry: "application/x-riftbound-chain-entry",
      deckPeekCard: "application/x-riftbound-deck-peek-card",
      mainDeckCard: "application/x-riftbound-main-deck-card",
      battlefieldMarker: "application/x-riftbound-battlefield-marker",
    },
    uk = "data-drag-origin-persist-until",
    uW = '[data-drop-zone-root="battlefieldA"], [data-drop-zone-root="battlefieldB"], [data-drop-zone-root="battlefieldC"], [data-drop-zone-root="battlefieldToken"]',
    uq = ["hand","base","battlefieldA","battlefieldToken","battlefieldB","battlefieldC","trash","banished","champion","legend","runeArea"];
```

### 3.2 Origin hide / reveal helpers (35271–35319)

```js
function uC(e) {                        // fully reveal an origin element
  e.removeAttribute(uK);
  e.classList.remove("dragOriginPickup");
  e.classList.remove("dragOriginHidden");
}
function u_(e, t = Date.now()) {        // sweep all origins, honour the persist deadline
  e && e.querySelectorAll(".dragOriginHidden, .dragOriginPickup").forEach(e => {
    e.classList.remove("dragOriginPickup");
    let r = e.getAttribute(uK), a = r ? Number.parseInt(r, 10) : NaN;
    Number.isFinite(a) && a > t ? e.classList.add("dragOriginHidden")
                               : (e.removeAttribute(uK), e.classList.remove("dragOriginHidden"));
  });
}
function uj(e, t) {                     // cancel hide timers, blur origin; if revealOriginOnNextFrame:
  … a.classList.add("dragOriginHidden");
    a.setAttribute(uK, String(n() + 64));   // n = t?.getCurrentTimeMs ?? Date.now  → +64 ms
    e.revealFrame = window.requestAnimationFrame(o); …
    // otherwise o() runs immediately and calls uC(origin) + clears state
}
function uI(e) { /* removes the 6 native-DnD listeners: dragOver(document), drop(document), dragEnd(6 listeners) */ }
```

Pickup animation (inside `eZ`, 35905): origin gets `.dragOriginPickup` on the next frame, then
after **`pickupDelayMs ?? 90`** ms (and only if the same drag-session token is still current)
`.dragOriginPickup` → `.dragOriginHidden`.
CSS: `.dragOriginHidden{pointer-events:none;opacity:0!important}`,
`.dragOriginPickup{opacity:.14;transition:opacity 90ms ease-out}`.

### 3.3 `ux` — the drag ghost component (34969–35270)

Props: `dragImageRef, dragGhostRef, ghostCard, ghostAttachedEquipment, ghostShowAttachedEquipment,
ghostFlipCapable, ghostFlipBackShown, ghostFlipDurationSec, ghostRenderScale, ghostFlipTargetActive,
ghostLargeShell, ghostContentInsetPx, ghostShellStyle, ghostBaseScale, ghostSourceZone, ghostIsFaceDown,
dropIndicator, equipIndicator, targetIndicator, activeDeckDropPosition`.

```
<div ref={dragGhostRef}
     data-card-drag-ghost={ghostCard.id}
     className={clsx("fixed left-0 top-0 pointer-events-none will-change-transform",
                     activeDeckDropPosition ? "z-2147483500" : "z-2147483550",
                     "transform-3d")}
     style={{ transform: "translate3d(-9999px,-9999px,0)" }}>
  <motion.div initial={false} animate={{scale: ghostRenderScale}}
              transition={{duration: 0.18, ease: [0.22, 1, 0.36, 1]}}
              className="origin-center transition-transform duration-140 ease-[cubic-bezier(0.2,0.7,0.2,1)]">
    <div className="relative overflow-visible">
      {showAttached && attached.map((e,i) => (
        <div key={`drag-ghost-attached-${e.card.id}`}
             className="absolute left-0 top-0 w-(--card-width) min-w-(--card-width) h-(--card-height) pointer-events-none"
             style={{ left: `${1.32 * (e.rank + 1)}rem`, top: "0.48rem", zIndex: Math.max(0, 40 - (e.rank + 1)) }}>
          <div className={clsx(of.r, "w-full! h-full! animate-none transition-none")}>
            <GameCardArt card={e.card} overlay={false} imageInsetPx={ghostContentInsetPx} imageProfile />
          </div>
        </div>))}

      <div className={clsx(
             flipCapable ? "w-(--card-width) min-w-(--card-width) h-(--card-height) rounded-(--card-radius-main) border-none bg-transparent shadow-none"
             : (flipTargetActive || largeShell) ? of.d : of.r,
             "relative z-40 overflow-visible animate-none transition-none will-change-auto",
             largeShell && "rounded-(--card-radius-main)!",
             ghostCard.exhausted && "transform-[rotate(90deg)] origin-center")}
           style={flipCapable ? undefined : ghostShellStyle}>
        {flipCapable
          ? <div className="relative w-full h-full overflow-hidden">
              <motion.div animate={backShown ? {opacity:0, scaleX:0.06} : {opacity:1, scaleX:1}}
                          transition={{duration: 0.56, ease: [0.22,1,0.36,1]}}
                          className="absolute inset-0 origin-center" style={{transformOrigin:"center center"}}>
                <GameCardArt card imageInsetPx imageProfile battlefieldArtOrientation="portrait"/></motion.div>
              <motion.div animate={backShown ? {opacity:1, scaleX:1} : {opacity:0, scaleX:0.06}} …>
                <CardBack insetPx sizes slot/></motion.div>
            </div>
          : ghostIsFaceDown ? <CardBack insetPx sizes slot/>
                            : <GameCardArt card imageInsetPx imageProfile battlefieldArtOrientation="portrait"/>}
        {!ghostIsFaceDown && <CardIndicators cardId={ghostCard.id} exhausted={!!ghostCard.exhausted}/>}   {/* th.P */}
        {attachedOverlayVisible /* = !faceDown && (!flipCapable || !flipBackShown) */
          && <Rotate90 rotationDeg={90 * !!ghostCard.exhausted}><CardCounterLayer card={ghostCard}/></Rotate90>}   {/* lz / lB */}
      </div>
    </div>
  </motion.div>
</div>
```

Plus `dropIndicator` / `equipIndicator` / `targetIndicator` tooltips (component `uv`, 34934), each
positioned in viewport coords:

```
<div className={clsx("fixed pointer-events-none z-2147483647 rounded-[0.12rem]
        border border-[rgba(171,191,238,0.42)]
        bg-[linear-gradient(168deg,rgba(27,44,72,0.96),rgba(36,56,88,0.94))] text-(--text-soft)
        shadow-[inset_0_0_0_1px_rgba(209,224,255,0.08),0_8px_18px_rgba(3,8,20,0.45)] whitespace-nowrap",
        compact ? "px-[0.52rem] py-[0.18rem] text-[0.56rem] font-semibold leading-none uppercase tracking-[0.06em]"
                : "px-[0.52rem] py-[0.24rem]")}
     style={{left, top, transform: "translate(-50%, -100%)"}} />
```

Drop tooltip contents: `grid gap-[0.16rem]` → primary
`text-[0.56rem] font-semibold leading-none uppercase tracking-[0.06em]`, optional secondary
`text-[0.5rem] font-medium leading-none text-[#c9daf4]`. Equip / target tooltips use `compact` and the
labels `t("sim.equip")` / `t("sim.target")`.

The whole ghost is wrapped in `(0, oI.w)({widthRem, children})` (line 35255) — a card-size context
provider (`oI` = module 663456) that supplies `--card-width/--card-height/--card-radius-*` inside
the ghost.

### 3.4 Ghost positioning math (inside `uV`, state `en.current`)

State object:
```js
{ active:false, reduceMotion:false, targetX:-9999, targetY:-9999,
  velocityX:0, velocityY:0, tiltX:0, tiltY:0, roll:0,
  lastPointerX:0, lastPointerY:0, lastPointerTs:0, lastFrameTs:0 }
```

Pointer-velocity smoothing (`eW`, 35680) — called on every pointer sample / `dragover`:
```js
let n = Number.isFinite(r) && r > 0 ? r : (a.lastPointerTs > 0 ? a.lastPointerTs + 16 : 0);
if (a.lastPointerTs > 0 && n >= a.lastPointerTs) {
  let r = Math.max(1, n - a.lastPointerTs),
      o = (e - a.lastPointerX) / r,      // px per ms
      i = (t - a.lastPointerY) / r;
  a.velocityX = 0.45 * a.velocityX + 0.55 * o;
  a.velocityY = 0.45 * a.velocityY + 0.55 * i;
}
a.targetX = e; a.targetY = t; a.lastPointerX = e; a.lastPointerY = t; a.lastPointerTs = n;
// reduced motion writes immediately:
er.current.style.transform = `translate3d(${e.toFixed(2)}px,${t.toFixed(2)}px,0) translate(-50%, -50%)`;
```

rAF spring loop (36018–36060):
```js
let n = Math.max(1, e - r.lastFrameTs); r.lastFrameTs = e;
let o = Math.exp(-n / 118);                       // velocity decay, τ = 118 ms
r.velocityX *= o; r.velocityY *= o;
let i = 1e3 * r.velocityX, l = 1e3 * r.velocityY, // px/s
    d = (0, te.O)(-(0.0115 * l), -13, 13),        // tiltX target, clamped ±13°
    s = (0, te.O)(  0.0115 * i , -13, 13),        // tiltY target, clamped ±13°
    c = (0, te.O)(  0.0075 * i ,  -8,  8),        // roll target, clamped ±8°
    u = 1 - Math.exp(-n / 42);                    // follow smoothing, τ = 42 ms
r.tiltX += (d - r.tiltX) * u;
r.tiltY += (s - r.tiltY) * u;
r.roll  += (c - r.roll ) * u;
uF(a, `${r.roll.toFixed(2)}deg`);                 // sets --card-counter-drag-roll on counters
a.style.transform =
  `perspective(980px) translate3d(${r.targetX.toFixed(2)}px,${r.targetY.toFixed(2)}px,0) ` +
  `translate(-50%, -50%) rotateX(${r.tiltX.toFixed(2)}deg) rotateY(${r.tiltY.toFixed(2)}deg) ` +
  `rotateZ(${r.roll.toFixed(2)}deg) scale(1.02)`;
```
Reduced-motion short-circuit: `prefers-reduced-motion: reduce` ⇒
`translate3d(x,y,0) translate(-50%,-50%)` and `uF(el, "0deg")`. `uF` writes
`--card-counter-drag-roll` onto every `[data-card-counter-frame], .card-banish-frame`.

Drag start (`eZ`, 35842): sets `dataTransfer.effectAllowed = "copyMove"`,
`setData(uw[kind], JSON.stringify(payload))`, `setDragImage(dragImageRef.current ?? (0,ck.d)(), 0, 0)`,
installs document/window listeners via the helper at 35808 (`dragend` capture on window + on the
`dragendSource` element, `drop` on document **only if not already defaultPrevented**,
`keydown` **and** `keyup` for `"Escape"/"Esc"` with `preventDefault`), starts the rAF loop, and
hides the origin. Drop effect per kind: `uN(kind,payload)` → `"copy"` for `battlefieldMarker`
or `boardCard` with `payload.zone === "legend"`, else `"move"` (35342).

Ghost mount is deferred by one rAF + `startTransition`: `(0,y.startTransition)(() => { setGhostCard(card); setActiveDrag(drag); })` (35966).
Session token: `e$() => (J.current += 1, J.current)`.

Teardown `eU` (35655): bump token, clear timeout, cancel rAF, reset intent to `uS.Y()`, `uI(em)`,
`eK()` (zero all motion state + park the ghost at `translate3d(-9999px,-9999px,0)`), clear timers,
`uj(eh,{revealOriginOnNextFrame})` then `u_(boardFieldRef.current)`, clear `activeDragRef/setActiveDrag(null)`,
`setHiddenChainEntryId(null)`, `setGhostCard(null)`, `suppressCardHoverPreviewUntilMouseMove()`, `eH()`.

### 3.5 Pointer/keyboard interaction inventory

* There is **no** `setPointerCapture` and no `pointerdown` handler in this range — the
  touch long-press path is delegated to an external "pointer drag bridge" passed in as
  `pointerDragBridge` (`r`): `r.isBridgeActive()`, `r.isTouchDragActive()`,
  `r.tryClaimTrustedDragStart(event,{zone,cardId})`, `r.getPendingPress()`,
  `r.registerRuntime(owner, api)`. The runtime API registered in `useLayoutEffect` (37102) is
  `{lookupBoardCard, findBoardCardButtonElement, beginResolvedCardDrag, clearDragState,
  clearCardHoverPreview, updateDragGhostTarget, isDragActive}`.
* `r.registerRuntime`/`beginResolvedCardDrag` is how a *touch* press becomes a drag without a
  native `dragstart`; `eG` (36078) first calls `r.tryClaimTrustedDragStart(...)` and bails when the
  bridge answers `"unhandled"`; otherwise it uses the pending press (if owned by this board) as the
  drag payload.
* Native drag only: `eZ` is invoked from `onDragStart` via `beginCardDrag`, `beginDeckPeekDrag`,
  `beginMainDeckDrag`, `beginBattlefieldMarkerDrag`, `handleChainEntryDragStart`,
  `handleFieldDragStart`.
* Click-vs-drag arbitration lives outside this range; here we only see the **top-third rule** for
  touch (`ti`/`tl`/`td`):
  ```js
  ti(e,t) = e.shiftKey ? true
          : (!t || !r.isTouchDragActive()) ? false
          : e.clientY < t.getBoundingClientRect().top + t.getBoundingClientRect().height / 3;
  tl(e,t) = ti(e,t) ? "top" : "bottom";        // deck position
  td(e)    = ti(e) ? "banish" : "trash";       // trash modifier on touch (shift ⇒ banish on mouse)
  ```
* Escape aborts the drag (document `drop` capture + window keydown/keyup).
* Timers: **220 ms** ghost-settle expiry (`ey` transient preview), **560 ms** drop-preview hold
  (`e_`), **110 ms** / **130 ms** re-drop debounce (`eJ(110)`, `eJ(130)`),
  **180 ms** chain-entry drag-end grace, **90 ms** origin pickup delay, **64 ms** origin persist window.

### 3.6 Drop intents, per-zone accept rules

Intent state shape (`uS.Y()`): `{targetZone, orderedPreview, indicators:{chainDropActive,
runeFloatDropActive, runeFloatDropIndicatorPos, trashDropMode, trashDropIndicatorPos,
spellTargetIndicator, equipDropIndicator, mainDeckDropPosition, mainDeckDropIndicatorPos,
runeDeckDropPosition, runeDeckDropIndicatorPos}}`. Built by the `uR/uA/uM` helpers (35348–35362):
`{dropEffect:"none"|"move"|"copy", preventDefault, intentPatch}`; `eL(event, result, apply)` applies.

Per-kind drop handling (`tg`, 36328):

| drag kind | target zone | action sent |
|---|---|---|
| `mainDeckCard` | any | `{type:"take_top_from_deck", to: shiftTopThird ? "banished" : zone}` — only if `(0,dN.y)(zone, sharedBattlefieldToken)` |
| `deckPeekCard` | `runeArea`/`champion` | **rejected** (drag cleared) |
| `deckPeekCard` | not `hand`/`trash` and `(0,dN.b)(card)` (deck-peek spell) | `{type:"chain_add", from:"deck", cardId, clientEntryId:(0,F.b)(myId,cardId)}` |
| `deckPeekCard` | move-allowed | `{type:"take_card_from_deck", cardId, to: shiftTopThird?"banished":zone, toIndex}` |
| `boardCard` (zone `legend`) | any | nothing (dragging a legend card is only `copy`) |
| `boardCard` (equipment onto a Unit) | battlefield/unit slot | `{type:"equip_card", equipmentCardId, unitCardId, asAttachment:true}` |
| `boardCard` chainable & zone ∉ {hand, trash} & not hidden | any | `{type:"chain_add", from:zone, cardId, clientEntryId}` |
| `boardCard` same-zone reorder | same zone | `{type:"move_card", from, to, cardId, toIndex}` (no-op when the computed index equals the current one → `eJ(110)`) |
| `boardCard` move | any | `{type:"move_card", from, to, cardId, toIndex, asHidden?}` where `asHidden = (zone==="hand"‖"champion") && battlefield-target && (payload.hidden‖card.hidden‖hand-reveal-blocked)` |
| `boardCard` → main deck | `[data-pile-slot="mainDeck"]` or field | `{type:"send_to_deck", from, cardId, position:"top"|"bottom"}` (only if `(0,dN.g)(payload)`) |
| `boardCard` → rune deck (`runeArea` card, `to(payload)`) | `[data-pile-slot="runeDeck"]` | `{type:"send_to_rune_deck", from:"runeArea", cardId, position:"top"|"bottom"}` |
| `boardCard` → rune float bucket | `[data-drop-zone-root="runeArea"]` float slot | `{type:"recycle_rune_for_floating_energy", cardId}` |
| `chainEntry` | chain drop / field / piles | `(0,e8)(entryId)` gate then `h(entryId, targetZone)` (chain resolve) |
| any → target arrow (`handleFieldDropCapture`) | card | `queueTargetedSpellDropArrow(clientEntryId, targetCardId)` **then** `{type:"chain_add", from, cardId, clientEntryId}` |

`beginBattlefieldMarkerDrag` payload is `{zone, cardId}`; on drop into chain:
`{type:"chain_add", from:"battlefieldMarker", battlefieldZone: zone, cardId, clientEntryId}` (37141).

`handleDropToMainDeck` recomputes `prefixClosestTo(popoverPrompt)` etc.; `handleDropToRuneFloat` is
`handleDropToZone`-independent. `handleFieldDragOver` forwards to `eB` (field-level intent applier)
with `uT(chainDropActive)`.

### 3.7 Drop-index computation (ordered zones) — `th` (36213) verbatim

```js
// caller: eg.current holds a measuring fn per ordered zone registered by dR(zone, enabled, midpointsRem, onGeometryChange)
let r = (function ({ targetZone: e, event: t, cache: r, geometry: a, isOrderedDropZone: n }) {
  if (!n(e)) return { value: undefined, cache: r };
  let o = a && a.zone === e ? a.version : null;            // geometry version
  if (null === o) return { value: undefined, cache: null };
  if (r && r.zone === e && r.geometryVersion === o && t.clientX === r.clientX)
    return { value: r.value, cache: r };                    // hit cache
  let i = (function (e, t, r) {
    if (!e || !r(e.zone)) return undefined;
    if (0 === e.entries.length) return 0;
    let a = false, n = -1, o = null,
        i = e.entries.filter(e => Number.isFinite(e.index) && Number.isFinite(e.midpointX)),
        l = i[0], d = i[i.length - 1],
        s = "rtl" === e.horizontalDirection ||
            (undefined === e.horizontalDirection && !!(l && d && l.midpointX > d.midpointX));
    for (let e of i) {
      a = true; n = Math.max(n, e.index);
      (s ? t > e.midpointX : t < e.midpointX) && (null === o || e.index < o) && (o = e.index);
    }
    return a ? (o ?? n + 1) : 0;
  })(a, t.clientX, n);
  if ("number" != typeof i) return { value: i, cache: null };
  let l = { zone: e, clientX: t.clientX, value: i, geometryVersion: o };
  return { value: i, cache: l };
})({ targetZone: e, event: t, cache: eb.current,
     geometry: eg.current.get(e)?.() ?? null,
     isOrderedDropZone: e => eO.V.has(e) });
eb.current = r.cache;   // single-slot cache (zone + clientX + geometryVersion)
return r.value;
```

Registration/teardown of a zone's measuring fn: `tf(zone, fn)` (36272) — deletes + invalidates the
cache when the zone's geometry changes. `hand` registers `onGeometryChange` from `hu`-side
(`onOrderedRailDropGeometryChange`), battlefields register `onTopOrderedRailDropGeometryChange` /
`...Bottom...` (see §6/§3.8).

The raw index is then normalised for the "move within the same zone" case:
`dP.k(zone, zoneCards, rawIndex)` (⤳ `toIndex`) and preview index via `dS.S({targetZone, sourceZone,
zoneCards, draggedCardId, rawDropIndex})`, plus `dN.$/dN.e/dN.d` for the gap reflow (`dN.$(cards, id, idx)`
produces `projectedHandCards` shown during the transient settle phase).

### 3.8 Drop-preview / indicator visuals in this range

`ps` (the battlefield, see §6.4) renders a dashed placeholder when a gap exists:

```
<div className={clsx("w-(--card-width) h-(--card-height) rounded-(--card-radius-tight) border border-dashed
                      border-[rgba(120,221,183,0.4)] bg-[rgba(120,221,183,0.06)] opacity-60",
                      exhausted && "rotate-90 origin-center")} />
```
keyed `"top-drop-preview-gap"` (self side uses the mirrored equivalent), positioned at
`left: rx ? "50%" : `${(gapLeftRem[key] ?? 0) + (virtualRightPrefixRem[key] ?? 0)}rem``,
`transform: rx ? "translateX(-50%)" : undefined`, `zIndex: 0`.

`data-ordered-drop-preview-index` is written on each battlefield drop root (`e7` for opponent,
`tr` for self; `?? undefined`). `data-board-drag-active` on the battlefield `<section>` is
`(activeDrag || transientSettling) ? "true" : "false"`; `data-ghost-zone` is `ghostZone ? "true" : "false"`
(dashed border + radial highlight added when true):

```
"gb-board-layer min-h-0 h-full relative rounded-[0.12rem] border border-[rgba(221,232,255,0.3)]
 bg-transparent p-[0.16rem] after:content-[''] after:absolute after:inset-[0.12rem] after:pointer-events-none
 after:opacity-[0.58] after:gb-ornament-field"
 ghostZone && "border-dashed border-[rgba(165,211,255,0.34)] bg-[radial-gradient(circle_at_50%_18%,rgba(140,196,255,0.07),rgba(16,28,48,0.04)_42%,rgba(7,14,24,0.01)_74%)] shadow-[inset_0_0_0_1px_rgba(167,218,255,0.05),0_0_0_1px_rgba(13,24,40,0.18)]"
 (dropActive||targetActive) && of.j
 "eligible"===playHiddenTarget && "game-selection-target-focus z-2"
 "dimmed"===playHiddenTarget    && "opacity-[0.38] saturate-[0.55] pointer-events-none"
 hideTopChrome && "gb-battlefield-hide-top-chrome"
 hideBottomChrome && "gb-battlefield-hide-bottom-chrome"
 ghostZone && (dropActive||targetActive) && "border-[rgba(136,224,255,0.58)] bg-[radial-gradient(circle_at_50%_16%,rgba(152,230,255,0.16),rgba(41,100,136,0.08)_42%,rgba(9,18,31,0.02)_78%)] shadow-[inset_0_0_0_1px_rgba(186,241,255,0.1),0_0_16px_rgba(76,166,208,0.09)]"
 (buffArmed||stateBorder) && "border-[rgba(255,204,142,0.44)] bg-[linear-gradient(180deg,rgba(255,204,142,0.045)_0%,rgba(255,204,142,0.016)_100%)] transition-[border-color,background] duration-180"
```

The authoritative visual model is produced by `(0,dS.B)({phase, activeSource, transientSource, preview,
transientPreview, targetZone, dropEffect, indicators})` where `phase ∈ {"dragging","settling","idle"}`
and `dropEffect ∈ {"copy","move",null}`, and handed to consumers as
`uV().viewState.renderIntent` / `overlayModel` (§3.9).

### 3.9 `uV()` return contract (used by the board root)

```
{
  viewState: { renderIntent, runeFloatDropVisible, runeFloatResourcePreview,
               playerLayerHandCards, battlefieldADisplayCards, battlefieldTokenDisplayCards,
               battlefieldBDisplayCards, battlefieldCDisplayCards },
  handlers: { isDragGhostActive, getActiveDragGhostCenter, beginCardDrag, beginDeckPeekDrag,
              beginMainDeckDrag, beginBattlefieldMarkerDrag, clearDragState,
              handleDropToMainDeck, handleDragOverMainDeck, handleDragLeaveMainDeck,
              handleDropToRuneDeck, handleDragOverRuneDeck, handleDragLeaveRuneDeck,
              handleDropToRuneFloat, handleDragOverRuneFloat, handleDragLeaveRuneFloat,
              handleDropToZone, handleDragOverZone, handleDragLeaveZone,
              handleFieldDragOver, handleFieldDragStart, handleFieldDrop, handleFieldDropCapture,
              handleChainEntryDragStart, handleChainEntryDragEnd, handleChainDragOver,
              handleChainDragLeave, handleDropToChain, handleOrderedRailDropGeometryChange },
  overlayModel: { dragImageRef, dragGhostRef, ghostCard, ghostAttachedEquipment, ghostShowAttachedEquipment,
                  ghostFlipCapable, ghostFlipBackShown, ghostFlipDurationSec: 0.56, ghostRenderScale,
                  ghostFlipTargetActive, ghostLargeShell, ghostContentInsetPx: scale>1 ? 0 : 1,
                  ghostShellStyle, ghostBaseScale, ghostSourceZone, ghostIsFaceDown,
                  dropIndicator, equipIndicator, targetIndicator, activeDeckDropPosition }
}
```

Ghost scale resolution (line 36760–36800):
```js
tx = chainDropActive ? uH : 1;                    // 1.7769 while a chain drop is active
tJ = handDropTarget ? 1 : tx;                     // tZ = "hand"|"champion" source && dropZone ∈ dN.f && tU
t0 = tJ > 1;                                      // → largeShell
ghostRenderScale = tJ;                            // (`tJ * (tZ && !tX, 1)` — comma expr ⇒ ×1)
ghostContentInsetPx = tJ > 1 ? 0 : 1;
ghostBaseScale = tJ;
t2 = t0 ? { borderRadius:"var(--card-radius-main)", borderWidth:"0.5px",
            borderColor:"rgba(184,208,238,0.22)",
            boxShadow:"inset 0 0 0 0.35px rgba(206,226,250,0.05)" } : t1
```
Indicator labels resolved at 36756:
```
label = activeDeckDropPosition === "top" ? t("sim.onTop") : t("sim.recycle")
label = runeFloatDropActive ? t("sim.floatDrop")
      : trashDropMode === "banish" ? t("sim.banish")
      : trashDropMode === "trash"  ? t("sim.trash") : baseLabel
secondaryLabel (touch)  = walletPosition==="top" ? t("sim.slideDownToRecycle") : t("sim.slideUpPutOnTop")
secondaryLabel (mouse)  = position==="bottom" ? t("sim.holdShiftPutOnTop") : undefined
secondaryLabel (banish, touch) = t("sim.slideDownToTrash")
secondaryLabel (trash, touch)  = t("sim.slideUpToBanish")
secondaryLabel (trash, mouse)  = t("sim.holdShiftToBanish")
```

---

## 4. Deck peek / look-at-top UI

### 4.1 Empty state `mr` (38076)

```
<div data-deck-peek-empty-state="true"
     className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-[0.44rem] px-6 text-center">
  <p className="text-[0.82rem] font-semibold tracking-[0.02em] text-[#dff4ff]">{t("sim.noCardsLookedAtYet")}</p>
  <p className="max-w-[29rem] text-[0.7rem] leading-relaxed text-[rgba(211,226,246,0.78)]">{t("sim.deckPeekEmptyBegin")}</p>
  <p className="max-w-[29rem] text-[0.68rem] leading-relaxed text-[rgba(184,204,230,0.64)]">{t("sim.deckPeekEmptyMore")}</p>
</div>
```

### 4.2 Button tone system — `mo(e)` (38216) and `mi` (38230)

`mi` (used by the grid action buttons):
```
"flex min-h-10 min-w-0 items-center justify-center rounded-[0.28rem] border p-[0.35rem] text-center
 text-[0.72rem] font-semibold leading-[1.25] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
```
`mo(button)` returns the tone class (verbatim, 5 branches):
* **`reveal`** + `pressed`:
  `"rounded-[0.16rem] border border-[rgba(125,218,237,0.58)] bg-[linear-gradient(180deg,rgba(38,94,112,0.94),rgba(19,55,71,0.98))] px-[0.76rem] py-[0.42rem] text-[#e8fbff] text-[0.72rem] font-semibold shadow-[inset_0_1px_0_rgba(224,250,255,0.16),0_0_0_1px_rgba(125,218,237,0.22)] disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:border-[rgba(160,235,248,0.72)] hover:enabled:bg-[linear-gradient(180deg,rgba(48,110,130,0.98),rgba(24,68,86,0.98))] transition-colors"`
* **`reveal`** (unpressed): `… border-[rgba(125,218,237,0.28)] bg-[rgba(15,34,52,0.78)] … text-[#d7f6fb] … hover:enabled:border-[rgba(160,235,248,0.5)] hover:enabled:bg-[rgba(21,48,65,0.9)] …`
* **`trash`**: `"… border-[rgba(224,200,171,0.26)] bg-[rgba(46,34,26,0.84)] … text-[#f3e4d8] … hover:enabled:border-[rgba(238,219,194,0.38)] hover:enabled:bg-[rgba(58,42,31,0.9)] …"`
* **`subtle`**: `"inline-flex items-center justify-center rounded-[0.16rem] border border-transparent bg-transparent px-[0.76rem] py-[0.42rem] text-[#edf5ff] text-[0.72rem] font-semibold leading-none shadow-none disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:border-[rgba(201,218,249,0.12)] hover:enabled:bg-[rgba(18,30,52,0.46)] hover:enabled:text-white transition-colors"`
* **`banished`**: `"… border-[rgba(192,176,244,0.24)] bg-[rgba(35,28,58,0.84)] … text-[#e4dcff] … hover:enabled:border-[rgba(211,198,255,0.34)] hover:enabled:bg-[rgba(43,34,69,0.9)] …"`
* **default**: `"… border-[rgba(201,218,249,0.16)] bg-[rgba(15,28,52,0.74)] text-(--text-soft) text-[0.72rem] font-semibold shadow-[inset_0_1px_0_rgba(230,239,255,0.05)] … hover:enabled:border-[rgba(205,221,248,0.26)] hover:enabled:bg-[rgba(21,37,65,0.88)] …"`

The **grid** variant `mg` (38733) uses `mi` plus tone gradients and
`"pointer-events-auto grid w-full grid-cols-2 gap-[0.36rem]"`, with
`0 === index && list.length % 2 == 1 && "col-span-2"` for a trailing odd button:
* `play`: `border-[rgba(176,242,208,0.9)] bg-[linear-gradient(180deg,rgb(68,170,130),rgb(18,72,51))] text-[#effff7] shadow-[inset_0_1px_0_rgba(236,255,246,0.24),0_2px_6px_rgba(2,6,18,0.45)] hover:enabled:border-[rgba(196,250,223,0.96)] hover:enabled:bg-[linear-gradient(180deg,rgb(78,184,141),rgb(22,84,60))]`
* `hand`: `border-[rgba(205,224,250,0.46)] bg-[linear-gradient(180deg,rgb(46,75,116),rgb(31,54,87))] …`
* `trash` (or `banished` with a label ≠ `"Banish"`): `border-[rgba(224,200,171,0.46)] bg-[linear-gradient(180deg,rgb(88,66,47),rgb(54,39,28))] …`
* `banished`: `border-[rgba(190,168,244,0.46)] bg-[linear-gradient(180deg,rgb(92,70,146),rgb(50,36,84))] …`
* `reveal`: `border-[rgba(125,218,237,0.48)] bg-[linear-gradient(180deg,rgb(38,94,112),rgb(19,55,71))] …`
* default: `border-[rgba(190,206,229,0.38)] bg-[linear-gradient(180deg,rgb(35,48,69),rgb(22,31,48))] …`

Touch variant `mb` (38692): `className="touch-card-action"` inside
`className="gb-off-board-touch-actions"`.

**Button label translation table `ml(e, t)`** (38232) — exact mapping of internal labels to i18n ids:

| internal label | i18n key |
|---|---|
| `Play` | `sim.play` |
| `Recycle` | `sim.recycle` |
| `to_hand_recycle_rest` | `sim.deckPeek.toHandRecycleRest` |
| `on_top_recycle_rest` | `sim.deckPeek.onTopRecycleRest` |
| `To hand` | `sim.toHand` |
| `To champion` | `sim.toChampion` |
| `Banish` | `sim.banish` |
| `To trash` | `sim.toTrash` |
| `look_top_rune` | `sim.lookAtTopRune` |
| `look_top_card` | `sim.lookAtTopCard` |
| `Look at 1 More` | `sim.lookAtOneMore` |
| `look_at_bottom` | `sim.deckPeek.lookAtBottom` |
| `shuffle_unrecycled` | `sim.deckPeek.shuffleUnrecycled` |
| `Shuffle Deck` | `sim.shuffleDeck` |
| `Recycle All` | `sim.recycleAll` |
| `On Top` | `sim.onTop` |
| `Hide` | `sim.hide` |
| `Reveal` | `sim.reveal` |
| `Hide All` | `sim.hideAll` |
| `Reveal All` | `sim.revealAll` |
| `Show Banished` | `sim.showBanished` |
| `Show Trash` | `sim.showTrash` |
| `Clear Selection` | `current.clearSelection` |
| `Select All` | `current.selectAll` |
| (anything else) | passthrough |

### 4.3 `md` — action row (38286)

Renders `null` when `actions.length === 0`. Each button:
```
<button type="button" disabled={a.disabled} aria-pressed={a.pressed}
        aria-label={ml(a.label, t)} className={mo(a)} onClick={a.onSelect}>
  {a.compactLabelKey
    ? <><span className="gb-header-full-label">{ml(a.label,t)}</span>
        <span className="gb-header-compact-label hidden">{t(a.compactLabelKey)}</span></>
    : a.icon ? <span className="inline-flex items-center gap-[0.28rem] leading-none">{a.icon}<span className="leading-none">{ml(a.label,t)}</span></span>
    : ml(a.label, t)}
</button>   key={a.id}
```

### 4.4 `ms` — "More" overflow menu (38344)

Props `{actions, compactActions = []}`. Renders `null` when both are empty.
State `open`; outside-dismiss listens `pointerdown` **and** `focusin` in capture phase; Escape
(`stopPropagation`) closes and refocuses the trigger. Panel is right-aligned by measuring the
trigger rect against the panel width, clamped to `8 … window.innerWidth - 8 - panelWidth`.

```
<div ref={rootRef} className="relative inline-flex" onKeyDown={escapeHandler}>
  <button ref={triggerRef} type="button" aria-label={t("sim.deckPeek.moreOptions")}
          aria-expanded={open} aria-controls={panelId} className={mo({tone:"subtle"})}
          onClick={() => setOpen(v => !v)}>
    <span className="inline-flex items-center gap-[0.28rem] leading-none">
      <chevron-down className="h-3.5 w-3.5 shrink-0" strokeWidth={2.3} aria-hidden/>
      <span className="gb-deck-peek-more-label leading-none">{t("sim.more")}</span>
    </span>
  </button>
  {open && (
    <div ref={panelRef} id={panelId} role="group" aria-label={t("sim.deckPeek.moreOptions")}
         className="gb-deck-peek-more-panel absolute top-[calc(100%+0.36rem)] z-200 flex w-48
                    max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[0.22rem]
                    border border-[rgba(201,218,249,0.22)] bg-[rgba(8,16,34,0.98)] text-(--text-soft)
                    shadow-[0_14px_28px_rgba(2,6,18,0.54),inset_0_1px_0_rgba(230,239,255,0.06)]"
         style={{right: offset}}>
      {[...compactActions, ...actions].map(a => (
        <button key={a.id} type="button" data-deck-peek-more-action
                data-compact-only={compactActions.includes(a) || undefined}
                aria-disabled={a.disabled} title={a.disabled ? t(a.disabledReasonKey) : undefined}
                className={clsx("min-h-10 w-full border-b border-[rgba(201,218,249,0.1)] px-[0.7rem] py-[0.48rem]
                        text-left text-[0.72rem] font-semibold last:border-b-0 focus-visible:z-1
                        focus-visible:outline-2 focus-visible:outline-[rgba(169,211,255,0.72)]
                        focus-visible:outline-offset-[-2px]",
                        a.disabled ? "cursor-not-allowed opacity-[0.45]" : "hover:bg-[rgba(27,46,77,0.9)]")}
                onClick={() => { if (a.disabled) return; setOpen(false); a.onSelect();
                                 requestAnimationFrame(() => triggerRef.current?.focus()); }}>
          {ml(a.label, t)}
          {a.disabled && t ? <span className="sr-only">{t("sim.deckPeek.unavailableReason",{reason:t})}</span> : null}
        </button>))}
    </div>)}
</div>
```
CSS: `.gb-deck-peek-more-panel{max-height:calc(var(--sim-visible-height,100dvh) - 8rem);overflow-y:auto}`;
on phone `.gb-deck-peek .gb-deck-peek-secondary-actions,.gb-deck-peek-more-label{display:none}` and
`.gb-deck-peek [data-compact-only]{display:block}` (desktop hides `[data-compact-only]`).

### 4.5 Selection helpers

* `mu(state, id) = !!state?.selectedCardIds.includes(id)` (38562)
* `mm(selection, cards)` → `{id: `${source}:selection:select-all|clear`, label: "Select All"|"Clear Selection",
  disabled: disabled || cards.length===0, onSelect: onSelectAll|onClear}` (38565)
* `mp(selection)` → `<mh selection/>` when selection has any ids (38576)
* `mh` (38580) — selection footer. Block buttons
  `[{to:"hand",label:"To hand"},{to:"banished",label:"Banish",tone:"banished"},{to:"trash",label:"To trash",tone:"trash"},{to:"deck",label:"Recycle"}]`
  filtered to exclude the current source zone (except `deck`), each `{id:`${source}:selection:${to}`, …,
  onSelect: () => onMoveSelected(to)}`; plus count
  `<span className="inline-flex items-center px-[0.36rem] py-[0.24rem] text-[0.68rem] font-semibold tracking-wider text-[rgba(230,219,166,0.78)] uppercase">{t("current.selectedCount",{count})}</span>`
  and a `Clear Selection` (`tone:"subtle"`, icon `f.X` `"block h-3 w-3 shrink-0"` strokeWidth 2.4).
  Wrapped `"flex flex-wrap items-center justify-center gap-1"` inside `"flex min-w-0 flex-col items-center gap-1"`.
* `mf(card, selection)` (38684) — selection ring on a card:
  `"pointer-events-none absolute inset-0 z-7 rounded-[inherit] border-[0.18rem] border-[#f8d880] bg-[linear-gradient(180deg,rgba(248,216,128,0.18)_0%,rgba(248,216,128,0.05)_42%,rgba(248,216,128,0)_70%)] shadow-[inset_0_0_0_1px_rgba(255,246,206,0.46),0_0_0_1px_rgba(248,216,128,0.62),0_0_22px_rgba(248,216,128,0.34)]"`

### 4.6 Per-card action builders

**`mn({from, card, championZoneEmpty, nonRuneInteractionBusy, sharedBattlefieldToken, playCardFromSource, dispatchBoardAction})`** (38141) — actions for off-board piles (`base`, `trash`, `banished`, `champion`, `legend`, `battlefield*`):
```
Play            id `${from}:${card.id}:play`          disabled || !l.canPlay            tone "play"      → playCardFromSource(from, card)
Recycle         id `${from}:${card.id}:recycle`       disabled || !l.canRecycle         tone "default"   → {type:"send_to_deck", from, cardId, position:"bottom"}
To hand         id `${from}:${card.id}:to-hand`       disabled || !l.canMoveToHand      tone "hand"      → {type:"move_card", from, to:"hand", cardId}
To champion*    id `${from}:${card.id}:to-champion`   disabled || !championZoneEmpty     tone "default"   → {type:"move_card", from, to:"champion", cardId}
Banish|To trash id `${from}:${card.id}:swap-zone`     disabled || !l.canMoveBetweenTrashAndBanished tone "banished"
                                                                                                       → {type:"move_card", from, to: from==="trash"?"banished":"trash", cardId}
(* only pushed when `(0,l0.V)(card,"champion",from)`)
```

**`my(model)`** (38809) — per-card actions inside the deck-peek panel. Two variants:

*runeDeck:*
```
Recycle       id `rune-deck:${card.id}:recycle`        tone "default"  → {type:"recycle_deck_peek_card", cardId, zone:"runeDeck"}  (+ closes when ≤1 card)
Hide|Reveal   id `rune-deck:${card.id}:toggle-reveal`  tone "reveal"   → {type:"set_deck_peek_card_reveal", cardId, reveal:!revealed, zone:"runeDeck"}
```
*deck:*
```
Play          id `deck:${card.id}:play`          tone "play"     → playCardFromSource("deck", card)
Recycle       id `deck:${card.id}:recycle`       tone "default"  → {type:"recycle_deck_peek_card", cardId, zone:"deck"}
To hand       id `deck:${card.id}:to-hand`       tone "hand"     → {type:"take_card_from_deck", cardId, to:"hand"}
To trash      id `deck:${card.id}:to-trash`      tone "trash"    → {type:"take_card_from_deck", cardId, to:"trash"}
On Top        id `deck:${card.id}:on-top`        tone "default"  → {type:"put_deck_peek_card_on_top", cardId, zone:"deck"}
Hide|Reveal   id `deck:${card.id}:toggle-reveal` tone "reveal"   → {type:"set_deck_peek_card_reveal", cardId, reveal:!revealed, zone:"deck"}
```
All are gated by `nonRuneInteractionBusy`; `Recycle`/`On Top` also close the panel when
`myDeckPeekCards.length <= 1` via `deckPeek.onClose()`.

### 4.7 `mv` — trash / banished pile popover (38931)

Props `{zone: "trash"|"banished", pile, cardImageSizes}`. Returns `null` unless `pile.open`.
Translates into `(0, tp.U)({…})` (the generic pile popover, defined outside this file) with:

```
open, suspended, collapsed, collapsedPos, sectionRef,
title        = `${playerName} · ${t(trash ? "sim.trashCards" : "sim.banishedCards")}` for opponent piles, else t("sim.trashCards"|"sim.banishedCards")
infoText     = t(selection ? ("current.trashSelectionHelp"|"current.banishedSelectionHelp")
                           : ("current.reviewTrashPile"|"current.reviewBanishedZone"))
ariaLabel    = t(opponent ? ("sim.lookAtPlayerTrash"|"sim.lookAtPlayerBanished", {playerName})
                          : ("sim.lookAtYourTrash"|"sim.lookAtYourBanished"))
cards, cardImageSizes,
accentLineClassName, popoverClassName, titleRowClassName, countLabelClassName,
onExpand, onCollapse, onClose,
titleActionsClassName="ml-[0.24rem]",
titleActions  = [<md actions={pile.headerActions}/>, <md actions={[selectAllAction]}/>]
actions       = mp(pile.selection)
dragOwner     = "opponent"|"self"     dragZone = zone (="trash"|"banished")
onCardDragStart, onCardDragEnd, dragDisabled,
cardSelectMode= selection ? "control" : "card",
onCardSelect  = selection ? e => selection.onToggleCard(e.id) : pile.onCardSelect
isCardSelected= selection ? e => mu(selection, e.id) : undefined
pingedCardId, pingEventId,
renderCardBadge            = e => mf(e, selection)
renderCardTouchActions     = p => <mb actions={p.resolveCardActions?.(p) ?? []}/>
renderCardActions          = p => <mg actions={p.resolveCardActions?.(p) ?? []}/>
```

### 4.8 `mx` — my deck-peek panel + opponent deck-peek overlay (39176)

Sizing: `W = 15.4 * cardSizeScale`, `q = `${W.toFixed(3)}rem`` used as `cardImageSizes` for the
trash/banished popovers (line 39191).

Mine (`(0, tp.U)` again):
```
title       = inspectionOnly ? t(zone==="runeDeck" ? "sim.runeDeck" : "sim.mainDeck")
            : zone==="runeDeck" ? t("sim.runePeek") : t("sim.deckPeek.title")
infoText    = inspectionOnly ? undefined : zone==="runeDeck" ? t("sim.runePeekHelp") : t("sim.deckPeek.cardHelp")
emptyContent= inspectionOnly || zone!=="deck" ? undefined : <mr/>
backdropContent = 4 "fixed z-0 pointer-events-none bg-[rgba(4,8,18,0.34)]" rectangles cutting a hole out of
             the backdrop (top strip, left strip, right strip, bottom strip) from `deckPeek.backdropCutout
             {top,left,right,bottom}`; right strip width `Math.max(0, window.innerWidth - cutout.right)`,
             bottom strip height `Math.max(0, window.innerHeight - cutout.bottom)`
shouldIgnoreOutsidePointerDown,
titleActionsClassName = "ml-[0.24rem]"
titleActions = <>
    <md actions={deckPeek.titleActions}/>
    <span className="gb-deck-peek-secondary-actions contents"><md actions={[selectAllAction]}/></span>
    <ms actions={deckPeek.moreActions} compactActions={[selectAllAction]}/>
  </>
ariaLabel    = zone==="runeDeck" ? t("sim.lookAtRunesInRuneDeck") : t("sim.deckPeek.lookAtDeck")
countNoun    = zone==="runeDeck" ? {singular: t("sim.deckPeek.rune"), plural: t("sim.deckPeek.runes")} : undefined
cards, cardImageSizes = "(max-width: 600px) 33vw, 224px"
accentLineClassName = "bg-[linear-gradient(90deg,transparent,rgba(121,210,255,0.68)_20%,rgba(121,210,255,0.22)_52%,transparent)]"
popoverClassName    = "gb-deck-peek border-[rgba(179,221,255,0.22)]"
titleRowClassName   = "[&_h3]:text-[#dff4ff]"
countLabelClassName = "border-[rgba(126,207,244,0.18)] bg-[rgba(16,36,64,0.72)] text-[#8ec5df]"
headerActionsClassName = "gap-[0.34rem]"
headerActions = <md actions={deckPeek.headerActions}/>
actions       = mp(deckPeek.selection)
cardImageFallback = inspectionOnly ? "label" : "back"; cardImageFallbackSlot = zone==="runeDeck" ? "runeDeck" : "deck"
touchDragDisabled = true          // deck-peek cards are never touch-dragged
cardSelectMode = "control"
renderCardBadge = overlay: revealedCardIds.includes(id)
  ? <>{mf(card,selection)}
      <span className="pointer-events-none absolute inset-0 z-5 rounded-[inherit] border-[0.18rem] border-[#7df4ff]
              bg-[linear-gradient(180deg,rgba(74,235,255,0.24)_0%,rgba(74,235,255,0.08)_24%,rgba(74,235,255,0)_48%)]
              shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_0_0_1px_rgba(125,244,255,0.72),0_0_24px_rgba(65,221,255,0.62)]"/>
      <span className={clsx("pointer-events-none absolute left-1/2 z-6 -translate-x-1/2 rounded-[0.18rem]
              border border-[#063846] bg-[#d8fbff] px-[0.56rem] py-[0.22rem] text-[0.64rem] font-black
              leading-none tracking-[0.08em] text-[#063846] uppercase
              shadow-[0_0_0_1px_rgba(216,251,255,0.72),0_8px_16px_rgba(3,18,28,0.42),0_0_18px_rgba(79,229,255,0.7)]",
              selection ? "top-12" : "top-[0.42rem]")}>{t("current.revealed")}</span></>
  : mf(card, selection)
renderCardQuickAction = zone==="deck" ? card => <button type="button" className="gb-deck-peek-to-hand"
      disabled={action.disabled} onClick={action.onSelect}>{t("sim.toHand")}</button>  (finds id `deck:${id}:to-hand`)
renderCardTouchActions = card => <mb actions={deckPeek.resolveTouchCardActions(card)}/>
renderCardActions      = card => <mg actions={deckPeek.resolveCardActions(card)}/>
```

Opponent look-at-top overlay (rendered when `opponentDeckPeek.open`, 39640):

```
<div className="absolute inset-0 pointer-events-none z-92" aria-hidden={false}>
  <section role="dialog" aria-live="polite"
    className="absolute z-1 overflow-visible rounded-[0.18rem] border border-[rgba(213,229,255,0.18)]
               bg-[rgba(8,16,34,0.94)] shadow-[0_24px_44px_rgba(2,6,18,0.58)] pointer-events-auto
               left-1/2 right-auto top-1/2 w-[min(52rem,calc(100%-1.5rem))] max-h-[calc(100%-1.5rem)]
               -translate-x-1/2 -translate-y-1/2
               before:content-[''] before:absolute before:inset-[0.08rem]
               before:bg-[linear-gradient(180deg,rgba(22,39,70,0.94),rgba(11,23,47,0.97))] before:pointer-events-none before:rounded-[inherit]
               after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:opacity-[0.46]
               after:gb-ornament-field after:rounded-[inherit] flex flex-col"
    aria-label={t("sim.deckPeek.opponentStatus", {name, status})}>
    <div className="pointer-events-none absolute inset-x-[0.9rem] top-[0.72rem] h-px
                    bg-[linear-gradient(90deg,transparent,rgba(255,190,120,0.54)_20%,rgba(255,190,120,0.16)_52%,transparent)]"/>
    <div className="relative z-1 flex min-h-0 flex-1 flex-col gap-2 p-[0.78rem] pt-[0.9rem]">
      <div className="flex justify-between items-center gap-[0.4rem] [&_h3]:m-0 [&_h3]:text-[0.86rem]
                      [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.06em]">
        <div className="flex items-center gap-[0.44rem] min-w-0">
          <h3 className="text-[#ffe1c3]">{t("sim.deckPeek.opponentStatus",{name,status})}</h3></div>
        <div className="flex items-center justify-end gap-[0.42rem] min-w-0 flex-wrap">
          <p className="shrink-0 text-[0.68rem] font-medium tracking-[0.04em] text-[rgba(235,194,154,0.82)]">
            {t(zone==="runeDeck" ? "sim.deckPeek.runeCount" : "sim.cardCount", {count})}</p>
          <button type="button" onClick={onDismiss} className="rounded-[0.16rem] border border-[rgba(201,218,249,0.18)]
              bg-[rgba(17,31,58,0.86)] px-[0.76rem] py-[0.42rem] text-(--text-soft) text-[0.72rem] font-semibold
              shadow-[inset_0_1px_0_rgba(230,239,255,0.06)] hover:bg-[rgba(22,38,68,0.96)]
              hover:border-[rgba(205,221,248,0.3)] transition-colors">{t("sim.close")}</button></div></div>
      <div className={cardsClassName}>{cards.map((card, index) =>
        <div key={card.id} className={revealed ? of.z : of.n} style={cardStyle}
             onMouseEnter/onMouseMove/onMouseLeave={revealed ? hover : undefined}>
          <span className="absolute top-[0.24rem] right-[0.24rem] text-(--text-soft) text-[0.62rem] leading-none">{index+1}</span>
          {revealed ? <GameCardArt card maxLength={30} overlay={false} imageProfile="preview"/>
                    : <CardBack slot={zone==="runeDeck" ? "runeDeck" : "deck"} insetPx={0} quality={75}
                                sizes="(max-width: 768px) 24vw, (max-width: 1280px) 9rem, 9rem"/>}
        </div>)}</div>
    </div>
  </section>
</div>
```
Reveal status strings: `"runeDeck"===zone ? (revealedAll ? t("sim.deckPeek.revealedTopRune") : t("sim.deckPeek.isLookingAtTopRune"))
: (revealedAll ? t("sim.revealedTopDeckCards") : t("sim.isLookingAtTopDeckCards"))`;
`revealedAll = K.reveal || K.cards.some(mw)`; per-card reveal also true when
`!isPlaceholder && name.trim().length > 0`. Everything is wrapped in the board-customization provider
`(0, rH.M)({customization: opponentBoardCustomization})`.

### 4.9 Deck-peek action ids (`deck-peek:*`) — defined at 61956–62060 (outside range)

Supplied by the board root into `mx.deckPeek`:
* `titleActions`: `deck-peek:look-more` (label `look_top_rune`/`look_top_card` when nothing looked at,
  else `"Look at 1 More"`; `compactLabelKey` `sim.deckPeek.lookOneMoreCompact`;
  action `{type:"peek_deck_top", count:1, zone}`), plus `deck-peek:recycle-all` (`"Recycle All"`,
  `onSelect: recycleDeckPeekCards`) when zone ≠ runeDeck and cards were already looked at.
* `moreActions`: `deck-peek:look-bottom` (`look_at_bottom`, `onSelect: lookAtDeckBottom`, reasons
  `sim.deckPeek.mainDeckEmpty` / `sim.deckPeek.allMainDeckCardsLookedAt`),
  `deck-peek:shuffle-unrecycled` (`shuffle_unrecycled`, `onSelect: shuffleUnrecycledDeckAndClose`,
  reasons `sim.deckPeek.noRecycledCardsProtected` / `sim.deckPeek.fewerThanTwoUnrecycledCards`),
  `deck-peek:shuffle-deck` (`"Shuffle Deck"`, `onSelect: shuffleDeckAndClose`, reason `sim.deckPeek.fewerThanTwoCards`).
* `headerActions`: `deck-peek:toggle-reveal-all` (`"Hide All"`/`"Reveal All"`, tone `reveal`,
  `pressed`, action `{type:"set_deck_peek_cards_reveal", cardIds, reveal, autoRevealNewCards, zone}`).
* All disabled reasons share `sim.deckPeek.waitForCurrentAction` when `nonRuneInteractionBusy`.
* Dragging a deck-peek card is wired via `beginDeckPeekDrag` (§3.9) which is **rejected for runeDeck**
  (`"runeDeck" === board.deckPeek.zone → t.preventDefault()`), and the popover passes
  `touchDragDisabled:true` so only mouse HTML5 DnD is used there.

### 4.10 Keyboard handling in this range

* `ms`: Escape closes the "More" menu (`preventDefault`, `stopPropagation`), focus returns to the trigger.
* `u9` (settings): Escape closes, focus returns to the settings trigger.
* `hu` (sidebar): when a panel is open in overlay mode, a window `keydown` handler (a) **Escape** closes
  the panel, (b) **Tab/Shift+Tab** is trapped between the first and last focusable element *inside*
  `[data-tablet-panel="<open panel>"]` (selector
  `button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]`,
  filtered by `hp(e) = e.getClientRects().length && !e.closest("[hidden]")`), focus restored to the
  element that opened it (`eC.current`).
* `hk`'s "copy room code" button and the compact-player-menu use roving `ArrowUp/ArrowDown/Home/End`.
* `fX`: **Space** (no modifiers) opens the time-warp dialog when the touch layout is active.
* Deck-peek popover itself (`tp.U`) owns any other keys (outside this file).

---

## 5. Pile / deck / trash / banish rendering

**Nothing of the pile visual is implemented inside 35 000–48 600** — this range only *consumes* it.
Precise cross-references for the parent:

### 5.1 Stack visual math — `sH`, `sF`, `sK`, `sW` (24099–24180, outside range) — constants verbatim

```js
sH = {                                   // large / normal pile presentation
  depthThresholds:  [ {maxCount:0,value:0}, {maxCount:1,value:1}, {maxCount:3,value:2},
                      {maxCount:6,value:3}, {maxCount:12,value:4}, {maxCount:20,value:5},
                      {maxCount:35,value:6}, {maxCount:Infinity,value:7} ],
  spreadThresholds: [ {maxCount:1,value:0}, {maxCount:3,value:0.12}, {maxCount:6,value:0.2},
                      {maxCount:12,value:0.29}, {maxCount:20,value:0.38}, {maxCount:35,value:0.47},
                      {maxCount:Infinity,value:0.56} ],
  maxSpreadRem: 0.56, minLayerOpacity: 0.52, layerOpacityStep: 0.11,
  minLayerScale: 0.93, layerScaleStep: 0.017,
};
sF = {                                   // compact pile presentation (e.g. rune deck)
  depthThresholds:  [ {maxCount:0,value:0}, {maxCount:1,value:1}, {maxCount:Infinity,value:2} ],
  spreadThresholds: [ {maxCount:1,value:0}, {maxCount:Infinity,value:0.16} ],
  maxSpreadRem: 0.16, minLayerOpacity: 0.68, layerOpacityStep: 0.14,
  minLayerScale: 0.97, layerScaleStep: 0.012,
};
function sK(count, thresholds) { for (let t of thresholds) if (count <= t.maxCount) return t.value;
                                 return thresholds[thresholds.length-1]?.value ?? 0; }
function sW(count, cfg, centred = false) {
  let a = sK(count, cfg.depthThresholds), n = sK(count, cfg.spreadThresholds),
      o = cfg.maxSpreadRem - n, i = centred ? cfg.maxSpreadRem / 2 : 0,
      l = a > 0 ? Array.from({length:a}).map((_, r) => {
            let l = Math.max(1, a - 1), d = a - 1 - r;
            return { offsetRem: o + (r / l) * n - i,
                     opacity: Math.max(cfg.minLayerOpacity, 1 - d * cfg.layerOpacityStep),
                     scale: d === 0 ? 1 : Math.max(cfg.minLayerScale, 1 - d * cfg.layerScaleStep),
                     zIndex: r + 1 };
          }) : [];
  return { depth: a, maxSpreadRem: cfg.maxSpreadRem, topOffsetRem: cfg.maxSpreadRem - i, layers: l };
}
```
Stack container (24284): width `calc(var(--card-width) + ${maxSpreadRem}rem * var(--pile-stack-spread-scale, 1))`,
height `calc(var(--card-height) + ${maxSpreadRem}rem * var(--pile-stack-spread-scale, 1))`.
Each background layer (24303):
`transform: translate(calc(${offsetRem}rem * var(--pile-stack-spread-scale, 1)), calc(${offsetRem}rem * var(--pile-stack-spread-scale, 1))) scale(${scale})`,
`transformOrigin:"center"`, `opacity`, `zIndex`, class `clsx(of.d, "absolute left-0 top-0 border-transparent shadow-none")`,
key `` `pile-layer-${slot}-${i}` ``. Top card back (24350): `transform: translate(calc(${topOffsetRem}rem * var(--pile-stack-spread-scale,1)), …)`,
`zIndex:20`, class `"cardBack absolute left-0 top-0 border-transparent shadow-none"`,
key `` `pile-${slot}-top` ``, alt `t("sim.board.namedCardBack",{name})`.

### 5.2 Pile section attributes (24456–24490 / 24670–24700, outside range)

```
<section data-board-lines data-pile-slot={slot} data-pile-owner={owner} data-pile-count={count}
         data-stack-presentation={presentation} data-stack-depth={depth}
         data-stack-top-card-centered={"true"|"false"}
         ref onDrop onDragOver onDragLeave
         className="relative h-auto w-fit min-h-0 rounded-[0.08rem] border-none bg-transparent p-[0.08rem]
                    inline-flex items-center justify-center shadow-none overflow-visible
                    after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:gb-ornament-pile"
         + (exhaustedFlip && "rotate-180 origin-center") + classOverrides>
```
Count badge: `data-pile-count-placement="top-right|top-left|bottom-right|bottom-left"` with
`right-[0.22rem] top-[0.16rem]` / `left-[0.22rem] top-[0.16rem]` / `right-[0.22rem] bottom-[0.18rem]`
/ `left-[0.22rem] bottom-[0.18rem]`, class
`"absolute z-40 pointer-events-none"`, inner `<strong data-pile-counter>` (component `s$`, 24092).
Banish pile button: `data-banished-pile-button` at 25178.

### 5.3 Pile-related selectors used from *this* range

* `'[data-pile-slot="mainDeck"]'` — drag target sniffing (36292, 37181)
* `'[data-pile-slot="mainDeck"][data-pile-owner="self"]'` selector-string + stop (8556, 8574)
* `` `button[data-drop-zone="${zone}"][data-card-id="${CSS.escape(id)}"]` `` — `eQ` (36170) resolves the
  DOM button for a board card, filtered to `closest("[data-zone-owner]").dataset.zoneOwner === dragOwner`
* `` `[data-pile-slot="${slot}"][data-pile-owner="${owner}"]` `` (53312) and
  `'[data-pile-owner="self"]:is([data-pile-slot="mainDeck"],[data-pile-slot="runeDeck"])'` (51479) —
  keyboard / hotkey helpers later in the file.

### 5.4 Trash / banished popover + pile context menus

The trash/banished **pile popover** and its per-card menus are rendered *from* `mv` (§4.7) and the
action lists come from `mn` / the caller. The per-pile context menus themselves (`mainDeck` /
`runeDeck` right-click menus, deck-bottom look, pile click actions) live outside this range; the
action **strings** they send that I can confirm from this range are exactly:
`send_to_deck` (`position:"top"|"bottom"`), `send_to_rune_deck`, `take_top_from_deck` (`to: zone|"banished"`),
`take_card_from_deck` (`to`, `toIndex`), `recycle_rune_for_floating_energy`, `recycle_deck_peek_card`,
`put_deck_peek_card_on_top`, `set_deck_peek_card_reveal`, `set_deck_peek_cards_reveal`, `peek_deck_top`,
`clear_deck_peek`, `move_card` (`from/to/cardId/toIndex/asHidden`), `equip_card`
(`equipmentCardId/unitCardId/asAttachment`), `chain_add` (`from: zone|"deck"|"battlefieldMarker"`,
`battlefieldZone?`, `cardId`, `clientEntryId`). Full list of 138 action types: `api/game-action-types.txt`.

---

## 6. Sidebar / log / chat / settings panels

### 6.1 `hu` — the tablet/phone sidebar shell (44656–45611)

Props: `{layout, unreadCount, header, settings, actionBarProps, showRoomActions, roomActionsOverride,
status, log, chain, chainActive, showdownActive, targeting, chat, supplementaryPanel, sidebarClass,
topClass}`.

* `layout = {compact, overlay, overlaySidebar, closeOverlay, phonePortrait, scope, mode, viewport,
  toggleSidebar, togglePanel, toggleFullscreen, fullscreen, fullscreenSupported, fullscreenError}`
  (from the layout hook outside range). Derived: `e_ = layout.compact`, `ej = layout.overlay`,
  `eP = compact && overlay === "sidebar"`, `eS = !compact || eP`, `eR = supplementaryPanel?.content ?? chat`,
  `eA = supplementaryPanel?.label ?? t("chat")`.
* "Sidebar expand suggestion" (`eM`): a dismissible tip shown **once** (localStorage key
  `"riftbound_simulator_sidebar_expand_suggestion_dismissed_v1"`, via `eE(key, enabled)`) and only when
  the *first* interaction after load comes from a **mouse pointer** (`pointermove`/`pointerdown`
  with `pointerType === "mouse"`) or a real key (`keydown`, ignoring `Unidentified`/`Process`);
  rendered as `oh` (`testId: "sidebar-expand-suggestion"`, title `sidebarSuggestionTitle`,
  body `sidebarSuggestionBody`, dismissLabel `dismissSidebarSuggestion`, placement `"left"`),
  same attributes on the trigger: `data-riftbound-…`-free; the trigger gets
  `"!border-[rgba(185,219,255,0.72)] shadow-[0_0_0_2px_rgba(129,190,255,0.2),0_0_16px_rgba(91,161,238,0.22)]"`
  while shown.
* Panel state: `ej = layout.openPanel` (`"log" | "chat" | "sidebar" | null`),
  `eW = ej ?? "none"`. Backdrop `N` when `compact && openPanel`:
  `<div className="tablet-panel-backdrop" aria-hidden onPointerDown={stopPropagation} onClick={e => {e.stopPropagation(); closeOverlay();}}/>`.

Structure:

```
<aside ref
  data-hover-preview-sidebar="true"
  data-tablet-sidebar
  data-supplementary-sidebar={hasSupplementary}
  data-compact={compact}
  data-open-panel={openPanel ?? "none"}
  className={clsx("tablet-sidebar", !compact && showSidebar, !compact && supplementary && hc.default.supplementarySidebar)}>

  {/* 1 — phone fullscreen control */}
  {layout.phonePortrait && <div className="phone-fullscreen-control" hidden={!!openPanel}>
      {fullscreenButton ?? (<>
        <button type="button" className="tablet-icon-button" aria-label={t("fullscreenHelp")}
                aria-haspopup="dialog" popoverTarget={helpId}><expand size={18}/></button>
        <div id={helpId} popover="auto" role="dialog" aria-label={t("fullscreenHelp")}
             className="phone-fullscreen-help">
          <strong>{t("fullscreenHelp")}</strong><p>{t("fullscreenHomeScreen")}</p></div></>)}
      {fullscreenError && <span role="status" className="tablet-fullscreen-error">{t("fullscreenError")}</span>}
    </div>}

  {/* 2 — phone sidebar control */}
  {layout.phonePortrait && <div className="phone-sidebar-control" hidden={!!openPanel}>{sidebarToggle}</div>}
  {/* 3 — phone settings control */}
  {layout.phonePortrait && <div className="phone-settings-control" hidden={!!openPanel}>{settings}</div>}
  {/* 4 — phone social control */}
  {layout.phonePortrait && socialEnabled &&
    <div className="phone-social-control" hidden={!!openPanel}><SocialBar ... compact phoneControls="social"/></div>}

  {/* 5 — replay toolbar wrapper */}
  <div data-replay-toolbar={replayToken || undefined} className={compact ? "tablet-sidebar-rail" : "contents"}>
     {/* 5a — corner block (rail only) */}
     {compact && <div className="tablet-sidebar-corner">
        {status}
        <div className="tablet-rail-group">
          {fullscreenButton}
          {layout.phonePortrait ? null : sidebarToggle}
          {socialEnabled ? <SocialBar ... compact onCloseExpandedSidebarPanel={closeOverlay} key={layout.scope}/>
           : actionBarRenderer && !layout.phonePortrait
             ? <div className="tablet-game-actions" data-room-actions-override="tablet">
                 {typeof actionBarRenderer === "function" ? actionBarRenderer({compact:true, phoneControls:false}) : actionBarRenderer}</div>
             : null}
        </div>
        {fullscreenError}
      </div>}

     {/* 5b — controls row */}
     <div className="tablet-sidebar-controls" aria-label={t("boardControls")}>
        {layout.phonePortrait && boardControls ? <div className="tablet-rail-group">{boardControls}</div> : boardControls}
        {compact && !layout.phonePortrait ? settings : null}
        {compact || layout.phonePortrait ? null : sidebarToggle}
        {layout.phonePortrait && socialEnabled
          ? <div className="tablet-rail-group" data-phone-room-actions><SocialBar compact phoneControls/></div>
          : layout.phonePortrait && roomActions
            ? (typeof roomActions === "function"
                ? <div className="tablet-rail-group" data-phone-room-actions>{roomActions({compact:true, phoneControls:true})}</div>
                : <div className="phone-game-actions ml-auto" data-phone-leave-control>{roomActions}</div>)
            : null}
        {compact ? null : fullscreenButton}
        {compact ? null : fullscreenError}
     </div>
  </div>

  {/* 6 — sidebar panel */}
  <div data-tablet-panel="sidebar" className={clsx("tablet-full-sidebar", open && isSidebarPanel)} aria-label={t("sidebar")}
       role={isSidebarPanel ? "dialog" : undefined} aria-modal={!!isSidebarPanel || undefined}>
    {isSidebarPanel && <div className="tablet-panel-heading"><strong className="flex-1">{t("sidebar")}</strong>
                          {fullscreenButton}{panelHeadingClose(t("sidebar"))}{fullscreenError}</div>}
    <div className={clsx("tablet-sidebar-top", open && isSidebarTopVisible)}>
      <div className="tablet-sidebar-header" hidden={!open}>
        <Activity mode={open ? "visible" : "hidden"}>{header}</Activity></div>
      <div data-tablet-panel="log" className="tablet-log-panel" hidden={!open && openPanel !== "log"}
           role={compact && openPanel==="log" ? "dialog" : undefined}
           aria-modal={(!!compact && openPanel==="log") || undefined} aria-label={t("log")}>
        {compact && openPanel === "log" ? panelHeading(t("log")) : null}
        <Activity mode={(open || openPanel==="log") ? "visible" : "hidden"}>{log}</Activity>
      </div>
    </div>
    <ChainPanel compact={!open} active={chainActive} showdownActive targeting scope>{chain}</ChainPanel>   // cZ (31676)
    {chatEnabled && <div data-tablet-panel="chat"
         className={clsx("tablet-chat-panel", supplementary && "overflow-hidden rounded-sm border border-white/10 bg-slate-950/30")}
         style={supplementary ? {
             gridTemplateRows: (!compact && supplementary.hideDesktopHeading) ? "minmax(0, 1fr)" : "auto minmax(0, 1fr)",
             ...(compact && openPanel === "chat" ? {height: "auto"} : {}) } : undefined}
         hidden={!open && openPanel !== "chat"}
         role={compact && openPanel==="chat" ? "dialog" : supplementary ? "region" : undefined}
         aria-modal={(!!compact && openPanel==="chat") || undefined} aria-label={label}>
      {compact && openPanel==="chat" ? panelHeading(label)
        : supplementary && (compact || !supplementary.hideDesktopHeading)
          ? <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-1.5 text-[0.65rem]
                          font-medium text-slate-300">
              <span aria-hidden className="[&_svg]:size-3">{supplementary.icon}</span>
              <strong>{label}</strong></div>
          : null}
      {chatContent}
    </div>}
  </div>
</aside>
```

Rail buttons (verbatim, 44970–45070):

```
<button ref type="button"
  data-testid={supplementary ? "tablet-supplementary-trigger" : "tablet-chat-trigger"}
  className="tablet-icon-button"
  aria-expanded={openPanel === "chat"}
  aria-label={!supplementary && unreadCount ? t("chatUnread", {count: unreadCount}) : chatLabel}
  onClick={() => layout.togglePanel("chat")}>
  <span aria-hidden>{supplementary?.icon ?? <MessageIcon size={18}/>}</span>
  <span className="tablet-control-label">{supplementary?.shortLabel ?? chatLabel}</span>
  {!supplementary && unreadCount > 0 &&
    <span data-testid="chat-unread-count" className="tablet-unread-badge" aria-hidden>
      {unreadCount > 99 ? t("unreadOverflow") : unreadCount}</span>}
</button>

<button ref type="button" className="tablet-icon-button" aria-expanded={openPanel === "log"}
        aria-label={t("log")} onClick={() => layout.togglePanel("log")}>
  <ScrollingLogIcon size={18}/><span className="tablet-control-label">{t("log")}</span>
</button>
```

Panel heading helper `eT(label)`:
```
<div className="tablet-panel-heading"><strong>{label}</strong>
  <button type="button" data-panel-close className="tablet-icon-button"
          onClick={closeOverlay} aria-label={t("closePanel", {panel: label})}><X size={18}/></button></div>
```

Sidebar toggle button: `className={clsx("tablet-icon-button", suggestionShown && "!border-[rgba(185,219,255,0.72)] shadow-[0_0_0_2px_rgba(129,190,255,0.2),0_0_16px_rgba(91,161,238,0.22)]")}`,
`aria-label={t(compact ? "openSidebar" : "collapseSidebar")} aria-expanded aria-describedby`,
icon = `expand ? <ho size={18}/> : <hl size={18}/>`; `onClick` = `{compact && !overlaySidebar && dismissSuggestion();
layout.toggleSidebar(); if (!overlaySidebar) requestAnimationFrame(() => railRef.current?.focus({preventScroll:true}));}`.

Fullscreen button (only when `layout.fullscreenSupported`):
`className="tablet-icon-button" aria-label={t(fullscreen ? "exitFullscreen" : "fullscreen")}`
icon `fullscreen ? <ha size={18}/> : <he size={18}/>`; error `role="status" className="tablet-fullscreen-error"`.

CSS summary: `.tablet-icon-button{color:#e5f3ff;background:#13263cf5;border:1px solid #718aa655;
border-radius:.4rem;flex-direction:column;gap:.1rem;min-width:2.75rem;min-height:2.75rem;padding:.35rem;
display:inline-flex;position:relative}` (+ `:before` inset pill `#152941e6`, hover `#254362`),
`.tablet-sidebar-controls{pointer-events:auto;justify-content:flex-end;gap:.25rem;display:flex;position:relative}`,
`.tablet-panel-backdrop{z-index:159;background:#030b1650;position:fixed;inset:0}`,
`.tablet-full-sidebar{flex:1;gap:.14rem;min-height:0;display:grid}`,
`.tablet-log-panel,.tablet-chat-panel{min-height:0;display:grid}` + `[hidden]{display:none}`,
`.tablet-panel-heading{justify-content:space-between;align-items:center;gap:.5rem;padding:.3rem;font-size:.85rem;display:flex}`,
`.tablet-control-label{word-break:keep-all;text-wrap:balance;font-size:.56rem;line-height:1}`,
`.tablet-unread-badge` (see CSS), `.phone-*-control{z-index:151;pointer-events:auto;position:absolute;top:0;right:-.125rem}`
with per-control `top` overrides (`phone-sidebar-control{top:1.5rem}`, `phone-settings-control{top:3rem}`,
`phone-social-control{top:4.5rem}`).
`data-phone-room-actions` / `data-phone-leave-control` / `data-room-actions-override="tablet"|"desktop"`
mark the injected room-action slots.

### 6.2 `hk` — sidebar room header (46342–46634)

```
<div className="grid gap-[0.14rem]">
  <div data-sidebar-room-header
       className="grid grid-cols-[0.22rem_minmax(0,1fr)_auto] gap-x-[0.2rem] gap-y-[0.08rem] px-[0.2rem] py-[0.1rem]">
    {activeTurnPlayerName &&
      <span role="img" data-sidebar-turn-indicator={isPerspectiveTurn ? "self" : "opponent"}
            aria-label={t("sim.playerTurn",{playerName})} title={t("sim.playerTurn",{playerName})}
            className={clsx("col-start-1 row-start-1 row-span-2 w-full rounded-full",
                           isPerspectiveTurn ? "bg-[#78ddb7]" : "bg-[#f4d06f]")}/>}
    <div className="col-start-2 min-w-0 flex items-center gap-[0.26rem]">
      {typeof turnNumber === "number" &&
        <p className="m-0 shrink-0 whitespace-nowrap text-[0.92rem] font-semibold leading-none tracking-[0.02em] text-[#edf4ff]">{t("sim.turn",{turnNumber})}</p>}
      {matchFormat === "bo3" &&
        <span className="ml-auto shrink-0 whitespace-nowrap text-[0.76rem] font-medium leading-none text-[#a9bbd4]">{t("sim.game",{gameNumber})}</span>}
    </div>
    <div data-sidebar-room-metadata
         className={clsx("col-start-2 row-start-2 min-w-0 flex flex-wrap items-center gap-[0.14rem]",
                         Number.isFinite(createdAtMs) ? "justify-start" : "justify-end")}>
      <div className="flex shrink-0 items-center gap-[0.26rem]"><GameTimingBadge .../></div>
      {showRoomActions &&
        <button type="button" onClick={onCopyRoomCode}
          aria-label={t(copied ? "sim.roomCodeCopied" : "sim.copyRoomCode")}
          title={t(copied ? "sim.roomCodeCopied" : "sim.copyRoomCode")}
          className={clsx("group ml-auto inline-flex shrink-0 items-center gap-[0.18rem] whitespace-nowrap rounded-[0.2rem] text-[0.64rem] leading-none transition-colors",
                          copied ? "text-[#dff4ff]" : "text-[#95a8c7] hover:text-[#dbe7fb]")}>
          <span data-sidebar-room-label className="uppercase tracking-[0.03em] text-[#6f83a3] group-hover:text-[#9fb5d6] transition-colors">{t("sim.room")}</span>
          <span className="font-mono text-[0.74rem] font-semibold text-[#edf4ff]">{roomCode}</span>
          <span aria-hidden className={clsx("inline-flex h-[0.72rem] w-[0.72rem] items-center justify-center transition-[opacity,transform,color] duration-120",
                 copied ? "opacity-100 translate-y-0 text-[#dff4ff]"
                        : "opacity-70 translate-y-px text-[#8ea4c6] group-hover:opacity-100 group-hover:translate-y-0 group-hover:text-[#dbe7fb]")}>
            {copied ? <Check className="h-[0.72rem] w-[0.72rem]" strokeWidth={2}/> : <Copy className="h-[0.72rem] w-[0.72rem]" strokeWidth={1.7}/>}</span>
        </button>}
    </div>
    <div data-sidebar-header-tools
         className="col-start-3 row-start-1 row-span-2 relative flex min-h-[2.3rem] items-stretch gap-[0.14rem]">
      {broadcastDashboardHref &&
        <a data-testid="open-broadcast-dashboard" href={…} target="_blank" rel="noopener noreferrer"
           aria-label={t("sim.broadcast.openDashboard")} title={t("sim.broadcast.openDashboard")}
           className="group relative inline-flex min-h-6 w-[1.6rem] min-w-[1.6rem] items-center justify-center self-stretch
                      rounded-[0.28rem] border border-[rgba(116,239,255,0.3)] bg-[rgba(12,38,58,0.76)] text-[#a7f5ff]
                      transition-colors hover:border-[rgba(116,239,255,0.56)] hover:bg-[rgba(18,52,76,0.92)]
                      hover:text-[#d4fbff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#74efff]">
          <RadioTower className="h-[0.78rem] w-[0.78rem]" strokeWidth={1.9}/></a>}
      {showSettings && <GameSettingsTrigger cardSizePercent cardSizeSample onCardSizePercentChange/>}   // u9
    </div>
  </div>
  {showRoomActions
    ? <div className="relative z-80 grid gap-[0.14rem] overflow-visible"><RoomActionsBar {...actionBarProps} key={roomCode}/></div>
    : roomActionsOverride
      ? <div data-room-actions-override="desktop" className="relative z-80 flex justify-end overflow-visible">
          {typeof roomActionsOverride === "function" ? roomActionsOverride({compact:false, phoneControls:false}) : roomActionsOverride}</div>
      : null}
</div>
```

### 6.3 Game settings panel

**Trigger component `u9`** (37687) — props `{cardSizePercent, cardSizeSample, onCardSizePercentChange, compact, onOpen}`:

```
<div ref={rootRef} className="relative flex items-stretch">
  <button ref={triggerRef}
    data-testid="game-settings-trigger"
    data-riftbound-locale-focus-target="game-settings"
    type="button" aria-label={t("current.gameSettings")} title={t("current.gameSettings")}
    aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
    className={clsx((compact ? "tablet-icon-button"
      : "group relative inline-flex min-h-6 w-[1.6rem] min-w-[1.6rem] items-center justify-center self-stretch rounded-[0.28rem] border transition-colors"),
      open ? "border-[rgba(188,216,251,0.48)] bg-[rgba(34,56,91,0.96)] text-[#edf4ff]"
           : "border-[rgba(178,198,229,0.22)] bg-[rgba(17,31,58,0.72)] text-[#cfe0fb] hover:border-[rgba(207,222,245,0.36)] hover:bg-[rgba(26,43,72,0.92)] hover:text-[#edf4ff]")}
    onClick={toggle}>
    <SlidersIcon className={compact ? "h-[1.125rem] w-[1.125rem]" : "h-[0.78rem] w-[0.78rem]"} strokeWidth={1.9}/></button>
  {open ? (compact ? createPortal(panel, document.body) : panel) : null}
  {open && showPreviewSample ? <SizeSample sample panelRef kind percent label={t("current.cardSize"|"current.previewSize")}/> : null}
</div>
```
Outside-dismiss: `pointerdown` capture; Escape closes and returns focus to the trigger.
`(0, u4.useRiftboundLocaleSwitchFocusTarget)("game-settings", panelRef, resetFn)`.

**Panel `u9`'s inner JSX** (37790):

```
<motion.section ref={panelRef} data-game-settings-panel data-compact={compact} id role="dialog"
  aria-labelledby className="game-settings-panel pointer-events-auto absolute right-0 top-[calc(100%+0.46rem)] z-135
    grid max-h-[calc(100dvh-1rem)] w-[17rem] max-w-[calc(100vw-1rem)] gap-2 overflow-y-auto rounded-[0.5rem]
    border border-[rgba(212,227,251,0.34)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))]
    p-[0.6rem] text-left shadow-[0_16px_38px_rgba(3,8,20,0.48)]"
  initial={{opacity:0, y:-8, scale:0.98}} animate={{opacity:1, y:0, scale:1}}
  transition={{duration:0.16, ease:"easeOut"}}>

  <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.5rem]
                     border-b border-[rgba(181,207,241,0.14)] px-[0.08rem] pb-2">
    <div className="min-w-0"><h2 className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#edf4ff]">{t("current.gameSettings")}</h2></div>
    <RiftboundLocaleToggle focusRestoreTarget="game-settings"
      className="shrink-0 rounded-[0.28rem] text-[0.56rem] tracking-[0.04em] focus-visible:outline-2
                 focus-visible:outline-offset-1 focus-visible:outline-[#9cc9ff]"/>
  </header>

  <section aria-labelledby className="grid gap-1">
    <div className="flex items-center gap-[0.4rem]"><MonitorIcon className="h-[0.82rem] w-[0.82rem] text-[#a9cdef]" strokeWidth={1.8}/>
      <h3 className="m-0 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#7991b5]">{t("current.display")}</h3></div>
    <RangeSlider label={t("current.cardSize")} percent={cardSizePercent} min={cw.G} max={cw.w} step={cw.L}
                 valueText={t("sim.cardSizePercentage",{percent})} onChange onSampleHoverChange={v => setSampleKind(v ? "card" : null)}/>
    {previewsEnabled && <RangeSlider label={t("current.previewSize")} percent min={cC.R} max={cC.s} step={cC.x}
                 valueText={t("sim.previewSizePercentage",{percent})} …/>}
  </section>

  <section aria-labelledby className="grid gap-1 border-t border-[rgba(181,207,241,0.14)] pt-2">
    …<ShirtIcon …/><h3 …>{t("current.opponentCosmetics")}</h3>
    <RangeSlider label={t("current.intensity")} min={u6.j} max={u6.p} step={u6.T}
                 valueText={t("sim.opponentCosmeticsPercentage",{percent})}/>
  </section>

  <section aria-labelledby className="grid gap-1 border-t border-[rgba(181,207,241,0.14)] pt-2">
    …{(volume === 0 ? <VolumeX/> : <Volume2/>)} className="h-[0.82rem] w-[0.82rem] text-[#a9cdef]"
    <h3 …>{t("current.audio")}</h3>
    <RangeSlider label={t("current.soundEffects")} min={u3.C} max={u3.D} step={u3.n}
                 valueText={t("sim.soundEffectsVolumePercentage",{percent})}/>
  </section>
</motion.section>
```
**There are no boolean toggles in this panel — only four sliders**, sections
**Display / Opponent cosmetics / Audio**, plus the locale toggle. Exact slider labels:
`current.cardSize`, `current.previewSize`, `current.intensity`, `current.soundEffects`.

**`u7` — slider row** (37579):

```
<div className="grid grid-cols-[5.3rem_minmax(0,1fr)_2.8rem] items-center gap-2">
  <label htmlFor={id} className="whitespace-nowrap text-[0.7rem] font-semibold leading-4 text-[#dbe8f8]">{label}</label>
  <input ref id type="range" min max step value aria-valuetext={valueText}
         className="h-6 w-full min-w-0 cursor-pointer accent-[#9cc9ff]"
         onChange={e => onChange(Number(e.currentTarget.value))}
         onPointerEnter={e => { if (e.pointerType === "mouse") onSampleHoverChange?.(true); }}
         onPointerLeave={() => onSampleHoverChange?.(false)} />
  <output htmlFor={id} className="rounded-[0.22rem] border border-[rgba(181,207,241,0.2)] bg-[rgba(8,16,31,0.58)]
         px-[0.38rem] py-[0.16rem] text-center text-[0.64rem] font-semibold tabular-nums text-[#d8e8ff]">{percent}%</output>
</div>
```

**`u8` — hover size-preview sample** (37459): a body-level portal
(`createPortal(..., document.body)`) with `data-game-settings-sample={kind}` on
`"pointer-events-none fixed z-2147483647"`; anchor algorithm:
```
fontPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
r = cardGeometry({landscape:false, rotationDeg:0, scale: viewportScale({viewportWidth,viewportHeight}) * percent/100})
w = kind==="card" ? sample.widthRem * fontPx : r.outerWidth
h = kind==="card" ? sample.heightRem * fontPx : r.outerHeight
left = rect.left - w - 16 >= 8 ? rect.left - w - 16 : rect.right + 16
bail if left + w > innerWidth - 8 || h + 40 > innerHeight
top = round(max(8, min(rect.top, innerHeight - h - 40)))
```
Body: `<div className="relative overflow-hidden rounded-[0.4rem] bg-[#0c1428] shadow-[0_16px_38px_rgba(3,8,20,0.6)]">`
→ `GameCardArt profile={kind==="card" ? "board" : "preview"} sizes={`${w}px`} loading="eager" className="object-cover"`,
then `"mt-1 rounded bg-[#0c172b] px-2 py-1 text-center text-xs font-semibold tabular-nums text-[#d8e8ff]"`
containing `{label} · {percent}%`.

### 6.4 Battlefield surfaces (`ps` / `pm` / `pc`) — for completeness of this range

`pm` (43260) is the battlefield container that maps board state → props for `ps`. `ps` (41779, memo,
custom comparator to 43178) renders one battlefield with **two** drop roots:

```
<section data-top-board-lines data-bottom-board-lines data-lines-frame data-might-border
         data-board-drag-active={"true"|"false"} data-ghost-zone={"true"|"false"}
         data-buff-action-armed={"true"|"false"} data-play-hidden-target data-state-border
         className={…see §3.8…} onDrop onDragOver onDragEnter onDragLeave …>
  <div data-battlefield-card-rows className="min-h-0 relative grid grid-rows-2 gap-[0.12rem] h-full pt-[0.36rem] pb-[0.36rem] overflow-visible" ref>
    <div data-drop-zone-root={zone} data-zone-owner="opponent" data-board-lines
         data-ordered-drop-preview-index={topPreviewIndex ?? undefined} ref
         className="min-h-0 relative rounded-[0.08rem] bg-transparent py-[0.16rem] px-[0.2rem] flex items-start
                    overflow-visible shadow-none justify-start before:…transparent… after:… after:gb-ornament-corner-bottom-right"/>
    <div data-drop-zone-root={zone} data-zone-owner="self" data-board-lines
         data-ordered-drop-preview-index={bottomPreviewIndex ?? undefined} ref
         className="… flex items-end … after:gb-ornament-corner-top-left"/>
  </div>
  <… header/labels …>
  <BATTLEFIELD_MIGHT panel per owner>     // mq / mU
</section>
```
Board-card layout inside each root is computed by `dB({visibleCards, cardWidthRem, availableSpreadRem,
attachedEquipmentPeekRightRem, zLayerStep:10, stepRem, exhaustedExtraRem, edgeInsetRem, edgeInsetWhenExhaustedRem,
targetArrowCardIds, previewGap:{index, layoutHoldingCardId, layoutHoldingCardExhausted}})` (external),
returning `{layoutCards, leftByCardId, zIndexByCardId, layoutIndexByCardId,
attachedPlacementByCardId, hasGap, gapIndex, leftOffsets, virtualRightPrefixRem, dropMidpointsRem}`.
`stepRem = cardWidth + dP.l(cardWidth, 1.05)`; `exhaustedExtraRem = dP.l(cardWidth, 1.2)`; the gap
placeholder element is quoted in §3.8. `cardWidthRem` default `m8 = dP.t`.
`m4` (41416) positions the conquer/play prompt over the battlefield by scoring 7 candidate spots
(`above`, `below`, `column-top`, `column-bottom`, `turns`, plus left/right variants) against an
occlusion cost table `m5`:
```
[["[data-battlefield-surface] button[data-card-id]", 10],
 ["[data-board-turn-controls], .tablet-sidebar-rail button, .tablet-chain-panel:not([hidden]), [data-player-area='actions'] button", 6],
 ["[data-player-layer='self'] button[data-card-id], [data-zone-owner='self'] button[data-card-id]", 4],
 ["button[data-card-id]", 2],
 ["[data-battlefield-marker]", 1]]
```
with a `0.3 * rootFontSize` margin and clamped left within the battlefield slot rect.
`pc` (43179) is a framer-motion presence wrapper: `initial {opacity:0, scale:0.94, y:10}`,
`animate {opacity:1, scale:1, y:0}`, `exit {opacity:0, scale:0.96, y:8}`, transitions
`{duration:0.18, ease:[0.2,0.7,0.2,1]}` / `{duration:0.22, …}`, `className="min-h-0 min-w-0 h-full"`.

### 6.5 Log / chat / emote content — **not in this chunk**

`hu` receives them as opaque props: `log` (`ei`), `chat` (`eu`), `supplementaryPanel` (`em`),
`header` (`ee`), `status` (`eo`), `chain` (`el`). The game-log entry rendering, the chat composer
and the emote picker live in other chunks (`1kx2ucot0m321.js` = friends/invites/chat UI,
`0ltxa4_95njgw.js` = emote/ping/chat protocol constants). The only *emote* plumbing inside this range
is the presence bridge (`boardEmote` / `onBoardEmoteChange` in `pG`/`pV`/`pQ`/`pJ`/`pY`) and its
equality rule `emoteId + emoteAt`; pings are silenced by `pQ`/`pJ` when `silenced` is true.

### 6.6 Board hotkey/mouse-hint gating

`m5`-style occlusion table (§6.4) plus `aQ()` (6627):
`useSyncExternalStore(tc.G, tc.w, () => true)` — one boolean from the preferences store
(`tc` = module 779142, the store that also drives the `data-sim-pointer="mouse"|"touch"` attribute on
`<html>`). In this range it (a) shows the `Preview Size` slider in the settings panel (`u9.A`),
(b) shows the `Space` kbd badge and suppresses the `title` on the turn button (`fX.E`),
(c) forces the `mouse` channel in the input-hints hook `ni(e)` (`l = !e || a || o`,
`o = matchMedia("(any-pointer: fine)")`), (d) is passed to `m4`'s battlefield prompt placement (`E`).

---

## 7. Component inventory (JSX-returning functions/consts in 34 900–48 600)

| name | lines | kind | descriptive name | purpose |
|---|---|---|---|---|
| `ug` | 34906–34930 | memo-ish fn | PresenceStoreCardSync | subscribes a presence store for hovered-card + ping and forwards to `uh` |
| `uv` | 34934–34968 | fn | DragIndicatorTooltip | fixed drop/equip/target label bubble (`translate(-50%,-100%)`) |
| `ux` | 34969–35270 | fn | CardDragGhost | the whole drag ghost: shell, flip animation, attached equipment, indicator tooltips |
| `u8` | 37459–37578 | fn | GameSettingsSizeSample | portal card/preview % sample pinned next to the settings panel |
| `u7` | 37579–37686 | fn | GameSettingsSlider | range input + % output row |
| `u9` | 37687–38070 | fn | GameSettingsControl | trigger button + motion settings panel with 4 sliders |
| `mr` | 38076–38137 | fn | DeckPeekEmptyState | "No cards looked at yet" copy block |
| `md` | 38286–38343 | fn | ActionButtonRow | flat row of tone-styled action buttons (`gb-header-*` labels) |
| `ms` | 38344–38558 | fn | DeckPeekMoreMenu | "More" overflow menu with outside-dismiss + Escape + focus return |
| `mp` | 38576–38579 | fn | SelectionFooterGate | renders selection footer when ids are selected |
| `mh` | 38580–38683 | fn | SelectionFooter | move-selected buttons + selected count + clear |
| `mf` | 38684–38691 | fn | CardSelectionRing | gold selection overlay on a card |
| `mb` | 38692–38732 | fn | TouchCardActions | `gb-off-board-touch-actions` wrapper of `touch-card-action` buttons |
| `mg` | 38733–38808 | fn | CardActionGrid | 2-column tone-gradient card action grid |
| `mv` | 38931–39175 | fn | TrashBanishedPopover | binds a trash/banished pile model to generic pile popover `tp.U` |
| `mx` | 39176–39758 | fn | DeckPeekPanel | my deck-peek popover + trash/banished popovers + opponent deck-peek overlay |
| `m$` | 39865–40279 | fn | OpponentLeftOverlay | `opponent-left-overlay` alertdialog (replay / solo / lobby / leave) |
| `mq` | 40284–40396 | memo fn | BattlefieldMightPanel | per-side battlefield might totals |
| `mU` | 40397–40640 | fn | BattlefieldMight | might totals with `data-battlefield-might-*` attributes |
| `m1` | 40675–40971 | fn | ConquerAssistPrompt | conquer assist prompt UI |
| `m2` | 40972–41415 | fn | ShowdownPrompt | showdown popup (`data-showdown-*`) with optional-player states |
| `m4` | 41416–41746 | fn | BattlefieldPromptPositioner | places conquer/play prompt by occlusion scoring (`m5` costs) |
| `po` | 41615–41746 | memo fn | CardFaceSwitcher | front/back/flip card shell used by board cards |
| `ps` | 41779–43178 | memo fn | Battlefield | battlefield section: two drop roots, board card rails, might, drop previews |
| `pc` | 43179–43259 | fn | MotionPresenceWrap | opacity/scale/y enter-exit wrapper |
| `pm` | 43260–43804 | fn | BattlefieldContainer | maps board state+interaction to `ps` props |
| `pT` | 43924–44080 | fn | OpponentPlayerLayerHost | renders the opponent player layer (`cc`) with flight-store model |
| `pB` | 44081–44112 | fn | BattlefieldWithAnimations | injects `topZoneCardAnimations` then renders `pm` |
| `pO` | 44113–44134 | memo const | ZoneMoveFlightsLayer | renders all in-flight zone-move cards |
| `p$` | 44135–44200 | fn | ZoneMoveFlightCard | 3D-flip flying card (`fixed z-204`, `perspective-[980px]`) |
| `pG` | 44228–44443 | memo const | LocalPresenceSync | renders `null`; pushes hover/presence/ping/emote to the store |
| `pV` | 44375–44481 | memo const | OpponentPresenceSync | `pG` wrapper that drops the playerId arg |
| `pQ` | 44482–44515 | memo const | PlayerPresenceStoreBridge | subscribes own presence incl. silence suppression |
| `pJ` | 44516–44549 | memo const | OpponentPresenceStoreBridge | `pQ` for `opponentId`, feeds `pV` |
| `hu` | 44656–45611 | fn | BoardSidebar | tablet/phone sidebar shell: rail, rail groups, log/chat/sidebar panels, focus trap |
| `hg` | 45639–45998 | memo const | RewindConfirmationDialog | rewind request/approve dialog with countdown bar |
| `hw` | 46012–46341 | memo const | GameTimingBadge | elapsed clock + expandable BO3 per-game timing breakdown |
| `hk` | 46342–46634 | fn | SidebarRoomHeader | turn indicator, turn/room/game line, room-code copy, header tools, room actions |
| `hj` | 46641–46654 | fn | TargetOverlayGate | renders `hI` **only when `aQ()` is false** (not referenced anywhere inside this chunk) |
| `hI` | 46655–46953 | fn | TargetSelectionOverlay | `data-target-selection-overlay` / `game-target-backdrop` spell-target layer |
| `hP` | 46954–46959 | fn | RoundedRect | SVG `<rect rx="16">` helper |
| `hA` | 46963–47247 | memo const | TimelineNavigationRing | orbit/ring + particle burst geometry for the rewind/forward overlay (`{accent, accentGlow, kind, reducedMotion}`) |
| `hM` | 47248–47438 | memo const | TimelineNavigationEmblem | emblem built on `hA`, colours `kind==="rewind" ? "#b8e1ff" : "#9effc9"` |
| `hD` | 47439–47584 | memo const | TimelineNavigationAnimation | portal overlay `data-testid="timeline-navigation-animation"` + `data-burst-token`/`data-kind`/`data-count`/`data-sequence`, `sr-only` `aria-live` status (`sim.timeline.rewoundStatus` / `sim.timeline.restoredStatus`), exit opacity/scale keyframes (rewind `0.38s`, forward `0.3s`, reduced-motion `0.12s`) |
| `fZ` | 48085–48142 | fn | PhaseLabel | "Beginning/Main" + "Phase" two-line label |
| `fX` | 48143–48467 | memo const | TurnControls | end-turn / beginning-phase button, switch-seat, extra-turn badge, cancel, dialog mount |
| `fG` | 48468–48546 | memo const | BoardPhaseStatus | `data-board-phase-status` chip with `PhaseLabel` |
| `f4` | 48589–48600+ | fn | `GameBoard` | board root: takes `{room, me, opponent, presentationMode, allowPerspectiveSwitch, handCardAnnotationsByPlayerId, sidebarSupplementaryPanel, roomActionsOverride, boardCustomizationsByPlayerId, bo3WinsByPlayerId, busy, actionBusy, rewindPending, forwardPending, rewindConfirmationResponsePending, pendingMeaningfulAction, lastAuthoritativeReset, rewindConfirmation, authoritativeResetNotice, controllablePlayers, activePlayerId, viewerRole, privateViewerIdentityKey, broadcastDashboardHref, localPerspectiveHandVisibility, revealPerspectiveHand, onTogglePerspectiveHandReveal, localOpponentHandVisibility, revealOpponentHand, onToggleOpponentHandReveal, onRestrictedCardInspect, …}`; instantiated at 64922 as `{boardLayout, unreadChatCount, room, me, opponent, …}` (continues well past this range) |

Non-JSX helpers worth noting (all in range): `uC/u_/uj/uI` (drag-origin + listener lifetime),
`uN/uR/uA/uM/uD/uE/uT/uz/uB/uL/uO` (drop-intent builders), `uF` (counter roll CSS var),
`uX` (indicator anchor), `uG` (drag-source descriptor), `uV` (**useCardDragAndDrop** — the
~2 000-line engine), `uY` (pending-press lookup), `me/mc/mw/m_/mj/mI/mP/h_/fy/hE/hT/hC/hP` (predicates,
mostly `() => !e` / no-ops / `Date.now`), `ma` (deck-peek auto-collapse predicate),
`ml` (label→i18n map), `mm` (select-all descriptor), `mo/mi` (tone→class), `mu` (is-selected),
`my/mn` (per-card action builders), `mR` (opponent hand redaction), `mC/mk/fj/fI` (selection set
reducers), `m5` (occlusion cost table), `m3/m6/m7/m9/pe/pt/pr/pa/pn` (card-shell constants/animations),
`pi/pl/pd` (card comparators), `pp/pv/px/pw/pk/pC/p_/pj` (zone/card helpers), `pN/pR/pA/pM/pE/pD/pz/pL`
(animation-store helpers), `pq/pU/pZ/pX/pY` (visibility + presence subscription helpers),
`p0/p1/p2/p5/p4/p3` (ping-animation numerics), `hb/hv/hx` (name/clock formatters),
`hm/hp` (backdrop swallow / focusability), `hC/h_/hj` (clock + predicate + gate),
`hR` (rewind direction sign), `hL/hO/h$/hB/hH/hF/hK/hW/hq/hU/hZ/hX/hG/hV/hY/hQ/hJ/h0..h9`
(pure UI-state reducer + selectors), `fe/fr/fa/fn/fo/fi/fl/fd/fs/fu/fm/ff/fb/fg/fv/fC/f_/fj/fI/fP`
(the `f…` predicate/helper band), `fS/fN/fR/fA` (rewind/forward policy resolvers), `f$../fW` (hotkey
descriptor constants), `fU` (turn-button class shell), `fM/fQ/fJ/f1/f5/f0/fY/f2` (board-model consts),
`fq` (debug stub with a `window` reference), `fx`/`fw`/`fk` (keyboard-hint constants),
`fD/fE/fT/fz/fB/fL/fO/fH/fF/fK` (empty module-level caches).

---

## 8. Open questions / risks for the parent

1. **`data-realtime-presence-ring` does not exist** in this bundle. The real attributes are
   `data-compact-realtime-presence-ring` and `data-compact-realtime-activity`
   (349 x). If a spec elsewhere references it, it is wrong.
2. The **full-size identity rail** (`data-player-identity-rail`, identity badge, score tracks, action
   timers) and the **miniature player layer** (`data-miniature-area`) are at 15 470–16 300 and
   29 700–30 100 — outside my range; only the colour system and the presence bridges are here.
3. **All pile rendering / stack maths / pile menus** are at 24 000–24 700 + 25 100–27 800
   (constants quoted in §5.1 for convenience).
4. `deck-peek:*` **action ids** are created at 61 950–62 060; this range only renders them.
5. The **touch long-press drag** is *not* implemented here: everything funnels through the injected
   `pointerDragBridge` (`tryClaimTrustedDragStart` / `getPendingPress` / `registerRuntime`); the
   press-threshold constants therefore live in the module that provides that bridge (not found in
   this chunk). Drag-time constants that *are* here: 90 ms origin pickup, 64 ms origin persist,
   110/130 ms drop debounce, 180 ms chain-drag grace, 220 ms settle clear, 560 ms preview hold.
6. `aQ()`'s exact preference name is unresolved (store module 779142 is external); it controls
   pointer-mode/hints. `data-sim-pointer` is set outside this chunk.
7. `of.*` card-face classes (`of.r/d/z/n/V/N/j`), `tp.U/F/S/L/g`, `dN/dS/dP/eO/dB/dR` behaviour,
   `cZ` (chain panel), `cC/cw/u3/u6` slider bounds are all external — the CSS files
   (`…/chunks/1sj2l8ggay34g.css` etc.) hold `.dragOriginHidden`, `.dragOriginPickup`, `.gb-turn-glass`,
   `.gb-deck-peek*`, `.time-warp-*`, `.tablet-*`, `.phone-*`, `.identityRailTurn*` rules quoted above.
8. `fX`'s `label`/`description` props come from the board root (55 7xx–59 4xx); `data-end-turn-status`
   is written there (63 075), not here.
