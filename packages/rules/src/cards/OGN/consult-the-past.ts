/** Consult the Past (OGN-083) — "[Hidden] [Reaction] Draw 2." ([Hidden] 811 is R2-play's keyword.) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Consult the Past",
  text: "[Hidden] (Hide now for [power] to react with later for [0].)\n[Reaction] (Play any time, even before spells and abilities resolve.)\nDraw 2.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 2 } }],
});
