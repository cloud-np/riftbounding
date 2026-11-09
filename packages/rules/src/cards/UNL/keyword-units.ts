/**
 * Unleashed units whose whole text is engine keywords (no card-specific ability):
 *
 * - [Ambush] 822 (play/locations), [Accelerate] 805 (play/additional-costs), [Assault]/[Shield]/
 *   [Tank] 807/814/815 (combat keyword profile), [Deflect] 809, [Ganking] 810, [Hunt] 823
 *   (keyword trigger); values come from the printed text ("[Assault 2]", "[Shield 2]", "[Hunt 3]").
 * - "I don't deal combat damage." (Galio) is read by R2-combat's `dealsCombatDamage` (424.1.b
 *   analogue).
 * - Catalog keyword lists include the [Reaction] of Ambush's reminder text; it is not the unit's
 *   own keyword (135.2.d.3), so it is suppressed (`value: 0`, 727.1.b convention).
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Inferna",
  text: "[Ambush] (You may play me as a [reaction] to a battlefield where you have units.)\n[Assault 2] (+2 [might] while I'm an attacker.)",
  status: "implemented",
  abilities: [{ kind: "keyword", keyword: "Reaction", value: 0 }],
});

registerCardScript({
  name: "Mutated Mouser",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Rengar, Unseen",
  text: "[Accelerate] (You may pay [1] [fury] as an additional cost to have me enter ready.)\n[Assault 2] (+2 [might] while I'm the attacker.)\n[Deflect] (Opponents must pay [rune] to choose me with a spell or ability.)\n[Ganking] (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Sharkling",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\n[Assault 4] (+4 [Might] while I'm an attacker.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Towering Combatant",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Voracious Gromp",
  text: "[Hunt 3] (When I conquer or hold, gain 3 XP.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Galio, Indefatigable",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Tank] (I must be assigned combat damage first.)\nI don't deal combat damage.",
  status: "implemented",
  abilities: [],
});
