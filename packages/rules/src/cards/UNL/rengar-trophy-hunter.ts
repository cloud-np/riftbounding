/** Rengar, Trophy Hunter. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Rengar, Trophy Hunter",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nI can [Ambush] to a battlefield where there are enemy units, even if you don't have units there.",
  status: "partial",
  notes:
    "The widened [Ambush] location (822.1) cannot be registered by a card script: [Ambush] is still limited to battlefields where you have units.",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Reaction" }],
});
