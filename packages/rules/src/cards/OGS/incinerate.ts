/** Incinerate (OGS-003) — "[ACTION] Deal 2 to a unit at a battlefield." (418) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Incinerate",
  text: "[ACTION] (play on your turn or in showdowns.) \nDeal 2 to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "deal", amount: 2, target: aUnit({ zone: "battlefield" }) } },
  ],
});
