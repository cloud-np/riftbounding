/** Explosimian (RAD-094) — "When I hold, play three Bomb gear tokens to a single battlefield." */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { playBombs } from "./custom";

registerCardScript({
  name: "Explosimian",
  text: "When I hold, play three Bomb gear tokens to a single battlefield. (They have [Deploy]. When each dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_HOLD, effect: playBombs(3) }],
});
