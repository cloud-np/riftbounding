# Architecture and extensibility review

Independent review of the Riftbounding monorepo as of commit `41ec263` (branch
`claude/eloquent-faraday-gd595x`, 2026-11-09). Main question: how expensive is the next feature
wave? Particular focus on the strict rules engine `@rift/rules`. Everything below comes from the
code on disk. The docs were checked against it, not trusted.

**Method.** I read the code and grepped it. I built the import graph with a throwaway script (not
committed). I ran `tsc` for every non-Next package, and the test suites of `@rift/rules`,
`@rift/engine`, `@rift/sync`, `realtime` and `play`. I also ran a scratch micro-benchmark of the
strict hot paths (selfplay plus one instrumented random game). No repository file was changed
except this report. Timings come from a 4-core container while three other agents were working,
so treat them as orders of magnitude.

---

## 1. Executive summary

**What is strong.** Adding cards is cheap, and guardrails protect it. The card SDK
(`packages/rules/src/cards/sdk.ts`) uses one file per card. Every registry throws on a duplicate
(`src/registry-table.ts:55-57`). The vocabularies are closed (`KEYWORD_NAMES`,
`RULES_EVENT_TYPES`, `CustomId`) and the integrity tests have teeth. With these, 1,090 cards were
scripted in parallel lanes without collisions.

The core engine is also strong:

- **Purity.** No `Date.now` or `Math.random` anywhere in rules, engine or sync. Every write goes
  through one clone-at-the-boundary entry point (`intents/index.ts:89-132`).
- **Rejections.** A rejection is a `Verdict` that carries a rule number.
- **One source of truth.** The write path, `legalIntents` and `explainIllegal` share the same
  verdict functions.
- **Extension points.** Hooks, interceptors, task handlers and the resumable effect interpreter
  are real. They are not aspirational.
- **Tests and reproducibility.** The test culture is rich: about 2,000 rules tests, property
  tests, nightly self-play and rule-tagged coverage. Seeded RNG and repro export make bugs
  reproducible.

**What will hurt as the game grows.**

1. **Two engines for one game.** The strict engine is chained to the sandbox through a "frozen"
   `RulesHost` that lives in `@rift/engine`. That host leaks sandbox behaviour: it moves gear
   inside `settleVictory`, and it applies Aspirant's Climb by card name. The manual window also
   resolves effects with sandbox mutations that the rules layer never observes.
2. **Stringly-typed seams between packages.** A new decision (prompt) kind has to be taught
   separately to rules, the bot, the gesture translator, i18n and the UI. They agree only through
   string literals and an untyped `prompt.data` bag.
3. **Modes of play are not data.** The strict engine re-derives mode rules from player counts and
   `gameVariant` string checks, while a perfectly good `VARIANT_RULES` descriptor sits unused in
   the sandbox engine.
4. **God-files at the edges.** `BoardInteractionProvider.tsx` is 3,729 lines, `MatchRoomCore.ts`
   3,680 and `matchRuntime.ts` 3,204. New UI interactions and server flows must be woven into
   them.
5. **The test and CI harness is weaker than it looks.**
   - On a clean checkout the engine typecheck fails, because it needs the untracked
     `.recon/oracle`.
   - CI skips every `@rift/engine` test, including the gesture, rewind and host tests.
   - 172 of the 178 rules test files depend on engine source through relative imports.
   - The rules suite takes about 200 s, and 42% of that is module import.

None of this blocks the next wave. Steps 1–3 of the roadmap (§5) are small to medium. They are what turns
R5's long tail (per-turn history, non-standard costs, effect-driven play, copy, control change,
multiplayer) from "edit ten files across six packages" into "add one definition".

---

## 2. Scorecard

| # | Dimension | Score (1–5) |
|---|---|:-:|
| A | Add a card / set / keyword | **4** |
| B | Add an effect op (DSL) | **3** |
| C | Add a prompt / decision kind end-to-end | **2** |
| D | Add a rules mechanic (zone, phase, replacement, layer) | **3** |
| E | Support a new game mode | **2** |
| F | Add a UI interaction | **2** |
| G | Module boundaries and layering | **3** |
| H | Sandbox vs strict duplication | **2** |
| I | State shape and wire format | **3** |
| J | Purity and determinism | **4** |
| K | Performance hot spots | **3** |
| L | Type safety and closed vocabularies | **3** |
| M | Error handling | **3** |
| N | Test architecture and speed | **3** |
| O | Docs vs reality | **3** |

**A. Cards, sets, keywords: 4.**

What makes it easy:

- **One place per change.** A card is one `registerCardScript` file that imports only `../sdk`
  (`cards/sdk.ts`; the import boundary is enforced in `test/registry/integrity.test.ts`). A set is
  a barrel plus one line in `cards/index.ts:11-20`. Trigger-style keywords are rows in a table
  (`triggers/keywords.ts`, `KEYWORD_TRIGGERS`).
- **Static keywords are localized.** For example, `"Deflect"` appears only in
  `play/additional-costs.ts` and `play/keywords.ts`, and `"Ganking"` only in `legality/move.ts`
  and `view/legal-move.ts`.
- **Process is guarded.** `docs/rules/CARD-AUTHORING.md` is precise and backed by tests. Coverage
  regenerates from the registry (`scripts/card-coverage.mjs --check`).

What holds it back from a 5:

- **Escape-hatch code.** About 190 `<set>:` / `core:` custom ids are referenced by 202 card files
  (about 18.5% of cards), backed by about 4,500 lines of imperative code in the set `custom.ts`
  files (`SFD/custom.ts` alone is 1,208 lines).
- **Positional ability refs.** Refs are positions (`activated:<index>` indexes the full
  `abilities` array, `cards/registry.ts:119-122`). They are stored on chain items, repros and
  rewind snapshots, so inserting an ability retargets persisted state. The only guard is the
  documented rule "never reorder".
