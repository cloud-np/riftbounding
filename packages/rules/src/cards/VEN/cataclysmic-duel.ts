/** Cataclysmic Duel (VEN-090) — "Each player chooses a unit they control. Kill the rest." (355.18 picks, 429 kill) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Cataclysmic Duel",
  text: "Each player chooses a unit they control. Kill the rest.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "custom", id: "ven:each-player-keeps-one-unit" } }],
});
