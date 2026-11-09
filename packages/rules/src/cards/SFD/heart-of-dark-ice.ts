/** Heart of Dark Ice. */
import { registerCardScript, SELF } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Heart of Dark Ice",
  text: "[Tap]: Give a unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "temporary_might", amount: 3, target: target() },
    },
  ],
});
