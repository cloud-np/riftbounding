/**
 * Leona, Radiant Dawn (OGN-261, legend) — "When you stun one or more enemy units, buff a friendly
 * unit." (424; 412.4 "you")
 *
 * The `stun` op emits one event per unit, so a single action that stuns several enemy units
 * triggers once per unit instead of once.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Leona, Radiant Dawn",
  text: "When you stun one or more enemy units, buff a friendly unit. (If it doesn't have a buff, it gets a +1 [Might] buff.)",
  status: "partial",
  notes:
    '"One or more": an action that stuns several enemy units triggers once per unit, not once (stun events are per unit; no batched trigger event).',
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "stun",
          player: "self",
          subject: { cardType: "unit", controller: "opponent" },
        },
      },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
