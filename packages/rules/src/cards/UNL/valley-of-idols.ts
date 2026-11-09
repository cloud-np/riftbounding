/** Valley of Idols. */
import { EVENT_SUBJECT, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Valley of Idols",
  text: "When a player plays a unit here, they may pay [1] to [buff] it. (Give it a +1 [might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", zone: HERE } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "buff", target: EVENT_SUBJECT },
      },
    },
  ],
});
