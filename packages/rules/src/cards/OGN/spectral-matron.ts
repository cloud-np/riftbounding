/**
 * Spectral Matron (OGN-226) — "When you play me, you may play a unit costing no more than [3] and no
 * more than [RUNE] from your trash, ignoring its cost."
 *
 * 403.1: the leading "you may" is decided when the trigger finalizes. The unit (printed cost ≤ [3]
 * Energy and ≤ 1 Power) is picked on resolution (355.18) and played ignoring its cost (420.3).
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Spectral Matron",
  text: "When you play me, you may play a unit costing no more than [3] and no more than [RUNE] from your trash, ignoring its cost.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "raised",
            selector: {
              cardType: "unit",
              zone: "trash",
              owner: "self",
              energyCost: { op: "lte", value: 3 },
              powerCost: { op: "lte", value: 1 },
            },
            min: 1,
            max: 1,
          },
          { op: "play", target: { targetRef: "raised" }, cost: "ignored" },
        ],
      },
    },
  ],
});
