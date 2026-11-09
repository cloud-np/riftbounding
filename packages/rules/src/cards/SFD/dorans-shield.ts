/** Doran's Shield. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { hostKeyword, mightBonus } from "./custom";

registerCardScript({
  name: "Doran's Shield",
  text: "[Equip][Calm]  ([Calm]: Attach this to a unit you control.)\n\n[Tank], +1 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Tank"), hostKeyword("Tank"), mightBonus(1)],
});
