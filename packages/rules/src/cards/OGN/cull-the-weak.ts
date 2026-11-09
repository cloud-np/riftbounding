/** Cull the Weak (OGN-209) — "Each player kills one of their units." (303.2.a order; 429) */
import { eachPlayerKillsOne } from "./acceptable-losses";
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Cull the Weak",
  text: "Each player kills one of their units.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: eachPlayerKillsOne("unit") }],
});
