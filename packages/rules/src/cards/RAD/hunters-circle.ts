/** Hunters' Circle (RAD-163) — first unit/gear each player plays here on their turn costs [1] less. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Hunters' Circle",
  text: "For each player, the first unit or gear they play here on their turn costs [1] less.",
  status: "manual",
  notes:
    "Needs a per-player per-turn record of where units/gear were played and a cost adjustment read before the play location is chosen (356.4, 420.5); neither exists.",
  abilities: [],
});
