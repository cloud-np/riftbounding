# Radiance (RAD) card scripts — waves R3–R4

Wave R4 finished the set: all 43 remaining names are scripted, and the cards freed by R3-engine
were upgraded — Battle Preparations and Rousing Display ([Show Off] 832), Scorched Earth (damage
split 355.14) — plus the optional-replacement card Mordekaiser, Twice Slain (371.2). R4 scripts
live in `r4-units.ts`, `r4-spells.ts`, `r4-battlefields.ts` and `r4-manual.ts`; lane tests are
`test/cards/rad/r4-*.test.ts` (the `flushWork` helper drains pending delayed triggers).

Lane: the `### Radiance` rows of `docs/cards-coverage.md` at `8933035` (163 unscripted names).
Scripts live in `packages/rules/src/cards/RAD/` (grouped by kind: `simple-units.ts`,
`spells.ts`, …); behaviour tests in `packages/rules/test/cards/rad/` (one `[C:<name>]` test per
card, rule ids in the title).

## Conventions used in this lane

- Printed keywords are the engine's. Catalog keywords that are **not** the card's own (reminder
  text, granted text such as "Your gear have [Deflect]", a token's keyword) are marked
  `{ kind: "keyword", keyword, value: 0 }` (`notIntrinsic`, 135.2.d.3 / 727.1.b) so the layers do
  not give them to the card (e.g. Watchful Curator, Hunting Dog, Momentary Companion's Temporary).
- "Choose a battlefield" is a battlefield target (`aBattlefield`, 355.7 / 053.3) bound by a
  `for_each`; zones are then read with `{ kind: "chosen", ref }`.
- Values the `Amount` union cannot express ("equal to its [Shield]", "its Energy cost", the
  Might a returned unit _had_) use `rad:let-x`: the value is computed on execution
  (359.3.f.2) and substituted into the inner effect, whose targets are references bound by an
  enclosing `for_each` (so they are still chosen at play time, 355.7).
- Move destinations restricted by the text ("to an occupied enemy battlefield", "to an open
  battlefield", "to a battlefield") are validated at play time with `requires` (rule 355.4) and
  re-checked on resolution (359.3.e.2).
- "Opponents can't play spells this turn" is a play restriction (054.1) on every opponent card of
  that type in each zone a card can be played from (`opponentsCantPlay`).
- "I cost [N] less for each …" is one conditional [N] discount per counted object
  (`costLessForEach`, 356.4 / 366.2.a); the total is floored at 0 by 356.6.

## Custom ids (`rad:` prefix, `src/cards/RAD/custom.ts`)

Conditions: `rad:event-amount`, `rad:event-not-token`, `rad:unit-or-gear`, `rad:face-up`,
`rad:units-at-it-gte`, `rad:zone-is-battlefield`, `rad:zone-open`, `rad:no-open-battlefield`,
`rad:zone-enemy-occupied`, `rad:is-attacker`, `rad:moved-this-turn`, `rad:facedown-here`,
`rad:played-from-facedown`, `rad:control-here`, `rad:event-unit-mightiest`,
`rad:other-cards-in-hand-gte`, `rad:ability-triggered-this-turn`, `rad:event-player-unmarked`,
`rad:paid-additional-self`, `rad:move-count-lt`, `rad:fanfare-pending`.

Effects: `rad:mark-event-player`, `rad:let-x`, `rad:draw-card`, `rad:reveal-top-each`,
`rad:mechanical-bandit`, `rad:scope-guess`, `rad:may-play-until-ending` (with a
`registerPlayPermission` provider for "until your next Ending Phase, you may play that card"),
`rad:akali-move`, `rad:base-might-becomes`, `rad:channel-plus-one`, `rad:delayed-kill-event`,
`rad:choose-modes`, `rad:fanfare-draw`.

## Capability gaps

| Capability                                                                                                                    | Rule ids               | Cards blocked                                                                                                                             | Count |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----: |
| Location choice for units/gear played by an effect (`play` op always uses the base)                                           | 355.2, 420.3.b         | Dockside Lock-Up, Transpositionist, Drakehound Packmaster                                                                                 |     3 |
| Return a permanent to its owner's hand as a cost (no `Cost` part)                                                             | 357.2, 356.2           | Ekko, Ingenious, Parallel Convergence, Skystrike Squadron, Spirit of the Forge                                                            |     4 |
| Cost reduction that reads an object paid as an optional additional cost                                                       | 356.2.b.1, 357.2       | Dune Devourer, Skystrike Squadron, Spirit of the Forge                                                                                    |     3 |
| Trait-altering "base Might becomes N" (layers only add/subtract Might)                                                        | 479–481                | Herald of the Emperor, Lulu, Whimsical, Piltovan Guidebot                                                                                 |     3 |
| Bonus Damage filtered by source type ("abilities of friendly gear")                                                           | 712–715                | Ziggs, Short-Fused                                                                                                                        |     1 |
| Triggered abilities of cards in the trash (play-from-trash triggers)                                                          | 385                    | Forbidden Technique, Meticulous Restorationist                                                                                            |     2 |
| Per-turn history of where units/gear were played (conditional cost reduction)                                                 | 356.4, 420.5           | Hold 'Em, Hunters' Circle                                                                                                                 |     2 |
| Triggered abilities that Add resources finalize and resolve immediately                                                       | 430.2, 430.2.a         | Sneaky Zeebles                                                                                                                            |     1 |
| A cost that exhausts two or more objects (`Cost.exhaust` is one selector)                                                     | 357.2, 415.4           | Invigorating Bloom, Seraphine, Starry-Eyed Songstress                                                                                     |     2 |
| Applied costs on moves ("opponents must pay [1][Rune] to move units here")                                                    | 204.4, 449             | Gravity Field                                                                                                                             |     1 |
| Trigger-count modification ("[Deathknell] effects here trigger an additional time")                                           | 808, 383               | Detonation Amplifier                                                                                                                      |     1 |
| `play` op ignoring only the Energy cost (it ignores all or none)                                                              | 356.1.b, 420.3         | Clocktower Guardian                                                                                                                       |     1 |
| Granting an activated ability to other objects ("Friendly legends have '[Tap]: …'")                                           | 365, 801.3             | Heartening Soul                                                                                                                           |     1 |
| Passives granting keywords to cards in hand (layers' array form ignores passives)                                             | 801.3, 806.1           | Jarvan IV, Martial Paragon, Kai'Sa, Rebel, Firelights' Hideout                                                                            |     3 |
| Per-turn record of conquered battlefields (cost reduction)                                                                    | 356.4                  | Bloodscent Swarm                                                                                                                          |     1 |
| Per-turn record of friendly units/gear that died (conditional entry)                                                          | 369.3, 383.2           | Lingering Animus                                                                                                                           |     1 |
| Any-amount Power additional cost ("pay any amount of Power")                                                                  | 203.3, 356.2           | Chronobreak                                                                                                                               |     1 |
| Restricted resource spending ("spend this Power only to play units or gear")                                                  | 430.5                  | Mordekaiser, Iron Revenant                                                                                                                |     1 |
| Champion-unit identity on the board ("Champion units here")                                                                   | 133.8.b                | Packed Amphitheater                                                                                                                       |     1 |
| Global "units enter ready" for every controller and skipping the Awaken ready                                                  | 369.3, 315.1           | Firebrand Raider                                                                                                                          |     1 |
| The hide plan reading a `hide-limit` modifier ("hide an additional card here")                                                | 811.1.b, 107.3.b       | Bushwhack Trap                                                                                                                            |     1 |
| Play-location permission for normal plays ("can be played to any battlefield")                                               | 355.2.b                | Last Caress                                                                                                                               |     1 |
| Simultaneous "three or more friendly units exhausted at the same time"                                                        | 383.1, 415             | Seraphine, Inspiring                                                                                                                      |     1 |
| Optional replacement of a token play that keeps the proposed location                                                        | 370–375                | Heimerdinger, Academy Instructor                                                                                                          |     1 |
| Activated abilities a player may use without controlling the source                                                           | 378, 381               | Black Market                                                                                                                              |     1 |
| Deck-building extra legends and adding one to the Legend Zone                                                                | 103.3, 133.8           | Neeko, Blending In                                                                                                                        |     1 |
| Trait-altering gear → "unit gear"                                                                                             | 479–481                | Orianna, Lady of Clockwork                                                                                                                |     1 |
| "Choose two —" modes at play time (play-layer `choose_mode` asks one)                                                         | 355.3, 355.8           | Encore                                                                                                                                    |     1 |
| Channel proposal does not carry the original "exhausted" condition                                                           | 431.2                  | Seraphic Wyvern                                                                                                                           |     1 |

## Engine keywords and bugs

Keywords are the engine's (cards are marked by their own lines). R4-engine fixed Deploy's hold
trigger (830.1.b), built-in Equip (818.1.c.2), Quick-Draw's attach trigger (819.1.d), the
`317.2.c` keep-list (hidden records included), the paid-optional-cost flag (356.4.f.1) and
facedown-play provenance on the play events (811.6). No `[BUG]` reproduction remains open in this
lane; `test/cards/rad/bugs.test.ts` stays as regression coverage. Facedown-dependent scripts
(Elnuk Herd, Evelynn, Consuming, Evelynn, Agony's Embrace) are still `partial`/`manual` because
their own clauses were not upgraded, not because the engine lacks the event data.

Other engine behaviour worth knowing when testing (not bugs of this lane):

- Unattached non-Deploy gear at a battlefield is recalled to the base by the host's
  `settleVictory` in every cleanup (RULES-ENGINE.md, known limitations), so "a gear at a
  battlefield" only stays there with Deploy.
- `movedThisTurn` is only recorded on units that already have a rules object (played units do).

## Card status

Counts: implemented: 117, partial: 32, manual: 14, remaining: 0

Wave R4b upgraded Storm Raptor, Mournful Spirit, Blade of the Exile, the Bomb gear token and its six
makers that only needed Deploy/Deathknell (all but Ziggs, Short-Fused, which keeps its gear
Bonus Damage gap).

| Card                              | Status      | Not automated (rule)                                                                                                                                        |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ahri, Confident                   | implemented |                                                                                                                                                             |
| Akali, Brash                      | implemented |                                                                                                                                                           |
| Amateur Demolitionist | implemented |  |
| An Offer You Can't Refuse         | implemented |                                                                                                                                                             |
| Angler Wyrm                       | implemented |                                                                                                                                                             |
| Antagonistic Apparatus            | implemented |                                                                                                                                                             |
| Armored Tusker                    | implemented |                                                                                                                                                             |
| Avalanche                         | implemented |                                                                                                                                                             |
| Bandle Scouts' Academy            | implemented |                                                                                                                                                             |
| Banner of Conquest                | implemented |                                                                                                                                                             |
| Battle Preparations               | implemented |                                                                                                                                                           |
| Battlefield Armorer               | implemented |                                                                                                                                                             |
| Bedeviling Stranger               | implemented |                                                                                                                                                             |
| Bilgewater Tracker                | implemented |                                                                                                                                                             |
| Black Market                      | partial     | The ability is scripted, but a battlefield has no controller and activation only accepts the card's controller (378/381).                                 |
| Black Rose Sanctum                | implemented |                                                                                                                                                             |
| Bloodscent Swarm                  | partial     | No per-turn record of conquered battlefields (356.4).                                                                                                     |
| Blossoming Dreamroot              | implemented |                                                                                                                                                             |
| Brawl                             | implemented |                                                                                                                                                             |
| Burn Away                         | implemented |                                                                                                                                                             |
| Bushwhack Trap                    | partial     | The extra hide slot needs a hide-limit modifier the hide plan does not read (811.1.b, 107.3.b).                                                           |
| Cataclysm                         | implemented |                                                                                                                                                             |
| Chronobreak                       | manual      | Any-amount Power additional cost (203.3) and effect-driven play to a chosen location (355.2 / 420.3.b) are missing.                                       |
| Clocktower Guardian               | partial     | Deathknell: the top card is banished, but playing it ignoring only its Energy cost (356.1.b) opens the manual window (the play op ignores all or no costs). |
| Coalesced Energy                  | implemented |                                                                                                                                                             |
| Command: Attack                   | implemented |                                                                                                                                                             |
| Concert Poster                    | implemented |                                                                                                                                                             |
| Consult the Heavens               | implemented |                                                                                                                                                             |
| Cosmic Vista                      | implemented |                                                                                                                                                             |
| Demacian Illuminators             | implemented |                                                                                                                                                             |
| Demacian Standard                 | implemented |                                                                                                                                                             |
| Demon Shade                       | implemented |                                                                                                                                                             |
| Detonation Amplifier              | partial     | "Friendly [Deathknell] effects here trigger an additional time" needs trigger-count modification (808, 383).                                                |
| Disposal Expert                   | implemented |                                                                                                                                                             |
| Dockside Lock-Up                  | partial     | The banished card is played by the play op, which puts a unit at its controller's base (no location choice, 355.2 / 420.3.b).                               |
| Drakehound Packmaster             | partial     |                                                                                                                                                             |
| Dune Devourer                     | partial     | The optional kill cost and [Deflect] work; the [2] discount cannot read the object paid as a cost (356.2.b.1, 357.2).                                     |
| Durand Memorial                   | implemented |                                                                                                                                                             |
| Ekko, Boy Who Shattered Time      | partial     | Empower and the discount are automated; disempower is a resolution precondition, the discount is consumed by the next card of any type, and the granted kill-at-end trigger attaches to the next unit. |
| Ekko, Ingenious                   | manual      | The mandatory 'return a friendly unit to hand' additional cost is not a payable Cost part (357.2).                                                        |
| Ekko, Revolutionary               | implemented |                                                                                                                                                             |
| Elnuk Herd                        | partial     | "Recycle me if I was played from face down": the engine now records `data.playedFromFacedown` (811.6, R4-engine E); this script has not been upgraded yet.                        |
| Encore                            | partial     | All four modes work, but both modes and targets are chosen on resolution (play-layer choose_mode asks one mode, 355.3 / 355.8).                           |
| Entrenched Boar                   | implemented | Optional-cost flag (369.3); rune payment no longer sets it (356.4.f.1, R4-engine B).                                                                       |
| Ephemeral Ward                    | implemented |                                                                                                                                                             |
| Evelynn in Control                | implemented |                                                                                                                                                             |
| Evelynn, Agony's Embrace          | manual      | Facedown provenance is now on `card_played` (811.6, R4-engine E); this script has not been upgraded yet (also needs the trash trigger, 385).                                                              |
| Evelynn, Consuming                | manual      | The engine now records `data.playedFromFacedown` on `unit_played` (811.6, R4-engine E); this script has not been upgraded yet.                                                                  |
| Evelynn, in Control               | implemented |                                                                                                                                                             |
| Explosimian | implemented |  |
| Fanfare                           | implemented |                                                                                                                                                           |
| Firebrand Raider                  | partial     | Entry-ready and ready-all-enemies work; global 'other units enter ready' and the Awaken ready skip need engine support (369.3, 315.1).                    |
| Firelights' Hideout               | partial     | The next unit's [Accelerate] must be visible to the play layer while in hand (801.3, 806).                                                                |
| For Demacia!                      | implemented |                                                                                                                                                             |
| Forbidden Technique               | partial     | The trash trigger (play this from your trash for [1][Fury][Fury], then banish it) needs triggered abilities of cards outside the board (385).               |
| Graves, Blasting Through          | implemented |                                                                                                                                                             |
| Gravity Field                     | partial     | The move tax (opponents pay [1][Rune] to move units here) needs applied costs on moves (204.4, 449).                                                        |
| Gutter Guardian                   | implemented |                                                                                                                                                           |
| Heartening Soul                   | partial     | Granting an activated ability to friendly legends needs granted abilities (365, 801.3 for abilities).                                                       |
| Heimerdinger, Academy Instructor  | manual      | Needs an optional replacement of a token play that keeps the location (370–375).                                                                          |
| Herald of the Emperor             | partial     | 'Base Might becomes 5' is a this-turn Might change (trait-altering 479 is missing).                                                                       |
| Hexplosive Minefield | implemented |  |
| High Note                         | implemented |                                                                                                                                                             |
| Hold 'Em                          | partial     | The [2] discount needs a per-turn record of where units/gear were played (356.4; no play-location history).                                                 |
| Hunker Down                       | implemented |                                                                                                                                                             |
| Hunters' Circle                   | manual      | Needs per-player play-location history and a location-aware cost adjustment (356.4, 420.5).                                                               |
| Hunting Blind                     | implemented |                                                                                                                                                             |
| Hunting Dog                       | implemented |                                                                                                                                                             |
| Hush                              | implemented |                                                                                                                                                             |
| Improvised Projectile             | implemented |                                                                                                                                                             |
| Incorrigible Construct            | implemented |                                                                                                                                                           |
| Industrious Mechsmith             | implemented |                                                                                                                                                             |
| Invigorating Bloom                | partial     | The activated ability's cost exhausts two objects (a friendly Mighty unit and this); `Cost.exhaust` holds one selector (357.2).                             |
| Iridescent Avian                  | implemented |                                                                                                                                                             |
| Jarvan IV, Exemplar of Demacia    | implemented |                                                                                                                                                             |
| Jarvan IV, Martial Paragon        | partial     | "Your gear with [Deploy] have [Action]" grants a keyword to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).         |
| Jarvan IV, Royal Heir             | implemented |                                                                                                                                                             |
| K'Sante, Courageous               | implemented |                                                                                                                                                             |
| K'Sante, Dauntless                | implemented |                                                                                                                                                             |
| K'Sante, Pride of Nazumah         | implemented |                                                                                                                                                           |
| Kai'Sa, Rebel                     | partial     | 'Your spells have [Reaction]' is a keyword grant to cards in hand, which the play layer does not read (801.3, 806).                                       |
| Ki Burst                          | implemented |                                                                                                                                                             |
| Last Caress                       | partial     | The delayed [Buff] works; 'can be played to any battlefield' is a normal-play location permission (355.2.b).                                              |
| Life from Stone                   | implemented |                                                                                                                                                             |
| Lingering Animus                  | manual      | No per-turn record of friendly units/gear that died (383.2.c, 369.3).                                                                                     |
| Lost to the Sands                 | implemented |                                                                                                                                                             |
| Lulu, Whimsical                   | partial     | 'Base Might becomes 4' is a this-turn Might change (trait-altering 479 is missing).                                                                       |
| Mechanical Bandit                 | implemented |                                                                                                                                                             |
| Meticulous Restorationist         | manual      | Triggered abilities of cards in the trash are not detected (385).                                                                                         |
| Momentary Companion               | implemented |                                                                                                                                                             |
| Mordekaiser, Dominating           | implemented |                                                                                                                                                             |
| Mordekaiser, Iron Revenant        | partial     | The banish is a resolution instruction (a trash card cannot be a Cost) and 'spend this Power only to play units or gear' is not modelled (357.2, 430.5).  |
| Mordekaiser, Twice Slain          | implemented |                                                                                                                                                           |
| Mournful Spirit | implemented |  |
| Mysterious Chronomancer           | implemented |                                                                                                                                                             |
| Nazuman Ntofo                     | implemented |                                                                                                                                                             |
| Neeko, Blending In                | manual      | Needs deck-building extra legends and moving a chosen legend into the Legend Zone (not stored).                                                           |
| Ntofo Strikes                     | implemented |                                                                                                                                                             |
| One-Two Punch                     | implemented |                                                                                                                                                             |
| Orianna, Exquisite                | implemented |                                                                                                                                                             |
| Orianna, Lady of Clockwork        | manual      | Needs trait-altering 'becomes a unit gear' plus the last-chosen link (479–481).                                                                           |
| Orianna, Mechanical Marvel        | partial     | The [1][Rune] discount is a once-per-turn cost-adjust; it is consumed by the next card of any type (420.5).                                               |
| Overloaded Traveler               | implemented |                                                                                                                                                             |
| Packed Amphitheater               | manual      | The catalog does not mark Champion units on the board (133.8.b).                                                                                          |
| Parallel Convergence              | manual      | The mandatory return-a-unit-to-hand additional cost is not a payable Cost part (357.2).                                                                   |
| Party Crasher                     | implemented |                                                                                                                                                             |
| Pillaged Armory                   | implemented |                                                                                                                                                             |
| Piltovan Guidebot                 | partial     | 'Base Might becomes' its Energy cost is a this-turn Might change (trait-altering 479 is missing).                                                         |
| Pitiless Stalker                  | implemented |                                                                                                                                                             |
| Portable Portal                   | implemented |                                                                                                                                                             |
| Primordial Roar                   | implemented |                                                                                                                                                           |
| Protector's Shield                | implemented |                                                                                                                                                             |
| Rakelstake                        | implemented |                                                                                                                                                             |
| Rally for War                     | implemented |                                                                                                                                                             |
| Raucous Anthem                    | implemented |                                                                                                                                                             |
| Raving Witness                    | implemented |                                                                                                                                                             |
| Realm of Death                    | implemented |                                                                                                                                                             |
| Remember the Fallen               | implemented |                                                                                                                                                           |
| Resource Extractor                | implemented |                                                                                                                                                             |
| Resplendent Rostrum               | implemented |                                                                                                                                                             |
| Riptide Mage                      | implemented |                                                                                                                                                             |
| Riven, Deserter                   | implemented |                                                                                                                                                             |
| Rousing Display                   | implemented |                                                                                                                                                           |
| Ruined Monastery                  | implemented |                                                                                                                                                             |
| Runeblade Anvil                   | implemented |                                                                                                                                                             |
| Sanctum Conservator               | implemented |                                                                                                                                                             |
| Satchel Charge | implemented |  |
| Scorched Earth                    | implemented |                                                                                                                                                           |
| Scrutinizing Scope                | implemented |                                                                                                                                                             |
| Seraphic Wyvern                   | partial     | The replacement adds the extra exhausted rune, but a Channel that said "exhausted" loses that condition (431.2).                                           |
| Seraphine, Inspiring              | manual      | Simultaneous 'three or more friendly units exhausted at the same time' is not tracked (383.1, 415).                                                       |
| Seraphine, Not Alone              | implemented |                                                                                                                                                             |
| Seraphine, Starry-Eyed Songstress | manual      | An optional additional cost exhausting the legend plus three units is not expressible (356.2.b.1, 356.4.c, 357.2).                                        |
| Shimmering Swimmer                | implemented |                                                                                                                                                             |
| Siren of the Shallows             | implemented |                                                                                                                                                             |
| Siren's Song                      | implemented |                                                                                                                                                             |
| Skystrike Squadron                | partial     | The optional 'return a gear' cost is unpayable and the [2] discount for paying it is missing.                                                             |
| Sneaky Zeebles                    | partial     | 430.2: a triggered Add ability goes on the chain instead of resolving immediately.                                                                          |
| Spirit of the Forge               | partial     | The optional 'return a gear' cost is unpayable; the 'if you paid' payoff is unreachable.                                                                  |
| Stalwart Goatherd                 | implemented |                                                                                                                                                             |
| Staunch Survivor                  | implemented |                                                                                                                                                             |
| Steadfast Outrider                | implemented |                                                                                                                                                             |
| Stoic Ferryman                    | implemented |                                                                                                                                                             |
| Storm Raptor | implemented |  |
| Strigian Oracle                   | implemented |                                                                                                                                                             |
| Suave Negotiator                  | implemented |                                                                                                                                                             |
| Supernova                         | implemented |                                                                                                                                                             |
| The Ball                          | implemented |                                                                                                                                                             |
| The Empyrean                      | implemented |                                                                                                                                                           |
| The Good Stuff                    | implemented |                                                                                                                                                             |
| The Waters' Wage                  | implemented |                                                                                                                                                             |
| Titanic Shrine                    | implemented |                                                                                                                                                             |
| Transpositionist                  | partial     |                                                                                                                                                             |
| Trifarian Captain                 | implemented |                                                                                                                                                             |
| Trinket Peddler                   | implemented |                                                                                                                                                             |
| War Scout                         | implemented |                                                                                                                                                             |
| Watchful Curator                  | implemented |                                                                                                                                                             |
| Whirling Twirligig                | implemented |                                                                                                                                                             |
| Wrath of the Freljord             | implemented |                                                                                                                                                             |
| Zero Point Inflection             | implemented |                                                                                                                                                             |
| Ziggs, Explosive | implemented |  |
| Ziggs, Hexplosives Expert | implemented |  |
| Ziggs, Short-Fused | partial | The Bomb token and its Deathknell are scripted; "Abilities of friendly gear deal 1 Bonus Damage" needs a source-type filter on Bonus Damage (712-715; `bonus-damage` only filters spells/abilities). |
