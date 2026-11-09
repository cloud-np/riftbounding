/** Dazzling Aurora — at the end of your turn, reveal until a unit, banish it, play it ignoring its cost, recycle the rest (425, 420.3). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Dazzling Aurora",
  text: "At the end of your turn, reveal cards from the top of your Main Deck until you reveal a unit and banish it. Play it, ignoring its cost, and recycle the rest.",
  status: "manual",
  notes:
    "Not automated: reveal-until-a-unit, banish and play from the revealed set (no reveal-until op).",
  abilities: [],
});
