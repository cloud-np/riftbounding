/** The Syren (OGN-184, Origins errata) — "[1], [TAP]: Move a friendly unit at a battlefield to its base." (376, 421) */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "The Syren",
  text: "[1], [TAP]: Move a friendly unit at a battlefield to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "move",
        target: aUnit({ controller: "self", zone: "battlefield" }),
        to: "base",
      },
    },
  ],
});
