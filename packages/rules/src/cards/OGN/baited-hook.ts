/** Baited Hook — kill a friendly unit, look at the top 5, banish a unit with Might up to 1 more than the killed unit and play it ignoring its cost (357, 420). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Baited Hook",
  text: "[1][Order], [Tap]: Kill a friendly unit. Look at the top 5 cards of your Main Deck. You may banish a unit from among them that has Might up to 1 more than the killed unit and play it, ignoring its cost. Then recycle the rest.",
  status: "manual",
  notes:
    "Not automated: the kill cost's Might is not readable by the later look-at-top selection (no value carried from a cost, 357.2) and the chosen-from-looked-at banish-and-play has no op.",
  abilities: [],
});
