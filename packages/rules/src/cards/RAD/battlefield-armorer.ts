/**
 * Battlefield Armorer (RAD-130) — "When a friendly gear at a battlefield dies, you may pay [1] to
 * return it to its owner's hand." (the kill event notes where it died, 383.2.c.3.b)
 */
import { EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Battlefield Armorer",
  text: "When a friendly gear at a battlefield dies, you may pay [1] to return it to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: { cardType: "gear", controller: "self" },
          condition: { kind: "event-zone-is", battlefield: true },
        },
      },
      effect: {
        op: "cost_then",
        cost: { energy: 1 },
        optional: true,
        effect: { op: "return_to_hand", target: EVENT_SUBJECT },
      },
    },
  ],
});
