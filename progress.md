# Riftbounding strict rules engine: progress

Living status file for humans and future agents. Numbers come from the final run of the R5
player-experience wave (branch `claude/eloquent-faraday-gd595x`, on top of the R4 play-test fixes);
regenerate the coverage docs rather than editing the tables below by hand.

## 1. Goal and process

Strict mode (`@rift/rules`) must follow the official Riftbound Core Rules (2026-10-09,
`packages/rules/corpus/core-rules-2026-10-09.txt`, errata in `corpus/errata/`, card text in
`packages/cards/data/cards.json`) exactly. Method, repeated per rule: find the rule text, write a
small pure function, add tests whose titles cite `[R<id>]` / `[EX:<id>]` / `[C:<Card>]`, verify,
continue. Work is split into waves of parallel sub-agents, each in a file-ownership lane; a lead
(integration engineer) merges the lanes, resolves duplicates, gets the whole workspace green and
regenerates the coverage docs. R4 was orchestrated by Claude with DeepSeek V4.1 Flash builders via
opencode: one git worktree per lane, all coordination through `.orchestrator/` (plan, lane reports,
findings, scratch probes), then merged into `r4-engine` and finally integrated here.

## 2. Wave history

- **R1.** Skeleton and core timing: turn structure and timing, priority and focus, the chain,
  cleanups, showdown seams and scoring.
- **R2.** Four parallel domains (play, combat, effects, int) plus an integration pass: process of
  play and costs, combat with full damage assignment, the resumable effect interpreter with
  triggers/replacements/layers, and sync/realtime/i18n/UI wiring. Merged in PR
  cloud-np/riftbounding#1.
- **R3.** Card scripts in six lanes (Origins A-N, Origins O-Z, Spiritforged, Unleashed,
  Vendetta + Proving Grounds, Radiance) plus R3-engine (damage split and group targeting
  355.11/355.14, optional replacements and ordering 371.2/372/373, Show Off 832, Flow 829,
  Ganking from passives 810.3).
- **R4-engine A-E.** Five engine lanes: A expiration keep-list (317.2.c); B Repeat execution and
  choices (820), Deflect values (809), self restrictions (054.1), limited play (420.3.b), Ambush
  merge (822.1.b); C replacements and last-known information (371/372/373, 429.5, 808); D built-in
  Equip (818.1.c.2), Weaponmaster (821), Quick-Draw (819), Deploy (830) and attached Effect Text
  (718.3/719.1); E the bugs found by self-play and card lanes (420.2.a, 355.8, 190.6/371.2.a,
  811.6, 429.5.c).
- **R4-cards five lanes.** Origins A-N (Fox-Fire, Bilgewater Bully, Fading Memories), Origins O-Z
  (Windswept Hillock, Sett, Symbol of the Solari, Solari Shrine), Spiritforged (Janna, Savior and
  the Equipment/Weaponmaster sweep), Unleashed (all 40 unscripted names, Repeat/replacement
  workarounds removed), Vendetta + Proving Grounds (all 40 unscripted names, 15 Flow spells,
  Empower/Deflect repairs), Radiance (all 43 unscripted names, Show Off/damage split cards).
- **R4-cards upgrade lanes.** `equip` (30 SFD + RAD Equipment, Weaponmaster/Quick-Draw/Deploy,
  Veteran poro, Bomb token), `unl2` (Repeat, optional costs, limited play, attached cards,
  Evelynn/Altar engine follow-ups), `ven2` (Empower expiration, Deflect, delayed replacements,
  Ambush, optional-cost flags).
- **R4-i18n.** 128 strict-rules keys per locale (fr/ko/zh-CN), term table and a strict locale test.
- **R4-bot-core.** Seeded pure random picker, engine binding, headless self-play harness and
  `docs/rules/bot.md`; found the three engine bugs fixed by lane E.
