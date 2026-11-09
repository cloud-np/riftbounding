# Spiritforged (SFD) card scripts — wave R3

Lane: the `### Spiritforged` rows of `## Unscripted cards by set` in `docs/cards-coverage.md`
(215 cards). Scripts live in `packages/rules/src/cards/SFD/batch-*.ts` (shared builders and
lane-prefixed custom conditions/effects in `common.ts`); one behaviour test per card in
`packages/rules/test/cards/sfd/`.

## Summary

| Status | Cards |
| --- | --- |
| implemented | 38 |
| partial | 40 |
| manual | 4 |
| remaining (unscripted) | 133 |

Status rules: `implemented` only when every line of the current text (errata applied) is
automated and tested; `partial` names exactly what is not automated and why; `manual` cards
resolve through the §6.4 manual window. Keywords the engine implements (Accelerate, Action,
Reaction, Hidden, Deflect, Ganking, Assault, Shield, Tank, Vision, Temporary, Legion, …) come
from the printed keywords and are not re-implemented. Catalog keywords that a card only grants
("Your Mechs have [Deflect]") or only has in effect text are marked not intrinsic
(`{ kind: "keyword", keyword, value: 0 }`, 727.1.b); effect-text keywords and Might Bonuses of
Equipment are host-targeted passives (718.3/718.4).

## Capability gaps

Engine capabilities that block automation of lane cards (feeds the next engine pass), sorted by
the number of cards blocked.

| Capability | Rule ids | Cards blocked | Count |
| --- | --- | --- | --- |
| Built-in Equip (`equip:<n>`) is activated and paid but resolves in the §6.4 manual window instead of attaching | 818.1.c.2 | B.F. Sword, Blade of the Ruined King, Boneshiver, Boots of Swiftness, Brutalizer, Cloth Armor, Cull, Doran's Blade, Doran's Ring, Doran's Shield, Edge of Night, Experimental Hexplate, Eye of the Herald, Forgefire Cape, Guardian Angel, Hexdrinker, Long Sword, Rabadon's Deathcrown, Recurve Bow, Sacred Shears, Serrated Dirk, Shurelya's Requiem, Skyfall of Areion, Spinning Axe, Sterak's Gage, Svellsongur, The Zero Drive, Trinity Force, Warmog's Armor, World Atlas | 30 |
| Triggered abilities in an attached card's Effect Text (appended to the top-most card) are never detected (`triggers/detect.ts` skips attached cards) | 718.3, 719.1 | Boneshiver, Cull, Doran's Ring, Eye of the Herald, Forgefire Cape, Last Rites, Recurve Bow, Sacred Shears, The Zero Drive, Trinity Force, Warmog's Armor, World Atlas | 12 |
| Repeat: the paid Repeat cost does not execute the instructions a second time, and the second execution's own play-time choices are not asked | 820.1.d, 820.1.d.1, 820.2, 820.2.a | Bellows Breath, Blood Rush, Bonds of Strength, Called Shot, Danger Zone, Desert's Call | 6 |
| Weaponmaster play trigger (choose an Equipment you control, Equip it for [A] less) | 821.1.b, 821.1.c | Armed Assailant, Combat Chef, Master Bingwen, Ornn, Forge God, Sentinel Adept, Veteran poro | 6 |
| Quick-Draw attach trigger ("When you play this, attach it to a unit you control") | 819.1.d | Cloth Armor, Long Sword, Spinning Axe, Sterak's Gage | 4 |
| Effect Text of attached cards other than host-targeted Might/keyword passives: player-level passives (Bonus Damage), passives for other units ("your units here"), replacement abilities | 718.3, 719.1, 369.1, 712 | Guardian Angel, Rabadon's Deathcrown, Shurelya's Requiem | 3 |
| Non-standard costs not payable (cost-text `unsupported:*`): "Recycle N cards / a unit from your trash", "Banish this" | 203.3, 357.2, 417.6 | Last Rites, The Zero Drive | 2 |
| Tag-granting modifier ("I am a Mech" for the equipped unit) | 479.2, 718.3 | Experimental Hexplate | 1 |
| Attachments made this turn are not tracked ("if this was attached to me this turn") | 435, 718 | Brutalizer | 1 |
| Re-classifying conquer/hold triggered abilities ("my hold effects are also conquer effects") | 383.4.c, 383.4.d | Skyfall of Areion | 1 |
| Playing a card from face down is not recorded on the play events ("when you play this from face down") | 811.1.b, 420.4 | Edge of Night | 1 |
| Copying text | 446 | Svellsongur | 1 |
| "Alone" at death needs last-known information of other objects that left the board simultaneously | 359.3.e.13, 467.2.d | Lonely Poro | 1 |

