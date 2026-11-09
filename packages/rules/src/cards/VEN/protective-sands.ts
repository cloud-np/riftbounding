/** Protective Sands. */
import { registerCardScript, runesControlled, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Protective Sands",
  text: "When you conquer here, if you control 4 or fewer runes, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      condition: runesControlled("lte", 4),
      // 740.4.a.2: a leading cost within instructions, paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});
