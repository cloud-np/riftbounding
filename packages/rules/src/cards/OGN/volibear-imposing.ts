/**
 * Volibear, Imposing (OGN-158) — "[SHIELD 3] [TANK] When an opponent moves to a battlefield other
 * than mine, draw 1."
 *
 * Partial: [Shield 3] (814) and [Tank] (815) are printed keywords handled by the combat layer.
 * "When an opponent moves to a battlefield" is a player-level move (one per move action, however
 * many units move); the engine only emits per-unit `move` events, so the trigger is not scripted.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Volibear, Imposing",
  text: "[SHIELD 3] (+3 [Might] while I'm a defender.)\n[TANK] (I must be assigned combat damage first.)\nWhen an opponent moves to a battlefield other than mine, draw 1. (Bases are not battlefields.)",
  status: "partial",
  notes:
    "The draw trigger is manual: no player-level move event (one per move action, 421/447) exists, only per-unit `move` events.",
  abilities: [],
});
