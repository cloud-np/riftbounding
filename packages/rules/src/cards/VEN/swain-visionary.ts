/** Swain, Visionary. */
import { custom, registerCardScript, WHEN_I_CONQUER } from "../sdk";

registerCardScript({
  name: "Swain, Visionary",
  text: "[Vision] (When you play me, look at the top card of your Main Deck. You may recycle it.)\nWhen I conquer, if you've played a non-token unit, a non-token gear, and a spell this turn, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      // Vision (817) is a keyword trigger; 383.2.a.1 the "if" is part of the conquer condition.
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      condition: custom("ven:played-unit-gear-spell"),
      effect: { op: "score_points", amount: 1 },
    },
  ],
});
