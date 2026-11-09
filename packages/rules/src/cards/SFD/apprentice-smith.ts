/** Apprentice Smith. */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";
import { revealTop } from "./custom";

registerCardScript({
  name: "Apprentice Smith",
  text: "When I move, reveal the top card of your Main Deck. If it's a gear, draw it. Otherwise, recycle it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: revealTop("gear", { op: "custom", id: "core:draw-ref", params: { ref: "looked" } }),
    },
  ],
});
