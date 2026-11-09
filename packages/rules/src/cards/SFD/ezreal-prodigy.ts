/** Ezreal, Prodigy. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Ezreal, Prodigy",
  text: "When you play me, discard 1, then draw 2.\nOptional additional costs you pay cost [1] or [Rune] less.",
  status: "partial",
  notes:
    '"Optional additional costs you pay cost [1] or [Rune] less": component discounts on optional additional costs (356.4.c, EX on 356.4.c) are not expressible through `costAdjustments`.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
