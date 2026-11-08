# 02 — Hotkeys, Context Menus, Modes & Menus (Riftbound simulator board)

Sources: `.recon/pretty/playapp/0xawjzm3yjpr1.js` (board chunk, module 430427 — one single module,
65 017 lines), `439rnwycqsxxv.js` (layout math modules), `2atnqtfqvj-z4.js` (setup/mulligan),
`0ltxa4_95njgw.js` (emote/ping/chat protocol).

All keys/payloads below are **verbatim** from the bundle.

---

## 1. Keyboard / pointer hotkey registry

The registry is a static array of descriptors in the board chunk. Two arrays exist:

* `aR` (**press** semantics — `activation: "press"`), `0xawjzm3yjpr1.js:6315`
* `aA` (**hold** semantics — `activation: "hold"`), `0xawjzm3yjpr1.js:6447`
* `aM = [...aR.map(...activation:"press"), ...aA.map(...activation:"hold")]` — the merged list used by
  the help-tour overlay and the `aria-keyshortcuts` attributes.

Descriptor shape:

```js
{ id, description, shortcuts: [{ code?, key?, shift?, ctrl?, meta?, platformModifier?, alt? }],
  enabled: (ctx) => boolean,        // ctx exposes canXxx flags + onXxx callbacks
  run: (ctx) => void,               // press-type only
  setActive: (ctx, active) => void, // hold-type only (mode is armed while held)
  cancel: (ctx) => void,            // optional, called when a held mode is cancelled
  matchesEvent: (e) => boolean,     // optional override (used by label presets)
  allowRepeat, preventDefault }
```

Matching function `aE(e,t,r)` compares `e.key` (case-folded by `aD`, `Spacebar`→`" "`, `A`→`a`),
`e.code`, `altKey`, `ctrlKey`, `metaKey`, `shiftKey`. `platformModifier: !0` resolves to `control`
on Windows/Linux and `meta` on macOS.

### 1.1 Press actions (`aR`)

| id | description (verbatim) | keys | action sent / effect |
|---|---|---|---|
| `showdown_confirm` | `End showdown or conquer the battlefield` | `KeyQ` / `q` | `onShowdownConfirm()` → `battlefield_conquer_confirm` / `attacker_confirm_conquer` |
| `showdown_pass` | `Pass focus in a showdown` | `KeyW` / `w` | `onShowdownPass()` → `pass_focus` |
| `rewind_last_action` | `Rewind the last action` | `Shift+Backspace`, `KeyR`, `r`, `R` | `rewind_last_action` |
| `forward_last_rewind` | `Forward: undo your last Rewind` | `platformModifier(⌘/Ctrl)+Backspace` | `forward_last_rewind` (only while `forwardAvailableUntil > Date.now()`) |
| `end_turn` | `Advance the turn` | `Space` / `" "` | `end_turn` |
| `toggle_perspective` | `Switch controlled perspective` | `Shift+Space`, `Shift+" "`, `KeyV`, `v` | `onTogglePerspective()` |
| `draw_main_deck` | `Draw a card from the main deck` | `KeyD` / `d` | `draw_cards` |
| `duplicate_mode` | `Duplicate a visible card` | `Shift+KeyC` / `Shift+C` | arm duplicate mode → `duplicate_card` |
| `approve_chain` | `Approve the top effect on the chain` | `KeyA` / `a` | `chain_resolve` (approve) |
| `resolve_chain` | `Resolve the top effect on the chain` | `KeyS` / `s` | `chain_resolve` |
| `label_preset_${id}` | ``Choose ${label}, then click a card`` | `Key<T>`/`<t>` per preset hotkey from module `ts` | `onSelectCardLabel(label)` → `set_card_label` |
| `label_custom` | `Choose a custom tag, then click a card` | `KeyY`? (`ts.s`, resolved at runtime) | `onSelectCustomCardLabel()` |

Label presets come from module `784635` (`25vik2nxxo51i.js:646-745`). The **complete preset table**
(verbatim: `id`, `hotkey`, `label`, `accentColor`, `backgroundColor`, `borderColor`, `textColor`):