- **Eager loading.** All 1,119 files under `src/cards` load through a side-effect barrel
  (`api/effects.ts:9`) in every consumer, including the browser bundle and every test file.

**B. Effect ops: 3.** The registry exists (`effects/registry.ts`). The interpreter is resumable,
and an op lives in one file (`effects/ops/*.ts`, 44 op modules plus `index.ts` and `util.ts`). The contract around an op is implicit,
though:

- **Untyped handlers.** `OpHandler` takes the whole `Effect` union (`effects/registry.ts:12`), so
  61 handlers start with `if (effect.op !== "x") return manual`.
- **Choices found by field name.** Play-time choice discovery scans fixed field names:
  `target`, `a`, `b`, `gear`, `to`, `selector`, `source`, `zone`, `location`, `player`, `amount`,
  `times` (`effects/choices.ts:237-251`). A new op whose selector field is named differently
  silently gets no target prompt.
- **Hard-coded child effects.** Child effects are walked by a hard-coded `switch`
  (`choices.ts:284-371`), and op names are special-cased again in `replacements/decisions.ts`
  (lines 135-148) and `play/triggered.ts:59-60`.
- **No completeness check.** A union member without a handler falls back to the manual window at
  runtime (`effects/execute.ts:96`, `effects/machine.ts:85`).
- **Import cycle.** The interpreter is a 48-file runtime import cycle (effects ops, execute and
  registry).

**C. Prompt / decision kind end-to-end: 2.** A new decision kind touches at least seven places:

1. `PromptKind` in protocol (`rules/core.ts:146`, or a `domains/*` hook).
2. A reason constant (`prompts/<domain>/reasons.ts`) plus an emitter and a handler.
3. The bot's answerer (`bot/random.ts:240-297`). It matches literals such as
   `"combat.damage_assignment"` (line 253) instead of the constants.
4. The gesture translator's `OBJECT_PROMPT_KINDS` (`engine/src/strict/gestures.ts:100`).
5. The UI's own `OBJECT_PROMPT_KINDS` (`apps/play/.../strict-interaction.ts:28`). It already
   diverges from the gesture translator's set: the UI adds `choose-player`.
6. UI data parsing (`strict-model.ts:246` re-checks the `"combat.damage_assignment"` literal).
7. i18n keys in four locales.

Between them, `Prompt.data` is `{ reason?: string; [key: string]: unknown }`
(`protocol/src/rules/core.ts:176-179`), so no compiler connects the emitter, handler, bot and UI.
Board clicks reach rules through gestures, while player clicks send `rules_choose` directly
(`BoardInteractionProvider.tsx:583, 3295`): two client encodings for one concept.

**D. New rules mechanic: 3.** Replacement effects (`registerActionInterceptor`), triggers and
advance/cleanup hooks (`timing/hooks.ts`) and layers (`layers/*.ts`) all have explicit, documented
extension points. That earns the 3. What costs the rest:

- **Closed zones.** Zones are a closed union with `battlefieldA|B|C|Token` as fields of
  `PlayerBoard` (`protocol/src/game-state.ts:21-61, 199-224`). Quoted literals of these appear in
  118 engine lines, 185 play lines, 27 sync lines and 16 realtime lines.
- **Fixed trigger-source zones.** Trigger sources are a fixed list
  (`triggers/detect.ts:75`: base, battlefields, legend, runeArea), which is exactly what R5's
  non-board-zone triggers (385) need to change.
- **Implicit phase order.** The phase order is a chain of task handlers that each call
  `setPhase(next)` (`timing/tasks/phase.ts`).
- **Hidden cycles in layers.** Layers break their import cycles with mutable setter injection
  (`layers/index.ts:49-91`, `layers/passives.ts:44-47`).
- **Frozen host.** `RulesHost` is "frozen", with empty "additions" sections
  (`rules/src/host.ts:159-161`). Any new zone primitive means editing the sandbox engine.

**E. New game mode: 2.**

- **The descriptor exists but the engine ignores it.** The rules corpus defines a mode as data
  (485.1–485.8), and the sandbox already has it as data: `VARIANT_RULES` in
  `engine/src/state/variant.ts:9`, with `firstPlayerSkipsFirstDraw`,
  `lastPlayerExtraRunesOnFirstChannel`, `victoryScore`, `combatPlayerLimit` and so on. The strict
  engine ignores it:
  - `firstTurnChannelCount` / `skipsFirstDraw` infer the rules from `activePlayerIds().length`
    (`timing/tasks/phase.ts:266-286`);
  - teams are `room.gameVariant === "teams_2v2"` (`scoring/teams.ts:12`), whose own comment says
    it "mirrors the engine's entity grouping";
  - concede hard-codes the FFA4 and 2v2 battlefield rule (`scoring/concede.ts:133`).
- **Test harnesses are duel-only.** The scenario DSL hard-codes `gameVariant: "duel"` and
  `p1`/`p2` (`test/scenarios/dsl.ts:100`). Self-play is duel-only. Only 9 rules test files touch
  3+ player variants, each building rooms by hand.
- **Known gaps.** 491.8.a (teammate invitation) is unimplemented. Practice-vs-Bot works by
  switching the live `roomMode` (progress.md §7).

**F. New UI interactions: 2.**

- **One giant provider.** `BoardInteractionProvider.tsx` is 3,729 lines with 110 React hook
  calls and 308 strict mentions interleaved with sandbox behaviour.
- **Every interaction rides on a sandbox gesture.** Strict interactions are encoded as sandbox
  wire actions (`move_card`, `chain_add`, `toggle_exhausted`, `equip_card`). An 880-line
  translator reverse-engineers them into intents (`engine/src/strict/gestures.ts`). It calls the
  full `legalIntents` per gesture (lines 320 and 455), and has no way to open a choice prompt
  (comment at lines 41-44).
