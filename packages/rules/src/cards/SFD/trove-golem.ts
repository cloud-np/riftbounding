/** Trove Golem. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Trove Golem",
  text: "When you play me, play four Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: gold(4) }],
});
