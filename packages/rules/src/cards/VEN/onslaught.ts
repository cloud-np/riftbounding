/** Onslaught. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Onslaught",
  text: "Give a unit +6 [Might] this turn.\n[Flow][4] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 6, target: aUnit() } }],
});
