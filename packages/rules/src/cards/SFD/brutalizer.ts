/** Brutalizer. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Brutalizer",
  text: "[Equip][Calm] ([Calm]: Attach this to a unit you control.)\n\nIf this was attached to me this turn, I have an additional 2 [Might] \n+1 [Might]",
  status: "partial",
  notes: `"If this was attached to me this turn, +2 Might": attachments made this turn are not tracked by the engine (435 / 718).`,
  abilities: [mightBonus(1)],
});
