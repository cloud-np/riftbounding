/** Vengeance (OGN-229) — "Kill a unit." (429) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Vengeance",
  text: "Kill a unit.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: aUnit() } }],
});
