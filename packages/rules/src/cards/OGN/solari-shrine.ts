/**
 * Solari Shrine (OGN-072) — "When you kill a stunned enemy unit, you may exhaust this to draw 1."
 *
 * "You kill" = the player responsible for the kill (429.5, 412.4; the `kill` event carries
 * `data.responsible`). Whether the killed unit was stunned is last-known information on the
 * `kill` event (383.2.c.3.b, 424). "You may exhaust this to draw 1" is an optional cost within
 * the instruction (740.4.a).
 */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";
import { registerCustomCondition } from "../../effects/evaluate";

/** The kill event was caused by the ability's controller ("When you kill", 429.5). */
registerCustomCondition("ogn-oz:killed-by-you", (ctx) => {
  const responsible = (ctx.env.event?.data ?? {}).responsible;
  return typeof responsible === "string" && responsible === ctx.env.controller;
});

registerCardScript({
  name: "Solari Shrine",
  text: "When you kill a stunned enemy unit, you may exhaust this to draw 1.",
  status: "partial",
  notes:
    "Direct Kill instructions work (the kill event carries the responsible player, 429.5.b). Damage kills in the Cleanup are attributed through the damage's `damageSource` (429.5.c/.c.1). Status stays with the Origins O–Z card lane.",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: { cardType: "unit", controller: "opponent", stunned: true },
          condition: custom("ogn-oz:killed-by-you"),
        },
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