- **No path for new interaction kinds.** An interaction with no sandbox analogue (any-amount
  payment, multi-mode choice, a teammate invitation) has nothing to ride on.
- **Locale is hard-coded.** 36 play files hard-code `createTranslator("en")` and there is no
  locale context.

**G. Module boundaries and layering: 3.**

The runtime package graph is a clean DAG:

- `protocol` imports nothing;
- `rules` imports only `protocol` and `cards`;
- `engine` imports `rules`;
- the apps import everything.

The internal layering has problems:

- **Test-time cycle.** 172 of 178 rules test files transitively import
  `../../../engine/src/...`, and `selfplay.ts` also imports `../../../sync/src/redact`. Rules
  cannot be tested without the sandbox engine, and the registries are module singletons whose
  sharing depends on vite resolving both paths to the same file.
- **One façade for two engines.** `@rift/engine`'s `index.ts` exports both engines, so the
  browser imports all of the rules and the card scripts through it.
- **Dead and duplicated code in realtime.** Realtime keeps a 1,556-line `fallback-engine.ts`, a
  local `engine-types.ts` and a "minimal" deck parser that the production room code still calls
  (`MatchRoomCore.ts:197, 317, 958, 1989`).
- **Rules knows the sandbox vocabulary.** The rules package hard-codes sandbox action names
  (`src/gate.ts`: 11 cosmetic and 48 manual-window action types).

**H. Sandbox vs strict duplication: 2.** The same game exists twice:

| Concept | Sandbox (engine) | Strict (rules) |
|---|---|---|
| Payment / auto-pay | `rules/autopay.ts`, `payment-sources.ts`, `actions/payment.ts` | `play/payment.ts`, `planner.ts`, `cost-*.ts` |
| Chain and showdown | `rules/chain.ts` (812 lines) | `timing/fepr/*`, `showdown.ts` |
| Turn | `rules/turn.ts` | `timing/tasks/phase.ts` |
| Victory | `rules/victory.ts` | `scoring/*` |
| Move legality | `rules/movement.ts` | `legality/move.ts` |

That is about 3.9k overlapping sandbox lines against about 2.7k strict lines. Card-specific
behaviour is also split: Tianna, Ivern and Aspirant's Climb are hard-coded by name in the sandbox
`victory.ts`, and they also exist as strict scripts. The coupling is not just duplication. It
leaks behaviour:

- `host.settleVictory` runs the sandbox `settleRoom`, which silently moves unattached gear to
  base (`engine/src/rules/victory.ts:271-291`, `strict/host.ts:527`).
- `host.victoryScore` adds +1 for Aspirant's Climb by name (`victory.ts:48-51`). Meanwhile the
  strict script is `partial` and `victoryScoreAdjustment` has no consumer: grep shows only its
  export in `api/effects.ts:66`.
- Strict setup still runs the sandbox setup handlers behind a `holdSandboxFirstTurn` hack
  (`engine.ts:152-183, 385-426`).
- In the §6.4 manual window, sandbox handlers mutate the `Room` with no `GameEvent`. Triggers,
  replacements and last-known information never see these changes, and the sandbox `settleRoom`
  still runs afterwards (`engine.ts:341-357` and the realized-change block).

**I. State shape and wire: 3.**

What is good:

- `RulesState` is plain, versioned JSON (`version: 1`).
- Redaction is thoughtful: it scrubs every string against private ids, so new fields are
  scrubbed by default (`sync/src/redact-rules.ts:58-80`).

What costs it:

- **Overloaded `Room`.** `Room` has about 80 top-level fields mixing shell, sandbox board, rewind,
  RNG, bot and strict state.
- **Dual source of truth.** Board facts live in `Room`, rules facts in `RulesState`, and a
  projection writes `activeTurnStep`, `chainEntries` and pools back (`state/project.ts:41-58`).
- **Open bags.** `Task.data`, `Prompt.data` and `GameEvent.data` are
  `Record<string, unknown>` / `unknown` bags (`core.ts:142, 177-178, 278`).
- **`history` doubles as scratch space.** It holds transient progress as well as history:
  `combatProgress` (`combat/begin.ts:42`), `scoringSnapshot` (`scoring/score.ts:146`) and ad-hoc
  `playHistoryTurn` counters. This scatter is the root of R5 gap #1.
- **Coarse diffing.** The wire diff is per top-level field, so any change resends the whole
  `rules` (`sync/src/diff.ts:82`), including the interpreter continuation in
  `prompt.data.continuation`.

**J. Purity and determinism: 4.**

What is good:

- No wall clock or `Math.random`: grep over rules, engine and sync finds none.
- Time, RNG and ids are injected (`host.ts:11-16`).
- Seeded strict rooms (solo lab and Practice vs Bot) carry `rngSeed`/`rngCursor`, so rewind and repro replay are exact.
- The read side never mutates.

What costs it:

- **Import-dependent behaviour.** Behaviour depends on which modules were imported: triggers,
  replacements and card scripts register as side effects of `api/effects.ts:9-12`, and "no hooks
  registered ⇒ R1 behaviour".
- **Order-dependent setters.** The layer modules use mutable setters, as noted under D.

**K. Performance: 3.** Today's costs are fine. These are medians over 155 intents of a fixture
duel; selfplay figures are per applied intent:

| Path | Median | p95 |
|---|---:|---:|
| `legalIntents` | 0.72 ms | 1.76 ms |
| `applyRulesIntent` | 1.27 ms | 3.13 ms |
| `cloneRoom` | 0.53 ms | n/a |
| Per-viewer redaction | 0.56 ms | n/a |
| Selfplay, fixture decks | 3.6 ms | n/a |
| Selfplay, catalog decks | 4.6 ms | n/a |

