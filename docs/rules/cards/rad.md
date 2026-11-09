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

| Capability                                                                                                                    | Rule ids       | Cards blocked                                                                                                                             | Count |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----: |
| Bomb gear token script (its [Deathknell]: deal 2 to an enemy unit here, kill your other Bombs here) under `src/cards/tokens/` | 187, 808       | Amateur Demolitionist, Explosimian, Satchel Charge, Hexplosive Minefield, Ziggs, Explosive, Ziggs, Hexplosives Expert, Ziggs, Short-Fused |     7 |
| Location choice for units/gear played by an effect (`play` op always uses the base)                                           | 355.2, 420.3.b | Dockside Lock-Up, Transpositionist, Drakehound Packmaster                                                                                 |     3 |
| Show Off keyword (reveal/pick as you play; "if you showed off")                                                               | 832            | Battle Preparations, Rousing Display                                                                                                      |     2 |
| Bonus Damage filtered by source type ("abilities of friendly gear")                                                           | 712–715        | Ziggs, Short-Fused                                                                                                                        |     1 |
| Triggered abilities of cards in the trash (play-from-trash triggers)                                                          | 385            | Forbidden Technique                                                                                                                       |     1 |
| Per-turn history of where units/gear were played (conditional cost reduction)                                                 | 356.4          | Hold 'Em                                                                                                                                  |     1 |
| Triggered abilities that Add resources finalize and resolve immediately                                                       | 430.2, 430.2.a | Sneaky Zeebles                                                                                                                            |     1 |
| A cost that exhausts two objects (`Cost.exhaust` is one selector)                                                             | 357.2, 415.4   | Invigorating Bloom                                                                                                                        |     1 |
| Applied costs on moves ("opponents must pay [1][Rune] to move units here")                                                    | 204.4, 449     | Gravity Field                                                                                                                             |     1 |
| Trigger-count modification ("[Deathknell] effects here trigger an additional time")                                           | 808, 383       | Detonation Amplifier                                                                                                                      |     1 |
| `play` op ignoring only the Energy cost (it ignores all or none)                                                              | 356.1.b, 420.3 | Clocktower Guardian                                                                                                                       |     1 |
| Granting an activated ability to other objects ("Friendly legends have '[Tap]: …'")                                           | 365, 801.3     | Heartening Soul                                                                                                                           |     1 |
| Passives granting keywords to cards in hand (layers' array form ignores passives)                                             | 801.3, 806.1   | Jarvan IV, Martial Paragon                                                                                                                |     1 |
| Facedown-play provenance for units/gear (not on `unit_played`/`card_played`)                                                  | 811.6, 422.4   | Elnuk Herd                                                                                                                                |     1 |

## Engine keyword gaps and bugs (reproduced in `test/cards/rad/bugs.test.ts`, skipped)

Keywords are the engine's (cards are marked by their own lines), but at `8933035`:

- **Deploy's hold trigger is missing** (830.1.b "When an opponent holds here, kill this"):
  `triggers/keywords.ts` has no Deploy entry, so a Deploy gear survives an opponent's hold.
- **The built-in Equip ability does not attach** (818.1.c.2): `equip:<n>` activations resolve in
  the §6.4 manual window because `executeCardScript` has no ability for that ref (Nazuman Ntofo,
  Protector's Shield; their effect text is tested by attaching directly).
- **Quick-Draw's attach trigger** (819.1.c, "When you play it, attach it to a unit you control")
  is not implemented (play.md says it is R2-effects'); Protector's Shield.
- **Hidden record wiped at end of turn** (811.1.b, 317.2.c): `cleanup/cleanup.ts`
  ("expire-this-turn") deletes rules objects that have no buffs/baseMight/counters/grants/
  controller, which removes `hiddenTurn`/`hiddenBy` of a facedown card — so no card hidden on an
  earlier turn can be played from face down. The same keep-list drops `keywordGrants`,
  `mightMods`, `prevent`, `empowered` and `paidAdditionalCost` (effects.md asked to keep them).

- **"If you paid the additional cost" is true whenever runes pay** (356.4.f.1): `notePaidAdditionalCost`
  (`triggers/finalize.ts`) treats any non-empty `paid.additional` as the optional cost, but
  `paidCostRecord` (`play/payment.ts`) also stores `exhaustedRunes`/`recycledRunes`/`power` there,
  so Clockwork Keeper and Shimmering Swimmer trigger without the optional cost (their tests fund
  plays from the Rune Pool).

Other engine behaviour worth knowing when testing (not bugs of this lane):

- Unattached non-Deploy gear at a battlefield is recalled to the base by the host's
  `settleVictory` in every cleanup (RULES-ENGINE.md, known limitations), so "a gear at a
  battlefield" only stays there with Deploy.
- `movedThisTurn` is only recorded on units that already have a rules object (played units do).

## Card status

Counts: implemented: 95, partial: 22, remaining: 46

| Card                              | Status      | Not automated (rule)                                                                                                                                        |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ahri, Confident                   | implemented |                                                                                                                                                             |
| Akali, Brash                      | remaining   |                                                                                                                                                             |
| Amateur Demolitionist             | partial     |                                                                                                                                                             |
| An Offer You Can't Refuse         | implemented |                                                                                                                                                             |
| Angler Wyrm                       | implemented |                                                                                                                                                             |
| Antagonistic Apparatus            | implemented |                                                                                                                                                             |
| Armored Tusker                    | implemented |                                                                                                                                                             |
| Avalanche                         | implemented |                                                                                                                                                             |
| Bandle Scouts' Academy            | implemented |                                                                                                                                                             |
| Banner of Conquest                | implemented |                                                                                                                                                             |
| Battle Preparations               | partial     | [Show Off] (832) is not implemented, so "if you showed off, ready up to 2 runes" never applies.                                                             |
| Battlefield Armorer               | implemented |                                                                                                                                                             |
| Bedeviling Stranger               | implemented |                                                                                                                                                             |
| Bilgewater Tracker                | implemented |                                                                                                                                                             |
| Black Market                      | remaining   |                                                                                                                                                             |
| Black Rose Sanctum                | implemented |                                                                                                                                                             |
| Bloodscent Swarm                  | remaining   |                                                                                                                                                             |
| Blossoming Dreamroot              | implemented |                                                                                                                                                             |
| Brawl                             | implemented |                                                                                                                                                             |
| Burn Away                         | implemented |                                                                                                                                                             |
| Bushwhack Trap                    | remaining   |                                                                                                                                                             |
| Cataclysm                         | implemented |                                                                                                                                                             |
| Chronobreak                       | remaining   |                                                                                                                                                             |
| Clocktower Guardian               | partial     | Deathknell: the top card is banished, but playing it ignoring only its Energy cost (356.1.b) opens the manual window (the play op ignores all or no costs). |
| Coalesced Energy                  | implemented |                                                                                                                                                             |
| Command: Attack                   | implemented |                                                                                                                                                             |
| Concert Poster                    | implemented |                                                                                                                                                             |
| Consult the Heavens               | implemented |                                                                                                                                                             |
| Cosmic Vista                      | implemented |                                                                                                                                                             |
| Demacian Illuminators             | remaining   |                                                                                                                                                             |
| Demacian Standard                 | implemented |                                                                                                                                                             |
| Demon Shade                       | implemented |                                                                                                                                                             |
| Detonation Amplifier              | partial     | "Friendly [Deathknell] effects here trigger an additional time" needs trigger-count modification (808, 383).                                                |
| Disposal Expert                   | implemented |                                                                                                                                                             |
| Dockside Lock-Up                  | partial     | The banished card is played by the play op, which puts a unit at its controller's base (no location choice, 355.2 / 420.3.b).                               |
| Drakehound Packmaster             | partial     |                                                                                                                                                             |
| Dune Devourer                     | remaining   |                                                                                                                                                             |
| Durand Memorial                   | implemented |                                                                                                                                                             |
| Ekko, Boy Who Shattered Time      | remaining   |                                                                                                                                                             |
| Ekko, Ingenious                   | remaining   |                                                                                                                                                             |
| Ekko, Revolutionary               | implemented |                                                                                                                                                             |
| Elnuk Herd                        | partial     | "Recycle me if I was played from face down": a unit\'s play effect cannot tell a facedown play (811.6; not recorded on unit_played).                        |
| Encore                            | remaining   |                                                                                                                                                             |
| Entrenched Boar                   | remaining   |                                                                                                                                                             |
| Ephemeral Ward                    | implemented |                                                                                                                                                             |
| Evelynn in Control                | implemented |                                                                                                                                                             |
| Evelynn, Agony's Embrace          | remaining   |                                                                                                                                                             |
| Evelynn, Consuming                | remaining   |                                                                                                                                                             |
| Evelynn, in Control               | implemented |                                                                                                                                                             |
| Explosimian                       | partial     |                                                                                                                                                             |
| Fanfare                           | remaining   |                                                                                                                                                             |
| Firebrand Raider                  | remaining   |                                                                                                                                                             |
| Firelights' Hideout               | remaining   |                                                                                                                                                             |
| For Demacia!                      | implemented |                                                                                                                                                             |
| Forbidden Technique               | partial     | The trash trigger (play this from your trash for [1][Fury][Fury], then banish it) needs triggered abilities of cards outside the board (385).               |
| Graves, Blasting Through          | implemented |                                                                                                                                                             |
| Gravity Field                     | partial     | The move tax (opponents pay [1][Rune] to move units here) needs applied costs on moves (204.4, 449).                                                        |
| Gutter Guardian                   | remaining   |                                                                                                                                                             |
| Heartening Soul                   | partial     | Granting an activated ability to friendly legends needs granted abilities (365, 801.3 for abilities).                                                       |
| Heimerdinger, Academy Instructor  | remaining   |                                                                                                                                                             |
| Herald of the Emperor             | remaining   |                                                                                                                                                             |
| Hexplosive Minefield              | partial     |                                                                                                                                                             |
| High Note                         | implemented |                                                                                                                                                             |
| Hold 'Em                          | partial     | The [2] discount needs a per-turn record of where units/gear were played (356.4; no play-location history).                                                 |
| Hunker Down                       | implemented |                                                                                                                                                             |
| Hunters' Circle                   | remaining   |                                                                                                                                                             |
| Hunting Blind                     | implemented |                                                                                                                                                             |
| Hunting Dog                       | implemented |                                                                                                                                                             |
| Hush                              | implemented |                                                                                                                                                             |
| Improvised Projectile             | implemented |                                                                                                                                                             |
| Incorrigible Construct            | remaining   |                                                                                                                                                             |
| Industrious Mechsmith             | implemented |                                                                                                                                                             |
| Invigorating Bloom                | partial     | The activated ability's cost exhausts two objects (a friendly Mighty unit and this); `Cost.exhaust` holds one selector (357.2).                             |
| Iridescent Avian                  | implemented |                                                                                                                                                             |
| Jarvan IV, Exemplar of Demacia    | implemented |                                                                                                                                                             |
| Jarvan IV, Martial Paragon        | partial     | "Your gear with [Deploy] have [Action]" grants a keyword to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).         |
| Jarvan IV, Royal Heir             | implemented |                                                                                                                                                             |
| K'Sante, Courageous               | implemented |                                                                                                                                                             |
| K'Sante, Dauntless                | implemented |                                                                                                                                                             |
| K'Sante, Pride of Nazumah         | remaining   |                                                                                                                                                             |
| Kai'Sa, Rebel                     | remaining   |                                                                                                                                                             |
| Ki Burst                          | implemented |                                                                                                                                                             |
| Last Caress                       | remaining   |                                                                                                                                                             |
| Life from Stone                   | implemented |                                                                                                                                                             |
| Lingering Animus                  | remaining   |                                                                                                                                                             |
| Lost to the Sands                 | implemented |                                                                                                                                                             |
| Lulu, Whimsical                   | remaining   |                                                                                                                                                             |
| Mechanical Bandit                 | implemented |                                                                                                                                                             |
| Meticulous Restorationist         | remaining   |                                                                                                                                                             |
| Momentary Companion               | implemented |                                                                                                                                                             |
| Mordekaiser, Dominating           | implemented |                                                                                                                                                             |
| Mordekaiser, Iron Revenant        | remaining   |                                                                                                                                                             |
| Mordekaiser, Twice Slain          | remaining   |                                                                                                                                                             |
| Mournful Spirit                   | remaining   |                                                                                                                                                             |
| Mysterious Chronomancer           | implemented |                                                                                                                                                             |
| Nazuman Ntofo                     | implemented |                                                                                                                                                             |
| Neeko, Blending In                | remaining   |                                                                                                                                                             |
| Ntofo Strikes                     | implemented |                                                                                                                                                             |
| One-Two Punch                     | implemented |                                                                                                                                                             |
| Orianna, Exquisite                | implemented |                                                                                                                                                             |
| Orianna, Lady of Clockwork        | remaining   |                                                                                                                                                             |
| Orianna, Mechanical Marvel        | remaining   |                                                                                                                                                             |
| Overloaded Traveler               | implemented |                                                                                                                                                             |
| Packed Amphitheater               | remaining   |                                                                                                                                                             |
| Parallel Convergence              | remaining   |                                                                                                                                                             |
| Party Crasher                     | implemented |                                                                                                                                                             |
| Pillaged Armory                   | implemented |                                                                                                                                                             |
| Piltovan Guidebot                 | remaining   |                                                                                                                                                             |
| Pitiless Stalker                  | implemented |                                                                                                                                                             |
| Portable Portal                   | implemented |                                                                                                                                                             |
| Primordial Roar                   | remaining   |                                                                                                                                                             |
| Protector's Shield                | implemented |                                                                                                                                                             |
| Rakelstake                        | implemented |                                                                                                                                                             |
| Rally for War                     | implemented |                                                                                                                                                             |
| Raucous Anthem                    | implemented |                                                                                                                                                             |
| Raving Witness                    | implemented |                                                                                                                                                             |
| Realm of Death                    | implemented |                                                                                                                                                             |
| Remember the Fallen               | remaining   |                                                                                                                                                             |
| Resource Extractor                | implemented |                                                                                                                                                             |
| Resplendent Rostrum               | implemented |                                                                                                                                                             |
| Riptide Mage                      | implemented |                                                                                                                                                             |
| Riven, Deserter                   | implemented |                                                                                                                                                             |
| Rousing Display                   | partial     | [Show Off] (832) is not implemented, so the four-Recruit branch never applies.                                                                              |
| Ruined Monastery                  | implemented |                                                                                                                                                             |
| Runeblade Anvil                   | implemented |                                                                                                                                                             |
| Sanctum Conservator               | implemented |                                                                                                                                                             |
| Satchel Charge                    | partial     |                                                                                                                                                             |
| Scorched Earth                    | remaining   |                                                                                                                                                             |
| Scrutinizing Scope                | implemented |                                                                                                                                                             |
| Seraphic Wyvern                   | remaining   |                                                                                                                                                             |
| Seraphine, Inspiring              | remaining   |                                                                                                                                                             |
| Seraphine, Not Alone              | implemented |                                                                                                                                                             |
| Seraphine, Starry-Eyed Songstress | remaining   |                                                                                                                                                             |
| Shimmering Swimmer                | implemented |                                                                                                                                                             |
| Siren of the Shallows             | implemented |                                                                                                                                                             |
| Siren's Song                      | implemented |                                                                                                                                                             |
| Skystrike Squadron                | remaining   |                                                                                                                                                             |
| Sneaky Zeebles                    | partial     | 430.2: a triggered Add ability goes on the chain instead of resolving immediately.                                                                          |
| Spirit of the Forge               | remaining   |                                                                                                                                                             |
| Stalwart Goatherd                 | implemented |                                                                                                                                                             |
| Staunch Survivor                  | implemented |                                                                                                                                                             |
| Steadfast Outrider                | implemented |                                                                                                                                                             |
| Stoic Ferryman                    | implemented |                                                                                                                                                             |
| Storm Raptor                      | remaining   |                                                                                                                                                             |
| Strigian Oracle                   | implemented |                                                                                                                                                             |
| Suave Negotiator                  | implemented |                                                                                                                                                             |
| Supernova                         | implemented |                                                                                                                                                             |
| The Ball                          | implemented |                                                                                                                                                             |
| The Empyrean                      | remaining   |                                                                                                                                                             |
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
| Ziggs, Explosive                  | partial     |                                                                                                                                                             |
| Ziggs, Hexplosives Expert         | partial     |                                                                                                                                                             |
| Ziggs, Short-Fused                | partial     |                                                                                                                                                             |
