/**
 * Mel, Newly Awakened (VEN-069) — "When you play me, draw 1. [Empower][3] [Empowered] Your
 * spells and abilities can't be countered. If a spell or ability you control would give
 * -[Might] to a unit it chooses, it gives an additional -1 [Might]."
 *
 * The play effect (383.4.a) and Empower (827.1.c.1) are automated; the Empowered lines are not.
 */
import { empower, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Mel, Newly Awakened",
  text: "When you play me, draw 1.\n[Empower][3] ([3]: Empower me. Use only if not Empowered.)\n[Empowered] Your spells and abilities can't be countered. If a spell or ability you control would give -[Might] to a unit it chooses, it gives an additional -1 [Might].",
  status: "partial",
  notes:
    "Empowered lines not automated: 'can't be countered' needs a counter restriction for chain items (426, restrictionFor has no 'counter' kind) and the additional -1 Might needs a replacement on Might decreases by chosen-target effects (367/479.4).",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    empower({ energy: 3 }),
  ],
});
