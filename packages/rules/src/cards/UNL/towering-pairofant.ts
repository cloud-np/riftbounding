/** Towering Pairofant. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Towering Pairofant",
  text: "[Assault] (+1[Might] while I'm an attacker.)\nIf a unit died this turn, I enter ready.",
  status: "manual",
  notes:
    "[Assault] is a printed keyword. 'If a unit died this turn, I enter ready' needs per-turn death history (383.1.b, 429), which is not tracked.",
  abilities: [],
});
