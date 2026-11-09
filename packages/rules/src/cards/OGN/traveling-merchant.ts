/** Traveling Merchant (OGN-185) — "When I move, discard 1, then draw 1." (421/447, 423, 414) */
import { registerCardScript } from "../registry";
import { WHEN_I_MOVE } from "../dsl";

registerCardScript({
  name: "Traveling Merchant",
  text: "When I move, discard 1, then draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
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
