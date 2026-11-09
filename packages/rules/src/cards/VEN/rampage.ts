/**
 * Rampage (VEN-083) — "As you play this, you may pay [Body] as an additional cost. Choose a
 * friendly unit and an enemy unit. If you paid the additional cost, give the friendly unit +2
 * [Might] this turn. They deal damage equal to their Mights to each other."
 *
 * 355.1.a optional additional cost (R2-play, `optional:0`); 418.6.b.3/.4 each unit is the source
 * of the damage it deals.
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Rampage",
  text: "As you play this, you may pay [Body] as an additional cost.\nChoose a friendly unit and an enemy unit. If you paid the additional cost, give the friendly unit +2 [Might] this turn. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: custom("ven:paid-optional-cost"),
            then: {
              op: "temporary_might",
              amount: 2,
              target: aUnit({ controller: "self", targetRef: "target:0" }),
            },
          },
          {
            op: "deal",
            amount: {
              kind: "might",
              selector: aUnit({ controller: "self", targetRef: "target:0" }),
            },
            target: aUnit({ controller: "opponent", targetRef: "target:1" }),
            source: { targetRef: "target:0" },
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
        ],
      },
    },
  ],
});
