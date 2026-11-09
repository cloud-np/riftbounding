/** Bilgewater Tracker (RAD-003) — "When you play me, deal 1 to each of up to 2 units." (355.13, 418) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Bilgewater Tracker",
  text: "When you play me, deal 1 to each of up to 2 units.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "deal", amount: 1, target: aUnit({ maxCount: 2 }) },
    },
  ],
});
