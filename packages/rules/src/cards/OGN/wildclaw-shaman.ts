/**
 * Wildclaw Shaman (OGN-147) — "When you play me, you may spend a buff to buff me and ready me."
 *
 * 383.3.a / 403.1: the leading "you may" is decided when the trigger finalizes. "Spend a buff to
 * …" is a cost within the instruction (740.4.a / 355.10.c.1): the buff (any friendly unit's,
 * 702.2.b.2) is picked on resolution without targeting (355.18); without a buff to spend
 * (702.2.b.1) nothing else happens.
 */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Wildclaw Shaman",
  text: "When you play me, you may spend a buff to buff me and ready me. (If I don't have a buff, I get a +1 [Might] buff.)",
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
            key: "spent",
            selector: { cardType: "unit", controller: "self", buffed: true },
            min: 1,
            max: 1,
          },
          { op: "spend_buff", target: { targetRef: "spent" } },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "seq",
              effects: [
                { op: "buff", target: SELF },
                { op: "ready", target: SELF },
              ],
            },
          },
        ],
      },
    },
  ],
});
