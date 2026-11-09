/**
 * Void Gate (OGN-296, battlefield, Origins errata) — "Spells and abilities deal 1 Bonus Damage to
 * units here."
 *
 * Manual: `bonus-damage` modifiers only apply to deal actions of their own controller (a battlefield
 * passive's controller is the player present there) and cannot depend on the damaged unit's
 * location; this one applies to every player's spells and abilities, per target (715.2).
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Void Gate",
  text: "Spells and abilities deal 1 Bonus Damage to units here. (Each instance of damage the spell deals to a unit here is increased by 1.)",
  status: "manual",
  notes:
    "Target-dependent Bonus Damage for every player's spells and abilities (712–715) is not supported: bonus-damage applies per controller, not per damaged unit.",
  abilities: [],
});
