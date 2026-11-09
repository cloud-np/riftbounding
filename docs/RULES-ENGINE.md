# Strict Rules Engine (`@rift/rules`)

Strict mode is a rule-literal layer that sits **next to** the original sandbox. The sandbox is
still the byte-for-byte faithful simulator; strict mode owns timing, priority/focus, the chain
(HOT FEPR), cleanups, showdowns/combat seams and scoring. Source of truth: **Riftbound Core
Rules, Last Updated 2026-10-09** (local corpus: `packages/rules/corpus/`). Code comments and test
titles cite rule numbers (`[R309.1.a]` = rule, `[EX:467]` = official example, `[C:Card Name]` =
card script). Errata is under `packages/rules/corpus/errata/`.

## Status (R2)

Wave R2 merged three domains on top of the R1 skeleton and an integration pass reconciled their
seams (this document is the merged view; per-domain decisions are in the linked docs below):

- **R2-play** — process of play 349–359, costs/payment 160–168 / 201–206 / 356–357, activated
  abilities 376–381, **the single 399–407 path for triggered abilities** (`play/triggered.ts`),
  Standard Move 447–455, timing/cost keywords. [`docs/rules/play.md`](rules/play.md)
- **R2-combat** — cleanups 318–324, stored battlefield control 188–190, combat 461–468 with full
  467.2.c damage assignment, scoring 469–474, victory, 2v2/FFA team rules, conceding.
  [`docs/rules/combat.md`](rules/combat.md)
- **R2-effects** — resumable Effect interpreter 412–448, triggers 382–398, replacements 367–375,
  layers 475–482, card scripts (fixture deck + cards named in official examples).
  [`docs/rules/effects.md`](rules/effects.md)

Integration decisions (rule that decided each): R2-combat is the only emitter of `attack`/`defend`
(466.2.c.3, 383.4.e/f); the Combat Chain order `[attacker, …non-defenders, defender]` is applied
once by `beginCombat`, every other simultaneous trigger uses Turn Order (466.2.d.1 vs 383.3.d.1);
Assault/Shield are Might passives applied once in the layers (807.1.c / 814.1.c, values summed
807.2 / 814.2); facedown cards are never Units present (107.3, `state/presence.ts`); Might may be
negative and only its uses clamp (143.2.c / 479.4.c); a resolution waiting on a prompt keeps its
item on the chain (340 / 359).

## Status (Wave R3)

Wave R3 added card scripts in six parallel lanes plus one engine lane (R3-engine). Each card lane
owns `src/cards/<SET>/**`, `test/cards/<lane>/**` and a report in `docs/rules/cards/<lane>.md`
(capability gaps, `[BUG]` reproductions, custom ids, per-card status): Origins A–N, Origins O–Z,
Spiritforged, Unleashed, Vendetta + Proving Grounds, Radiance. Totals are in
[`cards-coverage.md`](cards-coverage.md); the merged status and gap ranking live in
[`/progress.md`](../progress.md).

R3-engine capabilities (protocol additions in `packages/protocol/CHANGES.md`, `## R3-engine`):

- Damage split among targets and group targeting (355.11 / 355.14 / 715.3; `deal_split`,
  `Selector.group`, `Selector.anyNumber`).
- Optional replacements (371.2) and replacement ordering (372 / 373): decisions outside a
  resolution use the `effects.replacement` prompt reason; `replacement_held` event.
- Show Off (832) and Flow (829, a played-for-Flow spell is banished via `leaveChainTo`).
- Ganking granted by keyword passives now counts for Standard Move legality (810.3 / 144.4.c.1).

## Status (Wave R4-engine, part A)

Wave R4-engine (part A) fixed the engine gaps behind the 25 `[BUG]` card reproductions; all 25 are
now unskipped. Wire additions are in `packages/protocol/CHANGES.md`, `## R4-engine`.

- **Expiration keep-list (317.2.c).** Step 3d now prunes this-turn modifiers and then deletes a
  rules object only when it has no persistent state: `buffs`, `baseMight` (including 0), counters,
  keyword/ability grants, `keywordGrants`, `mightMods`, `prevent`, `empowered`,
  `paidAdditionalCost`, `hiddenTurn`/`hiddenBy`, `showOff`, `targetedBy` or a controller. Stunned,
  designations and temporary Might still clear (424.1.a.2).
- **Repeat (820.1–820.3).** A leading dash before a non-symbol cost is accepted; a paid instance
  executes the instructions one additional time, and each repeated execution binds its play-time
  choices as `repeat:<n>:<key>` (820.2.a). `CardScript.repeatHandled` and
  `ChainItem.repeatExecutionsDone` support scripts that still implement repeat themselves and
  prompt-resumed executions.
- **Costs and play.** Deflect charges the effective keyword value per choice (809.2); the 054.1
  self play restriction is read on cards in hand; a limited play marks its chosen location with
  `totalCost` (420.3.b); an Ambush battlefield merges onto the controlled-battlefield option
  (822.1.b); rune/Power payment no longer counts as paying an optional additional cost (356.4.f.1).
- **Replacements and LKI.** Delayed replacement matchers see the creating ability's choices;
  attached cards contribute replacement effects; `kill` events and `LastKnown`/`noteLki` carry
  `stunned`/`buffs`/`empowered`; Deathknell choice scanning receives the trigger event and the old
  zone (355.7 / 383.2.c.3.b / 808).
- **Attachments.** Built-in `equip:<n>` attaches on resolution; Weaponmaster, Quick-Draw and
  Deploy keyword triggers exist; attached-card triggered abilities and Effect-Text passives are
  appended to the Top-Most card. Printed Rules Text passives use the `rules-text` wrapper
  (718.2).

## Toggle & safety

