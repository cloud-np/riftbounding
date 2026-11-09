/** Kinkou Monk (OGN-141, Origins errata) — "When you play me, buff up to two other friendly units." (355.13; 427) */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, aUnit } from "../dsl";

registerCardScript({
  name: "Kinkou Monk",
  text: "When you play me, buff up to two other friendly units.\n(Each one that doesn't have a buff gets a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "buff",
        target: aUnit({ controller: "self", excludeSource: true, maxCount: 2 }),
      },
    },
  ],
});
