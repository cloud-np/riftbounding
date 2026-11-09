/** Evelynn in Control (RAD-SP3) — "[Disarm] When I hold, if you control a facedown card here, score 1 point." (470.2) */
import { registerCardScript } from "../sdk";
import { EVELYNN_HOLD } from "./custom";

registerCardScript({
  name: "Evelynn in Control",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [Might] this turn.)\nWhen I hold, if you control a facedown card here, score 1 point.",
  status: "implemented",
  abilities: [EVELYNN_HOLD],
});
