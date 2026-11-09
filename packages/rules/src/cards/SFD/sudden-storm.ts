/** Sudden Storm. */
import { custom, registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Sudden Storm",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nDeal 2 to a unit at a battlefield. If it's attacking, deal 4 to it instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: custom("core:attacking", { ref: "target:0" }),
        then: {
          op: "deal",
          amount: 4,
          target: target({ zone: "battlefield", targetRef: "target:0" }),
        },
        else: {
          op: "deal",
          amount: 2,
          target: target({ zone: "battlefield", targetRef: "target:0" }),
        },
      },
    },
  ],
});
