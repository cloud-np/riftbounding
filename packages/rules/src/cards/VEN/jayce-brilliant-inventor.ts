/** Jayce, Brilliant Inventor. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Jayce, Brilliant Inventor",
  text: "When you play me or the first time you play a non-token gear each turn, you may ready something besides me that's exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "ready",
        target: { chosen: true, exhausted: true, excludeSource: true, cardType: "permanent" },
      },
    },
    {
      kind: "triggered",
      // "the first time" each turn: the once-per-turn limit counts triggers (383.2.b).
      trigger: {
        kind: "event",
        event: { type: "gear_played", player: "self", subject: { cardType: "gear", token: false } },
      },
      limit: { kind: "once-per-turn" },
      optional: true,
      effect: {
        op: "ready",
        target: { chosen: true, exhausted: true, excludeSource: true, cardType: "permanent" },
      },
    },
  ],
});
