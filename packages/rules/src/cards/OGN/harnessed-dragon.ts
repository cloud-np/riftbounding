/** Harnessed Dragon (OGN-234) — "When you play me, kill an enemy unit." (429, 740.1 enemy) */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, aUnit } from "../dsl";

registerCardScript({
  name: "Harnessed Dragon",
  text: "When you play me, kill an enemy unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "kill", target: aUnit({ controller: "opponent" }) },
    },
  ],
});
