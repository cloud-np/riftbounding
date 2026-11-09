/**
 * Titanic Shrine (RAD-089) — "When you play a unit with Might greater than each other unit on the
 * board, exhaust me to draw 1." (383.3.b: the leading cost is paid or declined on finalization)
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Titanic Shrine",
  text: "When you play a unit with Might greater than each other unit on the board, exhaust me to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          player: "self",
          condition: custom("rad:event-unit-mightiest"),
        },
      },
      effect: { op: "cost_then", cost: { exhaust: SELF }, effect: { op: "draw", amount: 1 } },
    },
  ],
});
