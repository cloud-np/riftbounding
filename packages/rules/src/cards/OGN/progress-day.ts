/** Progress Day (OGN-114) — "Draw 4." (414) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Progress Day",
  text: "Draw 4.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 4 } }],
});
