/**
 * Riven, The Exile (RAD-149, legend) — "Units you play to battlefields you control enter ready."
 *
 * A replacement on entering (369.3 / EX[134]): the unit enters ready instead of exhausted; it
 * does not become ready afterwards (no ready event, cf. 805.6.a).
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Riven, The Exile",
  text: "Units you play to battlefields you control enter ready.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "custom", id: "enter-ready", params: { battlefieldYouControl: true, target: { cardType: "unit" } } },
    },
  ],
});
