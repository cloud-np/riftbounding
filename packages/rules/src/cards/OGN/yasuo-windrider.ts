/**
 * Yasuo, Windrider (OGN-205) — "[GANKING] The third time I move in a turn, you score 1 point."
 *
 * [Ganking] (810) is printed. Partial: "the third time … in a turn" (383.1.b) needs a per-turn
 * count of this object's moves, which the rules state does not record (only `movedThisTurn`).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Yasuo, Windrider",
  text: "[GANKING] (I can move from battlefield to battlefield.)\nThe third time I move in a turn, you score 1 point.",
  status: "partial",
  notes:
    "The scoring trigger is manual: 'the Nth time … in a turn' triggers (383.1.b) need a per-turn move count.",
  abilities: [],
});
