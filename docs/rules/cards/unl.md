# Unleashed (UNL) card scripts — wave R3

Lane: the Unleashed rows of `## Unscripted cards by set` in `docs/cards-coverage.md` (216 names
at wave start). Scripts live in `packages/rules/src/cards/UNL/` and are imported from
`src/cards/UNL/index.ts`: one card per module, except families of trivial cards grouped in one
module (`keyword-units.ts`: text made only of engine keywords; `level-units.ts`: [Level N]
passives; `simple-spells.ts`: one or two plain game actions; `counter-spells.ts`;
`temporary-spells.ts`; `xp-buff-units.ts`). Behaviour tests are in
`packages/rules/test/cards/unl/` (titles `[C:Card Name][R…]`). Card-specific conditions/effects
are registered in `src/cards/UNL/custom.ts` with the `unl:` prefix; `dsl-unl.ts` holds small
builders (Repeat, look-reveal-draw).

## Conventions

- **Catalog keywords from reminder/granted text are suppressed** with
  `{ kind: "keyword", keyword, value: 0 }` (727.1.b convention, 135.2.d.3): e.g. Frisky Hunter's
  and Carrion Dredger's [Deflect] (the Bird token's), Petal Pixie's [Temporary] (referenced
  text — unsuppressed, 816 would kill Petal Pixie every turn), Megatusk's [Ganking] (granted),
  Lillia, Protector of Dreams' [Tank] (granted), the [Reaction] of Ambush reminder text and the
  [Action]/[Reaction] that belong to an activated ability (135.2.e.7).
- Keywords inside a [Level N] ability are suppressed and re-granted by a `conditional` passive.
- **Token keywords come from the catalog token** (Bird → [Deflect], Sprite → [Temporary], looked
  up by name through `host.cardInfo`). Passing them again in `TokenSpec.keywords` adds a granted
  instance and doubles the value (Deflect 2 — 809.2 sums values). The pre-existing Ultrasoft
  Poro script does this (its Birds have Deflect 2); it is outside this lane's write scope.
- **Repeat** (820.1.d) is `seq [effect, if paid "cost:repeat" → effect again]`
  (`unl:paid-cost`). A repeated execution that needs its own target (820.2) gets a second choice
  key offered as "up to one" (see gaps).
- **Choices must sit in scanned fields.** `requiredChoices` only collects chosen selectors in op
  fields (`target`, `source`, `selector`, `to`, …), never inside an `Amount`. A chosen unit used
  only for "equal to its Might" is declared in `source` or a `for_each` selector (Clash of
  Giants, Stare Down). The pre-existing Challenge script keeps its friendly unit only in the
  amount, so that choice is never offered or validated on play.
- "Choose a battlefield" is a chosen battlefield object (`cardType: "battlefield"`, key
  `battlefield`); selectors then use `zone: { kind: "chosen", ref: "battlefield" }`.

## Custom ids

| id                                   | kind      | used by                | rule                 |
| ------------------------------------ | --------- | ---------------------- | -------------------- |
| `unl:died-not-alone`                 | condition | Loyal Poro             | 740.2.a, 383.2.c.3.b |
| `unl:opponent-within`                | condition | Poppy, Paragon         | 470.1                |
| `unl:paid-cost`                      | condition | Repeat cards           | 820.1.d, 355.1.a     |
| `unl:battlefield-controlled-by-team` | condition | Right of Conquest      | 190.2                |
| `unl:controls-facedown`              | condition | Monster Harpoon        | 107.3, 811           |
| `unl:at-chosen-location`             | condition | Crescent Strike        | 359.3.e, 359.3.f     |
| `unl:enemy-alone-at-chosen`          | condition | Isolate                | 740.2.a              |
| `unl:played-from-hand`               | condition | Back Off               | 811.1.b, 354         |
| `unl:unit-won-combat`                | condition | Grim Resolve           | 468.3.c              |
| `unl:you-have-units-at-it`           | condition | Moonfall               | 107.3                |
| `unl:draw-ref`                       | effect    | look-reveal-draw cards | 414.1                |
| `unl:owner-top-or-bottom`            | effect    | Keeper's Verdict       | 412.4, 355.18        |
| `unl:counter-to-hand`                | effect    | Abandon                | 426.1.a              |
| `unl:no-spells-this-turn`            | effect    | Lilting Lullaby        | 054.1                |

## Card status

<!-- status:start -->

Scripted in this lane: **74** (implemented 72, partial 2, manual 0).

