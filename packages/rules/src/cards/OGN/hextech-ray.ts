/** Hextech Ray (OGN-009 — EX[192] (418.1.e.1), EX[273] (715.4.a)) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Hextech Ray",
  text: "[ACTION] (Play on your turn or in showdowns.)\nDeal 3 damage to a unit at a battlefield.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 3, target: aUnit({ zone: "battlefield" }) } }],
});
