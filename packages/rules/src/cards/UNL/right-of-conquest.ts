/**
 * Right of Conquest (UNL-015) — "Draw 1, then draw 1 for each battlefield you or allies control."
 * Battlefield control is the stored control state (190.2); allies are teammates (491).
 */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Right of Conquest",
  text: "Draw 1, then draw 1 for each battlefield you or allies control",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          {
            op: "draw",
            amount: {
              kind: "count",
              selector: {
                cardType: "battlefield",
                where: custom("unl:battlefield-controlled-by-team"),
              },
            },
          },
        ],
      },
    },
  ],
});
