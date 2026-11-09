/** Zaun Warrens (OGN-298, battlefield) — "When you conquer here, discard 1, then draw 1." (383.4.c.2.b, 423, 414) */
import { registerCardScript } from "../registry";
import { WHEN_YOU_CONQUER_HERE } from "../dsl";

registerCardScript({
  name: "Zaun Warrens",
  text: "When you conquer here, discard 1, then draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
