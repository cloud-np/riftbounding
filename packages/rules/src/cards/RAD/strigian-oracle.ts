/** Strigian Oracle (RAD-053) — "When I become exhausted, [Predict]." (415, 437.3.a) */
import { registerCardScript, WHEN_I_BECOME_EXHAUSTED } from "../sdk";

registerCardScript({
  name: "Strigian Oracle",
  text: "When I become exhausted, [Predict]. (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_BECOME_EXHAUSTED, effect: { op: "predict", amount: 1 } },
  ],
});
