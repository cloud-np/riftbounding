/** Cull. */
import { registerCardScript, WHEN_I_CONQUER } from "../sdk";
import { gold, mightBonus } from "./custom";

registerCardScript({
  name: "Cull",
  text: "[Equip][Chaos] ([Chaos]: Attach this to a unit you control.)\n\nWhen I conquer, play a Gold gear token exhausted.\n+1 [Might]",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_CONQUER, effect: gold(1) }, mightBonus(1)],
});