| hotkey | id | label | accent | background | border | text |
|---|---|---|---|---|---|---|
| `1` | `buff` | Buff | `#ffdf91` | `#a26320` | `#ffe2a0` | `#fff8e8` |
| `2` | `disarm` | Disarm | `#f7ba91` | `rgba(83,47,31,0.96)` | `rgba(239,167,114,0.7)` | `#fff0de` |
| `3` | `deflect` | Deflect | `#9fd4ff` | `rgba(38,59,82,0.94)` | `rgba(128,170,208,0.54)` | `#e7f3ff` |
| `4` | `deathknell` | Deathknell | `#9fd7d3` | `rgba(39,62,62,0.94)` | `rgba(132,183,178,0.5)` | `#e8f7f5` |
| `5` | `shield` | Shield | `#d4c1ff` | `rgba(58,53,82,0.94)` | `rgba(168,152,214,0.5)` | `#f0ebff` |
| `6` | `stunned` | Stunned | `#ffe56f` | `rgba(98,86,18,0.95)` | `rgba(239,218,92,0.58)` | `#fff9d4` |
| `7` | `tank` | Tank | `#b4c7df` | `rgba(48,58,74,0.95)` | `rgba(164,182,207,0.54)` | `#edf5ff` |
| `8` | `empowered` | Empowered | `#f6c96f` | `rgba(82,62,34,0.95)` | `rgba(218,171,96,0.54)` | `#fff2d8` |
| `9` | `ganking` | Ganking | `#9fe0a6` | `rgba(42,67,48,0.94)` | `rgba(128,181,134,0.5)` | `#e7f8e9` |
| `0` | `assault` | Assault | `#ff8fa3` | `rgba(86,38,49,0.94)` | `rgba(213,120,138,0.52)` | `#ffe8ee` |
| `-` | `temporary` | Temporary | `#ff9b7a` | `rgba(95,46,39,0.95)` | `rgba(229,129,108,0.54)` | `#ffe9e1` |

`=` (`ts.s` = `"Equal"`) is the **custom tag** hotkey (`label_custom`). Hotkey → code mapping is
`d(e) = e === "-" ? "Minus" : e === "=" ? "Equal" : \`Digit${e}\``; the matcher `aT(e, hotkey)`
additionally rejects Alt/Ctrl/Meta. Chip colouring at render time uses
`f(label)` → the preset colours above, falling back to `{accentColor:"#7fd8ff",
backgroundColor:"rgba(28,58,78,0.95)", borderColor:"rgba(116,197,227,0.56)", textColor:"#e5f8ff"}`.
Label chip text uses `sim.<id>` keys (`sim.buffBadge` for `buff`, `current.empowered`,
`current.assault`). The wheel prompt width is
`` clamp(min(50vw,192px), ${left}px, max(calc(100vw - 192px), 50vw)) ``.
The label wheel is `ts.I` (module `784635`), driven by `label_mode` (hold `L`).

### 1.2 Hold actions / armed modes (`aA`)

| id | description (verbatim) | keys | mode flag / callback |
|---|---|---|---|
| `counter_add_mode` | `Add counters on board cards` | `KeyC` / `c` | `canCounterAddMode`, `onCounterAddModeChange` |
| `buff_mode` | `Buff units on board` | `KeyB` / `b` | `canBuffMode`, `onBuffModeChange` |
| `target_mode` | `Target from the top chain effect` | `KeyT` / `t` | `canTargetMode`, `onTargetModeChange` |
| `label_mode` | `Open the tag wheel` | `KeyL` / `l` | `canLabelMode`, `onLabelModeChange` |
| `emote_mode` | `Open the emote wheel` | `KeyE` / `e` | `canEmoteMode`, `onEmoteModeChange` |
| `dice_mode` | `Choose a die and roll it` | `Shift+KeyR` / `Shift+r` | `canDiceMode`, `onDiceModeChange`, `cancel: onDiceModeCancel` |
| `ping_mode` | `Ping your own cards for the opponent` | `KeyP` / `p` | `canPingMode`, `onPingModeChange` |