The structure scales badly:

- **Full-room snapshots.** Every history entry is a `deepClone` of the whole `Room`
  (`engine/src/rules/rewind.ts:88`), plus an O(n) `entries.reduce` per record (line 80). I
  measured about 60 KiB per snapshot (empty log), so 155 entries came to 9.2 MiB. At the caps
  (256 strict, 4,096 sandbox; lines 25-31) that is about 15 MiB and up to about 240 MiB, against
  a 128 MB Worker isolate.
- **Repeated full-room passes.** Each strict intent pays a structured clone, a full
  `deepEqualRoom` (`engine.ts:99`) and possibly a timeline deep clone.
- **No caching of derived values.** `legalIntents` re-plans per location
  (`view/legal-play.ts:41-82`), and the layers have no memoization (`host.cardInfo` has 69 call
  sites).
- **Repeated client work.** The client calls `strictLegalIntents` from 5 sites per state.
  Optimistic strict apply runs the full rules engine on a redacted room.
- **Double redaction.** The per-viewer diff redacts both sides every time
  (`sync/src/diff.ts:416-432`).

**L. Type safety and closed vocabularies: 3.**

What is good:

- `strict` plus `noUncheckedIndexedAccess` everywhere.
- No real `any` type in rules: all 3 grep hits are comments or a variable named `any`.
- Closed `KeywordName`, `EventType` and `CustomId` (`protocol/src/rules/effects.ts:171-407`).
- `INTENT_HANDLERS: Record<RulesIntent["type"], …>` makes a new intent a compile error.

What costs it: the seams that matter for extension are open.

- `GameEvent.type: string` (`core.ts:267`). The closed list only constrains card-script matchers.
- `Prompt.data`, `Task.data`, untyped `OpHandler` and `IntentHandler`. All 8 intent handlers
  re-narrow `intent.type`.
- Prompt reasons are plain strings.
- Sandbox actions are `Record<string, unknown>`.
- Only one `never` exhaustiveness check exists in rules (`effects/evaluate.ts:632`).
- The protocol keeps lane scaffolding: 15 `= never` placeholder unions and 9 empty interfaces in
  `protocol/src/rules/domains/*`.

**M. Error handling: 3.**

What is good:

- Verdicts with rule references.
- Wire-shape validation before any clone (`intents/index.ts:96-98`).
- Loop guards surface as `loop_guard` Verdicts.
- No `catch` at all inside rules.

What costs it:

- **Silent engine fallback.** If `import("@rift/engine")` fails, the realtime server silently
  falls back to a toy engine (`apps/realtime/src/engine-adapter.ts:76-80`,
  `.catch(() => ({}))`).
- **Swallowed read errors.** The read side swallows exceptions into `null`
  (`engine/src/strict/view.ts:46, 94, 163, 173, 185, 194`), which hides rules bugs on redacted
  rooms.
- **Inconsistent server handling.** `MatchRoomCore` wraps some engine calls in try/catch (1641,
  2558, 2649). The room-shell path (2188, 2260) is not wrapped locally.
- **No post-intent invariant check.** Nothing checks, for example, that every
  `rules.objects` key is still on the board.

**N. Test architecture and speed: 3.**

The suite is rich:

| Category | Files | Tests |
|---|---:|---:|
| Rule unit tests | 73 | 571 |
| Card scenarios | 88 | 1,081 |
| Official examples | 4 | 38 |
| fast-check properties | 4 | 8 |
| Registry guardrails | 3 | 32 |
| Self-play | 3 | 24 |

Rule ids are tagged in titles. The harness is fragile, though:

- **Clean-checkout typecheck fails.** `tsc --noEmit` in `packages/engine` fails with TS2307 on
  `../../../../.recon/oracle/load.mjs` (`test/helpers/oracle-fuzz-fixtures.ts:18`). The oracle
  is untracked (`git ls-files .recon | grep -c oracle` returns 0), so the CI step "Typecheck (all
  packages)" cannot pass as written.
- **CI skips all engine tests.** CI skips every engine test (`.github/workflows/ci.yml:58-65`).
  Locally, without the oracle, 9 of 23 files still run (134 tests: gestures, rewind, host
  attachments), so they are needlessly lost in CI.
- **Slow rules suite.** The rules suite took 200.8 s wall on 4 cores. Vitest reports 42% import
  time ("1624 modules evaluated 6185 times") because every scenario file loads all card modules
  and the engine.
- **Duel-only harnesses.** The DSL and self-play only build duels.
- **Other suites are fast.** `play` took 21 s, `realtime` 26 s and `sync` 1.4 s.

**O. Docs vs reality: 3.**

What is accurate:

- `docs/RULES-ENGINE.md` (extension table, purity exemptions, prompt registry).
- `docs/rules/CARD-AUTHORING.md`.

What is wrong or stale:

- **Top-level docs omit the main engine.** `docs/ARCHITECTURE.md` and `README.md` never mention
  `@rift/rules`. Their layout tables list only the sandbox engine as "the rules engine".
- **Stale counts in RULES-ENGINE.md.** It says "R2 integration hand-off is 62 files / 570"
  (line 620) and "40 original sandbox parity tests" (line 640).
- **Environment-dependent claims in progress.md.** Its claims "root `pnpm typecheck` clean" and
  "`@rift/engine` 23 files / 174 passed" only hold with the local-only oracle.
- **A promised cleanup that never happened.** The realtime adapter still says "TODO(engine):
  delete `fallback-engine.ts`" (`engine-adapter.ts:12`), although the engine is complete.

---

## 3. Top 10 issues, ranked by impact on extensibility

### 1. The strict engine is bound to the sandbox through a frozen host with side effects