| Card                        | Status      | Module                          | Notes                                                                                                                                                                                                                                                                 |
| --------------------------- | ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abandon                     | implemented | `counter-spells.ts`             |                                                                                                                                                                                                                                                                       |
| Angler Beast                | implemented | `angler-beast.ts`               |                                                                                                                                                                                                                                                                       |
| Arena Kingpin               | implemented | `arena-kingpin.ts`              |                                                                                                                                                                                                                                                                       |
| Back Off                    | implemented | `back-off.ts`                   |                                                                                                                                                                                                                                                                       |
| Bandle Soldier              | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| Bewitching Spirit           | implemented | `bewitching-spirit.ts`          |                                                                                                                                                                                                                                                                       |
| Black Rose Dignitary        | implemented | `black-rose-dignitary.ts`       |                                                                                                                                                                                                                                                                       |
| Carrion Dredger             | implemented | `carrion-dredger.ts`            |                                                                                                                                                                                                                                                                       |
| Clash of Giants             | implemented | `clash-of-giants.ts`            |                                                                                                                                                                                                                                                                       |
| Combat Experience           | implemented | `combat-experience.ts`          |                                                                                                                                                                                                                                                                       |
| Concentrate                 | implemented | `concentrate.ts`                |                                                                                                                                                                                                                                                                       |
| Crescent Strike             | implemented | `crescent-strike.ts`            |                                                                                                                                                                                                                                                                       |
| Crowd Favorite              | implemented | `xp-buff-units.ts`              |                                                                                                                                                                                                                                                                       |
| Demacian Diplomat           | implemented | `demacian-diplomat.ts`          |                                                                                                                                                                                                                                                                       |
| Disposal Order              | implemented | `disposal-order.ts`             |                                                                                                                                                                                                                                                                       |
| Divining Shells             | implemented | `divining-shells.ts`            |                                                                                                                                                                                                                                                                       |
| Double Trouble              | implemented | `double-trouble.ts`             |                                                                                                                                                                                                                                                                       |
| Downstage Dramatics         | implemented | `downstage-dramatics.ts`        |                                                                                                                                                                                                                                                                       |
| Dragonsoul Sage             | implemented | `dragonsoul-sage.ts`            |                                                                                                                                                                                                                                                                       |
| Dramatic Visionary          | implemented | `dramatic-visionary.ts`         |                                                                                                                                                                                                                                                                       |
| Enthralling Protector       | implemented | `xp-buff-units.ts`              |                                                                                                                                                                                                                                                                       |
| Evershade Stalker           | implemented | `evershade-stalker.ts`          |                                                                                                                                                                                                                                                                       |
| Flurry of Feathers          | implemented | `counter-spells.ts`             |                                                                                                                                                                                                                                                                       |
| Friendship                  | implemented | `friendship.ts`                 |                                                                                                                                                                                                                                                                       |
| Frisky Hunter               | implemented | `frisky-hunter.ts`              |                                                                                                                                                                                                                                                                       |
| Galio, Indefatigable        | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Gemhand Hunter              | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| Grim Resolve                | implemented | `grim-resolve.ts`               |                                                                                                                                                                                                                                                                       |
| Herald of Spring            | implemented | `herald-of-spring.ts`           |                                                                                                                                                                                                                                                                       |
| Heroic Charge               | implemented | `heroic-charge.ts`              |                                                                                                                                                                                                                                                                       |
| Inferna                     | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Isolate                     | implemented | `isolate.ts`                    |                                                                                                                                                                                                                                                                       |
| Keeper's Verdict            | implemented | `keepers-verdict.ts`            |                                                                                                                                                                                                                                                                       |
| Kinkou Initiate             | implemented | `kinkou-initiate.ts`            |                                                                                                                                                                                                                                                                       |
| LeBlanc, Fragmented         | implemented | `leblanc-fragmented.ts`         |                                                                                                                                                                                                                                                                       |
| Lillia, Protector of Dreams | implemented | `lillia-protector-of-dreams.ts` |                                                                                                                                                                                                                                                                       |
| Lilting Lullaby             | implemented | `counter-spells.ts`             |                                                                                                                                                                                                                                                                       |
| Loyal Poro                  | partial     | `loyal-poro.ts`                 | Aloneness is read from the units still at that location on resolution; friendly units that died simultaneously with it (e.g. The Ruination) are not seen, because last-known information about other objects at the time of death is not kept (383.2.c.3.b, 740.2.a). |
| Lunar Boon                  | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Master Yi, Tempered         | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| Master Yi, Wuju Master      | implemented | `master-yi-wuju-master.ts`      |                                                                                                                                                                                                                                                                       |
| Megatusk                    | implemented | `megatusk.ts`                   |                                                                                                                                                                                                                                                                       |
| Mischievous Marai           | implemented | `mischievous-marai.ts`          |                                                                                                                                                                                                                                                                       |
| Monster Harpoon             | implemented | `monster-harpoon.ts`            |                                                                                                                                                                                                                                                                       |
| Moonfall                    | implemented | `moonfall.ts`                   |                                                                                                                                                                                                                                                                       |
| Moonlight Affliction        | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Mosstomper                  | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| Mutated Mouser              | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Petal Pixie                 | implemented | `petal-pixie.ts`                |                                                                                                                                                                                                                                                                       |
| Poppy, Paragon              | implemented | `poppy-paragon.ts`              |                                                                                                                                                                                                                                                                       |
| Rengar, Unseen              | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Right of Conquest           | implemented | `right-of-conquest.ts`          |                                                                                                                                                                                                                                                                       |
| Ruined Rex                  | implemented | `ruined-rex.ts`                 |                                                                                                                                                                                                                                                                       |
| Scorchclaw                  | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| Scrutinizing Sergeant       | implemented | `scrutinizing-sergeant.ts`      |                                                                                                                                                                                                                                                                       |
| Shadow's Call               | implemented | `temporary-spells.ts`           | The granted [Temporary] is lost at the end of the turn by an engine bug (3d cleanup drops keywordGrants; see docs/rules/cards/unl.md).                                                                                                                                |
| Sharkling                   | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Soul Harvest                | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Soul Shepherd               | implemented | `soul-shepherd.ts`              |                                                                                                                                                                                                                                                                       |
| Sprite Burst                | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Star-Crossed                | implemented | `star-crossed.ts`               |                                                                                                                                                                                                                                                                       |
| Stare Down                  | implemented | `stare-down.ts`                 |                                                                                                                                                                                                                                                                       |
| Targonian Visionary         | implemented | `level-units.ts`                |                                                                                                                                                                                                                                                                       |
| The Ruination               | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Towering Combatant          | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Turn to Dust                | implemented | `temporary-spells.ts`           | The granted [Temporary] is lost at the end of the turn by an engine bug (3d cleanup drops keywordGrants; see docs/rules/cards/unl.md).                                                                                                                                |
| Upstage Comedy              | partial     | `upstage-comedy.ts`             | The repeated execution's target (`target:1`) is offered as 'up to one': the choice walker cannot make a choice required only when the optional Repeat cost is paid (820.2, 355.7), so a player who paid Repeat may skip the second target.                            |
| Vault Breaker               | implemented | `simple-spells.ts`              |                                                                                                                                                                                                                                                                       |
| Vi, Hotheaded               | implemented | `vi-hotheaded.ts`               |                                                                                                                                                                                                                                                                       |
| Void Assault                | implemented | `void-assault.ts`               |                                                                                                                                                                                                                                                                       |
| Voracious Gromp             | implemented | `keyword-units.ts`              |                                                                                                                                                                                                                                                                       |
| Walking Roost               | implemented | `walking-roost.ts`              |                                                                                                                                                                                                                                                                       |
| Wuju Apprentice             | implemented | `wuju-apprentice.ts`            |                                                                                                                                                                                                                                                                       |
| Xerath, Freed               | implemented | `xerath-freed.ts`               |                                                                                                                                                                                                                                                                       |

