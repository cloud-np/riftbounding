/** Scorchclaw. */
import { atLevel, registerCardScript, SELF } from "../sdk";
import { enterReady } from "./custom";

registerCardScript({
  name: "Scorchclaw",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 3] I have +1 [Might] and enter ready. (While you have 3+ XP, get the effect.)",
  status: "implemented",
  // "Enter ready" is a replacement on entering (369.3) checked as I am played.
  abilities: [atLevel(3, { kind: "might", amount: 1, target: SELF }), atLevel(3, enterReady)],
});