- **Evidence.**
  - `RulesHost` (47 methods, `rules/src/host.ts:57-162`) has its only implementation in
    `engine/src/strict/host.ts`, built on sandbox `state/board.ts`, `rules/movement.ts`,
    `rules/victory.ts` and `rules/turn.ts`.
  - `settleVictory` → `settleRoom` moves gear to base without events (`victory.ts:271-291`).
  - `victoryScore` applies Aspirant's Climb by name (`victory.ts:48-51`), while
    `cards/OGN/aspirants-climb.ts` is `partial` and `victoryScoreAdjustment` is unused.
  - Strict setup reuses sandbox setup handlers via `holdSandboxFirstTurn` (`engine.ts:152-183`).
  - The manual window lets sandbox handlers mutate the room with no rules events, then runs the
    sandbox `settleRoom` (`engine.ts:341-357`, `rules/src/gate.ts`).
  - Zone lists are hard-coded in the host (`strict/host.ts:44-68`).
- **Why it matters.** Every R5-engine item needs new board primitives or exact event visibility:
  control change (190/435), copy (446), effect-driven play from the trash, non-board-zone
  triggers. Each one now means editing the sandbox, which must stay byte-faithful to the original
  simulator. Card behaviour already lives in two places, and the 85 `manual` plus 200 `partial`
  cards run partly on unobserved sandbox mutations.
- **Recommendation.**
  1. Extract the pure zone and board primitives (take, put, move, shuffle, attach, token) into a
     small package, for example `@rift/board`. Alternatively, move them to `rules/src/board/`
     with the sandbox importing them.
  2. Ship a reference `RulesHost` beside the rules.
  3. Make `settleVictory` a pure query (rules already owns 474).
  4. Move Aspirant's Climb and Tianna to `victoryScoreAdjustment` and a score restriction.
  5. Replace the manual window's sandbox passthrough with `rules_manual_*` intents that call the
     same primitives and emit `GameEvent`s.
  6. Later, make strict setup (battlefield pick, mulligan) native rules prompts.
- **Effort.** L (do it in stages: primitives and reference host first, then the manual window,
  then setup).

### 2. Decision prompts are a stringly-typed contract across seven places

- **Evidence.**
  - `PromptData` is `{ reason?: string; [key: string]: unknown }` (`protocol/src/rules/core.ts:176-179`).
  - Ten reasons are spread over four `reasons.ts` files.
  - The bot matches literals (`bot/random.ts:253, 255, 267`).
  - The engine and the UI each define `OBJECT_PROMPT_KINDS` with different members
    (`gestures.ts:100` vs `strict-interaction.ts:28`).
  - The UI re-parses damage-assignment data from literals (`strict-model.ts:246`).
  - Two client encodings exist for prompt answers (gesture → `translatePromptClick` at
    `gestures.ts:283-310`, versus direct `rules_choose` at `BoardInteractionProvider.tsx:583, 3295`).
- **Why it matters.** Most R5 capabilities are new decisions: non-standard costs ("choose cost"
  for return/recycle/spend buff), any-amount payments, Encore's play-time multi-mode (355.3),
  copy choices and teammate invitations (491.8.a). Each one must be taught by hand to rules, the
  bot, gestures, i18n and the UI. A miss shows up as a stuck self-play game or a dialog that
  never appears, not as a compile error.
- **Recommendation.**
  1. Add a discriminated `PromptSpec` union in protocol, keyed by `reason`, with typed `data` and
     `answer` per reason.
  2. Add a `definePrompt({ reason, kind, presentation: "board-objects" | "options" | "number" |
     "order" | "custom", boardClickable, botAnswer, i18nKey })` registry in rules, exported
     through the engine.
  3. Have the gestures, the bot and the UI consume that one definition. Delete both
     `OBJECT_PROMPT_KINDS` sets.
  4. Keep `rules_choose` as the only answer wire format.
  5. Add an integrity test: every registered reason has a bot answerer and an i18n key.
- **Effort.** M.

### 3. The effect-op extension contract is implicit

- **Evidence.**
  - `OpHandler = (effect: Effect, …)` (`effects/registry.ts:12`) leads to 61 re-narrowing
    guards.
  - Choice discovery depends on field names (`effects/choices.ts:237-251`) and a hard-coded
    child-effect walker (`choices.ts:284-371`).
  - Op names are special-cased in `replacements/decisions.ts:135-148` and
    `play/triggered.ts:59-60`.
  - A missing handler degrades silently to manual (`effects/execute.ts:96`, `effects/machine.ts:85`).
  - Ability refs are positional (`cards/registry.ts:119-122`).
  - The interpreter forms a 48-file import cycle.
- **Why it matters.** R5 adds ops (`copy`, `play` variants, control change, cost parts). With
  today's contract, a new op can type-check, register and still never prompt for its targets.
  Positional refs make every script edit a potential persisted-state migration.
- **Recommendation.**
  1. `defineEffectOp<K extends Effect["op"]>({ op: K, run(effect: Extract<Effect,{op:K}>, ctx),
     choiceFields?: Array<keyof …>, children?: (e) => Effect[], replaceable?: … })`.
  2. Build the registry as a mapped type `{ [K in Effect["op"]]?: OpDef<K> }` plus a test that
     every union member is either defined or explicitly listed as manual.
  3. Drive `choices.ts`, `decisions.ts` and `triggered.ts` from the definition.
  4. Give abilities an optional stable `id` and keep `activated:<n>` as an alias.
- **Effort.** M.

### 4. The test and CI harness does not test what it claims