| State | Behaviour |
|---|---|
| `Room.rulesMode` absent or `"sandbox"` | the original engine exactly as before; `@rift/rules` is never called |
| `Room.rulesMode === "strict"` + lobby | `set_lobby_rules_mode { mode }` (host only) sets the mode |
| strict + `in_game` | `Room.rules: RulesState` is present; `rules_*` intents are routed to `@rift/rules` |
| strict + not in `in_game` | `rules_*` intents are rejected with `not_in_game` (`contract:§2`); the room is left untouched |

The last row is the code's actual behaviour and the documented contract: after validating the wire
shape, `applyRulesIntent` checks `room.rulesMode !== "strict"` (`rules_require_strict`,
`contract:§1`) and then `room.phase !== "in_game"` (`not_in_game`, `contract:§2`) before cloning or
touching anything, so the room is left untouched. It does **not** use `strict_mode_action`; that
code belongs to the sandbox-action gate below.

Lobby rule: `set_lobby_rules_mode` is handled in `packages/engine/src/engine.ts` (host only,
lobby only). It is **not** in `ACTION_HANDLERS`, so the original action-coverage test still
asserts its 99 sandbox wire actions unchanged; `rules_*` are routed before the handler map.

Realtime (R2-int): `set_lobby_rules_mode` arrives as a `room_shell_action`, is validated by the
engine handler above and mirrored on `RoomSessionDoc.rulesMode`; `rules_*` intents (including
`rules_concede`, 649–652) arrive as `action_intent`. A rejected intent's `error` frame carries the
ReasonCode as `code` plus `rule`/`detail`. Snapshots and patches carry a per-viewer redacted
`Room.rules` (`packages/sync/src/redact-rules.ts`, privacy matrix in
[`docs/rules/int.md`](rules/int.md)).

In strict rooms every non-`rules_*` gameplay action goes through `gate()`:
cosmetic/meta actions (dice, arrows/pings, board settings, card labels) are allowed; the §6.4
manual window additionally allows its player's board actions; everything else is
`strict_mode_action`. Rewind is rejected outside solo modes. Sandbox rooms never call the gate.

## State shape (protocol)

All wire types live in `packages/protocol/src/rules-state.ts` and are re-exported from
`@rift/protocol`. `Room.rulesMode?: RulesMode` and `Room.rules?: RulesState` are additive.

```ts
RulesMode = "sandbox" | "strict"
RulesPhase = "awaken" | "beginning" | "channel" | "draw" | "main" | "ending"
RulesStep  = "beginning" | "scoring" | "ending" | "expiration"
TurnState  = "neutral_open" | "neutral_closed" | "showdown_open" | "showdown_closed"

RulesState {
  version: 1
  turn: { player, number, phase, step?,
          expirationFepr?,      // 317.2.f: FEPR episodes owing a restarted pass
          expirationPasses? }   // 317.2.f/322: pass counter for the loop guard
  priority, focus, passes
  chain: ChainItem[]                 // oldest first; ids == Room.chainEntries ids (newest-first display)
  showdown, combat, contested, staged
  tasks: Task[]                      // Outstanding Tasks (333)
  prompt: Prompt | null              // Limited-Action choice (411.2)
  triggers, effects, objects, pools
  scoredThisTurn, history, manual
}
```

`turn.expirationFepr` and `turn.expirationPasses` are additive optional plain-JSON fields
(protocol CHANGES.md, R1-FIX-C). They make the 317.2.f “items underwent FEPR during the Expiration
Step” detection survive an intent boundary and bound the repeat. `startNextTurn` replaces
`rules.turn`, so both reset naturally with the next turn.

Key part types: `ChainItem` (`kind/status/controller/sourceObjectId/cardName/abilityRef/choices/
paid/origin/fromZone/cardSnapshot`), `Task` (`kind/playerId/zone/data`), `Prompt` (+
`PromptAnswer`), `PendingTrigger`, `ContinuousEffect`, `ObjectRulesState` (damage, buffs,
stunned, designations, temporary might, per-turn flags), `GameEvent`, `Verdict` (`{ok:false,
code, rule, detail?}`), `ReasonCode`, `RuleRef` (dotted rule string).

`Room` remains the source of board facts: zones, card instances, owner/controller, exhausted,
and `chainEntries` for display. `RulesState` only holds what `Room` lacks. After every accepted
intent the layer projects back onto `activeTurnPlayerId`, `activeTurnStep`, `turnNumber`,
`chainEntries`, `floatingEnergy`, `floatingPower` and the scored-this-turn display map so the
current board UI keeps rendering.

### Restore contract (NEW-6/NEW-7)

A strict `in_game` room without `rules` (older serialized room, lost state) is reconstructed by
`state/create.ts` `restoreRulesState` from the Room, never by replaying Start of Turn (315):

- turn player from `Room.activeTurnPlayerId` (fallback `firstPlayerId`, then the first active
  player; 304/312.2.a), `turn.number` from `Room.turnNumber`;
- `turn.phase = "main"` and `priority` = the turn player (312.2.a); pools are zeroed and
  `objects` rebuilt from the board Units (base Might only);
- **no** 315.1 ready, 315.3.b.1 channel or 315.4.b draw — the board already reflects the current
  turn, so replaying would ready Units, channel extra Runes and draw an extra card. A room stored
  at the coarse `beginning` step also resumes at Main; the contract deliberately skips the
  Awaken/Channel/Draw automation.

Write path: `applyRulesIntent` reconstructs before the handler and emits one `rules_restored`
event (`{ playerId, data: { phase: "main", roomStep } }`). Read path: `view/restore.ts`
`readableRulesRoom` mirrors the prologue order (strict → `in_game` → game over → state) and runs
the same restore on `host.cloneRoom`; `legalIntents`/`explainIllegal` therefore agree with the
write path, never mutate the caller's room and emit no events.

