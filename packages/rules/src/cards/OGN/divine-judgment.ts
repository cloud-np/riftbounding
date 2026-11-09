/** Divine Judgment — each player chooses 2 of each category, recycles the rest (355.18). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Divine Judgment",
  text: "Each player chooses 2 units, 2 gear, 2 runes, and 2 cards in their hands. Recycle the rest.",
  status: "manual",
  notes:
    "Not automated: simultaneous multi-category per-player choices with recycling the unchosen objects (ogn:players-choose handles one category only; recycling runes to the Rune Deck is a separate op).",
  abilities: [],
});
