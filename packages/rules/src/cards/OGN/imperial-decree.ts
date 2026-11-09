/**
 * Imperial Decree (OGN-221) — "When any unit takes damage this turn, kill it."
 * A delayed triggered ability (390–393) for the rest of the turn, not used up (393).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT } from "../dsl";

registerCardScript({
  name: "Imperial Decree",
  text: "[action] (Play on your turn or in showdowns.) When any unit takes damage this turn, kill it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "delayed",
        trigger: { kind: "event", event: { type: "damage", subject: { cardType: "unit" } } },
        effect: { op: "kill", target: EVENT_SUBJECT },
        duration: "this-turn",
        once: false,
      },
    },
  ],
});
