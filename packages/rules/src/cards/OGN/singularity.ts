/** Singularity (OGN-105 — EX[105] (359.3.e.8), EX[270] (715.2)) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Singularity",
  text: "Deal 6 to each of up to two units.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 6, target: aUnit({ maxCount: 2 }) } }],
});
