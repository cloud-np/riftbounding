/** Evershade Stalker (UNL-123) — Play Effect: discard 1 (423), then draw 1 (414). */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Evershade Stalker",
  text: "When you play me, discard 1, then draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
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
