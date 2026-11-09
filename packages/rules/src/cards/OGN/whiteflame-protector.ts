/** Whiteflame Protector (OGN-082) — "When you play me, give a unit +8 [Might] this turn." */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Whiteflame Protector",
  text: "When you play me, give a unit +8 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 8, target: aUnit() },
    },
  ],
});
