# Integration domain (`R2-int`)

Owner: **R2-int** — sync redaction, realtime routing, apps/play strict UI and i18n reason
strings. Privacy rules: 128 (Secret / Private / Public), 107.3.f (facedown cards are private),
108.1.b (the Chain is public), 108/109 (zones), 422.4 / 811 (Hidden), 425 / 437 (look, predict).

## Files

| File | Rules | Contents |
|---|---|---|
| `packages/sync/src/redact-rules.ts` | 128.4, 107.3.f, 108.1.b, 811, 422.4, 425, 437 | `redactRulesForViewer`: per-viewer copy of `Room.rules` |
| `packages/sync/src/redact.ts` | 128.4 | collects the private-card → placeholder map while redacting boards, calls `redactRulesForViewer`; redacts another seat's mulligan playback ids |
| `packages/sync/src/diff.ts` | 128.4 | `diffRuntimeStateForViewer`: redact both sides, then diff |
| `packages/sync/src/messages.ts` | §5 | `error` frames may carry `rule` / `detail` (validated as strings) |
| `apps/realtime/src/core/MatchRoomCore.ts` | §3–§5 | `set_lobby_rules_mode` shell action, `rulesMode` on seed/session/room, rejection `rule`/`detail` forwarding |
| `apps/realtime/src/fallback-engine.ts` | — | the dev fallback rejects strict actions (`strict_rules_unavailable`) |
| `packages/engine/src/engine.ts`, `types.ts` | §5 | `EngineFailure.rule?` / `detail?` from the Verdict |
| `packages/rules/src/intents/concede.ts`, `legality/concede.ts`, `legality/wire/concede.ts` | 649–652 | `rules_concede` handler, verdict (651.3) and wire validator |
| `packages/i18n/src/rules-text.ts`, `data/i18n-en.json` (`ui.rules`) | §5, 411.2 | reason / prompt / UI strings and the `rulesReasonText` / `promptReasonText` / `promptTitle` helpers |
| `packages/engine/src/strict/view.ts` | 312, §5 | client read side bound to the engine host: `strictLegalIntents`, `strictWhoMayAct`, `strictTurnState`, `strictExplainIllegal` |
| `apps/play/src/components/board/strict/*` | 411.2, 467.2.c, §6.4, 650 | `StrictRulesPanel` (dev-only), `StrictPromptHost`, `StrictPromptDialog`, pure `strict-model.ts` / `strict-interaction.ts` |
| `apps/play/src/components/board/interaction/BoardInteractionProvider.tsx`, `drag/*`, `card/GameCard.tsx` | 355.2, 355.9, 449, 811.1.b | gesture-only strict board: drag/use/drop gestures, prompt clicks, targeting highlight, rejection toast |
| `apps/play/src/components/room/RoomShell.tsx` (`RulesModeFieldset`), `lobby/integration/roomMapping.ts`, `lobby/LobbyContainer.tsx` | §3 | host-only lobby toggle |
| `apps/play/src/runtime/matchRuntime.ts`, `components/game/GameScreen.tsx` | §5 | `RulesRejectionError` (code/rule/detail) shown through `rulesReasonText`; the turn button sends `rules_end_turn` in strict rooms |

Tests: `packages/sync/src/redact-rules.test.ts` (every case below, spectators, solo, patches),
`packages/sync/src/redact.test.ts` (mulligan playback), `packages/sync/src/messages.test.ts`
(error frame fields), `apps/realtime/tests/match-room.test.ts` (`MatchRoomCore strict rooms`),
`packages/rules/test/rules/int/concede-intent.test.ts`,
`packages/i18n/src/rules-text.test.ts`, `packages/engine/test/strict-int.test.ts` (read view),
`apps/play/src/components/board/strict/__tests__/*` (including `strict-interaction.test.ts`),
`apps/play/src/runtime/__tests__/rules-rejection.test.mts`.

## Redaction (sync)

