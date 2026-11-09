/**
 * Raging Firebrand (OGN-031) — "When you play me, the next spell you play this turn costs [5] less."
 *
 * A one-shot cost reduction (420.5 / 356.4) for spells, reported by `costAdjustments` as a
 * `cost-adjust` with `once`. Partial: R2-effects uses up every "next card" reduction on the next
 * `card_played` of that player whatever its type, so playing a unit or gear first wastes it.
 */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Raging Firebrand",
  text: "When you play me, the next spell you play this turn costs [5] less.",
  status: "partial",
  notes:
    "The one-shot discount is used up by the next card of any type (consumeOnceCostEffects is not filtered by the target, 420.5).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "continuous",
        duration: "this-turn",
        modifier: {
          kind: "cost-adjust",
          energy: -5,
          once: true,
          target: { cardType: "spell", controller: "self" },
        },
      },
    },
  ],
});
