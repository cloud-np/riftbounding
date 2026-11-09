/**
 * Thousand-Tailed Watcher (OGN-116) — "[Accelerate] When you play me, give enemy units -3 [Might]
 * this turn, to a minimum of 1 [Might]." (805 Accelerate is the play layer's; 479.4.b snapshot per
 * unit; every enemy unit on the board, 355.5.a)
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Thousand-Tailed Watcher",
  text: "[Accelerate] (You may pay [1] [Mind] as an additional cost to have me enter ready.)\nWhen you play me, give enemy units -3 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "give_might",
        amount: -3,
        min: 1,
        target: { cardType: "unit", controller: "opponent" },
      },
    },
  ],
});
