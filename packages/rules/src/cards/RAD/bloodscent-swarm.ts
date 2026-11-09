/** Bloodscent Swarm (RAD-080) — "I cost [2] less for each battlefield you've conquered this turn." */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bloodscent Swarm",
  text: "I cost [2] less for each battlefield you've conquered this turn.",
  status: "partial",
  notes:
    "No per-turn record of conquered battlefields exists (356.4; the history only counts cards played and scored battlefields), so the discount is not automated.",
  abilities: [],
});
