/** Evelynn, in Control (RAD-109) — same text as RAD-SP3. */
import { registerCardScript } from "../sdk";
import { EVELYNN_HOLD } from "./custom";

registerCardScript({
  name: "Evelynn, in Control",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [might] this turn.)\nWhen I hold, if you control a facedown card here, score 1 point.",
  status: "implemented",
  abilities: [EVELYNN_HOLD],
});
