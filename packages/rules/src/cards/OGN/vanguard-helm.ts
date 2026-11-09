/**
 * Vanguard Helm (OGN-228) — "When a buffed friendly unit dies, buff another friendly unit."
 *
 * Manual: whether the unit was buffed is last-known information (383.2.c.3.b / 359.3.e.13), but
 * the rules object (with its buff) is deleted before the `kill` event, which does not carry the
 * buff. The intended ability is written below (inert while manual).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Vanguard Helm",
  text: "When a buffed friendly unit dies, buff another friendly unit. (If it doesn't have a buff, it gets a +1 [might] buff.)",
  status: "manual",
  notes:
    '`kill` events carry no last-known buff state (383.2.c.3.b), so "a buffed friendly unit dies" cannot be matched.',
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "self", buffed: true } },
      },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