Card ids encode the card (`setup-<owner>-<source>-<index>-<slug>`, `packages/engine/src/state/init.ts`),
so a private card's id is as revealing as its face. The board redaction already replaces every
card the viewer may not see with `__hidden_zone__:<player>:<zone>:<index>`. While doing so it now
records *private id → placeholder id* (also for hidden chain entries), and `Room.rules` is
rewritten with the same map, so every reference in the rules state points at the card the
viewer's board shows.

"Owned" seats = the viewer's own seat + `controlledPlayerIds` (solo) + `grantedPrivatePlayerIds`
(spectator grants), exactly the seats whose boards the viewer sees in full.

### Privacy matrix

| `rules.*` field | prompted / owning seat (and controllers, granted spectators) | other players and plain spectators |
|---|---|---|
| `prompt` | full prompt; inside `data.continuation` only the ids the prompt offers survive, other private ids become placeholders | shell only: `id`, `kind`, `playerId`, `promptKey`, `rule`, `sourceItemId`, `data.reason` (no `options`, `min`/`max`, other `data`) |
| `chain[i]` (public, 108.1.b) | full | full |
| `chain[i]` with `cardSnapshot.hidden` not revealed (811 / 422.4) | full (controller) | `id`, `kind`, `status`, `controller`, `origin`, `fromZone`, `addedAt`, `playedFromFacedown`, `choices: {}`, `cardSnapshot` = the `chainEntries` placeholder; no `cardName`/`cardCode`/`paid`/`process`/… |
| `objects[id]` of a facedown card (107.3.f) or a card in a private zone | kept | dropped |
| `history.promptAnswers` | own answers only | own answers only (spectators: none) |
| `triggers[i].event` / `chain[i].triggerEvent` about a private card | full | ids → placeholders, `cardName` dropped; a private trigger source loses `sourceName` |
| any other string that is / contains a private card id (`history.effects.marks`, `activationsThisTurn` / `limits` keys, `tasks[].data`, `effects[].modifier`, …) | unchanged | rewritten to the placeholder id |
| `turn`, `priority`, `focus`, `passes`, `showdown`, `combat`, `contested`, `staged`, `pools`, `scoredThisTurn`, `manual`, `effects` | public | public (ids scrubbed as above) |

The redacted value is a `RulesState` (type-checked in the tests). Sandbox rooms (no `rules`) are
unchanged byte for byte.

### Patches

`apps/realtime` diffs the *redacted* previous and next states per viewer (unchanged), and the new
`diffRuntimeStateForViewer` packages that rule for other callers. `Room.rules` is one room field,
so a change re-sends the viewer's redacted rules object; a diff therefore never carries a value
the snapshot hides. Tests: prompt open/close patches for Alice / a spectator contain no private
id or card name and apply to exactly the redacted next state; the realtime test checks every patch
frame Bob receives through setup and a strict turn.

### Mulligan playback (pre-existing leak, fixed)

`Room.mulliganPlaybackByPlayerId[seat].draws[].cardId` (and `hiddenRefillCardIds`) went to every
viewer, revealing opening hands and refills (the ids encode the card). The strict end-to-end test
found it; the same setup path runs in sandbox rooms. Another seat's private ids are now rewritten
to placeholders. The client only reads `redrawCount` for opponents, so rendering is unchanged.

## Realtime routing

- `set_lobby_rules_mode { mode }` is a **room-shell** action (`RoomShellAction` already lists it):
  host only (seat 0, `room_access_denied`), lobby only (`invalid_phase`), validated by the
  engine's own handler (`invalid_rules_mode`). The accepted mode is mirrored on the seed, on
  `RoomSessionDoc.rulesMode` (so lobby clients can render the toggle) and on the lobby room.
  `initializeGame` copies it onto the room created at match start; linked next-game rooms keep it.
- `rules_*` intents (including `rules_concede`) keep travelling as `action_intent` to the engine.
  They are server-authoritative; `OPTIMISTIC_ACTIONS` is unchanged.
- Rejections: the `error` frame's `code` is the ReasonCode and the frame now also carries `rule`
  and `detail` (sender only, `mutationClass: "reject_invalid"`).
- Strict multiplayer rooms reject `rewind_last_action` / `forward_last_rewind` /
  `respond_rewind_confirmation` with `strict_mode_action` (engine behaviour; tested end to end).
