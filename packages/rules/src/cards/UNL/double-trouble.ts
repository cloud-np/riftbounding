/**
 * Double Trouble (UNL-032) — [Repeat 2] (820.1.d: the engine executes the instructions once per
 * paid Repeat instance; 820.2 gives each execution its own play-time choices).
 * Look at the top 3, you may reveal a unit and draw it, recycle the rest (425/414/417).
 */
import { registerCardScript } from "../sdk";
import { lookRevealDraw } from "./custom";

registerCardScript({
  name: "Double Trouble",
  text: "[Repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nLook at the top 3 cards of your Main Deck. You may reveal a unit from among them and draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: lookRevealDraw(3, { cardType: "unit" }, "kept"),
    },
  ],
});