Limitation: only turn fields are rebuilt. A lost state resumes at Main with empty `chain`,
`tasks`, `triggers`, `effects`, `pools`, `contested` and `scoredThisTurn`; a mid-chain state is
not replayed (R2 TODO).

## Module map

```
packages/rules/src/
  index.ts             public surface = `api/{core,play,combat,effects}`
  api/
    core.ts            shared state/timing/intents/view/registries + primitives + layers/hooks
    play.ts            play/activate/move/pass/end-turn/choose verdicts
    combat.ts          showdowns, combat 461–468, scoring 469–474
    effects.ts         card scripts + effect ops + interpreter (imports cards/ once)
  host.ts              RulesHost + RulesContext (frozen after R1-SPLIT-R; R1-PREP-E adds
                       moveCardToOwnerZone)
  types.ts             RulesStepContext, fail(), rulesOf(); re-exports effectiveMight from layers/
  layers/
    index.ts           effectiveMight (143.2, may be negative) + effectiveKeywords (475–479)
    combat-keywords.ts Assault/Shield/Tank/Backline profile; the 807.1.c/814.1.c Might bonus
    passives.ts durations.ts mods.ts restrictions.ts costs.ts bonus.ts entry.ts ignore.ts
    victory.ts         active modifiers, restrictionFor, costAdjustments, enter-ready, 764–767
  intents/
    index.ts           prologue (clone/validate/ensure state/advance/project) + INTENT_HANDLERS
    context.ts         IntentContext/IntentHandler + normalizeChoices
    play.ts activate.ts move.ts pass.ts end-turn.ts choose.ts manual-done.ts
  state/               turn.ts phase.ts staging.ts project.ts pools.ts create.ts index.ts
    presence.ts        107.3: face-up Units present (unitsPresentAt / hasUnitPresentAt /
                       playersPresentAt); every presence check uses it, never host.unitsAt
  view/                index.ts who.ts legal.ts legal-{play,activate,move}.ts explain.ts restore.ts
  legality/
    timing.ts          shared 307–313/344/347/410/806/813 helpers + boardZones + effective keywords
    play.ts activate.ts move.ts pass.ts end-turn.ts choose.ts manual.ts
    intent.ts          validateRulesIntent dispatcher (shared object/type/hold checks)
    wire/              per-intent payload validators: play activate move pass end-turn choose manual
  timing/
    advance.ts         bounded HOT FEPR auto-advance (334); hook call points
    hooks.ts           hook table + register(Cleanup|Advance|Finalize)Hook +
                       registerActionInterceptor/interceptAction (367–375)
    fepr/              chain.ts finalize.ts resolve.ts pass.ts after.ts manual.ts spell.ts
    tasks/             index.ts registry.ts phase.ts combat.ts play.ts custom.ts
    showdown.ts        341–348 Focus passes, showdown close, Conquer result (one control event)
  cleanup/cleanup.ts   318–324 step order to a fixed point, 324.1 inserts, 322 loop guard;
                       step 5 keeps Deploy gear (830.1.b.3) and never recalls facedown cards
  combat/              begin.ts (participants, Combat Chain order, combatBarsDestination)
                       designate.ts (single attack/defend emitter) keywords.ts assignment.ts
                       damage.ts resolve.ts progress.ts (resumable 465–468 state machine)
  play/                process.ts activation.ts triggered.ts (399–407 for triggers) core.ts
                       choices.ts payment.ts planner.ts cost-*.ts total-cost.ts locations.ts
                       permissions.ts hidden.ts keywords.ts control.ts prompting.ts …
  effects/             interpreter (env/evaluate/machine/targets/choices + ops/*.ts)
  triggers/            detect.ts (event → PendingTrigger) match.ts index.ts (flush, 303.2.a)
                       finalize.ts (337.1 hook: 359.3.e target snapshot) keywords.ts hooks.ts
  replacements/        interceptor.ts (367–375, 438, 444) preview.ts (previewDamage)
  scoring/             score.ts teams.ts (485/491) concede.ts (195, 649–652)
  actions/
    primitives.ts      compatibility barrel (`export *` + primitives namespace)
    ready.ts draw.ts damage.ts move.ts resources.ts score.ts control.ts tokens.ts board.ts
  scoring/score.ts     469–474 scoring, final-point rule, victory check
  prompts/
    index.ts           imports burn-out/stage-showdown/stage-combat + the three domain barrels
    handlers.ts        registry + answer validation; reasons.ts shared core reason constants
    burn-out.ts stage-showdown.ts stage-combat.ts
    play/ combat/ effects/   index.ts (handler imports) + reasons.ts (domain reason constants):
                       play.choice / play.cost / play.trigger, combat.damage_assignment,
                       effects.resume / effects.order_triggers
  effects/
    execute.ts         interpreter entry point (dispatches through EFFECT_OPS)
    registry.ts        registerEffectOp / EFFECT_OPS
    ops/index.ts ops/seq.ts
  cards/
    index.ts           imports every set barrel once (side-effect script registration)
    registry.ts        card-script registry + ability-ref lookup
    <setCode>/index.ts OGN SFD UNL RAD VEN OGS ARC SGN (+ tokens/, dsl.ts builders)
```

Compatibility barrels kept for existing imports: `intents.ts`, `view.ts`, `turn-state.ts`,
`timing/fepr.ts`, `timing/tasks.ts`, `actions/primitives.ts` (all re-export their directory).

