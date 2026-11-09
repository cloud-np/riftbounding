/** Falling Comet (OGN-085) — "Deal 6 to a unit at a battlefield." (418) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Falling Comet",
  text: "[Action] (play on your turn or in showdowns.)\n\nDeal 6 to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "deal", amount: 6, target: aUnit({ zone: "battlefield" }) } },
  ],
});
