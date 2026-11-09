# Unleashed (UNL) card scripts — wave R3

Lane: the Unleashed rows of `## Unscripted cards by set` in `docs/cards-coverage.md` (216 names
at wave start). Scripts live in `packages/rules/src/cards/UNL/<slug>.ts` (one card per module,
imported from `src/cards/UNL/index.ts`); behaviour tests in `packages/rules/test/cards/unl/`
(titles `[C:Card Name][R…]`). Card-specific conditions/effects are registered in
`src/cards/UNL/custom.ts` with the `unl:` prefix.

## Custom ids

| id                    | kind      | used by               | rule                 |
| --------------------- | --------- | --------------------- | -------------------- |
| `unl:died-not-alone`  | condition | Loyal Poro            | 740.2.a, 383.2.c.3.b |
| `unl:opponent-within` | condition | Poppy, Paragon        | 470.1                |
| `unl:draw-ref`        | effect    | (look-and-draw cards) | 414.1                |

## Card status

| Card                  | Status      | Notes                                                                 |
| --------------------- | ----------- | --------------------------------------------------------------------- |
| Angler Beast          | implemented |                                                                       |
| Bewitching Spirit     | implemented |                                                                       |
| Black Rose Dignitary  | implemented | Assault is the engine keyword                                         |
| Carrion Dredger       | implemented |                                                                       |
| Demacian Diplomat     | implemented |                                                                       |
| Dramatic Visionary    | implemented |                                                                       |
| Evershade Stalker     | implemented |                                                                       |
| Frisky Hunter         | implemented |                                                                       |
| Herald of Spring      | implemented | Hunt is the engine keyword                                            |
| Kinkou Initiate       | implemented |                                                                       |
| LeBlanc, Fragmented   | implemented |                                                                       |
| Loyal Poro            | partial     | units that died simultaneously are not seen (no LKI of other objects) |
| Mischievous Marai     | implemented | facedown play needs the hiddenTurn bug fix (see Engine bugs)          |
| Poppy, Paragon        | implemented |                                                                       |
| Ruined Rex            | implemented |                                                                       |
| Scrutinizing Sergeant | implemented |                                                                       |
| Walking Roost         | implemented |                                                                       |
| Wuju Apprentice       | implemented |                                                                       |

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
