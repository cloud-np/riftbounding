/** Sterak's Gage. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Sterak's Gage",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Calm] ([Calm]: Attach this to a unit you control.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [mightBonus(3)],
});
