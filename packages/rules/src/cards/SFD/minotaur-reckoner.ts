/** Minotaur Reckoner. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Minotaur Reckoner",
  text: "Units can't move to base.",
  status: "manual",
  notes:
    '"Units can\'t move to base": a move restriction ignores the destination of the move (restrictionFor does not read `to`, 054.1, 421).',
  abilities: [],
});
