/**
 * Vex, Gloomist (UNL-193, legend) — "When you or an ally hold, you may exhaust me to draw 1."
 * (383.4.d hold effect; "[do X] to [do Y]" is an optional cost within the instructions, 740.4.a.)
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Vex, Gloomist",
  text: "When you or an ally hold, you may exhaust me to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "hold", condition: custom("unl:event-player-in-team") },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});
