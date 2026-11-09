/** Show of Strength. */
import { registerCardScript } from "../sdk";
import { countOf } from "./custom";

registerCardScript({
  name: "Show of Strength",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nDraw 1 for each of your [Mighty] units. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "draw",
        amount: countOf({ cardType: "unit", controller: "self", mighty: true }),
      },
    },
  ],
});
