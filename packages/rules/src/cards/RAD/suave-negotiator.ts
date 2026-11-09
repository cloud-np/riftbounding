/** Suave Negotiator (RAD-099) — "When you play me, choose an opponent. You and that player each draw 1." */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Suave Negotiator",
  text: "When you play me, choose an opponent. You and that player each draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "draw", amount: 1, player: { kind: "chosen", ref: "opponent" } },
        ],
      },
    },
  ],
});
