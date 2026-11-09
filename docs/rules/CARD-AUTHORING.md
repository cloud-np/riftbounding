# Card authoring contract (`@rift/rules`)

How to add or change a card script — one card or a whole set — so that adding cards never
breaks the existing format. It applies to people and agents alike. The rules are enforced by
tests (`packages/rules/test/registry/`), so a violation fails `pnpm --filter @rift/rules test`
with a list of the offending names.

Background: the strict engine is described in [`docs/RULES-ENGINE.md`](../RULES-ENGINE.md); the
DSL types are in `packages/protocol/src/rules/{effects,ability}.ts`.

## 1. Where things go

| What | Location | Naming / rule |
| --- | --- | --- |
| One card | `packages/rules/src/cards/<SET>/<slug>.ts` | `<SET>` = the set that **first printed** the name (catalog order, `_setCode`). `<slug>` = name lower-cased, apostrophes dropped, every other run of non-alphanumerics → `-` (`Kha'Zix, Mutating Horror` → `khazix-mutating-horror.ts`). If two names share a slug, the later-printed one appends its catalog id (`evelynn-in-control-rad-109.ts`). **One `registerCardScript` per file.** |
| Set barrel | `src/cards/<SET>/index.ts` | `import "./custom";` first (if the set has one), then `import "./<slug>";` for every card file, alphabetically. No logic. A new set is added once to `src/cards/index.ts`. |
| Set custom code | `src/cards/<SET>/custom.ts` | The set's custom conditions/effects (ids prefixed `<set>:`, lower-case set code, e.g. `ven:`) and the builders several of its cards share. One rules citation per id. |
| Shared builders and `core:` ids | `src/cards/lib/*.ts` | `selectors`, `triggers`, `conditions`, `passives`, `costs`, `keywords`, `tokens`, `custom` (`core:` ids). Prefer these to writing new ones. |
| The card SDK | `src/cards/sdk.ts` | The **only** module a card file imports (plus its own `./custom` and `@rift/protocol` types). |
| Tokens | `src/cards/tokens/<slug>.ts`, imported by `src/cards/tokens/index.ts` | Only for names whose first printing is a token (Gold, Bomb, Shadow Clone). A name also printed as a deck card (Sprite) belongs to that card's set. |
| Tests | `packages/rules/test/cards/<set>/<slug>.test.ts` for new cards (existing lane files stay grouped) | Titles cite `[C:<Card Name>]` and `[R<rule>]` / `[EX:<rule>]`. Shared helpers: `test/cards/helpers.ts`. |
| Docs | `docs/rules/cards/<lane>.md` | Hand-written capability gaps and notes. Status tables and the name → file → test index are generated (`docs/cards-coverage.md`, `docs/cards-index.md`). |

A card file looks like this:

```ts
/** Darius, Executioner (OGN-243) — "[LEGION] - When you play me, ready me. …" (812.1.c) */
import { HERE, LEGION, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Darius, Executioner",
  text: "[LEGION] - When you play me, ready me. …",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, condition: LEGION, effect: { op: "ready", target: SELF } },
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { cardType: "unit", controller: "self", excludeSource: true, zone: HERE } } },
  ],
});
```

## 2. Rules

1. **One name, one script.** Registration throws `DuplicateRegistrationError` on a second script
   for a name (and on a second custom condition/effect, effect op, prompt or task handler for an
   id). Before writing, check `docs/cards-index.md` or `getCardScript(name)`.
   - A reprint is **not** scripted again under the new set. If the reprint's text differs
     materially (errata), update the existing script and say so in `notes`.
   - Tests that need a different script for a real card use the test-only API
     (`src/testing.ts`, also `@rift/rules/testing`): `overrideCardScript(...)` returns a restore
     function; `registerTestCardScript` is the scenario DSL's `register`.
