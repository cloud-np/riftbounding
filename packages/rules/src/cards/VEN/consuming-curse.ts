/**
 * Consuming Curse (VEN-010) — "[Action] Deal 2 to a unit at a battlefield. This deals 1 Bonus
 * Damage for each card with this name in your trash."
 *
 * 712–715: Bonus Damage increases each instance of damage the spell deals; this spell deals one
 * instance, so it deals 2 + N (N counted on resolution, when this card is still on the chain).
 */
import { aUnit, registerCardScript } from "../sdk";

const CARD_NAME = "Consuming Curse";

registerCardScript({
  name: "Consuming Curse",
  text: "[Action] (Play on your turn or in showdowns.)\nDeal 2 to a unit at a battlefield. This deals 1 Bonus Damage for each card with this name in your trash.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "deal",
        amount: {
          kind: "sum",
          amounts: [
            2,
            { kind: "count", selector: { zone: "trash", owner: "self", name: CARD_NAME } },
          ],
        },
        target: aUnit({ zone: "battlefield" }),
      },
    },
  ],
});
