/**
 * Chronobreak (RAD-140) — pay any amount of Power, banish that many units, then their owners
 * replay them to the same location or their base. Needs an any-amount cost and location choice.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Chronobreak",
  text: "As an additional cost to play this, pay any amount of Power.\nBanish that many units you control, then for each, its owner plays that unit back to the same location or to their base, ignoring its cost. (You choose the order.)",
  status: "manual",
  notes:
    "Needs an any-amount Power additional cost (203.3, 356.2) and effect-driven play to a chosen location (355.2 / 420.3.b); neither is expressible.",
  abilities: [],
});
