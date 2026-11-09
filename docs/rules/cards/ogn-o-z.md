# Origins (OGN) card scripts — names O–Z (wave R3)

Lane `ogn-oz`. Scripts live in `packages/rules/src/cards/OGN/<slug>.ts` and are imported from
`packages/rules/src/cards/OGN/batch-o-z.ts`; behaviour tests are in
`packages/rules/test/cards/ogn-o-z/` (one test per card, titled `[C:Card Name]` plus rule ids).
Card text is the current text from `packages/cards/data/cards.json` (errata applied).

Custom conditions/effects registered by this lane use the `ogn-oz:` prefix and are registered in
the script file of the card that needs them (cards sharing one import that file).

## Capability gaps

| Capability                                                                                                                            | Rule ids                | Cards blocked                     | Count |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- | ----: |
| `ready` events carry no responsible player, and the Awaken Phase readies through one `ready_all` event (no per-object `ready` events) | 412.4, 315.1.b, 416     | Pirate's Haven                    |     1 |
| Player-level move event ("an opponent moves …", once per move action)                                                                 | 421, 447                | Volibear, Imposing                |     1 |
| `kill` events lack last-known buff / stunned state for leave-the-board trigger conditions                                             | 383.2.c.3.b, 359.3.e.13 | Vanguard Helm, Solari Shrine      |     2 |
| Destination-qualified move restriction ("can't move from here to base"): `restrictionFor` ignores the move query's `to`               | 054.1, 421              | Vilemaw's Lair                    |     1 |
| [BUG] Standard Move legality reads Ganking without keyword passives (host-less `effectiveKeywords` array form)                        | 810.3, 144.4.c.1        | Windswept Hillock                 |     1 |
| Cost-layer conditions see Might at layer depth 1 (no passive/continuous/Assault-Shield Might)                                         | 478.1.c, 356.4          | Sky Splitter                      |     1 |
| Optional replacement effects with a payment ("you may pay … to … instead")                                                            | 371.2, 445, 369         | Unlicensed Armory, Sett, The Boss |     2 |
| One-shot enter-ready replacement used up by the next unit played                                                                      | 369.3, 420.5            | Sun Disc                          |     1 |
| Alternative Hide cost ([1] instead of [Rune])                                                                                         | 811.1.a, 422            | Teemo, Swift Scout                |     1 |
| "Spend a buff" as a cost (activation cost or optional additional cost)                                                                | 702.2.b, 356.2.b, 376   | Wallop                            |     1 |
| Triggered abilities of cards in non-board zones (hand/trash)                                                                          | 385                     | Scrapheap                         |     1 |

## Card status

80 of 131 scripted: 67 implemented, 9 partial, 4 manual.

