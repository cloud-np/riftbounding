/** Eclipse Dragon. */
import { registerCardScript, runesControlled, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Eclipse Dragon",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nWhen I move, if you control 4 or fewer runes, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: runesControlled("lte", 4),
      effect: { op: "draw", amount: 1 },
    },
  ],
});
