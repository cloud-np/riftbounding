/** Yone, Blademaster. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Yone, Blademaster",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen I conquer a battlefield that was uncontrolled, deal damage equal to my Might to an enemy unit in a base.",
  status: "partial",
  notes:
    '"When I conquer a battlefield that was uncontrolled, deal damage equal to my Might to an enemy unit in a base": the conquer event does not record whether the battlefield was uncontrolled (468.5, 471). Weaponmaster is the engine\'s.',
  abilities: [],
});
