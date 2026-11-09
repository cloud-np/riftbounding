/**
 * Treasure Trove (OGN-186) — "When this leaves the board, draw 1 and channel 1 rune exhausted.
 * [Chaos],[Tap]: Kill this."
 *
 * A leave-the-board trigger of the object itself (383.2.c.3): killed, banished or returned to
 * hand. The activated ability's cost is [Chaos] plus exhausting this (376).
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Treasure Trove",
  text: "When this leaves the board, draw 1 and channel 1 rune exhausted.\n[Chaos],[Tap]: Kill this.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: ["kill", "banish", "return_to_hand", "recycle"], subject: SELF },
      },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
    {
      kind: "activated",
      cost: { power: { Chaos: 1 }, exhaust: SELF },
      effect: { op: "kill", target: SELF },
    },
  ],
});
