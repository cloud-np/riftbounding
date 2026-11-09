/**
 * Volibear, Relentless Storm (OGN-249, legend) — "When you play a [MIGHTY] unit, you may exhaust me
 * to channel 1 rune exhausted."
 *
 * 420.4.a: triggers when the unit has been played (resolved); it must be Mighty then (706: 5+
 * Might). "You may exhaust me to …" is an optional cost within the instruction (740.4.a), paid on
 * resolution; without paying nothing happens.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Volibear, Relentless Storm",
  text: "When you play a [MIGHTY] unit, you may exhaust me to channel 1 rune exhausted. (A unit is Mighty while it has 5+ [Might])",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "unit_played", player: "self", subject: { cardType: "unit", mighty: true } },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});
