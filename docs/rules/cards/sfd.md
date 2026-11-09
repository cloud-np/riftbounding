# Spiritforged (SFD) card scripts — wave R3

Lane: the `### Spiritforged` rows of `## Unscripted cards by set` in `docs/cards-coverage.md`
(215 cards). Scripts live in `packages/rules/src/cards/SFD/batch-*.ts` (shared builders and
lane-prefixed custom conditions/effects in `common.ts`); one behaviour test per card in
`packages/rules/test/cards/sfd/`.

## Summary

| Status | Cards |
| --- | --- |
| implemented | 25 |
| partial | 1 |
| manual | 0 |
| remaining (unscripted) | 189 |

Status rules: `implemented` only when every line of the current text (errata applied) is
automated and tested; `partial` names exactly what is not automated and why; `manual` cards
resolve through the §6.4 manual window. Keywords the engine implements (Accelerate, Action,
Reaction, Hidden, Deflect, Ganking, Assault, Shield, Tank, Vision, Temporary, Legion, …) come
from the printed keywords and are not re-implemented. Catalog keywords that a card only grants
("Your Mechs have [Deflect]") or only has in effect text are marked not intrinsic
(`{ kind: "keyword", keyword, value: 0 }`, 727.1.b).

## Capability gaps

Engine capabilities that block automation of lane cards (feeds the next engine pass).

| Capability | Rule ids | Cards blocked | Count |
| --- | --- | --- | --- |
| "Alone" at death needs last-known information of other objects that left the board simultaneously | 359.3.e.13, 467.2.d | Lonely Poro | 1 |
| Repeat: the paid Repeat cost does not execute the instructions a second time, and the second execution's own play-time choices are not asked | 820.1.d, 820.1.d.1, 820.2, 820.2.a |  | 0 |
| Built-in Equip (`equip:<n>`) resolves in the §6.4 manual window instead of attaching | 818.1.c.2 |  | 0 |
| Weaponmaster play trigger (choose an Equipment you control, Equip it for [A] less) | 821.1.b, 821.1.c |  | 0 |
| Quick-Draw attach trigger ("When you play this, attach it to a unit you control") | 819.1.d |  | 0 |

## Engine reproductions (`[BUG]`, skipped)

In `packages/rules/test/cards/sfd/bugs.test.ts`; the scripts do not work around them.

- `[C:Feral Strength][R820.1.d]` — a paid Repeat cost is charged (`cost:repeat` recorded) but the effect resolves once.
- `[C:Doran's Blade][R818.1.c.2]` — the built-in `equip:<n>` activation is paid, then resolves in the manual window (no attach).
- `[C:Combat Chef][R821.1.b]` — no Weaponmaster trigger when a Weaponmaster unit is played.
- `[C:Long Sword][R819.1.d]` — no Quick-Draw attach trigger when a Quick-Draw gear is played.

## Custom conditions and effects (`sfd:*`)

Registered in `packages/rules/src/cards/SFD/common.ts` (pure; import-time tables).

- `sfd:attached-to-self` (condition)
- `sfd:attacking` (condition)
- `sfd:controls-source-battlefield` (condition)
- `sfd:died-alone` (condition)
- `sfd:event-card-power-at-least` (condition)
- `sfd:event-card-type` (condition)
- `sfd:event-from-battlefield` (condition)
- `sfd:event-might-at-least` (condition)
- `sfd:mill` (effect)
- `sfd:played-equipment-this-turn` (condition)
- `sfd:ref-here` (condition)
- `sfd:ref-was-friendly` (condition)
- `sfd:self-not-in-hand` (condition)
- `sfd:self-won-combat` (condition)

## Card status

| Card | Status | Not automated / notes |
| --- | --- | --- |
| Against the Odds | implemented |  |
| Beast Below | implemented |  |
| Blood Money | implemented |  |
| Bubble Bot | implemented |  |
| Defiant Dance | implemented |  |
| Detonate | implemented |  |
| Direwing | implemented |  |
| Downwell | implemented |  |
| Drag Under | implemented |  |
| Eager Drakehound | implemented |  |
| Factory Recall | implemented |  |
| Ferrous Forerunner | implemented |  |
| Honest Broker | implemented |  |
| Lonely Poro | partial |  |
| On the Hunt | implemented |  |
| Premonition | implemented |  |
| Production Surge | implemented |  |
| Punch First | implemented |  |
| Royal Guard | implemented |  |
| Sandshifter | implemented |  |
| Show of Strength | implemented |  |
| Sudden Storm | implemented |  |
| Trove Golem | implemented |  |
| Unsung Hero | implemented |  |
| Wages of Pain | implemented |  |
| Xin Zhao, Vigilant | implemented |  |

