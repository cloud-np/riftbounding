/** Moonlight Affliction. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Moonlight Affliction",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -10 [might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: -10, target: aUnit() } }],
});
