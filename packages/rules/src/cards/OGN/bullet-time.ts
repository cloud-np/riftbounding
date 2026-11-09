/** Bullet Time — pay any amount of Rune to deal that much damage to all enemy units at a battlefield (418). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Bullet Time",
  text: "[ACTION] Pay any amount of [Rune] to deal that much damage to all enemy units at a battlefield.",
  status: "manual",
  notes:
    "Not automated: a variable-amount payment made on resolution whose value feeds the damage (no 'pay any amount' op).",
  abilities: [],
});
