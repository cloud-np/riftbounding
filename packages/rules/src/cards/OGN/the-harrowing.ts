/**
 * The Harrowing (OGN-198) — "Play a unit from your trash, ignoring its Energy cost. (You must still
 * pay its Power cost.)"
 *
 * The unit is picked on resolution (355.18). Registers `ogn:pay-printed-cost`: the controller
 * pays the referenced card's printed cost through R2-play's `payCost` (357), with
 * `ignoreEnergy` / `energyReduction` applied to the Energy part; its Power is paid as [C] of the
 * card's Domains (135.2.e.6, RULES-QUESTION 131.3.a). `$did` records whether it was paid. A
 * paid unit is then played ignoring its cost (420.3); an unpaid one stays where it is (358.5).
 */
import { registerCardScript } from "../sdk";
import { playPickedUnit } from "./custom";

registerCardScript({
  name: "The Harrowing",
  text: "Play a unit from your trash, ignoring its Energy cost. (You must still pay its Power cost.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "harrowed",
            selector: { cardType: "unit", zone: "trash", owner: "self" },
            min: 1,
            max: 1,
          },
          playPickedUnit("harrowed", { ignoreEnergy: true }),
        ],
      },
    },
  ],
});
