/**
 * Monastery of Hirana (OGN-282, battlefield) — "When you conquer here, you may spend a buff to draw 1."
 *
 * "Spend a buff to draw 1" is a cost within the instruction (740.4.a). The "you may" is decided
 * when the trigger finalizes (403.1); the buff (702.2.b: a friendly unit's, chosen when spent,
 * 742.1) is spent on resolution and only then is the card drawn. 740.4.a.2 would have the leading
 * cost paid on finalization, but `Cost` has no "spend a buff" component.
 */
import { registerCardScript } from "../registry";
import { WHEN_YOU_CONQUER_HERE, custom } from "../dsl";

registerCardScript({
  name: "Monastery of Hirana",
  text: "When you conquer here, you may spend a buff to draw 1.",
  status: "partial",
  notes:
    "The spend-a-buff cost is paid on resolution instead of when the trigger finalizes (740.4.a.2): Cost has no spend-buff component.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "spent",
            selector: { cardType: "unit", controller: "self", buffed: true },
            min: 1,
            max: 1,
          },
          { op: "spend_buff", target: { targetRef: "spent" } },
          { op: "if", condition: { kind: "did" }, then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
