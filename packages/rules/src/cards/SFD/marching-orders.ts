/** Marching Orders. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Marching Orders",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][3] (You may pay the additional cost to repeat this spell's effect.)\nChoose a friendly unit anywhere and an enemy unit at a battlefield. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: target({ controller: "opponent", zone: "battlefield", targetRef: "target:1" }),
            source: target({ controller: "self", targetRef: "target:0" }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
        ],
      },
    },
  ],
});
