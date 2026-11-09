/** Challenge (OGN-128 — EX[195]/EX[196] (418.6.b.3/.4): the chosen units are the damage sources.) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Challenge",
  text: "[ACTION] (Play on your turn or in showdowns.)\nChoose a friendly unit and an enemy unit. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: aUnit({ controller: "self", targetRef: "target:0" }) },
            target: aUnit({ controller: "opponent", targetRef: "target:1" }),
            source: { targetRef: "target:0" },
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
