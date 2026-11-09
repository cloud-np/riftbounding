# Riftbounding strict rules engine: progress

Living status file for humans and future agents. Numbers come from the final run of wave R4
integration (branch `r4-integ2`, based on the fully merged `r4-engine`); regenerate the coverage
docs rather than editing the tables below by hand.

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

## 3. Current state

### Tests per package (final run of this branch)

| Package | Files | Passed | Skipped / failed | Notes |
| --- | ---: | ---: | --- | --- |
| `@rift/rules` (default) | 177 | 2001 | 0 / 0 | no `[BUG]` skip remains; includes `test/registry/` (integrity, duplicates, legacy state) |
| `@rift/rules` (host config) | 1 | 1 | 0 / 0 | |
| `@rift/engine` | 23 | 174 | 0 / 0 | `.recon/oracle` present; includes strict rewind/repro |
| `@rift/sync` | 6 | 58 | 0 / 0 | |
| `@rift/i18n` | 5 | 171 | 0 / 0 | includes the strict locale suite |
| `@rift/cards` | 8 | 104 | 0 / 0 | includes the catalog keyword audit |
| `realtime` | 8 | 76 | 0 / 0 | includes Practice-vs-Bot rewind/repro |
| `play` | 52 | 354 | 0 / 0 | includes gesture/board strict tests and rewind visibility |

Typecheck: `pnpm --filter @rift/rules typecheck` and root `pnpm typecheck` are clean (0 errors).

### Rules coverage (`docs/rules-coverage.md`)

666 / 2321 rule ids tested (28.7%); 1454 tagged test titles; 0 unknown ids
(`node packages/rules/scripts/rules-coverage.mjs --check`).

### Card scripts (`docs/cards-coverage.md`)

1090 playable names; **1090 scripted (100%)**, 1005 automated (92.2%), 0 unscripted.

| Status | Cards | % |
| --- | ---: | ---: |
| implemented | 805 | 73.9% |
| partial | 200 | 18.3% |
| manual | 85 | 7.8% |
| unscripted | 0 | 0.0% |

| Set | Total | Implemented | Partial | Manual | Unscripted |
| --- | ---: | ---: | ---: | ---: | ---: |
| Origins | 292 | 217 | 49 | 26 | 0 |
| Spiritforged | 221 | 167 | 33 | 21 | 0 |
| Unleashed | 219 | 157 | 38 | 24 | 0 |
| Vendetta | 167 | 121 | 46 | 0 | 0 |
| Radiance | 168 | 121 | 33 | 14 | 0 |
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

**None open.** All 25 R3 `[BUG]` reproductions and all 17 R4 self-play seeds are unskipped and
green; `packages/rules/test` contains no `it.skip`/`test.skip`. Every R4 lane's reproductions are
kept as regression tests. The only remaining defects are design/interpretation questions (next
section). The card-coverage report prints four warnings for token/marker scripts (`Bomb` twice,
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
- 479.4.c / EX[258] / EX[287]: official examples show negative Might; `effectiveMight` floors at 0.
- 811.1.d.2: "explicitly restricts targeting" is signalled via `hiddenUnrestricted`.

## 8. Next waves

- **R5-engine.** Top gaps from section 4: a per-turn history primitive (resources, deaths, XP,
  draws, conquests, excess damage, chosen objects, play locations), non-standard `Cost` parts
  (return/recycle/banish/spend buff/disempower/exhaust-two/any-amount/restricted resources),
  non-board-zone triggers (385) and trigger multiplication, cost modifiers reading paid objects /
  components / minimums, effect-driven `play` (location, player, full/partial cost), copy (446),
  control change (435/190), 429.5.d multi-source attribution, and the Pendulum Blade move-trigger
  sequencing once the Riven test is updated.
- **R5-cards.** Upgrade the remaining 200 partial / 85 manual scripts as capabilities land. Cards
  already unlocked by R4-engine E but not re-scripted: Katarina, Reckless; Bone Skewer; Edge of
  Night; Elnuk Herd; Evelynn, Consuming / Agony's Embrace; Tornado Warrior; Ember Monk. Then the
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
  `docs/rules/cards/*.md` (per-lane card reports: gaps, bugs, custom ids, status),
  `docs/rules-coverage.md`, `docs/cards-coverage.md`, `docs/cards-index.md` (generated name →
  status → script file → tests, plus every custom id), `packages/protocol/CHANGES.md` (wire changes
  per wave). Lane hand-offs and findings are in `.orchestrator/reports/`.
- Commands:
  - `pnpm --filter @rift/rules test` (default + host)
  - `pnpm --filter @rift/rules typecheck`, `pnpm typecheck`
  - `cd packages/engine && npx vitest run`
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
- Scenario DSL: `packages/rules/test/scenarios/dsl.ts`. The `extraCards` scenario option registers
  card objects for a test, e.g. `scenario({ extraCards: { p1: [...], p2: [...] } })`; see
  `test/cards/helpers.ts` (shared) and `test/cards/<lane>/helpers.ts` (lane-specific wrappers).
