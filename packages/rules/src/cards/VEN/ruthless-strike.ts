/**
 * Ruthless Strike (VEN-008) — "[Action] As an additional cost to play this, you may discard 1.
 * Deal 3 to a unit at a battlefield. If you paid the additional cost, deal 5 to it instead."
 *
 * The optional additional cost (204.2, 355.1.a) is parsed from the text and paid by R2-play
 * (`optional:0`); 356.4.f.1: "if you paid" reads the spell's own chosen cost.
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

const TARGET = aUnit({ zone: "battlefield", targetRef: "target:0" });

registerCardScript({
  name: "Ruthless Strike",
  text: "[Action] (Play on your turn or in showdowns.)\nAs an additional cost to play this, you may discard 1.\nDeal 3 to a unit at a battlefield. If you paid the additional cost, deal 5 to it instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: custom("ven:paid-optional-cost"),
        then: { op: "deal", amount: 5, target: TARGET },
        else: { op: "deal", amount: 3, target: TARGET },
      },
    },
  ],
});
