# Combat domain (`R2-combat`)

Owner: **R2-combat** — cleanups 318–324, combat 461–468 (incl. damage assignment 467.2.c),
scoring 469–474, winning 193–196, battlefields/control 169–172 / 188–190 / 198–200, modes of
play 483–491 (scoring/victory parts) and conceding 649–652.

## Files

| File | Rules | Contents |
|---|---|---|
| `src/combat/begin.ts` | 462–464, 466.1–466.2.f | `combatParticipants`, `beginCombat`, `combatTriggerOrder` (466.2.d.1), `combatBarsDestination` (464.1/464.2 helper for R2-play) |
| `src/combat/designate.ts` | 323.2, 466.2.c.3, 383.4.e, 468.7.a | designations + first-time `attack`/`defend` events, `clearCombatDesignations` |
| `src/combat/keywords.ts` | 807, 814, 815, 826, 424.1.b, 143.2.c | `combatKeywordProfile`, `combatMightBonus`, `combatMight`, `dealsCombatDamage`, `registerCombatContributionFilter` |
| `src/combat/assignment.ts` | 467.2.c.1–467.2.c.10 | `lethalAssignment`, `assignmentTier`, `damageTargets`, `validateAssignment`, `enumerateAssignments` |
| `src/combat/damage.ts` | 467.1–467.3 | side totals, `runAssignments` (auto or prompt), `recordAssignment`, `dealAssignedDamage`, legacy `runCombatDamage` |
| `src/combat/resolve.ts` | 468.1–468.7 | `runCombatCleanup`, `determineCombatResult`, `establishCombatControl`, `endCombat` |
| `src/combat/progress.ts` | 465–468, 468.2/.4/.6 | `continueCombat` state machine, `beforeTasks` resume hook, legacy `runCombatResolution` |
| `src/prompts/combat/damage-assignment.ts` | 467.2.c, 411.2 | prompt handler + `damageAssignmentVerdict` |
| `src/timing/tasks/combat.ts` | 465–468 | `combat` task → `continueCombat` |
| `src/timing/showdown.ts` | 341–348 | 348.2.a "if that player does not already control" |
| `src/cleanup/cleanup.ts` | 318–324 | 323.5 control loss, 323.6/323.6.a, per-battlefield staging, 323.10.a via control |
| `src/actions/control.ts` | 188–190, 170.11, 190.6 | stored control, `battlefieldController`, `loseControl`, `establishControl`, `battlefieldStates`, `battlefieldAbilityController` |
| `src/actions/damage.ts` | 418, 142.3.a | `dealDamage(…, { playerId, combat })` (additive) |
| `src/actions/score.ts` | 470.2, 194.4 | `losePoints` (additive) |
| `src/scoring/score.ts` | 469–474, 491.8.b/g, 474 | scoring, Final Point, Scoring Step snapshot, Hold, victory |
| `src/scoring/teams.ts` | 485.2, 491 | `isTeamMode`, `teamOf`, `teammatesOf`, `areOpponents` |
| `src/scoring/concede.ts` | 195, 649–652 | `concede`, `removePlayer`, `playerLoses`, `playerWins` |

Tests: `test/rules/combat/*.test.ts` (flow, assignment examples, keywords, combat chain,
cleanup/control, scoring, battlefields), `test/examples/combat.test.ts`,
`test/property/combat.test.ts` (+ answerer `test/property/answerers/combat.ts`).

## Decisions

### Battlefield control is stored (188–190)

Control is a constant state (190.5) that only changes when a Showdown/Combat establishes it
(190.4, 348.2.a, 468.5) or when 323.5 / 468.5.b remove it. It is stored on the battlefield's
object entry: `rules.objects[<zone>].controller` (`string | null`; 170 / 199.1: a battlefield is a
Game Object at its own location). A battlefield with no stored entry (legacy room, restored room,
synthetic fixtures) falls back to the R1 presence proxy (190.4.a) **minus the Contested applier**
(190.3.a). Consequences:

- 348.2.a / 468.5: only a player who does not already control the battlefield establishes control
  and Conquers. R1 let a defender who kept its battlefield "conquer" it.
