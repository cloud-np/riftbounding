/** Seat of Power. */
import { custom, registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";
import { countOf } from "./custom";

registerCardScript({
  name: "Seat of Power",
  text: "When you conquer here, draw 1 for each other battlefield you or allies control.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "draw",
        amount: countOf({
          cardType: "battlefield",
          excludeSource: true,
          where: custom("sfd:it-battlefield-friendly"),
        }),
      },
    },
  ],
});
