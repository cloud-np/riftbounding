/** Serrated Dirk. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { hostKeyword } from "./custom";

registerCardScript({
  name: "Serrated Dirk",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\n\n[ASSAULT 2] (+2 [Might] while I'm an attacker.\n+0 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Assault"), hostKeyword("Assault", 2)],
});
