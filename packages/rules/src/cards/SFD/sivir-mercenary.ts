/** Sivir, Mercenary. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sivir, Mercenary",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nIf you've spent at least [Rune][Rune] this turn, I have +2 [Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "partial",
  notes:
    '"If you\'ve spent at least [Rune][Rune] this turn, I have +2 [Might] and [Ganking]": resources spent this turn are not tracked (amount kind `spent` evaluates to 0, 165/167); only the printed Accelerate and Ganking keyword are automated.',
  abilities: [],
});