### 1.3 Context / pointer gestures (`aJ` array — shown in the help tour)

| id | description (verbatim) | gesture |
|---|---|---|
| `context_actions` | `context_actions` *(i18n key placeholder)* | `Right Click` — open the card action menu |
| `context_banish` | `Banish from hand, base, battlefield, or chain spell` | `Ctrl+Right Click`, `⌘+Right Click` |
| `context_burn_main_deck` | `Burn the top card of your main deck` | `Ctrl+Right Click`, `⌘+Right Click` on the main deck |
| `context_channel_rune_deck` | `context_channel_rune_deck` | `Ctrl+Left Click` / `⌘+Left Click` on the rune deck |
| `context_chain_add` | `Add a card or battlefield marker effect to the Chain` | `Shift+Left Click` |
| `context_card_click` | `Play from hand, or exhaust / ready on the board` | `Left Click` |
| `context_card_trash` | `Send a card to the trash` | `Right Click` |
| `context_rune_deck_look` | `Look at the top rune` | `Right Click` on the rune deck |
| `context_rune_recycle` | `Recycle a rune to the bottom of your rune deck` | `Right Click` on a rune |
| `context_chain_resolve_trash` | `Resolve the top chain card to the trash` | `Right Click` on the chain |
| `context_counter_add` | `Click a counter to add one` | `Left Click` |
| `context_counter_remove` | `Right-click a counter to remove one` | `Right Click` |
| `context_counter_scroll` | `Scroll over a counter to add or remove` | `Scroll` (wheel) |
| `context_marker_ping` | `Click a battlefield marker to ping it` | `Left Click` |
| `cancel_mode` | `Cancel the active mode` | `Escape` |

### 1.4 Modifier gestures while dragging (`a0`)

| id | description (verbatim) | modifier |
|---|---|---|
| `drop_deck_top` | `While dropping on your deck: put it on top` | `Shift` (default drop = bottom) |
| `drop_trash_banish` | `While dropping on the trash: banish instead` | `Shift` (default drop = trash) |

### 1.5 Global keyboard plumbing

* `aX(listener)` registers a global `keydown` capture listener on `window` with a shared
  "already-handled" latch (`aq`); it skips `e.isComposing` and any event whose target is
  `input, textarea, select` or `isContentEditable`.
* `aF(el)` = "element has `data-card-id`"; `aH(el)` / `a$(el)` classify interactive vs.
  text-entry elements (tag blacklists + ARIA `role` sets `aI`, `aS`, `aN`).
* `a1(shortcut)` renders a shortcut as text (`Ctrl + Shift + A`), `a5()` renders the chip row
  (mouse buttons as SVG, `Scroll` glyph, `Esc`, `Backspace`, `Space`, `Shift⇧`).
* Escape also closes: settings panel, de-card-selection, overlays (`0xawjzm3yjpr1.js:7687, 8928, 3432`).
* `Tab` is trapped inside dialogs (`7691`, `8915`) and inside the settings popover
  (`3432`), which also handles `Escape` → close + return focus.

### 1.6 Keyboard delivered by other overlay components

* **Game settings panel** (`u9`, `0xawjzm3yjpr1.js:37687`): `Escape` closes; a `pointerdown`
  capture listener closes on outside click. Two sliders (`u7`) are `input[type=range]` with
  `min/max/step` from module constants (`cw.G/cw.w/cw.L` for card size, `cC.R/cC.s/cC.x`
  for preview size, `u6.j/u6.p/u6.T` for cosmetics intensity, `u3.C/u3.D/u3.n` for SFX volume)
  — arrow keys adjust natively.
* **Chat composer** (`data-testid="chat-composer-input"`): `Enter` sends, `Escape` cancels;
  `onKeyDown` at `0xawjzm3yjpr1.js:13871` (`ey`).
* **Judge chat**: `Escape` at `14049`; `ArrowUp/ArrowDown/ArrowLeft/ArrowRight` at `14055`.
* **Deck peek**: `Enter`/`Space` activate at `3428`; `Escape` closes (`3432`).
* **Chain entry rows**: `Enter`/`Space` activate at `15078-15080`.

