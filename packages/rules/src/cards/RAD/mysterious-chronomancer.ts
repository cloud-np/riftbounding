/** Mysterious Chronomancer (RAD-050) — "When you play me, [Predict 2]. [Disarm 2]" (437, 831). */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Mysterious Chronomancer",
  text: "When you play me, [Predict 2]. (Look at the top 2 cards of your Main Deck. Recycle any of them and put the rest back in any order.)\n[Disarm 2] (When I attack, give an enemy unit here -2[Might] this turn.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "predict", amount: 2 } }],
});
