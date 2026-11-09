/** Plundering Poro. */
import { registerCardScript, WHEN_I_CONQUER } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Plundering Poro",
  text: "When I conquer, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_CONQUER, effect: gold() }],
});
