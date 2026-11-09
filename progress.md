# Riftbounding strict rules engine: progress

Living status file for humans and future agents. Numbers come from the final run of wave R3
integration (branch `claude/bold-franklin-p167ug`); regenerate the coverage docs rather than
editing the tables below by hand.

## 1. Goal and process

Strict mode (`@rift/rules`) must follow the official Riftbound Core Rules (2026-10-09,
`packages/rules/corpus/core-rules-2026-10-09.txt`, errata in `corpus/errata/`, card text in
`packages/cards/data/cards.json`) exactly. Method, repeated per rule: find the rule text, write a
small pure function, add tests whose titles cite `[R<id>]` / `[EX:<id>]` / `[C:<Card>]`, verify,
continue. Work is split into waves of parallel sub-agents, each in a file-ownership lane; a lead
(integration engineer) merges the lanes, resolves duplicates, gets the whole workspace green and
regenerates the coverage docs.

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
  Ganking from passives 810.3). This branch. Integration found no duplicate script names or
  custom ids; the only cross-lane fallout was missing English strings for the new prompt keys.

## 3. Current state

### Tests per package (final run)

| Package | Passed | Skipped / failed | Notes |
| --- | ---: | --- | --- |
| `@rift/rules` (default) | 1537 | 25 skipped (all `[BUG]`), 0 failed | 113 files; property `play`/`timing` pass on a quiet machine |
| `@rift/rules` (host config) | 1 | 0 | |
| `@rift/engine` | 13 | 40 skipped | oracle fixtures not committed (baseline) |
| `@rift/sync` | 54 | 0 | |
| `@rift/i18n` | 144 | 0 | 15 new strict-string tests (R3 prompt keys) |
| `realtime` | 69 | 0 | |
| `play` | 278 | 0 | |

Typecheck: `@rift/rules` and `@rift/protocol` clean; `@rift/engine` shows only the pre-existing
`.recon/oracle` errors in `test/helpers/oracle-fuzz-fixtures.ts`.

### Rules coverage (`docs/rules-coverage.md`)

631 / 2321 rule ids tested (27.2%); 0 unknown ids (`rules-coverage.mjs --check`).

### Card scripts (`docs/cards-coverage.md`)

1090 playable names; 967 scripted (88.7%), 911 automated (83.6%).

| Status | Cards | % |
| --- | ---: | ---: |
| implemented | 673 | 61.7% |
| partial | 238 | 21.8% |
| manual | 56 | 5.1% |
| unscripted | 123 | 11.3% |

| Set | Total | Implemented | Partial | Manual | Unscripted |
| --- | ---: | ---: | ---: | ---: | ---: |
| Origins | 292 | 208 | 54 | 30 | 0 |
| Spiritforged | 221 | 119 | 78 | 23 | 1 |
| Unleashed | 219 | 145 | 33 | 2 | 39 |
| Vendetta | 167 | 80 | 46 | 1 | 40 |
| Radiance | 168 | 99 | 26 | 0 | 43 |
| Proving Grounds | 23 | 22 | 1 | 0 | 0 |

## 4. Ranked capability gaps

Merged from the "Capability gaps" tables in `docs/rules/cards/*.md`, ranked by cards blocked.
Counts are approximate (near-duplicates across lanes merged by hand; a card can need several
gaps). Detail and card names are in the lane docs: `ogn-a-n`, `ogn-o-z`, `sfd`, `unl`, `ven-ogs`,
`rad`.