- **R4-bot-room.** Practice vs Bot: strict `single_player` room with an `isBot` server-driven
  seat, auto setup, redaction, bounded bot waking (`docs/rules/bot-room.md`).
- **R4-gestures.** Board gesture → `rules_*` translation, targeting, prompt clicks, chain A/S and
  end-turn controls, ambiguity rejection (`docs/rules/gestures.md`), plus a fix pass for chain
  controls and a targeting pass.
- **R4-strict-ui.** Gesture-only strict board, prompt clicks/multi-select confirm, Quick-Draw
  drop, ambiguity chooser, dev-only rules panel and toast routing for rejections
  (`docs/rules/int.md`).
- **R4 integration.** Unskipped every `[BUG]` reproduction, applied lane follow-ups,
  translated the late keys, cleaned lane docs/statuses, documented lane E/bot/room/gestures,
  regenerated coverage and re-ran every suite and self-play sweep.
- **Maintainability pass (branch `r4-maint`).** Implements the R4 maintainability review
  (`.orchestrator/reports/r4-maintainability-review.md`) so new cards cannot break the format:
  every registry throws on a duplicate (test-only overrides in `src/testing.ts`); closed
  `KeywordName` / `EventType` / restriction / card-type vocabularies; the generic `custom` ids
  are typed DSL members (`while`, `enter-ready`, `cost-adjust`, `self-state`, …) and `custom` ids
  must be `<owner>:`-prefixed; one card per file with a `custom.ts` per set, a card SDK
  (`src/cards/sdk.ts`) and shared builders / `core:` ids in `src/cards/lib`; scripts own their
  additional costs and play permissions; registry integrity, duplicate and import-boundary
  tests; registry-based coverage plus `docs/cards-index.md`; a catalog keyword audit; CI
  (`.github/workflows/ci.yml`). The contract is
  [`docs/rules/CARD-AUTHORING.md`](docs/rules/CARD-AUTHORING.md). Self-play outcomes are identical
  per seed to `r4-engine`.

- **R4 play-test fixes (owner live testing of Practice vs Bot, merged into `r4-engine`).** Bot seats
  count as present; strict prompts get a production banner and board highlights; focus/priority
  response banner that never reveals whether the holder can respond (Pass = W); gesture-only play
  with arrow targeting (no option lists) on a cached per-drag legality snapshot (hover is O(1)); chain
  controls map to `rules_pass`; Hidden (811) hide pockets and facedown plays; attached gear fans out
  beside its unit (`AttachedCardFan`); trash/banished show and browse their cards; token art via one
  resolver; units move from a battlefield back to base (144.4.b); Weaponmaster uses scripted Equip
  costs (821.1.c); effect moves recall when impossible (449.2.c); affordable optional additional
  costs such as Accelerate are prompted (355.1.a); strict rewind/forward with seeded randomness and
  repro export/replay in Practice vs Bot and solo_lab ([`docs/rules/rewind.md`](docs/rules/rewind.md));
  the strict rules panel is dev-only. Reports: `.orchestrator/reports/r4-fix-*`, `r4-gestures-*`,
  `r4-rewind.final.txt`.

