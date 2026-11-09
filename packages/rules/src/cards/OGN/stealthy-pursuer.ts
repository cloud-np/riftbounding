/**
 * Stealthy Pursuer (OGN-177) — "When a friendly unit moves from my location, I may be moved with
 * it."
 *
 * The trigger matches another friendly unit's move whose origin is my location (383.2.a); "I
 * may" is decided when it finalizes (403.1). I am moved (421, an effect-driven move) to the
 * location that unit moved to.
 */
import { HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Stealthy Pursuer",
  text: "When a friendly unit moves from my location, I may be moved with it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "move",
          from: HERE,
          subject: { cardType: "unit", controller: "self", excludeSource: true },
        },
      },
      optional: true,
      effect: { op: "move", target: SELF, to: { kind: "chosen", ref: "event-zone" } },
    },
  ],
});