- The development fallback engine has no strict layer and rejects strict actions with
  `strict_rules_unavailable`.

## Concede (649–652)

The protocol has no sandbox concede/surrender *gameplay* action (`abandon_match` is a room HTTP
API action handled by realtime). `rules_concede` is a new `rules_*` intent: no payload (shape
rule 650), no Priority/Focus/prompt/timing check (650: at any time), `concedeVerdict` rejects a
player already removed (651.3, `illegal_action`), and the handler only calls the existing
`concede` (651.1 / 195 / 491.6.a win, otherwise 651.2 / 652 removal). `explainIllegal` uses the
same verdict.

## i18n

`ui.rules` in `packages/i18n/data/i18n-en.json`: `reason.<ReasonCode>` (+ `unknown`),
`promptReason.<reason>` (dotted reasons nest: `combat.damage_assignment`), `promptKind.<kind>`,
`prompt.<promptKey>` (every `rules.prompt.*` the engine emits, incl. `cost.<category>`) and
`ui.<label>`. `promptTitle` interpolates `Prompt.data.params` for parameterized keys (the optional
cost title uses `cost` + `card`). `rules-text.test.ts` derives the lists from the protocol and
rules sources, so a new code fails until it has an English string.

### Translations

The same `rules.*` keys live in `data/i18n-{fr,ko,zh-CN}.json` under `ui.patterns` (flat dotted
keys; `ui.exact` keeps its generated-key invariant, and `createTranslator` still falls back to
English for any other missing key). Terminology follows the existing card/sentence catalogs, e.g.
Assault → Assaut / 맹공 / 强攻, Shield → Bouclier / 보호막 /
坚守, Tank → Tank / 탱커 / 壁垒, Ganking → Gank / 개입 / 游走, Deflect → Protection / 굴절 / 法盾,
Equip → Équiper / 장착 / 装配, battlefield → champ de bataille / 전장 / 战场, showdown →
confrontation / 결전 / 对决, chain → chaîne / 체인 / 结算链. `rules-text-locales.test.ts` fails
when an English `rules.*` key is missing from a locale or its placeholders differ. The strict
components still bind `createTranslator("en")` (`StrictRulesPanel`, `RoomShell`, `GameScreen`), so
the active locale must be wired before these catalogs reach the screen.

## apps/play strict UI

Every strict surface is gated on `rulesMode === "strict"` (or on a strict rejection frame), so
sandbox rooms render and behave exactly as before; no existing class or visual changed.

- **Lobby**: the host's room setup panel gains a "Rules: Sandbox / Strict" fieldset
  (`RulesModeFieldset`, the existing segmented-button recipe) that sends `set_lobby_rules_mode`;
  the active mode comes from `RoomSessionDoc.rulesMode` (`RoomState.rulesMode`, strict only).
- **Dev-only panel**: the left `StrictRulesPanel` ("Strict rules — You have priority", Pass /
  End turn / Concede) is developer-only. It reuses the app's Next `NODE_ENV` convention:
  `strictRulesPanelEnabled()` is `process.env.NODE_ENV !== "production"`, so `pnpm --filter play
  dev` (and the test run) show it while `next build` / `next start` do not render it at all.
  `StrictPromptHost` (prompt dialog + §6.4 Done) is separate and always rendered.
- **Production board controls** (everything the dev panel offered): pass priority/focus with the
  chain **Approve (A)** / **Resolve (S)** buttons and the showdown pass controls (strict rooms
  send `rules_pass` from `chainControlIntent`; sandbox rooms keep their original vote/resolve
  actions); end turn with the board End turn button (`legalIntents.canEndTurn`); concede from the
  Leave dialog's Concede entry (`rules_concede`); prompts by clicking highlighted board objects
  or the prompt dialog for non-board prompts; ambiguous abilities from the chooser. Sandbox-only
  controls with no strict meaning are hidden in strict rooms (NEXT / rewind / forward while the
  game is in progress, chain Repeat/Flow/Extra-turn toggles, payment tray, hand-reveal toggle,
  reveal/auto-pay/counter card actions).