---

## 2. Context menus

All in-game context menus are built from an item list of the shape

```js
{ id, label, disabled, run: (event) => ..., requiresControlRecipient?, requiresTargetRecipient? }
```

and rendered by a shared menu primitive (`eB(id)` = a hotkey-derived item, `eL(id, gesture, description)`
= an item with a gesture chip, `e$(zoneItems, extras)` = merge). The board root installs
`onContextMenuCapture` (`0xawjzm3yjpr1.js:63178`) which **cancels the browser menu** everywhere except
inside `[data-chat-panel-root="true"]`, and `Shift+RightClick` is passed through untouched
(`if (e.shiftKey) return void e.stopPropagation();`).

### 2.1 Card context menu — board cards (`0xawjzm3yjpr1.js:19690-19900`)

Ordered list; each row is emitted only when its predicate holds.

| order | id | label (i18n key) | enabled when | action |
|---|---|---|---|---|
| 1 | `ping` | `sim.compactPing` | always | ping/emote on the card (`onRealtimeCardPing`) |
| 2 | `recycle` | `sim.tablet.recycle` | `zone === "runeArea"` | `send_rune_to_deck_bottom` |
| 3 | `tap` | `sim.tablet.play` | zone is base/champion/legend or a battlefield | play / exhaust-ready |
| 4 | `play-hidden` | `sim.tablet.hidden` | `zone === "champion"` and a hidden-play handler exists | play face-down |
| 5 | `chain` | `sim.tablet.addToChain` | `isChainAddable(zone, card)` | `chain_add` |
| 6 | `give-control` | `sim.tablet.giveControl` | `isControllable(zone)` && `!card.hidden` | open control-recipient picker (`requiresControlRecipient`) |
| 7 | `trash` | `sim.tablet.trash` | zone ∈ hand/base/battlefield\*/champion | `move_card` → `trash` |
| 8 | `banish` | `sim.tablet.banish` | same, `zone !== "champion"` | `move_card` → `banished` (equivalent to Ctrl/⌘+RightClick) |
| 9 | `target` | `sim.tablet.target` | targeting available | start a target arrow from this card |
| 10 | `clear-targets` | `sim.tablet.removeTargets` | card has target arrows | `target_arrow_remove` for all |
| 11 | `equip` | `sim.tablet.equip` | card is equippable onto a unit | `equip_card` |
| 12 | `animate-gear` | `sim.oriannaAnimateGear` | Orianna animate-gear available | `animate_gear` |
| 13 | `choose-neeko-legend` | *(dynamic label = Neeko legend name)* | Neeko copy available | `choose_neeko_legend` |
| 14 | `empower` / `disempower` | `sim.tablet.empower` / `sim.tablet.disempower` | card can be empowered | `adjust_card_might` |
| 15 | `reveal` | `sim.tablet.reveal` | reveal-to-opponent allowed | `set_card_revealed_to_opponent` |
| 16 | `remove-buff` | `sim.removeBuff` | card has a temporary might buff | `adjust_card_might` (remove 1) |

Additional ids referenced by the same builder: `restricted-inspection`
(`{id:"restricted-inspection", label: e.reason, run: e.onInspect}`, `0xawjzm3yjpr1.js:1214`).

### 2.2 Hand-card menu (tablet/compact path, `0xawjzm3yjpr1.js:28330-28440`)

| order | id | label (i18n key) | predicate |
|---|---|---|---|
| 1 | `play` | `sim.tablet.play` | playable from hand |
| 2 | `play-hidden` | `sim.tablet.hidden` | hidden play available |
| 3 | `chain` | `sim.tablet.addToChain` | `de("hand", card)` |
| 4 | `trash` | `sim.tablet.trash` | always (when trash handler present) |
| 5 | `banish` | `sim.tablet.banish` | always (runs trash with `{ctrlKey:true, metaKey:true}`) |
| 6 | `reveal` | `sim.hideFromOpponent` / `sim.revealToOpponent` | reveal toggle allowed |
| 7 | `auto-pay` | `current.autoPayCardCost` | auto-pay available for this card |