`RulesHost` is implemented once, in `packages/engine/src/strict/host.ts`, on top of the engine's
real `state/board.ts`, `rules/movement.ts`, `rules/turn.ts`, `rules/victory.ts` and
`state/selectors.ts`. Runtime dependencies of `@rift/rules` stay `@rift/protocol` +
`@rift/cards`; `@rift/engine` imports the layer, never the other way round. Tests reach the
engine through relative source imports to avoid a pnpm workspace task cycle.

## Public API

```ts
// intents + wire validation
applyRulesIntent(room, actorId, intent, ctx: RulesContext, host: RulesHost):
  { ok: true; room; events } | { ok: false; code; rule; detail? }
validateRulesIntent(intent): { ok: true; intent } | Verdict  // F10, never throws
WIRE_VALIDATORS                     // one payload validator per rules_* intent (wire/*)
initializeStrictRules(room, ctx, host): Room       // enters in_game from setup

// read side (host is required: board facts live in Room)
turnState(room): TurnState
whoMayAct(room): WhoMayAct
legalIntents(room, playerId, host): LegalIntents
explainIllegal(room, playerId, intent, host): Verdict

// timing / cleanup / scoring helpers
advance(room, step): "await" | "game_over" | "loop_guard" | "no_rules"
runCleanup(room, step, options?: CleanupOptions | number): boolean
  // options: { insert?: { after:"3a"; steps: CleanupInsertStep[] }, depth?, maxPasses? }
  // 321: while rules.manual/rules.prompt is open, queues one cleanup Task and returns false
runCleanupOrQueue(room, step): "ran" | "queued"     // 321/321.1 wrapper used by advance
runExpirationStep(room, step, { extraInserts? }): { feprItems; repeated }
queueTask(room, task, step), processNextTask(room, step)
beginShowdown(...), endShowdown(...), passFocus(...), beginCombat(...),
runCombatDamage(...), runCombatResolution(...)
scoreBattlefield(...), holdBattlefields(...), checkVictory(...)
gate(room, actor, type), isCosmeticAction(...), isManualBoardAction(...)

// legality verdicts (the same functions the write path and explainIllegal use)
playCardVerdict, playLocationVerdict, activationVerdict, activatableAbilities,
keywordTimingVerdict, abilityTimingVerdict, baseActionVerdict,
moveTimingVerdict, passVerdict, endTurnVerdict

// prompt registry (411.2)
PROMPT_REASONS                      // { burnOut, stageShowdown, stageCombat }
registerPromptHandler / getPromptHandler / promptHandlerReasons / promptReason /
chosenPromptOption / promptAnswerVerdict

// R2 extension registries (module-level, import-time; no game state)
INTENT_HANDLERS, registerTaskHandler / TASK_HANDLERS,
registerAdvanceHook / registerCleanupHook / registerFinalizeHook / registeredHooks,
registerActionInterceptor / interceptAction / ActionProposal (367–375),
registerEffectOp / EFFECT_OPS, registerCardScript(s)

// layers (475–479) — the only file R2-effects edits for effective characteristics
effectiveMight(room, objectId, host), effectiveKeywords(room, objectId, host | printed[])

// RulesHost generic operations (frozen): moveCardTo (top/bottom/number), moveCardToOwnerZone,
// banish, reveal, hide, lookAtTop, searchZone, attach, detach, setController, adjustCounter,
// returnToHand, createToken

// card scripts / effects / primitives
registerCardScript(s), getCardScript, lookupAbility, cardScriptNames, clearCardScripts,
executeEffect, executeAbility, executeCardScript, primitives.*
```

### R2 public API additions

All exported from `src/index.ts` through the domain barrels (`api/{core,play,combat,effects}.ts`):

```ts
// core: 107.3 presence
unitsPresentAt(room, host, zone, playerId?), hasUnitPresentAt(room, host, playerId, zone),
playersPresentAt(room, host, zone)

// play (R2-play): payment, process of play, activation, triggered abilities
canPayCost, payCost, planPayment, applyPayment, costObjectChoice, resolveCost, printedCardCost,
planCardPlay, executeCardPlay, planActivation, executeActivation, planCore, playLocations,
registerPlayPermission, registerAdditionalCosts, cardKeywords, legionActive, planHide, executeHide,
prepareTriggeredItem(room, step, item, { ability?, cost?, decline? }) → "finalized"|"pending"|"removed",
answerTriggerDecision, triggeredAbilityOf, triggerLeadingCost, PLAY_PROMPT_REASONS

// combat (R2-combat)
combatParticipants, combatTriggerOrder, combatBarsDestination(room, player, zone, "move"|"play", host),
designateCombatants, combatKeywordProfile, combatMight (effectiveMight clamped at 0),
lethalAssignment, validateAssignment, enumerateAssignments, damageAssignmentVerdict,
continueCombat, battlefieldController, controlsBattlefield, loseControl, losePoints,
scoreBattlefield, holdBattlefields, checkVictory, concede, playerLoses, playerWins, areOpponents

// effects (R2-effects)
executeEffect / executeAbility / executeCardScript (status "resolved"|"manual"|"await"),
requiredChoices, validateChoices, flushPendingTriggers(room, step, { order? }), restrictionFor,
costAdjustments, effectiveKeywordValues, rawMight, previewDamage, preventValue,
registerEffectOp, registerCustomEffect, registerCustomCondition, listActivatedAbilities
```

Contract deviation: `legalIntents`/`explainIllegal` take a `RulesHost` argument. The original
sketch omitted it, but the pure layer cannot read zones without duplicating engine logic, which
§1 forbids.

### Ability refs

One scheme is shared by `legalIntents`, `explainIllegal` and `applyRulesIntent` (F7):
`activated:<index>` indexes the script's **full `abilities` array**, not the filtered
activated-only list. `lookupAbility` resolves the same index and rejects a ref whose ability is
not `kind:"activated"`. `spell` resolves the first spell ability; `triggered:<kind>` resolves a
triggered ability by trigger kind. Never renumber after the fact; add abilities at the end.

