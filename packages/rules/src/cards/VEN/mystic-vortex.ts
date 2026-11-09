/** Mystic Vortex. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Mystic Vortex",
  text: "During showdowns here, cards with [Reaction] cost [Rune] more to play. (Hidden cards have [Reaction].)",
  status: "partial",
  notes:
    "Cost modifiers only apply to the modifier controller's plays (356.3), and a chain spell's keywords are not available to the cost layer; no cost increase is registered.",
  abilities: [],
});
