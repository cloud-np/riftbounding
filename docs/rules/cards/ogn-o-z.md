# Origins (OGN) card scripts — names O–Z (wave R3)

Lane `ogn-oz`. Scripts live in `packages/rules/src/cards/OGN/<slug>.ts` and are imported from
`packages/rules/src/cards/OGN/batch-o-z.ts`; behaviour tests are in
`packages/rules/test/cards/ogn-o-z/` (one test per card, titled `[C:Card Name]` plus rule ids).
Card text is the current text from `packages/cards/data/cards.json` (errata applied).

Custom conditions/effects registered by this lane use the `ogn-oz:` prefix and are registered in
the script file of the card that needs them (cards sharing one import that file).

## Capability gaps

| Capability | Rule ids | Cards blocked | Count |
| ---------- | -------- | ------------- | ----: |

## Card status

| Card              | Status      | Notes                                               |
| ----------------- | ----------- | --------------------------------------------------- |
| Pakaa Cub         | implemented | [Hidden] keyword (play layer).                      |
| Petty Officer     | implemented | [Assault] keyword (combat layer).                   |
| Playful Phantom   | implemented | Vanilla.                                            |
| Pouty Poro        | implemented | [Deflect] keyword (play layer).                     |
| Primal Strength   | implemented |                                                     |
| Progress Day      | implemented |                                                     |
| Recruit           | implemented | Vanilla.                                            |
| Recruit v2        | implemented | Vanilla.                                            |
| Recruit v3        | implemented | Vanilla.                                            |
| Rune Prison       | implemented |                                                     |
| Shen, Kinkou      | implemented | [Reaction], [Shield 2], [Tank] keywords.            |
| Shipyard Skulker  | implemented | Vanilla.                                            |
| Smoke Screen      | implemented | 479.4.b minimum snapshot (`give_might` `min`).      |
| Sprite            | implemented | [Temporary] keyword trigger.                        |
| Stalwart Poro     | implemented | [Shield] read from the printed line (combat layer). |
| Sunlit Guardian   | implemented | [Shield], [Tank] keywords.                          |
| Thermo Beam       | implemented |                                                     |
| Vanguard Sergeant | implemented | Vanilla.                                            |
| Vengeance         | implemented |                                                     |
| Wind Wall         | implemented |                                                     |