Hand card *hover* controls also use `sim.autoPay` (`0xawjzm3yjpr1.js:28590`) and `sim.compactPing`
(`28661`, `28757`).

### 2.3 Pile menus (`0xawjzm3yjpr1.js:24500-24600`, `7487-7560`)

**Main deck** (`mainDeck`) — section title `sim.mainDeck`:

| id | label | run |
|---|---|---|
| `press` | dynamic: `sim.look` \| `sim.board.channelExhausted` \| `sim.drawShortcut` | primary click |
| `look` | `sim.look` | look at top card (`look_main_deck`) |
| `burn` | `sim.toTrash` | burn top card (`Ctrl/⌘ + click`) |
| `draw_main_deck` | `draw_main_deck` (gesture `nk`) | `draw_cards` |
| `look_main_deck` | `sim.helpTour.lookAtTop` (gesture `nC`) | peek |
| `context_burn_main_deck` | `context_burn_main_deck` gesture item | burn |

**Rune deck** (`runeDeck`) — section title `sim.runeDeck`:

| id | label | run |
|---|---|---|
| `channel_rune_deck` | gesture `nk`, description `sim.board.channelExhausted` | `channel_rune_deck` |
| `context_channel_rune_deck` | gesture item | `channel_rune_deck` |
| `context_rune_deck_look` | gesture item | look at top rune |
| `ready` | `sim.channelReady` | `channel_ready` (`Ctrl+Left Click`) |

**Hand zone** — section title `sim.hand` (or `sim.helpTour.cards` during the tour):

| id | label |
|---|---|
| `context_card_click` | play / exhaust-ready |
| `context_card_trash` | send to trash |
| `context_chain_add` | add to chain |
| `context_banish` | banish from hand |

**Runes zone** (`runeArea`) — section title `sim.runes`: `context_rune_recycle`.

### 2.4 Player (identity) menu

Rendered from `um` (compact opponent board) / identity rail. Trigger attrs:
`data-compact-player-menu-trigger`, items `data-compact-player-menu-report`, `data-compact-player-menu-silence`,
indicator `data-compact-player-muted-indicator`. One label confirmed: `sim.playerMenu.reportPlayer`
(player report dialog → `onSubmitPlayerReport`). Mute/unmute uses `onToggleMutedPlayer` and is
reflected by `data-player-muted` + `data-has-silence-action` on the identity badge.

### 2.5 Turn / rewind / board-action sections (from the help-tour registry, same ids)

* **turn**: `end_turn`, `toggle_perspective`
* **rewind** (anchor `[data-help-anchor="rewind"]`, title `sim.rewindLabel`): `rewind_last_action`, `forward_last_rewind`
* **boardActions** (spotlight `boardControls`, title `sim.actions`): `counter_add_mode`, `buff_mode`,
  `duplicate_mode`, `label_mode`, `emote_mode`, `dice_mode`, `cancel_mode`
* **boardToggles** (title `sim.toggles`): live list of `[data-board-toggle]` elements
* **chain** (title `sim.chain`): `approve_chain`, `resolve_chain`, `context_chain_resolve_trash`,
  `target_mode`, … (anchor selectors `[data-chain-art-timeline]:has([data-chain-timeline-entry-id])`
  and `.tablet-chain-panel:not([hidden]):has([data-chain-preview-trigger])`)

### 2.6 Deck-peek menu actions (`0xawjzm3yjpr1.js:48589+` region, ids verbatim)

`deck-peek:look-bottom`, `deck-peek:look-more`, `deck-peek:recycle-all`, `deck-peek:shuffle-deck`,
`deck-peek:shuffle-unrecycled`.

---

## 3. Modes, prompts & dialogs (state machine summary)

