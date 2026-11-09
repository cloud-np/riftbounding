/** Enthusiastic Promoter. */
import { HERE, registerCardScript, WHEN_I_HOLD } from "../sdk";

registerCardScript({
  name: "Enthusiastic Promoter",
  text: "[Backline] (I must be assigned combat damage last.)\nWhen I hold, [Buff] all units here. (Give each a +1 [might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: { op: "buff", target: { cardType: "unit", zone: HERE, all: true } },
    },
  ],
});
