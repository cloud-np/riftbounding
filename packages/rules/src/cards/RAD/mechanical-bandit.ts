/** Mechanical Bandit (RAD-111) — "At the start of your Beginning Phase, each player reveals …" (315.2.a.1, 425, 417) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Mechanical Bandit",
  text: "At the start of your Beginning Phase, each player reveals the top card of their Main Deck. If you revealed a card with the lowest Energy cost, draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: { op: "custom", id: "rad:mechanical-bandit" },
    },
  ],
});
