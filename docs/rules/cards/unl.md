# Unleashed (UNL) card scripts — wave R3

Lane: the Unleashed rows of `## Unscripted cards by set` in `docs/cards-coverage.md` (216 names
at wave start). Scripts live in `packages/rules/src/cards/UNL/` and are imported from
`src/cards/UNL/index.ts`: one card per module, except two families of trivial cards
(`keyword-units.ts`: text made only of engine keywords; `level-units.ts`: [Level N] passives) and
the shared ability of `xp-buff-units.ts`. Behaviour tests are in `packages/rules/test/cards/unl/`
(titles `[C:Card Name][R…]`). Card-specific conditions/effects are registered in
`src/cards/UNL/custom.ts` with the `unl:` prefix.

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

## Custom ids

| id                    | kind      | used by               | rule                 |
| --------------------- | --------- | --------------------- | -------------------- |
| `unl:died-not-alone`  | condition | Loyal Poro            | 740.2.a, 383.2.c.3.b |
| `unl:opponent-within` | condition | Poppy, Paragon        | 470.1                |
| `unl:draw-ref`        | effect    | (look-and-draw cards) | 414.1                |

## Card status

| Card                        | Status      | Notes                                                                 |
| --------------------------- | ----------- | --------------------------------------------------------------------- |
| Angler Beast                | implemented |                                                                       |
| Arena Kingpin               | implemented |                                                                       |
| Bandle Soldier              | implemented |                                                                       |
| Bewitching Spirit           | implemented |                                                                       |
| Black Rose Dignitary        | implemented | Assault is the engine keyword                                         |
| Carrion Dredger             | implemented |                                                                       |
| Crowd Favorite              | implemented |                                                                       |
| Demacian Diplomat           | implemented |                                                                       |
| Divining Shells             | implemented | Vision is the engine keyword                                          |
| Dragonsoul Sage             | implemented |                                                                       |
| Dramatic Visionary          | implemented |                                                                       |
| Enthralling Protector       | implemented |                                                                       |
| Evershade Stalker           | implemented |                                                                       |
| Frisky Hunter               | implemented |                                                                       |
| Galio, Indefatigable        | implemented | "I don't deal combat damage" is read by R2-combat                     |
| Gemhand Hunter              | implemented |                                                                       |
| Herald of Spring            | implemented | Hunt is the engine keyword                                            |
| Inferna                     | implemented | keywords only                                                         |
| Kinkou Initiate             | implemented |                                                                       |
| LeBlanc, Fragmented         | implemented |                                                                       |
| Lillia, Protector of Dreams | implemented |                                                                       |
| Loyal Poro                  | partial     | units that died simultaneously are not seen (no LKI of other objects) |
| Master Yi, Tempered         | implemented |                                                                       |
| Master Yi, Wuju Master      | implemented |                                                                       |
| Megatusk                    | implemented |                                                                       |
| Mischievous Marai           | implemented | facedown play needs the hiddenTurn bug fix (see Engine bugs)          |
| Mosstomper                  | implemented |                                                                       |
| Mutated Mouser              | implemented | keywords only                                                         |
| Petal Pixie                 | implemented |                                                                       |
| Poppy, Paragon              | implemented |                                                                       |
| Rengar, Unseen              | implemented | keywords only                                                         |
| Ruined Rex                  | implemented |                                                                       |
| Scorchclaw                  | implemented |                                                                       |
| Scrutinizing Sergeant       | implemented |                                                                       |
| Sharkling                   | implemented | keywords only                                                         |
| Soul Shepherd               | implemented |                                                                       |
| Targonian Visionary         | implemented |                                                                       |
| Towering Combatant          | implemented | keywords only                                                         |
| Vi, Hotheaded               | implemented |                                                                       |
| Voracious Gromp             | implemented | keywords only                                                         |
| Walking Roost               | implemented |                                                                       |
| Wuju Apprentice             | implemented |                                                                       |
| Xerath, Freed               | implemented |                                                                       |

## Capability gaps

| Capability                                                                                | Rule ids             | Cards blocked | Count |
| ----------------------------------------------------------------------------------------- | -------------------- | ------------- | ----- |
| Last-known information about _other_ objects at the time of a death (simultaneous deaths) | 383.2.c.3.b, 740.2.a | Loyal Poro    | 1     |

## Engine bugs (skipped reproductions in `test/cards/unl/bugs.test.ts`)

- **3d cleanup drops object state** (`cleanup/cleanup.ts` `expire-this-turn`): rules objects
  without buffs/baseMight/counters/grantedKeywords are deleted at the end of every turn, losing
  `hiddenTurn`/`hiddenBy` (811.1.b — a hidden card can never be played from facedown on a later
  turn) and `keywordGrants`/`mightMods`/`empowered`/`prevent`/`paidAdditionalCost` (801.3.a.3 —
  "give it [Temporary]" without a duration is gone before it can trigger).

## Data issue (not an engine bug, affects unscripted cards)

The catalog `keywords` list includes keywords that appear only in reminder or granted text
(Petal Pixie, Sprite Queen, Trevor Snoozebottom, Lillia, Fae Fawn and LeBlanc, Everywhere at
Once list [Temporary]; Chakram Dancer [Shield]; Lord Broadmane [Assault]; Yuumi [Tank]; Wily
Newtfish [Ganking]; …). For an **unscripted** card the layers apply them as printed keywords, so
e.g. an unscripted Sprite Queen is killed by the 816 Temporary trigger. Scripts suppress them.
