/** Bandle Soldier. */
import { atLevel, registerCardScript } from "../sdk";
import { enterReady } from "./custom";

registerCardScript({
  name: "Bandle Soldier",
  text: "[Level 3] I enter ready. (While you have 3+ XP, get the effect.)",
  status: "implemented",
  abilities: [atLevel(3, enterReady)],
});
