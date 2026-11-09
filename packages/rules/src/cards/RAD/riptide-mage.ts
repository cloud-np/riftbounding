/** Riptide Mage (RAD-058) — "[Accelerate] When you play me, give an enemy unit -3 [Might] this turn." */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Riptide Mage",
  text: "[Accelerate] (You may pay [1] [Mind] as an additional cost to have me enter ready.)\nWhen you play me, give an enemy unit -3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: -3, target: aUnit({ controller: "opponent" }) },
    },
  ],
});
