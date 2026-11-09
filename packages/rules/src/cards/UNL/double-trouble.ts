/**
 * Double Trouble (UNL-032) — [Repeat 2] (820.1.d: the instructions run a second time when paid).
 * Look at the top 3, you may reveal a unit and draw it, recycle the rest (425/414/417).
 */
import { registerCardScript } from "../registry";
import { ifRepeat, lookRevealDraw } from "./dsl-unl";

registerCardScript({
  name: "Double Trouble",
  text: "[Repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nLook at the top 3 cards of your Main Deck. You may reveal a unit from among them and draw it. Recycle the rest.",
  status: "implemented",
  repeatHandled: true,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          lookRevealDraw(3, { cardType: "unit" }, "kept"),
          ifRepeat(lookRevealDraw(3, { cardType: "unit" }, "kept:repeat")),
        ],
      },
    },
  ],
});