### Standard Move source legality (NEW-1, 144)

`legality/move.ts` `moveTimingVerdict` is shared by the write path (`intents/move.ts`) and
`explainIllegal`. A Standard Move starts from a Unit already on the Board: hand, deck, trash,
champion and banished are card-play/effect territory (349–359, 429), never 449.

| Check | Verdict `code` / `rule` |
|---|---|
| empty `unitIds` | `unit_not_found` / 144 |
| duplicate ids (would exhaust/move twice) | `illegal_action` / 144 |
| source zone not `base` or a battlefield | `unit_not_found` / 144 (`detail` names the zone) |
| source card is not a Unit | `unit_not_found` / 144 |
| actor does not control the Unit | `illegal_target` / 144.4 |
| Unit exhausted | `unit_exhausted` / 144.2 |
| destination is not `base` or a battlefield | `invalid_location` / 449.2 |
| destination equals current location | `invalid_location` / 144.4 |
| battlefield → battlefield without Ganking | `invalid_location` / 144.4.c |
| 2+ other players' Units at the destination battlefield (face-up only, 107.3) | `invalid_location` / 449.2 |
| facedown card (not a Unit at a location) | `unit_not_found` / 107.3.e |
| a restriction applies (`restrictionFor({kind:"move"})`, Ganking read through layers 810.3) | `restricted` / the restriction's rule (default 421) |
| 3+ players: Staged Combat there and the mover is not involved or has no Units there (`combatBarsDestination`) | `invalid_location` / 449.2.a (464.1) |

Timing is checked first: `not_your_turn` / 410, `chain_not_empty` / 144.1.b,
`showdown_active` / 144.1.c, `combat_active` / 144.1.c. `test/rules/move-source.test.ts` asserts
apply/explain agreement for each source-zone and payload case.

### Prompt reasons

`prompt.data.reason` selects the handler (`prompts/handlers.ts`). The emitter and handler import
the same constants from `prompts/reasons.ts`, so they cannot drift:

| `PROMPT_REASONS` | value | rule | emitter | handler |
|---|---|---|---|---|
| `burnOut` | `burn_out` | 432.2.c | `actions/draw.ts` | award 1 point; settle victory immediately (432.3.c.1); finish `remainingDraws` (432.2.d) |
| `stageShowdown` | `stage_showdown` | 323.11 | `cleanup/cleanup.ts` | begin the chosen non-combat Showdown |
| `stageCombat` | `stage_combat` | 323.12 | `cleanup/cleanup.ts` | begin Combat at the chosen battlefield |

A prompt with no `data.reason` keeps the legacy kind-based behaviour for merge-order
compatibility; a prompt with an unregistered reason records the answer and applies no side effect.
When a handler opens the next prompt (for example a repeated Burn Out, 432.3.a),
`recordPromptAnswer` only clears the prompt it answered, so the new one stays pending.

### Prompt answers (411.2)

`prompts/handlers.ts` `promptAnswerVerdict` is shared by the `rules_choose` write path and every
handler. A prompt with no `options` keeps legacy free-form behaviour; otherwise an answer may
reference offered options only (`optionIds`, or the single-choice `playerId`/`zone`/`value`
fallbacks must match an offered option) and the number selected must satisfy
`prompt.min`..`prompt.max` (defaults: min 1, max all options). A violation returns
`invalid_choice` (`prompt.rule ?? "411.2"`) and the prompt stays pending (NEW-11).
`stage-showdown`/`stage-combat` derive the battlefield from the selected option; a free-form zone
is honoured only when the prompt offered no options (legacy rooms).
Tests: `test/rules/prompt-answers.test.ts`.

### 321 / 321.1 — cleanups during resolution

321: a Cleanup cannot run while a Chain Item is resolving. The guard now lives inside `runCleanup`
itself (NEW-10): while `rules.manual` or `rules.prompt` is open it queues a single `cleanup`
Outstanding Task (321.1; deduped by `kind`) and returns `false`. `runCleanupOrQueue`
(`timing/fepr/after.ts`) is the thin `"ran" | "queued"` wrapper, and `advance` uses it after
finalizing each pending item, so no call site (including direct `runCleanup` users) can run a
cleanup mid-resolution. The task runs after `rules_manual_done`/the prompt answer completes the
resolution; `passPriority` resolving an unscripted spell therefore never kills marked-damage Units
mid-resolution (tests: `cleanup-bounds.test.ts`).

The Expiration Step is the exception by construction: it *is* a Special Cleanup (317.2.a) and
runs 3c/3d/3e as inserted steps after 3a (324.1), so lethal damage still dies before “Heal all
Units”. 317.2.f repeats the step when FEPR work happened; the detector is persisted on
`turn.expirationFepr` so a trigger that gains priority and resolves in a later intent still
forces the restart. Both the 322 cleanup bound and the 317.2.f repeat bound set
`RulesStepContext.loopGuard`; `applyRulesIntent` returns
`{ ok:false, code:"loop_guard", rule }` instead of only logging an event.

## Events

Every observable strict-mode change is a `GameEvent` (`type` string; `playerId`/`zone`/`cardId`/
`amount`/`data` carry detail). The R1 set, grouped for scanning:

