/** Final Spark (OGS-022) — "[ACTION] Deal 8 to a unit." (418) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Final Spark",
  text: "[ACTION] (Play on your turn or in showdowns.)\nDeal 8 to a unit.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 8, target: aUnit() } }],
});