- **R5 player-experience wave (branch `claude/eloquent-faraday-gd595x`).** Four parallel lanes
  (one git worktree each), merged and integrated by the orchestrator:
  - **Auto-pass** ([`docs/rules/auto-pass.md`](docs/rules/auto-pass.md)): per-seat preferences
    (`ownItems`, `responses`, `forcedPrompts`, `endTurn`, `hold`, one-shot "pass until end of turn"
    / "until the opponent acts", "yes to all" for identical prompts) run inside the recorded intent
    with the same verdicts as a manual pass/choose/end turn, so rewind/repro stay exact; defaults
    are information-safe and the leaky modes are explicit opt-in (⚠). Preferences are redacted per
    seat. Strict board panel, Shift+W, notices, `rules_set_auto_pass`. Decisions per fixture game:
    203 → 191 (safe defaults) → 126 (everything on).
  - **Edge-case audit** ([`docs/rules/edge-cases-audit.md`](docs/rules/edge-cases-audit.md)): fixed
    Awaken readying each object (416.3.a, 054.1: "can't be readied", ready triggers), hidden spells
    playing units at their battlefield (811.1.d.5), Bandle Tree's extra facedown slot (107.3.b.1),
    no-op ready/exhaust events (416.1.c / 415.1.c); scripted Evelynn, Agony's Embrace and Elnuk
    Herd; corrected stale statuses; `[BUG]` repros for the gaps left open (section 5).
  - **Tournament scenarios** ([`docs/rules/scenarios.md`](docs/rules/scenarios.md)): a declarative
    `*.scenario.ts` / `.json` format (position + readable steps + checkpoints, catalog names with
    did-you-mean), a runner with readable step diffs and `expectFailure` (XFAIL/XPASS), vitest
    auto-discovery of `tournament/` and `regressions/`, `pnpm --filter @rift/rules scenario`
    (`run`, `convert` a strict repro window into a scenario, `make-repro`), and 10 illustrative
    scenarios from Regional Qualifier top-cut decklists. They found two engine bugs, fixed at
    integration: a Conquer ability triggered twice at the Final Point (473.2.c) and an "up to"
    target answered with zero on play was asked again on resolution (355.5 / 355.13).
  - **Architecture review**
    ([`docs/reviews/architecture-extensibility-review.md`](docs/reviews/architecture-extensibility-review.md)):
    15-dimension scorecard, top 10 extensibility issues and a refactor roadmap.
  - **Integration** fixed: scenario positions/converter carry auto-pass preferences and the new
    intents; the two UI soft-locks from the audit (enemy cards could not answer target prompts in
    multiplayer rooms; prompts with deck/trash options were stuck in board-click mode); CI
    (typecheck now passes on a clean clone without `.recon/oracle`, engine tests run in CI).

## 3. Current state

### Tests per package (final run of this branch)

| Package | Files | Passed | Skipped / failed | Notes |
| --- | ---: | ---: | --- | --- |
| `@rift/rules` (default) | 190 | 2093 | 6 / 0 | 1 skipped file holds the six `[BUG]` repros (section 5); includes `test/edge-cases/`, auto-discovered `test/scenarios/tournament/` (10 scenarios, all passing) and `test/registry/` |
| `@rift/rules` (host config) | 1 | 1 | 0 / 0 | |
| `@rift/engine` | 24 | 137 | 40 / 0 | 14 oracle files skip without the local-only `.recon/oracle`; strict host/gestures/rewind/repro run (and now run in CI) |
| `@rift/sync` | 6 | 59 | 0 / 0 | includes per-seat auto-pass redaction |
| `@rift/i18n` | 5 | 171 | 0 / 0 | includes the strict locale suite |
| `@rift/cards` | 8 | 104 | 0 / 0 | includes the catalog keyword audit |
| `realtime` | 8 | 77 | 0 / 0 | includes Practice-vs-Bot rewind/repro and auto-pass coverage |
| `play` | 54 | 369 | 0 / 0 | includes auto-pass controls and the prompt soft-lock tests |

Typecheck: root `pnpm typecheck` is clean in all 10 packages on a clean clone (without `.recon/oracle`).

### Rules coverage (`docs/rules-coverage.md`)

692 / 2321 rule ids tested (29.8%); 1503 tagged test titles; 0 unknown ids
(`node packages/rules/scripts/rules-coverage.mjs --check`).

### Card scripts (`docs/cards-coverage.md`)

1090 playable names; **1090 scripted (100%)**, 1007 automated (92.4%), 0 unscripted.

| Status | Cards | % |
| --- | ---: | ---: |
| implemented | 816 | 74.9% |
| partial | 191 | 17.5% |
| manual | 83 | 7.6% |
| unscripted | 0 | 0.0% |