| Group | `type` literals |
|---|---|
| Turn & phase | `turn_start`, `turn_end`, `end_turn`, `ending_step`, `expiration_pass`, `expiration_repeat`, `expiration_paused`, `loop_guard` |
| Priority & focus | `pass_priority`, `focus_passes`, `pass_focus` |
| Chain & FEPR | `card_played`, `chain_append`, `finalize`, `spell_resolved`, `manual_window`, `manual_done`, `prompt`, `prompt_answered` |
| Showdown / combat / scoring | `showdown_begin`, `showdown_end`, `combat_begin`, `combat_damage`, `combat_end`, `conquer`, `conquer_result`, `hold`, `hold_scoring`, `establish_control`, `score`, `score_draw_instead`, `gain_points`, `game_over` |
| Cleanup | `contested`, `contested_reapplied`, `hidden_card_to_trash`, `recall`, `kill` |
| Game actions | `ready`, `ready_all`, `exhaust`, `draw`, `burn_out`, `channel`, `add_resources`, `pools_empty`, `damage`, `heal`, `move`, `create_token` |
| Restore | `rules_restored` |

R2 added (full list with payloads in `packages/protocol/CHANGES.md`, section R2):

| Group | `type` literals |
|---|---|
| Play / payment | `cost_paid`, `recycle`, `discard`, `pay_points`, `spend_xp`, `hide`, `enters_ready`, `ability_activated`, `play_cancelled` (`card_played` now follows the last prompt, 350.1) |
| Triggers | `trigger`, `trigger_removed` / `trigger_declined` (`{itemId, rule, reason}`; 403.4 / 383.3.a.2 / 405.2 / 383.3.b.1), `become_mighty` |
| Combat / control / scoring | `attack` / `defend` (single emitter R2-combat: per unit with `cardId`, per player with `data.player: true`), `damage_assigned`, `combat_result`, `lose_control`, `lose_points`, `concede`, `player_removed`, `lose_game`, `battlefield_replaced`, `banish` |
| Effects | `mistarget`, `replaced`, `prevented`, `skip`, `skip_created`, `might`, `stun`, `buff`, `spend_buff`, `empower`, `disempower`, `counter`, `return_to_hand`, `burn`, `predict`, `look`, `search`, `shuffle`, `reveal`, `attach`, `detach`, `swap`, `grant_keyword`, `remove_keyword`, `gain_xp`, `counter_added`, `counter_spent`, `delayed_created`, `continuous_created`, `replacement_created` |

R1-specific details:

- `contested` (323.8) is emitted once when 2+ contestants apply Contested; ordering is
  `turnOrderStartingAt(turn player)` (303.2.a/NEW-8) and the change drives the 322 repeat into
  323.7/323.8 staging. `contested_reapplied` is the 323.10.a presence-proxy re-application (first
  remaining player in `activePlayerIds` order).
- `expiration_repeat` fires only when `turn.expirationFepr > 0`; a blocked Expiration Step with no
  FEPR work emits `expiration_paused` instead (317.2.f/NEW-9). Both carry
  `{ pass, feprItems, blocking }`.
- `rules_restored` carries `{ phase: "main", roomStep }` and is emitted only by the
  `applyRulesIntent` write path (views restore silently on a clone).

## Effect DSL & card scripts

`Effect`, `Ability`, `CardScript`, `Selector`, `Amount`, `Condition`, `Cost`, `Trigger`,
`Modifier`, `Limit`, `EventMatcher`, `KeywordName` are in `rules-state.ts` (§6 of the design
contract). They are frozen for later waves; add new union members instead of renaming fields.

Scripts are keyed by unique card name and registered in `src/cards/registry.ts`:

```ts
registerCardScript({
  name: "Rebuke",
  text: "[ACTION] Return a unit at a battlefield to its owner's hand.",
  status: "implemented",             // "partial" | "manual" also supported
  abilities: [{ kind: "spell", effect: { op: "seq", effects: [/* … */] } }],
});
```

- `src/effects/execute.ts` is the interpreter entry point (R2-effects: a resumable JSON machine
  over `EFFECT_OPS`; a decision opens an `effects.resume` prompt and the item stays on the chain
  until the continuation finishes). Unregistered ops fall back to the manual window.
- Missing scripts / `status:"manual"` open the §6.4 manual window:
  `rules.manual = { itemId, player, cardName }`. That player may use board actions until
  `rules_manual_done`; the item then goes to the trash (spells) or leaves the chain.
- Add abilities (`origin:"add"`, 430.2/430.2.a) resolve immediately and never pass Priority or
  Focus. Their script is executed (`add_resolved`); an unimplemented effect emits
  `add_unimplemented` and leaves the Rune Pool untouched (no fabricated resources).
- `pnpm --filter @rift/rules coverage:cards` reports scripted vs manual cards.

## Purity exemptions (N2)

The contract's literal wording is “every exported function is `(state, input, ctx) → result`;
never mutate inputs”. The implementation follows the same boundary as `@rift/engine`, with two
documented exemptions:

1. **Draft-only mutators.** `applyRulesIntent` clones the incoming `Room` once
   (`host.cloneRoom`) and all internal helpers (`advance`, `runCleanup`, `primitives.*`,
   `appendChainItem`, `beginShowdown`, …) mutate only that draft. They are exported because
   tests and later waves compose rule steps; none of them may be called on a caller-owned room
   without cloning first. The read-side API (`turnState`, `whoMayAct`, `legalIntents`,
   `explainIllegal`) never mutates.
2. **Static registries.** The card-script, prompt-handler, intent-handler, task-handler,
   effect-op and rule-hook tables are module-level maps/`Record`s of functions filled at import
   time (or by test registration). They hold **no game state**; game state is always the `room`
   argument. `clearCardScripts()`/the hook unsubscribe functions/test registration only exist for
   suite isolation.

No `Date`, `Math.random`, timers, I/O or hidden globals are used; time/rng/ids come from
`RulesContext`/`RulesHost`.

## Extending the engine (R2)

