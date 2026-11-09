/** Sunken Temple. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Sunken Temple",
  text: "When you conquer here with one or more [Mighty] units, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE, mighty: true },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});
