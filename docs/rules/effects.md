# Effects domain (`R2-effects`)

Owner: **R2-effects** — Effect DSL interpreter 412–448, triggers 382–398, replacements
367–375, layers 475–482 and card scripts.

## Integration status (R2 merge)

- Synthesized `attack`/`defend`/`attack_declared`/`defend_declared` events were removed; R2-combat
  emits them (`WHEN_YOU_DEFEND_HERE` matches the player-level `defend` with `data.player: true`).
- The default flush order is Turn Order (303.2.a / 383.3.d.1); only `beginCombat` passes the
  Combat Chain order.
- 403–407 for triggered items moved to `play/triggered.ts` (single path, before Finalization);
  `triggers/finalize.ts` keeps the 359.3.e snapshot and the 337.4 Priority reset.
- `executeCardScript` returns `await` and the item stays on the chain until the resumed
  continuation finishes (`finishResolution`) — Lead TODO 1 is done.
- `effectiveMight` is no longer floored (143.2.c.1, example of 479.4.c); references clamp in `mightOf`, combat
  in `combatMight`. The RULES-QUESTION(479.4.c) below is resolved.
- Candidate spells/abilities exclude Pending chain items (355.9.a.2).

## R3-engine additions (how a card script uses them)

Wave R3 closes engine gaps for the card agents. Everything is additive: no existing op,
selector field, condition id, cost convention or prompt contract changed meaning. Tests live in
`packages/rules/test/rules/effects/*.test.ts` (one file per capability, titles cite `[R…]`,
`[EX:…]`, `[C:…]`).

### Group targeting (355.11) and "any number of" (355.13)

`Selector.group` is a requirement the chosen objects meet **as a whole**; `Selector.anyNumber`
means zero or more (no upper count). On play, `requiredChoices` puts the group on
`spec.data.group` and `validateChoices` rejects a group that does not qualify
(`illegal_target` / 355.11.a); a `play.choice` prompt answer that breaks it is rejected and the
prompt stays pending. On resolution, when the remaining legal targets no longer qualify, the
controller picks a **maximal** legal subset of the original targets (355.11.b / 355.11.b.1 —
the official examples accept subsets of different sizes, so "maximum … for that subset" is read
as maximal by inclusion). One maximal subset is kept automatically; otherwise an
`effects.resume` `choose-target` prompt (`rule: "355.11.b"`, `data.ask.subsets`) is opened and
any other answer is rejected. Dropped targets are no longer affected by later references to
the same key (`group_subset` event).

```ts
// Fox-Fire: "Kill any number of units at a battlefield with total Might 4 or less."
{ op: "kill", target: { chosen: true, cardType: "unit", zone: "battlefield", anyNumber: true,
  group: { sameLocation: true, totalMight: { op: "lte", value: 4 } } } }
// Bellows Breath: "Deal 1 to up to three units at the same location."
{ op: "deal", amount: 1, target: { chosen: true, cardType: "unit", maxCount: 3, group: { sameLocation: true } } }
// Tricksy Tentacles: "… enemy units with the same controller and a total Might of 8 or less …"
group: { sameController: true, totalMight: { op: "lte", value: 8 } }
```

"Each of up to N units" was already `maxCount: N` (Singularity).

### Damage split (355.14, 418, 715.3) — `deal_split`

