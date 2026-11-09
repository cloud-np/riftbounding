/** Blast Corps Cadet. */
import { PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Blast Corps Cadet",
  text: "You may pay [1][Fury] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, deal 2 to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "deal", amount: 2, target: target({ zone: "battlefield" }) },
    },
  ],
});
