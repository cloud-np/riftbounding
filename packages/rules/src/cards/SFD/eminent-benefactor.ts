/** Eminent Benefactor. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Eminent Benefactor",
  text: "When I hold, play two Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_HOLD, effect: gold(2) }],
});