`{ op: "deal_split", amount, target, source? }`. Each chosen unit is a Target (355.14.a), chosen
on play up to the damage available then, Bonus Damage included (355.14.c / 715.3;
`target.maxCount` can only lower that cap). At least one target unless `target.anyNumber` or
`target.maxCount` is set. An amount that depends on another choice (Alpha Strike's "its Might")
is asked after that choice is bound. On resolution: illegal targets are dropped (359.3.e) and a
group is re-checked (355.11.b); with more targets than damage the controller keeps exactly one
target per point (`choose-target`, `rule: "355.14.h"`, 355.14.h.1); the division is asked with a
`damage-assignment` `effects.resume` prompt (`data.ask = { answer: "split", total, targets,
minEach: 1 }`), answered with `{ assignments: [{ targetId, amount }] }` (every target ≥ 1, sum =
total; otherwise `invalid_choice` and the prompt stays pending). One target takes everything and
N targets for N damage take 1 each without a prompt. The damage is dealt from `source`
(418.6.b.3) or the effect's source.

```ts
// Scorched Earth: "Deal 5 damage split among units at a single battlefield."
{ op: "deal_split", amount: 5, target: { chosen: true, cardType: "unit", zone: "battlefield", group: { sameLocation: true } } }
// Volibear, Furious: "When I attack, deal 5 damage split among any number of enemy units here."
{ op: "deal_split", amount: 5, target: { chosen: true, cardType: "unit", controller: "opponent",
  zone: { kind: "chosen", ref: "here" }, anyNumber: true } }
// Alpha Strike: use explicit refs so the amount can read the chosen unit.
{ op: "deal_split", amount: { kind: "might", selector: { targetRef: "friend" } },
  source: { chosen: true, targetRef: "friend", cardType: "unit", controller: "self" },
  target: { chosen: true, targetRef: "foes", cardType: "unit", controller: "opponent", zone: "battlefield" } }
```

UI note (R2-int lane): apps/play renders `damage-assignment` only for
`combat.damage_assignment`; a split prompt carries its total/targets on `prompt.data.ask`.

### Replacement decisions (371.2, 372, 373, 374)

Optional replacements are written with a top-level `may` (or an optional cost) as `replace`;
nothing else changes for mandatory ones:

```ts
// "… you may recall it instead."
{ kind: "replacement", matches, replace: { op: "may", effect: { op: "recall", target: EVENT_SUBJECT } } }
// Unlicensed Armory (delayed, via the `replace` op): "… you may pay [Fury] to heal it, exhaust it,
// and recall it instead." — an unpayable cost is not offered (the unit just dies).
{ op: "replace", matches: { type: "kill", subject: { targetRef: "target:0" } },
  replace: { op: "cost_then", optional: true, cost: { power: { Fury: 1 } }, effect: { op: "seq", effects: [heal, exhaust, recall] } } }
```

When one optional or several replacements apply to a `kill`, `deal_damage` or `recall`, the
event is **held** (370.1.c — it has not happened) and a player decides: several → the
controller of the affected object picks the one applied first (`choose-mode`, `rule: "372"`;
372.1/372.2 for players/uncontrolled battlefields; `$none` is offered when they control only
optional ones); an optional one → its controller answers `yes-no` (`rule: "371.2.a"`). A
declined optional replacement has not been applied (371.2.b: its "once each turn" use is kept)
and the original action then happens. Inside a resolution the decision is an `effects.resume`
prompt asked right after the instruction that caused the event; outside one (cleanup deaths,
combat damage) it is an `effects.replacement` prompt (`data.queue`, simultaneous events one at a
time, 373) and the waiting cleanup runs afterwards (321). Events: `replacement_held`, then
`replaced` or the original action's event.

Limits (documented, not guessed): other actions and actions caused while a replacement is being
applied use the deterministic fallback (mandatory ones in timestamp order, optional ones not
applied); 373's "which simultaneous event first" uses the instruction/cleanup order (the cleanup
does not expose its batch of simultaneous deaths); a held event settles after the rest of its
instruction, so "kill two units" with one held death is not simultaneous (370.1.a.2).

### Show Off (832)

Declare it with the `showOff(selector, count?)` builder (`src/cards/dsl.ts`; a passive custom
modifier `show-off`). The play layer turns it into the play-time choice `"showOff"`
(`choose-card`, 0..count, `rule: "832.1.c"`, not a Target) among the controller's hand cards
(the card being played excluded; revealing emits `reveal`) and friendly board objects
(`show_off`) matching `selector` (zone and controller are filled in). When the item finalizes the
shown-off object's Might and costs are noted (832.1.d.1 — later changes are ignored) on
`choices.$showOff` and, for permanents, on `objects[id].showOff`. Linked text reads them with the
condition `SHOWED_OFF` (`custom("showed-off", { count? })`) and the amount
`{ kind: "shown-off", property: "might" | "energy-cost" | "power-cost" | "count" }`.

```ts
// Primordial Roar: "[Show Off] a unit. If you showed off a unit, deal damage equal to that unit's Might to a unit."
abilities: [showOff({ cardType: "unit" }),
  { kind: "spell", effect: { op: "if", condition: SHOWED_OFF,
    then: { op: "deal", amount: { kind: "shown-off", property: "might" }, target: aUnit() } } }]
// Gutter Guardian: "[Show Off] a card with [Hidden]. When you play me, if you showed off, [Add] [Rune]."
abilities: [showOff({ keyword: "Hidden" }),
  { kind: "triggered", trigger: WHEN_PLAYED, condition: SHOWED_OFF, effect: { op: "add", resources: { power: { any: 1 } } } }]
```

