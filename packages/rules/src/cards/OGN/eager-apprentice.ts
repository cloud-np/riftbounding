/**
 * Eager Apprentice (OGN-084) — "While I'm at a battlefield, the Energy costs for spells you play is
 * reduced by [1], to a minimum of [1]." (364.3.a conditional passive; 356.4.c minimum)
 *
 * `CostAdjustment` has no per-discount minimum, so the minimum is applied against the spell's
 * printed Energy cost (no discount for printed costs of 1 or less).
 */
import { registerCardScript, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Eager Apprentice",
  text: "While I'm at a battlefield, the Energy costs for spells you play is reduced by [1], to a minimum of [1].",
  status: "partial",
  notes:
    'The "minimum of [1]" is checked against the printed Energy cost, not the running total after other cost changes (356.4.c: CostAdjustment has no per-discount minimum).',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: SELF_AT_BATTLEFIELD, modifier: {
            kind: "cost",
            amount: -1,
            cardType: "spell",
            target: { controller: "self", energyCost: { op: "gte", value: 2 } },
          } },
    },
  ],
});
