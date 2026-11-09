/** Warmog's Armor. */
import { registerCardScript, SELF, WHEN_I_CONQUER } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Warmog's Armor",
  text: "[EQUIP] [Body] ([Body]: Attach this to a unit you control.)\n\nWhen I conquer, buff me. (If I don't have a buff, I get a +1 [Might] buff.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 136.2.d: "me" in appended Effect Text is the Top-Most card (the equipped unit).
    { kind: "triggered", trigger: WHEN_I_CONQUER, effect: { op: "buff", target: SELF } },
    mightBonus(1),
  ],
});
