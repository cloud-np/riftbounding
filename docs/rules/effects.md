# Effects domain (`R2-effects`)

Owner: **R2-effects** — Effect DSL interpreter 412–448, triggers 382–398, replacements
367–375, layers 475–482 and card scripts.

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
  `ChainItem.targetSnapshot`, 359.3.e.4), still targetable (758.1). Illegal targets are skipped
  and `mistarget` is emitted; later instructions referencing the same key skip them too
  (359.3.e.14.a). Missing information returns `null` and ignores the instruction (359.3.e.12).
  "If you do" reads `$did` (359.3.e.14.b). LKI is noted before an op moves an object (359.3.e.13).
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
  printed triggered abilities of board objects (384.2) and battlefields, the leaving object's own
  leave-the-board abilities (383.2.c.3), keyword triggers (Vision 817, Temporary 816, Hunt 823,
  Disarm 831 — refs `keyword:<name>:<value>`), and delayed triggers (`delayed:<effectId>`, 393).
  Trigger conditions right after "when" are checked at detection (383.2.a.1); once-per-turn
  limits use `history.effects.limits` (383.3.e, optional ones count when accepted).
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
without consuming them; `preventValue` exposes the tracked Prevent Value (438.5).

## Layers (475–482)

- `effectiveMight` = base + buffs + `temporaryMight` ("this turn") + `mightMods` (other durations)
  + matching Might passives/continuous effects + attached Might Bonuses (718.4). Increases before
  decreases (479.4.e). `rawMight` is unfloored (479.4.c).
- `effectiveKeywords` = printed + R1 `grantedKeywords` + `keywordGrants` + keyword passives/
  continuous effects − removals (801.3.b). `effectiveKeywordValues` sums values (823.2/831.2).
  The array form (legality/timing, cards in hand) sees printed + object grants only.
- Passives (365.1) of board objects and battlefields; 718.2/724: an attached card contributes only
  host-targeted passives (its effect text). `conditional` modifiers implement conditional
  passives (364.3.a) and Dependent Keywords (Level 824, Empowered 828, 727.1.b). Nested
  evaluations run at depth ≥ 1 with base values only (478.1.c loop breaker).
- Durations: "this turn" entries are pruned in the Expiration Step (317.2.c); "this combat" when no
  combat is in progress; "until your next turn" via `expiresAtTurn`.
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
`paidAdditionalCost`); `EffectsHistoryFields.effects` (`limits`, `marks`, `replacements`,
`played`); `EffectsChainItemFields` (`effect`, `triggerEvent`, `sourceName`, `optional`,
`mayDecided`, `targetSnapshot`, `resolutionChoices`). New prompt reasons: `effects.resume`,
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

## Open RULES-QUESTIONs

- `RULES-QUESTION(103.4)`: the engine does not store which battlefield card sits in which zone;
  the n-th battlefield zone is assumed to be the n-th contributing seated player's battlefield.
- `RULES-QUESTION(479.4.c / EX[258] / EX[287])`: official examples show negative Might;
  `effectiveMight` keeps R1's floor at 0 (lethal damage still needs ≥ 1 damage, 142.4.b).
- Phase triggers without an explicit owner are read as "your phase" (e.g. Temporary 816.1.b).

## Remaining TODOs (prioritised)

1. `resolve.ts` await status (lead) so prompts keep the item on the chain.
2. 372/373 replacement ordering prompts; optional ("may") replacements (371.2).
3. 359.3.e.4 round-trip detection (board → non-board → board) needs an object incarnation stamp.
4. 355.11/355.14 group targeting and damage splitting; player-level restrictions ("opponents can
   only play units to their base") in `restrictionFor` (it only answers object queries).
5. Show Off (832), Flow (829, with R2-play), Ignoring effects (764–767), copy (446), hide (422),
   439 Replace, 433.1.b damage doubling, "the Nth time" triggers (383.1.b), triggers of cards in
   non-board zones (385).
6. 437.1.a reorder prompt for predicted cards; 417.5.a rune recycle order; 425.1.a.3 end of
   Revealed; 3+ player Burn Out prompts inside a resolution.
7. Layer dependency ordering (480–481) beyond timestamp/arithmetic sums; trait-altering
   (base Might "becomes") effects.
8. Scripts for cards named in official examples beyond the fixture deck.
