/** Dangerous Duo (OGN-016) — "[LEGION] - When you play me, give a unit +2 [Might] this turn." (812.1.c) */
import { LEGION } from "./darius-executioner";
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Dangerous Duo",
  text: "[LEGION] - When you play me, give a unit +2 [Might] this turn. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: LEGION,
      keywords: ["Legion"],
      effect: { op: "temporary_might", amount: 2, target: aUnit() },
    },
  ],
});
