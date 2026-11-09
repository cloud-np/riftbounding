/** B.F. Sword. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "B.F. Sword",
  text: "[EQUIP] [ORDER] ([ORDER]: Attach this to a unit you control.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [mightBonus(3)],
});
