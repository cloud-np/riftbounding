/** Fresh Beans. */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Fresh Beans",
  text: "When you play a unit during a showdown, you may exhaust this to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "unit_played", player: "self", condition: custom("unl:in-showdown") },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});
