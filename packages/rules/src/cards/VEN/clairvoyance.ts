/** Clairvoyance (VEN-056) — "[Reaction] [Predict 5]. Draw 2." (437 Predict, 414 draw) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Clairvoyance",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Predict 5]. (Look at the top 5 cards of your Main Deck. Recycle any of them and put the rest back in any order.)\nDraw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "predict", amount: 5 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
