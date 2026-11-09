/** Hexdrinker. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { hostKeyword, mightBonus } from "./custom";

registerCardScript({
  name: "Hexdrinker",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n+1 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Deflect"), hostKeyword("Deflect"), mightBonus(1)],
});
