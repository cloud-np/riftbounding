# Origins (OGN) card scripts — names O–Z (wave R3)

Lane `ogn-oz`. Scripts live in `packages/rules/src/cards/OGN/<slug>.ts` and are imported from
`packages/rules/src/cards/OGN/batch-o-z.ts`; behaviour tests are in
`packages/rules/test/cards/ogn-o-z/` (one test per card, titled `[C:Card Name]` plus rule ids).
Card text is the current text from `packages/cards/data/cards.json` (errata applied).

Custom conditions/effects registered by this lane use the `ogn-oz:` prefix and are registered in
the script file of the card that needs them (cards sharing one import that file).

## Capability gaps

| Capability                                                                                                                                                         | Rule ids                 | Cards blocked                          | Count |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------- | ----: |
| "Spend a buff" as a cost (activation cost "Spend my buff", or optional additional cost)                                                                            | 702.2.b, 356.2.b, 376    | Wallop, Sett, Brawler, Udyr, Wildman   |     3 |
| Triggered abilities of cards in non-board zones (hand/trash)                                                                                                       | 385                      | Scrapheap, Super Mega Death Rocket!    |     2 |
| Battlefield phase triggers for each player ("that player") and a "player's first Beginning Phase" condition (battlefield trigger controller is the present player) | 315.2.a.1, 383.4         | Obelisk of Power, The Arena's Greatest |     2 |
| Effect-driven plays by a player other than the ability's controller (`play` op has no player), and per-player private look/banish picks                            | 420.3, 355.18            | Promising Future, Portal Rescue        |     2 |
| Per-turn event history (units that died / cards discarded this turn) for conditions                                                                                | 429, 423, 356.4, 727.1.b | Spoils of War, Raging Soul             |     2 |
| Extra play Location permission ("You may play me to an open battlefield")                                                                                          | 355.2.b                  | Sai Scout, Sneaky Deckhand             |     2 |
| `ready` events carry no responsible player, and the Awaken Phase readies through one `ready_all` event (no per-object `ready` events)                              | 412.4, 315.1.b, 416      | Pirate's Haven                         |     1 |
| Player-level move event ("an opponent moves …", once per move action)                                                                                              | 421, 447                 | Volibear, Imposing                     |     1 |
| Destination-qualified move restriction ("can't move from here to base"): `restrictionFor` ignores the move query's `to`                                            | 054.1, 421               | Vilemaw's Lair                         |     1 |
| Cost-layer conditions see Might at layer depth 1 (no passive/continuous/Assault-Shield Might)                                                                      | 478.1.c, 356.4           | Sky Splitter                           |     1 |
| One-shot enter-ready replacement used up by the next unit played                                                                                                   | 369.3, 420.5             | Sun Disc                               |     1 |
| One-shot "next spell" cost reduction is used up by the next card of any type (`consumeOnceCostEffects` ignores the target)                                         | 420.5, 356.4             | Raging Firebrand                       |     1 |
| Alternative Hide cost ([1] instead of [Rune])                                                                                                                      | 811.1.a, 422             | Teemo, Swift Scout                     |     1 |
| Activation cost "Recycle N from your trash"                                                                                                                        | 417.6, 376               | Vi, Destructive                        |     1 |
| "The Nth time … in a turn" triggers (per-turn move count of an object)                                                                                             | 383.1.b                  | Yasuo, Windrider                       |     1 |
| Excess combat damage assigned and "conquer after an attack" are not recorded                                                                                       | 467.2.c, 383.4.c         | Tryndamere, Barbarian                  |     1 |
| Activating other objects' conquer-triggered abilities without a conquer                                                                                            | 383.4.c                  | Reckoner's Arena                       |     1 |
| Event for "a player chooses a unit with a spell" (target choice)                                                                                                   | 355.7, 383.1             | The Dreaming Tree                      |     1 |
| Target-dependent Bonus Damage for every player's spells/abilities ("to units here")                                                                                | 712–715                  | Void Gate                              |     1 |
| Reorder looked-at cards back on top of the Main Deck ("in any order")                                                                                              | 437.1.a, 425             | The Candlelit Sanctum                  |     1 |
| Extra turns, and a resolving spell banishing itself instead of going to the trash                                                                                  | 428, 340                 | Time Warp                              |     1 |
| Effect plays do not compute a 356 total cost (other cost modifiers, optional additional costs)                                                                     | 420.3.b, 356             | Reinforce                              |     1 |

