/** Dredge Up. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Dredge Up",
  text: "Draw 1.\n[Flow][2] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 1 } }],
});
