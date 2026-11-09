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
| `apps/play/src/components/board/strict/*` | 411.2, 467.2.c, §6.4, 650 | `StrictRulesPanel`, `StrictPromptDialog`, pure `strict-model.ts` |
| `apps/play/src/components/room/RoomShell.tsx` (`RulesModeFieldset`), `lobby/integration/roomMapping.ts`, `lobby/LobbyContainer.tsx` | §3 | host-only lobby toggle |
| `apps/play/src/runtime/matchRuntime.ts`, `components/game/GameScreen.tsx` | §5 | `RulesRejectionError` (code/rule/detail) shown through `rulesReasonText`; the turn button sends `rules_end_turn` in strict rooms |

Tests: `packages/sync/src/redact-rules.test.ts` (every case below, spectators, solo, patches),
`packages/sync/src/redact.test.ts` (mulligan playback), `packages/sync/src/messages.test.ts`
(error frame fields), `apps/realtime/tests/match-room.test.ts` (`MatchRoomCore strict rooms`),
`packages/rules/test/rules/int/concede-intent.test.ts`,
`packages/i18n/src/rules-text.test.ts`, `packages/engine/test/strict-int.test.ts` (read view),
`apps/play/src/components/board/strict/__tests__/*`, `apps/play/src/runtime/__tests__/rules-rejection.test.mts`.

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
`ui.<label>`. `rules-text.test.ts` derives the lists from the protocol and rules sources, so a new
code fails until it has an English string.

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
- **Board** (`StrictRulesPanel`, prompts slot, the `ShowdownPrompt` shell look): status line
  from `whoMayAct` ("You have priority", "Bob has focus", "Waiting for Bob: …", manual window),
  one button per legal play (per location), activation ("Activate (manual)" for unscripted
  `manual:<n>` abilities), move, plus Pass / End turn (kept visible when illegal with the
  `explainIllegal` reason as tooltip), Done in the §6.4 window and Concede with confirmation.
  `legalIntents` runs client-side on the viewer's redacted room through the engine host; a test
  proves it equals the server's for each viewer. In solo modes the panel acts as the seat that may
  act when this client controls it.
- **Prompts** (`StrictPromptDialog`, prompted seat only): one-click single choice and yes-no,
  multi-choice with `min`..`max`, ordering (answers `optionIds` + `orderedIds`), and the 467.2.c
  damage assignment on the `CombatDamageAssignmentData` contract (suggestion prefill, remaining
  counter, lethal / "can't be dealt damage" per target; the engine's verdict decides legality).
- **Rejections**: strict error frames become `RulesRejectionError` (code, rule, detail) and the
  game screen's existing error toast shows `rulesReasonText` ("You don't have priority. (rule
  312)"). The board's turn button sends `rules_end_turn` in strict rooms.

Not done (UI): the hand fan / drag / context menus still send sandbox actions in strict rooms
(the server answers `strict_mode_action`, shown with its reason) instead of being driven by
`legalIntents`; no playable-card highlighting; no explicit payment plan, optional-cost or Hide
(`hideable`) controls; free-form prompts without options (legacy) only show their title; not
checked in a browser.

## Open questions / findings

- **Card ids encode the card face** (engine id scheme). Any future field that carries a card id
  must be checked against the redaction map; `redact-rules.ts` rewrites ids anywhere in
  `Room.rules`, but other `Room` fields are redacted field by field (the mulligan playback leak
  was one). A server-side opaque id scheme would remove the whole class.
- **Rewind in `single_player` strict rooms** is rejected: the engine treats only `solo_lab` as a
  solo mode for the strict rewind gate. Left unchanged (engine behaviour); RULES-QUESTION for the
  lead whether practice-vs-bot rooms should allow it.
- **The prompted player sees options naming another seat's cards** (for example a look at an
  opponent's hand): those option ids are kept because the engine offered them to that player;
  every other private id in the continuation is rewritten. Whether the board should also reveal
  those cards to that player (`revealedToPlayerIds`) is the effect's business, not redaction's.
- **Concede and the Turn Player** (652 / 651.3): removing the Turn Player in FFA leaves the turn
  hand-off unresolved (pre-existing RULES-QUESTION(652) in `scoring/concede.ts`).