| Set | Total | Implemented | Partial | Manual | Unscripted |
| --- | ---: | ---: | ---: | ---: | ---: |
| Origins | 292 | 222 | 45 | 25 | 0 |
| Spiritforged | 221 | 168 | 32 | 21 | 0 |
| Unleashed | 219 | 157 | 38 | 24 | 0 |
| Vendetta | 167 | 123 | 44 | 0 | 0 |
| Radiance | 168 | 124 | 31 | 13 | 0 |
| Proving Grounds | 23 | 22 | 1 | 0 | 0 |

### Self-play (final sweeps, default caps 80 turns / 4000 actions)

| Deck mode | Seeds | Wins | Turn caps | Action caps | Stuck | Crashes | Avg turns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `fixture` | 1–200 | 200 | 0 | 0 | 0 | 0 | 31.59 |
| `catalog` | 1–400 | 392 | 8 | 0 | 0 | 0 | 36.98 |

(Re-run after the Weaponmaster attach-cost fix merged into `r4-engine` and again after the
maintainability pass: per-seed outcomes of the pass are identical to `r4-engine` `b1eb4f9`.)
Latest sweep (after the play-test fixes): the bot can now pay optional costs such as Accelerate, which
shifts a few catalog games (392 wins / 8 legal turn caps); still 0 stuck and 0 crashes.

R5 (after every merge and integration fix, auto-pass off as before, seeds 1–50): `fixture` 50/50
wins, avg 31.82 turns; `catalog` 49 wins + 1 legal turn cap, avg 40.14; 0 stuck, 0 crashes in both.
The auto-pass sweeps (`SELFPLAY_AUTOPASS=default|all`) are in `docs/rules/auto-pass.md`.

The six catalog turn caps (seeds 62, 143, 157, 268, 323, 338) are long but legal games; raise
`SELFPLAY_MAX_TURNS` to finish them. The default 50-game fixture run is 50/50 wins, avg 30.88.

## 4. Ranked capability gaps

Merged from the "Capability gaps" tables in `docs/rules/cards/*.md`, ranked by cards blocked.
Counts are approximate (near-duplicates merged by hand; a card can need several gaps). Rows fixed
by R4-engine A-E are removed. Detail and card names are in the lane docs: `ogn-a-n`, `ogn-o-z`,
`sfd`, `unl`, `ven-ogs`, `rad`.