| surface | trigger | confirm / dismiss actions |
|---|---|---|
| Showdown / conquer | `showdown` state | `battlefield_conquer_confirm`, `attacker_confirm_conquer`, `battlefield_conquer_dismiss`, `pass_focus`, `pass_response`, `battlefield_conquer_pass_focus`, `battlefield_conquer_pass_response` |
| Chain | `chain` entries | `chain_add`, `chain_resolve`, `set_chain_repeat`, `set_chain_flow`, `set_resolve_vote` |
| Rewind | `rewindPending` / `rewindConfirmation` | `respond_rewind_confirmation`, `rewind_last_action`, `forward_last_rewind` |
| Auto-pay | auto-pay button or `current.autoPayCardCost` | auto-pay mutation (`payload.actionType === "auto_pay_button"`) |
| Armed modes | hold keys / `boardActions` menu | `set_armed_action` |
| Hidden cards | `set_card_hidden` | `data-play-hidden-selecting` on the battlefield surface marks eligible zones |
| Card labels | `label_mode` + click | `set_card_label` |
| Counters | `counter_add_mode` + click/scroll | `adjust_card_counter`, `clear_card_counter` |
| Might / buffs | `buff_mode` | `adjust_card_might` |
| Give control | `give-control` menu item | control-recipient picker → transfer-control action |
| Emotes / pings | `emote_mode`, `ping_mode`, `context_marker_ping` | `onRealtimeBoardEmote`, `onRealtimeCardPing` |

---

## 4. Emote wheel (hold `E`)

Component `tn` (`0xawjzm3yjpr1.js:1671`). Layout (verbatim):

```jsx
<div ref={f} className="fixed z-180 pointer-events-none" style={{ ...style, width: 164, height: 164 }}>
```

Decor ticks:
```
absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(26,40,65,0.42)_0%,rgba(10,16,28,0.24)_52%,rgba(6,10,18,0)_78%)]
absolute left-1/2 top-1/2 h-[1.65rem] w-[1.65rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(208,222,248,0.12)] bg-[rgba(13,20,34,0.26)] shadow-[0_0_18px_rgba(7,14,28,0.16)]
absolute left-1/2 top-1/2 h-[0.3rem] w-[0.3rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(224,235,252,0.5)]
absolute inset-[0.52rem] rounded-full border border-[rgba(214,226,247,0.08)]
pointer-events-none absolute inset-0 rounded-full shadow-[0_12px_28px_rgba(2,6,18,0.22)]
```

Each emote button (6 slots, `(60*i − 90)` degrees):

```js
let o = ((60 * t - 90) * Math.PI) / 180,
    i = 82 + 52 * Math.cos(o),
    l = 82 + 52 * Math.sin(o);
// className: "group absolute pointer-events-auto"
// style: { left: i, top: l, width: 46, height: 46, transform: "translate(-50%, -50%)" }
```

Hover/selected animation (framer-motion `b.f.span`, class
`absolute inset-0 flex items-center justify-center rounded-full border backdrop-blur-[2px]`):

```js
animate: { scale: d ? 1.08 : 1,
  borderColor: d ? "rgba(248,252,255,0.52)" : "rgba(190,208,239,0)",
  background: d ? "linear-gradient(180deg,rgba(31,44,66,0.88),rgba(18,27,42,0.9))"
               : "linear-gradient(180deg,rgba(31,44,66,0),rgba(18,27,42,0))",
  boxShadow: d ? `0 0 20px ${r.accentColor}52,0 10px 20px rgba(3,8,20,0.24)` : "0 0 0 rgba(0,0,0,0)" },
transition: { duration: 0.14, ease: "easeOut" }
```

The glyph is `tt.f` = an animated emote sprite (`{ id, animated }`), font-size `28px`.
The wheel list comes from `e6.z(emoteWheelCustomization)` (customizable wheel), `aria-live`
announcement from `sim.emoteWheel`.

**Complete emote catalogue** (module `593673`, `3-2i4k6s343ud.js:3215-3300`) — each entry is
`{ id, releasedAt, label, glyph, accentColor, labelKey }`:

