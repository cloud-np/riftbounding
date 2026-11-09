/** Zaunite Bouncer (OGN-188) — "When you play me, return another unit at a battlefield to its owner's hand." (056, 403.2) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Zaunite Bouncer",
  text: "When you play me, return another unit at a battlefield to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "return_to_hand", target: aUnit({ zone: "battlefield", excludeSource: true }) },
    },
  ],
});
