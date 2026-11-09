/**
 * Shimmering Swimmer (RAD-014) — "You may kill a friendly unit or gear as an additional cost to
 * play me. When you play me, if you paid the additional cost, deal 2 to a unit." (204.2, 356.2.b,
 * 383.2.a.1) The printed phrase "kill a friendly unit or gear" is registered as the card's optional
 * additional cost (a cost selector without a card type matches units and gear at locations).
 */
import { aUnit, PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Shimmering Swimmer",
  text: "You may kill a friendly unit or gear as an additional cost to play me.\nWhen you play me, if you paid the additional cost, deal 2 to a unit.",
  status: "implemented",
  additionalCosts: [
    {
      id: "optional:0",
      optional: true,
      cost: { kill: { controller: "self" } },
      rule: "356.2.b.1",
      label: "Kill a friendly unit or gear",
    },
  ],
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "deal", amount: 2, target: aUnit() },
    },
  ],
});
