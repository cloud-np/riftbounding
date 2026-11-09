/** Pit Rookie (OGN-136) — "When you play me, buff another friendly unit." (427; target chosen on finalization, 403.2) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Pit Rookie",
  text: "When you play me, buff another friendly unit. (If it doesn't have a buff, it gets +1 [might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "buff", target: aUnit({ controller: "self", excludeSource: true }) },
    },
  ],
});
