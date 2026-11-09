/** Targonian Visionary. */
import { atLevel, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Targonian Visionary",
  text: "[Level 11] I have +4[Might]. (While you have 11+ XP, get this effect.)",
  status: "implemented",
  abilities: [atLevel(11, { kind: "might", amount: 4, target: SELF })],
});
