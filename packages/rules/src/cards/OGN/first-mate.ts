/** First Mate (OGN-132) — "When you play me, ready another unit." (416) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "First Mate",
  text: "When you play me, ready another unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: aUnit({ excludeSource: true }) },
    },
  ],
});
