/** Poro Snax. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Poro Snax",
  text: "When you play this, draw 1.\n[1][Calm], [Tap], Kill this: Draw 1.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    {
      kind: "activated",
      cost: { energy: 1, power: { Calm: 1 }, exhaust: SELF, kill: SELF },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
