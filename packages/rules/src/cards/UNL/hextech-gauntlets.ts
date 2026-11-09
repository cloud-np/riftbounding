/** Hextech Gauntlets. */
import { HOST, registerCardScript } from "../sdk";
import { equip } from "./custom";

registerCardScript({
  name: "Hextech Gauntlets",
  text: "[Equip][3][Rune]. This ability's Energy cost is reduced by the Might of the unit you choose. (Pay the cost: Attach this to a unit you control.)\nWhen I conquer, if you assigned 3 or more excess damage, draw 1.\n+3 [Might]",
  status: "partial",
  notes:
    "The normal Equip button still offers the full [3][Rune] cost (the Energy reduction reads the target choice, 818.1.c.2); the Weaponmaster trigger applies the chosen unit's Might reduction (821.1.c.2.b). The conquer draw is not automated: excess damage assigned in combat is not recorded (467.2.c.4).",
  abilities: [
    equip({ energy: 3, power: { any: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 3, target: HOST } },
  ],
});
