/** Abandon. */
import { registerCardScript } from "../sdk";
import { A_SPELL } from "./custom";

registerCardScript({
  name: "Abandon",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell. Return it to its owner's hand instead of putting it in their trash.\n[Predict] . (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: { ...A_SPELL },
            effect: { op: "custom", id: "unl:counter-to-hand" },
          },
          { op: "predict", amount: 1 },
        ],
      },
    },
  ],
});
