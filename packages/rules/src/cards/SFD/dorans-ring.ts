/** Doran's Ring. */
import { registerCardScript, WHEN_I_CONQUER } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Doran's Ring",
  text: "[Equip] [Chaos] ([Chaos]: Attach this to a unit you control.)-.\n\nWhen I conquer, discard 1, then draw 1.\n+1 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 1 },
        ],
      },
    },
    mightBonus(1),
  ],
});
