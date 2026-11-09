/** Boots of Swiftness. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { hostKeyword, mightBonus } from "./custom";

registerCardScript({
  name: "Boots of Swiftness",
  text: "[Equip][Chaos] ([Chaos]: Attach this to a unit you control.)\n\n[GANKING] (I can move from battlefield to battlefield.)\n+2 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Ganking"), hostKeyword("Ganking"), mightBonus(2)],
});
