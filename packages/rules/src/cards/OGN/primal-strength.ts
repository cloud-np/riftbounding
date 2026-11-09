/** Primal Strength (OGN-154) — "[Action] Give a unit +7 [Might] this turn." (479.4, 806) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Primal Strength",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit +7 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 7, target: aUnit() } }],
});
