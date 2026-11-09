/**
 * Solari Shrine (OGN-072) — "When you kill a stunned enemy unit, you may exhaust this to draw 1."
 *
 * Manual: whether the killed unit was stunned is last-known information (383.2.c.3.b), but the
 * rules object (with `stunned`) is deleted before the `kill` event, which does not carry it. The
 * intended ability is written below (inert while manual): "you kill" = the responsible player
 * (429.5), "you may exhaust this to draw 1" = an optional cost within the instruction (740.4.a).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Solari Shrine",
  text: "When you kill a stunned enemy unit, you may exhaust this to draw 1.",
  status: "manual",
  notes:
    '`kill` events carry no last-known stunned state (383.2.c.3.b), so "a stunned enemy unit" cannot be matched.',
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        // TODO(engine): also require `data.responsible` = this ability's controller (429.5).
        event: {
          type: "die",
          subject: { cardType: "unit", controller: "opponent", stunned: true },
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
