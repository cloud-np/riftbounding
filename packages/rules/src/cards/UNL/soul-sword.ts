/** Soul Sword. */
import { HOST, registerCardScript } from "../sdk";
import { equip } from "./custom";

registerCardScript({
  name: "Soul Sword",
  text: "[Equip] [calm] ([calm] : Attach this to a unit you control.)\n[level 3] I have an additional +1 [might] .\n(While you have 3+ XP, get the effect.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    equip({ power: { Calm: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 1, target: HOST } },
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: { kind: "xp-at-least", amount: 3 },
        modifier: { kind: "might", amount: 1, target: HOST },
      },
    },
  ],
});
