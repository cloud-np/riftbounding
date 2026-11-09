/**
 * Poro Herder (OGN-061) — "When you play me, if you control a Poro, buff me and draw 1."
 *
 * 383.2.a.1: the "if" right after the trigger condition is part of the trigger condition.
 */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Poro Herder",
  text: "When you play me, if you control a Poro, buff me and draw 1. (if I don't have a buff, I get a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", tag: "Poro" },
      },
      effect: {
        op: "seq",
        effects: [
          { op: "buff", target: SELF },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
