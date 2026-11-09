/** Wages of Pain. */
import { registerCardScript } from "../sdk";
import { gold, target } from "./custom";

registerCardScript({
  name: "Wages of Pain",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nDeal 3 to a unit at a battlefield. Play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [{ op: "deal", amount: 3, target: target({ zone: "battlefield" }) }, gold()],
      },
    },
  ],
});
