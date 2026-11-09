/** Experimental Hexplate. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Experimental Hexplate",
  text: "[EQUIP][Mind] ([Mind]: Attach this to a unit you control.)\n\nI am a Mech.\n+1",
  status: "partial",
  notes: `"I am a Mech" (the equipped unit gains the Mech tag): no tag-granting modifier in the layers (479.2 / 718.3).`,
  abilities: [mightBonus(1)],
});
