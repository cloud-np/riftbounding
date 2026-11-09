/** Gemhand Hunter. */
import { atLevel, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Gemhand Hunter",
  text: "[Hunt] (When i conquer or hold, gain 1 XP.)\n[Level 6] I have +1 [might] . (While you have 6+ XP, get the effect.)",
  status: "implemented",
  abilities: [atLevel(6, { kind: "might", amount: 1, target: SELF })],
});
