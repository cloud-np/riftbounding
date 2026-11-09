/** Field Musicians. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Field Musicians",
  text: "When you play me, give a unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit() },
    },
  ],
});
