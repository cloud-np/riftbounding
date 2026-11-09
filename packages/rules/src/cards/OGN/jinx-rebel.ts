/**
 * Jinx, Rebel (OGN-202) — "When you discard one or more cards, ready me and give me +1 [Might] this
 * turn." (423; 412.4 "you")
 *
 * The discard op emits one event per card, so discarding several cards in one action triggers once
 * per card instead of once.
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Jinx, Rebel",
  text: "When you discard one or more cards, ready me and give me +1 [Might] this turn.",
  status: "partial",
  notes:
    '"One or more": discarding several cards in one action triggers once per card, not once (discard events are per card; no batched trigger event).',
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "discard", player: "self" } },
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 1, target: SELF },
        ],
      },
    },
  ],
});
