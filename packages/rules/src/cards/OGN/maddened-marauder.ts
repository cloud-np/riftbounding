/** Maddened Marauder (OGN-191) — [Tank] (printed); "When you play me, move a unit from a battlefield to its base." (421.2) */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, aUnit } from "../dsl";

registerCardScript({
  name: "Maddened Marauder",
  text: "[TANK] (I must be assigned combat damage first.)\nWhen you play me, move a unit from a battlefield to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "move", target: aUnit({ zone: "battlefield" }), to: "base" },
    },
  ],
});