| id | label | glyph | accent | i18n |
|---|---|---|---|---|
| `thumbs_up` | Thumbs Up | 👍 | `#f3cf7a` | `emoteThumbsUp` |
| `heart` | Heart | ❤️ | `#ff8aa0` | `emoteHeart` |
| `laugh` | Laugh | 😂 | `#ffd36d` | `emoteLaugh` |
| `wow` | No | ❌ | `#ff9a9a` | `emoteNo` |
| `cry` | Wait | ⏳ | `#d6c08c` | `emoteWait` |
| `angry` | Angry | 😠 | `#ff9a7a` | `emoteAngry` |
| `wave` | Hello | 👋 | `#f3cf7a` | `emoteWave` |
| `clap` | Well played | 👏 | `#ffd36d` | `emoteClap` |
| `thinking` | Thinking | 🤔 | `#d6c08c` | `emoteThinking` |
| `surprised` | Surprised | 😮 | `#ffe09a` | `emoteSurprised` |
| `sad` | Sad | 😢 | `#8acbff` | `emoteSad` |
| `party` | Celebrate | 🎉 | `#c5a3ff` | `emoteParty` |
| `sob` | Sobbing | 😭 | `#8acbff` | `emoteSob` |
| `skull` | Skull | 💀 | `#d7e6ed` | `emoteSkull` |
| `scream` | Scream | 😱 | `#a8d7ff` | `emoteScream` |
| `good_luck` | Good luck | 🍀 | `#9de3a6` | `emoteGoodLuck` |
| `thanks` | Thanks | 🙏 | `#f3cf7a` | `emoteThanks` |
| `good_game` | Good game | 🤝 | `#9ed8ee` | `emoteGoodGame` |

**Poro pack** (`e6.P`, `n` array; unlocked set `e6.I`): `poro_wave` "Poro Hello" 👋 `#8de0dc`,
`poro_heart` "Poro Love" ❤️ `#ff91b4`, `poro_laugh` "Poro Laugh" 😂 `#ffd580`,
`poro_thinking` "Poro Thinking" 🤔 `#c7b0ff`, `poro_sad` "Poro Sad" 😢 `#8ecfff`,
`poro_party` "Poro Celebrate" 🎉 `#ffe299`.

**Defaults** (`e6.z(wheel)`): if the customization is missing/invalid the wheel falls back to
`["thumbs_up","heart","laugh","wow","cry","angry"]` (`l`). Validation `e6.X(c)` requires an array of
**exactly 6 unique** valid ids; `e6.q(wheel, index, id)` performs the swap when a slot is changed.
`releasedAt` (`"2026-09-18T00:00:00+02:00"` for `good_luck`/`thanks`/`good_game`) gates availability.
Emotes are **silent** (no SFX entry). Poro emotes are **Rive** artboards from
`/cosmetics/poro/pals.riv` (state machine `"Reaction"`; playback 3200 ms for the poro pack vs
1080 ms for the emoji set).

**Presence / ping / chat transport** (module `0ltxa4_95njgw.js`): presence event kinds
`hover_state | card_ping | board_emote | chat_typing | player_offline`; **ping intents**
`general | trigger_ability | discard_target` with a **2400 ms** TTL (dedupe key
`cardId + pingedAt + intent`); chat kinds with `chat_send | chat_sync | chat_append`.
Sounds: `ping` → `ping-v2.webm` (volume 0.08), `chat_message` → `chat_message.webm`
(`rate 0.6`, volume 0.1); **no emote sound**.

---

## 5. Timer / clock surfaces

* `actionClockSnapshot`, `actionClockMsByPlayerId` props of `GameBoardView`; rendered as
  `data-bo3-timer-game`, `data-bo3-timer-elapsed`, `data-bo3-timer-player`, `data-bo3-timer-tone`,
  `data-bo3-timer-player-name` (BO3 match clock rows, sidebar header).
* Turn controls live at `data-board-turn-controls`, `data-board-phase-status`,
  `data-end-turn-status`, `data-next-game-status`, `data-extra-turns-pending`.

---

## 6. Settings / toggles panel

`u9` (`0xawjzm3yjpr1.js:37687`) = popover panel, sections:

