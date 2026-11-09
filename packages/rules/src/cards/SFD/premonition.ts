/** Premonition. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Premonition",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nDraw 3.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 3 } }],
});
