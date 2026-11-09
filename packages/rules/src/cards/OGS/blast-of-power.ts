/** Blast of Power (OGS-012) — "[ACTION] Kill a unit at a battlefield." (429) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Blast of Power",
  text: "[ACTION] (Play on your turn or in showdowns.)\nKill a unit at a battlefield.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: aUnit({ zone: "battlefield" }) } }],
});
