/** Piercing Light. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Piercing Light",
  text: "[Repeat][2][Fury]  (You may pay the additional cost to repeat this spell's effect.)\nDeal 2 to a unit at a battlefield, then deal 2 to up to one other unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 2, target: target({ zone: "battlefield", targetRef: "target:0" }) },
          {
            op: "deal",
            amount: 2,
            target: target({ maxCount: 1, targetRef: "target:1", excludeRefs: ["target:0"] }),
          },
        ],
      },
    },
  ],
});
