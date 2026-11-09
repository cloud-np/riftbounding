# Origins A–N card scripts (wave R3)

Lane: the `### Origins` rows of `docs/cards-coverage.md` → "Unscripted cards by set", names
starting A through N (126 cards). Scripts live in `packages/rules/src/cards/OGN/<slug>.ts` and are
registered through `src/cards/OGN/batch-a-n.ts`; behaviour tests are in
`packages/rules/test/cards/ogn-a-n/` (one `[C:Card Name]` test per card).

Counts: **15 implemented**, **0 partial**, **0 manual**,
**111 not yet scripted**.

## Conventions used

- Keywords the engine implements (Accelerate, Action, Reaction, Hidden, Legion, Assault, Shield, Tank,
  Deflect, Ganking, Vision, Deathknell, …) come from the printed keywords and are not re-scripted.
  Catalog keywords that are only granted/reminder text are suppressed with
  `{ kind: "keyword", keyword, value: 0 }` (727.1.b, 831.2).
- [Legion] dependent abilities use `ogn-an:legion` (812.1.c: another card was Finalized by you this
  turn, via R2-play's `legionActive`).
- Custom ids registered by this lane (all prefixed `ogn-an:`) are listed in the "Custom ids" section.

## Capability gaps

Engine capabilities missing for full automation (feeds the next engine pass).

| Capability | Rule ids | Cards blocked | Count |
| ---------- | -------- | ------------- | ----- |

## Custom ids

| Id                             | Kind      | Registered in          | Meaning                                                         |
| ------------------------------ | --------- | ---------------------- | --------------------------------------------------------------- |
| `ogn-an:channelled-fewer-than` | condition | `catalyst-of-aeons.ts` | the preceding `channel` channelled fewer than `n` runes (431.3) |
| `ogn-an:in-combat`             | condition | `cannon-barrage.ts`    | `it` is in combat (740.2.c)                                     |

## Card status

| Card                         | Type        | Status      | Notes |
| ---------------------------- | ----------- | ----------- | ----- |
| Acceptable Losses            | Spell       | remaining   |       |
| Adaptatron                   | Unit        | remaining   |       |
| Ahri, Alluring               | Unit        | remaining   |       |
| Ahri, Inquisitive            | Unit        | remaining   |       |
| Ahri, Nine-Tailed Fox        | Legend      | remaining   |       |
| Albus Ferros                 | Unit        | remaining   |       |
| Anivia, Primal               | Unit        | remaining   |       |
| Arena Bar                    | Gear        | remaining   |       |
| Ava Achiever                 | Unit        | remaining   |       |
| Back to Back                 | Spell       | remaining   |       |
| Baited Hook                  | Gear        | remaining   |       |
| Bilgewater Bully             | Unit        | remaining   |       |
| Blastcone Fae                | Unit        | remaining   |       |
| Blazing Scorcher             | Unit        | implemented |       |
| Blind Fury                   | Spell       | remaining   |       |
| Blitzcrank, Impassive        | Unit        | remaining   |       |
| Block                        | Spell       | remaining   |       |
| Brazen Buccaneer             | Unit        | remaining   |       |
| Brynhir Thundersong          | Unit        | remaining   |       |
| Bullet Time                  | Spell       | remaining   |       |
| Call to Glory                | Spell       | remaining   |       |
| Cannon Barrage               | Spell       | remaining   |       |
| Captain Farron               | Unit        | remaining   |       |
| Carnivorous Snapvine         | Unit        | remaining   |       |
| Catalyst of Aeons            | Spell       | remaining   |       |
| Cemetery Attendant           | Unit        | implemented |       |
| Charm                        | Spell       | remaining   |       |
| Chemtech Enforcer            | Unit        | implemented |       |
| Cithria of Cloudfield        | Unit        | remaining   |       |
| Cleave                       | Spell       | remaining   |       |
| Commander Ledros             | Unit        | remaining   |       |
| Confront                     | Spell       | remaining   |       |
| Consult the Past             | Spell       | remaining   |       |
| Convergent Mutation          | Spell       | remaining   |       |
| Crackshot Corsair            | Unit        | remaining   |       |
| Cruel Patron                 | Unit        | remaining   |       |
| Cull the Weak                | Spell       | remaining   |       |
| Dangerous Duo                | Unit        | remaining   |       |
| Daring Poro                  | Unit        | implemented |       |
| Darius, Executioner          | Unit        | remaining   |       |
| Darius, Hand of Noxus        | Legend      | remaining   |       |
| Darius, Trifarian            | Unit        | remaining   |       |
| Dazzling Aurora              | Gear        | remaining   |       |
| Deadbloom Predator           | Unit        | remaining   |       |
| Disintegrate                 | Spell       | remaining   |       |
| Divine Judgment              | Spell       | remaining   |       |
| Dragon's Rage                | Spell       | remaining   |       |
| Draven, Showboat             | Unit        | remaining   |       |
| Dune Drake                   | Unit        | remaining   |       |
| Eager Apprentice             | Unit        | remaining   |       |
| Ekko, Recurrent              | Unit        | remaining   |       |
| Ember Monk                   | Unit        | remaining   |       |
| Energy Conduit               | Gear        | remaining   |       |
| Facebreaker                  | Spell       | remaining   |       |
| Fading Memories              | Spell       | remaining   |       |
| Faithful Manufactor          | Unit        | implemented |       |
| Falling Comet                | Spell       | remaining   |       |
| Fight or Flight              | Spell       | remaining   |       |
| Find Your Center             | Spell       | remaining   |       |
| Fiora, Victorious            | Unit        | remaining   |       |
| First Mate                   | Unit        | implemented |       |
| Flame Chompers               | Unit        | remaining   |       |
| Flurry of Blades             | Spell       | remaining   |       |
| Forge of the Future          | Gear        | remaining   |       |
| Fox-Fire                     | Spell       | remaining   |       |
| Garbage Grabber              | Gear        | remaining   |       |
| Gemcraft Seer                | Unit        | remaining   |       |
| Get Excited!                 | Spell       | remaining   |       |
| Grand Strategem              | Spell       | remaining   |       |
| Guerilla Warfare             | Spell       | remaining   |       |
| Hallowed Tomb                | Battlefield | remaining   |       |
| Harnessed Dragon             | Unit        | implemented |       |
| Heimerdinger, Inventor       | Unit        | remaining   |       |
| Herald of Scales             | Unit        | remaining   |       |
| Icathian Rain                | Spell       | remaining   |       |
| Immortal Phoenix             | Unit        | remaining   |       |
| Imperial Decree              | Spell       | remaining   |       |
| Invert Timelines             | Spell       | remaining   |       |
| Iron Ballista                | Gear        | remaining   |       |
| Jeweled Colossus             | Unit        | implemented |       |
| Jinx, Demolitionist          | Unit        | remaining   |       |
| Jinx, Loose Cannon           | Legend      | remaining   |       |
| Jinx, Rebel                  | Unit        | remaining   |       |
| Kadregrin the Infernal       | Unit        | implemented |       |
| Kai'Sa, Daughter of the Void | Legend      | remaining   |       |
| Kai'Sa, Evolutionary         | Unit        | remaining   |       |
| Kai'Sa, Survivor             | Unit        | implemented |       |
| Karma, Channeler             | Unit        | remaining   |       |
| Karthus, Eternal             | Unit        | remaining   |       |
| Kayn, Unleashed              | Unit        | remaining   |       |
| King's Edict                 | Spell       | remaining   |       |
| Kinkou Monk                  | Unit        | remaining   |       |
| Kog'Maw, Caustic             | Unit        | remaining   |       |
| Kraken Hunter                | Unit        | remaining   |       |
| Last Breath                  | Spell       | remaining   |       |
| Lecturing Yordle             | Unit        | implemented |       |
| Lee Sin, Ascetic             | Unit        | remaining   |       |
| Lee Sin, Blind Monk          | Legend      | remaining   |       |
| Lee Sin, Centered            | Unit        | remaining   |       |
| Legion Rearguard             | Unit        | implemented |       |
| Leona, Determined            | Unit        | remaining   |       |
| Leona, Radiant Dawn          | Legend      | remaining   |       |
| Leona, Zealot                | Unit        | remaining   |       |
| Machine Evangel              | Unit        | remaining   |       |
| Maddened Marauder            | Unit        | remaining   |       |
| Mageseeker Warden            | Unit        | remaining   |       |
| Magma Wurm                   | Unit        | remaining   |       |
| Malzahar, Fanatic            | Unit        | remaining   |       |
| Mask of Foresight            | Gear        | remaining   |       |
| Mega-Mech                    | Unit        | implemented |       |
| Mindsplitter                 | Unit        | remaining   |       |
| Miss Fortune, Bounty Hunter  | Legend      | remaining   |       |
| Miss Fortune, Buccaneer      | Unit        | remaining   |       |
| Miss Fortune, Captain        | Unit        | remaining   |       |
| Mistfall                     | Gear        | remaining   |       |
| Mobilize                     | Spell       | remaining   |       |
| Monastery of Hirana          | Battlefield | remaining   |       |
| Morbid Return                | Spell       | remaining   |       |
| Mountain Drake               | Unit        | implemented |       |
| Mushroom Pouch               | Gear        | remaining   |       |
| Mystic Poro                  | Unit        | implemented |       |
| Mystic Reversal              | Spell       | remaining   |       |
| Navori Fighting Pit          | Battlefield | remaining   |       |
| Nocturne, Horrifying         | Unit        | remaining   |       |
| Noxian Drummer               | Unit        | remaining   |       |
| Noxus Saboteur               | Unit        | remaining   |       |
