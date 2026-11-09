/** Sunlit Guardian (OGN-054) — [Shield] (814) and [Tank] (815) are printed combat keywords; no other text. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sunlit Guardian",
  text: "[Shield] (+1 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: [],
});
