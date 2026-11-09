/**
 * Blitzcrank, Impassive (OGN-067) — "[Tank] When you play me to a battlefield, you may move an
 * enemy unit to here. When I hold, return me to my owner's hand."
 * "to a battlefield" is part of the trigger condition (383.2.a.1); 383.3.a "you may" (403.1).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, WHEN_PLAYED, aUnit, custom } from "../dsl";

registerCardScript({
  name: "Blitzcrank, Impassive",
  text: "[Tank] (I must be assigned combat damage first.)\nWhen you play me to a battlefield, you may move an enemy unit to here.\nWhen I hold, return me to my owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: custom("event-zone-is", { battlefield: true }),
      optional: true,
      effect: { op: "move", target: aUnit({ controller: "opponent" }), to: HERE },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "return_to_hand", target: SELF },
    },
  ],
});
