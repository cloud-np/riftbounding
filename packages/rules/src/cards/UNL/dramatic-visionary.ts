/** Dramatic Visionary (UNL-062) — [Deathknell] (808): [Predict 2] (437). */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Dramatic Visionary",
  text: "[Deathknell] [Predict 2]. (When I die, look at the top two cards of your Main Deck. Recycle any of them and put the rest back in any order.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "predict", amount: 2 },
    },
  ],
});
