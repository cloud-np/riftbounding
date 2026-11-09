/** Frostcoat Cub. */
import { PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Frostcoat Cub",
  text: "You may pay [Mind] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, give a unit -2  this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "temporary_might", amount: -2, target: target() },
    },
  ],
});
