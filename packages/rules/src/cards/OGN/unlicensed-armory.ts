/**
 * Unlicensed Armory (OGN-023, Origins errata) — "Discard 1, [Tap]: Choose a friendly unit. The
 * next time it would die this turn, you may pay [Fury] to heal it, exhaust it, and recall it
 * instead."
 *
 * The activation and its cost (discard 1, exhaust this; 376/357.2) are automated. Partial: the
 * effect is an optional replacement with a payment ("you may pay … instead", 371.2 / 445), which
 * the replacement layer cannot offer (delayed replacements always apply), so the effect resolves
 * in the manual window.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Unlicensed Armory",
  text: "Discard 1, [Tap]: Choose a friendly unit. The next time it would die this turn, you may pay [Fury] to heal it, exhaust it, and recall it instead. (Send it to base. This isn't a move.)",
  status: "partial",
  notes:
    "The effect resolves in the manual window: optional replacements with a payment (371.2, 445) are not supported.",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1, exhaust: SELF },
      effect: { op: "custom", id: "manual" },
    },
  ],
});
