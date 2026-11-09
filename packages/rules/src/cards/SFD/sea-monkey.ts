/** Sea Monkey. */
import { PAID_ADDITIONAL, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Sea Monkey",
  text: "You may pay [1] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, buff me. (Give me a +1 [Might] buff if I don't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "buff", target: SELF },
    },
  ],
});
