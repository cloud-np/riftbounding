/** Treasure Hoard. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Treasure Hoard",
  text: "When you conquer here, you may pay [1] to play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: { op: "cost_then", optional: true, cost: { energy: 1 }, effect: gold() },
    },
  ],
});
