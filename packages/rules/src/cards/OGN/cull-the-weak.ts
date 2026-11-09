/** Cull the Weak (OGN-209) — "Each player kills one of their units." (303.2.a order; 429) */
import { registerCardScript } from "../sdk";
import { eachPlayerKillsOne } from "./custom";

registerCardScript({
  name: "Cull the Weak",
  text: "Each player kills one of their units.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: eachPlayerKillsOne("unit") }],
});
