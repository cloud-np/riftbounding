/** Poppy, Defender of the Meek. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Poppy, Defender of the Meek",
  text: "You may spend 3 XP as an additional cost to play me. If you do, I cost less.\n[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\n[Tank] (I must be assigned combat damage first.)",
  status: "partial",
  notes:
    "The optional 3 XP additional cost and the cost reduction cannot be combined: a cost modifier cannot read the optional-cost choice (356.2.b.1, 366), and the catalog text is missing the reduction amount. [Ambush] and [Tank] are printed keywords.",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Reaction" }],
});
