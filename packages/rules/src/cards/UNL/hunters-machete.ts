/** Hunter's Machete. */
import { HOST, registerCardScript } from "../sdk";
import { equip } from "./custom";

registerCardScript({
  name: "Hunter's Machete",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n[Hunt] (When I conquer or hold, gain 1 XP)\n+2 [Might]",
  status: "implemented",
  abilities: [
    equip({ power: { Body: 1 } }),
    { kind: "suppress-printed-keyword", keyword: "Hunt" },
    { kind: "passive", modifier: { kind: "keyword", keyword: "Hunt", target: HOST } },
    { kind: "passive", modifier: { kind: "might", amount: 2, target: HOST } },
  ],
});
