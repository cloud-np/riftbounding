/** Doran's Blade. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Doran's Blade",
  text: "[Equip] [Body]  ([Body]: Attach this to a unit you control.)\n\n+2 [Might]",
  status: "implemented",
  abilities: [mightBonus(2)],
});
