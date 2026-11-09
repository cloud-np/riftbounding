/** Forgotten Library. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Forgotten Library",
  text: "While you control this battlefield, when you play a spell, if you spend [4] or more [predict] . (Look at the top card of your Main Deck. You may recycle it.)",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (Amount `spent`, 357, 166.2); the spell trigger cannot be gated on the amount spent.",
  abilities: [],
});
