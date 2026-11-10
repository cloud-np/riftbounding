/**
 * Pirate's Haven (OGN-143) — "When you ready a friendly unit, give it +1 [Might] this turn."
 *
 * 412.4: "you" = the player responsible for the Ready. Effect-driven readies carry the
 * controller of the spell/ability (412.1) and the Awaken Phase readies each object for the Turn
 * Player (315.1.b / 416.3.a), so both trigger it once per readied friendly unit.
 */
import { EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Pirate's Haven",
  text: "When you ready a friendly unit, give it +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "ready", player: "self", subject: { cardType: "unit", controller: "self" } },
      },
      effect: { op: "temporary_might", amount: 1, target: EVENT_SUBJECT },
    },
  ],
});
