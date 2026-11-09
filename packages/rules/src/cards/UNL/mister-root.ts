/** Mister Root. */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";
import { MOVED_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Mister Root",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nWhen I move to a battlefield, gain 2 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: MOVED_TO_BATTLEFIELD,
      effect: { op: "gain_xp", amount: 2 },
    },
  ],
});
