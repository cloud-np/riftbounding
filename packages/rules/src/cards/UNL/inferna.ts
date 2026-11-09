/** Inferna. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Inferna",
  text: "[Ambush] (You may play me as a [reaction] to a battlefield where you have units.)\n[Assault 2] (+2 [might] while I'm an attacker.)",
  status: "implemented",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Reaction" }],
});