2. **The script is the card.** `name` equals the catalog name exactly; `text` is the errata'd
   printed text (reminder text may stay). Everything the card does is in the `CardScript`
   object, as plain JSON:
   - its own additional costs: `additionalCosts: [{ id, optional, cost, rule, label?, condition? }]`
     (replaces the printed-text parser for that card);
   - extra play zones: `playPermissions: [{ id, zone: "trash" | "banished" | "deck", rule, cost?, condition? }]`;
   - "… don't deal combat damage" text: a `{ kind: "no-combat-damage", target }` passive.
   There are no per-card side registrations; card files may not call `registerAdditionalCosts`
   or `registerCombatContributionFilter`. Costs or permissions created by an *effect* (e.g.
   "until your next Ending Phase, you may play that card") are providers in the set's
   `custom.ts`.
   - **Never reorder an existing script's abilities.** Ability refs (`activated:<index>`,
     `triggered:<index>`) index the full `abilities` array and are stored on chain items. Append.
3. **Status.**
   - `implemented`: the whole printed text is enforced and tested.
   - `partial`: some of it is; `notes` says exactly what is missing and names the gap.
   - `manual`: none of it is (the §6.4 manual window); `notes` says why.
   - A keyword-only card is `implemented` with `abilities: []` only when its printed keywords are
     its catalog keywords (§6 below).
4. **Prefer the typed DSL, in this order:**
   1. core `Effect` / `Condition` / `Modifier` members (`packages/protocol/src/rules/effects.ts`),
      including the engine conditions (`did`, `paid-additional`, `self-state`, `xp-at-least`,
      `alone`, `in-ref`, `marked`, `cards-played`, `showed-off`, `event-zone-is`, …) and
      modifiers (`while`, `enter-ready`, `cost-adjust`, `show-off`, `bonus-damage`,
      `ignore-keyword`, `victory-score`, `remove-keyword`, `no-combat-damage`, …);
   2. the `cards/lib` builders through the SDK (`whilePassive`, `atLevel`, `enterReady`,
      `empower`, `costLessForEach`, `notIntrinsic`, the `WHEN_*` triggers, …);
   3. a `core:` custom id in `cards/lib/custom.ts` when two or more cards (any set) need it
      (`core:in-combat`, `core:attacking`, `core:legion`, `core:take-control`, …);
   4. a `<set>:` custom id in `<SET>/custom.ts`.

   `custom` ids are typed `CustomId` (`<owner>:<name>`): an unprefixed id does not compile.
   Never put a card-specific id in engine code.
5. **Custom code contract.**
   - Custom conditions are pure (read the room only).
   - Custom effects push interpreter frames or call SDK primitives, and emit an event for every
     change.
   - Import only from `../sdk` (and `./custom`); the import-boundary test fails otherwise.
     If you need an engine function the SDK does not export, add it to `sdk.ts` deliberately.
   - Every custom id is used by a script or by the code that pushes it, and is registered in
     `custom.ts` with the owning set's prefix (`core:` in `lib/custom.ts`).
6. **Keywords.** `KeywordName` is closed (rules 805–832 plus `Add`, `Buff`, `Burn`, `Mighty`,
   `Predict`); a value is a separate field: `{ op: "grant_keyword", keyword: "Assault", value: 2 }`,
   `{ kind: "keyword", keyword: "Shield", value: 3, target }`.
   The engine reads a permanent's printed keywords from the catalog. When the catalog lists a
   keyword the card does not have itself (reminder text, quoted token text, an ability's keyword,
   a dependent ability), add `...notIntrinsic("Keyword")` at the end of `abilities`. The
   `@rift/cards` audit (`CATALOG_KEYWORD_OVERRIDES`) classifies every catalog keyword its text
   does not name; the registry test requires a suppression for each `not-intrinsic` entry.
7. **Events, restrictions, card types.** `EventMatcher.type` is an `EventType`
   (`RULES_EVENT_TYPES` plus the aliases `die`, `played`, `deal_damage`); `restriction` is a
   `RestrictionName`; `cardType` is a `CardTypeName`; `tag` must be a catalog tag.
