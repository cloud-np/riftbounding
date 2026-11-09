/** Against the Odds. */
import { registerCardScript } from "../sdk";
import { countOf, ENEMY_UNIT, target } from "./custom";

registerCardScript({
  name: "Against the Odds",
  text: "[REACTION] (Play at any time, even before spells and abilities resolve.)\nGive a friendly unit at a battlefield +2 [Might] this turn for each enemy unit there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: countOf({ ...ENEMY_UNIT, sameLocationAs: "target:0" }, 2),
        target: target({ controller: "self", zone: "battlefield", targetRef: "target:0" }),
      },
    },
  ],
});
