/**
 * Soulgorger (OGN-196) — "When you play me, you may play a unit from your trash, ignoring its Energy
 * cost."
 *
 * 403.1: the leading "you may" is decided when the trigger finalizes. The unit is picked on
 * resolution (355.18); its Power cost is still paid (`ogn-oz:pay-printed-cost`, see The Harrowing),
 * then it is played (420.3).
 */
import { playPickedUnit } from "./the-harrowing";
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Soulgorger",
  text: "When you play me, you may play a unit from your trash, ignoring its Energy cost.",
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
            key: "gorged",
            selector: { cardType: "unit", zone: "trash", owner: "self" },
            min: 1,
            max: 1,
          },
          playPickedUnit("gorged", { ignoreEnergy: true }),
        ],
      },
    },
  ],
});
