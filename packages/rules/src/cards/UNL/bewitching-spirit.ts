/** Bewitching Spirit (UNL-121) — Play Effect: choose a player (355.7); they discard 1 (423.1.a: they choose). */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Bewitching Spirit",
  text: "When you play me, choose a player. They discard 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "discard", amount: 1, player: { kind: "chosen", ref: "player" } },
    },
  ],
});
