/** Cloud Drake. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Cloud Drake",
  text: "When you play me, draw 1.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } }],
});
