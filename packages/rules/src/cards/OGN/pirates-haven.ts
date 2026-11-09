/**
 * Pirate's Haven (OGN-143) — "When you ready a friendly unit, give it +1 [Might] this turn."
 *
 * Manual: "you ready" needs the player responsible for the ready (412.4), but the `ready` event
 * carries no player, and the Awaken Phase readies everything through one `ready_all` event
 * (315.1.b) with no per-object `ready` events, so the trigger cannot be detected correctly. The
 * intended ability is written below for when those events exist (inert while manual).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT } from "../dsl";

registerCardScript({
  name: "Pirate's Haven",
  text: "When you ready a friendly unit, give it +1 [Might] this turn.",
  status: "manual",
  notes:
    "Trigger detection blocked: `ready` events have no responsible player (412.4) and the Awaken Phase readies via one `ready_all` event without per-object `ready` events (315.1.b).",
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
