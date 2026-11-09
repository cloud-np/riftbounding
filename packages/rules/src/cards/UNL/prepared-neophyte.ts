/** Prepared Neophyte. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Prepared Neophyte",
  text: "If you've spent [4] or more to play a spell this turn, I have +4 [might] .",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (Amount `spent`, 357, 166.2), so the conditional +4 Might cannot be applied.",
  abilities: [],
});
