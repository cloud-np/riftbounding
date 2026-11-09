# Play domain (`R2-play`)

Owner: **R2-play** — process of play 349–359, costs/payment 160–168 / 201–206 / 356–357,
activated abilities 376–381 / 399–407, Standard Move 447–455, recalls 456–460, timing/cost
keywords (805, 806, 810–813, 818–822, 830).

## Files

| file | rules | role |
|---|---|---|
| `src/play/cost-model.ts` | 131, 135.2.e, 163, 356.1–356.6 | `ResolvedCost` (Energy + Power requirements with allowed Domains + object costs), printed cost, `Cost` → `ResolvedCost`, 356 arithmetic |
| `src/play/sources.ts` | 164–166 | Rune Pool + Basic Runes as payment sources |
| `src/play/planner.ts` | 164.2, 357.1, 411.2 | canonical resource plan / explicit plan validation |
| `src/play/cost-objects.ts` | 203.3, 357.2, 415.4, 423.1.a | exhaust / kill / discard / points / XP costs, candidates, forced vs prompted choices |
| `src/play/payment.ts` | 165–167, 203, 357 | **`canPayCost` / `payCost` contract**, `planPayment`, `applyPayment`, atomic `checkpoint`/`rollback` |
| `src/play/cost-text.ts` | 135.2.e, 204.1.b, 204.2, 377.1, 818.1.c, 820.1.c | printed cost text → `Cost` (unscripted abilities, Equip, Repeat, “as an additional cost”) |
| `src/play/additional-costs.ts` | 204.2, 356.2, 805, 809, 820 | additional costs (keyword-derived, printed, registered, providers) |
| `src/play/total-cost.ts` | 356 | Determine Total Cost (base modifications → additional → increases → discounts → total modifications) |
| `src/play/choices.ts` | 355.3–355.13, 411.2, 811.1.d.2 | drives R2-effects' `requiredChoices` in rule order; bound / forced / empty / pending |
| `src/play/core.ts` | 355–358.2 | steps 2–5 shared by cards and abilities (`planCore`) |
| `src/play/process.ts` | 349–359, 420.3 | `planCardPlay` (the play verdict), `executeCardPlay`, Pending items, 358.5 undo |
| `src/play/activation.ts` | 376–381, 399–407, 430.2 | `planActivation` (the activation verdict), `executeActivation`, Add abilities |
| `src/play/abilities.ts` | 164.2, 204.1.b, 377.2.b, 818 | the activated abilities of an object (scripted, manual, Basic Rune, Equip) |
| `src/play/keywords.ts` | 135.2.d.3, 135.2.e.7, 801–803, 819.1.b | card-level keywords from rules text |
| `src/play/keyword-helpers.ts` | 812, 821 | `legionActive`, `recordFinalizedCard`, `weaponmasterEquipCosts` |
| `src/play/locations.ts` | 355.2, 451.2, 811.1.d.1, 822, 830 | valid play Locations |
| `src/play/permissions.ts` | 354, 356.1, 420.1.a, 811.1.b | where a card may be played from (+ `registerPlayPermission`) |
| `src/play/hidden.ts` | 107.3, 422, 811.1.b | the Hide discretionary action |
| `src/play/triggered.ts` | 399–407 | `prepareTriggeredItem`: a Pending trigger through 403.1/403.4/404.1.b.1/405.2/407 |
| `src/play/control.ts` | 107.3, 190, 451.2 | battlefield presence/control proxy |
| `src/play/prompting.ts`, `src/prompts/play/*` | 411.2 | `play.choice` / `play.cost` prompts and handlers |
| `src/play/request.ts`, `src/play/card-info.ts` | — | intent normalization, CardInfo for cards on the chain |
| `src/legality/{play,activate,move,timing}.ts` | | verdicts shared by the write path, `explainIllegal`, `legalIntents` |
| `src/legality/wire/{play,activate,play-fields}.ts` | contract §3 | wire validation of the new fields |
| `src/intents/{play,activate,move}.ts` | | write path (`verdict → execute`) |
| `src/view/{legal,legal-play,legal-move,explain}.ts` | | read side |

## Process of play (349–359) — rule order

`rules_play` → `playIntentVerdict` → `planCardPlay` (pure) → `executeCardPlay` (draft):

1. **354 / 420.1.a** permission + source zone: hand, Chosen Champion zone, facedown (hidden on an
   earlier turn, 811.1.b), or a registered permission (`registerPlayPermission`, other zones,
   “for [Cost]” / “ignoring its cost”). Otherwise `not_in_hand` / 420.1.a.
