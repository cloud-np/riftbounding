/** Scrutinizing Sergeant (UNL-157) — Play Effect: gain 1 XP per friendly unit (740.1), itself included. */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Scrutinizing Sergeant",
  text: "When you play me, gain 1 XP for each friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "gain_xp",
        amount: { kind: "count", selector: { cardType: "unit", controller: "self" } },
      },
    },
  ],
});
