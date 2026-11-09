/** Power Nexus. */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Power Nexus",
  text: "When you hold here, you may pay [Rune][Rune][Rune][Rune] to score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { any: 4 } },
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});
