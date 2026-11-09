/**
 * Mesmerize (VEN-052) — "[Reaction] Choose one — • Return a friendly unit to its owner's hand.
 * • Give an enemy unit -2 [Might] this turn." (355.3 modes)
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Mesmerize",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nChoose one -\n· Return a friendly unit to its owner's hand.\n· Give an enemy unit -2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "return",
            label: "Return a friendly unit to its owner's hand.",
            effect: { op: "return_to_hand", target: aUnit({ controller: "self" }) },
          },
          {
            id: "might",
            label: "Give an enemy unit -2 Might this turn.",
            effect: {
              op: "temporary_might",
              amount: -2,
              target: aUnit({ controller: "opponent" }),
            },
          },
        ],
      },
    },
  ],
});
