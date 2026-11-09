/** Boneshiver. */
import { registerCardScript, WHEN_I_CONQUER } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Boneshiver",
  text: "[EQUIP][1][Body] ([1][Body]: Attach this to a unit you control.)\n\nWhen i conquer, channel 1 rune exhausted.\n+2 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: { op: "channel", amount: 1, exhausted: true },
    },
    mightBonus(2),
  ],
});