Every hot spot is a small static registry. "Registration" is an import-time table entry (or a
static `Record`), never game state. Add behaviour only in the file named for your domain.

| Extension | File to add/edit | One-line registration |
|---|---|---|
| Intent behaviour | `src/intents/{play,activate,move,pass,end-turn,choose,manual-done}.ts` | already in `INTENT_HANDLERS` (`src/intents/index.ts`); edit your handler only |
| Verdict / explanation | `src/legality/{play,activate,move,pass,end-turn,choose,manual}.ts` | `EXPLAIN_VERDICTS` in `src/view/explain.ts` already points at it; add a row only for a new intent type |
| Wire-shape validation | `src/legality/wire/<intent>.ts` | export a `WireValidator`; `WIRE_VALIDATORS` in `src/legality/intent.ts` already points at it |
| Legal-intent enumeration | `src/view/legal-{play,activate,move}.ts` | `legalIntents` (`src/view/legal.ts`) calls your helper |
| Prompt handler | `src/prompts/<domain>/index.ts` (+ a handler module next to it) | `registerPromptHandler(<domain reason>, fn)`; `src/prompts/index.ts` already imports the three domain barrels |
| Prompt reasons | `src/prompts/<domain>/reasons.ts` | add a constant to `{PLAY,COMBAT,EFFECTS}_PROMPT_REASONS`; emitters/handlers import it |
| Outstanding Task | `src/timing/tasks/{play,combat,custom}.ts` | `registerTaskHandler("<kind>", fn)` at import; `tasks/index.ts` already imports the files (`play` = R2-play, `custom` = R2-effects) |
| Trigger/replacement/layer hook | your `src/triggers|replacements/**` file | `registerAdvanceHook("beforeTasks"|"afterResolve"|"phaseStart", fn)` / `registerCleanupHook("afterStep3a"|"afterStateChange", fn)` / `registerFinalizeHook(fn)` (337.1 “when played”) |
| Replacement/prevention effect | your `src/replacements/**` file | `registerActionInterceptor((room, step, proposal) => proposal \| null)`; every game-action primitive in `actions/**` calls `interceptAction` first (367–375) |
| Effective Might / keywords (layers) | `src/layers/index.ts` | extend `effectiveMight`/`effectiveKeywords` (475–479); `legality/timing`, combat and cleanup already call them |
| Owner-relative zone move | host call only (no engine edit) | `host.moveCardToOwnerZone(room, cardId, "hand"|"trash"|"deck"|"banished", position?)` |
| Effect op | `src/effects/ops/<op>.ts` | `registerEffectOp("<op>", fn)`; import the file in `src/effects/ops/index.ts` |
| Card script | `src/cards/<setCode>/<slug>.ts` | `registerCardScript({...})`; import it from `src/cards/<setCode>/index.ts` |
| Public export | `src/api/{core,play,combat,effects}.ts` | add `export …` to your own barrel only |

RulesHost is frozen after R1-SPLIT-R (R1-PREP-E only adds `moveCardToOwnerZone`): it already
exposes generic zone moves (top/bottom), owner-relative moves, banish, reveal/hide, look-at-top,
search, attach/detach, control transfer, counters, token creation and return-to-hand. New engine
helpers are not needed for R2 card text.

Hook semantics (no hooks registered ⇒ byte-for-byte R1 behaviour; the full table is at the top
of `src/timing/hooks.ts`):
`beforeTasks` runs before Outstanding Tasks each auto-advance iteration (303.2.a trigger queue),
`afterResolve` after a pending chain item finalizes + cleans up, `phaseStart` before each phase
switch; `afterStep3a` after Special Cleanup inserts and `afterStateChange` before the 322 fixed
point check. `registerFinalizeHook` (`afterFinalize`) runs immediately after an item becomes
Finalized (337.1) and receives the `ChainItem` (R2-effects records the 359.3.e target snapshot
there). A Pending *triggered* item is not finalized directly: `advance` hands it to
`prepareTriggeredItem` (403 choices, 404–405 cost, 407 finalize; 407.3). `registerActionInterceptor` runs at the start of
every game-action primitive (`draw`, `burn_out`, `channel`, `ready`, `exhaust`, `deal_damage`,
`heal`, `kill`, `recall`, `move`, `add_resources`, `gain_points`, `score`, `establish_control`,
`conquer`, `hold`, `create_token`); returning `null` prevents the action, returning a modified
`ActionProposal` replaces it (367–375). `endShowdown` lets `conquer` own the single
`establish_control` event (348.2.a / 468.5.d, NEW-2), while `conquer` still runs the nested
`establish_control` interceptor.

Test ownership: `test/rules/{play,combat,effects}/`, `test/property/{play,combat,effects}.test.ts`
(shared generators in `test/property/generators.ts`), `test/cards/`, `test/examples/`. The
scenario DSL exposes `expectPrompt/expectEvents/expectObject/expectScore` plus `register(script)`.
`pnpm --filter @rift/rules test` now runs the default suite **and** the frozen-host smoke suite
(`test:host` is kept as an alias); the R2 integration hand-off is 62 files / 570 default + 1
host; the wave-R1 hand-off was 27 files / 137 default + 1 host
(the R1 baseline was 96 default + 1 host).

## How to add a rule

1. Find the rule number in `packages/rules/corpus/core-rules-2026-10-09.txt` (and errata).
2. Put the function in the owning module above (timing/cleanup/actions/legality/scoring), take
   `RulesStepContext` (`ctx`, `host`, `events`) and **mutate only the draft**.
3. Emit a `GameEvent` for every observable change; never read `Date`/`Math.random`.
4. Push a `Prompt` for Limited Actions when a choice is genuinely open (411.2); otherwise a
   single legal choice may be auto-selected. Register the handler with `PROMPT_REASONS`.
