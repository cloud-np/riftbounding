/**
 * Confront (OGN-129) — "Units you play this turn enter ready. Draw 1."
 * A delayed passive (391.4) carrying the enter-ready replacement (369.3, EX[134]) for units its
 * controller plays this turn.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Confront",
  text: "[Action] (Play on your turn or in showdowns.)\n\nUnits you play this turn enter ready.\nDraw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "continuous",
            duration: "this-turn",
            modifier: { kind: "enter-ready", target: { cardType: "unit" } },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