| Card                         | Status      | Notes                                                                                                                                                                              |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orb of Regret                | implemented |                                                                                                                                                                                    |
| Pack of Wonders              | implemented |                                                                                                                                                                                    |
| Pakaa Cub                    | implemented |                                                                                                                                                                                    |
| Peak Guardian                | implemented |                                                                                                                                                                                    |
| Petty Officer                | implemented |                                                                                                                                                                                    |
| Pirate's Haven               | manual      | Trigger detection blocked: `ready` events have no responsible player (412.4) and the Awaken Phase readies via one `ready_all` event without per-object `ready` events (315.1.b).   |
| Pit Crew                     | implemented |                                                                                                                                                                                    |
| Pit Rookie                   | implemented |                                                                                                                                                                                    |
| Playful Phantom              | implemented |                                                                                                                                                                                    |
| Poro Herder                  | implemented |                                                                                                                                                                                    |
| Pouty Poro                   | implemented |                                                                                                                                                                                    |
| Primal Strength              | implemented |                                                                                                                                                                                    |
| Progress Day                 | implemented |                                                                                                                                                                                    |
| Qiyana, Victorious           | implemented |                                                                                                                                                                                    |
| Ravenbloom Student           | implemented |                                                                                                                                                                                    |
| Recruit                      | implemented |                                                                                                                                                                                    |
| Recruit v2                   | implemented |                                                                                                                                                                                    |
| Recruit v3                   | implemented |                                                                                                                                                                                    |
| Rhasa the Sunderer           | implemented |                                                                                                                                                                                    |
| Riptide Rex                  | implemented |                                                                                                                                                                                    |
| Rune Prison                  | implemented |                                                                                                                                                                                    |
| Scrapheap                    | partial     | The 'discarded' trigger is manual: triggers of cards in non-board zones (385) are not detected.                                                                                    |
| Scrapyard Champion           | implemented |                                                                                                                                                                                    |
| Seal of Discord              | implemented |                                                                                                                                                                                    |
| Seal of Focus                | implemented |                                                                                                                                                                                    |
| Seal of Insight              | implemented |                                                                                                                                                                                    |
| Seal of Rage                 | implemented |                                                                                                                                                                                    |
| Seal of Strength             | implemented |                                                                                                                                                                                    |
| Seal of Unity                | implemented |                                                                                                                                                                                    |
| Sett, Kingpin                | implemented |                                                                                                                                                                                    |
| Sett, The Boss               | partial     | The 'would die … instead' ability is manual: optional replacements with costs (371.2, 445) are not supported.                                                                      |
| Shen, Kinkou                 | implemented |                                                                                                                                                                                    |
| Shipyard Skulker             | implemented |                                                                                                                                                                                    |
| Sky Splitter                 | partial     | Cost reduction reads Might at layer depth 1 (478.1.c): Might granted by passives, continuous effects or Assault/Shield is not counted.                                             |
| Smoke Screen                 | implemented |                                                                                                                                                                                    |
| Soaring Scout                | implemented |                                                                                                                                                                                    |
| Solari Chief                 | implemented |                                                                                                                                                                                    |
| Solari Shieldbearer          | implemented |                                                                                                                                                                                    |
| Solari Shrine                | manual      | `kill` events carry no last-known stunned state (383.2.c.3.b), so "a stunned enemy unit" cannot be matched.                                                                        |
| Spirit's Refuge              | implemented |                                                                                                                                                                                    |
| Sprite                       | implemented |                                                                                                                                                                                    |
| Sprite Mother                | implemented |                                                                                                                                                                                    |
| Stalwart Poro                | implemented |                                                                                                                                                                                    |
| Stand United                 | implemented |                                                                                                                                                                                    |
| Stealthy Pursuer             | implemented |                                                                                                                                                                                    |
| Stormclaw Ursine             | implemented |                                                                                                                                                                                    |
| Sun Disc                     | partial     | The effect resolves in the manual window: a one-shot enter-ready replacement consumed by the next unit played (369.3, 420.5) is not supported.                                     |
| Sunlit Guardian              | implemented |                                                                                                                                                                                    |
| Taric, Protector             | implemented |                                                                                                                                                                                    |
| Tasty Faefolk                | implemented |                                                                                                                                                                                    |
| Teemo, Scout                 | implemented |                                                                                                                                                                                    |
| Teemo, Swift Scout           | partial     | The alternative Hide cost ([1] instead of [Rune], 811.1.a) is not supported by the play layer's Hide action.                                                                       |
| The Syren                    | implemented |                                                                                                                                                                                    |
| Thermo Beam                  | implemented |                                                                                                                                                                                    |
| Thousand-Tailed Watcher      | implemented |                                                                                                                                                                                    |
| Traveling Merchant           | implemented |                                                                                                                                                                                    |
| Treasure Trove               | implemented |                                                                                                                                                                                    |
| Trifarian Gloryseeker        | implemented |                                                                                                                                                                                    |
| Trifarian War Camp           | implemented |                                                                                                                                                                                    |
| Unlicensed Armory            | partial     | The effect resolves in the manual window: optional replacements with a payment (371.2, 445) are not supported.                                                                     |
| Vanguard Captain             | implemented |                                                                                                                                                                                    |
| Vanguard Helm                | manual      | `kill` events carry no last-known buff state (383.2.c.3.b), so "a buffed friendly unit dies" cannot be matched.                                                                    |
| Vanguard Sergeant            | implemented |                                                                                                                                                                                    |
| Vengeance                    | implemented |                                                                                                                                                                                    |
| Viktor, Herald of the Arcane | implemented |                                                                                                                                                                                    |
| Viktor, Innovator            | implemented |                                                                                                                                                                                    |
| Vilemaw's Lair               | manual      | Destination-qualified move restrictions are not supported: restrictionFor ignores the `to` of a move query (054.1, 421).                                                           |
| Volibear, Imposing           | partial     | The draw trigger is manual: no player-level move event (one per move action, 421/447) exists, only per-unit `move` events.                                                         |
| Volibear, Relentless Storm   | implemented |                                                                                                                                                                                    |
| Wallop                       | partial     | The optional additional cost (spend a buff, 702.2.b) and its cost-ignoring discount (356.2.b) are not payable by the play layer.                                                   |
| Warwick, Hunter              | implemented |                                                                                                                                                                                    |
| Watchful Sentry              | implemented |                                                                                                                                                                                    |
| Wielder of Water             | implemented |                                                                                                                                                                                    |
| Wildclaw Shaman              | implemented |                                                                                                                                                                                    |
| Wind Wall                    | implemented |                                                                                                                                                                                    |
| Windswept Hillock            | partial     | Standard Move legality (legality/move.ts via play/keywords cardKeywords) ignores keyword passives, so the granted Ganking does not allow battlefield-to-battlefield moves (810.3). |
| Wizened Elder                | implemented |                                                                                                                                                                                    |
| Yasuo, Remorseful            | implemented |                                                                                                                                                                                    |
| Yasuo, Unforgiven            | implemented |                                                                                                                                                                                    |
| Zaunite Bouncer              | implemented |                                                                                                                                                                                    |
