/** Fanfare (RAD-047) — "The next three times you play a unit this turn, draw 1." (390–393) */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Fanfare",
  text: "The next three times you play a unit this turn, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "delayed",
        trigger: {
          kind: "event",
          event: {
            type: "unit_played",
            player: "self",
            condition: custom("rad:fanfare-pending"),
          },
        },
        duration: "this-turn",
        once: false,
        effect: { op: "custom", id: "rad:fanfare-draw" },
      },
    },
  ],
});