| # | Gap | Rules | ~Cards |
| ---: | --- | --- | ---: |
| 1 | Built-in Equip resolves in the manual window instead of attaching (`equip:<n>` has no ability in `executeCardScript`) | 818.1.c.2 | 30 SFD (+2 RAD) |
| 2 | Per-turn history for conditions: resources spent (this turn / on a card), units died, XP gained, Nth draw, conquered/scored this turn, excess combat damage, objects chosen this turn, where cards were played | 165, 357, 383.1.b, 423, 429, 467.2.c.4, 728-733, 355.7 | ~25 |
| 3 | Spend-a-buff, variable and non-standard costs: spend a buff, "recycle N from trash", Disempower as a cost, exhaust two objects, optional additional costs that read/reduce the cost, any-amount payments | 356.2.b, 357.2, 417.6, 443, 203.3, 355.13 | ~25 |
| 4 | Play-location permissions and restrictions: play to an open/occupied battlefield, location choice for effect plays, destination-qualified move restrictions, player-scoped restrictions | 355.2, 355.17, 054.1, 420.3.b, 421 | ~20 |
| 5 | Weaponmaster and Quick-Draw attach triggers not emitted | 821.1.b/c, 819.1.d | 13 |
| 6 | Triggered abilities of attached cards are never detected (`triggers/detect.ts` skips them) plus non-host attached Effect Text | 718.3, 719.1 | ~15 |
| 7 | Last-known information on `kill`/`die` events: stunned, buff, Empowered, other objects dying simultaneously, Deathknell "here" | 383.2.c.3, 359.3.e.13, 424, 808 | ~8 |
| 8 | Triggers of cards in non-board zones (hand, trash, revealed from deck) and trigger multiplication ("additional time", "Nth time") | 385, 383.1, 383.4 | ~12 |
| 9 | Repeat resolving only once (and the second execution's play-time choices) | 820.1.d, 820.2 | ~10 |
| 10 | Effect-driven plays: play from trash, play by another player, limited cost (ignore only Energy), full 356 cost, reveal-until / look-then-play | 354, 420.3, 425, 355.18 | ~14 |
| 11 | Bomb gear token script and Deathknell | 187, 808 | 7 |
| 12 | Optional replacements with a payment ("you may pay ... instead"); replacing token plays/reveals | 371.2 (pay part), 445, 186, 375 | ~7 |
| 13 | Copy effects (copy text, Reflection tokens), play-from-trash permissions | 446 | ~5 |
| 14 | Cost modifiers affecting opponents and cost modifiers reading paid objects; per-discount minimum of 1 | 356.3, 356.4.c, 366 | ~10 |
| 15 | Battlefield phase triggers for "each player" / that player's first Beginning Phase | 315.2.a.1 | 3 |
| 16 | Control change (take control, chain-item control) | 435, 190, 360 | 3 |
| 17 | Gear enters exhausted; one-shot enter-ready/cost effects consumed by the wrong card | 149.1, 369.3, 420.5 | ~5 |
| 18 | Damage doubling and lethal-damage modifiers; Bonus Damage filtered by source type | 433.1.b, 142.4.b, 712-715 | ~5 |
| 19 | Move events lacking the mover / player-level move events | 412.4, 421 | 3 |

Fixed by R3-engine (cards can be upgraded in R4-cards): damage split and group targeting
(Volibear Furious, UNL damage-split cards), Show Off (Battle Preparations, Rousing Display), Flow
(Lacerate, Death Mark, Lightning Rush, Kennen Storm of Shuriken), optional replacement prompts and
ordering, Ganking from passives (Windswept Hillock test now enabled).

## 5. Known engine bugs

25 `it.skip("[BUG]...")` tests; each was re-run unskipped after the merge and still fails.

| File (under `packages/rules/test/cards/`) | Rule ids | Bug |
| --- | --- | --- |
| `ogn-a-n/batch6.test.ts` | 317.2.c, 816.1.b | Temporary granted to gear is dropped at expiration (Fading Memories) |
| `ven-ogs/batch4-more.test.ts` | 054.1 | Play restriction on a card in hand is ignored (Ol' Poro) |
| `ven-ogs/bugs.test.ts` | 442.2, 317.2.c | 0-Might unit loses Empowered at expiration (Steel Paws) |
| `ven-ogs/bugs.test.ts` | 442.2, 317.2.c | Empowered gear loses Empowered at expiration (Tools of Empire) |
| `ven-ogs/bugs.test.ts` | 809.1.c, 809.2 | Deflect values charged as 1 (Nasus, Ascended); passive Deflect uncharged |
| `ven-ogs/bugs.test.ts` | 356.4.f.1, 355.1.a | Paying with runes counts as paying the optional additional cost |
| `ven-ogs/bugs.test.ts` | 359.3.f.3.a, 391.3 | Delayed replacement matcher ignores creator's choices (Highlander) |
| `unl/bugs.test.ts` | 811.1.b, 317.2.c | Hidden record wiped at end of turn: card hidden last turn can't be played facedown |
| `unl/bugs.test.ts` | 801.3.a.3, 317.2.c | Permanent keyword grant dropped at end of turn (expiration keep-list) |
| `unl/bugs.test.ts` | 356.4.f.1, 355.1.a | Rune payment counted as optional additional cost |
| `unl/bugs.test.ts` | 822.1.b, 308.1.a | Ambush to a battlefield you control during a showdown there |
| `unl/bugs.test.ts` | 391.3, 359.3.f.3.a | Delayed replacement matcher ignores creator's choices |
| `unl/bugs.test.ts` | 420.3.b, 355.2.b | Limited `play` can't enter a battlefield without friendly units |
| `unl/bugs.test.ts` | 820.1.c | Repeat cost parser rejects "[Repeat] - Discard 1" |
| `sfd/bugs.test.ts` | 820.1.d, 820.1.d.1 | Paid Repeat executes the effect once (Feral Strength) |
| `sfd/bugs.test.ts` | 818.1.c.2 | Equip does not attach (Doran's Blade) |
| `sfd/bugs.test.ts` | 821.1.b | No Weaponmaster trigger on play (Combat Chef) |
| `sfd/bugs.test.ts` | 375, 359.3.f.3.a | Delayed replacement matcher ignores creator's choices (Counter Strike) |
| `sfd/bugs.test.ts` | 819.1.d | No Quick-Draw attach trigger (Long Sword) |
| `rad/bugs.test.ts` | 811.1.b, 317.2.c | Hidden card can't be played from face down (The Waters' Wage) |
| `rad/bugs.test.ts` | 830.1.b | Deploy gear not killed when an opponent holds its battlefield (no Deploy hold trigger) |
| `rad/bugs.test.ts` | 818.1.c.2 | Equip does not attach (Nazuman Ntofo) |
| `rad/bugs.test.ts` | 356.4.f.1 | Rune payment counted as optional additional cost (Shimmering Swimmer, Clockwork Keeper) |
| `rad/bugs.test.ts` | 355.7, 383.2.c.3 | Deathknell can't choose a Target "here" (Mournful Spirit) |
| `rad/bugs.test.ts` | 424, 383.2.c.3 | Die event lacks the dead unit's stunned status (Storm Raptor) |

Root causes shared by several: the 317.2.c `expire-this-turn` keep-list in `cleanup/cleanup.ts`
drops `keywordGrants`, `mightMods`, `prevent`, `empowered`, `paidAdditionalCost` and the hidden
record; `paidCostRecord` (`play/payment.ts`) puts rune payments in `paid.additional`;
`replacements/interceptor.ts` `matchesProposal` ignores stored `choices`; `deflectCosts` reads
`cardKeywords` (no passives).

## 6. Data issue

Catalog `keywords` include keywords that appear only in reminder or granted text, mostly token
text (Gold gives [Reaction]/Add, Ganking; Petal Pixie/Sprite Queen list Temporary; Chakram Dancer
Shield; Lord Broadmane Assault; Yuumi Tank; Wily Newtfish Ganking). Unscripted cards apply them as
printed keywords (an unscripted Sprite Queen dies to the 816 Temporary trigger). Some scripts
suppress them per card; a catalog or engine-level fix (derive keywords from card text) is
preferable. Also: Bonds of Strength text looks truncated in the catalog (scripted `manual`).

## 7. Open RULES-QUESTIONs

- 103.4: which battlefield card sits in which zone is not stored (n-th zone = n-th seated player).
- 479.4.c / EX[258] / EX[287]: official examples show negative Might; `effectiveMight` floors at 0.
- Phase triggers with no explicit owner are read as "your phase" (816.1.b Temporary).
- 131.3.a: Power costs are stored as a count; mixed-symbol costs processed as [C].
- 356.4.c / 356.4.d / 356.4.e: no per-discount minimum or component in `CostAdjustment`.
- 356.4.b: an [A] discount reduces the most restrictive Power requirement first.
- 411.2: which Domain of rune pays an [A]/[C] slot is canonical unless the client sends a plan.
- 811.1.d.2: "explicitly restricts targeting" is signalled via `hiddenUnrestricted`.
- 190: no stored battlefield controller beyond the presence proxy refined by Contested.
- Combat: 466.2.c.1 (absent Contested applier), 464.3 (3+ players defend), 464.1 (literal move
  bar), 467.2.c.10 (immune units), 467.2.c.9 (256 combination cap), 190.3.b (non-combat showdown
  without control clears Contested), 491.8.c / 190.3.a (2v2 teammate), 491.8.g.1 (per-player
  "scored every battlefield").
- 652 / 651.3: removed Turn Player's turn hand-off; combat effect of a removed combatant.
- `single_player` strict rewind (see section 8).

## 8. Next waves

- **R4-engine.** Top gaps and bugs from sections 4 and 5, plus R3-engine leftovers: player-level
  restrictions in `restrictionFor`; copy (446), hide as an effect (422), 439 Replace, 433.1.b
  damage doubling; triggers from hand/trash (385) and Predict reorder (437.1.a); layer dependency
  (480-481) and "becomes" effects; effect-driven move checks (449.2.a/464.1); `restoreRulesState`
  restoring chain/control/combat; spend-a-buff cost; `play` op with full costs and a player param;
  kill last-known info; per-turn history; "you may pay ... instead" (445).
- **R4-cards.** Upgrade partial/manual cards as capabilities land (including the cards freed by
  Show Off, Flow and damage split), then the 123 unscripted cards. Janna, Savior conflicts with
  `test/rules/reaction-permanents.test.ts`, which uses her as a vanilla Reaction unit; give that
  test a vanilla override (as it does for Treasure Hunter) first.
- **R2-int leftovers.** Strict hand/drag/context-menu actions, payment / optional-cost / Hide UI,
  a real browser check, fr/ko/zh-CN strings for the strict-rules keys (English fallback today),
  opaque card ids (ids encode the card face).
- **`single_player` rewind.** Strict rewind is rejected outside `solo_lab`; whether practice-vs-bot
  rooms should allow it is pending with the user.

## 9. How to resume

- Docs: `docs/RULES-ENGINE.md` (architecture, status, known limitations), `docs/rules/{play,
  combat,effects,int}.md` (per-domain), `docs/rules/cards/*.md` (per-lane card reports: gaps,
  bugs, custom ids, status), `docs/rules-coverage.md`, `docs/cards-coverage.md`,
  `packages/protocol/CHANGES.md` (wire changes per wave).
- Commands:
  - `pnpm --filter @rift/rules test` (default + host; property `play`/`timing` take ~2 min)
  - `pnpm --filter @rift/rules typecheck`, `pnpm --filter @rift/protocol typecheck`
  - `cd packages/engine && npx vitest run`
  - `pnpm --filter @rift/{sync,i18n} test`, `pnpm --filter realtime test`, `pnpm --filter play test`
  - `node packages/rules/scripts/rules-coverage.mjs --check`
  - `pnpm --filter @rift/rules coverage:rules` / `coverage:cards` to regenerate the coverage docs
- Conventions: one lane owns `src/cards/<SET>/**`, `test/cards/<lane>/**` and
  `docs/rules/cards/<lane>.md`; the registry is keyed by card name and the last registration wins
  silently, so check for duplicate names (and custom ids, prefixed per lane such as `rad:`,
  `sfd:`, `ven:`) after merging. Test titles cite `[R..]`, `[EX:..]`, `[C:Card]`; a real engine bug
  found by a card test becomes `it.skip("[BUG][C:Card][R..] ...")` and a row in the lane doc. New
  `rules.prompt.*` keys and prompt reasons need English strings in
  `packages/i18n/data/i18n-en.json` (the i18n suite derives the list from source).
- Scenario DSL: `packages/rules/test/scenarios/dsl.ts`. The `extraCards` scenario option registers
  card objects for a test, e.g. `scenario({ extraCards: { p1: [...], p2: [...] } })`; see
  `test/cards/<lane>/helpers.ts` for the per-lane wrappers.
