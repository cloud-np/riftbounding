/** Bubble Bot. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Bubble Bot",
  text: "When you play me, ready another friendly Mech.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "ready",
        target: target({ controller: "self", tag: "Mech", excludeSelf: true }),
      },
    },
  ],
});
