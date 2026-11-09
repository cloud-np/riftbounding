/** Blade of the Ruined King. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Blade of the Ruined King",
  text: "[Equip] — [Order], Kill a friendly unit (Pay the cost: Attach this to a unit you control.)\n\n+4 [Might]",
  status: "implemented",
  abilities: [mightBonus(4)],
});
