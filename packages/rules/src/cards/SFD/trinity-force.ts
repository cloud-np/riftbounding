/** Trinity Force. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Trinity Force",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n\nWhen I hold, score 1 point. +2 [Might]",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "score_points", amount: 1 } },
    mightBonus(2),
  ],
});
