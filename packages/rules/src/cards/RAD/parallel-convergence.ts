/**
 * Parallel Convergence (RAD-051) — mandatory "return a friendly unit to its owner's hand"
 * additional cost, then deal 5 to a unit at a battlefield.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Parallel Convergence",
  text: "As an additional cost to play this, return a friendly unit to its owner's hand.\nDeal 5 to a unit at a battlefield.",
  status: "manual",
  notes:
    "The mandatory additional cost 'return a friendly unit to its owner's hand' is not a payable Cost part (357.2), so the card cannot be played strictly; the damage instruction is simple but unreachable.",
  abilities: [],
});
