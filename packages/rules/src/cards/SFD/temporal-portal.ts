/** Temporal Portal. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Temporal Portal",
  text: "[Rune], [Tap]: Give the next spell you play this turn [Repeat] equal to its cost. (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    '"Give the next spell you play this turn [Repeat] equal to its cost": granting Repeat with a computed value to a future play is not supported (820.1, 420.5).',
  abilities: [],
});
