/** Bandle Soldier. */
import { atLevel, ENTER_READY_MODIFIER, registerCardScript } from "../sdk";

registerCardScript({
  name: "Bandle Soldier",
  text: "[Level 3] I enter ready. (While you have 3+ XP, get the effect.)",
  status: "implemented",
  abilities: [atLevel(3, ENTER_READY_MODIFIER)],
});