| # | Gap | Rules | ~Cards |
| ---: | --- | --- | ---: |
| 1 | Per-turn history: resources spent (turn / on a card), units died, XP gained, Nth draw, conquered/scored this turn, excess combat damage, objects chosen this turn, where cards were played | 165, 356.4, 357, 383.1.b, 429, 467.2.c.4, 728–733, 420.5 | 22 |
| 2 | Non-standard cost parts: return a permanent to hand, recycle/banish from trash, spend a buff, disempower, exhaust two objects, Mighty/tag filters, any-amount payments, restricted resource spending | 203.3, 356.2.b, 357.2, 417.6, 430.2, 430.5, 443, 706 | 25 |
| 3 | Triggered abilities of cards in non-board zones (hand, trash, deck) and trigger multiplication ("additional time", "Nth time") | 385, 383.1, 383.4 | 12 |
| 4 | Play-location permissions/restrictions: normal plays to an open/occupied battlefield, destination-qualified move restrictions, effect-play locations | 355.2.b, 355.17, 054.1, 420.3.b, 449 | 13 |
| 5 | Cost modifiers: reading an object paid as a cost, component discounts/minimum-of-1, opponent costs, one-shot discounts consumed by the next card of any type, either/or and target-conditional discounts | 356.2.b.1, 356.3, 356.4, 420.5 | 13 |
| 6 | Effect-driven plays (`play` op): from trash / by another player, full 356 total cost or ignoring only Energy, location choice | 354, 356, 420.3 | 10 |
| 7 | Trait/keyword alteration: base-Might "becomes", gear→unit, tag grants, passives granting keywords to cards in hand, granted activated abilities | 365, 479–481, 801.3, 806 | 10 |
| 8 | Copy effects (copy text, Reflection tokens becoming copies) | 446 | 5 |
| 9 | Entry/one-shot replacements: gear "enters exhausted", one-shot enter-ready, global enter-ready/Awaken skip, attachments made this turn | 149.1, 369.3, 435, 718 | 7 |
| 10 | Control change, activated-ability grants, Add resources resolving immediately, trigger-count modification | 190, 360, 365, 430.2, 808 | 8 |
| 11 | Combat damage modifiers: damage doubling, source-type Bonus Damage, `ignore-keyword`, 429.5.d multi-source attribution and combat damage source object | 433.1.b, 712–715, 764–767, 429.5.d | 7 |
| 12 | Last-known information about other objects dying simultaneously ("alone", "died this combat") | 359.3.e.13, 467.2.d, 740.2.a | 3 |
| 13 | Any-amount/variable payments and sum-constrained or multi-category choices | 203.3, 355.13, 355.18 | 3 |
| 14 | Repeat edges: Repeat on triggered/activated abilities, granting Repeat with a computed value, Repeat-cost reductions, suppressing keyword triggers (Temporary) | 816, 820.1, 820.1.a, 356.4.c | 5 |
| 15 | Refexive triggers keyed to a Cleanup kill and other "when this kills" instructions | 387, 429.5 | 3 |
| 16 | Battlefield/phase triggers for "each player" and a player's first Beginning Phase | 315.2.a.1, 383.3 | 3 |
| 17 | Move events lacking the mover / player-level move events / destination restrictions | 412.4, 421, 447, 054.1 | 4 |
| 18 | Token-play replacements and token location choices; battlefield tokens | 370–375, 186, 440.2.b.1 | 5 |
| 19 | Champion identity on the board, extra legends, deck-building identity | 103.3, 133.8, 133.8.b | 2 |
| 20 | Reveal / reveal-until / look-at-top then banish-and-play (cross-player, filtered) | 425, 420.3 | 4 |

## 5. Known engine bugs

Six `[BUG]` reproductions are skipped (`packages/rules/test/edge-cases/known-gaps.test.ts`, from the
R5 edge-case audit; each fails when unskipped):

- 107.3.b.2: when a Facedown Zone's occupancy drops (Bushwhack Trap leaves), the excess facedown
  card stays.
- 437.1.a: Predict 2+ puts the kept cards back in their old order instead of any order.
- 423.1.a: a discard cost inside a spell's instructions discards the newest card instead of asking
  (latent: no printed card reaches this path today).
- Per-turn history (section 4, gap 1) blocks Hunters' Circle, Lingering Animus and Hold 'Em, each
  in 3 of the 24 starter kits (three repros).

Also open, without a repro: manual-status cards (the §6.4 window) cannot act on the opponent's
objects in PvP, so a manual card that affects an enemy can only be finished with Done (audit row
14). All earlier R3/R4 reproductions remain unskipped regression tests. The card-coverage report prints four warnings for token/marker scripts (`Bomb` twice,
`Equip`, `Shadow Clone`); they are not playable deck cards and do not affect coverage.

## 6. Data issues

- Catalog `keywords` include keywords that appear only in reminder or granted text, mostly token
  text (Gold gives [Reaction]/Add, Ganking; Petal Pixie/Sprite Queen list Temporary; Chakram Dancer
  Shield; Lord Broadmane Assault; Yuumi Tank; Wily Newtfish Ganking). Scripts suppress them per
  card (`...notIntrinsic(…)` / `suppress-printed-keyword`). The `@rift/cards` audit
  (`CATALOG_KEYWORD_OVERRIDES`) classifies every catalog keyword its text does not name (45
  name/keyword pairs) and the registry test requires the suppression; keywords that appear only
  as granted/dependent text in the body (e.g. Shen, Eye of Twilight's [Tank], Kennen, Heart of the
  Tempest's [Assault 2], Sivir, Mercenary's conditional [Ganking]) are not audited yet — deriving
  printed keywords from the card text in the layers is still preferable.
