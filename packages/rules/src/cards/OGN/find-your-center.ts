/**
 * Find Your Center (OGN-047) — "If an opponent's score is within 3 points of the Victory Score,
 * this costs [2] less. Draw 1 and channel 1 rune exhausted."
 * 366.2.a: the card's own cost passive applies while it is in hand; 431.2.a exhausted.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { OPPONENT_WITHIN_3 } from "./leona-zealot";

registerCardScript({
  name: "Find Your Center",
  text: "[ACTION] (Play on your turn or in showdowns.)\nIf an opponent's score is within 3 points of the Victory Score, this costs [2] less.\nDraw 1 and channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: OPPONENT_WITHIN_3, modifier: { kind: "cost", amount: -2, target: SELF } },
    },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
  ],
});