2. **358.4 checked up front**: `baseActionVerdict` + 806/813 keyword timing. Card-level keywords
   come from the rules text (see Decisions), plus granted ones (layers), plus permission keywords
   (facedown → Reaction, 811.6) and Ambush's Reaction when the chosen Location is through Ambush
   (822.1.b). Error precedence is R1's: zone → base timing → keyword timing → location.
3. **355.2** Location (`locations.ts`): Base / controlled battlefields; Ambush; Deploy; facedown
   battlefield; 451.2 crowding; `restrictionFor({kind:"play", to})` → `invalid_location`/355.17.b.
4. Restriction layer: `restrictionFor({kind:"play"})` → `restricted`.
5. **355.1.a** optional additional costs: `optionalCosts` ids (validated, 820.1.c.3 no duplicates);
   recorded as `choices["cost:<id>"] = true` before choices are made (820.2, 135.2.b.7).
6. **355.3–355.13** choices from R2-effects (`choices.ts`): bound by the intent (validated against
   the offered options: `illegal_target`/355.9 or `invalid_choice`), forced (411.2 auto-bind),
   none possible (`no_legal_targets`/355.8, 403.3), “up to” with none (355.13 → `[]`), or a real
   choice → **pending**.
7. **356** total cost (`total-cost.ts`), computed even while a choice is pending (lower bound).
8. **357** payment plan (`planPayment`): unaffordable → `insufficient_resources` (420.2.a); an
   explicit plan that does not pay exactly → `invalid_payment`; a real cost-object choice →
   **pending** (`choose-cost`).
9. **358.1** `validateChoices` (when nothing is pending).

Execution: the card moves to the chain as a **Pending** item (354, 354.1 closes the state). If
something is pending, `item.process` records the undo data (zone/index, Priority/Focus/passes,
permission, request) and a prompt opens (`play.choice` / `play.cost`); `advance` stops on the
prompt (312.1.b.1). Otherwise — or when the last prompt is answered — costs are paid (357), the
card is Played and Finalized (350.1/359): `card_played`, `cardsPlayedThisTurn`,
`finalizedCardsThisTurn` (Legion), `finalizeChainItem` (permanents resolve, 337.2/359.2), a paid
Accelerate makes the Unit enter ready without a `ready` event (805.6), cleanup, Priority (337.4)
and the R1 auto-pass unless `hold`.

**358.5**: a failure before the card moves returns the Verdict (nothing changed). A failure after a
prompt answer (e.g. choosing a Deflect unit makes the play unaffordable) undoes the play: payment is
rolled back to a checkpoint, the card returns to its zone **and index**, Priority/Focus/passes are
restored, `play_cancelled` is emitted, and the answering intent succeeds.

`planCardPlay(..., limited)` is the **420.3 Limited play** variant for R2-effects' `play` op: no
Discretionary timing, any zone, the effect's permission (`ignore` / `cost` / `ignoreAll`),
`extraLocations` (355.2.b permissions, "you may play it here") and `requiredLocations` (355.17
mandatory requirements, followed when possible; restrictions still win, 355.17.b).

## Payment (160–168, 201–206, 356–357)

- **Sources**: Rune Pool (166) and each Basic Rune's two Add abilities (164.2.a `[E]: Add [1]`,
  164.2.b `Recycle this: Add [C]` — no exhaust in the cost, so an exhausted rune can be recycled).
  Adds resolve immediately (430.2) and are then spent from the pool (166.2): `exhaust`,
  `add_resources`, `recycle` and one `cost_paid` event.
- **Canonical plan** (411.2: no prompt for resources): Energy from the pool first, then ready
  runes (all equivalent); Power slot by slot, most restrictive requirement first, preferring pool
  Power of the Domain, pool [A], recycling exhausted runes, then ready runes; a ready rune that is
  recycled is exhausted for Energy first when Energy is owed. Recycled runes go to the bottom of
  the Rune Deck (417.1.b).
- **Explicit plan** (`PaymentPlanWire`): resources category (`poolEnergy`/`poolPower`/
  `exhaustRunes`/`recycleRunes`) must pay exactly (`invalid_payment`); object categories
  (`exhaust`/`discard`/`kill`) name the objects.
- **Non-standard costs** (357.2): forced when candidates == owed, prompted (`choose-cost`) when
  more, unpayable (203.3) when fewer. One object may be exhausted *and* killed ("Kill this, [E]").
  A replaced action still pays (203.2/357.2.a). 357.3: a kill cost avoids the play's own chosen
  targets while another candidate exists (an explicit plan that kills a target then is
  `invalid_payment`/357.3).
