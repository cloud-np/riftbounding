# Strict-mode bot and headless self-play

Owner: wave R4 `bot-core`. The bot is deliberately **dumb**: it picks uniformly at random among
the currently legal strict actions for one player. It exists to exercise the strict engine end to
end, not to play well.

## 1. Public API

```ts
// @rift/rules (exported from src/api/core.ts)
mulberry32(seed: number): () => number
pickPromptAnswer(prompt: Prompt, room: Room, random: () => number): PromptAnswer | null
pickRandomAction(room: Room, playerId: string, host: RulesHost, random: () => number): RulesIntent | null

// @rift/engine (re-exported from src/index.ts)
pickStrictBotAction(room: Room, playerId: string, random: () => number): RulesIntent | null
```

- **Purity.** `packages/rules/src/bot/random.ts` never mutates its `Room`, never calls `Date`,
  `Math.random`, timers or I/O; every random decision comes from the injected `random`.
- **Hidden information.** A live driver must pass the bot seat's redacted view
  (`redactRoomForViewer(room, { playerId, viewerRole: "player" })`), never the authoritative
  room. The read side (`whoMayAct`, `legalIntents`) then sees exactly what the client would.
  The chosen intent is applied to the authoritative room with the same `RulesHost`.
- `pickStrictBotAction` binds the engine host and returns `null` outside a strict `in_game`
  room or when the picker throws (same defensive contract as `strict/view.ts`).

## 2. Action policy

`pickRandomAction` picks uniformly inside the **highest-priority legal category**:

1. **Prompt answer** (411.2) — `rules_choose` for the open prompt;
2. **Manual window** (§6.4) — `rules_manual_done`, so unscripted cards do not stall the game;
3. **Progress** — `rules_play` (including 811.1.b Hide), `rules_activate`, `rules_move`;
4. **End turn** — `rules_end_turn`;
5. **Pass** — `rules_pass`, only when nothing else is legal.

It returns `null` when the game is over, `whoMayAct` names another player (or nobody), no legal
action exists, or the open prompt has no answer. It answers the `play.optional_cost` prompt with
"yes" (paying affordable optional additional costs such as Accelerate), does not use `hold`,
answers "may"/replacement prompts with the progress option ("yes"/apply) and picks X = 0.

## 3. Prompt coverage

`pickPromptAnswer` handles every `PromptKind` and every prompt reason emitted by the engine:

| Kind / reason | Answer |
|---|---|
| `choose-opponent` (incl. `burn_out`) | random offered opponent as `playerId` |
| `choose-player`, `choose-card`, `choose-target`, `choose-mode`, `choose-battlefield`, `choose-cost`, `manual` | random offered ids within `min..max` (group requirements use `groupSatisfied`) |
| `choose-number` (X) | the smallest offered value (`0`), so the play stays affordable |
| `yes-no` (`play.trigger`, `play.optional_cost`, `effects.resume` boolean, optional replacement) | "yes" (pay / apply) |
| `order` (`effects.order_triggers`) | all offered ids in a random order (`orderedIds`) |
| `damage-assignment` (`combat.damage_assignment`) | `data.suggested`, else `enumerateAssignments` |
| `play.choice` | random legal option count; `spec.group` is checked with the host |
| `play.cost` (`choose-cost`) | random offered objects for the category (exact count) |
| `effects.resume` `ask.answer="split"` | every target ≥ `minEach`, remainder on the first |
| `effects.resume` `ask.answer="objects"` | known `subsets` / `exact` / group-aware subset |
| `effects.replacement` | "yes"/apply; ordering prefers a real replacement over `$none` |
| no `options` (legacy/free-form) | `{}` (411.2 accepts it) |

Documented `null` cases: an offer whose `min` exceeds `options.length`; a damage assignment
with no legal distribution; a split total smaller than one per target; a subset/group decision
whose offered ids form no legal choice; an `objects` decision whose ids cannot be mapped back to
options. The harness reports those as `stuck`, never as a random guess.

`pickPromptAnswer` has no `RulesHost` argument, so a `group` requirement can only be evaluated
when it is reached through `pickRandomAction` (which has the host). Without a host the answerer
falls back to an ungrouped offer; live seats use `pickStrictBotAction`, which has the host.

## 4. Headless self-play harness

`packages/rules/test/bot/selfplay.ts` builds a real strict duel with
`createInitialGameState` (committed fixture decks or random Calm/Chaos decks from the real card
catalog), runs `initializeStrictRules`, then loops:

- `whoMayAct` → the acting seat builds its redacted view with `redactRoomForViewer`;
- `pickRandomAction` → one intent; the harness applies it to the authoritative room;
- stops on `room.gameOutcome` (win), the turn cap, the action cap, or a detected failure.

