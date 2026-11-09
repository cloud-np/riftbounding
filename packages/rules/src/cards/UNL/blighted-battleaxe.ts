/** Blighted Battleaxe. */
import { HOST, registerCardScript } from "../sdk";
import { equip } from "./custom";

registerCardScript({
  name: "Blighted Battleaxe",
  text: "[Equip][1][Fury] ([1][Fury]: Attach this to a unit you control.)\nAt the end of your turn, If I didn't conquer this turn, unattach this and deal 4 to me.\n+4 [Might]",
  status: "partial",
  notes:
    "'At the end of your turn, if I didn't conquer this turn, unattach this and deal 4 to me' is not automated: whether the equipped unit conquered this turn is not tracked (383.4.c, 717); Equip and +4 Might are.",
  abilities: [
    equip({ energy: 1, power: { Fury: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 4, target: HOST } },
  ],
});