- **Evidence.**
  - Engine `tsc` fails on a clean checkout (`packages/engine/test/helpers/oracle-fuzz-fixtures.ts:18`;
    the oracle is untracked).
  - CI skips the whole engine suite (`.github/workflows/ci.yml:58-65`), losing the 134 tests
    that need no oracle: gestures, rewind, host attachments.
  - 172 of 178 rules test files import engine source relatively
    (`test/scenarios/dsl.ts`, `test/bot/selfplay.ts:22-23, 32`).
  - The rules suite takes 200 s wall, with 42% in module import.
  - The DSL is duel-only (`dsl.ts:100`).
- **Why it matters.** Every lane in every wave merges through this gate. The gesture, rewind
  and repro code in `engine/src/strict/` (2,072 lines in total) never runs in CI; only the host runs, indirectly, through the rules DSL. A 3–4 minute inner loop
  slows card lanes, and multiplayer rules have no cheap test harness.
- **Recommendation.**
  1. Move the oracle suites and helpers into a separate vitest project and tsconfig, enabled only
     when `.recon/oracle` exists. Always run the rest of the engine suite in CI.
  2. Once a reference host exists (issue 1), the rules DSL depends on that instead of
     `engine/src`.
  3. Split the rules suite into vitest projects: engine-unit (no card barrel), cards and
     property. Try `isolate: false` (vitest itself estimates about 18 s saved) or sharding in CI.
  4. Parameterize the DSL by mode and seat count. Add an FFA3 and a 2v2 self-play smoke run.
- **Effort.** S for CI and tsconfig; M for the DSL and the project split.

### 5. Modes of play are not data in the strict engine

