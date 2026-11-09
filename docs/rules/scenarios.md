# Declarative scenarios: tournament positions and play-test regressions

Owner: scenario lane. A scenario is one file describing a game position, a sequence of player
actions and what must be true along the way. The runner plays it through the real strict engine
(`@rift/rules` with the engine's `RulesHost`, the same path as a `rules_*` wire action) and fails
with a readable diff such as:

```
step 2 (everyone passes until the chain/showdown settles): expected P1 at 3 point(s), got 4;
expected Ezreal, Prodigy dead, got alive at Targon's Peak (Might 3, exhausted)
```

| Piece | File |
| --- | --- |
| Format (types, `defineScenario`) | `packages/rules/test/scenarios/format.ts` |
| Position builder | `packages/rules/test/scenarios/position.ts` |
| Runner (steps, prompts, checkpoints, diffs) | `packages/rules/test/scenarios/runner.ts` |
| Structural validation | `packages/rules/test/scenarios/validate.ts` |
| Repro → scenario converter | `packages/rules/test/scenarios/convert.ts` |
| Headless bot repro (for tests/CLI) | `packages/rules/test/scenarios/repro-fixture.ts` |
| CLI | `packages/rules/scripts/scenario.mjs` → `test/scenarios/cli.ts` |
| Vitest auto-discovery | `packages/rules/test/scenarios/tournament.test.ts` |
| Tooling self-tests | `packages/rules/test/scenarios/scenario-tooling.test.ts` |
| Scenarios | `packages/rules/test/scenarios/tournament/*.scenario.ts`, `regressions/*.scenario.ts` |

The fluent DSL (`dsl.ts`, "v1") is unchanged and still used by the golden/fixture/card suites; use
it for focused rule tests, and the declarative format for whole sequences.

## 1. Why a typed TS object (and JSON too)

Scenario files are `*.scenario.ts` modules with `export default defineScenario({...})`:

- `pnpm --filter @rift/rules typecheck` checks every field name and value (step kinds, checkpoint
  keys, player keys), and editors autocomplete them;
- comments are allowed, which matters when quoting rule text next to a step;
- the converter can still emit them mechanically (it prints a JSON-like object literal).

A `*.scenario.json` file with the same shape is accepted as well (for tools in other languages).
Both are checked at run time by `validate.ts` (unknown keys with did-you-mean hints, integrity
rules) and by the position builder (card names against the catalog).

## 2. Write a new scenario in 5 minutes

1. Copy the smallest existing file, e.g.
   `tournament/ezreal-final-point-draw-then-win.scenario.ts`, to a new `*.scenario.ts`.
2. Fill the metadata honestly (see section 7): `title`, `verification`, `sources`, `notes`.
3. Describe the position: the Turn Player, both battlefields (P1's first), each player's legend,
   points, hand, base and units at battlefields, runes.
4. Write the steps in table language (`{ by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak" }`),
   with `{ settle: true }` whenever "everyone passes until it resolves".
5. Add `expect` to the steps that matter, and a final `{ check: {...} }`.
6. Run it with a trace:

   ```bash
   pnpm --filter @rift/rules scenario test/scenarios/tournament/my-new.scenario.ts
   ```

   The trace shows every engine call, the events it produced and the state after each step,
   including any pending prompt and its options, so the next step is easy to write.
7. `pnpm --filter @rift/rules test` picks the file up automatically.

Minimal example:

```ts
import { defineScenario } from "../format";

export default defineScenario({
  title: "Final Point by Conquer",
  verification: "illustrative",
  sources: [{ label: "Ezreal — RQ Bologna 1st place decklist", url: "https://…" }],
  notes: "Not a real game: cards from the cited list, board invented.",
  position: {
    turn: { player: "P1", number: 12 },
    battlefields: [
      { name: "Void Gate" },
      { name: "Targon's Peak", controller: "P2", units: { P2: ["Pouty Poro"] } },
    ],
    players: {
      P1: { legend: "Ezreal, Prodigal Explorer", points: 7, base: ["Ezreal, Prodigy"], scoredThisTurn: ["Void Gate"] },
      P2: { legend: "Annie, Dark Child", points: 6 },
    },
  },
  steps: [
    { by: "P1", move: "Ezreal, Prodigy", to: "Targon's Peak", expect: { combat: { at: "Targon's Peak" } } },
    { settle: true },
    { check: { dead: ["Pouty Poro"], points: { P1: 8 }, winner: "P1" } },
  ],
});
```

## 3. Format reference

### 3.1 Metadata

| Field | Meaning |
| --- | --- |
| `title` | One line, what the sequence shows. |
| `event`, `round`, `date` | Where the match or decklists come from. |
| `sources` | `[{ label, url?, timestamp? }]`: VOD (with timestamp), coverage article, decklist page, repro file. |
| `verification` | `"sourced"` (taken from a cited play-by-play/VOD), `"reconstructed"` (rebuilt from a partial source, gaps said in `notes`), `"illustrative"` (not a real game; built from real lists or common lines). |
| `notes` | What is real and what is invented. Required for `illustrative`. |
| `rules`, `tags` | Informational: rule ids exercised, mechanics. |
| `expectFailure` | See section 6. |

### 3.2 Position

The position always starts in the **Main Phase, Neutral Open**, with Priority for the Turn Player
(or `priority`). It is built from the engine's real `createInitialGameState` plus the public
`createRulesState`; no Start of Turn is replayed (the board is authoritative, as in the engine's
restore contract).

| Field | Meaning |
| --- | --- |
| `turn: { player, number? }` | Turn Player and the engine turn counter (each player's turn counts 1; default 5). |
| `firstPlayer` | Turn order (default P1). |
| `priority` | Who holds Priority at the start (default the Turn Player). |
| `battlefields: [P1's, P2's]` | `{ name, controller?, units?: { P1: [...], P2: [...] }, facedown? }`. `controller` is the stored 190.2 control (`null` = Uncontrolled; omit for the 190.4.a presence proxy). Entry 0 is `battlefieldA`. |
| `facedown` | `{ owner, card, label?, hiddenOnTurn? }`: a Hidden card in that battlefield's Facedown Zone (default: hidden on the previous turn, so it can be played now). |
| `players.P1/P2` | `legend` (name or `{ name, exhausted }`), `champion` (still in the Champion Zone), `points`, `hand`, `base`, `trash`, `banished`, `deck` (from the top), `deckFiller` (`{ card?, count? }`, default 20 × "Mega-Mech" under `deck` so draws never burn out), `runes: { ready, exhausted }` (names or `{ Fury: 2 }`), `runeDeck` (default 6 of the legend's domains), `pool: { energy, power }`, `scoredThisTurn` (battlefields already scored this turn, for 473.1.b), `autoPass` (auto-pass preferences per [`auto-pass.md`](auto-pass.md); default none, so every Pass / End turn is an explicit step; converted repros carry the recorded seat's preferences), `name` (display only). |

A unit entry is a card name or `{ name, label?, exhausted?, damage?, buffs?, stunned?, gear?, token?, state? }`.
`gear` attaches gear cards (435); `token: true` creates the token with the engine's token factory
(Sand Soldier, Recruit, Mech, …); `state` merges raw `rules.objects[id]` fields (escape hatch).

Card names are case- and punctuation-insensitive and are resolved through the catalog; a typo fails
with a hint: `Unknown card "Anie, Dark Child" (P2 legend). Did you mean "Annie, Dark Child"?`.

### 3.3 Card and location refs

- A card ref is a `label` from the position (or bound by a step's `as`), or a printed name.
- Narrow a name with qualifiers: `"Pouty Poro@Targon's Peak"`, `"Recruit@base"`, `"Fury Rune@P1"`,
  `"Chaos Rune@exhausted"`, combinable (`"Chaos Rune@P2@ready"`). Locations: `base`, a battlefield
  name or zone id, `hand`, `trash`, `banished`, `deck`, `chain`, `board`.
- Identical copies (same name, controller, zone and state, e.g. two ready runes) are
  interchangeable, so no label is needed; otherwise an ambiguous ref fails and lists the
  candidates.
- A location ref is `base`, a battlefield's printed name, or `battlefieldA`/`battlefieldB` (required
  when both players chose the same battlefield).

### 3.4 Steps

Every step except `settle`/`check` names its actor with `by: "P1" | "P2"`; any step may carry
`note` (shown in the trace), `expect` (a checkpoint after it) and `reject`.

| Step | Engine call |
| --- | --- |
| `{ play, location?, targets?, mode?, x?, choices?, optionalCosts?, pay?, plan?, hold?, as? }` | `rules_play`. The card is looked up in hand, Champion Zone, facedown (location defaults to its battlefield) or any zone the engine permits. |
| `{ hide, at, pay? }` | `rules_play` with `hide: true` (811.1.b). |
| `{ activate, ability?, targets?, ... }` | `rules_activate`; `ability` defaults to the only legal one. |
| `{ move: ref \| ref[], to }` | `rules_move`. |
| `{ pass: true }` / `{ endTurn: true }` | `rules_pass` / `rules_end_turn`. |
| `{ choose }` | `rules_choose` for the pending prompt: card refs, battlefields, `P1`/`P2`, option labels or ids; `true`/`false` for yes-no ("Pay"/"Decline" too); a number for choose-number; `[]` for "none". |
| `{ assign: { ref: amount } }` | Damage assignment (467.2.c) or a split (355.14). |
| `{ order: [refs] }` | Trigger ordering (383.3.d). |
| `{ manualDone: true }`, `{ concede: true }` | `rules_manual_done`, `rules_concede`. |
| `{ intent }`, `{ answer }` | Raw escape hatches (ids are taken literally). |
| `{ settle: true, max? }` | Whoever holds Priority (or Focus in a showdown) passes until the chain is empty and no showdown/combat is open, a prompt or manual window is pending, or the game ends. |
| `{ check }` | A checkpoint without an action. |

`targets` are bound through the card's real choice specs (`requiredChoices`): each ref goes to the
first choice that offers it, so battlefield objects, units, players and zones get the option ids the
engine expects; an inner array (`[["A", "B"]]`) fills one multi-target choice. Targets that the
engine asks for later (play triggers, resolution choices) are answered with `choose`.

`optionalCosts` defaults to `[]` (decline every optional additional cost); `"ask"` omits the field
so the engine prompts (355.1.a). `pay: { exhaust, recycle, poolEnergy, poolPower, exhaustObjects,
discard, kill }` builds an explicit payment plan; by default the engine's automatic plan pays (it
recycles exhausted runes first and may exhaust a rune for [1] and then recycle it for its Power).

`reject: true | { code?, rule? }` means the engine must refuse the step (e.g.
`{ code: "closed_state_requires_reaction", rule: "309.1.a" }`); the room is unchanged afterwards.

## 4. Checkpoints

All fields are optional; every mismatch is reported, not only the first.

| Field | Checks |
| --- | --- |
| `points: { P1: 7 }` | Score. |
| `alive: [refs]` / `dead: [refs]` | On the board / left the board for its owner's trash. |
| `units: { ref: { at, might, damage, exhausted, buffs, stunned, keywords, controller, gear } }` | One object; `might` is the layered effective Might, `at` accepts any location or `hand`/`trash`/`board`/…. |
| `control: { battlefield: "P1" \| null }` | 190.2 control (stored or presence proxy). |
| `chain: [names]` | Bottom (oldest) first; triggered/activated items read `"<source> (trigger)"` / `"(ability)"`; `[]` = empty. |
| `priority`, `focus`, `state`, `turnPlayer`, `phase` | Timing. `state` is `neutral_open` … `showdown_closed`. |
| `prompt: null \| { kind, for, reason }` | Pending prompt. |
| `showdown`, `combat` | `null` or `{ at, attacker, defender }`. |
| `zones: { P1: { hand, base, trash, banished, deckCount, runes, pool, legendExhausted } }` | Name lists are exact multisets, or `{ includes, excludes, count }`. |
| `winner` | `"P1"`, `"P2"`, or `null` (game continues). |
| `events` / `noEvents` | Event types emitted (or not) by this step's engine calls. |

## 5. Running

```bash
# vitest (auto-discovers tournament/** and regressions/**):
pnpm --filter @rift/rules test

# CLI: one file or a whole directory, with a step-by-step trace
pnpm --filter @rift/rules scenario test/scenarios/tournament
pnpm --filter @rift/rules scenario test/scenarios/tournament --quiet   # one line per scenario
```

Relative paths resolve against the directory you ran pnpm from, then the package. Exit code 1 when
a scenario fails or an expected failure unexpectedly passes. Trace excerpt:

```
PASS  Combat showdown with responses: Rebuke bounces Annie, Cleave waits for the Open State  [illustrative]
   3. P2 plays Rebuke targeting Annie, Stubborn
     P2 rules_play(play Rebuke {target:0: [Annie, Stubborn]}) -> ok: chain_append; P2 played Rebuke
     = P1 4 pts | P2 5 pts | turn P1 #8 main | showdown_closed | priority P1 | focus P2 | chain [Rebuke] | combat at Void Gate (showdown)
   4. P1 plays Cleave targeting Pouty Poro
     rules_play(play Cleave {target:0: [Pouty Poro]}) -> REJECTED closed_state_requires_reaction (309.1.a)
```

## 6. Converting a repro (a play-test bug → a regression in minutes)

1. In Practice vs Bot (or solo_lab), reproduce the bug and press **Export repro**
   (`docs/rules/rewind.md`). Without the UI, `scenario make-repro --out repro.json [--actions 80]`
   exports a headless bot game in the same format.
2. List the indices where a position can start (Main Phase, empty chain, no prompt):

   ```bash
   pnpm --filter @rift/rules scenario convert repro.json --at list
   ```

3. Convert from the index just before the interaction:

   ```bash
   pnpm --filter @rift/rules scenario convert repro.json --at 31 --count 13 \
     --out test/scenarios/regressions/my-bug.scenario.ts
   ```

   The converter replays the repro to that index with the engine's `replayStrictRepro`, reads the
   room back into a position (exact deck and rune order, damage/buffs/stun, gear, facedown cards,
   control, labels for duplicate names), then replays the following actions and writes each as a
   readable step (gestures are translated with the engine's `translateGesture`). The last step is
   a checkpoint with the state observed after the export.
4. Edit that checkpoint to what the rules require. If the engine is wrong, add `expectFailure`
   (section 7) quoting the rule; the scenario now fails until the engine is fixed.
5. Run it: `pnpm --filter @rift/rules scenario test/scenarios/regressions/my-bug.scenario.ts`.

Warnings are printed (and written into the file header) when the room at that index has state the
position format does not carry: a non-empty chain, a pending prompt, a showdown/combat in progress,
continuous "this turn" effects, pending triggers/tasks. Pick an earlier index in that case. Shuffles
use the scenario's own seed, not the repro's RNG cursor.

## 7. Expected failures and integrity rules

When the engine provably diverges from the rules, keep the scenario that states the correct
behaviour and mark it:

```ts
expectFailure: {
  reason: "[BUG] what the engine does instead, and where",
  rule: "473.2.c \"These cannot be triggered more than once per turn for a player.\"",
  atStep: 3, // optional: the divergence must show up exactly here
},
```

The runner then reports **XFAIL** (the vitest test passes) while the scenario fails, fails if it
diverges at a different step than `atStep`, and reports **XPASS** (the vitest test fails) once every
step passes: the engine was fixed, so remove `expectFailure`.

Integrity rules for scenarios about real events:

- Never present an invented sequence as a real match. `sourced` needs a cited play-by-play or VOD
  (with timestamp); `reconstructed` says in `notes` what was filled in; everything else is
  `illustrative` and says what it is built from.
- Every scenario cites at least one source (the vitest suite enforces it).
- Use `P1`/`P2`; put a player's name in `players.*.name` only if it appears in the public source.

## 8. Current scenarios

All ten are `illustrative`: built from Regional Qualifier top-cut decklists (Houston Annie, Bologna
Ezreal, Vancouver Diana, Utrecht Azir and Viktor) read from search-result snippets; the coverage
pages themselves could not be fetched from this environment, so no public play-by-play was used.

| File | Mechanics | Status |
| --- | --- | --- |
| `annie-vs-ezreal-rebuke-showdown` | combat showdown with responses, 309.1.a closed-state rejection, Assault | pass |
| `diana-moonfall-vs-vi-ambush` | Reaction (Ambush) on the chain, 337.2 unit resolves at once, -2 Might, multi-unit combat | pass |
| `azir-sand-soldiers-multi-unit-combat` | attack trigger moving tokens in, two-sided damage assignment, conquer trigger | pass |
| `ezreal-final-point-draw-then-win` | 473.1.b draw instead, then the Final Point and a win | pass |
| `viktor-legend-hold-then-conquer` | legend activated ability, token enters exhausted, turn cycle, Hold, Final Point win | pass |
| `diana-tideturner-hidden-swap` | Hide, facedown play with Reaction next turn, play trigger swap, Defender joins | pass |
| `diana-star-crossed-trigger-order` | Reaction spell, two simultaneous triggers ordered (383.3.d), battlefield "may" | pass |
| `annie-legend-ride-the-wind-defense` | play trigger choosing from trash, legend end-of-turn trigger, Action in the opponent's showdown | pass |
| `sigil-of-the-storm-final-point-conquer-trigger` | 473.2.c conquer ability triggers once at Victory Score - 1 | expected failure |
| `moonfall-zero-targets-reasked` | 355.13 zero "up to" targets on play are not asked again | expected failure |

### Engine divergences found

1. **473.2.c — a Conquer ability triggers twice at one point from victory.** When the Final Point
   is replaced by a draw (473.1.b.1), `scoreBattlefield` (`src/scoring/score.ts`) emits
   `score_draw_instead` and an explicit `conquer` event; `triggerMatchesEvent`
   (`src/triggers/match.ts`) maps `score_draw_instead` to its `data.kind` ("conquer"), so every
   "When you conquer" source queues two triggers.
2. **355.13 / 355.5 — an empty "up to" choice is asked again on resolution.** The play-choice
   prompt handler stores `null` for an empty max-1 answer (`src/prompts/play/handlers.ts`) and
   `targets()` treats `null` as unbound (`src/effects/targets.ts`), so the effect opens a second
   choose-target prompt with options computed at resolution (Moonfall could then move a unit that
   entered after it was played).

Interpretation note (not marked as a bug): Annie, Dark Child's "ready up to 2 runes" offers the
opponent's runes as well; the script documents this as deliberate ("the text does not say
friendly").

## 9. Limitations

- Duels only (P1/P2); positions start in the Main Phase with an empty chain.
- Continuous effects ("this turn" Might changes), pending triggers and delayed effects are not part
  of the position (use per-object `state` for persistent object fields).
- The Chosen Champion identity is not tracked on the board (engine gap 19 in `progress.md`).
- Scenario RNG (shuffles, ids) comes from `position.seed`, not from a repro's RNG cursor.
