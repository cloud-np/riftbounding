/** Simian Ancestor. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Simian Ancestor",
  text: "When you buff me, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "buff", subject: SELF, player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});
