/**
 * Iron Ballista (OGN-017) — "This enters exhausted. [TAP]: Deal 2 to a unit at a battlefield."
 * The [Tap] ability is automated; "This enters exhausted" is an entry replacement (369.3 mirror of
 * "enters ready") that the layers do not offer for gear (they only have `enter-ready`).
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Iron Ballista",
  text: "This enters exhausted.\n[TAP]: Deal 2 to a unit at a battlefield.",
  status: "partial",
  notes:
    'Not automated: "This enters exhausted" — no enter-exhausted entry replacement for gear (369.3; gear enter ready, 149.1).',
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "deal", amount: 2, target: aUnit({ zone: "battlefield" }) },
    },
  ],
});
