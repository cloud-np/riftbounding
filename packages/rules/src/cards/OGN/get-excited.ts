/**
 * Get Excited! (OGN-008) — "Discard 1. Deal its Energy cost as damage to a unit at a battlefield."
 *
 * 423.1.a: the player chooses the card; the damage amount is the discarded card's printed Energy
 * cost (Power ignored). The unit is a target chosen on play (355.7, validated on resolution by
 * `for_each`); the amount is computed on resolution and dealt through the real `deal` op.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Get Excited!",
  text: "[ACTION] (Play on your turn or in showdowns.)\nDiscard 1. Deal its Energy cost as damage to a unit at a battlefield. (Ignore its Power cost.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "custom", id: "ogn:remember-affected", params: { key: "discarded" } },
          {
            op: "for_each",
            selector: aUnit({ zone: "battlefield" }),
            effect: {
              op: "custom",
              id: "ogn:deal-energy-cost-of",
              params: { ref: "discarded" },
            },
          },
        ],
      },
    },
  ],
});