Each report is plain JSON: `{ seed, outcome, step, turn, actor, intent, reason, reject
{code,rule,detail}, winnerPlayerIds, scores, lastEvents }`. Outcomes are `win`, `turn_cap`,
`action_cap`, `stuck`, `crash` (an engine exception or an intent the picker believed legal was
rejected).

Failure detection:

- a consecutive pass streak over the cap → `stuck` (`pass_loop`);
- a lasting-progress signature unchanged for N steps → `stuck` (a no-op manual/chain cycle);
- the same lasting signature recurring every few steps → `stuck` (a 2-step loop);
- the same prompt id still open after an accepted `rules_choose` → `stuck`;
- 4 000 actions or 80 turns by default → `action_cap` / `turn_cap` (not a failure).

`lastEvents` keeps the last 40 engine events, which is usually enough to see
`play_cancelled`, `manual_window`, prompt kinds and the reject code.

### Running it

```bash
pnpm --filter @rift/rules selfplay                    # 50 seeded games, fixture decks
SELFPLAY_GAMES=300 SELFPLAY_DECK=catalog \
  SELFPLAY_SEED_START=1 pnpm --filter @rift/rules selfplay
```

| Env var | Default | Meaning |
|---|---:|---|
| `SELFPLAY_GAMES` | 50 | number of consecutive seeds |
| `SELFPLAY_SEED_START` | 1 | first seed |
| `SELFPLAY_MAX_TURNS` | 80 | per-game turn cap |
| `SELFPLAY_MAX_ACTIONS` | 4000 | per-game intent cap |
| `SELFPLAY_DECK` | `fixture` | `fixture` (committed decks) or `catalog` (random Calm/Chaos decks from `@rift/cards`) |
| `SELFPLAY_AUTOPASS` | `none` | `none` (no automatic actions: the historical per-seed outcomes), `default` (the information-safe defaults) or `all` (every auto-pass option; see [`auto-pass.md`](auto-pass.md)) |

`pnpm --filter @rift/rules interactions` (same env vars, plus `INTERACTIONS_MODES`) counts every
bot decision per game by kind — forced prompt, own-item pass, response window with/without a
legal response, Main Phase — and the automatic actions taken instead; it produced the before/after
table in [`auto-pass.md`](auto-pass.md).

The CLI is `test/bot/selfplay.run.ts` under its own
`test/bot/vitest.selfplay.config.ts`; it is not part of the default suite. The default suite
runs a handful of seeds in `test/bot/selfplay.test.ts`; the originally failing seeds are
unskipped regression tests (no `[BUG]` skip remains).

## 5. Results and findings

The sweep found three engine bugs; all are fixed by R4-engine lane E, so the final tree has no
stuck/crash seeds. Final sweep (default caps 80 turns / 4 000 actions):

| Deck mode | Seeds | Wins | Turn caps | Action caps | Stuck | Crashes | Avg turns |
|---|---:|---:|---:|---:|---:|---:|---:|
| `fixture` | 200 | 200 | 0 | 0 | 0 | 0 | 32.00 |
| `catalog` | 400 | 394 | 6 | 0 | 0 | 0 | 35.83 |

The six turn caps (seeds 62, 143, 157, 268, 323, 338) are long but legal games, not failures;
raise `SELFPLAY_MAX_TURNS` to finish them.

Root causes, rule quotes and fixes are in `.orchestrator/reports/r4-selfplay-findings.md` and
`.orchestrator/reports/r4-engine-e-findings.md`:

- **R420.2.a** — a pending non-standard cost (kill/exhaust/discard) skipped the resource check;
  `planPayment` now probes the pending candidates (`play/payment.ts`).
- **R818.1.c.2** — an unscripted `[Equip]` line was exposed twice (built-in `equip:0` plus a free
  `manual:0`); manual entries now skip `[Equip]` lines (`cards/registry.ts`).
- **R355.8** — a mode prompt offered a mode with no legal target; mode collection now probes each
  mode's mandatory choices (`effects/choices.ts`).

## 6. Known bot limitations

- It always accepts affordable optional additional costs (Accelerate, Repeat, optional printed
  costs) because the generic yes/no answer is "yes", and never uses `hold`; self-play outcomes
  therefore include the Accelerate line.
- It answers "may"/replacement prompts with yes/apply; it never declines to preserve a
  resource.
- It treats a manual activated ability (`manual:<n>`) as a normal progress action; if such an
  ability has no cost and no scripted effect, the harness must detect the resulting cycle (the
  engine bug above).
- It picks a random offered mode/target, so a prompt that incorrectly offers an impossible
  choice can be selected. The harness reports the resulting cancellation; a smarter bot could
  avoid it only by duplicating engine choice validation.
