/**
 * Herald of Scales (OGN-140) — "Your Dragons' Energy costs are reduced by [2], to a minimum of [1]."
 *
 * 356.4.c: a discount with a minimum. `CostAdjustment` has no per-discount minimum, so the
 * minimum is applied against the Dragon's printed Energy cost: -2 for printed costs of 3 or more,
 * -1 for a printed cost of 2, none for 1 or less.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Herald of Scales",
  text: "Your Dragons' Energy costs are reduced by [2], to a minimum of [1].",
  status: "partial",
  notes:
    'The "minimum of [1]" is checked against the printed Energy cost, not the running total after other cost changes (356.4.c: CostAdjustment has no per-discount minimum).',
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "cost",
        amount: -2,
        target: { tag: "Dragon", controller: "self", energyCost: { op: "gte", value: 3 } },
      },
    },
    {
      kind: "passive",
      modifier: {
        kind: "cost",
        amount: -1,
        target: { tag: "Dragon", controller: "self", energyCost: { op: "eq", value: 2 } },
      },
    },
  ],
});
