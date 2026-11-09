/** War Scout (RAD-008) — "[Accelerate] When you play me, give a unit +2 [Might] this turn." */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "War Scout",
  text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\nWhen you play me, give a unit +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 2, target: aUnit() },
    },
  ],
});
