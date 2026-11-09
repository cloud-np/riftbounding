/**
 * Tasty Faefolk (OGN-075) — "[Accelerate] [Deathknell] - Channel 2 runes exhausted and draw 1."
 * (805 Accelerate is the play layer's; 808 Deathknell, 431.2.a, 414)
 */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Tasty Faefolk",
  text: "[Accelerate] (You may pay [1] [Calm] as an additional cost to have me enter ready.)\n[Deathknell] - Channel 2 runes exhausted and draw 1. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "seq",
        effects: [
          { op: "channel", amount: 2, exhausted: true },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