R3-engine fixed optional replacement prompts/ordering (371.2/372/373), damage split (355.14) and
Ganking from keyword passives (810.3); the R4 upgrade also implements the combat tie-recall
replacement (Symbol of the Solari). Those rows were removed.

## Engine bugs found

| Bug | Rule ids | Reproduction | Cards affected |
| --- | --- | --- | --- |
| A Passive Kill from lethal damage in the Cleanup is not attributed to the spell/ability that dealt the damage, so "When you kill …" does not trigger for damage kills. | 429.5.c, 429.5.c.1 | `it.skip("[BUG][C:Solari Shrine]…")` in `test/cards/ogn-o-z/r4b-bugs.test.ts` | Solari Shrine, Immortal Phoenix |

## Card status

131 of 131 scripted: 101 implemented, 18 partial, 12 manual.

R4b: Vanguard Helm is fully automated. Solari Shrine is automated for direct Kill instructions;
a kill from lethal damage in the Cleanup still lacks the responsible player (429.5.c, `[BUG]` in
`test/cards/ogn-o-z/r4b-bugs.test.ts`). The `kill` event carries last-known
`buffs`/`stunned`/`empowered` (383.2.c.3.b, lane C).

| Card                         | Status      | Notes                                                                                                                                                                              |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obelisk of Power             | manual      | Battlefield phase triggers for each player ('that player', 315.2.a.1) and a 'player's first Beginning Phase' condition are not supported.                                          |
| Orb of Regret                | implemented |                                                                                                                                                                                    |
| Overt Operation              | implemented |                                                                                                                                                                                    |
| Pack of Wonders              | implemented |                                                                                                                                                                                    |
| Pakaa Cub                    | implemented |                                                                                                                                                                                    |
| Party Favors                 | implemented |                                                                                                                                                                                    |
| Peak Guardian                | implemented |                                                                                                                                                                                    |
| Petty Officer                | implemented |                                                                                                                                                                                    |
| Pirate's Haven               | manual      | Trigger detection blocked: `ready` events have no responsible player (412.4) and the Awaken Phase readies via one `ready_all` event without per-object `ready` events (315.1.b).   |
| Pit Crew                     | implemented |                                                                                                                                                                                    |
| Pit Rookie                   | implemented |                                                                                                                                                                                    |
| Playful Phantom              | implemented |                                                                                                                                                                                    |
| Poro Herder                  | implemented |                                                                                                                                                                                    |
| Portal Rescue                | partial     | When the friendly unit is owned by another player, 'its owner plays it' resolves in the manual window: the play op (420.3) has no player parameter.                                |
| Possession                   | implemented |                                                                                                                                                                                    |
| Pouty Poro                   | implemented |                                                                                                                                                                                    |
| Primal Strength              | implemented |                                                                                                                                                                                    |
| Progress Day                 | implemented |                                                                                                                                                                                    |
| Promising Future             | manual      | Effect-driven plays by other players (420.3, no player parameter on the play op) and per-player private look/banish picks are not supported.                                       |
| Qiyana, Victorious           | implemented |                                                                                                                                                                                    |
| Raging Firebrand             | partial     | The one-shot discount is used up by the next card of any type (consumeOnceCostEffects is not filtered by the target, 420.5).                                                       |
| Raging Soul                  | manual      | Needs a per-turn discard history (423) for its conditional keywords (727.1.b); none is recorded.                                                                                   |
| Ravenbloom Student           | implemented |                                                                                                                                                                                    |
| Reaver's Row                 | implemented |                                                                                                                                                                                    |
| Reckoner's Arena             | manual      | Activating other objects' conquer-triggered abilities without a conquer (383.4.c) is not supported by the trigger layer.                                                           |
| Recruit                      | implemented |                                                                                                                                                                                    |
| Recruit v2                   | implemented |                                                                                                                                                                                    |
| Recruit v3                   | implemented |                                                                                                                                                                                    |
| Reinforce                    | partial     | The played unit's total cost is its printed cost minus [5]; other cost modifiers and optional additional costs (356) are not applied to that effect play.                          |
| Rhasa the Sunderer           | implemented |                                                                                                                                                                                    |
| Riptide Rex                  | implemented |                                                                                                                                                                                    |
| Rune Prison                  | implemented |                                                                                                                                                                                    |
| Sabotage                     | implemented |                                                                                                                                                                                    |
| Sai Scout                    | partial     | Playing it to an open battlefield (an extra play Location permission, 355.2.b) is not supported.                                                                                   |
| Salvage                      | implemented |                                                                                                                                                                                    |
| Scrapheap                    | partial     | The 'discarded' trigger is manual: triggers of cards in non-board zones (385) are not detected.                                                                                    |
| Scrapyard Champion           | implemented |                                                                                                                                                                                    |
| Seal of Discord              | implemented |                                                                                                                                                                                    |
| Seal of Focus                | implemented |                                                                                                                                                                                    |
| Seal of Insight              | implemented |                                                                                                                                                                                    |
| Seal of Rage                 | implemented |                                                                                                                                                                                    |
| Seal of Strength             | implemented |                                                                                                                                                                                    |
| Seal of Unity                | implemented |                                                                                                                                                                                    |
| Sett, Brawler                | partial     | The activated ability's cost 'Spend my buff' (702.2.b) is not payable, so it cannot be activated.                                                                                  |
| Sett, Kingpin                | implemented |                                                                                                                                                                                    |
| Sett, The Boss               | implemented |                                                                                                                                                                                    |
| Shakedown                    | implemented |                                                                                                                                                                                    |
| Shen, Kinkou                 | implemented |                                                                                                                                                                                    |
| Shipyard Skulker             | implemented |                                                                                                                                                                                    |
| Showstopper                  | implemented |                                                                                                                                                                                    |
| Sigil of the Storm           | implemented |                                                                                                                                                                                    |
| Siphon Power                 | implemented |                                                                                                                                                                                    |
| Sky Splitter                 | partial     | Cost reduction reads Might at layer depth 1 (478.1.c): Might granted by passives, continuous effects or Assault/Shield is not counted.                                             |
| Smoke Screen                 | implemented |                                                                                                                                                                                    |
| Sneaky Deckhand              | manual      | Playing it to an open battlefield (an extra play Location permission, 355.2.b) is not supported.                                                                                   |
| Soaring Scout                | implemented |                                                                                                                                                                                    |
| Solari Chief                 | implemented |                                                                                                                                                                                    |
| Solari Shieldbearer          | implemented |                                                                                                                                                                                    |
| Solari Shrine | partial | Direct Kill instructions trigger (429.5.b); a damage kill in the Cleanup is not attributed to the spell (429.5.c, `[BUG]` r4b-bugs.test.ts). |
| Soulgorger                   | implemented |                                                                                                                                                                                    |
| Spectral Matron              | implemented |                                                                                                                                                                                    |
| Spirit's Refuge              | implemented |                                                                                                                                                                                    |
| Spoils of War                | partial     | The conditional [2] discount is manual: no per-turn history of units that died (429, 356.4).                                                                                       |
| Sprite                       | implemented |                                                                                                                                                                                    |
| Sprite Call                  | implemented |                                                                                                                                                                                    |
| Sprite Mother                | implemented |                                                                                                                                                                                    |
| Stacked Deck                 | implemented |                                                                                                                                                                                    |
| Stalwart Poro                | implemented |                                                                                                                                                                                    |
| Stand United                 | implemented |                                                                                                                                                                                    |
| Startipped Peak              | implemented |                                                                                                                                                                                    |
| Stealthy Pursuer             | implemented |                                                                                                                                                                                    |
| Stormbringer                 | implemented |                                                                                                                                                                                    |
| Stormclaw Ursine             | implemented |                                                                                                                                                                                    |
| Sun Disc                     | partial     | The effect resolves in the manual window: a one-shot enter-ready replacement consumed by the next unit played (369.3, 420.5) is not supported.                                     |
| Sunlit Guardian              | implemented |                                                                                                                                                                                    |
| Super Mega Death Rocket!     | partial     | The trash trigger ('When you conquer, you may discard 1 to return this') is manual: triggers of cards in non-board zones (385) are not detected.                                   |
| Symbol of the Solari         | implemented |                                                                                                                                                                                    |
| Targon's Peak                | implemented |                                                                                                                                                                                    |
| Taric, Protector             | implemented |                                                                                                                                                                                    |
| Tasty Faefolk                | implemented |                                                                                                                                                                                    |
| Teemo, Scout                 | implemented |                                                                                                                                                                                    |
| Teemo, Strategist            | implemented |                                                                                                                                                                                    |
| Teemo, Swift Scout           | partial     | The alternative Hide cost ([1] instead of [Rune], 811.1.a) is not supported by the play layer's Hide action.                                                                       |
| The Arena's Greatest         | manual      | Battlefield phase triggers for each player ('that player', 315.2.a.1) and a 'player's first Beginning Phase' condition are not supported.                                          |
| The Candlelit Sanctum        | partial     | Putting the kept cards back 'in any order' is not offered: no reorder prompt for looked-at cards on top of the deck (cf. 437.1.a).                                                 |
| The Dreaming Tree            | manual      | No event is emitted when a spell chooses its targets (355.7), so the trigger cannot be detected.                                                                                   |
| The Grand Plaza              | implemented |                                                                                                                                                                                    |
| The Harrowing                | implemented |                                                                                                                                                                                    |
| The Syren                    | implemented |                                                                                                                                                                                    |
| Thermo Beam                  | implemented |                                                                                                                                                                                    |
| Thousand-Tailed Watcher      | implemented |                                                                                                                                                                                    |
| Tideturner                   | implemented |                                                                                                                                                                                    |
| Time Warp                    | manual      | Extra turns are not supported by the turn structure, nor is a resolving spell banishing itself instead of going to the trash (428).                                                |
| Traveling Merchant           | implemented |                                                                                                                                                                                    |
| Treasure Trove               | implemented |                                                                                                                                                                                    |
| Trifarian Gloryseeker        | implemented |                                                                                                                                                                                    |
| Trifarian War Camp           | implemented |                                                                                                                                                                                    |
| Tryndamere, Barbarian        | manual      | Excess combat damage assigned (467.2.c) and 'conquer after an attack' are not recorded for trigger conditions.                                                                     |
| Twisted Fate, Gambler        | implemented |                                                                                                                                                                                    |
| Udyr, Wildman                | partial     | The activated ability's cost 'Spend my buff' (702.2.b) is not payable, so it cannot be activated.                                                                                  |
| Unchecked Power              | implemented |                                                                                                                                                                                    |
| Unlicensed Armory            | implemented |                                                                                                                                                                                    |
| Unyielding Spirit            | implemented |                                                                                                                                                                                    |
| Vanguard Captain             | implemented |                                                                                                                                                                                    |
| Vanguard Helm | implemented |  |
| Vanguard Sergeant            | implemented |                                                                                                                                                                                    |
| Vayne, Hunter                | implemented |                                                                                                                                                                                    |
| Vengeance                    | implemented |                                                                                                                                                                                    |
| Vi, Destructive              | partial     | The activated ability's cost 'Recycle 1 from your trash' (417.6) is not payable, so it cannot be activated.                                                                        |
| Viktor, Herald of the Arcane | implemented |                                                                                                                                                                                    |
| Viktor, Innovator            | implemented |                                                                                                                                                                                    |
| Vilemaw's Lair               | manual      | Destination-qualified move restrictions are not supported: restrictionFor ignores the `to` of a move query (054.1, 421).                                                           |
| Void Gate                    | manual      | Target-dependent Bonus Damage for every player's spells and abilities (712–715) is not supported: bonus-damage applies per controller, not per damaged unit.                       |
| Volibear, Furious            | implemented |                                                                                                                                                                                    |
| Volibear, Imposing           | partial     | The draw trigger is manual: no player-level move event (one per move action, 421/447) exists, only per-unit `move` events.                                                         |
| Volibear, Relentless Storm   | implemented |                                                                                                                                                                                    |
| Wallop                       | partial     | The optional additional cost (spend a buff, 702.2.b) and its cost-ignoring discount (356.2.b) are not payable by the play layer.                                                   |
| Warwick, Hunter              | implemented |                                                                                                                                                                                    |
| Watchful Sentry              | implemented |                                                                                                                                                                                    |
| Whirlwind                    | implemented |                                                                                                                                                                                    |
| Wielder of Water             | implemented |                                                                                                                                                                                    |
| Wildclaw Shaman              | implemented |                                                                                                                                                                                    |
| Wind Wall                    | implemented |                                                                                                                                                                                    |
| Windswept Hillock            | implemented |                                                                                                                                                                                    |
| Wizened Elder                | implemented |                                                                                                                                                                                    |
| Yasuo, Remorseful            | implemented |                                                                                                                                                                                    |
| Yasuo, Unforgiven            | implemented |                                                                                                                                                                                    |
| Yasuo, Windrider             | partial     | The scoring trigger is manual: 'the Nth time … in a turn' triggers (383.1.b) need a per-turn move count.                                                                           |
| Zaun Warrens                 | implemented |                                                                                                                                                                                    |
| Zaunite Bouncer              | implemented |                                                                                                                                                                                    |
| Zenith Blade                 | implemented |                                                                                                                                                                                    |
