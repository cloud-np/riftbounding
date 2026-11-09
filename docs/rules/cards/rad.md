# Radiance (RAD) card scripts — wave R3

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
`rad:other-cards-in-hand-gte`, `rad:ability-triggered-this-turn`, `rad:event-player-unmarked`.

Effects: `rad:mark-event-player`, `rad:let-x`, `rad:draw-card`, `rad:reveal-top-each`,
`rad:mechanical-bandit`, `rad:scope-guess`, `rad:may-play-until-ending` (with a
`registerPlayPermission` provider for "until your next Ending Phase, you may play that card").

## Capability gaps

| Capability                                                                    | Rule ids       | Cards blocked                        | Count |
| ----------------------------------------------------------------------------- | -------------- | ------------------------------------ | ----: |
| Show Off keyword (reveal/pick as you play; "if you showed off")               | 832            | Battle Preparations, Rousing Display |     2 |
| Triggered abilities of cards in the trash (play-from-trash triggers)          | 385            | Forbidden Technique                  |     1 |
| Per-turn history of where units/gear were played (conditional cost reduction) | 356.4          | Hold 'Em                             |     1 |
| Triggered abilities that Add resources finalize and resolve immediately       | 430.2, 430.2.a | Sneaky Zeebles                       |     1 |

## Engine bugs (reproduced in `test/cards/rad/bugs.test.ts`, skipped)

- **Hidden record wiped at end of turn** (811.1.b, 317.2.c): `cleanup/cleanup.ts`
  ("expire-this-turn") deletes rules objects that have no buffs/baseMight/counters/grants/
  controller, which removes `hiddenTurn`/`hiddenBy` of a facedown card — so no card hidden on an
  earlier turn can be played from face down. The same keep-list drops `keywordGrants`,
  `mightMods`, `prevent`, `empowered` and `paidAdditionalCost` (effects.md asked to keep them).

## Card status

Counts: implemented: 43, partial: 5, remaining: 115

