/** Protector's Shield (RAD-123) — "[Quick-Draw] [Equip] [1] [Tank] +1 [Might]" (819, 818; effect text 718.3/718.4) */
import { notIntrinsic, registerCardScript } from "../sdk";
import { HOST } from "./custom";

registerCardScript({
  name: "Protector's Shield",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [1] ([1]: Attach this to a unit you control.)\n[Tank] (I must be assigned combat damage first.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Tank"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Tank", target: HOST } },
    { kind: "passive", modifier: { kind: "might", amount: 1, target: HOST } },
  ],
});