- 315.2.b / 471.2: Hold reads control.
- 323.10.a / 190.3.a: a player applies Contested only at a battlefield they do not control
  (R1 re-applied it for the battlefield's own controller, which then scored a point).
- The Expiration Step's 3d never deletes a battlefield entry.

### Steps of Combat as a resumable state machine (465–468)

`rules.history.combatProgress.stage` (`damage → assign → deal → cleanup → result → control → end`)
survives intent boundaries. 468.2 / 468.4 / 468.6 make the next Task Outstanding only after the
chain items of the previous step resolved: the driver marks `waiting` and a `beforeTasks` advance
hook queues the next `combat` task once chain, triggers, tasks and prompts are empty. 467.3 clears
outstanding tasks and goes straight to the Combat Cleanup (no FEPR between damage and cleanup).
While `rules.combat` is set the turn is in a Showdown State (343.1), so cleanup steps 9/10 cannot
open anything else (462); staging elsewhere still happens (323.7/323.8 are per battlefield).

### Damage assignment (467.2.c)

- Totals: Attacking/Defending units = units at the battlefield holding the designation; each
  contributes `combatMight` unless stunned (424.1.b), printed "I don't deal combat damage.", or a
  registered contribution filter excludes it; negative Might counts 0 (143.2.c).
- Lethal = smallest x ≥ 1 with `marked + previewDamage(x) ≥ max(Might, 1)` (142.4.b, 424.1.c,
  467.2.c.4/.4.a/.5); `null` when `restrictionFor({kind:"be-dealt-damage"})` applies
  (467.2.c.10). Unreachable lethal reports a value above any assignable amount.
- Tiers: Tank 0, normal 1, Backline 2; Tank+Backline → `exclusiveChoices: ["tank","backline"]`
  (467.2.c.8/.9). Tank/Backline come from the layers (`effectiveKeywords`), the unit's own printed
  keyword line (`[Tank]`, `[Backline]` — the catalog keyword arrays are incomplete) and Backline's
  printed functional text ("I must be assigned combat damage last.", Caitlyn/Soraka).
- Legality (`validateAssignment`): with total ≥ Σ lethal every killable unit gets ≥ lethal and the
  excess goes anywhere; otherwise immune units get 0, nobody exceeds lethal (467.2.c.4), at most
  one partial (467.2.c.3) and no damage before every lower tier is lethal (467.2.c.6/.7). A property
  test checks this against an independent permutation model on every vector.
- Exactly one legal assignment → automatic (`damage_assigned`, `auto: true`); otherwise a
  `damage-assignment` prompt (`CombatDamageAssignmentData`, `min: 0`, one option per target,
  `suggested` pre-fill). Wrong answers return `invalid_choice` with the violated rule; the prompt
  stays pending. An optional `exclusiveChoices` answer field pins 467.2.c.8 choices.
- Dealing (467.2.d): assigned amounts are dealt through `deal_damage` interceptors once
  (`data.combat`, `playerId` = assigner, 142.3.a); the replaced amount is therefore dealt exactly
  once, which is what 467.2.c.5's examples require.

### Combat keywords

Assault/Shield (807.1.c/814.1.c) add while the designation is held; printed values come from the
keyword line (`[SHIELD 3]`), granted valued keywords (`"Assault 3"`) add up (807.2/814.2). They are
arithmetic-layer passives, so lethal checks in every cleanup use `combatMight` too.

### Scoring and victory

Once per battlefield per turn, per team in 2v2 (472 / 491.8.b). A Scoring Step snapshot
(`history.scoringSnapshot`: control + occupancy) implements 471.1.a / 491.8.b.1 and the 491.8.g.1
Final Point exception. The Final Point (473.1.b.1) is replaced by a draw (432 Burn Out included);
Conquer/Hold events are emitted even then (473.2, 383.4.d.2.c). The point runs through the
`gain_points` interceptor; `restrictionFor({kind:"score"})` blocks Scoring. Victory thresholds come
from the host (8 / 8 / 8 / 8 / 11, +Aspirant's Climb, 194.3.a); 2v2 teams share points and win
together (491.8.d, 491.6.a.3) through the host's entity scores.

## Events added

`attack` / `defend` (unit or player gained the designation for the first time this combat,
383.4.e), `damage_assigned` (`{assignments, auto}`), `combat_damage` (`dealt` added),
`combat_result` (`{winner, loser, noResult, recalled, units}`), `lose_control`, `lose_points`,
`concede`, `banish`, `battlefield_replaced`, `player_removed`, `lose_game`. `contested` now carries
`rule: "190.3.a"` for single-player arrivals (`"323.8"` when opposing units are present).

## Protocol notes (for `packages/protocol/CHANGES.md`)

All in `domains/combat.ts`, optional fields only; `CombatDamage*` contract unchanged except
optional additions:

- `CombatObjectFields`: `controller?: string | null` (battlefield objects), `assignedDamage?`,
  `assignedBy?`, `attackedThisCombat?`, `defendedThisCombat?`.
- `CombatHistoryFields`: `combatProgress?: CombatProgress`, `scoringSnapshot?: ScoringStepSnapshot`
  (new exported types `CombatProgress`, `CombatProgressStage`, `ScoringStepSnapshot`).
- `CombatPromptAnswerFields.exclusiveChoices?: Record<string, string>`.
- `CombatDamageTarget`: optional display fields `controllerId?`, `damage?`, `might?`; documented
  `exclusiveChoices` values (`"tank"`/`"backline"`, `tier` = first choice).
- `CombatDamageAssignmentData.suggested?`.

## Merge wiring (lead)

- **R2-effects `previewDamage`**: called with `{ targetId, amount, combat: true }` for x = 1…;
  must apply passive + replacement + prevention effects, be pure and (ideally) monotone. The
  dealing side runs the same effects once through `deal_damage` interceptors.
- **R2-effects `restrictionFor`**: `{ kind: "be-dealt-damage", objectId }` (467.2.c.10) and
  `{ kind: "score", playerId, to: zone }` (Scoring).
- **R2-effects `flushPendingTriggers`**: called once at 466.2.d with
  `order = [attacker, …non-defenders in Turn Order from the Turn Player, defender]`. Attack/defend
  triggers should key off the `attack`/`defend` events (emitted before the flush).
- **R2-effects `effectiveKeywords`**: valued keywords as `"Assault 3"`; keep separate instances
  (dedupe currently drops a second identical grant, 807.2).
- **R2-effects `effectiveMight`**: when Assault/Shield are folded into the layers, make
  `combatMight` return `effectiveMight` alone (the `[R807.1.c]` tripwire test fails otherwise).
- **Cleanup hooks/triggers**: Combat Cleanup chain items are awaited (468.2); `combat_result` and
  `combat_end` events are the hooks for "win a combat" / "end of combat" text.
- **R2-play**: `actions/move.ts` still applies Contested from unit presence; it should use
  `controlsBattlefield` (190.3.a.1). Destination checks should call `combatBarsDestination`
  (464.1/464.2). `explainIllegal` for `rules_choose` should consult `damageAssignmentVerdict`
  (today `promptAnswerVerdict` accepts any `assignments`; only the write path validates).
- **Concede**: `concede(room, playerId, step)` is not wired to an intent.
- **Host note**: `host.banish` moves to the controller's banished zone despite its doc; removal
  uses `moveCardToOwnerZone(…, "banished")`.

## RULES-QUESTIONs

- `466.2.c.1`: Contested applier absent from the battlefield → first present player in Turn Order.
- `464.3`: more than two opposing players present → the battlefield's controller defends.
- `464.1`: "not involved … or who don't already have Units" read literally (either bars a move).
- `467.2.c.10`: immune units take damage only as excess once every other unit has lethal.
- `467.2.c.9`: exclusive-choice combinations are capped at 256.
- `190.3.b`: a non-combat Showdown that ends without control established clears Contested
  (literal reading would re-stage Showdowns forever).
- `491.8.c / 190.3.a`: in 2v2 a player does not contest a battlefield their teammate controls.
- `491.8.g.1`: "scored every battlefield" read per player (a teammate's score does not count).
- `652`: what happens to the turn / combat when the removed player is the Turn Player or a
  combatant.

## Remaining TODOs

- 491.8.a teammate invitations (priority domain; outside these files).
- 652.2 battlefield replacement by a token battlefield and 652.2.c (battlefield objects/abilities
  are not modelled; only an event is emitted); 652 turn hand-off for a removed Turn Player.
- 429.5.c.2 kill attribution for Combat Cleanup kills (the `kill` primitive is not in this lane).
- 488 Best-of-3 match flow (series state lives outside the strict engine).
- Restore (`restoreRulesState`) drops `combatProgress`/control; legacy proxy applies.
