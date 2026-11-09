/**
 * Lux, Illuminated (OGS-006) — "When you play a spell that costs [5] or more, give me +3 [Might]
 * this turn."
 *
 * 420.4.a: "when you play a card" triggers when playing completes (the spell resolves; a
 * countered spell never triggers it, 426.1.b). "Costs [5] or more" reads the spell's Energy cost.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Lux, Illuminated",
  text: "When you play a spell that costs [5] or more, give me +3 [Might] this turn.",
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
      effect: { op: "temporary_might", amount: 3, target: SELF },
    },
  ],
});
