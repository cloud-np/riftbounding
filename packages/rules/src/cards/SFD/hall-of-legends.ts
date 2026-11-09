/** Hall of Legends. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Hall of Legends",
  text: "When you conquer here, you may pay [1] to ready your legend.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "ready", target: { cardType: "legend", controller: "self" } },
      },
    },
  ],
});