- Truncated catalog text: Bonds of Strength ("Give two friendly units each +1 [Might]" has no
  duration/closing period) and Poppy, Defender of the Meek ("If you do, I cost less." has no
  amount/symbol). Both stay `manual`/`partial` until confirmed.
- No unscripted playable names remain (1090/1090 have a script).

## 7. Open RULES-QUESTIONs

- **136.2.d — "I/me" in appended Effect Text.** Plain "I/me" in an attached card's Effect Text
  (Warmog's "buff me", Cull's "When I conquer") is read as the Top-Most card; "this" and the
  attached card's name are read as the attached card. Confirm the intended reading.
- **718.3 — Pendulum Blade move trigger vs the combat staged by the same move.** Implementing the
  appended "When I move to a battlefield" trigger queues it before the Combat Task. Should it
  resolve before that combat? The engine (chain blocks cleanup) says yes; the old Riven test
  (`test/cards/ven-ogs/units-b.test.ts`) reads the attack trigger synchronously and must be updated
  before the trigger can be implemented.
- **429.5.c/.d — multi-source attribution.** `damageSource` keeps only the latest source; a kill
  is attributed to one spell/ability, not to the ability plus its creating Game Object, and
  multiple contributing sources (EX[429.5.d] Immortal Phoenix) are not represented. Combat damage
  records the assigning player, not the source unit (429.5.c.2).
- **190.6.c — "the ability indicates a specific player makes a choice".** Only a
  `cost_then.player` selector is read as that signal; battlefield abilities that name a player in
  another instruction still resolve as the battlefield's controller.
- **Bot-room `roomMode` switch.** Practice-vs-Bot creates a strict `single_player` room, then
  switches the *live* `Room.roomMode` to `multiplayer` after setup so turns alternate and the human
  never controls the bot seat (the session doc stays `single_player`). Is a cleaner flag (engine
  treats `isBot` seats as non-controlled) preferable?
- 431.2: a `channel` proposal does not carry the original "exhausted" condition (Seraphic Wyvern).
- 355.3: Encore's "Choose two" is asked on resolution because the play layer's `choose_mode` asks
  one mode; should play-time multi-mode be a first-class prompt?
- 718.5.e: an attached card may have a different controller; replacement/trigger sources use the
  host's controller (no card test exercises it).
- 820.1.a: Repeat on triggered/activated abilities is out of scope (only card items repeat).
- 822.3: finalization does not re-check unit presence for a validated play.
- 131.3.a: Power costs are stored as a count; mixed-symbol costs are processed as [C].
- 103.4: which battlefield card sits in which zone is not stored (n-th zone = n-th seated player).
- 811.1.d.2: "explicitly restricts targeting" is signalled via `hiddenUnrestricted`.
- 467.2.c.4: "excess damage" is not defined in the corpus and is not recorded (Vi, Piltover
  Enforcer; Trapping Grounds; Yeti Brawler — audit row 15).
- 811.1.b vs 411.1.a / 422.2: Hide is allowed in a Showdown Open State (the engine follows 811.1.b).
- Auto-pass defaults (`docs/rules/auto-pass.md`): should `responses` / `endTurn` default to the
  leaky "no legal response" modes as MTG Arena and LoR do? Should `ownItems` stay on by default?
  Preferences are per game (not remembered across games) and auto-action log lines are English.

## 8. Next waves

