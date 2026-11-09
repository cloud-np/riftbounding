/** Nazuman Ntofo (RAD-071) — "[Equip][1] [Shield 2] +0 [Might]" (818; effect text 718.3/718.4) */
import { notIntrinsic, registerCardScript } from "../sdk";
import { HOST } from "./custom";

registerCardScript({
  name: "Nazuman Ntofo",
  text: "[Equip][1] ([1]: Attach this to a unit you control.)\n[Shield 2] (+2 [Might] while I'm a defender.)\n+0 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Shield", value: 2, target: HOST } },
  ],
});
