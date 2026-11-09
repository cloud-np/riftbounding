/** Otterpus. */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Otterpus",
  text: "If a player would score 1 point from conquering or holding during their first and second turn, they draw 1 instead.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: {
        type: "score",
        condition: custom("ven:first-or-second-turn"),
        data: { kind: "conquer" },
      },
      replace: { op: "custom", id: "ven:draw-instead-of-score" },
    },
    {
      kind: "replacement",
      matches: {
        type: "score",
        condition: custom("ven:first-or-second-turn"),
        data: { kind: "hold" },
      },
      replace: { op: "custom", id: "ven:draw-instead-of-score" },
    },
  ],
});
