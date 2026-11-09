/**
 * Peak Guardian (OGN-223) — "When you play me, buff me. Then, if I am at a battlefield, buff all
 * other friendly units there." (427/702; the "if" is checked on execution, 359.3.f.2)
 */
import { HERE, registerCardScript, SELF, SELF_AT_BATTLEFIELD, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Peak Guardian",
  text: "When you play me, buff me. Then, if I am at a battlefield, buff all other friendly units there. (To buff a unit give it a +1 [might] if it doesn't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "buff", target: SELF },
          {
            op: "if",
            condition: SELF_AT_BATTLEFIELD,
            then: {
              op: "buff",
              target: { cardType: "unit", controller: "self", zone: HERE, excludeSource: true },
            },
          },
        ],
      },
    },
  ],
});
