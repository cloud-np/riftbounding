/**
 * Black Market (RAD-158) — "[Rune] [Rune]: Draw 1. Each player may use this ability once on
 * their turn (even if they don't control this battlefield)."
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Black Market",
  text: "[Rune] [Rune]: Draw 1. Each player may use this ability once on their turn (even if they don't control this battlefield).",
  status: "partial",
  notes:
    "The ability is scripted (2 Power, draw 1), but a battlefield has no controller and activation legality only accepts the card's controller (378/381: 'abilities other players may activate' is not implemented), so no player can activate it.",
  abilities: [
    {
      kind: "activated",
      cost: { power: { any: 2 } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
