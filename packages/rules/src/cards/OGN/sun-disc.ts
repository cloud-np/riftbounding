/**
 * Sun Disc (OGN-021) — "[TAP]: [LEGION] - The next unit you play this turn enters ready."
 *
 * The ability is Legion-dependent (812, 727.1.b): it can only be activated while another card was
 * Finalized this turn (377.2.b-style precondition via `requires`). Partial: "the next unit you play
 * this turn enters ready" needs an enter-ready replacement (369.3) used up by the next unit played
 * (420.5); `enter-ready` modifiers are never consumed, so the effect resolves in the manual window.
 */
import { LEGION, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Sun Disc",
  text: "[TAP]: [LEGION] - The next unit you play this turn enters ready. (Get the effect if you've played another card this turn.)",
  status: "partial",
  notes:
    "The effect resolves in the manual window: a one-shot enter-ready replacement consumed by the next unit played (369.3, 420.5) is not supported.",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: LEGION,
        rule: "812.2",
        effect: { op: "custom", id: "manual" },
      },
    },
  ],
});
