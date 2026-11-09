/** Long Sword. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Long Sword",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Fury]  ([Fury]: Attach this to a unit you control.)\n\n+2 [Might]",
  status: "implemented",
  abilities: [mightBonus(2)],
});
