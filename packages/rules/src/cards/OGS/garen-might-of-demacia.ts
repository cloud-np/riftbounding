/**
 * Garen, Might of Demacia (OGS-023, legend) — "When you conquer, if you have 4+ units at that
 * battlefield, draw 2."
 *
 * 383.4.c: "When you conquer" (player-level, the event's zone is the battlefield); 383.2.a.1: the
 * "if" is part of the trigger condition.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Garen, Might of Demacia",
  text: "When you conquer, if you have 4+ units at that battlefield, draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", player: "self" } },
      condition: {
        kind: "count",
        selector: {
          cardType: "unit",
          controller: "self",
          zone: { kind: "chosen", ref: "event-zone" },
        },
        comparison: { op: "gte", value: 4 },
      },
      effect: { op: "draw", amount: 2 },
    },
  ],
});
