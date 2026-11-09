/** Frigid Jewel. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Frigid Jewel",
  text: "When you draw your second card each turn, give a friendly unit +2 [might] this turn.",
  status: "manual",
  notes:
    "The Nth-card-drawn-per-turn history is not tracked (429); the trigger cannot be detected without it.",
  abilities: [],
});