### Flow (829)

Nothing to script: the printed `[Flow][cost]` is parsed from the card text. A spell in its owner's
trash may be played for its Flow cost (829.1.c.1, an alternate cost replacing the base cost;
`legalIntents` lists it; its own timing still applies, 829.1.b.2). Once finalized it is banished
instead of leaving the chain to the trash (829.1.b.1, `ChainItem.leaveChainTo = "banished"`; also
when countered). `grant_keyword` "Flow" may target a spell in a trash ("give a spell in your trash
[Flow] equal to its cost this turn"): its Flow cost is its printed cost. Cost modifiers such as
Stargazer use the usual `cost` modifiers. Limit: several printed Flow costs (829.1.c.3) use the
first.

## R4-engine additions (part A)

Wave R4-engine fixed the effects-side `[BUG]` reproductions (protocol additions in
`packages/protocol/CHANGES.md`, `## R4-engine`):

### Last-known information on kill/die (383.2.c.3.b, 424, 427, 442)

`kill` reads the object before dropping it: the `kill` event `data` now carries `stunned`, `buffs`
and `empowered`. `LastKnown`, `eventLki` and `noteLki` record the same three fields, and
`matchesSelector` falls back to the event/LKI when the rules object is gone. A die-event subject
with `{ stunned: true }` / `buffed` / `empowered` therefore still matches (Storm Raptor), and the
trigger reads the leaving object's old zone (383.2.c.3.b).

### Delayed replacement choices (359.3.f.3.a, 375, 391.3)

`matchesProposal` evaluates a replacement's `matches` with the creating ability's stored
`choices`, so `subject: { targetRef: "target:0" }` in a delayed replacement refers to the object
chosen when the replacement was created (Highlander, Counter Strike, Unleashed's death
replacement). `replacementSources` also enumerates attached cards' Effect Text (718.3 / 719.1), so
an attached card can contribute a replacement effect.

### Deathknell choice environment (355.7, 808)

`ChoiceContext` / `ChoiceBindContext` / `CoreInput` accept an optional `event`; the play-time
choice scan sets `env.event` and seeds `$lki[event.cardId]` from `eventLki`, and `planTrigger`
passes the trigger's event. A Deathknell can therefore choose a Target "here" in the zone the
source left (Mournful Spirit).

### Attached cards (718.2, 718.3, 719.1) and attachment keywords

- `executeCardScript` resolves the built-in `equip:<n>` ref by running the synthetic attach
  (818.1.c.2) instead of the manual window; all catalog Equipment use it.
- Triggered abilities in an attached card's Effect Text are appended to its Top-Most card's source
  with `TriggerEntry.scriptName`; the host stays `sourceObjectId` ("self/here/host") while
  execution uses the attached script. An accepted optional trigger keys its once-per-turn limit by
  the attached script name too (383.3.e.1).
- Ordinary passives of an attached card are its Effect Text and apply (718.3); its printed Rules
  Text is Inactive (718.2). Mark a passive that models printed Rules Text with
  `{ kind: "custom", id: "rules-text", params: { modifier } }`: the wrapper stays active while the
  card is unattached and is dropped while attached. `targetRef:"host"` resolves to the Top-Most
  card.
- The keyword triggers `Quick-Draw` (`gear_played` attach, 819.1.d / 819.2), `Weaponmaster`
  (`unit_played` optional reduced-cost Equip, 821.1.b/c, for tokens played by effects too) and
  `Deploy` (`hold` by an opponent kills the gear, 830.1.b) are detected through the same source
  list. A Weaponmaster cost also applies 821.1.c.2.b reductions that read the chosen unit
  (Hextech Gauntlets).

### Play provenance (811.6) and damage-kill attribution (429.5.c)

Lane E adds two event facts that card scripts read:

- `unit_played` / `gear_played` (337.2 permanent resolution) and `card_played` (350.1) carry
  `data.playedFromFacedown: true` when the play came from a hidden card (811.6). A trigger matcher
  uses `data: { playedFromFacedown: true }` (Evelynn, Entrancing; Katarina, Reckless; Bone
  Skewer).
- `ObjectRulesState.damageSource` records the object and the responsible player of the most recent
  damage dealt to an object (`deal` / `deal_split` pass the source and their controller;
  combat damage passes the assigning player). Cleanup step 3 passes it to `kill`, so a passive
  kill from lethal damage is attributed to the spell/ability (429.5.c / 429.5.c.1) and combat
  damage to the assigning player (429.5.c.2): the `kill` event gets `sourceObjectId` and
  `data.responsible`. "When you kill …" triggers (Solari Shrine) therefore fire for damage kills.

### Battlefield replacement control (190.6)

A battlefield's replacement ability belongs to the battlefield's controller (190.6.a; the Turn
Player while Uncontrolled, 190.6.b), not automatically to the Turn Player. When the replacement
text names another player as the one who makes its choices — modelled as the `player` of a
`cost_then` replacement (Altar of Blood's "its controller may pay …") — that player controls the
ability (190.6.c): the `usable` payment gate, the `effects.replacement` prompt and the applied
instructions all use that player (371.2.a).

## Files

| Path | Contents |
|---|---|
| `src/effects/env.ts` | `EffectEnv` (plain JSON: controller, source, item, play-time `choices`, resolution `vars`, trigger `event`, `it`, target snapshot), `EvalContext`, last-known information (359.3.e.13) |
| `src/effects/objects.ts` | object/zone helpers: board zones (107), locations, controller/owner, type/tags, costs, battlefield pseudo-objects `battlefield:<zone>` |
| `src/effects/evaluate.ts` | `PlayerSelector`/`ZoneSelector`/`Selector`/`Amount`/`Condition` evaluation, custom-condition registry, XP (728–733), the layer bridge |
| `src/effects/machine.ts` | resumable interpreter (JSON work stack, `ask` → `effects.resume` prompt) |
| `src/effects/execute.ts` | `executeEffect` / `executeAbility` / `executeCardScript` (+ `envFromItem`) |
| `src/effects/targets.ts` | resolution-time targets: bound choices, 359.3.e mistargeting, 758.1, resolution-time picks |
| `src/effects/choices.ts` | `requiredChoices` / `validateChoices` (frozen contract) |
| `src/effects/ops/*.ts` | one module per game action (inverse pairs share one), `control.ts` (`may`/`if`/`for_each`/`repeat`/`choose_mode`/`requires`/`custom`), `seq.ts` |
| `src/triggers/{cursor,match,detect,keywords,finalize,hooks,index}.ts` | event cursor, `EventMatcher` semantics, detection, keyword triggers, 403 finalization, hook registration, `flushPendingTriggers` |
| `src/replacements/interceptor.ts` | the production `registerActionInterceptor` (prevention 438, skip 444, replacement abilities 367–375) |
| `src/replacements/preview.ts` | `previewDamage` (frozen contract) |
| `src/layers/{index,passives,durations,mods,restrictions,costs,bonus,entry,victory}.ts` | effective Might/keywords, active modifiers, durations, effect creation, `restrictionFor`, `costAdjustments`, Bonus Damage, enter-ready replacement, Victory Score adjustment |
| `src/prompts/effects/{reasons,answers,resume,triggers,index}.ts` | `effects.resume`, `effects.order_triggers`, `effects.trigger_choice` |
| `src/cards/dsl.ts`, `src/cards/<SET>/*.ts`, `src/cards/tokens/gold.ts` | script builders and card scripts |
| `src/actions/move.ts` (additive) | `kill(…, source?)` attribution + last-known info on the `kill` event; 719.5 detach on kill |
| `test/rules/effects/*`, `test/cards/*`, `test/examples/*`, `test/property/{effects.test.ts,answerers/effects.ts}` | tests |

## Interpreter

- **Resumable machine (§6.2, 359.3.d, 355.18).** Effects run on an explicit stack of JSON
  frames. An op that needs a decision calls `handle.ask(spec)`: the current frame is re-pushed and
  the continuation `{stack, env}` is stored on `rules.prompt.data` (`reason: "effects.resume"`).
  The handler writes the answer into the top frame (or binds it under the asked key) and resumes.
  Rooms stay JSON round-trippable.
- **Deviation (not in my lane to fix).** `timing/fepr/resolve.ts` treats a resolution that waits
  on a prompt as resolved, so the spell reaches the trash before the remaining instructions run.
  The board result is identical; only event order differs. **Lead TODO:** let `executeCardScript`
  return an `await` status and keep the item on the chain until the continuation finishes.
- **Selectors.** `chosen: true` = a play-time choice stored under `targetRef` (`target:<n>`
  assigned in document order by `registerCardScript`). A selector with `targetRef` but no
  `chosen` is a reference: `"self"`, `"it"` (for_each element / last affected), `"host"`
  (top-most card, 719), `"event"`, `"event-source"`, `"obj:<id>"`, or a choice/variable key.
  Otherwise the selector matches by criteria (355.5.a). Zone refs: `"here"` (source location;
  battlefields refer to themselves, 053.3), `"event-zone"`, `"event-from"`, `"self-zone"`.
  Default zones follow 355.9.a.1/.2 (units/gear on the board, spells on the chain).
  Optional selector extensions (`where`, cost comparisons, `exhausted`, `mighty`, `token`,
  `excludeRefs`, `sameLocationAs`, …) are added by interface merging in
  `protocol/src/rules/domains/effects.ts`.
- **Mistargeting (359.3.e).** On resolution each bound target is re-checked: still meets the
  selector (359.3.e.2), no board↔non-board zone change since the item finalized (snapshot in
  `ChainItem.targetSnapshot`) and not a new object after leaving the board and returning (the
  item id noted in `objects[id].targetedBy` is lost when the rules object is dropped, 359.3.e.4),
  still targetable (758.1). Illegal targets are skipped
  and `mistarget` is emitted; later instructions referencing the same key skip them too
  (359.3.e.14.a). Missing information returns `null` and ignores the instruction (359.3.e.12).
  "If you do" reads `$did` (359.3.e.14.b). LKI is noted before an op moves an object (359.3.e.13)
  and includes `stunned` / `buffs` / `empowered` (424 / 427 / 442), matching the `kill` event.
- **Unbound targeted choices** are asked on resolution (fallback when a flow skipped 355
  binding; R2-play binds them through `requiredChoices`/`validateChoices`).
- `requires` (377.2.b) expresses "use this ability only while …"; `validateChoices` rejects with
  `illegal_action`/377.2.b. `choose_mode` modes guarded by a false `requires` are unavailable.
- `custom` effects/conditions are registries (`registerCustomEffect`, `registerCustomCondition`).
  `{ op: "custom", id: "manual" }` resolves in the §6.4 manual window.

## Game actions (412–446, 456–460, 701–749)

One op per module, all through `actions/*` primitives where one exists (so interceptors fire)
and each emitting a `GameEvent`: draw 414 (burn out 432), exhaust 415, ready 416, recycle 417
(417.5 random order, 417.6 pick), deal 418 (+ Bonus Damage 712–715, valid damage 418.1.e,
source 418.6), heal 419, play 420.3 (limited play: pending chain item, 402.2), move 421/447–455
(355.4.a, 451.2, restrictions), discard 423, stun 424, reveal 425, counter 426, buff/spend_buff
427/701–705, banish 428, kill 429 (attribution 429.5), add 430, channel 431, burn_out 432,
double 433 (479.4.c), swap 434, attach/detach 435–436/716–719, predict 437, prevent 438, replace
(delayed replacement), create 440/179–187 (tokens; `TokenSpec.play` → `unit_played`/
`gear_played` with `data.token`), burn 441, empower/disempower 442–443, skip 444, pay 445 (via
R2-play's `payCost`), recall 456–460, score_points 470.2, gain_xp/spend_xp 728–733,
add/spend counters 741–749, look/search/shuffle, temporary_might/give_might (479.4.b snapshot),
grant/remove keyword 801.3, return_to_hand (056, 186.1, 705), `cost_then` (740.4.a), `choose`,
`reflexive` (387–389), `delayed` (390–393, 359.3.e.16), `continuous` (391.4), `mark`.
`copy` (446), `hide` (422) and 439 Replace are not implemented (manual).

## Triggers (382–398)

- **Detection** turns new events (per-intent cursor on the step object) into `PendingTrigger`s:
  printed triggered abilities of board objects (384.2) and battlefields, appended Effect Text of
  attached cards (718.3 / 719.1, executed from the attached script with the host as source), the
  leaving object's own leave-the-board abilities (383.2.c.3), keyword triggers (Vision 817,
  Temporary 816, Hunt 823, Disarm 831, Quick-Draw 819, Weaponmaster 821, Deploy 830 — refs
  `keyword:<name>:<value>`), and delayed triggers (`delayed:<effectId>`, 393). Trigger conditions
  right after "when" are checked at detection (383.2.a.1); once-per-turn limits use
  `history.effects.limits` (383.3.e, optional ones count when accepted, keyed by the attached
  script name when 718.3 applies).
- **Synthesized events:** `attack`/`defend` (unit) and `attack_declared`/`defend_declared`
  (player) the first time designations appear in a combat (383.4.e/f); `become_mighty` (709).
- **Where:** the `cleanup:afterStep3a` hook (so a trigger from a move/kill/resolution is on the
  chain before step 9 can open a Showdown — the state is Closed, 402.1/323.11) and
  `advance:beforeTasks` (303.2.a). Turn-structure triggers ("start of Beginning Phase", "start of
  Main", "end of turn") fire once per turn when no task/chain work is outstanding, so they resolve
  before the next step's tasks (Temporary dies before scoring, 816.1.b). Phase triggers are "your
  phase" unless the ability's condition says otherwise; delayed ones fire on any turn.
- **Flush** (`flushPendingTriggers`, frozen): turn order from the Turn Player (303.2.a), or
  `[attacker, …, defender]` during a combat (466.2.d.1) / `opts.order`. A player with 2+
  simultaneous triggers answers `effects.order_triggers` (383.3.d; `orderedIds`, first placed
  resolves last). Placed items are `kind:"triggered"`, `origin:"trigger"`, with `triggerEvent`.
- **Finalization (403)** in the `afterFinalize` hook: optional triggers ask "yes/no" (403.1;
  "no" removes it, 383.3.a.2); choices come from `requiredChoices` — one legal option is
  auto-picked, otherwise `effects.trigger_choice`; not enough options removes it (403.4).
  Finalizing a trigger clears a stale Priority holder so the newest item's controller gets it
  (337.4/340.4). A leading cost within instructions (`cost_then` first, 383.3.b/404.1.b.1) is
  paid now or declined (405.2; an unpayable or declined trigger is removed, 383.3.b.1).

## Replacements (367–375) and prevention (438)

One production interceptor: skip effects (444, Draw/Channel Phase), prevention shields
(`objects[id].prevent`, 438.2/438.3, "All" 438.3.c), `{ prevent: X }` replacement abilities, and
replacement abilities whose `matches` holds for the proposed action — the action is replaced by
running `replace` (370.1.b) and its triggers never fire (383.2.c.3.a). 370.2: a replacement being
applied is skipped for the actions it causes (tracked on the step object). 371: once-each-turn
limits. `previewDamage` applies restrictions (467.2.c.10), shields and `{prevent}` replacements
without consuming them; `preventValue` exposes the tracked Prevent Value (438.5). Delayed
replacements match with the creating ability's stored `choices` (359.3.f.3.a / 375 / 391.3), and
attached cards' Effect Text contributes replacements (718.3 / 719.1).

## Layers (475–482)

- `effectiveMight` = base + buffs + `temporaryMight` ("this turn") + `mightMods` (other durations)
  + matching Might passives/continuous effects + attached Might Bonuses (718.4). Increases before
  decreases (479.4.e). `rawMight` is unfloored (479.4.c).
- `effectiveKeywords` = printed + R1 `grantedKeywords` + `keywordGrants` + keyword passives/
  continuous effects − removals (801.3.b). `effectiveKeywordValues` sums values (823.2/831.2).
  The array form (legality/timing, cards in hand) sees printed + object grants only.
- Passives (365.1) of board objects and battlefields; 718.2/718.3/719.1: an attached card's printed
  Rules Text is Inactive, while ordinary passives in its Effect Text apply to the Top-Most card
  and the rest of its text (`targetRef:"host"` resolves to the Top-Most card). A passive modelling
  printed Rules Text is wrapped in `{ kind: "custom", id: "rules-text" }` so it drops while
  attached. `conditional` modifiers implement conditional passives (364.3.a) and Dependent
  Keywords (Level 824, Empowered 828, 727.1.b). Nested evaluations run at depth ≥ 1 with base
  values only (478.1.c loop breaker).
- Durations: "this turn" entries are pruned in the Expiration Step (317.2.c); "this combat" when no
  combat is in progress; "until your next turn" via `expiresAtTurn`. Step 3d deletes a rules object
  only when it carries no persistent state: buffs, base Might (including 0), counters, keyword
  grants, Might mods, prevention, Empowered, paid-additional-cost, hidden/show-off/targeted
  records and a controller survive (801.3.a.3 / 811.1.b / 356.4.f.1); Stunned, designations and
  temporary Might still clear (424.1.a.2).
- `restrictionFor` (frozen): `restriction` modifiers, qualified `be-targeted:enemy|spells|abilities`
  (757.1); "can't beats can" (054.1). `costAdjustments` (frozen): `cost` and `cost-adjust`
  modifiers (Energy/Power; `once` = "next card", consumed on `card_played`, 420.5).
- Bonus Damage (`bonus-damage`, `nextSpell`), enter-ready (`enter-ready`, 369.3), Victory Score
  (`victory-score`), `assigned-last` and `hide-limit` are exposed for the other domains.
- Passive Might amounts may be computed ("+1 for each card in your trash"); a card's own cost
  passives apply while it is in hand (366.2.a, e.g. "[Legion] I cost [2] less").
- Catalog keyword lists include reminder-text / dependent keywords; a script marks those with
  `{ kind: "keyword", keyword, value: 0 }` so they only apply when an ability grants them
  (Clanging Sentry's Disarm, Gustwalker's Level-3 Ganking; 727.1.b, 831.2).
- `ignoredKeywords(room, host, { playerId, action, zone })` (764–767): keywords a player treats as
  Inactive for one action (`ignore-keyword` modifiers, e.g. "You ignore Backline while assigning
  combat damage here").

## Contracts for the merge

- **R2-play** — call `requiredChoices`/`validateChoices` for spells and activated abilities
  (keys `mode`, `target:<n>`, zone/player refs, `x`) and store answers in `ChainItem.choices`;
  `validateChoices` also enforces 377.2.b (`requires`). Mark a paid optional additional cost with
  `choices.additionalCost = true` (or a non-empty `paid.additional`); it is copied to
  `objects[id].paidAdditionalCost` for "if you paid" play effects. Apply `costAdjustments`
  (consume nothing — "once" effects are consumed on `card_played`). Use
  `listActivatedAbilities` (`manual:<n>` for unscripted text, 377.1) for activations; its manual
  effect opens the §6.4 window. `payCost` is called by `pay`, `cost_then` and `play` (cost
  "normal"). The array form of `effectiveKeywords` should become the host form if passives must
  grant keywords to cards in hand. Flip Meditation to `implemented` (and move the golden/
  manual-window/property suites to another unscripted card) once the optional cost is bound.
- **R2-combat** — `flushPendingTriggers(room, step, { order })` detects first, so call it right
  after establishing designations (the default order already puts the Attacker first during a
  combat). Do not emit your own attack/defend trigger events: designations on `rules.objects`
  are turned into `attack`/`defend`/`attack_declared`/`defend_declared` events. Read
  `previewDamage`/`preventValue` for lethal values, `restrictionFor("be-dealt-damage")`,
  `effectiveKeywordValues` (Shield/Assault/Tank/Backline values) and the `assigned-last`
  modifier (Caitlyn). Add `victoryScoreAdjustment()` where the Victory Score is compared.
  The 3d cleanup deletes rules objects without `baseMight`/buffs/counters/grants: please keep
  `empowered`, `prevent`, `keywordGrants`, `mightMods` in that keep-list.
- **R2-int** — resolution prompts carry the interpreter continuation in `prompt.data`
  (`continuation`), including looked-at card ids; redact it for other viewers.
- **Lead / R1 core** — `resolve.ts` await status (see Interpreter). The R1 tests that used
  Treasure Hunter as a vanilla unit register a vanilla override (its move trigger now closes the
  state, 383/402.1); `hooks.test.ts` compares registry counts to the production baseline;
  `activation.test.ts` expects the scripted Add effect to add Energy (430.2/430.5);
  `expiration.test.ts` clears the chain after the synthetic trigger is placed.

## Protocol notes (`packages/protocol/src/rules/domains/effects.ts`)

All additions are optional: `EffectsEffectOp` (`spend_buff`, `cost_then`, `requires`,
`reflexive`, `delayed`, `continuous`, `remove_keyword`, `choose`, `add_counter`,
`spend_counter`, `give_might`, `mark`); interface merging adds optional fields to `Selector`,
`EventMatcher` (`subject`, `from`, `player`) and `TokenSpec` (`tags`, `play`);
`EffectsObjectFields` (`empowered`, `prevent`, `keywordGrants`, `mightMods`,
`paidAdditionalCost`, `targetedBy`); `EffectsHistoryFields.effects` (`limits`, `marks`, `replacements`,
`played`); `EffectsChainItemFields` (`effect`, `triggerEvent`, `sourceName`, `optional`,
`mayDecided`, `targetSnapshot`, `resolutionChoices`, `repeatExecutionsDone`). R4-engine also adds
`CardScript.repeatHandled` (820.1.d / 820.3). New prompt reasons: `effects.resume`,
`effects.order_triggers`, `effects.trigger_choice`. New events: `trigger`, `trigger_removed`,
`trigger_declined`, `mistarget`, `replaced`, `prevented`, `skip`, `skip_created`, `attack`,
`defend`, `attack_declared`, `defend_declared`, `become_mighty`, `might`, `stun`, `buff`,
`spend_buff`, `empower`, `disempower`, `counter`, `banish`, `return_to_hand`, `recycle`,
`discard`, `burn`, `predict`, `look`, `search`, `shuffle`, `reveal`, `attach`, `detach`,
`swap`, `grant_keyword`, `remove_keyword`, `gain_xp`, `spend_xp`, `pay_points`,
`counter_added`, `counter_spent`, `delayed_created`, `continuous_created`, `replacement_created`.

## Card scripts

Fixture deck: implemented — Treasure Hunter, Rebuke, Defy, Astral Heron, Gust, Whiteflame
Protector, Stellacorn Herder, En Garde, Riven The Exile, Riven Broken Blade, Altar to Unity,
Back-Alley Bar, Fortified Position, Grove of the God-Willow, Gold (token). Partial — Caitlyn
(combat assignment order is R2-combat's), Blade of the Exile (Equip alternative cost/timing),
Reckless Innovator (Accelerate; [Chaos] payment via payCost), Clockwork Keeper (optional
additional cost), Aspirant's Climb (host Victory Score), Bandle Tree (hide limit). Manual —
Meditation (see contracts).

Cards named in official examples (`test/cards/example-cards.test.ts`): implemented — Void
Seeker, Flash, Singularity, Annie Fiery, Noxian Guillotine ([Legion] read as "another card
played this turn"), Ravenborn Tome, Last Stand, Discipline, Falling Star, Eclipse, Hextech Ray,
Ride the Wind, Retreat, Challenge, Deathgrip, Stupefy, Eclipse Herald, Viktor Leader, Wraith of
Echoes ("the first time … each turn" = once-per-turn trigger), Undercover Agent, Sona Harmonious,
Dr. Mundo Expert, Ultrasoft Poro, Clanging Sentry, Ruin Runner, Master Yi Honed, Gustwalker,
Noxus Hopeful. Partial — Hidden Blade and Zhonya's Hourglass ([Hidden]), Frigid Touch and Feral
Strength ([Repeat]).

### Granted keywords in legality (810.3, 144.4.c.1)

Legality and play code read keywords through the host-aware `keywordsWithPrinted` / `cardKeywords`
(`cardTimingVerdict` takes an optional host), so a keyword granted by a passive or continuous
effect counts: a unit with `{ kind: "passive", modifier: { kind: "keyword", keyword: "Ganking",
target: { cardType: "unit", controller: "self" } } }` in play may make a battlefield-to-battlefield
Standard Move.

## Open RULES-QUESTIONs

- `RULES-QUESTION(103.4)`: the engine does not store which battlefield card sits in which zone;
  the n-th battlefield zone is assumed to be the n-th contributing seated player's battlefield.
- `RULES-QUESTION(479.4.c / EX[258] / EX[287])`: official examples show negative Might;
  `effectiveMight` keeps R1's floor at 0 (lethal damage still needs ≥ 1 damage, 142.4.b).
- Phase triggers without an explicit owner are read as "your phase" (e.g. Temporary 816.1.b).

## Remaining TODOs (prioritised)

1. `resolve.ts` await status (lead) so prompts keep the item on the chain.
2. 372/373 replacement ordering prompts; optional ("may") replacements (371.2).
3. 355.11/355.14 group targeting and damage splitting; player-level restrictions ("opponents can
   only play units to their base") in `restrictionFor` (it only answers object queries).
4. Show Off (832), Flow (829, with R2-play), Ignoring effects (764–767), copy (446), hide (422),
   439 Replace, 433.1.b damage doubling, "the Nth time" triggers (383.1.b), triggers of cards in
   non-board zones (385).
5. 437.1.a reorder prompt for predicted cards; 417.5.a rune recycle order; 425.1.a.3 end of
   Revealed; 3+ player Burn Out prompts inside a resolution.
6. Layer dependency ordering (480–481) beyond timestamp/arithmetic sums; trait-altering
   (base Might "becomes") effects.
7. Scripts for cards named in official examples beyond the fixture deck.