| Card                              | Status      | Not automated (rule)                                                                                                                          |
| --------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ahri, Confident                   | remaining   |                                                                                                                                               |
| Akali, Brash                      | remaining   |                                                                                                                                               |
| Amateur Demolitionist             | remaining   |                                                                                                                                               |
| An Offer You Can't Refuse         | implemented |                                                                                                                                               |
| Angler Wyrm                       | remaining   |                                                                                                                                               |
| Antagonistic Apparatus            | implemented |                                                                                                                                               |
| Armored Tusker                    | remaining   |                                                                                                                                               |
| Avalanche                         | implemented |                                                                                                                                               |
| Bandle Scouts' Academy            | remaining   |                                                                                                                                               |
| Banner of Conquest                | remaining   |                                                                                                                                               |
| Battle Preparations               | partial     | [Show Off] (832) is not implemented, so "if you showed off, ready up to 2 runes" never applies.                                               |
| Battlefield Armorer               | remaining   |                                                                                                                                               |
| Bedeviling Stranger               | remaining   |                                                                                                                                               |
| Bilgewater Tracker                | implemented |                                                                                                                                               |
| Black Market                      | remaining   |                                                                                                                                               |
| Black Rose Sanctum                | remaining   |                                                                                                                                               |
| Bloodscent Swarm                  | remaining   |                                                                                                                                               |
| Blossoming Dreamroot              | remaining   |                                                                                                                                               |
| Brawl                             | implemented |                                                                                                                                               |
| Burn Away                         | implemented |                                                                                                                                               |
| Bushwhack Trap                    | remaining   |                                                                                                                                               |
| Cataclysm                         | implemented |                                                                                                                                               |
| Chronobreak                       | remaining   |                                                                                                                                               |
| Clocktower Guardian               | remaining   |                                                                                                                                               |
| Coalesced Energy                  | remaining   |                                                                                                                                               |
| Command: Attack                   | implemented |                                                                                                                                               |
| Concert Poster                    | remaining   |                                                                                                                                               |
| Consult the Heavens               | implemented |                                                                                                                                               |
| Cosmic Vista                      | remaining   |                                                                                                                                               |
| Demacian Illuminators             | remaining   |                                                                                                                                               |
| Demacian Standard                 | remaining   |                                                                                                                                               |
| Demon Shade                       | implemented |                                                                                                                                               |
| Detonation Amplifier              | remaining   |                                                                                                                                               |
| Disposal Expert                   | implemented |                                                                                                                                               |
| Dockside Lock-Up                  | remaining   |                                                                                                                                               |
| Drakehound Packmaster             | remaining   |                                                                                                                                               |
| Dune Devourer                     | remaining   |                                                                                                                                               |
| Durand Memorial                   | remaining   |                                                                                                                                               |
| Ekko, Boy Who Shattered Time      | remaining   |                                                                                                                                               |
| Ekko, Ingenious                   | remaining   |                                                                                                                                               |
| Ekko, Revolutionary               | remaining   |                                                                                                                                               |
| Elnuk Herd                        | remaining   |                                                                                                                                               |
| Encore                            | remaining   |                                                                                                                                               |
| Entrenched Boar                   | remaining   |                                                                                                                                               |
| Ephemeral Ward                    | remaining   |                                                                                                                                               |
| Evelynn in Control                | remaining   |                                                                                                                                               |
| Evelynn, Agony's Embrace          | remaining   |                                                                                                                                               |
| Evelynn, Consuming                | remaining   |                                                                                                                                               |
| Evelynn, in Control               | remaining   |                                                                                                                                               |
| Explosimian                       | remaining   |                                                                                                                                               |
| Fanfare                           | remaining   |                                                                                                                                               |
| Firebrand Raider                  | remaining   |                                                                                                                                               |
| Firelights' Hideout               | remaining   |                                                                                                                                               |
| For Demacia!                      | implemented |                                                                                                                                               |
| Forbidden Technique               | partial     | The trash trigger (play this from your trash for [1][Fury][Fury], then banish it) needs triggered abilities of cards outside the board (385). |
| Graves, Blasting Through          | remaining   |                                                                                                                                               |
| Gravity Field                     | remaining   |                                                                                                                                               |
| Gutter Guardian                   | remaining   |                                                                                                                                               |
| Heartening Soul                   | remaining   |                                                                                                                                               |
| Heimerdinger, Academy Instructor  | remaining   |                                                                                                                                               |
| Herald of the Emperor             | remaining   |                                                                                                                                               |
| Hexplosive Minefield              | remaining   |                                                                                                                                               |
| High Note                         | implemented |                                                                                                                                               |
| Hold 'Em                          | partial     | The [2] discount needs a per-turn record of where units/gear were played (356.4; no play-location history).                                   |
| Hunker Down                       | implemented |                                                                                                                                               |
| Hunters' Circle                   | remaining   |                                                                                                                                               |
| Hunting Blind                     | remaining   |                                                                                                                                               |
| Hunting Dog                       | implemented |                                                                                                                                               |
| Hush                              | implemented |                                                                                                                                               |
| Improvised Projectile             | implemented |                                                                                                                                               |
| Incorrigible Construct            | remaining   |                                                                                                                                               |
| Industrious Mechsmith             | implemented |                                                                                                                                               |
| Invigorating Bloom                | remaining   |                                                                                                                                               |
| Iridescent Avian                  | remaining   |                                                                                                                                               |
| Jarvan IV, Exemplar of Demacia    | remaining   |                                                                                                                                               |
| Jarvan IV, Martial Paragon        | remaining   |                                                                                                                                               |
| Jarvan IV, Royal Heir             | remaining   |                                                                                                                                               |
| K'Sante, Courageous               | implemented |                                                                                                                                               |
| K'Sante, Dauntless                | remaining   |                                                                                                                                               |
| K'Sante, Pride of Nazumah         | remaining   |                                                                                                                                               |
| Kai'Sa, Rebel                     | remaining   |                                                                                                                                               |
| Ki Burst                          | implemented |                                                                                                                                               |
| Last Caress                       | remaining   |                                                                                                                                               |
| Life from Stone                   | implemented |                                                                                                                                               |
| Lingering Animus                  | remaining   |                                                                                                                                               |
| Lost to the Sands                 | implemented |                                                                                                                                               |
| Lulu, Whimsical                   | remaining   |                                                                                                                                               |
| Mechanical Bandit                 | remaining   |                                                                                                                                               |
| Meticulous Restorationist         | remaining   |                                                                                                                                               |
| Momentary Companion               | remaining   |                                                                                                                                               |
| Mordekaiser, Dominating           | remaining   |                                                                                                                                               |
| Mordekaiser, Iron Revenant        | remaining   |                                                                                                                                               |
| Mordekaiser, Twice Slain          | remaining   |                                                                                                                                               |
| Mournful Spirit                   | remaining   |                                                                                                                                               |
| Mysterious Chronomancer           | implemented |                                                                                                                                               |
| Nazuman Ntofo                     | remaining   |                                                                                                                                               |
| Neeko, Blending In                | remaining   |                                                                                                                                               |
| Ntofo Strikes                     | implemented |                                                                                                                                               |
| One-Two Punch                     | implemented |                                                                                                                                               |
| Orianna, Exquisite                | remaining   |                                                                                                                                               |
| Orianna, Lady of Clockwork        | remaining   |                                                                                                                                               |
| Orianna, Mechanical Marvel        | remaining   |                                                                                                                                               |
| Overloaded Traveler               | remaining   |                                                                                                                                               |
| Packed Amphitheater               | remaining   |                                                                                                                                               |
| Parallel Convergence              | remaining   |                                                                                                                                               |
| Party Crasher                     | remaining   |                                                                                                                                               |
| Pillaged Armory                   | remaining   |                                                                                                                                               |
| Piltovan Guidebot                 | remaining   |                                                                                                                                               |
| Pitiless Stalker                  | implemented |                                                                                                                                               |
| Portable Portal                   | remaining   |                                                                                                                                               |
| Primordial Roar                   | remaining   |                                                                                                                                               |
| Protector's Shield                | remaining   |                                                                                                                                               |
| Rakelstake                        | remaining   |                                                                                                                                               |
| Rally for War                     | implemented |                                                                                                                                               |
| Raucous Anthem                    | implemented |                                                                                                                                               |
| Raving Witness                    | remaining   |                                                                                                                                               |
| Realm of Death                    | implemented |                                                                                                                                               |
| Remember the Fallen               | remaining   |                                                                                                                                               |
| Resource Extractor                | remaining   |                                                                                                                                               |
| Resplendent Rostrum               | remaining   |                                                                                                                                               |
| Riptide Mage                      | implemented |                                                                                                                                               |
| Riven, Deserter                   | remaining   |                                                                                                                                               |
| Rousing Display                   | partial     | [Show Off] (832) is not implemented, so the four-Recruit branch never applies.                                                                |
| Ruined Monastery                  | remaining   |                                                                                                                                               |
| Runeblade Anvil                   | remaining   |                                                                                                                                               |
| Sanctum Conservator               | remaining   |                                                                                                                                               |
| Satchel Charge                    | remaining   |                                                                                                                                               |
| Scorched Earth                    | remaining   |                                                                                                                                               |
| Scrutinizing Scope                | remaining   |                                                                                                                                               |
| Seraphic Wyvern                   | remaining   |                                                                                                                                               |
| Seraphine, Inspiring              | remaining   |                                                                                                                                               |
| Seraphine, Not Alone              | implemented |                                                                                                                                               |
| Seraphine, Starry-Eyed Songstress | remaining   |                                                                                                                                               |
| Shimmering Swimmer                | remaining   |                                                                                                                                               |
| Siren of the Shallows             | implemented |                                                                                                                                               |
| Siren's Song                      | implemented |                                                                                                                                               |
| Skystrike Squadron                | remaining   |                                                                                                                                               |
| Sneaky Zeebles                    | partial     | 430.2: a triggered Add ability goes on the chain instead of resolving immediately.                                                            |
| Spirit of the Forge               | remaining   |                                                                                                                                               |
| Stalwart Goatherd                 | implemented |                                                                                                                                               |
| Staunch Survivor                  | implemented |                                                                                                                                               |
| Steadfast Outrider                | remaining   |                                                                                                                                               |
| Stoic Ferryman                    | remaining   |                                                                                                                                               |
| Storm Raptor                      | remaining   |                                                                                                                                               |
| Strigian Oracle                   | implemented |                                                                                                                                               |
| Suave Negotiator                  | implemented |                                                                                                                                               |
| Supernova                         | implemented |                                                                                                                                               |
| The Ball                          | remaining   |                                                                                                                                               |
| The Empyrean                      | remaining   |                                                                                                                                               |
| The Good Stuff                    | remaining   |                                                                                                                                               |
| The Waters' Wage                  | implemented |                                                                                                                                               |
| Titanic Shrine                    | remaining   |                                                                                                                                               |
| Transpositionist                  | remaining   |                                                                                                                                               |
| Trifarian Captain                 | remaining   |                                                                                                                                               |
| Trinket Peddler                   | implemented |                                                                                                                                               |
| War Scout                         | implemented |                                                                                                                                               |
| Watchful Curator                  | implemented |                                                                                                                                               |
| Whirling Twirligig                | remaining   |                                                                                                                                               |
| Wrath of the Freljord             | implemented |                                                                                                                                               |
| Zero Point Inflection             | remaining   |                                                                                                                                               |
| Ziggs, Explosive                  | remaining   |                                                                                                                                               |
| Ziggs, Hexplosives Expert         | remaining   |                                                                                                                                               |
| Ziggs, Short-Fused                | remaining   |                                                                                                                                               |
