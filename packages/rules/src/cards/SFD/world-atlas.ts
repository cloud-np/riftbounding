/** World Atlas. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { gold, mightBonus } from "./custom";

registerCardScript({
  name: "World Atlas",
  text: "[EQUIP] [Mind] ([Mind]: Attach this to a unit you control.)\n\nWhen I hold, play two Gold Gear tokens exhausted.\n+2 [Might]",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_HOLD, effect: gold(2) }, mightBonus(2)],
});
