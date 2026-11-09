/** Smoke Screen (OGN-093) — "[Reaction] Give a unit -4 [Might] this turn, to a minimum of 1 [Might]." (479.4.b snapshot) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Smoke Screen",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -4 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "give_might", amount: -4, min: 1, target: aUnit() } }],
});