<!-- status:end -->

## Capability gaps

| Capability                                                                                                       | Rule ids             | Cards blocked  | Count |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | -------------- | ----- |
| A play-time choice required only when an optional cost (Repeat) is paid — the walker collects both `if` branches | 820.2, 355.7         | Upstage Comedy | 1     |
| Last-known information about _other_ objects at the time of a death (simultaneous deaths)                        | 383.2.c.3.b, 740.2.a | Loyal Poro     | 1     |

## Engine bugs (skipped reproductions in `test/cards/unl/bugs.test.ts`)

- **3d cleanup drops object state** (`cleanup/cleanup.ts` `expire-this-turn`): rules objects
  without buffs/baseMight/counters/grantedKeywords are deleted at the end of every turn, losing
  `hiddenTurn`/`hiddenBy` (811.1.b — a hidden card can never be played from facedown on a later
  turn) and `keywordGrants`/`mightMods`/`empowered`/`prevent`/`paidAdditionalCost` (801.3.a.3 —
  "give it [Temporary]" without a duration is gone before it can trigger: Shadow's Call, Turn to
  Dust).

## Data issue (not an engine bug, affects unscripted cards)

The catalog `keywords` list includes keywords that appear only in reminder or granted text
(Petal Pixie, Sprite Queen, Trevor Snoozebottom, Lillia, Fae Fawn and LeBlanc, Everywhere at
Once list [Temporary]; Chakram Dancer [Shield]; Lord Broadmane [Assault]; Yuumi [Tank]; Wily
Newtfish [Ganking]; …). For an **unscripted** card the layers apply them as printed keywords, so
e.g. an unscripted Sprite Queen is killed by the 816 Temporary trigger. Scripts suppress them.
