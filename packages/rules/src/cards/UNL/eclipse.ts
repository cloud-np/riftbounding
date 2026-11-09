/** Eclipse (UNL-063 — EX[258] (479.4.c), EX[287] (758.2)) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Eclipse",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -4 [Might] this turn.\n[Predict]. (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "seq", effects: [{ op: "temporary_might", amount: -4, target: aUnit() }, { op: "predict", amount: 1 }] },
    },
  ],
});
