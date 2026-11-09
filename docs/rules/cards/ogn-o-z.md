# Origins (OGN) card scripts — names O–Z (wave R3)

Lane `ogn-oz`. Scripts live in `packages/rules/src/cards/OGN/<slug>.ts` and are imported from
`packages/rules/src/cards/OGN/batch-o-z.ts`; behaviour tests are in
`packages/rules/test/cards/ogn-o-z/` (one test per card, titled `[C:Card Name]` plus rule ids).
Card text is the current text from `packages/cards/data/cards.json` (errata applied).

Custom conditions/effects registered by this lane use the `ogn-oz:` prefix and are registered in
the script file of the card that needs them (cards sharing one import that file).

## Capability gaps

| Capability                                                                                                                            | Rule ids                | Cards blocked                | Count |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------- | ----: |
| `ready` events carry no responsible player, and the Awaken Phase readies through one `ready_all` event (no per-object `ready` events) | 412.4, 315.1.b, 416     | Pirate's Haven               |     1 |
| Player-level move event ("an opponent moves …", once per move action)                                                                 | 421, 447                | Volibear, Imposing           |     1 |
| `kill` events lack last-known buff / stunned state for leave-the-board trigger conditions                                             | 383.2.c.3.b, 359.3.e.13 | Vanguard Helm, Solari Shrine |     2 |

## Card status

50 of 131 scripted: 46 implemented, 1 partial, 3 manual.

| Card                    | Status      | Notes                                                                                                                                                                            |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pakaa Cub               | implemented |                                                                                                                                                                                  |
| Peak Guardian           | implemented |                                                                                                                                                                                  |
| Petty Officer           | implemented |                                                                                                                                                                                  |
| Pirate's Haven          | manual      | Trigger detection blocked: `ready` events have no responsible player (412.4) and the Awaken Phase readies via one `ready_all` event without per-object `ready` events (315.1.b). |
| Pit Crew                | implemented |                                                                                                                                                                                  |
| Pit Rookie              | implemented |                                                                                                                                                                                  |
| Playful Phantom         | implemented |                                                                                                                                                                                  |
| Poro Herder             | implemented |                                                                                                                                                                                  |
| Pouty Poro              | implemented |                                                                                                                                                                                  |
| Primal Strength         | implemented |                                                                                                                                                                                  |
| Progress Day            | implemented |                                                                                                                                                                                  |
| Qiyana, Victorious      | implemented |                                                                                                                                                                                  |
| Ravenbloom Student      | implemented |                                                                                                                                                                                  |
| Recruit                 | implemented |                                                                                                                                                                                  |
| Recruit v2              | implemented |                                                                                                                                                                                  |
| Recruit v3              | implemented |                                                                                                                                                                                  |
| Riptide Rex             | implemented |                                                                                                                                                                                  |
| Rune Prison             | implemented |                                                                                                                                                                                  |
| Scrapyard Champion      | implemented |                                                                                                                                                                                  |
| Shen, Kinkou            | implemented |                                                                                                                                                                                  |
| Shipyard Skulker        | implemented |                                                                                                                                                                                  |
| Smoke Screen            | implemented |                                                                                                                                                                                  |
| Soaring Scout           | implemented |                                                                                                                                                                                  |
| Solari Chief            | implemented |                                                                                                                                                                                  |
| Solari Shieldbearer     | implemented |                                                                                                                                                                                  |
| Solari Shrine           | manual      | `kill` events carry no last-known stunned state (383.2.c.3.b), so "a stunned enemy unit" cannot be matched.                                                                      |
| Sprite                  | implemented |                                                                                                                                                                                  |
| Sprite Mother           | implemented |                                                                                                                                                                                  |
| Stalwart Poro           | implemented |                                                                                                                                                                                  |
| Stealthy Pursuer        | implemented |                                                                                                                                                                                  |
| Stormclaw Ursine        | implemented |                                                                                                                                                                                  |
| Sunlit Guardian         | implemented |                                                                                                                                                                                  |
| Tasty Faefolk           | implemented |                                                                                                                                                                                  |
| Teemo, Scout            | implemented |                                                                                                                                                                                  |
| Thermo Beam             | implemented |                                                                                                                                                                                  |
| Thousand-Tailed Watcher | implemented |                                                                                                                                                                                  |
| Traveling Merchant      | implemented |                                                                                                                                                                                  |
| Trifarian Gloryseeker   | implemented |                                                                                                                                                                                  |
| Vanguard Captain        | implemented |                                                                                                                                                                                  |
| Vanguard Helm           | manual      | `kill` events carry no last-known buff state (383.2.c.3.b), so "a buffed friendly unit dies" cannot be matched.                                                                  |
| Vanguard Sergeant       | implemented |                                                                                                                                                                                  |
| Vengeance               | implemented |                                                                                                                                                                                  |
| Viktor, Innovator       | implemented |                                                                                                                                                                                  |
| Volibear, Imposing      | partial     | The draw trigger is manual: no player-level move event (one per move action, 421/447) exists, only per-unit `move` events.                                                       |
| Warwick, Hunter         | implemented |                                                                                                                                                                                  |
| Watchful Sentry         | implemented |                                                                                                                                                                                  |
| Wildclaw Shaman         | implemented |                                                                                                                                                                                  |
| Wind Wall               | implemented |                                                                                                                                                                                  |
| Yasuo, Remorseful       | implemented |                                                                                                                                                                                  |
| Zaunite Bouncer         | implemented |                                                                                                                                                                                  |