- **Atomicity**: `payCost` checkpoints the draft and restores it (and the step's events) on any
  failure.
- **Cost conventions** for scripts (R2-effects): `Selector.targetRef: "self"` (or `"source"`) is
  "this/me" (`[E]`, "Kill this"); `Cost.additional["power:self"]: n` is n×[C] of the source's
  Domains (135.2.e.6); `Cost.additional["recycle:self"]: true` is "Recycle this". Any other
  `additional` key is **unsupported → unpayable** (never free). `Amount`s: number, fixed, x
  (`choices.x`), sum/min/max; others are unsupported until the R2-effects evaluator is shared.

## Activated abilities (376–381, 399–407)

Refs (one scheme for `legalIntents`, `explainIllegal`, `rules_activate`):

| ref | source |
|---|---|
| `activated:<i>` | card script, index into the full `abilities` array (F7, R1) |
| `manual:<n>` | R2-effects' `listActivatedAbilities` unscripted entries — **NEW-12 fixed**: accepted, ref recorded, `rules.manual` opens on resolution (`executeCardScript` has no script for the ref) |
| `rune:exhaust`, `rune:recycle` | Basic Rune abilities (164.2), Reaction, executed by the engine |
| `equip:<n>` | `[Equip] <cost>` lines: "[Cost]: Attach this gear to a unit you control" (818.1.c.2), target = unit you control (818.1.b.1); resolves in the manual window until R2-effects resolves it |

Verdict order: source found & controlled (399/378) → on the Board (380) → ref exists (403.3) →
timing (381 + 806/813 from the ability's own keywords) → 377.2.b “Use this ability only while I'm
at a battlefield” → Limit (`once-per-turn`/`per-turn`, history `activationsThisTurn`) →
`restrictionFor({kind:"activate"})` → choices/cost/payment (core). Alternative base costs
(204.1.b, "[1] or [C]") take `baseCost`; without it the first payable alternative is used.
Unscripted costs come from the printed text when the entry's `cost` is empty. Add abilities
(430.2/430.2.a) finalize and resolve immediately with Priority/Focus/passes untouched; Basic Rune
and plain printed `[Add] <symbols>` effects (430.5) are executed by the play layer.

## Keywords

| keyword | rule | implemented |
|---|---|---|
| Action / Reaction | 806, 813 | card-level from text; ability-level from the ability line; granted via layers |
| Accelerate | 805 | optional `[1][C]` (`accelerate`), Unit enters ready (805.6, no `ready` event) |
| Deflect | 809 | mandatory `[A]×value` per opponent target chosen (any Domain) |
| Ganking | 810 | printed or granted (layers) on the Standard Move |
| Hidden | 811, 422 | Hide (`rules_play {hide:true, location}`), facedown play next turn with Reaction, base cost ignored, location forced, spell targets restricted |
| Legion | 812 | `legionActive(room, player, cardId)` (finalized-card history, 420.4.b) |
| Equip | 818 | built-in activated ability |
| Quick-Draw | 819 | inherent Reaction (819.1.b); its attach trigger is R2-effects' |
| Repeat | 820 | optional additional costs `repeat`, `repeat:<n>` parsed from text |
| Weaponmaster | 821 | `weaponmasterEquipCosts` (reduced by [A] only, 821.1.c.3/.4); trigger is R2-effects' |
| Ambush | 822 | location + Reaction there (822.1.b/c, 822.3) |
| Deploy | 830 | battlefield-only gear location (830.1.b) |

## Standard Move / Recalls (144, 447–460)

`legality/move.ts` keeps the NEW-1 table and adds rows (for the lead to merge into
RULES-ENGINE.md): Ganking is read through layers (granted counts, 810.3);
`restrictionFor({kind:"move", objectId, to})` → `restricted` / rule from the restriction
(default 421); a facedown card cannot make a Standard Move (`unit_not_found`/107.3.e);
449.2/451.2 counts only face-up Units (107.3); 449.2.a (3+ players) a battlefield
with a staged Combat is invalid without own Units. `intents/move.ts` pays every exhaust cost
before the single Move action (144.3.c). Recalls: R1's `recall` primitive already ignores move
restrictions (458.3) and keeps damage (460.1); tested.

## Wire / protocol notes (for `packages/protocol/CHANGES.md`)

All additive, optional, in `packages/protocol/src/rules/domains/play.ts`:

- `PlayReasonCode` += `invalid_payment`, `restricted`; `PlayPromptKind` = `choose-cost`.
- `PaymentPlanWire`, `PlayChoiceAliasFields` (`plan`, `optionalCosts`, `targets`, `x`, `modes`,
  `baseCost`) on both `rules_play` and `rules_activate`; `PlayPlayIntentFields.hide`.
- `PlayChainItemFields`: `process?: PlayProcessState`, `optionalCosts?`, `totalCost?`,
  `playedFromFacedown?`; `PlayPermissionWire`.
- `PlayObjectFields`: `hiddenTurn?`, `hiddenBy?`. `PlayHistoryFields`: `finalizedCardsThisTurn?`,
  `activationsThisTurn?`, `playHistoryTurn?` (all reset by `startNextTurn`).
- `PlayLegalIntentsFields`: `playable?: PlayableCardDetail[]` (same order as `playableCardIds`:
  locations, optional costs, cost, `fromFacedown`), `hideable?`.
- `ChainItem.paid` now records what was actually paid (Energy, Domain pool Power, exhausted/
  killed/discarded ids, `additional.{exhaustedRunes,recycledRunes,optionalCosts,power}`); the
  intent's legacy `payment` field is no longer copied into it.
- New events: `cost_paid`, `recycle`, `discard`, `pay_points`, `spend_xp`, `hide`,
  `enters_ready`, `ability_activated`, `play_cancelled`; `card_played` is emitted when the card has
  finished the process (350.1), i.e. after its last prompt.

## Contracts with R2-effects (what the lead must wire at merge)

R2-play **consumes**:

- `requiredChoices(room, host, ability, ctx)`: specs in rule order; re-queried after each binding
  (bound keys may be returned or omitted). Keys are stored in `ChainItem.choices` (`mode`,
  `target:<i>`, `x`, …). `ctx.choices` includes `cost:<id>` markers for chosen optional costs
  (Repeat's extra choices, 820.2). Set `spec.data.hiddenUnrestricted = true` when the text makes
  the facedown battlefield restriction impossible (811.1.d.2/.4). Options bind
  `value ?? objectId ?? cardId ?? playerId ?? zone ?? id`.
- `validateChoices`: called at 358.1 once nothing is pending (not for built-in Equip).
- `costAdjustments(room, host, query)`: query also carries `optionalCosts` and `choices` (extra,
  additive fields) so “if you paid the additional cost, reduce …” can be expressed (356.2.b.1).
  Negative = discount; increases are applied before discounts; floor 0.
- `restrictionFor`: kinds `play` (without `to` = the card, with `to` = a Location), `activate`,
  `move` (`objectId`, `to`).
- `listActivatedAbilities(name, text)`: `manual:<n>` entries should carry `text` (the ability
  line) and `addsResources`; an empty `cost` is parsed from `text`.

R2-play **provides** to R2-effects' `pay` op: `payCost(room, step, player, cost, {plan?,
sourceObjectId?})` (atomic; `invalid_choice`/357.2 when a cost-object choice is open — use
`costObjectChoice` to prompt, then pass `plan: {kill:[…]}` etc.), `canPayCost`, `planPayment`,
`resolveCost`, `planCardPlay(..., limited)` for 420.3 plays, `recordFinalizedCard` (Legion for
effect-driven plays), `legionActive`, `weaponmasterEquipCosts`, and **`prepareTriggeredItem(room, step, item, {ability?, cost?, decline?})`** for each Pending
trigger before FEPR finalizes it: 403.1 decline → removed; 403.4 no legal choice → removed (not
countered); 404.1.b.1 cost within instructions as base cost, 405.2 unpayable/declined → removed;
a real choice → `play.choice`/`play.cost` prompt (resumed by the play handlers); otherwise paid and
`finalizeChainItem`. Returns `"finalized" | "pending" | "removed"` and emits `trigger_removed`.

## Changes outside `src/play/**` the lead should know about

- `timing/fepr/finalize.ts` (`resolvePermanent`, 359.2.c/d): a battlefield Location validated by the
  process of play (item has `totalCost`) is used as is (Deploy 830.1.b.1); R1's presence check
  remains for restored/direct items.
- R1 tests fixed (rule cited in the commit): showdown/combat-seam (pools empty at Main, 167, so
  the play is funded after the turn change), activation (funded plays; `activatable` filtered to
  the unit because Basic Runes list `rune:*`), reaction-permanents (Reckless Innovator has no
  card-level Reaction, 135.2.d.3 — uses Janna, Savior, 813.1.c.1).

## Decisions (with rule citations)

- **Card-level keywords from text** (135.2.d.3 reminder text has no function; 135.2.e.7
  `[Reaction][>]` belongs to the ability): the catalog's `keywords` list includes reminder-text
  and ability keywords (87 cards differ: Seals, Ambush units, Reckless Innovator…). Timing uses
  `printedCardKeywords`. Combat/effects consumers of `info.keywords` may want the same.
- **Bare `rules_play`** defaults: Units/Gear to the Base, Deploy/facedown to their single valid
  battlefield; no optional costs; canonical payment.
- **Control proxy** (190): presence of face-up Units, minus the Contested applier while control
  is not established.
- **legalIntents**: a card is listed when a bare play (or a play at one of its valid locations)
  passes the full verdict; a pending choice still counts (choices exist). `activatable` lists
  every activation whose bare verdict passes (Basic Rune abilities included).

## RULES-QUESTIONs

- **131.3.a**: the catalog stores the Power cost as a count; mixed-symbol costs are processed as
  [C] of the card's Domains.
- **356.4.c / 356.4.d / 356.4.e**: `CostAdjustment` has no component or minimum, so every
  discount applies to the total and per-discount minimums (Eager Apprentice) cannot be expressed.
- **356.4.b**: an [A] discount reduces the most restrictive Power requirement first.
- **411.2**: which Domain of rune pays an [A]/[C] slot is chosen canonically (no prompt); clients
  may send an explicit plan.
- **811.1.d.2**: "explicitly restricts targeting in such a way that makes this impossible" is
  signalled by R2-effects (`hiddenUnrestricted`); otherwise options are filtered to the battlefield.
- **190**: no stored battlefield controller (presence proxy refined by Contested).

## Dependencies / known issues outside this lane

- **R2-combat (`cleanup.ts` step 5)**: must not recall Deploy gear (830.1.b.3) and must skip
  facedown cards (107.3.e) when recalling gear. Also the engine host's `settleVictory` (called in
  cleanup step 1) silently recalls unattached gear from battlefields before step 5 runs.
- **Engine host (frozen)**: `hasUnitAt`/`unitsAt` count facedown Unit cards as present; the play
  layer uses `control.ts` (face-up only) but R1 cleanup/combat still use the host.
- **R2-effects**: resolve `equip:<n>` (attach to `target:0`) instead of the manual window;
  share the selector/amount evaluators with `cost-objects.ts`/`cost-model.ts`.

## Tests

`test/rules/play/` — payment (20), process (28), activation (15), keywords (20), move (6),
wire (4), cost-text (7), triggered (4); `test/examples/play-examples*.test.ts` (19);
`test/property/play.test.ts` (1 property, 25 runs). Official examples covered: 204.1.b, 204.3.a,
206, 355.5.a, 355.5.b, 355.14.c, 355.17.b, 356.1.b.3, 356.2.a.1, 356.2.b.1, 356.4.f.1, 356.4.g,
356.7, 357.2, 357.2.a, 357.3, 355.17 (×2), 358.1, 358.3 (×2), 358.3.a, 358.4 (×2), 359.3.e.10,
377.1, 377.2.b, 430.3, 431.2,
806.3, 811.1.d.2, 811.1.d.4, 812.2, 820.1.d.1, 820.2.a. Not expressible yet (effect execution,
R2-effects): 204.1.c, 204.4, 205, 206.1, 355.11.b, 355.11.b.1, 355.14.h.1, 355.16, 355.17.a,
356.4.c, 356.4.e (RULES-QUESTION), 359.3.e.* / 359.3.f.* (resolution), 811.1.d.3, 811.2, 822.1.d,
459.1 (cleanup).

## Remaining TODOs (prioritized)

1. Wire `prepareTriggeredItem` into R2-effects' trigger flush (R1 `advance` still finalizes any
   Pending item without a prompt directly).
2. 806.4 / 813.4: conditional Action/Reaction that is only fulfilled on the chain (checked at 358).
3. 430.3 / 204.4.b.1: Reaction Add abilities without Priority to pay applied costs.
4. Effect-driven play execution (420.3) beyond the verdict (chain placement during a resolution).
5. 378.1/378.2/381.2/381.3: uncontrolled sources and abilities other players may activate.
6. Card-type-filtered discard costs ("discard a unit"), "spend a buff", "return a gear" costs.
