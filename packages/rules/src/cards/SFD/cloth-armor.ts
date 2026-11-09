/** Cloth Armor. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { hostKeyword } from "./custom";

registerCardScript({
  name: "Cloth Armor",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Mind] ([Mind]: Attach this to a unit you control.)\n\n[Shield 2] (+2 [Might] while I'm a defender.)\n+0 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Shield"), hostKeyword("Shield", 2)],
});
