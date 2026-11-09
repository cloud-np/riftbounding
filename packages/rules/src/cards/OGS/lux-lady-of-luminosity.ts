/**
 * Lux, Lady of Luminosity (OGS-021, legend) — "When you play a spell that costs [5] or more, draw
 * 1." (420.4.a: triggers when the spell resolves; Energy cost 5+)
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Lux, Lady of Luminosity",
  text: "When you play a spell that costs [5] or more, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          subject: { cardType: "spell", energyCost: { op: "gte", value: 5 } },
        },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