## Remaining (unscripted)

Akshan, Mischievous, Altar of Memories, Ancient Henge, Ancient Warmonger, Angle Shot, Aphelios, Exalted, Apprentice Smith, Arcane Shift, Arise!, Armed Assailant, Aspiring Engineer, Assembly Rig, Azir, Ascendant, Azir, Emperor of the Sands, Azir, Sovereign, B.F. Sword, Bard, Mercurial, Battering Ram, Bellows Breath, Black Market Broker, Blade of the Ruined King, Blast Corps Cadet, Blood Rush, Bonds of Strength, Boneshiver, Boots of Swiftness, Breakneck Mech, Brutalizer, Buhru Captain, Bushwhack, Called Shot, Card Sharp, Chemtech Cask, Cloth Armor, Combat Chef, Corina Veraza, Corrupt Enforcer, Counter Strike, Cull, Danger Zone, Dauntless Vanguard, Desert's Call, Disarming Rake, Doran's Blade, Doran's Ring, Doran's Shield, Draven, Audacious, Draven, Glorious Executioner, Draven, Vanquisher, Dropboarder, Dunebreaker, Edge of Night, Eminent Benefactor, Emperor's Dais, Emperor's Divide, Experimental Hexplate, Eye of the Herald, Ezreal, Dashing, Ezreal, Prodigal Explorer, Ezreal, Prodigy, Fae Dragon, Fae Porter, Fiora, Grand Duelist, Fiora, Peerless, Fiora, Worthy, Fizz, Trickster, Forecaster, Forge of the Fluft, Forgefire Cape, Forgotten Monument, Frostcoat Cub, Gearhead, Gem Jammer, Glasc Mixologist, Guardian Angel, Guardian of the Passage, Guards!, Hall of Legends, Hard Bargain, Harpoon Squad, Heart of Dark Ice, Here to Help, Hexdrinker, Hextech Anomaly, Hostile Takeover, Irelia, Blade Dancer, Irelia, Fervent, Irelia, Graceful, Jae Medarda, Janna, Savior, Jaull-Fish, Jax, Grandmaster at Arms, Jax, Unmatched, Jax, Unrelenting, Jayce, Man of Progress, Kato the Arm, Last Rites, Laurent Bladekeeper, Laurent Duelist, Legion Quartermaster, Long Sword, Loyal Pup, Lucian, Gunslinger, Lucian, Merciless, Lucian, Purifier, Marai Spire, Marching Orders, Master Bingwen, Minefield, Minotaur Reckoner, Navori Scout, Needlessly Large Yordle, Not So Fast, Ornn, Blacksmith, Ornn, Fire Below the Mountain, Ornn, Forge God, Ornn's Forge, Overzealous Fan, Perched Grimwyrm, Petricite Monument, Pickpocket, Piercing Light, Plundering Poro, Poro Snax, Power Nexus, Prize of Progress, Rabadon's Deathcrown, Rally the Troops, Ravenbloom Conservatory, Recurve Bow, Rek'Sai, Breacher, Rek'Sai, Swarm Queen, Rek'Sai, Void Burrower, Relentless Pursuit, Rell, Magnetic, Renata Glasc, Chem-Baroness, Renata Glasc, Industrialist, Renata Glasc, Mastermind, Rengar, Pouncing, Ribbon Dancer, Riposte, Rocket Barrage, Rockfall Path, Royal Entourage, Rumble, Hotheaded, Rumble, Mechanized Menace, Rumble, Scrapper, Sacred Shears, Sea Monkey, Seat of Power, Sentinel Adept, Serrated Dirk, Shurelya's Requiem, Simian Ancestor, Sivir, Ambitious, Sivir, Battle Mistress, Sivir, Mercenary, Skyfall of Areion, Soraka, Wanderer, Spinning Axe, Spirit Wheel, Sterak's Gage, Strike Down, Sunken Temple, Svellsongur, Switcheroo, Temporal Portal, Temptation, The Papertree, The Zero Drive, Thwonk!, Tianna Crownguard, Treasure Hoard, Trinity Force, Trusty Ramhound, Undertitan, Vanguard Armory, Veiled Temple, Veteran poro, Vex, Cheerless, Void Drone, Void Hatchling, Void Rush, Warmog's Armor, Windsinger, World Atlas, Yone, Blademaster, Yordle Explorer, Zaun Punk