| section (i18n key) | control | key |
|---|---|---|
| `current.display` | slider `current.cardSize` → `sim.cardSizePercentage` | `cw.*` |
| `current.display` | slider `current.previewSize` → `sim.previewSizePercentage` | `cC.*` (desktop only) |
| `current.opponentCosmetics` | slider `current.intensity` → `sim.opponentCosmeticsPercentage` | `u6.*` |
| `current.audio` | slider `current.soundEffects` → `sim.soundEffectsVolumePercentage` | `u3.*` |

Board toggles (`data-board-toggle` panels, `0xawjzm3yjpr1.js:23620`) render one row per enabled
toggle: button class `group/action relative inline-flex h-[2.22rem] w-full shrink-0 items-center
justify-start whitespace-nowrap px-[0.68rem] text-(length:--board-action-font-size) font-semibold
leading-none uppercase tracking-[0.055em] text-[#d8e6f6] …`, `aria-pressed={enabled}`,
`data-board-toggle={key}`, `data-board-toggle-label={label}`. The **exact five toggle keys**
(`0xawjzm3yjpr1.js:22817-22848`) are:

| key | label | action |
|---|---|---|
| `stop-at-beginning` | `sim.stopAtBeginningPhase` | `set_stop_at_beginning_phase` |
| `skip-draw-phase` | `current.skipDrawPhase` | `set_skip_draw_phase` |
| `auto-score-from-hold` | `sim.autoScoreFromHold` | `set_auto_score_from_hold` |
| `xp-counter` | `sim.xpCounter` | `set_show_legend_xp_counter` |
| `battlefield-might` | `sim.battlefieldMight.toggleLabel` | `set_battlefield_might_visible` |

Each toggle row's label may wrap onto multiple lines (`lines: [...]` → `h-[2.68rem] py-[0.26rem]`
and `inline-flex flex-col items-start justify-center leading-[0.98]` when `lines.length > 1`).

Panel class string (verbatim):

```
fixed z-170 m-0 flex w-max max-w-[calc(100vw-1rem)] items-center justify-center overflow-hidden rounded-[0.18rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_12px_24px_rgba(3,8,18,0.28)] backdrop-blur-xl backdrop-saturate-150 transition-[max-height,opacity,border-color,background-color,transform] duration-160 ease-[cubic-bezier(0.2,0.7,0.2,1)]
```
open state: `max-h-52 translate-y-0 border-[rgba(174,199,227,0.26)] bg-[rgba(11,20,35,0.82)] opacity-100 pointer-events-auto`
closed state: `max-h-0 translate-y-[0.18rem] border-transparent bg-transparent opacity-0 pointer-events-none`

---

## 7. Action-type strings emitted by the board UI (verbatim, subset observed in this chunk)

`move_card`, `move_cards_to_trash_batch`, `create_token`, `equip_card`, `adjust_might`,
`adjust_score`, `score_conquer`, `end_turn`, `end_beginning_phase`, `card_draw`, `card_play`,
`card_discard`, `card_recycle`, `chain_add`, `chain_resolve`, `set_chain_flow`, `set_chain_repeat`,
`set_resolve_vote`, `pass_focus`, `defender_response`, `attacker_confirm_conquer`,
`battlefield_conquer_confirm|dismiss|pass_focus|pass_response`, `set_card_hidden`,
`set_card_label`, `set_card_revealed_to_opponent`, `set_armed_action`, `adjust_card_counter`,
`clear_card_counter`, `adjust_card_might`, `send_rune_to_deck_bottom`,
`recycle_rune_for_floating_energy`, `channel_rune_deck`, `draw_rune`, `rewind_last_action`,
`forward_last_rewind`, `respond_rewind_confirmation`, `set_show_legend_xp_counter`,
`set_battlefield_might_visible`, `set_stop_at_beginning_phase`, `set_skip_draw_phase`,
`set_auto_score_from_hold`, `set_hand_reveal`, `auto_pay_button`, `submit_mulligan`,
`roll_initiative`, `roll_die`, `choose_first_player`, `select_battlefield`, `submit_deck`,
`submit_sealed_draft`, `submit_sideboard`, `chat`, `target_arrow_remove`.
