/**
 * Kraken Hunter (OGN-150) — [Accelerate] [Assault] (printed); "As you play me, you may spend any
 * number of buffs as an additional cost. Reduce my cost by [body] for each buff you spend."
 * A variable "spend buffs" additional cost is not supported by R2-play's cost model.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Kraken Hunter",
  text: "[Accelerate] (You may pay [1] [body] as an additional cost to have me enter ready.)\n[Assault] (+1 [might] while i'm an attacker.)\n\nAs you play me, you may spend any number of buffs as an additional cost. Reduce my cost by [body] for each buff you spend.",
  status: "partial",
  notes:
    'Not automated: the optional "spend any number of buffs" additional cost and its [Body]-per-buff reduction (204.2, 356.2.b: no spend-buff / variable-count additional costs). Accelerate and Assault are printed keywords.',
  abilities: [],
});
