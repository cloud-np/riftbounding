/** Disarming Rake. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Disarming Rake",
  text: "When you play me, you may kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
    },
  ],
});
