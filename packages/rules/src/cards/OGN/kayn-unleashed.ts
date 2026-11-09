/**
 * Kayn, Unleashed (OGN-189) — [Ganking] (printed); "If I have moved twice this turn, I don't take
 * damage." Units only record whether they moved this turn (`movedThisTurn`), not how often.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Kayn, Unleashed",
  text: "[GANKING] (I can move from battlefield to battlefield.)\nIf I have moved twice this turn, I don't take damage.",
  status: "partial",
  notes:
    'Not automated: "If I have moved twice this turn, I don\'t take damage" — no per-turn move count on objects (movedThisTurn is a flag), so the damage prevention (438) cannot be conditioned. Ganking is printed.',
  abilities: [],
});