5. Add a `[R<rule>]` vitest under `packages/rules/test/rules/`, then run the suites below.
6. If the rule affects the auto-advance, prove the loop still stops: `advance` returns
   `loop_guard` after 500 steps, and 322/317.2.f bounds surface `loopGuard` as a Verdict.

## How to run tests / coverage

```bash
pnpm --filter @rift/rules test            # strict layer unit + golden + property tests
pnpm --filter @rift/engine test           # 40 original sandbox parity tests + strict hook tests
pnpm typecheck                            # every workspace package
cd packages/rules && node scripts/rules-coverage.mjs --check
pnpm --filter @rift/rules coverage:rules  # write docs/rules-coverage.md
pnpm --filter @rift/rules coverage:cards  # write docs/cards-coverage.md
```

Scenario DSL v1 lives at `packages/rules/test/scenarios/dsl.ts`; it builds a real strict duel at
Main Phase from `createInitialGameState` plus the real engine host and exposes
`as/play/activate/move/pass/endTurn/choose/manualDone` + `expect*` assertions. 3+ player tests
that the DSL cannot build construct the room directly from `createInitialGameState` (see
`test/rules/burn-out.test.ts`).

## Known limitations

Fixed in R2 (removed from this list): minimal combat damage (467.2.c assignment, Tank/Assault/
Shield/Backline and the 468 combat cleanups are in), the single stored Contested applier and
presence-proxy control (stored battlefield control 188–190, 323.10.a via control), F11 team
scoring (472 / 491.8.b per team, shared points and team victory), costs/targets/payment/
triggered-ability ordering/layers/replacements, NEW-12 (unscripted activated abilities are
accepted as `manual:<n>` and resolve in the §6.4 manual window), and add abilities (scripted Add
effects resolve, 430.2/430.5).

Fixed in R4-engine (part A, removed from this list): the 317.2.c expiration keep-list, Repeat
execution and play-time choices, effective Deflect values, 054.1 self play restrictions,
limited-play locations, the Ambush location merge, delayed replacement choices, attached
replacement sources, kill/die last-known information, Deathknell event choices, built-in Equip,
the Weaponmaster/Quick-Draw/Deploy keyword triggers, and attached triggers / Effect-Text passives
(`rules-text` wrapper for 718.2).

Remaining:

- **491.8.a teammate invitations** (a teammate acting on the Turn Player's turn) are not
  implemented; the priority domain owns them.
- **Concede** is wired through `rules_concede` (R2-int, 649–652). 652.2 battlefield replacement
  only emits an event; a removed Turn Player's turn hand-off is a RULES-QUESTION.
- **Restore drops mid-resolution context.** `restoreRulesState` rebuilds only turn fields, so a
  strict room whose `RulesState` is lost mid-chain resumes at Main with empty
  chain/tasks/triggers/effects/pools/`contested`/`scoredThisTurn`, no stored battlefield control
  (the presence proxy applies) and no `combatProgress`.
- **Engine host side effects (host frozen).** `settleVictory` (cleanup step 1) silently moves
  unattached non-Deploy gear from battlefields to the base before step 5, so that recall emits no
  `recall` event; `host.unitsAt`/`hasUnitAt` count facedown cards (the rules layer never calls
  them directly any more — use `state/presence.ts`).
- **Effects coverage.** (R3-engine fixed 371.2 / 372 / 373, 355.11 / 355.14, Show Off 832 and
  Flow 829.) Still open: player-level restrictions in
  `restrictionFor`, copy (446), hide as an effect (422), 439 Replace,
  433.1.b damage doubling, "the Nth time" triggers, triggers of cards outside the board (385),
  layer dependency ordering (480–481) and trait-altering "becomes" effects are open; some cards
  are still unscripted (manual window) and many scripts are `partial`/`manual` because of these
  gaps. See `docs/cards-coverage.md` and `progress.md`.
- **Play coverage.** 806.4/813.4 conditional Action/Reaction, Reaction Add abilities paying
  applied costs (430.3/204.4.b.1), effect-driven plays placed during a resolution (420.3),
  abilities other players may activate (378/381), card-type-filtered discard costs; mixed-symbol
  Power costs are processed as [C] (RULES-QUESTION 131.3.a).
- **Effect-driven moves** do not apply 449.2.a/464.1 or the 449.2.c recall fallback (only
  Standard Moves and Unit plays consult `combatBarsDestination`).
- `rules_*` intents do not participate in the engine's rewind history; strict multiplayer
  rewind is rejected.
- Burn Out repetition is bounded per `drawCards` call (100 iterations) but a 3+ player room with
  an empty deck and empty trash prompts for every point; 432.3.a repeats until victory.

## Per-domain R2 notes

Each wave-R2 owner documents its domain in its own file (decisions, merge contracts,
RULES-QUESTIONs); the integration notes above supersede their merge-wiring sections:

- [`docs/rules/play.md`](rules/play.md) — R2-play: process of play 349–359, costs/payment 356–357,
  activated abilities 376–381/399+, Standard Move 449–455.
- [`docs/rules/combat.md`](rules/combat.md) — R2-combat: cleanups 318–324, combat 461–468,
  scoring 469–474, victory.
- [`docs/rules/effects.md`](rules/effects.md) — R2-effects: Effect DSL 412–448, triggers 382–398,
  replacements 367–375, layers 475–479, card scripts.
- [`docs/rules/int.md`](rules/int.md) — R2-int: per-viewer redaction of `Room.rules` (privacy
  matrix), realtime routing of `rules_*` / `set_lobby_rules_mode` / rejections, `rules_concede`,
  i18n reason and prompt strings.