8. **Prompts.** A `promptKey` is a `rules.prompt.*` key in `packages/i18n/data/i18n-en.json`
   with strings in `i18n-fr.json`, `i18n-ko.json` and `i18n-zh-CN.json` (`ui.patterns`); reuse
   an existing key when the wording fits.
9. **Tests.** Each automated card gets a test that fails without its script, played through the
   scenario DSL (`test/scenarios/dsl.ts`, helpers in `test/cards/helpers.ts`). An engine bug found
   this way becomes `it.skip("[BUG][C:…][R…] …")` plus a gap row in the lane doc; do not work
   around it in the script.
10. **Engine gaps.** Do not implement a missing capability inside a card's custom code if more
    than one card needs it. Mark the card `partial`, add the gap to the lane doc, and add a typed
    DSL member in the engine (with `[R…]` tests).

**Definition of done:**

```bash
pnpm --filter @rift/rules test        # includes test/registry (integrity + duplicates)
pnpm --filter @rift/rules typecheck
pnpm --filter @rift/i18n test         # when prompt keys changed
pnpm --filter @rift/cards test        # when the catalog changed
pnpm --filter @rift/rules coverage:cards   # regenerates cards-coverage.md and cards-index.md
pnpm --filter @rift/rules coverage:rules
pnpm --filter @rift/rules coverage:check   # what CI runs
```

## 3. Adding a whole set

1. Import the catalog rows (`packages/cards/data/cards.json`). Run `pnpm --filter @rift/cards test`:
   the catalog keyword audit fails for every keyword the new text does not name — classify each
   in `CATALOG_KEYWORD_OVERRIDES` (`intrinsic` or `not-intrinsic`, with the reason).
2. Create `src/cards/<SET>/index.ts` (and `custom.ts` when needed) and add `import "./<SET>";` to
   `src/cards/index.ts`.
3. Run the registry integrity test: check (b) prints every playable name of the set without a
   script — the stub list. Reprints (names already scripted in an earlier set) are not listed and
   need no new file.
4. Script the cards following §2, then regenerate coverage.
5. New keyword or mechanic:
   - add it to `KEYWORD_NAMES` (`packages/protocol/src/rules/effects.ts`);
   - if the keyword is "functionally short for" a triggered ability, add a row to
     `KEYWORD_TRIGGERS` (`src/triggers/keywords.ts`); otherwise implement it in the owning engine
     module with `[R8xx]` tests;
   - a new event type goes into `RULES_EVENT_TYPES`; a new restriction into `RESTRICTION_KINDS`;
   - a new engine concept (a condition or modifier more than one card needs) becomes a typed
     member with an exhaustive `switch` case, not a custom id.

## 4. What the guardrails check

| Test | Checks |
| --- | --- |
| `test/registry/duplicates.test.ts` | every registry throws on a duplicate; the test-only override/restore path works |
| `test/registry/integrity.test.ts` | catalog membership; one script per playable name and per file; reprints scripted once in their first set; script text vs printings (+ errata allowlist); statuses and notes; custom ids prefixed, registered once in a `custom.ts`, referenced and used; closed keyword / event / restriction / card-type / tag vocabularies; `rules.prompt.*` keys exist; choice keys normalised; frozen, unshared scripts; catalog-keyword suppressions; layout (file = slug, owning set, barrel order); import boundary; no per-card side registrations; pinned manual activated-ability parse table |
| `packages/cards/src/catalog-keywords.test.ts` | catalog keywords vs printed text, with the explicit override table |
| `scripts/card-coverage.mjs --check` | the runtime registry and a source scan agree; `docs/cards-coverage.md` / `docs/cards-index.md` are current |
| `.github/workflows/ci.yml` | typecheck, every suite, coverage checks; nightly self-play |
