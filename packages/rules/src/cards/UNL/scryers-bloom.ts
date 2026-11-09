/** Scryer's Bloom. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";
import { ENTERS_EXHAUSTED_NOTE } from "./custom";

registerCardScript({
  name: "Scryer's Bloom",
  text: "This enters exhausted.\nKill this,[1] , [tap] : [Predict 2], then draw 1. Gain 1 XP. (To Predict 2, look at the top two cards of your Main Deck. Recycle any of them and put the rest back in any order.)",
  status: "partial",
  notes: ENTERS_EXHAUSTED_NOTE,
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "exhaust", target: SELF } },
    {
      kind: "activated",
      cost: { energy: 1, kill: SELF, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "predict", amount: 2 },
          { op: "draw", amount: 1 },
          { op: "gain_xp", amount: 1 },
        ],
      },
    },
  ],
});
