/**
 * Mistfall (OGN-152) — "When you buff a friendly unit, you may pay [Body] and exhaust this to ready it."
 * The cost within the instruction (740.4.a.2) is paid when the trigger finalizes, or the trigger is
 * removed (405.2); 427 buff events, 416 ready.
 */
import { EVENT_SUBJECT, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Mistfall",
  text: "When you buff a friendly unit, you may pay [Body] and exhaust this to ready it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "buff", player: "self", subject: { cardType: "unit", controller: "self" } },
      },
      effect: {
        op: "cost_then",
        cost: { power: { Body: 1 }, exhaust: SELF },
        optional: true,
        effect: { op: "ready", target: EVENT_SUBJECT },
      },
    },
  ],
});
