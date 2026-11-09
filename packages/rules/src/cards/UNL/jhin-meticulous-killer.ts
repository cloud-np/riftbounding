/** Jhin, Meticulous Killer. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Jhin, Meticulous Killer",
  text: "[Vision]  (When you play me, look at the top card of your deck. You may recycle it.)\n\nIf you've spent [4] or more to play a spell this turn, you may play me for [mind].",
  status: "partial",
  notes:
    "The alternative cost 'you may play me for [mind]' is gated on resources spent this turn, which are not tracked (357, 166.2); [Vision] is a printed keyword.",
  abilities: [],
});
