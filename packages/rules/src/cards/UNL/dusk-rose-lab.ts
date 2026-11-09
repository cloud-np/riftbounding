/** Dusk Rose Lab. */
import { aUnit, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Dusk Rose Lab",
  text: "At the start of you Beginning Phase, you may kill a unit you control here to draw 1. (This happens before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      optional: true,
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: aUnit({ controller: "self", zone: HERE }) },
          { op: "if", condition: { kind: "did" }, then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
