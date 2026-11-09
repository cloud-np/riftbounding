/**
 * Vanguard Helm (OGN-228) — "When a buffed friendly unit dies, buff another friendly unit."
 *
 * Whether the unit was buffed is last-known information on the `kill` event (383.2.c.3.b /
 * 359.3.e.13; the event carries `buffs`).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Vanguard Helm",
  text: "When a buffed friendly unit dies, buff another friendly unit. (If it doesn't have a buff, it gets a +1 [might] buff.)",
  status: "implemented",
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
