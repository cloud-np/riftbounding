/** Renata Glasc, Chem-Baroness. */
import { custom, notIntrinsic, registerCardScript, SELF } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Renata Glasc, Chem-Baroness",
  text: "When you or an ally hold, you may exhaust me to play a Gold gear token exhausted.\nWhile your score is within 3 points of the Victory Score, your Gold [ADD] an additional [1].",
  status: "partial",
  notes:
    '"Your Gold [Add] an additional [1]": modifying the resources a token\'s Add ability produces (430.2) is not supported.',
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "hold", condition: custom("sfd:event-player-friendly") },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
  ],
});