- **Evidence.**
  - `VARIANT_RULES` (`engine/src/state/variant.ts:9`) already encodes 485.1–485.8.
  - Rules re-derives the same facts from player counts and string checks:
    `timing/tasks/phase.ts:266-286`, `scoring/teams.ts:4-12` ("mirrors the engine's entity
    grouping") and `scoring/concede.ts:133`.
  - 491.8.a is not implemented.
  - The bot room flips the live `Room.roomMode` (progress.md §7).
- **Why it matters.** Multiplayer, team and future modes (Best of 5 battlefield reuse at 488.6.a,
  any non-sanctioned format) need one descriptor that the turn order, the first-turn process,
  scoring scope, victory and priority participants all read. Today each new mode means grepping
  for `gameVariant` and player counts across two engines.
- **Recommendation.** Move `VariantRules` into protocol as a `ModeOfPlay` descriptor, extended
  with seat controllers (human/bot/teammate). Store the resolved descriptor in
  `RulesState.mode`, or expose it via the host. Replace every count or string inference with
  reads of that descriptor. Resolve the bot-room question with a `controller: "bot"` seat flag
  instead of the `roomMode` switch.
- **Effort.** M.

### 6. Per-turn history and transient progress live in an ad-hoc grab bag

- **Evidence.**
  - `RulesHistory` is assembled from 5 domain hooks. It mixes counters
    (`cardsPlayedThisTurn`, `finalizedCardsThisTurn`, `activationsThisTurn`, with resets via
    `playHistoryTurn` in `play/keyword-helpers.ts:21-35` and `play/activation.ts:184`) with
    transient state (`combatProgress` at `combat/begin.ts:42`, `scoringSnapshot` at
    `scoring/score.ts:146`, `promptAnswers` at `intents/choose.ts:20`).
  - `ObjectRulesState` carries more `*ThisTurn` flags, cleared in cleanup.
  - The protocol domain scaffolding has 15 `never` unions and 9 empty interfaces.
- **Why it matters.** The top R5 gap (progress.md §4 #1, about 22 cards) is precisely "per-turn
  history: resources spent, units died, XP gained, Nth draw, conquered, excess damage, chosen
  objects, play locations". Adding each as another optional field with its own reset rule will
  multiply drift.
- **Recommendation.**
  1. Introduce a `TurnLedger`: an append-only list of typed ledger entries per turn, derived from
     the `GameEvent`s the engine already emits. Query helpers would cover "Nth time this turn",
     "spent on a card" and "died this combat".
  2. Move transient machines (`combatProgress`, `scoringSnapshot`) into `RulesState.progress`.
  3. Collapse the protocol's per-lane `Core* & Play* & …` compositions into cohesive modules.
- **Effort.** M.

### 7. UI and server god-files make new interactions expensive

- **Evidence.**
  - `apps/play/.../BoardInteractionProvider.tsx` is 3,729 lines (110 hooks, 308 strict
    mentions).
  - `apps/realtime/src/core/MatchRoomCore.ts` is 3,680 lines and `apps/play/src/runtime/matchRuntime.ts`
    3,204.
  - Every strict interaction must be expressible as a sandbox gesture
    (`engine/src/strict/gestures.ts`, 880 lines).
  - 36 files hard-code `createTranslator("en")`.
- **Why it matters.** R5-ui/i18n (locale wiring), tournament flows, new decisions (issue 2) and
  bot-room work all land in these files, which serializes lanes and invites merge conflicts.
- **Recommendation.**
  1. Split the provider into `useStrictInteraction` (compute the legal snapshot once per state
     and share it via context) plus an interaction-tool registry (drag-to-play, aim-arrow,
     prompt-click, chooser), each in its own file.
  2. Add a `LocaleProvider` and replace the module-level translators.
  3. Split `MatchRoomCore` into lobby/setup, action pipeline, bot driver and timeline/repro
     modules.
  4. For strict-only interactions with no sandbox analogue, let the client send `rules_*`
     intents directly, with gestures as sugar.
- **Effort.** M–L (it can proceed incrementally).

### 8. Zones are a closed, scattered vocabulary

- **Evidence.**
  - `Zone`, `BoardZone` and `BattlefieldZone` unions plus fixed `PlayerBoard` fields
    (`protocol/src/game-state.ts:21-61, 199-224`).
  - Quoted `battlefieldA|B|C|Token` literals: 118 engine lines, 185 play lines, 27 sync lines,
    16 realtime lines.
  - Zone sets are re-declared in `strict/host.ts:44-68`, `gestures.ts:86-97`,
    `strict-drop-legality.ts:59` and `strict-model.ts:58-63`.
  - Trigger sources are a fixed list (`triggers/detect.ts:75`).
- **Why it matters.** Non-board-zone triggers (385) and cards that function from hand or trash
  need data-driven "functions in" zones. Any future zone, or a battlefield count above 3
  (485.4.b allows variation), touches every package. The good news: rules itself mostly goes
  through `host.battlefieldZones()`. Only 4 literal lines remain in rules.
- **Recommendation.**
  1. Short term: export one `BATTLEFIELD_ZONES` / `CARD_ZONES` constant set from protocol and
     replace the re-declarations.
  2. Add `Ability.functionsIn?: ZoneClass[]` and scan trigger sources from it.
  3. Long term: put board lists behind accessors keyed by `ZoneId`, so the wire shape can stay
     faithful for the sandbox while strict code stops naming fields.
- **Effort.** S (constants, `functionsIn`); L (accessor migration).

### 9. Rewind history stores full deep clones, and derived views are recomputed everywhere

- **Evidence.**
  - `recordHistory` runs `before: deepClone(previous)` per action, with an O(n) `reduce`
    (`engine/src/rules/rewind.ts:80-88`).
  - Measured: about 60 KiB per snapshot (empty log), 155 snapshots at 9.2 MiB. Caps are 256
    strict and 4,096 sandbox (lines 25-31). At 4,096 that is about 240 MiB against a 128 MB
    isolate.
  - Each strict intent also pays a structured clone and a full `deepEqualRoom`
    (`engine.ts:99`).
  - The layers have no memoization (`host.cardInfo` has 69 call sites).
  - Client `strictLegalIntents` is called from 5 sites.
  - The per-viewer diff redacts both sides (`sync/src/diff.ts:432`).
  - The whole `rules` is resent per change (`diff.ts:82`).
- **Why it matters.** Longer games, 3–4 player rooms, tournament replays and a smarter bot
  (which calls `legalIntents` far more often) all multiply these costs. Today they are
  milliseconds; with more passives on board and more cards in hand they grow roughly
  quadratically.
- **Recommendation.**
  1. Exploit the determinism you already have: keyframe every N actions plus the action log
     (replay is already exact via `replayStrictRepro`), or move to structural sharing.
  2. Add a per-read memo for `effectiveMight` / `effectiveKeywords` / `cardInfo` keyed by room
     identity (a WeakMap).
  3. Compute `legalIntents` once per client state via context.
  4. Diff `rules` at the second level (chain, objects, prompt).
- **Effort.** M.

### 10. Dead and duplicate infrastructure in realtime, and silent fallbacks

- **Evidence.**
  - `apps/realtime/src/fallback-engine.ts` (1,556 lines) is selected silently when the dynamic
    import fails (`engine-adapter.ts:76-80`, `.catch(() => ({}))`).
  - A "minimal" deck parser (`apps/realtime/src/decklist.ts:51`) is still used by
    `MatchRoomCore` (197, 317, 958, 1989). Meanwhile the engine delegates to
    `@rift/cards.parseDeckText` (`engine/src/rules/decklist.ts:8`) and the builder uses
    `parseDecklist` (`cards/src/deck-builder.ts:357`).
  - Local mirror types live in `engine-types.ts`.
  - The read-side `catch { return null }` appears in `engine/src/strict/view.ts` (6 sites).
- **Why it matters.** Three deck parsers can disagree on a new section or set, for example
  sideboard and additional legends. A broken engine import in production degrades to a toy rules
  engine instead of failing loudly. Swallowed read errors hide rules bugs from the UI.
- **Recommendation.**
  1. Delete the fallback engine and import `@rift/engine` statically.
  2. Use `@rift/cards` everywhere for parsing.
  3. Import the engine's types.
  4. Report read-side exceptions (a dev-mode throw, plus a telemetry hook).
- **Effort.** S.

---

## 4. What's good: keep doing

- **Guarded registries plus closed vocabularies plus integrity tests.** The duplicate guard
  (`registry-table.ts`), typed `CustomId`, the import boundary and the coverage `--check` let
  parallel lanes add 1,090 scripts safely. Apply the same pattern to prompts and ops (issues 2
  and 3).
- **One write entry point, pure and draft-only.** `applyRulesIntent` validates the wire shape,
  clones once, runs the handler, then runs a bounded HOT FEPR advance and a projection. Nothing
  reads the clock or `Math.random`.
- **Verdicts with rule references,** shared by the write path, `legalIntents` and
  `explainIllegal`. Keep "one verdict function" as a hard rule.
- **Rule-literal tests.** Titles carry `[R…]`, `[EX:…]` and `[C:…]` tags, `rules-coverage`
  checks the ids, `[BUG]` tests are skipped reproductions, and nightly self-play acts as a
  regression gate.
- **Seeded RNG, exact rewind, repro export and replay.** That is a debugging superpower; build
  the history redesign on it.
- **Data-driven keyword triggers** (`KEYWORD_TRIGGERS`) and **data-first card scripts.** About
  80% of cards are pure JSON over the typed DSL.
- **Thoughtful per-viewer redaction** that scrubs new fields by default.

---

## 5. Refactor roadmap

The order is chosen so that each step is shippable alone and unblocks a wave in `progress.md` §8.

1. **Harness and hygiene (S, about 2–3 days).**
   - Make engine typecheck and tests independent of the oracle (separate vitest project and
     tsconfig), and run all engine tests that need no oracle in CI.
   - Split the rules vitest projects (engine-unit, cards, property) and try `isolate: false`.
   - Delete `fallback-engine.ts` and the minimal deck parser. Remove the silent import fallback.
   - Export one set of zone constants from protocol.
   - Fix `ARCHITECTURE.md`, `README.md` and the stale RULES-ENGINE.md counts.
   - *Unblocks:* every R5 lane (a trustworthy gate) and R5-bot-room's browser check (the engine
     tests actually run).
2. **Typed decision protocol and locale wiring (M).**
   - Add the `PromptSpec` union and the `definePrompt` registry consumed by rules, the bot, the
     gestures and the UI. Make `rules_choose` the single answer path.
   - Add the integrity test (bot answerer plus i18n key per reason).
   - Add a `LocaleProvider` in play.
   - *Unblocks:* R5-ui/i18n directly. R5-engine non-standard costs and any-amount payments,
     Encore multi-mode, and R5-bot policy work (prompt answers become definitions).
3. **Effect-op definitions, stable ability ids and the TurnLedger (M).**
   - Add `defineEffectOp` with typed handlers, declared choice fields and children, and a
     completeness test.
   - Add optional stable ability ids.
   - Build the per-turn `TurnLedger` from `GameEvent`s.
   - Add `Ability.functionsIn` for trigger sources.
   - *Unblocks:* R5-engine gap #1 (per-turn history, about 22 cards), gap #3 (385 non-board
     triggers and "Nth time"), gap #6 (effect-driven `play`) and copy (446). Also the R5-cards
     upgrades of the 200 partial and 85 manual scripts.