- **R5-infra (from the architecture review roadmap).** Delete the realtime fallback engine and
  duplicate deck parsers, then a typed prompt-definition registry shared by rules, engine
  gestures, bot and UI (the engine and UI `OBJECT_PROMPT_KINDS` sets already disagree), effect-op
  definitions with stable ability ids, and a per-turn ledger; later separate strict from the
  sandbox host. See `docs/reviews/architecture-extensibility-review.md`.
- **R5-scenarios.** Replace the illustrative tournament scenarios with sourced ones once coverage
  sites are reachable (this environment could not fetch them); route every play-tested bug through
  `scenario convert` into `test/scenarios/regressions/`.

- **R5-engine.** Top gaps from section 4: a per-turn history primitive (resources, deaths, XP,
  draws, conquests, excess damage, chosen objects, play locations), non-standard `Cost` parts
  (return/recycle/banish/spend buff/disempower/exhaust-two/any-amount/restricted resources),
  non-board-zone triggers (385) and trigger multiplication, cost modifiers reading paid objects /
  components / minimums, effect-driven `play` (location, player, full/partial cost), copy (446),
  control change (435/190), 429.5.d multi-source attribution, and the Pendulum Blade move-trigger
  sequencing once the Riven test is updated.
- **R5-cards.** Upgrade the remaining 191 partial / 83 manual scripts as capabilities land. Cards
  already unlocked by R4-engine E but not re-scripted: Katarina, Reckless; Bone Skewer; Edge of
  Night; Evelynn, Consuming; Tornado Warrior; Ember Monk (Elnuk Herd and Evelynn, Agony's Embrace
  are done). Then the
  older gaps (copy 446, base-Might "becomes", hand keyword grants, return-to-hand costs).
- **R5-bot.** The bot can only be as good as legal-move coverage: every legal-intent hole is a
  card self-play can never exercise. Improve policy only after coverage (prefer progress over
  pass, use `hold`, choose optional costs, non-zero X), then keep the sweep as a regression gate.
- **R5-bot-room.** Resolve the `roomMode` design question, then add a browser check of a full
  Practice-vs-Bot game (the realtime/play suites cover the protocol path).
- **R5-ui/i18n.** The strict UI still hardcodes `createTranslator("en")` in `StrictRulesPanel`,
  `RoomShell` and `GameScreen`; wire the active locale so the translated strict strings reach the
  screen. The left rules panel stays developer-only (`NODE_ENV !== "production"`).

## 9. How to resume

- **Adding or changing cards: [`docs/rules/CARD-AUTHORING.md`](docs/rules/CARD-AUTHORING.md)**
  (layout, ids, helpers, reprints, statuses, tests, i18n, new keywords and sets).
- Docs: `docs/RULES-ENGINE.md` (architecture, per-wave status, known limitations),
  `docs/rules/{play,combat,effects,int}.md` (per-domain), `docs/rules/{bot,bot-room,gestures,rewind}.md`,
  `docs/rules/{auto-pass,scenarios,edge-cases-audit}.md` (R5), `docs/reviews/` (architecture review),
  `docs/rules/cards/*.md` (per-lane card reports: gaps, bugs, custom ids, status),
  `docs/rules-coverage.md`, `docs/cards-coverage.md`, `docs/cards-index.md` (generated name →
  status → script file → tests, plus every custom id), `packages/protocol/CHANGES.md` (wire changes
  per wave). Lane hand-offs and findings are in `.orchestrator/reports/`.
- Commands:
  - `pnpm --filter @rift/rules test` (default + host)
  - `pnpm --filter @rift/rules typecheck`, `pnpm typecheck`
  - `pnpm --filter @rift/engine test` (oracle suites skip without `.recon/oracle`;
    `pnpm --filter @rift/engine typecheck:oracle` typechecks them where it exists)
  - `pnpm --filter @rift/rules scenario run test/scenarios/tournament` (step-by-step trace),
    `... scenario convert <repro.json> --at list|<i>`, `pnpm --filter @rift/rules interactions`
    (auto-pass decision counts)
  - `pnpm --filter @rift/{sync,i18n} test`, `pnpm --filter realtime test`, `pnpm --filter play test`
  - `node packages/rules/scripts/rules-coverage.mjs --check`
  - `pnpm --filter @rift/rules coverage:rules` / `coverage:cards` / `coverage:check` (CI: stale
    coverage or a registry/source-scan disagreement fails)
  - `pnpm --filter @rift/cards test` (catalog keyword audit)