## Engine reproductions (`[BUG]`, skipped)

In `packages/rules/test/cards/sfd/bugs.test.ts`; the scripts do not work around them.

- `[C:Feral Strength][R820.1.d]` — a paid Repeat cost is charged (`cost:repeat` recorded) but the effect resolves once.
- `[C:Doran's Blade][R818.1.c.2]` — the built-in `equip:<n>` activation is paid, then resolves in the manual window (no attach).
- `[C:Combat Chef][R821.1.b]` — no Weaponmaster trigger when a Weaponmaster unit is played.
- `[C:Long Sword][R819.1.d]` — no Quick-Draw attach trigger when a Quick-Draw gear is played.

## Card data issues

- Bonds of Strength — catalog text "Give two friendly units each +1 [Might]" has no duration and no closing period (likely truncated); scripted `manual` until confirmed.

## Custom conditions and effects (`sfd:*`)

Registered in `packages/rules/src/cards/SFD/common.ts` (pure; import-time tables).

- `sfd:attached-to-self` (condition)
- `sfd:attacking` (condition)
- `sfd:controls-source-battlefield` (condition)
- `sfd:died-alone` (condition)
- `sfd:draw-ref` (effect)
- `sfd:event-card-power-at-least` (condition)
- `sfd:event-card-type` (condition)
- `sfd:event-from-battlefield` (condition)
- `sfd:event-might-at-least` (condition)
- `sfd:mill` (effect)
- `sfd:no-nontoken-gear-played-this-turn` (condition)
- `sfd:played-equipment-this-turn` (condition)
- `sfd:ref-here` (condition)
- `sfd:ref-was-friendly` (condition)
- `sfd:self-not-in-hand` (condition)
- `sfd:self-won-combat` (condition)
- `sfd:you-won-combat` (condition)

## Card status

