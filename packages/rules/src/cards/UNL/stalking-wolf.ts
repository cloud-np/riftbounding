/** Stalking Wolf. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Stalking Wolf",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nAs an additional cost to play me, kill a Bird, Cat, Dog, or Poro you control. You may [Ambush] me to its battlefield, even if you don't have other units there.",
  status: "partial",
  notes:
    "The mandatory additional cost 'kill a Bird, Cat, Dog, or Poro' cannot be expressed by the cost selector (one tag only, 357.2) and the widened [Ambush] location cannot be registered; the printed [Ambush] works.",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Reaction" }],
});
