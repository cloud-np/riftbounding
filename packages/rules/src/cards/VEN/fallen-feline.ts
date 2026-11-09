/** Fallen Feline. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Fallen Feline",
  text: "When you play me, name a spell.\nWhile I'm at a battlefield, opponents can't play spells with that name.",
  status: "partial",
  notes:
    "Naming a card (a free card-name choice) and a persistent name-based 'can't be played' restriction are not supported: the restriction layer reads static modifiers and there is no name-choice state.",
  abilities: [],
});