| Card | Status | Not automated / notes |
| --- | --- | --- |
| Against the Odds | implemented |  |
| Armed Assailant | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| B.F. Sword | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Battering Ram | implemented |  |
| Beast Below | implemented |  |
| Bellows Breath | partial | Repeat (820.1.d / 820.2): the engine charges the Repeat cost but does not execute the instructions a second time (with new choices); only the first execution is automated. |
| Blade of the Ruined King | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Blood Money | implemented |  |
| Blood Rush | partial | Repeat (820.1.d / 820.2): the engine charges the Repeat cost but does not execute the instructions a second time (with new choices); only the first execution is automated. |
| Bonds of Strength | manual | The catalog text omits the duration of "+1 [Might]" (no "this turn", no closing period), so the effect cannot be scripted faithfully; it resolves in the §6.4 manual window until the text is confirmed. Repeat (820.1.d) is also not executed by the engine. |
| Boneshiver | partial | "When I conquer, channel 1 rune exhausted": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Boots of Swiftness | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Breakneck Mech | implemented |  |
| Brutalizer | partial | "If this was attached to me this turn, +2 Might": attachments made this turn are not tracked by the engine (435 / 718). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Bubble Bot | implemented |  |
| Called Shot | partial | Repeat (820.1.d / 820.2): the engine charges the Repeat cost but does not execute the instructions a second time (with new choices); only the first execution is automated. |
| Cloth Armor | partial | Quick-Draw (819.1.d): Reaction timing is the engine's, but its "when you play this, attach it" trigger is not implemented. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Combat Chef | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| Cull | partial | "When I conquer, play a Gold": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Danger Zone | partial | Repeat (820.1.d / 820.2): the engine charges the Repeat cost but does not execute the instructions a second time (with new choices); only the first execution is automated. |
| Defiant Dance | implemented |  |
| Desert's Call | partial | Repeat (820.1.d / 820.2): the engine charges the Repeat cost but does not execute the instructions a second time (with new choices); only the first execution is automated. |
| Detonate | implemented |  |
| Direwing | implemented |  |
| Doran's Blade | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Doran's Ring | partial | "When I conquer, discard 1, then draw 1": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Doran's Shield | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Downwell | implemented |  |
| Drag Under | implemented |  |
| Eager Drakehound | implemented |  |
| Edge of Night | partial | "When you play this from face down, attach it": playing from face down (811) is not recorded on the play events, so the trigger cannot be detected. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Experimental Hexplate | partial | "I am a Mech" (the equipped unit gains the Mech tag): no tag-granting modifier in the layers (479.2 / 718.3). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Eye of the Herald | manual | "When I move, play a Recruit here": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. Nothing else to automate (+0 Might). |
| Factory Recall | implemented |  |
| Ferrous Forerunner | implemented |  |
| Forecaster | implemented |  |
| Forgefire Cape | partial | "When I attack or defend, deal 2 to all enemy units here": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Guardian Angel | partial | "If I would die, kill Guardian Angel instead …": the engine ignores replacement abilities of attached cards (replacements/interceptor.ts skips them, 718.2), so this effect-text replacement (369.1, appended to the top-most card, 718.3) is not applied. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Heart of Dark Ice | implemented |  |
| Hexdrinker | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Honest Broker | implemented |  |
| Jaull-Fish | implemented |  |
| Last Rites | partial | Its Equip cost "Recycle 2 cards from your trash" is not a payable cost in the engine (cost-text: unsupported → unpayable, 203.3), and "When I conquer or hold, you may play a unit from your trash": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. |
| Laurent Bladekeeper | implemented |  |
| Laurent Duelist | implemented |  |
| Lonely Poro | partial | "Alone" is checked against friendly units still at my location after the death; friendly units that died simultaneously (e.g. the same combat damage step, 467.2.d) are not looked back at (no last-known information of other objects, 359.3.e.13). |
| Long Sword | partial | Quick-Draw (819.1.d): Reaction timing is the engine's, but its "when you play this, attach it" trigger is not implemented. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Master Bingwen | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| Navori Scout | implemented |  |
| On the Hunt | implemented |  |
| Ornn, Forge God | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| Petricite Monument | implemented |  |
| Poro Snax | implemented |  |
| Premonition | implemented |  |
| Production Surge | implemented |  |
| Punch First | implemented |  |
| Rabadon's Deathcrown | partial | "Your spells and abilities deal 3 Bonus Damage (while this is attached)": the layers only collect host-targeted passives of attached cards (718.3), so this player-level effect-text passive is not applied (712–715). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Recurve Bow | manual | "When I attack or defend, deal 2 to an enemy unit here": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. Nothing else to automate (+0 Might). |
| Royal Guard | implemented |  |
| Rumble, Mechanized Menace | implemented |  |
| Rumble, Scrapper | implemented |  |
| Sacred Shears | partial | "[Deathknell] — Draw 1" (the equipped unit's death): its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Sandshifter | implemented |  |
| Sentinel Adept | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| Serrated Dirk | partial | Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Show of Strength | implemented |  |
| Shurelya's Requiem | partial | "Your units here have [Ganking]": the layers only collect host-targeted passives of attached cards (718.3), so this effect-text passive for other units is not applied. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Skyfall of Areion | partial | "My hold effects are also conquer effects, and vice versa": no engine support for re-classifying conquer/hold triggered abilities (383.4.c/383.4.d). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Spinning Axe | partial | Quick-Draw (819.1.d): Reaction timing is the engine's, but its "when you play this, attach it" trigger is not implemented. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. Its Temporary only applies while unattached (printed reminder), so the generic Temporary keyword trigger is replaced by its own rules-text trigger (816.1.b; an attached card's rules text is Inactive, 718.2). |
| Sterak's Gage | partial | Quick-Draw (819.1.d): Reaction timing is the engine's, but its "when you play this, attach it" trigger is not implemented. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Sudden Storm | implemented |  |
| Svellsongur | manual | "Copy that unit's text to this Equipment's effect text": copying text (446) is not implemented, and copied effect text would also need effect-text abilities of attached cards (718.3). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| The Zero Drive | partial | "[Deathknell] — Banish me": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. "[3][Mind], Banish this: Play all units banished with this": cards banished by a specific object are not tracked and "Banish this" is not a payable cost (cost-text: unsupported). Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Trinity Force | partial | "When I hold, score 1 point": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Trove Golem | implemented |  |
| Trusty Ramhound | implemented |  |
| Unsung Hero | implemented |  |
| Veteran poro | partial | Weaponmaster (821.1.b): the engine has no Weaponmaster play trigger yet; the keyword is not re-implemented here. |
| Wages of Pain | implemented |  |
| Warmog's Armor | partial | "When I conquer, buff me": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| World Atlas | partial | "When I hold, play two Gold": its effect-text triggered ability is appended to the top-most card (718.3/719.1), but the engine ignores triggered abilities of attached cards. Equip (818.1.c.2): the built-in `equip:<n>` ability is activated and paid, but resolves in the §6.4 manual window (no interpreter path); the effect text applies once attached. |
| Xin Zhao, Vigilant | implemented |  |

## Remaining (unscripted)

Akshan, Mischievous, Altar of Memories, Ancient Henge, Ancient Warmonger, Angle Shot, Aphelios, Exalted, Apprentice Smith, Arcane Shift, Arise!, Aspiring Engineer, Assembly Rig, Azir, Ascendant, Azir, Emperor of the Sands, Azir, Sovereign, Bard, Mercurial, Black Market Broker, Blast Corps Cadet, Buhru Captain, Bushwhack, Card Sharp, Chemtech Cask, Corina Veraza, Corrupt Enforcer, Counter Strike, Dauntless Vanguard, Disarming Rake, Draven, Audacious, Draven, Glorious Executioner, Draven, Vanquisher, Dropboarder, Dunebreaker, Eminent Benefactor, Emperor's Dais, Emperor's Divide, Ezreal, Dashing, Ezreal, Prodigal Explorer, Ezreal, Prodigy, Fae Dragon, Fae Porter, Fiora, Grand Duelist, Fiora, Peerless, Fiora, Worthy, Fizz, Trickster, Forge of the Fluft, Forgotten Monument, Frostcoat Cub, Gearhead, Gem Jammer, Glasc Mixologist, Guardian of the Passage, Guards!, Hall of Legends, Hard Bargain, Harpoon Squad, Here to Help, Hextech Anomaly, Hostile Takeover, Irelia, Blade Dancer, Irelia, Fervent, Irelia, Graceful, Jae Medarda, Janna, Savior, Jax, Grandmaster at Arms, Jax, Unmatched, Jax, Unrelenting, Jayce, Man of Progress, Kato the Arm, Legion Quartermaster, Loyal Pup, Lucian, Gunslinger, Lucian, Merciless, Lucian, Purifier, Marai Spire, Marching Orders, Minefield, Minotaur Reckoner, Needlessly Large Yordle, Not So Fast, Ornn, Blacksmith, Ornn, Fire Below the Mountain, Ornn's Forge, Overzealous Fan, Perched Grimwyrm, Pickpocket, Piercing Light, Plundering Poro, Power Nexus, Prize of Progress, Rally the Troops, Ravenbloom Conservatory, Rek'Sai, Breacher, Rek'Sai, Swarm Queen, Rek'Sai, Void Burrower, Relentless Pursuit, Rell, Magnetic, Renata Glasc, Chem-Baroness, Renata Glasc, Industrialist, Renata Glasc, Mastermind, Rengar, Pouncing, Ribbon Dancer, Riposte, Rocket Barrage, Rockfall Path, Royal Entourage, Rumble, Hotheaded, Sea Monkey, Seat of Power, Simian Ancestor, Sivir, Ambitious, Sivir, Battle Mistress, Sivir, Mercenary, Soraka, Wanderer, Spirit Wheel, Strike Down, Sunken Temple, Switcheroo, Temporal Portal, Temptation, The Papertree, Thwonk!, Tianna Crownguard, Treasure Hoard, Undertitan, Vanguard Armory, Veiled Temple, Vex, Cheerless, Void Drone, Void Hatchling, Void Rush, Windsinger, Yone, Blademaster, Yordle Explorer, Zaun Punk