- Self-play: `pnpm --filter @rift/rules selfplay`. Env: `SELFPLAY_GAMES` (50),
  `SELFPLAY_SEED_START` (1), `SELFPLAY_MAX_TURNS` (80), `SELFPLAY_MAX_ACTIONS` (4000),
  `SELFPLAY_DECK` (`fixture` | `catalog`). Example sweeps:
  `SELFPLAY_GAMES=200 pnpm --filter @rift/rules selfplay` and
  `SELFPLAY_GAMES=400 SELFPLAY_DECK=catalog SELFPLAY_SEED_START=1 pnpm --filter @rift/rules selfplay`.
- Play vs the bot locally:
  1. `pnpm install`; terminal A `pnpm --filter realtime dev` (http://localhost:1999); terminal B
     `pnpm --filter play dev` (http://localhost:3000).
  2. Sign in with `atlas` / `1234` (or guest), load/choose a legal deck.
  3. Lobby → **Private Play** → **Practice vs Bot**. The room opens strict with a `Practice Bot`
     seat; **Start Match** auto-runs battlefields, first player and both mulligans.
  4. Play through the board gestures; the server answers for the bot and hands the turn back.
  5. Rewind/forward and **Export repro** are available in Practice vs Bot (`docs/rules/rewind.md`);
     the bot waits until you act again after a rewind. The dev-only strict panel also has
     **Load repro** to open a new solo_lab room at a chosen step.
- Strict dev flag: the left `StrictRulesPanel` renders only when
  `process.env.NODE_ENV !== "production"` (`apps/play/.../strict-model.ts`), i.e. under
  `pnpm --filter play dev` and tests; `next build`/`next start` hide it. Production has chain A/S,
  board End turn, the concede entry and `StrictPromptHost`.
- Conventions (see `docs/rules/CARD-AUTHORING.md`): one card per file,
  `src/cards/<SET>/<slug>.ts`, in the set that first printed it, imported by the set barrel; the
  set's custom ids (`<set>:` prefix) and shared builders in `src/cards/<SET>/custom.ts`; shared
  builders and `core:` ids in `src/cards/lib`; card files import only `src/cards/sdk.ts`. Every
  registry throws on a duplicate name or id, so a reprint is never scripted twice; tests replace
  entries through `src/testing.ts` (`@rift/rules/testing`). Engine concepts are typed DSL members;
  `custom` ids must be prefixed. Test titles cite `[R..]`, `[EX:..]`, `[C:Card]`; a real engine
  bug found by a card test becomes `it.skip("[BUG][C:Card][R..] ...")` and a row in the lane doc.
  New `rules.prompt.*` / `rules.reason.*` keys need strings in all four
  `packages/i18n/data/i18n-*.json` catalogs (the strict locale suite derives `rules.*` from
  English). Late UI keys such as `sim.botBadge` live in `ui.patterns` with the full dotted key.
  `test/registry/` is the guardrail suite; `.github/workflows/ci.yml` runs everything.
- Declarative scenarios (tournament positions, converted repros): `docs/rules/scenarios.md`.
- Scenario DSL: `packages/rules/test/scenarios/dsl.ts`. The `extraCards` scenario option registers
  card objects for a test, e.g. `scenario({ extraCards: { p1: [...], p2: [...] } })`; see
  `test/cards/helpers.ts` (shared) and `test/cards/<lane>/helpers.ts` (lane-specific wrappers).