4. **Decouple strict from sandbox (L, staged).**
   - Extract the pure board primitives and a reference `RulesHost` beside the rules. Rules tests
     drop their `engine/src` imports.
   - Make `settleVictory` side-effect free, and move Aspirant's Climb and Tianna to strict
     scripts.
   - Turn the manual window into rules-observed `rules_manual_*` intents.
   - Add the `ModeOfPlay` descriptor in protocol, consumed by rules, plus a `controller: "bot"`
     seat flag.
   - *Unblocks:* R5-engine control change (190/435) and 429.5.d attribution through observed
     events. The R5-bot-room `roomMode` question. Strict FFA and 2v2 (491.8.a).
5. **Edge decomposition and history performance (M–L, incremental).**
   - Split `BoardInteractionProvider` into a strict-interaction hook plus a tool registry, with
     one `legalIntents` per state. Split `MatchRoomCore` into setup, pipeline, bot and timeline
     modules.
   - Rework rewind history as keyframes plus the action log. Memoize the layers. Diff `rules` at
     field level on the wire.
   - *Unblocks:* R5-bot (cheaper legal-move enumeration for a policy bot), longer and multiplayer
     games, and the tournament scenario system's replays without memory blow-ups.

---

## Appendix A: measurements

| What | Result |
|---|---|
| Source size (TS lines) | rules 85.7k: card scripts 30.6k, engine core 20.7k, tests 34.5k. engine 20.4k (src 13.6k, of which `strict/` 2.1k). play 62.4k. realtime 13.1k. protocol 3.7k. sync 4.1k |
| `@rift/rules` tests | 177 files / 2,001 passed, 200.8 s wall (4 cores); vitest: import 42% of tracked time |
| `@rift/engine` tests (no oracle) | 9 passed / 14 skipped files; 134 passed / 40 skipped tests; 17.4 s |
| `realtime` / `play` / `sync` tests | 76 tests in 25.6 s / 354 tests in 20.5 s / 58 tests in 0.8 s; all green |
| `tsc --noEmit` | rules 12 s clean; realtime 7 s, sync, protocol, cards, i18n clean; **engine: 3 errors** (oracle import) |
| Self-play (5 seeds each) | fixture: 887 intents, 3.6 ms/intent. catalog: 1,262 intents, 4.6 ms/intent |
| Instrumented duel (155 intents) | `legalIntents` 0.72 / 1.76 ms (median / p95). `applyRulesIntent` 1.27 / 3.13 ms. `cloneRoom` 0.53 ms. redaction 0.56 ms. `recordHistory` 0.22 ms |
| State size | Room JSON up to 63 KiB, `Room.rules` up to 3 KiB (turn 21, empty log). 155 timeline snapshots = 9.2 MiB |
| Runtime import cycles (non-type imports) | rules: one 48-file SCC (effects), one 4-file (combat/cleanup), one 2-file (layers). engine: one 2-file. play: none. Package graph acyclic; test-time cycle rules → engine/sync source |
| Escape hatches | about 190 custom ids; 202 card files reference one; about 4.5k lines of set `custom.ts` |

## Appendix B: prior review

I searched for `r4-maintainability-review` after forming the view above. The document is not on
disk: `.orchestrator/` is gitignored and absent, and I did not look under
`.claude/worktrees/`. It is known from `progress.md` §2 ("Maintainability pass", branch
`r4-maint`), from commits `21198a1`…`881dc09`, and from the F1–F13 / G1–G11 tags in the code.

**Already covered, and verified as landed:**

- registries throw on duplicates (`registry-table.ts`, `test/registry/duplicates.test.ts`);
- closed `KeywordName` / `EventType` / restriction / card-type vocabularies;
- typed DSL members replacing generic `custom` ids, with prefixed `CustomId`;
- the card SDK and one card per file with per-set `custom.ts`;
- scripts own their additional costs and play permissions;
- integrity, import-boundary and coverage checks;
- the catalog keyword audit;
- CI (G11).

This review does not repeat those items. It agrees they solved card-authoring extensibility,
which scores 4.

**Not covered there, and new here:** issues 1–10. That includes one defect in the prior review's
own CI deliverable (G11): it skips the whole engine suite, and its typecheck step cannot pass
without the untracked oracle (issue 4). The prior review targeted the card layer. The remaining
extensibility risk sits in the seams between packages and in the coupling between the two
engines.