- **Board** (`StrictRulesPanel`, prompts slot, developer builds only): status line from `whoMayAct`
  ("You have priority", "Bob has focus", "Waiting for Bob: …", manual window), Pass / End turn
  (kept visible when illegal with the `explainIllegal` reason as tooltip), Done in the §6.4 window
  and Concede with confirmation. There is no play/activate/move button list: strict rooms are
  gesture-only (owner directive: "we shouldn't have to pick an action to play from the list").
  `legalIntents` runs client-side on the viewer's redacted room through the engine host; a test
  proves it equals the server's for each viewer. In solo modes the panel acts as the seat that may
  act when this client controls it.
- **Gestures** (`BoardInteractionProvider` + `drop-intents.ts`): the board sends the same natural
  sandbox payloads and `@rift/engine` translates each one (`packages/engine/src/strict/gestures.ts`,
  full contract in [`gestures.md`](gestures.md)):
  - play = `move_card {from:"hand"|"champion"|"trash"|"banished", to:"base"|bf, cardId}`; spells /
    drag-to-play = `chain_add {from, cardId}`; Hide = `move_card {…, asHidden:true}` (armed from the
    one-item Hide menu, then dropped);
  - targeting = add `targetCardId:<dropped-onto id>` to the same gesture (play, chain, board use or
    Equip); a gear dropped on a Unit stays `equip_card {equipmentCardId, unitCardId}`;
  - Standard Move = `move_card {from, to, cardId}`; several Shift-selected Units add
    `cardIds:[…]`;
  - use / legend / rune = `toggle_exhausted {zone, cardId, expectedExhausted:false}` (with
    `ability:"<ref>"` only after an `ambiguous_gesture` chooser);
  - end turn = `end_turn`.
  Payment, targets, modes and X are never chosen by the client: the engine auto-pays and opens
  its normal prompts. Optional additional costs are prompted too: a bare `rules_play` from a
  gesture with no `optionalCosts` field opens one `play.optional_cost` yes/no per affordable cost
  (for example "Pay Accelerate [1][Order] as an additional cost to have Azir, Sovereign enter
  ready?"), answered in `StrictPromptDialog`; No continues with the base cost only. Playable
  cards are outlined from
  `legalIntents.playableCardIds`, drop targets use `engineCanDrop` (which dry-runs the strict
  translator) and also outline the card under the pointer, and every rejection is shown as the
  engine's translated reason + rule (+ detail) instead of failing silently.
- **Prompt clicks**: while a single-selection `choose-target` / `choose-card` /
  `choose-battlefield` prompt is open, clicking or dropping on one of its board options sends the
  natural gesture above and the engine answers with `rules_choose`. For `min`/`max` > 1 the board
  accumulates highlighted clicks and sends one `rules_choose` on Confirm. `StrictPromptDialog` is
  kept only for prompts with no board object to click (yes-no, numbers, modes, ordering, damage
  assignment, choose-cost); its existing option/order/damage UI is unchanged.
- **Ambiguity**: a gesture matching several legal abilities is not guessed. The engine rejects it
  with `ambiguous_gesture` and the candidate refs in `detail`; a small chooser resends the same
  gesture with `ability:"<ref>"`. This is the only action list in strict rooms.
- **Rejections**: strict error frames become `RulesRejectionError` (code, rule, detail) and the
  game screen's existing error toast shows `rulesReasonText` ("You don't have priority. (rule
  312)"). Client-side illegal gestures also show the same reason as a board toast. `reject_invalid`
  / `reject_retryable` server errors never populate `lastError`, so they are dismissible action
  toasts, never the blocking Retry / Return-to-lobby connection banner (that stays for transport,
  bootstrap and server failures).

Remaining (UI): legacy free-form prompts without options only show their title; `ambiguous_gesture`
mode choices (355.3) are sent as an explicit `rules_play {choices:{mode}}` from the chooser because
the wire gesture has no mode field; not checked in a browser yet.

## Board presentation (R4 fix wave)

- **Chain cards.** `ChainSlot` maps each strict-projected `chainEntries` item through
  `chainDisplayEntry` (`chain-utils.ts`): a triggered/activated item carries no `cardSnapshot`, so
  its public source card is looked up by `sourceCardId` (or by catalog name in `CardArt`) and the
  card art/name renders like a sandbox chain card, including token art (`tokens/<Name>.webp`).
  Hidden/facedown (including redacted `__hidden_zone__` chain placeholders) stay card backs.
- **Prompt surface.** While a controlled seat has a board-object prompt, `BoardInteractionProvider`
  renders a production banner with the source card name + translated instruction, option chips,
  and Skip/Cancel/Confirm where applicable. Every option card is highlighted (attached cards
  included) and chip hover applies a stronger highlight; clicking a card or chip sends the same
  `rules_choose`.
- **Hidden (811.1.b/811.6).** Dragging a `legalIntents.hideable` card shows a "Hide (facedown)"
  pocket with the fixed `[A]` cost on each legal battlefield; dropping there sends
  `move_card { …, asHidden:true }`. Alt+drop on a normal battlefield is the keyboard equivalent.
  Own facedown cards use the normal `playableCardIds` highlight and clicking one sends the
  facedown-play gesture; the owner's hover preview shows its identity, while the opponent's
  redacted placeholder renders as a card back. Same-turn attempts use the engine's
  `not_in_hand` / 420.1.a rejection toast.
- **Response windows (312/313/338.1.b/347.2).** The focus/priority holder gets a production
  respond banner: "Showdown at <battlefield>" / "Combat at <battlefield>" / "Respond to <chain
  item>", the translated instruction, and Pass (W → `rules_pass`). Playable cards and activatable
  abilities are highlighted from the holder's local `legalIntents`. The banner is identical when
  no legal response exists; only the holder sees the small local "No playable responses right
  now" hint. The opponent never receives the banner or that hint and sees a neutral chain line
  "Waiting for <name> (focus|priority)". A choose prompt suppresses the response banner.
- **Chain status.** Strict rooms derive the status line from `whoMayAct` instead of the sandbox
  vote counter: "<player> must choose: <instruction>" while a prompt is pending, else priority /
  focus. Resolve/Approve are disabled and explain the prompt while it is pending.
- **Attachments.** Sandbox `equip_card` and the strict `attach` op both keep attached gear in the
  unit's zone list with `attachedToCardId`. `groupAttachedCards` removes those cards from the row;
  `AttachedCardFan` draws them like the simulator/reference app: same size at the unit's height,
  fanned right by 0.26 card widths per gear, unit on top and first-attached gear above later gear
  so every gear exposes its frame, art and stat badge. The host slot widens by the fan
  (`attachedFanWidth`) in both base and battlefields, the gear strips emit the normal hover
  preview event, and the fan sits inside the unit's pose transform so move/exhaust/kill carry it.
  Detach/move/kill leave the gear at its location and it renders as its own card again.
- **Seats.** `IdentityBadge` renders an avatar/initial and presence dot for every present seat;
  bot seats are always online and show a Bot badge in the clock slot (no frozen 00:00 timer).


## Open questions / findings

- **Card ids encode the card face** (engine id scheme). Any future field that carries a card id
  must be checked against the redaction map; `redact-rules.ts` rewrites ids anywhere in
  `Room.rules`, but other `Room` fields are redacted field by field (the mulligan playback leak
  was one). A server-side opaque id scheme would remove the whole class.
- **Rewind in `single_player` strict rooms** is allowed in Practice vs Bot and `solo_lab`, and
  rejected in human-vs-human strict rooms (owner decision, R5). The client shows rewind/forward
  and **Export repro** only in those practice rooms; see [`rewind.md`](rewind.md).
- **The prompted player sees options naming another seat's cards** (for example a look at an
  opponent's hand): those option ids are kept because the engine offered them to that player;
  every other private id in the continuation is rewritten. Whether the board should also reveal
  those cards to that player (`revealedToPlayerIds`) is the effect's business, not redaction's.
- **Concede and the Turn Player** (652 / 651.3): removing the Turn Player in FFA leaves the turn
  hand-off unresolved (pre-existing RULES-QUESTION(652) in `scoring/concede.ts`).
