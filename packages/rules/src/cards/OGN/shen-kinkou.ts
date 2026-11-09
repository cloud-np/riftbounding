/** Shen, Kinkou (OGN-241) — [Reaction] (813), [Shield 2] (814) and [Tank] (815) are printed keywords handled by play/combat; no other text. */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Shen, Kinkou",
  text: "[REACTION] (Play any time, even before spells and abilities resolve, including to a battlefield you control.)\n[SHIELD 2] (+2 [Might] while I'm a defender.)\n[TANK] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: [],
});
